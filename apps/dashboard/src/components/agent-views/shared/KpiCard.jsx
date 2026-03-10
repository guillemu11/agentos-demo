import React from 'react';

export default function KpiCard({ label, value, trend, trendLabel, color }) {
  const trendColor = trend > 0 ? 'var(--accent-green)' : trend < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
  const trendArrow = trend > 0 ? '▲' : trend < 0 ? '▼' : '';

  return (
    <div className="card agent-kpi-card">
      <div className="agent-kpi-label">{label}</div>
      <div className="agent-kpi-value" style={color ? { color } : undefined}>{value}</div>
      {(trend != null || trendLabel) && (
        <div className="agent-kpi-trend" style={{ color: trendColor }}>
          {trendArrow} {trendLabel || `${Math.abs(trend)}%`}
        </div>
      )}
    </div>
  );
}
