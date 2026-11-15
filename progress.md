# Polar CNC Plotter: progress (handoff for Claude)

## START HERE
_Last updated 2026-11-15 (checkpoint after the V3 + software waves). For Claude only; Tim doesn't read
this. Catch-up authorizes nothing: only "Authorized next steps" below is approved work._
1. Read `CLAUDE.md` (project, file map incl. V3 + new modules, tests), then this file.
2. `docs/upgrades-plan.md` = V3 world frame + interfaces I1–I7 (read before touching any cad/ file).
3. Last entries of `chat.md`. Full history before 11-15 (CALIBRATE 1–4, SAFEGUARDS, DEFAULTS,
   BASE 2, PRINT ISSUES, collar/ring/stands 2, ATTACHMENTS, ENGINEERING REVIEW, the 11-14 Monday
   list as it was): `docs/archive/progress-2026-11-15.md` (search those words). Older:
   `docs/archive/progress-2026-10-27.md` and the other files in `docs/archive/`. Parts + `$`
   formulas: `docs/components.md`.

## Goal right now
**2026-11-15: V3 hardware + the software wave are built and live; the app layout redesign builder
(`up-look`, worktree `.../wt/polar-cnc-plotter-look`) is running.** When it reports: merge, run
tests + sim.html ?v=1/?v=2 + check-calibrate/connect, push, tell Tim with screenshots and the list
of visual choices (his call). Then give Tim the Monday list when he's back at the plotter (Mon 11-16).

**TIM'S MONDAY LIST** (Tim 11-14: "I'm not gonna see my plotter until monday so keep track of all
the things I need to do when I'm back there as well as prints that need to be printed"). Tick as he
reports. V3 supersedes the 11-14 stands 2 / pen-holder plans (old list in the archive).
- Prints, in this order: [ ] base 2 (started 11-14, check it finished) · [ ] plate5 ring 2 +
  collar 3 (32 min) · [ ] **plate9t + plate11t fit tests first** (53 + 14 min) · [ ] plate3 stands
  (stands 3 + tray pockets, 4 h 22 / 204 g) · [ ] plate9 carriage 2 (53 min / 31 g) · [ ] plate10 pen
  head (1 h 27 / 36 g) · [ ] plate8 tray + chain (2 h 23 / 84 g) · [ ] plate11 switch + cover
  (44 min / 27 g) · [ ] plate4 wheel 2 (optional). All in `build/print/`; V3 guide totals ~17 h 20 / 710 g.
- Measure (all ASSUMED in the scad files; fit tests cover most): [ ] SC8UU height 34 / length 30 /
  M4 spacing 18×24 / profile · [ ] stage depth 10, end caps 4, motor Ø15, bump 6×1.5 · [ ] slider
  25×14, 10 proud · [ ] every pen's diameter 10–20 mm above the tip (collets 8–16) · [ ] microswitch
  20×10×6.4, holes Ø2.3 9.5 apart · [ ] heatsink height ≤ 23.5 above the shield · [ ] idler width ·
  [ ] band thickness · [ ] motor shaft length (23.5 assumed).
- Buy (his call, $): microswitch (~$1–5) for homing.
- Assemble/test: follow build.html **V3** tab · homing switch to X− endstop pins (D9; C→GND,
  NO→signal), Settings → Homing switch on, Calibrate → Find center → Measure · Pen press ~1.5 mm then
  Pen height · Calibrate 6 Speed test, 7 Photo check · **Fine test** (decides microsteps / gear
  reduction) · first real drawing.

## Status
| Area | State | Notes |
|---|---|---|
| Plotter app | live d81d66e+ | Test drawing, Fine test, Stipple/Lines, Swing + Shuffle, Home, live progress, Resume, Calibrate 7 steps (6 Speed, 7 Photo check), spring pen press |
| App layout redesign | building (`up-look`) | Tim: "make the app's layout and design much more improved" |
| Build guide | live | V1/V2 exact steps + fly-in animations + faster 3D (V2 23→12 ms/frame phone); **V3 tab** 19 steps, `build/plotter-v3.glb` |
| V3 hardware (cad) | designed, merged, NOT printed | stands 3 (wire clips, tray pockets), cable chain + tray, carriage 2 (snap, no screws), spring pen head + collets, switch mount, board cover |
| V2 | frozen | `cad/printed-frame-v2.scad`, `build/v2/stl/` |
| Machine | V2 built; all axes move | `$$` never read by Claude; nothing of 11-14/15 run on it |
| Ideas artifacts | private | upgrades https://claude.ai/artifact/McW2e5CAoqo8RtPp6u54a1 · more ideas (gear reduction, sand table deep-dive, WiFi) https://claude.ai/artifact/HBpKibNKhBnTWh7uVMuFcS |

