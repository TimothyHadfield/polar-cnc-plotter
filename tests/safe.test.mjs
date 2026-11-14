import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { plausible, badAxes, trouble, refusal, jogFeed, JOG_SPS, RANGE } from '../js/safe.js';
import { corrected, saveSetting, slowJog, stopJog, snapDirect, nudgeJog, sane, stopMove, drawCircle,
  NUDGE, START, SLOW } from '../js/calibrate.js';
import { Grbl } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { SimGrbl } from '../js/simgrbl.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const feedOf = line => +/F([\d.]+)/.exec(line)[1];

// What happened on the real plotter, 2026-11-13: factory $101 = 250, the platter (really 4.444
// steps per degree) made 56 turns, and "56" went into a box that wanted degrees.
const TIMS = corrected(250, 360, 56);

const sims = [];
after(() => sims.forEach(s => s.close()));
async function plotter(real = {}) {
  const sim = new SimGrbl({ speed: 2000, bootMs: 5 });
  sims.push(sim);
  clearInterval(sim.timer);                                  // the test moves the clock (advance)
  for (const [n, v] of Object.entries(real)) { sim.settings[n] = v.toFixed(3); sim.true[n - 100] = v; }
  const g = new Grbl(sim);
  await g.ready();
  return { sim, g };
}

test('56 turns typed as degrees: the value is spotted as impossible', () => {
  near(TIMS, 1607.143);
  assert.equal(plausible(101, TIMS), false);
  assert.deepEqual(badAxes({ 100: 250, 101: TIMS }), ['Y']);
  assert.match(trouble({ 100: 250, 101: 1607.143 }), /^Platter steps look wrong \(\$101 = 1607\.143\)\. Open Calibrate\.$/);
  assert.match(refusal(101, TIMS), /Platter steps must be 0\.5 to 150/);
});

test('real plotters pass; factory, missing and unread settings do not', () => {
  for (const v of [0.556, 4.444, 8.889, 17.132, 26.667, 80]) assert.ok(plausible(101, v), `$101=${v}`);
  for (const v of [5, 40, 47.62, 80, 100, 250, 800]) assert.ok(plausible(100, v), `$100=${v}`);
  assert.deepEqual(badAxes({ 100: 40, 101: 4.444 }), []);
  assert.equal(trouble({ 100: 40, 101: 4.444 }), '');
  assert.equal(refusal(101, 4.444), '');
  assert.deepEqual(badAxes({ 100: 250, 101: 250 }), ['Y']);          // GRBL's factory values: not calibrated
  assert.deepEqual(badAxes({ 100: 0, 101: 4.444 }), ['X']);
  assert.deepEqual(badAxes({ 100: 4000, 101: NaN }), ['X', 'Y']);
  assert.match(trouble({ 100: 4000, 101: 0.1 }), /^Carriage and platter steps look wrong/);
  assert.deepEqual(badAxes(null), ['X', 'Y']);                       // nothing read: nothing may move
  assert.match(trouble(null), /Could not read/);
  assert.match(trouble({}), /Could not read/);
  assert.ok(plausible(102, 99999));                                  // the pen axis has no range
});

test('a jog is never more than a set number of motor steps a second', () => {
  assert.equal(jogFeed('Y', 1000, 4.444), 1000);                     // calibrated: as before
  assert.equal(jogFeed('X', 1000, 40), 1000);
  assert.equal(jogFeed('Z', 200, 250), 200);
  const f = jogFeed('Y', 1000, TIMS);                                // the day it screamed: 26 786 steps/s asked
  near(f / 60 * TIMS, JOG_SPS.Y, 1);
  near(jogFeed('Z', 200, 6000) / 60 * 6000, JOG_SPS.Z, 1);
  assert.throws(() => jogFeed('Y', 1000, undefined), /Could not read/);
  assert.throws(() => jogFeed('Y', 1000, 0), /Could not read/);
  // GRBL runs nothing slower than 1 unit a minute: a feed under 1 would not be obeyed
  assert.throws(() => jogFeed('Y', 1000, 500000), /\$101 is far too high/);
});

