import { useEffect, useMemo, useState, useCallback } from "react";
import GlobeView from "./components/GlobeView.jsx";
import ControlCenter from "./components/ControlCenter.jsx";
import TopBar from "./components/TopBar.jsx";
import Toast from "./components/Toast.jsx";

// ============================================================================
// App: FlightRadar24-style layout with full-screen globe and expandable panel
// ============================================================================

const API_URL = "http://localhost:8001/analyze";
const LOAD_URL = "http://localhost:8001/load-data";
const APPLY_URL = "http://localhost:8001/apply";
const SAVE_URL = "http://localhost:8001/save-data";

// Debug: Test backend connection on startup
if (typeof window !== "undefined") {
  fetch(LOAD_URL)
    .then((r) => console.log("Backend test - load-data status:", r.status))
    .catch((e) => console.error("Backend test - load-data failed:", e));
}

export default function App() {
  // Data state
  const [input, setInput] = useState("[]");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Live tracking state
  const [liveMode, setLiveMode] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [autoRefreshSec, setAutoRefreshSec] = useState(15);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState("");
  const [isFetchingData, setIsFetchingData] = useState(false);

  // Selection state
  const [selectedConflictKey, setSelectedConflictKey] = useState("");
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [compareKeys, setCompareKeys] = useState([]);
  const [hoveredFlightId, setHoveredFlightId] = useState(null);

  // Proposal preview state
  const [previewProposal, setPreviewProposal] = useState(null); // { flightId, action, originalTrajectory, previewTrajectory }
  const [appliedActions, setAppliedActions] = useState([]); // List of applied actions
  const [isApplying, setIsApplying] = useState(false);

  // UI state
  const [toastMessage, setToastMessage] = useState("");

  // Derived data
  const summary = useMemo(() => {
    if (!result) return { flights: 0, conflicts: 0, hotspots: 0, issues: 0 };
    return {
      flights: Array.isArray(result.flights) ? result.flights.length : 0,
      conflicts: result.conflicts?.length || 0,
      hotspots: result.hotspots?.length || 0,
      issues: result.issues?.length || 0,
    };
  }, [result]);

  const flights = useMemo(() => {
    return result?.flights || [];
  }, [result]);

  const trajectories = useMemo(() => {
    return result?.trajectories || {};
  }, [result]);

  const flightIds = useMemo(() => {
    return flights.map((f) => f.ACID);
  }, [flights]);

  // Get highlighted flights from compare keys
  const highlightedFlights = useMemo(() => {
    const ids = new Set();
    compareKeys.forEach((key) => {
      const [a, b] = key.split("-");
      if (a) ids.add(a);
      if (b) ids.add(b);
    });
    return Array.from(ids);
  }, [compareKeys]);

  const isLoading = status === "loading" || isFetchingData;

  // Run analysis
  const runAnalyze = useCallback(async (payloadOverride) => {
    setStatus("loading");
    setError("");
    try {
      const payload = payloadOverride || JSON.parse(input);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }
      const data = await response.json();
      setResult({ ...data, flights: payload });
      setStatus("done");
      setLastAnalyzedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || "Failed to analyze");
      setStatus("error");
    }
  }, [input]);

  // Load shared file
  const loadSharedFile = useCallback(async () => {
    setError("");
    setIsFetchingData(true);
    try {
      const response = await fetch(LOAD_URL);
      if (!response.ok) {
        throw new Error(`Load error ${response.status}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error("No flights found in shared file");
      }
      setInput(JSON.stringify(payload, null, 2));
      if (autoAnalyze) {
        await runAnalyze(payload);
      }
      setLastLoadedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || "Failed to load shared file");
    } finally {
      setIsFetchingData(false);
    }
  }, [autoAnalyze, runAnalyze]);

  // Live data polling
  useEffect(() => {
    if (!liveMode) return undefined;
    loadSharedFile();
    const interval = setInterval(() => {
      loadSharedFile();
    }, Math.max(5, autoRefreshSec) * 1000);
    return () => clearInterval(interval);
  }, [liveMode, autoRefreshSec, loadSharedFile]);

  // Handlers
  const handleConflictSelect = useCallback((key) => {
    setSelectedConflictKey((prev) => (prev === key ? "" : key));
    // Also highlight the flights on the globe
    if (key) {
      const [a] = key.split("-");
      setSelectedFlightId(a);
    } else {
      setSelectedFlightId(null);
    }
  }, []);

  const handleConflictCompare = useCallback((key) => {
    setCompareKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 2) return prev;
      return [...prev, key];
    });
  }, []);

  const handleFlightClick = useCallback((acid) => {
    setSelectedFlightId(acid);
    setToastMessage(`Selected: ${acid}`);
    setTimeout(() => setToastMessage(""), 2000);
  }, []);

  const handleFlightHover = useCallback((acid) => {
    setHoveredFlightId(acid);
  }, []);

  const handleSearch = useCallback((acid) => {
    if (acid && flightIds.includes(acid)) {
      setSelectedFlightId(acid);
      setToastMessage(`Found: ${acid}`);
      setTimeout(() => setToastMessage(""), 2000);
    } else if (acid) {
      setToastMessage(`Flight ${acid} not found`);
      setTimeout(() => setToastMessage(""), 2000);
    }
  }, [flightIds]);

  // Preview a proposal on the globe before applying
  const handlePreviewProposal = useCallback((proposal) => {
    if (!proposal) {
      setPreviewProposal(null);
      return;
    }
    // Extract flight ID and show preview
    const flightId = proposal.flight_id;
    setPreviewProposal({
      flightId,
      action: proposal,
      summary: proposal.summary,
    });
    setSelectedFlightId(flightId);
    setToastMessage(`Preview: ${proposal.summary}`);
    setTimeout(() => setToastMessage(""), 2000);
  }, []);

  // Apply a proposal to the backend
  const handleApplyProposal = useCallback(async (proposalKey, proposal) => {
    console.log("Apply proposal called:", { proposalKey, proposal });
    
    if (!proposal || isApplying) {
      console.log("Skipping - proposal:", proposal, "isApplying:", isApplying);
      return;
    }

    setIsApplying(true);
    setToastMessage(`Applying: ${proposal.summary}...`);

    try {
      // Build the action payload for the backend
      const action = {
        flight_id: proposal.flight_id,
        delta_altitude_ft: proposal.delta_altitude_ft || null,
        delta_speed_kt: proposal.delta_speed_kt || null,
        delta_departure_min: proposal.delta_departure_min || null,
        reroute_waypoint: proposal.reroute_waypoint || null,
      };

      console.log("Action payload:", action);

      // Get current flights data
      let currentFlights;
      try {
        currentFlights = JSON.parse(input);
      } catch (parseErr) {
        throw new Error("Failed to parse flight data");
      }
      
      if (!currentFlights || currentFlights.length === 0) {
        throw new Error("No flight data available. Please wait for data to load.");
      }
      
      console.log("Current flights count:", currentFlights.length);

      const requestBody = {
        flights: currentFlights,
        actions: [action],
      };
      console.log("Request body:", JSON.stringify(requestBody).substring(0, 500));

      // Call the apply endpoint
      const response = await fetch(APPLY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Apply failed: ${response.status}`);
      }

      const data = await response.json();

      // Update the flights with revised data
      if (data.revised && data.revised.length > 0) {
        setInput(JSON.stringify(data.revised, null, 2));

        // Track applied action
        setAppliedActions((prev) => [
          {
            key: proposalKey,
            flightId: proposal.flight_id,
            summary: proposal.summary,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 19), // Keep last 20
        ]);

        // Save changes to the JSON file (persist to disk)
        try {
          const saveResponse = await fetch(SAVE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.revised),
          });
          const saveResult = await saveResponse.json();
          if (saveResult.success) {
            console.log("Changes saved to file:", saveResult.message);
          } else {
            console.warn("Failed to save changes:", saveResult.error);
          }
        } catch (saveErr) {
          console.warn("Could not save changes to file:", saveErr);
        }

        // Re-run analysis with the revised flights
        setToastMessage(`Applied! Re-analyzing...`);
        await runAnalyze(data.revised);

        // Clear preview
        setPreviewProposal(null);
        setSelectedConflictKey("");
        setToastMessage(`Success: ${proposal.summary}`);
      }
    } catch (err) {
      console.error("Apply error:", err);
      setError(err.message || "Failed to apply proposal");
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setIsApplying(false);
      setTimeout(() => setToastMessage(""), 3000);
    }
  }, [input, isApplying, runAnalyze]);

  // Cancel preview
  const handleCancelPreview = useCallback(() => {
    setPreviewProposal(null);
    setToastMessage("");
  }, []);

  return (
    <div className="fr24-app">
      {/* Full-screen globe background */}
      <GlobeView
        flights={flights}
        trajectories={trajectories}
        selectedFlightId={selectedFlightId}
        highlightedFlights={highlightedFlights}
        onFlightClick={handleFlightClick}
        onFlightHover={handleFlightHover}
        previewProposal={previewProposal}
      />

      {/* Top bar with search */}
      <TopBar
        onSearch={handleSearch}
        isLive={liveMode && !error}
        lastUpdated={lastLoadedAt}
        flightSuggestions={flightIds}
      />

      {/* Control Center - 3-state drawer */}
      <ControlCenter
        result={result}
        status={status}
        error={error}
        isLoading={isLoading || isApplying}
        liveMode={liveMode}
        lastLoadedAt={lastLoadedAt}
        lastAnalyzedAt={lastAnalyzedAt}
        autoAnalyze={autoAnalyze}
        autoRefreshSec={autoRefreshSec}
        onLiveModeChange={setLiveMode}
        onAutoAnalyzeChange={setAutoAnalyze}
        onRefreshSecChange={setAutoRefreshSec}
        onAnalyze={() => runAnalyze()}
        selectedConflictKey={selectedConflictKey}
        compareKeys={compareKeys}
        onSelectConflict={handleConflictSelect}
        onSelectHotspot={(cellId) => {
          // Highlight hotspot on map
          console.log("Highlight hotspot on map:", cellId);
          setToastMessage(`Hotspot: ${cellId}`);
          setTimeout(() => setToastMessage(""), 2000);
        }}
        onPreviewProposal={handlePreviewProposal}
        onApplyProposal={handleApplyProposal}
        onCancelPreview={handleCancelPreview}
        previewProposal={previewProposal}
        appliedActions={appliedActions}
        isApplying={isApplying}
        onConflictCompare={handleConflictCompare}
      />

      {/* Toast notifications */}
      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
