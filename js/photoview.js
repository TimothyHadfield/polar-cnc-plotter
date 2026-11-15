// Photo check (Calibrate): the photo, big, over the preview, to tap points on. Pressing shows a
// magnifier in the corner away from the finger; letting go puts the point there, so a finger never
// hides what it aims at. Points are kept in the photo's own pixels.

const FINE = 4;     // the magnifier's zoom, and how much finer than the finger the point moves

export function createPhotoView(stage, onTap) {
  const canvas = document.createElement('canvas');
  canvas.className = 'photoview';
  canvas.hidden = true;
  canvas.setAttribute('aria-label', 'Photo of the test drawing');
  stage.append(canvas);
  let img = null, taps = [], aim = null, fit = null;   // fit: { s, ox, oy } photo px -> canvas px

  function draw() {
    if (canvas.hidden || !img) return;
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement), color = v => css.getPropertyValue(v).trim();
    ctx.fillStyle = color('--bg'); ctx.fillRect(0, 0, w, h);
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    fit = { s, ox: (w - img.naturalWidth * s) / 2, oy: (h - img.naturalHeight * s) / 2 };
    ctx.drawImage(img, fit.ox, fit.oy, img.naturalWidth * s, img.naturalHeight * s);
    const mark = (p, c, r = 6) => {
      const x = fit.ox + p[0] * s, y = fit.oy + p[1] * s;
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    };
    for (const p of taps) mark(p, color('--travel'));
    if (!aim) return;
    // magnifier: 4x, in the top corner away from the finger
    const R = Math.min(80, w / 4), z = FINE, cx = aim.x < w / 2 ? w - R - 10 : R + 10, cy = R + 10;
    const px = (aim.x - fit.ox) / s, py = (aim.y - fit.oy) / s;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
    ctx.fillStyle = color('--bg'); ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.drawImage(img, px - R / (z * s), py - R / (z * s), 2 * R / (z * s), 2 * R / (z * s), cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
    ctx.strokeStyle = color('--ink'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = color('--travel');
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12); ctx.stroke();
    mark([px, py], color('--travel'), 10);
  }

  // Fine aim: after the press, the point moves a quarter of the finger's slide, so it can be put
  // between screen pixels (on a phone one pixel of the shrunk photo is most of a millimetre).
  const at = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let press = null;   // { x, y }: where the finger went down
  const follow = e => { const c = at(e); aim = { x: press.x + (c.x - press.x) / FINE, y: press.y + (c.y - press.y) / FINE }; };
  canvas.addEventListener('pointerdown', e => { if (!img) return; canvas.setPointerCapture?.(e.pointerId); press = aim = at(e); draw(); });
  canvas.addEventListener('pointermove', e => { if (press) { follow(e); draw(); } });
  canvas.addEventListener('pointerup', e => {
    if (!press || !fit) return;
    follow(e);
    press = null;
    const p = [(aim.x - fit.ox) / fit.s, (aim.y - fit.oy) / fit.s];
    aim = null;
    if (p[0] >= 0 && p[1] >= 0 && p[0] <= img.naturalWidth && p[1] <= img.naturalHeight) onTap(p);
    draw();
  });
  canvas.addEventListener('pointercancel', () => { aim = press = null; draw(); });
  new ResizeObserver(() => draw()).observe(canvas);

  return {
    show(image) { if (image) img = image; canvas.hidden = !img; draw(); },
    hide() { canvas.hidden = true; aim = press = null; },
    setTaps(list) { taps = list; draw(); },
    get shown() { return !canvas.hidden; },
  };
}
