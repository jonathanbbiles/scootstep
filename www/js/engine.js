/* ============================================================================
   ScootSteps — STEP ENGINE
   One JSON document (Dance / Phrase / StepEvent, brief §8) -> a smooth top-down
   two-boot animation, driven by a single audio clock so visuals never drift.
   Reused by: Dance Detail hero, Player (Watch/Dance), Player (Learn/Drill),
   Glossary mini-dances.  Pure client-side, offline, no external assets.
   ============================================================================ */
(function (global) {
  "use strict";

  // ---- easing (per-action, brief §9: "a stomp eases differently than a glide") ----
  const E = {
    inout: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    linear: t => t
  };
  // action -> easing + motion character
  const ACTION = {
    step:    { ease: "inout",  lift: 0 },
    side:    { ease: "inout",  lift: 0 },
    cross:   { ease: "inout",  lift: 0 },
    walk:    { ease: "inout",  lift: 0 },
    together:{ ease: "inout",  lift: 0 },
    strut:   { ease: "inout",  lift: 0 },
    rock:    { ease: "inout",  lift: 0 },
    touch:   { ease: "outCubic", lift: 0 },
    tap:     { ease: "outCubic", lift: 0 },
    scuff:   { ease: "outCubic", lift: 0 },
    brush:   { ease: "outCubic", lift: 0 },
    kick:    { ease: "outBack", lift: 0.10 },
    hitch:   { ease: "inout",  lift: 0.16 },
    stomp:   { ease: "outBack", lift: 0.05 },
    hold:    { ease: "linear", lift: 0 },
    clap:    { ease: "linear", lift: 0 }
  };
  const actionOf = a => ACTION[a] || ACTION.step;

  const NEUTRAL = { L: [-0.5, 0], R: [0.5, 0] };
  const WALL_LABELS = ["Front wall", "Right wall", "Back wall", "Left wall"];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Build per-foot keyframe timelines + facing timeline from a Dance's events.
  function buildTimeline(dance) {
    const startF = dance.start_facing || 0;
    const kf = {
      L: [{ beat: -1, pos: NEUTRAL.L.slice(), weight: true, action: "step" }],
      R: [{ beat: -1, pos: NEUTRAL.R.slice(), weight: true, action: "step" }]
    };
    const facing = [{ beat: -1, deg: startF }];
    let cur = startF;
    const perCount = {};
    (dance.events || []).forEach(ev => {
      const b = (ev.count - 1);
      const feet = ev.foot === "both" ? ["L", "R"] : [ev.foot];
      feet.forEach(f => {
        // "both" with a single to_pos: mirror x for the two feet so a jump reads naturally
        let pos = ev.to_pos.slice();
        if (ev.foot === "both") pos = f === "L" ? [-Math.abs(pos[0]) || pos[0], pos[1]] : [Math.abs(pos[0]), pos[1]];
        kf[f].push({ beat: b, pos, weight: ev.weight_change !== false, action: ev.action || "step" });
      });
      if (ev.facing_delta) { cur += ev.facing_delta; facing.push({ beat: b, deg: cur }); }
      perCount[ev.count] = ev;
    });
    // phrase lookup by count
    const phraseOf = {};
    (dance.phrases || []).forEach(p => { for (let c = p.counts_start; c <= p.counts_end; c++) phraseOf[c] = p; });
    return { kf, facing, perCount, phraseOf, endFacing: cur, counts: dance.counts };
  }

  // Foot state at continuous beat B (position + weight + a 0..1 lift for hops).
  function footAt(TL, foot, B) {
    const arr = TL.kf[foot];
    let i = 0;
    for (let k = 0; k < arr.length; k++) { if (arr[k].beat <= B) i = k; else break; }
    const cur = arr[i], nxt = arr[i + 1];
    if (!nxt) return { pos: cur.pos, weight: cur.weight, lift: 0, moving: false };
    const approachStart = Math.max(nxt.beat - 1, cur.beat);          // handles "&" counts / quick successive events
    if (B <= approachStart) return { pos: cur.pos, weight: cur.weight, lift: 0, moving: false };
    const span = nxt.beat - approachStart;
    const raw = (B - approachStart) / span;
    const spec = actionOf(nxt.action);
    const t = clamp(E[spec.ease](clamp(raw, 0, 1)), -0.5, 1.5);
    const lift = spec.lift ? Math.sin(clamp(raw, 0, 1) * Math.PI) * spec.lift : 0;
    return {
      pos: [cur.pos[0] + (nxt.pos[0] - cur.pos[0]) * t, cur.pos[1] + (nxt.pos[1] - cur.pos[1]) * t],
      weight: raw < 0.5 ? cur.weight : nxt.weight,
      lift, moving: true, action: nxt.action
    };
  }
  function facingAt(TL, B) {
    const arr = TL.facing;
    let i = 0;
    for (let k = 0; k < arr.length; k++) { if (arr[k].beat <= B) i = k; else break; }
    const cur = arr[i], nxt = arr[i + 1];
    if (!nxt) return cur.deg;
    const approachStart = Math.max(nxt.beat - 1, cur.beat);
    if (B <= approachStart) return cur.deg;
    const t = E.inout(clamp((B - approachStart) / (nxt.beat - approachStart), 0, 1));
    return cur.deg + (nxt.deg - cur.deg) * t;
  }

  // ============================ engine instance ============================
  function create(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const colors = Object.assign({ left: "#2BB3A3", right: "#E4574F", floor1: "#4a3422", floor2: "#2f2115", ink: "#0d1826", cream: "#FAF5EC" }, opts.colors);
    let DPR = 1, CW = 0, CH = 0;

    const st = {
      dance: null, TL: null, bpm: 96,
      playing: false, stepMode: false, mirror: false, cues: true, stopAfter: 0, ghost: true,
      tempoPct: 100, muteCounts: false, lapFired: false,
      startPerf: 0, startBeat: 0, lastClickCount: -1,
      loop: null,                 // {start, end} in counts (1-based inclusive), null = whole dance
      stepBeat: 0, stepFrom: 0, stepTo: 0, stepAnimStart: 0, stepAnimating: false,
      trails: { L: [], R: [] }, rotationsDone: 0, lastCount: -1
    };

    // ONE shared AudioContext for the whole app; the VISUAL transport runs on performance.now()
    // so the animation never freezes even if iOS keeps the audio context suspended.
    let audio = null;
    const perfNow = () => (global.performance && global.performance.now) ? global.performance.now() : Date.now();
    function ensureAudio() {
      if (!global.__ssAudioCtx) { try { global.__ssAudioCtx = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) {} }
      audio = global.__ssAudioCtx || null;
      if (audio && audio.state === "suspended") { try { audio.resume(); } catch (e) {} }   // must be inside a user gesture on iOS
      return audio;
    }
    // clean metronome tick — a soft sine with a quick pitch drop, enveloped from silence (no harsh
    // square-wave "clicks").
    //
    // ctx.resume() is ASYNC. The old code bailed whenever state !== "running", so the FIRST tick
    // after any suspension (every Learn-mode step, since stepTo() resumes and beeps on the next
    // line) was silently dropped — that's why learning the dance had no count track. Now a
    // suspended context is resumed and the tick fires on the other side, as long as it's still
    // timely (a stale tick arriving late would sound worse than none).
    function beep(accent) {
      if (st.muteCounts) return;
      const a = audio || ensureAudio();
      if (!a) return;
      if (a.state === "running") return fire(a, accent);
      const asked = perfNow();
      try {
        const p = a.resume();
        if (p && p.then) p.then(function () { if (a.state === "running" && perfNow() - asked < 250) fire(a, accent); }, function () {});
        else if (a.state === "running") fire(a, accent);
      } catch (e) {}
    }
    function fire(audio, accent) {
      const style = (opts.getSettings && opts.getSettings().countStyle) || "click";
      const t = audio.currentTime + 0.0005;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = style === "woodblock" ? "triangle" : "sine";
      o.frequency.setValueAtTime(accent ? 1400 : 950, t);
      o.frequency.exponentialRampToValueAtTime(accent ? 900 : 620, t + 0.045);
      const vol = accent ? 0.22 : 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (accent ? 0.12 : 0.07));
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.16);
    }
    function haptic(accent) {
      const s = opts.getSettings && opts.getSettings();
      if (s && s.haptics === false) return;
      if (opts.haptic) { opts.haptic(accent); return; }
      if (global.navigator && navigator.vibrate) { try { navigator.vibrate(accent ? 28 : 11); } catch (e) {} }
    }

    // loop window in beats [lo, hi)
    function loopSpan() {
      if (st.loop) return { lo: st.loop.start - 1, hi: st.loop.end };     // count s..e -> beats (s-1)..e
      return { lo: 0, hi: st.TL.counts };
    }
    function wrapBeat(B) { const { lo, hi } = loopSpan(); const span = hi - lo; return lo + (((B - lo) % span) + span) % span; }

    function bpmEff() { return st.bpm * st.tempoPct / 100; }
    function beatDurMs() { return 60000 / bpmEff(); }
    function currentBeat() { return st.startBeat + (perfNow() - st.startPerf) / beatDurMs(); }

    // ---------- transport ----------
    function play() {
      if (!st.TL) return;
      ensureAudio();                       // resume the shared context — call runs inside the tap gesture (iOS)
      if (st.stepMode) setStepMode(false);
      st.playing = true; st.lapFired = false;
      st.startBeat = wrapBeat(st.startBeat); st.startPerf = perfNow(); st.lastClickCount = -1;
      emit("play");
    }
    function pause() { if (!st.playing) return; st.startBeat = currentBeat(); st.playing = false; emit("pause"); }
    function toggle() { st.playing ? pause() : play(); }
    function restart() { const { lo } = loopSpan(); st.startBeat = lo; st.startPerf = perfNow(); st.lapFired = false; st.lastClickCount = -1; if (st.stepMode) stepTo(lo + 1); }
    function setTempo(pct) {
      pct = clamp(pct, 40, 120);
      const now = st.playing ? currentBeat() : st.startBeat;
      st.tempoPct = pct; st.startBeat = now; st.startPerf = perfNow();
      emit("tempo", pct);
    }
    function setMirror(m) { st.mirror = !!m; emit("mirror", st.mirror); }
    function setCues(v) { st.cues = !!v; }
    function setGhost(v) { st.ghost = !!v; }
    function setMute(v) { st.muteCounts = !!v; }
    function setStopAfter(reps) { st.stopAfter = reps | 0; }                          // 0 = loop forever
    function setFullRotation(v) { st.stopAfter = v ? ((st.dance && st.dance.walls) || 1) : 0; }
    function setLoop(startCount, endCount) {
      st.loop = (startCount && endCount) ? { start: startCount, end: endCount } : null;
      st.startBeat = wrapBeat(st.startBeat);
      if (st.playing) { st.startPerf = perfNow(); st.lastClickCount = -1; }
      emit("loop", st.loop);
    }

    // ---------- step mode ----------
    function setStepMode(on) {
      st.stepMode = !!on;
      if (on) { if (st.playing) pause(); st.stepBeat = Math.round(wrapBeat(st.startBeat)); st.stepAnimating = false; }
      emit("stepmode", st.stepMode);
    }
    function stepTo(count) {
      ensureAudio();
      const { lo, hi } = loopSpan();
      let b = ((count - 1) - lo); const span = hi - lo; b = lo + ((b % span) + span) % span;
      st.stepFrom = st.stepBeat; st.stepTo = b; st.stepBeat = b; st.startBeat = b;
      st.stepAnimStart = perfNow(); st.stepAnimating = true;
      if (!st.muteCounts) { const accent = (Math.round(b) % 8) === 0; beep(accent); haptic(accent); }   // ensureAudio() already ran above (tap gesture)
      emit("step", Math.round(b) + 1);
    }
    function stepNext() { setStepMode(true); stepTo(Math.round(st.stepBeat) + 2); }
    function stepPrev() { setStepMode(true); stepTo(Math.round(st.stepBeat)); }

    // ---------- render ----------
    function resize() {
      const r = canvas.getBoundingClientRect();
      DPR = Math.min(global.devicePixelRatio || 1, 2.5);
      CW = r.width; CH = r.height;
      canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    const SCALE = 0.30;
    function scale() { return Math.min(CW, CH) * SCALE; }
    function world(local, facingRad, mirror) {
      let lx = local[0] * (mirror ? -1 : 1), ly = local[1];
      const c = Math.cos(facingRad), s = Math.sin(facingRad);
      const rx = lx * c + ly * s, ry = lx * s - ly * c, k = scale();
      return { x: CW / 2 + rx * k, y: CH / 2 + ry * k };
    }
    function rr(x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); }
    function drawFloor() {
      ctx.clearRect(0, 0, CW, CH);
      const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, colors.floor1); g.addColorStop(1, colors.floor2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      ctx.save(); ctx.globalAlpha = .15; ctx.strokeStyle = "#1c130a"; ctx.lineWidth = 1;
      const plank = CH / 9; for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, i * plank); ctx.lineTo(CW, i * plank); ctx.stroke(); } ctx.restore();
      ctx.save(); ctx.globalAlpha = .09; ctx.strokeStyle = colors.cream; ctx.setLineDash([4, 7]); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(CW / 2, CH * .12); ctx.lineTo(CW / 2, CH * .88); ctx.stroke(); ctx.restore();
    }
    function drawTrail(foot, facingRad) {
      const pts = st.trails[foot]; if (pts.length < 2) return;
      const col = foot === "L" ? colors.left : colors.right;
      for (let i = 0; i < pts.length; i++) {
        const a = (i / pts.length) * 0.22; if (a < 0.02) continue;
        ctx.globalAlpha = a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, scale() * 0.06, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function drawBoot(local, foot, weight, lift, facingRad, mirror) {
      const p = world(local, facingRad, mirror), k = scale();
      const L = k * 0.62, W = k * 0.30, col = foot === "L" ? colors.left : colors.right, ang = facingRad;
      const liftScale = 1 + lift * 0.9;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(liftScale, liftScale);
      if (weight) { ctx.shadowColor = col; ctx.shadowBlur = 15; }
      ctx.beginPath(); rr(-W / 2, -L / 2, W, L * 0.82, W * 0.42);
      ctx.moveTo(W / 2, -L / 2 + L * 0.2); ctx.quadraticCurveTo(W * 0.62, -L / 2 - L * 0.12, 0, -L / 2 - L * 0.1);
      ctx.quadraticCurveTo(-W * 0.62, -L / 2 - L * 0.12, -W / 2, -L / 2 + L * 0.2); ctx.closePath();
      if (weight) { ctx.fillStyle = col; ctx.fill(); } else { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.strokeStyle = weight ? "rgba(0,0,0,.28)" : col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-W / 2 + 2, L * 0.1); ctx.lineTo(W / 2 - 2, L * 0.1); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.fillStyle = weight ? colors.ink : col; ctx.font = "900 " + Math.round(k * 0.16) + "px -apple-system,system-ui,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(foot, p.x, p.y); ctx.restore();
    }
    function drawGhostArrow(B, facingRad) {
      // preview the NEXT acting foot's upcoming move (brief §6.1 "hold to see upcoming path as a ghost arrow")
      const nextCount = Math.round(B) + 2; const ev = st.TL.perCount[nextCount]; if (!ev) return;
      const foot = ev.foot === "both" ? "R" : ev.foot;
      const from = footAt(st.TL, foot, B).pos, to = ev.to_pos;
      const a = world(from, facingRad, st.mirror), b = world(to, facingRad, st.mirror);
      const col = foot === "L" ? colors.left : colors.right;
      ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.setLineDash([6, 5]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.translate(b.x, b.y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, -5); ctx.lineTo(-11, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    function renderBeat() {
      if (st.stepMode) {
        if (st.stepAnimating) {
          const dt = ((global.performance || Date).now() - st.stepAnimStart) / 360;
          if (dt >= 1) { st.stepAnimating = false; return st.stepTo; }
          return st.stepFrom + (st.stepTo - st.stepFrom) * E.inout(dt);
        }
        return st.stepBeat;
      }
      if (st.playing) return currentBeat();
      return st.startBeat;
    }
    let raf = 0, lastT = 0, frames = 0, fps = 0, fpsT = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (!st.TL) { drawFloor(); return; }
      const now = (global.performance || Date).now();
      frames++; if (now - fpsT >= 500) { fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; if (opts.onFps) opts.onFps(fps); }

      let B = renderBeat();
      // stop after N reps when requested (All-walls = walls, play-once = 1); 0 = loop forever
      const { lo, hi } = loopSpan(), span = hi - lo;
      if (st.playing && !st.stepMode && st.stopAfter > 0) {
        const reps = Math.floor((B - lo) / span);
        if (reps >= st.stopAfter) { st.startBeat = lo; pause(); B = lo; if (opts.onComplete) opts.onComplete(); }
      }
      const Bw = wrapBeat(B);
      const facingRad = facingAt(st.TL, Bw) * Math.PI / 180 * (st.mirror ? -1 : 1);

      drawFloor();
      const l = footAt(st.TL, "L", Bw), r = footAt(st.TL, "R", Bw);
      // trails
      if (st.playing && !st.stepMode) {
        ["L", "R"].forEach(f => { const d = f === "L" ? l : r; const w = world(d.pos, facingRad, st.mirror); st.trails[f].push(w); if (st.trails[f].length > 10) st.trails[f].shift(); });
      } else { st.trails.L.length = 0; st.trails.R.length = 0; }
      drawTrail("L", facingRad); drawTrail("R", facingRad);
      if (st.stepMode && st.ghost && !st.stepAnimating) drawGhostArrow(Bw, facingRad);
      const order = l.weight ? [["R", r], ["L", l]] : [["L", l], ["R", r]];
      order.forEach(([f, d]) => drawBoot(d.pos, f, d.weight, d.lift, facingRad, st.mirror));

      // HUD callbacks
      const count = (Math.floor(Bw) % st.TL.counts) + 1;
      if (count !== st.lastCount) {
        const prev = st.lastCount;
        st.lastCount = count;
        // one full lap through the dance (whole-dance loop, playing) -> a "completed dance" moment
        if (st.playing && !st.stepMode && !st.loop && prev >= st.TL.counts - 1 && count <= 2 && !st.lapFired) {
          st.lapFired = true; if (opts.onLap) opts.onLap();
        }
        if (opts.onCount) opts.onCount(count, st.TL.phraseOf[count] || null, st.TL.perCount[count] || null);
        const wall = ((Math.round(facingAt(st.TL, Bw) / 90) % 4) + 4) % 4;
        if (opts.onWall) opts.onWall(wall, WALL_LABELS[wall]);
      }
      // metronome tick — locked to the on-screen count, only while genuinely playing (and not a muted hero loop)
      if (st.playing && !st.stepMode && !st.muteCounts && count !== st.lastClickCount) {
        st.lastClickCount = count;
        const accent = ((count - 1) % 8) === 0; beep(accent); haptic(accent);
      }
      if (opts.onCue && st.cues) {
        const ev = st.TL.perCount[count];
        if (ev && ev.styling_note && (Bw % 1) < 0.4) opts.onCue(ev.styling_note, true);
        else if ((Bw % 1) > 0.6) opts.onCue(null, false);
      }
    }

    function emit(type, val) { if (opts.on) opts.on(type, val); }
    function load(dance) {
      st.dance = dance; st.bpm = dance.bpm || 96; st.TL = buildTimeline(dance);
      st.startBeat = 0; st.startPerf = perfNow(); st.stepBeat = 0; st.lastCount = -1; st.lastClickCount = -1;
      st.loop = null; st.stopAfter = 0; st.playing = false; st.stepMode = false;
      st.trails.L.length = 0; st.trails.R.length = 0;
      return api;
    }

    resize(); global.addEventListener("resize", resize);
    fpsT = (global.performance || Date).now(); raf = requestAnimationFrame(frame);

    const api = {
      load, play, pause, toggle, restart, setTempo, setMirror, setCues, setGhost, setMute, setFullRotation, setStopAfter, setLoop,
      setStepMode, stepTo, stepNext, stepPrev, resize, ensureAudio,
      get playing() { return st.playing; }, get stepMode() { return st.stepMode; },
      get mirror() { return st.mirror; }, get tempoPct() { return st.tempoPct; }, get loop() { return st.loop; },
      get dance() { return st.dance; }, get fps() { return fps; },
      destroy() { cancelAnimationFrame(raf); global.removeEventListener("resize", resize); st.playing = false; }
    };
    return api;
  }

  global.ScootEngine = { create, buildTimeline, footAt, facingAt, ACTION, WALL_LABELS };
})(typeof window !== "undefined" ? window : globalThis);
