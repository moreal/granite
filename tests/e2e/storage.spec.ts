import { test, expect } from "@playwright/test";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DirectoryStorage, ConflictError } from "../../src/storage/storage";
import { DiskDirectory, fixture } from "../helpers/disk-handles";

let directory: string;
let handle: DiskDirectory;
let storage: DirectoryStorage;
test.beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "granite-acceptance-"));
  handle = await fixture(directory);
  storage = new DirectoryStorage(handle, "disk-smoke");
});
test.afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test("S01 S03 disk adapter lists only root Markdown and preserves ordinary existing text", async () => {
  const notes = await storage.list();
  expect(notes.map((n) => n.title)).toEqual(["기존"]);
  expect(notes[0].body).toBe("# 원래 본문\n\n그대로 보존\n");
  await storage.write(notes[0], "# 고친 본문\n");
  expect(await readFile(path.join(directory, "기존.md"), "utf8")).toBe(
    "# 고친 본문\n",
  );
  expect(await readFile(path.join(directory, "keep.txt"), "utf8")).toBe(
    "비 Markdown 원본",
  );
  expect(
    await readFile(path.join(directory, "nested", "hidden.md"), "utf8"),
  ).toBe("보이면 안 됨");
});

test("S03 disk adapter round-trips encoded and long titles without nested files", async () => {
  const title = "한글 / 질문?: 100% 🪨";
  const note = await storage.create(title, "원본 문장");
  expect(note.filename).toBe(
    "%ED%95%9C%EA%B8%80%20%2F%20%EC%A7%88%EB%AC%B8%3F%3A%20100%25%20%F0%9F%AA%A8.md",
  );
  expect((await storage.read(note.filename)).title).toBe(title);
  expect(await readFile(path.join(directory, note.filename), "utf8")).toContain(
    "원본 문장",
  );
  const long = "긴 제목 한글 🪨 ".repeat(50);
  const longNote = await storage.create(long, "긴 제목 본문");
  expect(longNote.filename.length).toBeLessThan(80);
  expect((await storage.read(longNote.filename)).title).toBe(long);
  expect(
    (await readdir(directory, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  ).toEqual(["nested"]);
  const prior = await readFile(path.join(directory, note.filename), "utf8");
  await expect(storage.create(title, "덮어쓰면 안 됨")).rejects.toThrow("이미");
  expect(await readFile(path.join(directory, note.filename), "utf8")).toBe(
    prior,
  );
});

test("S10 disk adapter refuses external replacement and keeps its bytes", async () => {
  const note = await storage.create("충돌 노트", "처음");
  const external = "# 외부에서 수정한 글\n";
  await writeFile(path.join(directory, note.filename), external);
  await expect(storage.write(note, "앱 편집")).rejects.toBeInstanceOf(
    ConflictError,
  );
  expect(await readFile(path.join(directory, note.filename), "utf8")).toBe(
    external,
  );
});

for (const failure of ["createWritable", "write", "close"] as const) {
  test(`S10 disk adapter ${failure} failure rejects without overwriting saved bytes`, async () => {
    const note = await storage.create("실패 검증", "저장된 원본");
    const before = await readFile(path.join(directory, note.filename), "utf8");
    handle.failAt = failure;
    await expect(storage.write(note, "실패할 수정")).rejects.toThrow();
    expect(await readFile(path.join(directory, note.filename), "utf8")).toBe(
      before,
    );
  });
}

test("S10 disk adapter write resolves only after close has completed", async () => {
  const note = await storage.create("지연 저장", "처음");
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const atClose = new Promise<void>((resolve) => {
    reached = resolve;
  });
  handle.beforeClose = async () => {
    reached();
    await gate;
  };
  let resolved = false;
  const writing = storage.write(note, "나중").then((result) => {
    resolved = true;
    return result;
  });
  await atClose;
  expect(resolved).toBe(false);
  expect(await readFile(path.join(directory, note.filename), "utf8")).toContain(
    "처음",
  );
  release();
  expect((await writing).body).toBe("나중");
  expect(await readFile(path.join(directory, note.filename), "utf8")).toContain(
    "나중",
  );
});