## Authorized next steps
- 2026-11-15 · "you can build all the software improvements right now" + "make the app's layout and
  design much more improved" + exact build instructions per version + faster 3D + fine test (all
  built except the layout, which is running).
- 2026-11-15 · "make a V3 on the cite … keep all the content our V2 has with V2, and only add to the
  cite with V3" (done).
- 2026-10-27 · Moving the machine with tiny jogs from Claude's serial session, after a "ready" in
  the question box each time.

## Standing instructions (Tim's words)
- "Make sure that you consider that the multiple adjustments might adjust the design of multiple
  different prints … Consider everything you can to make the output perfect." (11-15, V3 hardware)
- "everything is able to easily come apart", "I don't really want to get any more bolts/screws" (11-14)
- "replace my current pen holder with the nicer one I desigend and bought" (micro linear stage, 10-26).
- Global rules apply (`~/.claude/CLAUDE.md`).

## Traps
- **Power off = 12 V AND USB unplugged** before touching drivers or motor plugs (a driver died 10-27).
- A shorted driver pulls 5V–GND to a few Ω, trips the Uno's polyfuse, no COM port. Find it by adding
  drivers one at a time. Ω readings only mean something fully unpowered.
- Tim says "X motor"/"Y motor" for carriage/platter; confirm which when he says "swapped".
- Y axis is platter DEGREES (`$101` = steps/degree). World +x in the CAD = machine X− = app "Right"
  (motor side); the pen draws on the idler side.
- Homing switch sits at world x ≈ +74 (machine X ≈ −74, motor side), NOT at −74 world. Lever is
  pressed ~2.3 mm at the end of travel (c 78): check it survives (NOT verified).
- Board cover needs the wheel removed to fit (4.5 mm gap).
- At c = −95 the pen is over the clamp ring (inner radius 92): drawings end at r ≈ 92.
- sim.html runs app.js too: any control must exist in index.html AND sim.html or be null-checked;
  load sim.html?v=1 and ?v=2 headless after every app change.
- GRBL/plot tests use real timers and flake on a busy machine: rerun once before believing a fail.
  `check-calibrate` phone: sim.html's Calibrate panel can keep scrolling ("element is not stable").
- Rebuilding the model rewrites STLs/GLBs (vertex order only for V1/V2): `git checkout --` the ones
  you didn't mean to change. OpenSCAD from PowerShell needs `-D 'part=\"x\"'`.
- PowerShell `[IO.File]` with a relative path resolves against the original project folder, not a
  worktree: pass `(Resolve-Path f).Path`.
- Worktrees under `C:/Users/timha/AppData/Local/Temp/claude/wt/` often fail `git worktree remove`
  (Permission denied on `.git/worktrees/*`, OneDrive): leave for the weekly sweep. Stale: software,
  guide, draw, chain, carriage, misc, run, v3.
