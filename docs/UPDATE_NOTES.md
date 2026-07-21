# Update Notes

## Unreleased - 2026-07-21

### Added

- Added a standalone `/#library` team asset library backed by browser IndexedDB for reusable teams, players, logos, colors, staff, and notes.
- Added JSON library backup/restore, OWBT project-team extraction, CSV/TSV/TXT import, CSV templates, and folder-based logo matching.
- Added A/B match-package creation with duplicate-team, roster, logo, payload-size, and schema health checks before transfer.
- Added a direct `/#control` surface for OBS docks and production operators, including current-match team assignment and five-player lineup selection.
- Added copy/paste match-package import with refresh, side-swap, and full-replace impact previews.

### Changed

- Separated long-lived team asset management from the current-project roster editor while keeping project teams compatible with existing scenes.
- Added Team Library and OBS Control addresses to Console Settings for same-origin handoff.
- Updated React, Vite, ESLint, and related development dependencies; `npm audit` now reports zero known vulnerabilities.

### Documentation

- Documented the `/#library` and `/#control` routes, team-library persistence, match-package workflow, and release smoke tests.
- Excluded Codex remote attachment staging files from version control.

### Validation

- Ran `npm audit` and `npm audit --omit=dev`.
- Ran `npm run check` and `git diff --check`.
- Smoke-tested direct `/#library`, `/#control`, and `/#overlay` routes from the production build.
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
