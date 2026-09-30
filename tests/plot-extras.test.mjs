// Plot extras: progress shading (line tags + drawn estimate), resume after a stop, pen changes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grbl, gcodeLines, resumeLines, resumePoint, RESUME_HEADER, PLANNER } from '../js/grbl.js';
import { FakeGrbl } from '../js/fakegrbl.js';
import { DEFAULTS, prepare, toGcode, simulate, maxDeviation } from '../js/polar.js';

const fixture = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const hello = fixture('hello-world');
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { for (const t = Date.now() + ms; Date.now() < t; await wait(3)) if (fn()) return; throw new Error('timed out'); };
const fakes = [];
after(() => fakes.forEach(f => f.close()));     // even when a test fails
async function connect(opts) {
  const fake = new FakeGrbl(opts);
  fakes.push(fake);
  const g = new Grbl(fake);
  await g.ready();
  return { fake, g };
}
const circle = (r, cx, cy, n = 90) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)]);
const withColor = (s, c) => Object.assign(s, { color: c });
// two colours, interleaved in the file: red appears first
const twoColour = () => [
  withColor(circle(20, -40, 0), '#ff0000'),
  withColor(circle(15, 40, 10), '#0000ff'),
  withColor([[-60, -50], [60, 50]], '#ff0000'),          // passes near the centre: gets clipped in two
  withColor([[40, -40], [60, -20], [40, 0]], '#0000ff'),
  withColor([[-20, 40], [0, 50], [20, 40]], '#ff0000'),        // bounding box centred on 0,0
];

test('simulate tags every drawn point with the streamed G-code line it came from', () => {
  const o = { ...DEFAULTS, offset: 3 };
  const { gcode } = toGcode(prepare(hello, o), o);
  const lines = gcodeLines(gcode);
  const { down } = simulate(gcode, o, 0.4);
  let prev = -1, pts = 0;
  for (const s of down) {
    assert.equal(s.lines.length, s.length);
    for (const n of s.lines) {
      assert.ok(n >= prev, 'line tags never go backwards');
      assert.match(lines[n], /^G1 /, `point tagged with line ${n}: ${lines[n]}`);
      prev = n;
    }
    pts += s.length;
  }
  assert.ok(pts > 1000);
  // every pen-down move in the G-code shows up as a tag
  const g1 = lines.map((l, i) => l.startsWith('G1 ') ? i : -1).filter(i => i >= 0);
  const tagged = new Set(down.flatMap(s => s.lines));
  assert.deepEqual([...tagged], g1);
});

test('the "drawn up to" estimate never runs ahead of the acknowledged lines or of the machine', async () => {
  const { fake, g } = await connect({ moveTicks: 1 });
  const lines = gcodeLines(toGcode(prepare(hello, DEFAULTS), DEFAULTS).gcode).slice(0, 400);
  const done = g.stream(lines);
  let samples = 0, most = 0;
  while (g.job) {
    const d = g.drawnLines();
    const finished = fake.received.length - (fake.moving > 0 ? 1 : 0);   // lines the fake has completed
    assert.ok(d <= g.job.done, `estimate ${d} > acknowledged ${g.job.done}`);
    assert.ok(d <= finished, `estimate ${d} > finished ${finished}`);
    most = Math.max(most, d); samples++;
    await wait(2);
  }
  await done;
  assert.ok(samples > 20 && most > 100, `${samples} samples, got to ${most}`);
  assert.equal(g.lastJob.drawn, 400);
  fake.close();
});

test('resume program: pen-up move to the resume point, right Z there, and the two runs cover the whole drawing', () => {
  for (const opts of [{}, { offset: 3 }, { offset: -2.5, flip: true }]) {
    const o = { ...DEFAULTS, ...opts };
    const target = prepare(hello, o);
    const lines = gcodeLines(toGcode(target, o).gcode);
    for (let k = 1; k <= 12; k++) {
      const drawn = Math.round(lines.length * k / 13);     // lines surely on paper when it stopped
      const from = resumePoint(lines, drawn);
      assert.ok(from <= drawn && from >= drawn - 5);
      const prog = resumeLines(lines, from, o.penUp);
      assert.deepEqual(prog.slice(RESUME_HEADER), lines.slice(from));
      // header only (up, travel, back to the Z in effect): the pen never touches the paper
      assert.equal(simulate(prog.slice(0, RESUME_HEADER).join('\n'), o, 0.05).down.length, 0, `from ${from}: pen down on the way`);
      const before = simulate(lines.slice(0, drawn).join('\n'), o, 0.05).down;
      const after = simulate(prog.join('\n'), o, 0.05).down;
      const stray = maxDeviation(after, target, 1).worst;
      const missed = maxDeviation(target, [...before, ...after], 1).worst;
      assert.ok(stray <= 0.11, `${JSON.stringify(opts)} from ${from}: resume strayed ${stray.toFixed(3)} mm`);
      assert.ok(missed <= 0.11, `${JSON.stringify(opts)} from ${from}: missed ${missed.toFixed(3)} mm`);
    }
  }
});

