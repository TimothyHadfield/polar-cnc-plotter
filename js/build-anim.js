// Build guide animations: the parts a step adds fly in from an exploded offset, one after another,
// bolts and screws turn as they go in, and everything new glows for a moment. GLB nodes carry their
// geometry in world position (node transforms are identity), so spins turn about the part's own centre.
import { THREE } from './build-view.js';

const MOVE = 900, GLOW = 900;                    // ms: one part's flight, the glow after it lands
const GLOW_COLOR = 0x2f5bff;                      // the guide's highlight blue (build.js select())
// directions in the scad frame (x toward the X motor, y toward the back, z up) -> three.js (Y up)
const DIRS = { up: [0, 0, 1], down: [0, 0, -1], front: [0, -1, 0], back: [0, 1, 0], left: [-1, 0, 0], right: [1, 0, 0] };
export const dirVector = d => {
  const [x, y, z] = Array.isArray(d) ? d : DIRS[d] ?? DIRS.up;
  return new THREE.Vector3(x, z, -y).normalize();
};
const ease = k => 1 - (1 - k) ** 3;

export function createAnimator(view) {
  let run = null;

  function home(o) {
    o.userData.home ??= { p: o.position.clone(), q: o.quaternion.clone() };
    return o.userData.home;
  }
  function place(o, off, angle, axis, centre) {
    const h = home(o);
    o.quaternion.copy(h.q);
    o.position.copy(h.p).add(off);
    if (angle && axis) {
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      o.quaternion.premultiply(q);
      // turn about the part's centre, not the node origin
      o.position.add(centre.clone().sub(centre.clone().applyQuaternion(q)));
    }
  }
  function glow(objs, k) {
    for (const o of objs) o.traverse(m => {
      if (!m.isMesh || !m.material.emissive) return;
      m.material.emissive.setHex(k > 0 ? GLOW_COLOR : 0);
      m.material.emissiveIntensity = 0.55 * k;
    });
  }

  // items: [{ objs, dir (THREE.Vector3), dist (mm), spin (turns, about dir), at (ms delay) }]
  function play(items) {
    stop();
    if (!items.length) return;
    for (const it of items) {
      const box = new THREE.Box3();
      it.objs.forEach(o => { home(o); box.expandByObject(o); });
      const c = box.getCenter(new THREE.Vector3());
      it.centre = it.objs[0]?.parent ? it.objs[0].parent.worldToLocal(c) : c;
      it.objs.forEach(o => place(o, it.dir.clone().multiplyScalar(it.dist), it.spin * Math.PI * 2, it.dir, it.centre));
    }
    run = { t0: performance.now(), items, end: Math.max(...items.map(i => i.at)) + MOVE + GLOW };
    glow(items.flatMap(i => i.objs), 1);
  }

  function stop(glowOff = true) {
    if (!run) return;
    for (const it of run.items) it.objs.forEach(o => place(o, new THREE.Vector3(), 0));
    if (glowOff) glow(run.items.flatMap(i => i.objs), 0);
    run = null;
    view.invalidate(true);
  }

  view.onFrame(t => {
    if (!run) return false;
    const now = t - run.t0;
    for (const it of run.items) {
      const k = Math.min(1, Math.max(0, (now - it.at) / MOVE)), e = ease(k), left = 1 - e;
      it.objs.forEach(o => place(o, it.dir.clone().multiplyScalar(it.dist * left), it.spin * Math.PI * 2 * left, it.dir, it.centre));
      const g = now < it.at + MOVE ? 1 : Math.max(0, 1 - (now - it.at - MOVE) / GLOW);
      glow(it.objs, g);
    }
    if (now >= run.end) stop();
    return true;
  });

  return { play, stop, get running() { return !!run; } };
}
