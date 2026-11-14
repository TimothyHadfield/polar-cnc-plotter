// Calibrate: a guided tool panel, one step at a time. Nothing in it draws, so it needs no paper.
// The platter's steps ($101: turn it once with the arrows, then Test a full turn), which way it turns, the pen
// height (click down until the tip touches), the carriage's steps ($100: move, and read a ruler),
// the platter center and the center gap (a mark found twice, half a turn apart). The slow moves
// stop when their button is pressed again. Needs a connected plotter (the link sits in the
// connected status row). The math and the machine steps are exported for the tests.

import { wrap180 } from './polar.js';
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

// A belt drive has an exact value too: full steps × microsteps / (pulley teeth × 2 mm of GT2 belt).
export function snapBelt(v, tol = 0.02) {
  for (const teeth of [16, 20]) for (const full of [200, 400]) for (const micro of [1, 2, 4, 8, 16, 32, 64]) {
    const exact = full * micro / (teeth * 2);
    if (Math.abs(v / exact - 1) <= tol) return r3(exact);
  }
  return null;
}

// New $100 from a move the plotter counted as `counted` mm and a ruler under the pen says was
// `ruler` mm. Reading a ruler there is good to about 1 mm, so a value near a plain belt drive's
// exact one becomes that one.
export function beltSteps(old, counted, ruler) {
  const raw = corrected(old, counted, ruler);
  return snapBelt(raw) ?? raw;
}

