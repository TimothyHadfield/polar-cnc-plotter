// Calibrate: a guided tool panel that finds $101 (turn the platter once), the pen heights (lower
// until it touches), the platter center and $100 (cross a circle the pen drew), the center gap and
// the rotation direction, one step at a time. The slow moves run until Stop is pressed. Needs a
// connected plotter (the link sits in the connected status row). The math and the machine steps
// are exported for the tests.

import { placedToGcode } from './polar.js';
import { gcodeLines } from './grbl.js';
import { plausible, badAxes, refusal, jogFeed } from './safe.js';
export { parseSettings } from './grbl.js';

// ---------- math ----------
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;

// Platter: motor turns per platter turn = big / small. GRBL's "mm" on Y is one degree.
export function stepsPerDegree({ stepAngle, microsteps, small, big }) {
  if (!(stepAngle > 0 && microsteps > 0 && small > 0 && big > 0)) return NaN;
  return (360 / stepAngle) * microsteps * (big / small) / 360;
}

// Rail: GT2 belt on a pulley, one motor turn moves teeth × pitch mm.
export function stepsPerMM({ stepAngle, microsteps, teeth, pitch = 2 }) {
  if (!(stepAngle > 0 && microsteps > 0 && teeth > 0 && pitch > 0)) return NaN;
  return (360 / stepAngle) * microsteps / (teeth * pitch);
}

// Asked for `commanded`, got `actual`: scale the steps so the next move is right.
export function corrected(old, commanded, actual) {
  if (!(old > 0 && commanded > 0 && actual > 0)) return NaN;
  return old * commanded / actual;
}

// A platter sitting straight on its motor has an exact value: full steps × microsteps / 360.
// A measured value within `tol` of one is that one (stopping by eye is good to about 1 %).
export function snapDirect(v, tol = 0.02) {
  for (const full of [200, 400]) for (const micro of [1, 2, 4, 8, 16, 32, 64]) {
    const exact = full * micro / 360;
    if (Math.abs(v / exact - 1) <= tol) return r3(exact);
  }
  return null;
}

// A line through the center comes out as two parallel halves 2 × (real gap − gap setting) apart.
// sign = +1 or −1 (which side the pen line misses on; "Other side" flips it).
export function offsetFromGap(current, apart, sign = 1) {
  if (!(apart >= 0)) return NaN;
  return Math.round((current + sign * apart / 2) * 100) / 100;
}

// ---------- machine steps (also used by the tests) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Resolves with the status once the plotter stands still.
export async function waitIdle(grbl, alive = () => true) {
  for (;;) {
    await sleep(150);
    if (!alive()) throw new Error('Not connected.');
    const s = await grbl.nextStatus().catch(() => null);
    if (s?.state === 'Alarm') throw new Error('Alarm: unlock with $X in the Settings console.');
    if (s?.state === 'Idle') return s;
  }
}

// Slow moves that run until Stop. Speeds are in motor steps per second, so they are slow whatever
// $100-$102 say (at factory 250, "1 degree" is about 28 real ones). `max` = how far it goes if
// nobody presses Stop. `coast` = the steps it may take to stop: it keeps the speed down while
// GRBL's acceleration ($120-$122) is still at a low factory value.
export const SLOW = {
  X: { rate: 300, max: 12000, coast: 30 },
  Y: { rate: 107, max: 16000, coast: 16 },    // 3200 steps per turn -> half a minute a turn
  Z: { rate: 150, max: 4000, coast: 10 },
};
export function slowJog(axis, dir, spu, accel) {
  const { rate, max, coast } = SLOW[axis];
  if (!(spu > 0)) throw new Error('Could not read the settings.');
  const v = accel > 0 ? Math.min(rate, Math.sqrt(2 * accel * spu * coast)) : rate;
  const feed = v * 60 / spu;
  // GRBL runs nothing slower than 1 unit a minute: below that this move would not be slow
  if (feed < 1) throw new Error(`$${100 + 'XYZ'.indexOf(axis)} is far too high (${spu}).`);
  return `$J=G91 G21 ${axis}${(dir * max / spu).toFixed(3)} F${feed.toFixed(2)}`;
}

// The tool's short moves (nudges): their feed, but never more motor steps a second than this.
export const NUDGE = { X: 1000, Y: 400, Z: 400 };
export function nudgeJog(axis, dist, feed, spu) {
  return `$J=G91 G21 ${axis}${dist.toFixed(3)} F${jogFeed(axis, feed, spu, NUDGE[axis])}`;
}

