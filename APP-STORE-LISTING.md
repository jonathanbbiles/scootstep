# App Store listing — ScootSteps (ASO-first, brief §3)

The catalog IS the SEO: every famous dance name is content people already search. Fill this into App Store Connect (Claude-in-Chrome can drive it once you're signed in — remember ASC React inputs need a real click-then-type).

**App name (30):** `ScootSteps: Learn Line Dancing`
**Subtitle (30):** `Country dance, step by step`
**Bundle ID:** `com.jonathanbiles.scootstep`
**Primary category:** Education · **Secondary:** Health & Fitness
**Age rating:** 4+ (no objectionable content)
**Price:** Free. No in-app purchases exist in this build — there is no paywall, no product ID and no Restore control anywhere in `www/`, and `cordova-plugin-purchase` is not installed. Answer the IAP question in ASC with **none**.
**Support / Marketing URL:** https://jonathanbbiles.github.io/app-privacy/scootstep.html
**Privacy Policy URL:** https://jonathanbbiles.github.io/app-privacy/scootstep.html  *(one page serves both — Apple allows it)*

> ⚠️ **That page must be live before submit.** A 404 privacy URL is an automatic
> reject. Ready-to-publish copy is in `docs/privacy-policy.md`.

## Keywords (100 chars, comma-separated, no spaces)
```
line dance,line dancing,learn to line dance,country dance,cupid shuffle,wobble,boot scootin,two step
```

## Promotional text (170)
```
New: 10 dances with animated footwork you can slow down to 40%. Learn the Cupid Shuffle and the Wobble free — walk in Friday and actually join in.
```

## Description
```
Terrified of the line dance at the wedding? ScootSteps gets you off the wall and onto the floor.

Instead of squinting at a video where you can't see the feet, ScootSteps shows you a clean top-down view of two color-coded boots — left teal, right coral — moving count by count on a dance floor. Slow it down, mirror it, loop the tricky 8 counts, and feel every beat with a built-in count track.

TELL US YOUR DEADLINE
"When do you need to dance?" Tonight, this week, or no rush — we build you a plan. Beginner-proof.

LEARN ANY DANCE FOUR WAYS
Watch it full speed → Learn it in 8-count chunks → Drill it slow → Dance it for real, through every wall.

FREE, ALL OF IT
Ten full dances — including the Cupid Shuffle and the Wobble, the two you'll actually need — plus every foundation step in the Basics glossary. No account, no ads, nothing to buy.

WHAT'S INSIDE
• Animated footwork for every dance, adjustable 40–120% tempo (pitch-independent)
• Step-by-step mode with ghost-arrow previews
• Wall compass + mirror view (taught like a real class)
• The dances work with no signal — every step is built in, nothing to download
• Grapevine, jazz box, shuffle, pivot and more, broken down slow
• Hear the real song too — Apple's official 30-second preview, one tap from the full track

No confusing videos. Just you, two boots, and a very good Friday night.
```

## App Review notes (guards against a 4.2 "minimum functionality" flag)
```
ScootSteps teaches line dancing via an original in-house animation engine that renders each dance from structured step data (not videos). To review: open any dance → "Start learning" → step through the 8-count chunks, or "Watch full" and drag the tempo slider. Every dance, diagram and the count track are bundled in the app and work with no network. No login required.

AUDIO: two separate layers, and the distinction matters. (1) The practice audio ScootSteps generates is an ORIGINAL count track, synthesized on device — no recording is bundled, hosted or copied. (2) The optional "Preview" button on a dance page and the "Song" button in the player stream Apple's OWN official 30-second preview of the commercial recording, straight from Apple's servers, and every song carries a one-tap link that opens the full track in the user's music service. Those buttons are the only feature that needs the internet and they fail gracefully offline. ScootSteps is not affiliated with or endorsed by any music service, artist or label; song and artist names identify the recording each dance is danced to.

This build contains NO in-app purchases: no paywall, no products, no Restore control.
```

## Screenshots (iPhone 6.7" = 1290×2796; 6.5" = 1284×2778). iPhone-only → NO iPad set required.
Suggested 6, first two matter most:
1. Player (Cupid Shuffle) — caption "See every step, count by count"
2. Tempo slider at 60% — "Slow it down till it clicks"
3. Onboarding "When do you need to dance?" — "Tell us your deadline"
4. Library grid — "Ten dances, every basic"
5. Learn/step mode with ghost arrow — "Learn it in 8-count chunks"
6. Glossary — "Master the basics, slow"

## Privacy (App Privacy questionnaire)
Data collected: **None.** Answer "Data Not Collected." No account, no ads, no
analytics, no tracking SDK, no IDFA. All progress (streak, shelf, settings) is
written to `localStorage` on the device and never sent anywhere.

The one network call the app makes — state it accurately, don't claim "no
network calls": tapping **Preview** on a song sends the song title and artist to
Apple's public iTunes Search API (`itunes.apple.com/search`) to fetch Apple's own
30-second preview and the matching Apple Music link. Nothing about the user goes
with that request, and it is not tracking, so "Data Not Collected" is still the
correct answer.
