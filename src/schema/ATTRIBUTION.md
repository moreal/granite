# Schema.org vocabulary attribution

The vendored `scripts/schema/schemaorg-current-https.jsonld` and derived
`src/schema/catalog.json` contain Schema.org 30.1 vocabulary by the Schema.org
community, licensed under Creative Commons Attribution-ShareAlike 3.0 Unported.

Source and exact immutable commit, input/output hashes and measured sizes are in
`provenance.json`. Official terms: https://schema.org/docs/terms.html . License:
https://creativecommons.org/licenses/by-sa/3.0/ ; full legal text is included at
`scripts/schema/LICENSE-CC-BY-SA-3.0.txt`.

Granite transformed the JSON-LD into sorted local type/property records, preserved
all direct inheritance/domain/range relations, excluded non-schema namespace
nodes and enumeration instances, and shortened descriptions to 240 plain-text
characters. This derived vocabulary asset remains CC BY-SA 3.0; application code
has its separately stated project license. No endorsement by Schema.org is implied.

Generation is deliberately offline: run `node scripts/schema/generate.mjs` with
Node 24. It verifies the pinned source hash, shape and size budgets before writing
output. Installation, build and runtime do not download Schema.org vocabulary or
resolve remote JSON-LD contexts. Catalog measures 535,562 bytes / 132,133 gzip;
its measured budget is 1 MiB / 180 KiB gzip (the initial research's proposed
500 KiB / 100 KiB budget could not retain all concise descriptions).
