# Solid 2, schema completion and component review plan

> **For agentic workers:** Use superpowers:subagent-driven-development. All workers/reviewers must be gpt-6.1-sol as explicitly requested. No nested agents.

**Goal:** Preserve Granite's writing/storage behavior on actual Solid2, improve property editing and enable small component visual verification.
**Architecture:** Framework migration first, pure offline schema catalog independently, then schema UI/CodeMirror completions and Storybook operating on production components.
**Tech Stack:** Node24/Yarn4.18.1 pnpm, pinned Solid2 RC, CodeMirror6, Storybook Solid renderer, Vitest/Playwright.
**Spec:** ../specs/2026-10-25-solid-schema-storybook.md

## Global Constraints

- main directly; root alone commit/push after reviews.
- All task models gpt-6.1-sol. Worker must not spawn agents.
- No implicit note uploads or data migration; preserve rawMarkdown/history/async cancellation/storage/recovery.
- AGPL licensing and exactsource publishing must include any new required build data/config.

## Review Focus

- Solid effects must not remount editor or overwrite in-flight drafts.
- Solid context ownership and cleanup must retain modal focus, date/settings subscriptions and worker cancellation.
- Completion must only patch intended key/partialtype without reserializing YAML.
- Schema inheritance/unknown types must guide rather than reject existing user metadata.
- Storybook isolated snapshots must render actual production components and catch clipping/focus overlaps.

## Task 1 Framework migration and decomposition

Files: package/yarn/vite/tsconfig, src/main/App/editor/components and unit rendering helper/tests.
- [x] Use verified exact Solid2 toolchain, no React app runtime/shim. Keep CodeMirror and domain/storage APIs.
- [x] Split UI boundaries from large controllers: sidebar/today/header/toolbar/save/recovery; editor visual menus/dialogs from controller; settings/graph units.
- [x] Migrate all UI/unit tests using native Solid render/flush/dispose helper. Preserve behavioral assertions, no skipping suites.
- [x] Clarify today's label and update at midnight/focus/visibility, click currentdate; tests fakeclock.
- [x] Unit/type/build/full E2E/visual, component inspection, independent review before next UI changes.

## Task 2 Offline schema domain

Files: src/schema/*, scripts/schema/*, generated catalog and provenance, pure unit tests. No UI/package/shared frontmatter edits until Task1 releases.
- [x] Pin official schema.org JSONLD and license, generate types/properties/inheritance/ranges offline.
- [x] Query types and applicable properties, inherited+multi-type unions, dedup/unknown policy.
- [x] Pure YAML key/type completion and insertion patch planning with exactsource/CRLF/comment protection; integrate scanner via agreed API.
- [x] Unit regressions and independent scoped review.

## Task 3 Schema editing UI and YAML integration

Files: production small property components, schema CodeMirror plugin, spec/docs/tests.
- [x] Property/type searchable controls with descriptions/ranges, keyboard/IME/disabled/unknown states.
- [x] Completion in YAML field and rawfrontmatter; preserve existing document, graph, save/history.
- [x] Narrow focusedcontrols geometry/screenshot regressions and full suites.

## Task 4 Storybook and visual CI

Files: .storybook, stories using productioncomponents, package scripts, CI, sourcepublisher allowlist.
- [x] Real Solid2 renderer storybook and isolated states at small width/light/dark/focus/error/longtext.
- [x] Component screenshot runner and cropped evidence; Storybook artifacts and traces; preserve existing app Chromatic.
- [x] Inspect each component screenshot, fix clipping/overlap, review build/publish workflow/security/source archive.

## Integration

- [ ] Final independent review; all tests/builds; maincommit/push; verify exacthead Actions/Pages/Chromatic and publishedapp smoke.
