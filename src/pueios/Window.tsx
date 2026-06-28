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
  win, focused, peek, fullWindowTransparency, systemVersion, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children,
}: {
  win: WindowState;
  focused: boolean;
  peek?: boolean;
  fullWindowTransparency?: boolean;
  systemVersion?: string;
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
        borderRadius: systemVersion === "PueiOS 1" ? 4 : 8,
        border: systemVersion === "PueiOS 1"
          ? (focused ? "2px solid #0078d7" : "2px solid #888")
          : focused
          ? "1px solid var(--border)"
          : "1px solid color-mix(in oklch, var(--border) 55%, transparent)",
        boxShadow: systemVersion === "PueiOS 1"
          ? "2px 2px 8px rgba(0,0,0,0.4)"
          : focused
          ? "0 8px 40px color-mix(in oklch, var(--accent) 30%, transparent), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.75)"
          : "0 4px 20px rgba(0,20,80,0.35), 0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
        transition: drag.current || resz.current ? "none" : "opacity 0.15s, box-shadow 0.2s, transform 0.12s",
        transform: peek ? "translateY(2px) scale(0.995)" : "none",
        pointerEvents: peek ? "none" : "auto",
      }}
      onMouseDown={onFocus}
    >
      {/* Title bar — macOS style for PueiOS 1, Win7 style otherwise */}
      {systemVersion === "PueiOS 1" ? (
        <div
          className="flex items-center select-none"
          onPointerDown={onTitleDown}
          onPointerMove={onTitleMove}
          onPointerUp={onTitleUp}
          onDoubleClick={onMaximize}
          style={{
            cursor: win.maximized ? "default" : "move",
            touchAction: "none",
            minHeight: 30,
            padding: "0 10px",
            background: focused
              ? "linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)"
              : "linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)",
            borderBottom: "1px solid #b0b0b0",
          }}
        >
          {/* Spacer to balance the buttons on the right */}
          <div style={{ width: 54 }} />
          {/* Centered title */}
          <div style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: focused ? "#222" : "#888", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: 0.1, pointerEvents: "none" }}>
            {win.title}
          </div>
          {/* Traffic-light buttons on right */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 10 }}>
            <button title={win.maximized ? "Restore" : "Maximize"} onClick={(e) => { e.stopPropagation(); onMaximize(); }}
              style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840", border: "1px solid #1aab29", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "transparent", lineHeight: 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#006300"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "transparent"; }}
            >+</button>
            <button title="Minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }}
              style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e", border: "1px solid #e0a116", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "transparent", lineHeight: 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#7a5500"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "transparent"; }}
            >─</button>
            <button title="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57", border: "1px solid #e0443e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "transparent", lineHeight: 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#7a0000"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "transparent"; }}
            >✕</button>
          </div>
        </div>
      ) : (
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
            background: fullWindowTransparency
              ? focused
                ? "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, var(--glass-strong) 28%, var(--glass) 60%, transparent 100%), var(--titlebar)"
                : "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, var(--glass) 50%, transparent 100%), var(--titlebar)"
              : focused
                ? "linear-gradient(180deg, var(--accent-2) 0%, var(--accent) 100%)"
                : "linear-gradient(180deg, oklch(0.55 0.08 var(--accent-h,220)) 0%, oklch(0.42 0.10 var(--accent-h,220)) 100%)",
            borderBottom: "1px solid var(--border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 2px 6px rgba(255,255,255,0.3)",
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold truncate"
            style={{ color: fullWindowTransparency ? (focused ? "var(--titlebar-text)" : "rgba(80,80,110,0.8)") : "white", textShadow: fullWindowTransparency ? "0 1px 2px rgba(255,255,255,0.7)" : "0 1px 2px rgba(0,0,0,0.4)" }}>
            <span>{win.title}</span>
          </div>
          <div className="flex items-center" style={{ gap: 2, paddingLeft: 4 }}>
            <button title="Minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }}
              style={{ width: 26, height: 20, fontSize: 12, fontWeight: "bold", background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(205,225,255,0.75) 45%, rgba(170,210,255,0.65) 50%, rgba(200,225,255,0.72) 100%)", border: "1px solid rgba(100,150,220,0.45)", borderRadius: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(0,0,0,0.1)", color: "#444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >─</button>
            <button title={win.maximized ? "Restore" : "Maximize"} onClick={(e) => { e.stopPropagation(); onMaximize(); }}
              style={{ width: 26, height: 20, fontSize: 10, fontWeight: "bold", background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(205,225,255,0.75) 45%, rgba(170,210,255,0.65) 50%, rgba(200,225,255,0.72) 100%)", border: "1px solid rgba(100,150,220,0.45)", borderRadius: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(0,0,0,0.1)", color: "#444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >{win.maximized ? "❐" : "☐"}</button>
            <button title="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ width: 28, height: 20, fontSize: 11, fontWeight: "bold", background: "linear-gradient(180deg, #f77 0%, #e44 45%, #c22 50%, #d44 100%)", border: "1px solid rgba(160,30,30,0.6)", borderRadius: 4, boxShadow: "inset 0 1px 0 rgba(255,200,200,0.8), 0 1px 3px rgba(0,0,0,0.2)", color: "white", textShadow: "0 1px 1px rgba(0,0,0,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >✕</button>
          </div>
        </div>
      )}
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


// macOS Panther aqua gel icons — polished, no <defs> to avoid DOM ID collisions
const APP_ICON_SVGS: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  "settings": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#5868a0"/><circle cx="24" cy="24" r="22" fill="rgba(80,110,200,0.45)"/>{[0,45,90,135,180,225,270,315].map(a=>{const r=14,x=24+r*Math.cos(a*Math.PI/180),y=24+r*Math.sin(a*Math.PI/180);return<circle key={a} cx={x} cy={y} r="3.8" fill="#d0d8f0"/>})}<circle cx="24" cy="24" r="9" fill="#2858c8"/><circle cx="24" cy="24" r="9" fill="rgba(255,255,255,0.22)"/><circle cx="24" cy="24" r="4" fill="#9ab0e8"/><ellipse cx="19" cy="9" rx="10" ry="4" fill="rgba(255,255,255,0.58)"/></svg>,
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="2" y="14" width="44" height="30" rx="5" fill="#3070cc"/><rect x="2" y="14" width="44" height="30" rx="5" fill="rgba(255,255,255,0.13)"/><path d="M2 18a5 5 0 015-5h12l4 5z" fill="#2044a8"/><rect x="5" y="18" width="38" height="23" rx="3" fill="#c0ddff"/><rect x="8" y="21" width="10" height="8" rx="2" fill="white" opacity="0.95"/><rect x="20" y="21" width="20" height="3" rx="1.5" fill="white" opacity="0.7"/><rect x="20" y="26" width="14" height="2.5" rx="1.2" fill="white" opacity="0.5"/><rect x="8" y="31" width="32" height="2" rx="1" fill="rgba(40,90,200,0.28)"/><rect x="8" y="35" width="22" height="2" rx="1" fill="rgba(40,90,200,0.22)"/><ellipse cx="22" cy="17" rx="17" ry="4.5" fill="rgba(255,255,255,0.52)"/></svg>,
  "notepad": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="5" y="2" width="38" height="44" rx="4" fill="#f5f8ff"/><rect x="5" y="2" width="38" height="44" rx="4" fill="rgba(255,255,255,0.4)"/><rect x="5" y="2" width="38" height="8" rx="4" fill="#5580e8"/><rect x="5" y="7" width="38" height="3" fill="#5580e8"/><line x1="15" y1="2" x2="15" y2="46" stroke="#ff8888" strokeWidth="2.2"/><line x1="12" y1="2" x2="12" y2="46" stroke="#ffbbbb" strokeWidth="1"/>{[13,18,23,28,33,38,43].map(y=><line key={y} x1="5" x2="43" y1={y} y2={y} stroke="#b8ccf0" strokeWidth="1"/>)}<text x="20" y="7.5" fontSize="5.5" fill="white" fontFamily="sans-serif" fontWeight="bold">Notepad</text><ellipse cx="24" cy="6" rx="14" ry="3.5" fill="rgba(255,255,255,0.45)"/></svg>,
  "calculator": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="4" y="2" width="40" height="44" rx="7" fill="#4a5270"/><rect x="4" y="2" width="40" height="44" rx="7" fill="rgba(255,255,255,0.12)"/><rect x="8" y="6" width="32" height="11" rx="3" fill="#1a2a18"/><rect x="8" y="6" width="32" height="5" rx="3" fill="rgba(60,200,60,0.18)"/><text x="38" y="16" textAnchor="end" fontSize="8" fill="#44ff44" fontFamily="monospace" fontWeight="bold">0</text>{[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const isRed=r===3&&c===3,isOp=c===3&&r<3,isDark=r===0;return<rect key={`${r}${c}`} x={9+c*8} y={20+r*6} width="6.5" height="5" rx="1.5" fill={isRed?"#dd2222":isOp?"#6688cc":isDark?"#384060":"#8898c8"} opacity="0.97"/>}))} <ellipse cx="24" cy="9" rx="13" ry="3.5" fill="rgba(255,255,255,0.35)"/></svg>,
  "puei-paint": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><ellipse cx="21" cy="28" rx="19" ry="15" fill="#e0d8a8"/><ellipse cx="21" cy="28" rx="19" ry="15" fill="rgba(255,255,255,0.22)"/>{[["#ee1111",11,26],["#11cc11",19,16],["#1133ff",31,18],["#ffcc00",33,30],["#cc11cc",15,34]].map(([c,cx,cy])=><><circle key={`${cx}o`} cx={cx} cy={cy} r="5.5" fill={c}/><circle key={`${cx}h`} cx={cx-1.5} cy={cy-2} r="2.5" fill="rgba(255,255,255,0.65)"/></>)}<path d="M37 7 Q43 3 45 11 Q47 18 41 20 L37 18 Q33 13 37 7z" fill="#c06508"/><rect x="39" y="19" width="4" height="14" rx="2" fill="#dda840" transform="rotate(18 41 19)"/><ellipse cx="14" cy="19" rx="13" ry="5" fill="rgba(255,255,255,0.58)" transform="rotate(-15 14 19)"/></svg>,
  "puei-board": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="6" fill="#b88030"/><rect x="3" y="3" width="42" height="42" rx="6" fill="rgba(255,255,255,0.12)"/><rect x="9" y="9" width="13" height="11" rx="2.5" fill="white" opacity="0.95"/><rect x="26" y="9" width="13" height="9" rx="2.5" fill="#ffff88" opacity="0.97"/><rect x="26" y="22" width="13" height="11" rx="2.5" fill="#ffbbbb" opacity="0.97"/><rect x="9" y="24" width="13" height="17" rx="2.5" fill="#bbffcc" opacity="0.97"/><circle cx="15.5" cy="9" r="2.8" fill="#ee1111"/><circle cx="32.5" cy="9" r="2.8" fill="#00bb00"/><circle cx="32.5" cy="22" r="2.8" fill="#1122ee"/><ellipse cx="24" cy="12" rx="19" ry="5.5" fill="rgba(255,255,255,0.4)"/></svg>,
  "pueinet": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="pwebBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#1d40c0"/></linearGradient><linearGradient id="pwebTab" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f472b6"/><stop offset="100%" stopColor="#a855f7"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="10" fill="url(#pwebBg)"/><rect x="2" y="2" width="44" height="44" rx="10" fill="rgba(255,255,255,0.08)"/><rect x="6" y="8" width="36" height="4" rx="2" fill="rgba(0,0,0,0.25)"/><rect x="6" y="8" width="16" height="4" rx="2" fill="url(#pwebTab)"/><rect x="6" y="14" width="36" height="26" rx="3" fill="rgba(255,255,255,0.12)"/><text x="24" y="34" textAnchor="middle" fontSize="20" fontWeight="bold" fontFamily="Arial,sans-serif" fill="white" letterSpacing="-1">W</text><ellipse cx="24" cy="10" rx="14" ry="3" fill="rgba(255,255,255,0.3)"/></svg>,
  "puei-cloud-chat": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><path d="M5 9a5 5 0 015-5h28a5 5 0 015 5v17a5 5 0 01-5 5H30l-7 8v-8H10a5 5 0 01-5-5z" fill="#00a870"/><path d="M5 9a5 5 0 015-5h28a5 5 0 015 5v17a5 5 0 01-5 5H30l-7 8v-8H10a5 5 0 01-5-5z" fill="rgba(255,255,255,0.14)"/><circle cx="16" cy="18" r="4.5" fill="rgba(255,255,255,0.92)"/><circle cx="24" cy="18" r="4.5" fill="rgba(255,255,255,0.92)"/><circle cx="32" cy="18" r="4.5" fill="rgba(255,255,255,0.92)"/><ellipse cx="24" cy="8" rx="17" ry="4.5" fill="rgba(255,255,255,0.42)"/></svg>,
  "puei-studio": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="10" fill="#5c1a9e"/><rect x="2" y="2" width="44" height="44" rx="10" fill="rgba(255,255,255,0.1)"/><circle cx="24" cy="18" r="9" fill="none" stroke="#e8a0ff" strokeWidth="2.5"/><circle cx="24" cy="18" r="4" fill="#e8a0ff"/><rect x="21" y="27" width="6" height="12" rx="1.5" fill="#e8a0ff"/><circle cx="16" cy="38" r="3" fill="#cc66ff"/><circle cx="24" cy="40" r="3" fill="#cc66ff"/><circle cx="32" cy="38" r="3" fill="#cc66ff"/><ellipse cx="18" cy="8" rx="11" ry="4" fill="rgba(255,255,255,0.42)" transform="rotate(-18 18 8)"/></svg>,
  "app-store": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="10" fill="#1a7fe8"/><rect x="2" y="2" width="44" height="44" rx="10" fill="rgba(255,255,255,0.16)"/><rect x="2" y="2" width="44" height="22" rx="10" fill="rgba(255,255,255,0.2)"/><path d="M24 10 L28 20 H38 L30 26 L33 36 L24 30 L15 36 L18 26 L10 20 H20 Z" fill="white" opacity="0.97"/><ellipse cx="18" cy="8" rx="11" ry="4.5" fill="rgba(255,255,255,0.52)" transform="rotate(-18 18 8)"/></svg>,
  "puei-social": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="16" cy="16" r="8.5" fill="#ee7700"/><circle cx="16" cy="16" r="8.5" fill="rgba(255,255,255,0.18)"/><path d="M1 43c0-9.5 7-15 15-15s15 5.5 15 15z" fill="#ee7700"/><path d="M1 43c0-9.5 7-15 15-15s15 5.5 15 15z" fill="rgba(255,255,255,0.1)"/><ellipse cx="13" cy="11" rx="7" ry="3.5" fill="rgba(255,255,255,0.52)"/><circle cx="33" cy="14" r="7.5" fill="#2244ee"/><circle cx="33" cy="14" r="7.5" fill="rgba(255,255,255,0.18)"/><path d="M23 41c0-8 5-12 11-12s11 4 11 12z" fill="#2244ee"/><ellipse cx="30" cy="9" rx="6" ry="3" fill="rgba(255,255,255,0.52)"/></svg>,
  "folder": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><path d="M4 17a4 4 0 014-4h8l5 4h23a4 4 0 014 4v16a4 4 0 01-4 4H8a4 4 0 01-4-4z" fill="#eda000"/><path d="M4 17a4 4 0 014-4h8l5 4h23a4 4 0 014 4v16a4 4 0 01-4 4H8a4 4 0 01-4-4z" fill="rgba(255,255,255,0.14)"/><path d="M4 15a3 3 0 013-3h9l5 4z" fill="#c87800"/><ellipse cx="22" cy="19" rx="16" ry="4.5" fill="rgba(255,255,255,0.62)"/></svg>,
  "recycle-bin": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><path d="M10 18h28l-3.5 25H13.5z" fill="#98aec8"/><path d="M10 18h28l-3.5 25H13.5z" fill="rgba(255,255,255,0.2)"/><path d="M5 14h38" stroke="#506070" strokeWidth="3.5" strokeLinecap="round"/><path d="M16 14v-4h16v4" fill="none" stroke="#506070" strokeWidth="2.5"/><path d="M19 28 L24 22 L29 28" fill="none" stroke="#18aa18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M24 22v10" stroke="#18aa18" strokeWidth="3" strokeLinecap="round"/><ellipse cx="24" cy="22" rx="17" ry="5" fill="rgba(255,255,255,0.45)"/></svg>,
  "chess": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="6" fill="#c89030"/><rect x="3" y="3" width="42" height="42" rx="6" fill="rgba(255,255,255,0.1)"/>{[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>(r+c)%2===0?<rect key={`${r}${c}`} x={3+c*8.4} y={3+r*8.4} width="8.4" height="8.4" fill="#986818"/>:null))}<path d="M21 35v-5l-2.5-4 1.5-2.5 3.5-1.5 3.5 1.5 1.5 2.5L26 30v5z" fill="white"/><path d="M21 35v-5l-2.5-4 1.5-2.5 3.5-1.5 3.5 1.5 1.5 2.5L26 30v5z" fill="rgba(0,0,0,0.1)"/><rect x="18" y="35" width="12" height="3.5" rx="1.75" fill="white"/><ellipse cx="24" cy="27" rx="9" ry="3.5" fill="rgba(255,255,255,0.5)"/></svg>,
  "puei-mansion": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><polygon points="24,3 45,20 41,20 41,45 7,45 7,20 3,20" fill="#cc2020"/><polygon points="24,3 45,20 41,20 41,45 7,45 7,20 3,20" fill="rgba(255,255,255,0.12)"/><rect x="9" y="20" width="30" height="25" fill="#f0ece0"/><rect x="18" y="30" width="12" height="15" rx="1.5" fill="#88bbff"/><rect x="10" y="22" width="9" height="9" rx="1.5" fill="#88bbff"/><rect x="29" y="22" width="9" height="9" rx="1.5" fill="#88bbff"/><ellipse cx="24" cy="11" rx="15" ry="5.5" fill="rgba(255,120,120,0.55)"/></svg>,
  "about": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#1840cc"/><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.15)"/><circle cx="24" cy="15" r="4" fill="white"/><rect x="20.5" y="21" width="7" height="14" rx="3.5" fill="white"/><ellipse cx="16" cy="12" rx="12" ry="5" fill="rgba(255,255,255,0.5)" transform="rotate(-28 16 12)"/></svg>,
  "task-manager": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="6" fill="#384858"/><rect x="3" y="3" width="42" height="42" rx="6" fill="rgba(255,255,255,0.1)"/>{[[24,"#3399ff"],[19,"#33dd66"],[13,"#ff5522"],[27,"#ffcc22"]].map(([w,c],i)=><><rect key={`bg${i}`} x="7" y={9+i*9} width="34" height="6" rx="3" fill="rgba(255,255,255,0.14)"/><rect key={`bar${i}`} x="7" y={9+i*9} width={w} height="6" rx="3" fill={c}/></>)}<ellipse cx="24" cy="12" rx="19" ry="5" fill="rgba(255,255,255,0.33)"/></svg>,
  "iso-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#a8b8d8"/><circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.2)"/><circle cx="24" cy="24" r="14" fill="#7078a8"/><circle cx="24" cy="24" r="14" fill="rgba(255,255,255,0.15)"/><circle cx="24" cy="24" r="5.5" fill="#c0c8e0"/><circle cx="24" cy="24" r="2.5" fill="white"/><ellipse cx="17" cy="13" rx="11" ry="4.5" fill="rgba(255,255,255,0.65)" transform="rotate(-30 17 13)"/></svg>,
  "zip-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><path d="M5 9a4 4 0 014-4h21l9 9v29a4 4 0 01-4 4H9a4 4 0 01-4-4z" fill="#2060cc"/><path d="M5 9a4 4 0 014-4h21l9 9v29a4 4 0 01-4 4H9a4 4 0 01-4-4z" fill="rgba(255,255,255,0.14)"/><path d="M30 5v9h9" fill="none" stroke="#0e3ea8" strokeWidth="2"/>{[17,23,28,33,38].map((y,i)=><rect key={y} x="19" y={y} width="10" height="3.5" rx="1.75" fill={i%2===0?"white":"#a8c8ff"} opacity="0.92"/>)}<ellipse cx="19" cy="13" rx="12" ry="4" fill="rgba(255,255,255,0.4)"/></svg>,
  "pmail": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="2" y="8" width="44" height="32" rx="6" fill="#2060d8"/><rect x="2" y="8" width="44" height="32" rx="6" fill="rgba(255,255,255,0.15)"/><rect x="4" y="10" width="40" height="28" rx="5" fill="white" opacity="0.96"/><path d="M4 12 L24 26 L44 12" fill="none" stroke="#2060d8" strokeWidth="2.8" strokeLinejoin="round"/><rect x="4" y="10" width="40" height="4" rx="2" fill="rgba(32,96,216,0.08)"/><ellipse cx="24" cy="13" rx="18" ry="5" fill="rgba(255,255,255,0.55)"/></svg>,
  "web-app": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="2" y="6" width="44" height="37" rx="6" fill="#1040bb"/><rect x="2" y="6" width="44" height="37" rx="6" fill="rgba(255,255,255,0.11)"/><rect x="2" y="6" width="44" height="14" rx="6" fill="#dce8ff"/><rect x="2" y="14" width="44" height="6" fill="#dce8ff"/><circle cx="9" cy="13" r="3.8" fill="#ff3333"/><circle cx="18" cy="13" r="3.8" fill="#ffcc00"/><circle cx="27" cy="13" r="3.8" fill="#33cc33"/><rect x="32" y="9.5" width="12" height="7" rx="3.5" fill="rgba(16,64,187,0.22)"/>{[25,31,37].map((y,i)=><rect key={y} x="8" y={y} width={[34,23,29][i]} height="3" rx="1.5" fill={`rgba(255,255,255,${0.62-i*0.12})`}/>)}<ellipse cx="24" cy="13" rx="20" ry="5.5" fill="rgba(255,255,255,0.48)"/></svg>,
  "computer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="4" y="3" width="40" height="28" rx="3" fill="#c8cce0" stroke="#8890b8" strokeWidth="1.5"/><rect x="7" y="6" width="34" height="22" rx="1.5" fill="#1a2a5a" stroke="#0a1840" strokeWidth="1"/><rect x="8" y="7" width="32" height="20" rx="1" fill="#1e3a8a"/><rect x="9" y="8" width="30" height="18" rx="0.5" fill="#1a3070"/><rect x="9" y="11" width="30" height="1" fill="rgba(255,255,255,0.04)"/><rect x="9" y="14" width="30" height="1" fill="rgba(255,255,255,0.04)"/><rect x="9" y="17" width="30" height="1" fill="rgba(255,255,255,0.04)"/><rect x="9" y="20" width="30" height="1" fill="rgba(255,255,255,0.04)"/><rect x="11" y="10" width="6" height="5" rx="1" fill="#4a90d8" opacity="0.9"/><rect x="19" y="10" width="6" height="5" rx="1" fill="#4a90d8" opacity="0.9"/><rect x="27" y="10" width="6" height="5" rx="1" fill="#4a90d8" opacity="0.9"/><rect x="9" y="22" width="30" height="4" fill="#1155aa"/><rect x="10" y="22.5" width="6" height="3" rx="0.5" fill="#2266cc"/><circle cx="36" cy="24" r="1.2" fill="rgba(255,255,255,0.5)"/><rect x="4" y="29" width="40" height="2" rx="1" fill="#a8aec8" stroke="#7880b0" strokeWidth="0.5"/><circle cx="24" cy="30" r="1" fill="#8890b8"/><rect x="19" y="31" width="10" height="5" rx="1" fill="#b0b4cc" stroke="#8890b8" strokeWidth="1"/><rect x="12" y="36" width="24" height="4" rx="2" fill="#c0c4d8" stroke="#9098c0" strokeWidth="1"/><ellipse cx="24" cy="7" rx="13" ry="3" fill="rgba(255,255,255,0.15)"/></svg>,
  "pueyracing": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" fill="#08102e"/>{[[8,8,1.2],[38,6,1.5],[14,36,0.9],[42,30,1.2],[6,22,0.8],[30,40,1.1],[20,46,0.7],[44,16,1]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity={0.58+i*0.05}/>)}<path d="M24 6 C24 6 15 17 15 29 L19 31 L24 33 L29 31 L33 29 C33 17 24 6 24 6z" fill="#b8caee"/><ellipse cx="24" cy="19" rx="5.5" ry="7" fill="#77bbff" opacity="0.95"/><path d="M15 29 L8 36 L12 33 L15 33z" fill="#4858a0"/><path d="M33 29 L40 36 L36 33 L33 33z" fill="#4858a0"/><ellipse cx="24" cy="35" rx="5" ry="2.5" fill="#ff8820"/><ellipse cx="24" cy="40" rx="4" ry="7" fill="#ff4400" opacity="0.92"/><ellipse cx="20" cy="12" rx="4.5" ry="6.5" fill="rgba(255,255,255,0.6)" transform="rotate(-15 20 12)"/></svg>,
  "puei-game": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect x="3" y="10" width="42" height="28" rx="8" fill="#1a8f1a"/><rect x="3" y="10" width="42" height="28" rx="8" fill="rgba(255,255,255,0.12)"/><rect x="8" y="19" width="9" height="3" rx="1.5" fill="white" opacity="0.9"/><rect x="11.5" y="15.5" width="3" height="9" rx="1.5" fill="white" opacity="0.9"/><circle cx="37" cy="18" r="2.5" fill="white" opacity="0.9"/><circle cx="41" cy="22" r="2.5" fill="white" opacity="0.9"/><circle cx="33" cy="22" r="2.5" fill="white" opacity="0.9"/><circle cx="37" cy="26" r="2.5" fill="white" opacity="0.9"/><rect x="17" y="22" width="14" height="4" rx="2" fill="rgba(0,0,0,0.28)"/><ellipse cx="24" cy="14" rx="17" ry="4.5" fill="rgba(255,255,255,0.42)"/></svg>,
};

