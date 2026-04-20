# Competitor Intel — DERTOUR Lifecycle Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reusable AgentOS module (`/competitor-intel`) that runs a live lifecycle audit of 5 DERTOUR UK brands using 2 real Gmail-backed personas, Gmail API ingestion, hybrid engagement simulation, 6 dashboard screens, and a `.docx` exporter — ready to demo Friday 2026-04-24 to Sarah Shaughnessy.

**Architecture:** Monolithic module under `packages/core/competitor-intel/` (reusable domain logic) + `apps/dashboard/src/pages/CompetitorIntel/` (React screens). New endpoints added to single `server.js` per project rule #5. Railway Postgres as single source of truth (rule #7). All new tables prefixed `competitor_*`. Token encryption reuses existing AES-256-GCM pattern.

**Tech Stack:** Node 20, Express 5, React 19, Vite 7, Recharts 3, Vitest 4, PostgreSQL 16 (Railway), Anthropic SDK (claude-sonnet-4-6), Gmail API (googleapis), firecrawl-mcp for recon, python-docx for export, node-cron-style setInterval for worker, AES-256-GCM via Node `crypto`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-competitor-intel-design.md`

**Worktree:** `C:\Users\gmunoz02\Desktop\agentOS-competitor-intel` on branch `feat/competitor-intel`.

---

## Capa 1 — Foundations (Monday AM, ~3h)

Goal: branch ready, schema on Railway, encryption helper tested, base routing, seed data, automated recon of 5 sites producing deliverable recon notes.

### Task 1.1: Project scaffolding

**Files:**
- Create: `packages/core/competitor-intel/README.md`
- Create: `packages/core/competitor-intel/index.js`
- Modify: `apps/dashboard/package.json` (add googleapis dep)

- [ ] **Step 1: Create module folder structure**

```bash
mkdir -p packages/core/competitor-intel
mkdir -p apps/dashboard/src/pages/CompetitorIntel
mkdir -p apps/dashboard/src/pages/CompetitorIntel/components
mkdir -p apps/dashboard/__tests__/competitor-intel
mkdir -p packages/core/competitor-intel/__tests__
```

- [ ] **Step 2: Create README with module purpose**

Create `packages/core/competitor-intel/README.md`:

```markdown
# competitor-intel

Reusable module for competitive lifecycle intelligence.
See: docs/superpowers/specs/2026-04-20-competitor-intel-design.md

Consumed by:
- apps/dashboard (UI + API endpoints in server.js)

Dependencies (internal):
- packages/core/db (pool)
- packages/core/ai-providers (claude)
- packages/core/crypto (AES-GCM helper — to be created in Task 1.2)

Public exports via index.js:
- createInvestigation, getInvestigation
- ingestEmails (worker entry)
- classifyEmail (phase 1 + 2)
- simulateEngagement
- calculateScoring
- exportAnalysisDocx
- reconBrand
```

- [ ] **Step 3: Create stub index.js**

```javascript
// packages/core/competitor-intel/index.js
// Public surface. Each export added incrementally in later tasks.
module.exports = {};
```

- [ ] **Step 4: Install googleapis dependency**

Run: `cd apps/dashboard && npm install googleapis@144`
Expected: dependency added to package.json, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/competitor-intel apps/dashboard/package.json apps/dashboard/package-lock.json docs/superpowers
git commit -m "feat(competitor-intel): scaffold module + googleapis dep"
```

---

### Task 1.2: Crypto helper (AES-256-GCM) — TDD

**Files:**
- Create: `packages/core/crypto/aes-gcm.js`
- Create: `packages/core/crypto/__tests__/aes-gcm.test.js`
- Create: `packages/core/crypto/index.js`

- [ ] **Step 1: Write failing test**

Create `packages/core/crypto/__tests__/aes-gcm.test.js`:

```javascript
const { describe, it, expect, beforeEach } = require('vitest');
const { encrypt, decrypt } = require('../aes-gcm');

const KEY = 'a'.repeat(64); // 32 bytes hex = 64 chars

describe('aes-gcm', () => {
  it('roundtrips a string', () => {
    const plaintext = 'hello-secret-token';
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toContain('hello');
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random iv)', () => {
    const a = encrypt('same', KEY);
    const b = encrypt('same', KEY);
    expect(a).not.toBe(b);
  });

  it('fails decrypt with wrong key', () => {
    const ct = encrypt('x', KEY);
    const wrong = 'b'.repeat(64);
    expect(() => decrypt(ct, wrong)).toThrow();
  });

  it('fails decrypt with tampered ciphertext', () => {
    const ct = encrypt('x', KEY);
    const tampered = ct.slice(0, -2) + '00';
    expect(() => decrypt(tampered, KEY)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/crypto`
Expected: FAIL — "Cannot find module '../aes-gcm'"

- [ ] **Step 3: Implement crypto helper**

Create `packages/core/crypto/aes-gcm.js`:

```javascript
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('key must be 32 bytes hex');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('hex');
}

function decrypt(ciphertextHex, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(ciphertextHex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
```

- [ ] **Step 4: Create index barrel**

Create `packages/core/crypto/index.js`:

```javascript
module.exports = require('./aes-gcm');
```

- [ ] **Step 5: Run tests — all green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/crypto`
Expected: PASS 4/4.

- [ ] **Step 6: Add env var placeholder**

Append to `.env.example` (create if missing):

```
COMPETITOR_INTEL_KEY=<generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))">
```

And to your local `.env`:

```bash
node -e "console.log('COMPETITOR_INTEL_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/crypto .env.example
git commit -m "feat(crypto): add AES-256-GCM helper with roundtrip tests"
```

---

### Task 1.3: Database migration — all 8 tables on Railway

**Files:**
- Create: `packages/core/db/migrations/2026-04-20-competitor-intel.sql`
- Modify: `packages/core/db/schema.sql` (append new tables)

- [ ] **Step 1: Write migration SQL**

Create `packages/core/db/migrations/2026-04-20-competitor-intel.sql`:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS competitor_investigations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id INT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_brands (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  category TEXT,
  positioning TEXT,
  recon_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_personas (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT,
  location TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_persona_gmail (
  persona_id INT PRIMARY KEY REFERENCES competitor_personas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS competitor_playbook_steps (
  id SERIAL PRIMARY KEY,
  brand_id INT NOT NULL REFERENCES competitor_brands(id) ON DELETE CASCADE,
  persona_id INT NOT NULL REFERENCES competitor_personas(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  action TEXT NOT NULL,
  channel TEXT,
  data_to_provide JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_signal TEXT,
  wait_after_minutes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','done','skipped')),
  executed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_playbook_brand_persona ON competitor_playbook_steps(brand_id, persona_id);

CREATE TABLE IF NOT EXISTS competitor_emails (
  id SERIAL PRIMARY KEY,
  persona_id INT NOT NULL REFERENCES competitor_personas(id) ON DELETE CASCADE,
  brand_id INT REFERENCES competitor_brands(id) ON DELETE SET NULL,
  gmail_message_id TEXT NOT NULL UNIQUE,
  sender_email TEXT,
  sender_domain TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_headers JSONB
);

CREATE INDEX IF NOT EXISTS idx_emails_persona_received ON competitor_emails(persona_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_brand_received  ON competitor_emails(brand_id, received_at DESC);

CREATE TABLE IF NOT EXISTS competitor_email_engagement (
  id SERIAL PRIMARY KEY,
  email_id INT NOT NULL REFERENCES competitor_emails(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open','click')),
  link_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  simulated BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS competitor_brand_scores (
  brand_id INT PRIMARY KEY REFERENCES competitor_brands(id) ON DELETE CASCADE,
  lifecycle_maturity NUMERIC(3,1),
  email_sophistication NUMERIC(3,1),
  journey_depth NUMERIC(3,1),
  personalisation NUMERIC(3,1),
  overall NUMERIC(3,1),
  last_calculated_at TIMESTAMPTZ,
  manual_notes TEXT
);

CREATE TABLE IF NOT EXISTS competitor_insights (
  id SERIAL PRIMARY KEY,
  brand_id INT REFERENCES competitor_brands(id) ON DELETE CASCADE,
  category TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  body TEXT,
  evidence_email_ids INT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
```

- [ ] **Step 2: Apply migration against Railway**

Run: `psql "$DATABASE_URL" -f packages/core/db/migrations/2026-04-20-competitor-intel.sql`
Expected: `BEGIN ... COMMIT`, no errors.

- [ ] **Step 3: Verify tables exist**

Run: `psql "$DATABASE_URL" -c "\dt competitor_*"`
Expected: 8 tables listed.

- [ ] **Step 4: Reflect in schema.sql**

Append the migration content (without BEGIN/COMMIT) to `packages/core/db/schema.sql`, preceded by:

```sql
-- Competitor Intel (2026-04-20)
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/db/migrations/2026-04-20-competitor-intel.sql packages/core/db/schema.sql
git commit -m "feat(db): competitor-intel schema (8 tables on Railway)"
```

---

### Task 1.4: Seed initial investigation

**Files:**
- Create: `packages/core/competitor-intel/seed.js`
- Create: `packages/core/competitor-intel/__tests__/seed.test.js`

- [ ] **Step 1: Write failing test**

Create `packages/core/competitor-intel/__tests__/seed.test.js`:

```javascript
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const { pool } = require('../../db');
const { seedDertourInvestigation } = require('../seed');

describe('seed', () => {
  let investigationId;

  afterAll(async () => {
    if (investigationId) {
      await pool.query('DELETE FROM competitor_investigations WHERE id = $1', [investigationId]);
    }
  });

  it('creates 1 investigation, 5 brands, 2 personas, 48 playbook steps (6 runs × 8 steps)', async () => {
    const result = await seedDertourInvestigation({ ownerUserId: null });
    investigationId = result.investigationId;

    const brands = await pool.query('SELECT * FROM competitor_brands WHERE investigation_id = $1', [investigationId]);
    expect(brands.rows.length).toBe(5);
    expect(brands.rows.map(b => b.name).sort()).toEqual(['CV Villas','Carrier','Explore Worldwide','Inntravel','Kuoni']);

    const personas = await pool.query('SELECT * FROM competitor_personas WHERE investigation_id = $1', [investigationId]);
    expect(personas.rows.length).toBe(2);

    const steps = await pool.query(`
      SELECT COUNT(*)::int AS c FROM competitor_playbook_steps
      WHERE brand_id IN (SELECT id FROM competitor_brands WHERE investigation_id = $1)
    `, [investigationId]);
    expect(steps.rows[0].c).toBe(48);
  });
});
```

- [ ] **Step 2: Run test — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: FAIL — "Cannot find module '../seed'".

- [ ] **Step 3: Implement seed**

Create `packages/core/competitor-intel/seed.js`:

```javascript
const { pool } = require('../db');

const BRANDS = [
  { name: 'Kuoni',              website: 'kuoni.co.uk',    category: 'luxury',     positioning: 'Traditional luxury travel; quote-based model.' },
  { name: 'Carrier',            website: 'carrier.co.uk',  category: 'ultra-luxury', positioning: 'Consultant-led ultra-luxury; 1-to-1 journeys.' },
  { name: 'Inntravel',          website: 'inntravel.co.uk',category: 'slow-travel',positioning: 'Slow, self-guided walking/cycling holidays.' },
  { name: 'Explore Worldwide',  website: 'explore.co.uk',  category: 'adventure',  positioning: 'Small-group adventure holidays.' },
  { name: 'CV Villas',          website: 'cvvillas.com',   category: 'villa-rental',positioning: 'Transactional villa booking, Mediterranean focus.' }
];

const PERSONAS = [
  {
    name: 'Sarah Whitfield',
    age: 34,
    location: 'London SW1A 1AA, UK',
    profile: {
      segment: 'luxury_honeymooner',
      travel_interests: ['maldives','seychelles','mauritius','honeymoon','overwater','private villa','fine dining'],
      budget_band: 'high',
      engagement_pattern: { base_open_rate: 0.8, click_keywords: ['maldives','seychelles','mauritius','honeymoon','overwater','private villa'] }
    }
  },
  {
    name: 'Tom Haskins',
    age: 29,
    location: 'Manchester M1 1AA, UK',
    profile: {
      segment: 'adventure_solo',
      travel_interests: ['trek','hike','adventure','small group','patagonia','himalaya','kilimanjaro'],
      budget_band: 'mid',
      engagement_pattern: { base_open_rate: 0.6, click_keywords: ['trek','hike','adventure','small group','patagonia','himalaya','kilimanjaro'] }
    }
  }
];

// persona_segment -> list of brand names for playbook runs
const ASSIGNMENTS = {
  luxury_honeymooner: ['Kuoni','Carrier','Inntravel'],
  adventure_solo:     ['Explore Worldwide','CV Villas','Inntravel']
};

const BASE_STEPS = [
  { step_order: 1, action: 'Passive recon — visit homepage, accept essential cookies only. Capture cookie wall, tracking pixels, CDP.', channel: 'web',   expected_signal: 'No email expected', wait_after_minutes: 0 },
  { step_order: 2, action: 'Newsletter sign-up from footer or popup with persona data.',                                                channel: 'web',   expected_signal: 'Welcome email within 24h', wait_after_minutes: 5 },
  { step_order: 3, action: 'Confirm double opt-in by clicking confirmation link if sent.',                                             channel: 'email', expected_signal: 'Post-confirmation welcome or nurture', wait_after_minutes: 60 },
  { step_order: 4, action: 'Wait 24h observing emails with zero further interaction.',                                                 channel: 'none',  expected_signal: 'Baseline nurture cadence', wait_after_minutes: 1440 },
  { step_order: 5, action: 'Create account if brand supports it, with persona data.',                                                  channel: 'web',   expected_signal: 'Account-creation email', wait_after_minutes: 30 },
  { step_order: 6, action: 'Discover preference center, document granularity.',                                                        channel: 'web',   expected_signal: 'Preference-update confirmation', wait_after_minutes: 15 },
  { step_order: 7, action: 'High-intent action: quote request or cart to checkout, brand-specific.',                                   channel: 'web',   expected_signal: 'Sales follow-up within 48h', wait_after_minutes: 60 },
  { step_order: 8, action: 'Cart/form abandonment test: fill ~90% then exit.',                                                         channel: 'web',   expected_signal: 'Abandonment email within 24–72h', wait_after_minutes: 1440 }
];

async function seedDertourInvestigation({ ownerUserId = null } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inv = await client.query(
      'INSERT INTO competitor_investigations(name, description, owner_user_id) VALUES ($1,$2,$3) RETURNING id',
      ['DERTOUR UK Lifecycle Audit — April 2026', 'Lifecycle/email/journey audit of 5 DERTOUR UK brands for Emirates SVP presentation.', ownerUserId]
    );
    const investigationId = inv.rows[0].id;

    const brandIds = {};
    for (const b of BRANDS) {
      const r = await client.query(
        'INSERT INTO competitor_brands(investigation_id, name, website, category, positioning) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [investigationId, b.name, b.website, b.category, b.positioning]
      );
      brandIds[b.name] = r.rows[0].id;
    }

    const personaIds = {};
    for (const p of PERSONAS) {
      const r = await client.query(
        'INSERT INTO competitor_personas(investigation_id, name, age, location, profile) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [investigationId, p.name, p.age, p.location, p.profile]
      );
      personaIds[p.profile.segment] = r.rows[0].id;
    }

    for (const [segment, brandNames] of Object.entries(ASSIGNMENTS)) {
      const personaId = personaIds[segment];
      for (const brandName of brandNames) {
        const brandId = brandIds[brandName];
        for (const step of BASE_STEPS) {
          await client.query(
            `INSERT INTO competitor_playbook_steps
             (brand_id, persona_id, step_order, action, channel, expected_signal, wait_after_minutes)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [brandId, personaId, step.step_order, step.action, step.channel, step.expected_signal, step.wait_after_minutes]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { investigationId, brandIds, personaIds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedDertourInvestigation };
