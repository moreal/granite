import type { Note } from "../domain/notes";
import {
  ConflictError,
  Drafts,
  type NoteStorage,
  type DraftReference,
} from "./storage";
export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";
export interface Entry {
  note: Note;
  body: string;
  status: SaveStatus;
  error: string | null;
  recovered: boolean;
  recoverySources: DraftReference[];
}
export class Workspace {
  readonly entries = new Map<string, Entry>();
  readonly drafts: Drafts;
  private pending = new Map<string, Promise<boolean>>();
  constructor(
    readonly storage: NoteStorage,
    private changed: () => void,
  ) {
    this.drafts = new Drafts(storage.id);
  }
  load(note: Note) {
    if (this.entries.has(note.filename)) return;
    const draft = this.drafts.get(note.filename);
    const differs = draft && draft.body !== note.body;
    this.entries.set(note.filename, {
      note: differs ? { ...note, baseline: draft.baseline } : note,
      body: differs ? draft.body : note.body,
      status: differs
        ? draft.baseline === note.baseline
          ? "dirty"
          : "conflict"
        : "saved",
      error:
        differs && draft.baseline !== note.baseline
          ? "파일이 바뀌었습니다. 복구한 초안을 보관 중입니다."
          : null,
      recovered: !!differs,
      recoverySources: differs
        ? [this.drafts.reference(draft), ...draft.ancestors]
        : [],
    });
    this.changed();
  }
  get(filename: string) {
    const e = this.entries.get(filename);
    if (!e) throw Error("노트가 열려 있지 않습니다.");
    return e;
  }
  edit(filename: string, body: string) {
    const e = this.get(filename);
    e.body = body;
    e.status = e.status === "conflict" ? "conflict" : "dirty";
    try {
      this.drafts.put(filename, body, e.note.baseline, e.recoverySources);
    } catch {
      e.error =
        "브라우저 초안 보관에 실패했습니다. 창을 닫기 전에 파일로 저장해 주세요.";
    }
    this.changed();
  }
  flush(filename: string): Promise<boolean> {
    const running = this.pending.get(filename);
    if (running) return running;
    const task = this.perform(filename);
    this.pending.set(filename, task);
    void task.finally(() => this.pending.delete(filename));
    return task;
  }
  private async perform(filename: string) {
    const e = this.get(filename);
    if (e.status === "conflict") return false;
    while (e.body !== e.note.body) {
      const body = e.body;
      e.status = "saving";
      this.changed();
      try {
        e.note = await this.storage.write(e.note, body);
        for (const source of e.recoverySources)
          this.drafts.retire(filename, source);
        e.recoverySources = [];
        if (e.body === body) {
          this.drafts.remove(filename, body);
          e.status = "saved";
          e.error = null;
          e.recovered = false;
        } else {
          this.drafts.put(filename, e.body, e.note.baseline, e.recoverySources);
          e.status = "dirty";
        }
      } catch (error) {
        try {
          this.drafts.put(filename, e.body, e.note.baseline, e.recoverySources);
        } catch {}
        e.status = error instanceof ConflictError ? "conflict" : "error";
        e.error =
          error instanceof Error ? error.message : "저장에 실패했습니다.";
        this.changed();
        return false;
      }
    }
    for (const source of e.recoverySources)
      this.drafts.retire(filename, source);
    e.recoverySources = [];
    this.drafts.remove(filename, e.body);
    e.status = "saved";
    e.error = null;
    e.recovered = false;
    this.changed();
    return true;
  }
  replaceSaved(note: Note) {
    const previous = this.entries.get(note.filename);
    if (previous) {
      this.drafts.remove(note.filename, previous.body);
      for (const source of previous.recoverySources)
        this.drafts.retire(note.filename, source);
    }
    this.entries.set(note.filename, {
      note,
      body: note.body,
      status: "saved",
      error: null,
      recovered: false,
      recoverySources: [],
    });
    this.drafts.remove(note.filename, note.body);
    this.changed();
  }
  async restoreDraft(filename: string, owner: string) {
    const draft = this.drafts.list(filename).find((d) => d.owner === owner);
    if (!draft) return;
    const note = await this.storage.read(filename);
    const previous = this.get(filename);
    if (
      previous.status !== "saved" &&
      (previous.body !== draft.body ||
        previous.note.baseline !== draft.baseline)
    ) {
      this.drafts.archive(
        filename,
        previous.body,
        previous.note.baseline,
        previous.recoverySources,
      );
    }
    const recoverySources = [this.drafts.reference(draft), ...draft.ancestors];
    this.drafts.put(filename, draft.body, draft.baseline, recoverySources);
    this.entries.set(filename, {
      note: { ...note, baseline: draft.baseline },
      body: draft.body,
      status: draft.baseline === note.baseline ? "dirty" : "conflict",
      error:
        draft.baseline === note.baseline
          ? null
          : "파일이 바뀌었습니다. 선택한 초안을 보관 중입니다.",
      recovered: true,
      recoverySources,
    });
    this.changed();
  }
  async reload(filename: string) {
    const note = await this.storage.read(filename);
    this.replaceSaved(note);
  }
}