// Steps per unit above EXTREME are not a measurement to correct, they are a mistake (a real
// plotter has a few hundred at most), and the slow moves could not be slow with them. Before a
// move the tool starts again from a plain value. Returns the steps per unit to work with.
export const EXTREME = 5000;
export const START = { 100: 100, 101: 8.889, 102: 250 };
export async function sane(grbl, n, spu) {
  if (!(spu >= 0)) throw new Error('Could not read the settings.');
  if (spu > 0 && spu <= EXTREME) return spu;
  await saveSetting(grbl, n, START[n], spu);
  return START[n];
}

// Stop a jog where it is (GRBL's jog cancel) and return the machine position it stopped at.
export async function stopJog(grbl, alive) {
  grbl.realtime('\x85');
  return (await waitIdle(grbl, alive)).mpos;
}

// GRBL counts steps, so new steps per unit change what every position reads. `old` = the value
// being replaced: with it, the work zero (the center) is put back on the same physical spot.
export async function saveSetting(grbl, n, value, old) {
  const no = refusal(n, value);                      // $100 / $101 no real plotter can have
  if (no) throw new Error(no);
  const v = +value.toFixed(3), a = n - 100;
  const keep = grbl.center && old > 0 && (a === 0 || a === 1);
  const was = keep ? (await grbl.nextStatus()).wpos[a] : 0;
  await grbl.send(`$${n}=${v.toFixed(3)}`);
  if (!keep) return;
  const now = was * old / v;
  await grbl.send(`G92 ${'XY'[a]}${now.toFixed(3)}`);
  grbl.center[a] = (await grbl.nextStatus()).mpos[a] - now;
}

// Stop a move that is under way (a circle, a test drawing) and lift the pen. GRBL's buffers are
// emptied; the center and the pen zero are put back.
export async function stopMove(grbl, penUp) {
  await grbl.stop();
  await grbl.send(`G90 G0 Z${penUp}`);
}

// Pen down, one turn and a bit, pen up. Returns the machine X the circle was drawn at.
export async function drawCircle(grbl, { penUp, penDown }, spu, alive) {
  await grbl.send(`G90 G0 Z${penDown}`);
  await grbl.send(`G94 G91 G1 Y370 F${(400 * 60 / spu).toFixed(1)}`);   // 400 steps a second
  await grbl.send('G90');
  await grbl.send(`G0 Z${penUp}`);
  return (await waitIdle(grbl, alive)).mpos[0];
}

// The pen crossed its circle at machine X `a` and `b`: the center is halfway. Go there, zero it.
export async function centerBetween(grbl, a, b, penUp, alive) {
  await grbl.send(`G90 G0 Z${penUp}`);
  const d = (a + b) / 2 - (await waitIdle(grbl, alive)).mpos[0];
  if (Math.abs(d) >= 0.001) {
    await grbl.send(`G91 G0 X${d.toFixed(3)}`);
    await grbl.send('G90');
    await waitIdle(grbl, alive);
  }
  await grbl.setCenter();
}

// The pen is at its up height now and touched the paper at machine Z `down`. Work Z0 = here, so
// the heights still fit next time as long as the pen is left up. Returns the settings to save.
export async function penHeights(grbl, down) {
  await grbl.setPenZero();
  return { penUp: 0, penDown: r2(down - grbl.penZero) };
}

// Test drawings in platter mm: a line through the center (turned `angle` degrees), and an "F".
export function centerLine(angle = 0, r = 40) {
  const a = angle * Math.PI / 180, c = Math.cos(a) * r, s = Math.sin(a) * r;
  return [[[-c, -s], [c, s]]];
}
export function letterF() {
  return [[[25, 10], [25, 40], [45, 40]], [[25, 25], [38, 25]]];
}

// ---------- the panel ----------
const STEPS = 6;
const opts = (list, on) => list.map(v => `<option${v === on ? ' selected' : ''}>${v}</option>`).join('');

