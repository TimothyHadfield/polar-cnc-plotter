// Calibrate: a guided tool panel that finds $100 / $101, pen heights, the center gap and the
// rotation direction, one step at a time. Needs a connected plotter (the link sits in the
// connected status row). Pure math is exported for the tests.

import { placedToGcode } from './polar.js';
import { gcodeLines } from './grbl.js';
export { parseSettings } from './grbl.js';

// ---------- math ----------
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

// A line through the center comes out as two parallel halves 2 × (real gap − gap setting) apart.
// sign = +1 or −1 (which side the pen line misses on; "Other side" flips it).
export function offsetFromGap(current, apart, sign = 1) {
  if (!(apart >= 0)) return NaN;
  return Math.round((current + sign * apart / 2) * 100) / 100;
}

// ---------- machine steps (also used by the tests) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function waitIdle(grbl, alive = () => true) {
  for (;;) {
    await sleep(150);
    if (!alive()) throw new Error('Not connected.');
    const s = await grbl.nextStatus().catch(() => null);
    if (s?.state === 'Alarm') throw new Error('Alarm: unlock with $X in the Settings console.');
    if (s?.state === 'Idle') return;
  }
}

// Pen up, then a relative move on one axis at 300/min, back to absolute, wait until done.
export async function testMove(grbl, axis, amount, penUp, alive) {
  await grbl.send(`G90 G0 Z${penUp}`);
  await grbl.send(`G94 G91 G1 ${axis}${amount} F300`);
  await grbl.send('G90');
  await waitIdle(grbl, alive);
}

