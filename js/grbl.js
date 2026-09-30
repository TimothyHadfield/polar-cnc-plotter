// Talks to GRBL 1.1. Works over any "transport": { write(text), onLine, close() }.
// Lines are streamed with GRBL's character-counting method: keep at most 127 bytes
// waiting in its 128-byte receive buffer, and count one `ok`/`error` per line.

export const RX_LIMIT = 127;
// GRBL on an Uno acknowledges a line when it enters its 16-slot (15 usable) planner buffer, so up
// to this many acknowledged lines may not have been drawn yet.
export const PLANNER = 15;
export const isPause = text => /^M0+(?!\d)/i.test(text);   // M0: program pause (pen change)

const ERRORS = {
  1: 'a letter was expected', 2: 'bad number', 3: 'unknown $ command', 8: 'only allowed when idle',
  9: 'locked by an alarm (unlock first)', 15: 'jog goes past the soft limits', 20: 'unsupported command',
  22: 'no feed rate set', 24: 'two commands need the same axis', 33: 'bad arc or motion target',
};
const ALARMS = {
  1: 'hard limit switch hit', 2: 'move would go past the soft limits', 3: 'reset while moving, position may be lost',
  4: 'probe fail', 5: 'probe fail', 6: 'homing failed', 8: 'homing failed', 9: 'homing failed',
};
export const errorText = n => `error ${n}: ${ERRORS[n] || 'see GRBL error codes'}`;
export const alarmText = n => `alarm ${n}: ${ALARMS[n] || 'see GRBL alarm codes'}`;

// "<Run|MPos:1.000,2.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>" -> fields. WCO only comes now and then.
export function parseStatus(line, lastWco = [0, 0, 0]) {
  const parts = line.slice(1, -1).split('|');
  const out = { state: parts[0], wco: lastWco };
  const nums = s => s.split(',').map(Number);
  for (const p of parts.slice(1)) {
    const [k, v] = p.split(':');
    if (k === 'MPos') out.mpos = nums(v);
    else if (k === 'WPos') out.wpos = nums(v);
    else if (k === 'WCO') out.wco = nums(v);
  }
  if (out.mpos && !out.wpos) out.wpos = out.mpos.map((m, i) => m - out.wco[i]);
  if (out.wpos && !out.mpos) out.mpos = out.wpos.map((w, i) => w + out.wco[i]);
  return out;
}

// G-code text -> the lines GRBL should get (comments and blank lines dropped).
export function gcodeLines(text) {
  return text.split(/\r?\n/)
    .map(l => l.replace(/\(.*?\)/g, '').replace(/;.*/, '').trim())
    .filter(Boolean);
}

// ["$100=47.620", "$101=17.132 (y, step/mm)"] -> { 100: 47.62, 101: 17.132 }. Other lines are ignored.
export function parseSettings(lines) {
  const out = {};
  for (const l of lines) {
    const m = /^\$(\d+)=\s*(-?[\d.]+)/.exec(String(l).trim());
    if (m) out[+m[1]] = +m[2];
  }
  return out;
}

export class Grbl {
  constructor(transport, { onStatus = () => {}, onLog = () => {}, onEvent = () => {} } = {}) {
    this.t = transport;
    this.onStatus = onStatus; this.onLog = onLog; this.onEvent = onEvent;
    this.queue = [];        // waiting to be sent: { text, resolve, reject, job }
    this.pending = [];      // sent, waiting for ok/error: same objects
    this.inFlight = 0;      // bytes in GRBL's receive buffer
    this.status = null;
    this.wco = [0, 0, 0];
    this.center = null;     // machine X/Y where "set center" was pressed
    this.job = null;
    this.waiters = [];      // { test(line), resolve }
    this.expectReset = false;
    transport.onLine = line => this.line(line);
  }

  // ---------- receiving ----------
  line(line) {
    if (line.startsWith('<') && line.endsWith('>')) {
      this.status = parseStatus(line, this.wco);
      this.wco = this.status.wco;
      // Idle: everything acknowledged before this report has been drawn
      if (this.job && this.status.state === 'Idle') this.job.sure = this.job.done;
      this.onStatus(this.status);
    } else if (line === 'ok' || line.startsWith('error:')) {
      const c = this.pending.shift();
      if (!c) return;
      this.inFlight -= c.text.length + 1;
      if (line === 'ok') c.resolve();
      else {
        const n = +line.slice(6);
        this.onLog(`${c.text}  →  ${errorText(n)}`);
        if (c.job) this.jobError(c, n); else c.reject(new Error(errorText(n)));
      }
      this.pump();
    } else if (line.startsWith('Grbl ')) {
      this.reset(line);
    } else if (line.startsWith('ALARM:')) {
      const n = +line.slice(6);
      this.onLog(alarmText(n));
      if (this.job) this.endJob(new Error(alarmText(n)));
      this.onEvent('alarm', alarmText(n));
    } else {
      this.onLog(line);
    }
    for (const w of [...this.waiters]) if (w.test(line)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(line); }
  }

