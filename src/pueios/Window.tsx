import { useCallback, useEffect, useRef, useState } from "react";
import type { AppId, WindowState } from "./state";
import { blip } from "./state";

type CtxItem = { label: string; action?: () => void; sep?: boolean; disabled?: boolean };

export function ContextMenu({
  x, y, items, onClose,
}: { x: number; y: number; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let nx = x, ny = y;
    if (x + r.width > vw - 8) nx = vw - r.width - 8;
    if (y + r.height > vh - 8) ny = vh - r.height - 8;
    setPos({ x: nx, y: ny });
  }, [x, y]);
  useEffect(() => {
    const fn = () => onClose();
    window.addEventListener("mousedown", fn);
    window.addEventListener("blur", fn);
    return () => {
      window.removeEventListener("mousedown", fn);
      window.removeEventListener("blur", fn);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="context-menu fixed"
      style={{ left: pos.x, top: pos.y, zIndex: 99999 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="context-sep" />
        ) : (
          <div
            key={i}
            className="context-item"
            style={{ opacity: it.disabled ? 0.4 : 1, pointerEvents: it.disabled ? "none" : "auto" }}
            onClick={() => {
              blip("click");
              it.action?.();
              onClose();
            }}
            onMouseEnter={() => blip("hover")}
          >
            {it.label}
          </div>
        )
      )}
    </div>
  );
}

