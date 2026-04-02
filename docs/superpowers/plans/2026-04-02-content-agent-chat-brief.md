# Content Agent Chat + Brief Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic chat tab in ContentAgentView with a split layout: a 2/3-width chat panel and a 1/3-width Brief Sidebar that tracks email blocks (Subject, Hero Image, Body Copy, CTA) across multiple market variants (EN/ES/AR), culminating in a handoff button to the HTML Developer.

**Architecture:** Two new components (`ContentChatPanel` and `ContentBriefSidebar`) replace `AgentChatSwitcher` in the chat tab. Brief state is lifted to `ContentAgentView`. The backend SSE endpoint `/api/chat/agent/:agentId` is extended to emit structured `[BRIEF_UPDATE]` events when generating content blocks. Handoff uses the existing `HandoffModal` with a multi-market brief payload.

**Tech Stack:** React 19, CSS custom properties, SSE streaming, Anthropic SDK (claude-sonnet-4-6), Gemini (copies), existing `/api/agents/generate-image` endpoint, Pinecone RAG, HandoffModal.jsx

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Create** | `apps/dashboard/src/components/agent-views/ContentChatPanel.jsx` | Chat 2/3: text input, SSE streaming, inline block cards per message |
| **Create** | `apps/dashboard/src/components/agent-views/ContentBriefSidebar.jsx` | Brief 1/3: market tabs, 4 blocks per tab, progress bar, handoff button |
| **Modify** | `apps/dashboard/src/components/agent-views/ContentAgentView.jsx` | Lift brief state, replace AgentChatSwitcher in chat tab with split layout |
| **Modify** | `apps/dashboard/server.js` | Extend `/api/chat/agent/:agentId` to detect content-agent and emit `[BRIEF_UPDATE]` SSE events |
| **Modify** | `apps/dashboard/src/i18n/translations.js` | Add `contentAgent.brief*` keys (ES + EN) |
| **Modify** | `apps/dashboard/src/index.css` | Add `.content-chat-split`, `.brief-sidebar`, `.brief-block`, `.brief-tab` classes |

---

## Task 1: i18n keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add ES keys to `contentAgent` namespace**

Open `apps/dashboard/src/i18n/translations.js`. Find the `es.contentAgent` object and add:

```js
briefSidebar: 'Brief en construcción',
blocksProgress: '{done}/{total} bloques',
handoffButton: 'Pasar a HTML Developer',
handoffIncomplete: 'Completa todos los bloques primero',
handoffForce: 'Enviar de todas formas',
blockSubject: 'Subject Line',
blockHeroImage: 'Hero Image',
blockBodyCopy: 'Body Copy',
blockCta: 'CTA Button',
statusApproved: 'aprobado',
statusGenerating: 'generando',
statusPending: 'pendiente',
addMarket: '+ Mercado',
approveBlock: 'Aprobar',
regenerateBlock: 'Regenerar',
editBlock: 'Editar',
globalProgress: 'Progreso global',
```

- [ ] **Step 2: Add EN keys to `contentAgent` namespace**

Find the `en.contentAgent` object and add:

```js
briefSidebar: 'Brief in progress',
blocksProgress: '{done}/{total} blocks',
handoffButton: 'Send to HTML Developer',
handoffIncomplete: 'Complete all blocks first',
handoffForce: 'Send anyway',
blockSubject: 'Subject Line',
blockHeroImage: 'Hero Image',
blockBodyCopy: 'Body Copy',
blockCta: 'CTA Button',
statusApproved: 'approved',
statusGenerating: 'generating',
statusPending: 'pending',
addMarket: '+ Market',
approveBlock: 'Approve',
regenerateBlock: 'Regenerate',
editBlock: 'Edit',
globalProgress: 'Global progress',
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add content agent brief sidebar keys (EN+ES)"
```

---

## Task 2: CSS classes

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Add split layout and sidebar classes**

Open `apps/dashboard/src/index.css`. Append at the end of the file:

