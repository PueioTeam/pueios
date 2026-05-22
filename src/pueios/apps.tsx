import { useEffect, useRef, useState } from "react";
import type { AppId, Theme, User, WallpaperId, SavedFile, ChatMessage } from "./state";
import {
  blip, loadFiles, upsertFile, deleteFile, getFile, appendChat, loadChat,
} from "./state";

export type AppRendererProps = {
  appId: AppId;
  theme: Theme;
  setTheme: (t: Theme) => void;
  openApp: (id: AppId, fileId?: string) => void;
  wallpaper: WallpaperId;
  setWallpaper: (w: WallpaperId) => void;
  currentUser: string;
  users: User[];
  fileId?: string;
  onCreateShortcut: (label: string, fileId: string) => void;
};

export function AppRenderer(p: AppRendererProps) {
  switch (p.appId) {
    case "settings": return <SettingsApp theme={p.theme} setTheme={p.setTheme} wallpaper={p.wallpaper} setWallpaper={p.setWallpaper} openApp={p.openApp} />;
    case "about": return <AboutApp />;
    case "notepad": return <NotepadApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} />;
    case "calculator": return <CalculatorApp />;
    case "puei-paint": return <PaintApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} />;
    case "pueinet": return <PueiNetApp />;
    case "puei-messenger": return <MessengerApp user={p.currentUser} users={p.users} />;
    case "file-explorer": return <FileExplorerApp openApp={p.openApp} />;
  }
}

function SettingsApp({ theme, setTheme, wallpaper, setWallpaper, openApp }: any) {
  const [tab, setTab] = useState("personalize");
  const tabs = [
    ["personalize", "🎨 Personalize"],
    ["wallpaper", "🖼️ Wallpaper"],
    ["sound", "🔊 Sound"],
    ["touch", "👆 Touchscreen"],
    ["accessibility", "♿ Accessibility"],
    ["performance", "⚡ Performance"],
    ["about", "ℹ️ About"],
  ];
  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r" style={{ background: "var(--glass)" }}>
        {tabs.map(([k, l]) => (
          <div key={k} onClick={() => { setTab(k); blip("click"); }}
            className="px-3 py-2 rounded-md cursor-pointer text-sm mb-1"
            style={{
              background: tab === k ? "var(--gradient-aero)" : "transparent",
              color: tab === k ? "white" : "inherit",
              boxShadow: tab === k ? "inset 0 1px 0 rgba(255,255,255,0.4)" : undefined,
            }}>{l}</div>
        ))}
      </div>
      <div className="flex-1 p-6 overflow-auto">
        {tab === "personalize" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Personalize PueiOS</h2>
            <label className="block mb-3 text-sm">Accent hue ({theme.accentH}°)</label>
            <input type="range" min={0} max={360} value={theme.accentH}
              onChange={(e) => setTheme({ ...theme, accentH: Number(e.target.value) })}
              className="w-full" />
            <div className="flex gap-2 mt-4 flex-wrap">
              {[200, 220, 260, 290, 320, 0, 30, 60, 130, 160].map((h) => (
                <button key={h} onClick={() => setTheme({ ...theme, accentH: h })}
                  className="w-10 h-10 rounded-full border-2 border-white shadow"
                  style={{ background: `oklch(0.65 0.2 ${h})` }} />
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.dark} onChange={(e) => setTheme({ ...theme, dark: e.target.checked })} />
                Dark mode
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.transparency} onChange={(e) => setTheme({ ...theme, transparency: e.target.checked })} />
                Aero transparency
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.animations} onChange={(e) => setTheme({ ...theme, animations: e.target.checked })} />
                Animations & motion
              </label>
            </div>
          </div>
        )}
        {tab === "wallpaper" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Wallpaper</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["default", "bliss", "aurora", "sunset"] as WallpaperId[]).map((w) => (
                <button key={w} onClick={() => setWallpaper(w)}
                  className={`wallpaper-${w} h-28 rounded-lg border-2 capitalize text-white font-semibold`}
                  style={{ borderColor: wallpaper === w ? "white" : "transparent", boxShadow: wallpaper === w ? "0 0 0 3px var(--accent)" : undefined }}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === "sound" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Sound</h2>
            <div className="space-y-2">
              {["start", "click", "hover", "notify", "error", "shutdown"].map((s) => (
                <button key={s} className="aero-button rounded-md px-4 py-2 mr-2 capitalize"
                  onClick={() => blip(s as any)}>▶ Test {s}</button>
              ))}
            </div>
          </div>
        )}
        {tab === "touch" && (
          <div><h2 className="text-xl font-semibold mb-4">Touchscreen</h2>
            <p className="text-sm opacity-80">Hold for <b>0.6s</b> to trigger right-click. Drag windows by their title bar. Multi-touch supported.</p></div>
        )}
        {tab === "accessibility" && (
          <div><h2 className="text-xl font-semibold mb-4">Accessibility</h2>
            <p className="text-sm opacity-80">High-contrast modes coming soon. Reduce motion via the Animations toggle on Personalize.</p></div>
        )}
        {tab === "performance" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Performance</h2>
            <p className="text-sm opacity-80">Disable transparency for fastest rendering on low-end hardware.</p>
            <button className="aero-button mt-3 rounded-md px-4 py-2"
              onClick={() => setTheme({ ...theme, transparency: false, animations: false })}>Enable Performance Mode</button>
          </div>
        )}
        {tab === "about" && (
          <div><button className="aero-button rounded-md px-4 py-2" onClick={() => openApp("about")}>Open About PueiOS →</button></div>
        )}
      </div>
    </div>
  );
}

