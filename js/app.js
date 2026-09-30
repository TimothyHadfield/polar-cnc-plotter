import { DEFAULTS, prepare, toGcode, simulate, placedToGcode, testCircle, testSpoke, toPlatter } from './polar.js';
import { initMachine } from './machine.js';
import { initCalibrate } from './calibrate.js';
import { svgToStrokes } from './svg.js';
import { loadGray } from './image.js';
import { traceImage, otsu } from './trace.js';
import { initPlace } from './place.js';
import { spiral, hatch } from './styles.js';
import { initText } from './text.js';
import { initPatterns } from './patterns.js';

const $ = id => document.getElementById(id);
const PAPER = 200;  // mm, the round sheet on the platter

// ---------- settings (kept in this browser) ----------
const KEY = 'polar-plotter-settings';
const FIELDS = ['diameter', 'speed', 'penUp', 'penDown', 'offset', 'gap'];
const STYLES = ['outline', 'center', 'spiral', 'hatch'];   // picture style
let settings = { ...DEFAULTS, showTravel: false, gap: 1.2 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
if (!STYLES.includes(settings.style)) settings.style = settings.center ? 'center' : 'outline';   // old Centerlines switch
delete settings.center;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} };

// ---------- state ----------
let raw = null;          // strokes from the SVG or traced picture, in its own units
let picture = null;      // { gray, w, h, threshold } when the drawing came from a picture
let name = '';
let result = null;       // { gcode, stats, sim }
let pen = null;          // live pen position [r, θ, z] from the plotter, when connected
let machine = null;
// where the drawing sits (js/place.js): not saved, reset for every new drawing
const place = { turn: 0, dx: 0, dy: 0, crop: null };
const resetPlace = () => Object.assign(place, { turn: 0, dx: 0, dy: 0, crop: null });

// ---------- conversion ----------
let timer = 0;
function rebuild(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    retrace();   // spiral and hatch depend on the drawing size (line gap is in mm on paper)
    if (!raw) { result = null; draw(); showStats(); return; }
    try {
      const t0 = performance.now();
      const strokes = prepare(raw, settings, place);
      const out = toGcode(strokes, settings);
      result = { ...out, sim: simulate(out.gcode, settings, 0.4), ms: performance.now() - t0 };
      $('err').textContent = strokes.length ? '' : 'Nothing to draw in this file.';
    } catch (e) {
      result = null;
      $('err').textContent = 'Could not convert: ' + e.message;
    }
    draw();
    showStats();
    machine?.refresh();
  }, delay);
}

function showStats() {
  $('download').disabled = !result;
  if (!result) { $('stats').textContent = ''; return; }
  const s = result.stats;
  const mins = s.minutes + s.travelMM / 400;
  $('stats').textContent = `${s.strokes} strokes · ${(s.drawMM / 1000).toFixed(1)} m of ink · ~${Math.max(1, Math.round(mins))} min`;
}

