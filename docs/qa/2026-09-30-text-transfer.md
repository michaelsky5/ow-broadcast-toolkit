# OBS Text Transfer Follow-up — 2026-09-30

## Trigger and behavior

The operator reported that clicking Paste Match Package in the earlier OBS preview produced no response. The previous handler awaited `navigator.clipboard.readText()` before opening any dialog. An embedded browser can leave that promise unresolved, so rejection handling alone cannot guarantee that a manual input appears.

The follow-up opens a focused text box synchronously. The operator presses Ctrl+V, previews the validated package, reviews refresh/swap/new-match impact, confirms, and TAKEs. The library always opens a complete-text dialog before attempting a clipboard write; writes have a bounded wait and the text stays visible after copying. No JSON picker is involved. Existing schema, impact classification, project import/export, and persistence keys remain unchanged.

The actual OBS failure establishes the observed no-response behavior. The unresolved-read explanation is supported by the previous code and a local fault simulation; the internal OBS promise was not instrumented.

## Local validation

- Asset checks, ESLint, all 23 tests, and the production build passed; the build transformed 184 modules.
- Regression coverage includes fulfilled, unavailable/rejected, and never-settling clipboard writes.
- A local QA server made both clipboard reads and writes return promises that never settle. The control still immediately showed its manual text dialog. A valid package preview and new-match confirmation loaded QA Alpha and QA Beta, with five players per side, and TAKE displayed the teams.
- The library's complete text remained visible with Ctrl+A/C instructions under the same fault simulation. The actual DOM text was saved and parsed as `owbt-match-package-v1`: 49,507 characters, two logos, five players per side, A color `#2670c4`, and B color `#c64528`.
- The library-generated text was then previewed in the control; the same-match refresh was identified and the preserve-match-state message appeared.
- Startup and System Settings show International and Mainland China links. The supplied mainland hostname opened the OWBT startup page on this device. This is not mainland-network performance evidence.
- Startup at an actual 390-pixel viewport had a 390-pixel document width; the new links fit. The startup can scroll vertically to reach the action button. This does not establish all-page mobile acceptance.

![Complete package text available during clipboard hang](./2026-09-30/match-package-text.jpg)

![Manual paste dialog](./2026-09-30/manual-paste.jpg)

![Startup web-access links](./2026-09-30/web-access-startup.jpg)

## Remaining gates

- Record the new hosted preview's actual commit and latest Linux/Windows CI results.
- Repeat the package flow in actual OBS against that updated preview, including teams, rosters, logos, and colors.
- Observe configured Brand Stinger transitions between scenes and during same-scene TAKE.
- Complete the remaining full-release checklist and clean production-domain output acceptance.
- Publish and verify the separate frozen host before enabling its public link; see [fallback plan](../STABLE_WEB_FALLBACK.md).

The main production domain remains on the recorded stable baseline. The draft candidate has not been merged or promoted.
