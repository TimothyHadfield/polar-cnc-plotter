// Writes the Phase 0 machine test files into tests/machine/ (default settings: pen up Z2, down Z0).
//   node tools/make-machine-tests.mjs
import { writeFile } from 'node:fs/promises';
import { DEFAULTS, placedToGcode, testCircle, testSpoke } from '../js/polar.js';
import { grblPlotterPolar } from '../tests/grblplotter-port.mjs';

const dir = new URL('../tests/machine/', import.meta.url);
const square = [[[-20, -20.05], [20, -20.05], [20, 20.05], [-20, 20.05], [-20, -20.05]]];
const files = {
  '1-circle.nc': placedToGcode([testCircle(DEFAULTS)], DEFAULTS).gcode,
  '2-spoke.nc': placedToGcode([testSpoke(DEFAULTS)], DEFAULTS).gcode,
  '3-square-grbl-plotter-method.nc': '; 40 mm square converted the way GRBL-Plotter does it (expect stray rings)\n' + grblPlotterPolar(square) + 'M2\n',
  '4-square-fixed.nc': placedToGcode(square, DEFAULTS).gcode,
};
for (const [name, text] of Object.entries(files)) {
  await writeFile(new URL(name, dir), text);
  console.log(name, text.split('\n').length, 'lines');
}
