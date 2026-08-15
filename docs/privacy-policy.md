# ScootSteps — privacy policy & support

**This is already built as a page:** `jonathanbbiles/app-privacy` → `scootstep.html`,
which serves at `jonathanbbiles.github.io/app-privacy/scootstep.html`. It is
committed on `main` in that repo but **not pushed** — one `git push` publishes it.

That URL is what the app's Settings → **Privacy policy ↗** button opens
(`PRIVACY_URL` in `www/js/app.js`), and it is the URL entered in App Store
Connect for **both** the Privacy Policy URL and the Support URL. One page serves
both — Apple allows it — but the page must be **live and returning 200 before
submit**. A 404 privacy URL is an automatic reject.

The originally declared URL was `jonathanscribbles.com/scootstep`. That site is
WordPress on WP Engine, so the route can only be created by hand in WP; the
GitHub Pages page exists because it is version-controlled and publishes with a
push. To go back to the WordPress route instead, paste the copy below into a WP
page and point `PRIVACY_URL` at it.

Everything below is true of the shipped build. Don't add claims to it (no
"we never touch the network", no analytics promises about a future version) —
the policy has to match the code, and the code is checked at review.

---

## Page copy (paste into WordPress)

### ScootSteps

Learn to line dance with animated, top-down footwork diagrams. Ten full dances,
every foundation step, and a count track that keeps you on the beat.

**Support:** jonathanbbiles@gmail.com — questions, bugs, or a dance you'd like
added. I read every one.

---

### Privacy Policy

*Last updated: 29 July 2026*

**The short version: ScootSteps doesn't collect anything about you.** There is
no account, no sign-in, no ads, no analytics, no tracking, and no third-party
advertising or analytics SDK of any kind.

**What ScootSteps stores.** Your streak, which dances you've marked as
"learning" or "know it cold", your practice history, and your settings (count
sound, haptics, text size) are saved in the app's own storage on your device.
That information is never transmitted to me or to anyone else. Deleting the app
deletes it.

**The only thing that leaves your phone.** Every dance, every diagram and the
count track are built into the app and work with no signal. The songs are the
exception. ScootSteps ships with the address of each song's official Apple
30-second preview already built in, so when you tap **Preview** on a dance page
or the **Song** button in the player, the app streams that clip directly from
Apple's audio servers (`audio-ssl.itunes.apple.com`). If a song's address isn't
built in, the app asks Apple's public iTunes Search API (`itunes.apple.com`) for
it using only the song title and artist. Tapping the Apple Music or Spotify link
hands that link to those apps.

Nothing about you or your device is included in any of that — no account, no
identifier, no location, no advertising ID. Apple's and Spotify's handling of
what you send them is governed by their own privacy policies. Those song
features are the only reason ScootSteps ever reaches the internet.

**Music.** ScootSteps does not host, copy or distribute any recording. The
practice audio the app produces itself is an original count track, synthesized on
the phone — that is what plays under the animated footwork, and it is the only
audio the app creates.

Alongside it, ScootSteps offers Apple's own official 30-second preview of the
commercial recording each dance is danced to. That clip is streamed from Apple,
exactly as Apple publishes it, and every song is accompanied by a link that opens
the full track on Apple Music so you can buy or stream it there. ScootSteps is
not affiliated with or endorsed by Apple, Spotify, or any artist or label; song
and artist names are used to identify the recordings a dance is danced to.

**Children.** ScootSteps is rated 4+ and is safe for all ages. Because it
collects no personal information from anyone, it collects none from children.

**Changes.** If this policy ever changes, the updated version will be posted on
this page with a new date.

**Contact.** jonathanbbiles@gmail.com
