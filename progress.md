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
**2026-11-15: everything Tim asked for is built and live (ee40a77), incl. the layout redesign
(phone: bottom tabs Load/Adjust/Plot over a fixed 352 px panel, preview 179→307 px; laptop: panel
"width − height" clamped 320–440 px with Load/Adjust/Plot sections; Settings in Drawing/Machine
groups). Open with Tim: should loading a drawing switch the phone to the Adjust tab? (kept: no,
nothing changes without a tap). Next: give Tim the Monday list when he's back (Mon 11-16).**

**TIM'S MONDAY LIST** (Tim 11-14: "I'm not gonna see my plotter until monday so keep track of all
the things I need to do when I'm back there as well as prints that need to be printed"). Tick as he
reports. V3 supersedes the 11-14 stands 2 / pen-holder plans (old list in the archive).
- **11-16 GEAR PLAN (supersedes the list below):** [x] plate3 stands printed · READY: plate12 gear
  base (floored pocket, 73cad63) · plate13 sled + roof (ca9bd24; all chk_* rerun 11-16 at final
  height: EMPTY, motor_sled = 0-thick face contact only) · plate5 clamp ring WITHOUT collar 3 ·
  READY: plate14 wheel + stand-in (a64512e). Idler OD 18 from the listing (Tim: "Just trust these
  measurements"; no test strip). **Only ONE spare idler** (the other is on the carriage belt; my
  "other order" reading was wrong). Fit order: stand-in pressed in FIRST (up to ceiling), real idler
  below it on the boss. 6.5 mm push-out hole at the platter centre (under the pad). Tim may order a
  2-pack ("if it's really useful") to swap in later. Fixed: gt2_plo undefined under `use` → the 60T
  ring's lower flange never rendered before a64512e (checks rerun with it: clean) ·
  BLOCKED: plate9/9t/10 (carriage2_frame hits the 17.3 frame; cap needs sl_h 10.3 + 4 pegs). Belt 6 mm.
  Base 2 superseded. Hardware: 4 M3x8 + nuts, 3 mm rod cut to 56.7.
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
| App layout redesign | live ee40a77 | Tim: "make the app's layout and design much more improved"; `js/layout.js` = tab switching only; visual choices listed in chat.md 11-15 |
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
- "If I click "set center" after the center has been calibrated, automatically move the pen to the
  center, don't mess with or change any calibration settings. Calibration can only be changed if you
  re-do calibration." (11-16)
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
- **Pen head cap is WRONG for the real slider** (Tim measured 11-16: 25.2 wide × **10.3 tall** along
  the travel; carriage-2.scad assumes sl_h 14 → 3.8 mm vertical slop). Fix sl_h (cap 10.4) before plate10
  is printed; stick-out still unmeasured. Slider = cream plastic block on 2 steel rods, front face has
  4 plain (unthreaded) holes Ø2.2, 3.0 deep, centres 4.9 apart along the travel × 19 apart across
  (Tim confirmed 11-16) + lead-screw nut screw in the middle. Plan: 4 printed pegs inside the cap.
  More 11-16 measurements (Tim's words: "linear motor" = stage, "frame", "block"): frame depth 17.3
  (st_d, was 10), block top 19.85 → sticks out 2.55 (sl_d, was 10): cap can only wrap 2.55 of the block
  sides, and **carriage2_frame (fr_y0 25.3, straps) collides** with the deeper frame → redesign it.
  End caps: top (motor end) 16.1, bottom 5.2 (st_cap was 4). Motor ~Ø16 with flats 12.6 wide, top 17.6
  above the frame's back (0.3 above the frame face), sits within the top end cap. Not changed yet (Tim: "just talk to me"). Explainer artifact:
  https://claude.ai/artifact/XfTWdPC4rFQRP3Wq4Gj32H (finger test, slot-guide idea).
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
- D11 · 2026-11-15 · gear reduction NOT built: Fine test decides; try 1/16 microsteps first.
  2026-11-16 designed in CAD `cad/gear-reduction.scad` (artifact card 6, 3D + to-scale section):
  spare metal 16T → 60T ring on the wheel hub = 3.75:1, 220 mm (110 T) belt → C 70.611 mm; Tim's two
  spare idlers stacked as the wheel bearings on a fixed 3 mm rod (55.5 mm) in a printed post; motor
  drops 5.5 mm through a base window on a drive sled (slides y, ±3 mm x belt tension, separate roof);
  wheel ribs notched for the pulley. Wheel underside still z 49.0 (same as collar 3). $101 → 16.667.
  4 prints (base, sled, roof, wheel ~6 h) slice clean, no supports; clash checks empty/contact only.
  Tim asked "1 bearing or 2?": 1 works, 2 ~3× steadier (reasoned). Not printed, not committed to build.
  **11-16: Tim chose gears before printing base 2** ("design a base plate print that supports the double
  gear system"). `build/print/plate12_gear_base.3mf` (b6f2287) = gr_base, window widened to also fit C20
  (printed 20T if the loop is 9 mm). Sled/roof/wheel prints wait on belt width + idler flange. With gears:
  collar 3 and wheel 2 not needed; $101 ×3.75 (re-run Calibrate turn test). Base 2 superseded.
- D13 · 2026-11-16 · centre gap auto-dodge (751658d): with offset ≠ 0, `dodgeGap` (polar.js) slides the
  drawing the smallest amount that puts the |offset| circle (+0.5 mm) on blank paper, shrink ≥ 0.85 only
  if the slide would cross R; null when no blank spot within min(20, 0.15R) mm (UVU logo at 5 mm).
  `place.auto` (app.js `autoPlace`) until a hand drag; Reset / Crop turn it back on; sketches skipped.
  Stats line says "moved X mm off the center gap". Tests `tests/dodge.test.mjs`.
- D14 · 2026-11-16 · Set center (617fe7d): once `grbl.center` is known, the button only lifts the pen and
  goes to X0 (`grbl.goCenter`), no G92. Center lost + homing measured → Home first. Neither → sets as before.
  Tim: "Calibration can only be changed if you re-do calibration." Label still "Set center" (his call).
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
- Centre-gap dodge and the new Set center are tested in node + headless `?demo` only, not on the plotter.
- Gear reduction (`cad/gear-reduction.scad`): idler flange Ø18 and belt width 6 are ASSUMED (belt
  listing says "-9"; a 9 mm belt needs a printed 20T instead); which two leftover parts are idlers is
  Claude's reading of Tim's words; wobble 0.14 vs 0.45 mm is reasoned from ~0.02 mm bearing play.

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
