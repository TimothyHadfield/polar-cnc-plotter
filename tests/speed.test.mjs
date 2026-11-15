// Speed test (js/speed.js): faster and faster runs, the user's answers pick the saved max rates.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { SPEED, MARGIN, trial, trialLines, tuned, rampAccel, speedTest } from '../js/speed.js';
import { JOG_SPS } from '../js/safe.js';
import { Grbl } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { waitIdle } from '../js/calibrate.js';

const fakes = [];
after(() => fakes.forEach(f => f.close()));

test('each run is faster, never past the jog limits, and always long enough to reach its speed', () => {
  for (const [axis, spu] of [['X', 40], ['X', 80], ['Y', 4.444], ['Y', 8.889]]) {
    let last = 0;
    SPEED[axis].sps.forEach((_, i) => {
      const t = trial(axis, i, spu);
      assert.ok(t.feed > last, `${axis} run ${i} faster`);
      last = t.feed;
      assert.ok(t.feed * spu / 60 <= JOG_SPS[axis] + 1e-6, `${axis} run ${i}: ${t.feed * spu / 60} steps/s`);
      // distance to speed up = v²/2a: a quarter of the run, so it gets to full speed and back
      const ramp = (t.feed / 60) ** 2 / (2 * t.accel);
      assert.ok(Math.abs(ramp - SPEED[axis].run / 4) < 0.05 * SPEED[axis].run / 4, `${axis} ramp ${ramp}`);
    });
  }
  assert.throws(() => trial('X', 0, 0));
});

test('saved: 80 % of the fastest smooth run, with the acceleration for that speed; nothing smooth saves nothing', () => {
  const t = trial('X', 3, 40);
  const [r, a] = tuned('X', 3, 40);
  assert.deepEqual([r.n, a.n], [110, 120]);
  assert.equal(r.to, Math.round(t.feed * MARGIN));
  assert.equal(a.to, rampAccel(r.to, SPEED.X.run));
  assert.ok(a.to < t.accel);
  const [ry, ay] = tuned('Y', 0, 4.444);
  assert.deepEqual([ry.n, ay.n], [111, 121]);
  assert.deepEqual(tuned('Y', -1, 4.444), []);
  const { lead, run } = trialLines('X', 0, 40, 2);
  assert.deepEqual(lead, ['G90 G0 Z2', 'G0 X20']);
  assert.deepEqual(run, ['$110=1500', '$120=31.3', 'G91 G0 X40', 'G0 X-40', 'G90']);
});

test('on the pretend plotter: runs until "Skipped", carriage and platter end where they began, old rates put back', async () => {
  const fake = new FakeGrbl({ moveTicks: 1 });
  fakes.push(fake);
  Object.assign(fake.settings, { 100: '40.000', 101: '4.444', 110: '500.000', 111: '7200.000', 120: '10.000', 121: '300.000' });
  const g = new Grbl(fake);
  await g.ready();
  await g.setCenter();
  const vals = await g.readSettings();
  const asked = [];
  // carriage smooth up to run 2, platter smooth all the way
  const best = await speedTest(g, vals, {
    penUp: 2, idle: () => waitIdle(g),
    ask: async (axis, i) => { asked.push(axis + i); return axis === 'Y' || i < 3; },
  });
  assert.deepEqual(best, { X: 2, Y: SPEED.Y.sps.length - 1 });
  assert.deepEqual(asked.filter(a => a[0] === 'X'), ['X0', 'X1', 'X2', 'X3']);
  assert.equal(asked.filter(a => a[0] === 'Y').length, SPEED.Y.sps.length);
  const s = await g.nextStatus();
  assert.ok(Math.abs(s.wpos[0] - SPEED.X.from) < 1e-6 && Math.abs(s.wpos[1]) < 1e-6, `ended at ${s.wpos}`);
  assert.deepEqual([fake.settings[110], fake.settings[111], fake.settings[120], fake.settings[121]], ['500.000', '7200.000', '10.000', '300.000']);
  // the runs really went at their speeds
  assert.ok(fake.received.includes(`$110=${trial('X', 3, 40).feed}`));
  assert.ok(fake.received.includes(`$111=${trial('Y', 8, 4.444).feed}`));
  fake.close();
});
