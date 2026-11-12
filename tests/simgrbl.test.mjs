// The simulator's pretend GRBL (js/simgrbl.js): real move times, planner of 15, and that the app's
// own streamer can plot a whole drawing through it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grbl, gcodeLines } from '../js/grbl.js';
import { SimGrbl, PLANNER_BLOCKS } from '../js/simgrbl.js';
import { DEFAULTS, convert } from '../js/polar.js';

const sims = [];
after(() => sims.forEach(s => s.close()));
const settle = () => new Promise(r => setTimeout(r, 5));
// a SimGrbl whose clock only moves when the test says so
function still(opts) {
  const s = new SimGrbl(opts);
  sims.push(s);
  clearInterval(s.timer);
  s.onLine = () => {};
  return s;
}

test('G93 (inverse time): a G1 takes 1/F minutes', async () => {
  const s = still();
  s.write('G21 G90 G93\nG1 X5 Y0 F60\n');
  await settle();
  assert.equal(s.planner.length, 1);
  assert.equal(s.planner[0].ms, 1000);
  s.advance(500);
  assert.ok(Math.abs(s.pos[0] - 2.5) < 1e-9, `halfway: X ${s.pos[0]}`);
  s.advance(600);
  assert.deepEqual(s.pos, [5, 0, 0]);
  assert.deepEqual(s.trail, [[5, 0, 0]]);
});

test('G93 is never faster than the axis max rate; G0 runs at the max rate', async () => {
  const s = still();
  s.write('G21 G90 G93\nG1 Y90 F600\nG0 X100\n');
  await settle();
  assert.equal(s.planner[0].ms, 90 / 500 * 60000);     // $111 = 500 deg/min, not 0.1 s
  assert.equal(s.planner[1].ms, 100 / 500 * 60000);
});

test('G94 feed and jogs: distance / F, relative jogs from where the last move ends', async () => {
  const s = still();
  s.write('G94 G1 X30 F300\n$J=G91 G21 X-10 F300\n');
  await settle();
  assert.equal(s.planner[0].ms, 6000);
  assert.deepEqual(s.planner[1].to, [20, 0, 0]);
  assert.equal(s.planner[1].ms, 2000);
  assert.equal(s.planner[1].jog, true);
});

test('acknowledges at most 15 moves ahead (the planner), then waits', async () => {
  const s = still();
  let oks = 0;
  s.onLine = l => { if (l === 'ok') oks++; };
  s.write(Array.from({ length: 20 }, (_, i) => `G0 X${i + 1}`).join('\n') + '\n');
  await settle();
  assert.equal(oks, PLANNER_BLOCKS);
  s.advance(s.planner[0].ms);   // exactly one block finishes
  await settle();
  s.fill();
  await settle();
  assert.equal(oks, PLANNER_BLOCKS + 1);
});

test('the app plots a whole drawing through it, ending where the G-code ends', async () => {
  const strokes = JSON.parse(readFileSync(new URL('fixtures/hello-world.json', import.meta.url)));
  const gcode = convert(strokes, DEFAULTS).gcode;
  const sim = new SimGrbl({ speed: 2000, bootMs: 5 });
  sims.push(sim);
  const g = new Grbl(sim);
  await g.ready();
  await g.setCenter();
  const res = await g.stream(gcodeLines(gcode));
  assert.equal(res.errors.length, 0);
  const lastXY = gcode.trim().split('\n').reverse().find(l => /^G[01] X/.test(l)).match(/X(-?[\d.]+) Y(-?[\d.]+)/).slice(1).map(Number);
  assert.ok(Math.abs(sim.pos[0] - lastXY[0]) < 1e-6 && Math.abs(sim.pos[1] - lastXY[1]) < 1e-6, `ends at ${sim.pos}`);
  assert.equal(sim.pos[2], DEFAULTS.penUp);
  assert.equal(sim.overflow, false);
  sim.close();
});
