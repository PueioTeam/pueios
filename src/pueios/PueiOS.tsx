import { useCallback, useEffect, useRef, useState } from "react";
import {
  blip, defaultIcons, defaultTheme, DEFAULT_USERS, iconGridPos, ICONS_PER_COL,
  loadState, saveState, type AppId, type DesktopIcon, type User,
  type Theme, type WallpaperId, type WindowState,
} from "./state";
import { AppWindow, ContextMenu, appIcon } from "./Window";
import { AppRenderer } from "./apps";
import { PueiMascot, PueiLogoSvg } from "./Mascot";

type Phase = "boot" | "login" | "desktop" | "shutdown" | "recovery";

const APP_TITLES: Record<AppId, string> = {
  "puei-paint": "Puei Paint 2",
  "pueinet": "PueiNet",
  "puei-messenger": "Puei Messenger",
  "file-explorer": "Computer",
  "settings": "Settings",
  "about": "About PueiOS",
  "notepad": "Notepad",
  "calculator": "Calculator",
};
const APP_SIZES: Partial<Record<AppId, { w: number; h: number }>> = {
  "calculator": { w: 280, h: 380 },
  "notepad": { w: 520, h: 420 },
  "about": { w: 460, h: 420 },
  "settings": { w: 720, h: 500 },
  "puei-messenger": { w: 600, h: 460 },
  "pueinet": { w: 800, h: 560 },
  "puei-paint": { w: 820, h: 560 },
  "file-explorer": { w: 720, h: 480 },
};

const GRID_W = 96;
const GRID_H = 92;

