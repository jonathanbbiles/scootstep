#!/usr/bin/env bash
# ============================================================================
# patch-ios-audio.sh — put ScootSteps on the MEDIA volume path, not the ringer.
#
#   usage:  scripts/patch-ios-audio.sh [path-to-repo]
#
# WHY THIS EXISTS
# ---------------
# An iOS app that never sets an AVAudioSession category runs on the system
# default, .soloAmbient. That category is wired to the hardware ringer switch,
# so every sound the app makes — the synthesized count track AND the song
# previews — goes silent the instant the phone is flipped to silent. Which is
# exactly how most people carry a phone into a bar.
#
# Reported symptom: "sound only plays with silent mode OFF". That is the
# signature of this and nothing else.
#
# .playback is the fix: media volume, ignores the mute switch. It cannot be
# declared in Info.plist or capacitor.config.json — there is no key for it. It
# is a runtime call on AVAudioSession, so it has to go in native code.
#
# WHY A PATCH SCRIPT AND NOT A CHECKED-IN AppDelegate.swift
# ---------------------------------------------------------
# ios/ is not in the repo; CI runs `npx cap add ios` and Capacitor generates
# AppDelegate.swift fresh every build. Overwriting it wholesale would silently
# drop whatever plugin lifecycle hooks that Capacitor version ships with, so
# this inserts into the generated file instead — the same approach the build
# already uses for Info.plist, orientation and the app icon.
#
# The patch is IDEMPOTENT (guarded on a marker) and SELF-VERIFYING: it re-reads
# the file afterwards and exits non-zero if anything did not land, so a silent
# no-op fails the build instead of shipping a mute app.
# ============================================================================
set -uo pipefail

APP="${1:-.}"
[ -d "$APP" ] || { echo "patch-ios-audio: no such directory: $APP" >&2; exit 2; }
APP="$(cd "$APP" && pwd)"
DELEGATE="$APP/ios/App/App/AppDelegate.swift"

[ -f "$DELEGATE" ] || {
  echo "patch-ios-audio: $DELEGATE not found — run 'npx cap add ios' first" >&2
  exit 2
}

MARKER="ss_configureAudioSession"

python3 - "$DELEGATE" "$MARKER" <<'PY'
import re, sys

path, marker = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8").read()

if marker in src:
    print("==> already patched — nothing to do")
    sys.exit(0)

# 1. imports, once, next to the existing ones. WebKit is explicit rather than relying on
#    Capacitor re-exporting it: evaluateJavaScript is a WKWebView member, and Swift wants the
#    defining module in scope to call it.
for mod in ("AVFoundation", "WebKit"):
    if not re.search(r'^import %s\s*$' % mod, src, re.M):
        src = re.sub(r'^(import UIKit\s*$)', r'\1\nimport %s' % mod, src, count=1, flags=re.M)

BODY = '''
    // ---- ScootSteps: media-volume audio session -----------------------------
    // Default category is .soloAmbient, which follows the hardware ringer switch:
    // flip the phone to silent and the count track and song previews both die.
    // .playback puts us on the media volume path and ignores the mute switch.
    //
    // Re-asserted rather than set once, because the session can be torn down under
    // us: a phone call or Siri interrupts it, unplugging headphones changes the
    // route, and mediaServicesWereReset wipes it entirely. Each of those leaves the
    // app silent until the category is set again.
    @objc func ss_configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true, options: [])
        } catch {
            NSLog("ScootSteps audio: FAILED to activate .playback - \\(error.localizedDescription)")
            return
        }
        // Read the LIVE session back. Declaring a category and having one are different
        // things; this logs what iOS actually granted us.
        NSLog("ScootSteps audio: category=\\(session.category.rawValue) mode=\\(session.mode.rawValue) active-route=\\(session.currentRoute.outputs.first?.portType.rawValue ?? "none")")
        ss_reportAudioSessionToWebView(session)
    }

    // Hand the resolved category to the web layer so it can be verified ON DEVICE
    // without Xcode attached (Settings -> Audio output shows it).
    @objc func ss_reportAudioSessionToWebView(_ session: AVAudioSession) {
        let payload = "{category:'\\(session.category.rawValue)',mode:'\\(session.mode.rawValue)',ignoresSilentSwitch:\\(session.category == .playback)}"
        DispatchQueue.main.async {
            guard let vc = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = vc.webView else { return }
            webView.evaluateJavaScript("window.__ssAudioSession=\\(payload);", completionHandler: nil)
        }
    }

    @objc func ss_audioSessionInterrupted(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .ended { ss_configureAudioSession() }
    }

    @objc func ss_observeAudioSession() {
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(ss_audioSessionInterrupted(_:)),
                       name: AVAudioSession.interruptionNotification, object: nil)
        nc.addObserver(self, selector: #selector(ss_configureAudioSession),
                       name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        nc.addObserver(self, selector: #selector(ss_configureAudioSession),
                       name: AVAudioSession.routeChangeNotification, object: nil)
    }
    // ---- end ScootSteps audio session ---------------------------------------
'''

