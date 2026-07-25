# OWBT application font subsets

The `*.app-<hash>.woff2` files contain the glyphs used by the OWBT source,
tests, and bundled Overwatch data, plus Basic Latin, Latin-1, CJK punctuation,
and full-width punctuation.

They were generated from the corresponding HarmonyOS Sans SC TTF files with
FontTools 4.63.0 and Brotli 1.2.0. The original TTF files remain in
`tools/font-sources/harmonyos-sans-sc/` for license provenance and future
regeneration; keeping them outside `public/` prevents roughly 49 MB of unused
fonts from being copied into every production build.

User-entered glyphs that are not present in an application subset fall through
to the system Chinese font stack declared in `src/index.css`.

When regenerating a subset, update the eight-character SHA-256 suffix in
`src/index.css` and `index.html`. Versioned WOFF2 files are served with a
one-year immutable cache policy.
