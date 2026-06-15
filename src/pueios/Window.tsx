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

// Windows XP style icons — colorful, shiny, 3D-looking with gradients and highlights
const APP_ICON_SVGS: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  // Settings — silver gear with colored center
  "settings": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="sg1" cx="35%" cy="25%" r="65%"><stop offset="0%" stopColor="#e8e8e8"/><stop offset="100%" stopColor="#888"/></radialGradient><radialGradient id="sg2" cx="40%" cy="30%" r="60%"><stop offset="0%" stopColor="#6af"/><stop offset="100%" stopColor="#0050c0"/></radialGradient></defs><path d="M24 4l3 6 6-1 2 5-5 4 1 6-5 3-5-3 1-6-5-4 2-5 6 1z" fill="url(#sg1)" stroke="#666" strokeWidth="0.8"/><circle cx="24" cy="24" r="7" fill="url(#sg2)"/><circle cx="21" cy="21" r="2.5" fill="rgba(255,255,255,0.5)"/></svg>,

  // File Explorer — yellow folder XP style
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="fe1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe060"/><stop offset="100%" stopColor="#d08000"/></linearGradient><linearGradient id="fe2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd030"/><stop offset="100%" stopColor="#b06000"/></linearGradient></defs><path d="M4 16a3 3 0 013-3h8l3 3h22a3 3 0 013 3v14a3 3 0 01-3 3H7a3 3 0 01-3-3V16z" fill="url(#fe1)" stroke="#a06000" strokeWidth="0.8"/><path d="M4 18h40" stroke="#b07800" strokeWidth="1.2"/><path d="M4 14a3 3 0 013-3h8l3 3z" fill="url(#fe2)" stroke="#a06000" strokeWidth="0.8"/><rect x="6" y="20" width="24" height="3" rx="1" fill="rgba(255,255,255,0.35)"/></svg>,

  // Notepad — white paper with blue lines and red margin
  "notepad": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="np1" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0%" stopColor="#f8f8ff"/><stop offset="100%" stopColor="#d8d8f0"/></linearGradient></defs><rect x="8" y="4" width="32" height="40" rx="2" fill="url(#np1)" stroke="#9090b0" strokeWidth="1"/><line x1="16" y1="4" x2="16" y2="44" stroke="#ffaaaa" strokeWidth="1.5"/><line x1="8" y1="14" x2="40" y2="14" stroke="#aac0e8" strokeWidth="1"/><line x1="8" y1="20" x2="40" y2="20" stroke="#aac0e8" strokeWidth="1"/><line x1="8" y1="26" x2="40" y2="26" stroke="#aac0e8" strokeWidth="1"/><line x1="8" y1="32" x2="40" y2="32" stroke="#aac0e8" strokeWidth="1"/><line x1="8" y1="38" x2="40" y2="38" stroke="#aac0e8" strokeWidth="1"/><rect x="8" y="4" width="32" height="6" rx="2" fill="rgba(255,255,255,0.6)"/></svg>,

  // Calculator — gray plastic body, green display
  "calculator": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="ca1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8c8d0"/><stop offset="100%" stopColor="#888890"/></linearGradient><linearGradient id="ca2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#90e890"/><stop offset="100%" stopColor="#208020"/></linearGradient></defs><rect x="8" y="4" width="32" height="40" rx="4" fill="url(#ca1)" stroke="#666" strokeWidth="1"/><rect x="12" y="8" width="24" height="10" rx="2" fill="url(#ca2)" stroke="#186018" strokeWidth="0.8"/><text x="34" y="17" textAnchor="end" fontSize="7" fill="#004000" fontFamily="monospace">0</text>{[0,1,2,3].map(r=>[0,1,2].map(c=><rect key={`${r}${c}`} x={13+c*8} y={22+r*7} width="6" height="5" rx="1.5" fill={r===3&&c===2?"#e06060":r===0?"#b0b8c8":"#e8e8f0"} stroke="#999" strokeWidth="0.5"/>))}</svg>,

  // Paint — palette with colorful blobs
  "puei-paint": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="pal" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#f0f0d8"/><stop offset="100%" stopColor="#c8c090"/></radialGradient></defs><ellipse cx="22" cy="26" rx="18" ry="14" fill="url(#pal)" stroke="#a09060" strokeWidth="1"/><circle cx="12" cy="24" r="4" fill="#e83030"/><circle cx="20" cy="18" r="4" fill="#30b030"/><circle cx="30" cy="20" r="4" fill="#3060e8"/><circle cx="30" cy="30" r="4" fill="#e8c030"/><circle cx="18" cy="30" r="4" fill="#c030c0"/><circle cx="22" cy="26" r="3" fill="rgba(255,255,255,0.8)"/><path d="M36 8 Q42 4 44 12 Q46 18 40 20 L36 18 Q32 14 36 8z" fill="#c87820" stroke="#a05010" strokeWidth="0.8"/><rect x="38" y="20" width="4" height="14" rx="2" fill="#e0b060" stroke="#a07030" strokeWidth="0.5" transform="rotate(20 40 20)"/></svg>,

  // Board — cork board with colorful pins
  "puei-board": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="brd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8a070"/><stop offset="100%" stopColor="#906040"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="3" fill="url(#brd)" stroke="#704020" strokeWidth="1.5"/><rect x="6" y="6" width="36" height="36" rx="2" fill="#d4a870" opacity="0.6"/><rect x="10" y="10" width="12" height="10" rx="1" fill="white" opacity="0.9"/><rect x="26" y="10" width="12" height="6" rx="1" fill="#ffffa0" opacity="0.9"/><rect x="26" y="20" width="12" height="10" rx="1" fill="#ffcccc" opacity="0.9"/><rect x="10" y="24" width="12" height="16" rx="1" fill="#ccffcc" opacity="0.9"/><circle cx="16" cy="10" r="2" fill="#e03030"/><circle cx="32" cy="10" r="2" fill="#30a030"/><circle cx="32" cy="20" r="2" fill="#3040e8"/></svg>,

  // PueiNet — blue globe
  "pueinet": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="gl1" cx="38%" cy="28%" r="68%"><stop offset="0%" stopColor="#60c8ff"/><stop offset="60%" stopColor="#1860d0"/><stop offset="100%" stopColor="#002080"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#gl1)" stroke="#0040a0" strokeWidth="1"/><ellipse cx="24" cy="24" rx="9" ry="20" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><line x1="4" y1="24" x2="44" y2="24" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/><line x1="24" y1="4" x2="24" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/><ellipse cx="18" cy="17" rx="7" ry="4" fill="rgba(255,255,255,0.2)" transform="rotate(-25 18 17)"/></svg>,

  // Chat — speech bubble green XP messenger style
  "puei-cloud-chat": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="ch1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#80e880"/><stop offset="100%" stopColor="#209020"/></linearGradient></defs><path d="M6 10a4 4 0 014-4h28a4 4 0 014 4v18a4 4 0 01-4 4H28l-8 8v-8H10a4 4 0 01-4-4V10z" fill="url(#ch1)" stroke="#186018" strokeWidth="1"/><rect x="11" y="17" width="8" height="3" rx="1.5" fill="rgba(255,255,255,0.85)"/><rect x="11" y="23" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.85)"/><rect x="11" y="11" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.85)"/><ellipse cx="18" cy="13" rx="9" ry="3" fill="rgba(255,255,255,0.25)"/></svg>,

  // Studio — purple music note / star
  "puei-studio": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="st1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d070ff"/><stop offset="100%" stopColor="#6000a0"/></linearGradient></defs><circle cx="24" cy="24" r="20" fill="url(#st1)" stroke="#40007a" strokeWidth="1"/><path d="M24 10 L27 19 H37 L29 25 L32 34 L24 28 L16 34 L19 25 L11 19 H21 Z" fill="#ffe860" stroke="#c09020" strokeWidth="0.8"/><ellipse cx="20" cy="18" rx="6" ry="3.5" fill="rgba(255,255,255,0.25)" transform="rotate(-20 20 18)"/></svg>,

  // App Store — colorful star on teal
  "app-store": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="as1" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#60e8d0"/><stop offset="100%" stopColor="#008070"/></radialGradient></defs><rect x="4" y="4" width="40" height="40" rx="8" fill="url(#as1)" stroke="#006050" strokeWidth="1"/><path d="M24 9 L27 18 H37 L29 24 L32 33 L24 27 L16 33 L19 24 L11 18 H21 Z" fill="#fff060" stroke="#c0a000" strokeWidth="0.8"/><ellipse cx="20" cy="17" rx="5" ry="3" fill="rgba(255,255,255,0.3)" transform="rotate(-15 20 17)"/></svg>,

  // Social — two people, XP-style colorful
  "puei-social": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="so1" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#ff9060"/><stop offset="100%" stopColor="#c02000"/></radialGradient></defs><circle cx="18" cy="16" r="7" fill="#ffe0b0" stroke="#c08040" strokeWidth="1"/><path d="M4 40c0-8 6-13 14-13s14 5 14 13z" fill="#ffe0b0" stroke="#c08040" strokeWidth="1"/><circle cx="32" cy="14" r="6" fill="#d0e8ff" stroke="#6090c0" strokeWidth="1" opacity="0.95"/><path d="M24 38c0-6 4-10 10-10s10 4 10 10z" fill="#d0e8ff" stroke="#6090c0" strokeWidth="1" opacity="0.95"/><ellipse cx="15" cy="13" rx="4" ry="2.5" fill="rgba(255,255,255,0.4)"/></svg>,

  // Folder — regular folder (same as file-explorer style but slightly different)
  "folder": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="fo1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd840"/><stop offset="100%" stopColor="#c07800"/></linearGradient><linearGradient id="fo2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe870"/><stop offset="100%" stopColor="#d09000"/></linearGradient></defs><path d="M4 18a3 3 0 013-3h8l4 3h22a3 3 0 013 3v14a3 3 0 01-3 3H7a3 3 0 01-3-3V18z" fill="url(#fo1)" stroke="#a06000" strokeWidth="0.8"/><path d="M4 16a3 3 0 013-3h8l4 3z" fill="url(#fo2)" stroke="#a06000" strokeWidth="0.8"/><ellipse cx="20" cy="20" rx="12" ry="3" fill="rgba(255,255,255,0.3)"/></svg>,

  // Recycle Bin — green recycling arrows on white bin
  "recycle-bin": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="rb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8f0e8"/><stop offset="100%" stopColor="#b0c0b0"/></linearGradient></defs><path d="M10 18h28l-3 24H13z" fill="url(#rb1)" stroke="#808880" strokeWidth="1.2"/><path d="M6 14h36" stroke="#707870" strokeWidth="2" strokeLinecap="round"/><path d="M16 14V10h16v4" fill="none" stroke="#707870" strokeWidth="1.5"/><path d="M19 26 L24 21 L29 26" fill="none" stroke="#30a030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M24 21 v8" stroke="#30a030" strokeWidth="2" strokeLinecap="round"/></svg>,

  // Chess — black/white board with knight
  "chess": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="cb1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0d090"/><stop offset="100%" stopColor="#c09050"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="3" fill="url(#cb1)" stroke="#806030" strokeWidth="1.2"/>{[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>(r+c)%2===0?<rect key={`${r}${c}`} x={4+c*8} y={4+r*8} width="8" height="8" fill="#c08848"/>:null))}<path d="M20 34v-4l-2-3 1-2 2-1 3-1 2 1 2 3-1 4-3 3z" fill="white" stroke="#606060" strokeWidth="0.8"/><rect x="17" y="34" width="10" height="3" rx="1" fill="white" stroke="#606060" strokeWidth="0.8"/><path d="M22 24 Q26 20 28 22 Q26 26 24 24z" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5"/></svg>,

  // Mansion — colorful house
  "puei-mansion": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="mn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e06060"/><stop offset="100%" stopColor="#a02020"/></linearGradient><linearGradient id="mn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0f0e0"/><stop offset="100%" stopColor="#c0c0a0"/></linearGradient></defs><polygon points="24,4 44,20 40,20 40,44 8,44 8,20 4,20" fill="url(#mn1)" stroke="#801010" strokeWidth="1"/><rect x="10" y="20" width="28" height="24" fill="url(#mn2)" stroke="#a0a080" strokeWidth="0.8"/><rect x="18" y="30" width="12" height="14" rx="1" fill="#90c0e8" stroke="#6090b0" strokeWidth="0.8"/><rect x="12" y="24" width="8" height="8" rx="1" fill="#90c0e8" stroke="#6090b0" strokeWidth="0.8"/><rect x="28" y="24" width="8" height="8" rx="1" fill="#90c0e8" stroke="#6090b0" strokeWidth="0.8"/><ellipse cx="24" cy="12" rx="10" ry="3" fill="rgba(255,180,180,0.4)"/></svg>,

  // About — blue info circle
  "about": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="ab1" cx="38%" cy="28%" r="68%"><stop offset="0%" stopColor="#70b8ff"/><stop offset="100%" stopColor="#0040c0"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#ab1)" stroke="#002890" strokeWidth="1.2"/><circle cx="24" cy="15" r="3" fill="white"/><rect x="21" y="21" width="6" height="13" rx="2" fill="white"/><ellipse cx="19" cy="16" rx="5" ry="3" fill="rgba(255,255,255,0.3)" transform="rotate(-30 19 16)"/></svg>,

  // ISO Viewer — shiny disc
  "iso-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="iso1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f0f0f0"/><stop offset="40%" stopColor="#c8d8f8"/><stop offset="70%" stopColor="#a0c0f0"/><stop offset="100%" stopColor="#8090c0"/></radialGradient><radialGradient id="iso2" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="rgba(255,255,255,0.9)"/><stop offset="100%" stopColor="rgba(180,220,255,0)"/></radialGradient></defs><circle cx="24" cy="24" r="20" fill="url(#iso1)" stroke="#8090b0" strokeWidth="1"/><circle cx="24" cy="24" r="5" fill="#d0d0e0" stroke="#9090a8" strokeWidth="1"/><circle cx="24" cy="24" r="2.5" fill="white"/><ellipse cx="18" cy="16" rx="7" ry="4" fill="url(#iso2)" transform="rotate(-30 18 16)"/></svg>,

  // ZIP Viewer — folder with zipper
  "zip-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="zp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#80c0f8"/><stop offset="100%" stopColor="#2060c0"/></linearGradient></defs><path d="M6 10a3 3 0 013-3h20l8 8v26a3 3 0 01-3 3H9a3 3 0 01-3-3V10z" fill="url(#zp1)" stroke="#1040a0" strokeWidth="1"/><path d="M29 7v8h8" fill="none" stroke="#1040a0" strokeWidth="1.2"/><rect x="20" y="14" width="8" height="3" rx="1" fill="white" opacity="0.7"/><rect x="20" y="19" width="8" height="3" rx="1" fill="#b0d0ff" opacity="0.7"/><rect x="20" y="24" width="8" height="3" rx="1" fill="white" opacity="0.7"/><rect x="20" y="29" width="8" height="3" rx="1" fill="#b0d0ff" opacity="0.7"/><rect x="20" y="34" width="8" height="3" rx="1" fill="white" opacity="0.7"/><rect x="9" y="9" width="14" height="3" rx="1" fill="rgba(255,255,255,0.4)"/></svg>,

  // PMail — envelope, XP Outlook Express style
  "pmail": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="pm1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0f8ff"/><stop offset="100%" stopColor="#b0d0f0"/></linearGradient><linearGradient id="pm2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#60a8e8"/><stop offset="100%" stopColor="#2060c0"/></linearGradient></defs><rect x="4" y="10" width="40" height="28" rx="3" fill="url(#pm1)" stroke="#6090c0" strokeWidth="1.2"/><path d="M4 12l20 14 20-14" fill="none" stroke="#2060c0" strokeWidth="1.5"/><polygon points="4,38 18,26 4,12" fill="url(#pm2)" opacity="0.35"/><polygon points="44,38 30,26 44,12" fill="url(#pm2)" opacity="0.35"/><rect x="4" y="10" width="40" height="6" rx="3" fill="rgba(255,255,255,0.5)"/></svg>,

  // Web App — browser window
  "web-app": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="wa1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5090e0"/><stop offset="100%" stopColor="#1040a0"/></linearGradient><linearGradient id="wa2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8f8ff"/><stop offset="100%" stopColor="#d8e0f0"/></linearGradient></defs><rect x="3" y="6" width="42" height="36" rx="4" fill="url(#wa1)" stroke="#082880" strokeWidth="1"/><rect x="3" y="6" width="42" height="12" rx="4" fill="url(#wa2)"/><rect x="3" y="14" width="42" height="4" fill="url(#wa2)"/><circle cx="10" cy="12" r="3" fill="#e04040"/><circle cx="18" cy="12" r="3" fill="#e0c030"/><circle cx="26" cy="12" r="3" fill="#30c040"/><rect x="32" y="9" width="10" height="6" rx="2" fill="rgba(255,255,255,0.3)"/><rect x="8" y="24" width="32" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"/><rect x="8" y="30" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.35)"/><rect x="8" y="36" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.25)"/></svg>,

  // Puei Space — rocket/spaceship
  "pueyracing": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="rs1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8f0ff"/><stop offset="100%" stopColor="#8090d0"/></linearGradient><linearGradient id="rs2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff9040"/><stop offset="100%" stopColor="#ff3000"/></linearGradient></defs><path d="M24 4 C24 4 16 14 16 26 L20 28 L24 30 L28 28 L32 26 C32 14 24 4 24 4z" fill="url(#rs1)" stroke="#6070b0" strokeWidth="1"/><ellipse cx="24" cy="18" rx="5" ry="6" fill="#80c8ff" stroke="#4090d0" strokeWidth="0.8" opacity="0.8"/><path d="M16 26 L8 32 L12 30 L16 30z" fill="#c03020" stroke="#801010" strokeWidth="0.8"/><path d="M32 26 L40 32 L36 30 L32 30z" fill="#c03020" stroke="#801010" strokeWidth="0.8"/><ellipse cx="24" cy="32" rx="5" ry="3" fill="#ff8020" stroke="#c04000" strokeWidth="0.8"/><ellipse cx="24" cy="36" rx="4" ry="6" fill="url(#rs2)" opacity="0.85"/><ellipse cx="22" cy="14" rx="3" ry="5" fill="rgba(255,255,255,0.4)" transform="rotate(-15 22 14)"/></svg>,
};

