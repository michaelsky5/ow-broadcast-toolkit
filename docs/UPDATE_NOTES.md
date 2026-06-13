# Update Notes

## Unreleased - 2026-06-13

### Fixed

- TAKE now keeps the Brand Stinger transition layer visible when the browser or operating system reports `prefers-reduced-motion: reduce`.
- Reduced-motion mode still suppresses the scene mount animation, but no longer skips the actual TAKE transition.
- TAKE transitions now have an explicit trigger token, so same-scene content updates can still play the selected transition instead of updating as a direct cut.
- CJK text rendering has been hardened across broadcast scenes and legacy FCOL overlays to reduce vertical glyph clipping with Chinese event, team, player, caster, staff, map, title, and subtitle text.

### Changed

- Scene typography now uses safer line-height values for user-facing CJK-capable text while preserving tight numeric and decorative labels where appropriate.
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
