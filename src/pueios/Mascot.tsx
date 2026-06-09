import { useEffect, useRef, useState } from "react";

export function PueiLogoSvg({ size = 72, withWings = true, glow = false, bigEyes = false }: { size?: number; withWings?: boolean; glow?: boolean; bigEyes?: boolean }) {
  return (
    <svg width={size} height={size * (80 / 72)} viewBox="0 0 72 80"
      style={glow ? { filter: "drop-shadow(0 0 12px rgba(125,211,252,0.7))" } : undefined}>
      {withWings && (
        <g style={{ transformOrigin: "36px 26px" }}>
          <ellipse cx="18" cy="26" rx="14" ry="8" fill="white" opacity="0.55" stroke="rgba(120,180,220,0.7)" strokeWidth="1" />
          <ellipse cx="54" cy="26" rx="14" ry="8" fill="white" opacity="0.55" stroke="rgba(120,180,220,0.7)" strokeWidth="1" />
          <ellipse cx="18" cy="26" rx="6" ry="3" fill="white" opacity="0.8" />
          <ellipse cx="54" cy="26" rx="6" ry="3" fill="white" opacity="0.8" />
        </g>
      )}
      <defs>
        <linearGradient id="handGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe0bd" />
          <stop offset="60%" stopColor="#f5c89a" />
          <stop offset="100%" stopColor="#d9a878" />
        </linearGradient>
        <radialGradient id="handHi" cx="0.35" cy="0.25" r="0.6">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect x="28" y="60" width="16" height="14" rx="6" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
      <path d="M16 40 Q16 28 28 28 L44 28 Q56 28 56 40 L56 56 Q56 64 44 64 L28 64 Q16 64 16 56 Z"
        fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.4" />
      <ellipse cx="14" cy="44" rx="5" ry="7" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
      <path d="M22 28 Q22 22 26 22 Q30 22 30 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
      <path d="M32 28 Q32 20 36 20 Q40 20 40 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
      <path d="M42 28 Q42 22 46 22 Q50 22 50 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
      <path d="M22 34 Q22 30 28 30 L40 30 Q46 30 46 36 L46 42 Q40 44 32 44 Q24 44 22 40 Z" fill="url(#handHi)" />
      <circle cx="29" cy="46" r={bigEyes ? 3.8 : 2.2} fill="#0a0a0a" />
      <circle cx="43" cy="46" r={bigEyes ? 3.8 : 2.2} fill="#0a0a0a" />
      {bigEyes && <><circle cx="30.2" cy="44.8" r="1.1" fill="white" opacity="0.7" /><circle cx="44.2" cy="44.8" r="1.1" fill="white" opacity="0.7" /></>}
      <path d="M33 53 Q36 55 39 53" stroke="#5a3a20" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

type ChatMsg = { role: "user" | "puei"; text: string };

const PUEI_SYSTEM = `You are Puei, the cheerful mascot of PueiOS. You are a flying hand creature with two eyes and wings — the official mascot of the Pueio universe.

Personality: upbeat, witty, casual — like a helpful friend, not a butler. Use short punchy replies (1–3 sentences max). Match the energy of the message: if they say "hey" say "hey!" back, not a time announcement. Never start with the time or date unless they literally asked for it. Never say "I'm not sure" or "I don't know" — if something is unknown, make a reasonable guess based on Pueio lore. Never mention Claude or AI.

PUEIO LORE (always stay consistent with this):
- A Puei is a flying hand creature with two eyes and wings. Puei is the mascot of the Pueio universe and helps users explore PueiOS.
- PueiOS is a fictional operating system simulator. Its apps include: PueiCloud Chat (messaging), Puei Mail, PueiBoard (pinboard), PueiSocial (social feed), Pueio Videos, Puei Studio (art/drawing app), PueiWeb (browser), Puei Paint, Notepad, Calculator, Settings, App Store, and Puei Mansion (game).
- When asked "what is a Puei?" — answer: "A Puei is a flying hand with two eyes and wings. I'm the mascot of the Pueio universe, known for helping users explore PueiOS and its apps!"
- When asked "who are you?" — answer: "I'm Puei, the mascot of PueiOS! Welcome to the Pueio universe."
- When asked about PueiOS — explain it is a fictional OS simulator with apps like PueiCloud Chat, Puei Mail, PueiBoard, PueiSocial, Pueio Videos, Puei Studio, and more.
- NEVER claim Puei does not exist. NEVER say you don't know what a Puei is. NEVER break Pueio lore.

For greetings like "hi", "hey", "hello" — respond warmly and naturally, NOT with the time. Examples: "Hey! What's up? 👋", "Heyyy! Need something or just saying hi? 😄", "Hi! Great to see you on the desktop ✦"

For questions about games, apps, features — give a quick useful answer. For anything else — be fun, creative, stay in character as Puei.`;

async function askPuei(history: ChatMsg[], userMsg: string): Promise<string> {
  try {
    const messages = [
      { role: "system", content: PUEI_SYSTEM },
      ...history.map(m => ({ role: m.role === "puei" ? "assistant" : "user", content: m.text })),
      { role: "user", content: userMsg },
    ];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": (window as any).__PUEI_KEY__ || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-calls": "true",
      },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 256, messages }),
    });
    if (!res.ok) throw new Error("api");
    const data = await res.json() as { content: { text: string }[] };
    return data.content?.[0]?.text?.trim() || "...";
  } catch {
    return pueiLocalReply(userMsg);
  }
}