// Win7 color map for gradient background boxes
const WIN7_COLOR: Partial<Record<AppId, [string, string]>> = {
  "settings":        ["#c0c8e0", "#6878a0"],
  "file-explorer":   ["#ffe080", "#d08800"],
  "notepad":         ["#e8eeff", "#6080c0"],
  "calculator":      ["#90d090", "#286028"],
  "puei-paint":      ["#ffb0d0", "#c02060"],
  "puei-board":      ["#d4a870", "#7a4820"],
  "pueinet":         ["#60c0ff", "#1050c0"],
  "puei-cloud-chat": ["#80e890", "#207030"],
  "puei-studio":     ["#c878ff", "#6800b0"],
  "app-store":       ["#50e8c8", "#007860"],
  "puei-social":     ["#ffa060", "#c03010"],
  "folder":          ["#ffe060", "#b07000"],
  "recycle-bin":     ["#c8e8c0", "#507050"],
  "chess":           ["#f0d890", "#806020"],
  "puei-mansion":    ["#f08080", "#a01818"],
  "about":           ["#70b8ff", "#0838b8"],
  "iso-viewer":      ["#c8d8f8", "#4060a0"],
  "zip-viewer":      ["#80b8f8", "#1848b0"],
  "pmail":           ["#a8d8ff", "#1860c0"],
  "web-app":         ["#4898e8", "#0840a8"],
  "pueyracing":      ["#a0c8f8", "#2050a0"],
};

