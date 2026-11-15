// Build guide page: 3D model of the version picked in the tabs, showing only the current step's parts.
// The parts a step adds fly into place (js/build-anim.js; Replay plays it again). Tap a part (in the
// model or the list) to highlight it and show what it does.
//
// Adding a version (e.g. V3) = a steps file (same shape as js/build-steps.js) + its GLB + one line in
// VERSIONS below. A steps file may also export `extras()` (objects drawn in JS, like the wires).
import { createView, THREE } from './build-view.js';
import { createAnimator, dirVector } from './build-anim.js';
import { extras, extrasV2, extrasV3 } from './build-look.js';

const VERSIONS = {
  1: { label: 'V1', steps: () => import('./build-steps.js'), url: 'build/plotter.glb', extras, sim: 'sim.html?v=1' },
  2: { label: 'V2', steps: () => import('./build-steps-v2.js'), url: 'build/plotter-v2.glb', extras: extrasV2, sim: 'sim.html?v=2' },
  // the simulator has no V3 machine yet: its link opens V2's, which plots the same way
  3: { label: 'V3', steps: () => import('./build-steps-v3.js'), url: 'build/plotter-v3.glb', extras: extrasV3, sim: 'sim.html?v=2' },
};

const $ = id => document.getElementById(id);
const canvas = $('view'), stage = $('stage');
const view = createView(canvas, stage);
const anim = createAnimator(view);

const want = new URLSearchParams(location.search).get('v');
let ver = VERSIONS[want] ? want : '1';
let PARTS = {}, STEPS = [];
const base = n => n.split('__')[0];
let nodes = {};            // glb node name ("x_motor__caps") -> Object3D, for the shown version
let current = 0, selected = null, loading = 0, modelReady = false;

// ---------- version tabs (V1 | V2 | ...) ----------
$('ver').replaceChildren(...Object.entries(VERSIONS).map(([v, d]) => {
  const b = el('button', '', d.label);
  b.type = 'button';
  b.dataset.v = v;
  return b;
}));

async function setVersion(v, jump = true) {
  if (selected) select(selected);
  anim.stop();
  ver = v;
  const d = VERSIONS[v];
  const url = new URL(location.href);
  if (v !== '1') url.searchParams.set('v', v); else url.searchParams.delete('v');
  history.replaceState(null, '', url);
  $('ver').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('simLink').href = d.sim || '#';
  $('simLink').style.visibility = d.sim ? '' : 'hidden';
  const mine = ++loading;
  modelReady = false;
  $('loading').hidden = false;
  $('loading').textContent = 'Loading model…';
  const mod = await d.steps();
  if (mine !== loading) return;
  ({ PARTS, STEPS } = mod);
  $('steps').style.gridTemplateColumns = `repeat(${STEPS.length}, 1fr)`;
  $('steps').replaceChildren(...STEPS.map((s, i) => {
    const b = el('button', '', i === 0 ? 'i' : String(i));
    b.type = 'button';
    b.title = s.title;
    b.onclick = () => go(i);
    return b;
  }));
  nodes = {};
  go(Math.min(current, STEPS.length - 1), jump);
  view.load(d.url, mod.extras ?? d.extras ?? (() => [])).then(root => {
    if (mine !== loading) return;            // switched again meanwhile
    const names = new Set(STEPS.flatMap(s => s.show === 'all' ? [] : s.show));
    root.traverse(o => { if (names.has(base(o.name))) nodes[o.name] ??= o; });
    view.show(root);
    $('loading').hidden = true;
    modelReady = true;
    go(current, jump);
  }, () => { if (mine === loading) $('loading').textContent = 'Could not load the 3D model.'; });
}
$('ver').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.v !== ver) setVersion(b.dataset.v, false);
});

// ---------- selecting a part ----------
const nodesOf = key => Object.entries(nodes)
  .filter(([n]) => PARTS[key].model.some(m => m === n || m === base(n))).map(([, o]) => o);
const partOf = name => Object.keys(PARTS).find(k => PARTS[k].model?.includes(name))
  ?? Object.keys(PARTS).find(k => PARTS[k].model?.includes(base(name)));

function select(key) {
  anim.stop();
  if (selected) nodesOf(selected).forEach(o => o.traverse(m => m.isMesh && m.material.emissive.setHex(0)));
  selected = key === selected ? null : key;
  if (selected) nodesOf(selected).forEach(o => o.traverse(m => {
    if (m.isMesh) { m.material.emissive.setHex(0x2f5bff); m.material.emissiveIntensity = 0.5; }
  }));
  view.invalidate();
  document.querySelectorAll('.parts li').forEach(li => li.classList.toggle('lit', li.dataset.key === selected));
  const card = $('card');
  card.hidden = !selected;
  if (!selected) return;
  const p = PARTS[selected];
  $('cardName').textContent = p.qty > 1 ? `${p.name} · ${p.qty}×` : p.name;
  $('cardAbout').textContent = p.about ?? '';
  $('cardBuy').replaceChildren(...(p.buy ? [link(p.buy)] : []));
}
$('cardClose').onclick = () => select(selected);

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function hit(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ptr, view.camera);
  for (const h of ray.intersectObjects(Object.values(nodes), true)) {
    if (!h.object.visible) continue;
    for (let o = h.object; o; o = o.parent) if (nodes[o.name] === o) return partOf(o.name);
  }
  return null;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;   // a drag turns the view
  const key = hit(e);
  if (key) select(key);
  else if (selected) select(selected);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && !e.buttons) canvas.style.cursor = hit(e) ? 'pointer' : '';
});

