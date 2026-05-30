import { useCallback, useEffect, useRef, useState } from "react";
import {
  blip, defaultIcons, defaultTheme, iconGridPos, googleFaviconFor, pueiNumberFor,
  loadState, saveState, registerInDirectory, SYSTEM_ORDER,
  type AppId, type DesktopIcon, type User, type SystemVersion,
  type Theme, type WallpaperId, type WindowState,
} from "./state";
import { AppWindow, ContextMenu, appIcon } from "./Window";
import { AppRenderer } from "./apps";
import { PueiMascot, PueiLogoSvg } from "./Mascot";
import { pullAndMergeFiles, pushFile as pushFileToServer, removeFileFromServer } from "./fileSync";
import { loadFiles } from "./state";
import { loginRemote, createRemote, applySnapshot, schedulePush, type AccountSnapshot } from "./accountSync";


type Phase = "install" | "boot" | "login" | "desktop" | "shutdown" | "recovery" | "upgrade";

const APP_TITLES: Record<AppId, string> = {
  "puei-paint": "Puei Paint 2",
  "pueinet": "PueiWeb",
  "puei-messenger": "Puei Messenger",
  "file-explorer": "Computer",
  "settings": "Settings",
  "about": "About PueiOS 2",
  "notepad": "Notepad",
  "calculator": "Calculator",
  "app-store": "App Store",
  "puei-social": "PueiSocial",
  "folder": "Folder",
  "web-app": "Web App",
  "recycle-bin": "Recycle Bin",
  "solitaire": "Solitaire",
  "chess": "Chess",
};
const APP_SIZES: Partial<Record<AppId, { w: number; h: number }>> = {
  "calculator": { w: 280, h: 380 },
  "notepad": { w: 520, h: 420 },
  "about": { w: 480, h: 440 },
  "settings": { w: 820, h: 560 },
  "puei-messenger": { w: 720, h: 500 },
  "pueinet": { w: 820, h: 560 },
  "puei-paint": { w: 820, h: 560 },
  "file-explorer": { w: 760, h: 500 },
  "app-store": { w: 760, h: 560 },
  "puei-social": { w: 720, h: 600 },
  "folder": { w: 520, h: 400 },
  "web-app": { w: 900, h: 600 },
  "recycle-bin": { w: 640, h: 460 },
  "solitaire": { w: 640, h: 480 },
  "chess": { w: 560, h: 600 },
};

const GRID_W = 96;
const GRID_H = 92;
const SECURITY_KEY = "puei";