function AboutApp() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold" style={{ color: "var(--accent)" }}>PueiOS 2</h1>
      <div className="text-sm opacity-80">Ultimate Edition · Build 2009.1138 (beta)</div>
      <div className="mt-6 mx-auto max-w-md text-left aero-glass-light p-4 rounded-lg">
        <div className="font-semibold mb-2">PueiOS Team</div>
        <div className="text-sm space-y-1">
          <div>Pueian Rosos — System Architect</div>
          <div>Pueian Pueiescu — Aero & Visual Design</div>
          <div>Pueian Lemne — Mascot & Sound Engineering</div>
        </div>
        <div className="text-xs opacity-60 mt-4">© 2009–2012 Pueian Software Initiative. All rights remembered.</div>
      </div>
    </div>
  );
}

function NotepadApp({ fileId, onCreateShortcut }: { fileId?: string; onCreateShortcut: (l: string, id: string) => void }) {
  const initial = fileId ? getFile(fileId) : undefined;
  const [text, setText] = useState(initial?.content ?? "Welcome to Puei Notepad.\n\nType anything...");
  const [name, setName] = useState(initial?.name ?? "Untitled.txt");
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [status, setStatus] = useState("");
  const save = () => {
    const id = savedId || `f-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "text", content: text, updatedAt: Date.now() });
    setSavedId(id); setStatus("Saved ✓"); blip("notify");
    setTimeout(() => setStatus(""), 1500);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-2 py-1 flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-0.5 rounded text-xs" style={{ background: "white", color: "#111", width: 180 }} />
        <button className="aero-button rounded px-2 py-0.5" onClick={save}>💾 Save</button>
        <button className="aero-button rounded px-2 py-0.5" onClick={() => { save(); savedId && onCreateShortcut(name, savedId); }}>📌 Save & shortcut</button>
        <span className="opacity-70">{status}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        className="flex-1 p-3 font-mono text-sm outline-none resize-none"
        style={{ background: "white", color: "#111" }} />
    </div>
  );
}

function CalculatorApp() {
  const [d, setD] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const press = (k: string) => {
    blip("click");
    if ("0123456789".includes(k)) { setD(fresh || d === "0" ? k : d + k); setFresh(false); return; }
    if (k === ".") { if (!d.includes(".")) setD(d + "."); setFresh(false); return; }
    if (k === "C") { setD("0"); setAcc(null); setOp(null); setFresh(true); return; }
    if (k === "=") {
      if (op && acc !== null) {
        const b = parseFloat(d);
        const r = op === "+" ? acc + b : op === "-" ? acc - b : op === "×" ? acc * b : acc / b;
        setD(String(r)); setAcc(null); setOp(null); setFresh(true);
      }
      return;
    }
    setAcc(acc === null ? parseFloat(d) : (() => {
      const b = parseFloat(d);
      return op === "+" ? acc + b : op === "-" ? acc - b : op === "×" ? acc * b : op === "÷" ? acc / b : b;
    })());
    setOp(k); setFresh(true);
  };
  const keys = ["C", "÷", "×", "-", "7", "8", "9", "+", "4", "5", "6", "=", "1", "2", "3", "0", "."];
  return (
    <div className="p-3">
      <div className="aero-glass-light rounded text-right p-3 text-2xl font-mono mb-2 overflow-hidden">{d}</div>
      <div className="grid grid-cols-4 gap-1">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} className="aero-button rounded-md py-3 font-semibold">{k}</button>
        ))}
      </div>
    </div>
  );
}

function PaintApp({ fileId, onCreateShortcut }: { fileId?: string; onCreateShortcut: (l: string, id: string) => void }) {
  const initial = fileId ? getFile(fileId) : undefined;
  const cv = useRef<HTMLCanvasElement>(null);
  const draw = useRef(false);
  const [color, setColor] = useState("#1ea8ff");
  const [size, setSize] = useState(4);
  const [name, setName] = useState(initial?.name ?? "Untitled.png");
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const c = cv.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
    if (initial?.type === "image" && initial.content) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initial.content;
    }
  }, []);
  const start = (e: React.PointerEvent) => {
    draw.current = true;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.beginPath();
    ctx.moveTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height));
  };
  const move = (e: React.PointerEvent) => {
    if (!draw.current) return;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    ctx.lineTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)); ctx.stroke();
  };
  const end = () => { draw.current = false; };
  const save = () => {
    const data = cv.current!.toDataURL("image/png");
    const id = savedId || `f-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "image", content: data, updatedAt: Date.now() });
    setSavedId(id); setStatus("Saved ✓"); blip("notify");
    setTimeout(() => setStatus(""), 1500);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex flex-wrap gap-2 px-2 py-1 items-center text-xs">
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-0.5 rounded" style={{ background: "white", color: "#111", width: 140 }} />
        <button className="aero-button px-2 py-0.5 rounded" onClick={save}>💾 Save</button>
        <button className="aero-button px-2 py-0.5 rounded" onClick={() => { save(); savedId && onCreateShortcut(name, savedId); }}>📌 Shortcut</button>
        <button className="aero-button px-2 py-0.5 rounded" onClick={() => {
          const c = cv.current!; const ctx = c.getContext("2d")!;
          ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
        }}>Clear</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="range" min={1} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <span>size: {size}</span>
        {["#000000", "#ff0000", "#ffaa00", "#00cc44", "#1ea8ff", "#aa00ff", "#ffffff"].map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{ background: c, width: 18, height: 18, border: "1px solid #666" }} />
        ))}
        <span className="opacity-70 ml-auto">{status}</span>
      </div>
      <canvas ref={cv} width={800} height={500}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        style={{ width: "100%", height: "100%", background: "white", touchAction: "none" }} />
    </div>
  );
}