// ---------- panel ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
function link([label, href]) {
  const a = el('a', '', label);
  a.href = href;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  if (/\.(stl|3mf|pdf)$/.test(href)) a.download = '';
  return a;
}
function list(title, items, cls) {
  if (!items?.length) return [];
  const ul = el('ul', cls);
  items.forEach(t => ul.append(el('li', '', t)));
  return [el('h3', '', title), ul];
}

$('prev').onclick = () => go(current - 1);
$('next').onclick = () => go(current + 1);
$('replay').onclick = () => animate(STEPS[current]);
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(current + 1);
  if (e.key === 'ArrowLeft') go(current - 1);
  if (e.key === 'Escape' && selected) select(selected);
});

function go(i, jump = false) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  current = i;
  const s = STEPS[i];
  if (selected) select(selected);
  anim.stop();
  [...$('steps').children].forEach((b, j) => b.classList.toggle('on', j === i));
  $('prev').disabled = i === 0;
  $('next').disabled = i === STEPS.length - 1;

  const box = $('step');
  box.replaceChildren();
  box.scrollTop = 0;
  box.append(el('h2', '', i === 0 ? s.title : `${i}. ${s.title}`));
  const ol = el('ol');
  s.do.forEach(t => ol.append(el('li', '', t)));
  box.append(ol);
  if (s.check) {
    const p = el('p', 'check');
    p.append(el('b', '', 'Check: '), s.check);
    box.append(p);
  }

  if (s.parts.length) {
    box.append(el('h3', '', 'Parts'));
    const ul = el('ul', 'parts');
    s.parts.forEach(key => {
      const p = PARTS[key];
      const li = el('li', p.model ? 'has-model' : '');
      li.dataset.key = key;
      li.append(el('span', 'qty', `${s.use?.[key] ?? p.qty}×`), el('span', 'name', p.name));
      if (p.print) li.querySelector('.name').append(el('small', '', ` ${p.print}`));
      if (p.buy) li.append(link(p.buy));
      if (p.plate) li.append(link(p.plate));
      if (p.model) li.onclick = e => { if (e.target.tagName !== 'A') select(key); };
      ul.append(li);
    });
    box.append(ul);
  }
  if (s.tools?.length) {
    box.append(el('h3', '', 'Tools'), el('p', 'tools', s.tools.join(' · ')));
  }
  box.append(...list('Tips', s.tips, 'tips'));
  if (s.links) {
    box.append(el('h3', '', 'Links'));
    const ul = el('ul', 'links');
    s.links.forEach(l => { const li = el('li'); li.append(link(l)); ul.append(li); });
    box.append(ul);
  }

  $('replay').style.visibility = 'hidden';
  if (!modelReady) return;
  const shown = s.show === 'all' ? null : new Set(s.show);
  Object.entries(nodes).forEach(([n, o]) => { o.visible = !shown || shown.has(base(n)); });
  view.fit(Object.values(nodes).filter(o => o.visible), s.view, jump);
  animate(s);
}

// The parts a step puts on (`fly`: part -> direction, or [direction, turns]) fly in from that side.
// Without `fly`, the parts shown for the first time in the guide come down from above.
function animate(s) {
  if (!modelReady || s.show === 'all') return;
  let fly = s.fly;
  if (!fly) {
    const seen = new Set(STEPS.slice(0, STEPS.indexOf(s)).flatMap(t => t.show === 'all' ? [] : t.show));
    fly = Object.fromEntries(s.show.filter(n => !seen.has(n)).map(n => [n, 'up']));   // `fly: {}` = nothing moves
  }
  const tops = name => Object.entries(nodes)
    .filter(([n, o]) => base(n) === name && !(o.parent && base(o.parent.name) === name && nodes[o.parent.name]))
    .map(([, o]) => o);
  const box = new THREE.Box3();
  Object.values(nodes).filter(o => o.visible).forEach(o => box.expandByObject(o));
  const size = box.isEmpty() ? 200 : box.getBoundingSphere(new THREE.Sphere()).radius;
  const items = Object.entries(fly).map(([name, how], k) => {
    const [d, turns = 0] = Array.isArray(how) && typeof how[0] === 'string' ? how : [how];
    return { objs: name.split(',').flatMap(tops), dir: dirVector(d), dist: Math.max(40, size * 0.7), spin: turns, at: k * 260 };
  }).filter(it => it.objs.length);
  if (!items.length) return;
  $('replay').style.visibility = '';
  anim.play(items);
}

setVersion(ver);
