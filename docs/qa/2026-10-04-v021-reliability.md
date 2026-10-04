# v0.2.1 reliability candidate — verification

Date: 2026-10-04. Base: public `main` at `023cb06639edb483bc820634ab7b87aea5b65568`.
Candidate branch: `codex/owbt-v021-reliability`. This record covers local code, browser verification and focused actual OBS acceptance; hosted checks and release status are recorded in the candidate PR.

## Scope

Complete-project import validation and startup storage recovery. Existing project schema (`owbt-project-v0.1`), storage keys, normalizer and Preview/Program workflow remain in use. Dependency versions are unchanged. The tutorial worktree's pending guide edits and video assets are outside this candidate.

## Automated checks

`npm run check` passes asset checks, ESLint, all 35 tests in 9 suites, and the production build.

- `tests/project-import.test.js`: export round trip, published practice project, BOM and whitespace, missing optional legacy fields and scene aliases, wrong backup kinds, future schemas, malformed fields, prototype keys, UTF-8 size limit, and shared file/text validation.
- `tests/project-storage-recovery.test.js`: fresh module startup with a failed first write probe, quota recovery without reload, blocked reads, untouched malformed originals, independent editing/Program recovery, throwing storage accessors, and fresh profiles.
- Existing match-package, swap, branding, MVP, OCR, portrait and save-feedback regressions also pass. Ordinary write failures still allow live message delivery after successful reads.

## Browser checks

Used the final production build in a dedicated Edge test profile with fictional practice data. The control and separate Overlay tabs used the same local origin. No existing production or OBS project was modified.

| Scenario | Observed result |
| --- | --- |
| Empty JSON, wrong match package, team-library backup, future schema, malformed teams and broken JSON in Project Text | Import stopped with actionable text; entered text and both original stored streams remained intact. |
| Valid full-project import, then cancel confirmation | Editing and Program remained unchanged. |
| Confirm valid Project Text import | Both streams and the visible console restored the imported project. |
| File import of the published practice project | Confirmation and restoration succeeded. |
| Paste the published demo match package in its dedicated control | Correct A/B preview and confirmation; both teams and ten players loaded. |
| Edit the waiting text without TAKE | Draft changed; Program and the separate Overlay retained the previous text. |
| TAKE, then independently reload Overlay and console | Output received the new text without refreshing; both pages restored it after reload. |
| Storage full before application startup | Saved draft and Program still loaded separately. Retry Save succeeded after clearing the simulated fault. |
| `getItem` failure on both streams | Originals remained untouched and fallback broadcasts were suppressed. Retry Read restored draft score 2 and Program score 0 separately. |
| Throwing `window.localStorage` accessor | Console rendered a recovery warning. Retry Read restored both streams after access returned. |
| Malformed draft and Program | Two separate original-data controls; Program text export matched its original bytes. Viewing/canceling the dialog did not replace either stream. |
| Recovery warning at 420 px width | Warning and four actions fitted the viewport; document width was 420 px, with no horizontal overflow. |

The storage cases used a local HTML bootstrap that seeded fictional projects and temporarily threw browser storage errors before the application loaded. The injection exists only in local QA tooling; no fault switches are included in product sources. Browser page-error collections were empty for the checked workflows.

## Release gates

Local browser evidence is separate from real OBS acceptance. Before merging this candidate, follow [the release runbook](../WEB_RELEASE_RUNBOOK.md): check the latest Linux and Windows CI jobs, inspect the exact hosted preview, and test the candidate dock and Browser Source pairing in OBS with a saved backup.

The focused OBS check is Project Text export/import, invalid-input rejection, edit without TAKE, TAKE, and dock/source refresh recovery. Record OBS version and the candidate deployment. The international and mainland formal domains, plus the frozen fallback, have not been changed by these local checks.

## Practical limits

- External full-project imports are limited to 64 MiB of UTF-8 text. Embedded images count toward the limit; large assets can use URLs.
- Optional legacy fields are filled by the existing normalizer. Unsupported schemas and malformed supplied fields are rejected instead of silently converted.
- A blocked or malformed stream is protected from automatic writes and broadcasts. Explicitly confirming a valid import or reset replaces it; retain original text or an external backup first.
- Recoverable storage access failures can use Retry Read. Malformed originals still need a valid project backup or a deliberate reset. Recovery does not repair arbitrary damaged JSON.
- External browsers and OBS do not necessarily share a storage environment. The manual text transfer workflow remains necessary between them.

## Actual OBS acceptance

Completed on 2026-10-04 in OBS 32.2.2 on Windows. The dock and Browser Source both used the exact Vercel preview hostname at application commit `057e8ae01b55bb35904515bbc5d3e12fc766471e` (deployment `dpl_G22hMDbCpboJEMVGP7PGZugMCRtx`). The Browser Source was 1920 x 1080 at 60 fps. A separate QA scene collection and dock used fictional practice data; the original OBS scene configuration was backed up locally before testing.

| Scenario | Observed result |
| --- | --- |
| Project Text containing `{}` | Rejected with a format-version message. Entered text and the original Program remained visible. |
| Published fictional practice project through Project Text | Validated, reached replacement confirmation, and restored Chinese event and waiting content in the actual Browser Source. |
| Edit the waiting text without TAKE | The dock's draft changed to `OWBT v0.2.1 OBS TAKE 1004`; the actual Browser Source retained `彩排即将开始，请稍候`. |
| Press TAKE | The actual Browser Source showed the new text immediately, without source refresh. |
| Export Project Text, change the text and TAKE, then import the exported backup | Native Ctrl+A/Ctrl+C and Ctrl+V transferred the complete backup. The changed `x` Program text returned to `OWBT v0.2.1 OBS TAKE 1004` after explicit replacement confirmation, without refreshing the source. |
| Select the roster scene without TAKE, then refresh the dock and Browser Source cache | Preview remained the A-team roster with five Chinese starters; Program remained the middle screen and the last TAKE text. |
| Normal OBS exit and relaunch | A new OBS window recovered the same untaken roster draft and saved middle-screen Program. The actual Browser Source retained the last TAKE text; no accidental scene TAKE occurred. |
| Finish QA | Original collection `未命名` and Program scene `FryDeck` were restored, and the new QA dock was hidden. Streaming and recording remained inactive. |

Actual-output screenshots and machine-readable results are retained locally. Private OBS configuration backups are not committed or uploaded. OBS accessibility output caps long textarea values; the accepted native clipboard round trip and actual output establish the full backup transfer, independently of the truncated accessibility text. The Vercel preview toolbar is present on the protected preview and is not part of OWBT's output design.

The focused OBS gate passes for this exact application commit. This is a release candidate, not a published v0.2.1 release. Verify the latest PR/CI state and the mainland platform's candidate deployment independently before merging; both formal deployments must be checked after an authorized release. Tutorial changes and a whole-event rehearsal remain separate follow-up work.