test('stop mid-plot on the pretend plotter, then resume: it finishes and nothing is missed', async () => {
  const { fake, g } = await connect({ moveTicks: 1 });
  await g.send('G0 X20 Y30');
  await g.setCenter();
  const o = DEFAULTS;
  const target = prepare(hello, o);
  const lines = gcodeLines(toGcode(target, o).gcode);
  const first = g.stream(lines);
  first.catch(() => {});
  await until(() => g.job && g.job.done > 300);
  await g.stop();
  await assert.rejects(first, /Stopped/);
  const drawn = g.lastJob.drawn;
  assert.ok(drawn > 250 && drawn < lines.length, `drawn ${drawn}`);
  assert.ok(drawn <= fake.received.length - 1, 'estimate is behind what the plotter ran');
  const from = resumePoint(lines, drawn);
  const prog = resumeLines(lines, from, o.penUp);
  fake.moveTicks = 0;                        // run the rest at full speed
  const n0 = fake.received.length;
  await g.stream(prog);
  assert.deepEqual(fake.received.slice(n0), prog);
  const missed = maxDeviation(target, [...simulate(lines.slice(0, drawn).join('\n'), o, 0.05).down, ...simulate(prog.join('\n'), o, 0.05).down], 1).worst;
  assert.ok(missed <= 0.11, `missed ${missed.toFixed(3)} mm`);
  fake.close();
});

test('two colours: grouped in order of first appearance, one M0 between the groups, colour survives prepare', () => {
  for (const opts of [{}, { offset: 3, flip: true }]) {
    const o = { ...DEFAULTS, ...opts };
    const strokes = prepare(twoColour(), o);
    const colours = strokes.map(s => s.color);
    assert.ok(colours.every(Boolean), 'every stroke keeps its colour');
    const firstBlue = colours.indexOf('#0000ff');
    assert.ok(firstBlue > 0 && colours.slice(0, firstBlue).every(c => c === '#ff0000') && colours.slice(firstBlue).every(c => c === '#0000ff'), colours.join(' '));
    if (o.offset) assert.equal(colours.filter(c => c === '#ff0000').length, 4, 'the clipped line became two red pieces');
    const { gcode, stats } = toGcode(strokes, o);
    assert.equal(stats.pens, 2);
    const raw = gcode.split('\n');
    assert.equal(raw.filter(l => l === 'M0').length, 1);
    const m = raw.indexOf('M0');
    assert.equal(raw[m - 1], '; pen 2: #0000ff');
    assert.ok(raw.includes('; pen 1: #ff0000') && raw.indexOf('; pen 1: #ff0000') < m);
    assert.equal(raw[m - 2], `G0 Z${o.penUp.toFixed(3)}`, 'pen is up at the pause');
    // M0 draws nothing; preview colours follow the pens
    const sim = simulate(gcode, o, 0.2);
    const lines = gcodeLines(gcode);
    const mi = lines.indexOf('M0');
    for (const s of sim.down) assert.equal(s.color, s.lines[0] < mi ? '#ff0000' : '#0000ff');
    const flat = simulate(gcode.replace('M0\n', ''), o, 0.2).down;
    assert.deepEqual(sim.down.map(s => s.length), flat.map(s => s.length));
  }
});

test('one colour, or no colour (pictures): no M0, one pen, no pen comments', () => {
  const one = twoColour().map(s => withColor(s.slice(), '#123456'));
  const none = twoColour().map(s => s.slice());
  for (const raw of [one, none, hello]) {
    const { gcode, stats } = toGcode(prepare(raw, DEFAULTS), DEFAULTS);
    assert.equal(stats.pens, 1);
    assert.ok(!/^M0$/m.test(gcode) && !/; pen /.test(gcode));
  }
});

test('the pretend plotter holds at M0 (a pen change) and finishes after Resume', async () => {
  const { fake, g } = await connect({ moveTicks: 1 });
  const lines = gcodeLines(toGcode(prepare(twoColour(), DEFAULTS), DEFAULTS).gcode);
  const mi = lines.indexOf('M0');
  const done = g.stream(lines);
  await until(() => { g.realtime('?'); return g.programPause() >= 0 || !g.job; });
  await g.nextStatus();
  assert.equal(g.programPause(), mi, 'held at the pen change');
  assert.equal(fake.state, 'Hold:0');
  assert.equal(fake.received.length, mi + 1, 'everything before the M0 ran, nothing after');
  assert.equal(g.drawnLines(), mi, 'all lines before the pen change count as drawn');
  await wait(60);
  assert.equal(fake.received.length, mi + 1, 'still waiting for the new pen');
  g.pause(); g.resume();                     // Pause/Resume while held must not break anything
  await done;
  assert.deepEqual(fake.received, lines);
  fake.close();
});

test('a user pause is not mistaken for a pen change', async () => {
  const { fake, g } = await connect({ moveTicks: 2 });
  const lines = gcodeLines(toGcode(prepare(hello, DEFAULTS), DEFAULTS).gcode).slice(0, 80);
  const done = g.stream(lines);
  await wait(40);
  g.pause();
  await g.nextStatus();
  assert.equal(g.programPause(), -1);
  g.resume();
  await done;
  fake.close();
});

test('resume never starts back across a pen change', () => {
  const lines = gcodeLines(toGcode(prepare(twoColour(), DEFAULTS), DEFAULTS).gcode);
  const mi = lines.indexOf('M0');
  assert.equal(resumePoint(lines, mi + 3), mi + 1);
  assert.equal(resumePoint(lines, mi + 20), mi + 15);
  assert.equal(resumePoint(lines, 3), 0);
  assert.ok(PLANNER >= 15);
});
