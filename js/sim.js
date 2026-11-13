// Simulator page (sim.html): the plotter app's own controls on the right, talking to a pretend GRBL
// (js/simgrbl.js) instead of USB; the 3D plotter on the left moves with that GRBL's live position and
// leaves ink on the paper wherever the pen touches it.
//
// Machine axes as in polar.js: X = carriage mm from the platter centre, Y = platter degrees, Z = pen
// height (0 = tip on the paper). X+ moves the pen toward the idler (the -x end of the model: on V2 the
// pen can only reach far enough on that side, printed-frame.scad `ix`). Y+ turns the platter clockwise
// seen from above, the way polar.js draws with `flip` off, so default settings draw the right way round.
import { createView, THREE } from './build-view.js';
import { extras, extrasV2 } from './build-look.js';
import { SimGrbl } from './simgrbl.js';

const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;

// Positions are cad mm (x along the rods, y toward the back, z up), as in the .scad files.
const CARRIAGE = ['blocks', 'carriage_plate', 'stage', 'slider', 'pen_clip', 'knob', 'pen'];
const PEN = ['slider', 'pen_clip', 'knob', 'pen'];
const MACHINES = {
  1: {   // cad/plotter-assembly.scad
    url: 'build/plotter.glb', extras: () => extras(),
    centre: [0, 3], travel: [-85, 85],                // centre = pen_y in the scad
    platter: ['platter', 'paper', 'steel_strip', 'cd', 'big_pulley', 'spindle__rotor'],
    motor: { names: ['y_pulley', 'y_motor__shaft'], at: [-68, 3], ratio: 3 },     // 20T -> 60T belt
    pulleys: [{ name: 'x_pulley', at: [128, 106], r: 5.09 }, { name: 'idler_pulley', at: [-119.12, 106], r: 6.37 }],
    belt: { from: -119.12, to: 128, z: 106 },
  },
  2: {   // cad/printed-frame.scad assembly()
    url: 'build/plotter-v2.glb', extras: () => extrasV2(),
    // travel: the carriage plate meets the idler fork at 93.5 (OpenSCAD intersection, 11-12), the motor flange at 78
    centre: [0, 3], travel: [-78, 93],                // centre = pen_y in the scad
    platter: ['wheel', 'collar', 'pad', 'paper', 'clamp_ring', 'y_motor__shaft'],
    motor: null,                                                                       // direct drive
    pulleys: [{ name: 'x_pulley', at: [128, 130.5], r: 5.09 }, { name: 'idler', at: [-133, 130.5], r: 6.37 }],
    belt: { from: -133, to: 128, z: 130.5 },                                           // z = belt_z in the scad
  },
};
const P = (x, y, z) => new THREE.Vector3(x, z, -y);   // cad mm -> three.js (Y up)
const base = n => n.split('__')[0];

const view = createView($('view'), $('stage'));
let ver = new URLSearchParams(location.search).get('v') === '2' ? 2 : 1;
let rigged = null;            // the model on show, with its moving groups
let link = null;              // the SimGrbl while connected
let speed = 1;
let offset = [0, 0, 0];       // the real machine's position when GRBL last started counting from 0
let phys = [0, 0, 0];         // where the machine really is: offset + GRBL's machine position
let loading = 0;

// ---------- paper and ink ----------
const INK_PX = 2048;
const ink = document.createElement('canvas');
ink.width = ink.height = INK_PX;
const g = ink.getContext('2d');
const inkTex = new THREE.CanvasTexture(ink);
inkTex.colorSpace = THREE.SRGBColorSpace;
inkTex.anisotropy = 8;
function newPaper() {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, INK_PX, INK_PX);
  inkTex.needsUpdate = true;
}
newPaper();
let inkDirty = false, inkShown = 0;

// ---------- the model ----------
// The objects called `names` (whole node names or part names), outermost only.
function find(root, names) {
  const out = [];
  (function walk(o) {
    if (o !== root && (names.includes(o.name) || names.includes(base(o.name)))) { out.push(o); return; }
    o.children.forEach(walk);
  })(root);
  return out;
}
// A group turning about a vertical axis through cad (x, y), or about a front-back axis through (x, z)
function pivot(root, at, objs) {
  const p = new THREE.Group();
  p.position.copy(at);
  root.add(p);
  root.updateMatrixWorld(true);
  objs.forEach(o => p.attach(o));
  return p;
}
function rig(root, m) {
  if (root.userData.rig) return root.userData.rig;
  root.updateMatrixWorld(true);
  const carriage = pivot(root, new THREE.Vector3(), find(root, CARRIAGE.filter(n => !PEN.includes(n))));
  const pen = pivot(root, new THREE.Vector3(), find(root, PEN));
  carriage.attach(pen);
  const platter = pivot(root, P(m.centre[0], m.centre[1], 0), find(root, m.platter));
  const motor = m.motor && pivot(root, P(m.motor.at[0], m.motor.at[1], 0), find(root, m.motor.names));
  const pulleys = m.pulleys.map(q => ({ ...q, g: pivot(root, P(q.at[0], 0, q.at[1]), find(root, [q.name])) }));
  const paper = find(root, ['paper__sheet'])[0];
  paper.material.map = inkTex;
  paper.material.color.set(0xffffff);
  paper.geometry.computeBoundingBox();
  // belt: the lower runs stretch and shrink as the carriage moves; the part round the pegs moves with it
  const belts = find(root, ['x_belt']).flatMap(o => { const a = []; o.traverse(x => x.isMesh && a.push(x)); return a; })
    .map(mesh => ({ mesh, orig: mesh.geometry.attributes.position.array.slice() }));
  return (root.userData.rig = { root, m, carriage, pen, platter, motor, pulleys, belts, paper, bbox: paper.geometry.boundingBox, dx: null });
}

