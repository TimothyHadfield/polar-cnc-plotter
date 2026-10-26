// Build guide: what makes the model look real. Textures are drawn here (no image files), the
// motor wires and the paper clip are built as smooth tubes, and a few materials get special effects.
import * as THREE from 'three';

// cad/plotter-assembly.scad is Z-up in mm; the glb (and three.js) is Y-up
const P = (x, y, z) => new THREE.Vector3(x, z, -y);

// ---------- lighting: a soft photo studio (bright above, light grey floor, three softboxes) ----------
export function studio() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(100, 32, 16), col = [];
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const k = 0.55 + 0.45 * (geo.attributes.position.getY(i) / 100 + 1) / 2;
    col.push(k, k, k * 0.98);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [x, y, z, w, h] of [[0, 90, 0, 80, 80], [-80, 30, 60, 30, 50], [80, 20, 40, 30, 50]]) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) }));
    box.position.set(x, y, z);
    box.lookAt(0, 0, 0);
    s.add(box);
  }
  return s;
}

// ---------- texture painting ----------
function canvasTexture(size, paint, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// pine plywood face: wide wavy grain like the board in docs/photos/x-axis.jpg
const woodTexture = () => canvasTexture(1024, (g, n) => {
  const img = g.createImageData(n, n), d = img.data;
  const light = [226, 178, 116], dark = [176, 116, 58];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * Math.PI * 2, v = y / n * Math.PI * 2;
    // growth rings sliced at a shallow angle: long bands along the board, gentle cathedral arcs
    const w = v * 2 +0.28 * Math.sin(u + 0.7) + 0.12 * Math.sin(2 * u + v) + 0.04 * Math.sin(5 * u + 3 * v);
    const ring = (w / (Math.PI * 2) * 14) % 1;
    const late = Math.exp(-((ring - 0.82) ** 2) / 0.006) + 0.35 * ring;              // dark late wood after a fade
    const streak = 0.5 + 0.5 * Math.sin(v * 520 + 3 * Math.sin(u * 13));            // fine fibres
    const k = Math.min(1, 0.75 * late + 0.12 * streak + (Math.random() - 0.5) * 0.1), i = (y * n + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = light[c] + (dark[c] - light[c]) * k;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
});

// fine print layer lines for the PLA parts (bump only)
const layerTexture = () => canvasTexture(256, (g, n) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 4) { g.fillStyle = '#9a9a9a'; g.fillRect(0, y, n, 2); }
}, false);

// the round STEPPERONLINE sticker on the back of each NEMA 17 (docs/photos/full-machine.jpg)
const motorLabel = () => canvasTexture(512, (g, n) => {
  g.fillStyle = '#1d1e21'; g.fillRect(0, 0, n, n);
  g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 2, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.beginPath(); g.arc(n / 2, n / 2, n * 0.47, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = n * 0.05; g.strokeStyle = '#1f5fbf'; g.stroke();
  g.fillStyle = '#1f5fbf'; g.textAlign = 'center';
  g.font = `bold ${n * 0.085}px Arial, sans-serif`; g.fillText('STEPPERONLINE', n / 2, n * 0.36);
  g.fillStyle = '#1d1e21';
  g.font = `${n * 0.055}px Arial, sans-serif`;
  g.fillText('STEPPER MOTOR', n / 2, n * 0.47);
  g.fillText('P/N:17HE15-1504S', n / 2, n * 0.57);
  g.font = `bold ${n * 0.075}px Arial, sans-serif`; g.fillText('RoHS   CE', n / 2, n * 0.7);
  g.font = `${n * 0.04}px Arial, sans-serif`; g.fillText('MADE IN CHINA', n / 2, n * 0.8);
});

// a polar drawing on the paper, in red Sharpie
const drawing = () => canvasTexture(1024, (g, n) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
  g.translate(n / 2, n / 2);
  g.strokeStyle = 'rgba(190, 28, 36, 0.92)'; g.lineWidth = 4; g.lineCap = g.lineJoin = 'round';
  const curve = (f, from, to, steps = 2400) => {
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = from + (to - from) * i / steps, r = f(t) * n / 2;
      i ? g.lineTo(r * Math.cos(t), r * Math.sin(t)) : g.moveTo(r * Math.cos(t), r * Math.sin(t));
    }
    g.stroke();
  };
  curve(t => 0.78 * Math.abs(Math.cos(3.5 * t)) * 0.85 + 0.1, 0, Math.PI * 4);   // rose
  curve(() => 0.9, 0, Math.PI * 2, 400);                                            // border
  curve(t => 0.06 + t / (Math.PI * 2 * 6) * 0.2, 0, Math.PI * 2 * 6, 1200);         // centre spiral
});

// ---------- UVs (the STL meshes have none) ----------
// box projection: each triangle takes the two axes its face is most square to; `mm` per texture repeat
function boxUV(geo, mm) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nrm.subVectors(c, b).cross(a.clone().sub(b));
    const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
    for (let k = 0; k < 3; k++) {
      const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k);
      const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
      uv[(i + k) * 2] = u / mm; uv[(i + k) * 2 + 1] = v / mm;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// flat decal: fit the texture to the mesh's footprint, looking along its thinnest axis
function decalUV(geo, flipU = false) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox, s = new THREE.Vector3().subVectors(max, min);
  const thin = s.x <= s.y && s.x <= s.z ? 'x' : s.y <= s.z ? 'y' : 'z';
  const [ua, va] = { x: ['z', 'y'], y: ['x', 'z'], z: ['x', 'y'] }[thin];
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2), q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    q.fromBufferAttribute(p, i);
    const u = (q[ua] - min[ua]) / s[ua], v = (q[va] - min[va]) / s[va];
    uv[i * 2] = flipU ? 1 - u : u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---------- materials ----------
