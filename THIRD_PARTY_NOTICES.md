# Third-party materials and licenses

The [OWBT Community Source License](LICENSE) covers OWBT's original source,
build scripts, documentation, and original examples only to the extent that
the Licensor may license them. It does not relicense third-party components,
artwork, fonts, trademarks, or user-supplied content.

This document identifies the main material boundaries. It is not a replacement
for each component's complete license or an exhaustive list of transitive npm
dependencies. Preserve the applicable copyright, license, and notice files for
components included in a redistributed copy.

## Overwatch-related materials

The following locations contain Overwatch-related material whose rights remain
with Blizzard and/or the respective rights holders:

- `public/heroes/` and `public/roster/`: hero and roster portraits.
- `public/maps/`: map artwork.
- `public/modes/`: game-mode icons.
- Overwatch-related names, marks, or other artwork elsewhere in the repository,
  including branding or role illustrations.

OWBT is not an official Blizzard or Overwatch product and does not imply their
authorization or endorsement. Inclusion in this repository is not a grant of
permission from those rights holders. Before use or redistribution, determine
the terms that apply to the material and your intended use. Replace or omit
materials for which you do not have permission.

## HarmonyOS Sans SC

OWBT uses **HarmonyOS Sans SC**, copyright 2021 Huawei Device Co., Ltd.
The unmodified font files in `public/fonts/harmonyos-sans-sc/` are governed by the
[HarmonyOS Sans Fonts License Agreement](public/fonts/harmonyos-sans-sc/LICENSE.txt).

That agreement requires a notice that the font is used, retention of its
copyright and agreement when copying it, and restrictions on modification and
standalone redistribution of the font software. Follow the complete agreement;
the OWBT license does not replace it.

## Runtime dependencies

These direct runtime dependencies retain their own licenses:

| Component | License | Project |
| --- | --- | --- |
| React | MIT | [facebook/react](https://github.com/facebook/react) |
| React DOM | MIT | [facebook/react](https://github.com/facebook/react) |
| html-to-image | MIT | [bubkoo/html-to-image](https://github.com/bubkoo/html-to-image) |
| Tesseract.js | Apache-2.0 | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) |

Use `package-lock.json` to identify the exact installed packages and versions.
Their package distributions contain the applicable license and notice files.
Development tools and transitive dependencies also retain their respective
licenses. The restrictions on OWBT's original code do not replace these terms.

## Event assets and generated content

Event and team logos, sponsor marks, uploaded images, recordings, OCR inputs,
and other user content retain their respective ownership and permissions.
The presence of an upload or configuration feature does not provide rights to
that content. Users and redistributors are responsible for the materials they
include in projects, broadcasts, exported graphics, and software packages.

Generated graphics or recordings may still contain third-party art, names, or
marks. Exporting them does not remove those rights or create a new permission.
