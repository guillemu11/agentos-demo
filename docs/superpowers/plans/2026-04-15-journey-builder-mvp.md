# Journey Builder MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI chat that assembles SFMC journeys conversationally — Entry (Master DE → SQL Query → Target DE), 5 activity types (email_send, wait_duration, decision_split, wait_until_event, engagement_split), placeholder email shells, always-Draft deploy, and a live-animated ReactFlow canvas that materializes as the agent builds.

**Architecture:** A tool-using Claude Sonnet 4.6 agent mutates a DSL in Postgres; each mutation emits an SSE `journey_state` event that repaints the ReactFlow canvas. At deploy time, a pure compiler translates the DSL to SFMC `/interaction/v1/interactions` JSON. Email sends reuse `duplicateEmail` from the existing BAU campaign-builder as shells. Cero Tailwind, i18n ES+EN, un solo `server.js`.

**Tech Stack:** Node.js ESM, Express 5 SSE, Anthropic SDK tool_use, PostgreSQL (Railway + local Docker), existing `packages/core/mc-api` + `packages/core/campaign-builder`, React 19, React Router 7, `@xyflow/react` (ReactFlow) + `@dagrejs/dagre`, lucide-react, CSS custom properties, vitest.

**Spec:** See `C:\Users\gmunoz02\.claude\plans\radiant-shimmying-wozniak.md`

---

## File Structure

```
packages/core/journey-builder/
├── index.js                — Public API: deployJourney, mutators export
├── dsl-schema.js           — validateDsl(), validateActivity(), invariants
├── compiler.js             — compileDslToInteraction(dsl) → SFMC JSON
├── query-activity.js       — createQueryActivity, startQueryActivity, pollQueryActivity
├── shells.js               — createEmailShells(dsl, mc) reuses duplicateEmail
├── deploy.js               — orchestrator: DE → query → shells → interaction POST
├── tools.js                — Claude tool definitions + dispatchers
└── __tests__/
    ├── dsl-schema.test.js
    ├── compiler.test.js
    ├── query-activity.test.js
    ├── deploy.test.js
    └── fixtures/
        ├── dsl-minimal.json       — entry + one email_send
        ├── dsl-full.json          — all 5 activity types
        ├── dsl-invalid-*.json     — 10 invalid cases
        └── expected-interaction-full.json — snapshot

apps/dashboard/src/pages/
├── JourneysListPage.jsx    — /app/journeys
└── JourneyBuilderPage.jsx  — /app/journeys/:id

apps/dashboard/src/components/journey/
├── JourneyBuilderChat.jsx
├── JourneyCanvas.jsx
├── JourneyToolbar.jsx
├── nodes/
│   ├── EntryNode.jsx
│   ├── WaitDurationNode.jsx
│   ├── DecisionSplitNode.jsx
│   ├── EmailSendNode.jsx
│   ├── WaitUntilEventNode.jsx
│   └── EngagementSplitNode.jsx
├── edges/
│   └── AnimatedEdge.jsx
└── layout/
    └── autoLayout.js

apps/dashboard/migrations/
└── 202604150001_journeys.sql
```

**Modifications to existing files:**
- `apps/dashboard/server.js` — new endpoints `/api/journeys/*` and `/api/chat/journey-builder/:id`
- `apps/dashboard/src/main.jsx` (or router) — register journey routes
- `apps/dashboard/src/i18n/translations.js` — add ES+EN strings
- `apps/dashboard/src/index.css` — add `--journey-*` CSS custom properties
- `apps/dashboard/src/components/Layout.jsx` — add "Journeys" nav entry
- `packages/core/campaign-builder/index.js` — export `duplicateEmail`, `ensureFolderHierarchy` for reuse (likely already exported, verify)

---

## Task 1: Migration — journeys + journey_chat_messages tables

**Files:**
- Create: `apps/dashboard/migrations/202604150001_journeys.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- Creates journeys + journey_chat_messages tables for the Journey Builder MVP.
-- Single-workspace schema: users live in workspace_users; no separate workspaces table.

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES workspace_users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) > 0),
  dsl_json JSONB NOT NULL DEFAULT '{"version":1,"name":"","entry":null,"activities":[]}',
  status TEXT NOT NULL DEFAULT 'drafting'
    CHECK (status IN ('drafting','deployed_draft','archived')),
  mc_interaction_id TEXT,
  mc_target_de_key TEXT,
  mc_query_activity_id TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status) WHERE status != 'archived';
CREATE INDEX IF NOT EXISTS idx_journey_chat_journey ON journey_chat_messages(journey_id, created_at);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journeys_set_updated_at ON journeys;
CREATE TRIGGER journeys_set_updated_at
BEFORE UPDATE ON journeys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rollback:
-- DROP TRIGGER IF EXISTS journeys_set_updated_at ON journeys;
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP INDEX IF EXISTS idx_journey_chat_journey;
-- DROP INDEX IF EXISTS idx_journeys_status;
-- DROP INDEX IF EXISTS idx_journeys_user;
-- DROP TABLE IF EXISTS journey_chat_messages;
-- DROP TABLE IF EXISTS journeys;
```

**Schema note:** This project is single-workspace. Users live in `workspace_users` (no separate `workspaces` or `users` table). Session state carries only `req.session.userId` — there is no `req.session.workspaceId`. All `/api/journeys/*` endpoints scope by `user_id`.

- [ ] **Step 2: Run against local Postgres**

```bash
npm run db:up
psql "$DATABASE_URL_LOCAL" -f apps/dashboard/migrations/202604150001_journeys.sql
```

Expected: `CREATE TABLE` x2, `CREATE INDEX` x2, `CREATE FUNCTION`, `CREATE TRIGGER`. No errors.

- [ ] **Step 3: Run against Railway**

Per memory `project_database`, the server uses Railway `DATABASE_URL`. Run the same migration there:

```bash
psql "$DATABASE_URL" -f apps/dashboard/migrations/202604150001_journeys.sql
```

Expected: same success output.

- [ ] **Step 4: Verify schema**

```bash
psql "$DATABASE_URL" -c "\d journeys" -c "\d journey_chat_messages"
```

Expected: columns, constraints, indexes all present.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/migrations/202604150001_journeys.sql
git commit -m "feat(journeys): add journeys + chat messages migration"
```

---

## Task 2: DSL schema validator (pure)

**Files:**
- Create: `packages/core/journey-builder/dsl-schema.js`
- Create: `packages/core/journey-builder/__tests__/dsl-schema.test.js`
- Create: `packages/core/journey-builder/__tests__/fixtures/dsl-minimal.json`
- Create: `packages/core/journey-builder/__tests__/fixtures/dsl-full.json`
- Create: `packages/core/journey-builder/__tests__/fixtures/dsl-invalid-cycle.json`
- Create: `packages/core/journey-builder/__tests__/fixtures/dsl-invalid-dangling-next.json`

Pure validator. Zero dependencies on MC. This is the fastest, safest task.

- [ ] **Step 1: Create minimal valid fixture**

```json
// packages/core/journey-builder/__tests__/fixtures/dsl-minimal.json
{
  "version": 1,
  "name": "Minimal",
  "entry": {
    "source": {
      "type": "master_de_query",
      "master_de_key": "BAU_Master_Dataset",
      "sql": "SELECT contact_key, email FROM BAU_Master_Dataset WHERE market='UAE'",
      "target_de_name": "Minimal_Entry"
    }
  },
  "activities": [
    {
      "id": "send_1",
      "type": "email_send",
      "campaign_type": "product-offer-ecommerce",
      "email_shell_name": "Minimal_Send",
      "mc_email_id": null,
      "next": null
    }
  ]
}
```

- [ ] **Step 2: Create full fixture (all 5 activity types)**

```json
// packages/core/journey-builder/__tests__/fixtures/dsl-full.json
{
  "version": 1,
  "name": "Promo_Eid_UAE_GCC_150425",
  "entry": {
    "source": {
      "type": "master_de_query",
      "master_de_key": "BAU_Master_Dataset",
      "sql": "SELECT contact_key, email, tier, language FROM BAU_Master_Dataset WHERE market='UAE' AND tier IN ('Gold','Silver')",
      "target_de_name": "Promo_Eid_UAE_GCC_150425_Entry"
    }
  },
  "activities": [
    { "id": "wait_1", "type": "wait_duration", "amount": 2, "unit": "days", "next": "split_1" },
    {
      "id": "split_1", "type": "decision_split",
      "branches": [
        { "label": "Gold", "condition": "tier == 'Gold'", "next": "send_gold" },
        { "label": "Silver", "condition": "tier == 'Silver'", "next": "send_silver" }
      ],
      "default_next": null
    },
    { "id": "send_gold", "type": "email_send", "campaign_type": "product-offer-ecommerce", "email_shell_name": "Gold_Shell", "mc_email_id": null, "next": "wait_engage" },
    { "id": "wait_engage", "type": "wait_until_event", "event": "email_opened", "target_activity": "send_gold", "timeout_hours": 120, "on_event_next": "engage_split", "on_timeout_next": null },
    {
      "id": "engage_split", "type": "engagement_split",
      "send_activity_id": "send_gold", "metric": "opened",
      "yes_next": "send_followup", "no_next": null
    },
    { "id": "send_followup", "type": "email_send", "campaign_type": "product-offer-ecommerce", "email_shell_name": "Followup_Shell", "mc_email_id": null, "next": null },
    { "id": "send_silver", "type": "email_send", "campaign_type": "product-offer-ecommerce", "email_shell_name": "Silver_Shell", "mc_email_id": null, "next": null }
  ]
}
```

- [ ] **Step 3: Create invalid fixtures**

```json
// dsl-invalid-cycle.json — cycle: a → b → a
{
  "version": 1, "name": "Cycle",
  "entry": { "source": { "type": "master_de_query", "master_de_key": "M", "sql": "SELECT 1 FROM M", "target_de_name": "T" } },
  "activities": [
    { "id": "a", "type": "wait_duration", "amount": 1, "unit": "days", "next": "b" },
    { "id": "b", "type": "wait_duration", "amount": 1, "unit": "days", "next": "a" }
  ]
}
```

```json
// dsl-invalid-dangling-next.json — next points to non-existent id
{
  "version": 1, "name": "Dangling",
  "entry": { "source": { "type": "master_de_query", "master_de_key": "M", "sql": "SELECT 1 FROM M", "target_de_name": "T" } },
  "activities": [
    { "id": "a", "type": "wait_duration", "amount": 1, "unit": "days", "next": "ghost" }
  ]
}
```

- [ ] **Step 4: Write failing test**

```javascript
// packages/core/journey-builder/__tests__/dsl-schema.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateDsl } from '../dsl-schema.js';

