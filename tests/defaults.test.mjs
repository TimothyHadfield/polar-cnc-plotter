import test from 'node:test';
import assert from 'node:assert/strict';
import { capture, differs, apply, plotterOff, describe, loadDefaults, saveDefaults } from '../js/defaults.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const s = { offset: 0.7, flip: true, penUp: 0, penDown: -0.4, zFlip: true, diameter: 180 };
const vals = { 100: 40, 101: 4.444, 3: 4, 102: 250, 111: 7200 };

test('capture keeps the calibrated settings only', () => {
  const d = capture(vals, s, '2026-11-14');
  assert.deepEqual(d, { app: { offset: 0.7, flip: true, penUp: 0, penDown: -0.4, zFlip: true }, grbl: { 100: 40, 101: 4.444, 3: 4 }, at: '2026-11-14' });
  const st = mem();
  saveDefaults(d, st);
  assert.deepEqual(loadDefaults(st), JSON.parse(JSON.stringify(d)));
  assert.equal(loadDefaults(mem()), null);
});

test('a change that moves a default is listed with the old value; the same value is not', () => {
  const d = JSON.parse(JSON.stringify(capture(vals, s)));      // as read back from storage: keys are strings
  assert.deepEqual(differs(d, [{ n: 101, to: 4.4442 }, { key: 'penDown', to: -0.4 }]), []);
  const l = differs(d, [{ n: 101, to: 4.5 }, { key: 'flip', to: false }]);
  assert.equal(l.length, 2);
  assert.equal(describe(l[0]), 'Platter steps ($101) 4.444 → 4.5');
  assert.equal(describe(l[1]), 'Turn direction counterclockwise → clockwise');
  assert.deepEqual(differs(null, [{ n: 101, to: 4.5 }]), []);   // no defaults yet: nothing to ask
  const d2 = apply(d, l);
  assert.equal(d2.grbl[101], 4.5);
  assert.equal(d2.app.flip, false);
  assert.equal(d2.grbl[100], 40);
});

test('a plotter that is not at its defaults is told what to put back', () => {
  const d = JSON.parse(JSON.stringify(capture(vals, s)));
  assert.deepEqual(plotterOff(d, vals), []);
  const off = plotterOff(d, { ...vals, 101: 250, 3: 0 });
  assert.deepEqual(off.map(c => [c.n, c.from, c.to]), [[101, 250, 4.444], [3, 0, 4]]);
  assert.equal(describe(off[0]), 'Platter steps ($101) 250 → 4.444');
  assert.deepEqual(plotterOff(null, vals), []);
});

test('top speeds: never taken as defaults by themselves, but put back once the speed test saved them', () => {
  const d = capture({ ...vals, 110: 6000, 111: 7200 }, s);
  assert.equal(d.grbl[110], undefined);
  assert.deepEqual(plotterOff(d, { ...vals, 110: 500 }), []);
  const d2 = apply(d, [{ n: 110, to: 6000 }, { n: 120, to: 250 }]);
  const off = plotterOff(d2, { ...vals, 110: 500, 120: 10 });
  assert.deepEqual(off.map(c => [c.n, c.from, c.to]), [[110, 500, 6000], [120, 10, 250]]);
  assert.equal(describe(off[0]), 'Carriage speed ($110) 500 → 6000');
});
