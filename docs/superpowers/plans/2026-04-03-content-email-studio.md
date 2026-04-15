# Content Studio & Email Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Content Studio (chat con Lucia) y Email Studio (HTML Developer) rutas full-screen propias sin sidebar, accesibles desde el banner "Working On" y desde un tab renombrado en la vista del agente.

**Architecture:** Dos nuevas páginas (`ContentStudioPage`, `EmailStudioPage`) se registran en el router fuera del wrapper `Layout` — igual que haría una página de login. Cada studio reutiliza los mismos sub-componentes que ya existen (`ContentChatPanel`, `ContentBriefSidebar`, `AgentChatSwitcher`, `EmailBuilderPreview`). Las vistas de agente existentes conservan todos sus tabs excepto que el tab "Chat"/"Builder" ahora navega al studio en lugar de renderizar inline.

**Tech Stack:** React 19, React Router 7, `useAgentPipelineSession` hook, CSS custom properties, i18n via `translations.js`

---

## File Map

| Action | File |
|--------|------|
| Create | `apps/dashboard/src/pages/ContentStudioPage.jsx` |
| Create | `apps/dashboard/src/pages/EmailStudioPage.jsx` |
| Modify | `apps/dashboard/src/main.jsx` — add 2 routes outside Layout |
| Modify | `apps/dashboard/src/i18n/translations.js` — add studio keys |
| Modify | `apps/dashboard/src/index.css` — add studio CSS classes |
| Modify | `apps/dashboard/src/components/agent-views/shared/ActiveTicketIndicator.jsx` — add optional `studioLabel`/`onOpenStudio` props |
| Modify | `apps/dashboard/src/components/agent-views/ContentAgentView.jsx` — rename tab, navigate to studio |
| Modify | `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` — rename tab, navigate to studio |

---

## Task 1: Add i18n keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add studio keys to both `es` and `en` sections**

Open `apps/dashboard/src/i18n/translations.js`. Find the `es: {` object and add before the closing brace of `es`:

```js
studio: {
  contentStudio: 'Content Studio',
  emailStudio: 'Email Studio',
  openContentStudio: 'Abrir Content Studio ↗',
  openEmailStudio: 'Abrir Email Studio ↗',
  backToAgent: '← Volver al agente',
  working: 'Working',
  building: 'Building',
  sendToHtmlDev: 'Send to HTML Developer →',
  exportHtml: '↓ Export HTML',
  chat: 'Chat',
  blockLibrary: 'Block Library',
  templates: 'Templates',
},
```

Then in the `en: {` object add:

```js
studio: {
  contentStudio: 'Content Studio',
  emailStudio: 'Email Studio',
  openContentStudio: 'Open Content Studio ↗',
  openEmailStudio: 'Open Email Studio ↗',
  backToAgent: '← Back to agent',
  working: 'Working',
  building: 'Building',
  sendToHtmlDev: 'Send to HTML Developer →',
  exportHtml: '↓ Export HTML',
  chat: 'Chat',
  blockLibrary: 'Block Library',
  templates: 'Templates',
},
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add studio translation keys"
```

---

## Task 2: Add studio CSS

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Add studio page CSS at the end of index.css**