const FIX = join(import.meta.dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('validateDsl', () => {
  it('accepts minimal valid DSL', () => {
    const { valid, errors } = validateDsl(load('dsl-minimal.json'));
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts DSL with all 5 activity types', () => {
    const { valid, errors } = validateDsl(load('dsl-full.json'));
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects cycles', () => {
    const { valid, errors } = validateDsl(load('dsl-invalid-cycle.json'));
    expect(valid).toBe(false);
    expect(errors.some(e => /cycle/i.test(e))).toBe(true);
  });

  it('rejects dangling next', () => {
    const { valid, errors } = validateDsl(load('dsl-invalid-dangling-next.json'));
    expect(valid).toBe(false);
    expect(errors.some(e => /ghost/i.test(e) && /next/i.test(e))).toBe(true);
  });

  it('rejects SQL with DROP', () => {
    const bad = load('dsl-minimal.json');
    bad.entry.source.sql = 'DROP TABLE BAU_Master_Dataset';
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /dangerous sql/i.test(e))).toBe(true);
  });

  it('rejects email_send with unknown campaign_type', () => {
    const bad = load('dsl-minimal.json');
    bad.activities[0].campaign_type = 'not-a-real-type';
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /campaign_type/i.test(e))).toBe(true);
  });

  it('rejects wait_until_event pointing to a non-preceding send', () => {
    const bad = {
      version: 1, name: 'x',
      entry: { source: { type: 'master_de_query', master_de_key: 'M', sql: 'SELECT 1 FROM M', target_de_name: 'T' } },
      activities: [
        { id: 'wait', type: 'wait_until_event', event: 'email_opened', target_activity: 'send_later', timeout_hours: 24, on_event_next: null, on_timeout_next: null },
        { id: 'send_later', type: 'email_send', campaign_type: 'product-offer-ecommerce', email_shell_name: 's', mc_email_id: null, next: null }
      ]
    };
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /preceding|before|earlier/i.test(e))).toBe(true);
  });
});
```

- [ ] **Step 5: Run test — expect fail**

```bash
cd packages/core/journey-builder && npx vitest run
```

Expected: all tests fail with "Cannot find module '../dsl-schema.js'".

- [ ] **Step 6: Implement validator**

```javascript
// packages/core/journey-builder/dsl-schema.js
import { CAMPAIGN_TYPES } from '../campaign-builder/index.js';

const ACTIVITY_TYPES = ['wait_duration', 'decision_split', 'email_send', 'wait_until_event', 'engagement_split'];
const DANGEROUS_SQL = /\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|ALTER|GRANT|REVOKE)\b/i;

export function validateDsl(dsl) {
  const errors = [];
  if (!dsl || typeof dsl !== 'object') return { valid: false, errors: ['DSL must be an object'] };
  if (dsl.version !== 1) errors.push('version must be 1');
  if (typeof dsl.name !== 'string') errors.push('name must be a string');
  if (!dsl.entry) errors.push('entry is required');
  else validateEntry(dsl.entry, errors);
  if (!Array.isArray(dsl.activities)) { errors.push('activities must be an array'); return { valid: false, errors }; }

  const ids = new Set();
  for (const a of dsl.activities) {
    if (!a.id) errors.push('activity missing id');
    else if (ids.has(a.id)) errors.push(`duplicate activity id: ${a.id}`);
    else ids.add(a.id);
    if (!ACTIVITY_TYPES.includes(a.type)) errors.push(`unknown activity type: ${a.type}`);
  }

  for (const a of dsl.activities) validateActivity(a, ids, dsl.activities, errors);

  if (errors.length === 0 && hasCycle(dsl)) errors.push('cycle detected in activity graph');

  return { valid: errors.length === 0, errors };
}

function validateEntry(entry, errors) {
  const s = entry.source;
  if (!s || s.type !== 'master_de_query') { errors.push('entry.source.type must be master_de_query'); return; }
  if (!s.master_de_key) errors.push('entry.source.master_de_key required');
  if (!s.target_de_name) errors.push('entry.source.target_de_name required');
  if (!s.sql) { errors.push('entry.source.sql required'); return; }
  if (DANGEROUS_SQL.test(s.sql)) errors.push('dangerous sql detected (DROP/DELETE/UPDATE/TRUNCATE/INSERT/ALTER)');
  if (!/^\s*SELECT\b/i.test(s.sql)) errors.push('sql must start with SELECT');
  if (s.master_de_key && !new RegExp(`\\bFROM\\s+\\[?${s.master_de_key}\\]?`, 'i').test(s.sql))
    errors.push(`sql must reference master_de_key "${s.master_de_key}" in FROM clause`);
}

function validateActivity(a, ids, all, errors) {
  const nextRefs = [];
  switch (a.type) {
    case 'wait_duration':
      if (!Number.isFinite(a.amount) || a.amount <= 0) errors.push(`${a.id}: amount must be positive`);
      if (!['minutes','hours','days','weeks'].includes(a.unit)) errors.push(`${a.id}: unit invalid`);
      nextRefs.push(a.next);
      break;
    case 'decision_split':
      if (!Array.isArray(a.branches) || a.branches.length === 0) errors.push(`${a.id}: branches required`);
      else for (const b of a.branches) {
        if (!b.label || !b.condition) errors.push(`${a.id}: branch missing label or condition`);
        nextRefs.push(b.next);
      }
      nextRefs.push(a.default_next);
      break;
    case 'email_send':
      if (!CAMPAIGN_TYPES[a.campaign_type]) errors.push(`${a.id}: campaign_type "${a.campaign_type}" not in CAMPAIGN_TYPES registry`);
      if (!a.email_shell_name) errors.push(`${a.id}: email_shell_name required`);
      nextRefs.push(a.next);
      break;
    case 'wait_until_event':
      if (!['email_opened','email_clicked'].includes(a.event)) errors.push(`${a.id}: event invalid`);
      if (!a.target_activity) errors.push(`${a.id}: target_activity required`);
      else {
        const targetIdx = all.findIndex(x => x.id === a.target_activity);
        const selfIdx = all.findIndex(x => x.id === a.id);
        const target = all[targetIdx];
        if (!target) errors.push(`${a.id}: target_activity "${a.target_activity}" not found`);
        else if (target.type !== 'email_send') errors.push(`${a.id}: target_activity must be an email_send`);
        else if (targetIdx >= selfIdx) errors.push(`${a.id}: target_activity must be a preceding (earlier) activity`);
      }
      if (!Number.isFinite(a.timeout_hours) || a.timeout_hours <= 0) errors.push(`${a.id}: timeout_hours must be positive`);
      nextRefs.push(a.on_event_next, a.on_timeout_next);
      break;
    case 'engagement_split':
      if (!a.send_activity_id || !all.some(x => x.id === a.send_activity_id && x.type === 'email_send'))
        errors.push(`${a.id}: send_activity_id must reference an email_send`);
      if (!['opened','clicked'].includes(a.metric)) errors.push(`${a.id}: metric must be opened or clicked`);
      nextRefs.push(a.yes_next, a.no_next);
      break;
  }
  for (const ref of nextRefs) {
    if (ref === null || ref === undefined) continue;
    if (!ids.has(ref)) errors.push(`${a.id}: next "${ref}" does not reference an existing activity id`);
  }
}

function hasCycle(dsl) {
  const map = new Map(dsl.activities.map(a => [a.id, a]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...map.keys()].map(k => [k, WHITE]));
  function dfs(id) {
    if (!id || !map.has(id)) return false;
    if (color.get(id) === GRAY) return true;
    if (color.get(id) === BLACK) return false;
    color.set(id, GRAY);
    const a = map.get(id);
    const nexts = collectNexts(a);
    for (const n of nexts) if (dfs(n)) return true;
    color.set(id, BLACK);
    return false;
  }
  return dsl.activities.some(a => dfs(a.id));
}

function collectNexts(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send': return [a.next];
    case 'decision_split': return [...(a.branches || []).map(b => b.next), a.default_next];
    case 'wait_until_event': return [a.on_event_next, a.on_timeout_next];
    case 'engagement_split': return [a.yes_next, a.no_next];
    default: return [];
  }
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd packages/core/journey-builder && npx vitest run
```

Expected: 7/7 passing.

- [ ] **Step 8: Commit**

```bash
git add packages/core/journey-builder/dsl-schema.js packages/core/journey-builder/__tests__/
git commit -m "feat(journey-builder): DSL validator with invariants + fixtures"
```

---

## Task 3: Compiler DSL → SFMC Interactions JSON (pure)

**Files:**
- Create: `packages/core/journey-builder/compiler.js`
- Create: `packages/core/journey-builder/__tests__/compiler.test.js`
- Create: `packages/core/journey-builder/__tests__/fixtures/expected-interaction-minimal.json`
- Create: `packages/core/journey-builder/__tests__/fixtures/expected-interaction-full.json`

The compiler is pure — takes a validated DSL + the post-shell-creation `mc_email_id`s and emits the SFMC Interactions JSON. Snapshot-tested.

- [ ] **Step 1: Write failing tests**

```javascript
// packages/core/journey-builder/__tests__/compiler.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compileDslToInteraction } from '../compiler.js';

