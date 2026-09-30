// Cartesian drawing -> polar G-code for a GRBL polar plotter.
//
// Platter frame: origin at the platter centre, x right, y up, millimetres.
// Machine axes:  X = carriage position along the rail, 0 = the point closest to the centre (mm).
//                Y = platter rotation in degrees (GRBL calls it mm; $101 must be steps per degree).
// The pen line may miss the centre by a signed gap `offset` (mm). With gap d the pen sits at
// (s, d) in the machine frame, so a platter point at radius r needs s = sqrt(r^2 - d^2) and
// rotation Y = theta - atan2(d, s). Points closer to the centre than |d| can't be reached.

export const DEFAULTS = {
  diameter: 180,   // drawing area, mm (paper is 200)
  size: 100,       // % of the drawing area
  offset: 0,       // pen-line gap from the centre, mm (signed)
  flip: false,     // platter turns the other way
  tol: 0.1,        // max distance between the drawn and intended line, mm
  speed: 600,      // pen speed on the paper, mm/min
  penUp: 2,        // Z when lifted
  penDown: 0,      // Z when drawing
};

const DEG = 180 / Math.PI;

// Degrees into (-180, 180].
export function wrap180(a) {
  a = ((a + 180) % 360 + 360) % 360 - 180;
  return a === -180 ? 180 : a;
}

// ---------- geometry helpers ----------

export function toMachine(p, o, prevY) {
  const d = o.offset;
  const r = Math.hypot(p[0], p[1]);
  const s = Math.sqrt(Math.max(0, r * r - d * d));
  let y = Math.atan2(p[1], p[0]) * DEG - Math.atan2(d, s) * DEG;
  if (o.flip) y = -y;
  if (prevY !== undefined) y = prevY + wrap180(y - prevY);
  return [s, y];
}

export function toPlatter(m, o) {
  const d = o.offset;
  const s = m[0];
  const y = o.flip ? -m[1] : m[1];
  const r = Math.hypot(s, d);
  const t = (y + Math.atan2(d, s) * DEG) / DEG;
  return [r * Math.cos(t), r * Math.sin(t)];
}

export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Ramer-Douglas-Peucker.
export function simplify(pts, eps) {
  if (pts.length < 3) return keepColor(pts.slice(), pts);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) {
      const dd = distToSegment(pts[k], pts[i], pts[j]);
      if (dd > best) { best = dd; bi = k; }
    }
    if (best > eps) { keep[bi] = 1; stack.push([i, bi], [bi, j]); }
  }
  return keepColor(pts.filter((_, k) => keep[k]), pts);
}

// ---------- preparing the drawing ----------

// Bounding box [x0, y0, x1, y1] of all points, or null when there are none.
export function bounds(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return isFinite(x0) ? [x0, y0, x1, y1] : null;
}

// How fitStrokes maps raw units to platter mm: p_mm = [(x - cx) * k, -(y - cy) * k].
export function fitFrame(strokes, o) {
  const b = bounds(strokes);
  if (!b) return null;
  // drawings made around a middle point (patterns, circle text) say so with strokes.center
  const [cx, cy] = strokes.center ?? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  let R = 0;
  for (const s of strokes) for (const [x, y] of s) R = Math.max(R, Math.hypot(x - cx, y - cy));
  return { cx, cy, k: R ? (o.diameter / 2) * (o.size / 100) / R : 1 };
}

// Centre the strokes on the platter, flip SVG's downward y, and scale to fit the drawing circle.
export function fitStrokes(strokes, o) {
  const f = fitFrame(strokes, o);
  if (!f) return [];
  const { cx, cy, k } = f;
  return strokes.map(s => keepColor(s.map(([x, y]) => [(x - cx) * k, -(y - cy) * k]), s));
}

// ---------- placement: crop, turn, move, and keep the pen on the paper ----------
// place = { turn (degrees, + = counter-clockwise on the preview), dx, dy (mm), crop ([u0,v0,u1,v1] in
// 0…1 of the raw drawing's bounding box, or null) }.

const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Keep the parts of each stroke inside a convex region. span(a, b) returns the visible [t0, t1]
// of segment a->b (0 ≤ t0 < t1 ≤ 1) or null. Strokes crossing the edge are split exactly on it.
function clipConvex(strokes, span) {
  const out = [];
  for (const s of strokes) {
    let cur = null;
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const v = span(a, b);
      if (!v) { if (cur) out.push(cur); cur = null; continue; }
      const [t0, t1] = v;
      if (t0 > 0 && cur) { out.push(cur); cur = null; }
      if (!cur) cur = keepColor([t0 > 0 ? lerp2(a, b, t0) : a], s);
      cur.push(t1 < 1 ? lerp2(a, b, t1) : b);
      if (t1 < 1) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
  }
  return out.filter(s => s.length > 1);
}

