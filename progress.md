# Polar CNC Plotter: progress

## START HERE
Last updated 2026-10-16. Read `CLAUDE.md` (what the project is, file map, how to test), then this
file. The README is the public showcase; its Status section is Tim's own words about the machine.

## Goal right now
Get the motors moving. 2026-10-24: Tim connected the app; jogs did nothing. Claude talked to GRBL
directly on COM3 (PowerShell SerialPort, app disconnected first): Idle, no alarm, GRBL 1.1h, and
jogs X±5 / Y±10 ran to completion per GRBL's own position reports. Tim: nothing moved, no sound,
driver heat sinks warm. Suspect the 12 V **0.5 A** supply (too weak for 2 steppers + pen lifter);
Tim is looking for a bigger one. Also: EEPROM holds GRBL factory defaults ($100-102 = 250), so
calibration must be redone once motors move.

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
- Claude can reach the plotter itself: COM3 at 115200 via PowerShell `System.IO.Ports.SerialPort`,
  but only while the browser app is disconnected ("Access denied" otherwise). Ask Tim before moving it.
- The app hides r/θ until Set center, so before that you can't see whether a jog registered.

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
