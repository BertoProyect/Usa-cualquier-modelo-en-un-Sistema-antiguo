"use strict";
require("./cc-node-shim.js");
const electron = require("electron");
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { app } = electron;
if (!app.configureWebAuthn) app.configureWebAuthn = () => {};
try {
  const au = electron.autoUpdater;
  for (const k of ["setFeedURL", "checkForUpdates", "quitAndInstall"]) au[k] = () => {};
  au.getFeedURL = () => "";
} catch {}
const wrapDir = path.join(os.tmpdir(), "claude-cc-preloads");
function makeWrapper(file, matches) {
  const src = fs.readFileSync(file, "utf8");
  const hash = crypto.createHash("sha1").update(file + JSON.stringify(matches) + src.length).digest("hex").slice(0, 12);
  const out = path.join(wrapDir, path.basename(file, ".js") + "-" + hash + ".js");
  if (!fs.existsSync(out)) {
    fs.mkdirSync(wrapDir, { recursive: true });
    const guard = "var __m=" + JSON.stringify(matches.map((p) => "^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$")) + ".some(function(r){return new RegExp(r).test(location.href)});";
    fs.writeFileSync(out, guard + "\nif(__m)(function(){" + src + "\n}).call(this);\n");
  }
  return out;
}
const regs = new WeakMap();
function patchSession(s) {
  const P = s && Object.getPrototypeOf(s);
  if (!P || P.__ccPatched) return;
  P.__ccPatched = true;
  if (P.registerPreloadScript) return;
  const list = (x) => { let l = regs.get(x); if (!l) { l = []; regs.set(x, l); } return l; };
  P.registerPreloadScript = function (o) {
    const l = list(this);
    const id = o.id || "cc-" + crypto.randomUUID();
    if (l.some((e) => e.id === id)) throw new Error('Preload script with id "' + id + '" is already registered');
    const entry = { type: o.type, id, filePath: o.filePath };
    if (o.type === "frame") {
      entry._file = o.matches && o.matches.length ? makeWrapper(o.filePath, o.matches) : o.filePath;
      this.setPreloads([...this.getPreloads(), entry._file]);
    }
    l.push(entry);
    return id;
  };
  P.unregisterPreloadScript = function (id) {
    const l = list(this);
    const i = l.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [e] = l.splice(i, 1);
    if (e._file) this.setPreloads(this.getPreloads().filter((f) => f !== e._file));
  };
  P.getPreloadScripts = function () { return list(this).map(({ _file, ...e }) => e); };
}
(() => {
  const { clipboard, nativeImage } = electron;
  if (!electron.ClipboardItem) {
    class ClipboardItem { constructor(items) { this._items = items; this.types = Object.keys(items); } async getType(t) { return await this._items[t]; } }
    try { Object.defineProperty(electron, "ClipboardItem", { value: ClipboardItem, configurable: true }); } catch (e) {}
  }
  const CI = electron.ClipboardItem, oRead = clipboard.read.bind(clipboard), oWrite = clipboard.write.bind(clipboard);
  clipboard.read = function (f, ...r) {
    if (f !== undefined) return oRead(f, ...r);
    const fm = clipboard.availableFormats(), m = {};
    const txt = clipboard.readText(); if (txt || fm.includes("text/plain")) m["text/plain"] = new Blob([txt], { type: "text/plain" });
    if (fm.includes("text/html")) m["text/html"] = new Blob([clipboard.readHTML()], { type: "text/html" });
    if (fm.includes("text/rtf")) m["text/rtf"] = new Blob([clipboard.readRTF()], { type: "text/rtf" });
    const img = clipboard.readImage(); if (!img.isEmpty()) m["image/png"] = new Blob([img.toPNG()], { type: "image/png" });
    return Promise.resolve(Object.keys(m).length ? [new CI(m)] : []);
  };
  clipboard.write = function (d, ...r) {
    if (!Array.isArray(d)) return oWrite(d, ...r);
    return (async () => {
      const o = {};
      for (const it of d) for (const t of it.types) {
        const b = await it.getType(t), str = async () => typeof b === "string" ? b : await b.text();
        if (t === "text/plain") o.text = await str(); else if (t === "text/html") o.html = await str(); else if (t === "text/rtf") o.rtf = await str();
        else if (t.startsWith("image/")) o.image = nativeImage.createFromBuffer(Buffer.from(await b.arrayBuffer()));
      }
      oWrite(o);
    })();
  };
  for (const C of [electron.View, electron.WebContentsView]) if (C && !C.prototype.setBorderRadius) C.prototype.setBorderRadius = function () {};
})();
for (const k of ["on", "setImage", "setToolTip"]) { const T = electron.Tray.prototype, o = T[k]; T[k] = function (...a) { globalThis.__ccTray = this; return o.apply(this, a); }; }
app.on("session-created", patchSession);
app.whenReady().then(() => patchSession(electron.session.defaultSession));
if (process.platform === "darwin") app.whenReady().then(() => setTimeout(() => {
  try { if (electron.systemPreferences.getMediaAccessStatus("screen") !== "granted") electron.desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 16, height: 16 } }).catch(() => {}); } catch (e) {}
}, 4000));
// En 10.15 la vista de claude.ai a veces nace con el compositor parado (visibilityState "hidden",
// requestAnimationFrame no avanza) y la ventana se queda en el esqueleto. Pasa al activar la ventana mientras arranca.
// Remedio: alternar la visibilidad de la vista (la marca visible) y, si sigue parada, reiniciar su renderer,
// que nace ya visible. Ni recargar ni ocultar/mostrar la ventana lo arreglan.
app.on("web-contents-created", (_e, wc) => {
  let stage = 0;
  const ownerWin = () => electron.BrowserWindow.getAllWindows().find(w => w.contentView && w.contentView.children.some(v => v.webContents === wc));
  const probe = () => Promise.race([
    wc.executeJavaScript("new Promise(r => { requestAnimationFrame(() => r('ok')); setTimeout(() => r('stuck'), 3000); })"),
    new Promise(r => setTimeout(() => r("busy"), 8000)),
  ]).catch(() => "busy");
  const toggle = w => { const v = w.contentView.children.find(c => c.webContents === wc); if (v) { v.setVisible(false); v.setVisible(true); } };
  wc.on("did-finish-load", () => {
    if (!/^https:\/\/claude\.ai\//.test(wc.getURL()) || stage >= 3) return;
    let n = 0, oks = 0;
    const tick = async () => {
      if (wc.isDestroyed() || ++n > 40) return;
      const w = ownerWin();
      if (!w || !w.isVisible() || w.isMinimized() || !w.isFocused()) return setTimeout(tick, 2000);
      const r = await probe();
      if (r === "ok") { if (++oks < 3) setTimeout(tick, 3000); return; }
      oks = 0;
      if (r === "busy") return setTimeout(tick, 2000);
      if (stage >= 3) return;
      if (stage === 1) {
        stage = 2;
        console.warn("[cc-port] vista de claude.ai sin pintar; reiniciando su renderer");
        return wc.forcefullyCrashRenderer();
      }
      stage++;
      toggle(w);
      setTimeout(tick, 1500);
    };
    setTimeout(tick, stage === 2 ? 1000 : 2000);
  });
});
try { const f = path.join(os.homedir(), ".claude-port-debug.js"); if (fs.existsSync(f)) require(f); } catch (e) { console.error("[cc-port] debug hook", e); }
require("./launcher.js");
