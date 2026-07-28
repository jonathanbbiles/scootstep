/* ============================================================================
   ScootSteps — SECTION MODEL for the Learn/Drill player.
   Pulled out of app.js so it can be unit-tested headlessly (see sections-test.mjs).

   The bug this exists to pin: the drill strip was a single no-wrap flex row with
   the scrollbar hidden. On a 375 px phone a 32-count dance renders four 8-count
   chips plus "Whole dance" = 407 px of content in a 351 px box, so the whole-dance
   option sat 56 px off the right edge with no scroll affordance. The dance could
   only ever be drilled 8 counts at a time. Section chips now WRAP, and the whole
   dance is promoted out of the strip entirely into its own always-visible row.
   ============================================================================ */
(function (global) {
  "use strict";

  var WHOLE = -1;                       // sectionIdx sentinel for "the whole dance"

  // 8-count blocks. A dance whose count isn't a multiple of 8 gets a short last block.
  function sectionsFor(counts) {
    var out = [], n = Math.max(1, Math.ceil(counts / 8));
    for (var i = 0; i < n; i++) {
      var s = i * 8 + 1, e = Math.min(counts, s + 7);
      out.push({ idx: i, start: s, end: e, label: s + "–" + e });
    }
    return out;
  }

  // Counts covered by a selection. WHOLE spans the entire dance.
  function boundsFor(sectionIdx, counts) {
    if (sectionIdx === WHOLE) return { start: 1, end: counts, whole: true };
    var s = sectionIdx * 8 + 1;
    return { start: s, end: Math.min(counts, s + 7), whole: false };
  }

  // The 8 cells under the stage. These used to be relabelled ((start-1+i)%8)+1, which renders
  // "1 2 3 4 5 6 7 8" for EVERY section — so drilling counts 17–24 showed counts 1–8 and the
  // learner had no idea where in the dance they were.
  function ribbonFor(sectionIdx, counts) {
    var b = boundsFor(sectionIdx, counts), out = [];
    for (var i = 0; i < 8; i++) {
      var c = b.start + i;
      out.push({
        count: c <= b.end ? c : null,                       // short final block -> empty cells
        label: c <= b.end ? String(c) : "",
        inSelection: !b.whole && c <= b.end
      });
    }
    if (b.whole) for (var j = 0; j < 8; j++) { out[j].count = j + 1; out[j].label = String(j + 1); }
    return out;
  }

  // Which of the 8 cells should light up for the count currently on screen.
  function activeCell(sectionIdx, counts, count) {
    var b = boundsFor(sectionIdx, counts);
    if (b.whole) return ((count - 1) % 8 + 8) % 8;
    if (count < b.start || count > b.end) return -1;
    return count - b.start;
  }

  function labelFor(sectionIdx, counts) {
    if (sectionIdx === WHOLE) return "whole dance";
    var b = boundsFor(sectionIdx, counts);
    return b.start + "–" + b.end;
  }

  global.SS_Sections = { WHOLE: WHOLE, sectionsFor: sectionsFor, boundsFor: boundsFor,
                         ribbonFor: ribbonFor, activeCell: activeCell, labelFor: labelFor };
  if (typeof module !== "undefined" && module.exports) module.exports = global.SS_Sections;
})(typeof window !== "undefined" ? window : globalThis);
