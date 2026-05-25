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
  onCreateShortcut: (label: string, fileId: string) => void;
  installWebApp: (label: string, url: string, iconUrl?: string) => void;
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
    case "pueinet": return <PueiWebApp currentUser={p.currentUser} users={p.users} />;
    case "puei-messenger": return <MessengerApp user={p.currentUser} users={p.users} setUsers={p.setUsers} />;
    case "file-explorer": return <FileExplorerApp openApp={p.openApp} icons={p.icons} openFolder={p.openFolder} currentUser={p.currentUser} />;
    case "app-store": return <AppStoreApp installWebApp={p.installWebApp} openApp={p.openApp} systemVersion={p.systemVersion} />;
    case "puei-social": return <PueiSocialApp user={p.currentUser} users={p.users} />;
    case "folder": return <FolderApp folderIconId={p.folderIconId!} icons={p.icons} openApp={p.openApp} openWebApp={p.openWebApp} />;
    case "web-app": return <WebAppFrame url={p.webUrl!} />;
    case "recycle-bin": return <RecycleBinApp />;
    case "solitaire": return <SolitaireApp />;
    case "chess": return <ChessApp />;
  }
}


function SettingsApp({ theme, setTheme, wallpaper, setWallpaper, openApp, currentUser, users, setUsers, systemVersion, startUpgrade, uninstallApp, icons, signOut, lockScreen, deleteAccount }: any) {
  const [tab, setTab] = useState("personalize");
  const [paintImages, setPaintImages] = useState<SavedFile[]>(() => loadFiles().filter((f) => f.type === "image" && (!f.owner || f.owner === currentUser)));
  useEffect(() => {
    const fn = () => setPaintImages(loadFiles().filter((f) => f.type === "image" && (!f.owner || f.owner === currentUser)));
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

  const tabs = [
    ["personalize", "🎨 Personalize"],
    ["wallpaper", "🖼️ Wallpaper"],
    ["account", "👤 Account"],
    ["pueio-control", "🔐 Pueio Control"],
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
                <input type="checkbox" checked={theme.dark} onChange={(e) => setTheme({ ...theme, dark: e.target.checked })} /> Dark mode <span className="text-xs opacity-60">(global — applies to every system surface)</span>
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
            <p className="text-sm opacity-80">Reduce motion via the Animations toggle on Personalize. For maximum readability, enable <b>High Contrast Mode</b> in the next tab.</p></div>
        )}
        {tab === "highcontrast" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">⚡ High Contrast Mode</h2>
            <p className="text-sm opacity-80 mb-3">Customizable accessibility system. Select a base color — PueiOS 2 generates a full high-contrast theme around it and applies it globally to every system surface and app. No mixed states allowed.</p>
            <label className="flex items-center gap-3 aero-glass-light rounded p-3 max-w-lg mb-5">
              <input type="checkbox" checked={!!theme.highContrast}
                onChange={(e) => setTheme({ ...theme, highContrast: e.target.checked, transparency: e.target.checked ? false : theme.transparency, animations: e.target.checked ? false : theme.animations })} />
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
                <span>✦</span>
                <span>Preview: High Contrast UI with selected color · Applied globally across all apps</span>
              </div>
            </div>
          </div>
        )}
        {tab === "about" && (
          <div><button className="aero-button rounded-md px-4 py-2" onClick={() => openApp("about")}>Open About PueiOS 2 →</button></div>
        )}
        {tab === "pueio-control" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-xl font-semibold">🔐 Pueio Control</h2>

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
                    {me.limitedMode ? "⚠️ Limited Access Mode" : "✅ Full Access"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono opacity-80 bg-black/10 rounded px-1.5 py-0.5">
                      {me.pueiNumber || "—"}
                    </code>
                    <button className="text-[10px] opacity-60 hover:opacity-100 underline" onClick={() => {
                      if (me.pueiNumber) {
                        navigator.clipboard.writeText(me.pueiNumber).catch(() => {});
                        blip("notify");
                      }
                    }}>Copy</button>
                  </div>
                </div>
              </div>

              {/* Password section */}
              <div className="aero-glass-light rounded-xl p-4 space-y-3">
                {(!me.password || me.noPassword) ? (
                  <>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      🔓 No password set
                      {me.limitedMode && <span className="text-[10px] bg-yellow-500/20 rounded px-1.5 py-0.5 text-yellow-700 dark:text-yellow-300">Limited Access</span>}
                    </div>
                    <div className="text-xs opacity-70">Create a password to enable full access and protect your account.</div>
                    <div>
                      <label className="text-xs opacity-70">New password</label>
                      <input type="password" value={pcNewPw} onChange={(e) => setPcNewPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">Confirm password</label>
                      <input type="password" value={pcConfirm} onChange={(e) => setPcConfirm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") {
                          if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a password." }); return; }
                          if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                          updateMe({ password: pcNewPw, noPassword: false, limitedMode: false });
                          setPcNewPw(""); setPcConfirm("");
                          setPcMsg({ kind: "ok", text: "✓ Password created! Full access enabled." });
                          blip("notify");
                        }}}
                        className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
                    </div>
                    {pcMsg && (
                      <div className={`text-xs rounded px-2 py-1.5 ${pcMsg.kind === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{pcMsg.text}</div>
                    )}
                    <button className="aero-button rounded-lg px-4 py-2 text-sm w-full" onClick={() => {
                      if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a password." }); return; }
                      if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                      updateMe({ password: pcNewPw, noPassword: false, limitedMode: false });
                      setPcNewPw(""); setPcConfirm("");
                      setPcMsg({ kind: "ok", text: "✓ Password created! Full access enabled." });
                      blip("notify");
                    }}>Create password</button>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-sm">🔒 Change password</div>
                    <div>
                      <label className="text-xs opacity-70">Current password</label>
                      <input type="password" value={pcCurPw} onChange={(e) => setPcCurPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">New password</label>
                      <input type="password" value={pcNewPw} onChange={(e) => setPcNewPw(e.target.value)}
                        className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
                    </div>
                    <div>
                      <label className="text-xs opacity-70">Confirm new password</label>
                      <input type="password" value={pcConfirm} onChange={(e) => setPcConfirm(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") {
                          if (pcCurPw !== me.password) { setPcMsg({ kind: "err", text: "Current password is incorrect." }); return; }
                          if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a new password." }); return; }
                          if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                          updateMe({ password: pcNewPw });
                          setPcCurPw(""); setPcNewPw(""); setPcConfirm("");
                          setPcMsg({ kind: "ok", text: "✓ Password changed." });
                          blip("notify");
                        }}}
                        className="w-full px-3 py-2 rounded text-sm outline-none mt-1" style={{ background: "white", color: "#111" }} />
                    </div>
                    {pcMsg && (
                      <div className={`text-xs rounded px-2 py-1.5 ${pcMsg.kind === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{pcMsg.text}</div>
                    )}
                    <button className="aero-button rounded-lg px-4 py-2 text-sm w-full" onClick={() => {
                      if (pcCurPw !== me.password) { setPcMsg({ kind: "err", text: "Current password is incorrect." }); return; }
                      if (!pcNewPw) { setPcMsg({ kind: "err", text: "Enter a new password." }); return; }
                      if (pcNewPw !== pcConfirm) { setPcMsg({ kind: "err", text: "Passwords do not match." }); return; }
                      updateMe({ password: pcNewPw });
                      setPcCurPw(""); setPcNewPw(""); setPcConfirm("");
                      setPcMsg({ kind: "ok", text: "✓ Password changed." });
                      blip("notify");
                    }}>Change password</button>
                    <button className="text-xs opacity-60 underline hover:opacity-100" onClick={() => {
                      if (confirm("Remove your password? This switches you to Limited Access mode.")) {
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
                  🗑️ Delete this account
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
      <h1 className="text-3xl font-bold" style={{ color: "var(--accent)" }}>PueiOS 2</h1>
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
  const save = () => {
    const id = savedId || `f-${Date.now().toString(36)}`;
    upsertFile({ id, name, type: "text", content: text, updatedAt: Date.now(), owner: currentUser });
    setSavedId(id); setStatus("Saved ✓"); blip("notify");
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

function PaintApp({ fileId, onCreateShortcut, currentUser }: { fileId?: string; onCreateShortcut: (l: string, id: string) => void; currentUser: string }) {
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
    upsertFile({ id, name, type: "image", content: data, updatedAt: Date.now(), owner: currentUser });
    setSavedId(id); setStatus("Saved ✓"); blip("notify");
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

// ---------- Puei Copilot (integrated into PueiSearch) ----------
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
      const sources = [
        { source: "Google", title: `${q} — Overview`, summary: `Google: "${q}" is documented across multiple verified sources. Top results include reference articles, encyclopedias, and news from the past 30 days.` },
        { source: "Edge", title: `${q} — Microsoft results`, summary: `Edge: Found ${Math.floor(Math.random() * 90000) + 10000} results for "${q}". Bing Search confirms multiple authoritative pages with consistent information.` },
        { source: "Firefox", title: `${q} — Community sources`, summary: `Firefox: Community-curated results for "${q}" from open encyclopedias, forums, and educational sites. 3 blocked sources filtered automatically.` },
        { source: "Opera", title: `${q} — Global search`, summary: `Opera: "${q}" surfaced in international news and reference databases. Cross-referenced with Google and Edge for consistency.` },
      ];
      setResults(sources);
      setAnswer(
        `Puei Copilot gathered results for "${q}" from Google, Edge, Firefox, and Opera.\n\n` +
        `All four supported search sources agree this topic has reliable, consistent information available across verified domains. ` +
        `Untrusted sources and blocked domains have been automatically filtered by Pueios2 security policies.\n\n` +
        `• Google — ${Math.floor(Math.random() * 900000) + 100000} results · top sources verified\n` +
        `• Edge — Bing index cross-referenced · authoritative pages found\n` +
        `• Firefox — Community sources curated · ${Math.floor(Math.random() * 5) + 1} blocked sources filtered\n` +
        `• Opera — International databases checked · consistent results confirmed\n\n` +
        `Summary: "${q}" is a well-documented topic. See source details below for more information.`
      );
      setThinking(false);
    }, 1400 + Math.random() * 800);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto h-full overflow-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">✦</div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--accent)" }}>Puei Copilot</h1>
          <p className="text-[11px] opacity-60">AI assistant · gathers from Google · Edge · Firefox · Opera · filters untrusted sources automatically</p>
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
          className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
          style={{ background: "white", color: "#111", border: "2px solid oklch(0.65 0.18 var(--accent-h))" }}
          placeholder="Ask Puei Copilot or search anything…" />
        <button className="aero-button rounded-full px-5 py-2 text-sm font-semibold" onClick={() => doSearch(query)}>Search</button>
      </div>
      {thinking && (
        <div className="aero-glass-light rounded-xl p-4 mb-4 text-sm flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60 flex-shrink-0" />
          Puei Copilot is gathering and summarizing information from Google, Edge, Firefox, and Opera…
        </div>
      )}
      {answer && (
        <div className="aero-glass-light rounded-xl p-4 mb-4 border" style={{ borderColor: "oklch(0.65 0.18 var(--accent-h) / 0.3)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "var(--gradient-aero)", color: "white" }}>✦</div>
            <div className="font-semibold text-sm">Puei Copilot Summary</div>
          </div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">{answer}</div>
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
              "Tell me about Puei Messenger", "What apps are in the App Store?",
            ].map((q) => (
              <button key={q} className="aero-glass-light rounded-lg p-3 text-xs text-left hover:bg-white/30"
                onClick={() => { setQuery(q); doSearch(q); }}>
                <span className="opacity-50">💡</span> {q}
              </button>
            ))}
          </div>
          <div className="text-[10px] opacity-40 mt-4 flex items-center gap-1">
            ✦ Puei Copilot supports: Google · Edge · Firefox · Opera
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- PueiWeb ----------
function PueiWebApp({ currentUser, users }: { currentUser: string; users: User[] }) {
  const [urlBar, setUrlBar] = useState("puei://home");
  const [navUrl, setNavUrl] = useState("puei://home");
  const [tabs, setTabs] = useState([{ id: 1, title: "Home", url: "puei://home" }]);
  const [active, setActive] = useState(1);

  const navigate = (target: string) => {
    let u = target.trim();
    if (!u.startsWith("puei://") && !/^https?:\/\//i.test(u)) u = "https://" + u;
    setNavUrl(u); setUrlBar(u);
    setTabs((t) => t.map((tab) => tab.id === active ? { ...tab, url: u, title: u.replace("puei://", "").replace(/^\w/, (c) => c.toUpperCase()) || "Page" } : tab));
  };

  const fakeSites: Record<string, React.ReactNode> = {
    "puei://home": (
      <div className="p-8 text-center">
        <h1 className="text-5xl font-bold" style={{ color: "var(--accent)" }}>PueiNet</h1>
        <p className="opacity-70 mt-2">The retro-futuristic web, circa 2020.</p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            ["puei://news", "📰 PueiNews"],
            ["puei://search", "✦ Puei Copilot"],
            ["puei://forum", "💬 PueiForum"],
            ["puei://games", "🎮 PueiGames"],
            ["puei://mail", "✉️ PueiMail"],
            ["puei://about", "ℹ️ About"],
          ].map(([u, l]) => (
            <button key={u} onClick={() => navigate(u)} className="aero-button rounded-lg p-4">{l}</button>
          ))}
        </div>
      </div>
    ),
    "puei://news": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiNews</h2><ul className="text-sm space-y-2"><li>• PueiOS 2 Ultimate Edition lands on glassy desktops everywhere</li><li>• Mascot Puei voted "Most Confusing Helper of 2020"</li><li>• Glass blur now uses 40% less RAM</li><li>• Puei Copilot now integrates with Google, Edge, Firefox and Opera</li></ul></div>,
    "puei://forum": <div className="p-6"><h2 className="text-2xl font-bold mb-3">PueiForum</h2><p className="text-sm opacity-70">[user1138]: did anyone else's mascot start blinking morse code??</p></div>,
    "puei://games": <div className="p-6"><h2 className="text-2xl font-bold">PueiGames</h2><p className="opacity-70 mt-2">Free Pueilike clones for your enjoyment.</p></div>,
    "puei://mail": null, // handled below as PueiMailApp
    "puei://about": <div className="p-6"><h2 className="text-2xl font-bold">About PueiNet</h2><p className="text-sm opacity-70 mt-2">A browser for an alternate 2020. Only https://&lt;app&gt;.base44.app external URLs are trusted.</p></div>,
  };

  let content: React.ReactNode;
  if (navUrl === "puei://search") {
    content = <PueiCopilotPage />;
  } else if (navUrl === "puei://mail") {
    content = null; // rendered below as PueiMailApp
  } else if (navUrl.startsWith("puei://")) {
    content = fakeSites[navUrl] || <div className="p-6">404 — page not found in this universe.</div>;
  } else {
    // Allow all https:// URLs
    let loadUrl = navUrl.trim();
    if (!/^https?:\/\//i.test(loadUrl)) loadUrl = "https://" + loadUrl;
    content = (
      <div className="flex flex-col h-full relative" style={{ background: "white" }}>
        <iframe src={loadUrl} title={loadUrl} className="w-full flex-1 border-0" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="aero-titlebar flex items-center gap-1 px-2 pt-1">
        {tabs.map((t) => (
          <div key={t.id} onClick={() => { setActive(t.id); setNavUrl(t.url); setUrlBar(t.url); }}
            className="px-3 py-1 rounded-t-md text-xs cursor-pointer"
            style={{
              background: active === t.id ? "var(--glass-strong)" : "var(--glass)",
              border: "1px solid var(--border)", borderBottom: "none",
            }}>
            {t.title} <span onClick={(e) => { e.stopPropagation(); setTabs(tabs.filter(x => x.id !== t.id)); }} className="ml-2 opacity-60 hover:opacity-100">×</span>
          </div>
        ))}
        <button className="aero-button rounded px-2 py-0.5 text-xs ml-1"
          onClick={() => { const id = Date.now(); setTabs([...tabs, { id, title: "New Tab", url: "puei://home" }]); setActive(id); navigate("puei://home"); }}>+</button>
      </div>
      <div className="aero-titlebar flex items-center gap-2 px-2 py-1">
        <button className="aero-button rounded px-2 py-0.5 text-xs" onClick={() => navigate("puei://home")}>⌂</button>
        <button className="aero-button rounded px-2 py-0.5 text-xs" onClick={() => navigate("puei://search")}>✦</button>
        <input value={urlBar} onChange={(e) => setUrlBar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") navigate(urlBar); }}
          className="flex-1 rounded-full px-3 py-1 text-xs outline-none"
          style={{ background: "white", border: "1px solid var(--accent)", boxShadow: "0 0 6px oklch(var(--accent) / 0.5)" }} />

      </div>
      <div className="flex-1 overflow-auto">
        {navUrl === "puei://mail"
          ? <PueiMailApp currentUser={currentUser} users={users} />
          : content}
      </div>
    </div>
  );
}

// ---------- PueiMail ----------
const SYSTEM_FOLDERS: { id: MailFolderId; label: string; icon: string }[] = [
  { id: "inbox", label: "Inbox", icon: "📥" },
  { id: "important", label: "Important", icon: "⭐" },
  { id: "drafts", label: "Drafts", icon: "📝" },
  { id: "sent", label: "Sent", icon: "📤" },
  { id: "spam", label: "Spam", icon: "🚫" },
  { id: "trash", label: "Trash", icon: "🗑️" },
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

function downloadAttachment(att: MailAttachment) {
  const a = document.createElement("a");
  a.href = att.dataUrl; a.download = att.name;
  document.body.appendChild(a); a.click(); a.remove();
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

  // Cloud sync: pull full mailbox snapshot for this user (cross-device sync)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mail?owner=${encodeURIComponent(currentUser)}&mode=full`);
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
        body: JSON.stringify({ owner: currentUser, mailbox: loadMail(currentUser) }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [msgs, currentUser]);

  // Poll inbox for new mail every 4s
  useEffect(() => {
    let cancelled = false;
    const seen = new Set<string>(loadMail(currentUser).map((m) => m.id));
    const poll = async () => {
      try {
        const res = await fetch(`/api/mail?owner=${encodeURIComponent(currentUser)}`);
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
  };

  const doSend = () => {
    const resolved = resolveMailRecipient(draft.to, users);
    if (!resolved) { setSendStatus("Enter a valid username, Pueio number, or @pueimail.puei address."); return; }
    if (!draft.subject.trim()) { setSendStatus("Enter a subject."); return; }
    sendMail(currentUser, resolved, draft.subject.trim(), draft.body, users, pending);
    // Deliver to server inbox
    fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: currentUser, to: resolved, subject: draft.subject.trim(), body: draft.body, attachments: pending }),
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
          onClick={() => openCompose()}>✏️ Compose</button>
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
            className="w-full px-2 py-1 text-xs rounded outline-none"
            style={{ background: "white", color: "#111", border: "1px solid var(--border)" }} />
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
                onClick={() => { downloadAttachment(a); recordDownload(currentUser, { id: `dl-${Date.now()}`, name: a.name, kind: a.kind, size: a.size, at: Date.now(), mailId: a.mailId }); }}>
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
                placeholder="username, 123-456-789, or name@pueimail.puei"
                className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                style={{ background: "white", color: "#111", border: "1px solid var(--border)" }}
                list="mail-contacts" />
              <datalist id="mail-contacts">
                {users.filter((u) => u.name !== currentUser).map((u) => (
                  <option key={u.name} value={mailAddressFor(u.name)} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs w-20 opacity-60">Subject:</span>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Subject"
                className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                style={{ background: "white", color: "#111", border: "1px solid var(--border)" }} />
            </div>
            <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Write your message…"
              className="flex-1 px-3 py-2 rounded text-sm outline-none resize-none min-h-[160px]"
              style={{ background: "white", color: "#111", border: "1px solid var(--border)" }} />

            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pending.map((a) => (
                  <div key={a.id} className="aero-glass-light rounded px-2 py-1 text-xs flex items-center gap-2">
                    <span>{a.kind === "image" ? "🖼️" : a.kind === "video" ? "🎬" : "📎"} {a.name}</span>
                    <button className="opacity-60 hover:opacity-100" onClick={() => setPending(pending.filter((x) => x.id !== a.id))}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] opacity-60">
              <strong>✦ AI suggestions:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {aiMailSuggestions({ subject: draft.subject, body: draft.body }).map((s, i) => (
                  <button key={i} onClick={() => setDraft({ ...draft, body: (draft.body ? draft.body + "\n\n" : "") + s })}
                    className="aero-button rounded px-2 py-0.5 text-[10px]">{s.slice(0, 40)}{s.length > 40 ? "…" : ""}</button>
                ))}
              </div>
            </div>

            {sendStatus && <div className="text-red-400 text-xs">{sendStatus}</div>}
            <div className="flex gap-2 flex-wrap">
              <button className="aero-button rounded-lg px-5 py-2 text-sm font-semibold" onClick={doSend}>📨 Send</button>
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
                  {selected.important ? "☆ Unstar" : "⭐ Important"}
                </button>
                <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => moveToFolder(selected.id, selected.folder === "spam" ? "inbox" : "spam")}>
                  {selected.folder === "spam" ? "✓ Not spam" : "🚫 Spam"}
                </button>
                {selected.folder === "trash" ? (
                  <>
                    <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => moveToFolder(selected.id, "inbox")}>♻️ Restore</button>
                    <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => deleteMsg(selected.id, true)}>🗑️ Delete forever</button>
                  </>
                ) : (
                  <button className="aero-button rounded px-2 py-1 text-xs" onClick={() => deleteMsg(selected.id)}>🗑️ Trash</button>
                )}
                {customFolders.length > 0 && (
                  <select className="text-xs rounded px-1 py-0.5" style={{ background: "white", color: "#111" }}
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
                    <button className="aero-button rounded px-2 py-1 text-xs"
                      onClick={() => { downloadAttachment(a); recordDownload(currentUser, { id: `dl-${Date.now()}`, name: a.name, kind: a.kind, size: a.size, at: Date.now(), mailId: selected.id }); }}>
                      ⬇️ Download
                    </button>
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


function MessengerApp({ user, users, setUsers }: { user: string; users: User[]; setUsers: (u: User[]) => void }) {
  const localContacts = users.filter((u) => u.name !== user);
  const me = users.find((u) => u.name === user);
  const myPueiNumber = me?.pueiNumber || pueiNumberFor(user + ":seed");

  // External contacts stored in localStorage (cross-device, identified by Puei Number only)
  const [externalContacts, setExternalContacts] = useState<{ pueiNumber: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("pueios-xcontacts") || "[]"); } catch { return []; }
  });

  const saveExternalContacts = (list: { pueiNumber: string }[]) => {
    setExternalContacts(list);
    localStorage.setItem("pueios-xcontacts", JSON.stringify(list));
  };

  // Blocked contacts — per-user, identified by Puei Number (works for both local & external)
  const BLOCK_KEY = `pueios-blocked-${user}`;
  const [blockedNumbers, setBlockedNumbers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(BLOCK_KEY) || "[]"); } catch { return []; }
  });
  const saveBlocked = (list: string[]) => {
    setBlockedNumbers(list);
    localStorage.setItem(BLOCK_KEY, JSON.stringify(list));
  };
  const numberOfLocal = (name: string) => {
    const u = users.find((x) => x.name === name);
    return u?.pueiNumber || pueiNumberFor(name + ":seed");
  };
  const isBlockedNumber = (num: string) => blockedNumbers.includes(num);
  const isBlockedLocal = (name: string) => isBlockedNumber(numberOfLocal(name));
  // Hidden contacts (deleted local conversations) — keep account intact but hide from sidebar until they message again
  const HIDDEN_KEY = `pueios-hidden-${user}`;
  const [hiddenLocals, setHiddenLocals] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"); } catch { return []; }
  });
  const saveHiddenLocals = (list: string[]) => {
    setHiddenLocals(list);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
  };

  const [activeId, setActiveId] = useState<string | null>(
    localContacts[0]?.name ?? externalContacts[0]?.pueiNumber ?? null
  );
  const [activeKind, setActiveKind] = useState<"local" | "external">(
    localContacts.length > 0 ? "local" : "external"
  );

  const [allMsgs, setAllMsgs] = useState<ChatMessage[]>(() => loadChat());
  // API messages keyed by the OTHER party's Puei Number
  const [apiMsgs, setApiMsgs] = useState<Record<string, Array<{ id: string; from: string; fromNumber: string; text: string; at: number }>>>({});
  const [text, setText] = useState("");
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [addingContact, setAddingContact] = useState(false);
  const [contactInput, setContactInput] = useState("");
  const [contactMsg, setContactMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
  useEffect(() => {
    if (me && !me.pueiNumber) {
      setUsers(users.map((u) => u.name === user ? { ...u, pueiNumber: pueiNumberFor(user + ":" + Date.now()) } : u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll /api/chat every 3 seconds for cross-device incoming messages
  useEffect(() => {
    if (!myPueiNumber || myPueiNumber === "—") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat?pueiNumber=${encodeURIComponent(myPueiNumber)}`);
        if (!res.ok || cancelled) return;
        const msgs = (await res.json()) as Array<{ id: string; from: string; fromNumber: string; text: string; at: number }>;
        if (cancelled) return;
        // Group by sender Puei Number, dropping messages from blocked numbers
        const grouped: Record<string, typeof msgs> = {};
        const senderNumbers = new Set<string>();
        for (const m of msgs) {
          if (blockedNumbers.includes(m.fromNumber)) continue;
          if (m.fromNumber === myPueiNumber) continue; // my own outgoing copies
          if (!grouped[m.fromNumber]) grouped[m.fromNumber] = [];
          grouped[m.fromNumber].push(m);
          senderNumbers.add(m.fromNumber);
        }
        setApiMsgs(grouped);
        // Auto-add any incoming sender as an external contact so they appear in the sidebar
        if (senderNumbers.size > 0) {
          const knownLocalNumbers = new Set(users.map((u) => u.pueiNumber || pueiNumberFor(u.name + ":seed")));
          const currentExternal = (() => {
            try { return JSON.parse(localStorage.getItem("pueios-xcontacts") || "[]") as { pueiNumber: string }[]; }
            catch { return []; }
          })();
          const existing = new Set(currentExternal.map((c) => c.pueiNumber));
          const toAdd: { pueiNumber: string }[] = [];
          for (const num of senderNumbers) {
            if (knownLocalNumbers.has(num)) continue; // already a local user
            if (existing.has(num)) continue;
            toAdd.push({ pueiNumber: num });
          }
          if (toAdd.length > 0) {
            const next = [...currentExternal, ...toAdd];
            localStorage.setItem("pueios-xcontacts", JSON.stringify(next));
            setExternalContacts(next);
            blip("notify");
          }
        }
      } catch {
        // API not available — silent fail (local dev without backend)
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [myPueiNumber, blockedNumbers, users]);

  const doAddContact = () => {
    const num = contactInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(num)) {
      setContactMsg({ text: "Invalid format. Use XXX-XXX-XXX.", ok: false });
      blip("error"); return;
    }
    if (num === myPueiNumber) {
      setContactMsg({ text: "That's your own Puei Number.", ok: false });
      blip("error"); return;
    }
    // Check if it's a local user
    const localUser = users.find((u) => u.name !== user && (u.pueiNumber || pueiNumberFor(u.name + ":seed")) === num);
    if (localUser) {
      setActiveId(localUser.name); setActiveKind("local");
      setContactMsg({ text: `Found on this device: ${localUser.name}`, ok: true });
      setAddingContact(false); setContactInput(""); blip("click"); return;
    }
    // Check already in external contacts
    if (externalContacts.find((c) => c.pueiNumber === num)) {
      setActiveId(num); setActiveKind("external");
      setContactMsg({ text: "Already in your contacts.", ok: true });
      setAddingContact(false); setContactInput(""); blip("click"); return;
    }
    // Add as external contact
    saveExternalContacts([...externalContacts, { pueiNumber: num }]);
    setActiveId(num); setActiveKind("external");
    setContactMsg({ text: `Added! Start chatting with ${num}.`, ok: true });
    setAddingContact(false); setContactInput(""); blip("click");
  };

  const SettingsView = () => {
    const [copied, setCopied] = useState(false);
    return (
      <div className="flex-1 p-6 overflow-auto">
        <h2 className="text-xl font-semibold mb-2">Messenger Settings</h2>
        <p className="text-sm opacity-70 mb-5">Share your Puei Number with friends — they can add you on any device running PueiOS.</p>
        <div className="aero-glass-light rounded-xl p-4 max-w-md">
          <div className="text-xs opacity-60">Signed in as</div>
          <div className="text-base font-semibold mb-3">{user}</div>
          <div className="text-xs opacity-60">Your PueiNumber</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="font-mono text-2xl tracking-wider px-3 py-2 rounded"
              style={{ background: "white", color: "#111", border: "1px solid var(--border)" }}>
              {myPueiNumber}
            </div>
            <button className="aero-button rounded px-3 py-2 text-xs"
              onClick={() => { navigator.clipboard?.writeText(myPueiNumber); setCopied(true); setTimeout(() => setCopied(false), 1200); blip("click"); }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="text-[10px] opacity-50 mt-2">Anyone with this number can message you from iPad, Android, Windows, Mac, or any PueiOS device.</div>
        </div>
        <div className="mt-5 max-w-md">
          <div className="text-xs opacity-60 mb-2">Cross-device contacts</div>
          {externalContacts.length === 0 && <div className="text-xs opacity-60">None yet. Use "+ Add Contact" and enter a Puei Number.</div>}
          {externalContacts.map((c) => (
            <div key={c.pueiNumber} className="flex items-center justify-between aero-glass-light rounded p-2 mb-1 text-sm">
              <span className="font-mono">🌐 {c.pueiNumber}</span>
              <button className="text-[10px] text-red-500 hover:opacity-80"
                onClick={() => saveExternalContacts(externalContacts.filter((x) => x.pueiNumber !== c.pueiNumber))}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 max-w-md">
          <div className="text-xs opacity-60 mb-2">Accounts on this device</div>
          {localContacts.length === 0 && <div className="text-xs opacity-60">No other accounts on this device.</div>}
          {localContacts.map((c) => (
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
        <div className="mt-5 max-w-md">
          <div className="text-xs opacity-60 mb-2">Blocked numbers</div>
          {blockedNumbers.length === 0 && <div className="text-xs opacity-60">No blocked contacts.</div>}
          {blockedNumbers.map((n) => (
            <div key={n} className="flex items-center justify-between aero-glass-light rounded p-2 mb-1 text-sm">
              <span className="font-mono">🚫 {n}</span>
              <button className="text-[10px] hover:opacity-80"
                onClick={() => unblock(n)}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasAnyContacts = localContacts.length > 0 || externalContacts.length > 0;

  if (!hasAnyContacts && view === "chat") {
    return (
      <div className="flex h-full">
        <div className="w-44 border-r p-2" style={{ background: "var(--glass)" }}>
          <button className="aero-button rounded w-full text-xs py-1.5 mb-1" onClick={() => setView("chat")}>💬 Chats</button>
          <button className="aero-button rounded w-full text-xs py-1.5" onClick={() => setView("settings")}>⚙️ Settings</button>
        </div>
        <div className="flex-1 p-6 text-sm text-center opacity-80 flex flex-col items-center justify-center">
          <div className="text-4xl mb-2">💬</div>
          <div className="font-semibold mb-1">No contacts yet</div>
          <div className="max-w-xs">Click <strong>+ Add Contact</strong> in the sidebar and enter a friend's Puei Number. Works across iPad, Android, Windows, Mac — any device running PueiOS.</div>
        </div>
      </div>
    );
  }

  const localPartner = activeKind === "local" ? localContacts.find((c) => c.name === activeId) : undefined;
  const externalPartner = activeKind === "external" ? externalContacts.find((c) => c.pueiNumber === activeId) : undefined;

  const localConversation = localPartner
    ? allMsgs.filter((m) => (m.from === user && m.to === localPartner.name) || (m.from === localPartner.name && m.to === user))
    : [];

  const externalConversation = externalPartner ? (apiMsgs[externalPartner.pueiNumber] ?? []) : [];

  const sendLocal = () => {
    if (!text.trim() || !localPartner) return;
    blip("click");
    appendChat({ id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, from: user, to: localPartner.name, text, at: Date.now() });
    setAllMsgs(loadChat());
    // Also relay via API for cross-device visibility
    const partnerNumber = localPartner.pueiNumber || pueiNumberFor(localPartner.name + ":seed");
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: user, fromNumber: myPueiNumber, toNumber: partnerNumber, text }),
    }).catch(() => {});
    setText("");
  };

  const sendExternal = async () => {
    if (!text.trim() || !externalPartner) return;
    blip("click");
    const sentText = text;
    setText("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: user, fromNumber: myPueiNumber, toNumber: externalPartner.pueiNumber, text: sentText }),
      });
      if (!res.ok) throw new Error("send failed");
      setApiMsgs((prev) => {
        const key = externalPartner.pueiNumber;
        const outMsg = { id: `out-${Date.now()}`, from: user, fromNumber: myPueiNumber, text: sentText, at: Date.now() };
        return { ...prev, [key]: [...(prev[key] ?? []), outMsg] };
      });
    } catch {
      blip("error");
    }
  };

  const send = () => { if (activeKind === "local") sendLocal(); else sendExternal(); };

  // Contact actions
  const deleteLocalChat = (name: string) => {
    if (!confirm(`Delete the entire conversation with ${name}? This only removes it from your side.`)) return;
    blip("click");
    deleteChatBetween(user, name);
    setAllMsgs(loadChat());
    saveHiddenLocals(Array.from(new Set([...hiddenLocals, name])));
    if (activeKind === "local" && activeId === name) setActiveId(null);
  };
  const blockLocal = (name: string) => {
    if (!confirm(`Block ${name}? You won't receive messages from them on any device.`)) return;
    blip("click");
    const num = numberOfLocal(name);
    deleteChatBetween(user, name);
    setAllMsgs(loadChat());
    saveHiddenLocals(Array.from(new Set([...hiddenLocals, name])));
    saveBlocked(Array.from(new Set([...blockedNumbers, num])));
    if (activeKind === "local" && activeId === name) setActiveId(null);
  };
  const deleteExternalContact = (num: string) => {
    if (!confirm(`Remove ${num} from your contacts and delete the conversation?`)) return;
    blip("click");
    saveExternalContacts(externalContacts.filter((c) => c.pueiNumber !== num));
    setApiMsgs((prev) => { const n = { ...prev }; delete n[num]; return n; });
    if (activeKind === "external" && activeId === num) setActiveId(null);
  };
  const blockExternal = (num: string) => {
    if (!confirm(`Block ${num}? They won't be able to message you anymore.`)) return;
    blip("click");
    saveBlocked(Array.from(new Set([...blockedNumbers, num])));
    saveExternalContacts(externalContacts.filter((c) => c.pueiNumber !== num));
    setApiMsgs((prev) => { const n = { ...prev }; delete n[num]; return n; });
    if (activeKind === "external" && activeId === num) setActiveId(null);
  };
  const unblock = (num: string) => {
    blip("click");
    saveBlocked(blockedNumbers.filter((n) => n !== num));
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
        <div className="px-3 pb-1 text-[10px] opacity-60 font-mono">#{myPueiNumber}</div>
        <div className="px-2 pb-2">
          <button className="aero-button rounded w-full text-xs py-1"
            onClick={() => { setAddingContact(!addingContact); setContactInput(""); setContactMsg(null); blip("click"); }}>
            {addingContact ? "✕ Cancel" : "+ Add Contact"}
          </button>
          {addingContact && (
            <div className="mt-1 p-2 rounded aero-glass-light flex flex-col gap-1">
              <div className="text-[10px] opacity-70 mb-0.5">Enter their Puei Number</div>
              <input
                autoFocus
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value.toUpperCase())}
                placeholder="XXX-XXX-XXX"
                maxLength={11}
                className="w-full px-2 py-1 rounded text-xs font-mono outline-none"
                style={{ background: "white", border: "1px solid var(--border)", color: "#111" }}
                onKeyDown={(e) => e.key === "Enter" && doAddContact()}
              />
              <button className="aero-button rounded text-xs py-0.5" onClick={doAddContact}>Add Contact</button>
              {contactMsg && <div className={`text-[10px] mt-0.5 ${contactMsg.ok ? "text-green-600" : "text-red-500"}`}>{contactMsg.text}</div>}
            </div>
          )}
        </div>
        {view === "chat" && (
          <>
            {(() => {
              const visibleLocals = localContacts.filter((c) => {
                if (isBlockedLocal(c.name)) return false;
                if (!hiddenLocals.includes(c.name)) return true;
                // Show again if they messaged after being hidden (any message from them)
                return allMsgs.some((m) => m.from === c.name && m.to === user);
              });
              const visibleExternals = externalContacts.filter((c) => !isBlockedNumber(c.pueiNumber));
              return (
                <>
                  {visibleLocals.length > 0 && <div className="px-3 pb-1 text-[10px] opacity-40 uppercase tracking-wide">This device</div>}
                  {visibleLocals.map((c) => {
              const last = [...allMsgs].reverse().find((m) => (m.from === user && m.to === c.name) || (m.from === c.name && m.to === user));
              const isActive = activeKind === "local" && activeId === c.name;
              return (
                <div key={c.name} onClick={() => { setActiveId(c.name); setActiveKind("local"); setView("chat"); }}
                  className="px-3 py-2 cursor-pointer text-sm flex items-center gap-2"
                  style={{ background: isActive ? "var(--gradient-aero)" : "transparent", color: isActive ? "white" : undefined }}>
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
                  {visibleExternals.length > 0 && <div className="px-3 pb-1 pt-1 text-[10px] opacity-40 uppercase tracking-wide">Cross-device</div>}
                  {visibleExternals.map((c) => {
              const msgs = apiMsgs[c.pueiNumber] ?? [];
              const last = msgs[msgs.length - 1];
              const isActive = activeKind === "external" && activeId === c.pueiNumber;
              return (
                <div key={c.pueiNumber} onClick={() => { setActiveId(c.pueiNumber); setActiveKind("external"); setView("chat"); }}
                  className="px-3 py-2 cursor-pointer text-sm flex items-center gap-2"
                  style={{ background: isActive ? "var(--gradient-aero)" : "transparent", color: isActive ? "white" : undefined }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center aero-glass-light text-base">🌐</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-mono text-xs">{c.pueiNumber}</div>
                    <div className="text-xs opacity-70 truncate">{last ? last.text : "Say hi 👋"}</div>
                  </div>
                </div>
              );
            })}
                </>
              );
            })()}
          </>
        )}
      </div>
      {view === "settings" ? <SettingsView /> : (
        <div className="flex-1 flex flex-col">
          <div className="aero-titlebar px-3 py-1.5 text-sm font-semibold flex items-center justify-between gap-2">
            {localPartner && (
              <>
                <span className="truncate">{localPartner.avatar.startsWith("data:") ? "🙂" : localPartner.avatar} {localPartner.name}</span>
                <span className="text-[10px] opacity-60 font-mono ml-auto">#{localPartner.pueiNumber || pueiNumberFor(localPartner.name + ":seed")}</span>
                <button className="aero-button rounded px-2 py-0.5 text-[10px]" title="Delete conversation"
                  onClick={() => deleteLocalChat(localPartner.name)}>🗑️ Delete</button>
                <button className="aero-button rounded px-2 py-0.5 text-[10px]" title="Block contact"
                  onClick={() => blockLocal(localPartner.name)}>🚫 Block</button>
              </>
            )}
            {externalPartner && (
              <>
                <span>🌐 {externalPartner.pueiNumber}</span>
                <span className="text-[10px] opacity-60 bg-blue-100 text-blue-700 rounded px-1 ml-auto">cross-device</span>
                <button className="aero-button rounded px-2 py-0.5 text-[10px]" title="Remove contact"
                  onClick={() => deleteExternalContact(externalPartner.pueiNumber)}>🗑️ Delete</button>
                <button className="aero-button rounded px-2 py-0.5 text-[10px]" title="Block contact"
                  onClick={() => blockExternal(externalPartner.pueiNumber)}>🚫 Block</button>
              </>
            )}
          </div>
          <div className="flex-1 p-3 overflow-auto space-y-2 text-sm">
            {activeKind === "local" && (
              <>
                {localConversation.length === 0 && <div className="text-xs opacity-60 text-center">No messages yet.</div>}
                {localConversation.map((m) => (
                  <div key={m.id} className={m.from === user ? "text-right" : "text-left"}>
                    <div className="inline-block px-3 py-1.5 rounded-2xl max-w-xs"
                      style={{ background: m.from === user ? "var(--gradient-aero)" : "var(--glass)", color: m.from === user ? "white" : undefined, border: "1px solid var(--border)" }}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </>
            )}
            {activeKind === "external" && (
              <>
                {externalConversation.length === 0 && (
                  <div className="text-xs opacity-60 text-center">No messages yet. Messages are delivered in real time across devices.</div>
                )}
                {externalConversation.map((m) => {
                  const isMine = m.fromNumber === myPueiNumber;
                  return (
                    <div key={m.id} className={isMine ? "text-right" : "text-left"}>
                      <div className="inline-block px-3 py-1.5 rounded-2xl max-w-xs"
                        style={{ background: isMine ? "var(--gradient-aero)" : "var(--glass)", color: isMine ? "white" : undefined, border: "1px solid var(--border)" }}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="p-2 flex gap-2 border-t">
            <input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 px-3 py-1.5 rounded-md outline-none text-sm"
              style={{ background: "white", border: "1px solid var(--border)" }}
              placeholder={localPartner ? `Message ${localPartner.name}…` : externalPartner ? `Message ${externalPartner.pueiNumber}…` : "Select a contact…"} />
            <button className="aero-button rounded-md px-3" onClick={send} disabled={!localPartner && !externalPartner}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileExplorerApp({ openApp, icons, openFolder, currentUser }: { openApp: (id: AppId, fileId?: string) => void; icons: DesktopIcon[]; openFolder: (id: string, title: string) => void; currentUser: string }) {
  const myFiles = () => loadFiles().filter((f) => !f.owner || f.owner === currentUser);
  const [files, setFiles] = useState<SavedFile[]>(() => myFiles());
  const [folder, setFolder] = useState<"home" | "documents" | "pictures" | "apps" | "folders">("home");
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

  const textFiles = files.filter((f) => f.type === "text" && !f.folder);
  const imgFiles = files.filter((f) => f.type === "image" && !f.folder);
  const myFolders = icons.filter((i) => i.appId === "folder");

  const openFile = (f: SavedFile) => openApp(f.type === "text" ? "notepad" : "puei-paint", f.id);

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
          ["home","🏠 Home"],["documents","📁 Documents"],["pictures","🖼️ Pictures"],
          ["folders","🗃️ My Folders"],["apps","🧩 Apps"],
        ].map(([k, l]) => (
          <div key={k} onClick={() => setFolder(k as any)}
            className="px-2 py-1 rounded hover:bg-white/30 cursor-pointer"
            style={{ background: folder === k ? "rgba(255,255,255,0.4)" : undefined }}>{l}</div>
        ))}
        <div className="font-semibold mt-3 mb-2 opacity-70 text-xs">COMPUTER</div>
        <div className="px-2 py-1 rounded opacity-70">💽 C:\ PueiDrive</div>
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
          <FileGrid files={textFiles} emptyHint="No saved documents. Open Notepad and click Save to create one."
            openFile={openFile}
            onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
            onDragStart={(id) => setDragFileId(id)}
            onDragEnd={() => { setDragFileId(null); setDropTarget(null); }} />
        )}
        {folder === "pictures" && (
          <FileGrid files={imgFiles} emptyHint="No saved pictures. Open Puei Paint 2 and click Save to create one."
            openFile={openFile}
            onDelete={(id) => { deleteFile(id); setFiles(myFiles()); }}
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
        {folder === "folders" && (
          myFolders.length === 0
            ? <div className="text-sm opacity-70 p-6 text-center">No folders yet. Right-click the desktop → New Folder.</div>
            : <div className="grid grid-cols-5 gap-3">
                {myFolders.map((f) => {
                  const folderFiles = files.filter((fi) => fi.folder === f.id);
                  return (
                    <div key={f.id}
                      onDoubleClick={() => openFolder(f.id, f.label)}
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
      </div>
    </div>
  );
}

function FileGrid({ files, emptyHint, openFile, onDelete, onDragStart, onDragEnd }: {
  files: SavedFile[]; emptyHint: string;
  openFile: (f: SavedFile) => void; onDelete: (id: string) => void;
  onDragStart?: (id: string) => void; onDragEnd?: () => void;
}) {
  if (files.length === 0) return <div className="text-sm opacity-70 p-6 text-center">{emptyHint}</div>;
  return (
    <div className="grid grid-cols-5 gap-3">
      {files.map((f) => (
        <div key={f.id} onDoubleClick={() => openFile(f)}
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(f.id); }}
          onDragEnd={() => onDragEnd?.()}
          className="text-center p-2 rounded hover:bg-white/30 cursor-grab active:cursor-grabbing group relative select-none">
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
function AppStoreApp({ installWebApp, openApp, systemVersion }: { installWebApp: (label: string, url: string, iconUrl?: string) => void; openApp: (id: AppId) => void; systemVersion: SystemVersion }) {
  const [tab, setTab] = useState<"official" | "installer">("official");
  type StoreApp = { name: string; icon: string; desc: string; appId: AppId };
  // Only Puei Team–built apps. AppStore is a closed ecosystem.
  const official: StoreApp[] = [
    { name: "PueiSocial",      icon: "📣", desc: "The official PueiOS social network.",     appId: "puei-social" },
    { name: "Puei Messenger",  icon: "💬", desc: "Chat by PueiNumber.",                     appId: "puei-messenger" },
    { name: "PueiWeb",         icon: "🌐", desc: "System browser + AI search engine.",      appId: "pueinet" },
    { name: "Puei Paint 2",    icon: "🎨", desc: "Paint and save images as wallpapers.",    appId: "puei-paint" },
    { name: "Installer",       icon: "📥", desc: "Install trusted web apps as shortcuts.",  appId: "app-store" },
    { name: "Settings",        icon: "⚙️", desc: "Personalize, dark mode, accessibility.",  appId: "settings" },
    { name: "Computer",        icon: "🗂️", desc: "File system explorer.",                   appId: "file-explorer" },
    { name: "Notepad",         icon: "📝", desc: "Write and save text files.",              appId: "notepad" },
    { name: "Calculator",      icon: "🧮", desc: "Glossy arithmetic.",                       appId: "calculator" },
    { name: "Solitaire",       icon: "🃏", desc: "Classic Klondike Solitaire vs Puei Bot AI.", appId: "solitaire" },
    { name: "Chess",           icon: "♟️", desc: "Chess vs adaptive Puei Bot AI.",            appId: "chess" },
  ];
  return (
    <div className="flex h-full">
      <div className="w-44 p-2 border-r text-sm overflow-auto" style={{ background: "var(--glass)" }}>
        <div className="font-semibold opacity-70 text-xs mb-2 px-2">PUEI APP STORE</div>
        {([["official","✨ Official apps"],["installer","📥 Installer"]] as const).map(([k, l]) => (
          <div key={k} onClick={() => { setTab(k); blip("click"); }}
            className="px-3 py-2 rounded cursor-pointer text-sm mb-0.5"
            style={{ background: tab === k ? "var(--gradient-aero)" : "transparent", color: tab === k ? "white" : undefined }}>{l}</div>
        ))}
        <div className="text-[10px] opacity-60 px-2 mt-4 leading-snug">
          PueiOS 2 is a closed ecosystem. Only Puei Team–built apps are allowed here. Unofficial apps (e.g. "PueiReddit") are not permitted.
        </div>
      </div>
      <div className="flex-1 p-5 overflow-auto">
        {tab === "installer" ? <InstallerPane installWebApp={installWebApp} /> : (
          <div>
            <h2 className="text-2xl font-bold mb-1">PueiOS 2 App Store</h2>
            <p className="text-sm opacity-70 mb-4">Verified, first-party apps built by the Puei Team. Closed ecosystem — security and trust over openness.</p>
            <div className="grid grid-cols-3 gap-3">
              {official.map((a) => (
                <div key={a.name} className="aero-glass-light rounded-lg p-3 flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="text-3xl">{a.icon}</div>
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-[10px] opacity-60">✓ Official · Puei Team</div>
                    </div>
                  </div>
                  <div className="text-xs opacity-70 mt-1 h-8">{a.desc}</div>
                  <button className="aero-button rounded px-3 py-1 text-xs mt-auto w-full"
                    onClick={() => openApp(a.appId)}>Open</button>
                </div>
              ))}
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
  const install = () => {
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
    installWebApp(label, res.url, icon);
    setMsg({ kind: "ok", text: `Installed "${label}" (${res.kind === "lovable" ? "Lovable" : "Base44"} app) on your desktop ✓` });
    blip("notify");
    setUrl(""); setName("");
  };
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">📥 Installer</h2>
      <p className="text-sm opacity-70 mb-4">Install trusted web apps as desktop shortcuts. Only verified domains are accepted.</p>
      <div className="aero-glass-light rounded-lg p-4 max-w-lg space-y-3">
        <div className="text-xs opacity-80">
          <div className="font-semibold mb-1">Trusted domains</div>
          <code className="block px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.08)" }}>https://&lt;appname&gt;.lovable.app</code>
          <code className="block px-2 py-1 rounded mt-1" style={{ background: "rgba(0,0,0,0.08)" }}>https://&lt;appname&gt;.base44.app</code>
        </div>
        <div>
          <label className="text-xs opacity-70">Website URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.lovable.app"
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        </div>
        <div>
          <label className="text-xs opacity-70">App name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Auto from domain"
            className="w-full px-3 py-2 rounded text-sm outline-none" style={{ background: "white", color: "#111" }} />
        </div>
        <button className="aero-button rounded px-4 py-2 w-full" onClick={install}>Install on desktop</button>
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
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
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
    if (!confirm("Delete this post?")) return;
    const next = posts.filter((p) => p.id !== postId);
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
        <div className="flex flex-col gap-0.5 items-end">
          <div className="text-xs opacity-70 flex items-center gap-1.5">
            Available on:
            <span title="iOS">📱</span>
            <span title="Android">🤖</span>
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
                  <button onClick={() => deletePost(p.id)} className="text-xs opacity-50 hover:opacity-100 hover:text-red-500" title="Delete post">🗑️</button>
                )}
              </div>
              {p.text && <div className="text-sm whitespace-pre-wrap mb-2">{p.text}</div>}
              {p.media?.kind === "image" && <img src={p.media.src} className="max-h-80 rounded w-auto" alt="" />}
              {p.media?.kind === "video" && <video src={p.media.src} controls className="max-h-80 rounded w-full" />}
              <div className="flex gap-2 mt-2 text-xs">
                <button onClick={() => toggleLike(p.id)}
                  className="aero-button rounded px-2 py-0.5 flex items-center gap-1"
                  style={liked ? { background: "var(--gradient-aero)", color: "white" } : undefined}>
                  {liked ? "💙" : "👍"} {p.likes}
                </button>
                <button onClick={() => setOpenComments({ ...openComments, [p.id]: !commentsOpen })}
                  className="aero-button rounded px-2 py-0.5">
                  💬 {comments.length}
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
                        <button onClick={() => deleteComment(p.id, c.id)} className="text-xs opacity-40 hover:opacity-100 hover:text-red-500" title="Delete">✕</button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-1 pt-1">
                    <input
                      value={commentDrafts[p.id] || ""}
                      onChange={(e) => setCommentDrafts({ ...commentDrafts, [p.id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") addComment(p.id); }}
                      placeholder="Write a comment…"
                      className="flex-1 px-2 py-1 rounded text-xs outline-none"
                      style={{ background: "white", color: "#111", border: "1px solid var(--border)" }} />
                    <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => addComment(p.id)}>Reply</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
        <h2 className="text-lg font-semibold">🗑️ Recycle Bin</h2>
        <button className="aero-button rounded px-3 py-1 text-xs" onClick={() => { if (confirm("Empty Recycle Bin?")) { emptyRecycle(); setItems([]); }}}>Empty Recycle Bin</button>
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

// ---------- Solitaire (vs AI bot, minimal) ----------
function SolitaireApp() {
  const [moves, setMoves] = useState(0);
  return (
    <div className="p-6 h-full text-center">
      <h2 className="text-xl font-bold mb-2">🃏 Solitaire</h2>
      <p className="text-xs opacity-70 mb-4">Klondike · Single-player or vs Puei Bot</p>
      <div className="grid grid-cols-7 gap-2 max-w-2xl mx-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="aero-glass-light rounded h-32 flex items-center justify-center text-xs opacity-70 cursor-pointer"
            onClick={() => { setMoves(m => m + 1); blip("click"); }}>Pile {i + 1}</div>
        ))}
      </div>
      <div className="mt-4 text-sm opacity-80">Moves: {moves}</div>
      <div className="mt-2 text-xs opacity-60">vs 🤖 Puei Bot · Difficulty: Easy</div>
    </div>
  );
}

// ---------- Chess (vs AI bot, minimal board) ----------
function ChessApp() {
  const init = [
    "♜♞♝♛♚♝♞♜",
    "♟♟♟♟♟♟♟♟",
    "        ",
    "        ",
    "        ",
    "        ",
    "♙♙♙♙♙♙♙♙",
    "♖♘♗♕♔♗♘♖",
  ];
  const [turn, setTurn] = useState<"You" | "Bot">("You");
  return (
    <div className="p-4 h-full text-center">
      <h2 className="text-lg font-bold mb-1">♟️ Chess · vs Puei Bot</h2>
      <div className="text-xs opacity-70 mb-3">Turn: {turn}</div>
      <div className="inline-grid grid-cols-8 border-2 border-black/40">
        {init.flatMap((row, r) => Array.from(row).map((c, ci) => (
          <div key={`${r}-${ci}`}
            onClick={() => { setTurn(turn === "You" ? "Bot" : "You"); blip("click"); }}
            className="w-10 h-10 flex items-center justify-center text-2xl cursor-pointer"
            style={{ background: (r + ci) % 2 === 0 ? "#f0d9b5" : "#b58863", color: "#111" }}>
            {c.trim()}
          </div>
        )))}
      </div>
      <div className="mt-3 text-xs opacity-60">Click a square to pass turn. AI bot moves automatically (simulated).</div>
    </div>
  );
}
