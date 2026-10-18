# Polar CNC Plotter: progress

## START HERE
Last updated 2026-10-16. Read `CLAUDE.md` (what the project is, file map, how to test), then this
file. The README is the public showcase; its Status section is Tim's own words about the machine.

## Goal right now
No active goal from Tim. The plotter app is built (SVG/picture/text/pattern -> polar G-code,
preview, USB plotting, calibration). Next real step is Tim testing it on the machine.

## Status
| Area | State |
|---|---|
| Site icon (tab + iPhone home screen) | Added 2026-10-17: polar arm with a red pen dot on the app's blue; `icon.svg` + `apple-touch-icon.png` |
| Machine (mechanics, wiring, GRBL, calibration) | Built (per README) |
| Plotter app | Live on GitHub Pages, all node tests pass |
| Real drawings with the app | NOT verified (needs Tim at the machine) |
| 2026-10-16 sweep | Bug fixes + handoff files, see Decisions |

## Authorized next steps
None.

## Standing instructions
- None recorded for this project yet (no quotes from Tim in the repo). Global rules apply.

## Traps
- Y axis is platter degrees, not mm (`$101` = steps per degree).
- Plot/resume tests use FakeGrbl with real timers: slow (minutes) and can time out on a busy machine.
- `svg.js`, `app.js` UI and `machine.js` are browser-only: verify with phone-view, not node.

## Decisions
- 2026-10-16 sweep: SVG hidden layers (`display:none` on a group, as Inkscape hides layers) are no
  longer plotted; a path cut short mid-command now stops there instead of making NaN G-code;
  Settings number boxes now keep to their own min/max (speed 0 and huge drawing widths were
  accepted); pasting a web address into the Text box now pastes it instead of fetching a picture;
  aria-labels on the console and calibrate inputs; blank favicon link to stop a 404.

## NOT verified
- Anything on the real plotter (USB streaming, pen changes, calibration steps) since 2026-09-29.
- Web Serial flows were only exercised with `?demo` (FakeGrbl).

## Rejected / parked
- (none)
