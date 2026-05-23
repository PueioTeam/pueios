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
  win, focused, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children,
}: {
  win: WindowState;
  focused: boolean;
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
      className="aero-glass window-shadow fixed flex flex-col rounded-xl overflow-hidden"
      style={{
        ...style,
        zIndex: 100 + win.z,
        opacity: focused ? 1 : 0.96,
        transition: drag.current || resz.current ? "none" : "opacity 0.15s",
      }}
      onMouseDown={onFocus}
    >
      <div
        className="aero-titlebar flex items-center justify-between px-3 py-1.5"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onDoubleClick={onMaximize}
        style={{ cursor: win.maximized ? "default" : "move", touchAction: "none" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold truncate">
          <span>{win.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="aero-button rounded-md w-8 h-6 text-xs" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>_</button>
          <button className="aero-button rounded-md w-8 h-6 text-xs" onClick={(e) => { e.stopPropagation(); onMaximize(); }}>▢</button>
          <button
            className="aero-button rounded-md w-8 h-6 text-xs"
            style={{ background: "linear-gradient(to bottom,#ff8a8a,#cc2a2a)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >✕</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto" style={{ background: "var(--glass-strong)" }}>
        {children}
      </div>
      {!win.maximized && (
        <div
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          style={{
            position: "absolute", right: 0, bottom: 0, width: 16, height: 16,
            cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.3) 50%)",
          }}
        />
      )}
    </div>
  );
}

export function appIcon(appId: AppId, size = 32, override?: string, iconUrl?: string) {
  const s = size;
  const map: Record<AppId, string> = {
    "puei-paint": "🎨",
    "pueinet": "🌐",
    "puei-messenger": "💬",
    "file-explorer": "🗂️",
    "settings": "⚙️",
    "about": "ℹ️",
    "notepad": "📝",
    "calculator": "🧮",
    "app-store": "🛍️",
    "puei-social": "📣",
    "folder": "📁",
    "web-app": "🔗",
  };
  const isImg = typeof override === "string" && override.startsWith("data:");
  const useUrl = !isImg && !override && !!iconUrl;
  return (
    <div
      className="flex items-center justify-center rounded-md overflow-hidden"
      style={{
        width: s, height: s, fontSize: s * 0.72,
        background: "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(180,220,255,0.4))",
        border: "1px solid rgba(255,255,255,0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      {isImg
        ? <img src={override} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : useUrl
          ? <img src={iconUrl} alt="" style={{ width: "78%", height: "78%", objectFit: "contain" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          : (override || map[appId])}
    </div>
  );
}