```css
/* ── Studio Pages (Content Studio / Email Studio) ── */
.studio-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-main);
  overflow: hidden;
}

.studio-loading {
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

/* Top bar */
.studio-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  height: 52px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.studio-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s;
}
.studio-back-btn:hover { color: var(--text-main); }

.studio-campaign-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  padding: 3px 12px;
  white-space: nowrap;
}

.studio-status-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}
.studio-status-working { background: #d1fae5; color: #065f46; }
.studio-status-building { background: #fef2f2; color: #991b1b; }

.studio-topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.studio-action-secondary {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-main);
  cursor: pointer;
}

.studio-action-primary {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 6px;
  border: none;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
}
.studio-action-primary:hover { opacity: 0.9; }

/* Tab strip */
.studio-tabs-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.studio-tab {
  font-size: 12px;
  padding: 10px 14px;
  color: var(--text-muted);
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s;
}
.studio-tab:hover { color: var(--text-main); }
.studio-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
.studio-tab-count {
  font-size: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 0 6px;
}

/* Studio body */
.studio-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Content Studio — chat 2fr, brief 1fr */
.content-studio-split {
  display: grid;
  grid-template-columns: 2fr 1fr;
  height: 100%;
}

/* Email Studio — 50/50 */
.email-studio-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
}

/* Studio full-panel (for non-chat tabs) */
.studio-full-panel {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

/* ActiveTicketIndicator — studio action button */
.active-ticket-studio-btn {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  background: var(--primary-soft, rgba(99,102,241,0.1));
  color: var(--primary);
  transition: opacity 0.15s;
}
.active-ticket-studio-btn:hover { opacity: 0.8; }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(css): add studio page layout classes"
```

---

## Task 3: Update ActiveTicketIndicator — add optional studio button

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/shared/ActiveTicketIndicator.jsx`

- [ ] **Step 1: Add `studioLabel` and `onOpenStudio` optional props**

Replace the full file content with:

```jsx
import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import { Zap, X } from 'lucide-react';

export default function ActiveTicketIndicator({ selectedTicket, onClear, studioLabel, onOpenStudio }) {
    const { t } = useLanguage();

    if (!selectedTicket) return null;

    return (
        <div className="active-ticket-indicator animate-fade-in">
            <Zap size={14} />
            <span className="active-ticket-indicator-label">{t('tickets.working')}</span>
            <span className="active-ticket-indicator-project">
                {selectedTicket.project_name}
            </span>
            <span className="active-ticket-indicator-stage">
                [{selectedTicket.stage_order}] {selectedTicket.stage_name}
            </span>
            {studioLabel && onOpenStudio && (
                <button className="active-ticket-studio-btn" onClick={onOpenStudio}>
                    {studioLabel}
                </button>
            )}
            <button
                className="active-ticket-indicator-close"
                onClick={onClear}
                title={t('common.close')}
            >
                <X size={14} />
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/agent-views/shared/ActiveTicketIndicator.jsx
git commit -m "feat(ActiveTicketIndicator): add optional studio action button"
```

---

## Task 4: Update ContentAgentView — rename tab + navigate to studio

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/ContentAgentView.jsx`

- [ ] **Step 1: Add `useNavigate` import**

At line 1, the existing import is:
```jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
```

Add after the React import line:
```jsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Initialize `navigate` inside the component**

At line 33 (after `export default function ContentAgentView...`), add:
```jsx
const navigate = useNavigate();
```

- [ ] **Step 3: Replace the chat tab definition (line 137)**

Find:
```jsx
  { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
```

Replace with:
```jsx
  { id: 'chat', label: t('studio.contentStudio'), icon: AgentTabIcons.chat, isStudio: true },
```

- [ ] **Step 4: Update tab onClick to navigate for studio tabs (line 200)**

Find:
```jsx
          <button key={tab.id} className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
```

Replace with:
```jsx
          <button
            key={tab.id}
            className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              if (tab.isStudio) {
                const ticketId = pipeline.selectedTicket?.id;
                navigate(`/app/workspace/agent/content-agent/studio${ticketId ? `?ticketId=${ticketId}` : ''}`);
              } else {
                setActiveTab(tab.id);
              }
            }}
          >
```

- [ ] **Step 5: Update `handleWorkOnTicket` to navigate to studio (line 101)**

Find:
```jsx
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
```

Replace with:
```jsx
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    navigate(`/app/workspace/agent/content-agent/studio?ticketId=${ticket.id}`);
  };
```

- [ ] **Step 6: Update ActiveTicketIndicator to pass studio props (line 195)**

Find:
```jsx
      <ActiveTicketIndicator selectedTicket={pipeline.selectedTicket} onClear={pipeline.clearTicket} />
