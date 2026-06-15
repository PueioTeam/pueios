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

// Custom SVG icons per app — Win7 glass style with colored gradient background
const APP_ICON_SVGS: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  "settings": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>,
  "file-explorer": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/><path d="M3 9h18" stroke="rgba(255,200,100,0.8)" strokeWidth="1.5"/></svg>,
  "notepad": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" fill="rgba(255,255,255,0.9)" stroke="rgba(200,200,255,0.4)" strokeWidth="0.8"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#4080d0" strokeWidth="1.8" strokeLinecap="round"/><rect x="9" y="1" width="6" height="3" rx="1" fill="rgba(255,255,255,0.7)"/></svg>,
  "calculator": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><rect x="6" y="5" width="12" height="4" rx="1" fill="rgba(255,255,255,0.5)"/><circle cx="8" cy="14" r="1.2" fill="white"/><circle cx="12" cy="14" r="1.2" fill="white"/><circle cx="16" cy="14" r="1.2" fill="white"/><circle cx="8" cy="18" r="1.2" fill="white"/><circle cx="12" cy="18" r="1.2" fill="white"/><rect x="14.5" y="16.5" width="3" height="3" rx="0.8" fill="rgba(0,220,180,0.9)"/></svg>,
  "puei-paint": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="10" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/><circle cx="9" cy="9" r="1.8" fill="#ff6eb0"/><circle cx="13" cy="8" r="1.8" fill="#ffda44"/><circle cx="11" cy="12" r="1.8" fill="#44aaff"/><path d="M14 16c1-1 3-0.5 4 1s-1 4-3 3.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 17l-2 4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  "puei-board": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="10" rx="1.5" fill="rgba(255,255,255,0.8)"/><rect x="13" y="3" width="8" height="6" rx="1.5" fill="rgba(255,200,200,0.8)"/><rect x="13" y="11" width="8" height="10" rx="1.5" fill="rgba(200,255,200,0.8)"/><rect x="3" y="15" width="8" height="6" rx="1.5" fill="rgba(200,200,255,0.8)"/><circle cx="7" cy="5.5" r="1.5" fill="#ff4060"/><line x1="7" y1="7" x2="7" y2="11" stroke="#ff4060" strokeWidth="1.5"/></svg>,
  "pueinet": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/><path d="M12 3c-2 3-3 5.5-3 9s1 6 3 9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M12 3c2 3 3 5.5 3 9s-1 6-3 9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M3 12h18" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M4.5 7.5h15M4.5 16.5h15" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/></svg>,
  "puei-cloud-chat": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 3V6z" fill="rgba(255,255,255,0.9)"/><circle cx="8.5" cy="10.5" r="1.2" fill="#4a9040"/><circle cx="12" cy="10.5" r="1.2" fill="#4a9040"/><circle cx="15.5" cy="10.5" r="1.2" fill="#4a9040"/></svg>,
  "puei-studio": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M12 4L20 18H4L12 4z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 17C8 12 11 9 12 7c1 2 4 5 5 10" stroke="rgba(220,180,255,0.8)" strokeWidth="1" strokeLinecap="round"/><circle cx="12" cy="14" r="2.5" fill="rgba(255,255,255,0.7)"/></svg>,
  "app-store": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5 5.5 0.8-4 3.9 0.9 5.5L12 15.7l-4.9 2.5 0.9-5.5-4-3.9 5.5-0.8z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,200,100,0.5)" strokeWidth="0.5"/></svg>,
  "puei-social": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" fill="rgba(255,255,255,0.85)"/><circle cx="5" cy="14" r="2.5" fill="rgba(255,255,255,0.65)"/><circle cx="19" cy="14" r="2.5" fill="rgba(255,255,255,0.65)"/><path d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round"/><path d="M2 21c0-1.6 1.3-3 2.8-3.3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"/><path d="M22 21c0-1.6-1.3-3-2.8-3.3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  "folder": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" fill="rgba(255,255,255,0.9)"/><path d="M3 10h18" stroke="rgba(200,140,40,0.7)" strokeWidth="1.2"/></svg>,
  "recycle-bin": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 11v5M14 11v5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  "chess": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>{([0,2,4,6,1,3,5,7] as number[]).map(col=>[0,2,4,6].filter(row=>(col+row/2)%2===0).map(row=><rect key={`${col}${row}`} x={3+col*2.25} y={3+row*2.25} width="2.25" height="2.25" fill="rgba(255,255,255,0.55)"/>))}<path d="M10 17V14l-1-2 1-1h4l1 1-1 2v3H10z" fill="rgba(255,255,255,0.9)"/><rect x="9.5" y="17" width="5" height="1.5" rx="0.5" fill="rgba(255,255,255,0.9)"/></svg>,
  "puei-mansion": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M3 20h18M5 20V10L12 4l7 6v10" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round"/><rect x="9" y="14" width="6" height="6" rx="0.5" fill="rgba(255,255,255,0.3)"/><rect x="7" y="10" width="3" height="3" rx="0.5" fill="rgba(200,180,255,0.5)"/><rect x="14" y="10" width="3" height="3" rx="0.5" fill="rgba(200,180,255,0.5)"/></svg>,
  "about": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5"/><path d="M12 8v1M12 11v6" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>,
  "iso-viewer": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"/><circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.5)"/><ellipse cx="12" cy="12" rx="8" ry="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/></svg>,
  "zip-viewer": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M5 3h9l5 5v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2"/><path d="M14 3v5h5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/><path d="M10 8h4v2h-4zM10 10v2h4v-2M10 12v2h4v-2M10 14v3h4v-3" stroke="none" fill="rgba(255,255,255,0.6)"/><rect x="10" y="8" width="4" height="2" fill="rgba(255,255,255,0.5)"/><rect x="10" y="11" width="4" height="2" fill="rgba(255,255,255,0.3)"/><rect x="10" y="14" width="4" height="3" fill="rgba(255,255,255,0.5)"/></svg>,
  "pmail": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3"/><path d="M3 8l9 6 9-6" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3"/></svg>,
  "web-app": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2"/><path d="M3 8h18" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/><circle cx="6.5" cy="6" r="1" fill="rgba(255,120,120,0.8)"/><circle cx="9.5" cy="6" r="1" fill="rgba(255,200,80,0.8)"/><circle cx="12.5" cy="6" r="1" fill="rgba(100,220,100,0.8)"/><rect x="6" y="11" width="12" height="1.5" rx="0.7" fill="rgba(255,255,255,0.4)"/><rect x="6" y="14" width="8" height="1.5" rx="0.7" fill="rgba(255,255,255,0.3)"/></svg>,
  "pueyracing": (s) => <svg width={s*0.62} height={s*0.62} viewBox="0 0 24 24" fill="none"><path d="M12 2 L15 8 L12 7 L9 8 Z" fill="rgba(255,255,255,0.9)"/><rect x="10.5" y="7" width="3" height="9" rx="1.5" fill="rgba(180,220,255,0.9)"/><path d="M10.5 9 L6 13 L6 15 L10.5 13Z" fill="rgba(255,255,255,0.65)"/><path d="M13.5 9 L18 13 L18 15 L13.5 13Z" fill="rgba(255,255,255,0.65)"/><ellipse cx="12" cy="16.5" rx="1.5" ry="2" fill="rgba(255,140,0,0.9)"/><circle cx="12" cy="18.5" rx="1" ry="1.2" fill="rgba(255,200,80,0.7)"/></svg>,
};

