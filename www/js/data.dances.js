/* ============================================================================
   ScootSteps — DANCE CATALOG  (brief §8 schema; adding a dance is a data task)
   10 real, fully-playable dances for build 1 (Milestone-1 alpha).
   • Songs referenced as facts + deep links only — never streamed/bundled.
   • Choreographers credited; step patterns are not copyrightable (brief §3).
   • Grid is -2..2 (neutral L[-0.5,0] R[0.5,0]); one JSON drives every mode.
   FREE tier = 5 dances incl 2 famous (Cupid Shuffle, The Wobble) — the
   panic-moment user must succeed free (brief §6.5). `free:true` marks them.
   ============================================================================ */
(function (global) {
  "use strict";
  // authoring DSL -> schema-valid StepEvent
  function ev(count, foot, action, x, y, o) {
    o = o || {};
    const e = { count, foot, action, to_pos: [x, y], weight_change: o.w !== false };
    if (o.turn) e.facing_delta = o.turn;
    if (o.cue) e.styling_note = o.cue;
    if (o.from) e.from_pos = o.from;
    return e;
  }
  const ph = (order, label, s, e) => ({ order, label, counts_start: s, counts_end: e });
  const song = (title, artist) => ({
    title, artist,
    apple: "https://music.apple.com/us/search?term=" + encodeURIComponent(title + " " + artist),
    spotify: "https://open.spotify.com/search/" + encodeURIComponent(title + " " + artist)
  });

  const DANCES = [];

  /* 1 ── CUPID SHUFFLE ── free, famous ─────────────────────────────────────── */
  DANCES.push({
    id: "cupid-shuffle", name: "Cupid Shuffle", aka: ["Cupid"], counts: 32, walls: 4,
    difficulty: 1, tags: ["famous", "wedding", "bar classic", "party", "low impact"],
    free: true, famous: true, intro_counts: 0, version: 1,
    choreographer_credit: "Popularized by Cupid (2007); steps traditional/widely taught",
    songs: [song("Cupid Shuffle", "Cupid")],
    phrases: [
      ph(1, "Counts 1–8: Slide right", 1, 8),
      ph(2, "Counts 9–16: Slide left", 9, 16),
      ph(3, "Counts 17–24: Heel touches, four times", 17, 24),
      ph(4, "Counts 25–32: Walk it, ¼ turn left", 25, 32)
    ],
    events: [
      ev(1, "R", "side", 1.0, 0), ev(2, "L", "together", 0.45, 0),
      ev(3, "R", "side", 1.4, 0), ev(4, "L", "together", 0.9, 0),
      ev(5, "R", "side", 1.4, 0), ev(6, "L", "together", 0.9, 0),
      ev(7, "R", "side", 1.4, 0), ev(8, "L", "touch", 0.9, 0, { w: false, cue: "Clap!" }),
      ev(9, "L", "side", -1.0, 0), ev(10, "R", "together", -0.45, 0),
      ev(11, "L", "side", -1.4, 0), ev(12, "R", "together", -0.9, 0),
      ev(13, "L", "side", -1.4, 0), ev(14, "R", "together", -0.9, 0),
      ev(15, "L", "side", -1.4, 0), ev(16, "R", "touch", -0.9, 0, { w: false, cue: "Clap!" }),
      // Step sheets are unanimous: these are HEEL TOUCHES forward, not kicks. (The song's "now kick"
      // lyric is what makes everyone call them kicks.) Touch the heel out, step it back beside.
      ev(17, "R", "touch", 0.5, 0.7, { w: false, cue: "Heel!" }), ev(18, "R", "together", 0.5, 0),
      ev(19, "L", "touch", -0.5, 0.7, { w: false, cue: "Heel!" }), ev(20, "L", "together", -0.5, 0),
      ev(21, "R", "touch", 0.5, 0.7, { w: false, cue: "Heel!" }), ev(22, "R", "together", 0.5, 0),
      ev(23, "L", "touch", -0.5, 0.7, { w: false, cue: "Heel!" }), ev(24, "L", "together", -0.5, 0, { cue: "Here we go!" }),
      ev(25, "R", "walk", 0.5, 0.6), ev(26, "L", "walk", -0.5, 0.6),
      ev(27, "R", "walk", 0.5, 1.1), ev(28, "L", "touch", 0.0, 1.1, { w: false }),
      ev(29, "L", "step", -0.5, 0.5, { turn: -90, cue: "New wall!" }), ev(30, "R", "together", 0.5, 0.5),
      ev(31, "L", "step", -0.5, 0), ev(32, "R", "together", 0.5, 0)
    ]
  });

  /* 2 ── THE WOBBLE ── free, famous ────────────────────────────────────────── */
  DANCES.push({
    id: "the-wobble", name: "The Wobble", aka: ["Wobble"], counts: 32, walls: 4,
    difficulty: 1, tags: ["famous", "wedding", "party", "TikTok", "high energy"],
    free: true, famous: true, intro_counts: 0, version: 1,
    choreographer_credit: "Popularized by V.I.C. (2008); 32-count sheet formalized by Vic Brentnell (2019), matching the version circulating since 2012",
    songs: [song("Wobble", "V.I.C.")],
    phrases: [
      ph(1, "Counts 1–8: Hop forward, hop back", 1, 8),
      ph(2, "Counts 9–16: Wobble right hip, wobble left hip", 9, 16),
      ph(3, "Counts 17–24: Rock & coaster, right then left", 17, 24),
      ph(4, "Counts 25–32: ¼ turn left, step-lift eight", 25, 32)
    ],
    events: [
      // 1–8: BOTH the forward hops and the back hops live inside this section (the app previously
      // spread them across 1–16, which pushed every later section 8 counts out of place).
      ev(1, "both", "step", 0.5, 0.6, { cue: "Hop forward!" }), ev(2, "both", "hold", 0.5, 0.6),
      ev(3, "both", "step", 0.5, 1.1), ev(4, "both", "hold", 0.5, 1.1),
      ev(5, "both", "step", 0.5, 0.5, { cue: "Hop back!" }), ev(6, "both", "hold", 0.5, 0.5),
      ev(7, "both", "step", 0.5, 0.0), ev(8, "both", "hold", 0.5, 0.0),
      // 9–16: the actual "wobble" — lean and bounce on one hip, then the other. This is a body
      // motion, so the feet stay planted and the cue carries the hip work.
      ev(9, "R", "step", 0.7, 0, { cue: "Lean right — wobble!" }), ev(10, "R", "hold", 0.75, 0),
      ev(11, "R", "hold", 0.7, 0), ev(12, "R", "hold", 0.75, 0),
      ev(13, "L", "step", -0.7, 0, { cue: "Lean left — wobble!" }), ev(14, "L", "hold", -0.75, 0),
      ev(15, "L", "hold", -0.7, 0), ev(16, "L", "hold", -0.75, 0),
      // 17–24: rock forward, recover, coaster back — twice. The app omitted this section entirely.
      ev(17, "R", "rock", 0.5, 0.6, { cue: "Rock forward" }), ev(18, "L", "rock", -0.5, 0),
      ev(19, "R", "step", 0.4, -0.5), ev(19.5, "L", "together", -0.4, -0.5), ev(20, "R", "step", 0.5, 0.1, { cue: "Coaster!" }),
      ev(21, "L", "rock", -0.5, 0.6, { cue: "Rock forward" }), ev(22, "R", "rock", 0.5, 0),
      ev(23, "L", "step", -0.4, -0.5), ev(23.5, "R", "together", 0.4, -0.5), ev(24, "L", "step", -0.5, 0.1, { cue: "Coaster!" }),
      // 25–32: not freestyle — a defined eight. ¼ turn left on 25, then alternating lift/set-down.
      ev(25, "R", "step", 0.5, 0.3, { turn: -90, cue: "¼ turn left!" }), ev(26, "L", "hitch", -0.5, 0.4, { w: false }),
      ev(27, "L", "step", -0.5, 0), ev(28, "R", "hitch", 0.5, 0.4, { w: false }),
      ev(29, "R", "step", 0.5, 0), ev(30, "L", "hitch", -0.5, 0.4, { w: false }),
      ev(31, "L", "step", -0.5, 0), ev(32, "R", "together", 0.5, 0)
    ]
  });

  /* 3 ── PRAIRIE STRUT ── free, original (the prototype dance) ──────────────── */
  DANCES.push({
    id: "prairie-strut", name: "Prairie Strut", aka: [], counts: 32, walls: 4,
    difficulty: 1, tags: ["beginner", "absolute basics", "low impact"],
    free: true, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals",
    songs: [song("Chattahoochee", "Alan Jackson"), song("Save a Horse (Ride a Cowboy)", "Big & Rich")],
    phrases: [
      ph(1, "Counts 1–8: Grapevine right & left", 1, 8),
      ph(2, "Counts 9–16: Jazz box, walk out & back", 9, 16),
      ph(3, "Counts 17–24: Four step-touches", 17, 24),
      ph(4, "Counts 25–32: Strut forward, ¼ turn left", 25, 32)
    ],
    events: [
      ev(1, "R", "side", 1.0, 0), ev(2, "L", "cross", 0.4, -0.35), ev(3, "R", "side", 1.6, 0), ev(4, "L", "touch", 1.05, 0, { w: false, cue: "Clap!" }),
      ev(5, "L", "side", 0.4, 0), ev(6, "R", "cross", 1.0, -0.35), ev(7, "L", "side", -0.2, 0), ev(8, "R", "touch", 0.4, 0, { w: false, cue: "Clap!" }),
      ev(9, "R", "cross", -0.3, 0.42), ev(10, "L", "step", -0.6, -0.42), ev(11, "R", "side", 0.55, -0.3), ev(12, "L", "together", -0.35, -0.18),
      ev(13, "R", "walk", 0.5, 0.55), ev(14, "L", "touch", 0.0, 0.55, { w: false, cue: "Whoop!" }), ev(15, "L", "walk", -0.5, -0.1), ev(16, "R", "touch", 0.0, -0.1, { w: false }),
      ev(17, "R", "side", 1.0, 0), ev(18, "L", "touch", 0.42, 0, { w: false }), ev(19, "L", "side", -1.0, 0), ev(20, "R", "touch", -0.42, 0, { w: false }),
      ev(21, "R", "side", 1.0, 0), ev(22, "L", "touch", 0.42, 0, { w: false }), ev(23, "L", "side", -0.6, 0), ev(24, "R", "touch", 0.0, 0, { w: false, cue: "Snap!" }),
      ev(25, "R", "strut", 0.5, 0.6), ev(26, "L", "together", -0.5, 0.6), ev(27, "R", "strut", 0.5, 1.15), ev(28, "L", "touch", 0.0, 1.15, { w: false, cue: "Hey!" }),
      ev(29, "L", "step", -0.5, 0.55, { turn: -90, cue: "New wall!" }), ev(30, "R", "together", 0.5, 0.55), ev(31, "L", "step", -0.5, 0), ev(32, "R", "step", 0.5, 0)
    ]
  });

  /* 4 ── GRAPEVINE GROOVE ── free, original (teaches the vine both ways) ────── */
  DANCES.push({
    id: "grapevine-groove", name: "Grapevine Groove", aka: [], counts: 32, walls: 2,
    difficulty: 1, tags: ["beginner", "absolute basics", "low impact"],
    free: true, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals",
    songs: [song("Friends in Low Places", "Garth Brooks")],
    phrases: [
      ph(1, "Counts 1–8: Vine right with scuff, vine left with scuff", 1, 8),
      ph(2, "Counts 9–16: Heel digs and toe touches", 9, 16),
      ph(3, "Counts 17–24: Vine right, vine left ½ turn", 17, 24),
      ph(4, "Counts 25–32: Rocking chair and stomps", 25, 32)
    ],
    events: [
      ev(1, "R", "side", 1.0, 0), ev(2, "L", "cross", 0.4, -0.35), ev(3, "R", "side", 1.6, 0), ev(4, "L", "scuff", 1.05, 0.3, { w: false, cue: "Scuff!" }),
      ev(5, "L", "side", 0.4, 0), ev(6, "R", "cross", 1.0, -0.35), ev(7, "L", "side", -0.2, 0), ev(8, "R", "scuff", 0.4, 0.3, { w: false, cue: "Scuff!" }),
      ev(9, "R", "touch", 0.6, 0.55, { w: false }), ev(10, "R", "together", 0.5, 0), ev(11, "L", "touch", -0.6, 0.55, { w: false }), ev(12, "L", "together", -0.5, 0),
      ev(13, "R", "touch", 0.9, 0, { w: false }), ev(14, "R", "together", 0.5, 0), ev(15, "L", "touch", -0.9, 0, { w: false }), ev(16, "L", "together", -0.5, 0, { cue: "Nice!" }),
      ev(17, "R", "side", 1.0, 0), ev(18, "L", "cross", 0.4, -0.35), ev(19, "R", "side", 1.6, 0), ev(20, "L", "touch", 1.05, 0, { w: false }),
      ev(21, "L", "side", 0.4, 0), ev(22, "R", "cross", 1.0, -0.35), ev(23, "L", "step", -0.2, 0.3, { turn: -180, cue: "½ turn!" }), ev(24, "R", "touch", 0.4, 0.3, { w: false }),
      ev(25, "R", "rock", 0.5, 0.6), ev(26, "L", "rock", -0.5, 0), ev(27, "R", "rock", 0.5, -0.5), ev(28, "L", "rock", -0.5, 0),
      ev(29, "R", "stomp", 0.5, 0, { cue: "Stomp!" }), ev(30, "L", "stomp", -0.5, 0, { cue: "Stomp!" }), ev(31, "R", "hitch", 0.5, 0.4, { w: false }), ev(32, "R", "together", 0.5, 0)
    ]
  });

  /* 5 ── CHA-CHA STARTER ── free, original (generic cha-cha-style; NOT the branded "Cha Cha Slide") */
  DANCES.push({
    id: "cha-cha-starter", name: "Cha-Cha Starter", aka: ["Cha Cha Beginner"], counts: 32, walls: 4,
    difficulty: 2, tags: ["beginner", "party", "wedding", "high energy"],
    free: true, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals (generic cha-cha pattern)",
    songs: [song("Watermelon Sugar", "Harry Styles")],
    phrases: [
      ph(1, "Counts 1–8: Slide left, slide right", 1, 8),
      ph(2, "Counts 9–16: Hop back, stomps, kick switches", 9, 16),
      ph(3, "Counts 17–24: Cha-cha in place", 17, 24),
      ph(4, "Counts 25–32: ¼ turn cha-cha, reset", 25, 32)
    ],
    events: [
      ev(1, "L", "side", -1.1, 0, { cue: "Slide left!" }), ev(2, "R", "together", -0.4, 0), ev(3, "L", "side", -1.1, 0), ev(4, "R", "touch", -0.4, 0, { w: false }),
      ev(5, "R", "side", 1.1, 0, { cue: "Slide right!" }), ev(6, "L", "together", 0.4, 0), ev(7, "R", "side", 1.1, 0), ev(8, "L", "touch", 0.4, 0, { w: false }),
      ev(9, "both", "step", 0.5, -0.5, { cue: "Hop back!" }), ev(10, "both", "hold", 0.5, -0.5),
      ev(11, "R", "stomp", 0.5, 0, { cue: "Stomp!" }), ev(12, "L", "stomp", -0.5, 0, { cue: "Clap!" }),
      ev(13, "R", "kick", 0.5, 0.7, { w: false }), ev(14, "R", "together", 0.5, 0), ev(15, "L", "kick", -0.5, 0.7, { w: false }), ev(16, "L", "together", -0.5, 0),
      ev(17, "R", "step", 0.5, 0.3), ev(18, "L", "step", -0.3, 0.15), ev(18.5, "R", "step", 0.4, 0.2), ev(19, "L", "step", -0.5, 0), ev(20, "R", "touch", 0.5, 0, { w: false, cue: "Cha-cha-cha!" }),
      ev(21, "L", "step", -0.5, 0.3), ev(22, "R", "step", 0.3, 0.15), ev(22.5, "L", "step", -0.4, 0.2), ev(23, "R", "step", 0.5, 0), ev(24, "L", "touch", -0.5, 0, { w: false, cue: "Cha-cha-cha!" }),
      ev(25, "R", "step", 0.5, 0.5, { turn: -90, cue: "Turn!" }), ev(26, "L", "together", -0.5, 0.5), ev(27, "R", "step", 0.5, 0), ev(28, "L", "touch", -0.5, 0, { w: false }),
      ev(29, "R", "stomp", 0.5, 0), ev(30, "L", "stomp", -0.5, 0), ev(31, "R", "hitch", 0.5, 0.35, { w: false }), ev(32, "R", "together", 0.5, 0, { cue: "Again!" })
    ]
  });

  /* 6 ── COTTON EYED JOE ── pro, traditional (public domain) ────────────────── */
  DANCES.push({
    id: "cotton-eyed-joe", name: "Cotton Eyed Joe", aka: ["Cotton Eye Joe"], counts: 32, walls: 1,
    difficulty: 2, tags: ["famous", "bar classic", "traditional", "high energy"],
    free: false, famous: true, intro_counts: 0, version: 2,
    // There is no single canonical "Cotton Eyed Joe" line dance — CopperKnob hosts many mutually
    // incompatible sheets under this title. This is the most-voted modern line-dance version
    // (heel-heel / toe-toe / point-hook, then vines), published as 32 count 1 WALL. The previous
    // "32 count / 2 wall" here matched no published sheet at all. The traditional Texas form
    // (hook-kick-shuffle-back + polkas) is a PARTNER dance, not this.
    choreographer_credit: "Traditional tune (public domain); most-documented 32-count line dance version, choreographer unattributed. A common variant turns ¼ left on the last vine to make it 4-wall",
    songs: [song("Cotton Eye Joe", "Rednex")],
    phrases: [
      ph(1, "Counts 1–8: Right heel, toe, point & hook", 1, 8),
      ph(2, "Counts 9–16: Vine right, vine left", 9, 16),
      ph(3, "Counts 17–24: Left heel, toe, point & hook", 17, 24),
      ph(4, "Counts 25–32: Vine left, vine right", 25, 32)
    ],
    events: [
      ev(1, "R", "touch", 0.5, 0.7, { w: false, cue: "Heel, heel!" }), ev(1.5, "R", "touch", 0.5, 0.35, { w: false }), ev(2, "R", "touch", 0.5, 0.7, { w: false }),
      ev(3, "R", "touch", 0.5, -0.5, { w: false, cue: "Toe, toe!" }), ev(3.5, "R", "touch", 0.5, -0.2, { w: false }), ev(4, "R", "touch", 0.5, -0.5, { w: false }),
      ev(5, "R", "touch", 1.1, 0, { w: false, cue: "Point!" }), ev(6, "R", "hitch", 0.0, 0.15, { w: false, cue: "Hook!" }),
      ev(7, "R", "touch", 1.1, 0, { w: false, cue: "Point!" }), ev(8, "R", "hitch", 0.35, -0.45, { w: false, cue: "Flick!" }),
      ev(9, "R", "side", 1.0, 0), ev(10, "L", "cross", 0.4, -0.35), ev(11, "R", "side", 1.6, 0), ev(12, "L", "together", 1.05, 0),
      ev(13, "L", "side", 0.4, 0), ev(14, "R", "cross", 1.0, -0.35), ev(15, "L", "side", -0.2, 0), ev(16, "R", "together", 0.4, 0),
      ev(17, "L", "touch", -0.5, 0.7, { w: false, cue: "Heel, heel!" }), ev(17.5, "L", "touch", -0.5, 0.35, { w: false }), ev(18, "L", "touch", -0.5, 0.7, { w: false }),
      ev(19, "L", "touch", -0.5, -0.5, { w: false, cue: "Toe, toe!" }), ev(19.5, "L", "touch", -0.5, -0.2, { w: false }), ev(20, "L", "touch", -0.5, -0.5, { w: false }),
      ev(21, "L", "touch", -1.1, 0, { w: false, cue: "Point!" }), ev(22, "L", "hitch", 0.0, 0.15, { w: false, cue: "Hook!" }),
      ev(23, "L", "touch", -1.1, 0, { w: false, cue: "Point!" }), ev(24, "L", "hitch", -0.35, -0.45, { w: false, cue: "Flick!" }),
      ev(25, "L", "side", -1.0, 0), ev(26, "R", "cross", -0.4, -0.35), ev(27, "L", "side", -1.6, 0), ev(28, "R", "together", -1.05, 0),
      ev(29, "R", "side", -0.55, 0), ev(30, "L", "cross", -1.15, -0.35), ev(31, "R", "side", 0.0, 0), ev(32, "L", "together", -0.55, 0)
    ]
  });

  /* 7 ── BOOT SCOOTIN' BOOGIE ── pro, classic ──────────────────────────────── */
  DANCES.push({
    id: "boot-scootin-boogie", name: "Boot Scootin' Boogie", aka: ["Boot Scoot Boogie", "Boot Scootin"], counts: 32, walls: 4,
    difficulty: 3, tags: ["famous", "bar classic", "country", "high energy"],
    free: false, famous: true, intro_counts: 0, version: 2,
    // Corrected to Bill Bader's published sheet (copperknob.co.uk/stepsheets/QGCF4T9, and Bader's
    // own billbader.com). The steps here previously bore no relation to it. Bader choreographed it
    // in Oct 1990 as "Boot Scootin' (Vancouver) Boogie" to Asleep At The Wheel; the 1992 Brooks &
    // Dunn hit is the song that popularized it, not the origin date.
    choreographer_credit: "Line dance by Bill Bader (1990, \"Boot Scootin' (Vancouver) Boogie\"); song by Brooks & Dunn (1992)",
    songs: [song("Boot Scootin' Boogie", "Brooks & Dunn")],
    phrases: [
      ph(1, "Counts 1–8: Vine right & heel-clap, vine left & heel-clap", 1, 8),
      ph(2, "Counts 9–16: Step-together heels, then heel swivels", 9, 16),
      ph(3, "Counts 17–24: Stomps, kicks, ball-change, kicks", 17, 24),
      ph(4, "Counts 25–32: Forward hook, back hitches, ¼ turn left", 25, 32)
    ],
    events: [
      ev(1, "R", "side", 1.1, 0), ev(2, "L", "cross", 0.5, -0.35), ev(3, "R", "side", 1.6, 0), ev(4, "L", "touch", 1.15, 0.6, { w: false, cue: "Heel — clap!" }),
      ev(5, "L", "side", 0.1, 0), ev(6, "R", "cross", 0.6, -0.35), ev(7, "L", "side", -0.5, 0), ev(8, "R", "touch", -0.1, 0.6, { w: false, cue: "Heel — clap!" }),
      ev(9, "R", "together", 0.5, 0), ev(10, "L", "touch", -0.15, 0.6, { w: false, cue: "Heel — clap!" }),
      ev(11, "L", "together", -0.5, 0), ev(12, "R", "touch", 0.15, 0.6, { w: false, cue: "Heel — clap!" }),
      // Heel swivels are a both-feet motion a footwork diagram can't draw, so the feet hold and the
      // cue carries the swivel. Count mapping is exact to the sheet (right, left, right, centre).
      ev(13, "R", "together", 0.5, 0, { cue: "Swivel heels RIGHT" }), ev(14, "both", "hold", 0.5, 0, { cue: "Swivel heels LEFT" }),
      ev(15, "both", "hold", 0.5, 0, { cue: "Swivel heels RIGHT" }), ev(16, "both", "hold", 0.5, 0, { cue: "Heels CENTRE" }),
      ev(17, "R", "stomp", 0.5, 0, { w: false, cue: "Stomp!" }), ev(18, "R", "stomp", 0.5, 0, { w: false, cue: "Stomp!" }),
      ev(19, "R", "kick", 0.5, 0.8, { w: false, cue: "Kick!" }), ev(20, "R", "kick", 0.5, 0.8, { w: false, cue: "Kick!" }),
      ev(20.5, "R", "together", 0.5, 0), ev(21, "L", "step", -0.5, 0, { cue: "Ball-change" }),
      ev(22, "R", "stomp", 0.5, 0, { w: false, cue: "Stomp!" }),
      ev(23, "R", "kick", 0.5, 0.8, { w: false, cue: "Kick!" }), ev(24, "R", "kick", 0.5, 0.8, { w: false, cue: "Kick!" }),
      ev(25, "R", "step", 0.5, 0.6, { cue: "Forward" }), ev(26, "L", "hitch", 0.15, -0.35, { w: false, cue: "Hook behind" }),
      ev(27, "L", "step", -0.5, 0.05, { cue: "Back" }), ev(28, "R", "hitch", 0.5, 0.45, { w: false, cue: "Hitch!" }),
      ev(29, "R", "step", 0.5, -0.45, { cue: "Back" }), ev(30, "L", "hitch", -0.5, 0.0, { w: false, cue: "Hitch!" }),
      ev(31, "L", "step", -0.5, 0.2, { cue: "Forward" }), ev(32, "R", "scuff", 0.5, 0.65, { w: false, turn: -90, cue: "Scuff — ¼ turn left!" })
    ]
  });

  /* 8 ── JAZZ BOX JAMBOREE ── pro, original ────────────────────────────────── */
  DANCES.push({
    id: "jazz-box-jamboree", name: "Jazz Box Jamboree", aka: [], counts: 32, walls: 4,
    difficulty: 2, tags: ["beginner", "absolute basics", "low impact"],
    free: false, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals",
    songs: [song("Wagon Wheel", "Darius Rucker")],
    phrases: [
      ph(1, "Counts 1–8: Two jazz boxes", 1, 8),
      ph(2, "Counts 9–16: Step-touches with claps", 9, 16),
      ph(3, "Counts 17–24: Jazz box with ¼ turn", 17, 24),
      ph(4, "Counts 25–32: Vine and stomps", 25, 32)
    ],
    events: [
      ev(1, "R", "cross", -0.3, 0.4), ev(2, "L", "step", -0.6, -0.4), ev(3, "R", "side", 0.55, -0.3), ev(4, "L", "together", -0.35, -0.15, { cue: "Box!" }),
      ev(5, "R", "cross", -0.3, 0.4), ev(6, "L", "step", -0.6, -0.4), ev(7, "R", "side", 0.55, -0.3), ev(8, "L", "together", -0.35, -0.15, { cue: "Box!" }),
      ev(9, "R", "side", 1.0, 0), ev(10, "L", "touch", 0.4, 0, { w: false, cue: "Clap!" }), ev(11, "L", "side", -1.0, 0), ev(12, "R", "touch", -0.4, 0, { w: false, cue: "Clap!" }),
      ev(13, "R", "side", 1.0, 0), ev(14, "L", "touch", 0.4, 0, { w: false, cue: "Clap!" }), ev(15, "L", "side", -1.0, 0), ev(16, "R", "touch", -0.4, 0, { w: false, cue: "Clap!" }),
      ev(17, "R", "cross", -0.3, 0.4), ev(18, "L", "step", -0.5, -0.3, { turn: -90, cue: "¼ turn!" }), ev(19, "R", "side", 0.55, -0.2), ev(20, "L", "together", -0.35, -0.1),
      ev(21, "R", "cross", -0.3, 0.4), ev(22, "L", "step", -0.6, -0.4), ev(23, "R", "side", 0.55, -0.3), ev(24, "L", "together", -0.35, -0.15),
      ev(25, "R", "side", 1.0, 0), ev(26, "L", "cross", 0.4, -0.35), ev(27, "R", "side", 1.6, 0), ev(28, "L", "scuff", 1.05, 0.3, { w: false, cue: "Scuff!" }),
      ev(29, "L", "stomp", 0.4, 0), ev(30, "R", "stomp", 1.0, 0), ev(31, "L", "hitch", 0.4, 0.35, { w: false }), ev(32, "L", "together", 0.4, 0)
    ]
  });

  /* 9 ── SWEETHEART SHUFFLE ── pro, original ───────────────────────────────── */
  DANCES.push({
    id: "sweetheart-shuffle", name: "Sweetheart Shuffle", aka: [], counts: 32, walls: 4,
    difficulty: 2, tags: ["beginner", "wedding", "low impact", "romantic"],
    free: false, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals",
    songs: [song("Tennessee Whiskey", "Chris Stapleton")],
    phrases: [
      ph(1, "Counts 1–8: Shuffle right & cross, shuffle left & cross", 1, 8),
      ph(2, "Counts 9–16: Rock, recover, coaster step", 9, 16),
      ph(3, "Counts 17–24: Sway and step-touch", 17, 24),
      ph(4, "Counts 25–32: ¼ turn shuffle, sweetheart pose", 25, 32)
    ],
    events: [
      ev(1, "R", "step", 0.6, 0), ev(1.5, "L", "together", 0.2, 0), ev(2, "R", "step", 1.0, 0), ev(3, "L", "cross", 0.4, 0.1), ev(4, "R", "touch", 1.0, 0, { w: false }),
      ev(5, "L", "step", -0.6, 0), ev(5.5, "R", "together", -0.2, 0), ev(6, "L", "step", -1.0, 0), ev(7, "R", "cross", -0.4, 0.1), ev(8, "L", "touch", -1.0, 0, { w: false }),
      ev(9, "R", "rock", 0.5, 0.6, { cue: "Rock!" }), ev(10, "L", "rock", -0.5, 0), ev(11, "R", "step", 0.4, -0.5), ev(11.5, "L", "together", -0.4, -0.5), ev(12, "R", "step", 0.5, 0.1, { cue: "Coaster!" }),
      ev(13, "L", "rock", -0.5, 0.6, { cue: "Rock!" }), ev(14, "R", "rock", 0.5, 0), ev(15, "L", "step", -0.4, -0.5), ev(15.5, "R", "together", 0.4, -0.5), ev(16, "L", "step", -0.5, 0.1),
      ev(17, "R", "side", 0.9, 0, { cue: "Sway" }), ev(18, "L", "together", -0.4, 0), ev(19, "L", "side", -0.9, 0, { cue: "Sway" }), ev(20, "R", "together", 0.4, 0),
      ev(21, "R", "step", 0.6, 0.5), ev(22, "L", "touch", 0.1, 0.5, { w: false }), ev(23, "L", "step", -0.5, 0), ev(24, "R", "touch", 0.0, 0, { w: false }),
      ev(25, "R", "step", 0.5, 0.5), ev(25.5, "L", "together", -0.3, 0.4), ev(26, "R", "step", 0.5, 0.5, { turn: -90, cue: "Turn!" }), ev(27, "L", "step", -0.5, 0.4), ev(28, "R", "touch", 0.5, 0.4, { w: false }),
      ev(29, "R", "step", 0.5, 0), ev(30, "L", "together", -0.5, 0), ev(31, "R", "hitch", 0.5, 0.35, { w: false, cue: "Pose!" }), ev(32, "R", "together", 0.5, 0)
    ]
  });

  /* 10 ── HONKY-TONK STROLL ── pro, original ───────────────────────────────── */
  DANCES.push({
    id: "honky-tonk-stroll", name: "Honky-Tonk Stroll", aka: [], counts: 32, walls: 4,
    difficulty: 3, tags: ["bar classic", "country", "high energy"],
    free: false, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps Originals",
    songs: [song("Man! I Feel Like a Woman!", "Shania Twain")],
    phrases: [
      ph(1, "Counts 1–8: Heel struts and heel digs", 1, 8),
      ph(2, "Counts 9–16: Monterey ¼ turn, kick-ball-change", 9, 16),
      ph(3, "Counts 17–24: Vine right with hitch, sailor step", 17, 24),
      ph(4, "Counts 25–32: Strut back, stomp-stomp, clap", 25, 32)
    ],
    events: [
      ev(1, "R", "touch", 0.5, 0.5, { w: false, cue: "Heel!" }), ev(2, "R", "strut", 0.5, 0.4), ev(3, "L", "touch", -0.5, 0.5, { w: false, cue: "Heel!" }), ev(4, "L", "strut", -0.5, 0.4),
      ev(5, "R", "touch", 0.5, 0.7, { w: false, cue: "Dig!" }), ev(6, "R", "together", 0.5, 0), ev(7, "L", "touch", -0.5, 0.7, { w: false, cue: "Dig!" }), ev(8, "L", "together", -0.5, 0),
      ev(9, "R", "touch", 1.0, 0, { w: false, cue: "Point!" }), ev(10, "R", "step", 0.5, 0, { turn: -90, cue: "Monterey ¼!" }), ev(11, "L", "touch", -1.0, 0, { w: false }), ev(12, "L", "together", -0.5, 0),
      ev(13, "R", "kick", 0.5, 0.7, { w: false, cue: "Kick!" }), ev(13.5, "R", "step", 0.4, 0.1, { cue: "Ball" }), ev(14, "L", "step", -0.4, 0, { cue: "Change" }), ev(15, "R", "stomp", 0.5, 0), ev(16, "L", "hold", -0.5, 0),
      ev(17, "R", "side", 1.1, 0), ev(18, "L", "cross", 0.4, -0.35), ev(19, "R", "side", 1.6, 0), ev(20, "L", "hitch", 1.0, 0.4, { w: false, cue: "Hitch!" }),
      ev(21, "L", "cross", 0.3, -0.4, { cue: "Sailor" }), ev(21.5, "R", "step", 0.7, -0.2), ev(22, "L", "step", 0.0, 0), ev(23, "R", "cross", -0.3, -0.4, { cue: "Sailor" }), ev(23.5, "L", "step", -0.7, -0.2), ev(24, "R", "step", 0.0, 0),
      ev(25, "L", "strut", -0.5, -0.5), ev(26, "R", "strut", 0.5, -0.5), ev(27, "L", "strut", -0.5, -1.0), ev(28, "R", "together", 0.5, -1.0),
      ev(29, "R", "stomp", 0.5, 0, { cue: "Stomp!" }), ev(30, "L", "stomp", -0.5, 0, { cue: "Stomp!" }), ev(31, "both", "hold", 0.5, 0, { cue: "Clap!" }), ev(32, "R", "hitch", 0.5, 0.35, { w: false, cue: "Yeehaw!" })
    ]
  });

  global.SS_DANCES = DANCES;
})(typeof window !== "undefined" ? window : globalThis);
