// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, toGcode, simulate, maxDeviation, DEFAULTS } from '../js/polar.js';
import { FONTS } from '../js/fonts.js';
import { textStrokes, layoutLine, ringRadii, CAP, LINE } from '../js/text.js';
import { PATTERNS, patternStrokes, defaults, roseRange, spiroRatio, TOL } from '../js/patterns.js';

// Same end-to-end check as polar.test.mjs: convert, simulate GRBL, measure stray and missed ink.
function check(raw, opts) {
  const o = { ...DEFAULTS, ...opts };
  const target = prepare(raw, o);
  const { gcode } = toGcode(target, o);
  const drawn = simulate(gcode, o, 0.05).down;
  return { stray: maxDeviation(drawn, target, 1).worst, missed: maxDeviation(target, drawn, 1).worst };
}
const bbox = strokes => {
  let y0 = Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [, y] of s) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { y0, y1 };
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- fonts ----------

test('fonts: three single-stroke fonts with every printable ASCII character, under 150 KB of data', () => {
  for (const key of ['sans', 'script', 'serif']) {
    const g = FONTS[key].glyphs;
    for (let c = 32; c <= 126; c++) assert.ok(g[String.fromCharCode(c)], `${key} is missing ${String.fromCharCode(c)}`);
    for (const [ch, [adv, ...strokes]] of Object.entries(g)) {
      assert.ok(adv > 0, `${key} ${ch}: advance`);
      for (const s of strokes) assert.ok(s.length >= 4 && s.length % 2 === 0, `${key} ${ch}: stroke is a pen line`);
    }
  }
  assert.ok(JSON.stringify(FONTS).length < 150e3);
});

// ---------- text ----------

test('text "A" is drawn once: two slants and a crossbar, not an outline', () => {
  const s = textStrokes('A', { font: 'sans' });
  assert.equal(s.length, 3);
  assert.equal(s.length, FONTS.sans.glyphs.A.length - 1);
  // each stroke is a single straight line (2 points), no closed loops
  for (const st of s) { assert.equal(st.length, 2); assert.ok(dist(st[0], st[st.length - 1]) > 100); }
});

test('text: each font draws "Hi" with exactly its glyph strokes', () => {
  for (const font of ['sans', 'script', 'serif']) {
    const g = FONTS[font].glyphs;
    assert.equal(textStrokes('Hi', { font }).length, g.H.length - 1 + g.i.length - 1, font);
  }
});

test('text: lines stack downward (y down), each line centred', () => {
  const s = textStrokes('ONE\nTWO\nSIX', { font: 'sans' });
  const per = [layoutLine('ONE').strokes.length, layoutLine('TWO').strokes.length, layoutLine('SIX').strokes.length];
  const lines = [s.slice(0, per[0]), s.slice(per[0], per[0] + per[1]), s.slice(per[0] + per[1])];
  const boxes = lines.map(bbox);
  assert.ok(boxes[0].y1 < boxes[1].y0 && boxes[1].y1 < boxes[2].y0, JSON.stringify(boxes));
  for (let i = 1; i < 3; i++) assert.ok(Math.abs(boxes[i].y0 - boxes[i - 1].y0 - LINE) < 1);
  // centred: x range symmetric about 0 for each line (within a glyph's side bearing)
  for (const l of lines) {
    const xs = l.flat().map(p => p[0]);
    assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 250);
  }
});

