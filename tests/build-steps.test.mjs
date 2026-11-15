// Build guide content checks, for every version: js/build-steps.js (V1, build/plotter.glb) and each
// js/build-steps-v<N>.js (build/plotter-v<N>.glb). Every name a step shows or animates must be a node
// in that version's model, every part a step lists must exist, and every local download must exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const EXTRAS = new Set(['wires']);          // drawn in JS by build-look.js, not in the GLB

const versions = readdirSync(join(root, 'js')).flatMap(f => {
  const m = /^build-steps(?:-v(\d+))?\.js$/.exec(f);
  return m ? [{ file: f, glb: m[1] ? `build/plotter-v${m[1]}.glb` : 'build/plotter.glb' }] : [];
});

function glbNodes(path) {
  const buf = readFileSync(join(root, path));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString());
  const names = new Set();
  for (const n of json.nodes) if (n.name) { names.add(n.name); names.add(n.name.split('__')[0]); }
  return names;
}

test('there is a steps file for V1, V2 and V3', () => {
  assert.ok(versions.some(v => v.file === 'build-steps.js'));
  assert.ok(versions.some(v => v.file === 'build-steps-v2.js'));
  assert.ok(versions.some(v => v.file === 'build-steps-v3.js'));
});

test('V3 reuses V2 steps without changing them', async () => {
  const v2 = await import(pathToFileURL(join(root, 'js', 'build-steps-v2.js')).href);
  const before = JSON.stringify(v2.STEPS);
  await import(pathToFileURL(join(root, 'js', 'build-steps-v3.js')).href);
  assert.equal(JSON.stringify(v2.STEPS), before);
  assert.equal(v2.STEPS.length, 11);
});

for (const v of versions) {
  test(`${v.file}: steps, parts, animations and links fit ${v.glb}`, async () => {
    const { PARTS, STEPS } = await import(pathToFileURL(join(root, 'js', v.file)).href);
    assert.ok(existsSync(join(root, v.glb)), `${v.glb} is missing`);
    const nodes = glbNodes(v.glb);
    const isNode = n => nodes.has(n) || EXTRAS.has(n.split('__')[0]);
    for (const [key, p] of Object.entries(PARTS)) {
      for (const m of p.model ?? []) assert.ok(isNode(m), `part ${key}: model "${m}" is not in ${v.glb}`);
      for (const l of [p.buy, p.plate].filter(Boolean)) {
        if (!/^https?:/.test(l[1])) assert.ok(existsSync(join(root, l[1])), `part ${key}: ${l[1]} does not exist`);
      }
    }
    STEPS.forEach((s, i) => {
      const at = `step ${i} (${s.title})`;
      assert.ok(Array.isArray(s.do) && s.do.length, `${at}: no instructions`);
      if (s.show !== 'all') for (const n of s.show) assert.ok(isNode(n), `${at}: shows "${n}", not in ${v.glb}`);
      for (const k of s.parts) assert.ok(PARTS[k], `${at}: part "${k}" is not in PARTS`);
      for (const k of Object.keys(s.use ?? {})) assert.ok(s.parts.includes(k), `${at}: use "${k}" is not in its parts`);
      for (const key of Object.keys(s.fly ?? {})) {
        for (const n of key.split(',')) {
          assert.ok(s.show === 'all' || s.show.includes(n), `${at}: flies "${n}" but doesn't show it`);
        }
        const how = s.fly[key], d = Array.isArray(how) ? how[0] : how;
        assert.ok(['up', 'down', 'front', 'back', 'left', 'right'].includes(d), `${at}: "${d}" is not a direction`);
      }
      for (const [, href] of s.links ?? []) {
        const file = href.split('?')[0];
        if (!/^https?:/.test(href) && file !== './') assert.ok(existsSync(join(root, file)), `${at}: link ${href} does not exist`);
      }
    });
  });
}
