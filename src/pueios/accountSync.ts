// Cloud account synchronization — keeps an entire Pueios account
// (profile, contacts, chats, mail, files, social, settings, theme, icons,
//  desktop layout, recycle bin) tied to the account on the server so it
// follows the user across every browser.
import type { User, Theme, DesktopIcon } from "./state";

const LS = {
  state: "pueios2-state-v3",
  files: "pueios2-files-v1",
  chat: "pueios2-chat-v1",
  social: "pueios2-social-v1",
  recycle: "pueios2-recycle-v1",
  mail: "pueios2-mail-v2",
  directory: "pueios2-directory-v1",
  deletedUsers: "pueios2-deleted-users-v1",
} as const;

export function markUserDeleted(name: string) {
  try {
    const cur: string[] = JSON.parse(localStorage.getItem(LS.deletedUsers) || "[]");
    if (!cur.includes(name)) { cur.push(name); localStorage.setItem(LS.deletedUsers, JSON.stringify(cur)); }
  } catch {}
}

function isUserDeleted(name: string): boolean {
  try { return (JSON.parse(localStorage.getItem(LS.deletedUsers) || "[]") as string[]).includes(name); } catch { return false; }
}

export interface AccountSnapshot {
  version: 1;
  user: User;
  theme: Theme;
  icons: DesktopIcon[];
  files: unknown[];
  chat: unknown[];
  social: unknown[];
  recycle: unknown[];
  mail: unknown[];
  mailFolders: Record<string, unknown>;
  downloads: Record<string, unknown>;
}

function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/** Build a snapshot of everything tied to this account from local storage. */
export function gatherSnapshot(user: User): AccountSnapshot {
  const state = readJSON<{ theme?: Theme; icons?: DesktopIcon[] }>(LS.state, {});
  const allFiles = readJSON<Array<{ owner?: string }>>(LS.files, []);
  const allChat = readJSON<Array<{ from?: string; to?: string }>>(LS.chat, []);
  const allSocial = readJSON<Array<{ author?: string }>>(LS.social, []);
  const allRecycle = readJSON<Array<{ owner?: string }>>(LS.recycle, []);
  const allMail = readJSON<Array<{ owner?: string }>>(LS.mail, []);

  const name = user.name;
  const mailFolders: Record<string, unknown> = {};
  const downloads: Record<string, unknown> = {};
  try {
    const mfKey = `pueios2-mailfolders-${name}`;
    const dKey = `pueios2-downloads-${name}`;
    const mf = localStorage.getItem(mfKey);
    const d = localStorage.getItem(dKey);
    if (mf) mailFolders[name] = JSON.parse(mf);
    if (d) downloads[name] = JSON.parse(d);
  } catch {}

  return {
    version: 1,
    user,
    theme: state.theme as Theme,
    icons: (state.icons as DesktopIcon[]) ?? [],
    files: allFiles.filter((f) => !f.owner || f.owner === name),
    chat: allChat.filter((c) => c.from === name || c.to === name),
    social: allSocial,
    recycle: allRecycle.filter((r) => !r.owner || r.owner === name),
    mail: allMail.filter((m) => m.owner === name),
    mailFolders,
    downloads,
  };
}

