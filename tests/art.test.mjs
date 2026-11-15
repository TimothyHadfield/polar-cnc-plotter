import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stipple, linePortrait, DOT } from '../js/styles.js';
import { PATTERNS, patternStrokes, shuffle, GENERATIVE } from '../js/patterns.js';
import { DEFAULTS, toGcode, simulate, maxDeviation, prepare } from '../js/polar.js';

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
const opts = o => ({ ...DEFAULTS, diameter: o.diameter, size: o.size });
const centre = s => [s.reduce((a, p) => a + p[0], 0) / s.length, s.reduce((a, p) => a + p[1], 0) / s.length];

// ---------- stipple ----------
test('stipple: white draws nothing; a black square is dots inside it, each a tiny closed loop', () => {
  assert.equal(stipple(picture(W, H, () => undefined), O).strokes.length, 0);
  const inSq = (x, y) => x >= 100 && x < 180 && y >= 60 && y < 140;
  const out = stipple(picture(W, H, (x, y) => (inSq(x, y) ? 0 : undefined)), O);
  assert.ok(out.strokes.length > 50, `${out.strokes.length} dots`);
  for (const s of out.strokes) {
    const [x, y] = centre(s);
    assert.ok(x >= 99 && x <= 181 && y >= 59 && y <= 141, `dot at ${x.toFixed(1)},${y.toFixed(1)}`);
    assert.ok(Math.hypot(s[0][0] - s.at(-1)[0], s[0][1] - s.at(-1)[1]) < 1e-9, 'closed');
  }
  // on paper: each dot DOT mm across, dots at least half a gap apart
  const dots = prepare(out.strokes, opts(O));
  assert.equal(dots.length, out.strokes.length);
  for (const s of dots) {
    const c = centre(s.slice(0, -1));
    const r = Math.max(...s.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])));
    assert.ok(Math.abs(2 * r - DOT) < 0.05, `dot ${(2 * r).toFixed(3)} mm across`);
  }
  const cs = dots.map(s => centre(s.slice(0, -1)));
  let closest = Infinity;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) closest = Math.min(closest, Math.hypot(cs[i][0] - cs[j][0], cs[i][1] - cs[j][1]));
  assert.ok(closest >= 0.45 * O.gap, `closest dots ${closest.toFixed(3)} mm`);
});

test('stipple: darker gets more dots, and the dots come in a short-travel order', () => {
  const res = stipple(picture(W, H, x => (x < 150 ? 0 : 85)), O), half = res.strokes, gapPx = res.gapPx;   // black left, 1/3 dark right
  const left = half.filter(s => centre(s)[0] < 150).length, right = half.length - left;
  assert.ok(right > 0 && left > 2 * right, `black ${left} dots, grey ${right}`);
  const cs = half.map(centre);
  let hop = 0;
  for (let i = 1; i < cs.length; i++) hop += Math.hypot(cs[i][0] - cs[i - 1][0], cs[i][1] - cs[i - 1][1]);
  assert.ok(hop / (cs.length - 1) < 3 * gapPx, `mean hop ${(hop / (cs.length - 1) / gapPx).toFixed(2)} gaps`);
});

// ---------- line portrait ----------
test('line portrait: white draws nothing; lines `gap` mm apart, waves at most half a gap, darker = more ink', () => {
  assert.equal(linePortrait(picture(W, H, () => undefined), O).strokes.length, 0);
  for (const extra of [{}, { gap: 2.5, size: 60 }]) {
    const o = { ...O, ...extra };
    const sq = picture(W, H, (x, y) => (x >= 60 && x < 240 && y >= 40 && y < 170 ? 0 : undefined));
    const lines = prepare(linePortrait(sq, o).strokes, opts(o));
    assert.ok(lines.length > 5);
    const ys = [...new Set(lines.map(s => Math.round(centre(s)[1] * 20) / 20))].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i] - ys[i - 1] - o.gap) <= 0.08 * o.gap, `line spacing ${(ys[i] - ys[i - 1]).toFixed(3)} want ${o.gap}`);
    for (const s of lines) {
      const c = centre(s)[1];
      for (const p of s) assert.ok(Math.abs(p[1] - c) <= 0.5 * o.gap + 1e-6, `wave ${(p[1] - c).toFixed(3)} mm`);
    }
  }
  const ink = tone => linePortrait(picture(W, H, () => tone), O).strokes.reduce((a, s) => {
    for (let i = 1; i < s.length; i++) a += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    return a;
  }, 0);
  assert.ok(ink(0) > 1.5 * ink(90), `black ${ink(0).toFixed(0)} vs grey ${ink(90).toFixed(0)}`);
});

test('HELLO.png as stipple and line portrait draws true on the polar machine', () => {
  const img = fixture('hello-block');
  for (const [name, fn] of [['stipple', stipple], ['lines', linePortrait]]) {
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

// ---------- generative patterns ----------
test('harmonograph: same shape number = same drawing, different = different, about 100 units', () => {
  assert.ok(PATTERNS.harmonograph);
  const a = patternStrokes('harmonograph', { shape: 5 });
  const b = patternStrokes('harmonograph', { shape: 5 });
  const c = patternStrokes('harmonograph', { shape: 6 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const R = Math.max(...a.flat().map(p => Math.hypot(p[0], p[1])));
  assert.ok(R > 60 && R <= 100.0001, `reach ${R}`);
  assert.ok(a[0].length > 200);
});

test('shuffle picks a generative pattern with every slider inside its range', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const seen = new Set(), picks = new Set();
  for (let i = 0; i < 40; i++) {
    const { type, values } = shuffle(rand);
    assert.ok(GENERATIVE.includes(type));
    seen.add(type);
    for (const s of PATTERNS[type].sliders) {
      assert.ok(Number.isInteger(values[s.key]) && values[s.key] >= s.min && values[s.key] <= s.max, `${type}.${s.key} = ${values[s.key]}`);
    }
    picks.add(JSON.stringify([type, values]));
    assert.ok(patternStrokes(type, values).length > 0);
  }
  assert.equal(seen.size, GENERATIVE.length, 'every family comes up');
  assert.ok(picks.size > 35, 'new every time');
});
