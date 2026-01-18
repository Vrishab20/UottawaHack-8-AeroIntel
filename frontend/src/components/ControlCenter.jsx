import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import SkeletonCard from "./SkeletonCard.jsx";

// ============================================================================
// ControlCenter: FR24-style drawer with 3 states
// ----------------------------------------------------------------------------
// States:
//   - collapsed: Small pill showing LIVE + counts
//   - docked: Left sidebar with scrollable content
//   - fullscreen: Full overlay with 2-column layout
// 
// Keyboard:
//   - Esc: Exit fullscreen to docked
//   - Enter: Expand collapsed to docked
//
// LocalStorage: "control_center_state" = collapsed|docked|fullscreen
// ============================================================================

const STORAGE_KEY = "control_center_state";
const DEFAULT_STATE = "docked";

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768;

export default function ControlCenter({
  // Data props
  result = null,
  status = "idle",
  error = null,
  isLoading = false,
  // Live tracking props
  liveMode = false,
  lastLoadedAt = null,
  lastAnalyzedAt = null,
  autoAnalyze = false,
  autoRefreshSec = 15,
  onLiveModeChange = () => {},
  onAutoAnalyzeChange = () => {},
  onRefreshSecChange = () => {},
  onAnalyze = () => {},
  // Selection props
  selectedConflictKey = "",
  compareKeys = [],
  // Callback props for map integration
  onSelectConflict = () => {},
  onSelectHotspot = () => {},
  onPreviewProposal = () => {},
  onApplyProposal = () => {},
  onCancelPreview = () => {},
  onConflictCompare = () => {},
  // Preview/apply state from parent
  previewProposal = null,
  appliedActions = [],
  isApplying = false,
}) {
  // Panel state: collapsed | docked | fullscreen
  const [panelState, setPanelState] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "collapsed" || saved === "docked" || saved === "fullscreen") {
          return saved;
        }
      }
    } catch (e) {
      console.error("Error reading panel state from localStorage:", e);
    }
    return DEFAULT_STATE;
  });

  // Safe state setter to prevent invalid states
  const setSafePanelState = useCallback((newState) => {
    const validStates = ["collapsed", "docked", "fullscreen"];
    if (typeof newState === 'function') {
      setPanelState(prev => {
        const next = newState(prev);
        return validStates.includes(next) ? next : DEFAULT_STATE;
      });
    } else if (validStates.includes(newState)) {
      setPanelState(newState);
    } else {
      console.error("Invalid panel state:", newState);
      setPanelState(DEFAULT_STATE);
    }
  }, []);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("conflicts");

  // Applied changes panel visibility
  const [showApplied, setShowApplied] = useState(true);

  // Filter/search states
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const [showAllHotspots, setShowAllHotspots] = useState(false);
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [expandedProposalKeys, setExpandedProposalKeys] = useState({});

  const panelRef = useRef(null);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, panelState);
    } catch (e) {
      console.error("Failed to save panel state:", e);
    }
  }, [panelState]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && panelState === "fullscreen") {
        setSafePanelState("docked");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelState, setSafePanelState]);

  // Derived data with safe defaults
  const summary = useMemo(() => {
    try {
      if (!result) return { flights: 0, conflicts: 0, hotspots: 0, issues: 0 };
      return {
        flights: Array.isArray(result.flights) ? result.flights.length : 0,
        conflicts: Array.isArray(result.conflicts) ? result.conflicts.length : 0,
        hotspots: Array.isArray(result.hotspots) ? result.hotspots.length : 0,
        issues: Array.isArray(result.issues) ? result.issues.length : 0,
      };
    } catch (e) {
      console.error("Error computing summary:", e);
      return { flights: 0, conflicts: 0, hotspots: 0, issues: 0 };
    }
  }, [result]);

  const conflictCards = Array.isArray(result?.conflicts) ? result.conflicts : [];
  const hotspotCards = Array.isArray(result?.hotspots) ? result.hotspots : [];
  const proposalEntries = result?.proposals && typeof result.proposals === 'object' 
    ? Object.entries(result.proposals) 
    : [];
  const issuesList = Array.isArray(result?.issues) ? result.issues : [];

  const getSeverityBand = (value) => {
    if (value >= 1.5) return "critical";
    if (value >= 1.0) return "high";
    return "medium";
  };

  const filteredConflicts = conflictCards
    .filter((conflict) => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return (
        conflict.flight_a.toLowerCase().includes(query) ||
        conflict.flight_b.toLowerCase().includes(query)
      );
    })
    .filter((conflict) => {
      if (severityFilter === "all") return true;
      return severityFilter === getSeverityBand(conflict.severity);
    })
    .sort((a, b) => b.severity - a.severity);

  const displayedConflicts = showAllConflicts ? filteredConflicts : filteredConflicts.slice(0, 5);
  const displayedHotspots = showAllHotspots ? hotspotCards : hotspotCards.slice(0, 5);
  const displayedProposals = showAllProposals ? proposalEntries : proposalEntries.slice(0, 5);

  const conflictKey = (conflict) => `${conflict.flight_a}-${conflict.flight_b}`;
  const isConflictFocused = (key) => selectedConflictKey === key;

  // Handlers
  const handleHotspotClick = (cell, index) => {
    // Hook placeholder: highlight hotspot on map
    onSelectHotspot(`${cell.lat_bucket}-${cell.lon_bucket}-${cell.altitude_band}`);
  };

  // State toggles
  const toggleFullscreen = () => {
    setSafePanelState((prev) => (prev === "fullscreen" ? "docked" : "fullscreen"));
  };


  // ============================================================================
  // RENDER: Content sections (shared between docked and fullscreen)
  // ============================================================================
  const renderLiveControls = () => (
    <div className="cc-section cc-live-section">
      <div className="cc-toggles">
        <label className="cc-toggle">
          <input
            type="checkbox"
            checked={liveMode}
            onChange={(e) => onLiveModeChange(e.target.checked)}
          />
          <span>Live tracking</span>
        </label>
        <label className="cc-toggle">
          <input
            type="checkbox"
            checked={autoAnalyze}
            onChange={(e) => onAutoAnalyzeChange(e.target.checked)}
          />
          <span>Auto analyze</span>
        </label>
      </div>
      
      {/* Refresh interval control */}
      <div className="cc-refresh-control">
        <label className="cc-refresh-label">Refresh every:</label>
        <div className="cc-refresh-buttons">
          {[5, 10, 15, 30, 60].map((sec) => (
            <button
              key={sec}
              type="button"
              className={`cc-refresh-btn ${autoRefreshSec === sec ? "active" : ""}`}
              onClick={() => onRefreshSecChange(sec)}
              disabled={!liveMode}
            >
              {sec < 60 ? `${sec}s` : "1m"}
            </button>
          ))}
        </div>
      </div>

      <div className="cc-timestamps">
        {lastLoadedAt && <span>Updated: {lastLoadedAt}</span>}
        {lastAnalyzedAt && <span>Analyzed: {lastAnalyzedAt}</span>}
      </div>
      <button
        type="button"
        className="cc-analyze-btn"
        onClick={onAnalyze}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Analyzing..." : "Analyze Now"}
      </button>
      {error && <div className="cc-error">{error}</div>}
    </div>
  );

  const renderMetrics = () => (
    <div className="cc-metrics">
      <div className="cc-metric">
        <span className="cc-metric-value">{isLoading ? "–" : summary.flights}</span>
        <span className="cc-metric-label">Flights</span>
      </div>
      <div className="cc-metric">
        <span className={`cc-metric-value ${summary.conflicts > 0 ? "alert" : ""}`}>
          {isLoading ? "–" : summary.conflicts}
        </span>
        <span className="cc-metric-label">Conflicts</span>
      </div>
      <div className="cc-metric">
        <span className="cc-metric-value">{isLoading ? "–" : summary.hotspots}</span>
        <span className="cc-metric-label">Hotspots</span>
      </div>
      <div className="cc-metric">
        <span className="cc-metric-value">{isLoading ? "–" : summary.issues}</span>
        <span className="cc-metric-label">Issues</span>
      </div>
    </div>
  );

  const renderConflicts = () => (
    <div className="cc-section">
      <div className="cc-section-header">
        <h3>Conflicts</h3>
        <span className="cc-count">{filteredConflicts.length}</span>
        {filteredConflicts.length > 5 && (
          <button type="button" className="cc-link" onClick={() => setShowAllConflicts((p) => !p)}>
            {showAllConflicts ? "Less" : "All"}
          </button>
        )}
      </div>
      <p className="cc-insight">Most conflicts cluster near cruise altitude along east–west corridors.</p>

      <div className="cc-filters">
        <input
          type="text"
          placeholder="Search ACID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="cc-search"
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="cc-select"
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
      </div>

      <div className="cc-list">
        {isLoading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={`cs-${i}`} />)
        ) : displayedConflicts.length ? (
          displayedConflicts.map((conflict, index) => {
            const key = conflictKey(conflict);
            const band = getSeverityBand(conflict.severity);
            const isCompared = Array.isArray(compareKeys) && compareKeys.includes(key);
            return (
              <div
                key={`${key}-${index}`}
                className={`cc-card ${isConflictFocused(key) ? "focused" : ""}`}
                onClick={() => onSelectConflict(key)}
                role="button"
                tabIndex={0}
              >
                <div className="cc-card-row">
                  <span className="cc-card-title">{conflict.flight_a} vs {conflict.flight_b}</span>
                  <span className={`cc-badge ${band}`}>{conflict.severity.toFixed(2)}</span>
                </div>
                <div className="cc-card-meta">
                  {conflict.min_horizontal_nm} nm / {conflict.min_vertical_ft} ft
                </div>
                <div className="cc-card-actions">
                  <button
                    type="button"
                    className={`cc-chip cc-compare-btn ${isCompared ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onConflictCompare(key);
                    }}
                  >
                    {isCompared ? "Exit Compare" : "Compare"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="cc-empty">No conflicts detected.</p>
        )}
      </div>
    </div>
  );

  const renderHotspots = () => (
    <div className="cc-section">
      <div className="cc-section-header">
        <h3>Hotspots</h3>
        <span className="cc-count">{hotspotCards.length}</span>
        {hotspotCards.length > 5 && (
          <button type="button" className="cc-link" onClick={() => setShowAllHotspots((p) => !p)}>
            {showAllHotspots ? "Less" : "All"}
          </button>
        )}
      </div>
      <p className="cc-insight">Congestion peaks around shared mid-route waypoints.</p>

      <div className="cc-list">
        {isLoading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={`hs-${i}`} />)
        ) : displayedHotspots.length ? (
          displayedHotspots.map((cell, index) => (
            <div
              key={`hotspot-${index}`}
              className="cc-card"
              onClick={() => handleHotspotClick(cell, index)}
              role="button"
              tabIndex={0}
            >
              <div className="cc-card-row">
                <span className="cc-card-title">
                  {cell.lat_bucket}/{cell.lon_bucket}/{cell.altitude_band}
                </span>
                <span className="cc-badge info">{cell.score}</span>
              </div>
              <div className="cc-card-meta">
                Peak: {cell.peak_density} | Flights: {cell.unique_flights}
              </div>
            </div>
          ))
        ) : (
          <p className="cc-empty">No hotspots.</p>
        )}
      </div>
    </div>
  );

  // Filter proposals based on selected conflict
  const filteredProposals = useMemo(() => {
    if (!selectedConflictKey) return proposalEntries;
    // Match proposals that contain either flight from the conflict
    const [flightA, flightB] = selectedConflictKey.split("-");
    return proposalEntries.filter(([key]) => {
      return key.includes(flightA) || key.includes(flightB);
    });
  }, [proposalEntries, selectedConflictKey]);

  const displayedFilteredProposals = showAllProposals 
    ? filteredProposals 
    : filteredProposals.slice(0, 5);

  // Check if a proposal option is currently being previewed
  const isPreviewingOption = (candidate) => {
    if (!previewProposal) return false;
    return previewProposal.flightId === candidate.flight_id && 
           previewProposal.summary === candidate.summary;
  };

  const renderProposals = () => (
    <div className="cc-section">
      <div className="cc-section-header">
        <h3>Proposals</h3>
        <span className="cc-count">{filteredProposals.length}</span>
        {selectedConflictKey && (
          <span className="cc-filter-badge">
            Filtered: {selectedConflictKey}
            <button
              type="button"
              className="cc-clear-filter"
              onClick={() => onSelectConflict("")}
              aria-label="Clear filter"
            >
              ×
            </button>
          </span>
        )}
        {filteredProposals.length > 5 && (
          <button type="button" className="cc-link" onClick={() => setShowAllProposals((p) => !p)}>
            {showAllProposals ? "Less" : "All"}
          </button>
        )}
      </div>
      
      {/* Preview mode banner */}
      {previewProposal && (
        <div className="cc-preview-banner">
          <span className="cc-preview-icon">👁</span>
          <span>Previewing: {previewProposal.summary}</span>
          <button type="button" className="cc-preview-cancel" onClick={onCancelPreview}>
            Cancel
          </button>
        </div>
      )}

      {selectedConflictKey ? (
        <p className="cc-insight">Showing proposals for conflict: {selectedConflictKey}. Hover to preview on map.</p>
      ) : (
        <p className="cc-insight">Click a conflict to see its proposals. Hover to preview, click Apply to execute.</p>
      )}

      <div className="cc-list">
        {isLoading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={`ps-${i}`} />)
        ) : displayedFilteredProposals.length ? (
          displayedFilteredProposals.map(([key, candidates]) => {
            return (
              <div key={key} className="cc-card proposal-group">
                <div className="cc-card-row">
                  <span className="cc-card-title">{key}</span>
                  <span className="cc-options-count">{candidates.length} options</span>
                </div>
                
                {/* Show all proposal options as selectable cards */}
                <div className="cc-proposal-options">
                  {candidates.map((candidate, idx) => {
                    const isPreviewing = isPreviewingOption(candidate);
                    return (
                      <div 
                        key={`${key}-opt-${idx}`} 
                        className={`cc-proposal-option ${idx === 0 ? "recommended" : ""} ${isPreviewing ? "previewing" : ""}`}
                        onMouseEnter={() => onPreviewProposal(candidate)}
                        onMouseLeave={() => !isPreviewing && onPreviewProposal(null)}
                      >
                        <div className="cc-option-header">
                          {isPreviewing && <span className="cc-option-badge previewing">Previewing</span>}
                          {!isPreviewing && idx === 0 && <span className="cc-option-badge recommended">Recommended</span>}
                          {!isPreviewing && idx === 1 && <span className="cc-option-badge alt">Alternative 1</span>}
                          {!isPreviewing && idx === 2 && <span className="cc-option-badge alt">Alternative 2</span>}
                          {!isPreviewing && idx > 2 && <span className="cc-option-badge alt">Option {idx + 1}</span>}
                        </div>
                        <div className="cc-option-summary">{candidate.summary}</div>
                        <div className="cc-option-details">
                          {candidate.delta_altitude_ft && (
                            <span className="cc-option-detail">Alt: {candidate.delta_altitude_ft > 0 ? "+" : ""}{candidate.delta_altitude_ft} ft</span>
                          )}
                          {candidate.delta_speed_kt && (
                            <span className="cc-option-detail">Speed: {candidate.delta_speed_kt > 0 ? "+" : ""}{candidate.delta_speed_kt} kt</span>
                          )}
                          {candidate.delta_departure_min && (
                            <span className="cc-option-detail">Dep: {candidate.delta_departure_min > 0 ? "+" : ""}{candidate.delta_departure_min} min</span>
                          )}
                        </div>
                        <div className="cc-option-footer">
                          <span className="cc-option-score">Score: {typeof candidate.score === 'number' ? candidate.score.toFixed(2) : candidate.score}</span>
                          <button
                            type="button"
                            className={`cc-apply-btn ${idx === 0 ? "primary" : "secondary"} ${isApplying ? "loading" : ""}`}
                            onClick={() => onApplyProposal(key, candidate)}
                            disabled={isApplying}
                          >
                            {isApplying ? "Applying..." : "Apply"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : selectedConflictKey ? (
          <p className="cc-empty">No proposals found for this conflict.</p>
        ) : (
          <p className="cc-empty">No proposals yet. Select a conflict to see available options.</p>
        )}
      </div>
    </div>
  );

  const renderIssues = () => (
    <div className="cc-section">
      <div className="cc-section-header">
        <h3>Issues</h3>
        <span className="cc-count">{issuesList.length}</span>
      </div>
      <div className="cc-list">
        {issuesList.length ? (
          issuesList.slice(0, 10).map((issue, index) => (
            <div key={`issue-${index}`} className="cc-card issue">
              <span className="cc-issue-text">{issue}</span>
            </div>
          ))
        ) : (
          <p className="cc-empty">No issues.</p>
        )}
      </div>
    </div>
  );

  const renderAppliedChanges = () => {
    const safeAppliedActions = Array.isArray(appliedActions) ? appliedActions : [];
    
    return (
      <div className={`cc-applied ${showApplied ? "open" : "closed"}`}>
        <div className="cc-applied-header" onClick={() => setShowApplied((p) => !p)}>
          <span>Applied Changes ({safeAppliedActions.length})</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={showApplied ? "rotated" : ""}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {showApplied && safeAppliedActions.length > 0 && (
          <div className="cc-applied-list">
            {safeAppliedActions.map((change, index) => (
              <div key={`applied-${index}`} className="cc-applied-item">
                <div className="cc-applied-info">
                  <span className="cc-applied-flight">{change?.flightId || "Unknown"}</span>
                  <span className="cc-applied-action">{change?.summary || "No summary"}</span>
                </div>
                <span className="cc-applied-time">{change?.timestamp || ""}</span>
              </div>
            ))}
          </div>
        )}
        {showApplied && safeAppliedActions.length === 0 && (
          <div className="cc-applied-empty">No changes applied yet</div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: Docked state
  // ============================================================================
  if (panelState === "docked") {
    return (
      <div className="cc-docked" ref={panelRef}>
        {/* Header */}
        <div className="cc-header">
          <div className="cc-header-left">
            <div className="cc-live-badge">
              <span className="cc-live-dot" />
              <span>LIVE</span>
            </div>
            <span className="cc-title">Control Center</span>
          </div>
          <div className="cc-header-right">
            <button
              type="button"
              className="cc-header-btn"
              onClick={toggleFullscreen}
              aria-label="Expand to fullscreen"
              title="Fullscreen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sticky metrics */}
        <div className="cc-sticky-section">
          {renderLiveControls()}
          {renderMetrics()}
        </div>

        {/* Scrollable content */}
        <div className="cc-scroll">
          {renderConflicts()}
          {renderHotspots()}
          {renderProposals()}
          {renderIssues()}
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: Fullscreen state
  // ============================================================================
  return (
    <>
      {/* Scrim overlay */}
      <div className="cc-scrim" onClick={() => setSafePanelState("docked")} />

      <div className="cc-fullscreen" ref={panelRef}>
        {/* Header */}
        <div className="cc-header">
          <div className="cc-header-left">
            <div className="cc-live-badge">
              <span className="cc-live-dot" />
              <span>LIVE</span>
            </div>
            <span className="cc-title">Control Center</span>
          </div>
          <div className="cc-header-right">
            <button
              type="button"
              className="cc-header-btn"
              onClick={toggleFullscreen}
              aria-label="Exit fullscreen"
              title="Exit Fullscreen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 4 20 10 20" />
                <polyline points="20 10 20 4 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
            <button
              type="button"
              className="cc-header-btn close"
              onClick={() => setSafePanelState("docked")}
              aria-label="Close"
              title="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sticky section */}
        <div className="cc-sticky-section">
          {renderLiveControls()}
          {renderMetrics()}
        </div>

        {/* Mobile: Tabs */}
        {isMobile && (
          <div className="cc-tabs">
            {["conflicts", "hotspots", "proposals", "issues"].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`cc-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="cc-fullscreen-content">
          {isMobile ? (
            // Mobile: Single tab content
            <div className="cc-tab-content">
              {activeTab === "conflicts" && renderConflicts()}
              {activeTab === "hotspots" && renderHotspots()}
              {activeTab === "proposals" && renderProposals()}
              {activeTab === "issues" && renderIssues()}
            </div>
          ) : (
            // Desktop: 2-column layout
            <>
              <div className="cc-column cc-column-left">
                {renderConflicts()}
              </div>
              <div className="cc-column cc-column-right">
                {renderHotspots()}
                {renderProposals()}
                {renderIssues()}
              </div>
            </>
          )}
        </div>

        {/* Applied changes tray */}
        {renderAppliedChanges()}
      </div>
    </>
  );
}