```

- [ ] **Step 4: Run tests — all green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: PASS 1/1.

- [ ] **Step 5: Execute seed once against Railway**

Run: `cd apps/dashboard && node -e "require('../../packages/core/competitor-intel/seed').seedDertourInvestigation().then(r => console.log('Seeded:', r)).catch(e => { console.error(e); process.exit(1); })"`
Expected: `Seeded: { investigationId: <n>, brandIds: {...}, personaIds: {...} }`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/competitor-intel/seed.js packages/core/competitor-intel/__tests__
git commit -m "feat(competitor-intel): seed DERTOUR investigation (5 brands, 2 personas, 48 steps)"
```

---

### Task 1.5: Base API routes + route skeleton in dashboard

**Files:**
- Modify: `apps/dashboard/server.js` (add `/api/competitor-intel/*` section)
- Create: `apps/dashboard/src/pages/CompetitorIntel/index.jsx`
- Modify: `apps/dashboard/src/App.jsx` (or wherever routes live — find & confirm)

- [ ] **Step 1: Locate router config**

Run: `grep -rn "Routes" apps/dashboard/src --include="*.jsx" | head`
Note the file where `<Routes>` is defined.

- [ ] **Step 2: Add API endpoints to server.js**

Find existing endpoints and append a new section (keep parametrized queries, rule #6):

```javascript
// ==================== Competitor Intel ====================
const competitorIntel = require('../../packages/core/competitor-intel');

app.get('/api/competitor-intel/investigations', async (req, res) => {
  try {
    const r = await pool.query('SELECT id, name, description, status, created_at FROM competitor_investigations ORDER BY created_at DESC');
    res.json({ investigations: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/competitor-intel/investigations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const inv = await pool.query('SELECT * FROM competitor_investigations WHERE id = $1', [id]);
    if (!inv.rows[0]) return res.status(404).json({ error: 'not found' });
    const brands = await pool.query('SELECT * FROM competitor_brands WHERE investigation_id = $1 ORDER BY name', [id]);
    const personas = await pool.query('SELECT * FROM competitor_personas WHERE investigation_id = $1 ORDER BY name', [id]);
    res.json({ investigation: inv.rows[0], brands: brands.rows, personas: personas.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Create React page skeleton**

Create `apps/dashboard/src/pages/CompetitorIntel/index.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

const API = import.meta.env.VITE_API_URL || '/api';

export default function CompetitorIntelPage() {
  const { t } = useTranslation();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/competitor-intel/investigations`)
      .then(r => r.json())
      .then(d => { setInvestigations(d.investigations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="ci-loading">{t('ci.loading') || 'Loading...'}</div>;

  return (
    <div className="ci-page">
      <h1>{t('ci.title') || 'Competitor Intel'}</h1>
      <ul className="ci-investigation-list">
        {investigations.map(inv => (
          <li key={inv.id}>
            <a href={`/competitor-intel/${inv.id}`}>{inv.name}</a>
            <small>{new Date(inv.created_at).toLocaleDateString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Add i18n keys**

Modify `apps/dashboard/src/i18n/translations.js` — add both ES and EN:

```javascript
// inside en: {
'ci.title': 'Competitor Intel',
'ci.loading': 'Loading...',
// inside es: {
'ci.title': 'Competitor Intel',
'ci.loading': 'Cargando...',
```

- [ ] **Step 5: Wire route**

In the `<Routes>` file from Step 1, add:

```jsx
import CompetitorIntel from './pages/CompetitorIntel';
// inside Routes:
<Route path="/competitor-intel" element={<CompetitorIntel />} />
<Route path="/competitor-intel/:id" element={<CompetitorIntel />} />
```

- [ ] **Step 6: Start dev + smoke test**

Run: `npm start` (from repo root)
Open: http://localhost:4000/competitor-intel
Expected: page renders, list shows "DERTOUR UK Lifecycle Audit — April 2026".

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/server.js apps/dashboard/src/pages/CompetitorIntel apps/dashboard/src/App.jsx apps/dashboard/src/i18n/translations.js
git commit -m "feat(competitor-intel): base route + list endpoint + landing page"
```

---

### Task 1.6: Automated recon (firecrawl) for 5 brands

**Files:**
- Create: `packages/core/competitor-intel/recon.js`
- Create: `packages/core/competitor-intel/__tests__/recon.test.js`
- Modify: `apps/dashboard/server.js` (endpoint to trigger recon + read results)

- [ ] **Step 1: Write failing test for recon parsing**

Create `packages/core/competitor-intel/__tests__/recon.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { detectTechFromHtml, extractNewsletterForm } = require('../recon');

describe('recon parsers', () => {
  it('detects SFMC from embedded tracker URL', () => {
    const html = '<img src="https://click.exacttarget.com/open.aspx?x=123"/>';
    const tech = detectTechFromHtml(html);
    expect(tech.esps).toContain('Salesforce Marketing Cloud');
  });

  it('detects Klaviyo from script tag', () => {
    const html = '<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>';
    const tech = detectTechFromHtml(html);
    expect(tech.esps).toContain('Klaviyo');
  });

  it('detects OneTrust cookie banner', () => {
    const html = '<div id="onetrust-banner-sdk"></div>';
    const tech = detectTechFromHtml(html);
    expect(tech.cdps).toContain('OneTrust');
  });

  it('extracts newsletter email input fields', () => {
    const html = `
      <form action="/subscribe" method="post">
        <input type="email" name="email_address" required />
        <input type="text" name="first_name" />
      </form>`;
    const form = extractNewsletterForm(html);
    expect(form.fields).toEqual(expect.arrayContaining(['email_address','first_name']));
    expect(form.action).toBe('/subscribe');
  });
});
```

- [ ] **Step 2: Run test — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: FAIL — recon module missing.

- [ ] **Step 3: Implement recon parsers + orchestrator**

Create `packages/core/competitor-intel/recon.js`:

```javascript
const { pool } = require('../db');

const ESP_SIGNATURES = [
  { name: 'Salesforce Marketing Cloud', patterns: [/exacttarget\.com/i, /cloud\.em\./i, /s7\.exacttarget/i] },
  { name: 'Braze',                      patterns: [/braze\.com/i, /appboy\.com/i] },
  { name: 'Klaviyo',                    patterns: [/klaviyo\.com/i] },
  { name: 'Mailchimp',                  patterns: [/list-manage\.com/i, /mailchimp\.com/i] },
  { name: 'Adestra',                    patterns: [/adestra\.com/i, /tripolis\.com/i] },
  { name: 'Bloomreach',                 patterns: [/bloomreach\.com/i, /exponea\.com/i] },
  { name: 'HubSpot',                    patterns: [/hubspot\.com/i, /hs-scripts\.com/i] },
  { name: 'Emarsys',                    patterns: [/emarsys\.com/i, /scarabresearch\.com/i] }
];

const CDP_SIGNATURES = [
  { name: 'OneTrust',  patterns: [/onetrust/i, /cookielaw\.org/i] },
  { name: 'Cookiebot', patterns: [/cookiebot/i] },
  { name: 'Segment',   patterns: [/segment\.com\/analytics\.js/i, /cdn\.segment\.com/i] },
  { name: 'Tealium',   patterns: [/tealium/i] }
];

function detectTechFromHtml(html) {
  const esps = [];
  const cdps = [];
  for (const esp of ESP_SIGNATURES) {
    if (esp.patterns.some(p => p.test(html))) esps.push(esp.name);
  }
  for (const cdp of CDP_SIGNATURES) {
    if (cdp.patterns.some(p => p.test(html))) cdps.push(cdp.name);
  }
  return { esps, cdps };
}

function extractNewsletterForm(html) {
  const formRe = /<form[^>]*action="([^"]*)"[^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRe.exec(html)) !== null) {
    const inner = match[2];
    if (!/type=["']email["']/i.test(inner)) continue;
    const action = match[1];
    const fields = [];
    const inputRe = /<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = inputRe.exec(inner)) !== null) fields.push(m[1]);
    return { action, fields };
  }
  return { action: null, fields: [] };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentOS-Recon/1.0)' },
    redirect: 'follow'
  });
  return { status: res.status, html: await res.text(), headers: Object.fromEntries(res.headers) };
}

async function reconBrand(brandId) {
  const brand = (await pool.query('SELECT * FROM competitor_brands WHERE id = $1', [brandId])).rows[0];
  if (!brand) throw new Error('brand not found');
  const url = brand.website.startsWith('http') ? brand.website : `https://${brand.website}`;
  const { status, html, headers } = await fetchHtml(url);
  const tech = detectTechFromHtml(html);
  const form = extractNewsletterForm(html);
  const notes = {
    fetched_at: new Date().toISOString(),
    http_status: status,
    server_header: headers.server || null,
    esps_detected: tech.esps,
    cdps_detected: tech.cdps,
    newsletter_form: form,
    account_creation_hint: /\/register|\/sign[-]?up|\/account\/create/i.test(html),
    cart_hint:             /\/cart|\/basket|add[-_ ]to[-_ ]cart/i.test(html),
    quote_hint:            /request[-_ ]a[-_ ]quote|enquire|call[-_ ]an?[-_ ](expert|specialist)/i.test(html)
  };
  await pool.query('UPDATE competitor_brands SET recon_notes = $1 WHERE id = $2', [notes, brandId]);
  return notes;
}

async function reconInvestigation(investigationId) {
  const brands = (await pool.query('SELECT id FROM competitor_brands WHERE investigation_id = $1', [investigationId])).rows;
  const out = [];
  for (const b of brands) {
    try { out.push({ brandId: b.id, notes: await reconBrand(b.id) }); }
    catch (e) { out.push({ brandId: b.id, error: e.message }); }
  }
  return out;
}

module.exports = { detectTechFromHtml, extractNewsletterForm, reconBrand, reconInvestigation };
```

- [ ] **Step 4: Run tests — all green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: PASS 5/5 (4 recon + 1 seed).

- [ ] **Step 5: Wire endpoints**

Append to server.js Competitor Intel section:

```javascript
app.post('/api/competitor-intel/brands/:id/recon', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reconBrand } = competitorIntel;
    const notes = await reconBrand(id);
    res.json({ recon: notes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/competitor-intel/investigations/:id/recon-all', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reconInvestigation } = competitorIntel;
    const results = await reconInvestigation(id);
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 6: Export from module barrel**

Update `packages/core/competitor-intel/index.js`:

```javascript
module.exports = {
  ...require('./seed'),
  ...require('./recon')
};
```

- [ ] **Step 7: Run recon-all against Railway investigation**

Run (after restarting server): `curl -X POST http://localhost:3002/api/competitor-intel/investigations/1/recon-all`
Expected: JSON with 5 `recon` results, no errors. Check `recon_notes` populated: `psql "$DATABASE_URL" -c "SELECT name, recon_notes->'esps_detected' FROM competitor_brands;"`

- [ ] **Step 8: Commit**

```bash
git add packages/core/competitor-intel/recon.js packages/core/competitor-intel/index.js packages/core/competitor-intel/__tests__/recon.test.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): automated recon — ESP/CDP/form detection for 5 brands"
```

---

### Capa 1 checkpoint

Stop. Verify: (a) all 5 brands have `recon_notes` populated; (b) `/competitor-intel` landing page shows DERTOUR investigation; (c) test suite green. Move to Capa 2 only after user review of recon notes and playbook refinement (user action: read notes, tell me which step 7 variants to use per brand).

---

## Capa 2 — Gmail OAuth + Ingestion + Phase 1 Classifier + Screens 1 & 3 (Mon PM → Tuesday, ~6h)

Goal: user connects 2 Gmail accounts, emails flow into DB classified by domain, Overview + Persona Inbox screens render real data.

### Task 2.1: Google OAuth setup (manual) + env vars

**Files:**
- Modify: `.env` (local), `.env.example`

- [ ] **Step 1: Create Google Cloud project (user-action, one-time)**

In https://console.cloud.google.com:
1. New project: "AgentOS Competitor Intel"
2. APIs & Services → Library → enable "Gmail API"
3. OAuth consent screen → External → Testing mode; add your 2 Gmail addresses as test users
4. Credentials → Create OAuth client ID → Web application
5. Authorized redirect URI: `http://localhost:3002/api/oauth/google/callback`
6. Copy Client ID + Client Secret

- [ ] **Step 2: Add env vars**

Append to `.env.example`:

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3002/api/oauth/google/callback
```

Fill actual values in your local `.env`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(env): add Google OAuth env vars for Gmail ingestion"
```

---

### Task 2.2: OAuth endpoints + token storage

**Files:**
- Create: `packages/core/competitor-intel/gmail-oauth.js`
- Create: `packages/core/competitor-intel/__tests__/gmail-oauth.test.js`
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Write failing test for token cycle helpers**

Create `packages/core/competitor-intel/__tests__/gmail-oauth.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { buildAuthUrl, parseCallback } = require('../gmail-oauth');

describe('gmail-oauth helpers', () => {
  it('builds auth URL with readonly scope and state', () => {
    const url = buildAuthUrl({ clientId: 'cid', redirectUri: 'http://x', state: 'p=1' });
    expect(url).toContain('scope=');
    expect(url).toContain('gmail.readonly');
    expect(url).toContain('state=p%3D1');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('parses callback params', () => {
    const parsed = parseCallback('code=abc&state=persona_id%3D7');
    expect(parsed.code).toBe('abc');
    expect(parsed.state).toBe('persona_id=7');
  });
});
```

- [ ] **Step 2: Run — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement oauth module**

Create `packages/core/competitor-intel/gmail-oauth.js`:

```javascript
const { google } = require('googleapis');
const { pool } = require('../db');
const { encrypt, decrypt } = require('../crypto');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseCallback(queryString) {
  const p = new URLSearchParams(queryString);
  return { code: p.get('code'), state: p.get('state') };
}

async function exchangeCodeAndStore({ personaId, code }) {
  const oauth = client();
  const { tokens } = await oauth.getToken(code);
  const info = await google.oauth2('v2').userinfo.get({ auth: Object.assign(oauth, { credentials: tokens }) });
  const email = info.data.email;

  const key = process.env.COMPETITOR_INTEL_KEY;
  const accessEnc = tokens.access_token ? encrypt(tokens.access_token, key) : null;
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token, key) : null;
  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await pool.query(`
    INSERT INTO competitor_persona_gmail(persona_id, email, access_token_encrypted, refresh_token_encrypted, token_expiry)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (persona_id) DO UPDATE SET
      email = EXCLUDED.email,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, competitor_persona_gmail.refresh_token_encrypted),
      token_expiry = EXCLUDED.token_expiry
  `, [personaId, email, accessEnc, refreshEnc, expiry]);

  return { email };
}

async function getAuthorizedClient(personaId) {
  const r = await pool.query('SELECT * FROM competitor_persona_gmail WHERE persona_id = $1', [personaId]);
  if (!r.rows[0]) throw new Error('persona has no gmail connected');
  const row = r.rows[0];
  const key = process.env.COMPETITOR_INTEL_KEY;
  const oauth = client();
  oauth.setCredentials({
    access_token: row.access_token_encrypted ? decrypt(row.access_token_encrypted, key) : null,
    refresh_token: row.refresh_token_encrypted ? decrypt(row.refresh_token_encrypted, key) : null,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null
  });
  oauth.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await pool.query(
        'UPDATE competitor_persona_gmail SET access_token_encrypted = $1, token_expiry = $2 WHERE persona_id = $3',
        [encrypt(newTokens.access_token, key), newTokens.expiry_date ? new Date(newTokens.expiry_date) : null, personaId]
      );
    }
  });
  return oauth;
}

module.exports = { buildAuthUrl, parseCallback, exchangeCodeAndStore, getAuthorizedClient };
```

- [ ] **Step 4: Run tests — green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: PASS.

- [ ] **Step 5: Wire endpoints**

Append to server.js:

```javascript
app.get('/api/oauth/google/authorize', (req, res) => {
  const { persona_id } = req.query;
  if (!persona_id) return res.status(400).json({ error: 'persona_id required' });
  const { buildAuthUrl } = competitorIntel;
  const url = buildAuthUrl({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    state: `persona_id=${persona_id}`
  });
  res.redirect(url);
});

app.get('/api/oauth/google/callback', async (req, res) => {
  try {
    const { exchangeCodeAndStore } = competitorIntel;
    const { code, state } = req.query;
    const personaId = parseInt(new URLSearchParams(state).get('persona_id'), 10);
    const { email } = await exchangeCodeAndStore({ personaId, code });
    res.redirect(`/competitor-intel?gmail_connected=${encodeURIComponent(email)}`);
  } catch (e) {
    res.status(500).send('OAuth error: ' + e.message);
  }
});
```

- [ ] **Step 6: Update barrel**

Edit `packages/core/competitor-intel/index.js`:

```javascript
module.exports = {
  ...require('./seed'),
  ...require('./recon'),
  ...require('./gmail-oauth')
};
```

- [ ] **Step 7: Manual test — connect real Gmail**

Start server. In browser visit `http://localhost:3002/api/oauth/google/authorize?persona_id=1`. Authorize with one of your 2 new Gmails. Verify:
`psql "$DATABASE_URL" -c "SELECT persona_id, email, LENGTH(access_token_encrypted) FROM competitor_persona_gmail;"`
Expected: row with persona_id=1, email set, access_token_encrypted has ~200+ chars.

Repeat for persona_id=2.

- [ ] **Step 8: Commit**

```bash
git add packages/core/competitor-intel/gmail-oauth.js packages/core/competitor-intel/index.js packages/core/competitor-intel/__tests__/gmail-oauth.test.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): Gmail OAuth with encrypted token storage"
```

---

### Task 2.3: Phase 1 email classifier (domain match)

**Files:**
- Create: `packages/core/competitor-intel/classifier.js`
- Create: `packages/core/competitor-intel/__tests__/classifier.test.js`

- [ ] **Step 1: Write failing tests**

Create `packages/core/competitor-intel/__tests__/classifier.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { matchBrandByDomain, classifyType } = require('../classifier');

const BRANDS = [
  { id: 10, name: 'Kuoni',   website: 'kuoni.co.uk' },
  { id: 11, name: 'Carrier', website: 'carrier.co.uk' },
  { id: 12, name: 'CV Villas', website: 'cvvillas.com' }
];

describe('phase-1 classifier', () => {
  it('matches root domain', () => {
    expect(matchBrandByDomain('newsletter@kuoni.co.uk', BRANDS)).toBe(10);
  });
  it('matches subdomain', () => {
    expect(matchBrandByDomain('hello@email.carrier.co.uk', BRANDS)).toBe(11);
  });
  it('returns null for unknown', () => {
    expect(matchBrandByDomain('noreply@mailgun.org', BRANDS)).toBeNull();
  });
  it('classifies subject patterns', () => {
    expect(classifyType({ subject: 'Welcome to Kuoni', body: '' })).toBe('welcome');
    expect(classifyType({ subject: 'Please confirm your subscription', body: '' })).toBe('double_opt_in');
    expect(classifyType({ subject: 'You left something in your basket', body: '' })).toBe('abandonment');
    expect(classifyType({ subject: 'Your booking confirmation #1234', body: '' })).toBe('transactional');
    expect(classifyType({ subject: 'We miss you — come back', body: '' })).toBe('re_engagement');
    expect(classifyType({ subject: 'Flash sale — 30% off', body: '' })).toBe('promo');
    expect(classifyType({ subject: 'Spring inspiration', body: '' })).toBe('nurture');
  });
});
```

- [ ] **Step 2: Run — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement classifier (phase 1 only)**

Create `packages/core/competitor-intel/classifier.js`:

```javascript
const { pool } = require('../db');

function extractRootDomain(host) {
  if (!host) return null;
  const parts = host.toLowerCase().split('.');
  if (parts.length >= 3 && ['co','com','org','net','gov'].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function domainFromEmail(email) {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

function matchBrandByDomain(sender, brands) {
  const domain = domainFromEmail(sender);
  if (!domain) return null;
  const root = extractRootDomain(domain);
  for (const b of brands) {
    const bRoot = extractRootDomain(b.website.replace(/^https?:\/\//, '').split('/')[0]);
    if (root === bRoot || domain.endsWith('.' + bRoot) || domain === bRoot) return b.id;
  }
  return null;
}

const TYPE_PATTERNS = [
  { type: 'double_opt_in',   re: /confirm (your )?(subscription|email|sign[-_ ]?up)|please confirm/i },
  { type: 'welcome',         re: /welcome( to|,)|thanks for (joining|signing up|subscribing)/i },
  { type: 'abandonment',     re: /left (something )?in your (cart|basket)|still thinking|forgot something|come back to your/i },
  { type: 'transactional',   re: /booking confirmation|order (confirmed|#\d+)|your (itinerary|receipt|invoice)/i },
  { type: 're_engagement',   re: /we miss you|come back|been a while|haven.?t seen you/i },
  { type: 'preference_update', re: /preferences (updated|saved)|manage your preferences/i },
  { type: 'promo',           re: /sale|% off|discount|limited[-_ ]?time|deal|offer/i }
];

function classifyType({ subject = '', body = '' }) {
  const txt = `${subject}\n${body.slice(0, 500)}`;
  for (const p of TYPE_PATTERNS) if (p.re.test(txt)) return p.type;
  return 'nurture';
}

async function classifyEmailPhase1(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query(`
    SELECT p.*, i.id AS investigation_id FROM competitor_personas p
    JOIN competitor_investigations i ON i.id = p.investigation_id
    WHERE p.id = $1
  `, [e.persona_id])).rows[0];
  const brands = (await pool.query('SELECT id, name, website FROM competitor_brands WHERE investigation_id = $1', [persona.investigation_id])).rows;

  const brandId = matchBrandByDomain(e.sender_email, brands);
  const type = classifyType({ subject: e.subject, body: e.body_text || '' });
  const classification = { type, phase: 1, confidence: brandId ? 0.9 : 0.4, reasoning: brandId ? 'domain match' : 'no domain match, type only' };

  await pool.query('UPDATE competitor_emails SET brand_id = COALESCE($1, brand_id), classification = $2 WHERE id = $3',
    [brandId, classification, emailId]);
  return { brandId, classification };
}

module.exports = { matchBrandByDomain, classifyType, classifyEmailPhase1, extractRootDomain, domainFromEmail };
```

- [ ] **Step 4: Run tests — green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/competitor-intel/classifier.js packages/core/competitor-intel/__tests__/classifier.test.js
git commit -m "feat(competitor-intel): phase-1 email classifier (domain + subject patterns)"
```

---

### Task 2.4: Gmail ingestion worker

**Files:**
- Create: `packages/core/competitor-intel/gmail-ingestion.js`
- Create: `packages/core/competitor-intel/__tests__/gmail-ingestion.test.js`
- Modify: `apps/dashboard/server.js` (endpoint + setInterval startup)
- Modify: `packages/core/competitor-intel/index.js`

- [ ] **Step 1: Write failing test for header parsing**

Create `packages/core/competitor-intel/__tests__/gmail-ingestion.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { parseGmailMessage } = require('../gmail-ingestion');

const FIXTURE = {
  id: 'abc123',
  internalDate: '1713609600000',
  payload: {
    headers: [
      { name: 'From', value: 'Kuoni <hello@kuoni.co.uk>' },
      { name: 'Subject', value: 'Welcome to Kuoni' },
      { name: 'Date', value: 'Mon, 20 Apr 2026 12:00:00 +0000' }
    ],
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/plain', body: { data: Buffer.from('hello plain').toString('base64url') } },
      { mimeType: 'text/html',  body: { data: Buffer.from('<p>hello html</p>').toString('base64url') } }
    ]
  }
};

describe('parseGmailMessage', () => {
  it('extracts subject, sender, date, bodies', () => {
    const p = parseGmailMessage(FIXTURE);
    expect(p.gmail_message_id).toBe('abc123');
    expect(p.sender_email).toBe('hello@kuoni.co.uk');
    expect(p.sender_domain).toBe('kuoni.co.uk');
    expect(p.subject).toBe('Welcome to Kuoni');
    expect(p.body_text).toContain('hello plain');
    expect(p.body_html).toContain('hello html');
    expect(p.received_at).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`

- [ ] **Step 3: Implement worker**

Create `packages/core/competitor-intel/gmail-ingestion.js`:

```javascript
const { google } = require('googleapis');
const { pool } = require('../db');
const { getAuthorizedClient } = require('./gmail-oauth');
const { classifyEmailPhase1 } = require('./classifier');

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function pickHeader(headers, name) {
  const h = headers.find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function parseBodies(payload) {
  let text = null, html = null;
  function walk(p) {
    if (!p) return;
    const mime = p.mimeType || '';
    if (mime === 'text/plain' && p.body?.data && !text) text = b64urlDecode(p.body.data);
    if (mime === 'text/html'  && p.body?.data && !html) html = b64urlDecode(p.body.data);
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  return { text, html };
}

function parseGmailMessage(msg) {
  const h = msg.payload?.headers || [];
  const fromRaw = pickHeader(h, 'From') || '';
  const m = fromRaw.match(/<([^>]+)>/);
  const sender_email = (m ? m[1] : fromRaw).trim().toLowerCase();
  const sender_domain = sender_email.includes('@') ? sender_email.split('@')[1] : null;
  const bodies = parseBodies(msg.payload);
  return {
    gmail_message_id: msg.id,
    sender_email,
    sender_domain,
    subject: pickHeader(h, 'Subject'),
    received_at: new Date(parseInt(msg.internalDate, 10)),
    body_text: bodies.text,
    body_html: bodies.html,
    raw_headers: h
  };
}

async function ingestPersona(personaId) {
  const oauth = await getAuthorizedClient(personaId);
  const gmail = google.gmail({ version: 'v1', auth: oauth });

  const rowLast = await pool.query('SELECT last_sync_at FROM competitor_persona_gmail WHERE persona_id = $1', [personaId]);
  const lastSync = rowLast.rows[0]?.last_sync_at;
  const afterEpoch = lastSync ? Math.floor(new Date(lastSync).getTime() / 1000) : 0;
  const q = `${afterEpoch ? `after:${afterEpoch} ` : ''}-from:me -category:social`;

  const list = await gmail.users.messages.list({
    userId: 'me', q, includeSpamTrash: true, maxResults: 100
  });
  const ids = (list.data.messages || []).map(m => m.id);

  let inserted = 0;
  for (const id of ids) {
    const exists = await pool.query('SELECT 1 FROM competitor_emails WHERE gmail_message_id = $1', [id]);
    if (exists.rowCount > 0) continue;
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const p = parseGmailMessage(data);
    const ins = await pool.query(`
      INSERT INTO competitor_emails
        (persona_id, gmail_message_id, sender_email, sender_domain, subject, received_at, body_text, body_html, raw_headers)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (gmail_message_id) DO NOTHING
      RETURNING id
    `, [personaId, p.gmail_message_id, p.sender_email, p.sender_domain, p.subject, p.received_at, p.body_text, p.body_html, JSON.stringify(p.raw_headers)]);
    if (ins.rows[0]) {
      await classifyEmailPhase1(ins.rows[0].id);
      inserted++;
    }
  }
  await pool.query('UPDATE competitor_persona_gmail SET last_sync_at = NOW() WHERE persona_id = $1', [personaId]);
  return { inserted, scanned: ids.length };
}

async function ingestAll() {
  const personas = (await pool.query('SELECT persona_id FROM competitor_persona_gmail')).rows;
  const out = [];
  for (const p of personas) {
    try { out.push({ personaId: p.persona_id, ...(await ingestPersona(p.persona_id)) }); }
    catch (e) { out.push({ personaId: p.persona_id, error: e.message }); }
  }
  return out;
}

function startWorker({ intervalMs = 5 * 60 * 1000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await ingestAll(); } catch (e) { console.error('[competitor-intel ingest]', e.message); }
    finally { running = false; }
  };
  const handle = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(handle);
}

module.exports = { parseGmailMessage, ingestPersona, ingestAll, startWorker };
```

- [ ] **Step 4: Run unit test**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: PASS.

- [ ] **Step 5: Wire endpoint + boot worker**

In server.js, inside the Competitor Intel section:

```javascript
app.post('/api/competitor-intel/ingest-now', async (req, res) => {
  try {
    const { ingestAll } = competitorIntel;
    res.json({ results: await ingestAll() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

At the bottom of server.js, near existing server.listen:

```javascript
if (process.env.COMPETITOR_INTEL_ENABLE_WORKER !== 'false') {
  competitorIntel.startWorker({ intervalMs: 5 * 60 * 1000 });
  console.log('[competitor-intel] Gmail ingestion worker started (5 min interval)');
}
```

- [ ] **Step 6: Update barrel**

```javascript
// packages/core/competitor-intel/index.js
module.exports = {
  ...require('./seed'),
  ...require('./recon'),
  ...require('./gmail-oauth'),
  ...require('./classifier'),
  ...require('./gmail-ingestion')
};
```

- [ ] **Step 7: Manual smoke test**

Restart server. After both personas connected (Task 2.2 step 7), trigger: `curl -X POST http://localhost:3002/api/competitor-intel/ingest-now`.
Then: `psql "$DATABASE_URL" -c "SELECT persona_id, COUNT(*) FROM competitor_emails GROUP BY persona_id;"`
Expected: emails starting to appear (at minimum Gmail's "Welcome to Gmail" system email).

- [ ] **Step 8: Commit**

```bash
git add packages/core/competitor-intel/gmail-ingestion.js packages/core/competitor-intel/index.js packages/core/competitor-intel/__tests__/gmail-ingestion.test.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): Gmail ingestion worker + phase-1 classification on insert"
```

---

### Task 2.5: Screen 1 — Overview

**Files:**
- Create: `apps/dashboard/src/pages/CompetitorIntel/Overview.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/BrandCard.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/competitor-intel.css`
- Modify: `apps/dashboard/src/pages/CompetitorIntel/index.jsx` (route to Overview)
- Modify: `apps/dashboard/server.js` (add stats endpoint)

- [ ] **Step 1: Stats endpoint**

Append to server.js:

```javascript
app.get('/api/competitor-intel/investigations/:id/overview', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const brands = await pool.query(`
      SELECT
        b.id, b.name, b.website, b.category, b.positioning, b.recon_notes,
        s.lifecycle_maturity, s.email_sophistication, s.journey_depth, s.personalisation, s.overall,
        (SELECT COUNT(*)::int FROM competitor_emails e WHERE e.brand_id = b.id) AS emails_count,
        (SELECT MAX(received_at)  FROM competitor_emails e WHERE e.brand_id = b.id) AS last_email_at,
        (SELECT COUNT(*)::int FROM competitor_playbook_steps s WHERE s.brand_id = b.id AND s.status = 'done') AS steps_done,
        (SELECT COUNT(*)::int FROM competitor_playbook_steps s WHERE s.brand_id = b.id) AS steps_total
      FROM competitor_brands b
      LEFT JOIN competitor_brand_scores s ON s.brand_id = b.id
      WHERE b.investigation_id = $1
      ORDER BY b.name
    `, [id]);
    const activity = await pool.query(`
      SELECT 'email' AS kind, e.id, e.subject AS title, e.received_at AS at, b.name AS brand_name, p.name AS persona_name
      FROM competitor_emails e
      LEFT JOIN competitor_brands b ON b.id = e.brand_id
      LEFT JOIN competitor_personas p ON p.id = e.persona_id
      WHERE p.investigation_id = $1
      ORDER BY e.received_at DESC NULLS LAST
      LIMIT 20
    `, [id]);
    res.json({ brands: brands.rows, activity: activity.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: BrandCard component**

Create `apps/dashboard/src/pages/CompetitorIntel/components/BrandCard.jsx`:

```jsx
export default function BrandCard({ brand }) {
  const overall = brand.overall != null ? Number(brand.overall).toFixed(1) : '—';
  const axes = [
    { key: 'lifecycle_maturity',   label: 'Lifecycle' },
    { key: 'email_sophistication', label: 'Email' },
    { key: 'journey_depth',        label: 'Journey' },
    { key: 'personalisation',      label: 'Personalisation' }
  ];
  const lastEmail = brand.last_email_at ? new Date(brand.last_email_at).toLocaleString() : '—';
  return (
    <a className="ci-brand-card" href={`/competitor-intel/${brand.investigation_id || ''}/brand/${brand.id}`}>
      <header>
        <h3>{brand.name}</h3>
        <span className="ci-score-big">{overall}</span>
      </header>
      <ul className="ci-subscores">
        {axes.map(a => (
          <li key={a.key}>
            <span>{a.label}</span>
            <div className="ci-bar"><div style={{ width: `${(brand[a.key] || 0) * 10}%` }}/></div>
            <strong>{brand[a.key] != null ? Number(brand[a.key]).toFixed(1) : '—'}</strong>
          </li>
        ))}
      </ul>
      <footer>
        <span>{brand.emails_count} emails</span>
        <span>{brand.steps_done}/{brand.steps_total} steps</span>
        <span>Last: {lastEmail}</span>
      </footer>
    </a>
  );
}
```

- [ ] **Step 3: Overview page**

Create `apps/dashboard/src/pages/CompetitorIntel/Overview.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BrandCard from './components/BrandCard';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Overview() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    const r = await fetch(`${API}/competitor-intel/investigations/${id}/overview`);
    setData(await r.json());
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [id]);

  if (!data) return <div className="ci-loading">Loading…</div>;

  return (
    <div className="ci-overview">
      <div className="ci-brand-grid">
        {data.brands.map(b => <BrandCard key={b.id} brand={{ ...b, investigation_id: id }} />)}
      </div>
      <aside className="ci-activity">
        <h4>Activity</h4>
        <ul>
          {data.activity.map(a => (
            <li key={a.kind + a.id}>
              <time>{new Date(a.at).toLocaleTimeString()}</time>
              <strong>{a.brand_name || 'Unclassified'}</strong>
              <span>→ {a.persona_name}</span>
              <p>{a.title}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: CSS**

Create `apps/dashboard/src/pages/CompetitorIntel/competitor-intel.css`:

```css
.ci-overview { display: grid; grid-template-columns: 1fr 320px; gap: var(--space-lg); padding: var(--space-lg); }
.ci-brand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-md); }
.ci-brand-card { display: block; padding: var(--space-md); border: 1px solid var(--border); border-radius: var(--radius-md); text-decoration: none; color: inherit; background: var(--surface); }
.ci-brand-card:hover { border-color: var(--accent); }
.ci-brand-card header { display: flex; justify-content: space-between; align-items: baseline; }
.ci-score-big { font-size: 2rem; font-weight: 700; }
.ci-subscores { list-style: none; padding: 0; margin: var(--space-sm) 0; }
.ci-subscores li { display: grid; grid-template-columns: 110px 1fr auto; align-items: center; gap: var(--space-sm); font-size: 0.85rem; }
.ci-bar { height: 6px; background: var(--surface-muted); border-radius: 3px; overflow: hidden; }
.ci-bar > div { height: 100%; background: var(--accent); }
.ci-brand-card footer { display: flex; gap: var(--space-sm); font-size: 0.75rem; color: var(--text-muted); }
.ci-activity { border-left: 1px solid var(--border); padding-left: var(--space-md); }
.ci-activity ul { list-style: none; padding: 0; margin: 0; }
.ci-activity li { padding: var(--space-sm) 0; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.ci-activity time { color: var(--text-muted); margin-right: var(--space-xs); }
```

Import the CSS once in `index.jsx`:

```jsx
import './competitor-intel.css';
```

- [ ] **Step 5: Route Overview under `/competitor-intel/:id`**

Update `apps/dashboard/src/pages/CompetitorIntel/index.jsx` to render Overview when `id` present:

```jsx
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import './competitor-intel.css';

export default function CompetitorIntelRouter() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path=":id" element={<Overview />} />
    </Routes>
  );
}
```

And in the main App routes, change to:

```jsx
<Route path="/competitor-intel/*" element={<CompetitorIntel />} />
```

- [ ] **Step 6: Smoke test**

Visit `http://localhost:4000/competitor-intel/1`. Expected: 5 brand cards, sub-scores empty (`—`) until Capa 3, activity feed populated if emails have arrived.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 1 Overview (brand cards + live activity)"
```

---

### Task 2.6: Screen 3 — Persona inbox (cross-brand timeline)

**Files:**
- Create: `apps/dashboard/src/pages/CompetitorIntel/Persona.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/InboxTable.jsx`
- Modify: server.js (endpoints)
- Modify: `apps/dashboard/src/pages/CompetitorIntel/index.jsx` (route)

- [ ] **Step 1: Endpoint — persona detail with emails**

Append to server.js:

```javascript
app.get('/api/competitor-intel/personas/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const persona = (await pool.query('SELECT * FROM competitor_personas WHERE id = $1', [id])).rows[0];
    if (!persona) return res.status(404).json({ error: 'not found' });
    const gmail = (await pool.query('SELECT email, last_sync_at FROM competitor_persona_gmail WHERE persona_id = $1', [id])).rows[0] || null;
    const emails = (await pool.query(`
      SELECT e.*, b.name AS brand_name
      FROM competitor_emails e
      LEFT JOIN competitor_brands b ON b.id = e.brand_id
      WHERE e.persona_id = $1
      ORDER BY e.received_at DESC NULLS LAST
      LIMIT 200
    `, [id])).rows;
    res.json({ persona, gmail, emails });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: InboxTable component**

Create `apps/dashboard/src/pages/CompetitorIntel/components/InboxTable.jsx`:

```jsx
import { useState } from 'react';

function typeChip(classification) {
  const t = classification?.type || 'unclassified';
  return <span className={`ci-chip ci-chip--${t}`}>{t}</span>;
}

export default function InboxTable({ emails, onSelect }) {
  const [filter, setFilter] = useState('');
  const filtered = emails.filter(e => !filter || (e.subject || '').toLowerCase().includes(filter.toLowerCase()) || (e.brand_name || '').toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="ci-inbox-table">
      <input placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} className="ci-filter" />
      <table>
        <thead><tr><th>Received</th><th>Brand</th><th>Subject</th><th>Type</th><th>From</th></tr></thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id} onClick={() => onSelect?.(e)} className="ci-row">
              <td>{e.received_at ? new Date(e.received_at).toLocaleString() : '—'}</td>
              <td>{e.brand_name || <em>unclassified</em>}</td>
              <td>{e.subject}</td>
              <td>{typeChip(e.classification)}</td>
              <td>{e.sender_email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Persona page with timeline**

Create `apps/dashboard/src/pages/CompetitorIntel/Persona.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import InboxTable from './components/InboxTable';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Persona() {
  const { personaId } = useParams();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    fetch(`${API}/competitor-intel/personas/${personaId}`).then(r => r.json()).then(setData);
  }, [personaId]);

  if (!data) return <div className="ci-loading">Loading…</div>;

  const connect = () => { window.location.href = `${API}/oauth/google/authorize?persona_id=${personaId}`; };

  return (
    <div className="ci-persona">
      <header>
        <h2>{data.persona.name}</h2>
        <p>{data.persona.profile?.segment} · {data.persona.location}</p>
        {data.gmail
          ? <small>Gmail: {data.gmail.email} · last sync {data.gmail.last_sync_at ? new Date(data.gmail.last_sync_at).toLocaleTimeString() : 'never'}</small>
          : <button onClick={connect}>Connect Gmail</button>}
      </header>
      <InboxTable emails={data.emails} onSelect={setSel} />
      {sel && (
        <div className="ci-email-modal" onClick={() => setSel(null)}>
          <div onClick={e => e.stopPropagation()}>
            <h3>{sel.subject}</h3>
            <small>{sel.sender_email} · {new Date(sel.received_at).toLocaleString()}</small>
            <pre>{JSON.stringify(sel.classification, null, 2)}</pre>
            <iframe title="email" srcDoc={sel.body_html || `<pre>${(sel.body_text || '').replace(/</g,'&lt;')}</pre>`} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Route**

Update `apps/dashboard/src/pages/CompetitorIntel/index.jsx`:

```jsx
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import Persona from './Persona';
import './competitor-intel.css';

export default function CompetitorIntelRouter() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path=":id" element={<Overview />} />
      <Route path=":id/persona/:personaId" element={<Persona />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Add CSS for persona/modal/chips**

Append to `competitor-intel.css`:

```css
.ci-persona { padding: var(--space-lg); }
.ci-chip { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; text-transform: uppercase; background: var(--surface-muted); }
.ci-chip--welcome          { background: #dcfce7; color: #166534; }
.ci-chip--double_opt_in    { background: #e0e7ff; color: #3730a3; }
.ci-chip--nurture          { background: #fef3c7; color: #92400e; }
.ci-chip--promo            { background: #fce7f3; color: #9d174d; }
.ci-chip--abandonment      { background: #fee2e2; color: #991b1b; }
.ci-chip--transactional    { background: #e5e7eb; color: #374151; }
.ci-chip--re_engagement    { background: #ede9fe; color: #5b21b6; }
.ci-chip--triggered_click_followup { background: #cffafe; color: #155e75; }
.ci-inbox-table .ci-row { cursor: pointer; }
.ci-inbox-table .ci-row:hover { background: var(--surface-muted); }
.ci-email-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.ci-email-modal > div { background: var(--surface); padding: var(--space-lg); max-width: 900px; width: 90%; max-height: 80vh; overflow: auto; border-radius: var(--radius-md); }
.ci-email-modal iframe { width: 100%; height: 400px; border: 1px solid var(--border); }
```

- [ ] **Step 6: Smoke test**

Visit `http://localhost:4000/competitor-intel/1/persona/1`. Expected: persona header, Gmail connected status, emails table with rows. Click a row → modal with HTML body.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 3 Persona inbox (table + HTML modal)"
```

---

### Capa 2 checkpoint

Stop. Verify: (a) both personas' Gmails connected; (b) at least one test email ingested and classified per persona; (c) Overview + Persona screens render with real data. User confirms before proceeding.

---

## Capa 3 — Brand Detail + Phase 2 LLM classifier + Engagement Simulator + Scoring (Wednesday, ~5h)

### Task 3.1: Phase 2 classifier (LLM)

**Files:**
- Create: `packages/core/competitor-intel/classifier-llm.js`
- Create: `packages/core/competitor-intel/__tests__/classifier-llm.test.js`
- Modify: `packages/core/competitor-intel/classifier.js` (re-export phase 2 runner)
- Modify: server.js (manual trigger endpoint + 15-min interval)

- [ ] **Step 1: Write failing test (prompt builder)**

Create `packages/core/competitor-intel/__tests__/classifier-llm.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { buildPrompt, parseResponse } = require('../classifier-llm');

describe('classifier-llm', () => {
  it('prompt includes subject, snippet, brand list', () => {
    const prompt = buildPrompt({
      email: { subject: 'Hello', body_text: 'Body text here.', sender_email: 'x@y.com' },
      brands: [{ id: 1, name: 'Kuoni' }, { id: 2, name: 'Carrier' }]
    });
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('Body text here.');
    expect(prompt).toContain('Kuoni');
    expect(prompt).toContain('Carrier');
    expect(prompt).toContain('"type"');
  });
  it('parses JSON response', () => {
    const r = parseResponse('{"brand_id":1,"type":"promo","confidence":0.82,"reasoning":"promo copy"}');
    expect(r.brand_id).toBe(1);
    expect(r.type).toBe('promo');
  });
  it('returns null on unparseable', () => {
    expect(parseResponse('garbage')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fails**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`

- [ ] **Step 3: Implement classifier-llm**

Create `packages/core/competitor-intel/classifier-llm.js`:

```javascript
const { pool } = require('../db');
const claudeProvider = require('../ai-providers/claude'); // assumes claude provider exists per AgentOS

const VALID_TYPES = ['welcome','double_opt_in','nurture','promo','abandonment','transactional','preference_update','re_engagement','triggered_click_followup','other'];

function buildPrompt({ email, brands }) {
  const brandLines = brands.map(b => `- id=${b.id} name="${b.name}"`).join('\n');
  const snippet = (email.body_text || '').slice(0, 500).replace(/\s+/g, ' ');
  return `You classify a marketing email.

BRANDS under investigation:
${brandLines}

EMAIL:
From: ${email.sender_email}
Subject: ${email.subject}
Body snippet: ${snippet}

Return STRICT JSON with:
{
  "brand_id": <int id from list or null>,
  "type": <one of ${VALID_TYPES.join(', ')}>,
  "confidence": <0..1>,
  "reasoning": <short string>
}
Only JSON, no prose.`;
}

function parseResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const j = JSON.parse(match[0]);
    if (!VALID_TYPES.includes(j.type)) return null;
    return j;
  } catch { return null; }
}

async function classifyEmailPhase2(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query('SELECT investigation_id FROM competitor_personas WHERE id = $1', [e.persona_id])).rows[0];
  const brands = (await pool.query('SELECT id, name FROM competitor_brands WHERE investigation_id = $1', [persona.investigation_id])).rows;
  const prompt = buildPrompt({ email: e, brands });
  const response = await claudeProvider.complete({ prompt, maxTokens: 300, model: 'claude-sonnet-4-6' });
  const parsed = parseResponse(response);
  if (!parsed) return { skipped: true };
  const classification = { ...e.classification, ...parsed, phase: 2 };
  await pool.query('UPDATE competitor_emails SET brand_id = COALESCE($1, brand_id), classification = $2 WHERE id = $3',
    [parsed.brand_id, classification, emailId]);
  return { classification };
}

async function runPhase2Batch({ limit = 25 } = {}) {
  const candidates = (await pool.query(`
    SELECT id FROM competitor_emails
    WHERE brand_id IS NULL OR (classification->>'phase')::int IS DISTINCT FROM 2
    ORDER BY received_at DESC NULLS LAST
    LIMIT $1
  `, [limit])).rows;
  const out = [];
  for (const c of candidates) {
    try { out.push({ emailId: c.id, ...(await classifyEmailPhase2(c.id)) }); }
    catch (e) { out.push({ emailId: c.id, error: e.message }); }
  }
  return out;
}

module.exports = { buildPrompt, parseResponse, classifyEmailPhase2, runPhase2Batch };
```

Note: if `packages/core/ai-providers/claude` exports a different API, adapt the call to its actual interface (check via `grep -n "module.exports" packages/core/ai-providers/claude.js`).

- [ ] **Step 4: Verify Claude provider interface**

Run: `grep -n "module.exports\|async function\|complete\|messages" packages/core/ai-providers/claude.js | head -20`
If the function is named differently (e.g. `createMessage`, `generate`), edit Step 3 to match.

- [ ] **Step 5: Run unit tests — green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`

- [ ] **Step 6: Wire endpoint + interval**

Append to server.js:

```javascript
app.post('/api/competitor-intel/classify-phase2', async (req, res) => {
  try { res.json({ results: await competitorIntel.runPhase2Batch({ limit: 50 }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
```

Near the existing worker startup:

```javascript
if (process.env.COMPETITOR_INTEL_ENABLE_WORKER !== 'false') {
  setInterval(() => { competitorIntel.runPhase2Batch({ limit: 25 }).catch(e => console.error('[ci phase2]', e.message)); }, 15 * 60 * 1000);
}
```

- [ ] **Step 7: Update barrel**

Add `...require('./classifier-llm')` to index.js.

- [ ] **Step 8: Commit**

```bash
git add packages/core/competitor-intel/classifier-llm.js packages/core/competitor-intel/__tests__/classifier-llm.test.js packages/core/competitor-intel/index.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): phase-2 LLM classifier with 15min batch"
```

---

### Task 3.2: Engagement simulator (hybrid C)

**Files:**
- Create: `packages/core/competitor-intel/engagement.js`
- Create: `packages/core/competitor-intel/__tests__/engagement.test.js`
- Modify: server.js (endpoint to trigger per email; optional scheduled auto-engage)

- [ ] **Step 1: Write failing tests**

Create `packages/core/competitor-intel/__tests__/engagement.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { shouldOpen, extractTrackingPixels, extractClickableLinks, pickClickableLinks } = require('../engagement');

const SARAH = { profile: { engagement_pattern: { base_open_rate: 0.8, click_keywords: ['maldives','seychelles'] } } };
const TOM = { profile: { engagement_pattern: { base_open_rate: 0.6, click_keywords: ['trek','adventure'] } } };

describe('engagement simulator', () => {
  it('always opens welcome/transactional', () => {
    expect(shouldOpen({ type: 'welcome' }, SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'transactional' }, SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'double_opt_in' }, SARAH, () => 0.99)).toBe(true);
    expect(shouldOpen({ type: 'preference_update' }, SARAH, () => 0.99)).toBe(true);
  });
  it('honors base open rate for nurture/promo', () => {
    expect(shouldOpen({ type: 'nurture' }, SARAH, () => 0.5)).toBe(true);  // 0.5 < 0.8
    expect(shouldOpen({ type: 'nurture' }, SARAH, () => 0.9)).toBe(false); // 0.9 > 0.8
    expect(shouldOpen({ type: 'promo'   }, TOM,   () => 0.5)).toBe(true);  // 0.5 < 0.6
    expect(shouldOpen({ type: 'promo'   }, TOM,   () => 0.7)).toBe(false); // 0.7 > 0.6
  });
  it('extracts pixels', () => {
    const html = '<img src="https://track.carrier.co.uk/o/1" width="1" height="1"><img src="https://cdn.carrier.co.uk/hero.jpg">';
    const pixels = extractTrackingPixels(html);
    expect(pixels).toContain('https://track.carrier.co.uk/o/1');
  });
  it('extracts clickable links', () => {
    const html = '<a href="https://kuoni.co.uk/maldives">Maldives</a><a href="https://kuoni.co.uk/alps">Alps</a>';
    const links = extractClickableLinks(html);
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('https://kuoni.co.uk/maldives');
  });
  it('picks links matching click_keywords (case-insensitive anchor text)', () => {
    const links = [
      { href: 'https://x/maldives', text: 'Discover Maldives' },
      { href: 'https://x/alps', text: 'Alpine escapes' }
    ];
    const chosen = pickClickableLinks(links, SARAH);
    expect(chosen.map(l => l.href)).toContain('https://x/maldives');
    expect(chosen.map(l => l.href)).not.toContain('https://x/alps');
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement engagement module**

Create `packages/core/competitor-intel/engagement.js`:

```javascript
const { pool } = require('../db');

const ALWAYS_OPEN = new Set(['welcome','double_opt_in','transactional','preference_update']);

function shouldOpen(classification, persona, rng = Math.random) {
  const type = classification?.type;
  if (ALWAYS_OPEN.has(type)) return true;
  const rate = persona?.profile?.engagement_pattern?.base_open_rate ?? 0.5;
  return rng() < rate;
}

function extractTrackingPixels(html = '') {
  const out = [];
  const re = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    if (/width=["']?1["']?/i.test(m[0]) || /height=["']?1["']?/i.test(m[0]) || /track|pixel|beacon|open\.aspx|\/o\//i.test(src)) out.push(src);
  }
  return out;
}

function extractClickableLinks(html = '') {
  const out = [];
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!/^https?:\/\//i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    out.push({ href, text });
  }
  return out;
}

function pickClickableLinks(links, persona, max = 2) {
  const kws = persona?.profile?.engagement_pattern?.click_keywords || [];
  if (!kws.length) return [];
  const matched = links.filter(l => {
    const hay = `${l.href} ${l.text}`.toLowerCase();
    return kws.some(k => hay.includes(k.toLowerCase()));
  });
  return matched.slice(0, max);
}

async function simulateEngagementForEmail(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query('SELECT * FROM competitor_personas WHERE id = $1', [e.persona_id])).rows[0];
  const events = [];

  if (!shouldOpen(e.classification, persona)) return { events };

  const pixels = extractTrackingPixels(e.body_html || '');
  for (const p of pixels) {
    try {
      await fetch(p, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Gmail-web)', Accept: 'image/*,*/*;q=0.8' } });
    } catch { /* ignore */ }
  }
  const openIns = await pool.query(
    `INSERT INTO competitor_email_engagement(email_id, event_type, simulated) VALUES ($1,'open',true) RETURNING id, occurred_at`,
    [emailId]
  );
  events.push({ type: 'open', ...openIns.rows[0] });

  const links = extractClickableLinks(e.body_html || '');
  const chosen = pickClickableLinks(links, persona);
  for (const l of chosen) {
    try { await fetch(l.href, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Gmail-web)' } }); }
    catch { /* ignore */ }
    const clickIns = await pool.query(
      `INSERT INTO competitor_email_engagement(email_id, event_type, link_url, simulated) VALUES ($1,'click',$2,true) RETURNING id, occurred_at`,
      [emailId, l.href]
    );
    events.push({ type: 'click', href: l.href, ...clickIns.rows[0] });
  }
  return { events };
}

async function autoEngageRecent({ sinceMinutes = 15 } = {}) {
  const candidates = (await pool.query(`
    SELECT e.id FROM competitor_emails e
    LEFT JOIN competitor_email_engagement g ON g.email_id = e.id
    WHERE e.received_at > NOW() - ($1 || ' minutes')::interval
      AND g.id IS NULL
  `, [sinceMinutes])).rows;
  const out = [];
  for (const c of candidates) {
    try { out.push({ emailId: c.id, ...(await simulateEngagementForEmail(c.id)) }); }
    catch (e) { out.push({ emailId: c.id, error: e.message }); }
  }
  return out;
}

module.exports = { shouldOpen, extractTrackingPixels, extractClickableLinks, pickClickableLinks, simulateEngagementForEmail, autoEngageRecent };
```

- [ ] **Step 4: Run tests — green**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel`
Expected: all 5 engagement + prior tests pass.

- [ ] **Step 5: Wire endpoint + scheduled auto-engage**

Append to server.js:

```javascript
app.post('/api/competitor-intel/emails/:id/engage', async (req, res) => {
  try { res.json(await competitorIntel.simulateEngagementForEmail(parseInt(req.params.id, 10))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
```

Near other intervals:

```javascript
if (process.env.COMPETITOR_INTEL_ENABLE_WORKER !== 'false') {
  setInterval(() => { competitorIntel.autoEngageRecent({ sinceMinutes: 30 }).catch(e => console.error('[ci engage]', e.message)); }, 10 * 60 * 1000);
}
```

- [ ] **Step 6: Update barrel**

Add `...require('./engagement')`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/competitor-intel/engagement.js packages/core/competitor-intel/__tests__/engagement.test.js packages/core/competitor-intel/index.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): engagement simulator (opens + keyword clicks, hybrid C)"
```

---

### Task 3.3: Scoring calculator

**Files:**
- Create: `packages/core/competitor-intel/scoring.js`
- Create: `packages/core/competitor-intel/__tests__/scoring.test.js`
- Modify: server.js (GET/PUT scoring endpoints)

- [ ] **Step 1: Write failing tests**

Create `packages/core/competitor-intel/__tests__/scoring.test.js`:

```javascript
const { describe, it, expect } = require('vitest');
const { autoAxisFromEmails, overallFromAxes } = require('../scoring');

describe('scoring', () => {
  it('computes overall as mean of 4 axes', () => {
    expect(overallFromAxes({ lifecycle_maturity: 5, email_sophistication: 7, journey_depth: 6, personalisation: 8 })).toBeCloseTo(6.5, 1);
  });
  it('auto lifecycle_maturity heuristic — more stage types = higher', () => {
    const low  = [{ classification: { type: 'promo' } }, { classification: { type: 'promo' } }];
    const high = [{ classification: { type: 'welcome' } }, { classification: { type: 'nurture' } }, { classification: { type: 'abandonment' } }, { classification: { type: 're_engagement' } }];
    expect(autoAxisFromEmails('lifecycle_maturity', low))
      .toBeLessThan(autoAxisFromEmails('lifecycle_maturity', high));
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement scoring**

Create `packages/core/competitor-intel/scoring.js`:

```javascript
const { pool } = require('../db');

function overallFromAxes(a) {
  const vals = [a.lifecycle_maturity, a.email_sophistication, a.journey_depth, a.personalisation].filter(v => v != null).map(Number);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function autoAxisFromEmails(axis, emails) {
  const types = new Set(emails.map(e => e.classification?.type).filter(Boolean));
  switch (axis) {
    case 'lifecycle_maturity': {
      const weights = { welcome: 2, double_opt_in: 1, nurture: 2, abandonment: 2, re_engagement: 2, triggered_click_followup: 1 };
      let score = 0;
      for (const t of types) score += weights[t] || 0;
      return Math.min(10, score);
    }
    case 'email_sophistication': {
      const personalised = emails.filter(e => /{{.*}}/.test(e.subject || '') || /hi [A-Z][a-z]+,/.test(e.body_text || '')).length;
      return Math.min(10, 2 + Math.log2(1 + personalised) * 3);
    }
    case 'journey_depth': {
      const typeCount = types.size;
      return Math.min(10, typeCount * 1.5);
    }
    case 'personalisation': {
      const hasSegmentCues = emails.some(e => /\bfor you\b|\bbased on\b|\bmatched to\b/i.test(e.subject || '') || /\byour (interests|preferences)\b/i.test(e.body_text || ''));
      return hasSegmentCues ? 6 : 3;
    }
    default: return null;
  }
}

async function computeBrandScores(brandId) {
  const emails = (await pool.query('SELECT subject, body_text, classification FROM competitor_emails WHERE brand_id = $1', [brandId])).rows;
  const axes = {
    lifecycle_maturity:   autoAxisFromEmails('lifecycle_maturity', emails),
    email_sophistication: autoAxisFromEmails('email_sophistication', emails),
    journey_depth:        autoAxisFromEmails('journey_depth', emails),
    personalisation:      autoAxisFromEmails('personalisation', emails)
  };
  const overall = overallFromAxes(axes);
  await pool.query(`
    INSERT INTO competitor_brand_scores(brand_id, lifecycle_maturity, email_sophistication, journey_depth, personalisation, overall, last_calculated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (brand_id) DO UPDATE SET
      lifecycle_maturity = EXCLUDED.lifecycle_maturity,
      email_sophistication = EXCLUDED.email_sophistication,
      journey_depth = EXCLUDED.journey_depth,
      personalisation = EXCLUDED.personalisation,
      overall = EXCLUDED.overall,
      last_calculated_at = NOW()
  `, [brandId, axes.lifecycle_maturity, axes.email_sophistication, axes.journey_depth, axes.personalisation, overall]);
  return { axes, overall };
}

async function setBrandScoreManual(brandId, payload) {
  const axes = {
    lifecycle_maturity: payload.lifecycle_maturity,
    email_sophistication: payload.email_sophistication,
    journey_depth: payload.journey_depth,
    personalisation: payload.personalisation
  };
  const overall = overallFromAxes(axes);
  await pool.query(`
    INSERT INTO competitor_brand_scores(brand_id, lifecycle_maturity, email_sophistication, journey_depth, personalisation, overall, manual_notes, last_calculated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (brand_id) DO UPDATE SET
      lifecycle_maturity = EXCLUDED.lifecycle_maturity,
      email_sophistication = EXCLUDED.email_sophistication,
      journey_depth = EXCLUDED.journey_depth,
      personalisation = EXCLUDED.personalisation,
      overall = EXCLUDED.overall,
      manual_notes = EXCLUDED.manual_notes,
      last_calculated_at = NOW()
  `, [brandId, axes.lifecycle_maturity, axes.email_sophistication, axes.journey_depth, axes.personalisation, overall, payload.manual_notes || null]);
  return { axes, overall };
}

module.exports = { overallFromAxes, autoAxisFromEmails, computeBrandScores, setBrandScoreManual };
```

- [ ] **Step 4: Run tests — green**

- [ ] **Step 5: Endpoints**

Append to server.js:

```javascript
app.post('/api/competitor-intel/brands/:id/score/auto', async (req, res) => {
  try { res.json(await competitorIntel.computeBrandScores(parseInt(req.params.id, 10))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/competitor-intel/brands/:id/score', async (req, res) => {
  try { res.json(await competitorIntel.setBrandScoreManual(parseInt(req.params.id, 10), req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 6: Update barrel + commit**

Add `...require('./scoring')`.

```bash
git add packages/core/competitor-intel/scoring.js packages/core/competitor-intel/__tests__/scoring.test.js packages/core/competitor-intel/index.js apps/dashboard/server.js
git commit -m "feat(competitor-intel): 4-axis scoring (auto heuristic + manual override)"
```

---

### Task 3.4: Screen 2 — Brand Detail with 3 tabs

**Files:**
- Create: `apps/dashboard/src/pages/CompetitorIntel/Brand.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/PlaybookTab.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/ScoringTab.jsx`
- Modify: server.js (brand detail endpoint + playbook update)
- Modify: `index.jsx` (route)

- [ ] **Step 1: Endpoints**

Append to server.js:

```javascript
app.get('/api/competitor-intel/brands/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const brand = (await pool.query('SELECT * FROM competitor_brands WHERE id = $1', [id])).rows[0];
    if (!brand) return res.status(404).json({ error: 'not found' });
    const scores = (await pool.query('SELECT * FROM competitor_brand_scores WHERE brand_id = $1', [id])).rows[0] || null;
    const steps = (await pool.query(`
      SELECT ps.*, p.name AS persona_name, p.profile AS persona_profile
      FROM competitor_playbook_steps ps
      JOIN competitor_personas p ON p.id = ps.persona_id
      WHERE ps.brand_id = $1
      ORDER BY p.name, ps.step_order
    `, [id])).rows;
    const emails = (await pool.query(`
      SELECT e.*, p.name AS persona_name FROM competitor_emails e
      JOIN competitor_personas p ON p.id = e.persona_id
      WHERE e.brand_id = $1 ORDER BY e.received_at DESC NULLS LAST
    `, [id])).rows;
    res.json({ brand, scores, steps, emails });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/competitor-intel/playbook-steps/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, notes } = req.body;
    const r = await pool.query(`
      UPDATE competitor_playbook_steps
      SET status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          executed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE executed_at END
      WHERE id = $3 RETURNING *
    `, [status, notes, id]);
    res.json({ step: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: PlaybookTab**

Create `apps/dashboard/src/pages/CompetitorIntel/components/PlaybookTab.jsx`:

```jsx
import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function PlaybookTab({ steps, onChange }) {
  const [note, setNote] = useState('');
  const personas = [...new Set(steps.map(s => s.persona_name))];

  async function updateStep(id, body) {
    await fetch(`${API}/competitor-intel/playbook-steps/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    onChange?.();
  }

  return (
    <div className="ci-playbook">
      {personas.map(p => (
        <section key={p}>
          <h4>{p}</h4>
          <ol>
            {steps.filter(s => s.persona_name === p).map(s => (
              <li key={s.id} data-status={s.status}>
                <header>
                  <strong>Step {s.step_order}</strong>
                  <span className={`ci-chip ci-chip--${s.status}`}>{s.status}</span>
                  {s.executed_at && <time>{new Date(s.executed_at).toLocaleString()}</time>}
                </header>
                <p>{s.action}</p>
                {s.expected_signal && <small>Expect: {s.expected_signal}</small>}
                {s.status !== 'done' && (
                  <div>
                    <textarea placeholder="Notes (optional)" value={note} onChange={e => setNote(e.target.value)} />
                    <button onClick={() => updateStep(s.id, { status: 'done', notes: note })}>Mark done</button>
                    <button onClick={() => updateStep(s.id, { status: 'skipped', notes: note })}>Skip</button>
                  </div>
                )}
                {s.notes && <aside>{s.notes}</aside>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: ScoringTab**

Create `apps/dashboard/src/pages/CompetitorIntel/components/ScoringTab.jsx`:

```jsx
import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';
const AXES = [
  { key: 'lifecycle_maturity',   label: 'Lifecycle maturity' },
  { key: 'email_sophistication', label: 'Email sophistication' },
  { key: 'journey_depth',        label: 'Journey depth' },
  { key: 'personalisation',      label: 'Personalisation' }
];

export default function ScoringTab({ brand, scores, onChange }) {
  const [form, setForm] = useState({
    lifecycle_maturity: scores?.lifecycle_maturity ?? 5,
    email_sophistication: scores?.email_sophistication ?? 5,
    journey_depth: scores?.journey_depth ?? 5,
    personalisation: scores?.personalisation ?? 5,
    manual_notes: scores?.manual_notes ?? ''
  });

  async function autoRun() {
    await fetch(`${API}/competitor-intel/brands/${brand.id}/score/auto`, { method: 'POST' });
    onChange?.();
  }
  async function save() {
    await fetch(`${API}/competitor-intel/brands/${brand.id}/score`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    onChange?.();
  }

  return (
    <div className="ci-scoring">
      <button onClick={autoRun}>Auto-score from emails</button>
      {AXES.map(a => (
        <label key={a.key}>
          <span>{a.label}: <strong>{form[a.key]}</strong>/10</span>
          <input type="range" min="0" max="10" step="0.5" value={form[a.key]}
            onChange={e => setForm(f => ({ ...f, [a.key]: parseFloat(e.target.value) }))} />
        </label>
      ))}
      <textarea placeholder="Manual notes / justification"
        value={form.manual_notes} onChange={e => setForm(f => ({ ...f, manual_notes: e.target.value }))} />
      <button onClick={save}>Save scoring</button>
    </div>
  );
}
```

- [ ] **Step 4: Brand page**

Create `apps/dashboard/src/pages/CompetitorIntel/Brand.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import InboxTable from './components/InboxTable';
import PlaybookTab from './components/PlaybookTab';
import ScoringTab from './components/ScoringTab';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Brand() {
  const { brandId } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('playbook');
  const [sel, setSel] = useState(null);

  async function load() {
    const r = await fetch(`${API}/competitor-intel/brands/${brandId}`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, [brandId]);

  if (!data?.brand) return <div className="ci-loading">Loading…</div>;

  return (
    <div className="ci-brand-page">
      <header>
        <h2>{data.brand.name}</h2>
        <p>{data.brand.positioning}</p>
      </header>
      <nav className="ci-tabs">
        {['playbook','inbox','scoring'].map(t => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'playbook' && <PlaybookTab steps={data.steps} onChange={load} />}
      {tab === 'inbox' && <InboxTable emails={data.emails} onSelect={setSel} />}
      {tab === 'scoring' && <ScoringTab brand={data.brand} scores={data.scores} onChange={load} />}
      {sel && (
        <div className="ci-email-modal" onClick={() => setSel(null)}>
          <div onClick={e => e.stopPropagation()}>
            <h3>{sel.subject}</h3>
            <small>{sel.sender_email} · {new Date(sel.received_at).toLocaleString()}</small>
            <pre>{JSON.stringify(sel.classification, null, 2)}</pre>
            <iframe title="email" srcDoc={sel.body_html || `<pre>${(sel.body_text || '').replace(/</g,'&lt;')}</pre>`} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Route**

Update `index.jsx`:

```jsx
import Brand from './Brand';
// inside Routes:
<Route path=":id/brand/:brandId" element={<Brand />} />
```

- [ ] **Step 6: CSS appends**

Append to `competitor-intel.css`:

```css
.ci-brand-page { padding: var(--space-lg); }
.ci-tabs { display: flex; gap: var(--space-sm); margin: var(--space-md) 0; }
.ci-tabs button { padding: var(--space-sm) var(--space-md); border: 1px solid var(--border); background: var(--surface); cursor: pointer; border-radius: var(--radius-sm); }
.ci-tabs button[aria-pressed="true"] { background: var(--accent); color: white; border-color: var(--accent); }
.ci-playbook section { margin-bottom: var(--space-lg); }
.ci-playbook ol { list-style: none; padding: 0; }
.ci-playbook li { padding: var(--space-md); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: var(--space-sm); }
.ci-playbook li[data-status="done"] { background: #ecfdf5; border-color: #86efac; }
.ci-playbook li[data-status="skipped"] { opacity: 0.5; }
.ci-scoring { display: grid; gap: var(--space-md); max-width: 500px; }
.ci-scoring label { display: grid; gap: var(--space-xs); }
.ci-scoring input[type="range"] { width: 100%; }
.ci-chip--pending { background: #fef3c7; color: #92400e; }
.ci-chip--ready { background: #dbeafe; color: #1e40af; }
.ci-chip--done { background: #dcfce7; color: #166534; }
.ci-chip--skipped { background: #e5e7eb; color: #6b7280; }
```

- [ ] **Step 7: Smoke test**

Visit `http://localhost:4000/competitor-intel/1/brand/1`. Expected: header, 3 tabs working. Mark a step done, switch tab, come back — state persisted.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 2 Brand detail (playbook/inbox/scoring tabs)"
```

---

### Capa 3 checkpoint

Verify: playbook steps marked done persist; scoring sliders save; phase-2 classifier running in background; engagement auto-runs after new emails. User confirms before Capa 4.

---

## Capa 4 — Comparative + Insights + Export + Emirates gap (Thursday AM, ~4h)

### Task 4.1: Screen 4 — Comparative view (the demo)

**Files:**
- Create: `apps/dashboard/src/pages/CompetitorIntel/Comparative.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/TimeToFirstTouch.jsx`
- Create: `apps/dashboard/src/pages/CompetitorIntel/components/LifecycleHeatmap.jsx`
- Modify: server.js (comparative endpoint)
- Modify: `index.jsx` (route)

- [ ] **Step 1: Endpoint**

Append to server.js:

```javascript
app.get('/api/competitor-intel/investigations/:id/comparative', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ttft = await pool.query(`
      WITH sub_times AS (
        SELECT ps.brand_id, ps.persona_id, ps.executed_at
        FROM competitor_playbook_steps ps
        WHERE ps.step_order = 2 AND ps.status = 'done'
      ),
      first_useful AS (
        SELECT e.brand_id, e.persona_id, MIN(e.received_at) AS first_at
        FROM competitor_emails e
        WHERE e.classification->>'type' NOT IN ('double_opt_in','transactional')
        GROUP BY e.brand_id, e.persona_id
      )
      SELECT b.id AS brand_id, b.name AS brand_name,
             EXTRACT(EPOCH FROM (fu.first_at - st.executed_at)) AS seconds_to_first
      FROM competitor_brands b
      LEFT JOIN sub_times st ON st.brand_id = b.id
      LEFT JOIN first_useful fu ON fu.brand_id = b.id AND fu.persona_id = st.persona_id
      WHERE b.investigation_id = $1
      ORDER BY b.name
    `, [id]);

    const stages = ['welcome','nurture','triggered_click_followup','re_engagement','abandonment','transactional'];
    const heat = await pool.query(`
      SELECT b.id AS brand_id, b.name AS brand_name, classification->>'type' AS type, COUNT(*)::int AS c
      FROM competitor_brands b
      LEFT JOIN competitor_emails e ON e.brand_id = b.id
      WHERE b.investigation_id = $1
      GROUP BY b.id, b.name, classification->>'type'
      ORDER BY b.name
    `, [id]);

    res.json({ ttft: ttft.rows, heatmap: heat.rows, stages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: TimeToFirstTouch component**

Create `apps/dashboard/src/pages/CompetitorIntel/components/TimeToFirstTouch.jsx`:

```jsx
function fmt(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec/60)}min`;
  if (sec < 86400) return `${(sec/3600).toFixed(1)}h`;
  return `${(sec/86400).toFixed(1)}d`;
}
function bucket(sec) {
  if (sec == null) return 'none';
  if (sec < 300) return 'excellent';    // <5min
  if (sec < 3600) return 'good';        // <1h
  if (sec < 86400) return 'ok';         // <1d
  return 'bad';
}
export default function TimeToFirstTouch({ rows }) {
  return (
    <div className="ci-ttft">
      <h3>Time to first useful email</h3>
      <div className="ci-ttft-grid">
        {rows.map(r => (
          <div key={r.brand_id} data-bucket={bucket(r.seconds_to_first)}>
            <strong>{r.brand_name}</strong>
            <span className="ci-big">{fmt(r.seconds_to_first)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: LifecycleHeatmap component**

Create `apps/dashboard/src/pages/CompetitorIntel/components/LifecycleHeatmap.jsx`:

```jsx
export default function LifecycleHeatmap({ rows, stages }) {
  const brands = [...new Map(rows.map(r => [r.brand_id, r.brand_name])).entries()];
  const get = (brandId, stage) => rows.find(r => r.brand_id === brandId && r.type === stage)?.c ?? 0;
  function cls(c) { return c === 0 ? 'empty' : c < 2 ? 'low' : c < 5 ? 'mid' : 'high'; }
  return (
    <div className="ci-heatmap">
      <h3>Lifecycle depth</h3>
      <table>
        <thead>
          <tr><th></th>{stages.map(s => <th key={s}>{s}</th>)}</tr>
        </thead>
        <tbody>
          {brands.map(([id, name]) => (
            <tr key={id}>
              <th>{name}</th>
              {stages.map(s => {
                const c = get(id, s);
                return <td key={s} data-cls={cls(c)}>{c || ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Comparative page + route**

Create `Comparative.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TimeToFirstTouch from './components/TimeToFirstTouch';
import LifecycleHeatmap from './components/LifecycleHeatmap';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Comparative() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => {
    fetch(`${API}/competitor-intel/investigations/${id}/comparative`).then(r => r.json()).then(setD);
  }, [id]);
  if (!d) return <div className="ci-loading">Loading…</div>;
  return (
    <div className="ci-comparative">
      <TimeToFirstTouch rows={d.ttft} />
      <LifecycleHeatmap rows={d.heatmap} stages={d.stages} />
    </div>
  );
}
```

Add route in `index.jsx`: `<Route path=":id/comparative" element={<Comparative />} />`.

- [ ] **Step 5: CSS**

Append:

```css
.ci-comparative { padding: var(--space-lg); display: grid; gap: var(--space-xl); }
.ci-ttft-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-md); }
.ci-ttft-grid > div { padding: var(--space-md); border-radius: var(--radius-md); text-align: center; background: var(--surface); border: 1px solid var(--border); }
.ci-ttft-grid > div[data-bucket="excellent"] { background: #dcfce7; border-color: #22c55e; }
.ci-ttft-grid > div[data-bucket="good"]      { background: #d1fae5; border-color: #34d399; }
.ci-ttft-grid > div[data-bucket="ok"]        { background: #fef3c7; border-color: #f59e0b; }
.ci-ttft-grid > div[data-bucket="bad"]       { background: #fee2e2; border-color: #ef4444; }
.ci-ttft-grid > div[data-bucket="none"]      { background: #111827; color: white; border-color: #000; }
.ci-big { display: block; font-size: 2.5rem; font-weight: 700; }
.ci-heatmap table { border-collapse: collapse; width: 100%; }
.ci-heatmap th, .ci-heatmap td { border: 1px solid var(--border); padding: var(--space-sm); text-align: center; }
.ci-heatmap td[data-cls="empty"] { background: #111827; color: #fff; }
.ci-heatmap td[data-cls="low"]   { background: #fee2e2; }
.ci-heatmap td[data-cls="mid"]   { background: #fef3c7; }
.ci-heatmap td[data-cls="high"]  { background: #dcfce7; }
```

- [ ] **Step 6: Smoke test**

Visit `/competitor-intel/1/comparative`. Expected: 5-brand grid + heatmap. Colors reflect data (empty if no emails yet).

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 4 Comparative view (time-to-first-touch + heatmap)"
```

---

### Task 4.2: Screen 5 — Insights + .docx export

**Files:**
- Create: `packages/core/competitor-intel/docx-exporter.py`
- Create: `packages/core/competitor-intel/docx-export.js` (Node wrapper)
- Create: `apps/dashboard/src/pages/CompetitorIntel/Insights.jsx`
- Modify: server.js (insights CRUD + export endpoint)

- [ ] **Step 1: Python docx exporter**

Create `packages/core/competitor-intel/docx-exporter.py`:

```python
#!/usr/bin/env python3
"""Generates Analysis 5 .docx from JSON payload piped via stdin.

Payload shape:
{
  "investigation": { "name": str },
  "brands": [ { "name": str, "positioning": str, "scores": {...}, "insights": [ { "title": str, "body": str } ] } ],
  "comparative": { "ttft": [...], "heatmap_summary": str }
}

Outputs .docx bytes on stdout.
"""
import sys, json
from docx import Document
from docx.shared import Pt

def main():
    data = json.loads(sys.stdin.read())
    doc = Document()

    doc.add_heading(f"Analysis 5 — {data['investigation']['name']}", level=0)
    doc.add_heading("Lifecycle, Email & Customer Journey Assessment", level=1)
    doc.add_paragraph(
        "This analysis extends Analyses 1–4 with first-hand lifecycle evidence — real subscriptions, "
        "real inboxes, real engagement across 2 synthetic personas."
    )

    doc.add_heading("Executive Summary", level=1)
    avg = sum((b["scores"].get("overall") or 0) for b in data["brands"]) / max(1, len(data["brands"]))
    doc.add_paragraph(f"Portfolio lifecycle average: {avg:.1f}/10 across {len(data['brands'])} brands.")

    for b in data["brands"]:
        doc.add_heading(b["name"], level=1)
        if b.get("positioning"):
            doc.add_paragraph(b["positioning"]).italic = True
        s = b.get("scores") or {}
        doc.add_paragraph(
            f"Lifecycle maturity: {s.get('lifecycle_maturity','—')}/10 · "
            f"Email sophistication: {s.get('email_sophistication','—')}/10 · "
            f"Journey depth: {s.get('journey_depth','—')}/10 · "
            f"Personalisation: {s.get('personalisation','—')}/10 · "
            f"Overall: {s.get('overall','—')}/10"
        )
        for ins in (b.get("insights") or []):
            doc.add_heading(ins["title"], level=2)
            doc.add_paragraph(ins.get("body") or "")

    doc.add_heading("Comparative", level=1)
    t = doc.add_table(rows=1, cols=2)
    t.rows[0].cells[0].text = "Brand"
    t.rows[0].cells[1].text = "Time to first useful email"
    for r in data.get("comparative", {}).get("ttft", []):
        row = t.add_row().cells
        row[0].text = r["brand_name"]
        sec = r.get("seconds_to_first")
        row[1].text = "—" if sec is None else (f"{sec/60:.0f} min" if sec < 3600 else f"{sec/3600:.1f} h")

    doc.add_heading("Quick-wins vs Emirates Holidays", level=1)
    doc.add_paragraph(data.get("comparative", {}).get("heatmap_summary", ""))

    doc.save(sys.stdout.buffer)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Node wrapper**

Create `packages/core/competitor-intel/docx-export.js`:

```javascript
const { spawn } = require('child_process');
const path = require('path');
const { pool } = require('../db');

async function buildPayload(investigationId) {
  const inv = (await pool.query('SELECT * FROM competitor_investigations WHERE id = $1', [investigationId])).rows[0];
  const brands = (await pool.query(`
    SELECT b.id, b.name, b.positioning, s.*
    FROM competitor_brands b LEFT JOIN competitor_brand_scores s ON s.brand_id = b.id
    WHERE b.investigation_id = $1 ORDER BY b.name
  `, [investigationId])).rows;

  for (const b of brands) {
    b.scores = {
      lifecycle_maturity: b.lifecycle_maturity,
      email_sophistication: b.email_sophistication,
      journey_depth: b.journey_depth,
      personalisation: b.personalisation,
      overall: b.overall
    };
    b.insights = (await pool.query('SELECT title, body FROM competitor_insights WHERE brand_id = $1 ORDER BY created_at', [b.id])).rows;
  }

  const ttft = (await pool.query(`
    WITH sub_times AS (
      SELECT ps.brand_id, ps.persona_id, ps.executed_at
      FROM competitor_playbook_steps ps
      WHERE ps.step_order = 2 AND ps.status = 'done'
    ),
    first_useful AS (
      SELECT e.brand_id, e.persona_id, MIN(e.received_at) AS first_at
      FROM competitor_emails e
      WHERE e.classification->>'type' NOT IN ('double_opt_in','transactional')
      GROUP BY e.brand_id, e.persona_id
    )
    SELECT b.name AS brand_name,
           EXTRACT(EPOCH FROM (fu.first_at - st.executed_at)) AS seconds_to_first
    FROM competitor_brands b
    LEFT JOIN sub_times st ON st.brand_id = b.id
    LEFT JOIN first_useful fu ON fu.brand_id = b.id AND fu.persona_id = st.persona_id
    WHERE b.investigation_id = $1 ORDER BY b.name
  `, [investigationId])).rows;

  return {
    investigation: { name: inv.name },
    brands,
    comparative: { ttft, heatmap_summary: '' }
  };
}

function exportDocx(investigationId) {
  return new Promise(async (resolve, reject) => {
    try {
      const payload = await buildPayload(investigationId);
      const py = spawn('python', [path.join(__dirname, 'docx-exporter.py')], { stdio: ['pipe','pipe','pipe'] });
      const chunks = [];
      py.stdout.on('data', c => chunks.push(c));
      let err = '';
      py.stderr.on('data', c => err += c.toString());
      py.on('close', code => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err || `python exit ${code}`)));
      py.stdin.end(JSON.stringify(payload));
    } catch (e) { reject(e); }
  });
}

module.exports = { exportDocx, buildPayload };
```

- [ ] **Step 3: Verify python-docx available**

Run: `python -c "import docx; print('ok')"`
Expected: `ok`. If fails: `pip install python-docx`.

- [ ] **Step 4: Endpoints**

Append to server.js:

```javascript
app.get('/api/competitor-intel/investigations/:id/insights', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(`
      SELECT i.*, b.name AS brand_name FROM competitor_insights i
      LEFT JOIN competitor_brands b ON b.id = i.brand_id
      WHERE (b.investigation_id = $1 OR i.brand_id IS NULL) ORDER BY i.created_at DESC
    `, [id]);
    res.json({ insights: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/competitor-intel/insights', async (req, res) => {
  try {
    const { brand_id, category, severity, title, body, evidence_email_ids } = req.body;
    const r = await pool.query(`
      INSERT INTO competitor_insights(brand_id, category, severity, title, body, evidence_email_ids)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [brand_id || null, category, severity, title, body, evidence_email_ids || []]);
    res.json({ insight: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/competitor-intel/investigations/:id/export.docx', async (req, res) => {
  try {
    const buf = await competitorIntel.exportDocx(parseInt(req.params.id, 10));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Analysis_5_DERTOUR_Lifecycle.docx"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 5: Insights page**

Create `apps/dashboard/src/pages/CompetitorIntel/Insights.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Insights() {
  const { id } = useParams();
  const [insights, setInsights] = useState([]);
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ brand_id: '', title: '', body: '', category: 'lifecycle', severity: 'medium' });

  async function load() {
    const [a, b] = await Promise.all([
      fetch(`${API}/competitor-intel/investigations/${id}/insights`).then(r => r.json()),
      fetch(`${API}/competitor-intel/investigations/${id}`).then(r => r.json())
    ]);
    setInsights(a.insights || []);
    setBrands(b.brands || []);
  }
  useEffect(() => { load(); }, [id]);

  async function save() {
    await fetch(`${API}/competitor-intel/insights`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, brand_id: form.brand_id ? parseInt(form.brand_id, 10) : null })
    });
    setForm({ brand_id: '', title: '', body: '', category: 'lifecycle', severity: 'medium' });
    load();
  }

  return (
    <div className="ci-insights">
      <section className="ci-insights-form">
        <h3>New insight</h3>
        <select value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}>
          <option value="">— Cross-brand —</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <textarea placeholder="Body" rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        <button onClick={save}>Save insight</button>
      </section>
      <section>
        <h3>Insights</h3>
        <ul className="ci-insights-list">
          {insights.map(i => (
            <li key={i.id}>
              <header>
                <strong>{i.title}</strong>
                <small>{i.brand_name || 'Cross-brand'}</small>
              </header>
              <p>{i.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <a className="ci-export-btn" href={`${API}/competitor-intel/investigations/${id}/export.docx`}>
          Export Analysis 5 (.docx)
        </a>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Route + CSS + barrel**

Route: `<Route path=":id/insights" element={<Insights />} />`

CSS:

```css
.ci-insights { padding: var(--space-lg); display: grid; gap: var(--space-lg); }
.ci-insights-form { display: grid; gap: var(--space-sm); max-width: 600px; }
.ci-insights-list { list-style: none; padding: 0; }
.ci-insights-list li { padding: var(--space-md); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: var(--space-sm); }
.ci-export-btn { display: inline-block; padding: var(--space-md) var(--space-lg); background: var(--accent); color: white; border-radius: var(--radius-sm); text-decoration: none; }
```

Barrel: add `...require('./docx-export')`.

- [ ] **Step 7: Smoke test**

Visit `/competitor-intel/1/insights`. Create insight. Click Export. A `.docx` should download. Open in Word, verify structure.

- [ ] **Step 8: Commit**

```bash
git add packages/core/competitor-intel/docx-exporter.py packages/core/competitor-intel/docx-export.js packages/core/competitor-intel/index.js apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 5 Insights + .docx Analysis 5 exporter"
```

---

### Task 4.3: Screen 6 — Emirates Holidays gap (Analysis 4 ingest)

**Files:**
- Create: `packages/core/competitor-intel/analysis4-ingest.py` (parses existing Analysis 4 .docx into scores)
- Create: `packages/core/competitor-intel/analysis4-ingest.js` (Node wrapper, persists reference scores)
- Create: `apps/dashboard/src/pages/CompetitorIntel/EmiratesGap.jsx`
- Modify: server.js (gap endpoint + ingest endpoint)

- [ ] **Step 1: Add reference_scores table via migration**

Create `packages/core/db/migrations/2026-04-20-competitor-intel-reference-scores.sql`:

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS competitor_reference_scores (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  source_label TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  lifecycle_maturity NUMERIC(3,1),
  email_sophistication NUMERIC(3,1),
  journey_depth NUMERIC(3,1),
  personalisation NUMERIC(3,1),
  overall NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(investigation_id, source_label, brand_name)
);
COMMIT;
```

Apply: `psql "$DATABASE_URL" -f packages/core/db/migrations/2026-04-20-competitor-intel-reference-scores.sql` and append to schema.sql.

- [ ] **Step 2: Python parser**

Create `packages/core/competitor-intel/analysis4-ingest.py`:

```python
#!/usr/bin/env python3
"""Reads Analysis 4 .docx from argv[1], extracts brand-level scores as JSON on stdout.

Robust to slight format variation: looks for patterns like "Overall: 7.2/10".
"""
import sys, json, re
from docx import Document

SCORE_RE = re.compile(r"Overall[^\d]*(\d+\.?\d*)\s*/\s*10", re.I)

def parse(path):
    doc = Document(path)
    results = []
    current_brand = None
    text_buffer = []
    for para in doc.paragraphs:
        txt = para.text.strip()
        if not txt: continue
        if para.style.name.startswith("Heading"):
            if current_brand:
                joined = "\n".join(text_buffer)
                m = SCORE_RE.search(joined)
                if m:
                    results.append({ "brand_name": current_brand, "overall": float(m.group(1)) })
            current_brand = txt
            text_buffer = []
        else:
            text_buffer.append(txt)
    if current_brand:
        joined = "\n".join(text_buffer)
        m = SCORE_RE.search(joined)
        if m: results.append({ "brand_name": current_brand, "overall": float(m.group(1)) })
    print(json.dumps(results))

if __name__ == "__main__":
    parse(sys.argv[1])
```

- [ ] **Step 3: Node wrapper**

Create `packages/core/competitor-intel/analysis4-ingest.js`:

```javascript
const { spawnSync } = require('child_process');
const path = require('path');
const { pool } = require('../db');

function parseDocx(docxPath) {
  const r = spawnSync('python', [path.join(__dirname, 'analysis4-ingest.py'), docxPath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'python failed');
  return JSON.parse(r.stdout);
}

async function ingestAnalysis4({ investigationId, docxPath }) {
  const rows = parseDocx(docxPath);
  for (const r of rows) {
    await pool.query(`
      INSERT INTO competitor_reference_scores(investigation_id, source_label, brand_name, overall)
      VALUES ($1, 'Analysis 4', $2, $3)
      ON CONFLICT (investigation_id, source_label, brand_name) DO UPDATE SET overall = EXCLUDED.overall
    `, [investigationId, r.brand_name, r.overall]);
  }
  return rows;
}

module.exports = { ingestAnalysis4, parseDocx };
```

- [ ] **Step 4: Endpoints**

```javascript
app.post('/api/competitor-intel/investigations/:id/ingest-analysis4', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const docxPath = req.body?.path || path.join(process.cwd(), '..', '..', 'DERTOUR', 'Analysis 4 - Emirates_Holidays_vs_DERTOUR_Portfolio_DX_Comparison.docx');
    const rows = await competitorIntel.ingestAnalysis4({ investigationId: id, docxPath });
    res.json({ ingested: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/competitor-intel/investigations/:id/gap', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lived = await pool.query(`
      SELECT b.name AS brand_name, s.overall AS lived_overall
      FROM competitor_brands b LEFT JOIN competitor_brand_scores s ON s.brand_id = b.id
      WHERE b.investigation_id = $1 ORDER BY b.name
    `, [id]);
    const reference = await pool.query(`
      SELECT brand_name, overall FROM competitor_reference_scores WHERE investigation_id = $1
    `, [id]);
    const emiratesHolidays = reference.rows.find(r => /emirates/i.test(r.brand_name));
    res.json({ lived: lived.rows, reference: reference.rows, emirates_holidays: emiratesHolidays });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 5: EmiratesGap page + route**

Create `EmiratesGap.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

export default function EmiratesGap() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    const r = await fetch(`${API}/competitor-intel/investigations/${id}/gap`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, [id]);

  async function ingest() {
    await fetch(`${API}/competitor-intel/investigations/${id}/ingest-analysis4`, { method: 'POST' });
    load();
  }

  if (!data) return <div className="ci-loading">Loading…</div>;
  const eh = data.emirates_holidays?.overall ?? null;

  return (
    <div className="ci-gap">
      <header>
        <h2>Emirates Holidays Gap</h2>
        <button onClick={ingest}>Re-ingest Analysis 4</button>
      </header>
      <p>Emirates Holidays reference overall: <strong>{eh ?? '—'}/10</strong></p>
      <table>
        <thead><tr><th>Brand</th><th>Lived overall</th><th>vs Emirates Holidays</th></tr></thead>
        <tbody>
          {data.lived.map(r => {
            const diff = r.lived_overall != null && eh != null ? (Number(r.lived_overall) - Number(eh)).toFixed(1) : '—';
            return (
              <tr key={r.brand_name}>
                <td>{r.brand_name}</td>
                <td>{r.lived_overall != null ? Number(r.lived_overall).toFixed(1) : '—'}</td>
                <td data-sign={diff === '—' ? '' : diff >= 0 ? 'pos' : 'neg'}>{diff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

Route: `<Route path=":id/gap" element={<EmiratesGap />} />`.

CSS:

```css
.ci-gap { padding: var(--space-lg); }
.ci-gap td[data-sign="pos"] { color: #166534; font-weight: 600; }
.ci-gap td[data-sign="neg"] { color: #991b1b; font-weight: 600; }
```

Barrel: `...require('./analysis4-ingest')`.

- [ ] **Step 6: Ingest + smoke test**

Trigger ingest via UI button. Verify `competitor_reference_scores` populated. Visit `/competitor-intel/1/gap` — table renders.

- [ ] **Step 7: Commit**

```bash
git add packages/core/db/migrations/2026-04-20-competitor-intel-reference-scores.sql packages/core/db/schema.sql packages/core/competitor-intel/analysis4-ingest.py packages/core/competitor-intel/analysis4-ingest.js packages/core/competitor-intel/index.js apps/dashboard/src/pages/CompetitorIntel apps/dashboard/server.js
git commit -m "feat(competitor-intel): Screen 6 Emirates Holidays gap + Analysis 4 .docx ingest"
```

---

### Capa 4 checkpoint

Verify: Comparative view, Insights + Export, Emirates Gap all load with real data. Full user rehearsal of demo flow: Overview → Brand detail (Kuoni) → inbox → Comparative → Insights → Export. Stop and confirm before Capa 5.

---

## Capa 5 — Polish, navigation glue, rehearsal fixes (Thursday PM, ~2h)

### Task 5.1: Top-level navigation + breadcrumb

**Files:**
- Modify: `apps/dashboard/src/pages/CompetitorIntel/index.jsx`
- Modify: `apps/dashboard/src/components/Layout.jsx` (add sidebar entry)

- [ ] **Step 1: Add nav entry**

In Layout.jsx find the sidebar nav list and add:

```jsx
<NavLink to="/competitor-intel">Competitor Intel</NavLink>
```

- [ ] **Step 2: Breadcrumb on each screen**

At top of Overview / Brand / Persona / Comparative / Insights / EmiratesGap, add a header showing investigation name + current screen name. Extract to a small `Breadcrumb` component:

Create `apps/dashboard/src/pages/CompetitorIntel/components/Breadcrumb.jsx`:

```jsx
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
const API = import.meta.env.VITE_API_URL || '/api';

export default function Breadcrumb({ current }) {
  const { id } = useParams();
  const [name, setName] = useState('');
  useEffect(() => {
    if (!id) return;
    fetch(`${API}/competitor-intel/investigations/${id}`).then(r => r.json()).then(d => setName(d.investigation?.name || ''));
  }, [id]);
  return (
    <nav className="ci-breadcrumb">
      <Link to="/competitor-intel">Competitor Intel</Link>
      {id && <> / <Link to={`/competitor-intel/${id}`}>{name}</Link></>}
      {current && <> / <span>{current}</span></>}
    </nav>
  );
}
```

Import and render at top of each screen.

- [ ] **Step 3: Tabs on investigation root**

Inside Overview, render links: Overview (current) · Comparative · Insights · Gap.

- [ ] **Step 4: CSS**

```css
.ci-breadcrumb { padding: var(--space-sm) var(--space-lg); border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.ci-breadcrumb a { color: var(--text-muted); text-decoration: none; }
.ci-breadcrumb a:hover { color: var(--accent); }
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorIntel apps/dashboard/src/components/Layout.jsx
git commit -m "feat(competitor-intel): navigation glue (sidebar entry + breadcrumb)"
```

---

### Task 5.2: i18n EN strings for all UI

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Identify hardcoded strings**

Run: `grep -n "'[A-Z][a-z]" apps/dashboard/src/pages/CompetitorIntel --include="*.jsx" -r | head -30`

- [ ] **Step 2: Move each to `t('ci.<key>')`**

Demo is EN-only, but rule #3 requires both. Add at minimum these keys (ES + EN):

```javascript
'ci.title': 'Competitor Intel',
'ci.loading': 'Loading...',
'ci.overview': 'Overview',
'ci.comparative': 'Comparative',
'ci.insights': 'Insights',
'ci.gap': 'Emirates gap',
'ci.playbook': 'Playbook',
'ci.inbox': 'Inbox',
'ci.scoring': 'Scoring',
'ci.export_docx': 'Export Analysis 5 (.docx)',
'ci.connect_gmail': 'Connect Gmail',
'ci.mark_done': 'Mark done',
'ci.skip': 'Skip',
'ci.time_to_first': 'Time to first useful email',
'ci.lifecycle_depth': 'Lifecycle depth'
```

Replace hardcoded strings in components with `t('...')`.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js apps/dashboard/src/pages/CompetitorIntel
git commit -m "chore(competitor-intel): i18n all UI strings (ES + EN)"
```

---

### Task 5.3: Final smoke test + demo rehearsal

- [ ] **Step 1: Run all tests**

Run: `cd apps/dashboard && npx vitest run ../../packages/core/competitor-intel ../../packages/core/crypto`
Expected: all green.

- [ ] **Step 2: Manual smoke flow**

1. Visit `/competitor-intel` → landing lists DERTOUR investigation.
2. Click → Overview renders 5 brand cards with scores.
3. Click brand → playbook tab shows 16 steps (2 personas × 8), inbox shows emails, scoring tab saves.
4. Back to investigation → Comparative: grid + heatmap render.
5. Insights page: create one, export .docx, open in Word.
6. Emirates Gap: table shows lived vs EH reference.

- [ ] **Step 3: Rehearse demo script**

Out loud, 5 minutes, covering: Overview → Carrier brand detail (the highest-scoring, show Carrier personalisation evidence) → Comparative (time-to-first-touch drama) → Insights (cross-brand quick-wins) → Emirates Gap (strategic implication).

- [ ] **Step 4: Fix any rough edge found in rehearsal; recommit**

- [ ] **Step 5: Final commit + push**

```bash
git push -u origin feat/competitor-intel
```

Final check: `git log --oneline feat/competitor-intel ^master | wc -l` — expect 15–20 commits.

---

## Stretch goal (Friday AM only if time)

### Task S.1: "Play the week in 30 seconds"

Add to Comparative view an animation that replays the week's events chronologically.

- [ ] Endpoint: GET `/api/competitor-intel/investigations/:id/timeline` returning all events (subscriptions, emails, engagements) with timestamps.
- [ ] Component: `TimelinePlayer.jsx` that iterates events, updates a `Date` cursor, highlights brand cards as their events fire. 30-second total duration, no matter the real span.
- [ ] Button "▶ Play the week" on Comparative page.

Not elaborated further to keep this plan tight. Skip if Thursday evening rehearsal is clean.

---

## Self-review summary

- **Spec coverage:** all scoped items covered — investigation seed (1.4), 2 personas + Gmail OAuth (1.4/2.2), 6 playbook runs × 8 steps (1.4), ingestion (2.4), phase-1 domain (2.3) + phase-2 LLM (3.1), hybrid engagement (3.2), 4-axis scoring (3.3), 6 screens (2.5/2.6/3.4/4.1/4.2/4.3), .docx export (4.2), ethics (read-only scope + no unsubscribe), `includeSpamTrash` on, Railway-only DDL (rule #7).
- **Placeholder scan:** none — every step has runnable commands or code.
- **Type consistency:** `classifyEmailPhase1` used consistently, `classifyEmailPhase2` + `runPhase2Batch`, `simulateEngagementForEmail` + `autoEngageRecent`, `computeBrandScores` + `setBrandScoreManual`, `exportDocx` all match throughout.
- **Scope check:** single investigation targeted, module designed reusable. Playwright/browsing simulation explicitly out of scope per spec.
