// Pattern tool: math curves, no picture needed. Each pattern returns strokes ([[x, y]…], y DOWN like
// SVG) centred on (0, 0) and about 100 units in radius; prepare() in polar.js scales them to fit.

const TAU = 2 * Math.PI;
export const TOL = 0.01;   // max chord error, units (= 0.005 % of the ~200 unit drawing)

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Points along f(t), t0..t1: start with n0 even steps, then halve any step whose chord misses the
// curve by more than tol (checked at the quarter points), so tight bends get more points.
export function sampleCurve(f, t0, t1, n0 = 64, tol = TOL) {
  const pts = [f(t0)];
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
  };
  const seg = (ta, a, tb, b, depth) => {
    const q = [0.25, 0.5, 0.75].map(u => f(ta + (tb - ta) * u));
    if (depth < 18 && Math.max(...q.map(p => dist(p, a, b))) > tol) {
      const tm = (ta + tb) / 2;
      seg(ta, a, tm, q[1], depth + 1);
      seg(tm, q[1], tb, b, depth + 1);
    } else pts.push(b);
  };
  let a = pts[0];
  for (let i = 1; i <= n0; i++) {
    const ta = t0 + (t1 - t0) * (i - 1) / n0, tb = t0 + (t1 - t0) * i / n0;
    const b = f(tb);
    seg(ta, a, tb, b, 0);
    a = b;
  }
  return pts;
}

const yDown = s => s.map(([x, y]) => [x, -y]);

// Archimedean spiral r = aθ; several arms are the same spiral turned evenly around.
function spiral({ turns, arms }) {
  const out = [];
  for (let j = 0; j < arms; j++) {
    const phase = TAU * j / arms;
    out.push(sampleCurve(t => {
      const r = 100 * t / (TAU * turns);
      return [r * Math.cos(t + phase), r * Math.sin(t + phase)];
    }, 0, TAU * turns, Math.ceil(16 * turns)));
  }
  return out.map(yDown);
}

// Rose r = cos(kθ), k = petals/layers. With k = n/d in lowest terms the curve closes after dπ when
// n·d is odd (n petals), otherwise after 2dπ (2n petals).
export function roseRange(petals, layers) {
  const g = gcd(petals, layers), n = petals / g, d = layers / g;
  return { k: n / d, end: (n * d) % 2 ? d * Math.PI : 2 * d * Math.PI };
}
function rose({ petals, layers }) {
  const { k, end } = roseRange(petals, layers);
  const s = sampleCurve(t => { const r = 100 * Math.cos(k * t); return [r * Math.cos(t), r * Math.sin(t)]; }, 0, end, Math.ceil(64 * end / Math.PI));
  return [yDown(s)];
}

// Hypotrochoid: a wheel of radius r rolls inside a ring of radius R, pen at distance p from its
// centre. r/R = w/n in lowest terms gives n loops and closes after the wheel turns w times.
export function spiroRatio(loops, shape) {
  const want = Math.min(loops - 1, Math.max(1, Math.round(loops * shape / 10)));
  // nearest w to `want` that shares no factor with `loops` (so it really has `loops` loops)
  for (let dw = 0; dw < loops; dw++) for (const w of [want - dw, want + dw]) {
    if (w >= 1 && w < loops && gcd(loops, w) === 1) return w;
  }
  return 1;
}
function spirograph({ loops, shape, pen }) {
  const w = spiroRatio(loops, shape);
  const R = 1, r = w / loops, p = r * pen / 100, q = (R - r) / r;
  const k = 100 / ((R - r) + p);
  const s = sampleCurve(t => [k * ((R - r) * Math.cos(t) + p * Math.cos(q * t)), k * ((R - r) * Math.sin(t) - p * Math.sin(q * t))],
    0, TAU * w, 48 * w * Math.max(4, loops / w));
  return [yDown(s)];
}

