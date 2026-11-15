// Live progress while plotting: how far along the drawing is and how long is left.
// The G-code's own plan says how long each line takes (G93: F = 1 / minutes for the move; G0 and
// G94 moves run at their feed, never faster than GRBL's max rates $110-$112). The plotter is
// usually slower than the plan (acceleration, short moves), so the time left is the planned time
// left scaled by how fast the plan has really been going so far.

// GRBL 1.1's factory max rates ($110-$112, per minute), used when the plotter's are unknown.
export const RATES = { 110: 500, 111: 500, 112: 500 };
// The plan counts this many minutes as already "seen at the planned speed", so the first few
// seconds of a plot (planner filling, the first slow moves) don't swing the estimate wildly.
export const PRIOR = 1;

// lines: as streamed (gcodeLines). vals: the plotter's $$ (rates per minute). Returns cum, where
// cum[i] = planned minutes from the start up to the end of line i.
export function plannedTimes(lines, vals = {}) {
  const rate = n => (vals?.[n] > 0 ? vals[n] : RATES[n]);
  const max = [rate(110), rate(111), rate(112)];
  let pos = [0, 0, 0], abs = true, g93 = false, rapid = true, feed = 0, t = 0;
  const cum = new Array(lines.length);
  lines.forEach((raw, i) => {
    const line = raw.toUpperCase();
    let g92 = false;
    for (const [, g] of line.matchAll(/G\s*(\d+)/g)) {
      const n = +g;
      if (n === 0 || n === 1) rapid = n === 0;
      else if (n === 90 || n === 91) abs = n === 90;
      else if (n === 93 || n === 94) g93 = n === 93;
      else if (n === 92) g92 = true;
    }
    const f = /F\s*(-?[\d.]+)/.exec(line);
    if (f && !g93) feed = +f[1];
    if (!g92 && !line.startsWith('$')) {
      const to = pos.slice();
      for (const [, k, v] of line.matchAll(/([XYZ])\s*(-?[\d.]+)/g)) {
        const a = 'XYZ'.indexOf(k);
        to[a] = abs ? +v : pos[a] + +v;
      }
      const d = to.map((v, a) => Math.abs(v - pos[a]));
      if (d.some(v => v > 0)) {
        let min = Math.max(...d.map((v, a) => v / max[a]));         // the axes' max rates
        if (!rapid) {
          const F = g93 ? (f ? +f[1] : 0) : feed;
          if (F > 0) min = Math.max(min, g93 ? 1 / F : Math.hypot(...d) / F);
        }
        t += min;
        pos = to;
      }
    }
    cum[i] = t;
  });
  return cum;
}

// Where a plot stands. cum: plannedTimes(); from: the first line of this run (0, or where a
// resume picked up); done: lines of the drawing surely drawn; ms: time this run has been going
// (pauses left out). Returns { share } (0..1 of the whole drawing, by planned time) and
// { left } (minutes still to go).
export function estimate(cum, from, done, ms) {
  const total = cum.length ? cum[cum.length - 1] : 0;
  const at = n => (n > 0 ? cum[Math.min(n, cum.length) - 1] : 0);
  const before = at(from), now = at(Math.max(from, done));
  const ran = now - before;                                          // planned minutes this run has done
  const factor = (ms / 60000 + PRIOR) / (ran + PRIOR);               // how much slower than planned
  return { share: total > 0 ? now / total : 0, left: Math.max(0, total - now) * factor };
}

// "12 min" / "1 h 05 min" / "under a minute"
export function minutesText(m) {
  if (!(m >= 1)) return 'under a minute';
  const r = Math.round(m);
  return r < 60 ? `${r} min` : `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')} min`;
}
