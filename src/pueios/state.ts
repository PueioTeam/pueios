// PueiOS state types and helpers
export type Theme = {
  accentH: number;
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
  fileId?: string;
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
  fileId?: string;
  prev?: { x: number; y: number; w: number; h: number };
};

export type User = {
  name: string;
  password: string;
  avatar: string;
  color: string;
};

export type SavedFile = {
  id: string;
  name: string;
  type: "text" | "image";
  content: string;
  updatedAt: number;
};

export const DEFAULT_USERS: User[] = [
  { name: "Pueian Rosos", password: "", avatar: "🧑‍💻", color: "200" },
];

// Max 6 icons per vertical column on the desktop
export const ICONS_PER_COL = 6;

const KEY = "pueios2-state-v1";
const FILES_KEY = "pueios2-files-v1";
const CHAT_KEY = "pueios2-chat-v1";

export type ChatMessage = {
  id: string;
  from: string;
  to: string; // user name or "all"
  text: string;
  at: number;
};

export type Persisted = {
  theme: Theme;
  icons: DesktopIcon[];
  users: User[];
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
  { id: "i-fe", label: "Computer", appId: "file-explorer" },
  { id: "i-paint", label: "Puei Paint 2", appId: "puei-paint" },
  { id: "i-net", label: "PueiNet", appId: "pueinet" },
  { id: "i-msg", label: "Puei Messenger", appId: "puei-messenger" },
  { id: "i-set", label: "Settings", appId: "settings" },
  { id: "i-note", label: "Notepad", appId: "notepad" },
  { id: "i-calc", label: "Calculator", appId: "calculator" },
  { id: "i-about", label: "About PueiOS", appId: "about" },
];

export function iconGridPos(index: number) {
  return { col: Math.floor(index / ICONS_PER_COL), row: index % ICONS_PER_COL };
}

export function loadState(): Persisted {
  if (typeof window === "undefined")
    return { theme: defaultTheme, icons: defaultIcons, users: DEFAULT_USERS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { theme: defaultTheme, icons: defaultIcons, users: DEFAULT_USERS };
    const p = JSON.parse(raw);
    return {
      theme: { ...defaultTheme, ...(p.theme || {}) },
      icons: p.icons?.length ? p.icons : defaultIcons,
      users: p.users?.length ? p.users : DEFAULT_USERS,
      lastUser: p.lastUser,
      remember: p.remember,
    };
  } catch {
    return { theme: defaultTheme, icons: defaultIcons, users: DEFAULT_USERS };
  }
}

export function saveState(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

// ---- Files
export function loadFiles(): SavedFile[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FILES_KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveFiles(files: SavedFile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
    window.dispatchEvent(new CustomEvent("pueios-files-changed"));
  } catch {}
}
export function upsertFile(f: SavedFile) {
  const all = loadFiles();
  const i = all.findIndex((x) => x.id === f.id);
  if (i >= 0) all[i] = f; else all.push(f);
  saveFiles(all);
  return f;
}
export function deleteFile(id: string) {
  saveFiles(loadFiles().filter((f) => f.id !== id));
}
export function getFile(id: string) {
  return loadFiles().find((f) => f.id === id);
}

// ---- Chat (cross-tab + persisted log)
export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); } catch { return []; }
}
export function appendChat(m: ChatMessage) {
  const all = loadChat();
  all.push(m);
  // cap log
  const trimmed = all.slice(-500);
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("pueios-chat", { detail: m }));
  } catch {}
}

// Audio
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
