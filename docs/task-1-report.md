# Task 1 implementation report

Status: application implementation complete; independent browser and whole-app review in progress under controller. No commits or server process were created by this worker.

## Delivered

- React 19 / TypeScript / Vite app with a Korean interface, restrained paper-and-sage visual hierarchy, local system font fallbacks, responsive layout, keyboard focus states and reduced-motion handling.
- Start screen opens a real directory with File System Access API. Only top-level `.md` files are listed. Separate localStorage demo includes four connected sample notes; demo records never enter the directory adapter.
- CodeMirror 6 Markdown editing with active-line source and inactive-line preview for headings, strong/emphasis, code, Markdown links and wikilinks. Full source toggle, real editable selection, history, wrapped lines, safe text rendering (no user HTML execution).
- Search through title/body, recent list, new notes, today/dump shortcuts, selection extraction, backlinks with context, rediscovery, focus mode and collapsible connection panel. Narrow windows put connections below the note so the feature remains reachable.
- `[[` completion and `@` date/note completion with CodeMirror keyboard navigation, mouse selection, Escape and composition-aware triggers. Dates resolve to local `YYYY-MM-DD` at command execution. Email `@` and code examples are excluded.
- HTTP(S) paste offers raw URL, selected-text/manual alias, and direct CORS title fetching. Fetch loading/failure are visible; revision guards reject results after any intervening edit. There is no proxy, authentication or content upload.
- Serialized save coordinator preserves newer edits during slow writes, differentiates unsaved/saving/saved/error/conflict, flushes on navigation and keeps recoverable repository-scoped drafts. Conflict actions offer download and explicit discard confirmation before reload.
- Two-write extraction creates the destination before replacing the source; source remains intact if destination creation fails. A failed second write reports the created copy and keeps source editing open. Editing and repeat execution are locked during extraction.

## Public interfaces for QA

- `src/domain/notes.ts`: `Note {title, body, filename, baseline, updated, metadata}`, `filenameFor`, `assertAvailable`, `encodeNote`, `decodeNote`, `serializeNote`.
- `src/domain/links.ts`: `wikiLink`, `parseWikiLinks`, `codeRanges`, `localDate`, `backlinks`, `menuTrigger`, `markdownLink`.
- `src/domain/extract.ts`: `extractSelection(storage, source, body, from, to, title)`, returns `{kind:'success',target,source}` or `{kind:'copy-only',target,error}`. Destination creation failure throws.
- `src/storage/storage.ts`: `NoteStorage {id,label,kind,list,read,create,write}`, `DemoStorage`, `DirectoryStorage(handle,id)`, `Drafts`, `ConflictError`, and exported structural `FileHandle` / `DirectoryHandle` boundary types.
- Baseline is exact raw file text; `write(note,body)` checks the current raw content against `note.baseline` before writing. Ordinary files retain their original body/frontmatter and derive title from percent-decoded basename. Granite-created files use a JSON title comment, including exact long titles.
- `DirectoryStorage` needs handles with `values`, `getFileHandle`, `getFile`, `text`, `lastModified`, `createWritable`, `write`, `close` (optional `abort`). Only `kind:'file'` entries are read, with case-insensitive `.md` suffix filtering.
- Folder registration (`src/storage/folders.ts`) persists handles and UUID ids in IndexedDB `granite-folders` / `handles`, using `isSameEntry` to find an existing repository. Permission must be granted through a user gesture to reconnect. Folder basename is never used as draft identity.
- `DemoStorage.key` is `granite.demo.v1`; value is JSON `{[filename]: {raw,updated}}`. Demo id is `demo-v1`. Removing that key resets first-run demo samples. Existing empty demo records remain empty.
- `Drafts` stores `{body,baseline,updated}` under `granite.draft.` plus a JSON `[repositoryId,filename]` tuple. Demo last-mode key is `granite.lastMode`; active filename key is `granite.active.` plus repository id.
- `Workspace` in `src/storage/workspace.ts` owns loaded entries, `edit`, `flush`, `load`, `reload`, and `replaceSaved`. Mutation serialization uses Web Locks where available and a per-repository promise queue fallback.
- `Editor` exposes a ref with `selection()` and `focus()`. Public textbox accessible name: `노트 본문`.

Stable UI names include `데모 둘러보기`, `내 폴더 열기`, `새 노트`, `새 노트 제목`, `만들기`, `노트 검색`, `새 노트로 옮기기`, `옮기기`, `원문 보기` / `라이브 프리뷰`, `집중 모드` / `집중 모드 끝내기`, `연결 패널 접기` / `연결 패널 열기`, `오늘의 노트`, `덤프`, `다른 노트 발견`, `초안 다운로드`, `디스크 내용 다시 읽기`.