```

Replace with:
```jsx
      <ActiveTicketIndicator
        selectedTicket={pipeline.selectedTicket}
        onClear={pipeline.clearTicket}
        studioLabel={t('studio.openContentStudio')}
        onOpenStudio={() => navigate(`/app/workspace/agent/content-agent/studio${pipeline.selectedTicket ? `?ticketId=${pipeline.selectedTicket.id}` : ''}`)}
      />
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/components/agent-views/ContentAgentView.jsx
git commit -m "feat(ContentAgentView): rename Chat tab to Content Studio, navigate to studio route"
```

---

## Task 5: Update HtmlDeveloperView — rename tab + navigate to studio

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx`

- [ ] **Step 1: Add `useNavigate` import**

After the existing React import, add:
```jsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Initialize `navigate` inside the component**

Find the component declaration and add `const navigate = useNavigate();` as the first line inside it.

- [ ] **Step 3: Find builder tab definition (line ~91)**

Find (exact text may include translation):
```jsx
  { id: 'builder', label: t('emailBuilder.tabBuilder') || 'Email Builder', icon: '✉️' },
```

Replace with:
```jsx
  { id: 'builder', label: t('studio.emailStudio'), icon: '✉️', isStudio: true },
```

- [ ] **Step 4: Update tab onClick (same pattern — find the tab button render)**

Find the tab `<button>` in the `agent-tabs` div. It will look like:
```jsx
onClick={() => setActiveTab(tab.id)}
```

Replace with:
```jsx
onClick={() => {
  if (tab.isStudio) {
    const ticketId = pipeline.selectedTicket?.id;
    navigate(`/app/workspace/agent/html-developer/studio${ticketId ? `?ticketId=${ticketId}` : ''}`);
  } else {
    setActiveTab(tab.id);
  }
}}
```

- [ ] **Step 5: Find `handleWorkOnTicket` in HtmlDeveloperView**

Find (look for where `setActiveTab('builder')` or `setActiveTab('chat')` is called in response to a ticket selection):
```jsx
setActiveTab('builder');
```

Replace that line with:
```jsx
navigate(`/app/workspace/agent/html-developer/studio?ticketId=${ticket.id}`);
```

- [ ] **Step 6: Update ActiveTicketIndicator with studio props**

Find:
```jsx
      <ActiveTicketIndicator selectedTicket={pipeline.selectedTicket} onClear={pipeline.clearTicket} />
```

Replace with:
```jsx
      <ActiveTicketIndicator
        selectedTicket={pipeline.selectedTicket}
        onClear={pipeline.clearTicket}
        studioLabel={t('studio.openEmailStudio')}
        onOpenStudio={() => navigate(`/app/workspace/agent/html-developer/studio${pipeline.selectedTicket ? `?ticketId=${pipeline.selectedTicket.id}` : ''}`)}
      />
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx
git commit -m "feat(HtmlDeveloperView): rename Builder tab to Email Studio, navigate to studio route"
```

---

## Task 6: Create ContentStudioPage.jsx

**Files:**
- Create: `apps/dashboard/src/pages/ContentStudioPage.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import ContentChatPanel from '../components/agent-views/ContentChatPanel.jsx';
import ContentBriefSidebar from '../components/agent-views/ContentBriefSidebar.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'content-agent';
const ALL_MARKETS = ['en', 'es', 'ar', 'ru'];
const AVAILABLE_TIERS = ['economy', 'economy_premium', 'business', 'first_class'];

const emptyVariant = () => ({
  subject:      { status: 'pending', value: null },
  preheader:    { status: 'pending', value: null },
  heroHeadline: { status: 'pending', value: null },
  bodyCopy:     { status: 'pending', value: null },
  cta:          { status: 'pending', value: null },
});

