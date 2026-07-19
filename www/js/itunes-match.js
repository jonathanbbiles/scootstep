/* ============================================================================
   ScootSteps — iTUNES RESULT MATCHING
   Picks the right track out of an iTunes Search response.

   Why this exists: iTunes ranks by its own relevance, so results[0] is regularly
   a karaoke, tribute, instrumental or a-cappella cut. Asking for
   "Friends in Low Places Garth Brooks" with limit=1 returns "Garth Brooks
   Tribute" — a cover act, not Garth Brooks. Taking results[0] blindly is what
   produced wrong previews and wrong song links.

   Split out of app.js so it can be unit-tested headlessly against the live API
   (see itunes-match-test.mjs) — app.js itself needs a DOM.
   ============================================================================ */
(function (global) {
  "use strict";

  function nrm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // cover/karaoke/derivative markers — we want the artist's own recording
  var JUNK = /karaoke|tribute|made popular|originally performed|in the style of|cover version|instrumental|a cappella|acapella|backing track|workout|remix|live at|live from/i;

  // -1 means "not this song at all" — a hard reject, not a low score.
  function scoreTrack(t, title, artist) {
    if (!t || t.kind !== "song") return -1;
    var ta = nrm(t.artistName), tt = nrm(t.trackName), wa = nrm(artist), wt = nrm(title);
    var s = 0;
    if (ta === wa) s += 60;
    else if (ta.indexOf(wa) === 0 || wa.indexOf(ta) === 0) s += 40;
    else if (ta.indexOf(wa) >= 0 || wa.indexOf(ta) >= 0) s += 20;
    else return -1;
    if (tt === wt) s += 60;
    else if (tt.indexOf(wt) === 0) s += 40;
    else if (tt.indexOf(wt) >= 0) s += 20;
    else return -1;
    // "Garth Brooks Tribute" contains "garth brooks", so it passes the artist test above —
    // this is the penalty that actually demotes it below the real recording.
    if (JUNK.test(t.artistName) || JUNK.test(t.trackName) || JUNK.test(t.collectionName || "")) s -= 45;
    if (t.previewUrl) s += 25;      // a playable 30-sec preview is the whole point
    if (t.trackViewUrl) s += 5;     // ...and an exact track URL is what fixes the deep link
    return s;
  }

  // -> { preview, view } | null
  function pick(results, title, artist) {
    var best = null, bestScore = 0;
    (results || []).forEach(function (t) {
      var s = scoreTrack(t, title, artist);
      if (s > bestScore) { bestScore = s; best = t; }
    });
    if (!best) return null;
    return { preview: best.previewUrl || null, view: best.trackViewUrl || best.collectionViewUrl || null };
  }

  global.SS_iTunesMatch = { pick: pick, scoreTrack: scoreTrack, _nrm: nrm };
})(typeof window !== "undefined" ? window : globalThis);
