/* ============================================================================
   ScootSteps — GLOSSARY  (brief §6.4 / §8: foundation steps as tiny mini-dances)
   Each term is a small Dance doc rendered by the same Step Engine — a 5–10s
   animated definition. All free (brief §6.5).
   ============================================================================ */
(function (global) {
  "use strict";
  function ev(count, foot, action, x, y, o) { o = o || {}; const e = { count, foot, action, to_pos: [x, y], weight_change: o.w !== false }; if (o.turn) e.facing_delta = o.turn; if (o.cue) e.styling_note = o.cue; return e; }
  const ph = (o, l, s, e) => ({ order: o, label: l, counts_start: s, counts_end: e });
  const term = (id, name, definition, counts, walls, events, phrases) => ({
    id, name, definition, counts, walls, difficulty: 1, tags: ["glossary"],
    glossary: true, free: true, famous: false, intro_counts: 0, version: 1,
    choreographer_credit: "ScootSteps", songs: [], bpm: 92, start_facing: 0, phrases, events
  });

  const G = [];

  G.push(term("grapevine", "Grapevine", "A traveling step: step to the side, cross the other foot behind, step to the side again, then touch. The signature line-dance move.", 8, 1,
    [ev(1, "R", "side", 1.0, 0, { cue: "Side" }), ev(2, "L", "cross", 0.4, -0.35, { cue: "Behind" }), ev(3, "R", "side", 1.6, 0, { cue: "Side" }), ev(4, "L", "touch", 1.05, 0, { w: false, cue: "Touch" }),
     ev(5, "L", "side", 0.4, 0, { cue: "Side" }), ev(6, "R", "cross", 1.0, -0.35, { cue: "Behind" }), ev(7, "L", "side", -0.2, 0, { cue: "Side" }), ev(8, "R", "touch", 0.4, 0, { w: false, cue: "Touch" })],
    [ph(1, "Grapevine right then left", 1, 8)]));

  G.push(term("vine", "Vine", "Short for grapevine — a three-step traveling move (side, behind, side) followed by a touch or scuff.", 4, 1,
    [ev(1, "R", "side", 1.0, 0, { cue: "Side" }), ev(2, "L", "cross", 0.4, -0.35, { cue: "Behind" }), ev(3, "R", "side", 1.6, 0, { cue: "Side" }), ev(4, "L", "scuff", 1.05, 0.3, { w: false, cue: "Scuff" })],
    [ph(1, "Vine right", 1, 4)]));

  G.push(term("shuffle", "Shuffle", "A quick step-together-step that travels, danced across one-and-two (1&2). Light and bouncy.", 8, 1,
    [ev(1, "R", "step", 0.5, 0.4, { cue: "Step" }), ev(1.5, "L", "together", 0.1, 0.3, { cue: "and" }), ev(2, "R", "step", 0.5, 0.6, { cue: "Step" }),
     ev(3, "L", "step", -0.5, 0.9, { cue: "Step" }), ev(3.5, "R", "together", -0.1, 0.8, { cue: "and" }), ev(4, "L", "step", -0.5, 1.1, { cue: "Step" }),
     ev(5, "R", "step", 0.5, 0.7), ev(5.5, "L", "together", 0.1, 0.6), ev(6, "R", "step", 0.5, 0.5),
     ev(7, "L", "step", -0.5, 0.2), ev(7.5, "R", "together", -0.1, 0.1), ev(8, "L", "step", -0.5, 0)],
    [ph(1, "Two shuffles forward, two back", 1, 8)]));

  G.push(term("coaster-step", "Coaster Step", "Step back, step together, step forward — all in one-and-two. A smooth reset that changes direction.", 4, 1,
    [ev(1, "R", "step", 0.5, -0.5, { cue: "Back" }), ev(1.5, "L", "together", -0.3, -0.5, { cue: "Together" }), ev(2, "R", "step", 0.5, 0.3, { cue: "Forward" }), ev(4, "L", "together", -0.5, 0.3, { cue: "Ready" })],
    [ph(1, "Coaster step", 1, 4)]));

  G.push(term("sailor-step", "Sailor Step", "Cross one foot behind, step the other to the side, step back to place — a rolling, sway-like move.", 4, 1,
    [ev(1, "R", "cross", -0.3, -0.4, { cue: "Cross behind" }), ev(1.5, "L", "side", -0.7, -0.1, { cue: "Side" }), ev(2, "R", "step", 0.1, 0, { cue: "In place" }),
     ev(3, "L", "cross", 0.3, -0.4, { cue: "Cross behind" }), ev(3.5, "R", "side", 0.7, -0.1, { cue: "Side" }), ev(4, "L", "step", -0.1, 0, { cue: "In place" })],
    [ph(1, "Sailor step right then left", 1, 4)]));

  G.push(term("pivot", "Pivot Turn", "Step forward, then spin a half-turn on the balls of both feet. The fast way to change walls.", 4, 2,
    [ev(1, "R", "step", 0.4, 0.6, { cue: "Step forward" }), ev(2, "L", "step", -0.4, 0.5, { turn: -180, cue: "½ pivot!" }),
     ev(3, "R", "step", 0.4, 0.6, { cue: "Step forward" }), ev(4, "L", "step", -0.4, 0.5, { turn: -180, cue: "½ pivot!" })],
    [ph(1, "Two half pivots (back to front)", 1, 4)]));

  G.push(term("hitch", "Hitch", "Lift one knee up sharply, like a marching step. Adds attitude and helps you change weight.", 4, 1,
    [ev(1, "R", "hitch", 0.5, 0.5, { w: false, cue: "Knee up!" }), ev(2, "R", "together", 0.5, 0), ev(3, "L", "hitch", -0.5, 0.5, { w: false, cue: "Knee up!" }), ev(4, "L", "together", -0.5, 0)],
    [ph(1, "Hitch right then left", 1, 4)]));

  G.push(term("scuff", "Scuff", "Brush your heel forward along the floor. A traveling accent, often before a kick or hitch.", 4, 1,
    [ev(1, "R", "scuff", 0.5, 0.7, { w: false, cue: "Scuff!" }), ev(2, "R", "together", 0.5, 0), ev(3, "L", "scuff", -0.5, 0.7, { w: false, cue: "Scuff!" }), ev(4, "L", "together", -0.5, 0)],
    [ph(1, "Scuff right then left", 1, 4)]));

  G.push(term("stomp", "Stomp", "Plant your foot firmly with weight — with authority. The exclamation point of line dancing.", 4, 1,
    [ev(1, "R", "stomp", 0.5, 0, { cue: "Stomp!" }), ev(2, "R", "hold", 0.5, 0), ev(3, "L", "stomp", -0.5, 0, { cue: "Stomp!" }), ev(4, "L", "hold", -0.5, 0)],
    [ph(1, "Stomp right then left", 1, 4)]));

  G.push(term("monterey-turn", "Monterey Turn", "Point one toe to the side, then turn a quarter as you snap that foot home. A crisp, showy way to change walls.", 8, 4,
    [ev(1, "R", "touch", 1.0, 0, { w: false, cue: "Point" }), ev(2, "R", "together", 0.5, 0, { turn: -90, cue: "¼ turn!" }), ev(3, "L", "touch", -1.0, 0, { w: false, cue: "Point" }), ev(4, "L", "together", -0.5, 0),
     ev(5, "R", "touch", 1.0, 0, { w: false, cue: "Point" }), ev(6, "R", "together", 0.5, 0, { turn: -90, cue: "¼ turn!" }), ev(7, "L", "touch", -1.0, 0, { w: false, cue: "Point" }), ev(8, "L", "together", -0.5, 0)],
    [ph(1, "Two Monterey quarter-turns", 1, 8)]));

  global.SS_GLOSSARY = G;
})(typeof window !== "undefined" ? window : globalThis);
