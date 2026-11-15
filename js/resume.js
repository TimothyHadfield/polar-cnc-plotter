// Resume after a stop, an unplugged cable or a power cut. While a plot runs, the last line GRBL
// surely drew is kept in this browser (keyed to the drawing's G-code), with where the plotter's
// work zero was: work = machine position − offset. Resume puts that offset back.
//
// There is no sensor on the platter. After a restart GRBL counts from zero wherever the motors
// stand, so the app assumes they stood still: the first position read after the restart is where
// the plotter last was. Turning the platter by hand while it is off breaks that, and the rest of
// the drawing comes out turned. The carriage can be found again (Home, or Set center by eye);
// the platter angle and the pen height can only come back this way.

export const RESUME_KEY = 'polar-plotter-resume';

// Short fingerprint of a drawing's G-code (FNV-1a), so a record only resumes the same drawing.
export function jobKey(gcode) {
  let h = 0x811c9dc5;
  for (let i = 0; i < gcode.length; i++) { h ^= gcode.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16) + ':' + gcode.length;
}

// The pretend plotters (simulator, ?demo) keep their own record, apart from the real plotter's.
const slot = () => {
  const q = globalThis.location ? new URLSearchParams(location.search) : null;
  return RESUME_KEY + (globalThis.plotterSim ? '-sim' : q?.has('demo') ? '-demo' : '');
};
export function loadResume(store = globalThis.localStorage) {
  try { return JSON.parse(store.getItem(slot()) || 'null'); } catch { return null; }
}
export function saveResume(rec, store = globalThis.localStorage) {
  try { if (rec) store.setItem(slot(), JSON.stringify(rec)); else store.removeItem(slot()); } catch {}
}

// A record: { key, from, total, wpos, mpos, lost }. wpos and mpos were read at the same moment, so
// mpos − wpos is the work offset (center X, platter zero Y, pen zero Z) in the plotter's counts.
export function makeRecord(key, from, total, status) {
  return { key, from, total, wpos: status.wpos.slice(0, 3), mpos: status.mpos.slice(0, 3), lost: false };
}

// The plotter restarted (power cut, reconnect): its counts start again at `mpos`, where the
// motors stopped. Same offset relative to the machine, now in the new counts.
export function rebase(rec, mpos) {
  return { ...rec, mpos: mpos.slice(0, 3), wpos: rec.wpos.slice(0, 3), lost: true };
}

// The work offset to put back: machine position of work zero, per axis.
export const offsets = rec => rec.mpos.map((m, i) => m - rec.wpos[i]);

// Share of the drawing already done, for the button ("Resume 45%").
export const share = rec => Math.floor(rec.from / rec.total * 100);

// Before resuming: the carriage's center has been found again (Home, or Set center, or it was
// kept through a Stop); put the platter's zero and the pen's zero back from the record.
export async function restoreRefs(grbl, rec) {
  if (!grbl.center) throw new Error('Put the pen over the center and press Set center, then Resume.');
  const off = offsets(rec);
  grbl.center = [grbl.center[0], off[1]];
  grbl.penZero = off[2];
  await grbl.restoreCenter();
}
