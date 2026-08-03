/* ============================================================================
   bake-previews.mjs — resolve every catalog song's real Apple preview URL at
   BUILD time and write it into the shipped bundle.

     node scripts/bake-previews.mjs [--check] [--offline]

   WHY
   ---
   The runtime iTunes Search lookup does not reach Apple from inside the app on
   device. Three transports were tried from the webview — the CapacitorHttp GET
   interceptor, a direct fetch, and a JSONP script tag — and all three failed on a
   live 5G connection. What DOES work from that same webview is a media element
   loading audio from Apple's CDN, which is how the song previews are meant to play
   in the first place.

   So the search moves to where searching actually works: here, in Node, in CI,
   where there is no WKWebView, no origin, no CORS and no ATS. The catalog is fixed
   (ScootSteps Originals reference specific songs), so it is fully resolvable ahead
   of time. The app then does no searching at all — it hands a baked https URL
   straight to an <audio> element.

   OUTPUT
   ------
   www/js/data.previews.js — window.SS_PREVIEWS, keyed "title|artist".
   data.dances.js merges it into each song object, so the rest of the app just sees
   songs that already know their preview and their exact Apple Music track page.

   SAFETY
   ------
   A song that fails to resolve KEEPS its previously baked entry rather than being
   blanked. One flaky build must never strip working URLs out of the app. --check
   exits non-zero if anything is unresolved, for use as a build gate.
   ============================================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "www/js/data.previews.js");
const CHECK = process.argv.includes("--check");
const OFFLINE = process.argv.includes("--offline");

// Load the shipped matcher + catalog exactly as the tests do.
(0, eval)(fs.readFileSync(path.join(ROOT, "www/js/itunes-match.js"), "utf8"));
(0, eval)(fs.readFileSync(path.join(ROOT, "www/js/engine.js"), "utf8"));
(0, eval)(fs.readFileSync(path.join(ROOT, "www/js/data.dances.js"), "utf8"));
const { pick } = globalThis.SS_iTunesMatch;

const key = (t, a) => t + "|" + a;

// Whatever is already baked. Never regress it.
let existing = {};
if (fs.existsSync(OUT)) {
  try {
    const prev = fs.readFileSync(OUT, "utf8");
    const m = prev.match(/window\.SS_PREVIEWS\s*=\s*(\{[\s\S]*?\});/);
    if (m) existing = JSON.parse(m[1]);
  } catch (e) { console.warn("  (could not read existing bake — starting fresh)"); }
}

const songs = [];
const seen = new Set();
for (const d of globalThis.SS_DANCES) {
  for (const s of d.songs || []) {
    if (seen.has(key(s.title, s.artist))) continue;
    seen.add(key(s.title, s.artist));
    songs.push(s);
  }
}

// Same query shapes the app used to try at runtime, so a title Apple carries
// differently ("Save a Horse (Ride a Cowboy)") still lands.
function terms(title, artist) {
  const bare = title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const out = [title + " " + artist];
  if (bare && bare !== title) out.push(bare + " " + artist);
  out.push(title);
  return [...new Set(out.filter(Boolean))];
}

const ENDPOINT = "https://itunes.apple.com/search?media=music&entity=song&country=US&limit=25&term=";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveOne(s) {
  for (const term of terms(s.title, s.artist)) {
    let r;
    try {
      r = await fetch(ENDPOINT + encodeURIComponent(term), { signal: AbortSignal.timeout(20000) });
    } catch (e) { await sleep(1200); continue; }
    if (r.status === 403 || r.status === 429) {         // Apple rate-limits ~20/min
      await sleep(5000);
      continue;
    }
    if (!r.ok) { await sleep(800); continue; }
    let body;
    try { body = JSON.parse(await r.text()); } catch (e) { continue; }
    const hit = pick(body.results, s.title, s.artist);
    if (hit && hit.preview) return hit;
  }
  return null;
}

const baked = Object.assign({}, existing);
let resolved = 0, reused = 0, missing = [];

if (OFFLINE) {
  console.log("bake-previews: --offline, keeping the existing bake as-is");
} else {
  console.log(`bake-previews: resolving ${songs.length} songs\n`);
  for (const s of songs) {
    const k = key(s.title, s.artist);
    const hit = await resolveOne(s);
    if (hit && hit.preview) {
      baked[k] = { preview: hit.preview, view: hit.view || null };
      resolved++;
      console.log(`  OK    ${s.title} — ${s.artist}`);
    } else if (existing[k] && existing[k].preview) {
      baked[k] = existing[k];
      reused++;
      console.log(`  KEEP  ${s.title} — ${s.artist}  (lookup failed; previous bake retained)`);
    } else {
      missing.push(`${s.title} — ${s.artist}`);
      console.log(`  MISS  ${s.title} — ${s.artist}`);
    }
    await sleep(900);                                    // stay well under the rate limit
  }
}

// Drop entries for songs no longer in the catalog, so the file cannot grow forever.
for (const k of Object.keys(baked)) if (!seen.has(k)) delete baked[k];

const header = `/* ============================================================================
   GENERATED — do not edit by hand. Regenerate with:
       node scripts/bake-previews.mjs

   Apple 30-second preview URLs and exact Apple Music track pages for every song in
   the catalog, resolved at BUILD time because the runtime iTunes Search lookup does
   not reach Apple from inside the app on device (see the script header). The app
   hands these straight to an <audio> element, which is the one thing that has always
   worked from the webview.

   Not secret, not user data, and not the recordings — these are Apple's own public
   preview URLs, the same ones the Music app uses.
   ============================================================================ */
`;
const body = "window.SS_PREVIEWS = " + JSON.stringify(baked, null, 2) + ";\n";
fs.writeFileSync(OUT, header + body);

const total = Object.keys(baked).length;
console.log(`\n  ${resolved} resolved, ${reused} kept from a previous bake, ${missing.length} missing`);
console.log(`  ${total}/${songs.length} songs have a baked preview -> ${path.relative(ROOT, OUT)}`);
if (missing.length) {
  console.log("\n  MISSING:");
  for (const m of missing) console.log("    " + m);
}
if (CHECK && total < songs.length) {
  console.error("\nbake-previews: --check and not every song resolved");
  process.exit(1);
}
