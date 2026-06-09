// PueiOS 2 state types and helpers
export type SystemVersion = "PueiOS 2" | "PueiOS 2+" | "PueiOS 3";
export const SYSTEM_ORDER: SystemVersion[] = ["PueiOS 2", "PueiOS 2+", "PueiOS 3"];
export function compareVersion(a: SystemVersion, b: SystemVersion): number {
  return SYSTEM_ORDER.indexOf(a) - SYSTEM_ORDER.indexOf(b);
}

export type Theme = {
  accentH: number;
  dark: boolean;
  transparency: boolean;
  fullWindowTransparency: boolean;
  animations: boolean;
  wallpaper: WallpaperId;
  highContrast: boolean;
  highContrastColor: string; // hex
  iconSize: "small" | "medium" | "large";
  win7Aero: boolean;
  glassOpacity: number;
  glassBlur: number;
  glassSaturation: number;
  aeroGlow: number;
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

// PueiWeb only allows base44.app (per spec). Returns ok or rejection.
export function classifyWebUrl(raw: string): { ok: boolean; url?: string; reason?: string } {
  let u = raw.trim();
  if (!u) return { ok: false, reason: "Empty URL" };
  if (u.startsWith("puei://")) return { ok: true, url: u };
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".base44.app")) return { ok: true, url: u };
    return { ok: false, reason: "This website is not trusted by Pueios2." };
  } catch {
    return { ok: false, reason: "This website is not trusted by Pueios2." };
  }
}

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

export type WallpaperId = "default" | "bliss" | "aurora" | "sunset" | string;

export type DesktopIcon = {
  id: string;
  label: string;
  appId: AppId;
  fileId?: string;
  webUrl?: string;
  iconEmoji?: string;
  iconUrl?: string;
  folderId?: string;
  col?: number;
  row?: number;
};

export function pueiNumberFor(name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  const n = Math.abs(h) % 900000000 + 100000000;
  const s = String(n);
  return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6,9)}`;
}

export function googleFaviconFor(url: string, size = 64): string {
  try {
    const u = url.startsWith("http") ? url : "https://" + url;
    return `https://www.google.com/s2/favicons?sz=${size}&domain_url=${encodeURIComponent(u)}`;
  } catch {
    return "";
  }
}

export type AppId =
  | "puei-paint"
  | "puei-board"
  | "pueinet"
  | "puei-cloud-chat"
  | "puei-studio"
  | "file-explorer"
  | "settings"
  | "about"
  | "notepad"
  | "calculator"
  | "app-store"
  | "puei-social"
  | "folder"
  | "web-app"
  | "recycle-bin"
  | "chess"
  | "puei-mansion";

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

export type FriendRequest = {
  fromPueiNumber: string;
  fromName: string;
  at: number;
};

export type User = {
  name: string;
  password: string;
  avatar: string;
  color: string;
  pueiNumber?: string;
  friends?: string[];
  pendingRequests?: FriendRequest[];
  noPassword?: boolean;        // chose "I don't have a password"
  limitedMode?: boolean;       // reduced security features
};

const DIRECTORY_KEY = "pueios2-directory-v1";
export type DirectoryEntry = { pueiNumber: string; name: string; avatar: string; color: string };
export function loadDirectory(): DirectoryEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "[]"); } catch { return []; }
}
export function saveDirectory(entries: DirectoryEntry[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DIRECTORY_KEY, JSON.stringify(entries)); } catch {}
}
export function registerInDirectory(u: User) {
  if (!u.pueiNumber) return;
  const dir = loadDirectory();
  const i = dir.findIndex((e) => e.pueiNumber === u.pueiNumber);
  const entry: DirectoryEntry = { pueiNumber: u.pueiNumber, name: u.name, avatar: u.avatar, color: u.color };
  if (i >= 0) dir[i] = entry; else dir.push(entry);
  saveDirectory(dir);
}
export function lookupPueiNumber(num: string): DirectoryEntry | undefined {
  const cleaned = num.replace(/\s/g, "");
  return loadDirectory().find((e) => e.pueiNumber === cleaned);
}

