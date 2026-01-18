import { useMemo, useRef, useState } from "react";
import MetricTile from "./MetricTile.jsx";
import SectionHeader from "./SectionHeader.jsx";
import SkeletonCard from "./SkeletonCard.jsx";

// ============================================================================
// DashboardContent: The actual dashboard UI extracted for use in ControlPanel
// ============================================================================

export default function DashboardContent({
  result,
  status,
  error,
  isLoading,
  liveMode,
  lastLoadedAt,
  lastAnalyzedAt,
  autoAnalyze,
  autoRefreshSec,
  onLiveModeChange,
  onAutoAnalyzeChange,
  onRefreshSecChange,
  onAnalyze,
  onConflictSelect,
  onConflictCompare,
  selectedConflictKey,
  compareKeys,
  highlightedFlights,
}) {
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const [showAllHotspots, setShowAllHotspots] = useState(false);
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [hoveredConflictKey, setHoveredConflictKey] = useState("");
  const [expandedProposalKeys, setExpandedProposalKeys] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortMode, setSortMode] = useState("severity");
  const proposalsRef = useRef(null);

  const summary = useMemo(() => {
    if (!result) return { flights: 0, conflicts: 0, hotspots: 0, issues: 0 };
    return {
      flights: Array.isArray(result.flights) ? result.flights.length : 0,
      conflicts: result.conflicts?.length || 0,
      hotspots: result.hotspots?.length || 0,
      issues: result.issues?.length || 0,
    };
  }, [result]);

  const conflictCards = result?.conflicts || [];
  const hotspotCards = result?.hotspots || [];
  const proposalEntries = result?.proposals ? Object.entries(result.proposals) : [];

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
    .sort((a, b) => {
      if (sortMode === "separation") return a.min_horizontal_nm - b.min_horizontal_nm;
      return b.severity - a.severity;
    });

  const displayedConflicts = showAllConflicts ? filteredConflicts : filteredConflicts.slice(0, 3);
  const displayedHotspots = showAllHotspots ? hotspotCards : hotspotCards.slice(0, 3);
  const displayedProposals = showAllProposals ? proposalEntries : proposalEntries.slice(0, 3);

  const conflictKey = (conflict) => `${conflict.flight_a}-${conflict.flight_b}`;
  const isConflictFocused = (key) => selectedConflictKey === key;
  const isConflictDimmed = (key) => selectedConflictKey && selectedConflictKey !== key;

  const skeletonItems = new Array(3).fill(null);

  const aiInsight = {
    conflicts: "Most conflicts cluster near cruise altitude along east–west corridors.",
    hotspots: "Congestion peaks around shared mid-route waypoints.",
    proposals: "Small altitude changes resolve most conflicts with minimal delay.",
  };

  const isProposalRelated = (key) => {
    if (!selectedConflictKey) return true;
    return key.startsWith(`${selectedConflictKey}:`) || key.startsWith(selectedConflictKey);
  };

  return (
    <div className="dashboard-content">
      {/* Live controls */}
      <div className="dash-section">
        <div className="dash-controls">
          <label className="dash-toggle">
            <input
              type="checkbox"
              checked={liveMode}
              onChange={(e) => onLiveModeChange(e.target.checked)}
            />
            <span>Live tracking</span>
          </label>
          <label className="dash-toggle">
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={(e) => onAutoAnalyzeChange(e.target.checked)}
            />
            <span>Auto analyze</span>
          </label>
        </div>
        <div className="dash-status">
          {lastLoadedAt && <span>Updated: {lastLoadedAt}</span>}
          {lastAnalyzedAt && <span>Analyzed: {lastAnalyzedAt}</span>}
        </div>
        <button
          type="button"
          className="dash-analyze-btn"
          onClick={onAnalyze}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Analyzing..." : "Analyze Now"}
        </button>
        {error && <div className="dash-error">{error}</div>}
      </div>

      {/* Metrics */}
      <div className="dash-metrics">
        <div className="dash-metric">
          <span className="metric-value">{isLoading ? "–" : summary.flights}</span>
          <span className="metric-label">Flights</span>
        </div>
        <div className="dash-metric">
          <span className={`metric-value ${summary.conflicts > 0 ? "alert" : ""}`}>
            {isLoading ? "–" : summary.conflicts}
          </span>
          <span className="metric-label">Conflicts</span>
        </div>
        <div className="dash-metric">
          <span className="metric-value">{isLoading ? "–" : summary.hotspots}</span>
          <span className="metric-label">Hotspots</span>
        </div>
      </div>

      {/* Conflicts section */}
      <div className="dash-section">
        <div className="dash-section-header">
          <h3>Conflicts</h3>
          <span className="dash-count">{filteredConflicts.length}</span>
          {filteredConflicts.length > 3 && (
            <button
              type="button"
              className="dash-link"
              onClick={() => setShowAllConflicts((p) => !p)}
            >
              {showAllConflicts ? "Less" : "All"}
            </button>
          )}
        </div>
        <p className="dash-insight">{aiInsight.conflicts}</p>

        {/* Search/filter */}
        <div className="dash-filters">
          <input
            type="text"
            placeholder="Search ACID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="dash-search"
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="dash-select"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>

        <div className="dash-cards">
          {isLoading ? (
            skeletonItems.map((_, i) => <SkeletonCard key={`cs-${i}`} />)
          ) : displayedConflicts.length ? (
            displayedConflicts.map((conflict, index) => {
              const key = conflictKey(conflict);
              const band = getSeverityBand(conflict.severity);
              const isCompared = compareKeys.includes(key);
              return (
                <div
                  key={`${key}-${index}`}
                  className={`dash-card ${isConflictFocused(key) ? "focused" : ""} ${
                    isConflictDimmed(key) ? "dimmed" : ""
                  }`}
                  onClick={() => onConflictSelect(key)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-row">
                    <span className="card-title">
                      {conflict.flight_a} vs {conflict.flight_b}
                    </span>
                    <span className={`card-badge ${band}`}>{conflict.severity.toFixed(2)}</span>
                  </div>
                  <div className="card-meta">
                    {conflict.min_horizontal_nm} nm / {conflict.min_vertical_ft} ft
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      className={`card-chip ${isCompared ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onConflictCompare(key);
                      }}
                    >
                      {isCompared ? "Comparing" : "Compare"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="dash-empty">No conflicts detected.</p>
          )}
        </div>
      </div>

      {/* Hotspots section */}
      <div className="dash-section">
        <div className="dash-section-header">
          <h3>Hotspots</h3>
          <span className="dash-count">{hotspotCards.length}</span>
          {hotspotCards.length > 3 && (
            <button
              type="button"
              className="dash-link"
              onClick={() => setShowAllHotspots((p) => !p)}
            >
              {showAllHotspots ? "Less" : "All"}
            </button>
          )}
        </div>
        <p className="dash-insight">{aiInsight.hotspots}</p>

        <div className="dash-cards">
          {isLoading ? (
            skeletonItems.map((_, i) => <SkeletonCard key={`hs-${i}`} />)
          ) : displayedHotspots.length ? (
            displayedHotspots.map((cell, index) => (
              <div key={`hotspot-${index}`} className="dash-card">
                <div className="card-row">
                  <span className="card-title">
                    {cell.lat_bucket}/{cell.lon_bucket}/{cell.altitude_band}
                  </span>
                  <span className="card-badge info">{cell.score}</span>
                </div>
                <div className="card-meta">
                  Peak: {cell.peak_density} | Flights: {cell.unique_flights}
                </div>
              </div>
            ))
          ) : (
            <p className="dash-empty">No hotspots.</p>
          )}
        </div>
      </div>

      {/* Proposals section */}
      <div className="dash-section" ref={proposalsRef}>
        <div className="dash-section-header">
          <h3>Proposals</h3>
          <span className="dash-count">{proposalEntries.length}</span>
          {proposalEntries.length > 3 && (
            <button
              type="button"
              className="dash-link"
              onClick={() => setShowAllProposals((p) => !p)}
            >
              {showAllProposals ? "Less" : "All"}
            </button>
          )}
        </div>
        <p className="dash-insight">{aiInsight.proposals}</p>

        <div className="dash-cards">
          {isLoading ? (
            skeletonItems.map((_, i) => <SkeletonCard key={`ps-${i}`} />)
          ) : displayedProposals.length ? (
            displayedProposals
              .filter(([key]) => isProposalRelated(key))
              .map(([key, candidates]) => {
                const [recommended, ...alternatives] = candidates;
                const isExpanded = expandedProposalKeys[key];
                return (
                  <div key={key} className="dash-card proposal">
                    <div className="card-row">
                      <span className="card-title">{key}</span>
                    </div>
                    <div className="proposal-recommended">
                      <span className="proposal-label">Recommended</span>
                      <div className="proposal-action">
                        {recommended.summary} — {recommended.score}
                      </div>
                    </div>
                    {alternatives.length > 0 && (
                      <div className="proposal-alts">
                        <button
                          type="button"
                          className="dash-link"
                          onClick={() =>
                            setExpandedProposalKeys((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                        >
                          {isExpanded ? "Hide" : `+${alternatives.length} alternatives`}
                        </button>
                        {isExpanded && (
                          <div className="proposal-alt-list">
                            {alternatives.map((c, i) => (
                              <div key={`${key}-alt-${i}`} className="proposal-alt-item">
                                {c.summary} — {c.score}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          ) : (
            <p className="dash-empty">No proposals yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
