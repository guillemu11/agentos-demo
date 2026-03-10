import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const moodColors = {
    productive: '#10b981',
    focused: '#3b82f6',
    creative: '#a855f7',
    energized: '#f59e0b',
    motivated: '#ec4899',
    strategic: '#6366f1',
    blocked: '#ef4444',
    neutral: '#94a3b8',
};

export default function DailyTrends({ department, t }) {
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetch(`${API_URL}/eod-reports/trends?department=${department}&days=14`)
            .then(r => r.json())
            .then(data => { if (!cancelled) setTrends(data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [department]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '8px' }}>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('daily.loadingReports')}</span>
            </div>
        );
    }

    if (!trends) return null;

    const { daily, moodDistribution } = trends;

    // Fill in missing days
    const filled = [];
    if (daily.length > 0) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 13);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().split('T')[0];
            const found = daily.find(r => r.date === iso);
            filled.push({
                date: iso,
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                completed_count: found?.completed_count || 0,
                blocker_count: found?.blocker_count || 0,
                report_count: found?.report_count || 0,
                wip_count: found?.wip_count || 0,
            });
        }
    }

    // KPIs
    const totalDays = filled.length || 1;
    const avgCompleted = (filled.reduce((s, d) => s + d.completed_count, 0) / totalDays).toFixed(1);
    const avgBlockers = (filled.reduce((s, d) => s + d.blocker_count, 0) / totalDays).toFixed(1);
    const daysWithReports = filled.filter(d => d.report_count > 0).length;

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', boxShadow: 'var(--shadow-md)' }}>
                <p style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>
                        {p.name}: <strong>{p.value}</strong>
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* KPI Row */}
            <div className="daily-kpi-row">
                <div className="card daily-kpi-card">
                    <div className="daily-kpi-val">{avgCompleted}</div>
                    <div className="daily-kpi-lbl">{t('daily.avgCompleted')}</div>
                </div>
                <div className="card daily-kpi-card">
                    <div className="daily-kpi-val">{avgBlockers}</div>
                    <div className="daily-kpi-lbl">{t('daily.avgBlockers')}</div>
                </div>
                <div className="card daily-kpi-card">
                    <div className="daily-kpi-val">{daysWithReports} / {totalDays}</div>
                    <div className="daily-kpi-lbl">{t('daily.coverageStreak')}</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="daily-trends-grid">
                {/* Completion & Blockers Trend */}
                <div className="card daily-trends-chart">
                    <div className="daily-trends-title">{t('daily.completionTrend')}</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={filled} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="completed_count"
                                name={t('daily.done')}
                                stroke="#10b981"
                                fill="rgba(16, 185, 129, 0.15)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="blocker_count"
                                name="Blockers"
                                stroke="#ef4444"
                                fill="rgba(239, 68, 68, 0.1)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Mood Distribution */}
                <div className="card daily-trends-chart">
                    <div className="daily-trends-title">{t('daily.moodDistribution')}</div>
                    {moodDistribution && moodDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={moodDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                <XAxis dataKey="mood" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                                    {moodDistribution.map((entry, i) => (
                                        <Cell key={i} fill={moodColors[entry.mood] || '#94a3b8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>
                            {t('daily.noReportsForDate')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
