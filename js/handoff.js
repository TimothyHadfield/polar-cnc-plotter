// Simulate: carrying the drawing on screen from the plotter app to the simulator page (sim.html).
// The app packs it into sessionStorage (same tab) on the way out; the simulator unpacks it once.
// Only the strokes travel, with where they sit; a picture arrives already traced.
export const HANDOFF = 'polar-plotter-handoff';

const round = (_, v) => typeof v === 'number' ? +v.toPrecision(7) : v;

// raw: strokes as app.js keeps them (stroke.color, raw.center and raw.radius are optional extras).
export function pack(raw, name, place) {
  return JSON.stringify({
    name, place, center: raw.center, radius: raw.radius,
    strokes: raw.map(s => s.color === undefined ? s : { c: s.color, p: [...s] }),
  }, round);
}

export function unpack(text) {
  const d = JSON.parse(text), p = d.place || {};
  const strokes = d.strokes.map(s => Array.isArray(s) ? s : Object.assign(s.p, { color: s.c }));
  if (d.center) strokes.center = d.center;
  if (d.radius) strokes.radius = d.radius;
  return {
    strokes, name: String(d.name || 'Drawing'),
    place: { turn: +p.turn || 0, dx: +p.dx || 0, dy: +p.dy || 0, crop: Array.isArray(p.crop) ? p.crop : null },
  };
}