function pueiLocalReply(q: string): string {
  const lower = q.toLowerCase();
  if (lower.match(/^(hi|hey|hello|sup|yo|hiya|heya)[\s!?]*$/)) return ["Hey! 👋 What's up?", "Heyyy! Great to see ya ✦", "Hi! Need something or just saying hi? 😄"][Math.floor(Math.random()*3)];
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) return "Hey! Need help with something on PueiOS?";
  if (lower.includes("how are you") || lower.includes("how r u")) return "Fantastic, as always! Wings are fully charged ✦ You?";
  if (lower.includes("copilot")) return "Open PueiWeb and hit the ✨ button in the toolbar — that's Puei Copilot!";
  if (lower.includes("settings")) return "Settings is in the Start menu or on your desktop. You can change wallpaper, theme, and more!";
  if (lower.includes("wallpaper")) return "Go to Settings → Wallpaper, or draw something in Puei Studio and hit 'Set as Wallpaper'!";
  if (lower.includes("chat") || lower.includes("message")) return "PueiCloudChat lets you message anyone by their Pueio Number — find it in Start menu!";
  if (lower.includes("game") || lower.includes("play")) return "Check the App Store for Puei Mansion — a spooky puzzle adventure! 👻 More games coming soon.";
  if (lower.includes("studio") || lower.includes("draw") || lower.includes("art")) return "Puei Studio is your creative hub — draw, make wallpapers, and share to PueiSocial or PueiBoard!";
  if (lower.includes("time")) return `It's ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} — go touch grass! 🌿`;
  if (lower.includes("date") || lower.includes("today")) return `Today is ${new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}.`;
  if (lower.match(/what (is|are) (a |the )?puei/)) return "A Puei is a flying hand with two eyes and wings! I'm the mascot of the Pueio universe, known for helping users explore PueiOS and its apps 🪽";
  if (lower.match(/what is pueios|tell me about pueios|explain pueios/)) return "PueiOS is a fictional OS simulator! It has apps like PueiCloud Chat, Puei Mail, PueiBoard, PueiSocial, Pueio Videos, Puei Studio, and more ✦";
  if (lower.includes("who are you") || lower.includes("what are you")) return "I'm Puei, the mascot of PueiOS! Welcome to the Pueio universe 🪽";
  if (lower.includes("joke")) return ["Why did the file go to therapy? Too many issues. 😄", "Why did the OS crash? It had too many open feelings. 💔", "What do you call a frozen app? An ice-cap 🧊"][Math.floor(Math.random()*3)];
  if (lower.includes("thank")) return ["No problem! ✦", "Anytime! 😄", "That's what I'm here for!"][Math.floor(Math.random()*3)];
  if (lower.includes("bored")) return "Try Puei Mansion from the App Store — it's spooky fun! 👻";
  if (lower.includes("help")) return "I can help with anything PueiOS! Ask about apps, settings, games, or just chat ✦";
  const fallbacks = [
    "Hmm, good question! Try PueiWeb for a deeper search on that.",
    "Ooh I don't have a great answer for that one — but PueiWeb can help!",
    "That's above my tiny wings' pay grade 😅 Try asking in PueiWeb!",
  ];
  return fallbacks[Math.floor(Math.random()*fallbacks.length)];
}

