import React from 'react';

const statusStyles = {
  active: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  running: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  success: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  pass: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  approved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  resolved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  fixed: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  launched: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  draft: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  review: { bg: 'rgba(212,175,55,0.12)', color: '#D4AF37' },
  pending: { bg: 'rgba(212,175,55,0.12)', color: '#D4AF37' },
  waiting: { bg: 'rgba(212,175,55,0.12)', color: '#D4AF37' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'in-progress': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  paused: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  fail: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  critical: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  major: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  minor: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  open: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  ended: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  info: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  high: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  medium: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  low: { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  connected: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  degraded: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  timeout: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
};

export default function StatusBadge({ status, label }) {
  const s = statusStyles[status] || { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' };
  return (
    <span className="agent-status-pill" style={{ background: s.bg, color: s.color }}>
      {label || status}
    </span>
  );
}