export type SavedFile = {
  id: string;
  name: string;
  type: "text" | "image";
  content: string;
  updatedAt: number;
  folder?: string; // user folder id (DesktopIcon.id for type=folder)
  owner?: string;  // username who created this file
};

export type RecycleEntry = SavedFile & { deletedAt: number; originalFolder?: string };

export type SocialComment = {
  id: string;
  author: string;
  authorAvatar: string;
  text: string;
  at: number;
};

export type SocialPost = {
  id: string;
  author: string;
  authorAvatar: string;
  text: string;
  media?: { kind: "image" | "video"; src: string };
  at: number;
  likes: number;
  likedBy?: string[];
  comments?: SocialComment[];
};

export const ICONS_PER_COL = 6;

const KEY = "pueios2-state-v3";
const FILES_KEY = "pueios2-files-v1";
const CHAT_KEY = "pueios2-chat-v1";
const SOCIAL_KEY = "pueios2-social-v1";
const RECYCLE_KEY = "pueios2-recycle-v1";
const DELETED_FILE_IDS_KEY = "pueios2-deleted-file-ids-v1";

export function loadDeletedFileIds(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(DELETED_FILE_IDS_KEY) || "[]"); } catch { return []; }
}
export function markFileDeletedForever(id: string) {
  if (typeof window === "undefined") return;
  const all = new Set(loadDeletedFileIds());
  all.add(id);
  try { localStorage.setItem(DELETED_FILE_IDS_KEY, JSON.stringify(Array.from(all))); } catch {}
}
export function unmarkFileDeletedForever(id: string) {
  if (typeof window === "undefined") return;
  const all = new Set(loadDeletedFileIds());
  if (!all.has(id)) return;
  all.delete(id);
  try { localStorage.setItem(DELETED_FILE_IDS_KEY, JSON.stringify(Array.from(all))); } catch {}
}

export type ChatMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  at: number;
};

export type Persisted = {
  installed: boolean;
  systemVersion: SystemVersion;
  theme: Theme;
  icons: DesktopIcon[];
  users: User[];
  lastUser?: string;
  remember?: boolean;
};

export const defaultTheme: Theme = {
  accentH: 210,
  dark: false,
  transparency: true,
  fullWindowTransparency: false,
  animations: true,
  wallpaper: "bliss",
  highContrast: false,
  highContrastColor: "#ffb300",
  iconSize: "medium",
  win7Aero: true,
  glassOpacity: 38,
  glassBlur: 22,
  glassSaturation: 180,
  aeroGlow: 50,
};

export const defaultIcons: DesktopIcon[] = [
  { id: "i-fe", label: "Computer", appId: "file-explorer" },
  { id: "i-store", label: "App Store", appId: "app-store" },
  { id: "i-social", label: "PueiSocial", appId: "puei-social" },
  { id: "i-board", label: "PueiBoard", appId: "puei-board" },
  { id: "i-paint", label: "Puei Paint 2", appId: "puei-paint" },
  { id: "i-net", label: "PueiWeb", appId: "pueinet" },
  { id: "i-msg", label: "PueiCloudChat", appId: "puei-cloud-chat" },
  { id: "i-studio", label: "Puei Studio", appId: "puei-studio" },
  { id: "i-set", label: "Settings", appId: "settings" },
  { id: "i-recycle", label: "Recycle Bin", appId: "recycle-bin" },
  { id: "i-note", label: "Notepad", appId: "notepad" },
  { id: "i-calc", label: "Calculator", appId: "calculator" },
  { id: "i-about", label: "About PueiOS 2", appId: "about" },
];

export function iconGridPos(index: number) {
  return { col: Math.floor(index / ICONS_PER_COL), row: index % ICONS_PER_COL };
}

