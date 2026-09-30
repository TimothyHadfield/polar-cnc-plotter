import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsPerDegree, stepsPerMM, corrected, offsetFromGap, parseSettings, testMove, saveSetting, centerLine } from '../js/calibrate.js';
import { Grbl, gcodeLines } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
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

test('turn test on a simulated plotter: turns 360, then saving sends the corrected $101', async () => {
  const fake = new FakeGrbl();
  const g = new Grbl(fake);
  try {
    await g.ready();
    const before = await g.readSettings();
    assert.equal(before[101], 17.132);
    await testMove(g, 'Y', 360, 2, () => true);
    assert.ok(fake.received.includes('G94 G91 G1 Y360 F300'));
    assert.equal(fake.received.at(-1), 'G90');
    near(g.status.wpos[1], 360);
    await saveSetting(g, 101, corrected(before[101], 360, 400));   // "it turned 400°"
    assert.ok(fake.received.includes('$101=15.419'), fake.received.join(' | '));
    assert.equal((await g.readSettings())[101], 15.419);
  } finally { fake.close(); }
});
