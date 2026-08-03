/* ============================================================================
   ScootSteps — APP  (router, screens, player wiring, Learn Paths, state)
   Offline-first: all content is bundled JS; state persists in localStorage
   (works in the Capacitor webview). Every control does its real thing.
   Build 1 ships with NO in-app purchase: no purchase screen, no product IDs,
   no Restore control, nothing locked. See docs/build2-monetization/.
   ============================================================================ */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DANCES = window.SS_DANCES, GLOSS = window.SS_GLOSSARY;
  // The single page that serves as both the Privacy Policy URL and the Support URL in App Store
  // Connect. It must be live BEFORE submit — a 404 here is an automatic reject.
  // jonathanscribbles.com is WordPress on WP Engine, so /scootstep can only be created by hand in
  // WP; this points at the GitHub Pages privacy site instead (same repo that serves Bull or Bust),
  // which is version-controlled and goes live with one push. Source: app-privacy/scootstep.html.
  var PRIVACY_URL = "https://jonathanbbiles.github.io/app-privacy/scootstep.html";
  var byId = {}; DANCES.concat(GLOSS).forEach(function (d) { byId[d.id] = d; });

  /* ---------------- persistent state ---------------- */
  var DEFAULT = { onboarded: false, plan: null, mastery: {}, want: {},
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
    // Leaving Dance Detail used to leave its hero engine running a requestAnimationFrame loop on
    // a canvas nobody can see — forever, burning frames and battery behind every other screen.
    if (current === "detail" && id !== "detail" && heroEngine) { try { heroEngine.destroy(); } catch (e) {} heroEngine = null; }
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
    // A visible way out to Jonathan's site from the FIRST screen — it used to exist only inside
    // Settings, behind the gear icon, where it was reported as "no link anywhere".
    html += '<button class="btn ghost" id="home-web" style="margin-top:14px">🌵 More from Jonathan — jonathanscribbles.com ↗</button>';
    v.innerHTML = html;
    // wire
    $("#home-settings").onclick = function () { showView("settings"); };
    var ob = $("#open-onboard"); if (ob) ob.onclick = openOnboarding;
    var ps = $("#plan-start"); if (ps) ps.onclick = function () { openDetail(plan.dance_ids[0]); };
    $("#go-library").onclick = function () { showView("library"); };
    $("#go-basics").onclick = function () { showView("glossary"); };
    $("#home-web").onclick = function () { openExternal("https://jonathanscribbles.com"); };
    mountThumbs(v);
    $$("[data-open]", v).forEach(function (el) { el.onclick = function () { openDetail(el.dataset.open); }; });
  }

  function danceCardWide(d) {
    return '<button class="dcard wide" data-open="' + d.id + '">' +
      '<div class="thumb" data-thumb="' + d.id + '">' + (d.famous ? '<span class="pin">📌</span>' : '') + '</div>' +
      '<div class="body"><div class="nm">' + esc(d.name) + '</div>' +
      '<div class="meta">' + d.counts + ' counts · ' + d.walls + ' wall' + (d.walls > 1 ? 's' : '') + '</div>' +
      '<div class="meta boots">' + boots(d.difficulty) + '</div>' +
      '<div class="chips" style="margin-top:7px">' + d.tags.slice(0, 2).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div></button>';
  }
  function danceCard(d) {
    return '<button class="dcard" data-open="' + d.id + '">' +
      '<div class="thumb" data-thumb="' + d.id + '">' + (d.famous ? '<span class="pin">📌</span>' : '') + '</div>' +
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
    var audio = null, current = null, cache = {};                 // cache term -> {preview,view} | null

    // Result matching lives in js/itunes-match.js so it can be unit-tested against the live API.
    var pick = window.SS_iTunesMatch.pick;

    /* WHY THIS IS NOT JSONP ANY MORE
       ------------------------------
       The old comment here claimed iTunes Search sends no Access-Control-Allow-Origin, so a script
       tag was the only cross-origin path. What it actually does is worse than either: the header
       is INCONSISTENT. Measured minutes apart on the same URL, one response came back with
       `access-control-allow-origin: capacitor://localhost` and the next came back with none — it
       is served through Akamai, and whether the CORS header survives depends on which edge node
       answers and whether it is a cache hit. A browser-enforced fetch() against that is a coin
       flip, which is its own way to produce previews that work sometimes.

       So this does not rely on CORS at all. CapacitorHttp is enabled in capacitor.config.json,
       which routes fetch() through native URLSession on device — no CORS enforcement, because
       there is no browser in the path. jsonpGet stays as the fallback for a plain browser, where
       the script tag is still immune to CORS.

       The reason it MATTERS is diagnosis. A script tag reports exactly one thing: "the browser
       could not run this". Apple rate-limits this endpoint (roughly 20 requests a minute) and
       answers a burst with a 403 whose body is not JSONP — that body would parse as a syntax
       error, which does NOT fire script.onerror, so the old code just sat there until its 8-second
       timeout and reported the same "Couldn't reach the preview service" it reported for a dead
       network, a bad song title, and everything else. Every failure looked identical, which is why
       this went unexplained for so long. fetch() gives us the status code. */
    var ENDPOINT = "https://itunes.apple.com/search?media=music&entity=song&country=US&limit=25&term=";
    var TIMEOUT_MS = 9000;

    // AbortSignal.timeout() is iOS 16+; build it by hand so older phones aren't left without one.
    function httpGet(url, impl) {
      var doFetch = impl || (typeof fetch === "function" ? fetch : null);
      if (!doFetch) return Promise.resolve({ reason: "no-fetch" });
      return new Promise(function (done) {
        var ctl = null, killed = false;
        try { ctl = new AbortController(); } catch (e) {}
        var to = setTimeout(function () { killed = true; if (ctl) { try { ctl.abort(); } catch (e) {} } done({ reason: "timeout" }); }, TIMEOUT_MS);
        var opts = ctl ? { signal: ctl.signal } : {};
        var f;
        try { f = doFetch(url, opts); } catch (e) { clearTimeout(to); done({ reason: "no-fetch" }); return; }
        if (!f || !f.then) { clearTimeout(to); done({ reason: "no-fetch" }); return; }
        f.then(function (r) {
          if (killed) return;
          clearTimeout(to);
          if (!r.ok) { done({ reason: r.status === 403 || r.status === 429 ? "busy" : "http", status: r.status }); return; }
          // The endpoint answers text/javascript even without a callback, so ask for text and parse
          // it ourselves rather than letting response.json() decide based on the content type.
          r.text().then(function (t) {
            try { done({ data: JSON.parse(t) }); }
            catch (e) { done({ reason: "unparseable" }); }
          }, function () { done({ reason: "unparseable" }); });
        }, function () {
          if (killed) return;
          clearTimeout(to);
          done({ reason: "failed" });           // a rejected fetch proves nothing about the network
        });
      });
    }

    // Last resort for a plain browser whose origin the endpoint will not echo (and for anything
    // that leaves fetch unavailable). Same script-tag trick as before, kept deliberately small.
    function jsonpGet(url) {
      return new Promise(function (done) {
        var cb = "__it" + Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "") + (jsonpGet._n = (jsonpGet._n || 0) + 1);
        var s = document.createElement("script"), settled = false;
        function finish(v) { if (settled) return; settled = true; cleanup(); done(v); }
        function cleanup() { try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); clearTimeout(to); }
        window[cb] = function (d) { finish({ data: d }); };
        var to = setTimeout(function () { finish({ reason: "timeout" }); }, TIMEOUT_MS);
        s.onerror = function () { finish({ reason: "failed" }); };
        s.src = url.replace("&term=", "&callback=" + cb + "&term=");
        document.head.appendChild(s);
      });
    }

    /* THREE TRANSPORTS, TRIED IN ORDER — and "offline" is no longer the default excuse.
       Jonathan saw "No connection" on a live 5G connection. That message came from this code
       treating ANY rejected fetch as "no route to host", and with CapacitorHttp enabled a GET is
       not a plain fetch at all: the native bridge rewrites it to
       capacitor://localhost/_capacitor_http_interceptor_?u=… and lets the webview fetch THAT.
       If that interceptor path fails for any reason the promise rejects exactly like a dead
       network does, and the old code confidently blamed the network.

       So: try the patched fetch, then the ORIGINAL unpatched fetch that Capacitor stashes on
       window.CapacitorWebFetch (straight to Apple, no interceptor), then JSONP (a script tag,
       which no CORS policy and no interceptor can touch). Only if all three fail is this a
       network problem, and even then navigator.onLine gets the final say. */
    function search(term) {
      var url = ENDPOINT + encodeURIComponent(term);
      var tried = [];
      function viaDirect() {                                 // the pre-patch fetch, if it exists
        var raw = window.CapacitorWebFetch;
        if (typeof raw !== "function") return Promise.resolve({ reason: "no-fetch" });
        return httpGet(url, raw);
      }
      return httpGet(url).then(function (a) {
        if (a.data || a.reason === "busy" || a.reason === "http") return a;   // a real answer
        tried.push("proxy:" + a.reason);
        return viaDirect().then(function (b) {
          if (b.data || b.reason === "busy") return b;
          tried.push("direct:" + b.reason);
          return jsonpGet(url).then(function (c) {
            if (c.data) return c;
            tried.push("jsonp:" + c.reason);
            // Every transport failed. Now — and only now — is it fair to talk about the network,
            // and navigator.onLine decides, not a rejected promise.
            var online = (typeof navigator === "undefined") || navigator.onLine !== false;
            return { reason: online ? "unreachable" : "offline", tried: tried };
          });
        });
      });
    }

    // Apple rate-limits by IP, and opening a dance used to fire one lookup per song at once while
    // the player fired another. Two at a time, which is plenty to feel instant, and a burst can no
    // longer earn us a 403 that then breaks every other song on the screen.
    var running = 0, queue = [];
    function throttled(fn) {
      return new Promise(function (done) {
        queue.push(function () {
          running++;
          fn().then(function (v) { running--; pump(); done(v); },
                    function () { running--; pump(); done({ reason: "unreachable" }); });
        });
        pump();
      });
    }
    function pump() { while (running < 2 && queue.length) queue.shift()(); }

    // "Save a Horse (Ride a Cowboy)" and friends: the parenthetical is part of the title in our
    // catalog but not always in Apple's, so a miss on the full string is retried without it, then
    // on the bare title. A no-match is a real answer, not a network failure, and is reported as one.
    function terms(title, artist) {
      var bare = title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
      var out = [title + " " + artist];
      if (bare && bare !== title) out.push(bare + " " + artist);
      out.push(title);
      return out.filter(function (t, i, a) { return t && a.indexOf(t) === i; });
    }

    function lookup(title, artist) {                    // -> {hit} | {reason}
      var list = terms(title, artist), i = 0, lastReason = "unreachable";
      function step() {
        if (i >= list.length) return Promise.resolve({ reason: lastReason === "no-match" ? "no-match" : lastReason });
        var term = list[i++];
        return throttled(function () { return search(term); }).then(function (res) {
          if (res.data) {
            var hit = pick(res.data.results, title, artist);
            if (hit) return { hit: hit };
            lastReason = "no-match";
            return step();
          }
          lastReason = res.reason || "unreachable";
          // A transport failure won't be fixed by rewording the query — stop and say so.
          return (lastReason === "no-match") ? step() : { reason: lastReason, status: res.status };
        });
      }
      return step();
    }
    function ensureAudio() {
      if (!audio) {
        audio = new Audio(); audio.preload = "none"; audio.playsInline = true;
        try { audio.setAttribute("playsinline", ""); audio.setAttribute("webkit-playsinline", ""); } catch (e) {}
        audio.addEventListener("ended", function () { setBtn(current, "idle"); current = null; });
        audio.addEventListener("error", function () { if (current) { setBtn(current, "error"); current = null; } });
      }
      return audio;
    }
    // A lookup miss is never permanent: the button stays tappable so a flaky network can be retried.
    // (Previously one failed lookup set disabled=true and greyed "no preview" for the whole session.)
    function setBtn(id, state) {
      var b = document.querySelector('[data-prev="' + id + '"]'); if (!b) return;
      b.classList.toggle("playing", state === "playing");
      b.textContent = state === "loading" ? "…" : state === "playing" ? "❚❚ Preview" : state === "retry" ? "↻ Preview" : "▶ Preview";
      b.disabled = false;
    }
    // Once the lookup lands, upgrade the "Apple Music" link from a generic search URL to the
    // EXACT track page (trackViewUrl) so it opens the song, not just the Music app.
    function linkUp(id, view) {
      if (!view) return;
      var a = document.querySelector('[data-applelink="' + id + '"]'); if (!a) return;
      a.setAttribute("href", view);
    }
    var pending = {}, lastReason = {};
    function key(title, artist) { return title + " " + artist; }
    function resolve(title, artist) {                     // -> Promise<{preview,view}|null>, memoized
      var k = key(title, artist);
      if (cache[k] !== undefined) return Promise.resolve(cache[k]);
      if (pending[k]) return pending[k];
      var p = lookup(title, artist).then(function (res) {
        if (res.hit) { cache[k] = res.hit; delete lastReason[k]; }
        else { delete cache[k]; lastReason[k] = res.reason; }  // never memoize a failure — allow a retry
        delete pending[k]; return res.hit || null;
      });
      pending[k] = p; return p;
    }
    // Why the last attempt for this song failed, so the toast can say something true.
    function reasonFor(title, artist) { return lastReason[key(title, artist)] || null; }
    function reasonText(reason, hasLink) {
      switch (reason) {
        case "no-match":  return hasLink ? "No 30-sec clip for this one — tap Apple Music for the full song."
                                         : "Apple has no 30-sec clip for this one.";
        case "busy":      return "Apple's preview service is rate-limiting us — give it a moment, then tap again.";
        case "offline":   return "No connection — previews need the internet. The dance and the count track don't.";
        case "unreachable": return "Couldn't reach Apple's preview service — the connection looks fine, so it's them. Tap to retry.";
        case "timeout":   return "The preview service didn't answer in time — tap to retry.";
        default:          return "Couldn't reach the preview service — tap to retry.";
      }
    }
    // warm the cache when the detail opens, and upgrade the deep link as soon as it resolves
    function prefetch(id, title, artist) {
      if (!title) return;
      resolve(title, artist).then(function (hit) { if (hit) linkUp(id, hit.view); });
    }
    function play(id, hit, title, artist) {
      if (!hit || !hit.preview) {
        setBtn(id, "retry"); current = null;
        // Say WHICH failure it was. These used to collapse into one message, so a rate-limit, a
        // dead network and a song Apple simply has no clip for were indistinguishable on screen.
        toast(reasonText(hit ? "no-match" : reasonFor(title, artist), !!(hit && hit.view)));
        return;
      }
      audio.src = hit.preview; current = id; setBtn(id, "playing");   // optimistic — the tap plays it; revert only if blocked/errored
      var p = audio.play();
      if (p && p.catch) p.catch(function () { if (current === id) { setBtn(id, "retry"); current = null; } });
    }
    function toggle(id, title, artist) {
      ensureAudio();
      if (current === id && !audio.paused) { audio.pause(); setBtn(id, "idle"); current = null; return; }
      if (current && current !== id) { audio.pause(); setBtn(current, "idle"); }
      var k = key(title, artist);
      if (cache[k] !== undefined) { linkUp(id, cache[k].view); play(id, cache[k], title, artist); }   // prefetched -> play SYNCHRONOUSLY inside the tap (iOS-safe)
      else { setBtn(id, "loading"); resolve(title, artist).then(function (hit) { if (hit) linkUp(id, hit.view); play(id, hit, title, artist); }); }
    }
    function stopAll() { if (audio && !audio.paused) audio.pause(); if (current) { setBtn(current, "idle"); current = null; } }
    function cached(title, artist) { return cache[key(title, artist)]; }
    return { toggle: toggle, stopAll: stopAll, prefetch: prefetch, resolve: resolve, cached: cached };
  })();
  window.SS_Preview = Preview;   // exposed for the headless test

  /* ---------------- MUSIC IN THE PLAYER ----------------
     Before this, the ONLY sound anywhere in Watch or Learn was the synth count track — the song
     previews lived on the Dance Detail screen and nowhere else. "None of the music works" in
     Start Learning was literally true: there was no music there to work.

     What we can legitimately play is Apple's 30-second preview, so that is what this loops, with
     an honest label and a one-tap deep link to the full song. It is a SEPARATE layer from the
     count track on purpose — the count track is tempo-variable (40–120%) and the record is not,
     so they can never be locked together. Mute the counts if you want the song alone.

     iOS rule honoured: the element is created and its src is set when the player OPENS, so the
     Music tap only has to call play() — synchronously, inside the gesture. */
  var Music = (function () {
    var el = null, url = null, playing = false, songLabel = "", fullLink = "";
    function ensure() {
      if (!el) {
        el = new Audio(); el.loop = true; el.preload = "auto"; el.playsInline = true;
        try { el.setAttribute("playsinline", ""); el.setAttribute("webkit-playsinline", ""); } catch (e) {}
        el.addEventListener("pause", function () { playing = false; });
        el.addEventListener("error", function () { playing = false; });
      }
      return el;
    }
    var onReady = null;
    function load(dance, ready) {                           // called on openPlayer — warms the element
      stop(); url = null; fullLink = ""; songLabel = ""; onReady = ready || null;
      var s = (dance.songs || [])[0];
      if (!s) return;
      songLabel = s.title;
      fullLink = s.apple || "";
      var want = dance.id;
      var hit = Preview.cached(s.title, s.artist);
      if (hit) { apply(hit); return; }
      Preview.resolve(s.title, s.artist).then(function (h) {
        if (!h || want !== currentDanceId) return;              // a different dance opened meanwhile
        apply(h); if (onReady) onReady();
      });
    }
    var currentDanceId = null;
    function setDance(id) { currentDanceId = id; }
    function apply(hit) {
      if (hit.view) fullLink = hit.view;
      if (!hit.preview) return;
      url = hit.preview;
      try { ensure().src = url; ensure().load(); } catch (e) {}   // buffered and ready before the tap
    }
    function play() {                                       // MUST be called inside a user gesture
      if (!url) return false;
      var a = ensure();
      if (a.src !== url) { a.src = url; }
      var p = a.play(); playing = true;
      if (p && p.catch) p.catch(function () { playing = false; });
      return true;
    }
    function stop() { if (el && !el.paused) { try { el.pause(); } catch (e) {} } playing = false; }
    function toggle() { if (playing) { stop(); return false; } return play(); }
    // iOS pauses the element when the app backgrounds, without firing anything we can rely on.
    // Trust the element, not our own flag, whenever we come back to the foreground.
    function syncFromElement() { playing = !!(el && !el.paused && !el.ended); return playing; }
    return { load: load, play: play, stop: stop, toggle: toggle, setDance: setDance,
             syncFromElement: syncFromElement,
             get playing() { return playing; }, get ready() { return !!url; },
             get label() { return songLabel; }, get fullLink() { return fullLink; } };
  })();

  /* ---------------- DANCE DETAIL ---------------- */
  var heroEngine = null;
  function openDetail(id) {
    var d = byId[id]; if (!d) return;
    var v = $("#view-detail");
    var songHtml = (d.songs || []).map(function (s, i) {
      var pid = d.id + "_" + i;
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--line)">' +
        '<div style="min-width:0"><b style="font-weight:800">' + esc(s.title) + '</b>' +
        '<div class="p">' + esc(s.artist) + ' · <a href="' + s.apple + '" data-applelink="' + pid + '" target="_blank" rel="noopener" style="color:var(--amber-bright);font-weight:700">Apple Music</a> · <a href="' + s.spotify + '" target="_blank" rel="noopener" style="color:var(--muted);font-weight:700">Spotify</a></div></div>' +
        '<button class="chip prevbtn" data-prev="' + pid + '" data-title="' + esc(s.title) + '" data-artist="' + esc(s.artist) + '" aria-label="Play 30-second preview of ' + esc(s.title) + '">▶ Preview</button>' +
        '</div>';
    }).join('');
    var mastery = S.mastery[d.id] || null, want = !!S.want[d.id];
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
    html += '<button class="btn primary" id="d-learn" style="margin-bottom:10px">🎓 Start learning</button>';
    html += '<button class="btn" id="d-watch">▶ Watch full</button>';
    // There is no "download" button because there is nothing to download: every dance, diagram and
    // count tick is already bundled in the app. A toggle that only flips a localStorage flag and
    // says "saved" is a mock, and reads as one (Guideline 2.3.1).
    html += '<div class="p" style="margin:10px 0 4px">Already on your phone — the steps, the diagram and the count track all work with no signal. (Song previews and song links need the internet.)</div>';
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
    $$("[data-prev]", v).forEach(function (b) {
      Preview.prefetch(b.dataset.prev, b.dataset.title, b.dataset.artist);
      b.onclick = function () { Preview.toggle(b.dataset.prev, b.dataset.title, b.dataset.artist); };
    });
    $("#d-share").onclick = function () { exportCheatSheet(d); };
    var lb = $("#d-learn"); if (lb) lb.onclick = function () { openPlayer(d, "learn"); };
    var wb = $("#d-watch"); if (wb) wb.onclick = function () { openPlayer(d, "watch"); };
    $$("#d-mastery [data-m]").forEach(function (b) { b.onclick = function () { setMastery(d.id, b.dataset.m); $$("#d-mastery [data-m]").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); toast("Marked: " + b.textContent); }; });
  }
  function setMastery(id, m) { if (m === "want") { S.want[id] = true; delete S.mastery[id]; } else { S.mastery[id] = m; delete S.want[id]; } save(); }

  /* ---------------- PLAYER ---------------- */
  var eng = null, playerDance = null, playerMode = "watch", playerHeld = false;
  var sectionIdx = 0, ghostOn = true, loopOn = true, watchLoop = true, chunkPlaying = false, sessionCompleted = false, countsOn = true;
  function ensureEngine() {
    if (eng) return eng;
    eng = window.ScootEngine.create($("#p-canvas"), {
      colors: COLORS, getSettings: function () { return S.settings; }, haptic: nativeHaptic,
      onLap: function () { onDanceComplete(); },   // first full lap while looping the whole dance
      onCount: function (count, phrase, ev) {
        $("#p-count").textContent = count;
        var t = instrText(ev); $("#p-instr").textContent = t.main || "…"; $("#p-instr2").textContent = t.sub || "";
        $("#p-phrase").textContent = phrase ? phrase.label.replace(/^Counts \d+.\d+:\s*/, "") : "";
        var act = playerMode === "learn" && playerDance
          ? SEC.activeCell(sectionIdx, playerDance.counts, count)
          : (count - 1) % 8;
        $$("#p-ribbon .rc").forEach(function (el, i) { el.classList.toggle("active", i === act); });
      },
      onWall: function (i, label) { $("#p-wall").textContent = label; },
      onCue: function (txt, show) { var c = $("#p-cue"); if (show) { c.textContent = txt; c.classList.add("show"); } else c.classList.remove("show"); },
      onComplete: function () {   // a bounded run finished (play-once / all-walls / section-once)
        chunkPlaying = false; syncTransportUI();
        if (eng && eng.loop === null) onDanceComplete();   // only celebrate when it was the WHOLE dance, not one section
      }
    });
    return eng;
  }
  var SEC = window.SS_Sections;
  function buildRibbon() { var r = $("#p-ribbon"); r.innerHTML = ""; for (var i = 1; i <= 8; i++) { var d = document.createElement("div"); d.className = "rc b1"; d.textContent = i; r.appendChild(d); } }
  function sectionBounds() { var b = SEC.boundsFor(sectionIdx, playerDance.counts); return [b.start, b.end]; }
  // Paint the 8 cells with the REAL counts of the current selection. They used to be relabelled
  // ((start-1+i)%8)+1, which prints "1..8" for every section — so drilling 17–24 looked identical
  // to drilling 1–8 and the learner had no idea where they were in the dance.
  function paintRibbon() {
    var cells = SEC.ribbonFor(sectionIdx, playerDance.counts);
    $$("#p-ribbon .rc").forEach(function (el, i) {
      var c = cells[i];
      el.textContent = c.label;
      el.classList.toggle("insel", !!c.inSelection);
      el.classList.toggle("empty", c.count === null);
    });
  }
  function buildSections() {
    var host = $("#p-sections"); if (!host) return; host.innerHTML = "";
    var list = SEC.sectionsFor(playerDance.counts);
    host.innerHTML = list.map(function (s) { return '<button class="chip sec" data-sec="' + s.idx + '">' + s.label + '</button>'; }).join("");
    // The whole dance is NOT a chip in this strip any more — it lived at the end of a hidden
    // horizontal scroller and was physically off-screen on a 375px phone. It gets its own row.
    $("#p-whole").classList.toggle("hide", list.length < 2);
    $(".seclabel").classList.toggle("hide", list.length < 2);
    $$("[data-sec]", host).forEach(function (b) { b.onclick = function () { selectSection(+b.dataset.sec); }; });
  }
  function markSection() {
    var whole = sectionIdx === SEC.WHOLE;
    $$("#p-sections .sec").forEach(function (b) { b.classList.toggle("on", !whole && +b.dataset.sec === sectionIdx); });
    var w = $("#p-whole");
    w.classList.toggle("on", whole);
    w.setAttribute("aria-pressed", whole ? "true" : "false");
    w.textContent = (whole ? "✓ " : "🔁 ") + "Practise the WHOLE dance";
  }
  function openPlayer(d, mode) {
    try { if (window.SS_Preview) window.SS_Preview.stopAll(); } catch (e) {}
    // the detail-screen hero loop keeps running behind the player otherwise — a second engine
    // animating and holding the shared audio context for nothing
    try { if (heroEngine) heroEngine.pause(); } catch (e) {}
    playerDance = d; playerMode = (mode === "learn") ? "learn" : "watch"; sectionIdx = 0; sessionCompleted = false; chunkPlaying = false;
    // Hold the media route open for as long as the player is up. This runs inside the tap that
    // opened the player, which is the gesture iOS wants; from here the count track has a live
    // output to land on instead of a context that claims to be running and makes no sound.
    if (!playerHeld) { playerHeld = true; KeepAlive.hold(true); }
    $("#player").classList.add("on");
    $("#p-name").textContent = d.name + (d.glossary ? " · basic" : "");
    $("#p-credit").textContent = d.glossary ? (d.definition ? d.definition.slice(0, 60) + "…" : "") : d.choreographer_credit;
    $("#p-canvas").setAttribute("aria-label", "Top-down animation of two boots for " + d.name + ", " + d.counts + " counts, " + d.walls + " walls");
    buildRibbon();
    ensureEngine(); eng.load(d); eng.setMute(!countsOn);
    var tempo = $("#p-tempo");
    tempo.min = 40; tempo.max = 120; if (+tempo.value < 40) tempo.value = 40; if (+tempo.value > 120) tempo.value = 120;
    setTempoUI(+tempo.value);
    if (d.glossary) { $("#p-mode-watch").parentNode.classList.add("hide"); playerMode = "watch"; } else { $("#p-mode-watch").parentNode.classList.remove("hide"); }
    Music.setDance(d.id);
    Music.load(d, syncTransportUI);    // warm the song element NOW so the Music tap plays in-gesture
    setPlayerMode(playerMode);
    // Watch/glossary: start immediately, in the SAME gesture that opened the player (iOS needs a gesture to start audio)
    if (playerMode === "watch") { eng.ensureAudio(); eng.setStopAfter(watchLoop ? 0 : 1); eng.play(); }
    // Learn: nothing auto-plays, but we still unlock audio HERE — inside the "Start learning" tap —
    // so the very first count tick (stepping or playing a section) is audible. Without this the
    // whole learn flow ran on a suspended context and made no sound at all.
    else { eng.ensureAudio(); }
    syncTransportUI();
  }
  function closePlayer() {
    if (eng) eng.pause();
    Music.stop();
    chunkPlaying = false;
    if (playerHeld) { playerHeld = false; KeepAlive.hold(false); }
    $("#player").classList.remove("on");
    // the detail hero was paused when the player opened — bring it back, or the screen behind
    // the player is left frozen mid-step
    try { if (heroEngine && current === "detail") { heroEngine.setMute(true); heroEngine.play(); } } catch (e) {}
  }
  // ONE place that makes every transport button tell the truth about engine state. The buttons
  // used to be set ad hoc at each call site, so switching modes mid-play left "▶ Play" showing
  // over a running transport (and vice versa).
  function syncTransportUI() {
    var running = !!(eng && eng.playing);
    $("#p-play").textContent = (playerMode === "watch" && running) ? "❚❚ Pause" : "▶ Play";
    chunkPlaying = (playerMode === "learn") && running;
    $("#p-step-play").textContent = chunkPlaying ? "❚❚ Pause"
      : "▶ Play " + (sectionIdx === SEC.WHOLE ? "whole dance" : (playerDance ? SEC.labelFor(sectionIdx, playerDance.counts) : "section"));
    $("#p-music").firstChild.textContent = Music.playing ? "❚❚" : "🎵";
    $("#p-songname").textContent = Music.label || "Song";
    $("#p-music").classList.toggle("on", Music.playing);
    $("#p-music").disabled = !Music.ready;
    $("#p-counts").textContent = "🥁 Counts" + (countsOn ? "" : ": Off");
    $("#p-counts").classList.toggle("on", countsOn);
    $("#p-musicbox").classList.toggle("hide", !Music.label);
    $("#p-fullsong").disabled = !Music.fullLink;
    $("#p-musichint").textContent = Music.ready
      ? "Starts on count 1 · loops the 30-second preview · 🍎 opens the full song"
      : "Finding the preview… · 🍎 opens the full song";
  }
  function setPlayerMode(mode) {
    playerMode = mode;
    if (eng) eng.pause();                       // never leave a transport running across a mode switch
    $("#p-mode-watch").classList.toggle("on", mode === "watch"); $("#p-mode-learn").classList.toggle("on", mode === "learn");
    $("#ctl-watch").classList.toggle("hide", mode !== "watch");
    $("#ctl-learn").classList.toggle("hide", mode !== "learn");
    chunkPlaying = false;
    if (mode === "learn") {
      eng.setStepMode(true); eng.setGhost(ghostOn);
      buildSections();
      $("#p-loop").classList.toggle("on", loopOn); $("#p-loop").textContent = "🔁 Loop: " + (loopOn ? "On" : "Off");
      $("#p-ghost").classList.toggle("on", ghostOn); $("#p-ghost").textContent = "👣 Ghost: " + (ghostOn ? "On" : "Off");
      selectSection(sectionIdx);
    } else {
      eng.setStepMode(false); eng.setLoop(null); eng.setStopAfter(watchLoop ? 0 : 1);
      $("#p-loop-watch").classList.toggle("on", watchLoop); $("#p-loop-watch").textContent = "🔁 Loop dance: " + (watchLoop ? "On" : "Off");
      $("#p-rotate").classList.remove("on");
      // clear the drill highlight/relabelling so Watch doesn't inherit a section's ribbon
      $$("#p-ribbon .rc").forEach(function (el, i) { el.textContent = i + 1; el.classList.remove("insel", "empty"); });
    }
    syncTransportUI();
  }
  function setTempoUI(v) { $("#p-tempoval").textContent = v + "%"; $("#p-bpm").textContent = Math.round((playerDance.bpm || 96) * v / 100) + " BPM"; if (eng) eng.setTempo(v); }
  function selectSection(idx) {
    sectionIdx = idx; chunkPlaying = false;
    var b = sectionBounds();
    eng.setStepMode(true);
    if (idx === SEC.WHOLE) eng.setLoop(null); else eng.setLoop(b[0], b[1]);  // section -> bounded; whole -> the full dance
    eng.stepTo(b[0]);
    markSection(); paintRibbon(); syncTransportUI();
  }
  function onDanceComplete() {
    if (sessionCompleted) return; sessionCompleted = true;
    syncTransportUI();
    bumpStreak(); celebrate();
    S.completions = (S.completions || 0) + 1;
    if (!S.mastery[playerDance.id] || S.mastery[playerDance.id] === "learning") toast("Nailed it. " + playerDance.name + " fears you now.");
    S.history.unshift({ id: playerDance.id, at: Date.now() }); S.history = S.history.slice(0, 40); save();
    maybeAskReview();
  }
  // Native rating sheet (SKStoreReviewController) after a genuine success — never first launch, capped once.
  function maybeAskReview() {
    try {
      if (S.reviewPrompted) return;
      if ((S.completions || 0) < 1 && (S.sessions || 0) < 3) return;
      S.reviewPrompted = true; S.reviewPromptAt = Date.now(); save();
      setTimeout(function () { try { var P = window.Capacitor && window.Capacitor.Plugins; if (P && P.InAppReview && P.InAppReview.requestReview) P.InAppReview.requestReview(); } catch (e) {} }, 2600);
    } catch (e) {}
  }
  // player controls
  $("#p-close").onclick = closePlayer;
  $("#p-mode-watch").onclick = function () { setPlayerMode("watch"); };
  $("#p-mode-learn").onclick = function () { setPlayerMode("learn"); };
  $("#p-play").onclick = function () { eng.ensureAudio(); if (!eng.playing) eng.setStopAfter(watchLoop ? 0 : 1); eng.toggle(); syncTransportUI(); };
  $("#p-restart").onclick = function () { eng.ensureAudio(); eng.setStopAfter(watchLoop ? 0 : 1); eng.restart(); if (!eng.playing) eng.play(); syncTransportUI(); };
  $("#p-mirror").onclick = function () { eng.setMirror(!eng.mirror); $("#p-mirror").classList.toggle("on", eng.mirror); toast(eng.mirror ? "Mirror: facing you" : "Mirror: over the shoulder"); };
  $("#p-loop-watch").onclick = function () { watchLoop = !watchLoop; $("#p-loop-watch").classList.toggle("on", watchLoop); $("#p-loop-watch").textContent = "🔁 Loop dance: " + (watchLoop ? "On" : "Off"); eng.setStopAfter(watchLoop ? 0 : 1); if (watchLoop) $("#p-rotate").classList.remove("on"); };
  $("#p-rotate").onclick = function () { eng.ensureAudio(); eng.setFullRotation(true); $("#p-rotate").classList.add("on"); watchLoop = false; $("#p-loop-watch").classList.remove("on"); $("#p-loop-watch").textContent = "🔁 Loop dance: Off"; eng.restart(); eng.play(); syncTransportUI(); toast("Through all " + playerDance.walls + " walls, once"); };
  $("#p-tempo").addEventListener("input", function () { setTempoUI(+this.value); });
  $("#p-whole").onclick = function () {   // the whole dance, end to end — used to be an off-screen chip
    selectSection(sectionIdx === SEC.WHOLE ? 0 : SEC.WHOLE);
    toast(sectionIdx === SEC.WHOLE ? "Whole dance — all " + playerDance.counts + " counts" : "Drilling counts " + SEC.labelFor(sectionIdx, playerDance.counts));
  };
  $("#p-step-play").onclick = function () {          // Play/pause the selection (loops per the Loop toggle)
    if (!chunkPlaying) {
      // ensureAudio() runs inside this tap so the count track is audible for the drill —
      // this is the count track that carries the learner through the steps.
      eng.ensureAudio(); eng.setStepMode(false); eng.setStopAfter(loopOn ? 0 : 1); eng.play();
    } else {
      // pause where the learner actually is, so they can study the count they stopped on
      // (this used to snap back to the top of the section, losing their place)
      eng.pause(); eng.setStepMode(true);
    }
    syncTransportUI();
  };
  $("#p-next").onclick = function () { eng.setStepMode(true); eng.stepNext(); syncTransportUI(); };
  $("#p-prev").onclick = function () { eng.setStepMode(true); eng.stepPrev(); syncTransportUI(); };
  $("#p-loop").onclick = function () { loopOn = !loopOn; $("#p-loop").classList.toggle("on", loopOn); $("#p-loop").textContent = "🔁 Loop: " + (loopOn ? "On" : "Off"); if (eng.playing) eng.setStopAfter(loopOn ? 0 : 1); };
  // ---- music controls (both modes) ----
  // Music tap. play() is synchronous and inside the gesture on purpose — iOS refuses <audio>.play()
  // that it can't attribute to a tap, and an await or a fetch first is enough to lose that claim.
  //
  // Starting the song ALSO restarts the count transport, so the record and the counts begin
  // together on count 1 instead of the song landing halfway through a phrase. The two can't be
  // locked for longer than that — counts are tempo-variable (40–120%) and the record is not — but
  // they can at least agree on where the dance starts, which is what "start on the right 8-count"
  // means when you're trying to follow along.
  $("#p-music").onclick = function () {
    var nowPlaying = Music.toggle();
    if (nowPlaying) {
      eng.ensureAudio();
      eng.restart();
      if (!eng.playing) eng.play();
    }
    syncTransportUI();
  };
  $("#p-counts").onclick = function () { countsOn = !countsOn; if (eng) eng.setMute(!countsOn); syncTransportUI(); };
  $("#p-fullsong").onclick = function () { if (Music.fullLink) openExternal(Music.fullLink); };
  $("#p-ghost").onclick = function () { ghostOn = !ghostOn; $("#p-ghost").classList.toggle("on", ghostOn); $("#p-ghost").textContent = "👣 Ghost: " + (ghostOn ? "On" : "Off"); eng.setGhost(ghostOn); };

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

  /* ---------------- MY DANCES ---------------- */
  function renderMyDances() {
    var v = $("#view-mydances");
    var shelves = [['want', 'Want to learn'], ['learning', 'Learning'], ['can-follow', 'Can follow'], ['know-it', 'Know it cold']];
    var html = '<div class="vhead"><div><div class="vtitle">My Dances</div><div class="vsub">Your shelf. Your streak. Your night.</div></div></div>';
    html += '<div class="statrow"><div class="stat"><b>' + S.streak.count + '</b><span>day streak</span></div>' +
      '<div class="stat"><b>' + S.history.length + '</b><span>practices</span></div>' +
      '<div class="stat"><b>' + Object.keys(S.mastery).filter(function (id) { return S.mastery[id] === "know-it"; }).length + '</b><span>know cold</span></div></div>';
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
  // What the native side reported about the LIVE AVAudioSession. "playback" is the one that plays
  // at media volume and ignores the ringer switch; anything else (or nothing) means the phone's
  // silent switch will mute the app, which is the bug this readout exists to catch.
  function audioSessionLine() {
    var s = window.__ssAudioSession;
    if (!s) return "Media volume (set natively at launch). Running in a browser, or the native " +
                   "layer hasn't reported in yet — on device this line names the live category.";
    var ok = /playback/i.test(s.category || "");
    return (ok ? "✓ Media volume — plays with the ringer switch on silent."
               : "⚠️ Not on media volume — the silent switch will mute the app.") +
           " Live category: " + esc(String(s.category || "unknown")) + ".";
  }
  function renderSettings() {
    var v = $("#view-settings"), s = S.settings;
    function toggle(id, on, label, sub) { return '<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><b style="font-weight:800">' + label + '</b><div class="p">' + sub + '</div></div><button class="chip ' + (on ? 'on' : '') + '" data-tog="' + id + '">' + (on ? 'On' : 'Off') + '</button></div>'; }
    var html = '<div class="vhead"><button class="iconbtn" id="set-back">‹</button><div class="vtitle" style="font-size:22px">Settings</div><span style="width:42px"></span></div>';
    html += '<div class="eyebrow" style="margin:6px 0 8px">Count track</div>';
    html += '<div class="card"><b style="font-weight:800">Count sound</b><div class="seg" style="margin-top:10px" id="set-count"><button data-cs="click"' + (s.countStyle === 'click' ? ' class="on"' : '') + '>Click</button><button data-cs="woodblock"' + (s.countStyle === 'woodblock' ? ' class="on"' : '') + '>Woodblock</button></div></div>';
    html += toggle('haptics', s.haptics, 'Haptic counts', 'Feel every beat — great when the room is loud.');
    html += '<div class="eyebrow" style="margin:16px 0 8px">Comfort</div>';
    html += '<div class="card"><b style="font-weight:800">Text size</b><div class="p" style="margin:2px 0 6px">Bigger type across the whole app.</div><input type="range" id="set-text" min="0.9" max="1.35" step="0.05" value="' + (s.textScale || 1) + '" aria-label="Text size"></div>';
    html += '<div class="eyebrow" style="margin:16px 0 8px">About</div>';
    html += '<div class="card"><b style="font-weight:800">Works with no signal</b><div class="p">Every dance, every diagram and the count track are built into the app — nothing to download. Song previews and song links are the only parts that need the internet.</div></div>';
    // Live audio-session readout. The native layer writes window.__ssAudioSession with the category
    // iOS ACTUALLY granted (not the one we asked for), so the silent-switch fix can be confirmed on
    // a real phone without attaching Xcode. See scripts/patch-ios-audio.sh.
    html += '<div class="card"><b style="font-weight:800">Audio output</b><div class="p">' + audioSessionLine() + '</div></div>';
    html += '<div class="card"><b style="font-weight:800">Privacy</b><div class="p" style="margin:2px 0 9px">No account, no ads, no analytics. Your streak, your shelf and your settings are saved on this phone. Tapping Preview asks Apple\'s public iTunes search for the song — nothing about you goes with it.</div><button class="btn sm" id="set-privacy">Privacy policy ↗</button></div>';
    html += '<div class="card"><b style="font-weight:800">More from Jonathan</b><div class="p" style="margin:2px 0 9px">Art, stories, and what\'s next.</div><button class="btn sm" id="set-web">Visit jonathanscribbles.com ↗</button></div>';
    html += '<div class="p" style="text-align:center;margin-top:18px;line-height:1.6">ScootSteps · learn to line dance<br>Made with real boots. Support: jonathanbbiles@gmail.com</div>';
    v.innerHTML = html;
    $("#set-back").onclick = function () { showView("home"); };
    $("#set-web").onclick = function () { openExternal("https://jonathanscribbles.com"); };
    $("#set-privacy").onclick = function () { openExternal(PRIVACY_URL); };
    $$("#set-count [data-cs]").forEach(function (b) { b.onclick = function () { s.countStyle = b.dataset.cs; save(); renderSettings(); }; });
    $$("[data-tog]").forEach(function (b) { b.onclick = function () { s[b.dataset.tog] = !s[b.dataset.tog]; save(); renderSettings(); }; });
    $("#set-text").addEventListener("input", function () { s.textScale = +this.value; applyTextScale(); save(); });
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
  // A data: URL on an <a download> does nothing in the Capacitor WKWebView — the download
  // attribute is not honoured there, so that button was decoration. The two paths that DO work on
  // device are the share sheet (which offers "Save Image") and a long-press on the image itself,
  // so those are the two the UI offers, and the long-press is stated rather than left to be guessed.
  function dataUrlToFile(url, name) {                     // synchronous on purpose: navigator.share
    var comma = url.indexOf(",");                         // must be called inside the tap's user
    var bin = atob(url.slice(comma + 1));                 // gesture, and an await would spend it
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: "image/png" });
  }
  function showCheatModal(d, url) {
    var o = document.createElement("div"); o.className = "overlay on"; o.style.zIndex = 90;
    o.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div class="eyebrow">Cheat sheet</div><button class="btn ghost sm" id="cs-x">✕</button></div>' +
      '<div class="p" style="margin-bottom:12px">Your pocket step sheet for <b>' + esc(d.name) + '</b>.</div>' +
      '<img src="' + url + '" style="width:100%;border-radius:12px;border:1px solid var(--line-2)"/>' +
      '<button class="btn primary" id="cs-share" style="margin-top:14px">⤴️ Save or share</button>' +
      '<div class="p" style="margin-top:8px;text-align:center">Or long-press the image to save it to Photos.</div>';
    document.body.appendChild(o);
    $("#cs-x", o).onclick = function () { o.remove(); };
    $("#cs-share", o).onclick = function () {
      var file;
      try { file = dataUrlToFile(url, "scootsteps-" + d.id + ".png"); }
      catch (e) { toast("Long-press the image to save it to Photos."); return; }
      if (!(navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share)) {
        toast("Long-press the image to save it to Photos."); return;
      }
      navigator.share({ files: [file], title: d.name + " — ScootSteps" })
        .catch(function () { /* the user dismissed the sheet, or iOS refused it — the long-press path is on screen */ });
    };
  }

  /* ---------------- boot ---------------- */
  // Prefer Capacitor's Browser plugin when it's present, else window.open (Capacitor routes
  // off-origin http(s) to Safari), else a hard navigation. Feature-detected on purpose: this
  // works today with no @capacitor/browser dependency, and upgrades by itself if one is added.
  function openExternal(url) {
    try {
      var P = window.Capacitor && window.Capacitor.Plugins;
      if (P && P.Browser && P.Browser.open) { P.Browser.open({ url: url }); return false; }
    } catch (e) {}
    try { window.open(url, "_blank"); } catch (e) { try { location.href = url; } catch (e2) {} }
    return false;
  }

  // iOS: unlock the shared AudioContext on the very first user interaction, so Watch autostart,
  // the count track, and song previews all actually make sound on device.
  // NOTE: this must run on EVERY gesture, not just the first. iOS re-suspends the context whenever
  // the app is backgrounded or audio goes idle; the old one-shot latch meant that after the first
  // suspension nothing ever resumed it again, so the count track went silent for the rest of the
  // session. Creating the context is one-shot; resuming it is not.
  /* ---- KEEPALIVE: the one thing Tassel does that this app did not ----------------------------
     Tassel plays audio with `new Audio(URL.createObjectURL(blob))` — an ordinary HTMLAudioElement
     with a real file in it — and no audio-session code at all. ScootSteps' count track is Web
     Audio: oscillators scheduled on the AudioContext clock, and NO media element anywhere.

     On iOS those two are not equivalent. An HTMLAudioElement that is actually playing is what
     makes WKWebView hold a live media playback route open. A bare AudioContext does not reliably
     do that: it is suspended aggressively, it can come back from resume() in "running" state and
     still produce no sound, and there is nothing telling the system this app is playing media.
     That is the difference between "the count track works sometimes" and "the count track works".

     So this plays a silent looping WAV, built the same way Tassel builds its audio — a Blob and an
     object URL — for exactly as long as the count track needs to be audible. It is inaudible, it
     costs nothing, and it keeps the route open so the oscillators land on a live output.

     This is IN ADDITION to the .playback session (scripts/patch-ios-audio.sh), which Tassel does
     not have at all — that is what stops the ringer switch muting us, and it is why copying Tassel
     wholesale would have been a downgrade. */
  var KeepAlive = (function () {
    var el = null, url = null, held = 0;
    function silentWavUrl() {
      if (url) return url;
      var rate = 8000, secs = 0.25, n = Math.floor(rate * secs), bytes = 44 + n * 2;
      var b = new ArrayBuffer(bytes), v = new DataView(b), i;
      function str(off, s) { for (i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
      str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVEfmt ");
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      str(36, "data"); v.setUint32(40, n * 2, true);          // samples left at zero = silence
      try { url = URL.createObjectURL(new Blob([b], { type: "audio/wav" })); } catch (e) { url = null; }
      return url;
    }
    function ensure() {
      if (el) return el;
      var u = silentWavUrl(); if (!u) return null;
      el = new Audio(u); el.loop = true; el.playsInline = true; el.preload = "auto"; el.volume = 0.01;
      try { el.setAttribute("playsinline", ""); el.setAttribute("webkit-playsinline", ""); } catch (e) {}
      return el;
    }
    // Called from inside a real tap. iOS only grants playback it can attribute to a gesture, and
    // this is the grant the whole count track then rides on.
    function arm() {
      var a = ensure(); if (!a) return;
      if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
    }
    function hold(on) {
      held = Math.max(0, held + (on ? 1 : -1));
      var a = ensure(); if (!a) return;
      if (held > 0) { if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () {}); } }
      else { try { a.pause(); } catch (e) {} }
    }
    function rearm() { if (held > 0) arm(); }              // after a background trip
    return { arm: arm, hold: hold, rearm: rearm, get active() { return !!(el && !el.paused); } };
  })();
  window.SS_KeepAlive = KeepAlive;                          // exposed for the headless test

  function primeAudio() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!window.__ssAudioCtx && C) window.__ssAudioCtx = new C();
      var ctx = window.__ssAudioCtx;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
    try { KeepAlive.arm(); } catch (e) {}                   // same gesture unlocks the media route
  }
  ["pointerdown", "touchend", "mousedown"].forEach(function (ev) { document.addEventListener(ev, primeAudio, { passive: true }); });

  // Background -> foreground. iOS suspends the AudioContext when the app leaves the screen and
  // does NOT resume it on return; until this existed, coming back from the lock screen or the app
  // switcher mid-practice left the dance animating in total silence, because the only thing that
  // ever resumed the context was a tap and the user had no reason to tap anything.
  //
  // resume() off-gesture is allowed once the native session is .playback and active (see
  // scripts/patch-ios-audio.sh); if a given iOS version still refuses, the per-gesture primeAudio
  // above is the safety net and the next tap fixes it. Nothing is auto-PLAYED here — the transport
  // is only un-suspended, never started, so we can't surprise anyone with noise.
  function onForeground() {
    if (document.visibilityState !== "visible") return;
    try {
      var ctx = window.__ssAudioCtx;
      if (ctx && ctx.state === "suspended") { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
    // The keepalive element is paused by iOS on the way out too — without re-arming it the count
    // track comes back to a dead route, which is the "worked, then stopped working" shape.
    try { KeepAlive.rearm(); } catch (e) {}
    // iOS pauses <audio> on background and does not resume it. Music.playing would otherwise stay
    // true and the button would keep claiming "❚❚" over silence.
    try { Music.syncFromElement(); } catch (e) {}
    try { if (current === "player") syncTransportUI(); } catch (e) {}
  }
  document.addEventListener("visibilitychange", onForeground);
  window.addEventListener("pageshow", onForeground);
  window.addEventListener("focus", onForeground);

  applyTextScale();
  document.addEventListener("DOMContentLoaded", start);
  if (document.readyState !== "loading") start();
  var started = false;
  function start() {
    if (started) return; started = true;
    S.sessions = (S.sessions || 0) + 1; save();       // session count feeds the rating-prompt gate
    showView("home");
    if (!S.onboarded) setTimeout(openOnboarding, 350);
  }
})();