export function AppWindow({
  win, focused, peek, fullWindowTransparency, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children,
}: {
  win: WindowState;
  focused: boolean;
  peek?: boolean;
  fullWindowTransparency?: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  children: React.ReactNode;
}) {
  const drag = useRef<{ ox: number; oy: number } | null>(null);
  const resz = useRef<{ ow: number; oh: number; sx: number; sy: number } | null>(null);

  const onTitleDown = (e: React.PointerEvent) => {
    if (win.maximized) return;
    onFocus();
    drag.current = { ox: e.clientX - win.x, oy: e.clientY - win.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onTitleMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.ox;
    const ny = e.clientY - drag.current.oy;
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 80;
    onMove(Math.max(-win.w + 120, Math.min(maxX, nx)), Math.max(0, Math.min(maxY, ny)));
  };
  const onTitleUp = (e: React.PointerEvent) => {
    drag.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onFocus();
    resz.current = { ow: win.w, oh: win.h, sx: e.clientX, sy: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resz.current) return;
    const nw = Math.max(280, resz.current.ow + (e.clientX - resz.current.sx));
    const nh = Math.max(180, resz.current.oh + (e.clientY - resz.current.sy));
    onResize(nw, nh);
  };
  const onResizeUp = (e: React.PointerEvent) => {
    resz.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  if (win.minimized) return null;

  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: 0, width: "100vw", height: "calc(100vh - 48px)" }
    : { left: win.x, top: win.y, width: win.w, height: win.h };

  return (
    <div
      className={`${fullWindowTransparency ? "aero-glass" : ""} window-shadow fixed flex flex-col overflow-hidden`}
      style={{
        ...style,
        zIndex: 100 + win.z,
        background: fullWindowTransparency ? undefined : "var(--background)",
        opacity: peek ? 0.16 : (focused ? 1 : 0.93),
        borderRadius: 8,
        border: focused
          ? "1px solid var(--border)"
          : "1px solid color-mix(in oklch, var(--border) 55%, transparent)",
        boxShadow: focused
          ? "0 8px 40px color-mix(in oklch, var(--accent) 30%, transparent), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.75)"
          : "0 4px 20px rgba(0,20,80,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
        transition: drag.current || resz.current ? "none" : "opacity 0.15s, box-shadow 0.2s, transform 0.12s",
        transform: peek ? "translateY(2px) scale(0.995)" : "none",
        pointerEvents: peek ? "none" : "auto",
      }}
      onMouseDown={onFocus}
    >
      {/* Win7-style title bar */}
      <div
        className="aero-titlebar flex items-center justify-between select-none"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onDoubleClick={onMaximize}
        style={{
          cursor: win.maximized ? "default" : "move",
          touchAction: "none",
          minHeight: 32,
          padding: "0 4px 0 10px",
          background: focused
            ? "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, var(--glass-strong) 28%, var(--glass) 60%, transparent 100%), var(--titlebar)"
            : "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, var(--glass) 50%, transparent 100%), var(--titlebar)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 2px 6px rgba(255,255,255,0.3)",
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold truncate"
          style={{ color: focused ? "var(--titlebar-text)" : "rgba(80,80,110,0.8)", textShadow: "0 1px 2px rgba(255,255,255,0.7)" }}>
          <span>{win.title}</span>
        </div>
        {/* Win7-style window control buttons */}
        <div className="flex items-center" style={{ gap: 2, paddingLeft: 4 }}>
          {/* Minimize */}
          <button
            title="Minimize"
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            style={{
              width: 26, height: 20, fontSize: 12, fontWeight: "bold",
              background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(205,225,255,0.75) 45%, rgba(170,210,255,0.65) 50%, rgba(200,225,255,0.72) 100%)",
              border: "1px solid rgba(100,150,220,0.45)",
              borderRadius: 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(0,0,0,0.1)",
              color: "#444",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              lineHeight: 1,
            }}
          >─</button>
          {/* Maximize/Restore */}
          <button
            title={win.maximized ? "Restore" : "Maximize"}
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            style={{
              width: 26, height: 20, fontSize: 10, fontWeight: "bold",
              background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(205,225,255,0.75) 45%, rgba(170,210,255,0.65) 50%, rgba(200,225,255,0.72) 100%)",
              border: "1px solid rgba(100,150,220,0.45)",
              borderRadius: 4,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(0,0,0,0.1)",
              color: "#444",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >{win.maximized ? "❐" : "☐"}</button>
          {/* Close — red */}
          <button
            title="Close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              width: 28, height: 20, fontSize: 11, fontWeight: "bold",
              background: "linear-gradient(180deg, #f77 0%, #e44 45%, #c22 50%, #d44 100%)",
              border: "1px solid rgba(160,30,30,0.6)",
              borderRadius: 4,
              boxShadow: "inset 0 1px 0 rgba(255,200,200,0.8), 0 1px 3px rgba(0,0,0,0.2)",
              color: "white",
              textShadow: "0 1px 1px rgba(0,0,0,0.4)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" style={{ background: fullWindowTransparency ? "var(--glass-strong)" : "var(--background)" }}>
        {children}
      </div>
      {!win.maximized && (
        <>
          {/* Right edge */}
          <div onPointerDown={(e) => { e.stopPropagation(); onFocus(); resz.current = { ow: win.w, oh: win.h, sx: e.clientX, sy: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (!resz.current) return; onResize(Math.max(280, resz.current.ow + (e.clientX - resz.current.sx)), win.h); }}
            onPointerUp={onResizeUp}
            style={{ position: "absolute", right: 0, top: 16, bottom: 16, width: 6, cursor: "ew-resize", touchAction: "none", zIndex: 10 }} />
          {/* Bottom edge */}
          <div onPointerDown={(e) => { e.stopPropagation(); onFocus(); resz.current = { ow: win.w, oh: win.h, sx: e.clientX, sy: e.clientY }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (!resz.current) return; onResize(win.w, Math.max(180, resz.current.oh + (e.clientY - resz.current.sy))); }}
            onPointerUp={onResizeUp}
            style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 6, cursor: "ns-resize", touchAction: "none", zIndex: 10 }} />
          {/* Bottom-right corner (visible handle) */}
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            style={{
              position: "absolute", right: 0, bottom: 0, width: 16, height: 16,
              cursor: "nwse-resize", touchAction: "none", zIndex: 11,
              background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.25) 50%)",
            }}
          />
        </>
      )}
    </div>
  );
}

