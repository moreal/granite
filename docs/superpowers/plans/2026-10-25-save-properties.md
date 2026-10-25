# Save formatting and inline property values

> **For agentic workers:** Use subagent-driven-development. All workers and reviewers Sol6.1; no nested agents.

**Goal:** Save/idle formatting without a primary manual button, and direct property value editing.
**Architecture:** Reuse registered formatter and host cancellation before workspace.flush; exact YAML range patches and small Solid value-editor components.
**Tech Stack:** Solid2 RC, CodeMirror6, yaml, HongdownWASM, Yarn4pnpm/Node24.
**Spec:** ../specs/2026-10-25-save-properties.md

## Constraints and review focus

No implicit upload/rewrites on opening. Preserve all note identity, cancellation, IME/history/CRLF/conflict/recovery guarantees. Settingsoff respected. Property drafts cannot cross notes or overwrite changes. Existing complex YAML remains editable without lossy conversion. Screenshots are per-test output artifacts and use Storybook play completion readiness. Chromatic approval state is not part of user-facing report.

## Task1 implementation

- [x] Reproduce current command-onlyflush and propertypickeremptyYAMLjump; failingbehavior tests.
- [x] Implement safeCmdSformatthenflush and remove manualtoolbarbutton.
- [x] Implement inline new/existing scalar value editor and precise sourcepreserving patches, expandableYAML.
- [x] Update stories/interactions/crops and preserve safetytestmeaning.
- [x] Focused regressions; frozenfullunit/type/appstorybookbuild/E2E/components/visual; inspectsmallcaptures.

## Review and release

- [x] IndependentSol6.1 review and scopedfixes.
- [ ] Commit/pushmain; exactheadfunctionalCI/Pages and publicsave/propertysmoke, internalvisualupload check.