# 2. Drop the methods in as the last members of the AppDelegate class.
m = re.search(r'^(class AppDelegate\b[^\n]*\{)', src, re.M)
if not m:
    sys.exit("patch-ios-audio: could not find 'class AppDelegate' in AppDelegate.swift")
depth, i, end = 0, m.end(1) - 1, None
while i < len(src):                       # walk braces to find this class's closing brace
    if src[i] == '{': depth += 1
    elif src[i] == '}':
        depth -= 1
        if depth == 0: end = i; break
    i += 1
if end is None:
    sys.exit("patch-ios-audio: unbalanced braces in AppDelegate.swift")
src = src[:end] + BODY + src[end:]

# 3. Call it at launch and every time we come back to the foreground. Inserting at
#    the TOP of each body so it runs before anything else can touch the session.
def call_first(source, signature_regex, call):
    mm = re.search(signature_regex, source, re.M)
    if not mm:
        return source, False
    brace = source.index('{', mm.start())
    return source[:brace + 1] + "\n        " + call + source[brace + 1:], True

src, launched = call_first(
    src, r'^\s*func application\(_ application: UIApplication,\s*$|^\s*func application\(_ application: UIApplication, didFinishLaunchingWithOptions',
    "ss_configureAudioSession(); ss_observeAudioSession()")
if not launched:
    sys.exit("patch-ios-audio: could not find didFinishLaunchingWithOptions")

src, foregrounded = call_first(
    src, r'^\s*func applicationDidBecomeActive\(', "ss_configureAudioSession()")
if not foregrounded:
    # Older/leaner templates omit it. Add the method rather than silently skipping the
    # foreground re-assert — coming back from background is where the session is lost.
    m2 = re.search(r'^(class AppDelegate\b[^\n]*\{)', src, re.M)
    src = src[:m2.end(1)] + """

    func applicationDidBecomeActive(_ application: UIApplication) {
        ss_configureAudioSession()
    }
""" + src[m2.end(1):]

open(path, "w", encoding="utf-8").write(src)
print("==> patched AppDelegate.swift")
PY
rc=$?
[ "$rc" = 0 ] || { echo "patch-ios-audio: patch step failed (rc=$rc)" >&2; exit "$rc"; }

# ---- verify, loudly. A patch that silently no-ops ships a mute app. --------
fail=0
need() {
  grep -q "$1" "$DELEGATE" || { echo "patch-ios-audio: VERIFY FAILED — missing: $2" >&2; fail=1; }
}
need 'import AVFoundation'                    'import AVFoundation'
need 'setCategory(\.playback'                 'setCategory(.playback ...)'
need 'setActive(true'                         'setActive(true)'
need 'ss_configureAudioSession(); ss_observeAudioSession()' 'launch-time activation'
need 'applicationDidBecomeActive'             'foreground re-assert'
need 'interruptionNotification'               'interruption observer'
need 'mediaServicesWereResetNotification'     'media-services-reset observer'

if [ "$fail" != 0 ]; then
  echo "----- AppDelegate.swift as patched -----" >&2
  cat -n "$DELEGATE" >&2
  exit 1
fi

echo "==> verified: .playback set + activated at launch, re-asserted on foreground,"
echo "    interruption, route change and media-services reset."
echo "    Device log line to look for:  'ScootSteps audio: category=AVAudioSessionCategoryPlayback'"
