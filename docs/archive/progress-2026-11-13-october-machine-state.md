# Archived from progress.md on 2026-11-13 (night)

Moved verbatim to keep progress.md under its size cap. All of it is superseded: every axis moved
on its own header with new TMC2209s on 2026-11-11, and the plotter was fully built on 2026-11-13.

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
