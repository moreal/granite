import type { Note } from "./notes";
import { wikiLink } from "./links";
import type { NoteStorage } from "../storage/storage";
export async function extractSelection(
  storage: NoteStorage,
  source: Note,
  body: string,
  from: number,
  to: number,
  title: string,
) {
  if (from < 0 || to > body.length || from >= to)
    throw Error("옮길 내용을 먼저 선택해 주세요.");
  const target = await storage.create(title, body.slice(from, to));
  try {
    const saved = await storage.write(
      source,
      body.slice(0, from) + wikiLink(title) + body.slice(to),
    );
    return { kind: "success" as const, target, source: saved };
  } catch (error) {
    return { kind: "copy-only" as const, target, error };
  }
}
