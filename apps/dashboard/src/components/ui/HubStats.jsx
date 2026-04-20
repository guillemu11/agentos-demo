export function HubStats({ children }) {
  return <div className="jl__stats">{children}</div>;
}

export function HubStatCard({ icon, label, value, tone = 'neutral' }) {
  return (
    <div className={`jl__stat jl__stat--${tone}`}>
      <div className="jl__stat-icon">{icon}</div>
      <div className="jl__stat-body">
        <div className="jl__stat-value">{value}</div>
        <div className="jl__stat-label">{label}</div>
      </div>
    </div>
  );
}
