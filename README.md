# Usa-cualquier-modelo-en-un-Sistema-antiguo

Guía para usar **Claude Code** con el modelo **Claude Opus 5.5** (y el resto de modelos 2026) desde **VS Code** en un Mac con **macOS 10.15 Catalina**, donde ni la última versión de VS Code ni la última CLI de Claude Code arrancan.

## El problema

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

## La solución

Combinar tres cosas:

1. **VS Code 1.94.2** (la última versión que arranca en macOS 10.15).
2. **Extensión Claude Code 1.0.31** (la última JS-only; invoca el `claude` del `$PATH` en vez de traer binario nativo).
3. **CLI Claude Code 2.1.112** (la última JS pura) con los **strings de versión parcheados a `2.1.280`** para pasar el gate del servidor.

Para cambiar de modelo basta con `/model claude-opus-5-5` dentro de la sesión (el menú `/model` no lista modelos nuevos, pero acepta el ID completo si lo escribes a mano).

---

## Paso a paso

### 1. VS Code 1.94.2 (universal)

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

### 2. Extensión Claude Code 1.0.31

```bash
cd /tmp
# El marketplace sirve el .vsix comprimido en gzip, hay que descomprimirlo antes
curl -L -o claude-ext.vsix.gz \
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/1.0.31/vspackage"
gunzip -c claude-ext.vsix.gz > claude-ext.vsix

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
"$CODE" --install-extension /tmp/claude-ext.vsix
```

#### Evita que la CLI reinstale la extensión 2.x (muy importante)

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

### 3. CLI Claude Code 2.1.112 con versión parcheada

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

### 4. Usar Opus 5.5 (y otros modelos nuevos)

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

## Qué puede romper esto en el futuro

- Si Anthropic empieza a validar **capacidades reales** (no solo el número de versión), el parche deja de funcionar y hay que actualizar macOS a 11+.
- Cada vez que VS Code o la extensión se autoactualice, volverás al punto de partida. Mantén los flags de `settings.json` desactivados.
- Si vuelve el `dyld: Symbol not found` en VS Code, casi seguro la CLI ha reinstalado la extensión 2.x: revisa que `autoInstallIdeExtension` y `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` sigan puestos y reinstala la 1.0.31.

## Revertir

```bash
# Restaurar la CLI
CC_DIR="$(npm root -g)/@anthropic-ai/claude-code"
mv "$CC_DIR/cli.js.bak" "$CC_DIR/cli.js"

# O reinstalar limpio
npm install -g @anthropic-ai/claude-code@latest
```
