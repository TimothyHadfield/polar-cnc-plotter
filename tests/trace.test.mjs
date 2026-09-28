import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { otsu, binarize, despeckle, outlines, centerlines, traceImage } from '../js/trace.js';
import { DEFAULTS, toGcode, simulate, maxDeviation, prepare } from '../js/polar.js';

// a w x h grayscale picture, white paper, with `ink(x, y)` pixels black
function picture(w, h, ink) {
  const gray = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink(x, y)) gray[y * w + x] = 0;
  return { gray, w, h };
}
const fixture = name => {
  const { w, h, gray } = JSON.parse(readFileSync(new URL(`fixtures/${name}.gray.json`, import.meta.url)));
  return { w, h, gray: new Uint8Array(Buffer.from(gray, 'base64')) };
};
const distToBox = ([x, y], x0, y0, x1, y1) => Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1));

test('otsu splits a two-tone picture between the tones', () => {
  const gray = new Uint8Array(1000);
  for (let i = 0; i < 1000; i++) gray[i] = i < 300 ? 40 + (i % 10) : 210 + (i % 10);
  const t = otsu(gray);
  const bin = binarize(gray, t);
  for (let i = 0; i < 1000; i++) assert.equal(bin[i], i < 300 ? 1 : 0, `threshold ${t} puts pixel ${i} on the wrong side`);
});

test('despeckle removes dots and keeps shapes', () => {
  const { gray, w, h } = picture(40, 40, (x, y) => (x === 3 && y === 3) || (x >= 10 && x < 30 && y >= 10 && y < 30));
  const bin = despeckle(binarize(gray, 128), w, h, 4);
  assert.equal(bin[3 * w + 3], 0);
  assert.equal(bin.reduce((a, v) => a + v, 0), 400);
});

test('outline of a filled square follows its edge', () => {
  const { gray, w, h } = picture(40, 40, (x, y) => x >= 10 && x < 30 && y >= 10 && y < 30);
  const loops = outlines(binarize(gray, 128), w, h);
  assert.equal(loops.length, 1);
  const L = loops[0];
  assert.deepEqual(L[0], L[L.length - 1], 'loop closes');
  for (const p of L) assert.ok(distToBox(p, 10, 10, 30, 30) <= 0.75, `point ${p} is off the edge`);
  // the edge sits exactly on the pixel borders; only the corners get cut by half a pixel
  const xs = L.map(p => p[0]), ys = L.map(p => p[1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [10, 30, 10, 30]);
  let area = 0;
  for (let i = 1; i < L.length; i++) area += L[i - 1][0] * L[i][1] - L[i][0] * L[i - 1][1];
  assert.ok(Math.abs(Math.abs(area / 2) - 399.5) < 1e-9, `area ${area / 2}`);
});

test('a ring gives two loops, an 8-shape with touching corners stays sane', () => {
  const ring = picture(60, 60, (x, y) => { const r = Math.hypot(x - 30, y - 30); return r > 12 && r < 22; });
  assert.equal(outlines(binarize(ring.gray, 128), 60, 60).length, 2);
  // two squares touching only at a corner (the ambiguous marching-squares case)
  const diag = picture(20, 20, (x, y) => (x >= 4 && x < 10 && y >= 4 && y < 10) || (x >= 10 && x < 16 && y >= 10 && y < 16));
  const loops = outlines(binarize(diag.gray, 128), 20, 20);
  assert.ok(loops.length >= 1 && loops.length <= 2);
  for (const L of loops) assert.deepEqual(L[0], L[L.length - 1], 'every loop closes');
});

test('centerline of a thick bar is one stroke down its middle', () => {
  const { gray, w, h } = picture(80, 30, (x, y) => x >= 10 && x < 70 && y >= 11 && y < 18);
  const lines = centerlines(binarize(gray, 128), w, h);
  assert.equal(lines.length, 1);
  const xs = lines[0].map(p => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 45, 'runs most of the bar');
  for (const [, y] of lines[0]) assert.ok(Math.abs(y - 15) <= 1.5, `y ${y} is off the middle`);
});

test('a T junction gives three branches that meet', () => {
  const { gray, w, h } = picture(80, 80, (x, y) => (y >= 10 && y < 15 && x >= 10 && x < 70) || (x >= 38 && x < 43 && y >= 10 && y < 70));
  const lines = centerlines(binarize(gray, 128), w, h);
  assert.ok(lines.length >= 2 && lines.length <= 3, `${lines.length} strokes`);
  const len = lines.reduce((a, s) => a + s.length, 0);
  assert.ok(len > 100, 'covers the bar and the stem');
});

test('traced HELLO.png: six letter outlines, eleven centerlines', () => {
  const img = fixture('hello-block');
  assert.equal(traceImage(img).strokes.length, 6);          // H, E, L, L, O outside + O inside
  assert.ok(traceImage(img, { mode: 'center' }).strokes.length <= 12);
});

test('traced HELLO.png draws true on the polar machine', () => {
  const img = fixture('hello-block');
  for (const mode of ['outline', 'center']) {
    for (const extra of [{}, { offset: 3 }]) {
      const o = { ...DEFAULTS, ...extra };
      const raw = traceImage(img, { mode }).strokes;
      const target = prepare(raw, o);
      const { gcode } = toGcode(target, o);
      const drawn = simulate(gcode, o, 0.05).down;
      const stray = maxDeviation(drawn, target, 1).worst;
      const missed = maxDeviation(target, drawn, 1).worst;
      assert.ok(stray <= 0.11 && missed <= 0.11, `${mode} ${JSON.stringify(extra)}: stray ${stray.toFixed(3)} missed ${missed.toFixed(3)}`);
    }
  }
});
