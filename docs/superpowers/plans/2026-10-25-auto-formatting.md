# Automatic Hongdown Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development; worker does not spawn further agents.

**Goal:** Default-enabled idle formatting without disrupting input or saving.
**Architecture:** Persist one setting, schedule host-owned cancellable formatting after eligible edits, reuse registered formatter and safe one-transaction apply. Manual preview remains independent.
**Tech Stack:** CodeMirror6/React/TypeScript/Hongdown WASM, Node24/Yarn4.18.1 pnpm.
**Spec:** ../specs/2026-10-25-auto-formatting.md

## Global Constraints

- Work on main; root commits/pushes after independent review.
- No note uploads; no original byte changes on opening or setting toggles.
- Existing conflict/recovery/CRLF/IME/frontmatter contracts remain.
- Default true, delay1500ms, undo/redo/format do not trigger formatting.

## Review Focus

- Old result after typing/selection/setting-off must never apply.
- Composition/menu/selection waits resume pending eligible edits without loops.
- Undo must not be immediately undone by autoformat.
- Failure must not block ordinary saves.
- Existing settings migrate without losing explicit preferences.

## Task 1: Settings and scheduler

Files: src/settings.ts, SettingsDialog/App/Editor or extracted formatting controller, unit and E2E/visual tests, acceptance/verification docs.
- [x] Add failing regression tests for setting defaults and lifecycle cases specified above.
- [x] Implement persisted setting and accessible UI, host-owned eligible edit/debounce/cancellation/apply/error lifecycle.
- [x] Verify focused lifecycle tests, real worker defaultenabled E2E, then full unit/type/build/E2E/visual.
- [x] Inspect light/dark desktop/narrow screen; independent code review and scoped fixes.

## Integration

- [ ] Commit/push main after review; verify exact-head Actions/Pages/Chromatic upload and public automatic-format smoke.