function stretchBelt(r, dx) {
  if (r.dx === dx) return;
  r.dx = dx;
  const { from: a, to: b, z } = r.m.belt, c0 = -30, c1 = 30;      // the carriage's belt ends sit within ±30
  const map = x => x <= a || x >= b ? x
    : x < c0 ? a + (x - a) * Math.max(0.02, (c0 + dx - a) / (c0 - a))
    : x > c1 ? b - (b - x) * Math.max(0.02, (b - c1 - dx) / (b - c1))
    : x + dx;
  for (const { mesh, orig } of r.belts) {
    const pos = mesh.geometry.attributes.position, arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = orig[i + 1] < z - 2.5 ? map(orig[i]) : orig[i];    // only the lower runs (below the pulley axes)
    }
    pos.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
}

const clampX = (m, x) => Math.min(m.travel[1], Math.max(m.travel[0], x));
function pose(r, [x, y, z]) {
  const dx = -clampX(r.m, x);
  r.carriage.position.x = dx;
  r.pen.position.y = Math.min(45, Math.max(-0.5, z));
  r.platter.rotation.y = -y * DEG;
  if (r.motor) r.motor.rotation.y = -y * DEG * r.m.motor.ratio;
  for (const q of r.pulleys) q.g.rotation.z = dx / q.r;
  stretchBelt(r, dx);
}

// ink from machine position a to b (pen must touch the paper the whole way)
function draw(r, a, b) {
  if (a[2] > 1e-4 || b[2] > 1e-4) return;
  const { bbox } = r, [cx, cy] = r.m.centre;
  const sx = bbox.max.x - bbox.min.x, sz = bbox.max.z - bbox.min.z;
  const xa = clampX(r.m, a[0]), xb = clampX(r.m, b[0]);
  const along = Math.max(Math.abs(xb - xa), Math.abs(b[1] - a[1]) * DEG * Math.max(Math.abs(xa), Math.abs(xb)));
  const n = Math.min(4000, Math.max(1, Math.ceil(along / 0.3)));
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = xa + (xb - xa) * i / n, y = (a[1] + (b[1] - a[1]) * i / n) * DEG;
    const lx = -x * Math.cos(y), ly = -x * Math.sin(y);            // pen tip on the unturned paper (cad mm)
    const px = (cx + lx - bbox.min.x) / sx * INK_PX, py = (1 - (-(cy + ly) - bbox.min.z) / sz) * INK_PX;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.lineWidth = 0.6 / sx * INK_PX;
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = 'rgba(190, 28, 36, 0.92)';      // red Sharpie, as on the build guide's paper
  g.stroke();
  inkDirty = true;
}

view.onFrame(t => {
  if (link?.alive) {
    const pts = link.trail.splice(0).concat([link.pos]).map(p => p.map((v, i) => v + offset[i]));
    if (rigged) for (const p of pts) { draw(rigged, phys, p); phys = p; }
    else phys = pts.at(-1);
  }
  if (rigged) pose(rigged, phys);
  if (inkDirty && t - inkShown > 80) { inkTex.needsUpdate = true; inkDirty = false; inkShown = t; }
});

// ---------- version tabs ----------
function setVersion(v, jump) {
  ver = v;
  const url = new URL(location.href);
  if (v === 2) url.searchParams.set('v', '2'); else url.searchParams.delete('v');
  history.replaceState(null, '', url);
  $('ver').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  $('buildLink').href = v === 2 ? 'build.html?v=2' : 'build.html';
  const mine = ++loading, m = MACHINES[v];
  $('loading').hidden = false;
  $('loading').textContent = 'Loading model…';
  view.load(m.url, m.extras).then(root => {
    if (mine !== loading) return;
    rigged = rig(root, m);
    pose(rigged, phys);
    view.show(root);
    view.fit([root], [-30, 25], jump);
    $('loading').hidden = true;
  }, () => { if (mine === loading) $('loading').textContent = 'Could not load the 3D model.'; });
}
$('ver').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && +b.dataset.v !== ver) setVersion(+b.dataset.v, false);
});
$('simSpeed').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  speed = +b.dataset.speed;
  if (link) link.speed = speed;
  $('simSpeed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});
$('newPaper').addEventListener('click', newPaper);
setVersion(ver, true);

// ---------- the plotter app, wired to the pretend GRBL ----------
// Connecting restarts GRBL (its position starts at 0 again), but the machine stays where it is.
window.plotterSim = {
  connect() {
    link?.close();
    offset = phys.slice();
    link = new SimGrbl({ speed });
    window.plotterSim.grbl = link;   // for headless checks
    return link;
  },
  // true while the pen is still right over the platter centre (radius 0), as it is when the page opens
  atCenter: () => Math.abs(phys[0]) < 0.01,
  // the G-code that puts the pen back over the real platter centre (radius 0), in GRBL's work coordinates
  centerMove: () => link && `G90 G0 X${(-offset[0] - link.wco[0]).toFixed(3)}`,
};
await import('./app.js');
