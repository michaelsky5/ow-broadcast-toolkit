# OWBT Web Deployment

OWBT builds as a Vite app. The Console is served at `/`, and the OBS output is served through the hash route `/#overlay`. Vercel deployments can additionally enable the optional HTTPS Session Function used by cross-browser OBS URLs.

## Preflight

Run this before deploying:

```bash
npm run check
```

This verifies bundled Overwatch assets, runs ESLint and the Node test suite, and creates a production build.

For the full web release pass, follow [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## Build

```bash
npm run build:web
```

The generated static files are written to `dist/`.

## Local Production Preview

```bash
npm run preview:web
```

Then open:

```text
http://localhost:4173/
http://localhost:4173/#overlay
```

## Vercel

The repository includes `vercel.json`.

Recommended settings:

- Framework Preset: Vite
- Build Command: `npm run build:web`
- Output Directory: `dist`

### Online OBS Session storage

`复制在线 OBS URL` stays unavailable until both server-only variables are configured:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Use a dedicated Upstash Redis database. Never expose the token through a `VITE_` variable. The Function intentionally returns `503 SESSION_STORE_UNAVAILABLE` when these variables are absent; it has no in-memory or Runtime Cache fallback.

Before enabling the variables in Production, add a Vercel WAF rate-limit rule for `/api/session/*` (for example, 600 requests per minute per IP with a 429 action). The API also limits new Session creation to 60 per network per day, but the edge rule is still required to stop abusive requests before they invoke a Function or Redis.

After deployment, verify the real Vercel route rather than only unit tests:

1. A GET with a random 64-hex ID returns `404` (or `503` before storage is configured), never `index.html`.
2. A same-origin PUT creates a Session and returns a positive integer `revision`.
3. A GET using that returned revision in both `?revision=<revision>` and `If-None-Match: "<revision>"` returns `304` without the project payload.
4. A second PUT advances the revision atomically.

## Netlify

The repository includes `netlify.toml`.

Recommended settings:

- Build Command: `npm run build:web`
- Publish Directory: `dist`

## Static Hosting

Any static host can serve the `dist/` folder. If the host supports SPA fallback, route unknown paths to `/index.html`.

The Overlay uses a hash route, so the OBS URL should keep the hash:

```text
https://your-domain.example/#overlay
```

## Web Limitations

The web app does not directly read arbitrary local filesystem paths. Use project import/export, browser-local storage, compressed image uploads, and HTTPS asset URLs in the web version. Local video files and Data/Blob video URLs are intentionally blocked because they cannot be persisted safely. Local asset roots, bulk path management, and OBS scene file paths are reserved for the future Windows desktop app.
