/* count-track-test.mjs — the count track's SCHEDULING, not just "did it make a noise".
   Drives the SHIPPED engine with a fake canvas + a fake AudioContext whose clock I control.

   The regressions this pins (all reported from TestFlight as "weird clicking sounds"):

   1. CLICKS FROM THE ENVELOPE. Ticks were scheduled at currentTime + 0.0005 — half a millisecond
      ahead, i.e. INSIDE the render quantum already being computed. The 4 ms attack ramp therefore
      began in the past, so the first sample the hardware actually rendered jumped straight to a
      non-zero gain. That step discontinuity IS the click. The oscillator was also stopped while
      the gain was still non-zero, truncating the waveform mid-cycle for a second one.

   2. PILE-UPS. While the context is suspended its currentTime is FROZEN. The old beep() registered
      a fresh resume().then(fire) for every dropped tick, so when the resume finally landed, every
      queued tick fired at the same frozen instant — several oscillators stacked on one sample.

   3. JITTER. Ticks were fired the moment a rAF frame noticed the count had flipped, so the
      metronome inherited a full frame of jitter plus every main-thread stall from canvas drawing
      and GC — and stopped dead whenever the webview throttled frames.
*/
import fs from 'fs';

// ---- a fake AudioContext with a clock I can advance, that records what got scheduled ----
class Rec {
  constructor(ctx) { this.ctx = ctx; this.startAt = null; this.stopAt = null; this.gain = []; this.freq = []; }
}
class ClockCtx {
  constructor(state) {
    this.state = state || 'running';
    this.currentTime = 0; this.destination = {};
    this.scheduled = [];                 // every oscillator ever created, with its automation
    this.resumeCalls = 0; this.blockResume = false;
  }
  advance(sec) { this.currentTime = +(this.currentTime + sec).toFixed(9); }
  resume() {
    this.resumeCalls++;
    if (this.blockResume) return Promise.resolve();
    return Promise.resolve().then(() => { this.state = 'running'; });
  }
  createOscillator() {
    const r = new Rec(this); this.scheduled.push(r);
    return {
      type: '',
      frequency: { setValueAtTime: (v, t) => r.freq.push(['set', v, t]),
                   exponentialRampToValueAtTime: (v, t) => r.freq.push(['exp', v, t]) },
      connect(n) { return n; },
      start(t) { r.startAt = t; }, stop(t) { r.stopAt = t; },
      set onended(f) {}, get onended() { return null; },
      _rec: r
    };
  }
  createGain() {
    const r = this.scheduled[this.scheduled.length - 1];
    const g = { gain: { setValueAtTime: (v, t) => r.gain.push(['set', v, t]),
                        linearRampToValueAtTime: (v, t) => r.gain.push(['lin', v, t]),
                        exponentialRampToValueAtTime: (v, t) => r.gain.push(['exp', v, t]) },
                connect() { return g; } };
    return g;
  }
}

const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
const canvas = { width: 300, height: 300, getContext: () => ctx2d, getBoundingClientRect: () => ({ width: 300, height: 300 }) };

globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 1;      // never auto-runs frame(); passes are explicit
globalThis.cancelAnimationFrame = () => {};

// a controllable performance.now() so the VISUAL transport is deterministic too
let PERF = 0;
globalThis.performance = { now: () => PERF };

(0, eval)(fs.readFileSync(new URL('./www/js/engine.js', import.meta.url), 'utf8'));
const { create } = globalThis.ScootEngine;