export function loadState(): Persisted {
  const base: Persisted = { installed: false, systemVersion: "PueiOS 2", theme: defaultTheme, icons: defaultIcons, users: [] };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw);
    return {
      installed: !!p.installed,
      systemVersion: p.systemVersion || "PueiOS 2",
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
  // Reusing/restoring a file ID should clear any stale tombstone.
  unmarkFileDeletedForever(f.id);
  saveFiles(all);
  return f;
}
export function deleteFile(id: string) {
  // soft delete → move to recycle bin
  const all = loadFiles();
  const f = all.find((x) => x.id === id);
  if (!f) return;
  saveFiles(all.filter((x) => x.id !== id));
  const bin = loadRecycle();
  bin.push({ ...f, deletedAt: Date.now(), originalFolder: f.folder });
  saveRecycle(bin);
}
export function getFile(id: string) {
  return loadFiles().find((f) => f.id === id);
}
export function moveFile(id: string, folder?: string) {
  const all = loadFiles();
  saveFiles(all.map((f) => f.id === id ? { ...f, folder } : f));
}

// ---- Recycle bin
export function loadRecycle(): RecycleEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECYCLE_KEY) || "[]"); } catch { return []; }
}
export function saveRecycle(items: RecycleEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECYCLE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("pueios-recycle-changed"));
  } catch {}
}
export function restoreFromRecycle(id: string) {
  const bin = loadRecycle();
  const item = bin.find((x) => x.id === id);
  if (!item) return;
  saveRecycle(bin.filter((x) => x.id !== id));
  const { deletedAt, originalFolder, ...file } = item;
  unmarkFileDeletedForever(id);
  upsertFile({ ...file, folder: originalFolder });
}
export function permanentDelete(id: string) {
  saveRecycle(loadRecycle().filter((x) => x.id !== id));
  markFileDeletedForever(id);
}
export function emptyRecycle() {
  const ids = loadRecycle().map((x) => x.id);
  saveRecycle([]);
  ids.forEach((id) => markFileDeletedForever(id));
}

// ---- Chat
export function loadChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); } catch { return []; }
}
export function appendChat(m: ChatMessage) {
  const all = loadChat(); all.push(m);
  // Spec: conversations saved permanently unless manually deleted. No trimming.
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("pueios-chat", { detail: m }));
  } catch {}
}
export function deleteChatBetween(a: string, b: string) {
  const all = loadChat().filter((m) => !((m.from === a && m.to === b) || (m.from === b && m.to === a)));
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("pueios-chat"));
  } catch {}
}

// ---- Mail
const MAIL_KEY = "pueios2-mail-v2";

export type MailAttachment = {
  id: string;
  name: string;
  kind: "file" | "image" | "video";
  mime: string;
  size: number;
  dataUrl: string;
  savedAt: number;
};

export type MailFolderId = "inbox" | "sent" | "drafts" | "important" | "spam" | "trash" | string;

export type MailMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  at: number;
  read: boolean;
  folder: MailFolderId;
  owner: string;
  attachments?: MailAttachment[];
  important?: boolean;
  spam?: boolean;
};