// ---------- preview ----------
const canvas = $('preview');
function draw() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const color = v => css.getPropertyValue(v).trim();
  const k = (Math.min(w, h) - 24) / PAPER;       // px per mm
  if (k <= 0) return;                             // preview squeezed to nothing
  const cx = w / 2, cy = h / 2;
  const X = p => cx + p[0] * k, Y = p => cy - p[1] * k;
  api.view = { k, cx, cy };
  const [sx, sy] = api.inkShift || [0, 0];   // drag preview for heavy drawings (js/place.js)
  const IX = p => X(p) + sx * k, IY = p => Y(p) - sy * k;

  // paper, drawing area, centre gap
  ctx.fillStyle = color('--paper'); ctx.strokeStyle = color('--paper-edge'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, PAPER / 2 * k, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.arc(cx, cy, settings.diameter / 2 * k, 0, 2 * Math.PI); ctx.stroke();
  ctx.setLineDash([]);
  if (Math.abs(settings.offset) > 0) {
    ctx.fillStyle = color('--paper-edge');
    ctx.beginPath(); ctx.arc(cx, cy, Math.abs(settings.offset) * k, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.strokeStyle = color('--paper-edge');
  ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();

  if (result) {
    ctx.lineJoin = ctx.lineCap = 'round';
    if (settings.showTravel) {
      ctx.strokeStyle = color('--travel'); ctx.lineWidth = 0.8; ctx.setLineDash([3, 4]);
      for (const s of result.sim.up) { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(IX(p), IY(p)) : ctx.moveTo(IX(p), IY(p))); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = color('--pen'); ctx.lineWidth = Math.max(1, 0.5 * k);
    for (const s of result.sim.down) { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(IX(p), IY(p)) : ctx.moveTo(IX(p), IY(p))); ctx.stroke(); }
  }
  // extra layers from other modules (crop box, plot progress…): fn({ ctx, X, Y, k, cx, cy, color })
  for (const f of overlays) f({ ctx, X, Y, k, cx, cy, color });
  // where the real pen is right now
  if (pen && pen[0] >= 0) {
    const p = toPlatter(pen, settings);
    ctx.fillStyle = color('--travel');
    ctx.beginPath(); ctx.arc(X(p), Y(p), 5, 0, 2 * Math.PI); ctx.fill();
  }
}
const overlays = [];
new ResizeObserver(() => draw()).observe(canvas);

// ---------- loading drawings ----------
const dark = $('dark');
function showName(fileName) {
  name = fileName.replace(/\.\w+$/i, '');
  $('fileName').textContent = fileName;
  $('err').textContent = '';
}
// Picture -> strokes in the chosen style. Skips the work when nothing it depends on changed.
function retrace() {
  if (!picture) return;
  const st = settings.style, shade = st === 'spiral' || st === 'hatch';
  const key = [st, picture.threshold, ...(shade ? [settings.gap, settings.diameter, settings.size] : [])].join();
  if (picture.key === key) return;
  picture.key = key;
  const o = { threshold: picture.threshold, gap: settings.gap, diameter: settings.diameter, size: settings.size };
  raw = (st === 'spiral' ? spiral(picture, o) : st === 'hatch' ? hatch(picture, o) : traceImage(picture, { threshold: picture.threshold, mode: st })).strokes;
}
function showDark() {
  $('darkRow').style.visibility = picture ? 'visible' : 'hidden';
  if (!picture) return;
  dark.value = picture.threshold;
  $('darkOut').textContent = Math.round(picture.threshold / 2.55) + '%';
}

// Any file or blob: SVG goes through the SVG reader, everything else is traced as a picture.
async function load(blob, fileName) {
  try {
    const isSvg = /svg/i.test(blob.type) || /\.svg$/i.test(fileName);
    if (isSvg) {
      raw = svgToStrokes(await blob.text());
      picture = null;
    } else {
      const img = await loadGray(blob);
      picture = { ...img, threshold: otsu(img.gray) };
      retrace();
    }
    showName(fileName);
    showDark();
    resetPlace();
    rebuild();
  } catch (e) {
    $('err').textContent = /decode|source|bitmap/i.test(e.message) ? 'That file isn’t a picture this browser can read.' : e.message;
  }
}

// For drawings made inside the app (text, patterns…): strokes in SVG-like units, y down.
function setDrawing(strokes, label) {
  raw = strokes;
  picture = null;
  showName(label);
  showDark();
  resetPlace();
  rebuild();
}

$('file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) load(f, f.name);
  e.target.value = '';
});
document.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', async () => {
  const n = b.dataset.sample;
  try { load(await (await fetch(`samples/${n}`)).blob(), n); }
  catch { $('err').textContent = 'Could not load the sample.'; }
}));

const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
stage.addEventListener('drop', async e => {
  e.preventDefault(); stage.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) return load(f, f.name);
  // an image dragged straight from another web page arrives as a link, not a file
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (url) fetchPicture(url.trim().split('\n')[0]);
});

