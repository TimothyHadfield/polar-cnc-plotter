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
const scrolls = () => page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1);
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

  // ----- step 1: Turn test + Test -----
  await page.click('#calOpen');
  await page.waitForTimeout(900);
  ok('06 opens on Turn test, step 1 of 5; the settings step is gone', (await title()).startsWith('Turn test') && (await txt('#calCount')) === 'Step 1 of 5' && !(await page.evaluate(() => document.body.textContent.includes('Current settings'))), { t: await title(), c: await txt('#calCount'), err: await txt('#calErr') });
  ok('07 Test is off until the platter value is believable', (await dis(act('turnTest')))[0] === true);
  await shot('1-turn');
  let before = await sim('plotterSim.grbl.real()[1]');
  await click('turn');
  await page.waitForFunction(b => plotterSim.grbl.real()[1] - b >= 335, before, { timeout: 60000, polling: 20 });
  await sim('plotterSim.grbl.speed = 0.05');   // the last stretch in slow motion, so Stop lands on the mark
  await page.waitForFunction(b => plotterSim.grbl.real()[1] - b >= 359.6, before, { timeout: 90000, polling: 20 });
  await click('turn');
  await sim('plotterSim.grbl.speed = 1');
  await page.waitForSelector(act('save101') + ':not([disabled])');
  ok('08 one turn gives 4.444', (await txt('#calNew101')) === '4.444', { shown: await txt('#calNew101'), raw: await txt('#calRaw101') });
  await click('save101');
  await page.waitForTimeout(1500);
  ok('09 saved, and told to press Test', (await sim('plotterSim.grbl.settings[101]')) === '4.444' && (await txt('#calMsg')) === 'Saved $101=4.444. Press Test to check.' && (await dis(act('turnTest')))[0] === false, await txt('#calMsg'));
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('turnTest');
  await page.waitForTimeout(700);
  const tl = await txt(act('turnTest'));
  await idle('turnTest', 'Test');
  await sim('plotterSim.grbl.speed = 1');
  let went = await sim('plotterSim.grbl.real()[1]') - before;
  ok('10 Test turns one full circle (button is Stop meanwhile)', tl === 'Stop' && Math.abs(went - 360) < 0.5, { tl, went });
  ok('11 lined up: nothing to save', (await txt('#calMsg')) === 'Mark lined up? Done. If not, nudge to it and Save.' && (await dis(act('save101')))[0] === true && (await txt('#calNew101')) === '4.444', { msg: await txt('#calMsg'), n: await txt('#calNew101') });
  await shot('2-tested');
  ok('12 no page scroll (turn test)', !(await scrolls()));

  // the saved value is a little off (a platter that really needs 4.5): Test misses, Further fixes it
  await sim('plotterSim.grbl.true[1] = 4.5');
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('turnTest');
  await page.waitForTimeout(700);
  await idle('turnTest', 'Test');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  await click('turnMore'); await idle('turnMore', 'Further');
  await click('turnMore'); await idle('turnMore', 'Further');
  await page.click('.calstep:not([hidden]) .tstep [data-step="0.5"]');
  await click('turnMore'); await idle('turnMore', 'Further');
  const back = await sim('plotterSim.grbl.real()[1]') - before;
  const n2 = await txt('#calNew101');
  ok('13 Test stops short, Further brings the mark round, new value 4.5', Math.abs(went - 355.52) < 0.5 && Math.abs(back - 360) < 0.1 && Math.abs(+n2 - 4.5) < 0.002, { went, back, n2 });
  await shot('3-test-miss');
  await click('save101');
  await page.waitForTimeout(1500);
  ok('14 corrected value saved', Math.abs(+(await sim('plotterSim.grbl.settings[101]')) - 4.5) < 0.002, await sim('plotterSim.grbl.settings[101]'));
  // Stop during Test
  before = await sim('plotterSim.grbl.real()[1]');
  await click('turnTest');
  await page.waitForTimeout(1500);
  await click('turnTest');
  await idle('turnTest', 'Test');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  ok('15 Test can be stopped', went > 2 && went < 200 && (await txt('#calMsg')) === 'Stopped.' && (await txt('#calNew101')) === '–', { went, msg: await txt('#calMsg') });

  // ----- step 2: Turn direction (a question, nothing is drawn) -----
  await click('next');
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('quarter'); await idle('quarter', 'Turn');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  // a center gap measured earlier, typed into Settings
  await page.evaluate(() => { document.getElementById('offset').value = 1.5; document.getElementById('offset').dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('offset').dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(300);
  const d0 = { flip: !!(await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir') };
  await click('ccw');
  await page.waitForTimeout(300);
  const d1 = { flip: (await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir'), box: await page.evaluate(() => document.getElementById('flip').checked) };
  await click('cw');
  await page.waitForTimeout(300);
  const d2 = { flip: (await stored()).flip, offset: (await stored()).offset, say: await txt('#calDir'), box: await page.evaluate(() => document.getElementById('flip').checked) };
  ok('16a step 2 is Turn direction: Turn goes a quarter turn', (await title()).startsWith('Turn direction') && Math.abs(went - 90) < 0.5, { t: await title(), went });
  ok('16b Counterclockwise = reverse rotation on (gap changes sides), Clockwise = off', d0.flip === false && d0.offset === 1.5 && d1.flip === true && d1.offset === -1.5 && d1.box === true && d1.say === 'Saved: counterclockwise' && d2.flip === false && d2.offset === 1.5 && d2.box === false && d2.say === 'Saved: clockwise', { d0, d1, d2 });
  await shot('4-direction');
  ok('16c no page scroll (turn direction)', !(await scrolls()));

  // ----- step 3: Pen height -----
  await click('next');
  ok('16 step 3 is Pen height, with Up / Down / Touching', (await title()).startsWith('Pen height') && (await txt('.calstep:not([hidden]) .calsay')) === 'Click Down until the tip just touches.' && (await txt(act('zUp'))) === 'Up' && (await txt(act('zDown'))) === 'Down' && (await txt(act('touch'))) === 'Touching' && !(await page.evaluate(() => document.getElementById('calTool').textContent.includes('slowly') && false)), await title());
  ok('17 Reverse direction is shown and on', (await vis('#calZFlipRow')) && await page.evaluate(() => document.getElementById('calZFlip').checked));
  const z0 = await sim('plotterSim.grbl.pos[2]');
  await click('zDown'); await idle('zDown', 'Down');
  await click('zDown'); await idle('zDown', 'Down');
  await click('zUp'); await idle('zUp', 'Up');
  await page.click('.calstep:not([hidden]) .zstep [data-step="0.5"]');
  await click('zDown'); await idle('zDown', 'Down');
  const z1 = await sim('plotterSim.grbl.pos[2]');
  ok('18 Down lowers (Z-), Up lifts (Z+): 0.1 0.1 -0.1 0.5 down = 0.6', Math.abs(z0 - z1 - 0.6) < 1e-6, { z0, z1 });
  await click('touch');
  await idle('touch', 'Touching');
  const z2 = await sim('plotterSim.grbl.pos[2]');
  const s2 = await stored();
  ok('19 Touching lifts the pen 100 steps and saves up 0 / down -1', Math.abs(z2 - z1 - 1) < 1e-6 && s2.penUp === 0 && s2.penDown === -1 && Math.abs(await wz()) < 1e-6 && (await txt('#calPens')) === 'Saved: up 0 · down -1' && (await txt('#calMsg')) === 'Saved. The pen is up, ready to travel.', { z2, s2, pens: await txt('#calPens'), msg: await txt('#calMsg'), err: await txt('#calErr') });
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
  ok('23 Move: 50 mm toward the center with the pen up; plotter says 8.0', mid.label === 'Stop' && Math.abs(mid.z) < 1e-6 && Math.abs(x0 - x1 - 50) < 0.01 && (await txt('#calLine')) === '8.0' && (await txt('#calMsg')) === 'Type how far the pen moved.', { x0, x1, mid, line: await txt('#calLine'), msg: await txt('#calMsg'), err: await txt('#calErr') });
  await page.fill('#calRuler', '50.5');
  await page.waitForTimeout(300);
  ok('24 ruler 50.5 (read by eye) -> new $100 40.000, the belt\'s exact value', (await txt('#calNew100')) === '40.000' && (await txt('#calRaw100')) === 'measured 39.604', { n: await txt('#calNew100'), raw: await txt('#calRaw100') });
  await shot('5-carriage');
  ok('25 no page scroll (carriage test)', !(await scrolls()));
  await click('save100');
  await page.waitForTimeout(1500);
  ok('26 saved', (await sim('plotterSim.grbl.settings[100]')) === '40.000' && (await txt('#calMsg')) === 'Saved $100=40.000. Move again to check.' && (await txt('#calLine')) === '–', await txt('#calMsg'));
  // move again and stop early: how far it went so far is what the ruler checks
  const x2 = await sim('plotterSim.grbl.real()[0]');
  await click('move');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 12, x2, { timeout: 30000, polling: 20 });
  await click('move');
  await idle('move', 'Move');
  const x3 = await sim('plotterSim.grbl.real()[0]');
  const said = +(await txt('#calLine'));
  ok('27 stopped early: it stops, and the plotter says how far it really went', x2 - x3 > 12 && x2 - x3 < 45 && Math.abs(said - (x2 - x3)) < 0.06, { went: x2 - x3, said, msg: await txt('#calMsg') });
  ok('28 the pen was never moved in the carriage test', (await zSent()) === zBefore, { zBefore, now: await zSent() });

  // ----- step 5: Find center (a mark, half a turn, the mark again) -----
  await click('next');
  ok('29 step 5 of 5 is Find center, three numbered lines', (await title()).startsWith('Find center') && (await txt('#calCount')) === 'Step 5 of 5' && await page.evaluate(() => [...document.querySelectorAll('.calstep:not([hidden]) .calsay')].map(p => p.textContent[0]).join('') === '123'), await title());
  ok('30 Set center waits for the half turn', (await dis(act('center')))[0] === true);
  await page.click('.calstep:not([hidden]) .xstep [data-step="10"]');
  await sim('plotterSim.grbl.speed = 20');
  for (let i = 0; i < 6; i++) { await click('xLeft'); await idle('xLeft', 'Left'); }        // out to the left, the mark goes here
  const xa = await sim('plotterSim.grbl.real()[0]');
  const ya = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('half'); await idle('half', 'Half turn');
  const yb = await sim('plotterSim.grbl.real()[1]');
  ok('31 Half turn turns 180°, then says what is next', Math.abs(yb - ya - 180) < 0.3 && (await txt('#calMsg')) === 'Now jog right to the mark.' && (await dis(act('center')))[0] === false, { turned: yb - ya, msg: await txt('#calMsg'), err: await txt('#calErr') });
  await click('center'); await page.waitForTimeout(900);
  ok('32 Set center before jogging across is refused', (await txt('#calErr')) === 'Jog right to the mark first.', await txt('#calErr'));
  await sim('plotterSim.grbl.speed = 20');
  for (let i = 0; i < 8; i++) { await click('xRight'); await idle('xRight', 'Right'); }      // 80 mm to the other side
  await click('yCcw'); await idle('yCcw', '↺');
  await click('yCcw'); await idle('yCcw', '↺');                                               // the mark needed 2° more
  await sim('plotterSim.grbl.speed = 1');
  const xb = await sim('plotterSim.grbl.real()[0]');
  const yc = await sim('plotterSim.grbl.real()[1]');
  await shot('6-center');
  ok('33 no page scroll (find center)', !(await scrolls()));
  const zc = await zSent();
  await sim('plotterSim.grbl.speed = 20');
  await click('center');
  await page.waitForFunction(() => /^Center set/.test(document.getElementById('calMsg').textContent) || document.getElementById('calErr').textContent, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await sim('plotterSim.grbl.speed = 1');
  const xc = await sim('plotterSim.grbl.real()[0]');
  const s5 = await stored();
  ok('33a ↺ twice turned the platter 2° further', Math.abs(yc - yb - 2) < 0.3 && Math.abs(xa - xb - 80) < 0.05, { extra: yc - yb, across: xa - xb });
  ok('33b Set center goes halfway and saves the gap (40 mm out, 2°: 0.7 mm)', Math.abs(xc - (xa + xb) / 2) < 0.05 && (await txt('#calMsg')) === 'Center set. Center gap 0.7 mm.' && s5.offset === 0.7 && await page.evaluate(() => document.getElementById('offset').value === '0.7'), { xa, xb, xc, msg: await txt('#calMsg'), err: await txt('#calErr'), offset: s5.offset });
  ok('33c nothing in the whole tool draws', !(await page.evaluate(() => /draw|paper/i.test(document.getElementById('calTool').textContent))), await page.evaluate(() => (document.getElementById('calTool').textContent.match(/.{0,20}(draw|paper).{0,20}/i) || [''])[0]));
  await shot('7-center-set');
  await page.click('#calTool [data-close-tool]');
  await page.waitForTimeout(400);
  // main panel: the up arrow is Z+
  const zb = await sim('plotterSim.grbl.pos[2]');
  await page.click('[data-jog="Z+"]');
  await page.waitForTimeout(900);
  ok('34 main panel: the up arrow sends Z+', (await sim('plotterSim.grbl.pos[2]')) > zb, { zb, za: await sim('plotterSim.grbl.pos[2]') });
  ok('35 no warning left', !(await txt('#mMsg')).includes('look wrong'), await txt('#mMsg'));

  // ----- Tim, 2026-11-14: stopped the slow turn after one circle, pressed Test, got 2 full turns.
  // The plotter holds about double the true value; Test is pressed WITHOUT Save.
  const held = +(await sim('plotterSim.grbl.settings[101]'));
  await sim('plotterSim.grbl.true[1] = 2.222');
  await page.click('#calOpen');
  await page.waitForTimeout(900);
  before = await sim('plotterSim.grbl.real()[1]');
  await click('turn');
  await page.waitForFunction(b => plotterSim.grbl.real()[1] - b >= 335, before, { timeout: 60000, polling: 20 });
  await sim('plotterSim.grbl.speed = 0.05');
  await page.waitForFunction(b => plotterSim.grbl.real()[1] - b >= 359.6, before, { timeout: 90000, polling: 20 });
  await click('turn');
  await sim('plotterSim.grbl.speed = 1');
  await page.waitForSelector(act('save101') + ':not([disabled])');
  const shown = await txt('#calNew101');
  before = await sim('plotterSim.grbl.real()[1]');
  await sim('plotterSim.grbl.speed = 6');
  await click('turnTest');
  await page.waitForTimeout(700);
  await idle('turnTest', 'Test');
  await sim('plotterSim.grbl.speed = 1');
  went = await sim('plotterSim.grbl.real()[1]') - before;
  const kept = +(await sim('plotterSim.grbl.settings[101]'));
  ok('36 Test right after the slow turn (no Save) checks the NEW value: one circle, not two', held > 4 && shown === '2.222' && Math.abs(went - 360) < 1 && kept === 2.222 && (await txt('#calMsg')) === 'Mark lined up? Done. If not, nudge to it and Save.', { held, shown, went, kept, msg: await txt('#calMsg'), err: await txt('#calErr') });
} catch (e) { errors.push('SCRIPT: ' + e.message); await shot('error').catch(() => {}); }
R.errors = errors;
writeFileSync(`${out}/${mode}-report.json`, JSON.stringify(R, null, 1));
await browser.close();
