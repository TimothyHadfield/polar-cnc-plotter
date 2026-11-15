// The 3D viewer shared by the build guide (build.html) and the simulator (sim.html): studio lights,
// soft shadows, orbit camera, and loading a plotter model (build/plotter*.glb) dressed to look real.
//
// Speed (11-15, Tim: "the 3D visual ... is a little slow moving around"): the scene is drawn only
// when something changed (camera moved, a step changed, an animation or the simulator moved a part),
// not 60 times a second; the shadow map is redrawn only when parts move, never for camera moves
// (the sun and the model stay put); phones draw at most 1.5 pixels per CSS pixel.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { dress, studio } from './build-look.js';

export { THREE };

export function createView(canvas, stage) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const touch = matchMedia('(pointer: coarse)').matches;
  // fixed: changing the drawing-buffer size mid-drag left the canvas blank in Safari's engine (tested 11-15)
  renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;          // redrawn by invalidate(true) only
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

  let tween = null, shown = null, dirty = true;
  const frame = [];
  // draw the next frame; `shadows` also redraws the shadow map (only needed when parts moved or hid)
  function invalidate(shadows = false) {
    dirty = true;
    if (shadows) renderer.shadowMap.needsUpdate = true;
  }
  const stats = { renders: 0, shadowRenders: 0 };
  window.buildView = { scene, camera, controls, renderer, stats, invalidate };   // for headless checks

  function resize() {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(stage);
  controls.addEventListener('change', () => invalidate());

  renderer.setAnimationLoop(t => {
    if (tween) {
      const k = Math.min(1, (t - tween.t0) / 600), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.c0, tween.c1, e);
      if (k === 1) tween = null;
      dirty = true;
    }
    for (const f of frame) if (f(t)) invalidate(true);   // a callback returns true when it moved something
    controls.update();                                    // fires 'change' while the camera still glides
    if (!dirty) return;
    dirty = false;
    stats.renders++;
    if (renderer.shadowMap.needsUpdate) stats.shadowRenders++;
    renderer.render(scene, camera);
  });

  // aim the camera at these objects from azimuth/elevation `view` (degrees)
  function fit(objs, [az, el] = [-30, 25], jump = false) {
    invalidate(true);                                    // callers change what is shown before fitting
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

  // a model, dressed (textures, smooth normals, shadows); each mesh gets its own material for highlighting
  const cache = new Map();
  // makeExtras() -> objects drawn in JS (wires, paper clip), added to the model once
  function load(url, makeExtras = () => []) {
    if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => new GLTFLoader().load(url, gltf => {
      const extras = makeExtras();
      if (extras.length) gltf.scene.add(...extras);
      gltf.scene.traverse(o => {
        if (o.isMesh) {
          if (!o.geometry.parameters) o.geometry = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(35));   // smooth curves, sharp edges
          o.material = o.material.clone();                                           // own copy, for highlighting
          o.material.side = THREE.DoubleSide;
          o.material = dress(o);
          o.castShadow = o.receiveShadow = true;
        }
      });
      resolve(gltf.scene);
    }, undefined, reject)));
    return cache.get(url);
  }
  // put one model on the stage (replacing the one shown)
  function show(root) {
    if (shown && shown !== root) scene.remove(shown);
    shown = root;
    scene.add(root);
    ground.position.y = new THREE.Box3().setFromObject(root).min.y - 0.1;
    invalidate(true);
  }

  return { scene, camera, controls, renderer, fit, load, show, invalidate, onFrame: f => frame.push(f) };
}