export default function ContentStudioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');

  // Variants state
  const [variants, setVariants] = useState({});
  const [activeVariant, setActiveVariant] = useState(null);
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);
  const [chatImages, setChatImages] = useState([]);

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent data
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Pre-select ticket from URL param
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const ticket = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (ticket) pipeline.selectTicket(ticket);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  // Reset variants when ticket changes
  useEffect(() => {
    const raw = pipeline.selectedTicket?.project_markets
      || pipeline.selectedTicket?.metadata?.markets
      || ALL_MARKETS;
    const arr = Array.isArray(raw) ? raw : ALL_MARKETS;
    const validCodes = new Set(ALL_MARKETS);
    const resolved = arr.every(m => validCodes.has(m)) ? arr : ALL_MARKETS;
    setAvailableMarkets(resolved);
    setVariants({});
    setActiveVariant(null);
  }, [pipeline.selectedTicket?.id]);

  const handleBriefUpdate = useCallback(({ variant, block, status, value }) => {
    setVariants(prev => ({
      ...prev,
      [variant]: {
        ...(prev[variant] || emptyVariant()),
        [block]: { status, value },
      },
    }));
  }, []);

  const addVariant = useCallback((market, tier) => {
    const key = `${market}:${tier}`;
    setVariants(prev => prev[key] ? prev : { ...prev, [key]: emptyVariant() });
    setActiveVariant(key);
  }, []);

  const handleContentHandoff = useCallback(() => {
    pipeline.setHandoffSession({
      id: pipeline.selectedTicket?.id || 'content-brief',
      stage_order: pipeline.currentSession?.stage_order,
      variants,
      activeVariant,
    });
  }, [pipeline, variants, activeVariant]);

  const handleChatImage = useCallback(({ url, prompt }) => {
    const newImage = {
      id: `chat-img-${Date.now()}`,
      url, prompt,
      size: '1200x628',
      status: 'review',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      campaign: pipeline.selectedTicket?.project_name || 'Chat Generation',
      source: 'chat',
    };
    setChatImages(prev => [...prev, newImage]);
  }, [pipeline.selectedTicket?.project_name]);

  const tabs = [
    { id: 'chat',    label: t('studio.chat') },
    { id: 'tickets', label: t('tickets.tab'), count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'images',  label: 'Image Studio' },
    { id: 'ab',      label: 'A/B Testing' },
    { id: 'quality', label: 'Quality Score' },
  ];

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/content-agent')}>
          {t('studio.backToAgent')}
        </button>
        {pipeline.selectedTicket && (
          <span className="studio-campaign-badge">{pipeline.selectedTicket.project_name}</span>
        )}
        <span className="studio-status-chip studio-status-working">● {t('studio.working')}</span>
        <div className="studio-topbar-actions">
          <button className="studio-action-primary" onClick={handleContentHandoff}>
            {t('studio.sendToHtmlDev')}
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`studio-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`studio-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="studio-body">
        {activeTab === 'chat' && (
          <div className="content-studio-split">
            <ContentChatPanel
              agent={agent}
              ticket={pipeline.selectedTicket}
              completedSessions={pipeline.completedSessions}
              activeVariant={activeVariant}
              onBriefUpdate={handleBriefUpdate}
              onImageGenerated={handleChatImage}
            />
            <ContentBriefSidebar
              variants={variants}
              activeVariant={activeVariant}
              availableMarkets={availableMarkets}
              availableTiers={AVAILABLE_TIERS}
              onAddVariant={addVariant}
              onSelectVariant={setActiveVariant}
              onBriefUpdate={handleBriefUpdate}
              onHandoff={handleContentHandoff}
              chatImages={chatImages}
            />
          </div>
        )}
        {activeTab === 'tickets' && (
          <div className="studio-full-panel">
            <AgentTicketsPanel
              tickets={pipeline.tickets}
              selectedTicket={pipeline.selectedTicket}
              onSelectTicket={pipeline.selectTicket}
              onClearTicket={pipeline.clearTicket}
              agentId={AGENT_ID}
            />
          </div>
        )}
        {(activeTab === 'images' || activeTab === 'ab' || activeTab === 'quality') && (
          <div className="studio-full-panel" style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 60 }}>
            {/* These tabs share state with ContentAgentView — open the agent view to access them */}
            <p>Abre la vista del agente para acceder a este panel.</p>
            <button className="studio-back-btn" style={{ margin: '12px auto' }} onClick={() => navigate('/app/workspace/agent/content-agent')}>
              {t('studio.backToAgent')}
            </button>
          </div>
        )}
      </div>

      {pipeline.handoffSession && (
        <HandoffModal
          projectId={pipeline.selectedTicket?.project_id}
          session={pipeline.handoffSession}
          onClose={() => pipeline.setHandoffSession(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/ContentStudioPage.jsx
git commit -m "feat: add ContentStudioPage full-screen route"
```

---

## Task 7: Create EmailStudioPage.jsx

**Files:**
- Create: `apps/dashboard/src/pages/EmailStudioPage.jsx`

- [ ] **Step 1: Check how AgentChatSwitcher is invoked in HtmlDeveloperView (lines 362-401) to copy the exact props**

Read `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` lines 360-410 to get the exact prop signatures for `AgentChatSwitcher` and `EmailBuilderPreview`. Use those exact props in the studio page.

- [ ] **Step 2: Create the file**

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import AgentChatSwitcher from '../components/agent-views/shared/AgentChatSwitcher.jsx';
import EmailBuilderPreview from '../components/EmailBuilderPreview.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'html-developer';

export default function EmailStudioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');

  // Builder state
  const [builderHtml, setBuilderHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [chatInput, setChatInput] = useState('');

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent data
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Pre-select ticket from URL param
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const ticket = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (ticket) pipeline.selectTicket(ticket);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  const tabs = [
    { id: 'chat',      label: t('studio.chat') },
    { id: 'blocks',    label: t('studio.blockLibrary') },
    { id: 'templates', label: t('studio.templates') },
    { id: 'tickets',   label: t('tickets.tab'), count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
  ];

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
          {t('studio.backToAgent')}
        </button>
        {pipeline.selectedTicket && (
          <span className="studio-campaign-badge">{pipeline.selectedTicket.project_name}</span>
        )}
        <span className="studio-status-chip studio-status-building">● {t('studio.building')}</span>
        <div className="studio-topbar-actions">
          <button className="studio-action-primary" onClick={() => {
            if (!builderHtml) return;
            const blob = new Blob([builderHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'email.html';
            a.click();
            URL.revokeObjectURL(url);
          }}>
            {t('studio.exportHtml')}
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`studio-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`studio-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="studio-body">
        {activeTab === 'chat' && (
          <div className="email-studio-split">
            <AgentChatSwitcher
              agent={agent}
              selectedTicket={pipeline.selectedTicket}
              pipelineData={pipeline.pipelineData}
              currentSession={pipeline.currentSession}
              completedSessions={pipeline.completedSessions}
              agents={pipeline.agents}
              onClearTicket={pipeline.clearTicket}
              onHandoffRequest={pipeline.setHandoffSession}
              externalInput={chatInput}
              onExternalInputConsumed={() => setChatInput('')}
              onHtmlGenerated={(html) => {
                setBuilderHtml(html);
                setPatchedBlock(null);
                setBuilderStatus('Email generado');
                setTimeout(() => setBuilderStatus(''), 3000);
              }}
              onHtmlPatched={(blockName, html) => {
                setBuilderHtml(html);
                setPatchedBlock(blockName);
                setBuilderStatus(`${blockName} actualizado`);
                setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
              }}
              onHtmlBlock={(block) => {
                setBuilderHtml(prev => prev + block.htmlSource);
                setBuilderStatus(`${block.title} añadido`);
                setTimeout(() => setBuilderStatus(''), 3000);
              }}
            />
            <EmailBuilderPreview
              html={builderHtml}
              patchedBlock={patchedBlock}
              statusMessage={builderStatus}
              onBlockClick={(blockName) => setChatInput(`[bloque: ${blockName}] `)}
            />
          </div>
        )}
        {activeTab === 'tickets' && (
          <div className="studio-full-panel">
            <AgentTicketsPanel
              tickets={pipeline.tickets}
              selectedTicket={pipeline.selectedTicket}
              onSelectTicket={pipeline.selectTicket}
              onClearTicket={pipeline.clearTicket}
              agentId={AGENT_ID}
            />
          </div>
        )}
        {(activeTab === 'blocks' || activeTab === 'templates') && (
          <div className="studio-full-panel" style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 60 }}>
            <p>Abre la vista del agente para acceder a este panel.</p>
            <button className="studio-back-btn" style={{ margin: '12px auto' }} onClick={() => navigate('/app/workspace/agent/html-developer')}>
              {t('studio.backToAgent')}
            </button>
          </div>
        )}
      </div>

      {pipeline.handoffSession && (
        <HandoffModal
          projectId={pipeline.selectedTicket?.project_id}
          session={pipeline.handoffSession}
          onClose={() => pipeline.setHandoffSession(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/EmailStudioPage.jsx
git commit -m "feat: add EmailStudioPage full-screen route"
```

---

## Task 8: Register routes in main.jsx

**Files:**
- Modify: `apps/dashboard/src/main.jsx`

- [ ] **Step 1: Add imports at the top of main.jsx**

After the existing page imports, add:
```jsx
import ContentStudioPage from './pages/ContentStudioPage.jsx';
import EmailStudioPage from './pages/EmailStudioPage.jsx';
```

- [ ] **Step 2: Add routes outside Layout, inside AuthGate**

Find the closing `</Route>` of the Layout wrapper (line 120):
```jsx
                    </Route>
                  </Routes>
```

Add two new routes between `</Route>` (Layout close) and `</Routes>` (inner Routes close):

```jsx
                    </Route>
                    {/* Studio routes — full-screen, no sidebar */}
                    <Route path="/workspace/agent/content-agent/studio" element={<ContentStudioPage />} />
                    <Route path="/workspace/agent/html-developer/studio" element={<EmailStudioPage />} />
                  </Routes>
```

- [ ] **Step 3: Verify — start the dev server and check**

```bash
npm start
```

Navigate to:
1. `/app/workspace/agent/content-agent` → should see "Content Studio ↗" tab
2. Click the tab → should navigate to `/app/workspace/agent/content-agent/studio` with no sidebar
3. `/app/workspace/agent/html-developer` → should see "Email Studio ↗" tab
4. Working On banner should show "Open Content Studio ↗" / "Open Email Studio ↗" buttons when a ticket is active

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/main.jsx
git commit -m "feat: register ContentStudioPage and EmailStudioPage routes outside Layout"
```

---

## Verification Checklist

- [ ] Content Agent view: tab labeled "Content Studio ↗" — clicking navigates to full-screen studio
- [ ] Content Agent view: Working On banner shows "Open Content Studio ↗" button when ticket active
- [ ] Content Studio URL: `/app/workspace/agent/content-agent/studio?ticketId=N` — no sidebar visible
- [ ] Content Studio: "← Back to agent" returns to `/app/workspace/agent/content-agent`
- [ ] Content Studio: Chat tab shows ContentChatPanel (2fr) + ContentBriefSidebar (1fr) filling full height
- [ ] Content Studio: Tickets tab shows AgentTicketsPanel
- [ ] HTML Developer view: tab labeled "Email Studio ↗" — clicking navigates to full-screen studio
- [ ] HTML Developer view: Working On banner shows "Open Email Studio ↗" button when ticket active
- [ ] Email Studio URL: `/app/workspace/agent/html-developer/studio?ticketId=N` — no sidebar visible
- [ ] Email Studio: Chat tab shows AgentChatSwitcher (1fr) + EmailBuilderPreview (1fr) — 50/50 split
- [ ] Email Studio: HTML generation from chat updates preview in real time
- [ ] Email Studio: Export HTML button downloads the file
- [ ] Both studios: HandoffModal works when handoff is triggered
- [ ] Both studios: i18n works — switching ES/EN updates all labels
