import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { stepsPerDegree, stepsPerMM, corrected, offsetFromGap, parseSettings, saveSetting, centerLine,
  snapDirect, slowJog, stopJog, waitIdle, drawCircle, centerBetween, penHeights, SLOW } from '../js/calibrate.js';
import { Grbl } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { SimGrbl } from '../js/simgrbl.js';
import { DEFAULTS, placedToGcode, simulate } from '../js/polar.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('platter steps per degree from motor, microsteps and gears', () => {
  // 200 steps × 16 microsteps × 60/20 gears = 9600 steps per platter turn = 26.667 per degree
  near(stepsPerDegree({ stepAngle: 1.8, microsteps: 16, small: 20, big: 60 }), 26.667);
  near(stepsPerDegree({ stepAngle: 0.9, microsteps: 8, small: 16, big: 144 }), 80);   // 400 × 8 × 9 / 360
  assert.ok(Number.isNaN(stepsPerDegree({ stepAngle: 1.8, microsteps: 16, small: 0, big: 60 })));
});

test('rail steps per mm from motor, microsteps and GT2 pulley', () => {
  // 3200 steps per motor turn, 20-tooth GT2 pulley moves 40 mm
  near(stepsPerMM({ stepAngle: 1.8, microsteps: 16, teeth: 20 }), 80);
  near(stepsPerMM({ stepAngle: 7.5, microsteps: 1, teeth: 16 }), 1.5);
  assert.ok(Number.isNaN(stepsPerMM({ stepAngle: 1.8, microsteps: 16 })));
});

test('corrected value scales by commanded / actual', () => {
  near(corrected(17.132, 360, 210), 29.369);   // turned short: needs more steps
  near(corrected(17.132, 360, 400), 15.419);   // turned past: fewer
  near(corrected(47.62, 20, 20), 47.62);
  assert.ok(Number.isNaN(corrected(47.62, 20, 0)));
});

test('$$ lines parse to numbers, other lines ignored', () => {
  assert.deepEqual(parseSettings(['$0=10', '$100=47.620', '$101=17.132 (y, step/mm)', 'ok', '[MSG:x]', '$130=-5']),
    { 0: 10, 100: 47.62, 101: 17.132, 130: -5 });
});

test('gap setting from the distance between the two halves, measured on a simulated plot', () => {
  // The real pen line misses the center by 1.5 mm; the app thinks 0. Draw the center line, measure.
  const realGap = 1.5;
  const measure = setting => {
    const g = placedToGcode(centerLine(0), { ...DEFAULTS, offset: setting }).gcode;
    const { down } = simulate(g, { ...DEFAULTS, offset: realGap }, 0.5);
    const yAt = x => down.flat().reduce((b, p) => Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b)[1];
    return yAt(30) - yAt(-30);
  };
  const apart = measure(0);
  near(Math.abs(apart), 3, 0.05);
  const fix = offsetFromGap(0, Math.abs(apart), 1);
  near(fix, 1.5, 0.03);
  near(measure(fix), 0, 0.05);                                  // one straight line now
  near(offsetFromGap(0, 3, -1), -1.5);                          // "Other side"
  near(offsetFromGap(1, 1, 1), 1.5);                            // a second pass adds to the current one
});

test('saving sends the corrected value, and GRBL then reads the same spot in the new units', async () => {
  const fake = new FakeGrbl();
  const g = new Grbl(fake);
  try {
    await g.ready();
    const before = await g.readSettings();
    assert.equal(before[101], 17.132);
    await g.send('G91 G0 Y360');
    await g.send('G90');
    await saveSetting(g, 101, corrected(before[101], 360, 400));   // "it really turned 400°"
    assert.ok(fake.received.includes('$101=15.419'), fake.received.join(' | '));
    assert.equal((await g.readSettings())[101], 15.419);
    near((await g.nextStatus()).mpos[1], 400, 0.01);               // GRBL counts steps, not degrees
  } finally { fake.close(); }
});

// ---------- the slow moves, on the simulator's GRBL (it moves in real time and counts steps) ----------
const sims = [];
after(() => sims.forEach(s => s.close()));
// the test moves the clock itself (advance), or lets it run 2000× fast
const freeze = s => clearInterval(s.timer);
const thaw = s => { s.last = performance.now(); s.timer = setInterval(() => s.tick(), 8); };
// a plotter whose real steps per unit differ from what GRBL is set to
async function plotter(real = {}, frozen = true) {
  const sim = new SimGrbl({ speed: 2000, bootMs: 5 });
  sims.push(sim);
  if (frozen) freeze(sim);
  for (const [n, v] of Object.entries(real)) { sim.settings[n] = v.toFixed(3); sim.true[n - 100] = v; }
  const g = new Grbl(sim);
  await g.ready();
  return { sim, g };
}
const feedOf = line => +/F([\d.]+)/.exec(line)[1];