function PueiNetApp() {
  const [url, setUrl] = useState("puei://home");
  const [tabs, setTabs] = useState([{ id: 1, title: "Home", url: "puei://home" }]);
  const [active, setActive] = useState(1);
  const fakeSites: Record<string, React.ReactNode> = {
    "puei://home": (
      <div className="p-8 text-center">
        <h1 className="text-5xl font-bold" style={{ color: "var(--accent)" }}>PueiNet</h1>
        <p className="opacity-70 mt-2">The retro-futuristic web, circa 2009.</p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            ["puei://news", "📰 PueiNews"],
            ["puei://search", "🔍 PueiSearch"],
            ["puei://forum", "💬 PueiForum"],
            ["puei://games", "🎮 PueiGames"],
            ["puei://mail", "✉️ PueiMail"],
            ["puei://about", "ℹ️ About"],
          ].map(([u, l]) => (
            <button key={u} onClick={() => { setUrl(u); }} className="aero-button rounded-lg p-4">{l}</button>
          ))}
        </div>
      </div>
    ),
    "puei://news": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiNews</h2><ul className="text-sm space-y-2"><li>• PueiOS 2 ships with new Aero engine</li><li>• Mascot Puei voted "Most Confusing Helper of 2009"</li><li>• Glass blur now uses 40% less RAM</li></ul></div>,
    "puei://search": <div className="p-6"><h2 className="text-2xl font-bold">PueiSearch</h2><input className="mt-3 px-3 py-2 rounded border w-full" placeholder="Search the Puei-net..." /></div>,
    "puei://forum": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiForum</h2><p className="text-sm opacity-70">[user1138]: did anyone else's mascot start blinking morse code??</p></div>,
    "puei://games": <div className="p-6"><h2 className="text-2xl font-bold">PueiGames</h2><p className="opacity-70 mt-2">Free Pueilike clones for your enjoyment.</p></div>,
    "puei://mail": <div className="p-6"><h2 className="text-2xl font-bold">PueiMail</h2><p className="text-sm opacity-70 mt-2">📧 You have 1 new message from Pueian Lemne.</p></div>,
    "puei://about": <div className="p-6"><h2 className="text-2xl font-bold">About PueiNet</h2><p className="text-sm opacity-70 mt-2">A browser for an alternate 2009.</p></div>,
  };
  const content = fakeSites[url] || <div className="p-6">404 — page not found in this universe.</div>;
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex items-center gap-1 px-2 pt-1">
        {tabs.map((t) => (
          <div key={t.id} onClick={() => { setActive(t.id); setUrl(t.url); }}
            className="px-3 py-1 rounded-t-md text-xs cursor-pointer"
            style={{
              background: active === t.id ? "var(--glass-strong)" : "var(--glass)",
              border: "1px solid var(--border)", borderBottom: "none",
            }}>
            {t.title} <span onClick={(e) => { e.stopPropagation(); setTabs(tabs.filter(x => x.id !== t.id)); }} className="ml-2 opacity-60 hover:opacity-100">×</span>
          </div>
        ))}
        <button className="aero-button rounded px-2 py-0.5 text-xs ml-1"
          onClick={() => { const id = Date.now(); setTabs([...tabs, { id, title: "New Tab", url: "puei://home" }]); setActive(id); setUrl("puei://home"); }}>+</button>
      </div>
      <div className="aero-titlebar flex items-center gap-2 px-2 py-1">
        <button className="aero-button rounded px-2 py-0.5 text-xs" onClick={() => setUrl("puei://home")}>⌂</button>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-full px-3 py-1 text-xs outline-none"
          style={{ background: "white", border: "1px solid var(--accent)", boxShadow: "0 0 6px oklch(var(--accent) / 0.5)" }} />
      </div>
      <div className="flex-1 overflow-auto" style={{ background: "white" }}>{content}</div>
    </div>
  );
}

