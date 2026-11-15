// Live progress (js/progress.js): planned time per line and the time-left estimate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plannedTimes, estimate, minutesText, PRIOR } from '../js/progress.js';
import { gcodeLines } from '../js/grbl.js';
import { DEFAULTS, prepare, toGcode } from '../js/polar.js';

const hello = JSON.parse(readFileSync(new URL('./fixtures/hello-world.json', import.meta.url)));

test('planned time: G93 lines take 1/F minutes, rapids go at the max rates, G94 at the feed', () => {
  const cum = plannedTimes(['G21 G90 G93', 'G0 Z2', 'G0 X10 Y90', 'G1 X20 Y90 F12', 'G94', 'G1 X30 F600', 'G92 X0', 'M0', '$J=G91 X5 F100'], { 110: 1000, 111: 1800, 112: 200 });
  const step = cum.map((t, i) => t - (i ? cum[i - 1] : 0));
  assert.deepEqual(step.map(v => +v.toFixed(5)), [0, 0.01, 0.05, +(1 / 12).toFixed(5), 0, +(10 / 600).toFixed(5), 0, 0, 0]);
  // unknown rates: GRBL's factory 500
  assert.ok(Math.abs(plannedTimes(['G0 X50'])[0] - 0.1) < 1e-9);
});

test('the plan matches the drawing\'s own minutes on paper, plus the moves between strokes', () => {
  const o = DEFAULTS;
  const { gcode, stats } = toGcode(prepare(hello, o), o);
  const cum = plannedTimes(gcodeLines(gcode), { 110: 6000, 111: 7200, 112: 500 });
  const drawn = gcodeLines(gcode).reduce((s, l, i) => s + (l.startsWith('G1 ') ? cum[i] - cum[i - 1] : 0), 0);
  assert.ok(Math.abs(drawn - stats.minutes) / stats.minutes < 0.01, `pen down ${drawn} vs ${stats.minutes} planned`);
  assert.ok(cum.at(-1) > stats.minutes);
});

test('time left: the plan at first, then the real pace; share counts planned time, not lines', () => {
  const cum = Array.from({ length: 100 }, (_, i) => (i + 1) * 0.1);   // 10 min, 6 s a line
  let e = estimate(cum, 0, 0, 0);
  assert.equal(e.share, 0);
  assert.ok(Math.abs(e.left - 10) < 1e-9);
  // half done in exactly the planned 5 min: 5 min left
  e = estimate(cum, 0, 50, 5 * 60000);
  assert.ok(Math.abs(e.share - 0.5) < 1e-9 && Math.abs(e.left - 5) < 1e-9);
  // half done, but it took twice as long: about twice the planned time left
  e = estimate(cum, 0, 50, 10 * 60000);
  assert.ok(Math.abs(e.left - 5 * (10 + PRIOR) / (5 + PRIOR)) < 1e-9 && e.left > 9);
  // a resumed run counts only its own lines for the pace
  e = estimate(cum, 50, 75, 2.5 * 60000);
  assert.ok(Math.abs(e.share - 0.75) < 1e-9 && Math.abs(e.left - 2.5) < 1e-9);
  // a slow first second doesn't swing it far
  e = estimate(cum, 0, 1, 20000);
  assert.ok(e.left > 9 && e.left < 12.5, e.left);
  assert.equal(estimate([], 0, 0, 0).share, 0);
  assert.deepEqual([0.3, 1, 12.4, 65].map(minutesText), ['under a minute', '1 min', '12 min', '1 h 05 min']);
});
