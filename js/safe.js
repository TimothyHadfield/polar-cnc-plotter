// Guards against settings that make the motors run wild. GRBL moves in steps: with steps per unit
// a few hundred times too high, a "1 degree" jog is a third of a turn, at a speed the motor cannot
// reach (it stalls and screams). That happened on 2026-11-13: $101 = 1607 on a 4.444 platter.

// Steps per unit a real plotter can have. Rail ($100, per mm): belt or screw, full step to 1/64.
// Platter ($101, per degree): a 200-step motor at full step is 0.556; geared or at 1/64 it stays
// under 150. GRBL's factory 250 on the platter is outside: it has not been calibrated yet.
export const RANGE = { 100: [5, 800], 101: [0.5, 150] };
export const NAME = { 100: 'Rail', 101: 'Platter' };
export const plausible = (n, v) => !RANGE[n] || (v >= RANGE[n][0] && v <= RANGE[n][1]);

// The axes whose steps per unit cannot be right. `vals` = the plotter's `$$` (parseSettings);
// nothing read counts as wrong.
export function badAxes(vals) {
  return [100, 101].filter(n => !plausible(n, vals?.[n])).map(n => 'XY'[n - 100]);
}

// One line for the plotter panel, '' when all is well.
export function trouble(vals) {
  if (!vals || !Object.keys(vals).length) return 'Could not read the plotter\'s settings. Reconnect.';
  const bad = [100, 101].filter(n => !plausible(n, vals[n]));
  if (!bad.length) return '';
  const what = bad.map(n => NAME[n].toLowerCase()).join(' and ');
  return `${what[0].toUpperCase()}${what.slice(1)} steps look wrong (${bad.map(n => `$${n} = ${vals[n]}`).join(', ')}). Open Calibrate.`;
}

// Why a value may not be saved as $100 / $101.
export function refusal(n, v) {
  return plausible(n, v) ? '' : `${NAME[n]} steps must be ${RANGE[n][0]} to ${RANGE[n][1]}. Not saved.`;
}

// Fastest a jog may run, in motor steps per second.
export const JOG_SPS = { X: 8000, Y: 4000, Z: 1000 };

// Feed for a jog (units per minute): `feed`, or less when that would be more than `sps` motor
// steps a second with `spu` steps per unit. Throws when the steps per unit are unknown, or so high
// that GRBL would speed the move up (it runs nothing slower than 1 unit a minute).
export function jogFeed(axis, feed, spu, sps = JOG_SPS[axis]) {
  if (!(spu > 0)) throw new Error('Could not read the settings.');
  const f = Math.min(feed, sps * 60 / spu);
  if (f < 1) throw new Error(`$${100 + 'XYZ'.indexOf(axis)} is far too high (${spu}).`);
  return +f.toFixed(2);
}
