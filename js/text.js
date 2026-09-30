// Text tool: typed text -> pen strokes in a single-stroke Hershey font, so every letter is drawn once.
// Layouts: 'lines' (centred lines, stacked downward) or 'circle' (each line runs around a ring,
// like a coin rim, first line outermost). Output is in font units, y DOWN, like SVG.
import { FONTS } from './fonts.js';

export const CAP = 662;           // capital height in font units
export const LINE = 1100;         // distance between lines (and between rings)
const STEP = 60;                  // on the circle, straight glyph lines are split this fine so they bend

// Phone keyboards type curly quotes and dashes; the fonts only have the plain ones.
const SUBST = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ', '\t': ' ' };
const clean = s => [...s].map(c => SUBST[c] ?? c).join('');

// One line of text -> { strokes: [[x, y]…] in font units (y up, baseline 0, starts at x 0), width }.
// Characters the font doesn't have are skipped.
export function layoutLine(line, font = 'sans') {
  const glyphs = (FONTS[font] || FONTS.sans).glyphs;
  const strokes = [];
  let x = 0;
  for (const c of clean(line)) {
    const g = glyphs[c];
    if (!g) continue;
    for (let i = 1; i < g.length; i++) {
      const s = g[i], pts = [];
      for (let k = 0; k < s.length; k += 2) pts.push([x + s[k], s[k + 1]]);
      strokes.push(pts);
    }
    x += g[0];
  }
  return { strokes, width: x };
}

// Splits segments longer than `step` so a bent line stays smooth.
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

// Ring radius for each line in circle layout: line 0 outermost, each next line one LINE further in,
// every ring big enough that its text fits around it (with a small gap), and never tighter than 2 lines.
export function ringRadii(widths) {
  const need = widths.map((w, i) => Math.max(2 * LINE, w / (2 * Math.PI * 0.94)) + i * LINE);
  const R0 = Math.max(...need);
  return widths.map((_, i) => R0 - i * LINE);
}

export function textStrokes(text, { font = 'sans', layout = 'lines' } = {}) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n').map(l => layoutLine(l, font));
  const out = [];
  if (layout === 'circle') {
    const R = ringRadii(lines.map(l => l.width));
    lines.forEach((l, i) => {
      // centred on the top of the ring, reading clockwise, letter tops pointing outward
      const start = Math.PI / 2 + l.width / 2 / R[i];
      for (const s of l.strokes) {
        out.push(densify(s, STEP).map(([x, y]) => {
          const t = start - x / R[i], r = R[i] + y;
          return [r * Math.cos(t), -r * Math.sin(t)];
        }));
      }
    });
    out.center = [0, 0];   // the ring's middle goes on the platter's middle (see patterns.js)
  } else {
    lines.forEach((l, i) => {
      for (const s of l.strokes) out.push(s.map(([x, y]) => [x - l.width / 2, i * LINE - y]));
    });
  }
  return out;
}

// ---------- tool panel ----------
export function initText(api) {
  const $ = id => document.getElementById(id);
  const tool = import('./tool.js');   // browser-only (touches document), so not a top-level import: tests load this file in node
  const box = $('textInput');
  const state = { font: 'sans', layout: 'lines' };
  let t = 0;
  const update = (delay = 100) => {
    clearTimeout(t);
    // no letters -> no drawing (null keeps the "nothing to draw" error away)
    t = setTimeout(() => { const s = textStrokes(box.value, state); api.setDrawing(s.length ? s : null, 'Text'); }, delay);
  };
  for (const [seg, key] of [['textFont', 'font'], ['textLayout', 'layout']]) {
    $(seg).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state[key] = b.dataset.v;
      for (const x of $(seg).children) x.classList.toggle('on', x === b);
      update(0);
    });
  }
  box.addEventListener('input', () => update());
  $('openText').addEventListener('click', async () => { (await tool).openTool('textTool'); update(0); });
}
