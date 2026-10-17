# Event roster limit release preflight

Release: v0.2.3. Candidate starts from production main `13e99a673f4a16d5f0a830bc2b15a5b70bf0f9af`, preserving the existing OCR, clipboard, save-feedback, and Season 5 changes.

## Review and behavior

- Event projects store a roster limit from 5 to 12, defaulting to 7 for new and legacy projects. Starting lineups remain independently limited to five.
- Manual entry follows the event limit. Library normalization, duplicate merges, CSV/JSON imports, backups, project exports, and match packages retain complete rosters.
- Lowering the limit preserves players and saved output selections. Existing players remain editable; output uses the current limit and shows an over-limit warning. Raising the limit restores previously saved selections unless the operator has edited that selection.
- Review found that a five-player limit blocked every output change because both minimum and maximum were five. Inactive players now have a replacement action that replaces the last output player. A regression test covers the boundary and rejects invalid IDs.
- Eight-player output uses one row; nine to twelve use two rows.

## Local validation

- Asset validation and full ESLint passed in the isolated candidate checkout.
- All 56 tests passed, including eight roster and transfer tests and the existing OCR, clipboard, and save-feedback regressions.
- Production Vite build passed. The sandbox initially denied resolving the existing OCR worker's real path; rerunning the unchanged build with filesystem access succeeded.
- Browser validation at `http://127.0.0.1:4197/` used fictional Release Team A/B data. Both eight-player teams loaded from a match package; each retained a five-player starting lineup.
- Saving both project teams to the actual team library produced two teams and sixteen players. The library editor showed `8 / 8`, retained the eighth member, and generated a complete A/B match-package text containing all sixteen players.
- Eight selected players appeared in Preview, Program after TAKE, and the separate `/#overlay` browser tab. The 1920 by 1080 scene scaled within the observed 1699 by 888 browser viewport without page overflow; all eight cards were visible.
- Lowering to five left all eight editable rows, displayed the warning, and enabled replacement of the fifth output slot with player eight. Restoring eight allowed all players to be selected again.
- Browser console reported no warnings or errors during the checked candidate flow.
- Earlier local feature validation also covered manual eighth-player entry, CSV import, project text restore, limit 7 to 8 recovery, twelve-player layout, and refresh persistence.

This is local browser and automated evidence. Actual OBS dock/source acceptance for the new eight-player scenario has not been performed. Existing unchanged core OBS acceptance remains recorded in the September 30 QA documents.

## Production baseline and remaining release gates

- International production: Vercel `dpl_D1X9QCJGN3vqY1kaoD9fFmXeTzsn`, READY, source `13e99a673f4a16d5f0a830bc2b15a5b70bf0f9af`.
- Mainland production: `https://owbt-cn.fries-cup.com/` and `/feedback/` returned HTTP 200; feedback identified `OWBT v0.2.2`. Main entry asset was `/assets/index-C-b8BhqC.js`.
- The Tencent console requires interactive sign-in, so its current deployment ID and rollback action were not independently inspected in this session. The previous main commit remains available in Git for a source-based recovery on both automatic deployment targets.
- Before merge, require both candidate OS checks and a READY Vercel preview matching the candidate SHA. Then verify main CI and each formal host independently, including released version and application assets. Record final deployment evidence in the PR/release result.
- The frozen stable fallback is a separate deployment and is excluded from this release.
