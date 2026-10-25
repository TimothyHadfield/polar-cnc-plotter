// Build guide page: 3D model (build/plotter.glb) showing only the current step's parts.
// Tap a part (in the model or the list) to highlight it and show what it does.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTS, STEPS } from './build-steps.js';
import { dress, extras, studio } from './build-look.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), stage = $('stage');

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(), 0.02).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a968e, 0.3));
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-250, 500, 300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 50, far: 1500 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

window.buildView = { camera, controls };   // for headless close-up checks
const MODEL_NAMES =new Set(STEPS.flatMap(s => s.show === 'all' ? [] : s.show));
const base = n => n.split('__')[0];
const nodes = {};          // glb node name ("x_motor__caps") -> Object3D
let current = 0, tween = null, selected = null;

function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

renderer.setAnimationLoop(t => {
  if (tween) {
    const k = Math.min(1, (t - tween.t0) / 600), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.c0, tween.c1, e);
    if (k === 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
});

new GLTFLoader().load('build/plotter.glb', gltf => {
  gltf.scene.add(...extras());
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      if (!o.geometry.parameters) o.geometry = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(35));   // smooth curves, sharp edges
      o.material = o.material.clone();                                           // own copy, for highlighting
      o.material.side = THREE.DoubleSide;
      o.material = dress(o);
      o.castShadow = o.receiveShadow = true;
    }
    if (MODEL_NAMES.has(base(o.name))) nodes[o.name] ??= o;
  });
  scene.add(gltf.scene);
  ground.position.y = new THREE.Box3().setFromObject(gltf.scene).min.y - 0.1;
  $('loading').hidden = true;
  go(current, true);
}, undefined, () => { $('loading').textContent = 'Could not load the 3D model.'; });

// ---------- camera ----------
function fit(objs, [az, el] = [-30, 25], jump = false) {
  const box = new THREE.Box3();
  objs.forEach(o => box.expandByObject(o));
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const dist = sphere.radius / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camera.aspect))) * 1.05;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const p1 = sphere.center.clone().addScaledVector(dir, dist);
  if (jump) { camera.position.copy(p1); controls.target.copy(sphere.center); return; }
  tween = { t0: performance.now(), p0: camera.position.clone(), p1, c0: controls.target.clone(), c1: sphere.center.clone() };
}

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
  ray.setFromCamera(ptr, camera);
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

STEPS.forEach((s, i) => {
  const b = el('button', '', i === 0 ? 'i' : String(i));
  b.type = 'button';
  b.title = s.title;
  b.onclick = () => go(i);
  $('steps').append(b);
});
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
  fit(Object.values(nodes).filter(o => o.visible), s.view, jump);
}
