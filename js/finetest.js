// Fine test (Tim: "a fining test, which has the plotter draw in a specific way that really tests the
// plotter's capabilities and fine-tuning at specific distances from the center, which will also help
// us know if we really need a gear reduction or not").
//
// Rings at 10, 30, 50, 70, 90 mm from the center (only those that fit the drawing circle, plus one
// near its edge). Every ring gets the same small pieces, laid out along it by arc length (mm), so the
// rings can be compared side by side:
//   arc            12 mm along the ring
//   square         FINE_SQUARE mm, sides along the radius and along the ring
//   comb (circle)  short radial lines, spaced along the ring: only the platter sets the spacing
//   comb (radius)  short arcs, spaced along the radius: only the carriage sets the spacing
//   label          the ring's radius in mm (Hershey sans)
// Each comb has 3 lines per spacing in COMB_GAPS (mm between line centres).
// One platter step moves the pen r·π/180 / $101 mm (it grows with r); a carriage step is 1 / $100
// mm everywhere. So combs that blur on the outer rings but not the inner say the platter is the limit.
//
// Output: strokes in mm, y DOWN like SVG, centred on (0, 0), with .radius = maxR so they land in true
// mm at Size 100 % when maxR is half the drawing width.
import { sampleCurve } from './patterns.js';
import { layoutLine, CAP } from './text.js';

export const FINE_RINGS = [10, 30, 50, 70, 90];
export const COMB_GAPS = [2, 1, 0.5, 0.25];
export const FINE_SQUARE = 5;
export const TYPICAL = { 100: 40, 101: 4.444 };   // belt carriage; 200-step platter motor at 1/8, direct drive
const LINE = 4;          // comb line length, mm
const SEP = 1.5;         // space between one spacing's lines and the next's, mm
const LABEL = 3;         // label capital height, mm
const BAND = 6.5;        // how far a ring's pieces reach in or out from its radius, mm
const AT = { arc: [0, 12], square: 17.5, alongCircle: 23, alongRadius: 40, label: 45 };   // arc length, mm

// Offsets of the comb's lines from its first line, mm: [0, 2, 4, 5.5, 6.5, 7.5, 9, 9.5, 10, ...].
function combOffsets() {
  const out = [];
  let at = 0;
  for (const g of COMB_GAPS) {
    for (let k = 0; k < 3; k++) out.push(at + k * g);
    at += 2 * g + SEP;
  }
  return out;
}

// The rings that fit inside maxR, plus one as far out as fits when the last one is well short of it.
export function fineRadii(maxR) {
  const out = FINE_RINGS.filter(r => r + BAND <= maxR);
  const edge = Math.floor(maxR - BAND);
  if (out.length && edge >= out[out.length - 1] + 2 * BAND) out.push(edge);
  return out;
}

// [{ r, platter, carriage }]: mm the pen moves for one step of each motor, at radius r.
export function stepSizes(radii, s101, s100) {
  return radii.map(r => ({ r, platter: r * Math.PI / 180 / s101, carriage: 1 / s100 }));
}

function ring(r) {
  const P = (rho, t) => [rho * Math.cos(t), rho * Math.sin(t)];   // y up here
  const arc = sampleCurve(t => P(r, t), AT.arc[0] / r, AT.arc[1] / r, 16);
  // square: centre on the ring, n = outward, u = along the ring (counter-clockwise)
  const tc = AT.square / r, n = [Math.cos(tc), Math.sin(tc)], u = [-n[1], n[0]], h = FINE_SQUARE / 2;
  const c = P(r, tc);
  const corner = (a, b) => [c[0] + a * h * n[0] + b * h * u[0], c[1] + a * h * n[1] + b * h * u[1]];
  const square = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];
  const offs = combOffsets();
  const alongCircle = offs.map(o => { const t = (AT.alongCircle + o) / r; return [P(r - LINE / 2, t), P(r + LINE / 2, t)]; });
  const mid = offs[offs.length - 1] / 2, tr = AT.alongRadius / r;
  const alongRadius = offs.map(o => {
    const rho = r - mid + o, half = LINE / 2 / rho;
    return sampleCurve(t => P(rho, t), tr - half, tr + half, 8);
  });
  // label: reads clockwise with its top outward (like the Text tool's circle), centred on the ring
  const { strokes, width } = layoutLine(String(r), 'sans');
  const k = LABEL / CAP, t0 = (AT.label + width * k) / r;
  const label = strokes.map(s => s.map(([x, y]) => P(r - LABEL / 2 + y * k, t0 - x * k / r)));
  return { r, arc, square, alongCircle, alongRadius, label };
}

const yDown = s => s.map(([x, y]) => [x, -y]);

export function fineStrokes(maxR) {
  const radii = fineRadii(maxR);
  const out = [];
  out.rings = radii.map(r => {
    const g = ring(r);
    const d = { r, arc: yDown(g.arc), square: yDown(g.square), alongCircle: g.alongCircle.map(yDown), alongRadius: g.alongRadius.map(yDown), label: g.label.map(yDown) };
    out.push(d.arc, d.square, ...d.alongCircle, ...d.alongRadius, ...d.label);
    return d;
  });
  out.radii = radii;
  out.center = [0, 0];
  out.radius = maxR;
  return out;
}

// "10 mm 0.039 · 30 mm 0.118 · …"
export const stepText = steps => steps.map(s => `${s.r} mm ${s.platter.toFixed(3)}`).join(' · ');

// ---------- panel: the Fine test link and its ? (both pages have them; null-checked anyway) ----------
export function initFine(api) {
  const $ = id => document.getElementById(id);
  const show = async () => {
    const s = api.getSettings();
    const { loadDefaults } = await import('./defaults.js');
    const g = loadDefaults()?.grbl || {};
    const s101 = g[101] > 0 ? g[101] : TYPICAL[101], s100 = g[100] > 0 ? g[100] : TYPICAL[100];
    const steps = stepSizes(fineRadii(s.diameter / 2), s101, s100);
    if ($('fineSteps')) $('fineSteps').textContent = stepText(steps);
    if ($('fineCarriage')) $('fineCarriage').textContent = (1 / s100).toFixed(3);
    if ($('fineFrom')) $('fineFrom').textContent = `$101 ${+s101.toFixed(3)}, $100 ${+s100.toFixed(3)}`;
  };
  $('fineDraw')?.addEventListener('click', () => { api.setDrawing(fineStrokes(api.getSettings().diameter / 2), 'Fine test'); show(); });
  document.querySelector('[data-q="fineHelp"]')?.addEventListener('click', show);
}
