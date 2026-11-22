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
  open /Applications/Claude.app
else echo "Ya está al día."; fi