// Concentric rings with a sine wobble; each ring's wobble is turned a little from the last.
function waves({ rings, wobble, bumps }) {
  const gap = 100 / (rings + 1), A = gap * wobble / 100;
  const out = [];
  for (let i = 0; i < rings; i++) {
    const rho = gap * (i + 1), ph = i * 0.35;
    const s = sampleCurve(t => { const r = rho + A * Math.sin(bumps * t + ph); return [r * Math.cos(t), r * Math.sin(t)]; }, 0, TAU, 8 * bumps + 32);
    s[s.length - 1] = s[0].slice();   // closes exactly
    out.push(s);
  }
  return out.map(yDown);
}

export const PATTERNS = {
  spiral: { label: 'Spiral', make: spiral, sliders: [
    { key: 'turns', label: 'Turns', min: 2, max: 30, value: 12 },
    { key: 'arms', label: 'Arms', min: 1, max: 4, value: 1 },
  ] },
  rose: { label: 'Rose', make: rose, sliders: [
    { key: 'petals', label: 'Petals', min: 1, max: 12, value: 5 },
    { key: 'layers', label: 'Layers', min: 1, max: 7, value: 1 },
  ] },
  spirograph: { label: 'Spirograph', make: spirograph, sliders: [
    { key: 'loops', label: 'Loops', min: 3, max: 30, value: 7 },
    { key: 'shape', label: 'Shape', min: 1, max: 9, value: 3 },
    { key: 'pen', label: 'Pen', min: 10, max: 150, value: 80, unit: '%' },
  ] },
  waves: { label: 'Waves', make: waves, sliders: [
    { key: 'rings', label: 'Rings', min: 3, max: 40, value: 14 },
    { key: 'wobble', label: 'Wobble', min: 0, max: 100, value: 60, unit: '%' },
    { key: 'bumps', label: 'Bumps', min: 2, max: 24, value: 8 },
  ] },
};

export function defaults(type) {
  return Object.fromEntries(PATTERNS[type].sliders.map(s => [s.key, s.value]));
}

// `center` tells the fitter to put (0, 0) on the platter centre instead of centring the bounding
// box (a 5-petal rose or a spiral is lopsided, but its middle belongs on the platter's middle).
export function patternStrokes(type, params = {}) {
  const P = PATTERNS[type];
  const out = P.make({ ...defaults(type), ...params });
  out.center = [0, 0];
  return out;
}

// ---------- tool panel ----------
export function initPatterns(api) {
  const $ = id => document.getElementById(id);
  const tool = import('./tool.js');   // browser-only, so not a top-level import (tests load this file in node)
  const box = $('patternSliders');
  let type = 'spiral';
  const values = Object.fromEntries(Object.keys(PATTERNS).map(k => [k, defaults(k)]));  // kept per type
  let t = 0;
  const update = (delay = 100) => {
    clearTimeout(t);
    t = setTimeout(() => api.setDrawing(patternStrokes(type, values[type]), 'Pattern'), delay);
  };
  function sliders() {
    box.replaceChildren(...PATTERNS[type].sliders.map(s => {
      const label = document.createElement('label');
      label.className = 'slider';
      const head = document.createElement('span'), out = document.createElement('b'), input = document.createElement('input');
      const show = () => { out.textContent = values[type][s.key] + (s.unit || ''); };
      head.append(s.label, out);
      Object.assign(input, { type: 'range', min: s.min, max: s.max, step: 1, value: values[type][s.key] });
      input.addEventListener('input', () => { values[type][s.key] = +input.value; show(); update(); });
      show();
      label.append(head, input);
      return label;
    }));
  }
  $('patternType').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    type = b.dataset.v;
    for (const x of $('patternType').children) x.classList.toggle('on', x === b);
    sliders();
    update(0);
  });
  sliders();
  $('openPattern').addEventListener('click', async () => { (await tool).openTool('patternTool'); update(0); });
}
