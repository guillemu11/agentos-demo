# Campaign Creation V2 · Briefs-First Flow · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear 3-step wizard at `/app/campaign-creation-v2` with a briefs-first hub: conversational setup chat, AI-suggested opportunity briefs, content studio with 3 options, dashboard + BAU calendar tabs, and an auto-filled handoff to the existing wizard.

**Architecture:** Single page with 3 tabs (Briefs / Overview / Calendar). A new `campaign_briefs` table (PostgreSQL/Railway) is the central artifact. Briefs are created via conversational chat (Claude tool-use, voice+text) or generated proactively by AI from a mock signals catalog. Accepted content options hand off to the existing wizard which is refactored to accept an `initialBrief` prop.

**Tech Stack:** React 19 + React Router 7 + Vite 7 (frontend), Express 5 + `pg` pool (backend), PostgreSQL 16 on Railway, Anthropic SDK (`claude-sonnet-4-6`) with tool-use, CSS custom properties (no Tailwind), i18n via `translations.js`, existing `useVoice.js` hook.

**Tests:** No global test framework installed. Backend logic is exercised via curl-based smoke scripts committed alongside each phase. Frontend components are validated by manual browser checks (documented per task). Where unit logic matters (extractor parsing, signal picker, autofill mapping), write tiny pure-JS modules and add a focused `node --test` file under `apps/dashboard/__tests__/`.

---

## File Structure

**New files (frontend):**
- `apps/dashboard/src/pages/CampaignCreationV2/index.jsx` — shell with tabs (replaces current `CampaignCreationV2Page.jsx`)
- `apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/OverviewDashboard.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/CampaignsCalendar.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/SetupChatView.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/ContentOptionsChat.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx` — extracted from current file
- `apps/dashboard/src/pages/CampaignCreationV2/components/BriefCard.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/components/BriefLivePanel.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/components/OptionCard.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/components/OptionPreviewModal.jsx`
- `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css`
- `apps/dashboard/src/pages/CampaignCreationV2/lib/briefAutofill.js` — pure mapping brief→wizard state
- `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js` — fetch wrappers

**New files (backend / data):**
- `apps/dashboard/migrations/202604220001_campaign-briefs.sql`
- `apps/dashboard/src/data/mockSignals.js`
- `apps/dashboard/server/briefs/` — helper modules only (no router — endpoints live inline in server.js per project rule 5)
  - `apps/dashboard/server/briefs/chatTurn.js` — Claude tool-use for setup chat
  - `apps/dashboard/server/briefs/generateOptions.js` — Claude for 3 content options
  - `apps/dashboard/server/briefs/generateOpportunities.js` — mock signals → Claude reasoning
- `apps/dashboard/__tests__/briefAutofill.test.js` — pure fn tests
- `apps/dashboard/__tests__/signalPicker.test.js` — pure fn tests
- `scripts/smoke-briefs.sh` — curl smoke script

**Modified files:**
- `apps/dashboard/src/main.jsx` — route now renders new index
- `apps/dashboard/src/components/Layout.jsx` — nav label unchanged
- `apps/dashboard/server.js` — mount `briefs/router.js`
- `apps/dashboard/src/i18n/translations.js` — new `briefs.*` namespaces (ES + EN)
- `packages/core/db/schema.sql` — mirror the new table
- `apps/dashboard/src/index.css` — add `--color-ai: #a78bfa` token

---

## Phases Overview

1. **DB + API skeleton** — migration, empty endpoints returning real rows
2. **Briefs Board + Detail Modal** — read-only UI against the API
3. **Setup Chat + Live Panel** — Claude tool-use, creates human briefs end-to-end
4. **Content Options + Modal Preview** — 3-option generation + accept flow
5. **AI Opportunities** — mock signals + regenerate + Activate/Refine/Dismiss
6. **Overview Dashboard + Calendar tabs**
7. **Wizard refactor** — extract + accept `initialBrief`, banner, purple borders, template lock
8. **i18n + polish + smoke**

---

## Phase 1 · DB Migration + API Skeleton

### Task 1.1: Create migration file

**Files:**
- Create: `apps/dashboard/migrations/2026-04-22-campaign-briefs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Campaign briefs — central artifact for the conversational campaign creation flow.
-- A brief is either human-created (via chat) or AI-suggested (from mock signals).

CREATE TABLE IF NOT EXISTS campaign_briefs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       INTEGER REFERENCES workspace_users(id) ON DELETE SET NULL,

  source           TEXT NOT NULL CHECK (source IN ('human','ai')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','in_wizard','sent','dismissed')),

  name             TEXT,
  objective        TEXT,
  send_date        TIMESTAMPTZ,
  template_id      TEXT,
  markets          JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants_plan    JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_summary TEXT,

  opportunity_reason   TEXT,
  opportunity_signals  JSONB,
  preview_image_url    TEXT,

  chat_transcript  JSONB NOT NULL DEFAULT '[]'::jsonb,
  accepted_option  JSONB,
  campaign_id      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefs_status     ON campaign_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_source     ON campaign_briefs(source);
CREATE INDEX IF NOT EXISTS idx_briefs_created_by ON campaign_briefs(created_by);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_briefs_touch ON campaign_briefs;
CREATE TRIGGER campaign_briefs_touch
  BEFORE UPDATE ON campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

- [ ] **Step 2: Apply migration against Railway**

Run: `psql "$DATABASE_URL" -f apps/dashboard/migrations/2026-04-22-campaign-briefs.sql`

Expected: `CREATE TABLE`, 3× `CREATE INDEX`, `CREATE FUNCTION`, `CREATE TRIGGER` messages, no errors.

- [ ] **Step 3: Verify table exists**

Run: `psql "$DATABASE_URL" -c "\d campaign_briefs"`
Expected: column list matching the schema above.

- [ ] **Step 4: Mirror in schema.sql**

Append the same `CREATE TABLE campaign_briefs` block (without `CREATE OR REPLACE FUNCTION` if already defined elsewhere) to `packages/core/db/schema.sql`.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/migrations/2026-04-22-campaign-briefs.sql packages/core/db/schema.sql
git commit -m "feat(briefs): campaign_briefs table migration"
```

### Task 1.2: Create briefs router skeleton

**Files:**
- Create: `apps/dashboard/server/briefs/router.js`
- Modify: `apps/dashboard/server.js` (mount router)

- [ ] **Step 1: Write the router with all 8 endpoints returning stubs**

```js
// apps/dashboard/server/briefs/router.js
import express from 'express';

export function createBriefsRouter({ pool, requireAuth }) {
  const router = express.Router();

  // GET /api/campaign-briefs?source=human|ai&status=draft,active
  router.get('/', requireAuth, async (req, res) => {
    const { source, status } = req.query;
    const clauses = [];
    const params = [];
    if (source) { params.push(source); clauses.push(`source = $${params.length}`); }
    if (status) {
      const list = String(status).split(',');
      params.push(list);
      clauses.push(`status = ANY($${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM campaign_briefs ${where} ORDER BY created_at DESC`,
      params,
    );
    res.json({ briefs: rows });
  });

  // POST /api/campaign-briefs — create empty draft (human)
  router.post('/', requireAuth, async (req, res) => {
    const userId = req.session?.user?.id || null;
    const { rows } = await pool.query(
      `INSERT INTO campaign_briefs (created_by, source, status)
       VALUES ($1, 'human', 'draft') RETURNING *`,
      [userId],
    );
    res.json({ brief: rows[0] });
  });

  // PATCH /api/campaign-briefs/:id
  router.patch('/:id', requireAuth, async (req, res) => {
    const allowed = ['name','objective','send_date','template_id','markets','languages',
                     'variants_plan','audience_summary','status','accepted_option','campaign_id'];
    const updates = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key]);
        updates.push(`${key} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'no fields to update' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE campaign_briefs SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json({ brief: rows[0] });
  });

  // Stubs — filled in later phases
  router.post('/:id/chat/turn', requireAuth, (req, res) => {
    res.status(501).json({ error: 'not implemented — phase 3' });
  });
  router.post('/:id/options/generate', requireAuth, (req, res) => {
    res.status(501).json({ error: 'not implemented — phase 4' });
  });
  router.post('/:id/options/accept', requireAuth, (req, res) => {
    res.status(501).json({ error: 'not implemented — phase 4' });
  });
  router.post('/:id/dismiss', requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE campaign_briefs SET status = 'dismissed' WHERE id = $1 AND source = 'ai' RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found or not AI' });
    res.json({ brief: rows[0] });
  });
  router.post('/ai-opportunities/regenerate', requireAuth, (req, res) => {
    res.status(501).json({ error: 'not implemented — phase 5' });
  });

  return router;
}
```

- [ ] **Step 2: Mount the router in server.js**

Find a spot near other `/api/*` mounts in `apps/dashboard/server.js` and add:

```js
import { createBriefsRouter } from './server/briefs/router.js';
// ... after `requireAuth` and `pool` are defined:
app.use('/api/campaign-briefs', createBriefsRouter({ pool, requireAuth }));
```

- [ ] **Step 3: Start the server**

Run: `npm run kill-ports && npm start`
Expected: Vite 4000 + Express 3002 up, no errors in console.

- [ ] **Step 4: Smoke test the endpoints with curl**

Log in via browser once to get a session cookie, export it, then:

```bash
curl -s -b cookies.txt http://localhost:3002/api/campaign-briefs | jq
# → {"briefs":[]}

curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs | jq
# → {"brief":{"id":"...","source":"human","status":"draft",...}}

BRIEF_ID=$(curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs | jq -r .brief.id)
curl -s -b cookies.txt -X PATCH http://localhost:3002/api/campaign-briefs/$BRIEF_ID \
  -H 'content-type: application/json' \
  -d '{"name":"Test brief","markets":["FR"]}' | jq
# → brief with name and markets populated
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/server/briefs/router.js apps/dashboard/server.js
git commit -m "feat(briefs): Express router skeleton for /api/campaign-briefs"
```

---

## Phase 2 · Briefs Board + Detail Modal

### Task 2.1: Scaffold the new page shell

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/index.jsx`
- Create: `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css`
- Modify: `apps/dashboard/src/main.jsx`

- [ ] **Step 1: Write the shell with tabs driven by query param**

```jsx
// apps/dashboard/src/pages/CampaignCreationV2/index.jsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import BriefsBoard from './BriefsBoard.jsx';
import OverviewDashboard from './OverviewDashboard.jsx';
import CampaignsCalendar from './CampaignsCalendar.jsx';
import SetupChatView from './SetupChatView.jsx';
import ContentOptionsChat from './ContentOptionsChat.jsx';
import CampaignWizard from './CampaignWizard.jsx';
import './campaign-creation-v2.css';

const TABS = [
  { id: 'briefs',   label: 'Briefs'   },
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
];

export default function CampaignCreationV2Page() {
  const [params, setParams] = useSearchParams();
  const briefId = params.get('briefId');
  const mode    = params.get('mode');   // 'setup' | 'options' | 'wizard'
  const tab     = params.get('tab') || 'briefs';

  if (briefId && mode === 'setup')   return <SetupChatView     briefId={briefId} />;
  if (briefId && mode === 'options') return <ContentOptionsChat briefId={briefId} />;
  if (briefId && mode === 'wizard')  return <CampaignWizard     briefId={briefId} />;

  return (
    <div className="cc2-shell">
      <header className="cc2-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cc2-tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setParams({ tab: t.id })}
          >{t.label}</button>
        ))}
      </header>
      <main className="cc2-main">
        {tab === 'briefs'   && <BriefsBoard />}
        {tab === 'overview' && <OverviewDashboard />}
        {tab === 'calendar' && <CampaignsCalendar />}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS**

```css
/* apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css */
.cc2-shell { display: flex; flex-direction: column; height: 100%; }

