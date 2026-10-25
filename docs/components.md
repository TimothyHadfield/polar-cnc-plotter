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
| DVD-drive linear stepper (sled + lead screw), leads soldered to a cable | README | Pen lift (Z) |
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

| Part | Closest original | Job (reasoned from photos + shape) | What Tim changed |
|---|---|---|---|
| `big_pulley` 60T, 27.9 bore, 10 tall | gears 60T (7 tall) | Driven pulley glued on the spindle rotor | Taller for his belt (README) |
| `pulley_b` 20T, 5.15 bore | gears 20T | Drive pulley on the platter NEMA 17 shaft | Taller |
| `pulley_a` 20T + `bracket` | idler + bracket | X-belt idler at the far stand (green bracket on the left elbow) | Bracket 25 -> 29 tall for the taller pulley |
| `spool` x4, 21.3 hub, 8 bore | rod supports (14.6 hub) | Push into the PVC fittings and hold the rod ends | Hub = 1/2" PVC pipe OD so it fits the fitting socket; 8.0 bore = press fit on the rod |
| `clip` | pen-holder clip | Pen clamp: the pen sits in the C, a screw squeezes it | Resized for his pen |
| `gear` 15 "teeth", 4.2 bore, 7 counterbore | pen-holder knob | Knurled thumb knob on the clamp screw (photo `pen-carriage.jpg`), not a gear | Nut/head pocket added |
| `motor_plate` 120x73x2 | rotary sheet 11x7 cm | Platter motor mount (NEMA hole + large blank area for the spindle) | Printed instead of plastic sheet; photo shows the steel drive plate in use, so this may be an unused or later version |
| `motor_plate_2` 3 mm stepped | X motor sheet 7.5x4 cm | X motor mount on the right stand (two 4.77 holes 63 mm apart); likely the yellow plate in `full-machine.jpg` | Countersunk motor screws |
| `base_plate` 95x57, block, 2 capped pegs | Z carriage sheet 9.5x5.5 cm | Unknown. Size matches the carriage plate; the pegs could be belt anchors | ? |

Not redrawn by Tim (used from the original or not used): bearing supports, y-supports, PVC screw
holder, z-axis parts (the green DVD-sled frame in `pen-carriage.jpg` is close to the original's).

## 5. Measured findings
- **Big pulley does not match a GT2 belt** (measured from the mesh, 2026-10-25). Tooth tips sit at
  radius 20.0 mm, a 2.09 mm tooth spacing; a GT2 belt is 2.00 mm, so a true GT2 60T has a tip
  radius of about 18.85 mm. Over half a wrap (30 teeth) the error adds up to about 3 mm, more than
  one tooth, so the belt rides on the tooth tips instead of seating and can slip. The 20T pulleys
  are close to GT2 (tip radius 6.05 vs 6.11). This came from the original guide's file.
  Reasoned: riding on the tips makes the real ratio about 127/40 ≈ 3.2 instead of 3, which may be
  why the original guide needed `$101` ≈ 17.1 instead of its computed 14.2.
- TinkerCad NEMA screw holes were 3.0 mm (too tight for M3 when printed); the SCAD uses 3.4.
- The peg caps on `base_plate` floated 0.33 mm above the pegs (would print in mid-air); fixed.

## 6. Expected settings (reasoned, confirm with the Calibrate tool)
| Setting | Formula | Value at 1/16 microstep |
|---|---|---|
| `$100` X steps/mm | 200 x 16 / (16 teeth x 2 mm) | **100** (16T pulley per the Amazon listing) |
| `$101` Y steps/degree | 200 x 16 x (60/20) / 360 | 26.67 (higher if the big pulley slips or rides; see above) |
| `$102` Z steps/mm | depends on the DVD sled (often 20 steps/rev, 3 mm lead) | ~107; original guide used 100 |
| X/Y driver Vref | TMC2209: I_rms ≈ 0.71 x Vref | ~1.0 V (0.7 A) is plenty for a plotter with 1.5 A motors |
| Z driver Vref | small DVD stepper | ~0.3 V |
TMC2209 microstep jumpers (MS1, MS2): none = 1/8, MS1 = 1/32, MS2 = 1/64, both = 1/16.
Without jumpers the formulas above halve (1/8).

## 7. Improvement ideas (not started; Tim decides)
- Reprint the big pulley as a true GT2 60T (keep the 27.9 bore and 44 flanges).
- Fix the platter centre offset mechanically, or measure it and put it in the app's center gap.
- Lighter, stiffer carriage plate; belt clamp instead of zip ties.
- Paper hold-down that doesn't stick up (magnets or a clamp ring) instead of a paper clip.
- Endstop or a printed centre mark so "Set center" is repeatable.

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
2. Which printed parts are on the machine now: is the platter on the steel plate or `motor_plate`?
   Is the yellow X motor plate `motor_plate_2`? What is `base_plate` for?
3. Platter loop belt: 6 mm or 9 mm wide (the listing says both)?
4. Was the platter centre offset ever measured (mm)?
5. Not from Amazon, so still unknown: SC8UU blocks, PVC fittings, plywood size, the disc-drive
   spindle and DVD sled sources.
