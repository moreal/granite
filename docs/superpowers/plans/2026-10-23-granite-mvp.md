# Granite MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. User explicitly requests agents, no questions, and completion through implementation and review.

**Goal:** Deliver a functioning, reviewable local Markdown knowledge app.
**Architecture:** React app, CodeMirror editor, domain helpers and storage adapters. Same workflows run on local files and a clearly separated demo repository.
**Tech Stack:** TypeScript, React, Vite, CodeMirror 6, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-23-granite-mvp-design.md

## Global Constraints

- Desktop Chrome, flat local Markdown, no note upload or server dependency.
- `[[title]]` is the stored note link; `@` is only an insertion menu.
- Extraction saves target before replacing source; failures preserve source.
- Korean UI; demo storage never touches local folders.
- User authorized proceeding without review gates or clarification; retain reversible defaults in spec.
- Work in current empty repository; no remote push/deploy. Commits, if created, use `Assisted-by: Codex:gpt-6-astra` only when authored by the root agent; other agents must identify their actual model.

## Review Focus

1. Unicode/long/special-character titles and collision safety (Task 1 unit tests).
2. Save failures, delayed writes and navigation/extraction races (Task 1 integration tests, Task 2 E2E).
3. Literal links in code, malicious Markdown, and email/IME trigger handling (Task 1 editor tests, Task 2 E2E).
4. External modifications and recovery after reload (Task 1 storage tests, Task 2 E2E).
5. Real directory adapter not replaced by demo-only verification (Task 2 filesystem smoke test and manual checklist).

### Task 1: Complete application with storage and editor workflows

**Files:** package.json, lockfile, index.html, tsconfig*.json, vite.config.ts, src/main.tsx, src/App.tsx, src/styles.css, src/domain/*, src/storage/*, src/editor/*, src/components/*, tests/unit/*.
**Interfaces:** expose typed Note with title/body/filename, a storage interface for list/read/write/create plus conflict baseline, and domain helpers for filename mapping, local date, escaped wikilinks, backlinks and safe extraction. Exact implementation names may be chosen by owner and reported for Task 2.

- [x] Write failing tests for title mapping round trips/collisions, link parsing excluding code, dates, extraction success/target-write-failure/source-write-failure, storage conflicts and draft recovery.
- [x] Run targeted Vitest and record expected failures.
- [x] Implement domain/storage and application shell with real directory picker and demo workspace.
- [x] Implement live preview editor, `[[`/`@` menus, URL paste choices with stale-result guards, keyboard and composition handling.
- [x] Implement daily/dump, search/create, safe selection extraction, backlinks, rediscovery, focus mode and save/recovery UI.
- [x] Run `npm test` and `npm run build`, resolve failures. Add focused editor tests where necessary.
- [x] Self-review against S01-S12; report exact commands/results and remaining browser QA needs. Do not commit; controller integrates after review.

### Task 2: Browser acceptance, review kit and release readiness

**Files:** playwright.config.ts, tests/e2e/*, tests/helpers/*, README.md, docs/review-guide.md, docs/verification.md, .github/ISSUE_TEMPLATE/*, .gitignore; minimal implementation fixes only after reporting findings to controller.
**Interfaces:** use Task 1's public UI and real storage adapter. Import production domain/storage only for low-level filesystem smoke tests; E2E assertions through UI and persisted output, not implementation replays.

- [x] Add Playwright journeys: demo start/reload, create/edit/search, extraction and backlinks, `[[`/`@` date and note insertion, URL paste alias/escape, source/live preview, discovery/focus, keyboard and narrow viewport.
- [x] Add real filesystem adapter smoke test or clearly documented faithful handle-boundary integration test, covering encoded files and writes, conflict detection and failures.
- [x] Run browser suite with screenshots/traces/HTML report; inspect rendered desktop and narrow layouts.
- [x] Write Korean README and review guide with exact start/test commands, spec links, review tour, folder permission steps, known CORS limitation and data safety boundaries.
- [x] Add dogfooding issue template tied to spec IDs. Keep issue creation local, no external messages.
- [x] Run full unit suite, typecheck/build and E2E. Record actual counts and limitations, then independent whole-app review and fixes.

## Execution record

Progress is tracked in docs/implementation-progress.md. All implementation delegated. Root coordinates spec, decisions, review, verification and local preview. No user approval pauses per explicit instruction.
