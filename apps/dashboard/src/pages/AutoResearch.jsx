import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Search, Plus, Loader, X, Globe, Database, Zap, Trash2 } from 'lucide-react';
import AutoResearchPresentation from '../components/AutoResearchPresentation.jsx';
import AutoExperimentDashboard from '../components/AutoExperimentDashboard.jsx';
import ResearchLabTab from '../components/ResearchLabTab.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function AutoResearch() {
    const { sessionId: urlSessionId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

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
            }
        } catch { /* ignore */ }
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

    const TABS = [
        { id: 'concept', label: t('autoExperiment.tabConcept') },
        { id: 'research', label: t('autoExperiment.tabResearch') },
        { id: 'experiments', label: t('autoExperiment.tabExperiments') },
        { id: 'lab', label: t('researchLab.tabLabel') },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>{t('research.title')}</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>{t('research.subtitle')}</p>
                </div>
                {activeTab === 'research' && (
                    <button className="kb-action-btn" onClick={() => setShowNew(true)}>
                        <Plus size={14} /> {t('research.newResearch')}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="kb-tabs" style={{ marginBottom: 20 }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`kb-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Concept */}
            {activeTab === 'concept' && <AutoResearchPresentation />}

            {/* Tab: Research */}
            {activeTab === 'research' && (
                <>
                    {/* New Research Modal */}
                    {showNew && (
                        <div className="card" style={{ padding: 20, marginBottom: 20, border: '2px solid var(--primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontWeight: 700 }}>{t('research.newResearch')}</h3>
                                <button className="kb-icon-btn" onClick={() => setShowNew(false)}><X size={16} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder={t('research.topicPlaceholder')}
                                    rows={3}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />

                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    <div>
                                        <label className="email-gen-label">{t('research.depth')}</label>
                                        <div className="email-gen-chips" style={{ marginTop: 4 }}>
                                            {['quick', 'standard', 'deep'].map(d => (
                                                <button key={d} className={`email-gen-chip ${depth === d ? 'active' : ''}`} onClick={() => setDepth(d)}>
                                                    {t(`research.depth_${d}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="email-gen-label">{t('research.sources')}</label>
                                        <div className="email-gen-chips" style={{ marginTop: 4 }}>
                                            {['both', 'web', 'internal'].map(s => (
                                                <button key={s} className={`email-gen-chip ${sourcesMode === s ? 'active' : ''}`} onClick={() => setSourcesMode(s)}>
                                                    {s === 'both' && <><Globe size={12} /> + <Database size={12} /></>}
                                                    {s === 'web' && <Globe size={12} />}
                                                    {s === 'internal' && <Database size={12} />}
                                                    {' '}{t(`research.source_${s}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button className="kb-action-btn" onClick={handleCreate} disabled={launching || !topic.trim()} style={{ alignSelf: 'flex-start' }}>
                                    {launching ? <Loader size={14} className="spin" /> : <Zap size={14} />}
                                    {t('research.startResearch')}
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: selectedSession ? '350px 1fr' : '1fr', gap: 20 }}>
                        {/* Sessions list */}
                        <div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                                {['', 'researching', 'completed', 'failed'].map(f => (
                                    <button key={f} className={`email-gen-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                                        {f || t('research.all')}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                {/* Stream / Progress */}
                                {(streamActive || selectedSession.status === 'researching') && (
                                    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                <Loader size={14} className="spin" style={{ marginRight: 6 }} />
                                                {t('research.inProgress')}
                                            </span>
                                            <button className="kb-action-btn secondary" style={{ fontSize: '0.7rem', padding: '4px 12px' }} onClick={() => handleCancel(selectedSession.id)}>
                                                {t('research.cancel')}
                                            </button>
                                        </div>
                                        <div className="email-gen-progress" style={{ marginBottom: 8 }}>
                                            <div className="email-gen-progress-bar" style={{ width: `${selectedSession.progress || 0}%` }} />
                                            <span className="email-gen-progress-label">{selectedSession.progress || 0}%</span>
                                        </div>
                                        <div className="research-stream-log">
                                            {streamEvents.map((ev, i) => (
                                                <div key={i} className="research-stream-event">
                                                    {ev.type === 'query' && <span><Search size={10} /> {t('research.searching')}: {ev.value}</span>}
                                                    {ev.type === 'source' && <span>{ev.value?.type === 'web' ? <Globe size={10} /> : <Database size={10} />} {t('research.found')}: {ev.value?.title || ev.value?.query}</span>}
                                                    {ev.type === 'phase' && <span><Zap size={10} /> {ev.value}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Report */}
                                {selectedSession.report_md && (
                                    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                                        <h3 className="kb-section-title">{t('research.report')}</h3>
                                        <div className="research-report-md" dangerouslySetInnerHTML={{ __html: simpleMarkdown(selectedSession.report_md) }} />
                                    </div>
                                )}

                                {/* Experiments */}
                                {selectedSession.experiments && selectedSession.experiments.length > 0 && (
                                    <div className="card" style={{ padding: 20 }}>
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

                                {/* Stats sidebar */}
                                {!selectedSession.report_md && selectedSession.status !== 'researching' && (
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
                </>
            )}

            {/* Tab: Experiments */}
            {activeTab === 'experiments' && <AutoExperimentDashboard />}

            {/* Tab: Lab */}
            {activeTab === 'lab' && <ResearchLabTab />}
        </div>
    );
}

/** Minimal markdown to HTML (headers, bold, lists, line breaks) */
function simpleMarkdown(md) {
    return md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/```experiments[\s\S]*?```/g, ''); // Remove experiments JSON block
}
