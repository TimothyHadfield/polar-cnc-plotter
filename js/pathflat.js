// SVG path "d" string -> polylines (one per sub-path), curves flattened to within `tol` units.
// Handles M L H V C S Q T A Z, absolute and relative, with implicit repeats.

const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

// Arc flags may be written without separators ("a5 5 0 015 5"), so inside an arc the 4th and
// 5th numbers of each group are read as a single 0/1 character.
function tokenize(d) {
  const out = [];
  let i = 0, inArc = false, argi = 0;
  while (i < d.length) {
    const c = d[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) { out.push(c); i++; inArc = c === 'a' || c === 'A'; argi = 0; continue; }
    if (/[\s,]/.test(c)) { i++; continue; }
    if (inArc && (argi % 7 === 3 || argi % 7 === 4) && (c === '0' || c === '1')) {
      out.push(+c); i++; argi++; continue;
    }
    NUM.lastIndex = i;
    const m = NUM.exec(d);
    if (!m) { i++; continue; }  // skip junk
    out.push(+m[0]);
    i = NUM.lastIndex;
    argi++;
  }
  return out;
}

function cubic(out, p0, p1, p2, p3, tol) {
  const dd = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
  const n = Math.max(1, Math.min(1000, Math.ceil(Math.sqrt(dd / tol) * 1.2)));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

function quad(out, p0, p1, p2, tol) {
  cubic(out, p0, [p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1])],
    [p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1])], p2, tol);
}

// Endpoint arc -> centre form (SVG spec F.6.5), then sampled.
function arc(out, p0, rx, ry, phiDeg, large, sweep, p1, tol) {
  if (p0[0] === p1[0] && p0[1] === p1[1]) return;
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) { out.push(p1); return; }
  const phi = phiDeg * Math.PI / 180, cs = Math.cos(phi), sn = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = cs * dx + sn * dy, y1 = -sn * dx + cs * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = co * rx * y1 / ry, cyp = -co * ry * x1 / rx;
  const cx = cs * cxp - sn * cyp + (p0[0] + p1[0]) / 2, cy = sn * cxp + cs * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const r = Math.max(rx, ry);
  const stepAng = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tol / r)));
  const n = Math.max(1, Math.min(1000, Math.ceil(Math.abs(dt) / (stepAng || 0.1))));
  for (let i = 1; i <= n; i++) {
    const t = t1 + dt * i / n;
    const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    out.push([cs * ex - sn * ey + cx, sn * ex + cs * ey + cy]);
  }
  out[out.length - 1] = [p1[0], p1[1]];
}

export function flattenPath(d, tol = 0.05) {
  const tok = tokenize(d);
  const paths = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  let lastC = null, lastQ = null;  // reflected control points for S and T
  let k = 0;
  const num = () => tok[k++];
  const has = () => k < tok.length && typeof tok[k] === 'number';
  const start = () => { cur = [[x, y]]; paths.push(cur); };
  while (k < tok.length) {
    if (typeof tok[k] === 'string') cmd = tok[k++];
    else if (!cmd) { k++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (cur) cur.push([sx, sy]);
      x = sx; y = sy; cur = null; lastC = lastQ = null;
      cmd = null;  // numbers straight after Z are invalid and get skipped
      continue;
    }
    if (!has()) { continue; }
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') {
      x = ox + num(); y = oy + num(); sx = x; sy = y; start();
      cmd = rel ? 'l' : 'L';  // implicit repeats are line-tos
      lastC = lastQ = null;
      continue;
    }
    if (!cur) start();
    const p0 = [x, y];
    if (C === 'L') { x = ox + num(); y = oy + num(); cur.push([x, y]); lastC = lastQ = null; }
    else if (C === 'H') { x = ox + num(); cur.push([x, y]); lastC = lastQ = null; }
    else if (C === 'V') { y = oy + num(); cur.push([x, y]); lastC = lastQ = null; }
    else if (C === 'C') {
      const p1 = [ox + num(), oy + num()], p2 = [ox + num(), oy + num()];
      x = ox + num(); y = oy + num();
      cubic(cur, p0, p1, p2, [x, y], tol); lastC = p2; lastQ = null;
    } else if (C === 'S') {
      const p1 = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
      const p2 = [ox + num(), oy + num()];
      x = ox + num(); y = oy + num();
      cubic(cur, p0, p1, p2, [x, y], tol); lastC = p2; lastQ = null;
    } else if (C === 'Q') {
      const p1 = [ox + num(), oy + num()];
      x = ox + num(); y = oy + num();
      quad(cur, p0, p1, [x, y], tol); lastQ = p1; lastC = null;
    } else if (C === 'T') {
      const p1 = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
      x = ox + num(); y = oy + num();
      quad(cur, p0, p1, [x, y], tol); lastQ = p1; lastC = null;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
      x = ox + num(); y = oy + num();
      arc(cur, p0, rx, ry, rot, !!large, !!sweep, [x, y], tol); lastC = lastQ = null;
    } else { k++; }
  }
  return paths.filter(p => p.length > 1);
}
