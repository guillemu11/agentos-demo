// apps/dashboard/src/components/studio/StudioChatPanel.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ClipboardList } from 'lucide-react';
import { LangIcon } from '../icons.jsx';
import renderMarkdown from '../../utils/renderMarkdown.js';

import { IMAGE_SLOT_NAMES } from './studioConstants.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const BRIEF_UPDATE_RE = /\[BRIEF_UPDATE:(\{[\s\S]*?\})\]/g;
const IMAGE_REQUEST_RE = /\b(imagen?|image|foto|photo|banner|hero|visual|picture|ilustra|generat|crea(?:r)?|diseña|design|make)\b.{0,80}\b(imagen?|image|foto|photo|banner|hero|avion|plane|aircraft|logo|background|fondo)\b/i;

function parseBriefUpdates(chunk) {
  const briefUpdates = [];
  BRIEF_UPDATE_RE.lastIndex = 0;
  let match;
  while ((match = BRIEF_UPDATE_RE.exec(chunk)) !== null) {
    try { briefUpdates.push(JSON.parse(match[1])); } catch (_) {}
  }
  BRIEF_UPDATE_RE.lastIndex = 0;  // reset before replace to avoid stale lastIndex
  return { textChunk: chunk.replace(BRIEF_UPDATE_RE, '').trim(), briefUpdates };
}

