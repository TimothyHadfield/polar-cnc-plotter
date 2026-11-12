# Polar CNC Plotter: progress (handoff for Claude)

## START HERE
_Last updated 2026-10-28. For Claude only; Tim doesn't read this. Catch-up authorizes nothing: only
"Authorized next steps" below is approved work._
1. Read `CLAUDE.md` (project, file map, tests), then this file.
2. Skim the last entries of `chat.md`. Full machine-debug narrative 10-24..10-27 and older detail:
   `docs/archive/progress-2026-10-27.md`.
3. Parts, settings formulas, upgrade parts: `docs/components.md` (§3 bought parts, §6 expected `$`
   settings + Vref, §7 improvements incl. what the builders made 2026-10-26).

## Goal right now
Get all three axes moving, then run the app's Calibrate tool. **X (carriage) works.** Y (platter)
and Z (pen lift) don't. Tim is debugging at the machine with his multimeter; Claude guides.

**Update 2026-11-10 (Tim at the machine; he drives the jogs, Claude advises — "I'll tell you what's
happening with everything and you tell me what to do"):** not rebuilt yet, "get the motors correct
before I fully rebuild". Hookup: X header = platter motor, Y = carriage, Z = pen; both NEMA cables
middle-swapped (1-3-2-4). Jogging: only the platter moves, jerking back and forth; carriage and pen
nothing. Tim rejected the Ω/wiggle test (rightly: both coils read 3 Ω on 10-27 and the platter ran
smoothly on X right after). Re-read of the 10-27/28 transcript: carriage on X perfect (10-28 19:11);
then Tim pulled a motor plug off the X header while powered (19:13); X never re-proven since. Next:
(1) carriage motor on X — smooth = X fine, difference is the platter motor/cable (swap the cables at
the motor end); jerky too = X driver hurt by the hot-unplug; (2) X/Y driver-board swap for the dead
Y channel.
**Result 11-10:** carriage on X ALSO jerks -> X driver (or X slot) is the fault, not the platter
motor. Next: Y's TMC2209 into the X slot, carriage on X, jog X. Smooth = old X driver dead (bin; then
Y's trouble is the slot/Uno pin, not its driver). Still jerky = X slot / Uno X pins.
Tim then: swapping the middle wires "usually works". So first: swap the carriage plug's middle
wires on X; if smooth, X driver is fine -> have him write down the working colour order pin 1->4
for each motor (likely the "swapped/not swapped" state got lost across many plug moves).
Result: carriage on X jerky in BOTH middle-wire orders -> X driver/slot confirmed. Next = driver
board swap (Y's black TMC2209 into X slot).
Result: Y's driver in X slot + carriage on X = NO movement at all -> Y driver likely dead (would
explain the dead Y channel); X driver = jerky (half-damaged). Next: old X driver into the Y slot,
carriage on Y header, jog Y (jerky = Y slot works, so both black drivers are bad -> new TMC2209s =
money, Tim's call).
Result: X driver in Y slot = nothing, BUT Tim inserted it with power still connected (may have
killed it). Next: X driver back in X slot, carriage on X: jerky = it survived -> Y slot dead (no
driver ever moves on Y) + Y driver dead; nothing = hot-insert killed it.
Result: X driver back in X slot, carriage (middle-swapped) on X = PERFECT. Same driver/slot/motor
jerked in both orders earlier -> intermittent CONTACT (driver pins in the shield sockets, or the
motor plug), fixed by reseating; not a dead driver. Y driver's "nothing" in the X slot may also be
seating. Next: label carriage plug colours; platter motor on X (find + label its order); then Y
driver pressed firmly into the Y slot, carriage on Y, jog Y.
State then: X drv+carriage on X (works); Y drv+platter on Y = nothing; Z drv+pen on Z = nothing.
Next: the now-proven X driver into the Y slot (power OFF), carriage on Y header, jog Y: moves = Y
slot fine, Y driver dead; nothing = Y slot / Uno Y pins dead. Same method for Z after.
Result: X driver in Y slot (platter left on Y header) = platter JERKS -> Y slot works; old Y driver
dead. Next: swap platter plug middle wires; still jerky both ways -> reseat driver, then carriage on Y.
Result: platter plug "wasn't fully connected"; reseated -> platter PERFECT on Y (with the X driver).
**Both NEMA motors + X and Y slots proven. Old Y driver dead. Only one proven driver** (the old X
one, now in Y) -> carriage needs a driver: new TMC2209s = money, Tim's call (flagged 11-10).
Lesson: most "jerky" was half-seated plugs/drivers. Next: Z (pen) — Ω its 4 wires (brown/red/orange/
yellow) for the pairs (never done), pairs on 1-2 / 3-4, plug fully seated, small Z jogs (app Z feed
200 mm/min); ask which driver is on Z and its Vref.
Tim then jogged the pen motor on the X driver (Vref 1.2 V ≈ 0.85 A): "moved a little the first
time". Told him: very unlikely damaged ($1=25 -> current only during the move + 25 ms); check it's
not hot and both pairs still read their Ω. Next: pen back on its own Z driver at low Vref (red
A4988 ~0.15-0.2 V ≈ 0.19-0.25 A; it was 0.08 V = too weak -> the 10-27 "hum, no move").
Correction (Tim): Z driver is a BLACK TMC2209 (Vref ~0.3 V); it never moved the pen. Pen moved with
the X driver in the Z slot -> Z slot + pen motor OK; X driver back in X. Next: Z driver into the X
slot with the carriage (known-good slot+motor): any motion = driver OK (seating/low current: reseat
in Z, Vref ~0.4 V); nothing = dead like Y -> 2 new drivers needed.
Simplified (Z driver Vref ~0.2 V, too low to judge on the carriage): Z driver reseated in Z, Vref up
to ~0.4 V (≈0.28 A), pen on Z, smallest jog. Moves = done; nothing = Z driver dead.
Result: Z driver at 0.5 V, seated in Z, pen still nothing -> **Z black driver DEAD**. Drivers now:
X black = only proven one; Y black dead; Z black dead; red A4988 (13 kΩ, never proven) spare.
Recommended: red A4988 on Z at ~0.15-0.2 V; buy TMC2209s (money = Tim's call) for the second NEMA.
Tim asked for a for-sure check. Given: (1) one-variable swap = suspect driver in the X slot at the
good X driver's Vref (1.0 V), carriage on X; (2) hold test: `$1=255` in the app's Settings console,
shaft stiff = driver powers the coils, free = output dead (10-27 hold test already had Z loose);
`$1=25` after.
Result (same X slot + carriage, only the driver changed): Z 1.0 V / 7 kΩ no move; Y 1.3 V / 14 kΩ no
move; X 1.2 V / 12 kΩ perfect. **Y and Z black drivers confirmed dead** (Ω/Vref only test the
reference + shorts, not the output stage). Waiting on Tim: buy TMC2209s; red A4988 on Z meanwhile.
Then: GOOD X driver on Z slot, 0.4 V, pen = the NEW micro linear stage (20 steps/rev, 100-300 mA)
-> still no move. Likely the jog is just too small to see: `$102`=250 factory, app 0.1 step = 25
microsteps ≈ 1.5 full steps ≈ 0.04 mm (Claude had said "smallest step" — wrong advice). Also the
slider may be parked at an end of travel. Next: step 10, both directions, watch the lead screw,
feel for buzz; Ω its pairs (expect ~17-50 Ω each).
Result: step 10 still nothing, no sound. Claude on COM3: settings factory ($100-102=250, $1=25), Idle;
4 Z jogs (±2 mm F60, ±5 mm F200) all "ok", MPos Z went 2 -> 0 -> 0 -> GRBL sends Z steps; Tim saw
nothing. Next: carriage NEMA on the Z header (good driver in Z slot, 0.4 V): moves = Z slot fine ->
pen motor wiring/pairs; nothing = Z slot / Uno Z pins.
Result: carriage on Z header: first 5 mm move perfect, then jerky (0.4 V ≈ 0.28 A is weak for a
belted NEMA, or contact) -> **Z slot works**. Problem = the new pen motor or its wiring. Next: Ω its
4 wires, pairs on 1-2 / 3-4, seat, retest.
Result: pen coils = wires 1-3 and 2-4, 20 Ω each (split across the plug). Middle wires swapped ->
**pen stage MOVES** (Claude's ±5 mm Z jogs F150/F60, Tim watched). END OF 11-10: all 3 motors and
all 3 slots proven; Y + Z black drivers dead; only 1 good black + red A4988 (untested). Rule
learned: every motor plug needs its coil pairs on 1-2 / 3-4 (all three were middle-swapped), and
plugs/drivers pushed fully home. Next: Tim buys TMC2209s (his call); meanwhile red A4988 on Z
(~0.15-0.2 V); then `$102` from measured travel per rev, then Calibrate.
**2026-11-11:** Tim installed NEW TMC2209s (same Teyleten 5-pack): all 3 motors move, but the platter
on Y jerks back and forth. Advice: (1) set the new Y driver's Vref (~1.0 V; new boards come
unset); (2) power off, reseat the platter plug fully, coil pairs on 1-2/3-4 (swap middle wires);
(3) still jerky -> platter plug on the X header: smooth = Y driver/seating, jerky = platter cable.
Vref X/Y 1.3 V, Z 0.4 V (fine). Platter jerky in BOTH orders on Y AND on X -> platter plug/cable/
motor. Next: Ω the plug holes to find the real pairs (a 1-4/2-3 pairing can't be fixed by the
middle swap — that's how the pen was found); then wiggle; then bypass the orange/yellow extension.
**Result 11-11: a middle wire of the platter plug wasn't fully connected; fixed. ALL 3 AXES WORK on
their own headers with their own drivers (Tim).** Next: finish the rebuild, then `$102` for the pen
stage (measure travel per rev), then the app's Calibrate (`$100`, `$101`).
**Rebuild ideas (11-11, Tim: "Let me know your ideas before we design anything" = NOTHING
DESIGNED).** Tim fully disassembled; Z stage + X motor plate good; he REMOVED the two iron bars under
the board (sharp edge, extra material). His list: Y gears/platter connection, board depth, X idler
(was a cut nail), PVC-to-board joints, pen line exactly over the platter centre. Proposed: direct
drive (hub + stand) with the platter SCREWED to the hub (3 M3, not glue); motor stand with slots
across the pen line for centring + a draw-and-rotate-180° check; printed PVC foot sockets screwed
from the top (wood screws shorter than the board, so no bars needed) + 4 printed feet; X idler =
bought bearing GT2 idler (money, his call) or the printed pulley_m3 on an M3 bolt; heights set from
his measurements. Waiting on his picks + measurements.
**11-11 later:** Tim rejected screws (heads break the smooth drawing face) AND glue (not removable),
and said neither centres the plate. New proposal (still NOTHING DESIGNED): one-piece PRINTED platter
(~200 mm, 3-4 mm + ribs, printed drawing-face-down so the bed side is the smooth top; aluminium disc
retired) with an integral cone socket underneath that drops onto a cone hub on the motor shaft (set
screw); a flat on the cone carries torque; self-centring, lifts off. Magnets optional (money = Tim).
Tim has Bambu printers big enough for anything here. Artifact:
https://claude.ai/artifact/SPtQF4veYqcU6sS6VpSr3p (v2 shows it).
**11-11 Tim's idea (now the lead):** hub with arms reaching under the plate that pinch its edge
("X shape ... pinches 4 different sides"; "3 or 5 so it's best"). Claude: YES, better than the cone
alone (edge support stops flex/wobble at the rim; centres on the edge; keeps the aluminium disc).
Recommend 3 arms (3 points can't rock; self-centring like a 3-jaw chuck), lips flush with the top,
slightly springy for snap-on/lift-off. Need: disc diameter + roundness + thickness. NOTHING DESIGNED.
**11-11 Tim: platter now sits higher, add ~2" to the PVC legs?** Claude: yes it must rise, but by
~23-25 mm (reasoned, components.md §7: motor 38 + shaft 24 → top ≈64 mm vs 41 before), not 2".
Recommend making the printed PVC foot sockets the spacer (exact height, no extra joint), sized from
Tim's measurement: motor + hub + plate stacked on the board → plate top height, plus the carriage's
lowest point above the board today.
**11-11 rod holders (`spool`):** Tim: rods "just barely too small" to fit at 8.0. Changed spool_bore to
8.2 + new `rod_gauge` STL (8.10/8.15/8.20/8.25/8.30, sizes engraved); STL bores measured 8.2.
**11-11 wobble (Tim: "reduce as much wobble/bend as possible when pressure is applied to the edges";
"how does our hub grab the edges tightly?"):** advised: clamp-style hub (split + M3 pinch bolt) using
the full shaft length, seated ~1 mm above the boss; arms tall at the root, tapering (sag ~ 1/height³);
outer ring joining the arm tips (wheel, 6 spokes, top face printed on the bed) because the 1 mm disc
flexes between 3 arms; grip = 3 thin springy fingers on the ring, inner face ~0.3 mm under the disc
dia and leaning 2-3° inward so the squeeze pins the plate down; PLA. NOTHING DESIGNED.
**11-11 PROTOTYPE 1 DESIGNED (Tim: "scrap the wooden board ... and maybe the PVC pipes ... print them
in 3 separate components (each stand and the bottom plate) ... show me your first prototype/design").**
`cad/printed-frame.scad` → build/stl/frame_base, frame_stand_right, frame_stand_left (print
orientation: on the outer face), frame_wheel. Base 250x135 with motor cage (slots ±3 mm in Y for
pen-line centring, heads sunk 3.5) + Uno tray (USB to the back); stands lap onto stepped base ends,
3 M3x12 + nuts each; rod holes 8.2 x 22 deep (vertical in print); right stand front face = X motor
plate; left = idler fork (M3x25, pulley_m3 + 2 idler_washers). Wheel: 6 spokes + ring, 18 deep,
3 fingers 0.15 mm inside the disc, 2 set screws on the flat 10 apart (clamp dropped: unreachable
inside the spokes), key holes through the ring. Lift 23.5 → rods 98.5/160.5. All < 256 mm, no
supports; all 4 STLs manifold (OpenSCAD). Artifact v4 shows renders. NOT printed. Assumed: rod 300,
shaft 24, disc 200x1, pen_y -11.5, bed 256. Not checked: pen reach ±~90 (reasoned), collisions
beyond eyeballed renders, horizontal 3.4 holes in stands.

**11-11 PROTOTYPE 2 (supersedes proto 1 joints/fingers).** Tim: fingers "pointed upwards" were useless;
"move away from screws/bolts"; nothing may go below the base ("needs to lay flat"); no Arduino screws
("an indent ... is good enough"); "think about how things are assembled" (motor couldn't enter cage;
his "Z axis motor" read as the platter motor). Now: stands join base by **sliding dovetail rails**
(dt_wb 10 / dt_wt 12.2, fit 0.2, groove closed at back = stop), slid on from the front after rods +
carriage + X motor + idler + belt are assembled in the stands. Cage roof has a **23.5 slot open to the
front** (motor slides in shaft-up, 4 screws from above). Uno on **4 pegs** + 3-side rim. Wheel: lip
(disc drops in, 0.15 clearance) + bead 6 below top; new **clamp_ring** (frame_clamp_ring.stl): r92..104.2,
4 hooks snap under bead with 0.2 preload. Remaining non-motor screws: 2 wheel set screws + idler M3
axle. All 5 STLs manifold. Artifact v5. Not checked: dovetail fit in print, hook strength/fit.

**11-11 proto 2 rev (artifact v6).** Tim: "add a edge to one side of the slide ... push it ... until it
hits the edge and it's in the perfect position" → cage gets 2 back-corner stop ribs (stop_w 6, plug
passes between); stands already stop (closed groove). Tim: Arduino comments not applied → Uno now
slides into a pocket from the back (fit 0.3, 0.8 mm overhang lips along long sides from 18 mm past
the USB end, front wall = stop, 4 pads, no pegs). Tim: disc "relies on friction rather than physical
connection" → **aluminium disc dropped** (`platter = "printed"`; "disc" restores old lip version):
wheel has a 2 mm solid top at the old disc-top height, printed face-down (`print_wheel`, the
frame_wheel.stl); clamp-ring hooks sit between key ribs. Bore/nut slot stop under the skin. Not
checked: printed face flatness vs the disc, Uno lip clearance to headers (assumed ~1.2 mm).

**11-11 pen centring audit (artifact v7).** Tim asked to check the whole Y chain. pen_y is now
derived: `rod_y - sc8uu_h (11, spec) - carriage_d (50.0)` = -11.0 (was -11.5: base_plate's
1 mm pad - 1.5 pocket put the stage back 0.5 mm nearer the rods). Fixed: cage stop ribs started at
the wall clearance (motor sat 0.4 back), dovetail groove end was 0.2 long (rods 0.2 forward).
UNKNOWN (Tim to measure): SC8UU depth (/2 = sc8uu_h), and carriage_d = carriage plate back face to
pen centre on the real assembled carriage (slider proud of stage? clip mounting on the new slider?
pen diameter?). The model's clip/knob orientation is itself uncertain (old photo shows a different
holder). Not centring-relevant: X motor plate recess, pen extension, block length.

**11-11 soft pad + hub explainer (artifact v8).** Tim: vinyl under the paper so the pen presses
slightly past the surface. `pad_t = 1` (MEASURE his sheet): pad lies on the flat face, cut to 200,
clamp-ring hooks are pad_t longer (frame_clamp_ring.stl re-exported). A pocket for the pad was
rejected: the face prints on the bed, so the pocket floor would be in mid-air. Advised firm-ish
0.5-1.5 mm (vinyl/rubber/cutting mat), pen ~0.5 mm past the paper. Artifact got a hub cross-section:
D-bore 0.15 loose, 17 mm engagement, 2 set screws 10 apart on the flat + trapped nuts, tightening
order. Reasoned: 0.5° / 0.9 mm edge lean without the screws, removed when both are tight.

**11-11 pre-print check (artifact v9).** Tim: "go through every single part ... until you're confident".
Measured with OpenSCAD intersections (scratchpad clash.scad: carriage stack translated to cx vs each
frame part) + an STL overhang scan (faces within 30° of flat-down, off the bed). Found + fixed:
pen reach — app only uses s >= 0 (polar.js) and needs 90; blocks hit the idler fork at cx -78 and
the plate hits the X motor flange at +78 -> `ix = rod_len/2 - 17` (133): idler side clear at -92,
contact ~-98. **Pen draws on the idler (left) side**; flip GRBL `$3` X bit if direction is wrong.
Inner front gusset (x 148..154) printed over air -> one `tri_x(160, 10)`. Motor cage roof = 10 mm
flat overhang -> base needs supports "build plate only" (only there). Hooks at 0° covered the
set-screw holes -> `hook_ang` 45/135/225/315. Rod holes now end 2 mm past rod_len/2. New part
`fit_test` (frame_fit_test.stl): rail slice, groove slice, rod hole, hub bore, same orientations.
OK as is: belt plane, idler centred (1.9 play/side), plugs (X up; platter out the back between ribs),
wheel ~10 mm over drivers (set Vref before the wheel). Groove's upper flank = 3 mm 20° overhang
(may sag; fit test). Hardware: X motor 4×M3x8, platter 4×M3x6, idler M3x25+nut, 2 M3 grubs+nuts.

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

**Update 2026-10-28 (Tim's reports) — read this first, it supersedes parts of the 10-27 block:**
- **Tim is disassembling the plotter** ("I've redesigned a lot of things"); he has NOT yet said what
  changed. Ask, then update the model/parts. Platter was epoxied to the DVD spindle; told him heat
  (60-120 °C) + twist to free it; spindle is expendable with direct drive.
- Both NEMA cables now at plug order **1-3-2-4** (coils on 1-2 / 3-4). Carriage motor: perfect on
  the X header, **nothing on the Y header** -> Y channel (driver or slot) dead. Driver-board swap
  between X and Y slots still NOT done (Tim swapped cables instead): that's the open test.
- **Platter motor on the X header: jerky in both wire orders** (once turned smoothly, then not).
  Spins freely by hand unpowered, holds when powered -> not mechanical. Suspect an intermittent
  coil connection in Tim's own orange/yellow extension or a plug pin. Next: bench test, motor
  plugged straight into X with no extension; wiggle test with Ω (red-green, blue-black ~3 Ω).
- Tim pulled the Y plug once while powered (idle); afterwards drivers measured unpowered X 9 kΩ,
  Y 7 kΩ, Z 2 kΩ = not shorted. (He also measured once with power on: readings meaningless.)
- Bench plan given (in order): 1 platter motor direct on X; 2 driver-board swap X<->Y with the
  carriage on X (stops = Y driver bad, red spare at ~0.6 V; still works = Y slot bad -> photo of
  shield, A-slot clone, which can't fix a dead Uno D3/D6); 3 Z last.

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
- Ω readings only mean something with 12 V AND USB unplugged. The test only catches shorts (few Ω
  to ~100 Ω); readings differ with probe points/polarity, so it can't prove a driver works.
- Tim says "X motor"/"Y motor" for carriage/platter motor, and sometimes "swapped X and Y" for the
  cables when the driver boards were meant: confirm which.
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