```css
/* ═══════════════════════════════════════
   Content Agent — Chat + Brief Split
═══════════════════════════════════════ */

.content-chat-split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  height: 600px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.content-chat-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-light);
  min-width: 0;
}

.content-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.content-chat-input-row {
  padding: 10px 12px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.content-chat-input {
  flex: 1;
  background: rgba(148,163,184,0.06);
  border: 1px solid rgba(148,163,184,0.15);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-primary, #e2e8f0);
  font-size: 0.85rem;
  font-family: inherit;
  resize: none;
  min-height: 38px;
  max-height: 120px;
  outline: none;
}

.content-chat-send-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary, #6366f1);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.content-chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Inline block cards inside chat bubbles */
.brief-inline-card {
  background: var(--bg-card, #1e293b);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 8px;
  border: 1px solid rgba(148,163,184,0.1);
}

.brief-inline-card-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.brief-inline-market-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(148,163,184,0.04);
  border-left: 2px solid var(--accent-green, #10b981);
  margin-bottom: 4px;
  gap: 8px;
}

.brief-inline-market-row.generating {
  border-left-color: #f59e0b;
}

.brief-inline-market-value {
  flex: 1;
  font-size: 0.82rem;
  color: var(--text-primary, #e2e8f0);
  min-width: 0;
}

.brief-inline-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.brief-action-btn {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s;
}

.brief-action-btn.approve {
  background: rgba(16,185,129,0.15);
  color: #10b981;
}

.brief-action-btn.regenerate {
  background: rgba(148,163,184,0.1);
  color: #94a3b8;
}

/* ─── Brief Sidebar ───────────────────────────────── */

.brief-sidebar {
  display: flex;
  flex-direction: column;
  background: rgba(15,23,42,0.4);
}

.brief-sidebar-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
}

.brief-sidebar-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.brief-sidebar-subtitle {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
  margin-top: 2px;
}

.brief-market-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
}

.brief-market-tab {
  flex: 1;
  padding: 7px 4px;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.brief-market-tab.active {
  color: var(--text-primary, #e2e8f0);
  border-bottom-color: var(--primary, #6366f1);
  background: rgba(99,102,241,0.08);
}

.brief-market-tab-add {
  padding: 7px 10px;
  font-size: 0.78rem;
  color: var(--text-muted, #475569);
  cursor: pointer;
  border: none;
  background: transparent;
}

.brief-blocks {
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.brief-block {
  background: rgba(15,23,42,0.6);
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 3px solid var(--border-light);
  transition: border-color 0.2s;
}

.brief-block.approved {
  border-left-color: var(--accent-green, #10b981);
}

.brief-block.generating {
  border-left-color: #f59e0b;
}

.brief-block.pending {
  border-left-color: rgba(148,163,184,0.2);
}

.brief-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.brief-block-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.brief-block-label.approved { color: var(--accent-green, #10b981); }
.brief-block-label.generating { color: #f59e0b; }

.brief-block-status {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.brief-block-status.approved {
  background: rgba(16,185,129,0.12);
  color: #10b981;
}

.brief-block-status.generating {
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
}

.brief-block-status.pending {
  background: rgba(148,163,184,0.08);
  color: #475569;
}

.brief-block-value {
  font-size: 0.82rem;
  color: var(--text-primary, #e2e8f0);
  line-height: 1.4;
  word-break: break-word;
}

.brief-block-image-thumb {
  width: 100%;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
  margin-top: 4px;
}

.brief-block-edit-btn {
  font-size: 0.7rem;
  color: var(--text-muted, #475569);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-top: 4px;
}

.brief-sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brief-progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brief-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--text-muted, #475569);
}

.brief-progress-track {
  height: 3px;
  background: rgba(148,163,184,0.1);
  border-radius: 2px;
  overflow: hidden;
}

.brief-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #10b981);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.brief-handoff-btn {
  width: 100%;
  padding: 9px;
  border-radius: 7px;
  border: 1px solid rgba(99,102,241,0.3);
  background: rgba(99,102,241,0.1);
  color: #818cf8;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.brief-handoff-btn:hover:not(:disabled) {
  background: rgba(99,102,241,0.2);
  border-color: rgba(99,102,241,0.5);
}

.brief-handoff-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.brief-handoff-hint {
  font-size: 0.7rem;
  color: var(--text-muted, #475569);
  text-align: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(css): add content-chat-split and brief-sidebar classes"
```

---

## Task 3: ContentBriefSidebar component

