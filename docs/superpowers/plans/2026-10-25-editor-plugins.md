# Editor Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Check off steps as completed.

**Goal:** Correct metadata/quotes, make editor capabilities extensible, adopt real Hongdown safely.
**Architecture:** Keep full CodeMirror document and safe host lifecycle. Typed registrations compose live extensions, completions and formatters; Hongdown runs locally in a worker.
**Tech Stack:** React/CodeMirror 6, TypeScript, Yarn 4.18.1 pnpm linker, Hongdown WASM.
**Spec:** docs/superpowers/specs/2026-10-25-editor-plugins-design.md

## Global Constraints

- Work on main; root alone commits/pushes after independent review.
- Node 24, Yarn 4.18.1, nodeLinker pnpm; no npm. Preserve unrelated dependency resolutions.
- Canonical raw Markdown, no implicit upload, storage conflict/recovery behavior unchanged.
- User-authorized AGPL-3.0-or-later; preserve dependency copyright notices.
- No additional subagents by workers.

## Review Focus

- Hidden metadata boundary deletion must reveal before destructive change.
- Async formatter result after edits/note switch must not overwrite anything.
- Hongdown rewrites references and syntax: real output must retain link/media meaning.
- Composition and selection must survive extension updates and source toggles.
- Public Pages subpath must load worker/WASM and provide exact source.

## Task 1: Plugin host and live Markdown

Files: src/editor/Editor.tsx, new src/editor/plugins/*, src/editor/document-context.ts, src/editor/rich-preview.ts, src/domain/frontmatter.ts, src/styles.css; focused unit/E2E tests and docs.
Interfaces: export EditorPlugin typed registry supporting liveExtensions(context), completion providers, optional formatter registrations; registry supplied via optional Editor plugins prop with default builtins. Host receives narrow readImage/open capabilities only. Export canonical document context frontmatter/bodyStart helpers.
- [x] Reproduce missing quote and raw metadata, add failing tests.
- [x] Extract current decorations and date/note completions into real built-ins; validate unique IDs; prove extra formatting/@ plugin via tests.
- [x] Add frontmatter range and protected reveal-before-edit; explicit synchronization annotation; source/undo behavior.
- [x] Add quote decorations and exclude metadata from body/rich parsing.
- [x] Verify focused tests, typecheck, actual desktop+narrow rendered screenshots; report .superpowers/hongdown/task-1-report.md.

## Task 2: Hongdown formatter and review/apply UI

Files: new src/editor/formatting/* and plugin adapter; integrate registry/Editor handle, App.tsx/settings styles as necessary; package.json/yarn.lock; tests and documentation.
Interfaces: consumes Task1 EditorPlugin registry; propose async formatter text snapshot with cancellation and host-owned apply validation, one history transaction.
- [x] Pin and inspect actual @hongdown/wasm release, test real output/API and worker assets.
- [x] Add invariants and stale-result regression tests before integration.
- [x] Implement explicit document formatting command and accessible preview/apply/cancel; safe frontmatter and meaning guards; reference-link editing/navigation.
- [x] Verify real formatter E2E, focus/undo/source/security and full unit/type/build/E2E/visual suites; report task-2-report.md.

## Task 3: License and distribution

Files: LICENSE, README licensing section, third-party notices, public license/source artifacts and build script/workflow if needed.
- [x] Replace project license with canonical AGPL-3.0 text and document or-later grant; preserve existing copyright provenance.
- [x] Provide Hongdown GPL text/notice and corresponding upstream source release; serve exact Granite source/build recipe for Pages users.
- [x] Verify generated distribution license/source paths and security workflow configuration.

## Integration

- [x] Independent review, fixes and scoped re-review.
- [ ] Check diff and clean generated screenshot artifacts safely; commit/push main.
- [ ] Confirm exact-head Actions/Pages/Chromatic upload, distinguish approval gate.
