import { readFrontmatter } from "../domain/frontmatter";
import { parseWikiLinks } from "../domain/links";
import { normalizeType, schemaProperty, typeAncestors } from "./index";
export interface NoteReference {
  title: string;
  types: string[];
  known: boolean;
}
export type Compatibility = "compatible" | "unknown" | "mismatch";
export function noteReference(title: string, body: string): NoteReference {
  const metadata = readFrontmatter(body);
  const declared =
    metadata.properties.get("type") ?? metadata.properties.get("@type");
  const values = Array.isArray(declared) ? declared : [declared];
  const types = values
    .filter((value): value is string => typeof value === "string")
    .map(normalizeType);
  return {
    title,
    types,
    known:
      !metadata.warning &&
      !!types.length &&
      types.length === values.length &&
      types.every((type) => typeAncestors([type]).size > 0),
  };
}
export function expectedTypes(property: string): string[] {
  return schemaProperty(property)?.ranges ?? [];
}
export function compatibility(
  note: NoteReference,
  property: string,
): Compatibility {
  const expected = expectedTypes(property);
  if (!expected.length) return "unknown";
  const ancestry = typeAncestors(note.types);
  if (expected.some((type) => ancestry.has(type))) return "compatible";
  return note.known ? "mismatch" : "unknown";
}
export function noteTypeLabel(note: NoteReference): string {
  return note.types.length ? note.types.join(" · ") : "유형 미지정";
}
export function recommendNotes(
  notes: readonly NoteReference[],
  property: string,
  query: string,
) {
  const normalized = query
    .replace(/\\([\\[\]])/g, "$1")
    .normalize("NFKC")
    .toLocaleLowerCase();
  const rank = { compatible: 0, unknown: 1, mismatch: 2 };
  return notes
    .filter((note) =>
      note.title.normalize("NFKC").toLocaleLowerCase().includes(normalized),
    )
    .map((note) => ({ ...note, compatibility: compatibility(note, property) }))
    .sort((a, b) => rank[a.compatibility] - rank[b.compatibility]);
}
export function linkWarnings(
  value: string,
  property: string,
  notes: readonly NoteReference[],
) {
  const titles = new Set(parseWikiLinks(value).map((link) => link.title));
  return notes
    .filter(
      (note) =>
        titles.has(note.title) && compatibility(note, property) === "mismatch",
    )
    .map(
      (note) =>
        `${note.title} (${noteTypeLabel(note)}): ${property} 권장 유형 ${expectedTypes(property).join(" 또는 ")}. 연결은 그대로 저장할 수 있습니다.`,
    );
}
