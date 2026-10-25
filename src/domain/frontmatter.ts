import {
  isAlias,
  isCollection,
  isMap,
  isScalar,
  parseDocument,
  visit,
} from "yaml";

export const schemaTypes = [
  "Thing",
  "Book",
  "Person",
  "Article",
  "ScholarlyArticle",
  "CreativeWork",
] as const;
export interface Frontmatter {
  present: boolean;
  closed: boolean;
  yaml: string;
  /** Exact editable source interval, excluding the separator before the closing fence. */
  from: number;
  to: number;
  /** End of the complete metadata block, including its closing line separator. */
  bodyStart: number;
  markdown: string;
  types: string[];
  properties: Map<string, unknown>;
  warning: string | null;
}

/** Shared delimiter classification for source projection and Markdown grammar. */
const frontmatterFenceSource = "---[ \t]*";
export function isFrontmatterFenceLine(line: string): boolean {
  return new RegExp(`^${frontmatterFenceSource}\\r?$`).test(line);
}

function schemaType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/^https?:\/\/schema\.org\//, "")
    .replace(/\/$/, "");
  return /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name) ? name : null;
}

/** Metadata is a projection of text: parsing never rewrites the note. */
export function readFrontmatter(body: string): Frontmatter {
  const opening = new RegExp(`^${frontmatterFenceSource}\\r?\\n`).exec(body);
  const result: Frontmatter = {
    present: !!opening,
    closed: false,
    yaml: "",
    from: 0,
    to: 0,
    bodyStart: 0,
    markdown: body,
    types: ["Thing"],
    properties: new Map(),
    warning: null,
  };
  if (!opening) return result;
  result.from = opening[0].length;
  const closing = new RegExp(
    `^${frontmatterFenceSource}(?:\\r?\\n|$)`,
    "m",
  ).exec(body.slice(result.from));
  result.closed = !!closing;
  const end = closing ? result.from + closing.index : body.length;
  result.to =
    closing && end > result.from
      ? end - (body.slice(0, end).endsWith("\r\n") ? 2 : 1)
      : end;
  result.yaml = body.slice(result.from, result.to);
  result.bodyStart = closing ? end + closing[0].length : body.length;
  result.markdown = closing ? body.slice(end + closing[0].length) : "";
  if (!closing) {
    result.warning = "속성의 닫는 ---가 없습니다. 원문을 그대로 보관합니다.";
    return result;
  }
  if (result.yaml.length > 32_768) {
    result.warning =
      "속성이 너무 큽니다 (32,768자 제한). 원문을 그대로 보관합니다.";
    return result;
  }
  try {
    const doc = parseDocument(result.yaml, {
      schema: "core",
      uniqueKeys: true,
      customTags: [],
      prettyErrors: false,
    });
    if (doc.errors.length || doc.warnings.length)
      throw Error("YAML 문법을 확인해 주세요.");
    let count = 0;
    visit(doc, (_key, node, path) => {
      if (++count > 2048 || path.length > 32)
        throw Error("속성이 너무 복잡합니다.");
      if (isAlias(node)) throw Error("YAML 별칭은 지원하지 않습니다.");
      if (
        (isScalar(node) || isCollection(node)) &&
        node.tag &&
        !/^tag:yaml\.org,2002:(str|int|float|bool|null|seq|map)$/.test(node.tag)
      ) {
        throw Error("사용자 정의 YAML 태그는 지원하지 않습니다.");
      }
    });
    if (doc.contents !== null && !isMap(doc.contents))
      throw Error("속성은 이름: 값 형태여야 합니다.");
    const data: unknown = doc.toJS({ mapAsMap: true, maxAliasCount: 0 });
    if (data instanceof Map) {
      for (const [key, value] of data) {
        if (typeof key !== "string")
          throw Error("속성 이름은 문자열이어야 합니다.");
        result.properties.set(key, value);
      }
    }
    const declared =
      result.properties.get("type") ?? result.properties.get("@type");
    if (declared !== undefined) {
      const values = Array.isArray(declared) ? declared : [declared];
      const types = values.map(schemaType);
      if (!types.length || types.some((type) => !type)) {
        result.warning =
          "type에는 Book 같은 이름이나 schema.org URL을 입력해 주세요. 원문은 보관됩니다.";
      } else result.types = [...new Set(types as string[])];
    }
  } catch (error) {
    result.properties.clear();
    result.warning = `${error instanceof Error ? error.message : "속성을 읽지 못했습니다."} 원문은 그대로 보관됩니다.`;
  }
  return result;
}

/** Change only the user's raw YAML; preserve fences, comments and prose verbatim. */
export function replaceFrontmatter(body: string, yaml: string): string {
  const metadata = readFrontmatter(body);
  if (!metadata.present) return `---\n${yaml}\n---\n${body}`;
  // An empty original block has no separator newline to preserve.
  const separator =
    metadata.closed &&
    metadata.from === metadata.to &&
    body.slice(metadata.to).startsWith("---") &&
    yaml
      ? "\n"
      : "";
  return (
    body.slice(0, metadata.from) + yaml + separator + body.slice(metadata.to)
  );
}

/** Plain display text only; mappings remain safe Maps, including __proto__ keys. */
export function propertyText(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.map(propertyText).join(", ");
  if (value instanceof Map)
    return [...value]
      .map(([key, item]) => `${String(key)}: ${propertyText(item)}`)
      .join(" · ");
  return String(value);
}
