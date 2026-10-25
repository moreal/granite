import { yamlCompletionInterval } from "./yaml";
import {
  completionContext,
  planCompletion,
  searchTypes,
  normalizeType,
  suggestProperties,
  type CompletionContext,
  type TextEdit,
} from "./index";
import {
  yamlNoteContext,
  yamlScalarContext,
  planYamlNote,
  type YamlNoteContext,
  type YamlScalarContext,
} from "./yaml-notes";
import {
  expectedTypes,
  noteTypeLabel,
  recommendNotes,
  type NoteReference,
} from "./references";
export type PropertyCompletionScope =
  | { kind: "schema"; context: CompletionContext }
  | { kind: "type"; context: YamlScalarContext }
  | { kind: "note"; context: YamlNoteContext };
export interface PropertyOption {
  id: string;
  detail: string;
  description: string;
}
export function propertyCompletionScope(
  source: string,
  cursor: number,
  mode: "yaml" | "frontmatter" = "yaml",
): PropertyCompletionScope | null {
  if (!yamlCompletionInterval(source, mode)) return null;
  const note = yamlNoteContext(source, cursor, mode);
  if (note) return { kind: "note", context: note };
  const scalar = yamlScalarContext(source, cursor, mode);
  if (
    scalar &&
    ["type", "@type"].includes(scalar.property) &&
    /^(https?:\/\/schema\.org\/)?[A-Za-z0-9_]*$/.test(scalar.value)
  ) {
    return { kind: "type", context: scalar };
  }
  const schema = completionContext(source, cursor, mode);
  return schema ? { kind: "schema", context: schema } : null;
}
export function propertyCompletionOptions(
  scope: PropertyCompletionScope,
  notes: readonly NoteReference[],
): PropertyOption[] {
  if (scope.kind === "note")
    return recommendNotes(
      notes,
      scope.context.property,
      scope.context.note.query,
    ).map((note) => ({
      id: note.title,
      detail: `${noteTypeLabel(note)} · ${note.compatibility === "compatible" ? "권장 유형" : note.compatibility === "mismatch" ? "권장 유형과 다름" : "유형 확인 필요"}`,
      description: expectedTypes(scope.context.property).length
        ? `권장: ${expectedTypes(scope.context.property).join(" 또는 ")}`
        : "기존 노트",
    }));
  if (scope.kind === "type")
    return searchTypes(normalizeType(scope.context.prefix)).map((type) => ({
      id: type.id,
      detail: type.label,
      description: type.description,
    }));
  const ctx = scope.context;
  return (
    ctx.kind === "type"
      ? searchTypes(ctx.prefix)
      : suggestProperties(ctx.types, ctx.existingKeys, ctx.prefix)
  ).map((option) => ({
    id: option.id,
    detail: "ranges" in option ? option.ranges.join(" · ") : option.label,
    description: option.description,
  }));
}
export function planPropertyCompletion(
  source: string,
  scope: PropertyCompletionScope,
  id: string,
): TextEdit | null {
  if (scope.kind === "type") {
    const ctx = scope.context;
    if (source !== ctx.source || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id))
      return null;
    const value = (/^https?:\/\/schema\.org\//.exec(ctx.value)?.[0] ?? "") + id;
    return {
      from: ctx.from,
      to: ctx.to,
      insert: ctx.quote ? ctx.quote + value + ctx.quote : value,
    };
  }
  return scope.kind === "note"
    ? planYamlNote(source, scope.context, id)
    : planCompletion(source, scope.context, id);
}
