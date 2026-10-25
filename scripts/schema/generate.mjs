/** Maintainer-only, entirely offline generator. Run with Node 24. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const input = new URL("./schemaorg-current-https.jsonld", import.meta.url);
const bytes = readFileSync(input);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceHash =
  "0a4b8c4c910fc831ec8695196510973390906a5ee34dc6b862dfec4d21a12f74";
if (sha(bytes) !== sourceHash) throw Error("Pinned source SHA256 mismatch");
if (bytes.length > 10 * 1024 * 1024) throw Error("Source exceeds budget");
const source = JSON.parse(bytes);
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const local = (id) =>
  typeof id === "string"
    ? id.replace(/^(?:schema:|https?:\/\/schema\.org\/)/, "")
    : "";
const ids = (value) =>
  [
    ...new Set(
      array(value)
        .map((x) => local(x["@id"]))
        .filter(Boolean),
    ),
  ].sort();
const text = (value) =>
  typeof value === "string" ? value : (value?.["@value"] ?? "");
const clean = (value) =>
  text(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
const types = [],
  properties = [];
for (const node of source["@graph"]) {
  if (!/^(schema:|https?:\/\/schema\.org\/)/.test(node["@id"])) continue;
  const id = local(node["@id"]),
    kinds = array(node["@type"]);
  const base = {
    id,
    label: clean(node["rdfs:label"]) || id,
    description: clean(node["rdfs:comment"]),
  };
  if (kinds.includes("rdfs:Class"))
    types.push({ ...base, parents: ids(node["rdfs:subClassOf"]) });
  if (kinds.includes("rdf:Property"))
    properties.push({
      ...base,
      domains: ids(node["schema:domainIncludes"]),
      ranges: ids(node["schema:rangeIncludes"]),
    });
}
for (const list of [types, properties])
  list.sort((a, b) => a.id.localeCompare(b.id, "en"));
if (
  types.length < 800 ||
  types.length > 5000 ||
  properties.length < 1000 ||
  properties.length > 5000
)
  throw Error("Unexpected vocabulary shape");
const output = JSON.stringify({ version: "30.1", types, properties }) + "\n";
if (
  Buffer.byteLength(output) > 1024 * 1024 ||
  gzipSync(output).length > 180 * 1024
)
  throw Error("Catalog exceeds measured budget");
writeFileSync(
  new URL("../../src/schema/catalog.json", import.meta.url),
  output,
);
writeFileSync(
  new URL("../../src/schema/provenance.json", import.meta.url),
  JSON.stringify(
    {
      release: "30.1",
      published: "2026-09-16",
      commit: "e5133e06d01e9acb677dd42370b82d3feccf7aca",
      source:
        "https://raw.githubusercontent.com/schemaorg/schemaorg/e5133e06d01e9acb677dd42370b82d3feccf7aca/data/releases/30.1/schemaorg-current-https.jsonld",
      sourceSha256: sourceHash,
      catalogSha256: sha(output),
      generatorVersion: 1,
      types: types.length,
      properties: properties.length,
      bytes: Buffer.byteLength(output),
      gzipBytes: gzipSync(output).length,
      license: "CC-BY-SA-3.0",
      policy:
        "Current schema namespace classes and properties; all direct parents/domains/ranges; descriptions shortened to 240 plain-text characters. Enumeration instances excluded. Datatypes retained; reflection types excluded only from picker.",
    },
    null,
    2,
  ) + "\n",
);
