#!/usr/bin/env python3
"""
patch-android-gradle.py — inject the release signing config and stamp the version
into the generated android/app/build.gradle.

Run between `cap add android` and the gradle build. Like patch-android.sh, this
exists because android/ is regenerated every build, so neither the signing config
nor the version can be committed.

    python3 scripts/patch-android-gradle.py --version-name 1.0

=============================================================================
WHY versionCode IS MINUTES-SINCE-EPOCH AND NOT THE iOS UTC TIMESTAMP
=============================================================================
The iOS half of this pipeline stamps CFBundleVersion with `date -u +%Y%m%d%H%M`
(e.g. 202608221530) to escape the TestFlight DUPLICATE deadlock. Copying that
scheme to Android looks obviously right and is silently fatal:

    Google Play caps versionCode at 2,100,000,000 (it is a signed 32-bit int).
    202608221530 is ~202 billion — about 96x over the cap.

The failure mode is the Android twin of the build-number collision: Gradle
accepts the literal and produces a perfectly valid, correctly signed AAB, so the
CI build is green and the artifact looks fine. Play rejects it only at UPLOAD
time, with "Version code 202608221530 is not valid. Version codes must be
positive integers less than 2100000000" — i.e. after the pipeline has already
reported success, which is exactly the class of bug that cost this portfolio a
cycle on iOS.

Minutes-since-epoch is the smallest scheme with the same guarantees:
  * monotonic by construction — no network round-trip to ask "what was the last
    one?", which is the query that deadlocked TestFlight;
  * ~29.6 million today, growing 525,600/yr, so it does not reach the 2.1e9 cap
    until roughly the year 5900;
  * one build per minute is a hard floor on cadence, which is far below any real
    build time (~6 min) and is guarded below anyway.
"""
import argparse
import os
import re
import sys
import time

GRADLE = "android/app/build.gradle"
VERSION_CODE_CAP = 2_100_000_000

SIGNING_BLOCK = """    signingConfigs {
        release {
            def kp = new Properties()
            def kpFile = rootProject.file("keystore.properties")
            if (!kpFile.exists()) {
                // Hard-fail rather than fall through to an unsigned artifact.
                // An unsigned AAB builds green and is only rejected when someone
                // tries to upload it, which can be days later.
                throw new GradleException("keystore.properties missing - refusing to build an unsigned release AAB")
            }
            kpFile.withInputStream { kp.load(it) }
            storeFile file(kp['storeFile'])
            storePassword kp['storePassword']
            keyAlias kp['keyAlias']
            keyPassword kp['keyPassword']
            storeType kp.getProperty('storeType', 'PKCS12')
        }
    }
"""


def sub_once(text, pattern, repl, what):
    new, n = re.subn(pattern, repl, text, count=1, flags=re.M)
    if n != 1:
        sys.exit(
            f"patch-android-gradle: expected exactly one {what} in {GRADLE}, found {n}. "
            "The Capacitor template changed - fix this script rather than shipping "
            "an unsigned or misversioned build."
        )
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version-name", required=True,
                    help="marketing version; keep identical to the iOS CFBundleShortVersionString")
    args = ap.parse_args()

    if not os.path.exists(GRADLE):
        sys.exit(f"patch-android-gradle: {GRADLE} not found - run `npx cap add android` first")

    src = open(GRADLE).read()

    if "signingConfigs" in src:
        sys.exit("patch-android-gradle: signingConfigs already present - refusing to patch twice")

    version_code = int(time.time()) // 60
    if not 0 < version_code < VERSION_CODE_CAP:
        sys.exit(f"patch-android-gradle: versionCode {version_code} outside Play's valid range")

    out = sub_once(src, r"^\s*versionCode\s+\d+\s*$",
                   f"        versionCode {version_code}", "versionCode line")
    out = sub_once(out, r'^\s*versionName\s+"[^"]*"\s*$',
                   f'        versionName "{args.version_name}"', "versionName line")

    # Anchor on the template's release buildType. Inserting signingConfigs immediately
    # before `buildTypes` keeps `signingConfigs.release` resolvable from inside it.
    out = sub_once(
        out,
        r"^    buildTypes \{\n        release \{\n            minifyEnabled false$",
        SIGNING_BLOCK
        + "    buildTypes {\n        release {\n"
          "            signingConfig signingConfigs.release\n"
          "            minifyEnabled false",
        "release buildType block",
    )

    open(GRADLE, "w").write(out)

    # --- read back what was actually written, not what we intended to write -------
    check = open(GRADLE).read()
    got_code = re.search(r"versionCode (\d+)", check)
    got_name = re.search(r'versionName "([^"]*)"', check)
    problems = []
    if not got_code or int(got_code.group(1)) != version_code:
        problems.append("versionCode did not land")
    if not got_name or got_name.group(1) != args.version_name:
        problems.append("versionName did not land")
    if "signingConfig signingConfigs.release" not in check:
        problems.append("release buildType is not wired to signingConfigs.release")
    if "storeType" not in check:
        problems.append("signingConfigs block did not land")
    if problems:
        sys.exit("patch-android-gradle: VERIFICATION FAILED - " + "; ".join(problems))

    print(f"==> versionCode {version_code} (minutes since epoch, cap {VERSION_CODE_CAP})")
    print(f"==> versionName {args.version_name}")
    print("==> release signing config injected and verified")
    # Emit for the workflow log / later Play upload bookkeeping.
    print(f"ANDROID_VERSION_CODE={version_code}")


if __name__ == "__main__":
    main()
