import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spiral, hatch } from '../js/styles.js';
import { DEFAULTS, toGcode, simulate, maxDeviation, prepare } from '../js/polar.js';

// a w x h grayscale picture, white paper, pixels where `tone(x, y)` gives a number get that gray
function picture(w, h, tone) {
  const gray = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = tone(x, y); if (v !== undefined) gray[y * w + x] = v; }
  return { gray, w, h };
}
const fixture = name => {
  const { w, h, gray } = JSON.parse(readFileSync(new URL(`fixtures/${name}.gray.json`, import.meta.url)));
  return { w, h, gray: new Uint8Array(Buffer.from(gray, 'base64')) };
};
const O = { threshold: 128, gap: 1.2, diameter: DEFAULTS.diameter, size: 100 };
const W = 300, H = 200;
const gapPx = o => o.gap * (Math.hypot(W, H) / 2) / (o.diameter / 2 * o.size / 100);

// How far each spiral point sits from the ideal Archimedean spiral r = b * (turned angle + c),
// measured along the ray. The constant c is found from a plain (white) spiral of the same size.
function spiralDeviation(stroke, o, c0) {
  const g = gapPx(o), b = g / (2 * Math.PI), cx = W / 2, cy = H / 2, Rs = Math.hypot(W, H) / 2;
  let turned = 0, prev = null;
  const out = [];
  for (const [x, y] of stroke) {
    const r = Math.hypot(x - cx, y - cy);
    if (r < 1e-9) continue;
    const a = Math.atan2(y - cy, x - cx);
    if (prev !== null) { let d = a - prev; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); turned += d; }
    prev = a;
    out.push({ r, dev: r - Math.min(Rs, b * turned), turned });
  }
  if (c0 === undefined) {                               // align to this stroke itself
    const mid = out.filter(p => p.r > 2 * g && p.r < Rs - 2 * g);
    c0 = mid.reduce((a, p) => a + p.dev, 0) / mid.length;
  }
  return { c0, points: out.filter(p => p.r > g && b * p.turned + c0 < Rs - g).map(p => ({ ...p, dev: p.dev - c0 })) };
}

test('white picture: hatch draws nothing, spiral has no wiggle', () => {
  const white = picture(W, H, () => undefined);
  assert.equal(hatch(white, O).strokes.length, 0);
  const s = spiral(white, O);
  assert.equal(s.strokes.length, 1, 'one continuous stroke');
  const { points } = spiralDeviation(s.strokes[0], O);
  assert.ok(points.length > 50);
  const worst = Math.max(...points.map(p => Math.abs(p.dev)));
  assert.ok(worst <= 0.05 * gapPx(O), `wiggle ${worst.toFixed(3)} px on a white picture`);
});

test('spiral wiggles on black, never more than half a gap', () => {
  const white = spiral(picture(W, H, () => undefined), O);
  const black = spiral(picture(W, H, () => 0), O);
  const { c0 } = spiralDeviation(white.strokes[0], O);
  const { points } = spiralDeviation(black.strokes[0], O, c0);
  const worst = Math.max(...points.map(p => Math.abs(p.dev)));
  assert.ok(worst <= 0.5 * gapPx(O), `amplitude ${(worst / gapPx(O)).toFixed(2)} gap`);
  assert.ok(worst >= 0.4 * gapPx(O), `black should wiggle hard, got ${(worst / gapPx(O)).toFixed(2)} gap`);
});

test('hatch stays inside a black square, darker adds directions', () => {
  const inSq = (x, y) => x >= 100 && x < 180 && y >= 60 && y < 140;
  const dirs = strokes => new Set(strokes.map(([a, b]) => Math.round(((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) + 360) % 180)));
  const black = hatch(picture(W, H, (x, y) => (inSq(x, y) ? 0 : undefined)), O);
  assert.ok(black.strokes.length > 5);
  for (const s of black.strokes) for (const [x, y] of s) {
    assert.ok(x >= 99 && x <= 181 && y >= 59 && y <= 141, `point ${x.toFixed(1)},${y.toFixed(1)} is outside the square`);
  }
  assert.deepEqual([...dirs(black.strokes)].sort((a, b) => a - b), [0, 45, 135]);
  const mid = hatch(picture(W, H, (x, y) => (inSq(x, y) ? 70 : undefined)), O);        // between 1/3 and 2/3
  assert.deepEqual([...dirs(mid.strokes)].sort((a, b) => a - b), [45, 135]);
  const light = hatch(picture(W, H, (x, y) => (inSq(x, y) ? 110 : undefined)), O);    // just below white point
  assert.deepEqual([...dirs(light.strokes)], [45]);
});