const HTML = `
<div class="calstep" data-n="1">
  <h3>Current settings</h3>
  <div class="calvals">
    <span>Rail $100</span><b id="calV100">…</b><span class="unit">steps/mm</span>
    <span>Platter $101</span><b id="calV101">…</b><span class="unit">steps/°</span>
  </div>
  <button class="link" type="button" data-act="calc">Work it out from the parts</button>
  <div id="calCalc" hidden>
    <div class="grid">
      <label><span class="lbl">Step angle</span><select id="calAngle">${opts(['1.8', '0.9', '3.75', '7.5'], '1.8')}</select></label>
      <label><span class="lbl">Microsteps</span><select id="calMicro">${opts(['1', '2', '4', '8', '16', '32', '64'], '16')}</select></label>
      <label><span class="lbl">Small gear <span class="unit">teeth</span></span><input type="number" id="calSmall" min="1" step="1"></label>
      <label><span class="lbl">Big gear <span class="unit">teeth</span></span><input type="number" id="calBig" min="1" step="1"></label>
      <label><span class="lbl">Rail pulley <span class="unit">teeth</span> <button class="q" type="button" data-q="calPulleyHelp" aria-label="What is this?">?</button></span><input type="number" id="calTeeth" min="1" step="1"></label>
    </div>
    <p class="help" id="calPulleyHelp" hidden>GT2 belt, 2 mm per tooth. Gears are the platter drive.</p>
    <div class="calres"><span>$101 <b id="calC101">–</b></span><button class="btn sm end" data-act="use101" disabled>Use</button></div>
    <div class="calres"><span>$100 <b id="calC100">–</b></span><button class="btn sm end" data-act="use100" disabled>Use</button></div>
  </div>
</div>

<div class="calstep" data-n="2" hidden>
  <h3>Turn test <button class="q" type="button" data-q="calTurnHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calTurnHelp" hidden>One full turn shows how many motor steps make 360°. A result within 2 % of a plain motor's exact value is rounded to it.</p>
  <p class="calsay">Tape a mark on the platter edge, lined up with something fixed.</p>
  <button class="btn" data-act="turn">Turn slowly</button>
  <div class="calres"><button class="btn sm" data-act="turnBack">Back</button><button class="btn sm" data-act="turnMore">Further</button>
    <span class="seg" id="calTurnStep"><button data-step="0.5">0.5°</button><button data-step="2" class="on">2°</button><button data-step="10">10°</button></span></div>
  <div class="calres"><span>New $101 <b id="calNew101">–</b></span><span class="unit" id="calRaw101"></span><button class="btn sm end" data-act="save101" disabled>Save</button></div>
</div>

<div class="calstep" data-n="3" hidden>
  <h3>Pen heights <button class="q" type="button" data-q="calPenHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calPenHelp" hidden>The heights are counted from where the pen rests, so leave it up. Do this step again after changing the pen.</p>
  <p class="calsay">Lower until the tip touches the paper. Then raise it clear.</p>
  <div class="row"><button class="btn wide" data-act="lower">Lower slowly</button><button class="btn wide" data-act="raise">Raise slowly</button></div>
  <div class="calres"><span>Pen at</span><b class="calz" id="calZ">–</b>
    <button class="btn sm" data-act="zUp" aria-label="Raise pen">▲</button><button class="btn sm" data-act="zDown" aria-label="Lower pen">▼</button>
    <span class="seg" id="calZStep"><button data-step="0.1">0.1</button><button data-step="0.5" class="on">0.5</button><button data-step="1">1</button></span></div>
  <label class="switch"><input type="checkbox" id="calZFlip"><span></span>Reverse direction</label>
  <p class="calsay" id="calPens"></p>
</div>

<div class="calstep" data-n="4" hidden>
  <h3>Find center <button class="q" type="button" data-q="calFindHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calFindHelp" hidden>The pen draws a circle, then crosses it. Halfway between the two crossings is the platter center. The ruler sets $100.</p>
  <p class="calsay">Jog the pen halfway out, away from the rail motor.</p>
  <div class="calres"><button class="btn sm" data-act="xIn">In</button><button class="btn sm" data-act="xOut">Out</button>
    <span class="seg" id="calXStep"><button data-step="0.1">0.1</button><button data-step="1" class="on">1</button><button data-step="10">10</button></span></div>
  <div class="row"><button class="btn wide" data-act="circle">Draw circle</button><button class="btn wide" data-act="cross">Cross slowly</button></div>
  <div class="calres"><span>Plotter says <b id="calAcross">–</b> mm</span><button class="btn sm end" data-act="center">Set center</button></div>
  <div class="calres"><span>Ruler says</span><input type="number" id="calRuler" min="1" step="0.5" aria-label="The circle measures, mm"><span>mm</span></div>
  <div class="calres"><span>New $100 <b id="calNew100">–</b></span><button class="btn sm end" data-act="save100" disabled>Save</button></div>
  <label class="switch" id="calXFlipRow" hidden><input type="checkbox" id="calXFlip"><span></span>Reverse direction</label>
</div>

<div class="calstep" data-n="5" hidden>
  <h3>Center gap <button class="q" type="button" data-q="calGapHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calGapHelp" hidden>A line through the center should be one straight line. Two offset halves mean the gap setting is off.</p>
  <p class="calsay">Draws a line through the center. Is it one straight line?</p>
  <button class="btn" data-act="drawLine">Draw test</button>
  <div class="calres"><span>Halves apart</span><input type="number" id="calApart" min="0" step="0.1" aria-label="Halves apart, mm"><span>mm</span></div>
  <label class="switch"><input type="checkbox" id="calSide"><span></span>Other side</label>
  <div class="calres"><span>New gap <b id="calNewGap">–</b></span><button class="btn sm end" data-act="saveGap" disabled>Save</button></div>
</div>

<div class="calstep" data-n="6" hidden>
  <h3>Mirror check</h3>
  <p class="calsay">Draws a small F. Does it read the right way?</p>
  <button class="btn" data-act="drawF">Draw F</button>
  <div class="row"><button class="btn wide" data-act="fOk">Reads right</button><button class="btn wide" data-act="fBad">Mirrored</button></div>
</div>

<p class="calsay" id="calMsg"></p>
<p class="err" id="calErr" role="alert"></p>
<div class="calnav"><button class="btn" data-act="back">Back</button><span id="calCount"></span><button class="btn" data-act="next">Next</button></div>`;

