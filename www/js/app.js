/* ============================================================================
   ScootSteps — APP  (router, screens, player wiring, Learn Paths, gating, state)
   Offline-first: all content is bundled JS; state persists in localStorage
   (works in the Capacitor webview). Every control does its real thing.
   ============================================================================ */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DANCES = window.SS_DANCES, GLOSS = window.SS_GLOSSARY;
  var byId = {}; DANCES.concat(GLOSS).forEach(function (d) { byId[d.id] = d; });

  /* ---------------- persistent state ---------------- */
  var DEFAULT = { onboarded: false, plan: null, mastery: {}, downloaded: {}, want: {},
    streak: { count: 0, last: null }, history: [],
    settings: { countStyle: "click", haptics: true, orientation: "portrait", reminders: true, textScale: 1 } };
  var S = load();
  function load() { try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem("ss_state") || "{}")); } catch (e) { return Object.assign({}, DEFAULT); } }
  function save() { try { localStorage.setItem("ss_state", JSON.stringify(S)); } catch (e) {} }
  function applyTextScale() { document.documentElement.style.setProperty("--textScale", S.settings.textScale || 1); }

  /* ---------------- little helpers ---------------- */
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function boots(n) { var s = ""; for (var i = 0; i < 5; i++) s += i < n ? "🥾" : "·"; return s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  var VERBS = { step: "step", side: "step to the side", cross: "cross over", walk: "walk", together: "step together", strut: "strut", rock: "rock", touch: "touch", tap: "tap", scuff: "scuff", brush: "brush", kick: "kick", hitch: "hitch — knee up", stomp: "stomp", hold: "hold", clap: "clap" };
  function instrText(ev) {
    if (!ev) return { main: "", sub: "" };
    if (ev.foot === "both" && ev.action === "hold") return { main: ev.styling_note || "Clap!", sub: "both feet" };
    var f = ev.foot === "L" ? "Left" : ev.foot === "R" ? "Right" : "Both";
    var v = VERBS[ev.action] || ev.action;
    var sub = (ev.weight_change === false ? "no weight" : "weight changes") + (ev.facing_delta ? " · turn " + Math.abs(ev.facing_delta) + "°" : "");
    return { main: f + " — " + v, sub: sub };
  }

  /* ---------------- thumbnails (static pose, cheap) ---------------- */
  var COLORS = { left: "#2BB3A3", right: "#E4574F" };
  function drawPose(cv, dance, beat) {
    var ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
    var TL = window.ScootEngine.buildTimeline(dance);
    var Bw = ((beat % dance.counts) + dance.counts) % dance.counts;
    var fr = window.ScootEngine.facingAt(TL, Bw) * Math.PI / 180, k = Math.min(W, H) * 0.30;
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#4a3422"); g.addColorStop(1, "#241a10");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .12; ctx.strokeStyle = "#1c130a"; for (var i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * H / 6); ctx.lineTo(W, i * H / 6); ctx.stroke(); } ctx.globalAlpha = 1;
    function world(p) { var lx = p[0], ly = p[1], c = Math.cos(fr), s = Math.sin(fr); return { x: W / 2 + (lx * c + ly * s) * k, y: H / 2 + (lx * s - ly * c) * k }; }
    function boot(p, foot, weight) {
      var w = world(p), L = k * 0.6, Wd = k * 0.3, col = foot === "L" ? COLORS.left : COLORS.right;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(fr);
      ctx.beginPath();
      var x = -Wd / 2, y = -L / 2, h = L * 0.82, r = Wd * 0.42;
      ctx.moveTo(x + r, y); ctx.arcTo(x + Wd, y, x + Wd, y + h, r); ctx.arcTo(x + Wd, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + Wd, y, r);
      ctx.moveTo(Wd / 2, -L / 2 + L * 0.2); ctx.quadraticCurveTo(Wd * 0.62, -L / 2 - L * 0.12, 0, -L / 2 - L * 0.1); ctx.quadraticCurveTo(-Wd * 0.62, -L / 2 - L * 0.12, -Wd / 2, -L / 2 + L * 0.2); ctx.closePath();
      if (weight) { ctx.fillStyle = col; ctx.fill(); } else { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = col; ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = weight ? "#0d1826" : col; ctx.font = "900 " + Math.round(k * 0.16) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(foot, w.x, w.y);
    }
    var l = window.ScootEngine.footAt(TL, "L", Bw), r = window.ScootEngine.footAt(TL, "R", Bw);
    (l.weight ? [["R", r], ["L", l]] : [["L", l], ["R", r]]).forEach(function (a) { boot(a[1].pos, a[0], a[1].weight); });
  }
  function thumbFor(dance) {
    var cv = document.createElement("canvas"); cv.width = 220; cv.height = 176;
    drawPose(cv, dance, dance.id === "the-wobble" ? 0.5 : 2.0);
    return cv;
  }

  /* ---------------- router ---------------- */
  var current = "home", lastTab = "home";
  function showView(id) {
    try { if (window.SS_Preview) window.SS_Preview.stopAll(); } catch (e) {}
    $$(".view").forEach(function (v) { v.classList.remove("is-active"); });
    var v = $("#view-" + id); if (v) v.classList.add("is-active");
    $$(".tab").forEach(function (t) { var on = t.dataset.view === id; t.classList.toggle("on", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
    current = id; if (["home", "library", "glossary", "mydances"].indexOf(id) >= 0) lastTab = id; window.scrollTo(0, 0);
    if (id === "home") renderHome(); else if (id === "library") renderLibrary(); else if (id === "glossary") renderGlossary(); else if (id === "mydances") renderMyDances(); else if (id === "settings") renderSettings();
  }
  $$(".tab").forEach(function (t) { t.addEventListener("click", function () { showView(t.dataset.view); }); });

  /* ---------------- HOME / TONIGHT ---------------- */
  function greeting() { var h = new Date().getHours(); if (h < 5) return "Still up?"; if (h < 12) return "Mornin', dancer."; if (h < 17) return "Afternoon warm-up?"; if (h < 21) return "Boots on."; return "It's go time."; }
  function featured() { var wk = Math.floor(Date.now() / 6048e5); return DANCES[wk % DANCES.length]; }
  function renderHome() {
    var v = $("#view-home"), f = featured();
    var plan = S.plan;
    var streakLine = S.streak.count > 0 ? S.streak.count + "-day streak — don't break it now." : "Run one dance to start a streak.";
    var learning = Object.keys(S.mastery).filter(function (id) { return S.mastery[id] === "learning" && byId[id]; });
    var html = "";
    html += '<div class="vhead"><div><div class="vtitle">' + greeting() + '</div><div class="vsub">' + esc(streakLine) + '</div></div>' +
            '<button class="iconbtn" id="home-settings" aria-label="Settings">⚙️</button></div>';
    html += '<div class="statrow">' +
      '<div class="stat"><b>' + S.streak.count + '</b><span>day streak</span></div>' +
      '<div class="stat"><b>' + Object.keys(S.mastery).filter(function (id) { return S.mastery[id] === "know-it"; }).length + '</b><span>know cold</span></div>' +
      '<div class="stat"><b>' + DANCES.length + '</b><span>dances</span></div></div>';
    if (plan) {
      var names = plan.dance_ids.map(function (id) { return byId[id] ? byId[id].name : null; }).filter(Boolean);
      html += '<div class="card spotlight"><div class="eyebrow">Your plan · ' + esc(plan.label) + '</div>' +
        '<div class="h2">' + esc(plan.headline) + '</div>' +
        '<div class="p">' + esc(names.join(" · ")) + '</div>' +
        '<div style="margin-top:12px"><button class="btn primary" id="plan-start">Start with ' + esc(names[0] || "your first dance") + '</button></div></div>';
    } else {
      html += '<div class="card spotlight"><div class="eyebrow">Panic mode</div><div class="h2">When do you need to dance?</div>' +
        '<div class="p">Tell me your deadline and I\'ll build you a plan. Beginner-proof.</div>' +
        '<div style="margin-top:12px"><button class="btn primary" id="open-onboard">Make my plan</button></div></div>';
    }
    if (learning.length) {
      var ld = byId[learning[0]];
      html += '<div class="eyebrow" style="margin:16px 0 8px">Pick up where you left off</div>';
      html += danceCardWide(ld);
    }
    html += '<div class="eyebrow" style="margin:16px 0 8px">Featured this week</div>' + danceCardWide(f);
    html += '<div class="eyebrow" style="margin:16px 0 8px">Two taps to the floor</div>';
    html += '<div class="prow" style="display:flex;gap:10px">' +
      '<button class="btn" id="go-library">💃 Browse dances</button>' +
      '<button class="btn" id="go-basics">👣 Learn the basics</button></div>';
    v.innerHTML = html;
    // wire
    $("#home-settings").onclick = function () { showView("settings"); };
    var ob = $("#open-onboard"); if (ob) ob.onclick = openOnboarding;
    var ps = $("#plan-start"); if (ps) ps.onclick = function () { openDetail(plan.dance_ids[0]); };
    $("#go-library").onclick = function () { showView("library"); };
    $("#go-basics").onclick = function () { showView("glossary"); };
    mountThumbs(v);
    $$("[data-open]", v).forEach(function (el) { el.onclick = function () { openDetail(el.dataset.open); }; });
  }

  function danceCardWide(d) {
    var locked = window.Monetize.enabled() && !window.Monetize.isUnlocked(d);
    return '<button class="dcard wide" data-open="' + d.id + '">' +
      '<div class="thumb" data-thumb="' + d.id + '">' + (d.famous ? '<span class="pin">📌</span>' : '') + (locked ? '<span class="lock">🔒 Pro</span>' : '') + '</div>' +
      '<div class="body"><div class="nm">' + esc(d.name) + '</div>' +
      '<div class="meta">' + d.counts + ' counts · ' + d.walls + ' wall' + (d.walls > 1 ? 's' : '') + '</div>' +
      '<div class="meta boots">' + boots(d.difficulty) + '</div>' +
      '<div class="chips" style="margin-top:7px">' + d.tags.slice(0, 2).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div></button>';
  }
  function danceCard(d) {
    var locked = window.Monetize.enabled() && !window.Monetize.isUnlocked(d);
    return '<button class="dcard" data-open="' + d.id + '">' +
      '<div class="thumb" data-thumb="' + d.id + '">' + (d.famous ? '<span class="pin">📌</span>' : '') + (locked ? '<span class="lock">🔒 Pro</span>' : '') + '</div>' +
      '<div class="body"><div class="nm">' + esc(d.name) + '</div>' +
      '<div class="meta">' + d.counts + 'ct · ' + d.walls + 'w · <span class="boots">' + boots(d.difficulty) + '</span></div>' +
      '</div></button>';
  }
  function mountThumbs(root) {
    $$("[data-thumb]", root).forEach(function (holder) {
      if (holder._done) return; holder._done = true;
      var d = byId[holder.dataset.thumb]; if (!d) return;
      var c = thumbFor(d); holder.insertBefore(c, holder.firstChild);
    });
  }

  /* ---------------- LIBRARY + search ---------------- */
  var libFilter = "all";
  var FILTERS = [["all", "All"], ["famous", "Famous"], ["wedding", "Wedding"], ["bar classic", "Bar classics"], ["beginner", "Beginner"], ["party", "Party"], ["TikTok", "TikTok"], ["low impact", "Low impact"]];
  function lev(a, b) { a = a || ""; b = b || ""; var m = a.length, n = b.length, d = []; if (!m) return n; if (!n) return m; for (var i = 0; i <= m; i++) d[i] = [i]; for (var j = 0; j <= n; j++) d[0][j] = j; for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(); }
  function scoreDance(q, d) {
    q = norm(q); if (!q) return 1;
    var hay = [d.name].concat(d.aka || []).concat(d.tags || []).map(norm);
    var terms = [d.name].concat(d.aka || []).concat(d.tags || []).join(" ");
    var nh = norm(terms);
    if (nh.indexOf(q) >= 0) return 100 - nh.indexOf(q);          // substring hit, earlier = better
    // per-word fuzzy (typo tolerance)
    var words = nh.split(" "), best = 99;
    words.forEach(function (w) { if (!w) return; var dist = lev(q, w); var thr = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3; if (dist <= thr) best = Math.min(best, dist); });
    if (best < 99) return 40 - best;
    // subsequence (e.g. "bsb" -> boot scootin boogie)
    var joined = nh.replace(/ /g, ""), qi = 0; for (var i = 0; i < joined.length && qi < q.length; i++) if (joined[i] === q[qi]) qi++;
    if (qi === q.length && q.length >= 3) return 10;
    return 0;
  }
  function renderLibrary() {
    $("#lib-count").textContent = DANCES.length + " dances — every one really plays";
    var fbar = $("#lib-filters"); fbar.innerHTML = FILTERS.map(function (f) { return '<button class="chip' + (libFilter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + esc(f[1]) + '</button>'; }).join('');
    $$("[data-f]", fbar).forEach(function (b) { b.onclick = function () { libFilter = b.dataset.f; renderLibrary(); }; });
    var q = $("#lib-search").value;
    var list = DANCES.filter(function (d) { return libFilter === "all" || (d.tags || []).indexOf(libFilter) >= 0 || (libFilter === "famous" && d.famous); });
    if (q) { list = list.map(function (d) { return { d: d, s: scoreDance(q, d) }; }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.d; }); }
    else { list = list.slice().sort(function (a, b) { return (b.famous - a.famous) || (a.difficulty - b.difficulty); }); }
    var grid = $("#lib-grid"), empty = $("#lib-empty");
    if (!list.length) { grid.innerHTML = ""; empty.classList.remove("hide"); empty.textContent = "No dance by that name yet — but that's a hint for our next content drop. Try “cupid”, “wobble”, or clear the search."; return; }
    empty.classList.add("hide");
    grid.innerHTML = list.map(danceCard).join('');
    mountThumbs(grid);
    $$("[data-open]", grid).forEach(function (el) { el.onclick = function () { openDetail(el.dataset.open); }; });
  }
  $("#lib-search").addEventListener("input", function () { if (current === "library") renderLibrary(); });

  /* ---------------- GLOSSARY ---------------- */
  function renderGlossary() {
    var q = $("#glo-search").value, list = GLOSS;
    if (q) list = GLOSS.filter(function (t) { return scoreDance(q, t) > 0 || norm(t.definition).indexOf(norm(q)) >= 0; });
    var grid = $("#glo-grid");
    grid.innerHTML = list.map(function (t) {
      return '<button class="dcard" data-glo="' + t.id + '"><div class="thumb" data-thumb="' + t.id + '"></div>' +
        '<div class="body"><div class="nm">' + esc(t.name) + '</div><div class="meta">' + t.counts + ' counts · tap to watch</div></div></button>';
    }).join('');
    mountThumbs(grid);
    $$("[data-glo]", grid).forEach(function (el) { el.onclick = function () { openPlayer(byId[el.dataset.glo], "glossary"); }; });
  }
  $("#glo-search").addEventListener("input", function () { if (current === "glossary") renderGlossary(); });

  /* ---------------- SONG PREVIEWS (iTunes Search API, 30-sec clip, JSONP -> no CORS) ----------------
     For song RECOGNITION only — the variable-tempo practice still runs on the synth count track.
     JSONP (script + callback) works in the Capacitor webview without CORS issues. Graceful when
     no preview is found: keep the Apple Music / Spotify "open full song" deep links. */
  var Preview = (function () {
    var audio = null, current = null, cache = {};                 // cache term -> previewUrl | null
    function jsonp(term) {
      return new Promise(function (resolve) {
        var cb = "__it" + Math.random().toString(36).slice(2), s = document.createElement("script"), done = false;
        window[cb] = function (d) { done = true; var t = d && d.results && d.results[0]; cleanup(); resolve(t && t.previewUrl ? t.previewUrl : null); };
        function cleanup() { try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); clearTimeout(to); }
        var to = setTimeout(function () { if (!done) { cleanup(); resolve(null); } }, 7000);
        s.onerror = function () { if (!done) { cleanup(); resolve(null); } };
        s.src = "https://itunes.apple.com/search?media=music&entity=song&limit=1&callback=" + cb + "&term=" + encodeURIComponent(term);
        document.head.appendChild(s);
      });
    }
    function ensureAudio() {
      if (!audio) { audio = new Audio(); audio.preload = "none";
        audio.addEventListener("ended", function () { setBtn(current, "idle"); current = null; });
        audio.addEventListener("error", function () { if (current) { setBtn(current, "error"); current = null; } });
      }
      return audio;
    }
    function setBtn(id, state) {
      var b = document.querySelector('[data-prev="' + id + '"]'); if (!b) return;
      b.classList.toggle("playing", state === "playing");
      b.textContent = state === "loading" ? "…" : state === "playing" ? "❚❚ Preview" : state === "error" ? "no preview" : "▶ Preview";
      b.disabled = state === "error";
    }
    function toggle(id, term) {
      ensureAudio();
      if (current === id && !audio.paused) { audio.pause(); setBtn(id, "idle"); current = null; return; }
      if (current && current !== id) { audio.pause(); setBtn(current, "idle"); }
      setBtn(id, "loading");
      var go = function (url) {
        if (!url) { setBtn(id, "error"); current = null; toast("No 30-sec preview for that one — try “open full song.”"); return; }
        audio.src = url; current = id;
        var p = audio.play();
        if (p && p.then) p.then(function () { setBtn(id, "playing"); }).catch(function () { setBtn(id, "error"); current = null; });
        else setBtn(id, "playing");
      };
      if (cache[term] !== undefined) go(cache[term]);
      else jsonp(term).then(function (url) { cache[term] = url; go(url); });
    }
    function stopAll() { if (audio && !audio.paused) audio.pause(); if (current) { setBtn(current, "idle"); current = null; } }
    return { toggle: toggle, stopAll: stopAll };
  })();
  window.SS_Preview = Preview;   // exposed for the headless test

  /* ---------------- DANCE DETAIL ---------------- */
  var heroEngine = null;
  function openDetail(id) {
    var d = byId[id]; if (!d) return;
    var v = $("#view-detail");
    var locked = window.Monetize.enabled() && !window.Monetize.isUnlocked(d);
    var songHtml = (d.songs || []).map(function (s, i) {
      var pid = d.id + "_" + i;
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--line)">' +
        '<div style="min-width:0"><b style="font-weight:800">' + esc(s.title) + '</b>' +
        '<div class="p">' + esc(s.artist) + ' · <a href="' + s.apple + '" target="_blank" rel="noopener" style="color:var(--amber-bright);font-weight:700">Apple Music</a> · <a href="' + s.spotify + '" target="_blank" rel="noopener" style="color:var(--muted);font-weight:700">Spotify</a></div></div>' +
        '<button class="chip prevbtn" data-prev="' + pid + '" data-term="' + esc(s.title + " " + s.artist) + '" aria-label="Play 30-second preview of ' + esc(s.title) + '">▶ Preview</button>' +
        '</div>';
    }).join('');
    var mastery = S.mastery[d.id] || null, dl = !!S.downloaded[d.id], want = !!S.want[d.id];
    var html = '';
    html += '<div class="vhead"><button class="iconbtn" id="d-back" aria-label="Back">‹</button>' +
      '<button class="iconbtn" id="d-share" aria-label="Share cheat sheet">⤴️</button></div>';
    html += '<div class="stage" style="max-height:none;aspect-ratio:1/1;margin-bottom:14px"><canvas id="d-hero"></canvas>' +
      '<div class="compass"><span class="dot"></span><span id="d-wall">Front wall</span></div></div>';
    html += '<div class="vtitle">' + esc(d.name) + '</div>';
    html += '<div class="chips" style="margin:8px 0 4px">' +
      '<span class="chip amber">' + d.counts + ' counts</span>' +
      '<span class="chip">' + d.walls + ' wall' + (d.walls > 1 ? 's' : '') + '</span>' +
      '<span class="chip">' + boots(d.difficulty) + '</span>' +
      (d.famous ? '<span class="chip amber">Famous</span>' : '') + '</div>';
    html += '<div class="chips" style="margin-bottom:10px">' + (d.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>';
    if (d.definition) html += '<div class="p" style="margin-bottom:12px">' + esc(d.definition) + '</div>';
    html += '<div class="p" style="margin-bottom:14px">Choreography: ' + esc(d.choreographer_credit) + '. Songs referenced for practice only — we play an original count track, never the record.</div>';
    if (locked) {
      html += '<div class="card spotlight"><div class="eyebrow">ScootSteps Pro</div><div class="h2">Unlock the full catalog</div><div class="p">This one\'s part of Pro. Your 5 free dances (including Cupid Shuffle and the Wobble) are always open.</div><div style="margin-top:12px"><button class="btn primary" id="d-unlock">See Pro</button></div></div>';
    } else {
      html += '<button class="btn primary" id="d-learn" style="margin-bottom:10px">🎓 Start learning</button>';
      html += '<div class="prow" style="display:flex;gap:10px;margin-bottom:10px">' +
        '<button class="btn" id="d-watch">▶ Watch full</button>' +
        '<button class="btn' + (dl ? ' good' : '') + '" id="d-dl">' + (dl ? '✓ Saved offline' : '⬇ Save offline') + '</button></div>';
    }
    html += '<div class="eyebrow" style="margin:16px 0 6px">How well do you know it?</div>';
    html += '<div class="seg" id="d-mastery">' +
      ['want|Want to learn', 'learning|Learning', 'can-follow|Can follow', 'know-it|Know it cold'].map(function (o) { var k = o.split('|'); return '<button data-m="' + k[0] + '"' + ((mastery === k[0] || (k[0] === 'want' && want && !mastery)) ? ' class="on"' : '') + '>' + k[1] + '</button>'; }).join('') + '</div>';
    if (songHtml) html += '<div class="eyebrow" style="margin:18px 0 2px">Danced to</div>' + songHtml;
    v.innerHTML = html;
    showView("detail");
    // hero engine
    if (heroEngine) heroEngine.destroy();
    var hero = $("#d-hero");
    heroEngine = window.ScootEngine.create(hero, { colors: COLORS, getSettings: function () { return S.settings; },
      onWall: function (i, label) { var e = $("#d-wall"); if (e) e.textContent = label; } });
    heroEngine.load(d); heroEngine.setMute(true); setTimeout(function () { heroEngine.ensureAudio(); heroEngine.setMute(true); heroEngine.play(); }, 60);
    // wire
    $("#d-back").onclick = function () { Preview.stopAll(); if (heroEngine) { heroEngine.destroy(); heroEngine = null; } showView(lastTab); };
    $$("[data-prev]", v).forEach(function (b) { b.onclick = function () { Preview.toggle(b.dataset.prev, b.dataset.term); }; });
    $("#d-share").onclick = function () { exportCheatSheet(d); };
    var un = $("#d-unlock"); if (un) un.onclick = openPaywall;
    var lb = $("#d-learn"); if (lb) lb.onclick = function () { openPlayer(d, "learn"); };
    var wb = $("#d-watch"); if (wb) wb.onclick = function () { openPlayer(d, "watch"); };
    var db = $("#d-dl"); if (db) db.onclick = function () { S.downloaded[d.id] = !S.downloaded[d.id]; save(); toast(S.downloaded[d.id] ? "Saved for the bar — works with no signal." : "Removed from offline."); openDetail(d.id); };
    $$("#d-mastery [data-m]").forEach(function (b) { b.onclick = function () { setMastery(d.id, b.dataset.m); $$("#d-mastery [data-m]").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); toast("Marked: " + b.textContent); }; });
  }
  function setMastery(id, m) { if (m === "want") { S.want[id] = true; delete S.mastery[id]; } else { S.mastery[id] = m; delete S.want[id]; } save(); }

  /* ---------------- PLAYER ---------------- */
  var eng = null, playerDance = null, playerMode = "watch", chunkIdx = 0, ghostOn = true, loopOn = true, chunkPlaying = false, sessionCompleted = false;
  function ensureEngine() {
    if (eng) return eng;
    eng = window.ScootEngine.create($("#p-canvas"), {
      colors: COLORS, getSettings: function () { return S.settings; }, haptic: nativeHaptic,
      onLap: function () { onDanceComplete(); },
      onCount: function (count, phrase, ev) {
        $("#p-count").textContent = count;
        var t = instrText(ev); $("#p-instr").textContent = t.main || "…"; $("#p-instr2").textContent = t.sub || "";
        $("#p-phrase").textContent = phrase ? phrase.label.replace(/^Counts \d+.\d+:\s*/, "") : "";
        $$("#p-ribbon .rc").forEach(function (el, i) { el.classList.toggle("active", i === (count - 1) % 8); });
        if (playerMode === "learn") { var c = Math.ceil(count / 8); if (c !== chunkIdx + 1) {} }
      },
      onWall: function (i, label) { $("#p-wall").textContent = label; },
      onCue: function (txt, show) { var c = $("#p-cue"); if (show) { c.textContent = txt; c.classList.add("show"); } else c.classList.remove("show"); },
      onComplete: function () { onDanceComplete(); }
    });
    return eng;
  }
  function buildRibbon() { var r = $("#p-ribbon"); r.innerHTML = ""; for (var i = 1; i <= 8; i++) { var d = document.createElement("div"); d.className = "rc b1"; d.textContent = i; r.appendChild(d); } }
  function openPlayer(d, mode) {
    try { if (window.SS_Preview) window.SS_Preview.stopAll(); } catch (e) {}
    playerDance = d; playerMode = mode === "learn" ? "learn" : "watch"; chunkIdx = 0; sessionCompleted = false; chunkPlaying = false;
    $("#player").classList.add("on");
    $("#p-name").textContent = d.name + (d.glossary ? " · basic" : "");
    $("#p-credit").textContent = d.glossary ? (d.definition ? d.definition.slice(0, 60) + "…" : "") : d.choreographer_credit;
    $("#p-canvas").setAttribute("aria-label", "Top-down animation of two boots for " + d.name + ", " + d.counts + " counts, " + d.walls + " walls");
    buildRibbon();
    ensureEngine(); eng.load(d);
    // tempo range per tier
    var tr = window.Monetize.tempoRange(), tempo = $("#p-tempo");
    tempo.min = tr[0]; tempo.max = tr[1]; if (+tempo.value < tr[0]) tempo.value = tr[0]; if (+tempo.value > tr[1]) tempo.value = tr[1];
    $("#p-tempolock").classList.toggle("hide", !(window.Monetize.enabled() && !window.Monetize.hasPro()));
    setTempoUI(+tempo.value);
    setPlayerMode(mode === "glossary" ? "watch" : playerMode, d.glossary);
    if (d.glossary) { $("#p-mode-watch").parentNode.classList.add("hide"); } else { $("#p-mode-watch").parentNode.classList.remove("hide"); }
    // autostart for watch/glossary
    setTimeout(function () { eng.ensureAudio(); if (playerMode !== "learn") { eng.play(); $("#p-play").textContent = "❚❚ Pause"; } }, 60);
  }
  function closePlayer() { if (eng) eng.pause(); $("#player").classList.remove("on"); }
  function setPlayerMode(mode, isGlossary) {
    playerMode = mode;
    $("#p-mode-watch").classList.toggle("on", mode === "watch"); $("#p-mode-learn").classList.toggle("on", mode === "learn");
    $("#ctl-watch").classList.toggle("hide", mode !== "watch");
    $("#ctl-learn").classList.toggle("hide", mode !== "learn");
    if (mode === "learn") {
      eng.pause(); eng.setGhost(ghostOn); eng.setStepMode(true);
      $("#p-loop").classList.toggle("on", loopOn); $("#p-loop").textContent = "🔁 Loop chunk: " + (loopOn ? "On" : "Off");
      $("#p-ghost").classList.toggle("on", ghostOn); $("#p-ghost").textContent = "👣 Ghost path: " + (ghostOn ? "On" : "Off");
      gotoChunk(0); $("#p-play").textContent = "▶ Play";
    } else { eng.setStepMode(false); eng.setLoop(null); }
  }
  function setTempoUI(v) { $("#p-tempoval").textContent = v + "%"; $("#p-bpm").textContent = Math.round((playerDance.bpm || 96) * v / 100) + " BPM"; eng.setTempo(v); }
  function chunkBounds() { var s = chunkIdx * 8 + 1, e = Math.min(playerDance.counts, s + 7); return [s, e]; }
  function gotoChunk(i) {
    var maxChunk = Math.ceil(playerDance.counts / 8) - 1; chunkIdx = Math.max(0, Math.min(maxChunk, i));
    chunkPlaying = false; $("#p-step-play").textContent = "▶ Play chunk";
    var b = chunkBounds(), s = b[0], e = b[1];
    $("#p-chunklabel").textContent = "Counts " + s + "–" + e;
    eng.setStepMode(true);
    if (loopOn) eng.setLoop(s, e); else eng.setLoop(null);
    eng.stepTo(s);
    $$("#p-ribbon .rc").forEach(function (el, idx) { el.classList.add("insel"); el.textContent = ((s - 1 + idx) % 8) + 1; });
  }
  function onDanceComplete() {
    if (sessionCompleted) return; sessionCompleted = true;
    $("#p-play").textContent = "▶ Play";
    bumpStreak(); celebrate();
    if (!S.mastery[playerDance.id] || S.mastery[playerDance.id] === "learning") toast("Nailed it. " + playerDance.name + " fears you now.");
    S.history.unshift({ id: playerDance.id, at: Date.now() }); S.history = S.history.slice(0, 40); save();
  }
  // player controls
  $("#p-close").onclick = closePlayer;
  $("#p-mode-watch").onclick = function () { setPlayerMode("watch"); };
  $("#p-mode-learn").onclick = function () { setPlayerMode("learn"); };
  $("#p-play").onclick = function () { eng.toggle(); $("#p-play").textContent = eng.playing ? "❚❚ Pause" : "▶ Play"; };
  $("#p-restart").onclick = function () { eng.restart(); };
  $("#p-mirror").onclick = function () { eng.setMirror(!eng.mirror); $("#p-mirror").classList.toggle("on", eng.mirror); toast(eng.mirror ? "Mirror: facing you" : "Mirror: over the shoulder"); };
  $("#p-rotate").onclick = function () { var on = !$("#p-rotate").classList.contains("on"); $("#p-rotate").classList.toggle("on", on); eng.setFullRotation(on); eng.restart(); if (on) { eng.play(); $("#p-play").textContent = "❚❚ Pause"; } toast(on ? "Full rotation — through all " + playerDance.walls + " walls" : "Loop mode"); };
  $("#p-tempo").addEventListener("input", function () { setTempoUI(+this.value); });
  $("#p-step-play").onclick = function () { // drill: loop-play the current 8-count chunk
    var b = chunkBounds();
    if (!chunkPlaying) {
      eng.setStepMode(false); eng.setLoop(b[0], b[1]); eng.restart(); eng.ensureAudio(); eng.play();
      chunkPlaying = true; $("#p-step-play").textContent = "❚❚ Pause";
    } else {
      eng.pause(); eng.setStepMode(true); eng.stepTo(b[0]);
      chunkPlaying = false; $("#p-step-play").textContent = "▶ Play chunk";
    }
  };
  $("#p-next").onclick = function () { chunkPlaying = false; $("#p-step-play").textContent = "▶ Play chunk"; eng.setStepMode(true); eng.stepNext(); };
  $("#p-prev").onclick = function () { chunkPlaying = false; $("#p-step-play").textContent = "▶ Play chunk"; eng.setStepMode(true); eng.stepPrev(); };
  $("#p-chunknext").onclick = function () { gotoChunk(chunkIdx + 1); };
  $("#p-chunkprev").onclick = function () { gotoChunk(chunkIdx - 1); };
  $("#p-loop").onclick = function () { loopOn = !loopOn; $("#p-loop").classList.toggle("on", loopOn); $("#p-loop").textContent = "🔁 Loop chunk: " + (loopOn ? "On" : "Off"); gotoChunk(chunkIdx); };
  $("#p-ghost").onclick = function () { ghostOn = !ghostOn; $("#p-ghost").classList.toggle("on", ghostOn); $("#p-ghost").textContent = "👣 Ghost path: " + (ghostOn ? "On" : "Off"); eng.setGhost(ghostOn); };

  /* ---------------- ONBOARDING (Panic Mode) ---------------- */
  var obChoice = { when: null, exp: null };
  function openOnboarding() {
    obChoice = { when: null, exp: null };
    renderOnboard(1); $("#onboarding").classList.add("on");
  }
  function renderOnboard(step) {
    var o = $("#onboarding"), html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div class="eyebrow">ScootSteps</div><button class="btn ghost sm" id="ob-skip">Skip</button></div>';
    if (step === 1) {
      html += '<div class="vtitle" style="margin-bottom:4px">When do you need to dance?</div><div class="vsub" style="margin-bottom:18px">No judgment. We\'ve all been the person on the wall.</div>';
      html += [['tonight', '😰', 'Tonight', 'A few hours. Let\'s get you two dances, fast.'],
        ['week', '📅', 'This week', 'A wedding or a bar night coming. We\'ll pace it.'],
        ['norush', '🌵', 'No rush', 'Just want to get good. Start from the basics.']].map(function (c) {
        return '<button class="ob-choice' + (obChoice.when === c[0] ? ' sel' : '') + '" data-when="' + c[0] + '"><span class="em">' + c[1] + '</span><span><b>' + c[2] + '</b><span>' + c[3] + '</span></span></button>';
      }).join('');
    } else {
      html += '<div class="vtitle" style="margin-bottom:4px">Have you line danced before?</div><div class="vsub" style="margin-bottom:18px">Sets your starting speed.</div>';
      html += [['never', '🐣', 'Never', 'Total beginner. We start slow.'],
        ['some', '🙂', 'A little', 'Been to a class or two.'],
        ['yes', '🤠', 'I dance', 'Just need a quick reference.']].map(function (c) {
        return '<button class="ob-choice' + (obChoice.exp === c[0] ? ' sel' : '') + '" data-exp="' + c[0] + '"><span class="em">' + c[1] + '</span><span><b>' + c[2] + '</b><span>' + c[3] + '</span></span></button>';
      }).join('');
      html += '<button class="btn primary" id="ob-finish" style="margin-top:10px"' + (obChoice.exp ? '' : ' disabled') + '>Build my plan</button>';
    }
    o.innerHTML = html;
    $("#ob-skip").onclick = function () { S.onboarded = true; save(); $("#onboarding").classList.remove("on"); showView("home"); };
    $$("[data-when]", o).forEach(function (b) { b.onclick = function () { obChoice.when = b.dataset.when; renderOnboard(2); }; });
    $$("[data-exp]", o).forEach(function (b) { b.onclick = function () { obChoice.exp = b.dataset.exp; renderOnboard(2); }; });
    var fin = $("#ob-finish"); if (fin) fin.onclick = function () { buildPlan(); $("#onboarding").classList.remove("on"); showView("home"); toast("Plan ready. You've got this."); };
  }
  function buildPlan() {
    var when = obChoice.when, ids, label, headline, days;
    if (when === "tonight") { ids = ["cupid-shuffle", "the-wobble"]; label = "Tonight"; headline = "Two crowd dances by the first song"; days = 1; }
    else if (when === "week") { ids = ["cupid-shuffle", "the-wobble", "cha-cha-starter", "prairie-strut"]; label = "This week"; headline = "Wedding-ready in a few sessions"; days = 5; }
    else { ids = ["grapevine-groove", "prairie-strut", "jazz-box-jamboree"]; label = "No rush"; headline = "Master the basics, one vine at a time"; days = 14; }
    if (obChoice.exp === "yes") ids = ids.reverse();
    S.plan = { mode: when, label: label, headline: headline, dance_ids: ids, deadline: Date.now() + days * 864e5, daily_targets: Math.max(1, Math.ceil(ids.length / Math.min(days, 3))) };
    S.onboarded = true; save();
  }

  /* ---------------- PAYWALL ---------------- */
  function openPaywall() {
    var o = $("#paywall"), M = window.Monetize;
    var feats = [['Full catalog', 'All 40+ dances, not just the free 5'], ['Offline downloads', 'Works with no signal — the bar has none'], ['Section looping', 'Drill counts 17–24 till it sticks'], ['Every learn path', 'Panic-mode plans and packs'], ['Cheat-sheet export', 'A printable step sheet for your pocket']];
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div class="eyebrow">ScootSteps Pro</div><button class="btn ghost sm" id="pw-close">✕</button></div>';
    html += '<div class="vtitle" style="margin-bottom:6px">Never sit one out again</div>';
    html += '<div class="vsub" style="margin-bottom:18px">Your 5 free dances stay free forever. Pro opens the rest.</div>';
    html += feats.map(function (f) { return '<div class="paywall-feat"><span class="k">✓</span><span><b>' + f[0] + '</b><span>' + f[1] + '</span></span></div>'; }).join('');
    if (M.enabled()) {
      html += '<div style="margin-top:8px">' +
        '<button class="price-opt best" data-buy="yearly"><span><b>Yearly · ' + M.priceOf('yearly') + '</b><small>Best value — under $2.50/mo</small></span><span class="chip amber">Save</span></button>' +
        '<button class="price-opt" data-buy="monthly"><span><b>Monthly · ' + M.priceOf('monthly') + '</b><small>Cancel anytime</small></span></button>' +
        '<button class="price-opt" data-buy="lifetime"><span><b>Lifetime · ' + M.priceOf('lifetime') + '</b><small>Pay once, yours forever</small></span></button></div>';
      html += '<button class="btn ghost sm" id="pw-restore" style="margin:10px auto 0">Restore purchases</button>';
    } else {
      html += '<div class="card spotlight" style="margin-top:10px"><div class="h2">Everything\'s unlocked 🎉</div><div class="p">This early TestFlight build is fully free — every dance, every tempo, every path. Pricing turns on in a later build ($6.99/mo · $29.99/yr · $59.99 lifetime). For now: go dance.</div></div>';
    }
    o.innerHTML = html; o.classList.add("on");
    $("#pw-close").onclick = function () { o.classList.remove("on"); };
    var rb = $("#pw-restore"); if (rb) rb.onclick = function () { M.restore(); toast("Checking for past purchases…"); };
    $$("[data-buy]", o).forEach(function (b) { b.onclick = function () { var okd = M.buy(b.dataset.buy); if (!okd) toast("Store isn't ready yet — try again in a moment."); }; });
  }

  /* ---------------- MY DANCES ---------------- */
  function renderMyDances() {
    var v = $("#view-mydances");
    var shelves = [['want', 'Want to learn'], ['learning', 'Learning'], ['can-follow', 'Can follow'], ['know-it', 'Know it cold']];
    var html = '<div class="vhead"><div><div class="vtitle">My Dances</div><div class="vsub">Your shelf. Your streak. Your night.</div></div></div>';
    html += '<div class="statrow"><div class="stat"><b>' + S.streak.count + '</b><span>day streak</span></div>' +
      '<div class="stat"><b>' + S.history.length + '</b><span>practices</span></div>' +
      '<div class="stat"><b>' + Object.keys(S.downloaded).filter(function (k) { return S.downloaded[k]; }).length + '</b><span>offline</span></div></div>';
    var any = false;
    shelves.forEach(function (sh) {
      var ids = DANCES.concat(GLOSS).filter(function (d) { return sh[0] === 'want' ? S.want[d.id] : S.mastery[d.id] === sh[0]; });
      if (!ids.length) return; any = true;
      html += '<div class="eyebrow" style="margin:16px 0 8px">' + sh[1] + ' · ' + ids.length + '</div><div class="grid">' + ids.map(danceCard).join('') + '</div>';
    });
    if (!any) html += '<div class="card"><div class="h2">Nothing here yet</div><div class="p">Open a dance and mark how well you know it — it\'ll land here. Or hit Tonight and let us build you a plan.</div><div style="margin-top:12px"><button class="btn primary" id="md-go">Find a dance</button></div></div>';
    v.innerHTML = html;
    mountThumbs(v); $$("[data-open]", v).forEach(function (el) { el.onclick = function () { openDetail(el.dataset.open); }; });
    var g = $("#md-go"); if (g) g.onclick = function () { showView("library"); };
  }

  /* ---------------- SETTINGS ---------------- */
  function renderSettings() {
    var v = $("#view-settings"), s = S.settings;
    function toggle(id, on, label, sub) { return '<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><b style="font-weight:800">' + label + '</b><div class="p">' + sub + '</div></div><button class="chip ' + (on ? 'on' : '') + '" data-tog="' + id + '">' + (on ? 'On' : 'Off') + '</button></div>'; }
    var html = '<div class="vhead"><button class="iconbtn" id="set-back">‹</button><div class="vtitle" style="font-size:22px">Settings</div><span style="width:42px"></span></div>';
    html += '<div class="eyebrow" style="margin:6px 0 8px">Count track</div>';
    html += '<div class="card"><b style="font-weight:800">Count sound</b><div class="seg" style="margin-top:10px" id="set-count"><button data-cs="click"' + (s.countStyle === 'click' ? ' class="on"' : '') + '>Click</button><button data-cs="woodblock"' + (s.countStyle === 'woodblock' ? ' class="on"' : '') + '>Woodblock</button></div></div>';
    html += toggle('haptics', s.haptics, 'Haptic counts', 'Feel every beat — great when the room is loud.');
    html += '<div class="eyebrow" style="margin:16px 0 8px">Comfort</div>';
    html += '<div class="card"><b style="font-weight:800">Text size</b><div class="p" style="margin:2px 0 6px">Bigger type across the whole app.</div><input type="range" id="set-text" min="0.9" max="1.35" step="0.05" value="' + (s.textScale || 1) + '" aria-label="Text size"></div>';
    html += '<div class="eyebrow" style="margin:16px 0 8px">ScootSteps Pro</div>';
    html += '<div class="card"><b style="font-weight:800">Membership</b><div class="p">' + (window.Monetize.hasPro() ? 'Pro is active. Thank you!' : 'Free — 5 dances, all basics, and (right now) everything else too.') + '</div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn sm" id="set-pro">See Pro</button><button class="btn sm ghost" id="set-restore">Restore</button></div></div>';
    html += '<div class="p" style="text-align:center;margin-top:18px;line-height:1.6">ScootSteps ' + '· learn to line dance<br>Made with real boots. Support: jonathanbbiles@gmail.com</div>';
    v.innerHTML = html;
    $("#set-back").onclick = function () { showView("home"); };
    $$("#set-count [data-cs]").forEach(function (b) { b.onclick = function () { s.countStyle = b.dataset.cs; save(); renderSettings(); }; });
    $$("[data-tog]").forEach(function (b) { b.onclick = function () { s[b.dataset.tog] = !s[b.dataset.tog]; save(); renderSettings(); }; });
    $("#set-text").addEventListener("input", function () { s.textScale = +this.value; applyTextScale(); save(); });
    $("#set-pro").onclick = openPaywall;
    $("#set-restore").onclick = function () { window.Monetize.restore(); toast("Checking for past purchases…"); };
  }
  function applyOrientation() { /* orientation lock is applied natively via Capacitor config; portrait is default */ }

  /* ---------------- streak + celebration ---------------- */
  function bumpStreak() {
    var today = new Date().toDateString(), last = S.streak.last;
    if (last === today) return;
    var y = new Date(Date.now() - 864e5).toDateString();
    S.streak.count = (last === y) ? S.streak.count + 1 : 1; S.streak.last = today; save();
  }
  function nativeHaptic(accent) {
    try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) { window.Capacitor.Plugins.Haptics.impact({ style: accent ? "MEDIUM" : "LIGHT" }); return; } } catch (e) {}
    if (navigator.vibrate) { try { navigator.vibrate(accent ? 26 : 10); } catch (e) {} }
  }
  function celebrate() {
    try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
    var cv = $("#celebrate"); cv.width = innerWidth; cv.height = innerHeight; cv.classList.add("on");
    var ctx = cv.getContext("2d"), parts = [], cols = ["#EAD8FF", "#F2A24E", "#2BB3A3", "#E4574F", "#FAF5EC"];
    for (var i = 0; i < 90; i++) parts.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .3, vy: 2 + Math.random() * 4, vx: (Math.random() - .5) * 2, s: 4 + Math.random() * 5, c: cols[i % cols.length], r: Math.random() * 6 });
    var t0 = Date.now();
    (function loop() {
      var el = Date.now() - t0; ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el / 2000); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); });
      if (el < 2000) requestAnimationFrame(loop); else cv.classList.remove("on");
    })();
    cv.onclick = function () { cv.classList.remove("on"); };
  }

  /* ---------------- cheat-sheet export ---------------- */
  function exportCheatSheet(d) {
    var W = 900, rowH = 46, top = 250, H = top + (d.events.length) * 0 + (d.phrases.length * 40) + d.counts * 34 + 120;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var ctx = cv.getContext("2d");
    ctx.fillStyle = "#1F3A5F"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#D97B29"; ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = "#FAF5EC"; ctx.font = "900 46px sans-serif"; ctx.fillText(d.name, 40, 90);
    ctx.fillStyle = "#F2A24E"; ctx.font = "800 22px sans-serif"; ctx.fillText(d.counts + " counts · " + d.walls + " wall" + (d.walls > 1 ? "s" : "") + " · difficulty " + d.difficulty + "/5", 40, 128);
    ctx.fillStyle = "rgba(250,245,236,.7)"; ctx.font = "600 18px sans-serif"; ctx.fillText("Choreography: " + d.choreographer_credit, 40, 158);
    if (d.songs && d.songs[0]) ctx.fillText("Danced to: " + d.songs.map(function (s) { return s.title; }).join(", "), 40, 184);
    var y = top;
    var perCount = {}; d.events.forEach(function (e) { perCount[e.count] = e; });
    d.phrases.forEach(function (p) {
      ctx.fillStyle = "#D97B29"; ctx.font = "900 22px sans-serif"; ctx.fillText(p.label, 40, y); y += 34;
      for (var c = p.counts_start; c <= p.counts_end; c++) {
        var ev = perCount[c]; if (!ev) continue;
        var t = instrText(ev);
        ctx.fillStyle = "#F2A24E"; ctx.font = "900 20px sans-serif"; ctx.fillText(String(c), 56, y);
        ctx.fillStyle = "#FAF5EC"; ctx.font = "600 20px sans-serif"; ctx.fillText(t.main + (ev.styling_note ? "  (" + ev.styling_note + ")" : ""), 100, y);
        y += 32;
      }
      y += 8;
    });
    ctx.fillStyle = "rgba(250,245,236,.55)"; ctx.font = "700 18px sans-serif"; ctx.fillText("Made with ScootSteps — learn to line dance", 40, H - 40);
    var url = cv.toDataURL("image/png");
    showCheatModal(d, url);
  }
  function showCheatModal(d, url) {
    var o = document.createElement("div"); o.className = "overlay on"; o.style.zIndex = 90;
    o.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="eyebrow">Cheat sheet</div><button class="btn ghost sm" id="cs-x">✕</button></div>' +
      '<div class="p" style="margin-bottom:12px">Your pocket step sheet for <b>' + esc(d.name) + '</b>. Save it or share it.</div>' +
      '<img src="' + url + '" style="width:100%;border-radius:12px;border:1px solid var(--line-2)"/>' +
      '<a class="btn primary" style="margin-top:14px" href="' + url + '" download="scootsteps-' + d.id + '.png">⬇ Save image</a>' +
      '<button class="btn ghost" id="cs-share" style="margin-top:8px">⤴️ Share</button>';
    document.body.appendChild(o);
    $("#cs-x", o).onclick = function () { o.remove(); };
    $("#cs-share", o).onclick = function () {
      try {
        fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
          var file = new File([b], "scootsteps-" + d.id + ".png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: d.name + " — ScootSteps" });
          else toast("Long-press the image to save it.");
        });
      } catch (e) { toast("Long-press the image to save it."); }
    };
  }

  /* ---------------- boot ---------------- */
  window.Monetize.init(); window.Monetize.onChange(function () { if (current === "detail") { } });
  applyTextScale();
  document.addEventListener("DOMContentLoaded", start);
  if (document.readyState !== "loading") start();
  var started = false;
  function start() {
    if (started) return; started = true;
    showView("home");
    if (!S.onboarded) setTimeout(openOnboarding, 350);
  }
})();