test('text circle layout: every glyph sits on its ring (baseline at the ring radius ± glyph height)', () => {
  const txt = 'AROUND THE WORLD\nsecond ring';
  const s = textStrokes(txt, { font: 'sans', layout: 'circle' });
  const lines = txt.split('\n').map(l => layoutLine(l));
  const R = ringRadii(lines.map(l => l.width));
  assert.ok(R[0] > R[1], 'first line is the outer ring');
  let k = 0;
  lines.forEach((l, i) => {
    for (let j = 0; j < l.strokes.length; j++, k++) {
      for (const p of s[k]) {
        const r = Math.hypot(p[0], p[1]);
        assert.ok(r >= R[i] - 300 && r <= R[i] + CAP + 100, `ring ${i}: point at r=${r.toFixed(0)}, ring ${R[i].toFixed(0)}`);
      }
    }
  });
  // text sits on the top of the ring (y down: negative y), reading left to right
  const first = s[0][0], lastLine0 = s[lines[0].strokes.length - 1][0];
  assert.ok(first[0] < lastLine0[0], 'reads left to right');
  assert.ok(bbox(s.slice(0, 3)).y1 < 0, 'starts on the top half');
  // long text fits around its ring without the ends overlapping
  const long = layoutLine('X'.repeat(80)).width;
  assert.ok(ringRadii([long])[0] * 2 * Math.PI > long);
});

test('text: unknown characters are skipped, smart quotes become plain, empty text draws nothing', () => {
  assert.deepEqual(textStrokes('A☃é中', {}), textStrokes('A', {}));
  assert.equal(textStrokes('it’s', {}).length, textStrokes("it's", {}).length);
  assert.deepEqual(textStrokes('', {}), []);
  assert.deepEqual(textStrokes('   \n ', {}), []);
  assert.doesNotThrow(() => textStrokes('x', { font: 'nope' }));
});

// ---------- patterns ----------

// Count petal tips: runs along the path where the radius is at its max (joining the ends of a closed curve).
function tipRuns(s) {
  const r = s.map(p => Math.hypot(p[0], p[1]));
  const max = Math.max(...r);
  let runs = 0, inRun = false;
  for (const v of r) { const hi = v > 0.995 * max; if (hi && !inRun) runs++; inRun = hi; }
  if (r[0] > 0.995 * max && r[r.length - 1] > 0.995 * max && dist(s[0], s[s.length - 1]) < 1e-6) runs--;
  return runs;
}
// Distinct tip positions: a curve that retraces itself has fewer distinct tips than runs.
function distinctTips(s) {
  const r = s.map(p => Math.hypot(p[0], p[1]));
  const max = Math.max(...r), tips = [];
  let best = null;   // the farthest point of the current run
  const flush = () => { if (best && !tips.some(q => dist(best, q) < 1)) tips.push(best); best = null; };
  s.forEach((p, i) => {
    if (r[i] > 0.995 * max) { if (!best || r[i] > Math.hypot(...best)) best = p; } else flush();
  });
  flush();
  return tips.length;
}

test('rose: n petals for odd k, 2n for even k, each petal drawn once, curve closes', () => {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const [s] = patternStrokes('rose', { petals: n, layers: 1 });
    const want = n % 2 ? n : 2 * n;
    assert.equal(tipRuns(s), want, `k=${n}`);
    assert.equal(distinctTips(s), want, `k=${n}: a petal is drawn twice`);
    assert.ok(dist(s[0], s[s.length - 1]) < 1e-9, `k=${n} closes`);
  }
  // k = n/d: 3/2 has 6 petals over 4π, and still closes
  const { end } = roseRange(3, 2);
  assert.ok(Math.abs(end - 4 * Math.PI) < 1e-12);
  const [s] = patternStrokes('rose', { petals: 3, layers: 2 });
  assert.ok(dist(s[0], s[s.length - 1]) < 1e-9);
});

test('spirograph: closes on itself, with the number of loops asked for', () => {
  for (const loops of [3, 5, 7, 12, 30]) for (const shape of [1, 3, 5, 9]) for (const pen of [10, 80, 150]) {
    const [s] = patternStrokes('spirograph', { loops, shape, pen });
    assert.ok(dist(s[0], s[s.length - 1]) < 1e-6, `loops ${loops} shape ${shape} pen ${pen}: ends ${dist(s[0], s[s.length - 1])} apart`);
    assert.equal(tipRuns(s), loops, `loops ${loops} shape ${shape} pen ${pen} (w=${spiroRatio(loops, shape)})`);
    assert.equal(distinctTips(s), loops, `loops ${loops} shape ${shape} pen ${pen}: retraces itself`);
  }
});

