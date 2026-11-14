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
If the platter is slow (factory `$111`/`$121`: a Test turn can take ~43 s), a speed step was
offered, not built. The older text below is history.

**CALIBRATE 4 (2026-11-14, evening).** Tim: "for the calibration, there shouldn't be any
proceedures that require you to draw on the paper, because it's hard to get the paper and It
needs to be as easy as possible." Rebuilt in `js/calibrate.js`, `STEPS = 5`; the pen is never
lowered except by his own Down clicks in Pen height. (The drawing steps it replaced:
`docs/archive/progress-2026-11-14-calibrate3-drawing-steps.md`.)
1. **Turn test**: as in CALIBRATE 3.
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
   halfway between the two X positions (`centerBetween`); the leftover angle gives the center gap:
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

**SAFEGUARDS (2026-11-13 night).** Tim ran the OLD turn test (app not hard-refreshed): "counted 56
full rotations", Save, "did it again, it completely freaked out ... tried to spin at an extreamly
fast speed"; then the new slow turn "doesn't even move and just kinda jiggles back and forth";
jogs scream too. "Is the motor fine? Can we set up safeguards on our cite which make it so that
problems like these are impossible?"
- **Cause (REASONED; COM3 was busy, `$$` never read):** 56 turns for "360" at factory `$101`=250
  = 1600 steps a turn = TMC2209 with no jumpers = 1/8 -> **true `$101` = 4.444** (and `$100` = 40
  if the pulley is 20T). The old box wanted degrees; 56 gave `$101` = 250 x 360 / 56 = **1607.143**
  (360x too high). A jog then asks ~13 000 steps/s: the motor stalls and screams (harmless).
