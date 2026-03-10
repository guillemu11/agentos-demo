import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import DailyEodModal from '../components/DailyEodModal.jsx';
import DailyCoverageAlert from '../components/DailyCoverageAlert.jsx';
import DailyTrends from '../components/DailyTrends.jsx';
import DailyAiSummary from '../components/DailyAiSummary.jsx';
import { MoodIcons, StandupIcons, DailyTabIcons, StatusIcons } from '../components/icons.jsx';
import { Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const themeMap = {
    data: 'theme-green',
    seo: 'theme-amber',
    dev: 'theme-cyan',
    content: 'theme-amber',
    sales: 'theme-rose',
    marketing: 'theme-rose',
    design: 'theme-indigo',
    product: 'theme-purple',
};

function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export default function DailyStandup() {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();

    const moodConfig = {
        productive: { emoji: MoodIcons.productive, label: t('mood.productive') },
        focused: { emoji: MoodIcons.focused, label: t('mood.focused') },
        creative: { emoji: MoodIcons.creative, label: t('mood.creative') },
        energized: { emoji: MoodIcons.energized, label: t('mood.energized') },
        motivated: { emoji: MoodIcons.motivated, label: t('mood.motivated') },
        strategic: { emoji: MoodIcons.strategic, label: t('mood.strategic') },
        blocked: { emoji: MoodIcons.blocked, label: t('mood.blocked') },
        neutral: { emoji: MoodIcons.neutral, label: t('mood.neutral') },
    };

    const severityConfig = {
        low: { color: '#94a3b8', bg: '#f1f5f9', label: t('severity.low') },
        medium: { color: '#f59e0b', bg: '#fffbeb', label: t('severity.medium') },
        high: { color: '#ef4444', bg: '#fef2f2', label: t('severity.high') },
    };

    function formatDateLabel(dateStr) {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);

        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dayNum = date.getDate();
        const locale = lang === 'en' ? 'en-US' : 'es-ES';
        const monthShort = date.toLocaleDateString(locale, { month: 'short' });
        const cap = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

        if (date.getTime() === todayDate.getTime()) return `${t('daily.today')} — ${dayNum} ${cap}`;
        if (date.getTime() === yesterdayDate.getTime()) return `${t('daily.yesterday')} — ${dayNum} ${cap}`;
        const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
        const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        return `${weekdayCap} ${dayNum} ${cap}`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toISODate(today);

    // Build 7-day week strip
    const weekDates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = toISODate(d);
        weekDates.push({ value: iso, label: formatDateLabel(iso) });
    }

    const [activeView, setActiveView] = useState('board');
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selectedAgent, setSelectedAgent] = useState(null);

    const [dept, setDept] = useState(null);
    const [reports, setReports] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Coverage state
    const [coverage, setCoverage] = useState(null);
    const [coverageLoading, setCoverageLoading] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-generate state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateResult, setGenerateResult] = useState(null);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/eod-reports?department=${deptId}&date=${selectedDate}`);
            if (!res.ok) throw new Error(`${t('daily.errorLoading')} (${res.status})`);
            const data = await res.json();
            setReports(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCoverage = async () => {
        setCoverageLoading(true);
        try {
            const res = await fetch(`${API_URL}/eod-reports/coverage?department=${deptId}&date=${selectedDate}`);
            if (res.ok) setCoverage(await res.json());
        } catch (_) { }
        finally { setCoverageLoading(false); }
    };

    // Fetch department info
    useEffect(() => {
        let cancelled = false;
        setError(null);

        fetch(`${API_URL}/departments/${deptId}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Departamento no encontrado (${res.status})`);
                return res.json();
            })
            .then((data) => { if (!cancelled) setDept(data); })
            .catch((err) => { if (!cancelled) setError(err.message); });

        return () => { cancelled = true; };
    }, [deptId]);

    // Fetch EOD reports + coverage by dept + date
    useEffect(() => {
        fetchReports();
        fetchCoverage();
    }, [deptId, selectedDate]);

    // Fetch agents for modal
    useEffect(() => {
        if (showModal) {
            fetch(`${API_URL}/agents?department=${deptId}`)
                .then(r => r.json())
                .then(data => setAgents(data));
        }
    }, [showModal, deptId]);

    const handleSubmitReport = async (body) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/eod-reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, date: selectedDate }),
            });
            if (!res.ok) throw new Error(t('daily.errorSubmitting'));
            setShowModal(false);
            fetchReports();
            fetchCoverage();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAutoGenerate = async () => {
        setIsGenerating(true);
        setGenerateResult(null);
        try {
            const res = await fetch(`${API_URL}/eod-reports/generate-department`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: deptId, date: selectedDate }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Error ${res.status}`);
            }
            const data = await res.json();
            setGenerateResult(data);
            fetchReports();
            fetchCoverage();
        } catch (err) {
            alert(err.message || 'Error generando EODs');
        }
        finally { setIsGenerating(false); }
    };

    // Derive standup board data
    const standup = React.useMemo(() => {
        const done = [];
        const inProgress = [];
        const blocked = [];
        const insights = [];

        reports.forEach((r) => {
            (r.completed_tasks || []).forEach((t) => {
                done.push({ description: t.desc, duration: t.duration, agentId: r.agent_id, agentName: r.agent_name, agentAvatar: r.avatar });
            });
            (r.in_progress_tasks || []).forEach((t) => {
                inProgress.push({ description: t.desc, progress: t.pct, agentId: r.agent_id, agentName: r.agent_name, agentAvatar: r.avatar });
            });
            (r.blockers || []).forEach((t) => {
                blocked.push({ description: t.desc, severity: t.severity, agentId: r.agent_id, agentName: r.agent_name, agentAvatar: r.avatar });
            });
            (r.insights || []).forEach((text) => {
                insights.push({ text, agentId: r.agent_id, agentName: r.agent_name, agentAvatar: r.avatar });
            });
        });

        return { done, inProgress, blocked, insights };
    }, [reports]);

    const selectedReport = selectedAgent ? reports.find((r) => r.agent_id === selectedAgent) : null;
    const theme = themeMap[deptId] || '';

    if (error && !dept) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('daily.back')}</button>
                <p>{t('daily.deptNotFound')}</p>
            </div>
        );
    }

    if (loading && !dept) {
        return (
            <div className="dashboard-container animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: '12px' }}>
                    <Loader2 size={24} className="icon-spin" />
                    <span style={{ fontSize: '1.1rem', color: '#64748b' }}>{t('daily.loadingStandup')}</span>
                </div>
            </div>
        );
    }

    const deptName = dept?.name || deptId;

    return (
        <div className={`dashboard-container animate-fade-in ${dept?.theme || theme}`}>
            <button className="back-button" onClick={() => navigate(`/app/workspace/${deptId}`)}>
                ← {t('daily.backTo')} {deptName}
            </button>

            {/* Header */}
            <header style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>{StandupIcons.standup}</span>
                    <div>
                        <h1 style={{ fontSize: '1.8rem' }}>{t('daily.title')} — {deptName}</h1>
                        <p className="subtitle">{t('daily.subtitle')}</p>
                    </div>
                </div>
            </header>

            {/* Controls */}
            <div className="daily-controls">
                <div className="weekly-view-toggle">
                    <button
                        className={`weekly-toggle-btn ${activeView === 'board' ? 'active' : ''}`}
                        onClick={() => { setActiveView('board'); setSelectedAgent(null); }}
                    >
                        {DailyTabIcons.board} {t('daily.standupBoard')}
                    </button>
                    <button
                        className={`weekly-toggle-btn ${activeView === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveView('reports')}
                    >
                        {DailyTabIcons.reports} {t('daily.eodReports')}
                    </button>
                    <button
                        className={`weekly-toggle-btn ${activeView === 'trends' ? 'active' : ''}`}
                        onClick={() => setActiveView('trends')}
                    >
                        {DailyTabIcons.trends} {t('daily.analyticsTab')}
                    </button>
                </div>

                {/* Week strip */}
                <div className="daily-week-strip">
                    {weekDates.map((d) => (
                        <button
                            key={d.value}
                            className={`daily-week-btn ${selectedDate === d.value ? 'active' : ''}`}
                            onClick={() => { setSelectedDate(d.value); setSelectedAgent(null); }}
                        >
                            {d.label}
                        </button>
                    ))}
                    <input
                        type="date"
                        className="daily-date-input"
                        value={selectedDate}
                        onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); setSelectedAgent(null); } }}
                        title={t('daily.pickDate')}
                    />
                </div>

                {/* Action buttons */}
                <div className="daily-action-group">
                    <button
                        className="daily-date-btn"
                        style={{ borderStyle: 'dashed', color: 'var(--primary)', fontWeight: 700 }}
                        onClick={() => setShowModal(true)}
                    >
                        {t('daily.newEodReport')}
                    </button>
                    {selectedDate === todayStr && (
                        <button
                            className="daily-generate-btn"
                            onClick={handleAutoGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? t('daily.generatingEods') : <>{DailyTabIcons.generate} {t('daily.generateEods')}</>}
                        </button>
                    )}
                    {generateResult && (
                        <span style={{
                            fontSize: '0.75rem',
                            color: generateResult.generated > 0 ? 'var(--accent-green)' : 'var(--text-secondary, #64748B)',
                            fontWeight: 700
                        }}>
                            {generateResult.generated > 0
                                ? `${generateResult.generated} ${t('daily.generatedEods')}`
                                : t('daily.noEventsToGenerate')}
                        </span>
                    )}
                </div>
            </div>

            {/* Coverage Alert */}
            <DailyCoverageAlert coverage={coverage} loading={coverageLoading} t={t} />

            {/* Loading indicator */}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '12px' }}>
                    <Loader2 size={24} className="icon-spin" />
                    <span style={{ fontSize: '1.1rem', color: '#64748b' }}>{t('daily.loadingReports')}</span>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                    <p>Error: {error}</p>
                </div>
            )}

            {/* ════════ STANDUP BOARD ════════ */}
            {!loading && !error && activeView === 'board' && (
                <div className="standup-layout animate-fade-in">
                    <div className="standup-columns">
                        {/* Done */}
                        <div className="standup-column standup-col-done">
                            <div className="standup-col-header">
                                <span className="standup-col-icon">{StandupIcons.done}</span>
                                <h3>{t('daily.done')}</h3>
                                <span className="standup-col-count">{standup.done.length}</span>
                            </div>
                            <div className="standup-col-items">
                                {standup.done.map((item, i) => (
                                    <div key={i} className="standup-item standup-item-done animate-fade-in">
                                        <p className="standup-item-desc">{item.description}</p>
                                        <div className="standup-item-meta">
                                            <span className="standup-item-agent">{item.agentAvatar} {item.agentName}</span>
                                            {item.duration && <span className="standup-item-duration">{StandupIcons.timer} {item.duration}</span>}
                                        </div>
                                    </div>
                                ))}
                                {standup.done.length === 0 && <p className="standup-empty">{t('daily.noCompletedTasks')}</p>}
                            </div>
                        </div>

                        {/* In Progress */}
                        <div className="standup-column standup-col-wip">
                            <div className="standup-col-header">
                                <span className="standup-col-icon">{StandupIcons.wip}</span>
                                <h3>{t('daily.inProgressLabel')}</h3>
                                <span className="standup-col-count">{standup.inProgress.length}</span>
                            </div>
                            <div className="standup-col-items">
                                {standup.inProgress.map((item, i) => (
                                    <div key={i} className="standup-item standup-item-wip animate-fade-in">
                                        <p className="standup-item-desc">{item.description}</p>
                                        <div className="standup-item-progress-bar">
                                            <div className="standup-item-progress-fill" style={{ width: `${item.progress}%` }}></div>
                                        </div>
                                        <div className="standup-item-meta">
                                            <span className="standup-item-agent">{item.agentAvatar} {item.agentName}</span>
                                            <span className="standup-item-pct">{item.progress}%</span>
                                        </div>
                                    </div>
                                ))}
                                {standup.inProgress.length === 0 && <p className="standup-empty">{t('daily.noInProgressTasks')}</p>}
                            </div>
                        </div>

                        {/* Blocked */}
                        <div className="standup-column standup-col-blocked">
                            <div className="standup-col-header">
                                <span className="standup-col-icon">{StandupIcons.blocked}</span>
                                <h3>{t('daily.blockedLabel')}</h3>
                                <span className="standup-col-count">{standup.blocked.length}</span>
                            </div>
                            <div className="standup-col-items">
                                {standup.blocked.map((item, i) => {
                                    const sev = severityConfig[item.severity] || severityConfig.medium;
                                    return (
                                        <div key={i} className="standup-item standup-item-blocked animate-fade-in">
                                            <p className="standup-item-desc">{item.description}</p>
                                            <div className="standup-item-meta">
                                                <span className="standup-item-agent">{item.agentAvatar} {item.agentName}</span>
                                                <span className="standup-severity" style={{ background: sev.bg, color: sev.color }}>
                                                    {sev.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {standup.blocked.length === 0 && <p className="standup-empty">{t('daily.noBlockers')} {StandupIcons.celebrate}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Insights Panel */}
                    {standup.insights.length > 0 && (
                        <div className="standup-insights-panel">
                            <h3 className="standup-insights-title">{StandupIcons.insights} {t('daily.insightsAndOpportunities')}</h3>
                            <div className="standup-insights-list">
                                {standup.insights.map((item, i) => (
                                    <div key={i} className="standup-insight animate-fade-in">
                                        <span className="standup-insight-agent">{item.agentAvatar} {item.agentName}</span>
                                        <p className="standup-insight-text">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Summary */}
                    <DailyAiSummary department={deptId} date={selectedDate} t={t} />
                </div>
            )}

            {/* ════════ EOD REPORTS GRID ════════ */}
            {!loading && !error && activeView === 'reports' && !selectedAgent && (
                <div className="eod-reports-grid animate-fade-in">
                    {reports.map((report) => {
                        const mood = moodConfig[report.mood] || { emoji: MoodIcons.unknown, label: '?' };
                        return (
                            <div
                                key={report.agent_id}
                                className="card eod-agent-card animate-fade-in"
                                onClick={() => setSelectedAgent(report.agent_id)}
                            >
                                <div className="eod-agent-header">
                                    <div className="eod-agent-info">
                                        <span className="eod-agent-avatar">{report.avatar}</span>
                                        <div>
                                            <h3 className="eod-agent-name">{report.agent_name}</h3>
                                            <p className="eod-agent-role">{report.role}</p>
                                        </div>
                                    </div>
                                    <span className="eod-mood-badge">
                                        {mood.emoji} {mood.label}
                                    </span>
                                </div>
                                <div className="eod-agent-summary">
                                    <div className="eod-mini-stats">
                                        <span className="eod-mini-stat">
                                            <span className="eod-mini-val">{(report.completed_tasks || []).length}</span> done
                                        </span>
                                        <span className="eod-mini-stat">
                                            <span className="eod-mini-val">{(report.in_progress_tasks || []).length}</span> wip
                                        </span>
                                        <span className="eod-mini-stat eod-mini-blockers">
                                            <span className="eod-mini-val">{(report.blockers || []).length}</span> blockers
                                        </span>
                                        <span className="eod-mini-stat">
                                            <span className="eod-mini-val">{(report.insights || []).length}</span> insights
                                        </span>
                                    </div>
                                    {(report.completed_tasks || []).length > 0 && (
                                        <p className="eod-preview-text">{StatusIcons.completed} {report.completed_tasks[0].desc}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {reports.length === 0 && (
                        <p style={{ color: '#64748b', textAlign: 'center', gridColumn: '1 / -1', padding: '32px 0' }}>
                            {t('daily.noReportsForDate')}
                        </p>
                    )}
                </div>
            )}

            {/* ════════ SINGLE AGENT EOD DETAIL ════════ */}
            {!loading && !error && activeView === 'reports' && selectedAgent && selectedReport && (() => {
                const mood = moodConfig[selectedReport.mood] || { emoji: MoodIcons.unknown, label: '?' };
                return (
                    <div className="eod-detail animate-fade-in">
                        <button className="back-button" onClick={() => setSelectedAgent(null)} style={{ marginBottom: '16px' }}>
                            ← {t('daily.backToAllReports')}
                        </button>

                        <div className="card eod-detail-header">
                            <div className="eod-detail-agent">
                                <span className="eod-detail-avatar">{selectedReport.avatar}</span>
                                <div>
                                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedReport.agent_name}</h2>
                                    <p className="subtitle">{selectedReport.role} · {deptName}</p>
                                </div>
                            </div>
                            <div className="eod-detail-meta">
                                <span className="eod-mood-badge eod-mood-lg">{mood.emoji} {mood.label}</span>
                                <span className="subtitle" style={{ fontSize: '0.75rem' }}>
                                    {new Date(selectedReport.date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </span>
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="eod-section">
                            <h3 className="eod-section-title eod-section-done">{StatusIcons.completed} {t('daily.completedCount')} ({(selectedReport.completed_tasks || []).length})</h3>
                            {(selectedReport.completed_tasks || []).length > 0 ? (
                                <div className="eod-items">
                                    {selectedReport.completed_tasks.map((c, i) => (
                                        <div key={i} className="eod-item eod-item-done">
                                            <p className="eod-item-desc">{c.desc}</p>
                                            {c.duration && <span className="eod-item-duration">{StandupIcons.timer} {c.duration}</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="eod-empty">{t('daily.noCompletedToday')}</p>
                            )}
                        </div>

                        {/* In Progress */}
                        <div className="eod-section">
                            <h3 className="eod-section-title eod-section-wip">{StandupIcons.wip} {t('daily.inProgressCount')} ({(selectedReport.in_progress_tasks || []).length})</h3>
                            {(selectedReport.in_progress_tasks || []).length > 0 ? (
                                <div className="eod-items">
                                    {selectedReport.in_progress_tasks.map((p, i) => (
                                        <div key={i} className="eod-item eod-item-wip">
                                            <p className="eod-item-desc">{p.desc}</p>
                                            <div className="eod-item-progress">
                                                <div className="pipeline-progress-bar" style={{ width: '120px' }}>
                                                    <div className="pipeline-progress-fill" style={{ width: `${p.pct}%` }}></div>
                                                </div>
                                                <span className="eod-item-pct">{p.pct}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="eod-empty">{t('daily.noInProgressTasks')}</p>
                            )}
                        </div>

                        {/* Blockers */}
                        <div className="eod-section">
                            <h3 className="eod-section-title eod-section-blocked">{StandupIcons.blocked} Blockers ({(selectedReport.blockers || []).length})</h3>
                            {(selectedReport.blockers || []).length > 0 ? (
                                <div className="eod-items">
                                    {selectedReport.blockers.map((b, i) => {
                                        const sev = severityConfig[b.severity] || severityConfig.medium;
                                        return (
                                            <div key={i} className="eod-item eod-item-blocked">
                                                <p className="eod-item-desc">{b.desc}</p>
                                                <span className="standup-severity" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="eod-empty">{t('daily.noBlockers')} {StandupIcons.celebrate}</p>
                            )}
                        </div>

                        {/* Insights */}
                        <div className="eod-section">
                            <h3 className="eod-section-title eod-section-insights">{StandupIcons.insights} Insights ({(selectedReport.insights || []).length})</h3>
                            {(selectedReport.insights || []).length > 0 ? (
                                <div className="eod-items">
                                    {selectedReport.insights.map((ins, i) => (
                                        <div key={i} className="eod-item eod-item-insight">
                                            <p className="eod-item-desc">{ins}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="eod-empty">{t('daily.noInsightsToday')}</p>
                            )}
                        </div>

                        {/* Plan Tomorrow */}
                        <div className="eod-section">
                            <h3 className="eod-section-title eod-section-plan">{StandupIcons.plan} {t('daily.planTomorrow')}</h3>
                            <div className="eod-plan-items">
                                {(selectedReport.plan_tomorrow || []).map((p, i) => (
                                    <div key={i} className="eod-plan-item">
                                        <span className="eod-plan-number">{i + 1}</span>
                                        <p>{p}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ════════ TRENDS ════════ */}
            {!loading && !error && activeView === 'trends' && (
                <DailyTrends department={deptId} t={t} />
            )}

            {/* ════════ MODAL ════════ */}
            <DailyEodModal
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmitReport}
                agents={agents}
                isSubmitting={isSubmitting}
                t={t}
                moodConfig={moodConfig}
            />
        </div>
    );
}