async function fetchPicture(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    load(await res.blob(), decodeURIComponent(url.split('/').pop().split('?')[0]) || 'picture');
  } catch {
    $('err').textContent = 'That site won’t share the picture directly. Right-click it → Copy image, then press Ctrl+V here.';
  }
}

// Ctrl+V: a copied image, a copied SVG, or a copied picture address
document.addEventListener('paste', e => {
  const items = [...(e.clipboardData?.items || [])];
  const img = items.find(i => i.type.startsWith('image/'));
  if (img) { e.preventDefault(); load(img.getAsFile(), 'pasted picture'); return; }
  const text = e.clipboardData?.getData('text/plain')?.trim() || '';
  if (text.startsWith('<svg') || text.startsWith('<?xml')) { e.preventDefault(); load(new Blob([text], { type: 'image/svg+xml' }), 'pasted.svg'); }
  else if (/^https?:\/\/\S+$/i.test(text) && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); fetchPicture(text); }
});

dark.addEventListener('input', () => {
  if (!picture) return;
  picture.threshold = +dark.value;
  $('darkOut').textContent = Math.round(picture.threshold / 2.55) + '%';
  clearTimeout(dark.t);
  dark.t = setTimeout(() => { retrace(); rebuild(); }, 150);
});

// ---------- controls ----------
const size = $('size');
size.value = settings.size;
$('sizeOut').textContent = settings.size + '%';
size.addEventListener('input', () => {
  settings.size = +size.value; $('sizeOut').textContent = size.value + '%'; save(); rebuild(120);
});

function download(text, file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('download').addEventListener('click', () => result && download(result.gcode, `${name || 'drawing'}-polar.nc`));

// settings sheet
const sheet = $('settings');
$('openSettings').addEventListener('click', () => { sheet.hidden = false; });
$('closeSettings').addEventListener('click', () => { sheet.hidden = true; });
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') sheet.hidden = true; });

for (const f of FIELDS) {
  const el = $(f);
  el.value = settings[f];
  el.addEventListener('change', () => {
    let v = parseFloat(el.value);
    if (f === 'gap') el.value = v = Math.min(5, Math.max(0.4, v));
    if (Number.isFinite(v)) { settings[f] = v; save(); rebuild(); } else el.value = settings[f];
  });
}
for (const f of ['flip', 'showTravel']) {
  const el = $(f);
  el.checked = !!settings[f];
  el.addEventListener('change', () => {
    settings[f] = el.checked; save();
    if (f === 'showTravel') return draw();
    rebuild();
  });
}
const styleSeg = $('pictureStyle');
const showStyle = () => styleSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.style === settings.style));
showStyle();
styleSeg.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  settings.style = b.dataset.style; save(); showStyle();
  if (picture) rebuild();   // rebuild re-traces
});
document.querySelectorAll('.q').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  const h = $(b.dataset.q); h.hidden = !h.hidden;
}));
document.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.test;
  const strokes = t === 'circle' ? [testCircle(settings)] : [testSpoke(settings)];
  download(placedToGcode(strokes, settings).gcode, `test-${t}.nc`);
}));

// What feature modules get to work with. Keep this the only door into app state.
const api = {
  setDrawing,
  getSettings: () => settings,
  setSettings: patch => { Object.assign(settings, patch); save(); rebuild(); },
  getResult: () => result,
  rebuild, draw,
  addOverlay: f => overlays.push(f),
  canvas,
  getRaw: () => raw,
  getPlace: () => place,
  setPlace: (patch, delay = 0) => { Object.assign(place, patch); rebuild(delay); },
  view: { k: 1, cx: 0, cy: 0 },   // preview scale, set by draw()
  inkShift: null,
};
initPlace(api);

machine = initMachine({
  getJob: () => result && { gcode: result.gcode, minutes: result.stats.minutes + result.stats.travelMM / 400 },
  getSettings: () => settings,
  onPen: p => { if (String(p) !== String(pen)) { pen = p; draw(); } },
  api,
});
api.machine = machine;   // null when this browser can't use USB serial
initCalibrate(api);
initText(api);
initPatterns(api);
rebuild();
