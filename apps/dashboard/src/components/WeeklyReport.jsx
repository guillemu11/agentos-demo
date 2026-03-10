import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { MoodIcons, MetricIcons, StatusIcons } from './icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function DeltaBadge({ value, label, positiveIsGood = true }) {
    if (value === null || value === undefined) return null;
    const isPositive = value > 0;
    const isGood = positiveIsGood ? isPositive : !isPositive;
    const color = value === 0 ? '#94a3b8' : (isGood ? '#16a34a' : '#ef4444');
    const bg = value === 0 ? '#f1f5f9' : (isGood ? '#dcfce7' : '#fee2e2');
    return (
        <span style={{
            fontSize: '0.72rem', padding: '2px 8px', borderRadius: '9999px',
            background: bg, color, fontWeight: 600,
        }}>
            {value > 0 ? '+' : ''}{value} {label}
        </span>
    );
}

function MetricCard({ icon, label, value, delta, subValue, accentColor }) {
    return (
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accentColor || '#0F172A' }}>
                {value}
            </div>
            {subValue && (
                <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>{subValue}</div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>{label}</div>
            {delta && <div style={{ marginTop: '8px' }}>{delta}</div>}
        </div>
    );
}

export default function WeeklyReport({ session, onReportGenerated }) {
    const { t, lang } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    const report = session?.report || null;

    const moodConfig = {
        productive: { emoji: MoodIcons.productive, label: t('mood.productive') },
        focused:    { emoji: MoodIcons.focused, label: t('mood.focused') },
        creative:   { emoji: MoodIcons.creative, label: t('mood.creative') },
        energized:  { emoji: MoodIcons.energized, label: t('mood.energized') },
        motivated:  { emoji: MoodIcons.motivated, label: t('mood.motivated') },
        strategic:  { emoji: MoodIcons.strategic, label: t('mood.strategic') },
        blocked:    { emoji: MoodIcons.blocked, label: t('mood.blocked') },
        neutral:    { emoji: MoodIcons.neutral, label: t('mood.neutral') },
    };

    const severityConfig = {
        low:    { color: '#94a3b8', bg: '#f1f5f9', label: t('severity.low') },
        medium: { color: '#f59e0b', bg: '#fffbeb', label: t('severity.medium') },
        high:   { color: '#ef4444', bg: '#fef2f2', label: t('severity.high') },
    };

    async function handleGenerate() {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${session.id}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Error ${res.status}`);
            }
            const data = await res.json();
            if (onReportGenerated) onReportGenerated(data.report);
        } catch (err) {
            setError(t('weeklyReport.errorGenerating') + err.message);
        }
        setGenerating(false);
    }

    const dateLocale = lang === 'en' ? 'en-US' : 'es-ES';

    // ── Empty state ──
    if (!report) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: '16px' }}>
                <div style={{ fontSize: '3rem' }}>{MetricIcons.report}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {t('weeklyReport.title')}
                </h3>
                <p style={{ color: '#64748B', fontSize: '0.88rem', maxWidth: '420px', textAlign: 'center', margin: 0 }}>
                    {t('weeklyReport.description')}
                </p>
                {error && <p style={{ color: '#ef4444', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{
                        background: generating ? '#94a3b8' : '#FF385C',
                        color: 'white', border: 'none', borderRadius: '9999px',
                        padding: '12px 28px', fontWeight: 600, fontSize: '0.9rem',
                        cursor: generating ? 'not-allowed' : 'pointer',
                        boxShadow: generating ? 'none' : '0 4px 14px rgba(255, 56, 92, 0.3)',
                        transition: 'all 0.2s',
                    }}
                >
                    {generating ? t('weeklyReport.generating') : t('weeklyReport.generate')}
                </button>
            </div>
        );
    }

    // ── Report render ──
    const { period, tasks, blockers, mood, kpis, brainstorm_summary, inbox, vs_last_week } = report;

    const moodEntries = Object.entries(mood || {})
        .filter(([k, v]) => k !== 'trend' && typeof v === 'number' && v > 0)
        .sort((a, b) => b[1] - a[1]);
    const totalMoodEntries = moodEntries.reduce((s, [, v]) => s + v, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                        {t('weeklyReport.weekReport')} {period?.week}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                        {period?.start} — {period?.end}
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{
                        background: 'transparent', border: '1.5px solid #FF385C',
                        color: '#FF385C', borderRadius: '9999px',
                        padding: '6px 18px', fontWeight: 600, fontSize: '0.8rem',
                        cursor: generating ? 'not-allowed' : 'pointer',
                    }}
                >
                    {generating ? t('weeklyReport.updating') : t('weeklyReport.regenerate')}
                </button>
            </div>

            {/* Metric cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <MetricCard
                    icon={MetricIcons.completed}
                    label={t('weeklyReport.tasksCompleted')}
                    value={tasks?.completed ?? '\u2014'}
                    delta={vs_last_week ? <DeltaBadge value={vs_last_week.tasks_delta} label={t('weeklyReport.vsLastWeek')} positiveIsGood /> : null}
                />
                <MetricCard
                    icon={MetricIcons.chart}
                    label={t('weeklyReport.completionRate')}
                    value={tasks?.rate !== undefined ? `${Math.round(tasks.rate * 100)}%` : '\u2014'}
                />
                <MetricCard
                    icon={MetricIcons.blockers}
                    label={t('weeklyReport.blockers')}
                    value={Array.isArray(blockers) ? blockers.length : 0}
                    delta={vs_last_week ? <DeltaBadge value={vs_last_week.blockers_delta} label={t('weeklyReport.vsLastWeek')} positiveIsGood={false} /> : null}
                    accentColor={Array.isArray(blockers) && blockers.length > 0 ? '#ef4444' : '#16a34a'}
                />
                <MetricCard
                    icon={MetricIcons.inbox}
                    label={t('weeklyReport.inboxIdeas')}
                    value={inbox?.total ?? 0}
                />
                <MetricCard
                    icon={MetricIcons.brain}
                    label={t('weeklyReport.brainstormLabel')}
                    value={brainstorm_summary?.total ?? 0}
                    subValue={brainstorm_summary?.accepted > 0 ? `${brainstorm_summary.accepted} ${t('weeklyReport.accepted')}` : null}
                />
            </div>

            {/* Mood distribution */}
            {moodEntries.length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('weeklyReport.teamMood')}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {moodEntries.map(([moodKey, count]) => {
                            const cfg = moodConfig[moodKey] || { emoji: StatusIcons.unknown, label: moodKey };
                            const pct = totalMoodEntries > 0 ? Math.round((count / totalMoodEntries) * 100) : 0;
                            return (
                                <div key={moodKey} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ width: '20px', textAlign: 'center' }}>{cfg.emoji}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748B', width: '90px' }}>{cfg.label}</span>
                                    <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${pct}%`, height: '100%', borderRadius: '9999px',
                                            background: moodKey === 'blocked' ? '#ef4444' : '#3B82F6',
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '28px', textAlign: 'right' }}>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#94a3b8' }}>
                        {t('weeklyReport.trend')} <strong style={{ color: mood?.trend === 'positivo' ? '#16a34a' : mood?.trend === 'con_friccion' ? '#ef4444' : '#64748B' }}>
                            {mood?.trend === 'positivo' ? t('weeklyReport.trendPositive') : mood?.trend === 'con_friccion' ? t('weeklyReport.trendFriction') : t('weeklyReport.trendStable')}
                        </strong>
                    </div>
                </div>
            )}

            {/* Blockers list */}
            {Array.isArray(blockers) && blockers.length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('weeklyReport.weeklyBlockers')}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {blockers.map((b, i) => {
                            const sev = severityConfig[b.severity] || severityConfig.medium;
                            return (
                                <div key={i} style={{
                                    padding: '12px 16px', borderRadius: '12px',
                                    background: '#f8fafc', border: '1px solid #f1f5f9',
                                    borderLeft: `3px solid ${sev.color}`,
                                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                                }}>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem',
                                        fontWeight: 600, background: sev.bg, color: sev.color, whiteSpace: 'nowrap',
                                    }}>
                                        {sev.label}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', color: '#0F172A' }}>{b.description}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                            {b.agent} {'\u00B7'} {b.date}
                                            {b.resolved && (
                                                <span style={{ marginLeft: '8px', color: '#16a34a', fontWeight: 600 }}> {t('weeklyReport.resolved')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* KPIs */}
            {kpis && Object.keys(kpis).length > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('weeklyReport.deptKpis')}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                        {kpis.properties_scraped !== undefined && kpis.properties_scraped !== null && (
                            <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0F172A' }}>
                                    {kpis.properties_scraped.toLocaleString(dateLocale)}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>{t('weeklyReport.propertiesScraped')}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Brainstorm summary */}
            {brainstorm_summary && brainstorm_summary.total > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('weeklyReport.brainstormSummary')}
                    </h4>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A' }}>{brainstorm_summary.total}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('weeklyReport.contributions')}</div>
                        </div>
                        {brainstorm_summary.accepted > 0 && (
                            <div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a' }}>{brainstorm_summary.accepted}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{t('weeklyReport.acceptedLabel')}</div>
                            </div>
                        )}
                        {Object.entries(brainstorm_summary.types || {}).map(([type, count]) => (
                            <div key={type}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#64748B' }}>{count}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>{type}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right' }}>
                {t('weeklyReport.generated')} {new Date(report.generated_at).toLocaleString(dateLocale)}
            </div>
        </div>
    );
}
