# Android / Google Play pipeline

ScootSteps is the pilot for porting the app portfolio from Apple-only to
Capacitor → Codemagic → **signed release AAB** → Google Play. This file is both
the record of how it works here and the checklist for copying it to the other apps.

It was picked as the pilot for one reason: it is the lowest native-risk live app.
Three plugins (`@capacitor/core`, `@capacitor/haptics`,
`@capacitor-community/in-app-review`), all with real Android implementations, and
no in-app purchase — so nothing had to be re-engineered from StoreKit to Google
Play Billing before the pipeline itself could be proven.

## Shape

Identical in structure to the iOS half, on purpose:

| | iOS | Android |
|---|---|---|
| native project | `ios/` — gitignored, `npx cap add ios` each build | `android/` — gitignored, `npx cap add android` each build |
| persistent native config | build steps between `cap add` and `cap sync` | `scripts/patch-android.sh`, `scripts/patch-android-gradle.py` |
| workflow | `ios-testflight` | `android-release` |
| signing | ASC API key + stored provisioning profile | PKCS12 upload keystore in secure Codemagic vars |
| output | signed `.ipa` → TestFlight | signed `.aab` → (Play, once the account is verified) |

**`android/` is regenerated on every build.** Anything hand-edited inside it is
erased and ships as the Capacitor default. Every persistent native fact therefore
lives in a script that runs at build time and verifies its own work.

## Files

| Path | What it does | Runs where |
|---|---|---|
| `scripts/make-android-assets.sh` | Rasterises the launcher icon (legacy + adaptive) and splash from `appicon-1024.png` into `android-res/`. | **On a Mac, by hand.** Output is committed. |
| `android-res/` | The committed, pre-rasterised resources. | — |
| `scripts/patch-android.sh` | Installs those resources over the Capacitor placeholders, wires the Android 12+ SplashScreen API, locks `MainActivity` to portrait, raises the Gradle heap, then verifies every one of those landed. | Codemagic, after `cap add android` |
| `scripts/patch-android-gradle.py` | Injects the release `signingConfig` and stamps `versionCode`/`versionName`, then reads `build.gradle` back to prove it. | Codemagic, after `cap add android` |
| `codemagic.yaml` → `android-release` | The workflow. | Codemagic |

`make-android-assets.sh` runs on a Mac and commits its output because the build
image has no image toolchain (and neither does this laptop — Chrome and `sips`
are the only rasterisers available). The build only ever has to `cp`, so it can
never fail on a missing rasteriser, and the icon that ships is the icon that was
reviewed.

## Signing

The upload keystore is a 4096-bit RSA PKCS12, valid 30 years, at:

```
~/.config/android-keystores/scootstep-upload.p12      (+ .pass alongside)
```

**This file is irreplaceable once Google Play has seen it.** Losing it means
opening a Google support case to reset the app's upload key. It is not in the
repo, not in any cloud drive, and `~/.config/android-keystores/` needs a real
backup. Its certificate fingerprint is public and is pinned in `codemagic.yaml`.

It reaches CI only through the **secure Codemagic variable group `google_play`**
on this app: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. `.gitignore` blocks `*.p12`,
`*.jks`, `*.keystore`, `*.p8` and `keystore.properties`.

It was built with `openssl`, not `keytool`, because this Mac has no JDK. PKCS12 is
Java's own default keystore format since JDK 9, so that is fine — but openssl will
happily default to a legacy RC2-40 PBE that JDK 17+ refuses to read, and Gradle
reports that as an opaque *"keystore password was incorrect"*. The generator forces
`-keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256`, and the first build step
proves `keytool` can open the keystore before Gradle is allowed to start.

## The two "green proves nothing" traps this is built to avoid

The iOS side of this factory already paid for a build-number collision that kept
every build out of TestFlight while Codemagic reported green. Android has two of
the same shape, and both are guarded:

**1. `versionCode` must not be the iOS timestamp.** The iOS workflow stamps
`CFBundleVersion` with `date -u +%Y%m%d%H%M`. Copying that to Android looks
obviously right and is silently fatal: **Google Play caps `versionCode` at
2,100,000,000** (signed 32-bit int), and a 12-digit UTC timestamp is ~96× over it.
Gradle accepts the literal and emits a valid, correctly signed AAB — so CI is
green and the artifact looks fine — and Play refuses it only at upload time.
`patch-android-gradle.py` uses **minutes since epoch** instead: monotonic by
construction, no network round-trip to ask "what was the last one?" (that query is
exactly what deadlocked TestFlight), ~29.6 million today, and it does not reach the
cap until roughly the year 5900.

**2. An unsigned AAB also builds green.** A missing `keystore.properties` throws a
`GradleException` rather than falling through to an unsigned artifact, and after
the build the workflow re-opens the finished bundle, runs `jarsigner -verify`, and
compares the signing certificate's SHA-256 against the pinned fingerprint. A
bundle signed by *no* key, or by the *wrong* key, fails in CI instead of at the
Play upload screen.

## Gotchas hit proving this (all fixed here)

