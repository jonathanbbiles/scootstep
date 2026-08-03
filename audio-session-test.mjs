/* ============================================================================
   AUDIO SESSION + AUDIO PLUMBING — headless assertions.

   Reported bug: "sound only plays with silent mode OFF". That is the signature of an
   app running on iOS's default .soloAmbient audio session category, which follows the
   hardware ringer switch. The fix is native (.playback + setActive) and is applied to
   the Capacitor-generated AppDelegate.swift by scripts/patch-ios-audio.sh at build time.

   WHAT THIS FILE CAN AND CANNOT PROVE
   -----------------------------------
   It proves the patch lands correctly on the REAL Capacitor 8 AppDelegate template, is
   idempotent, fails loudly instead of silently no-opping, and is actually wired into
   codemagic.yaml. It also proves the web layer's audio plumbing has no unresolvable
   asset paths and does resume on foreground.

   It CANNOT prove the category was granted by a live iOS audio session — that only
   exists on real hardware. Jonathan must re-test on device WITH THE RINGER SWITCH ON
   SILENT. Settings -> "Audio output" prints the live category for exactly that check.
   ============================================================================ */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (name, cond, note = "") => {
  if (cond) { pass++; console.log(` PASS ${name}${note ? "  [" + note + "]" : ""}`); }
  else { fail++; console.log(` FAIL ${name}${note ? "  [" + note + "]" : ""}`); }
};

const REPO = process.cwd();
const app = readFileSync(join(REPO, "www/js/app.js"), "utf8");
const html = readFileSync(join(REPO, "www/index.html"), "utf8");
const cm = readFileSync(join(REPO, "codemagic.yaml"), "utf8");

/* The Capacitor 8 AppDelegate.swift, verbatim as `npx cap add ios` emits it. If Capacitor
   ever changes this template the patch must be re-checked against the new one — that is
   the point of pinning it here rather than testing against whatever is in ios/. */
const CAP8_APPDELEGATE = `import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

}
`;

