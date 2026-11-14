// Calibrate: a guided tool panel, one step at a time. The platter's steps ($101: turn it once, then
// Test a full turn), the pen height (click down to the paper), the carriage's steps ($100: draw a
// line and measure it), the platter center (cross a circle the pen drew), the center gap and the
// rotation direction. The slow moves stop when their button is pressed again. Needs a connected
// plotter (the link sits in the connected status row). The math and the machine steps are
// exported for the tests.

import { placedToGcode } from './polar.js';
import { gcodeLines } from './grbl.js';
import { plausible, badAxes, refusal, jogFeed } from './safe.js';
export { parseSettings } from './grbl.js';

// ---------- math ----------
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;

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

// New $101 from a turn the plotter counted as `moved` degrees and that was really 360. After the
// slow turn a value near a plain motor's exact one becomes that one. After Test (`tested`) it is
// taken as measured: the saved value was just seen to miss, so rounding back to it would be wrong.
export function turnSteps(old, moved, tested = false) {
  const raw = corrected(old, moved, 360);
  return tested ? raw : snapDirect(raw) ?? raw;
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
// $100 / $101 say (at factory 250, "1 degree" is about 28 real ones). `max` = how far it goes if
// nobody presses Stop. `coast` = the steps it may take to stop: it keeps the speed down while
// GRBL's acceleration ($120 / $121) is still at a low factory value.
export const SLOW = {
  X: { rate: 300, max: 12000, coast: 30 },
  Y: { rate: 107, max: 16000, coast: 16 },    // 3200 steps per turn -> half a minute a turn
};
export function slowJog(axis, dir, spu, accel, max = SLOW[axis].max) {
  const { rate, coast } = SLOW[axis];
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

// Test, after the turn test: one full turn by the plotter's own count, at the nudges' step rate.
export const fullTurn = spu => nudgeJog('Y', 360, Infinity, spu);

// The carriage test's line: this many motor steps (50 mm at 40 steps per mm), so it stays short
// whatever $100 says. It may be stopped early; either way its length is what the ruler checks.
export const LINE = 2000;

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

// GRBL's direction mask ($3): bit 0 = carriage, 1 = platter, 2 = pen. Make `bit` match `on`.
// Returns the mask now in force. A plotter that reports no $3 (the pretend ones) is left alone.
export async function setDirection(grbl, mask, bit, on) {
  if (!Number.isFinite(mask)) return mask;
  const want = on ? mask | (1 << bit) : mask & ~(1 << bit);
  if (want !== mask) await grbl.send(`$3=${want}`);
  return want;
}

// Pen heights saved while Z+ still lowered the pen (up below down): the same two heights now
// that Z+ lifts it. null when they are already that way round.
export const uprightPen = s => s.penUp < s.penDown ? { penUp: 0 - s.penUp, penDown: 0 - s.penDown } : null;

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

// The tip touches the paper right now: that is pen down. Lift it LIFT motor steps (about 2 mm on
// a DVD-drive stage at 250 steps per unit; in steps because $102 is never calibrated) and call
// that pen up. Returns the settings to save.
export const LIFT = 100;
export async function touchLift(grbl, spu, alive) {
  const down = (await waitIdle(grbl, alive)).mpos[2];
  await grbl.send(nudgeJog('Z', LIFT / spu, 200, spu));
  await waitIdle(grbl, alive);
  return penHeights(grbl, down);
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
const xJog = `<div class="calres"><button class="btn sm" data-act="xIn">In</button><button class="btn sm" data-act="xOut">Out</button>
    <span class="seg xstep"><button data-step="0.1">0.1</button><button data-step="1" class="on">1</button><button data-step="10">10</button></span></div>`;

const HTML = `
<div class="calstep" data-n="1">
  <h3>Turn test <button class="q" type="button" data-q="calTurnHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calTurnHelp" hidden>One full turn shows how many motor steps make 360°. Test then turns what the plotter counts as one turn. A result within 2 % of a plain motor's exact value is rounded to it.</p>
  <p class="calsay">Tape a mark on the platter edge, lined up with something fixed.</p>
  <div class="row"><button class="btn wide" data-act="turn">Turn slowly</button><button class="btn wide" data-act="turnTest">Test</button></div>
  <div class="calres"><button class="btn sm" data-act="turnBack">Back</button><button class="btn sm" data-act="turnMore">Further</button>
    <span class="seg tstep"><button data-step="0.5">0.5°</button><button data-step="2" class="on">2°</button><button data-step="10">10°</button></span></div>
  <div class="calres"><span>New $101 <b id="calNew101">–</b></span><span class="unit" id="calRaw101"></span><button class="btn sm end" data-act="save101" disabled>Save</button></div>
</div>

<div class="calstep" data-n="2" hidden>
  <h3>Pen height <button class="q" type="button" data-q="calPenHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calPenHelp" hidden>Touching saves that height as pen down, then lifts the pen a little for travel. The heights are counted from where the pen rests, so leave it up. Do this step again after changing the pen.</p>
  <p class="calsay">Click Down until the tip just touches the paper.</p>
  <div class="row"><button class="btn wide" data-act="zUp">Up</button><button class="btn wide" data-act="zDown">Down</button></div>
  <div class="calres"><span>Pen at</span><b class="calz" id="calZ">–</b>
    <span class="seg zstep"><button data-step="0.02">0.02</button><button data-step="0.1" class="on">0.1</button><button data-step="0.5">0.5</button></span></div>
  <button class="btn" data-act="touch">Touching</button>
  <label class="switch" id="calZFlipRow" hidden><input type="checkbox" id="calZFlip"><span></span>Reverse direction</label>
  <p class="calsay" id="calPens"></p>
</div>

<div class="calstep" data-n="3" hidden>
  <h3>Carriage test <button class="q" type="button" data-q="calLineHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calLineHelp" hidden>The pen draws a short line toward the center. A ruler on it shows how far the carriage really moved, which sets $100.</p>
  <p class="calsay">1. Jog the pen out near the platter edge.</p>
  ${xJog}
  <p class="calsay">2. Draw a line. Measure it with a ruler.</p>
  <div class="calres"><button class="btn sm" data-act="line">Draw line</button><span class="end">Plotter says <b id="calLine">–</b> mm</span></div>
  <div class="calres"><span>Ruler says</span><input type="number" id="calRuler" min="1" step="0.5" aria-label="The line measures, mm"><span>mm</span></div>
  <div class="calres"><span>New $100 <b id="calNew100">–</b></span><button class="btn sm end" data-act="save100" disabled>Save</button></div>
  <label class="switch" id="calXFlipRow" hidden><input type="checkbox" id="calXFlip"><span></span>Reverse direction</label>
</div>

<div class="calstep" data-n="4" hidden>
  <h3>Find center <button class="q" type="button" data-q="calFindHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calFindHelp" hidden>The pen draws a circle, then crosses it. The platter center is halfway between the two sides of the circle.</p>
  <p class="calsay">1. Jog the pen about halfway out.</p>
  ${xJog}
  <p class="calsay">2. Draw a circle.</p>
  <button class="btn" data-act="circle">Draw circle</button>
  <p class="calsay">3. Cross it. Stop with the pen over the far side.</p>
  <button class="btn" data-act="cross">Cross slowly</button>
  <p class="calsay">4. Nudge onto the line with In or Out.</p>
  <button class="btn" data-act="center">Set center</button>
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
  let turn = null;    // { from, at, tested }: platter machine position when the turn began / where it is now
  let line = null;    // { a, b }: machine X where the carriage test's line begins / ends
  let ring = null;    // { a, b }: machine X the circle was drawn at / where the pen crossed it again
  const msg = t => { $('calMsg').textContent = t; };
  const err = t => { $('calErr').textContent = t; };
  const alive = () => grbl && m.getGrbl() === grbl;
  const fmt = v => Number.isFinite(v) ? v.toFixed(3) : '–';
  const same = (a, b) => Math.abs(a - b) < 0.0005;
  const penTo = async (g, live, k) => { await g.send(`G90 G0 Z${api.getSettings()[k]}`); await waitIdle(g, live); };

  // ---------- the slow moves: the same button starts and stops ----------
  // done(at, from): Stop was pressed. end(at, from): the move ran out by itself (without an `end`
  // that is a failure). pre / post: before and after the move (pen down, pen up).
  function lineDone(at, from) {
    if (Math.abs(at - from) * vals[100] < 200) { line = null; msg('Too short to measure. Draw again.'); return; }
    line = { a: from, b: at };
    msg('Measure the line, then type it in.');
  }
  const SLOWS = {
    turn: { axis: 'Y', label: 'Turn slowly', go: 'Stop when the mark comes back around.',
      done(at, from) { turn = { from, at }; msg('Nudge until the mark lines up, then Save.'); } },
    turnTest: { axis: 'Y', label: 'Test', go: 'Turning one full circle.', cmd: () => fullTurn(vals[101]),
      ok: () => plausible(101, vals[101]) ? '' : 'Do the turn test first.',
      done() { turn = null; msg('Stopped.'); },
      end(at, from) { turn = { from, at, tested: true }; msg('Mark lined up? Done. If not, nudge to it and Save.'); } },
    line: { axis: 'X', label: 'Draw line', dir: -1, max: LINE, go: 'Drawing a line toward the center.',
      pre: (g, live) => penTo(g, live, 'penDown'), post: (g, live) => penTo(g, live, 'penUp'),
      done: lineDone, end: lineDone },
    cross: { axis: 'X', label: 'Cross slowly', dir: -1, go: 'Stop when the pen is over the far side of the circle.',
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
    let lowered = false;
    err(''); msg(d.go); refresh();
    try {
      const no = d.ok?.();
      if (no) throw new Error(no);
      const reset = await fit(g, d.axis);
      if (reset) msg(`${reset} ${d.go}`);
      if (d.pre) { lowered = true; await d.pre(g, mine); }
      const from = (await g.nextStatus()).mpos[i];
      await g.send(d.cmd ? d.cmd() : slowJog(d.axis, d.dir ?? 1, vals[100 + i], vals[120 + i], d.max));
      while (mine() && !me.stopping) {
        await sleep(200);
        const s = await g.nextStatus();
        if (s.state === 'Idle' || s.state === 'Alarm') break;
      }
      if (!mine()) return;                             // the tool was closed (that cancels the move)
      const at = (await stopJog(g, mine))[i];          // Stop pressed before the move began: cancel again
      if (d.post) { await d.post(g, mine); lowered = false; }
      if (me.stopping) await d.done(at, from); else if (d.end) await d.end(at, from); else msg('It stopped by itself. Try again.');
    } catch (e) {
      if (slow === me) { err(e.message); if (lowered) d.post(g, mine).catch(() => {}); }
    }
    if (slow === me) { slow = null; refresh(); }
  }

  // ---------- state shown ----------
  function refresh() {
    root.querySelectorAll('.calstep').forEach(s => { s.hidden = +s.dataset.n !== step; });
    $('calCount').textContent = `Step ${step} of ${STEPS}`;
    const s = api.getSettings();
    // turn test
    const moved = turn ? Math.abs(turn.at - turn.from) : NaN;
    const raw101 = corrected(vals[101], moved, 360);
    const n101 = turnSteps(vals[101], moved, turn?.tested);
    $('calNew101').textContent = fmt(n101);
    $('calRaw101').textContent = Number.isFinite(n101) && !same(n101, raw101) ? `measured ${raw101.toFixed(3)}` : '';
    // carriage test
    const drawn = line ? Math.abs(line.b - line.a) : NaN;
    const n100 = corrected(vals[100], drawn, num('calRuler'));
    $('calLine').textContent = Number.isFinite(drawn) ? drawn.toFixed(1) : '–';
    $('calNew100').textContent = fmt(n100);
    const gap = offsetFromGap(s.offset, num('calApart'), $('calSide').checked ? -1 : 1);
    $('calNewGap').textContent = Number.isFinite(gap) ? gap + ' mm' : '–';
    $('calPens').textContent = `Saved: up ${s.penUp} · down ${s.penDown}`;
    $('calZFlipRow').hidden = $('calXFlipRow').hidden = !Number.isFinite(vals[3]);   // the pretend plotters have no $3
    $('calZFlip').checked = s.zFlip !== false;
    $('calXFlip').checked = !!(vals[3] & 1);
    // enabled?
    const need = { save101: same(n101, vals[101]) ? NaN : n101, save100: n100, saveGap: gap,
      turnBack: raw101, turnMore: raw101, turnTest: plausible(101, vals[101]) ? 1 : NaN,
      cross: ring ? 1 : NaN, center: ring?.b === undefined ? NaN : 1 };
    root.querySelectorAll('[data-act]').forEach(b => {
      const act = b.dataset.act;
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
    $('calZ').textContent = Number.isFinite(z) ? z.toFixed(2) : '–';
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
    if (bad.includes('Y')) err('Platter steps look wrong. Do the turn test.');
    else if (bad.length) err('Carriage steps look wrong. Do the carriage test.');
    refresh();
  }
  // Steps per unit far beyond any real plotter: start again from a plain value (see sane()).
  // Returns what to tell the user, '' when nothing was changed.
  async function fit(g, axis) {
    const n = 100 + 'XYZ'.indexOf(axis), was = vals[n];
    vals[n] = await sane(g, n, was);
    if (vals[n] === was) return '';
    if (n === 101) turn = null;
    if (n === 100) ring = line = null;
    await m.check();
    return `$${n} was ${was}: reset to ${vals[n]}.`;
  }
  // $100 / $101: what was measured in the old units is rescaled or dropped
  const save = (n, v, then) => run(async g => {
    const old = vals[n];
    await saveSetting(g, n, v, old);
    vals[n] = r3(v);
    if (n === 101) turn = null;
    if (n === 100) { line = null; if (ring) for (const k in ring) ring[k] *= old / vals[n]; $('calRuler').value = ''; }
    await m.check();
  }, `Saved $${n}=${v.toFixed(3)}. ${then}`);
  const draw = (strokes, act) => run(async g => {
    if (badAxes(vals).length) throw new Error('Do the turn test and the carriage test first.');
    if (!g.center) throw new Error('Find the center first.');
    await g.stream(gcodeLines(placedToGcode(strokes, api.getSettings()).gcode));
  }, '', act);
  // the step size picked in the step on screen
  const segStep = cls => +root.querySelector(`.calstep[data-n="${step}"] .${cls} .on`).dataset.step;
  // a short move, then `then(machine position)` once it has stopped
  const nudge = (axis, d, feed, then) => run(async g => {
    const reset = await fit(g, axis);
    if (reset) throw new Error(`${reset} Try again.`);
    await g.send(nudgeJog(axis, d, feed, vals[100 + 'XYZ'.indexOf(axis)]));
    const s = await waitIdle(g, alive);
    await then?.(s.mpos);
  });
  // degrees on the dial, in the plotter's present units: the turn so far is 360°
  const turnNudge = dir => nudge('Y', dir * segStep('tstep') * Math.abs(turn.at - turn.from) / 360, 300, p => { turn.at = p[1]; });
  const zNudge = dir => nudge('Z', dir * segStep('zstep'), 200);
  const xNudge = dir => nudge('X', dir * segStep('xstep'), 1000, p => { if (step === 4 && ring?.b !== undefined) ring.b = p[0]; });

  const acts = {
    turn: () => slowGo('turn'), turnTest: () => slowGo('turnTest'), line: () => slowGo('line'), cross: () => slowGo('cross'),
    turnBack: () => turnNudge(-1), turnMore: () => turnNudge(1),
    save101: () => save(101, turnSteps(vals[101], Math.abs(turn.at - turn.from), turn.tested), 'Press Test to check.'),
    zUp: () => zNudge(1), zDown: () => zNudge(-1),
    touch: () => run(async (g, live) => {
      const reset = await fit(g, 'Z');
      if (reset) throw new Error(`${reset} Try again.`);
      api.setSettings(await touchLift(g, vals[102], live));
    }, 'Saved. The pen is up, ready to travel.'),
    xIn: () => xNudge(-1), xOut: () => xNudge(1),
    save100: () => save(100, corrected(vals[100], Math.abs(line.b - line.a), num('calRuler')), 'Draw again to check.'),
    circle: () => run(async (g, live) => {
      if (!plausible(101, vals[101])) throw new Error('Do the turn test first.');
      ring = null; ring = { a: await drawCircle(g, api.getSettings(), vals[101], live) };
    }, 'Circle drawn. Now press Cross slowly.', 'circle'),
    center: () => run(async (g, live) => { await centerBetween(g, ring.a, ring.b, api.getSettings().penUp, live); m.refresh(); }, 'Center set. The pen is over it.', 'center'),
    drawLine: () => { const a = lineTurn * 30; lineTurn++; draw(centerLine(a), 'drawLine').then(() => refresh()); },
    saveGap: () => {
      const gap = offsetFromGap(api.getSettings().offset, num('calApart'), $('calSide').checked ? -1 : 1);
      api.setSettings({ offset: gap }); $('calApart').value = ''; msg(`Gap saved: ${gap} mm. Draw again to check.`); refresh();
    },
    drawF: () => { fDrawn = true; draw(letterF(), 'drawF'); },
    fOk: () => msg('Rotation is right.'),
    fBad: () => { const f = !api.getSettings().flip; api.setSettings({ flip: f }); msg(`Reverse rotation ${f ? 'on' : 'off'}. Draw again to check.`); },
    back: () => go(step - 1), next: () => go(step + 1),
  };
  function go(n) {
    if (slow || job) return;
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
  // The pen motor runs the wrong way: machine.js keeps GRBL's direction mask in step with the
  // zFlip setting. (The panel's `input` listener has already redrawn the box, so don't read its state.)
  $('calZFlip').addEventListener('change', () => run(async () => {
    api.setSettings({ zFlip: api.getSettings().zFlip === false });
    await m.check();
    await read();
  }, 'Pen direction reversed. Find the paper again.'));
  // the carriage runs the wrong way: flip its bit in GRBL's direction mask. Every position is off after that.
  $('calXFlip').addEventListener('change', () => run(async g => {
    const v = vals[3] ^ 1;
    await g.send(`$3=${v}`);
    vals[3] = v; ring = line = null; g.center = null;
    await m.check();
  }, 'Carriage direction reversed.'));

  link.addEventListener('click', async () => {
    const { openTool } = await import('./tool.js');   // tool.js needs a page; the tests import this file without one
    grbl = m.getGrbl();
    if (!grbl) return;
    step = 1; vals = {}; lineTurn = 0; fDrawn = false; turn = line = ring = slow = job = null;
    msg(''); err('');
    openTool('calTool', () => {
      clearInterval(zTimer);
      if (slow) {                                      // never leave a slow move running, or the pen down
        grbl?.realtime('\x85');
        if (SLOWS[slow.act].post) grbl?.send(`G90 G0 Z${api.getSettings().penUp}`).catch(() => {});
      }
      stopRun();                                       // …or a circle or a drawing
      slow = null; grbl = null;
    });
    refresh();
    read();
    clearInterval(zTimer);
    zTimer = setInterval(() => { showZ(); if (!alive() && !busy) { err('Not connected.'); refresh(); } }, 250);
  });
}
