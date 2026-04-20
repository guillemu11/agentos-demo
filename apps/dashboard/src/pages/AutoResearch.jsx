import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
    Search,
    Plus,
    Loader,
    Globe,
    Database,
    Zap,
    Trash2,
    Microscope,
    FileText,
    Link2,
    Activity,
    Sparkles,
} from 'lucide-react';
import AutoResearchPresentation from '../components/AutoResearchPresentation.jsx';
import AutoExperimentDashboard from '../components/AutoExperimentDashboard.jsx';
import ResearchLabTab from '../components/ResearchLabTab.jsx';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import FormField from '../components/ui/FormField.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import TabStrip from '../components/ui/TabStrip.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Preset seeds referenced by i18n key so both ES + EN versions stay in sync.
const PRESETS = [
    { id: 'competitorScan', depth: 'deep', sources: 'both' },
    { id: 'audienceDeepDive', depth: 'standard', sources: 'both' },
    { id: 'trendReport', depth: 'standard', sources: 'web' },
];

export default function AutoResearch() {
    const { sessionId: urlSessionId } = useParams();
    const { t } = useLanguage();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState(urlSessionId ? 'research' : 'concept');

    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const [filter, setFilter] = useState('');

    // New research form
    const [topic, setTopic] = useState('');
    const [depth, setDepth] = useState('standard');
    const [sourcesMode, setSourcesMode] = useState('both');
    const [launching, setLaunching] = useState(false);

    // Stream state
    const [streamEvents, setStreamEvents] = useState([]);
    const [streamActive, setStreamActive] = useState(false);
    const eventSourceRef = useRef(null);

    useEffect(() => { if (activeTab === 'research') loadSessions(); }, [activeTab]);
    useEffect(() => {
        if (urlSessionId) { setActiveTab('research'); loadSession(parseInt(urlSessionId)); }
    }, [urlSessionId]);

    async function loadSessions() {
        try {
            const res = await fetch(`${API_URL}/research/sessions?limit=30`, { credentials: 'include' });
            if (res.ok) setSessions((await res.json()).sessions);
        } catch { /* ignore */ }
    }

    async function loadSession(id) {
        try {
            const res = await fetch(`${API_URL}/research/sessions/${id}`, { credentials: 'include' });
            if (res.ok) setSelectedSession(await res.json());
        } catch { /* ignore */ }
    }

    function applyPreset(preset) {
        const seed = t(`research.modal.presets.${preset.id}.topicSeed`);
        setTopic(seed);
        setDepth(preset.depth);
        setSourcesMode(preset.sources);
    }

    function openNewResearch() {
        setShowNew(true);
    }

    function closeNewResearch() {
        setShowNew(false);
    }

    async function handleCreate() {
        if (!topic.trim()) return;
        setLaunching(true);
        try {
            const res = await fetch(`${API_URL}/research/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ topic, depth, sourcesMode }),
            });
            if (res.ok) {
                const data = await res.json();
                setShowNew(false);
                setTopic('');
                loadSessions();
                loadSession(data.sessionId);
                startStream(data.sessionId);
                toast.success(t('research.inProgress'));
            } else {
                toast.error(t('research.failed'));
            }
        } catch {
            toast.error(t('research.failed'));
        }
        finally { setLaunching(false); }
    }

    function startStream(sessionId) {
        if (eventSourceRef.current) eventSourceRef.current.close();
        setStreamEvents([]);
        setStreamActive(true);

        const es = new EventSource(`${API_URL}/research/sessions/${sessionId}/stream`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            if (event.data === '[DONE]') {
                es.close();
                setStreamActive(false);
                loadSession(sessionId);
                loadSessions();
                return;
            }
            try {
                const data = JSON.parse(event.data);
                setStreamEvents(prev => [...prev, data]);
                if (data.type === 'progress') {
                    setSelectedSession(prev => prev ? { ...prev, progress: data.value } : prev);
                }
            } catch { /* ignore */ }
        };

        es.onerror = () => { es.close(); setStreamActive(false); };
    }

    async function handleCancel(id) {
        await fetch(`${API_URL}/research/sessions/${id}/cancel`, { method: 'POST', credentials: 'include' });
        if (eventSourceRef.current) eventSourceRef.current.close();
        setStreamActive(false);
        loadSession(id);
        loadSessions();
    }

    async function handleDelete(id) {
        await fetch(`${API_URL}/research/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
        if (selectedSession?.id === id) setSelectedSession(null);
        loadSessions();
    }

    const filteredSessions = filter
        ? sessions.filter(s => s.status === filter)
        : sessions;

    // ── Stats ─────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = sessions.length;
        const runningNow = sessions.filter(s =>
            s.status === 'running' || s.status === 'researching'
        ).length;
        const sourcesAnalyzed = sessions.reduce(
            (acc, s) => acc + (s.sources_found || 0),
            0,
        );
        return { total, runningNow, sourcesAnalyzed };
    }, [sessions]);

    const TABS = [
        { id: 'concept', label: t('autoExperiment.tabConcept') },
        { id: 'research', label: t('autoExperiment.tabResearch') },
        { id: 'experiments', label: t('autoExperiment.tabExperiments') },
        { id: 'lab', label: t('researchLab.tabLabel') },
    ];

    const isStreamingHero = selectedSession && (streamActive || selectedSession.status === 'researching');
    const layoutClass = !selectedSession
        ? 'research-hub-layout research-hub-layout--solo'
        : isStreamingHero
            ? 'research-hub-layout research-hub-layout--hero-stream'
            : 'research-hub-layout';

    return (
        <div className="dashboard-container animate-fade-in">
            <HubHero
                eyebrow={<>
                    <Microscope size={14} strokeWidth={2.5} />
                    <span>{t('research.hero.eyebrow')}</span>
                </>}
                title={t('research.hero.title')}
                subtitle={t('research.hero.subtitle')}
                actions={activeTab === 'research' && (
                    <Button variant="primary" onClick={openNewResearch}>
                        <Plus size={14} strokeWidth={2.5} />
                        {t('research.newResearch')}
                    </Button>
                )}
            />

            {activeTab === 'research' && (
                <HubStats>
                    <HubStatCard
                        icon={<FileText size={16} strokeWidth={2} />}
                        label={t('research.stats.totalReports')}
                        value={stats.total}
                        tone="neutral"
                    />
                    <HubStatCard
                        icon={<Link2 size={16} strokeWidth={2} />}
                        label={t('research.stats.sourcesAnalyzed')}
                        value={stats.sourcesAnalyzed}
                        tone="emerald"
                    />
                    <HubStatCard
                        icon={<Activity size={16} strokeWidth={2} />}
                        label={t('research.stats.runningNow')}
                        value={stats.runningNow}
                        tone="amber"
                    />
                </HubStats>
            )}

            {/* Tabs */}
            <div style={{ margin: 'var(--space-5) 0' }}>
                <TabStrip
                    tabs={TABS}
                    active={activeTab}
                    onChange={setActiveTab}
                    ariaLabel={t('research.title')}
                />
            </div>

            {/* Tab: Concept */}
            {activeTab === 'concept' && <AutoResearchPresentation />}

            {/* Tab: Research */}
            {activeTab === 'research' && (
                <>
                    {/* New Research Modal */}
                    <Modal
                        open={showNew}
                        onClose={closeNewResearch}
                        title={t('research.modal.title')}
                        size="md"
                    >
                        <div className="research-modal-form">
                            {/* Presets */}
                            <div className="research-preset-row">
                                <span className="research-preset-row__label">
                                    <Sparkles size={12} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                                    {t('research.modal.presetsLabel')}
                                </span>
                                {PRESETS.map(preset => (
                                    <Button
                                        key={preset.id}
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => applyPreset(preset)}
                                    >
                                        {t(`research.modal.presets.${preset.id}.label`)}
                                    </Button>
                                ))}
                            </div>

                            {/* Topic */}
                            <FormField label={t('research.modal.topicLabel')} required>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder={t('research.topicPlaceholder')}
                                    rows={4}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </FormField>

                            {/* Depth */}
                            <div>
                                <div className="research-modal-chip-label">{t('research.depth')}</div>
                                <div className="research-modal-chip-group">
                                    {['quick', 'standard', 'deep'].map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            className={`research-depth-chip ${depth === d ? 'is-active' : ''}`}
                                            onClick={() => setDepth(d)}
                                        >
                                            {t(`research.depth_${d}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sources */}
                            <div>
                                <div className="research-modal-chip-label">{t('research.sources')}</div>
                                <div className="research-modal-chip-group">
                                    {['both', 'web', 'internal'].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            className={`research-depth-chip ${sourcesMode === s ? 'is-active' : ''}`}
                                            onClick={() => setSourcesMode(s)}
                                        >
                                            {s === 'both' && <><Globe size={12} /><Database size={12} /></>}
                                            {s === 'web' && <Globe size={12} />}
                                            {s === 'internal' && <Database size={12} />}
                                            {t(`research.source_${s}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="research-modal-actions">
                                <Button variant="ghost" onClick={closeNewResearch}>
                                    {t('research.modal.cancelBtn')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleCreate}
                                    disabled={launching || !topic.trim()}
                                >
                                    {launching ? <Loader size={14} className="spin" /> : <Zap size={14} />}
                                    {t('research.modal.submit')}
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* Empty state (no sessions yet) */}
                    {sessions.length === 0 && !selectedSession ? (
                        <EmptyState
                            icon={<Microscope size={28} />}
                            title={t('research.empty.title')}
                            description={t('research.empty.description')}
                            action={
                                <Button variant="primary" onClick={openNewResearch}>
                                    <Plus size={14} strokeWidth={2.5} />
                                    {t('research.empty.cta')}
                                </Button>
                            }
                        />
                    ) : (
                        <div className={layoutClass}>
                            {/* Sessions list */}
                            <div>
                                <div className="research-filter-strip">
                                    {['', 'researching', 'completed', 'failed'].map(f => (
                                        <button
                                            key={f}
                                            className={`research-depth-chip ${filter === f ? 'is-active' : ''}`}
                                            onClick={() => setFilter(f)}
                                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                        >
                                            {f || t('research.all')}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {filteredSessions.map(s => (
                                        <div
                                            key={s.id}
                                            className={`card research-session-card ${selectedSession?.id === s.id ? 'selected' : ''}`}
                                            onClick={() => { loadSession(s.id); if (s.status === 'researching') startStream(s.id); }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>{s.title}</span>
                                                <span className={`kb-status-badge ${s.status === 'completed' ? 'indexed' : s.status === 'researching' ? 'processing' : s.status === 'failed' ? 'error' : 'pending'}`}>
                                                    {s.status}
                                                </span>
                                            </div>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                                {s.topic?.slice(0, 100)}{s.topic?.length > 100 ? '...' : ''}
                                            </p>
                                            {s.progress > 0 && s.progress < 100 && (
                                                <div className="email-gen-progress" style={{ height: 4, marginTop: 6 }}>
                                                    <div className="email-gen-progress-bar" style={{ width: `${s.progress}%` }} />
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                <span>{s.sources_found || 0} sources</span>
                                                <span>{s.iterations || 0} iterations</span>
                                                <button className="kb-icon-btn" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} style={{ marginLeft: 'auto', padding: 2 }}>
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredSessions.length === 0 && (
                                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: '0.85rem' }}>
                                            {t('research.noSessions')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Session detail */}
                            {selectedSession && (
                                <div>
                                    {/* Stream / Progress — heroic when active */}
                                    {isStreamingHero && (
                                        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center' }}>
                                                    <span className="research-pulse-dot" aria-hidden="true" />
                                                    {t('research.inProgress')}
                                                </span>
                                                <Button variant="ghost" size="sm" onClick={() => handleCancel(selectedSession.id)}>
                                                    {t('research.cancel')}
                                                </Button>
                                            </div>
                                            <div className="email-gen-progress" style={{ marginBottom: 'var(--space-3)' }}>
                                                <div className="email-gen-progress-bar" style={{ width: `${selectedSession.progress || 0}%` }} />
                                                <span className="email-gen-progress-label">{selectedSession.progress || 0}%</span>
                                            </div>
                                            {(() => {
                                                const sources = streamEvents
                                                    .filter(ev => ev.type === 'source' && ev.value)
                                                    .map(ev => ev.value);
                                                const nonSources = streamEvents.filter(ev => ev.type !== 'source');
                                                return (
                                                    <>
                                                        <div className="research-stream-log research-stream-log--hero">
                                                            {nonSources.map((ev, i) => (
                                                                <div key={i} className="research-stream-event">
                                                                    {ev.type === 'query' && <span><Search size={12} /> {t('research.searching')}: {ev.value}</span>}
                                                                    {ev.type === 'phase' && <span><Zap size={12} /> {ev.value}</span>}
                                                                </div>
                                                            ))}
                                                            {nonSources.length === 0 && sources.length > 0 && (
                                                                <span className="research-stream-event research-stream-event--muted">
                                                                    <Zap size={12} /> {t('research.gatheringSources')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {sources.length > 0 && (
                                                            <div className="research-sources-section">
                                                                <div className="research-sources-head">
                                                                    <span className="research-sources-label">{t('research.sourcesFoundLabel')}</span>
                                                                    <span className="research-sources-count">{sources.length}</span>
                                                                </div>
                                                                <div className="research-sources-grid">
                                                                    {sources.map((src, i) => {
                                                                        const isWeb = src.type === 'web';
                                                                        let host = '';
                                                                        try { host = src.url ? new URL(src.url).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
                                                                        return (
                                                                            <a
                                                                                key={i}
                                                                                href={src.url || '#'}
                                                                                target={src.url ? '_blank' : undefined}
                                                                                rel="noopener noreferrer"
                                                                                className={`research-source-card research-source-card--${isWeb ? 'web' : 'kb'}`}
                                                                                title={src.title || src.query || host}
                                                                            >
                                                                                <span className="research-source-icon">
                                                                                    {isWeb ? <Globe size={14} /> : <Database size={14} />}
                                                                                </span>
                                                                                <span className="research-source-body">
                                                                                    <span className="research-source-title">{src.title || src.query || t('research.untitledSource')}</span>
                                                                                    {host && <span className="research-source-host">{host}</span>}
                                                                                </span>
                                                                            </a>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Report */}
                                    {selectedSession.report_md && (
                                        <div className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                                            <h3 className="kb-section-title">{t('research.report')}</h3>
                                            <div className="research-report-md" dangerouslySetInnerHTML={{ __html: simpleMarkdown(selectedSession.report_md) }} />
                                        </div>
                                    )}

                                    {/* Experiments */}
                                    {selectedSession.experiments && selectedSession.experiments.length > 0 && (
                                        <div className="card" style={{ padding: 'var(--space-5)' }}>
                                            <h3 className="kb-section-title">{t('research.experiments')} ({selectedSession.experiments.length})</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {selectedSession.experiments.map((exp, i) => (
                                                    <div key={i} className="research-experiment-card">
                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                                            <span className="kb-namespace-tag">{exp.type}</span>
                                                            {exp.expected_improvement && <span className="kb-score-badge">+{exp.expected_improvement}%</span>}
                                                        </div>
                                                        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 600 }}>{exp.hypothesis}</p>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                                                            <div className="email-diff-a" style={{ borderRadius: 6, padding: 8 }}>
                                                                <strong>A:</strong> {exp.variant_a}
                                                            </div>
                                                            <div className="email-diff-b" style={{ borderRadius: 6, padding: 8 }}>
                                                                <strong>B:</strong> {exp.variant_b}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Idle state */}
                                    {!selectedSession.report_md && selectedSession.status !== 'researching' && !isStreamingHero && (
                                        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                            {selectedSession.status === 'failed'
                                                ? `${t('research.failed')}: ${selectedSession.error || 'Unknown error'}`
                                                : t('research.waiting')
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Tab: Experiments */}
            {activeTab === 'experiments' && <AutoExperimentDashboard />}

            {/* Tab: Lab */}
            {activeTab === 'lab' && <ResearchLabTab />}
        </div>
    );
}

/** Minimal markdown to HTML (headers, bold, lists, line breaks, citations). */
function simpleMarkdown(md) {
    return md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        // Style inline citation markers like [1], [2]
        .replace(/\[(\d+)\]/g, '<span class="research-citation">[$1]</span>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/```experiments[\s\S]*?```/g, ''); // Remove experiments JSON block
}
