// Photo check (js/photocal.js): a made-up photo of a Test drawing plotted by a machine with known
// errors; the fit must find the errors again from the taps alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAPS, EDGES, PAPER_R, rectifier, fitCircle, testPaths, land, fitPhoto, corrections } from '../js/photocal.js';
import { DEFAULTS, toPlatter } from '../js/polar.js';

// small deterministic noise (mm)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

// A camera: platter mm -> photo pixels. The paper sits `paper` mm off the platter center and the
// photo is turned `rho`, with a slightly tilted (affine) view, ~14 px per mm, y down.
function camera({ rho = 0.4, paper = [1.5, -2], G = [[14.2, 1.3], [-0.9, 12.6]], o = [2100, 1700] } = {}) {
  const c = Math.cos(rho), s = Math.sin(rho);
  const toQ = p => { const x = p[0] - paper[0], y = p[1] - paper[1]; return [c * x - s * y, s * x + c * y]; };
  const toPx = q => { const r = [G[0][0] * q[0] + G[0][1] * q[1] + o[0], G[1][0] * q[0] + G[1][1] * q[1] + o[1]]; return [r[0], -r[1] + 4000]; };
  return { platter: p => toPx(toQ(p)), paper: q => toPx(q) };
}

// The taps a careful user makes on that photo, with `noise` mm of shake.
function makeTaps(o, truth, cam, noise = 0.15) {
  const P = testPaths(o);
  const shake = p => [p[0] + noise * 2 * rnd(), p[1] + noise * 2 * rnd()];
  const real = m => land(m, truth, P.flip);
  const nearestOn = (items, target) => {      // the planned point nearest the target, where it really landed
    let best = null, bd = Infinity;
    for (const it of items) it.pts.forEach((q, i) => { const d = Math.hypot(q[0] - target[0], q[1] - target[1]); if (d < bd) { bd = d; best = it.m[i]; } });
    return real(best);
  };
  return TAPS.map((t, i) => {
    if (t.kind === 'edge') { const a = i * 1.31 + 0.2; return cam.paper(shake([PAPER_R * Math.cos(a), PAPER_R * Math.sin(a)])); }
    if (t.part === 'ring') {                  // somewhere on the circle near where it is asked for
      const want = Math.atan2(t.at[1], t.at[0]);
      let best = null, bd = Infinity;
      for (const it of P.parts.ring) it.m.forEach(m => { const p = real(m); const d = Math.abs(Math.atan2(Math.sin(Math.atan2(p[1], p[0]) - want), Math.cos(Math.atan2(p[1], p[0]) - want))); if (d < bd) { bd = d; best = p; } });
      return cam.platter(shake(best));
    }
    return cam.platter(shake(nearestOn(P.parts[t.part], t.at.map(v => v))));
  });
}

test('the paper edge seen tilted is put back to a 200 mm circle', () => {
  const cam = camera();
  const edge = Array.from({ length: 7 }, (_, i) => cam.paper([PAPER_R * Math.cos(i), PAPER_R * Math.sin(i)]));
  const f = rectifier(edge.slice(0, 5));
  assert.ok(f, 'an oval');
  for (const p of edge) assert.ok(Math.abs(Math.hypot(...f(p)) - PAPER_R) < 1e-6, `edge at ${Math.hypot(...f(p))}`);
  // distances on the paper come back right (an affine view keeps the circle's center)
  const a = f(cam.paper([0, 0])), b = f(cam.paper([60, 0]));
  assert.ok(Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1]) - 60) < 1e-6);
  assert.equal(rectifier(edge.slice(0, 4)), null);
  const c = fitCircle([[1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y]) => [3 + 2 * x, -4 + 2 * y]));
  assert.ok(Math.abs(c.r - 2) < 1e-9 && Math.abs(c.c[0] - 3) < 1e-9 && Math.abs(c.c[1] + 4) < 1e-9);
});

test('the Test drawing is sorted into the parts the taps name', () => {
  for (const o of [DEFAULTS, { ...DEFAULTS, offset: 1.5, flip: true }]) {
    const { parts } = testPaths(o);
    assert.equal(parts.ring.length, 1);
    assert.equal(parts.square.length, 1);
    assert.equal(parts.armH.length, 2, 'the cross line is cut at the center: two halves');
    assert.equal(parts.armV.length, 2);
    assert.equal(parts.armR.length, 1);
    assert.equal(parts.armL.length, 1);
  }
});

for (const [name, o, truth] of [
  ['carriage 2.5 % long, platter 1.2 % short, gap 1 mm, center 0.6 mm off', DEFAULTS, { a: 1.025, b: 0.988, e: 0.6, d: 1.0 }],
  ['reversed platter, a gap already set, carriage short', { ...DEFAULTS, flip: true, offset: 0.5 }, { a: 0.97, b: 1.015, e: -0.4, d: -0.3 }],
  ['a smaller drawing (Size 80 %)', { ...DEFAULTS, size: 80 }, { a: 1.01, b: 1.006, e: 0, d: 0.8 }],
]) {
  test(`photo check finds the errors: ${name}`, () => {
    const taps = makeTaps(o, truth, camera());
    const fit = fitPhoto(taps, o);
    assert.ok(!fit.error, fit.error);
    const got = { a: +fit.a.toFixed(4), b: +fit.b.toFixed(4), e: +fit.e.toFixed(2), d: +fit.d.toFixed(2), rms: +fit.rms.toFixed(3) };
    assert.ok(Math.abs(fit.a - truth.a) < 0.004, `$100 scale ${JSON.stringify(got)}`);
    assert.ok(Math.abs(fit.b - truth.b) < 0.003, `$101 scale ${JSON.stringify(got)}`);
    assert.ok(Math.abs(fit.d - truth.d) < 0.25, `gap ${JSON.stringify(got)}`);
    assert.ok(Math.abs(fit.e - truth.e) < 0.4, `center ${JSON.stringify(got)}`);
    assert.ok(fit.rms < 0.4, `rms ${JSON.stringify(got)}`);
    const vals = { 100: 40, 101: 4.444 };
    const c = corrections(fit, vals, o);
    assert.ok(Math.abs(c[100] - 40 / truth.a) < 0.2, JSON.stringify(c));
    assert.ok(Math.abs(c[101] - 4.444 / truth.b) < 0.015, JSON.stringify(c));
  });
}

test('a machine with nothing wrong: no corrections', () => {
  const truth = { a: 1, b: 1, e: 0, d: 0 };
  const fit = fitPhoto(makeTaps(DEFAULTS, truth, camera({ rho: -1.1 }), 0.1), DEFAULTS);
  assert.deepEqual(corrections(fit, { 100: 40, 101: 4.444 }, DEFAULTS), {}, JSON.stringify(fit));
});

test('taps that don\'t belong to the drawing are caught (high rms), and too few taps are refused', () => {
  const taps = makeTaps(DEFAULTS, { a: 1, b: 1, e: 0, d: 0 }, camera());
  taps[EDGES + 4] = [taps[EDGES + 4][0] + 300, taps[EDGES + 4][1] - 200];      // a corner tapped 20 mm off
  const fit = fitPhoto(taps, DEFAULTS);
  assert.ok(fit.worst > 5, JSON.stringify(fit));
  assert.ok(fitPhoto(taps.slice(0, 10), DEFAULTS).error);
  void toPlatter;
});
