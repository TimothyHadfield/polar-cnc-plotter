import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { corrected, offsetFromGap, parseSettings, saveSetting, centerLine, snapDirect, turnSteps, slowJog,
  nudgeJog, fullTurn, stopJog, waitIdle, drawCircle, centerBetween, touchLift, setDirection, uprightPen,
  SLOW, LINE, LIFT } from '../js/calibrate.js';
import { Grbl } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { SimGrbl } from '../js/simgrbl.js';
import { DEFAULTS, placedToGcode, simulate } from '../js/polar.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

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
  assert.equal(slowJog('X', -1, 250, 10, LINE), '$J=G91 G21 X-8.000 F72.00');   // the carriage test's line
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

test('pen height: click Down to the paper, Touching lifts the pen and saves both heights', async () => {
  const { sim, g } = await plotter({}, false);
  const vals = await g.readSettings();                  // $102 = 100 here
  for (let i = 0; i < 6; i++) {                         // six clicks of Down, 0.5 each
    await g.send(nudgeJog('Z', -0.5, 200, vals[102]));
    await waitIdle(g);
  }
  near(sim.pos[2], -3);                                 // the tip is on the paper
  const s = await touchLift(g, vals[102]);
  assert.deepEqual(s, { penUp: 0, penDown: -LIFT / 100 });
  assert.ok(sim.received.includes('$J=G91 G21 Z1.000 F200'), sim.received.join(' | '));
  near(sim.pos[2], -2);                                 // lifted 100 motor steps
  near((await g.nextStatus()).wpos[2], 0);              // …and that is work Z0 = pen up
  await g.send(`G90 G0 Z${s.penDown}`);
  await waitIdle(g);
  near(sim.pos[2], -3);                                 // pen down = back on the paper
  await g.stop();                                       // a soft reset drops G92
  near((await g.nextStatus()).wpos[2], s.penDown);      // …and the pen zero is put back
});

test('pen height at GRBL\'s factory 250 steps per unit: the same lift in steps is 0.4 units', async () => {
  const { sim, g } = await plotter({ 102: 250 }, false);
  await g.send(nudgeJog('Z', -0.5, 200, 250));
  await waitIdle(g);
  assert.deepEqual(await touchLift(g, 250), { penUp: 0, penDown: -0.4 });
  assert.equal(sim.received.filter(l => l.startsWith('$J=')).at(-1), '$J=G91 G21 Z0.400 F96');   // 400 steps a second
  near(sim.pos[2], -0.1);
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

test('Test: one full turn by the plotter\'s count; a miss is nudged out and gives the real value', async () => {
  const { sim, g } = await plotter({ 101: 4.5 }, false);   // geared: a little off a plain motor's 4.444
  await g.send('$101=4.444');                              // what the turn test rounded it to
  const vals = await g.readSettings();
  const from = (await g.nextStatus()).mpos[1];
  const cmd = fullTurn(vals[101]);
  assert.equal(cmd, '$J=G91 G21 Y360.000 F5400.54');       // 400 motor steps a second
  await g.send(cmd);
  near((await waitIdle(g)).mpos[1] - from, 360, 1e-6);     // the plotter counts a full turn
  near(sim.real()[1], 355.52, 0.01);                       // the mark stops 4.5° short
  let at = 0;
  for (const d of [2, 2, 0.5]) {                           // Further, Further, Further (0.5°)
    await g.send(nudgeJog('Y', d, 300, vals[101]));
    at = (await waitIdle(g)).mpos[1];
  }
  near(sim.real()[1], 360, 0.05);                          // the mark lines up
  const fix = turnSteps(vals[101], Math.abs(at - from), true);
  near(fix, 4.5, 0.002);
  // (the turn test's rounding would have put the value that just missed straight back)
  assert.equal(turnSteps(vals[101], Math.abs(at - from)), 4.444);
  await saveSetting(g, 101, fix, vals[101]);
  const before = sim.real()[1];
  await g.send(fullTurn(fix));
  await waitIdle(g);
  near(sim.real()[1] - before, 360, 0.1);                  // Test again: a full circle now
});

test('turn test result is still rounded to a plain motor\'s value', () => {
  assert.equal(turnSteps(250, 6.4), 4.444);                // factory 250, stopped at 6.4 "degrees"
  near(turnSteps(250, 6.4, true), 4.4444, 1e-3);
  near(turnSteps(17.132, 400), 19.036);                    // geared: as measured
  assert.ok(Number.isNaN(turnSteps(4.444, NaN)));
});

test('carriage test: a line of 2000 motor steps, the ruler on it gives $100', async () => {
  const { sim, g } = await plotter({ 100: 40 }, false);    // GT2 belt, 20 teeth, 8 microsteps
  await g.send('$100=250');                                // what GRBL ships with
  const vals = await g.readSettings();
  const from = (await g.nextStatus()).mpos[0];
  await g.send(slowJog('X', -1, vals[100], vals[120], LINE));
  const at = (await waitIdle(g)).mpos[0];
  near(Math.abs(at - from), 8, 1e-6);                      // "Plotter says 8.0 mm"
  near(sim.real()[0], -50, 1e-6);                          // the ruler says 50
  const fix = corrected(vals[100], Math.abs(at - from), 50);
  near(fix, 40);
  await saveSetting(g, 100, fix, vals[100]);
  assert.equal(sim.received.at(-1), '$100=40.000');
  const again = slowJog('X', -1, fix, vals[120], LINE);    // draw again to check
  assert.equal(again, '$J=G91 G21 X-50.000 F450.00');
  await g.send(again);
  near((await waitIdle(g)).mpos[0], -100, 1e-6);           // plotter and ruler agree: 50 more
  near(sim.real()[0], -100, 1e-6);
});

test('pen direction: the plotter\'s direction mask follows the setting; heights saved flipped are turned over', async () => {
  const fake = new FakeGrbl();
  fake.settings[3] = '1';                                  // the carriage already runs reversed
  const g = new Grbl(fake);
  try {
    await g.ready();
    const mask = (await g.readSettings())[3];
    assert.equal(mask, 1);
    assert.equal(await setDirection(g, mask, 2, true), 5); // the pen's bit is added, the carriage's kept
    assert.equal(fake.received.at(-1), '$3=5');
    assert.equal((await g.readSettings())[3], 5);
    const n = fake.received.length;
    assert.equal(await setDirection(g, 5, 2, true), 5);    // already so: nothing written
    assert.equal(fake.received.length, n);
    assert.equal(await setDirection(g, 5, 2, false), 1);
    assert.equal(fake.received.at(-1), '$3=1');
    assert.equal(await setDirection(g, undefined, 2, true), undefined);   // a pretend plotter: no $3
    assert.equal(fake.received.at(-1), '$3=1');
  } finally { fake.close(); }
  assert.deepEqual(uprightPen({ penUp: 0, penDown: 1.5 }), { penUp: 0, penDown: -1.5 });
  assert.equal(uprightPen({ penUp: 2, penDown: 0 }), null);
  assert.equal(uprightPen({ penUp: 0, penDown: -0.4 }), null);
});
