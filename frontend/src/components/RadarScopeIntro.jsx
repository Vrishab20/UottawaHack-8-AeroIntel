import { useEffect, useMemo, useState } from "react";

export default function RadarScopeIntro({ onEnter }) {
  // Tune blip count and speed here.
  const BLIP_COUNT = 12;
  const [skipNext, setSkipNext] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const blips = useMemo(() => {
    const labels = ["ACA101", "WJA204", "FLE856", "UPS171", "ACA150", "FLE310", "ACA641", "ACA713", "PCG330", "CARG900"];
    return Array.from({ length: BLIP_COUNT }).map((_, index) => ({
      id: `blip-${index}`,
      label: labels[index % labels.length],
      radius: 40 + (index % 5) * 22,
      angle: (index * 360) / BLIP_COUNT,
      speed: 18 + (index % 4) * 6,
    }));
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Enter") {
        onEnter(skipNext);
      }
      if (event.key === "Escape") {
        onEnter(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter, skipNext]);

  const handleMouseMove = (event) => {
    if (prefersReducedMotion) {
      return;
    }
    const { innerWidth, innerHeight } = window;
    const x = ((event.clientX / innerWidth) - 0.5) * 8;
    const y = ((event.clientY / innerHeight) - 0.5) * 8;
    setParallax({ x, y });
  };

  return (
    <div className="intro-screen" onMouseMove={handleMouseMove} role="dialog" aria-modal="true">
      <div className="intro-noise" />
      <div
        className="radar-wrapper"
        style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)` }}
      >
        <svg className="radar-scope" viewBox="0 0 500 500" role="img" aria-label="Radar scope">
          <defs>
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.22)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
            </radialGradient>
          </defs>
          <circle cx="250" cy="250" r="220" className="radar-ring" />
          <circle cx="250" cy="250" r="160" className="radar-ring" />
          <circle cx="250" cy="250" r="100" className="radar-ring" />
          <circle cx="250" cy="250" r="40" className="radar-ring" />
          <line x1="250" y1="30" x2="250" y2="470" className="radar-grid" />
          <line x1="30" y1="250" x2="470" y2="250" className="radar-grid" />
          <circle cx="250" cy="250" r="220" fill="url(#radarGlow)" />
          <g className={`radar-sweep ${prefersReducedMotion ? "static" : ""}`}>
            <path d="M250 250 L250 20 A230 230 0 0 1 430 110 Z" className="radar-wedge" />
          </g>
          {blips.map((blip) => (
            <g
              key={blip.id}
              className={`radar-blip ${prefersReducedMotion ? "static" : ""}`}
              style={{
                "--radius": `${blip.radius}px`,
                "--angle": `${blip.angle}deg`,
                "--speed": `${blip.speed}s`,
              }}
            >
              <circle cx="250" cy="250" r="3" />
              <text x="260" y="250" className="radar-label">
                {blip.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="intro-panel">
        <div className="intro-title">AeroIntel</div>
        <div className="intro-subtitle">
          Aviation Intelligence Platform
        </div>
        <div className="intro-actions">
          <button type="button" className="intro-primary" onClick={() => onEnter(skipNext)}>
            Enter Control Center
          </button>
        </div>
        <label className="intro-skip">
          <input
            type="checkbox"
            checked={skipNext}
            onChange={(event) => setSkipNext(event.target.checked)}
          />
          Skip intro next time
        </label>
        <div className="intro-status">
          <span className="status-dot" />
          Systems online
        </div>
        <div className="intro-shimmer" />
      </div>
    </div>
  );
}
