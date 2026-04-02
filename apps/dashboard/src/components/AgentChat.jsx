import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useGeminiLive } from '../hooks/useGeminiLive.js';
import renderMarkdown from '../utils/renderMarkdown.js';
import { Mic, MicOff, PhoneOff, Loader, Send, FileText } from 'lucide-react';
import EmailPreview from './EmailPreview.jsx';

const FILE_URL = (path) => `${import.meta.env.VITE_API_URL || '/api'}/kb-files/${path}`;

const API_URL = import.meta.env.VITE_API_URL || '/api';

function applyPatch(currentHtml, blockName, patchHtml) {
    if (!currentHtml) return patchHtml;
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentHtml, 'text/html');
    const target = doc.querySelector(`[data-block-name="${blockName}"]`);
    if (!target) return currentHtml;
    const patchDoc = parser.parseFromString(patchHtml, 'text/html');
    const patchEl = patchDoc.querySelector(`[data-block-name="${blockName}"]`);
    if (patchEl) target.replaceWith(patchEl);
    return doc.documentElement.outerHTML;
}

export default function AgentChat({ agentId, agentName, agentAvatar, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched }) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [ragSources, setRagSources] = useState([]);
    const [expandedMedia, setExpandedMedia] = useState(null);
    const messagesEndRef = useRef(null);
    const currentHtmlRef = useRef('');

    // ─── Voice (Gemini Live) ──────────────────────────────────────────────

    const handleVoiceTurnComplete = useCallback((userText, assistantText, media) => {
        if (!userText && !assistantText) return;
        const newMessages = [];
        if (userText) newMessages.push({ role: 'user', content: userText });
        if (assistantText || (media && media.length > 0)) {
            newMessages.push({ role: 'assistant', content: assistantText || '', media: media || [] });
        }
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
        wsParams: { agentId },
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

    async function clearConversation() {
        await fetch(`${API_URL}/agents/${agentId}/conversation`, { method: 'DELETE' });
        setMessages([]);
        setRagSources([]);
    }

    // ─── Text Chat ────────────────────────────────────────────────────────

    // Load existing conversation on mount / agentId change
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/agents/${agentId}/conversation`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setMessages(Array.isArray(data.messages) ? data.messages : []);
                }
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [agentId]);

    // Consume external input (e.g. from block click in preview)
    useEffect(() => {
        if (!externalInput) return;
        setInput(prev => externalInput + prev);
        onExternalInputConsumed?.();
    }, [externalInput]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming, inputTranscript, outputTranscript]);

    async function sendMessage() {
        const msg = input.trim();
        if (!msg) return;

        const userMsg = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);

        try {
            const res = await fetch(`${API_URL}/chat/agent/${agentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: msg }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error || res.statusText}` }]);
                return;
            }

            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch { /* ignore */ }
            }

            // email HTML comes via SSE event (html_sources) — too large for HTTP headers
            let parsedMedia = [];
            const mediaHeader = res.headers.get('X-RAG-Media');
            if (mediaHeader) {
                try { parsedMedia = JSON.parse(mediaHeader); } catch { /* ignore */ }
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let sseBuffer = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '', media: parsedMedia }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() ?? '';

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
                                const last = updated[updated.length - 1];
                                updated[updated.length - 1] = { ...last, content: fullResponse };
                                return updated;
                            });
                        } else if (parsed.html_sources) {
                            const newMedia = parsed.html_sources
                                .filter(s => s.htmlSource)
                                .map(s => ({ mediaType: 'email_html', htmlSource: s.htmlSource, title: s.title }));
                            if (newMedia.length > 0) {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const last = updated[updated.length - 1];
                                    const existing = last.media || [];
                                    const merged = [...existing, ...newMedia.filter(m => !existing.find(e => e.title === m.title))];
                                    updated[updated.length - 1] = { ...last, media: merged };
                                    return updated;
                                });
                            }
                        } else if (parsed.text) {
                            fullResponse += parsed.text;
                            const captured = fullResponse;
                            setMessages(prev => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                updated[updated.length - 1] = { ...last, content: captured };
                                return updated;
                            });
                        }
                    } catch { /* ignore parse errors */ }
                }
            }

            // Detect HTML generation or patch
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
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setStreaming(false);
        }
    }

    async function clearConversation() {
        try {
            await fetch(`${API_URL}/agents/${agentId}/conversation`, { method: 'DELETE' });
            setMessages([]);
            setRagSources([]);
        } catch { /* ignore */ }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !streaming) {
            e.preventDefault();
            sendMessage();
        }
    }


    // ─── Render ───────────────────────────────────────────────────────────

    return (
        <>
        <div className="chat-container">
            <div className="chat-header">
                <span className="chat-header-title">
                    {agentAvatar} {t('agentChat.chatWith')} {agentName}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {messages.length > 0 && !streaming && (
                        <button
                            onClick={clearConversation}
                            style={{
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-light)',
                                borderRadius: 9999,
                                padding: '6px 16px',
                                fontWeight: 500,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                            }}
                        >
                            {t('agentChat.clearChat')}
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && !isVoiceConnected && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">{agentAvatar}</div>
                        <div className="chat-empty-text">
                            {t('agentChat.emptyState').replace('{name}', agentName)}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.role === 'assistant'
                            ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }} />
                            : (msg.content || '...')}
                        {msg.role === 'assistant' && msg.media?.length > 0 && (
                            <div className="chat-inline-media">
                                {msg.media.map((m, j) => (
                                    m.mediaType === 'email_html' ? (
                                        <div key={j} style={{ width: '100%', marginTop: 8 }}>
                                            <EmailPreview html={m.htmlSource} title={m.title} />
                                        </div>
                                    ) : (
                                        <div key={j} className="chat-inline-media-item" onClick={() => {
                                            if (m.mediaType === 'image') {
                                                setExpandedMedia({ type: 'image', src: FILE_URL(m.filePath), title: m.title });
                                            } else {
                                                setExpandedMedia({ type: 'pdf', src: FILE_URL(m.filePath), title: m.title, pageNumber: m.pageNumber });
                                            }
                                        }}>
                                            {m.mediaType === 'image'
                                                ? <div className="chat-inline-img-wrap">
                                                    <img src={FILE_URL(m.filePath)} alt={m.title} loading="lazy"
                                                        onLoad={e => e.target.parentElement.classList.add('loaded')}
                                                        onError={e => { e.target.style.display = 'none'; e.target.parentElement.classList.add('error'); }}
                                                    />
                                                  </div>
                                                : <div className="chat-inline-pdf"><FileText size={20} /><span className="chat-inline-pdf-title">{m.title?.slice(0, 20) || 'PDF'}</span><span>p.{m.pageNumber || '?'}</span></div>
                                            }
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
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
                        placeholder={t('agentChat.placeholder').replace('{name}', agentName)}
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
                        {t('agentChat.send')}
                    </button>
                )}
            </div>
        </div>

            {expandedMedia && (
                <div className="kb-media-modal-overlay" onClick={() => setExpandedMedia(null)}>
                    <div className="kb-media-modal" onClick={e => e.stopPropagation()}>
                        <button className="kb-media-modal-close" onClick={() => setExpandedMedia(null)}>✕</button>
                        {expandedMedia.type === 'image' && (
                            <img src={expandedMedia.src} alt={expandedMedia.title} className="kb-media-modal-img" />
                        )}
                        {expandedMedia.type === 'pdf' && (
                            <iframe src={expandedMedia.src} title={expandedMedia.title} className="kb-media-modal-pdf" />
                        )}
                        <div className="kb-media-modal-title">{expandedMedia.title}</div>
                    </div>
                </div>
            )}
        </>
    );
}
