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
- Current A/B matchup control
- Preview / Program operation
- Basic scene editing
- Data Center / OCR workflow
- Toolbox graphics and asset configuration
- Local browser autosave
- Project import and export

The future Windows desktop version can unlock local filesystem paths, larger asset libraries, OBS scene file export, and deeper production workflows.

## Main Routes

```text
/           Console, setup, settings, and toolbox
/#overlay   Clean OBS Browser Source output
```

The Overlay renders the current Program state only. It does not show editing UI.

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
http://localhost:5173/
```

Open the Overlay:

```text
http://localhost:5173/#overlay
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

Deployment notes are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
The release checklist is in [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
Machine-specific behavior notes are in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## OBS Setup

Add a Browser Source in OBS and use the Overlay URL:

```text
http://localhost:5173/#overlay
```

Recommended Browser Source settings:

- Width: `1920`
- Height: `1080`
- Enable transparent background when using transparent overlay mode
- Keep the Console open in a separate browser window or monitor
- Use TAKE to push Preview to Program

## Project Structure

```text
src/app          Console shell, startup flow, editors, settings, toolbox
src/overlay      OBS overlay route and program preview renderer
src/scenes       Broadcast scene components and scene registry
src/project      Project model, storage, sync, import/export helpers
src/match        Match defaults and match option data
src/data         Built-in Overwatch data and asset path helpers
src/theme        Theme tokens and color utilities
public           Static heroes, roster, maps, modes, and app assets
docs             Deployment, development notes, and asset conventions
```

## Checks

```bash
npm run check:assets
npm run lint
npm run build
```

`npm run check` runs all three.

## Usage Notice

OWBT is made by michaelsky5 and provided free for Overwatch community tournament broadcasts.

Please keep the creator credit unless separate permission is granted. Do not resell, paywall, relicense, or redistribute it for profit.
