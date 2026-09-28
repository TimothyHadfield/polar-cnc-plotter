// A faithful port of GRBL-Plotter's "Convert to polar coordinates" (ConvertToPolar() in
// MachineControl/GCodeTransform.cs, added 2024-03-11), used only to show its angle-wrap bug in
// tests. It first breaks lines into 0.1 mm pieces, then maps every X/Y point to X = radius,
// Y = angle in degrees, adding or removing 360 degrees based on the SIGN of the angle.

export function grblPlotterPolar(strokes, { penUp = 2, penDown = 0 } = {}) {
  // Cartesian program: [x, y, lineKind]
  const pts = [];
  for (const s of strokes) {
    pts.push({ x: s[0][0], y: s[0][1], kind: 'G0' });
    pts.push({ z: penDown });
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
      for (let k = 1; k <= n; k++) pts.push({ x: a[0] + (b[0] - a[0]) * k / n, y: a[1] + (b[1] - a[1]) * k / n, kind: 'G1' });
    }
    pts.push({ z: penUp });
  }
  const lines = ['G21 G90', `G0 Z${penUp}`];
  let aOffset = 0, lastDir = 0;
  for (const p of pts) {
    if (p.z !== undefined) { lines.push(`G0 Z${p.z}`); continue; }
    const r = Math.sqrt(p.x * p.x + p.y * p.y);
    let a = Math.atan2(p.y, p.x) + aOffset;
    let dir = Math.sign(a);
    if (dir < 0 && lastDir > 0) { aOffset += 2 * Math.PI; a += 2 * Math.PI; dir = lastDir; }
    else if (dir > 0 && lastDir < 0) { aOffset -= 2 * Math.PI; a -= 2 * Math.PI; dir = lastDir; }
    else lastDir = dir;
    lines.push(`${p.kind} X${r.toFixed(3)} Y${(a * 180 / Math.PI).toFixed(3)}`);
  }
  return lines.join('\n') + '\n';
}
