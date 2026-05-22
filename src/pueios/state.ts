// PueiOS state types and helpers
export type Theme = {
  accentH: number; // hue
  dark: boolean;
  transparency: boolean;
  animations: boolean;
  wallpaper: WallpaperId;
};

export type WallpaperId = "default" | "bliss" | "aurora" | "sunset";

export type DesktopIcon = {
  id: string;
  label: string;
  appId: AppId;
  x: number;
  y: number;
};

export type AppId =
  | "puei-paint"
  | "pueinet"
  | "puei-messenger"
  | "file-explorer"
  | "settings"
  | "about"
  | "notepad"
  | "calculator";

export type WindowState = {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  prev?: { x: number; y: number; w: number; h: number };
};

export type User = {
  name: string;
  password: string; // demo only
  avatar: string; // emoji
  color: string;
};

export const DEFAULT_USERS: User[] = [
  { name: "Pueian Rosos", password: "", avatar: "🧑‍💻", color: "200" },
  { name: "Guest", password: "", avatar: "👤", color: "180" },
  { name: "Admin", password: "puei", avatar: "🛡️", color: "260" },
];

const KEY = "pueios2-state-v1";
export type Persisted = {
  theme: Theme;
  icons: DesktopIcon[];
  lastUser?: string;
  remember?: boolean;
};

export const defaultTheme: Theme = {
  accentH: 200,
  dark: false,
  transparency: true,
  animations: true,
  wallpaper: "default",
};

export const defaultIcons: DesktopIcon[] = [
  { id: "i-fe", label: "Computer", appId: "file-explorer", x: 0, y: 0 },
  { id: "i-paint", label: "Puei Paint 2", appId: "puei-paint", x: 0, y: 1 },
  { id: "i-net", label: "PueiNet", appId: "pueinet", x: 0, y: 2 },
  { id: "i-msg", label: "Puei Messenger", appId: "puei-messenger", x: 0, y: 3 },
  { id: "i-set", label: "Settings", appId: "settings", x: 0, y: 4 },
  { id: "i-note", label: "Notepad", appId: "notepad", x: 0, y: 5 },
  { id: "i-calc", label: "Calculator", appId: "calculator", x: 0, y: 6 },
  { id: "i-about", label: "About PueiOS", appId: "about", x: 0, y: 7 },
];

export function loadState(): Persisted {
  if (typeof window === "undefined") return { theme: defaultTheme, icons: defaultIcons };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { theme: defaultTheme, icons: defaultIcons };
    const p = JSON.parse(raw);
    return {
      theme: { ...defaultTheme, ...(p.theme || {}) },
      icons: p.icons?.length ? p.icons : defaultIcons,
      lastUser: p.lastUser,
      remember: p.remember,
    };
  } catch {
    return { theme: defaultTheme, icons: defaultIcons };
  }
}

export function saveState(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

// Audio: tiny synthesized blips so we don't ship audio files
let audioCtx: AudioContext | null = null;
export function blip(kind: "start" | "click" | "hover" | "notify" | "error" | "shutdown") {
  if (typeof window === "undefined") return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const notes: Record<string, number[]> = {
      start: [523, 659, 784, 1046],
      click: [880],
      hover: [1200],
      notify: [880, 1175],
      error: [220, 196],
      shutdown: [784, 523, 392],
    };
    notes[kind].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "error" ? "sawtooth" : "sine";
      osc.frequency.value = freq;
      const t = now + i * (kind === "start" ? 0.12 : 0.08);
      const dur = kind === "hover" ? 0.04 : 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(kind === "hover" ? 0.04 : 0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  } catch {}
}
