// Picture -> pen strokes in two shading styles, for photos rather than line art.
//   spiral: ONE line from the centre outward that wiggles side to side where the picture is dark
//   hatch:  straight parallel lines, up to three directions; darker areas get more directions
// Both take { gray, w, h } (0 = black) and return { strokes, gapPx } with strokes in pixel
// coordinates, y down, like traceImage. `threshold` is the paper-white point: pixels at least
// that light get no ink. `gap` is millimetres ON THE PAPER, so these also need the drawing size
// (diameter, size) that fitStrokes in polar.js will scale the strokes' extent to.

import { DEFAULTS } from './polar.js';

const TAU = 2 * Math.PI;

function options(opts) {
  const o = { ...DEFAULTS, gap: 1.2, ...opts };
  return { ...o, thr: Math.max(1, opts.threshold ?? 128), target: (o.diameter / 2) * (o.size / 100) };
}

// Box-blurred copy of the picture: each pixel becomes the mean of the (2r+1)^2 square around it
// (clipped at the picture's edge). Summed-area table, so the cost doesn't depend on r.
export function blur(gray, w, h, r) {
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      out[y * w + x] = (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

// ---------- spiral ----------
//
// The spiral covers the circle AROUND the picture (radius = half its diagonal), so the whole
// picture is used and the corners aren't cropped; outside the picture counts as white paper.
// It ends with one plain full ring at that radius, starting on the +x axis, so the strokes'
// bounding box is exactly that circle: fitStrokes then maps it to the drawing circle and the
// ring spacing on paper is exactly `gap` mm.
export function spiral(img, opts = {}) {
  const { gray, w, h } = img;
  const o = options(opts);
  const Rs = Math.hypot(w, h) / 2;
  const pxPerMm = Rs / o.target;
  const g = o.gap * pxPerMm;                   // ring spacing in pixels
  const b = g / TAU;                           // r = b * turned angle
  const cx = w / 2, cy = h / 2;
  const mean = blur(gray, w, h, Math.max(0, Math.round(g / 2)));
  const darkness = (x, y) => {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= w || j >= h) return 0;
    return Math.max(0, Math.min(1, (o.thr - mean[j * w + i]) / o.thr));
  };
  const step = 0.4 * g;                        // half a wiggle: zig-zag wavelength 0.8 * gap
  const tol = 0.02 * pxPerMm;                  // how far a straight chord may sag off the curve
  const maxTurn = r => Math.min(0.3, Math.sqrt(8 * tol / Math.max(r, tol)));
  const tEnd = Rs / b;
  const phase = -tEnd;                         // so the spiral ends on the +x axis

  // samples along the spiral: turned angle, amplitude
  const T = [], A = [];
  for (let t = 0; t < tEnd;) {
    const r = b * t, a = phase + t;
    const d = darkness(cx + r * Math.cos(a), cy + r * Math.sin(a));
    T.push(t);
    A.push(Math.min(0.45 * g * d, r, Rs - r));  // never through the centre or past the last ring
    t += Math.min(maxTurn(r), step / Math.hypot(r, b));
  }
  T.push(tEnd); A.push(0);

  const pts = [];
  let last = -Infinity;
  for (let j = 0; j < T.length; j++) {
    const plain = !A[j] && !A[j - 1] && !A[j + 1];
    const r = b * T[j];
    if (plain && j > 0 && j < T.length - 1 && T[j + 1] - last <= maxTurn(r)) continue;  // straight bit: skip
    const rr = r + (j % 2 ? -A[j] : A[j]);
    const a = phase + T[j];
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    last = T[j];
  }
  // closing ring, points on the four axes included
  const n = 4 * Math.ceil(TAU / 4 / maxTurn(Rs));
  for (let k = 1; k <= n; k++) pts.push([cx + Rs * Math.cos(k * TAU / n), cy + Rs * Math.sin(k * TAU / n)]);
  return { strokes: [pts], gapPx: g };
}

// ---------- hatch ----------

// The circle fitStrokes will scale to the drawing area: centre of the bounding box, max distance.
function extent(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let R = 0;
  for (const s of strokes) for (const [x, y] of s) R = Math.max(R, Math.hypot(x - cx, y - cy));
  return R;
}

// Layers: [direction, how dark (mean below this) a spot must be to get it]
const LAYERS = [[Math.PI / 4, 1], [-Math.PI / 4, 2 / 3], [0, 1 / 3]];

function hatchLines(gray, w, h, thr, s) {
  const mean = blur(gray, w, h, Math.max(1, Math.round(s / 2)));
  const cx = w / 2, cy = h / 2;
  const out = [];
  for (const [phi, frac] of LAYERS) {
    const lim = thr * frac;
    const ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux;
    const proj = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => (x - cx) * nx + (y - cy) * ny);
    const kMin = Math.ceil(Math.min(...proj) / s), kMax = Math.floor(Math.max(...proj) / s);
    for (let k = kMin; k <= kMax; k++) {
      // the line p(t) = p0 + t u, clipped to the picture
      const px = cx + k * s * nx, py = cy + k * s * ny;
      let tA = -Infinity, tB = Infinity;
      for (const [p, u, hi] of [[px, ux, w], [py, uy, h]]) {
        if (Math.abs(u) < 1e-12) { if (p < 0 || p > hi) tA = Infinity; continue; }
        const t0 = (0 - p) / u, t1 = (hi - p) / u;
        tA = Math.max(tA, Math.min(t0, t1)); tB = Math.min(tB, Math.max(t0, t1));
      }
      if (!(tB > tA)) continue;
      const segs = [];
      let start = null, end = 0;
      const close = () => {
        const a = Math.max(tA, start - 0.5), z = Math.min(tB, end + 0.5);
        if (z - a >= s) segs.push([[px + a * ux, py + a * uy], [px + z * ux, py + z * uy]]);
        start = null;
      };
      for (let t = tA + 0.5; t < tB; t += 1) {
        const i = Math.min(w - 1, Math.max(0, Math.floor(px + t * ux)));
        const j = Math.min(h - 1, Math.max(0, Math.floor(py + t * uy)));
        if (mean[j * w + i] < lim) { if (start === null) start = t; end = t; }
        else if (start !== null) close();
      }
      if (start !== null) close();
      // every other line runs backwards, so the pen zig-zags instead of flying back
      if (k & 1) { segs.reverse(); for (const sg of segs) sg.reverse(); }
      out.push(...segs);
    }
  }
  return out;
}

// Line spacing on paper depends on how big the hatched area ends up (fitStrokes scales its
// extent to the drawing circle), and the area depends a little on the spacing, so a few rounds.
export function hatch(img, opts = {}) {
  const { gray, w, h } = img;
  const o = options(opts);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (gray[y * w + x] < o.thr) {
    if (x < x0) x0 = x; if (x + 1 > x1) x1 = x + 1; if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1;
  }
  if (!isFinite(x0)) return { strokes: [], gapPx: 0 };
  let R = Math.hypot(x1 - x0, y1 - y0) / 2;
  let best = { strokes: [], gapPx: 0 }, bestErr = Infinity;
  for (let round = 0; round < 6; round++) {
    const s = o.gap * R / o.target;
    const strokes = hatchLines(gray, w, h, o.thr, s);
    if (!strokes.length) return best.strokes.length ? best : { strokes, gapPx: s };
    const Rout = extent(strokes);
    const err = Math.abs(Rout - R) / R;
    if (err < bestErr) { best = { strokes, gapPx: s }; bestErr = err; }
    if (err < 0.002) break;
    R = Rout;
  }
  return best;
}
