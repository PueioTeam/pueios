import { useCallback, useEffect, useRef, useState } from "react";
import {
  blip, compareVersion, defaultIcons, defaultTheme, iconGridPos, googleFaviconFor, pueiNumberFor,
  loadState, saveState, registerInDirectory, SYSTEM_ORDER,
  type AppId, type DesktopIcon, type User, type SystemVersion,
  type Theme, type WallpaperId, type WindowState,
} from "./state";
import { AppWindow, ContextMenu, appIcon } from "./Window";
import { AppRenderer } from "./apps";
import { PueiMascot, PueiLogoSvg } from "./Mascot";
import { pullAndMergeFiles, pushFile as pushFileToServer, removeFileFromServer } from "./fileSync";
import { loadFiles, saveFiles, upsertFile } from "./state";
import { loginRemote, createRemote, applySnapshot, schedulePush, markUserDeleted, unmarkUserDeleted, type AccountSnapshot } from "./accountSync";


type Phase = "install" | "boot" | "login" | "desktop" | "shutdown" | "recovery" | "upgrade";

const APP_TITLES: Record<AppId, string> = {
  "puei-paint": "Puei Paint 2",
  "puei-board": "PueiBoard",
  "pueinet": "PueiWeb",
  "puei-cloud-chat": "PueiCloudChat",
  "puei-studio": "Puei Studio",
  "file-explorer": "Computer",
  "settings": "Settings",
  "about": "About PueiOS",
  "notepad": "Notepad",
  "calculator": "Calculator",
  "app-store": "App Store",
  "puei-social": "PueiSocial",
  "folder": "Folder",
  "web-app": "Web App",
  "recycle-bin": "Recycle Bin",
  "chess": "Chess",
  "puei-mansion": "Puei Mansion",
  "pmail": "PMail",
  "pueyracing": "Puei Space",
  "iso-viewer": "ISO Viewer",
  "zip-viewer": "ZIP Viewer",
};
const APP_SIZES: Partial<Record<AppId, { w: number; h: number }>> = {
  "calculator": { w: 280, h: 380 },
  "notepad": { w: 520, h: 420 },
  "about": { w: 480, h: 440 },
  "settings": { w: 820, h: 560 },
  "puei-board": { w: 860, h: 620 },
  "puei-cloud-chat": { w: 720, h: 500 },
  "puei-studio": { w: 980, h: 660 },
  "pueinet": { w: 820, h: 560 },
  "puei-paint": { w: 820, h: 560 },
  "file-explorer": { w: 760, h: 500 },
  "app-store": { w: 760, h: 560 },
  "puei-social": { w: 720, h: 600 },
  "folder": { w: 520, h: 400 },
  "web-app": { w: 900, h: 600 },
  "recycle-bin": { w: 640, h: 460 },
  "chess": { w: 560, h: 600 },
  "puei-mansion": { w: 720, h: 540 },
  "pmail": { w: 860, h: 580 },
  "pueyracing": { w: 900, h: 620 },
};

const GRID_W = 96;
const GRID_H = 92;
const SECURITY_KEY = "puei";

function RemoveAccountButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="absolute top-1 right-1 flex flex-col items-end gap-1 z-10"
        style={{ background: "rgba(20,10,10,0.92)", borderRadius: 8, padding: "6px 8px", boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        <div className="text-xs text-white mb-1 whitespace-nowrap">Remove <b>{name}</b>?</div>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
            className="rounded px-2 py-0.5 text-xs"
            style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>Cancel</button>
          <button onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{ background: "rgba(220,50,50,0.85)", color: "white" }}>Remove</button>
        </div>
      </div>
    );
  }
  return (
    <button
      title="Remove account from this device"
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: "rgba(220,50,50,0.7)", color: "white", lineHeight: 1 }}>
      ✕
    </button>
  );
}

// SVG arc path helper for busy cursor animation
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const span = ((endDeg - startDeg) % 360 + 360) % 360;
  const large = span > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