export async function saveSetting(grbl, n, value) {
  await grbl.send(`$${n}=${value.toFixed(3)}`);
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
  <p class="help" id="calTurnHelp" hidden>If the platter stops short or goes past one turn, $101 is off.</p>
  <p class="calsay">Tape a mark on the platter edge, lined up with something fixed.</p>
  <div class="row"><button class="btn wide" data-act="turn">Turn once</button><button class="btn" data-act="turnOk">Exactly once</button></div>
  <div class="calres"><span>It turned</span><input type="number" id="calTurned" min="1" step="1"><span>°</span></div>
  <div class="calres"><span>New $101 <b id="calNew101">–</b></span><button class="btn sm end" data-act="save101" disabled>Save</button></div>
</div>

<div class="calstep" data-n="3" hidden>
  <h3>Rail test <button class="q" type="button" data-q="calRailHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calRailHelp" hidden>Measure how far the carriage really moved. If it isn't 20 mm, $100 is off.</p>
  <p class="calsay">Start the carriage away from the rail ends.</p>
  <div class="row"><button class="btn wide" data-act="rail">Move 20 mm out</button><button class="btn" data-act="railBack">Move back</button></div>
  <div class="calres"><span>It moved</span><input type="number" id="calMoved" min="0.1" step="0.1"><span>mm</span></div>
  <div class="calres"><span>New $100 <b id="calNew100">–</b></span><button class="btn sm end" data-act="save100" disabled>Save</button></div>
</div>

<div class="calstep" data-n="4" hidden>
  <h3>Pen heights</h3>
  <div class="calres"><span>Pen at</span><b class="calz" id="calZ">–</b>
    <button class="btn sm" data-act="zUp" aria-label="Raise pen">▲</button><button class="btn sm" data-act="zDown" aria-label="Lower pen">▼</button></div>
  <div class="calres"><span>Step</span><span class="seg" id="calZStep"><button data-step="0.1">0.1</button><button data-step="0.5" class="on">0.5</button><button data-step="1">1</button></span></div>
  <div class="row"><button class="btn wide" data-act="useUp">Use as pen up</button><button class="btn wide" data-act="useDown">Use as pen down</button></div>
  <p class="calsay" id="calPens"></p>
</div>

<div class="calstep" data-n="5" hidden>
  <h3>Center gap <button class="q" type="button" data-q="calGapHelp" aria-label="What is this?">?</button></h3>
  <p class="help" id="calGapHelp" hidden>A line through the center should be one straight line. Two offset halves mean the gap setting is off.</p>
  <p class="calsay">Move the pen over the platter center, then Set center.</p>
  <div class="calres"><button class="btn sm" data-act="xIn">In</button><button class="btn sm" data-act="xOut">Out</button>
    <span class="seg" id="calXStep"><button data-step="0.1">0.1</button><button data-step="1" class="on">1</button><button data-step="10">10</button></span></div>
  <div class="row"><button class="btn wide" data-act="center">Set center</button><button class="btn wide" data-act="drawLine">Draw test</button></div>
  <div class="calres"><span>Halves apart</span><input type="number" id="calApart" min="0" step="0.1"><span>mm</span></div>
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

  // ---------- state shown ----------
  function refresh() {
    root.querySelectorAll('.calstep').forEach(s => { s.hidden = +s.dataset.n !== step; });
    $('calCount').textContent = `Step ${step} of ${STEPS}`;
    $('calV100').textContent = fmt(vals[100]);
    $('calV101').textContent = fmt(vals[101]);
    // calculator
    const a = +$('calAngle').value, ms = +$('calMicro').value;
    const c101 = stepsPerDegree({ stepAngle: a, microsteps: ms, small: num('calSmall'), big: num('calBig') });
    const c100 = stepsPerMM({ stepAngle: a, microsteps: ms, teeth: num('calTeeth') });
    $('calC101').textContent = fmt(c101); $('calC100').textContent = fmt(c100);
    // tests
    const n101 = corrected(vals[101], 360, num('calTurned'));
    const n100 = corrected(vals[100], 20, num('calMoved'));
    $('calNew101').textContent = fmt(n101); $('calNew100').textContent = fmt(n100);
    const s = api.getSettings();
    const gap = offsetFromGap(s.offset, num('calApart'), $('calSide').checked ? -1 : 1);
    $('calNewGap').textContent = Number.isFinite(gap) ? gap + ' mm' : '–';
    $('calPens').textContent = `Saved: up ${s.penUp} · down ${s.penDown}`;
    // enabled?
    const need = { use101: c101, use100: c100, save101: n101, save100: n100, saveGap: gap };
    root.querySelectorAll('[data-act]').forEach(b => {
      const act = b.dataset.act;
      if (act === 'calc') return;
      b.disabled = act === 'back' ? step === 1 : act === 'next' ? step === STEPS
        : busy || !alive() || (act in need && !Number.isFinite(need[act]));
    });
    root.querySelector('[data-act=turn]').textContent = vals.turned ? 'Turn again' : 'Turn once';
    root.querySelector('[data-act=drawLine]').textContent = lineTurn ? 'Draw again' : 'Draw test';
    root.querySelector('[data-act=drawF]').textContent = fDrawn ? 'Draw again' : 'Draw F';
  }
  function showZ() {
    const z = alive() ? grbl.status?.wpos?.[2] : undefined;
    $('calZ').textContent = Number.isFinite(z) ? z.toFixed(1) : '–';
  }

  // ---------- running things on the plotter ----------
  async function run(fn, done) {
    if (busy) return;
    if (!alive()) { err('Not connected.'); return; }
    busy = true; err(''); msg(''); refresh();
    try { await fn(grbl); if (done) msg(done); } catch (e) { err(e.message); }
    busy = false; refresh();
  }
  async function read() {
    try { vals = { ...vals, ...await grbl.readSettings() }; }
    catch (e) { err('Could not read settings: ' + e.message); }
    refresh();
  }
  const save = (n, v, input) => run(async g => { await saveSetting(g, n, v); vals[n] = r3(v); if (input) $(input).value = ''; }, `Saved $${n}=${v.toFixed(3)}.`);
  const draw = strokes => run(async g => {
    if (!g.center) throw new Error('Set center first.');
    await g.stream(gcodeLines(placedToGcode(strokes, api.getSettings()).gcode));
  });
  const segStep = id => +$(id).querySelector('.on').dataset.step;

  const acts = {
    calc: () => { $('calCalc').hidden = !$('calCalc').hidden; },
    use101: () => save(101, stepsPerDegree({ stepAngle: +$('calAngle').value, microsteps: +$('calMicro').value, small: num('calSmall'), big: num('calBig') })),
    use100: () => save(100, stepsPerMM({ stepAngle: +$('calAngle').value, microsteps: +$('calMicro').value, teeth: num('calTeeth') })),
    turn: () => run(async g => { await testMove(g, 'Y', 360, api.getSettings().penUp, alive); vals.turned = true; }, 'Did the mark come back to the same spot?'),
    turnOk: () => msg('$101 is right.'),
    save101: () => save(101, corrected(vals[101], 360, num('calTurned')), 'calTurned'),
    rail: () => run(g => testMove(g, 'X', 20, api.getSettings().penUp, alive), 'Measure how far it moved.'),
    railBack: () => run(g => testMove(g, 'X', -20, api.getSettings().penUp, alive)),
    save100: () => save(100, corrected(vals[100], 20, num('calMoved')), 'calMoved'),
    zUp: () => jogZ(1), zDown: () => jogZ(-1),
    useUp: () => usePen('penUp'), useDown: () => usePen('penDown'),
    xIn: () => jog('X', -segStep('calXStep'), 1000), xOut: () => jog('X', segStep('calXStep'), 1000),
    center: () => run(async g => { await g.setCenter(); m.refresh(); }, 'Center set.'),
    drawLine: () => { const a = lineTurn * 30; lineTurn++; draw(centerLine(a)).then(() => refresh()); },
    saveGap: () => {
      const gap = offsetFromGap(api.getSettings().offset, num('calApart'), $('calSide').checked ? -1 : 1);
      setSettings({ offset: gap }); $('calApart').value = ''; msg(`Gap saved: ${gap} mm. Draw again to check.`); refresh();
    },
    drawF: () => { fDrawn = true; draw(letterF()); },
    fOk: () => msg('Rotation is right.'),
    fBad: () => { const f = !api.getSettings().flip; setSettings({ flip: f }); msg(`Reverse rotation ${f ? 'on' : 'off'}. Draw again to check.`); },
    back: () => go(step - 1), next: () => go(step + 1),
  };
  function usePen(k) {
    const z = grbl?.status?.wpos?.[2];
    if (!Number.isFinite(z)) return err('No pen position yet.');
    setSettings({ [k]: Math.round(z * 10) / 10 });
    refresh();
  }
  function jogZ(dir) {
    const s = api.getSettings();
    if (s.penUp < s.penDown) dir = -dir;             // ▲ always lifts, like the main pad
    jog('Z', dir * segStep('calZStep'), 200);
  }
  function jog(axis, d, feed) {
    if (!alive() || busy) return;
    grbl.send(`$J=G91 G21 ${axis}${d.toFixed(3)} F${feed}`).catch(e => err(e.message));
  }
  function go(n) {
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
    if (b && !b.disabled) acts[b.dataset.act]?.();
  });
  root.addEventListener('input', () => refresh());

  link.addEventListener('click', async () => {
    const { openTool } = await import('./tool.js');   // tool.js needs a page; the tests import this file without one
    grbl = m.getGrbl();
    if (!grbl) return;
    step = 1; vals = {}; lineTurn = 0; fDrawn = false;
    msg(''); err('');
    openTool('calTool', () => { clearInterval(zTimer); grbl = null; });
    refresh();
    read();
    clearInterval(zTimer);
    zTimer = setInterval(() => { showZ(); if (!alive() && !busy) { err('Not connected.'); refresh(); } }, 250);
  });
}
