# License and source notices

Granite's current source is offered under **GNU AGPL version 3 or any later
version**. Copyright (c) 2026 Granite contributors. The complete AGPL version 3
text is in [LICENSE](LICENSE). Earlier Granite revisions were offered under
the MIT License; their copyright and license notice is retained in
[LICENSES/MIT-legacy.txt](LICENSES/MIT-legacy.txt). This historical notice does
not change the license grant for the current Granite source.

## Hongdown

The optional **문서 정리** formatter includes `@hongdown/wasm` version **0.5.3**,
copyright Hong Minhee and other Hongdown contributors, under
**GPL-3.0-or-later**. Its complete GPL version 3 text is served at
[`licenses/GPL-3.0.txt`](public/licenses/GPL-3.0.txt). The exact upstream
release is the signed Git tag [`0.5.3`](https://github.com/dahlia/hongdown/releases/tag/0.5.3),
which resolves to commit [`884fd93f8c766c16a2861868fa3b8b296309f5aa`](https://github.com/dahlia/hongdown/tree/884fd93f8c766c16a2861868fa3b8b296309f5aa).
The matching upstream source archive is bundled at
[`source/hongdown-0.5.3-source.tar.gz`](public/source/hongdown-0.5.3-source.tar.gz).
The archive is the upstream commit's source, including `packages/wasm`, the
Rust implementation, `Cargo.lock`, and its build configuration. SHA-256:
`4db5b745ae6fcddbb8c613967b40b954249371f70e98e97a2a4720ed231b8525`.
To rebuild the WASM package, use that archive's `.github/workflows/main.yaml`
`build-wasm` job: install a Rust toolchain with the
`wasm32-unknown-unknown` target and `wasm-pack`, run
`wasm-pack build --target web --features wasm` at the archive root, copy
`pkg/*` into `packages/wasm/pkg/`, then run `pnpm install --no-frozen-lockfile`
and `pnpm run build` from `packages/wasm`. These are upstream's release build
steps; Granite consumes the published pinned package and does not rebuild
Hongdown during its own Vite build.

Other dependencies remain under their own licenses. `yarn.lock` identifies
their exact versions. The Pages build copies the installed packages' top-level
license and notice files into `licenses/packages.txt` (including build-only
dependencies, for conservative coverage). Packages may carry further notices
in their own source trees. No third-party copyright is claimed by Granite.

## Corresponding source for the public app

Each Pages deployment serves [`source/manifest.json`](public/source/) with a
SHA-256 inventory of the deployed app files and the allowlisted source inputs.
It also serves `source/granite-source.tar.gz`, made from the checked-out
source used for that build. The archive includes Granite's source, static
assets, license notices, package manifest, lockfile, and build script. With
Node.js 24 and the pinned Yarn version, run:

```sh
yarn install --immutable
VITE_BASE_PATH=/granite/ yarn build
```

To prepare the same source offer for a local build, run
`node scripts/publish-source.mjs` after `yarn build`. It archives only the
explicit source/build inputs and excludes private notes, environment files,
`node_modules`, and temporary test artifacts. The manifest's per-file hashes
identify the actual input bytes, including local uncommitted edits; its Git
revision alone is not a claim that a locally edited build matches that commit.

## Schema.org vocabulary

The vendored Schema.org 30.1 vocabulary and derived offline catalog are by the
Schema.org community, licensed under CC BY-SA 3.0 Unported. This data retains
its own license. Granite shortened descriptions and generated sorted local
records; exact upstream commit and hashes are in `src/schema/provenance.json`.
See [attribution](src/schema/ATTRIBUTION.md) and the complete
[license](public/licenses/CC-BY-SA-3.0.txt). Regenerate offline with
`node scripts/schema/generate.mjs`. The corresponding source archive includes
the original JSON-LD, generator, provenance, and derived catalog.

The public component explorer is built with `yarn build:storybook` after the
application build and is served at `/granite/storybook/`.
