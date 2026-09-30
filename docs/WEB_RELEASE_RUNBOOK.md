# OWBT Web Candidate Release

Use one focused candidate at a time. Keep the current production deployment available while the candidate is checked in a separate preview environment.

## Stable Baseline Recorded on 2026-09-30

- Git commit: `0950bd15fbb7fd9a54d62a7cf392e3fc2e0de79a`.
- Local baseline tag: `baseline/web-stable-20260930`.
- Vercel project: `ow-broadcast-toolkit` (`prj_SIOmxxPvAegzC2aqFlgUshpLYaVN`).
- Vercel production deployment: `dpl_CgnKM37NwVi8YsVRmpLVy8EDhuPQ`.
- Recorded deployment URL (requires Vercel access): `https://ow-broadcast-toolkit-pbc72s4pq-shenkeyu5-2087s-projects.vercel.app`.
- Production domain: `https://owbt.fries-cup.com`.

These identify the baseline for the save-feedback candidate. Before every later release, record the then-current production commit and deployment again.

## Candidate Checks

1. Put the focused change on a separate branch and open a draft PR targeting `main`.
2. Confirm both `Check (ubuntu-24.04)` and `Check (windows-2025)` pass for the latest candidate. The workflow fixes the operating-system image labels and action commit SHAs, installs the lockfile with `npm ci`, and runs `npm run check` with Node.js 24.14.0, matching the locally validated runtime. Hosted images still receive maintenance updates within those fixed labels.
3. Confirm the Vercel deployment is `READY`, targets preview, and record its commit. It should match the latest candidate. If a documentation or CI-only follow-up does not produce another deployment, record the tested preview SHA and the latest PR/CI SHA separately, and verify the complete diff excludes application sources, dependencies, assets, and build/hosting configuration. Unchanged application inputs do not mean the deployment records the newer commit. A build succeeding is separate from browser or OBS acceptance.
4. Use the candidate's unique deployment hostname for its control, library, and Overlay routes throughout the check. A branch alias can move when another commit is pushed.
5. Complete the relevant checks below and use the existing [release checklist](./RELEASE_CHECKLIST.md) to select checks for changed workflows and critical interactions. Attribute prior real-event and actual OBS evidence for unchanged features; broad unchanged-feature coverage is follow-up work unless a known failure affects the release. Record the OBS version, operating system, candidate commit, tested routes, and observed results.

The CI workflow validates code and build output. It does not deploy or promote anything, and it does not configure required status checks on `main`. Until repository rules require these checks, verify them before merging.

## OBS Acceptance for Save Feedback

Before testing, export the current production project and the team library. Project and library backups are separate. The preview hostname has separate browser storage; production data will not automatically appear there.

Use test data in the candidate. In OBS, add a custom browser dock at the candidate's `/#control` URL and a Browser Source at its `/#overlay` URL. Use 1920 x 1080, or the output size selected in OWBT.

| Check | Expected result | Result |
| --- | --- | --- |
| Edit a scene in Preview | The current Program output stays unchanged until TAKE, except for controls intended to update live. | Passed in OBS 32.2.2; see [evidence](./qa/2026-09-30-save-feedback.md). |
| Press TAKE, including a content update in the same scene | Program and the OBS Browser Source show the selected content. | Passed in OBS 32.2.2; see [evidence](./qa/2026-09-30-save-feedback.md). |
| Observe configured transitions between scenes and during same-scene TAKE | The selected transition visibly plays in the actual Browser Source. | Operator reported both Brand Stinger cases passed on the updated preview; animation frames were not independently captured. See [follow-up](./qa/2026-09-30-text-transfer.md). |
| Change scores and switch broadcast scenes | The Browser Source follows the controls without editing UI appearing in the output. | Live HUD `2:1` verified in OBS 32.2.2; Vercel preview toolbar remains visible. See [evidence](./qa/2026-09-30-save-feedback.md). |
| Refresh the dock and Browser Source after a successful save | The saved edit and Program state remain available. | Passed in OBS 32.2.2; see [evidence](./qa/2026-09-30-save-feedback.md). |
| Close and reopen OBS | The same saved project and output can be recovered. | Passed in OBS 32.2.2; see [evidence](./qa/2026-09-30-save-feedback.md). |
| Export project text, then import it into the preview using test data | The project content is restored. Text export remains usable when OBS cannot create a download file. | Passed in OBS 32.2.2; `2:1` restored after an operator-reported `3:3` edit. See [evidence](./qa/2026-09-30-save-feedback.md). |
| Import an A/B match package from the external-browser team library into the dock | A text box opens immediately; Ctrl+V, preview, and confirmation load both teams, roster, logos, and colors without a JSON file picker. | Updated preview passed native text paste and confirmation. Actual source verified both logos, ten players, score updates, and Alpha 0 / Beta 2 after an explicit A/B swap. Preview colors were operator-confirmed; roster-scene color rendering remains in the full checklist. See [follow-up](./qa/2026-09-30-text-transfer.md). |

Browser storage and `BroadcastChannel` are local to a browser environment and origin. Matching URLs alone do not prove that an external browser, an OBS dock, and an OBS Browser Source share the same storage context. Test the actual dock-to-source pairing. Team-library packages are transferred from the external browser using the dock's manual paste workflow. The library always shows the complete text. In OBS, click Paste Match Package, press Ctrl+V, preview the impact, confirm, and TAKE. Full project backups use Export/Import Project → Project Text instead.

Saving failure is already covered by automated regression tests and a local browser fault simulation. That simulation confirms the visible warning, latest-edit text export, retry behavior, and continued live message delivery. It is separate evidence from actual OBS acceptance.

## Frozen User Fallback

The previous stable version is publicly available at [owbt-stable.fries-cup.com](https://owbt-stable.fries-cup.com/), deployed independently from the frozen baseline. Unsigned HTTPS verified all 189 files, and actual OBS core TAKE, roster colors/Chinese text, and text-backup restore passed. See [STABLE_WEB_FALLBACK.md](./STABLE_WEB_FALLBACK.md) and [partial whole-event rehearsal](./qa/2026-09-30-rehearsal.md) for the exact evidence and remaining gates. A public frozen-version entry and operator deployment rollback are separate recovery paths.

## Publish and Recovery

Publish only after the candidate checks and OBS acceptance pass. Merge the reviewed candidate, wait for main checks and the production deployment, and verify the formal domain's control-to-Overlay behavior against the released commit. Record the resulting deployment ID and URL.

If the released version fails, restore the recorded known-good deployment using Vercel's deployment controls. Check the deployment details and the available rollback/promotion action for the account before changing the production alias. Hobby accounts can instantly roll back to the immediately previous production deployment; Pro and Enterprise accounts can choose other eligible deployments. If the old deployment cannot be reused, redeploy its recorded Git commit and verify that build before promoting it.

For an authorized CLI rollback to this recorded baseline, the explicit target is:

```text
vercel rollback dpl_CgnKM37NwVi8YsVRmpLVy8EDhuPQ --scope shenkeyu5-2087s-projects
```

This command has not been run as part of candidate preparation. Deployment rollback does not restore browser project or library data; retain the exported backups separately. The save-feedback candidate keeps the existing project schema and storage keys.

Reference: [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback).