**Files:**
- Create: `apps/dashboard/src/components/agent-views/ContentBriefSidebar.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪' };
const MARKET_LABELS = { en: 'EN', es: 'ES', ar: 'AR' };
const BLOCK_KEYS = ['subject', 'heroImage', 'bodyCopy', 'cta'];

export default function ContentBriefSidebar({ brief, markets, onBriefUpdate, onHandoff }) {
  const { t } = useLanguage();
  const [activeMarket, setActiveMarket] = useState(markets[0] || 'en');

  const blockLabel = (key) => {
    if (key === 'subject') return t('contentAgent.blockSubject') || 'Subject Line';
    if (key === 'heroImage') return t('contentAgent.blockHeroImage') || 'Hero Image';
    if (key === 'bodyCopy') return t('contentAgent.blockBodyCopy') || 'Body Copy';
    if (key === 'cta') return t('contentAgent.blockCta') || 'CTA Button';
    return key;
  };

  // Count total approved blocks across all markets
  const totalBlocks = markets.length * BLOCK_KEYS.length;
  const approvedBlocks = markets.reduce((sum, m) => {
    return sum + BLOCK_KEYS.filter(k => brief[m]?.[k]?.status === 'approved').length;
  }, 0);
  const isComplete = approvedBlocks === totalBlocks;

  // Progress label: "EN 2/4 · ES 1/4 · AR 0/4"
  const progressDetail = markets.map(m => {
    const done = BLOCK_KEYS.filter(k => brief[m]?.[k]?.status === 'approved').length;
    return `${MARKET_LABELS[m] || m.toUpperCase()} ${done}/${BLOCK_KEYS.length}`;
  }).join(' · ');

  const activeBlocks = brief[activeMarket] || {};

  return (
    <aside className="brief-sidebar">
      {/* Header */}
      <div className="brief-sidebar-header">
        <div className="brief-sidebar-title">
          {t('contentAgent.briefSidebar') || 'Brief en construcción'}
        </div>
        <div className="brief-sidebar-subtitle">
          {(t('contentAgent.blocksProgress') || '{done}/{total} bloques')
            .replace('{done}', approvedBlocks)
            .replace('{total}', totalBlocks)}
        </div>
      </div>

      {/* Market tabs */}
      <div className="brief-market-tabs">
        {markets.map(m => (
          <button
            key={m}
            className={`brief-market-tab${activeMarket === m ? ' active' : ''}`}
            onClick={() => setActiveMarket(m)}
          >
            {MARKET_FLAGS[m] || '🌐'} {MARKET_LABELS[m] || m.toUpperCase()}
          </button>
        ))}
        <button className="brief-market-tab-add" title={t('contentAgent.addMarket') || '+ Mercado'}>+</button>
      </div>

      {/* Blocks */}
      <div className="brief-blocks">
        {BLOCK_KEYS.map(key => {
          const block = activeBlocks[key] || { status: 'pending', value: null };
          return (
            <div key={key} className={`brief-block ${block.status}`}>
              <div className="brief-block-header">
                <span className={`brief-block-label ${block.status}`}>{blockLabel(key)}</span>
                <span className={`brief-block-status ${block.status}`}>
                  {block.status === 'approved' && `✓ ${t('contentAgent.statusApproved') || 'aprobado'}`}
                  {block.status === 'generating' && `⏳ ${t('contentAgent.statusGenerating') || 'generando'}`}
                  {block.status === 'pending' && `— ${t('contentAgent.statusPending') || 'pendiente'}`}
                </span>
              </div>

              {block.status === 'approved' && block.value && (
                <>
                  {key === 'heroImage'
                    ? <img src={block.value} alt="Hero" className="brief-block-image-thumb" />
                    : <div className="brief-block-value">{block.value}</div>
                  }
                  <button
                    className="brief-block-edit-btn"
                    onClick={() => onBriefUpdate(activeMarket, key, { status: 'pending', value: null })}
                  >
                    {t('contentAgent.editBlock') || 'Editar'} ✏️
                  </button>
                </>
              )}

              {block.status === 'generating' && key === 'heroImage' && (
                <div style={{ height: 40, background: 'rgba(245,158,11,0.08)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: '#f59e0b', marginTop: 4 }}>
                  1200 × 628 px
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: progress + handoff */}
      <div className="brief-sidebar-footer">
        <div className="brief-progress-bar-wrap">
          <div className="brief-progress-label">
            <span>{t('contentAgent.globalProgress') || 'Progreso global'}</span>
            <span>{progressDetail}</span>
          </div>
          <div className="brief-progress-track">
            <div
              className="brief-progress-fill"
              style={{ width: `${totalBlocks > 0 ? (approvedBlocks / totalBlocks) * 100 : 0}%` }}
            />
          </div>
        </div>

        <button
          className="brief-handoff-btn"
          disabled={!isComplete}
          onClick={isComplete ? onHandoff : undefined}
        >
          {t('contentAgent.handoffButton') || 'Pasar a HTML Developer'} →
        </button>

        {!isComplete && (
          <div className="brief-handoff-hint">
            {t('contentAgent.handoffIncomplete') || 'Completa todos los bloques primero'}
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/agent-views/ContentBriefSidebar.jsx
git commit -m "feat(content-agent): add ContentBriefSidebar component"
```

