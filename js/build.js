// Build guide page: 3D model (build/plotter.glb) showing only the current step's parts.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PARTS, STEPS } from './build-steps.js';

const $ = id => document.getElementById(id);
const canvas = $('view'), stage = $('stage');

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a90, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-300, 500, 400);
scene.add(sun);

const MODEL_NAMES = new Set(STEPS.flatMap(s => s.show === 'all' ? [] : s.show));
const nodes = {};          // glb node name -> Object3D
let current = 0, tween = null, lit = [];

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
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    }
    if (MODEL_NAMES.has(o.name)) nodes[o.name] ??= o;
  });
  scene.add(gltf.scene);
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
  const dist = sphere.radius / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * camera.aspect))) * 1.1;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const p1 = sphere.center.clone().addScaledVector(dir, dist);
  if (jump) { camera.position.copy(p1); controls.target.copy(sphere.center); return; }
  tween = { t0: performance.now(), p0: camera.position.clone(), p1, c0: controls.target.clone(), c1: sphere.center.clone() };
}

function highlight(names) {
  lit.forEach(o => o.traverse(m => m.isMesh && m.material.emissive.setHex(0)));
  lit = names.map(n => nodes[n]).filter(Boolean);
  lit.forEach(o => o.traverse(m => m.isMesh && m.material.emissive.setHex(0x334488)));
}

// ---------- panel ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const link = ([label, href]) => {
  const a = el('a', '', label);
  a.href = href;
  if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
  if (href.endsWith('.stl')) a.download = '';
  return a;
};

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
});

function go(i, jump = false) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  current = i;
  const s = STEPS[i];
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
      li.append(el('span', 'qty', `${p.qty}×`), el('span', 'name', p.name));
      if (p.buy) li.append(link(p.buy));
      if (p.model) li.onclick = e => {
        if (e.target.tagName === 'A') return;
        const on = !li.classList.contains('lit');
        ul.querySelectorAll('.lit').forEach(x => x.classList.remove('lit'));
        li.classList.toggle('lit', on);
        highlight(on ? p.model : []);
      };
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

  highlight([]);
  if (!Object.keys(nodes).length) return;
  const shown = s.show === 'all' ? null : new Set(s.show);
  Object.entries(nodes).forEach(([n, o]) => { o.visible = !shown || shown.has(n); });
  fit(Object.values(nodes).filter(o => o.visible), s.view, jump);
}
