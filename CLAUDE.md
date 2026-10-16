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
- `js/place.js`: drag to move, Turn slider, Crop box.
- `js/grbl.js`: GRBL streaming (character counting, 127-byte RX limit), pause/stop/resume, Web Serial.
- `js/machine.js`: plotter panel (connect, jog, set center, plot, pen changes via M0).
- `js/calibrate.js`: 6-step calibration tool ($100, $101, pen heights, center gap, mirror check).
- `js/fakegrbl.js`: pretend GRBL used by the tests and `?demo`.
- `tests/`: `node:test` suites; `tests/machine/*.nc` are hand-run machine check files;
  `tests/grblplotter-port.mjs` reproduces GRBL-Plotter's broken polar conversion for comparison.
- `tools/serve.mjs` (static server, default port 8765), `tools/make-fixtures.mjs` (needs Playwright
  + server on 8765), `tools/make-machine-tests.mjs`.
- `samples/`: the three sample drawings behind the "or Hello World · UVU logo · HELLO.png" links.

## Run and test
- Local: `node tools/serve.mjs 8765` (or `python -m http.server <port>`), open `http://localhost:8765/`.
- Tests: `node --test tests/*.test.mjs` (about 8 files, ~100 tests, 2-3 minutes; no package.json,
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
- `tests/fixtures/*.json` were made by `tools/make-fixtures.mjs` from the real `svg.js` in Chromium.
  Regenerate them only if `svg.js` output is meant to change.

## Standing instructions
- No project-specific quotes from Tim are recorded in this repo yet. Global rules apply
  (`~/.claude/CLAUDE.md`): Tim owns looks, wording and names; $0; commit with explicit paths.