export function PueiOS() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [bootProgress, setBootProgress] = useState(0);
  const [eolDismissed, setEolDismissed] = useState(() => sessionStorage.getItem("pueios-eol-dismissed") === "1");
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [icons, setIcons] = useState<DesktopIcon[]>(defaultIcons);
  const [users, setUsers] = useState<User[]>([]);
  const [installed, setInstalled] = useState(false);
  const [systemVersion, setSystemVersion] = useState<SystemVersion>("PueiOS 1");
  const [installMode, setInstallMode] = useState<"new" | "existing" | null>(null);
  const [pwOption, setPwOption] = useState<"have" | "none" | "create-now">("have");
  const [upgradeTarget, setUpgradeTarget] = useState<SystemVersion>("PueiOS 2");
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [upgradeStartedAt, setUpgradeStartedAt] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [installedKeys, setInstalledKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pueios2-installed-v1") || "[]") as string[]); } catch { return new Set(); }
  });
  const markInstalled = (key: string) => setInstalledKeys((prev) => {
    const next = new Set(prev); next.add(key);
    try { localStorage.setItem("pueios2-installed-v1", JSON.stringify([...next])); } catch {}
    return next;
  });
  const markUninstalled = (key: string) => setInstalledKeys((prev) => {
    const next = new Set(prev); next.delete(key);
    try { localStorage.setItem("pueios2-installed-v1", JSON.stringify([...next])); } catch {}
    return next;
  });
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [remember, setRemember] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [zCounter, setZCounter] = useState(1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [showAddShortcut, setShowAddShortcut] = useState(false);
  const [touchDot, setTouchDot] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [notifs, setNotifs] = useState<{ id: number; title: string; body: string; kind?: "default" | "update" }[]>([]);
  const [mascotSpeak, setMascotSpeak] = useState<string | null>(null);
  const [showMascot] = useState(true);
  const [showVolume, setShowVolume] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [aeroPeek, setAeroPeek] = useState(false);
  const [volume, setVolume] = useState(() => { try { const v = localStorage.getItem("pueios2-volume"); return v !== null ? Number(v) : 80; } catch { return 80; } });
  const [netInfo, setNetInfo] = useState<{ ping: number | null; speed: number | null; type: string; online: boolean }>({ ping: null, speed: null, type: "?", online: true });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [busyCursor, setBusyCursor] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const track = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", track);
    return () => window.removeEventListener("mousemove", track);
  }, []);
  const [pueiDialog, setPueiDialog] = useState<{ msg: string; onOk: () => void; onCancel?: () => void } | null>(null);
  type PinnedEntry = { appId: AppId; webUrl?: string; label?: string };
  const DEFAULT_PINNED: PinnedEntry[] = [
    { appId: "file-explorer" }, { appId: "app-store" }, { appId: "puei-social" },
    { appId: "pueinet" }, { appId: "puei-cloud-chat" },
  ];
  const [pinnedApps, setPinnedApps] = useState<PinnedEntry[]>(() => {
    try {
      const saved = localStorage.getItem("pueios2-pinned-v2");
      if (saved) return JSON.parse(saved) as PinnedEntry[];
      // Migrate from v1 (plain AppId strings)
      const v1 = localStorage.getItem("pueios2-pinned-v1");
      if (v1) return (JSON.parse(v1) as AppId[]).map((id) => ({ appId: id }));
      return DEFAULT_PINNED;
    } catch { return DEFAULT_PINNED; }
  });
  const savePinned = (list: PinnedEntry[]) => { try { localStorage.setItem("pueios2-pinned-v2", JSON.stringify(list)); } catch {} };
  const pinToTaskbar = (entry: PinnedEntry) => setPinnedApps((prev) => {
    const key = entry.webUrl ?? entry.appId;
    if (prev.some((p) => (p.webUrl ?? p.appId) === key)) return prev;
    const next = [...prev, entry];
    savePinned(next); return next;
  });
  const unpinFromTaskbar = (key: string) => setPinnedApps((prev) => {
    const next = prev.filter((p) => (p.webUrl ?? p.appId) !== key);
    savePinned(next); return next;
  });
  const openPinned = (p: PinnedEntry) => {
    if (p.appId === "web-app" && p.webUrl) openApp("web-app", { webUrl: p.webUrl, title: p.label });
    else openApp(p.appId);
  };
  const [locked, setLocked] = useState(false);
  const pendingUpdateNotif = useRef(false);
  const upgradeFinishQueued = useRef(false);
    const startSystemUpgrade = (target: SystemVersion) => {
      // Push current state to cloud immediately so deletions aren't restored on re-login after upgrade
      const u = users.find((x) => x.name === currentUser);
      if (u) schedulePush(u, 0);
      setUpgradeTarget(target);
      setUpgradeProgress(0);
      setUpgradeStartedAt(Date.now());
      upgradeFinishQueued.current = false;
      setPhase("upgrade");
    };

  const dragRef = useRef<{ id: string; startX: number; startY: number; origLeft: number; origTop: number; el: HTMLElement } | null>(null);
  const wasDragged = useRef(false);
  const DESKTOP_OX = 12;
  const DESKTOP_OY = 12;
  const getDesktopGridBounds = () => {
    if (typeof window === "undefined") return { maxCol: 0, maxRow: 0 };
    const TASKBAR_H = 48;
    const maxCol = Math.max(0, Math.floor((window.innerWidth - DESKTOP_OX - 8 - GRID_W) / GRID_W));
    const maxRow = Math.max(0, Math.floor((window.innerHeight - TASKBAR_H - DESKTOP_OY - 8 - GRID_H) / GRID_H));
    return { maxCol, maxRow };
  };
  const clampGridPos = (col: number, row: number) => {
    const { maxCol, maxRow } = getDesktopGridBounds();
    return {
      col: Math.max(0, Math.min(maxCol, col)),
      row: Math.max(0, Math.min(maxRow, row)),
    };
  };
  const clampPixelPos = (left: number, top: number) => {
    const { maxCol, maxRow } = getDesktopGridBounds();
    const maxLeft = DESKTOP_OX + maxCol * GRID_W;
    const maxTop = DESKTOP_OY + maxRow * GRID_H;
    return {
      left: Math.max(DESKTOP_OX, Math.min(maxLeft, left)),
      top: Math.max(DESKTOP_OY, Math.min(maxTop, top)),
    };
  };
  const resolveIconPos = (ic: DesktopIcon, idx: number) => {
    if (ic.col !== undefined && ic.row !== undefined) {
      const p = clampGridPos(ic.col, ic.row);
      return { left: DESKTOP_OX + p.col * GRID_W, top: DESKTOP_OY + p.row * GRID_H };
    }
    const def = iconGridPos(idx);
    const p = clampGridPos(def.col, def.row);
    return { left: DESKTOP_OX + p.col * GRID_W, top: DESKTOP_OY + p.row * GRID_H };
  };
  // Window-level mouse drag handlers — attached once drag starts
  const startIconDrag = (e: React.MouseEvent, ic: DesktopIcon, idx: number) => {
    if (e.button !== 0) return;
    wasDragged.current = false;
    e.stopPropagation();
    e.preventDefault();
    const p = resolveIconPos(ic, idx);
    const el = e.currentTarget as HTMLElement;
    dragRef.current = { id: ic.id, startX: e.clientX, startY: e.clientY, origLeft: p.left, origTop: p.top, el };
    el.style.zIndex = "500";
    el.style.opacity = "0.85";
    el.style.transform = "scale(1.06)";
    el.style.transition = "none";
    el.style.cursor = "grabbing";
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) wasDragged.current = true;
      const p = clampPixelPos(dragRef.current.origLeft + dx, dragRef.current.origTop + dy);
      dragRef.current.el.style.left = p.left + "px";
      dragRef.current.el.style.top = p.top + "px";
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!dragRef.current) return;
      const { el: de, origLeft, origTop, id } = dragRef.current;
      de.style.zIndex = "";
      de.style.opacity = "";
      de.style.transform = "";
      de.style.transition = "";
      de.style.cursor = "";
      if (wasDragged.current) {
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const p = clampGridPos(
          Math.round((origLeft + dx - DESKTOP_OX) / GRID_W),
          Math.round((origTop + dy - DESKTOP_OY) / GRID_H),
        );
        const col = p.col;
        const row = p.row;
        setIcons((prev) => prev.map((i) => i.id === id ? { ...i, col, row } : i));
      } else {
        const p = clampPixelPos(origLeft, origTop);
        de.style.left = p.left + "px";
        de.style.top = p.top + "px";
      }
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const startIconTouchDrag = (e: React.TouchEvent, ic: DesktopIcon, idx: number) => {
    if (e.touches.length !== 1) return;
    wasDragged.current = false;
    const t = e.touches[0];
    const p = resolveIconPos(ic, idx);
    const el = e.currentTarget as HTMLElement;
    dragRef.current = { id: ic.id, startX: t.clientX, startY: t.clientY, origLeft: p.left, origTop: p.top, el };
    el.style.zIndex = "500";
    el.style.opacity = "0.85";
    el.style.transform = "scale(1.06)";
    el.style.transition = "none";
    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current || ev.touches.length !== 1) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 6) {
        wasDragged.current = true;
        if (touchTimer.current) {
          clearTimeout(touchTimer.current);
          touchTimer.current = null;
        }
      }
      const p = clampPixelPos(dragRef.current.origLeft + dx, dragRef.current.origTop + dy);
      dragRef.current.el.style.left = p.left + "px";
      dragRef.current.el.style.top = p.top + "px";
      ev.preventDefault();
    };
    const onEnd = (ev: TouchEvent) => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      if (!dragRef.current) return;
      const { el: de, origLeft, origTop, id } = dragRef.current;
      de.style.zIndex = "";
      de.style.opacity = "";
      de.style.transform = "";
      de.style.transition = "";
      const changedTouch = ev.changedTouches[0];
      if (wasDragged.current && changedTouch) {
        const dx = changedTouch.clientX - dragRef.current.startX;
        const dy = changedTouch.clientY - dragRef.current.startY;
        const p = clampGridPos(
          Math.round((origLeft + dx - DESKTOP_OX) / GRID_W),
          Math.round((origTop + dy - DESKTOP_OY) / GRID_H),
        );
        setIcons((prev) => prev.map((i) => i.id === id ? { ...i, col: p.col, row: p.row } : i));
      } else {
        const p = clampPixelPos(origLeft, origTop);
        de.style.left = p.left + "px";
        de.style.top = p.top + "px";
        // Tap (not drag, not long-press) = open the app
        if (touchTimer.current) {
          clearTimeout(touchTimer.current);
          touchTimer.current = null;
          const tapped = icons.find((i) => i.id === id);
          if (tapped) {
            if (tapped.appId === "folder") openApp("folder", { folderIconId: tapped.id, title: tapped.label });
            else if (tapped.appId === "web-app") openApp("web-app", { webUrl: tapped.webUrl, title: tapped.label });
            else openApp(tapped.appId, { fileId: tapped.fileId });
          }
        }
      }
      dragRef.current = null;
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
  };
  const [loginUser, setLoginUser] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchName, setSwitchName] = useState("");
  const [switchPw, setSwitchPw] = useState("");
  const [switchErr, setSwitchErr] = useState("");
  const [newAcc, setNewAcc] = useState({ name: "", password: "", avatar: "🧑", color: "200" });

  // Recovery / reinstall state (hoisted so useState isn't called inside a conditional render)
  const [reinstallStep, setReinstallStep] = useState<"menu" | "confirm">("menu");
  const [recoveryPw, setRecoveryPw] = useState("");
  const [recoveryErr, setRecoveryErr] = useState("");

  // Install wizard state
  const [installStep, setInstallStep] = useState(0);
  const [installKey, setInstallKey] = useState("");
  const [installErr, setInstallErr] = useState("");
  const [installProgress, setInstallProgress] = useState(0);

  // Load persisted
  useEffect(() => {
    const s = loadState();
    setThemeState(s.theme); setUsers(s.users);
    setInstalled(s.installed);
    setSystemVersion(s.systemVersion);
    // Migration: clean up stale icons and ensure PueiCloudChat always exists
    let loadedIcons: DesktopIcon[] = s.icons?.length ? s.icons : defaultIcons;
    // Remove any stale puei-messenger icons
    loadedIcons = loadedIcons.filter((i: any) => i.appId !== "puei-messenger" && i.appId !== "solitaire");
    // Add PueiCloudChat if missing
    if (!loadedIcons.some((i: any) => i.appId === "puei-cloud-chat" && !i.fileId && !i.webUrl)) {
      loadedIcons = [...loadedIcons, { id: "i-msg", label: "PueiCloudChat", appId: "puei-cloud-chat" as const }];
    }
    loadedIcons = loadedIcons.filter((i: any) => i.appId !== "puei-mail");
    if (!loadedIcons.some((i: any) => i.appId === "puei-studio" && !i.fileId && !i.webUrl)) {
      loadedIcons = [...loadedIcons, { id: "i-studio", label: "Puei Studio", appId: "puei-studio" as const }];
    }
    // Strip any icons with unknown appIds (stale from old versions)
    const VALID_APP_IDS = new Set(["puei-paint","puei-board","pueinet","puei-cloud-chat","puei-studio","file-explorer","settings","about","notepad","calculator","app-store","puei-social","folder","web-app","recycle-bin","chess","puei-mansion","zip-viewer","iso-viewer"]);
    loadedIcons = loadedIcons.filter((i: any) => i.webUrl || VALID_APP_IDS.has(i.appId));
    // Always enforce correct iconUrl for known shortcuts (overwrite any stale emoji or wrong url)
    const knownIconUrls: Record<string, string> = {
      "https://bezosmp.lovable.app": "/bezosmp-icon.svg",
      "puei://films": "/puei-films-icon.svg",
      "puei://updates": "/puei-updater-icon.svg",
    };
    loadedIcons = loadedIcons.map((i: any) => {
      if (!i.webUrl || !knownIconUrls[i.webUrl]) return i;
      const { iconEmoji: _e, ...rest } = i;
      return { ...rest, iconUrl: knownIconUrls[i.webUrl] };
    });
    setIcons(loadedIcons);
    // Seed installedKeys from existing desktop icons so delete-shortcut ≠ uninstall works for all apps
    const stored = new Set<string>(JSON.parse(localStorage.getItem("pueios2-installed-v1") || "[]") as string[]);
    loadedIcons.forEach((i: any) => {
      if (i.webUrl) stored.add(`web:${i.webUrl}`);
      else if (i.appId && !i.fileId) stored.add(`app:${i.appId}`);
    });
    localStorage.setItem("pueios2-installed-v1", JSON.stringify([...stored]));
    setInstalledKeys(stored);
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
    if (theme.accentC !== undefined) root.style.setProperty("--accent-c", String(theme.accentC));
    else root.style.removeProperty("--accent-c");
    if (theme.accentL !== undefined) root.style.setProperty("--accent-l", String(theme.accentL));
    else root.style.removeProperty("--accent-l");
    if (theme.taskbarColor) root.style.setProperty("--taskbar", theme.taskbarColor);
    else root.style.removeProperty("--taskbar");
    root.classList.toggle("dark", theme.dark);
    root.classList.toggle("high-contrast", !!theme.highContrast);
    root.classList.toggle("win7-aero", !!theme.win7Aero);
    root.style.setProperty("--aero-glass-opacity", String(Math.max(10, Math.min(95, theme.glassOpacity ?? 38))));
    root.style.setProperty("--aero-blur", `${Math.max(8, Math.min(40, theme.glassBlur ?? 22))}px`);
    root.style.setProperty("--aero-saturation", `${Math.max(100, Math.min(260, theme.glassSaturation ?? 180))}%`);
    root.style.setProperty("--aero-glow-alpha", String(Math.max(10, Math.min(100, theme.aeroGlow ?? 50)) / 100));
    if (theme.highContrast) {
      root.style.setProperty("--glass", "#000");
      root.style.setProperty("--glass-strong", "#000");
      root.style.setProperty("--accent", theme.highContrastColor || "#ffff00");
      root.style.setProperty("--foreground", theme.highContrastColor || "#ffff00");
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
    // When accentC=0 (white/black preset), override titlebar and all chrome vars — runs after transparency/contrast to win
    if (!theme.highContrast && theme.accentC === 0 && theme.accentL !== undefined) {
      const isWhite = theme.accentL > 0.5;
      root.style.setProperty("--titlebar", isWhite
        ? "linear-gradient(180deg,rgba(240,240,240,0.45) 0%,rgba(220,220,220,0.30) 40%,rgba(200,200,200,0.18) 100%)"
        : "linear-gradient(180deg,rgba(30,30,30,0.55) 0%,rgba(18,18,18,0.45) 40%,rgba(10,10,10,0.35) 100%)");
      root.style.setProperty("--titlebar-text", isWhite ? "oklch(0.15 0 0)" : "oklch(0.9 0 0)");
      root.style.setProperty("--background", isWhite ? "oklch(0.97 0 0)" : "oklch(0.12 0 0)");
      root.style.setProperty("--foreground", isWhite ? "oklch(0.1 0 0)" : "oklch(0.92 0 0)");
      root.style.setProperty("--muted", isWhite ? "oklch(0.92 0 0)" : "oklch(0.18 0 0)");
      root.style.setProperty("--muted-foreground", isWhite ? "oklch(0.45 0 0)" : "oklch(0.65 0 0)");
      root.style.setProperty("--border", isWhite ? "oklch(0.7 0 0 / 0.4)" : "oklch(0.4 0 0 / 0.5)");
      root.style.setProperty("--glass", isWhite ? "oklch(0.96 0 0 / 0.18)" : "oklch(0.15 0 0 / 0.35)");
      root.style.setProperty("--glass-strong", isWhite ? "oklch(0.98 0 0 / 0.38)" : "oklch(0.12 0 0 / 0.55)");
      root.style.setProperty("--accent-2", isWhite ? "oklch(0.88 0 0)" : "oklch(0.25 0 0)");
      root.style.setProperty("--gradient-aero", isWhite
        ? "linear-gradient(135deg,oklch(0.88 0 0 / 0.9),oklch(0.78 0 0 / 0.9))"
        : "linear-gradient(135deg,oklch(0.22 0 0 / 0.9),oklch(0.15 0 0 / 0.9))");
    } else if (theme.accentC !== 0) {
      root.style.removeProperty("--titlebar");
      root.style.removeProperty("--titlebar-text");
      root.style.removeProperty("--background");
      root.style.removeProperty("--muted");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--border");
      root.style.removeProperty("--accent-2");
      root.style.removeProperty("--gradient-aero");
    }
    saveState({ installed, systemVersion, theme, icons, users, lastUser: loginUser, remember });
    users.forEach((u) => { if (u.pueiNumber) registerInDirectory(u); });
  }, [installed, systemVersion, theme, icons, users, loginUser, remember]);

  useEffect(() => {
    let el = document.getElementById("puei-cursor-style") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "puei-cursor-style"; document.head.appendChild(el); }
    // Don't apply custom SVG cursors on touch-only screens — they show as a dot
    if (!window.matchMedia("(pointer: fine)").matches) { el.textContent = ""; return; }
    const c = theme.cursorColor ?? "#ffffff";
    const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    const arrow = (stroke: string) => enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M3 2 L3 18 L7 14 L10.5 21 L12.5 20 L9 13 L15 13 Z' fill='white' stroke='${stroke}' stroke-width='1.5' stroke-linejoin='round'/></svg>`
    );
    const hand = (stroke: string) => enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='24' viewBox='0 0 20 24'><rect x='4' y='0' width='4' height='12' rx='2' fill='white' stroke='${stroke}' stroke-width='1.2'/><rect x='9' y='3' width='4' height='10' rx='2' fill='white' stroke='${stroke}' stroke-width='1.2'/><rect x='14' y='4' width='3.5' height='9' rx='1.75' fill='white' stroke='${stroke}' stroke-width='1.2'/><rect x='2' y='9' width='16' height='12' rx='4' fill='white' stroke='${stroke}' stroke-width='1.2'/><ellipse cx='2' cy='14' rx='2.5' ry='3.5' fill='white' stroke='${stroke}' stroke-width='1.2'/></svg>`
    );
    const ibeam = enc(`<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><path d='M7 2 L9 2 Q10 2 10 3 L10 17 Q10 18 9 18 L7 18' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round'/><path d='M13 2 L11 2 Q10 2 10 3 L10 17 Q10 18 11 18 L13 18' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round'/></svg>`);
    // Windows 7-style working-in-background: arrow + small arc ring at the tip (bottom-right of arrow)
    const arrowBusy = enc(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M3 2 L3 20 L7 15 L11 22 L13.5 20.5 L9.5 13.5 L16 13.5 Z' fill='white' stroke='${c}' stroke-width='1.5' stroke-linejoin='round'/><circle cx='24' cy='24' r='6' fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='2.5'/><path d='M24 18 A6 6 0 0 1 30 24' fill='none' stroke='${c}' stroke-width='2.5' stroke-linecap='round'/><path d='M18 24 A6 6 0 0 1 24 18' fill='none' stroke='rgba(150,200,255,0.45)' stroke-width='2' stroke-linecap='round'/></svg>`);
    const css =