## TDD record and exact verification

1. Domain/storage/extraction tests were written before implementation. Initial run after test-environment repair: **17 failed, 1 passed (18)**, expected `Not implemented` failures. The validation-only assertion initially passed against throwing stubs, so its useful proof is the later real adapter collision/overwrite tests. Initial `vitest`-missing run and initial Node native-localStorage environment failures were infrastructure setup, not counted as behavior RED.
2. Implemented core: **18/18 passed**. During implementation, failures caught a one-character metadata delimiter error; the indented-code fixture was corrected to valid CommonMark (blank line before indented block).
3. Save/paste tests added: **4 new tests failed** on missing implementations. Implemented save serialization, conflict recovery, stale-result guard and HTTP(S) filtering; then **22/22 passed**.
4. App integration test added before app: failed because demo start button was absent. Implemented demo/start/create/search UI; then **23/23 passed**.
5. Independent reviewer reported real overlapping demo writes. Added four regressions first: concurrent create, create+write overlap, draft tuple punctuation collision, even-backslash wiki parsing. **4 failed, 23 passed (27)** before fixes; **27/27 passed** after fixes.
6. Added a failure-recovery regression for returning the draft to the stored body: **1 new failed** before cleanup fix; final **28/28 passed**.

Final commands on updated dependencies:

- `npm test` — **3 files passed, 28 tests passed**, Vitest **5.0.5**, duration **748 ms**, started **2026-10-23 23:19:49 KST**. No unhandled errors.
- `npm run build` — **exit 0**, TypeScript project check and Vite **8.3.5** production build; **1,597 modules** transformed; final app JS **793.09 kB / 267.08 kB gzip**, CSS **20.10 kB / 5.32 kB gzip**. The build reports its ordinary >500 kB chunk warning.
- `npx prettier --write package.json tsconfig.json vite.config.ts index.html src tests/unit` — sources and unit tests formatted, followed by targeted formatting of final changed files.
- Initial dependency audit found three development-tool advisories. Updated Vitest/Vite/React plugin, then installation audit reported **0 vulnerabilities** across **126 packages**.

Scripts available: `dev`, `build`, `typecheck`, `test`, `test:e2e`, `test:e2e:ui`, `test:report`. Playwright dependency was installed for Task 2; Task 2 owns Playwright config, journeys, disk smoke harness and browser report.

## Boundaries and remaining review needs

- This worker did not claim to validate native Chrome folder chooser or permission dialogs. Task 2 covers adapter boundary/disk smoke and manual permission instructions. The picker requires a secure context (localhost or HTTPS) and supported desktop browser.
- A browser filesystem API does not provide a cross-file atomic transaction or compare-and-swap with external editors. The app compares exact baselines before writes and serializes its own repository mutations. A truly simultaneous external write between that comparison and stream closure remains an OS/browser race; extraction deliberately makes no atomicity claim.
- If destination write fails after an empty file handle has been allocated by the browser, that destination filename can remain on disk; the source is preserved and duplicate detection prevents silent reuse. No automatic destructive cleanup is performed.
- Failed drafts are browser-local; clearing site data or browser storage removes them. A browser refusing localStorage/IndexedDB can prevent demo/draft/reconnection persistence; normal exceptions are shown by the UI. Draft download offers an independent recovery path after a visible write failure.
- Direct remote title fetches depend on CORS and a 12-second timeout; continued editing or Escape keeps the URL and discards a stale result.
- Initial bundle size has a build warning; no external font request/runtime CDN is required. Browser visual/keyboard/IME QA and the acceptance matrix are being checked independently.
- This worker started **no preview server**. Port 5173 was already occupied by an unrelated process; controller/QA was advised to use **4173** without terminating that process.

## Consolidated review fixes (2026-10-23 23:28 KST)

Independent review and browser QA found five issues; all production fixes are now implemented:

1. **Concurrent tab recovery:** A successful save in tab B could remove tab A's distinct unsaved body. Recovery records now use separate random owner slots in individual keys (`granite.draft.` + JSON `[repositoryId,filename,owner]`). Successful saves retire only snapshots whose exact body is confirmed stored; other bodies remain recoverable. A conflict also re-persists its caller's body/baseline. `Drafts.list(filename)` returns candidates; `Workspace.restoreDraft(filename,owner)` restores one. When multiple distinct candidates exist, the recovered-draft notice offers an accessible `복구할 초안` selector. Legacy two-element tuple keys remain readable. No shared-record read/modify/write is used for separate draft authors.
2. **Cancelled pending title fetch:** Replacement now also requires a still-active paste menu with the same revision. Escape and 닫기 cancel the menu, so a late response cannot replace the raw URL.
3. **Selected-text URL paste:** Custom paste handling is registered with CodeMirror `Prec.highest`, before Markdown's built-in selected-label paste transform. The app consistently offers all three choices, preserving selected text for the alias action.
4. **Multiline Markdown links:** Preview leaves a link source-rendered if its full range contains a newline. A view-plugin replacement no longer crosses line breaks and triggers CodeMirror's RangeError.
5. **Reading scale and contrast:** Body is 16 px on desktop and narrow windows; source is 15 px desktop / 14 px narrow. Menus are 14 px, essential navigation 12–13 px, save state 11 px with substantially darker saved/dirty/error colors. Meaningful body and sidebar excerpts use darker text. Calm palette and main layout remain.