// Cut everything farther than R from the centre. Strokes already inside pass through untouched.
export function clipOuter(strokes, R) {
  const within = s => s.every(p => Math.hypot(p[0], p[1]) <= R + 1e-9);
  const span = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const A = dx * dx + dy * dy, B = 2 * (a[0] * dx + a[1] * dy), C = a[0] * a[0] + a[1] * a[1] - R * R;
    if (A === 0) return C <= 0 ? [0, 1] : null;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const q = Math.sqrt(disc);
    const t0 = Math.max(0, (-B - q) / (2 * A)), t1 = Math.min(1, (-B + q) / (2 * A));
    return t0 < t1 ? [t0, t1] : null;
  };
  const out = [];
  for (const s of strokes) {
    if (within(s)) out.push(s);
    else out.push(...clipConvex([s], span));
  }
  return out;
}

// Keep the parts of raw strokes inside the crop rectangle (normalized to their bounding box).
export function cropStrokes(strokes, crop) {
  const b = bounds(strokes);
  if (!b || !crop) return strokes;
  const w = b[2] - b[0], h = b[3] - b[1];
  const lo = [b[0] + crop[0] * w, b[1] + crop[1] * h], hi = [b[0] + crop[2] * w, b[1] + crop[3] * h];
  const e = 1e-9 * (Math.max(w, h) || 1);
  // Liang-Barsky
  const span = (a, c) => {
    let t0 = 0, t1 = 1;
    for (let ax = 0; ax < 2; ax++) {
      const d = c[ax] - a[ax];
      for (const [p, q] of [[-d, a[ax] - lo[ax]], [d, hi[ax] - a[ax]]]) {
        if (p === 0) { if (q < -e) return null; continue; }   // parallel: keep it if on or inside the edge
        const t = q / p;
        if (p < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
      }
    }
    return t0 < t1 ? [t0, t1] : null;
  };
  return clipConvex(strokes, span);
}

// Turn about the centre, move, then cut whatever left the drawing circle (radius R).
export function placeStrokes(strokes, place, R) {
  const a = (place.turn || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = place.dx || 0, dy = place.dy || 0;
  if (!a && !dx && !dy) return strokes;
  const moved = strokes.map(st => keepColor(st.map(([x, y]) => [x * c - y * s + dx, x * s + y * c + dy]), st));
  return clipOuter(moved, R);
}

// Cut out the parts of each stroke that are closer to the centre than `rMin` (unreachable).
export function clipInner(strokes, rMin) {
  if (rMin <= 0) return strokes.filter(s => s.length > 1);
  const out = [];
  const inside = p => Math.hypot(p[0], p[1]) < rMin;
  // Parameters t in (0,1) where segment a->b crosses the circle.
  const cross = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const A = dx * dx + dy * dy, B = 2 * (a[0] * dx + a[1] * dy), C = a[0] * a[0] + a[1] * a[1] - rMin * rMin;
    const disc = B * B - 4 * A * C;
    if (A === 0 || disc < 0) return [];
    const q = Math.sqrt(disc);
    return [(-B - q) / (2 * A), (-B + q) / (2 * A)].filter(t => t > 0 && t < 1);
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (const s of strokes) {
    const start = p => keepColor([p], s);
    let cur = inside(s[0]) ? null : start(s[0]);
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      for (const t of cross(a, b)) {
        const p = lerp(a, b, t);
        if (cur) { cur.push(p); if (cur.length > 1) out.push(cur); cur = null; }
        else cur = start(p);
      }
      if (cur) cur.push(b);
      if (inside(b) && cur) { if (cur.length > 1) out.push(cur); cur = null; }
    }
    if (cur && cur.length > 1) out.push(cur);
  }
  return out;
}

// Greedy nearest-neighbour order (strokes may be reversed) to cut pen-up travel.
// Strokes with a `.color` stay grouped by colour (one pen each), in order of first appearance.
export function orderStrokes(strokes) {
  const groups = new Map();
  for (const s of strokes) {
    if (!groups.has(s.color)) groups.set(s.color, []);
    groups.get(s.color).push(s);
  }
  const out = [];
  let at = [0, 0];
  for (const left of groups.values()) at = orderGroup(left, out, at);
  return out;
}
function orderGroup(left, out, at) {
  while (left.length) {
    let bi = 0, rev = false, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const s = left[i];
      const d0 = Math.hypot(s[0][0] - at[0], s[0][1] - at[1]);
      const d1 = Math.hypot(s[s.length - 1][0] - at[0], s[s.length - 1][1] - at[1]);
      if (d0 < bd) { bd = d0; bi = i; rev = false; }
      if (d1 < bd) { bd = d1; bi = i; rev = true; }
    }
    const s = left.splice(bi, 1)[0];
    const t = rev ? keepColor(s.slice().reverse(), s) : s;
    out.push(t);
    at = t[t.length - 1];
  }
  return at;
}

