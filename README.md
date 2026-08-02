# ScootSteps

Learn to line dance with animated top-down footwork diagrams — count-by-count, tempo-adjustable, offline. Duolingo-style bite-size lessons meet a beautiful animated step sheet, so a total beginner can walk into the bar Friday and join in.

iOS-first, Capacitor-wrapped web app. **Build 1 = free, iPhone-only, everything unlocked, no mocks.**

---

## Status (build 1 — Milestone-1 alpha)

| Layer | State |
|---|---|
| Step Engine (brief §5/§8) | ✅ real animation, audio-clock-driven, per-action easing, tempo 40–120%, step-by-step, ghost arrows, loop-a-section, wall compass + full rotation, mirror |
| Catalog | ✅ 10 real dances, 339 step events, all validated & playable |
| Glossary | ✅ 10 foundation steps as mini-dances |
| App | ✅ Onboarding (Panic Mode), Home/Tonight, Library (typo-tolerant search + filters), Dance Detail, Player (Watch + Learn/Drill), My Dances, Settings, cheat-sheet export |
| Monetization | ⛔ **not shipping.** No purchase screen, no product IDs, no Restore control, no purchase plugin. Everything is free and nothing says otherwise. Parked in `docs/build2-monetization/` |
| Accessibility (§9) | ✅ shape+letter-coded feet, haptic counts, VoiceOver labels, adjustable text, reduced-motion |
| Native wrap | ✅ Capacitor 8, portrait/iPhone-only, icon embedded |
| Signing / TestFlight | ⏸ owned by the signing session (see below) |

## What's in here

```
www/
  index.html            shell + theme (§10) + all views + player HUD
  js/engine.js          the Step Engine (reusable renderer + transport)
  js/data.dances.js     the 10-dance catalog (authoring DSL -> §8 schema)
  js/data.glossary.js   10 foundation-step mini-dances
  js/sections.js        Learn-mode section model (8-count blocks / whole dance / ribbon)
  js/itunes-match.js    picks the right recording out of an iTunes Search result set
  js/app.js             router, screens, player wiring, Learn Paths, state
appicon-1024.png        app icon master — cowboy boot (rendered from tools/appicon.svg)
tools/appicon.svg       the icon source; re-render with headless Chrome --screenshot
scripts/shots.mjs       renders screenshots/ at 1290×2796 from the CURRENT www/
screenshots/            App Store screenshots — RE-RUN shots.mjs after any UI change
docs/privacy-policy.md  the page copy behind the Privacy Policy / Support URL
docs/build2-monetization/  the parked IAP module — NOT loaded by the app
capacitor.config.json   appId com.jonathanbiles.scootstep, appName "ScootSteps"
codemagic.yaml          iOS → TestFlight (Capacitor 8 / SPM); portrait + iPhone-only
```

State persists in `localStorage` (works in the Capacitor webview). No analytics SDK, no accounts, no ads. Every dance, diagram and count tick is bundled, so the whole learning flow works with no signal (the bar has none). **One** feature touches the network — the song **Preview** button hits Apple's public iTunes Search API for Apple's own 30-second clip and the matching Apple Music link. Say it that way in the listing and the privacy policy; "no network calls" would be false.

## Adding a dance = a data task (the moat)

Author in `data.dances.js` with the tiny DSL. Each event lands **on** its count; positions are on a −2..2 grid (neutral `L[-0.5,0] R[0.5,0]`):