// A mark on the platter sat under the pen at machine (x1, y1). After about half a turn it sits
// under the pen again at (x2, y2), on the other side of the center. The center is halfway in X.
// If the pen line misses the center by a gap (polar.js `offset`: the pen is at (s, gap), a platter
// point shows at angle theta − Y), the mark comes round at 180° + 2·atan(gap / s), not at 180°:
// the turn beyond 180° gives the gap. `flip` = the platter turns the other way.
export function gapFromMark(x1, y1, x2, y2, flip = false) {
  const s = (x1 - x2) / 2;                               // the first spot, measured from the center
  const extra = wrap180(y2 - y1 - 180) * (flip ? -1 : 1);
  return Math.round(s * Math.tan(extra / 2 * Math.PI / 180) * 10) / 10 || 0;
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

// Test, after the turn test: one full turn by the plotter's own count, in about TEST_TIME seconds
// (Tim, 2026-11-14: "around 5 seconds for the test to spin in 1 circle is good").
export const TEST_TIME = 5;
export const fullTurn = (spu, dir = 1) => `$J=G91 G21 Y${dir < 0 ? '-' : ''}360.000 F${jogFeed('Y', 360 * 60 / TEST_TIME, spu)}`;

// GRBL caps every move at $111 (°/min) and speeds up at $121 (°/s²). At the factory 500 and 10 a
// full turn takes over 40 s, so the turn test raises them to the build guide's values first.
export const FAST = { 111: 7200, 121: 300 };
export async function platterSpeed(grbl, vals) {
  const low = [];
  if (!(vals[111] >= 360 * 60 / TEST_TIME)) low.push(111);
  if (!(vals[121] >= 150)) low.push(121);
  for (const n of low) { await grbl.send(`$${n}=${FAST[n]}`); vals[n] = FAST[n]; }
  return low;
}

// The carriage test's move: this many motor steps (50 mm at 40 steps per mm), so it stays short
// whatever $100 says. It may be stopped early; either way how far it went is what the ruler checks.
export const LINE = 2000;

// Half a turn (find center) and a quarter (turn direction) by the plotter's own count.
export const partTurn = (deg, spu) => nudgeJog('Y', deg, Infinity, spu);

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

// Stop a move that is under way (the move to the center) and lift the pen. GRBL's buffers are
// emptied; the center and the pen zero are put back.
export async function stopMove(grbl, penUp) {
  await grbl.stop();
  await grbl.send(`G90 G0 Z${penUp}`);
}

// The mark was under the pen at machine X `a` and `b`: the center is halfway. Go there, zero it.
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

// ---------- the panel ----------
// Each step: Start (Redo once started) begins it, Done saves it. A pill by the title and a dot
// per step at the bottom say where it stands: not started, in progress, done. The button to press
// next is filled in. The quick check (Check, in the header) is shown like a sixth step.
const STEPS = 5;
const CHECK = 6;
const PILL = { idle: 'Not started', on: 'In progress', done: '✓ Done', bad: '✗ Problems' };

// Carriage Left / Right with its own step sizes; `n` tells two rows in one step apart. `on` =
// only once the step is started.
const xJog = (n = '', on = false) => {
  const a = on ? ' data-on' : '';
  return `<div class="calres"><button class="btn sm" data-act="xLeft${n}"${a}>Left</button><button class="btn sm" data-act="xRight${n}"${a}>Right</button>
    <span class="seg xstep${n}"><button data-step="0.1">0.1</button><button data-step="1" class="on">1</button><button data-step="10">10</button></span></div>`;
};
const head = (title, help, text) => `<h3>${title} <span class="pill"></span> <button class="q" type="button" data-q="${help}" aria-label="What is this?">?</button></h3>
  <p class="help" id="${help}" hidden>${text}</p>`;

// ---------- pictures (SVG, animated in place) ----------
const loop = 'repeatCount="indefinite"';
const PIC = {
  // top view: a tape mark goes round in clicks and comes back to the fixed point
  turn: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <path class="fix" d="M120 10 l-6 -8 h12z"/><text x="132" y="9">fixed point</text>
    <g><animateTransform attributeName="transform" type="rotate" dur="6s" ${loop}
      values="0 120 55;90 120 55;90 120 55;180 120 55;180 120 55;270 120 55;270 120 55;360 120 55;360 120 55"
      keyTimes="0;.1;.22;.32;.44;.54;.66;.76;1"/>
      <circle class="plate" cx="120" cy="55" r="42"/><rect class="tape" x="116" y="13" width="8" height="10" rx="1"/></g>
  </svg>`,
  // top view: a quarter turn, seen from above
  dir: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <g><animateTransform attributeName="transform" type="rotate" dur="3s" ${loop} values="0 120 52;90 120 52;90 120 52" keyTimes="0;.5;1"/>
      <circle class="plate" cx="120" cy="52" r="42"/><rect class="tape" x="116" y="10" width="8" height="10" rx="1"/></g>
    <text x="178" y="20">seen from</text><text x="178" y="33">above</text>
  </svg>`,
  // side view: the pen comes down in clicks until the tip touches, then lifts a little
  pen: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <rect class="plate" x="40" y="80" width="160" height="8" rx="2"/>
    <g><animateTransform attributeName="transform" type="translate" dur="5s" ${loop}
      values="0 0;0 5;0 5;0 9;0 9;0 12;0 12;0 6;0 6" keyTimes="0;.08;.2;.28;.4;.48;.7;.78;1"/>
      <rect class="pen" x="113" y="6" width="14" height="54" rx="3"/><path class="tip" d="M113 60 h14 l-7 8z"/></g>
    <text x="140" y="76">just touches</text>
  </svg>`,
  // side view: the pen travels over a ruler toward the center
  ruler: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <rect class="ruler" x="24" y="70" width="192" height="18" rx="2"/>
    <path class="tick" d="${Array.from({ length: 19 }, (_, i) => `M${30 + i * 10} 70v${i % 5 ? 5 : 10}`).join('')}"/>
    <line class="path" x1="50" y1="8" x2="50" y2="66"/>
    <g><animateTransform attributeName="transform" type="translate" dur="5s" ${loop} values="0 0;0 0;140 0;140 0" keyTimes="0;.15;.7;1"/>
      <rect class="pen" x="43" y="8" width="14" height="44" rx="3"/><path class="tip" d="M43 52 h14 l-7 8z"/></g>
    <text x="24" y="99">edge</text><text x="216" y="99" text-anchor="end">center →</text>
  </svg>`,
  // top view: mark under the tip, half turn, the tip goes to the mark, then halfway = the center
  center: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <g><animateTransform attributeName="transform" type="rotate" dur="9s" ${loop} values="0 120 46;0 120 46;180 120 46;180 120 46" keyTimes="0;.25;.5;1"/>
      <circle class="plate" cx="120" cy="46" r="42"/>
      <circle class="mark" cx="90" cy="46" r="4"><animate attributeName="opacity" dur="9s" ${loop} values="0;1" keyTimes="0;.1" calcMode="discrete"/></circle></g>
    <line class="path" x1="66" y1="46" x2="174" y2="46"/><path class="cross" d="M115 46h10M120 41v10"/>
    <circle class="tipring" cx="90" cy="46" r="7"><animate attributeName="cx" dur="9s" ${loop} values="90;90;150;150;120;120" keyTimes="0;.5;.7;.78;.9;1"/></circle>
    <g text-anchor="middle">
      <text x="120" y="99"><animate attributeName="opacity" dur="9s" ${loop} values="1;0" keyTimes="0;.25" calcMode="discrete"/>1. Mark under the tip</text>
      <text x="120" y="99" opacity="0"><animate attributeName="opacity" dur="9s" ${loop} values="0;1;0" keyTimes="0;.25;.5" calcMode="discrete"/>2. Half turn</text>
      <text x="120" y="99" opacity="0"><animate attributeName="opacity" dur="9s" ${loop} values="0;1;0" keyTimes="0;.5;.78" calcMode="discrete"/>3. Jog right to the mark</text>
      <text x="120" y="99" opacity="0"><animate attributeName="opacity" dur="9s" ${loop} values="0;1" keyTimes="0;.78" calcMode="discrete"/>Done: the center is halfway</text>
    </g>
  </svg>`,
  // why line 4: the pen's path misses the center, so the mark comes round beside it
  gap: `<svg class="calpic" viewBox="0 0 240 100" aria-hidden="true">
    <circle class="plate" cx="120" cy="50" r="42"/><path class="cross" d="M115 50h10M120 45v10"/>
    <line class="path" x1="66" y1="40" x2="174" y2="40"/><text x="178" y="43">pen path</text>
    <circle class="mark ghost" cx="90" cy="40" r="4"/><circle class="mark" cx="150" cy="60" r="4"/>
    <path class="arrow" d="M154 58 A31.6 31.6 0 0 0 154 44"/><path class="tip" d="M154 41 l-4 6 h8z"/>
    <circle class="tipring" cx="150" cy="40" r="7"/><text x="60" y="66">mark after the half turn →</text>
  </svg>`,
};

const HTML = `
<div class="calstep" data-n="1">
  ${head('Turn test', 'calTurnHelp', 'The site counts the arrow clicks. One full circle shows how many motor steps make 360°. Until then a click may turn more or less than its label. A result within 2 % of a plain motor\'s exact value is rounded to it.')}
  ${PIC.turn}
  <p class="calsay">1. Tape a mark on the platter edge, lined up with something fixed.</p>
  <button class="btn" data-act="start">Start</button>
  <p class="calsay">2. Turn with the arrows until the mark is back.</p>
  <div class="calres"><button class="btn sm" data-act="tCcw" data-on aria-label="Turn counterclockwise">↺</button><button class="btn sm" data-act="tCw" data-on aria-label="Turn clockwise">↻</button>
    <span class="seg tstep"><button data-step="0.5">0.5°</button><button data-step="5">5°</button><button data-step="90" class="on">90°</button></span></div>
  <div class="calres"><span>New $101 <b id="calNew101">–</b></span><span class="unit" id="calRaw101"></span><button class="btn sm end" data-act="done" data-on>Done</button></div>
  <p class="calsay">3. Press Test. It should turn exactly once.</p>
  <button class="btn" data-act="turnTest">Test</button>
  <div class="calres" id="calTestAsk" hidden><span>Back on the mark?</span><button class="btn sm" data-act="tYes">Yes</button><button class="btn sm" data-act="tNo">No</button></div>
</div>

<div class="calstep" data-n="2" hidden>
  ${head('Turn direction', 'calDirHelp', 'If the platter turns the other way, everything comes out mirrored. The answer sets Reverse rotation in Settings.')}
  ${PIC.dir}
  <p class="calsay">1. Press Start. The platter turns a quarter.</p>
  <button class="btn" data-act="start">Start</button>
  <p class="calsay">2. Seen from above, which way did it go?</p>
  <div class="row"><button class="btn wide" data-act="cw" data-on>Clockwise</button><button class="btn wide" data-act="ccw" data-on>Counterclockwise</button></div>
  <p class="calsay" id="calDir"></p>
</div>

<div class="calstep" data-n="3" hidden>
  ${head('Pen height', 'calPenHelp', 'Done saves that height as pen down, then lifts the pen a little for travel. The heights are counted from where the pen rests, so leave it up. Do this step again after changing the pen.')}
  ${PIC.pen}
  <button class="btn" data-act="start">Start</button>
  <p class="calsay">Click Down until the tip just touches. Press Done.</p>
  <div class="row"><button class="btn wide" data-act="zUp" data-on>Up</button><button class="btn wide" data-act="zDown" data-on>Down</button></div>
  <div class="calres"><span>Pen at</span><b class="calz" id="calZ">–</b>
    <span class="seg zstep"><button data-step="0.02">0.02</button><button data-step="0.1" class="on">0.1</button><button data-step="0.5">0.5</button></span></div>
  <button class="btn" data-act="done" data-on>Done</button>
  <label class="switch" id="calZFlipRow" hidden><input type="checkbox" id="calZFlip"><span></span>Reverse direction</label>
  <p class="calsay" id="calPens"></p>
</div>

<div class="calstep" data-n="4" hidden>
  ${head('Carriage test', 'calLineHelp', 'The carriage moves a set number of motor steps. The ruler shows how far that really was, which sets $100. A result within 2 % of a plain belt drive\'s exact value is rounded to it.')}
  ${PIC.ruler}
  <button class="btn" data-act="start">Start</button>
  <p class="calsay">1. Jog the pen left, near the platter edge.</p>
  ${xJog('', true)}
  <p class="calsay">2. Hold a ruler under the tip. Press Move.</p>
  <div class="calres"><button class="btn sm" data-act="move" data-on>Move</button><span class="end">Plotter says <b id="calLine">–</b> mm</span></div>
  <p class="calsay">3. Type what the ruler says. Press Done.</p>
  <div class="calres"><span>Ruler says</span><input type="number" id="calRuler" min="1" step="0.5" aria-label="The pen moved, mm"><span>mm</span></div>
  <div class="calres"><span>New $100 <b id="calNew100">–</b></span><span class="unit" id="calRaw100"></span><button class="btn sm end" data-act="done" data-on>Done</button></div>
  <label class="switch" id="calXFlipRow" hidden><input type="checkbox" id="calXFlip"><span></span>Reverse direction</label>
</div>

<div class="calstep" data-n="5" hidden>
  ${head('Find center', 'calFindHelp', 'The half turn carries the mark to the other side of the center. The center is halfway between the two spots, so Done moves the pen there and remembers it.')}
  ${PIC.center}
  <p class="calsay">1. Jog the pen left, about halfway out. Mark the platter under the tip. Press Start.</p>
  ${xJog()}
  <button class="btn" data-act="start">Start</button>
  <p class="calsay">2. Press Half turn. The mark goes to the other side.</p>
  <button class="btn" data-act="half" data-on>Half turn</button>
  <p class="calsay">3. Jog right until the tip is over the mark.</p>
  ${xJog('2', true)}
  <p class="calsay">4. Only if needed: mark beside the tip? Turn a little. <button class="q" type="button" data-q="calGapHelp" aria-label="Why?">?</button></p>
  <div class="help" id="calGapHelp" hidden>${PIC.gap}<p class="help">If the pen's path misses the platter's center by a little, the mark comes back beside the tip, never under it. A small turn brings it under. The site uses that turn to correct every plot. Mark already under the tip? Skip this.</p></div>
  <div class="calres"><button class="btn sm" data-act="yCcw" data-on aria-label="Turn counterclockwise">↺</button><button class="btn sm" data-act="yCw" data-on aria-label="Turn clockwise">↻</button>
    <span class="seg dstep"><button data-step="0.2" class="on">0.2°</button><button data-step="1">1°</button></span></div>
  <p class="calsay">5. Press Done. The pen moves to the center.</p>
  <button class="btn" data-act="done" data-on>Done</button>
</div>

<div class="calstep" data-n="6" hidden>
  <h3>Quick check <span class="pill"></span></h3>
  <p class="calsay">The plotter moves by itself. Answer each question.</p>
  <ol class="calchecks" id="calChecks"></ol>
  <p class="calask" id="calAsk"></p>
  <div class="row" id="calAnswer" hidden><button class="btn wide" data-act="yes">Yes</button><button class="btn wide" data-act="no">No</button></div>
  <button class="btn" data-act="checkGo">Start check</button>
  <div class="row" id="calRedo"></div>
</div>

<p class="calsay" id="calMsg"></p>
<p class="err" id="calErr" role="alert"></p>
<div class="calnav"><button class="btn" data-act="back">Back</button><div class="calmid"><span id="calCount"></span><span class="caldots" id="calDots"></span></div><button class="btn" data-act="next">Next</button></div>`;

// The quick check: each move, then a question. A "No" names the step to do again. The pen is
// up except for the pen-height question (the tip touches the platter at the center once).
export const CHECKS = [
  { name: 'Center', ask: 'Is the tip over the platter\'s center?', redo: 5, go: 'Going to the center.' },
  { name: 'Pen height', ask: 'Is the tip just touching?', redo: 3, go: 'Lowering the pen.' },
  { name: 'Carriage', ask: 'Is the tip 5 cm from the center?', redo: 4, go: 'Moving 5 cm out.' },
  { name: 'Turn direction', ask: 'Did it turn clockwise, seen from above?', redo: 2, go: 'Turning once. Watch which way.' },
  { name: 'Full turn', ask: 'Did it stop exactly where it started?', redo: 1 },
];
export const CHECK_OUT = 50;    // mm out for the carriage question

export function initCalibrate(api) {
  const m = api.machine;
  const root = document.getElementById('calTool');
  const link = document.getElementById('calOpen');
  if (!m || !root || !link) return;
  root.insertAdjacentHTML('beforeend', HTML);
  const $ = id => document.getElementById(id);
  const num = id => parseFloat($(id).value);
  let tool = null;    // tool.js, once the panel has been opened

  let step = 1, busy = false, grbl = null, vals = {}, zTimer = 0;
  let st = {};        // step number -> 'idle' | 'on' | 'done' ('bad' for a check with a No)
  let back = 1;       // the step the quick check was opened from
  let slow = null;    // { act, stopping } while a slow move runs
  let job = null;     // { act, stopped } while a move with a Stop runs (Done in Find center, the check)
  let turn = null;    // { from, at, tested }: platter machine position when the turn began / where it is now
  let tested = null;  // { from, at }: Test has run; waiting for "Back on the mark?"
  let line = null;    // { a, b }: machine X where the carriage test's move begins / ends
  let mark = null;    // { x, y }: machine position the mark was under the pen at (Find center's Start)
  let halved = false; // Half turn ran since Start
  let asking = null;  // { resolve, reject } while the check waits for Yes / No
  let answers = [];   // the check's answers so far: true / false
  const msg = t => { $('calMsg').textContent = t; };
  const err = t => { $('calErr').textContent = t; };
  const alive = () => grbl && m.getGrbl() === grbl;
  const fmt = v => Number.isFinite(v) ? v.toFixed(3) : '–';
  const same = (a, b) => Math.abs(a - b) < 0.0005;
  const yDir = () => api.getSettings().flip ? -1 : 1;     // Y sign that turns the platter clockwise

  // ---------- the slow moves: the same button starts and stops ----------
  // done(at, from): Stop was pressed. end(at, from): the move ran out by itself (without an `end`
  // that is a failure).
  function moved(at, from) {
    if (Math.abs(at - from) * vals[100] < 200) { line = null; msg('Too short to measure. Move again.'); return; }
    line = { a: from, b: at };
    msg('Type what the ruler says.');
  }
  // The New $101 on screen when it is not saved yet and a real plotter could have it; else NaN.
  function pending101() {
    const n = turn ? turnSteps(vals[101], Math.abs(turn.at - turn.from), turn.tested) : NaN;
    return plausible(101, n) && !same(n, vals[101]) ? n : NaN;
  }
  const SLOWS = {
    // Test checks the number on screen: one measured but not saved yet is saved first. (Tim,
    // 2026-11-14: stopped after one circle, pressed Test, and the OLD value turned it twice.)
    turnTest: { axis: 'Y', label: 'Test', go: 'Turning one full circle.', cmd: () => fullTurn(vals[101]),
      async pre(g) {
        tested = null;
        const n = pending101();
        if (Number.isFinite(n)) await store(g, 101, n);
        if (plausible(101, vals[101])) await platterSpeed(g, vals);
      },
      ok: () => plausible(101, vals[101]) ? '' : 'Do the turn test first.',
      done() { turn = null; msg('Stopped.'); },
      end(at, from) { turn = null; tested = { from, at }; msg(''); } },
    move: { axis: 'X', label: 'Move', dir: -1, max: LINE, go: 'Moving. Watch the ruler.', done: moved, end: moved },
    half: { axis: 'Y', label: 'Half turn', go: 'Turning half a circle.', cmd: () => partTurn(180, vals[101]),
      ok: () => badAxes(vals).length ? 'Do the turn test and the carriage test first.' : '',
      done() { msg('Stopped. Press Start again.'); },
      end() { halved = true; msg('Now jog right to the mark.'); } },
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
      await d.pre?.(g);
      const no = d.ok?.();
      if (no) throw new Error(no);
      const reset = await fit(g, d.axis);
      if (reset) msg(`${reset} ${d.go}`);
      const from = (await g.nextStatus()).mpos[i];
      await g.send(d.cmd ? d.cmd() : slowJog(d.axis, d.dir ?? 1, vals[100 + i], vals[120 + i], d.max));
      while (mine() && !me.stopping) {
        await sleep(200);
        const s = await g.nextStatus();
        if (s.state === 'Idle' || s.state === 'Alarm') break;
      }
      if (!mine()) return;                             // the tool was closed (that cancels the move)
      const at = (await stopJog(g, mine))[i];          // Stop pressed before the move began: cancel again
      if (me.stopping) await d.done(at, from); else if (d.end) await d.end(at, from); else msg('It stopped by itself. Try again.');
    } catch (e) {
      if (slow === me) err(e.message);
    }
    if (slow === me) { slow = null; refresh(); }
  }

  // ---------- state shown ----------
  function refresh() {
    root.querySelectorAll('.calstep').forEach(s => {
      const n = +s.dataset.n, p = s.querySelector('.pill');
      s.hidden = n !== step;
      p.dataset.st = st[n];
      p.textContent = n === CHECK ? { idle: 'Not run', on: 'Running', done: '✓ All good', bad: '✗ Problems' }[st[n]] : PILL[st[n]];
    });
    $('calCount').textContent = step === CHECK ? 'Quick check' : `Step ${step} of ${STEPS}`;
    $('calDots').innerHTML = Array.from({ length: STEPS }, (_, i) => `<i data-st="${st[i + 1]}"${i + 1 === step ? ' class="now"' : ''}></i>`).join('');
    const s = api.getSettings();
    // turn test
    const moved = turn ? Math.abs(turn.at - turn.from) : NaN;
    const raw101 = corrected(vals[101], moved, 360);
    const n101 = turnSteps(vals[101], moved, turn?.tested);
    $('calNew101').textContent = fmt(n101);
    $('calRaw101').textContent = Number.isFinite(n101) && !same(n101, raw101) ? `measured ${raw101.toFixed(3)}` : '';
    $('calTestAsk').hidden = !tested;
    // carriage test
    const went = line ? Math.abs(line.b - line.a) : NaN;
    const raw100 = corrected(vals[100], went, num('calRuler'));
    const n100 = beltSteps(vals[100], went, num('calRuler'));
    $('calLine').textContent = Number.isFinite(went) ? went.toFixed(1) : '–';
    $('calNew100').textContent = fmt(n100);
    $('calRaw100').textContent = Number.isFinite(n100) && !same(n100, raw100) ? `measured ${raw100.toFixed(3)}` : '';
    $('calDir').textContent = `Saved: ${s.flip ? 'counterclockwise' : 'clockwise'}`;
    $('calPens').textContent = `Saved: up ${s.penUp} · down ${s.penDown}`;
    $('calZFlipRow').hidden = $('calXFlipRow').hidden = !Number.isFinite(vals[3]);   // the pretend plotters have no $3
    $('calZFlip').checked = s.zFlip !== false;
    $('calXFlip').checked = !!(vals[3] & 1);
    // the quick check
    $('calChecks').innerHTML = CHECKS.map((c, i) => `<li data-st="${answers[i] === true ? 'done' : answers[i] === false ? 'bad' : asking && answers.length === i ? 'on' : 'idle'}">${c.name}</li>`).join('');
    $('calAnswer').hidden = !asking;
    $('calAsk').textContent = asking ? CHECKS[answers.length].ask : '';
    const redo = [...new Set(CHECKS.filter((c, i) => answers[i] === false).map(c => c.redo))];
    $('calRedo').innerHTML = !asking && job?.act !== 'checkGo' ? redo.map(n => `<button class="btn sm" data-go="${n}">Redo step ${n}</button>`).join('') : '';
    // enabled?
    const can = { 1: Number.isFinite(n101), 3: true, 4: Number.isFinite(n100), 5: !!mark && halved };
    const need = { turnTest: plausible(101, vals[101]) || Number.isFinite(pending101()) ? 1 : NaN };
    root.querySelectorAll('[data-act]').forEach(b => {
      const act = b.dataset.act, n = +(b.closest('.calstep')?.dataset.n ?? 0);
      const stop = slow?.act === act;
      const off = b.hasAttribute('data-on') && st[n] !== 'on' || act === 'done' && !can[n] || act in need && !Number.isFinite(need[act]);
      b.disabled = act === 'back' ? !!slow || !!job || step === 1 : act === 'next' ? !!slow || !!job || step === CHECK
        : act === 'yes' || act === 'no' ? !asking
        : stop ? slow.stopping : job?.act === act && (act !== 'done' || n === step) ? !!job.stopped
        : busy || !!slow || !alive() || off;
      if (SLOWS[act]) b.textContent = stop ? 'Stop' : SLOWS[act].label;
      if (act === 'start') b.textContent = st[n] === 'idle' ? 'Start' : 'Redo';
      // the button to press next is filled in
      b.classList.toggle('go', act === 'start' ? st[n] === 'idle' : act === 'done' ? st[n] === 'on' && !!can[n]
        : act === 'next' ? st[step] === 'done' : act === 'checkGo' ? st[CHECK] !== 'on' && !job : false);
    });
    root.querySelectorAll('[data-act=tYes], [data-act=tNo]').forEach(b => { b.disabled = busy || !!slow || !tested; });
    const nb = root.querySelector('[data-act=next]');
    nb.textContent = step === STEPS ? 'Finished' : 'Next';
    root.querySelectorAll('.switch input').forEach(i => { i.disabled = busy || !!slow; });
    const db = root.querySelector('.calstep[data-n="5"] [data-act=done]');
    db.textContent = job?.act === 'done' ? 'Stop' : 'Done';
    $('calCheckOpen').disabled = !!slow || !!job || busy;
    root.querySelector('[data-act=checkGo]').textContent = job?.act === 'checkGo' ? 'Stop' : st[CHECK] === 'idle' ? 'Start check' : 'Check again';
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
  // Stop the move under way where it is, and lift the pen.
  function stopRun() {
    if (!job || job.stopped) return;
    asking?.reject(new Error('Stopped.'));
    asking = null;
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
    if (n === 100) mark = line = null;
    await m.check();
    return `$${n} was ${was}: reset to ${vals[n]}.`;
  }
  // $100 / $101: what was measured in the old units is rescaled or dropped
  async function store(g, n, v) {
    const old = vals[n];
    await saveSetting(g, n, v, old);
    vals[n] = r3(v);
    if (n === 101) { turn = null; mark = null; halved = false; }
    if (n === 100) { line = null; if (mark) mark.x *= old / vals[n]; $('calRuler').value = ''; }
    await m.check();
  }
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
  // The turn test's arrows: the plotter counts every click since Start (or since a missed Test).
  const turnArrow = dir => run(async g => {
    await g.send(nudgeJog('Y', dir * yDir() * segStep('tstep'), Infinity, vals[101]));
    turn.at = (await waitIdle(g, alive)).mpos[1];
  });
  const zNudge = dir => nudge('Z', dir * segStep('zstep'), 200);
  const xNudge = (dir, n = '') => nudge('X', dir * segStep('xstep' + n), 1000);
  // ↺ / ↻ as on the main panel: ↺ is Y+, or Y− for a platter that turns the other way
  const yNudge = dir => nudge('Y', dir * yDir() * segStep('dstep'), 300);
  // Which way Y+ turns the platter. A gap measured for the other direction changes sides.
  const setFlip = flip => {
    const s = api.getSettings();
    api.setSettings(!s.flip === !flip ? { flip } : { flip, offset: -s.offset || 0 });
    st[2] = 'done';
    msg(`Saved: ${flip ? 'counterclockwise' : 'clockwise'}.`); refresh();
  };

  // ---------- Start and Done, per step ----------
  const begin = n => { st[n] = 'on'; };
  const START_STEP = {
    // a value no real plotter has (factory 250: a 90° click would be 14 turns) is first replaced
    // by a plain one, and the platter's speed limits are raised
    1: () => run(async g => {
      tested = null;
      let note = '';
      if (!plausible(101, vals[101])) {
        const was = vals[101];
        await store(g, 101, START[101]);
        note = `$101 was ${was}: starting from ${START[101]}. `;
      }
      if ((await platterSpeed(g, vals)).length) note += `Platter speed raised ($111=${FAST[111]}, $121=${FAST[121]}). `;
      const from = (await g.nextStatus()).mpos[1];
      turn = { from, at: from };
      begin(1);
      msg(`${note}Turn with the arrows until the mark is back.`);
    }),
    2: () => run(async (g, live) => {
      if (!plausible(101, vals[101])) throw new Error('Do the turn test first.');
      await g.send(partTurn(90, vals[101]));
      await waitIdle(g, live);
      begin(2);
    }, 'Which way did it go?'),
    3: () => { begin(3); msg('Click Down until the tip just touches.'); refresh(); },
    4: () => { line = null; $('calRuler').value = ''; begin(4); msg('Jog the pen left, near the edge.'); refresh(); },
    5: () => run(async g => {
      if (badAxes(vals).length) throw new Error('Do the turn test and the carriage test first.');
      const p = (await g.nextStatus()).mpos;
      mark = { x: p[0], y: p[1] };
      halved = false;
      begin(5);
    }, 'Now press Half turn.'),
  };
  const DONE_STEP = {
    1: () => {
      const n = turnSteps(vals[101], Math.abs(turn.at - turn.from), turn.tested);
      if (same(n, vals[101])) { turn = null; st[1] = 'done'; msg('No change needed. Press Test to check.'); refresh(); return; }
      run(async g => { await store(g, 101, n); st[1] = 'done'; }, `Saved $101=${n.toFixed(3)}. Press Test to check.`);
    },
    3: () => run(async (g, live) => {
      const reset = await fit(g, 'Z');
      if (reset) throw new Error(`${reset} Try again.`);
      api.setSettings(await touchLift(g, vals[102], live));
      st[3] = 'done';
    }, 'Saved. The pen is up, ready to travel.'),
    4: () => {
      const n = beltSteps(vals[100], Math.abs(line.b - line.a), num('calRuler'));
      if (same(n, vals[100])) { st[4] = 'done'; msg('No change needed.'); refresh(); return; }
      run(async g => { await store(g, 100, n); st[4] = 'done'; }, `Saved $100=${n.toFixed(3)}.`);
    },
    5: () => run(async (g, live) => {
      const p = (await g.nextStatus()).mpos, s = api.getSettings();
      if (Math.abs(p[0] - mark.x) * vals[100] < 400) throw new Error('Jog right to the mark first.');
      if (Math.abs(wrap180(p[1] - mark.y - 180)) > 30) throw new Error('Press Redo, then Half turn.');
      const gap = gapFromMark(mark.x, mark.y, p[0], p[1], s.flip);
      await centerBetween(g, mark.x, p[0], s.penUp, live);
      mark = null;
      halved = false;
      api.setSettings({ offset: gap });
      m.refresh();
      st[5] = 'done';
      msg(`Center set. The pen is over it now. Center gap ${gap} mm.`);
    }, '', 'done'),
  };

  // ---------- the quick check ----------
  const answer = () => new Promise((resolve, reject) => { asking = { resolve, reject }; refresh(); });
  const quickCheck = async () => {
    await checkRun();
    if (st[CHECK] === 'on') { st[CHECK] = 'idle'; refresh(); }      // stopped part way
  };
  const checkRun = () => run(async (g, live) => {
    if (badAxes(vals).length) throw new Error('Do the turn test and the carriage test first.');
    if (!g.center) throw new Error('Set the center first: step 5.');
    answers = []; st[CHECK] = 'on'; refresh();
    const s = api.getSettings();
    const ask = async () => { const a = await answer(); asking = null; answers.push(a); refresh(); };
    const go = async (lines, say) => {
      msg(say);
      for (const l of lines) await g.send(l);
      await waitIdle(g, live);
      msg('');
    };
    await platterSpeed(g, vals);
    await go([`G90 G0 Z${s.penUp}`, 'G0 X0'], CHECKS[0].go);
    await ask();
    await go([`G90 G0 Z${s.penDown}`], CHECKS[1].go);
    await ask();
    await go([`G90 G0 Z${s.penUp}`, `G0 X${CHECK_OUT}`], CHECKS[2].go);
    await ask();
    await go([fullTurn(vals[101], yDir())], CHECKS[3].go);
    await ask();
    await ask();
    await go([`G90 G0 Z${s.penUp}`, 'G0 X0'], 'Back to the center.');
    st[CHECK] = answers.every(a => a) ? 'done' : 'bad';
    msg(st[CHECK] === 'done' ? 'Everything is calibrated.' : 'Redo the steps below, then check again.');
  }, '', 'checkGo');

  const acts = {
    start: () => START_STEP[step](),
    done: () => DONE_STEP[step](),
    turnTest: () => slowGo('turnTest'),
    tCcw: () => turnArrow(1), tCw: () => turnArrow(-1),
    tYes: () => { tested = null; st[1] = 'done'; msg('Turn test done.'); refresh(); },
    tNo: () => { turn = { ...tested, tested: true }; tested = null; st[1] = 'on'; msg('Line the mark up with the arrows, then press Done.'); refresh(); },
    move: () => slowGo('move'), half: () => slowGo('half'),
    cw: () => setFlip(false), ccw: () => setFlip(true),
    zUp: () => zNudge(1), zDown: () => zNudge(-1),
    xLeft: () => xNudge(1), xRight: () => xNudge(-1),     // left = away from the center (X+)
    xLeft2: () => xNudge(1, '2'), xRight2: () => xNudge(-1, '2'),
    yCcw: () => yNudge(1), yCw: () => yNudge(-1),
    checkGo: () => quickCheck(),
    yes: () => asking?.resolve(true), no: () => asking?.resolve(false),
    back: () => go(step === CHECK ? back : step - 1),
    next: () => { if (step === STEPS) tool?.closeTool(); else go(step + 1); },
  };
  function go(n) {
    if (slow || job) return;
    step = n === CHECK ? CHECK : Math.max(1, Math.min(STEPS, n));
    msg(''); err('');
    refresh();
  }

  root.addEventListener('click', e => {
    const q = e.target.closest('.q');
    if (q) { e.preventDefault(); const h = $(q.dataset.q); h.hidden = !h.hidden; return; }
    const seg = e.target.closest('.seg button');
    if (seg) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === seg)); return; }
    const r = e.target.closest('[data-go]');
    if (r) { go(+r.dataset.go); return; }
    if (e.target.closest('#calCheckOpen')) { if (step !== CHECK) back = step; go(CHECK); return; }
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
  }, 'Pen direction reversed. Touch down again.'));
  // the carriage runs the wrong way: flip its bit in GRBL's direction mask. Every position is off after that.
  $('calXFlip').addEventListener('change', () => run(async g => {
    const v = vals[3] ^ 1;
    await g.send(`$3=${v}`);
    vals[3] = v; mark = line = null; halved = false; g.center = null;
    await m.check();
  }, 'Carriage direction reversed.'));

  link.addEventListener('click', async () => {
    tool = await import('./tool.js');                 // tool.js needs a page; the tests import this file without one
    grbl = m.getGrbl();
    if (!grbl) return;
    step = 1; vals = {}; turn = tested = line = mark = slow = job = asking = null; halved = false; answers = [];
    st = { 1: 'idle', 2: 'idle', 3: 'idle', 4: 'idle', 5: 'idle', [CHECK]: 'idle' };
    msg(''); err('');
    tool.openTool('calTool', () => {
      clearInterval(zTimer);
      if (slow) grbl?.realtime('\x85');                // never leave a slow move running
      stopRun();                                       // …or the move to the center, or the check
      slow = null; grbl = null;
    });
    refresh();
    read();
    clearInterval(zTimer);
    zTimer = setInterval(() => { showZ(); if (!alive() && !busy) { err('Not connected.'); refresh(); } }, 250);
  });
}
