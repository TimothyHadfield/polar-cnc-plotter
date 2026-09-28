import { DEFAULTS, prepare, toGcode, simulate, placedToGcode, testCircle, testSpoke } from './polar.js';
import { svgToStrokes } from './svg.js';

const $ = id => document.getElementById(id);
const PAPER = 200;  // mm, the round sheet on the platter

// ---------- settings (kept in this browser) ----------
const KEY = 'polar-plotter-settings';
const FIELDS = ['diameter', 'speed', 'penUp', 'penDown', 'offset'];
let settings = { ...DEFAULTS, showTravel: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} };

// ---------- state ----------
let raw = null;          // strokes from the SVG, in its own units
let name = '';
let result = null;       // { gcode, stats, sim }

// ---------- conversion ----------
let timer = 0;
function rebuild(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!raw) { result = null; draw(); showStats(); return; }
    try {
      const strokes = prepare(raw, settings);
      const out = toGcode(strokes, settings);
      result = { ...out, sim: simulate(out.gcode, settings, 0.4) };
      $('err').textContent = strokes.length ? '' : 'Nothing to draw in this file.';
    } catch (e) {
      result = null;
      $('err').textContent = 'Could not convert: ' + e.message;
    }
    draw();
    showStats();
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
  const cx = w / 2, cy = h / 2;
  const X = p => cx + p[0] * k, Y = p => cy - p[1] * k;

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

  if (!result) return;
  ctx.lineJoin = ctx.lineCap = 'round';
  if (settings.showTravel) {
    ctx.strokeStyle = color('--travel'); ctx.lineWidth = 0.8; ctx.setLineDash([3, 4]);
    for (const s of result.sim.up) { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = color('--pen'); ctx.lineWidth = Math.max(1, 0.5 * k);
  for (const s of result.sim.down) { ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.stroke(); }
}
new ResizeObserver(() => draw()).observe(canvas);

// ---------- loading drawings ----------
function load(text, fileName) {
  try {
    raw = svgToStrokes(text);
    name = fileName.replace(/\.svg$/i, '');
    $('fileName').textContent = fileName;
    $('err').textContent = '';
    rebuild();
  } catch (e) {
    $('err').textContent = e.message;
  }
}

$('file').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (f) load(await f.text(), f.name);
  e.target.value = '';
});
document.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', async () => {
  const n = b.dataset.sample;
  try { load(await (await fetch(`samples/${n}.svg`)).text(), `${n}.svg`); }
  catch { $('err').textContent = 'Could not load the sample.'; }
}));

const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
stage.addEventListener('drop', async e => {
  e.preventDefault(); stage.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) load(await f.text(), f.name);
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
    const v = parseFloat(el.value);
    if (Number.isFinite(v)) { settings[f] = v; save(); rebuild(); } else el.value = settings[f];
  });
}
for (const f of ['flip', 'showTravel']) {
  const el = $(f);
  el.checked = !!settings[f];
  el.addEventListener('change', () => { settings[f] = el.checked; save(); f === 'showTravel' ? draw() : rebuild(); });
}
document.querySelectorAll('.q').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  const h = $(b.dataset.q); h.hidden = !h.hidden;
}));
document.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.test;
  const strokes = t === 'circle' ? [testCircle(settings)] : [testSpoke(settings)];
  download(placedToGcode(strokes, settings).gcode, `test-${t}.nc`);
}));

rebuild();