const BPM = 96, BEAT = 60 / BPM;                 // 0.625 s per count at 100%
const DANCE = { id: 't', name: 'T', counts: 8, walls: 4, bpm: BPM,
  phrases: [{ order: 1, label: 'Counts 1-8', counts_start: 1, counts_end: 8 }],
  events: [1, 2, 3, 4, 5, 6, 7, 8].map(c => ({ count: c, foot: c % 2 ? 'R' : 'L', action: 'step', to_pos: [c % 2 ? 0.5 : -0.5, 0], weight_change: true })) };

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? ' PASS ' : ' FAIL ') + n + (d ? '  [' + d + ']' : '')); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function mk(state) {
  const fake = new ClockCtx(state);
  delete globalThis.__ssAudioCtx;
  globalThis.AudioContext = function () { return fake; };
  PERF = 0;
  const eng = create(canvas, { getSettings: () => ({ countStyle: 'click', haptics: false }), haptic: () => {} });
  eng.load(DANCE);
  return { eng, fake };
}
// advance BOTH clocks together and run a lookahead pass, like the real timer would
function step(eng, fake, sec) { fake.advance(sec); PERF += sec * 1000; eng.pumpAudio(); }

console.log('\nCOUNT TRACK — scheduling\n');

/* 1 ── nothing is ever scheduled into the past (the click) ───────────────── */
{
  const { eng, fake } = mk('running');
  eng.play();
  for (let i = 0; i < 40; i++) step(eng, fake, 0.05);      // 2 s of playback, 20 Hz passes
  const bad = fake.scheduled.filter(r => r.gain[0][2] > r.startAt || !near(r.gain[0][1], 0));
  ok('every tick opens its envelope at exactly gain 0, exactly at start',
     fake.scheduled.length > 0 && bad.length === 0, fake.scheduled.length + ' ticks, ' + bad.length + ' bad');
  const notSilenced = fake.scheduled.filter(r => {
    const last = r.gain[r.gain.length - 1];
    return !(last[0] === 'lin' && near(last[1], 0) && last[2] <= r.stopAt);
  });
  ok('every tick ramps back to true silence BEFORE stop() (no truncation click)',
     notSilenced.length === 0, notSilenced.length + ' truncated');
}

/* 2 ── ticks land exactly one beat apart on the AUDIO clock, whatever the frame rate ─ */
{
  const { eng, fake } = mk('running');
  eng.play();
  // deliberately RAGGED passes — this is what a stuttering webview looks like
  const gaps = [0.016, 0.3, 0.05, 0.4, 0.017, 0.25, 0.5, 0.033, 0.6, 0.2, 0.45, 0.1];
  for (const g of gaps) step(eng, fake, g);
  const t = fake.scheduled.map(r => r.startAt);
  const deltas = t.slice(1).map((v, i) => +(v - t[i]).toFixed(6));
  const even = deltas.every(d => near(d, BEAT, 1e-6));
  ok('ticks are exactly one beat apart even when frames are ragged',
     t.length >= 4 && even, t.length + ' ticks, deltas=' + [...new Set(deltas)].join(','));
}

/* 3 ── accent lands on count 1, and only on count 1 ──────────────────────── */
{
  const { eng, fake } = mk('running');
  eng.play();
  for (let i = 0; i < 60; i++) step(eng, fake, 0.1);       // 6 s ≈ 9.6 counts
  const accents = fake.scheduled.map(r => r.freq[0][1] === 1320);
  const firstEight = accents.slice(0, 8);
  ok('the downbeat is accented and the other seven counts are not',
     firstEight[0] === true && firstEight.slice(1, 8).every(a => a === false),
     firstEight.map(a => a ? 'A' : '.').join(''));
  ok('the accent comes back round on the next count 1',
     accents[8] === true, 'tick9 accent=' + accents[8]);
}

/* 4 ── a suspended context queues NOTHING and asks to resume once, not once per tick ─ */
{
  const { eng, fake } = mk('suspended');
  fake.blockResume = true;                                  // iOS keeps refusing
  eng.play();
  for (let i = 0; i < 40; i++) step(eng, fake, 0.05);       // 2 s of trying
  ok('a suspended context schedules no audio at all (no pile-up to unleash later)',
     fake.scheduled.length === 0, 'scheduled=' + fake.scheduled.length);
  ok('resume is rate-limited, not re-asked on every dropped tick',
     fake.resumeCalls > 0 && fake.resumeCalls <= 8, 'resumeCalls=' + fake.resumeCalls + ' over 2 s');
}