export function PueiOS() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [bootProgress, setBootProgress] = useState(0);
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [icons, setIcons] = useState<DesktopIcon[]>(defaultIcons);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState<string>("Pueian Rosos");
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
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [locked, setLocked] = useState(false);
  const [loginUser, setLoginUser] = useState("Pueian Rosos");
  const [creating, setCreating] = useState(false);
  const [newAcc, setNewAcc] = useState({ name: "", password: "", avatar: "🧑", color: "200" });

  // Load persisted state
  useEffect(() => {
    const s = loadState();
    setThemeState(s.theme);
    setIcons(s.icons);
    setUsers(s.users);
    if (s.lastUser && s.remember) {
      setLoginUser(s.lastUser);
      setRemember(true);
    } else if (s.users[0]) {
      setLoginUser(s.users[0].name);
    }
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
        setTimeout(() => setPhase("login"), 400);
      }
    }, 120);
    return () => clearInterval(t);
  }, [phase]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-h", String(theme.accentH));
    root.classList.toggle("dark", theme.dark);
    if (!theme.transparency) {
      root.style.setProperty("--glass", "oklch(0.96 0.02 220 / 1)");
      root.style.setProperty("--glass-strong", "oklch(0.98 0.01 220 / 1)");
    } else {
      root.style.removeProperty("--glass");
      root.style.removeProperty("--glass-strong");
    }
    saveState({ theme, icons, users, lastUser: loginUser, remember });
  }, [theme, icons, users, loginUser, remember]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(t);
  }, []);

  // Cursor track
  useEffect(() => {
    const fn = (e: PointerEvent) => setCursorPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", fn);
    return () => window.removeEventListener("pointermove", fn);
  }, []);

  // Welcome notification once on desktop
  const welcomedRef = useRef(false);
  useEffect(() => {
    if (phase === "desktop" && !welcomedRef.current) {
      welcomedRef.current = true;
      setTimeout(() => {
        pushNotif("Welcome to PueiOS 2", `Signed in as ${currentUser}. Try right-clicking the desktop!`);
        setMascotSpeak("Hi! I'm Puei. Click me for quick tips ✦");
        setTimeout(() => setMascotSpeak(null), 5000);
      }, 800);
    }
  }, [phase, currentUser]);

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

  const openApp = useCallback((appId: AppId, fileId?: string) => {
    blip("click");
    const existing = windows.find((w) => w.appId === appId && w.fileId === fileId);
    if (existing) { focusWin(existing.id); return; }
    const size = APP_SIZES[appId] || { w: 560, h: 420 };
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 80 + (windows.length % 6) * 32;
    const y = 60 + (windows.length % 6) * 28;
    setZCounter((z) => z + 1);
    setWindows((ws) => [...ws, {
      id, appId, title: APP_TITLES[appId], x, y, w: size.w, h: size.h,
      z: zCounter + 1, minimized: false, maximized: false, fileId,
    }]);
  }, [windows, zCounter, focusWin]);

  const closeWin = (id: string) => setWindows((ws) => ws.filter((w) => w.id !== id));
  const minWin = (id: string) => setWindows((ws) => ws.map((w) => w.id === id ? { ...w, minimized: true } : w));
  const maxWin = (id: string) => setWindows((ws) => ws.map((w) => {
    if (w.id !== id) return w;
    if (w.maximized) return { ...w, maximized: false, ...(w.prev || {}) };
    return { ...w, maximized: true, prev: { x: w.x, y: w.y, w: w.w, h: w.h } };
  }));

  // Snap to edges
  const moveWin = (id: string, x: number, y: number) => {
    setWindows((ws) => ws.map((w) => {
      if (w.id !== id) return w;
      let nx = x, ny = y;
      if (y <= 0) {
        return { ...w, maximized: true, prev: { x: w.x, y: w.y, w: w.w, h: w.h } };
      }
      return { ...w, x: nx, y: ny };
    }));
  };
  const resizeWin = (id: string, w: number, h: number) =>
    setWindows((ws) => ws.map((x) => x.id === id ? { ...x, w, h } : x));

  const autoArrange = () => {
    setIcons([...icons]);
  };

  // Touchscreen long-press for right click
  const touchTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent, items: any[]) => {
    if (e.touches.length !== 1) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchTimer.current = window.setTimeout(() => {
      if (touchStart.current) {
        setCtxMenu({ x: touchStart.current.x, y: touchStart.current.y, items });
      }
    }, 600);
  };
  const onTouchEnd = () => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    touchStart.current = null;
  };

  const desktopCtx = (): any[] => [
    { label: "View ▸ Large icons" },
    { label: "Sort by ▸ Name", action: () => setIcons([...icons].sort((a, b) => a.label.localeCompare(b.label))) },
    { label: "Refresh", action: () => pushNotif("Desktop", "Refreshed.") },
    { sep: true },
    { label: "Paste", disabled: true },
    { label: "New Folder", action: () => pushNotif("Hmm", "Folders coming in PueiOS 3.") },
    { sep: true },
    { label: "Auto arrange icons", action: autoArrange },
    { sep: true },
    { label: "Personalize", action: () => openApp("settings") },
    { label: "Properties", action: () => openApp("about") },
  ];

  const iconCtx = (icon: DesktopIcon): any[] => [
    { label: "Open", action: () => openApp(icon.appId, icon.fileId) },
    { label: "Open With ▸ PueiNet", disabled: true },
    { sep: true },
    { label: "Cut", disabled: true },
    { label: "Copy", disabled: true },
    { label: "Rename", action: () => {
      const n = prompt("Rename to:", icon.label);
      if (n) setIcons(icons.map((i) => i.id === icon.id ? { ...i, label: n } : i));
    }},
    { label: "Delete", action: () => setIcons(icons.filter((i) => i.id !== icon.id)) },
    { sep: true },
    { label: "Send To ▸ Desktop", disabled: true },
    { label: "Properties", action: () => pushNotif(icon.label, `Type: PueiOS Application Shortcut`) },
  ];

  const taskbarCtx = (): any[] => [
    { label: "Task Manager", action: () => pushNotif("Task Manager", `${windows.length} window(s) open`) },
    { label: "Lock Taskbar", disabled: true },
    { label: "Show Desktop", action: () => setWindows(windows.map((w) => ({ ...w, minimized: true }))) },
    { sep: true },
    { label: "Properties", action: () => openApp("settings") },
  ];

  // Boot screen
  if (phase === "boot") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "radial-gradient(circle at 50% 40%, #0a1a2a, #000)" }}>
        <div className="boot-logo"><PueiLogoSvg size={120} glow /></div>
        <div className="text-3xl font-light text-white mt-4 tracking-widest">PueiOS 2</div>
        <div className="text-xs text-cyan-300/60 mt-1">Ultimate Edition · Build 2009.1138</div>
        <div className="mt-10 w-80 h-1.5 rounded-full bg-cyan-900/50 overflow-hidden">
          <div className="loading-bar-inner h-full" style={{ width: `${bootProgress}%`, transition: "width 0.12s" }} />
        </div>
        <div className="text-[10px] text-cyan-200/40 mt-3">Starting up…</div>
        <div className="fixed bottom-4 right-4 text-[10px] text-cyan-200/30">For evaluation purposes only · Pre-release</div>
      </div>
    );
  }

  // Shutdown
  if (phase === "shutdown") {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="text-center text-cyan-200">
          <div className="boot-logo inline-block"><PueiLogoSvg size={80} glow /></div>
          <div className="mt-4 text-xl">Shutting down…</div>
          <button className="mt-8 aero-button rounded px-4 py-2" onClick={() => { setPhase("boot"); setBootProgress(0); }}>
            Restart
          </button>
        </div>
      </div>
    );
  }

  // Recovery
  if (phase === "recovery") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center text-white"
        style={{ background: "linear-gradient(135deg, #2a0a0a, #4a1010)" }}>
        <div className="text-4xl mb-3">⚠ Startup Repair</div>
        <div className="opacity-70 mb-8 text-sm">PueiOS encountered an unexpected condition.</div>
        <div className="space-y-2">
          <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => { setPhase("boot"); setBootProgress(0); }}>Attempt repair & restart</button>
          <button className="aero-button rounded px-6 py-2 block w-64" onClick={() => setPhase("login")}>Continue to login</button>
        </div>
      </div>
    );
  }

  // Login
  if (phase === "login" || locked) {
    const trySignIn = () => {
      const u = users.find((x) => x.name === loginUser);
      if (!u) { blip("error"); setPwError("Unknown user"); return; }
      if (u.password === pwInput) {
        blip("start");
        setCurrentUser(loginUser); setPwInput(""); setPwError("");
        setLocked(false); setPhase("desktop");
      } else { blip("error"); setPwError("Wrong password"); }
    };
    const createAccount = () => {
      const name = newAcc.name.trim();
      if (!name) { setPwError("Pick a name"); return; }
      if (users.some((u) => u.name === name)) { setPwError("Name already exists"); return; }
      const nu: User = { name, password: newAcc.password, avatar: newAcc.avatar || "🧑", color: newAcc.color || "200" };
      const next = [...users, nu];
      setUsers(next);
      setLoginUser(name);
      setCreating(false);
      setNewAcc({ name: "", password: "", avatar: "🧑", color: "200" });
      setPwError("");
      blip("notify");
    };
    const activeUser = users.find((u) => u.name === loginUser);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, oklch(0.3 0.1 220), oklch(0.15 0.08 250))" }}>
        <div className="absolute top-6 left-6 text-white/70 text-sm flex items-center gap-2">
          <PueiLogoSvg size={28} /> {locked ? "Locked" : "Welcome to PueiOS 2"}
        </div>
        <div className="absolute top-6 right-6 text-white/70 text-sm">{now.toLocaleString()}</div>

        {!creating ? (
          <>
            <div className="grid gap-6 mb-8" style={{ gridTemplateColumns: `repeat(${Math.min(users.length, 4)}, minmax(0, 1fr))` }}>
              {users.map((u) => (
                <button key={u.name} onClick={() => { setLoginUser(u.name); setPwError(""); setPwInput(""); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl"
                  style={{
                    background: loginUser === u.name ? "rgba(255,255,255,0.15)" : "transparent",
                    outline: loginUser === u.name ? "2px solid white" : "none",
                  }}>
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center text-5xl"
                    style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${u.color}), oklch(0.45 0.2 ${u.color}))`, boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
                    {u.avatar}
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
              <div className="text-sm font-medium mb-2">{loginUser}</div>
              <input type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") trySignIn(); }}
                placeholder={activeUser?.password ? "Password" : "Press Enter (no password)"}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: "white", color: "#111" }} />
              {pwError && <div className="text-red-400 text-xs mt-1">{pwError}</div>}
              <label className="flex items-center gap-2 text-xs mt-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <div className="flex gap-2 mt-3">
                <button className="aero-button rounded px-3 py-1 text-sm flex-1" onClick={trySignIn}>Sign in →</button>
                <button className="aero-button rounded px-3 py-1 text-sm" onClick={() => setPhase("recovery")}>Recovery</button>
              </div>
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
              <div className="flex flex-wrap gap-2 mt-1">
                {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧙","🐱","🤖","👽","🎩","🌟"].map((a) => (
                  <button key={a} onClick={() => setNewAcc({ ...newAcc, avatar: a })}
                    className="w-9 h-9 rounded text-xl flex items-center justify-center"
                    style={{ background: newAcc.avatar === a ? "var(--gradient-aero)" : "rgba(255,255,255,0.5)" }}>
                    {a}
                  </button>
                ))}
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
        <div className="fixed bottom-4 right-4 text-[10px] text-white/40">PueiOS 2 Ultimate · Pre-release watermark</div>
      </div>
    );
  }

  // DESKTOP
  return (
    <div
      className={`fixed inset-0 wallpaper-${theme.wallpaper}`}
      style={{ overflow: "hidden" }}
      onMouseDown={() => { setCtxMenu(null); setStartOpen(false); setShowCalendar(false); setSelectedIcon(null); }}
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY, items: desktopCtx() });
      }}
      onTouchStart={(e) => onTouchStart(e, desktopCtx())}
      onTouchEnd={onTouchEnd}
    >
      {/* Desktop icons */}
      <div className="absolute top-3 left-3 grid" style={{ gridTemplateColumns: `repeat(12, ${GRID_W}px)`, gridAutoRows: `${GRID_H}px`, gap: 2 }}>
        {icons.map((ic, idx) => {
          const { col, row } = iconGridPos(idx);
          return (
            <div
              key={ic.id}
              className={`desktop-icon ${selectedIcon === ic.id ? "selected" : ""}`}
              style={{ gridColumn: col + 1, gridRow: row + 1, height: GRID_H }}
              onClick={(e) => { e.stopPropagation(); setSelectedIcon(ic.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); openApp(ic.appId, ic.fileId); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setSelectedIcon(ic.id);
                setCtxMenu({ x: e.clientX, y: e.clientY, items: iconCtx(ic) });
              }}
              onTouchStart={(e) => { e.stopPropagation(); setSelectedIcon(ic.id); onTouchStart(e, iconCtx(ic)); }}
              onTouchEnd={onTouchEnd}
            >
              <div className="flex justify-center mb-1">{appIcon(ic.appId, 44)}</div>
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
              openApp={openApp} wallpaper={theme.wallpaper} setWallpaper={setWallpaper}
              currentUser={currentUser} />
          </AppWindow>
        );
      })}

      {/* Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9500] space-y-2">
        {notifs.map((n) => (
          <div key={n.id} className="aero-glass rounded-lg px-4 py-2 min-w-[260px] text-sm"
            style={{ animation: "fade-scale 0.2s ease-out" }}>
            <div className="font-semibold">{n.title}</div>
            <div className="text-xs opacity-80">{n.body}</div>
          </div>
        ))}
      </div>

      {/* Mascot */}
      {showMascot && (
        <PueiMascot cursorPos={cursorPos} speak={mascotSpeak}
          onClick={() => {
            const tips = [
              "Tip: Drag a window to the top to maximize!",
              "Long-press on touch = right click.",
              "Try changing the accent hue in Settings → Personalize.",
              "PueiNet is the only safe browser. Probably.",
              "Did you know? PueiOS dreams in cyan.",
            ];
            const t = tips[Math.floor(Math.random() * tips.length)];
            setMascotSpeak(t);
            setTimeout(() => setMascotSpeak(null), 4000);
          }} />
      )}

      {/* Start menu */}
      {startOpen && (
        <div className="fixed bottom-12 left-2 aero-glass rounded-xl w-[420px] z-[9000] overflow-hidden"
          style={{ animation: "fade-scale 0.18s ease-out" }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="aero-titlebar px-4 py-2 flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
              style={{ background: "var(--gradient-aero)" }}>
              {DEFAULT_USERS.find(u => u.name === currentUser)?.avatar || "👤"}
            </div>
            <div className="font-semibold">{currentUser}</div>
          </div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {(["file-explorer", "pueinet", "puei-messenger", "puei-paint", "notepad", "calculator", "settings", "about"] as AppId[]).map((id) => (
              <button key={id} onClick={() => { openApp(id); setStartOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/40 text-sm text-left">
                {appIcon(id, 26)}
                <span>{APP_TITLES[id]}</span>
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
        <div className="fixed bottom-12 right-2 aero-glass rounded-xl p-3 z-[9000] w-64"
          onMouseDown={(e) => e.stopPropagation()}>
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
        {/* Start orb */}
        <button className="aero-start-orb w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mx-1"
          onClick={(e) => { e.stopPropagation(); blip("click"); setStartOpen(!startOpen); setShowCalendar(false); }}>
          ✦
        </button>
        {/* Quick launch */}
        {(["file-explorer", "pueinet", "puei-messenger"] as AppId[]).map((id) => (
          <button key={id} onClick={(e) => { e.stopPropagation(); openApp(id); }}
            onMouseEnter={() => blip("hover")}
            className="taskbar-item w-9 h-9 rounded flex items-center justify-center text-lg">
            {appIcon(id, 22)}
          </button>
        ))}
        <div className="w-px h-7 bg-white/20 mx-1" />
        {/* Active windows */}
        {windows.map((w) => (
          <button key={w.id}
            className={`taskbar-item h-9 px-3 rounded flex items-center gap-2 text-xs ${w.z === Math.max(...windows.map((x)=>x.z)) && !w.minimized ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); if (w.minimized) { focusWin(w.id); } else { minWin(w.id); } }}>
            {appIcon(w.appId, 18)}
            <span className="max-w-[120px] truncate">{w.title}</span>
          </button>
        ))}
        <div className="flex-1" />
        {/* System tray */}
        <div className="flex items-center gap-2 px-2 text-white text-xs">
          <span title="Network">📶</span>
          <span title="Sound" onClick={() => blip("notify")} className="cursor-pointer">🔊</span>
          <button className="aero-button rounded px-2 py-1 text-[10px]"
            onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); setStartOpen(false); }}
            style={{ color: "var(--foreground)" }}>
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<br />
            {now.toLocaleDateString()}
          </button>
        </div>
        {/* Show desktop strip */}
        <button className="h-9 w-3 ml-1 border-l border-white/20"
          title="Show desktop"
          onClick={(e) => { e.stopPropagation(); setWindows(windows.map((w) => ({ ...w, minimized: true }))); }} />
      </div>

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
    </div>
  );
}