```js
ev(1, "R", "side",  1.0, 0),                         // Right foot steps to the side, takes weight
ev(4, "L", "touch", 1.05, 0, { w:false, cue:"Clap!" }), // Left touches, no weight, styling pop-in
ev(29,"L", "step", -0.5, 0.55, { turn:-90, cue:"New wall!" }) // ¼-turn left
```
Actions: `step side cross walk together strut rock touch tap scuff brush kick hitch stomp hold clap`.
Run `node validate-dances.mjs` — it checks schema, phrase coverage, on-grid bounds, no NaN, and that the walls close (e.g. a 4-wall dance's per-rep turn × 4 = 360°).

## Monetization — deliberately absent from build 1

The app ships **entirely free** and there is no commerce surface anywhere in
`www/`: no purchase screen, no product IDs, no price copy, no Restore control,
and `cordova-plugin-purchase` is not a dependency. That is the point — a buy
button that can't reach StoreKit, or a Restore button that returns immediately,
is a dead control (Guideline 2.1) and a price the app can't charge is a 2.3.1.

The gating module is parked, unwired, in `docs/build2-monetization/` with the
turn-it-on checklist. Products must exist in App Store Connect **before** any of
it comes back.

## Hand-off to the signing session (do NOT run Codemagic before this)

Code is done and pushed. To ship to TestFlight (PLAYBOOK §5–6):
1. Register App ID `com.jonathanbiles.scootstep` (developer.apple.com → Identifiers).
2. Create the ASC app record; put its numeric id in `codemagic.yaml` → `ASC_APP_ID`.
3. Set `<ASC_KEY_NAME>` to the reusable ASC API key in Codemagic.
4. Ensure Code signing identities hold `JB_Shared_Distribution` **and** an app_store profile for this bundle id bound to it (§0.4).
5. Add the repo in Codemagic → run **ios-testflight**. Capacitor 8 = SPM → archives `.xcodeproj` (the default). iPhone-only + portrait, so **no iPad 13" screenshots needed**.

## Legal & credits (brief §3, §13)

- **No copyrighted music, ever.** The app plays a synthesized count/metronome track only. Song titles are referenced as facts with Apple Music / Spotify **search deep links** — never streamed or bundled.
- Dance **step patterns are not copyrightable**; all descriptions, animations, and practice audio are original.
- Choreographers credited where known (e.g. Boot Scootin' Boogie — line dance by Bill Bader, 1992). Public-domain classics and original beginner combos are prioritized.
- **"Electric Slide" is intentionally held** from the shipped 10 (choreographer Ric Silver has historically enforced it) — the Wedding pack substitutes an original cha-cha-style pattern. Revisit with a permission/legal check before adding it.
- App collects **no personal data** — answer "Data Not Collected" in the App Privacy questionnaire. Support: jonathanbbiles@gmail.com.
- **Privacy Policy URL and Support URL are both** https://jonathanbbiles.github.io/app-privacy/scootstep.html — one page serves both, and it must be LIVE before submit; a 404 privacy URL is an automatic reject. The page is written and committed at `jonathanbbiles/app-privacy` → `scootstep.html`, alongside the Bull or Bust one; it goes live on `git push` and nothing else. It was NOT pushed automatically — publishing public content is Jonathan's call. `jonathanscribbles.com/scootstep` (no scheme on purpose — the auditor resolves every https:// URL in this file) was the original declared URL, but that site is WordPress on WP Engine, so the route can only be made by hand in WP; if you'd rather have it there, publish the same copy and change `PRIVACY_URL` in `www/js/app.js` back. Copy: `docs/privacy-policy.md`.

## Validation

`npm test` runs the whole suite. `npm run test:offline` skips the live-network half.

- `node engine-schema-test.mjs` — engine math (12 checks)
- `node validate-dances.mjs` — all 10 dances (schema, bounds, wall closure)
- `node audio-transport-test.mjs` — the count track: Learn-mode ticks, suspended-context
  resume, mute, Watch-mode transport (9 checks)
- `node itunes-match-test.mjs` — song preview + song deep-link resolution. Fixtures pin the
  known failure modes (tribute/karaoke/instrumental cuts outranking the real recording), then
  every catalog song is resolved against the **live** iTunes Search API. `--offline` skips the
  live half.

> **Missing:** `smoke-test.mjs`, `render-catalog.mjs` and `gen-icon.mjs` were documented here but
> are not in the repo — they have never been committed. The jsdom smoke test in particular is
> worth restoring; there is no dependency on jsdom in `package.json` today.

## The count track (why it is scheduled, not fired)

The VISUAL transport runs on `performance.now()`, so the animation never freezes even when iOS
keeps the audio context suspended. The COUNT TRACK does **not** run off the frame loop. Ticks are
queued ahead on the AUDIO clock from an anchor that maps beat → audio time (`schedule()` in
`engine.js`), driven by both rAF and a 40 ms timer so a stalled frame loop cannot starve it.

Three things this fixes, all reported from TestFlight as "weird clicking sounds":

* **Envelope clicks.** Ticks used to be scheduled at `currentTime + 0.0005` — inside the render
  quantum already being computed — so the attack ramp began in the past and the first rendered
  sample jumped to a non-zero gain. Every tick now opens from true zero and ramps back to true
  zero *before* `stop()`, so nothing is ever truncated mid-waveform.
* **Pile-ups.** A suspended context has a frozen `currentTime`. The old code registered a fresh
  `resume().then(fire)` for every dropped tick, so when the resume landed they all fired on the
  same instant. A suspended context now queues nothing and re-asks at most once every 400 ms.
* **Jitter and holes.** Firing on the frame that noticed the count flip inherited a frame of
  jitter plus every main-thread stall. The lookahead widens automatically when passes get ragged,
  and genuinely-late ticks are dropped rather than played behind the beat.

`count-track-test.mjs` pins all of it against a fake AudioContext with a controllable clock.

## Learn mode: sections and the whole dance

Section selection lives in `js/sections.js` so it is testable headlessly (`sections-test.mjs`).
The drill strip **wraps**; "the whole dance" is its own always-visible row, not a chip. It used to
be the last chip in a no-wrap flex strip with the scrollbar hidden — at 375 px that put it 56 px
off the right edge with no affordance, so the dance could only ever be drilled 8 counts at a time.
The 8 ribbon cells show the section's REAL counts (17–24, not 1–8 relabelled).

## Music in the player

The count track is a synth metronome and is tempo-variable (40–120%); a record is not, so the two
can never be locked together. The player therefore carries the song as a **separate layer**: the
30-second Apple preview on loop, with a deep link to the full track, and a Counts toggle if you
want the song alone. The preview URL is resolved and the element buffered when the player *opens*,
so the Music tap only has to call `play()` — synchronously, inside the gesture, as iOS requires.

## Choreography sourcing

Named real dances are matched count-for-count to published step sheets (CopperKnob is the
standard repository). The six "ScootSteps Originals" are our own choreography and have no
external sheet to match. Notes live in comments above each corrected dance in
`www/js/data.dances.js`. Never guess choreography — if a dance can't be verified against a real
sheet, flag it rather than shipping plausible-but-wrong steps.