Regression evidence: added **six tests first**, observed **6 failed / 28 passed (34 total)**. Failures reproduced both pending-fetch cancellations, selected-text paste bypass, the multiline RangeError, lost concurrent recovery and missing independent candidates. After fixes, final `npm test`: **4 files passed, 34 tests passed**, Vitest **5.0.5**, **744 ms**, started **23:28:20 KST**, no unhandled errors. The editor regressions mount the real CodeMirror view and dispatch real paste/selection events.

Updated `npm run build`: **exit 0**; Vite **8.3.5**, **1,597 modules**, JS **794.91 kB / 267.60 kB gzip**, CSS **22.53 kB / 5.78 kB gzip**. Same >500 kB chunk warning remains. Controller independently also verified 34 tests/build after fixes.

Added `@types/node` for QA's filesystem/Playwright TypeScript and updated `typecheck` to `tsc -b && tsc --noEmit -p tsconfig.e2e.json`. The first combined run found **only** QA-owned `tests/helpers/disk-handles.ts:73` TS7023 (`isSameEntry` requires an explicit return annotation); controller assigned that fix to QA. Application production TypeScript/build passed. Installation audit after this addition: **0 vulnerabilities**, **128 packages**.

No additional server was started. Browser QA and scoped independent re-review continue under the controller; this report does not preempt their final results.

## Recovery lifecycle re-review fixes (2026-10-23 23:35 KST)

Scoped re-review caught two recovery-lifecycle gaps in the preceding fix. Both are now covered by explicit regressions:

- Switching to another recovery candidate previously replaced this session's current draft slot. `restoreDraft` now stores the differing current unsaved body as an independent archive snapshot **before** switching. An archive write failure leaves the current entry selected and intact.
- Editing a recovered draft and saving its replacement previously left the recovered ancestor behind, which could reappear on the next reload. Entries now retain exact source-snapshot references (including recovery lineage preserved through archival). A successful save retires only those exact unchanged ancestor versions. A newer snapshot from the original author and other independent candidates remain recoverable.

Snapshot keys are now immutable version identities: `granite.draft.` + JSON `[repositoryId,filename,owner,version]`. Each write gets a UUID version, persists the new snapshot first, then retires only this session's previous active snapshot. Switching stores a separate archive identity. Consequently, retiring an old source key cannot remove the author's later revision in another key. Legacy two/three-element tuple keys remain readable and are retired only if their exact recorded content still matches.

Additional public interfaces: `DraftReference {key,version,legacyRaw?}`; `Draft` adds `key`, `version`, and `ancestors`; `Drafts.archive`, `Drafts.reference`, and `Drafts.retire`; `Entry.recoverySources`. These are internal recovery mechanics, not new note syntax or disk metadata.

Four tests were added before this round: unique-unsaved preservation when selecting another candidate; edited recovered-ancestor retirement after save/reload; preservation of a newer revision authored by the original owner; archived recovery-lineage retirement while an independent candidate survives. Initial run: **3 failed, 35 passed (38 total)**; the newer-owner constraint already passed before the change and protects the version-aware cleanup. Final `npm test`: **4 files / 38 tests passed**, **742 ms**, started **23:35:21 KST**, no unhandled errors.

The note excerpt color is now `#58664d`. Computed normal-text contrast: **5.45:1** on normal sidebar `#f1f2eb`; **4.82:1** on selected `#e1e6d7`; **4.66:1** on selected-hover `#dce3d0`; **5.10:1** on hover `#e7ecdf`. All four states exceed 4.5:1.

Final commands after these source changes:

- `npm run typecheck` — **exit 0**, application and QA `tsconfig.e2e.json` both checked. QA's prior helper annotation error is fixed.
- `npm run build` — **exit 0**, **1,597 modules**, JS **796.28 kB / 268.02 kB gzip**, CSS **22.53 kB / 5.78 kB gzip**, unchanged ordinary chunk-size warning.
- `npm test` — **38 passed** as recorded above.

Source is stable for the controller's round-two browser acceptance and narrow re-review. This worker still has not created a commit or started a preview server.
