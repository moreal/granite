import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

// Explicitly list build inputs. Never archive the repository root: it may contain
// local notes, secrets, node_modules, test output, or another developer's files.
const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const sourceName = "granite-source.tar.gz";
const hongdownVersion = "0.5.3";
const hongdownCommit = "884fd93f8c766c16a2861868fa3b8b296309f5aa";
const files = [
  ".yarnrc.yml",
  "chromatic.config.json",
  "index.html",
  "LICENSE",
  "LICENSES/MIT-legacy.txt",
  "package.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "tsconfig.e2e.json",
  "tsconfig.json",
  "vite.config.ts",
  "yarn.lock",
];
const trees = [
  ["src", /\.(?:ts|tsx|css|png|jpe?g|gif|webp|svg|woff2?|wasm)$/i],
  ["tests", /\.(?:ts|tsx|css|png|jpe?g|gif|webp|svg)$/i],
  ["public", /\.(?:html|txt|md|png|jpe?g|gif|webp|svg|woff2?|wasm|gz)$/i],
  ["scripts", /\.mjs$/i],
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function visit(directory, accept, destination) {
  for (const entry of readdirSync(join(root, directory), {
    withFileTypes: true,
  })) {
    const name = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Refusing symlink in source: ${name}`);
    if (entry.isDirectory()) {
      visit(name, accept, destination);
    } else if (entry.isFile()) {
      if (!accept.test(entry.name))
        throw new Error(`Unexpected source file: ${name}`);
      files.push(name);
      const target = join(destination, name);
      mkdirSync(resolve(target, ".."), { recursive: true });
      copyFileSync(join(root, name), target);
    }
  }
}

function listDist(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Refusing symlink in build: ${path}`);
    if (entry.isDirectory()) result.push(...listDist(path));
    else if (entry.isFile())
      result.push(relative(dist, path).split(sep).join("/"));
  }
  return result;
}

function publishPackageNotices() {
  const store = join(root, "node_modules", ".store");
  if (!existsSync(store))
    throw new Error("Install locked packages before publishing notices");
  const notices = new Map();
  for (const entry of readdirSync(store, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(store, entry.name, "package");
    const metadataPath = join(packageDir, "package.json");
    if (!existsSync(metadataPath)) continue;
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    if (!metadata.name || !metadata.version) continue;
    const id = `${metadata.name}@${metadata.version}`;
    if (notices.has(id)) continue;
    const names = readdirSync(packageDir)
      .filter((name) =>
        /^(?:licen[cs]e|copying|notice)(?:[.\-_].*)?$/i.test(name),
      )
      .sort();
    const texts = names
      .filter((name) => lstatSync(join(packageDir, name)).isFile())
      .map(
        (name) =>
          `--- ${name} ---\n${readFileSync(join(packageDir, name), "utf8")}`,
      );
    notices.set(
      id,
      `==== ${id} ====` +
        `\nDeclared license: ${JSON.stringify(metadata.license ?? "not declared")}\n` +
        (texts.length
          ? texts.join("\n\n")
          : "No top-level license file in installed package.") +
        "\n",
    );
  }
  const output = join(dist, "licenses", "packages.txt");
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(
    output,
    `Installed package license files from this build's immutable Yarn install.\n` +
      `Some packages contain further notices in subdirectories. See their upstream source.\n\n` +
      [...notices]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value)
        .join("\n"),
  );
  return notices.size;
}

if (!existsSync(join(dist, "index.html"))) {
  throw new Error("Build Granite before publishing its source: yarn build");
}
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.dependencies?.["@hongdown/wasm"] !== hongdownVersion) {
  throw new Error(`Expected @hongdown/wasm exactly ${hongdownVersion}`);
}
const lock = readFileSync(join(root, "yarn.lock"), "utf8");
if (!lock.includes(`@hongdown/wasm@npm:${hongdownVersion}`)) {
  throw new Error("Yarn lock does not contain the pinned Hongdown release");
}

const temp = mkdtempSync(join(tmpdir(), "granite-source-"));
try {
  const stage = join(temp, "granite");
  mkdirSync(stage);
  for (const file of files) {
    const source = join(root, file);
    if (!existsSync(source) || !lstatSync(source).isFile()) {
      throw new Error(`Missing build input: ${file}`);
    }
    const destination = join(stage, file);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    copyFileSync(source, destination);
  }
  for (const [tree, accept] of trees) {
    if (existsSync(join(root, tree))) visit(tree, accept, stage);
  }
  const buildInputs = files.sort();
  const sourceFiles = Object.fromEntries(
    buildInputs.map((file) => [
      file.split(sep).join("/"),
      sha256(join(root, file)),
    ]),
  );
  let revision = null;
  try {
    revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // A source checkout without Git remains buildable; hashes identify its inputs.
  }
  const packageNoticeCount = publishPackageNotices();
  const buildFiles = Object.fromEntries(
    listDist(dist)
      .filter((file) => !file.startsWith("source/"))
      .sort()
      .map((file) => [file, sha256(join(dist, file))]),
  );
  const archive = join(dist, "source", sourceName);
  mkdirSync(resolve(archive, ".."), { recursive: true });
  execFileSync("tar", ["-czf", archive, "-C", temp, "granite"], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  const hongdownArchive = join(
    dist,
    "source",
    `hongdown-${hongdownVersion}-source.tar.gz`,
  );
  if (!existsSync(hongdownArchive)) {
    throw new Error("Hongdown corresponding source was not copied into dist");
  }
  const manifest = {
    granite: {
      revision,
      source: sourceName,
      sourceSha256: sha256(archive),
      buildCommand:
        "yarn install --immutable && VITE_BASE_PATH=/granite/ yarn build",
      node: "24",
      yarn: pkg.packageManager,
      buildInputs: sourceFiles,
      buildFiles,
    },
    hongdown: {
      package: `@hongdown/wasm@${hongdownVersion}`,
      upstreamCommit: hongdownCommit,
      upstreamTag: hongdownVersion,
      source: `hongdown-${hongdownVersion}-source.tar.gz`,
      sourceSha256: sha256(hongdownArchive),
    },
    installedPackageNoticeCount: packageNoticeCount,
  };
  writeFileSync(
    join(dist, "source", "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(
    `Published source for ${buildInputs.length} Granite inputs and Hongdown ${hongdownVersion}.\n`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
