// A pretend GRBL that moves in real time, for the simulator (sim.html). Same transport shape as
// FakeGrbl / openSerial(): write(text), onLine, close().
//
// Like GRBL 1.1 on an Uno: a line is acknowledged when it enters the 15-block planner, and blocks
// run one after another at their real speed. G0 and jogs run at the axes' max rates ($110-$112);
// G1 takes F as mm/min (G94) or as 1/minutes for this move (G93, inverse time, used by polar.js),
// and never faster than the max rates allow. Y is platter degrees, counted as "mm" like GRBL does.
// Not modelled: acceleration ($120-$122), so moves start and stop at full speed.
// `speed` runs the clock faster (2 = twice as fast). `pos` is the live machine position;
// `trail` collects the end of every finished block (as real positions, see real()), so a drawing
// can follow every corner.
import { FakeGrbl } from './fakegrbl.js';

export const PLANNER_BLOCKS = 15;
const now = () => performance.now();

export class SimGrbl extends FakeGrbl {
  constructor({ speed = 1, pos = [0, 0, 0], tickMs = 8, bootMs = 30 } = {}) {
    super({ lineMs: tickMs, moveTicks: 0, bootMs });
    this.speed = speed;
    this.pos = pos.slice();
    this.end = pos.slice();        // where the planner's last block ends
    this.planner = [];             // { from, to, ms, jog }
    this.block = null; this.done = 0;
    this.trail = [];
    this.g93 = false; this.feed = 0; this.rapid = true;
    // factory GRBL 1.1 max rates (Tim's EEPROM is factory: progress.md 11-10)
    Object.assign(this.settings, { 110: '500.000', 111: '500.000', 112: '500.000' });
    // the steps per unit this machine was built with: a different $100-$102 makes every move
    // come out longer or shorter, as on the real plotter (see real())
    this.true = [100, 101, 102].map(n => +this.settings[n]);
    this.last = now();
  }

  // where the machine really is (mm, degrees, mm) for a position GRBL reports
  real(p = this.pos) { return p.map((v, i) => v * +this.settings[100 + i] / this.true[i]); }
  rescale(axis, k) { this.pos[axis] *= k; this.end[axis] *= k; }

  // replies arrive as soon as possible (a microtask), so the sender can keep the planner full
  emit(line) { if (this.alive) Promise.resolve().then(() => this.alive && this.onLine?.(line)); }

  write(s) {
    for (const ch of s) {
      if (ch === '?') this.report();
      else if (ch === '!') { if (this.busy()) { this.hold = true; this.state = 'Hold:0'; } }
      else if (ch === '~') {
        if (this.hold) { this.hold = false; this.last = now(); }
        if (this.m0) { this.m0 = false; this.emit('ok'); }
      }
      else if (ch === '\x18') this.softReset();
      else if (ch === '\x85') this.cancelJog();
      else this.buf += ch;
    }
    if (this.buf.length > this.rx) this.overflow = true;
    Promise.resolve().then(() => this.alive && this.fill());
    return Promise.resolve();
  }

  busy() { return !!(this.block || this.planner.length || this.buf); }

  report() {
    if (!this.hold && this.state !== 'Alarm') this.state = this.block ? (this.block.jog ? 'Jog' : 'Run') : this.planner.length ? 'Run' : 'Idle';
    super.report();
  }

  softReset() {
    const lost = (this.block || this.planner.length) && !this.hold;
    this.planner = []; this.block = null; this.end = this.pos.slice();
    this.g93 = false; this.rapid = true;
    this.state = lost ? 'Run' : 'Idle';   // FakeGrbl: Run + not held = alarm
    super.softReset();
  }

  cancelJog() {
    if (this.block?.jog) this.block = null;
    this.planner = this.planner.filter(b => !b.jog);
    this.end = (this.planner.at(-1)?.to ?? this.pos).slice();
  }

