// Centre gap auto-dodge (polar.js dodgeGap + place.scale). Run: node --test tests/*.test.mjs
// Tim 11-16: "try to manuvure the drawing in such a way that the circle in the middle doesn't
// interfere with the drawing, besides shifting it slightly off-center."
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dodgeGap, placeStrokes, clipInner, layout, prepare, DEFAULTS } from '../js/polar.js';
import { cropFromBox } from '../js/place.js';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const HELLO = fixture('hello-world'), UVU = fixture('uvu-logo');
const len = ss => ss.reduce((t, s) => t + s.slice(1).reduce((u, p, i) => u + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0), 0);
const maxR = ss => Math.max(...ss.flat().map(([x, y]) => Math.hypot(x, y)));
const circle = (r, n = 90) => [Array.from({ length: n + 1 }, (_, i) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n)])];

test('a line through the centre slides just past the gap, and no ink is cut', () => {
  const line = [[[0, -40], [0, 40]]];
  const dg = dodgeGap(line, 3, 100);
  assert.ok(dg, 'should move');
  assert.ok(dg.moved >= 3.5 && dg.moved < 4.5, `moved ${dg.moved}`);   // smallest move: gap 3 + 0.5 margin
  assert.equal(dg.scale, 1);
  const placed = placeStrokes(line, dg, 100);
  assert.ok(Math.abs(len(clipInner(placed, 3)) - len(placed)) < 1e-9, 'clipInner must cut nothing');
  // and without the move the gap would have eaten 6 mm of the line
  assert.ok(len(line) - len(clipInner(line, 3)) > 5.9);
});

test('a drawing that already fills the circle shrinks a little instead of falling off the edge', () => {
  const R = 50, art = [[[0, -50], [0, 50]], [[-50, 0.01], [-49, 0.01]]];
  const dg = dodgeGap(art, 3, R);
  assert.ok(dg && dg.scale < 1 && dg.scale >= 0.85, JSON.stringify(dg));
  const placed = placeStrokes(art, dg, R);
  assert.ok(maxR(placed) <= R + 1e-9);
  assert.ok(Math.abs(len(clipInner(placed, 3)) - len(placed)) < 1e-9);
  assert.ok(Math.abs(len(placed) - len(art) * dg.scale) < 1e-6, 'nothing clipped at the edge either');
});

test('no move when the gap is 0, already blank, or there is no blank spot near', () => {
  const line = [[[0, -40], [0, 40]]];
  assert.equal(dodgeGap(line, 0, 100), null);
  assert.equal(dodgeGap(circle(20), 3, 100), null);                       // empty middle
  const dense = Array.from({ length: 81 }, (_, i) => [[i - 40, -40], [i - 40, 40]]);   // hatching 1 mm apart
  assert.equal(dodgeGap(dense, 3, 100), null);
});

test('negative gap (pen on the other side) dodges the same', () => {
  const dg = dodgeGap([[[0, -40], [0, 40]]], -2, 100);
  assert.ok(dg && dg.moved >= 2.5 && dg.moved < 3.5);
});

test('real sample drawings: after the dodge the centre gap cuts no ink', () => {
  for (const raw of [HELLO, UVU]) for (const offset of [1.5, 3, 5]) {
    const o = { ...DEFAULTS, offset };
    const base = layout(raw, o, { turn: 0, crop: null });
    const dg = dodgeGap(base, offset, o.diameter / 2);
    if (!dg) continue;   // dense middle: left alone
    const placed = layout(raw, o, { turn: 0, crop: null, ...dg });
    assert.ok(Math.abs(len(clipInner(placed, offset)) - len(placed)) < 1e-6, `offset ${offset}`);
    assert.ok(maxR(placed) <= o.diameter / 2 + 1e-9);
    assert.ok(prepare(raw, o, { turn: 0, crop: null, ...dg }).length > 0);
  }
});

test('Crop box maths undoes the shrink', () => {
  const raw = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]];
  const o = { ...DEFAULTS };
  const place = { turn: 0, dx: 4, dy: 0, crop: null, scale: 0.9 };
  const placed = layout(raw, o, place);
  const xs = placed.flat().map(p => p[0]), ys = placed.flat().map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), xm = (x0 + x1) / 2;
  // a box over the left half of the drawing as it shows on screen -> the left half of the raw drawing
  const crop = cropFromBox(raw, place, o, [[x0 - 1, y0 - 1], [xm, y0 - 1], [xm, y1 + 1], [x0 - 1, y1 + 1]]);
  assert.ok(crop && Math.abs(crop[2] - 0.5) < 1e-6, JSON.stringify(crop));
});
