// Headless check of the calibration defaults on sim.html?defaults (js/defaults.js).
// usage: node tools/check-defaults.mjs phone|desktop <outdir> [baseUrl]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
const require = createRequire(os.homedir().replace(/\\/g, '/') + '/.claude/tools/');
const { webkit, devices } = require('playwright');

const [mode, out, base = 'http://localhost:8765/'] = process.argv.slice(2);
const browser = await webkit.launch();
const ctx = await browser.newContext(mode === 'phone' ? { ...devices['iPhone 15'], viewport: { width: 393, height: 659 } } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const R = {};
const ok = (name, cond, detail) => { R[name] = (cond ? 'PASS' : 'FAIL') + (detail !== undefined ? ' · ' + JSON.stringify(detail) : ''); };
const txt = sel => page.evaluate(s => document.querySelector(s)?.textContent ?? null, sel);
const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }, sel);
const inView = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, sel);
const cmd = async t => { await page.evaluate(t => { document.getElementById('cmd').value = t; document.getElementById('cmdForm').requestSubmit(); }, t); await page.waitForTimeout(900); };
const sim = js => page.evaluate(js);
const shot = n => page.screenshot({ path: `${out}/${mode}-${n}.png` });
const defs = () => page.evaluate(() => JSON.parse(localStorage.getItem('polar-plotter-defaults') || 'null'));
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('polar-plotter-settings') || '{}'));
const act = a => `.calstep:not([hidden]) [data-act=${a}]`;
const idle = async (a, label) => { await page.waitForFunction(([s, l]) => { const b = document.querySelector(s); return b.textContent === l && !b.disabled; }, [act(a), label], { timeout: 60000 }); await page.waitForTimeout(300); };
const asked = () => page.waitForFunction(() => !document.getElementById('calConfirm').hidden, null, { timeout: 30000 });

try {
  await page.goto(base + 'sim.html?v=2&defaults', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.plotterSim, null, { timeout: 60000 });
  ok('00 no defaults before connecting', (await defs()) === null);
  await page.click('#connect');
  await page.waitForSelector('#live', { state: 'visible' });
  await page.waitForTimeout(1200);
  const d0 = await defs();
  ok('01 first connect with believable values saves them as the defaults', d0?.grbl?.[100] === 47.62 && d0?.grbl?.[101] === 17.132 && d0?.app?.flip === false && (await txt('#log')).includes('calibration saved as the defaults') && !(await vis('#restoreDefaults')), d0);

  // the plotter's $101 changed behind the app's back: offered back
  await cmd('$101=20');
  ok('02 a plotter off its defaults says so and shows Restore defaults', (await txt('#mMsg')) === 'Not your defaults: Platter steps ($101) 20 → 17.132.' && await vis('#restoreDefaults'), await txt('#mMsg'));
  await shot('1-restore');
  await page.click('#restoreDefaults');
  await page.waitForTimeout(1500);
  ok('03 Restore defaults puts it back', (await sim('plotterSim.grbl.settings[101]')) === '17.132' && !(await vis('#restoreDefaults')) && (await txt('#mMsg')) === 'Defaults restored.', { v: await sim('plotterSim.grbl.settings[101]'), msg: await txt('#mMsg') });

  // Calibrate: turn direction -> asks; Keep leaves everything; Change saves and moves the default
  await page.click('#calOpen');
  await page.waitForTimeout(900);
  await page.click('#calTool [data-act=next]');
  await sim('plotterSim.grbl.speed = 6');
  await page.click(act('start'));
  await idle('start', 'Redo');
  await page.click(act('ccw'));
  await asked();
  const list = await txt('#calChanges');
  const seen = { inView: await inView('#calConfirm [data-act=change]') };
  await shot('2-confirm');
  ok('04 Counterclockwise asks "Change your defaults?" with old → new, buttons in view', list === 'Turn direction clockwise → counterclockwise' && seen.inView && (await txt('#calConfirm .calask')) === 'Change your defaults?', { list, seen });
  await page.click('#calConfirm [data-act=keep]');
  await page.waitForTimeout(400);
  ok('05 Keep old: nothing saved, question gone', (await stored()).flip !== true && (await defs()).app.flip === false && !(await vis('#calConfirm')) && (await txt('#calMsg')) === 'Kept the defaults.', { flip: (await stored()).flip, msg: await txt('#calMsg') });
  await page.click(act('start')); await idle('start', 'Redo');
  await page.click(act('ccw'));
  await asked();
  await page.click('#calConfirm [data-act=change]');
  await page.waitForTimeout(400);
  ok('06 Change: saved, and it is the new default', (await stored()).flip === true && (await defs()).app.flip === true && (await txt('#calMsg')) === 'Saved: counterclockwise.', { flip: (await stored()).flip, d: (await defs()).app });
  await page.click(act('start')); await idle('start', 'Redo');
  await page.click(act('ccw'));
  await page.waitForTimeout(600);
  ok('07 the same answer again does not ask', !(await vis('#calConfirm')) && (await txt('#calMsg')) === 'Saved: counterclockwise.');

  // Turn test: measured a new $101; Done asks; Keep leaves the plotter alone
  await page.click('#calTool [data-act=back]');
  await sim('plotterSim.grbl.true[1] = 4.444');
  await page.click(act('start'));
  await idle('start', 'Redo');
  await page.click('.calstep:not([hidden]) .tstep [data-step="90"]');
  for (let i = 0; i < 1; i++) { await page.click(act('tCcw')); await idle('tCcw', '↺'); }   // 17.132 vs true 4.444: a "90°" click is ~347°
  await page.click('.calstep:not([hidden]) .tstep [data-step="0.5"]');
  const target = await sim('plotterSim.grbl.real()[1]');
  await page.click(act('done'));
  await asked();
  const l2 = await txt('#calChanges');
  await page.click('#calConfirm [data-act=keep]');
  await page.waitForTimeout(800);
  ok('08 Turn test Done asks before changing $101; Keep leaves the plotter at 17.132', /^Platter steps \(\$101\) 17\.132 → /.test(l2) && (await sim('plotterSim.grbl.settings[101]')) === '17.132' && (await txt('#calMsg')) === 'Kept the defaults.', { l2, v: await sim('plotterSim.grbl.settings[101]'), target });
  await shot('3-kept');
  ok('09 no page scroll', !(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1)));
} catch (e) { errors.push('SCRIPT: ' + e.message); await shot('error').catch(() => {}); }
R.errors = errors;
writeFileSync(`${out}/${mode}-defaults.json`, JSON.stringify(R, null, 1));
await browser.close();
