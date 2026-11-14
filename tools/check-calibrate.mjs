// Headless check of the reworked Calibrate tool on sim.html.
// usage: node calcheck.mjs phone|desktop <outdir> [baseUrl]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
const require = createRequire(os.homedir().replace(/\\/g, '/') + '/.claude/tools/');
const { webkit, devices } = require('playwright');

const [mode, out, base = 'http://localhost:8765/'] = process.argv.slice(2);
const browser = await webkit.launch();
const ctx = await browser.newContext(mode === 'phone' ? { ...devices['iPhone 15'], viewport: { width: 393, height: 659 } } : { viewport: { width: 1440, height: 900 } });
// pen heights as the old tool saved them with its own "Reverse direction" on: up 0, down +1.5
await ctx.addInitScript(() => { if (!localStorage.getItem('polar-plotter-settings')) localStorage.setItem('polar-plotter-settings', JSON.stringify({ penUp: 0, penDown: 1.5 })); });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const R = {};
const ok = (name, cond, detail) => { R[name] = (cond ? 'PASS' : 'FAIL') + (detail !== undefined ? ' · ' + JSON.stringify(detail) : ''); };
const txt = sel => page.evaluate(s => document.querySelector(s)?.textContent ?? null, sel);
const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }, sel);
const dis = sel => page.evaluate(s => [...document.querySelectorAll(s)].map(b => b.disabled), sel);
const cmd = async t => { await page.evaluate(t => { document.getElementById('cmd').value = t; document.getElementById('cmdForm').requestSubmit(); }, t); await page.waitForTimeout(900); };
const sim = js => page.evaluate(js);
const shot = n => page.screenshot({ path: `${out}/${mode}-${n}.png` });
const scrolls = async () => { const r = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth, big: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().bottom > innerHeight + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 4).map(e => e.tagName + '#' + e.id + '.' + e.className) })); if (r.h > r.ih + 1 || r.w > r.iw + 1) { R['scroll-detail-' + Object.keys(R).length] = r; return true; } return false; };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('polar-plotter-settings') || '{}'));
// the button of the step on screen
const act = a => a === "next" ? "#calTool [data-act=next]" : `.calstep:not([hidden]) [data-act=${a}]`;
const click = async a => { await page.click(act(a)); };
const idle = async (a, label, t = 90000) => { await page.waitForFunction(([s, l]) => { const b = document.querySelector(s); return b.textContent === l && !b.disabled; }, [act(a), label], { timeout: t }); await page.waitForTimeout(300); };
const title = () => txt('.calstep:not([hidden]) h3');
const wz = () => sim('plotterSim.grbl.pos[2] - plotterSim.grbl.wco[2]');

