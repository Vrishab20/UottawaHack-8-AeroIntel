import { useEffect, useRef, useState } from "react";

export default function MapStage({ children }) {
  const stageRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [pinnedMode, setPinnedMode] = useState("");
  const [hoverMode, setHoverMode] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || prefersReducedMotion) {
      return;
    }
    let raf = null;
    const onScroll = () => {
      if (raf) {
        return;
      }
      raf = requestAnimationFrame(() => {
        raf = null;
        const rect = stage.getBoundingClientRect();
        const progressRaw = (window.innerHeight - rect.top) / Math.max(1, rect.height);
        const progress = Math.min(1, Math.max(0, progressRaw));
        const eased = 1 - Math.pow(1 - progress, 3);
        const opacity = Math.min(1, progress * 1.4);
        const scale = 1.02 - 0.02 * eased;
        const blur = (1 - eased) * 6;

        stage.style.setProperty("--map-opacity", opacity.toFixed(3));
        stage.style.setProperty("--map-scale", scale.toFixed(3));
        stage.style.setProperty("--map-blur", `${blur.toFixed(2)}px`);

        const nextStep = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;
        setActiveStep((prev) => (prev === nextStep ? prev : nextStep));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const highlightMode = pinnedMode || hoverMode;
  const isPinned = (mode) => pinnedMode === mode;

  return (
    <section
      ref={stageRef}
      className={`map-stage ${prefersReducedMotion ? "reduced-motion" : ""} ${isActive ? "active" : ""}`}
    >
      <div className="map-stage-sticky">
        <div className="map-stage-viewport">
          <div className="map-stage-media">{children}</div>
          <div className="map-stage-gradient" />
          <div className="map-stage-vignette" />
          <div className="map-stage-overlay">
            <div className={`map-step ${activeStep === 0 ? "active" : ""} ${highlightMode === "overview" ? "highlight" : ""}`}>
              <div className="map-step-title">Traffic overview</div>
              <div className="map-step-body">Live traffic patterns across the corridor.</div>
            </div>
            <div className={`map-step ${activeStep === 1 ? "active" : ""} ${highlightMode === "hotspots" ? "highlight" : ""}`}>
              <div className="map-step-title">Hotspots light up</div>
              <div className="map-step-body">Clusters emerge around shared waypoints.</div>
            </div>
            <div className={`map-step ${activeStep === 2 ? "active" : ""} ${highlightMode === "conflicts" || highlightMode === "proposals" ? "highlight" : ""}`}>
              <div className="map-step-title">Conflicts and suggested fixes</div>
              <div className="map-step-body">Recommended actions reduce separation risk.</div>
            </div>
          </div>
          <div className={`map-controls ${isActive ? "visible" : ""}`}>
            {[
              { id: "hotspots", label: "Hotspots" },
              { id: "conflicts", label: "Conflicts" },
              { id: "proposals", label: "Proposals" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`map-control ${isPinned(item.id) ? "pinned" : ""}`}
                onMouseEnter={() => setHoverMode(item.id)}
                onMouseLeave={() => setHoverMode("")}
                onClick={() => setPinnedMode(isPinned(item.id) ? "" : item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={`map-hint ${isActive ? "visible" : ""}`}>
            Continue ↓
          </div>
        </div>
      </div>
    </section>
  );
}
