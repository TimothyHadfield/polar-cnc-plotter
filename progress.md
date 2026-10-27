# Polar CNC Plotter: progress

## START HERE
Last updated 2026-10-25. Read `CLAUDE.md` (what the project is, file map, how to test), then this
file. The README is the public showcase; its Status section is Tim's own words about the machine.

## Goal right now
Get the motors moving. 2026-10-24: Tim connected the app; jogs did nothing. Claude talked to GRBL
directly on COM3 (PowerShell SerialPort, app disconnected first): Idle, no alarm, GRBL 1.1h, and
jogs X±5 / Y±10 ran to completion per GRBL's own position reports. Tim: nothing moved, no sound,
driver heat sinks warm. Suspect the 12 V **0.5 A** supply (too weak for 2 steppers + pen lifter);
Tim is looking for a bigger one. Also: EEPROM holds GRBL factory defaults ($100-102 = 250), so
calibration must be redone once motors move.
Later 2026-10-24: new 12 V 5 A supply on the shield's screw terminal (12.5 V measured, 5 V pin 4.5 V)
changed nothing; motors loose even with `$1=255` (set for the hand test, restored to `$1=25` at
end of session). Drivers are **TMC2209** (not A4988): knob Vref target ~1.0 V X/Y, ~0.3 V Z
(I ≈ 0.71·Vref). Found by meter: drivers were plugged in **rotated 180°**; Tim flipped them, then
motors held. One driver smoked (probe/screwdriver slip shorted pins) and was replaced with a spare.
Arduino survived. Tim swapped the two middle wires of the X and Y motor plugs (were black, blue,
green, red).

**State at end of 2026-10-24 (Tim took a break):** Vref X 1.3 V, Y 0.4 V, Z 0.4 V. Watched test
(X ±8, Y ±90 jogs): **carriage (X) shakes back and forth** instead of moving, both before and after
the middle-wire swap; **platter (Y) doesn't move**; Z untested.
**Next session, in order:** (1) power off, Ω-test each motor's wires to find the real coil pairs
(few Ω = pair, OL = not) and put one pair on plug pins 1-2, the other on 3-4. Don't trust colours:
the swap didn't fix X. If one coil reads OL on every combination, a wire/coil is broken.
(2) Y Vref to ~1.0 V (0.4 V ≈ 0.28 A is weak for the platter). (3) Rerun watched test; ask Tim
"ready" in the question box first, keep jogs small since steps/mm are factory 250. (4) Then the
app's Calibrate tool. Safety: never plug/unplug motors powered; probe only the knob top.
**2026-10-26:** Tim reported Vrefs 1.0 / 1.2 / 1.3 V (didn't say which driver). Told him: fine for
the two NEMA 17s (≤0.92 A rms of 1.5 A), but whichever is the Z (micro stage, 100-300 mA) must go
to ~0.3 V. Then set: **X 1.0 V, Y 1.0 V, Z 0.3 V** (Tim). Ω-test results still not reported; no
serial port present at that time (USB unplugged). Later Tim plugged USB straight into the laptop
(same cable as before): still no device at all, no PnP event since 2026-10-24 12:36 (the smoke day).
Suspect the Uno's USB polyfuse / 16U2 or a 5 V short on the shield; asked Tim for ON/L LED state
with USB only, then with the shield off.
**Found 2026-10-26 (Tim's meter, unpowered, shield 5V-GND):** shield off -> Uno fine (COM3 seen).
All drivers in: 4 Ω (USB fuse tripped, ON LED on then off). No drivers: OL (shield OK). Z alone
2.3 kΩ (good). **X driver dead (4 Ω)** -> replaced with the last spare TMC2209, Z+X 2.2 kΩ.
**Y driver damaged (44 Ω)**: no TMC2209 spares left. Plan given to Tim: move the good Z TMC2209 to
Y, red A4988 on Z (Vref for 0.2 A: R100 0.16 V / R050 0.08 V / R200 0.32 V; Z direction and
steps/mm may change, fix in Calibrate). The bad drivers likely explain X shaking and Y not moving.
**Next at the machine:** finish that swap, re-measure 5V-GND (kΩ), Ω-test coil pairs of X and Y
(Tim swapped the middle wires on 10-24, so the order may now be wrong), USB + 12 V, set Vrefs
(X/Y TMC 1.0 V), then tiny jogs after Tim says "ready".
**2026-10-27 done:** swap done (X new TMC, Y = old Z TMC, Z = red A4988 at 0.08 V, unknown Rs), both
NEMA plugs were red-blue-green-black with coils red-green / blue-black -> middle wires swapped on
both. Claude on COM3 (GRBL 1.1h, Idle, $100-102 = 250): X±2, Y±1, Y±10 all completed per GRBL,
**Tim: nothing moved, no sound.** With `$1=255` X and Y hold stiff (Z loose) -> power, enable,
coils OK; step pulses not reaching the drivers. Suspect shield seated one pin off on the Uno
(reseated today) or bent pins. `$1` restored to 25.
Upgrade parts built 2026-10-26 by builders (Tim: "send sub-agents to work on the other tasks"),
merged: platter_hub + motor_stand (direct drive; platter ~23 mm higher, check clearance),
motor_plate 2 mm recess (+1 mm pad, screws 1 mm longer), pulley_m3 + idler_washer (M3 x 25 bolt),
big_pulley_gt2 (true GT2 60T), paper_ring (magnets need 8; tape version free). Details in
docs/components.md §7. Build-guide assembly NOT updated for these.
Also 2026-10-26: carriage plate got a 1.5 mm pocket for the micro linear stage (3fed47d); build
guide electronics redrawn from Tim's photos (blue Uno, red shield, yellow sockets, blue heat sinks,
Z lead brown/red/orange/yellow, A slot empty).

## Status
| Area | State |
|---|---|
| Site icon (tab + iPhone home screen) | Added 2026-10-17: polar arm with a red pen dot on the app's blue; `icon.svg` + `apple-touch-icon.png` |
| Machine (mechanics, wiring, GRBL, calibration) | Built (per README) |
| Plotter app | Live on GitHub Pages, all node tests pass |
| Real drawings with the app | NOT verified (needs Tim at the machine) |
| 2026-10-16 sweep | Bug fixes + handoff files, see Decisions |

## CAD (started 2026-10-25)
Tim's TinkerCad print plate (`Downloads/Polar Potter Custom.stl`, 16 bodies) is redrawn as
modules in `cad/plotter-parts.scad` (laid out where they sat on his plate; `part=` shows one).
Checked per part against the original mesh (volume within 0.2%, except bracket -1.5%; teeth are
measured one-tooth profiles, rotated slightly vs original). Deliberate changes: NEMA screw holes
3.0 -> 3.4; peg caps attached (`cap_gap`, original floated 0.33 mm = mid-air print); a 0.1 mm
sliver body and a 0.09 mm disk on one pulley dropped. OpenSCAD 2021.01 installed (winget); Tim
watches with Design -> Automatic Reload and Preview. Headless render: `openscad -o x.png`.
Scratch Python env with trimesh: `C:/Users/timha/AppData/Local/Temp/claude/venv3d`.

## Components reference (2026-10-25)
[docs/components.md](docs/components.md): every part (original guide, Tim's bought/salvaged parts,
printed parts) with its job, measured findings (big 60T pulley is NOT GT2 pitch: 2.09 vs 2.00 mm),
expected `$100-102`, improvement ideas and open questions for Tim.

## 3D build guide (built 2026-10-25)
Tim: "assume everything I have is identical to what the instructables describes ... steps for each
part with only the items in each step shown. Add all approriate links ... so a user can only use
this singular cite as all instructions". Live at `build.html` (linked "Build guide" in the app
header). Read as: guide's layout + Tim's bought parts (Amazon list) + Tim's printed parts.
- `cad/plotter-assembly.scad` = whole machine, one `show("name")` per part; positions not measured
  on the real machine are approximate. `tools/make-build-model.py` (venv
  `C:/Users/timha/AppData/Local/Temp/claude/venv3d`, trimesh) -> `build/plotter.glb` + `build/stl/`.