/* 5 ── and when it DOES come back, it does not dump the backlog in one instant ─ */
{
  const { eng, fake } = mk('suspended');
  fake.blockResume = true;
  eng.play();
  for (let i = 0; i < 30; i++) step(eng, fake, 0.05);       // 1.5 s silent
  fake.blockResume = false; fake.state = 'running';
  for (let i = 0; i < 10; i++) step(eng, fake, 0.05);       // 0.5 s alive again
  const t = fake.scheduled.map(r => r.startAt);
  const collisions = t.filter((v, i) => i > 0 && near(v, t[i - 1], 1e-9)).length;
  ok('no two ticks are ever scheduled on the same instant', collisions === 0, 'collisions=' + collisions);
  ok('at most one beat of ticks per half-second of real time after a resume',
     t.length <= 2, 'ticks after resume=' + t.length);
}

/* 6 ── pause() silences what is already queued ───────────────────────────── */
{
  const { eng, fake } = mk('running');
  eng.play();
  // run until a tick is genuinely sitting in the queue, unheard, ahead of the playhead
  for (let i = 0; i < 40 && !fake.scheduled.some(r => r.startAt > fake.currentTime); i++) step(eng, fake, 0.05);
  const queued = fake.scheduled.filter(r => r.startAt > fake.currentTime);
  eng.pause();
  const stillLive = queued.filter(r => r.stopAt > fake.currentTime && r.stopAt > r.startAt);
  ok('pausing kills ticks that were queued but not yet heard',
     queued.length > 0 && stillLive.length === 0, queued.length + ' queued, ' + stillLive.length + ' survived');
}

/* 7 ── a tempo change re-anchors instead of playing the old grid ─────────── */
{
  const { eng, fake } = mk('running');
  eng.play();
  for (let i = 0; i < 20; i++) step(eng, fake, 0.05);
  const before = fake.scheduled.length;
  eng.setTempo(50);                                          // half speed -> 1.25 s per beat
  for (let i = 0; i < 60; i++) step(eng, fake, 0.05);
  const after = fake.scheduled.slice(before).map(r => r.startAt);
  const deltas = after.slice(1).map((v, i) => +(v - after[i]).toFixed(6));
  ok('after a tempo change every gap is the NEW beat length',
     deltas.length > 0 && deltas.every(d => near(d, BEAT * 2, 1e-6)),
     'deltas=' + [...new Set(deltas)].join(','));
}

/* 8 ── section drilling ticks the section's counts, and wraps inside it ──── */
{
  const { eng, fake } = mk('running');
  eng.setLoop(3, 6);                                         // drill counts 3–6
  eng.play();
  for (let i = 0; i < 80; i++) step(eng, fake, 0.05);        // 4 s ≈ 6.4 counts -> wraps
  ok('a 4-count section keeps ticking past its end (it loops, it does not stop)',
     fake.scheduled.length >= 5, 'ticks=' + fake.scheduled.length);
  const accents = fake.scheduled.filter(r => r.freq[0][1] === 1320).length;
  ok('a mid-dance section is not spuriously accented (counts 3–6 hold no downbeat)',
     accents === 0, 'accents=' + accents);
}

/* 9 ── a muted engine (the detail-screen hero loop) stays silent ─────────── */
{
  const { eng, fake } = mk('running');
  eng.setMute(true); eng.play();
  for (let i = 0; i < 40; i++) step(eng, fake, 0.05);
  ok('a muted engine schedules nothing', fake.scheduled.length === 0, 'scheduled=' + fake.scheduled.length);
}

/* 10 ── destroy() tears down the scheduling timer ────────────────────────── */
{
  const { eng, fake } = mk('running');
  eng.play(); eng.destroy();
  const n = fake.scheduled.length;
  for (let i = 0; i < 20; i++) { fake.advance(0.05); PERF += 50; }
  ok('a destroyed engine schedules nothing further', fake.scheduled.length === n, 'before=' + n + ' after=' + fake.scheduled.length);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
