# OWBT - OW Community Broadcast Toolkit

OWBT is a broadcast console and overlay toolkit for Overwatch community tournaments.

It is built for small community events, campus cups, grassroots broadcasts, and volunteer operators who need a clean production workflow without building custom graphics from scratch.

## Product Positioning

OWBT is not a tournament registration system or a long-term league database. It is a one-stop broadcast toolkit for the actual production desk:

- Manage event identity, teams, players, casters, staff, maps, score, and theme.
- Preview scenes before sending them to Program.
- Capture a clean 16:9 Overlay route in OBS.
- Export static broadcast graphics such as cover, matchup, result, and scene PNGs.
- Configure community-owned assets such as event logos, team logos, sponsor logos, and sponsor media.
- Use Data Center and OCR-assisted capture for match stats workflows.

Fries Cup is only a sample style reference. OWBT is designed to be reusable for any Overwatch community event.

## Current Web Scope

The web version focuses on the core console:

- Startup setup
- Standalone team asset library for reusable teams, players, logos, and roster data
- A/B match package creation and transfer into the OBS control surface
- Current A/B matchup control
- Preview / Program operation
- Scene editing for live, match setup, roster, casters, break, media, show flow, and data outputs
- Data Center / OCR workflow
- Toolbox graphics and asset configuration
- Local browser autosave
- Project import and export through JSON files or copy/paste text

OWBT currently focuses on the web workflow. Local filesystem and deeper desktop integrations can be assessed separately after the web release is accepted.

## Scene Packages

- Core: Live HUD, Map Setup, Team Roster, and Caster Desk.
- Data Center: Match Stats, Player Data, MVP, OCR-assisted stat capture, and JSON/CSV stat export.
- Break Desk: Countdown and Technical Pause.
- Media: Highlight/lower-third media output and sponsor media.
- Show Flow: Up Next, Starting Five, Result, and Thanks.
- Toolbox: Stream cover, static matchup, static result, asset setup, and scene PNG export.

## Live URLs

```text
Console: https://owbt.fries-cup.com/
Team Library: https://owbt.fries-cup.com/#library
OBS Control: https://owbt.fries-cup.com/#control
Overlay: https://owbt.fries-cup.com/#overlay

Mainland China: https://owbt-cn.fries-cup.com/
Mainland OBS Control: https://owbt-cn.fries-cup.com/#control
Mainland Overlay: https://owbt-cn.fries-cup.com/#overlay
```

Use the Console and Overlay from the same origin. For example, the live Console should pair with the live Overlay above, and a local development Console should pair with `http://127.0.0.1:4174/#overlay`.

## Main Routes

```text
/           Console, setup, settings, and toolbox
/#library   Long-lived local team, player, logo, and match-package library
/#control   Direct OBS control surface for the current A/B matchup
/#overlay   Clean OBS Browser Source output
```

The Team Library and OBS Control routes are separate working surfaces that share the same OWBT project format. The Overlay renders the current Program state only and does not show editing UI.

## Send Teams Into OBS

1. In a regular browser, open the Team Library and select Team A and Team B.
2. Choose **Copy Match Package**. The complete text is always shown; use the copy button or Ctrl+A, Ctrl+C in the text box.
3. In the OBS custom browser dock at `/#control`, choose **Paste Match Package** and press Ctrl+V in the text box.
4. Choose **Preview Package**, review both teams and the refresh/swap/new-match impact, then confirm.
5. Press **TAKE** to send the scene to the Browser Source.

No JSON file picker is required for this transfer. To back up or restore the **entire project**, use Export/Import Project → Project Text instead. Team-library backups are separate.

Switching between international, mainland, and frozen stable hosts does not move browser data automatically. Back up the project and team library separately, and use one host for the OBS dock and Browser Source.

See [STABLE_WEB_FALLBACK.md](docs/STABLE_WEB_FALLBACK.md) for the frozen-version plan and public-link activation.

## Runtime Notes

- OWBT is a static Vite React app.
- Project state is saved in browser `localStorage`.
- Reusable team-library records are saved in browser IndexedDB and can be backed up as JSON.
- Match packages carry only the selected A/B teams and are validated before transfer into the control surface.
- Console and Overlay sync through same-origin browser storage/events and `BroadcastChannel` when available.
- Export the project as a JSON file or copied project text before clearing browser data or moving to another machine. Text mode works in OBS Browser Sources that cannot create download files.
- Uploaded assets are stored with the project as browser data URLs. URL assets can be used too, but same-origin or uploaded assets are safest for PNG export.
- The web app does not read arbitrary local filesystem paths; that workflow is reserved for the future Windows desktop version.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A modern Chromium-based browser is recommended for production operation and OBS Browser Source testing.

## Quick Start

Install dependencies:

```bash
npm install
```

Start development:

```bash
npm run dev
```

Open the Console:

```text
http://127.0.0.1:4174/
```

Open the Team Library or direct OBS Control surface:

```text
http://127.0.0.1:4174/#library
http://127.0.0.1:4174/#control
```

Open the Overlay:

```text
http://127.0.0.1:4174/#overlay
```

If Vite chooses another port, use the same origin shown in the startup setup screen.

## Production Build

Run the full preflight check:

```bash
npm run check
```

Build the web app:

```bash
npm run build:web
```

Preview the built site locally:

```bash
npm run preview:web
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): static hosting, Vercel, Netlify, and local production preview.
- [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md): web release smoke test and guardrails.
- [docs/UPDATE_NOTES.md](docs/UPDATE_NOTES.md): current release notes and validation history.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): machine-specific transition, storage, and browser checks.
- [docs/ASSETS.md](docs/ASSETS.md): bundled Overwatch asset conventions.

## OBS Setup

Add a Browser Source in OBS and use the Overlay URL:

```text
https://owbt.fries-cup.com/#overlay
```

Recommended Browser Source settings:

- Width: `1920`
- Height: `1080`
- Enable transparent background when using transparent overlay mode
- Use `3840 x 2160` instead if the project output is set to 4K
- Keep the Console open in a separate browser window or monitor
- Use TAKE to push Preview to Program
- If testing locally, use the same local origin as the Console, for example `http://127.0.0.1:4174/#overlay`

## Project Structure

```text
src/app          Console shell, startup flow, editors, settings, toolbox
src/overlay      OBS overlay route and program preview renderer
src/scenes       Broadcast scene components and scene registry
src/project      Project model, storage, sync, import/export helpers
src/match        Match defaults and match option data
src/team-library Reusable team library, CSV/JSON import, logo matching, and match packages
src/data         Built-in Overwatch data and asset path helpers
src/theme        Theme tokens and color utilities
scripts          Asset validation scripts
public           Static heroes, roster, maps, modes, and app assets
docs             Deployment, development notes, and asset conventions
```

## Script Reference

```bash
npm run dev
npm run build:web
npm run preview:web
npm run check:assets
npm run lint
npm run build
npm run check
```

`npm run check` runs asset validation, ESLint, the Node test suite, and a production build.

## Usage Notice

OWBT is made by michaelsky5 and provided free for Overwatch community tournament broadcasts.

OWBT is not an official Blizzard or Overwatch product and does not imply official authorization or endorsement.

Please keep the creator credit unless separate permission is granted. Do not resell, paywall, relicense, or redistribute it for profit. Permission and compliance for event logos, team logos, sponsor marks, gameplay footage, and other third-party assets are the user's responsibility.
