// Headless check of Connect with a stand-in navigator.serial. usage: node portcheck.mjs <outdir> [baseUrl]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
const require = createRequire(os.homedir().replace(/\\/g, '/') + '/.claude/tools/');
const { webkit } = require('playwright');

const [out, base = 'http://localhost:8765/'] = process.argv.slice(2);
const browser = await webkit.launch();
const R = {};
const ok = (name, cond, detail) => { R[name] = (cond ? 'PASS' : 'FAIL') + (detail !== undefined ? ' · ' + JSON.stringify(detail) : ''); };

// known: what getPorts() returns ('good' = a port with a GRBL behind it, 'dead' = one that will not open)
function install(known) {
  window.__calls = { request: 0, open: 0, dir: null };
  const enc = new TextEncoder();
  const port = works => {
    let ctl, buf = '';
    const say = t => ctl.enqueue(enc.encode(t + '\r\n'));
    const p = {
      async open() {
        window.__calls.open++;
        if (!works) throw new Error('Failed to open serial port.');
        p.readable = new ReadableStream({ start(c) { ctl = c; setTimeout(() => say("Grbl 1.1h ['$' for help]"), 50); } });
        p.writable = new WritableStream({ write(chunk) {
          for (const b of chunk) {
            const ch = String.fromCharCode(b);
            if (ch === '?') say('<Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>');
            else if (ch === '\n') {
              const line = buf.trim(); buf = '';
              if (line === '$$') ['$3=0', '$100=40.000', '$101=4.444', '$102=250.000'].forEach(say);
              if (line.startsWith('$3=')) window.__calls.dir = line;
              say('ok');
            } else buf += ch;
          }
        } });
      },
      async close() {},
    };
    return p;
  };
  const list = known.map(k => port(k === 'good'));
  Object.defineProperty(navigator, 'serial', { configurable: true, value: {
    getPorts: async () => list,
    requestPort: async () => { window.__calls.request++; throw Object.assign(new Error('No port selected.'), { name: 'NotFoundError' }); },
    addEventListener() {},
  } });
}

async function scene(known) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(install, known);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + 'index.html', { waitUntil: 'load' });
  await page.waitForSelector('#connect', { state: 'visible', timeout: 30000 });
  const click = async () => { await page.click('#connect'); await page.waitForTimeout(1800); };
  const state = () => page.evaluate(() => ({ ...window.__calls, live: !document.getElementById('live').hidden, msg: document.getElementById('mMsg').textContent }));
  return { page, click, state, errors, done: () => ctx.close() };
}

try {
  let s = await scene(['good']);
  await s.click();
  let a = await s.state();
  ok('1 one known port: connects with no list', a.live && a.request === 0 && a.open === 1 && s.errors.length === 0, { ...a, errors: s.errors });
  ok('2 and the pen direction goes to the plotter on connect ($3=4)', a.dir === '$3=4', a.dir);
  await s.page.screenshot({ path: `${out}/port-connected.png` });
  await s.done();

  s = await scene(['dead']);
  await s.click();
  a = await s.state();
  await s.click();
  let b = await s.state();
  ok('3 known port will not open: says so, then the next Connect shows the list', !a.live && a.request === 0 && a.open === 1 && a.msg.startsWith('Could not open the port') && b.request === 1 && b.open === 1, { a, b, errors: s.errors });
  await s.done();

  s = await scene([]);
  await s.click();
  a = await s.state();
  ok('4 no known port: the list, as before', a.request === 1 && a.open === 0 && !a.live, a);
  await s.done();

  s = await scene(['good', 'good']);
  await s.click();
  a = await s.state();
  ok('5 two known ports: the list', a.request === 1 && a.open === 0, a);
  await s.done();
} catch (e) { R.error = e.message; }
writeFileSync(`${out}/port-report.json`, JSON.stringify(R, null, 1));
await browser.close();