let tex;   // painted once, on first use
export function dress(mesh) {
  tex ??= { wood: woodTexture(), layers: layerTexture(), label: motorLabel(), drawing: drawing() };
  const name = mesh.name, m = mesh.material;
  if (name === 'board__wood') { boxUV(mesh.geometry, 260); m.map = tex.wood; m.color.set(0xffffff); }
  else if (/__label$/.test(name)) { decalUV(mesh.geometry, name.startsWith('y_')); m.map = tex.label; m.color.set(0xffffff); }
  else if (name === 'paper__sheet') { decalUV(mesh.geometry); m.map = tex.drawing; m.color.set(0xffffff); }
  else if (m.color.g > 0.3 && m.color.r < 0.1 && m.color.b < 0.1) {   // printed PLA green
    boxUV(mesh.geometry, 6); m.bumpMap = tex.layers; m.bumpScale = 0.4;
  }
  if (name === 'stands') return physical(m, { clearcoat: 0.5, clearcoatRoughness: 0.35 });
  if (name === 'cd__disc') return physical(m, { iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 800] });
  if (name === 'platter' || name === 'rods') m.envMapIntensity = 1.3;
  return m;
}
function physical(m, extra) {
  const p = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(p, m);
  p.defines = { STANDARD: '', PHYSICAL: '' };
  return Object.assign(p, extra);
}

// ---------- wires and paper clip ----------
const WIRE = [0x1b1c1f, 0x2456c8, 0x23a04a, 0xd0302a];   // black, blue, green, red (Tim's NEMA leads)
// four strands side by side along a smooth path (points in scad mm)
function ribbon(name, pts, colors = WIRE, r = 0.65) {
  const path = new THREE.CatmullRomCurve3(pts.map(p => P(...p)), false, 'centripetal');
  const n = 160, g = new THREE.Group();
  g.name = name;
  const samples = path.getSpacedPoints(n), side = [];
  for (let i = 0; i <= n; i++) {
    const t = path.getTangentAt(i / n), s = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0));
    if (s.lengthSq() < 1e-4) s.set(1, 0, 0);
    side.push(s.normalize());
  }
  colors.forEach((c, k) => {
    const off = (k - (colors.length - 1) / 2) * r * 2.1;
    const strand = new THREE.CatmullRomCurve3(samples.map((p, i) => p.clone().addScaledVector(side[i], off)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(strand, n * 2, r, 8),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
    mesh.name = `${name}_${k}`;
    g.add(mesh);
  });
  return g;
}
export function extras(pen_y = -11.5, platter_z = 40) {
  const wires = new THREE.Group();
  wires.name = 'wires';
  // carriage (X) motor: out of the plug on top, back along the right stand, down to the shield
  wires.add(ribbon('wires__x', [[128, 20.5, 133], [128, 22, 145], [138, 40, 156], [158, 63, 146], [165, 66, 70],
    [171, 44, 5], [170, 5, 6], [168, -12, 40], [159.8, -19.1, 29.8]]));
  // platter (Y) motor: along the board behind the platter to the shield
  wires.add(ribbon('wires__y', [[-68, 15, 13], [-66, 26, 6], [-45, 35, 2.5], [60, 36, 2.5], [112, 22, 2.5],
    [128, 2, 6], [128, -12, 40], [135.3, -19.1, 29.8]]));
  // pen-lift (Z) motor: a slack loop from the carriage over to the right stand, then down with the X wires.
  // Its plug lead is brown/red/orange/yellow, as in Tim's photo of the shield.
  wires.add(ribbon('wires__z', [[0, 27, 155], [0, 30, 172], [25, 48, 190], [85, 63, 182], [140, 68, 165],
    [161, 69, 140], [167, 69, 70], [178, 46, 5], [180, 2, 8], [170, -38, 42], [159.8, -44.8, 29.8]],
    [0x6b4226, 0xd0302a, 0xf08a24, 0xf2c418], 0.45));
  // 12 V from the jack to the shield's blue screw terminal
  wires.add(ribbon('wires__power', [[185, 25, 3], [189, 5, 2.5], [197, -30, 4], [199, -51, 14], [193.5, -51, 16.6]],
    [0xd0302a, 0x1b1c1f], 0.7));

  // paper clip over the platter edge (as in docs/photos/full-machine.jpg)
  const loop = [[0, 0], [30, 0], [32.5, 2.5], [32.5, 6], [30, 8.5], [3, 8.5], [0.5, 6], [0.5, 2.8], [3, 1.6],
    [26, 1.6], [28.5, 3.6], [28.5, 5], [26.5, 6.6], [7, 6.6]];
  const a = THREE.MathUtils.degToRad(-35), ca = Math.cos(a), sa = Math.sin(a);
  const clip = new THREE.Group();
  clip.name = 'paper__clip';
  for (const [z, flip] of [[platter_z + 1.9, 1], [platter_z - 0.6, -1]]) {
    const pts = loop.map(([u, v]) => { const r = 78 + u, w = (v - 4.25) * flip; return P(r * ca - w * sa, pen_y + r * sa + w * ca, z); });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 200, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 1, roughness: 0.25 }));
    mesh.name = 'paper__clip_part';
    clip.add(mesh);
  }
  return [wires, clip];
}
