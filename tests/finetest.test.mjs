import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fineRadii, fineStrokes, stepSizes, COMB_GAPS, FINE_SQUARE, TYPICAL } from '../js/finetest.js';
import { DEFAULTS, prepare, toGcode, simulate, maxDeviation } from '../js/polar.js';

test('step size at radius r is r·π/180 / $101 on the platter, 1/$100 on the carriage', () => {
  const s = stepSizes([10, 90], 4.444, 40);
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].platter - 10 * Math.PI / 180 / 4.444) < 1e-12);
  assert.ok(Math.abs(s[1].platter - 0.35345) < 1e-4, `90 mm: ${s[1].platter}`);
  assert.equal(s[1].carriage, 0.025);
  // 1/16 microsteps doubles $101 and halves the platter step
  assert.ok(Math.abs(stepSizes([90], 8.888, 40)[0].platter - s[1].platter / 2) < 1e-4);
  assert.ok(TYPICAL[101] > 0 && TYPICAL[100] > 0);
});

test('rings at 10, 30, 50, 70, 90 mm, clamped to the drawing circle with one ring at the edge', () => {
  assert.deepEqual(fineRadii(100), [10, 30, 50, 70, 90]);
  const r90 = fineRadii(90);
  assert.deepEqual(r90.slice(0, 4), [10, 30, 50, 70]);
  assert.equal(r90.length, 5);
  assert.ok(r90[4] > 75 && r90[4] < 90, `edge ring at ${r90[4]}`);
  const small = fineRadii(25);
  assert.equal(small[0], 10);
  assert.ok(small.every(r => r < 25));
});

// Splits the test into its pieces by where they sit, in mm with y UP (the strokes come y down).
const up = strokes => strokes.map(s => s.map(([x, y]) => [x, -y]));
const polar = p => [Math.hypot(p[0], p[1]), Math.atan2(p[1], p[0])];

test('combs: lines `gap` mm apart along the circle and along the radius, the same at every ring', () => {
  const maxR = 90;
  const all = fineStrokes(maxR);
  assert.deepEqual(all.center, [0, 0]);
  assert.equal(all.radius, maxR);
  assert.deepEqual(all.radii, fineRadii(maxR));
  for (const r of all.radii) {
    const ring = all.rings.find(g => g.r === r);
    assert.ok(ring, `ring ${r}`);
    // along the circle: radial lines (one radius-only move each), spaced by arc length on radius r
    const tang = up(ring.alongCircle);
    assert.equal(tang.length, 3 * COMB_GAPS.length);
    const ang = tang.map(s => polar(s[0])[1]);
    for (const s of tang) {
      const [ra, ta] = polar(s[0]), [rb, tb] = polar(s[s.length - 1]);
      assert.ok(Math.abs(ta - tb) < 1e-9, 'a radial line');
      assert.ok(Math.abs((ra + rb) / 2 - r) < 1e-9, 'centred on the ring');
    }
    COMB_GAPS.forEach((g, i) => {
      for (const k of [1, 2]) {
        let d = ang[3 * i + k] - ang[3 * i + k - 1];
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        assert.ok(Math.abs(Math.abs(d) * r - g) < 1e-9, `r ${r}: arc gap ${Math.abs(d) * r}, want ${g}`);
      }
    });
    // along the radius: arcs at one radius each (platter-only moves), radii `gap` apart
    const rad = up(ring.alongRadius);
    assert.equal(rad.length, 3 * COMB_GAPS.length);
    const rr = rad.map(s => {
      const rs = s.map(p => polar(p)[0]);
      assert.ok(Math.max(...rs) - Math.min(...rs) < 1e-9, 'an arc of one radius');
      return rs[0];
    });
    COMB_GAPS.forEach((g, i) => {
      for (const k of [1, 2]) assert.ok(Math.abs(Math.abs(rr[3 * i + k] - rr[3 * i + k - 1]) - g) < 1e-9, `r ${r}: radial gap`);
    });
    // square: four sides of FINE_SQUARE mm, centred on the ring
    const sq = up([ring.square])[0];
    assert.equal(sq.length, 5);
    for (let i = 1; i < 5; i++) assert.ok(Math.abs(Math.hypot(sq[i][0] - sq[i - 1][0], sq[i][1] - sq[i - 1][1]) - FINE_SQUARE) < 1e-9);
    const mid = [(sq[0][0] + sq[2][0]) / 2, (sq[0][1] + sq[2][1]) / 2];
    assert.ok(Math.abs(Math.hypot(...mid) - r) < 1e-9);
    // arc on the ring and a label
    assert.ok(up([ring.arc])[0].every(p => Math.abs(polar(p)[0] - r) < 1e-9));
    assert.ok(ring.label.length >= 2, 'radius label strokes');
  }
  // nothing past the drawing circle, nothing from one ring reaching the next
  for (const s of up(all)) for (const p of s) assert.ok(polar(p)[0] <= maxR + 1e-9);
  for (const ring of all.rings) {
    const parts = [...ring.alongCircle, ...ring.alongRadius, ring.square, ring.arc, ...ring.label];
    for (const s of up(parts)) for (const p of s) assert.ok(Math.abs(polar(p)[0] - ring.r) < 9, `ring ${ring.r} reaches ${polar(p)[0]}`);
  }
});

test('Fine test lands in true mm at Size 100% and the G-code draws it true', () => {
  for (const extra of [{}, { offset: 0.7 }]) {
    const o = { ...DEFAULTS, ...extra };
    const raw = fineStrokes(o.diameter / 2);
    const target = prepare(raw, o);
    // the 0.25 mm comb on the 30 mm ring is still 0.25 mm apart after fitting
    const ring = raw.rings.find(g => g.r === 30);
    const a = ring.alongRadius[9][0], b = ring.alongRadius[10][0];
    const placed = target.flat();
    const near = p => placed.some(q => Math.hypot(q[0] - p[0], q[1] + p[1]) < 1e-6);
    assert.ok(near(a) || near(b), 'a comb point keeps its mm position');
    const { gcode } = toGcode(target, o);
    const drawn = simulate(gcode, o, 0.05).down;
    const stray = maxDeviation(drawn, target, 1).worst;
    const missed = maxDeviation(target, drawn, 1).worst;
    assert.ok(stray <= 0.11 && missed <= 0.11, `${JSON.stringify(extra)}: stray ${stray.toFixed(3)} missed ${missed.toFixed(3)}`);
  }
});
