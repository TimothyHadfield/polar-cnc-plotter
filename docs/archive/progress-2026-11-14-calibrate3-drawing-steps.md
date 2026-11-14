# Archived from progress.md, 2026-11-14: the Calibrate steps that drew on paper

Replaced the same day by CALIBRATE 4 (nothing draws). Code as of commit `72d1604`. Text moved
verbatim from progress.md.

## Goal right now (as it stood)
**2026-11-14: Tim ran Calibrate on the real plotter and asked for five changes plus auto-connect
(CALIBRATE 3, built and live).** Next is his run of the reworked flow: Turn test + Test, Pen height
(is Down really down now?), Carriage test, Find center; then a first real drawing. If the platter
is slow (factory `$111`/`$121`: a Test turn can take ~43 s), a speed step was offered, not built.
The older text below is history.

## CALIBRATE 3, steps 3 to 6 (as they stood)
3. **Carriage test** (new): jog out near the edge, **Draw line** = pen down, slow jog of `LINE` =
   2000 motor steps toward the center (50 mm at 40 steps/mm; Stop or running out both count), pen
   up; "Plotter says N mm" + "Ruler says" -> New `$100`. The X "Reverse direction" switch is here.
4. **Find center**: four numbered lines (jog halfway out, Draw circle, Cross slowly, nudge + Set
   center). No ruler here any more.
5. Center gap, 6. Mirror check: unchanged.

(Center gap = a drawn test, two ruler readings -> `offsetFromGap` -> setting `offset`. Mirror
check = the pen drew a letter F; "Mirrored" toggled setting `flip`. Exports removed with them:
`offsetFromGap`, `drawCircle`, `centerLine`, `letterF`.)

## SAFEGUARDS line (as it stood)
  Draw circle needs a plausible `$101`, the test drawings need both; **Draw circle, Set center,
  Draw test, Draw F turn into Stop** while they run (`stopMove` = `grbl.stop()` + pen up); closing
  the tool stops them. Step 1 shows a bad value in red.

## NOT verified line (as it stood)
- CALIBRATE 3 on the real plotter (Tim used the 11-13 tool there; nothing of 11-14 has run on
  it): the `$3` write on connect (assumes his bit 2 was 0; if Down still goes up he flips "Reverse
  direction" in Pen height), Test (a full turn at 400 steps/s, slower if `$111` caps it), the
  Touching lift (100 motor steps ≈ 2 mm is reasoned from a 3 mm lead), Draw line (2000 steps
  toward the center, pen down), how far the platter coasts after Stop. Auto-connect in real Chrome:
  that it remembers the port across unplug/restart, and that the list still opens when
  `getPorts()` ran first. In `?demo` slow moves jump at once: FakeGrbl has no real-time motion.
