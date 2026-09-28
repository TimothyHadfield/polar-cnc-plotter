// Picture -> pen strokes. Works on a grayscale array (0 = black, 255 = white), no browser needed.
//   outlines: the pen goes around the edge of every dark shape (marching squares)
//   centerlines: the pen goes down the middle of every dark line (Zhang-Suen thinning)
// Strokes come back in pixel coordinates, y down, like an SVG.

import { simplify } from './polar.js';

// Otsu's method: the threshold that best splits the histogram into ink and paper.
export function otsu(gray) {
  const hist = new Float64Array(256);
  for (const v of gray) hist[v]++;
  const n = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t + 1; }
  }
  return thr;
}

// 1 = ink (darker than the threshold).
export function binarize(gray, thr) {
  const bin = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < thr ? 1 : 0;
  return bin;
}

// Removes ink specks smaller than `minArea` pixels (8-connected).
export function despeckle(bin, w, h, minArea) {
  const seen = new Uint8Array(bin.length);
  const stack = new Int32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || seen[i]) continue;
    let top = 0, count = 0;
    const members = [];
    stack[top++] = i; seen[i] = 1;
    while (top) {
      const p = stack[--top];
      members.push(p); count++;
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (bin[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
      }
    }
    if (count < minArea) for (const p of members) bin[p] = 0;
  }
  return bin;
}

// ---------- outlines (marching squares) ----------

// Corner values sit at pixel centres; contour points sit halfway between two of them.
// Edges are numbered so that neighbouring cells share them: horizontal edge (x,y) joins
// pixel (x,y) and (x+1,y); vertical edge (x,y) joins (x,y) and (x,y+1). x, y start at -1.
const SEGS = {
  1: [['l', 'b']], 2: [['b', 'r']], 3: [['l', 'r']], 4: [['t', 'r']],
  5: [['t', 'r'], ['l', 'b']], 6: [['t', 'b']], 7: [['t', 'l']], 8: [['t', 'l']],
  9: [['t', 'b']], 10: [['t', 'l'], ['b', 'r']], 11: [['t', 'r']], 12: [['l', 'r']],
  13: [['r', 'b']], 14: [['l', 'b']],
};

export function outlines(bin, w, h) {
  const W = w + 2, H = h + 2;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bin[y * w + x]);
  const hId = (x, y) => (y + 1) * W + (x + 1);
  const vId = (x, y) => W * H + (y + 1) * W + (x + 1);
  const point = id => {
    if (id < W * H) { const y = Math.floor(id / W) - 1, x = (id % W) - 1; return [x + 1, y + 0.5]; }
    id -= W * H;
    const y = Math.floor(id / W) - 1, x = (id % W) - 1;
    return [x + 0.5, y + 1];
  };
  const segA = [], segB = [];
  const byEdge = new Map();
  const link = (e, s) => { const l = byEdge.get(e); if (l) l.push(s); else byEdge.set(e, [s]); };
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const c = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1);
    const segs = SEGS[c];
    if (!segs) continue;
    const E = { t: hId(x, y), b: hId(x, y + 1), l: vId(x, y), r: vId(x + 1, y) };
    for (const [a, b] of segs) {
      const s = segA.length;
      segA.push(E[a]); segB.push(E[b]);
      link(E[a], s); link(E[b], s);
    }
  }
  const used = new Uint8Array(segA.length);
  const loops = [];
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const start = segA[s0];
    const pts = [point(start)];
    let edge = segB[s0];
    for (;;) {
      pts.push(point(edge));
      if (edge === start) break;
      const next = byEdge.get(edge).find(s => !used[s]);
      if (next === undefined) break;
      used[next] = 1;
      edge = segA[next] === edge ? segB[next] : segA[next];
    }
    loops.push(pts);
  }
  return loops;
}

// ---------- centerlines (thinning + walking the skeleton) ----------

