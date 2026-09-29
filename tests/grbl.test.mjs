import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grbl, parseStatus, gcodeLines, RX_LIMIT } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { DEFAULTS, convert } from '../js/polar.js';

async function connect(opts) {
  const fake = new FakeGrbl(opts);
  const events = [];
  const g = new Grbl(fake, { onEvent: (e, m) => events.push([e, m]) });
  await g.ready();
  return { fake, g, events };
}
const helloGcode = () => {
  const strokes = JSON.parse(readFileSync(new URL('fixtures/hello-world.json', import.meta.url)));
  return convert(strokes, DEFAULTS).gcode;
};

test('status reports: work position from MPos minus the G92 offset, offset remembered between reports', () => {
  const a = parseStatus('<Run|MPos:12.000,90.000,2.000|FS:0,0|WCO:2.000,10.000,0.000>');
  assert.equal(a.state, 'Run');
  assert.deepEqual(a.wpos, [10, 80, 2]);
  const b = parseStatus('<Idle|MPos:3.000,3.000,0.000|FS:0,0>', a.wco);
  assert.deepEqual(b.wpos, [1, -7, 0]);
  const c = parseStatus('<Hold:0|WPos:1.000,2.000,3.000|FS:0,0>', [1, 1, 1]);
  assert.deepEqual(c.mpos, [2, 3, 4]);
});

test('G-code comments and blank lines are not sent', () => {
  assert.deepEqual(gcodeLines('; header\nG21 G90 (mm) G93\n\n  G0 Z2 ; up\r\nM2\n'), ['G21 G90  G93', 'G0 Z2', 'M2']);
});

test('waits for the GRBL banner before anything else', async () => {
  const { fake, g } = await connect({ bootMs: 80 });
  assert.equal(g.status.state, 'Idle');
  fake.close();
});

test('streams a whole drawing: every line arrives in order, the 128-byte buffer never overflows', async () => {
  const { fake, g } = await connect();
  const lines = gcodeLines(helloGcode());
  assert.ok(lines.length > 1000, `${lines.length} lines`);
  let maxInFlight = 0;
  const origWrite = fake.write.bind(fake);
  fake.write = s => { maxInFlight = Math.max(maxInFlight, g.inFlight); return origWrite(s); };
  const progress = [];
  await g.stream(lines, p => progress.push(p));
  assert.equal(fake.overflow, false);
  assert.ok(maxInFlight <= RX_LIMIT && maxInFlight > 60, `buffer use ${maxInFlight}`);
  assert.deepEqual(fake.received, lines);
  assert.equal(progress.at(-1), 1);
  fake.close();
});

test('a refused line pauses the plot and says which line; resume finishes the rest', async () => {
  const { fake, g, events } = await connect({ failIf: (l, n) => n === 50 });
  const lines = gcodeLines(helloGcode()).slice(0, 300);
  const done = g.stream(lines);
  await new Promise(r => { const t = setInterval(() => { if (events.some(e => e[0] === 'jobError')) { clearInterval(t); r(); } }, 5); });
  assert.match(events.find(e => e[0] === 'jobError')[1], /line 50 .*bad number/);
  await new Promise(r => setTimeout(r, 150));
  assert.ok(fake.received.length < 300, 'stopped sending');
  assert.equal(fake.state, 'Hold:0', 'the machine is held');
  g.resume();
  const res = await done;
  assert.equal(res.errors.length, 1);
  assert.equal(fake.received.length, 300);
  fake.close();
});

test('pause holds, resume continues', async () => {
  const { fake, g } = await connect({ moveTicks: 2 });
  const lines = gcodeLines(helloGcode()).slice(0, 120);
  const done = g.stream(lines);
  await new Promise(r => setTimeout(r, 60));
  g.pause();
  await new Promise(r => setTimeout(r, 30));
  const at = fake.received.length;
  await new Promise(r => setTimeout(r, 80));
  assert.equal(fake.received.length, at, 'nothing runs while paused');
  assert.ok(at < 120);
  g.resume();
  await done;
  assert.equal(fake.received.length, 120);
  fake.close();
});

test('stop: holds, resets, keeps the center, and the job ends', async () => {
  const { fake, g } = await connect({ moveTicks: 2 });
  await g.send('G0 X20 Y30');
  await g.setCenter();                       // pen now "at the center"
  const done = g.stream(gcodeLines(helloGcode()));
  done.catch(() => {});
  await new Promise(r => setTimeout(r, 80));
  const kept = await g.stop();
  await assert.rejects(done);
  assert.equal(kept, true);
  const s = await g.nextStatus();
  assert.equal(s.state, 'Idle');
  // work position is still measured from the same center
  assert.deepEqual(s.wpos.slice(0, 2).map(v => +v.toFixed(3)), [s.mpos[0] - 20, s.mpos[1] - 30].map(v => +v.toFixed(3)));
  assert.equal(fake.buf, '', 'nothing left in its buffer');
  fake.close();
});

test('a reset nobody asked for (USB reconnect) forgets the center', async () => {
  const { fake, g, events } = await connect();
  await g.setCenter();
  assert.ok(g.center);
  fake.softReset();
  await new Promise(r => setTimeout(r, 60));
  assert.equal(g.center, null);
  assert.ok(events.some(e => e[0] === 'reset'));
  fake.close();
});

test('an alarm ends the plot and is reported', async () => {
  const { fake, g, events } = await connect({ moveTicks: 2 });
  const done = g.stream(gcodeLines(helloGcode()));
  done.catch(() => {});
  await new Promise(r => setTimeout(r, 40));
  fake.emit('ALARM:1');
  await assert.rejects(done, /hard limit/);
  assert.ok(events.some(e => e[0] === 'alarm'));
  fake.close();
});