export function PueiOS() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [bootProgress, setBootProgress] = useState(0);
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [icons, setIcons] = useState<DesktopIcon[]>(defaultIcons);
  const [users, setUsers] = useState<User[]>([]);
  const [installed, setInstalled] = useState(false);
  const [systemVersion, setSystemVersion] = useState<SystemVersion>("PueiOS 2");
  const [installMode, setInstallMode] = useState<"new" | "existing" | null>(null);
  const [pwOption, setPwOption] = useState<"have" | "none" | "create-now">("have");
  const [upgradeTarget, setUpgradeTarget] = useState<SystemVersion>("PueiOS 2+");
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [remember, setRemember] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [zCounter, setZCounter] = useState(1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [notifs, setNotifs] = useState<{ id: number; title: string; body: string }[]>([]);
  const [mascotSpeak, setMascotSpeak] = useState<string | null>(null);
  const [showMascot] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [volume, setVolume] = useState(80);
  const [netInfo, setNetInfo] = useState<{ ping: number | null; speed: number | null; type: string; online: boolean }>({ ping: null, speed: null, type: "?", online: true });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchName, setSwitchName] = useState("");
  const [switchPw, setSwitchPw] = useState("");
  const [switchErr, setSwitchErr] = useState("");
  const [newAcc, setNewAcc] = useState({ name: "", password: "", avatar: "🧑", color: "200" });

  // Install wizard state
  const [installStep, setInstallStep] = useState(0);
  const [installKey, setInstallKey] = useState("");
  const [installErr, setInstallErr] = useState("");
  const [installProgress, setInstallProgress] = useState(0);

  // Load persisted
  useEffect(() => {
    const s = loadState();
    setThemeState(s.theme); setIcons(s.icons); setUsers(s.users);
    setInstalled(s.installed); setSystemVersion(s.systemVersion);
    if (!s.installed) { setPhase("install"); return; }
    if (s.lastUser && s.remember) { setLoginUser(s.lastUser); setRemember(true); }
    else if (s.users[0]) setLoginUser(s.users[0].name);
  }, []);

  // Boot animation
  useEffect(() => {
    if (phase !== "boot") return;
    blip("start");
    let p = 0;
    const t = setInterval(() => {
      p += 4 + Math.random() * 8;
      setBootProgress(Math.min(100, p));
      if (p >= 100) {
        clearInterval(t);
        setTimeout(() => setPhase(users.length ? "login" : "install"), 400);
      }
    }, 120);
    return () => clearInterval(t);
  }, [phase, users.length]);

  // Apply theme + persist
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-h", String(theme.accentH));
    root.classList.toggle("dark", theme.dark);
    root.classList.toggle("high-contrast", !!theme.highContrast);
    if (theme.highContrast) {
      root.style.setProperty("--glass", "#000");
      root.style.setProperty("--glass-strong", "#000");
      root.style.setProperty("--accent", theme.highContrastColor);
      root.style.setProperty("--foreground", theme.highContrastColor);
    } else if (!theme.transparency) {
      root.style.setProperty("--glass", "oklch(0.96 0.02 220 / 1)");
      root.style.setProperty("--glass-strong", "oklch(0.98 0.01 220 / 1)");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--foreground");
    } else {
      root.style.removeProperty("--glass");
      root.style.removeProperty("--glass-strong");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--foreground");
    }
    saveState({ installed, systemVersion, theme, icons, users, lastUser: loginUser, remember });
    users.forEach((u) => { if (u.pueiNumber) registerInDirectory(u); });
  }, [installed, systemVersion, theme, icons, users, loginUser, remember]);


  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!showNetwork) return;
    const measure = async () => {
      const online = navigator.onLine;
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const rawType: string = conn?.effectiveType || conn?.type || "";
      const typeLabel = rawType === "4g" ? "WiFi / 4G" : rawType === "3g" ? "3G" : rawType === "2g" ? "2G" : rawType === "slow-2g" ? "Slow 2G" : rawType === "wifi" ? "WiFi" : rawType === "cellular" ? "Cellular" : "WiFi";
      const speed: number | null = conn?.downlink != null ? conn.downlink : null;
      let ping: number | null = null;
      try {
        const t0 = performance.now();
        await fetch(window.location.origin + "/?_ping=" + Date.now(), { method: "HEAD", cache: "no-store" });
        ping = Math.round(performance.now() - t0);
      } catch {}
      setNetInfo({ ping, speed, type: typeLabel, online });
    };
    measure();
  }, [showNetwork]);
  useEffect(() => {
    const fn = (e: PointerEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", fn);
    return () => window.removeEventListener("pointermove", fn);
  }, []);

  const welcomedRef = useRef(false);
  useEffect(() => {
    if (phase === "desktop" && !welcomedRef.current) {
      welcomedRef.current = true;
      setTimeout(() => {
        pushNotif("Welcome to PueiOS 2", `Signed in as ${currentUser}. Try right-clicking the desktop or the App Store!`);
        setMascotSpeak("Hi! I'm Puei. Click me for quick tips ✦");
        setTimeout(() => setMascotSpeak(null), 5000);
      }, 800);
    }
  }, [phase, currentUser]);

  // Cloud sync: pull all files for this user on sign-in (cross-device/browser)
  useEffect(() => {
    if (!currentUser) return;
    pullAndMergeFiles(currentUser).catch(() => {});
  }, [currentUser]);

  // Cloud sync: push file changes to server (debounced)
  useEffect(() => {
    if (!currentUser) return;
    let lastIds = new Set(loadFiles().filter((f) => !f.owner || f.owner === currentUser).map((f) => f.id));
    const onChange = () => {
      const files = loadFiles().filter((f) => !f.owner || f.owner === currentUser);
      const currentIds = new Set(files.map((f) => f.id));
      // push current
      files.forEach((f) => pushFileToServer(currentUser, f).catch(() => {}));
      // detect removals
      for (const id of lastIds) if (!currentIds.has(id)) removeFileFromServer(currentUser, id).catch(() => {});
      lastIds = currentIds;
    };
    window.addEventListener("pueios-files-changed", onChange);
    return () => window.removeEventListener("pueios-files-changed", onChange);
  }, [currentUser]);

  // Cloud account sync: push full snapshot whenever account-scoped data changes
  useEffect(() => {
    if (!currentUser) return;
    const u = users.find((x) => x.name === currentUser);
    if (!u) return;
    schedulePush(u);
    const evts = ["pueios-files-changed", "pueios-chat", "pueios-mail", "pueios-social", "pueios-recycle-changed"];
    const fn = () => schedulePush(u);
    evts.forEach((e) => window.addEventListener(e, fn));
    return () => evts.forEach((e) => window.removeEventListener(e, fn));
  }, [currentUser, users, theme, icons]);




  const setTheme = (t: Theme) => setThemeState(t);
  const setWallpaper = (w: WallpaperId) => setThemeState({ ...theme, wallpaper: w });

  const pushNotif = (title: string, body: string) => {
    blip("notify");
    const id = Date.now() + Math.random();
    setNotifs((n) => [...n, { id, title, body }]);
    setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), 4500);
  };

  const focusWin = useCallback((id: string) => {
    setZCounter((z) => z + 1);
    setWindows((ws) => ws.map((w) => w.id === id ? { ...w, z: zCounter + 1, minimized: false } : w));
  }, [zCounter]);

  const openApp = useCallback((appId: AppId, opts?: { fileId?: string; webUrl?: string; title?: string; folderIconId?: string }) => {
    blip("click");
    const fileId = opts?.fileId;
    const webUrl = opts?.webUrl;
    const folderIconId = opts?.folderIconId;
    const existing = windows.find((w) =>
      w.appId === appId && w.fileId === fileId && w.webUrl === webUrl && w.folderIconId === folderIconId);
    if (existing) { focusWin(existing.id); return; }
    const size = APP_SIZES[appId] || { w: 560, h: 420 };
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 80 + (windows.length % 6) * 32;
    const y = 60 + (windows.length % 6) * 28;
    setZCounter((z) => z + 1);
    setWindows((ws) => [...ws, {
      id, appId, title: opts?.title || APP_TITLES[appId], x, y, w: size.w, h: size.h,
      z: zCounter + 1, minimized: false, maximized: false, fileId, webUrl, folderIconId,
    }]);
  }, [windows, zCounter, focusWin]);

  // Simpler signature for openers that just need (appId, fileId)
  const openAppSimple = useCallback((appId: AppId, fileId?: string) => {
    openApp(appId, { fileId });
  }, [openApp]);

  const closeWin = (id: string) => setWindows((ws) => ws.filter((w) => w.id !== id));
  const minWin = (id: string) => setWindows((ws) => ws.map((w) => w.id === id ? { ...w, minimized: true } : w));
  const maxWin = (id: string) => setWindows((ws) => ws.map((w) => {
    if (w.id !== id) return w;
    if (w.maximized) return { ...w, maximized: false, ...(w.prev || {}) };
    return { ...w, maximized: true, prev: { x: w.x, y: w.y, w: w.w, h: w.h } };
  }));
  const moveWin = (id: string, x: number, y: number) => setWindows((ws) => ws.map((w) => {
    if (w.id !== id) return w;
    if (y <= 0) return { ...w, maximized: true, prev: { x: w.x, y: w.y, w: w.w, h: w.h } };
    return { ...w, x, y };
  }));
  const resizeWin = (id: string, w: number, h: number) =>
    setWindows((ws) => ws.map((x) => x.id === id ? { ...x, w, h } : x));

  // Touch long-press for right click
  const touchTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent, items: any[]) => {
    if (e.touches.length !== 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimer.current = window.setTimeout(() => {
      if (touchStart.current) setCtxMenu({ x: touchStart.current.x, y: touchStart.current.y, items });
    }, 8000);
  };
  const onTouchEnd = () => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    touchStart.current = null;
  };

  // Icon helpers
  const addIcon = (ic: DesktopIcon) => setIcons((cur) => [...cur, ic]);
  const removeIcon = (id: string) => setIcons((cur) => cur.filter((i) => i.id !== id));

  const createFolder = (folderIdMaybeNull?: string | null) => {
    const name = prompt("Folder name:", "New Folder");
    if (!name) return;
    const id = `fold-${Date.now().toString(36)}`;
    setIcons((cur) => [...cur, { id, label: name, appId: "folder", folderId: folderIdMaybeNull || undefined }]);
  };

  // Top-level desktop icons = those without folderId
  const desktopIcons = icons.filter((i) => !i.folderId);

  const desktopCtx = (): any[] => [
    { label: "View ▸ Large icons" },
    { label: "Sort by name", action: () => setIcons([...icons].sort((a, b) => a.label.localeCompare(b.label))) },
    { label: "Refresh", action: () => pushNotif("Desktop", "Refreshed.") },
    { sep: true },
    { label: "New Folder", action: () => createFolder(null) },
    { label: "Open App Store", action: () => openApp("app-store") },
    { sep: true },
    { label: "Personalize", action: () => openApp("settings") },
    { label: "Properties", action: () => openApp("about") },
  ];

  const iconCtx = (icon: DesktopIcon): any[] => {
    const openIt = () => {
      if (icon.appId === "folder") openApp("folder", { folderIconId: icon.id, title: icon.label });
      else if (icon.appId === "web-app") openApp("web-app", { webUrl: icon.webUrl, title: icon.label });
      else openApp(icon.appId, { fileId: icon.fileId });
    };
    return [
      { label: "Open", action: openIt },
      { sep: true },
      { label: "Rename", action: () => {
        const n = prompt("Rename to:", icon.label);
        if (n) setIcons(icons.map((i) => i.id === icon.id ? { ...i, label: n } : i));
      }},
      { label: "Delete", action: () => {
        // also delete children if folder
        setIcons(icons.filter((i) => i.id !== icon.id && i.folderId !== icon.id));
      }},
      ...(icon.appId === "folder" ? [{ label: "New shortcut here", action: () => {
        const u = prompt("Website URL to install into this folder:", "https://example.com");
        if (!u) return;
        const label = prompt("Name:", new URL(u.startsWith("http") ? u : "https://" + u).hostname) || "Web App";
        addIcon({ id: `web-${Date.now().toString(36)}`, label, appId: "web-app", webUrl: u.startsWith("http") ? u : "https://" + u, iconUrl: googleFaviconFor(u, 64), folderId: icon.id });
      }}] : []),
      { sep: true },
      { label: "Properties", action: () => pushNotif(icon.label, icon.webUrl ? `Installed web app · ${icon.webUrl}` : `PueiOS Shortcut · ${APP_TITLES[icon.appId]}`) },
    ];
  };

  const taskbarCtx = (): any[] => [
    { label: "Task Manager", action: () => pushNotif("Task Manager", `${windows.length} window(s) open`) },
    { label: "Show Desktop", action: () => setWindows(windows.map((w) => ({ ...w, minimized: true }))) },
    { sep: true },
    { label: "Properties", action: () => openApp("settings") },
  ];

  // ============== INSTALL WIZARD ==============
  if (phase === "install") {
    const steps = [
      // 0 welcome
      <div key="0" className="text-center">
        <div className="boot-logo inline-block mb-4"><PueiLogoSvg size={90} glow /></div>
        <h1 className="text-3xl font-light mb-2">Install PueiOS 2</h1>
        <p className="opacity-70 text-sm max-w-md mx-auto">Welcome to the PueiOS 2 Ultimate Edition setup. This wizard will install PueiOS 2 on this device.</p>
        <button className="aero-button rounded px-6 py-2 mt-8" onClick={() => setInstallStep(1)}>Next →</button>
      </div>,
      // 1 license
      <div key="1" className="max-w-lg">
        <h2 className="text-xl font-semibold mb-2">License Agreement</h2>
        <div className="aero-glass-light rounded p-3 text-xs h-40 overflow-auto opacity-80">
          By installing PueiOS 2 you agree to: (1) remember that this is a fictional operating system,
          (2) accept Puei as your floating desktop guide, (3) understand that "Pueian Software Initiative" doesn't exist,
          (4) not blame us for any glassy bloom-induced eye strain.
        </div>
        <div className="flex gap-2 mt-4">
          <button className="aero-button rounded px-4 py-2" onClick={() => setInstallStep(0)}>← Back</button>
          <button className="aero-button rounded px-4 py-2" onClick={() => setInstallStep(2)}>I accept →</button>
        </div>
      </div>,
      // 2 security key
      <div key="2" className="max-w-md w-full">
        <h2 className="text-xl font-semibold mb-2">Enter security key</h2>
        <p className="text-xs opacity-80 mb-3">A 25-character product key would normally go here. For this build, the security key is simply:</p>
        <div className="aero-glass-light rounded px-3 py-2 font-mono text-sm mb-3">{SECURITY_KEY}</div>
        <input value={installKey} onChange={(e) => setInstallKey(e.target.value)}
          placeholder="Type the security key"
          className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        {installErr && <div className="text-red-300 text-xs mt-2">{installErr}</div>}
        <div className="flex gap-2 mt-4">
          <button className="aero-button rounded px-4 py-2" onClick={() => setInstallStep(1)}>← Back</button>
          <button className="aero-button rounded px-4 py-2" onClick={() => {
            if (installKey.trim().toLowerCase() === SECURITY_KEY) { setInstallErr(""); setInstallStep(3); }
            else { blip("error"); setInstallErr(`Wrong key. Hint: it really is "${SECURITY_KEY}".`); }
          }}>Next →</button>
        </div>
      </div>,
      // 3 progress (Windows-style multi-phase — 8 mandatory stages, no skipping)
      (() => {
        const phases = [
          { until: 8,   label: "Preparing files…" },
          { until: 20,  label: "Copying system data…" },
          { until: 35,  label: "Installing Kernel Layer…" },
          { until: 55,  label: "Installing System Apps (Messenger, PueiWeb, PueiSocial, Paint 2)…" },
          { until: 70,  label: "Configuring AI Layer…" },
          { until: 82,  label: "Setting up File System…" },
          { until: 92,  label: "Applying security policies…" },
          { until: 100, label: "Final optimization and system checks…" },
        ];
        const ph = phases.find((p) => installProgress < p.until) ?? phases[phases.length - 1];
        const stageIndex = phases.indexOf(ph);
        const files = [
          "aero.glass", "puei.mascot.swf", "kernel32.pue", "explorer.exe",
          "messenger.dll", "paint2.dll", "pueisocial.cab", "appstore.cab",
          "pueiweb.dll", "ai/layer.bin", "ai/policy.dat", "fs/journal.bin",
          "fonts/PueiSans.ttf", "drivers/glass.sys", "services/notify.exe",
          "registry/pueios.hive", "themes/aero.theme", "sounds/start.wav",
          "security/policies.xml", "security/trusted-domains.lst",
          "drivers/audio.sys", "pueinet.dll",
        ];
        const fileShown = files[Math.floor(installProgress * 0.9) % files.length];
        return (
          <div key="3" className="text-center w-[28rem]">
            <div className="boot-logo inline-block mb-4"><PueiLogoSvg size={70} glow /></div>
            <h2 className="text-lg font-semibold mb-1">Installing PueiOS 2…</h2>
            <p className="text-xs opacity-80 mb-1">Stage {stageIndex + 1} of {phases.length} · {ph.label}</p>
            <p className="text-[10px] opacity-50 mb-4 font-mono truncate">{fileShown}</p>
            <div className="w-full h-2 rounded-full bg-cyan-900/50 overflow-hidden">
              <div className="loading-bar-inner h-full" style={{ width: `${installProgress}%`, transition: "width 0.2s" }} />
            </div>
            <div className="text-[10px] opacity-60 mt-2">{Math.floor(installProgress)}% complete</div>
            <div className="grid grid-cols-4 gap-1 mt-4 text-[9px]">
              {phases.map((p, i) => (
                <div key={i} className="rounded px-1 py-0.5"
                  style={{
                    background: stageIndex > i ? "rgba(80,200,160,0.25)" : stageIndex === i ? "rgba(120,180,255,0.3)" : "rgba(255,255,255,0.05)",
                    opacity: stageIndex >= i ? 1 : 0.4,
                  }}>
                  {stageIndex > i ? "✓" : stageIndex === i ? "…" : "·"} {["Prep","Copy","Kernel","Apps","AI","FS","Security","Optimize"][i]}
                </div>
              ))}
            </div>
            <div className="text-[10px] opacity-40 mt-4">Your PC will restart several times. This might take a while.</div>
          </div>
        );
      })(),
      // 4 Account setup — choose Create New or Log in to existing
      installMode === null ? (
        <div key="4-choose" className="aero-glass rounded-lg p-6 w-96 space-y-4 text-center">
          <div className="text-base font-semibold flex items-center gap-2 justify-center"><PueiLogoSvg size={28} /> Set up your PueiOS account</div>
          <p className="text-xs opacity-70">Every PueiOS user has a unique <b>Pueio Number</b> identity.</p>
          <button className="aero-button rounded w-full py-3" onClick={() => setInstallMode("new")}>＋ Create a new account</button>
          <button className="aero-button rounded w-full py-3" onClick={() => setInstallMode("existing")}>↩ Log in to existing account</button>
        </div>
      ) : installMode === "existing" ? (
        // Existing account login (during install)
        <div key="4-existing" className="aero-glass rounded-lg p-5 w-96 space-y-3">
          <div className="text-base font-semibold flex items-center gap-2"><PueiLogoSvg size={26} /> Log in to existing account</div>
          <div>
            <label className="text-xs opacity-70">Username</label>
            <input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
              className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
          </div>
          {pwOption === "have" && (
            <div>
              <label className="text-xs opacity-70">Password</label>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
            </div>
          )}
          {pwOption === "none" && (
            <div className="aero-glass-light rounded p-3 text-xs">
              <div className="font-semibold mb-1">No password selected</div>
              <div className="mb-2">Do you want to create a password for better privacy?</div>
              <div className="flex gap-2">
                <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => setPwOption("create-now")}>Yes, create one</button>
                <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => {
                  // Limited access mode — continue without password
                  const name = newAcc.name.trim();
                  if (!name) { setInstallErr("Pick a name"); return; }
                  const nu: User = { name, password: "", avatar: "🧑", color: "200", pueiNumber: pueiNumberFor(name + ":" + Date.now()), friends: [], noPassword: true, limitedMode: true };
                  setUsers([nu]); setLoginUser(name); setInstalled(true); setInstallStep(5);
                  setTimeout(() => { setPhase("boot"); setBootProgress(0); setInstallStep(0); setInstallMode(null); setPwOption("have"); }, 1400);
                }}>No — limited access</button>
              </div>
            </div>
          )}
          {pwOption === "create-now" && (
            <div>
              <label className="text-xs opacity-70">New password</label>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
            </div>
          )}
          {pwOption !== "none" && (
            <button className="text-xs opacity-70 underline" onClick={() => setPwOption("none")}>I don't have a password</button>
          )}
          {installErr && <div className="text-red-300 text-xs">{installErr}</div>}
          <div className="flex gap-2">
            <button className="aero-button rounded px-3 py-2 text-sm" onClick={() => { setInstallMode(null); setPwOption("have"); setInstallErr(""); }}>← Back</button>
            <button className="aero-button rounded px-3 py-2 text-sm flex-1" onClick={async () => {
              const name = newAcc.name.trim();
              if (!name) { setInstallErr("Enter a username"); return; }
              // Cloud-first restore: pull the original account + all data from any browser.
              const remote = await loginRemote(name, newAcc.password);
              if (remote.status === "wrong-password") { setInstallErr("Wrong password for that account"); return; }
              if (remote.status === "ok" && remote.snapshot) {
                applySnapshot(remote.snapshot);
                const s = loadState();
                setUsers(s.users); setThemeState(s.theme); setIcons(s.icons);
                setLoginUser(name); setInstalled(true); setInstallErr("");
                setInstallStep(5); blip("notify");
                setTimeout(() => { setPhase("boot"); setBootProgress(0); setInstallStep(0); setInstallMode(null); setPwOption("have"); }, 1400);
                return;
              }
              if (remote.status === "not-found") {
                setInstallErr("No PueiOS account with that name. Use Create instead."); return;
              }
              // Network error → offline fallback: create a local-only account.
              const nu: User = { name, password: newAcc.password, avatar: "🧑", color: "200", pueiNumber: pueiNumberFor(name + ":" + Date.now()), friends: [] };
              setUsers([nu]); setLoginUser(name); setInstalled(true); setInstallErr("");
              setInstallStep(5); blip("notify");
              setTimeout(() => { setPhase("boot"); setBootProgress(0); setInstallStep(0); setInstallMode(null); setPwOption("have"); }, 1400);
            }}>Continue →</button>

          </div>
        </div>
      ) : (
      // Create new account
      <div key="4-new" className="aero-glass rounded-lg p-5 w-96 space-y-3">
        <div className="text-base font-semibold flex items-center gap-2"><PueiLogoSvg size={28} /> Create your account</div>
        <div>
          <label className="text-xs opacity-70">Account name</label>
          <input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        </div>
        <div>
          <label className="text-xs opacity-70">Password (optional)</label>
          <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
          <div className="text-[10px] opacity-60 mt-1">Leave empty for limited access mode (you can enable a password later in Settings → Pueio Control).</div>
        </div>
        <div>
          <label className="text-xs opacity-70">Avatar</label>
          <div className="flex flex-wrap gap-2 mt-1 items-center">
            {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧙","🤖","👽","🎩"].map((a) => (
              <button key={a} onClick={() => setNewAcc({ ...newAcc, avatar: a })}
                className="w-9 h-9 rounded text-xl flex items-center justify-center"
                style={{ background: newAcc.avatar === a ? "var(--gradient-aero)" : "rgba(255,255,255,0.5)" }}>{a}</button>
            ))}
            <label className="w-9 h-9 rounded flex items-center justify-center cursor-pointer text-xs"
              style={{ background: "rgba(255,255,255,0.5)" }} title="Upload picture">
              📷
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader(); r.onload = () => setNewAcc({ ...newAcc, avatar: String(r.result) }); r.readAsDataURL(f);
              }} />
            </label>
            {newAcc.avatar.startsWith("data:") && (
              <img src={newAcc.avatar} alt="" className="w-9 h-9 rounded object-cover border-2 border-white" />
            )}
          </div>
        </div>
        <div>
          <label className="text-xs opacity-70">Tile colour</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {["200","260","320","30","60","130","160","0"].map((c) => (
              <button key={c} onClick={() => setNewAcc({ ...newAcc, color: c })}
                className="w-8 h-8 rounded-full border-2"
                style={{
                  background: `linear-gradient(135deg, oklch(0.7 0.18 ${c}), oklch(0.45 0.2 ${c}))`,
                  borderColor: newAcc.color === c ? "white" : "transparent",
                }} />
            ))}
          </div>
        </div>
        {installErr && <div className="text-red-300 text-xs">{installErr}</div>}
        <div className="flex gap-2">
          <button className="aero-button rounded px-3 py-2 text-sm" onClick={() => setInstallMode(null)}>← Back</button>
          <button className="aero-button rounded px-3 py-2 text-sm flex-1" onClick={async () => {
            const name = newAcc.name.trim();
            if (!name) { setInstallErr("Pick a name"); return; }
            const noPw = !newAcc.password;
            const nu: User = {
              name, password: newAcc.password, avatar: newAcc.avatar || "🧑", color: newAcc.color,
              pueiNumber: pueiNumberFor(name + ":" + Date.now()), friends: [],
              noPassword: noPw, limitedMode: noPw,
            };
            // Reserve the account name in the cloud so the same name can't be re-created in another browser.
            const snap: AccountSnapshot = { version: 1, user: nu, theme, icons: defaultIcons, files: [], chat: [], social: [], recycle: [], mail: [], mailFolders: {}, downloads: {} };
            const r = await createRemote(nu, snap);
            if (r.conflict) { setInstallErr("That account already exists. Use 'Log in to existing account' instead."); return; }
            setUsers([nu]); setLoginUser(name); setInstalled(true); setInstallErr("");
            setNewAcc({ name: "", password: "", avatar: "🧑", color: "200" });
            blip("notify");
            setInstallStep(5);
            setTimeout(() => { setPhase("boot"); setBootProgress(0); setInstallStep(0); setInstallMode(null); }, 1400);
          }}>Finish installation</button>

        </div>
      </div>),
      // 5 done
      <div key="5" className="text-center">
        <div className="boot-logo inline-block mb-3"><PueiLogoSvg size={80} glow /></div>
        <div className="text-xl">Installation complete. Restarting…</div>
      </div>,
    ];

    // Drive the installer progress bar — slow, Windows-like, ~70 seconds with
    // mandatory "thinking" pauses at the 8 stage boundaries (8, 20, 35, 55, 70, 82, 92).
    if (phase === "install" && installStep === 3 && installProgress < 100) {
      setTimeout(() => {
        setInstallProgress((p) => {
          const boundaries = [8, 20, 35, 55, 70, 82, 92];
          const nearBoundary = boundaries.some((b) => Math.abs(p - b) < 1.2);
          // Smaller increments overall; tiny near boundaries to simulate
          // "configuring", "thinking", "optimizing" pauses.
          const inc = nearBoundary
            ? 0.02 + Math.random() * 0.08
            : 0.15 + Math.random() * 0.45;
          const next = Math.min(100, p + inc);
          if (next >= 100) setTimeout(() => setInstallStep(4), 1200);
          return next;
        });
      }, 220);
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, oklch(0.25 0.1 240), oklch(0.12 0.08 250))" }}>
        <div className="absolute top-4 left-4 text-xs opacity-60 flex items-center gap-2"><PueiLogoSvg size={20} /> PueiOS 2 Setup</div>
        <div className="absolute top-4 right-4 text-xs opacity-60">Build 2020.1138</div>
        {steps[installStep]}
        <div className="fixed bottom-4 right-4 text-[10px] opacity-40">pueios-2020-puei</div>
      </div>
    );
  }

  // ============ BOOT
  if (phase === "boot") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "radial-gradient(circle at 50% 40%, #0a1a2a, #000)" }}>
        <div className="boot-logo"><PueiLogoSvg size={120} glow /></div>
        <div className="text-3xl font-light text-white mt-4 tracking-widest">PueiOS 2</div>
        <div className="text-xs text-cyan-300/60 mt-1">Ultimate Edition · Build 2020.1138</div>
        <div className="mt-10 w-80 h-1.5 rounded-full bg-cyan-900/50 overflow-hidden">
          <div className="loading-bar-inner h-full" style={{ width: `${bootProgress}%`, transition: "width 0.12s" }} />
        </div>
        <div className="text-[10px] text-cyan-200/40 mt-3">Starting up…</div>
        <div className="fixed bottom-4 right-4 text-[10px] text-cyan-200/30">pueios-2020-puei</div>
      </div>
    );
  }

  if (phase === "shutdown") {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="text-center text-cyan-200">
          <div className="boot-logo inline-block"><PueiLogoSvg size={80} glow /></div>
          <div className="mt-4 text-xl">Shutting down…</div>
          <button className="mt-8 aero-button rounded px-4 py-2" onClick={() => { setPhase("boot"); setBootProgress(0); }}>Restart</button>
        </div>
      </div>
    );
  }

  if (phase === "recovery") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, #2a0a0a, #4a1010)" }}>
        <div className="text-4xl mb-3">⚠ Startup Repair</div>
        <div className="opacity-70 mb-8 text-sm">PueiOS 2 encountered an unexpected condition.</div>
        <div className="space-y-2">
          <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => { setPhase("boot"); setBootProgress(0); }}>Attempt repair & restart</button>
          <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => setPhase("login")}>Continue to login</button>
          <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => {
            if (confirm("Reinstall PueiOS 2? All accounts and files will be wiped.")) {
              localStorage.clear(); location.reload();
            }
          }}>Reinstall PueiOS 2</button>
        </div>
      </div>
    );
  }

  if (phase === "upgrade") {
    if (upgradeProgress < 100) {
      setTimeout(() => setUpgradeProgress((p) => Math.min(100, p + 0.6 + Math.random() * 1.2)), 220);
    } else {
      setTimeout(() => {
        setSystemVersion(upgradeTarget);
        setPhase("boot"); setBootProgress(0); setUpgradeProgress(0);
        blip("notify");
      }, 1500);
    }
    const stages = ["Preparing upgrade…", "Backing up files & settings…", "Migrating accounts & PueiNumbers…", "Installing new system files…", "Preserving conversations & media…", "Finalizing upgrade…"];
    const stageIdx = Math.min(stages.length - 1, Math.floor(upgradeProgress / (100 / stages.length)));
    return (
      <div className="fixed inset-0 flex items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, oklch(0.25 0.12 270), oklch(0.1 0.08 280))" }}>
        <div className="text-center w-[28rem]">
          <div className="boot-logo inline-block mb-3"><PueiLogoSvg size={80} glow /></div>
          <h2 className="text-2xl font-light mb-1">Upgrading to {upgradeTarget}</h2>
          <p className="text-xs opacity-70 mb-4">Your apps, files, settings, conversations and Pueio Number are preserved.</p>
          <div className="text-sm opacity-80 mb-2">{stages[stageIdx]}</div>
          <div className="w-full h-2 rounded-full bg-cyan-900/50 overflow-hidden">
            <div className="loading-bar-inner h-full" style={{ width: `${upgradeProgress}%`, transition: "width 0.2s" }} />
          </div>
          <div className="text-[10px] opacity-60 mt-2">{Math.floor(upgradeProgress)}% · {systemVersion} → {upgradeTarget}</div>
          <div className="text-[10px] opacity-40 mt-6">Do not turn off your device.</div>
        </div>
      </div>
    );
  }


  if (phase === "login" || locked) {
    const enterDesktop = (name: string) => {
      blip("start");
      setCurrentUser(name); setPwInput(""); setPwError("");
      setLocked(false); setPhase("desktop");
    };
    const trySignIn = async () => {
      const name = loginUser.trim();
      if (!name) { setPwError("Pick or type a username"); return; }
      // Cloud-first: restore the account from the server so it follows the user across browsers.
      const remote = await loginRemote(name, pwInput);
      if (remote.status === "wrong-password") { blip("error"); setPwError("Wrong password"); return; }
      if (remote.status === "ok" && remote.snapshot) {
        applySnapshot(remote.snapshot);
        const s = loadState();
        setUsers(s.users); setThemeState(s.theme); setIcons(s.icons);
        enterDesktop(name); return;
      }
      // Cloud said not-found OR network error → fall back to local auth.
      const u = users.find((x) => x.name === name);
      if (!u) { blip("error"); setPwError(remote.status === "not-found" ? "No PueiOS account with that name" : "Unknown user"); return; }
      if ((u.password ?? "") === pwInput) enterDesktop(name);
      else { blip("error"); setPwError("Wrong password"); }
    };
    const switchToAccount = async () => {
      const name = switchName.trim();
      if (!name) { setSwitchErr("Enter an account name"); return; }
      setSwitchErr("");
      const remote = await loginRemote(name, switchPw);
      if (remote.status === "wrong-password") { blip("error"); setSwitchErr("Wrong password"); return; }
      if (remote.status === "not-found") { blip("error"); setSwitchErr("No PueiOS account with that name"); return; }
      if (remote.status === "network-error") { blip("error"); setSwitchErr("Could not reach server. Check your connection."); return; }
      if (remote.snapshot) applySnapshot(remote.snapshot);
      const s = loadState();
      setUsers(s.users); setThemeState(s.theme); setIcons(s.icons);
      setLoginUser(name); setSwitching(false); setSwitchName(""); setSwitchPw(""); setSwitchErr("");
      enterDesktop(name);
    };
    const createAccount = async () => {
      if (users.some((u) => u.name === name)) { setPwError("Name already exists locally"); return; }
      const nu: User = { name, password: newAcc.password, avatar: newAcc.avatar || "🧑", color: newAcc.color || "200", pueiNumber: pueiNumberFor(name + ":" + Date.now()), friends: [] };
      // Reserve the name in the cloud so duplicate accounts can't exist across browsers.
      const snap: AccountSnapshot = { version: 1, user: nu, theme, icons, files: [], chat: [], social: [], recycle: [], mail: [], mailFolders: {}, downloads: {} };
      const r = await createRemote(nu, snap);
      if (r.conflict) { setPwError("That account already exists in the cloud. Sign in instead."); return; }
      const next = [...users, nu];
      setUsers(next); setLoginUser(name); setCreating(false);
      setNewAcc({ name: "", password: "", avatar: "🧑", color: "200" }); setPwError(""); blip("notify");
    };
    const activeUser = users.find((u) => u.name === loginUser);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, oklch(0.3 0.1 220), oklch(0.15 0.08 250))" }}>
        <div className="absolute top-6 left-6 text-white/70 text-sm flex items-center gap-2">
          <PueiLogoSvg size={28} /> {locked ? "Locked" : "Welcome to PueiOS 2"}
        </div>
        <div className="absolute top-6 right-6 text-white/70 text-sm">{now.toLocaleString()}</div>


        {switching ? (
          <div className="aero-glass rounded-lg p-5 w-80 space-y-3">
            <div className="text-base font-semibold">↩ Sign in to another account</div>
            <div>
              <label className="text-xs opacity-70">Account name</label>
              <input value={switchName} onChange={(e) => { setSwitchName(e.target.value); setSwitchErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") switchToAccount(); }}
                autoFocus
                className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
            </div>
            <div>
              <label className="text-xs opacity-70">Password</label>
              <input type="password" value={switchPw} onChange={(e) => setSwitchPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") switchToAccount(); }}
                className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
            </div>
            {switchErr && <div className="text-red-400 text-xs">{switchErr}</div>}
            <div className="flex gap-2">
              <button className="aero-button rounded px-3 py-1 text-sm" onClick={() => { setSwitching(false); setSwitchErr(""); }}>← Back</button>
              <button className="aero-button rounded px-3 py-1 text-sm flex-1" onClick={switchToAccount}>Sign in →</button>
            </div>
          </div>
        ) : !creating ? (
          <>
            <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(users.filter(u => typeof u.password !== 'undefined').length, 1), 4)}, minmax(0, 1fr))` }}>
              {users.filter(u => typeof u.password !== 'undefined').map((u) => (
                <button key={u.name} onClick={() => { setLoginUser(u.name); setPwError(""); setPwInput(""); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl"
                  style={{
                    background: loginUser === u.name ? "rgba(255,255,255,0.15)" : "transparent",
                    outline: loginUser === u.name ? "2px solid white" : "none",
                  }}>
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center text-5xl overflow-hidden"
                    style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${u.color}), oklch(0.45 0.2 ${u.color}))`, boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
                    {u.avatar.startsWith("data:")
                      ? <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                      : u.avatar}
                  </div>
                  <div className="text-white text-sm font-medium">{u.name}</div>
                </button>
              ))}
              {!locked && (
                <button onClick={() => { setCreating(true); setPwError(""); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-white/30 hover:border-white/60">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl text-white/70">＋</div>
                  <div className="text-white/80 text-sm font-medium">New account</div>
                </button>
              )}
            </div>
            <div className="aero-glass rounded-lg p-4 w-80">
              {users.length === 0 ? (
                <div className="mb-2">
                  <div className="text-xs opacity-70 mb-1">Account name</div>
                  <input value={loginUser} onChange={(e) => { setLoginUser(e.target.value); setPwError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
                    placeholder="Your PueiOS username"
                    className="w-full px-3 py-2 rounded text-sm outline-none"
                    style={{ background: "white", color: "#111" }} />
                </div>
              ) : (
                <div className="text-sm font-medium mb-2">{loginUser || "Select an account"}</div>
              )}
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
                placeholder={activeUser?.password ? "Password" : "Press Enter (no password)"}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: "white", color: "#111" }} />
              {pwError && <div className="text-red-400 text-xs mt-1">{pwError}</div>}
              <div className="flex gap-2 mt-3">
                <button className="aero-button rounded px-3 py-1 text-sm flex-1" onClick={trySignIn}>Sign in →</button>
                <button className="aero-button rounded px-3 py-1 text-sm" onClick={() => setPhase("recovery")}>Recovery</button>
              </div>
              {!locked && users.length > 0 && (
                <button className="text-xs text-white/60 underline hover:text-white/90 mt-2 w-full text-center block"
                  onClick={() => { setSwitching(true); setSwitchName(""); setSwitchPw(""); setSwitchErr(""); }}>
                  Switch to a different account
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="aero-glass rounded-lg p-5 w-96 space-y-3">
            <div className="text-base font-semibold flex items-center gap-2"><PueiLogoSvg size={28} /> Create a new account</div>
            <div>
              <label className="text-xs opacity-70">Account name</label>
              <input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
            </div>
            <div>
              <label className="text-xs opacity-70">Password (optional)</label>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
            </div>
            <div>
              <label className="text-xs opacity-70">Avatar</label>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧙","🐱","🤖","👽","🎩","🌟"].map((a) => (
                  <button key={a} onClick={() => setNewAcc({ ...newAcc, avatar: a })}
                    className="w-9 h-9 rounded text-xl flex items-center justify-center"
                    style={{ background: newAcc.avatar === a ? "var(--gradient-aero)" : "rgba(255,255,255,0.5)" }}>{a}</button>
                ))}
                <label className="w-9 h-9 rounded flex items-center justify-center cursor-pointer text-xs"
                  style={{ background: "rgba(255,255,255,0.5)" }} title="Upload picture">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader(); r.onload = () => setNewAcc({ ...newAcc, avatar: String(r.result) }); r.readAsDataURL(f);
                  }} />
                </label>
                {newAcc.avatar.startsWith("data:") && (
                  <img src={newAcc.avatar} alt="" className="w-9 h-9 rounded object-cover border-2 border-white" />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs opacity-70">Tile colour</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {["200","260","320","30","60","130","160","0"].map((c) => (
                  <button key={c} onClick={() => setNewAcc({ ...newAcc, color: c })}
                    className="w-8 h-8 rounded-full border-2"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.7 0.18 ${c}), oklch(0.45 0.2 ${c}))`,
                      borderColor: newAcc.color === c ? "white" : "transparent",
                    }} />
                ))}
              </div>
            </div>
            {pwError && <div className="text-red-400 text-xs">{pwError}</div>}
            <div className="flex gap-2 pt-2">
              <button className="aero-button rounded px-3 py-1 text-sm flex-1" onClick={createAccount}>Create account</button>
              <button className="aero-button rounded px-3 py-1 text-sm" onClick={() => { setCreating(false); setPwError(""); }}>Cancel</button>
            </div>
          </div>
        )}
        <div className="fixed bottom-4 right-4 text-[10px] text-white/40">pueios-2020-puei</div>
      </div>
    );
  }

  // ============ DESKTOP
  const wallpaperStyle: React.CSSProperties = (() => {
    if (typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("custom:")) {
      const id = theme.wallpaper.slice(7);
      // Lazy import via require would fail SSR; read straight from localStorage
      try {
        const files = JSON.parse(localStorage.getItem("pueios2-files-v1") || "[]");
        const f = files.find((x: any) => x.id === id);
        if (f?.content) return { backgroundImage: `url(${f.content})`, backgroundSize: "cover", backgroundPosition: "center" };
      } catch {}
    }
    return {};
  })();

  const currentAvatar = users.find(u => u.name === currentUser)?.avatar;

  return (
    <div
      className={`fixed inset-0 ${typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("custom:") ? "" : `wallpaper-${theme.wallpaper}`}`}
      style={{ overflow: "hidden", ...wallpaperStyle }}
      onMouseDown={() => { setCtxMenu(null); setStartOpen(false); setShowCalendar(false); setSelectedIcon(null); setShowVolume(false); setShowNetwork(false); }}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, items: desktopCtx() }); }}
      onTouchStart={(e) => onTouchStart(e, desktopCtx())}
      onTouchEnd={onTouchEnd}
    >
      {/* Desktop icons */}
      <div className="absolute top-3 left-3 grid" style={{ gridTemplateColumns: `repeat(12, ${GRID_W}px)`, gridAutoRows: `${GRID_H}px`, gap: 2 }}>
        {desktopIcons.map((ic, idx) => {
          const { col, row } = iconGridPos(idx);
          const iconPx = theme.iconSize === "small" ? 32 : theme.iconSize === "large" ? 56 : 44;
          const dbl = () => {
            if (ic.appId === "folder") openApp("folder", { folderIconId: ic.id, title: ic.label });
            else if (ic.appId === "web-app") openApp("web-app", { webUrl: ic.webUrl, title: ic.label });
            else openApp(ic.appId, { fileId: ic.fileId });
          };
          return (
            <div
              key={ic.id}
              className={`desktop-icon ${selectedIcon === ic.id ? "selected" : ""}`}
              style={{ gridColumn: col + 1, gridRow: row + 1, height: GRID_H }}
              onClick={(e) => { e.stopPropagation(); setSelectedIcon(ic.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); dbl(); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setSelectedIcon(ic.id);
                setCtxMenu({ x: e.clientX, y: e.clientY, items: iconCtx(ic) });
              }}
              onTouchStart={(e) => { e.stopPropagation(); setSelectedIcon(ic.id); onTouchStart(e, iconCtx(ic)); }}
              onTouchEnd={onTouchEnd}
            >
              <div className="flex justify-center mb-1">{appIcon(ic.appId, iconPx, ic.iconEmoji, ic.iconUrl)}</div>
              <div>{ic.label}</div>
            </div>
          );
        })}
      </div>

      {/* Widgets */}
      <div className="absolute top-4 right-4 aero-glass rounded-xl p-3 w-56 text-sm" style={{ color: "var(--foreground)" }}>
        <div className="font-semibold mb-1">📅 {now.toLocaleDateString(undefined, { weekday: "long" })}</div>
        <div className="text-3xl font-light">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        <div className="text-xs opacity-70">{now.toLocaleDateString()}</div>
      </div>
      <div className="absolute top-44 right-4 aero-glass rounded-xl p-3 w-56 text-sm">
        <div className="font-semibold mb-1">🌤️ Pueiville</div>
        <div className="text-2xl font-light">21°C</div>
        <div className="text-xs opacity-70">Glassy with light bloom</div>
      </div>

      {/* Windows */}
      {windows.map((w) => {
        const focused = w.z === Math.max(...windows.map((x) => x.z));
        return (
          <AppWindow key={w.id} win={w} focused={focused}
            onFocus={() => focusWin(w.id)}
            onClose={() => closeWin(w.id)}
            onMinimize={() => minWin(w.id)}
            onMaximize={() => maxWin(w.id)}
            onMove={(x, y) => moveWin(w.id, x, y)}
            onResize={(ww, hh) => resizeWin(w.id, ww, hh)}>
            <AppRenderer appId={w.appId} theme={theme} setTheme={setTheme}
              openApp={openAppSimple} wallpaper={theme.wallpaper} setWallpaper={setWallpaper}
              currentUser={currentUser} fileId={w.fileId} users={users}
              webUrl={w.webUrl} folderIconId={w.folderIconId} icons={icons}
              systemVersion={systemVersion}
              startUpgrade={(target) => { setUpgradeTarget(target); setUpgradeProgress(0); setPhase("upgrade"); }}
              uninstallApp={(appId) => setIcons((cur) => cur.filter((i) => !(i.appId === appId && !i.fileId && !i.webUrl)))}
              installWebApp={(label, url, iconUrl) => addIcon({ id: `web-${Date.now().toString(36)}`, label, appId: "web-app", webUrl: url, iconUrl: iconUrl || googleFaviconFor(url, 64) })}
              openWebApp={(url, title) => openApp("web-app", { webUrl: url, title })}
              openFolder={(folderIconId, title) => openApp("folder", { folderIconId, title })}
              setUsers={setUsers}
              signOut={() => { blip("shutdown"); setWindows([]); setCurrentUser(""); setPhase("login"); setPwInput(""); }}
              lockScreen={() => { blip("click"); setLocked(true); setPwInput(""); }}
              deleteAccount={(name) => {
                setUsers((prev) => prev.filter((u) => u.name !== name));
                setWindows([]);
                setCurrentUser("");
                setPhase("login");
                setPwInput("");
              }}
              onCreateShortcut={(label, fileId) => addIcon({ id: `f-${fileId}`, label, appId: w.appId, fileId })} />
          </AppWindow>
        );
      })}

      {/* Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9500] space-y-2">
        {notifs.map((n) => (
          <div key={n.id} className="aero-glass rounded-lg px-4 py-2 min-w-[260px] text-sm" style={{ animation: "fade-scale 0.2s ease-out" }}>
            <div className="font-semibold">{n.title}</div>
            <div className="text-xs opacity-80">{n.body}</div>
          </div>
        ))}
      </div>

      {/* Mascot */}
      {showMascot && windows.some(w => !w.minimized && w.maximized) && (
        <PueiMascot cursorPos={cursorPos} speak={mascotSpeak}
          onClick={() => {
            const tips = [
              "Tip: Drag a window to the top to maximize!",
              "Long-press on touch = right click.",
              "Try the App Store → Installer to install any website as an app.",
              "Right-click the desktop → New Folder.",
              "Settings → Wallpaper: use any image you painted!",
            ];
            const t = tips[Math.floor(Math.random() * tips.length)];
            setMascotSpeak(t); setTimeout(() => setMascotSpeak(null), 4000);
          }} />
      )}

      {/* Start menu */}
      {startOpen && (
        <div className="fixed bottom-12 left-2 aero-glass rounded-xl w-[440px] z-[9000] overflow-hidden"
          style={{ animation: "fade-scale 0.18s ease-out" }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="aero-titlebar px-4 py-2 flex items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl overflow-hidden"
              style={{ background: "var(--gradient-aero)" }}>
              {currentAvatar?.startsWith("data:")
                ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                : (currentAvatar || "👤")}
            </div>
            <div className="font-semibold">{currentUser}</div>
          </div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {(["file-explorer", "app-store", "puei-social", "pueinet", "puei-messenger", "puei-paint", "notepad", "calculator", "settings", "about"] as AppId[]).map((id) => (
              <button key={id} onClick={() => { openApp(id); setStartOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/40 text-sm text-left">
                {appIcon(id, 26)}<span>{APP_TITLES[id]}</span>
              </button>
            ))}
          </div>
          <div className="border-t flex justify-between p-2" style={{ background: "var(--glass)" }}>
            <button className="aero-button rounded px-3 py-1 text-xs"
              onClick={() => { setLocked(true); setStartOpen(false); setPwInput(""); }}>🔒 Lock</button>
            <button className="aero-button rounded px-3 py-1 text-xs"
              onClick={() => { setStartOpen(false); setPhase("login"); setPwInput(""); }}>🔄 Switch User</button>
            <button className="aero-button rounded px-3 py-1 text-xs"
              onClick={() => { blip("shutdown"); setStartOpen(false); setPhase("shutdown"); setWindows([]); }}>⏻ Shut down</button>
          </div>
        </div>
      )}

      {/* Calendar */}
      {showCalendar && (
        <div className="fixed bottom-12 right-2 aero-glass rounded-xl p-3 z-[9000] w-64" onMouseDown={(e) => e.stopPropagation()}>
          <div className="text-center font-semibold mb-2">{now.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="opacity-60">{d}</div>)}
            {Array.from({ length: 35 }).map((_, i) => {
              const day = i - new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 1;
              const valid = day > 0 && day <= new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
              const today = valid && day === now.getDate();
              return <div key={i} className="py-1 rounded"
                style={{ background: today ? "var(--gradient-aero)" : undefined, color: today ? "white" : valid ? undefined : "transparent" }}>
                {valid ? day : "•"}
              </div>;
            })}
          </div>
        </div>
      )}

      {/* Taskbar */}
      <div className="taskbar-bg fixed bottom-0 left-0 right-0 h-12 flex items-center px-1 gap-1 z-[8000]"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: taskbarCtx() }); }}>
        <button className="aero-start-orb w-10 h-10 rounded-full flex items-center justify-center mx-1 overflow-hidden"
          title="Start"
          onClick={(e) => { e.stopPropagation(); blip("click"); setStartOpen(!startOpen); setShowCalendar(false); }}>
          <PueiLogoSvg size={26} />
        </button>
        {(["file-explorer", "app-store", "puei-social", "pueinet", "puei-messenger"] as AppId[]).map((id) => (
          <button key={id} onClick={(e) => { e.stopPropagation(); openApp(id); }}
            onMouseEnter={() => blip("hover")}
            title={APP_TITLES[id]}
            className="taskbar-item w-9 h-9 rounded flex items-center justify-center text-lg">
            {appIcon(id, 22)}
          </button>
        ))}
        <div className="w-px h-7 bg-white/20 mx-1" />
        {windows.map((w) => (
          <button key={w.id}
            className={`taskbar-item h-9 px-3 rounded flex items-center gap-2 text-xs ${w.z === Math.max(...windows.map((x)=>x.z)) && !w.minimized ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); if (w.minimized) focusWin(w.id); else minWin(w.id); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: [
              { label: "Restore", action: () => focusWin(w.id) },
              { label: "Minimize", action: () => minWin(w.id) },
              { label: "Maximize", action: () => maxWin(w.id) },
              { sep: true },
              { label: "Close", action: () => closeWin(w.id) },
            ]});}}>
            {appIcon(w.appId, 18)}
            <span className="max-w-[120px] truncate">{w.title}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-2 text-white text-xs">
          <span title="Network" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowNetwork(!showNetwork); setShowVolume(false); }}>📶</span>
          <span title="Sound" onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); setShowNetwork(false); blip("notify"); }} className="cursor-pointer">🔊</span>
          <button className="aero-button rounded px-2 py-1 text-[10px]"
            onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); setStartOpen(false); }}
            style={{ color: "var(--foreground)" }}>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<br />
            {now.toLocaleDateString()}
          </button>
        </div>
        <button className="h-9 w-3 ml-1 border-l border-white/20" title="Show desktop"
          onClick={(e) => { e.stopPropagation(); setWindows(windows.map((w) => ({ ...w, minimized: true }))); }} />
      </div>

      {/* Volume popup */}
      {showVolume && (
        <div className="fixed bottom-14 right-24 aero-glass rounded-xl p-4 z-[9000] w-52" onMouseDown={(e) => e.stopPropagation()}>
          <div className="font-semibold text-sm mb-3">🔊 Volume</div>
          <input type="range" min={0} max={100} value={volume}
            onChange={(e) => { setVolume(Number(e.target.value)); }}
            className="w-full" />
          <div className="text-center text-xs opacity-70 mt-1">{volume}%</div>
          {volume === 0 && <div className="text-center text-xs opacity-60 mt-1">Muted</div>}
        </div>
      )}

      {/* Network popup */}
      {showNetwork && (
        <div className="fixed bottom-14 right-36 aero-glass rounded-xl p-4 z-[9000] w-56" onMouseDown={(e) => e.stopPropagation()}>
          <div className="font-semibold text-sm mb-2">📶 PueiNet</div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="opacity-60">Status</span><span className={netInfo.online ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>{netInfo.online ? "Connected" : "Offline"}</span></div>
            <div className="flex justify-between"><span className="opacity-60">Network</span><span>{netInfo.type || "WiFi"}</span></div>
            <div className="flex justify-between"><span className="opacity-60">Ping</span><span>{netInfo.ping != null ? netInfo.ping + " ms" : "…"}</span></div>
            <div className="flex justify-between"><span className="opacity-60">Speed</span><span>{netInfo.speed != null ? "↓ " + netInfo.speed + " Mbps" : "…"}</span></div>
          </div>
        </div>
      )}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}
