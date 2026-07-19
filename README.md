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
| App | ✅ Onboarding (Panic Mode), Home/Tonight, Library (typo-tolerant search + filters), Dance Detail, Player (Watch + Learn/Drill), My Dances, Settings, Paywall, cheat-sheet export |
| Monetization | ✅ full Pro-gating built; ships **free** (no dead buy button); flip-to-config for build 2 |
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
  js/iap.js             Pro gating + StoreKit (CdvPurchase) — flip-to-config
  js/app.js             router, screens, player wiring, Learn Paths, state
appicon-1024.png        app icon master (boot-chevron up-arrow; embedded on build)
capacitor.config.json   appId com.jonathanbiles.scootstep, appName "ScootSteps"
codemagic.yaml          iOS → TestFlight (Capacitor 8 / SPM); portrait + iPhone-only
```

State persists in `localStorage` (works in the Capacitor webview). No network, no analytics SDK, no accounts — fully offline (the bar has no signal).

## Adding a dance = a data task (the moat)

Author in `data.dances.js` with the tiny DSL. Each event lands **on** its count; positions are on a −2..2 grid (neutral `L[-0.5,0] R[0.5,0]`):

```js
ev(1, "R", "side",  1.0, 0),                         // Right foot steps to the side, takes weight
ev(4, "L", "touch", 1.05, 0, { w:false, cue:"Clap!" }), // Left touches, no weight, styling pop-in
ev(29,"L", "step", -0.5, 0.55, { turn:-90, cue:"New wall!" }) // ¼-turn left
```
Actions: `step side cross walk together strut rock touch tap scuff brush kick hitch stomp hold clap`.
Run `node validate-dances.mjs` — it checks schema, phrase coverage, on-grid bounds, no NaN, and that the walls close (e.g. a 4-wall dance's per-rep turn × 4 = 360°).

## Monetization — flip for build 2

Everything is wired; build 1 just ships free. To turn it on:
1. In `www/js/iap.js` set `MONETIZATION_ENABLED = true`.
2. Create these exact SKUs in App Store Connect (brief §6.5) and complete the **Paid Apps Agreement** (Business → banking + tax → "Active"):
   - `com.jonathanbiles.scootstep.pro.monthly` — auto-renewable, **$6.99/mo**
   - `com.jonathanbiles.scootstep.pro.yearly` — auto-renewable, **$29.99/yr**
   - `com.jonathanbiles.scootstep.pro.lifetime` — non-consumable, **$59.99**
   - `com.jonathanbiles.scootstep.pack.wedding` — non-consumable gift pack, **$4.99**
3. `npm i cordova-plugin-purchase && npx cap sync ios` (the CdvPurchase v13 bridge).

That's the only change — gating logic, locks, tempo caps, and the paywall UI already exist and are exercised by the flag. **Free tier stays 5 dances (incl. Cupid Shuffle + the Wobble) + all glossary + limited tempo.** Pro grants only from `store.when().verified()` — never optimistically, never from a guard (the ChordLoop `IAP_PATTERN.md` trap that once gave the product away free is avoided by construction).

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
- App collects **no personal data** (privacy policy can state "none"). Support: jonathanbbiles@gmail.com.

## Validation

- `node engine-schema-test.mjs` — engine math (12 checks)
- `node validate-dances.mjs` — all 10 dances (schema, bounds, wall closure)
- `node smoke-test.mjs` — full app in jsdom, every screen + flow (28 checks)
- `node render-catalog.mjs` / `node gen-icon.mjs` — visual proof frames
