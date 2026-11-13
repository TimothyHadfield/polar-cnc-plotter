// Draw tool: draw on the paper with a finger or the mouse, and that is the drawing.
// Strokes are kept in "paper units": (0, 0) is the platter centre, 1 is the edge of the drawing
// circle at Size 100%, y DOWN like SVG. strokes.center and strokes.radius tell polar.js fitFrame
// to keep that scale instead of stretching the drawing to fill the circle, so a line is plotted
// exactly where it was drawn.
import { DEFAULTS, layout, simplify } from './polar.js';

const STEP = 0.3;   // mm: finger points closer together than this are dropped
const DOT = 0.2;    // mm: a tap becomes a pen dab this long
const KEY = 'polar-plotter-sketch';

export const mmPerUnit = o => (o.diameter / 2) * (o.size / 100);
export function tagged(strokes) { strokes.center = [0, 0]; strokes.radius = 1; return strokes; }

// Add a paper-mm point to the stroke being drawn. False when it is too close to the last one.
export function addPoint(pts, p, step = STEP) {
  const q = pts[pts.length - 1];
  if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < step) return false;
  pts.push(p);
  return true;
}

// Take the screen-pixel stair-steps and finger jitter out of a path (paper mm): points every
// FINE mm, then two passes of a 1-2-1 average. That blurs about half a millimetre, the width of
// the pen line, so corners stay corners. The two ends don't move.
const FINE = 0.5;
export function smooth(pts) {
  if (pts.length < 3) return pts;
  let s = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / FINE));
    for (let j = 1; j <= n; j++) s.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  for (let pass = 0; pass < 2; pass++) {
    s = s.map((p, i) => i === 0 || i === s.length - 1 ? p
      : [(s[i - 1][0] + 2 * p[0] + s[i + 1][0]) / 4, (s[i - 1][1] + 2 * p[1] + s[i + 1][1]) / 4]);
  }
  return simplify(s, 0.02);   // drop the extra points on straight runs
}

// A finished finger path (paper mm, y up) -> a stroke in paper units, or null when none of it is
// inside the drawing circle. A single point (a tap) becomes a short dab.
export function finishStroke(pts, opts) {
  const o = { ...DEFAULTS, ...opts }, R = o.diameter / 2, k = mmPerUnit(o);
  if (!pts.length || !pts.some(p => Math.hypot(p[0], p[1]) <= R)) return null;
  const mm = pts.length > 1 ? smooth(pts) : [pts[0], [pts[0][0] + DOT, pts[0][1]]];
  return mm.map(([x, y]) => [x / k, -y / k]);
}

// The drawing as it sits after Turn, move and Crop, back in paper units, to draw on again.
export function bake(raw, opts, place) {
  const o = { ...DEFAULTS, ...opts }, k = mmPerUnit(o);
  return tagged(layout(raw, o, place).map(s => s.map(([x, y]) => [x / k, -y / k])));
}

// The strokes plus what Undo goes back to. Clear can be undone too.
export function makeSketch(strokes = []) {
  let cur = strokes;
  const past = [];
  return {
    get strokes() { return cur; },
    add(s) { past.push(cur); cur = [...cur, s]; },
    clear() { if (cur.length) { past.push(cur); cur = []; } },
    undo() { if (past.length) cur = past.pop(); else cur = cur.slice(0, -1); },
    canUndo: () => past.length > 0 || cur.length > 0,
    reset(s) { cur = s; past.length = 0; },
  };
}

// ---------- tool panel ----------
// Kept in this browser, so a reloaded tab (iPhone does that on its own) doesn't lose the drawing.
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '[]');
    return s.filter(st => Array.isArray(st) && st.length > 1 && st.every(p => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1])));
  } catch { return []; }
}
function store(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s, (_, v) => typeof v === 'number' ? +v.toFixed(4) : v)); } catch {}
}

export function initSketch(api) {
  const $ = id => document.getElementById(id);
  if (!$('openDraw') || !$('drawTool')) return;   // a page without the tool's markup
  const tool = import('./tool.js');   // browser-only, so not a top-level import (tests load this file in node)
  const canvas = api.canvas, stage = $('stage');
  const sketch = makeSketch(load());
  let mine = null;    // the strokes last handed to the app: tells whether they are still the drawing
  let live = null;    // { id, pts }: the stroke under the finger, paper mm
  let shown = null;   // a just-finished stroke, kept on screen until the preview has redrawn with it
  let frame = 0;

  function show() {
    const s = sketch.strokes;
    mine = s.length ? tagged(s.slice()) : null;
    api.setDrawing(mine, 'Drawing');
    $('drawUndo').disabled = !sketch.canUndo();
    $('drawClear').disabled = !s.length;
    store(s);
  }

  $('openDraw').addEventListener('click', async () => {
    // A drawn drawing is on screen (only this tool makes strokes with a radius), but it was turned,
    // moved or cropped since, or it came over from the other page: carry on from where it sits now.
    const raw = api.getRaw(), p = api.getPlace();
    if (raw?.radius && (raw !== mine || p.turn || p.dx || p.dy || p.crop)) sketch.reset(bake(raw, api.getSettings(), p));
    (await tool).openTool('drawTool', () => {
      api.sketching = false; live = shown = null;
      stage.classList.remove('sketching');
      api.draw();
    });
    api.sketching = true;
    stage.classList.add('sketching');
    show();
  });
  $('drawUndo').addEventListener('click', () => { sketch.undo(); show(); });
  $('drawClear').addEventListener('click', () => { sketch.clear(); show(); });
  document.addEventListener('keydown', e => {
    if (api.sketching && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); sketch.undo(); show(); }
  });

  // screen position -> paper mm, using the scale draw() last used
  const at = e => {
    const r = canvas.getBoundingClientRect(), v = api.view;
    return [(e.clientX - r.left - v.cx) / v.k, (v.cy - (e.clientY - r.top)) / v.k];
  };
  canvas.addEventListener('pointerdown', e => {
    if (!api.sketching || live || e.button > 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    live = { id: e.pointerId, pts: [at(e)] };
    api.draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!live || e.pointerId !== live.id) return;
    const all = e.getCoalescedEvents?.();   // every point of a fast stroke, not one per frame
    let grew = false;
    for (const c of all?.length ? all : [e]) grew = addPoint(live.pts, at(c)) || grew;
    if (grew && !frame) frame = requestAnimationFrame(() => { frame = 0; api.draw(); });
  });
  function end(e) {
    if (!live || e.pointerId !== live.id) return;
    const pts = live.pts;
    live = null;
    const s = e.type === 'pointerup' ? finishStroke(pts, api.getSettings()) : null;
    if (!s) return api.draw();
    shown = pts;
    sketch.add(s);
    show();                                   // queues the rebuild…
    setTimeout(() => { shown = null; }, 0);   // …and this runs right after it
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // the stroke under the finger, in the pen's colour, cut at the drawing circle like the plot will be
  api.addOverlay(({ ctx, X, Y, k, cx, cy, color }) => {
    const pts = live?.pts || shown;
    if (!pts) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, api.getSettings().diameter / 2 * k, 0, 2 * Math.PI); ctx.clip();
    ctx.strokeStyle = color('--pen'); ctx.lineWidth = Math.max(1, 0.5 * k); ctx.lineJoin = ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p)));
    if (pts.length === 1) ctx.lineTo(X(pts[0]) + 0.01, Y(pts[0]));
    ctx.stroke();
    ctx.restore();
  });
}