.cc2-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding: 0 24px; }

.cc2-tab {
  background: transparent; border: 0; padding: 14px 18px; color: var(--text-muted);
  font-size: 14px; cursor: pointer; border-bottom: 2px solid transparent;
}
.cc2-tab.is-active { color: var(--text); border-bottom-color: var(--accent); }
.cc2-tab:hover:not(.is-active) { color: var(--text); }

.cc2-main { flex: 1; overflow: auto; padding: 24px; }

/* Board */
.cc2-board { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; height: 100%; }
.cc2-column { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; overflow: auto; }
.cc2-column-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.cc2-column-title { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
.cc2-column-title.human { color: var(--info); }
.cc2-column-title.ai    { color: var(--color-ai, #a78bfa); }

.cc2-empty {
  border: 1px dashed var(--border); border-radius: 10px; padding: 32px;
  text-align: center; color: var(--text-muted); font-size: 13px;
}
```

- [ ] **Step 3: Create placeholder child components**

Create these 3 files with minimal content so imports resolve:

```jsx
// BriefsBoard.jsx
import React from 'react';
export default function BriefsBoard() { return <div className="cc2-empty">Briefs board — WIP</div>; }

// OverviewDashboard.jsx
import React from 'react';
export default function OverviewDashboard() { return <div className="cc2-empty">Overview — WIP</div>; }

// CampaignsCalendar.jsx
import React from 'react';
export default function CampaignsCalendar() { return <div className="cc2-empty">Calendar — WIP</div>; }

// SetupChatView.jsx
import React from 'react';
export default function SetupChatView({ briefId }) { return <div>Setup chat for {briefId} — WIP</div>; }

// ContentOptionsChat.jsx
import React from 'react';
export default function ContentOptionsChat({ briefId }) { return <div>Options for {briefId} — WIP</div>; }

// CampaignWizard.jsx
import React from 'react';
export default function CampaignWizard({ briefId }) { return <div>Wizard for {briefId} — WIP</div>; }
```

- [ ] **Step 4: Update route in main.jsx**

Replace the import/route for `CampaignCreationV2Page` so it loads `./pages/CampaignCreationV2/index.jsx` instead of the old `./pages/CampaignCreationV2Page.jsx`. Keep the old file around for now (we'll port its wizard in phase 7).

- [ ] **Step 5: Browser check**

Open http://localhost:4000/app/campaign-creation-v2. Expected: 3 tabs (Briefs active), placeholder text. Click each tab, query param updates.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2 apps/dashboard/src/main.jsx
git commit -m "feat(cc2): page shell with Briefs/Overview/Calendar tabs"
```

### Task 2.2: briefsApi client helper

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js`

- [ ] **Step 1: Write the fetch wrappers**

```js
// apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js
const API = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}/campaign-briefs${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export const briefsApi = {
  list:     (q = '')           => request(`?${q}`),
  create:   ()                  => request('',               { method: 'POST' }),
  patch:    (id, patch)         => request(`/${id}`,          { method: 'PATCH', body: JSON.stringify(patch) }),
  chatTurn: (id, message)       => request(`/${id}/chat/turn`,{ method: 'POST', body: JSON.stringify({ message }) }),
  genOptions:(id)               => request(`/${id}/options/generate`, { method: 'POST' }),
  accept:   (id, optionIndex)   => request(`/${id}/options/accept`,    { method: 'POST', body: JSON.stringify({ optionIndex }) }),
  dismiss:  (id)                => request(`/${id}/dismiss`,  { method: 'POST' }),
  regenerateOpportunities: ()   => request('/ai-opportunities/regenerate', { method: 'POST' }),
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/lib/briefsApi.js
git commit -m "feat(cc2): briefsApi client helper"
```

### Task 2.3: BriefCard component

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefCard.jsx`
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css` (append)

- [ ] **Step 1: Write the component**

```jsx
// apps/dashboard/src/pages/CampaignCreationV2/components/BriefCard.jsx
import React from 'react';
import { Sparkles, User, Clock, Globe } from 'lucide-react';

const STATUS_LABELS = {
  draft: 'Draft', active: 'Active', in_wizard: 'In wizard',
  sent: 'Sent',  dismissed: 'Dismissed',
};

export default function BriefCard({ brief, onClick }) {
  const isAi = brief.source === 'ai';
  const markets = Array.isArray(brief.markets) ? brief.markets : [];
  return (
    <button className={`cc2-brief-card ${isAi ? 'is-ai' : 'is-human'}`} onClick={onClick}>
      <div className="cc2-brief-card__header">
        {isAi
          ? <span className="cc2-brief-card__badge ai"><Sparkles size={12} /> AI OPPORTUNITY</span>
          : <span className="cc2-brief-card__badge human"><User size={12} /> HUMAN</span>}
        <span className="cc2-brief-card__status">{STATUS_LABELS[brief.status] || brief.status}</span>
      </div>
      <h3 className="cc2-brief-card__title">{brief.name || '(untitled)'}</h3>
      {isAi && brief.opportunity_reason && (
        <p className="cc2-brief-card__reason">{brief.opportunity_reason}</p>
      )}
      <div className="cc2-brief-card__meta">
        {brief.send_date && (
          <span><Clock size={12} /> {new Date(brief.send_date).toLocaleDateString()}</span>
        )}
        {markets.length > 0 && (
          <span><Globe size={12} /> {markets.join(', ')}</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Append card styles to CSS**

```css
.cc2-brief-card {
  width: 100%; text-align: left; background: var(--surface-2, #0f1419);
  border: 1px solid var(--border); border-radius: 10px; padding: 12px;
  margin-bottom: 8px; cursor: pointer; color: var(--text); font-family: inherit;
}
.cc2-brief-card.is-ai { border-color: color-mix(in srgb, var(--color-ai, #a78bfa) 30%, transparent); }
.cc2-brief-card:hover { border-color: var(--accent); }

.cc2-brief-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 10px; }
.cc2-brief-card__badge { display: inline-flex; gap: 4px; align-items: center; font-weight: 700; letter-spacing: 0.04em; }
.cc2-brief-card__badge.ai    { color: var(--color-ai, #a78bfa); }
.cc2-brief-card__badge.human { color: var(--info); }
.cc2-brief-card__status { color: var(--text-muted); text-transform: uppercase; }

.cc2-brief-card__title { margin: 0 0 6px 0; font-size: 14px; font-weight: 600; }
.cc2-brief-card__reason { margin: 0 0 8px 0; font-size: 12px; color: var(--text-muted); line-height: 1.4; }
.cc2-brief-card__meta { display: flex; gap: 10px; font-size: 11px; color: var(--text-muted); }
.cc2-brief-card__meta span { display: inline-flex; gap: 4px; align-items: center; }
```

Also ensure `--color-ai: #a78bfa;` is defined in `apps/dashboard/src/index.css` under `:root`.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefCard.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css \
        apps/dashboard/src/index.css
git commit -m "feat(cc2): BriefCard component"
```

### Task 2.4: BriefsBoard with real data

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx`

- [ ] **Step 1: Replace the stub with the full implementation**

```jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import BriefCard from './components/BriefCard.jsx';
import BriefDetailModal from './components/BriefDetailModal.jsx';
import { briefsApi } from './lib/briefsApi.js';

export default function BriefsBoard() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { briefs } = await briefsApi.list();
    setBriefs(briefs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const human = briefs.filter(b => b.source === 'human' && b.status !== 'sent');
  const ai    = briefs.filter(b => b.source === 'ai'    && b.status !== 'dismissed');

  async function onNew() {
    const { brief } = await briefsApi.create();
    navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=setup`);
  }

  async function onRegenerate() {
    setRegenerating(true);
    try { await briefsApi.regenerateOpportunities(); await load(); }
    finally { setRegenerating(false); }
  }

  if (loading) return <div className="cc2-empty">Loading briefs…</div>;

  return (
    <div className="cc2-board">
      <section className="cc2-column">
        <header className="cc2-column-header">
          <span className="cc2-column-title human">HUMAN · {human.length}</span>
          <button className="cc2-btn primary" onClick={onNew}><Plus size={14} /> New</button>
        </header>
        {human.length === 0
          ? <div className="cc2-empty">No human briefs yet.<br/>Click <strong>+ New</strong> to start.</div>
          : human.map(b => <BriefCard key={b.id} brief={b} onClick={() => setOpenId(b.id)} />)}
      </section>

      <section className="cc2-column">
        <header className="cc2-column-header">
          <span className="cc2-column-title ai">🤖 AI · {ai.length}</span>
          <button className="cc2-btn ghost-ai" onClick={onRegenerate} disabled={regenerating}>
            <RefreshCw size={14} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </header>
        {ai.length === 0
          ? <div className="cc2-empty">No AI opportunities yet.<br/>Click <strong>Regenerate</strong>.</div>
          : ai.map(b => <BriefCard key={b.id} brief={b} onClick={() => setOpenId(b.id)} />)}
      </section>

      {openId && (
        <BriefDetailModal
          briefId={openId}
          onClose={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append button styles to CSS**

```css
.cc2-btn {
  display: inline-flex; gap: 6px; align-items: center; border-radius: 6px;
  padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit;
  border: 1px solid var(--border); background: transparent; color: var(--text);
}
.cc2-btn.primary  { background: var(--accent); color: white; border-color: var(--accent); }
.cc2-btn.ghost-ai { color: var(--color-ai, #a78bfa); border-color: var(--color-ai, #a78bfa); }
.cc2-btn:disabled { opacity: 0.5; cursor: wait; }
```

- [ ] **Step 3: Browser check**

Open the Briefs tab. Expected: "No human briefs yet" + "No AI opportunities yet". Click `+ New` → creates a draft and navigates to `?briefId=…&mode=setup` (which still shows the WIP setup placeholder).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/BriefsBoard.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): Briefs board reads from API, creates drafts, opens setup"
```

### Task 2.5: BriefDetailModal

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx`
- Modify: CSS

- [ ] **Step 1: Write the modal**

```jsx
import React, { useEffect, useState } from 'react';
import { X, Play, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { briefsApi } from '../lib/briefsApi.js';

export default function BriefDetailModal({ briefId, onClose }) {
  const [brief, setBrief] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    briefsApi.list().then(({ briefs }) => setBrief(briefs.find(b => b.id === briefId) || null));
  }, [briefId]);

  if (!brief) return null;

  const isAi = brief.source === 'ai';
  const canActivate = brief.status === 'draft' || brief.status === 'active';
  const markets  = Array.isArray(brief.markets)  ? brief.markets  : [];
  const langs    = Array.isArray(brief.languages)? brief.languages: [];

  async function activate() {
    // If brief still has empty required fields → open chat. Otherwise → options.
    const needsSetup = !brief.name || !brief.send_date || !brief.template_id;
    const mode = needsSetup ? 'setup' : 'options';
    navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=${mode}`);
    onClose();
  }

  async function dismiss() {
    await briefsApi.dismiss(brief.id);
    onClose();
  }

  return (
    <div className="cc2-modal-backdrop" onClick={onClose}>
      <div className="cc2-modal" onClick={e => e.stopPropagation()}>
        <header className="cc2-modal__header">
          <div>
            <div className={`cc2-modal__badge ${isAi ? 'ai' : 'human'}`}>
              {isAi ? '🤖 AI OPPORTUNITY' : '👤 HUMAN BRIEF'}
            </div>
            <h2 className="cc2-modal__title">{brief.name || '(untitled)'}</h2>
          </div>
          <button className="cc2-modal__close" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="cc2-modal__body">
          {isAi && brief.opportunity_reason && (
            <div className="cc2-reason">
              <div className="cc2-reason__label">💡 ¿POR QUÉ ES OPORTUNIDAD?</div>
              <div className="cc2-reason__text">{brief.opportunity_reason}</div>
            </div>
          )}

          <dl className="cc2-fields">
            <Field label="Objective"   value={brief.objective} />
            <Field label="Send date"   value={brief.send_date && new Date(brief.send_date).toLocaleString()} />
            <Field label="Template"    value={brief.template_id} />
            <Field label="Markets"     value={markets.join(', ')} />
            <Field label="Languages"   value={langs.join(', ')} />
            <Field label="Audience"    value={brief.audience_summary} />
            <Field label="Status"      value={brief.status} />
          </dl>
        </div>

        <footer className="cc2-modal__footer">
          {isAi && (
            <button className="cc2-btn" onClick={dismiss}><Trash2 size={14}/> Dismiss</button>
          )}
          <div style={{ flex: 1 }} />
          {canActivate && (
            <button className="cc2-btn primary" onClick={activate}>
              <Play size={14}/> Activate
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="cc2-field">
      <dt>{label}</dt>
      <dd>{value || <em>—</em>}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Add modal + fields CSS**

```css
.cc2-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.cc2-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  width: 600px; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; }
.cc2-modal__header { display: flex; justify-content: space-between; align-items: start;
  padding: 20px; border-bottom: 1px solid var(--border); }
.cc2-modal__badge { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
.cc2-modal__badge.ai { color: var(--color-ai, #a78bfa); }
.cc2-modal__badge.human { color: var(--info); }
.cc2-modal__title { margin: 4px 0 0 0; font-size: 18px; }
.cc2-modal__close { background: transparent; border: 0; color: var(--text-muted); cursor: pointer; }

.cc2-modal__body { padding: 20px; overflow: auto; flex: 1; }
.cc2-modal__footer { display: flex; gap: 10px; padding: 16px 20px;
  border-top: 1px solid var(--border); align-items: center; }

.cc2-reason {
  background: color-mix(in srgb, var(--color-ai, #a78bfa) 12%, transparent);
  border-left: 3px solid var(--color-ai, #a78bfa);
  border-radius: 6px; padding: 12px; margin-bottom: 20px;
}
.cc2-reason__label { font-size: 10px; font-weight: 700; color: var(--color-ai, #a78bfa); margin-bottom: 4px; }
.cc2-reason__text { font-size: 13px; line-height: 1.5; }

.cc2-fields { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cc2-field dt { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.cc2-field dd { margin: 0; font-size: 13px; }
```

- [ ] **Step 3: Browser check**

Seed a brief manually with psql (to have something non-empty to open), then click it on the board. Modal opens with all fields, Activate button visible.

```sql
UPDATE campaign_briefs SET name='Test', objective='See detail', template_id='a350-premium-launch',
  send_date=now() + interval '7 days', markets='["FR"]'::jsonb, languages='["en"]'::jsonb
WHERE source='human' ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/components/BriefDetailModal.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): BriefDetailModal with activate/dismiss"
```

---

## Phase 3 · Setup Chat + Live Panel

### Task 3.1: Backend — chat turn endpoint with Claude tool-use

**Files:**
- Create: `apps/dashboard/server/briefs/chatTurn.js`
- Modify: `apps/dashboard/server/briefs/router.js`

- [ ] **Step 1: Write the tool-use wrapper**

```js
// apps/dashboard/server/briefs/chatTurn.js
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

const EXTRACT_TOOL = {
  name: 'update_brief',
  description: 'Store extracted or inferred brief fields from the conversation so far.',
  input_schema: {
    type: 'object',
    properties: {
      name:            { type: 'string' },
      objective:       { type: 'string' },
      send_date:       { type: 'string', description: 'ISO 8601 UTC datetime' },
      template_id:     { type: 'string', description: 'BAU template id from the known catalog' },
      markets:         { type: 'array', items: { type: 'string' } },
      languages:       { type: 'array', items: { type: 'string' } },
      variants_plan:   { type: 'array', items: {
          type: 'object',
          properties: { tier: { type: 'string' }, behaviors: { type: 'array', items: { type: 'string' } }, size: { type: 'integer' } },
        } },
      audience_summary:{ type: 'string' },
      next_question:   { type: 'string', description: 'Next question to ask the user. Empty if brief is complete.' },
      is_complete:     { type: 'boolean', description: 'True only when all required fields are filled.' },
    },
    required: ['next_question','is_complete'],
  },
};

const SYSTEM = `You are an email marketing strategist helping a user create a campaign brief through conversation.
Extract these fields progressively: name, objective, send_date, template_id, markets, languages, variants_plan, audience_summary.
At every turn, call the update_brief tool with whatever you can extract/infer from the latest user message (merge with existing state — do NOT blank fields).
Propose smart defaults (e.g., optimal send hour per market, default languages). Set is_complete=true only when every required field is present.
Keep questions concise (one at a time). Reply in the user's language.`;

export async function runChatTurn({ brief, userMessage, apiKey }) {
  const client = new Anthropic({ apiKey });
  const history = Array.isArray(brief.chat_transcript) ? brief.chat_transcript : [];
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const summaryOfKnown = JSON.stringify({
    name: brief.name, objective: brief.objective, send_date: brief.send_date,
    template_id: brief.template_id, markets: brief.markets, languages: brief.languages,
    variants_plan: brief.variants_plan, audience_summary: brief.audience_summary,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `${SYSTEM}\n\nCurrent known fields (JSON):\n${summaryOfKnown}`,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'update_brief' },
    messages,
  });

  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call update_brief');
  const extracted = toolUse.input;

  return {
    extracted,
    assistantMessage: extracted.next_question,
    newHistory: [...messages, { role: 'assistant', content: extracted.next_question }],
  };
}
```

- [ ] **Step 2: Wire the endpoint in router.js**

Replace the `/:id/chat/turn` stub:

```js
import { runChatTurn } from './chatTurn.js';

router.post('/:id/chat/turn', requireAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  const { rows: [brief] } = await pool.query(`SELECT * FROM campaign_briefs WHERE id = $1`, [req.params.id]);
  if (!brief) return res.status(404).json({ error: 'not found' });

  const { extracted, assistantMessage, newHistory } =
    await runChatTurn({ brief, userMessage: message, apiKey: process.env.ANTHROPIC_API_KEY });

  // Merge extracted fields with existing brief — do not overwrite with null/empty.
  const merged = {};
  for (const key of ['name','objective','send_date','template_id','markets','languages','variants_plan','audience_summary']) {
    if (extracted[key] != null && extracted[key] !== '') merged[key] = extracted[key];
  }
  const status = extracted.is_complete ? 'active' : 'draft';

  const setClauses = [];
  const params = [];
  for (const [k,v] of Object.entries(merged)) {
    params.push(v);
    setClauses.push(`${k} = $${params.length}`);
  }
  params.push(JSON.stringify(newHistory));
  setClauses.push(`chat_transcript = $${params.length}::jsonb`);
  params.push(status);
  setClauses.push(`status = $${params.length}`);
  params.push(req.params.id);

  const { rows: [updated] } = await pool.query(
    `UPDATE campaign_briefs SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );

  res.json({ brief: updated, assistantMessage, isComplete: !!extracted.is_complete });
});
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs/$BRIEF_ID/chat/turn \
  -H 'content-type: application/json' \
  -d '{"message":"Launch del A350 Premium para Francia a mediados de abril"}' | jq
# → {"brief":{...,"name":"A350 Premium Launch FR",...},"assistantMessage":"...","isComplete":false}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server/briefs/chatTurn.js apps/dashboard/server/briefs/router.js
git commit -m "feat(briefs): Claude tool-use chat turn endpoint"
```

### Task 3.2: SetupChatView frontend

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/SetupChatView.jsx`
- Create: `apps/dashboard/src/pages/CampaignCreationV2/components/BriefLivePanel.jsx`
- Modify: CSS

- [ ] **Step 1: BriefLivePanel**

```jsx
// components/BriefLivePanel.jsx
import React from 'react';
import { Check, CircleDashed, Loader2 } from 'lucide-react';

const FIELDS = [
  { key: 'name',             label: 'Nombre' },
  { key: 'send_date',        label: 'Fecha envío', fmt: v => new Date(v).toLocaleString() },
  { key: 'template_id',      label: 'Template' },
  { key: 'markets',          label: 'Mercados',    fmt: v => v.join(', ') },
  { key: 'languages',        label: 'Idiomas',     fmt: v => v.join(', ') },
  { key: 'variants_plan',    label: 'Variantes',   fmt: v => `${v.length} variantes` },
  { key: 'audience_summary', label: 'Audiencia' },
  { key: 'objective',        label: 'Objetivo' },
];

export default function BriefLivePanel({ brief, asking }) {
  const filled = FIELDS.filter(f => {
    const v = brief[f.key];
    return v && !(Array.isArray(v) && v.length === 0);
  }).length;

  return (
    <aside className="cc2-live-panel">
      <div className="cc2-live-panel__title">BRIEF EN CONSTRUCCIÓN</div>
      {FIELDS.map(f => {
        const v = brief[f.key];
        const isFilled = v && !(Array.isArray(v) && v.length === 0);
        const isAsking = asking === f.key;
        return (
          <div key={f.key} className="cc2-live-field">
            <div className="cc2-live-field__label">{f.label}</div>
            <div className={`cc2-live-field__value ${isFilled ? 'filled' : isAsking ? 'asking' : ''}`}>
              {isFilled
                ? <><Check size={12}/> {f.fmt ? f.fmt(v) : v}</>
                : isAsking
                  ? <><Loader2 size={12}/> preguntando…</>
                  : <><CircleDashed size={12}/> pendiente</>}
            </div>
          </div>
        );
      })}
      <div className="cc2-live-progress">
        <div className="cc2-live-progress__bar" style={{ width: `${(filled/FIELDS.length)*100}%` }} />
        <div className="cc2-live-progress__label">{filled}/{FIELDS.length} campos</div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: SetupChatView — chat UI with voice**

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Mic, ArrowLeft } from 'lucide-react';
import BriefLivePanel from './components/BriefLivePanel.jsx';
import { briefsApi } from './lib/briefsApi.js';
import useVoice from '../../hooks/useVoice.js'; // existing hook

export default function SetupChatView({ briefId }) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const voice = useVoice({ onTranscript: t => setInput(prev => prev + ' ' + t) });
  const bottomRef = useRef(null);

  useEffect(() => {
    briefsApi.list().then(({ briefs }) => {
      const b = briefs.find(x => x.id === briefId);
      setBrief(b);
      setMessages(Array.isArray(b?.chat_transcript) ? b.chat_transcript : []);
    });
  }, [briefId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    try {
      const { brief: updated, assistantMessage, isComplete } =
        await briefsApi.chatTurn(briefId, msg);
      setBrief(updated);
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      if (isComplete) {
        // auto-advance to content options after a beat
        setTimeout(() => navigate(`/app/campaign-creation-v2?briefId=${briefId}&mode=options`), 800);
      }
    } finally { setSending(false); }
  }

  if (!brief) return <div className="cc2-empty">Loading…</div>;

  return (
    <div className="cc2-chat-view">
      <header className="cc2-chat-view__header">
        <button className="cc2-btn" onClick={() => navigate('/app/campaign-creation-v2')}>
          <ArrowLeft size={14}/> Briefs
        </button>
        <h2>Crear brief · {brief.name || '(sin nombre)'}</h2>
      </header>

      <div className="cc2-chat-view__body">
        <section className="cc2-chat">
          {messages.length === 0 && (
            <div className="cc2-bubble assistant">
              Hola. ¿Qué campaña quieres lanzar? Cuéntame en una frase.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`cc2-bubble ${m.role}`}>{m.content}</div>
          ))}
          <div ref={bottomRef} />
          <form className="cc2-chat__input" onSubmit={e => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Responde al chat…"
              disabled={sending}
            />
            <button type="button" className="cc2-btn" onClick={voice.toggle} title="Voz">
              <Mic size={14} color={voice.listening ? 'var(--color-ai,#a78bfa)' : undefined}/>
            </button>
            <button type="submit" className="cc2-btn primary" disabled={sending || !input.trim()}>
              <Send size={14}/>
            </button>
          </form>
        </section>

        <BriefLivePanel brief={brief} asking={null} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CSS for chat view**

```css
.cc2-chat-view { display: flex; flex-direction: column; height: 100%; }
.cc2-chat-view__header { display: flex; gap: 12px; align-items: center; padding: 16px 24px;
  border-bottom: 1px solid var(--border); }
.cc2-chat-view__header h2 { margin: 0; font-size: 15px; }

.cc2-chat-view__body { display: grid; grid-template-columns: 1fr 340px; flex: 1; overflow: hidden; }

.cc2-chat { display: flex; flex-direction: column; padding: 20px; gap: 10px; overflow-y: auto; }
.cc2-bubble { max-width: 75%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
.cc2-bubble.user      { align-self: flex-end;  background: var(--accent); color: white; }
.cc2-bubble.assistant { align-self: flex-start; background: var(--surface-2,#1a1f2e); border: 1px solid var(--border); }

.cc2-chat__input { margin-top: auto; display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
.cc2-chat__input input {
  flex: 1; background: var(--surface-2,#1a1f2e); border: 1px solid var(--border);
  color: var(--text); padding: 10px 14px; border-radius: 8px; font-size: 13px; font-family: inherit;
}

.cc2-live-panel { background: var(--surface-2,#1a1f2e); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; }
.cc2-live-panel__title { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 16px; }
.cc2-live-field { margin-bottom: 12px; }
.cc2-live-field__label { font-size: 10px; color: var(--text-muted); }
.cc2-live-field__value { font-size: 13px; display: inline-flex; gap: 4px; align-items: center; color: var(--text-muted); }
.cc2-live-field__value.filled { color: #10b981; }
.cc2-live-field__value.asking { color: #fbbf24; }

.cc2-live-progress { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
.cc2-live-progress__bar { height: 6px; background: var(--accent); border-radius: 3px; transition: width 0.3s; }
.cc2-live-progress__label { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
```

- [ ] **Step 4: Browser check**

Click `+ New` from board. Chat opens empty. Type "Launch A350 Premium para FR en abril" → expect assistant to ask follow-up, brief panel shows extracted fields with green checks.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/SetupChatView.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/components/BriefLivePanel.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): setup chat with live brief panel and voice"
```

---

## Phase 4 · Content Options + Modal Preview

### Task 4.1: Backend — generate 3 options

**Files:**
- Create: `apps/dashboard/server/briefs/generateOptions.js`
- Modify: `apps/dashboard/server/briefs/router.js`

- [ ] **Step 1: Write the generator**

```js
// apps/dashboard/server/briefs/generateOptions.js
import Anthropic from '@anthropic-ai/sdk';
const MODEL = 'claude-sonnet-4-6';

const OPTIONS_TOOL = {
  name: 'propose_options',
  description: 'Propose exactly 3 distinct content directions (layout + copy) for the brief.',
  input_schema: {
    type: 'object',
    properties: {
      options: {
        type: 'array', minItems: 3, maxItems: 3,
        items: {
          type: 'object',
          required: ['direction','headline','subject','preheader','body','cta_label','cta_url','mood'],
          properties: {
            direction:  { type: 'string', enum: ['editorial','data-grid','emotional'] },
            headline:   { type: 'string' },
            subject:    { type: 'string' },
            preheader:  { type: 'string' },
            body:       { type: 'string' },
            cta_label:  { type: 'string' },
            cta_url:    { type: 'string' },
            mood:       { type: 'string', description: 'One-line description of tone/feel' },
          },
        },
      },
    },
    required: ['options'],
  },
};

export async function generateOptions({ brief, apiKey }) {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [OPTIONS_TOOL],
    tool_choice: { type: 'tool', name: 'propose_options' },
    messages: [{
      role: 'user',
      content: `Create 3 distinct content directions for this campaign brief. Each must use a different 'direction' value.
Brief:
${JSON.stringify(brief, null, 2)}`,
    }],
  });
  const toolUse = res.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call propose_options');
  return toolUse.input.options;
}
```

- [ ] **Step 2: Wire endpoints**

Replace the two stubs in `router.js`:

```js
import { generateOptions } from './generateOptions.js';

// In-memory cache for non-accepted options (ephemeral, dies with server restart).
const optionsCache = new Map();  // briefId -> options[]

router.post('/:id/options/generate', requireAuth, async (req, res) => {
  const { rows: [brief] } = await pool.query(`SELECT * FROM campaign_briefs WHERE id = $1`, [req.params.id]);
  if (!brief) return res.status(404).json({ error: 'not found' });
  const options = await generateOptions({ brief, apiKey: process.env.ANTHROPIC_API_KEY });
  optionsCache.set(brief.id, options);
  res.json({ options });
});

router.post('/:id/options/accept', requireAuth, async (req, res) => {
  const { optionIndex } = req.body;
  const options = optionsCache.get(req.params.id);
  if (!options || options[optionIndex] == null) return res.status(400).json({ error: 'no options cached' });
  const accepted = options[optionIndex];
  const { rows: [updated] } = await pool.query(
    `UPDATE campaign_briefs
     SET accepted_option = $1::jsonb, status = 'in_wizard'
     WHERE id = $2 RETURNING *`,
    [JSON.stringify(accepted), req.params.id],
  );
  optionsCache.delete(req.params.id);
  res.json({ brief: updated });
});
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs/$BRIEF_ID/options/generate | jq
# → {"options":[{direction:"editorial",...},{direction:"data-grid",...},{direction:"emotional",...}]}

curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs/$BRIEF_ID/options/accept \
  -H 'content-type: application/json' -d '{"optionIndex":0}' | jq
# → {"brief":{...,"status":"in_wizard","accepted_option":{...}}}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server/briefs/generateOptions.js apps/dashboard/server/briefs/router.js
git commit -m "feat(briefs): generate 3 content options + accept flow"
```

### Task 4.2: Frontend — ContentOptionsChat + OptionCard + OptionPreviewModal

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/ContentOptionsChat.jsx`
- Create: `apps/dashboard/src/pages/CampaignCreationV2/components/OptionCard.jsx`
- Create: `apps/dashboard/src/pages/CampaignCreationV2/components/OptionPreviewModal.jsx`
- Modify: CSS

- [ ] **Step 1: OptionCard**

```jsx
import React from 'react';

const DIRECTION_LABELS = {
  'editorial':  'PREMIUM EDITORIAL',
  'data-grid':  'DATA-GRID',
  'emotional':  'EMOTIONAL STORY',
};

export default function OptionCard({ option, letter, onClick }) {
  return (
    <button className="cc2-option-card" onClick={onClick}>
      <div className={`cc2-option-card__thumb dir-${option.direction}`}>
        <div className="cc2-option-card__letter">{letter}</div>
      </div>
      <div className="cc2-option-card__body">
        <div className="cc2-option-card__dir">{DIRECTION_LABELS[option.direction] || option.direction.toUpperCase()}</div>
        <div className="cc2-option-card__headline">{option.headline}</div>
        <div className="cc2-option-card__mood">{option.mood}</div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: OptionPreviewModal**

```jsx
import React from 'react';
import { X } from 'lucide-react';

export default function OptionPreviewModal({ option, onAccept, onClose }) {
  return (
    <div className="cc2-modal-backdrop" onClick={onClose}>
      <div className="cc2-modal cc2-modal--wide" onClick={e => e.stopPropagation()}>
        <header className="cc2-modal__header">
          <div>
            <div className="cc2-modal__badge ai">{option.direction.toUpperCase()}</div>
            <h2 className="cc2-modal__title">{option.headline}</h2>
          </div>
          <button className="cc2-modal__close" onClick={onClose}><X size={18}/></button>
        </header>
        <div className="cc2-modal__body">
          <div className="cc2-option-preview">
            <div className="cc2-option-preview__frame mobile">
              <div className="cc2-option-preview__label">📱 Mobile</div>
              <div className="cc2-option-preview__mock">
                <h3>{option.subject}</h3>
                <p className="cc2-option-preview__preheader">{option.preheader}</p>
                <p>{option.body}</p>
                <button className="cc2-btn primary">{option.cta_label}</button>
              </div>
            </div>
            <div className="cc2-option-preview__frame desktop">
              <div className="cc2-option-preview__label">💻 Desktop</div>
              <div className="cc2-option-preview__mock">
                <h3>{option.subject}</h3>
                <p className="cc2-option-preview__preheader">{option.preheader}</p>
                <p>{option.body}</p>
                <button className="cc2-btn primary">{option.cta_label}</button>
              </div>
            </div>
          </div>
        </div>
        <footer className="cc2-modal__footer">
          <button className="cc2-btn" onClick={onClose}>Volver</button>
          <div style={{ flex: 1 }} />
          <button className="cc2-btn primary" onClick={onAccept}>✓ Aceptar esta opción</button>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ContentOptionsChat**

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import OptionCard from './components/OptionCard.jsx';
import OptionPreviewModal from './components/OptionPreviewModal.jsx';
import { briefsApi } from './lib/briefsApi.js';

export default function ContentOptionsChat({ briefId }) {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewIdx, setPreviewIdx] = useState(null);

  async function generate() {
    setLoading(true);
    try { const { options } = await briefsApi.genOptions(briefId); setOptions(options); }
    finally { setLoading(false); }
  }

  useEffect(() => { generate(); /* eslint-disable-next-line */ }, [briefId]);

  async function accept(idx) {
    await briefsApi.accept(briefId, idx);
    navigate(`/app/campaign-creation-v2?briefId=${briefId}&mode=wizard`);
  }

  return (
    <div className="cc2-chat-view">
      <header className="cc2-chat-view__header">
        <button className="cc2-btn" onClick={() => navigate('/app/campaign-creation-v2')}>
          <ArrowLeft size={14}/> Briefs
        </button>
        <h2>Elige dirección de contenido</h2>
      </header>
      <div style={{ padding: 24 }}>
        {loading && <div className="cc2-empty">Generando 3 opciones…</div>}
        {!loading && options && (
          <>
            <div className="cc2-options-grid">
              {options.map((o, i) => (
                <OptionCard key={i} option={o} letter={String.fromCharCode(65+i)} onClick={() => setPreviewIdx(i)} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="cc2-btn" onClick={generate}><RefreshCw size={14}/> Regenerar las 3</button>
            </div>
          </>
        )}
      </div>
      {previewIdx != null && options && (
        <OptionPreviewModal
          option={options[previewIdx]}
          onClose={() => setPreviewIdx(null)}
          onAccept={() => accept(previewIdx)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: CSS for options**

```css
.cc2-options-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

.cc2-option-card {
  background: var(--surface-2,#1a1f2e); border: 1px solid var(--border);
  border-radius: 10px; overflow: hidden; cursor: pointer; padding: 0;
  color: var(--text); text-align: left; font-family: inherit;
}
.cc2-option-card:hover { border-color: var(--color-ai,#a78bfa); }

.cc2-option-card__thumb {
  height: 160px; background: linear-gradient(135deg, #0f1419, #1a1f2e);
  position: relative; display: flex; align-items: flex-end; padding: 12px;
}
.cc2-option-card__thumb.dir-editorial  { background: linear-gradient(135deg, #D71920, #1a1f2e); }
.cc2-option-card__thumb.dir-data-grid  { background: linear-gradient(135deg, #06b6d4, #1a1f2e); }
.cc2-option-card__thumb.dir-emotional  { background: linear-gradient(135deg, #D4AF37, #1a1f2e); }
.cc2-option-card__letter { font-size: 32px; font-weight: 800; color: rgba(255,255,255,0.9); }

.cc2-option-card__body { padding: 12px; }
.cc2-option-card__dir { font-size: 10px; font-weight: 700; color: var(--color-ai,#a78bfa); }
.cc2-option-card__headline { font-size: 14px; font-weight: 600; margin-top: 4px; }
.cc2-option-card__mood { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.cc2-modal--wide { width: 900px; }
.cc2-option-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.cc2-option-preview__frame { background: var(--surface-2,#1a1f2e); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.cc2-option-preview__label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
.cc2-option-preview__mock h3 { margin: 0 0 8px 0; font-size: 18px; }
.cc2-option-preview__preheader { color: var(--text-muted); font-size: 12px; margin: 0 0 12px 0; }
```

- [ ] **Step 5: Browser check**

From a complete brief (status=active), open it → Activate → ContentOptionsChat loads, 3 cards appear, click one → modal preview → Accept → navigates to wizard view.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/ContentOptionsChat.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/components/OptionCard.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/components/OptionPreviewModal.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): 3-option content studio with modal preview"
```

---

## Phase 5 · AI Opportunities

### Task 5.1: Mock signals catalog

**Files:**
- Create: `apps/dashboard/src/data/mockSignals.js`

- [ ] **Step 1: Write the catalog**

```js
// apps/dashboard/src/data/mockSignals.js
// Mock signals that power the "AI opportunity" briefs. Replace with real data sources later.

export const MOCK_SIGNALS = [
  { type: 'dormant_segment',    brief_template: 'lifecycle-winback',    payload: { segment: 'Silver DE',       size: 31200, days_since_last_open: 94 } },
  { type: 'dormant_segment',    brief_template: 'lifecycle-winback',    payload: { segment: 'Gold UK',         size: 8400,  days_since_last_open: 112 } },
  { type: 'cart_abandon_spike', brief_template: 'recovery-offer',       payload: { route: 'DXB-LHR',           users: 2140, dropoff_step: 'payment' } },
  { type: 'cart_abandon_spike', brief_template: 'recovery-offer',       payload: { route: 'DXB-CDG',           users: 1480, dropoff_step: 'seat-select' } },
  { type: 'new_route_window',   brief_template: 'route-launch',         payload: { route: 'DXB-MXP',           launch_date: '2026-05-10', addressable_audience: 42000 } },
  { type: 'new_route_window',   brief_template: 'route-launch',         payload: { route: 'DXB-BOG',           launch_date: '2026-06-01', addressable_audience: 28000 } },
  { type: 'ctr_decline',        brief_template: 'engagement-broadcast', payload: { market: 'FR',               delta_pct: -18, window_days: 30 } },
  { type: 'ctr_decline',        brief_template: 'engagement-broadcast', payload: { market: 'DE',               delta_pct: -12, window_days: 30 } },
  { type: 'seasonal_window',    brief_template: 'offers-promotion',     payload: { occasion: 'Eid al-Fitr',    markets: ['AE','SA','KW'], days_until: 14 } },
  { type: 'seasonal_window',    brief_template: 'offers-promotion',     payload: { occasion: 'Summer 2026',    markets: ['UK','DE','FR'], days_until: 42 } },
];

export function pickRandomSignals(n, exclude = []) {
  const available = MOCK_SIGNALS.filter(s => !exclude.some(e =>
    e.type === s.type && JSON.stringify(e.payload) === JSON.stringify(s.payload)));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
```

- [ ] **Step 2: Unit test picker**

Create `apps/dashboard/__tests__/signalPicker.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRandomSignals, MOCK_SIGNALS } from '../src/data/mockSignals.js';

test('pickRandomSignals returns requested count', () => {
  assert.equal(pickRandomSignals(4).length, 4);
});

test('pickRandomSignals excludes by type+payload equality', () => {
  const first = MOCK_SIGNALS[0];
  const picks = pickRandomSignals(MOCK_SIGNALS.length, [first]);
  assert.ok(!picks.some(s => s.type === first.type && JSON.stringify(s.payload) === JSON.stringify(first.payload)));
});
```

Run: `node --test apps/dashboard/__tests__/signalPicker.test.js`
Expected: 2 passing tests.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/data/mockSignals.js apps/dashboard/__tests__/signalPicker.test.js
git commit -m "feat(briefs): mock signals catalog + picker tests"
```

### Task 5.2: Opportunity generator endpoint

**Files:**
- Create: `apps/dashboard/server/briefs/generateOpportunities.js`
- Modify: `apps/dashboard/server/briefs/router.js`

- [ ] **Step 1: Write the generator**

```js
// apps/dashboard/server/briefs/generateOpportunities.js
import Anthropic from '@anthropic-ai/sdk';
import { pickRandomSignals } from '../../src/data/mockSignals.js';

const MODEL = 'claude-sonnet-4-6';

const TOOL = {
  name: 'compose_opportunity_brief',
  description: 'Compose a campaign brief from a detected signal.',
  input_schema: {
    type: 'object',
    required: ['name','audience_summary','opportunity_reason','suggested_send_date','template_id','markets','languages'],
    properties: {
      name:                 { type: 'string' },
      audience_summary:     { type: 'string' },
      opportunity_reason:   { type: 'string', description: '1-2 sentences, why this matters, data-driven' },
      suggested_send_date:  { type: 'string', description: 'ISO date' },
      template_id:          { type: 'string' },
      markets:              { type: 'array', items: { type: 'string' } },
      languages:            { type: 'array', items: { type: 'string' } },
    },
  },
};

const PREVIEW_BY_TEMPLATE = {
  'lifecycle-winback':    '/assets/ai-previews/winback.png',
  'recovery-offer':       '/assets/ai-previews/recovery.png',
  'route-launch':         '/assets/ai-previews/route.png',
  'engagement-broadcast': '/assets/ai-previews/broadcast.png',
  'offers-promotion':     '/assets/ai-previews/offer.png',
};

export async function composeOpportunityFromSignal({ signal, apiKey }) {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'compose_opportunity_brief' },
    messages: [{
      role: 'user',
      content: `A data signal has been detected for Emirates email marketing. Compose a proactive campaign brief.
Signal type: ${signal.type}
Signal payload: ${JSON.stringify(signal.payload)}
Suggested template: ${signal.brief_template}
Return a brief with a compelling 'opportunity_reason' citing the signal data.`,
    }],
  });
  const toolUse = res.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not call compose_opportunity_brief');
  const b = toolUse.input;
  return {
    ...b,
    preview_image_url: PREVIEW_BY_TEMPLATE[b.template_id] || null,
    opportunity_signals: signal,
  };
}

export async function generateOpportunities({ count = 4, exclude = [], apiKey }) {
  const signals = pickRandomSignals(count, exclude);
  const briefs = [];
  for (const s of signals) {
    briefs.push(await composeOpportunityFromSignal({ signal: s, apiKey }));
  }
  return briefs;
}
```

- [ ] **Step 2: Wire endpoint**

Replace the stub in `router.js`:

```js
import { generateOpportunities } from './generateOpportunities.js';

router.post('/ai-opportunities/regenerate', requireAuth, async (req, res) => {
  // Delete existing AI drafts only (respect activated/dismissed)
  await pool.query(`DELETE FROM campaign_briefs WHERE source = 'ai' AND status = 'draft'`);

  // Load signals of already-activated or dismissed AI briefs to avoid re-suggesting
  const { rows: existing } = await pool.query(
    `SELECT opportunity_signals FROM campaign_briefs WHERE source = 'ai' AND status IN ('active','in_wizard','sent','dismissed')`,
  );
  const exclude = existing.map(r => r.opportunity_signals).filter(Boolean);

  const briefs = await generateOpportunities({ count: 4, exclude, apiKey: process.env.ANTHROPIC_API_KEY });

  const inserted = [];
  for (const b of briefs) {
    const { rows: [row] } = await pool.query(
      `INSERT INTO campaign_briefs
         (source, status, name, audience_summary, opportunity_reason, opportunity_signals,
          preview_image_url, send_date, template_id, markets, languages)
       VALUES ('ai','draft', $1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb)
       RETURNING *`,
      [
        b.name, b.audience_summary, b.opportunity_reason,
        JSON.stringify(b.opportunity_signals), b.preview_image_url,
        b.suggested_send_date, b.template_id,
        JSON.stringify(b.markets || []), JSON.stringify(b.languages || []),
      ],
    );
    inserted.push(row);
  }
  res.json({ briefs: inserted });
});
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -b cookies.txt -X POST http://localhost:3002/api/campaign-briefs/ai-opportunities/regenerate | jq '.briefs | length'
# → 4
```

- [ ] **Step 4: Browser check**

Open Briefs board → click Regenerate (AI column) → 4 cards appear with reasons visible.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/server/briefs/generateOpportunities.js apps/dashboard/server/briefs/router.js
git commit -m "feat(briefs): AI opportunities regenerate endpoint"
```

---

## Phase 6 · Overview Dashboard + Calendar

### Task 6.1: OverviewDashboard

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/OverviewDashboard.jsx`
- CSS

- [ ] **Step 1: Write the component**

```jsx
import React, { useEffect, useState } from 'react';
import { briefsApi } from './lib/briefsApi.js';

export default function OverviewDashboard() {
  const [briefs, setBriefs] = useState([]);
  useEffect(() => { briefsApi.list().then(({ briefs }) => setBriefs(briefs)); }, []);

  const count = (pred) => briefs.filter(pred).length;
  const sevenDaysAgo = Date.now() - 7*24*60*60*1000;

  const kpis = [
    { label: 'DRAFT',     value: count(b => b.status === 'draft'),     color: 'var(--text-muted)' },
    { label: 'IN WIZARD', value: count(b => b.status === 'in_wizard'), color: '#fbbf24' },
    { label: 'SCHEDULED', value: count(b => b.status === 'active'),    color: 'var(--info)' },
    { label: 'SENT · 7d', value: count(b => b.status === 'sent' && new Date(b.updated_at).getTime() > sevenDaysAgo), color: '#10b981' },
  ];

  const pipeline = briefs.filter(b => b.status !== 'dismissed' && b.status !== 'sent');

  return (
    <div className="cc2-overview">
      <div className="cc2-kpi-row">
        {kpis.map(k => (
          <div key={k.label} className="cc2-kpi-card" style={{ borderColor: k.color }}>
            <div className="cc2-kpi-card__label" style={{ color: k.color }}>{k.label}</div>
            <div className="cc2-kpi-card__value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="cc2-pipeline">
        <div className="cc2-pipeline__title">Pipeline</div>
        <table className="cc2-pipeline__table">
          <thead><tr><th>Campaign</th><th>Status</th><th>Date</th><th>Markets</th><th>Variants</th></tr></thead>
          <tbody>
            {pipeline.map(b => (
              <tr key={b.id}>
                <td>{b.name || '(untitled)'}</td>
                <td><span className={`cc2-status-pill s-${b.status}`}>{b.status}</span></td>
                <td>{b.send_date ? new Date(b.send_date).toLocaleDateString() : '—'}</td>
                <td>{(b.markets || []).join(', ') || '—'}</td>
                <td>{(b.variants_plan || []).length}</td>
              </tr>
            ))}
            {pipeline.length === 0 && <tr><td colSpan={5} className="cc2-empty">No campaigns in pipeline.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

```css
.cc2-overview { display: flex; flex-direction: column; gap: 20px; }
.cc2-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.cc2-kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.cc2-kpi-card__label { font-size: 11px; font-weight: 700; }
.cc2-kpi-card__value { font-size: 28px; font-weight: 700; margin-top: 4px; }

.cc2-pipeline { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.cc2-pipeline__title { font-size: 13px; font-weight: 600; margin-bottom: 12px; }
.cc2-pipeline__table { width: 100%; font-size: 12px; border-collapse: collapse; }
.cc2-pipeline__table th { text-align: left; color: var(--text-muted); font-weight: 400; padding: 6px 8px; }
.cc2-pipeline__table td { padding: 8px; border-top: 1px solid var(--border); }

.cc2-status-pill { padding: 2px 8px; border-radius: 10px; font-size: 10px; text-transform: uppercase; }
.cc2-status-pill.s-draft     { background: rgba(156,163,175,0.15); color: var(--text-muted); }
.cc2-status-pill.s-active    { background: rgba(96,165,250,0.15); color: var(--info); }
.cc2-status-pill.s-in_wizard { background: rgba(251,191,36,0.15); color: #fbbf24; }
.cc2-status-pill.s-sent      { background: rgba(16,185,129,0.15); color: #10b981; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/OverviewDashboard.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): overview dashboard with KPI row and pipeline table"
```

### Task 6.2: CampaignsCalendar

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/CampaignsCalendar.jsx`
- CSS

- [ ] **Step 1: Write the calendar**

```jsx
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { briefsApi } from './lib/briefsApi.js';
import { BAU_CATEGORIES, getBauTypeById } from '../../data/emiratesBauTypes.js';

export default function CampaignsCalendar() {
  const [briefs, setBriefs] = useState([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  useEffect(() => { briefsApi.list().then(({ briefs }) => setBriefs(briefs)); }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  const byDay = (date) => briefs.filter(b => b.send_date &&
    new Date(b.send_date).toDateString() === date.toDateString() &&
    b.status !== 'dismissed');

  const colorForBrief = (b) => {
    const t = getBauTypeById(b.template_id);
    return t?.category ? BAU_CATEGORIES[t.category]?.color : 'var(--info)';
  };

  const shift = (delta) => setCursor(prev => new Date(prev.getFullYear(), prev.getMonth()+delta, 1));
  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="cc2-calendar">
      <header className="cc2-cal-header">
        <div style={{ fontSize: 16, fontWeight: 600 }}>{monthLabel}</div>
        <div>
          <button className="cc2-btn" onClick={() => shift(-1)}><ChevronLeft size={14}/></button>
          <button className="cc2-btn" onClick={() => setCursor(() => { const d = new Date(); d.setDate(1); return d; })}>Today</button>
          <button className="cc2-btn" onClick={() => shift(1)}><ChevronRight size={14}/></button>
        </div>
      </header>

      <div className="cc2-cal-grid">
        {['M','T','W','T','F','S','S'].map((d,i) => <div key={i} className="cc2-cal-dow">{d}</div>)}
        {days.map((date, i) => date ? (
          <div key={i} className="cc2-cal-cell">
            <div className="cc2-cal-cell__num">{date.getDate()}</div>
            {byDay(date).map(b => (
              <div key={b.id} className="cc2-cal-event" style={{ borderLeftColor: colorForBrief(b) }}>
                {b.name}
              </div>
            ))}
          </div>
        ) : <div key={i} className="cc2-cal-cell empty" />)}
      </div>

      <div className="cc2-cal-legend">
        {Object.values(BAU_CATEGORIES).map(c => (
          <span key={c.id}><span className="cc2-cal-swatch" style={{ background: c.color }} /> {c.name}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

```css
.cc2-calendar { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
.cc2-cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cc2-cal-header .cc2-btn { margin-left: 4px; }

.cc2-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cc2-cal-dow { text-align: center; font-size: 10px; color: var(--text-muted); padding: 4px; }
.cc2-cal-cell { background: var(--surface-2,#1a1f2e); border: 1px solid var(--border); border-radius: 6px;
  padding: 6px; min-height: 80px; font-size: 11px; }
.cc2-cal-cell.empty { background: transparent; border: 0; }
.cc2-cal-cell__num { color: var(--text); font-weight: 600; margin-bottom: 4px; }

.cc2-cal-event { border-left: 2px solid var(--info); padding: 2px 4px; border-radius: 2px;
  font-size: 10px; margin-top: 2px; background: rgba(255,255,255,0.03); }

.cc2-cal-legend { display: flex; gap: 16px; margin-top: 14px; font-size: 11px; color: var(--text-muted); flex-wrap: wrap; }
.cc2-cal-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin-right: 4px; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/CampaignsCalendar.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git commit -m "feat(cc2): BAU calendar tab with category colors"
```

---

## Phase 7 · Wizard Refactor (Autofill)

### Task 7.1: Extract wizard to its own file

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx`
- Keep: old `apps/dashboard/src/pages/CampaignCreationV2Page.jsx` for reference until done

- [ ] **Step 1: Copy the wizard body (all steps + helpers) from the old `CampaignCreationV2Page.jsx` into the new `CampaignWizard.jsx`, removing the outer `CampaignCreationV2Page` export and keeping the wizard as default export:**

```jsx
// apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx
// Copied 1:1 from the previous CampaignCreationV2Page.jsx — same steps (Setup, Content, Review).
// Accepts optional `briefId` prop (used in Task 7.2 to autofill).

import React, { useState } from 'react';
// ... all original imports

export default function CampaignWizard({ briefId }) {
  // ... full body of the previous component, renamed
  // Just the exported default; no routing logic inside.
}
```

- [ ] **Step 2: Browser check**

Open a brief that has `accepted_option` set (you can craft one in psql for now) and navigate to `?briefId=X&mode=wizard`. Expected: wizard renders exactly like it used to, no autofill yet.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx
git commit -m "refactor(cc2): extract wizard to its own component"
```

### Task 7.2: briefAutofill mapping + unit tests

**Files:**
- Create: `apps/dashboard/src/pages/CampaignCreationV2/lib/briefAutofill.js`
- Create: `apps/dashboard/__tests__/briefAutofill.test.js`

- [ ] **Step 1: Pure mapping function**

```js
// lib/briefAutofill.js
// Convert a brief (+ accepted_option) into initial state for the wizard steps.

export function briefToWizardState(brief) {
  const opt = brief.accepted_option || {};
  const variantsPlan = Array.isArray(brief.variants_plan) ? brief.variants_plan : [];
  return {
    step1: {
      name:        brief.name        || '',
      sendDate:    brief.send_date   || null,
      templateId:  brief.template_id || null,
      markets:     Array.isArray(brief.markets)   ? brief.markets   : [],
      languages:   Array.isArray(brief.languages) ? brief.languages : [],
      objective:   brief.objective   || '',
    },
    step2: {
      layoutDirection: opt.direction || null,
      subject:         opt.subject   || '',
      preheader:       opt.preheader || '',
      headline:        opt.headline  || '',
      body:            opt.body      || '',
      ctaLabel:        opt.cta_label || '',
      ctaUrl:          opt.cta_url   || '',
      variants: variantsPlan.map((v, i) => ({
        id: `v${i+1}`,
        tier: v.tier,
        behaviors: v.behaviors || [],
        size: v.size || 0,
        subject:   opt.subject   || '',
        preheader: opt.preheader || '',
        headline:  opt.headline  || '',
        body:      opt.body      || '',
        ctaLabel:  opt.cta_label || '',
        ctaUrl:    opt.cta_url   || '',
      })),
    },
    lockedFields: ['templateId'], // cannot edit without starting a new content pass
    prefilledFields: new Set([
      'name','sendDate','templateId','markets','languages','objective',
      'layoutDirection','subject','preheader','headline','body','ctaLabel','ctaUrl',
    ]),
  };
}
```

- [ ] **Step 2: Tests**

```js
// apps/dashboard/__tests__/briefAutofill.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefToWizardState } from '../src/pages/CampaignCreationV2/lib/briefAutofill.js';

test('briefToWizardState copies setup fields', () => {
  const s = briefToWizardState({
    name: 'X', send_date: '2026-04-14', template_id: 't1',
    markets: ['FR'], languages: ['en'], objective: 'test',
    variants_plan: [], accepted_option: null,
  });
  assert.equal(s.step1.name, 'X');
  assert.equal(s.step1.templateId, 't1');
  assert.deepEqual(s.step1.markets, ['FR']);
});

test('briefToWizardState expands variants from plan + option copy', () => {
  const s = briefToWizardState({
    variants_plan: [{ tier: 'Gold', behaviors: ['engaged'], size: 100 }],
    accepted_option: { direction: 'editorial', subject: 'hello', body: 'hi', headline: 'h', preheader: 'p', cta_label: 'go', cta_url: 'u' },
  });
  assert.equal(s.step2.variants.length, 1);
  assert.equal(s.step2.variants[0].subject, 'hello');
  assert.equal(s.step2.variants[0].tier, 'Gold');
});

test('briefToWizardState locks templateId', () => {
  const s = briefToWizardState({});
  assert.ok(s.lockedFields.includes('templateId'));
});
```

Run: `node --test apps/dashboard/__tests__/briefAutofill.test.js` → 3 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/lib/briefAutofill.js \
        apps/dashboard/__tests__/briefAutofill.test.js
git commit -m "feat(cc2): briefAutofill mapping + tests"
```

### Task 7.3: Wire autofill into wizard

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx`
- CSS

- [ ] **Step 1: Fetch brief on mount, seed state**

At the top of `CampaignWizard`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { briefsApi } from './lib/briefsApi.js';
import { briefToWizardState } from './lib/briefAutofill.js';

export default function CampaignWizard({ briefId }) {
  const [brief, setBrief] = useState(null);
  const [editedFields, setEditedFields] = useState(new Set());

  useEffect(() => {
    if (!briefId) return;
    briefsApi.list().then(({ briefs }) => setBrief(briefs.find(b => b.id === briefId) || null));
  }, [briefId]);

  const seed = useMemo(() => brief ? briefToWizardState(brief) : null, [brief]);

  // Replace the existing step state initializers so they use seed.step1 / seed.step2 when present.
  // Each input's onChange should call setEditedFields(prev => new Set(prev).add(fieldName)).
  // ...
```

- [ ] **Step 2: Add the banner**

Right after the wizard top bar, render:

```jsx
{brief && (
  <div className="cc2-wizard-banner">
    <Sparkles size={16} />
    <span>Pre-rellenado desde brief <strong>“{brief.name}”</strong>. Todos los campos son editables.</span>
    <a href={`/app/campaign-creation-v2?briefId=${brief.id}`}>Ver brief →</a>
  </div>
)}
```

- [ ] **Step 3: Purple border + lock icon helpers**

For every prefillable input in Step 1 and Step 2, add:

```jsx
<input
  className={`... ${seed?.prefilledFields.has('name') && !editedFields.has('name') ? 'cc2-prefilled' : ''}`}
  value={name}
  onChange={e => { setName(e.target.value); setEditedFields(prev => new Set(prev).add('name')); }}
/>
```

For `template_id`:

```jsx
<div className="cc2-locked-field">
  <span>{templateId}</span>
  <Lock size={12} />
</div>
```

CSS:

```css
.cc2-wizard-banner {
  display: flex; gap: 10px; align-items: center;
  background: color-mix(in srgb, var(--color-ai,#a78bfa) 15%, transparent);
  border: 1px solid var(--color-ai,#a78bfa); border-radius: 8px;
  padding: 10px 14px; margin: 12px 24px; font-size: 13px;
}
.cc2-wizard-banner a { margin-left: auto; color: var(--color-ai,#a78bfa); text-decoration: none; font-size: 12px; }

.cc2-prefilled { border-color: color-mix(in srgb, var(--color-ai,#a78bfa) 50%, transparent) !important; }

.cc2-locked-field {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface-2,#1a1f2e); border: 1px solid var(--border);
  border-radius: 6px; padding: 10px; color: var(--text-muted); font-size: 13px;
}
```

- [ ] **Step 4: Browser check**

Run the full happy path: New → Chat → options → Accept → wizard appears with banner, purple-bordered inputs, template locked. Edit a field → border disappears.

- [ ] **Step 5: Remove old file**

Delete `apps/dashboard/src/pages/CampaignCreationV2Page.jsx`. Confirm no imports remain via grep.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationV2/CampaignWizard.jsx \
        apps/dashboard/src/pages/CampaignCreationV2/campaign-creation-v2.css
git rm apps/dashboard/src/pages/CampaignCreationV2Page.jsx
git commit -m "feat(cc2): wizard auto-fills from brief with purple borders and template lock"
```

---

## Phase 8 · i18n + Polish + Smoke

### Task 8.1: i18n strings

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add namespaces for ES + EN**

Add objects under both `es` and `en`:

```js
briefs: {
  tabs: { briefs: 'Briefs', overview: 'Overview', calendar: 'Calendar' },
  board: {
    humanTitle: 'HUMAN', aiTitle: 'AI',
    newBrief: 'New', regenerate: 'Regenerate',
    emptyHuman: 'No hay briefs aún. Pulsa "New" para empezar.',
    emptyAi: 'No hay oportunidades aún. Pulsa "Regenerate".',
  },
  card: { badgeHuman: 'HUMAN', badgeAi: 'AI OPPORTUNITY' },
  modal: {
    activate: 'Activate', dismiss: 'Dismiss',
    reasonLabel: '¿POR QUÉ ES OPORTUNIDAD?',
    fields: { objective: 'Objective', sendDate: 'Send date', template: 'Template',
              markets: 'Markets', languages: 'Languages', audience: 'Audience', status: 'Status' },
  },
  setup: {
    header: 'Crear brief',
    placeholder: 'Responde al chat…',
    greeting: 'Hola. ¿Qué campaña quieres lanzar? Cuéntame en una frase.',
    panelTitle: 'BRIEF EN CONSTRUCCIÓN',
    pending: 'pendiente', asking: 'preguntando…',
    progressLabel: (n, t) => `${n}/${t} campos`,
  },
  options: {
    header: 'Elige dirección de contenido',
    loading: 'Generando 3 opciones…',
    regenerate: 'Regenerar las 3',
    accept: '✓ Aceptar esta opción',
    back: 'Volver',
  },
  wizard: {
    banner: (name) => `Pre-rellenado desde brief “${name}”. Todos los campos son editables.`,
    viewBrief: 'Ver brief →',
  },
  overview: {
    kpi: { draft: 'DRAFT', inWizard: 'IN WIZARD', scheduled: 'SCHEDULED', sent7d: 'SENT · 7d' },
    pipelineTitle: 'Pipeline',
    emptyPipeline: 'No campaigns in pipeline.',
  },
  calendar: { today: 'Today' },
},
```

Mirror in English (translate the Spanish strings).

- [ ] **Step 2: Replace hard-coded strings in the components with `t('briefs.…')`**

Go through `BriefsBoard`, `BriefCard`, `BriefDetailModal`, `SetupChatView`, `BriefLivePanel`, `ContentOptionsChat`, `OptionPreviewModal`, `OverviewDashboard`, `CampaignsCalendar`, `CampaignWizard` banner — swap every literal for `t()`.

- [ ] **Step 3: Browser check ES and EN**

Toggle language in the app header. Every string updates.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js apps/dashboard/src/pages/CampaignCreationV2
git commit -m "feat(cc2): full i18n coverage (ES + EN)"
```

### Task 8.2: End-to-end smoke script

**Files:**
- Create: `scripts/smoke-briefs.sh`

- [ ] **Step 1: Script**

```bash
#!/usr/bin/env bash
# End-to-end smoke test for /api/campaign-briefs. Assumes cookies.txt with a valid session.
set -euo pipefail
API=${API:-http://localhost:3002/api/campaign-briefs}
JQ=${JQ:-jq}

echo "1. Create draft…"
BRIEF=$(curl -fs -b cookies.txt -X POST "$API" | $JQ -r .brief.id)
echo "   id=$BRIEF"

echo "2. Chat turn — set the scene…"
curl -fs -b cookies.txt -X POST "$API/$BRIEF/chat/turn" \
  -H 'content-type: application/json' \
  -d '{"message":"Launch A350 Premium FR April 14th, Gold engaged + Silver dormant, objetive: drive upgrades"}' \
  | $JQ '.brief | {name,template_id,markets,status}'

echo "3. Generate options…"
curl -fs -b cookies.txt -X POST "$API/$BRIEF/options/generate" | $JQ '.options | length'

echo "4. Accept option 0…"
curl -fs -b cookies.txt -X POST "$API/$BRIEF/options/accept" \
  -H 'content-type: application/json' -d '{"optionIndex":0}' | $JQ '.brief.status'

echo "5. Regenerate AI opportunities…"
curl -fs -b cookies.txt -X POST "$API/ai-opportunities/regenerate" | $JQ '.briefs | length'

echo "✓ smoke passed"
```

- [ ] **Step 2: Run it**

```bash
chmod +x scripts/smoke-briefs.sh
./scripts/smoke-briefs.sh
# → prints 4 stages and "✓ smoke passed"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-briefs.sh
git commit -m "test(briefs): end-to-end curl smoke script"
```

### Task 8.3: Edge cases polish

- [ ] **Step 1: Handle Claude errors gracefully**

In `router.js`, wrap each Claude call in try/catch that returns `502` with a readable message:

```js
try { /* ... */ } catch (err) {
  console.error('[briefs] claude call failed', err);
  res.status(502).json({ error: 'AI service unavailable', detail: err.message });
}
```

Apply to `/chat/turn`, `/options/generate`, `/ai-opportunities/regenerate`.

- [ ] **Step 2: Frontend error surface**

In each `briefsApi` caller, wrap in try/catch and show `alert(err.message)` (we'll improve with a toast system outside this plan's scope — acceptable stopgap).

- [ ] **Step 3: Ensure .gitignore**

Confirm `.superpowers/` is in `.gitignore` (was added in brainstorming).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server/briefs/router.js apps/dashboard/src/pages/CampaignCreationV2
git commit -m "chore(cc2): error handling for AI endpoints"
```

---

## Self-Review

**Spec coverage (§ of spec → task):**
- §2 Flow map → Phase 2, 3, 4, 7 (full end-to-end wired)
- §3 Data model (campaign_briefs table) → Task 1.1
- §3 Mock signals catalog → Task 5.1
- §4.1 Page shell with tabs → Task 2.1
- §4.2 BriefsBoard two-column layout → Tasks 2.3 + 2.4 + 2.5
- §4.3 SetupChatView + BriefLivePanel → Phase 3 (Tasks 3.1 + 3.2)
- §4.4 ContentOptionsChat + modal preview → Phase 4 (Tasks 4.1 + 4.2)
- §4.5 OverviewDashboard → Task 6.1
- §4.6 CampaignsCalendar with BAU category colors → Task 6.2
- §4.7 CampaignWizard refactor (banner, purple borders, template lock) → Phase 7 (7.1 → 7.3)
- §5 API — 8 endpoints → Tasks 1.2 (skeleton), 3.1 (chat/turn), 4.1 (options), 5.2 (opportunities), 1.2 (dismiss built-in)
- §6 Brief states → enforced in DB check constraint (Task 1.1) + transitions wired across phases
- §7 i18n ES + EN → Task 8.1
- §8 Routing via query params → Task 2.1 (shell dispatcher)

**Placeholder scan:** none found. Every code step has concrete code; every run command has expected output.

**Type consistency:** `briefsApi` method names match across frontend callers; `POST /:id/options/accept` takes `{optionIndex}` everywhere; `accepted_option` shape (direction/headline/subject/preheader/body/cta_label/cta_url/mood) used consistently in generator + autofill.

---

## Execution Handoff

Plan complete and saved to [docs/superpowers/plans/2026-04-22-campaign-creation-v2-briefs-flow.md](docs/superpowers/plans/2026-04-22-campaign-creation-v2-briefs-flow.md). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration, main context stays clean.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