// PueiOS 1 — Windows XP style icons: 3D glossy, colorful, with highlights and shadows
const APP_ICON_SVGS_P1: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  "settings": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="xpsg1" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#e8e8e8"/><stop offset="100%" stopColor="#9098b0"/></radialGradient></defs><circle cx="24" cy="24" r="13" fill="url(#xpsg1)" stroke="#6070a0" strokeWidth="1.5"/><circle cx="24" cy="24" r="5" fill="#b8c0d8" stroke="#5060a0" strokeWidth="1.5"/><circle cx="24" cy="24" r="2" fill="#6878a8"/>{[0,60,120,180,240,300].map(a=>{const rad=a*Math.PI/180,x=24+10*Math.cos(rad),y=24+10*Math.sin(rad);return<circle key={a} cx={x} cy={y} r="3" fill="#7880a8" stroke="#5060a0" strokeWidth="1"/>})}<ellipse cx="21" cy="19" rx="5" ry="2.5" fill="rgba(255,255,255,0.5)" transform="rotate(-20 21 19)"/></svg>,
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpfe1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#c88000"/></linearGradient><linearGradient id="xpfe2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffe880"/><stop offset="100%" stopColor="#e8a800"/></linearGradient></defs><path d="M4 20a3 3 0 013-3h9l4-4h22a3 3 0 013 3v18a3 3 0 01-3 3H7a3 3 0 01-3-3z" fill="url(#xpfe1)" stroke="#b07000" strokeWidth="1.5"/><path d="M4 18h14l4-4h24v4z" fill="url(#xpfe2)" stroke="#b07000" strokeWidth="1"/><rect x="10" y="22" width="9" height="9" rx="1.5" fill="#fff8e0" stroke="#c89020" strokeWidth="1"/><rect x="21" y="22" width="9" height="9" rx="1.5" fill="#fff8e0" stroke="#c89020" strokeWidth="1"/><rect x="32" y="22" width="9" height="9" rx="1.5" fill="#fff8e0" stroke="#c89020" strokeWidth="1"/><ellipse cx="10" cy="16" rx="12" ry="3" fill="rgba(255,255,255,0.35)"/></svg>,
  "notepad": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpnp1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffffff"/><stop offset="100%" stopColor="#dde4f8"/></linearGradient><linearGradient id="xpnp2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#6888d0"/><stop offset="100%" stopColor="#3050a8"/></linearGradient></defs><rect x="7" y="2" width="34" height="44" rx="3" fill="url(#xpnp1)" stroke="#8898c0" strokeWidth="1.5"/><rect x="7" y="2" width="34" height="9" rx="3" fill="url(#xpnp2)"/><rect x="7" y="8" width="34" height="3" fill="url(#xpnp2)"/><line x1="14" y1="2" x2="14" y2="46" stroke="#f08888" strokeWidth="1.8"/><line x1="11" y1="2" x2="11" y2="46" stroke="#f8cccc" strokeWidth="1"/>{[15,20,25,30,35,40].map(y=><line key={y} x1="7" x2="41" y1={y} y2={y} stroke="#c0c8e8" strokeWidth="1"/>)}<text x="15" y="9" fontSize="5" fill="white" fontFamily="sans-serif" fontWeight="bold">Notepad</text><ellipse cx="24" cy="5" rx="11" ry="3" fill="rgba(255,255,255,0.42)"/></svg>,
  "calculator": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpcalc1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#c8ccd8"/><stop offset="100%" stopColor="#8088a8"/></linearGradient></defs><rect x="5" y="3" width="38" height="42" rx="5" fill="url(#xpcalc1)" stroke="#6878a0" strokeWidth="1.5"/><rect x="9" y="7" width="30" height="9" rx="2" fill="#101810" stroke="#406040" strokeWidth="1"/><text x="37" y="15" textAnchor="end" fontSize="7.5" fill="#44ff44" fontFamily="monospace" fontWeight="bold">0</text>{[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const bx=9+c*7.5,by=19+r*5.5,isRed=r===3&&c===3,isOp=c===3&&r<3;return<rect key={`${r}${c}`} x={bx} y={by} width="6.5" height="5" rx="1.5" fill={isRed?"#dd3333":isOp?"#7090d0":"#d8dce8"} stroke={isRed?"#aa1111":isOp?"#5070b0":"#9098b8"} strokeWidth="0.8"/>}))} <ellipse cx="24" cy="10" rx="13" ry="3.5" fill="rgba(255,255,255,0.45)"/></svg>,
  "puei-paint": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="xppal" cx="40%" cy="40%" r="60%"><stop offset="0%" stopColor="#f8f0e0"/><stop offset="100%" stopColor="#d0c8a8"/></radialGradient></defs><ellipse cx="22" cy="26" rx="13" ry="11" fill="url(#xppal)" stroke="#a09068" strokeWidth="1.5"/><ellipse cx="22" cy="26" rx="13" ry="11" fill="rgba(255,255,255,0)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>{[["#e03030",14,24],["#30b030",21,18],["#3060e8",28,19],["#e8c020",29,28],["#a030c0",17,31]].map(([c,cx,cy],i)=><circle key={i} cx={cx as number} cy={cy as number} r="3.5" fill={c as string} stroke="rgba(0,0,0,0.2)" strokeWidth="0.8"/>)}<circle cx="22" cy="26" r="3" fill="#f0e8d8" stroke="#a09068" strokeWidth="1"/><path d="M33 8 Q38 5 40 10 Q42 15 37 17 L34 15 Q32 12 33 8z" fill="#8b4513" stroke="#6b3410" strokeWidth="1"/><rect x="36" y="17" width="3" height="10" rx="1.5" fill="#c8a060" transform="rotate(18 37 17)"/><ellipse cx="19" cy="20" rx="7" ry="3" fill="rgba(255,255,255,0.4)" transform="rotate(-20 19 20)"/></svg>,
  "puei-board": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpboard" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e8b860"/><stop offset="100%" stopColor="#b07820"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="4" fill="url(#xpboard)" stroke="#8a5c10" strokeWidth="2"/><rect x="8" y="8" width="13" height="11" rx="2" fill="white" stroke="#d0a040" strokeWidth="1"/><rect x="27" y="8" width="13" height="9" rx="2" fill="#ffffa0" stroke="#c8a030" strokeWidth="1"/><rect x="27" y="22" width="13" height="11" rx="2" fill="#ffe0e0" stroke="#e08080" strokeWidth="1"/><rect x="8" y="24" width="13" height="17" rx="2" fill="#e0ffe0" stroke="#80c080" strokeWidth="1"/><circle cx="14.5" cy="8" r="3" fill="#e03030" stroke="#a02020" strokeWidth="1"/><circle cx="33.5" cy="8" r="3" fill="#30a030" stroke="#208020" strokeWidth="1"/><ellipse cx="24" cy="5" rx="14" ry="2.5" fill="rgba(255,255,255,0.3)"/></svg>,
  "pueinet": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpnet1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#60c8f8"/><stop offset="100%" stopColor="#1038c8"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="8" fill="url(#xpnet1)" stroke="#0828a8" strokeWidth="1.2"/><rect x="5" y="8" width="38" height="4" rx="2" fill="rgba(0,0,0,0.3)"/><rect x="5" y="8" width="16" height="4" rx="2" fill="#ec4899"/><rect x="5" y="14" width="38" height="26" rx="3" fill="rgba(255,255,255,0.15)"/><text x="24" y="34" textAnchor="middle" fontSize="20" fontWeight="bold" fontFamily="Arial,sans-serif" fill="white" letterSpacing="-1">W</text><ellipse cx="22" cy="8" rx="13" ry="3.5" fill="rgba(255,255,255,0.42)"/></svg>,
  "puei-cloud-chat": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpchat" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#60e890"/><stop offset="100%" stopColor="#108040"/></linearGradient></defs><path d="M5 9a4 4 0 014-4h30a4 4 0 014 4v17a4 4 0 01-4 4H29l-7 8v-8H9a4 4 0 01-4-4z" fill="url(#xpchat)" stroke="#0a6030" strokeWidth="1.5"/><circle cx="15" cy="18" r="4" fill="rgba(255,255,255,0.9)"/><circle cx="24" cy="18" r="4" fill="rgba(255,255,255,0.9)"/><circle cx="33" cy="18" r="4" fill="rgba(255,255,255,0.9)"/><ellipse cx="24" cy="9" rx="15" ry="3.5" fill="rgba(255,255,255,0.38)"/></svg>,
  "puei-studio": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpstudio1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#d080ff"/><stop offset="100%" stopColor="#7010c0"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="6" fill="url(#xpstudio1)" stroke="#5800a0" strokeWidth="1.5"/><circle cx="24" cy="18" r="7" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5"/><circle cx="24" cy="18" r="3" fill="rgba(255,255,255,0.95)"/><rect x="21.5" y="25" width="5" height="11" rx="2" fill="rgba(255,255,255,0.9)"/><circle cx="16" cy="37" r="2.5" fill="#ffddff" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/><circle cx="24" cy="39" r="2.5" fill="#ffddff" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/><circle cx="32" cy="37" r="2.5" fill="#ffddff" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/><ellipse cx="19" cy="8" rx="10" ry="3.5" fill="rgba(255,255,255,0.4)" transform="rotate(-18 19 8)"/></svg>,
  "app-store": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpas1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#5090f8"/><stop offset="100%" stopColor="#1044d0"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="7" fill="url(#xpas1)" stroke="#0830a8" strokeWidth="1.5"/><path d="M10 22h28l-3 18H13z" fill="white" opacity="0.95"/><path d="M17 22c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/><rect x="10" y="19" width="28" height="5" rx="2.5" fill="white" opacity="0.9"/><circle cx="19" cy="33" r="2.2" fill="#5090f8"/><circle cx="29" cy="33" r="2.2" fill="#5090f8"/><ellipse cx="24" cy="8" rx="14" ry="4" fill="rgba(255,255,255,0.45)"/></svg>,
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpmon" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e8ecf8"/><stop offset="100%" stopColor="#a8b0d0"/></linearGradient></defs><rect x="4" y="3" width="40" height="28" rx="3" fill="url(#xpmon)" stroke="#8090c0" strokeWidth="1.5"/><rect x="7" y="6" width="34" height="22" rx="1.5" fill="#1a2a60" stroke="#0a1840" strokeWidth="1"/><rect x="8" y="7" width="32" height="20" rx="1" fill="#1a3a90"/><rect x="9" y="22" width="30" height="4" fill="#1155cc"/><rect x="10" y="22.5" width="7" height="3" rx="0.5" fill="#2266dd"/><rect x="10" y="9" width="7" height="6" rx="1" fill="#60a8f0" opacity="0.9"/><rect x="19" y="9" width="7" height="6" rx="1" fill="#60a8f0" opacity="0.9"/><rect x="28" y="9" width="7" height="6" rx="1" fill="#60a8f0" opacity="0.9"/><rect x="4" y="29" width="40" height="2" rx="1" fill="#c0c8e0" stroke="#9098c0" strokeWidth="0.5"/><circle cx="24" cy="30" r="1.2" fill="#9098c0"/><rect x="19" y="31" width="10" height="5" rx="1" fill="#b8c0d8" stroke="#9098c0" strokeWidth="1"/><rect x="12" y="36" width="24" height="4" rx="2" fill="#c8d0e8" stroke="#9098c0" strokeWidth="1"/><ellipse cx="24" cy="7" rx="13" ry="3" fill="rgba(255,255,255,0.3)"/></svg>,
  "puei-social": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="xpsc1" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#ff9050"/><stop offset="100%" stopColor="#c04010"/></radialGradient><radialGradient id="xpsc2" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#6090f0"/><stop offset="100%" stopColor="#2040c0"/></radialGradient></defs><circle cx="16" cy="16" r="8" fill="url(#xpsc1)" stroke="#a03010" strokeWidth="1.5"/><ellipse cx="13" cy="12" rx="4" ry="2" fill="rgba(255,255,255,0.5)"/><path d="M1 40c0-8.5 6.5-14 15-14s15 5.5 15 14z" fill="url(#xpsc1)" stroke="#a03010" strokeWidth="1.5"/><circle cx="34" cy="14" r="7" fill="url(#xpsc2)" stroke="#2030a0" strokeWidth="1.5"/><ellipse cx="31" cy="10" rx="3.5" ry="2" fill="rgba(255,255,255,0.5)"/><path d="M23 38c0-7 5-11 11-11s11 4 11 11z" fill="url(#xpsc2)" stroke="#2030a0" strokeWidth="1.5"/></svg>,
  "folder": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpfol1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffe870"/><stop offset="100%" stopColor="#c89000"/></linearGradient><linearGradient id="xpfol2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ffd040"/><stop offset="100%" stopColor="#b07800"/></linearGradient></defs><path d="M4 19a3 3 0 013-3h9l4-4h24a3 3 0 013 3v18a3 3 0 01-3 3H7a3 3 0 01-3-3z" fill="url(#xpfol1)" stroke="#a07000" strokeWidth="1.5"/><path d="M4 17h14l4-4h24v3z" fill="url(#xpfol2)" stroke="#a07000" strokeWidth="1"/><ellipse cx="14" cy="16" rx="13" ry="3" fill="rgba(255,255,255,0.4)"/></svg>,
  "recycle-bin": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xprb1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e0e8f8"/><stop offset="100%" stopColor="#9098c0"/></linearGradient></defs><path d="M10 18h28l-3 24H13z" fill="url(#xprb1)" stroke="#7080b0" strokeWidth="1.5"/><line x1="6" y1="14" x2="42" y2="14" stroke="#6070a0" strokeWidth="2.5" strokeLinecap="round"/><path d="M17 14V10h14v4" fill="none" stroke="#6070a0" strokeWidth="2"/><line x1="18" y1="23" x2="17" y2="37" stroke="#a0b0d0" strokeWidth="1.5" strokeLinecap="round"/><line x1="24" y1="23" x2="24" y2="37" stroke="#a0b0d0" strokeWidth="1.5" strokeLinecap="round"/><line x1="30" y1="23" x2="31" y2="37" stroke="#a0b0d0" strokeWidth="1.5" strokeLinecap="round"/><ellipse cx="24" cy="16" rx="12" ry="2.5" fill="rgba(255,255,255,0.45)"/></svg>,
  "chess": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpch1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f5f0e0"/><stop offset="100%" stopColor="#c8b880"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="3" fill="url(#xpch1)" stroke="#806030" strokeWidth="1.5"/>{[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>(r+c)%2===0?<rect key={`${r}${c}`} x={4+c*8} y={4+r*8} width="8" height="8" fill="#a07030"/>:null))}<path d="M20 36v-4l-2-5 2-2 4-1 4 1 2 2-2 5v4z" fill="white" stroke="#555" strokeWidth="1.2"/><rect x="17" y="36" width="14" height="3.5" rx="1.5" fill="white" stroke="#555" strokeWidth="1.2"/><ellipse cx="24" cy="26" rx="4" ry="1.5" fill="rgba(255,255,255,0.4)"/></svg>,
  "puei-mansion": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpmr1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e03070"/><stop offset="100%" stopColor="#900030"/></linearGradient><linearGradient id="xpmw1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f5f0e8"/><stop offset="100%" stopColor="#d0c8b0"/></linearGradient></defs><polygon points="24,3 45,20 40,20 40,45 8,45 8,20 3,20" fill="url(#xpmr1)" stroke="#800028" strokeWidth="1.5"/><rect x="9" y="20" width="30" height="25" fill="url(#xpmw1)" stroke="#b0a888" strokeWidth="1"/><rect x="18" y="30" width="12" height="15" rx="1.5" fill="#a8d0f0" stroke="#6090c0" strokeWidth="1"/><rect x="11" y="23" width="9" height="8" rx="1.5" fill="#a8d0f0" stroke="#6090c0" strokeWidth="1"/><rect x="28" y="23" width="9" height="8" rx="1.5" fill="#a8d0f0" stroke="#6090c0" strokeWidth="1"/><ellipse cx="24" cy="12" rx="12" ry="3.5" fill="rgba(255,255,255,0.3)"/></svg>,
  "about": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="xpabt" cx="35%" cy="30%" r="65%"><stop offset="0%" stopColor="#60a0f0"/><stop offset="100%" stopColor="#1840c0"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#xpabt)" stroke="#1030a0" strokeWidth="1.5"/><circle cx="24" cy="15" r="3.5" fill="white"/><rect x="21" y="22" width="6" height="13" rx="3" fill="white"/><ellipse cx="20" cy="18" rx="7" ry="3" fill="rgba(255,255,255,0.4)" transform="rotate(-30 20 18)"/></svg>,
  "iso-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><radialGradient id="xpiso" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#e8e8f8"/><stop offset="100%" stopColor="#9090b8"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#xpiso)" stroke="#7070a0" strokeWidth="1.5"/><circle cx="24" cy="24" r="7" fill="none" stroke="#a0a0c8" strokeWidth="2.5"/><circle cx="24" cy="24" r="3" fill="#c0c0d8"/><ellipse cx="19" cy="17" rx="8" ry="3.5" fill="rgba(255,255,255,0.55)" transform="rotate(-30 19 17)"/></svg>,
  "zip-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpzip" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#d0e8ff"/><stop offset="100%" stopColor="#8ab8e8"/></linearGradient></defs><path d="M6 10a2 2 0 012-2h20l10 10v26a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill="url(#xpzip)" stroke="#5090c8" strokeWidth="1.5"/><path d="M28 8v10h10" fill="none" stroke="#5090c8" strokeWidth="1.5"/><rect x="21" y="18" width="8" height="3" rx="1" fill="white" stroke="#90b8d8" strokeWidth="0.5"/><rect x="21" y="23" width="8" height="3" rx="1" fill="#b8d8f8"/><rect x="21" y="28" width="8" height="3" rx="1" fill="white" stroke="#90b8d8" strokeWidth="0.5"/><rect x="21" y="33" width="8" height="3" rx="1" fill="#b8d8f8"/><ellipse cx="18" cy="11" rx="9" ry="3" fill="rgba(255,255,255,0.4)"/></svg>,
  "pmail": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpmail" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#dce8ff"/><stop offset="100%" stopColor="#8098d8"/></linearGradient></defs><rect x="3" y="8" width="42" height="30" rx="4" fill="url(#xpmail)" stroke="#5878c8" strokeWidth="1.5"/><rect x="5" y="10" width="38" height="26" rx="3" fill="white" opacity="0.94"/><path d="M5 12 L24 24 L43 12" fill="none" stroke="#3860c0" strokeWidth="2.5" strokeLinejoin="round"/><ellipse cx="24" cy="13" rx="16" ry="4" fill="rgba(255,255,255,0.52)"/></svg>,
  "web-app": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpweb1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#5888e8"/><stop offset="100%" stopColor="#2048c0"/></linearGradient></defs><rect x="2" y="5" width="44" height="34" rx="4" fill="white" stroke="#4060c0" strokeWidth="1.5"/><rect x="2" y="5" width="44" height="12" rx="4" fill="url(#xpweb1)"/><rect x="2" y="13" width="44" height="4" fill="url(#xpweb1)"/><circle cx="8" cy="11" r="2.5" fill="rgba(255,255,255,0.75)"/><circle cx="14" cy="11" r="2.5" fill="rgba(255,255,255,0.75)"/><rect x="20" y="7" width="20" height="7" rx="3.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/><rect x="8" y="23" width="32" height="3" rx="1.5" fill="#c8d8f0"/><rect x="8" y="29" width="22" height="3" rx="1.5" fill="#d8e8f8"/><rect x="8" y="35" width="28" height="3" rx="1.5" fill="#d8e8f8"/><rect x="16" y="39" width="16" height="4" rx="1" fill="#9090a8"/><rect x="12" y="43" width="24" height="3" rx="1.5" fill="#7878a0"/></svg>,
  "pueyracing": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpcar1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#f04040"/><stop offset="100%" stopColor="#900000"/></linearGradient></defs><path d="M24 5 C20 5 13 14 13 25 L16 27 L24 30 L32 27 L35 25 C35 14 28 5 24 5z" fill="url(#xpcar1)" stroke="#700000" strokeWidth="1.5"/><ellipse cx="24" cy="19" rx="5" ry="6" fill="#80b0f0" stroke="#4080d0" strokeWidth="1"/><path d="M13 25 L5 30 L10 28z" fill="#e09030" stroke="#b06010" strokeWidth="1"/><path d="M35 25 L43 30 L38 28z" fill="#e09030" stroke="#b06010" strokeWidth="1"/><ellipse cx="24" cy="33" rx="4" ry="2.5" fill="#404040" stroke="#202020" strokeWidth="1"/><ellipse cx="24" cy="13" rx="6" ry="3" fill="rgba(255,255,255,0.4)"/></svg>,
  "task-manager": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xptm" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e8eef8"/><stop offset="100%" stopColor="#9098c0"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="3" fill="url(#xptm)" stroke="#7080b0" strokeWidth="1.5"/><rect x="4" y="4" width="40" height="10" rx="3" fill="#4060c0"/><rect x="4" y="10" width="40" height="4" fill="#4060c0"/><rect x="8" y="18" width="32" height="5" rx="2" fill="#e0e8f8" stroke="#a0b0d0" strokeWidth="1"/><rect x="8" y="18" width="22" height="5" rx="2" fill="#4080d0"/><rect x="8" y="26" width="32" height="5" rx="2" fill="#e0e8f8" stroke="#a0b0d0" strokeWidth="1"/><rect x="8" y="26" width="16" height="5" rx="2" fill="#40b040"/><rect x="8" y="34" width="32" height="5" rx="2" fill="#e0e8f8" stroke="#a0b0d0" strokeWidth="1"/><rect x="8" y="34" width="9" height="5" rx="2" fill="#e04040"/><ellipse cx="24" cy="8" rx="14" ry="2.5" fill="rgba(255,255,255,0.3)"/></svg>,
  "puei-game": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="xpgame1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#40d840"/><stop offset="100%" stopColor="#107010"/></linearGradient></defs><rect x="4" y="10" width="40" height="28" rx="6" fill="url(#xpgame1)" stroke="#0a5010" strokeWidth="1.5"/><rect x="8" y="18" width="8" height="3" rx="1.5" fill="white" opacity="0.9"/><rect x="11.5" y="14.5" width="3" height="8" rx="1.5" fill="white" opacity="0.9"/><circle cx="36" cy="17" r="2.2" fill="white" opacity="0.9"/><circle cx="40" cy="21" r="2.2" fill="white" opacity="0.9"/><circle cx="32" cy="21" r="2.2" fill="white" opacity="0.9"/><circle cx="36" cy="25" r="2.2" fill="white" opacity="0.9"/><rect x="16" y="22" width="16" height="4" rx="2" fill="rgba(0,0,0,0.3)"/><ellipse cx="24" cy="13" rx="16" ry="4" fill="rgba(255,255,255,0.4)"/></svg>,
};

