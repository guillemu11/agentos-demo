import React from 'react';

export default function DailyCoverageAlert({ coverage, loading, t }) {
    if (loading || !coverage || coverage.total === 0) return null;

    const { total, reported, agents } = coverage;
    const pct = total > 0 ? Math.round((reported / total) * 100) : 0;
    const missing = agents.filter(a => a.report_id === null);
    const isFull = missing.length === 0;

    return (
        <div className="daily-coverage-bar">
            <span className="daily-coverage-label">
                {reported} / {total} {t('daily.agentsReported')}
            </span>
            <div className="daily-coverage-progress">
                <div
                    className="daily-coverage-fill"
                    style={{
                        width: `${pct}%`,
                        background: isFull ? 'var(--accent-green)' : 'var(--primary)',
                    }}
                />
            </div>
            <span className="daily-coverage-label" style={{ minWidth: '40px', textAlign: 'right' }}>
                {pct}%
            </span>
            {isFull && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                    {t('daily.fullCoverage')}
                </span>
            )}
            {!isFull && missing.length > 0 && (
                <div className="daily-missing-chips">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {t('daily.missingAgents')}
                    </span>
                    {missing.map(a => (
                        <span key={a.id} className="daily-missing-chip">
                            {a.avatar} {a.name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
