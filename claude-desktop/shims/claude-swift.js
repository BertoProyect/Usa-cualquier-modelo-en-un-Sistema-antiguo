"use strict";
// Reemplazo JS de @ant/claude-swift para macOS 10.15 (el addon Swift exige macOS 13+).
const EventEmitter = require("node:events");
const path = require("node:path");
const { execFile, execFileSync } = require("node:child_process");

const HELPER = path.join(process.resourcesPath || "", "..", "Frameworks", "cc-compat", "cuhelper");
const electron = () => require("electron");

function runSync(args) {
  try { return JSON.parse(execFileSync(HELPER, args, { encoding: "utf8", timeout: 5000, maxBuffer: 64 << 20 })); } catch { return null; }
}
function run(args) {
  return new Promise((res, rej) => execFile(HELPER, args, { encoding: "utf8", timeout: 15000, maxBuffer: 128 << 20 }, (e, out, err) => {
    if (e) return rej(new Error(String(err || e.message).trim()));
    try { res(JSON.parse(out)); } catch (x) { rej(x); }
  }));
}

function displayInfo(d) {
  const { screen } = electron();
  return { displayId: d.id, width: d.bounds.width, height: d.bounds.height, scaleFactor: d.scaleFactor,
    originX: d.bounds.x, originY: d.bounds.y, isPrimary: d.id === screen.getPrimaryDisplay().id, label: d.label || `Display ${d.id}` };
}
function findDisplay(id) {
  const { screen } = electron();
  return (id != null && screen.getAllDisplays().find((d) => d.id === Number(id))) || screen.getPrimaryDisplay();
}
function fit(w, h, tw, th) {
  if (tw > 0 && th > 0) return [Math.round(tw), Math.round(th)];
  return [Math.round(w), Math.round(h)];
}
async function shot(allowed, quality, tw, th, displayId, region) {
  const d = findDisplay(displayId);
  const info = displayInfo(d);
  const allow = Array.isArray(allowed) && allowed.length ? allowed.join(",") : "*";
  const rect = region ? [info.originX + region.x, info.originY + region.y, region.w, region.h] : [];
  const [w, h] = fit((region ? region.w : info.width) * info.scaleFactor, (region ? region.h : info.height) * info.scaleFactor, tw, th);
  const r = await run(["shot", String(d.id), String(w), String(h), String(quality ?? 0.75), String(process.pid), allow, ...rect.map(String)]);
  return { base64: r.base64, width: r.width, height: r.height, displayWidth: info.width, displayHeight: info.height,
    displayId: d.id, originX: info.originX, originY: info.originY };
}
function ownWindows() {
  const { BrowserWindow } = electron();
  const r = [];
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      const m = /^window:(\d+):/.exec(w.getMediaSourceId());
      if (m && w.isVisible()) r.push({ windowNumber: Number(m[1]), switchable: w.isFocusable(), kind: "main" });
    } catch {}
  }
  return r;
}
const fs = require("node:fs");
async function listInstalled() {
  const dirs = ["/Applications", "/Applications/Utilities", "/System/Applications", "/System/Applications/Utilities", path.join(require("os").homedir(), "Applications")];
  const apps = [], seen = new Set();
  for (const dir of dirs) {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".app")); } catch { continue; }
    await Promise.all(names.map((n) => new Promise((res) => {
      const p = path.join(dir, n);
      execFile("/usr/bin/plutil", ["-convert", "json", "-o", "-", path.join(p, "Contents", "Info.plist")], { encoding: "utf8", timeout: 5000 }, (e, out) => {
        try {
          const j = JSON.parse(out);
          const id = j.CFBundleIdentifier;
          if (id && !seen.has(id)) { seen.add(id); apps.push({ bundleId: id, displayName: j.CFBundleDisplayName || j.CFBundleName || n.replace(/\.app$/, ""), path: p }); }
        } catch {}
        res();
      });
    })));
  }
  return apps;
}
function listRunning() { return runSync(["running"]) || []; }

const tcc = {
  checkAccessibility: () => electron().systemPreferences.isTrustedAccessibilityClient(false),
  checkScreenRecording: () => runSync(["tcc-screen"]) === true || electron().systemPreferences.getMediaAccessStatus("screen") === "granted",
  requestAccessibility: () => electron().systemPreferences.isTrustedAccessibilityClient(true),
  requestScreenRecording: () => {
    try { electron().desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {}); } catch {}
    electron().shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    return tcc.checkScreenRecording();
  },
};

