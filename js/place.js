// Move, Turn, Crop: drag the drawing on the preview, turn it with the Turn slider, crop out junk.
// The placement lives in app.js (api.getPlace / api.setPlace) and is applied in polar.js prepare().
import { DEFAULTS, bounds, fitFrame, cropStrokes } from './polar.js';

// Paper-mm points (e.g. the corners of a box dragged on the preview) -> crop rectangle in the raw
// drawing's normalized bounding box. Undoes move, turn and fit. With a turn, the box maps to a
// turned region in raw space; we crop to that region's bounding box. The new crop stays inside the
// old one. Returns null when nothing would be left.
export function cropFromBox(raw, place, opts, pts) {
  const o = { ...DEFAULTS, ...opts };
  const b = bounds(raw);
  const f = b && fitFrame(place.crop ? cropStrokes(raw, place.crop) : raw, o);
  if (!f) return null;
  const cur = place.crop || [0, 0, 1, 1];
  const a = -(place.turn || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const w = b[2] - b[0], h = b[3] - b[1];
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const [x, y] of pts) {
    const px = x - (place.dx || 0), py = y - (place.dy || 0);
    const qx = px * c - py * s, qy = px * s + py * c;
    const u = ((qx / f.k + f.cx) - b[0]) / (w || 1), v = ((-qy / f.k + f.cy) - b[1]) / (h || 1);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  if (!w) { u0 = cur[0]; u1 = cur[2]; }
  if (!h) { v0 = cur[1]; v1 = cur[3]; }
  const out = [Math.max(u0, cur[0]), Math.max(v0, cur[1]), Math.min(u1, cur[2]), Math.min(v1, cur[3])];
  return out[0] < out[2] && out[1] < out[3] ? out : null;
}

export function initPlace(api) {
  const $ = id => document.getElementById(id);
  const canvas = api.canvas, stage = $('stage');
  const cropBtn = $('crop'), resetBtn = $('resetPlace'), turn = $('turn'), turnOut = $('turnOut');
  let cropping = false, box = null, drag = null, frame = 0;

  const moved = p => !!(p.turn || p.dx || p.dy || p.crop);
  // screen px (relative to the canvas) -> paper mm, using the scale draw() last used
  const toMM = (x, y) => { const v = api.view; return [(x - v.cx) / v.k, (v.cy - y) / v.k]; };
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function setCropping(on) {
    cropping = on; box = null;
    cropBtn.classList.toggle('on', on);
    stage.classList.toggle('cropping', on);
    api.draw();
  }

  // Runs on every redraw: keep the controls in step with the drawing and placement.
  api.addOverlay(({ ctx, color }) => {
    const p = api.getPlace(), has = !!api.getRaw();
    $('placeBar').style.visibility = has ? 'visible' : 'hidden';
    stage.classList.toggle('movable', has);
    resetBtn.hidden = !moved(p);
    if (+turn.value !== p.turn) { turn.value = p.turn; turnOut.textContent = Math.round(p.turn) + '°'; }
    if (cropping && !has) setCropping(false);
    if (box) {
      ctx.save();
      ctx.strokeStyle = color('--accent'); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.fillStyle = 'rgba(128,128,128,.12)';
      const x = Math.min(box[0], box[2]), y = Math.min(box[1], box[3]);
      ctx.fillRect(x, y, Math.abs(box[2] - box[0]), Math.abs(box[3] - box[1]));
      ctx.strokeRect(x, y, Math.abs(box[2] - box[0]), Math.abs(box[3] - box[1]));
      ctx.restore();
    }
  });

  turn.addEventListener('input', () => {
    turnOut.textContent = turn.value + '°';
    api.setPlace({ turn: +turn.value }, 30);
  });
  cropBtn.addEventListener('click', () => setCropping(!cropping));
  resetBtn.addEventListener('click', () => { setCropping(false); api.setPlace({ turn: 0, dx: 0, dy: 0, crop: null }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cropping) setCropping(false); });

  canvas.addEventListener('pointerdown', e => {
    if (!api.getRaw() || e.button > 0) return;
    const at = local(e);
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const p = api.getPlace();
    drag = { id: e.pointerId, at, dx: p.dx, dy: p.dy, live: false, heavy: (api.getResult()?.ms || 0) > 25 };
    if (cropping) box = [...at, ...at];
  });

  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const at = local(e);
    if (!drag.live && Math.hypot(at[0] - drag.at[0], at[1] - drag.at[1]) < 4) return;  // a tap is not a drag
    drag.live = true;
    if (cropping) box[2] = at[0], box[3] = at[1];
    else {
      const k = api.view.k;
      drag.to = [drag.dx + (at[0] - drag.at[0]) / k, drag.dy - (at[1] - drag.at[1]) / k];
    }
    if (frame) return;   // one update per animation frame
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!drag) return;
      if (cropping || !drag.to) return api.draw();
      if (drag.heavy) { api.inkShift = [drag.to[0] - drag.dx, drag.to[1] - drag.dy]; api.draw(); }
      else api.setPlace({ dx: drag.to[0], dy: drag.to[1] });
    });
  });

  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (cropping) {
      const b = box; box = null;
      if (d.live && Math.abs(b[2] - b[0]) > 6 && Math.abs(b[3] - b[1]) > 6 && e.type === 'pointerup') {
        const corners = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(q => toMM(...q));
        const crop = cropFromBox(api.getRaw(), api.getPlace(), api.getSettings(), corners);
        setCropping(false);
        // the cropped part refits: centred, filling the drawing circle at the current Size
        if (crop) api.setPlace({ crop, dx: 0, dy: 0 });
      } else api.draw();
      return;
    }
    api.inkShift = null;
    if (d.to) api.setPlace({ dx: d.to[0], dy: d.to[1] });
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
