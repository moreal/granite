import { it, expect, vi } from "vitest";
import { Workspace } from "../../src/storage/workspace";
import { DemoStorage, Drafts } from "../../src/storage/storage";
import { pasteStillCurrent, safeWebUrl } from "../../src/editor/helpers";
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
it("serializes slow writes and never marks newer edits saved early", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "old");
  let release!: () => void;
  const real = s.write.bind(s);
  let first = true;
  s.write = async (n, b) => {
    if (first) {
      first = false;
      await new Promise<void>((r) => (release = r));
    }
    return real(n, b);
  };
  const w = new Workspace(s, () => {});
  w.load(n);
  w.edit(n.filename, "one");
  const saving = w.flush(n.filename);
  await Promise.resolve();
  w.edit(n.filename, "two");
  expect(w.get(n.filename).status).not.toBe("saved");
  release();
  await saving;
  expect((await s.read(n.filename)).body).toBe("two");
  expect(w.get(n.filename).status).toBe("saved");
  expect(new Drafts(s.id).get(n.filename)).toBeNull();
});
it("retains the draft and baseline on external conflict across navigation and reload", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "old");
  const w = new Workspace(s, () => {});
  w.load(n);
  w.edit(n.filename, "mine");
  await s.write(n, "theirs");
  expect(await w.flush(n.filename)).toBe(false);
  const reloaded = new Workspace(s, () => {});
  const current = await s.read(n.filename);
  reloaded.load(current);
  expect(reloaded.get(n.filename).body).toBe("mine");
  expect(reloaded.get(n.filename).status).toBe("conflict");
  expect((await s.read(n.filename)).body).toBe("theirs");
});
it("rejects stale paste title replacements after any intervening editor change", () => {
  expect(
    pasteStillCurrent("x https://a.test", 2, 16, "https://a.test", 4, 5),
  ).toBe(false);
  expect(
    pasteStillCurrent("x https://a.test", 2, 16, "https://a.test", 4, 4),
  ).toBe(true);
});
it("permits only HTTP(S) links and blocks executable URL protocols", () => {
  expect(safeWebUrl("javascript:alert(1)")).toBeNull();
  expect(safeWebUrl("https://example.org")).toBe("https://example.org/");
});
it("clears a failed draft when the user returns to the saved body", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "old");
  const w = new Workspace(s, () => {});
  w.load(n);
  const write = s.write.bind(s);
  s.write = async () => {
    throw Error("denied");
  };
  w.edit(n.filename, "failed");
  expect(await w.flush(n.filename)).toBe(false);
  s.write = write;
  w.edit(n.filename, "old");
  await w.flush(n.filename);
  expect(w.get(n.filename).error).toBeNull();
  expect(new Drafts(s.id).get(n.filename)).toBeNull();
});
it("preserves a different session draft when another tab saves then the first conflicts", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "old");
  const a = new Workspace(s, () => {}),
    b = new Workspace(s, () => {});
  a.load(n);
  b.load(n);
  a.edit(n.filename, "A unsaved");
  b.edit(n.filename, "B saved");
  await b.flush(n.filename);
  expect(await a.flush(n.filename)).toBe(false);
  expect(new Drafts(s.id).get(n.filename)?.body).toBe("A unsaved");
  const afterReload = new Workspace(s, () => {});
  afterReload.load(await s.read(n.filename));
  expect(afterReload.get(n.filename).body).toBe("A unsaved");
  expect(afterReload.get(n.filename).status).toBe("conflict");
});
it("preserves two independently authored recovery candidates", () => {
  localStorage.clear();
  const a = new Drafts("repository"),
    b = new Drafts("repository");
  a.put("note.md", "one", "old");
  b.put("note.md", "two", "old");
  expect(
    a
      .list("note.md")
      .map((d) => d.body)
      .sort(),
  ).toEqual(["one", "two"]);
  b.remove("note.md", "two");
  expect(new Drafts("repository").get("note.md")?.body).toBe("one");
});
it("archives the current unique unsaved body before switching recovery candidates", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "disk");
  const a = new Drafts(s.id),
    b = new Drafts(s.id);
  a.put(n.filename, "recovered A", n.baseline);
  b.put(n.filename, "recovered B", n.baseline);
  const w = new Workspace(s, () => {});
  w.load(n);
  w.edit(n.filename, "unique A+ unsaved");
  await w.restoreDraft(n.filename, b.owner);
  expect(w.get(n.filename).body).toBe("recovered B");
  expect(new Drafts(s.id).list(n.filename).map((d) => d.body)).toContain(
    "unique A+ unsaved",
  );
});
it("retires an unchanged recovered ancestor after its edited replacement is saved", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "disk");
  new Drafts(s.id).put(n.filename, "recovered A", n.baseline);
  const w = new Workspace(s, () => {});
  w.load(n);
  w.edit(n.filename, "edited A2");
  expect(await w.flush(n.filename)).toBe(true);
  const reloaded = new Workspace(s, () => {});
  reloaded.load(await s.read(n.filename));
  expect(reloaded.get(n.filename).body).toBe("edited A2");
  expect(reloaded.get(n.filename).status).toBe("saved");
  expect(new Drafts(s.id).list(n.filename)).toEqual([]);
});
it("retiring a recovered source never deletes a newer version from its original author", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "disk");
  const original = new Drafts(s.id);
  original.put(n.filename, "ancestor", n.baseline);
  const w = new Workspace(s, () => {});
  w.load(n);
  original.put(n.filename, "new independent revision", n.baseline);
  w.edit(n.filename, "saved replacement");
  await w.flush(n.filename);
  expect(new Drafts(s.id).list(n.filename).map((d) => d.body)).toContain(
    "new independent revision",
  );
});
it("retires archived recovery lineage only after its replacement is saved", async () => {
  localStorage.clear();
  const s = new DemoStorage();
  const n = await s.create("A", "disk");
  const a = new Drafts(s.id),
    b = new Drafts(s.id);
  a.put(n.filename, "ancestor A", n.baseline);
  b.put(n.filename, "independent B", n.baseline);
  const w = new Workspace(s, () => {});
  w.load(n);
  await w.restoreDraft(n.filename, a.owner);
  w.edit(n.filename, "A plus");
  await w.restoreDraft(n.filename, b.owner);
  const archived = w.drafts.list(n.filename).find((d) => d.body === "A plus")!;
  await w.restoreDraft(n.filename, archived.owner);
  w.edit(n.filename, "A final");
  await w.flush(n.filename);
  const remaining = new Drafts(s.id).list(n.filename).map((d) => d.body);
  expect(remaining).toContain("independent B");
  expect(remaining).not.toContain("ancestor A");
  expect(remaining).not.toContain("A plus");
});