- **`linux_x2` is not on the billing plan.** A build requesting it dies instantly
  with *"The selected instance type is not available with the current billing
  plan"* — before any step runs, with an empty log and no `workflowId`. The Mac
  pool that already builds iOS carries the Android SDK and a JDK, so
  `instance_type: mac_mini_m2` is what Android builds on here too.
- **`npm install @capacitor/android --save` writes a caret range.** This repo pins
  `@capacitor/core` and `@capacitor/ios` exactly *and* gitignores
  `package-lock.json`, so the local install looked fine while CI resolved the range
  fresh to a newer `@capacitor/android` whose peer requirement no longer matched
  the pinned core — `ERESOLVE`, only ever on the build machine. **Pin
  `@capacitor/android` to the same exact version as `@capacitor/core`.** Do not
  reach for `--legacy-peer-deps`: that ships a mismatched Capacitor runtime and
  native shell.
- **macOS ships BSD `base64`** (decode is `-D`, not GNU's `--decode`). The keystore
  is decoded in Python straight from the environment, which also keeps the value
  out of `argv`.
- **AGP 8 removed automatic SDK downloading.** A `compileSdk` the image does not
  happen to ship fails deep inside Gradle configuration with a message that reads
  like a plugin error, so the workflow installs the platform explicitly with
  `sdkmanager` first.
- **Capacitor's `org.gradle.jvmargs=-Xmx1536m`** is not enough for AAPT2/R8 on CI.

## Replicating this on the other five apps

Per app, in order. Steps 1–7 are mechanical; step 0 is the only one that needs
thought.

0. **Check the plugins have Android implementations** and that anything native is
   actually portable. See the risk table below.
1. `npm install @capacitor/android@<exact same version as @capacitor/core> --save`,
   then confirm `package.json` has no caret on it.
2. Add `android/` and the signing-material globs to `.gitignore`.
3. Copy `scripts/make-android-assets.sh`, set `BRAND_BG` to the app's
   `capacitor.config.json` `backgroundColor`, run it, commit `android-res/`.
4. Copy `scripts/patch-android.sh` and `scripts/patch-android-gradle.py`. Adjust
   the orientation lock if the app is not portrait-only, and the
   `patch-android-gradle.py` anchors if the app is on **Capacitor 6** rather than 8
   (Receiptless is) — the template's `build.gradle` differs, and the script is
   written to fail loudly rather than silently no-op when it does.
5. **Generate that app's own upload keystore** — one per app, never shared:
   ```
   openssl req -x509 -newkey rsa:4096 -sha256 -days 10950 -nodes \
     -keyout k.pem -out c.pem -subj "/CN=Jonathan Biles/O=Jonathan Biles/C=US"
   openssl pkcs12 -export -name upload -inkey k.pem -in c.pem \
     -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256 \
     -passout "pass:$PW" -out ~/.config/android-keystores/<app>-upload.p12
   ```
   Record its SHA-256 fingerprint for the workflow's pin.
6. Store the four secure variables in a `google_play` group on **that app's**
   Codemagic app (`POST /apps/{appId}/variables`, `"secure": true`).
7. Copy the `android-release` workflow, changing `PACKAGE_NAME` (= the iOS bundle
   id), `VERSION_NAME` (= the iOS `CFBundleShortVersionString`),
   `ANDROID_UPLOAD_CERT_SHA256`, and the app-specific patch step. Push to a branch
   the iOS workflow does not watch, so the port does not fire an iOS build.

### Per-app risk

| App | Repo | Plugins needing Android | Verdict |
|---|---|---|---|
| **ScootStep** | `scootstep` | haptics, in-app-review | **Done — the pilot.** |
| **Tassel** | `tassel` | browser, filesystem, share, haptics | Pipeline-only. All official plugins. Next easiest. |
| **Permission** | `permission-app` | + `@capgo/capacitor-native-biometric`, `capacitor-voice-recorder` | Pipeline + permissions work: needs `RECORD_AUDIO` and the Android 13+ runtime-permission prompt, and biometrics move from Face ID to `BiometricPrompt`. |
| **ChordLoop** | `ChordLoop-iOS` | + `cordova-plugin-purchase` | Needs **Google Play Billing**: the Pro product must be recreated in the Play Console, and billing can only be tested through a Play track. |
| **Bull or Bust** | `bullorbust` | + `cordova-plugin-purchase`, `capacitor-secure-storage-plugin` | Same billing work as ChordLoop. Secure storage moves to the Android Keystore. |
| **Receiptless** | `paperfree` | + first-party `plugins/receipt-ocr` (**iOS/Vision only**), local-notifications, purchase | **Highest risk — real native work.** The OCR plugin has no Android implementation at all; it needs a genuine ML Kit Text Recognition port. Also still on Capacitor 6. Do this one last. |

## Google Play — not wired up yet

The developer account (individual, *Jonathan Biles*) is paid and in Google's
identity-verification queue, so nothing is uploaded yet. `publishing.google_play`
is deliberately absent from the workflow — a publishing block pointing at a track
that does not exist fails the build *after* a successful compile. The block to add
once the account is live is written out, commented, at the bottom of the workflow.

Note that the **first** release of each app has to be uploaded to the Play Console
by hand once; Play will not accept an API upload for an app that has no release yet.