// PueiOS 3 — modern flat icons (full SVG with rounded-square bg, macOS/Android style)
const APP_ICON_SVGS_P3: Partial<Record<AppId, (s: number) => React.ReactNode>> = {
  "settings": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#6c757d"/><circle cx="24" cy="24" r="9" fill="none" stroke="white" strokeWidth="3.5"/><circle cx="24" cy="24" r="3.5" fill="white"/>{[0,45,90,135,180,225,270,315].map(a=><rect key={a} x="22.5" y="10" width="3" height="5" rx="1.5" fill="white" transform={`rotate(${a} 24 24)`}/>)}</svg>,
  "file-explorer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#1565c0"/><rect x="6" y="8" width="36" height="24" rx="3" fill="#90caf9"/><rect x="9" y="11" width="30" height="18" rx="2" fill="#e3f2fd"/><rect x="11" y="13" width="10" height="9" rx="1.5" fill="white" opacity="0.8"/><rect x="23" y="13" width="14" height="3.5" rx="1.5" fill="white" opacity="0.6"/><rect x="23" y="19" width="10" height="2.5" rx="1.2" fill="white" opacity="0.5"/><rect x="19" y="32" width="10" height="5" rx="1" fill="#5c85d6"/><rect x="14" y="36" width="20" height="3" rx="1.5" fill="#42a5f5"/></svg>,
  "notepad": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#3d8ef0"/><rect x="9" y="7" width="30" height="36" rx="4" fill="white"/><rect x="9" y="7" width="30" height="7" rx="4" fill="#5c9ef5"/><rect x="9" y="11" width="30" height="3" fill="#5c9ef5"/><line x1="16" y1="7" x2="16" y2="43" stroke="#ff8888" strokeWidth="1.8"/><line x1="14" y1="7" x2="14" y2="43" stroke="#ffcccc" strokeWidth="1"/>{[18,22,26,30,34,38].map(y=><line key={y} x1="9" x2="39" y1={y} y2={y} stroke="#c0d8f8" strokeWidth="1"/>)}</svg>,
  "calculator": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#455a64"/><rect x="9" y="8" width="30" height="32" rx="4" fill="#263238"/><rect x="11" y="10" width="26" height="10" rx="2" fill="#102010"/><text x="35" y="19" textAnchor="end" fontSize="8" fill="#44ff44" fontFamily="monospace" fontWeight="bold">0</text>{[0,1,2,3].map(r=>[0,1,2,3].map(c=>{const isRed=r===3&&c===3,isOp=c===3&&r<3;return<rect key={`${r}${c}`} x={11+c*6.5} y={23+r*5} width="5.5" height="4" rx="1.2" fill={isRed?"#e53935":isOp?"#1565c0":"#546e7a"} opacity="0.95"/>}))} </svg>,
  "puei-paint": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#ec407a"/><ellipse cx="22" cy="26" rx="11" ry="9" fill="white"/>{[["#e53935",14,25],["#43a047",21,19],["#1e88e5",29,20],["#fdd835",29,29],["#8e24aa",18,30]].map(([c,cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="3.5" fill={c}/>)}<circle cx="22" cy="26" r="2.5" fill="white"/><path d="M34 9 Q38 6 40 11 Q42 15 38 17 L35 16 Q33 13 34 9z" fill="#bf360c"/><rect x="36" y="17" width="3" height="9" rx="1.5" fill="#e8b86d" transform="rotate(15 37 17)"/></svg>,
  "puei-board": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#8d6e63"/><rect x="9" y="9" width="30" height="30" rx="4" fill="#d7b896"/><rect x="12" y="12" width="11" height="9" rx="2" fill="white"/><rect x="25" y="12" width="11" height="6" rx="2" fill="#fff9c4"/><rect x="25" y="20" width="11" height="9" rx="2" fill="#fce4ec"/><rect x="12" y="23" width="11" height="14" rx="2" fill="#e8f5e9"/><circle cx="17" cy="12" r="2" fill="#e53935"/><circle cx="30" cy="12" r="2" fill="#43a047"/></svg>,
  "pueinet": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><defs><linearGradient id="pwebP3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#1d40c0"/></linearGradient></defs><rect width="48" height="48" rx="11" fill="url(#pwebP3)"/><rect x="4" y="9" width="40" height="4" rx="2" fill="rgba(0,0,0,0.2)"/><rect x="4" y="9" width="16" height="4" rx="2" fill="#e879f9"/><rect x="4" y="15" width="40" height="26" rx="3" fill="rgba(255,255,255,0.1)"/><text x="24" y="35" textAnchor="middle" fontSize="20" fontWeight="bold" fontFamily="Arial,sans-serif" fill="white" letterSpacing="-1">W</text></svg>,
  "puei-cloud-chat": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#00897b"/><path d="M9 13a4 4 0 014-4h22a4 4 0 014 4v15a4 4 0 01-4 4H29l-7 7v-7h-9a4 4 0 01-4-4z" fill="white"/><circle cx="16" cy="20" r="3" fill="#b2dfdb"/><circle cx="24" cy="20" r="3" fill="#b2dfdb"/><circle cx="32" cy="20" r="3" fill="#b2dfdb"/></svg>,
  "puei-studio": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#6a1b9a"/><circle cx="24" cy="19" r="8" fill="none" stroke="#f3e5f5" strokeWidth="2.5"/><circle cx="24" cy="19" r="3.5" fill="#f3e5f5"/><rect x="22" y="27" width="4" height="10" rx="2" fill="#f3e5f5"/><circle cx="16" cy="38" r="2.5" fill="#ce93d8"/><circle cx="24" cy="40" r="2.5" fill="#ce93d8"/><circle cx="32" cy="38" r="2.5" fill="#ce93d8"/></svg>,
  "app-store": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#1a7fe8"/><path d="M24 9 L28 20 H39 L30 27 L33 38 L24 31 L15 38 L18 27 L9 20 H20 Z" fill="white" opacity="0.97"/></svg>,
  "puei-social": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#f4511e"/><circle cx="18" cy="19" r="5.5" fill="white"/><path d="M7 38c0-6.5 4.5-10 11-10s11 3.5 11 10z" fill="white"/><circle cx="32" cy="17" r="4.5" fill="#ffccbc"/><path d="M24 36c0-5 3.5-8 9-8s9 3 9 8z" fill="#ffccbc"/></svg>,
  "folder": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#ffa726"/><path d="M8 18a3 3 0 013-3h8l3 3h13a3 3 0 013 3v13a3 3 0 01-3 3H11a3 3 0 01-3-3z" fill="white"/><path d="M8 17h10l3-3" fill="none" stroke="white" strokeWidth="2.5"/></svg>,
  "recycle-bin": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#78909c"/><path d="M14 20h20l-2.5 18H16.5z" fill="white"/><rect x="11" y="16" width="26" height="3" rx="1.5" fill="white"/><path d="M20 16v-3h8v3" fill="none" stroke="white" strokeWidth="2"/><line x1="19" y1="24" x2="19" y2="34" stroke="#cfd8dc" strokeWidth="2" strokeLinecap="round"/><line x1="24" y1="24" x2="24" y2="34" stroke="#cfd8dc" strokeWidth="2" strokeLinecap="round"/><line x1="29" y1="24" x2="29" y2="34" stroke="#cfd8dc" strokeWidth="2" strokeLinecap="round"/></svg>,
  "chess": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#5d4037"/><rect x="9" y="9" width="30" height="30" rx="3" fill="#efebe9"/>{[[9,9],[17,9],[25,9],[13,13],[21,13],[29,13],[9,17],[17,17],[25,17],[13,21],[21,21],[29,21],[9,25],[17,25],[25,25],[13,29],[21,29],[29,29]].filter((_,i)=>i%2===0).map(([x,y],i)=><rect key={i} x={x} y={y} width="8" height="4" fill="#8d6e63"/>)}<path d="M22 24 v-8 M19 18 h6 M20 21 Q22 16 24 21" fill="none" stroke="#3e2723" strokeWidth="2" strokeLinecap="round"/><rect x="18" y="30" width="12" height="2.5" rx="1" fill="#3e2723"/></svg>,
  "puei-mansion": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#e53935"/><polygon points="24,8 39,20 36,20 36,38 12,38 12,20 9,20" fill="white"/><rect x="14" y="20" width="20" height="18" fill="#ffcdd2"/><rect x="19" y="28" width="10" height="10" rx="1" fill="#90caf9"/><rect x="14" y="22" width="7" height="6" rx="1" fill="#90caf9"/><rect x="27" y="22" width="7" height="6" rx="1" fill="#90caf9"/></svg>,
  "about": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#3949ab"/><circle cx="24" cy="14" r="3" fill="white"/><rect x="21" y="20" width="6" height="14" rx="3" fill="white"/></svg>,
  "iso-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#546e7a"/><circle cx="24" cy="24" r="13" fill="white" stroke="#cfd8dc" strokeWidth="1"/><circle cx="24" cy="24" r="4" fill="#b0bec5"/><circle cx="24" cy="24" r="2" fill="white"/><ellipse cx="20" cy="18" rx="5" ry="2.5" fill="rgba(255,255,255,0.6)" transform="rotate(-25 20 18)"/></svg>,
  "zip-viewer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#1565c0"/><path d="M11 11a3 3 0 013-3h14l9 9v20a3 3 0 01-3 3H14a3 3 0 01-3-3z" fill="white"/><path d="M25 8v9h9" fill="none" stroke="#90caf9" strokeWidth="2"/><rect x="20" y="18" width="8" height="3" rx="1" fill="#1565c0"/><rect x="20" y="23" width="8" height="3" rx="1" fill="#bbdefb"/><rect x="20" y="28" width="8" height="3" rx="1" fill="#1565c0"/><rect x="20" y="33" width="8" height="3" rx="1" fill="#bbdefb"/></svg>,
  "pmail": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#1e88e5"/><rect x="7" y="13" width="34" height="22" rx="4" fill="white"/><path d="M7 16 L24 27 L41 16" fill="none" stroke="#1e88e5" strokeWidth="2.5" strokeLinejoin="round"/></svg>,
  "web-app": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#0288d1"/><rect x="7" y="12" width="34" height="25" rx="4" fill="white"/><rect x="7" y="12" width="34" height="9" rx="4" fill="#b3e5fc"/><rect x="7" y="17" width="34" height="4" fill="#b3e5fc"/><circle cx="12" cy="16" r="2" fill="#ef5350"/><circle cx="18" cy="16" r="2" fill="#fdd835"/><circle cx="24" cy="16" r="2" fill="#66bb6a"/><rect x="12" y="26" width="24" height="2.5" rx="1.25" fill="#b3e5fc"/><rect x="12" y="30" width="16" height="2.5" rx="1.25" fill="#e1f5fe"/></svg>,
  "pueyracing": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#e53935"/><path d="M24 8 C20 8 14 15 14 24 L17 26 L24 29 L31 26 L34 24 C34 15 28 8 24 8z" fill="white"/><ellipse cx="24" cy="20" rx="4" ry="5" fill="#ef9a9a"/><path d="M14 24 L7 29 L11 27z" fill="#ffcdd2"/><path d="M34 24 L41 29 L37 27z" fill="#ffcdd2"/><ellipse cx="24" cy="31" rx="4" ry="2.5" fill="#ff7043"/><ellipse cx="24" cy="35" rx="3" ry="5" fill="#ff3d00" opacity="0.8"/></svg>,
  "computer": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#1565c0"/><rect x="6" y="6" width="36" height="24" rx="3" fill="#0d1a40" stroke="#0a1530" strokeWidth="1"/><rect x="7" y="7" width="34" height="22" rx="2" fill="#1a3a9a"/><rect x="8" y="21" width="32" height="4" fill="#1155cc"/><rect x="9" y="21.5" width="8" height="3" rx="0.5" fill="#2266dd"/><rect x="9" y="9" width="8" height="7" rx="1" fill="#64b5f6" opacity="0.9"/><rect x="20" y="9" width="8" height="7" rx="1" fill="#64b5f6" opacity="0.9"/><rect x="31" y="9" width="6" height="7" rx="1" fill="#64b5f6" opacity="0.9"/><rect x="6" y="28" width="36" height="2" rx="1" fill="#5c85d6"/><rect x="19" y="30" width="10" height="5" rx="1.5" fill="#5c85d6"/><rect x="14" y="35" width="20" height="4" rx="2" fill="#42a5f5"/></svg>,
  "task-manager": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#37474f"/><rect x="8" y="10" width="32" height="6" rx="3" fill="rgba(255,255,255,0.15)"/><rect x="8" y="10" width="22" height="6" rx="3" fill="#42a5f5"/><rect x="8" y="19" width="32" height="6" rx="3" fill="rgba(255,255,255,0.15)"/><rect x="8" y="19" width="18" height="6" rx="3" fill="#66bb6a"/><rect x="8" y="28" width="32" height="6" rx="3" fill="rgba(255,255,255,0.15)"/><rect x="8" y="28" width="11" height="6" rx="3" fill="#ef5350"/><rect x="8" y="37" width="32" height="4" rx="2" fill="rgba(255,255,255,0.15)"/><rect x="8" y="37" width="27" height="4" rx="2" fill="#ffca28"/></svg>,
  "puei-game": (s) => <svg width={s} height={s} viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#2e7d32"/><rect x="5" y="13" width="38" height="22" rx="7" fill="#43a047"/><rect x="9" y="21" width="8" height="3" rx="1.5" fill="white"/><rect x="12.5" y="17.5" width="3" height="8" rx="1.5" fill="white"/><circle cx="35" cy="20" r="2.5" fill="white"/><circle cx="39" cy="24" r="2.5" fill="white"/><circle cx="31" cy="24" r="2.5" fill="white"/><circle cx="35" cy="28" r="2.5" fill="white"/><rect x="18" y="23" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.3)"/></svg>,
};

