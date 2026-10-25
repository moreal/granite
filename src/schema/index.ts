import catalog from "./catalog.json";
export interface SchemaType {
  id: string;
  label: string;
  description: string;
  parents: string[];
}
export interface SchemaProperty {
  id: string;
  label: string;
  description: string;
  domains: string[];
  ranges: string[];
}
export const schemaVersion = catalog.version;
const types = new Map<string, SchemaType>(
  catalog.types.map((type) => [type.id, type]),
);
/** Unknown/custom declarations are preserved; this is normalization, not validation. */
export function normalizeType(value: string): string {
  return value.replace(/^https?:\/\/schema\.org\//, "").replace(/\/$/, "");
}
export function typeAncestors(
  names: readonly string[],
  source: ReadonlyMap<string, SchemaType> = types,
): Set<string> {
  const result = new Set<string>();
  const visit = (name: string) => {
    name = normalizeType(name);
    if (result.has(name) || !source.has(name)) return;
    result.add(name);
    source.get(name)!.parents.forEach(visit);
  };
  names.forEach(visit);
  return result;
}
const matches = (id: string, query: string) =>
  id.toLowerCase().includes(query.toLowerCase());
export function searchTypes(query = "", limit = 20): SchemaType[] {
  return catalog.types
    .filter(
      (type) =>
        !["Class", "Property", "DataType"].includes(type.id) &&
        matches(type.id, query),
    )
    .sort(
      (a, b) =>
        Number(!a.id.toLowerCase().startsWith(query.toLowerCase())) -
          Number(!b.id.toLowerCase().startsWith(query.toLowerCase())) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, Math.min(100, limit)));
}
export function suggestProperties(
  declared: readonly string[],
  existingKeys: readonly string[] = [],
  query = "",
  limit = 20,
): SchemaProperty[] {
  const ancestors = typeAncestors(declared);
  if (!ancestors.size) ancestors.add("Thing");
  const existing = new Set(existingKeys);
  return catalog.properties
    .filter(
      (property) =>
        !existing.has(property.id) &&
        property.domains.some((domain) => ancestors.has(domain)) &&
        matches(property.id, query),
    )
    .sort(
      (a, b) =>
        Number(!a.id.toLowerCase().startsWith(query.toLowerCase())) -
          Number(!b.id.toLowerCase().startsWith(query.toLowerCase())) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, Math.min(100, limit)));
}
export {
  completionContext,
  planCompletion,
  planPropertyInsertion,
} from "./yaml";
export type { CompletionContext, TextEdit, InsertionResult } from "./yaml";