export function appIcon(appId: AppId, size = 32, override?: string, iconUrl?: string) {
  const s = size;
  const radius = Math.round(s * 0.22);

  const isImg = typeof override === "string" && override.startsWith("data:");
  const useUrl = !isImg && !override && !!iconUrl;
  const fallbackIconUrl = (() => {
    if (!iconUrl) return "";
    const duckMatch = iconUrl.match(/\/ip3\/([^/?]+)\.ico/i);
    const host = duckMatch?.[1];
    if (!host) return "";
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, Math.round(s))}&domain_url=${encodeURIComponent(`https://${host}`)}`;
  })();
  const [c1, c2] = WIN7_COLOR[appId] ?? ["#8090c8", "#2840a0"];
  const customSvg = APP_ICON_SVGS[appId]?.(Math.round(s * 0.62));

  const iconBox = (children: React.ReactNode) => (
    <div style={{
      width: s, height: s, borderRadius: radius, flexShrink: 0, position: "relative", overflow: "hidden",
      background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`,
      boxShadow: `0 ${Math.round(s*0.06)}px ${Math.round(s*0.25)}px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.55)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {children}
      {/* Win7 glass gloss overlay */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "52%", borderRadius: `${radius}px ${radius}px 50% 50%`, background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 100%)", pointerEvents: "none" }} />
    </div>
  );

  // Win7 style: colored gradient box with gloss, icon centered at ~62% size
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
