import { useEffect, useRef, useState } from "react";
import type { AppId, Theme, WallpaperId } from "./state";
import { blip } from "./state";

export function AppRenderer({
  appId, theme, setTheme, openApp, wallpaper, setWallpaper, currentUser,
}: {
  appId: AppId;
  theme: Theme;
  setTheme: (t: Theme) => void;
  openApp: (id: AppId) => void;
  wallpaper: WallpaperId;
  setWallpaper: (w: WallpaperId) => void;
  currentUser: string;
}) {
  switch (appId) {
    case "settings": return <SettingsApp theme={theme} setTheme={setTheme} wallpaper={wallpaper} setWallpaper={setWallpaper} openApp={openApp} />;
    case "about": return <AboutApp />;
    case "notepad": return <NotepadApp />;
    case "calculator": return <CalculatorApp />;
    case "puei-paint": return <PaintApp />;
    case "pueinet": return <PueiNetApp />;
    case "puei-messenger": return <MessengerApp user={currentUser} />;
    case "file-explorer": return <FileExplorerApp openApp={openApp} />;
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
          <div key={k}
            onClick={() => { setTab(k); blip("click"); }}
            className="px-3 py-2 rounded-md cursor-pointer text-sm mb-1"
            style={{
              background: tab === k ? "var(--gradient-aero)" : "transparent",
              color: tab === k ? "white" : "inherit",
              boxShadow: tab === k ? "inset 0 1px 0 rgba(255,255,255,0.4)" : undefined,
            }}>
            {l}
          </div>
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
          <div>
            <h2 className="text-xl font-semibold mb-4">Touchscreen</h2>
            <p className="text-sm opacity-80">Hold for <b>0.6s</b> to trigger right-click. Drag windows by their title bar. Multi-touch supported.</p>
          </div>
        )}
        {tab === "accessibility" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Accessibility</h2>
            <p className="text-sm opacity-80">High-contrast modes coming soon. Reduce motion via the Animations toggle on Personalize.</p>
          </div>
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
          <div>
            <button className="aero-button rounded-md px-4 py-2" onClick={() => openApp("about")}>Open About PueiOS →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutApp() {
  return (
    <div className="p-8 text-center">
      <div className="boot-logo inline-block text-7xl mb-4">✦</div>
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

function NotepadApp() {
  const [text, setText] = useState("Welcome to Puei Notepad.\n\nType anything...");
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-2 py-1">File · Edit · Format · View · Help</div>
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

function PaintApp() {
  const cv = useRef<HTMLCanvasElement>(null);
  const draw = useRef(false);
  const [color, setColor] = useState("#1ea8ff");
  const [size, setSize] = useState(4);
  useEffect(() => {
    const c = cv.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  const start = (e: React.PointerEvent) => {
    draw.current = true;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!; ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const move = (e: React.PointerEvent) => {
    if (!draw.current) return;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  };
  const end = () => { draw.current = false; };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex gap-2 px-2 py-1 items-center text-xs">
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
  const fakeSites: Record<string, JSX.Element> = {
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

function MessengerApp({ user }: { user: string }) {
  const contacts = [
    { name: "Pueian Rosos", status: "Online", emoji: "🟢" },
    { name: "Pueian Pueiescu", status: "Away", emoji: "🟡" },
    { name: "Pueian Lemne", status: "Busy", emoji: "🔴" },
    { name: "Puei Bot", status: "Online", emoji: "🟢" },
  ];
  const [active, setActive] = useState(0);
  const [msgs, setMsgs] = useState<{ from: string; text: string }[]>([
    { from: "Pueian Rosos", text: "hi! welcome to puei messenger ✨" },
  ]);
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    blip("click");
    setMsgs([...msgs, { from: user, text }]);
    const reply = ["lol", "ok :)", "brb", "have you tried turning Aero off and on?", "puei sends his regards"][Math.floor(Math.random() * 5)];
    setTimeout(() => setMsgs((m) => [...m, { from: contacts[active].name, text: reply }]), 700 + Math.random() * 800);
    setText("");
  };
  return (
    <div className="flex h-full">
      <div className="w-48 border-r overflow-auto" style={{ background: "var(--glass)" }}>
        {contacts.map((c, i) => (
          <div key={c.name} onClick={() => setActive(i)}
            className="px-3 py-2 cursor-pointer text-sm"
            style={{ background: active === i ? "var(--gradient-aero)" : "transparent", color: active === i ? "white" : undefined }}>
            <div>{c.emoji} {c.name}</div>
            <div className="text-xs opacity-70">{c.status}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="aero-titlebar px-3 py-1.5 text-sm font-semibold">{contacts[active].name}</div>
        <div className="flex-1 p-3 overflow-auto space-y-2 text-sm">
          {msgs.map((m, i) => (
            <div key={i} className={m.from === user ? "text-right" : "text-left"}>
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
            placeholder="Type a message..." />
          <button className="aero-button rounded-md px-3" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  );
}

function FileExplorerApp({ openApp }: { openApp: (id: AppId) => void }) {
  const folders = [
    { name: "Documents", icon: "📁" },
    { name: "Pictures", icon: "🖼️" },
    { name: "Music", icon: "🎵" },
    { name: "Downloads", icon: "⬇️" },
    { name: "PueiNet Bookmarks", icon: "🌐" },
  ];
  const apps: { name: string; appId: AppId; icon: string }[] = [
    { name: "Puei Paint 2", appId: "puei-paint", icon: "🎨" },
    { name: "Notepad", appId: "notepad", icon: "📝" },
    { name: "Calculator", appId: "calculator", icon: "🧮" },
    { name: "Settings", appId: "settings", icon: "⚙️" },
  ];
  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r text-sm" style={{ background: "var(--glass)" }}>
        <div className="font-semibold mb-2 opacity-70 text-xs">FAVORITES</div>
        {["Desktop", "Documents", "Recent"].map((s) => (
          <div key={s} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer">📌 {s}</div>
        ))}
        <div className="font-semibold mt-3 mb-2 opacity-70 text-xs">COMPUTER</div>
        {["C:\\ PueiDrive", "D:\\ Data"].map((s) => (
          <div key={s} className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer">💽 {s}</div>
        ))}
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-xs opacity-70 mb-3">Computer › PueiDrive › Users › {/* shown */}You</div>
        <div className="grid grid-cols-5 gap-3">
          {folders.map((f) => (
            <div key={f.name} className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
              <div className="text-4xl">{f.icon}</div>
              <div className="text-xs mt-1">{f.name}</div>
            </div>
          ))}
          {apps.map((a) => (
            <div key={a.appId} onDoubleClick={() => openApp(a.appId)} onClick={() => blip("hover")}
              className="text-center p-2 rounded hover:bg-white/30 cursor-pointer">
              <div className="text-4xl">{a.icon}</div>
              <div className="text-xs mt-1">{a.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
