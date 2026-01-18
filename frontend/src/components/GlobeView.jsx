import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ============================================================================
// GlobeView: Full-screen 3D globe using Mapbox GL JS
// ----------------------------------------------------------------------------
// Tunable values:
// - MAPBOX_TOKEN: Set your Mapbox access token
// - AUTO_ROTATE_SPEED: degrees per second when idle
// - IDLE_TIMEOUT_MS: time before auto-rotate starts
// - FLIGHT_UPDATE_INTERVAL: ms between flight position updates
// ============================================================================

// Your Mapbox access token - Add your API key here
// Get your free token at: https://account.mapbox.com/access-tokens/
const MAPBOX_TOKEN = "YOUR_MAPBOX_ACCESS_TOKEN_HERE";

const AUTO_ROTATE_SPEED = 0.3; // degrees per second
const IDLE_TIMEOUT_MS = 5000;
const FLIGHT_UPDATE_INTERVAL = 50; // ms

export default function GlobeView({
  flights = [],
  trajectories = {},
  selectedFlightId = null,
  onFlightClick = () => {},
  onFlightHover = () => {},
  highlightedFlights = [],
  previewProposal = null, // { flightId, action, summary }
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isIdle, setIsIdle] = useState(true);
  const [mapError, setMapError] = useState(null);
  const idleTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const flightPositionsRef = useRef({});
  const flightMarkersRef = useRef({});

  // Store callbacks in refs to avoid reinitializing map when they change
  const onFlightClickRef = useRef(onFlightClick);
  const onFlightHoverRef = useRef(onFlightHover);
  onFlightClickRef.current = onFlightClick;
  onFlightHoverRef.current = onFlightHover;

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reset idle timer on user interaction
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);
  }, []);

  // Initialize map
  useEffect(() => {
    // Guard: skip if no container or map already exists
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    // Clear any existing children in the container (for HMR/StrictMode)
    while (mapContainerRef.current.firstChild) {
      mapContainerRef.current.removeChild(mapContainerRef.current.firstChild);
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        name: "Dark Globe",
        sources: {
          // Use a simple dark raster basemap
          "simple-tiles": {
            type: "raster",
            tiles: [
              "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap &copy; CARTO",
          },
        },
        layers: [
          {
            id: "simple-tiles",
            type: "raster",
            source: "simple-tiles",
            minzoom: 0,
            maxzoom: 18,
          },
        ],
        fog: {
          color: "rgb(10, 20, 40)",
          "high-color": "rgb(20, 40, 80)",
          "horizon-blend": 0.08,
          "space-color": "rgb(5, 10, 20)",
          "star-intensity": 0.4,
        },
        projection: {
          name: "globe",
        },
      },
      center: [-95, 45], // Center on Canada
      zoom: 2.5,
      projection: "globe",
      maxPitch: 85,
    });

    // Add atmosphere effect
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(10, 20, 40)",
        "high-color": "rgb(20, 40, 80)",
        "horizon-blend": 0.08,
        "space-color": "rgb(5, 10, 20)",
        "star-intensity": 0.4,
      });
    });

    // Add navigation control (compass)
    map.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "bottom-right"
    );

    map.on("load", () => {
      setIsMapLoaded(true);

      // Add trajectory lines source
      map.addSource("trajectories", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Add trajectory lines layer
      map.addLayer({
        id: "trajectory-lines",
        type: "line",
        source: "trajectories",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.7,
        },
      });

      // Add flight points source
      map.addSource("flights", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Create custom airplane icons for different states
      const createAirplaneIcon = (color, size = 32) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        
        // Center point
        const cx = size / 2;
        const cy = size / 2;
        const scale = size / 32;
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // Draw airplane silhouette (pointing up)
        ctx.fillStyle = color;
        ctx.beginPath();
        
        // Fuselage
        ctx.moveTo(0, -12 * scale);  // Nose
        ctx.lineTo(2 * scale, -8 * scale);
        ctx.lineTo(2 * scale, 4 * scale);
        ctx.lineTo(4 * scale, 10 * scale);  // Tail right
        ctx.lineTo(0, 8 * scale);  // Tail center
        ctx.lineTo(-4 * scale, 10 * scale);  // Tail left
        ctx.lineTo(-2 * scale, 4 * scale);
        ctx.lineTo(-2 * scale, -8 * scale);
        ctx.closePath();
        ctx.fill();
        
        // Wings
        ctx.beginPath();
        ctx.moveTo(-12 * scale, 2 * scale);
        ctx.lineTo(-2 * scale, -2 * scale);
        ctx.lineTo(2 * scale, -2 * scale);
        ctx.lineTo(12 * scale, 2 * scale);
        ctx.lineTo(12 * scale, 4 * scale);
        ctx.lineTo(2 * scale, 0);
        ctx.lineTo(-2 * scale, 0);
        ctx.lineTo(-12 * scale, 4 * scale);
        ctx.closePath();
        ctx.fill();
        
        // Add subtle stroke
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        return ctx.getImageData(0, 0, size, size);
      };

      // Add airplane icons for different states
      map.addImage("airplane-default", createAirplaneIcon("#22c55e", 32));
      map.addImage("airplane-selected", createAirplaneIcon("#ef4444", 40));
      map.addImage("airplane-highlighted", createAirplaneIcon("#f97316", 36));
      map.addImage("airplane-preview", createAirplaneIcon("#fbbf24", 44));

      // Add flight icons layer (replaces circles)
      map.addLayer({
        id: "flight-icons",
        type: "symbol",
        source: "flights",
        layout: {
          "icon-image": [
            "case",
            ["boolean", ["get", "isPreviewing"], false],
            "airplane-preview",
            ["boolean", ["get", "selected"], false],
            "airplane-selected",
            ["boolean", ["get", "highlighted"], false],
            "airplane-highlighted",
            "airplane-default",
          ],
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-size": [
            "case",
            ["boolean", ["get", "isPreviewing"], false],
            1.2,
            ["boolean", ["get", "selected"], false],
            1.0,
            ["boolean", ["get", "highlighted"], false],
            0.9,
            0.7,
          ],
        },
        paint: {
          "icon-opacity": 0.95,
        },
      });
    });

    // Track user interactions
    map.on("mousedown", resetIdleTimer);
    map.on("wheel", resetIdleTimer);
    map.on("touchstart", resetIdleTimer);
    map.on("movestart", resetIdleTimer);

    // Click handler for flights - use ref to avoid dependency
    map.on("click", "flight-icons", (e) => {
      if (e.features && e.features.length > 0) {
        const acid = e.features[0].properties.acid;
        onFlightClickRef.current(acid);
      }
    });

    // Hover handlers - use ref to avoid dependency
    map.on("mouseenter", "flight-icons", (e) => {
      map.getCanvas().style.cursor = "pointer";
      if (e.features && e.features.length > 0) {
        const props = e.features[0].properties;
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: "flight-popup",
        })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="popup-content">
              <strong>${props.acid}</strong>
              <div>Alt: ${props.altitude} ft</div>
              <div>Speed: ${props.speed} kts</div>
            </div>`
          )
          .addTo(map);

        map._hoverPopup = popup;
        onFlightHoverRef.current(props.acid);
      }
    });

    map.on("mouseleave", "flight-icons", () => {
      map.getCanvas().style.cursor = "";
      if (map._hoverPopup) {
        map._hoverPopup.remove();
        map._hoverPopup = null;
      }
      onFlightHoverRef.current(null);
    });

    // Handle map errors
    map.on("error", (e) => {
      console.error("Mapbox error:", e);
      setMapError(e.error?.message || "Map failed to load");
    });

    mapRef.current = map;

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Set ref to null before removing to prevent race conditions
      const mapInstance = mapRef.current;
      mapRef.current = null;
      setIsMapLoaded(false);
      if (mapInstance) {
        mapInstance.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rotate when idle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !autoRotate || !isIdle || prefersReducedMotion)
      return;

    let lastTime = performance.now();

    const rotate = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      const center = map.getCenter();
      center.lng += AUTO_ROTATE_SPEED * delta;
      map.setCenter(center);

      animationFrameRef.current = requestAnimationFrame(rotate);
    };

    animationFrameRef.current = requestAnimationFrame(rotate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMapLoaded, autoRotate, isIdle, prefersReducedMotion]);

  // Update trajectories
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource("trajectories");
    if (!source) return;

    // Determine which flight is being previewed
    const previewFlightId = previewProposal?.flightId;

    // Check if compare mode is active (any flights being compared)
    const isCompareMode = highlightedFlights.length > 0;

    const features = Object.entries(trajectories)
      .filter(([acid]) => {
        // In compare mode, only show compared flights
        if (isCompareMode) {
          return highlightedFlights.includes(acid);
        }
        return true;
      })
      .map(([acid, points]) => {
        // Determine color based on state
        let color = "#3b82f6"; // default blue
        let width = 2;
        let opacity = 0.7;

        if (previewFlightId === acid) {
          // This flight is being previewed - show it prominently
          color = "#fbbf24"; // yellow/gold for preview
          width = 4;
          opacity = 0.9;
        } else if (highlightedFlights.includes(acid)) {
          color = "#f97316"; // orange for highlighted/compared
          width = 4; // thicker for compared flights
          opacity = 1.0; // full opacity
        } else if (previewFlightId && previewFlightId !== acid) {
          // Dim other flights when previewing
          opacity = 0.3;
        }

        return {
          type: "Feature",
          properties: {
            acid,
            color,
            width,
            opacity,
            isPreviewing: previewFlightId === acid,
          },
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.lon, p.lat]),
          },
        };
      });

    source.setData({
      type: "FeatureCollection",
      features,
    });

    // Update layer paint properties for dynamic styling
    if (map.getLayer("trajectory-lines")) {
      map.setPaintProperty("trajectory-lines", "line-color", ["get", "color"]);
      map.setPaintProperty("trajectory-lines", "line-width", ["get", "width"]);
      map.setPaintProperty("trajectory-lines", "line-opacity", ["get", "opacity"]);
    }
  }, [trajectories, highlightedFlights, isMapLoaded, previewProposal]);

  // Animate flight positions
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || Object.keys(trajectories).length === 0) return;

    // Initialize positions
    Object.entries(trajectories).forEach(([acid, points]) => {
      if (!flightPositionsRef.current[acid]) {
        flightPositionsRef.current[acid] = {
          index: 0,
          progress: 0,
        };
      }
    });

    const updateFlights = () => {
      const features = [];
      
      // Check if compare mode is active
      const isCompareMode = highlightedFlights.length > 0;

      Object.entries(trajectories).forEach(([acid, points]) => {
        if (points.length < 2) return;
        
        // In compare mode, skip flights that aren't being compared
        if (isCompareMode && !highlightedFlights.includes(acid)) {
          return;
        }

        const state = flightPositionsRef.current[acid] || {
          index: 0,
          progress: 0,
        };

        // Interpolate position
        const i = state.index % (points.length - 1);
        const current = points[i];
        const next = points[i + 1] || points[i];
        const t = state.progress;

        const lon = current.lon + (next.lon - current.lon) * t;
        const lat = current.lat + (next.lat - current.lat) * t;

        // Calculate bearing
        const bearing = Math.atan2(
          next.lon - current.lon,
          next.lat - current.lat
        ) * (180 / Math.PI);

        // Find flight data
        const flight = flights.find((f) => f.ACID === acid) || {};
        const isPreviewing = previewProposal?.flightId === acid;

        features.push({
          type: "Feature",
          properties: {
            acid,
            altitude: current.altitude || flight.altitude || 0,
            speed: flight["aircraft speed"] || 0,
            bearing,
            selected: selectedFlightId === acid,
            highlighted: highlightedFlights.includes(acid),
            isPreviewing,
          },
          geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
        });

        // Update progress
        state.progress += 0.02;
        if (state.progress >= 1) {
          state.progress = 0;
          state.index = (state.index + 1) % (points.length - 1);
        }
        flightPositionsRef.current[acid] = state;
      });

      const source = map.getSource("flights");
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features,
        });
      }
    };

    const interval = setInterval(updateFlights, FLIGHT_UPDATE_INTERVAL);
    updateFlights();

    return () => clearInterval(interval);
  }, [
    trajectories,
    flights,
    selectedFlightId,
    highlightedFlights,
    isMapLoaded,
    previewProposal,
  ]);

  // Recenter function
  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [-95, 45],
        zoom: 2.5,
        pitch: 0,
        bearing: 0,
        duration: 1500,
      });
    }
  };

  // Focus on a specific flight
  const focusFlight = useCallback((acid) => {
    const map = mapRef.current;
    if (!map) return;

    const points = trajectories[acid];
    if (!points || points.length === 0) return;

    const midpoint = points[Math.floor(points.length / 2)];
    map.flyTo({
      center: [midpoint.lon, midpoint.lat],
      zoom: 5,
      duration: 1200,
    });
  }, [trajectories]);

  // Expose focusFlight via ref
  useEffect(() => {
    if (selectedFlightId && trajectories[selectedFlightId]) {
      focusFlight(selectedFlightId);
    }
  }, [selectedFlightId, focusFlight, trajectories]);

  // Check if compare mode is active
  const isCompareMode = highlightedFlights.length > 0;

  return (
    <div className="globe-container">
      <div ref={mapContainerRef} className="globe-map" />

      {/* Compare mode banner */}
      {isCompareMode && (
        <div className="globe-compare-banner">
          <span className="globe-compare-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span>Compare Mode: Showing {highlightedFlights.length} flight{highlightedFlights.length > 1 ? "s" : ""}</span>
          <span className="globe-compare-flights">{highlightedFlights.join(", ")}</span>
        </div>
      )}

      {/* Compare mode flight details panel */}
      {isCompareMode && (
        <div className="globe-compare-panel">
          <div className="compare-panel-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            <span>Flight Comparison</span>
          </div>
          <div className="compare-panel-flights">
            {highlightedFlights.map((acid) => {
              const flight = flights.find((f) => f.ACID === acid);
              if (!flight) return null;
              
              // Format departure time
              const depTime = flight["departure time"] 
                ? new Date(flight["departure time"] * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : "N/A";
              
              return (
                <div key={acid} className="compare-flight-card">
                  <div className="compare-flight-header">
                    <span className="compare-flight-acid">{acid}</span>
                    <span className="compare-flight-type">{flight["Plane type"] || "Unknown"}</span>
                  </div>
                  
                  <div className="compare-flight-route">
                    <div className="compare-airport">
                      <span className="compare-airport-code">{flight["departure airport"] || "???"}</span>
                      <span className="compare-airport-label">DEP</span>
                    </div>
                    <div className="compare-route-line">
                      <svg viewBox="0 0 60 20" width="60" height="20">
                        <line x1="0" y1="10" x2="50" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4,2" />
                        <polygon points="50,10 42,6 42,14" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="compare-airport">
                      <span className="compare-airport-code">{flight["arrival airport"] || "???"}</span>
                      <span className="compare-airport-label">ARR</span>
                    </div>
                  </div>
                  
                  <div className="compare-flight-stats">
                    <div className="compare-stat">
                      <span className="compare-stat-value">{flight.altitude?.toLocaleString() || "N/A"}</span>
                      <span className="compare-stat-label">ft</span>
                    </div>
                    <div className="compare-stat">
                      <span className="compare-stat-value">{flight["aircraft speed"] || "N/A"}</span>
                      <span className="compare-stat-label">kts</span>
                    </div>
                    <div className="compare-stat">
                      <span className="compare-stat-value">{depTime}</span>
                      <span className="compare-stat-label">dep</span>
                    </div>
                  </div>
                  
                  {flight.passengers !== undefined && (
                    <div className="compare-flight-extra">
                      <span>{flight.is_cargo ? "Cargo" : `${flight.passengers} passengers`}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error display */}
      {mapError && (
        <div className="globe-error">
          <p>Map Error: {mapError}</p>
          <p>Please check your Mapbox token or internet connection.</p>
        </div>
      )}

      {/* Loading indicator */}
      {!isMapLoaded && !mapError && (
        <div className="globe-loading">
          <div className="globe-loading-spinner" />
          <p>Loading globe...</p>
        </div>
      )}

      {/* Globe controls */}
      <div className="globe-controls">
        <button
          type="button"
          className="globe-control-btn"
          onClick={handleRecenter}
          aria-label="Recenter globe"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>

        <button
          type="button"
          className={`globe-control-btn ${autoRotate ? "active" : ""}`}
          onClick={() => setAutoRotate((prev) => !prev)}
          aria-label="Toggle auto-rotate"
          disabled={prefersReducedMotion}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