// macOS Panther Aqua-style icons — deep 3D, glossy gel look
const APP_ICON_SVGS: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  // Settings — silver metallic gear
  "settings": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="sg1" cx="30%" cy="20%" r="70%"><stop offset="0%" stopColor="#f0f0f8"/><stop offset="50%" stopColor="#b0b8d0"/><stop offset="100%" stopColor="#606880"/></radialGradient><radialGradient id="sg2" cx="35%" cy="25%" r="65%"><stop offset="0%" stopColor="#90b8ff"/><stop offset="100%" stopColor="#0028a0"/></radialGradient></defs><path d="M24 6l2.5 5 5.5-0.5 2 4.5-4.5 3.5 1 5.5-4.5 2.5-4.5-2.5 1-5.5-4.5-3.5 2-4.5 5.5 0.5z" fill="url(#sg1)" stroke="#5060a0" strokeWidth="0.8"/><circle cx="24" cy="24" r="8" fill="url(#sg2)"/><ellipse cx="20" cy="20" rx="3" ry="2" fill="rgba(255,255,255,0.55)" transform="rotate(-20 20 20)"/></svg>,

  // File Explorer — Panther Finder-style folder (blue with handle)
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="fe1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#82c4ff"/><stop offset="50%" stopColor="#2080e8"/><stop offset="100%" stopColor="#0040b0"/></linearGradient><linearGradient id="fe2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8d8ff"/><stop offset="100%" stopColor="#4090d8"/></linearGradient></defs><path d="M4 18a4 4 0 014-4h10l3-3h20a4 4 0 014 4v18a4 4 0 01-4 4H8a4 4 0 01-4-4V18z" fill="url(#fe1)" stroke="#0030a0" strokeWidth="1"/><path d="M4 14a4 4 0 014-4h8l4 4z" fill="url(#fe2)" stroke="#0030a0" strokeWidth="0.8"/><ellipse cx="22" cy="21" rx="14" ry="4" fill="rgba(255,255,255,0.3)"/></svg>,

  // Notepad — clean white document with corner fold
  "notepad": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="np1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#dde8f8"/></linearGradient></defs><path d="M8 4h24l10 10v30a2 2 0 01-2 2H10a2 2 0 01-2-2V4z" fill="url(#np1)" stroke="#9090c0" strokeWidth="1"/><path d="M32 4l10 10H34a2 2 0 01-2-2V4z" fill="#b8c8e8" stroke="#8090b8" strokeWidth="0.8"/><line x1="14" y1="20" x2="36" y2="20" stroke="#c0c8e8" strokeWidth="1.2"/><line x1="14" y1="26" x2="36" y2="26" stroke="#c0c8e8" strokeWidth="1.2"/><line x1="14" y1="32" x2="36" y2="32" stroke="#c0c8e8" strokeWidth="1.2"/><line x1="14" y1="38" x2="28" y2="38" stroke="#c0c8e8" strokeWidth="1.2"/><rect x="8" y="4" width="32" height="8" rx="2" fill="rgba(255,255,255,0.5)"/></svg>,

  // Calculator — dark Panther style
  "calculator": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="ca1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#606878"/><stop offset="100%" stopColor="#282c34"/></linearGradient><linearGradient id="ca2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60d060"/><stop offset="100%" stopColor="#184018"/></linearGradient></defs><rect x="6" y="4" width="36" height="40" rx="5" fill="url(#ca1)" stroke="#181c24" strokeWidth="1"/><rect x="10" y="8" width="28" height="10" rx="2" fill="url(#ca2)" stroke="#0c2c0c" strokeWidth="0.8"/><text x="36" y="17" textAnchor="end" fontSize="8" fill="#00ff60" fontFamily="monospace" fontWeight="700">0</text>{[[0,1,2],[0,1,2],[0,1,2],[0,1,2]].map((row,r)=>row.map((c)=><rect key={`${r}${c}`} x={11+c*9} y={22+r*7} width="7" height="5" rx="2" fill={r===3&&c===2?"#e04040":r===0?"#505868":"#3c4250"} stroke="#282c38" strokeWidth="0.5"/>))}</svg>,

  // Paint — artist palette with brush, Panther style
  "puei-paint": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="pal" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#f8e8c0"/><stop offset="100%" stopColor="#c8a060"/></radialGradient></defs><ellipse cx="22" cy="27" rx="18" ry="13" fill="url(#pal)" stroke="#a07840" strokeWidth="1.2"/><circle cx="12" cy="26" r="4.5" fill="#ff3838" stroke="#c01010" strokeWidth="0.7"/><circle cx="20" cy="19" r="4.5" fill="#30c838" stroke="#108020" strokeWidth="0.7"/><circle cx="30" cy="21" r="4.5" fill="#3880f8" stroke="#1040d0" strokeWidth="0.7"/><circle cx="30" cy="31" r="4.5" fill="#f8c820" stroke="#c08800" strokeWidth="0.7"/><circle cx="18" cy="31" r="4.5" fill="#c028c8" stroke="#800890" strokeWidth="0.7"/><circle cx="21" cy="26" r="3.5" fill="rgba(255,255,255,0.85)"/><path d="M37 6 Q44 2 46 11 Q47 18 40 20 L37 17 Q33 12 37 6z" fill="#b06018" stroke="#804010" strokeWidth="0.8"/><rect x="39" y="19" width="3.5" height="14" rx="1.5" fill="#d8a848" stroke="#a07828" strokeWidth="0.5" transform="rotate(18 40 19)"/></svg>,

  // Board — Panther cork board
  "puei-board": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="brd" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#d8a870"/><stop offset="100%" stopColor="#8c5428"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="3" fill="url(#brd)" stroke="#6a3c18" strokeWidth="1.5"/><rect x="5" y="5" width="38" height="38" rx="2" fill="#c89860" opacity="0.5"/><rect x="9" y="9" width="14" height="11" rx="1.5" fill="white" opacity="0.95" filter="url(#sh)"/><rect x="27" y="9" width="14" height="7" rx="1.5" fill="#ffffa0" opacity="0.95"/><rect x="27" y="20" width="14" height="11" rx="1.5" fill="#ffcccc" opacity="0.95"/><rect x="9" y="24" width="14" height="17" rx="1.5" fill="#ccffcc" opacity="0.95"/><circle cx="16" cy="9" r="2.5" fill="#e82020" stroke="#a00000" strokeWidth="0.8"/><circle cx="34" cy="9" r="2.5" fill="#20c020" stroke="#008000" strokeWidth="0.8"/><circle cx="34" cy="20" r="2.5" fill="#2040f8" stroke="#0010c0" strokeWidth="0.8"/></svg>,

  // PueiNet — Aqua blue globe with wet gloss
  "pueinet": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="gl1" cx="32%" cy="22%" r="72%"><stop offset="0%" stopColor="#90d8ff"/><stop offset="40%" stopColor="#1878f0"/><stop offset="100%" stopColor="#001870"/></radialGradient><radialGradient id="gl2" cx="30%" cy="15%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.7)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#gl1)" stroke="#001060" strokeWidth="1.2"/><ellipse cx="24" cy="24" rx="10" ry="21" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/><ellipse cx="24" cy="24" rx="21" ry="9" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/><ellipse cx="18" cy="16" rx="9" ry="5" fill="url(#gl2)" transform="rotate(-30 18 16)"/></svg>,

  // Chat — Aqua gel speech bubble
  "puei-cloud-chat": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="ch1" cx="30%" cy="20%" r="70%"><stop offset="0%" stopColor="#80ff90"/><stop offset="50%" stopColor="#18b830"/><stop offset="100%" stopColor="#006010"/></radialGradient></defs><path d="M6 10a5 5 0 015-5h26a5 5 0 015 5v17a5 5 0 01-5 5H28l-8 9v-9H11a5 5 0 01-5-5V10z" fill="url(#ch1)" stroke="#006010" strokeWidth="1"/><rect x="12" y="16" width="9" height="3.5" rx="1.8" fill="rgba(255,255,255,0.9)"/><rect x="12" y="22" width="22" height="3.5" rx="1.8" fill="rgba(255,255,255,0.9)"/><rect x="12" y="11" width="26" height="3.5" rx="1.8" fill="rgba(255,255,255,0.9)"/><ellipse cx="19" cy="13" rx="10" ry="3.5" fill="rgba(255,255,255,0.3)"/></svg>,

  // Studio — Aqua purple disc / music
  "puei-studio": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="st1" cx="30%" cy="18%" r="72%"><stop offset="0%" stopColor="#e090ff"/><stop offset="50%" stopColor="#8010d0"/><stop offset="100%" stopColor="#300060"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#st1)" stroke="#300058" strokeWidth="1"/><path d="M24 11 L27.5 20H38L29.5 26 L33 35 L24 29 L15 35 L18.5 26 L10 20H20.5Z" fill="#ffe040" stroke="#b88010" strokeWidth="0.8"/><circle cx="24" cy="24" r="3" fill="#ffe040" stroke="#b88010" strokeWidth="0.6"/><ellipse cx="18" cy="16" rx="7" ry="4" fill="rgba(255,255,255,0.28)" transform="rotate(-25 18 16)"/></svg>,

  // App Store — Aqua teal rounded square with A
  "app-store": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="as1" cx="30%" cy="20%" r="72%"><stop offset="0%" stopColor="#60f0e0"/><stop offset="50%" stopColor="#00a890"/><stop offset="100%" stopColor="#004840"/></radialGradient></defs><rect x="4" y="4" width="40" height="40" rx="10" fill="url(#as1)" stroke="#004838" strokeWidth="1"/><text x="24" y="31" textAnchor="middle" fontSize="24" fontWeight="900" fill="white" fontFamily="system-ui" opacity="0.95">A</text><ellipse cx="19" cy="16" rx="8" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-10 19 16)"/></svg>,

  // Social — two Aqua people
  "puei-social": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="so1" cx="35%" cy="25%" r="65%"><stop offset="0%" stopColor="#ffd0a0"/><stop offset="100%" stopColor="#e08040"/></radialGradient><radialGradient id="so2" cx="35%" cy="25%" r="65%"><stop offset="0%" stopColor="#c0dcff"/><stop offset="100%" stopColor="#4080e0"/></radialGradient></defs><circle cx="17" cy="16" r="8" fill="url(#so1)" stroke="#c06030" strokeWidth="1"/><path d="M3 42c0-9 6-14 14-14s14 5 14 14z" fill="url(#so1)" stroke="#c06030" strokeWidth="1"/><circle cx="33" cy="14" r="7" fill="url(#so2)" stroke="#3060c0" strokeWidth="1"/><path d="M23 40c0-7 5-11 11-11s11 4 11 11z" fill="url(#so2)" stroke="#3060c0" strokeWidth="1"/><ellipse cx="14" cy="13" rx="5" ry="3" fill="rgba(255,255,255,0.45)"/></svg>,

  // Folder — Panther blue folder with depth
  "folder": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="fo1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#88ccff"/><stop offset="50%" stopColor="#1878f0"/><stop offset="100%" stopColor="#003890"/></linearGradient><linearGradient id="fo2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a8dcff"/><stop offset="100%" stopColor="#5098e8"/></linearGradient></defs><path d="M4 19a4 4 0 014-4h10l4-4h19a4 4 0 014 4v17a4 4 0 01-4 4H8a4 4 0 01-4-4V19z" fill="url(#fo1)" stroke="#0030a0" strokeWidth="1"/><path d="M4 15a4 4 0 014-4h8l5 4z" fill="url(#fo2)" stroke="#0030a0" strokeWidth="0.8"/><ellipse cx="22" cy="22" rx="14" ry="4" fill="rgba(255,255,255,0.3)"/></svg>,

  // Recycle Bin — Aqua metallic trash can
  "recycle-bin": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="rb1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#d0e8d0"/><stop offset="100%" stopColor="#809880"/></linearGradient></defs><rect x="10" y="16" width="28" height="2.5" rx="1.5" fill="#607060" stroke="#405040" strokeWidth="0.8"/><path d="M13 18.5h22l-2.5 24H15.5z" fill="url(#rb1)" stroke="#608060" strokeWidth="1.2"/><path d="M17 14V10h14v4" fill="none" stroke="#607060" strokeWidth="1.8" strokeLinecap="round"/><path d="M20 28 L24 23 L28 28" fill="none" stroke="#28a828" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M24 23 v9" stroke="#28a828" strokeWidth="2.2" strokeLinecap="round"/><ellipse cx="24" cy="20" rx="14" ry="2" fill="rgba(255,255,255,0.35)"/></svg>,

  // Chess — Panther rich wood board
  "chess": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="cb1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#f0c878"/><stop offset="100%" stopColor="#a07028"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="3" fill="url(#cb1)" stroke="#785020" strokeWidth="1.2"/>{[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>(r+c)%2===0?<rect key={`${r}${c}`} x={4+c*8} y={4+r*8} width="8" height="8" fill="#b87820"/>:null))}<path d="M20 35v-5l-2-3.5 1-2.5 2.5-1.5 3-0.5 2.5 1.5 1.5 3-1 4-3.5 3.5z" fill="white" stroke="#505050" strokeWidth="0.8"/><rect x="17" y="35" width="12" height="3" rx="1" fill="white" stroke="#505050" strokeWidth="0.8"/><ellipse cx="24" cy="22" rx="4" ry="3" fill="white" stroke="#505050" strokeWidth="0.7"/></svg>,

  // Mansion — Panther house with warm colors
  "puei-mansion": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="mn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f07070"/><stop offset="100%" stopColor="#981818"/></linearGradient><linearGradient id="mn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8f0e0"/><stop offset="100%" stopColor="#c8c098"/></linearGradient></defs><polygon points="24,3 45,20 40,20 40,45 8,45 8,20 3,20" fill="url(#mn1)" stroke="#780808" strokeWidth="1"/><rect x="9" y="20" width="30" height="25" fill="url(#mn2)" stroke="#a09870" strokeWidth="0.8"/><rect x="18" y="30" width="12" height="15" rx="1" fill="#90c8f0" stroke="#5090b8" strokeWidth="0.8"/><rect x="11" y="23" width="8" height="8" rx="1" fill="#90c8f0" stroke="#5090b8" strokeWidth="0.8"/><rect x="29" y="23" width="8" height="8" rx="1" fill="#90c8f0" stroke="#5090b8" strokeWidth="0.8"/><ellipse cx="24" cy="11" rx="11" ry="4" fill="rgba(255,160,160,0.4)"/></svg>,

  // About — Aqua info button
  "about": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="ab1" cx="28%" cy="18%" r="75%"><stop offset="0%" stopColor="#90c8ff"/><stop offset="50%" stopColor="#0860e8"/><stop offset="100%" stopColor="#001880"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#ab1)" stroke="#001068" strokeWidth="1.2"/><circle cx="24" cy="14" r="3.5" fill="white"/><rect x="20.5" y="20" width="7" height="14" rx="3" fill="white"/><ellipse cx="18" cy="16" rx="6" ry="3.5" fill="rgba(255,255,255,0.35)" transform="rotate(-30 18 16)"/></svg>,

  // ISO Viewer — shiny Aqua disc with rainbow
  "iso-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="iso1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f8f8ff"/><stop offset="30%" stopColor="#d0e8ff"/><stop offset="60%" stopColor="#b0c8f8"/><stop offset="100%" stopColor="#7888c0"/></radialGradient><radialGradient id="iso2" cx="28%" cy="22%" r="65%"><stop offset="0%" stopColor="rgba(255,255,255,0.9)"/><stop offset="100%" stopColor="rgba(200,230,255,0)"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#iso1)" stroke="#7080b8" strokeWidth="1"/><circle cx="24" cy="24" r="6" fill="#d8d8f0" stroke="#8888b0" strokeWidth="1"/><circle cx="24" cy="24" r="3" fill="white"/><ellipse cx="17" cy="16" rx="8" ry="4.5" fill="url(#iso2)" transform="rotate(-30 17 16)"/></svg>,

  // ZIP Viewer — Panther blue document with zip
  "zip-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="zp1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#90c8ff"/><stop offset="100%" stopColor="#1858c8"/></linearGradient></defs><path d="M6 10a3 3 0 013-3h20l9 9v26a3 3 0 01-3 3H9a3 3 0 01-3-3V10z" fill="url(#zp1)" stroke="#0838a0" strokeWidth="1"/><path d="M29 7v9h9" fill="none" stroke="#0838a0" strokeWidth="1.2"/><rect x="21" y="15" width="7" height="3" rx="1" fill="white" opacity="0.8"/><rect x="21" y="20" width="7" height="3" rx="1" fill="#a0c8ff" opacity="0.8"/><rect x="21" y="25" width="7" height="3" rx="1" fill="white" opacity="0.8"/><rect x="21" y="30" width="7" height="3" rx="1" fill="#a0c8ff" opacity="0.8"/><rect x="21" y="35" width="7" height="3" rx="1" fill="white" opacity="0.8"/><ellipse cx="20" cy="12" rx="10" ry="3" fill="rgba(255,255,255,0.35)"/></svg>,

  // PMail — Aqua envelope (like Mac Mail)
  "pmail": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="pm1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8f4ff"/><stop offset="100%" stopColor="#a0c8f0"/></linearGradient><linearGradient id="pm2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#50a0f0"/><stop offset="100%" stopColor="#0840c0"/></linearGradient></defs><rect x="3" y="9" width="42" height="30" rx="4" fill="url(#pm1)" stroke="#3878c0" strokeWidth="1.2"/><path d="M3 11l21 16 21-16" fill="none" stroke="#1858d0" strokeWidth="2"/><polygon points="3,39 19,25 3,11" fill="url(#pm2)" opacity="0.3"/><polygon points="45,39 29,25 45,11" fill="url(#pm2)" opacity="0.3"/><rect x="3" y="9" width="42" height="8" rx="4" fill="rgba(255,255,255,0.55)"/></svg>,

  // Web App — Aqua Safari-style compass
  "web-app": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="wa1" cx="30%" cy="20%" r="72%"><stop offset="0%" stopColor="#a0c8ff"/><stop offset="50%" stopColor="#0870f8"/><stop offset="100%" stopColor="#002090"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#wa1)" stroke="#001880" strokeWidth="1.2"/><circle cx="24" cy="24" r="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/><path d="M24 8 L26 22 L24 24 L22 22z" fill="white"/><path d="M40 24 L26 22 L24 24 L26 26z" fill="white"/><path d="M24 40 L22 26 L24 24 L26 26z" fill="#ff4040"/><path d="M8 24 L22 26 L24 24 L22 22z" fill="#ff4040"/><circle cx="24" cy="24" r="2.5" fill="white"/><ellipse cx="18" cy="16" rx="8" ry="4" fill="rgba(255,255,255,0.28)" transform="rotate(-25 18 16)"/></svg>,

  // Puei Space — Aqua rocket
  "pueyracing": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="rs1" cx="30%" cy="15%" r="75%" id="rs1"><stop offset="0%" stopColor="#d8eaff"/><stop offset="100%" stopColor="#5878d0"/></linearGradient><linearGradient id="rs2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff9838"/><stop offset="100%" stopColor="#ff2000"/></linearGradient></defs><path d="M24 3C24 3 15 15 15 28L20 30L24 32L28 30L33 28C33 15 24 3 24 3z" fill="url(#rs1)" stroke="#3858c0" strokeWidth="1.2"/><ellipse cx="24" cy="18" rx="6" ry="7" fill="#88d0ff" stroke="#3898e0" strokeWidth="0.8" opacity="0.85"/><path d="M15 28 L7 35 L11 33 L15 31z" fill="#d02020" stroke="#901010" strokeWidth="0.8"/><path d="M33 28 L41 35 L37 33 L33 31z" fill="#d02020" stroke="#901010" strokeWidth="0.8"/><ellipse cx="24" cy="34" rx="6" ry="3.5" fill="#ff8820" stroke="#c04800" strokeWidth="0.8"/><ellipse cx="24" cy="39" rx="5" ry="7" fill="url(#rs2)" opacity="0.88"/><ellipse cx="21" cy="13" rx="3.5" ry="6" fill="rgba(255,255,255,0.45)" transform="rotate(-15 21 13)"/></svg>,
};

