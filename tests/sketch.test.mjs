// Draw tool (js/sketch.js): what you draw on the paper is what gets plotted. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, toGcode, simulate, distToSegment, DEFAULTS } from '../js/polar.js';
import { addPoint, finishStroke, bake, tagged, makeSketch } from '../js/sketch.js';

const O = { ...DEFAULTS, tol: 0 };   // tol 0: simplify keeps every point, so points can be compared 1:1
const ID = { turn: 0, dx: 0, dy: 0, crop: null };
const near = (p, q, e = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1]) < e;
// What the tool hands the app for finger paths given in paper mm (y up).
const drawn = (paths, o = O) => tagged(paths.map(p => finishStroke(p, o)));
const same = (got, want, e = 1e-9) => {
  assert.equal(got.length, want.length);
  const g = near(got[0], want[0], e) ? got : got.slice().reverse();   // the pen may run a stroke backwards
  g.forEach((p, i) => assert.ok(near(p, want[i], e), `point ${i}: got (${p}), drawn at (${want[i]})`));
};

const LINE = [[10, 20], [30, 5]];           // short, off-centre, far from filling the circle
const L = [[10, 20], [30, 20], [30, -5]];
const offPath = (p, path) => Math.min(...path.slice(1).map((b, i) => distToSegment(p, path[i], b)));

test('a line is plotted where it was drawn, not stretched to fill the circle', () => {
  for (const size of [100, 60]) {
    const o = { ...O, size };
    const out = prepare(drawn([LINE], o), o, ID);
    assert.equal(out.length, 1);
    same(out[0], LINE);
  }
});

test('the pen path in the G-code stays on the drawn shape', () => {
  const sim = simulate(toGcode(prepare(drawn([L], DEFAULTS), DEFAULTS, ID), DEFAULTS).gcode, DEFAULTS, 0.4);
  assert.equal(sim.down.length, 1);
  for (const p of sim.down[0]) assert.ok(offPath(p, L) < 0.5, `pen at (${p}) is ${offPath(p, L).toFixed(3)} mm off the drawn line`);
  for (const p of L) assert.ok(offPath(p, sim.down[0]) < 0.5, `the corner at (${p}) was cut by ${offPath(p, sim.down[0]).toFixed(3)} mm`);
});

test('the Size slider scales a finished drawing about the platter centre', () => {
  const out = prepare(drawn([LINE], O), { ...O, size: 50 }, ID);
  same(out[0], LINE.map(([x, y]) => [x / 2, y / 2]));
});

// A pointer can report whole screen pixels. On a 393 px phone the paper is drawn at 1.845 px per mm,
// so a slanted line can arrive as 0.54 mm stair-steps.
// The steps are small (0.14 mm off the true line), but each one is two sharp turns for the motors.
// Smoothing must at least halve the turning, without moving the line further off or the ends at all.
const turning = s => {
  let t = 0;
  for (let i = 2; i < s.length; i++) {
    let d = Math.abs(Math.atan2(s[i][1] - s[i - 1][1], s[i][0] - s[i - 1][0]) - Math.atan2(s[i - 1][1] - s[i - 2][1], s[i - 1][0] - s[i - 2][0]));
    t += d > Math.PI ? 2 * Math.PI - d : d;
  }
  return t * 180 / Math.PI;
};
test('pixel stair-steps are smoothed before the pen has to draw them', () => {
  const px = 1 / 1.845, stairs = [];
  for (let i = 0; i <= 60; i++) addPoint(stairs, [(10 + Math.round(i * 1.7)) * px, (5 + Math.round(i * 1.0)) * px], 0.3);
  const start = stairs[0], end = stairs[stairs.length - 1], off = p => distToSegment(p, start, end);
  const out = prepare(drawn([stairs]), O, ID)[0];
  assert.ok(turning(stairs) > 500, `the test path should be jagged (${turning(stairs).toFixed(0)}° of turning)`);
  assert.ok(turning(out) < turning(stairs) / 2, `still ${turning(out).toFixed(0)}° of turning (was ${turning(stairs).toFixed(0)}°)`);
  assert.ok(Math.max(...out.map(off)) <= Math.max(...stairs.map(off)), 'smoothing must not move the line further off');
  assert.ok(near(out[0], start, 1e-9) && near(out[out.length - 1], end, 1e-9), 'the ends stay where they were drawn');
});

test('smoothing keeps a sharp corner within the width of the pen line', () => {
  const out = prepare(drawn([[[0, 20], [10, 20], [10, 30]]]), O, ID)[0];
  const cut = Math.min(...out.map(p => Math.hypot(p[0] - 10, p[1] - 20)));
  assert.ok(cut < 0.3, `corner cut by ${cut.toFixed(3)} mm`);
});

test('a line drawn past the drawing circle is cut at its edge', () => {
  const out = prepare(drawn([[[80, 0], [120, 0]]]), O, ID);   // circle radius 90
  assert.equal(out.length, 1);
  same(out[0], [[80, 0], [90, 0]], 1e-6);
  assert.equal(finishStroke([[95, 0], [120, 0]], O), null, 'nothing inside the circle: no stroke');
});

test('a tap makes a pen dab', () => {
  const s = finishStroke([[5, 5]], O);
  assert.equal(s.length, 2);
  const out = prepare(tagged([s]), DEFAULTS, ID);
  assert.equal(out.length, 1);
  assert.equal(toGcode(out, DEFAULTS).stats.strokes, 1);
  assert.ok(Math.hypot(out[0][0][0] - 5, out[0][0][1] - 5) < 0.3);
});

test('finger points closer than the step are dropped', () => {
  const pts = [];
  assert.equal(addPoint(pts, [0, 0]), true);
  assert.equal(addPoint(pts, [0.1, 0]), false);
  assert.equal(addPoint(pts, [0.29, 0]), false);
  assert.equal(addPoint(pts, [0.31, 0]), true);
  assert.deepEqual(pts, [[0, 0], [0.31, 0]]);
});

test('drawing again after a turn, a move or a crop starts from where the drawing sits', () => {
  const raw = drawn([L, [[-40, -10], [-20, -30]]]);
  for (const place of [{ ...ID, turn: 90, dx: 12, dy: -7 }, { ...ID, crop: [0, 0, 0.6, 1] }, { ...ID, crop: [0.2, 0, 1, 1], turn: -30, dx: 5 }]) {
    for (const size of [100, 70]) {
      const o = { ...O, size };
      const want = prepare(raw, o, place), got = prepare(bake(raw, o, place), o, ID);
      assert.equal(got.length, want.length);
      got.forEach((s, i) => same(s, want[i], 1e-9));
    }
  }
});

test('undo steps back one stroke at a time, and brings back a cleared drawing', () => {
  const k = makeSketch();
  assert.equal(k.canUndo(), false);
  k.add('a'); k.add('b');
  k.undo();
  assert.deepEqual(k.strokes, ['a']);
  k.add('c'); k.clear();
  assert.deepEqual(k.strokes, []);
  assert.equal(k.canUndo(), true);
  k.undo();
  assert.deepEqual(k.strokes, ['a', 'c']);
  // a drawing reloaded from the browser has no history: undo still removes its last stroke
  const old = makeSketch(['x', 'y']);
  old.undo();
  assert.deepEqual(old.strokes, ['x']);
});
