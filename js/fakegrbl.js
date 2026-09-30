// A pretend GRBL 1.1 on the other end of the "USB cable", for tests and for ?demo.
// Same transport shape as openSerial(): write(text), onLine, close().
// It keeps a real 128-byte receive buffer and records if a sender ever overflows it.

export class FakeGrbl {
  constructor({ lineMs = 1, moveTicks = 0, rx = 128, failIf = null, bootMs = 30 } = {}) {
    this.lineMs = lineMs; this.moveTicks = moveTicks; this.rx = rx; this.failIf = failIf;
    this.onLine = null;
    this.buf = '';            // bytes received, not yet executed
    this.overflow = false;
    this.received = [];       // every line executed, in order
    this.state = 'Idle';
    this.hold = false;
    this.pos = [0, 0, 0];     // machine position
    this.wco = [0, 0, 0];     // G92 offset
    this.abs = true;
    this.moving = 0;          // ms of motion left
    this.alive = true;
    this.settings = { 100: '47.620', 101: '17.132', 102: '100.000' };   // `$n=` values, echoed by `$$`
    setTimeout(() => this.emit("Grbl 1.1h ['$' for help]"), bootMs);  // opening the port resets the Uno
    this.timer = setInterval(() => this.tick(), lineMs);
  }
  emit(line) {
    const later = typeof setImmediate === 'function' ? setImmediate : f => setTimeout(f, 0);
    if (this.alive) later(() => this.onLine?.(line));
  }

  write(s) {
    for (const ch of s) {
      if (ch === '?') this.report();
      else if (ch === '!') { if (this.state === 'Run' || (this.state === 'Idle' && this.buf)) { this.hold = true; this.state = 'Hold:0'; } }
      else if (ch === '~') { if (this.hold) { this.hold = false; this.state = this.buf || this.moving ? 'Run' : 'Idle'; } }
      else if (ch === '\x18') this.softReset();
      else if (ch === '\x85') { this.moving = 0; }
      else {
        this.buf += ch;
        if (this.buf.length > this.rx) this.overflow = true;
      }
    }
    if (!this.moveTicks && typeof setImmediate === 'function') setImmediate(() => this.alive && this.tick());
    return Promise.resolve();
  }

  report() {
    const f = a => a.map(v => v.toFixed(3)).join(',');
    this.emit(`<${this.state}|MPos:${f(this.pos)}|FS:0,0|WCO:${f(this.wco)}>`);
  }

  softReset() {
    const lost = this.state === 'Run' && !this.hold;
    this.buf = ''; this.moving = 0; this.hold = false; this.abs = true;
    this.wco = [0, 0, 0];     // worst case: G92 does not survive a reset
    this.state = lost ? 'Alarm' : 'Idle';
    setTimeout(() => {
      this.emit("Grbl 1.1h ['$' for help]");
      if (lost) this.emit('[MSG:Reset to continue]');
    }, 20);
  }

  // Runs every buffered line it can (timers on Windows tick every ~15 ms, so one line per tick
  // would be far too slow); a move with moveTicks > 0 makes it wait before the next line.
  tick() {
    if (this.moving > 0 && !this.hold) this.moving -= this.lineMs;
    for (;;) {
      if (this.hold || this.moving > 0) return;
      const i = this.buf.indexOf('\n');
      if (i < 0) { if (this.state === 'Run') this.state = 'Idle'; return; }
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      this.received.push(line);
      this.emit(this.exec(line));
    }
  }

  exec(line) {
    if (this.failIf?.(line, this.received.length)) return 'error:2';
    if (line === '$X') { if (this.state === 'Alarm') this.state = 'Idle'; return 'ok'; }
    if (line === '$$') { Object.entries(this.settings).forEach(([n, v]) => this.emit(`$${n}=${v}`)); return 'ok'; }
    if (this.state === 'Alarm') return 'error:9';
    const set = /^\$(\d+)=(-?[\d.]+)$/.exec(line);
    if (set) { this.settings[set[1]] = (+set[2]).toFixed(3); return 'ok'; }
    if (/^\$\d+=/.test(line)) return 'ok';
    const jog = line.startsWith('$J=');
    const words = (jog ? line.slice(3) : line).toUpperCase().match(/[A-Z][-+.\d]*/g) || [];
    let rel = !this.abs, g92 = false;
    const target = {};
    for (const w of words) {
      const k = w[0], v = parseFloat(w.slice(1));
      if (!'GMXYZF'.includes(k)) return 'error:20';
      if (k === 'G' && v === 90) { if (jog) rel = false; else { this.abs = true; rel = false; } }
      if (k === 'G' && v === 91) { if (jog) rel = true; else { this.abs = false; rel = true; } }
      if (k === 'G' && v === 92) g92 = true;
      if ('XYZ'.includes(k)) target['XYZ'.indexOf(k)] = v;
    }
    for (const [a, v] of Object.entries(target)) {
      if (g92) this.wco[a] = this.pos[a] - v;
      else {
        this.pos[a] = rel ? this.pos[a] + v : v + this.wco[a];
        this.moving = this.lineMs * this.moveTicks;
        this.state = 'Run';
      }
    }
    return 'ok';
  }

  close() { this.alive = false; clearInterval(this.timer); return Promise.resolve(); }
}
