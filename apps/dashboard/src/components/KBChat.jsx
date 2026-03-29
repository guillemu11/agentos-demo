import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import renderMarkdown from '../utils/renderMarkdown.js';
import { Send, Trash2, ChevronDown, ChevronUp, Database, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const NAMESPACES = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];
const STORAGE_KEY = 'kb-chat-messages';

export default function KBChat() {
    const { t } = useLanguage();
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [namespace, setNamespace] = useState('');
    const [lastSources, setLastSources] = useState([]);
    const [sourcesExpanded, setSourcesExpanded] = useState(false);
    const [htmlSources, setHtmlSources] = useState([]);
    const messagesEndRef = useRef(null);

    // Persist messages to localStorage
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }, [messages]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming]);

    // Handle image clicks (open full-size in new tab)
    function handleMessagesClick(e) {
        if (e.target.tagName === 'IMG' && e.target.closest('.md-content')) {
            window.open(e.target.src, '_blank');
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

        try {
            // Build history from existing messages (last 20)
            const history = messages.slice(-20);

            const res = await fetch(`${API_URL}/chat/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: msg, history, namespace: namespace || undefined }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error}` }]);
                setStreaming(false);
                return;
            }

            // Extract RAG sources
            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setLastSources(JSON.parse(ragHeader)); } catch { /* ignore */ }
            } else {
                setLastSources([]);
            }

            const htmlHeader = res.headers.get('X-HTML-Sources');
            if (htmlHeader) {
                try { setHtmlSources(JSON.parse(htmlHeader)); } catch { /* ignore */ }
            } else {
                setHtmlSources([]);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                        if (parsed.text) {
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
            setMessages(prev => [...prev, { role: 'assistant', content: `${t('knowledge.chat.errorStream')}: ${err.message}` }]);
        } finally {
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

    const suggested = [
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
        <div className="kb-chat-container">
            {/* Header */}
            <div className="kb-chat-header">
                <Database size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('knowledge.chat.title')}</span>
                <select
                    value={namespace}
                    onChange={e => setNamespace(e.target.value)}
                    className="kb-filter-select"
                    style={{ marginLeft: 'auto', minWidth: 130 }}
                >
                    <option value="">{t('knowledge.chat.namespaceAll')}</option>
                    {NAMESPACES.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                </select>
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
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.role === 'user'
                            ? msg.content
                            : msg.content
                                ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                : (streaming && i === messages.length - 1 ? '' : '...')
                        }
                    </div>
                ))}

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
                                    className="kb-chat-source-item"
                                    title={`${s.title} — ${(s.score * 100).toFixed(0)}% relevance`}
                                >
                                    {s.title?.slice(0, 35)}{s.title?.length > 35 ? '...' : ''}
                                    <span style={{ opacity: 0.6, marginLeft: 4 }}>{(s.score * 100).toFixed(0)}%</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {htmlSources.length > 0 && htmlSources.map((hs, i) => (
                <EmailPreview key={i} html={hs.htmlSource} title={hs.title} />
            ))}

            {/* Input */}
            <div className="kb-chat-input-row">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('knowledge.chat.placeholder')}
                    disabled={streaming}
                />
                <button
                    className="kb-action-btn"
                    onClick={() => sendMessage()}
                    disabled={streaming || !input.trim()}
                    style={{ borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    {streaming ? <Loader size={14} className="spin" /> : <Send size={14} />}
                    {t('knowledge.chat.send')}
                </button>
            </div>
        </div>
    );
}
