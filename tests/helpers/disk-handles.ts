import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import type { DirectoryHandle, FileHandle } from "../../src/storage/storage";

// Test boundary only. Real Node disk bytes back these handles; browser permission UI is not modeled.
export class DiskDirectory implements DirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  failAt: "createWritable" | "write" | "close" | null = null;
  beforeClose?: () => Promise<void>;
  constructor(readonly directory: string) {
    this.name = path.basename(directory);
  }
  async *values(): AsyncIterable<FileHandle | DirectoryHandle> {
    for (const entry of await readdir(this.directory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory())
        yield new DiskDirectory(path.join(this.directory, entry.name));
      else if (entry.isFile()) yield this.file(entry.name);
    }
  }
  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandle> {
    if (path.basename(name) !== name || name === "." || name === "..")
      throw new DOMException("Invalid name", "TypeMismatchError");
    const filename = path.join(this.directory, name);
    try {
      await stat(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!options?.create)
        throw new DOMException("Missing file", "NotFoundError");
      await writeFile(filename, "", { flag: "wx" });
    }
    return this.file(name);
  }
  private file(name: string): FileHandle {
    const filename = path.join(this.directory, name);
    return {
      kind: "file",
      name,
      getFile: async () => {
        const raw = await readFile(filename, "utf8");
        return {
          text: async () => raw,
          lastModified: (await stat(filename)).mtimeMs,
        };
      },
      createWritable: async () => {
        if (this.failAt === "createWritable")
          throw new DOMException("Permission denied", "NotAllowedError");
        let pending = "";
        return {
          write: async (data) => {
            if (this.failAt === "write")
              throw new DOMException("Write failed", "UnknownError");
            pending = data;
          },
          close: async () => {
            await this.beforeClose?.();
            if (this.failAt === "close")
              throw new DOMException("Close failed", "UnknownError");
            await writeFile(filename, pending);
          },
          abort: async () => {},
        };
      },
    };
  }
  async isSameEntry(other: DirectoryHandle): Promise<boolean> {
    return other instanceof DiskDirectory && other.directory === this.directory;
  }
  async queryPermission() {
    return "granted";
  }
  async requestPermission() {
    return "granted";
  }
}

export async function fixture(directory: string) {
  await mkdir(path.join(directory, "nested"));
  await writeFile(
    path.join(directory, "기존.md"),
    "# 원래 본문\n\n그대로 보존\n",
  );
  await writeFile(path.join(directory, "keep.txt"), "비 Markdown 원본");
  await writeFile(path.join(directory, "nested", "hidden.md"), "보이면 안 됨");
  return new DiskDirectory(directory);
}
