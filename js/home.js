// Homing switch (upgrade, 2026-11-15): one lever switch on the carriage's motor side (machine X-,
// "Right"), wired to the CNC shield's X limit pin and GND. GRBL is not told about it: `$21` and `$22`
// stay 0 (stock `$H` homes Z first and would alarm, there is no Z switch). The app watches the
// status reports instead: GRBL 1.1 adds `Pn:X` while the X limit pin reads pressed.
//
// Home: pen up, jog toward the switch, jog cancel (0x85) the moment it shows, back off, touch it
// again slowly. The switch's position from the center (`homeX`, measured once in Calibrate's Find
// center) then sets the center by itself, which also puts right a carriage that slipped steps.

import { jogFeed } from './safe.js';

export const HOME = {
  max: 250,        // mm searched before giving up (the carriage travels under 200)
  free: 5,         // mm backed off when the switch already reads pressed at the start
  back: 3,         // mm backed off between the first and the second touch
  tries: 2,        // back-offs before a switch that stays pressed counts as a wiring fault
  fast: 600,       // mm/min at most for the first touch
  slow: 60,        // mm/min for the second touch (the one that counts)
  overshoot: 1,    // mm the carriage may coast past the switch after the jog cancel
  accel: 10,       // mm/s² when $120 is unknown (GRBL's factory value)
};

export const pressed = s => (s?.pins || '').includes('X');

// The first touch's feed: slow enough to stop within HOME.overshoot at `accel` mm/s² ($120), and
// never more motor steps a second than safe.js allows.
export function fastFeed(spu, accel) {
  const a = accel > 0 ? accel : HOME.accel;
  return jogFeed('X', Math.min(HOME.fast, Math.floor(Math.sqrt(2 * a * HOME.overshoot) * 60)), spu);
}
export const slowFeed = spu => jogFeed('X', HOME.slow, spu);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jog = (d, feed) => `$J=G91 G21 X${d.toFixed(3)} F${feed}`;

// The status once the plotter stands still. live() throws to stop (Stop pressed, unplugged).
async function idle(grbl, live) {
  for (;;) {
    live();
    const s = await grbl.nextStatus().catch(() => null);
    live();
    if (s?.state === 'Alarm') throw new Error('Alarm: unlock with $X in the Settings console.');
    if (s?.state === 'Idle') return s;
    await sleep(40);
  }
}

// Move away from the switch (X+) until it lets go.
async function release(grbl, live, mm, feed, what) {
  for (let i = 0; i < HOME.tries; i++) {
    await grbl.send(jog(mm, feed));
    if (!pressed(await idle(grbl, live))) return;
  }
  throw new Error(what);
}

// Jog toward X- up to `dist` mm until the switch closes. Returns the machine X in the first status
// report that shows it pressed (GRBL reads the pin and the position for the same report).
async function touch(grbl, live, dist, feed) {
  live();
  await grbl.send(jog(-dist, feed));
  const until = Date.now() + dist / feed * 60000 * 1.5 + 3000;
  for (;;) {
    live();
    const s = await grbl.nextStatus(1000).catch(() => null);
    if (s && pressed(s)) { grbl.realtime('\x85'); return s.mpos[0]; }
    if (s?.state === 'Alarm') throw new Error('Alarm: unlock with $X in the Settings console.');
    if (s?.state === 'Idle') throw new Error(`No switch within ${+dist.toFixed(1)} mm. Check that it is wired to X limit and GND.`);
    if (Date.now() > until) throw new Error('The switch never clicked. Check its wiring.');
    await sleep(10);
  }
}

// Find the switch. o = { spu ($100), accel ($120), penUp, live, max }. Returns the machine X where it
// closes on the slow touch. The carriage ends a few mm off the switch, pen up.
export async function findSwitch(grbl, { spu, accel, penUp, live = () => true, max = HOME.max } = {}) {
  const slow = slowFeed(spu), fast = fastFeed(spu, accel);
  try {
    let s = await grbl.nextStatus();
    if (s.state !== 'Idle') throw new Error('Wait until the plotter stands still.');
    if (penUp !== undefined) await grbl.send(`G90 G0 Z${penUp}`);
    s = await idle(grbl, live);
    if (pressed(s)) await release(grbl, live, HOME.free, fast, 'The switch still reads pressed after backing off. Check its wiring.');
    await touch(grbl, live, max, fast);
    await idle(grbl, live);
    await release(grbl, live, HOME.back, fast, 'The switch stays pressed. Check its wiring.');
    const x = await touch(grbl, live, HOME.back * (HOME.tries + 2), slow);
    await idle(grbl, live);
    await release(grbl, live, HOME.back, fast, 'The switch stays pressed. Check its wiring.');
    return x;
  } catch (e) {
    grbl.realtime('\x85');          // never leave a jog running
    throw e;
  }
}

// Home: find the switch and set the center from it. Keeps the platter's zero when a center is
// already set; otherwise the platter's angle now becomes 0, as Set center does.
export async function home(grbl, homeX, o) {
  if (!Number.isFinite(homeX)) throw new Error('Measure the switch first: Calibrate, Find center.');
  const x = await findSwitch(grbl, o);
  const s = await grbl.nextStatus();
  grbl.center = [x - homeX, grbl.center ? grbl.center[1] : s.mpos[1]];
  await grbl.restoreCenter();
}

// Calibrate: the center is set; how far from it is the switch? (mm, negative: the X- side)
export async function learnHome(grbl, o) {
  if (!grbl.center) throw new Error('Set the center first.');
  const x = await findSwitch(grbl, o);
  return Math.round((x - grbl.center[0]) * 100) / 100;
}
