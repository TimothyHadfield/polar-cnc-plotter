# Polar CNC Plotter: progress (handoff for Claude)

## START HERE
_Last updated 2026-10-27. For Claude only; Tim doesn't read this. Catch-up authorizes nothing: only
"Authorized next steps" below is approved work._
1. Read `CLAUDE.md` (project, file map, tests), then this file.
2. Skim the last entries of `chat.md`. Full machine-debug narrative 10-24..10-27 and older detail:
   `docs/archive/progress-2026-10-27.md`.
3. Parts, settings formulas, upgrade parts: `docs/components.md` (§3 bought parts, §6 expected `$`
   settings + Vref, §7 improvements incl. what the builders made 2026-10-26).

## Goal right now
Get all three axes moving, then run the app's Calibrate tool. **X (carriage) works.** Y (platter)
and Z (pen lift) don't. Tim is debugging at the machine with his multimeter; Claude guides.

**Machine state at end of 2026-10-27 (Tim's reports, not seen by Claude):**
- Coil order fixed: both NEMA plugs were red-blue-green-black, coils red-green / blue-black, so the
  middle wires were swapped. Carriage works on X. **Platter motor on the X header: turns smoothly**
  after its middle wires were swapped (before that: glitchy back and forth).
- **The Y channel sends nothing:** carriage motor on the Y header doesn't move; platter on Y doesn't
  move whatever the wire order. Motors hold stiff with `$1=255` (seen 10-27 morning), so enable +
  12 V reach the drivers; step pulses apparently don't reach Y (and Z).
- **Last test, result unclear:** motors back on their own headers -> carriage jerky, platter
  nothing. Not known whether Tim had also swapped the X and Y drivers (Claude asked; Tim
  interrupted to checkpoint). **Ask him first.**
  - Drivers swapped: the old Y driver is weak/bad (jerky on X) AND the Y slot is dead.
  - Not swapped: the carriage got jerky for another reason (recheck its wire order/seating).
- Drivers left after triage (Tim's meter, same two points on each driver: good black ~8 kΩ, good red
  ~13 kΩ; low Ω = shorted, binned): 2 good black TMC2209 + 1 red A4988, all in use, **no spares**.
  A black reading 3 kΩ made the Uno drop off USB, so it was swapped for the red (slot not recorded).
  Vref: TMC2209 X/Y 1.0 V, Z 0.3 V (I ≈ 0.71·Vref); red A4988 on Z 0.08-0.10 V, on Y ~0.6 V
  (I = Vref/(8·Rs), Rs unreadable, assume R100).
- GRBL 1.1h, EEPROM still factory (`$100-102` = 250), `$1=25` (restored).

**Next at the machine, in order:**
1. Ask Tim whether the drivers were swapped in the last test.
2. Driver vs slot: a driver that works on X goes in the Y slot.
3. If the Y slot is dead: is it the shield socket (then clone Y onto the **A slot** with its 2
   jumpers; check the jumper layout from a photo first) or the Uno's D3/D6? A clone can't fix a
   dead Uno pin. A new shield/Uno is ~$10-15 = Tim's call (money).
4. Z: same check, then Ω-test its 4 wires (expect ~10-40 Ω per coil), smallest jogs (factory
   `$102` = 250 is too fast for the 20 step/rev stage).
5. Then Calibrate (`$100` ≈ 100, `$101` ≈ 26.67 belt / 8.89 direct drive, at 1/16).

## Status
| Area | State | Notes |
|---|---|---|
| Plotter app | live | node tests: see Map |
| Machine X axis | works (Tim, 10-27) | uncalibrated |
| Machine Y / Z | not moving | Y channel (driver or slot) suspected; see Goal |
| 3D build guide `build.html` | live | electronics redrawn from Tim's photos 10-26; upgrade parts NOT shown in it |
| Carriage plate pocket for micro stage | live STL (3fed47d) | 81.9 x 25.5 x 1.5 mm; Tim to caliper the stage |
| Upgrade parts (builders, 10-26) | STLs merged | platter_hub, motor_stand, motor_plate 2 mm recess, pulley_m3 + idler_washer, big_pulley_gt2, paper_ring; nothing printed or fitted |
| Real drawings with the app | NOT verified | needs a working machine |

## Authorized next steps
- 2026-10-26 · "send sub-agents to work on the other tasks" (done: upgrade parts merged).
- 2026-10-27 · Moving the machine with tiny jogs from Claude's serial session, after a "ready" in
  the question box each time.

## Standing instructions (Tim's words)
- "replace my current pen holder with the nicer one I desigend and bought" (the micro linear
  stage) + "make the arduino and shield V3 and motor drivers in the 3D model look nearly identical
  to what they actually look like" (done 10-26).
- Global rules apply (`~/.claude/CLAUDE.md`).

## Traps
- **Power off = 12 V AND USB unplugged** before touching drivers or motor plugs. USB alone powers
  the drivers' 5 V logic. Tim unplugged a motor while powered once (10-27) and misinserted a driver
  one pin row off (it died).
- A shorted driver pulls the shield's 5V-GND down to a few Ω, trips the Uno's USB polyfuse (ON LED
  on, then off), and the laptop sees no COM port at all. Find it by measuring 5V-GND with drivers
  added one at a time.
- Clicking from the NEMAs on any jog (even Z) = GRBL re-enabling all drivers (`$1=25`). Harmless.
- Y axis is platter degrees, not mm (`$101` = steps per degree).
- Claude can drive the plotter: COM3 at 115200 via PowerShell `System.IO.Ports.SerialPort`, only
  while the browser app is disconnected. Opening the port resets the Uno: wait ~2.5 s. Ask Tim
  "ready" in the question box before any move.
- Plot/resume tests use FakeGrbl with real timers: slow and can time out on a busy machine.
- `svg.js`, `app.js` UI and `machine.js` are browser-only: verify with phone-view, not node.
- The app hides r/θ until Set center, so before that you can't see whether a jog registered.
- Model rebuild (`tools/make-build-model.py`) rewrites every STL in `build/stl`; `git checkout --`
  the ones you didn't change. OpenSCAD from PowerShell needs `-D 'part=\"x\"'`.
- Worktree folders under `C:/Users/timha/AppData/Local/Temp/claude/wt/` can't always be removed
  (Permission denied); the weekly sweep handles them.

## Decisions
- D1 · 2026-10-16 · sweep: hidden SVG layers not plotted; a cut-short path stops instead of NaN
  G-code; Settings number boxes clamp; pasting a URL in Text pastes it; aria-labels; blank favicon.
- D2 · 2026-10-25 · 3D build guide = original guide's layout + Tim's bought + printed parts;
  multi-colour parts as GLB pieces `<part>__<piece>`, materials in `MATS`.
- D3 · 2026-10-25 · X belt in the rod plane, lower run zip-tied round the carriage pegs, nail idler.
- D4 · 2026-10-26 · carriage plate pocket 1.5 mm deep, plate +1 mm on that face, sizes from the
  VXB/Amazon listing (81.3 x 24.9) + 0.3 mm clearance per side.
- D5 · 2026-10-26 · recommended direct-drive platter (hub on the NEMA shaft, motor stands on the
  board) and an M3-bolt idler; platter ends ~23 mm higher (clearance unchecked).
- D6 · 2026-10-27 · red A4988 goes on Z (least demanding axis); TMC2209s on X/Y.

## NOT verified
- Anything about the real machine is Tim's report; Claude only sees GRBL's replies.
- Build guide assembly positions are reasoned from photos, not measured; step wording not checked
  by Tim.
- Upgrade-part fits (shaft flat, bore on M3, magnet press-fit, GT2 seating, platter clearance).
- Web Serial flows only exercised with `?demo` (FakeGrbl).

## Rejected / parked
- ~~Short NEMA motors~~ · 2026-10-25 · with direct drive keep the 42 Ncm motors (details §7).

## Map
- App: `index.html`, `js/*.js` (see CLAUDE.md). Build guide: `build.html`, `js/build*.js`,
  `cad/plotter-assembly.scad` -> `tools/make-build-model.py` -> `build/plotter.glb`.
- Printed parts: `cad/plotter-parts.scad` -> `build/stl/*.stl`. Parts reference: `docs/components.md`.
- Tests: `node --test tests/*.test.mjs` · last run 2026-10-27: 96 passed / 0 failed (54 s)
- Live: https://timothyhadfield.github.io/polar-cnc-plotter/ (`build.html` = guide) · GitHub Pages
  from `main`; every push redeploys.
- Python venv for the model: `C:/Users/timha/AppData/Local/Temp/claude/venv3d`.
