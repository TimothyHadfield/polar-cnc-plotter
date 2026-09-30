// Move, Turn, Crop (js/place.js + placement in polar.js prepare). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare, fitStrokes, toGcode, simulate, maxDeviation, clipOuter, cropStrokes, fitFrame, DEFAULTS } from '../js/polar.js';
import { cropFromBox } from '../js/place.js';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const HELLO = fixture('hello-world'), UVU = fixture('uvu-logo');
const O = { ...DEFAULTS, tol: 0 };   // tol 0: simplify keeps every point, so points can be compared 1:1
const ID = { turn: 0, dx: 0, dy: 0, crop: null };
const close = (p, q, e = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) < e;
const allPts = ss => ss.flat();

test('identity placement gives exactly today\'s prepare output', () => {
  for (const raw of [HELLO, UVU]) for (const o of [DEFAULTS, { ...DEFAULTS, offset: 3, size: 60 }]) {
    assert.deepEqual(prepare(raw, o, ID), prepare(raw, o));
  }
});

// Sign convention: turn > 0 is counter-clockwise on the preview (platter frame, y up).
test('turn 90 is counter-clockwise: (x, y) -> (-y, x)', () => {
  const raw = [[[0, 5], [10, 5], [10, 0]]];              // an L: bbox centre (5, 2.5)
  const fit = fitStrokes(raw, O);
  const p = fit[0][1];                                   // the corner: right and below centre (y is flipped)
  assert.ok(p[0] > 1 && p[1] < -1);
  const turned = allPts(prepare(raw, O, { ...ID, turn: 90 }));
  assert.equal(turned.length, 3);
  for (const [x, y] of fit[0]) assert.ok(turned.some(q => close(q, [-y, x])), `(${x}, ${y}) should turn to (${-y}, ${x})`);
});

test('dx/dy shift every point by exactly dx, dy', () => {
  const o = { ...O, size: 50 };                        // small enough that nothing leaves the circle
  const a = prepare(HELLO, o, ID), b = prepare(HELLO, o, { ...ID, dx: 12.5, dy: -7 });
  const A = allPts(a), B = allPts(b);
  assert.equal(A.length, B.length);
  // ordering may change with the shift, so match as sets
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  const want = new Set(A.map(p => key([p[0] + 12.5, p[1] - 7])));
  for (const q of B) assert.ok(want.has(key(q)), `unexpected point ${q}`);
});

test('outer clip: moved half off the circle, nothing beyond the edge, split exactly on it', () => {
  const R = O.diameter / 2;
  const out = prepare(HELLO, O, { ...ID, dx: R });
  for (const p of allPts(out)) assert.ok(Math.hypot(...p) <= R + 1e-9, `point ${p} is off the paper`);
  const onEdge = out.flatMap(s => [s[0], s[s.length - 1]]).filter(p => Math.abs(Math.hypot(...p) - R) < 1e-9);
  assert.ok(onEdge.length >= 4, `expected cut ends on the circle, got ${onEdge.length}`);
  // a single long line crossing the whole circle becomes exactly the chord
  const [chord] = clipOuter([[[-200, 30], [200, 30]]], R);
  const h = Math.sqrt(R * R - 30 * 30);
  assert.ok(close(chord[0], [-h, 30]) && close(chord[1], [h, 30]));
});

test('crop keeps only points inside and splits crossing strokes at the rect edge', () => {
  const raw = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], [[0, 50], [100, 50]]];  // square + middle bar
  const out = cropStrokes(raw, [0.25, 0.25, 0.75, 1]);  // x 25…75, y 25…100
  for (const [x, y] of allPts(out)) assert.ok(x >= 25 - 1e-9 && x <= 75 + 1e-9 && y >= 25 - 1e-9 && y <= 100 + 1e-9);
  // top edge (y=0) is gone; bottom edge (y=100) cut to 25…75; bar cut to 25…75
  assert.ok(!allPts(out).some(p => p[1] < 25 - 1e-9));
  const bar = out.find(s => s.every(p => p[1] === 50));
  assert.deepEqual(bar, [[25, 50], [75, 50]]);
  assert.ok(out.some(s => close(s[0], [75, 100]) || close(s[s.length - 1], [75, 100])), 'bottom edge split at x=75');
  assert.ok(out.some(s => close(s[0], [25, 100]) || close(s[s.length - 1], [25, 100])), 'bottom edge split at x=25');
});

test('crop then fit: the cropped part fills the drawing circle', () => {
  const crop = [0, 0, 0.4, 0.6];
  for (const size of [100, 70]) {
    const o = { ...O, size };
    const pts = allPts(prepare(UVU, o, { ...ID, crop }));
    const Rmax = Math.max(...pts.map(p => Math.hypot(...p)));
    assert.ok(Math.abs(Rmax - o.diameter / 2 * size / 100) < 1e-6, `reaches ${Rmax}`);
  }
});

test('cropFromBox undoes move, turn and fit (screen box -> raw crop)', () => {
  const place = { turn: 30, dx: 10, dy: -5, crop: [0.1, 0, 1, 0.9] };
  // a tiny box around where raw point P lands on the paper must crop around P
  const raw = UVU;
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of raw.flat()) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  const P = [b[0] + 0.5 * (b[2] - b[0]), b[1] + 0.4 * (b[3] - b[1])];
  const f = fitFrame(cropStrokes(raw, place.crop), O);        // forward: where P is drawn on the paper
  const q = [(P[0] - f.cx) * f.k, -(P[1] - f.cy) * f.k];
  const a = place.turn * Math.PI / 180;
  const at = [q[0] * Math.cos(a) - q[1] * Math.sin(a) + place.dx, q[0] * Math.sin(a) + q[1] * Math.cos(a) + place.dy];
  assert.ok(Math.hypot(...at) < O.diameter / 2);
  const e = 0.01;
  const crop = cropFromBox(raw, place, O, [[at[0] - e, at[1] - e], [at[0] + e, at[1] - e], [at[0] + e, at[1] + e], [at[0] - e, at[1] + e]]);
  assert.ok(crop, 'crop box should not be empty');
  assert.ok(Math.abs((crop[0] + crop[2]) / 2 - 0.5) < 1e-3 && Math.abs((crop[1] + crop[3]) / 2 - 0.4) < 1e-3, `crop ${crop} not centred on P`);
  assert.ok(crop[2] - crop[0] < 0.01, 'crop should be small');
});

test('moved + turned + cropped drawing: pen stays within 0.1 mm and draws everything', () => {
  for (const [raw, opts] of [[HELLO, {}], [UVU, { offset: 3 }], [UVU, { offset: -2.5, flip: true }]]) {
    const o = { ...DEFAULTS, ...opts };
    const place = { turn: 37, dx: 25, dy: -18, crop: [0.1, 0.05, 0.8, 0.9] };
    const target = prepare(raw, o, place);
    assert.ok(target.length > 0);
    for (const p of allPts(target)) assert.ok(Math.hypot(...p) <= o.diameter / 2 + 1e-9);
    const { gcode } = toGcode(target, o);
    const drawn = simulate(gcode, o, 0.05).down;
    const stray = maxDeviation(drawn, target, 1).worst, missed = maxDeviation(target, drawn, 1).worst;
    assert.ok(stray <= 0.11, `pen strayed ${stray.toFixed(3)} mm`);
    assert.ok(missed <= 0.11, `missed ${missed.toFixed(3)} mm`);
  }
});
