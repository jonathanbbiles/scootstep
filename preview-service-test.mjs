/* ============================================================================
   SONG PREVIEW SERVICE — the "Couldn't reach the preview service" bug.

   Reported from the device: every Preview button on Prairie Strut (Chattahoochee,
   Save a Horse) toasted "Couldn't reach the preview service — tap to retry", while
   the same two songs resolved perfectly from the Node test suite.

   THE GAP THAT LET THAT HAPPEN: the app fetched over JSONP (a <script> tag with
   &callback=), and the test suite fetched the same endpoint over plain fetch()
   WITHOUT &callback=. Two different requests. The suite could pass green forever
   while the request the app actually sends was failing on the phone.

   So the first thing asserted here is that the test and the app agree on the request.
   ============================================================================ */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (name, cond, note = "") => {
  if (cond) { pass++; console.log(` PASS ${name}${note ? "  [" + note + "]" : ""}`); }
  else { fail++; console.log(` FAIL ${name}${note ? "  [" + note + "]" : ""}`); }
};

const app = readFileSync("www/js/app.js", "utf8");
const capConfig = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
const offline = process.argv.includes("--offline");

console.log("\nREQUEST SHAPE — the app and this test must send the SAME request\n");

const endpointMatch = app.match(/var ENDPOINT = "([^"]+)"/);
ok("the app exposes a single ENDPOINT constant (no URLs built ad hoc)", !!endpointMatch);
const ENDPOINT = endpointMatch ? endpointMatch[1] : "";
ok("ENDPOINT is the public iTunes Search API over HTTPS — no custom backend to go down",
   /^https:\/\/itunes\.apple\.com\/search\?/.test(ENDPOINT), ENDPOINT.slice(0, 58));
ok("ENDPOINT carries no &callback= — the primary path is fetch(), not JSONP",
   !/callback=/.test(ENDPOINT));
ok("the JSONP fallback is derived FROM the same ENDPOINT, so the two cannot drift",
   /url\.replace\("&term=", "&callback=" \+ cb \+ "&term="\)/.test(app));

console.log("\nFAILURE CLASSIFICATION — every failure used to say the same wrong thing\n");

for (const [reason, label] of [
  ["no-match", "Apple has no clip for this song"],
  ["busy",     "rate limited (403/429)"],
  ["offline",  "no network"],
  ["timeout",  "service did not answer"],
]) {
  ok(`"${reason}" is a distinct, reported outcome — ${label}`,
     new RegExp(`case "${reason}":`).test(app));
}
ok("a 403/429 is classified as rate limiting, not as a dead service",
   /r\.status === 403 \|\| r\.status === 429 \? "busy"/.test(app));
ok("a body that will not parse is its own outcome, not a silent timeout",
   /"unparseable"/.test(app));
