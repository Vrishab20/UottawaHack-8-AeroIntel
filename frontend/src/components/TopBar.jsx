import { useState, useRef, useEffect } from "react";

// ============================================================================
// TopBar: Minimal top navigation with logo, search, and status
// ----------------------------------------------------------------------------
// Similar to FlightRadar24's top bar
// - App title on the left
// - Search box to find flights by ACID
// - Status indicator on the right
// ============================================================================

export default function TopBar({
  onSearch = () => {},
  isLive = true,
  lastUpdated = "",
  flightSuggestions = [],
}) {
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Close help modal with Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setShowHelp(false);
    };
    if (showHelp) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [showHelp]);

  // Filter suggestions based on input
  const filteredSuggestions = flightSuggestions
    .filter((acid) =>
      acid.toLowerCase().includes(searchValue.toLowerCase())
    )
    .slice(0, 8);

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
      onSearch(filteredSuggestions[selectedIndex]);
      setSearchValue(filteredSuggestions[selectedIndex]);
    } else if (searchValue.trim()) {
      onSearch(searchValue.trim().toUpperCase());
    }
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (acid) => {
    setSearchValue(acid);
    onSearch(acid);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="top-bar">
      {/* Left: Logo and title */}
      <div className="top-bar-left">
        <div className="top-bar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {/* Radar dish base */}
            <circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" opacity="0.3" />
            <circle cx="12" cy="12" r="6" stroke="currentColor" fill="none" opacity="0.5" />
            {/* Radar sweep */}
            <path d="M12 12 L12 3 A9 9 0 0 1 19.24 7.24 Z" fill="currentColor" opacity="0.4" />
            {/* Plane silhouette in center */}
            <path d="M8 12 L12 8 L16 12 L14 14 L10 14 Z" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div className="top-bar-brand">
          <span className="brand-name">AeroIntel</span>
          <span className="brand-sub">Aviation Intelligence</span>
        </div>
      </div>

      {/* Center: Search */}
      <div className="top-bar-center">
        <form className="search-form" onSubmit={handleSubmit}>
          <div className="search-wrapper">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search flight (e.g. ACA101)"
              value={searchValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              aria-label="Search flights"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
            />
            {searchValue && (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setSearchValue("");
                  onSearch("");
                }}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && searchValue && (
            <ul
              ref={suggestionsRef}
              className="search-suggestions"
              role="listbox"
            >
              {filteredSuggestions.map((acid, index) => (
                <li
                  key={acid}
                  className={`suggestion-item ${
                    index === selectedIndex ? "selected" : ""
                  }`}
                  onClick={() => handleSuggestionClick(acid)}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16v-4a2 2 0 00-2-2h-3l-2.5-5h-3L8 10H5a2 2 0 00-2 2v4" />
                  </svg>
                  <span>{acid}</span>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>

      {/* Right: Status and Help */}
      <div className="top-bar-right">
        <button
          type="button"
          className="help-button"
          onClick={() => setShowHelp(true)}
          aria-label="Help"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Help</span>
        </button>
        <div className={`status-indicator ${isLive ? "live" : "offline"}`}>
          <span className="status-dot" />
          <span className="status-text">{isLive ? "Live" : "Offline"}</span>
        </div>
        {lastUpdated && (
          <span className="last-updated">Updated {lastUpdated}</span>
        )}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <>
          <div className="help-overlay" onClick={() => setShowHelp(false)} />
          <div className="help-modal">
            <div className="help-header">
              <h2>Welcome to AeroIntel</h2>
              <button
                type="button"
                className="help-close"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="help-content">
              <section className="help-section">
                <h3>What is this app?</h3>
                <p>
                  This is an air traffic management tool that helps detect potential conflicts 
                  between aircraft and suggests ways to resolve them safely.
                </p>
              </section>

              <section className="help-section">
                <h3>The Globe</h3>
                <ul>
                  <li><strong>Drag</strong> to rotate the globe</li>
                  <li><strong>Scroll</strong> to zoom in/out</li>
                  <li><strong>Click on a plane</strong> to see its details</li>
                  <li>The <strong>colored lines</strong> show flight paths</li>
                </ul>
              </section>

              <section className="help-section">
                <h3>Control Panel (Left Side)</h3>
                <ul>
                  <li><strong>Live Tracking</strong> - Automatically updates flight data</li>
                  <li><strong>Auto Analyze</strong> - Continuously checks for conflicts</li>
                  <li><strong>Analyze Now</strong> - Manually run conflict detection</li>
                </ul>
              </section>

              <section className="help-section">
                <h3>Conflicts</h3>
                <p>
                  A conflict happens when two planes get too close to each other. 
                  The <strong>severity score</strong> shows how serious it is (higher = more dangerous).
                </p>
                <ul>
                  <li><strong>Click a conflict</strong> to see related proposals</li>
                  <li><strong>Compare</strong> - Shows only those two flights on the map</li>
                </ul>
              </section>

              <section className="help-section">
                <h3>Proposals</h3>
                <p>
                  These are suggestions to fix conflicts. The system can recommend:
                </p>
                <ul>
                  <li><strong>Change altitude</strong> - Fly higher or lower</li>
                  <li><strong>Change speed</strong> - Fly faster or slower</li>
                  <li><strong>Delay departure</strong> - Leave earlier or later</li>
                </ul>
                <p>
                  <strong>Hover</strong> over a proposal to preview it on the map. 
                  Click <strong>Apply</strong> to make the change permanent.
                </p>
              </section>

              <section className="help-section">
                <h3>Hotspots</h3>
                <p>
                  Areas where many planes pass through at the same time. 
                  These need extra attention from air traffic controllers.
                </p>
              </section>

              <section className="help-section">
                <h3>Search</h3>
                <p>
                  Use the search bar at the top to find a specific flight by its ID 
                  (like "ACA101" or "WJA204").
                </p>
              </section>

              <section className="help-section">
                <h3>Keyboard Shortcuts</h3>
                <ul>
                  <li><strong>Esc</strong> - Close fullscreen panel or this help</li>
                </ul>
              </section>
            </div>

            <div className="help-footer">
              <p>Press <kbd>Esc</kbd> or click outside to close</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