`* { cursor: ${arrow(c)} 3 2, default !important; }
*[style*="cursor: move"], *[style*="cursor:move"] { cursor: ${arrow(c)} 3 2, move !important; }
*[style*="cursor: grab"], *[style*="cursor:grab"] { cursor: ${hand(c)} 6 0, grab !important; }
*[style*="cursor: grabbing"], *[style*="cursor:grabbing"] { cursor: ${hand(c)} 6 0, grabbing !important; }
input, textarea, [contenteditable] { cursor: ${ibeam} 10 10, text !important; }
button, a, [role="button"], select { cursor: ${hand(c)} 6 0, pointer !important; }
[style*="cursor: progress"], [style*="cursor:progress"] { cursor: ${arrowBusy} 3 2, progress !important; }`;
    el.textContent = css;
  }, [theme.cursorColor]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(t);
  }, []);

  const touchHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return;
      if (touchHideTimer.current) clearTimeout(touchHideTimer.current);
      setTouchDot({ x: t.clientX, y: t.clientY, visible: true });
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) setTouchDot({ x: t.clientX, y: t.clientY, visible: true });
      // Keep cursor visible for 1.2s after lift so it doesn't vanish instantly
      if (touchHideTimer.current) clearTimeout(touchHideTimer.current);
      touchHideTimer.current = setTimeout(() => setTouchDot(d => ({ ...d, visible: false })), 1200);
    };
    window.addEventListener("touchstart", onTouch as any, { passive: true });
    window.addEventListener("touchmove", onTouch as any, { passive: true });
    window.addEventListener("touchend", onEnd as any, { passive: true });
    window.addEventListener("touchcancel", onEnd as any, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouch as any);
      window.removeEventListener("touchmove", onTouch as any);
      window.removeEventListener("touchend", onEnd as any);
      window.removeEventListener("touchcancel", onEnd as any);
      if (touchHideTimer.current) clearTimeout(touchHideTimer.current);
    };
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
        setMascotSpeak("Hi! I'm Puei. Click me for quick tips ✦");
        setTimeout(() => setMascotSpeak(null), 5000);
      }, 800);
    }
    if (phase === "desktop" && pendingUpdateNotif.current) {
      pendingUpdateNotif.current = false;
      pushNotif("New updates installed", `Congratulations! ${upgradeTarget} is now installed and ready.`, "update");
    }
  }, [phase, currentUser, systemVersion, upgradeTarget]);

  useEffect(() => {
    if (phase !== "upgrade") return;
    const started = upgradeStartedAt ?? Date.now();
    if (upgradeStartedAt === null) setUpgradeStartedAt(started);
    const durationMs = upgradeTarget === "PueiOS 2" ? 70000 : upgradeTarget === "PueiOS 2+" ? 95000 : 125000;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const progress01 = Math.min(1, elapsed / durationMs);
      const eased = Math.pow(progress01, 0.88);
      const next = Math.min(100, eased * 100);
      setUpgradeProgress((prev) => Math.max(prev, next));
    }, 250);
    return () => clearInterval(timer);
  }, [phase, upgradeStartedAt, upgradeTarget]);

  useEffect(() => {
    if (phase !== "upgrade" || upgradeProgress < 100 || upgradeFinishQueued.current) return;
    upgradeFinishQueued.current = true;
    const done = window.setTimeout(() => {
      setSystemVersion(upgradeTarget);
      pendingUpdateNotif.current = true;
      if (upgradeTarget === "PueiOS 2") {
        setThemeState((prev) => ({ ...prev, accentH: 220, dark: false }));
      }
      if (upgradeTarget === "PueiOS 2+") {
        setThemeState((prev) => ({
          ...prev,
          accentH: 232,
          transparency: true,
          fullWindowTransparency: true,
          win7Aero: true,
          glassOpacity: 48,
          glassSaturation: 195,
          aeroGlow: 68,
        }));
        setIcons((cur) => cur.some((i) => i.appId === "puei-board" && !i.fileId && !i.webUrl)
          ? cur
          : [...cur, { id: "native-puei-board", label: "PueiBoard", appId: "puei-board", iconEmoji: "📌" }]);
      }
      setPhase("boot");
      setBootProgress(0);
      setUpgradeProgress(0);
      setUpgradeStartedAt(null);
      blip("notify");
    }, 2600);
    return () => clearTimeout(done);
  }, [phase, upgradeProgress, upgradeTarget]);

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




  const [wallpaperTransitioning, setWallpaperTransitioning] = useState(false);
  const [wallpaperProgress, setWallpaperProgress] = useState(0);
  const setTheme = (t: Theme) => setThemeState(t);
  const setWallpaper = (w: WallpaperId) => {
    setThemeState({ ...theme, wallpaper: w });
  };

  const pushNotif = (title: string, body: string, kind: "default" | "update" = "default") => {
    blip("notify");
    const id = Date.now() + Math.random();
    setNotifs((n) => [...n, { id, title, body, kind }]);
    setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), 4500);
  };

  const focusWin = useCallback((id: string) => {
    setZCounter((z) => z + 1);
    setWindows((ws) => ws.map((w) => w.id === id ? { ...w, z: zCounter + 1, minimized: false } : w));
  }, [zCounter]);

  const triggerBusy = () => {
    setBusyCursor(true);
    window.setTimeout(() => setBusyCursor(false), 3000);
  };

  // Animate "working in background" cursor by cycling SVG frames in a style element
  useEffect(() => {
    const el = document.getElementById("puei-busy-cursor") as HTMLStyleElement | null
      ?? (() => { const s = document.createElement("style"); s.id = "puei-busy-cursor"; document.head.appendChild(s); return s; })();
    if (!busyCursor) { el.textContent = ""; return; }
    const c = theme.cursorColor ?? "#ffffff";
    const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    // Build one frame: arrow body + blue ring with arc at given rotation angle
    const frame = (deg: number) => enc(
      `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>` +
      // Arrow
      `<path d='M3 2 L3 20 L7 15 L11 22 L13.5 20.5 L9.5 13.5 L16 13.5 Z' fill='white' stroke='${c}' stroke-width='1.4' stroke-linejoin='round'/>` +
      // Ring track
      `<circle cx='23' cy='23' r='6' fill='none' stroke='rgba(120,180,255,0.18)' stroke-width='2.5'/>` +
      // Spinning arc — draw two arcs so the bright one is the leading edge
      `<path d='${arcPath(23, 23, 6, deg, deg + 240)}' fill='none' stroke='rgba(80,160,255,0.35)' stroke-width='2.5' stroke-linecap='round'/>` +
      `<path d='${arcPath(23, 23, 6, deg + 180, deg + 260)}' fill='none' stroke='#7ec8ff' stroke-width='2.5' stroke-linecap='round'/>` +
      `</svg>`
    );
    let angle = 0;
    const tick = () => {
      const cur = `${frame(angle)} 3 2, progress`;
      el.textContent = `* { cursor: ${cur} !important; } button, a, [role="button"] { cursor: ${cur} !important; }`;
      angle = (angle + 30) % 360;
    };
    tick();
    const id = setInterval(tick, 60);
    return () => { clearInterval(id); el.textContent = ""; };
  }, [busyCursor, theme.cursorColor]);

  // In-app replacements for browser alert() / confirm() — avoids "site says:" browser chrome
  const pueiAlert = (msg: string, onOk?: () => void) =>
    setPueiDialog({ msg, onOk: () => { setPueiDialog(null); onOk?.(); } });
  const pueiConfirm = (msg: string, onOk: () => void, onCancel?: () => void) =>
    setPueiDialog({ msg, onOk: () => { setPueiDialog(null); onOk(); }, onCancel: () => { setPueiDialog(null); onCancel?.(); } });

  const openApp = useCallback((appId: AppId, opts?: { fileId?: string; webUrl?: string; title?: string; folderIconId?: string }) => {
    blip("click");
    triggerBusy();
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
    const snapLeft = x <= 4;
    const snapRight = x + w.w >= window.innerWidth - 4;
    if (snapLeft || snapRight) {
      return {
        ...w,
        maximized: false,
        x: snapLeft ? 0 : Math.floor(window.innerWidth / 2),
        y: 0,
        w: Math.floor(window.innerWidth / 2),
        h: Math.max(240, window.innerHeight - 48),
      };
    }
    return { ...w, x, y };
  }));
  const resizeWin = (id: string, w: number, h: number) =>
    setWindows((ws) => ws.map((x) => x.id === id ? { ...x, w, h } : x));

  // Touch long-press for right click
  const touchTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchMoved = useRef(false);
  const onTouchStart = (e: React.TouchEvent, items: any[]) => {
    if (e.touches.length !== 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchMoved.current = false;
    touchTimer.current = window.setTimeout(() => {
      if (touchStart.current && !touchMoved.current) {
        navigator.vibrate?.(30);
        setCtxMenu({ x: touchStart.current.x, y: touchStart.current.y, items });
      }
    }, 600);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      touchMoved.current = true;
      if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    }
  };
  const onTouchEnd = () => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    touchStart.current = null;
    touchMoved.current = false;
  };

  // Icon helpers
  const addIcon = (ic: DesktopIcon) => setIcons((cur) => {
    // Find a free grid slot so new icons don't overlap existing ones
    const { maxCol, maxRow } = getDesktopGridBounds();
    const occupied = new Set(cur.map((i, idx) => {
      if (i.col !== undefined && i.row !== undefined) return `${i.col},${i.row}`;
      const def = iconGridPos(idx);
      return `${def.col},${def.row}`;
    }));
    let freeSlot: { col: number; row: number } | undefined;
    outer: for (let col = 0; col <= maxCol; col++) {
      for (let row = 0; row <= maxRow; row++) {
        if (!occupied.has(`${col},${row}`)) { freeSlot = { col, row }; break outer; }
      }
    }
    return [...cur, freeSlot ? { ...ic, col: freeSlot.col, row: freeSlot.row } : ic];
  });
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
    { label: "Refresh", action: () => pushNotif("Desktop", "Refreshed.") },
    { sep: true },
    { label: "New Folder", action: () => createFolder(null) },
    { label: "➕ Add Shortcut to Desktop", action: () => setShowAddShortcut(true) },
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
    const isPinnable = (icon.appId === "web-app" && !!icon.webUrl) || (icon.appId !== "folder" && icon.appId !== "web-app" && (icon.appId in APP_TITLES));
    const pinKey = icon.appId === "web-app" ? (icon.webUrl ?? icon.appId) : icon.appId;
    const isPinned = pinnedApps.some((p) => (p.webUrl ?? p.appId) === pinKey);
    return [
      { label: "Open", action: openIt },
      { sep: true },
      ...(isPinnable ? [
        isPinned
          ? { label: "🖇️ Unpin from taskbar", action: () => unpinFromTaskbar(pinKey) }
          : { label: "🖇️ Pin to taskbar", action: () => pinToTaskbar({ appId: icon.appId, webUrl: icon.webUrl, label: icon.label }) },
      ] : []),
      { label: "Rename", action: () => {
        const n = prompt("Rename to:", icon.label);
        if (n) setIcons(icons.map((i) => i.id === icon.id ? { ...i, label: n } : i));
      }},
      { label: "🗑️ Delete shortcut", disabled: (["file-explorer","settings","recycle-bin"] as string[]).includes(icon.appId), action: () => {
        if ((["file-explorer","settings","recycle-bin"] as string[]).includes(icon.appId)) return;
        if (icon.appId === "folder") {
          const allFiles = loadFiles();
          saveFiles(allFiles.map((file) => file.folder === icon.id ? { ...file, folder: undefined } : file));
          setIcons((prev) => prev
            .map((i) => i.folderId === icon.id ? { ...i, folderId: undefined } : i)
            .filter((i) => i.id !== icon.id));
          return;
        }
        setIcons((prev) => prev.filter((i) => i.id !== icon.id));
      }},
      ...(icon.appId === "zip-viewer" && icon.fileId ? [
        { label: "📂 Extract here", action: () => {
          const zipFile = loadFiles().find((f) => f.id === icon.fileId);
          if (!zipFile) return;
          let fileIds: string[] = [];
          try { fileIds = JSON.parse(zipFile.content) as string[]; } catch {}
          const allFiles = loadFiles();
          const entries = fileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean);
          entries.forEach((f: any) => upsertFile({ ...f, folder: undefined, updatedAt: Date.now() }));
          blip("notify");
          pushNotif("📂 Extracted", `${entries.length} file${entries.length !== 1 ? "s" : ""} placed in Files.`);
        }},
        { label: "📁 Decompress to Folder", action: () => {
          const zipFile = loadFiles().find((f) => f.id === icon.fileId);
          if (!zipFile) return;
          let fileIds: string[] = [];
          try { fileIds = JSON.parse(zipFile.content) as string[]; } catch {}
          const folderName = icon.label.replace(/\.zip$/i, "");
          const folderId = `folder-${Date.now().toString(36)}`;
          // Create a folder icon in-place (replace the zip icon)
          setIcons((prev) => prev.map((i) => i.id === icon.id
            ? { ...i, label: folderName, appId: "folder" as const, fileId: undefined, iconEmoji: undefined, iconUrl: undefined }
            : i));
          // Move all zip contents into the new folder
          const allFiles = loadFiles();
          fileIds.forEach((id) => {
            const f = allFiles.find((x) => x.id === id);
            if (f) upsertFile({ ...f, folder: folderId, updatedAt: Date.now() });
          });
          // Rename the icon to use the new folderId as its id (update icon id to folderId)
          setIcons((prev) => prev.map((i) => i.id === icon.id ? { ...i, id: folderId } : i));
          blip("notify");
        }},
      ] : []),
      ...(icon.appId === "folder" ? [
        { label: "New shortcut here", action: () => {
          const u = prompt("Website URL to install into this folder:", "https://example.com");
          if (!u) return;
          const label = prompt("Name:", new URL(u.startsWith("http") ? u : "https://" + u).hostname) || "Web App";
          addIcon({ id: `web-${Date.now().toString(36)}`, label, appId: "web-app", webUrl: u.startsWith("http") ? u : "https://" + u, iconUrl: googleFaviconFor(u, 64), folderId: icon.id });
        }},
        { label: "📦 Compress to ZIP", action: () => {
          const folderFiles = loadFiles().filter((f) => f.folder === icon.id);
          if (folderFiles.length === 0) { pueiAlert("This folder is empty — nothing to compress."); return; }
          const zipName = `${icon.label.replace(/\.zip$/i, "")}.zip`;
          const zipId = `zip-${Date.now().toString(36)}`;
          const zipContent = JSON.stringify(folderFiles.map((f) => f.id));
          upsertFile({ id: zipId, name: zipName, type: "zip", content: zipContent, updatedAt: Date.now(), owner: currentUser });
          // Transform the folder icon into a zip icon in-place (same position, no new icon)
          setIcons((prev) => prev.map((i) => i.id === icon.id
            ? { ...i, label: zipName, appId: "zip-viewer" as const, fileId: zipId, iconEmoji: "📦", iconUrl: undefined }
            : i));
          blip("notify");
        }},
      ] : []),
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
          className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
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
            <div className="text-[10px] opacity-40 mt-4">Your device will restart several times. This might take a while.</div>
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
              className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
          </div>
          {pwOption === "have" && (
            <div>
              <label className="text-xs opacity-70">Password</label>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
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
                  const nu: User = { name, password: "", avatar: "🧑", color: "200", pueiNumber: pueiNumberFor(name), friends: [], noPassword: true, limitedMode: true };
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
                className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
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
                unmarkUserDeleted(name);
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
              const nu: User = { name, password: newAcc.password, avatar: "🧑", color: "200", pueiNumber: pueiNumberFor(name), friends: [] };
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
            className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
        </div>
        <div>
          <label className="text-xs opacity-70">Password (optional)</label>
          <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
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

  // ============ EOL WALL
  if ((systemVersion === "PueiOS 1" || systemVersion === "PueiOS 2" || systemVersion === "PueiOS 2+") && !eolDismissed) {
    return (
      <div className="fixed inset-0 flex flex-col text-white select-none"
        style={{ background: "#0a2a6e", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
        {/* Top bar */}
        <div className="flex items-center gap-4 px-10 py-5" style={{ background: "rgba(0,0,0,0.25)", borderBottom: "2px solid rgba(255,255,255,0.12)" }}>
          <PueiLogoSvg size={48} glow />
          <div>
            <div className="text-2xl font-bold tracking-wide">PueiOS</div>
            <div className="text-xs opacity-60 tracking-widest uppercase">System Notice</div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1">
          {/* Left accent stripe */}
          <div className="w-2 flex-shrink-0" style={{ background: "linear-gradient(180deg, #1e90ff, #0050c8)" }} />

          <div className="flex-1 flex flex-col justify-center px-16 py-12 max-w-3xl">
            <div className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#7ab8ff" }}>
              End of Support Notice
            </div>
            <h1 className="text-4xl font-bold mb-6 leading-tight" style={{ color: "#ffffff", textShadow: "0 2px 12px rgba(0,80,200,0.8)" }}>
              {systemVersion} is no longer<br />supported
            </h1>
            <div className="w-16 h-0.5 mb-6" style={{ background: "#1e90ff" }} />
            <p className="text-base mb-4 leading-relaxed" style={{ color: "rgba(200,220,255,0.9)" }}>
              As of <strong>{systemVersion === "PueiOS 1" ? "May 20, 2026" : "June 6th, 2026"}</strong>, {systemVersion} has reached its End of Life. PueiTeam no longer provides security updates, bug fixes, or technical support for this version.
            </p>
            <p className="text-sm mb-10" style={{ color: "rgba(160,190,255,0.7)" }}>
              Your device will not receive further updates. To continue using PueiOS safely, upgrade to <strong style={{ color: "#ffffff" }}>{systemVersion === "PueiOS 1" ? "PueiOS 2" : "PueiOS 3"}</strong>.
            </p>

            <div className="flex flex-col gap-3 max-w-sm">
              <button
                onClick={() => {
                  sessionStorage.removeItem("pueios-eol-dismissed");
                  if (systemVersion === "PueiOS 1") { startSystemUpgrade("PueiOS 2"); }
                  else { setSystemVersion("PueiOS 3"); setPhase("boot"); setBootProgress(0); }
                }}
                style={{
                  background: "linear-gradient(180deg, #2e7fd8 0%, #1455b0 100%)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                  borderRadius: 4, padding: "10px 24px", cursor: "pointer",
                  color: "#fff", fontWeight: 600, fontSize: 14, textAlign: "left",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                <span>Upgrade to {systemVersion === "PueiOS 1" ? "PueiOS 2" : "PueiOS 3"}</span>
                <span style={{ fontSize: 18, opacity: 0.8 }}>›</span>
              </button>
              <button
                onClick={() => { pueiConfirm("Wipe all accounts and files and reinstall?", () => { localStorage.clear(); location.reload(); }); }}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 4, padding: "8px 24px", cursor: "pointer",
                  color: "rgba(180,200,255,0.7)", fontSize: 13, textAlign: "left",
                }}>
                Wipe device and reinstall
              </button>
              <button
                onClick={() => { sessionStorage.setItem("pueios-eol-dismissed", "1"); setEolDismissed(true); setPhase("boot"); }}
                style={{
                  background: "transparent", border: "none",
                  padding: "6px 0", cursor: "pointer",
                  color: "rgba(140,170,255,0.45)", fontSize: 12, textAlign: "left",
                  textDecoration: "underline",
                }}>
                Ignore and continue with {systemVersion} (not recommended)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-10 py-3 text-xs flex items-center justify-between" style={{ background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(160,190,255,0.5)" }}>
          <span>© PueiTeam. {systemVersion} · End of Life June 6, 2026</span>
          <span>puei.system/eol</span>
        </div>
      </div>
    );
  }

  // ============ BOOT
  if (phase === "boot") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "radial-gradient(circle at 50% 40%, #0a1a2a, #000)" }}>
        <div className="boot-logo"><PueiLogoSvg size={120} glow /></div>
        <div className="text-3xl font-light text-white mt-4 tracking-widest">{systemVersion}</div>
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
    const anyUser = users[0];
    const tryReinstall = () => {
      if (!anyUser) { localStorage.clear(); location.reload(); return; }
      if (anyUser.password && recoveryPw !== anyUser.password) {
        setRecoveryErr("Wrong password. Reinstall denied.");
        return;
      }
      localStorage.clear(); location.reload();
    };
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, #2a0a0a, #4a1010)" }}>
        <div className="text-4xl mb-3">⚠ Startup Repair</div>
        <div className="opacity-70 mb-8 text-sm">PueiOS encountered an unexpected condition.</div>
        {reinstallStep === "menu" ? (
          <div className="space-y-2">
            <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => setPhase("login")}>Continue to login</button>
            <button className="aero-button rounded px-6 py-2 block w-64" style={{ color: "#fca5a5" }} onClick={() => setReinstallStep("confirm")}>Reinstall PueiOS…</button>
          </div>
        ) : (
          <div className="w-72 space-y-3">
            <div className="text-sm font-semibold text-red-300">⚠ This will wipe all accounts and files.</div>
            {anyUser?.password ? (
              <>
                <div className="text-xs opacity-70">Enter the password for <b>{anyUser.name}</b> to confirm:</div>
                <input type="password" autoFocus value={recoveryPw} onChange={(e) => { setRecoveryPw(e.target.value); setRecoveryErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && tryReinstall()}
                  placeholder="Account password"
                  style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,100,100,0.4)", borderRadius: 4, padding: "8px 12px", color: "#fff", outline: "none", boxSizing: "border-box" }} />
                {recoveryErr && <div style={{ color: "#f87171", fontSize: 12 }}>{recoveryErr}</div>}
              </>
            ) : (
              <div className="text-xs opacity-70">No account password is set. Anyone can reinstall.</div>
            )}
            <div className="flex gap-2 pt-1">
              <button className="aero-button rounded px-4 py-2 flex-1 text-sm" onClick={() => { setReinstallStep("menu"); setRecoveryPw(""); setRecoveryErr(""); }}>← Back</button>
              <button className="aero-button rounded px-4 py-2 flex-1 text-sm" style={{ color: "#fca5a5" }} onClick={tryReinstall}>Wipe & Reinstall</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === "upgrade") {
    const stages = [
      "Checking compatibility…",
      "Preparing upgrade files…",
      "Backing up apps, files, and settings…",
      "Installing new system components…",
      "Migrating user accounts and Pueio Numbers…",
      "Applying feature updates and drivers…",
      "Finalizing and cleaning up…",
    ];
    const stageIdx = Math.min(stages.length - 1, Math.floor(upgradeProgress / (100 / stages.length)));
    return (
      <div className="fixed inset-0 flex items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, oklch(0.25 0.12 270), oklch(0.1 0.08 280))" }}>
        <div className="text-center w-[28rem]">
          <div className="boot-logo inline-block mb-3"><PueiLogoSvg size={80} glow /></div>
          <h2 className="text-2xl font-light mb-1">Upgrading to {upgradeTarget}</h2>
          <p className="text-xs opacity-70 mb-4">Your apps, files, settings, conversations and Pueio Number are preserved. This can take several minutes.</p>
          <div className="text-sm opacity-80 mb-2">{stages[stageIdx]}</div>
          <div className="w-full h-2 rounded-full bg-cyan-900/50 overflow-hidden">
            <div className="loading-bar-inner h-full" style={{ width: `${upgradeProgress}%`, transition: "width 0.2s" }} />
          </div>
          <div className="text-[10px] opacity-60 mt-2">{Math.floor(upgradeProgress)}% · {systemVersion} → {upgradeTarget}</div>
          <div className="text-[10px] opacity-40 mt-6">Do not turn off your device. System may restart automatically.</div>
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
      if (remote.status === "ok") {
        if (remote.snapshot) {
          unmarkUserDeleted(name); // manual login always wins over deletion flag
          applySnapshot(remote.snapshot);
          const s = loadState();
          setUsers(s.users); setThemeState(s.theme); setIcons(s.icons);
        } else {
          // No snapshot but valid login — still drop Guest from local list
          setUsers((cur) => cur.filter((u) => u.name !== "Guest"));
        }
        enterDesktop(name); return;
      }
      // Cloud said not-found OR network error → fall back to local auth.
      const u = users.find((x) => x.name === name);
      if (!u) { blip("error"); setPwError(remote.status === "not-found" ? "No PueiOS account with that name" : "Unknown user"); return; }
      if ((u.password ?? "") === pwInput) { unmarkUserDeleted(name); setUsers((cur) => cur.filter((x) => x.name !== "Guest" || x.name === name)); enterDesktop(name); }
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
      const name = newAcc.name.trim();
      if (!name) { setPwError("Enter an account name"); return; }
      if (users.some((u) => u.name === name && u.name !== "Guest")) { setPwError("Name already exists locally"); return; }
      // Clear deleted flag so this fresh account isn't blocked by a previous deletion of the same name
      try {
        const deleted: string[] = JSON.parse(localStorage.getItem("pueios2-deleted-users-v1") || "[]");
        localStorage.setItem("pueios2-deleted-users-v1", JSON.stringify(deleted.filter((n) => n !== name)));
      } catch {}
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

    if (systemVersion === "PueiOS 1") {
      // PueiOS 1 — minimalistic flat login
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center select-none"
          style={{ background: "#e8e8e8", fontFamily: "Arial, sans-serif" }}>
          <div style={{ width: 320, background: "#f4f4f4", border: "1px solid #aaa", boxShadow: "2px 2px 8px rgba(0,0,0,0.2)", padding: 24 }}>
            <div className="flex flex-col items-center mb-6">
              <PueiLogoSvg size={52} />
              <div style={{ fontSize: 18, fontWeight: "bold", marginTop: 8, color: "#222" }}>PueiOS 1</div>
              <div style={{ fontSize: 11, color: "#333", marginTop: 2 }}>Welcome. Please sign in.</div>
            </div>
            {!creating ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 3 }}>Username</label>
                  <select value={loginUser} onChange={(e) => { setLoginUser(e.target.value); setPwInput(""); setPwError(""); }}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #aaa", background: "white", fontSize: 13, color: "#222" }}>
                    {users.length === 0 && <option value="">-- no accounts --</option>}
                    {users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 3 }}>Password</label>
                  <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
                    placeholder={activeUser?.password ? "Enter password" : "(no password)"}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #aaa", background: "white", fontSize: 13, color: "#222", boxSizing: "border-box" }} />
                  {pwError && <div style={{ color: "#c00", fontSize: 11, marginTop: 3 }}>{pwError}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setCreating(true); setPwError(""); }}
                    style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #999", background: "#ddd", cursor: "pointer", color: "#000" }}>New user</button>
                  <button onClick={trySignIn}
                    style={{ padding: "4px 14px", fontSize: 12, border: "1px solid #888", background: "#c8d8f0", cursor: "pointer", fontWeight: "bold", color: "#000" }}>Log On</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 3 }}>New username</label>
                  <input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #aaa", background: "white", fontSize: 13, color: "#222", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#444", display: "block", marginBottom: 3 }}>Password (optional)</label>
                  <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #aaa", background: "white", fontSize: 13, color: "#222", boxSizing: "border-box" }} />
                  {pwError && <div style={{ color: "#c00", fontSize: 11, marginTop: 3 }}>{pwError}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setCreating(false); setPwError(""); }}
                    style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #999", background: "#ddd", cursor: "pointer", color: "#000" }}>Cancel</button>
                  <button onClick={async () => { await createAccount(); if (!pwError) setCreating(false); }}
                    style={{ padding: "4px 14px", fontSize: 12, border: "1px solid #888", background: "#c8d8f0", cursor: "pointer", fontWeight: "bold", color: "#000" }}>Create</button>
                </div>
              </>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#444" }}>PueiOS 1.0 · pueios-2020-puei</div>
        </div>
      );
    }

    if (systemVersion === "PueiOS 3") {
      // PueiOS 3 — split-panel login
      const selectedU = users.find((u) => u.name === loginUser) ?? users[0];
      const p3Input: React.CSSProperties = {
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(100,150,220,0.35)",
        borderRadius: 3,
        padding: "10px 14px",
        fontSize: 14,
        color: "#dce8ff",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.35)",
      };
      const p3Btn: React.CSSProperties = {
        background: "linear-gradient(180deg, rgba(80,130,200,0.35) 0%, rgba(30,70,150,0.45) 100%)",
        border: "1px solid rgba(100,160,230,0.4)",
        borderRadius: 3,
        color: "#d8eaff",
        fontWeight: 600,
        fontSize: 13,
        padding: "10px 22px",
        cursor: "pointer",
        boxShadow: "0 1px 0 rgba(255,255,255,0.1)",
      };
      const p3BtnPrimary: React.CSSProperties = {
        ...p3Btn,
        background: "linear-gradient(180deg, rgba(60,120,220,0.7) 0%, rgba(20,60,160,0.85) 100%)",
        border: "1px solid rgba(80,140,240,0.6)",
        boxShadow: "0 2px 12px rgba(30,80,200,0.5), 0 1px 0 rgba(255,255,255,0.15)",
      };

      const renderForm = () => {
        if (creating) return (
          <>
            <div style={{ color: "#dce8ff", fontWeight: 600, fontSize: 18, marginBottom: 28 }}>Create account</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(200,200,255,0.5)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Name</div>
              <input value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} style={p3Input} autoFocus placeholder="Your name" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(200,200,255,0.5)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Password (optional)</div>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })} style={p3Input} placeholder="••••••••" />
            </div>
            <div style={{ fontSize: 11, color: "rgba(200,200,255,0.5)", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" }}>Avatar</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
              {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧙","🐱","🤖","👽","🎩","🌟"].map((a) => (
                <button key={a} onClick={() => setNewAcc({ ...newAcc, avatar: a })}
                  style={{ width: 36, height: 36, borderRadius: 3, fontSize: 18, border: newAcc.avatar === a ? "2px solid rgba(80,150,230,0.8)" : "1px solid rgba(255,255,255,0.12)", background: newAcc.avatar === a ? "rgba(50,100,210,0.3)" : "transparent", cursor: "pointer" }}>{a}</button>
              ))}
            </div>
            {pwError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{pwError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...p3Btn, flex: 1 }} onClick={() => { setCreating(false); setPwError(""); }}>Back</button>
              <button style={{ ...p3BtnPrimary, flex: 1 }} onClick={createAccount}>Create</button>
            </div>
          </>
        );
        if (switching) return (
          <>
            <div style={{ color: "#dce8ff", fontWeight: 600, fontSize: 18, marginBottom: 28 }}>Other account</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(200,200,255,0.5)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Username</div>
              <input value={switchName} onChange={(e) => { setSwitchName(e.target.value); setSwitchErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") switchToAccount(); }} autoFocus style={p3Input} placeholder="Username" />
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: "rgba(200,200,255,0.5)", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Password</div>
              <input type="password" value={switchPw} onChange={(e) => setSwitchPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") switchToAccount(); }} style={p3Input} placeholder="••••••••" />
            </div>
            {switchErr && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>{switchErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...p3Btn, flex: 1 }} onClick={() => { setSwitching(false); setSwitchErr(""); }}>Back</button>
              <button style={{ ...p3BtnPrimary, flex: 1 }} onClick={switchToAccount}>Sign in</button>
            </div>
          </>
        );
        if (!selectedU) return <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Select an account</div>;
        return (
          <>
            {/* User avatar + name */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: `linear-gradient(135deg, oklch(0.7 0.18 ${selectedU.color}), oklch(0.45 0.2 ${selectedU.color}))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, overflow: "hidden", marginBottom: 14, boxShadow: "0 0 0 3px rgba(80,140,230,0.5), 0 0 0 5px rgba(40,90,180,0.25), 0 8px 32px rgba(0,0,0,0.6)" }}>
                {selectedU.avatar.startsWith("data:") ? <img src={selectedU.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selectedU.avatar}
              </div>
              <div style={{ color: "#dce8ff", fontWeight: 600, fontSize: 22, letterSpacing: 0.3 }}>{selectedU.name}</div>
              <div style={{ color: "rgba(160,200,255,0.5)", fontSize: 12, marginTop: 3 }}>{locked ? "Screen locked" : "Welcome"}</div>
            </div>
            {/* User selector if multiple accounts */}
            {!locked && users.filter(u => typeof u.password !== "undefined").length > 1 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
                {users.filter(u => typeof u.password !== "undefined").map((u) => {
                  const isSel = loginUser === u.name;
                  return (
                    <button key={u.name} onClick={() => { setLoginUser(u.name); setPwError(""); setPwInput(""); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 6px", borderRadius: 2, border: isSel ? "1px solid rgba(80,140,230,0.6)" : "1px solid rgba(255,255,255,0.1)", background: isSel ? "rgba(50,100,200,0.3)" : "transparent", cursor: "pointer", color: "#dce8ff" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg, oklch(0.7 0.18 ${u.color}), oklch(0.45 0.2 ${u.color}))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, overflow: "hidden", flexShrink: 0 }}>
                        {u.avatar.startsWith("data:") ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.avatar}
                      </div>
                      <span style={{ fontSize: 12 }}>{u.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!users.filter(u => typeof u.password !== "undefined").length && (
              <input value={loginUser} onChange={(e) => { setLoginUser(e.target.value); setPwError(""); }} onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }} placeholder="Username" style={{ ...p3Input, marginBottom: 12 }} />
            )}
            <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
              placeholder={selectedU.password ? "Password" : "No password — press Sign In"} style={{ ...p3Input, marginBottom: pwError ? 10 : 20 }} autoFocus />
            {pwError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 14 }}>{pwError}</div>}
            <button style={{ ...p3BtnPrimary, width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, padding: "13px 0", fontSize: 16, marginBottom: 20 }} onClick={trySignIn}>
              Sign In →
            </button>
            <div style={{ display: "flex", justifyContent: "center", gap: 18 }}>
              <button style={{ background: "none", border: "none", color: "rgba(140,190,255,0.5)", cursor: "pointer", fontSize: 12 }} onClick={() => setPhase("recovery")}>Recovery</button>
              {!locked && <button style={{ background: "none", border: "none", color: "rgba(140,190,255,0.5)", cursor: "pointer", fontSize: 12 }} onClick={() => { setSwitching(true); setSwitchName(""); setSwitchPw(""); setSwitchErr(""); }}>Other account</button>}
              {!locked && <button style={{ background: "none", border: "none", color: "rgba(140,190,255,0.5)", cursor: "pointer", fontSize: 12 }} onClick={() => {
                const guestName = "Guest";
                const existing = users.find((u) => u.name === guestName);
                if (!existing) {
                  const nu: User = { name: guestName, password: "", avatar: "👤", color: "220", pueiNumber: "", friends: [], noPassword: true, limitedMode: true };
                  const next = [...users, nu];
                  setUsers(next);
                  saveState({ installed, systemVersion, theme, icons, users: next, lastUser: guestName, remember: false });
                }
                setLoginUser(guestName); setPwInput(""); enterDesktop(guestName);
              }}>Guest</button>}
            </div>
          </>
        );
      };

      return (
        <div className={`fixed inset-0 flex flex-col ${typeof theme.wallpaper === "string" && (theme.wallpaper.startsWith("data:") || theme.wallpaper.startsWith("custom:")) ? "" : `wallpaper-${theme.wallpaper}`}`} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", ...(typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("data:") ? { backgroundImage: `url(${theme.wallpaper})`, backgroundSize: "cover", backgroundPosition: "center" } : typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("custom:") ? (() => { try { const f = JSON.parse(localStorage.getItem("pueios2-files-v1") || "[]").find((x: any) => x.id === theme.wallpaper.slice(7)); return f?.content ? { backgroundImage: `url(${f.content})`, backgroundSize: "cover", backgroundPosition: "center" } : {}; } catch { return {}; } })() : {}), overflow: "hidden" }}>
          {/* Win8.1 clock — top center, large Segoe UI Light style */}
          <div style={{ position: "absolute", top: 32, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none", zIndex: 1 }}>
            <div style={{ color: "rgba(255,255,255,0.92)", fontSize: 64, fontWeight: 200, letterSpacing: -1, lineHeight: 1, fontFamily: "'Segoe UI Light', 'Segoe UI', system-ui, sans-serif", textShadow: "0 2px 16px rgba(0,0,0,0.4)" }}>
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, fontWeight: 300, marginTop: 4, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>

          {/* Centered sign-in card — flat, no border-radius, semi-transparent dark */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            <div style={{
              width: 360,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "none",
              borderRadius: 0,
              padding: "40px 36px 32px",
            }}>
              {renderForm()}
            </div>
          </div>

          {/* Win8 bottom bar: power button only, flat */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 8, zIndex: 1 }}>
            <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", alignItems: "center", gap: 5 }} onClick={() => { blip("shutdown"); setPhase("shutdown"); }}>⏻ Shut down</button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, oklch(0.3 0.1 220), oklch(0.15 0.08 250))" }}>
        <div className="absolute top-6 left-6 text-white/70 text-sm flex items-center gap-2">
          <PueiLogoSvg size={28} /> {locked ? "Locked" : `Welcome to ${systemVersion}`}
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
                className="w-full px-3 py-2 rounded text-sm outline-none mt-1 input-field" />
            </div>
            <div>
              <label className="text-xs opacity-70">Password</label>
              <input type="password" value={switchPw} onChange={(e) => setSwitchPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") switchToAccount(); }}
                className="w-full px-3 py-2 rounded text-sm outline-none mt-1 input-field" />
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
                <div key={u.name} className="relative group">
                  <button onClick={() => { setLoginUser(u.name); setPwError(""); setPwInput(""); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl w-full"
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
                    <div className="text-sm font-medium" style={{ color: "rgba(220,230,255,0.9)" }}>{u.name}</div>
                  </button>
                  {!locked && (
                    <RemoveAccountButton name={u.name} onConfirm={() => {
                      const next = users.filter(x => x.name !== u.name);
                      setUsers(next);
                      saveState({ installed, systemVersion, theme, icons, users: next, lastUser: "", remember: false });
                      if (loginUser === u.name) { setLoginUser(""); setPwInput(""); }
                    }} />
                  )}
                </div>
              ))}
              {!locked && (
                <button onClick={() => { setCreating(true); setPwError(""); }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl text-sm font-medium hover:underline"
                  style={{ color: "rgba(180,200,240,0.85)" }}>
                  + Add account
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
                    className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 mb-3">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center text-4xl overflow-hidden flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${activeUser?.color || "220"}), oklch(0.45 0.2 ${activeUser?.color || "220"}))`, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                    {activeUser?.avatar?.startsWith("data:")
                      ? <img src={activeUser.avatar} alt="" className="w-full h-full object-cover" />
                      : (activeUser?.avatar || "👤")}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "rgba(220,230,255,0.95)" }}>{loginUser || "Select an account"}</div>
                </div>
              )}
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
                placeholder={activeUser?.password ? "Password" : "Press Enter (no password)"}
                className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
              {pwError && <div className="text-red-400 text-xs mt-1">{pwError}</div>}
              <div className="flex gap-2 mt-3">
                <button className="aero-button rounded px-3 py-1 text-sm flex-1" onClick={trySignIn}>Sign in →</button>
                <button className="aero-button rounded px-3 py-1 text-sm" onClick={() => setPhase("recovery")}>Recovery</button>
              </div>
              {!locked && users.length > 0 && (
                <button className="text-xs underline mt-2 w-full text-center block"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() => { setSwitching(true); setSwitchName(""); setSwitchPw(""); setSwitchErr(""); }}>
                  Switch to a different account
                </button>
              )}
              {!locked && (
                <button className="text-xs mt-1 w-full text-center block opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: "rgba(200,215,255,0.8)" }}
                  onClick={() => {
                    const guestName = "Guest";
                    const existing = users.find((u) => u.name === guestName);
                    if (!existing) {
                      const nu: User = { name: guestName, password: "", avatar: "👤", color: "220", pueiNumber: "", friends: [], noPassword: true, limitedMode: true };
                      const next = [...users, nu];
                      setUsers(next);
                      saveState({ installed, systemVersion, theme, icons, users: next, lastUser: guestName, remember: false });
                    }
                    setLoginUser(guestName); setPwInput(""); enterDesktop(guestName);
                  }}>
                  Continue as Guest
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
                className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
            </div>
            <div>
              <label className="text-xs opacity-70">Password (optional)</label>
              <input type="password" value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm outline-none input-field" />
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
    if (typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("data:")) {
      return { backgroundImage: `url(${theme.wallpaper})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    if (typeof theme.wallpaper === "string" && theme.wallpaper.startsWith("custom:")) {
      const id = theme.wallpaper.slice(7);
      try {
        const files = JSON.parse(localStorage.getItem("pueios2-files-v1") || "[]");
        const f = files.find((x: any) => x.id === id);
        if (f?.content) return { backgroundImage: `url(${f.content})`, backgroundSize: "cover", backgroundPosition: "center" };
      } catch {}
    }
    return {};
  })();

  const currentUser$ = users.find(u => u.name === currentUser);
  const currentAvatar = currentUser$?.avatar;
  const currentColor = currentUser$?.color || "200";
  const avatarBg = `linear-gradient(135deg, oklch(0.72 0.18 ${currentColor}), oklch(0.48 0.2 ${currentColor}))`;
  const hasPueiOS3Upgrade = compareVersion("PueiOS 3", systemVersion) > 0;
  const isP3 = systemVersion === "PueiOS 3";
  const isP1 = systemVersion === "PueiOS 1";
  const aicon = (id: AppId, size: number, over?: string, url?: string) => appIcon(id, size, over, url, isP3, isP1);

  return (
    <div
      className={`fixed inset-0 ${isP3 ? "win7-aero" : ""} ${systemVersion === "PueiOS 1" ? "wallpaper-p1" : typeof theme.wallpaper === "string" && (theme.wallpaper.startsWith("custom:") || theme.wallpaper.startsWith("data:")) ? "" : `wallpaper-${theme.wallpaper}`}`}
      style={{ overflow: "hidden", ...(systemVersion === "PueiOS 1" ? {} : wallpaperStyle) }}
      onMouseDown={() => { setCtxMenu(null); setStartOpen(false); setShowCalendar(false); setSelectedIcon(null); setShowVolume(false); setShowNetwork(false); }}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, items: desktopCtx() }); }}
      onTouchStart={(e) => onTouchStart(e, desktopCtx())}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Desktop icons */}
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {desktopIcons.map((ic, idx) => {
          const iconPx = theme.iconSize === "small" ? 36 : theme.iconSize === "large" ? 64 : 52;
          const dbl = () => {
            if (ic.appId === "folder") openApp("folder", { folderIconId: ic.id, title: ic.label });
            else if (ic.appId === "web-app") openApp("web-app", { webUrl: ic.webUrl, title: ic.label });
            else openApp(ic.appId, { fileId: ic.fileId });
          };
          const pos = resolveIconPos(ic, idx);
          return (
            <div
              key={ic.id}
              className={`desktop-icon ${selectedIcon === ic.id ? "selected" : ""}`}
              style={{
                position: "absolute",
                left: pos.left,
                top: pos.top,
                width: GRID_W,
                height: GRID_H,
                pointerEvents: "all",
                cursor: "grab",
              }}
              onClick={(e) => {
                if (wasDragged.current) { wasDragged.current = false; return; }
                e.stopPropagation(); setSelectedIcon(ic.id);
              }}
              onDoubleClick={(e) => {
                if (wasDragged.current) { wasDragged.current = false; return; }
                e.stopPropagation(); dbl();
              }}
              onMouseDown={(e) => startIconDrag(e, ic, idx)}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setSelectedIcon(ic.id);
                setCtxMenu({ x: e.clientX, y: e.clientY, items: iconCtx(ic) });
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setSelectedIcon(ic.id);
                startIconTouchDrag(e, ic, idx);
                onTouchStart(e, iconCtx(ic));
              }}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="flex justify-center mb-1">{aicon(ic.appId, iconPx, ic.iconEmoji, ic.iconUrl)}</div>
              <div style={systemVersion === "PueiOS 1" ? { color: "#111", textShadow: "none" } : undefined}>{ic.label}</div>
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
            peek={aeroPeek}
            fullWindowTransparency={!!theme.transparency && !!theme.fullWindowTransparency}
            systemVersion={systemVersion}
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
              startUpgrade={(target) => startSystemUpgrade(target)}
              uninstallApp={(appId) => { markUninstalled(`app:${appId}`); setIcons((cur) => cur.filter((i) => !(i.appId === appId && !i.fileId && !i.webUrl))); }}
              uninstallWebApp={(url) => { markUninstalled(`web:${url}`); setIcons((cur) => cur.filter((i) => !(i.appId === "web-app" && i.webUrl === url))); }}
              addNativeIcon={(appId, label, icon) => { markInstalled(`app:${appId}`); setIcons((cur) => cur.some((i) => i.appId === appId && !i.fileId && !i.webUrl) ? cur : [...cur, { id: `native-${appId}`, label, appId, iconEmoji: icon }]); }}
              installWebApp={(label, url, iconUrl) => {
                markInstalled(`web:${url}`);
                const knownIcons: Record<string, string> = { "puei://films": "/puei-films-icon.svg", "puei://updates": "/puei-updater-icon.svg", "https://bezosmp.lovable.app": "/bezosmp-icon.svg" };
                const pueiEmojis: Record<string, string> = { "puei://social": "📣", "puei://board": "📌", "puei://search": "🔍", "puei://chat": "💬" };
                const knownUrl = knownIcons[url];
                const emoji = !knownUrl ? pueiEmojis[url] : undefined;
                addIcon({ id: `web-${Date.now().toString(36)}`, label, appId: "web-app", webUrl: url, iconEmoji: emoji, iconUrl: knownUrl ?? (emoji ? undefined : (iconUrl || googleFaviconFor(url, 64))) });
              }}
              installedKeys={installedKeys}
              openWebApp={(url, title) => openApp("web-app", { webUrl: url, title })}
              openFolder={(folderIconId, title) => openApp("folder", { folderIconId, title })}
              setUsers={setUsers}
              signOut={() => { blip("shutdown"); setWindows([]); setCurrentUser(""); setPhase("login"); setPwInput(""); }}
              lockScreen={() => { blip("click"); setLocked(true); setLoginUser(currentUser); setPwInput(""); }}
              deleteAccount={(name) => {
                markUserDeleted(name);
                const nextUsers = users.filter((u) => u.name !== name);
                setUsers(nextUsers);
                saveState({ installed, systemVersion, theme, icons, users: nextUsers, lastUser: "", remember: false });
                setWindows([]);
                setCurrentUser("");
                setLoginUser("");
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
            <div className="flex items-start gap-3">
              {n.kind === "update" ? (
                <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0 mt-0.5">
                  <defs>
                    <linearGradient id="updShieldBg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8ad54f" />
                      <stop offset="55%" stopColor="#37a232" />
                      <stop offset="100%" stopColor="#237b2a" />
                    </linearGradient>
                    <linearGradient id="updShieldRim" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#d9f7c9" />
                      <stop offset="100%" stopColor="#79c95e" />
                    </linearGradient>
                  </defs>
                  <path d="M32 4 L54 12 V28 C54 43 44 55 32 60 C20 55 10 43 10 28 V12 Z" fill="url(#updShieldBg)" stroke="url(#updShieldRim)" strokeWidth="3" />
                  <path d="M22 31 L29 39 L43 22" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div className="shrink-0 mt-0.5" style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }}>
                  {currentAvatar && (currentAvatar.startsWith("data:") || currentAvatar.startsWith("http"))
                    ? <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : currentAvatar
                      ? <span style={{ fontSize: 14, lineHeight: 1 }}>{currentAvatar}</span>
                      : <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{(currentUser[0] ?? "?").toUpperCase()}</span>
                  }
                </div>
              )}
              <div>
                <div className="font-semibold" style={{ color: n.kind === "update" ? "#103f9a" : undefined }}>{n.title}</div>
                <div className="text-xs opacity-80">{n.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mascot */}
      {showMascot && (
        <PueiMascot cursorPos={cursorPos} speak={mascotSpeak} onClick={() => setMascotSpeak(null)} />
      )}

      {/* Start menu */}
      {/* PueiOS 1 Start Menu — simple flat list */}
      {startOpen && systemVersion === "PueiOS 1" && (
        <div className="fixed bottom-9 left-0 z-[9000]"
          style={{ width: 200, background: "#d4d0c8", border: "2px outset #fff", boxShadow: "3px 3px 8px rgba(0,0,0,0.4)", fontFamily: "Arial, sans-serif", animation: "fade-scale 0.1s ease-out" }}
          onMouseDown={(e) => e.stopPropagation()}>
          {/* Header strip */}
          <div style={{ background: "linear-gradient(180deg,#000080,#0000c8)", padding: "8px 10px", color: "#fff", fontWeight: "bold", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <PueiLogoSvg size={28} />
            <div>
              <div style={{ fontSize: 14, fontWeight: "bold" }}>PueiOS 1</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{currentUser}</div>
            </div>
          </div>
          {/* App list */}
          {icons.map((ic) => (
            <button key={ic.id}
              onClick={(e) => { e.stopPropagation(); openApp(ic.appId, ic.fileId); setStartOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left", color: "#000" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#000080"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#000"; }}>
              {aicon(ic.appId, 20, ic.iconEmoji, ic.iconUrl)}
              <span>{ic.label}</span>
            </button>
          ))}
          <div style={{ borderTop: "1px solid #888", margin: "4px 0" }} />
          <button onClick={(e) => { e.stopPropagation(); setStartOpen(false); setPhase("login"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#000080"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#000"; }}>
            🔒 Log Off
          </button>
          <button onClick={(e) => { e.stopPropagation(); setPhase("shutdown"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#000080"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#000"; }}>
            ⏻ Shut Down
          </button>
        </div>
      )}
      {/* PueiOS 2/2+ Start Menu — Windows 7 Aero style */}
      {startOpen && (systemVersion === "PueiOS 2" || systemVersion === "PueiOS 2+") && (
        <div className="fixed bottom-12 left-2 z-[9000] flex overflow-hidden rounded-xl shadow-2xl"
          style={{ width: 480, maxHeight: "calc(100vh - 60px)", animation: "fade-scale 0.15s ease-out", background: "rgba(20,30,60,0.97)", backdropFilter: "blur(30px)", border: "1px solid rgba(100,140,255,0.25)", boxShadow: "0 -4px 40px rgba(0,0,80,0.7)" }}
          onMouseDown={(e) => e.stopPropagation()}>
          {/* Left panel — pinned/recent apps */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
            {/* User strip */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "linear-gradient(135deg,rgba(40,60,120,0.8),rgba(20,35,90,0.8))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl overflow-hidden flex-shrink-0 border-2 border-white/30"
                style={{ background: avatarBg }}>
                {currentAvatar?.startsWith("data:")
                  ? <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                  : (currentAvatar || "👤")}
              </div>
              <div>
                <div className="text-white font-bold text-sm">{currentUser}</div>
                <div className="text-white/50 text-xs">{systemVersion}</div>
              </div>
            </div>
            {/* App list */}
            <div className="overflow-y-auto flex-1 py-1">
              {[...new Set([
                ...icons.filter(i => !i.fileId && !i.webUrl && i.appId !== "folder" && i.appId !== "web-app" && i.appId !== "recycle-bin").map(i => i.appId),
                "settings" as const, "about" as const,
              ])].filter(id => id in APP_TITLES).map((id) => (
                <button key={id} onClick={() => { openApp(id); setStartOpen(false); }}
                  className="flex items-center gap-3 px-4 py-2 w-full text-sm text-left transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(80,120,255,0.25)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <span className="flex-shrink-0">{aicon(id, 24)}</span>
                  <span className="font-medium">{APP_TITLES[id]}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Right panel — quick links + power */}
          <div className="flex flex-col w-44" style={{ background: "rgba(10,18,50,0.7)" }}>
            <div className="flex-1 py-2">
              {([
                ["file-explorer", "Documents"],
                ["app-store", "App Store"],
                ["settings", "Control Panel"],
                ["about", "About PueiOS"],
              ] as [AppId, string][]).map(([id, label]) => (
                <button key={id} onClick={() => { openApp(id); setStartOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 w-full text-xs text-left transition-colors"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(80,120,255,0.2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <span>{aicon(id, 18)}</span><span>{label}</span>
                </button>
              ))}
            </div>
            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "0 12px" }} />
            {/* Power buttons */}
            <div className="flex flex-col gap-0.5 py-2">
              <button className="flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors"
                style={{ color: "rgba(255,255,255,0.6)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(80,120,255,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => { setLocked(true); setStartOpen(false); setPwInput(""); }}>🔒 Lock</button>
              <button className="flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors"
                style={{ color: "rgba(255,255,255,0.6)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(80,120,255,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => { setStartOpen(false); setPhase("login"); setPwInput(""); }}>🔄 Switch User</button>
              <button className="flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors"
                style={{ color: "rgba(255,120,100,0.8)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,50,30,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => { blip("shutdown"); setStartOpen(false); setPhase("shutdown"); setWindows([]); }}>⏻ Shut Down</button>
            </div>
          </div>
        </div>
      )}

      {/* PueiOS 3 — Windows 8.1 Metro Start Screen */}
      {startOpen && systemVersion === "PueiOS 3" && (
        <div className="fixed inset-0 z-[9000] flex flex-col"
          style={{ background: "color-mix(in oklch, var(--accent) 85%, oklch(0.08 0.02 250))", animation: "p3-start-in 0.18s cubic-bezier(0.0,0.0,0.2,1)" }}
          onMouseDown={(e) => e.stopPropagation()}>
          {/* Top user bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 20px 0", gap: 14, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, overflow: "hidden", flexShrink: 0 }}>
                {currentAvatar?.startsWith("data:") ? <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (currentAvatar || "👤")}
              </div>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 400, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>{currentUser}</span>
            </div>
            <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, fontFamily: "'Segoe UI', system-ui, sans-serif" }} onClick={() => { setLocked(true); setStartOpen(false); setPwInput(""); }}>Lock</button>
            <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 12, fontFamily: "'Segoe UI', system-ui, sans-serif" }} onClick={() => { setStartOpen(false); setPhase("login"); setPwInput(""); }}>Sign out</button>
            <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 16 }} title="Shut down" onClick={() => { blip("shutdown"); setStartOpen(false); setPhase("shutdown"); setWindows([]); }}>⏻</button>
          </div>
          {/* Metro tile grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 80px" }}>
            <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 300, letterSpacing: "0.05em", marginBottom: 18, fontFamily: "'Segoe UI', system-ui, sans-serif", textTransform: "uppercase" }}>Start</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6 }}>
              {[...new Set([
                ...icons.filter(i => !i.fileId && !i.webUrl && i.appId !== "recycle-bin").map(i => i.appId),
                "settings" as const, "about" as const,
              ])].filter(id => id in APP_TITLES).map((id, idx) => {
                // Give each tile a slightly different accent shade for Metro feel
                const hueShift = (idx * 23) % 60 - 30;
                return (
                  <button key={id} onClick={() => { openApp(id); setStartOpen(false); }}
                    style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: `color-mix(in oklch, var(--accent) 70%, oklch(0.4 0.18 calc(var(--accent-h, 220) + ${hueShift})))`, border: "none", cursor: "pointer", padding: 8, transition: "filter 0.1s", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.25)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = ""; }}>
                    {aicon(id, 36)}
                    <span style={{ color: "rgba(255,255,255,0.95)", fontSize: 9, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", lineHeight: 1.3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{APP_TITLES[id]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Bottom search bar — Win 8.1 charm style */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", padding: "0 32px", gap: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>🔍</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>Search</span>
            <button style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 18 }} onClick={() => setStartOpen(false)}>✕</button>
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
      {systemVersion === "PueiOS 1" ? (
        /* PueiOS 1 — flat minimalistic taskbar */
        <div className="fixed bottom-0 left-0 right-0 flex items-center z-[8000]"
          style={{ height: 36, background: "#c0c0c0", borderTop: "2px solid #fff", borderBottom: "1px solid #888", fontFamily: "Arial, sans-serif" }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: taskbarCtx() }); }}>
          {/* Start button */}
          <button onClick={(e) => { e.stopPropagation(); blip("click"); setStartOpen(!startOpen); setShowCalendar(false); }}
            title="Start"
            style={{ height: "100%", padding: "0 14px", background: startOpen ? "#a0a0a0" : "linear-gradient(180deg,#e0e0e0,#b0b0b0)", border: "none", borderRight: "1px solid #888", cursor: "pointer", fontWeight: "bold", fontSize: 13, color: "#000", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <PueiLogoSvg size={18} />
            Start
          </button>
          {/* Open windows */}
          <div style={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden", gap: 2, padding: "0 4px" }}>
            {windows.map((w) => {
              const isActive2 = w.z === Math.max(...windows.map((x) => x.z)) && !w.minimized;
              return (
                <button key={w.id}
                  onClick={(e) => { e.stopPropagation(); if (w.minimized) focusWin(w.id); else minWin(w.id); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation();
                    setCtxMenu({ x: e.clientX, y: e.clientY, items: [
                      { label: "Restore", action: () => focusWin(w.id) },
                      { label: "Minimize", action: () => minWin(w.id) },
                      { sep: true },
                      { label: "Close", action: () => closeWin(w.id) },
                    ]});
                  }}
                  style={{ height: 26, padding: "0 8px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, border: isActive2 ? "2px inset #888" : "2px outset #ddd", background: isActive2 ? "#b0b0b0" : "#d4d0c8", cursor: "pointer", maxWidth: 140, flexShrink: 0, overflow: "hidden" }}>
                  {aicon(w.appId, 14)}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{w.title}</span>
                </button>
              );
            })}
          </div>
          {/* Tray */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", borderLeft: "1px solid #888", height: "100%", flexShrink: 0, fontSize: 11 }}>
            <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowNetwork(!showNetwork); setShowVolume(false); }}>📶</span>
            <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); setShowNetwork(false); }}>🔊</span>
            <button onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); setStartOpen(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, fontFamily: "Arial, sans-serif", lineHeight: 1.4, textAlign: "center" }}>
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </button>
          </div>
        </div>
      ) : systemVersion === "PueiOS 3" ? (
        /* PueiOS 3 — Windows 8.1 flat dark taskbar */
        <div className="fixed bottom-0 left-0 right-0 flex items-stretch z-[8000]"
          style={{ height: 40, background: theme.taskbarColor ?? "rgba(0,0,0,0.87)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: taskbarCtx() }); }}>
          {/* Win8 square start button */}
          <button
            title="Start" onClick={(e) => { e.stopPropagation(); blip("click"); setStartOpen(!startOpen); setShowCalendar(false); }}
            style={{ width: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: startOpen ? "color-mix(in oklch, var(--accent) 90%, transparent)" : "transparent", border: "none", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={e => { if (!startOpen) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { if (!startOpen) e.currentTarget.style.background = "transparent"; }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="0" y="0" width="7" height="7" fill="rgba(255,255,255,0.9)"/>
              <rect x="9" y="0" width="7" height="7" fill="rgba(255,255,255,0.9)"/>
              <rect x="0" y="9" width="7" height="7" fill="rgba(255,255,255,0.9)"/>
              <rect x="9" y="9" width="7" height="7" fill="rgba(255,255,255,0.9)"/>
            </svg>
          </button>
          {/* Pinned + open apps */}
          <div className="flex items-center flex-1 overflow-hidden" style={{ gap: 1, padding: "0 2px" }}>
            {pinnedApps.map((p) => {
              const pKey = p.webUrl ?? p.appId;
              const hasWin = windows.some((w) => p.appId === "web-app" ? w.appId === "web-app" && w.webUrl === p.webUrl : w.appId === p.appId);
              const activeWin = windows.find((w) => (p.appId === "web-app" ? w.appId === "web-app" && w.webUrl === p.webUrl : w.appId === p.appId) && !w.minimized);
              const label = p.label ?? APP_TITLES[p.appId] ?? p.appId;
              const desktopIc = icons.find((i) => i.appId === p.appId && (p.appId !== "web-app" || i.webUrl === p.webUrl));
              const isActive = !!activeWin;
              return (
                <div key={pKey} style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); openPinned(p); }}
                    onMouseEnter={e => { blip("hover"); e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.18)" : hasWin ? "rgba(255,255,255,0.08)" : "transparent"; }}
                    title={label}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: [
                      { label: "Open", action: () => openPinned(p) },
                      { sep: true },
                      { label: "🖇️ Unpin from taskbar", action: () => unpinFromTaskbar(pKey) },
                    ]}); }}
                    style={{ width: 44, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: isActive ? "rgba(255,255,255,0.18)" : hasWin ? "rgba(255,255,255,0.08)" : "transparent", cursor: "pointer" }}>
                    {aicon(p.appId, 24, desktopIc?.iconEmoji, desktopIc?.iconUrl)}
                  </button>
                  {/* Win8 accent underline */}
                  {hasWin && <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: isActive ? 30 : 14, height: 3, background: "color-mix(in oklch, var(--accent) 100%, white)", transition: "width 0.15s" }} />}
                </div>
              );
            })}
            {pinnedApps.length > 0 && windows.filter(w => !pinnedApps.some(p => p.appId === "web-app" ? w.appId === "web-app" && w.webUrl === p.webUrl : w.appId === p.appId)).length > 0 && (
              <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)", margin: "0 2px", flexShrink: 0 }} />
            )}
            {windows.filter(w => !pinnedApps.some(p => p.appId === "web-app" ? w.appId === "web-app" && w.webUrl === p.webUrl : w.appId === p.appId)).map((w) => {
              const isActive2 = w.z === Math.max(...windows.map((x) => x.z)) && !w.minimized;
              return (
                <button key={w.id}
                  style={{ height: 40, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, border: "none", background: isActive2 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", fontSize: 11, maxWidth: 140, flexShrink: 0, cursor: "pointer", fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive2 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"; }}
                  onClick={(e) => { e.stopPropagation(); if (w.minimized) focusWin(w.id); else minWin(w.id); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation();
                    const wKey = w.appId === "web-app" ? (w.webUrl ?? w.appId) : w.appId;
                    const isWinPinned = pinnedApps.some((p) => (p.webUrl ?? p.appId) === wKey);
                    setCtxMenu({ x: e.clientX, y: e.clientY, items: [
                      { label: "Restore", action: () => focusWin(w.id) },
                      { label: "Minimize", action: () => minWin(w.id) },
                      { label: "Maximize", action: () => maxWin(w.id) },
                      { sep: true },
                      isWinPinned ? { label: "🖇️ Unpin from taskbar", action: () => unpinFromTaskbar(wKey) } : { label: "🖇️ Pin to taskbar", action: () => pinToTaskbar({ appId: w.appId, webUrl: w.webUrl, label: w.title }) },
                      { sep: true },
                      { label: "Close", action: () => closeWin(w.id) },
                    ]});}}>
                  {aicon(w.appId, 18, undefined, w.appId === "web-app" ? icons.find(i => i.appId === "web-app" && i.webUrl === w.webUrl)?.iconUrl : undefined)}
                  <span className="truncate" style={{ maxWidth: 90 }}>{w.title}</span>
                </button>
              );
            })}
          </div>
          {/* Win8 tray */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 4px", gap: 2, flexShrink: 0 }}>
            <span title="Network" style={{ cursor: "pointer", fontSize: 13, opacity: 0.6, padding: "0 4px" }}
              onClick={(e) => { e.stopPropagation(); setShowNetwork(!showNetwork); setShowVolume(false); }}>📶</span>
            <span title="Sound" style={{ cursor: "pointer", fontSize: 13, opacity: 0.6, padding: "0 4px" }}
              onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); setShowNetwork(false); blip("notify"); }}>🔊</span>
            <button onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); setStartOpen(false); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 10, lineHeight: 1.45, cursor: "pointer", padding: "0 8px", textAlign: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ opacity: 0.55 }}>{now.toLocaleDateString()}</span>
            </button>
          </div>
          <div title="Show Desktop" style={{ width: 5, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            onClick={(e) => { e.stopPropagation(); windows.forEach((w) => minWin(w.id)); }} />
        </div>
      ) : (
        /* PueiOS 2 / 2+ — classic taskbar */
        <div className="taskbar-bg fixed bottom-0 left-0 right-0 h-12 flex items-center px-1 gap-1 z-[8000]"
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: taskbarCtx() }); }}>
          <button className="aero-start-orb w-10 h-10 rounded-full flex items-center justify-center mx-1 overflow-hidden"
            title="Start"
            onClick={(e) => { e.stopPropagation(); blip("click"); setStartOpen(!startOpen); setShowCalendar(false); }}>
            <PueiLogoSvg size={26} bigEyes />
          </button>
          {pinnedApps.map((p) => {
            const pKey2 = p.webUrl ?? p.appId;
            const label2 = p.label ?? APP_TITLES[p.appId] ?? p.appId;
            return (
              <button key={pKey2} onClick={(e) => { e.stopPropagation(); openPinned(p); }}
                onMouseEnter={() => blip("hover")}
                title={label2}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, items: [
                  { label: "Open", action: () => openPinned(p) },
                  { sep: true },
                  { label: "🖇️ Unpin from taskbar", action: () => unpinFromTaskbar(pKey2) },
                ]}); }}
                className="taskbar-item w-9 h-9 rounded flex items-center justify-center text-lg">
                {aicon(p.appId, 22)}
              </button>
            );
          })}
          <div className="w-px h-7 bg-white/20 mx-1" />
          {windows.map((w) => (
            <button key={w.id}
              className={`taskbar-item h-9 px-3 rounded flex items-center gap-2 text-xs ${w.z === Math.max(...windows.map((x)=>x.z)) && !w.minimized ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (w.minimized) focusWin(w.id); else minWin(w.id); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation();
                const wKey2 = w.appId === "web-app" ? (w.webUrl ?? w.appId) : w.appId;
                const isWPinned = pinnedApps.some((p) => (p.webUrl ?? p.appId) === wKey2);
                setCtxMenu({ x: e.clientX, y: e.clientY, items: [
                { label: "Restore", action: () => focusWin(w.id) },
                { label: "Minimize", action: () => minWin(w.id) },
                { label: "Maximize", action: () => maxWin(w.id) },
                { sep: true },
                isWPinned ? { label: "🖇️ Unpin from taskbar", action: () => unpinFromTaskbar(wKey2) } : { label: "🖇️ Pin to taskbar", action: () => pinToTaskbar({ appId: w.appId, webUrl: w.webUrl, label: w.title }) },
                { sep: true },
                { label: "Close", action: () => closeWin(w.id) },
              ]});}}>
              {aicon(w.appId, 18)}
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
            onMouseEnter={() => setAeroPeek(true)}
            onMouseLeave={() => setAeroPeek(false)}
            onClick={(e) => { e.stopPropagation(); setWindows(windows.map((w) => ({ ...w, minimized: true }))); }} />
        </div>
      )}

      {/* Volume popup */}
      {showVolume && (
        <div className="fixed bottom-14 right-24 aero-glass rounded-xl p-4 z-[9000] w-52" onMouseDown={(e) => e.stopPropagation()}>
          <div className="font-semibold text-sm mb-3">🔊 Volume</div>
          <input type="range" min={0} max={100} value={volume}
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); try { localStorage.setItem("pueios2-volume", String(v)); } catch {} }}
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

      {touchDot.visible && theme.touchCursor !== false && (
        <div style={{
          position: "fixed", left: touchDot.x, top: touchDot.y,
          width: 28, height: 28, pointerEvents: "none",
          zIndex: 999999,
          transform: "translate(-2px, -2px)",
          willChange: "transform",
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" style={{ display: "block", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }}>
            <path d="M3 2 L3 18 L7 14 L10.5 21 L12.5 20 L9 13 L15 13 Z" fill="white" stroke={theme.cursorColor ?? "#888"} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      {/* In-app dialog — replaces browser alert()/confirm() */}
      {pueiDialog && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}
          onMouseDown={() => { if (!pueiDialog.onCancel) { pueiDialog.onOk(); } }}>
          <div className="aero-glass rounded-xl p-5 w-80 shadow-2xl" style={{ animation: "fade-scale 0.15s ease-out" }}
            onMouseDown={e => e.stopPropagation()}>
            <div className="text-sm leading-relaxed mb-5 whitespace-pre-wrap">{pueiDialog.msg}</div>
            <div className="flex justify-end gap-2">
              {pueiDialog.onCancel && (
                <button className="aero-button rounded px-4 py-1.5 text-sm" onClick={pueiDialog.onCancel}>Cancel</button>
              )}
              <button className="aero-button rounded px-4 py-1.5 text-sm font-semibold" onClick={pueiDialog.onOk}>OK</button>
            </div>
          </div>
        </div>
      )}

      {showAddShortcut && (() => {
        const ALL_SHORTCUTS: { id: string; label: string; icon: string; kind: "native"; appId: AppId }[] | { id: string; label: string; icon: string; kind: "web"; url: string }[] = [
          ...(([
            ["puei-paint","Puei Paint","🎨"], ["puei-board","PueiBoard","📌"],
            ["pueinet","PueiWeb","🌐"], ["puei-cloud-chat","PueiCloud Chat","💬"],
            ["puei-studio","Puei Studio","🪽"], ["file-explorer","Files","🗂️"],
            ["settings","Settings","⚙️"], ["about","About PueiOS","ℹ️"],
            ["notepad","Notepad","📝"], ["calculator","Calculator","🧮"],
            ["app-store","App Store","🛍️"], ["puei-social","PueiSocial","📣"],
            ["recycle-bin","Recycle Bin","🗑️"], ["chess","Chess","♟️"],
            ["puei-mansion","Puei Mansion","👻"],
          ] as [AppId, string, string][]).map(([appId, label, icon]) => ({ id: `native-${appId}`, label, icon, kind: "native" as const, appId }))),
          ...(([
            ["puei://films","Puei Videos","/puei-films-icon.svg"],
            ["puei://updates","Puei Updater","/puei-updater-icon.svg"],
            ["https://bezosmp.lovable.app","BezosMP","/bezosmp-icon.svg"],
          ] as [string, string, string][]).map(([url, label, icon]) => ({ id: `web-${url}`, label, icon, kind: "web" as const, url }))),
        ] as any[];

        const isOnDesktop = (s: any) =>
          s.kind === "native"
            ? icons.some(i => i.appId === s.appId && !i.fileId && !i.webUrl)
            : icons.some(i => i.appId === "web-app" && i.webUrl === s.url);

        const addShortcut = (s: any) => {
          if (isOnDesktop(s)) return;
          const isImgUrl = typeof s.icon === "string" && (s.icon.startsWith("/") || s.icon.startsWith("http") || s.icon.startsWith("data:"));
          if (s.kind === "native") {
            addIcon({ id: `${s.id}-${Date.now().toString(36)}`, label: s.label, appId: s.appId, iconEmoji: isImgUrl ? undefined : s.icon, iconUrl: isImgUrl ? s.icon : undefined });
          } else {
            addIcon({ id: `web-${Date.now().toString(36)}`, label: s.label, appId: "web-app", webUrl: s.url, iconEmoji: isImgUrl ? undefined : s.icon, iconUrl: isImgUrl ? s.icon : undefined });
          }
          blip("notify");
          setShowAddShortcut(false);
        };

        return (
          <div className="fixed inset-0 z-[99998] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
            onMouseDown={() => setShowAddShortcut(false)}>
            <div className="aero-glass rounded-2xl p-5 w-96 max-h-[70vh] flex flex-col"
              onMouseDown={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold text-base">➕ Add Shortcut to Desktop</div>
                <button onClick={() => setShowAddShortcut(false)} className="opacity-60 hover:opacity-100 text-sm">✕</button>
              </div>
              <div className="overflow-auto flex-1 space-y-1">
                {ALL_SHORTCUTS.map((s: any) => {
                  const on = isOnDesktop(s);
                  return (
                    <button key={s.id}
                      onClick={() => addShortcut(s)}
                      disabled={on}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all"
                      style={{ opacity: on ? 0.4 : 1, background: on ? "rgba(80,200,120,0.12)" : "rgba(255,255,255,0.08)" }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.22)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = on ? "rgba(80,200,120,0.12)" : "rgba(255,255,255,0.08)"; }}>
                      {(s.icon.startsWith("/") || s.icon.startsWith("http") || s.icon.startsWith("data:"))
                        ? <img src={s.icon} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }} />
                        : <span className="text-2xl">{s.icon}</span>}
                      <span className="flex-1">{s.label}</span>
                      {on ? <span className="text-xs text-green-400">✔ On desktop</span> : <span className="text-xs opacity-50">Add</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
