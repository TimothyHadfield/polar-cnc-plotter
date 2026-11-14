# Archived from progress.md on 2026-11-14

Moved verbatim to keep progress.md under its size cap. Both parts are superseded: the Calibrate
tool was reworked on 2026-11-14 (CALIBRATE 3 in progress.md), and all three axes have moved on
their own headers with new TMC2209s since 2026-11-11.

## Part 1: CALIBRATE 2 (the tool as built 2026-11-13, before the 11-14 rework)

**CALIBRATE 2 (2026-11-13 late).** Tim asked for calibration by Stop button: "have the plate move
slowly in a circle until the user says stop at 360 degrees ... have the linear motor slowly move
down until the user clicks stop ... For the X axis maybe Calibrate it so that it knows where the
edges of the plate are, and then it can calculate where the center is itself?" Built in
`js/calibrate.js` (6 steps):
1. Current settings (+ calculator), unchanged.
2. Turn test: **Turn slowly / Stop** when a taped mark comes back, Back / Further nudges (0.5, 2,
   10°), New `$101` = old × units travelled / 360. Within 2 % of an exact direct-drive value
   (200 or 400 full steps × 1..64 microsteps / 360) it shows that value plus "measured x".
3. Pen heights: **Lower slowly / Stop** at the paper, **Raise slowly / Stop** clear of it. Then
   `G92 Z0` at the up height (`grbl.setPenZero()`, `grbl.penZero`), settings saved as penUp 0 /
   penDown = -(lift). So the heights hold in a later session as long as the pen was left up
   (the app parks it up). ▲▼ move whichever height was set last. "Reverse direction" switch = Lower
   jogs Z+ (no firmware write).
4. Find center: jog out, **Draw circle** (pen down, Y 370, pen up), **Cross slowly / Stop** over
   the line on the far side (X-), **Set center** = go to the midpoint, `G92 X0 Y0`. "Plotter says
   N mm" vs "Ruler says" -> New `$100`. His literal "edges of the plate" is out of reach (93 mm one
   side, 78 the other, plate edge at 100), so the circle stands in. A "Reverse direction" switch
   (writes `$3` bit 0, clears the center) shows only when `$$` reports `$3` (real GRBL, not the
   pretend ones).
5. Center gap (Draw test, Halves apart, Other side), 6. Mirror check: as before.
- Slow speeds are in motor steps per second (`SLOW`: X 300, Y 107, Z 150), capped so the stop takes
  at most `coast` steps at the current `$12x`; a jog that ends by itself is not counted.
- Saving `$100`/`$101` moves every reading (GRBL counts steps): `saveSetting(grbl, n, v, old)` puts
  the work zero back with `G92` and updates `grbl.center`. FakeGrbl/SimGrbl model this (`rescale`);
  SimGrbl keeps the machine's real scale in `true` and reports real positions with `real()`.
- `Grbl.stop()` now restores Z too when `penZero` is set (a soft reset drops G92).
- The old "Turn once / It turned" and "Move 20 mm" tests and `testMove` are gone.

## Part 2: the 2026-11-10 / 11-11 driver and wiring debug

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
