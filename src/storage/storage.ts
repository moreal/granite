import {
  assertAvailable,
  decodeNote,
  encodeNote,
  serializeNote,
  type Note,
} from "../domain/notes";
const mutationQueues = new Map<string, Promise<unknown>>();
async function serialize<T>(
  id: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("granite:" + id, operation);
  const previous = mutationQueues.get(id) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(operation);
  mutationQueues.set(id, task);
  try {
    return await task;
  } finally {
    if (mutationQueues.get(id) === task) mutationQueues.delete(id);
  }
}
export class ConflictError extends Error {
  constructor() {
    super("다른 곳에서 파일이 변경되었습니다. 초안은 보관했습니다.");
    this.name = "ConflictError";
  }
}
export interface NoteStorage {
  id: string;
  label: string;
  kind: "demo" | "folder";
  list(): Promise<Note[]>;
  read(filename: string): Promise<Note>;
  create(title: string, body: string): Promise<Note>;
  write(note: Note, body: string): Promise<Note>;
}
export class DemoStorage implements NoteStorage {
  id = "demo-v1";
  label = "데모 노트";
  kind = "demo" as const;
  static key = "granite.demo.v1";
  private data(): Record<string, { raw: string; updated: number }> {
    return JSON.parse(localStorage.getItem(DemoStorage.key) || "{}");
  }
  async list() {
    return Object.entries(this.data())
      .map(([f, d]) => decodeNote(f, d.raw, d.updated))
      .sort((a, b) => b.updated - a.updated);
  }
  async read(filename: string) {
    const d = this.data()[filename];
    if (!d) throw Error("노트를 찾을 수 없습니다.");
    return decodeNote(filename, d.raw, d.updated);
  }
  async create(title: string, body: string) {
    return serialize(this.id, async () => {
      const data = this.data();
      const f = assertAvailable(title, await this.list(), Object.keys(data));
      data[f] = { raw: encodeNote(title, body), updated: Date.now() };
      localStorage.setItem(DemoStorage.key, JSON.stringify(data));
      return this.read(f);
    });
  }
  async write(note: Note, body: string) {
    return serialize(this.id, async () => {
      const data = this.data();
      if (data[note.filename]?.raw !== note.baseline) throw new ConflictError();
      data[note.filename] = {
        raw: serializeNote(note, body),
        updated: Date.now(),
      };
      localStorage.setItem(DemoStorage.key, JSON.stringify(data));
      return this.read(note.filename);
    });
  }
}
export interface DraftReference {
  key: string;
  version: string;
  legacyRaw?: string;
}
export interface Draft {
  body: string;
  baseline: string;
  updated: number;
  owner: string;
  version: string;
  key: string;
  ancestors: DraftReference[];
}
export class Drafts {
  readonly owner = crypto.randomUUID();
  private active = new Map<string, string>();
  constructor(readonly id: string) {}
  private store(
    filename: string,
    body: string,
    baseline: string,
    owner: string,
    ancestors: DraftReference[],
  ): Draft {
    const version = crypto.randomUUID();
    const key =
      "granite.draft." + JSON.stringify([this.id, filename, owner, version]);
    const updated = Math.max(
      Date.now(),
      ...this.list(filename).map((d) => d.updated + 1),
    );
    const value = { body, baseline, updated, version, ancestors };
    localStorage.setItem(key, JSON.stringify(value));
    return { ...value, owner, key };
  }
  put(
    filename: string,
    body: string,
    baseline: string,
    ancestors: DraftReference[] = [],
  ) {
    const draft = this.store(filename, body, baseline, this.owner, ancestors);
    const previous = this.active.get(filename);
    this.active.set(filename, draft.key);
    if (previous) localStorage.removeItem(previous);
    return draft;
  }
  archive(
    filename: string,
    body: string,
    baseline: string,
    ancestors: DraftReference[] = [],
  ) {
    return this.store(
      filename,
      body,
      baseline,
      "archive-" + crypto.randomUUID(),
      ancestors,
    );
  }
  list(filename: string): Draft[] {
    const drafts: Draft[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("granite.draft.")) continue;
      try {
        const [id, file, owner] = JSON.parse(
          key.slice("granite.draft.".length),
        );
        if (id !== this.id || file !== filename) continue;
        const draft = JSON.parse(localStorage.getItem(key) || "null");
        if (
          draft &&
          typeof draft.body === "string" &&
          typeof draft.baseline === "string" &&
          Number.isFinite(draft.updated)
        )
          drafts.push({
            ...draft,
            key,
            owner: owner ?? "legacy",
            version: draft.version ?? "",
            ancestors: Array.isArray(draft.ancestors)
              ? draft.ancestors.filter(
                  (reference: unknown): reference is DraftReference =>
                    !!reference &&
                    typeof reference === "object" &&
                    typeof (reference as DraftReference).key === "string" &&
                    typeof (reference as DraftReference).version === "string",
                )
              : [],
          });
      } catch {
        /* Preserve malformed records without using them as recovery content. */
      }
    }
    return drafts.sort((a, b) => b.updated - a.updated);
  }
  get(filename: string): Draft | null {
    const drafts = this.list(filename);
    return drafts.find((d) => d.owner === this.owner) ?? drafts[0] ?? null;
  }
  reference(draft: Draft): DraftReference {
    return {
      key: draft.key,
      version: draft.version,
      ...(!draft.version
        ? { legacyRaw: localStorage.getItem(draft.key) ?? "" }
        : {}),
    };
  }
  retire(filename: string, reference: DraftReference) {
    // New snapshot keys contain a unique version, so retiring an ancestor can
    // never remove the author's newer snapshot, even across browser tabs.
    if (!reference.key?.startsWith("granite.draft.")) return;
    try {
      const [id, file] = JSON.parse(
        reference.key.slice("granite.draft.".length),
      );
      if (id !== this.id || file !== filename) return;
      const raw = localStorage.getItem(reference.key);
      if (raw === null) return;
      if (
        reference.version
          ? JSON.parse(raw).version === reference.version
          : raw === reference.legacyRaw
      )
        localStorage.removeItem(reference.key);
    } catch {
      /* An unrelated or malformed snapshot is never retired. */
    }
  }
  remove(filename: string, confirmedBody?: string) {
    for (const draft of this.list(filename))
      if (
        confirmedBody === undefined
          ? draft.owner === this.owner
          : draft.body === confirmedBody
      )
        this.retire(filename, this.reference(draft));
  }
}
export interface FileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<{ text(): Promise<string>; lastModified: number }>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
}
export interface DirectoryHandle {
  name: string;
  kind: "directory";
  values(): AsyncIterable<FileHandle | DirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandle>;
  isSameEntry(other: DirectoryHandle): Promise<boolean>;
  queryPermission?(options: { mode: "readwrite" }): Promise<string>;
  requestPermission?(options: { mode: "readwrite" }): Promise<string>;
}
export class DirectoryStorage implements NoteStorage {
  kind = "folder" as const;
  label: string;
  constructor(
    readonly handle: DirectoryHandle,
    public id: string,
  ) {
    this.label = handle.name;
  }
  private async filenames() {
    const names: string[] = [];
    for await (const h of this.handle.values())
      if (h.kind === "file") names.push(h.name);
    return names;
  }
  async list() {
    const names = await this.filenames();
    const notes = await Promise.all(
      names
        .filter((f) => f.toLowerCase().endsWith(".md"))
        .map((f) => this.read(f)),
    );
    return notes.sort((a, b) => b.updated - a.updated);
  }
  async read(filename: string) {
    const file = await (await this.handle.getFileHandle(filename)).getFile();
    return decodeNote(filename, await file.text(), file.lastModified);
  }
  private async put(handle: FileHandle, raw: string) {
    const stream = await handle.createWritable();
    try {
      await stream.write(raw);
      await stream.close();
    } catch (e) {
      try {
        await stream.abort?.();
      } catch {}
      throw e;
    }
  }
  async create(title: string, body: string) {
    return serialize(this.id, async () => {
      const names = await this.filenames();
      const f = assertAvailable(title, await this.list(), names);
      try {
        await this.handle.getFileHandle(f);
        throw Error("동일한 파일이 이미 존재합니다.");
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "NotFoundError")) throw e;
      }
      const handle = await this.handle.getFileHandle(f, { create: true });
      await this.put(handle, encodeNote(title, body));
      return this.read(f);
    });
  }
  async write(note: Note, body: string) {
    return serialize(this.id, async () => {
      let current;
      try {
        current = await this.read(note.filename);
      } catch (e) {
        if (e instanceof DOMException && e.name === "NotFoundError")
          throw new ConflictError();
        throw e;
      }
      if (current.baseline !== note.baseline) throw new ConflictError();
      await this.put(
        await this.handle.getFileHandle(note.filename),
        serializeNote(note, body),
      );
      return this.read(note.filename);
    });
  }
}