ok("the offline message tells the truth: the dance still works without a network",
   /previews need the internet\. The dance and the count track don't\./.test(app));

console.log("\nRATE LIMITING — a burst is what earns the 403 in the first place\n");

ok("lookups are throttled rather than fired all at once", /function throttled/.test(app));
const cap = app.match(/while \(running < (\d+) && queue\.length\)/);
ok("no more than 2 lookups are in flight at a time", cap && Number(cap[1]) <= 2,
   cap ? cap[1] + " concurrent" : "no cap found");
ok("a failed lookup is never memoized, so tap-to-retry can actually retry",
   /never memoize a failure/.test(app));

console.log("\nQUERY FALLBACK — 'Save a Horse (Ride a Cowboy)' is the shape that misses\n");

// Pull the real terms() out of the shipped source and run it, so this tests the
// implementation rather than a copy of it that could drift.
const termsSrc = app.match(/function terms\(title, artist\) \{[\s\S]*?\n    \}/);
ok("terms() is present in the shipped source", !!termsSrc);
let terms = null;
if (termsSrc) terms = new Function(termsSrc[0] + "; return terms;")();

if (terms) {
  const t = terms("Save a Horse (Ride a Cowboy)", "Big & Rich");
  ok("first attempt is the full title plus artist",
     t[0] === "Save a Horse (Ride a Cowboy) Big & Rich", t[0]);
  ok("second attempt drops the parenthetical — the part Apple often does not carry",
     t.includes("Save a Horse Big & Rich"), t[1]);
  ok("last attempt is the bare title", t[t.length - 1] === "Save a Horse (Ride a Cowboy)");
  const plain = terms("Chattahoochee", "Alan Jackson");
  ok("a title with no parenthetical does not generate a duplicate attempt",
     plain.length === new Set(plain).size && plain.length === 2, plain.join(" | "));
  ok("a transport failure stops the retries instead of rewording the query",
     /won't be fixed by rewording the query/.test(app));
}

console.log("\nNATIVE TRANSPORT\n");

ok("CapacitorHttp is enabled — on device fetch() goes through native URLSession",
   capConfig.plugins?.CapacitorHttp?.enabled === true);
// Comments are stripped first: this file explains WHY AbortSignal.timeout is avoided, and a
// naive grep would match that explanation and call it a usage.
const appCode = app.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
ok("the timeout is built from AbortController, not AbortSignal.timeout (iOS 16+ only)",
   /new AbortController/.test(appCode) && !/AbortSignal\.timeout/.test(appCode));
ok("preview audio is a plain <audio> element — it inherits the app-wide .playback session",
   /audio = new Audio\(\); audio\.preload = "none"/.test(app));

if (offline) {
  console.log("\n  live API checks skipped (--offline)\n");
} else {
  console.log("\nLIVE API — both transports, using the app's own ENDPOINT\n");
  const song = ["Chattahoochee", "Alan Jackson"];
  const url = ENDPOINT + encodeURIComponent(song.join(" "));

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    ok("fetch() path: HTTP 200", r.status === 200, "status " + r.status);
    const body = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch (e) {}
    ok("fetch() path: body parses as JSON even though it is served as text/javascript",
       !!parsed, "content-type " + r.headers.get("content-type"));
    ok("fetch() path: a previewUrl comes back", !!parsed?.results?.[0]?.previewUrl);
    // CORS here is a coin flip, so this REPORTS it rather than asserting it. Measured minutes
    // apart on one URL, the ACAO header was present once and absent the next time — it is served
    // via Akamai and the header does not reliably survive caching. That is precisely why the app
    // must not depend on it (CapacitorHttp on device, JSONP fallback in a browser), and asserting
    // either answer here would make this suite flaky for a reason that does not matter.
    // node:https, not fetch(): Origin is a forbidden header and undici drops it silently.
    const acao = await new Promise((res) => {
      import("node:https").then(({ default: https }) => {
        const u = new URL(url);
        const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "GET",
                                    headers: { Origin: "capacitor://localhost" } },
          (r) => { r.resume(); res(r.headers["access-control-allow-origin"] || null); });
        req.on("error", () => res(null));
        req.setTimeout(20000, () => { req.destroy(); res(null); });
        req.end();
      }).catch(() => res(null));
    });
    console.log(`      note: access-control-allow-origin came back as ${acao === null ? "ABSENT" : acao} ` +
                `this run — known to vary, which is why nothing depends on it`);
    ok("the app does not depend on CORS either way (native transport + JSONP fallback)",
       capConfig.plugins?.CapacitorHttp?.enabled === true && /function jsonpGet/.test(app));
  } catch (e) {
    ok("fetch() path reachable", false, e.message);
  }

  // The JSONP fallback still has to work, because a plain browser may need it.
  try {
    const jurl = url.replace("&term=", "&callback=__itTEST&term=");
    const txt = await fetch(jurl, { signal: AbortSignal.timeout(20000) }).then(r => r.text());
    ok("JSONP fallback path still returns executable JSONP", /^\s*__itTEST\s*\(/.test(txt),
       txt.slice(0, 24).replace(/\s+/g, " "));
  } catch (e) {
    ok("JSONP fallback reachable", false, e.message);
  }
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (!offline) {
  console.log("  NOT PROVEN HERE: that previews play on the device. Tap Preview on Prairie Strut");
  console.log("  (Chattahoochee / Save a Horse) with the RINGER SWITCH ON SILENT.\n");
}
process.exit(fail ? 1 : 0);
