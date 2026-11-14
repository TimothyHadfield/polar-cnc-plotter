# Polar CNC Plotter

Tim's ECE 1000 final project (UVU, Spring 2026): a pen plotter that works in polar coordinates
(pen slides on a rail = radius, round platter spins = angle, DVD-drive stepper lifts the pen).
Arduino + CNC Shield V3 running stock GRBL 1.1. The repo is a public showcase (README with build
photos) plus a browser app that turns an SVG, a picture, text or a math pattern into polar G-code,
previews it, and can stream it to the plotter over USB.

- **Live app:** https://timothyhadfield.github.io/polar-cnc-plotter/ (`?demo` = pretend plotter)
- **Users:** Tim only. No accounts, no backend, no cost. Settings live in this browser's
  localStorage (`polar-plotter-settings`).
- **Plotting needs** Chrome/Edge on a computer (Web Serial). On iPhone the app only previews and
  downloads G-code; the plotter panel stays hidden.

## Files
- `index.html`, `css/app.css`: the one page (preview canvas + side panel + Settings sheet).
- `js/app.js`: state, loading files/paste/drop, preview drawing, settings. `api` object is the only
  door into app state for the feature modules.
- `js/polar.js`: the core math. Fit/crop/turn/move, clip, order strokes, Cartesian -> polar
  (`toMachine`/`toPlatter`, center gap `offset`, `flip`), splitting segments until the machine path
  stays within `tol` (0.1 mm), G93 inverse-time feed, `simulate()` (preview is drawn FROM the G-code).
- `js/svg.js` (+ `pathflat.js`): SVG -> strokes, browser-only (uses the DOM for transforms/shapes).
- `js/image.js`, `trace.js`, `styles.js`: picture -> outlines / centerlines / spiral / hatch.
- `js/text.js` + `fonts.js` (Hershey single-stroke, license text inside), `js/patterns.js`.
- `js/sketch.js`: Draw tool (draw on the preview with finger or mouse). Its strokes carry
  `center` + `radius`, so `fitFrame` keeps them where they were drawn instead of fitting them.
- `js/handoff.js`: packs the drawing on screen (strokes, colours, center/radius, turn/move/crop)
  into sessionStorage for the "Simulate" link; app.js unpacks it once when it runs on sim.html.
- `sim.html` + `js/sim.js`: the 3D simulator. sim.js imports `js/app.js` last, so **app.js and
  every tool module run on sim.html too**, against sim.html's own copy of the panel markup.
- `js/place.js`: drag to move, Turn slider, Crop box (steps aside while `api.sketching`).
- `js/grbl.js`: GRBL streaming (character counting, 127-byte RX limit), pause/stop/resume, Web Serial.
- `js/machine.js`: plotter panel (connect, jog, set center, plot, pen changes via M0).
- `js/calibrate.js`: 5-step calibration tool; nothing in it draws (Tim: no paper needed). Turn test
  (slow turn the user stops, jog cancel 0x85, then Test = one full turn to check) -> $101; Turn
  direction (quarter turn, Clockwise / Counterclockwise) -> `flip`; Pen height (click Down until
  the tip touches, Touching lifts it and saves up 0 / down -lift, `G92 Z0` at pen up,
  `grbl.penZero`); Carriage test (pen-up move over a ruler) -> $100, rounded to a belt value;
  Find center (a mark under the tip, Half turn, the mark again) -> center + center gap `offset`.
- Pen direction: setting `zFlip` (default true: Tim's pen motor is mounted so GRBL's Z runs
  backwards) is written to the plotter as `$3` bit 2 by `machine.js` on connect. Nothing else in
  the app flips Z.
- Connect: `pickPort` (`js/grbl.js`) opens the one remembered serial port without the browser's
  list; none, several, or a failed open -> the list.
- `js/safe.js`: guards against wild settings. Plausible ranges for `$100` / `$101`, the warning
  line, step-rate caps for jogs. machine.js reads `$$` on connect and switches off jogs + Plot for
  an axis whose steps per unit cannot be right; calibrate.js refuses to save such a value.
- `js/fakegrbl.js`: pretend GRBL used by the tests and `?demo`. `js/simgrbl.js`: the simulator's
  (real-time moves). Both count steps like GRBL: a `$100`-`$102` write changes what a position reads.
- `tests/`: `node:test` suites; `tests/machine/*.nc` are hand-run machine check files;
  `tests/grblplotter-port.mjs` reproduces GRBL-Plotter's broken polar conversion for comparison.
- `tools/serve.mjs` (static server, default port 8765), `tools/make-fixtures.mjs` (needs Playwright
  + server on 8765), `tools/make-machine-tests.mjs`, `tools/check-calibrate.mjs` and
  `tools/check-connect.mjs` (headless WebKit walks of Calibrate and Connect; usage in progress.md Map).
- `build.html`, `css/build.css`, `js/build.js` (three.js viewer, tap-to-select card),
  `js/build-look.js` (textures, lighting, wires), `js/build-steps.js` (steps, parts, links, `about`
  text): the 3D build guide. GLB nodes are `<part>` or `<part>__<piece>`; steps list base names. Model: `cad/plotter-assembly.scad` -> `python tools/make-build-model.py`
  (needs OpenSCAD + trimesh) -> `build/plotter.glb` and printable `build/stl/*.stl`.
- `samples/`: the three sample drawings behind the "or Hello World · UVU logo · HELLO.png" links.

## Run and test
- Local: `node tools/serve.mjs 8765` (or `python -m http.server <port>`), open `http://localhost:8765/`.
- Tests: `node --test tests/*.test.mjs` (12 files, 132 tests, about half a minute; no package.json,
  no install). Grbl/plot tests use FakeGrbl with real timers, so they are slow and timing-sensitive
  on a busy machine.
- Browser-only code (`svg.js`, `app.js`, `machine.js` UI) has no node tests: check it with
  phone-view `--eval` / `--do` against the local server.

## Deploy
GitHub Pages, legacy build from `main` at `/`. Pushing to `main` is the deploy. No build step.

## Traps
- Machine axes: X = carriage mm (0 = closest to center), Y = platter DEGREES (GRBL calls it mm, so
  `$101` must be steps per degree). Pen up Z2 / down Z0 by default. Before plotting: pen at the
  platter center, then Set center (`G92 X0 Y0`).
- The preview is a simulation of the emitted G-code; keep it that way so it shows what the machine does.
- Anything about the real machine (whether drawings come out right) is NOT verifiable here; only
  Tim can run the plotter. README status says drawings came out unrecognizable with the old
  Inkscape -> GRBL-Plotter -> UGS chain; that is why this app exists.
- A control wired in app.js or a tool module must exist in both `index.html` and `sim.html`, or be
  looked up with a null check; otherwise the simulator throws at start-up. After an app change,
  load `sim.html?v=1` and `?v=2` headless and read the exceptions.
- `tests/fixtures/*.json` were made by `tools/make-fixtures.mjs` from the real `svg.js` in Chromium.
  Regenerate them only if `svg.js` output is meant to change.

## Standing instructions
- No project-specific quotes from Tim are recorded in this repo yet. Global rules apply
  (`~/.claude/CLAUDE.md`): Tim owns looks, wording and names; $0; commit with explicit paths.
