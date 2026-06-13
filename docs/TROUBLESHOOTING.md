# OWBT Troubleshooting

Use this note when a local browser build behaves differently from another machine.

## TAKE Has No Transition

Scene transitions are controlled by OWBT Console Settings, not by npm.

Check these first:

- Console Settings -> Scene Transition is `Simple Wipe` or `Brand Stinger`.
- Preview and Program are different scenes before pressing TAKE.
- The Overlay URL uses the same origin as the Console, for example `http://localhost:5173/#overlay`.
- Browser localStorage has not kept an old `No Transition` preference.

OWBT keeps TAKE transition output visible even when the operating system or browser reports `prefers-reduced-motion: reduce`. Reduced motion may still disable small scene resolve motion, but it should not hide the transition layer.

Each TAKE also carries a transition trigger, so the transition should run even when Preview and Program use the same scene but the scene content changed.

If `Transition Logo` is set to `Event Logo`, the event logo layer only appears when the project has an event logo or organizer logo configured. With no event logo configured, the Brand Stinger line animation still runs, but no event logo plate is rendered.

## Chinese Text Looks Cropped

Broadcast scenes use fixed 1920x1080 layouts and bold display text. When testing a release, include Chinese event names, team names, short names, player names, caster names, staff names, map names, titles, and subtitles across all broadcast outputs:

- Roster
- Matchup
- Starting Five
- Countdown
- Result
- Thanks
- Opening
- Pause
- Casters / Staff
- MVP
- Stats
- Team Data
- Media lower-thirds
- Legacy FCOL scenes, including HUD, Begin Info, Ban Phase, Map Pool, and Starting Lineup

If text is too long for a fixed slot, it should ellipsize or scale within the slot. It should not clip the top or bottom of Chinese characters.

## Useful Browser Checks

Run these in the browser console when diagnosing a machine-specific report:

```js
matchMedia('(prefers-reduced-motion: reduce)').matches
localStorage.getItem('owbt-console-settings-v1')
```

If transition settings look stale, reset Console Settings or clear the `owbt-console-settings-v1` localStorage entry.