- Leave the untracked `build/stl/carriage_plate.3mf` alone (Tim's file).
- Claude can drive the plotter (COM3 115200, PowerShell SerialPort) only with the app disconnected,
  ~2.5 s after open, after Tim says "ready" in the question box.

## Decisions
- D1 · 2026-10-16 · sweep: hidden SVG layers not plotted; clamped number boxes; aria-labels.
- D2 · 2026-10-25 · build guide GLB nodes `<part>__<piece>`, materials in `MATS`.
- D3 · 2026-10-25 · X belt in the rod plane, lower run zip-tied round the carriage pegs.
- D4 · 2026-10-26 · carriage plate pocket for the micro stage, +0.3 mm clearance per side.
- D5 · 2026-10-26 · direct-drive platter (hub on the NEMA shaft); gear reduction revisited 11-15 (D11).
- D6 · 2026-10-27 · red A4988 on Z; TMC2209s on X/Y.
- D7 · 2026-11-14 · Calibrate never draws; defaults guarded by "Change your defaults?" (archive).
- D8 · 2026-11-15 · V2 frozen as snapshots; V3 = live printed-frame.scad + cable-chain + carriage-2
  + extras; only one file owner per scad (docs/upgrades-plan.md I5).
- D9 · 2026-11-15 · homing is app-side (jog to `Pn:X`, back off, re-touch, G92), no `$H`, `$21`=0.
- D10 · 2026-11-15 · spring pen head: press capped 3 mm (stop at 3.5); with a press, up = touch + 2.
- D11 · 2026-11-15 · gear reduction NOT built: Fine test decides; try 1/16 microsteps first; if
  needed, 608 bearings on a post in the base + 60T printed into the wheel hub + 20T, Tim's 220 mm belt
  (artifact card 6).
- D12 · 2026-11-15 · ideas parked as artifact cards: sand table (V4, option B both motors fixed),
  WiFi brain (ESP32 bridge recommended, ~$6, NOT built: needs his OK to buy).

## NOT verified
- Anything about the real machine is Tim's report; Claude only sees GRBL's replies.
- **All V3 parts**: no print yet. Snap stiffness, spring feel, 0.25 mm thread clearance, collet grip,
  chain snap force and whether it holds itself up, switch click on real parts, wire lengths through
  the chain. Every ASSUMED size in cad/carriage-2.scad, cable-chain.scad, extras.scad.
- Homing on real GRBL (`Pn:X` timing, overshoot at his $120); the sim's 74 mm switch position.
- Resume after a real power cut; whether a skipped Speed-test run is obvious by ear; Photo check with
  a real camera photo; Fine test's 0.25 mm combs, Stipple and Lines on the real plotter.
- Build guide 3D speed on a real iPhone (measured only in headless WebKit; V3 4.05 vs V2 3.65 ms
  with a busy CPU).
- CALIBRATE 3/4 + SAFEGUARDS on the real plotter (details in the archive).
- Web Serial only exercised with `?demo` / stand-in `navigator.serial`.

## Rejected / parked
- ~~Short NEMA motors~~ · 2026-10-25 · keep the 42 Ncm motors with direct drive.
- ~~Whiteboard loop, Showcase page~~ · 2026-11-15 · need a bought sheet / Tim's photos; not built.
- ~~Moving the X motor to the other side~~ · 2026-11-14 · only moves the stop; app draws on the idler side.

## Map
- App: `index.html`, `sim.html`, `css/app.css`, `js/*.js` (see CLAUDE.md). Build guide:
  `build.html`, `css/build.css`, `js/build*.js`; models via `python tools/make-build-model.py [v3]`.
- CAD: `cad/printed-frame.scad` (live/V3 frame), `cad/printed-frame-v2.scad` (frozen),
  `cad/cable-chain.scad`, `cad/carriage-2.scad`, `cad/extras.scad`, `cad/plotter-parts.scad`;
  plates `build/print/*.3mf`. Bambu CLI slice recipe: chat.md 11-15.
- Tests: `node --test tests/*.test.mjs` · last run 2026-11-15: **181 passed / 0 failed** (one GRBL
  timing flake seen once, clean on rerun).
- Calibrate browser check: `node tools/check-calibrate.mjs phone|desktop <outdir> [baseUrl]`
  (Playwright WebKit on `sim.html?v=2`, ~3 min, background; 59 checks as of 11-15).
- Connect check: `node tools/check-connect.mjs <outdir> [baseUrl]` (5 checks).
- Simulator: `#simSpeed [data-speed="20"]`; `plotterSim.grbl` (`pos`, `real()`, `wco`, `received`).
- Live: https://timothyhadfield.github.io/polar-cnc-plotter/ (`build.html` = guide) · GitHub Pages
  from `main`; every push redeploys (a hook reports when the commit is live).
- Python venv for the model: `C:/Users/timha/AppData/Local/Temp/claude/venv3d` (if "No pyvenv.cfg",
  `python -m venv --clear` it and `pip install trimesh numpy`).
- Project path: `C:\Users\timha\OneDrive\Desktop\my-website\Code Projects\Electrical\polar-cnc-plotter`.
