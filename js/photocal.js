// Photo check: the Test drawing (js/patterns.js testStrokes), photographed, says what is off.
// The user taps points the app asks for: the paper's edge (a 200 mm circle, so no ruler is needed:
// it sets the scale and takes out a tilted camera), the big circle, the square's corners, the
// cross's ends and the cross line just beside the middle. A model of the machine is then fitted
// to the taps:
//   a = how far the carriage really goes per mm asked     -> $100 / a
//   b = how far the platter really turns per degree asked -> $101 / b
//   e = how far the pen at X0 sat from the platter center (mm, along the rail; Set center / Home)
//   d = the center gap the pen line really has             -> Settings, Center gap
// A point the G-code sends to machine (X, Y) lands at toPlatter([a·X + e, b·Y], gap d) on the
// paper, seen in the photo turned by ρ and shifted by t (the paper need not sit square or centered).
// Pure math, no page: tested in tests/photocal.test.mjs.

import { prepare, toGcode, toPlatter, DEFAULTS } from './polar.js';
import { testStrokes, TEST_SIDE, TEST_RADIUS } from './patterns.js';
import { gcodeLines } from './grbl.js';

export const PAPER_R = 100;     // mm, the round sheet (app.js PAPER = 200 across)
const H = TEST_SIDE / 2;
const RING = 85;                // the big circle's radius in the Test drawing, at Size 100 %

// What the user taps, in order. kind: 'edge' (the paper's edge), 'curve' (anywhere along a line),
// 'point' (one exact spot). `at`: where it is in the Test drawing (mm, y up, at Size 100 %).
const edge = n => ({ part: 'paper', kind: 'edge', say: `Paper edge ${n} of 5`, at: [PAPER_R * Math.cos(n * 1.257 - 0.5), PAPER_R * Math.sin(n * 1.257 - 0.5)], paper: true });
export const TAPS = [
  ...[1, 2, 3, 4, 5].map(edge),
  { part: 'ring', kind: 'curve', say: 'Big circle, right', at: [RING, 0] },
  { part: 'ring', kind: 'curve', say: 'Big circle, top', at: [0, RING] },
  { part: 'ring', kind: 'curve', say: 'Big circle, left', at: [-RING, 0] },
  { part: 'ring', kind: 'curve', say: 'Big circle, bottom', at: [0, -RING] },
  { part: 'square', kind: 'point', say: 'Square corner, top right', at: [H, H] },
  { part: 'square', kind: 'point', say: 'Square corner, top left', at: [-H, H] },
  { part: 'square', kind: 'point', say: 'Square corner, bottom left', at: [-H, -H] },
  { part: 'square', kind: 'point', say: 'Square corner, bottom right', at: [H, -H] },
  { part: 'armH', kind: 'point', say: 'Cross end, right', at: [H, 0] },
  { part: 'armV', kind: 'point', say: 'Cross end, top', at: [0, H] },
  { part: 'armH', kind: 'point', say: 'Cross end, left', at: [-H, 0] },
  { part: 'armV', kind: 'point', say: 'Cross end, bottom', at: [0, -H] },
  { part: 'armR', kind: 'curve', say: 'Cross line, just right of the middle', at: [8, 0] },
  { part: 'armL', kind: 'curve', say: 'Cross line, just left of the middle', at: [-8, 0] },
];
export const EDGES = TAPS.filter(t => t.kind === 'edge').length;

// ---------- small linear algebra ----------
// Solve A x = b (square, Gaussian elimination with pivoting). null when singular.
export function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// Circle through points (least squares, Kåsa): { c: [x, y], r }.
export function fitCircle(pts) {
  const n = pts.length;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const [x, y] of pts) {
    const row = [x, y, 1], z = x * x + y * y;
    for (let i = 0; i < 3; i++) { b[i] += row[i] * z; for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j]; }
  }
  const s = n >= 3 ? solve(A, b) : null;
  if (!s) return null;
  const c = [s[0] / 2, s[1] / 2];
  return { c, r: Math.sqrt(s[2] + c[0] * c[0] + c[1] * c[1]) };
}

