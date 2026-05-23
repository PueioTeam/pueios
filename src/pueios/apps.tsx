import { useEffect, useRef, useState } from "react";
import type { AppId, Theme, User, WallpaperId, SavedFile, ChatMessage, DesktopIcon, SocialPost } from "./state";
import {
  blip, loadFiles, upsertFile, deleteFile, getFile, appendChat, loadChat,
  loadSocial, saveSocial, pueiNumberFor, googleFaviconFor,
  classifyTrustedUrl, trustedIconFor, lookupPueiNumber, registerInDirectory, loadDirectory,
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
  setUsers: (u: User[]) => void;
  fileId?: string;
  webUrl?: string;
  folderIconId?: string;
  icons: DesktopIcon[];
  onCreateShortcut: (label: string, fileId: string) => void;
  installWebApp: (label: string, url: string) => void;
  openWebApp: (url: string, title: string) => void;
  openFolder: (folderIconId: string, title: string) => void;
};

export function AppRenderer(p: AppRendererProps) {
  switch (p.appId) {
    case "settings": return <SettingsApp theme={p.theme} setTheme={p.setTheme} wallpaper={p.wallpaper} setWallpaper={p.setWallpaper} openApp={p.openApp} currentUser={p.currentUser} users={p.users} setUsers={p.setUsers} />;
    case "about": return <AboutApp />;
    case "notepad": return <NotepadApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} />;
    case "calculator": return <CalculatorApp />;
    case "puei-paint": return <PaintApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} />;
    case "pueinet": return <PueiNetApp />;
    case "puei-messenger": return <MessengerApp user={p.currentUser} users={p.users} setUsers={p.setUsers} />;
    case "file-explorer": return <FileExplorerApp openApp={p.openApp} icons={p.icons} openFolder={p.openFolder} />;
    case "app-store": return <AppStoreApp installWebApp={p.installWebApp} openApp={p.openApp} />;
    case "puei-social": return <PueiSocialApp user={p.currentUser} users={p.users} />;
    case "folder": return <FolderApp folderIconId={p.folderIconId!} icons={p.icons} openApp={p.openApp} openWebApp={p.openWebApp} />;
    case "web-app": return <WebAppFrame url={p.webUrl!} />;
  }
}

