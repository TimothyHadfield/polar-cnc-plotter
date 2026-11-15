// Resume after a stop or a power cut (js/resume.js): the record kept while plotting puts the
// platter's zero and the pen's zero back, so the rest of the drawing lands where it belongs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jobKey, makeRecord, rebase, offsets, restoreRefs, loadResume, saveResume, share, RESUME_KEY } from '../js/resume.js';
import { Grbl, gcodeLines, resumePoint } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { DEFAULTS, prepare, toGcode } from '../js/polar.js';

const hello = JSON.parse(readFileSync(new URL('./fixtures/hello-world.json', import.meta.url)));
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { for (const t = Date.now() + ms; Date.now() < t; await wait(3)) if (fn()) return; throw new Error('timed out'); };
const fakes = [];
after(() => fakes.forEach(f => f.close()));
async function connect(opts) {
  const fake = new FakeGrbl(opts);
  fakes.push(fake);
  const g = new Grbl(fake);
  await g.ready();
  return { fake, g };
}
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const close = (a, b, tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < tol);

test('the record is kept per drawing and survives a reload', () => {
  const { gcode } = toGcode(prepare(hello, DEFAULTS), DEFAULTS);
  const other = toGcode(prepare(hello, { ...DEFAULTS, size: 90 }), DEFAULTS).gcode;
  assert.notEqual(jobKey(gcode), jobKey(other));
  assert.equal(jobKey(gcode), jobKey(String(gcode)));
  const st = mem();
  const rec = makeRecord(jobKey(gcode), 400, 1000, { wpos: [10, 20, 0], mpos: [30, 50, 1] });
  saveResume(rec, st);
  assert.deepEqual(loadResume(st), rec);
  assert.ok(st.m.has(RESUME_KEY));
  assert.equal(share(rec), 40);
  assert.deepEqual(offsets(rec), [20, 30, 1]);
  saveResume(null, st);
  assert.equal(loadResume(st), null);
});

test('power cut mid-plot: after the restart, Set center + Resume puts the platter angle and pen zero back', async () => {
  // a plot under way: center set with the carriage at 20 mm and the platter at 30°
  const a = await connect({ moveTicks: 1 });
  await a.g.send('G0 X20 Y30 Z0.5');
  await a.g.setCenter();
  await a.g.setPenZero();
  const lines = gcodeLines(toGcode(prepare(hello, DEFAULTS), DEFAULTS).gcode);
  const run = a.g.stream(lines);
  run.catch(() => {});
  await until(() => a.g.job && a.g.job.done > 200);
  const s = await a.g.nextStatus();
  const rec = makeRecord('k', resumePoint(lines, a.g.drawnLines()), lines.length, s);
  const wcoOld = s.mpos.map((m, i) => m - s.wpos[i]);
  a.fake.close();                                  // the power goes; the motors stop where they are (s.mpos)
  const loss = s.mpos;

  // power back: GRBL counts from 0 wherever the motors stand. The real machine is at loss + new count.
  const b = await connect({ moveTicks: 0 });
  await b.g.send('G0 X3 Y-7');                    // something moved after the restart (user jogged): GRBL counted it
  const st = await b.g.nextStatus();
  const rec2 = rebase(rec, [0, 0, 0]);            // first position read after the restart
  assert.equal(rec2.lost, true);
  await assert.rejects(restoreRefs(b.g, rec2), /Set center/);
  // the user jogs the pen over the true center by eye and presses Set center
  const centerNow = wcoOld[0] - loss[0];           // new count where the real center is
  await b.g.send(`G90 G0 X${centerNow}`);
  await b.g.setCenter();
  await restoreRefs(b.g, rec2);
  const t = await b.g.nextStatus();
  const wcoNew = t.mpos.map((m, i) => m - t.wpos[i]);
  // every work position lands on the same real spot as before the cut: wco_new + loss = wco_old
  assert.ok(close(wcoNew.map((w, i) => w + loss[i]), wcoOld, 1e-3), `${wcoNew} + ${loss} vs ${wcoOld}`);
  void st;
  b.fake.close();
});

test('Stop, then Set center pressed again elsewhere: Resume still puts the platter zero back where the plot had it', async () => {
  const { fake, g } = await connect({ moveTicks: 1 });
  await g.send('G0 X15 Y40');
  await g.setCenter();
  const lines = gcodeLines(toGcode(prepare(hello, DEFAULTS), DEFAULTS).gcode);
  const run = g.stream(lines);
  run.catch(() => {});
  await until(() => g.job && g.job.done > 150);
  const s = await g.nextStatus();
  const rec = makeRecord('k', 100, lines.length, s);
  assert.equal(await g.stop(), true);
  await g.send('G91 G0 Y25');
  await g.send('G90');
  await g.setCenter();                              // platter zero moved by 25°: the rest would come out turned
  await restoreRefs(g, rec);
  const t = await g.nextStatus();
  assert.ok(Math.abs((t.mpos[1] - t.wpos[1]) - 40) < 1e-6, `platter zero at ${t.mpos[1] - t.wpos[1]}`);
  assert.equal(rec.lost, false);
  fake.close();
});