function MessengerApp({ user, users }: { user: string; users: User[] }) {
  // Contacts = every other account on this machine
  const contacts = users.filter((u) => u.name !== user);
  const [active, setActive] = useState(0);
  const [allMsgs, setAllMsgs] = useState<ChatMessage[]>(() => loadChat());
  const [text, setText] = useState("");

  // Cross-tab updates
  useEffect(() => {
    const fn = () => setAllMsgs(loadChat());
    window.addEventListener("pueios-chat", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-chat", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);

  if (contacts.length === 0) {
    return (
      <div className="p-6 text-sm text-center opacity-80">
        <div className="text-4xl mb-2">💬</div>
        <div className="font-semibold mb-1">No-one to chat with yet</div>
        <div>Create another account from the login screen, then sign in on another tab/window to chat in real time.</div>
      </div>
    );
  }

  const partner = contacts[active];
  const conversation = allMsgs.filter(
    (m) =>
      (m.from === user && m.to === partner.name) ||
      (m.from === partner.name && m.to === user)
  );

  const send = () => {
    if (!text.trim()) return;
    blip("click");
    const msg: ChatMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: user, to: partner.name, text, at: Date.now(),
    };
    appendChat(msg);
    setAllMsgs(loadChat());
    setText("");
  };

  return (
    <div className="flex h-full">
      <div className="w-48 border-r overflow-auto" style={{ background: "var(--glass)" }}>
        <div className="px-3 py-2 text-xs opacity-70 font-semibold">Signed in as {user}</div>
        {contacts.map((c, i) => {
          const last = [...allMsgs].reverse().find(
            (m) => (m.from === user && m.to === c.name) || (m.from === c.name && m.to === user)
          );
          return (
            <div key={c.name} onClick={() => setActive(i)}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ background: active === i ? "var(--gradient-aero)" : "transparent", color: active === i ? "white" : undefined }}>
              <div>{c.avatar} {c.name}</div>
              <div className="text-xs opacity-70 truncate">{last ? last.text : "Say hi 👋"}</div>
            </div>
          );
        })}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="aero-titlebar px-3 py-1.5 text-sm font-semibold">{partner.avatar} {partner.name}</div>
        <div className="flex-1 p-3 overflow-auto space-y-2 text-sm">
          {conversation.length === 0 && <div className="text-xs opacity-60 text-center">No messages yet. Sign in as {partner.name} in another tab to chat back!</div>}
          {conversation.map((m) => (
            <div key={m.id} className={m.from === user ? "text-right" : "text-left"}>
              <div className="inline-block px-3 py-1.5 rounded-2xl max-w-xs"
                style={{
                  background: m.from === user ? "var(--gradient-aero)" : "var(--glass)",
                  color: m.from === user ? "white" : undefined,
                  border: "1px solid var(--border)",
                }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 flex gap-2 border-t">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="flex-1 px-3 py-1.5 rounded-md outline-none text-sm"
            style={{ background: "white", border: "1px solid var(--border)" }}
            placeholder={`Message ${partner.name}…`} />
          <button className="aero-button rounded-md px-3" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}

function FileExplorerApp({ openApp }: { openApp: (id: AppId, fileId?: string) => void }) {
  const [files, setFiles] = useState<SavedFile[]>(() => loadFiles());
  const [folder, setFolder] = useState<"home" | "documents" | "pictures" | "apps">("home");
  useEffect(() => {
    const fn = () => setFiles(loadFiles());
    window.addEventListener("pueios-files-changed", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-files-changed", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);

  const folders = [
    { id: "documents" as const, name: "Documents", icon: "📁" },
    { id: "pictures" as const, name: "Pictures", icon: "🖼️" },
    { id: "apps" as const, name: "Apps", icon: "🧩" },
  ];
  const apps: { name: string; appId: AppId; icon: string }[] = [
    { name: "Puei Paint 2", appId: "puei-paint", icon: "🎨" },
    { name: "Notepad", appId: "notepad", icon: "📝" },
    { name: "Calculator", appId: "calculator", icon: "🧮" },
    { name: "Settings", appId: "settings", icon: "⚙️" },
    { name: "PueiNet", appId: "pueinet", icon: "🌐" },
    { name: "Puei Messenger", appId: "puei-messenger", icon: "💬" },
  ];

  const textFiles = files.filter((f) => f.type === "text");
  const imgFiles = files.filter((f) => f.type === "image");

  const openFile = (f: SavedFile) => openApp(f.type === "text" ? "notepad" : "puei-paint", f.id);

  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r text-sm" style={{ background: "var(--glass)" }}>
        <div className="font-semibold mb-2 opacity-70 text-xs">FAVORITES</div>
        <div onClick={() => setFolder("home")} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer" style={{ background: folder === "home" ? "rgba(255,255,255,0.4)" : undefined }}>🏠 Home</div>
        <div onClick={() => setFolder("documents")} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer" style={{ background: folder === "documents" ? "rgba(255,255,255,0.4)" : undefined }}>📁 Documents</div>
        <div onClick={() => setFolder("pictures")} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer" style={{ background: folder === "pictures" ? "rgba(255,255,255,0.4)" : undefined }}>🖼️ Pictures</div>
        <div onClick={() => setFolder("apps")} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer" style={{ background: folder === "apps" ? "rgba(255,255,255,0.4)" : undefined }}>🧩 Apps</div>
        <div className="font-semibold mt-3 mb-2 opacity-70 text-xs">COMPUTER</div>
        <div className="px-2 py-1 rounded opacity-70">💽 C:\ PueiDrive</div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-xs opacity-70 mb-3">Computer › PueiDrive › Users › You › {folder}</div>
        {folder === "home" && (
          <div className="grid grid-cols-5 gap-3">
            {folders.map((f) => (
              <div key={f.id} onDoubleClick={() => setFolder(f.id)}
                className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
                <div className="text-4xl">{f.icon}</div>
                <div className="text-xs mt-1">{f.name}</div>
              </div>
            ))}
          </div>
        )}
        {folder === "documents" && (
          <FileGrid files={textFiles} emptyHint="No saved documents. Open Notepad and click Save to create one." openFile={openFile} onDelete={(id) => { deleteFile(id); setFiles(loadFiles()); }} />
        )}
        {folder === "pictures" && (
          <FileGrid files={imgFiles} emptyHint="No saved pictures. Open Puei Paint 2 and click Save to create one." openFile={openFile} onDelete={(id) => { deleteFile(id); setFiles(loadFiles()); }} />
        )}
        {folder === "apps" && (
          <div className="grid grid-cols-5 gap-3">
            {apps.map((a) => (
              <div key={a.appId} onDoubleClick={() => openApp(a.appId)} onClick={() => blip("hover")}
                className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
                <div className="text-4xl">{a.icon}</div>
                <div className="text-xs mt-1">{a.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileGrid({ files, emptyHint, openFile, onDelete }: {
  files: SavedFile[]; emptyHint: string;
  openFile: (f: SavedFile) => void; onDelete: (id: string) => void;
}) {
  if (files.length === 0) return <div className="text-sm opacity-70 p-6 text-center">{emptyHint}</div>;
  return (
    <div className="grid grid-cols-5 gap-3">
      {files.map((f) => (
        <div key={f.id} onDoubleClick={() => openFile(f)}
          className="text-center p-2 rounded hover:bg-white/30 cursor-pointer group relative">
          {f.type === "image" ? (
            <img src={f.content} alt={f.name} className="w-12 h-12 mx-auto object-cover rounded shadow" />
          ) : (
            <div className="text-4xl">📄</div>
          )}
          <div className="text-xs mt-1 truncate">{f.name}</div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-xs text-red-500 px-1">✕</button>
        </div>
      ))}
    </div>
  );
}