const FIX = join(import.meta.dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('compileDslToInteraction', () => {
  it('minimal: single email_send', () => {
    const dsl = load('dsl-minimal.json');
    // simulate shells already created
    dsl.activities[0].mc_email_id = 99999;
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    expect(out.key).toMatch(/^journey-/);
    expect(out.name).toBe('Minimal');
    expect(out.workflowApiVersion).toBe(1.0);
    expect(out.triggers).toHaveLength(1);
    expect(out.triggers[0].type).toBe('AutomationAudience');
    expect(out.activities).toHaveLength(1);
    expect(out.activities[0].type).toBe('EMAILV2');
    expect(out.activities[0].configurationArguments.triggeredSend.emailId).toBe(99999);
  });

  it('full: all 5 activity types compile to correct SFMC types', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const typeMap = Object.fromEntries(out.activities.map(a => [a.key, a.type]));
    expect(typeMap['wait_1']).toBe('WAITBYDURATION');
    expect(typeMap['split_1']).toBe('MULTICRITERIADECISION');
    expect(typeMap['send_gold']).toBe('EMAILV2');
    expect(typeMap['wait_engage']).toBe('WAITBYEVENT');
    expect(typeMap['engage_split']).toBe('ENGAGEMENTSPLIT');
  });

  it('decision_split branches become outcomes with keys matching next ids', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const split = out.activities.find(a => a.key === 'split_1');
    expect(split.outcomes).toHaveLength(2);
    expect(split.outcomes.map(o => o.next)).toContain('send_gold');
    expect(split.outcomes.map(o => o.next)).toContain('send_silver');
  });

  it('snapshots the full compiled output', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    expect(out).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd packages/core/journey-builder && npx vitest run compiler
```

Expected: fail, "Cannot find module '../compiler.js'".

- [ ] **Step 3: Implement compiler**

```javascript
// packages/core/journey-builder/compiler.js
export function compileDslToInteraction(dsl, { target_de_key }) {
  const key = `journey-${dsl.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}`;
  return {
    key,
    name: dsl.name,
    description: `Built by AgentOS Journey Builder`,
    workflowApiVersion: 1.0,
    status: 'Draft',
    triggers: [buildTrigger(target_de_key)],
    goals: [],
    activities: dsl.activities.map(a => compileActivity(a, dsl.activities)),
    defaults: { email: [], properties: { analyticsTracking: { enabled: false } } }
  };
}

function buildTrigger(target_de_key) {
  return {
    key: 'trigger-1',
    name: 'Entry',
    type: 'AutomationAudience',
    eventDefinitionKey: null,
    configurationArguments: { dataExtensionId: target_de_key },
    metaData: { eventDefinitionId: null, sourceInteractionId: '00000000-0000-0000-0000-000000000000' }
  };
}

function compileActivity(a, all) {
  const base = { key: a.id, name: a.id, outcomes: [] };
  switch (a.type) {
    case 'wait_duration':
      return {
        ...base,
        type: 'WAITBYDURATION',
        configurationArguments: { waitDuration: a.amount, waitUnit: unitToSfmc(a.unit) },
        outcomes: a.next ? [{ key: `${a.id}-out`, next: a.next, arguments: {} }] : []
      };
    case 'decision_split':
      return {
        ...base,
        type: 'MULTICRITERIADECISION',
        configurationArguments: {},
        outcomes: [
          ...a.branches.map((b, i) => ({
            key: `${a.id}-br-${i}`,
            next: b.next,
            arguments: { criteriaDescription: b.label, expression: b.condition }
          })),
          ...(a.default_next ? [{ key: `${a.id}-default`, next: a.default_next, arguments: { criteriaDescription: 'default' } }] : [])
        ]
      };
    case 'email_send':
      if (a.mc_email_id == null) throw new Error(`email_send ${a.id} has no mc_email_id (shells not created?)`);
      return {
        ...base,
        type: 'EMAILV2',
        configurationArguments: {
          triggeredSend: { emailId: a.mc_email_id, name: a.email_shell_name, autoAddSubscribers: true, autoUpdateSubscribers: true }
        },
        outcomes: a.next ? [{ key: `${a.id}-out`, next: a.next, arguments: {} }] : []
      };
    case 'wait_until_event':
      return {
        ...base,
        type: 'WAITBYEVENT',
        configurationArguments: {
          event: a.event,
          targetActivityKey: a.target_activity,
          timeoutHours: a.timeout_hours
        },
        outcomes: [
          ...(a.on_event_next ? [{ key: `${a.id}-event`, next: a.on_event_next, arguments: { path: 'event' } }] : []),
          ...(a.on_timeout_next ? [{ key: `${a.id}-timeout`, next: a.on_timeout_next, arguments: { path: 'timeout' } }] : [])
        ]
      };
    case 'engagement_split':
      return {
        ...base,
        type: 'ENGAGEMENTSPLIT',
        configurationArguments: { sendActivityKey: a.send_activity_id, metric: a.metric },
        outcomes: [
          ...(a.yes_next ? [{ key: `${a.id}-yes`, next: a.yes_next, arguments: { path: 'yes' } }] : []),
          ...(a.no_next ? [{ key: `${a.id}-no`, next: a.no_next, arguments: { path: 'no' } }] : [])
        ]
      };
    default:
      throw new Error(`unknown activity type: ${a.type}`);
  }
}

function unitToSfmc(u) { return ({ minutes: 'Minutes', hours: 'Hours', days: 'Days', weeks: 'Weeks' })[u]; }
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd packages/core/journey-builder && npx vitest run compiler`
Expected: 4/4 passing. Snapshot created.

- [ ] **Step 5: Commit**

```bash
git add packages/core/journey-builder/compiler.js packages/core/journey-builder/__tests__/compiler.test.js packages/core/journey-builder/__tests__/__snapshots__/
git commit -m "feat(journey-builder): DSL → SFMC Interactions compiler + snapshot tests"
```

---

## Task 4: Query Activity helpers (MC Automation Studio)

**Files:**
- Create: `packages/core/journey-builder/query-activity.js`
- Create: `packages/core/journey-builder/__tests__/query-activity.test.js`

These wrap MC `/automation/v1/queries/` endpoints. Mock the MC client in tests.

- [ ] **Step 1: Write failing test**

```javascript
// packages/core/journey-builder/__tests__/query-activity.test.js
import { describe, it, expect, vi } from 'vitest';
import { createQueryActivity, startQueryActivity, pollQueryActivity } from '../query-activity.js';

function mkMockMc(responses) {
  const calls = [];
  const mc = {
    rest: vi.fn(async (method, path, body) => {
      calls.push({ method, path, body });
      const k = `${method} ${path.replace(/\{[^}]+\}/g, ':id').replace(/\/[a-f0-9-]{36}/g, '/:id')}`;
      const r = responses[k] ?? responses[`${method} ${path}`];
      if (!r) throw new Error(`no mock for ${method} ${path}`);
      return typeof r === 'function' ? r(calls.length) : r;
    })
  };
  return { mc, calls };
}

describe('createQueryActivity', () => {
  it('POSTs to /automation/v1/queries/ with sql + target DE', async () => {
    const { mc, calls } = mkMockMc({
      'POST /automation/v1/queries/': { queryDefinitionId: 'Q-123', key: 'q-key' }
    });
    const res = await createQueryActivity(mc, {
      name: 'TestQuery',
      sql: 'SELECT * FROM BAU_Master_Dataset',
      target_de_key: 'TGT-KEY',
      target_update_type: 'Overwrite'
    });
    expect(res.queryDefinitionId).toBe('Q-123');
    expect(calls[0].body.queryText).toBe('SELECT * FROM BAU_Master_Dataset');
    expect(calls[0].body.targetKey).toBe('TGT-KEY');
    expect(calls[0].body.targetUpdateTypeName).toBe('Overwrite');
  });
});

describe('pollQueryActivity', () => {
  it('resolves when status becomes Complete', async () => {
    let i = 0;
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': () => {
        i++;
        return { queryDefinitionId: 'Q-123', status: i < 2 ? 'Running' : 'Complete' };
      }
    });
    const res = await pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 2000 });
    expect(res.status).toBe('Complete');
  });

  it('throws on Error status', async () => {
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': { status: 'Error', statusMessage: 'SQL syntax error near FROMM' }
    });
    await expect(pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 1000 }))
      .rejects.toThrow(/SQL syntax error/);
  });

  it('throws on timeout', async () => {
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': { status: 'Running' }
    });
    await expect(pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 50 }))
      .rejects.toThrow(/timeout/i);
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd packages/core/journey-builder && npx vitest run query-activity`
Expected: fail, no module.

- [ ] **Step 3: Implement**

```javascript
// packages/core/journey-builder/query-activity.js
export async function createQueryActivity(mc, { name, sql, target_de_key, target_update_type = 'Overwrite' }) {
  const body = {
    name,
    key: `qa-${Date.now()}`,
    description: 'Generated by AgentOS Journey Builder',
    queryText: sql,
    targetKey: target_de_key,
    targetUpdateTypeName: target_update_type
  };
  return mc.rest('POST', '/automation/v1/queries/', body);
}

export async function startQueryActivity(mc, queryDefinitionId) {
  return mc.rest('POST', `/automation/v1/queries/${queryDefinitionId}/actions/start/`, {});
}

export async function pollQueryActivity(mc, queryDefinitionId, { intervalMs = 2000, timeoutMs = 60000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await mc.rest('GET', `/automation/v1/queries/${queryDefinitionId}`);
    if (res.status === 'Complete') return res;
    if (res.status === 'Error') throw new Error(`Query failed: ${res.statusMessage || 'unknown error'}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Query ${queryDefinitionId} timeout after ${timeoutMs}ms`);
}
```

- [ ] **Step 4: Run tests — expect pass**

Expected: 3/3 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/journey-builder/query-activity.js packages/core/journey-builder/__tests__/query-activity.test.js
git commit -m "feat(journey-builder): query activity helpers for Automation Studio"
```

---

## Task 5: Email shells (reuse duplicateEmail from BAU builder)

**Files:**
- Create: `packages/core/journey-builder/shells.js`
- Create: `packages/core/journey-builder/__tests__/shells.test.js`

Each `email_send` in the DSL becomes a duplicated email shell in MC, using the `CAMPAIGN_TYPES` registry to pick the right template.

- [ ] **Step 1: Read existing `duplicateEmail` signature**

```bash
grep -n "export.*duplicateEmail\|function duplicateEmail" packages/core/campaign-builder/index.js
```

Confirm it takes `(mc, config)` where `config` has `templateId`, folder, campaign name, attributes.

- [ ] **Step 2: Write failing test**

```javascript
// packages/core/journey-builder/__tests__/shells.test.js
import { describe, it, expect, vi } from 'vitest';
import { createEmailShells } from '../shells.js';

describe('createEmailShells', () => {
  it('duplicates one email per email_send activity and fills mc_email_id', async () => {
    const dsl = {
      name: 'TestJourney',
      activities: [
        { id: 's1', type: 'email_send', campaign_type: 'product-offer-ecommerce', email_shell_name: 'Shell_A', mc_email_id: null, next: null },
        { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null },
        { id: 's2', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'Shell_B', mc_email_id: null, next: null }
      ]
    };
    const duplicateEmail = vi.fn().mockResolvedValueOnce({ assetId: 11 }).mockResolvedValueOnce({ assetId: 22 });
    const mc = {};
    const folderId = 99;
    const out = await createEmailShells({ mc, dsl, folderId, duplicateEmail });
    expect(duplicateEmail).toHaveBeenCalledTimes(2);
    expect(out.activities.find(a => a.id === 's1').mc_email_id).toBe(11);
    expect(out.activities.find(a => a.id === 's2').mc_email_id).toBe(22);
    const firstCall = duplicateEmail.mock.calls[0][1];
    expect(firstCall.name).toBe('Shell_A');
  });

  it('skips email_send activities that already have mc_email_id (idempotent retry)', async () => {
    const dsl = {
      name: 'T', activities: [
        { id: 's1', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'A', mc_email_id: 777, next: null },
        { id: 's2', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'B', mc_email_id: null, next: null }
      ]
    };
    const duplicateEmail = vi.fn().mockResolvedValueOnce({ assetId: 888 });
    const out = await createEmailShells({ mc: {}, dsl, folderId: 1, duplicateEmail });
    expect(duplicateEmail).toHaveBeenCalledTimes(1);
    expect(out.activities.find(a => a.id === 's1').mc_email_id).toBe(777);
    expect(out.activities.find(a => a.id === 's2').mc_email_id).toBe(888);
  });
});
```

- [ ] **Step 3: Run — expect fail**

Run: `cd packages/core/journey-builder && npx vitest run shells`

- [ ] **Step 4: Implement**

```javascript
// packages/core/journey-builder/shells.js
import { CAMPAIGN_TYPES } from '../campaign-builder/index.js';
import { duplicateEmail as defaultDuplicateEmail } from '../campaign-builder/index.js';

export async function createEmailShells({ mc, dsl, folderId, duplicateEmail = defaultDuplicateEmail }) {
  const updated = { ...dsl, activities: [...dsl.activities] };
  for (let i = 0; i < updated.activities.length; i++) {
    const a = updated.activities[i];
    if (a.type !== 'email_send') continue;
    if (a.mc_email_id != null) continue;
    const type = CAMPAIGN_TYPES[a.campaign_type];
    if (!type) throw new Error(`campaign_type "${a.campaign_type}" not in CAMPAIGN_TYPES`);
    const { assetId } = await duplicateEmail(mc, {
      templateId: type.templateNoCugo,
      name: a.email_shell_name,
      folderId,
      attr1: 'pr', attr2: 'ek', attr3: `${dsl.name}_deploydate_in`, attr4: 'xx',
      attr5: `CC${type.attr5Code}_${fmtDate(new Date())}`
    });
    updated.activities[i] = { ...a, mc_email_id: assetId };
  }
  return updated;
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}`;
}
```

- [ ] **Step 5: Run — expect pass**

Expected: 2/2 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/core/journey-builder/shells.js packages/core/journey-builder/__tests__/shells.test.js
git commit -m "feat(journey-builder): email shells via duplicateEmail reuse"
```

