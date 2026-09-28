// SVG text -> list of strokes (arrays of [x, y] points in the SVG's root units).
// Paths are flattened by js/pathflat.js (fast); other shapes and all transforms use the browser.
import { flattenPath } from './pathflat.js';

const SHAPES = 'path,line,polyline,polygon,rect,circle,ellipse';

export function svgToStrokes(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Not a readable SVG file');
  }
  const svg = document.importNode(doc.documentElement, true);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none';
  svg.setAttribute('width', '1000');
  svg.setAttribute('height', '1000');
  host.appendChild(svg);
  document.body.appendChild(host);
  try {
    const els = [...svg.querySelectorAll(SHAPES)]
      .filter(e => !e.closest('defs,clipPath,mask,pattern,symbol,marker') && getComputedStyle(e).display !== 'none');
    const vb = svg.viewBox.baseVal;
    const diag = vb && vb.width ? Math.hypot(vb.width, vb.height) : 1414;
    const tol = diag / 10000;                  // about 0.02 mm on a 150 mm page
    const toRoot = svg.getScreenCTM().inverse();
    const strokes = [];
    for (const el of els) {
      const m = toRoot.multiply(el.getScreenCTM());
      const tf = ([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      if (el.nodeName.toLowerCase() === 'path') {
        for (const s of flattenPath(el.getAttribute('d') || '', tol / Math.max(1e-9, Math.hypot(m.a, m.b)))) strokes.push(s.map(tf));
        continue;
      }
      let len;
      try { len = el.getTotalLength(); } catch { continue; }
      if (!(len > 0)) continue;
      const n = Math.min(20000, Math.ceil(len / (tol * 5)));
      const cur = [];
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength(len * i / n);
        cur.push(tf([p.x, p.y]));
      }
      strokes.push(cur);
    }
    return strokes.filter(s => s.length > 1);
  } finally {
    host.remove();
  }
}
