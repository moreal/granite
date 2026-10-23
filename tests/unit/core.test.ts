import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  filenameFor,
  assertAvailable,
  encodeNote,
  decodeNote,
} from "../../src/domain/notes";
import {
  wikiLink,
  parseWikiLinks,
  localDate,
  backlinks,
  menuTrigger,
} from "../../src/domain/links";
import { DemoStorage, Drafts, ConflictError } from "../../src/storage/storage";
import { extractSelection } from "../../src/domain/extract";

const data = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => data.set(k, v),
  removeItem: (k: string) => data.delete(k),
  clear: () => data.clear(),
  key: (i: number) => [...data.keys()][i] ?? null,
  get length() {
    return data.size;
  },
});

describe("portable filenames", () => {
  it.each(["안녕 / ? : % 😀", "a[b]\\c", "CON", "é"])(
    "round trips %s without path separators",
    (title) => {
      const filename = filenameFor(title);
      expect(filename).not.toMatch(/[\\/]/);
      expect(decodeNote(filename, encodeNote(title, "본문")).title).toBe(title);
    },
  );
  it("uses a bounded deterministic name for long Korean titles and preserves the exact title", () => {
    const title = "긴 제목😀".repeat(100);
    const file = filenameFor(title);
    expect(file.length).toBeLessThan(150);
    expect(filenameFor(title)).toBe(file);
    expect(decodeNote(file, encodeNote(title, "hello")).title).toBe(title);
  });
  it("rejects empty, case, normalization and filename collisions", () => {
    expect(() => assertAvailable("  ", [])).toThrow();
    expect(() =>
      assertAvailable("hello", [{ title: "Hello", filename: "Hello.md" }]),
    ).toThrow();
    expect(() =>
      assertAvailable("e\u0301", [{ title: "é", filename: "%C3%A9.md" }]),
    ).toThrow();
    expect(() =>
      assertAvailable("new", [{ title: "other", filename: "new.md" }]),
    ).toThrow();
  });
  it("reads ordinary Markdown without changing its frontmatter", () => {
    const raw = "---\ntags: test\n---\nhello";
    expect(decodeNote("plain.md", raw).body).toBe(raw);
  });
});
describe("connections", () => {
  it("escapes brackets and backslashes reversibly", () => {
    expect(parseWikiLinks(wikiLink("a[b]\\c"))[0].title).toBe("a[b]\\c");
  });
  it("ignores fenced, inline and indented code", () => {
    const body =
      "[[real]]\n```md\n[[fake]]\n```\n`[[inline]]`\n\n    [[indented]]\n[[last]]";
    expect(parseWikiLinks(body).map((x) => x.title)).toEqual(["real", "last"]);
  });
  it("provides backlink context and excludes unrelated notes", () => {
    expect(
      backlinks(
        [
          { title: "A", body: "before [[B]] after", filename: "A.md" },
          { title: "C", body: "`[[B]]`", filename: "C.md" },
        ],
        "B",
      ),
    ).toMatchObject([{ title: "A", context: "before [[B]] after" }]);
  });
  it("computes dates in local time at execution, including month boundary", () => {
    expect(localDate(-1, new Date(2026, 0, 1, 0, 5))).toBe("2025-12-31");
  });
  it("does not trigger @ within email or during IME composition", () => {
    expect(menuTrigger("me@example", 10, false)).toBeNull();
    expect(menuTrigger("@오늘", 3, true)).toBeNull();
    expect(menuTrigger("hi @어", 5, false)).toMatchObject({
      kind: "command",
      query: "어",
    });
    expect(menuTrigger("[[abc", 5, false)).toMatchObject({
      kind: "wiki",
      query: "abc",
    });
  });
});
describe("storage and recovery", () => {
  beforeEach(() => localStorage.clear());
  it("persists demo separately and detects external changes", async () => {
    const store = new DemoStorage();
    const n = await store.create("A", "one");
    const second = new DemoStorage();
    await second.write(n, "external");
    await expect(store.write(n, "mine")).rejects.toBeInstanceOf(ConflictError);
    expect((await store.read(n.filename)).body).toBe("external");
  });
  it("does not overwrite duplicates", async () => {
    const store = new DemoStorage();
    await store.create("A", "first");
    await expect(store.create("a", "second")).rejects.toThrow();
    expect((await store.list())[0].body).toBe("first");
  });
  it("recovers failed drafts after reload isolated by repository", () => {
    const d = new Drafts("one");
    d.put("A.md", "unsaved", "old");
    expect(new Drafts("one").get("A.md")).toMatchObject({
      body: "unsaved",
      baseline: "old",
    });
    expect(new Drafts("two").get("A.md")).toBeNull();
  });
});
describe("two-write extraction", () => {
  beforeEach(() => localStorage.clear());
  it("creates target, replaces exact source selection, and returns target", async () => {
    const s = new DemoStorage();
    const n = await s.create("Source", "a selected z");
    const result = await extractSelection(s, n, n.body, 2, 10, "Target");
    expect(result.kind).toBe("success");
    expect((await s.read(n.filename)).body).toBe("a [[Target]] z");
    expect((await s.read("Target.md")).body).toBe("selected");
  });
  it("keeps source when target title conflicts", async () => {
    const s = new DemoStorage();
    const n = await s.create("Source", "selected");
    await s.create("Target", "old");
    await expect(
      extractSelection(s, n, n.body, 0, 8, "Target"),
    ).rejects.toThrow();
    expect((await s.read(n.filename)).body).toBe("selected");
  });
  it("reports generated copy and preserves source after source-write failure", async () => {
    const s = new DemoStorage();
    const n = await s.create("Source", "selected");
    const failing = {
      ...s,
      list: () => s.list(),
      read: (f: string) => s.read(f),
      create: (t: string, b: string) => s.create(t, b),
      write: async () => {
        throw Error("disk full");
      },
      id: s.id,
      label: s.label,
      kind: s.kind,
    };
    const r = await extractSelection(failing, n, n.body, 0, 8, "Target");
    expect(r.kind).toBe("copy-only");
    expect((await s.read(n.filename)).body).toBe("selected");
    expect((await s.read("Target.md")).body).toBe("selected");
  });
});
describe("overlapping mutations", () => {
  beforeEach(() => localStorage.clear());
  it("preserves both concurrently created demo notes", async () => {
    const s = new DemoStorage();
    await Promise.all([s.create("A", "first"), s.create("B", "second")]);
    expect((await s.list()).map((n) => n.title).sort()).toEqual(["A", "B"]);
  });
  it("preserves writes overlapping creation", async () => {
    const s = new DemoStorage();
    const a = await s.create("A", "old");
    await Promise.all([s.create("B", "new"), s.write(a, "edited")]);
    expect((await s.list()).map((n) => [n.title, n.body]).sort()).toEqual([
      ["A", "edited"],
      ["B", "new"],
    ]);
  });
  it("isolates draft tuple keys even with punctuation", () => {
    new Drafts("a.b").put("c.md", "one", "");
    new Drafts("a").put("b.c.md", "two", "");
    expect(new Drafts("a.b").get("c.md")?.body).toBe("one");
  });
  it("recognizes a link after an even number of literal backslashes", () => {
    expect(parseWikiLinks("\\\\[[yes]]").map((x) => x.title)).toEqual(["yes"]);
    expect(parseWikiLinks("\\[[no]]")).toEqual([]);
  });
});
