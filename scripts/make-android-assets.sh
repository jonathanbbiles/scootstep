#!/usr/bin/env bash
#
# make-android-assets.sh — generate the committed Android launcher-icon + splash
# resources from the single source of truth, appicon-1024.png.
#
# WHY THE OUTPUT IS COMMITTED (and this script is NOT run in CI):
#   The Codemagic Android workflow runs on a Linux instance that has no image
#   toolchain (this Mac has no PIL / ImageMagick / rsvg either — Chrome + sips are
#   the only rasterisers available). Baking the PNGs here and committing them under
#   android-res/ means the build only ever has to `cp`, so a build machine can never
#   fail on a missing rasteriser and the icon that ships is the icon that was
#   reviewed. Re-run this only when appicon-1024.png or BRAND_BG changes.
#
# Usage:  bash scripts/make-android-assets.sh
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="appicon-1024.png"
OUT="android-res"
BRAND_BG="#1F3A5F"          # matches capacitor.config.json backgroundColor
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
[ -x "$CHROME" ] || { echo "missing Chrome at $CHROME" >&2; exit 1; }

B64="$(base64 < "$SRC" | tr -d '\n')"

# Chrome refuses viewports below 500px and crops to --window-size, so every master is
# rendered large and downscaled with sips afterwards.
render() {   # render <html-file> <png-out> <size> [--transparent]
  local html="$1" out="$2" size="$3" transparent="${4:-}"
  local args=(--headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1
              "--window-size=${size},${size}" "--screenshot=${out}")
  [ -n "$transparent" ] && args+=(--default-background-color=00000000)
  "$CHROME" "${args[@]}" "file://${html}" >/dev/null 2>&1
  [ -s "$out" ] || { echo "render failed: $out" >&2; exit 1; }
}

page() {     # page <bg-css> <icon-scale-percent> > file.html
  cat <<HTML
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:$1;}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden;}
  img{width:$2%;height:$2%;display:block;}
</style>
<img src="data:image/png;base64,$B64">
HTML
}

# --- adaptive foreground: 108dp canvas, art confined to the 72dp safe zone ---------
# 72/108 = 66.667%. Anything outside that square is guaranteed-cropped bleed, so art
# placed there would lose the boot's toe and heel under a circular launcher mask.
page "transparent" "66.667" > "$TMP/fg.html"
render "$TMP/fg.html" "$TMP/fg-master.png" 1296 --transparent

# --- splash: brand field with the mark at 38% --------------------------------------
page "$BRAND_BG" "38" > "$TMP/splash.html"
render "$TMP/splash.html" "$TMP/splash-master.png" 1024

rm -rf "$OUT"
mkdir -p "$OUT/mipmap-anydpi-v26" "$OUT/values" "$OUT/drawable"

# density buckets: name:launcher-px:foreground-px  (foreground = launcher * 108/48)
for spec in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  d="${spec%%:*}"; rest="${spec#*:}"; lp="${rest%%:*}"; fp="${rest##*:}"
  mkdir -p "$OUT/mipmap-$d"
  sips -s format png -z "$lp" "$lp" "$SRC" --out "$OUT/mipmap-$d/ic_launcher.png" >/dev/null
  cp "$OUT/mipmap-$d/ic_launcher.png" "$OUT/mipmap-$d/ic_launcher_round.png"
  sips -s format png -z "$fp" "$fp" "$TMP/fg-master.png" --out "$OUT/mipmap-$d/ic_launcher_foreground.png" >/dev/null
done

sips -s format png -z 960 960 "$TMP/splash-master.png" --out "$OUT/drawable/splash.png" >/dev/null

# Play Console store icon (listing asset, not packaged in the AAB).
sips -s format png -z 512 512 "$SRC" --out "$OUT/play-store-icon-512.png" >/dev/null

# --- XML resources -----------------------------------------------------------------
# No <monochrome> layer: the source art is full-colour, and a full-colour monochrome
# layer renders as a solid blob under Android 13 themed icons. Omitting it makes the
# launcher fall back to the normal icon, which is correct here.
for n in ic_launcher ic_launcher_round; do
  cat > "$OUT/mipmap-anydpi-v26/$n.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
XML
done

cat > "$OUT/values/ic_launcher_background.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">$BRAND_BG</color>
    <color name="splashBackground">$BRAND_BG</color>
</resources>
XML

echo "==> wrote $OUT"
find "$OUT" -type f | sort | sed 's/^/    /'
