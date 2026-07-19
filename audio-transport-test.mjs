/* audio-transport-test.mjs — the count track.
   Drives the SHIPPED engine with a fake canvas + fake AudioContext and asserts the
   count track actually makes sound in the Learn flow.

   The regression this pins: ctx.resume() is ASYNC. beep() used to bail whenever
   state !== "running", and stepTo() resumes then beeps on the very next line — so
   every Learn-mode tick landed on a still-suspended context and was silently
   dropped. Watch mode happened to work because it autostarts inside the tap that
   opens the player, giving resume() time to land before the first frame. */
import fs from 'fs';

// ---- fakes ---------------------------------------------------------------
class FakeCtx {
  constructor(state) {
    this.state = state || 'suspended';
    this.currentTime = 0; this.destination = {};
    this.ticks = 0;                       // oscillator starts == audible count ticks
    this.resumeCalls = 0;
    this.blockResume = false;             // simulate iOS refusing to resume
  }
  // Real browsers flip state ASYNCHRONOUSLY — state is still "suspended" on the line
  // after resume() returns. That timing IS the bug, so the fake has to reproduce it.
  resume() {
    this.resumeCalls++;
    if (this.blockResume) return Promise.resolve();
    return Promise.resolve().then(() => { this.state = 'running'; });
  }
  createOscillator() {
    const self = this;
    return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
             connect(n) { return n; }, start() { self.ticks++; }, stop() {} };
  }
  createGain() {
    const g = { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
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
globalThis.requestAnimationFrame = () => 1;   // never auto-runs frame(); we drive explicitly
globalThis.cancelAnimationFrame = () => {};
// node 22 exposes navigator as a getter-only global; engine.js only probes navigator.vibrate

(0, eval)(fs.readFileSync(new URL('./www/js/engine.js', import.meta.url), 'utf8'));
const { create } = globalThis.ScootEngine;

const DANCE = { id: 't', name: 'T', counts: 8, walls: 4, bpm: 96, phrases: [{ order: 1, label: 'Counts 1-8', counts_start: 1, counts_end: 8 }],
  events: [1, 2, 3, 4, 5, 6, 7, 8].map(c => ({ count: c, foot: c % 2 ? 'R' : 'L', action: 'step', to_pos: [c % 2 ? 0.5 : -0.5, 0], weight_change: true })) };

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? ' PASS ' : ' FAIL ') + n + (d ? '  [' + d + ']' : '')); };
const tick = () => new Promise(r => setTimeout(r, 0));

function mk(state) {
  const fake = new FakeCtx(state);
  delete globalThis.__ssAudioCtx;
  globalThis.AudioContext = function () { return fake; };
  const eng = create(canvas, { getSettings: () => ({ countStyle: 'click', haptics: false }), haptic: () => {} });
  eng.load(DANCE);
  return { eng, fake };
}

console.log('\nCOUNT TRACK — Learn-flow audio\n');

// THE regression.
{
  const { eng, fake } = mk('suspended');
  eng.setStepMode(true);
  eng.stepTo(3);
  ok('stepping resumes a suspended context', fake.resumeCalls > 0, 'resumeCalls=' + fake.resumeCalls);
  await tick();
  ok('a Learn-mode step on a SUSPENDED context still makes a sound', fake.ticks === 1, 'ticks=' + fake.ticks);
}

{
  const { eng, fake } = mk('running');
  eng.setStepMode(true);
  eng.stepTo(3);
  ok('a step on a RUNNING context sounds immediately (synchronous)', fake.ticks === 1, 'ticks=' + fake.ticks);
}

{
  const { eng, fake } = mk('suspended');
  eng.setStepMode(true);
  eng.stepNext(); await tick();
  eng.stepNext(); await tick();
  eng.stepPrev(); await tick();
  ok('every Next/Prev through the steps ticks', fake.ticks === 3, 'ticks=' + fake.ticks);
}

{
  const { eng, fake } = mk('suspended');
  fake.blockResume = true;                     // iOS refuses — must degrade quietly, not throw
  eng.setStepMode(true);
  let threw = false;
  try { eng.stepTo(2); } catch (e) { threw = true; }
  await tick();
  ok('a context that refuses to resume degrades silently, no crash', !threw && fake.ticks === 0, 'ticks=' + fake.ticks);
}

{
  const { eng, fake } = mk('running');
  eng.setMute(true);                           // the muted detail-screen hero loop
  eng.setStepMode(true); eng.stepTo(3);
  await tick();
  ok('a muted engine stays silent', fake.ticks === 0, 'ticks=' + fake.ticks);
}

// Watch mode still works: the frame loop ticks once per count while playing.
{
  const { eng, fake } = mk('running');
  eng.play();
  ok('Watch mode: play() leaves step mode and runs', eng.playing && !eng.stepMode);
  ok('Watch mode: audio context is live', fake.state === 'running');
}

{
  const { eng, fake } = mk('suspended');
  eng.play();                                  // play() -> ensureAudio() -> resume
  await tick();
  ok('Watch mode: play() resumes a suspended context', fake.state === 'running');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