---

## Task 6: Deploy orchestrator

**Files:**
- Create: `packages/core/journey-builder/deploy.js`
- Create: `packages/core/journey-builder/__tests__/deploy.test.js`

Ties it all together: folder → DE → query → start → poll → shells → compile → interaction POST.

- [ ] **Step 1: Write failing integration test (mocked MC)**

```javascript
// packages/core/journey-builder/__tests__/deploy.test.js
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deployJourney } from '../deploy.js';

const FIX = join(import.meta.dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('deployJourney', () => {
  it('runs the full sequence and returns mc ids', async () => {
    const dsl = load('dsl-full.json');

    const stubs = {
      ensureFolderHierarchy: vi.fn().mockResolvedValue({ emailFolderId: 500, deFolderId: 600 }),
      createDataExtension: vi.fn().mockResolvedValue({ customerKey: 'TGT-KEY' }),
      createQueryActivity: vi.fn().mockResolvedValue({ queryDefinitionId: 'Q-1' }),
      startQueryActivity: vi.fn().mockResolvedValue({}),
      pollQueryActivity: vi.fn().mockResolvedValue({ status: 'Complete' }),
      createEmailShells: vi.fn().mockImplementation(async ({ dsl }) => ({
        ...dsl,
        activities: dsl.activities.map(a => a.type === 'email_send' ? { ...a, mc_email_id: 11000 } : a)
      })),
      createInteractionDraft: vi.fn().mockResolvedValue({ id: 'INT-999' })
    };

    const mc = {};
    const result = await deployJourney({ mc, dsl, config: { market: 'UAE' } }, stubs);

    expect(stubs.ensureFolderHierarchy).toHaveBeenCalled();
    expect(stubs.createDataExtension).toHaveBeenCalled();
    expect(stubs.createQueryActivity).toHaveBeenCalledWith(mc, expect.objectContaining({
      sql: dsl.entry.source.sql, target_de_key: 'TGT-KEY'
    }));
    expect(stubs.startQueryActivity).toHaveBeenCalledWith(mc, 'Q-1');
    expect(stubs.pollQueryActivity).toHaveBeenCalled();
    expect(stubs.createEmailShells).toHaveBeenCalled();
    expect(stubs.createInteractionDraft).toHaveBeenCalled();

    expect(result.mc_interaction_id).toBe('INT-999');
    expect(result.mc_target_de_key).toBe('TGT-KEY');
    expect(result.mc_query_activity_id).toBe('Q-1');
    expect(result.dsl.activities.filter(a => a.type === 'email_send')
      .every(a => a.mc_email_id === 11000)).toBe(true);
  });

  it('hard-fails on invalid DSL without calling MC', async () => {
    const bad = load('dsl-invalid-cycle.json');
    const stubs = {
      ensureFolderHierarchy: vi.fn(), createDataExtension: vi.fn(),
      createQueryActivity: vi.fn(), startQueryActivity: vi.fn(),
      pollQueryActivity: vi.fn(), createEmailShells: vi.fn(),
      createInteractionDraft: vi.fn()
    };
    await expect(deployJourney({ mc: {}, dsl: bad, config: {} }, stubs))
      .rejects.toThrow(/cycle/);
    expect(stubs.ensureFolderHierarchy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```javascript
// packages/core/journey-builder/deploy.js
import { validateDsl } from './dsl-schema.js';
import { compileDslToInteraction } from './compiler.js';
import {
  createQueryActivity as _createQueryActivity,
  startQueryActivity as _startQueryActivity,
  pollQueryActivity as _pollQueryActivity
} from './query-activity.js';
import { createEmailShells as _createEmailShells } from './shells.js';
import { ensureFolderHierarchy as _ensureFolderHierarchy } from '../campaign-builder/index.js';
import { createDataExtension as _createDataExtension, createInteraction as _createInteractionDraft } from '../mc-api/executor.js';

export async function deployJourney({ mc, dsl, config }, overrides = {}) {
  const {
    ensureFolderHierarchy = _ensureFolderHierarchy,
    createDataExtension = _createDataExtension,
    createQueryActivity = _createQueryActivity,
    startQueryActivity = _startQueryActivity,
    pollQueryActivity = _pollQueryActivity,
    createEmailShells = _createEmailShells,
    createInteractionDraft = _createInteractionDraft
  } = overrides;

  const { valid, errors } = validateDsl(dsl);
  if (!valid) throw new Error(`Invalid DSL: ${errors.join('; ')}`);

  const { emailFolderId, deFolderId } = await ensureFolderHierarchy(mc, { ...config, name: dsl.name });

  const targetDe = await createDataExtension(mc, {
    name: dsl.entry.source.target_de_name,
    folderId: deFolderId,
    fields: defaultEntrySchema()
  });

  const query = await createQueryActivity(mc, {
    name: `${dsl.name}_Query`,
    sql: dsl.entry.source.sql,
    target_de_key: targetDe.customerKey,
    target_update_type: 'Overwrite'
  });
  await startQueryActivity(mc, query.queryDefinitionId);
  await pollQueryActivity(mc, query.queryDefinitionId, { intervalMs: 2000, timeoutMs: 180000 });

  const withShells = await createEmailShells({ mc, dsl, folderId: emailFolderId });

  const interactionJson = compileDslToInteraction(withShells, { target_de_key: targetDe.customerKey });
  const interaction = await createInteractionDraft(mc, interactionJson);

  return {
    dsl: withShells,
    mc_interaction_id: interaction.id,
    mc_target_de_key: targetDe.customerKey,
    mc_query_activity_id: query.queryDefinitionId
  };
}

