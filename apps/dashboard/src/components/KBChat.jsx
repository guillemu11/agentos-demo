import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import renderMarkdown from '../utils/renderMarkdown.js';
import { Send, Trash2, ChevronDown, ChevronUp, Database, Loader, Mic, MicOff, PhoneOff, X, FileText, Image as ImageIcon, Mail } from 'lucide-react';
import { useGeminiLive } from '../hooks/useGeminiLive.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const fileUrl = (filePath) => `${API_URL.replace('/api', '')}/api/kb-files/${filePath}`;
const NAMESPACES = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];
const STORAGE_KEY = 'kb-chat-messages';

export default function KBChat({ defaultNamespace = '', fixedNamespace = false, suggestedQuestions = null }) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [namespace, setNamespace] = useState(defaultNamespace);
    const [lastSources, setLastSources] = useState([]);
    const [sourcesExpanded, setSourcesExpanded] = useState(false);
    const [highlightedSource, setHighlightedSource] = useState(null);
    // Voice state management
    const [voiceActive, setVoiceActive] = useState(false);
    
    // Modal state for media
    const [expandedMedia, setExpandedMedia] = useState(null);

    const messagesEndRef = useRef(null);

    // Turn complete handler for voice
    const handleVoiceTurnComplete = (userText, assistantText, media) => {
        if (!userText && !assistantText) return;
        
        const newMessages = [];
        if (userText) {
             newMessages.push({ role: 'user', content: userText });
         }
        if (assistantText || (media && media.length > 0)) {
             newMessages.push({ role: 'assistant', content: assistantText, media: media || [] });
         }
         
        if (newMessages.length > 0) {
            setMessages(prev => [...prev, ...newMessages]);
        }
    };

    // Initialize Gemini Live
    const {
        status: voiceStatus,
        inputTranscript,
        outputTranscript,
        mediaResults: voiceMedia,
        error: voiceError,
        isMuted,
        connect: connectVoice,
        disconnect: disconnectVoice,
        toggleMute
    } = useGeminiLive({
        namespace,
        lang,
        onTurnComplete: handleVoiceTurnComplete,
        onSources: (newSources) => { if (newSources.length > 0) setLastSources(newSources); }
    });

    const isVoiceConnected = voiceStatus !== 'idle' && voiceStatus !== 'error';

    // Persist messages to localStorage
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }, [messages]);

    // Auto-scroll (including transcripts)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming, inputTranscript, outputTranscript]);

    // Cleanup voice on unmount
    useEffect(() => {
        return () => disconnectVoice();
    }, [disconnectVoice]);

    // Handle voice toggle
    const toggleVoiceSession = () => {
        if (isVoiceConnected) {
            disconnectVoice();
            setVoiceActive(false);
        } else {
            connectVoice();
            setVoiceActive(true);
        }
    };

    // Handle image clicks (open modal) and citation clicks
    function handleMessagesClick(e) {
        if (e.target.tagName === 'IMG' && e.target.closest('.chat-inline-media-item')) {
            e.preventDefault();
            const src = e.target.getAttribute('data-filepath') || e.target.src;
            setExpandedMedia({ type: 'image', src, title: e.target.alt });
        }
        // Citation marker click — expand sources panel and highlight the referenced source
        const citationEl = e.target.closest('.citation-marker');
        if (citationEl) {
            e.preventDefault();
            const sourceIdx = parseInt(citationEl.dataset.source) - 1;
            setSourcesExpanded(true);
            setHighlightedSource(sourceIdx);
            setTimeout(() => setHighlightedSource(null), 2000);
        }
    }

    async function sendMessage(text) {
        const msg = (text || input).trim();
        if (!msg || streaming) return;

        const userMsg = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);
        setSourcesExpanded(false);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        try {
            // Build history from existing messages (last 20)
            const history = messages.slice(-20);

            // Detect visual intent
            const visualKeywords = /diagrama|diagram|imagen|image|esquema|schema|flujo|flow|chart|screenshot|captura|visual|grafico|gráfico|email|correo|show\s+me|see\s+the|ver\s+el|ver\s+la|mostrar|preview|template|plantilla|pdf|documento/i;
            const visualQuery = visualKeywords.test(msg);

            const res = await fetch(`${API_URL}/chat/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                signal: controller.signal,
                body: JSON.stringify({ message: msg, history, namespace: namespace || undefined, visualQuery, lang }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error}` }]);
                return;
            }

            // Extract RAG sources
            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setLastSources(JSON.parse(ragHeader)); } catch { /* ignore */ }
            } else {
                setLastSources([]);
            }

            let parsedMedia = [];
            const mediaHeader = res.headers.get('X-RAG-Media');
            if (mediaHeader) {
                try { parsedMedia = JSON.parse(mediaHeader); } catch { /* ignore */ }
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '', media: parsedMedia }]);

            try {
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
            } finally {
                reader.cancel().catch(() => {});
            }
        } catch (err) {
            const errorMsg = err.name === 'AbortError'
                ? t('knowledge.chat.errorTimeout') || 'Request timed out (60s). Please try again.'
                : `${t('knowledge.chat.errorStream')}: ${err.message}`;
            setMessages(prev => {
                // If last message is an empty assistant placeholder, replace it
                if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: errorMsg };
                    return updated;
                }
                return [...prev, { role: 'assistant', content: errorMsg }];
            });
        } finally {
            clearTimeout(timeout);
            setStreaming(false);
        }
    }

    function clearChat() {
        setMessages([]);
        setLastSources([]);
        setSourcesExpanded(false);
        localStorage.removeItem(STORAGE_KEY);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !streaming) {
            e.preventDefault();
            sendMessage();
        }
    }

    const suggested = suggestedQuestions || [
        t('knowledge.chat.suggested1'),
        t('knowledge.chat.suggested2'),
        t('knowledge.chat.suggested3'),
        t('knowledge.chat.suggested4'),
    ];

    function EmailPreview({ html, title }) {
        const [showCode, setShowCode] = useState(false);
        const iframeRef = useRef(null);

        useEffect(() => {
            if (iframeRef.current) {
                const doc = iframeRef.current.contentDocument;
                doc.open();
                doc.write(html);
                doc.close();
            }
        }, [html]);

        return (
            <div className="kb-email-preview">
                <div className="kb-email-preview-header">
                    <span>{t('knowledge.chat.emailPreview')}: {title}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowCode(!showCode)}>
                            {showCode ? t('knowledge.chat.hideCode') : t('knowledge.chat.viewCode')}
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(html)}>
                            {t('knowledge.chat.copyHtml')}
                        </button>
                    </div>
                </div>
                <iframe ref={iframeRef} sandbox="allow-same-origin" title={title} />
                {showCode && <div className="kb-email-code">{html}</div>}
            </div>
        );
    }

    return (
        <>
        <div className="kb-chat-container">
            {/* Header */}
            <div className="kb-chat-header">
                <Database size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('knowledge.chat.title')}</span>
                {!fixedNamespace && (
                    <select
                        value={namespace}
                        onChange={e => setNamespace(e.target.value)}
                        className="kb-filter-select"
                        style={{ marginLeft: 'auto', minWidth: 130 }}
                    >
                        <option value="">{t('knowledge.chat.namespaceAll')}</option>
                        {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                    </select>
                )}
                {messages.length > 0 && !streaming && (
                    <button
                        onClick={clearChat}
                        className="kb-icon-btn"
                        title={t('knowledge.chat.clearChat')}
                        style={{ padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}
                    >
                        <Trash2 size={13} /> {t('knowledge.chat.clearChat')}
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="kb-chat-messages" onClick={handleMessagesClick}>
                {messages.length === 0 && (
                    <div className="kb-chat-empty">
                        <Database size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                        <h3>{t('knowledge.chat.emptyTitle')}</h3>
                        <p>{t('knowledge.chat.emptyText')}</p>
                        <div className="kb-chat-suggestions">
                            {suggested.map((q, i) => (
                                <button key={i} onClick={() => sendMessage(q)}>{q}</button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`chat-line-wrapper ${msg.role}`}>
                        <div className={`chat-bubble ${msg.role}`}>
                            {msg.role === 'user'
                                ? msg.content
                                : msg.content
                                    ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                    : (streaming && i === messages.length - 1 ? '' : '...')
                            }
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
                                                    setExpandedMedia({ type: 'image', src: fileUrl(m.filePath), title: m.title });
                                                } else {
                                                    setExpandedMedia({ type: 'pdf', src: fileUrl(m.filePath), title: m.title, pageNumber: m.pageNumber });
                                                }
                                            }}>
                                                {m.mediaType === 'image'
                                                    ? <div className="chat-inline-img-wrap">
                                                        <img src={fileUrl(m.filePath)} alt={m.title} data-filepath={fileUrl(m.filePath)} loading="lazy"
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
                                    {outputTranscript ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(outputTranscript) }} /> : ''}
                                    {voiceStatus === 'searching' && !outputTranscript && <span style={{ opacity: 0.6, fontStyle: 'italic' }}><Loader size={12} className="spin" style={{ display: 'inline-block', marginRight: 4 }}/> {t('knowledge.voice.searching')}</span>}
                                    {voiceStatus === 'speaking' && <span className="voice-pulsing-dot" />}
                                    
                                    {voiceMedia?.length > 0 && (
                                        <div className="chat-inline-media">
                                            {voiceMedia.map((m, j) => (
                                                m.mediaType === 'email_html' ? (
                                                    <div key={j} style={{ width: '100%', marginTop: 8 }}>
                                                        <EmailPreview html={m.htmlSource} title={m.title} />
                                                    </div>
                                                ) : (
                                                    <div key={j} className="chat-inline-media-item" onClick={() => {
                                                        if (m.mediaType === 'image') {
                                                            setExpandedMedia({ type: 'image', src: fileUrl(m.filePath), title: m.title });
                                                        } else {
                                                            window.open(fileUrl(m.filePath), '_blank');
                                                        }
                                                    }}>
                                                        {m.mediaType === 'image'
                                                            ? <img src={fileUrl(m.filePath)} alt={m.title} data-filepath={fileUrl(m.filePath)} loading="lazy" />
                                                            : <div className="chat-inline-pdf"><FileText size={24} /><span>PDF</span><span>p.{m.pageNumber || '?'}</span></div>
                                                        }
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
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

            {/* Sources panel */}
            {lastSources.length > 0 && (
                <div className="kb-chat-sources">
                    <button
                        className="kb-chat-sources-toggle"
                        onClick={() => setSourcesExpanded(!sourcesExpanded)}
                    >
                        {sourcesExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                        {sourcesExpanded ? t('knowledge.chat.hideSources') : t('knowledge.chat.showSources')} ({lastSources.length})
                    </button>
                    {sourcesExpanded && (
                        <div className="kb-chat-sources-list">
                            {lastSources.map((s, i) => (
                                <span
                                    key={i}
                                    className={`kb-chat-source-item${highlightedSource === i ? ' highlighted' : ''}`}
                                    title={`${s.title} — ${(s.score * 100).toFixed(1)}% relevance — ${s.namespace || ''}`}
                                >
                                    <span className="source-index">[{i + 1}]</span>
                                    {s.mediaType === 'image' ? <ImageIcon size={11} /> :
                                     s.mediaType === 'pdf_page' ? <FileText size={11} style={{ color: 'var(--primary)' }} /> :
                                     s.mediaType === 'html_email' ? <Mail size={11} /> :
                                     <FileText size={11} />}
                                    {s.title?.slice(0, 30)}{s.title?.length > 30 ? '...' : ''}
                                    <span style={{ opacity: 0.6, marginLeft: 4 }}>{(s.score * 100).toFixed(1)}%</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Input */}
            <div className="kb-chat-input-row">
                {isVoiceConnected ? (
                    <div className="voice-active-bar" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'var(--primary-soft)', borderRadius: 12, color: 'var(--primary)', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`voice-status-dot ${voiceStatus === 'listening' ? 'pulsing' : ''}`}></span>
                            {voiceStatus === 'listening' ? t('voice.listening') : 
                             voiceStatus === 'speaking' ? t('voice.speaking') : 
                             voiceStatus === 'searching' ? t('knowledge.voice.searching') : t('voice.ready')}
                            {voiceError && <span style={{ color: 'red', fontSize: '0.8rem', marginLeft: 8 }}>{voiceError}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className={`kb-voice-btn-inner ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={t('voice.mute')}>
                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>
                        </div>
                    </div>
                ) : (
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('knowledge.chat.placeholder')}
                        disabled={streaming}
                        rows={1}
                    />
                )}
                
                <button
                    className={`kb-voice-btn ${isVoiceConnected ? 'active' : ''}`}
                    onClick={toggleVoiceSession}
                    disabled={streaming}
                    title={isVoiceConnected ? t('voice.endCall') : t('knowledge.voice.mode')}
                    style={isVoiceConnected ? { background: '#ef4444', color: 'white', borderColor: '#ef4444' } : {}}
                >
                    {isVoiceConnected ? <PhoneOff size={16} /> : <Mic size={16} />}
                </button>
                
                {!isVoiceConnected && (
                    <button
                        className="kb-action-btn"
                        onClick={() => sendMessage()}
                        disabled={streaming || !input.trim()}
                        style={{ borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {streaming ? <Loader size={14} className="spin" /> : <Send size={14} />}
                        {t('knowledge.chat.send')}
                    </button>
                )}
            </div>
        </div>

        {/* Media Expansion Modal */}
        {expandedMedia && (
            <div className="kb-media-modal" onClick={() => setExpandedMedia(null)}>
                <button className="kb-media-modal-close" onClick={() => setExpandedMedia(null)}>
                    <X size={24} />
                </button>
                <div className="kb-media-modal-content" onClick={e => e.stopPropagation()}>
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
