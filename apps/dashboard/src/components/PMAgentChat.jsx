import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useVoice } from '../hooks/useVoice.js';
import { MicButton, SpeakerButton, TtsToggle } from './VoiceControls.jsx';
import { InboxIcons } from './icons.jsx';
import { FileEdit, Rocket, MessageSquare } from 'lucide-react';

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
    const messagesEndRef = useRef(null);

    const handleTranscript = useCallback((transcript) => {
        setInput(prev => prev ? prev + ' ' + transcript : transcript);
    }, []);

    const {
        sttSupported, isListening, toggleListening,
        ttsSupported, ttsEnabled, setTtsEnabled, isSpeaking, speak, stopSpeaking,
    } = useVoice({ lang, onTranscript: handleTranscript });

    const prevStreamingRef = useRef(false);
    useEffect(() => {
        if (prevStreamingRef.current && !streaming && ttsEnabled) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg?.role === 'assistant' && lastMsg.content) {
                speak(lastMsg.content);
            }
        }
        prevStreamingRef.current = streaming;
    }, [streaming, ttsEnabled, messages, speak]);

    // Load existing item when opening
    useEffect(() => {
        if (!inboxItemId) {
            setMessages([]);
            setItemId(null);
            setItemStatus('chat');
            setSummary('');
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
                const conv = Array.isArray(item.conversation) ? item.conversation : [];
                setMessages(conv.map(m => ({ role: m.role, content: m.content })));
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [inboxItemId]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming]);

    async function sendMessage() {
        const msg = input.trim();
        if (!msg) return;

        const userMsg = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);

        try {
            const res = await fetch(`${API_URL}/chat/pm-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inbox_item_id: itemId,
                    message: msg,
                }),
            });

            const newItemId = res.headers.get('X-Inbox-Item-Id');
            if (newItemId && !itemId) {
                setItemId(parseInt(newItemId));
                onItemCreated?.(parseInt(newItemId));
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
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setStreaming(false);
        }
    }

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
            setMessages([]);
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
            const res = await fetch(`${API_URL}/inbox/${itemId}/to-proyecto`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error: ${err.error}`);
                return;
            }
            const data = await res.json();
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
            // Reload conversation (seeded with summary context)
            const itemRes = await fetch(`${API_URL}/inbox/${itemId}`);
            const item = await itemRes.json();
            const conv = Array.isArray(item.conversation) ? item.conversation : [];
            setMessages(conv.map(m => ({ role: m.role, content: m.content })));
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

    // ─── Borrador View ──────────────────────────────────────────────────────
    if (itemStatus === 'borrador') {
        return (
            <div className="chat-container">
                <div className="chat-header">
                    <span className="chat-header-title"><FileEdit size={16} /> {t('pmChat.draft')}</span>
                    {onClose && (
                        <button className="chat-header-close" onClick={onClose}>&times;</button>
                    )}
                </div>

                <div className="chat-messages" style={{ padding: 24 }}>
                    <div style={{
                        background: 'var(--bg-section, #F7F7F7)',
                        borderRadius: 16,
                        padding: 24,
                        marginBottom: 16,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.7,
                        color: 'var(--text-main, #0F172A)',
                        fontSize: '0.95rem',
                    }}>
                        {summary || t('pmChat.noSummary')}
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            className="proposal-approve-btn"
                            onClick={handleToProyecto}
                            disabled={advancing}
                            style={{
                                background: '#FF385C',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 9999,
                                padding: '12px 24px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: advancing ? 'wait' : 'pointer',
                                opacity: advancing ? 0.6 : 1,
                            }}
                        >
                            {advancing ? t('pmChat.generatingProject') : <><Rocket size={14} /> {t('pmChat.confirmCreateProject')}</>}
                        </button>
                        <button
                            onClick={handleReopen}
                            disabled={advancing}
                            style={{
                                background: 'transparent',
                                color: 'var(--text-secondary, #64748B)',
                                border: '1px solid var(--border-default, #E5E7EB)',
                                borderRadius: 9999,
                                padding: '12px 24px',
                                fontWeight: 500,
                                fontSize: '0.9rem',
                                cursor: advancing ? 'wait' : 'pointer',
                            }}
                        >
                            <><MessageSquare size={14} /> {t('pmChat.keepRefining')}</>
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
                    <TtsToggle ttsEnabled={ttsEnabled} setTtsEnabled={setTtsEnabled} ttsSupported={ttsSupported} />
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
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">{InboxIcons.empty}</div>
                        <div className="chat-empty-text">
                            {t('pmChat.describeIdea')}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.content || (streaming && i === messages.length - 1 ? '' : '...')}
                        {msg.role === 'assistant' && msg.content && ttsSupported && (
                            <SpeakerButton
                                onClick={() => isSpeaking ? stopSpeaking() : speak(msg.content)}
                                isSpeaking={isSpeaking}
                            />
                        )}
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

            <div className="chat-input-row">
                <MicButton
                    isListening={isListening}
                    onClick={toggleListening}
                    disabled={streaming}
                    sttSupported={sttSupported}
                />
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('pmChat.typeIdea')}
                    disabled={streaming}
                />
                <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}>
                    {t('pmChat.send')}
                </button>
            </div>
        </div>
    );
}