---

## Task 4: ContentChatPanel component

**Files:**
- Create: `apps/dashboard/src/components/agent-views/ContentChatPanel.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { Send } from 'lucide-react';
import renderMarkdown from '../../utils/renderMarkdown.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Parse [BRIEF_UPDATE] events from SSE text chunks.
// Returns { textChunk, briefUpdates } where briefUpdates is array of { market, block, status, value }
function parseBriefUpdates(chunk) {
  const briefUpdates = [];
  // Format the agent emits: [BRIEF_UPDATE:{"market":"en","block":"subject","status":"approved","value":"..."}]
  const pattern = /\[BRIEF_UPDATE:(\{[^}]+\})\]/g;
  let match;
  while ((match = pattern.exec(chunk)) !== null) {
    try {
      briefUpdates.push(JSON.parse(match[1]));
    } catch (_) { /* malformed — skip */ }
  }
  const textChunk = chunk.replace(pattern, '').trim();
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

  // Load conversation history on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/agents/${agent.id}/conversation`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setMessages(Array.isArray(data.messages) ? data.messages : []);
      } catch (_) { /* network error — start fresh */ }
    })();
    return () => { cancelled = true; };
  }, [agent.id]);

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/agent-views/ContentChatPanel.jsx
git commit -m "feat(content-agent): add ContentChatPanel with SSE streaming and brief update parsing"
```

---

## Task 5: Wire split layout in ContentAgentView

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/ContentAgentView.jsx`

- [ ] **Step 1: Add imports at top of ContentAgentView.jsx (after existing imports)**

```jsx
import ContentChatPanel from './ContentChatPanel.jsx';
import ContentBriefSidebar from './ContentBriefSidebar.jsx';
```

- [ ] **Step 2: Add brief state and markets inside the component (after the existing `pipeline` const)**

Add after `const pipeline = useAgentPipelineSession(agent.id);`:

```jsx
const DEFAULT_MARKETS = ['en', 'es', 'ar'];
const emptyMarket = () => ({
  subject:   { status: 'pending', value: null },
  heroImage: { status: 'pending', value: null },
  bodyCopy:  { status: 'pending', value: null },
  cta:       { status: 'pending', value: null },
});

const [brief, setBrief] = useState(() =>
  Object.fromEntries(DEFAULT_MARKETS.map(m => [m, emptyMarket()]))
);
const [markets] = useState(DEFAULT_MARKETS);

const handleBriefUpdate = useCallback((market, block, blockState) => {
  setBrief(prev => ({
    ...prev,
    [market]: { ...prev[market], [block]: blockState },
  }));
}, []);

const handleContentHandoff = useCallback(() => {
  pipeline.setHandoffSession({
    id: pipeline.selectedTicket?.id || 'content-brief',
    stage_order: pipeline.currentSession?.stage_order,
    brief,
    markets,
  });
}, [pipeline, brief, markets]);
```

- [ ] **Step 3: Replace the chat tab JSX**

Find this block (around line 372):

```jsx
{activeTab === 'chat' && (
  <AgentChatSwitcher
    agent={agent}
    selectedTicket={pipeline.selectedTicket}
    pipelineData={pipeline.pipelineData}
    currentSession={pipeline.currentSession}
    completedSessions={pipeline.completedSessions}
    agents={pipeline.agents}
    onClearTicket={pipeline.clearTicket}
    onHandoffRequest={pipeline.setHandoffSession}
  />
)}
```

Replace with:

```jsx
{activeTab === 'chat' && (
  <div className="content-chat-split">
    <ContentChatPanel
      agent={agent}
      ticket={pipeline.selectedTicket}
      onBriefUpdate={handleBriefUpdate}
    />
    <ContentBriefSidebar
      brief={brief}
      markets={markets}
      onBriefUpdate={handleBriefUpdate}
      onHandoff={handleContentHandoff}
    />
  </div>
)}
```

- [ ] **Step 4: Add missing import for useCallback**

At the top of the file, the import line currently has `useState, useRef`. Add `useCallback`:

```jsx
import React, { useState, useRef, useCallback } from 'react';
```

- [ ] **Step 5: Verify HandoffModal still works**

