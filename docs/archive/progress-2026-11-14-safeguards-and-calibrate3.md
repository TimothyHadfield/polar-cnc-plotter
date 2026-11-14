# progress.md blocks moved here verbatim on 2026-11-14 (cap trim after DEFAULTS)

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