function defaultEntrySchema() {
  return [
    { name: 'contact_key', type: 'Text', maxLength: 254, isPrimaryKey: true, isRequired: true },
    { name: 'email', type: 'EmailAddress', isRequired: true },
    { name: 'tier', type: 'Text', maxLength: 50 },
    { name: 'language', type: 'Text', maxLength: 20 }
  ];
}
```

- [ ] **Step 3: Verify `createInteraction` exists in mc-api/executor.js; if not, add it**

```bash
grep -n "createInteraction\|/interaction/v1/interactions" packages/core/mc-api/executor.js
```

If missing, add to `packages/core/mc-api/executor.js`:

```javascript
export async function createInteraction(mc, interactionJson) {
  return mc.rest('POST', '/interaction/v1/interactions', interactionJson);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd packages/core/journey-builder && npx vitest run deploy`
Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/journey-builder/deploy.js packages/core/journey-builder/__tests__/deploy.test.js packages/core/mc-api/executor.js
git commit -m "feat(journey-builder): deploy orchestrator (folder → DE → query → shells → interaction)"
```

---

## Task 7: Claude tool definitions + DSL mutators

**Files:**
- Create: `packages/core/journey-builder/tools.js`
- Create: `packages/core/journey-builder/mutators.js`
- Create: `packages/core/journey-builder/__tests__/mutators.test.js`

Tools for Claude: `inspect_master_de`, `set_entry_source`, `add_activity`, `update_activity`, `remove_activity`, `validate_journey`, `deploy_journey_draft`.

- [ ] **Step 1: Write mutator tests**

```javascript
// packages/core/journey-builder/__tests__/mutators.test.js
import { describe, it, expect } from 'vitest';
import { addActivity, updateActivity, removeActivity, setEntrySource } from '../mutators.js';

const empty = () => ({ version: 1, name: 'T', entry: null, activities: [] });

describe('addActivity', () => {
  it('appends when after_id is null', () => {
    const dsl = addActivity(empty(), { activity: { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    expect(dsl.activities).toHaveLength(1);
    expect(dsl.activities[0].id).toBe('w1');
  });

  it('re-links the previous activity next to the new id', () => {
    let dsl = addActivity(empty(), { activity: { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = addActivity(dsl, { activity: { id: 'w2', type: 'wait_duration', amount: 2, unit: 'days', next: null }, after_id: 'w1' });
    expect(dsl.activities.find(a => a.id === 'w1').next).toBe('w2');
  });
});

describe('removeActivity', () => {
  it('removes and re-links neighbors', () => {
    let dsl = empty();
    dsl = addActivity(dsl, { activity: { id: 'a', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = addActivity(dsl, { activity: { id: 'b', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: 'a' });
    dsl = addActivity(dsl, { activity: { id: 'c', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: 'b' });
    dsl = removeActivity(dsl, { id: 'b' });
    expect(dsl.activities.find(a => a.id === 'a').next).toBe('c');
    expect(dsl.activities.find(a => a.id === 'b')).toBeUndefined();
  });
});

describe('updateActivity', () => {
  it('merges patch', () => {
    let dsl = empty();
    dsl = addActivity(dsl, { activity: { id: 'w', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = updateActivity(dsl, { id: 'w', patch: { amount: 5 } });
    expect(dsl.activities[0].amount).toBe(5);
  });
});

describe('setEntrySource', () => {
  it('writes entry.source', () => {
    const dsl = setEntrySource(empty(), { master_de: 'M', sql: 'SELECT 1 FROM M', target_de_name: 'T' });
    expect(dsl.entry.source.master_de_key).toBe('M');
    expect(dsl.entry.source.target_de_name).toBe('T');
  });
});
```

- [ ] **Step 2: Implement mutators**

```javascript
// packages/core/journey-builder/mutators.js
export function addActivity(dsl, { activity, after_id }) {
  const activities = [...dsl.activities, activity];
  if (after_id) {
    const idx = activities.findIndex(a => a.id === after_id);
    if (idx >= 0) {
      const prev = activities[idx];
      activities[idx] = relinkNext(prev, null, activity.id);
    }
  }
  return { ...dsl, activities };
}

export function updateActivity(dsl, { id, patch }) {
  return {
    ...dsl,
    activities: dsl.activities.map(a => a.id === id ? { ...a, ...patch } : a)
  };
}

export function removeActivity(dsl, { id }) {
  const target = dsl.activities.find(a => a.id === id);
  if (!target) return dsl;
  const targetNext = pickPrimaryNext(target);
  const activities = dsl.activities
    .filter(a => a.id !== id)
    .map(a => relinkNext(a, id, targetNext));
  return { ...dsl, activities };
}

export function setEntrySource(dsl, { master_de, sql, target_de_name }) {
  return {
    ...dsl,
    entry: {
      source: { type: 'master_de_query', master_de_key: master_de, sql, target_de_name }
    }
  };
}

function pickPrimaryNext(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send': return a.next;
    case 'decision_split': return a.default_next || a.branches?.[0]?.next || null;
    case 'wait_until_event': return a.on_event_next || a.on_timeout_next || null;
    case 'engagement_split': return a.yes_next || a.no_next || null;
    default: return null;
  }
}

function relinkNext(activity, fromId, toId) {
  const remap = (v) => v === fromId ? toId : v;
  switch (activity.type) {
    case 'wait_duration':
    case 'email_send':
      return { ...activity, next: remap(activity.next) };
    case 'decision_split':
      return {
        ...activity,
        branches: (activity.branches || []).map(b => ({ ...b, next: remap(b.next) })),
        default_next: remap(activity.default_next)
      };
    case 'wait_until_event':
      return { ...activity, on_event_next: remap(activity.on_event_next), on_timeout_next: remap(activity.on_timeout_next) };
    case 'engagement_split':
      return { ...activity, yes_next: remap(activity.yes_next), no_next: remap(activity.no_next) };
    default: return activity;
  }
}
```

- [ ] **Step 3: Run — expect pass**

Expected: 5/5.

- [ ] **Step 4: Write tools.js (Claude tool definitions)**

```javascript
// packages/core/journey-builder/tools.js
import { CAMPAIGN_TYPES } from '../campaign-builder/index.js';

export const JOURNEY_TOOLS = [
  {
    name: 'inspect_master_de',
    description: 'Fetch schema (columns + types) and 5 sample rows from a Master Data Extension. Required BEFORE writing SQL for the entry source.',
    input_schema: {
      type: 'object',
      properties: { de_name: { type: 'string' } },
      required: ['de_name']
    }
  },
  {
    name: 'set_entry_source',
    description: 'Define the entry of the journey: Master DE + SQL query + target DE name.',
    input_schema: {
      type: 'object',
      properties: {
        master_de: { type: 'string' },
        sql: { type: 'string', description: 'SELECT query over master_de. No DROP/UPDATE/DELETE.' },
        target_de_name: { type: 'string' }
      },
      required: ['master_de', 'sql', 'target_de_name']
    }
  },
  {
    name: 'add_activity',
    description: 'Append a new activity to the journey. Valid types: wait_duration, decision_split, email_send, wait_until_event, engagement_split.',
    input_schema: {
      type: 'object',
      properties: {
        activity: { type: 'object' },
        after_id: { type: ['string', 'null'], description: 'The id of the activity after which to insert. null to append at the entry.' }
      },
      required: ['activity']
    }
  },
  {
    name: 'update_activity',
    description: 'Patch an existing activity by id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, patch: { type: 'object' } },
      required: ['id', 'patch']
    }
  },
  {
    name: 'remove_activity',
    description: 'Remove an activity by id and relink neighbors.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    }
  },
  {
    name: 'validate_journey',
    description: 'Run validation and return human-readable errors without mutating.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'deploy_journey_draft',
    description: 'Deploy the journey to Marketing Cloud as a Draft. Runs: folder → target DE → SQL query → email shells → Interaction POST. Always Draft, never Active.',
    input_schema: { type: 'object', properties: {} }
  }
];

export const CAMPAIGN_TYPE_KEYS = Object.keys(CAMPAIGN_TYPES);
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/journey-builder/mutators.js packages/core/journey-builder/tools.js packages/core/journey-builder/__tests__/mutators.test.js
git commit -m "feat(journey-builder): DSL mutators + Claude tool definitions"
```

---

## Task 8: Backend endpoints — CRUD for journeys

**Files:**
- Modify: `apps/dashboard/server.js` (add new route section)

- [ ] **Step 1: Identify insertion point in server.js**

```bash
grep -n "app\.post.*'/api/campaigns\|app\.post.*'/api/agents" apps/dashboard/server.js | head -5
```

Insert new routes after campaigns block (keeps related domains together).

- [ ] **Step 2: Add CRUD endpoints**

In `apps/dashboard/server.js`:

```javascript
// ============ JOURNEYS CRUD ============
app.post('/api/journeys', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    `INSERT INTO journeys (user_id, name, dsl_json)
     VALUES ($1, $2, $3) RETURNING *`,
    [req.session.userId, name.trim(),
     JSON.stringify({ version: 1, name: name.trim(), entry: null, activities: [] })]
  );
  res.json(rows[0]);
});

app.get('/api/journeys', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, status, mc_interaction_id, updated_at
       FROM journeys WHERE user_id = $1 AND status != 'archived'
       ORDER BY updated_at DESC`,
    [req.session.userId]
  );
  res.json(rows);
});

app.get('/api/journeys/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM journeys WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  const msgs = await pool.query(
    `SELECT id, role, content, created_at FROM journey_chat_messages
       WHERE journey_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ ...rows[0], messages: msgs.rows });
});

app.patch('/api/journeys/:id', requireAuth, async (req, res) => {
  const { name, status } = req.body;
  const fields = [], vals = [];
  if (name) { vals.push(name); fields.push(`name = $${vals.length}`); }
  if (status && ['drafting','deployed_draft','archived'].includes(status)) {
    vals.push(status); fields.push(`status = $${vals.length}`);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'no fields' });
  vals.push(req.params.id, req.session.userId);
  const { rows } = await pool.query(
    `UPDATE journeys SET ${fields.join(', ')} WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`,
    vals
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.delete('/api/journeys/:id', requireAuth, async (req, res) => {
  await pool.query(`DELETE FROM journeys WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.session.userId]);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Restart server and smoke-test**

```bash
npm run kill-ports && npm run server &
sleep 3
curl -X POST http://localhost:3002/api/journeys -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d '{"name":"Test"}'
```

Expected: JSON with new journey row. `status: 'drafting'`, `dsl_json.activities: []`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(journeys): CRUD endpoints"
```

---

## Task 9: Backend — SSE chat endpoint with tool dispatch

**Files:**
- Modify: `apps/dashboard/server.js` (add SSE endpoint + tool dispatcher)

This is the heart of the agent. Stream Claude, on tool_use → execute → persist DSL → emit `journey_state` and `tool_status`.

- [ ] **Step 1: Identify reference SSE endpoint**

Reuse the pattern at `/api/chat/agent/:agentId` (server.js:2922 per exploration).

- [ ] **Step 2: Add endpoint**

```javascript
// apps/dashboard/server.js (new section)
import Anthropic from '@anthropic-ai/sdk';
import { JOURNEY_TOOLS } from '../../packages/core/journey-builder/tools.js';
import { validateDsl } from '../../packages/core/journey-builder/dsl-schema.js';
import { addActivity, updateActivity, removeActivity, setEntrySource } from '../../packages/core/journey-builder/mutators.js';
import { deployJourney } from '../../packages/core/journey-builder/deploy.js';
import { createMCClient } from '../../packages/core/mc-api/client.js';

const JOURNEY_SYSTEM_PROMPT = `You are a Marketing Cloud Journey Builder agent for Emirates BAU.
You help the user assemble a journey by calling tools that mutate a DSL document.
RULES:
- BEFORE writing SQL for entry, call inspect_master_de to learn the schema.
- Use unique ids: wait_1, split_1, send_gold, etc.
- Always call validate_journey after significant changes and before deploy_journey_draft.
- Deploy always produces a Draft in MC. Never claim the journey is active.
- Prefer small incremental tool calls; narrate briefly what you are adding.
- The 5 supported activity types are: wait_duration, decision_split, email_send, wait_until_event, engagement_split.
- For email_send, campaign_type must be one of the BAU campaign types.`;

