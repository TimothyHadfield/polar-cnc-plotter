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
  ok('06 opens on Turn test, step 1 of 6; the settings step is gone', (await title()).startsWith('Turn test') && (await txt('#calCount')) === 'Step 1 of 6' && !(await page.evaluate(() => document.body.textContent.includes('Current settings'))), { t: await title(), c: await txt('#calCount'), err: await txt('#calErr') });
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

  // ----- step 2: Pen height -----
  await click('next');
  ok('16 step 2 is Pen height, with Up / Down / Touching', (await title()).startsWith('Pen height') && (await txt(act('zUp'))) === 'Up' && (await txt(act('zDown'))) === 'Down' && (await txt(act('touch'))) === 'Touching' && !(await page.evaluate(() => document.getElementById('calTool').textContent.includes('slowly') && false)), await title());
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

  // ----- step 3: Carriage test -----
  await click('next');
  ok('22 step 3 is Carriage test', (await title()).startsWith('Carriage test') && (await txt('#calCount')) === 'Step 3 of 6', await title());
  await page.click('.calstep:not([hidden]) .xstep [data-step="10"]');
  await click('xLeft'); await idle('xLeft', 'Left');
  const x0 = await sim('plotterSim.grbl.real()[0]');
  await sim('plotterSim.grbl.speed = 3');
  await click('line');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 10, x0, { timeout: 30000, polling: 20 });
  const mid = { label: await txt(act('line')), z: await wz() };
  await idle('line', 'Draw line');
  await sim('plotterSim.grbl.speed = 1');
  const x1 = await sim('plotterSim.grbl.real()[0]');
  ok('23 Draw line: pen down, 50 mm toward the center, pen up; plotter says 8.0', mid.label === 'Stop' && Math.abs(mid.z + 1) < 1e-6 && Math.abs(x0 - x1 - 50) < 0.01 && Math.abs(await wz()) < 1e-6 && (await txt('#calLine')) === '8.0', { x0, x1, mid, line: await txt('#calLine'), msg: await txt('#calMsg'), err: await txt('#calErr') });
  await page.fill('#calRuler', '50');
  await page.waitForTimeout(300);
  ok('24 ruler 50 -> new $100 40.000', (await txt('#calNew100')) === '40.000', await txt('#calNew100'));
  await shot('5-carriage');
  ok('25 no page scroll (carriage test)', !(await scrolls()));
  await click('save100');
  await page.waitForTimeout(1500);
  ok('26 saved', (await sim('plotterSim.grbl.settings[100]')) === '40.000' && (await txt('#calMsg')) === 'Saved $100=40.000. Draw again to check.' && (await txt('#calLine')) === '–', await txt('#calMsg'));
  // draw again and stop early: the length so far is what the ruler checks
  const x2 = await sim('plotterSim.grbl.real()[0]');
  await click('line');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 12, x2, { timeout: 30000, polling: 20 });
  await click('line');
  await idle('line', 'Draw line');
  const x3 = await sim('plotterSim.grbl.real()[0]');
  const said = +(await txt('#calLine'));
  ok('27 stopped early: it stops, the pen lifts, the length matches the paper', x2 - x3 > 12 && x2 - x3 < 45 && Math.abs(said - (x2 - x3)) < 0.06 && Math.abs(await wz()) < 1e-6, { drawn: x2 - x3, said, msg: await txt('#calMsg') });

  // ----- step 4: Find center -----
  await click('next');
  ok('28 step 4 is Find center, four numbered lines', (await title()).startsWith('Find center') && await page.evaluate(() => [...document.querySelectorAll('.calstep:not([hidden]) .calsay')].map(p => p.textContent[0]).join('') === '1234'), await title());
  await shot('6-center');
  ok('29 no page scroll (find center)', !(await scrolls()));
  ok('30 Cross and Set center wait for the circle', (await dis(act('cross')))[0] && (await dis(act('center')))[0]);
  const xa = await sim('plotterSim.grbl.real()[0]');
  await sim('plotterSim.grbl.speed = 20');
  await click('circle');
  await page.waitForTimeout(600);
  await idle('circle', 'Draw again');
  await sim('plotterSim.grbl.speed = 1');
  ok('31 circle drawn, told what is next', (await txt('#calMsg')) === 'Circle drawn. Now press Cross slowly.' && (await dis(act('cross')))[0] === false, { msg: await txt('#calMsg'), err: await txt('#calErr') });
  await sim('plotterSim.grbl.speed = 3');
  await click('cross');
  await page.waitForFunction(x => Math.abs(plotterSim.grbl.real()[0] - x) > 30, xa, { timeout: 30000, polling: 20 });
  await click('cross');
  await idle('cross', 'Cross slowly');
  await sim('plotterSim.grbl.speed = 1');
  const xb = await sim('plotterSim.grbl.real()[0]');
  await click('center');
  await idle('center', 'Set center');
  const xc = await sim('plotterSim.grbl.real()[0]');
  ok('32 Set center goes halfway between the two sides', Math.abs(xc - (xa + xb) / 2) < 0.05 && (await txt('#calMsg')) === 'Center set. The pen is over it.', { xa, xb, xc, msg: await txt('#calMsg'), err: await txt('#calErr') });
  await shot('7-center-set');

  // ----- the rest is as before -----
  await click('next');
  const t5 = await title();
  await click('next');
  ok('33 then Center gap and Mirror check', t5.startsWith('Center gap') && (await title()).startsWith('Mirror check') && (await txt('#calCount')) === 'Step 6 of 6', { t5, t6: await title() });
  await page.click('#calTool [data-close-tool]');
  await page.waitForTimeout(400);
  // main panel: the up arrow is Z+
  const zb = await sim('plotterSim.grbl.pos[2]');
  await page.click('[data-jog="Z+"]');
  await page.waitForTimeout(900);
  ok('34 main panel: the up arrow sends Z+', (await sim('plotterSim.grbl.pos[2]')) > zb, { zb, za: await sim('plotterSim.grbl.pos[2]') });
  ok('35 no warning left', !(await txt('#mMsg')).includes('look wrong'), await txt('#mMsg'));
} catch (e) { errors.push('SCRIPT: ' + e.message); await shot('error').catch(() => {}); }
R.errors = errors;
writeFileSync(`${out}/${mode}-report.json`, JSON.stringify(R, null, 1));
await browser.close();