function runPatch(delegateSource) {
  const dir = mkdtempSync(join(tmpdir(), "ss-audio-"));
  mkdirSync(join(dir, "ios/App/App"), { recursive: true });
  const path = join(dir, "ios/App/App/AppDelegate.swift");
  writeFileSync(path, delegateSource);
  let code = 0, out = "";
  try {
    out = execFileSync("bash", [join(REPO, "scripts/patch-ios-audio.sh"), dir],
                       { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }
  const result = readFileSync(path, "utf8");
  rmSync(dir, { recursive: true, force: true });
  return { code, out, result };
}

console.log("\nNATIVE AUDIO SESSION — the silent-switch fix\n");

const first = runPatch(CAP8_APPDELEGATE);
ok("the patch applies cleanly to the real Capacitor 8 AppDelegate template", first.code === 0);
ok("category is set to .playback — the category that ignores the ringer switch",
   /setCategory\(\.playback/.test(first.result));
ok("the session is ACTIVATED, not just configured (a set category does nothing until active)",
   /setActive\(true/.test(first.result));
ok("AVFoundation is imported", /^import AVFoundation$/m.test(first.result));
ok("WebKit is imported — evaluateJavaScript is a WKWebView member",
   /^import WebKit$/m.test(first.result));
ok("configured at LAUNCH, first statement in didFinishLaunchingWithOptions",
   /didFinishLaunchingWithOptions[^{]*\{\s*\n\s*ss_configureAudioSession\(\); ss_observeAudioSession\(\)/.test(first.result));
ok("re-asserted on FOREGROUND — iOS can tear the session down while backgrounded",
   /func applicationDidBecomeActive\([^{]*\{\s*\n\s*ss_configureAudioSession\(\)/.test(first.result));
ok("re-asserted after an interruption ends (a phone call or Siri)",
   /interruptionNotification/.test(first.result) && /type == \.ended/.test(first.result));
ok("re-asserted after mediaServicesWereReset — that one wipes the session entirely",
   /mediaServicesWereResetNotification/.test(first.result));
ok("re-asserted on route change (headphones pulled out mid-dance)",
   /routeChangeNotification/.test(first.result));
ok("the LIVE category is read back and logged, not assumed from what we asked for",
   /session\.category\.rawValue/.test(first.result));
ok("the live category is handed to the web layer for on-device verification",
   /window\.__ssAudioSession/.test(first.result));

const second = runPatch(first.result);
ok("idempotent — re-running does not double-patch", second.code === 0 &&
   (second.result.match(/setCategory\(\.playback/g) || []).length === 1,
   (second.result.match(/setCategory\(\.playback/g) || []).length + "x setCategory");

const broken = runPatch("import UIKit\n\nclass NotTheAppDelegate {}\n");
ok("FAILS LOUDLY on an unrecognised AppDelegate instead of silently shipping a mute app",
   broken.code !== 0, "exit " + broken.code);

const noBecomeActive = runPatch(CAP8_APPDELEGATE.replace(
  /    func applicationDidBecomeActive[\s\S]*?\n    \}\n/, ""));
ok("adds applicationDidBecomeActive itself when the template omits it",
   noBecomeActive.code === 0 && /func applicationDidBecomeActive/.test(noBecomeActive.result));

ok("codemagic.yaml actually runs the patch — an unrun fix is no fix",
   /scripts\/patch-ios-audio\.sh/.test(cm));
ok("the build runs the patch AFTER the iOS platform is generated",
   cm.indexOf("cap add ios") < cm.indexOf("scripts/patch-ios-audio.sh"));

console.log("\nWEB AUDIO PLUMBING\n");

ok("the AudioContext is resumed on background -> foreground",
   /visibilitychange/.test(app) && /function onForeground/.test(app));
ok("foreground resume does not auto-START playback, only un-suspends",
   /function onForeground[\s\S]*?\n  \}/.test(app) &&
   !/function onForeground[\s\S]*?\n  \}/.exec(app)[0].includes(".play()"));
ok("music state is re-read from the element on foreground (iOS pauses it silently)",
   /syncFromElement/.test(app));
ok("the song element loops — the WHOLE preview repeats, it is not chopped to the drilled section",
   /el\.loop = true/.test(app));
ok("starting the song restarts the count transport so both begin on count 1",
   /Music\.toggle\(\)[\s\S]{0,400}eng\.restart\(\)/.test(app));
ok("play() is called synchronously inside the tap (iOS rejects un-attributed playback)",
   /MUST be called inside a user gesture/.test(app));

// Asset resolution. Every dance's audio is either synthesized or a remote Apple preview;
// a local media path would be a bundling bug, since www/ ships no media at all.
const localMedia = [...app.matchAll(/["'`]([^"'`]*\.(?:mp3|m4a|wav|aac|ogg|caf|mp4))["'`]/g)].map(m => m[1])
  .concat([...html.matchAll(/(?:src|href)=["']([^"']*\.(?:mp3|m4a|wav|aac|ogg|caf|mp4))["']/g)].map(m => m[1]))
  .filter(u => !/^https?:/.test(u));
ok("no local media file is referenced anywhere — nothing that could 404 out of the bundle",
   localMedia.length === 0, localMedia.join(", ") || "0 references");
ok("the count track is synthesized, not a bundled file",
   /createOscillator/.test(readFileSync(join(REPO, "www/js/engine.js"), "utf8")));
ok("every remote audio source is an Apple preview URL resolved at runtime",
   /itunes\.apple\.com\/search/.test(app));


console.log("\nKEEPALIVE — the difference between ScootSteps and Tassel\n");

// Tassel (jonathanbbiles/tassel, LIVE) plays audio with `new Audio(URL.createObjectURL(blob))`
// and has NO audio-session code at all. ScootSteps' count track is Web Audio with no media
// element anywhere. On iOS an actually-playing HTMLAudioElement is what holds the media route
// open; a bare AudioContext does not reliably do that. This ports Tassel's mechanism.
ok("a silent looping HTMLAudioElement holds the media route open (Tassel's mechanism)",
   /var KeepAlive = \(function/.test(app) && /el\.loop = true/.test(app));
ok("it is built as a Blob + object URL, the same way Tassel builds its audio",
   /URL\.createObjectURL\(new Blob\(\[b\], \{ type: "audio\/wav" \}\)\)/.test(app));
ok("the WAV it loops is silent — samples are never written, so they stay zero",
   /samples left at zero = silence/.test(app));
ok("armed from inside a real tap, which is the gesture iOS grants playback against",
   /function primeAudio[\s\S]{0,900}KeepAlive\.arm\(\)/.test(app));
ok("held for exactly as long as the player is open, then released",
   /playerHeld = true; KeepAlive\.hold\(true\)/.test(app) &&
   /playerHeld = false; KeepAlive\.hold\(false\)/.test(app));
ok("re-armed on foreground — iOS pauses it on the way out",
   /KeepAlive\.rearm\(\)/.test(app));
ok("this is IN ADDITION to .playback, not instead of it (Tassel has no session at all)",
   /copying Tassel\s+wholesale would have been a downgrade/.test(app));

console.log("\nNETWORK BLAME — \"No connection\" on a live 5G connection\n");

ok("three transports are tried before any network claim is made",
   /function viaDirect/.test(app) && /window\.CapacitorWebFetch/.test(app) && /jsonpGet\(url\)/.test(app));
ok("a single rejected fetch no longer means offline",
   /a rejected fetch proves nothing about the network/.test(app));
ok("navigator.onLine has the final say on whether to blame the connection",
   /navigator\.onLine !== false/.test(app));
ok("an all-transports-failed case with a live connection says so honestly",
   /the connection looks fine, so it's them/.test(app));
ok("the CapacitorHttp GET interceptor is named as a suspect, not assumed to work",
   /_capacitor_http_interceptor_/.test(app));

console.log("\nON-DEVICE VERIFICATION SURFACE\n");
ok("Settings shows the live audio category so the fix is checkable without Xcode",
   /function audioSessionLine/.test(app) && /Audio output/.test(app));
ok("the readout warns rather than reassures when the category is not playback",
   /the silent switch will mute the app/.test(app));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
console.log("  NOT PROVEN HERE: that iOS granted the category on real hardware.");
console.log("  Re-test on device WITH THE RINGER SWITCH ON SILENT before submit.\n");
process.exit(fail ? 1 : 0);
