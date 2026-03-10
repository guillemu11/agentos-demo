import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { StatusIcons, PageHeaderIcons } from '../components/icons.jsx';
import { Zap } from 'lucide-react';
import WORKFLOWS from '../data/workflows.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function timeAgo(dateStr) {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

function formatDuration(ms) {
    if (!ms) return '-';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}min`;
}

export default function WorkflowsHub() {
    const { t } = useLanguage();
    const [view, setView] = useState('catalog');
    const [stats, setStats] = useState({ total_runs: 0, completed: 0, failed: 0, active: 0, last_run_at: null });
    const [runs, setRuns] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [triggeringId, setTriggeringId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [promptWorkflow, setPromptWorkflow] = useState(null);
    const [promptText, setPromptText] = useState('');
    const [campaignProjects, setCampaignProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [loading, setLoading] = useState(true);
    const [bauFilter, setBauFilter] = useState('all');

    const categoryFilter = bauFilter;
    const filteredWorkflows = categoryFilter === 'all'
        ? WORKFLOWS
        : WORKFLOWS.filter(wf => wf.category === categoryFilter);

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, runsRes] = await Promise.all([
                fetch(`${API_URL}/workflows/stats`),
                fetch(`${API_URL}/workflows/runs?limit=100`),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (runsRes.ok) setRuns(await runsRes.json());
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Polling for active runs
    useEffect(() => {
        const hasActive = runs.some(r => r.status === 'running');
        if (!hasActive) return;
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [runs, fetchData]);

    const getLastRun = (workflowId) => {
        return runs.find(r => r.workflow_id === workflowId);
    };

    const getWorkflowRuns = (workflowId) => {
        return runs.filter(r => r.workflow_id === workflowId);
    };

    const handleTrigger = async (wf) => {
        if (wf.promptConfig) {
            setPromptWorkflow(wf);
            setPromptText('');
            setSelectedProjectId('');
            setLoadingCampaigns(true);
            try {
                const res = await fetch(`${API_URL}/projects/campaigns/eligible`);
                if (res.ok) setCampaignProjects(await res.json());
            } catch { /* ignore */ }
            setLoadingCampaigns(false);
        } else if (wf.automatable) {
            setConfirmId(wf.id);
        } else {
            await doTrigger(wf.id);
        }
    };

    const doTrigger = async (workflowId, prompt = null, projectId = null) => {
        setConfirmId(null);
        setPromptWorkflow(null);
        setSelectedProjectId('');
        setCampaignProjects([]);
        setTriggeringId(workflowId);
        try {
            const body = { workflow_id: workflowId };
            if (prompt) body.prompt = prompt;
            if (projectId) body.project_id = parseInt(projectId, 10);
            await fetch(`${API_URL}/workflows/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            await fetchData();
        } catch { /* ignore */ }
        setTriggeringId(null);
    };

    const handleUpdateRun = async (runId, status) => {
        try {
            await fetch(`${API_URL}/workflows/runs/${runId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            await fetchData();
        } catch { /* ignore */ }
    };

    const statusIcon = (status) => {
        switch (status) {
            case 'completed': return StatusIcons.completed;
            case 'failed': return StatusIcons.failed;
            case 'running': return StatusIcons.running;
            case 'pending': return StatusIcons.pending;
            default: return StatusIcons.idle;
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px' }}>{PageHeaderIcons.workflows}</div>
                    <p className="subtitle">{t('workflows.loading')}</p>
                </div>
            </div>
        );
    }

    // Detail view
    if (selectedWorkflow) {
        const wf = WORKFLOWS.find(w => w.id === selectedWorkflow);
        if (!wf) return null;
        const wfRuns = getWorkflowRuns(wf.id);
        const latestActive = wfRuns.find(r => r.status === 'pending' || r.status === 'running');

        return (
            <div className="dashboard-container animate-fade-in">
                <div className="workflow-detail-back">
                    <button className="back-button" onClick={() => setSelectedWorkflow(null)}>
                        ← {t('workflows.backToCatalog')}
                    </button>
                </div>

                <div className="card" style={{ marginBottom: '32px' }}>
                    <div className="workflow-detail-header">
                        <span className="workflow-detail-icon">{wf.icon}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{wf.name}</h2>
                                <span className="workflow-category-tag">{t(`workflows.${wf.category}`)}</span>
                                <span className="workflow-category-tag">{wf.automatable ? t('workflows.automatable') : t('workflows.manual')}</span>
                            </div>
                            <p className="subtitle">{wf.description}</p>
                        </div>
                        <button
                            className={`workflow-trigger-btn ${triggeringId === wf.id ? 'running' : ''}`}
                            onClick={() => handleTrigger(wf)}
                            disabled={triggeringId === wf.id}
                        >
                            {triggeringId === wf.id ? t('workflows.running') : t('workflows.run')}
                        </button>
                    </div>

                    {/* Pipeline steps */}
                    <div className="workflow-steps">
                        {wf.steps.map((step, i) => (
                            <div key={i} className="workflow-step">
                                <div className="workflow-step-dot"></div>
                                {i < wf.steps.length - 1 && <div className="workflow-step-line"></div>}
                                <div className="workflow-step-content">
                                    <span className="workflow-step-agent">{step.agent}</span>
                                    <span className="workflow-step-action">{step.action}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Active run: action buttons (pending or running) */}
                    {latestActive && (
                        <div style={{ marginTop: '20px', padding: '16px', background: latestActive.status === 'running' ? 'rgba(99,102,241,0.1)' : 'rgba(212,175,55,0.1)', borderRadius: '12px', border: `1px solid ${latestActive.status === 'running' ? 'rgba(99,102,241,0.25)' : 'rgba(212,175,55,0.25)'}` }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>
                                {latestActive.status === 'running' ? t('workflows.running') : t('workflows.stepsChecklist')}
                            </p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="workflow-trigger-btn" onClick={() => handleUpdateRun(latestActive.id, 'completed')}>
                                    {t('workflows.markCompleted')}
                                </button>
                                <button className="workflow-cancel-btn" onClick={() => handleUpdateRun(latestActive.id, 'failed')}>
                                    {t('workflows.markFailed')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Run history for this workflow */}
                <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', color: 'var(--text-muted)' }}>
                    {t('workflows.runHistory')}
                </h3>

                {wfRuns.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <p>{t('workflows.noRuns')}</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>{t('workflows.noRunsHint')}</p>
                    </div>
                ) : (
                    <div className="audit-timeline">
                        {wfRuns.map((run) => (
                            <div key={run.id} className="audit-event">
                                <div className="audit-event-time">
                                    <span className="audit-time">{timeAgo(run.started_at)}</span>
                                </div>
                                <div className="audit-event-icon-wrapper">
                                    <div className="audit-event-icon">{statusIcon(run.status)}</div>
                                    <div className="audit-timeline-line"></div>
                                </div>
                                <div className="card audit-event-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{wf.name}</span>
                                        <span className={`workflow-run-status ${run.status}`}>{run.status}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        <span>{t('workflows.duration')}: {formatDuration(run.duration_ms)}</span>
                                        <span>{t('workflows.triggeredBy')}: {run.triggered_by}</span>
                                    </div>
                                    {run.prompt && (
                                        <p style={{ fontSize: '0.8rem', marginTop: '8px', padding: '8px 12px', background: 'rgba(212,175,55,0.08)', borderRadius: '8px', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                            {run.prompt.slice(0, 300)}
                                        </p>
                                    )}
                                    {run.output_summary && (
                                        <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                                            {run.output_summary.slice(0, 200)}
                                        </p>
                                    )}
                                    {run.error && (
                                        <p style={{ fontSize: '0.8rem', marginTop: '8px', color: '#EF4444' }}>
                                            {run.error.slice(0, 200)}
                                        </p>
                                    )}
                                    {(run.status === 'pending' || run.status === 'running') && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                            <button className="workflow-trigger-btn" style={{ fontSize: '0.75rem', padding: '6px 14px' }} onClick={() => handleUpdateRun(run.id, 'completed')}>
                                                {t('workflows.markCompleted')}
                                            </button>
                                            <button className="workflow-cancel-btn" style={{ fontSize: '0.75rem', padding: '6px 14px' }} onClick={() => handleUpdateRun(run.id, 'failed')}>
                                                {t('workflows.markFailed')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Prompt modal (needed here because detail view is an early return) */}
                {promptWorkflow && (
                    <div className="workflow-confirm-overlay" onClick={() => { setPromptWorkflow(null); setSelectedProjectId(''); setCampaignProjects([]); }}>
                        <div className="workflow-prompt-card" onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <span style={{ fontSize: '1.5rem' }}>{promptWorkflow.icon}</span>
                                <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{promptWorkflow.name}</p>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                                {t('workflows.promptDescription')}
                            </p>
                            <div style={{ marginBottom: '16px' }}>
                                <label className="workflow-campaign-label">
                                    {t('workflows.campaignProject')}
                                </label>
                                {loadingCampaigns ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {t('workflows.loadingCampaigns')}
                                    </p>
                                ) : (
                                    <select
                                        className="workflow-campaign-select"
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                    >
                                        <option value="">{t('workflows.noCampaignSelected')}</option>
                                        {campaignProjects.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <textarea
                                className="workflow-prompt-textarea"
                                rows={5}
                                placeholder={t(promptWorkflow.promptConfig.placeholderKey)}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                autoFocus
                            />
                            <div className="workflow-confirm-actions">
                                <button className="workflow-cancel-btn" onClick={() => { setPromptWorkflow(null); setSelectedProjectId(''); setCampaignProjects([]); }}>
                                    {t('workflows.cancel')}
                                </button>
                                <button
                                    className="workflow-trigger-btn"
                                    onClick={() => doTrigger(promptWorkflow.id, promptText, selectedProjectId || null)}
                                    disabled={!promptText.trim()}
                                >
                                    {t('workflows.run')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main view
    return (
        <div className="dashboard-container animate-fade-in">
            {/* Header */}
            <header>
                <div>
                    <h1>{PageHeaderIcons.workflows} {t('workflows.title')}</h1>
                    <p className="subtitle">{t('workflows.subtitle')}</p>
                </div>
            </header>

            {/* Stats bar */}
            <section className="workspace-stats-bar">
                <div className="stat-chip">
                    <span className="stat-chip-value">{WORKFLOWS.length}</span>
                    <span className="stat-chip-label">{t('workflows.totalWorkflows')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{stats.total_runs}</span>
                    <span className="stat-chip-label">{t('workflows.totalRuns')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{stats.completed}</span>
                    <span className="stat-chip-label">{t('workflows.completed')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{stats.failed}</span>
                    <span className="stat-chip-label">{t('workflows.failed')}</span>
                </div>
                <div className="stat-chip stat-chip-active">
                    <span className="stat-chip-value">{stats.active}</span>
                    <span className="stat-chip-label">{t('workflows.activeRuns')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{stats.last_run_at ? timeAgo(stats.last_run_at) : '-'}</span>
                    <span className="stat-chip-label">{t('workflows.lastRun')}</span>
                </div>
            </section>

            {/* Tab toggle */}
            <div className="weekly-view-toggle" style={{ marginBottom: '32px' }}>
                <button className={`weekly-toggle-btn ${view === 'catalog' ? 'active' : ''}`} onClick={() => setView('catalog')}>
                    {t('workflows.catalog')}
                </button>
                <button className={`weekly-toggle-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
                    {t('workflows.history')}
                </button>
            </div>

            {/* Category filter */}
            {view === 'catalog' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {['all', 'execution', 'strategy', 'control'].map(cat => (
                        <button
                            key={cat}
                            className={`workflow-category-tag ${bauFilter === cat ? 'active' : ''}`}
                            style={{ cursor: 'pointer', padding: '6px 14px', borderRadius: '20px', border: bauFilter === cat ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: bauFilter === cat ? 'rgba(99,102,241,0.15)' : 'transparent', fontWeight: 600, fontSize: '0.8rem' }}
                            onClick={() => setBauFilter(cat)}
                        >
                            {cat === 'all' ? t('workflows.allCategories') : t(`workflows.${cat}`)}
                        </button>
                    ))}
                </div>
            )}

            {/* Catalog view */}
            {view === 'catalog' && (
                <div className="workflows-hub-grid">
                    {filteredWorkflows.map((wf) => {
                        const lastRun = getLastRun(wf.id);
                        const isRunning = triggeringId === wf.id || (lastRun && lastRun.status === 'running');

                        return (
                            <div
                                key={wf.id}
                                className="card workflow-card animate-fade-in"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedWorkflow(wf.id)}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '1.3rem' }}>{wf.icon}</span>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{wf.name}</h3>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <span className="workflow-category-tag">{t(`workflows.${wf.category}`)}</span>
                                        {lastRun && <span className={`workflow-run-status ${lastRun.status}`}>{lastRun.status}</span>}
                                    </div>
                                </div>

                                <p className="subtitle" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>{wf.description}</p>

                                {/* Agent badges */}
                                <div className="workflow-agents">
                                    {wf.agents.map((a) => (
                                        <span key={a} className="workflow-agent-badge">{a}</span>
                                    ))}
                                </div>

                                {/* Pipeline steps */}
                                <div className="workflow-steps">
                                    {wf.steps.map((step, i) => (
                                        <div key={i} className="workflow-step">
                                            <div className="workflow-step-dot"></div>
                                            {i < wf.steps.length - 1 && <div className="workflow-step-line"></div>}
                                            <div className="workflow-step-content">
                                                <span className="workflow-step-agent">{step.agent}</span>
                                                <span className="workflow-step-action">{step.action}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="workflow-card-footer">
                                    <span className="workflow-last-run">
                                        {lastRun
                                            ? `${t('workflows.lastRun')}: ${timeAgo(lastRun.started_at)}`
                                            : t('workflows.never')
                                        }
                                    </span>
                                    <button
                                        className={`workflow-trigger-btn ${isRunning ? 'running' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleTrigger(wf); }}
                                        disabled={isRunning}
                                    >
                                        {isRunning ? t('workflows.running') : wf.automatable ? t('workflows.run') : t('workflows.run')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* History view */}
            {view === 'history' && (
                <div>
                    {runs.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{t('workflows.noRuns')}</p>
                            <p style={{ fontSize: '0.85rem' }}>{t('workflows.noRunsHint')}</p>
                        </div>
                    ) : (
                        <div className="audit-timeline">
                            {runs.map((run) => {
                                const wf = WORKFLOWS.find(w => w.id === run.workflow_id);
                                return (
                                    <div key={run.id} className="audit-event">
                                        <div className="audit-event-time">
                                            <span className="audit-time">{timeAgo(run.started_at)}</span>
                                        </div>
                                        <div className="audit-event-icon-wrapper">
                                            <div className="audit-event-icon">{wf?.icon || PageHeaderIcons.workflows}</div>
                                            <div className="audit-timeline-line"></div>
                                        </div>
                                        <div className="card audit-event-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{wf?.name || run.workflow_id}</span>
                                                <span className={`workflow-run-status ${run.status}`}>{run.status}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                <span>{t('workflows.duration')}: {formatDuration(run.duration_ms)}</span>
                                                <span>{t('workflows.triggeredBy')}: {run.triggered_by}</span>
                                            </div>
                                            {run.prompt && (
                                                <p style={{ fontSize: '0.8rem', marginTop: '8px', padding: '8px 12px', background: 'rgba(212,175,55,0.08)', borderRadius: '8px', color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                                    {run.prompt.slice(0, 300)}
                                                </p>
                                            )}
                                            {run.output_summary && (
                                                <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-muted)' }}>
                                                    {run.output_summary.slice(0, 200)}
                                                </p>
                                            )}
                                            {run.error && (
                                                <p style={{ fontSize: '0.8rem', marginTop: '8px', color: '#EF4444' }}>
                                                    {run.error.slice(0, 200)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation modal */}
            {confirmId && (
                <div className="workflow-confirm-overlay" onClick={() => setConfirmId(null)}>
                    <div className="workflow-confirm-card" onClick={(e) => e.stopPropagation()}>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>{t('workflows.triggerWorkflow')}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            {t('workflows.confirmTrigger')} <strong>{WORKFLOWS.find(w => w.id === confirmId)?.name}</strong>?
                        </p>
                        <div className="workflow-confirm-actions">
                            <button className="workflow-cancel-btn" onClick={() => setConfirmId(null)}>
                                {t('workflows.cancel')}
                            </button>
                            <button className="workflow-trigger-btn" onClick={() => doTrigger(confirmId)}>
                                {t('workflows.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt modal for workflows that need a brief */}
            {promptWorkflow && (
                <div className="workflow-confirm-overlay" onClick={() => { setPromptWorkflow(null); setSelectedProjectId(''); setCampaignProjects([]); }}>
                    <div className="workflow-prompt-card" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '1.5rem' }}>{promptWorkflow.icon}</span>
                            <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{promptWorkflow.name}</p>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                            {t('workflows.promptDescription')}
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="workflow-campaign-label">
                                {t('workflows.campaignProject')}
                            </label>
                            {loadingCampaigns ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {t('workflows.loadingCampaigns')}
                                </p>
                            ) : (
                                <select
                                    className="workflow-campaign-select"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    <option value="">{t('workflows.noCampaignSelected')}</option>
                                    {campaignProjects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <textarea
                            className="workflow-prompt-textarea"
                            rows={5}
                            placeholder={t(promptWorkflow.promptConfig.placeholderKey)}
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            autoFocus
                        />
                        <div className="workflow-confirm-actions">
                            <button className="workflow-cancel-btn" onClick={() => { setPromptWorkflow(null); setSelectedProjectId(''); setCampaignProjects([]); }}>
                                {t('workflows.cancel')}
                            </button>
                            <button
                                className="workflow-trigger-btn"
                                onClick={() => doTrigger(promptWorkflow.id, promptText, selectedProjectId || null)}
                                disabled={!promptText.trim()}
                            >
                                {t('workflows.run')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