// macOS Panther Aqua colors — deep saturated, gel-candy look
const MACOS_COLOR: Partial<Record<AppId, [string, string, string]>> = {
  "settings":        ["#c8d0e8", "#7888b0", "#404858"],
  "file-explorer":   ["#60b8ff", "#0868f0", "#003090"],
  "notepad":         ["#a8d8ff", "#3898e8", "#004898"],
  "calculator":      ["#707880", "#30383c", "#101418"],
  "puei-paint":      ["#ff9090", "#e03858", "#880028"],
  "puei-board":      ["#d8a870", "#a06030", "#503010"],
  "pueinet":         ["#68d0ff", "#0870f8", "#001888"],
  "puei-cloud-chat": ["#80f090", "#10c030", "#006010"],
  "puei-studio":     ["#d878ff", "#9010e0", "#400068"],
  "app-store":       ["#60e8d8", "#009890", "#004840"],
  "puei-social":     ["#ff9868", "#e04820", "#801000"],
  "folder":          ["#78c8ff", "#0878f0", "#003898"],
  "recycle-bin":     ["#90d890", "#28a840", "#106020"],
  "chess":           ["#f0c868", "#b07828", "#604010"],
  "puei-mansion":    ["#f88888", "#d82828", "#780808"],
  "about":           ["#68c0ff", "#0870e8", "#001880"],
  "iso-viewer":      ["#c0d8ff", "#6090e0", "#204880"],
  "zip-viewer":      ["#78b8ff", "#1860d8", "#082868"],
  "pmail":           ["#80c8ff", "#1068e8", "#002880"],
  "web-app":         ["#68b0ff", "#0868f8", "#002090"],
  "pueyracing":      ["#a8b8ff", "#3848d8", "#101878"],
};

