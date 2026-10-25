import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import {
  propertyNoteContext,
  completePropertyNote,
  type PropertyNoteContext,
} from "./note-completion";
import { parseSafeYaml, yamlCompletionInterval, type TextEdit } from "./yaml";
export interface YamlScalarContext {
  source: string;
  property: string;
  from: number;
  to: number;
  value: string;
  prefix: string;
  quote: string;
}
export interface YamlNoteContext extends YamlScalarContext {
  note: PropertyNoteContext;
}
/** Decode YAML separately from wiki escaping; character offsets never cross encodings. */
function decode(raw: string, quote: string): string | null {
  if (!quote) return raw;
  try {
    const doc = parseDocument(raw, { prettyErrors: false });
    return !doc.errors.length && typeof doc.contents?.toJSON() === "string"
      ? (doc.contents.toJSON() as string)
      : null;
  } catch {
    return null;
  }
}
/** A repaired scalar is only a probe. AST ownership proves top-level scalar/list scope. */
export function yamlScalarContext(
  source: string,
  cursor: number,
  mode: "yaml" | "frontmatter" = "yaml",
): YamlScalarContext | null {
  const range = yamlCompletionInterval(source, mode);
  if (
    !range ||
    cursor < range.from ||
    cursor > range.to ||
    range.to - range.from > 32768
  )
    return null;
  const yaml = source.slice(range.from, range.to),
    pos = cursor - range.from;
  const start = yaml.lastIndexOf("\n", pos - 1) + 1;
  let end = yaml.indexOf("\n", pos);
  if (end < 0) end = yaml.length;
  const line = yaml.slice(start, end).replace(/\r$/, "");
  const header = /^(?:[^\s#][^\r\n]*?:[ \t]+|[ \t]*-[ \t]+)/.exec(line);
  if (!header) return null;
  const tokenStart = start + header[0].length;
  let raw = line.slice(header[0].length),
    tokenEnd = raw.length;
  const quote = raw[0] === '"' || raw[0] === "'" ? raw[0] : "";
  if (quote) {
    let closed = false;
    for (let i = 1; i < raw.length; i++) {
      if (quote === '"' && raw[i] === "\\") {
        i++;
        continue;
      }
      if (raw[i] === quote) {
        if (quote === "'" && raw[i + 1] === "'") {
          i++;
          continue;
        }
        tokenEnd = i + 1;
        closed = true;
        break;
      }
    }
    if (closed && !/^[ \t]*(?:#.*)?$/.test(raw.slice(tokenEnd))) return null;
  } else {
    const comment = /(?:^|[ \t])#/.exec(raw);
    if (comment) tokenEnd = comment.index;
    while (tokenEnd && /[ \t]/.test(raw[tokenEnd - 1])) tokenEnd--;
  }
  raw = raw.slice(0, tokenEnd);
  const local = pos - tokenStart;
  if (
    local < Number(!!quote) ||
    local > raw.length ||
    (quote && raw.endsWith(quote) && local > raw.length - 1)
  )
    return null;
  const active = !quote ? propertyNoteContext(raw, local, local) : null;
  // Plain [[ is an intentional typing exception. Other flow syntax remains
  // ambiguous; quoted wiki titles can contain these characters without limits.
  if (!quote && raw.startsWith("[[")) {
    if (active?.from !== 0) return null;
    const contentEnd = raw.endsWith("]]") ? raw.length - 2 : raw.length;
    for (let index = 2; index < contentEnd; index++) {
      if (raw[index] === "\\") index++;
      else if ("[],{}".includes(raw[index])) return null;
    }
  }
  const marker = "graniteValueProbe";
  // Mask only the active trigger in plain text, keeping every structural prefix
  // and suffix. A repaired collection/map must never masquerade as a scalar.
  const probeRaw =
    quote || !raw
      ? JSON.stringify(marker)
      : active
        ? raw.slice(0, active.from) +
          marker +
          raw.slice(active.to + (active.closing ? 2 : 0))
        : raw;
  const expectedValue = quote || !raw ? marker : probeRaw;
  const probe =
    yaml.slice(0, tokenStart) + probeRaw + yaml.slice(tokenStart + tokenEnd);
  const parsed = parseSafeYaml(probe);
  if (!parsed || !isMap(parsed.doc.contents)) return null;
  let property: string | undefined;
  for (const pair of parsed.doc.contents.items) {
    const values =
      isSeq(pair.value) && !pair.value.flow ? pair.value.items : [pair.value];
    if (
      isScalar(pair.key) &&
      typeof pair.key.value === "string" &&
      values.some(
        (value) =>
          isScalar(value) &&
          !value.tag &&
          !value.anchor &&
          value.value === expectedValue &&
          value.range?.[0] === tokenStart &&
          value.range[1] === tokenStart + probeRaw.length,
      )
    )
      property = pair.key.value;
  }
  if (!property) return null;
  let value = decode(raw, quote);
  if (value === null && quote && !raw.endsWith(quote))
    value = decode(raw + quote, quote);
  const prefix = quote
    ? decode(raw.slice(0, local) + quote, quote)
    : raw.slice(0, local);
  if (value === null || prefix === null || !value.startsWith(prefix))
    return null;
  return {
    source,
    property,
    from: range.from + tokenStart,
    to: range.from + tokenStart + tokenEnd,
    value,
    prefix,
    quote,
  };
}
export function yamlNoteContext(
  source: string,
  cursor: number,
  mode: "yaml" | "frontmatter" = "yaml",
): YamlNoteContext | null {
  const scalar = yamlScalarContext(source, cursor, mode);
  if (!scalar || scalar.property === "type" || scalar.property === "@type")
    return null;
  const note = propertyNoteContext(
    scalar.value,
    scalar.prefix.length,
    scalar.prefix.length,
  );
  return note ? { ...scalar, note } : null;
}
export function planYamlNote(
  source: string,
  context: YamlNoteContext,
  title: string,
): TextEdit | null {
  if (source !== context.source) return null;
  const value = completePropertyNote(context.value, context.note, title).value;
  const insert =
    context.quote === "'"
      ? "'" + value.replace(/'/g, "''") + "'"
      : JSON.stringify(value);
  return { from: context.from, to: context.to, insert };
}
