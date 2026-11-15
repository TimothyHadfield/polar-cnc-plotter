# Polar CNC Plotter: progress (handoff for Claude)

## START HERE
_Last updated 2026-11-14 (CALIBRATE 4 = the tool as it is now, nothing draws: search "CALIBRATE 4"; CALIBRATE 3 = its Turn test, Pen height, pen direction, Connect; SAFEGUARDS: search "SAFEGUARDS"; BASE 2: search "BASE 2"; engineering review: search "ENGINEERING REVIEW"). For Claude only; Tim doesn't read this. Catch-up authorizes nothing: only
"Authorized next steps" below is approved work._
1. Read `CLAUDE.md` (project, file map, tests), then this file.
2. Skim the last entries of `chat.md`. Full machine-debug narrative 10-24..10-27 and older detail:
   `docs/archive/progress-2026-10-27.md`.
3. Parts, settings formulas, upgrade parts: `docs/components.md` (§3 bought parts, §6 expected `$`
   settings + Vref, §7 improvements incl. what the builders made 2026-10-26).

## Goal right now
**2026-11-14: Calibrate is 5 steps and never draws (CALIBRATE 4, built and live).** Next is Tim's
run on the real plotter: Turn test + Test, Turn direction, Pen height (is Down really down now?),
Carriage test (ruler under the pen), Find center (a mark + Half turn); then a first real drawing.
If the platter is slow: the turn test now raises `$111`/`$121` itself (Test = 5 s a circle). The older text below is history.

**PRINT ISSUES (2026-11-14, TALK ONLY: Tim "Don't build or change anything yet, just remember
them").** NOTHING IS BUILT. Tim's five, with what Claude told him:
1. Collar ("hub-motor connector"): M3x8 screws don't reach the shaft (10 mm would); the D-flat in
   the bore alone "is perfect and turns great", "I don't think we need the bolts". Claude: agree,
   drop screws, nut slot, and the wheel's head channel (the hex taper keys it). BUT the screws were
   what held the collar's height (set by collar_gauge) -> ties to 3.
2. Idler fork cheeks (cheek_t 4) bent when tightening the M3x25, "close to breaking". Wants thicker
   and maybe a "horizontal connection" between them, not touching the bearing. Claude: likely root
   cause = `idler_w` 8.5 was ASSUMED, never measured; a gap in the stack lets the cheeks fold in.
   Fix = measure the idler, spacers fill the gap exactly (or one solid printed bushing), cheeks 4->6,
   bridges above the top belt run and below the bottom run (box around the belt). Needs Tim's idler
   width (calipers) first.
3. Nothing stops the platter sinking onto the cage/motor. Tim: fill the collar's hole so it sits
   at the right height. Claude: make the bore blind; the shaft tip (23.5 above the face) holds it.
   Shaft tip is flush with the collar top now (collar underside 9 above the face, 14.5 tall), and
   the socket has 2.1 mm over the collar, so a ~1.2 mm roof fits with no other change. Small reprint.
4. Round the sharp corners (stands etc.) for safety. Claude: fine, chamfer/round outer edges and
   gusset tips only, never mating faces (dovetail, rod holes, feet, motor face).
5. Right stand's motor flange blocks the carriage (stops at 78 mm). Tim suggests moving the motor
   to the other side. Claude: not needed, the app draws only on the idler side (s >= 0, reaches
   ~99 mm, needs 90); swapping sides just moves the stop. If wanted, the real fix is motor outboard
   of the column (longer arms; bed-size check).
**BUILT 11-14 (Tim: "make print files with the changes that you're confident should be made and
then tell me specifically what you need for the other changes"):** collar 2 (blind bore, roof
`cap_drop` 0.5 under the old top, wheel 2.5 over the cage with the 23.5 shaft; no screws/nut slot;
`build/print/plate7_collar_2.3mf`, 7 min / 2.3 g sliced) and stands 2 (`round_r` 2.5 rounded
column/arms, foot corners r5, gusset tips r3, flange corners r3; left fork: cheeks +2 mm outside
from arm_x0 out, bridges at +-10.5..13.5, head pocket 2 deep; plate3 sliced 4 h 04 / 198 g, same
as before). plate5 (+ABS) rebuilt with collar 2. Checks: idler d19 at both slot ends clear of the
fork; carriage at -96 touches the front cheek's round tip in the OLD file too (left reach is ~95,
not 99: pre-existing, still >= 90); right side unchanged (78). Wheel NOT changed (its screw channel
is just unused); the model's wheel is drawn 0.5 low (wheel_z0 ignores cap_drop). Waiting on Tim:
idler width (spacers), and whether he still wants 5.
Ring 2 (same evening): with a rubber band added, 3 hooks went on tight, the 4th broke; Tim asked
for hooks "a tiny tiny bit longer". `band_t` 0.5 (hooks 10.7 -> 11.2). plate5 (+ABS, both now with
collar 2) sliced 32 min / 18 g. Band thickness NOT measured.
Collar 3 + wheel 2 (same evening, Tim: socket "isn't sloped inwards, like the collar" so the collar
touches a small area and wobbles; make the indent the collar's exact size; add a short vertical
extension). MEASURED from plate4_wheel.3mf: the socket WAS tapered (5°/side, 1.3 mm a side, hard to
see); the real loss was the screw-head channel, which cut away most of one of the six faces. Built:
wheel 2 = no channel (plate4, 2 h 53 / 133 g); collar 3 = taper from the socket mouth (was 1 mm
inside) + 3 mm straight hex grip under the wheel, roof lower so the wheel is 4.5 over the cage
(grip 1.5 over; carriage clash re-run with the platter +2.5: clear). plate7_collar_3 (9 min / 2.8 g,
collar_2 file removed); plate5 + ABS carry collar 3. Collar 3 fits the old wheel too. Pen must
sit ~2 mm higher in its holder; redo Pen height.