export function appIcon(appId: AppId, size = 32, override?: string, iconUrl?: string) {
  const s = size;
  const radius = Math.round(s * 0.225); // macOS ~22.5%

  const isImg = typeof override === "string" && override.startsWith("data:");
  const useUrl = !isImg && !override && !!iconUrl;
  const fallbackIconUrl = (() => {
    if (!iconUrl) return "";
    const duckMatch = iconUrl.match(/\/ip3\/([^/?]+)\.ico/i);
    const host = duckMatch?.[1];
    if (!host) return "";
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, Math.round(s))}&domain_url=${encodeURIComponent(`https://${host}`)}`;
  })();
  const [c1, c2, c3] = MACOS_COLOR[appId] ?? ["#7888ff", "#2838d0", "#081068"];
  const customSvg = APP_ICON_SVGS[appId]?.(Math.round(s * 0.68));

  const iconBox = (children: React.ReactNode) => (
    <div style={{
      width: s, height: s, borderRadius: radius, flexShrink: 0, position: "relative", overflow: "hidden",
      background: `linear-gradient(160deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`,
      boxShadow: `0 ${Math.round(s*0.06)}px ${Math.round(s*0.22)}px rgba(0,0,0,0.5), 0 ${Math.round(s*0.01)}px ${Math.round(s*0.05)}px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
      {/* Panther Aqua: intense gel gloss — covers ~58% of top with wet look */}
      <div style={{ position: "absolute", top: 0, left: "3%", right: "3%", height: "58%", borderRadius: `${radius}px ${radius}px 50% 50%`, background: "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
      {/* Bottom subtle reflection */}
      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: "20%", borderRadius: `0 0 ${radius}px ${radius}px`, background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 100%)", pointerEvents: "none" }} />
    </div>
  );

  return (
    <div className="flex items-center justify-center relative" style={{ width: s, height: s, flexShrink: 0 }}>
      {isImg
        ? <img src={override} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius }} />
        : useUrl
          ? <>
              <img
                src={iconUrl}
                alt=""
                data-fallback={fallbackIconUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: radius }}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const fallback = img.dataset.fallback || "";
                  if (fallback && img.src !== fallback) {
                    img.src = fallback;
                    return;
                  }
                  img.style.display = "none";
                  const fallbackEl = img.nextElementSibling as HTMLElement | null;
                  if (fallbackEl) fallbackEl.style.display = "flex";
                }}
              />
              {iconBox(<div style={{ display: "none", alignItems: "center", justifyContent: "center" }}>{customSvg}</div>)}
            </>
          : iconBox(customSvg)
      }
    </div>
  );
}
