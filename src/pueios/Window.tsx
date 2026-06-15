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
    "puei-board": "📌",
    "pueinet": "🌐",
    "puei-cloud-chat": "💬",
    "puei-studio": "🪽",
    "file-explorer": "🗂️",
    "settings": "⚙️",
    "about": "ℹ️",
    "notepad": "📝",
    "calculator": "🧮",
    "app-store": "🛍️",
    "puei-social": "📣",
    "folder": "📁",
    "web-app": "🔗",
    "recycle-bin": "🗑️",
    "chess": "♟️",
    "puei-mansion": "👻",
    "iso-viewer": "💿",
    "zip-viewer": "📦",
    "pmail": "✉️",
    "racing-3d": "🏎️",
  };
  // Win7-style per-app icon colors
  const colorMap: Partial<Record<AppId, [string, string]>> = {
    "settings":       ["#607d8b","#37474f"],
    "file-explorer":  ["#f9a825","#e65100"],
    "notepad":        ["#42a5f5","#1565c0"],
    "calculator":     ["#26c6da","#00838f"],
    "puei-paint":     ["#ec407a","#880e4f"],
    "puei-board":     ["#ef5350","#b71c1c"],
    "pueinet":        ["#29b6f6","#0277bd"],
    "puei-cloud-chat":["#66bb6a","#1b5e20"],
    "puei-studio":    ["#ab47bc","#4a148c"],
    "app-store":      ["#26a69a","#004d40"],
    "puei-social":    ["#ff7043","#bf360c"],
    "folder":         ["#ffa726","#e65100"],
    "web-app":        ["#78909c","#37474f"],
    "recycle-bin":    ["#78909c","#455a64"],
    "chess":          ["#8d6e63","#3e2723"],
    "puei-mansion":   ["#7e57c2","#311b92"],
    "about":          ["#5c6bc0","#1a237e"],
    "iso-viewer":     ["#8d6e63","#4e342e"],
    "zip-viewer":     ["#78909c","#37474f"],
    "pmail":          ["#ef5350","#c62828"],
    "racing-3d":      ["#ffca28","#f57f17"],
  };
  const [c1, c2] = colorMap[appId] ?? ["#546e7a","#263238"];

  const isImg = typeof override === "string" && override.startsWith("data:");
  const useUrl = !isImg && !override && !!iconUrl;
  const fallbackGlyph = override || map[appId];
  const fallbackIconUrl = (() => {
    if (!iconUrl) return "";
    const duckMatch = iconUrl.match(/\/ip3\/([^/?]+)\.ico/i);
    const host = duckMatch?.[1];
    if (!host) return "";
    return `https://www.google.com/s2/favicons?sz=${Math.max(32, Math.round(s))}&domain_url=${encodeURIComponent(`https://${host}`)}`;
  })();
  const radius = Math.round(s * 0.2);
  return (
    <div
      className="flex items-center justify-center overflow-hidden relative"
      style={{
        width: s, height: s, fontSize: s * 0.62,
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
              <span style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>{fallbackGlyph}</span>
            </>
          : <span style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))", lineHeight: 1 }}>{fallbackGlyph}</span>}
      {/* Win7-style gloss overlay — top 45% white shine */}
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