The `HandoffModal` at the bottom of `ContentAgentView` uses `pipeline.handoffSession`. Our `handleContentHandoff` sets that via `pipeline.setHandoffSession(...)`. The modal's `session` prop will now contain `{ ..., brief, markets }` — the modal itself ignores unknown props and only uses `session.id` and `session.stage_order`, so no change needed there.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/agent-views/ContentAgentView.jsx
git commit -m "feat(content-agent): wire split chat+brief layout in ContentAgentView"
```

---

## Task 6: Backend — emit [BRIEF_UPDATE] SSE events from content agent

**Files:**
- Modify: `apps/dashboard/server.js`

The existing `/api/chat/agent/:agentId` endpoint streams text SSE chunks. We extend the system prompt for the content agent to instruct it to emit structured `[BRIEF_UPDATE:...]` tags inline with its response text.

- [ ] **Step 1: Find the system prompt construction in server.js**

The system prompt is built around line 2645. After line:
```js
const profile = getAgentProfile(agentId);
```

Add a helper that detects if this is a content agent:

```js
const isContentAgent = (agent.role || '').toLowerCase().includes('content')
  || (agent.name || '').toLowerCase().includes('content');
```

- [ ] **Step 2: Add content agent brief instructions to system prompt**

After line:
```js
${personality ? `## Personality\n${personality}\n` : ''}## Behavior Rules
```

Add a conditional block. Find the `systemPrompt` template literal and inside it, before `## Behavior Rules`, insert:

```js
${isContentAgent ? `## Brief Generation Protocol
When generating email content blocks (subject lines, hero images, body copy, CTA buttons), you MUST emit structured brief update tags inline with your response. Use this exact format for each block you generate:

[BRIEF_UPDATE:{"market":"en","block":"subject","status":"approved","value":"Your copy here"}]
[BRIEF_UPDATE:{"market":"es","block":"subject","status":"approved","value":"Tu copy aquí"}]
[BRIEF_UPDATE:{"market":"ar","block":"subject","status":"approved","value":"النص هنا"}]

For hero images, trigger generation via the image API — emit the update with status "generating" first, then "approved" once the URL is ready. Block names: subject, heroImage, bodyCopy, cta. Markets: en, es, ar. Always generate all three markets unless the user specifies otherwise.\n` : ''}
```

- [ ] **Step 3: Verify no syntax errors**

```bash
node --check apps/dashboard/server.js
```

Expected: no output (no errors).

- [ ] **Step 4: Restart the server and test**

```bash
npm start
```

Open the Content Agent → Chat tab, type: "Genera los subject lines para Qatar Airways reactivación en EN, ES y AR". Confirm that the response contains `[BRIEF_UPDATE:...]` tags and the Brief Sidebar blocks update in real time.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(server): extend content agent system prompt with brief update protocol"
```

---

## Task 7: Manual QA checklist

- [ ] Chat tab shows 2/3 + 1/3 split layout
- [ ] Market tabs EN / ES / AR render and switch correctly
- [ ] Blocks start as `pending` (—)
- [ ] After prompting for subject lines, blocks update to `approved` with values
- [ ] Inline card appears inside the chat bubble with ✓ / ↻ buttons per market
- [ ] Clicking ✓ in chat bubble confirms the brief block in sidebar
- [ ] Clicking ↻ pre-fills the input with a regenerate prompt
- [ ] Progress bar updates as blocks are approved
- [ ] Handoff button is disabled while blocks are pending
- [ ] Handoff button becomes active when all 12 blocks (3 markets × 4 blocks) are approved
- [ ] Clicking handoff opens HandoffModal
- [ ] Other ContentAgentView tabs (portfolio, images, ab, quality, activity, settings) are unaffected

---

## Self-Review

**Spec coverage:**
- ✓ Split 2/3 + 1/3 layout → Task 2 (CSS) + Task 5 (wiring)
- ✓ Tabs per market (EN/ES/AR) → Task 3 (ContentBriefSidebar)
- ✓ 4 blocks per tab with states → Task 3
- ✓ Inline cards in chat with ✓/↻ → Task 4 (ContentChatPanel)
- ✓ SSE `[BRIEF_UPDATE]` protocol → Task 4 (parser) + Task 6 (server)
- ✓ Progress bar → Task 3
- ✓ Handoff button → Task 3 + Task 5
- ✓ HandoffModal receives full brief → Task 5
- ✓ i18n keys → Task 1
- ✓ Pinecone/Gemini context → passed via existing RAG on the backend (no new code needed)

**No placeholders found.**

**Type consistency:** `onBriefUpdate(market, block, { status, value })` used consistently across Task 3, 4, 5. `brief` shape `{ [market]: { subject, heroImage, bodyCopy, cta } }` consistent across all tasks. `BLOCK_KEYS = ['subject', 'heroImage', 'bodyCopy', 'cta']` matches backend `block` values in Task 6.