test('patterns and ring text ask to be centred on (0, 0), not on their lopsided bounding box', () => {
  for (const type of Object.keys(PATTERNS)) assert.deepEqual(patternStrokes(type).center, [0, 0], type);
  assert.deepEqual(textStrokes('Hi', { layout: 'circle' }).center, [0, 0]);
  assert.equal(textStrokes('Hi', { layout: 'lines' }).center, undefined);
});

test('waves: every ring closes; spiral starts at the centre and ends on the edge', () => {
  for (const s of patternStrokes('waves', {})) assert.ok(dist(s[0], s[s.length - 1]) < 1e-9);
  const sp = patternStrokes('spiral', { turns: 12, arms: 3 });
  assert.equal(sp.length, 3);
  for (const s of sp) { assert.ok(Math.hypot(...s[0]) < 1e-9); assert.ok(Math.abs(Math.hypot(...s[s.length - 1]) - 100) < 1e-9); }
});

test('patterns are smooth: the true curve never leaves the drawn polyline by more than the tolerance', () => {
  // true curves, sampled 20 000 times per turn, y down like the patterns
  const TAU = 2 * Math.PI;
  const dense = (f, t1) => { const n = Math.ceil(t1 / TAU * 20000), o = []; for (let i = 0; i <= n; i++) { const p = f(t1 * i / n); o.push([p[0], -p[1]]); } return o; };
  const { k, end } = roseRange(7, 3);
  const w = spiroRatio(30, 9), r = w / 30, p = r * 1.5, q = (1 - r) / r, sk = 100 / (1 - r + p);
  const cases = [
    ['spiral', { turns: 40, arms: 1 }, dense(t => { const rr = 100 * t / (TAU * 40); return [rr * Math.cos(t), rr * Math.sin(t)]; }, TAU * 40)],
    ['rose', { petals: 7, layers: 3 }, dense(t => { const rr = 100 * Math.cos(k * t); return [rr * Math.cos(t), rr * Math.sin(t)]; }, end)],
    ['spirograph', { loops: 30, shape: 9, pen: 150 }, dense(t => [sk * ((1 - r) * Math.cos(t) + p * Math.cos(q * t)), sk * ((1 - r) * Math.sin(t) - p * Math.sin(q * t))], TAU * w)],
  ];
  for (const [type, params, truth] of cases) {
    const drawn = patternStrokes(type, params);
    const off = maxDeviation([truth], drawn, 1).worst;
    assert.ok(off <= TOL * 1.05, `${type}: curve is ${off.toFixed(4)} units from its polyline (tolerance ${TOL})`);
  }
});

for (const [type, P] of Object.entries(PATTERNS)) {
  const variants = [defaults(type), Object.fromEntries(P.sliders.map(s => [s.key, s.max])), Object.fromEntries(P.sliders.map(s => [s.key, s.min]))];
  for (const params of variants) {
    test(`${type} ${JSON.stringify(params)}: converter keeps the pen within 0.1 mm and draws everything`, () => {
      for (const opts of [{}, { offset: 3 }]) {
        const r = check(patternStrokes(type, params), opts);
        assert.ok(r.stray <= 0.11, `pen strayed ${r.stray.toFixed(3)} mm`);
        assert.ok(r.missed <= 0.11, `missed ${r.missed.toFixed(3)} mm`);
      }
    });
  }
}

test('text in both layouts passes the converter end-to-end', () => {
  for (const font of ['sans', 'script', 'serif']) for (const layout of ['lines', 'circle']) {
    const r = check(textStrokes('Polar plotter\nHello, World!', { font, layout }), {});
    assert.ok(r.stray <= 0.11 && r.missed <= 0.11, `${font} ${layout}: stray ${r.stray.toFixed(3)}, missed ${r.missed.toFixed(3)}`);
  }
});