/** Apply a remote snapshot into local storage (merges shared collections). */
export function applySnapshot(snap: AccountSnapshot) {
  if (!snap || snap.version !== 1) return;
  const name = snap.user.name;
  if (isUserDeleted(name)) return;

  // State (theme, icons, users entry)
  try {
    const cur = readJSON<{ users?: User[]; installed?: boolean; systemVersion?: string; theme?: Theme; icons?: DesktopIcon[] }>(LS.state, {});
    // Never restore users that were deleted on this device
    const users = Array.isArray(cur.users) ? cur.users.filter((u) => u.name !== name && !isUserDeleted(u.name)) : [];
    users.push(snap.user);
    writeJSON(LS.state, {
      ...cur,
      installed: true,
      systemVersion: cur.systemVersion ?? "PueiOS 2",
      users,
      theme: snap.theme ?? cur.theme,
      icons: snap.icons?.length ? snap.icons : cur.icons,
      lastUser: name,
    });
  } catch {}

  // Files — merge by id, newer wins
  try {
    const cur = readJSON<Array<{ id: string; updatedAt?: number }>>(LS.files, []);
    const incoming = (snap.files as Array<{ id: string; updatedAt?: number }>) || [];
    const map = new Map(cur.map((f) => [f.id, f]));
    for (const f of incoming) {
      const ex = map.get(f.id);
      if (!ex || (f.updatedAt ?? 0) >= (ex.updatedAt ?? 0)) map.set(f.id, f);
    }
    writeJSON(LS.files, Array.from(map.values()));
  } catch {}

  // Chats — merge by id
  try {
    const cur = readJSON<Array<{ id: string }>>(LS.chat, []);
    const incoming = (snap.chat as Array<{ id: string }>) || [];
    const map = new Map(cur.map((c) => [c.id, c]));
    for (const c of incoming) map.set(c.id, c);
    writeJSON(LS.chat, Array.from(map.values()).sort((a: any, b: any) => (a.at ?? 0) - (b.at ?? 0)));
  } catch {}

  // Social — replace if incoming has data
  if (Array.isArray(snap.social) && snap.social.length) writeJSON(LS.social, snap.social);

  // Recycle — replace user-owned entries
  try {
    const cur = readJSON<Array<{ id: string; owner?: string }>>(LS.recycle, []);
    const others = cur.filter((r) => r.owner && r.owner !== name);
    writeJSON(LS.recycle, [...others, ...((snap.recycle as Array<{ id: string }>) || [])]);
  } catch {}

  // Mail — replace user-owned mail
  try {
    const cur = readJSON<Array<{ id: string; owner?: string }>>(LS.mail, []);
    const others = cur.filter((m) => m.owner !== name);
    writeJSON(LS.mail, [...others, ...((snap.mail as Array<{ id: string }>) || [])]);
  } catch {}

  // Mail folders / downloads
  try {
    const mf = snap.mailFolders?.[name];
    if (mf) localStorage.setItem(`pueios2-mailfolders-${name}`, JSON.stringify(mf));
    const dl = snap.downloads?.[name];
    if (dl) localStorage.setItem(`pueios2-downloads-${name}`, JSON.stringify(dl));
  } catch {}

  // Notify the app
  try {
    window.dispatchEvent(new CustomEvent("pueios-files-changed"));
    window.dispatchEvent(new CustomEvent("pueios-chat"));
    window.dispatchEvent(new CustomEvent("pueios-social"));
    window.dispatchEvent(new CustomEvent("pueios-mail"));
    window.dispatchEvent(new CustomEvent("pueios-recycle-changed"));
  } catch {}
}

export interface RemoteLoginResult {
  ok: boolean;
  status: "ok" | "not-found" | "wrong-password" | "network-error";
  snapshot?: AccountSnapshot;
}

/** Attempt to authenticate against the cloud and pull the account snapshot. */
export async function loginRemote(name: string, password: string): Promise<RemoteLoginResult> {
  try {
    const r = await fetch(`/api/account?name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`);
    if (r.status === 404) return { ok: false, status: "not-found" };
    if (r.status === 401) return { ok: false, status: "wrong-password" };
    if (!r.ok) return { ok: false, status: "network-error" };
    const data = (await r.json()) as { snapshot?: AccountSnapshot };
    return { ok: true, status: "ok", snapshot: data.snapshot };
  } catch {
    return { ok: false, status: "network-error" };
  }
}

/** Create the account on the server. Returns false if name already taken. */
export async function createRemote(user: User, snapshot: AccountSnapshot): Promise<{ ok: boolean; conflict?: boolean }> {
  try {
    const r = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: user.name, password: user.password ?? "", snapshot }),
    });
    if (r.status === 409) return { ok: false, conflict: true };
    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

/** Push the current snapshot to the server (last-write-wins). */
export async function pushSnapshot(user: User): Promise<boolean> {
  try {
    const snap = gatherSnapshot(user);
    const r = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: user.name, password: user.password ?? "", snapshot: snap }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Change password on the server, authenticated with the old password. */
export async function changePasswordRemote(name: string, oldPassword: string, newPassword: string, user: User): Promise<boolean> {
  try {
    const snap = gatherSnapshot(user);
    const r = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password: oldPassword, newPassword, snapshot: snap }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
export function schedulePush(user: User | undefined, delayMs = 1500) {
  if (!user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushSnapshot(user).catch(() => {}); }, delayMs);
}
