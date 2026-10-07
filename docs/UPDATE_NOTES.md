# Update Notes

## v0.2.2 - 2026-10-07

### Overwatch Season 5

- Add Support hero Doctrine (血律) and the FryDeck-matched 256×256 hero portrait and 1920×1080 roster artwork.
- Move Sombra from Damage to Support and add Support portrait paths; keep existing Damage files available for historical project and BAN references.
- Add Escort map Watchpoint: Grímsvötn (监测站：格里姆火山) and its map artwork.
- Update startup release notes and the feedback template version.

### Validation

Candidate validation and release status are recorded in [the Season 5 QA report](./qa/2026-10-07-v022-season5.md). OCR regression uses the supplied no-perk observer screenshot; an actual Season 5 screenshot containing Doctrine has not yet been supplied.

## v0.2.1 - 2026-10-06

### OCR Capture

- Adopt the System/FryDeck observer crops for all 16:9 and 16:10 no/one/two-perk combinations, including separate team heights and legacy-default migration.
- Serve the OCR worker, WASM, and English model from the same origin, with initialization/read deadlines and cancellation. Screenshots stay in the browser.
- Rebuild the review desk around the System result form. Align native-proportion original cell crops under their numeric inputs, collapse calibration/totals/processed previews, and retain responsive controls.
- Use green/yellow/red accepted/pending/invalid states. Clicking only selects; Enter, completing an edit, or Confirm Row acknowledges exact current values. Row confirmation leaves other rows and time unchanged.
- Block Apply for missing numbers, invalid duration, duplicate or wrong-team players, unreviewed candidates, and stale results. Apply duration, row values, and player assignments together.
- Update the guide, demo crop defaults, feedback template, unified favicon, and Chinese/English release copy.

### Validation

- Local assets, ESLint, 47 regression tests, and production build passed.
- Original no-perk screenshot: all 60 numbers checked against the source; ambiguous 6:27 time required manual correction to 6:22.
- Browser checks covered Enter/blur/row confirmation, error blocking, aligned crops, two-way swapping, and 400px layout.
- CI, formal-domain deployment, and production browser acceptance are recorded in the release QA document after completion.

## Unreleased - 2026-09-30

### Fixed

- Report project and Program save failures instead of treating a failed browser-storage write as success.
- Show a persistent warning in the console and system setup with project backup export and Retry Save actions. Autosave indicators now reflect a failed save.
- Keep the existing live update delivery available when persistence fails, and clear the warning after both editing and Program saves recover.

### Operator Guide

- Add a Chinese illustrated quick start with actual page and OBS rehearsal screenshots.
- Include a fictitious two-team practice project, match-package text, and a separate team-library backup, using existing schemas and manual import controls.
- Link the guide from startup and system settings, and remove promises of a future Windows app from interface copy.
- Prepare a Chinese video script; recording, narration, and final video format remain to be selected.
- Clarify legacy project-text transfer, the library import confirmation/save steps, and the separate OBS/browser practice inputs; add a preflight checklist.
- Prefer the current tutorial host in its OBS address selector, with protected-preview guidance and a public-host fallback for offline reading.
- Show an edit-selection hint when the library already has saved teams instead of suggesting it is still empty.

### Release Preparation

- Refresh five indirect development/build dependencies to their first patched versions after the mainland preview exposed new audit findings. Framework versions and runtime dependency records remain unchanged; full audit returns zero findings, and all 199 build files match the accepted candidate byte for byte.

- Add GitHub Actions checks on Linux and Windows with locked dependency installation, asset checks, ESLint, regression tests, and production builds.
- Document the recorded stable baseline, candidate preview checks, actual OBS acceptance, and deployment recovery in `WEB_RELEASE_RUNBOOK.md`.
- Preserve the existing project schema, storage keys, and Preview / Program workflow.

## Unreleased - 2026-07-21

### Added

- Added a standalone `/#library` team asset library backed by browser IndexedDB for reusable teams, players, logos, colors, staff, and notes.
- Added JSON library backup/restore, OWBT project-team extraction, CSV/TSV/TXT import, CSV templates, and folder-based logo matching.
- Added A/B match-package creation with duplicate-team, roster, logo, payload-size, and schema health checks before transfer.
- Added a direct `/#control` surface for OBS docks and production operators, including current-match team assignment and five-player lineup selection.
- Added copy/paste match-package import with refresh, side-swap, and full-replace impact previews.

### Fixed

- Reject unsupported future Team Library backup schema versions instead of silently importing them as v1 data.
- Protect duplicate cleanup, match-package copying, and backup export from silently discarding or omitting unsaved team edits.

### Changed

- Separated long-lived team asset management from the current-project roster editor while keeping project teams compatible with existing scenes.
- Added Team Library and OBS Control addresses to Console Settings for same-origin handoff.
- Lazy-loaded the scene editor and toolbox workspaces with visible loading and recovery states, reducing the main production JavaScript chunk from 549.12 KB to 312.86 KB.
- Updated React, Vite, ESLint, and related development dependencies; `npm audit` now reports zero known vulnerabilities.

### Documentation

- Documented the `/#library` and `/#control` routes, team-library persistence, match-package workflow, and release smoke tests.
- Excluded Codex remote attachment staging files from version control.

### Validation

- Ran `npm audit` and `npm audit --omit=dev`.
- Ran `npm run check` and `git diff --check`.
- Smoke-tested direct `/#library`, `/#control`, and `/#overlay` routes from the production build.
- Verified first-load scene-editor and toolbox chunks settle successfully after production code splitting.
- Verified A/B selection, match-package health checks, Console startup, TAKE, and same-origin Overlay updates without browser console errors.

## Unreleased - 2026-06-13

### Fixed

- TAKE now keeps the Brand Stinger transition layer visible when the browser or operating system reports `prefers-reduced-motion: reduce`.
- Reduced-motion mode still suppresses the scene mount animation, but no longer skips the actual TAKE transition.
- TAKE transitions now have an explicit trigger token, so same-scene content updates can still play the selected transition instead of updating as a direct cut.
- CJK text rendering has been hardened across broadcast scenes and legacy FCOL overlays to reduce vertical glyph clipping with Chinese event, team, player, caster, staff, map, title, and subtitle text.

### Changed

- Scene typography now uses safer line-height values for user-facing CJK-capable text while preserving tight numeric and decorative labels where appropriate.
- The OWBT transition mark is smaller so the Brand Stinger reads as a transition accent instead of a full-screen logo card.
- The transition mark asset is now treated as a required app asset by the asset checker.
- Release checklist coverage now includes Brand Stinger TAKE transition and full CJK broadcast smoke tests.

### Documentation

- Added troubleshooting notes for machine-specific TAKE transition issues, including reduced-motion settings, stale local console settings, same-origin Preview/Overlay checks, and browser console diagnostics.
- Added CJK typography QA guidance for future scene changes.

### Validation

- Ran `npm run check`.
- Ran `git diff --check`.
- Smoke-tested CJK typography in browser-rendered broadcast and legacy scenes.
- Visually spot-checked team data matchup, live HUD, map pool, and starting lineup callout scenes.
