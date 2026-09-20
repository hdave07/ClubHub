// Puffer.jsx: Club Hub mascot. Raster body (eyes removed) + live SVG visor.
// Assets: public/mascot/puffer-noeyes.webp (neutral trim), puffer-lit-noeyes.webp (blue trim).
// Palette: cream #F2EEE6 eyes; starlight blue #9DB4E0 ONLY for the Dropbox arrival (state="discovered").
import { useEffect, useRef, useState } from "react";
import "./puffer.css";

// Coordinates are in the source image's pixel space (662 x 624).
const VB_W = 662, VB_H = 624;
const VISOR = { x: 177, y: 180, w: 311, h: 176, rx: 88 };
const EYES = [246.5, 417.5];      // eye centers (x)
const EYE_Y = 274.5;              // eye center (y)
const CREAM = "#F2EEE6";
const ACCENT = "#9DB4E0";
const TRACK_RADIUS = 250;         // px from the mascot's visor
const SLEEP_AFTER_MS = 30000;

function Eye({ cx, cy, mode }) {
  switch (mode) {
    case "curious":   return <circle cx={cx} cy={cy} r={13} />;
    case "scanning":  return <rect x={cx - 18} y={cy - 4} width={36} height={8} rx={4} />;
    case "sleeping":  return <rect x={cx - 15} y={cy + 10} width={30} height={6} rx={3} opacity={0.55} />;
    default:          return <rect x={cx - 10} y={cy - 28.5} width={20} height={57} rx={10} />; // idle ▌ ▌
  }
}

// 4-point star, centered at (cx, cy)
const star = (cx, cy, r) =>
  `M${cx},${cy - r} Q${cx + r * 0.18},${cy - r * 0.18} ${cx + r},${cy} Q${cx + r * 0.18},${cy + r * 0.18} ${cx},${cy + r} ` +
  `Q${cx - r * 0.18},${cy + r * 0.18} ${cx - r},${cy} Q${cx - r * 0.18},${cy - r * 0.18} ${cx},${cy - r}Z`;

/**
 * state: "idle" | "curious" | "scanning" | "discovered" | "sleeping"
 *   Parent owns scanning (/recommend loading) and discovered (Dropbox arrival, ~2.5 s).
 *   The component itself handles cursor tracking, hover-curious and idle sleep.
 * deterministic: disables sleep (use for ?demo).
 */
export default function Puffer({ state = "idle", size = 160, deterministic = false, onClick, className = "" }) {
  const ref = useRef(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [near, setNear] = useState(false);
  const [asleep, setAsleep] = useState(false);

  useEffect(() => {
    let timer;
    const wake = () => {
      setAsleep(false);
      clearTimeout(timer);
      if (!deterministic) timer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    };
    const onMove = (e) => {
      wake();
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width * (332 / VB_W), cy = r.top + r.height * (EYE_Y / VB_H);
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > TRACK_RADIUS) { setNear(false); setLook({ x: 0, y: 0 }); return; }
      setNear(true);
      const k = Math.min(1, d / 120);          // ease in near the center
      setLook({ x: (dx / (d || 1)) * 16 * k, y: (dy / (d || 1)) * 9 * k }); // visor units
    };
    const events = ["keydown", "scroll", "pointerdown"];
    window.addEventListener("pointermove", onMove, { passive: true });
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      events.forEach((ev) => window.removeEventListener(ev, wake));
    };
  }, [deterministic]);

  // Parent states win; then sleep; then curiosity from hover.
  const mode =
    state !== "idle" ? state :
    asleep ? "sleeping" :
    near ? "curious" : "idle";

  const lit = mode === "discovered";
  const tracking = mode === "idle" || mode === "curious";
  const t = tracking ? look : { x: 0, y: 0 };

  return (
    <button
      ref={ref}
      type="button"
      className={`puffer puffer--${mode} ${className}`}
      style={{ width: size, height: size * (VB_H / VB_W) }}
      onClick={onClick}
      aria-label="Club Hub guide. Find me something to do"
    >
      <span className="puffer__shadow" aria-hidden />
      <span className="puffer__body" aria-hidden>
        <img className="puffer__img" src="/mascot/puffer-noeyes.webp" alt="" draggable={false} />
        <img className={`puffer__img puffer__img--lit ${lit ? "is-on" : ""}`} src="/mascot/puffer-lit-noeyes.webp" alt="" draggable={false} />
        <svg className="puffer__visor" viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <defs>
            <clipPath id="puffer-visor">
              <rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.rx} />
            </clipPath>
            <filter id="puffer-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="puffer-sweep" x1="0" x2="1">
              <stop offset="0" stopColor={CREAM} stopOpacity="0" />
              <stop offset="0.5" stopColor={CREAM} stopOpacity="0.35" />
              <stop offset="1" stopColor={CREAM} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g clipPath="url(#puffer-visor)">
            {mode === "discovered" ? (
              <path className="puffer__star" d={star(332, EYE_Y, 34)} fill={ACCENT} filter="url(#puffer-glow)" />
            ) : (
              <g className="puffer__eyes" fill={CREAM} filter="url(#puffer-glow)"
                 style={{ transform: `translate(${t.x}px, ${t.y}px)` }}>
                {EYES.map((cx) => <Eye key={cx} cx={cx} cy={EYE_Y} mode={mode} />)}
              </g>
            )}
            {mode === "scanning" && (
              <rect className="puffer__sweep" x={VISOR.x - 80} y={VISOR.y} width={80} height={VISOR.h} fill="url(#puffer-sweep)" />
            )}
          </g>
        </svg>
      </span>
    </button>
  );
}
