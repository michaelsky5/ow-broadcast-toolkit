# Frozen Web Fallback

The proposed user-facing fallback is a separate site at `https://owbt-stable.fries-cup.com/`. This is a proposal, not a currently verified public endpoint. Keep the normal international and mainland sites as the primary entrances.

## Frozen baseline

- Source commit: `0950bd15fbb7fd9a54d62a7cf392e3fc2e0de79a`.
- Local baseline tag: `baseline/web-stable-20260930`.
- Existing production deployment: `dpl_CgnKM37NwVi8YsVRmpLVy8EDhuPQ`.
- The fixed deployment hostname currently redirects a signed-out visitor to Vercel login. It cannot be advertised as a public fallback link.
- On 2026-09-30, the exact tracked source was archived and built independently, without changing the primary checkout. The web build passed with 181 transformed modules.
- Source ZIP SHA-256: `73FA02645C06F2774AFC541B01855E64DFE6DE299F8C7ED37247C6C802394E67`.
- Web ZIP SHA-256: `B1700EDA311D4ADD7AB88C89865F346200055639B7FC91BFB629B408988D1905`.

The ZIP artifacts are retained outside the repository. Do not commit the generated bundle or overwrite it with a later build of main.

## Publish the separate fallback

1. Deploy only the frozen source or verified static bundle to a separate hosting project. Do not attach automatic deployment from main.
2. Bind the chosen stable hostname and verify HTTPS plus signed-out access to `/`, `/#control`, and `/#overlay`.
3. Verify a test project, dock-to-source TAKE, refresh, and text-backup restore on that host.
4. Only after those checks, set `VITE_OWBT_STABLE_URL=https://owbt-stable.fries-cup.com/` for the new candidate's build. The Startup and System Settings link is otherwise hidden. This variable is public; use a clean public URL without temporary authentication parameters.

Separate hosts isolate localStorage and IndexedDB. Switching sites requires explicit data transfer: export the project and team library separately, import them into the destination, and change both the OBS dock and Browser Source to that host. Do not promise automatic migration or future schema compatibility.

## Operational rollback

The existing deployment rollback target remains available to the operator as recorded in [WEB_RELEASE_RUNBOOK.md](./WEB_RELEASE_RUNBOOK.md). A user selecting the frozen site does not roll back the main production deployment.
