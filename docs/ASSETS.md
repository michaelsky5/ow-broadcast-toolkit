# OWBT Asset Conventions

OWBT keeps bundled Overwatch assets in `public/` so both the Console and
Overlay can load them by stable public URLs.

## Rights and redistribution

Asset paths describe loading conventions, not permission to reuse artwork.
The [project license](../LICENSE) does not license Overwatch artwork, fonts,
trademarks, or user-supplied event assets. See
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for the material boundaries
and the bundled HarmonyOS Sans SC license. Before sharing a build, check
permissions for its included assets, preserve the applicable notices, and
replace or omit materials you do not have permission to redistribute.

## Hero Assets

- Hero portraits live in `public/heroes/{role}/{assetKey}.png`.
- Roster portraits live in `public/roster/{role}/{assetKey}.png`.
- `assetKey` values in `src/data/overwatch/heroes.js` should use kebab-case.
- Example: `junker-queen`, `wrecking-ball`, `soldier-76`, `jetpack-cat`.

## Map Assets

- Map images live in `public/maps/{mode}/{assetKey}.{ext}`.
- Most maps use `.jpg`.
- Clash map images currently use `.png`, so their map entries set `imageExt: 'png'`.
- Prefer ASCII filenames when adding new files.

## Mode Icons

- Mode icons live in `public/modes/{assetKey}.{ext}`.
- Most modes use `.png`.
- Clash uses `clash.svg`, declared with `assetExt: 'svg'`.

## Generated Files

- Do not keep verification screenshots in the project root.
- `dist/`, `.codex-snapshots/`, and `owbt-*.png` are ignored and should not be committed.

## Validation

Run `npm run check:assets` after changing Overwatch hero, map, mode, or asset
path data.