test('Calibrate refuses to save an impossible value', async () => {
  const fake = new FakeGrbl();
  const g = new Grbl(fake);
  try {
    await g.ready();
    await assert.rejects(saveSetting(g, 101, TIMS, 250), /Platter steps must be 0\.5 to 150\. Not saved\./);
    await assert.rejects(saveSetting(g, 100, 4000, 100), /Carriage steps must be 5 to 800/);
    await assert.rejects(saveSetting(g, 101, NaN, 250), /Not saved/);
    await assert.rejects(saveSetting(g, 101, RANGE[101][1] + 0.01, 250), /Not saved/);
    assert.equal(fake.received.some(l => /^\$10[01]=/.test(l)), false, fake.received.join(' | '));
    assert.equal((await g.readSettings())[101], 17.132);             // untouched
    await saveSetting(g, 101, RANGE[101][1], 17.132);                // the edge itself is allowed
    assert.equal((await g.readSettings())[101], 150);
  } finally { fake.close(); }
});

test('from $101 = 1607 the turn test still creeps, and one turn gives 4.444 back', async () => {
  const { sim, g } = await plotter({ 101: 4.444 });        // 1.8° motor, 8 microsteps, platter on the shaft
  await g.send(`$101=${TIMS.toFixed(3)}`);
  const vals = await g.readSettings();
  assert.equal(vals[101], 1607.143);
  assert.equal(await sane(g, 101, vals[101]), vals[101]);  // wrong, but the slow turn can work from it
  const from = (await g.nextStatus()).mpos[1];
  const line = slowJog('Y', 1, vals[101], vals[121]);
  near(feedOf(line) / 60 * vals[101], SLOW.Y.rate, 0.2);   // 107 motor steps a second, as always
  await g.send(line);
  const perSec = sim.real([0, 1, 0])[1] * feedOf(line) / 60;
  assert.ok(perSec > 20 && perSec < 28, `${perSec}°/s`);    // a turn in about 15 s
  sim.advance(360 / perSec * 1000);
  const at = (await stopJog(g))[1];
  near(sim.real()[1], 360, 0.01);
  const raw = corrected(vals[101], Math.abs(at - from), 360);
  near(raw, 4.444, 0.005);                                 // (a turn is 0.995 units here, reported to 0.001)
  await saveSetting(g, 101, snapDirect(raw) ?? raw, vals[101]);
  assert.equal(sim.received.at(-1), '$101=4.444');
  // a 2° nudge at this wrong setting: 400 motor steps a second, not 8000
  near(feedOf(nudgeJog('Y', 2, 300, 1607.143)) / 60 * 1607.143, NUDGE.Y, 0.5);
  assert.equal(nudgeJog('Y', 2, 300, 4.444), '$J=G91 G21 Y2.000 F300');
  assert.equal(nudgeJog('X', -1, 1000, 100), '$J=G91 G21 X-1.000 F600');
});

test('steps per unit beyond anything real: the slow move refuses, the tool starts from a plain value', async () => {
  // 1607 saved a second time through the old box ("it turned 1°") would have given 578 571
  assert.throws(() => slowJog('Y', 1, 578571.429), /\$101 is far too high/);
  assert.throws(() => slowJog('X', 1, 20000), /\$100 is far too high/);
  const { sim, g } = await plotter({ 101: 4.444 });
  await g.send('$101=578571.429');
  const spu = await sane(g, 101, (await g.readSettings())[101]);
  assert.equal(spu, START[101]);
  assert.equal(sim.received.at(-1), '$101=8.889');
  assert.equal((await g.readSettings())[101], 8.889);
  assert.equal(await sane(g, 101, 8.889), 8.889);
  assert.equal(sim.received.at(-1), '$$');                 // nothing written the second time
  await assert.rejects(sane(g, 101, undefined), /Could not read/);
  assert.equal(await sane(g, 102, 0), START[102]);         // zero steps per unit would never move
  slowJog('Y', 1, spu, 10);                                // and now the slow turn can run
});

test('Stop during the circle: the platter stops there, the pen lifts, the circle is not kept', async () => {
  const { sim, g } = await plotter();
  await g.setCenter();
  let stopped = false;
  const live = () => { if (stopped) throw new Error('Stopped.'); return true; };
  const circle = drawCircle(g, { penUp: 2, penDown: 0 }, 17.132, live);
  const failed = assert.rejects(circle, /Stopped\./);
  while (!sim.received.includes('G0 Z2')) await new Promise(r => setTimeout(r, 10));   // all four lines are in
  sim.advance(5000);                                       // part of the way round
  const at = sim.pos[1];
  assert.ok(at > 20 && at < 200, `${at}°`);
  stopped = true;
  await stopMove(g, 2);
  await failed;
  sim.advance(600000);
  near(sim.pos[1], at, 0.01);                              // it did not finish the turn
  near(sim.pos[2], 2);                                     // pen up
  near((await g.nextStatus()).wpos[1], at, 0.01);          // and the center is still where it was set
});