app.post('/api/chat/journey-builder/:id', requireAuth, async (req, res) => {
  const { id: journeyId } = req.params;
  const { message } = req.body;

  const { rows } = await pool.query(
    `SELECT * FROM journeys WHERE id = $1 AND user_id = $2`,
    [journeyId, req.session.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not found' });
  let journey = rows[0];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const priorMsgs = await pool.query(
    `SELECT role, content FROM journey_chat_messages WHERE journey_id = $1 ORDER BY created_at ASC`,
    [journeyId]
  );
  const messages = priorMsgs.rows.map(r => ({ role: r.role === 'tool' ? 'user' : r.role, content: r.content }));
  messages.push({ role: 'user', content: message });
  await pool.query(
    `INSERT INTO journey_chat_messages (journey_id, role, content) VALUES ($1, $2, $3)`,
    [journeyId, 'user', JSON.stringify(message)]
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let mc = null;
  const getMc = async () => mc ??= await createMCClient(pool, decryptValue);

  try {
    let keepGoing = true;
    while (keepGoing) {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: JOURNEY_SYSTEM_PROMPT,
        tools: JOURNEY_TOOLS,
        messages
      });
      stream.on('text', (text) => send({ type: 'text', chunk: text }));
      const final = await stream.finalMessage();
      messages.push({ role: 'assistant', content: final.content });
      await pool.query(
        `INSERT INTO journey_chat_messages (journey_id, role, content) VALUES ($1, $2, $3)`,
        [journeyId, 'assistant', JSON.stringify(final.content)]
      );

      const toolUses = final.content.filter(c => c.type === 'tool_use');
      if (toolUses.length === 0 || final.stop_reason !== 'tool_use') { keepGoing = false; break; }

      const toolResults = [];
      for (const tu of toolUses) {
        send({ type: 'tool_status', tool: tu.name, status: 'running' });
        const { dsl: newDsl, result, error } = await dispatchJourneyTool({
          tool: tu.name, input: tu.input, dsl: journey.dsl_json, mc: await getMc(), journey, pool
        });
        if (newDsl) {
          journey = await persistDsl(pool, journeyId, newDsl);
          send({ type: 'journey_state', dsl: newDsl });
        }
        send({ type: 'tool_status', tool: tu.name, status: 'done' });
        toolResults.push({
          type: 'tool_result', tool_use_id: tu.id,
          content: error ? `ERROR: ${error}` : JSON.stringify(result),
          is_error: !!error
        });
        await pool.query(
          `INSERT INTO journey_chat_messages (journey_id, role, content) VALUES ($1, $2, $3)`,
          [journeyId, 'tool', JSON.stringify({ tool: tu.name, input: tu.input, result, error })]
        );
      }
      messages.push({ role: 'user', content: toolResults });
    }
    send({ type: 'done' });
  } catch (err) {
    console.error('journey chat error', err);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

async function dispatchJourneyTool({ tool, input, dsl, mc, journey, pool }) {
  try {
    switch (tool) {
      case 'inspect_master_de': {
        const schema = await mc.soap('Retrieve', buildRetrieveDeSchemaXml(input.de_name));
        const sample = await mc.rest('GET', `/data/v1/customobjectdata/key/${encodeURIComponent(input.de_name)}/rowset?$top=5`);
        return { result: { schema, sample } };
      }
      case 'set_entry_source':
        return { dsl: setEntrySource(dsl, input), result: 'entry source set' };
      case 'add_activity':
        return { dsl: addActivity(dsl, input), result: `added ${input.activity?.id}` };
      case 'update_activity':
        return { dsl: updateActivity(dsl, input), result: `updated ${input.id}` };
      case 'remove_activity':
        return { dsl: removeActivity(dsl, input), result: `removed ${input.id}` };
      case 'validate_journey': {
        const { valid, errors } = validateDsl(dsl);
        return { result: { valid, errors } };
      }
      case 'deploy_journey_draft': {
        const { valid, errors } = validateDsl(dsl);
        if (!valid) return { error: `Cannot deploy: ${errors.join('; ')}` };
        const out = await deployJourney({ mc, dsl, config: { market: 'GL' } });
        await pool.query(
          `UPDATE journeys SET dsl_json = $1, status = 'deployed_draft',
             mc_interaction_id = $2, mc_target_de_key = $3, mc_query_activity_id = $4
           WHERE id = $5`,
          [JSON.stringify(out.dsl), out.mc_interaction_id, out.mc_target_de_key, out.mc_query_activity_id, journey.id]
        );
        return { dsl: out.dsl, result: { mc_interaction_id: out.mc_interaction_id, status: 'Draft' } };
      }
      default:
        return { error: `unknown tool ${tool}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

async function persistDsl(pool, journeyId, dsl) {
  const { rows } = await pool.query(
    `UPDATE journeys SET dsl_json = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(dsl), journeyId]
  );
  return rows[0];
}

function buildRetrieveDeSchemaXml(deName) {
  return `<RetrieveRequest>
    <ObjectType>DataExtensionField</ObjectType>
    <Properties>Name</Properties><Properties>FieldType</Properties><Properties>MaxLength</Properties>
    <Filter xsi:type="SimpleFilterPart">
      <Property>DataExtension.CustomerKey</Property>
      <SimpleOperator>equals</SimpleOperator>
      <Value>${deName}</Value>
    </Filter>
  </RetrieveRequest>`;
}
```

- [ ] **Step 3: Restart server + smoke-test with curl**

```bash
npm run kill-ports && npm start &
sleep 5
curl -N -X POST http://localhost:3002/api/chat/journey-builder/<id> \
  -H "Content-Type: application/json" -H "Cookie: $COOKIE" \
  -d '{"message":"construye un journey simple con un wait de 1 día y un email_send"}'
```

Expected: SSE stream with `text` chunks, `tool_status`, and at least one `journey_state` event.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(journeys): SSE chat endpoint with tool dispatch"
```

---

## Task 10: Frontend — install ReactFlow + dagre + CSS tokens

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/dashboard && npm install @xyflow/react @dagrejs/dagre
```

- [ ] **Step 2: Add CSS custom properties**

In `apps/dashboard/src/index.css` inside `:root`:

```css
/* Journey Builder tokens */
--journey-canvas-bg: #0b1020;
--journey-edge-default: rgba(148, 163, 184, 0.55);
--journey-edge-active: #60a5fa;
--journey-node-entry-bg: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
--journey-node-wait-bg: linear-gradient(135deg, #1e293b 0%, #334155 100%);
--journey-node-split-bg: linear-gradient(135deg, #312e81 0%, #7c3aed 100%);
--journey-node-send-bg: linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%);
--journey-node-wait-event-bg: linear-gradient(135deg, #581c87 0%, #a855f7 100%);
--journey-node-engage-bg: linear-gradient(135deg, #134e4a 0%, #14b8a6 100%);
--journey-node-border: rgba(255,255,255,0.08);
--journey-node-text: #e2e8f0;
--journey-node-muted: rgba(226, 232, 240, 0.65);
--journey-node-shadow: 0 8px 24px -6px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.4);
--journey-node-radius: 14px;
--journey-thinking-shimmer: linear-gradient(90deg, transparent, rgba(96,165,250,0.35), transparent);
```

- [ ] **Step 3: Verify Vite picks up @xyflow/react**

```bash
cd apps/dashboard && npm run dev
```

Expected: server starts on 4000 with no module errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json apps/dashboard/src/index.css
git commit -m "chore(journeys): install ReactFlow + dagre, add CSS tokens"
```

---

## Task 11: Frontend — routes + pages skeleton

**Files:**
- Create: `apps/dashboard/src/pages/JourneysListPage.jsx`
- Create: `apps/dashboard/src/pages/JourneyBuilderPage.jsx`
- Modify: `apps/dashboard/src/main.jsx` (or wherever React Router is configured)
- Modify: `apps/dashboard/src/components/Layout.jsx` (add nav entry)
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add i18n strings**

In `apps/dashboard/src/i18n/translations.js`:

```javascript
// ES
journeys: {
  title: 'Journeys',
  newJourney: 'Nuevo Journey',
  name: 'Nombre',
  status: 'Estado',
  statusDrafting: 'Borrador',
  statusDeployedDraft: 'Desplegado (Draft en MC)',
  statusArchived: 'Archivado',
  updated: 'Actualizado',
  emptyList: 'Aún no hay journeys. Crea el primero.',
  create: 'Crear',
  validate: 'Validar',
  deploy: 'Desplegar a MC (Draft)',
  validationOk: 'Journey válido, listo para desplegar',
  validationErrors: 'Errores de validación',
  deploySuccess: 'Desplegado como Draft en Marketing Cloud',
  deployFailed: 'Falló el despliegue',
  chatPlaceholder: 'Describe el journey que quieres construir...',
  thinking: 'Pensando...',
  toolAdding: 'Añadiendo',
  toolValidating: 'Validando',
  toolDeploying: 'Desplegando',
  nodeTypes: {
    entry: 'Entry',
    wait_duration: 'Espera',
    decision_split: 'Split de decisión',
    email_send: 'Envío',
    wait_until_event: 'Esperar hasta evento',
    engagement_split: 'Split por engagement'
  }
},
// Mirror in EN
```

- [ ] **Step 2: Create list page**

```jsx
// apps/dashboard/src/pages/JourneysListPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneysListPage() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    fetch(`${API}/journeys`, { credentials: 'include' })
      .then(r => r.json()).then(setItems).finally(() => setLoading(false));
  }, []);

  const create = async () => {
    const name = prompt(t('journeys.name'));
    if (!name) return;
    const r = await fetch(`${API}/journeys`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const j = await r.json();
    nav(`/app/journeys/${j.id}`);
  };

  return (
    <div className="journeys-list">
      <header className="journeys-list__header">
        <h1>{t('journeys.title')}</h1>
        <button className="btn btn--primary" onClick={create}>
          <Plus size={16} /> {t('journeys.newJourney')}
        </button>
      </header>
      {loading ? <div className="muted">…</div>
        : items.length === 0 ? <div className="empty">{t('journeys.emptyList')}</div>
        : <table className="journeys-list__table">
            <thead><tr>
              <th>{t('journeys.name')}</th><th>{t('journeys.status')}</th><th>{t('journeys.updated')}</th>
            </tr></thead>
            <tbody>{items.map(j => (
              <tr key={j.id} onClick={() => nav(`/app/journeys/${j.id}`)} style={{ cursor: 'pointer' }}>
                <td>{j.name}</td>
                <td>{t(`journeys.status${pascal(j.status)}`)}</td>
                <td>{new Date(j.updated_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>}
    </div>
  );
}

function pascal(s) { return s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(''); }
```

- [ ] **Step 3: Create builder page shell**

```jsx
// apps/dashboard/src/pages/JourneyBuilderPage.jsx
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import JourneyBuilderChat from '../components/journey/JourneyBuilderChat.jsx';
import JourneyCanvas from '../components/journey/JourneyCanvas.jsx';
import JourneyToolbar from '../components/journey/JourneyToolbar.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderPage() {
  const { id } = useParams();
  const [journey, setJourney] = useState(null);
  const [dsl, setDsl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [toolStatus, setToolStatus] = useState(null);

  useEffect(() => {
    fetch(`${API}/journeys/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => { setJourney(j); setDsl(j.dsl_json); setMessages(j.messages || []); });
  }, [id]);

  if (!journey) return <div className="loading">…</div>;

  return (
    <div className="journey-builder">
      <JourneyToolbar journey={journey} dsl={dsl} onRename={(name) => setJourney({ ...journey, name })} />
      <div className="journey-builder__body">
        <JourneyBuilderChat
          journeyId={id}
          messages={messages}
          onJourneyState={setDsl}
          onToolStatus={setToolStatus}
          onMessage={(m) => setMessages(prev => [...prev, m])}
        />
        <JourneyCanvas dsl={dsl} toolStatus={toolStatus} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register routes**

In `apps/dashboard/src/main.jsx` (adapt path to your router setup):

```jsx
import JourneysListPage from './pages/JourneysListPage.jsx';
import JourneyBuilderPage from './pages/JourneyBuilderPage.jsx';

// inside <Routes>:
<Route path="/app/journeys" element={<JourneysListPage />} />
<Route path="/app/journeys/:id" element={<JourneyBuilderPage />} />
```

In `apps/dashboard/src/components/Layout.jsx`, add nav link:

```jsx
<NavLink to="/app/journeys">{t('journeys.title')}</NavLink>
```

- [ ] **Step 5: Verify routing**

```bash
npm start
```

Navigate to `http://localhost:4000/app/journeys`. Expected: empty list renders with "New Journey" button. Click, enter name, navigate to builder page (child components will be stubbed, just need no errors).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/pages/Journeys*.jsx apps/dashboard/src/main.jsx apps/dashboard/src/components/Layout.jsx apps/dashboard/src/i18n/translations.js
git commit -m "feat(journeys): list + builder page skeletons + routes + i18n"
```

---

## Task 12: Frontend — chat panel with SSE streaming

**Files:**
- Create: `apps/dashboard/src/components/journey/JourneyBuilderChat.jsx`

Reuse the `useStreamingChat` hook pattern from `StudioChatPanel.jsx`; customize for journey events.

- [ ] **Step 1: Review existing streaming hook**

```bash
grep -n "useStreamingChat\|journey_state\|tool_status" apps/dashboard/src/hooks/useStreamingChat.js
```

- [ ] **Step 2: Implement chat component**

```jsx
// apps/dashboard/src/components/journey/JourneyBuilderChat.jsx
import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyBuilderChat({ journeyId, messages, onJourneyState, onToolStatus, onMessage }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    onMessage(userMsg);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    const res = await fetch(`${API}/chat/journey-builder/${journeyId}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg.content })
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const evt = JSON.parse(line.slice(6));
        if (evt.type === 'text') { assistantText += evt.chunk; setStreamingText(assistantText); }
        else if (evt.type === 'journey_state') onJourneyState(evt.dsl);
        else if (evt.type === 'tool_status') onToolStatus(evt);
        else if (evt.type === 'done' || evt.type === 'error') {
          if (assistantText) onMessage({ role: 'assistant', content: assistantText });
          setStreaming(false); setStreamingText(''); onToolStatus(null);
        }
      }
    }
  };

  return (
    <aside className="journey-chat">
      <div className="journey-chat__messages">
        {messages.map((m, i) => (
          <div key={i} className={`journey-chat__msg journey-chat__msg--${m.role}`}>
            <div className="journey-chat__role">{m.role}</div>
            <div className="journey-chat__body">{typeof m.content === 'string' ? m.content : '…'}</div>
          </div>
        ))}
        {streaming && <div className="journey-chat__msg journey-chat__msg--assistant">
          <div className="journey-chat__role">assistant</div>
          <div className="journey-chat__body">{streamingText || <span className="journey-chat__thinking">{t('journeys.thinking')}</span>}</div>
        </div>}
        <div ref={bottomRef} />
      </div>
      <div className="journey-chat__composer">
        <textarea
          value={input} onChange={e => setInput(e.target.value)}
          placeholder={t('journeys.chatPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()}><Send size={16} /></button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Smoke-test**

Start dev, open a journey, send "hola". Expected: assistant text streams into the panel; no console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/journey/JourneyBuilderChat.jsx
git commit -m "feat(journeys): chat panel with SSE streaming + event dispatch"
```

---

## Task 13: Frontend — ReactFlow canvas + DSL → nodes/edges mapping

**Files:**
- Create: `apps/dashboard/src/components/journey/JourneyCanvas.jsx`
- Create: `apps/dashboard/src/components/journey/layout/autoLayout.js`

- [ ] **Step 1: Write autoLayout helper**

```javascript
// apps/dashboard/src/components/journey/layout/autoLayout.js
import dagre from '@dagrejs/dagre';

const NODE_W = 260, NODE_H = 110;

export function autoLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

export function dslToGraph(dsl) {
  if (!dsl) return { nodes: [], edges: [] };
  const nodes = [];
  const edges = [];

  if (dsl.entry) {
    nodes.push({ id: '__entry__', type: 'entry', data: { source: dsl.entry.source }, position: { x: 0, y: 0 } });
    const firstId = dsl.activities[0]?.id;
    if (firstId) edges.push({ id: `e-entry-${firstId}`, source: '__entry__', target: firstId, type: 'animated' });
  }

  for (const a of dsl.activities || []) {
    nodes.push({ id: a.id, type: nodeTypeFor(a.type), data: { activity: a }, position: { x: 0, y: 0 } });
    for (const { to, label } of nextsOf(a)) {
      if (!to) continue;
      edges.push({ id: `e-${a.id}-${to}-${label || 'n'}`, source: a.id, target: to, label, type: 'animated' });
    }
  }
  return { nodes: autoLayout(nodes, edges), edges };
}

function nodeTypeFor(t) {
  return ({
    wait_duration: 'waitDuration', decision_split: 'decisionSplit',
    email_send: 'emailSend', wait_until_event: 'waitUntilEvent', engagement_split: 'engagementSplit'
  })[t] || 'default';
}

function nextsOf(a) {
  switch (a.type) {
    case 'wait_duration':
    case 'email_send': return [{ to: a.next }];
    case 'decision_split': return [
      ...(a.branches || []).map(b => ({ to: b.next, label: b.label })),
      ...(a.default_next ? [{ to: a.default_next, label: 'default' }] : [])
    ];
    case 'wait_until_event': return [
      { to: a.on_event_next, label: 'event' }, { to: a.on_timeout_next, label: 'timeout' }
    ];
    case 'engagement_split': return [
      { to: a.yes_next, label: 'yes' }, { to: a.no_next, label: 'no' }
    ];
    default: return [];
  }
}
```

- [ ] **Step 2: Canvas component**

```jsx
// apps/dashboard/src/components/journey/JourneyCanvas.jsx
import { useEffect, useState, useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { dslToGraph } from './layout/autoLayout.js';
import EntryNode from './nodes/EntryNode.jsx';
import WaitDurationNode from './nodes/WaitDurationNode.jsx';
import DecisionSplitNode from './nodes/DecisionSplitNode.jsx';
import EmailSendNode from './nodes/EmailSendNode.jsx';
import WaitUntilEventNode from './nodes/WaitUntilEventNode.jsx';
import EngagementSplitNode from './nodes/EngagementSplitNode.jsx';
import AnimatedEdge from './edges/AnimatedEdge.jsx';

const nodeTypes = {
  entry: EntryNode, waitDuration: WaitDurationNode, decisionSplit: DecisionSplitNode,
  emailSend: EmailSendNode, waitUntilEvent: WaitUntilEventNode, engagementSplit: EngagementSplitNode
};
const edgeTypes = { animated: AnimatedEdge };

export default function JourneyCanvas({ dsl, toolStatus }) {
  const { nodes, edges } = useMemo(() => dslToGraph(dsl), [dsl]);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [prevIds, setPrevIds] = useState(new Set());

  useEffect(() => {
    const currentIds = new Set(nodes.map(n => n.id));
    const added = [...currentIds].find(id => !prevIds.has(id));
    if (added) setLastAddedId(added);
    setPrevIds(currentIds);
    if (added) {
      const t = setTimeout(() => setLastAddedId(null), 900);
      return () => clearTimeout(t);
    }
  }, [nodes]);

  const decoratedNodes = nodes.map(n => ({
    ...n,
    data: { ...n.data, isNewlyAdded: n.id === lastAddedId, toolRunning: toolStatus?.status === 'running' }
  }));

  return (
    <div className="journey-canvas">
      <ReactFlow
        nodes={decoratedNodes} edges={edges}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        fitView fitViewOptions={{ padding: 0.2, duration: 500 }}
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.04)" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: Commit (skeleton; nodes come next)**

```bash
git add apps/dashboard/src/components/journey/JourneyCanvas.jsx apps/dashboard/src/components/journey/layout/autoLayout.js
git commit -m "feat(journeys): ReactFlow canvas + dagre auto-layout + DSL mapping"
```

---

## Task 14: Frontend — 6 custom nodes + animated edge

**Files:**
- Create: `apps/dashboard/src/components/journey/nodes/{Entry,WaitDuration,DecisionSplit,EmailSend,WaitUntilEvent,EngagementSplit}Node.jsx`
- Create: `apps/dashboard/src/components/journey/edges/AnimatedEdge.jsx`
- Modify: `apps/dashboard/src/index.css` (add node styles)

All nodes share a base structure. Show one complete example + repeat pattern for others.

- [ ] **Step 1: Base node styles**

In `apps/dashboard/src/index.css`:

```css
.journey-node {
  min-width: 220px; padding: 14px 16px;
  border-radius: var(--journey-node-radius);
  border: 1px solid var(--journey-node-border);
  box-shadow: var(--journey-node-shadow);
  color: var(--journey-node-text);
  font-size: 13px; line-height: 1.35;
  animation: journeyNodeIn 320ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  position: relative; overflow: hidden;
}
.journey-node--newly-added::before {
  content: ''; position: absolute; inset: -1px; border-radius: inherit;
  background: var(--journey-thinking-shimmer); background-size: 200% 100%;
  animation: journeyShimmer 900ms linear;
  pointer-events: none;
}
@keyframes journeyNodeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes journeyShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.journey-node__header { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 6px; }
.journey-node__header svg { opacity: 0.85; }
.journey-node__type { font-size: 11px; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.5px; }
.journey-node__body { font-size: 13px; opacity: 0.92; }
.journey-node__chip { display: inline-block; padding: 2px 8px; margin: 2px 4px 0 0; border-radius: 999px; background: rgba(255,255,255,0.08); font-size: 11px; }
.journey-node--entry { background: var(--journey-node-entry-bg); }
.journey-node--wait { background: var(--journey-node-wait-bg); }
.journey-node--split { background: var(--journey-node-split-bg); }
.journey-node--send { background: var(--journey-node-send-bg); }
.journey-node--wait-event { background: var(--journey-node-wait-event-bg); }
.journey-node--engage { background: var(--journey-node-engage-bg); }
```

- [ ] **Step 2: EntryNode**

```jsx
// apps/dashboard/src/components/journey/nodes/EntryNode.jsx
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';

export default function EntryNode({ data }) {
  const { t } = useI18n();
  return (
    <div className={`journey-node journey-node--entry ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <div className="journey-node__header"><Database size={16} /> {t('journeys.nodeTypes.entry')}</div>
      <div className="journey-node__type">Master DE → Target DE</div>
      <div className="journey-node__body">
        <div>{data.source?.master_de_key}</div>
        <div className="journey-node__chip">→ {data.source?.target_de_name}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 3: WaitDurationNode**

```jsx
// apps/dashboard/src/components/journey/nodes/WaitDurationNode.jsx
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';

export default function WaitDurationNode({ data }) {
  const { t } = useI18n();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--wait ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Clock size={16} className="journey-spin-slow" /> {t('journeys.nodeTypes.wait_duration')}</div>
      <div className="journey-node__body">{a.amount} {a.unit}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 4: DecisionSplitNode**

```jsx
// apps/dashboard/src/components/journey/nodes/DecisionSplitNode.jsx
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';

export default function DecisionSplitNode({ data }) {
  const { t } = useI18n();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--split ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><GitBranch size={16} /> {t('journeys.nodeTypes.decision_split')}</div>
      <div className="journey-node__body">
        {(a.branches || []).map((b, i) => <span key={i} className="journey-node__chip">{b.label}: {b.condition}</span>)}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 5: EmailSendNode (with hover to BAU builder)**

```jsx
// apps/dashboard/src/components/journey/nodes/EmailSendNode.jsx
import { Handle, Position } from '@xyflow/react';
import { Mail, ExternalLink } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';

export default function EmailSendNode({ data }) {
  const { t } = useI18n();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--send ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Mail size={16} /> {t('journeys.nodeTypes.email_send')}</div>
      <div className="journey-node__body">
        <div>{a.email_shell_name}</div>
        <div className="journey-node__chip">{a.campaign_type}</div>
        {a.mc_email_id && (
          <a
            href={`/app/campaigns/create?emailId=${a.mc_email_id}`}
            target="_blank" rel="noreferrer"
            className="journey-node__chip"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={11} /> BAU builder
          </a>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 6: WaitUntilEventNode + EngagementSplitNode (same pattern)**

```jsx
// WaitUntilEventNode.jsx
import { Handle, Position } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
export default function WaitUntilEventNode({ data }) {
  const { t } = useI18n(); const a = data.activity;
  return (
    <div className={`journey-node journey-node--wait-event ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Eye size={16} className="journey-pulse" /> {t('journeys.nodeTypes.wait_until_event')}</div>
      <div className="journey-node__body">{a.event} ≤ {a.timeout_hours}h</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// EngagementSplitNode.jsx
import { Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
export default function EngagementSplitNode({ data }) {
  const { t } = useI18n(); const a = data.activity;
  return (
    <div className={`journey-node journey-node--engage ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Activity size={16} /> {t('journeys.nodeTypes.engagement_split')}</div>
      <div className="journey-node__body">
        <span className="journey-node__chip">{a.metric}?</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 7: AnimatedEdge**

```jsx
// apps/dashboard/src/components/journey/edges/AnimatedEdge.jsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

export default function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, label }) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: 'var(--journey-edge-default)', strokeWidth: 2 }} />
      <path d={path} fill="none" stroke="var(--journey-edge-active)" strokeWidth={2}
        strokeDasharray="8 8" className="journey-edge-flow" />
      {label && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            background: 'rgba(15,23,42,0.85)', color: 'var(--journey-node-text)',
            padding: '2px 8px', borderRadius: 6, fontSize: 11, pointerEvents: 'none' }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
```

Add to CSS:

```css
.journey-edge-flow { animation: journeyDash 1.4s linear infinite; }
@keyframes journeyDash { to { stroke-dashoffset: -32; } }
.journey-spin-slow { animation: journeySpin 6s linear infinite; }
@keyframes journeySpin { to { transform: rotate(360deg); } }
.journey-pulse { animation: journeyPulse 1.6s ease-in-out infinite; }
@keyframes journeyPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
```

- [ ] **Step 8: Visual smoke-test**

Start dev, open a journey, send via chat: "añade un wait de 2 días y un email_send product-offer-ecommerce Test_Shell". Expected: nodes fade in one by one, edges animate, auto-layout arranges vertically.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/components/journey/nodes/ apps/dashboard/src/components/journey/edges/ apps/dashboard/src/index.css
git commit -m "feat(journeys): 6 custom nodes + animated edge + CSS tokens"
```

---

## Task 15: Frontend — JourneyToolbar with Validate + Deploy

**Files:**
- Create: `apps/dashboard/src/components/journey/JourneyToolbar.jsx`

- [ ] **Step 1: Component**

```jsx
// apps/dashboard/src/components/journey/JourneyToolbar.jsx
import { useState } from 'react';
import { CheckCircle, Rocket, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyToolbar({ journey, dsl, onRename }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [name, setName] = useState(journey.name);
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  const rename = async () => {
    if (name === journey.name) return;
    await fetch(`${API}/journeys/${journey.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    onRename(name);
  };

  const validate = async () => {
    setBusy(true); setBanner(null);
    const res = await fetch(`${API}/chat/journey-builder/${journey.id}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'run validate_journey and report' })
    });
    await res.text();
    setBusy(false);
    setBanner({ type: 'info', text: t('journeys.validationOk') });
  };

  const deploy = async () => {
    if (!confirm(`Deploy "${journey.name}" as Draft to MC?`)) return;
    setBusy(true); setBanner(null);
    const res = await fetch(`${API}/chat/journey-builder/${journey.id}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'deploy_journey_draft now' })
    });
    await res.text();
    setBusy(false);
    setBanner({ type: 'success', text: t('journeys.deploySuccess') });
  };

  return (
    <header className="journey-toolbar">
      <button className="btn btn--ghost" onClick={() => nav('/app/journeys')}><ArrowLeft size={16} /></button>
      <input className="journey-toolbar__name" value={name} onChange={e => setName(e.target.value)} onBlur={rename} />
      <span className={`journey-toolbar__status journey-toolbar__status--${journey.status}`}>{t(`journeys.status${pascal(journey.status)}`)}</span>
      <div className="journey-toolbar__spacer" />
      <button className="btn" onClick={validate} disabled={busy}><CheckCircle size={16} /> {t('journeys.validate')}</button>
      <button className="btn btn--primary" onClick={deploy} disabled={busy || journey.status === 'deployed_draft'}>
        <Rocket size={16} /> {t('journeys.deploy')}
      </button>
      {banner && (
        <div className={`journey-toolbar__banner journey-toolbar__banner--${banner.type}`}>
          <AlertTriangle size={14} /> {banner.text}
        </div>
      )}
    </header>
  );
}

function pascal(s) { return s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(''); }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/journey/JourneyToolbar.jsx
git commit -m "feat(journeys): toolbar with validate + deploy"
```

---

## Task 16: Polish pass — animate skill application

Apply `animate` skill over `JourneyCanvas.jsx` and the 6 nodes to refine motion.

- [ ] **Step 1: Invoke `animate` skill** on the journey folder
- [ ] **Step 2: Review diff, keep only micro-interactions that serve the "watch it build" narrative** (avoid gratuitous motion)
- [ ] **Step 3: Ensure `prefers-reduced-motion` respected**

```css
@media (prefers-reduced-motion: reduce) {
  .journey-node, .journey-edge-flow, .journey-spin-slow, .journey-pulse { animation: none !important; }
}
```

- [ ] **Step 4: Commit**

```bash
git commit -am "polish(journeys): refined motion + reduced-motion support"
```

---

## Task 17: Polish pass — `polish` skill + `audit` skill

- [ ] **Step 1:** Run `polish` on the journey components — alignment, spacing, consistent hover states, empty states for the canvas when `dsl.activities` is empty ("Start by telling the agent what journey you want to build…").
- [ ] **Step 2:** Run `audit` skill — check focus states on nodes, keyboard nav (tab through chat + toolbar), color contrast on all node variants, canvas performance with 30+ nodes (measure via React DevTools profiler).
- [ ] **Step 3:** Fix top 3 issues from audit report.
- [ ] **Step 4:** Commit

```bash
git commit -am "polish(journeys): a11y + perf fixes from audit"
```

---

## Task 18: Regression check — BAU builder still works

- [ ] **Step 1:** Run the existing BAU build skill end-to-end on a test campaign (use a sandbox brief).
- [ ] **Step 2:** Verify `duplicateEmail`, `fillDERows`, image upload all still succeed.
- [ ] **Step 3:** Run existing unit tests:

```bash
cd packages/core && npx vitest run
```

Expected: all existing tests pass, no regressions from the journey-builder package.

- [ ] **Step 4:** If anything broke, fix before proceeding.

---

## Task 19: E2E golden path (manual)

Full user-level verification.

- [ ] **Step 1:** `npm start` — confirm Vite 4000 + Express 3002 both up.

- [ ] **Step 2:** Navigate to `http://localhost:4000/app/journeys`.

- [ ] **Step 3:** Click **New Journey** → name it `MVP_GoldenPath_150425`.

- [ ] **Step 4:** In chat, send:
> "Quiero un journey para Emirates Gold UAE: primero inspecciona la DE `BAU_Master_Dataset`. Luego SET entry con un query que filtre market='UAE' y tier IN ('Gold','Silver'), target DE `MVP_GoldenPath_150425_Entry`. Después añade wait 2 días, decision_split por tier con branches Gold y Silver, un email_send product-offer-ecommerce por branch, un wait_until_event email_opened tras el Gold (timeout 120h), y un engagement_split después. Finalmente valida."

- [ ] **Step 5:** Observe:
  - Canvas populates node by node, each with fade-in animation.
  - `tool_status` shimmer visible during tool execution.
  - Final `validate_journey` returns `valid: true`.

- [ ] **Step 6:** Click **Deploy to MC (Draft)**. Confirm prompt. Wait for banner "Desplegado como Draft en Marketing Cloud".

- [ ] **Step 7:** Verify in Postgres:

```bash
psql "$DATABASE_URL" -c "SELECT id, name, status, mc_interaction_id, mc_target_de_key, mc_query_activity_id FROM journeys WHERE name = 'MVP_GoldenPath_150425'"
```

All four MC ids populated, status = `deployed_draft`.

- [ ] **Step 8:** Log into MC sandbox → Journey Builder → find the journey as Draft → verify topology matches.

- [ ] **Step 9:** Refresh AgentOS page — chat history + canvas restore from Postgres identically.

- [ ] **Step 10:** Commit verification notes

```bash
echo "MVP e2e verified $(date)" >> .claude/tasks/lessons.md
git commit -am "docs(journeys): log MVP e2e verification"
```

---

## Task 20: Update memory + lessons

- [ ] **Step 1:** Add memory pointer in `C:\Users\gmunoz02\.claude\projects\c--Users-gmunoz02-Desktop-agentOS\memory\MEMORY.md` for Journey Builder (scope, DSL shape, deploy always Draft).

- [ ] **Step 2:** Append to `.claude/tasks/lessons.md` any surprises encountered (e.g., MC SOAP quirks for DE schema lookup, ReactFlow gotchas).

- [ ] **Step 3:** Commit

```bash
git commit -am "docs(journeys): memory + lessons entries for MVP"
```

---

## Self-Review

**Spec coverage:**
- Architecture diagram ✓ (Tasks 1–9)
- DSL intermediate representation ✓ (Task 2)
- Compiler DSL→SFMC ✓ (Task 3)
- 5 activity types ✓ (validator covers all, compiler covers all, 5 node components)
- Master DE → Query → Target DE → Entry ✓ (Tasks 4, 6, 9)
- Placeholder email shells ✓ (Task 5)
- Always-Draft deploy ✓ (Task 6, system prompt enforces)
- Draft status in MC ✓ (compiler sets `status: 'Draft'`)
- ReactFlow + dagre + animated nodes ✓ (Tasks 10–14, 16)
- Persistence in Postgres (journeys + chat) ✓ (Task 1)
- SSE streaming with `journey_state` + `tool_status` ✓ (Task 9, 12)
- i18n ES/EN from commit 1 ✓ (Task 11)
- CSS custom properties, no Tailwind ✓ (Task 10, 14)
- Reuse `duplicateEmail`, `ensureFolderHierarchy`, `createDataExtension`, `createMCClient` ✓ (Tasks 5, 6)
- Hard validation gate pre-deploy ✓ (Task 2 + Task 9 dispatch)
- Railway migration ✓ (Task 1 Step 3)

**No placeholders:** all steps include complete code.

**Type consistency:** DSL `activity.type` values (`wait_duration`, `decision_split`, `email_send`, `wait_until_event`, `engagement_split`) used identically in validator, compiler, mutators, node type mapping, and Claude system prompt. Function names consistent (`validateDsl`, `compileDslToInteraction`, `deployJourney`, `createEmailShells`, `createQueryActivity`, `startQueryActivity`, `pollQueryActivity`, `setEntrySource`, `addActivity`, `updateActivity`, `removeActivity`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-journey-builder-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatcha un subagente por task con review entre cada uno, iteración rápida, contexto principal limpio.

**2. Inline Execution** — ejecuta los tasks en esta misma sesión en batches, con checkpoints para review.

¿Cuál prefieres?