- `js/build-steps.js` = all wording, parts, links (edit here); `js/build.js` = three.js 0.160 viewer.
- Amazon search links (no exact listing found): TMC2209 5-pack, spiral wrap, 12 V supply. Gmail
  connector needed re-auth, so Tim's order links weren't pulled.
- Choices Tim didn't make: page title "Build the Plotter", step list/wording, colours, tap-a-part
  highlight, "Build guide" link placement.
- Realism + tap-to-select round (2026-10-25). Tim: "be able to select the actual items and have it
  be highlighted and have a description of it pulled up" + "work really hard to make everything look
  like it does in real life". Multi-colour parts are split into GLB pieces `<part>__<piece>`
  (SCAD `sub=` + `piece()`; materials in `MATS` in the exporter, sRGB->linear). `js/build-look.js`
  paints textures (wood, PLA layer lines, STEPPERONLINE label, red rose drawing on the paper), studio
  environment, and adds wires + paper clips. Tap a part (or list row) -> blue glow + card with
  `about` text (`PARTS[k].about` in build-steps.js). X motor now in front of the right stand as in
  `docs/photos/`. Verified: phone-view WebKit 393px + 1440px, tap -> "Marker pen" card, all 10 steps
  render, no console errors.
- X belt fix (Tim, 2026-10-25): "pully nearly directly under the two metel bars ... bottom side of
  the belt is wrapped around and zip tied to the two little poles on the pen carraige". Belt plane
  now = rod plane (`belt_y = rod_y`), lower run cut and looped round the carriage pegs with zip
  ties (`open_belt`, pieces `x_belt__belt` / `x_belt__ties`); idler axle added as his cut nail +
  tape (`idler_axle`). Step 5 also shows the carriage plate so the pegs are visible.
- Tim asked for better designs for the idler axle and the platter drive: suggestions recorded in
  `docs/components.md` §7 (bearing idler on an M3 bolt; direct-drive platter). Not built.
- Choices Tim didn't make this round: colours/finishes, the rose drawing on the paper, card position
  (bottom-left of the 3D view), wire routing, the blue highlight colour.

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
- Build guide: assembly positions are reasoned from the guide photos, not measured; build-step
  wording not checked by Tim.

## Rejected / parked
- (none)
