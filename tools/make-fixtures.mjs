// Reads the sample SVGs with the real js/svg.js in headless Chromium and saves the strokes as
// test fixtures. Needs the local server running (node tools/serve.mjs) and Playwright.
//   node tools/make-fixtures.mjs [playwright module path]
import { writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const pwPath = process.argv[2] || join(homedir(), '.claude/tools/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(pwPath).href);
const base = 'http://localhost:8765/';

const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(base + 'tests/blank.html');
  await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
  for (const name of ['hello-world', 'uvu-logo']) {
    const strokes = await page.evaluate(async (n) => {
      const { svgToStrokes } = await import('/js/svg.js');
      const text = await (await fetch(`/samples/${n}.svg`)).text();
      return svgToStrokes(text);
    }, name);
    const pts = strokes.reduce((a, s) => a + s.length, 0);
    // keep fixtures small: 3 decimals is 1/1000 of an SVG unit
    const small = strokes.map(s => s.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]));
    await writeFile(new URL(`../tests/fixtures/${name}.json`, import.meta.url), JSON.stringify(small));
    console.log(`${name}: ${strokes.length} strokes, ${pts} points`);
  }
  // the picture sample is drawn here (our own, so it's free to publish): bold HELLO on white
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1000; c.height = 460;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = 'bold 300px Arial, Helvetica, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HELLO', 500, 240);
    return c.toDataURL('image/png').split(',')[1];
  });
  await writeFile(new URL('../samples/hello-block.png', import.meta.url), Buffer.from(png, 'base64'));
  // pictures: decoded and shrunk by the real js/image.js, saved as grayscale
  for (const file of ['hello-block.png']) {
    const img = await page.evaluate(async (f) => {
      const { loadGray } = await import('/js/image.js');
      const blob = await (await fetch(`/samples/${f}`)).blob();
      const { gray, w, h } = await loadGray(blob);
      let s = '';
      for (let i = 0; i < gray.length; i += 0x8000) s += String.fromCharCode(...gray.subarray(i, i + 0x8000));
      return { w, h, gray: btoa(s) };
    }, file);
    const name = file.replace(/\.\w+$/, '');
    await writeFile(new URL(`../tests/fixtures/${name}.gray.json`, import.meta.url), JSON.stringify(img));
    console.log(`${file}: ${img.w}x${img.h} grayscale`);
  }
} finally {
  await browser.close();
}
