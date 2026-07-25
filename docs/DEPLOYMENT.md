# OWBT Web Deployment

OWBT builds as a static Vite app. The Console is served at `/`, and the OBS output is served through the hash route `/#overlay`.

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

The web app does not directly read arbitrary local filesystem paths. Use project import/export, browser-local storage, uploaded assets, and URL/data URL assets in the web version. Local asset roots, bulk path management, and OBS scene file paths are reserved for the future Windows desktop app.
