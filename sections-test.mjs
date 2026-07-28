/* sections-test.mjs — the Learn/Drill section model.

   The reported symptom was "in Start Learning it only plays a chunk, I can only select 8 counts".
   Two separate defects produced it:

   1. "Whole dance" was the LAST chip in a no-wrap flex strip with the scrollbar hidden. Measured
      in the shipped layout at 375 px: the strip is 351 px wide and its content is 407 px, so the
      whole-dance option sat 56 px off the right edge with nothing to hint it was there. It is now
      its own always-visible row, and the section chips wrap.

   2. The 8 ribbon cells were relabelled ((start-1+i)%8)+1, which prints "1..8" for EVERY section.
      Drilling counts 17–24 looked exactly like drilling 1–8.
*/
import fs from 'fs';

globalThis.window = globalThis;
(0, eval)(fs.readFileSync(new URL('./www/js/sections.js', import.meta.url), 'utf8'));
const S = globalThis.SS_Sections;

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? ' PASS ' : ' FAIL ') + n + (d ? '  [' + d + ']' : '')); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nLEARN MODE — section model\n');

/* ── the 8-count blocks ─────────────────────────────────────────────────── */
{
  const s = S.sectionsFor(32);
  ok('a 32-count dance splits into four 8-count sections',
     s.length === 4 && eq(s.map(x => x.label), ['1–8', '9–16', '17–24', '25–32']), s.map(x => x.label).join(' '));
}
{
  const s = S.sectionsFor(40);
  ok('a 40-count dance gives five sections', s.length === 5 && s[4].label === '33–40', s.map(x => x.label).join(' '));
}
{
  const s = S.sectionsFor(20);                  // not a multiple of 8
  ok('an off-length dance gets a short final block, not a block past the end',
     s.length === 3 && s[2].start === 17 && s[2].end === 20, s.map(x => x.label).join(' '));
}
{
  const s = S.sectionsFor(4);                   // a glossary mini-dance
  ok('a dance shorter than 8 counts still yields exactly one section',
     s.length === 1 && s[0].start === 1 && s[0].end === 4, s.map(x => x.label).join(' '));
}

/* ── the whole dance is a first-class selection, not a chip at the end ───── */
{
  const b = S.boundsFor(S.WHOLE, 32);
  ok('WHOLE spans every count in the dance', b.start === 1 && b.end === 32 && b.whole === true, JSON.stringify(b));
  ok('WHOLE is a distinct sentinel, never a valid section index', S.WHOLE === -1 && S.sectionsFor(32).every(s => s.idx !== S.WHOLE));
  ok('WHOLE labels as the whole dance, not a count range', S.labelFor(S.WHOLE, 32) === 'whole dance', S.labelFor(S.WHOLE, 32));
}
{
  ok('a section labels as its real count range (the play button says what it will play)',
     S.labelFor(2, 32) === '17–24', S.labelFor(2, 32));
}

/* ── THE ribbon regression ──────────────────────────────────────────────── */
{
  const r = S.ribbonFor(0, 32).map(c => c.label);
  ok('section 1–8 shows counts 1..8', eq(r, ['1', '2', '3', '4', '5', '6', '7', '8']), r.join(','));
}
{
  const r = S.ribbonFor(2, 32).map(c => c.label);
  ok('section 17–24 shows counts 17..24 — NOT 1..8 all over again',
     eq(r, ['17', '18', '19', '20', '21', '22', '23', '24']), r.join(','));
}
{
  const r = S.ribbonFor(3, 32).map(c => c.label);
  ok('section 25–32 shows counts 25..32', eq(r, ['25', '26', '27', '28', '29', '30', '31', '32']), r.join(','));
}
{
  const r = S.ribbonFor(2, 20);                 // short final block: 17–20
  ok('a short final block leaves the unused cells blank rather than inventing counts',
     r.slice(0, 4).map(c => c.label).join(',') === '17,18,19,20' && r.slice(4).every(c => c.count === null),
     r.map(c => c.label || '·').join(','));
}
{
  const r = S.ribbonFor(S.WHOLE, 32);
  ok('the whole dance shows a rolling 1..8 and highlights nothing as "the section"',
     r.map(c => c.label).join(',') === '1,2,3,4,5,6,7,8' && r.every(c => !c.inSelection));
}
{
  const r = S.ribbonFor(1, 32);
  ok('a drilled section marks its cells as in-selection', r.every(c => c.inSelection === true));
}

/* ── which cell lights up ───────────────────────────────────────────────── */
{
  ok('count 17 lights the FIRST cell while drilling 17–24', S.activeCell(2, 32, 17) === 0);
  ok('count 24 lights the LAST cell while drilling 17–24', S.activeCell(2, 32, 24) === 7);
  ok('a count outside the drilled section lights nothing', S.activeCell(2, 32, 9) === -1);
  ok('on the whole dance, count 9 rolls back round to the first cell', S.activeCell(S.WHOLE, 32, 9) === 0);
  ok('on the whole dance, count 32 lights the last cell', S.activeCell(S.WHOLE, 32, 32) === 7);
}

/* ── the layout failure itself, as arithmetic ───────────────────────────── */
{
  // Measured from the shipped stylesheet at 375 px: chip widths for a 32-count dance came to
  // 407 px of content in a 351 px strip. Four sections + a whole-dance chip cannot fit one row.
  const n = S.sectionsFor(32).length;
  ok('four sections plus a whole-dance chip never fit one 351 px row — hence the separate row',
     n === 4 && (n * 78 + 115) > 351, n + ' chips');
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
