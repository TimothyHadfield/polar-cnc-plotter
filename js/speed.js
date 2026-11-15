// Speed test (Calibrate): runs the carriage, then the platter, faster and faster with the pen up.
// After each run the user says Smooth or Skipped (grinding, buzzing, a move that fell short). The
// fastest smooth run, less a safety margin, becomes GRBL's max rate ($110 carriage mm/min, $111
// platter °/min) with the acceleration that run used ($120 / $121): each run speeds up over the
// first quarter of its length and slows down over the last, so a run always reaches its speed.
// Speeds are counted in motor steps a second, so they mean the same whatever $100 / $101 are, and
// never pass what js/safe.js lets a jog do.

import { JOG_SPS } from './safe.js';

export const SPEED = {
  X: { sps: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], run: 40, from: 20, unit: 'mm' },     // 40 mm out and back from 20 mm
  Y: { sps: [400, 800, 1200, 1600, 2000, 2500, 3000, 3500, 4000], run: 720, unit: '°' },            // two turns and back
};
export const MARGIN = 0.8;          // saved speed = 80 % of the fastest smooth run

const n = axis => 'XYZ'.indexOf(axis);
const round = (v, d = 0) => +v.toFixed(d);

// Run i on an axis: { feed (units/min), accel (units/s²), sps } for steps per unit `spu`.
export function trial(axis, i, spu) {
  if (!(spu > 0)) throw new Error('Could not read the settings.');
  const s = SPEED[axis], sps = Math.min(s.sps[i], JOG_SPS[axis]);
  const feed = Math.floor(sps * 60 / spu * 10) / 10;               // rounded down: never past the limit
  return { feed, accel: rampAccel(feed, s.run), sps };
}
// Speeding up over a quarter of the run: v² / (2a) = run / 4.
export const rampAccel = (feed, run) => round(2 * (feed / 60) ** 2 / run, 1);

// The G-code for run i: rates for the run, then out and back (pen up first; the carriage starts
// from `from` mm so it has room).
export function trialLines(axis, i, spu, penUp) {
  const { feed, accel } = trial(axis, i, spu), s = SPEED[axis], a = n(axis);
  const lead = axis === 'X' ? [`G90 G0 Z${penUp}`, `G0 X${s.from}`] : [`G90 G0 Z${penUp}`];
  return { lead, run: [`$${110 + a}=${feed}`, `$${120 + a}=${accel}`, `G91 G0 ${axis}${s.run}`, `G0 ${axis}-${s.run}`, 'G90'] };
}

// What to save after the runs: best = index of the fastest smooth run (-1: none was smooth).
// Returns [{ n, to }] for $110 / $120 or $111 / $121, or [] when nothing was smooth.
export function tuned(axis, best, spu) {
  if (best < 0) return [];
  const a = n(axis), { feed } = trial(axis, best, spu);
  const rate = round(feed * MARGIN), accel = rampAccel(rate, SPEED[axis].run);
  return [{ n: 110 + a, to: rate }, { n: 120 + a, to: accel }];
}

// Run all of it on a plotter: ask(axis, i, trial) resolves true (smooth) or false (skipped).
// Puts the old rates back at the end (or on a throw), and returns { X: best, Y: best }.
export async function speedTest(grbl, vals, { penUp, ask, idle, axes = ['X', 'Y'] }) {
  const old = { 110: vals[110], 111: vals[111], 120: vals[120], 121: vals[121] };
  const best = {};
  try {
    for (const axis of axes) {
      best[axis] = -1;
      const spu = vals[100 + n(axis)];
      for (let i = 0; i < SPEED[axis].sps.length; i++) {
        const { lead, run } = trialLines(axis, i, spu, penUp);
        for (const l of lead) await grbl.send(l);
        await idle();
        for (const l of run) await grbl.send(l);
        await idle();
        if (!await ask(axis, i, trial(axis, i, spu))) break;
        best[axis] = i;
      }
      await putBack(grbl, old, axis);
    }
  } catch (e) {
    for (const axis of axes) await putBack(grbl, old, axis).catch(() => {});
    throw e;
  }
  return best;
}
async function putBack(grbl, old, axis) {
  const a = n(axis);
  for (const k of [110 + a, 120 + a]) if (Number.isFinite(old[k])) await grbl.send(`$${k}=${old[k]}`);
}