test('on paper: hatch lines and spiral rings are `gap` mm apart', () => {
  for (const extra of [{}, { gap: 2.5, size: 60 }]) {
    const o = { ...O, ...extra };
    const opts = { ...DEFAULTS, diameter: o.diameter, size: o.size };
    // hatch: distance between neighbouring parallel lines, measured across them
    // (a disc's hatch reaches less far than its bounding box does, so the spacing must adapt)
    const sq = picture(W, H, (x, y) => (x >= 60 && x < 240 && y >= 40 && y < 170 ? 0 : undefined));
    const disc = picture(W, H, (x, y) => (Math.hypot(x - 150, y - 100) < 60 ? 0 : undefined));
    for (const pic of [sq, disc]) for (const angle of [45, 135, 0]) {
      const lines = prepare(hatch(pic, o).strokes, opts);
      const set = lines.filter(([a, b]) => Math.abs((((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) + 360) % 180) - angle) < 1);
      const t = angle * Math.PI / 180, nx = -Math.sin(t), ny = Math.cos(t);
      const offs = [...new Set(set.map(([a]) => Math.round((a[0] * nx + a[1] * ny) * 1000) / 1000))].sort((a, b) => a - b);
      assert.ok(offs.length > 5, `${angle}°: ${offs.length} lines`);
      for (let i = 1; i < offs.length; i++) {
        const d = offs[i] - offs[i - 1];
        assert.ok(Math.abs(d - o.gap) <= 0.05 * o.gap, `${angle}° line spacing ${d.toFixed(3)} mm, want ${o.gap}`);
      }
    }
    // spiral: along the +x axis each ring crosses once; the crossings are `gap` apart
    const sp = prepare(spiral(picture(W, H, () => undefined), o).strokes, opts);
    assert.equal(sp.length, 1);
    const radii = [];
    const s = sp[0];
    for (let i = 1; i < s.length; i++) {
      const [a, b] = [s[i - 1], s[i]];
      if (a[1] > 0 && b[1] <= 0 && a[0] > 0) radii.push(a[0] + (b[0] - a[0]) * (-a[1]) / (b[1] - a[1]));
    }
    radii.sort((a, b) => a - b);
    assert.ok(radii.length > 10, `${radii.length} rings`);
    for (let i = 1; i < radii.length; i++) {
      const d = radii[i] - radii[i - 1];
      assert.ok(Math.abs(d - o.gap) <= 0.05 * o.gap, `ring spacing ${d.toFixed(3)} mm, want ${o.gap}`);
    }
    assert.ok(Math.abs(radii[radii.length - 1] - o.diameter / 2 * o.size / 100) < 0.01, 'outer ring is the edge of the drawing');
  }
});

test('HELLO.png as spiral and hatch draws true on the polar machine', () => {
  const img = fixture('hello-block');
  for (const [name, fn] of [['spiral', spiral], ['hatch', hatch]]) {
    for (const extra of [{}, { offset: 3 }]) {
      const o = { ...DEFAULTS, ...extra };
      const raw = fn(img, { threshold: 128, gap: 1.2, diameter: o.diameter, size: o.size }).strokes;
      assert.ok(raw.length > 0);
      const target = prepare(raw, o);
      const { gcode } = toGcode(target, o);
      const drawn = simulate(gcode, o, 0.1).down;
      const stray = maxDeviation(drawn, target, 1).worst;
      const missed = maxDeviation(target, drawn, 1).worst;
      assert.ok(stray <= 0.11 && missed <= 0.11, `${name} ${JSON.stringify(extra)}: stray ${stray.toFixed(3)} missed ${missed.toFixed(3)}`);
    }
  }
});
