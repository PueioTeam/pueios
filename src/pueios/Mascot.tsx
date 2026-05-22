import { useEffect, useRef, useState } from "react";

// The mascot "Puei": a floating HAND with tiny fly wings and dot eyes.
// NOT a penguin, NOT an animal. Microsoft-Paint-era helper aesthetic.
export function PueiMascot({
  onClick,
  cursorPos,
  speak,
}: {
  onClick?: () => void;
  cursorPos: { x: number; y: number };
  speak?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos] = useState({ right: 24, bottom: 64 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cursorPos.x - cx;
    const dy = cursorPos.y - cy;
    const mag = Math.min(2, Math.hypot(dx, dy) / 200);
    setEyeOffset({
      x: (dx / (Math.hypot(dx, dy) || 1)) * mag,
      y: (dy / (Math.hypot(dx, dy) || 1)) * mag,
    });
  }, [cursorPos]);

  return (
    <div
      style={{ position: "fixed", right: pos.right, bottom: pos.bottom, zIndex: 9000 }}
      className="pointer-events-auto"
    >
      {speak && (
        <div
          className="aero-glass absolute"
          style={{
            right: 80,
            bottom: 40,
            padding: "8px 12px",
            borderRadius: 12,
            fontSize: 12,
            minWidth: 160,
            maxWidth: 220,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Puei says:</div>
          <div>{speak}</div>
        </div>
      )}
      <div
        ref={ref}
        className={"mascot-float cursor-pointer"}
        onClick={() => {
          setBounce(true);
          setTimeout(() => setBounce(false), 250);
          onClick?.();
        }}
        style={{
          transform: bounce ? "scale(1.15)" : undefined,
          transition: "transform 0.2s",
          filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.4))",
        }}
      >
        <svg width="72" height="80" viewBox="0 0 72 80">
          {/* tiny fly wings */}
          <g className="mascot-wing" style={{ transformOrigin: "36px 26px" }}>
            <ellipse cx="18" cy="26" rx="14" ry="8" fill="white" opacity="0.55" stroke="rgba(120,180,220,0.7)" strokeWidth="1" />
            <ellipse cx="54" cy="26" rx="14" ry="8" fill="white" opacity="0.55" stroke="rgba(120,180,220,0.7)" strokeWidth="1" />
            <ellipse cx="18" cy="26" rx="6" ry="3" fill="white" opacity="0.8" />
            <ellipse cx="54" cy="26" rx="6" ry="3" fill="white" opacity="0.8" />
          </g>
          {/* HAND body — simple mitten silhouette */}
          <defs>
            <linearGradient id="handGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffe0bd" />
              <stop offset="60%" stopColor="#f5c89a" />
              <stop offset="100%" stopColor="#d9a878" />
            </linearGradient>
            <radialGradient id="handHi" cx="0.35" cy="0.25" r="0.6">
              <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          {/* wrist */}
          <rect x="28" y="60" width="16" height="14" rx="6" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
          {/* palm — rounded mitten */}
          <path
            d="M16 40 Q16 28 28 28 L44 28 Q56 28 56 40 L56 56 Q56 64 44 64 L28 64 Q16 64 16 56 Z"
            fill="url(#handGrad)"
            stroke="#8a6440"
            strokeWidth="1.4"
          />
          {/* thumb bump */}
          <ellipse cx="14" cy="44" rx="5" ry="7" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
          {/* tiny finger nubs (no detailed fingers) */}
          <path d="M22 28 Q22 22 26 22 Q30 22 30 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
          <path d="M32 28 Q32 20 36 20 Q40 20 40 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
          <path d="M42 28 Q42 22 46 22 Q50 22 50 28" fill="url(#handGrad)" stroke="#8a6440" strokeWidth="1.2" />
          {/* glossy highlight */}
          <path
            d="M22 34 Q22 30 28 30 L40 30 Q46 30 46 36 L46 42 Q40 44 32 44 Q24 44 22 40 Z"
            fill="url(#handHi)"
          />
          {/* two tiny black dot eyes */}
          <g transform={`translate(${eyeOffset.x}, ${eyeOffset.y})`}>
            <circle className="mascot-eye" cx="29" cy="46" r="2.2" fill="#0a0a0a" />
            <circle className="mascot-eye" cx="43" cy="46" r="2.2" fill="#0a0a0a" />
          </g>
          {/* tiny awkward mouth line */}
          <path d="M33 53 Q36 55 39 53" stroke="#5a3a20" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
