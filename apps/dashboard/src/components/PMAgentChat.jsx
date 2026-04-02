import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useGeminiLive } from '../hooks/useGeminiLive.js';
import renderMarkdown from '../utils/renderMarkdown.js';
import { InboxIcons } from './icons.jsx';
import { FileEdit, Rocket, MessageSquare, Mic, MicOff, PhoneOff, Loader, Send, ChevronUp, ChevronDown, Trash2, ShieldCheck, ShieldOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function PMAgentChat({ inboxItemId, onItemCreated, onStatusChange, onClose }) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [itemId, setItemId] = useState(inboxItemId);
    const [itemStatus, setItemStatus] = useState('chat');
    const [summary, setSummary] = useState('');
    const [advancing, setAdvancing] = useState(false);
    const [ragSources, setRagSources] = useState([]);
    const [draftData, setDraftData] = useState(null);
    const [editedDraft, setEditedDraft] = useState(null);
    const [agents, setAgents] = useState([]);
    const [editingDesc, setEditingDesc] = useState(null);
    const messagesEndRef = useRef(null);
    const justCreatedRef = useRef(false);

    // ─── Load agents for draft editing ───────────────────────────────────
    useEffect(() => {
        fetch(`${API_URL}/agents`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setAgents(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    // ─── Voice (Gemini Live) ──────────────────────────────────────────────

    const handleVoiceTurnComplete = useCallback((userText, assistantText) => {
        if (!userText && !assistantText) return;
        const newMessages = [];
        if (userText) newMessages.push({ role: 'user', content: userText });
        if (assistantText) newMessages.push({ role: 'assistant', content: assistantText });
        if (newMessages.length > 0) {
            setMessages(prev => [...prev, ...newMessages]);
        }
    }, []);

    const {
        status: voiceStatus,
        inputTranscript,
        outputTranscript,
        error: voiceError,
        isMuted,
        connect: connectVoice,
        disconnect: disconnectVoice,
        toggleMute,
    } = useGeminiLive({
        wsPath: '/ws/voice-agent',
        wsParams: { agentId: 'raul' },
        lang,
        onTurnComplete: handleVoiceTurnComplete,
        onSources: (newSources) => { if (newSources.length > 0) setRagSources(newSources); },
    });

    const isVoiceConnected = voiceStatus !== 'idle' && voiceStatus !== 'error';

    function toggleVoiceSession() {
        if (isVoiceConnected) {
            disconnectVoice();
        } else {
            connectVoice();
        }
    }

    // ─── Load & Scroll ────────────────────────────────────────────────────

    useEffect(() => {
        if (!inboxItemId) {
            setMessages([]);
            setItemId(null);
            setItemStatus('chat');
            setSummary('');
            setDraftData(null);
            setEditedDraft(null);
            justCreatedRef.current = false;
            return;
        }
        // Skip re-fetch if we just created this item in the current session
        if (justCreatedRef.current) {
            justCreatedRef.current = false;
            return;
        }
        setItemId(inboxItemId);
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/inbox/${inboxItemId}`);
                if (!res.ok) return;
                const item = await res.json();
                if (cancelled) return;
                setItemStatus(item.status);
                setSummary(item.summary || '');
                setDraftData(item.structured_data || null);
                setEditedDraft(item.structured_data || null);
                const conv = Array.isArray(item.conversation) ? item.conversation : [];
                setMessages(conv.map(m => ({ role: m.role, content: m.content })));
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [inboxItemId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming, inputTranscript, outputTranscript]);

    // ─── Text Chat ────────────────────────────────────────────────────────

    async function sendMessage() {
        const msg = input.trim();
        if (!msg) return;

        const userMsg = { role: 'user', content: msg };
        setInput('');
        setStreaming(true);
        // Batch: add user message + empty assistant placeholder together to avoid flash
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);

        try {
            const res = await fetch(`${API_URL}/chat/pm-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    inbox_item_id: itemId,
                    message: msg,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.error || res.statusText}` };
                    return updated;
                });
                return;
            }

            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch { /* ignore */ }
            }

            const newItemId = res.headers.get('X-Inbox-Item-Id');
            if (newItemId && !itemId) {
                justCreatedRef.current = true;
                setItemId(parseInt(newItemId));
                onItemCreated?.(parseInt(newItemId));
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            fullResponse = `Error: ${parsed.error}`;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
                                return updated;
                            });
                        } else if (parsed.text) {
                            fullResponse += parsed.text;
                            const captured = fullResponse;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: 'assistant', content: captured };
                                return updated;
                            });
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setStreaming(false);
        }
    }

    // ─── State Machine Actions ────────────────────────────────────────────

    async function handleToBorrador() {
        if (!itemId) return;
        setAdvancing(true);
        try {
            const res = await fetch(`${API_URL}/inbox/${itemId}/to-borrador`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error: ${err.error}`);
                return;
            }
            const data = await res.json();
            setItemStatus('borrador');
            setSummary(data.summary);
            setDraftData(data.structured_data || null);
            setEditedDraft(data.structured_data || null);
            onStatusChange?.();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setAdvancing(false);
        }
    }

    async function handleToProyecto() {
        if (!itemId) return;
        setAdvancing(true);
        try {
            const res = await fetch(`${API_URL}/inbox/${itemId}/to-proyecto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ structured_data: editedDraft }),
            });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error: ${err.error}`);
                return;
            }
            setItemStatus('proyecto');
            onStatusChange?.();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setAdvancing(false);
        }
    }

    async function handleReopen() {
        if (!itemId) return;
        setAdvancing(true);
        try {
            const res = await fetch(`${API_URL}/inbox/${itemId}/reopen`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error: ${err.error}`);
                return;
            }
            setItemStatus('chat');
            setSummary('');
            setDraftData(null);
            setEditedDraft(null);
            onStatusChange?.();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setAdvancing(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !streaming) {
            e.preventDefault();
            sendMessage();
        }
    }

    // ─── Draft Editing Handlers ──────────────────────────────────────────

    function updateStageAgent(stageIndex, newAgentId) {
        const agent = agents.find(a => a.id === newAgentId);
        setEditedDraft(prev => ({
            ...prev,
            stages: prev.stages.map((s, i) =>
                i === stageIndex
                    ? { ...s, agent_id: newAgentId, agent_name: agent?.name || newAgentId }
                    : s
            ),
        }));
    }

    function updateStageDescription(stageIndex, newDesc) {
        setEditedDraft(prev => ({
            ...prev,
            stages: prev.stages.map((s, i) =>
                i === stageIndex ? { ...s, description: newDesc } : s
            ),
        }));
    }

    function toggleGate(stageIndex) {
        setEditedDraft(prev => ({
            ...prev,
            stages: prev.stages.map((s, i) =>
                i === stageIndex
                    ? { ...s, gate_type: s.gate_type === 'human_approval' ? 'none' : 'human_approval' }
                    : s
            ),
        }));
    }

    function removeStage(stageIndex) {
        setEditedDraft(prev => ({
            ...prev,
            stages: prev.stages
                .filter((_, i) => i !== stageIndex)
                .map(s => ({
                    ...s,
                    depends_on: (s.depends_on || [])
                        .filter(d => d !== stageIndex)
                        .map(d => d > stageIndex ? d - 1 : d),
                })),
        }));
    }

    function moveStage(stageIndex, direction) {
        const targetIndex = stageIndex + direction;
        setEditedDraft(prev => {
            if (targetIndex < 0 || targetIndex >= prev.stages.length) return prev;
            const newStages = [...prev.stages];
            [newStages[stageIndex], newStages[targetIndex]] = [newStages[targetIndex], newStages[stageIndex]];
            // Recalculate depends_on references
            return {
                ...prev,
                stages: newStages.map(s => ({
                    ...s,
                    depends_on: (s.depends_on || []).map(d => {
                        if (d === stageIndex) return targetIndex;
                        if (d === targetIndex) return stageIndex;
                        return d;
                    }),
                })),
            };
        });
    }

    // ─── Borrador View (Rich Draft) ─────────────────────────────────────
    if (itemStatus === 'borrador') {
        const draft = editedDraft;

        // Fallback: old items without structured_data
        if (!draft || !draft.stages) {
            return (
                <div className="chat-container">
                    <div className="chat-header">
                        <span className="chat-header-title"><FileEdit size={16} /> {t('pmChat.draft')}</span>
                        {onClose && <button className="chat-header-close" onClick={onClose}>&times;</button>}
                    </div>
                    <div className="chat-messages" style={{ padding: 24 }}>
                        <div style={{
                            background: 'var(--bg-section, #F7F7F7)', borderRadius: 16,
                            padding: 24, whiteSpace: 'pre-wrap', lineHeight: 1.7,
                            color: 'var(--text-main)', fontSize: '0.95rem',
                        }}>
                            {summary || t('pmChat.noSummary')}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 12 }}>
                            {t('pmChat.noDraftData')}
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            <button className="proposal-approve-btn" onClick={handleToProyecto} disabled={advancing}
                                style={{ background: '#FF385C', color: '#fff', border: 'none', borderRadius: 9999, padding: '12px 24px', fontWeight: 600, fontSize: '0.9rem', cursor: advancing ? 'wait' : 'pointer', opacity: advancing ? 0.6 : 1 }}>
                                {advancing ? t('pmChat.generatingProject') : <><Rocket size={14} /> {t('pmChat.confirmCreateProject')}</>}
                            </button>
                            <button onClick={handleReopen} disabled={advancing}
                                style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default, #E5E7EB)', borderRadius: 9999, padding: '12px 24px', fontWeight: 500, fontSize: '0.9rem', cursor: advancing ? 'wait' : 'pointer' }}>
                                <MessageSquare size={14} /> {t('pmChat.keepRefining')}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="chat-container">
                <div className="chat-header">
                    <span className="chat-header-title"><FileEdit size={16} /> {t('pmChat.draftTitle')}</span>
                    {onClose && <button className="chat-header-close" onClick={onClose}>&times;</button>}
                </div>

                <div className="draft-container">
                    {/* Overview */}
                    <div className="draft-section">
                        <div className="draft-section-title">{t('pmChat.overview')}</div>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{draft.project_name}</h3>
                        <div className="draft-overview-grid">
                            {draft.objective && (
                                <div className="draft-overview-item">
                                    <span className="draft-overview-label">{t('pmChat.objective')}</span>
                                    <span className="draft-overview-value">{draft.objective}</span>
                                </div>
                            )}
                            {draft.target_audience && (
                                <div className="draft-overview-item">
                                    <span className="draft-overview-label">{t('pmChat.audience')}</span>
                                    <span className="draft-overview-value">{draft.target_audience}</span>
                                </div>
                            )}
                            {draft.bau_type && (
                                <div className="draft-overview-item">
                                    <span className="draft-overview-label">{t('pmChat.bauType')}</span>
                                    <span className="draft-overview-value">{draft.bau_type}</span>
                                </div>
                            )}
                            {draft.estimated_timeline && (
                                <div className="draft-overview-item">
                                    <span className="draft-overview-label">{t('pmChat.timeline')}</span>
                                    <span className="draft-overview-value">{draft.estimated_timeline}</span>
                                </div>
                            )}
                            {draft.markets?.length > 0 && (
                                <div className="draft-overview-item">
                                    <span className="draft-overview-label">{t('pmChat.markets')}</span>
                                    <span className="draft-overview-value">{draft.markets.join(', ')}</span>
                                </div>
                            )}
                        </div>
                        {draft.problem && (
                            <div style={{ marginTop: 12 }}>
                                <span className="draft-overview-label">{t('pmChat.problem')}</span>
                                <p className="draft-overview-value" style={{ margin: '4px 0 0' }}>{draft.problem}</p>
                            </div>
                        )}
                    </div>

                    {/* PM Notes */}
                    {draft.pm_notes && (
                        <div className="draft-section">
                            <div className="draft-section-title">{t('pmChat.pmNotes')}</div>
                            <div className="draft-pm-notes">
                                <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.pm_notes) }} />
                            </div>
                        </div>
                    )}

                    {/* Pipeline Stages */}
                    <div className="draft-section">
                        <div className="draft-section-title">
                            {t('pmChat.pipelineProposal')} ({draft.stages.length} {t('pmChat.stages')})
                        </div>
                        <div className="draft-stages">
                            {draft.stages.map((stage, idx) => (
                                <div key={idx} className="draft-stage-row">
                                    <div className="draft-stage-order">{idx}</div>
                                    <div className="draft-stage-body">
                                        <div className="draft-stage-header">
                                            <span className="draft-stage-name">{stage.name}</span>
                                            <select
                                                className="draft-stage-agent-select"
                                                value={stage.agent_id}
                                                onChange={(e) => updateStageAgent(idx, e.target.value)}
                                            >
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                                                ))}
                                            </select>
                                            <span className="draft-stage-dept">{stage.department}</span>
                                            {stage.gate_type === 'human_approval' && (
                                                <span className="draft-gate-tag" onClick={() => toggleGate(idx)} title={stage.gate_reason || t('pmChat.removeGate')}>
                                                    🔒 {t('pmChat.gate')}
                                                </span>
                                            )}
                                        </div>

                                        {editingDesc === idx ? (
                                            <div className="draft-stage-description">
                                                <textarea
                                                    value={stage.description}
                                                    onChange={(e) => updateStageDescription(idx, e.target.value)}
                                                    onBlur={() => setEditingDesc(null)}
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div className="draft-stage-description" onClick={() => setEditingDesc(idx)} style={{ cursor: 'pointer' }}>
                                                {stage.description}
                                            </div>
                                        )}

                                        {stage.reasoning && (
                                            <div className="draft-stage-reasoning">
                                                {t('pmChat.reasoning')}: {stage.reasoning}
                                            </div>
                                        )}

                                        <div className="draft-stage-meta">
                                            {stage.depends_on?.length > 0 && stage.depends_on.map(dep => (
                                                <span key={dep} className="draft-dep-tag">
                                                    {t('pmChat.dependsOn')}: {draft.stages[dep]?.name || dep}
                                                </span>
                                            ))}
                                            {stage.namespaces?.map(ns => (
                                                <span key={ns} className="draft-namespace-tag">{ns}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="draft-stage-actions">
                                        <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} title={lang === 'es' ? 'Subir' : 'Move up'}>
                                            <ChevronUp size={14} />
                                        </button>
                                        <button onClick={() => moveStage(idx, 1)} disabled={idx === draft.stages.length - 1} title={lang === 'es' ? 'Bajar' : 'Move down'}>
                                            <ChevronDown size={14} />
                                        </button>
                                        {stage.gate_type !== 'human_approval' ? (
                                            <button onClick={() => toggleGate(idx)} title={t('pmChat.addGate')}>
                                                <ShieldCheck size={14} />
                                            </button>
                                        ) : (
                                            <button onClick={() => toggleGate(idx)} title={t('pmChat.removeGate')}>
                                                <ShieldOff size={14} />
                                            </button>
                                        )}
                                        <button className="danger" onClick={() => removeStage(idx)} title={t('pmChat.removeStage')}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risks */}
                    {draft.risks?.length > 0 && (
                        <div className="draft-section">
                            <div className="draft-section-title">{t('pmChat.risks')}</div>
                            <div className="draft-risks-list">
                                {draft.risks.map((r, i) => (
                                    <div key={i} className="draft-risk-item">
                                        <span className="draft-risk-label">{r.risk}</span>
                                        <span className="draft-risk-mitigation">{r.mitigation}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Key Metrics */}
                    {draft.key_metrics?.length > 0 && (
                        <div className="draft-section">
                            <div className="draft-section-title">{t('pmChat.metrics')}</div>
                            <div className="draft-metrics-list">
                                {draft.key_metrics.map((m, i) => (
                                    <span key={i} className="draft-metric-tag">{m}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Compliance */}
                    {draft.compliance_notes?.length > 0 && (
                        <div className="draft-section">
                            <div className="draft-section-title">{t('pmChat.compliance')}</div>
                            <div className="draft-risks-list">
                                {draft.compliance_notes.map((c, i) => (
                                    <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-main)', borderRadius: 8 }}>
                                        {c}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversation History (collapsed) */}
                    {messages.length > 0 && (
                        <details className="draft-section" style={{ cursor: 'pointer' }}>
                            <summary className="draft-section-title" style={{ cursor: 'pointer' }}>
                                {t('pmChat.conversationHistory')} ({messages.length})
                            </summary>
                            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 12, border: '1px solid var(--border-light)', padding: 12, marginTop: 8 }}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`chat-bubble ${msg.role}`} style={{ opacity: 0.85 }}>
                                        {msg.content}
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {/* Actions */}
                    <div className="draft-actions">
                        <button
                            onClick={handleToProyecto}
                            disabled={advancing}
                            style={{
                                background: '#FF385C', color: '#fff', border: 'none', borderRadius: 9999,
                                padding: '12px 24px', fontWeight: 600, fontSize: '0.9rem',
                                cursor: advancing ? 'wait' : 'pointer', opacity: advancing ? 0.6 : 1,
                            }}
                        >
                            {advancing ? t('pmChat.creatingProjectPipeline') : <><Rocket size={14} /> {t('pmChat.confirmCreateProject')}</>}
                        </button>
                        <button
                            onClick={handleReopen}
                            disabled={advancing}
                            style={{
                                background: 'transparent', color: 'var(--text-secondary)',
                                border: '1px solid var(--border-default, #E5E7EB)', borderRadius: 9999,
                                padding: '12px 24px', fontWeight: 500, fontSize: '0.9rem',
                                cursor: advancing ? 'wait' : 'pointer',
                            }}
                        >
                            <MessageSquare size={14} /> {t('pmChat.keepRefining')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Proyecto View ──────────────────────────────────────────────────────
    if (itemStatus === 'proyecto') {
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <span className="chat-header-title"><Rocket size={16} /> {t('pmChat.projectCreated')}</span>
                    {onClose && (
                        <button className="chat-header-close" onClick={onClose}>&times;</button>
                    )}
                </div>
                <div className="chat-messages" style={{ padding: 24 }}>
                    <div style={{
                        background: '#DCFCE7',
                        borderRadius: 16,
                        padding: 24,
                        textAlign: 'center',
                        color: '#16A34A',
                        fontWeight: 600,
                        fontSize: '1rem',
                    }}>
                        {t('pmChat.projectInWorkspace')}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Chat View (default) ────────────────────────────────────────────────
    return (
        <div className="chat-container">
            <div className="chat-header">
                <span className="chat-header-title">{t('pmChat.pmAgent')}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {itemId && messages.length > 0 && !streaming && (
                        <button
                            onClick={handleToBorrador}
                            disabled={advancing}
                            style={{
                                background: '#FF385C',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 9999,
                                padding: '6px 16px',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: advancing ? 'wait' : 'pointer',
                                opacity: advancing ? 0.6 : 1,
                            }}
                        >
                            {advancing ? t('pmChat.generating') : <><FileEdit size={14} /> {t('pmChat.createDraft')}</>}
                        </button>
                    )}
                    {onClose && (
                        <button className="chat-header-close" onClick={onClose}>&times;</button>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && !isVoiceConnected && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">{InboxIcons.empty}</div>
                        <div className="chat-empty-text">
                            {t('pmChat.describeIdea')}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.role === 'assistant'
                            ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }} />
                            : (msg.content || (streaming && i === messages.length - 1 ? '' : '...'))}
                    </div>
                ))}

                {/* Live Voice Transcripts */}
                {isVoiceConnected && (inputTranscript || outputTranscript || voiceStatus === 'listening' || voiceStatus === 'speaking' || voiceStatus === 'searching') && (
                    <div className="voice-transcripts-live">
                        {inputTranscript && (
                            <div className="chat-line-wrapper user voice-preview">
                                <div className="chat-bubble user">
                                    {inputTranscript}
                                </div>
                            </div>
                        )}
                        {(outputTranscript || voiceStatus === 'searching' || voiceStatus === 'speaking') && (
                            <div className="chat-line-wrapper assistant voice-preview">
                                <div className="chat-bubble assistant">
                                    {outputTranscript
                                        ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(outputTranscript) }} />
                                        : ''}
                                    {voiceStatus === 'searching' && !outputTranscript && (
                                        <span style={{ opacity: 0.6, fontStyle: 'italic' }}>
                                            <Loader size={12} className="spin" style={{ display: 'inline-block', marginRight: 4 }} />
                                            {t('agentChat.voiceSearching')}
                                        </span>
                                    )}
                                    {voiceStatus === 'speaking' && <span className="voice-pulsing-dot" />}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {streaming && messages[messages.length - 1]?.content === '' && (
                    <div className="chat-typing">
                        <span className="chat-typing-dot"></span>
                        <span className="chat-typing-dot"></span>
                        <span className="chat-typing-dot"></span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* RAG Sources */}
            {ragSources.length > 0 && (
                <div className="chat-rag-sources">
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        KB Sources
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {ragSources.map((s, i) => (
                            <span key={i} className="kb-namespace-tag" title={`${s.title} (${(s.score * 100).toFixed(0)}%)`}>
                                {s.title?.slice(0, 30)}{s.title?.length > 30 ? '...' : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="chat-input-row">
                {isVoiceConnected ? (
                    <div className="voice-active-bar" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--primary-soft)', borderRadius: 12, color: 'var(--primary)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`voice-status-dot ${voiceStatus === 'listening' ? 'pulsing' : ''}`}></span>
                            {voiceStatus === 'listening' ? t('agentChat.voiceListening') :
                             voiceStatus === 'speaking' ? t('agentChat.voiceSpeaking') :
                             voiceStatus === 'searching' ? t('agentChat.voiceSearching') : t('agentChat.voiceReady')}
                            {voiceError && <span style={{ color: 'red', fontSize: '0.8rem', marginLeft: 8 }}>{voiceError}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className={`kb-voice-btn-inner ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={t('agentChat.voiceMute')}>
                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('pmChat.typeIdea')}
                        disabled={streaming}
                        rows={1}
                    />
                )}

                <button
                    className={`kb-voice-btn ${isVoiceConnected ? 'active' : ''}`}
                    onClick={toggleVoiceSession}
                    disabled={streaming}
                    title={isVoiceConnected ? t('agentChat.voiceEndCall') : t('agentChat.voiceStart')}
                    style={isVoiceConnected ? { background: '#ef4444', color: 'white', borderColor: '#ef4444' } : {}}
                >
                    {isVoiceConnected ? <PhoneOff size={16} /> : <Mic size={16} />}
                </button>

                {!isVoiceConnected && (
                    <button
                        onClick={() => sendMessage()}
                        disabled={streaming || !input.trim()}
                    >
                        {streaming ? <Loader size={14} className="spin" /> : <Send size={14} />}
                        {t('pmChat.send')}
                    </button>
                )}
            </div>
        </div>
    );
}
