export default function RadarHalo() {
  return (
    <div className="radar-halo" aria-hidden="true">
      <svg viewBox="0 0 800 800" className="radar-halo-svg">
        <circle cx="400" cy="400" r="360" className="radar-halo-ring" />
        <circle cx="400" cy="400" r="240" className="radar-halo-ring" />
        <circle cx="400" cy="400" r="140" className="radar-halo-ring" />
        <g className="radar-halo-sweep">
          <path
            d="M400 400 L400 40 A360 360 0 0 1 620 120 Z"
            className="radar-halo-wedge"
          />
        </g>
      </svg>
    </div>
  );
}
