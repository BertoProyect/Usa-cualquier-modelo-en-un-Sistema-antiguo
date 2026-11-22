#!/bin/bash
# Descarga la última versión oficial de Claude Desktop, la porta a Catalina e instala.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"; cd "$W"
URL=$(curl -s https://formulae.brew.sh/api/cask/claude.json | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
VER=$(basename "$(dirname "$URL")")
CUR=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" orig/Claude.app/Contents/Info.plist 2>/dev/null || echo none)
echo "Instalada: $CUR  ·  Última: $VER"
if [ "$VER" != "$CUR" ] || [ "${1:-}" = "--force" ]; then
  curl -fL -o claude.zip "$URL"; rm -rf orig; ditto -x -k claude.zip orig; rm -f claude.zip
  ./build.sh
  osascript -e 'quit app "Claude"' 2>/dev/null || true; sleep 3
  rm -rf /Applications/Claude.app; ditto dist/Claude.app /Applications/Claude.app
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Claude.app
  H=$(codesign -dvvv /Applications/Claude.app 2>&1 | awk -F= '/^CDHash=/{print $2}')
  if [ -t 0 ] && [ -n "$H" ] && security find-generic-password -s "Claude Safe Storage" -a "Claude Key" >/dev/null 2>&1; then
    echo "Autorizando la nueva build en el llavero (contraseña de inicio de sesión del Mac):"
    security set-generic-password-partition-list -S "unsigned:,cdhash:$H" -s "Claude Safe Storage" -a "Claude Key" ~/Library/Keychains/login.keychain-db >/dev/null || echo "aviso: si Claude pide el llavero, pulsa 'Permitir siempre' y reinícialo"
  fi
  open /Applications/Claude.app
else echo "Ya está al día."; fi
