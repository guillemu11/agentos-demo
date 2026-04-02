import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { Send } from 'lucide-react';
import renderMarkdown from '../../utils/renderMarkdown.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Hoisted at module level to avoid RegExp recreation on every call (js-hoist-regexp)
const BRIEF_UPDATE_RE = /\[BRIEF_UPDATE:(\{[^}]+\})\]/g;

// Parse [BRIEF_UPDATE] events from SSE text chunks.
// Returns { textChunk, briefUpdates } where briefUpdates is array of { market, block, status, value }
function parseBriefUpdates(chunk) {
  const briefUpdates = [];
  // Format the agent emits: [BRIEF_UPDATE:{"market":"en","block":"subject","status":"approved","value":"..."}]
  // Reset lastIndex because the regex is stateful (global flag)
  BRIEF_UPDATE_RE.lastIndex = 0;
  let match;
  while ((match = BRIEF_UPDATE_RE.exec(chunk)) !== null) {
    try {
      briefUpdates.push(JSON.parse(match[1]));
    } catch (_) { /* malformed — skip */ }
  }
  const textChunk = chunk.replace(BRIEF_UPDATE_RE, '').trim();
  return { textChunk, briefUpdates };
}

export default function ContentChatPanel({ agent, ticket, onBriefUpdate }) {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history on mount; inject welcome message when chat is fresh and a ticket is active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/agents/${agent.id}/conversation`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const loaded = Array.isArray(data.messages) ? data.messages : [];
        if (!cancelled) {
          if (loaded.length === 0 && ticket) {
            setMessages([{
              role: 'assistant',
              content: `Hola! Estoy listo para trabajar en **${ticket.project_name}**.\n\nPuedo generar copies e imágenes para los mercados configurados. Dime por dónde empezamos — ¿subject lines, hero image, body copy o CTA?`,
            }]);
          } else {
            setMessages(loaded);
          }
        }
      } catch (_) { /* network error — start fresh */ }
    })();
    return () => { cancelled = true; };
  }, [agent.id, ticket?.id]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setStreaming(true);

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    // Build ticket context prefix so the agent knows what campaign this is for
    const contextPrefix = ticket
      ? `[Campaign: ${ticket.project_name} — Stage: ${ticket.stage_name}]\n\n`
      : '';

    try {
      const res = await fetch(`${API_URL}/chat/agent/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: contextPrefix + text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      // Placeholder assistant message while streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '', briefUpdates: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              const { textChunk, briefUpdates } = parseBriefUpdates(parsed.text);
              assistantText += textChunk;
              // Propagate brief updates upward
              briefUpdates.forEach(u => onBriefUpdate(u.market, u.block, { status: u.status, value: u.value }));
              // Update last assistant message in place
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last.role === 'assistant') {
                  next[next.length - 1] = {
                    ...last,
                    content: assistantText,
                    briefUpdates: [...(last.briefUpdates || []), ...briefUpdates],
                  };
                }
                return next;
              });
            }
          } catch (_) { /* non-JSON chunk — skip */ }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, streaming, agent.id, ticket, onBriefUpdate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="content-chat-panel">
      {/* Agent header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          {agent.avatar || '✍️'}
        </div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>{agent.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981' }}>● Gemini + Pinecone</div>
        </div>
        {ticket && (
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(148,163,184,0.08)', padding: '2px 8px', borderRadius: 4 }}>
            {ticket.project_name}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="content-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '82%',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? '#334155' : 'var(--bg-card, #1e293b)',
                border: msg.role === 'assistant' ? '1px solid rgba(148,163,184,0.08)' : 'none',
                fontSize: '0.85rem',
                color: 'var(--text-primary, #e2e8f0)',
                lineHeight: 1.5,
              }}
            >
              {msg.role === 'assistant'
                ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '…') }} />
                : msg.content
              }

              {/* Inline brief update cards */}
              {msg.role === 'assistant' && msg.briefUpdates && msg.briefUpdates.length > 0 && (
                <div className="brief-inline-card">
                  <div className="brief-inline-card-title">
                    {msg.briefUpdates[0]?.block === 'subject' ? (t('contentAgent.blockSubject') || 'Subject Line') :
                     msg.briefUpdates[0]?.block === 'heroImage' ? (t('contentAgent.blockHeroImage') || 'Hero Image') :
                     msg.briefUpdates[0]?.block === 'bodyCopy' ? (t('contentAgent.blockBodyCopy') || 'Body Copy') :
                     (t('contentAgent.blockCta') || 'CTA Button')}
                  </div>
                  {msg.briefUpdates.map((u, j) => (
                    <div key={j} className={`brief-inline-market-row${u.status === 'generating' ? ' generating' : ''}`}>
                      <div className="brief-inline-market-value">
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, marginRight: 6 }}>
                          {u.market === 'en' ? '🇬🇧' : u.market === 'es' ? '🇪🇸' : u.market === 'ar' ? '🇦🇪' : '🌐'}
                        </span>
                        {u.status === 'generating' ? '...' : u.value}
                      </div>
                      {u.status === 'approved' && (
                        <div className="brief-inline-actions">
                          <button className="brief-action-btn approve" onClick={() => onBriefUpdate(u.market, u.block, { status: 'approved', value: u.value })}>
                            {t('contentAgent.approveBlock') || '✓'}
                          </button>
                          <button className="brief-action-btn regenerate" onClick={() => {
                            setInput(`Regenera el ${u.block} para ${u.market}`);
                            inputRef.current?.focus();
                          }}>
                            {t('contentAgent.regenerateBlock') || '↻'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div style={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span className="loading-pulse" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="content-chat-input-row">
        <textarea
          ref={inputRef}
          className="content-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? '...' : 'Pide copies, imágenes, variantes por mercado...'}
          disabled={streaming}
          rows={1}
        />
        <button
          className="content-chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