  // GRBL restarted (banner). Everything in flight is gone.
  reset(banner) {
    const err = new Error('The plotter restarted.');
    for (const c of [...this.pending, ...this.queue]) if (!c.job) c.reject(err);
    this.pending = []; this.queue = []; this.inFlight = 0;
    if (this.job) this.endJob(err);
    if (!this.expectReset) this.center = null;   // a hardware reset zeroes the position
    this.onLog(banner);
    this.onEvent('reset');
  }

  waitFor(test, ms = 3000) {
    return new Promise((resolve, reject) => {
      const w = { test, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) { this.waiters.splice(i, 1); reject(new Error('The plotter did not answer.')); }
      }, ms);
    });
  }
  nextStatus(ms = 2000) {
    this.realtime('?');
    return this.waitFor(l => l.startsWith('<'), ms).then(() => this.status);
  }

  // Connecting over USB restarts the Uno; wait for its banner (or ask for one).
  async ready() {
    try { await this.waitFor(l => l.startsWith('Grbl '), 2500); }
    catch { this.realtime('\x18'); await this.waitFor(l => l.startsWith('Grbl '), 2500); }
    await this.nextStatus();
  }

  // ---------- sending ----------
  realtime(ch) { this.t.write(ch); }

  send(text) {
    return new Promise((resolve, reject) => { this.queue.push({ text, resolve, reject }); this.pump(); });
  }

  pump() {
    while (this.queue.length) {
      const c = this.queue[0];
      if (c.job && this.job?.held) break;
      const n = c.text.length + 1;
      if (this.inFlight + n > RX_LIMIT && this.pending.length) break;
      this.queue.shift();
      this.pending.push(c);
      this.inFlight += n;
      this.t.write(c.text + '\n');
    }
  }

  // ---------- plotting ----------
  // Resolves when every line is accepted and the machine is idle again.
  stream(lines, onProgress = () => {}) {
    if (this.job) return Promise.reject(new Error('Already plotting.'));
    return new Promise((resolve, reject) => {
      const job = this.job = { lines, total: lines.length, done: 0, sure: 0, held: false, resolve, reject, errors: [] };
      lines.forEach((text, i) => this.queue.push({
        text, job, index: i,
        resolve: () => { job.done++; onProgress(job.done / job.total); if (job.done === job.total) this.finish(job); },
        reject: () => {},
      }));
      this.pump();
    });
  }

  async finish(job) {
    // all lines are in GRBL's planner; wait until it has drawn them
    while (this.job === job) {
      try {
        const s = await this.nextStatus();
        if (s.state === 'Idle') return this.endJob(null);
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Lines of the current job that have surely been drawn (lines[0..n-1]). Lags a little, never ahead.
  drawnLines() {
    const j = this.job;
    if (!j) return 0;
    return Math.min(j.done, Math.max(j.sure, j.done - PLANNER, this.programPause() + 1, 0));
  }

  // Held by an M0 in the job (a pen change), not by Pause: that M0's line index, else -1.
  // GRBL empties its planner before an M0, then holds; the M0 is the last or next line acknowledged.
  programPause() {
    const j = this.job;
    if (!j || j.held || !/^Hold/.test(this.status?.state || '')) return -1;
    for (const i of [j.done - 1, j.done]) if (i >= 0 && isPause(j.lines[i] || '')) return i;
    return -1;
  }

  endJob(err) {
    const job = this.job;
    if (!job) return;
    this.lastJob = { total: job.total, drawn: err ? this.drawnLines() : job.total };
    this.job = null;
    this.queue = this.queue.filter(c => c.job !== job);
    if (err) job.reject(err); else job.resolve({ errors: job.errors });
  }

  // A rejected line pauses the plot so nothing surprising happens; resume skips it.
  jobError(c, n) {
    c.job.errors.push({ line: c.index + 1, text: c.text, error: errorText(n) });
    c.job.done++;
    this.pause();
    this.onEvent('jobError', `Paused: line ${c.index + 1} (${c.text}) was refused, ${errorText(n)}.`);
    if (c.job.done === c.job.total) this.finish(c.job);
  }

  pause() { if (this.job) this.job.held = true; this.realtime('!'); }
  resume() { if (this.job) this.job.held = false; this.realtime('~'); this.pump(); }

  // Stop now: hold (so the position is kept), reset to empty GRBL's buffers, unlock if needed.
  async stop() {
    const center = this.center;
    if (this.job) this.job.held = true;
    this.realtime('!');
    for (const until = Date.now() + 3000; Date.now() < until;) {
      const s = await this.nextStatus(500).catch(() => null);
      if (s && /^(Hold:0|Idle)/.test(s.state)) break;
      await new Promise(r => setTimeout(r, 50));
    }
    if (this.job) this.endJob(new Error('Stopped.'));
    this.expectReset = true;
    const banner = this.waitFor(l => l.startsWith('Grbl '), 3000);
    this.realtime('\x18');
    try { await banner; } finally { this.expectReset = false; }
    const s = await this.nextStatus();
    if (s.state === 'Alarm') { await this.send('$X'); this.center = null; return false; }
    this.center = center;
    if (center) await this.restoreCenter();
    return !!center;
  }

  // ---------- machine helpers ----------
  async setCenter() {
    await this.send('G92 X0 Y0');
    const s = await this.nextStatus();
    this.center = [s.mpos[0], s.mpos[1]];
  }
  // `$$` -> { 100: 47.62, 101: 17.132, … } (the `$n=value` lines GRBL prints before its ok).
  async readSettings() {
    const lines = [];
    const grab = { test: l => { if (/^\$\d+=/.test(l)) lines.push(l); return false; }, resolve() {} };
    this.waiters.push(grab);
    try { await this.send('$$'); }
    finally { const i = this.waiters.indexOf(grab); if (i >= 0) this.waiters.splice(i, 1); }
    return parseSettings(lines);
  }
  // G92 may not survive a reset; put it back from the remembered machine position.
  async restoreCenter() {
    const s = await this.nextStatus();
    const f = v => v.toFixed(3);
    await this.send(`G92 X${f(s.mpos[0] - this.center[0])} Y${f(s.mpos[1] - this.center[1])}`);
  }
}

// Lines to finish a plot that ended early. `lines` as streamed (gcodeLines), `from` = first line to
// run again. Pen up, pen-up rapid to where line `from` starts, pen back to the Z in effect there, rest.
export function resumeLines(lines, from, penUp) {
  let x = 0, y = 0, z = penUp;
  for (const l of lines.slice(0, from)) {
    const w = {};
    for (const [, k, v] of l.toUpperCase().matchAll(/([XYZ])\s*(-?[\d.]+)/g)) w[k] = +v;
    if (w.X !== undefined) x = w.X;
    if (w.Y !== undefined) y = w.Y;
    if (w.Z !== undefined) z = w.Z;
  }
  const f = v => +v.toFixed(3);
  return ['G21 G90 G93', `G0 Z${f(penUp)}`, `G0 X${f(x)} Y${f(y)}`, `G0 Z${f(z)}`, ...lines.slice(from)];
}
export const RESUME_HEADER = 4;

// Where to restart after a plot stopped with `drawn` lines surely drawn: a few lines back, for overlap,
// but never back across a pen change (M0), which would draw the overlap with the wrong pen.
export function resumePoint(lines, drawn, overlap = 5) {
  let from = Math.max(0, drawn - overlap);
  for (let i = drawn - 1; i >= from; i--) if (isPause(lines[i] || '')) { from = i + 1; break; }
  return from;
}

// ---------- Web Serial (Chrome / Edge) ----------
export async function openSerial(port, onClose = () => {}) {
  await port.open({ baudRate: 115200 });
  const writer = port.writable.getWriter();
  const decoder = new TextDecoderStream();
  const piped = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let open = true;
  const t = {
    onLine: null,
    // bytes as-is (0x85 jog-cancel must stay one byte)
    write: s => open ? writer.write(Uint8Array.from(s, c => c.charCodeAt(0))).catch(() => {}) : Promise.resolve(),
    async close() {
      if (!open) return;
      open = false;
      try { await reader.cancel(); await piped; } catch {}
      try { writer.releaseLock(); } catch {}
      try { await port.close(); } catch {}
    },
  };
  (async () => {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line) t.onLine?.(line);
        }
      }
    } catch {}
    if (open) { open = false; try { writer.releaseLock(); } catch {} try { await port.close(); } catch {} }
    onClose();
  })();
  return t;
}
