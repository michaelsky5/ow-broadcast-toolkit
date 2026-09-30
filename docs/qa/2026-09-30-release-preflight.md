# Web release preflight — 2026-09-30

## Recorded targets and scope

The international production host is Vercel deployment `dpl_CgnKM37NwVi8YsVRmpLVy8EDhuPQ`; the mainland host is Tencent EdgeOne Makers project `makers-bnjuhuzmtewr`, production deployment `dptr1qpvwg9f`. Both were observed at source commit `0950bd15fbb7fd9a54d62a7cf392e3fc2e0de79a`, connected to the same repository and `main` branch. The source repository was confirmed public. Source-license policy was not changed.

The frozen public fallback remains independently deployed from `0950bd1`. Its retained source and Web archive SHA-256 values were rechecked against the recorded values; both matched.

## Mainland candidate build

The actual Tencent console created preview deployment `dpawc95jgmcv` for `97676aaa93e28c93c291afd68622d7231101096c`. It completed successfully in 33 seconds using Node.js 24.18.0, `npm ci` and `npm run build:web` (184 transformed modules). Its production domain was unchanged.

The install log reported five dependency findings: three high and two moderate. A current full audit reproduced them; `npm audit --omit=dev` reported zero runtime findings. The affected lockfile records were all development dependencies.

## Minimal dependency correction

| Indirect development dependency | Before | Patched version |
| --- | --- | --- |
| baseline-browser-mapping | 2.10.44 | 2.11.0 |
| brace-expansion | 5.0.7 | 5.0.12 |
| browserslist | 4.28.6 | 4.28.7 |
| nanoid | 3.3.16 | 3.3.18 |
| postcss | 8.5.20 | 8.5.23 |

Versions and integrity values were read from the official npm registry. The correction changes exactly these five existing development dependency records. `package.json`, framework versions, runtime dependency records, application sources, schemas, storage keys and practice files remain unchanged from the accepted candidate. A broad automated audit-fix result was inspected in an isolated copy, then replaced with this smaller correction to avoid unrelated browser-data and package updates.

The validated lockfile SHA-256 is `6F7F4D5728AFD41ECA325961EB71B7BEE2B8B01E34BC11229C9EEAF5727FA86A`.

## Local verification

Validation ran in an independent source extraction with its own installed dependencies. The original candidate's `node_modules` junction and the primary checkout were not changed. `npm ci --ignore-scripts`, asset checks, ESLint, all 23 tests, the production build and the full dependency audit passed. The final audit reported zero findings.

Every one of the 199 generated files was compared by SHA-256 against the accepted candidate build: zero changed, added or missing files. This supports reuse of the recorded application/OBS and tutorial evidence for the unchanged output. Hosted CI and deployments for the final commit must still be recorded separately in the PR and release record.

The older candidate source and Web archives were preserved as preparation artifacts; the final release must identify its own source commit and archive hashes. No merge, production promotion, source-license change, or video recording is established by this preflight record.

References: [Browserslist advisory](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [brace-expansion advisory](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [PostCSS advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [EdgeOne deployment documentation](https://edgeone.ai/document/173005620251889664).
