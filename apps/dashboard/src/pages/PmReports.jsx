import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { PageHeaderIcons } from '../components/icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const severityColors = {
    CRITICA: '#ef4444',
    ALTA: '#f59e0b',
    MEDIA: '#3b82f6',
    BAJA: '#94a3b8',
};

const priorityOrder = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];

function MetricsDelta({ current, previous }) {
    if (!current || !previous) return null;
    const keys = Object.keys(current);
    const deltas = keys
        .map((k) => {
            const cur = typeof current[k] === 'number' ? current[k] : parseInt(current[k]);
            const prev = typeof previous[k] === 'number' ? previous[k] : parseInt(previous[k]);
            if (isNaN(cur) || isNaN(prev) || cur === prev) return null;
            const diff = cur - prev;
            return { key: k, diff, positive: diff > 0 };
        })
        .filter(Boolean);

    if (deltas.length === 0) return null;

    return (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            {deltas.map((d) => (
                <span
                    key={d.key}
                    style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        background: d.positive ? '#dcfce7' : '#fee2e2',
                        color: d.positive ? '#16a34a' : '#ef4444',
                        fontWeight: 600,
                    }}
                >
                    {d.key}: {d.positive ? '+' : ''}{d.diff}
                </span>
            ))}
        </div>
    );
}

