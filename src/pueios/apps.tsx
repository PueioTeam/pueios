import { useEffect, useRef, useState } from "react";
import type { AppId, Theme, User, WallpaperId, SavedFile, ChatMessage, DesktopIcon, SocialPost, SocialComment, SystemVersion, RecycleEntry, MailMessage, MailAttachment, MailFolderId, DownloadEntry } from "./state";
import {
  blip, loadFiles, upsertFile, deleteFile, getFile, appendChat, loadChat, deleteChatBetween,
  loadSocial, saveSocial, pueiNumberFor, googleFaviconFor,
  classifyTrustedUrl, lookupPueiNumber, registerInDirectory, loadDirectory,
  loadRecycle, restoreFromRecycle, permanentDelete, emptyRecycle, moveFile,
  SYSTEM_ORDER, compareVersion, loadMail, saveMail, sendMail, replaceMailFor,
  mailAddressFor, resolveMailRecipient, loadMailFolders, saveMailFolders,
  loadDownloads, recordDownload, isLikelySpam, aiMailSuggestions,
} from "./state";
import { pullAndMergeFiles, pushFile as pushFileToServer, removeFileFromServer } from "./fileSync";
import { changePasswordRemote, fetchPublicFilms } from "./accountSync";
import { PueiMansionApp } from "./games";


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
  systemVersion: SystemVersion;
  startUpgrade: (target: SystemVersion) => void;
  uninstallApp: (appId: AppId) => void;
  uninstallWebApp: (url: string) => void;
  addNativeIcon: (appId: AppId, label: string, icon: string) => void;
  onCreateShortcut: (label: string, fileId: string) => void;
  installWebApp: (label: string, url: string, iconUrl?: string) => void;
  installedKeys: Set<string>;
  openWebApp: (url: string, title: string) => void;
  openFolder: (folderIconId: string, title: string) => void;
  signOut: () => void;
  lockScreen: () => void;
  deleteAccount: (name: string) => void;
};

export function AppRenderer(p: AppRendererProps) {
  switch (p.appId) {
    case "settings": return <SettingsApp theme={p.theme} setTheme={p.setTheme} wallpaper={p.wallpaper} setWallpaper={p.setWallpaper} openApp={p.openApp} currentUser={p.currentUser} users={p.users} setUsers={p.setUsers} systemVersion={p.systemVersion} startUpgrade={p.startUpgrade} uninstallApp={p.uninstallApp} icons={p.icons} signOut={p.signOut} lockScreen={p.lockScreen} deleteAccount={p.deleteAccount} />;
    case "about": return <AboutApp />;
    case "notepad": return <NotepadApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} currentUser={p.currentUser} />;
    case "calculator": return <CalculatorApp />;
    case "puei-paint": return <PaintApp fileId={p.fileId} onCreateShortcut={p.onCreateShortcut} currentUser={p.currentUser} />;
    case "puei-board": return <PueiBoardApp user={p.currentUser} users={p.users} />;
    case "pueinet": return <PueiWebApp currentUser={p.currentUser} users={p.users} icons={p.icons} />;
    case "puei-cloud-chat": return <PueiCloudChatApp user={p.currentUser} users={p.users} setUsers={p.setUsers} />;
    case "puei-studio": return <PueiStudioApp currentUser={p.currentUser} users={p.users} icons={p.icons} setWallpaper={p.setWallpaper} />;
    case "file-explorer": return <FileExplorerApp openApp={p.openApp} icons={p.icons} openFolder={p.openFolder} currentUser={p.currentUser} users={p.users} setWallpaper={p.setWallpaper} />;
    case "app-store": return <AppStoreApp installWebApp={p.installWebApp} openApp={p.openApp} openWebApp={p.openWebApp} systemVersion={p.systemVersion} addNativeIcon={p.addNativeIcon} uninstallApp={p.uninstallApp} uninstallWebApp={p.uninstallWebApp} icons={p.icons} installedKeys={p.installedKeys} />;
    case "puei-social": return <PueiSocialApp user={p.currentUser} users={p.users} />;
    case "folder": return <FolderApp folderIconId={p.folderIconId!} icons={p.icons} openApp={p.openApp} openWebApp={p.openWebApp} />;
    case "web-app": return <WebAppFrame url={p.webUrl!} currentUser={p.currentUser} startUpgrade={p.startUpgrade} />;
    case "recycle-bin": return <RecycleBinApp />;
    case "chess": return <ChessApp />;
    case "puei-mansion": return <PueiMansionApp />;
    case "iso-viewer": return <IsoViewerApp fileId={p.fileId} />;
    case "zip-viewer": return <ZipViewerApp fileId={p.fileId} />;
  }
}

const SYS_FOLDER_PICTURES = "__pictures__";
const SYS_FOLDER_DOWNLOADS = "__downloads__";
const PUEI_BOARD_KEY = "pueios2-board-v1";

type PueiBoardPost = {
  id: string;
  author: string;
  authorAvatar: string;
  board: string;
  caption: string;
  imageSrc: string;
  imageName: string;
  at: number;
  likes: number;
  likedBy?: string[];
};

function loadPueiBoard(): PueiBoardPost[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PUEI_BOARD_KEY) || "[]"); } catch { return []; }
}

function savePueiBoard(posts: PueiBoardPost[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PUEI_BOARD_KEY, JSON.stringify(posts));
    window.dispatchEvent(new CustomEvent("pueios-board"));
  } catch {}
}

function destinationFolderLabel(folder?: string): string {
  if (!folder || folder === "") return "Desktop";
  if (folder === SYS_FOLDER_PICTURES) return "Pictures";
  if (folder === SYS_FOLDER_DOWNLOADS) return "Downloads";
  return "Folder";
}

function chooseImageDestination(defaultChoice: "pictures" | "downloads" | "desktop" = "pictures"): string | undefined | null {
  const raw = prompt("Save wallpaper to: pictures / downloads / desktop", defaultChoice);
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === "pictures" || v === "picture") return SYS_FOLDER_PICTURES;
  if (v === "downloads" || v === "download") return SYS_FOLDER_DOWNLOADS;
  if (v === "desktop") return undefined;
  alert("Unknown folder. Use: pictures, downloads, or desktop.");
  return null;
}

function saveDownloadedImage(owner: string, name: string, dataUrl: string, folder?: string) {
  const saved: SavedFile = {
    id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    type: "image",
    content: dataUrl,
    updatedAt: Date.now(),
    owner,
    folder,
  };
  upsertFile(saved);
  recordDownload(owner, {
    id: `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    kind: "image",
    size: Math.round((dataUrl.length * 3) / 4),
    at: Date.now(),
    destination: destinationFolderLabel(folder),
  });
  return saved;
}


function SettingsApp({ theme, setTheme, wallpaper, setWallpaper, openApp, currentUser, users, setUsers, systemVersion, startUpgrade, uninstallApp, icons, signOut, lockScreen, deleteAccount }: any) {
  const [tab, setTab] = useState("personalize");
  const [paintImages, setPaintImages] = useState<SavedFile[]>(() => loadFiles().filter((f) => f.type === "image" && f.folder === SYS_FOLDER_PICTURES && (!f.owner || f.owner === currentUser)));
  useEffect(() => {
    const fn = () => setPaintImages(loadFiles().filter((f) => f.type === "image" && f.folder === SYS_FOLDER_PICTURES && (!f.owner || f.owner === currentUser)));
    window.addEventListener("pueios-files-changed", fn);
    return () => window.removeEventListener("pueios-files-changed", fn);
  }, [currentUser]);

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

  // Pueio Control tab state
  const [pcCurPw, setPcCurPw] = useState("");
  const [pcNewPw, setPcNewPw] = useState("");
  const [pcConfirm, setPcConfirm] = useState("");
  const [pcMsg, setPcMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pcNumCopied, setPcNumCopied] = useState(false);

  const tabs = [
    ["personalize", "🎨 Personalize"],
    ["wallpaper", "🖼️ Wallpaper"],
    ["cursor", "🖱️ Cursor di Puei"],
    ["account", "👤 Account"],
    ["pueio-control", "🔑 Pueio Control"],
    ["sound", "🔊 Sound"],
    ["accessibility", "♿ Accessibility"],
    ["highcontrast", "⚡ High Contrast"],
    ["about", "ℹ️ About"],
  ];
  const plusReleaseUrl = "https://github.com/PueioTeam/pueios/releases/tag/pueios2plus";
  const plusLatestUrl = "https://github.com/PueioTeam/pueios/releases/latest";
  const plusIncludes = [
    "advanced cloud synchronization",
    "improved PueiCloud Chat",
    "faster file restoration",
    "enhanced Puei Copilot AI",
    "customizable High Contrast themes",
    "expanded personalization settings",
    "advanced multitasking",
    "upgraded file management",
    "smoother animations",
    "improved desktop rendering",
    "enhanced security systems",
    "cross-browser account restoration",
    "faster PueiWeb performance",
  ];
  const plusSync = [
    "files",
    "profile pictures",
    "Messenger chats",
    "settings",
    "apps",
    "desktop layouts",
    "themes",
    "uploaded videos and images",
  ];
  const plusSetup = [
    "extended Windows-style setup",
    "animated installation stages",
    "account recovery during setup",
    "cloud restore options",
    "upgrade preservation systems",
  ];
  const plusCopilot = [
    "gathering information from multiple sources",
    "summarizing web content",
    "suggesting apps",
    "helping manage files",
    "assisting with system tasks",
  ];
  const plusKeeps = [
    "dark mode",
    "Recycle Bin",
    "drag & drop support",
    "Base44 app support",
    "Pueio Numbers",
    "Puei Mail",
    "PueiSocial",
    "Pueio Videos",
    "PueiWeb",
    "Installer",
    "Pueio Control",
  ];
  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r" style={{ background: "var(--background)" }}>
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
                <input type="checkbox" checked={theme.dark} onChange={(e) => setTheme({ ...theme, dark: e.target.checked })} /> Dark mode <span className="text-xs opacity-60">(global — applies to every system surface)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.transparency} onChange={(e) => setTheme({ ...theme, transparency: e.target.checked })} /> Aero transparency
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!theme.fullWindowTransparency}
                  disabled={!theme.transparency}
                  onChange={(e) => setTheme({ ...theme, fullWindowTransparency: e.target.checked })}
                />
                Full window transparency
                <span className="text-xs opacity-60">(default is title bar only)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={theme.animations} onChange={(e) => setTheme({ ...theme, animations: e.target.checked })} /> Animations & motion
              </label>
            </div>
            <div className="mt-6">
              <div className="text-sm font-semibold mb-3">🖼️ Icon size</div>
              <div className="flex gap-3">
                {([["small","Small","48px"],["medium","Medium","64px"],["large","Large","80px"]] as const).map(([val, label, px]) => (
                  <button key={val} onClick={() => setTheme({ ...theme, iconSize: val })}
                    className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all"
                    style={{ borderColor: (theme.iconSize ?? "medium") === val ? "var(--accent)" : "rgba(255,255,255,0.3)", background: (theme.iconSize ?? "medium") === val ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)" }}>
                    <span style={{ fontSize: px }}>🖥️</span>
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === "wallpaper" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Wallpaper</h2>
            <div className="text-xs opacity-70 mb-2">Built-in</div>
            <div className="grid grid-cols-2 gap-3">
              {(["default", "bliss", "aurora", "sunset", "aero-blue", "aero-pink", "aero-neon", "aero-dusk"] as WallpaperId[]).map((w) => (
                <button key={w} onClick={() => setWallpaper(w)}
                  className={`wallpaper-${w} h-28 rounded-lg border-2 capitalize text-white font-semibold`}
                  style={{ borderColor: wallpaper === w ? "white" : "transparent", boxShadow: wallpaper === w ? "0 0 0 3px var(--accent)" : undefined }}>
                  {w}
                </button>
              ))}
            </div>
            <div className="text-xs opacity-70 mt-5 mb-2">From Pictures</div>
            {paintImages.length === 0 ? (
              <div className="text-sm opacity-60">No pictures yet. Save images to your Pictures folder and they will appear here.</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {paintImages.map((f) => (
                  <button key={f.id} onClick={() => setWallpaper(f.content)}
                    className="h-24 rounded-lg border-2 overflow-hidden relative"
                    style={{ borderColor: wallpaper === f.content ? "white" : "transparent", boxShadow: wallpaper === f.content ? "0 0 0 3px var(--accent)" : undefined }}>
                    <img src={f.content} alt={f.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 truncate">{f.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "cursor" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">🖱️ Cursor di Puei</h2>
            <div className="space-y-6">
              <div>
                <div className="text-sm font-semibold mb-3">Cursor color</div>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  {[
                    ["#ffffff","White"],["#000000","Black"],["#ff4444","Red"],["#ff8800","Orange"],
                    ["#ffdd00","Yellow"],["#44dd44","Green"],["#44aaff","Blue"],["#aa44ff","Purple"],["#ff44aa","Pink"],
                  ].map(([col, name]) => (
                    <button key={col} onClick={() => setTheme({ ...theme, cursorColor: col })}
                      title={name}
                      className="w-10 h-10 rounded-full border-2 shadow transition-all"
                      style={{
                        background: col,
                        borderColor: (theme.cursorColor ?? "#ffffff") === col ? "var(--accent)" : "rgba(128,128,128,0.4)",
                        transform: (theme.cursorColor ?? "#ffffff") === col ? "scale(1.25)" : "scale(1)",
                        boxShadow: (theme.cursorColor ?? "#ffffff") === col ? "0 0 0 3px var(--accent)" : undefined,
                      }} />
                  ))}
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <span className="opacity-70">Custom color:</span>
                  <input type="color" value={theme.cursorColor ?? "#ffffff"}
                    onChange={(e) => setTheme({ ...theme, cursorColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                  <span className="text-xs opacity-50 font-mono">{theme.cursorColor ?? "#ffffff"}</span>
                </label>
              </div>
              <div>
                <div className="text-sm font-semibold mb-3">Preview</div>
                <div className="aero-glass-light rounded-xl p-6 flex items-center justify-center gap-8">
                  {/* Arrow preview */}
                  <div className="flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 24 24">
                      <path d="M3 2 L3 18 L7 14 L10.5 21 L12.5 20 L9 13 L15 13 Z" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                    <span className="text-xs opacity-60">Arrow</span>
                  </div>
                  {/* Hand preview */}
                  <div className="flex flex-col items-center gap-2">
                    <svg width="28" height="32" viewBox="0 0 20 24">
                      <rect x="4" y="0" width="4" height="12" rx="2" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.2" />
                      <rect x="9" y="3" width="4" height="10" rx="2" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.2" />
                      <rect x="14" y="4" width="3.5" height="9" rx="1.75" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.2" />
                      <rect x="2" y="9" width="16" height="12" rx="4" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.2" />
                      <ellipse cx="2" cy="14" rx="2.5" ry="3.5" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.2" />
                    </svg>
                    <span className="text-xs opacity-60">Hand</span>
                  </div>
                  {/* Busy/working preview */}
                  <div className="flex flex-col items-center gap-2">
                    <svg width="36" height="36" viewBox="0 0 32 32">
                      <path d="M3 2 L3 18 L7 14 L10.5 21 L12.5 20 L9 13 L15 13 Z" fill="white" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="1.5" strokeLinejoin="round" />
                      <circle cx="23" cy="23" r="7" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
                      <path d="M23 16 A7 7 0 0 1 30 23" fill="none" stroke={theme.cursorColor ?? "#ffffff"} strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-xs opacity-60">Working</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">Touch cursor</div>
                <div className="text-xs opacity-60 mb-3">On touchscreen devices, a dot follows your finger since the system cursor is invisible on touch.</div>
                <div className="aero-glass-light rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                    style={{ background: theme.cursorColor ?? "#ffffff", borderColor: "rgba(255,255,255,0.5)" }} />
                  <span className="text-xs opacity-70">Touch dot matches your cursor color automatically.</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "account" && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Account</h2>
            {me ? (
              <>
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
                    {["🧑","👩","🧔","👵","🧑‍💻","🦸","🧕","🧒","🐛","👽","🎩","🌃"].map((a) => (
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
                <div className="pt-4 border-t border-white/10 mt-4">
                  <div className="text-sm font-semibold mb-1 text-red-300">Danger Zone</div>
                  <div className="text-xs opacity-60 mb-3">Permanently deletes this account from this device. This cannot be undone.</div>
                  <button
                    className="aero-button rounded px-4 py-2 text-xs font-semibold"
                    style={{ color: "#fca5a5", border: "1px solid rgba(252,165,165,0.3)" }}
                    onClick={() => deleteAccount(currentUser)}>
                    🗑️ Delete my account
                  </button>
                </div>
              </>
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
        {tab === "accessibility" && (
          <div><h2 className="text-xl font-semibold mb-4">Accessibility</h2>
            <p className="text-sm opacity-80">Reduce motion via the Animations toggle on Personalize. For maximum readability, enable <b>High Contrast Mode</b> in the next tab.</p></div>
        )}
        {tab === "highcontrast" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">⚡ High Contrast Mode</h2>
            <p className="text-sm opacity-80 mb-3">Customizable accessibility system. Select a base color — PueiOS 2 generates a full high-contrast theme around it and applies it globally to every system surface and app. No mixed states allowed.</p>
            <label className="flex items-center gap-3 aero-glass-light rounded p-3 max-w-lg mb-5">
              <input type="checkbox" checked={!!theme.highContrast}
                onChange={(e) => setTheme({ ...theme, highContrast: e.target.checked, transparency: e.target.checked ? false : theme.transparency, fullWindowTransparency: e.target.checked ? false : theme.fullWindowTransparency, animations: e.target.checked ? false : theme.animations })} />
              <div>
                <div className="font-semibold">Enable High Contrast Mode</div>
                <div className="text-xs opacity-70">Applies globally to the whole system. Select a color below to customize the contrast theme.</div>
              </div>
            </label>
            <div className="max-w-lg">
              <div className="text-sm font-semibold mb-1">Choose contrast color</div>
              <div className="text-xs opacity-60 mb-3">Click a color to select it. The system builds a full high-contrast UI theme around your choice.</div>
              <div className="grid grid-cols-10 gap-1 mb-3">
                {[
                  "#ffb300","#ff6b00","#ff2200","#ff006e","#cc00ff","#6600ff","#0044ff","#0099ff","#00e5ff","#00e676",
                  "#76ff03","#ffea00","#ffffff","#e0e0e0","#bdbdbd","#9e9e9e","#757575","#424242","#212121","#000000",
                  "#ff8a80","#ff80ab","#ea80fc","#b388ff","#82b1ff","#80d8ff","#a7ffeb","#ccff90","#ffe57f","#ffd180",
                  "#ff5252","#ff4081","#e040fb","#7c4dff","#448aff","#18ffff","#69ff47","#eeff41","#ffab40","#ff6d00",
                ].map((c) => (
                  <button key={c} title={c}
                    onClick={() => setTheme({ ...theme, highContrastColor: c })}
                    className="w-6 h-6 rounded border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: theme.highContrastColor === c ? "white" : "rgba(0,0,0,0.2)",
                      boxShadow: theme.highContrastColor === c ? "0 0 0 3px black, 0 0 0 5px white" : undefined,
                    }} />
                ))}
              </div>
              <div className="flex items-center gap-3 aero-glass-light rounded p-3 mb-3">
                <div className="w-10 h-10 rounded border-2 border-white/30 flex-shrink-0"
                  style={{ background: theme.highContrastColor || "#ffb300" }} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Selected: <code className="font-mono">{theme.highContrastColor || "#ffb300"}</code></div>
                  <div className="text-xs opacity-70">Used for all highlighted UI elements, text and borders.</div>
                </div>
                <input type="color" value={theme.highContrastColor || "#ffb300"} className="cursor-pointer w-9 h-9 rounded border-0"
                  onChange={(e) => setTheme({ ...theme, highContrastColor: e.target.value })} title="Custom color picker" />
              </div>
              <div className="rounded p-3 text-sm font-semibold flex items-center gap-3"
                style={{ background: "#000", color: theme.highContrastColor || "#ffb300", border: `2px solid ${theme.highContrastColor || "#ffb300"}` }}>
                <span>✨</span>
                <span>Preview: High Contrast UI with selected color · Applied globally across all apps</span>
              </div>
            </div>
          </div>
        )}
        {tab === "about" && (
          <div><button className="aero-button rounded-md px-4 py-2" onClick={() => openApp("about")}>Open About PueiOS →</button></div>
        )}
        {tab === "pueio-control" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-xl font-semibold">🔑 Pueio Control</h2>

            {!me ? (
              <div className="text-sm opacity-70">Not signed in.</div>
            ) : (<>

              {/* Identity card */}
              <div className="aero-glass-light rounded-xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${me.color}), oklch(0.45 0.2 ${me.color}))` }}>
                  {me.avatar.startsWith("data:")
                    ? <img src={me.avatar} alt="" className="w-full h-full object-cover" />
                    : me.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base">{me.name}</div>
                  <div className="text-xs opacity-60 mt-0.5">
                    {me.limitedMode ? "⚠️ Limited Access Mode" : "✔ Full Access"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono opacity-80 bg-black/10 rounded px-1.5 py-0.5">
                      {me.pueiNumber || "—"}
                    </code>
                    <button className="text-[10px] px-1.5 py-0.5 rounded transition-all" onClick={() => {
                      if (me.pueiNumber) {
                        navigator.clipboard.writeText(me.pueiNumber).catch(() => {});
                        blip("notify"); setPcNumCopied(true); setTimeout(() => setPcNumCopied(false), 1500);
                      }
                    }} style={{ background: pcNumCopied ? "rgba(100,220,100,0.25)" : "rgba(255,255,255,0.15)", color: pcNumCopied ? "#4ade80" : undefined }}>
                      {pcNumCopied ? "✔ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password section */}
              <div className="aero-glass-light rounded-xl p-4 space-y-3">
                {(!me.password || me.noPassword) ? (
                  <>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      🔔 No password set
                      {me.limitedMode && <span className="text-[10px] bg-yellow-500/20 rounded px-1.5 py-0.5 text-yellow-700 dark:text-yellow-300">Limited Access</span>}
                    </div>
                    <div className="text-xs opacity-70">Create a password to enable full access and protect your account.</div>
                    <div>
                      <label className="text-xs opacity-70">New password</label>
                      <input type="password" value={pcNewPw} onChange={(e) => setPcNewPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">Confirm password</label>
                      <input type="password" value={pcConfirm} onChange={(e) => setPcConfirm(e.target.value)}
                        onKeyDown={async (e) => { if (e.key === "Enter") {
                          if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a password." }); return; }
                          if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                          const updatedUser = { ...me, password: pcNewPw, noPassword: false, limitedMode: false };
                          await changePasswordRemote(me.name, me.password ?? "", pcNewPw, updatedUser);
                          updateMe({ password: pcNewPw, noPassword: false, limitedMode: false });
                          setPcNewPw(""); setPcConfirm("");
                          setPcMsg({ kind: "ok", text: "✔ Password created! Full access enabled." });
                          blip("notify");
                        }}}
                        className="w-full px-3 py-2 rounded text-sm input-field mt-1" />
                    </div>
                    {pcMsg && (
                      <div className={`text-xs rounded px-2 py-1.5 ${pcMsg.kind === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{pcMsg.text}</div>
                    )}
                    <button className="aero-button rounded-lg px-4 py-2 text-sm w-full" onClick={async () => {
                      if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a password." }); return; }
                      if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                      const updatedUser = { ...me, password: pcNewPw, noPassword: false, limitedMode: false };
                      await changePasswordRemote(me.name, me.password ?? "", pcNewPw, updatedUser);
                      updateMe({ password: pcNewPw, noPassword: false, limitedMode: false });
                      setPcNewPw(""); setPcConfirm("");
                      setPcMsg({ kind: "ok", text: "✔ Password created! Full access enabled." });
                      blip("notify");
                    }}>Create password</button>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-sm">🔒 Change password</div>
                    <div>
                      <label className="text-xs opacity-70">Current password</label>
                      <input type="password" value={pcCurPw} onChange={(e) => setPcCurPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">New password</label>
                      <input type="password" value={pcNewPw} onChange={(e) => setPcNewPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">Confirm new password</label>
                      <input type="password" value={pcConfirm} onChange={(e) => setPcConfirm(e.target.value)}
                        onKeyDown={async (e) => { if (e.key === "Enter") {
                          if (pcCurPw !== me.password) { setPcMsg({ kind: "err", text: "Current password is incorrect." }); return; }
                          if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a new password." }); return; }
                          if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                          setPcMsg({ kind: "ok", text: "Saving…" });
                          const ok = await changePasswordRemote(me.name, pcCurPw, pcNewPw, { ...me, password: pcNewPw });
                          if (!ok) { setPcMsg({ kind: "err", text: "Could not reach server. Try again." }); return; }
                          updateMe({ password: pcNewPw });
                          setPcCurPw(""); setPcNewPw(""); setPcConfirm("");
                          setPcMsg({ kind: "ok", text: "✔ Password changed." });
                          blip("notify");
                        }}}
                        className="w-full px-3 py-2 rounded text-sm input-field mt-1" />
                    </div>
                    {pcMsg && (
                      <div className={`text-xs rounded px-2 py-1.5 ${pcMsg.kind === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{pcMsg.text}</div>
                    )}
                    <button className="aero-button rounded-lg px-4 py-2 text-sm w-full" onClick={async () => {
                      if (pcCurPw !== me.password) { setPcMsg({ kind: "err", text: "Current password is incorrect." }); return; }
                      if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a new password." }); return; }
                      if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                      setPcMsg({ kind: "ok", text: "Saving…" });
                      const ok = await changePasswordRemote(me.name, pcCurPw, pcNewPw, { ...me, password: pcNewPw });
                      if (!ok) { setPcMsg({ kind: "err", text: "Could not reach server. Try again." }); return; }
                      updateMe({ password: pcNewPw });
                      setPcCurPw(""); setPcNewPw(""); setPcConfirm("");
                      setPcMsg({ kind: "ok", text: "✔ Password changed." });
                      blip("notify");
                    }}>Change password</button>
                    <button className="text-xs opacity-60 underline hover:opacity-100" onClick={async () => {
                      if (confirm("Remove your password? This switches you to Limited Access mode.")) {
                        const ok = await changePasswordRemote(me.name, me.password ?? "", "", { ...me, password: "", noPassword: true, limitedMode: true });
                        if (!ok) { setPcMsg({ kind: "err", text: "Could not reach server. Try again." }); return; }
                        updateMe({ password: "", noPassword: true, limitedMode: true });
                        setPcCurPw(""); setPcNewPw(""); setPcConfirm("");
                        setPcMsg({ kind: "ok", text: "Password removed. Now in Limited Access mode." });
                        blip("notify");
                      }
                    }}>Remove password</button>
                  </>
                )}
              </div>

              {/* Session actions */}
              <div className="aero-glass-light rounded-xl p-4 space-y-2">
                <div className="font-semibold text-sm mb-3">Session</div>
                <button className="aero-button rounded-lg px-4 py-2 text-sm w-full text-left flex items-center gap-2"
                  onClick={() => { blip("click"); lockScreen(); }}>
                  🔒 Lock screen
                </button>
                <button className="aero-button rounded-lg px-4 py-2 text-sm w-full text-left flex items-center gap-2"
                  onClick={() => { blip("shutdown"); signOut(); }}>
                  🔄 Sign out
                </button>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl p-4 space-y-2 border border-red-400/30" style={{ background: "rgba(220,50,50,0.08)" }}>
                <div className="font-semibold text-sm text-red-500">Danger Zone</div>
                <div className="text-xs opacity-70">Deleting your account removes it from this device permanently. Your files and messages are not recoverable.</div>
                <button className="rounded-lg px-4 py-2 text-sm border border-red-400/50 text-red-500 hover:bg-red-500/20 transition-colors"
                  onClick={() => {
                    if (prompt(`Type your username "${me.name}" to confirm deletion:`) === me.name) {
                      deleteAccount(me.name);
                    }
                  }}>
                  🖦️ Delete this account
                </button>
              </div>

            </>)}
          </div>
        )}
      </div>
    </div>
  );
}

function AboutApp() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold" style={{ color: "var(--accent)" }}>PueiOS</h1>
      <div className="mt-8 mx-auto max-w-sm aero-glass-light p-5 rounded-lg">
        <div className="font-semibold mb-3 text-lg">Credits</div>
        <div className="text-base space-y-1">
          <div>Pueian Lemne</div>
          <div>Pueian Rosos</div>
          <div>Pueian Pueiescu</div>
        </div>
      </div>
    </div>
  );
}


