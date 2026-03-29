import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useVoice } from '../hooks/useVoice.js';
import { MicButton, SpeakerButton, TtsToggle, VoiceModeButton } from './VoiceControls.jsx';
import VoiceOverlay from './VoiceOverlay.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function AgentChat({ agentId, agentName, agentAvatar }) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [ragSources, setRagSources] = useState([]);
    const [voiceMode, setVoiceMode] = useState(false);
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

    // Auto-scroll
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
            const res = await fetch(`${API_URL}/chat/agent/${agentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: msg }),
            });

            // Extract RAG sources from header
            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch { /* ignore */ }
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

    async function clearConversation() {
        try {
            await fetch(`${API_URL}/agents/${agentId}/conversation`, { method: 'DELETE' });
            setMessages([]);
        } catch { /* ignore */ }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !streaming) {
            e.preventDefault();
            sendMessage();
        }
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <span className="chat-header-title">
                    {agentAvatar} {t('agentChat.chatWith')} {agentName}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <VoiceModeButton onClick={() => setVoiceMode(true)} />
                    <TtsToggle ttsEnabled={ttsEnabled} setTtsEnabled={setTtsEnabled} ttsSupported={ttsSupported} />
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
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">{agentAvatar}</div>
                        <div className="chat-empty-text">
                            {t('agentChat.emptyState').replace('{name}', agentName)}
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
                    placeholder={t('agentChat.placeholder').replace('{name}', agentName)}
                    disabled={streaming}
                />
                <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}>
                    {t('agentChat.send')}
                </button>
            </div>
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
            {voiceMode && (
                <VoiceOverlay
                    agentId={agentId}
                    agentName={agentName}
                    agentAvatar={agentAvatar}
                    onClose={() => setVoiceMode(false)}
                    onMessage={(role, text) => {
                        setMessages(prev => [...prev, { role, content: text }]);
                    }}
                />
            )}
        </div>
    );
}