// Win7/Vista color pairs for boxed mode (PueiOS 3 legacy — kept for fallback)
const WIN7_COLOR: Partial<Record<AppId, [string, string]>> = {
  "settings":        ["#c0c8e0", "#6878a0"],
  "file-explorer":   ["#b8d8f0", "#2060a0"],
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
  "task-manager":   ["#b0c8e0", "#304858"],
};

export function appIcon(appId: AppId, size = 32, override?: string, iconUrl?: string, boxed = false, p1 = false) {
  const s = size;
  const radius = Math.round(s * 0.22);

  const isImg = typeof override === "string" && override.startsWith("data:");
  const isEmoji = typeof override === "string" && !isImg && !!override && override.trim().length > 0;
  const useUrl = !isImg && !isEmoji && !override && !!iconUrl;
  const fallbackIconUrl = (() => {
    if (!iconUrl) return "";
    const duckMatch = iconUrl.match(/\/ip3\/([^/?]+)\.ico/i);
    const host = duckMatch?.[1];
    if (!host) return "";
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, Math.round(s))}&domain_url=${encodeURIComponent(`https://${host}`)}`;
  })();
  // PueiOS 1: flat minimal 2-color icon
  const p1Svg = p1 ? APP_ICON_SVGS_P1[appId]?.(s) : undefined;
  // PueiOS 2/3: aero glass SVG (P3 gets it wrapped in a glass box below)
  const customSvg = p1Svg ? null : APP_ICON_SVGS[appId]?.(s);
  // p3Svg kept as null — P3 uses customSvg with box wrapper
  const p3Svg: React.ReactNode = undefined;

  const emojiContent = isEmoji ? <span style={{ fontSize: Math.round(s * 0.62), lineHeight: 1 }}>{override}</span> : null;

  // PueiOS 3 emoji fallback box (flat colored square)
  const [c1, c2] = WIN7_COLOR[appId] ?? ["#8090c8", "#2840a0"];
  const p3EmojiBox = (children: React.ReactNode) => (
    <div style={{ width: s, height: s, borderRadius: radius, overflow: "hidden", background: `linear-gradient(135deg, ${c1}, ${c2})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${Math.round(s*0.06)}px ${Math.round(s*0.2)}px rgba(0,0,0,0.35)` }}>
      {children}
    </div>
  );

  return (
    <div className="flex items-center justify-center relative" style={{ width: s, height: s, flexShrink: 0 }}>
      {isImg
        ? <img src={override} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: boxed ? radius : Math.round(s * 0.15) }} />
        : isEmoji
          ? boxed ? p3EmojiBox(emojiContent) : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{emojiContent}</div>
          : useUrl
          ? <>
              <img
                src={iconUrl}
                alt=""
                data-fallback={fallbackIconUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: boxed ? radius : (iconUrl?.endsWith(".svg") ? Math.round(s * 0.15) : 0) }}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const fallback = img.dataset.fallback || "";
                  if (fallback && img.src !== fallback) { img.src = fallback; return; }
                  img.style.display = "none";
                  const fallbackEl = img.nextElementSibling as HTMLElement | null;
                  if (fallbackEl) fallbackEl.style.display = "flex";
                }}
              />
              <div style={{ display: "none", alignItems: "center", justifyContent: "center" }}>
                {p1Svg ?? customSvg}
              </div>
            </>
          : boxed && customSvg
            ? <div style={{ width: s, height: s, borderRadius: radius, overflow: "hidden", background: "linear-gradient(160deg, rgba(80,140,240,0.18) 0%, rgba(20,60,160,0.32) 100%)", border: "1px solid rgba(120,180,255,0.4)", boxShadow: `0 ${Math.round(s*0.06)}px ${Math.round(s*0.2)}px rgba(0,20,80,0.45), inset 0 1px 0 rgba(255,255,255,0.55)`, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>{customSvg}</div>
            : (p1Svg ?? customSvg)
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{p1Svg ?? customSvg}</div>
              : null
      }
    </div>
  );
}