export default function PmReports() {
    const navigate = useNavigate();
    const { t, lang } = useLanguage();
    const [reports, setReports] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const fetchReports = () => {
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/pm-reports`)
            .then((r) => {
                if (!r.ok) throw new Error(`Error cargando reportes (${r.status})`);
                return r.json();
            })
            .then((data) => {
                setReports(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                setError(err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => { fetchReports(); }, []);

    const generateReport = async () => {
        setGenerating(true);
        setError(null);
        try {
            const r = await fetch(`${API_URL}/pm-reports/generate`, { method: 'POST' });
            if (!r.ok) throw new Error(`Error generando reporte (${r.status})`);
            const newReport = await r.json();
            fetchReports();
            setSelected(newReport);
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const fetchDetail = async (id) => {
        try {
            const r = await fetch(`${API_URL}/pm-reports/${id}`);
            if (!r.ok) throw new Error('Error cargando detalle');
            const data = await r.json();
            setSelected(data);
        } catch (err) {
            setError(err.message);
        }
    };

    // Find previous report for delta comparison
    const getPreviousReport = (report) => {
        const idx = reports.findIndex((r) => r.id === report.id);
        return idx < reports.length - 1 ? reports[idx + 1] : null;
    };

    // Detail view
    if (selected) {
        const prev = getPreviousReport(selected);
        const metrics = selected.metrics || {};
        const risks = Array.isArray(selected.risks) ? selected.risks : [];
        const nextSteps = Array.isArray(selected.next_steps) ? selected.next_steps : [];

        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => setSelected(null)}>
                    ← {t('pmReports.backToReports')}
                </button>

                <header style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '2rem' }}>{PageHeaderIcons.reports}</span>
                        <div>
                            <h1 style={{ fontSize: '1.8rem' }}>{selected.title}</h1>
                            <p className="subtitle">{formatDate(selected.created_at)}</p>
                        </div>
                    </div>
                </header>

                {/* Summary */}
                {selected.summary && (
                    <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #3b82f6' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{t('pmReports.executiveSummary')}</h3>
                        <p style={{ margin: 0, lineHeight: 1.7 }}>{selected.summary}</p>
                    </div>
                )}

                {/* Metrics */}
                {Object.keys(metrics).length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{t('pmReports.metrics')}</h3>
                        <div className="intelligence-summary-grid">
                            {Object.entries(metrics).map(([key, val]) => (
                                <div key={key} className="card intel-stat-card">
                                    <span className="intel-stat-lbl">{key}</span>
                                    <div className="intel-stat-main">
                                        <span className="intel-stat-val">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <MetricsDelta current={metrics} previous={prev?.metrics} />
                    </div>
                )}

                {/* Risks */}
                {risks.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{t('pmReports.risksLabel')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {risks
                                .sort((a, b) => priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity))
                                .map((risk, i) => (
                                    <div
                                        key={i}
                                        className="card"
                                        style={{
                                            padding: '12px 16px',
                                            borderLeft: `4px solid ${severityColors[risk.severity] || '#94a3b8'}`,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <strong style={{ fontSize: '0.9rem' }}>{risk.risk || risk.title || risk}</strong>
                                            {risk.mitigation && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>{risk.mitigation}</p>}
                                        </div>
                                        {risk.severity && (
                                            <span
                                                style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    padding: '2px 10px',
                                                    borderRadius: '9999px',
                                                    background: `${severityColors[risk.severity] || '#94a3b8'}18`,
                                                    color: severityColors[risk.severity] || '#94a3b8',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {risk.severity}
                                            </span>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Next Steps */}
                {nextSteps.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{t('pmReports.nextSteps')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {nextSteps.map((step, i) => (
                                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8rem', fontWeight: 700, color: '#64748b', flexShrink: 0,
                                    }}>
                                        {i + 1}
                                    </span>
                                    <div>
                                        <strong style={{ fontSize: '0.9rem' }}>{step.action || step.title || step}</strong>
                                        {step.priority && (
                                            <span style={{
                                                marginLeft: '8px', fontSize: '0.7rem', fontWeight: 600,
                                                padding: '1px 8px', borderRadius: '9999px',
                                                background: severityColors[step.priority] ? `${severityColors[step.priority]}18` : '#f1f5f9',
                                                color: severityColors[step.priority] || '#64748b',
                                            }}>
                                                {step.priority}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Full Markdown body */}
                {selected.body_md && (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{t('pmReports.fullReport')}</h3>
                        <pre style={{
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            fontFamily: 'Inter, system-ui, sans-serif', fontSize: '0.85rem',
                            lineHeight: 1.7, margin: 0, color: '#0f172a',
                        }}>
                            {selected.body_md}
                        </pre>
                    </div>
                )}
            </div>
        );
    }

    // List view
    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>{PageHeaderIcons.reports}</span>
                    <div>
                        <h1 style={{ fontSize: '1.8rem' }}>{t('pmReports.title')}</h1>
                        <p className="subtitle">{t('pmReports.subtitle')}</p>
                    </div>
                </div>
                <button
                    className="back-button"
                    onClick={generateReport}
                    disabled={generating}
                    style={{
                        background: generating ? '#94a3b8' : '#FF385C',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {generating ? t('pmReports.generating') : t('pmReports.generate')}
                </button>
            </header>

            {loading && <p className="subtitle">{t('pmReports.loading')}</p>}
            {error && <p style={{ color: '#ef4444' }}>Error: {error}</p>}

            {!loading && !error && (
                <div className="audit-timeline">
                    {reports.map((report, i) => {
                        const date = new Date(report.created_at);
                        const metrics = report.metrics || {};
                        const riskCount = Array.isArray(report.risks) ? report.risks.length : 0;
                        const stepsCount = Array.isArray(report.next_steps) ? report.next_steps.length : 0;

                        return (
                            <div
                                key={report.id}
                                className="audit-event animate-fade-in"
                                style={{ cursor: 'pointer' }}
                                onClick={() => fetchDetail(report.id)}
                            >
                                <div className="audit-event-time">
                                    <span className="audit-time">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="audit-date">{date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>

                                <div className="audit-event-icon-wrapper">
                                    <div className="audit-event-icon">{PageHeaderIcons.reports}</div>
                                    {i < reports.length - 1 && <div className="audit-timeline-line"></div>}
                                </div>

                                <div className="card audit-event-card" style={{ flex: 1 }}>
                                    <div className="audit-event-header">
                                        <div className="audit-event-info">
                                            <h3 className="audit-event-title">{report.title}</h3>
                                            <p className="audit-event-details">{report.summary}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {Object.entries(metrics).slice(0, 4).map(([k, v]) => (
                                            <span key={k} style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px',
                                                background: '#f1f5f9', color: '#64748b', fontWeight: 500,
                                            }}>
                                                {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                            </span>
                                        ))}
                                        {riskCount > 0 && (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px',
                                                background: '#fef2f2', color: '#ef4444', fontWeight: 600,
                                            }}>
                                                {riskCount} {t('pmReports.risks')}
                                            </span>
                                        )}
                                        {stepsCount > 0 && (
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px',
                                                background: '#eff6ff', color: '#3b82f6', fontWeight: 600,
                                            }}>
                                                {stepsCount} {t('pmReports.steps')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {reports.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>{PageHeaderIcons.reports}</span>
                            <p className="subtitle" style={{ fontSize: '1rem' }}>{t('pmReports.noReports')}</p>
                            <p className="subtitle" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                                {t('pmReports.noReportsHint')}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
