# S14 rich preview theme support

2026-10-25. Mermaid diagrams follow the resolved light/dark theme on the document root. Each mounted diagram listens for `granite-theme-change`; rendering does not dispatch an editor transaction, replace source text, or move the selection. This also avoids rebuilding CodeMirror decorations during composition. KaTeX continues to inherit text color and uses bundled fonts.

Mermaid initialization and rendering share one serialized queue because the library configuration is global. Every render captures its resolved theme and a widget generation. Theme changes invalidate pending generations; destroyed widgets remove listeners and invalidate pending results. Stale requests are skipped before starting and their completed SVG is never inserted. SVG IDs remain unique. Strict security, disabled HTML labels, source restrictions, and SVG sanitization are retained.

## Evidence

- `tests/unit/rich-theme.test.ts`: 2 passing tests verify light/dark configuration, unchanged editor state/document, strict options, serialized configuration, stale-result rejection, and listener removal after disposal.
- `tests/e2e/rich-theme.spec.ts`: 1 passing Chromium test renders real Mermaid SVG, switches light/dark/light, verifies replacement SVG IDs and node label contrast of at least 4.5:1.
- Existing parser/security regressions remain in `tests/unit/rich-preview.test.ts`.

The focused browser test directly changes the resolved document theme and dispatches its event. It does not claim to test the settings picker or operating-system appearance integration; those are separate integration coverage. Native IME, folder permissions, and OS clipboard were not exercised.