**DEFAULTS (2026-11-14, late night).** Tim, after a full calibration on the real plotter: "Could
you make our settings saved right now the default settings of the app? This means if you
recalibarte something you need to go through something that confirms you want to change the
default settings of the app." Built `js/defaults.js` (key `polar-plotter-defaults` in this
browser: app `offset flip penUp penDown zFlip` + plotter `$100 $101 $3`). Taken automatically at
the first connect whose `$$` passes `badAxes` (machine.js `check`, log line "calibration saved as
the defaults"), so Tim's values are captured at his next connect, not baked into code (REASONED: I
could not read them reliably; Edge's leveldb copy from 14:43 showed flip true, penDown -0.4,
offset 0, likely stale). After that every Calibrate save that would move a default (Done in steps
1/3/4/5, Clockwise/Counterclockwise, Test saving an unsaved $101, both Reverse switches) shows
"Change your defaults?" old → new with **Keep old** / **Change** (`guard()` in calibrate.js).
Turn test Start with an implausible $101 starts from the default $101. A plotter whose $100/$101/$3
differ from the defaults: mMsg "Not your defaults: …" + **Restore defaults** button (writes them,
`saveSetting` keeps the center). Simulator and ?demo never touch defaults unless the URL has
`?defaults`. Settings-sheet edits are NOT guarded. Verified: `tools/check-defaults.mjs` 10/10 at
393 px and 1440 px; calibrate walk 54/54 both widths (check 15 once failed under load at 205° vs
the 200° limit, passed alone); 136 node tests (3 new in `tests/defaults.test.mjs`).

**CALIBRATE 5 (2026-11-14, night): Start / Done per step, pictures, quick check.** Tim: "a button
that says start and done ... on each step with color changes ... a redo as a start button ... some
sort of picture or diagram or animation on each step ... especially step 4 and 5 ... point 4 on step
5 is really unclear ... After step 5, the "next" button should turn into a "finished" button ...
a quick test button ... the plotter automatically moveing to the center, edges, full rotation, etc.
and the user just clicking yes". Built in `js/calibrate.js` (panel part rewritten), `css/app.css`,
headers of index.html + sim.html. Per step: `st[n]` idle/on/done; a pill by the title (Not started /
In progress / ✓ Done) and 5 dots by "Step n of 5". **Start** (then **Redo**) begins; controls marked
`data-on` work only while the step is 'on'; **Done** saves (old Save101 / Touching / Save100 / Set
center are now Done). The next button to press gets class `go` (filled blue). Step 1: Start = the
old first-arrow work (START reset, platterSpeed, `turn`); after Test, "Back on the mark?" Yes / No
(No reopens the step with `turn.tested`). Step 2: Start = the quarter turn. Step 5: Start records
the mark (`mark` at Start, not at Half turn); line 4 reads "Only if needed" with a "?" holding a gap
picture (`PIC.gap`). Next on step 5 reads **Finished** and closes the tool. Header: **Check** +
**Close** (was Done). **Quick check** (`CHECKS`, view 6): pen up to X0 (Y untouched), pen down / up,
X50, one full turn clockwise (`fullTurn(spu, yDir())`), five Yes / No questions; any No = ✗ Problems
+ "Redo step n" buttons. Needs the center set this session. Pictures: inline SVG + SMIL in `PIC`.
`#calTool .calstep { position: relative }` stops the switches' hidden checkbox from making the page
scroll on the phone. Verified: `tools/check-calibrate.mjs` 54 checks pass at 393 px and 1440 px
(screenshots looked at); 134 node tests. NOT verified: the pictures' clarity to Tim; real plotter.