function SettingsApp({ theme, setTheme, wallpaper, setWallpaper, openApp, currentUser, users, setUsers }: any) {
  const [tab, setTab] = useState("personalize");
  const [paintImages, setPaintImages] = useState<SavedFile[]>(() => loadFiles().filter((f) => f.type === "image"));
  useEffect(() => {
    const fn = () => setPaintImages(loadFiles().filter((f) => f.type === "image"));
    window.addEventListener("pueios-files-changed", fn);
    return () => window.removeEventListener("pueios-files-changed", fn);
  }, []);

  const me: User | undefined = users.find((u: User) => u.name === currentUser);
  const updateMe = (patch: Partial<User>) => {
    setUsers(users.map((u: User) => u.name === currentUser ? { ...u, ...patch } : u));
  };
  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => updateMe({ avatar: String(r.result) });
    r.readAsDataURL(f);
  };

  const tabs = [
    ["personalize", "🎨 Personalize"],
    ["wallpaper", "🖼️ Wallpaper"],
    ["account", "👤 Account"],
    ["sound", "🔊 Sound"],
    ["touch", "👆 Touchscreen"],
    ["accessibility", "♿ Accessibility"],
    ["highcontrast", "⚡ High Contrast"],
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
            <h2 className="text-xl font-semibold mb-4">Personalize PueiOS 2</h2>
            <label className="block mb-3 text-sm">Accent hue ({theme.accentH}°)</label>
            <input type="range" min={0} max={360} value={theme.accentH}
              onChange={(e) => setTheme({ ...theme, accentH: Number(e.target.value) })} className="w-full" />
            <div className="flex gap-2 mt-4 flex-wrap">
              {[200, 220, 260, 290, 320, 0, 30, 60, 130, 160].map((h) => (
                <button key={h} onClick={() => setTheme({ ...theme, accentH: h })}
                  className="w-10 h-10 rounded-full border-2 border-white shadow"
                  style={{ background: `oklch(0.65 0.2 ${h})` }} />
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.dark} onChange={(e) => setTheme({ ...theme, dark: e.target.checked })} /> Dark mode
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.transparency} onChange={(e) => setTheme({ ...theme, transparency: e.target.checked })} /> Aero transparency
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.animations} onChange={(e) => setTheme({ ...theme, animations: e.target.checked })} /> Animations & motion
              </label>
            </div>
          </div>
        )}
        {tab === "wallpaper" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Wallpaper</h2>
            <div className="text-xs opacity-70 mb-2">Built-in</div>
            <div className="grid grid-cols-2 gap-3">
              {(["default", "bliss", "aurora", "sunset"] as WallpaperId[]).map((w) => (
                <button key={w} onClick={() => setWallpaper(w)}
                  className={`wallpaper-${w} h-28 rounded-lg border-2 capitalize text-white font-semibold`}
                  style={{ borderColor: wallpaper === w ? "white" : "transparent", boxShadow: wallpaper === w ? "0 0 0 3px var(--accent)" : undefined }}>
                  {w}
                </button>
              ))}
            </div>
            <div className="text-xs opacity-70 mt-5 mb-2">From Puei Paint 2</div>
            {paintImages.length === 0 ? (
              <div className="text-sm opacity-60">No Paint files yet. Save an image in Puei Paint 2 and it will appear here.</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {paintImages.map((f) => {
                  const id = `custom:${f.id}`;
                  return (
                    <button key={f.id} onClick={() => setWallpaper(id)}
                      className="h-24 rounded-lg border-2 overflow-hidden relative"
                      style={{ borderColor: wallpaper === id ? "white" : "transparent", boxShadow: wallpaper === id ? "0 0 0 3px var(--accent)" : undefined }}>
                      <img src={f.content} alt={f.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 truncate">{f.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {tab === "account" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Account</h2>
            {me ? (
              <div className="space-y-3 max-w-md">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center text-4xl"
                    style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${me.color}), oklch(0.45 0.2 ${me.color}))` }}>
                    {me.avatar.startsWith("data:")
                      ? <img src={me.avatar} alt="" className="w-full h-full object-cover" />
                      : me.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{me.name}</div>
                    <label className="aero-button inline-block rounded px-3 py-1 text-xs cursor-pointer mt-1">
                      Upload picture
                      <input type="file" accept="image/*" className="hidden" onChange={onAvatarFile} />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧙","🐱","🤖","👽","🎩","🌟"].map((a) => (
                    <button key={a} onClick={() => updateMe({ avatar: a })}
                      className="w-9 h-9 rounded text-xl flex items-center justify-center"
                      style={{ background: me.avatar === a ? "var(--gradient-aero)" : "rgba(255,255,255,0.5)" }}>{a}</button>
                  ))}
                </div>
                <div>
                  <label className="text-xs opacity-70">Tile colour</label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {["200","260","320","30","60","130","160","0"].map((c) => (
                      <button key={c} onClick={() => updateMe({ color: c })}
                        className="w-8 h-8 rounded-full border-2"
                        style={{
                          background: `linear-gradient(135deg, oklch(0.7 0.18 ${c}), oklch(0.45 0.2 ${c}))`,
                          borderColor: me.color === c ? "white" : "transparent",
                        }} />
                    ))}
                  </div>
                </div>
              </div>
            ) : <div className="text-sm opacity-70">Not signed in.</div>}
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
          <div><button className="aero-button rounded-md px-4 py-2" onClick={() => openApp("about")}>Open About PueiOS 2 →</button></div>
        )}
      </div>
    </div>
  );
}

function AboutApp() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold" style={{ color: "var(--accent)" }}>PueiOS 2</h1>
      <div className="text-sm opacity-80">Ultimate Edition · Build 2020.1138 (beta)</div>
      <div className="mt-6 mx-auto max-w-md text-left aero-glass-light p-4 rounded-lg">
        <div className="font-semibold mb-2">PueiOS Team</div>
        <div className="text-sm space-y-1">
          <div>Pueian Architect — System Architecture</div>
          <div>Pueian Pueiescu — Aero & Visual Design</div>
          <div>Pueian Lemne — Mascot & Sound Engineering</div>
        </div>
        <div className="text-xs opacity-60 mt-4">© 2020 Pueian Software Initiative. All rights remembered.</div>
        <div className="text-xs opacity-60 mt-2">Security key for this build: <b>puei</b></div>
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
    return id;
  };
  const open = () => {
    const all = loadFiles().filter((f) => f.type === "text");
    if (all.length === 0) { alert("No saved documents yet."); return; }
    const pick = prompt("Open file — type a name from:\n" + all.map((f) => f.name).join("\n"), all[0].name);
    if (!pick) return;
    const f = all.find((x) => x.name === pick);
    if (!f) { alert("Not found"); return; }
    setText(f.content); setName(f.name); setSavedId(f.id);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-2 py-1 flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-0.5 rounded text-xs" style={{ background: "white", color: "#111", width: 180 }} />
        <button className="aero-button rounded px-2 py-0.5" onClick={save}>💾 Save</button>
        <button className="aero-button rounded px-2 py-0.5" onClick={open}>📂 Open</button>
        <button className="aero-button rounded px-2 py-0.5" onClick={() => { const id = save(); onCreateShortcut(name, id); }}>📌 Save & shortcut</button>
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
    return id;
  };
  const open = () => {
    const all = loadFiles().filter((f) => f.type === "image");
    if (all.length === 0) { alert("No saved images yet."); return; }
    const pick = prompt("Open file — type a name from:\n" + all.map((f) => f.name).join("\n"), all[0].name);
    if (!pick) return;
    const f = all.find((x) => x.name === pick);
    if (!f) return;
    setName(f.name); setSavedId(f.id);
    const c = cv.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
    const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = f.content;
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex flex-wrap gap-2 px-2 py-1 items-center text-xs">
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-2 py-0.5 rounded" style={{ background: "white", color: "#111", width: 140 }} />
        <button className="aero-button px-2 py-0.5 rounded" onClick={save}>💾 Save</button>
        <button className="aero-button px-2 py-0.5 rounded" onClick={open}>📂 Open</button>
        <button className="aero-button px-2 py-0.5 rounded" onClick={() => { const id = save(); onCreateShortcut(name, id); }}>📌 Shortcut</button>
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
        <span className="opacity-70 ml-auto">{status} · Saved images can be set as wallpaper in Settings.</span>
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
        <p className="opacity-70 mt-2">The retro-futuristic web, circa 2020.</p>
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
    "puei://news": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiNews</h2><ul className="text-sm space-y-2"><li>• PueiOS 2 Ultimate Edition lands on glassy desktops everywhere</li><li>• Mascot Puei voted "Most Confusing Helper of 2020"</li><li>• Glass blur now uses 40% less RAM</li></ul></div>,
    "puei://search": <div className="p-6"><h2 className="text-2xl font-bold">PueiSearch</h2><input className="mt-3 px-3 py-2 rounded border w-full" placeholder="Search the Puei-net..." /></div>,
    "puei://forum": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiForum</h2><p className="text-sm opacity-70">[user1138]: did anyone else's mascot start blinking morse code??</p></div>,
    "puei://games": <div className="p-6"><h2 className="text-2xl font-bold">PueiGames</h2><p className="opacity-70 mt-2">Free Pueilike clones for your enjoyment.</p></div>,
    "puei://mail": <div className="p-6"><h2 className="text-2xl font-bold">PueiMail</h2><p className="text-sm opacity-70 mt-2">📧 You have 1 new message from Pueian Lemne.</p></div>,
    "puei://about": <div className="p-6"><h2 className="text-2xl font-bold">About PueiNet</h2><p className="text-sm opacity-70 mt-2">A browser for an alternate 2020.</p></div>,
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

function MessengerApp({ user, users, setUsers }: { user: string; users: User[]; setUsers: (u: User[]) => void }) {
  const contacts = users.filter((u) => u.name !== user);
  const [active, setActive] = useState(0);
  const [allMsgs, setAllMsgs] = useState<ChatMessage[]>(() => loadChat());
  const [text, setText] = useState("");
  const [view, setView] = useState<"chat" | "settings">("chat");
  useEffect(() => {
    const fn = () => setAllMsgs(loadChat());
    window.addEventListener("pueios-chat", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-chat", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);

  // Backfill PueiNumber for the current user if missing
  const me = users.find((u) => u.name === user);
  useEffect(() => {
    if (me && !me.pueiNumber) {
      setUsers(users.map((u) => u.name === user ? { ...u, pueiNumber: pueiNumberFor(user + ":" + Date.now()) } : u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SettingsView = () => {
    const myNum = me?.pueiNumber || (me ? pueiNumberFor(user + ":seed") : "—");
    const [copied, setCopied] = useState(false);
    return (
      <div className="flex-1 p-6 overflow-auto">
        <h2 className="text-xl font-semibold mb-2">Messenger Settings</h2>
        <p className="text-sm opacity-70 mb-5">Your PueiNumber is a unique ID assigned when you created your PueiOS account. Share it so others can find you on Puei Messenger.</p>
        <div className="aero-glass-light rounded-xl p-4 max-w-md">
          <div className="text-xs opacity-60">Signed in as</div>
          <div className="text-base font-semibold mb-3">{user}</div>
          <div className="text-xs opacity-60">Your PueiNumber</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="font-mono text-2xl tracking-wider px-3 py-2 rounded"
              style={{ background: "white", color: "#111", border: "1px solid var(--border)" }}>
              {myNum}
            </div>
            <button className="aero-button rounded px-3 py-2 text-xs"
              onClick={() => { navigator.clipboard?.writeText(myNum); setCopied(true); setTimeout(() => setCopied(false), 1200); blip("click"); }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="text-[10px] opacity-50 mt-2">Format: XXX-XXX-XXX · assigned at account creation</div>
        </div>
        <div className="mt-5 max-w-md">
          <div className="text-xs opacity-60 mb-2">Other PueiOS accounts on this device</div>
          {contacts.length === 0 && <div className="text-xs opacity-60">No other accounts yet.</div>}
          {contacts.map((c) => (
            <div key={c.name} className="flex items-center justify-between aero-glass-light rounded p-2 mb-1 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded overflow-hidden flex items-center justify-center text-base"
                  style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${c.color}), oklch(0.45 0.2 ${c.color}))` }}>
                  {c.avatar.startsWith("data:") ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : c.avatar}
                </div>
                <span>{c.name}</span>
              </div>
              <span className="font-mono text-xs opacity-70">{c.pueiNumber || pueiNumberFor(c.name + ":seed")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (contacts.length === 0 && view === "chat") {
    return (
      <div className="flex h-full">
        <div className="w-44 border-r p-2" style={{ background: "var(--glass)" }}>
          <button className="aero-button rounded w-full text-xs py-1.5 mb-1" onClick={() => setView("chat")}>💬 Chats</button>
          <button className="aero-button rounded w-full text-xs py-1.5" onClick={() => setView("settings")}>⚙️ Settings</button>
        </div>
        <div className="flex-1 p-6 text-sm text-center opacity-80 flex flex-col items-center justify-center">
          <div className="text-4xl mb-2">💬</div>
          <div className="font-semibold mb-1">No-one to chat with yet</div>
          <div className="max-w-xs">Create another account from the login screen, then sign in on another tab/window to chat in real time. View your PueiNumber under Settings.</div>
        </div>
      </div>
    );
  }

  const partner = contacts[active];
  const conversation = partner ? allMsgs.filter((m) =>
    (m.from === user && m.to === partner.name) || (m.from === partner.name && m.to === user)) : [];

  const send = () => {
    if (!text.trim() || !partner) return;
    blip("click");
    appendChat({ id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, from: user, to: partner.name, text, at: Date.now() });
    setAllMsgs(loadChat()); setText("");
  };

  return (
    <div className="flex h-full">
      <div className="w-48 border-r overflow-auto flex flex-col" style={{ background: "var(--glass)" }}>
        <div className="px-2 py-2 flex gap-1">
          <button className="aero-button rounded text-xs py-1 px-2 flex-1"
            style={{ background: view === "chat" ? "var(--gradient-aero)" : undefined, color: view === "chat" ? "white" : undefined }}
            onClick={() => setView("chat")}>💬 Chats</button>
          <button className="aero-button rounded text-xs py-1 px-2 flex-1"
            style={{ background: view === "settings" ? "var(--gradient-aero)" : undefined, color: view === "settings" ? "white" : undefined }}
            onClick={() => setView("settings")}>⚙️</button>
        </div>
        <div className="px-3 py-1 text-xs opacity-70 font-semibold">Signed in as {user}</div>
        <div className="px-3 pb-2 text-[10px] opacity-60 font-mono">#{me?.pueiNumber || "—"}</div>
        {view === "chat" && contacts.map((c, i) => {
          const last = [...allMsgs].reverse().find((m) => (m.from === user && m.to === c.name) || (m.from === c.name && m.to === user));
          return (
            <div key={c.name} onClick={() => setActive(i)}
              className="px-3 py-2 cursor-pointer text-sm flex items-center gap-2"
              style={{ background: active === i ? "var(--gradient-aero)" : "transparent", color: active === i ? "white" : undefined }}>
              <div className="w-7 h-7 rounded overflow-hidden flex items-center justify-center text-base"
                style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${c.color}), oklch(0.45 0.2 ${c.color}))` }}>
                {c.avatar.startsWith("data:") ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : c.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate">{c.name}</div>
                <div className="text-xs opacity-70 truncate">{last ? last.text : "Say hi 👋"}</div>
              </div>
            </div>
          );
        })}
      </div>
      {view === "settings" ? <SettingsView /> : (
        <div className="flex-1 flex flex-col">
          <div className="aero-titlebar px-3 py-1.5 text-sm font-semibold flex items-center justify-between">
            <span>{partner?.avatar.startsWith("data:") ? "🙂" : partner?.avatar} {partner?.name}</span>
            <span className="text-[10px] opacity-60 font-mono">#{partner?.pueiNumber || (partner ? pueiNumberFor(partner.name + ":seed") : "")}</span>
          </div>
          <div className="flex-1 p-3 overflow-auto space-y-2 text-sm">
            {conversation.length === 0 && <div className="text-xs opacity-60 text-center">No messages yet. Sign in as {partner?.name} in another tab to chat back!</div>}
            {conversation.map((m) => (
              <div key={m.id} className={m.from === user ? "text-right" : "text-left"}>
                <div className="inline-block px-3 py-1.5 rounded-2xl max-w-xs"
                  style={{
                    background: m.from === user ? "var(--gradient-aero)" : "var(--glass)",
                    color: m.from === user ? "white" : undefined,
                    border: "1px solid var(--border)",
                  }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="p-2 flex gap-2 border-t">
            <input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 px-3 py-1.5 rounded-md outline-none text-sm"
              style={{ background: "white", border: "1px solid var(--border)" }}
              placeholder={`Message ${partner?.name}…`} />
            <button className="aero-button rounded-md px-3" onClick={send}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileExplorerApp({ openApp, icons, openFolder }: { openApp: (id: AppId, fileId?: string) => void; icons: DesktopIcon[]; openFolder: (id: string, title: string) => void }) {
  const [files, setFiles] = useState<SavedFile[]>(() => loadFiles());
  const [folder, setFolder] = useState<"home" | "documents" | "pictures" | "apps" | "folders">("home");
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
    { id: "folders" as const, name: "My Folders", icon: "🗃️" },
  ];
  const apps: { name: string; appId: AppId; icon: string }[] = [
    { name: "Puei Paint 2", appId: "puei-paint", icon: "🎨" },
    { name: "Notepad", appId: "notepad", icon: "📝" },
    { name: "Calculator", appId: "calculator", icon: "🧮" },
    { name: "Settings", appId: "settings", icon: "⚙️" },
    { name: "PueiNet", appId: "pueinet", icon: "🌐" },
    { name: "Puei Messenger", appId: "puei-messenger", icon: "💬" },
    { name: "App Store", appId: "app-store", icon: "🛍️" },
    { name: "PueiSocial", appId: "puei-social", icon: "📣" },
  ];

  const textFiles = files.filter((f) => f.type === "text");
  const imgFiles = files.filter((f) => f.type === "image");
  const myFolders = icons.filter((i) => i.appId === "folder");

  const openFile = (f: SavedFile) => openApp(f.type === "text" ? "notepad" : "puei-paint", f.id);

  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r text-sm" style={{ background: "var(--glass)" }}>
        <div className="font-semibold mb-2 opacity-70 text-xs">FAVORITES</div>
        {[
          ["home","🏠 Home"],["documents","📁 Documents"],["pictures","🖼️ Pictures"],
          ["folders","🗃️ My Folders"],["apps","🧩 Apps"],
        ].map(([k, l]) => (
          <div key={k} onClick={() => setFolder(k as any)}
            className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer"
            style={{ background: folder === k ? "rgba(255,255,255,0.4)" : undefined }}>{l}</div>
        ))}
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
        {folder === "folders" && (
          myFolders.length === 0
            ? <div className="text-sm opacity-70 p-6 text-center">No folders yet. Right-click the desktop → New Folder.</div>
            : <div className="grid grid-cols-5 gap-3">
                {myFolders.map((f) => (
                  <div key={f.id} onDoubleClick={() => openFolder(f.id, f.label)}
                    className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
                    <div className="text-4xl">📁</div>
                    <div className="text-xs mt-1 truncate">{f.label}</div>
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
          {f.type === "image"
            ? <img src={f.content} alt={f.name} className="w-12 h-12 mx-auto object-cover rounded shadow" />
            : <div className="text-4xl">📄</div>}
          <div className="text-xs mt-1 truncate">{f.name}</div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-xs text-red-500 px-1">✕</button>
        </div>
      ))}
    </div>
  );
}

// ---------- App Store ----------
function AppStoreApp({ installWebApp, openApp }: { installWebApp: (label: string, url: string) => void; openApp: (id: AppId) => void }) {
  const [tab, setTab] = useState<"featured" | "productivity" | "social" | "media" | "games" | "dev" | "web" | "installer">("featured");
  const cats: [typeof tab, string][] = [
    ["featured", "🌟 Featured"],
    ["productivity", "💼 Productivity"],
    ["social", "💬 Social"],
    ["media", "🎬 Media"],
    ["games", "🎮 Games"],
    ["dev", "🧑‍💻 Developer"],
    ["web", "🌐 Web Apps"],
    ["installer", "📥 Installer"],
  ];
  type StoreApp = { name: string; icon: string; desc: string; appId?: AppId; url?: string };
  const lists: Record<string, StoreApp[]> = {
    featured: [
      { name: "Puei Paint 2", icon: "🎨", desc: "Paint, save, and use as wallpaper.", appId: "puei-paint" },
      { name: "PueiNet", icon: "🌐", desc: "The retro-futuristic web browser.", appId: "pueinet" },
      { name: "Puei Messenger", icon: "💬", desc: "Chat & get a PueiNumber.", appId: "puei-messenger" },
      { name: "PueiSocial", icon: "📣", desc: "Post text, images, videos.", appId: "puei-social" },
      { name: "Notepad", icon: "📝", desc: "Write and save text files.", appId: "notepad" },
      { name: "Calculator", icon: "🧮", desc: "Basic arithmetic, glossy buttons.", appId: "calculator" },
      { name: "Computer", icon: "🗂️", desc: "Browse files and folders.", appId: "file-explorer" },
      { name: "Settings", icon: "⚙️", desc: "Themes, wallpaper, account.", appId: "settings" },
    ],
    productivity: [
      { name: "Notepad", icon: "📝", desc: "Plain text editor.", appId: "notepad" },
      { name: "Calculator", icon: "🧮", desc: "Arithmetic & history.", appId: "calculator" },
      { name: "PueiDocs", icon: "📄", desc: "Documents in the cloud.", url: "https://docs.google.com" },
      { name: "PueiSheets", icon: "📊", desc: "Spreadsheets that just work.", url: "https://sheets.google.com" },
      { name: "PueiCal", icon: "📆", desc: "Calendar & scheduling.", url: "https://calendar.google.com" },
      { name: "PueiMail", icon: "✉️", desc: "Webmail client.", url: "https://mail.google.com" },
      { name: "Pueidian Drive", icon: "💽", desc: "Cloud storage.", url: "https://drive.google.com" },
      { name: "PueiTrello", icon: "📋", desc: "Boards, lists, cards.", url: "https://trello.com" },
    ],
    social: [
      { name: "Puei Messenger", icon: "💬", desc: "Chat with other accounts.", appId: "puei-messenger" },
      { name: "PueiSocial", icon: "📣", desc: "Built-in social network.", appId: "puei-social" },
      { name: "PueiTube Chat", icon: "🎥", desc: "Video calls.", url: "https://meet.google.com" },
      { name: "PueiGram", icon: "📷", desc: "Photo sharing on the open web.", url: "https://www.instagram.com" },
      { name: "Pueitter", icon: "🐦", desc: "Microblogging.", url: "https://twitter.com" },
      { name: "PueiBook", icon: "📘", desc: "Stay in touch with friends.", url: "https://www.facebook.com" },
      { name: "PueiDiscord", icon: "🎧", desc: "Chat for communities.", url: "https://discord.com" },
      { name: "PueiReddit", icon: "👽", desc: "The Puei-net's front page.", url: "https://www.reddit.com" },
    ],
    media: [
      { name: "PueiTube", icon: "▶️", desc: "Video for everyone.", url: "https://www.youtube.com" },
      { name: "PueiFlix", icon: "🎬", desc: "Movies & shows.", url: "https://www.netflix.com" },
      { name: "PueiSpot", icon: "🎵", desc: "Music streaming.", url: "https://open.spotify.com" },
      { name: "PueiTunes", icon: "🎧", desc: "Podcasts & audio.", url: "https://soundcloud.com" },
      { name: "PueiPics", icon: "🖼️", desc: "Stock photos & art.", url: "https://unsplash.com" },
      { name: "PueiTwitch", icon: "📡", desc: "Live streams.", url: "https://www.twitch.tv" },
    ],
    games: [
      { name: "Pueiblox", icon: "🟦", desc: "Build & play together.", url: "https://www.roblox.com" },
      { name: "PueiCraft", icon: "⛏️", desc: "Mine, craft, repeat.", url: "https://www.minecraft.net" },
      { name: "PueiSteam", icon: "💨", desc: "PC games marketplace.", url: "https://store.steampowered.com" },
      { name: "PueiArcade", icon: "🕹️", desc: "Free browser arcade.", url: "https://poki.com" },
      { name: "PueiChess", icon: "♟️", desc: "Online chess.", url: "https://www.chess.com" },
      { name: "PueiAmongOS", icon: "🟥", desc: "Find the imposter.", url: "https://innersloth.com" },
    ],
    dev: [
      { name: "PueiHub", icon: "🐙", desc: "Code hosting.", url: "https://github.com" },
      { name: "PueiCodeSandbox", icon: "📦", desc: "Web IDE.", url: "https://codesandbox.io" },
      { name: "Pueitlify", icon: "🚀", desc: "Deploy static sites.", url: "https://app.netlify.com" },
      { name: "PueiCel", icon: "▲", desc: "Frontend cloud.", url: "https://vercel.com" },
      { name: "PueiOverflow", icon: "📚", desc: "Q&A for programmers.", url: "https://stackoverflow.com" },
      { name: "PueiNotion", icon: "🗒️", desc: "Notes & wikis.", url: "https://www.notion.so" },
    ],
    web: [
      { name: "PueiSearch", icon: "🔍", desc: "Search the web.", url: "https://www.google.com" },
      { name: "PueiPedia", icon: "📖", desc: "Free encyclopedia.", url: "https://www.wikipedia.org" },
      { name: "PueiMaps", icon: "🗺️", desc: "Get directions.", url: "https://maps.google.com" },
      { name: "Pueizon", icon: "📦", desc: "Shop everything.", url: "https://www.amazon.com" },
      { name: "PueiBay", icon: "🛒", desc: "Auctions & deals.", url: "https://www.ebay.com" },
      { name: "PueiWeather", icon: "⛅", desc: "Forecasts.", url: "https://weather.com" },
    ],
  };
  return (
    <div className="flex h-full">
      <div className="w-44 p-2 border-r text-sm overflow-auto" style={{ background: "var(--glass)" }}>
        <div className="font-semibold opacity-70 text-xs mb-2 px-2">STORE</div>
        {cats.map(([k, l]) => (
          <div key={k} onClick={() => { setTab(k); blip("click"); }}
            className="px-3 py-2 rounded cursor-pointer text-sm mb-0.5"
            style={{ background: tab === k ? "var(--gradient-aero)" : "transparent", color: tab === k ? "white" : undefined }}>{l}</div>
        ))}
      </div>
      <div className="flex-1 p-5 overflow-auto">
        {tab === "installer" ? <InstallerPane installWebApp={installWebApp} /> : (
          <div>
            <h2 className="text-2xl font-bold mb-1">PueiOS 2 App Store</h2>
            <p className="text-sm opacity-70 mb-4 capitalize">{tab === "featured" ? "Bundled apps shipped with PueiOS 2." : `${tab} apps for your desktop.`}</p>
            <div className="grid grid-cols-3 gap-3">
              {lists[tab].map((a) => (
                <div key={a.name} className="aero-glass-light rounded-lg p-3 flex flex-col">
                  <div className="flex items-center gap-2">
                    {a.url
                      ? <img src={googleFaviconFor(a.url, 64)} alt="" className="w-8 h-8 rounded" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <div className="text-3xl">{a.icon}</div>}
                    <div className="font-semibold">{a.name}</div>
                  </div>
                  <div className="text-xs opacity-70 mt-1 h-8">{a.desc}</div>
                  {a.appId ? (
                    <button className="aero-button rounded px-3 py-1 text-xs mt-auto w-full"
                      onClick={() => openApp(a.appId!)}>Open</button>
                  ) : (
                    <button className="aero-button rounded px-3 py-1 text-xs mt-auto w-full"
                      onClick={() => { installWebApp(a.name, a.url!); blip("notify"); }}>Install</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function InstallerPane({ installWebApp }: { installWebApp: (label: string, url: string) => void }) {
  const [url, setUrl] = useState("https://example.com");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const install = () => {
    let u = url.trim();
    if (!u) { setMsg("Enter a URL"); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    let label = name.trim();
    if (!label) {
      try { label = new URL(u).hostname.replace(/^www\./, ""); } catch { label = "Web App"; }
    }
    installWebApp(label, u);
    setMsg(`Installed "${label}" on your desktop ✓ (icons wrap every 6)`);
    blip("notify");
    setUrl(""); setName("");
  };
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">📥 Installer</h2>
      <p className="text-sm opacity-70 mb-4">Type any website URL to install it as a desktop app. Shortcuts respect the 6-per-column desktop rule.</p>
      <div className="aero-glass-light rounded-lg p-4 max-w-lg space-y-3">
        <div>
          <label className="text-xs opacity-70">Website URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        </div>
        <div>
          <label className="text-xs opacity-70">App name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Auto from domain"
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        </div>
        <button className="aero-button rounded px-4 py-2 w-full" onClick={install}>Install on desktop</button>
        {msg && <div className="text-xs opacity-80">{msg}</div>}
      </div>
      <div className="mt-5 text-xs opacity-70 max-w-lg">
        Tip: some sites refuse to load inside frames (set <code>X-Frame-Options</code>). In that case, the app will offer an "Open in new tab" button.
      </div>
    </div>
  );
}

// ---------- Folder ----------
function FolderApp({ folderIconId, icons, openApp, openWebApp }: {
  folderIconId: string; icons: DesktopIcon[];
  openApp: (id: AppId, fileId?: string) => void;
  openWebApp: (url: string, title: string) => void;
}) {
  const children = icons.filter((i) => i.folderId === folderIconId);
  return (
    <div className="p-4 h-full overflow-auto">
      {children.length === 0
        ? <div className="text-sm opacity-70 text-center p-8">
            This folder is empty.<br/>Right-click it on the desktop → <b>New shortcut here</b> to add a web app.
          </div>
        : <div className="grid grid-cols-5 gap-3">
            {children.map((c) => (
              <div key={c.id}
                onDoubleClick={() => c.appId === "web-app" ? openWebApp(c.webUrl!, c.label) : openApp(c.appId, c.fileId)}
                className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
                <div className="text-4xl">{c.appId === "web-app" ? "🔗" : "📄"}</div>
                <div className="text-xs mt-1 truncate">{c.label}</div>
              </div>
            ))}
          </div>}
    </div>
  );
}

// ---------- Web App frame ----------
function WebAppFrame({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-3 py-1 flex items-center gap-2">
        <span className="opacity-60">🔗</span>
        <span className="truncate flex-1">{url}</span>
        <a href={url} target="_blank" rel="noreferrer" className="aero-button rounded px-2 py-0.5">Open in new tab ↗</a>
      </div>
      <div className="flex-1 relative" style={{ background: "white" }}>
        <iframe src={url} title={url} className="w-full h-full border-0"
          onError={() => setFailed(true)} />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm opacity-70 bg-white">
            This site refused to load in a frame. Use "Open in new tab" above.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- PueiSocial ----------
function PueiSocialApp({ user, users }: { user: string; users: User[] }) {
  const [posts, setPosts] = useState<SocialPost[]>(() => loadSocial());
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ kind: "image" | "video"; src: string } | undefined>();
  useEffect(() => {
    const fn = () => setPosts(loadSocial());
    window.addEventListener("pueios-social", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-social", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);
  const me = users.find((u) => u.name === user);
  const post = () => {
    if (!text.trim() && !media) return;
    blip("click");
    const p: SocialPost = {
      id: `p-${Date.now().toString(36)}`,
      author: user, authorAvatar: me?.avatar || "🧑",
      text, media, at: Date.now(), likes: 0,
    };
    const next = [p, ...posts];
    setPosts(next); saveSocial(next);
    setText(""); setMedia(undefined);
  };
  const like = (id: string) => {
    const next = posts.map((p) => p.id === id ? { ...p, likes: p.likes + 1 } : p);
    setPosts(next); saveSocial(next);
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const kind: "image" | "video" = f.type.startsWith("video") ? "video" : "image";
    const r = new FileReader();
    r.onload = () => setMedia({ kind, src: String(r.result) });
    r.readAsDataURL(f);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar px-4 py-2 flex items-center justify-between">
        <div className="font-bold text-lg flex items-center gap-2">📣 PueiSocial</div>
        <div className="text-xs opacity-70 flex items-center gap-2">
          Available on:
          <span title="iOS">📱 iOS</span>
          <span title="Android">🤖 Android</span>
          <span title="Windows">🪟 Windows</span>
          <span title="macOS"></span>
          <span title="Linux">🐧 Linux</span>
          <span title="AmongOS Linux">🟦 AmongOS Linux</span>
        </div>
      </div>
      <div className="p-4 overflow-auto flex-1 space-y-3" style={{ background: "var(--glass)" }}>
        {/* Composer */}
        <div className="aero-glass-light rounded-xl p-3">
          <div className="flex items-start gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xl"
              style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${me?.color || 200}), oklch(0.45 0.2 ${me?.color || 200}))` }}>
              {me?.avatar?.startsWith("data:") ? <img src={me.avatar} alt="" className="w-full h-full object-cover" /> : (me?.avatar || "🧑")}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder={`What's on your mind, ${user}?`}
              className="flex-1 p-2 rounded outline-none text-sm resize-none"
              style={{ background: "white", color: "#111", minHeight: 60 }} />
          </div>
          {media && (
            <div className="mt-2 relative">
              {media.kind === "image"
                ? <img src={media.src} className="max-h-60 rounded" alt="" />
                : <video src={media.src} controls className="max-h-60 rounded" />}
              <button onClick={() => setMedia(undefined)}
                className="absolute top-1 right-1 aero-button rounded-full w-6 h-6 text-xs">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <label className="aero-button rounded px-3 py-1 text-xs cursor-pointer">
              🖼️ Image / 🎬 Video
              <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
            </label>
            <button className="aero-button rounded px-4 py-1 text-xs ml-auto" onClick={post}>Post</button>
          </div>
        </div>
        {/* Feed */}
        {posts.length === 0 && <div className="text-center text-sm opacity-60 p-6">No posts yet. Be the first!</div>}
        {posts.map((p) => (
          <div key={p.id} className="aero-glass-light rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-lg"
                style={{ background: "var(--gradient-aero)" }}>
                {p.authorAvatar.startsWith("data:") ? <img src={p.authorAvatar} alt="" className="w-full h-full object-cover" /> : p.authorAvatar}
              </div>
              <div>
                <div className="text-sm font-semibold">{p.author}</div>
                <div className="text-[10px] opacity-60">{new Date(p.at).toLocaleString()}</div>
              </div>
            </div>
            {p.text && <div className="text-sm whitespace-pre-wrap mb-2">{p.text}</div>}
            {p.media?.kind === "image" && <img src={p.media.src} className="max-h-80 rounded w-auto" alt="" />}
            {p.media?.kind === "video" && <video src={p.media.src} controls className="max-h-80 rounded w-full" />}
            <div className="flex gap-3 mt-2 text-xs opacity-80">
              <button onClick={() => like(p.id)} className="aero-button rounded px-2 py-0.5">👍 {p.likes}</button>
              <span className="opacity-60 self-center">PueiSocial · cross-platform</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
