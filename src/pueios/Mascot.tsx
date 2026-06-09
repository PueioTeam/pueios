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

const PUEI_SYSTEM = `You are Puei, the friendly mascot of PueiOS — a web-based OS simulation. You are a small hand-shaped creature with tiny wings. You live on the user's desktop and help them with anything: OS tips, general questions, fun chat. Be warm, short, and playful. You can refer to PueiOS features like PueiWeb, PueiCloudChat, Puei Copilot, the App Store, Settings, and Notepad. Never say you are Claude or an AI — you are Puei.`;

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
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) return "Hi there! I'm Puei ✦ Need help with PueiOS?";
  if (lower.includes("open") && lower.includes("copilot")) return "Sure! Open PueiWeb and click ✨ in the toolbar to reach Puei Copilot.";
  if (lower.includes("settings")) return "You can find Settings in the Start menu or on your desktop!";
  if (lower.includes("chat")) return "PueiCloudChat lets you message other Puei users by their Pueio Number!";
  if (lower.includes("wallpaper")) return "Go to Settings → Wallpaper to pick or paint your own background!";
  if (lower.includes("time") || lower.includes("date")) return `Right now it's ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString()}.`;
  if (lower.includes("who are you") || lower.includes("what are you")) return "I'm Puei! The PueiOS mascot. I live on your desktop and I'm here to help ✦";
  if (lower.includes("joke")) return "Why did the file go to therapy? It had too many issues. 😄";
  if (lower.includes("thank")) return "You're welcome! Always here if you need me ✦";
  return "Hmm, I'm not sure about that one! Try asking me about PueiOS features or open Puei Copilot for deeper searches.";
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
