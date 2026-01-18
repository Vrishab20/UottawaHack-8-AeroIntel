export default function MetricTile({ label, value, loading }) {
  return (
    <div className="tile">
      <h3>{label}</h3>
      {loading ? <div className="tile-skeleton" /> : <span>{value}</span>}
    </div>
  );
}
