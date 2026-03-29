import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CAMPAIGNS } from '../data/emiratesCampaigns.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus, Play, Pause, Zap, Trash2, Loader, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const METRICS = ['openRate', 'clickRate', 'conversionRate'];
const EXPERIMENT_TYPES = ['subject_line', 'copy', 'design', 'segmentation', 'send_time', 'cta'];
const INTERVALS = ['1h', '4h', '12h', '24h'];

/** Minimal markdown → HTML */
function simpleMarkdown(md) {
    return (md || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '<br/><br/>');
}

export default function AutoExperimentDashboard() {
    const { t } = useLanguage();
    const [loops, setLoops] = useState([]);
    const [selectedLoop, setSelectedLoop] = useState(null);
    const [cycles, setCycles] = useState([]);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [runningCycle, setRunningCycle] = useState(false);
    const [showKnowledge, setShowKnowledge] = useState(false);

    // Create form state
    const [formCampaign, setFormCampaign] = useState('');
    const [formMetric, setFormMetric] = useState('openRate');
    const [formType, setFormType] = useState('subject_line');
    const [formMaxCycles, setFormMaxCycles] = useState(20);
    const [formInterval, setFormInterval] = useState('4h');

    const eventSourceRef = useRef(null);

    useEffect(() => { loadLoops(); }, []);
    useEffect(() => {
        if (selectedLoop) loadCycles(selectedLoop.id);
    }, [selectedLoop?.id, selectedLoop?.cycle_count]);

    // SSE for real-time updates when loop is running
    useEffect(() => {
        if (!selectedLoop || selectedLoop.status !== 'running') return;

        const es = new EventSource(`${API_URL}/experiment-loops/${selectedLoop.id}/stream`, { withCredentials: true });
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            if (event.data === '[DONE]') { es.close(); return; }
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'cycle') {
                    loadLoops();
                    loadCycles(selectedLoop.id);
                }
            } catch { /* ignore */ }
        };

        return () => es.close();
    }, [selectedLoop?.id, selectedLoop?.status]);

    async function loadLoops() {
        try {
            const res = await fetch(`${API_URL}/experiment-loops`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLoops(data.loops);
                // Refresh selected if exists
                if (selectedLoop) {
                    const updated = data.loops.find(l => l.id === selectedLoop.id);
                    if (updated) setSelectedLoop(updated);
                }
            }
        } catch { /* ignore */ }
    }

    async function loadCycles(loopId) {
        try {
            const res = await fetch(`${API_URL}/experiment-loops/${loopId}/cycles`, { credentials: 'include' });
            if (res.ok) setCycles((await res.json()).cycles);
        } catch { /* ignore */ }
    }

    async function handleCreate() {
        if (!formCampaign) return;
        setLoading(true);
        try {
            const campaign = CAMPAIGNS.find(c => c.id === formCampaign);
            const name = `${campaign?.name || formCampaign} — ${formType}`;
            const res = await fetch(`${API_URL}/experiment-loops`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    campaign_id: formCampaign,
                    name,
                    metric_target: formMetric,
                    experiment_type: formType,
                    max_cycles: formMaxCycles,
                    cycle_interval: formInterval,
                    baseline: campaign?.kpis ? { description: `Current ${campaign.name} baseline`, ...campaign.kpis } : null,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setShowNew(false);
                await loadLoops();
                const { rows } = await (await fetch(`${API_URL}/experiment-loops/${data.id}`, { credentials: 'include' })).json();
                // Load newly created loop
                const freshRes = await fetch(`${API_URL}/experiment-loops/${data.id}`, { credentials: 'include' });
                if (freshRes.ok) setSelectedLoop(await freshRes.json());
            }
        } catch { /* ignore */ }
        setLoading(false);
    }

    async function handleRunCycle() {
        if (!selectedLoop || runningCycle) return;
        setRunningCycle(true);
        try {
            await fetch(`${API_URL}/experiment-loops/${selectedLoop.id}/run-cycle`, {
                method: 'POST', credentials: 'include',
            });
            await loadLoops();
            await loadCycles(selectedLoop.id);
        } catch { /* ignore */ }
        setRunningCycle(false);
    }

    async function handlePause() {
        if (!selectedLoop) return;
        await fetch(`${API_URL}/experiment-loops/${selectedLoop.id}/pause`, { method: 'POST', credentials: 'include' });
        await loadLoops();
    }

    async function handleResume() {
        if (!selectedLoop) return;
        await fetch(`${API_URL}/experiment-loops/${selectedLoop.id}/resume`, { method: 'POST', credentials: 'include' });
        await loadLoops();
    }

    async function handleDelete(id) {
        await fetch(`${API_URL}/experiment-loops/${id}`, { method: 'DELETE', credentials: 'include' });
        if (selectedLoop?.id === id) { setSelectedLoop(null); setCycles([]); }
        await loadLoops();
    }

    // Chart data from cycles
    const chartData = cycles.map(c => ({
        cycle: c.cycle_number,
        baseline: c.baseline_metrics?.[selectedLoop?.metric_target] || 0,
        challenger: c.challenger_metrics?.[selectedLoop?.metric_target] || 0,
        winner: c.winner,
    }));

    const metricLabel = (m) => t(`autoExperiment.${m}`) || m;
    const typeLabel = (tp) => t(`autoExperiment.${tp}`) || tp;

    return (
        <div className={`ae-dashboard ${!selectedLoop ? 'ae-no-selection' : ''}`} style={{ minHeight: 400 }}>
            {/* Left panel: loop list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {t('autoExperiment.tabExperiments')}
                    </span>
                    <button className="kb-action-btn" onClick={() => setShowNew(!showNew)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                        <Plus size={14} /> {t('autoExperiment.newLoop')}
                    </button>
                </div>

                {/* Create form */}
                {showNew && (
                    <div className="card" style={{ padding: 16 }}>
                        <div className="ae-create-form">
                            <div className="ae-form-row">
                                <label className="email-gen-label">{t('autoExperiment.selectCampaign')}</label>
                                <select
                                    value={formCampaign}
                                    onChange={e => setFormCampaign(e.target.value)}
                                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                                >
                                    <option value="">--</option>
                                    {CAMPAIGNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="ae-form-row">
                                <label className="email-gen-label">{t('autoExperiment.metricTarget')}</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {METRICS.map(m => (
                                        <button key={m} className={`email-gen-chip ${formMetric === m ? 'active' : ''}`}
                                            onClick={() => setFormMetric(m)}>{metricLabel(m)}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="ae-form-row">
                                <label className="email-gen-label">{t('autoExperiment.experimentType')}</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {EXPERIMENT_TYPES.map(tp => (
                                        <button key={tp} className={`email-gen-chip ${formType === tp ? 'active' : ''}`}
                                            onClick={() => setFormType(tp)}>{typeLabel(tp)}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="ae-form-row">
                                    <label className="email-gen-label">{t('autoExperiment.maxCycles')}</label>
                                    <input type="number" min={1} max={100} value={formMaxCycles}
                                        onChange={e => setFormMaxCycles(parseInt(e.target.value) || 20)}
                                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '0.82rem', width: '100%' }}
                                    />
                                </div>
                                <div className="ae-form-row">
                                    <label className="email-gen-label">{t('autoExperiment.cycleInterval')}</label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {INTERVALS.map(iv => (
                                            <button key={iv} className={`email-gen-chip ${formInterval === iv ? 'active' : ''}`}
                                                onClick={() => setFormInterval(iv)}>{iv}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button className="kb-action-btn" onClick={handleCreate} disabled={!formCampaign || loading}
                                style={{ width: '100%', justifyContent: 'center' }}>
                                {loading ? <Loader size={14} className="spin" /> : <Play size={14} />}
                                {t('autoExperiment.startLoop')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Loop list */}
                {loops.length === 0 && !showNew && (
                    <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {t('autoExperiment.noLoops')}
                    </div>
                )}

                {loops.map(loop => (
                    <div key={loop.id}
                        className={`ae-loop-card ${selectedLoop?.id === loop.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLoop(loop)}
                    >
                        <div className="ae-loop-header">
                            <span className="ae-loop-name">{loop.name}</span>
                            <span className={`kb-status-badge ${loop.status === 'running' ? 'indexed' : loop.status === 'completed' ? 'indexed' : loop.status === 'failed' ? 'error' : 'pending'}`}>
                                {loop.status}
                            </span>
                        </div>
                        <div style={{ margin: '8px 0' }}>
                            <div style={{ height: 4, borderRadius: 2, background: 'var(--border-light)' }}>
                                <div style={{
                                    height: '100%', borderRadius: 2,
                                    background: loop.status === 'completed' ? 'var(--accent-green)' : 'var(--primary)',
                                    width: `${Math.round((loop.cycle_count / loop.max_cycles) * 100)}%`,
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                        </div>
                        <div className="ae-loop-meta">
                            <span>{loop.cycle_count}/{loop.max_cycles} {t('autoExperiment.cycles')}</span>
                            <span>·</span>
                            <span>{metricLabel(loop.metric_target)}</span>
                            {loop.total_improvement_pct > 0 && (
                                <>
                                    <span>·</span>
                                    <span className="ae-loop-improvement">+{parseFloat(loop.total_improvement_pct).toFixed(1)}%</span>
                                </>
                            )}
                            <button className="kb-icon-btn" onClick={e => { e.stopPropagation(); handleDelete(loop.id); }}
                                style={{ marginLeft: 'auto' }} title="Delete">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Right panel: detail */}
            {selectedLoop && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Header */}
                    <div className="ae-detail-header">
                        <div>
                            <div className="ae-detail-title">{selectedLoop.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {metricLabel(selectedLoop.metric_target)} · {typeLabel(selectedLoop.experiment_type)} · {selectedLoop.cycle_interval}
                            </div>
                        </div>
                        <div className="ae-detail-actions">
                            <button className="kb-action-btn" onClick={handleRunCycle} disabled={runningCycle}
                                style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                {runningCycle ? <Loader size={13} className="spin" /> : <Zap size={13} />}
                                {t('autoExperiment.runCycle')}
                            </button>
                            {selectedLoop.status === 'running' ? (
                                <button className="kb-icon-btn" onClick={handlePause} title={t('autoExperiment.pause')}>
                                    <Pause size={14} />
                                </button>
                            ) : selectedLoop.status === 'paused' || selectedLoop.status === 'idle' ? (
                                <button className="kb-icon-btn" onClick={handleResume} title={t('autoExperiment.resume')}>
                                    <Play size={14} />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {selectedLoop.cycle_count}/{selectedLoop.max_cycles}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('autoExperiment.cycles')}</div>
                        </div>
                        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: parseFloat(selectedLoop.total_improvement_pct) > 0 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                                {parseFloat(selectedLoop.total_improvement_pct) > 0 ? '+' : ''}{parseFloat(selectedLoop.total_improvement_pct).toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('autoExperiment.totalImprovement')}</div>
                        </div>
                        <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                            <span className={`kb-status-badge ${selectedLoop.status === 'running' ? 'indexed' : selectedLoop.status === 'completed' ? 'indexed' : selectedLoop.status === 'failed' ? 'error' : 'pending'}`}>
                                {selectedLoop.status}
                            </span>
                        </div>
                    </div>

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                {metricLabel(selectedLoop.metric_target)} {t('autoExperiment.improvement')}
                            </h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={chartData}>
                                    <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: '0.8rem' }}
                                        labelStyle={{ color: 'var(--text-muted)' }}
                                        formatter={(value) => `${parseFloat(value).toFixed(1)}%`}
                                    />
                                    <Line type="monotone" dataKey="baseline" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={t('autoExperiment.baseline')} />
                                    <Line type="monotone" dataKey="challenger" stroke="var(--accent-green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-green)' }} name={t('autoExperiment.challenger')} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Cycle Timeline */}
                    <div>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                            {t('autoExperiment.cycleHistory')}
                        </h3>
                        <div className="ae-cycle-timeline">
                            {cycles.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                    {t('autoExperiment.noKnowledge')}
                                </div>
                            )}
                            {[...cycles].reverse().map(c => (
                                <div key={c.id} className="ae-cycle-card">
                                    <div className="ae-cycle-top">
                                        <span className="ae-cycle-number">Cycle {c.cycle_number}</span>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {c.improvement_pct != null && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: c.improvement_pct > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                                    {c.improvement_pct > 0 ? '+' : ''}{parseFloat(c.improvement_pct).toFixed(1)}%
                                                </span>
                                            )}
                                            {c.winner && (
                                                <span className={c.winner === 'challenger' ? 'ae-winner-challenger' : 'ae-winner-baseline'}>
                                                    {c.winner === 'challenger' ? t('autoExperiment.challenger') : t('autoExperiment.baseline')}
                                                </span>
                                            )}
                                            {c.status === 'generating' && <Loader size={12} className="spin" />}
                                        </div>
                                    </div>
                                    {c.hypothesis && (
                                        <div className="ae-cycle-hypothesis">{c.hypothesis}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Knowledge Panel */}
                    {selectedLoop.knowledge_md && (
                        <div>
                            <button
                                onClick={() => setShowKnowledge(!showKnowledge)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}
                            >
                                <BookOpen size={14} />
                                {t('autoExperiment.accumulatedKnowledge')}
                                {showKnowledge ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {showKnowledge && (
                                <div className="ae-knowledge-panel">
                                    <div className="research-report-md"
                                        dangerouslySetInnerHTML={{ __html: simpleMarkdown(selectedLoop.knowledge_md) }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
