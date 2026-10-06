# OWBT v0.2.1 OCR release preflight

Date: 2026-10-06. This record covers the OCR desk, crop presets, feedback icon/template, and associated guide and version copy.

## Baseline and recovery

- Parent production commit: `023cb06639edb483bc820634ab7b87aea5b65568`.
- International deployment before this release: `dpl_CmhTRAdARVQujK8b6WL15aDk21po`, serving `https://owbt.fries-cup.com/`.
- Mainland domain: `https://owbt-cn.fries-cup.com/`; it builds independently from main and must be verified separately.
- Frozen fallback: `https://owbt-stable.fries-cup.com/`, unchanged by this release.
- The separate reliability candidate in draft PR #9 is not included.

## Automated validation

Node.js 24.14.0 on Windows: `npm run check` passed asset validation, ESLint, 47 tests in 7 suites, and the Vite 8.1.5 production build (168 modules). `git diff --check` passed. Dependency versions are unchanged; package and feedback versions are 0.2.1.

## Local browser acceptance

The built application was checked at `http://127.0.0.1:4188/#control` using the reported original 1280 x 719 observer screenshot and its no-perk layout.

- All 60 numeric values matched the screenshot after recognition and review. Time OCR selected 6:27 and correctly remained pending; manual correction to 6:22 produced 6.366666666666666 minutes. This demonstrates review handling, not error-free OCR.
- Clicking and leaving an unchanged field did not acknowledge it. Enter acknowledged the current value. An edit remained pending while focused and acknowledged on completion.
- Confirm Row acknowledged only the active row's six exact valid values, including zero. It left other rows and time pending and was disabled for an invalid or incomplete row.
- Missing values and invalid seconds were red; unresolved candidates were yellow; reviewed values were green. Duplicate or wrong-team players and unchecked bindings blocked Apply.
- Native-proportion per-cell crops aligned with their inputs. Image zoom did not acknowledge candidates. Swapping twice restored row values and crops.
- At 400 x 840, no page horizontal overflow occurred; fields and their source crops remained paired. The viewport override was removed afterward.
- Previous end-to-end browser acceptance applied both team totals, assignments, and 6:22 duration together; replacing a screenshot cleared the draft and duration while retaining already applied match statistics.
- Browser console reported no warnings or errors.

## Production verification

CI and hosting results are recorded in the GitHub v0.2.1 release after completion. Local and CI results alone do not establish formal-domain acceptance. Check both formal domains against the production build, including the bundled OCR worker, WASM, and model, feedback icon/version, guide, and control-to-Overlay delivery.

Native OBS was not rerun for this OCR-only release. Existing OBS evidence for unchanged sync and output behavior remains in the earlier release QA records; browser checks do not claim OBS or real-event acceptance.
