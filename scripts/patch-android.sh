#!/usr/bin/env bash
#
# patch-android.sh — everything that must be re-applied to the generated Android
# project on every build.
#
# WHY THIS IS A SCRIPT AND NOT COMMITTED NATIVE CODE:
#   android/ is gitignored and regenerated from the Capacitor template by
#   `npx cap add android` on every build, exactly like ios/. Any native change
#   made by hand inside android/ is erased on the next build and would ship as
#   the Capacitor default — the Android twin of the placeholder-icon rejection.
#   So every persistent native fact about this app lives here, runs between
#   `cap add android` and `cap sync android`, and verifies its own work.
#
# Usage:  bash scripts/patch-android.sh <repo-root>
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"
RES="android/app/src/main/res"
MANIFEST="android/app/src/main/AndroidManifest.xml"

[ -d android ] || { echo "patch-android: android/ does not exist — run cap add android first" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Launcher icon + splash — replace the Capacitor placeholders wholesale.
# ---------------------------------------------------------------------------
# The Capacitor template ships its own ic_launcher set and a generic splash.
# Shipping either is a Play "app is not ready" / low-quality-listing risk and,
# on the Apple side, has historically been an outright rejection. Copy the
# committed, pre-rasterised set from android-res/ (see scripts/make-android-assets.sh).
[ -d android-res ] || { echo "patch-android: android-res/ missing — run scripts/make-android-assets.sh" >&2; exit 1; }

# The template's density-specific splashes would still resolve ahead of ours for
# their own bucket, so the placeholder must be deleted, not just overwritten.
rm -rf "$RES"/drawable-land-* "$RES"/drawable-port-*
rm -f  "$RES"/drawable-v24/ic_launcher_foreground.xml \
       "$RES"/drawable/ic_launcher_background.xml \
       "$RES"/values/ic_launcher_background.xml

for d in android-res/mipmap-* android-res/drawable android-res/values; do
  [ -d "$d" ] || continue
  mkdir -p "$RES/$(basename "$d")"
  cp -f "$d"/* "$RES/$(basename "$d")/"
done

# ---------------------------------------------------------------------------
# 2. Splash theme — Android 12+ uses the SplashScreen API, not the window background.
# ---------------------------------------------------------------------------
# Capacitor's generated theme only sets android:background. On API 31+ the system
# ignores that and draws its own splash, so without these attributes the app opens
# on a bare white flash before the navy webview paints.
python3 - "$RES/values/styles.xml" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
old = re.search(r'<style name="AppTheme\.NoActionBarLaunch".*?</style>', s, re.S)
if not old:
    sys.exit("patch-android: AppTheme.NoActionBarLaunch not found in styles.xml")
new = '''<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">@color/splashBackground</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>'''
open(p, 'w').write(s[:old.start()] + new + s[old.end():])
print("==> splash theme patched for the Android 12+ SplashScreen API")
PY

# ---------------------------------------------------------------------------
# 3. Orientation — portrait only, matching the iOS build.
# ---------------------------------------------------------------------------
# ScootSteps is a portrait step-caller; the layout has no landscape treatment and
# the iOS Info.plist is already pinned to UIInterfaceOrientationPortrait. Without
# android:screenOrientation the Android build would rotate and expose a layout no
# one has ever reviewed.
python3 - "$MANIFEST" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
if 'android:screenOrientation' not in s:
    s2, n = re.subn(r'(<activity\b(?![^>]*android:screenOrientation)[^>]*?android:name="\.MainActivity")',
                    r'\1\n            android:screenOrientation="portrait"', s, count=1)
    if n != 1:
        sys.exit("patch-android: could not locate MainActivity in AndroidManifest.xml")
    open(p, 'w').write(s2)
print("==> MainActivity locked to portrait")
PY

# ---------------------------------------------------------------------------
# 4. Gradle memory — the template's 1536m OOMs on a CI instance with R8/AAPT2.
# ---------------------------------------------------------------------------
sed -i.bak 's/^org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g/' android/gradle.properties
rm -f android/gradle.properties.bak
grep -q 'org.gradle.jvmargs=-Xmx4g' android/gradle.properties || {
  echo "patch-android: failed to raise gradle heap" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 5. Self-verification — a silent no-op above must fail the build here, not ship.
# ---------------------------------------------------------------------------
fail=0
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  for f in ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png; do
    [ -s "$RES/mipmap-$d/$f" ] || { echo "MISSING $RES/mipmap-$d/$f" >&2; fail=1; }
  done
done
[ -s "$RES/mipmap-anydpi-v26/ic_launcher.xml" ] || { echo "MISSING adaptive icon xml" >&2; fail=1; }
[ -s "$RES/drawable/splash.png" ]               || { echo "MISSING splash.png" >&2; fail=1; }
grep -q 'ic_launcher_background' "$RES/values/ic_launcher_background.xml" || {
  echo "MISSING ic_launcher_background colour" >&2; fail=1; }
grep -q 'android:screenOrientation="portrait"' "$MANIFEST" || {
  echo "MISSING portrait lock" >&2; fail=1; }
# INTERNET is what fetches the baked Apple preview URLs; without it every song is
# silent on device and nothing in the build would have said so.
grep -q 'android.permission.INTERNET' "$MANIFEST" || {
  echo "MISSING INTERNET permission" >&2; fail=1; }
[ "$fail" = 0 ] || { echo "patch-android: verification FAILED" >&2; exit 1; }

echo "==> android native patches applied and verified"
