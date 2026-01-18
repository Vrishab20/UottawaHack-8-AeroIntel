import { useEffect, useMemo } from "react";

export default function AviationBackground({ boost = false }) {
  // DEBUG_BG: set true to visually verify background.
  const DEBUG_BG = false;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // Debugging: report mount + reduced motion status.
    // eslint-disable-next-line no-console
    console.log("AviationBackground mounted");
    // eslint-disable-next-line no-console
    console.log("prefersReducedMotion:", prefersReducedMotion);
  }, [prefersReducedMotion]);

  const routePaths = useMemo(
    () => [
      "M50 120 C 260 40, 480 80, 720 30",
      "M80 240 C 320 160, 560 200, 880 140",
      "M40 360 C 260 320, 520 340, 760 300",
      "M120 60 C 320 120, 520 20, 760 90",
    ],
    []
  );

  return (
    <div className={`aviationBg ${boost ? "boost" : ""} ${DEBUG_BG ? "debug" : ""}`} aria-hidden="true">
      {DEBUG_BG && <div className="bg-watermark">BG ACTIVE</div>}
      <div className="aviation-base" />
      <svg className="aviation-routes" viewBox="0 0 1000 500" preserveAspectRatio="none">
        {routePaths.map((d, index) => (
          <path key={d} className={`route route-${index + 1}`} d={d} />
        ))}
      </svg>
    </div>
  );
}
