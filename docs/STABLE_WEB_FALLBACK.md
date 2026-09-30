# Frozen Web Fallback

The previous stable Web version is available at [owbt-stable.fries-cup.com](https://owbt-stable.fries-cup.com/). Keep the international and mainland sites as the primary entrances. Choosing this separate site does not roll back either primary deployment.

## Frozen baseline and deployment

- Source commit: `0950bd15fbb7fd9a54d62a7cf392e3fc2e0de79a`.
- Local baseline tag: `baseline/web-stable-20260930`.
- Original production deployment: `dpl_CgnKM37NwVi8YsVRmpLVy8EDhuPQ`.
- Separate Vercel project: `owbt-stable` (`prj_SNooa20BONU6ZSdGiS0UxDjNPgMv`).
- Frozen production deployment: `dpl_5dLkkh2tPATgHJLTu3vwpRQyRLWQ`, READY, uploaded static bundle (source `drop`). No Git integration or automatic deployment from main was attached.
- Public hostname: `https://owbt-stable.fries-cup.com/`.
- On 2026-09-30, the exact tracked source was archived and built independently, without changing the primary checkout. The web build passed with 181 transformed modules.
- Source ZIP SHA-256: `73FA02645C06F2774AFC541B01855E64DFE6DE299F8C7ED37247C6C802394E67`.
- Web ZIP SHA-256: `B1700EDA311D4ADD7AB88C89865F346200055639B7FC91BFB629B408988D1905`.

The ZIP artifacts are retained outside the repository. Do not overwrite the frozen bundle with a later build of main. The older protected deployment hostname requires Vercel access and is not the public fallback.

## Public and actual OBS acceptance on 2026-09-30

- Unsigned HTTPS reads matched all 189 deployed files byte for byte against the independently built baseline. The root was HTTP 200; canonical `/index.html` redirects to `/`.
- DNSPod contains one added CNAME for `owbt-stable`; the international and mainland records were not edited. The custom hostname served a valid HTTPS certificate.
- The operator imported a synthetic Chinese full-project text backup into an OBS 32.2.2 custom dock at `/#control`. The dedicated 1920 x 1080 Browser Source used `/#overlay` on the same hostname.
- Source refresh restored A's roster with the blue theme, logo, five Chinese player names, coach, and manager.
- B's roster subsequently reached the source directly after TAKE without another source refresh: orange theme, logo, five Chinese names, coach, and manager.
- The operator exported full-project text, changed the standby text, imported that backup, selected the standby scene, and TAKEd. The actual source recovered the original Chinese waiting text, including after source refresh. The intermediate temporary text was operator-reported, not independently captured.
- The first source sample after the initial roster operation still showed standby. Refresh and the explicit no-refresh B-side repeat above resolved the discrepancy. This does not establish its original cause or a persistent synchronization defect.
- Streaming and recording were inactive during all OBS API mutations. Existing FryDeck inputs were not edited. A full OBS process restart was not repeated for this host.

See [rehearsal evidence](./qa/2026-09-30-rehearsal.md). This verifies a core fallback workflow; it does not certify every old-version feature or compatibility with future project schemas.

## Candidate link and switching sites

Startup and System Settings include the verified public fallback by default. `VITE_OWBT_STABLE_URL` can override this public URL at build time; never use temporary authentication parameters. The frozen site's own old bundle is unchanged.

Separate hosts isolate localStorage and IndexedDB. Export the project and team library separately, import both into the destination, and change both the OBS dock and Browser Source to that host. Browser backups do not transfer automatically. Check the destination's actual TAKE and saved output before using it for a broadcast.

## Operational rollback

The original deployment rollback target remains recorded in [WEB_RELEASE_RUNBOOK.md](./WEB_RELEASE_RUNBOOK.md). Recheck the active deployment and browser-data backups before an authorized operator rollback.