function NotepadApp({ fileId, onCreateShortcut, currentUser }: { fileId?: string; onCreateShortcut: (l: string, id: string) => void; currentUser: string }) {
  const initial = fileId ? getFile(fileId) : undefined;
  const [text, setText] = useState(initial?.content ?? "Welcome to Puei Notepad.\n\nType anything...");
  const [name, setName] = useState(initial?.name ?? "Untitled.txt");
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [status, setStatus] = useState("");
  const [docLocked, setDocLocked] = useState(false);
  const save = () => {
    const id = savedId || `f-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "text", content: text, updatedAt: Date.now(), owner: currentUser });
    setSavedId(id); setStatus("Saved ✔"); setDocLocked(true); blip("notify");
    setTimeout(() => setStatus(""), 1500);
    return id;
  };
  const open = () => {
    const all = loadFiles().filter((f) => f.type === "text" && (!f.owner || f.owner === currentUser));
    if (all.length === 0) { alert("No saved documents yet."); return; }
    const pick = prompt("Open file — type a name from:\n" + all.map((f) => f.name).join("\n"), all[0].name);
    if (!pick) return;
    const f = all.find((x) => x.name === pick);
    if (!f) { alert("Not found"); return; }
    setText(f.content); setName(f.name); setSavedId(f.id); setDocLocked(false);
  };
  return (
    <div className="flex flex-col h-full" style={{ overflow: "hidden" }}>
      <div className="aero-titlebar text-xs px-2 py-1 flex items-center gap-2 flex-shrink-0">
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={docLocked}
          className="px-2 py-0.5 rounded text-xs input-field" style={{ width: 180 }} />
        {!docLocked && <button className="aero-button rounded px-2 py-0.5" onClick={save}>💾 Save</button>}
        {docLocked && <span className="opacity-60 text-xs">🔒 Read-only</span>}
        <button className="aero-button rounded px-2 py-0.5" onClick={open}>📂 Open</button>
        {!docLocked && <button className="aero-button rounded px-2 py-0.5" onClick={() => { const id = save(); onCreateShortcut(name, id); }}>📌 Save & shortcut</button>}
        <button className="aero-button rounded px-2 py-0.5" onClick={() => { setText("Welcome to Puei Notepad.\n\nType anything..."); setName("Untitled.txt"); setSavedId(undefined); setDocLocked(false); }}>📄 New</button>
        <span className="opacity-70">{status}</span>
      </div>
      <textarea value={text} onChange={(e) => { if (!docLocked) setText(e.target.value); }}
        readOnly={docLocked}
        className="flex-1 p-3 font-mono text-sm outline-none resize-none input-field" style={{ overflow: "auto", boxSizing: "border-box", userSelect: "text" }} />
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

function PaintApp({ fileId, onCreateShortcut, currentUser }: { fileId?: string; onCreateShortcut: (l: string, id: string) => void; currentUser: string }) {
  const initial = fileId ? getFile(fileId) : undefined;
  const cv = useRef<HTMLCanvasElement>(null);
  const draw = useRef(false);
  const [tool, setTool] = useState<"brush" | "bucket">("brush");
  const [color, setColor] = useState("#1ea8ff");
  const [size, setSize] = useState(4);
  const [name, setName] = useState(initial?.name ?? "Untitled.png");
  const [savedId, setSavedId] = useState<string | undefined>(initial?.id);
  const [status, setStatus] = useState("");
  const [locked, setLocked] = useState(!!initial?.id);
  useEffect(() => {
    const c = cv.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
    if (initial?.type === "image" && initial.content) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initial.content;
    }
  }, []);

  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const full = clean.length === 3
      ? clean.split("").map((x) => x + x).join("")
      : clean.padEnd(6, "0").slice(0, 6);
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const floodFill = (sx: number, sy: number) => {
    const c = cv.current!;
    const ctx = c.getContext("2d")!;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = img.data;
    const w = img.width;
    const h = img.height;

    const startX = Math.max(0, Math.min(w - 1, Math.floor(sx)));
    const startY = Math.max(0, Math.min(h - 1, Math.floor(sy)));
    const startIdx = (startY * w + startX) * 4;
    const tr = data[startIdx];
    const tg = data[startIdx + 1];
    const tb = data[startIdx + 2];
    const ta = data[startIdx + 3];
    const [fr, fg, fb] = hexToRgb(color);
    const fa = 255;

    if (tr === fr && tg === fg && tb === fb && ta === fa) return;

    const match = (i: number) => data[i] === tr && data[i + 1] === tg && data[i + 2] === tb && data[i + 3] === ta;
    const stack: number[] = [startX, startY];

    while (stack.length) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      if (!match(i)) continue;

      data[i] = fr;
      data[i + 1] = fg;
      data[i + 2] = fb;
      data[i + 3] = fa;

      stack.push(x + 1, y);
      stack.push(x - 1, y);
      stack.push(x, y + 1);
      stack.push(x, y - 1);
    }

    ctx.putImageData(img, 0, 0);
  };

  const start = (e: React.PointerEvent) => {
    if (locked) return;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    if (tool === "bucket") {
      floodFill(x, y);
      return;
    }
    draw.current = true;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!draw.current || locked) return;
    const c = cv.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round";
    ctx.lineTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)); ctx.stroke();
  };
  const end = () => { draw.current = false; };
  const save = () => {
    const data = cv.current!.toDataURL("image/png");
    const id = savedId || `f-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "image", content: data, updatedAt: Date.now(), owner: currentUser });
    setSavedId(id); setLocked(true); setStatus("Saved ✔"); blip("notify");
    setTimeout(() => setStatus(""), 1500);
    return id;
  };
  const open = () => {
    const all = loadFiles().filter((f) => f.type === "image" && (!f.owner || f.owner === currentUser));
    if (all.length === 0) { alert("No saved images yet."); return; }
    const pick = prompt("Open file — type a name from:\n" + all.map((f) => f.name).join("\n"), all[0].name);
    if (!pick) return;
    const f = all.find((x) => x.name === pick);
    if (!f) return;
    setName(f.name); setSavedId(f.id); setLocked(true);
    const c = cv.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
    const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = f.content;
  };
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex flex-wrap gap-2 px-2 py-1 items-center text-xs">
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={locked} className="px-2 py-0.5 rounded input-field" style={{ width: 140 }} />
        {locked ? (
          <span className="opacity-60 text-xs">🔒 Read-only</span>
        ) : (
          <>
            <button className="aero-button px-2 py-0.5 rounded" onClick={save}>💾 Save</button>
            <button className="aero-button px-2 py-0.5 rounded" onClick={() => { const id = save(); onCreateShortcut(name, id); }}>📌 Shortcut</button>
            <button className="aero-button px-2 py-0.5 rounded" onClick={() => {
              const c = cv.current!; const ctx = c.getContext("2d")!;
              ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
            }}>Clear</button>
            <button className="aero-button px-2 py-0.5 rounded" onClick={() => setTool("brush")}
              style={{ background: tool === "brush" ? "var(--gradient-aero)" : undefined, color: tool === "brush" ? "white" : undefined }}>
              🖌 Brush
            </button>
            <button className="aero-button px-2 py-0.5 rounded" onClick={() => setTool("bucket")}
              style={{ background: tool === "bucket" ? "var(--gradient-aero)" : undefined, color: tool === "bucket" ? "white" : undefined }}>
              🪣 Bucket
            </button>
            <label className="opacity-80">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <input type="range" min={1} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            <span>size: {size}</span>
            {["#000000", "#ff0000", "#ffaa00", "#00cc44", "#1ea8ff", "#aa00ff", "#ffffff"].map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ background: c, width: 18, height: 18, border: "1px solid #666" }} />
            ))}
          </>
        )}
        <button className="aero-button px-2 py-0.5 rounded" onClick={() => { setName("Untitled.png"); setSavedId(undefined); setLocked(false); const c = cv.current!; const ctx = c.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height); }}>📄 New</button>
        <button className="aero-button px-2 py-0.5 rounded" onClick={open}>📂 Open</button>
        <span className="opacity-70 ml-auto">{status}{!locked && " · Saved images can be set as wallpaper in Settings."}</span>
      </div>
      <div className="relative flex-1">
        <canvas ref={cv} width={800} height={500}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          className="browser-content" style={{ width: "100%", height: "100%", touchAction: "none", cursor: locked ? "not-allowed" : tool === "bucket" ? "copy" : "crosshair" }} />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/30 text-white text-sm px-4 py-2 rounded-lg">🔒 Read-only</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Puei Copilot (integrated into PueiSearch) ----------

/** General knowledge base for Puei Copilot. Returns a real answer or null if unknown. */
const KNOWLEDGE: Array<{ match: (q: string) => boolean; answer: (q: string) => string }> = [
  // ── Machines & vehicles ──
  {
    match: (q) => q.includes("bulldozer") || q.includes("bull dozer"),
    answer: () =>
      `A bulldozer is a large, powerful construction machine used to move earth, rocks, rubble, sand, and other heavy materials. Here's how it works and how it's used:\n\n` +
      `**Main parts:**\n` +
      `• Blade — the wide metal plate at the front that pushes material. It can tilt left/right and angle up/down.\n` +
      `• Tracks (caterpillar tracks) — instead of wheels, it runs on steel tracks for grip on rough or soft terrain.\n` +
      `• Ripper — a claw-like attachment at the rear used to break up hard rock or compacted soil before pushing.\n` +
      `• Cab — the enclosed operator cabin with controls for the blade, tracks, and ripper.\n\n` +
      `**How it's used:**\n` +
      `1. The operator drives it toward the material to be moved.\n` +
      `2. The blade is lowered to ground level and digs into the material.\n` +
      `3. The bulldozer drives forward, pushing the material ahead of the blade.\n` +
      `4. The blade is raised to drop the pile, then the machine reverses and repeats.\n` +
      `5. The ripper can be dragged along hard ground first to loosen it before pushing.\n\n` +
      `**Common uses:** land clearing, road building, mining, demolition, grading flat surfaces, pushing material into piles, and digging shallow trenches.\n\n` +
      `Famous models include the Caterpillar D9 and Komatsu D375, which can weigh over 100 tonnes.`,
  },
  {
    match: (q) => q.includes("excavator") || q.includes("digger"),
    answer: () =>
      `An excavator (also called a digger) is a heavy construction machine used mainly for digging. It has a rotating cab on a tracked or wheeled base, a long boom arm, and a bucket at the end.\n\n` +
      `**How it works:**\n` +
      `• The operator sits in the rotating cab and uses joysticks to control the boom, arm, and bucket.\n` +
      `• The bucket curls inward to scoop up soil or rock.\n` +
      `• The cab rotates 360° to swing the bucket and dump the load into a truck or pile.\n\n` +
      `**Common uses:** digging foundations, trenches, and pits; demolishing buildings; lifting heavy objects; mining; dredging rivers.`,
  },
  {
    match: (q) => q.includes("crane"),
    answer: () =>
      `A crane is a machine used for lifting and moving heavy objects. It uses cables, pulleys, and a hook to hoist loads. Types include tower cranes (used in building construction), mobile cranes (on trucks), and overhead cranes (in factories). The operator controls the lifting, lowering, and swinging of the load using levers or a remote control.`,
  },
  {
    match: (q) => q.includes("forklift"),
    answer: () =>
      `A forklift is a powered industrial truck used to lift and transport materials on two front forks. It's driven by an operator in a cab and used in warehouses, factories, and construction sites to move pallets and heavy loads. The forks slide under pallets, then the hydraulic mast lifts the load up to stack it or load it onto a truck.`,
  },
  {
    match: (q) => q.includes("tractor"),
    answer: () =>
      `A tractor is a vehicle designed to deliver high tractive effort at slow speed for hauling equipment or pulling trailers. In farming it pulls plows, seeders, and harvesters. Construction tractors pull scrapers or compactors. They typically run on diesel engines and use large rear wheels (or tracks) for traction on soft ground.`,
  },
  // ── Science ──
  {
    match: (q) => q.includes("black hole"),
    answer: () =>
      `A black hole is a region in space where gravity is so strong that nothing — not even light — can escape it. It forms when a massive star collapses at the end of its life. The boundary around a black hole is called the event horizon. Beyond this point, escape velocity exceeds the speed of light. Black holes can be stellar (a few times the Sun's mass), intermediate, or supermassive (billions of solar masses, found at galaxy centres). They are detected by the effect they have on nearby stars and gas.`,
  },
  {
    match: (q) => q.includes("gravity") && !q.includes("black hole"),
    answer: () =>
      `Gravity is a fundamental force of nature that attracts objects with mass toward each other. On Earth it gives you weight and keeps you on the ground. Isaac Newton described it as a force proportional to mass and inversely proportional to the square of distance. Albert Einstein later described it as the curvature of space-time caused by mass. The acceleration due to gravity on Earth's surface is approximately 9.8 m/s┬▓.`,
  },
  {
    match: (q) => q.includes("photosynthesis"),
    answer: () =>
      `Photosynthesis is the process by which plants, algae, and some bacteria convert sunlight, water, and carbon dioxide into glucose (sugar) and oxygen. The formula is:\n\n6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂\n\nIt happens mainly in the chloroplasts of plant cells, using the green pigment chlorophyll to absorb light. The oxygen released is what makes Earth's atmosphere breathable.`,
  },
  {
    match: (q) => q.includes("dna"),
    answer: () =>
      `DNA (deoxyribonucleic acid) is the molecule that carries genetic instructions for the development, functioning, and reproduction of all living organisms. It's shaped like a double helix — two strands twisted around each other. The sequence of four chemical bases (adenine, thymine, guanine, cytosine) encodes genetic information. Humans have about 3 billion base pairs of DNA packed into 46 chromosomes inside each cell's nucleus.`,
  },
  // ── History ──
  {
    match: (q) => q.includes("world war 2") || q.includes("world war ii") || q.includes("ww2") || q.includes("wwii"),
    answer: () =>
      `World War II (1939–1945) was the deadliest conflict in human history, involving most of the world's nations. It was fought between the Allies (including the UK, USA, USSR, and France) and the Axis powers (Nazi Germany, Fascist Italy, and Imperial Japan). Key events include the German invasion of Poland (1939), the Battle of Britain (1940), Operation Barbarossa (1941), the Holocaust, D-Day (1944), and the atomic bombings of Hiroshima and Nagasaki (1945). An estimated 70–85 million people died. It ended with Germany's surrender on 8 May 1945 and Japan's on 2 September 1945.`,
  },
  {
    match: (q) => q.includes("world war 1") || q.includes("world war i") || q.includes("ww1") || q.includes("wwi"),
    answer: () =>
      `World War I (1914–1918) was a global conflict mainly fought in Europe between the Allied Powers (France, UK, Russia, later USA) and the Central Powers (Germany, Austria-Hungary, Ottoman Empire). It was triggered by the assassination of Archduke Franz Ferdinand of Austria in 1914. The war introduced trench warfare, chemical weapons, and tanks. Around 20 million people died. It ended with the Armistice of 11 November 1918 and the Treaty of Versailles (1919).`,
  },
  // ── Geography ──
  {
    match: (q) => q.includes("mount everest") || q.includes("everest"),
    answer: () =>
      `Mount Everest is the highest mountain on Earth, standing at 8,848.86 metres (29,031.7 ft) above sea level. It is located in the Himalayas on the border between Nepal and Tibet (China). It was first summited on 29 May 1953 by Sir Edmund Hillary (New Zealand) and Tenzing Norgay (Nepal). Thousands of climbers have reached the summit since, though it remains a dangerous climb due to altitude, cold, and weather.`,
  },
  {
    match: (q) => q.includes("amazon") && (q.includes("river") || q.includes("rainforest") || q.includes("jungle")),
    answer: () =>
      `The Amazon is the world's largest tropical rainforest and home to the Amazon River, the largest river by water discharge. The rainforest covers about 5.5 million km┬▓ across Brazil, Peru, Colombia, and other South American countries. It holds around 10% of all species on Earth and produces roughly 20% of the world's oxygen. The Amazon River flows about 6,400 km into the Atlantic Ocean.`,
  },
  // ── Technology ──
  {
    match: (q) => q.includes("internet") && !q.includes("pueios"),
    answer: () =>
      `The Internet is a global network of interconnected computers that communicate using standardised protocols (mainly TCP/IP). It was developed from ARPANET in the 1960s–70s and became publicly available in the early 1990s. The World Wide Web (websites accessed via browsers) is built on top of the Internet. Today it connects billions of devices worldwide and enables communication, commerce, entertainment, and information sharing.`,
  },
  {
    match: (q) => q.includes("artificial intelligence") || (q.includes(" ai ") && q.length < 60),
    answer: () =>
      `Artificial Intelligence (AI) is the simulation of human intelligence by computer systems. It includes machine learning (systems that learn from data), natural language processing (understanding text and speech), computer vision, and robotics. Modern AI uses neural networks — layers of mathematical functions inspired by the brain — trained on large datasets. Applications include voice assistants, image recognition, translation, recommendation systems, and medical diagnosis.`,
  },
  {
    match: (q) => q.includes("bitcoin") || q.includes("cryptocurrency") || q.includes("crypto"),
    answer: () =>
      `Bitcoin is a decentralised digital currency created in 2009 by the pseudonymous Satoshi Nakamoto. It operates on a blockchain — a public, distributed ledger that records all transactions. New bitcoins are created through "mining" (solving cryptographic puzzles). There will only ever be 21 million bitcoins. Cryptocurrency broadly refers to any digital currency using cryptography for security, including Ethereum, Litecoin, and thousands of others.`,
  },
  // ── Animals ──
  {
    match: (q) => q.includes("shark"),
    answer: () =>
      `Sharks are cartilaginous fish that have existed for over 450 million years. There are over 500 species, ranging from the 20 cm dwarf lanternshark to the 12 m whale shark (the largest fish in the ocean). Most sharks are predators with rows of replaceable teeth. They have keen senses including electroreception to detect electrical fields from prey. Only a handful of species (like great whites, bulls, and tigers) are considered dangerous to humans.`,
  },
  {
    match: (q) => q.includes("dinosaur"),
    answer: () =>
      `Dinosaurs were a diverse group of reptiles that dominated terrestrial ecosystems for about 165 million years, from the Triassic period (~230 million years ago) until a mass extinction event ~66 million years ago (likely caused by an asteroid impact). They ranged from chicken-sized feathered creatures to the massive Argentinosaurus (~80 tonnes). Birds are the living descendants of theropod dinosaurs.`,
  },
  // ── Math ──
  {
    match: (q) => /what is \d+[\s]*[+\-*/×÷][\s]*\d+/.test(q),
    answer: (q) => {
      const m = q.match(/(\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:\.\d+)?)/);
      if (!m) return "";
      const a = parseFloat(m[1]), op = m[2], b = parseFloat(m[3]);
      let result: number;
      if (op === "+" ) result = a + b;
      else if (op === "-") result = a - b;
      else if (op === "*" || op === "×") result = a * b;
      else if (op === "/" || op === "÷") result = b !== 0 ? a / b : NaN;
      else return "";
      if (isNaN(result)) return `Cannot divide by zero.`;
      return `${a} ${op} ${b} = **${result}**\n\nCalculated directly by Puei Copilot's math engine. All four search sources confirmed the result.`;
    },
  },
  // ── Food ──
  {
    match: (q) => q.includes("pizza"),
    answer: () =>
      `Pizza is a dish originating from Naples, Italy, consisting of a flat, round bread dough topped with tomato sauce, cheese (typically mozzarella), and various toppings such as vegetables, meats, or seafood, then baked in a hot oven. It became globally popular in the 20th century, with major variations including Neapolitan (thin, soft crust), New York-style (large, foldable slices), Chicago deep-dish, and many regional styles worldwide.`,
  },
  {
    match: (q) => q.includes("spaghetti") || q.includes("pasta"),
    answer: () =>
      `Pasta is an Italian food made from durum wheat semolina dough shaped into various forms — spaghetti (long thin strands), penne, rigatoni, fusilli, lasagne, and hundreds more. It is typically boiled in salted water and served with a sauce. Spaghetti is commonly paired with tomato-based sauces (like bolognese or marinara), carbonara (eggs, cheese, pancetta), or aglio e olio (garlic, olive oil, chilli).`,
  },
  // ── Sports ──
  {
    match: (q) => q.includes("football") || q.includes("soccer"),
    answer: () =>
      `Football (known as soccer in the USA and Canada) is the world's most popular sport, with an estimated 4 billion fans. Two teams of 11 players try to score by getting the ball into the opposing goal using any body part except hands and arms (goalkeepers excepted). A standard match lasts 90 minutes (two 45-minute halves). The FIFA World Cup, held every 4 years, is the most-watched sporting event on Earth. Brazil has won it the most times (5).`,
  },
  {
    match: (q) => q.includes("basketball"),
    answer: () =>
      `Basketball is a sport invented by Dr. James Naismith in 1891 in the USA. Two teams of 5 players try to score by shooting a ball through the opposing team's hoop (10 feet/3 m high). Games have four 12-minute quarters (NBA) or two 20-minute halves (FIBA). The NBA (National Basketball Association) is the premier professional league. Famous players include Michael Jordan, LeBron James, and Kobe Bryant.`,
  },
  // ── PueiOS-specific ──
  {
    match: (q) => q.includes("pueios") || q.includes("puei os"),
    answer: () =>
      `PueiOS 2 is an alternate-universe operating system with a Windows 7 Aero-inspired glass UI, built as a web app. It features draggable windows with real glass blur effects, a cloud-synced account system (your profile, files, and settings follow you across every browser), PueiCloudChat, PueiSocial, Puei Paint, a Calculator, Notepad, an App Store, and the PueiWeb browser.`,
  },
  {
    match: (q) => q.includes("pueio number") || q.includes("puei number"),
    answer: () =>
      `A Pueio Number is a unique 6-digit identifier assigned to every PueiOS account. It works like a phone number for PueiCloudChat — you can add friends by their Pueio Number and send them messages.`,
  },
  {
    match: (q) => q.includes("puei messenger") || q.includes("pueicloudchat") || q.includes("cloud chat"),
    answer: () =>
      `PueiCloudChat is PueiOS 2's built-in chat app. Add friends using their Pueio Number, start conversations, and send messages. All messages sync across browsers when you're logged in.`,
  },
  {
    match: (q) => q.includes("puei paint"),
    answer: () =>
      `Puei Paint 2 is the built-in drawing app. Draw with different brush sizes and colors, save artwork as image files, and set a painting as your desktop wallpaper via Settings → Wallpaper.`,
  },
];

/** Generate a relevant answer for any search query. */
function generateCopilotAnswer(q: string): string {
  const lq = q.toLowerCase().replace(/[?!.,]/g, "");

  // Try knowledge base first
  for (const entry of KNOWLEDGE) {
    if (entry.match(lq)) {
      const ans = entry.answer(lq);
      if (ans) return ans;
    }
  }

  // "how to" / "how do" questions — give structured steps
  if (/how (to|do|does|can|should)/.test(lq)) {
    const action = q.replace(/^how (to|do|does|can|should)( i| you| we)?\s+/i, "").trim();
    return (
      `Here's how to ${action}:\n\n` +
      `Based on results aggregated from Google, Edge, Firefox, and Opera:\n\n` +
      `1. Research the specific requirements or prerequisites for "${action}"\n` +
      `2. Gather the necessary tools, materials, or knowledge beforehand\n` +
      `3. Follow authoritative step-by-step guides (manuals, official documentation, or expert tutorials)\n` +
      `4. Practice or test carefully — start small if possible\n` +
      `5. Adjust based on results and consult additional sources if needed\n\n` +
      `All four search engines returned consistent guidance on this topic.`
    );
  }

  // "what is" / "who is" — extract topic and give a real-sounding answer
  const whatMatch = lq.match(/^(what is|what are|who is|who are|what was|who was)\s+(.+)/);
  if (whatMatch) {
    const topic = whatMatch[2].trim();
    const capitalised = topic.charAt(0).toUpperCase() + topic.slice(1);
    return (
      `${capitalised} — here's what Puei Copilot found across Google, Edge, Firefox, and Opera:\n\n` +
      `${capitalised} is a topic well-covered in encyclopedias, academic sources, and news databases. ` +
      `All four search sources returned consistent, reliable results with no major discrepancies.\n\n` +
      `For a precise and detailed answer, the most authoritative sources are Wikipedia, official organisation websites, or peer-reviewed articles. ` +
      `You can browse these using PueiWeb (enter a *.base44.app URL) or by asking a more specific follow-up question here.`
    );
  }

  // Math quick-calc fallback
  const mathMatch = q.match(/(\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]), op = mathMatch[2], b = parseFloat(mathMatch[3]);
    let result: number;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*" || op === "×") result = a * b;
    else if (op === "/" || op === "÷") result = b !== 0 ? a / b : NaN;
    else result = NaN;
    if (!isNaN(result)) return `${a} ${op} ${b} = **${result}**\n\nCalculated by Puei Copilot's built-in math engine.`;
  }

  // General fallback — still gives a real-feeling answer
  return (
    `Here's what Puei Copilot found for "${q}" across Google, Edge, Firefox, and Opera:\n\n` +
    `This topic appears in reference articles, educational content, news archives, and community discussions. ` +
    `All four search sources agree the information is widely available and consistent.\n\n` +
    `Key findings:\n` +
    `• Multiple authoritative sources cover this topic in depth\n` +
    `• No conflicting or misleading information was detected across the four search engines\n` +
    `• Untrusted and spam sources were filtered automatically\n\n` +
    `Try rephrasing your question with more detail (e.g. "how does a bulldozer work", "what is gravity") for a more specific answer from Puei Copilot.`
  );
}

function PueiCopilotPage() {
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [results, setResults] = useState<{ source: string; title: string; summary: string }[] | null>(null);
  const [answer, setAnswer] = useState("");

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    setThinking(true); setResults(null); setAnswer("");
    blip("click");
    setTimeout(() => {
      const count1 = Math.floor(Math.random() * 900000) + 100000;
      const count2 = Math.floor(Math.random() * 90000) + 10000;
      const blocked = Math.floor(Math.random() * 5) + 1;
      const sources = [
        { source: "Google", title: `${q} — Overview`, summary: `Google: Found ${count1.toLocaleString()} results. Top results include reference articles, encyclopedias, and news. Authoritative sources verified.` },
        { source: "Edge", title: `${q} — Microsoft Search`, summary: `Edge / Bing: Found ${count2.toLocaleString()} results. Multiple authoritative pages with consistent information confirmed.` },
        { source: "Firefox", title: `${q} — Community sources`, summary: `Firefox: Community-curated results from open encyclopedias, forums, and educational sites. ${blocked} blocked sources filtered automatically.` },
        { source: "Opera", title: `${q} — Global search`, summary: `Opera: Surfaced in international news and reference databases. Cross-referenced with Google and Edge — results are consistent.` },
      ];
      setResults(sources);
      setAnswer(generateCopilotAnswer(q));
      setThinking(false);
    }, 1200 + Math.random() * 700);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto h-full overflow-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">✨</div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--accent)" }}>Puei Copilot</h1>
          <p className="text-[11px] opacity-60">AI assistant · gathers from Google · Edge · Firefox · Opera · filters untrusted sources automatically</p>
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
          className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none input-field" style={{ border: "2px solid oklch(0.65 0.18 var(--accent-h))" }}
          placeholder="Ask Puei Copilot or search anything…" />
        <button className="aero-button rounded-full px-5 py-2 text-sm font-semibold" onClick={() => doSearch(query)}>Search</button>
      </div>
      {thinking && (
        <div className="aero-glass-light rounded-xl p-4 mb-4 text-sm flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60 flex-shrink-0" />
          Puei Copilot is searching Google, Edge, Firefox, and Opera and generating your answer…
        </div>
      )}
      {answer && (
        <div className="aero-glass-light rounded-xl p-4 mb-4 border" style={{ borderColor: "oklch(0.65 0.18 var(--accent-h) / 0.3)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "var(--gradient-aero)", color: "white" }}>✨</div>
            <div className="font-semibold text-sm">Puei Copilot Summary</div>
          </div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">
            {answer.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
        </div>
      )}
      {results && (
        <div className="space-y-2">
          <div className="text-[10px] opacity-50 font-semibold tracking-wider mb-2">SOURCES</div>
          {results.map((r) => (
            <div key={r.source} className="aero-glass-light rounded-lg p-3 flex items-start gap-3">
              <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: "var(--gradient-aero)", color: "white" }}>
                {r.source[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{r.source} — {r.title}</div>
                <div className="text-xs opacity-70 mt-0.5 leading-relaxed">{r.summary}</div>
              </div>
            </div>
          ))}
          <div className="text-[10px] opacity-40 flex items-center gap-1 pt-2">
            🛡️ Untrusted and blocked sources filtered automatically by Pueios2 security policies.
          </div>
        </div>
      )}
      {!thinking && !results && !answer && (
        <div className="space-y-3">
          <div className="text-[10px] opacity-50 font-semibold tracking-wider">SUGGESTIONS</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              "What is PueiOS 2?", "How do Pueio Numbers work?",
              "Tell me about PueiCloudChat", "What apps are in the App Store?",
            ].map((q) => (
              <button key={q} className="aero-glass-light rounded-lg p-3 text-xs text-left hover:bg-white/30"
                onClick={() => { setQuery(q); doSearch(q); }}>
                <span className="opacity-50">💡</span> {q}
              </button>
            ))}
          </div>
          <div className="text-[10px] opacity-40 mt-4 flex items-center gap-1">
            ✨ Puei Copilot supports: Google · Edge · Firefox · Opera
          </div>
        </div>
      )}
    </div>
  );
}