// The paper's edge in the photo (an ellipse when the camera is tilted) -> a map from photo pixels
// to paper mm: the edge becomes a circle of radius PAPER_R around (0, 0), y up. Needs 5+ points.
// (A tilted camera is taken as an affine view; fine for a photo taken roughly from above.)
export function rectifier(px) {
  if (px.length < 5) return null;
  const pts = px.map(([x, y]) => [x, -y]);                        // y up
  const m = [0, 1].map(i => pts.reduce((s, p) => s + p[i], 0) / pts.length);
  const sc = Math.sqrt(pts.reduce((s, p) => s + (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2, 0) / pts.length) || 1;
  const P = pts.map(p => [(p[0] - m[0]) / sc, (p[1] - m[1]) / sc]);
  // A x² + B xy + C y² + D x + E y = 1
  const N = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]), v = [0, 0, 0, 0, 0];
  for (const [x, y] of P) {
    const r = [x * x, x * y, y * y, x, y];
    for (let i = 0; i < 5; i++) { v[i] += r[i]; for (let j = 0; j < 5; j++) N[i][j] += r[i] * r[j]; }
  }
  const s = solve(N, v);
  if (!s) return null;
  const [A, B, C, D, E] = s;
  const c = solve([[2 * A, B], [B, 2 * C]], [-D, -E]);
  if (!c) return null;
  const K = 1 - (A * c[0] ** 2 + B * c[0] * c[1] + C * c[1] ** 2 + D * c[0] + E * c[1]);
  const a = A / K, b = B / 2 / K, d = C / K;                    // u' [a b; b d] u = 1
  if (!(a > 0 && a * d - b * b > 0)) return null;               // not an ellipse
  // symmetric square root of [a b; b d]
  const tr = a + d, det = Math.sqrt(a * d - b * b), t = Math.sqrt(tr + 2 * det);
  const S = [[(a + det) / t, b / t], [b / t, (d + det) / t]];
  return ([x, y]) => {
    const u = (x - m[0]) / sc - c[0], w = (-y - m[1]) / sc - c[1];
    return [PAPER_R * (S[0][0] * u + S[0][1] * w), PAPER_R * (S[1][0] * u + S[1][1] * w)];
  };
}

// ---------- the drawing as the G-code sends it ----------
// Pen-down paths of the Test drawing as planned with settings `o`: machine points [X, Y] about
// `step` mm apart (moves are straight in machine X/Y, as GRBL runs them), each with its intended
// spot on the paper, sorted into the parts the taps name.
export function testPaths(o, step = 0.5) {
  const s = { ...DEFAULTS, ...o };
  const k = s.diameter / 2 * (s.size ?? 100) / 100 / TEST_RADIUS;    // drawing mm per Test mm
  const gcode = toGcode(prepare(testStrokes(), s, { turn: 0, dx: 0, dy: 0, crop: null }), s).gcode;
  const zMid = (s.penUp + s.penDown) / 2, down = z => (s.penDown < s.penUp ? z <= zMid : z >= zMid);
  let x = 0, y = 0, z = s.penUp, cur = null;
  const paths = [];
  for (const line of gcodeLines(gcode)) {
    const w = {};
    for (const [, kk, v] of line.toUpperCase().matchAll(/([XYZ])\s*(-?[\d.]+)/g)) w[kk] = +v;
    const nx = w.X ?? x, ny = w.Y ?? y, nz = w.Z ?? z;
    if (down(z) && (nx !== x || ny !== y)) {
      if (!cur) { cur = [[x, y]]; paths.push(cur); }
      const r = Math.hypot(Math.max(Math.abs(x), Math.abs(nx)), s.offset);
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(ny - y) * Math.PI / 180 * r, Math.abs(nx - x)) / step));
      for (let i = 1; i <= n; i++) cur.push([x + (nx - x) * i / n, y + (ny - y) * i / n]);
    }
    x = nx; y = ny; z = nz;
    if (!down(z)) cur = null;
  }
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const parts = { ring: [], square: [], armH: [], armV: [], armR: [], armL: [] };
  for (const m of paths) {
    const pts = m.map(p => toPlatter(p, s).map(v => v / k));          // in Test mm
    const all = f => pts.every(f);
    const item = { m, pts };
    if (all(p => Math.abs(Math.hypot(...p) - RING) < 1)) parts.ring.push(item);
    else if (all(p => Math.abs(p[1]) < 0.3)) {
      parts.armH.push(item);
      const pick = side => { const i = pts.map((p, j) => (side * p[0] > 1 && side * p[0] < H - 2 ? j : -1)).filter(j => j >= 0); return { m: i.map(j => m[j]), pts: i.map(j => pts[j]) }; };
      for (const [side, key] of [[1, 'armR'], [-1, 'armL']]) { const q = pick(side); if (q.m.length > 1) parts[key].push(q); }
    } else if (all(p => Math.abs(p[0]) < 0.3)) parts.armV.push(item);
    else if (pts.some(p => near(p, [H, H]) < 0.5) && pts.some(p => near(p, [-H, -H]) < 0.5)) parts.square.push(item);
  }
  return { parts, k, flip: !!s.flip, offset: s.offset };
}

