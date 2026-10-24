# Granite implementation ledger

Plan: docs/superpowers/plans/2026-10-23-granite-mvp.md

## Decisions

- User explicitly waived clarification/review pauses and requested end-to-end agent execution.
- Empty initial repository has no base commit/worktree; use a local feature branch in place for an immediately reviewable checkout.
- Percent-encoded ordinary filenames; long names use a deterministic short filename plus plaintext title metadata. Cost: some filenames no longer directly spell the title.
- No server for MVP: URL title fetch is best effort under CORS; manual alias always available. Cost: many sites cannot supply titles automatically.
- Rename/delete and attachments deferred; prioritize lossless capture/extraction/linking.
- Existing plain Markdown without title metadata uses its decoded filename as title; body remains unchanged. Folder-specific recovery keys use handle identity rather than folder basename. Conflicts retain local drafts and require explicit recovery choices.
- MIT chosen as the initial open-source license; repository remains local and unpublished, so the user can change this before release.

## Preflight

| Tasks | Shared contract | Result |
| --- | --- | --- |
| 1 / 2 | Public UI, storage adapters, scripts | Task 1 reports names; Task 2 consumes after implementation review |
| 1 | Spec S01-S12 vs implementation scope | Browser review delegated to Task 2; all runtime behavior belongs to Task 1 |
| 2 | Spec S11 vs review kit | Playwright accepted instead of mandatory Storybook; actual disk coverage distinguished from permission dialog |

## Progress

- [x] Task 1 implementation and independent review
- [x] Task 2 acceptance and review kit
- [x] Final review, verification, runnable preview

### Milestones

- Task 1 implementer reported domain/storage/extraction tests: 17 initial failures, then 18 passing. Editor and application integration in progress.
- Acceptance matrix, review tour draft and dogfooding issue template prepared by independent QA planner.
- Focused storage/domain review dispatched before UI integration completes; final whole-app review remains pending.
- Task 1 baseline: 28 unit tests and production build passed (agent report). Source formatted. A large initial JS bundle warning remains informational.
- Task 2 first standard browser run: 19/22 tests passed; selected-text URL paste and two pending-title cancellation cases failed. Separate two-tab recovery test reproduced draft loss.
- Whole-app review identified the same cancellation/recovery issues, multiline Markdown link preview risk, and small/low-contrast essential text.
- Consolidated fix wave delegated to original implementer; QA owns regression tests and will rerun after fixes. Dedicated preview uses port 4173; unrelated existing port 5173 left untouched.

## Final verification

- Original implementer completed both focused fix rounds. Independent reviewer approved all findings including recovery candidate archival/ancestor retirement and readable status/excerpt contrast.
- Coordinator independently ran `npm test`: 4 files, 38 tests passing; `npm run typecheck`: exit 0; `npm run build`: exit 0, informational 796.28 kB initial JS chunk warning.
- Coordinator independently ran final `npm run test:e2e`: 26 passing in 21.8 seconds (19 browser journeys and 7 disk-backed adapter tests).
- Native folder permission dialogs, actual IME and OS clipboard retain explicit manual verification status in docs/verification.md.
- Reviewable app at http://127.0.0.1:4173. Final screenshots retained in docs/screenshots. Implementation kept on local branch codex/granite-mvp; no remote push or deployment.
