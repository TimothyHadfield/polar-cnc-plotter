// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wrap180, toMachine, toPlatter, prepare, toGcode, simulate, maxDeviation, DEFAULTS } from '../js/polar.js';
import { flattenPath } from '../js/pathflat.js';
import { grblPlotterPolar } from './grblplotter-port.mjs';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const circle = (r, cx = 0, cy = 0, n = 180) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)]);

const SHAPES = {
  'square': [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]],
  'spoke through the centre': [[[-30, 0.3], [30, 0.3]], [[0, 40], [0, 41]]],
  'two concentric circles': [circle(20), circle(35)],
  'hello-world.svg': fixture('hello-world'),
  'uvu-logo.svg': fixture('uvu-logo'),
};

// Draw it the way GRBL would and measure how far the pen strays from the intended lines, and
// whether every intended line got drawn.
function check(raw, opts) {
  const o = { ...DEFAULTS, ...opts };
  const target = prepare(raw, o);
  const { gcode } = toGcode(target, o);
  const drawn = simulate(gcode, o, 0.05).down;
  return { stray: maxDeviation(drawn, target, 1).worst, missed: maxDeviation(target, drawn, 1).worst, gcode };
}

test('wrap180 keeps angles in (-180, 180]', () => {
  assert.equal(wrap180(190), -170);
  assert.equal(wrap180(-190), 170);
  assert.equal(wrap180(180), 180);
  assert.equal(wrap180(-180), 180);
  assert.equal(wrap180(720 + 5), 5);
});

test('machine <-> platter round trip, with pen-line gap and reversed rotation', () => {
  for (const o of [{ offset: 0, flip: false }, { offset: 3.5, flip: false }, { offset: -2, flip: true }]) {
    for (let i = 0; i < 200; i++) {
      const p = [Math.sin(i * 12.9898) * 80, Math.cos(i * 78.233) * 80];
      if (Math.hypot(...p) < Math.abs(o.offset) + 0.01) continue;
      const q = toPlatter(toMachine(p, o), o);
      assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9, `${p} -> ${q}`);
    }
  }
});

test('angle takes the short way round between neighbouring points', () => {
  const o = { offset: 0, flip: false };
  const a = toMachine([10, 0.01], o);          // just above the +x axis
  const b = toMachine([10, -0.01], o, a[1]);   // just below it
  assert.ok(Math.abs(b[1] - a[1]) < 1, `jumped ${b[1] - a[1]} degrees`);
});

for (const [name, raw] of Object.entries(SHAPES)) {
  for (const opts of [{}, { offset: 3 }, { offset: -2.5, flip: true }]) {
    test(`${name} ${JSON.stringify(opts)}: pen stays within 0.1 mm and draws everything`, () => {
      const r = check(raw, opts);
      assert.ok(r.stray <= 0.1 + 0.01, `pen strayed ${r.stray.toFixed(3)} mm from the drawing`);
      assert.ok(r.missed <= 0.1 + 0.01, `part of the drawing was missed by ${r.missed.toFixed(3)} mm`);
    });
  }
}

test('GRBL-Plotter\'s converter fails the same check (its angle-wrap bug)', () => {
  for (const name of ['square', 'hello-world.svg']) {
    const target = prepare(SHAPES[name], DEFAULTS);
    const drawn = simulate(grblPlotterPolar(target), DEFAULTS, 0.05).down;
    const stray = maxDeviation(drawn, target, 1).worst;
    assert.ok(stray > 1, `${name}: expected stray rings, pen strayed only ${stray.toFixed(3)} mm`);
  }
});

test('G-code: header, a feed on every G1 (inverse time), footer', () => {
  const { gcode } = check(SHAPES.square, {});
  const lines = gcode.trim().split('\n').filter(l => !l.startsWith(';'));
  assert.equal(lines[0], 'G21 G90 G93');
  assert.ok(lines.filter(l => l.startsWith('G1')).every(l => / F\d/.test(l)));
  assert.deepEqual(lines.slice(-2), ['G94', 'M2']);
  assert.ok(lines.every(l => l.length < 70), 'GRBL lines must stay short');
});

test('points inside the pen-line gap are skipped, not drawn', () => {
  const o = { ...DEFAULTS, offset: 5 };
  const target = prepare(SHAPES['spoke through the centre'], o);
  for (const s of target) for (const p of s) assert.ok(Math.hypot(...p) >= 5 - 1e-6);
});

// ---------- SVG path flattening ----------

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('path: absolute and relative lines, H/V, Z closes', () => {
  const [p] = flattenPath('M10 10 h10 v10 H10 z');
  assert.deepEqual(p, [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]);
  const [q] = flattenPath('m1,1 2,0 0,2');  // implicit relative line-tos after m
  assert.deepEqual(q, [[1, 1], [3, 1], [3, 3]]);
});

test('path: each m starts a new stroke, relative to where the last one ended', () => {
  const s = flattenPath('M0 0 L5 0 z m10 0 l1 0 M50 50 l0 1');
  assert.equal(s.length, 3);
  assert.deepEqual(s[1], [[10, 0], [11, 0]]);
  assert.deepEqual(s[2], [[50, 50], [50, 51]]);
});

test('path: arcs, including flags written without spaces', () => {
  for (const d of ['M0 0 A10 10 0 0 1 20 0', 'M0 0 a10 10 0 0120 0', 'M0,0a10,10,0,0,1,20,0']) {
    const [p] = flattenPath(d, 0.01);
    const end = p[p.length - 1];
    assert.ok(near(end[0], 20) && near(end[1], 0), d);
    for (const [x, y] of p) assert.ok(Math.abs(Math.hypot(x - 10, y) - 10) < 0.02, `${d}: point off the circle`);
    assert.ok(p.some(([, y]) => y < -9.9), `${d}: sweep flag 1 should bulge to -y`);
  }
});

test('path: cubic and smooth cubic stay on the curve ends; quadratic + T', () => {
  const [c] = flattenPath('M0 0 C0 10 10 10 10 0 S20 -10 20 0', 0.01);
  assert.deepEqual(c[c.length - 1], [20, 0]);
  assert.ok(c.some(([, y]) => y < -7), 'S should reflect the control point below');
  const [q] = flattenPath('M0 0 Q5 10 10 0 T20 0', 0.01);
  assert.deepEqual(q[q.length - 1], [20, 0]);
  assert.ok(q.some(([, y]) => y < -4.9), 'T should reflect the control point below');
});

test('path: numbers packed together (1.5.5 and 1e2) read right', () => {
  const [p] = flattenPath('M0 0L1.5.5L1e1-2');
  assert.deepEqual(p, [[0, 0], [1.5, 0.5], [10, -2]]);
});
