import { useEffect, useState } from "react";
import App from "../App.jsx";
import RadarScopeIntro from "./RadarScopeIntro.jsx";

// ============================================================================
// AppShell: Orchestrates intro screen and main app
// For the new FR24-style layout, the intro is optional and can be skipped
// ============================================================================

export default function AppShell() {
  const [showIntro, setShowIntro] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const skip = localStorage.getItem("ti_skip_intro");
    if (skip === "true") {
      setShowIntro(false);
    }
  }, []);

  const handleEnter = (skipNext) => {
    if (skipNext) {
      localStorage.setItem("ti_skip_intro", "true");
    }
    setTransitioning(true);
    setTimeout(() => {
      setShowIntro(false);
      setTransitioning(false);
    }, 700);
  };

  return (
    <>
      {/* Always render App so the map stays mounted */}
      <App />

      {/* Overlay intro screen on top when needed */}
      {showIntro && (
        <div className={`intro-overlay ${transitioning ? "fade-out" : ""}`}>
          <RadarScopeIntro onEnter={handleEnter} />
        </div>
      )}

      {transitioning && <div className="intro-toast">Analyzing flight plan…</div>}
    </>
  );
}
