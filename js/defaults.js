// The calibration's defaults (Tim, 2026-11-14: "make our settings saved right now the default
// settings of the app ... if you recalibrate something you need to go through something that
// confirms you want to change the default settings"). Kept in this browser beside the settings:
// the app's calibrated settings and the plotter's own steps and directions. They are taken the
// first time a plotter with believable values connects; after that Calibrate asks before it
// changes one, and a plotter that differs is offered its defaults back (machine.js).

export const KEY = 'polar-plotter-defaults';
export const APP = ['offset', 'flip', 'penUp', 'penDown', 'zFlip'];
export const GRBL = [100, 101, 3];
export const LABEL = {
  100: 'Carriage steps ($100)', 101: 'Platter steps ($101)', 3: 'Motor directions ($3)',
  offset: 'Center gap', flip: 'Turn direction', penUp: 'Pen up', penDown: 'Pen down', zFlip: 'Pen direction',
};

// The pretend plotters (simulator, ?demo) share this browser's storage with the real one, so they
// leave the defaults alone, unless the page has ?defaults (the headless checks).
const pretend = () => {
  const q = globalThis.location ? new URLSearchParams(location.search) : null;
  return !!q && (!!globalThis.plotterSim || q.has('demo')) && !q.has('defaults');
};

export function loadDefaults(store = globalThis.localStorage) {
  if (pretend()) return null;
  try { return JSON.parse(store.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveDefaults(d, store = globalThis.localStorage) {
  if (pretend()) return;
  try { store.setItem(KEY, JSON.stringify(d)); } catch {}
}

// The defaults as they are right now: the app settings `s` and the plotter's `vals` ($$).
export function capture(vals, s, at = new Date().toISOString().slice(0, 10)) {
  const app = {}, grbl = {};
  for (const k of APP) if (s[k] !== undefined) app[k] = s[k];
  for (const n of GRBL) if (Number.isFinite(vals?.[n])) grbl[n] = vals[n];
  return { app, grbl, at };
}

const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.0005 : a === b;
const key = c => c.n !== undefined ? c.n : c.key;
const fromOf = (d, c) => c.n !== undefined ? d?.grbl?.[c.n] : d?.app?.[c.key];

// changes = [{ n, to }] (plotter setting n) or [{ key, to }] (app setting): those that would move
// a default, each with `from` (the default) and `label`. None while there are no defaults.
export function differs(d, changes) {
  if (!d) return [];
  return changes.map(c => ({ ...c, from: fromOf(d, c), label: LABEL[key(c)] }))
    .filter(c => c.from !== undefined && !same(c.from, c.to));
}
// The defaults with `changes` taken in.
export function apply(d, changes) {
  const out = { app: { ...d?.app }, grbl: { ...d?.grbl }, at: new Date().toISOString().slice(0, 10) };
  for (const c of changes) if (c.n !== undefined) out.grbl[c.n] = c.to; else out.app[c.key] = c.to;
  return out;
}
// The plotter's settings that are not its defaults: [{ n, from: plotter, to: default }].
export function plotterOff(d, vals) {
  if (!d || !vals) return [];
  return GRBL.filter(n => Number.isFinite(d.grbl?.[n]) && Number.isFinite(vals[n]) && !same(d.grbl[n], vals[n]))
    .map(n => ({ n, from: vals[n], to: d.grbl[n], label: LABEL[n] }));
}
// "Platter steps ($101) 4.444 → 4.5"
const WORDS = { flip: ['clockwise', 'counterclockwise'], zFlip: ['normal', 'reversed'] };
const show = (v, k) => WORDS[k] ? WORDS[k][v ? 1 : 0] : typeof v === 'number' ? String(+v.toFixed(3)) : String(v);
export const describe = c => `${c.label} ${show(c.from, c.key)} → ${show(c.to, c.key)}`;