  // ---------- time ----------
  tick() {
    const t = now(), dt = (t - this.last) * this.speed;
    this.last = t;
    if (!this.hold) this.advance(dt);
    this.fill();
  }

  advance(dt) {
    while (dt > 0) {
      if (!this.block) {
        this.block = this.planner.shift() ?? null;
        this.done = 0;
        if (!this.block) return;
      }
      const b = this.block, left = b.ms - this.done;
      if (dt >= left) {
        dt -= left;
        this.pos = b.to.slice();
        this.trail.push(this.real());
        this.block = null;
      } else {
        this.done += dt;
        const k = this.done / b.ms;
        this.pos = b.from.map((v, i) => v + (b.to[i] - v) * k);
        dt = 0;
      }
    }
  }

  // ---------- receiving lines ----------
  // Takes lines into the planner while there is room. Lines that need the machine to stand still
  // (M0, G92, $ commands) wait until every block has run.
  fill() {
    for (;;) {
      if (this.hold && this.m0) return;
      const i = this.buf.indexOf('\n');
      if (i < 0) return;
      const line = this.buf.slice(0, i).trim().toUpperCase();
      const still = /^M0+(?!\d)|G92|^\$(?!J=)/.test(line);
      if (still && (this.block || this.planner.length)) return;
      if (this.planner.length >= PLANNER_BLOCKS) return;
      this.buf = this.buf.slice(i + 1);
      this.received.push(line);
      const reply = this.run(line);
      if (reply) this.emit(reply);
    }
  }

  run(line) {
    if (!line) return 'ok';
    if (line.startsWith('$') && !line.startsWith('$J=')) return this.exec(line);   // $$, $X, $n=
    if (this.state === 'Alarm') return 'error:9';
    if (/^M0+(?!\d)/.test(line)) return this.exec(line);                            // hold until ~
    const jog = line.startsWith('$J=');
    const words = (jog ? line.slice(3) : line).match(/[A-Z][-+.\d]*/g) || [];
    let rel = jog ? false : !this.abs, g92 = false, motion = null, f = null;
    const target = {};
    for (const w of words) {
      const k = w[0], v = parseFloat(w.slice(1));
      if (!'GMXYZFN'.includes(k)) return 'error:20';
      if (k === 'G') {
        if (v === 0 || v === 1) motion = v;
        else if (v === 90 || v === 91) { rel = v === 91; if (!jog) this.abs = v === 90; }
        else if (v === 92) g92 = true;
        else if (v === 93 || v === 94) this.g93 = v === 93;
      }
      if (k === 'M' && (v === 2 || v === 30)) { this.g93 = false; this.abs = true; this.rapid = true; }
      if (k === 'F') f = v;
      if ('XYZ'.includes(k)) target['XYZ'.indexOf(k)] = v;
    }
    if (motion !== null) this.rapid = motion === 0;
    if (f !== null && !this.g93) this.feed = f;
    if (!Object.keys(target).length) return 'ok';
    if (g92) {
      for (const [a, v] of Object.entries(target)) this.wco[a] = this.pos[a] - v;
      return 'ok';
    }
    const to = this.end.slice();
    for (const [a, v] of Object.entries(target)) to[a] = rel ? to[a] + v : v + this.wco[a];
    const d = to.map((v, i) => v - this.end[i]), len = Math.hypot(...d);
    if (len === 0) return 'ok';
    // fastest each axis may go: $110-$112 (per minute)
    let min = Math.max(...d.map((v, i) => Math.abs(v) / (+this.settings[110 + i] || 500)));
    if (jog || !this.rapid) {
      const F = jog ? f : this.g93 ? f : this.feed;
      if (!(F > 0)) return 'error:22';                                  // no feed rate
      min = Math.max(min, this.g93 && !jog ? 1 / F : len / F);
    }
    this.planner.push({ from: this.end, to, ms: min * 60000, jog });
    this.end = to;
    return 'ok';
  }
}
