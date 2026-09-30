// The plotter controls: connect over USB (Web Serial), jog, pen, set center, plot / pause / stop.
// Shown only in browsers that can talk to USB serial (Chrome / Edge on a computer), or with ?demo.

import { Grbl, openSerial, gcodeLines } from './grbl.js';
import { FakeGrbl } from './fakegrbl.js';

const $ = id => document.getElementById(id);

export function initMachine({ getJob, getSettings, onPen }) {
  const demo = new URLSearchParams(location.search).has('demo');
  if (!('serial' in navigator) && !demo) return null;
  $('machine').hidden = false;
  $('consoleBox').hidden = false;

  let grbl = null, link = null, poll = 0, step = 1, running = false, paused = false;
  const panel = document.querySelector('.panel');

  // ---------- messages ----------
  const log = line => {
    const el = $('log');
    el.textContent = (el.textContent + line + '\n').split('\n').slice(-80).join('\n');
    el.scrollTop = el.scrollHeight;
  };
  const say = (text, bad = false) => { $('mMsg').textContent = text; $('mMsg').classList.toggle('bad', bad); };

  // ---------- state shown on screen ----------
  function refresh() {
    const on = !!grbl;
    $('offline').hidden = on;
    $('live').hidden = !on;
    panel.classList.toggle('connected', on);
    $('run').hidden = !running;
    $('plot').hidden = running;
    const busy = running || !on;
    document.querySelectorAll('[data-jog],[data-pen],#setCenter').forEach(b => { b.disabled = busy; });
    const job = getJob();
    const plot = $('plot');
    plot.disabled = busy || !grbl?.center || !job;
    plot.textContent = !job ? 'Plot' : grbl && !grbl.center ? 'Set center first' : 'Plot';
    $('pause').textContent = paused ? 'Resume' : 'Pause';
  }

  function showStatus(s) {
    const state = s.state.split(':')[0];
    $('mState').textContent = state;
    $('mDot').dataset.state = state;
    $('mPos').textContent = grbl?.center ? `r ${s.wpos[0].toFixed(1)} mm · θ ${s.wpos[1].toFixed(1)}°` : 'center not set';
    onPen(grbl?.center ? s.wpos : null);
  }

  // ---------- connect ----------
  async function connect() {
    try {
      say('Connecting…');
      if (demo) link = new FakeGrbl({ lineMs: 16, moveTicks: 1 });
      else link = await openSerial(await navigator.serial.requestPort(), () => lost());
      grbl = new Grbl(link, {
        onStatus: showStatus,
        onLog: log,
        onEvent: (e, msg) => {
          if (e === 'reset' && !running) { say('The plotter restarted. Set center again.'); refresh(); }
          if (e === 'alarm') say(`Alarm: ${msg.replace(/^alarm \d+: /, '')}. Unlock with $X in the Settings console.`, true);
          if (e === 'jobError') { paused = true; say(msg, true); refresh(); }
        },
      });
      await grbl.ready();
      poll = setInterval(() => grbl?.realtime('?'), 250);
      say('Move the pen over the platter center, then Set center.');
      refresh();
    } catch (e) {
      if (e.name !== 'NotFoundError') say(e.message.includes('open') ? 'Could not open the port. Is UGS or the Arduino app still connected?' : e.message, true);
      else say('');
      await drop();
    }
  }
  async function drop() {
    clearInterval(poll);
    const l = link;
    grbl = null; link = null; running = false; paused = false;
    onPen(null);
    refresh();
    try { await l?.close(); } catch {}
  }
  function lost() {
    if (!grbl) return;
    say(running ? 'The plotter was unplugged mid-plot.' : 'The plotter was unplugged.', true);
    drop();
  }

  // ---------- jog, pen, center ----------
  const run = async p => { try { await p; } catch (e) { say(e.message, true); } };
  document.querySelectorAll('[data-jog]').forEach(b => b.addEventListener('click', () => {
    const s = getSettings();
    let [axis, dir] = [b.dataset.jog[0], b.dataset.jog[1] === '+' ? 1 : -1];
    if (axis === 'Y' && s.flip) dir = -dir;                          // keep ↺ matching the preview
    if (axis === 'Z' && s.penUp < s.penDown) dir = -dir;             // ▲ always lifts
    const feed = axis === 'Z' ? 200 : 1000;
    run(grbl.send(`$J=G91 G21 ${axis}${(dir * step).toFixed(3)} F${feed}`));
  }));
  document.querySelectorAll('[data-pen]').forEach(b => b.addEventListener('click', () => {
    const s = getSettings();
    run(grbl.send(`G90 G0 Z${b.dataset.pen === 'up' ? s.penUp : s.penDown}`));
  }));
  $('steps').addEventListener('click', e => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    step = +b.dataset.step;
    $('steps').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('setCenter').addEventListener('click', () => run(grbl.setCenter().then(() => { say('Center set.'); refresh(); })));

  // ---------- plot ----------
  $('plot').addEventListener('click', async () => {
    const job = getJob();
    if (!job || !grbl?.center) return;
    const lines = gcodeLines(job.gcode);
    running = true; paused = false;
    say('');
    refresh();
    const t0 = Date.now();
    const progress = f => {
      $('bar').style.width = (f * 100).toFixed(1) + '%';
      const left = f > 0.02 ? (Date.now() - t0) * (1 - f) / f / 60000 : job.minutes * (1 - f);
      $('runText').textContent = `${Math.floor(f * 100)}% · ~${Math.max(1, Math.round(left))} min left`;
    };
    progress(0);
    try {
      const res = await grbl.stream(lines, progress);
      say(res.errors.length ? `Done, ${res.errors.length} line(s) skipped.` : `Done in ${Math.max(1, Math.round((Date.now() - t0) / 60000))} min.`);
    } catch (e) {
      if (e.message !== 'Stopped.') say(e.message, true);
    }
    running = false; paused = false;
    refresh();
  });
  $('pause').addEventListener('click', () => {
    if (paused) { grbl.resume(); paused = false; say(''); } else { grbl.pause(); paused = true; }
    refresh();
  });
  $('stop').addEventListener('click', async () => {
    $('stop').disabled = true;
    try {
      const kept = await grbl.stop();
      await grbl.send(`G90 G0 Z${getSettings().penUp}`);
      say(kept ? 'Stopped. Pen lifted.' : 'Stopped. Position was lost: set center again.');
    } catch (e) { say(e.message, true); }
    $('stop').disabled = false;
    running = false; paused = false;
    refresh();
  });

  // ---------- console (in Settings) ----------
  $('cmdForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('cmd').value.trim();
    if (!text) return;
    if (!grbl) { log('Not connected.'); return; }
    log('> ' + text);
    $('cmd').value = '';
    grbl.send(text).then(() => log('ok'), () => {});
  });

  $('connect').addEventListener('click', connect);
  $('disconnect').addEventListener('click', () => { say(''); drop(); });
  window.addEventListener('beforeunload', e => { if (running) { e.preventDefault(); e.returnValue = ''; } });
  if (!demo) navigator.serial.addEventListener('disconnect', () => lost());

  refresh();
  return { refresh, getGrbl: () => grbl, say };
}
