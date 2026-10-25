import {
  isAlias,
  isCollection,
  isMap,
  isScalar,
  parseDocument,
  visit,
} from "yaml";
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}
export interface CompletionContext {
  kind: "property" | "type";
  from: number;
  to: number;
  prefix: string;
  hasColon: boolean;
  types: string[];
  existingKeys: string[];
  source: string;
}
export interface InsertionResult {
  edit: TextEdit | null;
  error: string | null;
}
type Mode = "yaml" | "frontmatter";
export function yamlInterval(source: string, mode: Mode) {
  if (mode === "yaml") return { from: 0, to: source.length };
  const opening = /^---[ \t]*\r?\n/.exec(source);
  if (!opening) return null;
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(
    source.slice(opening[0].length),
  );
  if (!closing) return null;
  const end = opening[0].length + closing.index;
  return {
    from: opening[0].length,
    to:
      end > opening[0].length
        ? end - (source.slice(0, end).endsWith("\r\n") ? 2 : 1)
        : end,
  };
}
/** Completion repair must not shrink an oversized original YAML block into eligibility. */
export function yamlCompletionInterval(source: string, mode: Mode) {
  const range = yamlInterval(source, mode);
  return range && range.to - range.from <= 32768 ? range : null;
}
export function parseSafeYaml(yaml: string) {
  if (yaml.length > 32768) return null;
  try {
    const doc = parseDocument(yaml, {
      schema: "core",
      uniqueKeys: true,
      customTags: [],
      prettyErrors: false,
    });
    if (
      doc.errors.length ||
      doc.warnings.length ||
      (doc.contents && (!isMap(doc.contents) || doc.contents.flow))
    )
      return null;
    let count = 0;
    visit(doc, (_key, node, path) => {
      if (
        ++count > 2048 ||
        path.length > 32 ||
        isAlias(node) ||
        ((isScalar(node) || isCollection(node)) &&
          node.tag &&
          !/^tag:yaml\.org,2002:(str|int|float|bool|null|seq|map)$/.test(
            node.tag,
          ))
      )
        throw Error();
    });
    const data = doc.toJS({ mapAsMap: true, maxAliasCount: 0 }) as Map<
      unknown,
      unknown
    > | null;
    if (data && [...data.keys()].some((key) => typeof key !== "string"))
      return null;
    return { doc, data: data ?? new Map<string, unknown>() };
  } catch {
    return null;
  }
}
function declarations(data: Map<unknown, unknown>): string[] {
  const raw = data.get("type") ?? data.get("@type");
  return (Array.isArray(raw) ? raw : [raw]).filter(
    (value): value is string => typeof value === "string",
  );
}
export function planPropertyInsertion(
  source: string,
  key: string,
  value: string,
  mode: Mode = "yaml",
): InsertionResult {
  const range = yamlInterval(source, mode);
  if (!range) return { edit: null, error: "닫힌 속성 영역이 필요합니다." };
  const yaml = source.slice(range.from, range.to),
    parsed = parseSafeYaml(yaml);
  if (!parsed)
    return {
      edit: null,
      error: "올바른 최상위 YAML 속성을 먼저 입력해 주세요.",
    };
  if (!key.trim() || /[\r\n]/.test(key))
    return { edit: null, error: "속성 이름을 확인해 주세요." };
  if (parsed.data.has(key))
    return { edit: null, error: "이미 있는 속성입니다." };
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const entry = `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  // In an already validated document this unindented indicator is a genuine
  // document end, never block-scalar content. Keep it and all following comments
  // in place by adding the new mapping entry immediately before the indicator.
  const terminator = /^\.\.\.[ \t]*(?:#[^\r\n]*)?\r?$/m.exec(yaml);
  if (terminator) {
    const at = range.from + terminator.index;
    return { edit: { from: at, to: at, insert: entry + newline }, error: null };
  }

  const insert =
    (yaml && !yaml.endsWith("\n") ? newline : "") +
    entry +
    (mode === "frontmatter" &&
    range.from === range.to &&
    source.slice(range.to).startsWith("---")
      ? newline
      : "");
  return { edit: { from: range.to, to: range.to, insert }, error: null };
}
/** Only a verified unindented mapping key or plain type scalar is eligible. */
export function completionContext(
  source: string,
  cursor: number,
  mode: Mode = "yaml",
): CompletionContext | null {
  const range = yamlCompletionInterval(source, mode);
  if (!range || cursor < range.from || cursor > range.to) return null;
  const yaml = source.slice(range.from, range.to),
    position = cursor - range.from;
  const start = yaml.lastIndexOf("\n", position - 1) + 1;
  let end = yaml.indexOf("\n", position);
  if (end < 0) end = yaml.length;
  const line = yaml.slice(start, end).replace(/\r$/, "");
  const offset = position - start;
  const originalDocument = parseSafeYaml(yaml);
  let insideScalar = false;
  if (originalDocument)
    visit(originalDocument.doc, (_key, node) => {
      if (
        _key !== "key" &&
        isScalar(node) &&
        node.range &&
        node.range[0] < position &&
        position < node.range[2]
      )
        insideScalar = true;
    });
  const typeHeader = /^(type|"@type"|'@type'):[ \t]*/.exec(line);
  if (typeHeader && originalDocument) {
    const raw = line.slice(typeHeader[0].length);
    const scalar =
      /^(?:"([^"\\]*)"|'([^']*)'|([^\s#"'\[\]{},]*))([ \t]*(?:#.*)?)$/.exec(
        raw,
      );
    if (scalar) {
      const quoted = raw.startsWith('"') || raw.startsWith("'");
      const content = scalar[1] ?? scalar[2] ?? scalar[3];
      const root = originalDocument.doc.contents;
      const pair = isMap(root)
        ? root.items.find(
            (item) =>
              isScalar(item.key) &&
              item.key.range?.[0] === start &&
              (item.key.value === "type" || item.key.value === "@type"),
          )
        : undefined;
      if (
        !pair ||
        !isScalar(pair.value) ||
        (pair.value.value !== content &&
          !(content === "" && pair.value.value === null))
      )
        return null;
      const term = /^(https?:\/\/schema\.org\/)?([A-Za-z0-9_]*)$/.exec(content);
      if (term) {
        const localStart =
          typeHeader[0].length + Number(quoted) + (term[1]?.length ?? 0);
        const localEnd = localStart + term[2].length;
        if (offset >= localStart && offset <= localEnd)
          return {
            kind: "type",
            from: range.from + start + localStart,
            to: range.from + start + localEnd,
            prefix: line.slice(localStart, offset),
            hasColon: true,
            types: declarations(originalDocument.data),
            existingKeys: [...originalDocument.data.keys()] as string[],
            source,
          };
      }
    }
  }
  if (insideScalar) return null;
  if (
    !line ||
    /^[A-Za-z_][\w-]*$/.test(line) ||
    /^[A-Za-z_][\w-]*\s*:/.test(line) ||
    /^['"]?@type['"]?\s*:/.test(line)
  ) {
    const match = /^([A-Za-z_][\w-]*|)([ \t]*:.*)?$/.exec(line);
    if (!match || offset > match[1].length) return null;
    // Replacing only this candidate line must produce a valid map. Parser ranges
    // then prove the probe key belongs to the root (not a multiline scalar).
    const probe =
      yaml.slice(0, start) + "graniteCompletionProbe: null" + yaml.slice(end);
    const parsed = parseSafeYaml(probe);
    if (!parsed || !isMap(parsed.doc.contents)) return null;
    const pair = parsed.doc.contents.items.find(
      (item) =>
        isScalar(item.key) &&
        item.key.value === "graniteCompletionProbe" &&
        item.key.range?.[0] === start,
    );
    if (!pair) return null;
    const original = parseSafeYaml(yaml);
    if (match[2] && !original) return null;
    const data = original?.data ?? parsed.data;
    const existingKeys = [...data.keys()].filter(
      (key) => key !== "graniteCompletionProbe" && key !== match[1],
    ) as string[];
    return {
      kind: "property",
      from: range.from + start,
      to: range.from + start + match[1].length,
      prefix: line.slice(0, offset),
      hasColon: !!match[2],
      types: declarations(data),
      existingKeys,
      source,
    };
  }
  return null;
}
export function planCompletion(
  source: string,
  context: CompletionContext,
  name: string,
): TextEdit | null {
  if (
    source !== context.source ||
    !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name) ||
    (context.kind === "property" && context.existingKeys.includes(name))
  )
    return null;
  return {
    from: context.from,
    to: context.to,
    insert:
      name + (context.kind === "property" && !context.hasColon ? ": " : ""),
  };
}
