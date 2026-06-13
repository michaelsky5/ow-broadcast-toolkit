# OWBT Web v0.1 Release Checklist

Use this checklist for the web release build. Keep UI changes frozen during this pass unless a blocker appears.

## Preflight

```bash
npm run check
```

This runs bundled asset validation, ESLint, and the production Vite build.

## Production Preview

```bash
npm run preview:web
```

Open:

```text
http://localhost:4173/
http://localhost:4173/#overlay
```

If the preview server selects a different port, use that origin for both routes.

## Smoke Test

- Enter the startup flow and accept the community usage notice.
- Open startup setup and confirm event identity, logo controls, theme color, output settings, Overlay URL, transparent overlay, and the preflight panel appear.
- Enter the Console and confirm Scene Selector, Workspace, Preview, Program, editor, Quick Actions, Real-Time Status, and Operation Log appear.
- Select a scene, press TAKE, and confirm Program updates.
- Set Scene Transition to Brand Stinger, press TAKE between two different scenes, and confirm the transition is visible.
- Open `/#overlay` and confirm it renders the current Program scene.
- Test Chinese event, team, short-name, player, caster, staff, map, title, and subtitle text across all broadcast scenes, including legacy FCOL outputs; confirm glyphs are not vertically cropped.
- Confirm Data Center remains visible in the primary Scene Selector and includes OCR plus JSON/CSV export entry points.
- Open Toolbox and confirm cover, matchup, result, assets, and scene PNG export modes are present.
- Open Console Settings and confirm language, startup workspace, log rows, hotkeys, transition settings, and desktop-only placeholders are present.

## Release Guardrails

- Do not crop, zoom, or stylize Preview / Program in a way that changes the faithful 16:9 output preview.
- Do not change the fixed broadcast visual system during release checks unless a bug blocks release.
- Keep Overlay output English-only for v0.1.
- Keep OCR / Data Center as a primary workflow, not a hidden tool.

## Static Hosting

- `vercel.json` uses `npm run build:web`, publishes `dist`, and rewrites paths to `/index.html`.
- `netlify.toml` uses `npm run build:web`, publishes `dist`, and redirects paths to `/index.html`.
- The OBS Overlay route uses the hash URL `/#overlay`, so static hosts do not need a separate `/overlay` route.

## Metadata And Icons

- Document title: `OWBT - Overwatch Broadcast Toolkit`.
- Manifest: `/site.webmanifest`.
- SVG favicon: `/owbt-mark.svg`.
- PNG favicons: `/favicon-16x16.png`, `/favicon-32x32.png`.
- PWA icons: `/icon-192.png`, `/icon-512.png`.
- Apple touch icon: `/apple-touch-icon.png`.

## Known Web Limitations

- The web app cannot read arbitrary local filesystem paths.
- Browser clipboard writes may fall back to showing the Overlay URL in a dialog when the browser blocks clipboard access.
- Full local asset roots, batch asset management, OBS scene export paths, and deeper filesystem workflows belong to the future Windows desktop version.