export function initCalibrate(api) {
  const m = api.machine;
  const root = document.getElementById('calTool');
  const link = document.getElementById('calOpen');
  if (!m || !root || !link) return;
  root.insertAdjacentHTML('beforeend', HTML);
  const $ = id => document.getElementById(id);
  const num = id => parseFloat($(id).value);

  let step = 1, busy = false, grbl = null, vals = {}, zTimer = 0, lineTurn = 0, fDrawn = false;
  let slow = null;    // { act, stopping } while a slow move runs
  let job = null;     // { act, stopped } while a move with a Stop runs (circle, set center, drawings)
  let turn = null;    // { from, at }: platter machine position when the turn began / where it is now
  let pen = null;     // { down, up }: machine Z where the tip touched / where it was raised to
  let ring = null;    // { a, b }: machine X the circle was drawn at / where the pen crossed it again
  let zFlip = false;  // Z+ lowers the pen
  const msg = t => { $('calMsg').textContent = t; };
  const err = t => { $('calErr').textContent = t; };
  const alive = () => grbl && m.getGrbl() === grbl;
  const fmt = v => Number.isFinite(v) ? v.toFixed(3) : '–';

  // settings changed from here: keep the Settings sheet's inputs in step
  function setSettings(patch) {
    api.setSettings(patch);
    for (const [k, v] of Object.entries(patch)) {
      const el = $(k);
      if (el?.type === 'checkbox') el.checked = !!v; else if (el) el.value = v;
    }
  }

  // ---------- the slow moves: the same button starts and stops ----------
  const SLOWS = {
    turn: { axis: 'Y', label: 'Turn slowly', dir: () => 1, go: 'Stop when the mark comes back around.',
      done(at, from) { turn = { from, at }; msg('Nudge until the mark lines up, then Save.'); } },
    lower: { axis: 'Z', label: 'Lower slowly', dir: () => zFlip ? 1 : -1, go: 'Stop when the tip touches the paper.',
      done(at) { pen = { down: at }; msg('Now raise it clear of the paper.'); } },
    raise: { axis: 'Z', label: 'Raise slowly', dir: () => zFlip ? -1 : 1, go: 'Stop when the tip is clear of the paper.',
      done: () => penSet() },
    cross: { axis: 'X', label: 'Cross slowly', dir: () => -1, go: 'Stop when the pen is over the line on the far side.',
      done(at) { ring.b = at; msg('Nudge onto the line, then Set center.'); } },
  };
  async function slowGo(act) {
    if (slow?.act === act) {                           // second press: Stop
      if (!slow.stopping) { slow.stopping = true; grbl.realtime('\x85'); refresh(); }
      return;
    }
    if (busy || slow || !alive()) return;
    const d = SLOWS[act], i = 'XYZ'.indexOf(d.axis), g = grbl, me = slow = { act, stopping: false };
    const mine = () => slow === me && m.getGrbl() === g;
    err(''); msg(d.go); refresh();
    try {
      const reset = await fit(g, d.axis);
      if (reset) msg(`${reset} ${d.go}`);
      const from = (await g.nextStatus()).mpos[i];
      await g.send(slowJog(d.axis, d.dir(), vals[100 + i], vals[120 + i]));
      while (mine() && !me.stopping) {
        await sleep(200);
        const s = await g.nextStatus();
        if (s.state === 'Idle' || s.state === 'Alarm') break;
      }
      if (!mine()) return;                             // the tool was closed (that cancels the move)
      const at = (await stopJog(g, mine))[i];          // Stop pressed before the move began: cancel again
      if (me.stopping) await d.done(at, from); else msg('It stopped by itself. Try again.');
    } catch (e) { if (slow === me) err(e.message); }
    if (slow === me) { slow = null; refresh(); }
  }
  async function penSet() {
    const s = await penHeights(grbl, pen.down);
    pen.up = grbl.penZero;
    setSettings(s);
    msg('Pen heights saved.');
  }

  // ---------- state shown ----------
  function refresh() {
    root.querySelectorAll('.calstep').forEach(s => { s.hidden = +s.dataset.n !== step; });
    $('calCount').textContent = `Step ${step} of ${STEPS}`;
    $('calV100').textContent = fmt(vals[100]);
    $('calV101').textContent = fmt(vals[101]);
    for (const n of [100, 101]) $('calV' + n).classList.toggle('bad', n in vals && !plausible(n, vals[n]));
    // calculator
    const a = +$('calAngle').value, ms = +$('calMicro').value;
    const c101 = stepsPerDegree({ stepAngle: a, microsteps: ms, small: num('calSmall'), big: num('calBig') });
    const c100 = stepsPerMM({ stepAngle: a, microsteps: ms, teeth: num('calTeeth') });
    $('calC101').textContent = fmt(c101); $('calC100').textContent = fmt(c100);
    // tests
    const raw101 = turn ? corrected(vals[101], Math.abs(turn.at - turn.from), 360) : NaN;
    const exact = snapDirect(raw101);
    const n101 = exact ?? raw101;
    $('calNew101').textContent = fmt(n101);
    $('calRaw101').textContent = exact ? `measured ${raw101.toFixed(3)}` : '';
    const across = ring?.b === undefined ? NaN : Math.abs(ring.b - ring.a);
    const n100 = corrected(vals[100], across, num('calRuler'));
    $('calAcross').textContent = Number.isFinite(across) ? across.toFixed(1) : '–';
    $('calNew100').textContent = fmt(n100);
    const s = api.getSettings();
    const gap = offsetFromGap(s.offset, num('calApart'), $('calSide').checked ? -1 : 1);
    $('calNewGap').textContent = Number.isFinite(gap) ? gap + ' mm' : '–';
    $('calPens').textContent = `Saved: up ${s.penUp} · down ${s.penDown}`;
    $('calZFlip').checked = zFlip;
    $('calXFlipRow').hidden = !Number.isFinite(vals[3]);      // the pretend plotters have no $3
    $('calXFlip').checked = !!(vals[3] & 1);
    // enabled?
    const need = { use101: c101, use100: c100, save101: n101, save100: n100, saveGap: gap,
      turnBack: raw101, turnMore: raw101, raise: pen ? 1 : NaN, cross: ring ? 1 : NaN, center: across };
    root.querySelectorAll('[data-act]').forEach(b => {
      const act = b.dataset.act;
      if (act === 'calc') return;
      const stop = slow?.act === act;
      b.disabled = act === 'back' ? !!slow || !!job || step === 1 : act === 'next' ? !!slow || !!job || step === STEPS
        : stop ? slow.stopping : job?.act === act ? !!job.stopped
        : busy || !!slow || !alive() || (act in need && !Number.isFinite(need[act]));
      if (SLOWS[act]) b.textContent = stop ? 'Stop' : SLOWS[act].label;
    });
    root.querySelectorAll('.switch input').forEach(i => { i.disabled = busy || !!slow; });
    const label = { circle: ring ? 'Draw again' : 'Draw circle', center: 'Set center',
      drawLine: lineTurn ? 'Draw again' : 'Draw test', drawF: fDrawn ? 'Draw again' : 'Draw F' };
    for (const [act, text] of Object.entries(label)) root.querySelector(`[data-act=${act}]`).textContent = job?.act === act ? 'Stop' : text;
  }
  function showZ() {
    const z = alive() ? grbl.status?.wpos?.[2] : undefined;
    $('calZ').textContent = Number.isFinite(z) ? z.toFixed(1) : '–';
  }

  // ---------- running things on the plotter ----------
  // `act` = the button that started it: while it runs, that button is Stop (see stopRun).
  // fn(grbl, live): live() is alive(), and throws once Stop was pressed.
  async function run(fn, done, act) {
    if (busy || slow) return;
    if (!alive()) { err('Not connected.'); return; }
    const me = { act, stopped: null };
    busy = true; job = act ? me : null; err(''); msg(''); refresh();
    const live = () => { if (me.stopped) throw new Error('Stopped.'); return alive(); };
    try { await fn(grbl, live); if (done && !me.stopped) msg(done); } catch (e) { if (!me.stopped) err(e.message); }
    await me.stopped;
    busy = false; job = null; refresh();
  }
  // Stop the circle / drawing / move to the center where it is, and lift the pen.
  function stopRun() {
    if (!job || job.stopped) return;
    job.stopped = stopMove(grbl, api.getSettings().penUp).then(() => msg('Stopped.'), e => err(e.message));
    refresh();
  }
  async function read() {
    try { vals = { ...vals, ...await grbl.readSettings() }; }
    catch (e) { err('Could not read settings: ' + e.message); }
    const bad = badAxes(vals);
    if (bad.includes('Y')) err('Platter steps look wrong. Do the turn test (step 2).');
    else if (bad.length) err('Rail steps look wrong. Measure them in step 4.');
    refresh();
  }
  // Steps per unit far beyond any real plotter: start again from a plain value (see sane()).
  // Returns what to tell the user, '' when nothing was changed.
  async function fit(g, axis) {
    const n = 100 + 'XYZ'.indexOf(axis), was = vals[n];
    vals[n] = await sane(g, n, was);
    if (vals[n] === was) return '';
    if (n === 101) turn = null;
    if (n === 100) ring = null;
    await m.check();
    return `$${n} was ${was}: reset to ${vals[n]}.`;
  }
  // $100 / $101: what was measured in the old units is rescaled or dropped
  const save = (n, v) => run(async g => {
    const old = vals[n];
    await saveSetting(g, n, v, old);
    vals[n] = r3(v);
    if (n === 101) turn = null;
    if (n === 100) { if (ring) for (const k in ring) ring[k] *= old / vals[n]; $('calRuler').value = ''; }
    await m.check();
  }, `Saved $${n}=${v.toFixed(3)}.`);
  const draw = (strokes, act) => run(async g => {
    if (badAxes(vals).length) throw new Error('Rail or platter steps look wrong. Do steps 2 and 4 first.');
    if (!g.center) throw new Error('Find the center first (step 4).');
    await g.stream(gcodeLines(placedToGcode(strokes, api.getSettings()).gcode));
  }, '', act);
  const segStep = id => +$(id).querySelector('.on').dataset.step;
  // a short move, then `then(machine position)` once it has stopped
  const nudge = (axis, d, feed, then) => run(async g => {
    const reset = await fit(g, axis);
    if (reset) throw new Error(`${reset} Try again.`);
    await g.send(nudgeJog(axis, d, feed, vals[100 + 'XYZ'.indexOf(axis)]));
    const s = await waitIdle(g, alive);
    await then?.(s.mpos);
  });
  // degrees on the dial, in the plotter's present units: the turn so far is 360°
  const turnNudge = dir => nudge('Y', dir * segStep('calTurnStep') * Math.abs(turn.at - turn.from) / 360, 300, p => { turn.at = p[1]; });
  const zNudge = dir => nudge('Z', (zFlip ? -dir : dir) * segStep('calZStep'), 200, p => {
    if (pen?.up !== undefined) return penSet();        // heights are set: this moves the up height
    if (pen) pen.down = p[2];
  });
  const xNudge = dir => nudge('X', dir * segStep('calXStep'), 1000, p => { if (ring?.b !== undefined) ring.b = p[0]; });

  const acts = {
    calc: () => { $('calCalc').hidden = !$('calCalc').hidden; },
    use101: () => save(101, stepsPerDegree({ stepAngle: +$('calAngle').value, microsteps: +$('calMicro').value, small: num('calSmall'), big: num('calBig') })),
    use100: () => save(100, stepsPerMM({ stepAngle: +$('calAngle').value, microsteps: +$('calMicro').value, teeth: num('calTeeth') })),
    turn: () => slowGo('turn'), lower: () => slowGo('lower'), raise: () => slowGo('raise'), cross: () => slowGo('cross'),
    turnBack: () => turnNudge(-1), turnMore: () => turnNudge(1),
    save101: () => { const raw = corrected(vals[101], Math.abs(turn.at - turn.from), 360); save(101, snapDirect(raw) ?? raw); },
    zUp: () => zNudge(1), zDown: () => zNudge(-1),
    xIn: () => xNudge(-1), xOut: () => xNudge(1),
    circle: () => run(async (g, live) => {
      if (!plausible(101, vals[101])) throw new Error('Do the turn test first (step 2).');
      ring = null; ring = { a: await drawCircle(g, api.getSettings(), vals[101], live) };
    }, 'Now cross to the far side of the circle.', 'circle'),
    center: () => run(async (g, live) => { await centerBetween(g, ring.a, ring.b, api.getSettings().penUp, live); m.refresh(); }, 'Center set. The pen is over it.', 'center'),
    save100: () => save(100, corrected(vals[100], Math.abs(ring.b - ring.a), num('calRuler'))),
    drawLine: () => { const a = lineTurn * 30; lineTurn++; draw(centerLine(a), 'drawLine').then(() => refresh()); },
    saveGap: () => {
      const gap = offsetFromGap(api.getSettings().offset, num('calApart'), $('calSide').checked ? -1 : 1);
      setSettings({ offset: gap }); $('calApart').value = ''; msg(`Gap saved: ${gap} mm. Draw again to check.`); refresh();
    },
    drawF: () => { fDrawn = true; draw(letterF(), 'drawF'); },
    fOk: () => msg('Rotation is right.'),
    fBad: () => { const f = !api.getSettings().flip; setSettings({ flip: f }); msg(`Reverse rotation ${f ? 'on' : 'off'}. Draw again to check.`); },
    back: () => go(step - 1), next: () => go(step + 1),
  };
  function go(n) {
    if (slow) return;
    step = Math.max(1, Math.min(STEPS, n));
    msg(''); err('');
    refresh();
  }

  root.addEventListener('click', e => {
    const q = e.target.closest('.q');
    if (q) { e.preventDefault(); const h = $(q.dataset.q); h.hidden = !h.hidden; return; }
    const seg = e.target.closest('.seg button');
    if (seg) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg)); return; }
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && job?.act === b.dataset.act) { stopRun(); return; }
    if (b && !b.disabled) acts[b.dataset.act]?.();
  });
  root.addEventListener('input', () => refresh());
  // (the panel's `input` listener has already redrawn the box by now, so don't read its state)
  $('calZFlip').addEventListener('change', () => { zFlip = !zFlip; pen = null; msg('Lower the pen again.'); refresh(); });
  // the rail runs the wrong way: flip its bit in GRBL's direction mask. Every position is off after that.
  $('calXFlip').addEventListener('change', () => run(async g => {
    const v = vals[3] ^ 1;
    await g.send(`$3=${v}`);
    vals[3] = v; ring = null; g.center = null;
    m.refresh();
  }, 'Rail direction reversed.'));

  link.addEventListener('click', async () => {
    const { openTool } = await import('./tool.js');   // tool.js needs a page; the tests import this file without one
    grbl = m.getGrbl();
    if (!grbl) return;
    step = 1; vals = {}; lineTurn = 0; fDrawn = false; turn = pen = ring = slow = job = null;
    const s = api.getSettings();
    zFlip = s.penUp < s.penDown;
    msg(''); err('');
    openTool('calTool', () => {
      clearInterval(zTimer);
      if (slow) grbl?.realtime('\x85');               // never leave a slow move running
      stopRun();                                       // …or a circle or a drawing
      slow = null; grbl = null;
    });
    refresh();
    read();
    clearInterval(zTimer);
    zTimer = setInterval(() => { showZ(); if (!alive() && !busy) { err('Not connected.'); refresh(); } }, 250);
  });
}
