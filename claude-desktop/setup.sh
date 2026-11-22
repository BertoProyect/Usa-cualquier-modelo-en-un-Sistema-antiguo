#!/bin/bash
# Primera instalación: prepara herramientas, Electron 32 y la identidad de firma; luego descarga, porta e instala Claude Desktop.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"; cd "$W"
command -v clang >/dev/null || { echo "Falta clang: ejecuta  xcode-select --install"; exit 1; }
command -v node >/dev/null || { echo "Falta Node.js (>= 18)"; exit 1; }
echo "[a] Herramientas (asar, esbuild-wasm, fzstd)"
(cd tools && npm ci --no-audit --no-fund)
if [ ! -x e32/Electron.app/Contents/MacOS/Electron ]; then
  echo "[b] Electron 32.3.3 (último que arranca en macOS 10.15)"
  curl -fL -o e32.zip https://github.com/electron/electron/releases/download/v32.3.3/electron-v32.3.3-darwin-x64.zip
  rm -rf e32; ditto -x -k e32.zip e32; rm -f e32.zip; xattr -cr e32/Electron.app
fi
if ! security find-identity -p codesigning 2>/dev/null | grep -q '"Claude Port Local Signing"'; then
  echo "[c] Identidad de firma local estable (para que llavero y permisos sobrevivan a cada reconstrucción)"
  mkdir -p signing; cd signing
  openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 7300 -config cs.cnf
  LEGACY=""; openssl version | grep -q "OpenSSL 3" && LEGACY="-legacy"
  openssl pkcs12 -export -inkey key.pem -in cert.pem -out id.p12 -passout pass:ccport -name "Claude Port Local Signing" \
    -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 $LEGACY
  security import id.p12 -k ~/Library/Keychains/login.keychain-db -P ccport -T /usr/bin/codesign
  cd "$W"
fi
echo "[d] Descargar, portar e instalar Claude Desktop"
./update.sh --force
