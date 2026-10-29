// @vitest-environment node
import { test, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("S30b source offer includes the complete local font and OFL while rejecting unrelated text", () => {
  const root = resolve(import.meta.dirname, "../..");
  const temp = mkdtempSync(join(tmpdir(), "granite-font-source-"));
  try {
    const publisher = readFileSync(
      join(root, "scripts/publish-source.mjs"),
      "utf8",
    );
    const topFiles = [
      ...publisher
        .match(/const files = \[([\s\S]*?)\];/)![1]
        .matchAll(/"([^"]+)"/g),
    ].map((match) => match[1]);
    for (const file of [
      ...topFiles,
      "scripts/publish-source.mjs",
      "src/assets/fonts/NotoSerifKR.woff2",
      "src/assets/fonts/OFL.LICENSE",
      "src/assets/fonts/README.md",
    ]) {
      mkdirSync(dirname(join(temp, file)), { recursive: true });
      copyFileSync(join(root, file), join(temp, file));
    }
    mkdirSync(join(temp, "dist/source"), { recursive: true });
    mkdirSync(join(temp, "node_modules/.store"), { recursive: true });
    writeFileSync(join(temp, "dist/index.html"), "<html></html>");
    writeFileSync(
      join(temp, "dist/source/hongdown-0.5.3-source.tar.gz"),
      "fixture",
    );
    const publish = () =>
      execFileSync(
        process.execPath,
        [join(temp, "scripts/publish-source.mjs")],
        { cwd: temp, stdio: "pipe" },
      );
    publish();
    const manifest = JSON.parse(
      readFileSync(join(temp, "dist/source/manifest.json"), "utf8"),
    );
    for (const file of ["NotoSerifKR.woff2", "OFL.LICENSE", "README.md"])
      expect(manifest.granite.buildInputs[`src/assets/fonts/${file}`]).toMatch(
        /^[a-f0-9]{64}$/,
      );
    const license = execFileSync(
      "tar",
      [
        "-xOzf",
        join(temp, "dist/source/granite-source.tar.gz"),
        "granite/src/assets/fonts/OFL.LICENSE",
      ],
      { encoding: "utf8" },
    );
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
    writeFileSync(join(temp, "src/private-note.txt"), "must not be offered");
    expect(publish).toThrow(/Unexpected source file/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