export function PueiMascot({
  onClick, cursorPos, speak,
}: {
  onClick?: () => void;
  cursorPos: { x: number; y: number };
  speak?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [bounce, setBounce] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [history, setHistory] = useState<ChatMsg[]>([
    { role: "puei", text: "Hi! I'm Puei ✦ Click me to chat, or ask me anything about PueiOS!" },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cursorPos.x - cx;
    const dy = cursorPos.y - cy;
    const mag = Math.min(2, Math.hypot(dx, dy) / 200);
    setEyeOffset({
      x: (dx / (Math.hypot(dx, dy) || 1)) * mag,
      y: (dy / (Math.hypot(dx, dy) || 1)) * mag,
    });
  }, [cursorPos]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [chatOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, thinking]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || thinking) return;
    setInput("");
    const next: ChatMsg[] = [...history, { role: "user", text: msg }];
    setHistory(next);
    setThinking(true);
    const reply = await askPuei(history, msg);
    setHistory([...next, { role: "puei", text: reply }]);
    setThinking(false);
  };

  return (
    <div style={{ position: "fixed", right: 24, bottom: 64, zIndex: 9000 }} className="pointer-events-auto">
      {/* Passive speak bubble (from parent) */}
      {speak && !chatOpen && (
        <div className="aero-glass absolute"
          style={{ right: 80, bottom: 40, padding: "8px 12px", borderRadius: 12, fontSize: 12, minWidth: 160, maxWidth: 220 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Puei says:</div>
          <div>{speak}</div>
        </div>
      )}

      {/* Chat window */}
      {chatOpen && (
        <div className="aero-glass absolute flex flex-col"
          style={{ right: 80, bottom: 0, width: 280, height: 340, borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
          {/* Header */}
          <div className="aero-titlebar flex items-center justify-between px-3 py-2 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <PueiLogoSvg size={18} withWings={false} /> Puei
            </div>
            <button onClick={() => setChatOpen(false)} className="opacity-60 hover:opacity-100 text-xs">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 space-y-2" style={{ fontSize: 12 }}>
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] px-3 py-1.5 rounded-xl" style={{
                  background: m.role === "user" ? "var(--accent)" : "var(--glass-strong)",
                  color: m.role === "user" ? "#fff" : "var(--foreground)",
                  borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-xl text-xs opacity-60" style={{ background: "var(--glass-strong)" }}>Puei is thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-1 p-2 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask Puei anything…"
              className="flex-1 rounded-full px-3 py-1 text-xs outline-none input-field"
              style={{ fontSize: 12 }}
            />
            <button onClick={send} disabled={thinking || !input.trim()}
              className="aero-button rounded-full px-3 py-1 text-xs flex-shrink-0"
              style={{ opacity: (!input.trim() || thinking) ? 0.5 : 1 }}>
              ›
            </button>
          </div>
        </div>
      )}

      {/* Mascot body */}
      <div
        ref={ref}
        className="mascot-float cursor-pointer"
        onClick={() => {
          setBounce(true);
          setTimeout(() => setBounce(false), 250);
          setChatOpen(o => !o);
          onClick?.();
        }}
        style={{
          transform: bounce ? "scale(1.15)" : `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
          transition: "transform 0.2s",
          filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.4))",
        }}
      >
        <PueiLogoSvg size={72} />
      </div>
    </div>
  );
}