// Strokes are plain point arrays; an optional `.color` (#rrggbb, from the SVG) rides along.
function keepColor(to, from) {
  if (from.color !== undefined) to.color = from.color;
  return to;
}

// Everything the converter will actually try to draw, in platter mm.
// place (optional): crop, turn and move, see placeStrokes.
export function prepare(rawStrokes, opts, place) {
  const o = { ...DEFAULTS, ...opts };
  let strokes = fitStrokes(place?.crop ? cropStrokes(rawStrokes, place.crop) : rawStrokes, o);
  if (place) strokes = placeStrokes(strokes, place, o.diameter / 2);
  strokes = strokes.map(s => simplify(s, o.tol / 5));
  strokes = clipInner(strokes, Math.abs(o.offset) + 1e-6);
  return orderStrokes(strokes);
}

// ---------- conversion ----------

const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);

// GRBL moves in a straight line in (X, Y) machine space; that is a curve on the paper.
// Split each paper segment until the machine's path stays within `tol` of it.
function emitSegment(a, b, ma, o, out, depth) {
  const mb = toMachine(b, o, ma[1]);
  let err = 0;
  for (const t of [0.25, 0.5, 0.75]) {
    const q = toPlatter([ma[0] + (mb[0] - ma[0]) * t, ma[1] + (mb[1] - ma[1]) * t], o);
    err = Math.max(err, distToSegment(q, a, b));
  }
  if (err > o.tol * 0.5 && depth < 22) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const mm = emitSegment(a, m, ma, o, out, depth + 1);
    return emitSegment(m, b, mm, o, out, depth + 1);
  }
  out.push({ m: mb, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  return mb;
}

// strokes: output of prepare(). Returns { gcode, stats }.
// More than one stroke colour: each colour group starts with a `; pen <n>: #rrggbb` comment, and
// from pen 2 on an M0 (GRBL program pause, pen already up) so the pen can be swapped; `~` resumes.
export function toGcode(strokes, opts) {
  const o = { ...DEFAULTS, ...opts };
  const L = [];
  L.push('; Polar plot from polar-cnc-plotter');
  L.push(`; X = carriage mm (0 = closest to centre), Y = platter degrees. Gap ${o.offset} mm${o.flip ? ', reversed rotation' : ''}`);
  L.push('; Before plotting: pen just touching the paper at the centre point, then G92 X0 Y0 Z0');
  L.push('G21 G90 G93');
  L.push(`G0 Z${f3(o.penUp)}`);
  let y = 0, drawMM = 0, travelMM = 0, at = [0, 0], moves = 0;
  const pens = new Set(strokes.map(s => s.color)).size;
  let pen = 0, color;
  for (const s of strokes) {
    if (pens > 1 && (pen === 0 || s.color !== color)) {
      color = s.color;
      L.push(`; pen ${++pen}: ${color || '#000000'}`);
      if (pen > 1) L.push('M0');
    }
    const m0 = toMachine(s[0], o, y);
    travelMM += Math.hypot(s[0][0] - at[0], s[0][1] - at[1]);
    L.push(`G0 X${f3(m0[0])} Y${f3(m0[1])}`);
    L.push(`G0 Z${f3(o.penDown)}`);
    let m = m0;
    for (let i = 1; i < s.length; i++) {
      const seg = [];
      m = emitSegment(s[i - 1], s[i], m, o, seg, 0);
      for (const { m: mm, len } of seg) {
        const F = o.speed / Math.max(len, 1e-3);   // G93: F = 1 / minutes for this move
        L.push(`G1 X${f3(mm[0])} Y${f3(mm[1])} F${F.toFixed(1)}`);
        drawMM += len; moves++;
      }
    }
    L.push(`G0 Z${f3(o.penUp)}`);
    y = m[1];
    at = s[s.length - 1];
  }
  L.push('G94');
  L.push('M2');
  return { gcode: L.join('\n') + '\n', stats: { strokes: strokes.length, pens: Math.max(1, pen), moves, lines: L.length, drawMM, travelMM, minutes: drawMM / o.speed } };
}

export function convert(rawStrokes, opts) {
  return toGcode(prepare(rawStrokes, opts), opts);
}

// ---------- simulation (preview and tests) ----------

// Reads polar G-code and returns what the pen does on the paper, sampling each move the way GRBL
// executes it (straight in machine X/Y). Returns { down: [[pts]], up: [[pts]] } in platter mm.
// Each down[i] also has `.lines`: lines[j] = index (into gcodeLines(), i.e. the lines as streamed)
// of the move that reaches point j (point 0 shares its move's index), so ink can be split into
// drawn / not yet drawn; and `.color` when a `; pen <n>: #rrggbb` comment precedes it. M0 is a no-op.
export function simulate(gcode, opts, step = 0.5) {
  const o = { ...DEFAULTS, ...opts };
  const zMid = (o.penUp + o.penDown) / 2;
  const penIsDown = z => (o.penDown < o.penUp ? z <= zMid : z >= zMid);
  let x = 0, y = 0, z = o.penUp, abs = true;
  const down = [], up = [];
  let cur = null, ln = -1, color;
  for (const raw of gcode.split('\n')) {
    const pen = /^\s*;\s*pen \d+:\s*(#[0-9a-f]{6})/i.exec(raw);
    if (pen) color = pen[1].toLowerCase();
    const line = raw.replace(/;.*|\(.*?\)/g, '').toUpperCase();
    if (!line.trim()) continue;
    ln++;
    if (/G91(?!\d)/.test(line)) abs = false;
    if (/G90(?!\d)/.test(line)) abs = true;
    const w = {};
    for (const [, k, v] of line.matchAll(/([XYZ])\s*(-?[\d.]+)/g)) w[k] = +v;
    if (w.X === undefined && w.Y === undefined && w.Z === undefined) continue;
    const nx = w.X === undefined ? x : abs ? w.X : x + w.X;
    const ny = w.Y === undefined ? y : abs ? w.Y : y + w.Y;
    const nz = w.Z === undefined ? z : abs ? w.Z : z + w.Z;
    const wasDown = penIsDown(z);
    if (nx !== x || ny !== y) {
      // samples no more than `step` mm apart on the paper
      const rMax = Math.hypot(Math.max(Math.abs(x), Math.abs(nx)), o.offset);
      const n = Math.min(20000, Math.max(1, Math.ceil(Math.max(Math.abs(ny - y) / DEG * rMax, Math.abs(nx - x)) / step)));
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(toPlatter([x + (nx - x) * i / n, y + (ny - y) * i / n], o));
      if (wasDown) {
        if (!cur) { cur = [pts[0]]; cur.lines = [ln]; if (color) cur.color = color; down.push(cur); }
        for (let i = 1; i < pts.length; i++) { cur.push(pts[i]); cur.lines.push(ln); }
      } else {
        up.push(pts);
      }
    }
    x = nx; y = ny; z = nz;
    if (!penIsDown(z)) cur = null;
  }
  return { down, up };
}

// Largest distance from any drawn point to the intended strokes (both in platter mm).
export function maxDeviation(drawn, target, cell = 2) {
  const grid = new Map();
  const key = (i, j) => i + ',' + j;
  for (const s of target) for (let k = 1; k < s.length; k++) {
    const a = s[k - 1], b = s[k];
    const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell);
    const j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const kk = key(i, j);
      if (!grid.has(kk)) grid.set(kk, []);
      grid.get(kk).push([a, b]);
    }
  }
  let worst = 0, worstAt = null;
  for (const s of drawn) for (const p of s) {
    const i = Math.floor(p[0] / cell), j = Math.floor(p[1] / cell);
    let best = Infinity;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      for (const [a, b] of grid.get(key(i + di, j + dj)) || []) best = Math.min(best, distToSegment(p, a, b));
    }
    if (best === Infinity) best = cell; // nothing nearby: at least one cell away
    if (best > worst) { worst = best; worstAt = p; }
  }
  return { worst, worstAt };
}

// ---------- machine test patterns (Phase 0) ----------

export function testCircle(opts, r = 30) {
  const pts = [];
  for (let i = 0; i <= 360; i += 2) pts.push([r * Math.cos(i / DEG), r * Math.sin(i / DEG)]);
  return pts;
}

export function testSpoke(opts, r = 60) {
  return [[Math.abs((opts && opts.offset) || 0) + 1, 0], [r, 0]];
}

// Converts already-placed strokes (platter mm) without fitting them.
export function placedToGcode(strokes, opts) {
  const o = { ...DEFAULTS, ...opts };
  return toGcode(clipInner(strokes, Math.abs(o.offset) + 1e-6), o);
}