const computerUse = {
  display: {
    getSize: (id) => displayInfo(findDisplay(id)),
    listAll: () => electron().screen.getAllDisplays().map(displayInfo),
    windowNumberAtPoint: async (x, y) => { const r = await run(["at", String(x), String(y)]).catch(() => null); return r ? r.windowNumber : 0; },
    ownWindows,
    isOwnWindow: (n) => ownWindows().some((w) => w.windowNumber === n),
  },
  screenshot: {
    captureExcluding: (allowed, q, tw, th, displayId) => shot(allowed, q, tw, th, displayId),
    captureRegion: (allowed, x, y, w, h, outW, outH, q, displayId) => shot(allowed, q, outW, outH, displayId, { x, y, w, h }),
  },
  async resolvePrepareCapture(allowed, hostBundleId, q, tw, th, preferredDisplayId, autoResolve, doHide) {
    let displayId = preferredDisplayId;
    if (autoResolve && Array.isArray(allowed) && allowed.length) {
      const wd = await run(["displays", ...allowed]).catch(() => []);
      const ids = wd.flatMap((x) => x.displayIds);
      if (ids.length && !ids.includes(Number(displayId))) displayId = ids[0];
    }
    const hidden = doHide ? await computerUse.apps.prepareDisplay(allowed, hostBundleId, displayId).then((r) => r.hidden).catch(() => []) : [];
    try { return { ...(await shot(allowed, q, tw, th, displayId)), hidden, activated: null }; }
    catch (e) { const i = displayInfo(findDisplay(displayId)); return { base64: "", width: 0, height: 0, displayWidth: i.width, displayHeight: i.height, displayId: i.displayId, originX: i.originX, originY: i.originY, hidden, activated: null, captureError: e.message }; }
  },
  tcc,
  apps: {
    async prepareDisplay(allowed, hostBundleId, displayId) {
      const keep = new Set([...(allowed || []), hostBundleId, "com.apple.finder"].filter(Boolean));
      const toHide = listRunning().map((a) => a.bundleId).filter((b) => !keep.has(b));
      const hidden = toHide.length ? await run(["hide", ...toHide]).catch(() => []) : [];
      return { hidden, activated: null };
    },
    previewHideSet(bundleIds) {
      const keep = new Set(bundleIds || []);
      return listRunning().filter((a) => !keep.has(a.bundleId) && a.bundleId !== "com.apple.finder").map(({ bundleId, displayName }) => ({ bundleId, displayName }));
    },
    unhide: (ids) => (ids && ids.length ? run(["unhide", ...ids]).catch(() => []) : Promise.resolve([])),
    listRunning,
    listInstalled: async () => ({ apps: await listInstalled(), spotlightIncomplete: false }),
    async listInstalledWithRunning() {
      const running = new Map(listRunning().map((a) => [a.bundleId, a]));
      const apps = await listInstalled();
      return apps.map((a) => ({ ...a, isRunning: running.has(a.bundleId), pid: running.get(a.bundleId)?.pid }));
    },
    async open(bundleId, activates = true) {
      await new Promise((res, rej) => execFile("/usr/bin/open", [activates === false ? "-g" : "-b", ...(activates === false ? ["-b"] : []), bundleId], (e) => (e ? rej(e) : res())));
      for (let i = 0; i < 40; i++) {
        const a = listRunning().find((x) => x.bundleId === bundleId);
        if (a) return { pid: a.pid };
        await new Promise((r) => setTimeout(r, 250));
      }
      return { pid: 0 };
    },
    async appUnderPoint(x, y) {
      const r = await run(["at", String(x), String(y)]).catch(() => null);
      if (!r) return null;
      return r.bundleId ? { bundleId: r.bundleId, displayName: r.displayName } : { bundleId: null, displayName: r.displayName, unattributedWindowOwner: r.displayName };
    },
    findWindowDisplays: (ids) => (ids && ids.length ? run(["displays", ...ids]).catch(() => []) : Promise.resolve([])),
    iconDataUrlWithinTimeLimit: (id) => run(["icon", id]).then((r) => r || undefined).catch(() => undefined),
  },
};