// Machine point [X, Y] -> where it really lands on the paper (platter mm), for machine params p.
export const land = (m, p, flip) => toPlatter([p.a * m[0] + p.e, p.b * m[1]], { offset: p.d, flip });

// The machine points of a 'point' tap: every planned point on its target. Usually one; the corner
// where the square starts and ends has two (half a turn of platter error opens it up), and the
// tap may be on either.
function anchor(paths, tap) {
  const out = [];
  for (const it of paths.parts[tap.part]) it.pts.forEach((q, i) => {
    if (Math.hypot(q[0] - tap.at[0], q[1] - tap.at[1]) < 0.05) out.push(it.m[i]);
  });
  return out.length ? out : null;
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Nelder–Mead: minimise f from x0, first steps `step`.
export function minimize(f, x0, step, iters = 4000) {
  const n = x0.length;
  let S = [x0, ...x0.map((_, i) => x0.map((v, j) => v + (i === j ? step[j] : 0)))].map(x => ({ x, f: f(x) }));
  for (let it = 0; it < iters; it++) {
    S.sort((p, q) => p.f - q.f);
    if (Math.abs(S[n].f - S[0].f) < 1e-12 * (1 + Math.abs(S[0].f)) && it > 50) break;
    const c = x0.map((_, j) => S.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n);
    const at = k => c.map((v, j) => v + k * (S[n].x[j] - v));
    const r = { x: at(-1) }; r.f = f(r.x);
    if (r.f < S[0].f) { const e = { x: at(-2) }; e.f = f(e.x); S[n] = e.f < r.f ? e : r; }
    else if (r.f < S[n - 1].f) S[n] = r;
    else {
      const k = { x: at(r.f < S[n].f ? -0.5 : 0.5) }; k.f = f(k.x);
      if (k.f < Math.min(r.f, S[n].f)) S[n] = k;
      else S = S.map((p, i) => (i ? (q => ({ x: q, f: f(q) }))(p.x.map((v, j) => S[0].x[j] + (v - S[0].x[j]) / 2)) : p));
    }
  }
  S.sort((p, q) => p.f - q.f);
  return S[0];
}

// The whole fit. taps: photo pixels [x, y], one per TAPS entry, in that order. o: the settings the
// Test drawing was plotted with. Returns { a, b, e, d, rms, worst } or { error }.
export function fitPhoto(taps, o) {
  if (taps.length < TAPS.length) return { error: 'Tap every point first.' };
  const toMm = rectifier(taps.slice(0, EDGES));
  if (!toMm) return { error: 'The paper edge points don\'t make an oval. Tap them again, spread around the edge.' };
  const paths = testPaths(o);
  const s = { ...DEFAULTS, ...o };
  const q = taps.map(toMm);
  const obs = [];
  TAPS.forEach((t, i) => {
    if (t.kind === 'edge') return;
    const m = t.kind === 'point' ? anchor(paths, t) : null;
    if (t.kind === 'point' && !m) return;
    obs.push({ t, q: q[i], m, items: t.kind === 'curve' ? paths.parts[t.part] : null });
  });
  // start: no errors; the drawing's center where the big circle's taps put it; the turn from the corners
  const ring = fitCircle(obs.filter(o2 => o2.t.part === 'ring').map(o2 => o2.q));
  if (!ring) return { error: 'Tap the big circle again.' };
  const t0 = ring.c;
  const rot = obs.filter(o2 => o2.t.part === 'square').map(o2 => Math.atan2(o2.q[1] - t0[1], o2.q[0] - t0[0]) - Math.atan2(o2.t.at[1], o2.t.at[0]));
  const rho0 = Math.atan2(rot.reduce((a, v) => a + Math.sin(v), 0), rot.reduce((a, v) => a + Math.cos(v), 0));
  const flip = paths.flip;
  const viewer = x => {
    const p = { a: x[0], b: x[1], e: x[2], d: x[3] };
    const c = Math.cos(x[4]), sn = Math.sin(x[4]);
    return { p, view: w => [c * w[0] - sn * w[1] + x[5], sn * w[0] + c * w[1] + x[6]] };
  };
  // a line tap is only compared with the part of its line that lands within 12 mm of it, as the
  // machine params `x` have it (so the fit stays quick)
  const windows = x => {
    const { p, view } = viewer(x);
    for (const o2 of obs) {
      if (!o2.items) continue;
      o2.polys = [];
      for (const it of o2.items) {
        let run = [];
        it.m.forEach(m => {
          const v = view(land(m, p, flip));
          if (Math.hypot(v[0] - o2.q[0], v[1] - o2.q[1]) < 12) run.push(m);
          else { if (run.length > 1) o2.polys.push(run); run = []; }
        });
        if (run.length > 1) o2.polys.push(run);
      }
      if (!o2.polys.length) o2.polys = o2.items.map(it => it.m);
    }
  };
  const err = x => {
    const { p, view } = viewer(x);
    return obs.map(o2 => {
      if (o2.m) return Math.min(...o2.m.map(m => { const v = view(land(m, p, flip)); return Math.hypot(v[0] - o2.q[0], v[1] - o2.q[1]); }));
      let best = Infinity;
      for (const poly of o2.polys) {
        let prev = view(land(poly[0], p, flip));
        for (let i = 1; i < poly.length; i++) { const cur = view(land(poly[i], p, flip)); best = Math.min(best, segDist(o2.q, prev, cur)); prev = cur; }
      }
      return best;
    });
  };
  const cost = x => (x[0] > 0.5 && x[0] < 2 && x[1] > 0.5 && x[1] < 2 ? err(x).reduce((s2, v) => s2 + v * v, 0) : 1e12);
  let x = [1, 1, 0, s.offset, rho0, t0[0], t0[1]];
  const step = [0.02, 0.02, 1, 1, 0.02, 1, 1];
  windows(x);
  let best = minimize(cost, x, step);
  for (let r = 0; r < 3; r++) {
    windows(best.x);
    best = minimize(cost, best.x, step.map(v => v / (r + 2)));
  }
  x = best.x;
  const res = err(x);
  const rms = Math.sqrt(res.reduce((s2, v) => s2 + v * v, 0) / res.length);
  return { a: x[0], b: x[1], e: x[2], d: x[3], rms, worst: Math.max(...res), turn: x[4] };
}

// Settings from a fit: { 100, 101, offset } (only what changed by more than the photo can tell).
export function corrections(fit, vals, o) {
  const out = {};
  if (Math.abs(fit.a - 1) > 0.003) out[100] = +(vals[100] / fit.a).toFixed(3);
  if (Math.abs(fit.b - 1) > 0.002) out[101] = +(vals[101] / fit.b).toFixed(3);
  const d = Math.round(fit.d * 10) / 10 || 0;
  if (Math.abs(d - (o.offset || 0)) >= 0.2) out.offset = d;
  return out;
}
