import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { StatusIcons, PageHeaderIcons } from '../components/icons.jsx';
import { Workflow, Activity, CheckCircle2, Clock, Inbox } from 'lucide-react';
import WORKFLOWS from '../data/workflows.js';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import FormField from '../components/ui/FormField.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function ActivePipelinesList({ onSelectPipeline }) {
    const { t } = useLanguage();
    const [pipelines, setPipelines] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/pipelines/active`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setPipelines(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    if (pipelines.length === 0) {
        return <div className="empty-state">{t('pipeline.noPipeline')}</div>;
    }

    return (
        <div className="active-pipelines-list">
            {pipelines.map(p => (
                <div key={p.id} className="active-pipeline-card" onClick={() => onSelectPipeline?.(p.project_id)}>
                    <div className="pipeline-info">
                        <h4>{p.project_name}</h4>
                        <span className="workflows-hub__pipeline-meta">
                            {p.project_department} • {p.active_stages?.map(s => s.stage_name).join(', ') || 'No active stages'}
                        </span>
                    </div>
                    <div className="pipeline-progress">
                        <div className="progress-bar">
                            {/* Width is data-driven (completed / total) — inline style is the right tool here */}
                            <div className="progress-fill" style={{ width: `${(p.completed_stages / p.total_stages) * 100}%` }} />
                        </div>
                        <span className="workflows-hub__pipeline-meta">
                            {p.completed_stages}/{p.total_stages}
                        </span>
                        <span className={`pipeline-status-badge ${p.status}`}>
                            {t(`pipeline.${p.status}`) || p.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function WorkflowsHub() {
    const { t } = useLanguage();
    const [view, setView] = useState('catalog');
    const [stats, setStats] = useState({ total_runs: 0, completed: 0, failed: 0, active: 0, last_run_at: null });
    const [runs, setRuns] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [triggeringId, setTriggeringId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    // Consolidated prompt modal state
    const [promptState, setPromptState] = useState({ workflow: null, text: '', projectId: '' });
    const [campaignProjects, setCampaignProjects] = useState([]);
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

    const getLastRun = (workflowId) => runs.find(r => r.workflow_id === workflowId);
    const getWorkflowRuns = (workflowId) => runs.filter(r => r.workflow_id === workflowId);

    // Decision-relevant stats: in-flight, completed this week, last run
    const completedThisWeek = useMemo(() => {
        const cutoff = Date.now() - 7 * DAY_MS;
        return runs.filter(r => r.status === 'completed' && r.started_at && new Date(r.started_at).getTime() >= cutoff).length;
    }, [runs]);

    const closePromptModal = useCallback(() => {
        setPromptState({ workflow: null, text: '', projectId: '' });
        setCampaignProjects([]);
    }, []);

    const handleTrigger = async (wf) => {
        if (wf.promptConfig) {
            setPromptState({ workflow: wf, text: '', projectId: '' });
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
        closePromptModal();
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

    // ── Shared prompt modal (single instance; rendered once at the bottom) ──
    const promptModal = (
        <Modal
            open={Boolean(promptState.workflow)}
            onClose={closePromptModal}
            title={promptState.workflow?.name || ''}
            size="md"
        >
            <p className="workflows-hub__prompt-desc">
                {t('workflows.promptDescription')}
            </p>
            <FormField label={t('workflows.campaignProject')}>
                {loadingCampaigns ? (
                    <Skeleton height={36} />
                ) : (
                    <select
                        className="workflow-campaign-select"
                        value={promptState.projectId}
                        onChange={(e) => setPromptState(p => ({ ...p, projectId: e.target.value }))}
                    >
                        <option value="">{t('workflows.noCampaignSelected')}</option>
                        {campaignProjects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
            </FormField>
            <FormField label={t('workflows.promptDescription')}>
                <textarea
                    className="workflow-prompt-textarea"
                    rows={5}
                    placeholder={promptState.workflow ? t(promptState.workflow.promptConfig.placeholderKey) : ''}
                    value={promptState.text}
                    onChange={(e) => setPromptState(p => ({ ...p, text: e.target.value }))}
                    autoFocus
                />
            </FormField>
            <div className="workflow-confirm-actions">
                <Button variant="ghost" onClick={closePromptModal}>
                    {t('workflows.cancel')}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => promptState.workflow && doTrigger(
                        promptState.workflow.id,
                        promptState.text,
                        promptState.projectId || null,
                    )}
                    disabled={!promptState.text.trim()}
                >
                    {t('workflows.run')}
                </Button>
            </div>
        </Modal>
    );

    // ── Confirm dialog (replaces the homegrown overlay) ──
    const confirmWorkflow = WORKFLOWS.find(w => w.id === confirmId);
    const confirmDialog = (
        <ConfirmDialog
            open={Boolean(confirmId)}
            title={t('workflows.triggerWorkflow')}
            message={`${t('workflows.confirmTrigger')} ${confirmWorkflow?.name || ''}?`}
            confirmLabel={t('workflows.confirm')}
            cancelLabel={t('workflows.cancel')}
            variant="primary"
            onCancel={() => setConfirmId(null)}
            onConfirm={() => confirmId && doTrigger(confirmId)}
        />
    );

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <div className="workflows-hub__loading">
                    <Skeleton height={160} radius="var(--radius-lg)" />
                    <div className="workflows-hub__loading-stats">
                        <Skeleton height={88} radius="var(--radius-lg)" />
                        <Skeleton height={88} radius="var(--radius-lg)" />
                        <Skeleton height={88} radius="var(--radius-lg)" />
                    </div>
                    <Skeleton height={48} radius="var(--radius-md)" />
                    <div className="workflows-hub__loading-grid">
                        <Skeleton height={220} radius="var(--radius-lg)" />
                        <Skeleton height={220} radius="var(--radius-lg)" />
                        <Skeleton height={220} radius="var(--radius-lg)" />
                    </div>
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

                <div className="card workflows-hub__detail-card">
                    <div className="workflow-detail-header">
                        <span className="workflow-detail-icon">{wf.icon}</span>
                        <div className="workflows-hub__detail-info">
                            <div className="workflows-hub__detail-title-row">
                                <h2 className="workflows-hub__detail-title">{wf.name}</h2>
                                <span className="workflow-category-tag">{t(`workflows.${wf.category}`)}</span>
                                <span className="workflow-category-tag">{wf.automatable ? t('workflows.automatable') : t('workflows.manual')}</span>
                            </div>
                            <p className="subtitle">{wf.description}</p>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => handleTrigger(wf)}
                            disabled={triggeringId === wf.id}
                        >
                            {triggeringId === wf.id ? t('workflows.running') : t('workflows.run')}
                        </Button>
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
                        <div className={`workflows-hub__active-banner workflows-hub__active-banner--${latestActive.status}`}>
                            <p className="workflows-hub__active-banner-title">
                                {latestActive.status === 'running' ? t('workflows.running') : t('workflows.stepsChecklist')}
                            </p>
                            <div className="workflows-hub__active-banner-actions">
                                <Button variant="primary" onClick={() => handleUpdateRun(latestActive.id, 'completed')}>
                                    {t('workflows.markCompleted')}
                                </Button>
                                <Button variant="danger" onClick={() => handleUpdateRun(latestActive.id, 'failed')}>
                                    {t('workflows.markFailed')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Run history for this workflow */}
                <h3 className="workflows-hub__section-title">
                    {t('workflows.runHistory')}
                </h3>

                {wfRuns.length === 0 ? (
                    <EmptyState
                        icon={<Inbox size={28} />}
                        title={t('workflows.noRuns')}
                        description={t('workflows.noRunsHint')}
                    />
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
                                    <div className="workflows-hub__run-head">
                                        <span className="workflows-hub__run-name">{wf.name}</span>
                                        <span className={`workflow-run-status ${run.status}`}>{run.status}</span>
                                    </div>
                                    <div className="workflows-hub__run-meta">
                                        <span>{t('workflows.duration')}: {formatDuration(run.duration_ms)}</span>
                                        <span>{t('workflows.triggeredBy')}: {run.triggered_by}</span>
                                    </div>
                                    {run.prompt && (
                                        <p className="workflows-hub__run-prompt">
                                            {run.prompt.slice(0, 300)}
                                        </p>
                                    )}
                                    {run.output_summary && (
                                        <p className="workflows-hub__run-summary">
                                            {run.output_summary.slice(0, 200)}
                                        </p>
                                    )}
                                    {run.error && (
                                        <p className="workflows-hub__run-error">
                                            {run.error.slice(0, 200)}
                                        </p>
                                    )}
                                    {(run.status === 'pending' || run.status === 'running') && (
                                        <div className="workflows-hub__run-actions">
                                            <Button size="sm" variant="primary" onClick={() => handleUpdateRun(run.id, 'completed')}>
                                                {t('workflows.markCompleted')}
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => handleUpdateRun(run.id, 'failed')}>
                                                {t('workflows.markFailed')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Shared modals */}
                {promptModal}
                {confirmDialog}
            </div>
        );
    }

    // Main view
    return (
        <div className="dashboard-container animate-fade-in">
            <HubHero
                eyebrow={<>
                    <Workflow size={14} strokeWidth={2.5} />
                    <span>{t('workflows.hero.eyebrow')}</span>
                </>}
                title={t('workflows.title')}
                subtitle={t('workflows.hero.subtitle')}
            />

            <HubStats>
                <HubStatCard
                    icon={<Activity size={16} strokeWidth={2} />}
                    label={t('workflows.stats.active')}
                    value={stats.active || 0}
                    tone="emerald"
                />
                <HubStatCard
                    icon={<CheckCircle2 size={16} strokeWidth={2} />}
                    label={t('workflows.stats.completedThisWeek')}
                    value={completedThisWeek}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<Clock size={16} strokeWidth={2} />}
                    label={t('workflows.stats.lastRun')}
                    value={stats.last_run_at ? timeAgo(stats.last_run_at) : '—'}
                    tone="amber"
                />
            </HubStats>

            {/* Tab toggle (matches CampaignsHub pattern) */}
            <div className="weekly-view-toggle workflows-hub__tabs">
                <button
                    type="button"
                    className={`weekly-toggle-btn ${view === 'catalog' ? 'active' : ''}`}
                    onClick={() => setView('catalog')}
                >
                    {t('workflows.catalog')}
                </button>
                <button
                    type="button"
                    className={`weekly-toggle-btn ${view === 'history' ? 'active' : ''}`}
                    onClick={() => setView('history')}
                >
                    {t('workflows.history')}
                </button>
                <button
                    type="button"
                    className={`weekly-toggle-btn ${view === 'pipelines' ? 'active' : ''}`}
                    onClick={() => setView('pipelines')}
                >
                    {t('pipeline.activePipelines')}
                </button>
            </div>

            {/* Category filter */}
            {view === 'catalog' && (
                <div className="campaigns-hub__cat-chips">
                    {['all', 'execution', 'strategy', 'control'].map(cat => {
                        const active = bauFilter === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                className={`campaigns-hub__cat-chip ${active ? 'is-active' : ''}`}
                                onClick={() => setBauFilter(cat)}
                            >
                                {cat === 'all' ? t('workflows.allCategories') : t(`workflows.${cat}`)}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Catalog view */}
            {view === 'catalog' && (
                filteredWorkflows.length === 0 ? (
                    <EmptyState
                        icon={<Inbox size={28} />}
                        title={t('workflows.empty.title')}
                        description={t('workflows.empty.description')}
                    />
                ) : (
                    <div className="workflows-hub-grid">
                        {filteredWorkflows.map((wf) => {
                            const lastRun = getLastRun(wf.id);
                            const isRunning = triggeringId === wf.id || (lastRun && lastRun.status === 'running');

                            return (
                                <div
                                    key={wf.id}
                                    className="card workflow-card workflows-hub__card animate-fade-in"
                                    onClick={() => setSelectedWorkflow(wf.id)}
                                >
                                    {/* Header */}
                                    <div className="workflows-hub__card-header">
                                        <div className="workflows-hub__card-title">
                                            <span className="workflows-hub__card-icon">{wf.icon}</span>
                                            <h3 className="workflows-hub__card-name">{wf.name}</h3>
                                        </div>
                                        <div className="workflows-hub__card-tags">
                                            <span className="workflow-category-tag">{t(`workflows.${wf.category}`)}</span>
                                            {lastRun && <span className={`workflow-run-status ${lastRun.status}`}>{lastRun.status}</span>}
                                        </div>
                                    </div>

                                    <p className="subtitle workflows-hub__card-desc">{wf.description}</p>

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
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleTrigger(wf); }}
                                            disabled={isRunning}
                                        >
                                            {isRunning ? t('workflows.running') : t('workflows.run')}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* History view */}
            {view === 'history' && (
                <div>
                    {runs.length === 0 ? (
                        <EmptyState
                            icon={<Inbox size={28} />}
                            title={t('workflows.noRuns')}
                            description={t('workflows.noRunsHint')}
                        />
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
                                            <div className="workflows-hub__run-head">
                                                <span className="workflows-hub__run-name">{wf?.name || run.workflow_id}</span>
                                                <span className={`workflow-run-status ${run.status}`}>{run.status}</span>
                                            </div>
                                            <div className="workflows-hub__run-meta">
                                                <span>{t('workflows.duration')}: {formatDuration(run.duration_ms)}</span>
                                                <span>{t('workflows.triggeredBy')}: {run.triggered_by}</span>
                                            </div>
                                            {run.prompt && (
                                                <p className="workflows-hub__run-prompt">
                                                    {run.prompt.slice(0, 300)}
                                                </p>
                                            )}
                                            {run.output_summary && (
                                                <p className="workflows-hub__run-summary">
                                                    {run.output_summary.slice(0, 200)}
                                                </p>
                                            )}
                                            {run.error && (
                                                <p className="workflows-hub__run-error">
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

            {/* Active Pipelines view */}
            {view === 'pipelines' && (
                <ActivePipelinesList />
            )}

            {/* Shared modals */}
            {promptModal}
            {confirmDialog}
        </div>
    );
}
