// Homing switch (js/home.js) against the pretend plotters with a switch on the X- side, and the
// spring holder's Pen press in Calibrate's Pen height.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Grbl, parseStatus } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { SimGrbl } from '../js/simgrbl.js';
import { home, learnHome, fastFeed, slowFeed, pressed, HOME } from '../js/home.js';
import { touchLift, nudgeJog, waitIdle, penHeights } from '../js/calibrate.js';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b} (±${eps})`);
const links = [];
after(() => links.forEach(f => f.close()));
// FakeGrbl's steps per mm are 47.62; jogs run 20× faster than real time so the tests stay short.
// So the slow touch (1 mm/s) runs at 20 mm/s here: a 50 ms gap between status reports on a busy
// machine is 1 mm (0.05 mm on the real plotter). TOL allows for that.
const TOL = 1.5;
async function plotter(opts = {}) {
  const f = new FakeGrbl({ jogSpeed: 20, bootMs: 5, ...opts });
  links.push(f);
  const g = new Grbl(f);
  await g.ready();
  return { f, g };
}
const opts = extra => ({ spu: 47.62, penUp: 2, ...extra });
const jogs = f => f.received.filter(l => l.startsWith('$J='));

test('status reports: Pn:X means the X limit switch is pressed', () => {
  const a = parseStatus('<Idle|MPos:1.000,2.000,0.000|FS:0,0|Pn:XZ>');
  assert.equal(a.pins, 'XZ');
  assert.equal(pressed(a), true);
  assert.equal(pressed(parseStatus('<Idle|MPos:1.000,2.000,0.000|FS:0,0>')), false);
  assert.equal(pressed(parseStatus('<Idle|MPos:1.000,2.000,0.000|FS:0,0|Pn:Z>')), false);
});

test('the first touch is slow enough to stop within 1 mm; the second is slower', () => {
  assert.equal(fastFeed(40, 10), 268);           // factory $120 = 10 mm/s²: 4.5 mm/s stops in 1 mm
  assert.equal(fastFeed(40, undefined), 268);    // unknown: assume the factory value
  assert.equal(fastFeed(40, 500), HOME.fast);    // quick acceleration: capped
  assert.equal(fastFeed(800, 500), 600);         // never over 8000 motor steps a second
  assert.equal(slowFeed(40), HOME.slow);
});

test('measure once, then Home sets the center by itself, even after the carriage slipped', async () => {
  const { f, g } = await plotter({ switchX: -74 });
  await g.setCenter();                                       // the pen is over the center at machine 0
  const homeX = await learnHome(g, opts());
  near(homeX, -74, TOL);
  assert.ok(!pressed(await g.nextStatus()), 'left resting on the switch');
  near(f.pos[2], 2, 1e-9);                                   // pen up the whole time
  // the carriage slips 7 mm: GRBL's count and the real carriage no longer agree
  f.switchX += 7;
  await home(g, homeX, opts());
  near(g.center[0], 7, TOL);                                 // the real center is at count 7 now
  near(f.wco[0], 7, TOL);                                    // …and work X0 is there
  assert.equal(g.center[1], 0);                              // the platter's zero is kept
  const slow = jogs(f).filter(l => l.endsWith(`F${HOME.slow}`));
  assert.ok(slow.length >= 2, jogs(f).join(' | '));          // touched twice, the second time slowly
});

test('Home without a measured switch only says what to do', async () => {
  const { f, g } = await plotter({ switchX: -74 });
  await assert.rejects(home(g, null, opts()), /Measure the switch first/);
  assert.equal(jogs(f).length, 0);
});

test('starting on the switch: back off first; a switch that never lets go is a wiring fault', async () => {
  const { f, g } = await plotter({ switchX: -44 });
  f.pos[0] = -45;                                            // 1 mm onto the switch
  await home(g, -74, opts());
  near(g.center[0], 30, TOL);
  const { f: f2, g: g2 } = await plotter({ switchX: 1000 }); // pressed everywhere (shorted wire)
  await assert.rejects(home(g2, -74, opts()), /still reads pressed/);
  assert.equal(jogs(f2).length, HOME.tries);                 // only the back-offs, never toward the switch
  assert.ok(jogs(f2).every(l => !l.includes('X-')), jogs(f2).join(' | '));
});

test('no switch found within the distance: gives up and the carriage stops there', async () => {
  const { f, g } = await plotter({ switchX: -1000 });
  await assert.rejects(home(g, -74, opts({ max: 30 })), /No switch within 30 mm/);
  near(f.pos[0], -30, 1e-6);
  assert.equal(g.center, null);
});

test('Stop in the middle of Home cancels the jog where it is', async () => {
  const { f, g } = await plotter({ switchX: -74 });
  let stop = false;
  const live = () => { if (stop) throw new Error('Stopped.'); return true; };
  setTimeout(() => { stop = true; }, 300);
  await assert.rejects(home(g, -74, opts({ live })), /Stopped/);
  const at = f.pos[0];
  await new Promise(r => setTimeout(r, 150));
  assert.equal(f.timed, null);                               // nothing left moving
  assert.equal(f.pos[0], at);
  assert.ok(at < -1 && at > -70, `stopped at ${at}`);        // part way
  assert.equal(f.state, 'Idle');
});

test('the simulator\'s plotter has the switch too', async () => {
  const sim = new SimGrbl({ speed: 20, bootMs: 5, switchX: -20 });
  links.push(sim);
  const g = new Grbl(sim);
  await g.ready();
  await g.setCenter();
  near(await learnHome(g, opts({ spu: 47.62 })), -20, TOL);
  near(sim.real()[0], -20 + HOME.back, TOL);                 // backed off the switch
});

test('pen press: pen down goes that much below the touch point (Z+ lifts)', async () => {
  const sim = new SimGrbl({ speed: 50, bootMs: 5 });
  links.push(sim);
  const g = new Grbl(sim);
  await g.ready();
  await g.send(nudgeJog('Z', -3, 200, 100));
  await waitIdle(g);
  near(sim.pos[2], -3, 1e-9);                                // the tip touches here
  const s = await touchLift(g, 100, undefined, 0.5);
  assert.deepEqual(s, { penUp: 0, penDown: -1.5 });          // lift 1 + press 0.5
  await g.send(`G90 G0 Z${s.penDown}`);
  await waitIdle(g);
  near(sim.pos[2], -3.5, 1e-9);                              // 0.5 past the touch point
  assert.deepEqual(await penHeights(g, sim.pos[2] + 0.5, -2), { penUp: 0, penDown: 0.5 });   // a negative press is ignored
});
