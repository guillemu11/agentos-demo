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

const MARKET_FLAGS_INLINE = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };

// Mirror of the backend regex — used only to show skeleton immediately
const IMAGE_REQUEST_RE = /\b(imagen?|image|foto|photo|banner|hero|visual|picture|ilustra|generat|crea(?:r)?|diseña|design|make)\b.{0,80}\b(imagen?|image|foto|photo|banner|hero|avion|plane|aircraft|logo|background|fondo)\b/i;

export default function ContentChatPanel({ agent, ticket, completedSessions, activeVariant, onBriefUpdate, onImageGenerated, onVarUpdate, externalInput, onExternalInputConsumed }) {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  // Pre-load chat input from parent (e.g. block click in template panel)
  useEffect(() => {
    if (!externalInput) return;
    setInput(externalInput);
    onExternalInputConsumed?.();
    inputRef.current?.focus();
  }, [externalInput, onExternalInputConsumed]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load pipeline session messages OR call /initialize for the first message
  useEffect(() => {
    let cancelled = false;
    if (!ticket) { setMessages([]); return; }

    (async () => {
      try {
        // If ticket has a pipeline session id, load its messages from the pipeline endpoint
        const sessionId = ticket.id; // pas.id is the session id
        const projectId = ticket.project_id;

        // Load existing session messages first
        const msgsRes = await fetch(
          `${API_URL}/projects/${projectId}/sessions/${sessionId}/messages`,
          { credentials: 'include' }
        );
        if (cancelled) return;

        let loaded = [];
        if (msgsRes.ok) {
          const msgsData = await msgsRes.json();
          // Server returns { messages: [], total: N }
          const arr = msgsData?.messages ?? msgsData;
          loaded = Array.isArray(arr) ? arr : [];
        }

        if (loaded.length > 0) {
          if (!cancelled) {
            // Parse BRIEF_UPDATE tags from historical messages and rebuild sidebar state
            const parsed = loaded.map(m => {
              if (m.role !== 'assistant') return { role: m.role, content: m.content };
              const { textChunk, briefUpdates } = parseBriefUpdates(m.content || '');
              briefUpdates.forEach(u => onBriefUpdate({ variant: u.variant, block: u.block, status: u.status, value: u.value }));
              return { role: m.role, content: textChunk };
            });
            setMessages(parsed);
          }
          return;
        }

        // No messages yet — call /initialize to get the rich first message via SSE
        if (!cancelled) setStreaming(true);
        if (!cancelled) setMessages([{ role: 'assistant', content: '', _loading: true }]);

        const initRes = await fetch(
          `${API_URL}/projects/${projectId}/sessions/${sessionId}/initialize`,
          { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
        );
        if (cancelled) return;
        if (!initRes.ok) {
          // Fallback to simple welcome if initialize fails
          if (!cancelled) setMessages([{
            role: 'assistant',
            content: `¡Hola! Estoy lista para trabajar en **${ticket.project_name}**.\n\nUsa el formulario **"New Variant"** del panel derecho para crear la primera variante y pídeme que genere el contenido.`,
          }]);
          return;
        }

        const reader = initRes.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          const raw = decoder.decode(value, { stream: true });
          for (const line of raw.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                if (!cancelled) setMessages([{ role: 'assistant', content: fullText }]);
              }
            } catch (_) { /* skip */ }
          }
        }
      } catch (_) {
        if (!cancelled) {
          setMessages([{
            role: 'assistant',
            content: `¡Hola! Estoy lista para trabajar en **${ticket.project_name || 'este proyecto'}**.\n\nUsa el formulario **"New Variant"** del panel derecho para crear la primera variante.`,
          }]);
        }
      } finally {
        // Guarantee streaming is always reset — prevents zombie-locked textarea
        if (!cancelled) setStreaming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agent.id, ticket?.id, onBriefUpdate]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setStreaming(true);

    const userMsg = { role: 'user', content: text };
    const looksLikeImage = IMAGE_REQUEST_RE.test(text);
    setMessages(prev => looksLikeImage
      ? [...prev, userMsg, { role: 'assistant', isImageSkeleton: true }]
      : [...prev, userMsg]
    );

    // Build ticket context prefix — includes active variant so the agent knows what to update
    const variantContext = activeVariant ? ` — Active Variant: ${activeVariant}` : '';
    const contextPrefix = ticket
      ? `[Campaign: ${ticket.project_name} — Stage: ${ticket.stage_name}${variantContext}]\n\n`
      : '';

    try {
      // Use pipeline session endpoint when in a ticket context — provides full accumulated context,
      // RAG with stage namespaces, and persists messages to pipeline_session_messages
      const endpoint = ticket
        ? `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/chat`
        : `${API_URL}/chat/agent/${agent.id}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: ticket ? text : contextPrefix + text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let textPlaceholderAdded = false;

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
            if (parsed.image_error) {
              // Replace skeleton with error message
              setMessages(prev => {
                const skeletonIdx = prev.findLastIndex(m => m.isImageSkeleton);
                const errMsg = { role: 'assistant', content: `⚠️ ${parsed.image_error}` };
                if (skeletonIdx !== -1) { const next = [...prev]; next[skeletonIdx] = errMsg; return next; }
                return [...prev, errMsg];
              });
            }
            if (parsed.image_url) {
              const imageMsg = { role: 'assistant', content: '', image_url: parsed.image_url, image_prompt: parsed.image_prompt };
              // Replace skeleton if present, otherwise append
              setMessages(prev => {
                const skeletonIdx = prev.findLastIndex(m => m.isImageSkeleton);
                if (skeletonIdx !== -1) {
                  const next = [...prev];
                  next[skeletonIdx] = imageMsg;
                  return next;
                }
                return [...prev, imageMsg];
              });
              onImageGenerated?.({ url: parsed.image_url, prompt: parsed.image_prompt });
            }
            if (parsed.var_update) {
              onVarUpdate?.(parsed.var_update.name, parsed.var_update.value);
            }
            if (parsed.text) {
              const { textChunk, briefUpdates } = parseBriefUpdates(parsed.text);
              assistantText += textChunk;
              briefUpdates.forEach(u => onBriefUpdate({ variant: u.variant, block: u.block, status: u.status, value: u.value }));
              if (!textPlaceholderAdded) {
                // Add text bubble only on first text chunk, after any image bubbles
                textPlaceholderAdded = true;
                setMessages(prev => [...prev, { role: 'assistant', content: assistantText, briefUpdates }]);
              } else {
                setMessages(prev => {
                  const next = [...prev];
                  // Find last text bubble (no image_url)
                  for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].role === 'assistant' && !next[i].image_url) {
                      next[i] = { ...next[i], content: assistantText, briefUpdates: [...(next[i].briefUpdates || []), ...briefUpdates] };
                      break;
                    }
                  }
                  return next;
                });
              }
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

  if (!ticket) {
    return (
      <div className="content-chat-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)', fontSize: '0.9rem', padding: 32 }}>
        <div style={{ fontSize: '2rem' }}>📋</div>
        <div style={{ fontWeight: 600 }}>{t('contentAgent.noTicketSelected') || 'No hay ticket activo'}</div>
        <div style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
          {t('contentAgent.selectTicketHint') || 'Ve a la tab "Tickets" y selecciona un proyecto para empezar a trabajar con Lucia.'}
        </div>
      </div>
    );
  }

  return (
    <div className="content-chat-panel">
      {/* Agent header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, background: '#fff' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          {agent.avatar || '✍️'}
        </div>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>{agent.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981' }}>● Gemini + Pinecone</div>
        </div>
        {ticket && (
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 4 }}>
            {ticket.project_name}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="content-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={msg.role === 'user' ? 'content-chat-bubble-user' : 'content-chat-bubble-assistant'}>
              {msg.isImageSkeleton ? (
                <div className="image-skeleton">
                  <div className="image-skeleton-shimmer" />
                  <div className="image-skeleton-label">
                    <span className="loading-pulse" />
                    {' Generando imagen con Nano Banana...'}
                  </div>
                </div>
              ) : msg.image_url ? (
                <div>
                  <img
                    src={msg.image_url}
                    alt={msg.image_prompt || 'Generated image'}
                    style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: msg.image_prompt ? 6 : 0 }}
                  />
                  {msg.image_prompt && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                      {msg.image_prompt}
                    </div>
                  )}
                </div>
              ) : msg.role === 'assistant'
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
                          {MARKET_FLAGS_INLINE[u.variant?.split(':')[0]] || '🌐'} {u.variant?.toUpperCase().replace(':', ' / ')}
                        </span>
                        {u.status === 'generating' ? '...' : u.value}
                      </div>
                      {u.status === 'approved' && (
                        <div className="brief-inline-actions">
                          <button className="brief-action-btn approve" onClick={() => onBriefUpdate(u.market, u.block, { status: 'approved', value: u.value })}>
                            {t('contentAgent.approveBlock') || '✓'}
                          </button>
                          <button className="brief-action-btn regenerate" onClick={() => {
                            setInput(`Regenera el ${u.block} para la variante ${u.variant}`);
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