export function mailAddressFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@pueimail.puei`;
}

export function resolveMailRecipient(raw: string, users: { name: string; pueiNumber?: string }[], dir = loadDirectory()): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Pueio Number format: 123-456-789 or 123456789
  if (/^\d{3}-?\d{3}-?\d{3}$/.test(s)) {
    const cleaned = s.replace(/-/g, "").replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
    const d = dir.find((e) => e.pueiNumber === cleaned);
    if (d) return d.name;
    const u = users.find((x) => x.pueiNumber === cleaned);
    if (u) return u.name;
    return cleaned; // unknown recipient — use number as identifier
  }
  // @pueimail.puei email address → extract username and match
  const emailMatch = s.match(/^([a-z0-9._-]+)@pueimail\.puei$/i);
  if (emailMatch) {
    const uname = emailMatch[1].toLowerCase();
    const u = users.find((x) => x.name.toLowerCase() === uname);
    return u ? u.name : null;
  }
  // Plain username match (case-insensitive)
  const byName = users.find((x) => x.name.toLowerCase() === s.toLowerCase());
  if (byName) return byName.name;
  return null;
}

export function loadMail(owner: string): MailMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const all: MailMessage[] = JSON.parse(localStorage.getItem(MAIL_KEY) || "[]");
    return all.filter((m) => m.owner === owner);
  } catch { return []; }
}

export function loadAllMail(): MailMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(MAIL_KEY) || "[]"); } catch { return []; }
}

export function saveMail(msgs: MailMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const existing: MailMessage[] = JSON.parse(localStorage.getItem(MAIL_KEY) || "[]");
    const owners = new Set(msgs.map((m) => m.owner));
    const kept = existing.filter((m) => !owners.has(m.owner));
    localStorage.setItem(MAIL_KEY, JSON.stringify([...kept, ...msgs]));
    window.dispatchEvent(new CustomEvent("pueios-mail"));
  } catch {}
}

export function replaceMailFor(owner: string, msgs: MailMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const existing: MailMessage[] = JSON.parse(localStorage.getItem(MAIL_KEY) || "[]");
    const kept = existing.filter((m) => m.owner !== owner);
    localStorage.setItem(MAIL_KEY, JSON.stringify([...kept, ...msgs]));
    window.dispatchEvent(new CustomEvent("pueios-mail"));
  } catch {}
}

export function loadMailFolders(owner: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(`pueios2-mailfolders-${owner}`) || "[]"); } catch { return []; }
}
export function saveMailFolders(owner: string, folders: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`pueios2-mailfolders-${owner}`, JSON.stringify(folders)); } catch {}
}

export type DownloadEntry = { id: string; name: string; kind: string; size: number; at: number; mailId?: string; destination?: string };
export function loadDownloads(owner: string): DownloadEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(`pueios2-downloads-${owner}`) || "[]"); } catch { return []; }
}
export function recordDownload(owner: string, e: DownloadEntry) {
  if (typeof window === "undefined") return;
  const all = loadDownloads(owner);
  all.unshift(e);
  try { localStorage.setItem(`pueios2-downloads-${owner}`, JSON.stringify(all.slice(0, 200))); } catch {}
  window.dispatchEvent(new CustomEvent("pueios-downloads"));
}

export function sendMail(
  from: string,
  to: string,
  subject: string,
  body: string,
  _users: { name: string }[],
  attachments?: MailAttachment[],
): MailMessage {
  const existing = loadAllMail();
  const cleanTo = to.trim();
  const id = `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const at = Date.now();
  const sentCopy: MailMessage = {
    id: id + "-s", from, to: cleanTo, subject, body, at,
    read: true, folder: "sent", owner: from, attachments,
  };
  try {
    localStorage.setItem(MAIL_KEY, JSON.stringify([...existing, sentCopy]));
    window.dispatchEvent(new CustomEvent("pueios-mail"));
  } catch {}
  return sentCopy;
}

const SPAM_KEYWORDS = ["lottery", "winner", "viagra", "crypto giveaway", "free money", "click here to claim", "you have won", "nigerian prince"];
export function isLikelySpam(m: { subject: string; body: string }): boolean {
  const t = `${m.subject} ${m.body}`.toLowerCase();
  return SPAM_KEYWORDS.some((k) => t.includes(k));
}

export function aiMailSuggestions(context: { subject?: string; body?: string; from?: string }): string[] {
  const subj = (context.subject || "").toLowerCase();
  const base = [
    `Thanks for the note${context.from ? `, ${context.from}` : ""} — I'll take a look and get back to you shortly.`,
    "Got it, thanks for letting me know.",
    "Sounds good to me. Let's go ahead with that.",
  ];
  if (subj.includes("meeting") || subj.includes("call")) {
    return ["I'm available — please send a calendar invite.", "Can we move this to tomorrow afternoon?", ...base];
  }
  if (subj.startsWith("re:")) {
    return ["Following up on this — any updates?", ...base];
  }
  return base;
}



export function loadSocial(): SocialPost[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SOCIAL_KEY) || "[]"); } catch { return []; }
}
export function saveSocial(posts: SocialPost[]) {
  if (typeof window === "undefined") return;
  try {
    // Spec: permanent storage unless manually removed.
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(posts));
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
