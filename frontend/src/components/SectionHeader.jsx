export default function SectionHeader({ title, count, insight, action }) {
  return (
    <div className="section-header">
      <div>
        <div className="section-title">
          <h2>{title}</h2>
          {typeof count === "number" && <span className="section-count">{count}</span>}
        </div>
        {insight && <p className="insight">{insight}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}
