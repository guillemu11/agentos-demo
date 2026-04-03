import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useStreamingChat } from '../hooks/useStreamingChat.js';
import renderMarkdown from '../utils/renderMarkdown.js';
import EmailPreview from './EmailPreview.jsx';
import { applyPatch } from '../utils/emailTemplate.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ProjectAgentChat({ projectId, session, completedSessions, stages, agents, pipelineStatus, onHandoffRequest, onViewCompletedStage, onHtmlBlock, onHtmlGenerated, onHtmlPatched, currentHtml }) {
    const { t } = useLanguage();
    const [input, setInput] = useState('');
    const [handoffSuggestion, setHandoffSuggestion] = useState(null);
    const [initializing, setInitializing] = useState(false);
    const messagesEndRef = useRef(null);
    const initRef = useRef(false);
    const currentHtmlRef = useRef('');

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });
    const agent = agentMap[session?.agent_id];

    const { messages, streaming, sendMessage, triggerInitialize, ragSources, clearConversation } = useStreamingChat({
        endpoint: `/projects/${projectId}/sessions/${session?.id}/chat`,
        loadConversation: async () => {
            if (!session?.id) return [];
            const res = await fetch(`${API_URL}/projects/${projectId}/sessions/${session.id}/messages`, { credentials: 'include' });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.messages || []).map(m => ({ role: m.role, content: m.content }));
        },
        onStreamEvent: (event) => {
            if (event.handoff_suggestion) setHandoffSuggestion(event.reason);
            if (event.html_sources?.length > 0 && onHtmlBlock) onHtmlBlock(event.html_sources[0]);
        },
        onStreamComplete: (fullResponse) => {
            const patchMatch = fullResponse.match(/<!--PATCH:([^>]+)-->([\s\S]+)/);
            if (patchMatch) {
                const [, blockName, patchHtml] = patchMatch;
                if (onHtmlPatched) {
                    const patched = applyPatch(currentHtmlRef.current || '', blockName, patchHtml);
                    currentHtmlRef.current = patched;
                    onHtmlPatched(blockName, patched);
                }
            } else if (fullResponse.includes('<!DOCTYPE') || fullResponse.includes('<html')) {
                if (onHtmlGenerated) {
                    currentHtmlRef.current = fullResponse;
                    onHtmlGenerated(fullResponse);
                }
            }
        },
    });

    useEffect(() => {
        if (currentHtml) currentHtmlRef.current = currentHtml;
    }, [currentHtml]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-initialize: agent speaks first when session has no messages
    useEffect(() => {
        if (session?.status === 'active' && messages.length === 0 && !initRef.current && !streaming && !initializing) {
            initRef.current = true;
            setInitializing(true);
            triggerInitialize(`/projects/${projectId}/sessions/${session.id}/initialize`)
                .finally(() => setInitializing(false));
        }
    }, [session?.status, session?.id, messages.length, streaming, initializing, projectId, triggerInitialize]);

    const handleSend = () => {
        if (!input.trim() || streaming) return;
        sendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    async function handleClearChat() {
        await fetch(`${API_URL}/projects/${projectId}/sessions/${session.id}/messages`, { method: 'DELETE', credentials: 'include' });
        clearConversation();
        initRef.current = false;
    }

    const isPaused = pipelineStatus === 'paused';
    const isActive = session?.status === 'active';

    // Compute next agent for handoff button label
    const nextStages = (stages || []).filter(s => (s.depends_on || []).includes(session?.stage_order));
    const nextAgentName = nextStages[0] ? (agentMap[nextStages[0].agent_id]?.name || nextStages[0].name) : null;

    if (!session) return null;

    return (
        <div className="pipeline-chat-container">
            <div className="pipeline-chat-header">
                <h3>{t('pipeline.chatWithAgent').replace('{name}', agent?.name || session.agent_id)}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`pipeline-status-badge ${session.status}`}>{session.stage_name}</span>
                    {messages.length > 0 && !streaming && (
                        <button onClick={handleClearChat} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 9999, padding: '4px 12px', fontWeight: 500, fontSize: '0.75rem', cursor: 'pointer' }}>
                            {t('agentChat.clearChat')}
                        </button>
                    )}
                </div>
            </div>

            {completedSessions && completedSessions.length > 0 && (
                <div className="pipeline-context-pills">
                    {completedSessions.map(s => (
                        <span key={s.id} className="pipeline-context-pill completed"
                            style={{ cursor: 'pointer' }}
                            title={s.summary || ''}
                            onClick={() => onViewCompletedStage?.(s.stage_order)}>
                            ✓ {s.stage_name}
                        </span>
                    ))}
                </div>
            )}

            {completedSessions && completedSessions.length > 0 && (
                <div style={{ padding: '8px 16px', background: 'var(--bg-main)', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                    <strong>{t('pipeline.previousWork')}:</strong>{' '}
                    {completedSessions[completedSessions.length - 1].summary?.substring(0, 200) || '—'}
                </div>
            )}

            <div className="pipeline-chat-messages">
                {initializing && messages.length === 0 && (
                    <div className="chat-bubble assistant">
                        <div className="chat-bubble-content" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            <span className="loading-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', marginRight: '8px' }} />
                            {t('pipeline.agentInitializing')}
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.role === 'assistant'
                            ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }} />
                            : <div className="chat-bubble-content">{msg.content}</div>}
                        {msg.role === 'assistant' && msg.media?.length > 0 && console.log('[DEBUG] rendering media:', msg.media.length, msg.media.map(m=>m.mediaType))}
                        {msg.role === 'assistant' && msg.media?.length > 0 && (
                            <div className="chat-inline-media">
                                {msg.media.map((m, j) => (
                                    m.mediaType === 'email_html' ? (
                                        <div key={j} style={{ width: '100%', marginTop: 8 }}>
                                            <EmailPreview html={m.htmlSource} title={m.title} />
                                        </div>
                                    ) : null
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {ragSources.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '8px 0' }}>
                        {ragSources.map((src, i) => (
                            <span key={i} className="pipeline-context-pill" style={{ fontSize: '0.7rem' }}>
                                📚 {src.namespace || src.title || `Source ${i + 1}`}
                            </span>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {handoffSuggestion && isActive && (
                <div className="handoff-suggestion">
                    <p>✓ {t('pipeline.stageReady')}: {handoffSuggestion}</p>
                    <button onClick={() => onHandoffRequest(session)}>{t('pipeline.handoff')} →</button>
                </div>
            )}

            {isPaused ? (
                <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {t('pipeline.pipelinePaused')}
                </div>
            ) : isActive ? (
                <div className="pipeline-chat-input">
                    <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder={`Message ${agent?.name || ''}...`} disabled={streaming} rows={1} />
                    <button className="send-btn" onClick={handleSend} disabled={streaming || !input.trim()}>
                        {streaming ? '...' : 'Send'}
                    </button>
                    <button className={`handoff-btn${handoffSuggestion ? ' ready' : ''}`} onClick={() => onHandoffRequest(session)} disabled={streaming}>
                        {handoffSuggestion && nextAgentName
                            ? t('pipeline.handoffTo').replace('{name}', nextAgentName)
                            : t('pipeline.handoff')} →
                    </button>
                </div>
            ) : (
                <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {t(`pipeline.${session.status}`)}
                </div>
            )}
        </div>
    );
}