export function thin(bin, w, h) {
  const img = bin.slice();
  const P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  let changed = true;
  const del = [];
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!img[y * w + x]) continue;
        const p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1);
        const p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0;
        for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) A++;
        if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
        del.push(y * w + x);
      }
      if (del.length) { changed = true; for (const i of del) img[i] = 0; }
    }
  }
  // Thinning leaves "staircase" corners (a pixel touching both N and E, which already touch
  // each other diagonally). They look like junctions and chop lines into bits, so remove every
  // pixel whose neighbours stay connected without it (and that isn't a line end).
  const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!img[y * w + x]) continue;
    const nb = RING.map(([dx, dy]) => P(x + dx, y + dy));
    const count = nb.reduce((a, v) => a + v, 0);
    if (count < 2) continue;
    // neighbours are 8-adjacent to each other when next to each other in the ring, or when
    // both are straight neighbours one step apart around a corner (N and E, via ring index +2)
    const parent = [0, 1, 2, 3, 4, 5, 6, 7];
    const find = a => (parent[a] === a ? a : (parent[a] = find(parent[a])));
    for (let i = 0; i < 8; i++) {
      if (!nb[i]) continue;
      const j = (i + 1) % 8;
      if (nb[j]) parent[find(i)] = find(j);
      if (i % 2 === 0) { const k = (i + 2) % 8; if (nb[k]) parent[find(i)] = find(k); }
    }
    const roots = new Set();
    for (let i = 0; i < 8; i++) if (nb[i]) roots.add(find(i));
    if (roots.size === 1) img[y * w + x] = 0;
  }
  return img;
}

const N8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];  // straight first

export function centerlines(bin, w, h, spur = 4) {
  const sk = thin(bin, w, h);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sk[y * w + x] === 1;
  const degree = new Uint8Array(sk.length);
  for (let i = 0; i < sk.length; i++) if (sk[i]) {
    const x = i % w, y = (i - x) / w;
    let n = 0;
    for (const [dx, dy] of N8) if (on(x + dx, y + dy)) n++;
    degree[i] = n;
  }
  const isNode = i => degree[i] !== 2;
  const seen = new Set();                                  // walked pixel pairs
  const pair = (a, b) => (a < b ? a * sk.length + b : b * sk.length + a);
  const walk = (start, first) => {
    const pts = [start, first];
    seen.add(pair(start, first));
    let prev = start, cur = first;
    while (!isNode(cur) && cur !== start) {
      const x = cur % w, y = (cur - x) / w;
      let next = -1;
      for (const [dx, dy] of N8) {
        if (!on(x + dx, y + dy)) continue;
        const q = (y + dy) * w + x + dx;
        if (q === prev || seen.has(pair(cur, q))) continue;
        next = q; break;
      }
      if (next < 0) break;
      seen.add(pair(cur, next));
      pts.push(next); prev = cur; cur = next;
    }
    return pts;
  };
  const paths = [];
  const from = i => {
    const x = i % w, y = (i - x) / w;
    for (const [dx, dy] of N8) {
      if (!on(x + dx, y + dy)) continue;
      const q = (y + dy) * w + x + dx;
      if (!seen.has(pair(i, q))) paths.push(walk(i, q));
    }
  };
  for (let i = 0; i < sk.length; i++) if (sk[i] && isNode(i)) from(i);
  for (let i = 0; i < sk.length; i++) if (sk[i] && !isNode(i)) from(i);   // closed loops (an "o")
  const xy = i => { const x = i % w; return [x + 0.5, (i - x) / w + 0.5]; };
  // drop short spurs: a branch with a loose end that is shorter than `spur` pixels
  return paths
    .filter(p => !(p.length < spur && (degree[p[0]] === 1 || degree[p[p.length - 1]] === 1) && degree[p[0]] + degree[p[p.length - 1]] > 2))
    .map(p => p.map(xy))
    .filter(p => p.length > 1);
}

// ---------- all together ----------

// img: { gray: Uint8Array, w, h }. opts: { threshold (0-255, or null = automatic), mode }
export function traceImage(img, opts = {}) {
  const { gray, w, h } = img;
  const threshold = opts.threshold ?? otsu(gray);
  const bin = despeckle(binarize(gray, threshold), w, h, opts.minArea ?? Math.max(4, Math.round(w * h / 40000)));
  const raw = opts.mode === 'center' ? centerlines(bin, w, h) : outlines(bin, w, h);
  const strokes = raw.map(s => simplify(s, 0.6)).filter(s => s.length > 1);
  return { strokes, threshold, ink: bin.reduce((a, v) => a + v, 0) / bin.length };
}
