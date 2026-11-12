// Build guide page: 3D model (build/plotter.glb for V1, build/plotter-v2.glb for V2) showing only the
// current step's parts. Tap a part (in the model or the list) to highlight it and show what it does.
import { createView, THREE } from './build-view.js';
import * as V1 from './build-steps.js';
import * as V2 from './build-steps-v2.js';
import { extras, extrasV2 } from './build-look.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), stage = $('stage');
const view = createView(canvas, stage);

const VERSIONS = {
  1: { ...V1, url: 'build/plotter.glb', extras: () => extras() },
  2: { ...V2, url: 'build/plotter-v2.glb', extras: () => extrasV2() },
};
let ver = new URLSearchParams(location.search).get('v') === '2' ? 2 : 1;
let PARTS, STEPS;
const base = n => n.split('__')[0];
let nodes = {};            // glb node name ("x_motor__caps") -> Object3D, for the shown version
let current = 0, selected = null, loading = 0;

// ---------- version tabs (V1 | V2) ----------
function setVersion(v, jump = true) {
  if (selected) select(selected);
  ver = v;
  ({ PARTS, STEPS } = VERSIONS[v]);
  const url = new URL(location.href);
  if (v === 2) url.searchParams.set('v', '2'); else url.searchParams.delete('v');
  history.replaceState(null, '', url);
  $('ver').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  $('simLink').href = `sim.html?v=${v}`;
  $('steps').replaceChildren(...STEPS.map((s, i) => {
    const b = el('button', '', i === 0 ? 'i' : String(i));
    b.type = 'button';
    b.title = s.title;
    b.onclick = () => go(i);
    return b;
  }));
  nodes = {};
  go(Math.min(current, STEPS.length - 1), jump);
  const mine = ++loading;
  $('loading').hidden = false;
  $('loading').textContent = 'Loading model…';
  const { url: glb, extras: ex } = VERSIONS[v];
  view.load(glb, ex).then(root => {
    if (mine !== loading) return;            // switched again meanwhile
    const names = new Set(STEPS.flatMap(s => s.show === 'all' ? [] : s.show));
    root.traverse(o => { if (names.has(base(o.name))) nodes[o.name] ??= o; });
    view.show(root);
    $('loading').hidden = true;
    go(current, jump);
  }, () => { if (mine === loading) $('loading').textContent = 'Could not load the 3D model.'; });
}
$('ver').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && +b.dataset.v !== ver) setVersion(+b.dataset.v, false);
});

// ---------- selecting a part ----------
const nodesOf = key => Object.entries(nodes)
  .filter(([n]) => PARTS[key].model.some(m => m === n || m === base(n))).map(([, o]) => o);
const partOf = name => Object.keys(PARTS).find(k => PARTS[k].model?.includes(name))
  ?? Object.keys(PARTS).find(k => PARTS[k].model?.includes(base(name)));

function select(key) {
  if (selected) nodesOf(selected).forEach(o => o.traverse(m => m.isMesh && m.material.emissive.setHex(0)));
  selected = key === selected ? null : key;
  if (selected) nodesOf(selected).forEach(o => o.traverse(m => {
    if (m.isMesh) { m.material.emissive.setHex(0x2f5bff); m.material.emissiveIntensity = 0.5; }
  }));
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
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
function link([label, href]) {
  const a = el('a', '', label);
  a.href = href;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  if (href.endsWith('.stl')) a.download = '';
  return a;
}

$('prev').onclick = () => go(current - 1);
$('next').onclick = () => go(current + 1);
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

  if (s.parts.length) {
    box.append(el('h3', '', 'Parts'));
    const ul = el('ul', 'parts');
    s.parts.forEach(key => {
      const p = PARTS[key];
      const li = el('li', p.model ? 'has-model' : '');
      li.dataset.key = key;
      li.append(el('span', 'qty', `${p.qty}×`), el('span', 'name', p.name));
      if (p.buy) li.append(link(p.buy));
      if (p.model) li.onclick = e => { if (e.target.tagName !== 'A') select(key); };
      ul.append(li);
    });
    box.append(ul);
  }
  if (s.links) {
    box.append(el('h3', '', 'Links'));
    const ul = el('ul', 'links');
    s.links.forEach(l => { const li = el('li'); li.append(link(l)); ul.append(li); });
    box.append(ul);
  }

  if (!Object.keys(nodes).length) return;
  const shown = s.show === 'all' ? null : new Set(s.show);
  Object.entries(nodes).forEach(([n, o]) => { o.visible = !shown || shown.has(base(n)); });
  view.fit(Object.values(nodes).filter(o => o.visible), s.view, jump);
}

setVersion(ver);
