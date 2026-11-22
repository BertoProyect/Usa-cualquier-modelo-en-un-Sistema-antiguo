# Usa-cualquier-modelo-en-un-Sistema-antiguo

Cómo usar **Claude Code** y **Claude Desktop** (la app oficial, con navegador interno, pestaña Code, notificaciones y uso del ordenador) con los modelos actuales (**Claude Opus 5.5**…) en un Mac con **macOS 10.15 Catalina**, **sin actualizar el sistema**.

Probado en un MacBookPro11,1 (Intel, 2013, sin Secure Enclave) con macOS 10.15.7, noviembre de 2026.

## La idea, en tres fases

1. **Claude Code viejo que se hace pasar por nuevo** (parte 1). La CLI 2.1.112 es la última en JavaScript puro y arranca en Catalina, pero el servidor la rechaza para los modelos nuevos. Le cambiamos el número de versión a `2.1.280` y el servidor ya nos deja usar `claude-opus-5-5`, el modelo más potente.
2. **Con ese Claude Code + Opus 5.5 portamos Claude Desktop** (parte 2). La app oficial exige macOS 13 (Electron 45 y un addon Swift). La reconstruimos sobre **Electron 32** (el último que arranca en 10.15), transpilamos el código, rellenamos las APIs que faltan y sustituimos lo nativo de macOS 13+ por equivalentes que sí funcionan en Catalina.
3. **Claude Code moderno de verdad** (parte 3). La pestaña Code de Claude Desktop descarga el Claude Code **nativo actual** (2.1.330, compilado para macOS 13). Con unas librerías puente lo hacemos arrancar en Catalina, así que tenemos la última versión completa, no un parche de versión. Además se puede usar desde la terminal.

## Índice