const noop = () => {};
const swift = new EventEmitter();
const shown = new Map();
const notifications = {
  getAuthStatus: async () => "authorized",
  requestAuth: async () => "granted",
  openSettings: () => electron().shell.openExternal("x-apple.systempreferences:com.apple.preference.notifications"),
  async show(o) {
    const { Notification } = electron();
    if (!Notification.isSupported()) return { delivered: false };
    const actions = o.categoryId === "PERMISSION_REQUEST" ? [{ type: "button", text: "Permitir una vez" }] : [];
    const n = new Notification({ title: o.title || "", subtitle: o.subtitle || undefined, body: o.body || "", silent: !!o.silent, actions });
    const emit = (action) => swift.emit("notificationInteraction", { id: o.id, action, userInfo: o.userInfo || {} });
    n.on("click", () => emit("click"));
    n.on("action", (_e, i) => emit(actions.length && i === 0 ? "allow_once" : "click"));
    n.on("close", () => shown.get(o.id) === n && shown.delete(o.id));
    shown.get(o.id)?.close();
    shown.set(o.id, n);
    n.show();
    return { delivered: true };
  },
  async close(id) { const n = shown.get(id); if (n) { shown.delete(id); n.close(); } },
};
Object.assign(swift, {
  loadTimings: {},
  nativeGroup: () => undefined,
  surfaceSenderImagePath: () => "",
  computerUse,
  notifications,
  keychain: {
    deriveBrowserSafeStorageKey: (browser) => new Promise((resolve) => {
      const svc = { chrome: ["Chrome Safe Storage", "Chrome"], chromium: ["Chromium Safe Storage", "Chromium"], brave: ["Brave Safe Storage", "Brave"], edge: ["Microsoft Edge Safe Storage", "Microsoft Edge"] }[browser];
      if (!svc) return resolve({ status: "not_found", osStatus: -25300 });
      execFile("/usr/bin/security", ["find-generic-password", "-w", "-s", svc[0], "-a", svc[1]], { encoding: "utf8" }, (err, out) => {
        if (err) { const st = err.code === 44 ? "not_found" : err.code === 128 ? "user_canceled" : err.code === 51 ? "denied" : "error"; return resolve({ status: st, osStatus: err.code === 44 ? -25300 : err.code === 128 ? -128 : -25293 }); }
        const pw = out.replace(/\n$/, ""); if (!pw) return resolve({ status: "not_found", osStatus: -25300 });
        resolve({ status: "ok", key: require("node:crypto").pbkdf2Sync(pw, "saltysalt", 1003, 16, "sha1") });
      });
    }),
  },
  networkPath: { subscribe: () => false, unsubscribe: noop, awakeMilliseconds: () => Math.round(process.uptime() * 1000) },
  memoryPressure: { subscribe: () => false, unsubscribe: noop },
  desktop: { getOpenWindows: () => [], captureScreenshot: async () => null, setQuickEntrySharing: async () => {} },
  quickAccess: {
    overlay: { setLoggedIn: noop, setRecentChats: noop, toggle: noop },
    dictation: { setLanguage: noop, show: noop, stop: noop, cancel: noop },
  },
  api: { setCredentials: noop },
  midnightOwl: { setEnabled: noop },
  wakeScheduler: { status: async () => ({ status: "unavailable" }), openSettings: noop },
  trayUsage: {
    popUp: async (title, windows, header, footer, actions) => {
      const { Menu } = electron();
      const act = (it) => ({ label: it.hint ? `${it.label}  (${it.hint})` : it.label, sublabel: it.detail, enabled: it.enabled !== false, click: () => swift.emit("trayUsageAction", it.id) });
      const bar = (f) => { const n = Math.round(Math.min(Math.max(f || 0, 0), 1) * 20); return "\u2588".repeat(n) + "\u2591".repeat(20 - n); };
      const t = [];
      if (title) t.push({ label: title, enabled: false }, { type: "separator" });
      for (const w of windows || []) {
        t.push({ label: w.label, enabled: false });
        t.push({ label: w.showsBar === false ? `   ${w.detail || ""}` : `   ${bar(w.fraction)}  ${w.detail || ""}`, enabled: false });
      }
      if ((windows || []).length) t.push({ type: "separator" });
      for (const it of actions || []) t.push(act(it));
      if ((actions || []).length) t.push({ type: "separator" });
      for (const it of header || []) t.push(act({ ...it, label: it.detail ? `${it.label} \u00b7 ${it.detail}` : it.label, detail: undefined }));
      for (const it of footer || []) t.push(act(it));
      const menu = Menu.buildFromTemplate(t), tray = globalThis.__ccTray;
      if (tray && !tray.isDestroyed()) tray.popUpContextMenu(menu); else menu.popup();
    },
  },
  updater: { getShipItJobInfo: () => null, removeShipItJob: noop },
  permissionFixer: { run: async () => ({ success: false, error: "unsupported on macOS 10.15" }) },
  tearOffHalo: { begin: noop, end: noop, setArmed: noop },
  vm: {
    isVirtualizationSupported: async () => false,
    isRunning: async () => false,
    isGuestConnected: async () => false,
    getVirtualizationSupport: async () => ({ supported: false, reason: "macOS 10.15" }),
  },
});
module.exports = swift;