test('slow jogs are slow in motor steps, whatever the settings say', () => {
  assert.equal(slowJog('Y', 1, 250), '$J=G91 G21 Y64.000 F25.68');          // factory: 107 steps/s
  assert.equal(slowJog('Y', -1, 8.889, 300), '$J=G91 G21 Y-1799.978 F722.24');
  assert.equal(slowJog('Z', -1, 250, 10), '$J=G91 G21 Z-16.000 F36.00');
  // factory acceleration with a calibrated $101: slower, so it stops within `coast` steps
  const v = feedOf(slowJog('Y', 1, 8.889, 10)) / 60 * 8.889;                 // steps per second
  assert.ok(v < SLOW.Y.rate, `${v} steps/s`);
  near(v * v / (2 * 10 * 8.889), SLOW.Y.coast, 0.05);
  assert.throws(() => slowJog('X', 1, undefined));
});

test('a measured $101 near a direct-drive value becomes that value', () => {
  assert.equal(snapDirect(8.93), 8.889);      // 1.8°, 16 microsteps
  assert.equal(snapDirect(4.40), 4.444);      // 8 microsteps
  assert.equal(snapDirect(17.132), null);     // geared: left as measured
  assert.equal(snapDirect(26.667), null);
  assert.equal(snapDirect(NaN), null);
});

test('turn test: factory $101, Stop after one real turn gives the real value', async () => {
  const { sim, g } = await plotter({ 101: 8.889 });       // platter straight on a 1.8° motor, 16 microsteps
  await g.send('$101=250');                               // what GRBL ships with
  const vals = await g.readSettings();
  const from = (await g.nextStatus()).mpos[1];
  const line = slowJog('Y', 1, vals[101], vals[121]);
  await g.send(line);
  const perSec = sim.real([0, 1, 0])[1] * feedOf(line) / 60;   // real degrees a second
  assert.ok(perSec > 8 && perSec < 14, `${perSec}°/s`);         // about half a minute a turn
  sim.advance(360 / perSec * 1000);                             // the mark comes back around: Stop
  const at = (await stopJog(g))[1];
  near(sim.real()[1], 360, 0.01);                               // it stopped there, not at the jog's far end
  const raw = corrected(vals[101], Math.abs(at - from), 360);
  near(raw, 8.889, 0.002);
  await saveSetting(g, 101, snapDirect(raw) ?? raw, vals[101]);
  assert.equal(sim.received.at(-1), '$101=8.889');
  await g.send('G91 G0 Y90');
  await g.send('G90');
  sim.advance(600000);
  near(sim.real()[1], 450, 0.01);                               // 90 now means 90
});

test('pen heights: lower to the paper, raise, and the heights survive a Stop', async () => {
  const { sim, g } = await plotter();
  const vals = await g.readSettings();
  await g.send(slowJog('Z', -1, vals[102]));
  sim.advance(2000);                                    // 150 steps/s at 100 steps/mm: 3 mm down
  const down = (await stopJog(g))[2];
  near(down, -3, 1e-6);
  await g.send(slowJog('Z', 1, vals[102]));
  sim.advance(1000);
  await stopJog(g);
  const s = await penHeights(g, down);
  assert.deepEqual(s, { penUp: 0, penDown: -1.5 });
  near((await g.nextStatus()).wpos[2], 0);
  await g.send(`G90 G0 Z${s.penDown}`);
  sim.advance(60000);
  near(sim.pos[2], -3);                                 // pen down = back on the paper
  await g.stop();                                       // a soft reset drops G92
  near((await g.nextStatus()).wpos[2], s.penDown);      // …and the pen zero is put back
});

test('find center: circle, cross to its far side, halfway is the center; the ruler gives $100', async () => {
  const { sim, g } = await plotter({ 100: 80 }, false);   // the rail really has 80 steps per mm
  await g.send('$100=100');                               // set wrong: 1 unit = 1.25 mm
  const vals = await g.readSettings();
  // GRBL woke up with the pen 40 real mm out: the real center is at machine X −32
  const a = await drawCircle(g, { penUp: 2, penDown: 0 }, vals[101]);
  assert.equal(a, 0);
  assert.ok(sim.received.includes('G94 G91 G1 Y370 F1400.9'), sim.received.join(' | '));
  near(sim.pos[1], 370); near(sim.pos[2], 2);             // a turn and a bit, pen left up
  freeze(sim);
  await g.send(slowJog('X', -1, vals[100]));              // 300 steps/s = 3 units a second
  sim.advance(64 / 3 * 1000);                             // over the line on the far side: Stop
  const b = (await stopJog(g))[0];
  near(b, -64, 1e-6);
  thaw(sim);
  await centerBetween(g, a, b, 2);
  near(sim.pos[0], -32); near(sim.real()[0], -40);        // the pen is over the real center
  near((await g.nextStatus()).wpos[0], 0);
  // ruler: the circle is 2 × 40 = 80 mm across, the plotter says 64
  const fix = corrected(vals[100], Math.abs(b - a), 80);
  near(fix, 80);
  await g.send('G90 G0 X8');                              // somewhere else: really 10 mm out
  await waitIdle(g);
  await saveSetting(g, 100, fix, vals[100]);
  near((await g.nextStatus()).wpos[0], 10);               // reads true mm now
  near(g.center[0], -40);
  await g.send('G90 G0 X0');
  await waitIdle(g);
  near(sim.real()[0], -40);                               // and zero is still the real center
});
