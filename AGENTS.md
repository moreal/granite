# Granite development

Granite is a local-first, flat-namespace Markdown knowledge tool. The product owner prefers discussing natural-language specifications, design details, and writing experience; agents own implementation and conformance checks.

## Working agreement

- Start with `docs/superpowers/specs/2026-10-23-granite-mvp-design.md`, `docs/superpowers/specs/2026-10-24-writing-focus.md`, `docs/superpowers/specs/2026-10-24-rich-note-content.md`, and `docs/verification.md`.
- Classify dogfooding feedback as a spec violation, missing specification, or change of direction. For missing requirements or direction changes, update the specification and acceptance criteria alongside implementation. Preserve the original user intent.
- The orchestrator owns scope, decisions, delegation, and integration. Delegate implementation and independent review when agent tools are available. A delegated worker should not spawn additional workers or reviewers unless its assignment explicitly asks for that.
- Keep behavioral expectations understandable without reading code. Link meaningful tests and review findings to the S01–S14 acceptance criteria; extend the spec with new IDs when needed.
- Never claim a browser picker or permission flow was tested when only a handle stub, demo repository, or OPFS was tested. Document evidence and limitations separately.

## Data and editor invariants

- Notes stay in the selected local folder. Demo storage is separate. Do not introduce note upload, remote sync, or third-party services implicitly.
- `[[title]]` is a persisted link. `@` is only an input menu; date commands insert ordinary links resolved at execution time.
- The extraction feature was retired on 2026-10-24. Preserve existing notes, links, and recovery drafts; do not migrate or delete data when removing UI features.
- Never overwrite changed external files automatically. Do not discard another tab's independent draft.
- User Markdown is text, not executable HTML. Unsupported preview syntax must remain editable without crashing.

## Development and verification

Use Node.js 24 and the exact Yarn version in `package.json` (`corepack enable` when Corepack is available). Yarn uses `nodeLinker: pnpm`; use Yarn commands and immutable installs. See `docs/yarn-migration.md` for a direct official-release bootstrap without npm.

```sh
yarn install --immutable
yarn dev --port 4173 --strictPort
yarn test
yarn typecheck
yarn build
yarn playwright install chromium
yarn test:e2e
```

Use focused regressions for behavior changes and failures, then run the relevant suite before claiming completion. The Playwright report is available through `yarn test:report`; the interactive runner is `yarn test:e2e:ui`.

Keep production code, unit tests, and browser tests readable and formatted. Avoid overwriting unrelated local development servers. Review the real rendered screen for UI changes, including a narrow viewport.

Current MVP exclusions and browser limitations are documented in the spec and README. Do not silently turn those into features or weaken data safety guarantees to make a test pass.
