// Simulate (js/handoff.js): the drawing that reaches the simulator is the one that was on screen.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare, toGcode, DEFAULTS } from '../js/polar.js';
import { pack, unpack } from '../js/handoff.js';
import { finishStroke, tagged } from '../js/sketch.js';
import { textStrokes } from '../js/text.js';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const ID = { turn: 0, dx: 0, dy: 0, crop: null };
const samePlot = (a, b, e = 1e-3) => {
  assert.equal(a.length, b.length, 'same number of strokes');
  a.forEach((s, i) => {
    assert.equal(s.length, b[i].length, `stroke ${i}: same number of points`);
    assert.equal(s.color, b[i].color, `stroke ${i}: same pen`);
    s.forEach((p, j) => assert.ok(Math.hypot(p[0] - b[i][j][0], p[1] - b[i][j][1]) < e, `stroke ${i} point ${j} moved`));
  });
};

test('a drawing made with the Draw tool arrives where it was drawn, moved and turned the same', () => {
  const raw = tagged([[[10, 20], [30, 5]], [[-40, -10], [-20, -30], [-25, 12]]].map(p => finishStroke(p, DEFAULTS)));
  for (const place of [ID, { turn: 35, dx: 12, dy: -7, crop: null }]) {
    const got = unpack(pack(raw, 'Drawing', place));
    assert.equal(got.name, 'Drawing');
    assert.deepEqual(got.place, place);
    assert.equal(got.strokes.radius, 1, 'still at its drawn scale, not stretched to fill the circle');
    samePlot(prepare(got.strokes, DEFAULTS, got.place), prepare(raw, DEFAULTS, place));
  }
});

test('an opened drawing, cropped and at another size, plots the same after the trip', () => {
  const raw = fixture('uvu-logo'), o = { ...DEFAULTS, size: 70 };
  const place = { turn: -20, dx: 3, dy: 4, crop: [0.1, 0, 0.9, 0.8] };
  const got = unpack(pack(raw, 'uvu-logo.svg', place));
  assert.equal(got.name, 'uvu-logo.svg');
  samePlot(prepare(got.strokes, o, got.place), prepare(raw, o, place));
  assert.equal(toGcode(prepare(got.strokes, o, got.place), o).stats.strokes, toGcode(prepare(raw, o, place), o).stats.strokes);
});

test('pen colours and a pattern\'s middle point survive', () => {
  const raw = textStrokes('Hi', { layout: 'circle' });   // has .center
  raw[0].color = '#ff0000'; raw[1].color = '#0000ff';
  const got = unpack(pack(raw, 'Text', ID));
  assert.deepEqual(got.strokes.center, [0, 0]);
  assert.equal(got.strokes[0].color, '#ff0000');
  assert.equal(got.strokes[1].color, '#0000ff');
  assert.equal(got.strokes[2]?.color, raw[2]?.color);
  samePlot(prepare(got.strokes, DEFAULTS, got.place), prepare(raw, DEFAULTS, ID));
});

test('a broken or half-written package is refused, not half-loaded', () => {
  assert.throws(() => unpack('{"strokes":'));
  assert.throws(() => unpack('{"name":"x"}'));
});