- **The slow-turn jiggle is NOT explained by 1607** (107 steps/s must creep, tested). Either a
  second bad save made `$101` huge (above 6420 GRBL's 1 unit/min floor makes "slow" fast), or the
  platter plug / driver is half seated again (the 11-10 / 11-11 pattern). Told Tim: hard-refresh,
  read the number in Calibrate step 1, Turn test; still jiggling at a sane number = reseat with
  12 V AND USB out.
- **Tim, after the safeguards:** "I unplugged everything and tried again and it's still not moving
  normally. It's making tiny movements back and forth when I do step 2 for calibrate and joging
  does the same." No more scream = the speed is sane now; tiny back-and-forth at slow speed = one
  coil without current (plug a pin off or half seated, a loose wire, or the Y driver). COM3 still
  busy, `$$` still unread. Tim then swapped the two motor plugs: both motors moved (the carriage on
  Y only in tiny steps = small `$101`, expected); swapped back: **"everything is moving normally
  again"** -> it was contact, cured by replugging (third time: 11-10, 11-11, 11-13). Drivers,
  cables and motors are fine. Tim rejected a question box asking to read/move the plotter from
  Claude's serial session: don't ask again unprompted. **Next = Tim: Calibrate step 2 Turn test.**
  Open (reasoned, never read): if `$111`/`$121` are still factory (500 / 10), a calibrated
  platter tops out near 8°/s (37 steps/s at 4.444); the guide's start values are `$111=7200
  $121=300`. Calibrate does not set these; add a speed step if Tim reports it slow.
- **Built (`js/safe.js`, new):** `RANGE` `$100` 5-800, `$101` 0.5-150 (factory 250 on the platter
  = not calibrated). `machine.js` reads `$$` on connect, after a console `$n=` / `$RST=`, and when
  Calibrate saves (`m.check()`): a bad axis = its jog buttons off, Plot/Resume off ("Calibrate
  first"), red line "Platter steps look wrong ($101 = …). Open Calibrate." Nothing read = both
  axes off. Main-panel jog feeds capped in steps/s (`JOG_SPS` X 8000, Y 4000, Z 1000).
- **Calibrate:** `saveSetting` refuses a value outside the range ("Platter steps must be 0.5 to
  150. Not saved."); nudges use `nudgeJog` (step cap `NUDGE` X 1000, Y 400, Z 400); `slowJog` /
  `jogFeed` throw when the feed would be under GRBL's 1 unit/min; steps per unit above `EXTREME`
  5000 (or 0) are reset to `START` (100 / 8.889 / 250) before a move (`sane`), with a message;
  the Turn-direction quarter turn needs a plausible `$101`, Half turn needs both axes plausible;
  **Set center turns into Stop** while it runs (`stopMove` = `grbl.stop()` + pen up); closing the
  tool stops any move. A bad value shows in red.
- **Not covered, told Tim:** moves typed by hand into the Settings console; a value inside the
  range but still wrong (e.g. Stop at half a turn).

**CALIBRATE 3 (2026-11-14).** Tim ran the tool on the real plotter (first time) and asked: "I'm
not really sure what the first step is but it's not necessary. For step 2, allow the user to
"test" it which means to have it rotate in what it thinks is a full circle. If it's not in a full
circle, the user will either click the forward or back button to show where the true full circle
mark is, or they will redo step 2. For the linear motor, any time the cite says "down", the motor
goes up, and vice versa, so I think we put it upside down (which is the way that I want it), so
reverse the directions on the cite. For step 3, instead of the slow movement, just have the user
click down or up to mark exactly where the pen is touching the plate ... move it up a little bit
off that and then put it back down to draw. For step 4, I'm not really sure what's happening ...
make the instructions more clear. Step 4 should be a carraige motor calibration though." Mid-turn
he added: "if you click connect and there's only one option to connect to, it automatically
connects". Built in `js/calibrate.js` (6 steps then, 5 since CALIBRATE 4; the old one is in
`docs/archive/progress-2026-11-14-calibrate2-and-driver-debug.md`):
1. **Turn test**: Turn slowly / Stop, Back / Further, Save as before, plus **Test** = one full turn
   by the plotter's count (`fullTurn`, a jog at 400 steps/s, the button is Stop meanwhile). When
   it ends, Back / Further mark the true full circle and Save takes the value AS MEASURED
   (`turnSteps(old, moved, tested)`: no rounding to a plain motor's value after Test, since that
   value just missed). Save is off when nothing would change. Test is off until `$101` is plausible.
2. **Pen height**: Up / Down clicks (0.02 / 0.1 / 0.5), then **Touching** = `touchLift`: this Z is
   pen down, lift `LIFT` = 100 motor steps (0.4 units at `$102`=250; about 2 mm REASONED for a
   20-step, 3 mm-lead stage at 1/8), `G92 Z0` there, save penUp 0 / penDown -(lift). The slow Z
   moves are gone (`SLOW.Z` too).
3. to 6. (Carriage test by a drawn line, Find center by a drawn circle, Center gap, Mirror check):
   **replaced by CALIBRATE 4 above**. The X "Reverse direction" switch is still in the Carriage test.
- **Pen direction:** new setting `zFlip` (default TRUE = Tim's upside-down stage). `machine.js`
  `check()` -> `penDirection()` makes GRBL's `$3` bit 2 match it on connect and after every
  settings read (`setDirection`), logging `> $3=4 (pen direction)`; so Z+ lifts in everything the
  app sends. If that write happens and the saved heights were measured the old way (penUp <
  penDown) they are negated (`uprightPen`). The old in-app flip and the main panel's "penUp <
  penDown reverses ▲" rule are gone. Pen step's "Reverse direction" switch toggles `zFlip` (shown
  only when the plotter reports `$3`). ASSUMES his `$3` bit 2 is 0 now (never read): if the pen
  still runs backwards after this, he flips that switch.
- **Connect:** `pickPort(serial, auto)` in `grbl.js`: exactly one port the browser already knows
  (`getPorts()`) = opened with no list; none or several = the browser's list; if the remembered
  port fails, the next Connect shows the list (`askPort`). The very first pick cannot be skipped
  (browser rule). Whether Chrome keeps the permission after unplugging is REASONED (Windows: yes).
- `api.setSettings` now also updates the Settings sheet's inputs. Wording: "Carriage" replaces
  "Rail" in the warnings (`safe.js` `NAME`). Messages name steps, not numbers.
- **Left / Right (Tim, 11-14 later: "make the carraight motor say left and right, not in and
  out").** Main panel and Calibrate: **Left = X+ (away from the center, toward the idler), Right =
  X- (toward the carriage motor)**, as seen from the front with the carriage motor on the right
  (the simulator's view; `sim.js` `dx = -x`). Which side is left on his real plotter is REASONED
  from the model; if Left goes right, the Carriage test's "Reverse direction" switch fixes it.
- Unchanged from before: slow speeds in motor steps per second (`SLOW` X 300, Y 107), `saveSetting`
  puts the work zero back after a `$100`/`$101` change, `Grbl.stop()` restores Z when `penZero` is set.

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
  - **Base** (`printed-frame.scad`): cage centre `cage_y = 9` (20 mm behind the first print) and
    the motor **slides front to back `motor_adj = +-10`** (shaft y -1..19 = 10 to 30 mm behind the
    first print) in long screw slots; back ribs are now only the end of travel. Why adjustable
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
- Tests: `node --test tests/*.test.mjs` · last run 2026-11-14: 132 passed / 0 failed
- Calibrate browser check: `node tools/check-calibrate.mjs phone|desktop <outdir> [baseUrl]`
  (Playwright WebKit from `~/.claude/tools`, on `sim.html?v=2`; 41 checks, writes screenshots and
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
