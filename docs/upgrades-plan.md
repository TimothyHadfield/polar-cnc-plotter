# Upgrades plan (2026-11-15)

Tim, after seeing the upgrade-ideas artifact (https://claude.ai/artifact/McW2e5CAoqo8RtPp6u54a1) and the
wire clips: "For the other designs, I like them enough I want you to adjust our current 3D print
designs in order to fit with them. Make sure that you consider that the multiple adjustments might
adjust the design of multiple different prints that have nothing to do with them, and also will
need to work together with the space that they have. Consider everything you can to make the output
perfect. You can also build the software to the cite that you mentioned as an improvement."

Earlier the same day: wire hooks ("add little hooks or whatnot on the stands, new tray, or base plate
for the wires to easily and cleanly route back to the arduino in a specific way. Make sure that you
think about what orientation the X carraige motor is facing") -> BUILT as stands 3 (7a7e562).

## What gets built
| # | Upgrade | Prints touched | Owner |
|---|---|---|---|
| 1 | Cable chain over the top: tray (2 halves) on the stand tops, links, fixed end, moving end | stands (tray sockets on the column tops), NEW tray + chain | builder `chain` |
| 2 | Spring pen holder + collet pen grip (replaces the guide's clip + gear knob) | NEW slider cap, collet housing, nut, collets | builder `carriage` |
| 3 | Snap attachments, no tape/screws: SC8UU blocks -> plate, stage -> plate | carriage plate 2 (replaces Tim's plate) | builder `carriage` |
| 4 | Homing switch (carriage only, motor side) | NEW rod-clip switch mount | builder `misc` |
| 5 | Board cover over the Uno + shield | NEW cover, clips onto the base's Uno pocket walls (base NOT reprinted) | builder `misc` |
| 6 | Software: Test drawing, Home button (switch), pen press for the spring holder | js/*, index.html, sim.html | builder `software` |
| - | Whiteboard loop | needs a bought whiteboard sheet/film ($): NOT built, Tim's call | - |
| - | Showcase page | needs Tim's photos / time-lapse: NOT built | - |

Integration after the wave (manager): GLB (`tools/make-build-model.py v2`), build guide steps, plates
+ slicing, progress.md / Monday list.

## Shared world frame
`cad/printed-frame.scad` assembly: base top z = 0, platter centre x = 0, +y toward the back. Rods at
y 50, z 99.5 / 161.5. Stand columns x +-148..170, y 32.5..64, top z 172.5. Carriage (with `lift`
24.5): plate x c+-28.5, plate back face y 37..39, SC8UU blocks y 39..61, top z ~178.5; stage y
27.5..37.5, z 90..171; pen line y 3. Carriage centre c (world x) from -95 (idler side, left
stand) to +78 (plate meets the X motor flange, right stand). World +x = motor side = machine X-
("Right" in the app); the pen draws on the idler side (machine X+, "Left"). X motor body x 107..149, y -5.5..32.5,
z 109.5..151.5, plug DOWN. Wheel underside z 46.5, radius ~104 about (0, 3).

## Interfaces (every builder must honour these exactly)
- **I1 chain socket (carriage provides, chain plugs in):** a vertical square hole 8.2 x 8.2, 7 deep,
  centred at world x = carriage centre, y = 32.5, top face z = 180. The chain's moving end has a
  stem 8.0 x 8.0 that goes in it (with its own small snap).
- **I2 height limit:** nothing on the carriage (plate, blocks, stage clips, slider cap, collet, nut)
  above z 180, except the pen itself (y ~3). The zone y 44..76, z >= 181 over the whole x range
  belongs to the tray; the tray's underside is at z >= 182.
- **I3 wire drop:** the tray's wire gutter leaves the tray's right end at about x 156, y 69.5 and
  the wires go straight down the right column's back face through the stands-3 clips (x 156, y
  69.5, z 35/90/145) and the foot channel (y 69.5, x 102..152).
- **I4 X motor cable:** drops from the motor's plug (x 128, y ~-1.5, z 109.5) to the foot channel
  (y -1.5, x 102..136). Nothing new may sit in that vertical strip (x 120..136, y -8..5, z 4..110).
- **I5 file ownership:** only `chain` edits `cad/printed-frame.scad` (stand tops; keep the stands-3
  wire clips). Others put their parts in their own NEW files and `include` printed-frame.scad /
  `use` the others read-only. Nobody edits `tools/make-build-model.py`, `js/build*.js`,
  `build/plotter*.glb`, progress.md, chat.md, CLAUDE.md (manager does).
- **I6 prints:** every printed part lies on the bed with no supports (Bambu CLI slice shows no
  "floating regions" warning), fits 256 x 256, PLA. Plates: `build/print/plate8_tray_and_chain*.3mf`
  (chain), `plate9_carriage_2.3mf` + `plate10_pen_head.3mf` (carriage),
  `plate11_switch_and_cover.3mf` (misc); stands-3 stays `plate3_stands.3mf`.
- **I7 unmeasured sizes:** every guessed size of a bought part is a named variable at the top of its
  file with `// ASSUMED, measure:` and is listed in the builder's report. Where a snap fit depends on
  one, also make a tiny fit-test coupon (<= 15 min) in the same plate file.

## NOT verified
Everything about the real machine: Tim builds and runs it.
