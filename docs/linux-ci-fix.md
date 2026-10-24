# Hosted Linux CI failure corrections

The first hosted Yarn run ([40059118282](https://github.com/moreal/granite/actions/runs/40059118282), commit `af770e0`) passed 44 unit tests, types, and build, but failed 2 of 41 browser/disk tests. Its downloaded Playwright traces identify two separate causes.

## S04: physical redo shortcut in the browser test

The composition test sent `ControlOrMeta+Shift+z`. Playwright preserves the lowercase `z` key value even with Shift. CodeMirror first matches the unshifted character binding; with Control on Linux that invokes undo again, explaining the trace's empty document after the supposed redo. Actual shifted keyboard input produces uppercase `Z`. The test now sends `ControlOrMeta+Shift+KeyZ`, letting Playwright derive the character from the physical key and modifiers. Production history bindings remain unchanged. This is a test simulation defect, not a request to alter undo behavior.

## S06/S07/S12: immediately accepting an explicit menu

CodeMirror's default `interactionDelay` is 75 ms after the completion menu opens. During that window its Enter handler declines completion, allowing the normal newline handler to run and close the menu. The hosted trace therefore shows a hidden menu but no completed link and no restored surrounding UI. These menus require explicit `[[` or `@` input, so the editor now sets `interactionDelay: 0`: once the menu is visible its selected action accepts Enter immediately. Existing composition protection and completion triggers remain unchanged. This corrects existing keyboard-selection expectations rather than introducing a new interaction.

A new S06/S12 browser regression fixes `Date.now` while leaving timers running, so acceptance always occurs within the default delay irrespective of machine speed. Before the fix it failed with `[[덤` instead of `[[덤프]]`; after the fix it checks the complete persisted-link syntax, closed menu, and restored opacity. No sleeps, retries, or relaxed assertions were added.

## Verification

- Focused composition, mouse/Enter note selection, date command, new link, and immediate completion: 6 passed (5.9 s).
- Full Chromium browser/disk suite: 42 passed (34.6 s), retries disabled.
- Unit suite: 44 passed across 4 files. Typecheck and production build exited successfully; build retains the existing large-chunk advisory.
- Red/green evidence: the fixed-clock regression failed before the production change, then passed in both focused and full runs.

Local checks use macOS arm64, Node.js 24.18.0, Yarn 4.18.1 with `nodeLinker: pnpm`, and Playwright Chromium. Browser checks run in `/private/tmp/granite-yarn-ypqst9ue` on port 4174; only the copied server config and same-origin URL assertion are adjusted from 4173. Existing development servers remain running.

The local composition scenario uses CDP composition events. It does not establish native Korean IME behavior, real folder picker behavior, or native permission flows. Hosted Linux confirmation must come from the subsequent GitHub Actions run, not this macOS result.
