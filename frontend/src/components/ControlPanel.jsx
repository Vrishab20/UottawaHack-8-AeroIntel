import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================================
// ControlPanel: Expandable sidebar that wraps existing dashboard content
// ----------------------------------------------------------------------------
// - Collapsed: Shows summary counts (flights, conflicts, hotspots)
// - Expanded: Full scrollable dashboard
// - Resizable via drag handle
// - Keyboard accessible (Esc to collapse, Enter to expand)
// ============================================================================

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 420;

export default function ControlPanel({
  children,
  flightCount = 0,
  conflictCount = 0,
  hotspotCount = 0,
  isLoading = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(DEFAULT_WIDTH);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
      // Enter to expand when panel is focused
      if (
        e.key === "Enter" &&
        !isExpanded &&
        document.activeElement === panelRef.current
      ) {
        setIsExpanded(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Handle resize drag
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - dragStartXRef.current;
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, dragStartWidthRef.current + delta)
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      ref={panelRef}
      className={`control-panel ${isExpanded ? "expanded" : "collapsed"} ${
        isDragging ? "dragging" : ""
      }`}
      style={isExpanded ? { width: `${width}px` } : undefined}
      tabIndex={0}
      role="region"
      aria-label="Flight control panel"
      aria-expanded={isExpanded}
    >
      {/* Collapsed view - compact summary */}
      {!isExpanded && (
        <button
          type="button"
          className="panel-collapsed-content"
          onClick={toggleExpanded}
          aria-label="Expand control panel"
        >
          <div className="panel-pill">
            <span className="panel-pill-icon live-dot" />
            <span className="panel-pill-text">Live</span>
          </div>
          <div className="panel-stats">
            <div className="panel-stat">
              <span className="stat-value">{isLoading ? "–" : flightCount}</span>
              <span className="stat-label">Flights</span>
            </div>
            <div className="panel-stat">
              <span className={`stat-value ${conflictCount > 0 ? "alert" : ""}`}>
                {isLoading ? "–" : conflictCount}
              </span>
              <span className="stat-label">Conflicts</span>
            </div>
            <div className="panel-stat">
              <span className="stat-value">{isLoading ? "–" : hotspotCount}</span>
              <span className="stat-label">Hotspots</span>
            </div>
          </div>
          <div className="panel-expand-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      )}

      {/* Expanded view - full dashboard */}
      {isExpanded && (
        <>
          {/* Header with collapse button */}
          <div className="panel-header">
            <div className="panel-header-left">
              <span className="panel-pill small">
                <span className="panel-pill-icon live-dot" />
                <span className="panel-pill-text">Live</span>
              </span>
              <span className="panel-title">Control Center</span>
            </div>
            <button
              type="button"
              className="panel-close-btn"
              onClick={toggleExpanded}
              aria-label="Collapse panel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="panel-content">{children}</div>

          {/* Resize handle */}
          <div
            className="panel-resize-handle"
            onMouseDown={handleMouseDown}
            role="separator"
            aria-label="Resize panel"
            tabIndex={0}
          />
        </>
      )}
    </div>
  );
}