export function appIcon(appId: AppId, size = 32, override?: string, iconUrl?: string) {
  const s = size;
  // Win7-style per-app gradient colors
  const colorMap: Partial<Record<AppId, [string, string]>> = {
    "settings":       ["#5c6e8a","#2e3d52"],
    "file-explorer":  ["#f0a020","#c05800"],
    "notepad":        ["#3a8fe0","#1040a0"],
    "calculator":     ["#1abccc","#007088"],
    "puei-paint":     ["#d03880","#780048"],
    "puei-board":     ["#e04040","#900010"],
    "pueinet":        ["#1898e0","#0050a0"],
    "puei-cloud-chat":["#40a850","#106020"],
    "puei-studio":    ["#9038b0","#480870"],
    "app-store":      ["#1aa890","#006050"],
    "puei-social":    ["#e05030","#901000"],
    "folder":         ["#e89020","#a05000"],
    "web-app":        ["#5878a0","#283848"],
    "recycle-bin":    ["#608098","#304050"],
    "chess":          ["#785040","#402010"],
    "puei-mansion":   ["#6040b0","#280870"],
    "about":          ["#4858b0","#181858"],
    "iso-viewer":     ["#705840","#382010"],
    "zip-viewer":     ["#607080","#283040"],
    "pmail":          ["#d03030","#800010"],
    "pueyracing":     ["#1848c0","#080830"],
  };
  const [c1, c2] = colorMap[appId] ?? ["#486070","#203040"];

  const isImg = typeof override === "string" && override.startsWith("data:");
  const useUrl = !isImg && !override && !!iconUrl;
  const fallbackIconUrl = (() => {
    if (!iconUrl) return "";
    const duckMatch = iconUrl.match(/\/ip3\/([^/?]+)\.ico/i);
    const host = duckMatch?.[1];
    if (!host) return "";
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, Math.round(s))}&domain_url=${encodeURIComponent(`https://${host}`)}`;
  })();
  const radius = Math.round(s * 0.2);
  const customSvg = APP_ICON_SVGS[appId]?.(s);
  return (
    <div
      className="flex items-center justify-center overflow-hidden relative"
      style={{
        width: s, height: s,
        borderRadius: radius,
        background: isImg || useUrl ? "transparent" : `linear-gradient(145deg, ${c1} 0%, ${c2} 100%)`,
        boxShadow: `0 ${Math.round(s*0.06)}px ${Math.round(s*0.18)}px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)`,
        flexShrink: 0,
      }}
    >
      {isImg
        ? <img src={override} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius }} />
        : useUrl
          ? <>
              <img
                src={iconUrl}
                alt=""
                data-fallback={fallbackIconUrl}
                style={{ width: "78%", height: "78%", objectFit: "contain" }}
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
              <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>{customSvg}</div>
            </>
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>{customSvg}</div>}
      {/* Win7-style gloss overlay */}
      {!isImg && !useUrl && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: "45%", borderRadius: `${radius}px ${radius}px 50% 50%`,
          background: "linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 100%)",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}