try {
  await page.goto(base + 'sim.html?v=2', { waitUntil: 'load' });
  await page.waitForSelector('#connect', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !!window.plotterSim, null, { timeout: 60000 });
  await page.click('#connect');
  await page.waitForSelector('#live', { state: 'visible' });
  await page.waitForTimeout(800);
  ok('01 pretend plotter (no $3): nothing written, old heights kept', !(await sim('plotterSim.grbl.received.some(l => l.startsWith("$3="))')) && (await stored()).penDown === 1.5, await stored());

  // ----- Tim's plotter: platter 4.444 steps/deg, carriage 40 steps/mm, GRBL at factory values, $3 = 0 -----
  await sim('plotterSim.grbl.true[1] = 4.444; plotterSim.grbl.true[0] = 40;');
  await cmd('$3=0');
  const s1 = await stored();
  ok('02 pen direction written to the plotter ($3=4)', await sim('plotterSim.grbl.received.includes("$3=4") && plotterSim.grbl.settings[3] === "4.000"'), await sim('plotterSim.grbl.received.filter(l => l.startsWith("$3"))'));
  ok('03 heights saved flipped are turned over (down 1.5 -> -1.5), Settings box too', s1.penUp === 0 && s1.penDown === -1.5 && await page.evaluate(() => document.getElementById('penDown').value === '-1.5'), s1);
  ok('04 console log says why', (await txt('#log')).includes('> $3=4 (pen direction)'));
  await cmd('$101=250');
  await cmd('$100=250');
  ok('05 factory platter value flagged', (await txt('#mMsg')).startsWith('Platter steps look wrong ($101 = 250'), await txt('#mMsg'));


  const pill = () => txt('.calstep:not([hidden]) .pill');
  const msgIs = async (t, ms = 60000) => { await page.waitForFunction(t => document.getElementById('calMsg').textContent === t || !!document.getElementById('calErr').textContent, t, { timeout: ms }); await page.waitForTimeout(300); };

  // ----- step 1: Turn test + Test -----
  await page.click('#calOpen');
  await page.waitForTimeout(900);
  ok('06 opens on Turn test, step 1 of 5, "Not started", Close + Check in the header', (await title()).startsWith('Turn test') && (await txt('#calCount')) === 'Step 1 of 5' && (await pill()) === 'Not started' && (await txt('#calTool [data-close-tool]')) === 'Close' && (await txt('#calCheckOpen')) === 'Check' && await page.evaluate(() => document.querySelectorAll('#calDots i').length === 5), { t: await title(), c: await txt('#calCount'), p: await pill(), err: await txt('#calErr') });
  ok('07 arrows and Test are off until Start; Start is filled in', (await dis(act('turnTest')))[0] === true && (await dis(act('tCcw')))[0] === true && (await dis(act('done')))[0] === true && await page.evaluate(s => document.querySelector(s).classList.contains('go'), act('start')));
  ok('07b every step has a picture', await page.evaluate(() => [1, 2, 3, 4, 5].every(n => document.querySelector(`.calstep[data-n="${n}"] > svg.calpic`))));
  await shot('1-turn');
  // the arrows: click `n` times at step size `size` (° by the plotter's count)
  const arrow = async (a, size, n) => {
    await page.click(`.calstep:not([hidden]) .tstep [data-step="${size}"]`);
    for (let i = 0; i < n; i++) { await click(a); await idle(a, a === 'tCcw' ? '↺' : '↻'); }
  };
  await click('start'); await idle('start', 'Redo');
  const m8 = await txt('#calMsg');
  ok('08a Start: factory 250 restarts at 8.889, speed raised; pill In progress; Start is now Redo', m8 === '$101 was 250: starting from 8.889. Platter speed raised ($111=7200, $121=300). Turn with the arrows until the mark is back.' && (await pill()) === 'In progress' && (await sim('plotterSim.grbl.settings[111]')) === '7200.000', { m8, p: await pill() });
  let before = await sim('plotterSim.grbl.real()[1]');
  await arrow('tCcw', 90, 2);                  // at 8.889 a "90°" click is 180° real
  ok('08 two 90° clicks = one real turn = 4.444; Done is filled in', Math.abs(await sim('plotterSim.grbl.real()[1]') - before - 360) < 0.1 && (await txt('#calNew101')) === '4.444' && await page.evaluate(s => document.querySelector(s).classList.contains('go'), act('done')), { went: await sim('plotterSim.grbl.real()[1]') - before, shown: await txt('#calNew101') });
  await click('done');
  await msgIs('Saved $101=4.444. Press Test to check.');
  ok('09 Done saves; pill ✓ Done, first dot green, arrows off, Test on', (await sim('plotterSim.grbl.settings[101]')) === '4.444' && (await pill()) === '✓ Done' && await page.evaluate(() => document.querySelector('#calDots i').dataset.st === 'done') && (await dis(act('tCcw')))[0] === true && (await dis(act('turnTest')))[0] === false, { msg: await txt('#calMsg'), p: await pill() });
  before = await sim('plotterSim.grbl.real()[1]');
  const t0 = Date.now();                       // real time: Tim wants about 5 s a circle
  await click('turnTest');
  await page.waitForTimeout(700);
  const tl = await txt(act('turnTest'));
  await page.waitForFunction(s => { const b = document.querySelector(s); return b.textContent === 'Test' && !b.disabled; }, act('turnTest'), { timeout: 90000, polling: 50 });
  const secs = (Date.now() - t0) / 1000;
  await page.waitForTimeout(300);
  let went = await sim('plotterSim.grbl.real()[1]') - before;
  ok('10 Test turns one full circle in about 5 s (button is Stop meanwhile)', tl === 'Stop' && Math.abs(went - 360) < 0.5 && secs > 4 && secs < 7.5, { tl, went, secs });
  ok('11 then asks "Back on the mark?" Yes / No', await vis('#calTestAsk') && (await txt('#calTestAsk span')) === 'Back on the mark?');
  await shot('2-tested');
  await click('tYes'); await page.waitForTimeout(300);
  ok('11b Yes: done, question gone', (await pill()) === '✓ Done' && !(await vis('#calTestAsk')) && (await txt('#calMsg')) === 'Turn test done.');
  ok('12 no page scroll (turn test)', !(await scrolls()));

  // the saved value is a little off (a platter that really needs 4.5): Test misses, No + arrows fix it
  await sim('plotterSim.grbl.true[1] = 4.5');
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('turnTest');
  await page.waitForTimeout(700);
  await idle('turnTest', 'Test');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  await click('tNo'); await page.waitForTimeout(300);
  const pNo = await pill(), mNo = await txt('#calMsg');
  await arrow('tCcw', 0.5, 9);
  const back = await sim('plotterSim.grbl.real()[1]') - before;
  const n2 = await txt('#calNew101');
  ok('13 Test stops short, No reopens the step, 0.5° clicks bring the mark round, new value 4.5', Math.abs(went - 355.52) < 0.5 && pNo === 'In progress' && mNo === 'Line the mark up with the arrows, then press Done.' && Math.abs(back - 360) < 0.1 && Math.abs(+n2 - 4.5) < 0.005, { went, back, n2, pNo, mNo });
  await shot('3-test-miss');
  await click('done');
  await page.waitForTimeout(1500);
  ok('14 corrected value saved', Math.abs(+(await sim('plotterSim.grbl.settings[101]')) - 4.5) < 0.002 && (await pill()) === '✓ Done', await sim('plotterSim.grbl.settings[101]'));
  // Stop during Test
  before = await sim('plotterSim.grbl.real()[1]');
  await click('turnTest');
  await page.waitForTimeout(1500);
  await click('turnTest');
  await idle('turnTest', 'Test');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  ok('15 Test can be stopped', went > 2 && went < 200 && (await txt('#calMsg')) === 'Stopped.' && !(await vis('#calTestAsk')), { went, msg: await txt('#calMsg') });

  // ----- step 2: Turn direction (a question, nothing is drawn) -----
  await click('next');
  ok('16x Next button names step 2; cw/ccw off before Start', (await txt('#calCount')) === 'Step 2 of 5' && (await dis(act('ccw')))[0] === true);
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('start'); await msgIs('Which way did it go?');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  // a center gap measured earlier, typed into Settings
  await page.evaluate(() => { document.getElementById('offset').value = 1.5; document.getElementById('offset').dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('offset').dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(300);
  const d0 = { flip: !!(await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir') };
  await click('ccw');
  await page.waitForTimeout(300);
  const d1 = { flip: (await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir'), box: await page.evaluate(() => document.getElementById('flip').checked) };
  await click('start'); await msgIs('Which way did it go?');
  await click('cw');
  await page.waitForTimeout(300);
  const d2 = { flip: (await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir'), box: await page.evaluate(() => document.getElementById('flip').checked) };
  ok('16a step 2 is Turn direction: Start goes a quarter turn', (await title()).startsWith('Turn direction') && Math.abs(went - 90) < 0.5, { t: await title(), went });
  ok('16b Counterclockwise = reverse rotation on (gap changes sides), Clockwise = off; pill done', d0.flip === false && d0.offset === 1.5 && d1.flip === true && d1.offset === -1.5 && d1.box === true && d1.say === 'Saved: counterclockwise' && d2.flip === false && d2.offset === 1.5 && d2.box === false && d2.say === 'Saved: clockwise' && (await pill()) === '✓ Done', { d0, d1, d2 });
  await shot('4-direction');
  ok('16c no page scroll (turn direction)', !(await scrolls()));

  // ----- step 3: Pen height -----
  await click('next');
  ok('16 step 3 is Pen height, with Up / Down / Done', (await title()).startsWith('Pen height') && (await txt('.calstep:not([hidden]) .calsay')) === 'Click Down until the tip just touches. Press Done.' && (await txt(act('zUp'))) === 'Up' && (await txt(act('zDown'))) === 'Down' && (await dis(act('zDown')))[0] === true, await title());
  ok('17 Reverse direction is shown and on', (await vis('#calZFlipRow')) && await page.evaluate(() => document.getElementById('calZFlip').checked));
  await click('start'); await page.waitForTimeout(300);
  const z0 = await sim('plotterSim.grbl.pos[2]');
  await click('zDown'); await idle('zDown', 'Down');
  await click('zDown'); await idle('zDown', 'Down');
  await click('zUp'); await idle('zUp', 'Up');
  await page.click('.calstep:not([hidden]) .zstep [data-step="0.5"]');
  await click('zDown'); await idle('zDown', 'Down');
  const z1 = await sim('plotterSim.grbl.pos[2]');
  ok('18 Down lowers (Z-), Up lifts (Z+): 0.1 0.1 -0.1 0.5 down = 0.6', Math.abs(z0 - z1 - 0.6) < 1e-6, { z0, z1 });
  await click('done');
  await msgIs('Saved. The pen is up, ready to travel.');
  const z2 = await sim('plotterSim.grbl.pos[2]');
  const s2 = await stored();
  ok('19 Done lifts the pen 100 steps and saves up 0 / down -1', Math.abs(z2 - z1 - 1) < 1e-6 && s2.penUp === 0 && s2.penDown === -1 && Math.abs(await wz()) < 1e-6 && (await txt('#calPens')) === 'Saved: up 0 · down -1' && (await pill()) === '✓ Done', { z2, s2, pens: await txt('#calPens'), msg: await txt('#calMsg'), err: await txt('#calErr') });
  await shot('4-pen');
  ok('20 no page scroll (pen height)', !(await scrolls()));
  await page.click('#calZFlipRow');
  await page.waitForTimeout(1500);
  const off = { set: await sim('plotterSim.grbl.settings[3]'), zFlip: (await stored()).zFlip, box: await page.evaluate(() => document.getElementById('calZFlip').checked), pen: (await stored()).penDown };
  await page.click('#calZFlipRow');
  await page.waitForTimeout(1500);
  const on = { set: await sim('plotterSim.grbl.settings[3]'), zFlip: (await stored()).zFlip, box: await page.evaluate(() => document.getElementById('calZFlip').checked) };
  ok('21 the switch clears and sets the pen bit in $3', off.set === '0.000' && off.zFlip === false && off.box === false && off.pen === -1 && on.set === '4.000' && on.zFlip === true && on.box === true, { off, on, err: await txt('#calErr') });

  // ----- step 4: Carriage test (the pen stays up) -----
  await click('next');
  ok('22 step 4 is Carriage test', (await title()).startsWith('Carriage test') && (await txt('#calCount')) === 'Step 4 of 5', await title());
  await click('start'); await page.waitForTimeout(300);
  await page.click('.calstep:not([hidden]) .xstep [data-step="10"]');
  await click('xLeft'); await idle('xLeft', 'Left');
  const x0 = await sim('plotterSim.grbl.real()[0]');
  const zSent = () => sim('plotterSim.grbl.received.filter(l => /Z/.test(l)).length');
  const zBefore = await zSent();
  await sim('plotterSim.grbl.speed = 3');
  await click('move');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 10, x0, { timeout: 30000, polling: 20 });
  const mid = { label: await txt(act('move')), z: await wz() };
  await idle('move', 'Move');
  await sim('plotterSim.grbl.speed = 1');
  const x1 = await sim('plotterSim.grbl.real()[0]');
  ok('23 Move: 50 mm toward the center with the pen up; plotter says 8.0', mid.label === 'Stop' && Math.abs(mid.z) < 1e-6 && Math.abs(x0 - x1 - 50) < 0.01 && (await txt('#calLine')) === '8.0' && (await txt('#calMsg')) === 'Type what the ruler says.', { x0, x1, mid, line: await txt('#calLine'), msg: await txt('#calMsg'), err: await txt('#calErr') });
  await page.fill('#calRuler', '50.5');
  await page.waitForTimeout(300);
  ok('24 ruler 50.5 (read by eye) -> new $100 40.000, the belt\'s exact value', (await txt('#calNew100')) === '40.000' && (await txt('#calRaw100')) === 'measured 39.604', { n: await txt('#calNew100'), raw: await txt('#calRaw100') });
  await shot('5-carriage');
  ok('25 no page scroll (carriage test)', !(await scrolls()));
  await click('done');
  await msgIs('Saved $100=40.000.');
  ok('26 saved, pill done, Move off until Redo', (await sim('plotterSim.grbl.settings[100]')) === '40.000' && (await txt('#calLine')) === '–' && (await pill()) === '✓ Done' && (await dis(act('move')))[0] === true, await txt('#calMsg'));
  // Redo, move and stop early: how far it went so far is what the ruler checks
  await click('start'); await page.waitForTimeout(300);
  const x2 = await sim('plotterSim.grbl.real()[0]');
  await click('move');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 12, x2, { timeout: 30000, polling: 20 });
  await click('move');
  await idle('move', 'Move');
  const x3 = await sim('plotterSim.grbl.real()[0]');
  const said = +(await txt('#calLine'));
  ok('27 Redo + stopped early: the plotter says how far it really went', (await pill()) === 'In progress' && x2 - x3 > 12 && x2 - x3 < 45 && Math.abs(said - (x2 - x3)) < 0.06, { went: x2 - x3, said, msg: await txt('#calMsg') });
  ok('28 the pen was never moved in the carriage test', (await zSent()) === zBefore, { zBefore, now: await zSent() });
  await page.fill('#calRuler', String(said));
  await page.waitForTimeout(300);
  await click('done'); await page.waitForTimeout(1200);

  // ----- step 5: Find center (a mark, half a turn, the mark again) -----
  await click('next');
  ok('29 step 5 of 5 is Find center, five numbered lines, carriage buttons under line 3, Next says Finished', (await title()).startsWith('Find center') && (await txt('#calCount')) === 'Step 5 of 5' && await page.evaluate(() => [...document.querySelectorAll('.calstep:not([hidden]) .calsay')].map(p => p.textContent[0]).join('') === '12345') && await page.evaluate(() => { const p = [...document.querySelectorAll('.calstep:not([hidden]) .calsay')][2]; return p.nextElementSibling.querySelector('[data-act=xRight2]') !== null; }) && (await txt(act('next'))) === 'Finished', await title());
  ok('30 Done and Half turn wait for Start', (await dis(act('done')))[0] === true && (await dis(act('half')))[0] === true);
  ok('30b line 4 says it is optional, its ? shows why with a picture', (await page.evaluate(() => [...document.querySelectorAll('.calstep:not([hidden]) .calsay')][3].textContent)).startsWith('4. Only if needed') && await page.evaluate(() => !!document.querySelector('#calGapHelp svg.calpic')));
  await page.click('.calstep:not([hidden]) [data-q=calGapHelp]');
  await page.waitForTimeout(300);
  await shot('6a-gap-help');
  await page.click('.calstep:not([hidden]) [data-q=calGapHelp]');
  await page.click('.calstep:not([hidden]) .xstep [data-step="10"]');
  await sim('plotterSim.grbl.speed = 20');
  for (let i = 0; i < 6; i++) { await click('xLeft'); await idle('xLeft', 'Left'); }        // out to the left, the mark goes here
  const xa = await sim('plotterSim.grbl.real()[0]');
  const ya = await sim('plotterSim.grbl.real()[1]');
  await click('start'); await msgIs('Now press Half turn.');
  await sim('plotterSim.grbl.speed = 6');
  await click('half'); await idle('half', 'Half turn');
  const yb = await sim('plotterSim.grbl.real()[1]');
  ok('31 Half turn turns 180°, then says what is next', Math.abs(yb - ya - 180) < 0.3 && (await txt('#calMsg')) === 'Now jog right to the mark.' && (await dis(act('done')))[0] === false, { turned: yb - ya, msg: await txt('#calMsg'), err: await txt('#calErr') });
  await click('done'); await page.waitForTimeout(900);
  ok('32 Done before jogging across is refused', (await txt('#calErr')) === 'Jog right to the mark first.', await txt('#calErr'));
  await sim('plotterSim.grbl.speed = 20');
  await page.click('.calstep:not([hidden]) .xstep2 [data-step="10"]');
  for (let i = 0; i < 8; i++) { await click('xRight2'); await idle('xRight2', 'Right'); }    // 80 mm to the other side, line 3's buttons
  await page.click('.calstep:not([hidden]) .dstep [data-step="1"]');
  await click('yCcw'); await idle('yCcw', '↺');
  await click('yCcw'); await idle('yCcw', '↺');                                               // the mark needed 2° more
  await sim('plotterSim.grbl.speed = 1');
  const xb = await sim('plotterSim.grbl.real()[0]');
  const yc = await sim('plotterSim.grbl.real()[1]');
  await shot('6-center');
  ok('33 no page scroll (find center)', !(await scrolls()));
  await sim('plotterSim.grbl.speed = 20');
  await click('done');
  await page.waitForFunction(() => /^Center set/.test(document.getElementById('calMsg').textContent) || document.getElementById('calErr').textContent, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await sim('plotterSim.grbl.speed = 1');
  const xc = await sim('plotterSim.grbl.real()[0]');
  const s5 = await stored();
  ok('33a ↺ twice turned the platter 2° further', Math.abs(yc - yb - 2) < 0.3 && Math.abs(xa - xb - 80) < 0.05, { extra: yc - yb, across: xa - xb });
  ok('33b Done goes halfway and saves the gap (40 mm out, 2°: 0.7 mm); all five dots green', Math.abs(xc - (xa + xb) / 2) < 0.05 && (await txt('#calMsg')) === 'Center set. The pen is over it now. Center gap 0.7 mm.' && s5.offset === 0.7 && await page.evaluate(() => document.getElementById('offset').value === '0.7') && await page.evaluate(() => [...document.querySelectorAll('#calDots i')].every(i => i.dataset.st === 'done')), { xa, xb, xc, msg: await txt('#calMsg'), err: await txt('#calErr'), offset: s5.offset });
  ok('33c nothing in the whole tool draws', !(await page.evaluate(() => /draw|paper/i.test(document.getElementById('calTool').textContent))), await page.evaluate(() => (document.getElementById('calTool').textContent.match(/.{0,20}(draw|paper).{0,20}/i) || [''])[0]));
  await shot('7-center-set');

  // ----- quick check: the plotter moves, the user answers -----
  const answerAll = async list => {
    for (const a of list) {
      await page.waitForFunction(() => !document.getElementById('calAnswer').hidden, null, { timeout: 60000 });
      await page.waitForTimeout(200);
      await page.click(`#calAnswer [data-act=${a ? 'yes' : 'no'}]`);
    }
    await page.waitForFunction(() => document.querySelector('[data-act=checkGo]').textContent !== 'Stop', null, { timeout: 60000 });
    await page.waitForTimeout(300);
  };
  await page.click('#calCheckOpen');
  await page.waitForTimeout(300);
  ok('37 Check opens the quick check', (await title()).startsWith('Quick check') && (await txt('#calCount')) === 'Quick check' && (await pill()) === 'Not run');
  await sim('plotterSim.grbl.speed = 20');
  await click('checkGo');
  await page.waitForFunction(() => !document.getElementById('calAnswer').hidden, null, { timeout: 60000 });
  const q1 = { ask: await txt('#calAsk'), x: await sim('plotterSim.grbl.pos[0] - plotterSim.grbl.wco[0]') };
  await shot('8-check');
  ok('38 first: pen to the center, asks about it', q1.ask === 'Is the tip over the platter\'s center?' && Math.abs(q1.x) < 0.01, q1);
  await page.click('#calAnswer [data-act=yes]');
  await page.waitForFunction(() => !document.getElementById('calAnswer').hidden && document.getElementById('calAsk').textContent.startsWith('Is the tip just'), null, { timeout: 60000 });
  const zd = await wz();
  await page.click('#calAnswer [data-act=yes]');
  await page.waitForFunction(() => document.getElementById('calAsk').textContent.startsWith('Is the tip 5 cm'), null, { timeout: 60000 });
  const x5 = await sim('plotterSim.grbl.pos[0] - plotterSim.grbl.wco[0]');
  const zu = await wz();
  const yBefore = await sim('plotterSim.grbl.real()[1]');
  await page.click('#calAnswer [data-act=yes]');
  await page.waitForFunction(() => document.getElementById('calAsk').textContent.startsWith('Did it turn'), null, { timeout: 60000 });
  const turned = await sim('plotterSim.grbl.real()[1]') - yBefore;
  await answerAll([true, true]);
  ok('39 pen down at -1 then up; 5 cm out; one full turn; all Yes = ✓ All good', Math.abs(zd + 1) < 1e-6 && Math.abs(zu) < 1e-6 && Math.abs(x5 - 50) < 0.01 && Math.abs(Math.abs(turned) - 360) < 0.5 && (await pill()) === '✓ All good' && (await txt('#calMsg')) === 'Everything is calibrated.' && (await txt('#calRedo')) === '', { zd, zu, x5, turned, p: await pill(), msg: await txt('#calMsg'), err: await txt('#calErr') });
  await click('checkGo');
  await answerAll([true, true, false, true, true]);
  const redo = await txt('#calRedo');
  await shot('9-check-no');
  ok('40 a No on the carriage = ✗ Problems and a Redo step 4 button', (await pill()) === '✗ Problems' && redo === 'Redo step 4', { p: await pill(), redo });
  await page.click('#calRedo [data-go="4"]');
  await page.waitForTimeout(300);
  ok('41 Redo step 4 opens the carriage test', (await title()).startsWith('Carriage test'));
  ok('41b no page scroll (quick check)', !(await scrolls()));
  await click('next');
  await click('next');
  await page.waitForTimeout(300);
  ok('42 Finished closes the tool', !(await vis('#calTool')) || !(await vis('.calstep[data-n="5"]')), await vis('#calTool'));
  await sim('plotterSim.grbl.speed = 1');
  await page.waitForTimeout(400);
  // main panel: the up arrow is Z+
  const zb = await sim('plotterSim.grbl.pos[2]');
  await page.click('[data-jog="Z+"]');
  await page.waitForTimeout(900);
  ok('34 main panel: the up arrow sends Z+', (await sim('plotterSim.grbl.pos[2]')) > zb, { zb, za: await sim('plotterSim.grbl.pos[2]') });
  ok('35 no warning left', !(await txt('#mMsg')).includes('look wrong'), await txt('#mMsg'));

  // ----- Tim, 2026-11-14: turned one circle, pressed Test without Save, got 2 full turns.
  // The plotter holds 4.5, the platter really needs 3: 240 clicked degrees are one real turn.
  const held = +(await sim('plotterSim.grbl.settings[101]'));
  await sim('plotterSim.grbl.true[1] = 3');
  await page.click('#calOpen');
  await page.waitForTimeout(900);
  await click('start'); await idle('start', 'Redo');
  before = await sim('plotterSim.grbl.real()[1]');
  await arrow('tCcw', 90, 2);
  await arrow('tCcw', 5, 12);
  const one = await sim('plotterSim.grbl.real()[1]') - before;
  const shown = await txt('#calNew101');
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('turnTest');
  await page.waitForTimeout(700);
  await idle('turnTest', 'Test');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  const kept = +(await sim('plotterSim.grbl.settings[101]'));
  ok('36 Test right after the arrows (no Done) checks the NEW value: one circle, not two', held > 4 && Math.abs(one - 360) < 0.01 && shown === '3.000' && Math.abs(went - 360) < 1 && kept === 3 && await vis('#calTestAsk'), { held, one, shown, went, kept, msg: await txt('#calMsg'), err: await txt('#calErr') });
} catch (e) { errors.push('SCRIPT: ' + e.message); await shot('error').catch(() => {}); }
R.errors = errors;
writeFileSync(`${out}/${mode}-report.json`, JSON.stringify(R, null, 1));
await browser.close();
