import fs from 'fs';
const code = fs.readFileSync(new URL('./www/js/engine.js', import.meta.url), 'utf8');
(0, eval)(code);                       // runs IIFE -> sets globalThis.ScootEngine
const { buildTimeline, footAt, facingAt } = globalThis.ScootEngine;

const D = {
  id: "t", name: "Test", counts: 8, walls: 4, bpm: 96, start_facing: 0,
  phrases: [{ order: 1, label: "Counts 1-8: mixed", counts_start: 1, counts_end: 8 }],
  events: [
    { count: 1, foot: "R", action: "step", to_pos: [1.0, 0], weight_change: true },
    { count: 2, foot: "L", action: "touch", to_pos: [0.4, 0], weight_change: false },
    { count: 2.5, foot: "L", action: "step", to_pos: [-0.5, 0], weight_change: true },   // "&" count
    { count: 3, foot: "R", action: "stomp", to_pos: [0.5, 0], weight_change: true },
    { count: 5, foot: "L", action: "step", to_pos: [-0.5, 0.4], weight_change: true, facing_delta: -90 },
    { count: 8, foot: "both", action: "step", to_pos: [0.5, 0], weight_change: true }
  ]
};
const TL = buildTimeline(D);
let pass = 0, fail = 0; const log = [];
const ok = (n, c, d) => { (c ? pass++ : fail++); log.push((c ? " PASS " : " FAIL ") + n + (d ? "  [" + d + "]" : "")); };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;

ok("counts=8", TL.counts === 8);
ok("phrase label mapped to count 1", TL.phraseOf[1] && TL.phraseOf[1].label.includes("mixed"));
ok("perCount has count 1", !!TL.perCount[1]);
ok("R at count1 = [1,0] weight", near(footAt(TL, "R", 0).pos[0], 1) && footAt(TL, "R", 0).weight === true);
ok("count2 L touch = no weight", footAt(TL, "L", 1).weight === false, "w=" + footAt(TL, "L", 1).weight);
ok("& count 2.5: L keyframe lands at beat1.5", near(footAt(TL, "L", 1.5).pos[0], -0.5), JSON.stringify(footAt(TL, "L", 1.5).pos));
ok("& count approach starts at beat1 not 0.5 (no pre-overlap)", footAt(TL, "L", 1.05).pos[0] > 0.3, "x@1.05=" + footAt(TL, "L", 1.05).pos[0].toFixed(3));
ok("stomp uses outBack easing (overshoot mid)", (() => { const x = footAt(TL, "R", 2.9).pos[0]; return x < 0.7; })(), "R@2.9=" + footAt(TL, "R", 2.9).pos[0].toFixed(3));
ok("facing -90 by count5 (beat4)", near(facingAt(TL, 4), -90, 0.001), facingAt(TL, 4).toFixed(1));
ok("'both' event gives BOTH feet a keyframe at count8", TL.kf.L.some(k => k.beat === 7) && TL.kf.R.some(k => k.beat === 7));
let nan = false; for (let B = 0; B < 8; B += 0.05) { const l = footAt(TL, "L", B).pos, r = footAt(TL, "R", B).pos, f = facingAt(TL, B); if ([l[0], l[1], r[0], r[1], f].some(v => !Number.isFinite(v))) nan = true; }
ok("no NaN across sweep", !nan);
let maxAbs = 0; for (let B = 0; B < 8; B += 0.05)["L", "R"].forEach(F => { const p = footAt(TL, F, B).pos; maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1])); });
ok("feet within grid -2..2", maxAbs < 2.0, "max=" + maxAbs.toFixed(2));

console.log("\nSTEP ENGINE §8-schema validation\n" + log.join("\n") + "\n\n  " + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
