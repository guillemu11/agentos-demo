import React from 'react';

export default function ProgressBar({ percent, color, height = 8, showLabel = true }) {
  const barColor = color || 'var(--primary)';
  return (
    <div className="agent-progress-bar-container">
      <div className="agent-progress-bar-track" style={{ height }}>
        <div
          className="agent-progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: barColor, height }}
        />
      </div>
      {showLabel && <span className="agent-progress-bar-label">{percent}%</span>}
    </div>
  );
}
