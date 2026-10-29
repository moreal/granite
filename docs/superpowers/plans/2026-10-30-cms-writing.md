# CMS Writing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the reference CMS writing plane and contextual navigation into Granite without changing local data contracts.

**Architecture:** Keep the mounted CodeMirror and existing workspace/controllers. Add lightweight full-body outline navigation in the editor and change existing layout/tokens rather than adding another editor mode.

**Tech Stack:** Solid2, CodeMirror6, TypeScript, Node24, Yarn4.18.1.

**Spec:** docs/superpowers/specs/2026-10-30-cms-writing-design.md

## Global Constraints

Work on main; root alone reviews, commits and pushes. No blog writes. No new runtime third-party requests. Keep S01–S29 data/IME/undo/link/formatter contracts. Exact font source and OFL must ship.

## Review Focus

- Frontmatter/fences and Setext must not create false outline entries; unit test actual parser.
- Sidebar and property toggles preserve mounted editor/caret/undo; browser regression.
- Long Korean title and controls fit320/390px; browser geometry and screen review.
- Critical save/error remains undimmed during typing; browser effective opacity.
- Outline jump uses full document coordinates and preserves bytes; browser regression.

### Task1: CMS typography and outline model

Files: src/design-system/tokens.css, src/assets/fonts/, src/editor/outline.ts, tests/unit/outline.test.ts, src/editor/live-preview.ts.

- [x] Write parser test: depths1–3 ATX/Setext, metadata/fences excluded, stable from/to coordinates.
- [x] Run focused test red, then implement heading collection with full-body block scanning and documentContext.
- [x] Obtain verified upstream Noto Serif KR/OFL, document source and license, use self-hosted font-face.
- [x] Dim ordinary Markdown marks and style Setext; preserve fence and contextual link/image rules.
- [x] Run parser/editor tests green.

### Task2: Existing writing layout and editor navigation

Files: src/App.tsx, src/components/NoteHeader.tsx, src/editor/Editor.tsx, src/editor/Outline.tsx, src/styles.css, tests/e2e/cms-writing.spec.ts.

- [x] Add browser regression for default closed panels, reopen/search, font/width/scroller, outline jump and unchanged editor/document.
- [x] Observe missing feature failure.
- [x] Compact existing header/properties, move save status outside dimmed chrome, expose explicit navigation toggle, default close connections.
- [x] Add caret outline via existing EditorView; provide native keyboard buttons and container-responsive geometry.
- [x] Give editor independent scrolling and CMS content spacing; update fading rules to0.2 with critical state excluded.
- [x] Run focused browser regression green and inspect desktop/narrow light/dark.

### Task3: Conformance and integration handoff

Files: docs/design-system.md, docs/verification.md, .superpowers/cms-parity/implementation.md, relevant existing tests/stories.

- [x] Update acceptance assertions affected by approved S30 values without weakening data behavior.
- [x] Run full unit/type/build then relevant browser/component suites; record exact results and limitations.
- [x] Capture actual synthetic note desktop/narrow light/dark and review controls/editor/outline.
- [x] Send root checkpoint for independent review; address findings, no commit/push here.
