import fs from 'fs';
const load = f => (0, eval)(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
load('./www/js/engine.js'); load('./www/js/data.dances.js');
const { buildTimeline, footAt, facingAt, ACTION } = globalThis.ScootEngine;
const D = globalThis.SS_DANCES;

const ACTIONS = new Set(Object.keys(ACTION));
let problems = 0; const rows = [];
function check(dance) {
  const iss = [];
  const maxCount = Math.max(...dance.events.map(e => e.count));
  if (maxCount > dance.counts + 0.001) iss.push(`event count ${maxCount} > counts ${dance.counts}`);
  // events valid
  dance.events.forEach(e => {
    if (!["L", "R", "both"].includes(e.foot)) iss.push(`bad foot ${e.foot}@${e.count}`);
    if (!ACTIONS.has(e.action)) iss.push(`unknown action ${e.action}@${e.count}`);
    if (Math.abs(e.to_pos[0]) > 2 || Math.abs(e.to_pos[1]) > 2) iss.push(`off-grid ${JSON.stringify(e.to_pos)}@${e.count}`);
    if (typeof e.weight_change !== 'boolean') iss.push(`weight_change not bool @${e.count}`);
  });
  // phrases cover 1..counts
  const covered = new Set();
  (dance.phrases || []).forEach(p => { for (let c = p.counts_start; c <= p.counts_end; c++) covered.add(c); });
  for (let c = 1; c <= dance.counts; c++) if (!covered.has(c)) { iss.push(`phrase gap @count ${c}`); break; }
  // songs + credit + deep links
  if (!dance.choreographer_credit) iss.push('missing choreographer_credit');
  (dance.songs || []).forEach(s => { if (!s.apple || !s.spotify) iss.push('song missing deep link'); });
  // render sweep: NaN + bounds
  const TL = buildTimeline(dance);
  let nan = false, maxAbs = 0;
  for (let B = 0; B < dance.counts; B += 0.04) {
    for (const F of ['L', 'R']) { const p = footAt(TL, F, B).pos; if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) nan = true; maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1])); }
    if (!Number.isFinite(facingAt(TL, B))) nan = true;
  }
  if (nan) iss.push('NaN in sweep');
  if (maxAbs > 2.01) iss.push(`feet exceed grid (${maxAbs.toFixed(2)})`);
  // wall closure
  const totalFacing = TL.endFacing - (dance.start_facing || 0);
  const closes = ((dance.walls * totalFacing) % 360 === 0);
  if (!closes) iss.push(`walls don't close: ${dance.walls}w * ${totalFacing}° not multiple of 360`);
  if (dance.walls > 1 && totalFacing === 0) iss.push(`${dance.walls}-wall but no net turn`);
  rows.push({ name: dance.name, cnt: dance.counts, walls: dance.walls, turn: totalFacing, maxFoot: maxAbs.toFixed(2), free: dance.free, famous: dance.famous, ok: iss.length === 0, iss });
  if (iss.length) problems += iss.length;
}
D.forEach(check);

console.log("\nCATALOG VALIDATION — " + D.length + " dances\n");
rows.forEach(r => {
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(24)} ${r.cnt}ct ${r.walls}w turn=${String(r.turn).padStart(5)}° foot≤${r.maxFoot} ${r.free ? 'FREE' : 'pro '}${r.famous ? ' famous' : ''}`);
  if (r.iss.length) r.iss.forEach(i => console.log("        - " + i));
});
const freeCount = D.filter(d => d.free).length, freeFamous = D.filter(d => d.free && d.famous).length;
console.log(`\n  free dances: ${freeCount} (target 5) | free+famous: ${freeFamous} (target >=2)`);
console.log(`  total events: ${D.reduce((a, d) => a + d.events.length, 0)}`);
console.log(`\n  ${problems === 0 && freeCount === 5 && freeFamous >= 2 ? 'ALL GOOD ✓' : problems + ' problems'}\n`);
process.exit(problems === 0 && freeCount === 5 && freeFamous >= 2 ? 0 : 1);