// Fallback parser: when Claude outputs bullet lists instead of [BRIEF_UPDATE] tags,
// extract "varname: value" lines and match against the known template variables.
// expectedVars is the whitelist of valid variable names (from blockVarMap).
function parseBulletFallback(chunk, variantKey, expectedVars) {
  if (!chunk || !expectedVars || expectedVars.size === 0) return [];
  const updates = [];
  const seen = new Set();
  const IMAGE_SKIP = /image|img|logo|_alias|_link|_url/i;
  const lineRE = /^\s*(?:[*\-•]\s+)?(?:\*\*|`)?\s*@?([a-zA-Z][\w\\]*)\s*(?:\*\*|`)?\s*:\s*(.+?)\s*$/gm;
  let m;
  while ((m = lineRE.exec(chunk)) !== null) {
    const varName = m[1].trim().replace(/\\/g, '');
    let value = m[2].trim();
    value = value.replace(/^["'`](.*)["'`]$/, '$1').trim();
    if (!varName || !value) continue;
    if (IMAGE_SKIP.test(varName)) continue;
    if (seen.has(varName)) continue;
    if (!expectedVars.has(varName)) continue;
    if (value.startsWith('{') || value.startsWith('[')) continue;
    updates.push({ variant: variantKey, block: varName, status: 'approved', value });
    seen.add(varName);
  }
  return updates;
}

function detectSlotFromPrompt(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  return IMAGE_SLOT_NAMES.find(name => lower.includes(name.replace('_', ' ')) || lower.includes(name)) || null;
}

export default function StudioChatPanel({
  agent,
  ticket,
  activeMarket,
  activeTier,
  variants,
  blockVarMap,
  onBriefUpdate,
  onImageAssigned,
  externalInput,
  onExternalInputConsumed,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!externalInput) return;
    setInput(externalInput);
    onExternalInputConsumed?.();
    inputRef.current?.focus();
  }, [externalInput, onExternalInputConsumed]);

  // Load or initialize session messages
  useEffect(() => {
    let cancelled = false;
    if (!ticket) { setMessages([]); return; }
    (async () => {
      try {
        const msgsRes = await fetch(
          `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/messages`,
          { credentials: 'include' }
        );
        if (cancelled) return;
        let loaded = [];
        if (msgsRes.ok) {
          const data = await msgsRes.json();
          const arr = data?.messages ?? data;
          loaded = Array.isArray(arr) ? arr : [];
        }
        if (loaded.length > 0) {
          if (!cancelled) {
            const parsed = loaded.map(m => {
              if (m.role !== 'assistant') return { role: m.role, content: m.content };
              const { textChunk, briefUpdates } = parseBriefUpdates(m.content || '');
              briefUpdates.forEach(u => onBriefUpdate(u));
              return { role: m.role, content: textChunk };
            });
            setMessages(parsed);
          }
          return;
        }
        if (!cancelled) setStreaming(true);
        if (!cancelled) setMessages([{ role: 'assistant', content: '', _loading: true }]);
        const initRes = await fetch(
          `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/initialize`,
          { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
        );
        if (cancelled || !initRes.ok) {
          if (!cancelled) setMessages([{ role: 'assistant', content: `Hi! Ready to work on **${ticket.project_name}**.` }]);
          return;
        }
        const reader = initRes.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const p = JSON.parse(data);
              if (p.text) { fullText += p.text; if (!cancelled) setMessages([{ role: 'assistant', content: fullText }]); }
            } catch (_) {}
          }
        }
      } catch (_) {
        if (!cancelled) setMessages([{ role: 'assistant', content: `Hi! Ready to work on **${ticket?.project_name || 'this project'}**.` }]);
      } finally {
        if (!cancelled) setStreaming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agent?.id, ticket?.id, onBriefUpdate]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setStreaming(true);
    const looksLikeImage = IMAGE_REQUEST_RE.test(text);
    setMessages(prev => looksLikeImage
      ? [...prev, { role: 'user', content: text }, { role: 'assistant', isImageSkeleton: true }]
      : [...prev, { role: 'user', content: text }]
    );
    const variantContext = activeMarket ? ` — Active Market: ${activeMarket}:${activeTier || 'economy'}` : '';
    const contextPrefix = ticket ? `[Campaign: ${ticket.project_name} — Stage: ${ticket.stage_name}${variantContext}]\n\n` : '';

    // Build variable status context so Lucia knows exactly what's filled vs pending
    let varStatusBlock = '';
    if (blockVarMap && variants) {
      const variantKey = `${activeMarket}:${activeTier || 'economy'}`;
      const variantData = variants[variantKey] || {};
      const allVars = [...new Set(Object.values(blockVarMap).flat())];
      // Exclude image, alias, link vars — Lucia doesn't generate those
      const IMAGE_RE = /image|img|logo/i;
      const SKIP_RE = /(_alias|_link|_url)$/i;
      const textVars = allVars.filter(v => !IMAGE_RE.test(v) && !SKIP_RE.test(v));
      const filled = textVars.filter(v => variantData[v]?.value);
      const pending = textVars.filter(v => !variantData[v]?.value);
      if (textVars.length > 0) {
        varStatusBlock = `[VARIABLE_STATUS variant="${variantKey}"]\n`;
        if (filled.length) varStatusBlock += `FILLED — do NOT regenerate: ${filled.map(v => `${v}="${variantData[v].value.substring(0, 50)}${variantData[v].value.length > 50 ? '…' : ''}"`).join(' | ')}\n`;
        if (pending.length) varStatusBlock += `PENDING — generate [BRIEF_UPDATE] for each: ${pending.join(', ')}\n`;
        varStatusBlock += `[/VARIABLE_STATUS]\n\n`;
      }
    }

    try {
      const endpoint = ticket
        ? `${API_URL}/projects/${ticket.project_id}/sessions/${ticket.id}/chat`
        : `${API_URL}/chat/agent/${agent.id}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: ticket ? varStatusBlock + text : contextPrefix + text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let textAdded = false;
      let streamDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            streamDone = true;
            // Parse all BRIEF_UPDATE tags from the complete accumulated text at once
            const { briefUpdates: tagUpdates } = parseBriefUpdates(assistantText);
            let allUpdates = tagUpdates;
            // Fallback: if Claude output bullets instead of [BRIEF_UPDATE] tags, rescue them.
            // Build expected-var whitelist from blockVarMap for the active variant.
            if (allUpdates.length === 0 && blockVarMap) {
              const IMAGE_RE = /image|img|logo/i;
              const SKIP_RE = /(_alias|_link|_url)$/i;
              const expected = new Set(
                [...new Set(Object.values(blockVarMap).flat())]
                  .filter(v => !IMAGE_RE.test(v) && !SKIP_RE.test(v))
              );
              const variantKey = `${activeMarket}:${activeTier}`;
              const rescued = parseBulletFallback(assistantText, variantKey, expected);
              if (rescued.length > 0) {
                console.log(`[StudioChat] Fallback rescued ${rescued.length} variables from bullet output`);
                allUpdates = rescued;
              }
            }
            allUpdates.forEach(u => onBriefUpdate(u));
            if (allUpdates.length > 0) {
              setMessages(prev => {
                const n = [...prev];
                for (let i = n.length - 1; i >= 0; i--) {
                  if (n[i].role === 'assistant' && !n[i].image_url) {
                    n[i] = { ...n[i], content: assistantText.replace(BRIEF_UPDATE_RE, '').trim(), briefUpdates: allUpdates };
                    break;
                  }
                }
                return n;
              });
            }
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.image_error) {
              setMessages(prev => {
                const idx = prev.findLastIndex(m => m.isImageSkeleton);
                const err = { role: 'assistant', content: `⚠️ ${parsed.image_error}` };
                if (idx !== -1) { const n = [...prev]; n[idx] = err; return n; }
                return [...prev, err];
              });
            }
            if (parsed.brief_update) {
              onBriefUpdate(parsed.brief_update);
            }
            if (parsed.image_url) {
              // Use server-detected slot (has access to clean prompt without VARIABLE_STATUS block)
              const detectedSlot = parsed.detected_slot || detectSlotFromPrompt(parsed.image_prompt);
              const imageMsg = {
                role: 'assistant', content: '',
                image_url: parsed.image_url,
                image_prompt: parsed.image_prompt,
                detectedSlot,
                activeMarket,
              };
              setMessages(prev => {
                const idx = prev.findLastIndex(m => m.isImageSkeleton);
                if (idx !== -1) { const n = [...prev]; n[idx] = imageMsg; return n; }
                return [...prev, imageMsg];
              });
              // Auto-assign if slot detected
              if (detectedSlot && onImageAssigned) {
                onImageAssigned(activeMarket, detectedSlot, parsed.image_url, parsed.image_prompt);
              }
            }
            if (parsed.text) {
              // Accumulate raw text during stream — parse BRIEF_UPDATE only at end
              assistantText += parsed.text;
              const displayText = assistantText.replace(BRIEF_UPDATE_RE, '').trim();
              if (!textAdded) {
                textAdded = true;
                setMessages(prev => [...prev, { role: 'assistant', content: displayText }]);
              } else {
                setMessages(prev => {
                  const n = [...prev];
                  for (let i = n.length - 1; i >= 0; i--) {
                    if (n[i].role === 'assistant' && !n[i].image_url) {
                      n[i] = { ...n[i], content: displayText };
                      break;
                    }
                  }
                  return n;
                });
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, streaming, agent?.id, ticket, activeMarket, onBriefUpdate, onImageAssigned]);

  if (!ticket) {
    return (
      <div className="studio-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="studio-empty-state">
          <div className="icon"><ClipboardList size={24} /></div>
          <div style={{ fontWeight: 600 }}>No active ticket</div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>Select a ticket to start working with Lucia</div>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-panel">
      <div className="studio-panel-header">
        <div className="studio-panel-title">Chat</div>
        <div className="studio-agent-badge">
          <div className="studio-agent-dot" />
          Lucia · active
        </div>
      </div>

      <div className="studio-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`studio-msg ${msg.role}`}>
            {msg.isImageSkeleton ? (
              <div className="studio-image-skeleton">⟳ Generating image…</div>
            ) : msg.image_url ? (
              <div>
                <div className="studio-image-card">
                  <img src={msg.image_url} alt={msg.image_prompt || 'Generated'} />
                  {msg.image_prompt && <div className="studio-image-card-prompt">{msg.image_prompt}</div>}
                </div>
                <div className="studio-image-card-actions">
                  {IMAGE_SLOT_NAMES.map(slotName => (
                    <button
                      key={slotName}
                      className="studio-image-slot-btn"
                      onClick={() => onImageAssigned?.(msg.activeMarket || activeMarket, slotName, msg.image_url, msg.image_prompt)}
                    >
                      Use as {slotName}
                    </button>
                  ))}
                  <button className="studio-image-slot-btn discard" onClick={() => setMessages(prev => prev.filter((_, j) => j !== i))}>
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className={`studio-bubble ${msg.role}`}>
                {msg.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '…') }} />
                  : msg.content}
                {msg.briefUpdates?.map((u, j) => (
                  <div key={j} className="studio-brief-card">
                    <div className="studio-brief-card-label">
                      {u.block} · <LangIcon lang={u.variant?.split(':')[0] || 'en'} /> {u.variant?.toUpperCase().replace(':', ' / ')}
                    </div>
                    <div className="studio-brief-card-value">{u.status === 'generating' ? '…' : u.value}</div>
                    {u.status === 'approved' && (
                      <div className="studio-brief-card-actions">
                        <button className="studio-brief-action approve" onClick={() => onBriefUpdate({ ...u, status: 'approved' })}>✓ Approve</button>
                        <button className="studio-brief-action regen" onClick={() => { setInput(`Regenerate ${u.block} for variant ${u.variant}`); inputRef.current?.focus(); }}>↺ Regenerate</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="studio-typing">
            <span /><span /><span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="studio-chat-input-row">
        <textarea
          ref={inputRef}
          className="studio-chat-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder={streaming ? '…' : 'Ask for copy, images, variants by market…'}
          disabled={streaming}
          rows={1}
        />
        <button className="studio-chat-send-btn" onClick={sendMessage} disabled={!input.trim() || streaming}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