- [Parte 1 · Claude Code 2.1.112 parcheado + VS Code](#parte-1--claude-code-21112-parcheado--vs-code)
- [Parte 2 · Claude Desktop en Catalina](#parte-2--claude-desktop-en-catalina)
- [Parte 3 · Claude Code nativo actual (2.1.330) en Catalina](#parte-3--claude-code-nativo-actual-21330-en-catalina)
- [Problemas que nos encontramos y cómo se resolvieron](#problemas-que-nos-encontramos-y-cómo-se-resolvieron)
- [Qué no funciona (todavía)](#qué-no-funciona-todavía)

---

## Parte 1 · Claude Code 2.1.112 parcheado + VS Code

Es el punto de partida: con esto ya tienes Claude Code con Opus 5.5 en Catalina. Es lo que usamos para construir todo lo demás.

### El problema

- A partir de `@anthropic-ai/claude-code@2.1.114`, la CLI dejó de ser JavaScript puro y pasó a envolver un **binario nativo** compilado para macOS 13+. En Catalina revienta con:
  ```
  dyld: Symbol not found: __ZTVNSt3__115basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEEE
  Referenced from: .../native-binary/claude (which was built for Mac OS X 13.0)
  Expected in: /usr/lib/libc++.1.dylib
  ```
- Lo mismo le pasa a la extensión de VS Code `anthropic.claude-code` a partir de la 2.x: trae ese mismo binario.
- Y VS Code, desde la 1.95 aproximadamente, requiere macOS 11+/12+. Si se autoactualiza, deja de abrir con este aviso:
  ```
  Tienes instalada la versión 10.15.7 de macOS. Esta aplicación requiere macOS 12.0 o posterior.
  ```
- Pero el backend de Anthropic exige **CLI ≥ 2.1.280** para hablar con `claude-opus-5-5`, si no responde:
  ```
  {"error_code":"claude_code_version_too_old"}
  ```

Resumen: no se puede usar ni la CLI nueva, ni la extensión nueva, ni el VS Code nuevo — y la CLI vieja la bloquea el servidor.

### La solución

Combinar tres cosas:

1. **VS Code 1.94.2** (la última versión que arranca en macOS 10.15).
2. **Extensión Claude Code 1.0.31** (la última JS-only; invoca el `claude` del `$PATH` en vez de traer binario nativo).
3. **CLI Claude Code 2.1.112** (la última JS pura) con los **strings de versión parcheados a `2.1.280`** para pasar el gate del servidor.

Para cambiar de modelo basta con `/model claude-opus-5-5` dentro de la sesión (el menú `/model` no lista modelos nuevos, pero acepta el ID completo si lo escribes a mano).

---

### Paso a paso

#### 1.1 VS Code 1.94.2 (universal)

```bash
cd /tmp
curl -L -o vscode.zip "https://update.code.visualstudio.com/1.94.2/darwin-universal/stable"
unzip -q vscode.zip -d vscode-extract
rm -rf "/Applications/Visual Studio Code.app"
mv "vscode-extract/Visual Studio Code.app" /Applications/
xattr -dr com.apple.quarantine "/Applications/Visual Studio Code.app"
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" --version
# Debe imprimir: 1.94.2
```

> **Nota:** la 1.97.2 (`https://update.code.visualstudio.com/1.97.2/darwin/stable`, Intel) también arranca en Catalina (`LSMinimumSystemVersion` 10.15). Sirve como alternativa si necesitas algo más reciente que la 1.94.2.

Bloquea auto-updates (si no, VS Code intentará subirse a una versión que no arranca y verás el aviso de "requiere macOS 12.0"). Desde la interfaz: `Cmd+,` → busca `update mode` → **Update: Mode** = `none` → reinicia VS Code con `Cmd+Q`. O a mano en `~/Library/Application Support/Code/User/settings.json`:

```json
{
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false
}
```

#### 1.2 Extensión Claude Code 1.0.31

```bash
cd /tmp
# El marketplace sirve el .vsix comprimido en gzip, hay que descomprimirlo antes
curl -L -o claude-ext.vsix.gz \
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/1.0.31/vspackage"
gunzip -c claude-ext.vsix.gz > claude-ext.vsix

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
"$CODE" --install-extension /tmp/claude-ext.vsix
```

##### Evita que la CLI reinstale la extensión 2.x (muy importante)

Aunque tengas `extensions.autoUpdate: false`, **la propia CLI de Claude Code** ejecuta `code --install-extension anthropic.claude-code --force` cada vez que se conecta a VS Code (al abrir VS Code, recargar la ventana o lanzar `claude` en su terminal). Eso instala la última 2.x encima de la 1.0.31, y el error `dyld: Symbol not found` vuelve en el siguiente arranque (típicamente: "anoche funcionaba y esta mañana no").

Puedes confirmarlo en los logs de VS Code:

```bash
grep -l '"install-extension":\["anthropic.claude-code"\]' ~/Library/Application\ Support/Code/logs/*/cli.log
```

Desactívalo de dos formas (pon las dos):

1. En `~/.claude.json`, añade en el nivel raíz:
   ```json
   "autoInstallIdeExtension": false
   ```
2. En `~/.claude/settings.json`, dentro de `env`:
   ```json
   "env": {
     "CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL": "1"
   }
   ```

Después reinstala la 1.0.31 (sobrescribe la 2.x) y guarda una copia del `.vsix` para la próxima vez:

```bash
"$CODE" --install-extension /tmp/claude-ext.vsix --force
"$CODE" --list-extensions --show-versions | grep claude
# Debe imprimir: anthropic.claude-code@1.0.31
cp /tmp/claude-ext.vsix ~/claude-code-1.0.31.vsix
```

Reinicia VS Code (`Cmd+Q` y abrir de nuevo).

#### 1.3 CLI Claude Code 2.1.112 con versión parcheada

```bash
# Si tienes nvm, quita cualquier claude instalado en la versión activa
npm uninstall -g @anthropic-ai/claude-code 2>/dev/null

# Instala 2.1.112 en tu prefijo global (ajusta la ruta a tu npm prefix)
npm install -g @anthropic-ai/claude-code@2.1.112

# Localiza el paquete instalado (ejemplo con prefix ~/.npm-global)
CC_DIR="$(npm root -g)/@anthropic-ai/claude-code"

# Backup y parche: reescribe los strings "2.1.112" por "2.1.280"
cp "$CC_DIR/cli.js" "$CC_DIR/cli.js.bak"
sed -i '' 's/"2\.1\.112"/"2.1.280"/g' "$CC_DIR/cli.js"
sed -i '' 's/"2\.1\.112"/"2.1.280"/g' "$CC_DIR/package.json"

# Comprueba
claude --version
# Debe imprimir: 2.1.280 (Claude Code)
```

**Importante**: si tienes `nvm`, asegúrate de que el `claude` del `$PATH` sea el parcheado (no uno roto en `~/.nvm/.../bin/claude`):

```bash
which claude
# Debe apuntar al paquete parcheado, p. ej.: ~/.npm-global/bin/claude
```

#### 1.4 Usar Opus 5.5 (y otros modelos nuevos)

Abre VS Code → panel Claude Code (o lanza `claude` en terminal) y escribe:

```
/model claude-opus-5-5
```

El menú interactivo (`/model` sin argumentos) solo lista los modelos que conocía la CLI 2.1.112, pero si pasas el ID exacto, la API lo acepta.

Mismos IDs disponibles para forzar a mano:

| Modelo | ID |
|---|---|
| Opus 5.5 | `claude-opus-5-5` |
| Fable 5.1 | `claude-fable-5-1` |
| Sonnet 4.6 | `claude-sonnet-4-6` |
| Opus 4.7 | `claude-opus-4-7` |
| Haiku 4.5 | `claude-haiku-4-5` |

### Qué puede romper la parte 1

- Si Anthropic empieza a validar **capacidades reales** (no solo el número de versión), el parche deja de funcionar y hay que actualizar macOS a 11+.
- Cada vez que VS Code o la extensión se autoactualice, volverás al punto de partida. Mantén los flags de `settings.json` desactivados.
- Si vuelve el `dyld: Symbol not found` en VS Code, casi seguro la CLI ha reinstalado la extensión 2.x: revisa que `autoInstallIdeExtension` y `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` sigan puestos y reinstala la 1.0.31.

### Revertir la parte 1

```bash
# Restaurar la CLI
CC_DIR="$(npm root -g)/@anthropic-ai/claude-code"
mv "$CC_DIR/cli.js.bak" "$CC_DIR/cli.js"

# O reinstalar limpio (ojo: @latest no arranca en Catalina)
npm install -g @anthropic-ai/claude-code@2.1.112
```

---

## Parte 2 · Claude Desktop en Catalina

Todo el código está en la carpeta [`claude-desktop/`](claude-desktop). Lo que hace, resumido:

| Pieza | Problema en Catalina | Solución |
|---|---|---|
| Electron 45 | Exige macOS 12+ | Se monta la app sobre **Electron 32.3.3** (último compatible con 10.15) |
| Código JS moderno | Sintaxis/APIs que Chrome 128 / Node 20 no tienen | Se transpila todo `app.asar` con **esbuild-wasm** (el esbuild nativo no arranca en 10.15) a `chrome128`/`node20.18` |
| APIs de Node 22+ | `tls.getCACertificates`, `URL.parse`, zstd, `fs.glob` | Polyfills en `shims/node-shim.js` (zstd con `fzstd`) |
| APIs de Electron 33–45 | `contextBridge.executeInMainWorld`, `net.WebSocket`, `clipboard.read()`/`ClipboardItem`, `View.setBorderRadius` | `shims/preload-shim.js`, `shims/main-shim.js` y parches en `inject.js` |
| Addon `@ant/claude-swift` | Compilado para macOS 13 (AVFAudio, etc.) | Sustituido por `shims/claude-swift.js`: notificaciones con `Electron.Notification`, uso del ordenador con un helper propio (`compat/cuhelper.m`) + `claude-native` para ratón/teclado |
| Uso del ordenador | La app lo bloquea por debajo de macOS 14 | Se parchea `isMacosBelowComputerUseFloor` a `false` |
| Claude Code nativo (pestaña Code) | Binario para macOS 13: faltan símbolos de libc++, libSystem e ICU | Dylibs puente `compat/` + `install_name_tool` automático (parte 3) |
| Firma | La firma ad-hoc cambia en cada build: pide el llavero, bloquea la red y pierde permisos | Identidad local estable **"Claude Port Local Signing"** |
| Actualizaciones | El auto-updater instalaría la versión que no arranca | Desactivado; se actualiza con `update.sh` |
| Icono | El original es Liquid Glass (Assets.car) | `icon/ext.m` lo renderiza a `.icns` desde el propio paquete oficial |

### 2.0 Requisitos

- **Command Line Tools de Xcode** (para `clang`): `xcode-select --install`
- **Node.js 18 o superior** (con nvm vale; probado con Node 22)
- ~3 GB libres (app original + Electron + build)
- La parte 1 no es obligatoria para esto, pero es como lo construimos.

### 2.1 Descargar el port

```bash
git clone https://github.com/BertoProyect/Usa-cualquier-modelo-en-un-Sistema-antiguo.git
cd Usa-cualquier-modelo-en-un-Sistema-antiguo/claude-desktop
```

### 2.2 Instalar (una sola vez)

```bash
./setup.sh
```

`setup.sh` hace, en orden:

1. **Herramientas**: `npm ci` en `tools/` (`@electron/asar`, `esbuild-wasm`, `fzstd`).
2. **Electron 32.3.3** desde GitHub (`electron-v32.3.3-darwin-x64.zip`) en `e32/`.
3. **Identidad de firma local** "Claude Port Local Signing": crea un certificado autofirmado de firma de código (`signing/cs.cnf`) y lo importa en el llavero *login*. Si tu `openssl` es 3.x, exporta el `.p12` con algoritmos *legacy* (si no, `security import` falla con "MAC verification failed"). No hace falta marcarlo como de confianza: `codesign` lo acepta igual.
4. **`update.sh --force`**: descarga la última Claude Desktop oficial (URL sacada de la API de Homebrew, `formulae.brew.sh/api/cask/claude.json`), la porta con `build.sh` y la instala en `/Applications/Claude.app`.

`build.sh` (lo llama `update.sh`), paso a paso:

1. Extrae `app.asar` del Claude.app oficial.
2. Transpila `.vite/` y `node_modules/` a Chrome 128 / Node 20 (`tools/transpile.js`).
3. Inyecta los shims y parches (`inject.js`). Debe imprimir `{ fixBinHook: 1 } { wsFix: 1 } { cuFix: 1 }`; si alguno falla, el build se para (señal de que Anthropic cambió el código y hay que ajustar el parche).
4. Reempaqueta `app.asar` respetando los ficheros *unpacked*.
5. Monta el bundle: Electron 32 renombrado a Claude (ejecutable, helpers, bundle IDs `com.anthropic.claudefordesktop*`), `Info.plist` original con `LSMinimumSystemVersion` = 10.15 y sin `SUFeedURL`, recursos y `Helpers` originales.
6. Compila las dylibs puente y `cuhelper` en `Contents/Frameworks/cc-compat`, y pone el icono.
7. Firma con "Claude Port Local Signing" (o ad-hoc si no existe).

### 2.3 Primer arranque

1. Abre Claude desde Aplicaciones e inicia sesión.
2. Saldrá **"Claude quiere usar la información confidencial guardada en 'Claude Safe Storage'"**. Escribe tu contraseña y pulsa **Permitir siempre** (no solo "Permitir"; si no, volverá a pedirlo y mientras tanto la red de la app falla con `net::ERR_FAILED`).
3. **Notificaciones**: Preferencias del Sistema → Notificaciones → Claude → permitir.
4. **Uso del ordenador**:
   - *Accesibilidad*: Preferencias del Sistema → Seguridad y privacidad → Privacidad → Accesibilidad → candado → marca Claude (o «+» → `/Applications/Claude.app`).
   - *Grabación de pantalla*: misma ventana → Grabación de pantalla. En Catalina una app solo aparece en la lista después de intentar capturar; el port lo intenta solo al arrancar. Si aun así no sale, pulsa «+» y añade `/Applications/Claude.app`. Reinicia Claude después.
5. **Navegador interno**: ya funciona (navegar, leer la página, clics, formularios, capturas, consola y red). Las capturas y `read_page` necesitan que el panel del navegador esté **visible**.

> **Consejo de red:** si alguna web abre en `chrome-error` en el navegador interno, comprueba si el Mac la resuelve (`curl -I https://example.com`). Nos pasó con el DNS de Vodafone (212.166.x.x), que no resolvía `example.com`. Se arregla con DNS públicos:
> ```bash
> networksetup -setdnsservers Wi-Fi 1.1.1.1 8.8.8.8
> ```

### 2.4 Actualizar

No uses el actualizador de la app (está desactivado). Cuando salga una versión nueva:

```bash
cd Usa-cualquier-modelo-en-un-Sistema-antiguo/claude-desktop
git pull          # por si hay parches nuevos
./update.sh       # descarga, porta e instala si hay versión nueva (--force para rehacerla igual)
```

Como la firma es siempre la misma, el llavero y los permisos (Accesibilidad, Grabación de pantalla) se conservan entre versiones.

Si tras actualizar algo falla, mira `~/Library/Logs/Claude/main.log` y busca `is not a function`, `Insufficient number of arguments`, `patch not applied` o `Sentry caught`: casi siempre es una API nueva de Electron que hay que rellenar en `shims/main-shim.js`. Para depurar, `main-shim.js` carga `~/.claude-port-debug.js` si existe.

### 2.5 Desinstalar

```bash
rm -rf /Applications/Claude.app
security delete-identity -c "Claude Port Local Signing"   # opcional
```

---

## Parte 3 · Claude Code nativo actual (2.1.330) en Catalina

La pestaña **Code** de Claude Desktop descarga el Claude Code oficial actual en
`~/Library/Application Support/Claude/claude-code/<versión>/<hash>/claude.app`. Es un binario para macOS 13 que en Catalina muere con `dyld: Symbol not found`.

Cómo lo hacemos arrancar:

1. **Dylibs puente** (`compat/`), compiladas por `build.sh` en `/Applications/Claude.app/Contents/Frameworks/cc-compat/`. Cada una **reexporta** la librería del sistema y añade solo lo que falta:
   - `libcxxCompat.dylib` → `/usr/lib/libc++.1.dylib` + instancias de `std::basic_stringbuf` / `basic_stringstream` (el símbolo `__ZTVNSt3__115basic_stringbuf…` del error).
   - `libSystemCompat.dylib` → `/usr/lib/libSystem.B.dylib` + `__ulock_wait2`, `posix_spawn_file_actions_addfchdir`, `preadv`/`pwritev` (y variantes `2`).
   - `libicuCompat.dylib` → `/usr/lib/libicucore.A.dylib` + funciones ICU más nuevas (`ucal_getHostTimeZone`, `ulistfmt_openForType`, `unumrf_*`, `udtitvfmt_formatCalendarToResult`, `uplrules_selectForRange`…).
2. **Reescritura automática del binario** (`__ccFixBin` en `shims/node-shim.js`): justo después de descargarlo y antes de ejecutarlo, la app hace `install_name_tool -change` de esas tres librerías del sistema a las dylibs puente y vuelve a firmar ad-hoc. Así cada versión nueva que descargue funciona sola.
3. Polyfills de zstd y `fs.glob` en el proceso de Node de la app, que Electron 32 no trae y que hacen falta para descargar e instalar el paquete de Claude Code.

Resultado: en la pestaña Code tienes la **última versión real** de Claude Code (no un número de versión falso) con todos los modelos.

### Usarlo también desde la terminal (opcional)

Ese mismo binario funciona en la terminal, porque ya está enlazado a las dylibs puente:

```bash
CC=$(ls -d ~/Library/Application\ Support/Claude/claude-code/*/*/claude.app/Contents/MacOS/claude | tail -1)
"$CC" --version          # 2.1.330 (Claude Code)
alias claude-new="\"$CC\""
```

Necesita que `/Applications/Claude.app` (el port) esté instalado. La CLI parcheada de la parte 1 sigue siendo la que usa la extensión 1.0.31 de VS Code.

---

## Problemas que nos encontramos y cómo se resolvieron

| Síntoma | Causa | Solución |
|---|---|---|
| `{"error_code":"claude_code_version_too_old"}` | El servidor exige CLI ≥ 2.1.280 | Parche de versión en la CLI 2.1.112 (parte 1) |
| `dyld: Symbol not found: __ZTVNSt3__115basic_stringbuf…` | Binario nativo para macOS 13 | Dylibs puente + `install_name_tool` (parte 3) |
| VS Code: "requiere macOS 12.0" | Auto-actualización de VS Code | VS Code 1.94.2 + `update.mode: none` |
| La extensión vuelve a la 2.x sola | La CLI ejecuta `code --install-extension … --force` | `autoInstallIdeExtension: false` + `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL=1` |
| `esbuild` no arranca | Binario nativo para macOS más nuevo | `esbuild-wasm` |
| Toda la red del proceso principal da `net::ERR_FAILED` y se congela 20–60 s | Firma ad-hoc nueva en cada build → aviso del llavero "Claude Safe Storage" | Identidad de firma estable + **Permitir siempre** |
| "Conectar con tu ordenador" / navegador: bucle "transport flag flipped to net — reconnecting" | Electron 32 no tiene `net.WebSocket` | `inject.js` fuerza el transporte `ws` |
| `TypeError: Cannot create proxy with a non-object` | El sustituto de claude-swift no tenía `vm` | Stub de `vm` (sin virtualización) |
| Sin notificaciones | claude-swift no carga | Notificaciones con `Electron.Notification` |
| Uso del ordenador "requiere macOS 14" | Suelo de versión en la app | Parche `isMacosBelowComputerUseFloor` → `false` |
| Claude no aparece en Grabación de pantalla | En 10.15 solo aparece tras un intento de captura | Captura de prueba al arrancar / añadir con «+» |
| El panel del navegador se cierra o no se recoloca al cambiar a vista móvil o escritorio | `View.setBorderRadius` no existe en Electron 32 | Polyfill en `main-shim.js` |
| `[ClipboardGuard] snapshot failed — Insufficient number of arguments` | `clipboard.read()` sin argumentos y `ClipboardItem` son de Electron 45 | Polyfill en `main-shim.js` |
| `example.com` abre `chrome-error` | El DNS del operador no la resolvía | DNS 1.1.1.1 / 8.8.8.8 |
| `security import`: "MAC verification failed" | OpenSSL 3 exporta PKCS#12 moderno | Exportar con `-legacy` / 3DES / SHA1 |
| "enclave key unavailable" en el log | El Mac no tiene Secure Enclave | Normal; no afecta |

## Qué no funciona (todavía)

- **Dictado de acceso rápido** (el atajo global, macOS 14+). El dictado del chat sí funciona.
- **Máquina virtual / Cowork local** (requiere Virtualization.framework de macOS 13+).
- Con el panel del navegador **oculto**, `read_page` devuelve una página vacía (viewport 0×0) y las capturas fallan: hay que tenerlo visible.
- Si Anthropic cambia el código interno, algún parche de `inject.js` puede dejar de aplicarse. El build se para y lo avisa.
