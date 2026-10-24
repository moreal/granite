// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DirectoryStorage } from "../../src/storage/storage";
import { DiskDirectory } from "../helpers/disk-handles";
let directory: string;
let storage: DirectoryStorage;
const png = () =>
  new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], {
    type: "image/jpeg",
  });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "granite-assets-"));
  storage = new DirectoryStorage(new DiskDirectory(directory), directory);
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
test("S13 stores original bytes by hash and deduplicates concurrent writes", async () => {
  const paths = await Promise.all([
    storage.putImage(png()),
    storage.putImage(png()),
  ]);
  expect(paths[0]).toMatch(/^assets\/[a-f0-9]{64}\.png$/);
  expect(paths[1]).toBe(paths[0]);
  expect(new Uint8Array(await readFile(join(directory, paths[0])))).toEqual(
    new Uint8Array(await png().arrayBuffer()),
  );
  expect((await storage.readImage(paths[0])).type).toBe("image/png");
  expect(await storage.list()).toEqual([]);
});
test("S13 refuses spoofed image MIME and traversal", async () => {
  await expect(
    storage.putImage(new Blob(["<svg/>"], { type: "image/png" })),
  ).rejects.toThrow();
  await expect(storage.readImage("../evil.png")).rejects.toThrow();
});
test("S13 preserves corrupt existing assets and refuses to render them", async () => {
  const asset = await storage.putImage(png());
  await writeFile(join(directory, asset), "external edit");
  await expect(storage.putImage(png())).rejects.toThrow();
  await expect(storage.readImage(asset)).rejects.toThrow();
  expect(await readFile(join(directory, asset), "utf8")).toBe("external edit");
});

test("S13 rejects oversized bytes before touching the folder", async () => {
  await expect(
    storage.putImage(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)])),
  ).rejects.toThrow("20 MiB");
  expect(await storage.list()).toEqual([]);
});
test.each([
  [[255, 216, 255, 1, 2], "jpg", "image/jpeg"],
  [[71, 73, 70, 56, 57, 97, 1], "gif", "image/gif"],
  [[82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 1], "webp", "image/webp"],
] as const)(
  "S13 determines extension from original bytes %s",
  async (bytes, extension, mime) => {
    const path = await storage.putImage(new Blob([new Uint8Array(bytes)]));
    expect(path.endsWith(`.${extension}`)).toBe(true);
    expect((await storage.readImage(path)).type).toBe(mime);
  },
);
test.each(["createWritable", "write", "close"] as const)(
  "S10/S13 surfaces %s failure and preserves notes",
  async (failure) => {
    const note = await storage.create("source", "original body");
    const handle = storage.handle as DiskDirectory;
    handle.failAt = failure;
    await expect(storage.putImage(png())).rejects.toThrow();
    expect((await storage.read(note.filename)).body).toBe("original body");
  },
);
test("S13 waits for durable close before reporting the image path", async () => {
  let release!: () => void;
  let entered!: () => void;
  const closed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const closing = new Promise<void>((resolve) => {
    entered = resolve;
  });
  (storage.handle as DiskDirectory).beforeClose = async () => {
    entered();
    await closed;
  };
  let settled = false;
  const writing = storage.putImage(png()).then((path) => {
    settled = true;
    return path;
  });
  await closing;
  expect(settled).toBe(false);
  release();
  await writing;
  expect(settled).toBe(true);
});
test("S01/S13 image reads remain scoped to their selected folder", async () => {
  const asset = await storage.putImage(png());
  const elsewhere = await mkdtemp(join(tmpdir(), "granite-assets-other-"));
  try {
    const other = new DirectoryStorage(new DiskDirectory(elsewhere), elsewhere);
    await expect(other.readImage(asset)).rejects.toThrow();
  } finally {
    await rm(elsewhere, { recursive: true, force: true });
  }
});

test.each(["create", "open", "write"] as const)(
  "S10/S13 preserves external bytes introduced during image %s",
  async (stage) => {
    const root = storage.handle as DiskDirectory;
    const getDirectory = root.getDirectoryHandle.bind(root);
    let filename = "";
    root.getDirectoryHandle = async (name, options) => {
      const child = await getDirectory(name, options);
      const getFile = child.getFileHandle.bind(child);
      child.getFileHandle = async (name, options) => {
        const handle = await getFile(name, options);
        if (options?.create) {
          filename = join(child.directory, name);
          if (stage === "create") await writeFile(filename, "foreign bytes");
          const open = handle.createWritable.bind(handle);
          handle.createWritable = async () => {
            const stream = await open();
            if (stage === "open") await writeFile(filename, "foreign bytes");
            const write = stream.write.bind(stream);
            stream.write = async (data) => {
              await write(data);
              if (stage === "write") await writeFile(filename, "foreign bytes");
            };
            return stream;
          };
        }
        return handle;
      };
      return child;
    };
    await expect(storage.putImage(png())).rejects.toThrow();
    expect(await readFile(filename, "utf8")).toBe("foreign bytes");
  },
);
