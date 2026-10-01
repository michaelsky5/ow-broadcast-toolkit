# Operator onboarding walkthrough — 2026-09-30

This walkthrough follows the Chinese tutorial using synthetic Star/Flame teams. It uses a hosted candidate in an ordinary browser and a separate Web Overlay tab. It is not a new real-OBS acceptance or an independent first-time user's review.

## Actual application flow

Application build: `983fd89f58e2cd6716eb09dbc2618d5435223aa0`.

| Step | Observed result |
| --- | --- |
| Import the supplied library backup | The confirmation showed two teams, ten players, two additions and zero replacements. |
| Confirm merge and finish branding review | Both short names and logos were present. Saving the review showed two teams, ten players and Saved Locally. |
| Select Star A and Flame B | The A/B cards matched the intended order; the package check reported usable and no issues. |
| Generate a package using the actual library UI | Full text appeared and the copied payload matched it; the parsed package contained the intended teams and five starters per side. |
| Put a full project in the package field | The UI rejected the wrong kind and directed project backups to Import Project / Project Text and library backups to the library. |
| Preview the actual generated match package | The impact preview showed both names and all ten starters; a new-match reset was explicit. |
| Confirm, select Live HUD and TAKE | The independent Web Overlay displayed the intended teams, logos, ten starters and 0:0. |
| Increment A and TAKE | The independent output showed Star 1, Flame 0. |
| Export actual project text | The parsed backup contained the intended two teams, ten players and 1:0. |
| Change to 2:0, restore the exported backup and TAKE | The independent output returned to 1:0. It retained 1:0 after Overlay refresh. |

## Friction corrected in the next candidate

- A populated library with no selected editor record still showed Start With Your First Team. The placeholder now asks the operator to select a saved team to edit, in Chinese and English. Empty libraries keep the original introduction.
- The guide distinguishes the new manual package dialog from the frozen old interface, provides the old project-text route, and explains protected-preview login pages.
- Guide URLs prefer the guide's current HTTP(S) host. Offline reading keeps public-host selection. Operators still need the full authorized links when a preview is protected.
- The library exercise now includes import confirmation and Save Review. It explains that an OBS project does not automatically appear in an ordinary browser and supplies the separate library exercise input.
- Guide images use the same Star/Flame fixture; a short preflight checklist was added. The video script uses the correct separate library import instead of assuming browser/OBS project synchronization.

The three practice file hashes, core App, project schema, storage keys and dependencies are unchanged. Only populated-library placeholder rendering, copy, guide assets and tutorial/script instructions change.

## Local checks

Asset checks, ESLint and all 23 existing tests passed. The first build attempt hit a filesystem sandbox permission failure in the candidate's generated dist folder; a scoped build with the verified candidate output path passed. The guide consistency check passed 31 resources, sample schema/team/player consistency, inline JavaScript syntax and absence of private preview access text.

Formal production and the frozen fallback were not changed by this round. Real OBS evidence remains attributed to the earlier native acceptance and fallback rehearsal.