**CALIBRATE 4 (2026-11-14, evening).** Tim: "for the calibration, there shouldn't be any
proceedures that require you to draw on the paper, because it's hard to get the paper and It
needs to be as easy as possible." Rebuilt in `js/calibrate.js`, `STEPS = 5`; the pen is never
lowered except by his own Down clicks in Pen height. (The drawing steps it replaced:
`docs/archive/progress-2026-11-14-calibrate3-drawing-steps.md`.)
1. **Turn test** (arrows since 11-14 late; Tim: "instead of having it slowly spin until it goes in
   a full circle, have the user spin it ... using the turn arrow things and different sizes of
   steps until it's gone in a full circle, then have the cite calculate how far it went ... make
   the test spin faster ... around 5 seconds for the test to spin in 1 circle is good"). Tape a
   mark, ↺ / ↻ at 0.5° / 5° / 90° (plotter's count, NUDGE 400 steps/s) until it is back; the count
   since the first click (or since Test) gives New `$101` (`turnSteps`, snapped). **Start over**
   drops the count. An implausible `$101` (factory 250) is first replaced by `START` 8.889. "Turn
   slowly" and Back/Further are gone (`SLOW.Y`/`slowJog('Y')` remain, unused by the UI). **Test** =
   `fullTurn` at `360·60/TEST_TIME` = 4320 °/min (5 s), capped at 4000 steps/s; before it and
   before the arrows `platterSpeed` writes `$111=7200` if under 4320 and `$121=300` if under 150
   (the build guide's values; factory 500 / 10 made a turn take 43 s). Walk: Test took ~6 s wall
   time in the simulator, which has no acceleration. **Test also saves an unsaved New `$101` first.** Tim, 11-14
   on the real plotter: "I calibrated it so that It goes around the circle once and then I stopped
   it, but then when I tested it, it did 2 full rotations rather than just 1." Reproduced in the
   simulator (held 4.5, true 2.222, Test without Save turned 720°); fixed (`pending101`, Test's
   `pre`), check 36 in `tools/check-calibrate.mjs`. REASONED: he skipped Save; if he says he did
   press Save, this is a different bug.
2. **Turn direction** (new, replaces Mirror check): **Turn** = a 90° Y+ jog (`partTurn`), then
   **Clockwise** / **Counterclockwise** (seen from above). Clockwise = `flip` off, counterclockwise
   = `flip` on (the simulator's convention: Y+ is clockwise with `flip` off). Changing `flip`
   negates a saved `offset`. It comes BEFORE Find center because the gap's sign depends on `flip`.
3. **Pen height**: as in CALIBRATE 3; wording "Click Down until the tip just touches." (no paper).
4. **Carriage test**: jog Left near the edge, hold a ruler under the pen, **Move** = slow jog of
   `LINE` = 2000 motor steps toward the center, PEN UP (Stop or running out both count; under 200
   steps = "Too short to measure"). "Plotter says N mm" + "Ruler says" -> New `$100` =
   `beltSteps`: the measured value, rounded to an exact GT2 belt value (`snapBelt`: 16/20 teeth,
   200/400-step motor, any microstep) when within 2 %; the raw number shows as "measured x".
5. **Find center** (replaces the drawn circle AND the Center gap step): jog Left about halfway,
   put a small mark on the platter under the tip, **Half turn** (180° jog; remembers `mark {x, y}`),
   jog Right to the mark, line it up with ↺ / ↻ (0.2° / 1° / 5°), **Set center**. The center is
   halfway between the two X positions (`centerBetween`). Since 11-14 late (Tim: "those platter
   rotation buttons should be carraige movement buttons so that you can move the carraige to the
   point instead of the platter back around") the step has 4 lines: 1 jog left + mark, 2 Half
   turn, 3 its own Left/Right row (`xLeft2`/`xRight2`, `.xstep2`) to reach the mark, 4 "Mark off
   to one side? Turn a little" with ↺ / ↻ at 0.2° / 1° only (for the gap); the leftover angle gives the center gap:
   `gapFromMark` = `s·tan(extra/2)`, `s` = half the X distance, `extra` = turn beyond 180°, sign
   flipped with `flip`; saved to setting `offset` ("Center set. Center gap 0.7 mm."). Set center
   refuses until the pen has moved 400+ motor steps from the mark and is within 30° of half a turn.
   A `$100` save rescales `mark.x`; a `$101` save, a `$100` reset or an X direction flip drops it.
- The gap needs an exact `$101` (direct drive snaps to 4.444) and by-eye lining up: about ±0.3 mm
  REASONED. Center gap and Reverse rotation stay editable in Settings.
- Verified: 132 node tests; `tools/check-calibrate.mjs` 41 checks at 393 px and 1440 px (simulator
  pretending a 4.444 / 40 plotter at factory 250, true gap 0.7 found as 0.7). Six mutations each
  failed a test (flip ignored, gap sign, no belt snap, 20T missing, half-turn feed, center not
  halfway). On the phone the Carriage test and Find center panels scroll about 40 px INSIDE the
  panel on sim.html (the page does not scroll); plotting needs the laptop anyway.

**SAFEGUARDS (2026-11-13 night) and CALIBRATE 3 (2026-11-14): moved verbatim to
`docs/archive/progress-2026-11-14-safeguards-and-calibrate3.md`.** Still true from them: `js/safe.js`
ranges (`$100` 5-800, `$101` 0.5-150) switch off jogs/Plot for a bad axis; `zFlip` -> `$3` bit 2 on
connect; `pickPort` auto-connects the one remembered port; Left = X+; the screaming / jiggling
platter on 11-13 was a half-seated plug (cured by replugging; third time).


**Pen holder + circles (2026-11-13 late).** `pen_holder()` in `cad/plotter-parts.scad` (redrawn from
the original guide's `Pen+Holder+Parts.stl` in Tim's OneDrive, neck 18 -> 13.6 mm so his clip's
14 mm opening goes over it), `build/stl/pen_holder.stl`, `build/print/plate6_pen_holder.3mf`
(8 min, 3.8 g). `tools/make-circles-pdf.py` -> `build/print/paper_and_pad_circles.pdf` (page 1
paper 196 mm, page 2 pad 200 mm, each with a 100 mm scale line). The holder is NOT in the 3D model
or the build guide; with it the pen sits about 6 mm nearer the rods than the model's `pen_y`.

**11-10 / 11-11 driver and wiring debug: moved verbatim to
`docs/archive/progress-2026-11-14-calibrate2-and-driver-debug.md`.** Still true from it: two old
black TMC2209s died and were replaced (new Teyleten TMC2209s, Vref X/Y 1.3 V, Z 0.4 V); every
motor plug needs its coil pairs on pins 1-2 / 3-4 (all three were middle-swapped; the pen stage's
coils are wires 1-3 and 2-4, 20 Ω each); most "jerky" was a half-seated plug or driver; all three
axes have worked on their own headers since 11-11.
**11-11 design history (rebuild ideas, prototype 1, prototype 2 and its revisions, pen centring
audit, soft pad, pre-print check): moved verbatim to `docs/archive/progress-2026-11-13.md`.** Still
true from it: Tim's rules for the frame = no screws/bolts between stands and base, nothing below the
base, no Arduino screws, no screws or glue on the drawing face; stands on sliding dovetail rails
(groove closed at the back = stop); printed platter face (aluminium disc dropped); clamp ring with
hooks between key ribs; `pad_t = 1` soft pad; the pen draws on the idler (left) side (`ix` 133).
Flip GRBL `$3` X bit if the carriage jogs the wrong way.

**11-12 idler: Tim chose to BUY a bearing idler** (question box; he'd found the nail idler loud and
high-friction). GT2 20T, 3 mm bore, 6 mm belt, ~$7-10 per pack of 5 (his money call, made).
`idler_spacer` (d5.2, presses only the inner race) x2 = frame_idler_spacers.stl; `idler_w = 8.5`
ASSUMED: measure his idler and re-export. Printed pulley_m3 retired. Platter has no belt now (direct
drive), so this idler is the only free-spinning belt part; the X motor pulley is bought aluminium.
Link given: E-outstanding 2-pack B08J9W4PJT (listed 8.5 mm tall = idler_w). 11-12 Tim: "how should
we attach the bearing to the stand?" -> kept the fork + M3x25 + nut, made bolt hole and nut pocket
slots `idler_slot = 4` outward = belt tensioner (pull out, tighten; takes up 8 mm). Nut pocket d6.6
hex (5.7 flats, slides, can't turn). frame_stand_left.stl re-exported. Artifact v11 shows it.
Tim asked "are these bearings sure to fit my belt?" -> yes: his X belt is GT2 6 mm, idler listed
GT2 20T, 6.5 mm tooth width (from listings; product page 503'd).

**11-12 hub: SHAFT COLLAR redesign** (found while animating for Tim's "confused about the Y axis hub
connection"): the wheel's set screws sat ~95 mm in from the rim, unreachable by any key. Now
`shaft_collar()` (hex, 18 -> 16.6 mm across flats taper, D bore, 2 M3 grubs at set_z [5, 13] + nuts
in a slot) goes on the shaft first, flush with the tip (ASSUMES shaft_len 24); wheel hub has a
matching hex taper socket and presses on. Taper sets wheel height: +-0.1 mm print error ~ +-1 mm
height, socket ceiling 0.6 above collar top. New frame_collar.stl; frame_wheel.stl changed.
Artifact v13: 4-step animated webp + collar, tightening close-up, underside socket, plan cut views.
Scratchpad pipeline (lost on reset): hubmk.scad pre-cuts meshes (preview colours), hub.scad animates.
**V1/V2 tabs + 3D simulator** (Tim's 11-12 request: build page tabs V1/V2, V2 same format + all
changes, 3D on left moving/drawing with all 3 axes, machine controls on right) MERGED 437ef63, live:
build.html has V1|V2 tabs + Simulate; new sim.html (js/sim.js, js/simgrbl.js = pretend GRBL with real
move times + 15-block planner, tests/simgrbl.test.mjs). 101/101 tests; phone-view live 393 px OK.
Not done: acceleration, Z wire motion, sim link from index.html. V1 glb not regenerated (non-
deterministic export). Tim's calls pending: V2 colours, labels, drawing inset, phone layout stacked.
Tim's shopping (11-12): M3 kit (+M3x25), idler B08J9W4PJT, 1 mm 60A adhesive silicone pad (fits hooks),
VINCA DCLA-0605 calipers. Endstop: offered X switch + app "Find centre" (no GRBL reflash); not asked yet.
Pen-stage cable (120 mm wires, messy splice): suggested 1 m 4-pin Dupont cable + solder + heat shrink,
zip-tie strain relief, slack loop; Tim holding off ("see what I can do"). Offered carriage zip-tie anchor.
Sim: Set center now lifts pen + returns to platter centre first (bc3ac5a, live).
**Print plates (8d900bd):** build/print/plate1..5 *.3mf (own 3MF writer, 256 bed; stands nested on one
plate, left stand rotated 90°, 4 mm gap checked on a 2 mm occupancy grid). Tim has printed ONLY the
carriage plate. Told him: plate1 first; check shaft >= 24 mm before the wheel; pen clip/knob are his
old design (fit on the new slider unknown). Not opened in Bambu Studio (no headless slicer).
**Collar screws -> M3x8 pan heads (11-12):** Tim bought 8 × M3x8 pan-head Phillips (Ace) and asked to
use them instead of grub screws; none of the 5 plates printed yet (carriage plate is printed, taped
to the SC8UU blocks with double-sided tape, no block screws). Wheel socket got a screw-head channel on +x (7 wide, to x 13.5, z 0..16.6, open at
the bottom); hub_d 30 -> 33. Sweep check: screws moved straight down never touch the wheel (empty
intersection). Re-exported frame_wheel/frame_fit_test + plate1/plate4. plotter-v2.glb NOT rebuilt
(3D guide wheel lacks the channel). His bag: 1 M3x25 socket, 2 nuts, ~8 M3x8 pan. Still needs 1 nut and
4 × M3x6 for the platter motor (8 is ~1 mm too long through the 2.5 mm cage roof floor).
**Tim skips the fit test (11-12):** "I'm not gonna do a test print ... the indent [stage pocket, 0.3 a
side] fit perfectly". Fits tuned for that: dovetail 0.2 -> 0.25/face, collar bore 0.15 -> 0.25, nut
slot 2.6 -> 2.8, collar screw holes 3.2 -> 3.4, collar top lowered 1.5 (col_z1 15.5, ceiling gap
2.1) so the hex taper always wedges before bottoming (no rotational play). Shaft now needs >= 22.5
out. Rod holes kept 8.2 (vertical, snug wanted). All frame STLs + 5 plates re-exported; clash check
still empty. plotter-v2.glb still not rebuilt.

**11-12 ENGINEERING REVIEW (Tim switched to Fable 5.2: "let's do all of that. I have the base plate
design actively printing right now but that's it").** Base (plate 2) was printing: NOT changed
(re-export is geometrically identical). Everything else changed freely. Read this before touching CAD.
- **BASE SUPPORTS (open, Tim to answer):** the old wording "supports from the bed only" was WRONG.
  Headless Bambu Studio slice: "On build plate only" ticked = 0 supports under the motor cage roof
  (they'd stand on the base, not the bed); unticked = a column under the roof, nowhere else. Told
  Tim mid-print to look for supports inside the cage. If he printed without: roof (two 9.8 mm
  cantilever strips + 43 mm bridge, the motor's seat) sags -> reprint or trim; ask him.
- **Stand groove:** as a mirror of the rail it was a ceiling when printed (stand lies on its outer
  face); the slicer wanted a support wall along all 135 mm (measured, old STL). Now `dt_groove`:
  outer flank undercut as before, inner side = 0.4 land + 45° relief, flared mouth at the front.
  Slicer now puts supports only at the motor-flange recess and the idler slot (ignore; not needed).
- **Stand foot:** faces at x 100 and x 125 were drawn touching the base (0 clearance) -> `foot_gap 0.3`.
- **Stands go on from the BACK, pushed forward** (groove closed at the back). Guide/header said
  "from the front": wrong, fixed. Checked: stands +60 in y = no clash; -60 = clash.
- **Collar/wheel:** taper 18->16.6 became 19->16.5 (4.9°/side; 0.1 mm error = 1.2 mm of wheel
  height, was 2 mm); collar bottom chamfered (elephant foot); `wheel_gap = 2`, `w_h = 18` fixed, so
  **lift 24.5, belt_z 130.5, plate_top 65.5** (all +1; stands only). Collar height now set by new
  `collar_gauge` (3 mm fork on the cage top), not "flush with the shaft tip". Shaft per OMC page:
  23.5 long, 20 flat (was assumed 24); works 21-25.4. Tip pocket in the wheel skin; chan_z +1.4.
- **Platter motor screws:** roof is 2.5 under the heads, M3x8 would go 5.5 into ~4.5 deep threads
  -> new `motor_washers` (1.5 thick, x6) or M3x6. Tim needs 10 short screws (has ~8 + old ones) and
  1 more nut.
- **Travel toward the idler = 93.5** (carriage plate's raised block meets the fork cheek; empty at
  93, clash at 94), not ~98. sim.js travel [-78, 93], belt z 130.5.
- **Motion (reasoned, not measured):** wheel+pad+ring ~1.25e-3 kg·m², ~230x the rotor; rings at
  ~14-19 Hz. Start `$110=6000 $111=7200 $120=500 $121=300` (in the guide). Vref X/Y back to 1.0 V in
  the V2 guide (was 1.3): 0.9 A in a PLA cage runs the motor near PLA's softening point; torque
  needed is ~3% of what 0.7 A gives.
- **Plates:** plate1 is now `plate1_collar_gauge_and_washers.3mf` (fit test dropped from it; the
  fit_test STL stays). plate3 + plate4 re-exported. Slicer (X1C, 0.20 Standard, PLA Basic — Tim's
  last-used presets): p1 11 min/5 g, p2 ~3 h/130 g with supports, p3 3 h 57/198 g, p4 2 h 55/133 g,
  p5 24 min/14 g. plotter-v2.glb REBUILT.
- **11-13 plate 1 is gone:** Tim: "put that necessary connector [collar] in the last plate and clamp
  ring print so I can easily skip the test print and still have all the necessary parts". Collar,
  collar gauge and 6 motor washers now sit inside the ring on
  `plate5_clamp_ring_and_small_parts.3mf` (parts byte-identical, gaps >= 6.5 mm, 46 mm to the ring;
  headless slice: 33 min, 18 g, 0 supports, no warnings). Plates are now 2, 3, 4, 5 (numbers kept).
  `plates.py` (scratchpad) has the layout: collar at (60, 91), gauge (86, 91), washers (86, 111)
  from the ring's corner.
- **11-13 ABS for plate 5 (Tim out of PLA: "Is it okay if I do ABS?"):** yes. Added
  `plate5_clamp_ring_and_small_parts_ABS.3mf`: only the ring is scaled 100.4 % in X/Y (hook wall has
  0.2 mm radial clearance to the wheel's bead at r 102.5; ABS shrinks ~0.3-0.4 % more than PLA =
  ~0.3-0.4 mm there. REASONED from typical shrink figures, not measured; both Bambu presets have
  shrink compensation 100 %). ASSUMES the wheel is PLA; if the wheel is also ABS use the normal
  file. Small parts unscaled (collar 0.06 mm smaller across flats = wheel ~0.7 mm lower, fine).
  Measured: Bambu refuses ABS on the Cool Plate ("Filaments are not compatible with the plate
  type"); on Textured PEI it slices: 39 min, 14.5 g, bed 90, nozzle 270, 0 supports, 0 brim.
- **11-13 TIM PRINTED plates 2, 3, 4 (not 5) and assembled.** Pen ~1 inch off centre front to back
  ("the central plate motor is about an inch forward of the pen"); Uno's bottom pins hit the 4
  round pads; one base rail printed rough; base "has some other problems as well" (never said
  which).
- **11-13 BASE 2 (Tim: "Try to redesign both the model and the base plate so that it fixes these
  problems I stated"). BUILT, NOT PRINTED.**
  - **Cause (Tim found it):** the model's stage was a 20 mm body PLUS a 14 mm-proud slider. His
    real part: "The center brick ... only sticks out about 1 cm further than the rest of the motor";
    the listing's 20 is the whole depth and the slider is 25 x 10 x 14 (10 proud, 14 along travel).
  - **Stage model** (`plotter-assembly.scad`, shared by V1 and V2): `stage_d` 10, `slider_d` 10,
    `slider_h` 14, body 70 tall + motor 11 (= 81, fits the plate pocket), motor flush with the back.
    `pen_y` is now **3.0** in both scad files (was -11.5 / -11). `carriage_d` 36.0, still NOT
    measured. V1's platter drive follows pen_y (it is a model of a machine that no longer exists).
  - **Base** (`printed-frame.scad`): **11-14 (1f8f3bb) `cage_y = 8.5`, `motor_adj = +-15`** (shaft
    y -6.5..23.5; each pen guess, model 3 / Tim's inch 14, has 9.5 mm one way, 20.5 the other; the
    front/back screw slots merged into one slot a side). Tim asked whether the guess sat mid-range: it
    did not (old +-10 at 9 left 4-5 mm). Clash checks re-run clean; NOT sliced (expect ~3 h / 150 g).
    Tim asked ABS vs PLA: told PLA (250 mm flat ABS warps without an enclosure). Was: cage_y 9,
    +-10 (shaft y -1..19) in long screw slots; back ribs are now only the end of travel. Why adjustable
    (Claude's call, flagged to Tim): his "about an inch" = 25 mm, the corrected chain = 14 mm, and
    the pen holder for this slider is not final. Roof: 8 mm shaft slot through + 23.5 x 3 boss
    channel underneath (was one 23.5 slot right through), so the roof stays in one piece.
    Centring: screws loose, carriage over the motor, slide the motor until the shaft is under the
    pen tip, tighten. An `assert` fails the render if pen_y leaves the travel.
  - **Uno tray:** only the 4 pads removed ("keep it exactly the same but without those tiny 4
    little circle stands"); lips and `uno_pad = 3` unchanged, board rests on its own pins.
  - **Rail: NOT changed** (his printed stands must still fit; cause unknown, no photo). Measured:
    the slicer puts no supports at the rails on either base, only under the cage roof.
  - **Measured 11-13:** OpenSCAD intersections (scratchpad `redesign/clash2.scad`): motor at both
    ends of travel and sliding in = only the model's proud bottom screw heads (0.1 mm, as before);
    1 mm past the back end hits the ribs; spinning envelope (r 104.5) vs base/stands/X motor/Uno at
    both ends = empty; vs carriage = empty; stage + slider vs carriage plate = empty. New
    frame_base.stl: one body, watertight. Headless Bambu slice (X1C, 0.20, PLA, supports on, not
    build-plate-only): base only **3 h 2 min, 150 g** (first base 2 h 46, 136 g); with spacers,
    clip and knob 3 h 9, 152 g. GLB centres (wheel, shaft, pen tip, V1 platter) all at y 3.00 =
    `centre` in sim.js.
  - **Files:** `build/print/plate2_base_only.3mf` (new, for the reprint) and
    `plate2_base_and_small_parts.3mf` (same new base). sim.js centres [0, 3]; build-look.js wire
    routes; guide step "Platter motor" reworded (wording is Tim's call).
  - **Open:** more support to dig out of the cage (171 m of support line vs 97 m: the roof is now
    solid over the middle); his "other problems"; the rail.
- Checklist artifact for Tim: https://claude.ai/artifact/7FoeWjaJ7hR36dzydvh4PC. Hardware artifact
  (F83nn95VXsk6BVKmLUT6v3) updated to match.
- Still open: pen clip/knob for the new slider (need Tim's caliper numbers: slider size + proud of
  the stage, its holes, pen diameter, idler width, pad thickness, plate back face to slider front).
- Tools (scratchpad, lost on reset; rebuild from this): headless slice =
  `bambu-studio.exe --slice 0 --arrange 0 --orient 0 --load-settings "machine.json;process.json"
  --load-filaments filament.json --outputdir . --export-3mf out.3mf in.3mf` with the three presets
  FLATTENED first (walk `inherits` in `%APPDATA%/BambuStudio/system/BBL/{machine,process,filament}`;
  unflattened it silently uses defaults). No window opens. Count `; FEATURE: Support` in the gcode.

**Machine state 10-27 / 10-28 (dead Y channel, driver triage, bench plan): moved verbatim to
`docs/archive/progress-2026-11-13-october-machine-state.md`.** All superseded by 11-11 (new
TMC2209s, all three axes move) and 11-13 (fully built).

## Status
| Area | State | Notes |
|---|---|---|
| Plotter app | live | node tests: see Map |
| Draw tool (`js/sketch.js`) | live 2026-11-12 | Tim: "draw your own design yourself on the plate". Draw button next to Pattern; pointer draws on the preview; Undo / Clear / Done. Strokes in "paper units" (`strokes.center=[0,0]`, `strokes.radius=1` -> `fitFrame` keeps the scale, `layout()` clips at the circle). Kept in localStorage `polar-plotter-sketch`. Reopening after Turn/move/Crop bakes the placement (`bake`). Light smoothing (0.5 mm, corner cut 0.27 mm). Also on sim.html (the plan inset fills the stage while drawing). |
| Simulate (`js/handoff.js`) | live 2026-11-13 | Tim: "allow the user to simulate the drawing aswell". A "Simulate" link beside Download G-code opens `sim.html?v=2`; the drawing on screen (strokes + colours + center/radius + turn/move/crop) rides along in sessionStorage `polar-plotter-handoff`, consumed once by app.js when `window.plotterSim` exists. A picture arrives already traced (no Darkness slider there). Then Connect plotter -> Plot in the simulator. |
| Machine | built; all axes move (Tim, 11-13 night); pen motor mounted so GRBL's Z ran backwards (Tim, 11-14: "the way that I want it") | `$100`/`$101` unknown until Tim runs the Turn and Carriage tests; `$$` never read by Claude |
| Calibrate tool | 5 steps, nothing draws (CALIBRATE 4, 2026-11-14) + safeguards | Tim used the 11-13 version on the plotter; the 11-14 flow is tests + simulator only |
| Connect | 2026-11-14: one remembered port connects without the browser's list (`pickPort` in `js/grbl.js`) | stand-in `navigator.serial` only; the first ever pick still shows the list |
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
- Ω readings only mean something with 12 V AND USB unplugged. The test only catches shorts (few Ω
  to ~100 Ω); readings differ with probe points/polarity, so it can't prove a driver works.
- Tim says "X motor"/"Y motor" for carriage/platter motor, and sometimes "swapped X and Y" for the
  cables when the driver boards were meant: confirm which.
- Clicking from the NEMAs on any jog (even Z) = GRBL re-enabling all drivers (`$1=25`). Harmless.
- Y axis is platter degrees, not mm (`$101` = steps per degree).
- Claude can drive the plotter: COM3 at 115200 via PowerShell `System.IO.Ports.SerialPort`, only
  while the browser app is disconnected. Opening the port resets the Uno: wait ~2.5 s. Ask Tim
  "ready" in the question box before any move.
- **sim.html runs `js/app.js` too** (js/sim.js imports it last), with its own copy of the panel
  markup. Any new control wired in app.js or a tool module must exist in BOTH index.html and
  sim.html, or be looked up with a null check: on 11-12 the Draw commit (ce99488) threw on
  sim.html for a few hours because `#openDraw` wasn't there. After any app change, load sim.html
  headless and read the exceptions list.
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
- CALIBRATE 3 + 4 on the real plotter (Tim used the 11-13 tool there; nothing of 11-14 has run on
  it): the `$3` write on connect (assumes his bit 2 was 0; if Down still goes up he flips "Reverse
  direction" in Pen height), Test (a full turn at 400 steps/s, slower if `$111` caps it), the
  Touching lift (100 motor steps ≈ 2 mm is reasoned from a 3 mm lead), Move (2000 steps toward
  the center, pen up; reading a ruler under a lifted pen by eye), that Left is really his left,
  that Y+ with `flip` off is clockwise on HIS wiring means "not mirrored" (the convention is the
  simulator's), how well a mark can be lined up under the tip (center gap ±0.3 mm reasoned), how
  far the platter coasts after Stop. Auto-connect in real Chrome:
  that it remembers the port across unplug/restart, and that the list still opens when
  `getPorts()` ran first. In `?demo` slow moves jump at once: FakeGrbl has no real-time motion.
- SAFEGUARDS: the plotter's real `$$` (never read), so 1607 and 1/8 microstepping are reasoned;
  why the slow turn jiggled; `grbl.stop()` (hold + soft reset) from Calibrate's Stop on real GRBL;
  the step caps are guesses for a stepper at unknown microstepping, not measured stall speeds.
- Pen holder: fit on the real slider (how it fixes to it is unknown), clip over the 13.6 mm neck
  (OpenSCAD intersection only). Circles PDF: not printed; depends on printing at 100 %.
- Base 2 is not printed. Not measured on the real parts: stage body depth (10 assumed), where the
  pen really sits (the motor's +-10 mm travel is meant to cover it), whether the 3 mm boss channel
  and 8 mm shaft slot come out clean over supports, how hard the cage supports are to remove.
- Draw tool with a real finger on Tim's iPhone (only WebKit headless: mouse drags + one touch tap).
- Simulate on Tim's own devices (headless WebKit only, live at a5f877f, 393 px + 1440 px). One
  live laptop run logged "Importing a module script failed" on sim.html once; 8 further loads were
  clean (reasoned: the test left the page 2.5 s into a cold three.js load). Recheck if Tim reports
  a blank simulator.
  Open with Tim: on the laptop the Draw button wraps to its own row (4 buttons don't fit 288 px);
  a tap dab is a 0.2 mm line, tiny on the preview.

## Rejected / parked
- ~~Short NEMA motors~~ · 2026-10-25 · with direct drive keep the 42 Ncm motors (details §7).

## Map
- App: `index.html`, `js/*.js` (see CLAUDE.md). Build guide: `build.html`, `js/build*.js`,
  `cad/plotter-assembly.scad` -> `tools/make-build-model.py` -> `build/plotter.glb`.
- Printed parts: `cad/plotter-parts.scad` -> `build/stl/*.stl`. Parts reference: `docs/components.md`.
- Tests: `node --test tests/*.test.mjs` · last run 2026-11-14: 133 passed / 0 failed
- Calibrate browser check: `node tools/check-calibrate.mjs phone|desktop <outdir> [baseUrl]`
  (Playwright WebKit from `~/.claude/tools`, on `sim.html?v=2`; 54 checks, writes screenshots and
  `<mode>-report.json` to outdir; about 3 minutes, so use the background option). It pretends a platter
  that needs 4.444 and a carriage that needs 40 at factory 250, `$3=0`, old flipped pen heights,
  then walks every step. Next button is `#calTool [data-act=next]` (it sits outside `.calstep`).
- Connect check: `node tools/check-connect.mjs <outdir> [baseUrl]` (stand-in `navigator.serial`
  on `index.html`, 5 checks: one known port, a dead one, none, two).
- Safeguards browser check: `<scratchpad>/safecheck.mjs phone|desktop <outdir>` pattern = Playwright
  WebKit on `sim.html?v=2`; set `plotterSim.grbl.true[1] = 4.444`, send `$101=1607.143` through
  `#cmdForm.requestSubmit()`, then read `#mMsg`, `[data-jog]` disabled, `#plot`, `#calErr`; for the
  turn test slow the sim (`plotterSim.grbl.speed = 0.05`) near 360° so Stop lands within 1 %.
- Simulator speed buttons for any such run: `#simSpeed [data-speed="20"]`; read results with
  `plotterSim.grbl` (`pos`, `real()`, `wco`, `received`).
- Scratch tools (not in the repo): trimesh for Python 3.14 without scipy (`mesh.section()` fails).
- Draw tool browser check (mouse drag, touch tap, undo, clear, done, move + reopen, reload):
  `node <scratchpad>/draw/drawtest.mjs phone|desktop <outdir>` pattern = Playwright WebKit from
  `~/.claude/tools/node_modules`, `page.mouse` on `#preview`, read `localStorage['polar-plotter-sketch']`.
- Live: https://timothyhadfield.github.io/polar-cnc-plotter/ (`build.html` = guide) · GitHub Pages
  from `main`; every push redeploys.
- Python venv for the model: `C:/Users/timha/AppData/Local/Temp/claude/venv3d` (Temp gets swept:
  if it says "No pyvenv.cfg", `python -m venv --clear` it and `pip install trimesh numpy`).
