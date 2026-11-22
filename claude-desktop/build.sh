#!/bin/bash
# Construye Claude Desktop para macOS 10.15 sobre Electron 32.
set -euo pipefail; shopt -s nullglob
W="$(cd "$(dirname "$0")" && pwd)"; cd "$W"
ORIG="$W/orig/Claude.app"; E32="$W/e32/Electron.app"; OUT="$W/dist/Claude.app"
ASAR="$W/tools/node_modules/.bin/asar"
rm -rf work dist; mkdir -p work dist
echo "[1/6] Extrayendo app.asar"
$ASAR extract "$ORIG/Contents/Resources/app.asar" work/app
echo "[2/6] Transpilando a Chrome 128 / Node 20"
node tools/transpile.js work/app/.vite
node tools/transpile.js work/app/node_modules
echo "[3/6] Inyectando shims"
node inject.js work/app shims
echo "[4/6] Empaquetando app.asar"
UNP=$(cd "$ORIG/Contents/Resources/app.asar.unpacked" && find . -type f | sed 's|^\./||' | xargs -n1 dirname | sort -u | paste -sd, -)
$ASAR pack work/app work/app.asar --unpack-dir "{$UNP}"
echo "[5/6] Montando bundle"
ditto "$E32" "$OUT"; C="$OUT/Contents"
rm -f "$C/Resources/default_app.asar"
mv "$C/MacOS/Electron" "$C/MacOS/Claude"
for h in "$C/Frameworks/Electron Helper"*.app; do
  b=$(basename "$h" .app); nb="${b/Electron/Claude}"; suf="${b#Electron Helper}"; suf=$(echo "$suf" | tr -d ' ()' | tr 'A-Z' 'a-z')
  mv "$h/Contents/MacOS/$b" "$h/Contents/MacOS/$nb"
  for k in CFBundleExecutable CFBundleName CFBundleDisplayName; do /usr/libexec/PlistBuddy -c "Set :$k $nb" "$h/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$k string $nb" "$h/Contents/Info.plist"; done
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.anthropic.claudefordesktop.helper${suf:+.$suf}" "$h/Contents/Info.plist"
  mv "$h" "$C/Frameworks/$nb.app"
done
cp "$ORIG/Contents/Info.plist" "$C/Info.plist"
P="$C/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable Claude" "$P"
/usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion 10.15" "$P"
/usr/libexec/PlistBuddy -c "Delete :ElectronAsarIntegrity" "$P" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Delete :SUFeedURL" "$P" 2>/dev/null || true
mv work/app.asar "$C/Resources/app.asar"; rm -rf "$C/Resources/app.asar.unpacked"; mv work/app.asar.unpacked "$C/Resources/app.asar.unpacked"
cd "$ORIG/Contents/Resources"
for f in *; do case "$f" in app.asar|app.asar.unpacked) ;; *.lproj) mkdir -p "$C/Resources/$f"; for g in "$f"/*; do [ "$(basename "$g")" = locale.pak ] || cp -R "$g" "$C/Resources/$f/"; done ;; *) rm -rf "$C/Resources/$f"; cp -R "$f" "$C/Resources/" ;; esac; done
cp -R "$ORIG/Contents/Helpers" "$C/Helpers"
cd "$W"
echo "[5b] Dylibs puente para Claude Code nativo + icono nuevo"
D=/Applications/Claude.app/Contents/Frameworks/cc-compat; F="-dynamiclib -mmacosx-version-min=10.15 -O2"; mkdir -p "$C/Frameworks/cc-compat"
clang $F compat/sys.c -o "$C/Frameworks/cc-compat/libSystemCompat.dylib" -install_name $D/libSystemCompat.dylib -Wl,-reexport_library,/usr/lib/libSystem.B.dylib
clang $F compat/icu.c -o "$C/Frameworks/cc-compat/libicuCompat.dylib" -install_name $D/libicuCompat.dylib -Wl,-reexport_library,/usr/lib/libicucore.A.dylib
clang++ $F -std=c++17 compat/cxx.cpp -o "$C/Frameworks/cc-compat/libcxxCompat.dylib" -install_name $D/libcxxCompat.dylib -Wl,-reexport_library,/usr/lib/libc++.1.dylib
clang -fobjc-arc -mmacosx-version-min=10.15 -O2 -framework Cocoa -framework CoreGraphics compat/cuhelper.m -o "$C/Frameworks/cc-compat/cuhelper"
rm -rf work/Claude.iconset
if [ ! -f icon/Claude.icns ]; then [ -x icon/ext ] || clang -fobjc-arc -framework AppKit icon/ext.m -o icon/ext; icon/ext "$ORIG" work/Claude.iconset >/dev/null && iconutil -c icns work/Claude.iconset -o icon/Claude.icns || true; rm -rf work/Claude.iconset; fi
if [ -f icon/Claude.icns ]; then cp icon/Claude.icns work/Claude.icns; else [ -x icon/flat ] || clang -fobjc-arc -framework AppKit icon/flat.m -o icon/flat; icon/flat "$ORIG" work/Claude.iconset >/dev/null && iconutil -c icns work/Claude.iconset -o work/Claude.icns; fi
if [ -f work/Claude.icns ]; then cp work/Claude.icns "$C/Resources/electron.icns"; /usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$P" 2>/dev/null || true; else echo "aviso: no se pudo generar el icono"; fi
echo "[6/6] Firmando"
xattr -cr "$OUT"
SIGN_ID=$(security find-identity -p codesigning 2>/dev/null | awk '/"Claude Port Local Signing"/{print $2; exit}')
codesign --force --deep --sign "${SIGN_ID:--}" "$OUT" 2>&1 | tail -2 || true
echo "Listo: $OUT"
