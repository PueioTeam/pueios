// PueiOS 2 state types and helpers
export type Theme = {
  accentH: number;
  dark: boolean;
  transparency: boolean;
  animations: boolean;
  wallpaper: WallpaperId;
  highContrast: boolean;
};

// Trusted domains for the Installer (closed-ecosystem rule)
export const TRUSTED_DOMAINS = [".lovable.app", ".base44.app"] as const;
export type TrustedKind = "lovable" | "base44" | null;
export function classifyTrustedUrl(raw: string): { ok: boolean; kind: TrustedKind; url?: string; host?: string; reason?: string } {
  let u = raw.trim();
  if (!u) return { ok: false, kind: null, reason: "Empty URL" };
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return { ok: false, kind: null, reason: "Only https:// URLs are trusted" };
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".lovable.app")) return { ok: true, kind: "lovable", url: u, host };
    if (host.endsWith(".base44.app")) return { ok: true, kind: "base44", url: u, host };
    return { ok: false, kind: null, host, reason: "Untrusted domain. PueiOS 2 only installs apps from *.lovable.app or *.base44.app." };
  } catch {
    return { ok: false, kind: null, reason: "Invalid URL" };
  }
}

// Brand icons for trusted-domain installs (data URIs, no network)
const LOVABLE_ICON =
  "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#ff6aa9'/><stop offset='1' stop-color='#7b3bff'/>
  </linearGradient></defs>
  <rect width='64' height='64' rx='14' fill='url(#g)'/>
  <path fill='#fff' d='M32 50s-15-9-15-21a9 9 0 0 1 15-6 9 9 0 0 1 15 6c0 12-15 21-15 21z'/>
</svg>`);
const BASE44_ICON =
  "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0' stop-color='#22d3ee'/><stop offset='1' stop-color='#2563eb'/>
  </linearGradient></defs>
  <rect width='64' height='64' rx='14' fill='url(#g)'/>
  <text x='32' y='40' font-family='Segoe UI,system-ui,sans-serif' font-size='22' font-weight='800' fill='#fff' text-anchor='middle'>44</text>
</svg>`);
export function trustedIconFor(kind: TrustedKind): string | undefined {
  if (kind === "lovable") return LOVABLE_ICON;
  if (kind === "base44") return BASE44_ICON;
  return undefined;
}

// Wallpapers: built-ins or "custom:<fileId>" referencing a saved Paint image
export type WallpaperId = "default" | "bliss" | "aurora" | "sunset" | string;

export type DesktopIcon = {
  id: string;
  label: string;
  appId: AppId;
  fileId?: string;
  webUrl?: string;        // for installed web apps
  iconEmoji?: string;     // optional override icon (emoji)
  iconUrl?: string;       // optional override icon (image url, e.g. google favicon)
  folderId?: string;      // if set, lives inside this folder icon (folder appId)
};

export function pueiNumberFor(name: string): string {
  // Deterministic 9-digit PueiNumber derived from the account name
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  const n = Math.abs(h) % 900000000 + 100000000;
  const s = String(n);
  return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6,9)}`;
}

export function googleFaviconFor(url: string, size = 64): string {
  try {
    const u = url.startsWith("http") ? url : "https://" + url;
    const host = new URL(u).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  } catch {
    return "";
  }
}

export type AppId =
  | "puei-paint"
  | "pueinet"
  | "puei-messenger"
  | "file-explorer"
  | "settings"
  | "about"
  | "notepad"
  | "calculator"
  | "app-store"
  | "puei-social"
  | "folder"
  | "web-app";

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
  webUrl?: string;
  folderIconId?: string;
  prev?: { x: number; y: number; w: number; h: number };
};

export type User = {
  name: string;
  password: string;
  avatar: string; // emoji OR data URL
  color: string;
  pueiNumber?: string; // assigned at account creation; visible in Messenger settings
};

export type SavedFile = {
  id: string;
  name: string;
  type: "text" | "image";
  content: string;
  updatedAt: number;
};

export type SocialPost = {
  id: string;
  author: string;
  authorAvatar: string;
  text: string;
  media?: { kind: "image" | "video"; src: string };
  at: number;
  likes: number;
};

// Max 6 icons per vertical column on the desktop
export const ICONS_PER_COL = 6;

const KEY = "pueios2-state-v2";
const FILES_KEY = "pueios2-files-v1";
const CHAT_KEY = "pueios2-chat-v1";
const SOCIAL_KEY = "pueios2-social-v1";

export type ChatMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  at: number;
};

export type Persisted = {
  installed: boolean;
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
  { id: "i-store", label: "App Store", appId: "app-store" },
  { id: "i-social", label: "PueiSocial", appId: "puei-social" },
  { id: "i-paint", label: "Puei Paint 2", appId: "puei-paint" },
  { id: "i-net", label: "PueiNet", appId: "pueinet" },
  { id: "i-msg", label: "Puei Messenger", appId: "puei-messenger" },
  { id: "i-set", label: "Settings", appId: "settings" },
  { id: "i-note", label: "Notepad", appId: "notepad" },
  { id: "i-calc", label: "Calculator", appId: "calculator" },
  { id: "i-about", label: "About PueiOS 2", appId: "about" },
];

export function iconGridPos(index: number) {
  return { col: Math.floor(index / ICONS_PER_COL), row: index % ICONS_PER_COL };
}

export function loadState(): Persisted {
  const base: Persisted = { installed: false, theme: defaultTheme, icons: defaultIcons, users: [] };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw);
    return {
      installed: !!p.installed,
      theme: { ...defaultTheme, ...(p.theme || {}) },
      icons: p.icons?.length ? p.icons : defaultIcons,
      users: Array.isArray(p.users) ? p.users : [],
      lastUser: p.lastUser,
      remember: p.remember,
    };
  } catch {
    return base;
  }
}

export function saveState(p: Persisted) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// ---- Files
export function loadFiles(): SavedFile[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FILES_KEY) || "[]"); } catch { return []; }
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

// ---- Chat
export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); } catch { return []; }
}
export function appendChat(m: ChatMessage) {
  const all = loadChat(); all.push(m);
  const trimmed = all.slice(-500);
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("pueios-chat", { detail: m }));
  } catch {}
}

// ---- Social
export function loadSocial(): SocialPost[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SOCIAL_KEY) || "[]"); } catch { return []; }
}
export function saveSocial(posts: SocialPost[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(posts.slice(0, 200)));
    window.dispatchEvent(new CustomEvent("pueios-social"));
  } catch {}
}

// ---- Audio
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