function PueiNetIframe({ url, hostname }: { url: string; hostname: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [url]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!loaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, opacity: 0.5 }}>
          <div style={{ fontSize: 32 }}>🌍</div>
          <div style={{ fontSize: 13 }}>Loading {hostname}…</div>
        </div>
      )}
      <iframe
        src={url}
        title={hostname}
        style={{ width: "100%", height: "100%", border: "none", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
        allow="fullscreen; autoplay; camera; microphone"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

// ---------- PueiWeb ----------
function PueiWebApp({ currentUser, users, icons }: { currentUser: string; users: User[]; icons: DesktopIcon[] }) {
  const [tabs, setTabs] = useState([{ id: 1, title: "Home", url: "puei://home" }]);
  const [active, setActive] = useState(1);
  const navUrl = tabs.find((t) => t.id === active)?.url ?? "puei://home";
  const [urlBar, setUrlBar] = useState("puei://home");
  const [isoRefresh, setIsoRefresh] = useState(0);

  useEffect(() => {
    const fn = () => setIsoRefresh((v) => v + 1);
    window.addEventListener("pueios-files-changed", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-files-changed", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);

  const allIsoFiles = loadFiles().filter((f) =>
    f.type === "text" &&
    (!f.owner || f.owner === currentUser) &&
    f.folder === SYS_FOLDER_DOWNLOADS &&
    ["pueios2-plus.iso", "pueios2plus.iso", "pueios3.iso"].includes(f.name.trim().toLowerCase())
  );
  const isoFile = allIsoFiles.find((f) => ["pueios2-plus.iso", "pueios2plus.iso"].includes(f.name.trim().toLowerCase()));
  const iso3File = allIsoFiles.find((f) => f.name.trim().toLowerCase() === "pueios3.iso");
  const updaterInstalled = icons.some((i) => i.appId === "web-app" && i.webUrl === "puei://updates" && i.label.trim().toLowerCase() === "puei updater");

  const downloadPlusIso = () => {
    if (isoFile) { blip("click"); alert("PueiOS 2+ ISO is already downloaded in Files."); return; }
    upsertFile({
      id: `iso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: "pueios2-plus.iso",
      type: "text",
      content: "PueiOS 2+ installation ISO image placeholder.",
      updatedAt: Date.now(),
      owner: currentUser,
      folder: SYS_FOLDER_DOWNLOADS,
    });
    setIsoRefresh((v) => v + 1);
    blip("notify");
  };

  const downloadOs3Iso = () => {
    if (iso3File) { blip("click"); alert("PueiOS 3 ISO is already downloaded in Files."); return; }
    upsertFile({
      id: `iso3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: "pueios3.iso",
      type: "text",
      content: "PueiOS 3 installation ISO image placeholder. Keep this file in Files/Downloads, then open Puei Updater and drag the ISO into it.",
      updatedAt: Date.now(),
      owner: currentUser,
      folder: SYS_FOLDER_DOWNLOADS,
    });
    setIsoRefresh((v) => v + 1);
    blip("notify");
  };

  const deleteIsoAfterUpdate = () => {
    const target = iso3File || isoFile;
    if (!target) return;
    deleteFile(target.id);
    setIsoRefresh((v) => v + 1);
    blip("click");
  };

  const makeWaveWallpaper = (name: string, left: string, right: string, glow: string, stars = false) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'>
      <defs>
        <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#02164f'/>
          <stop offset='58%' stop-color='#04318f'/>
          <stop offset='100%' stop-color='#010c3c'/>
        </linearGradient>
        <linearGradient id='waveA' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stop-color='${left}'/>
          <stop offset='100%' stop-color='${right}'/>
        </linearGradient>
        <radialGradient id='halo' cx='50%' cy='68%' r='45%'>
          <stop offset='0%' stop-color='${glow}' stop-opacity='0.95'/>
          <stop offset='100%' stop-color='${glow}' stop-opacity='0'/>
        </radialGradient>
      </defs>
      <rect width='1920' height='1080' fill='url(#bg)'/>
      <ellipse cx='960' cy='730' rx='760' ry='290' fill='url(#halo)'/>
      <path d='M-20 680 C 260 520, 560 860, 960 760 C 1360 660, 1620 840, 1940 720 L 1940 1080 L -20 1080 Z' fill='url(#waveA)' opacity='0.36'/>
      <path d='M-20 640 C 240 480, 560 780, 960 720 C 1380 660, 1680 760, 1940 650' fill='none' stroke='${left}' stroke-width='4' opacity='0.7'/>
      <path d='M-20 700 C 340 620, 720 860, 1120 760 C 1540 640, 1720 700, 1940 690' fill='none' stroke='${right}' stroke-width='3.5' opacity='0.62'/>
      ${stars ? "<circle cx='1420' cy='330' r='5' fill='#7fd3ff'/><circle cx='1360' cy='370' r='4' fill='#7fd3ff'/><circle cx='1290' cy='420' r='3.5' fill='#7fd3ff'/><circle cx='1510' cy='470' r='3' fill='#7fd3ff'/>" : ""}
    </svg>`;
    return {
      name,
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    };
  };

  const wallpaperPack = [
    makeWaveWallpaper("Puei Wave Blue", "#65d9ff", "#0ba9ff", "#8bdcff", true),
    makeWaveWallpaper("Puei Wave Aurora", "#6ce1ff", "#ff86d8", "#b8dfff", true),
    makeWaveWallpaper("Puei Wave Neon", "#38ceff", "#ff4db6", "#8cd6ff", true),
    makeWaveWallpaper("Puei Dusk Lake", "#5ad0ff", "#ffb06f", "#89bcff", false),
  ];

  const downloadWallpaper = (w: { name: string; dataUrl: string }) => {
    const folder = chooseImageDestination("pictures");
    if (folder === null) return;
    saveDownloadedImage(currentUser, `${w.name}.png`, w.dataUrl, folder);
    blip("notify");
    alert(`Saved ${w.name} to ${destinationFolderLabel(folder)}.`);
  };

  const pageTitles: Record<string, string> = {
    "puei://home": "Home", "puei://search": "Puei Copilot", "puei://about": "About",
    "puei://updates": "Updates", "puei://social": "PueiSocial", "puei://board": "PueiBoard",
    "puei://wallpapers": "Wallpapers", "puei://chat": "Chat", "puei://os3": "PueiOS 3",
    "puei://films": "Puei Films",
  };
  const navigate = (target: string) => {
    let u = target.trim();
    if (!u.startsWith("puei://") && !/^https?:\/\//i.test(u)) u = "https://" + u;
    const title = pageTitles[u] || (u.startsWith("http") ? (() => { try { return new URL(u).hostname; } catch { return u; } })() : u.replace("puei://", "").replace(/^\w/, (c) => c.toUpperCase()) || "Page");
    setUrlBar(u);
    setTabs((t) => t.map((tab) => tab.id === active ? { ...tab, url: u, title } : tab));
  };

  const fakeSites: Record<string, React.ReactNode> = {
    "puei://home": (
      <div className="p-8 text-center">
        <h1 className="text-5xl font-bold" style={{ color: "var(--accent)" }}>PueiNet</h1>
        <p className="opacity-70 mt-2">The retro-futuristic web, circa 2020.</p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            ["puei://board", "📌 PueiBoard"],
            ["puei://updates", "⬆️ Puei Updates"],
            ["puei://search", "✨ Puei Copilot"],
            ["puei://forum", "💼 PueiForum"],
            ["puei://wallpapers", "🖼️ Puei Wallpapers"],
            ["puei://films", "🎬 Puei Films"],
            ["puei://os3", "🚀 PueiOS 3"],
            ["puei://about", "ℹ️ About"],
          ].map(([u, l]) => (
            <button key={u} onClick={() => navigate(u)} className="aero-button rounded-lg p-4">{l}</button>
          ))}
        </div>
      </div>
    ),
    "puei://forum": (
      <div className="p-6 space-y-6 text-sm">
        <div>
          <h2 className="text-2xl font-bold mb-1">💼 Puei Forum</h2>
          <p className="opacity-60 text-xs">The largest community for all Puei and PueiOS 2 users.</p>
        </div>
        <div>
          <div className="font-semibold mb-2 opacity-80">Talk about:</div>
          <ul className="space-y-1 opacity-70 list-disc list-inside">
            <li>Puei lore</li>
            <li>PueiOS 2 updates</li>
            <li>PueiWeb AI</li>
            <li>PueiCloudChat</li>
            <li>Pueio Videos</li>
            <li>Custom themes</li>
            <li>Bugs</li>
            <li>Concepts</li>
            <li>Memes</li>
            <li>Fan art</li>
            <li>Beta builds</li>
            <li>Old PueiOS versions</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2 opacity-80">🔥 Popular discussions:</div>
          <ul className="space-y-1 opacity-70 list-disc list-inside">
            <li>"Why was old PueiOS 2 smoother?"</li>
            <li>"Rate my Puei desktop."</li>
            <li>"Best Base44 apps for PueiOS 2"</li>
            <li>"Puei Copilot answered something weird."</li>
            <li>"Rare puei colors thread"</li>
            <li>"PueiOS 3 leaked screenshots"</li>
            <li>"How to restore files from Recycle Bin"</li>
            <li>"Dark mode vs High Contrast mode"</li>
            <li>"Pueian Rosos hidden concepts"</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2 opacity-80">📋 Forum Rules:</div>
          <ul className="space-y-1 opacity-70 list-disc list-inside">
            <li>No corrupted files</li>
            <li>No fake Pueio Numbers</li>
            <li>No untrusted URLs</li>
            <li>Respect other puei users</li>
            <li>No unofficial AppStore apps</li>
            <li>Only Base44 apps allowed</li>
          </ul>
        </div>
        <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" }}>
          <div className="text-xs opacity-50 mb-1">🔥 Trending</div>
          <div className="opacity-80">"My puei deleted my desktop shortcuts again 💇"</div>
        </div>
      </div>
    ),
    "puei://board": (
      <div className="h-full overflow-auto">
        <PueiBoardApp user={currentUser} users={users} />
      </div>
    ),
    "puei://updates": (
      <div className="p-6 space-y-4 max-w-2xl">
        <h2 className="text-2xl font-bold">⬆️ Puei Updates</h2>
        <p className="text-sm opacity-75">Download an ISO, install Puei Updater from the App Store, then open it and drag the ISO in.</p>

        <div className="text-sm">
          Puei Updater: {updaterInstalled ? <span className="font-semibold text-green-500">Installed</span> : <span className="font-semibold text-amber-500">Not installed</span>}
        </div>

        {/* PueiOS 2 */}
        <div className="aero-glass-light rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">PueiOS 2</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(220,50,50,0.18)", color: "#f87171" }}>End of Life</span>
          </div>
          <p className="text-xs opacity-60">The original PueiOS 2 release.</p>
          <p className="text-xs" style={{ color: "#f87171" }}>As of June 6th, PueiOS 2 is no longer supported. No download available.</p>
        </div>

        {/* PueiOS 2+ */}
        <div className="aero-glass-light rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">PueiOS 2+</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(220,50,50,0.18)", color: "#f87171" }}>End of Life</span>
            {isoFile && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(80,200,120,0.2)", color: "#4ade80" }}>Downloaded</span>}
          </div>
          <p className="text-xs opacity-60">Advanced edition with stronger sync and AI systems.</p>
          <p className="text-xs" style={{ color: "#f87171" }}>As of June 6th, PueiOS 2+ is no longer supported. We recommend upgrading to PueiOS 3.</p>
          <div className="flex gap-2">
            <button className="aero-button rounded px-3 py-1.5 text-xs" onClick={downloadPlusIso} style={{ opacity: 0.65 }}>
              ⬇ {isoFile ? "Re-download pueios2-plus.iso" : "Download pueios2-plus.iso"}
            </button>
          </div>
        </div>

        {/* PueiOS 3 */}
        <div className="aero-glass-light rounded-xl p-4 space-y-2" style={{ border: "1px solid rgba(80,180,255,0.3)" }}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">PueiOS 3</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(80,180,255,0.2)", color: "#60a5fa" }}>Latest</span>
            {iso3File && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(80,200,120,0.2)", color: "#4ade80" }}>Downloaded</span>}
          </div>
          <p className="text-xs opacity-60">Major release: redesigned shell, new AI assistant, PueiNet 3.0.</p>
          <div className="flex gap-2">
            <button className="aero-button rounded px-3 py-1.5 text-xs" onClick={downloadOs3Iso}>
              ⬇ {iso3File ? "Re-download pueios3.iso" : "Download pueios3.iso"}
            </button>
          </div>
          {updaterInstalled && iso3File && (
            <div className="text-xs rounded px-3 py-2 mt-1" style={{ background: "rgba(80,200,120,0.16)" }}>
              Ready to install! Open Puei Updater from your desktop and drag pueios3.iso into the install zone.
            </div>
          )}
        </div>

        {/* Pueio Reverse */}
        <div className="aero-glass-light rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">🔄 Pueio Reverse</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(120,40,200,0.25)", color: "#c084fc" }}>Legacy</span>
          </div>
          <p className="text-xs opacity-70">Pueio Reverse lets you load ISOs whose support has ended. The system will show an end-of-support warning before booting.</p>
          <p className="text-xs opacity-50">To use: download any ISO, open it from Files, and click "Boot with Pueio Reverse".</p>
        </div>
      </div>
    ),
    "puei://mail": null,
    "puei://os3": (
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h2 className="text-3xl font-bold">🚀 PueiOS 3</h2>
          <p className="text-sm opacity-60 mt-1">Exclusive features available only on PueiOS 3.</p>
        </div>

        {([
          { icon: "✨", title: "Puei AI Assistant", desc: "Desktop Integration", items: ["Talk to Puei Copilot from anywhere — click the mascot on your desktop.", "Search files, chats, mails, and apps with one query."] },
          { icon: "🪟", title: "Virtual Desktops", desc: "Multi-workspace support", items: ["Work Desktop", "Gaming Desktop", "School Desktop"] },
          { icon: "🧩", title: "Puei Widgets", desc: "Always-on desktop panels", items: ["Clock", "Weather", "Notes", "Pueio Numbers", "Recent Messages"] },
          { icon: "🎨", title: "Puei Themes Store", desc: "Community-made themes", items: ["Download themes made by users", "Windows 7 style theme", "Vista style theme", "Retro PueiOS 2 theme"] },
          { icon: "🛡️", title: "Puei Recovery", desc: "System restore & recovery", items: ["Restore previous system versions", "Recover deleted apps and files"] },
          { icon: "🏆", title: "Puei Achievements", desc: "Hidden OS badges", items: ["Hidden badges for exploring the OS"] },
          { icon: "🎬", title: "Puei Live Wallpapers", desc: "Animated backgrounds", items: ["Animated wallpapers with flying Puei"] },
          { icon: "👤", title: "Puei Account Dashboard", desc: "Full account control", items: ["View all synced devices", "Manage storage", "Manage security settings"] },
        ] as { icon: string; title: string; desc: string; items: string[] }[]).map(({ icon, title, desc, items }) => (
          <div key={title} className="aero-glass-light rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{icon}</span>
              <div>
                <div className="font-semibold">{title}</div>
                <div className="text-xs opacity-50">{desc}</div>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded" style={{ background: "rgba(80,180,255,0.18)", color: "#60a5fa" }}>PueiOS 3</span>
            </div>
            <ul className="space-y-1 pl-1">
              {items.map((item) => (
                <li key={item} className="text-sm opacity-75 flex items-start gap-2">
                  <span className="opacity-40 mt-0.5">›</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
    "puei://wallpapers": (
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">🖼️ Puei Wallpapers</h2>
          <p className="text-xs opacity-70 mt-1">Generated Aero-style wallpaper pack. Click Download to save into Pictures, Downloads, or Desktop.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {wallpaperPack.map((w) => (
            <div key={w.name} className="aero-glass-light rounded-xl p-3">
              <img src={w.dataUrl} alt={w.name} className="w-full h-36 object-cover rounded-lg" />
              <div className="mt-2 text-sm font-semibold">{w.name}</div>
              <button className="aero-button rounded-md px-3 py-1 text-xs mt-2"
                onClick={() => downloadWallpaper(w)}>
                ⬇ Download
              </button>
            </div>
          ))}
        </div>
      </div>
    ),
    "puei://about": <div className="p-6"><h2 className="text-2xl font-bold">About PueiNet</h2><p className="text-sm opacity-70 mt-2">A browser for an alternate 2020. Only https://&lt;app&gt;.base44.app external URLs are trusted.</p></div>,
  };

  let content: React.ReactNode;
  if (navUrl === "puei://search") {
    content = <PueiCopilotPage />;
  } else if (navUrl === "puei://films") {
    content = <PueiFilmsPage currentUser={currentUser} />;
  } else if (navUrl.startsWith("puei://")) {
    content = fakeSites[navUrl] || <div className="p-6">404 — page not found in this universe.</div>;
  } else {
    let loadUrl = navUrl.trim();
    if (!/^https?:\/\//i.test(loadUrl)) loadUrl = "https://" + loadUrl;
    let hostname = "";
    try { hostname = new URL(loadUrl).hostname; } catch {}
    content = <PueiNetIframe key={loadUrl} url={loadUrl} hostname={hostname} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex items-center gap-1 px-2 pt-1">
        {tabs.map((t) => (
          <div key={t.id} onClick={() => { setActive(t.id); setUrlBar(t.url); }}
            className="px-3 py-1 rounded-t-md text-xs cursor-pointer"
            style={{
              background: active === t.id ? "var(--glass-strong)" : "var(--glass)",
              border: "1px solid var(--border)", borderBottom: "none",
            }}>
            {t.title} <span onClick={(e) => { e.stopPropagation(); setTabs(tabs.filter(x => x.id !== t.id)); }} className="ml-2 opacity-60 hover:opacity-100">✕</span>
          </div>
        ))}
        <button className="aero-button rounded px-2 py-0.5 text-xs ml-1"
          onClick={() => { const id = Date.now(); setTabs((t) => [...t, { id, title: "Home", url: "puei://home" }]); setActive(id); setUrlBar("puei://home"); }}>+</button>
      </div>
      <div className="aero-titlebar flex items-center gap-2 px-2 py-1">
        <button className="aero-button rounded px-2 py-0.5 text-xs" onClick={() => navigate("puei://home")}>🏠</button>
        <button className="aero-button rounded px-2 py-0.5 text-xs" onClick={() => navigate("puei://search")}>✨</button>
        <input value={urlBar} onChange={(e) => setUrlBar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") navigate(urlBar); }}
          className="flex-1 rounded-full px-3 py-1 text-xs outline-none"
          style={{ background: "white", border: "1px solid var(--accent)", boxShadow: "0 0 6px oklch(var(--accent) / 0.5)" }} />

      </div>
      <div className="flex-1 overflow-auto">
        {content}
      </div>
    </div>
  );
}

// ---------- PueiMail ----------
const SYSTEM_FOLDERS: { id: MailFolderId; label: string; icon: string }[] = [
  { id: "inbox", label: "Inbox", icon: "📑" },
  { id: "important", label: "Important", icon: "⭐" },
  { id: "drafts", label: "Drafts", icon: "📝" },
  { id: "sent", label: "Sent", icon: "📧" },
  { id: "spam", label: "Spam", icon: "🚫" },
  { id: "trash", label: "Trash", icon: "🖦️" },
];

function readFileAsAttachment(file: File): Promise<MailAttachment> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const kind: MailAttachment["kind"] =
        file.type.startsWith("image/") ? "image" :
        file.type.startsWith("video/") ? "video" : "file";
      resolve({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name, kind, mime: file.type || "application/octet-stream",
        size: file.size, dataUrl: String(r.result), savedAt: Date.now(),
      });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function downloadAttachment(att: MailAttachment, owner: string) {
  if (att.kind === "image") {
    const folder = chooseImageDestination("downloads");
    if (folder === null) return { cancelled: true, destination: "Cancelled" };
    saveDownloadedImage(owner, att.name, att.dataUrl, folder);
    return { cancelled: false, destination: destinationFolderLabel(folder) };
  }
  const a = document.createElement("a");
  a.href = att.dataUrl; a.download = att.name;
  document.body.appendChild(a); a.click(); a.remove();
  return { cancelled: false, destination: "Browser download" };
}

function PueiMailApp({ currentUser, users }: { currentUser: string; users: User[] }) {
  const [folder, setFolder] = useState<MailFolderId>("inbox");
  const [msgs, setMsgs] = useState<MailMessage[]>(() => loadMail(currentUser));
  const [customFolders, setCustomFolders] = useState<string[]>(() => loadMailFolders(currentUser));
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [composing, setComposing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });
  const [pending, setPending] = useState<MailAttachment[]>([]);
  const [sendStatus, setSendStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showAttachmentsView, setShowAttachmentsView] = useState(false);
  const [showDownloadsView, setShowDownloadsView] = useState(false);
  const [downloads, setDownloads] = useState<DownloadEntry[]>(() => loadDownloads(currentUser));
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () => setMsgs(loadMail(currentUser));
  const myAddress = mailAddressFor(currentUser);

  useEffect(() => {
    const fn = () => reload();
    const fnDl = () => setDownloads(loadDownloads(currentUser));
    window.addEventListener("pueios-mail", fn);
    window.addEventListener("storage", fn);
    window.addEventListener("pueios-downloads", fnDl);
    return () => {
      window.removeEventListener("pueios-mail", fn);
      window.removeEventListener("storage", fn);
      window.removeEventListener("pueios-downloads", fnDl);
    };
  }, [currentUser]);

  const me = users.find((u) => u.name === currentUser);
  const myPueiNum = me?.pueiNumber || "";
  const myMailKey = myPueiNum || currentUser;

  // Cloud sync: pull full mailbox snapshot for this user (cross-device sync)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mail?owner=${encodeURIComponent(myMailKey)}&mode=full`);
        if (!res.ok || cancelled) return;
        const remote = await res.json();
        if (remote && Array.isArray(remote)) {
          // Merge: server wins for entries with later `at`; keep local-only too
          const local = loadMail(currentUser);
          const byId = new Map<string, MailMessage>();
          for (const m of local) byId.set(m.id, m);
          for (const m of remote as MailMessage[]) {
            const ex = byId.get(m.id);
            if (!ex || (m.at >= ex.at)) byId.set(m.id, m);
          }
          replaceMailFor(currentUser, [...byId.values()]);
          reload();
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Push full mailbox snapshot to cloud on changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: myMailKey, mailbox: loadMail(currentUser) }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [msgs, currentUser, myMailKey]);

  // Poll inbox for new mail every 4s
  useEffect(() => {
    if (!myMailKey) return;
    let cancelled = false;
    const seen = new Set<string>(loadMail(currentUser).map((m) => m.id));
    const poll = async () => {
      try {
        const res = await fetch(`/api/mail?owner=${encodeURIComponent(myMailKey)}`);
        if (!res.ok || cancelled) return;
        const remote = (await res.json()) as Array<{ id: string; from: string; to: string; subject: string; body: string; at: number; attachments?: MailAttachment[] }>;
        const fresh = remote.filter((m) => !seen.has(m.id));
        if (!fresh.length) return;
        fresh.forEach((m) => seen.add(m.id));
        const cur = loadMail(currentUser);
        const newOnes: MailMessage[] = fresh.map((m) => ({
          id: m.id, from: m.from, to: m.to, subject: m.subject, body: m.body, at: m.at,
          read: false, folder: isLikelySpam(m) ? "spam" : "inbox", owner: currentUser,
          attachments: m.attachments,
        }));
        replaceMailFor(currentUser, [...cur, ...newOnes]);
        reload();
        blip("notify");
      } catch {}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser]);

  const updateMsg = (patch: (m: MailMessage) => MailMessage, id: string) => {
    const updated = msgs.map((m) => (m.id === id ? patch(m) : m));
    setMsgs(updated); saveMail(updated);
  };

  const deleteMsg = (id: string, perm = false) => {
    if (perm) {
      const updated = msgs.filter((m) => m.id !== id);
      setMsgs(updated); saveMail(updated);
    } else {
      updateMsg((m) => ({ ...m, folder: "trash" }), id);
    }
    if (selected?.id === id) setSelected(null);
  };

  const matchFolder = (m: MailMessage) => {
    if (folder === "important") return m.important && m.folder !== "trash";
    if (folder === "spam") return m.folder === "spam";
    if (folder === "trash") return m.folder === "trash";
    if (folder === "drafts") return m.folder === "drafts";
    if (folder === "inbox") return m.folder === "inbox";
    if (folder === "sent") return m.folder === "sent";
    return m.folder === folder; // custom folder id
  };

  const folderMsgs = msgs
    .filter(matchFolder)
    .filter((m) => !search.trim() || `${m.subject} ${m.body} ${m.from} ${m.to}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.at - a.at);

  const unread = (fid: MailFolderId) => msgs.filter((m) => m.folder === fid && !m.read).length;

  const allAttachments = msgs.flatMap((m) => (m.attachments || []).map((a) => ({ ...a, mailId: m.id, from: m.from, subject: m.subject })));

  const handleAttachClick = () => fileInput.current?.click();
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = await Promise.all([...files].map(readFileAsAttachment));
    setPending([...pending, ...list]);
  };

  const saveDraft = () => {
    if (!draft.to && !draft.subject && !draft.body && pending.length === 0) return;
    const id = draftId || `draft-${Date.now().toString(36)}`;
    const d: MailMessage = {
      id, from: currentUser, to: draft.to, subject: draft.subject, body: draft.body,
      at: Date.now(), read: true, folder: "drafts", owner: currentUser, attachments: pending,
    };
    const others = msgs.filter((m) => m.id !== id);
    const updated = [...others, d];
    setMsgs(updated); saveMail(updated);
    setDraftId(id);
    setSendStatus("✔ Draft saved!");
    setTimeout(() => setSendStatus(""), 2000);
  };

  const doSend = () => {
    const raw = draft.to.trim();
    if (!raw) { setSendStatus("Enter a recipient Puei Number."); return; }
    if (!draft.subject.trim()) { setSendStatus("Enter a subject."); return; }
    // Resolve to a name for local delivery; also get Puei Number for server delivery
    const resolved = resolveMailRecipient(raw, users) ?? raw;
    // Determine server inbox key: prefer Puei Number of recipient
    const recipientUser = users.find((u) => u.name === resolved);
    const toKey = recipientUser?.pueiNumber || ((/^\d{3}-\d{3}-\d{3}$/.test(raw.replace(/-/g,"").replace(/(\d{3})(\d{3})(\d{3})/,"$1-$2-$3"))) ? raw.replace(/-/g,"").replace(/(\d{3})(\d{3})(\d{3})/,"$1-$2-$3") : resolved);
    sendMail(currentUser, resolved, draft.subject.trim(), draft.body, users, pending);
    // Deliver to server inbox using Puei Number key
    fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: myMailKey || currentUser, to: toKey, subject: draft.subject.trim(), body: draft.body, attachments: pending }),
    }).catch(() => {});
    // Drop draft if any
    if (draftId) {
      const updated = msgs.filter((m) => m.id !== draftId);
      setMsgs(updated); saveMail(updated);
    }
    setDraft({ to: "", subject: "", body: "" }); setPending([]); setDraftId(null);
    setComposing(false); setSendStatus(""); setFolder("sent");
    reload(); blip("notify");
  };

  const openCompose = (presets?: { to?: string; subject?: string; body?: string; draftId?: string; attachments?: MailAttachment[] }) => {
    setDraft({ to: presets?.to ?? "", subject: presets?.subject ?? "", body: presets?.body ?? "" });
    setPending(presets?.attachments ?? []);
    setDraftId(presets?.draftId ?? null);
    setComposing(true); setSelected(null); setShowAttachmentsView(false); setShowDownloadsView(false);
    blip("click");
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts), now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const addCustomFolder = () => {
    const name = prompt("Folder name?")?.trim();
    if (!name) return;
    const id = `f-${Date.now().toString(36)}`;
    const next = [...customFolders, `${id}|${name}`];
    setCustomFolders(next); saveMailFolders(currentUser, next);
  };

  const moveToFolder = (id: string, fid: MailFolderId) => updateMsg((m) => ({ ...m, folder: fid }), id);

  return (
    <div className="flex h-full" style={{ background: "var(--glass)" }}>
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 p-3 border-r flex flex-col gap-1 overflow-y-auto" style={{ background: "var(--glass)" }}>
        <button className="aero-button rounded-lg px-3 py-2 text-sm font-semibold mb-2 w-full"
          onClick={() => openCompose()}>✅ Compose</button>
        {SYSTEM_FOLDERS.map((f) => (
          <div key={f.id} onClick={() => { setFolder(f.id); setSelected(null); setShowAttachmentsView(false); setShowDownloadsView(false); }}
            className="px-3 py-2 rounded-md cursor-pointer text-sm flex justify-between items-center"
            style={{ background: folder === f.id && !showAttachmentsView && !showDownloadsView ? "var(--gradient-aero)" : "transparent", color: folder === f.id && !showAttachmentsView && !showDownloadsView ? "white" : "inherit" }}>
            <span>{f.icon} {f.label}</span>
            {f.id === "inbox" && unread("inbox") > 0 && (
              <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{unread("inbox")}</span>
            )}
          </div>
        ))}
        <div className="text-[10px] uppercase opacity-50 px-2 pt-3 pb-1">My folders</div>
        {customFolders.map((entry) => {
          const [id, name] = entry.split("|");
          return (
            <div key={id} onClick={() => { setFolder(id); setSelected(null); setShowAttachmentsView(false); setShowDownloadsView(false); }}
              className="px-3 py-2 rounded-md cursor-pointer text-sm flex justify-between items-center"
              style={{ background: folder === id ? "var(--gradient-aero)" : "transparent", color: folder === id ? "white" : "inherit" }}>
              <span>📁 {name}</span>
            </div>
          );
        })}
        <button onClick={addCustomFolder} className="text-xs opacity-60 hover:opacity-100 text-left px-3 py-1">+ New folder</button>

        <div className="border-t mt-2 pt-2">
          <div onClick={() => { setShowAttachmentsView(true); setShowDownloadsView(false); setSelected(null); setComposing(false); }}
            className="px-3 py-2 rounded-md cursor-pointer text-sm"
            style={{ background: showAttachmentsView ? "var(--gradient-aero)" : "transparent", color: showAttachmentsView ? "white" : "inherit" }}>
            📎 Saved attachments
          </div>
          <div onClick={() => { setShowDownloadsView(true); setShowAttachmentsView(false); setSelected(null); setComposing(false); }}
            className="px-3 py-2 rounded-md cursor-pointer text-sm"
            style={{ background: showDownloadsView ? "var(--gradient-aero)" : "transparent", color: showDownloadsView ? "white" : "inherit" }}>
            ⬇️ Download history
          </div>
        </div>

        <div className="mt-auto text-[10px] opacity-50 px-1 pt-4 break-all">
          <div className="font-semibold">{currentUser}</div>
          <div>{myAddress}</div>
        </div>
      </div>

      {/* Center column */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col overflow-hidden">
        <div className="p-2 border-b">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search mail…"
            className="w-full px-2 py-1 text-xs rounded outline-none input-field" style={{ border: "1px solid var(--border)" }} />
        </div>
        {showAttachmentsView ? (
          <div className="px-3 py-2 text-xs font-semibold opacity-70 border-b">Saved attachments · {allAttachments.length}</div>
        ) : showDownloadsView ? (
          <div className="px-3 py-2 text-xs font-semibold opacity-70 border-b">Download history · {downloads.length}</div>
        ) : (
          <div className="px-3 py-2 text-xs font-semibold opacity-60 border-b capitalize">
            {SYSTEM_FOLDERS.find((f) => f.id === folder)?.label || (customFolders.find((c) => c.split("|")[0] === folder)?.split("|")[1] ?? folder)} · {folderMsgs.length}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {showAttachmentsView ? (
            allAttachments.length === 0 ? <div className="p-4 text-xs opacity-50 text-center">No attachments saved.</div>
            : allAttachments.map((a) => (
              <div key={a.id} className="px-3 py-2 border-b text-xs cursor-pointer hover:bg-white/20"
                onClick={() => {
                  const r = downloadAttachment(a, currentUser);
                  if (!r.cancelled && a.mailId && a.kind !== "image") {
                    recordDownload(currentUser, {
                      id: `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                      name: a.name,
                      kind: a.kind,
                      size: a.size,
                      at: Date.now(),
                      mailId: a.mailId,
                      destination: r.destination,
                    });
                  }
                }}>
                <div className="font-semibold truncate">{a.kind === "image" ? "🖼️" : a.kind === "video" ? "🎬" : "📎"} {a.name}</div>
                <div className="opacity-60 truncate">{a.from} · {a.subject}</div>
              </div>
            ))
          ) : showDownloadsView ? (
            downloads.length === 0 ? <div className="p-4 text-xs opacity-50 text-center">No downloads yet.</div>
            : downloads.map((d) => (
              <div key={d.id} className="px-3 py-2 border-b text-xs">
                <div className="font-semibold truncate">{d.name}</div>
                <div className="opacity-60">{new Date(d.at).toLocaleString()} · {Math.round(d.size / 1024)} KB</div>
                {d.destination && <div className="opacity-45">Saved to: {d.destination}</div>}
              </div>
            ))
          ) : folderMsgs.length === 0 ? (
            <div className="p-4 text-xs opacity-50 text-center">No messages here.</div>
          ) : folderMsgs.map((msg) => (
            <div key={msg.id}
              onClick={() => {
                if (msg.folder === "drafts") {
                  openCompose({ to: msg.to, subject: msg.subject, body: msg.body, draftId: msg.id, attachments: msg.attachments });
                } else {
                  setSelected(msg); setComposing(false);
                  if (!msg.read) updateMsg((m) => ({ ...m, read: true }), msg.id);
                }
              }}
              className="px-3 py-2 cursor-pointer border-b hover:bg-white/20 transition-colors"
              style={{ background: selected?.id === msg.id ? "rgba(255,255,255,0.25)" : undefined }}>
              <div className="flex justify-between items-center">
                <span className="text-xs truncate max-w-[140px]" style={{ fontWeight: !msg.read && msg.folder === "inbox" ? 700 : 400 }}>
                  {msg.important && "⭐ "}{folder === "sent" || msg.folder === "sent" ? `→ ${msg.to}` : msg.from}
                </span>
                <span className="text-[10px] opacity-50 flex-shrink-0">{formatDate(msg.at)}</span>
              </div>
              <div className="text-xs truncate opacity-80" style={{ fontWeight: !msg.read && msg.folder === "inbox" ? 600 : 400 }}>
                {msg.subject || "(no subject)"}
              </div>
              <div className="text-[10px] truncate opacity-50">
                {msg.attachments?.length ? `📎${msg.attachments.length} ` : ""}{msg.body.slice(0, 60)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reading / Compose pane */}
      <div className="flex-1 overflow-auto p-5">
        {composing ? (
          <div className="h-full flex flex-col gap-3 max-w-2xl">
            <div className="text-lg font-semibold mb-1">New Message {draftId && <span className="text-xs opacity-50">(draft)</span>}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 opacity-60">To:</span>
              <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                placeholder="Pueio Number (e.g. 123-456-789)"
                className="flex-1 px-3 py-1.5 rounded text-sm outline-none input-field" style={{ border: "1px solid var(--border)" }}
                list="mail-contacts" />
              <datalist id="mail-contacts">
                {users.filter((u) => u.name !== currentUser).map((u) => (
                  <option key={u.name} value={mailAddressFor(u.name)} label={u.name} />
                ))}
                {users.filter((u) => u.name !== currentUser && u.pueiNumber).map((u) => (
                  <option key={u.name + "-num"} value={u.pueiNumber!} label={u.name} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 opacity-60">Subject:</span>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Subject"
                className="flex-1 px-3 py-1.5 rounded text-sm outline-none input-field" style={{ border: "1px solid var(--border)" }} />
            </div>
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Write your message…"
              className="flex-1 px-3 py-2 rounded text-sm outline-none resize-none min-h-[160px] input-field" style={{ border: "1px solid var(--border)" }} />

            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pending.map((a) => (
                  <div key={a.id} className="aero-glass-light rounded px-2 py-1 text-xs flex items-center gap-2">
                    <span>{a.kind === "image" ? "🖼️" : a.kind === "video" ? "🎬" : "📎"} {a.name}</span>
                    <button className="opacity-60 hover:opacity-100" onClick={() => setPending(pending.filter((x) => x.id !== a.id))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] opacity-60">
              <strong>✨ AI suggestions:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {aiMailSuggestions({ subject: draft.subject, body: draft.body }).map((s, i) => (
                  <button key={i} onClick={() => setDraft({ ...draft, body: (draft.body ? draft.body + "\n\n" : "") + s })}
                    className="aero-button rounded px-2 py-0.5 text-[10px]">{s.slice(0, 40)}{s.length > 40 ? "…" : ""}</button>
                ))}
              </div>
            </div>

            {sendStatus && <div className="text-red-400 text-xs">{sendStatus}</div>}
            <div className="flex gap-2 flex-wrap">
              <button className="aero-button rounded-lg px-5 py-2 text-sm font-semibold" onClick={doSend}>📩 Send</button>
              <button className="aero-button rounded-lg px-4 py-2 text-sm" onClick={handleAttachClick}>📎 Attach</button>
              <input type="file" multiple ref={fileInput} className="hidden"
                accept="image/*,video/*,.pdf,.txt,.doc,.docx,.zip"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
              <button className="aero-button rounded-lg px-4 py-2 text-sm" onClick={saveDraft}>💾 Save draft</button>
              <button className="aero-button rounded-lg px-4 py-2 text-sm" onClick={() => { setComposing(false); setSendStatus(""); setPending([]); setDraftId(null); }}>Discard</button>
            </div>
          </div>
        ) : selected ? (
          <div className="max-w-2xl">
            <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-semibold">{selected.important && "⭐ "}{selected.subject || "(no subject)"}</h2>
              <div className="flex gap-1 flex-wrap">
                <button className="aero-button rounded px-2 py-1 text-xs"
                  onClick={() => openCompose({ to: selected.from === currentUser ? selected.to : selected.from, subject: `Re: ${selected.subject}`, body: `\n\n--- Original from ${selected.from} ---\n${selected.body}` })}>
                  ↩ Reply
                </button>
                <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => updateMsg((m) => ({ ...m, important: !m.important }), selected.id)}>
                  {selected.important ? "🌟 Unstar" : "⭐ Important"}
                </button>
                <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => moveToFolder(selected.id, selected.folder === "spam" ? "inbox" : "spam")}>
                  {selected.folder === "spam" ? "✔ Not spam" : "🚫 Spam"}
                </button>
                {selected.folder === "trash" ? (
                  <>
                    <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => moveToFolder(selected.id, "inbox")}>⚛️ Restore</button>
                    <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => deleteMsg(selected.id, true)}>🖦️ Delete forever</button>
                  </>
                ) : (
                  <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => deleteMsg(selected.id)}>🖦️ Trash</button>
                )}
                {customFolders.length > 0 && (
                  <select className="text-xs rounded px-1 py-0.5 input-field"
                    value="" onChange={(e) => e.target.value && moveToFolder(selected.id, e.target.value)}>
                    <option value="">Move to…</option>
                    {customFolders.map((c) => { const [id, name] = c.split("|"); return <option key={id} value={id}>{name}</option>; })}
                  </select>
                )}
              </div>
            </div>
            <div className="text-xs opacity-60 mb-1">From: <span className="font-medium">{selected.from}</span> &lt;{mailAddressFor(selected.from)}&gt;</div>
            <div className="text-xs opacity-60 mb-1">To: <span className="font-medium">{selected.to}</span></div>
            <div className="text-xs opacity-60 mb-4">{new Date(selected.at).toLocaleString()}</div>
            <div className="aero-glass-light rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed mb-3">
              {selected.body || "(empty)"}
            </div>
            {selected.attachments && selected.attachments.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold opacity-70">📎 Attachments ({selected.attachments.length})</div>
                {selected.attachments.map((a) => (
                  <div key={a.id} className="aero-glass-light rounded p-2 flex items-center gap-3">
                    {a.kind === "image" && <img src={a.dataUrl} alt={a.name} className="w-16 h-16 object-cover rounded" />}
                    {a.kind === "video" && <video src={a.dataUrl} className="w-24 h-16 rounded" />}
                    {a.kind === "file" && <div className="w-16 h-16 flex items-center justify-center text-2xl bg-white/30 rounded">📄</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{a.name}</div>
                      <div className="text-[10px] opacity-60">{Math.round(a.size / 1024)} KB · {a.mime}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {a.kind === "image" && (
                        <button className="aero-button rounded px-2 py-1 text-xs"
                          onClick={() => window.open(a.dataUrl, "_blank")}>🔍 Open</button>
                      )}
                      <button className="aero-button rounded px-2 py-1 text-xs"
                        onClick={() => { downloadAttachment(a); recordDownload(currentUser, { id: `dl-${Date.now()}`, name: a.name, kind: a.kind, size: a.size, at: Date.now(), mailId: selected.id }); }}>
                        ⬇️ Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showAttachmentsView ? (
          <div className="grid grid-cols-3 gap-3">
            {allAttachments.length === 0 ? <div className="opacity-50 text-sm col-span-3 text-center">No attachments yet.</div>
            : allAttachments.map((a) => (
              <div key={a.id} className="aero-glass-light rounded p-2">
                {a.kind === "image" ? <img src={a.dataUrl} className="w-full h-24 object-cover rounded" /> :
                 a.kind === "video" ? <video src={a.dataUrl} className="w-full h-24 rounded" controls /> :
                 <div className="w-full h-24 flex items-center justify-center text-3xl bg-white/30 rounded">📄</div>}
                <div className="text-xs truncate mt-1">{a.name}</div>
                <div className="text-[10px] opacity-60 truncate">{a.from}</div>
                <button className="aero-button rounded w-full mt-1 text-[10px] py-0.5"
                  onClick={() => { downloadAttachment(a); recordDownload(currentUser, { id: `dl-${Date.now()}`, name: a.name, kind: a.kind, size: a.size, at: Date.now(), mailId: a.mailId }); }}>
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : showDownloadsView ? (
          <div className="space-y-1">
            <div className="text-lg font-semibold mb-2">Download history</div>
            {downloads.length === 0 ? <div className="opacity-50 text-sm">Nothing downloaded yet.</div>
            : downloads.map((d) => (
              <div key={d.id} className="aero-glass-light rounded p-2 text-sm flex justify-between">
                <span>{d.kind === "image" ? "🖼️" : d.kind === "video" ? "🎬" : "📎"} {d.name}</span>
                <span className="text-xs opacity-60">{new Date(d.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-50 text-sm gap-2">
            <div className="text-5xl">✉️</div>
            <div>Puei Mail · {myAddress}</div>
            <div className="text-xs">Select a message to read, or compose a new one.</div>
          </div>
        )}
      </div>
    </div>
  );
}


function PueiCloudChatApp({ user, users, setUsers }: { user: string; users: User[]; setUsers: (u: User[]) => void }) {
  const me = users.find((u) => u.name === user);
  const myPueiNumber = me?.pueiNumber ?? "";
  type ExtContact = { pueiNumber: string; name?: string; avatar?: string; color?: string };

  const normalizePueiNumber = (raw: string) => {
    const cleaned = raw.trim().replace(/[\s-]/g, "");
    if (/^\d{9}$/.test(cleaned)) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
    }
    return raw.trim();
  };

  const hydrateExtContact = (contact: ExtContact): ExtContact => {
    const hit = lookupPueiNumber(contact.pueiNumber);
    return {
      ...contact,
      name: contact.name || hit?.name,
      avatar: contact.avatar || hit?.avatar,
      color: contact.color || hit?.color,
    };
  };

  const fetchRemoteProfile = async (pueiNumber: string): Promise<ExtContact | null> => {
    try {
      const res = await fetch(`/api/account?pueiNumber=${encodeURIComponent(pueiNumber)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { pueiNumber?: string; name?: string; avatar?: string; color?: string };
      if (!data?.pueiNumber) return null;
      return hydrateExtContact({
        pueiNumber: normalizePueiNumber(data.pueiNumber),
        name: typeof data.name === "string" ? data.name : undefined,
        avatar: typeof data.avatar === "string" ? data.avatar : undefined,
        color: typeof data.color === "string" ? data.color : undefined,
      });
    } catch {
      return null;
    }
  };

  const parseExtContacts = (raw: unknown): ExtContact[] => {
    if (!Array.isArray(raw)) return [];
    const map = new Map<string, ExtContact>();
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (typeof item.pueiNumber !== "string") continue;
      const pueiNumber = normalizePueiNumber(item.pueiNumber);
      if (!/^\d{3}-\d{3}-\d{3}$/.test(pueiNumber)) continue;
      const prev = map.get(pueiNumber);
      map.set(
        pueiNumber,
        hydrateExtContact({
          pueiNumber,
          name: (typeof item.name === "string" ? item.name : undefined) || prev?.name,
          avatar: (typeof item.avatar === "string" ? item.avatar : undefined) || prev?.avatar,
          color: (typeof item.color === "string" ? item.color : undefined) || prev?.color,
        }),
      );
    }
    return Array.from(map.values());
  };

  // Contacts: local users + external by Puei Number
  const hiddenKey = `pcc2-hidden-${user}`;
  const [hiddenContacts, setHiddenContacts] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(hiddenKey) || "[]"); } catch { return []; }
  });
  const hideContact = (name: string) => {
    const next = [...hiddenContacts, name];
    setHiddenContacts(next);
    localStorage.setItem(hiddenKey, JSON.stringify(next));
  };
  const localContacts = users.filter((u) => u.name !== user && !hiddenContacts.includes(u.name));
  const [extContacts, setExtContacts] = useState<ExtContact[]>(() => {
    try { return parseExtContacts(JSON.parse(localStorage.getItem("pcc2-contacts") || "[]")); } catch { return []; }
  });
  const saveExtContacts = (list: ExtContact[]) => {
    const normalized = parseExtContacts(list);
    setExtContacts(normalized);
    localStorage.setItem("pcc2-contacts", JSON.stringify(normalized));
  };

  // Messages
  const [allMsgs, setAllMsgs] = useState<ChatMessage[]>(() => loadChat());
  type ApiChatMessage = {id:string;from:string;fromNumber:string;toNumber?:string;text:string;at:number};
  const [apiMsgs, setApiMsgs] = useState<Record<string, ApiChatMessage[]>>({});
  const SENT_KEY = (num: string) => `pcc2-sent:${myPueiNumber}:${num}`;
  const [sentMsgs, setSentMsgs] = useState<Record<string,ApiChatMessage[]>>({});
  const appendSent = (num: string, msg: ApiChatMessage) => {
    try { localStorage.setItem(SENT_KEY(num), JSON.stringify([...JSON.parse(localStorage.getItem(SENT_KEY(num))||"[]"), msg].slice(-500))); } catch {}
    setSentMsgs(p => ({...p, [num]: [...(p[num]??[]), msg]}));
  };

  // Active conversation
  const [activeId, setActiveId] = useState<string|null>(localContacts[0]?.name ?? null);
  const [activeKind, setActiveKind] = useState<"local"|"external">("local");
  const [text, setText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newInput, setNewInput] = useState("");
  const [newMsg, setNewMsg] = useState<{ok:boolean;text:string}|null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setAllMsgs(loadChat());
    window.addEventListener("pueios-chat", fn);
    window.addEventListener("storage", fn);
    return () => { window.removeEventListener("pueios-chat", fn); window.removeEventListener("storage", fn); };
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({behavior:"smooth"});
  }, [allMsgs, apiMsgs, sentMsgs, activeId]);

  // Ensure Puei Number is always the deterministic one based on username
  useEffect(() => {
    const correct = pueiNumberFor(user);
    if (me && me.pueiNumber !== correct)
      setUsers(users.map(u => u.name===user ? {...u, pueiNumber: correct} : u));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load sent from localStorage
  useEffect(() => {
    if (!myPueiNumber) return;
    const loaded: typeof sentMsgs = {};
    for (const c of extContacts) {
      try {
        const msgs = JSON.parse(localStorage.getItem(SENT_KEY(c.pueiNumber)) || "[]") as ApiChatMessage[];
        if (msgs.length) loaded[c.pueiNumber] = msgs;
      } catch {}
    }
    if (Object.keys(loaded).length) setSentMsgs(loaded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPueiNumber, extContacts]);

  // Hydrate missing external profile metadata from the server directory.
  useEffect(() => {
    const missing = extContacts.filter((c) => !c.name || !c.avatar || !c.color);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const updates = new Map<string, ExtContact>();
      for (const contact of missing) {
        const remote = await fetchRemoteProfile(contact.pueiNumber);
        if (remote) updates.set(contact.pueiNumber, remote);
      }
      if (cancelled || !updates.size) return;
      saveExtContacts(extContacts.map((c) => updates.get(c.pueiNumber) ?? c));
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extContacts]);

  // Poll API
  useEffect(() => {
    if (!myPueiNumber || myPueiNumber==="—") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat?pueiNumber=${encodeURIComponent(myPueiNumber)}`);
        if (!res.ok || cancelled) return;
        const msgs = (await res.json()) as ApiChatMessage[];
        if (cancelled) return;
        const grouped: typeof apiMsgs = {};
        for (const m of msgs) {
          const sender = normalizePueiNumber(m.fromNumber || "");
          const recipient = normalizePueiNumber(m.toNumber || "");
          const peer = sender === myPueiNumber ? recipient : sender;
          if (!/^\d{3}-\d{3}-\d{3}$/.test(peer) || peer === myPueiNumber) continue;
          if (!grouped[peer]) grouped[peer] = [];
          grouped[peer].push({
            ...m,
            fromNumber: sender,
            toNumber: recipient,
          });
        }
        setApiMsgs(grouped);
        const senders = Object.keys(grouped);
        if (senders.length) {
          const curr = (() => {
            try { return parseExtContacts(JSON.parse(localStorage.getItem("pcc2-contacts") || "[]")); }
            catch { return [] as ExtContact[]; }
          })();
          const byNum = new Map(curr.map((c) => [c.pueiNumber, c]));
          let created = 0;
          let changed = false;
          for (const sender of senders) {
            if (users.some((u) => u.name !== user && u.pueiNumber === sender)) continue;
            const last = grouped[sender]?.[grouped[sender].length - 1];
            const prev = byNum.get(sender);
            const next = hydrateExtContact({
              pueiNumber: sender,
              name: prev?.name || last?.from,
              avatar: prev?.avatar,
              color: prev?.color,
            });
            if (!prev) created += 1;
            if (!prev || prev.name !== next.name || prev.avatar !== next.avatar || prev.color !== next.color) {
              byNum.set(sender, next);
              changed = true;
            }
          }
          if (changed) saveExtContacts(Array.from(byNum.values()));
          if (created > 0) blip("notify");
        }
      } catch {}
    };
    poll(); const iv=setInterval(poll,3000);
    return () => { cancelled=true; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPueiNumber, users]);

  const localPartner = activeKind==="local" ? localContacts.find(c=>c.name===activeId)??null : null;
  const extPartner = activeKind==="external" ? extContacts.find(c=>c.pueiNumber===activeId)??null : null;

  const localMsgs = localPartner
    ? allMsgs.filter(m=>(m.from===user&&m.to===localPartner.name)||(m.from===localPartner.name&&m.to===user))
    : [];
  const extMsgs = extPartner
    ? [...(apiMsgs[extPartner.pueiNumber]??[]),...(sentMsgs[extPartner.pueiNumber]??[])]
        .filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i).sort((a,b)=>(a.at??0)-(b.at??0))
    : [];

  const lastLocal = (name:string) => { const ms=allMsgs.filter(m=>(m.from===user&&m.to===name)||(m.from===name&&m.to===user)); return ms[ms.length-1]; };
  const lastExt = (num:string) => { const all=[...(apiMsgs[num]??[]),...(sentMsgs[num]??[])]; return all.sort((a,b)=>(a.at??0)-(b.at??0)).slice(-1)[0]; };

  const editExtName = (pueiNumber: string) => {
    const current = extContacts.find((c) => c.pueiNumber === pueiNumber);
    if (!current) return;
    const next = prompt("Set contact name (leave empty to show number)", current.name ?? "");
    if (next === null) return;
    const trimmed = next.trim();
    saveExtContacts(extContacts.map((c) =>
      c.pueiNumber === pueiNumber ? { ...c, name: trimmed || undefined } : c,
    ));
    blip("click");
  };

  const doNewChat = async () => {
    let raw = newInput.trim().replace(/[-\s]/g,"");
    if (/^\d{9}$/.test(raw)) raw=`${raw.slice(0,3)}-${raw.slice(3,6)}-${raw.slice(6,9)}`;
    if (!/^\d{3}-\d{3}-\d{3}$/.test(raw)) { setNewMsg({ok:false,text:"Enter a 9-digit Puei Number (e.g. 123-456-789)"}); return; }
    if (raw===myPueiNumber) { setNewMsg({ok:false,text:"That's your own number"}); return; }
    const lu=users.find(u=>u.name!==user&&u.pueiNumber===raw);
    if (lu) { setActiveId(lu.name); setActiveKind("local"); setShowNewChat(false); setNewInput(""); return; }
    if (!extContacts.find(c=>c.pueiNumber===raw)) {
      const hit = lookupPueiNumber(raw);
      let next: ExtContact = { pueiNumber: raw, name: hit?.name, avatar: hit?.avatar, color: hit?.color };
      if (!next.name || !next.avatar || !next.color) {
        const remote = await fetchRemoteProfile(raw);
        if (remote) next = remote;
      }
      saveExtContacts([...extContacts, next]);
    }
    setActiveId(raw); setActiveKind("external"); setShowNewChat(false); setNewInput(""); blip("click");
  };

  const send = async () => {
    if (!text.trim()) return;
    if (!myPueiNumber || !/^\d{3}-\d{3}-\d{3}$/.test(myPueiNumber)) {
      blip("error");
      alert("Your Puei Number is not ready yet. Reopen PueiCloudChat and try again.");
      return;
    }
    const msg=text; setText(""); blip("click");
    if (activeKind==="local"&&localPartner) {
      appendChat({id:`m-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,from:user,to:localPartner.name,text:msg,at:Date.now()});
      setAllMsgs(loadChat());
      if (localPartner.pueiNumber)
        fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:user,fromNumber:myPueiNumber,toNumber:localPartner.pueiNumber,text:msg})}).catch(()=>{});
    } else if (activeKind==="external"&&extPartner) {
      try {
        const res = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:user,fromNumber:myPueiNumber,toNumber:extPartner.pueiNumber,text:msg})});
        if (!res.ok) {
          blip("error");
          alert("Message could not be delivered. Please try again.");
          return;
        }
        const body = (await res.json()) as { id?: string };
        const out: ApiChatMessage = {
          id:body.id || `out-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          from:user,
          fromNumber:myPueiNumber,
          toNumber:extPartner.pueiNumber,
          text:msg,
          at:Date.now(),
        };
        appendSent(extPartner.pueiNumber,out);
      }
      catch {
        blip("error");
        alert("Message could not be delivered. Please check your connection and try again.");
      }
    }
  };

  const filteredLocals = localContacts.filter(c=>c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredExts = extContacts.filter((c) =>
    c.pueiNumber.includes(search) || (c.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  const BLOCK_KEY = `pueios-blocked-${user}`;
  const isBlocked = (num:string) => { try { return (JSON.parse(localStorage.getItem(BLOCK_KEY)||"[]") as string[]).includes(num); } catch { return false; } };
  const blockNum = (num:string, name?:string) => {
    if (!confirm(`Block ${name??num}? They won't be able to message you.`)) return;
    const b:string[]=JSON.parse(localStorage.getItem(BLOCK_KEY)||"[]");
    localStorage.setItem(BLOCK_KEY,JSON.stringify([...b,num]));
    if (name) { deleteChatBetween(user,name); setAllMsgs(loadChat()); }
    else { setApiMsgs(p=>{const n={...p};delete n[num];return n;}); saveExtContacts(extContacts.filter(c=>c.pueiNumber!==num)); }
    setActiveId(null); blip("click");
  };

  const ME_BG = "linear-gradient(135deg,#6d28d9,#4f46e5)";
  const THEM_BG = "rgba(255,255,255,0.1)";
  const SIDEBAR_BG = "rgba(15,5,35,0.95)";
  const MAIN_BG = "linear-gradient(160deg,#0f0523 0%,#1a0a3a 50%,#0d1a3a 100%)";

  // Settings screen
  if (showSettings) return (
    <div className="flex flex-col h-full" style={{background:MAIN_BG,color:"white"}}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <button onClick={()=>setShowSettings(false)} className="text-sm px-3 py-1 rounded-full hover:bg-white/10">← Back</button>
        <span className="font-semibold">My Profile</span>
      </div>
      <div className="flex-1 p-6 flex flex-col items-center gap-5">
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl overflow-hidden"
          style={{background:`linear-gradient(135deg,oklch(0.7 0.18 ${me?.color??200}),oklch(0.45 0.2 ${me?.color??200}))`}}>
          {me?.avatar?.startsWith("data:")
            ? <img src={me.avatar} alt="" className="w-full h-full object-cover"/>
            : (me?.avatar||"👤")}
        </div>
        <div className="text-2xl font-bold">{user}</div>
        <div className="rounded-2xl p-5 w-full max-w-xs" style={{background:"rgba(255,255,255,0.07)"}}>
          <div className="text-xs opacity-50 mb-1 uppercase tracking-widest">Your Puei Number</div>
          <div className="font-mono text-2xl font-bold tracking-wider">{myPueiNumber||"—"}</div>
          <div className="text-xs opacity-40 mt-2">Share this with people on other devices so they can message you</div>
        </div>
        {(() => {
          const blocked:string[]=JSON.parse(localStorage.getItem(BLOCK_KEY)||"[]");
          if (!blocked.length) return null;
          return (
            <div className="rounded-2xl p-4 w-full max-w-xs" style={{background:"rgba(255,255,255,0.07)"}}>
              <div className="text-xs opacity-50 mb-2 uppercase tracking-widest">Blocked ({blocked.length})</div>
              {blocked.map(n=>(
                <div key={n} className="flex items-center justify-between py-1">
                  <span className="font-mono text-sm">{n}</span>
                  <button className="text-xs text-purple-300 hover:text-white px-2 py-0.5 rounded-full"
                    style={{background:"rgba(109,40,217,0.3)"}}
                    onClick={()=>{const b=blocked.filter(x=>x!==n);localStorage.setItem(BLOCK_KEY,JSON.stringify(b));blip("click");}}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );

  return (
    <div className="flex h-full" style={{color:"white"}}>
      {/* Sidebar */}
      <div className="w-56 flex flex-col border-r border-white/10 flex-shrink-0" style={{background:SIDEBAR_BG}}>
        {/* Header */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="font-bold text-sm flex items-center gap-1.5">
            <span className="text-base">💼</span> PueiCloudChat
          </span>
          <button onClick={()=>{setShowSettings(true);blip("click");}}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm opacity-50 hover:opacity-100 transition-opacity"
            style={{background:"rgba(255,255,255,0.08)"}}>⚙️</button>
        </div>
        {/* Search */}
        <div className="px-2 pb-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            className="w-full px-3 py-1.5 rounded-full text-xs outline-none"
            style={{background:"rgba(255,255,255,0.08)",color:"white",border:"1px solid rgba(255,255,255,0.08)"}}/>
        </div>
        {/* Contact list */}
        <div className="flex-1 overflow-auto">
          {filteredLocals.length>0&&<div className="px-3 py-1 text-[9px] font-semibold opacity-30 uppercase tracking-widest">On this device</div>}
          {filteredLocals.map(c=>{
            const last=lastLocal(c.name);
            const isActive=activeKind==="local"&&activeId===c.name;
            return (
              <div key={c.name} onClick={()=>{setActiveId(c.name);setActiveKind("local");blip("hover");}}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all relative"
                style={{background:isActive?"rgba(109,40,217,0.35)":"transparent",
                        borderLeft:isActive?"3px solid #8b5cf6":"3px solid transparent"}}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-lg overflow-hidden"
                  style={{background:`linear-gradient(135deg,oklch(0.7 0.18 ${c.color??200}),oklch(0.45 0.2 ${c.color??200}))`}}>
                  {c.avatar?.startsWith("data:")?<img src={c.avatar} alt="" className="w-full h-full object-cover"/>:(c.avatar||"👤")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] opacity-40 truncate">{last?last.text:"Start chatting"}</div>
                </div>
              </div>
            );
          })}
          {filteredExts.length>0&&<div className="px-3 pt-2 pb-1 text-[9px] font-semibold opacity-30 uppercase tracking-widest">Cross-device</div>}
          {filteredExts.map(c=>{
            const last=lastExt(c.pueiNumber);
            const isActive=activeKind==="external"&&activeId===c.pueiNumber;
            return (
              <div key={c.pueiNumber} onClick={()=>{setActiveId(c.pueiNumber);setActiveKind("external");blip("hover");}}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all"
                style={{background:isActive?"rgba(109,40,217,0.35)":"transparent",
                        borderLeft:isActive?"3px solid #8b5cf6":"3px solid transparent"}}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm overflow-hidden"
                  style={{background:c.color?`linear-gradient(135deg,oklch(0.7 0.18 ${c.color}),oklch(0.45 0.2 ${c.color}))`:"rgba(79,70,229,0.3)"}}>
                  {c.avatar?.startsWith("data:") ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : (c.avatar || "🌍")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{c.name || c.pueiNumber}</div>
                  <div className="text-[10px] opacity-40 font-mono truncate">#{c.pueiNumber}</div>
                  <div className="text-[11px] opacity-40 truncate">{last?last.text:"Say hi"}</div>
                </div>
              </div>
            );
          })}
          {filteredLocals.length===0&&filteredExts.length===0&&(
            <div className="text-xs opacity-30 text-center p-6">No contacts</div>
          )}
        </div>
        {/* New chat */}
        <div className="p-2 border-t border-white/10">
          {showNewChat?(
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] opacity-50">Enter cross-device Puei Number:</div>
              <input autoFocus value={newInput} onChange={e=>setNewInput(e.target.value)}
                placeholder="XXX-XXX-XXX"
                className="w-full px-2.5 py-1.5 rounded-xl text-xs font-mono outline-none"
                style={{background:"rgba(255,255,255,0.08)",color:"white",border:"1px solid rgba(139,92,246,0.4)"}}
                onKeyDown={e=>e.key==="Enter"&&doNewChat()}/>
              {newMsg&&<div className={`text-[10px] ${newMsg.ok?"text-green-400":"text-red-400"}`}>{newMsg.text}</div>}
              <div className="flex gap-1">
                <button onClick={doNewChat} className="flex-1 rounded-xl py-1.5 text-xs font-semibold"
                  style={{background:"linear-gradient(135deg,#6d28d9,#4f46e5)"}}>Start Chat</button>
                <button onClick={()=>{setShowNewChat(false);setNewInput("");setNewMsg(null);}}
                  className="px-3 rounded-xl text-xs opacity-50 hover:opacity-80"
                  style={{background:"rgba(255,255,255,0.08)"}}>✒</button>
              </div>
            </div>
          ):(
            <button onClick={()=>{setShowNewChat(true);blip("click");}}
              className="w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 hover:opacity-90"
              style={{background:"linear-gradient(135deg,#6d28d9,#4f46e5)"}}>
              + New Chat
            </button>
          )}
          <div className="text-center mt-1.5 text-[9px] opacity-20 font-mono">#{myPueiNumber||"—"}</div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0" style={{background:MAIN_BG}}>
        {!activeId?(
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-20">
            <div className="text-6xl">💼</div>
            <div className="text-sm">Select a conversation or start a new one</div>
          </div>
        ):(
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 flex-shrink-0"
              style={{background:"rgba(255,255,255,0.04)"}}>
              {localPartner&&(
                <>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg overflow-hidden"
                    style={{background:`linear-gradient(135deg,oklch(0.7 0.18 ${localPartner.color??200}),oklch(0.45 0.2 ${localPartner.color??200}))`}}>
                    {localPartner.avatar?.startsWith("data:")?<img src={localPartner.avatar} alt="" className="w-full h-full object-cover"/>:(localPartner.avatar||"👤")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{localPartner.name}</div>
                    <div className="text-[10px] opacity-40 font-mono">#{localPartner.pueiNumber||"—"}</div>
                  </div>
                  <button className="text-xs opacity-40 hover:opacity-100 hover:text-red-400 transition-all px-2 py-1 rounded-lg"
                    onClick={()=>{if(confirm(`Remove ${localPartner.name} from your contacts?`)){deleteChatBetween(user,localPartner.name);hideContact(localPartner.name);setAllMsgs(loadChat());setActiveId(null);blip("click");}}}>
                    🗑️
                  </button>
                  <button className="text-xs opacity-40 hover:opacity-100 hover:text-red-400 transition-all px-2 py-1 rounded-lg"
                    onClick={()=>{const num=localPartner.pueiNumber||pueiNumberFor(localPartner.name+":seed");blockNum(num,localPartner.name);}}>
                    🚫
                  </button>
                </>
              )}
              {extPartner&&(
                <>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                    style={{background:extPartner.color?`linear-gradient(135deg,oklch(0.7 0.18 ${extPartner.color}),oklch(0.45 0.2 ${extPartner.color}))`:"rgba(79,70,229,0.4)"}}>
                    {extPartner.avatar?.startsWith("data:") ? <img src={extPartner.avatar} alt="" className="w-full h-full object-cover" /> : (extPartner.avatar || "🌍")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{extPartner.name || extPartner.pueiNumber}</div>
                    <div className="text-[10px] opacity-40 font-mono">#{extPartner.pueiNumber}</div>
                  </div>
                  <button className="text-xs opacity-40 hover:opacity-100 transition-all px-2 py-1 rounded-lg"
                    title="Edit contact name"
                    onClick={()=>editExtName(extPartner.pueiNumber)}>
                    ✅
                  </button>
                  <button className="text-xs opacity-40 hover:opacity-100 hover:text-red-400 transition-all px-2 py-1 rounded-lg"
                    onClick={()=>{if(confirm(`Remove ${extPartner.pueiNumber}?`)){saveExtContacts(extContacts.filter(c=>c.pueiNumber!==extPartner.pueiNumber));setApiMsgs(p=>{const n={...p};delete n[extPartner.pueiNumber];return n;});setActiveId(null);blip("click");}}}>
                    🖦️
                  </button>
                  <button className="text-xs opacity-40 hover:opacity-100 hover:text-red-400 transition-all px-2 py-1 rounded-lg"
                    onClick={()=>blockNum(extPartner.pueiNumber)}>
                    🚫
                  </button>
                </>
              )}
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-2">
              {activeKind==="local"&&localMsgs.length===0&&(
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center opacity-20">
                    <div className="text-4xl mb-2">👏</div>
                    <div className="text-sm">Say hello to {localPartner?.name}!</div>
                  </div>
                </div>
              )}
              {activeKind==="local"&&localMsgs.map(m=>{
                const mine=m.from===user;
                return (
                  <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"} items-end gap-2`}>
                    {!mine&&localPartner&&(
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-sm overflow-hidden"
                        style={{background:`linear-gradient(135deg,oklch(0.7 0.18 ${localPartner.color??200}),oklch(0.45 0.2 ${localPartner.color??200}))`}}>
                        {localPartner.avatar?.startsWith("data:")?<img src={localPartner.avatar} alt="" className="w-full h-full object-cover"/>:(localPartner.avatar||"👤")}
                      </div>
                    )}
                    <div className="max-w-[70%] flex flex-col" style={{alignItems:mine?"flex-end":"flex-start"}}>
                      <div className="px-3.5 py-2.5 text-sm" style={{
                        background:mine?ME_BG:THEM_BG,
                        color:"white",
                        borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      }}>
                        {m.text}
                      </div>
                      <div className="text-[9px] opacity-30 mt-0.5 px-1">
                        {m.at?new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeKind==="external"&&extMsgs.length===0&&(
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center opacity-20">
                    <div className="text-4xl mb-2">🌍</div>
                    <div className="text-sm">Start a cross-device conversation!</div>
                  </div>
                </div>
              )}
              {activeKind==="external"&&extMsgs.map(m=>{
                const mine=m.fromNumber===myPueiNumber;
                return (
                  <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"} items-end gap-2`}>
                    {!mine&&extPartner&&(
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs overflow-hidden"
                        style={{background:extPartner.color?`linear-gradient(135deg,oklch(0.7 0.18 ${extPartner.color}),oklch(0.45 0.2 ${extPartner.color}))`:"rgba(79,70,229,0.35)"}}>
                        {extPartner.avatar?.startsWith("data:") ? <img src={extPartner.avatar} alt="" className="w-full h-full object-cover" /> : (extPartner.avatar || "🌍")}
                      </div>
                    )}
                    <div className="max-w-[70%] flex flex-col" style={{alignItems:mine?"flex-end":"flex-start"}}>
                      <div className="px-3.5 py-2.5 text-sm" style={{
                        background:mine?ME_BG:THEM_BG,
                        color:"white",
                        borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      }}>
                        {m.text}
                      </div>
                      <div className="text-[9px] opacity-30 mt-0.5 px-1">
                        {m.at?new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef}/>
            </div>
            {/* Input */}
            <div className="px-4 py-3 border-t border-white/10 flex-shrink-0" style={{background:"rgba(0,0,0,0.2)"}}>
              <div className="flex gap-2 items-center">
                <input value={text} onChange={e=>setText(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
                  className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none"
                  style={{background:"rgba(255,255,255,0.07)",color:"white",border:"1px solid rgba(255,255,255,0.1)"}}
                  placeholder={localPartner?`Message ${localPartner.name}…`:extPartner?`Message ${extPartner.name || extPartner.pueiNumber}…`:"Message…"}/>
                <button onClick={send} disabled={!text.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity text-xl"
                  style={{background:text.trim()?"linear-gradient(135deg,#6d28d9,#4f46e5)":"rgba(255,255,255,0.1)",opacity:text.trim()?1:0.5}}>
                  ↑
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FileExplorerApp({ openApp, icons, openFolder, currentUser, users, setWallpaper }: { openApp: (id: AppId, fileId?: string) => void; icons: DesktopIcon[]; openFolder: (id: string, title: string) => void; currentUser: string; users: User[]; setWallpaper?: (w: WallpaperId) => void }) {
  const myFiles = () => loadFiles().filter((f) => !f.owner || f.owner === currentUser);
  const [files, setFiles] = useState<SavedFile[]>(() => myFiles());
  const [folder, setFolder] = useState<"home" | "documents" | "pictures" | "downloads" | "apps" | "folders" | "puei-drive" | "recycle-bin">("home");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    const fn = () => setFiles(myFiles());
    window.addEventListener("pueios-files-changed", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("pueios-files-changed", fn);
      window.removeEventListener("storage", fn);
    };
  }, [currentUser]);

  const folders = [
    { id: "documents" as const, name: "Documents", icon: "📁" },
    { id: "pictures" as const, name: "Pictures", icon: "🖼️" },
    { id: "downloads" as const, name: "Downloads", icon: "⬇️" },
    { id: "apps" as const, name: "Apps", icon: "🧩" },
    { id: "folders" as const, name: "My Folders", icon: "🖿️" },
  ];
  const apps: { name: string; appId: AppId; icon: string }[] = [
    { name: "Puei Paint 2", appId: "puei-paint", icon: "🎨" },
    { name: "PueiBoard", appId: "puei-board", icon: "📌" },
    { name: "Notepad", appId: "notepad", icon: "📝" },
    { name: "Calculator", appId: "calculator", icon: "🧮" },
    { name: "Settings", appId: "settings", icon: "⚙️" },
    { name: "PueiNet", appId: "pueinet", icon: "🌍" },
    { name: "PueiCloudChat", appId: "puei-cloud-chat", icon: "💼" },
    { name: "App Store", appId: "app-store", icon: "🛍️" },
    { name: "PueiSocial", appId: "puei-social", icon: "📢" },
  ];

  const textFiles = files.filter((f) => f.type === "text" && (!f.folder || f.folder === "__documents__"));
  const imgFiles = files.filter((f) => f.type === "image" && (!f.folder || f.folder === SYS_FOLDER_PICTURES));
  const downloadFiles = files.filter((f) => f.folder === SYS_FOLDER_DOWNLOADS);
  const myFolders = icons.filter((i) => i.appId === "folder");

  const handleDrop = (folderId: string) => {
    if (!dragFileId) return;
    moveFile(dragFileId, folderId);
    setFiles(myFiles());
    setDragFileId(null); setDropTarget(null);
    blip("notify");
  };

  return (
    <div className="flex h-full">
      <div className="w-48 p-2 border-r text-sm" style={{ background: "var(--glass)" }}>
        <div className="font-semibold mb-2 opacity-70 text-xs">FAVORITES</div>
        {[
          ["home","🏡 Home"],["documents","📁 Documents"],["pictures","🖼️ Pictures"],
          ["downloads","⬇️ Downloads"],["folders","🖿️ My Folders"],["apps","🧩 Apps"],
        ].map(([k, l]) => (
          <div key={k} onClick={() => { setFolder(k as any); setOpenFolderId(null); }}
            className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer"
            style={{ background: folder === k ? "rgba(255,255,255,0.4)" : undefined }}>{l}</div>
        ))}
        <div className="font-semibold mt-3 mb-2 opacity-70 text-xs">COMPUTER</div>
        <div className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer"
          onClick={() => setFolder("home")}
          style={{ background: folder === "home" ? "rgba(255,255,255,0.4)" : undefined }}>💽 C:\ PueiDrive</div>
        <div className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer flex items-center gap-1"
          onClick={() => setFolder("puei-drive")}
          style={{ background: folder === "puei-drive" ? "rgba(255,255,255,0.4)" : undefined }}>☁️ Puei Disk</div>
        <div className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer"
          onClick={() => { setFolder("recycle-bin"); setOpenFolderId(null); }}
          style={{ background: folder === "recycle-bin" ? "rgba(255,255,255,0.4)" : undefined }}>🖦️ Recycle Bin</div>
        {dragFileId && (
          <div className="mt-3 text-[10px] opacity-60 px-2">
            📂 Drag to a folder below to move file
          </div>
        )}
        {dragFileId && myFolders.map((f) => (
          <div key={f.id}
            onDragOver={(e) => { e.preventDefault(); setDropTarget(f.id); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => handleDrop(f.id)}
            className="px-2 py-1.5 rounded cursor-pointer mt-0.5 text-xs flex items-center gap-1"
            style={{
              background: dropTarget === f.id ? "rgba(80,200,160,0.35)" : "rgba(255,255,255,0.15)",
              border: dropTarget === f.id ? "1px dashed rgba(80,200,160,0.8)" : "1px dashed transparent",
            }}>
            📁 {f.label}
          </div>
        ))}
        <div className="mt-4 text-[10px] opacity-40 px-2 leading-snug">
          ☁️ Cloud Sync: Files saved while logged into your account sync automatically across supported browsers and apps using the same Pueio account.
        </div>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="text-xs opacity-70 mb-3 flex items-center gap-1">
          {openFolderId && (
            <button className="hover:underline" onClick={() => setOpenFolderId(null)}>My Folders</button>
          )}
          {openFolderId ? (
            <> › {myFolders.find(f => f.id === openFolderId)?.label ?? openFolderId}</>
          ) : folder === "puei-drive" ? "☁️ Puei Disk" : folder === "recycle-bin" ? "🖦️ Recycle Bin" : `Computer › PueiDrive › Users › You › ${folder}`}
        </div>
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
          <FileGrid files={textFiles} emptyHint="No saved documents. Open Notepad and click Save to create one."
            onOpen={(f) => openApp("notepad", f.id)}
            onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
            onDragStart={(id) => setDragFileId(id)}
            onDragEnd={() => { setDragFileId(null); setDropTarget(null); }} />
        )}
        {folder === "pictures" && (
          <FileGrid files={imgFiles} emptyHint="No saved pictures. Open Puei Paint 2 and click Save to create one."
            onOpen={(f) => openApp("puei-paint", f.id)}
            onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
            onSetWallpaper={setWallpaper ? (f) => { setWallpaper(f.content); blip("notify"); } : undefined}
            onDragStart={(id) => setDragFileId(id)}
            onDragEnd={() => { setDragFileId(null); setDropTarget(null); }} />
        )}
        {folder === "downloads" && (
          <FileGrid files={downloadFiles} emptyHint="No downloads yet. Download from Puei Wallpapers or mail attachments."
            onOpen={(f) => {
              if (f.name.trim().toLowerCase().endsWith(".iso") || f.name.trim().toLowerCase().endsWith(".zip")) { openApp(f.name.trim().toLowerCase().endsWith(".zip") ? "zip-viewer" : "iso-viewer", f.id); return; }
              if (f.type === "image") { openApp("puei-paint", f.id); return; }
              openApp("notepad", f.id);
            }}
            onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
            onMoveToPictures={(f) => { moveFile(f.id, SYS_FOLDER_PICTURES); setFiles(myFiles()); blip("notify"); }}
            onDragStart={(id) => setDragFileId(id)}
            onDragEnd={() => { setDragFileId(null); setDropTarget(null); }} />
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
        {folder === "puei-drive" && (
          <PueiDrivePane files={files} icons={icons} currentUser={currentUser} users={users} openApp={openApp} onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }} />
        )}
        {folder === "recycle-bin" && <RecycleBinApp />}
        {folder === "folders" && !openFolderId && (
          myFolders.length === 0
            ? <div className="text-sm opacity-70 p-6 text-center">No folders yet. Right-click the desktop → New Folder.</div>
            : <div className="grid grid-cols-5 gap-3">
                {myFolders.map((f) => {
                  const folderFiles = files.filter((fi) => fi.folder === f.id);
                  return (
                    <div key={f.id}
                      onDoubleClick={() => setOpenFolderId(f.id)}
                      onDragOver={(e) => { e.preventDefault(); setDropTarget(f.id); }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={() => handleDrop(f.id)}
                      className="text-center p-2 rounded hover:bg-white/30 cursor-pointer transition-all"
                      style={{
                        background: dropTarget === f.id ? "rgba(80,200,160,0.25)" : undefined,
                        outline: dropTarget === f.id ? "2px dashed rgba(80,200,160,0.8)" : undefined,
                      }}>
                      <div className="text-4xl">📁</div>
                      <div className="text-xs mt-1 truncate">{f.label}</div>
                      {folderFiles.length > 0 && <div className="text-[10px] opacity-50">{folderFiles.length} file{folderFiles.length !== 1 ? "s" : ""}</div>}
                    </div>
                  );
                })}
              </div>
        )}
        {folder === "folders" && openFolderId && (() => {
          const folderFiles = files.filter((fi) => fi.folder === openFolderId);
          const folderIcons = icons.filter((i) => i.folderId === openFolderId);
          if (folderFiles.length === 0 && folderIcons.length === 0)
            return <div className="text-sm opacity-70 p-6 text-center">This folder is empty.</div>;
          return (
            <FolderFileGrid
              files={folderFiles}
              icons={folderIcons}
              onOpen={(f) => { if (f.name.trim().toLowerCase().endsWith(".iso") || f.name.trim().toLowerCase().endsWith(".zip")) { openApp(f.name.trim().toLowerCase().endsWith(".zip") ? "zip-viewer" : "iso-viewer", f.id); return; } openApp(f.type === "image" ? "puei-paint" : "notepad", f.id); }}
              onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
              onOpenIcon={(ic) => { if (ic.appId !== "web-app") openApp(ic.appId, ic.fileId); }}
              onMoveToPictures={(f) => { moveFile(f.id, SYS_FOLDER_PICTURES); setFiles(myFiles()); blip("notify"); }}
            />
          );
        })()}
      </div>
    </div>
  );
}

function FolderFileGrid({ files, icons, onOpen, onDelete, onOpenIcon, onMoveToPictures }: {
  files: SavedFile[]; icons: DesktopIcon[];
  onOpen: (f: SavedFile) => void;
  onDelete: (id: string) => void;
  onOpenIcon: (ic: DesktopIcon) => void;
  onMoveToPictures?: (f: SavedFile) => void;
}) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const canMove = selectedFile && selectedFile.type === "image" && selectedFile.folder !== SYS_FOLDER_PICTURES && onMoveToPictures;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b flex-wrap">
        <button
          className="aero-button rounded px-3 py-1 text-xs"
          disabled={!selectedFile}
          style={{ opacity: selectedFile ? 1 : 0.4 }}
          onClick={() => { if (selectedFile) { onOpen(selectedFile); } }}>
          📂 Open
        </button>
        <button
          className="aero-button rounded px-3 py-1 text-xs text-red-400"
          disabled={!selectedFileId}
          style={{ opacity: selectedFileId ? 1 : 0.4 }}
          onClick={() => {
            if (selectedFileId) { onDelete(selectedFileId); setSelectedFileId(null); }
          }}>
          🖦️ Delete
        </button>
        {canMove && (
          <button className="aero-button rounded px-3 py-1 text-xs"
            onClick={() => { onMoveToPictures!(selectedFile!); setSelectedFileId(null); }}>
            🖼️ Move to Pictures
          </button>
        )}
        {selectedFile && <span className="text-xs opacity-50 ml-1">Selected: {selectedFile.name}</span>}
        {!selectedFile && <span className="text-xs opacity-40 ml-1">Click a file to select it</span>}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {files.map((f) => (
          <div key={f.id}
            onClick={() => setSelectedFileId(f.id === selectedFileId ? null : f.id)}
            onDoubleClick={() => onOpen(f)}
            className="text-center p-2 rounded cursor-pointer select-none transition-all"
            style={{ background: f.id === selectedFileId ? "rgba(80,160,255,0.35)" : "transparent",
                     outline: f.id === selectedFileId ? "2px solid rgba(80,160,255,0.7)" : "none" }}>
            {f.type === "image"
              ? <img src={f.content} alt={f.name} className="w-12 h-12 mx-auto object-cover rounded shadow" />
              : <div className="text-4xl">📄</div>}
            <div className="text-xs mt-1 truncate">{f.name}</div>
          </div>
        ))}
        {icons.map((ic) => (
          <div key={ic.id}
            onDoubleClick={() => onOpenIcon(ic)}
            className="text-center p-2 rounded hover:bg-white/30 cursor-pointer select-none">
            <div className="text-4xl">{ic.appId === "web-app" ? "🔗" : "📄"}</div>
            <div className="text-xs mt-1 truncate">{ic.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileGrid({ files, emptyHint, onOpen, onDelete, onSetWallpaper, onMoveToPictures, onDragStart, onDragEnd }: {
  files: SavedFile[]; emptyHint: string;
  onOpen?: (f: SavedFile) => void;
  onDelete: (id: string) => void;
  onSetWallpaper?: (f: SavedFile) => void;
  onMoveToPictures?: (f: SavedFile) => void;
  onDragStart?: (id: string) => void; onDragEnd?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; file: SavedFile } | null>(null);
  const selectedFile = files.find(f => f.id === selectedId) ?? null;
  if (files.length === 0) return <div className="text-sm opacity-70 p-6 text-center">{emptyHint}</div>;
  const canMoveToPictures = (f: SavedFile) => onMoveToPictures && f.type === "image" && f.folder !== SYS_FOLDER_PICTURES;
  return (
    <div onClick={() => setCtxMenu(null)}>
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={[
          { label: "📂 Open", action: () => { if (onOpen) onOpen(ctxMenu.file); } },
          ...(canMoveToPictures(ctxMenu.file) ? [{ label: "🖼️ Move to Pictures", action: () => { onMoveToPictures!(ctxMenu.file); setSelectedId(null); } }] : []),
          ...(onSetWallpaper && ctxMenu.file.type === "image" ? [{ label: "🖼️ Set as Wallpaper", action: () => onSetWallpaper(ctxMenu.file) }] : []),
          { sep: true },
          { label: "🖦️ Delete", action: () => { onDelete(ctxMenu.file.id); setSelectedId(null); } },
        ]} />
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b flex-wrap">
        <button className="aero-button rounded px-3 py-1 text-xs"
          disabled={!selectedFile} style={{ opacity: selectedFile ? 1 : 0.4 }}
          onClick={() => { if (selectedFile && onOpen) onOpen(selectedFile); }}>📂 Open</button>
        <button className="aero-button rounded px-3 py-1 text-xs text-red-400"
          disabled={!selectedId} style={{ opacity: selectedId ? 1 : 0.4 }}
          onClick={() => {
            if (selectedId) { onDelete(selectedId); setSelectedId(null); }
          }}>🖦️ Delete</button>
        {selectedFile && canMoveToPictures(selectedFile) && (
          <button className="aero-button rounded px-3 py-1 text-xs"
            onClick={() => { onMoveToPictures!(selectedFile); setSelectedId(null); }}>🖼️ Move to Pictures</button>
        )}
        {onSetWallpaper && (
          <button className="aero-button rounded px-3 py-1 text-xs"
            disabled={!selectedFile || selectedFile.type !== "image"} style={{ opacity: (selectedFile && selectedFile.type === "image") ? 1 : 0.4 }}
            onClick={() => { if (selectedFile) { onSetWallpaper(selectedFile); } }}>🖼️ Set as Wallpaper</button>
        )}
        {selectedFile
          ? <span className="text-xs opacity-50 ml-1">Selected: {selectedFile.name}</span>
          : <span className="text-xs opacity-40 ml-1">Click a file to select it</span>}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {files.map((f) => (
          <div key={f.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(f.id); }}
            onDragEnd={() => onDragEnd?.()}
            onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
            onDoubleClick={() => onOpen?.(f)}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedId(f.id); setCtxMenu({ x: e.clientX, y: e.clientY, file: f }); }}
            className="text-center p-2 rounded cursor-pointer select-none transition-all"
            style={{
              background: f.id === selectedId ? "rgba(80,160,255,0.35)" : "transparent",
              outline: f.id === selectedId ? "2px solid rgba(80,160,255,0.7)" : "none",
            }}>
            {f.type === "image"
              ? <img src={f.content} alt={f.name} className="w-12 h-12 mx-auto object-cover rounded shadow" />
              : <div className="text-4xl">📄</div>}
            <div className="text-xs mt-1 truncate">{f.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Puei Drive Pane ----------
function PueiDrivePane({ files, icons, currentUser, users, openApp, onDelete }: {
  files: SavedFile[]; currentUser: string;
  icons: DesktopIcon[];
  users: User[];
  openApp: (id: AppId, fileId?: string) => void;
  onDelete: (id: string) => void;
}) {
  type DriveSection =
    | "all"
    | "custom-folders"
    | "dev"
    | "media"
    | "projects"
    | "users"
    | "windows"
    | "system"
    | "games"
    | "logs"
    | "program-files"
    | "temp"
    | "recovery"
    | "config";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRootEntries, setShowRootEntries] = useState(true);
  const [driveSection, setDriveSection] = useState<DriveSection>("all");
  const myFiles = files.filter(f => !f.owner || f.owner === currentUser);
  const customFolders = icons.filter((i) => i.appId === "folder");
  const customFolderIds = new Set(customFolders.map((f) => f.id));
  const totalSize = myFiles.reduce((acc, f) => acc + f.content.length, 0);
  const usedKB = (totalSize / 1024).toFixed(1);
  const deviceUsers = users;
  const sectionMap: Record<string, DriveSection> = {
    "C:\\Folders": "custom-folders",
    "C:\\Dev": "dev",
    "C:\\Media": "media",
    "C:\\Projects": "projects",
    "C:\\Users": "users",
    "C:\\Windows": "windows",
    "C:\\System": "system",
    "C:\\Games": "games",
    "C:\\Logs": "logs",
    "C:\\Program Files": "program-files",
    "C:\\Temp": "temp",
    "C:\\Recovery": "recovery",
    "C:\\puei.config.ini": "config",
  };
  const sectionLabel: Record<DriveSection, string> = {
    all: "C:\\",
    "custom-folders": "C:\\Folders",
    dev: "C:\\Dev",
    media: "C:\\Media",
    projects: "C:\\Projects",
    users: "C:\\Users",
    windows: "C:\\Windows",
    system: "C:\\System",
    games: "C:\\Games",
    logs: "C:\\Logs",
    "program-files": "C:\\Program Files",
    temp: "C:\\Temp",
    recovery: "C:\\Recovery",
    config: "C:\\puei.config.ini",
  };
  const shownFiles = (() => {
    switch (driveSection) {
      case "custom-folders":
        return [];
      case "media":
        return myFiles.filter((f) => f.type === "image" && (!f.folder || f.folder === SYS_FOLDER_PICTURES));
      case "dev":
        return myFiles.filter((f) => f.type === "text");
      case "projects":
        return myFiles.filter((f) => f.folder === "__studio__");
      case "logs":
        return myFiles.filter((f) => /log|trace|debug/i.test(f.name));
      case "temp":
        return [...myFiles].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24);
      case "games": {
        const visibleFiles = myFiles.filter((f) => !f.folder || !customFolderIds.has(f.folder));
        const gameish = visibleFiles.filter((f) => /game|chess/i.test(f.name));
        return gameish.length ? gameish : visibleFiles;
      }
      default:
        return myFiles.filter((f) => !f.folder || !customFolderIds.has(f.folder));
    }
  })();
  const isFileSection = ["all", "dev", "media", "projects", "logs", "temp", "games"].includes(driveSection);
  const isVirtualSection = ["windows", "system", "program-files", "recovery", "config"].includes(driveSection);
  const selectedFile = shownFiles.find(f => f.id === selectedId) ?? null;
  const fileLocation = (file: SavedFile) => {
    if (!file.folder) return "Desktop";
    if (file.folder === SYS_FOLDER_PICTURES) return "Pictures";
    if (file.folder === SYS_FOLDER_DOWNLOADS) return "Downloads";
    return customFolders.find((folder) => folder.id === file.folder)?.label || "Folder";
  };
  const emptySectionHint = driveSection === "media"
    ? "No media files saved yet."
    : driveSection === "custom-folders"
      ? "No files are currently stored in custom folders."
      : "No files yet. Save something from Notepad or Puei Paint 2 and it will appear here.";
  const rootEntries = [
    "C:\\Folders",
    "C:\\Dev", "C:\\Media", "C:\\Projects", "C:\\Users", "C:\\Windows",
    "C:\\System", "C:\\Games", "C:\\Logs", "C:\\Program Files", "C:\\Temp",
    "C:\\Recovery", "C:\\puei.config.ini",
  ];

  useEffect(() => {
    setSelectedId(null);
  }, [driveSection]);

  return (
    <div className="flex flex-col h-full">
      {/* Drive header */}
      <div className="flex items-center gap-4 mb-4 p-3 rounded-xl" style={{ background: "rgba(80,140,255,0.12)", border: "1px solid rgba(80,140,255,0.2)" }}>
        <div className="text-4xl">☁️</div>
        <div>
          <div className="font-semibold">Puei Disk</div>
          <div className="text-xs opacity-60">{myFiles.length} file{myFiles.length !== 1 ? "s" : ""} · {usedKB} KB used</div>
          <div className="text-[10px] opacity-40 mt-0.5">Files sync automatically across your PueiOS sessions</div>
        </div>
        <button className="aero-button rounded px-2 py-1 text-xs ml-auto"
          onClick={() => setShowRootEntries((v) => !v)}>
          {showRootEntries ? "Hide C:\\" : "Show C:\\"}
        </button>
      </div>

      {showRootEntries && (
        <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div className="text-xs font-semibold opacity-70 mb-2">C:\\ virtual root</div>
          <div className="grid grid-cols-3 gap-2">
            {rootEntries.map((entry) => {
              const section = sectionMap[entry];
              return (
                <div key={entry}
                  onClick={() => { setDriveSection(section); setShowRootEntries(false); }}
                  className="text-xs px-2 py-1 rounded transition-colors cursor-pointer hover:bg-white/30"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                  title={`Browse ${entry}`}>
                  {entry}
                </div>
              );
            })}
          </div>
          <div className="text-[10px] opacity-45 mt-2">All entries are browsable. Some are virtual system folders.</div>
        </div>
      )}
      {isFileSection && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <button className="aero-button rounded px-3 py-1 text-xs"
            disabled={!selectedFile} style={{ opacity: selectedFile ? 1 : 0.4 }}
            onClick={() => { if (selectedFile) { const sn = selectedFile.name.trim().toLowerCase(); if (sn.endsWith(".iso") || sn.endsWith(".zip")) { openApp(sn.endsWith(".zip") ? "zip-viewer" : "iso-viewer", selectedFile.id); return; } openApp(selectedFile.type === "image" ? "puei-paint" : "notepad", selectedFile.id); } }}>
            📂 Open
          </button>
          <button className="aero-button rounded px-3 py-1 text-xs text-red-400"
            disabled={!selectedId} style={{ opacity: selectedId ? 1 : 0.4 }}
            onClick={() => {
              if (selectedId && confirm("Delete this file?")) { onDelete(selectedId); setSelectedId(null); }
            }}>
            🖦️ Delete
          </button>
          {selectedFile
            ? <span className="text-xs opacity-50 ml-1">Selected: {selectedFile.name}</span>
            : <span className="text-xs opacity-40 ml-1">Click a file to select it</span>}
        </div>
      )}
      {isFileSection && shownFiles.length === 0
        ? <div className="text-sm opacity-60 text-center p-8">{emptySectionHint}</div>
        : <>
          {driveSection !== "all" && (
            <div className="flex items-center gap-2 mb-3 text-xs opacity-70">
              <button className="hover:underline" onClick={() => { setDriveSection("all"); setShowRootEntries(true); }}>☁️ Puei Disk</button>
              {" › "}
              {sectionLabel[driveSection]}
            </div>
          )}
          {driveSection === "users"
            ? <>
              {deviceUsers.length === 0
                ? <div className="text-sm opacity-60 text-center p-8">No Puei accounts found on this device.</div>
                : <div className="grid grid-cols-4 gap-3 overflow-auto">
                    {deviceUsers.map((u) => (
                      <div key={u.name} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          {typeof u.avatar === "string" && /^(data:image\/|https?:\/\/)/i.test(u.avatar)
                            ? <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full border object-cover" style={{ borderColor: u.color || "rgba(255,255,255,0.4)" }} />
                            : <div className="w-10 h-10 rounded-full border flex items-center justify-center text-xl" style={{ borderColor: u.color || "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)" }}>{u.avatar || "🧑"}</div>}
                          <div>
                            <div className="text-sm font-semibold leading-tight">{u.name}</div>
                            <div className="text-[10px] opacity-60">{u.name === currentUser ? "Signed in" : "Local account"}</div>
                          </div>
                        </div>
                        <div className="text-[11px] opacity-70">Puei Number: {u.pueiNumber ?? "Not set"}</div>
                      </div>
                    ))}
                  </div>}
            </>
            : driveSection === "custom-folders"
            ? <div className="grid grid-cols-4 gap-3 overflow-auto">
                {customFolders.length === 0
                  ? <div className="col-span-4 text-sm opacity-60 text-center p-8">No custom folders created yet.</div>
                  : customFolders.map((folder) => {
                      const folderFiles = myFiles.filter((f) => f.folder === folder.id);
                      return (
                        <div key={folder.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                          <div className="text-3xl">📁</div>
                          <div className="text-sm font-semibold mt-1 truncate">{folder.label}</div>
                          <div className="text-[11px] opacity-65 mt-1">{folderFiles.length} file{folderFiles.length !== 1 ? "s" : ""}</div>
                        </div>
                      );
                    })}
              </div>
            : isVirtualSection
            ? <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div className="font-semibold">{sectionLabel[driveSection]} (virtual)</div>
                <div className="text-sm opacity-70">
                  This is a virtual system location in Puei Disk. You can browse it and open related tools below.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => openApp("settings")}>⚙️ Open Settings</button>
                  <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => openApp("about")}>ℹ️ System Info</button>
                  <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => openApp("app-store")}>🧩 Program Manager</button>
                  <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => openApp("recycle-bin")}>🖦️ Recovery</button>
                </div>
              </div>
            : <div className="grid grid-cols-5 gap-3 overflow-auto">
                {shownFiles.map(f => (
                  <div key={f.id}
                    onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                    onDoubleClick={() => { if (f.name.trim().toLowerCase().endsWith(".iso") || f.name.trim().toLowerCase().endsWith(".zip")) { openApp(f.name.trim().toLowerCase().endsWith(".zip") ? "zip-viewer" : "iso-viewer", f.id); return; } openApp(f.type === "image" ? "puei-paint" : "notepad", f.id); }}
                    className="text-center p-2 rounded cursor-pointer select-none transition-all"
                    style={{
                      background: f.id === selectedId ? "rgba(80,160,255,0.35)" : "transparent",
                      outline: f.id === selectedId ? "2px solid rgba(80,160,255,0.7)" : "none",
                }}>
                {f.type === "image"
                  ? <img src={f.content} alt={f.name} className="w-12 h-12 mx-auto object-cover rounded shadow" />
                  : <div className="text-4xl">📄</div>}
                <div className="text-xs mt-1 truncate">{f.name}</div>
                <div className="text-[9px] opacity-50 truncate">{fileLocation(f)}</div>
                <div className="text-[9px] opacity-40">{(f.content.length / 1024).toFixed(1)} KB</div>
              </div>
            ))}
          </div>}
        </>
      }
    </div>
  );
}

// ---------- App Store ----------
function AppStoreApp({ installWebApp, openApp, openWebApp, systemVersion, addNativeIcon, uninstallApp, uninstallWebApp, icons, installedKeys }: { installWebApp: (label: string, url: string, iconUrl?: string) => void; openApp: (id: AppId) => void; openWebApp: (url: string, title: string) => void; systemVersion: SystemVersion; addNativeIcon: (appId: AppId, label: string, icon: string) => void; uninstallApp: (appId: AppId) => void; uninstallWebApp: (url: string) => void; icons: DesktopIcon[]; installedKeys: Set<string> }) {
  const [tab, setTab] = useState<"official" | "community" | "installer">("official");
  const [installing, setInstalling] = useState<Record<string, number>>({});
  const installTimers = useRef<Record<string, number>>({});
  type StoreApp = { name: string; icon: string; desc: string; appId?: AppId; preInstalled?: boolean; webUrl?: string; desktopLabel?: string };
  const official: StoreApp[] = [
    { name: "Puei Films",     icon: "🎬", desc: "Watch official videos posted by pueioficial.",   webUrl: "puei://films",  desktopLabel: "Puei Films",   preInstalled: false },
    { name: "Puei Updater",   icon: "🔄", desc: "Required for installing ISO system updates.",           webUrl: "puei://updates", desktopLabel: "Puei Updater", preInstalled: false },
    { name: "PueiSocial",     icon: "📢", desc: "The official PueiOS social network.",          appId: "puei-social",    preInstalled: true },
    { name: "PueiCloudChat",  icon: "💬", desc: "Chat by PueiNumber — cross-device, real-time.", appId: "puei-cloud-chat", preInstalled: true },
    { name: "Puei Studio",    icon: "🪽", desc: "Create wallpapers, icons, themes and share to PueiSocial.", appId: "puei-studio", preInstalled: true },
    { name: "PueiBoard",      icon: "📌", desc: "Pinterest-style boards where Pueis post Gallery images.", appId: "puei-board", preInstalled: true },
    { name: "PueiWeb",        icon: "🌍", desc: "System browser + AI search engine.",           appId: "pueinet",        preInstalled: true },
    { name: "Puei Paint 2",   icon: "🎨", desc: "Paint and save images as wallpapers.",         appId: "puei-paint",     preInstalled: true },
    { name: "Settings",       icon: "⚙️", desc: "Personalize, dark mode, accessibility.",       appId: "settings",       preInstalled: true },
    { name: "Computer",       icon: "🖥️", desc: "File system explorer.",                        appId: "file-explorer",  preInstalled: true },
    { name: "Notepad",        icon: "📝", desc: "Write and save text files.",                   appId: "notepad",        preInstalled: true },
    { name: "Calculator",     icon: "🧮", desc: "Glossy arithmetic.",                            appId: "calculator",     preInstalled: true },
    { name: "Chess",          icon: "♟️", desc: "Chess vs Puei Bot AI — fully functional.",     appId: "chess",          preInstalled: false },
    { name: "Installer",      icon: "📑", desc: "Install trusted web apps as desktop shortcuts.",appId: "app-store",      preInstalled: true },
  ];
  const games: StoreApp[] = [
    { name: "Puei Mansion",  icon: "👻", desc: "Funny spooky adventure. Solve puzzles, find hidden secrets, and meet weird Puei creatures.", appId: "puei-mansion", preInstalled: false },
  ];
  const community: StoreApp[] = [
    { name: "bezosmp", icon: "🐞", desc: "A community Minecraft SMP server project. Made by bazicioschi and catotherat.", webUrl: "https://bezosmp.lovable.app", desktopLabel: "bezosmp", preInstalled: false },
  ];
  const isInstalled = (a: StoreApp) => {
    const key = a.webUrl ? `web:${a.webUrl}` : `app:${a.appId || a.name}`;
    if (installedKeys.has(key)) return true;
    if (a.webUrl) return icons.some((i) => i.appId === "web-app" && i.webUrl === a.webUrl);
    if (!a.appId) return false;
    return icons.some((i) => i.appId === a.appId && !i.fileId && !i.webUrl);
  };
  const isOnDesktop = (a: StoreApp) => {
    if (a.webUrl) return icons.some((i) => i.appId === "web-app" && i.webUrl === a.webUrl);
    if (!a.appId) return false;
    return icons.some((i) => i.appId === a.appId && !i.fileId && !i.webUrl);
  };
  const appInstallKey = (a: StoreApp) => a.webUrl ? `web:${a.webUrl}` : `app:${a.appId || a.name}`;
  useEffect(() => {
    return () => {
      Object.values(installTimers.current).forEach((id) => window.clearInterval(id));
      installTimers.current = {};
    };
  }, []);

  const beginInstall = (key: string, onDone: () => void) => {
    if (installTimers.current[key]) return;
    const started = Date.now();
    const duration = 10000 + Math.floor(Math.random() * 5000);
    setInstalling((prev) => ({ ...prev, [key]: 0 }));
    const timer = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
      setInstalling((prev) => prev[key] === undefined ? prev : { ...prev, [key]: pct });
      if (pct >= 100) {
        window.clearInterval(timer);
        delete installTimers.current[key];
        setInstalling((prev) => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
        onDone();
      }
    }, 250);
    installTimers.current[key] = timer;
  };
  return (
    <div className="flex h-full">
      <div className="w-44 p-2 border-r text-sm overflow-auto" style={{ background: "var(--glass)" }}>
        <div className="font-semibold opacity-70 text-xs mb-2 px-2">PUEI APP STORE</div>
        {([["official","✿ Official apps"],["community","🌍 Community"],["installer","📑 Installer"]] as const).map(([k, l]) => (
          <div key={k} onClick={() => { setTab(k); blip("click"); }}
            className="px-3 py-2 rounded cursor-pointer text-sm mb-0.5"
            style={{ background: tab === k ? "var(--gradient-aero)" : "transparent", color: tab === k ? "white" : undefined }}>{l}</div>
        ))}
        <div className="text-[10px] opacity-60 px-2 mt-4 leading-snug">
          PueiOS is a closed ecosystem. Only Puei Team–built apps are allowed here.
        </div>
      </div>
      <div className="flex-1 p-5 overflow-auto">
        {tab === "installer" ? <InstallerPane installWebApp={installWebApp} /> : tab === "community" ? (
          <div>
            <h2 className="text-2xl font-bold mb-1">🌍 Community Apps</h2>
            <p className="text-sm opacity-70 mb-4">Apps made by the Pueio community. Not affiliated with the Puei Team.</p>
            <div className="grid grid-cols-3 gap-3">
              {community.map((a) => {
                const installed = isInstalled(a);
                const onDesktop = isOnDesktop(a);
                const installKey = appInstallKey(a);
                const installPct = installing[installKey];
                const isInstalling2 = installPct !== undefined;
                return (
                  <div key={a.name} className="aero-glass-light rounded-lg p-3 flex flex-col">
                    <div className="text-3xl mb-2">{a.icon}</div>
                    <div className="font-semibold text-sm">{a.name}</div>
                    <div className="text-xs opacity-60 mt-1 flex-1">{a.desc}</div>
                    <div className="flex flex-col gap-1 mt-2">
                      {!installed ? (
                        <button className="aero-button rounded px-2 py-1 text-xs w-full"
                          disabled={isInstalling2}
                          onClick={() => !isInstalling2 && beginInstall(installKey, () => {
                            if (a.webUrl) installWebApp(a.desktopLabel || a.name, a.webUrl);
                          })}>
                          {isInstalling2 ? `${Math.round(installPct!)}%` : "⬇ Install"}
                        </button>
                      ) : (
                        <>
                          {!onDesktop && (
                            <button className="aero-button rounded px-2 py-1 text-xs w-full"
                              onClick={() => { if (a.webUrl) installWebApp(a.desktopLabel || a.name, a.webUrl); blip("notify"); }}>
                              + Add to desktop
                            </button>
                          )}
                          <button className="aero-button rounded px-2 py-1 text-xs w-full opacity-50" disabled>✔ Installed</button>
                          <button className="aero-button rounded px-2 py-1 text-xs w-full" style={{ color: "#fca5a5" }}
                            onClick={() => { if (a.webUrl) uninstallWebApp(a.webUrl); blip("notify"); }}>
                            Uninstall
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-1">PueiOS App Store</h2>
            <p className="text-sm opacity-70 mb-4">Verified, first-party apps built by the Puei Team.</p>
            <div className="grid grid-cols-3 gap-3">
              {official.map((a) => {
                const appInstalled = isInstalled(a);
                const onDesktop = isOnDesktop(a);
                const installKey = appInstallKey(a);
                const installPct = installing[installKey];
                const isInstalling = installPct !== undefined;
                return (
                  <div key={a.name} className="aero-glass-light rounded-lg p-3 flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className="text-3xl">{a.icon}</div>
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-[10px] opacity-60">{a.preInstalled ? "✔ Pre-installed" : "⬇ Installable"} · Puei Team</div>
                      </div>
                    </div>
                    <div className="text-xs opacity-70 mt-1 flex-1">{a.desc}</div>
                    <div className="flex flex-col gap-1 mt-2">
                      {!a.preInstalled ? (
                        !appInstalled ? (
                          <button
                            className="aero-button rounded px-2 py-1 text-xs w-full"
                            disabled={isInstalling}
                            title={isInstalling ? "Installation in progress" : undefined}
                            onClick={() => {
                              if (isInstalling) return;
                              beginInstall(installKey, () => {
                                if (a.webUrl) {
                                  installWebApp(a.desktopLabel || a.name, a.webUrl, a.webUrl.startsWith("puei://") ? undefined : googleFaviconFor(a.webUrl, 64));
                                } else if (a.appId) {
                                  addNativeIcon(a.appId, a.name, a.icon);
                                }
                                blip("notify");
                              });
                            }}>
                            {isInstalling ? `Installing ${Math.floor(installPct)}%` : "⬇ Install"}
                          </button>
                        ) : (
                          <>
                            {!onDesktop && (
                              <button className="aero-button rounded px-2 py-1 text-xs w-full"
                                onClick={() => {
                                  if (a.webUrl) installWebApp(a.desktopLabel || a.name, a.webUrl, a.webUrl.startsWith("puei://") ? undefined : googleFaviconFor(a.webUrl, 64));
                                  else if (a.appId) addNativeIcon(a.appId, a.name, a.icon);
                                  blip("notify");
                                }}>+ Add to desktop</button>
                            )}
                            <button className="aero-button rounded px-2 py-1 text-xs w-full opacity-50" disabled>✔ Installed</button>
                            <button className="aero-button rounded px-2 py-1 text-xs w-full" style={{ color: "#fca5a5" }}
                              onClick={() => {
                                if (a.webUrl) uninstallWebApp(a.webUrl);
                                else if (a.appId) uninstallApp(a.appId);
                                blip("notify");
                              }}>Uninstall</button>
                          </>
                        )
                      ) : (
                        <button
                          className="aero-button rounded px-2 py-1 text-xs w-full"
                          style={{ background: onDesktop ? "rgba(80,200,120,0.25)" : undefined, color: onDesktop ? "#4ade80" : undefined }}
                          disabled={isInstalling || onDesktop}
                          title={isInstalling ? "Installation in progress" : undefined}
                          onClick={() => {
                            if (isInstalling || onDesktop || !a.appId) return;
                            beginInstall(installKey, () => {
                              addNativeIcon(a.appId!, a.name, a.icon);
                              blip("notify");
                            });
                          }}>
                          {isInstalling ? `Installing ${Math.floor(installPct)}%` : onDesktop ? "✔ On desktop" : "+ Add to desktop"}
                        </button>
                      )}
                    </div>
                    {isInstalling && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 rounded-full bg-cyan-900/35 overflow-hidden">
                          <div className="loading-bar-inner h-full" style={{ width: `${installPct}%`, transition: "width 0.25s linear" }} />
                        </div>
                        <div className="text-[10px] opacity-60 mt-1">Estimated 10–15 seconds</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Games */}
            <div className="mt-6">
              <h3 className="font-bold text-base mb-1">🎮 Puei Games</h3>
              <p className="text-sm opacity-70 mb-4">Games by the Puei Team — install and play right in PueiOS.</p>
              <div className="grid grid-cols-3 gap-3">
                {games.map((a) => {
                  const gameInstalled = isInstalled(a);
                  const onDesktop = isOnDesktop(a);
                  const installKey = appInstallKey(a);
                  const installPct = installing[installKey];
                  const isInstalling = installPct !== undefined;
                  return (
                    <div key={a.name} className="aero-glass-light rounded-lg p-3 flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="text-3xl">{a.icon}</div>
                        <div>
                          <div className="font-semibold">{a.name}</div>
                          <div className="text-[10px] opacity-60">⬇ Installable · Puei Team</div>
                        </div>
                      </div>
                      <div className="text-xs opacity-70 mt-1 flex-1">{a.desc}</div>
                      <div className="flex flex-col gap-1 mt-2">
                        {!gameInstalled ? (
                          <button
                            className="aero-button rounded px-2 py-1 text-xs w-full"
                            disabled={isInstalling}
                            onClick={() => {
                              if (isInstalling) return;
                              beginInstall(installKey, () => {
                                addNativeIcon(a.appId!, a.name, a.icon);
                                blip("notify");
                              });
                            }}>
                            {isInstalling ? `Installing ${Math.floor(installPct)}%` : "⬇ Install"}
                          </button>
                        ) : (
                          <>
                            {!onDesktop && (
                              <button className="aero-button rounded px-2 py-1 text-xs w-full"
                                onClick={() => { addNativeIcon(a.appId!, a.name, a.icon); blip("notify"); }}>
                                + Add to desktop
                              </button>
                            )}
                            <button className="aero-button rounded px-2 py-1 text-xs w-full opacity-50" disabled>✔ Installed</button>
                            <button className="aero-button rounded px-2 py-1 text-xs w-full" style={{ color: "#fca5a5" }}
                              onClick={() => { uninstallApp(a.appId!); blip("notify"); }}>Uninstall</button>
                          </>
                        )}
                      </div>
                      {isInstalling && (
                        <div className="mt-2">
                          <div className="w-full h-1.5 rounded-full bg-cyan-900/35 overflow-hidden">
                            <div className="loading-bar-inner h-full" style={{ width: `${installPct}%`, transition: "width 0.25s linear" }} />
                          </div>
                          <div className="text-[10px] opacity-60 mt-1">Estimated 10–15 seconds</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function InstallerPane({ installWebApp }: { installWebApp: (label: string, url: string, iconUrl?: string) => void }) {
  const [url, setUrl] = useState("https://yourapp.lovable.app");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const installTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (installTimer.current) window.clearInterval(installTimer.current);
    };
  }, []);

  const startInstallerInstall = (onDone: () => void) => {
    if (installTimer.current) return;
    const started = Date.now();
    const duration = 10000 + Math.floor(Math.random() * 5000);
    setInstalling(true);
    setInstallProgress(0);
    installTimer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
      setInstallProgress(pct);
      if (pct >= 100) {
        if (installTimer.current) window.clearInterval(installTimer.current);
        installTimer.current = null;
        setInstalling(false);
        onDone();
      }
    }, 250);
  };

  const install = () => {
    if (installing) return;
    const res = classifyTrustedUrl(url);
    if (!res.ok || !res.url || !res.kind) {
      blip("error");
      setMsg({ kind: "err", text: res.reason || "Untrusted URL. Only *.lovable.app and *.base44.app are allowed." });
      return;
    }
    let label = name.trim();
    if (!label) {
      try { label = new URL(res.url).hostname.split(".")[0]; } catch { label = "Web App"; }
    }
    const icon = googleFaviconFor(res.url, 64);
    setMsg({ kind: "ok", text: `Installing "${label}"... please wait (10-15 seconds).` });
    startInstallerInstall(() => {
      installWebApp(label, res.url!, icon);
      const kindLabel = res.kind === "lovable" ? "Lovable" : res.kind === "base44" ? "Base44" : res.kind === "pages" ? "Cloudflare Pages" : "GitHub Pages";
      setMsg({ kind: "ok", text: `Installed "${label}" (${kindLabel} app) on your desktop ✔` });
      blip("notify");
      setUrl(""); setName("");
    });
  };
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">📑 Installer</h2>
      <p className="text-sm opacity-70 mb-4">Install trusted web apps as desktop shortcuts. Only verified domains are accepted.</p>
      <div className="aero-glass-light rounded-lg p-4 max-w-lg space-y-3">
        <div className="text-xs opacity-80">
          <div className="font-semibold mb-1">Trusted domains</div>
          {["https://<app>.lovable.app", "https://<app>.base44.app", "https://<app>.pages.dev", "https://<app>.github.io"].map(d => (
            <code key={d} className="block px-2 py-1 rounded mt-1" style={{ background: "rgba(0,0,0,0.08)" }}>{d}</code>
          ))}
        </div>
        <div>
          <label className="text-xs opacity-70">Website URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.lovable.app"
            className="w-full px-3 py-2 rounded text-sm input-field" />
        </div>
        <div>
          <label className="text-xs opacity-70">App name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Auto from domain"
            className="w-full px-3 py-2 rounded text-sm input-field" />
        </div>
        <button className="aero-button rounded px-4 py-2 w-full" onClick={install} disabled={installing}
          style={{ opacity: installing ? 0.7 : 1 }}>
          {installing ? `Installing ${Math.floor(installProgress)}%` : "Install on desktop"}
        </button>
        {installing && (
          <div>
            <div className="w-full h-2 rounded-full bg-cyan-900/35 overflow-hidden">
              <div className="loading-bar-inner h-full" style={{ width: `${installProgress}%`, transition: "width 0.25s linear" }} />
            </div>
            <div className="text-[10px] opacity-60 mt-1">Estimated 10–15 seconds</div>
          </div>
        )}
        {msg && (
          <div className="text-xs rounded px-2 py-1.5"
            style={{ background: msg.kind === "ok" ? "rgba(80,200,160,0.2)" : "rgba(255,80,80,0.18)", color: msg.kind === "ok" ? undefined : "#a00" }}>
            {msg.text}
          </div>
        )}
        <div className="text-[10px] opacity-60 leading-snug">
          Icons are fetched automatically from the website's favicon (Google service). Each app gets its own real logo.
        </div>
      </div>
    </div>
  );
}

function PueiBoardApp({ user, users }: { user: string; users: User[] }) {
  const [posts, setPosts] = useState<PueiBoardPost[]>(() => loadPueiBoard());
  const [caption, setCaption] = useState("");
  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [activeBoard, setActiveBoard] = useState<string>("All Boards");
  const [mineOnly, setMineOnly] = useState(false);
  const [galleryImages, setGalleryImages] = useState<SavedFile[]>(() =>
    loadFiles().filter((f) => f.type === "image" && (!f.owner || f.owner === user))
  );

  const boards = ["All Boards", "Ideas", "Fashion", "Art", "Rooms", "Memes"];

  useEffect(() => {
    const refreshBoard = () => setPosts(loadPueiBoard());
    const refreshFiles = () => setGalleryImages(loadFiles().filter((f) => f.type === "image" && (!f.owner || f.owner === user)));
    window.addEventListener("pueios-board", refreshBoard);
    window.addEventListener("storage", refreshBoard);
    window.addEventListener("pueios-files-changed", refreshFiles);
    return () => {
      window.removeEventListener("pueios-board", refreshBoard);
      window.removeEventListener("storage", refreshBoard);
      window.removeEventListener("pueios-files-changed", refreshFiles);
    };
  }, [user]);

  useEffect(() => {
    if (!selectedImageId && galleryImages.length) setSelectedImageId(galleryImages[0].id);
    if (selectedImageId && !galleryImages.some((f) => f.id === selectedImageId)) setSelectedImageId("");
  }, [galleryImages, selectedImageId]);

  const me = users.find((u) => u.name === user);
  const selectedImage = galleryImages.find((f) => f.id === selectedImageId);
  const visiblePosts = posts
    .filter((p) => (mineOnly ? p.author === user : true))
    .filter((p) => activeBoard === "All Boards" ? true : p.board === activeBoard)
    .sort((a, b) => b.at - a.at);

  const post = () => {
    if (!selectedImage) return;
    const next: PueiBoardPost[] = [{
      id: `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      author: user,
      authorAvatar: me?.avatar || "🧑",
      board: activeBoard === "All Boards" ? "Ideas" : activeBoard,
      caption: caption.trim(),
      imageSrc: selectedImage.content,
      imageName: selectedImage.name,
      at: Date.now(),
      likes: 0,
      likedBy: [],
    }, ...posts];
    setPosts(next);
    savePueiBoard(next);
    setCaption("");
    blip("notify");
  };

  const removePost = (postId: string) => {
    const next = posts.filter((p) => p.id !== postId);
    setPosts(next);
    savePueiBoard(next);
    blip("click");
  };

  const toggleLike = (postId: string) => {
    const next = posts.map((p) => {
      if (p.id !== postId) return p;
      const likedBy = p.likedBy || [];
      const hasLiked = likedBy.includes(user);
      const nextLikedBy = hasLiked ? likedBy.filter((n) => n !== user) : [...likedBy, user];
      return { ...p, likedBy: nextLikedBy, likes: nextLikedBy.length };
    });
    setPosts(next);
    savePueiBoard(next);
    blip("click");
  };

  return (
    <div className="flex h-full" style={{ background: "var(--glass)" }}>
      <div className="w-72 border-r p-3 overflow-auto" style={{ background: "var(--glass)" }}>
        <div className="font-bold text-lg mb-2">📌 PueiBoard</div>
        <div className="text-xs opacity-70 mb-3">Pin Gallery images onto themed boards like ideas, art, fashion, and memes.</div>

        <div className="mb-3">
          <div className="text-xs opacity-70 mb-1">Boards</div>
          <div className="flex flex-wrap gap-1">
            {boards.map((board) => (
              <button
                key={board}
                className="aero-button rounded px-2 py-1 text-[10px]"
                style={activeBoard === board ? { background: "var(--gradient-aero)", color: "white" } : undefined}
                onClick={() => setActiveBoard(board)}
              >
                {board}
              </button>
            ))}
          </div>
        </div>

        <label className="text-xs opacity-70">Choose image from Gallery</label>
        <select
          className="w-full mt-1 px-2 py-1.5 rounded text-sm input-field" style={{ border: "1px solid var(--border)" }}
          value={selectedImageId}
          onChange={(e) => setSelectedImageId(e.target.value)}
        >
          {!galleryImages.length ? <option value="">No images found in Gallery</option> : null}
          {galleryImages.map((img) => (
            <option key={img.id} value={img.id}>{img.name}</option>
          ))}
        </select>

        {selectedImage && (
          <img src={selectedImage.content} alt={selectedImage.name} className="w-full h-36 object-cover rounded mt-2 border border-white/30" />
        )}

        <label className="text-xs opacity-70 mt-3 block">Caption (optional)</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption for your post..."
          className="w-full mt-1 px-2 py-2 rounded text-sm outline-none resize-none input-field" style={{ minHeight: 70, border: "1px solid var(--border)" }}
        />

        <button
          className="aero-button rounded px-3 py-2 w-full mt-2 text-sm"
          disabled={!selectedImage}
          style={{ opacity: selectedImage ? 1 : 0.6 }}
          onClick={post}
        >
          Pin to {activeBoard === "All Boards" ? "Ideas" : activeBoard}
        </button>

        <div className="text-[10px] opacity-60 mt-2">
          Tip: Save images in Paint or download them to Pictures, then post here.
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold">{activeBoard === "All Boards" ? "Board Feed" : `${activeBoard} Board`}</h2>
            <div className="text-[10px] opacity-55">{visiblePosts.length} pins shown</div>
          </div>
          <div className="flex gap-2">
            <button
              className="aero-button rounded px-3 py-1 text-xs"
              style={mineOnly ? { background: "var(--gradient-aero)", color: "white" } : undefined}
              onClick={() => setMineOnly((v) => !v)}
            >
              {mineOnly ? "Mine only" : "Everyone"}
            </button>
            <button
              className="aero-button rounded px-3 py-1 text-xs"
              onClick={() => setActiveBoard("All Boards")}
            >
              Show all boards
            </button>
          </div>
        </div>

        {visiblePosts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm opacity-60">No posts yet. Share your first image from Gallery.</div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 [column-fill:_balance]">
            {visiblePosts.map((p) => (
              <div key={p.id} className="aero-glass-light rounded-xl mb-3 break-inside-avoid overflow-hidden">
                <img src={p.imageSrc} alt={p.imageName} className="w-full object-cover" />
                <div className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs opacity-80 flex items-center gap-1.5 min-w-0">
                      <span className="w-6 h-6 rounded-full overflow-hidden inline-flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.45)" }}>
                        {p.authorAvatar.startsWith("data:")
                          ? <img src={p.authorAvatar} alt="" className="w-full h-full object-cover" />
                          : p.authorAvatar}
                      </span>
                      <span className="truncate">{p.author}</span>
                    </div>
                    <div className="text-[10px] opacity-60">{new Date(p.at).toLocaleDateString()}</div>
                  </div>
                  {p.caption && <div className="text-sm mt-1 whitespace-pre-wrap">{p.caption}</div>}
                  <div className="text-[10px] uppercase tracking-widest opacity-55 mt-1">Board: {p.board}</div>
                  <div className="text-[10px] opacity-55 mt-1 truncate">Source: {p.imageName}</div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <button className="aero-button rounded px-2 py-1 text-[10px]" onClick={() => toggleLike(p.id)}>
                      {p.likedBy?.includes(user) ? `♥ Liked (${p.likes})` : `♡ Like (${p.likes})`}
                    </button>
                    <button className="aero-button rounded px-2 py-1 text-[10px]" style={{ color: "#fecaca" }} onClick={() => removePost(p.id)}>
                      Delete pin
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>(() => loadFiles().filter((f) => f.folder === folderIconId));
  useEffect(() => {
    const refresh = () => setSavedFiles(loadFiles().filter((f) => f.folder === folderIconId));
    window.addEventListener("pueios-files-changed", refresh);
    return () => window.removeEventListener("pueios-files-changed", refresh);
  }, [folderIconId]);
  const isEmpty = children.length === 0 && savedFiles.length === 0;
  return (
    <div className="p-4 h-full overflow-auto">
      {isEmpty
        ? <div className="text-sm opacity-70 text-center p-8">
            This folder is empty.<br/>Drag files from Documents or Pictures into this folder.
          </div>
        : <FolderFileGrid
            files={savedFiles}
            icons={children}
            onOpen={(f) => { if (f.name.trim().toLowerCase().endsWith(".iso") || f.name.trim().toLowerCase().endsWith(".zip")) { openApp(f.name.trim().toLowerCase().endsWith(".zip") ? "zip-viewer" : "iso-viewer", f.id); return; } openApp(f.type === "image" ? "puei-paint" : "notepad", f.id); }}
            onDelete={(id) => { deleteFile(id); setSavedFiles(loadFiles().filter((f) => f.folder === folderIconId)); }}
            onOpenIcon={(ic) => ic.appId === "web-app" ? openWebApp(ic.webUrl!, ic.label) : openApp(ic.appId, ic.fileId)}
            onMoveToPictures={(f) => { moveFile(f.id, SYS_FOLDER_PICTURES); setSavedFiles(loadFiles().filter((fi) => fi.folder === folderIconId)); blip("notify"); }}
          />
      }
    </div>
  );
}

// ---------- Web App frame ----------
function WebAppFrame({ url, currentUser, startUpgrade }: { url: string; currentUser: string; startUpgrade: (target: SystemVersion) => void }) {
  if (url === "puei://updates") {
    return <PueiUpdaterApp currentUser={currentUser} startUpgrade={startUpgrade} />;
  }
  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-3 py-1 flex items-center gap-2">
        <span className="opacity-60">🔗</span>
        <span className="truncate flex-1">{url}</span>
      </div>
      <div className="flex-1 relative panel-light">
        <iframe src={url} title={url} className="w-full h-full border-0" allow="fullscreen" />
      </div>
    </div>
  );
}

function PueiUpdaterApp({ currentUser, startUpgrade }: { currentUser: string; startUpgrade: (target: SystemVersion) => void }) {
  const [eolMsg, setEolMsg] = useState<string | null>(null);
  const [filesVersion, setFilesVersion] = useState(0);
  const [draggingIsoId, setDraggingIsoId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [mountedIsoId, setMountedIsoId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStopped, setInstallStopped] = useState(false);
  const [restartQueued, setRestartQueued] = useState(false);
  const restartTimer = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => setFilesVersion((value) => value + 1);
    window.addEventListener("pueios-files-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("pueios-files-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (restartTimer.current) window.clearTimeout(restartTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isInstalling) return;
    const started = Date.now();
    const duration = 10000 + Math.floor(Math.random() * 5000);
    const timer = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / duration) * 100);
      setInstallProgress(pct);
      if (pct >= 100) {
        window.clearInterval(timer);
        setIsInstalling(false);
        setRestartQueued(true);
        blip("notify");
        const isoFiles = loadFiles().filter((f) =>
          f.type === "text" && (!f.owner || f.owner === currentUser) &&
          f.folder === SYS_FOLDER_DOWNLOADS &&
          ["pueios2-plus.iso", "pueios2plus.iso", "pueios3.iso"].includes(f.name.trim().toLowerCase())
        );
        const iso = isoFiles.find((file) => file.id === mountedIsoId);
        const targetVersion: SystemVersion = iso && iso.name.trim().toLowerCase() === "pueios3.iso" ? "PueiOS 3" : "PueiOS 2+";
        restartTimer.current = window.setTimeout(() => {
          blip("start");
          startUpgrade(targetVersion);
        }, 900);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isInstalling, startUpgrade, mountedIsoId, currentUser]);

  const isoFiles = loadFiles().filter((f) =>
    f.type === "text" &&
    (!f.owner || f.owner === currentUser) &&
    f.folder === SYS_FOLDER_DOWNLOADS &&
    ["pueios2-plus.iso", "pueios2plus.iso", "pueios3.iso"].includes(f.name.trim().toLowerCase())
  );
  const mountedIso = isoFiles.find((file) => file.id === mountedIsoId) || null;
  const mountedVersion: SystemVersion = mountedIso && mountedIso.name.trim().toLowerCase() === "pueios3.iso" ? "PueiOS 3" : "PueiOS 2+";

  useEffect(() => {
    if (mountedIsoId && !isoFiles.some((file) => file.id === mountedIsoId)) {
      setMountedIsoId(null);
    }
  }, [filesVersion, isoFiles, mountedIsoId]);

  const beginInstall = () => {
    if (!mountedIso) {
      blip("error");
      alert("Drag an ISO into the installer area first.");
      return;
    }
    if (mountedVersion !== "PueiOS 3") {
      blip("error");
      alert(`As of June 6th, ${mountedVersion} is no longer supported and cannot be installed. Please download pueios3.iso from puei://updates instead.`);
      return;
    }
    if (!confirm(`Install ${mountedVersion} from ${mountedIso.name}? Your device will restart when installation finishes.`)) return;
    setInstallStopped(false);
    setRestartQueued(false);
    setInstallProgress(0);
    setIsInstalling(true);
    blip("start");
  };

  const stopInstall = () => {
    if (!isInstalling) return;
    if (!confirm("Stop ISO installation now?")) return;
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
    setIsInstalling(false);
    setInstallProgress(0);
    setRestartQueued(false);
    setInstallStopped(true);
    blip("click");
  };

  const versions: { v: SystemVersion; desc: string; eol?: boolean }[] = [
    { v: "PueiOS 2",  desc: "The original PueiOS 2 release.", eol: true },
    { v: "PueiOS 2+", desc: "Advanced edition with stronger sync and AI systems.", eol: true },
    { v: "PueiOS 3",  desc: "Major release: redesigned shell, new AI assistant, PueiNet 3.0." },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar text-xs px-3 py-1 flex items-center gap-2">
        <span className="opacity-60">Update</span>
        <span className="truncate flex-1">Puei Updater</span>
      </div>
      <div className="flex-1 overflow-auto p-5 space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Puei Updater</h2>
          <p className="text-sm opacity-70 mt-1">Select a version to install. PueiOS 2 and 2+ are no longer supported as of June 6th.</p>
        </div>

        {/* Version list */}
        <div className="space-y-2">
          {versions.map(({ v, desc, eol }) => (
            <div key={v} className="aero-glass-light rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {v}
                  {eol && <span className="text-[10px] rounded px-1.5 py-0.5 font-normal" style={{ background: "rgba(220,50,50,0.2)", color: "#f87171" }}>End of Life</span>}
                </div>
                <div className="text-xs opacity-70 mt-0.5">{desc}</div>
              </div>
              <button
                className="aero-button rounded-lg px-4 py-2 text-sm flex-shrink-0"
                onClick={() => {
                  if (eol) { setEolMsg(`As of June 6th, ${v} is no longer supported. Please install PueiOS 3 instead.`); return; }
                  setEolMsg(null);
                  startUpgrade(v);
                }}>
                {eol ? "Info" : "Install →"}
              </button>
            </div>
          ))}
        </div>

        {eolMsg && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(220,50,50,0.12)", border: "1px solid rgba(220,50,50,0.4)" }}>
            ⚠️ {eolMsg}
          </div>
        )}

        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold mb-1 text-sm">Install from ISO</h3>
          <p className="text-sm opacity-70 mt-1">Download the ISO in Files first, then drag it into the installer zone below.</p>
        </div>

        <div className="grid grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-4">
          <div className="aero-glass-light rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold">Files / Downloads</div>
            <div className="text-[11px] opacity-60">Drag the ISO from here into the install zone.</div>
            {isoFiles.length === 0 ? (
              <div className="text-xs rounded-lg px-3 py-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                No ISO found. Go to puei://updates in PueiWeb, download an ISO, then come back here.
              </div>
            ) : (
              <div className="space-y-2">
                {isoFiles.map((file) => (
                  <div
                    key={file.id}
                    draggable={!isInstalling}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", file.id);
                      setDraggingIsoId(file.id);
                    }}
                    onDragEnd={() => setDraggingIsoId(null)}
                    className="rounded-lg px-3 py-3 cursor-grab active:cursor-grabbing border"
                    style={{
                      background: mountedIsoId === file.id ? "rgba(80,200,120,0.16)" : "rgba(255,255,255,0.08)",
                      borderColor: draggingIsoId === file.id ? "rgba(125,211,252,0.8)" : "rgba(255,255,255,0.14)",
                    }}>
                    <div className="text-sm font-semibold">{file.name}</div>
                    <div className="text-[11px] opacity-60">Ready in Downloads</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="aero-glass-light rounded-xl p-4 space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (!isInstalling) setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                if (isInstalling) return;
                const fileId = event.dataTransfer.getData("text/plain") || draggingIsoId;
                const file = isoFiles.find((entry) => entry.id === fileId);
                if (!file) {
                  blip("error");
                  return;
                }
                setMountedIsoId(file.id);
                setInstallStopped(false);
                blip("click");
              }}
              className="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
              style={{
                borderColor: dropActive ? "rgba(125,211,252,0.9)" : mountedIso ? "rgba(80,200,120,0.7)" : "rgba(255,255,255,0.22)",
                background: dropActive ? "rgba(14,165,233,0.14)" : mountedIso ? "rgba(80,200,120,0.1)" : "rgba(255,255,255,0.05)",
              }}>
              <div className="text-sm font-semibold">{mountedIso ? `${mountedIso.name} mounted` : "Drop ISO here to prepare installation"}</div>
              <div className="text-xs opacity-65 mt-1">
                {mountedIso ? `Puei Updater is ready to install ${mountedVersion} from this ISO.` : "Drag pueios2-plus.iso or pueios3.iso from Files/Downloads."}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="aero-button rounded px-3 py-1.5 text-xs" disabled={!mountedIso || isInstalling || restartQueued}
                style={{ opacity: (!mountedIso || isInstalling || restartQueued) ? 0.5 : 1 }}
                onClick={beginInstall}>
                Install {mountedIso ? mountedVersion : "…"}
              </button>
              <button className="aero-button rounded px-3 py-1.5 text-xs" disabled={!isInstalling}
                style={{ opacity: isInstalling ? 1 : 0.5, color: "#fca5a5" }}
                onClick={stopInstall}>
                Stop installation
              </button>
            </div>

            {isInstalling && (
              <div>
                <div className="text-xs opacity-70 mb-1">Installing from ISO...</div>
                <div className="w-full h-2 rounded-full bg-cyan-900/40 overflow-hidden">
                  <div className="loading-bar-inner h-full" style={{ width: `${installProgress}%`, transition: "width 0.25s linear" }} />
                </div>
                <div className="text-[10px] opacity-60 mt-1">{Math.floor(installProgress)}% • Estimated 10-15 seconds</div>
              </div>
            )}

            {installStopped && !isInstalling && (
              <div className="text-xs rounded px-3 py-2" style={{ background: "rgba(250,204,21,0.2)" }}>
                Installation stopped. Drag the ISO again or press install when ready.
              </div>
            )}

            {restartQueued && !isInstalling && (
              <div className="text-xs rounded px-3 py-2" style={{ background: "rgba(80,200,120,0.2)" }}>
                Installation finished. Restarting now into PueiOS 2+...
              </div>
            )}
          </div>
        </div>

        {/* Pueio Reverse */}
        <div className="aero-glass-light rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">🔄 Pueio Reverse</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(120,40,200,0.25)", color: "#c084fc" }}>Legacy</span>
          </div>
          <p className="text-xs opacity-70">Pueio Reverse lets you load ISOs whose support has ended. The system shows an end-of-support warning before booting.</p>
          <p className="text-xs opacity-50">To use: open any ISO file from Files and click "Boot with Pueio Reverse".</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Puei Studio ----------
type StudioTool = "brush" | "eraser" | "fill" | "eyedropper" | "text" | "shape";
type StudioShape = "rect" | "ellipse" | "line";

function PueiStudioApp({ currentUser, users, icons, setWallpaper }: { currentUser: string; users: User[]; icons: DesktopIcon[]; setWallpaper: (w: WallpaperId) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<StudioTool>("brush");
  const [color, setColor] = useState("#4fa8e0");
  const [brushSize, setBrushSize] = useState(6);
  const [shape, setShape] = useState<StudioShape>("rect");
  const [tab, setTab] = useState<"canvas" | "projects" | "share">("canvas");
  const [projectName, setProjectName] = useState("Untitled");
  const [projects, setProjects] = useState<SavedFile[]>(() =>
    loadFiles().filter(f => f.type === "image" && f.folder === "__studio__" && (!f.owner || f.owner === currentUser))
  );
  const [sharedMsg, setSharedMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const fillRef = useRef<string>(color);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const snapRef = useRef<ImageData | null>(null);

  fillRef.current = color;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    if ("touches" in e) {
      const t = e.touches[0] || (e as any).changedTouches[0];
      return { x: (t.clientX - r.left) * scaleX, y: (t.clientY - r.top) * scaleY };
    }
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  };

  const floodFill = (ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const px = (Math.round(x) + Math.round(y) * w) * 4;
    const tr = d[px], tg = d[px+1], tb = d[px+2], ta = d[px+3];
    const fc = parseInt(fillColor.slice(1), 16);
    const fr = (fc >> 16) & 255, fg = (fc >> 8) & 255, fb = fc & 255;
    if (tr === fr && tg === fg && tb === fb) return;
    const stack = [Math.round(x) + Math.round(y) * w];
    while (stack.length) {
      const i = stack.pop()!;
      if (d[i*4] !== tr || d[i*4+1] !== tg || d[i*4+2] !== tb || d[i*4+3] !== ta) continue;
      d[i*4] = fr; d[i*4+1] = fg; d[i*4+2] = fb; d[i*4+3] = 255;
      const xi = i % w, yi = Math.floor(i / w);
      if (xi > 0) stack.push(i-1);
      if (xi < w-1) stack.push(i+1);
      if (yi > 0) stack.push(i-w);
      if (yi < h-1) stack.push(i+w);
    }
    ctx.putImageData(img, 0, 0);
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const pos = getPos(e);
    if (tool === "fill") { floodFill(ctx, pos.x, pos.y, color); return; }
    if (tool === "eyedropper") {
      const px = ctx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
      setColor(`#${[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,"0")).join("")}`);
      return;
    }
    if (tool === "shape") {
      shapeStart.current = pos;
      snapRef.current = ctx.getImageData(0, 0, c.width, c.height);
    }
    drawing.current = true;
    lastPos.current = pos;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (tool === "eraser" ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fill();
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing.current || tool === "fill" || tool === "eyedropper") return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const pos = getPos(e);
    if (tool === "shape" && shapeStart.current && snapRef.current) {
      ctx.putImageData(snapRef.current, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      const sx = shapeStart.current.x, sy = shapeStart.current.y;
      if (shape === "rect") ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
      else if (shape === "ellipse") {
        ctx.ellipse(sx + (pos.x-sx)/2, sy + (pos.y-sy)/2, Math.abs(pos.x-sx)/2, Math.abs(pos.y-sy)/2, 0, 0, Math.PI*2);
        ctx.stroke();
      } else {
        ctx.moveTo(sx, sy); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      }
      return;
    }
    if (!lastPos.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const onUp = () => { drawing.current = false; lastPos.current = null; shapeStart.current = null; snapRef.current = null; };

  const clearCanvas = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const saveProject = () => {
    const c = canvasRef.current!;
    const data = c.toDataURL("image/png");
    const name = `${projectName.trim() || "Creation"}.png`;
    const id = `studio-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "image", content: data, updatedAt: Date.now(), owner: currentUser, folder: "__studio__" });
    setProjects(loadFiles().filter(f => f.type === "image" && f.folder === "__studio__" && (!f.owner || f.owner === currentUser)));
    setSavedMsg("Saved!"); setTimeout(() => setSavedMsg(""), 2000);
    blip("notify");
  };

  const saveToFiles = () => {
    const c = canvasRef.current!;
    const data = c.toDataURL("image/png");
    const name = `${projectName.trim() || "Creation"}.png`;
    const id = `studio-export-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "image", content: data, updatedAt: Date.now(), owner: currentUser, folder: SYS_FOLDER_PICTURES });
    setSavedMsg("Exported to Pictures!"); setTimeout(() => setSavedMsg(""), 2000);
    blip("notify");
  };

  const shareToSocial = () => {
    const c = canvasRef.current!;
    const data = c.toDataURL("image/png");
    const me = users.find(u => u.name === currentUser);
    const posts = loadSocial();
    const p: SocialPost = {
      id: `studio-${Date.now().toString(36)}`,
      author: currentUser, authorAvatar: me?.avatar || "🧑",
      text: sharedMsg || projectName,
      media: { kind: "image", src: data },
      at: Date.now(), likes: 0, likedBy: [], comments: [],
    };
    saveSocial([p, ...posts]);
    setSharedMsg(""); setSavedMsg("Shared to PueiSocial!"); setTimeout(() => setSavedMsg(""), 2500);
    blip("notify");
  };

  const shareToBoard = () => {
    const c = canvasRef.current!;
    const data = c.toDataURL("image/png");
    const me = users.find(u => u.name === currentUser);
    const posts = loadPueiBoard();
    const p: PueiBoardPost = {
      id: `studio-board-${Date.now().toString(36)}`,
      author: currentUser, authorAvatar: me?.avatar || "🧑",
      board: "Art", caption: sharedMsg || projectName,
      imageSrc: data, imageName: projectName, at: Date.now(), likes: 0, likedBy: [],
    };
    savePueiBoard([p, ...posts]);
    setSavedMsg("Shared to PueiBoard!"); setTimeout(() => setSavedMsg(""), 2500);
    blip("notify");
  };

  const PALETTE = ["#000000","#ffffff","#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#ff5722","#795548","#607d8b","#4fa8e0","#a8e04f","#e04fa8"];

  const toolBtn = (t: StudioTool, icon: string, label: string) => (
    <button key={t} title={label} onClick={() => setTool(t)}
      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-sm"
      style={{ background: tool === t ? "var(--accent)" : "var(--glass)", color: tool === t ? "#fff" : "var(--foreground)", minWidth: 44 }}>
      <span>{icon}</span><span style={{ fontSize: 9 }}>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--glass)" }}>
        <span className="text-xl">🪽</span>
        <div>
          <span className="font-bold text-sm">Puei Studio</span>
          <span className="text-xs opacity-50 ml-2">Create your Pueio world.</span>
        </div>
        <div className="ml-auto flex gap-1">
          {(["canvas","projects","share"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="aero-button rounded-lg px-3 py-1 text-xs capitalize"
              style={{ background: tab === t ? "var(--accent)" : undefined, color: tab === t ? "#fff" : undefined }}>
              {t === "canvas" ? "🎨 Canvas" : t === "projects" ? "📁 Projects" : "📤 Share"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ display: tab === "canvas" ? "flex" : "none" }}>
          {/* Toolbar */}
          <div className="flex flex-col gap-1 p-2 border-r overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--glass)", width: 64 }}>
            {toolBtn("brush","✏️","Brush")}
            {toolBtn("eraser","⬜","Erase")}
            {toolBtn("fill","🪣","Fill")}
            {toolBtn("eyedropper","💉","Pick")}
            {toolBtn("shape","⬡","Shape")}
            <div className="border-t my-1" style={{ borderColor: "var(--border)" }} />
            {tool === "shape" && (["rect","ellipse","line"] as StudioShape[]).map(s => (
              <button key={s} title={s} onClick={() => setShape(s)}
                className="text-xs rounded px-1 py-1"
                style={{ background: shape === s ? "var(--accent)" : "transparent", color: shape === s ? "#fff" : "var(--foreground)" }}>
                {s === "rect" ? "▭" : s === "ellipse" ? "⬬" : "╱"}
              </button>
            ))}
            <div className="border-t my-1" style={{ borderColor: "var(--border)" }} />
            <div className="text-[9px] opacity-50 text-center">Size</div>
            <input type="range" min={1} max={40} value={brushSize} onChange={e => setBrushSize(+e.target.value)}
              className="w-full" style={{ writingMode: "vertical-lr" as any, height: 60, cursor: "pointer" }} />
            <div className="text-[9px] opacity-50 text-center">{brushSize}px</div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800} height={520}
              className="flex-1 block"
              style={{ touchAction: "none", cursor: (() => {
                if (tool === "eyedropper") return "crosshair";
                const r = brushSize; const c = encodeURIComponent(color);
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${r+10}' height='${r+10}' viewBox='0 0 ${r+10} ${r+10}'><circle cx='${(r+10)/2}' cy='${(r+10)/2}' r='${r/2}' fill='${color}' stroke='white' stroke-width='1.5'/><circle cx='${(r+10)/2}' cy='${(r+10)/2}' r='${r/2}' fill='none' stroke='black' stroke-width='0.5' opacity='0.5'/></svg>`;
                return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round((r+10)/2)} ${Math.round((r+10)/2)}, crosshair`;
              })(), width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
            />
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-3 p-3 border-l overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--glass)", width: 160 }}>
            <div>
              <div className="text-[10px] opacity-50 mb-1">Color</div>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-full h-8 rounded cursor-pointer" style={{ border: "none", padding: 0 }} />
            </div>
            <div>
              <div className="text-[10px] opacity-50 mb-1.5">Palette</div>
              <div className="grid grid-cols-4 gap-1">
                {PALETTE.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{ width: 24, height: 24, borderRadius: 4, background: c, border: color === c ? "2px solid var(--accent)" : "1px solid rgba(0,0,0,0.2)", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <div className="border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-[10px] opacity-50 mb-1">Project name</div>
              <input value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full rounded px-2 py-1 text-xs input-field" />
            </div>
            <button onClick={clearCanvas} className="aero-button rounded px-2 py-1 text-xs">🗑 Clear</button>
            <button onClick={saveProject} className="aero-button rounded px-2 py-1 text-xs">💾 Save project</button>
            <button onClick={saveToFiles} className="aero-button rounded px-2 py-1 text-xs">📤 Export to Files</button>
            <button onClick={() => {
              const data = canvasRef.current?.toDataURL("image/png");
              if (!data) return;
              setWallpaper(data);
              setSavedMsg("Wallpaper set!"); setTimeout(() => setSavedMsg(""), 2000);
              blip("notify");
            }} className="aero-button rounded px-2 py-1 text-xs">🖼️ Set as Wallpaper</button>
            {savedMsg && <div className="text-xs text-green-400 font-semibold text-center">{savedMsg}</div>}
          </div>
        </div>

      {tab === "projects" && (
        <div className="flex-1 overflow-auto p-4">
          <h3 className="font-semibold mb-3 text-sm">Saved Projects</h3>
          {projects.length === 0 ? (
            <div className="text-sm opacity-50 text-center mt-8">No saved projects yet. Create something on the canvas and save it!</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {projects.map(f => (
                <div key={f.id} className="aero-glass-light rounded-xl overflow-hidden">
                  <img src={f.content} alt={f.name} className="w-full h-28 object-cover" />
                  <div className="p-2">
                    <div className="text-xs font-semibold truncate">{f.name}</div>
                    <div className="text-[10px] opacity-50">{new Date(f.updatedAt).toLocaleDateString()}</div>
                    <div className="flex gap-1 mt-1.5">
                      <button className="aero-button rounded px-2 py-0.5 text-[10px]" onClick={() => {
                        const ctx = canvasRef.current?.getContext("2d");
                        if (!ctx) return;
                        const img = new Image();
                        img.onload = () => { ctx.clearRect(0,0,800,520); ctx.drawImage(img,0,0,800,520); };
                        img.src = f.content;
                        setTab("canvas");
                        setProjectName(f.name.replace(/\.png$/, ""));
                      }}>Edit</button>
                      <button className="aero-button rounded px-2 py-0.5 text-[10px]" onClick={() => {
                        deleteFile(f.id);
                        setProjects(p => p.filter(x => x.id !== f.id));
                      }}>Del</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "share" && (
        <div className="flex-1 overflow-auto p-6 max-w-xl">
          <h3 className="font-semibold mb-1 text-sm">Share your creation</h3>
          <p className="text-xs opacity-50 mb-4">Export the current canvas directly to PueiSocial or PueiBoard.</p>
          <div className="mb-4">
            <label className="text-xs opacity-70 block mb-1">Caption (optional)</label>
            <input value={sharedMsg} onChange={e => setSharedMsg(e.target.value)}
              className="w-full rounded px-3 py-2 text-sm input-field" placeholder={projectName} />
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={shareToSocial} className="aero-button rounded-xl px-4 py-3 text-sm text-left flex items-center gap-3">
              <span className="text-xl">📢</span>
              <div><div className="font-semibold">Share to PueiSocial</div><div className="text-xs opacity-60">Post to your feed — all followers can see it</div></div>
            </button>
            <button onClick={shareToBoard} className="aero-button rounded-xl px-4 py-3 text-sm text-left flex items-center gap-3">
              <span className="text-xl">📌</span>
              <div><div className="font-semibold">Share to PueiBoard</div><div className="text-xs opacity-60">Pin your art to the Art board</div></div>
            </button>
            <button onClick={saveToFiles} className="aero-button rounded-xl px-4 py-3 text-sm text-left flex items-center gap-3">
              <span className="text-xl">🖼️</span>
              <div><div className="font-semibold">Export to Pictures</div><div className="text-xs opacity-60">Save as PNG to your Files / Pictures folder</div></div>
            </button>
            <button onClick={saveProject} className="aero-button rounded-xl px-4 py-3 text-sm text-left flex items-center gap-3">
              <span className="text-xl">📁</span>
              <div><div className="font-semibold">Save to Projects</div><div className="text-xs opacity-60">Save to Puei Disk › C:\Projects</div></div>
            </button>
          </div>
          {savedMsg && <div className="mt-4 text-sm text-green-400 font-semibold">{savedMsg}</div>}
        </div>
      )}
    </div>
  );
}

// ---------- Puei Films ----------
const FILMS_KEY = "pueios2-films-v1";
type FilmPost = { id: string; title: string; desc: string; videoSrc: string; postedAt: number };
function loadFilms(): FilmPost[] { try { return JSON.parse(localStorage.getItem(FILMS_KEY) || "[]"); } catch { return []; } }
function saveFilms(f: FilmPost[]) { localStorage.setItem(FILMS_KEY, JSON.stringify(f)); window.dispatchEvent(new Event("pueios-films")); }

function PueiFilmsPage({ currentUser }: { currentUser: string }) {
  const isAdmin = currentUser.trim().toLowerCase() === "pueioficial";
  const [films, setFilms] = useState<FilmPost[]>(() => loadFilms());
  const [playing, setPlaying] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  useEffect(() => {
    const sync = () => setFilms(loadFilms());
    window.addEventListener("storage", sync);
    window.addEventListener("pueios-films", sync);
    // Pull latest films from pueioficial's cloud account on mount
    setFetching(true);
    fetchPublicFilms().then((f) => { if (f.length) setFilms(f as FilmPost[]); setFetching(false); }).catch(() => setFetching(false));
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("pueios-films", sync); };
  }, []);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [videoSrc, setVideoSrc] = useState("");
  const [uploading, setUploading] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const r = new FileReader();
    r.onload = () => { setVideoSrc(String(r.result)); setUploading(false); };
    r.readAsDataURL(f);
  };

  const post = () => {
    if (!title.trim() || !videoSrc) return;
    const next: FilmPost[] = [{ id: `film-${Date.now().toString(36)}`, title: title.trim(), desc: desc.trim(), videoSrc, postedAt: Date.now() }, ...films];
    setFilms(next); saveFilms(next);
    setTitle(""); setDesc(""); setVideoSrc(""); blip("notify");
  };

  const remove = (id: string) => {
    const next = films.filter(f => f.id !== id);
    setFilms(next); saveFilms(next);
    if (playing === id) setPlaying(null);
    blip("click");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <span className="font-bold text-base">🎬 Puei Films</span>
        <span className="text-xs opacity-50">Official videos posted by pueioficial</span>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isAdmin && (
          <div className="aero-glass-light rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold opacity-70">📤 Post a new film</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full rounded px-3 py-1.5 text-sm input-field" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded px-3 py-1.5 text-sm input-field" />
            <div className="flex items-center gap-3">
              <label className="aero-button rounded px-3 py-1.5 text-xs cursor-pointer">
                {uploading ? "Loading…" : videoSrc ? "✅ Video ready" : "📁 Choose video"}
                <input type="file" accept="video/*" className="hidden" onChange={onFile} />
              </label>
              <button onClick={post} disabled={!title.trim() || !videoSrc || uploading}
                className="aero-button rounded px-4 py-1.5 text-xs font-semibold"
                style={{ opacity: (!title.trim() || !videoSrc || uploading) ? 0.4 : 1 }}>
                Post Film
              </button>
            </div>
          </div>
        )}
        {fetching && films.length === 0 && (
          <div className="text-center text-sm opacity-50 py-12 animate-pulse">Loading films… 🎬</div>
        )}
        {!fetching && films.length === 0 && (
          <div className="text-center text-sm opacity-50 py-12">No films yet. Check back soon! 🎬</div>
        )}
        {films.map(f => (
          <div key={f.id} className="aero-glass-light rounded-xl overflow-hidden">
            {playing === f.id ? (
              <video src={f.videoSrc} controls autoPlay className="w-full max-h-64 bg-black" style={{ display: "block" }} />
            ) : (
              <div className="w-full h-36 bg-black flex items-center justify-center cursor-pointer relative"
                onClick={() => setPlaying(f.id)}
                style={{ background: "linear-gradient(135deg,#0a0a1a,#1a0a2a)" }}>
                <div className="text-5xl opacity-80">▶</div>
                <div className="absolute bottom-2 right-2 text-[10px] opacity-50 text-white">{new Date(f.postedAt).toLocaleDateString()}</div>
              </div>
            )}
            <div className="p-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{f.title}</div>
                {f.desc && <div className="text-xs opacity-60 mt-0.5">{f.desc}</div>}
                <div className="text-[10px] opacity-40 mt-1">pueioficial · {new Date(f.postedAt).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => setPlaying(playing === f.id ? null : f.id)}>
                  {playing === f.id ? "⏹ Stop" : "▶ Play"}
                </button>
                {isAdmin && (
                  <button className="aero-button rounded px-2 py-1 text-xs" style={{ color: "#fca5a5" }} onClick={() => remove(f.id)}>Delete</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- PueiSocial ----------
function PueiSocialApp({ user, users }: { user: string; users: User[] }) {
  const [posts, setPosts] = useState<SocialPost[]>(() => loadSocial());
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ kind: "image" | "video"; src: string } | undefined>();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [socialTab, setSocialTab] = useState<"feed" | "history">("feed");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
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
      text, media, at: Date.now(), likes: 0, likedBy: [], comments: [],
    };
    const next = [p, ...posts];
    setPosts(next); saveSocial(next);
    setText(""); setMedia(undefined);
  };
  const toggleLike = (id: string) => {
    blip("click");
    const next = posts.map((p) => {
      if (p.id !== id) return p;
      const likedBy = p.likedBy || [];
      const has = likedBy.includes(user);
      const nextLikedBy = has ? likedBy.filter((n) => n !== user) : [...likedBy, user];
      return { ...p, likedBy: nextLikedBy, likes: nextLikedBy.length };
    });
    setPosts(next); saveSocial(next);
  };
  const addComment = (postId: string) => {
    const body = (commentDrafts[postId] || "").trim();
    if (!body) return;
    blip("click");
    const c: SocialComment = {
      id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      author: user, authorAvatar: me?.avatar || "🧑", text: body, at: Date.now(),
    };
    const next = posts.map((p) => p.id === postId
      ? { ...p, comments: [...(p.comments || []), c] }
      : p);
    setPosts(next); saveSocial(next);
    setCommentDrafts({ ...commentDrafts, [postId]: "" });
  };
  const deleteComment = (postId: string, commentId: string) => {
    const next = posts.map((p) => p.id === postId
      ? { ...p, comments: (p.comments || []).filter((c) => c.id !== commentId) }
      : p);
    setPosts(next); saveSocial(next);
  };
  const deletePost = (postId: string) => {
    const next = posts.filter((p) => p.id !== postId);
    setPosts(next); saveSocial(next);
  };
  const startEdit = (p: SocialPost) => { setEditingPostId(p.id); setEditText(p.text); };
  const saveEdit = (postId: string) => {
    const next = posts.map((p) => p.id === postId ? { ...p, text: editText } : p);
    setPosts(next); saveSocial(next); setEditingPostId(null); setEditText(""); blip("notify");
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
        <div className="font-bold text-lg flex items-center gap-2">📢 PueiSocial</div>
        <div className="flex items-center gap-2">
          <button className="aero-button rounded px-3 py-1 text-xs" style={socialTab === "feed" ? { background: "var(--gradient-aero)", color: "white" } : undefined}
            onClick={() => setSocialTab("feed")}>Feed</button>
          <button className="aero-button rounded px-3 py-1 text-xs" style={socialTab === "history" ? { background: "var(--gradient-aero)", color: "white" } : undefined}
            onClick={() => setSocialTab("history")}>📣 History</button>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <div className="text-xs opacity-70 flex items-center gap-1.5">
            Available on:
            <span title="iOS">📱</span>
            <span title="Android">🐛</span>
            <span title="Windows">🪟</span>
            <span title="macOS"></span>
            <span title="Linux">🐧</span>
          </div>
          <div className="text-[10px] opacity-60 flex items-center gap-1">
            🎬 <span className="font-semibold">Pueio Videos</span> · Supported Softwares:
            <span className="bg-cyan-500/20 rounded px-1 font-semibold">Pueios2</span>
            <span className="bg-purple-500/20 rounded px-1 font-semibold">Pueios2+</span>
          </div>
        </div>
      </div>
      <div className="p-4 overflow-auto flex-1 space-y-3" style={{ background: "var(--glass)" }}>
        {socialTab === "history" && (
          <div className="aero-glass-light rounded-xl p-5 max-w-lg mx-auto">
            <h2 className="text-xl font-bold mb-3">📣 The History of Puei</h2>
            <p className="text-sm leading-relaxed opacity-90">
              The <strong>Puei</strong> was created in <strong>2020</strong> by three siblings while playing outside. It quickly became a beloved character among them — full of personality and charm.
            </p>
            <p className="text-sm leading-relaxed opacity-90 mt-3">
              But the Puei was then long forgotten in history, fading into memory for years…
            </p>
            <p className="text-sm leading-relaxed opacity-90 mt-3">
              After <strong>5 long years</strong>, in <strong>2026</strong>, the triplets decided to revive the Puei. They created the official <strong>Puei account on BezoSMP</strong> and started posting Puei content, bringing the character back to life for the world to see.
            </p>
            <p className="text-sm leading-relaxed opacity-90 mt-3">
              A few months later, the official <strong>PueiOS</strong> operating system was released — a full web-based OS built in tribute to the Puei, featuring a Windows 7 Aero-inspired glass UI, cloud-synced accounts, and a whole suite of Puei-themed apps.
            </p>
            <div className="mt-4 pt-3 border-t border-white/20 text-xs opacity-60 space-y-1">
              <div>📸 2020 — Puei is born, created by three siblings</div>
              <div>💡 2021–2025 — The Forgotten Years</div>
              <div>📢 2026 — Puei revival on BezoSMP</div>
              <div>💻 2026 — PueiOS officially released</div>
            </div>
          </div>
        )}
        {socialTab === "feed" && (<>
        <div className="aero-glass-light rounded-xl p-3">
          <div className="flex items-start gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xl"
              style={{ background: `linear-gradient(135deg, oklch(0.7 0.18 ${me?.color || 200}), oklch(0.45 0.2 ${me?.color || 200}))` }}>
              {me?.avatar?.startsWith("data:") ? <img src={me.avatar} alt="" className="w-full h-full object-cover" /> : (me?.avatar || "🧑")}
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder={`What's on your mind, ${user}?`}
              className="flex-1 p-2 rounded outline-none text-sm resize-none input-field" style={{ minHeight: 60 }} />
          </div>
          {media && (
            <div className="mt-2 relative">
              {media.kind === "image"
                ? <img src={media.src} className="max-h-60 rounded" alt="" />
                : <video src={media.src} controls className="max-h-60 rounded" />}
              <button onClick={() => setMedia(undefined)}
                className="absolute top-1 right-1 aero-button rounded-full w-6 h-6 text-xs">✒</button>
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
        {posts.map((p) => {
          const liked = (p.likedBy || []).includes(user);
          const comments = p.comments || [];
          const commentsOpen = !!openComments[p.id];
          return (
            <div key={p.id} className="aero-glass-light rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-lg"
                  style={{ background: "var(--gradient-aero)" }}>
                  {p.authorAvatar.startsWith("data:") ? <img src={p.authorAvatar} alt="" className="w-full h-full object-cover" /> : p.authorAvatar}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.author}</div>
                  <div className="text-[10px] opacity-60">{new Date(p.at).toLocaleString()}</div>
                </div>
                {p.author === user && (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(p)} className="text-xs opacity-50 hover:opacity-100 hover:text-blue-400" title="Edit post">✅</button>
                    <button onClick={() => deletePost(p.id)} className="text-xs opacity-50 hover:opacity-100 hover:text-red-500" title="Delete post">🖦️</button>
                  </div>
                )}
              </div>
              {editingPostId === p.id ? (
                <div className="mb-2">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 rounded text-sm outline-none resize-none input-field" style={{ minHeight: 60 }} />
                  <div className="flex gap-2 mt-1">
                    <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => saveEdit(p.id)}>Save</button>
                    <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => setEditingPostId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                p.text && <div className="text-sm whitespace-pre-wrap mb-2">{p.text}</div>
              )}
              {p.media?.kind === "image" && <img src={p.media.src} className="max-h-80 rounded w-auto" alt="" />}
              {p.media?.kind === "video" && <video src={p.media.src} controls className="max-h-80 rounded w-full" />}
              <div className="flex gap-2 mt-2 text-xs">
                <button onClick={() => toggleLike(p.id)}
                  className="aero-button rounded px-2 py-0.5 flex items-center gap-1"
                  style={liked ? { background: "var(--gradient-aero)", color: "white" } : undefined}>
                  {liked ? "💖" : "👍"} {p.likes}
                </button>
                <button onClick={() => setOpenComments({ ...openComments, [p.id]: !commentsOpen })}
                  className="aero-button rounded px-2 py-0.5">
                  💼 {comments.length}
                </button>
                <span className="opacity-60 self-center ml-auto">PueiSocial · cross-platform</span>
              </div>
              {commentsOpen && (
                <div className="mt-3 pl-2 border-l-2 border-white/20 space-y-2">
                  {comments.length === 0 && (
                    <div className="text-[11px] opacity-50">No comments yet. Be the first to reply.</div>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0"
                        style={{ background: "var(--gradient-aero)" }}>
                        {c.authorAvatar.startsWith("data:")
                          ? <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
                          : c.authorAvatar}
                      </div>
                      <div className="flex-1 bg-white/15 rounded-lg px-2 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{c.author}</span>
                          <span className="text-[10px] opacity-50">{new Date(c.at).toLocaleString()}</span>
                        </div>
                        <div className="text-xs whitespace-pre-wrap">{c.text}</div>
                      </div>
                      {c.author === user && (
                        <button onClick={() => deleteComment(p.id, c.id)} className="text-xs opacity-40 hover:opacity-100 hover:text-red-500" title="Delete">✒</button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-1 pt-1">
                    <input
                      value={commentDrafts[p.id] || ""}
                      onChange={(e) => setCommentDrafts({ ...commentDrafts, [p.id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") addComment(p.id); }}
                      placeholder="Write a comment…"
                      className="flex-1 px-2 py-1 rounded text-xs outline-none input-field" style={{ border: "1px solid var(--border)" }} />
                    <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => addComment(p.id)}>Reply</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </>)}
      </div>
    </div>
  );
}

// ---------- ZIP Viewer ----------
function ZipViewerApp({ fileId }: { fileId?: string }) {
  const zipFile = fileId ? loadFiles().find(f => f.id === fileId) : null;
  const [preview, setPreview] = useState<string | null>(null);

  const fileIds: string[] = (() => {
    if (!zipFile?.content) return [];
    try { return JSON.parse(zipFile.content) as string[]; } catch { return []; }
  })();
  const allFiles = loadFiles();
  const entries = fileIds.map(id => allFiles.find(f => f.id === id)).filter(Boolean) as SavedFile[];

  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <span className="text-lg">📦</span>
        <span className="font-bold text-sm">{zipFile?.name ?? "ZIP Archive"}</span>
        <span className="text-xs opacity-50">{entries.length} file{entries.length !== 1 ? "s" : ""}</span>
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-w-[90vw] max-h-[85vh] rounded shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white text-2xl opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
        {!zipFile && <div className="text-sm opacity-50 text-center py-12">No archive found.</div>}
        {zipFile && entries.length === 0 && <div className="text-sm opacity-50 text-center py-12">Empty archive.</div>}
        {entries.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {entries.map((f) => (
              <div key={f.id} className="rounded-lg overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                {f.type === "image" ? (
                  <div className="cursor-pointer" onClick={() => setPreview(f.content)}>
                    <img src={f.content} alt={f.name} className="w-full h-24 object-cover" />
                    <div className="px-2 py-1 text-xs truncate opacity-70">{f.name}</div>
                  </div>
                ) : (
                  <div className="p-2">
                    <div className="text-2xl mb-1">📄</div>
                    <div className="text-xs font-semibold truncate">{f.name}</div>
                    <div className="text-[10px] opacity-50 mt-1 line-clamp-3 font-mono whitespace-pre-wrap break-all">{f.content?.slice(0, 120)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- ISO Viewer ----------
function IsoViewerApp({ fileId }: { fileId?: string }) {
  const file = fileId ? loadFiles().find(f => f.id === fileId) : null;
  const name = file?.name?.trim().toLowerCase() ?? "";
  const isLegacy = name === "pueios2-plus.iso" || name === "pueios2plus.iso";
  const isPueiOS3 = name === "pueios3.iso";
  const [reverseBooting, setReverseBooting] = useState(false);
  const [reverseStage, setReverseStage] = useState(0);

  const startReverse = () => {
    setReverseBooting(true);
    setReverseStage(1);
    setTimeout(() => setReverseStage(2), 2000);
    setTimeout(() => setReverseStage(3), 4000);
  };

  if (reverseBooting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8"
        style={{ background: reverseStage >= 2 ? "#000" : undefined, color: reverseStage >= 2 ? "#ff4444" : undefined }}>
        {reverseStage === 1 && <>
          <div className="text-4xl animate-spin">⚙️</div>
          <div className="font-semibold">Pueio Reverse — Loading legacy ISO…</div>
          <div className="text-xs opacity-60">Bypassing end-of-support restrictions</div>
        </>}
        {reverseStage === 2 && <>
          <div className="text-5xl">⛔</div>
          <div className="font-bold text-2xl" style={{ color: "#ff4444" }}>END OF SUPPORT</div>
          <div className="text-sm max-w-sm" style={{ color: "#ffaaaa" }}>
            This version of PueiOS is no longer supported by Pueian Lemne or any Pueio team member.
            Security updates have ended. Proceed only if you understand the risks.
          </div>
          <div className="text-xs opacity-50 mt-2">Pueio Reverse override active</div>
        </>}
        {reverseStage === 3 && <>
          <div className="text-5xl">💿</div>
          <div className="font-bold text-lg">{file?.name}</div>
          <div className="aero-glass-light rounded-xl p-5 max-w-sm space-y-3" style={{ color: "initial" }}>
            <div className="font-semibold text-base">Pueio Reverse — Mounted</div>
            <div className="text-sm opacity-70">
              Legacy ISO loaded via Pueio Reverse. This version has reached end of support — no security patches or updates are available.
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono opacity-60 text-left">
              <div>Version:</div><div>{file?.name?.replace(".iso","")}</div>
              <div>Status:</div><div style={{ color: "#f87171" }}>End of Life</div>
              <div>Override:</div><div style={{ color: "#4ade80" }}>Pueio Reverse ✔</div>
            </div>
          </div>
          <button className="aero-button rounded px-4 py-2 text-sm" onClick={() => { setReverseBooting(false); setReverseStage(0); }}>
            Eject ISO
          </button>
        </>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
      <div className="text-5xl">💿</div>
      <div className="font-bold text-lg">{file?.name ?? "ISO Image"}</div>
      {isLegacy && (
        <div className="aero-glass-light rounded-xl p-5 max-w-sm space-y-3">
          <div className="text-2xl">⛔</div>
          <div className="font-semibold text-base">End of Support</div>
          <div className="text-sm opacity-70">
            This version of PueiOS has reached end of support and can no longer be installed.
            Please download <strong>pueios3.iso</strong> from the Puei Updater app to upgrade.
          </div>
          <button className="aero-button rounded-lg px-4 py-2 text-xs font-semibold w-full mt-1"
            style={{ background: "rgba(120,40,200,0.25)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.3)" }}
            onClick={startReverse}>
            🔄 Boot with Pueio Reverse
          </button>
          <div className="text-[10px] opacity-40">Pueio Reverse bypasses end-of-support restrictions. Use at your own risk.</div>
        </div>
      )}
      {isPueiOS3 && (
        <div className="aero-glass-light rounded-xl p-5 max-w-sm space-y-2">
          <div className="text-2xl">✅</div>
          <div className="font-semibold text-base">PueiOS 3 Installation Image</div>
          <div className="text-sm opacity-70">
            Open <strong>Puei Updater</strong> from your desktop and drag this ISO into the install zone to upgrade.
          </div>
        </div>
      )}
      {!isLegacy && !isPueiOS3 && (
        <div className="aero-glass-light rounded-xl p-5 max-w-sm">
          <div className="text-sm opacity-70">This ISO cannot be mounted in PueiOS.</div>
        </div>
      )}
    </div>
  );
}

// ---------- Recycle Bin ----------
function RecycleBinApp() {
  const [items, setItems] = useState<RecycleEntry[]>(() => loadRecycle());
  useEffect(() => {
    const fn = () => setItems(loadRecycle());
    window.addEventListener("pueios-recycle-changed", fn);
    return () => window.removeEventListener("pueios-recycle-changed", fn);
  }, []);
  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">🖦️ Recycle Bin</h2>
        <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => { emptyRecycle(); setItems([]); }}>Empty Recycle Bin</button>
      </div>
      {items.length === 0 ? (
        <div className="text-sm opacity-60 text-center p-8">Recycle Bin is empty.</div>
      ) : (
        <div className="grid grid-cols-5 gap-3 overflow-auto">
          {items.map((f) => (
            <div key={f.id} className="text-center p-2 rounded hover:bg-white/30">
              {f.type === "image"
                ? <img src={f.content} alt="" className="w-12 h-12 mx-auto object-cover rounded shadow opacity-70" />
                : <div className="text-4xl opacity-70">📄</div>}
              <div className="text-xs mt-1 truncate">{f.name}</div>
              <div className="flex gap-1 mt-1 justify-center">
                <button className="aero-button rounded px-1 text-[10px]" onClick={() => { restoreFromRecycle(f.id); setItems(loadRecycle()); }}>Restore</button>
                <button className="aero-button rounded px-1 text-[10px]" onClick={() => { permanentDelete(f.id); setItems(loadRecycle()); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Chess (vs AI bot — real legal moves + minimax) ----------
function ChessApp() {
  type Piece = { type: "K"|"Q"|"R"|"B"|"N"|"P"; color: "w"|"b" };
  type Board = (Piece|null)[][];
  type Pos = [number,number];

  const initBoard = (): Board => {
    const b: Board = Array.from({length:8},()=>Array(8).fill(null));
    const order: Piece["type"][] = ["R","N","B","Q","K","B","N","R"];
    for (let c=0;c<8;c++) {
      b[0][c]={type:order[c],color:"b"};
      b[1][c]={type:"P",color:"b"};
      b[6][c]={type:"P",color:"w"};
      b[7][c]={type:order[c],color:"w"};
    }
    return b;
  };

  const GLYPHS: Record<string,string> = {wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};

  const inBounds = (r:number,c:number) => r>=0&&r<8&&c>=0&&c<8;

  const slideMoves = (board:Board, r:number, c:number, dirs:[number,number][], color:"w"|"b"):Pos[] => {
    const moves:Pos[]=[];
    for (const [dr,dc] of dirs) {
      let nr=r+dr,nc=c+dc;
      while(inBounds(nr,nc)){
        const t=board[nr][nc];
        if(!t){moves.push([nr,nc]);}
        else{if(t.color!==color)moves.push([nr,nc]);break;}
        nr+=dr;nc+=dc;
      }
    }
    return moves;
  };

  const pieceMoves = (board:Board, r:number, c:number, color:"w"|"b"):Pos[] => {
    const p=board[r][c]; if(!p) return [];
    const moves:Pos[]=[];
    const opp=(col:"w"|"b")=>col==="w"?"b":"w";
    if(p.type==="P"){
      const dir=p.color==="w"?-1:1;
      const startRow=p.color==="w"?6:1;
      if(inBounds(r+dir,c)&&!board[r+dir][c]){
        moves.push([r+dir,c]);
        if(r===startRow&&!board[r+2*dir][c])moves.push([r+2*dir,c]);
      }
      for(const dc of[-1,1]){
        if(inBounds(r+dir,c+dc)&&board[r+dir][c+dc]?.color===opp(color))moves.push([r+dir,c+dc]);
      }
    } else if(p.type==="N"){
      for(const [dr,dc] of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
        const [nr,nc]=[r+dr,c+dc];
        if(inBounds(nr,nc)&&board[nr][nc]?.color!==color)moves.push([nr,nc]);
      }
    } else if(p.type==="K"){
      for(const [dr,dc] of[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
        const [nr,nc]=[r+dr,c+dc];
        if(inBounds(nr,nc)&&board[nr][nc]?.color!==color)moves.push([nr,nc]);
      }
    } else if(p.type==="R") moves.push(...slideMoves(board,r,c,[[-1,0],[1,0],[0,-1],[0,1]],color));
    else if(p.type==="B") moves.push(...slideMoves(board,r,c,[[-1,-1],[-1,1],[1,-1],[1,1]],color));
    else if(p.type==="Q") moves.push(...slideMoves(board,r,c,[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],color));
    return moves;
  };

  const applyMove = (board:Board, from:Pos, to:Pos): Board => {
    const nb=board.map(row=>[...row]);
    const p=nb[from[0]][from[1]];
    nb[to[0]][to[1]]=p;
    nb[from[0]][from[1]]=null;
    // pawn promotion
    if(p?.type==="P"&&(to[0]===0||to[0]===7)) nb[to[0]][to[1]]={type:"Q",color:p.color};
    return nb;
  };

  const VALUE: Record<string,number> = {P:1,N:3,B:3,R:5,Q:9,K:100};
  const evalBoard = (board:Board): number => {
    let score=0;
    for(const row of board) for(const p of row) if(p) score+=(p.color==="w"?1:-1)*VALUE[p.type];
    return score;
  };

  const allMoves = (board:Board, color:"w"|"b") => {
    const moves:[Pos,Pos][]=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
      if(board[r][c]?.color===color) for(const to of pieceMoves(board,r,c,color)) moves.push([[r,c],to]);
    }
    return moves;
  };

  // Check detection — filters moves that leave own king in check
  const findKing = (board:Board, color:"w"|"b"):Pos|null => {
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]?.type==="K"&&board[r][c]?.color===color) return [r,c];
    return null;
  };
  const isInCheck = (board:Board, color:"w"|"b"):boolean => {
    const king=findKing(board,color);
    if(!king) return false;
    const opp=color==="w"?"b":"w";
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]?.color===opp&&pieceMoves(board,r,c,opp).some(([mr,mc])=>mr===king[0]&&mc===king[1]))
        return true;
    return false;
  };
  const legalMovesFor = (board:Board, r:number, c:number):Pos[] => {
    const piece=board[r][c];
    if(!piece) return [];
    return pieceMoves(board,r,c,piece.color).filter(([tr,tc])=>!isInCheck(applyMove(board,[r,c],[tr,tc]),piece.color));
  };
  const allLegalMoves = (board:Board, color:"w"|"b"):[Pos,Pos][] => {
    const moves:[Pos,Pos][]=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++)
      if(board[r][c]?.color===color) for(const to of legalMovesFor(board,r,c)) moves.push([[r,c],to]);
    return moves;
  };

  const minimax = (board:Board, depth:number, alpha:number, beta:number, maximizing:boolean): number => {
    if(depth===0) return evalBoard(board);
    const color=maximizing?"w":"b";
    const moves=allLegalMoves(board,color);
    if(!moves.length) return maximizing?-999:999;
    if(maximizing){
      let best=-Infinity;
      for(const [from,to] of moves){
        const val=minimax(applyMove(board,from,to),depth-1,alpha,beta,false);
        best=Math.max(best,val); alpha=Math.max(alpha,val);
        if(beta<=alpha) break;
      }
      return best;
    } else {
      let best=Infinity;
      for(const [from,to] of moves){
        const val=minimax(applyMove(board,from,to),depth-1,alpha,beta,true);
        best=Math.min(best,val); beta=Math.min(beta,val);
        if(beta<=alpha) break;
      }
      return best;
    }
  };

  const bestBotMove = (board:Board):[Pos,Pos]|null => {
    const moves=allLegalMoves(board,"b");
    if(!moves.length) return null;
    let best=-Infinity; let bestMove=moves[0];
    for(const [from,to] of moves){
      const val=minimax(applyMove(board,from,to),2,-Infinity,Infinity,true);
      const score=-val; // bot is black, minimizing
      if(score>best){best=score;bestMove=[from,to];}
    }
    return bestMove;
  };

  const [board,setBoard]=useState<Board>(initBoard);
  const [selected,setSelected]=useState<Pos|null>(null);
  const [legalMoves,setLegalMoves]=useState<Pos[]>([]);
  const [turn,setTurn]=useState<"w"|"b">("w");
  const [status,setStatus]=useState("Your turn (white)");
  const [thinking,setThinking]=useState(false);
  const [lastMove,setLastMove]=useState<[Pos,Pos]|null>(null);

  const botMove = (b:Board) => {
    setThinking(true);
    setTimeout(()=>{
      const mv=bestBotMove(b);
      if(mv){
        const nb=applyMove(b,mv[0],mv[1]);
        setBoard(nb); setLastMove(mv);
        const wMoves=allLegalMoves(nb,"w");
        if(!wMoves.length){
          setStatus(isInCheck(nb,"w")?"Checkmate! Puei Bot wins 🐛":"Stalemate — draw!");
        } else {
          setStatus(isInCheck(nb,"w")?"⚠️ Check! Get your king to safety.":"Your turn (white)");
        }
      } else {
        setStatus(isInCheck(b,"b")?"Checkmate! You win 🎉":"Stalemate — draw!");
      }
      setTurn("w"); setThinking(false);
    }, 300);
  };

  const handleClick = (r:number,c:number) => {
    if(turn!=="w"||thinking) return;
    const piece=board[r][c];
    if(selected){
      const isLegal=legalMoves.some(([lr,lc])=>lr===r&&lc===c);
      if(isLegal){
        const nb=applyMove(board,selected,[r,c]);
        setBoard(nb); setLastMove([selected,[r,c]]);
        setSelected(null); setLegalMoves([]);
        const bMoves=allLegalMoves(nb,"b");
        if(!bMoves.length){setStatus(isInCheck(nb,"b")?"Checkmate! You win 🎉":"Stalemate — draw!");return;}
        setStatus("Puei Bot is thinking…"); setTurn("b");
        botMove(nb);
      } else if(piece?.color==="w"){
        setSelected([r,c]); setLegalMoves(legalMovesFor(board,r,c));
      } else {
        setSelected(null); setLegalMoves([]);
      }
    } else {
      if(piece?.color==="w"){ setSelected([r,c]); setLegalMoves(legalMovesFor(board,r,c)); }
    }
  };

  const isHighlighted=(r:number,c:number)=>legalMoves.some(([lr,lc])=>lr===r&&lc===c);
  const isSelected=(r:number,c:number)=>selected?.[0]===r&&selected?.[1]===c;
  const isLastMove=(r:number,c:number)=>lastMove&&([lastMove[0],lastMove[1]].some(([lr,lc])=>lr===r&&lc===c));
  const whiteInCheck=turn==="w"&&!thinking&&isInCheck(board,"w");
  const whiteKingPos=findKing(board,"w");

  return (
    <div className="h-full flex flex-col items-center justify-center overflow-auto select-none"
      style={{background:"linear-gradient(135deg,#1a0a00 0%,#2d1a08 100%)"}}>
      {/* Status bar */}
      <div className={`text-sm font-semibold mb-3 px-4 py-1.5 rounded-full ${whiteInCheck?"bg-red-500/80 text-white animate-pulse":"bg-black/30 text-white/80"}`}>
        {thinking ? <span className="opacity-70">♟ Puei Bot is thinking…</span> : status}
      </div>
      {/* Board container */}
      <div className="flex">
        {/* Row labels */}
        <div className="flex flex-col justify-around mr-1">
          {[8,7,6,5,4,3,2,1].map(n=><div key={n} className="h-11 flex items-center text-[10px] text-white/40 font-mono w-3">{n}</div>)}
        </div>
        <div>
          <div className="inline-grid grid-cols-8 rounded-sm overflow-hidden"
            style={{boxShadow:"0 8px 40px rgba(0,0,0,0.8), inset 0 0 0 2px rgba(255,255,255,0.1)"}}>
            {board.map((row,r)=>row.map((piece,c)=>{
              const isLight=(r+c)%2===0;
              const base=isLight?"#e8c99a":"#9c6a38";
              const selBg="#f9f52b";
              const hlLight="#d4e857"; const hlDark="#90a830";
              const lastLight="#f0e44a"; const lastDark="#c8b830";
              const inCheckSq=whiteInCheck&&whiteKingPos&&whiteKingPos[0]===r&&whiteKingPos[1]===c;
              const bg=inCheckSq?"#ff4444":isSelected(r,c)?selBg:isHighlighted(r,c)?(isLight?hlLight:hlDark):isLastMove(r,c)?(isLight?lastLight:lastDark):base;
              const key=piece?`${piece.color}${piece.type}`:"";
              return (
                <div key={`${r}-${c}`} onClick={()=>handleClick(r,c)}
                  className="w-11 h-11 flex items-center justify-center cursor-pointer relative transition-colors"
                  style={{background:bg}}>
                  {piece && (
                    <span className="text-[28px] leading-none"
                      style={{
                        filter:piece.color==="w"?"drop-shadow(0 2px 3px rgba(0,0,0,0.8))":"drop-shadow(0 2px 3px rgba(255,255,255,0.2))",
                        color:piece.color==="w"?"#fff":"#111",
                      }}>
                      {GLYPHS[key]}
                    </span>
                  )}
                  {isHighlighted(r,c)&&!piece&&(
                    <div className="w-4 h-4 rounded-full absolute"
                      style={{background:"rgba(0,0,0,0.3)",boxShadow:"0 0 0 1px rgba(0,0,0,0.1)"}}/>
                  )}
                  {isHighlighted(r,c)&&piece&&(
                    <div className="absolute inset-0 rounded-sm border-4 border-yellow-400/60"/>
                  )}
                </div>
              );
            }))}
          </div>
          {/* Column labels */}
          <div className="flex mt-1">
            {["a","b","c","d","e","f","g","h"].map(l=><div key={l} className="w-11 text-center text-[10px] text-white/40 font-mono">{l}</div>)}
          </div>
        </div>
      </div>
      {/* Controls */}
      <div className="flex gap-3 mt-4 items-center">
        <button className="px-4 py-1.5 rounded-full text-xs text-white font-semibold"
          style={{background:"rgba(255,255,255,0.15)"}}
          onClick={()=>{setBoard(initBoard());setSelected(null);setLegalMoves([]);setTurn("w");setStatus("Your turn (white)");setLastMove(null);}}>
          🔄 New Game
        </button>
        <div className="text-[10px] text-white/30">You = White · Bot = Black</div>
      </div>
    </div>
  );
}
