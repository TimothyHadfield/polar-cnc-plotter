# Components: what every part is and what it does

Started 2026-10-25. Reference for measurements, improvements and a possible better Instructables
guide. **Measured** = checked from a file or photo. **Reasoned** = a guess, to be confirmed by Tim.
Sources: the original guide ([Polar CNC Plotter V2 by Deepaksh123](https://www.instructables.com/Polar-CNC-Plotter-V2/)),
its STL files, Tim's TinkerCad export (now [cad/plotter-parts.scad](../cad/plotter-parts.scad)),
the build photos in [docs/photos/](photos/), the README, and Tim's own words in past chats.

## 1. How the machine works (one paragraph)
Polar plotter: the pen rides a carriage on two 8 mm steel rods. A NEMA 17 stepper pulls the
carriage with a GT2 belt, which sets the **radius (X, mm)**. A round aluminium platter sits on a
salvaged disc-drive spindle motor that is used only as a bearing. A second NEMA 17 under the plate
turns it through a small-to-big belt reduction, which sets the **angle (Y, degrees)**. A linear
stepper salvaged from a DVD drive lifts the pen **(Z)**. Arduino Uno R3 + CNC Shield V3 +
TMC2209 drivers run GRBL 1.1h, fed by a 12 V 5 A supply.

## 1b. How it is assembled (Tim 2026-10-25: "nearly identical to the machine in the instructables")
From the guide's step photos (steps 2-9) plus Tim's photos:
- **Base:** flat board 40x13 cm. Two square iron bars underneath run the long way as feet, so
  the bolt heads/nuts under the board clear the table. Two printed PVC screw holders are bolted at
  the board ends; the stands slip over them.
- **Stands (x2), one at each end:** bottom socket -> tee -> short pipe -> elbow, glued. The tee
  and elbow openings both face inward, so the two 8 mm rods run **one above the other** (a
  vertical plane), each plugged in with a printed rod support. Stand spacing ~300 mm.
- **Carriage:** a **vertical** plate facing the front. Bearings on its back ride the two rods; the
  pen holder / Z stage is on its front, pen pointing down at the platter. The belt is fixed to the
  plate's back.
- **X drive:** stepper on a small plate screwed to one stand, between the rods, shaft pointing
  forward; 16T pulley on it. The idler pulley in its bracket sits on the other stand. The belt
  runs horizontally between the two rods. (Guide: motor left, idler right; Tim's machine is
  mirrored: motor right, idler left.)
- **Rotary (Y):** spindle (used as a bearing) and stepper side by side on the rotary plate, belt
  20T -> 60T on top. In the guide the plate stands on 4 printed spacers (y-supports, 26 mm) in
  the middle of the base, under the rail. The platter is a disc with a steel strip and a CD on its
  underside; the spindle's magnet holds it, the CD hole centres it. Tim's NEMA 17 is too tall,
  so he sank the motor through/below the board.
- **Pen line:** the pen's travel line has to pass over the spindle centre; Tim's misses it by a
  few mm (the app's center gap setting corrects this).
- **Electronics:** Uno + CNC shield on the base behind the platter, beside the rotary plate;
  X, Y, Z motor plugs on the shield; 12 V into the shield's screw terminal.

## 2. The original guide's parts and what each one does

| Original part | What it does |
|---|---|
| Arduino Uno + CNC Shield V3 | Runs GRBL; the shield holds the drivers and the motor plugs |
| 3x A4988 drivers | Turn GRBL's step/dir pulses into motor coil current |
| 2x small bipolar steppers (3.75°, 96 steps/rev) | Radius axis and platter. Tim uses NEMA 17s instead |
| CD-ROM linear stepper (sled) | Pen up/down (Z) |
| GT2 6 mm open belt 300 mm + GT2 16T pulley + idler | Pulls the carriage along the rods |
| 4x SC8UU bearing blocks + 2x 8 mm x 300 mm rods | Straight, low-friction carriage travel |
| 1/2" PVC elbows, tees, sockets, pipe | The two stands that hold the rods 300 mm apart |
| Printed rod supports (26 mm flange, 8 mm bore) | Plug into the PVC fittings and hold the rod ends |
| Printed y-supports, PVC screw holders | Spacers and screw mounts for the stands |
| Laptop CD-ROM BLDC spindle (magnet on top) | Platter bearing; its magnet holds a detachable table |
| GT2 closed belt 6 mm x 230 mm + 60T/20T printed pulleys | Platter drive with a reduction (more torque, finer angle steps) |
| 20 cm aluminium disc + iron strip + CD on the back | The platter; the iron sticks to the spindle's magnet |
| Plastic sheets (X motor 7.5x4, rotary 11x7, Z carriage 9.5x5.5 cm) | Motor mounts and the carriage plate |
| Plywood 40x13 cm, 5 mm | Base board |
| 3 mm x 82 mm rods + 2 pen springs | Pen-lift slider: the pen is pressed down by springs |
| Printed pen holder, clip, knob | Hold the pen on the Z slider |
| 12 V supply, 2.1x5.5 jack, zip ties, paper clips | Power; the belt is zip-tied to the carriage; clips hold the paper |

Original GRBL values: `$100=47.620`, `$101=17.132`, `$102=100`. The guide says 12:40 gearing and
1/16 microstepping, works out `$101=14.22`, then uses 17.1 to 17.3 in practice.

## 3. Tim's machine: bought and salvaged parts

| Part | Measured / reasoned | Job |
|---|---|---|
| 3x NEMA 17 STEPPERONLINE `17HE15-1504S`: 42x42x38 mm, 1.8° (200 steps/rev), 1.5 A/phase, 2.3 Ω/phase, 42 Ncm holding, 4 wires, 1 m cable | Amazon listing (Tim, 2026-10-25) | X carriage, Y platter (+1 spare) |
| Wire colours black, blue, green, red | Tim, 2026-10-24 | Coil pairs: Ohm test should read ~2.3 Ω across a pair, OL across pairs |
| 4x SC8UU aluminium bearing blocks | Photo | Carriage, two per rod |
| 2x 8 mm x 300 mm case-hardened chrome rods (Litoexpe) | Amazon listing | Carriage rails |
| GT2 open belt, 2 mm pitch, 6 mm wide, 5 m (cut to length) | Amazon listing | X belt (carriage) |
| 2x GT2 closed loop 220 mm (uxcell, sold as "220-2GT-9" but listed 6 mm wide) | Amazon listing; check width, "-9" usually means 9 mm | Platter belt. With 20T + 60T GT2 pulleys this loop puts the shafts ~68 mm apart (reasoned) |
| 5x aluminium GT2 pulleys, **16 teeth**, 5 mm bore, 6 mm belt (WINSINN) | Amazon listing | X motor pulley (the platter uses the printed 20T instead, per photo) |
| 2x aluminium discs, 5052, 200 mm (8") x 1 mm (uxcell) | Amazon listing | Platter (one spare) |
| 5x stainless rods 3 mm x 100 mm (304) | Amazon listing | Pen-lift slider rails (original used 3 x 82 mm) |
| Salvaged disc-drive spindle (PCB marked `M3B912`) on a cut steel drive plate | Photo `rotary-platter.jpg` | Platter bearing; the NEMA 17 bolts under the same plate |
| DVD-drive linear stepper (sled + lead screw), leads soldered to a cable | README | Pen lift (Z) on the built machine |
| **New Z (ordered Oct 2026):** QINIZX micro linear stage, 2-phase 4-wire, 18° step (20 steps/rev), 5-12 V 100-300 mA, 48 mm stroke (1.89"), lead screw 60 mm x ~2.8 mm, motor Ø15 x 11 mm, stage 81 x 25 x 20 mm, slider 25 x 10 x 14 mm, 120 mm wires | Amazon listing (Tim, 2026-10-25) | Replaces the DVD sled, the big printed pen-holder frame and the 3 mm slider rods (Tim's own review recommended it) |
| 1/2" PVC elbows and tees, white pipe | Photo | Rod stands |
| Plywood base | Photo | Base |
| Arduino Uno R3 clone (ATmega328P, USB cable; LUIRSAY per past chat) | Amazon listing + past chat 2026-09-28 | GRBL. The Uno R4 WiFi failed: GRBL needs the 8-bit ATmega328P |
| CNC Shield V3 ("V3 Engraver" expansion board) | Amazon listing | Driver carrier |
| 5x TMC2209 V2.0 StepStick (Teyleten Robot), 2.5 A peak, UART capable (used standalone) | Amazon listing; socket layout measured 2026-10-24 | Quiet drivers; replaced A4988s that ran loud/rough (one ran hot) |
| 5x A4988 with heat sinks (hiBCTR, red, up to 35 V) | Amazon listing | Spares |
| 12 V 5 A supply on the shield's screw terminal | Tim 2026-10-24 (old one was 12 V 0.5 A, too weak) | Motor power |
| 50 ft spiral cable wrap, 6 mm (XHF, bag says SWB-06) | Amazon listing | Wire management |
| 6x 5.5 x 2.1 mm threaded panel-mount DC jacks with pigtails | Amazon listing | Power input jack |
| #4-40 x 1/2" flat-head screws, zip ties, super glue | Photo | Fastening; the belt is zip-tied to the carriage |
| Paper clip | Photo `full-machine.jpg` | Holds the paper on the platter |
| 2x SG90 servos, A2212 brushless motor, breadboard, resistors | Photo `materials-printed.jpg` | Not in the finished machine (reasoned: leftovers or an earlier pen-lift idea) |

## 4. Tim's printed parts ([cad/plotter-parts.scad](../cad/plotter-parts.scad))

Tim explained these himself on 2026-10-25 (confirmed, not guessed). This plate is his **new
version** for the rebuild; the photos show the old machine (scrap plastic, then thin metal plates).

| Part | Closest original | Job (Tim's words, condensed) | What Tim changed |
|---|---|---|---|
| `spool` x4, 21.3 hub, 8 bore | rod supports (14.6 hub) | Thicker rod supports: touch the inside of the PVC pipe and the rod at the same time, so they can be glued instead of wrapped in double-sided tape | Hub fills the pipe |
| `clip` + `gear` (15-tooth knurled knob, 4.2 bore, 7 counterbore) | pen-holder clip + knob | Pen holder, same as the original | Removed the original's other pen-holder piece: the new linear stage does that job |
| `motor_plate` 120x73x2 (largest, almost flat) | rotary sheet 11x7 cm | Platter plate: one side holds whatever spins the platter (spindle/axle), the other the platter NEMA 17 | Printed instead of scrap plastic |
| `motor_plate_2` 3 mm, cut-out corners | X motor sheet 7.5x4 cm | X axis motor plate: holds the stepper that drives the carriage belt, solidly fixed to the PVC stand. The two large 4.77 holes take screws drilled into the PVC pipe | Printed |
| `base_plate` 95x57, block, 2 capped pegs | Z carriage sheet 9.5x5.5 cm | Pen-carriage plate: bolts to the linear bearing blocks on one side and the new linear stage on the other. The two pegs are where the belt attaches to pull it | Printed; pegs replace the bolt + zip-tie belt anchor |
| `big_pulley` 60T + `pulley_b` 20T | gears 60T/20T | Platter belt drive, same as the original | Taller for the belt |
| `pulley_a` 20T + `bracket` | idler + bracket | X belt idler pulley and its holder, same as the original | Taller |

**Motor recess:** both motor plates have a round recess plus four holes that match the NEMA 17's
screws. The recess takes the round boss on the motor face, so the motor sits flat and the screws
can tighten. **Known issue (Tim):** the recess isn't deep enough on one plate, he thinks the
largest one. Measured in the SCAD: `motor_plate` recess is **1 mm** deep, `motor_plate_2` is
**2 mm**. A NEMA 17 boss is normally ~2 mm tall x 22 mm wide (check with calipers), so
`motor_plate` is the short one. **Fixed 2026-10-26:** `motor_plate` recess is now 2 mm
(`mp_recess`). The plate is only 2 mm thick, so the motor side got a 1 mm pad the size of the motor
face (42x42, trimmed to the plate edge): the motor sits flat on it across all four screws and the
recess keeps a 1 mm floor. Outline, holes and the flat print-bed face are unchanged.
**Hardware:** the four motor screws need to be 1 mm longer than before.
**Measure first:** the boss height on Tim's motor (calipers from the motor face to the top of the
round boss). If it is over 2 mm, raise `mp_recess` and `mp_pad` by the same amount.

### New parts added 2026-10-26 (STLs in `build/stl/`)
| Part | What it is | Hardware | Measure first |
|---|---|---|---|
| `pulley_m3` + `idler_washer` (prints 2) | X idler, free stopgap for the cut nail: `pulley_a`'s 20 teeth with a 3.3 bore and a 0.5 mm hub (7 wide) each side, so it spins on an M3 bolt through the bracket's 3.1 holes. The two 1.2 mm washers fill the bracket's 14 mm inner gap (11.15 pulley + 0.4 play) and keep it centred | M3 x 25 bolt + nut (nylock, snug, not tight). If the bore prints tight, drill it with a 1/8" bit | The bracket's inner gap (should be 14 mm). The better fix (bought GT2 20T idler with bearings, §7) stays the recommendation |
| `big_pulley_gt2` | True GT2 60T: same 27.9 bore, 44 flanges, 10 mm height as `big_pulley`, but GT2 tooth shape on a 2.00 mm pitch. Measured from the STL: outside diameter 37.69 mm, 60 teeth. Tooth outline from droftarts' Parametric Pulley (Thingiverse 16627). `big_pulley` is kept as it was | none | Nothing new; only needed if the belt drive stays (direct drive drops it) |
| `paper_ring` | Thin ring (200 mm across, 8 mm band, 1.2 mm thick; 2 mm at the 4 magnet pads) that holds the paper's edge flat on the platter. Covers radius 92-100, so drawings must stay inside radius ~90 | `ring_magnets = true`: 8 disc magnets 6x2 mm (4 pressed + glued in the ring, 4 glued under the platter rim at the same spots, since the aluminium platter isn't magnetic; steel washers work for the bottom 4). `ring_magnets = false`: 4 tape tabs instead, $0 | Platter diameter (200?), whether the printer bed fits a 200 mm ring, magnet size if bought |

**No `center_mark`:** the platter top is a plain 1 mm aluminium disc (the CD's hole that centres it
is underneath, on the spindle) and the paper covers it, so a drop-in mark has nothing to locate on.
It would need a centre feature first (e.g. a small dimple punched at the exact centre), Tim's call.

Not redrawn by Tim (used from the original or not used): bearing supports, y-supports, PVC screw
holder, z-axis parts (the green DVD-sled frame in `pen-carriage.jpg` is close to the original's).

## 5. Measured findings
- **Big pulley does not match a GT2 belt** (measured from the mesh, 2026-10-25). Tooth tips sit at
  radius 20.0 mm, a 2.09 mm tooth spacing; a GT2 belt is 2.00 mm, so a true GT2 60T has a tip
  radius of about 18.85 mm. Over half a wrap (30 teeth) the error adds up to about 3 mm, more than
  one tooth, so the belt rides on the tooth tips instead of seating and can slip. The 20T pulleys
  are close to GT2 (tip radius 6.05 vs 6.11, root 5.18 vs 5.35; belt pitch circle 39.6 vs 40 mm,
  about 0.2 mm over the 10 teeth in contact), so `pulley_b` is left as is. This came from the
  original guide's file. **Built 2026-10-26:** `big_pulley_gt2` (true GT2 60T, see §4).
  Reasoned: riding on the tips makes the real ratio about 127/40 ≈ 3.2 instead of 3, which may be
  why the original guide needed `$101` ≈ 17.1 instead of its computed 14.2.
- TinkerCad NEMA screw holes were 3.0 mm (too tight for M3 when printed); the SCAD uses 3.4.
- The peg caps on `base_plate` floated 0.33 mm above the pegs (would print in mid-air); fixed.

## 6. Expected settings (reasoned, confirm with the Calibrate tool)
| Setting | Formula | Value at 1/16 microstep |
|---|---|---|
| `$100` X steps/mm | 200 x 16 / (16 teeth x 2 mm) | **100** (16T pulley per the Amazon listing) |
| `$101` Y steps/degree | 200 x 16 x (60/20) / 360 | 26.67 (higher if the big pulley slips or rides; see above) |
| `$102` Z steps/mm | new stage: 20 steps/rev x 16 / screw lead (not listed; measure travel per turn) | 640 if the lead is 0.5 mm (common on these, unconfirmed); original guide used 100 |
| X/Y driver Vref | TMC2209: I_rms ≈ 0.71 x Vref | ~1.0 V (0.7 A) is plenty for a plotter with 1.5 A motors |
| Z driver Vref | new stage is rated 100-300 mA | ~0.3 V (≈0.2 A) |
TMC2209 microstep jumpers (MS1, MS2): none = 1/8, MS1 = 1/32, MS2 = 1/64, both = 1/16.
Without jumpers the formulas above halve (1/8).

## 7. Improvement ideas (Tim decides)
- **Built 2026-10-26 (§4):** `big_pulley_gt2` (true GT2 60T, 27.9 bore, 44 flanges).
- Fix the platter centre offset mechanically, or measure it and put it in the app's center gap.
- Lighter, stiffer carriage plate; belt clamp instead of zip ties.
- **Built 2026-10-26 (§4):** `paper_ring`, a 1.2 mm clamp ring with magnet pockets or tape tabs,
  instead of a paper clip.
- Endstop or a printed centre mark so "Set center" is repeatable. A centre mark was skipped: the
  platter has no centre feature on top (§4).
- (Suggested to Tim 2026-10-25) X idler: replace the nail with a bought GT2 20T idler that has
  bearings inside, 3 mm bore, on an M3 bolt + nylock nut through the bracket's 3.1 mm holes
  (washers either side). This is still the better option. **Free stopgap built 2026-10-26 (§4):**
  `pulley_m3` (3.3 bore + hubs) and two `idler_washer`s on an M3 x 25 bolt.
- (Suggested to Tim 2026-10-25) Platter: direct drive. Platter hub straight on the NEMA 17 shaft
  (printed hub with a D-shaped 5 mm bore + set screw, or a 5 mm flange coupler); drops the spindle,
  both platter pulleys, the closed belt and the off-centre problem. `$101` becomes
  200 x 16 / 360 = 8.89 steps/degree: 0.11 deg per microstep, 0.2 mm at 100 mm radius (reasoned).
  Fallback if more torque is needed: lazy Susan bearing + a true GT2 pulley pair.
  - **Built 2026-10-26 (printable, not yet printed):** two new parts in
    [cad/plotter-parts.scad](../cad/plotter-parts.scad), STLs in `build/stl/`.
    - `platter_hub` (40 dia x 17 mm): 5 mm D-bore (5.15 round, 4.65 across the flat), M3 set screw
      onto the shaft's flat with a captive M3 nut pushed up a slot from below, 40 mm flat glue face
      on top with a 14.7 mm ring that drops into the CD's 15 mm hole, so the platter sits centred.
      The platter (disc + CD) is glued to that face (super glue or 2-part epoxy); hub and platter
      then come off the shaft together by loosening the set screw. The steel strip is no longer
      needed (no magnet). No CD? Set `reg_d = 0` and glue the disc straight on.
    - `motor_stand` (69 x 49 x 42.5 mm): holds the platter NEMA 17 upright on the board by its four
      face screws; two side walls (open front and back for the plug), feet with 3.5 mm holes for
      small wood screws shorter than the board, so nothing pokes out underneath. **No hole in the
      board and no steel bars.** Place it so the pen's line passes over the shaft.
    - **Print:** hub collar-down (flat bottom on the bed, glue face up; the flange has a 45° cone
      under it, so no supports), 100% infill or 6 walls, 0.2 mm layers. Stand upright, feet on
      the bed, 20-30% infill; its top plate bridges 43 mm, so turn supports on if the printer
      bridges badly.
    - **Hardware:** 1 M3 nut + 1 M3 set screw (M3 x 6 grub, or any M3 x 8-10 screw), 4 M3 x 8
      screws (stand to motor), 4 small wood screws (or hot glue), glue for the platter. $0 if
      these are in the parts bin.
    - **New `$101` = 200 x 16 / 360 = 8.89 steps/degree** at 1/16 microstepping (4.44 at 1/8).
    - **Platter height (reasoned from catalogue sizes):** the shaft tip, not the motor body, sets
      it. Motor 38 + 0.5 gap + shaft 24 puts the CD's underside at about 61.5 mm and the platter
      top at about **64 mm** above the board, so about 23 mm higher than the model's current
      41 mm (the "~6 mm" above was wrong: it left out the shaft). Check that the bearing blocks and
      carriage still clear the platter and paper clip, and clamp the pen ~23 mm higher in its clip.
      If they don't clear: Tim's own idea, a taller PVC stand piece.
    - **Measure first with calipers:** shaft length above the motor face (24 assumed) and how far
      the D flat runs down from the tip (15 assumed; the set screw sits 12 mm below the tip),
      across the flat (4.5 assumed), motor body length without the boss (38 assumed), the CD hole
      (15). Change the numbers at the top of the section if they differ.
- (Suggested to Tim 2026-10-25) Motor size: Tim noted the steel bars + board hole exist only
  because the 38 mm NEMA is too tall, and offered short motors (42x42x20.5 mm, 13 Ncm; or
  STEPPERONLINE short body 16 Ncm, 1.0 A, 3.5 ohm). Advice: with direct drive keep the 42 Ncm motors
  he owns (no gearing, so torque matters more); the motor stands on the board, platter ~6 mm higher
  than now (reasoned from the model), so no hole, no bars, no taller stands. Only if the belt
  drive stays: the 16 Ncm STEPPERONLINE short body fits under the 26 mm plate.

## 8. Tim's own write-ups (found 2026-10-25)
- **[Polar CNC Plotter Review](https://docs.google.com/document/d/1hw1lb1qYNkZk2Jz47sUAbBguTbjWJZgsS9VIIwJpNko/edit)**
  (Google Doc, Apr-Jun 2026): his parts list with links and prices, tools (pipe cutters, drill),
  cost (1 machine $192 from nothing, 2 = $308, 3 = $427) and build notes. **This is the seed of
  the improved guide.** His notes, condensed:
  - Printed gears too thin for the belt: make them ~10 mm wide. Original bearing supports not needed
    for his bearing blocks.
  - Buy the 5 V 2-phase linear rail (48 mm stroke, ~$15) instead of salvaging a DVD sled: no
    soldering, no big pen-holder print, more compact.
  - 1 mm scrap plastic axis plates were too flimsy; replaced with thin metal. 3D-printed plates
    would be better (no cutting/drilling, holes in the right place).
  - Uno R4 WiFi can't run GRBL (the doc says "switch to a regular Arduino UNO R4"; means R3).
  - Unsure why the original has two square iron bars under the base. Bolts poke through the
    wood; the big NEMA 17 puts the platter too high, so he sank the motor below the board
    (thinks it's worse). Fixes: taller PVC stands (extra coupler) or a shorter motor.
  - The spindle motor is only an axle; a bolt and washers or a cheap bought bearing could replace
    it (resize the big pulley bore to match).
  - Idea: 3D-print the whole base platform so stand and motor positions are exact.
  - Rod supports into PVC: double-sided tape fails (wrong thickness, sticks too early). Size the
    printed plug to fit and super-glue it.
  - X idler pulley axle is a small nail and tape; a smoother axle would help.
  - Belt anchor: small bolt through the carriage plate, belt wrapped, zip-tied tight, nut on top.
    The belt sits off the rods' centre line, so it bows (`<===>`), adding side friction that grows
    near the idler. Fix: recess the nuts (printed plate) or space the belt out with extra nuts.
- ECE 1000 reports (proposal, progress, final) in
  `OneDrive/Documents/Projects & Hobbies/CNC & Plotter/docs/reports/`: same story; final report
  says drawings came out unintelligible, blamed on the Cartesian-to-polar conversion.
- **Reasoned, worth checking:** the old `GRBL Configuration.txt` there holds the original
  author's `$100=47.620` / `$101=17.132`. With Tim's NEMA 17 + 16T pulley the right values are
  ~100 and ~26.7 (1/16). If those were never changed, drawings came out at about half size in
  radius and two-thirds in angle, which alone scrambles any picture.

## 9. Open questions for Tim
Answered 2026-10-25 by the Amazon list: X pulley 16T, belts 6 mm GT2, rods 300 mm, platter 200 mm.
1. Are microstep jumpers fitted under the drivers? (sets the 1/8 vs 1/16 numbers)
2. (Answered 2026-10-25: printed parts explained in section 4.)
3. Platter loop belt: 6 mm or 9 mm wide (the listing says both)?
4. Was the platter centre offset ever measured (mm)?
5. Not from Amazon, so still unknown: SC8UU blocks, PVC fittings, plywood size, the disc-drive
   spindle and DVD sled sources.
