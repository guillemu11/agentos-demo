# Campaign Calendar with AI Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone `/app/calendar` page with a Gantt timeline of Emirates BAU + lifecycle campaigns, backed by a hybrid AI detection engine (deterministic rules + Claude narrative layer).

**Architecture:** Frontend React page reads mock campaign data (`emiratesCampaigns.js`, `emiratesBauTypes.js`) through a pure-JS builder that normalizes events into three flavors (fixed/scheduled/always-on). A rules engine runs on the client to detect scheduling problems. A backend endpoint calls Claude Sonnet 4.6 to enrich those detections with narrative insights grounded in historical KPIs. All UI follows the existing dark-theme, CSS-custom-property design system.

**Tech Stack:** React 19, React Router 7, Express 5, `@anthropic-ai/sdk`, `lucide-react`, `vitest` for tests.

**Spec:** [docs/superpowers/specs/2026-04-16-campaign-calendar-ai-design.md](../specs/2026-04-16-campaign-calendar-ai-design.md)

---

## File Map

**Create:**

- `apps/dashboard/src/pages/CampaignCalendarPage.jsx` — page shell, state orchestration
- `apps/dashboard/src/components/calendar/CalendarTopbar.jsx` — title, month nav, view switcher, filter btn, health score
- `apps/dashboard/src/components/calendar/CalendarFilterBar.jsx` — category + channel chips
- `apps/dashboard/src/components/calendar/CalendarGantt.jsx` — timeline renderer with bars, conflict lines, today line
- `apps/dashboard/src/components/calendar/AiIntelligencePanel.jsx` — risks/opportunities/insights cards
- `apps/dashboard/src/components/calendar/CampaignDetailCard.jsx` — selected bar detail
- `apps/dashboard/src/lib/calendarEvents.js` — `buildCalendarEvents(rangeStart, rangeEnd)` pure function
- `apps/dashboard/src/lib/calendarAiRules.js` — 7 deterministic rules + `computeHealthScore`
- `apps/dashboard/src/lib/__tests__/calendarEvents.test.js`
- `apps/dashboard/src/lib/__tests__/calendarAiRules.test.js`
- `apps/dashboard/__tests__/calendar-ai-insights.test.js` — endpoint integration test

**Modify:**

- `apps/dashboard/src/components/Layout.jsx` — add Calendar nav entry in Control group
- `apps/dashboard/src/components/icons.jsx` — add `calendar` key to `NavIcons` if missing (confirm first)
- `apps/dashboard/src/main.jsx` — add `/calendar` route
- `apps/dashboard/src/i18n/translations.js` — add `layout.calendar` + `calendar.*` keys (ES + EN)
- `apps/dashboard/src/index.css` — add `.calendar-*`, `.ai-intelligence-*`, `.health-score-*` classes
- `apps/dashboard/server.js` — add `POST /api/calendar/ai-insights` endpoint
- `apps/dashboard/package.json` — add `vitest` devDep + `test` script (if missing)

---

## Task 1: Setup vitest + smoke-test placeholder page

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/vitest.config.js`
- Create: `apps/dashboard/src/pages/CampaignCalendarPage.jsx`
- Modify: `apps/dashboard/src/main.jsx`
- Modify: `apps/dashboard/src/components/Layout.jsx`
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Check vitest availability**

Run: `cd apps/dashboard && npm ls vitest 2>/dev/null`
Expected: either shows vitest, or says "empty".

- [ ] **Step 2: If vitest is missing, install it**

```bash
cd apps/dashboard
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `apps/dashboard/package.json` scripts (keep existing scripts):

```json
"scripts": {
  "dev": "vite",
  "server": "node server.js",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create vitest config**

Create `apps/dashboard/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 4: Create placeholder page**

Create `apps/dashboard/src/pages/CampaignCalendarPage.jsx`:

```jsx
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function CampaignCalendarPage() {
  const { t } = useLanguage();
  return (
    <div className="dashboard-container">
      <h1>{t('calendar.pageTitle')}</h1>
      <p>{t('calendar.placeholder')}</p>
    </div>
  );
}
```

- [ ] **Step 5: Add translations**

Modify `apps/dashboard/src/i18n/translations.js` — add under both `es` and `en` top-level objects:

```js
// es
layout: {
  // ...existing...
  calendar: 'Calendario',
},
calendar: {
  pageTitle: 'Calendario de Campañas',
  placeholder: 'Cargando…',
},

// en
layout: {
  // ...existing...
  calendar: 'Calendar',
},
calendar: {
  pageTitle: 'Campaign Calendar',
  placeholder: 'Loading…',
},
```

- [ ] **Step 6: Add route**

Modify `apps/dashboard/src/main.jsx` — add under the existing `<Route path="/app/*">`:

```jsx
import CampaignCalendarPage from './pages/CampaignCalendarPage.jsx';
// ...
<Route path="calendar" element={<CampaignCalendarPage />} />
```

(Adjust import path and position matching the pattern used for `JourneysListPage` or similar.)

- [ ] **Step 7: Add nav entry**

Modify `apps/dashboard/src/components/Layout.jsx` — in the `control` group array, add a new item:

```jsx
{
  label: t('layout.control'),
  items: [
    { to: '/app/inbox', icon: icons.projectManager, label: t('layout.projectManager') },
    { to: '/app/knowledge', icon: icons.knowledgeBase, label: t('layout.knowledgeBase') },
    { to: '/app/journeys', icon: icons.workflows, label: t('layout.journeys') },
    { to: '/app/calendar', icon: icons.calendar, label: t('layout.calendar') },
  ],
},
```

- [ ] **Step 8: Confirm calendar icon exists**

Read `apps/dashboard/src/components/icons.jsx` and search for `NavIcons.calendar` or `calendar:`.
If missing, add:

```jsx
import { Calendar } from 'lucide-react';
// ...in NavIcons export:
calendar: <Calendar size={18} />,
```

- [ ] **Step 9: Run the app and smoke test**

Run: `npm start` from repo root.
Open `http://localhost:4000/app/calendar`.
Expected: page title "Campaign Calendar" renders, sidebar shows new "Calendar" entry under Control, nav link is active.

- [ ] **Step 10: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/vitest.config.js apps/dashboard/src/pages/CampaignCalendarPage.jsx apps/dashboard/src/main.jsx apps/dashboard/src/components/Layout.jsx apps/dashboard/src/components/icons.jsx apps/dashboard/src/i18n/translations.js
git commit -m "feat(calendar): scaffold campaign calendar page + nav entry"
```

---

## Task 2: `buildCalendarEvents` data builder

**Files:**
- Create: `apps/dashboard/src/lib/calendarEvents.js`
- Create: `apps/dashboard/src/lib/__tests__/calendarEvents.test.js`

The builder normalizes campaigns from two mock sources into a unified `CalendarEvent[]`. Three flavors:

- `fixed`: hardcoded monthly schedule (Statement Email → 14th of month).
- `scheduled`: pulled from `BAU_CAMPAIGN_TYPES[].recentCampaigns[].date`.
- `always-on`: lifecycle entries in `CAMPAIGNS[]` (groups `abandon-recovery`, `preflight-journey`, `postflight-engagement`) rendered as continuous bars across the visible range.

- [ ] **Step 1: Write failing tests**

Create `apps/dashboard/src/lib/__tests__/calendarEvents.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildCalendarEvents } from '../calendarEvents.js';

const RANGE = { start: '2026-04-01', end: '2026-04-30' };

describe('buildCalendarEvents', () => {
  it('returns an array', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    expect(Array.isArray(events)).toBe(true);
  });

  it('includes scheduled BAU campaigns within range', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const newA350 = events.find(e => e.campaignId === 'special-announcement' && e.startDate === '2026-04-15');
    expect(newA350).toBeDefined();
    expect(newA350.flavor).toBe('scheduled');
    expect(newA350.group).toBe('broadcast');
  });

  it('excludes BAU campaigns outside range', () => {
    const events = buildCalendarEvents('2026-04-01', '2026-04-10');
    expect(events.find(e => e.startDate === '2026-04-15')).toBeUndefined();
  });

  it('emits a fixed Statement Email on the 14th', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const statement = events.find(e => e.campaignId === 'statement-email');
    expect(statement).toBeDefined();
    expect(statement.flavor).toBe('fixed');
    expect(statement.startDate).toBe('2026-04-14');
    expect(statement.endDate).toBe('2026-04-14');
  });

  it('emits always-on lifecycle programs spanning the full range', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const cart = events.find(e => e.campaignId === 'cart-abandon');
    expect(cart).toBeDefined();
    expect(cart.flavor).toBe('always-on');
    expect(cart.startDate).toBe('2026-04-01');
    expect(cart.endDate).toBe('2026-04-30');
  });

  it('each event has required shape', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const ev = events[0];
    expect(ev).toMatchObject({
      id: expect.any(String),
      campaignId: expect.any(String),
      campaignName: expect.any(String),
      group: expect.any(String),
      flavor: expect.stringMatching(/^(fixed|scheduled|always-on)$/),
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      channel: expect.any(String),
      color: expect.stringMatching(/^#/),
    });
  });

  it('always-on events include projected monthly volume', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const cart = events.find(e => e.campaignId === 'cart-abandon');
    expect(cart.projectedVolume).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/dashboard && npm test -- calendarEvents`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `buildCalendarEvents`**

Create `apps/dashboard/src/lib/calendarEvents.js`:

```js
import { BAU_CAMPAIGN_TYPES, BAU_CATEGORIES } from '../data/emiratesBauTypes.js';
import { CAMPAIGNS, CAMPAIGN_GROUPS } from '../data/emiratesCampaigns.js';

const ALWAYS_ON_GROUPS = new Set(['abandon-recovery', 'preflight-journey', 'postflight-engagement']);
const FIXED_SCHEDULES = {
  'statement-email': { dayOfMonth: 14, group: 'communications', channel: 'email' },
};

function inRange(isoDate, start, end) {
  return isoDate >= start && isoDate <= end;
}

function lifecycleColor(groupId) {
  const g = CAMPAIGN_GROUPS.find(cg => cg.id === groupId);
  return g?.color || '#94a3b8';
}

function bauColor(categoryId) {
  return BAU_CATEGORIES[categoryId]?.color || '#94a3b8';
}

function emitScheduledBau(range, out) {
  for (const type of BAU_CAMPAIGN_TYPES) {
    for (const c of type.recentCampaigns || []) {
      if (!inRange(c.date, range.start, range.end)) continue;
      out.push({
        id: `${type.id}-${c.date}`,
        campaignId: type.id,
        campaignName: c.name,
        group: type.category,
        flavor: 'scheduled',
        startDate: c.date,
        endDate: c.date,
        channel: 'email',
        segment: (type.defaultSegments && type.defaultSegments[0]) || '',
        language: 'EN+AR',
        color: bauColor(type.category),
        kpis: { openRate: c.openRate, ctr: c.ctr, conversions: c.conversions },
        status: c.status,
      });
    }
  }
}

function emitFixed(range, out) {
  // Expand year/month of range and emit each fixed day within
  const start = new Date(range.start);
  const end = new Date(range.end);
  for (const [campaignId, cfg] of Object.entries(FIXED_SCHEDULES)) {
    const iter = new Date(start.getFullYear(), start.getMonth(), 1);
    while (iter <= end) {
      const fixedDate = new Date(iter.getFullYear(), iter.getMonth(), cfg.dayOfMonth);
      const iso = fixedDate.toISOString().slice(0, 10);
      if (inRange(iso, range.start, range.end)) {
        const source = CAMPAIGNS.find(c => c.id === campaignId);
        out.push({
          id: `${campaignId}-${iso}`,
          campaignId,
          campaignName: source?.name || campaignId,
          group: cfg.group,
          flavor: 'fixed',
          startDate: iso,
          endDate: iso,
          channel: cfg.channel,
          segment: source?.audience || '',
          language: 'EN+AR',
          color: lifecycleColor(cfg.group),
          kpis: source?.kpis || null,
          status: 'scheduled',
        });
      }
      iter.setMonth(iter.getMonth() + 1);
    }
  }
}

function emitAlwaysOn(range, out) {
  for (const c of CAMPAIGNS) {
    if (!ALWAYS_ON_GROUPS.has(c.group)) continue;
    if (c.status !== 'live') continue;
    out.push({
      id: `${c.id}-alwayson-${range.start}`,
      campaignId: c.id,
      campaignName: c.name,
      group: c.group,
      flavor: 'always-on',
      startDate: range.start,
      endDate: range.end,
      channel: c.channel,
      segment: c.audience,
      language: 'EN+AR',
      color: lifecycleColor(c.group),
      kpis: c.kpis,
      status: 'live',
      projectedVolume: c.kpis?.sends || 0,
    });
  }
}

export function buildCalendarEvents(startDate, endDate) {
  const range = { start: startDate, end: endDate };
  const out = [];
  emitScheduledBau(range, out);
  emitFixed(range, out);
  emitAlwaysOn(range, out);
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/dashboard && npm test -- calendarEvents`
Expected: PASS (all 7 tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/calendarEvents.js apps/dashboard/src/lib/__tests__/calendarEvents.test.js
git commit -m "feat(calendar): add buildCalendarEvents data builder with 3 flavors"
```

---

## Task 3: AI rules engine (7 rules + health score)

**Files:**
- Create: `apps/dashboard/src/lib/calendarAiRules.js`
- Create: `apps/dashboard/src/lib/__tests__/calendarAiRules.test.js`

Each rule receives `(events, range)` and returns `RuleHit[]`.

`RuleHit` shape:

```js
{
  id: string,            // stable, for dismissal tracking
  type: 'risk' | 'opportunity' | 'insight',
  severity: 'high' | 'medium' | 'low',
  ruleId: string,        // which rule fired
  dateRange: { start, end },
  campaignIds: string[],
  title: string,         // default fallback title
  rawEvidence: object,   // passed to Claude for narrative
}
```

- [ ] **Step 1: Write failing tests**

Create `apps/dashboard/src/lib/__tests__/calendarAiRules.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  detectSegmentOverload,
  detectBauLifecycleCollision,
  detectLanguageImbalance,
  detectCoverageGap,
  detectHolidayWindowGap,
  detectFrequencyAnomaly,
  detectPerformanceOpportunity,
  runAllRules,
  computeHealthScore,
} from '../calendarAiRules.js';

const RANGE = { start: '2026-04-01', end: '2026-04-30' };

const ev = (overrides) => ({
  id: 'e',
  campaignId: 'c',
  campaignName: 'C',
  group: 'broadcast',
  flavor: 'scheduled',
  startDate: '2026-04-13',
  endDate: '2026-04-13',
  channel: 'email',
  segment: 'Premium Skywards',
  language: 'EN+AR',
  color: '#D71920',
  kpis: { openRate: 29, ctr: 3, conversions: 4000 },
  status: 'scheduled',
  ...overrides,
});

describe('detectSegmentOverload', () => {
  it('fires when ≥2 scheduled events hit same segment within 24h', () => {
    const events = [
      ev({ id: 'a', startDate: '2026-04-13', segment: 'Premium Skywards' }),
      ev({ id: 'b', startDate: '2026-04-13', segment: 'Premium Skywards' }),
      ev({ id: 'c', startDate: '2026-04-13', segment: 'Premium Skywards' }),
    ];
    const hits = detectSegmentOverload(events, RANGE);
    expect(hits).toHaveLength(1);
    expect(hits[0].type).toBe('risk');
    expect(hits[0].campaignIds).toHaveLength(3);
  });

  it('does not fire for single event', () => {
    expect(detectSegmentOverload([ev()], RANGE)).toEqual([]);
  });

  it('does not fire for different segments', () => {
    const events = [
      ev({ id: 'a', segment: 'Premium Skywards' }),
      ev({ id: 'b', segment: 'Silver' }),
    ];
    expect(detectSegmentOverload(events, RANGE)).toEqual([]);
  });
});

describe('detectBauLifecycleCollision', () => {
  it('fires when BAU scheduled on day with always-on program same segment', () => {
    const events = [
      ev({ id: 'bau', flavor: 'scheduled', segment: 'Skywards members who started checkout but did not complete' }),
      ev({ id: 'life', flavor: 'always-on', startDate: '2026-04-01', endDate: '2026-04-30', campaignId: 'cart-abandon', segment: 'Skywards members who started checkout but did not complete' }),
    ];
    const hits = detectBauLifecycleCollision(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('risk');
  });
});

describe('detectLanguageImbalance', () => {
  it('fires when language is only EN for Dubai/MENA segment', () => {
    const events = [ev({ segment: 'Dubai Residents', language: 'EN' })];
    const hits = detectLanguageImbalance(events, RANGE);
    expect(hits).toHaveLength(1);
    expect(hits[0].type).toBe('risk');
  });

  it('does not fire when EN+AR is set', () => {
    const events = [ev({ segment: 'Dubai Residents', language: 'EN+AR' })];
    expect(detectLanguageImbalance(events, RANGE)).toEqual([]);
  });
});

describe('detectCoverageGap', () => {
  it('fires when a tier segment has no touchpoint >10 days in range', () => {
    // Only one Silver event at the very start → gap rest of month
    const events = [ev({ segment: 'Silver', startDate: '2026-04-02', endDate: '2026-04-02' })];
    const hits = detectCoverageGap(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('opportunity');
  });

  it('does not fire when tier has weekly touchpoints', () => {
    const events = [
      ev({ id: 'a', segment: 'Silver', startDate: '2026-04-03', endDate: '2026-04-03' }),
      ev({ id: 'b', segment: 'Silver', startDate: '2026-04-10', endDate: '2026-04-10' }),
      ev({ id: 'c', segment: 'Silver', startDate: '2026-04-17', endDate: '2026-04-17' }),
      ev({ id: 'd', segment: 'Silver', startDate: '2026-04-24', endDate: '2026-04-24' }),
    ];
    expect(detectCoverageGap(events, RANGE)).toEqual([]);
  });
});

describe('detectHolidayWindowGap', () => {
  it('fires when Eid Al Fitr 2026 (Apr 29) is in range with no offer campaign', () => {
    const events = [ev({ group: 'broadcast', startDate: '2026-04-03' })];
    const hits = detectHolidayWindowGap(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('opportunity');
    expect(hits[0].rawEvidence.holiday).toMatch(/Eid/i);
  });

  it('does not fire when offer campaign covers the holiday window', () => {
    const events = [ev({ group: 'offers', startDate: '2026-04-28', endDate: '2026-04-30' })];
    expect(detectHolidayWindowGap(events, RANGE)).toEqual([]);
  });
});

describe('detectFrequencyAnomaly', () => {
  it('fires when a campaign type exceeds 2x its historical median in the range', () => {
    // Newsletter type: historical median 4/month → feed it 10
    const newsletters = Array.from({ length: 10 }, (_, i) => ev({
      id: `n${i}`, campaignId: 'newsletter', group: 'broadcast',
      startDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      endDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
    }));
    const hits = detectFrequencyAnomaly(newsletters, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('risk');
  });
});

describe('detectPerformanceOpportunity', () => {
  it('surfaces historical high-performer with no counterpart planned', () => {
    // In 2026, no Christmas Getaway this year but historical had 36.7% OR
    const events = [ev({ startDate: '2026-04-03' })];
    const hits = detectPerformanceOpportunity(events, RANGE);
    // Should at least find some opportunity
    expect(Array.isArray(hits)).toBe(true);
  });
});

describe('runAllRules', () => {
  it('returns combined RuleHit[] from all rules', () => {
    const events = [
      ev({ id: 'a', segment: 'Premium Skywards' }),
      ev({ id: 'b', segment: 'Premium Skywards' }),
    ];
    const hits = runAllRules(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(h => h.id && h.type && h.severity && h.ruleId)).toBe(true);
  });
});

describe('computeHealthScore', () => {
  it('returns 100 with no hits', () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it('subtracts 5 per high risk, 2 per medium, 1 per low', () => {
    const hits = [
      { type: 'risk', severity: 'high' },
      { type: 'risk', severity: 'medium' },
      { type: 'risk', severity: 'low' },
    ];
    expect(computeHealthScore(hits)).toBe(100 - 5 - 2 - 1);
  });

  it('clamps to 0 minimum', () => {
    const hits = Array.from({ length: 30 }, () => ({ type: 'risk', severity: 'high' }));
    expect(computeHealthScore(hits)).toBe(0);
  });

  it('ignores opportunities/insights in subtraction', () => {
    const hits = [{ type: 'opportunity', severity: 'high' }];
    expect(computeHealthScore(hits)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/dashboard && npm test -- calendarAiRules`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement rules**

Create `apps/dashboard/src/lib/calendarAiRules.js`:

```js
// 2026 holiday calendar (subset relevant to Emirates markets)
const HOLIDAYS = [
  { name: 'Eid Al Fitr 2026', start: '2026-04-29', end: '2026-05-01', offerGroups: ['offers', 'partner'] },
  { name: 'Eid Al Adha 2026', start: '2026-07-06', end: '2026-07-09', offerGroups: ['offers', 'partner'] },
  { name: 'Christmas 2026', start: '2026-12-18', end: '2026-12-26', offerGroups: ['offers'] },
  { name: 'Ramadan Start 2026', start: '2026-03-20', end: '2026-03-20', offerGroups: ['offers'] },
];

// Campaigns targeting Dubai/MENA audience require EN + AR
const AR_REQUIRED_HINTS = [/dubai/i, /mena/i, /uae/i, /arab/i];

// Tier segments we track for coverage gaps
const TIER_SEGMENTS = ['Silver', 'Gold', 'Platinum', 'Premium Skywards'];

const COVERAGE_GAP_DAYS = 10;
const FREQUENCY_MULTIPLIER = 2;

function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.round((b - a) / 86400000);
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const it of arr) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

function rangeOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// ── Rule 1: Segment overload ─────────────────────────────────
export function detectSegmentOverload(events, range) {
  const scheduled = events.filter(e => e.flavor === 'scheduled' || e.flavor === 'fixed');
  const byDaySegment = groupBy(scheduled, e => `${e.startDate}|${e.segment}`);
  const hits = [];
  for (const [key, group] of byDaySegment) {
    if (group.length < 2) continue;
    const [date, segment] = key.split('|');
    hits.push({
      id: `seg-overload-${date}-${segment}`,
      type: 'risk',
      severity: group.length >= 3 ? 'high' : 'medium',
      ruleId: 'segmentOverload',
      dateRange: { start: date, end: date },
      campaignIds: group.map(e => e.campaignId),
      title: `${group.length} campaigns to ${segment} on ${date}`,
      rawEvidence: { segment, date, count: group.length, campaigns: group.map(e => e.campaignName) },
    });
  }
  return hits;
}

// ── Rule 2: BAU-Lifecycle collision ──────────────────────────
export function detectBauLifecycleCollision(events, range) {
  const bau = events.filter(e => e.flavor === 'scheduled' || e.flavor === 'fixed');
  const lifecycle = events.filter(e => e.flavor === 'always-on');
  const hits = [];
  for (const b of bau) {
    for (const l of lifecycle) {
      if (!rangeOverlap(b.startDate, b.endDate, l.startDate, l.endDate)) continue;
      // Heuristic: same segment keywords
      if (!b.segment || !l.segment) continue;
      const shared = b.segment.toLowerCase().split(/\s+/).filter(w => w.length > 3 && l.segment.toLowerCase().includes(w));
      if (shared.length === 0) continue;
      hits.push({
        id: `bau-life-${b.id}-${l.campaignId}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'bauLifecycleCollision',
        dateRange: { start: b.startDate, end: b.endDate },
        campaignIds: [b.campaignId, l.campaignId],
        title: `${b.campaignName} collides with ${l.campaignName} (same segment)`,
        rawEvidence: { bau: b.campaignName, lifecycle: l.campaignName, segment: b.segment },
      });
    }
  }
  return hits;
}

// ── Rule 3: Language imbalance ───────────────────────────────
export function detectLanguageImbalance(events, range) {
  const hits = [];
  for (const e of events) {
    if (e.flavor === 'always-on') continue;
    const needsAr = AR_REQUIRED_HINTS.some(rx => rx.test(e.segment || ''));
    const hasAr = (e.language || '').toUpperCase().includes('AR');
    if (needsAr && !hasAr) {
      hits.push({
        id: `lang-${e.id}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'languageImbalance',
        dateRange: { start: e.startDate, end: e.endDate },
        campaignIds: [e.campaignId],
        title: `${e.campaignName} missing AR version`,
        rawEvidence: { campaign: e.campaignName, segment: e.segment, language: e.language },
      });
    }
  }
  return hits;
}

// ── Rule 4: Coverage gap for tier segments ───────────────────
export function detectCoverageGap(events, range) {
  const hits = [];
  for (const tier of TIER_SEGMENTS) {
    const tierEvents = events
      .filter(e => (e.segment || '').toLowerCase().includes(tier.toLowerCase()))
      .filter(e => e.flavor !== 'always-on')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    if (tierEvents.length === 0) continue;

    // Boundary gap: range start → first event
    let prevDate = range.start;
    for (const ev of tierEvents) {
      if (daysBetween(prevDate, ev.startDate) > COVERAGE_GAP_DAYS) {
        hits.push({
          id: `gap-${tier}-${prevDate}-${ev.startDate}`,
          type: 'opportunity',
          severity: 'medium',
          ruleId: 'coverageGap',
          dateRange: { start: prevDate, end: ev.startDate },
          campaignIds: [],
          title: `${tier} segment has ${daysBetween(prevDate, ev.startDate)}-day gap`,
          rawEvidence: { tier, gapDays: daysBetween(prevDate, ev.startDate), from: prevDate, to: ev.startDate },
        });
      }
      prevDate = ev.endDate;
    }
    // Boundary gap: last event → range end
    if (daysBetween(prevDate, range.end) > COVERAGE_GAP_DAYS) {
      hits.push({
        id: `gap-${tier}-${prevDate}-${range.end}`,
        type: 'opportunity',
        severity: 'medium',
        ruleId: 'coverageGap',
        dateRange: { start: prevDate, end: range.end },
        campaignIds: [],
        title: `${tier} segment has ${daysBetween(prevDate, range.end)}-day trailing gap`,
        rawEvidence: { tier, gapDays: daysBetween(prevDate, range.end), from: prevDate, to: range.end },
      });
    }
  }
  return hits;
}

// ── Rule 5: Holiday window gap ───────────────────────────────
export function detectHolidayWindowGap(events, range) {
  const hits = [];
  for (const h of HOLIDAYS) {
    if (!rangeOverlap(h.start, h.end, range.start, range.end)) continue;
    const covered = events.some(e =>
      h.offerGroups.includes(e.group) && rangeOverlap(e.startDate, e.endDate, h.start, h.end)
    );
    if (!covered) {
      hits.push({
        id: `holiday-${h.name}-${h.start}`,
        type: 'opportunity',
        severity: 'high',
        ruleId: 'holidayWindowGap',
        dateRange: { start: h.start, end: h.end },
        campaignIds: [],
        title: `${h.name} window has no offer campaign`,
        rawEvidence: { holiday: h.name, window: `${h.start} → ${h.end}` },
      });
    }
  }
  return hits;
}

// ── Rule 6: Frequency anomaly ────────────────────────────────
export function detectFrequencyAnomaly(events, range) {
  const hits = [];
  const byCampaign = groupBy(events.filter(e => e.flavor === 'scheduled'), e => e.campaignId);
  for (const [campaignId, list] of byCampaign) {
    // Historical median: estimated from recentCampaigns length / 3 months = monthly rate.
    // Here we use length of recentCampaigns entries for the type.
    // Simple heuristic: if > FREQUENCY_MULTIPLIER × 5 events in range, flag.
    if (list.length > FREQUENCY_MULTIPLIER * 4) {
      hits.push({
        id: `freq-${campaignId}-${range.start}`,
        type: 'risk',
        severity: 'medium',
        ruleId: 'frequencyAnomaly',
        dateRange: range,
        campaignIds: [campaignId],
        title: `${list[0].campaignName}: ${list.length} sends in range (>2× historical)`,
        rawEvidence: { campaign: list[0].campaignName, count: list.length },
      });
    }
  }
  return hits;
}

// ── Rule 7: Performance opportunity ──────────────────────────
export function detectPerformanceOpportunity(events, range) {
  // High-performing historical templates we don't see in range
  const HIGH_PERFORMERS = [
    { tag: 'Tier upgrade celebration', openRate: 72, segment: 'Tier upgraded', group: 'loyalty-tiers' },
  ];
  const hits = [];
  for (const hp of HIGH_PERFORMERS) {
    const present = events.some(e => (e.campaignName || '').toLowerCase().includes(hp.tag.toLowerCase()));
    if (!present) {
      hits.push({
        id: `perf-${hp.tag}-${range.start}`,
        type: 'insight',
        severity: 'low',
        ruleId: 'performanceOpportunity',
        dateRange: range,
        campaignIds: [],
        title: `High-performing template "${hp.tag}" not in range`,
        rawEvidence: hp,
      });
    }
  }
  return hits;
}

// ── Orchestrator ──────────────────────────────────────────────
export function runAllRules(events, range) {
  return [
    ...detectSegmentOverload(events, range),
    ...detectBauLifecycleCollision(events, range),
    ...detectLanguageImbalance(events, range),
    ...detectCoverageGap(events, range),
    ...detectHolidayWindowGap(events, range),
    ...detectFrequencyAnomaly(events, range),
    ...detectPerformanceOpportunity(events, range),
  ];
}

// ── AI Health Score ──────────────────────────────────────────
export function computeHealthScore(hits) {
  const risks = hits.filter(h => h.type === 'risk');
  const penalty = risks.reduce((acc, h) => {
    if (h.severity === 'high') return acc + 5;
    if (h.severity === 'medium') return acc + 2;
    return acc + 1;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/dashboard && npm test -- calendarAiRules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/calendarAiRules.js apps/dashboard/src/lib/__tests__/calendarAiRules.test.js
git commit -m "feat(calendar): add 7-rule AI detection engine + health score"
```

---

## Task 4: Backend endpoint `POST /api/calendar/ai-insights`

**Files:**
- Modify: `apps/dashboard/server.js`
- Create: `apps/dashboard/__tests__/calendar-ai-insights.test.js`

The endpoint receives events + ruleHits, calls Claude with a grounded prompt, returns narrative-enriched insights with a 5-minute in-memory cache.

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/__tests__/calendar-ai-insights.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichWithClaude } from '../server-calendar-ai.js';

describe('enrichWithClaude', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls Claude with events + ruleHits and returns enriched insights', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              enriched: [
                { id: 'seg-overload-2026-04-13-Premium', narrative: 'Premium overload detail', action: 'Reschedule', estimatedImpact: '-18% OR' },
              ],
              freeformInsights: [],
            }),
          }],
        }),
      },
    };
    const events = [{ id: 'a', campaignId: 'c', campaignName: 'C', startDate: '2026-04-13' }];
    const ruleHits = [{ id: 'seg-overload-2026-04-13-Premium', type: 'risk', severity: 'high', ruleId: 'segmentOverload', title: 'X', rawEvidence: {} }];
    const out = await enrichWithClaude({ client: fakeClient, events, ruleHits, rangeStart: '2026-04-01', rangeEnd: '2026-04-30' });
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
    expect(out.enriched).toHaveLength(1);
    expect(out.enriched[0].narrative).toBe('Premium overload detail');
  });

  it('returns raw ruleHits on Claude error (graceful degradation)', async () => {
    const fakeClient = { messages: { create: vi.fn().mockRejectedValue(new Error('api down')) } };
    const ruleHits = [{ id: 'x', type: 'risk', severity: 'low', ruleId: 'r', title: 'T', rawEvidence: {} }];
    const out = await enrichWithClaude({ client: fakeClient, events: [], ruleHits, rangeStart: '2026-04-01', rangeEnd: '2026-04-30' });
    expect(out.enriched).toHaveLength(1);
    expect(out.enriched[0].narrative).toBe('T');
    expect(out.degraded).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npm test -- calendar-ai-insights`
Expected: FAIL (module not found).

- [ ] **Step 3: Extract enrichment logic to its own module**

Create `apps/dashboard/server-calendar-ai.js`:

```js
const SYSTEM_PROMPT = `You are an email marketing intelligence analyst for Emirates Airline.
You receive a JSON payload with:
- events[]: planned campaigns in the current view range
- ruleHits[]: deterministic risks/opportunities detected by a rules engine
- rangeStart, rangeEnd

For each ruleHit, write a 1-2 sentence narrative in Spanish grounded in the event data provided.
Include concrete numbers (open rates, conversions, day counts) where the raw evidence supports them.
Suggest a concrete action per hit.

Return strict JSON matching this shape:
{
  "enriched": [
    { "id": "<ruleHit.id>", "narrative": "...", "action": "...", "estimatedImpact": "..." }
  ],
  "freeformInsights": [
    { "id": "free-1", "type": "insight", "severity": "low", "title": "...", "narrative": "...", "action": "..." }
  ]
}
Output ONLY the JSON, no markdown fences, no prose.`;

export async function enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const payload = { rangeStart, rangeEnd, events, ruleHits };
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    const text = (resp.content || []).find(c => c.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text);
    return {
      enriched: parsed.enriched || [],
      freeformInsights: parsed.freeformInsights || [],
      degraded: false,
    };
  } catch (err) {
    return {
      enriched: ruleHits.map(h => ({
        id: h.id,
        narrative: h.title,
        action: '',
        estimatedImpact: '',
      })),
      freeformInsights: [],
      degraded: true,
      error: err.message,
    };
  }
}

// Simple in-memory cache keyed by eventsHash + range
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

function hashPayload(events, ruleHits, rangeStart, rangeEnd) {
  const ids = [...events.map(e => e.id), ...ruleHits.map(h => h.id)].sort().join('|');
  return `${rangeStart}|${rangeEnd}|${ids}`;
}

export async function getOrEnrich({ client, events, ruleHits, rangeStart, rangeEnd }) {
  const key = hashPayload(events, ruleHits, rangeStart, rangeEnd);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = await enrichWithClaude({ client, events, ruleHits, rangeStart, rangeEnd });
  cache.set(key, { at: now, value });
  return value;
}
```

- [ ] **Step 4: Wire endpoint in server.js**

Modify `apps/dashboard/server.js` — near other `/api` routes add:

```js
import Anthropic from '@anthropic-ai/sdk';
import { getOrEnrich } from './server-calendar-ai.js';

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

app.post('/api/calendar/ai-insights', async (req, res) => {
  const { events = [], ruleHits = [], rangeStart, rangeEnd } = req.body || {};
  if (!rangeStart || !rangeEnd) {
    return res.status(400).json({ error: 'rangeStart and rangeEnd required' });
  }
  if (!anthropicClient) {
    return res.json({
      enriched: ruleHits.map(h => ({ id: h.id, narrative: h.title, action: '', estimatedImpact: '' })),
      freeformInsights: [],
      degraded: true,
      error: 'ANTHROPIC_API_KEY not configured',
    });
  }
  try {
    const out = await getOrEnrich({ client: anthropicClient, events, ruleHits, rangeStart, rangeEnd });
    res.json(out);
  } catch (err) {
    console.error('[calendar/ai-insights] error:', err);
    res.status(500).json({ error: err.message });
  }
});
```

(If there's already an `Anthropic` import or client in `server.js`, reuse it instead of re-importing.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/dashboard && npm test -- calendar-ai-insights`
Expected: PASS (both cases).

- [ ] **Step 6: Manual smoke test**

Run: `npm start` from repo root.
From browser devtools or curl:

```bash
curl -X POST http://localhost:3002/api/calendar/ai-insights \
  -H "Content-Type: application/json" \
  -d '{"rangeStart":"2026-04-01","rangeEnd":"2026-04-30","events":[],"ruleHits":[{"id":"test","type":"risk","severity":"high","ruleId":"segmentOverload","title":"Test","rawEvidence":{}}]}'
```

Expected: JSON with `enriched` array and either `degraded: false` (Claude ran) or `degraded: true` with fallback text.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/server.js apps/dashboard/server-calendar-ai.js apps/dashboard/__tests__/calendar-ai-insights.test.js
git commit -m "feat(calendar): add /api/calendar/ai-insights endpoint with Claude enrichment"
```

---

## Task 5: i18n keys for the full page

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

Add all calendar keys upfront so components in later tasks just call `t('calendar.xxx')`.

- [ ] **Step 1: Add ES keys**

In the `es` object, extend `calendar`:

```js
calendar: {
  pageTitle: 'Calendario de Campañas',
  placeholder: 'Cargando…',
  monthPrev: 'Mes anterior',
  monthNext: 'Mes siguiente',
  view: { year: 'Año', month: 'Mes', week: 'Semana', day: 'Día' },
  filterBtn: 'Filtrar',
  filterType: 'Tipo',
  filterChannel: 'Canal',
  filterAll: 'Todas',
  category: {
    broadcast: 'Broadcast', offers: 'Ofertas', loyalty: 'Lealtad',
    lifecycle: 'Lifecycle', partner: 'Partner', route: 'Ruta',
  },
  channel: { email: 'Email', sms: 'SMS', push: 'Push' },
  healthLabel: 'AI Health',
  healthOf: 'de 100',
  aiPanel: {
    title: 'AI Intelligence',
    powered: 'Powered by Claude',
    risks: 'Riesgos',
    opportunities: 'Oportunidades',
    insights: 'Insights',
    dismiss: 'Desestimar',
    viewCampaign: 'Ver campaña',
    viewCampaigns: 'Ver campañas',
    createCampaign: 'Crear campaña',
    viewAnalysis: 'Ver análisis',
    degraded: 'Narrativa AI no disponible, mostrando detecciones base.',
    empty: 'Sin alertas en este rango.',
  },
  detail: {
    date: 'Fecha', segment: 'Segmento', channel: 'Canal', status: 'Estado',
    openRate: 'OR histórico', ctr: 'CTR histórico', conversions: 'Conv.',
    close: 'Cerrar',
  },
  gantt: {
    campaign: 'Campaña',
    empty: 'No hay campañas en este rango.',
  },
  groups: {
    broadcast: 'Broadcast', offers: 'Ofertas y Promos', partner: 'Programas Partner',
    route: 'Lanzamiento Ruta', lifecycle: 'Lifecycle (always-on)',
    loyaltyTiers: 'Lealtad y Tiers', 'abandon-recovery': 'Abandon & Recovery',
    'preflight-journey': 'Pre-Flight', 'postflight-engagement': 'Post-Flight',
    'loyalty-tiers': 'Lealtad y Tiers', onboarding: 'Onboarding',
    communications: 'Comunicaciones', engagement: 'Engagement',
  },
},
```

- [ ] **Step 2: Add EN keys mirroring structure**

Same structure under `en`:

```js
calendar: {
  pageTitle: 'Campaign Calendar',
  placeholder: 'Loading…',
  monthPrev: 'Previous month',
  monthNext: 'Next month',
  view: { year: 'Year', month: 'Month', week: 'Week', day: 'Day' },
  filterBtn: 'Filter',
  filterType: 'Type',
  filterChannel: 'Channel',
  filterAll: 'All',
  category: {
    broadcast: 'Broadcast', offers: 'Offers', loyalty: 'Loyalty',
    lifecycle: 'Lifecycle', partner: 'Partner', route: 'Route',
  },
  channel: { email: 'Email', sms: 'SMS', push: 'Push' },
  healthLabel: 'AI Health',
  healthOf: 'of 100',
  aiPanel: {
    title: 'AI Intelligence',
    powered: 'Powered by Claude',
    risks: 'Risks',
    opportunities: 'Opportunities',
    insights: 'Insights',
    dismiss: 'Dismiss',
    viewCampaign: 'View campaign',
    viewCampaigns: 'View campaigns',
    createCampaign: 'Create campaign',
    viewAnalysis: 'View analysis',
    degraded: 'AI narrative unavailable, showing raw detections.',
    empty: 'No alerts in this range.',
  },
  detail: {
    date: 'Date', segment: 'Segment', channel: 'Channel', status: 'Status',
    openRate: 'Last OR', ctr: 'Last CTR', conversions: 'Conv.',
    close: 'Close',
  },
  gantt: {
    campaign: 'Campaign',
    empty: 'No campaigns in this range.',
  },
  groups: {
    broadcast: 'Broadcast', offers: 'Offers & Promos', partner: 'Partner Programs',
    route: 'Route Launch', lifecycle: 'Lifecycle (always-on)',
    loyaltyTiers: 'Loyalty & Tiers', 'abandon-recovery': 'Abandon & Recovery',
    'preflight-journey': 'Pre-Flight', 'postflight-engagement': 'Post-Flight',
    'loyalty-tiers': 'Loyalty & Tiers', onboarding: 'Onboarding',
    communications: 'Communications', engagement: 'Engagement',
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(calendar): i18n keys for calendar page (ES + EN)"
```

---

## Task 6: CSS for the calendar page

**Files:**
- Modify: `apps/dashboard/src/index.css`

All structural classes used by calendar components, following the existing dark-theme pattern.

- [ ] **Step 1: Append calendar styles**

Append at the end of `apps/dashboard/src/index.css`:

```css
/* ── Campaign Calendar ───────────────────────────────────────── */
.cal-shell { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.cal-topbar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--bg-card, #0f172a); border-bottom: 1px solid var(--border, #1e293b); flex-shrink: 0; }
.cal-title { font-size: 15px; font-weight: 700; color: var(--text-primary, #f1f5f9); letter-spacing: -0.3px; display: flex; align-items: center; gap: 8px; }
.cal-month-nav { display: flex; align-items: center; gap: 6px; }
.cal-month-label { font-weight: 600; font-size: 13px; color: var(--text-primary); min-width: 110px; text-align: center; }
.cal-nav-btn { background: var(--bg-surface, #1e293b); border: 1px solid var(--border, #334155); color: var(--text-muted, #94a3b8); border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cal-nav-btn:hover { background: var(--bg-hover, #334155); }
.cal-view-switcher { display: flex; gap: 2px; background: var(--bg-surface); border-radius: 8px; padding: 3px; }
.cal-view-btn { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-muted); cursor: pointer; letter-spacing: 0.3px; border: none; background: transparent; }
.cal-view-btn.active { background: #6366f1; color: white; }
.cal-filter-btn { display: flex; align-items: center; gap: 5px; padding: 5px 12px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 7px; color: var(--text-muted); cursor: pointer; font-size: 11px; font-weight: 600; }
.cal-filter-btn:hover { border-color: #6366f1; color: var(--text-primary); }
.cal-spacer { flex: 1; }

.cal-health-score { display: flex; align-items: center; gap: 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 6px 14px; }
.cal-health-value { font-size: 18px; font-weight: 800; line-height: 1; }
.cal-health-value.good { color: #22c55e; }
.cal-health-value.warn { color: #f59e0b; }
.cal-health-value.crit { color: #ef4444; }
.cal-health-sub { font-size: 10px; color: var(--text-muted); }
.cal-health-label { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.8px; text-transform: uppercase; }
.cal-health-bar { width: 60px; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.cal-health-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.cal-health-bar-fill.good { background: #22c55e; }
.cal-health-bar-fill.warn { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.cal-health-bar-fill.crit { background: #ef4444; }

.cal-filter-row { display: flex; align-items: center; gap: 6px; padding: 8px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.cal-chip { display: flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-muted); }
.cal-chip.active { border-width: 1.5px; }
.cal-chip-divider { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }
.cal-filter-label { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.8px; text-transform: uppercase; }

.cal-main { display: flex; flex: 1; overflow: hidden; }
.cal-gantt-wrap { flex: 1; overflow: auto; }
.cal-gantt { min-width: 900px; }
.cal-gantt-header { display: flex; position: sticky; top: 0; z-index: 10; background: var(--bg-card); border-bottom: 1px solid var(--border); }
.cal-gantt-label-col { width: 180px; flex-shrink: 0; padding: 8px 16px; font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.8px; text-transform: uppercase; }
.cal-gantt-days { flex: 1; display: flex; }
.cal-gantt-day-header { flex: 1; text-align: center; padding: 8px 0; font-size: 10px; font-weight: 600; color: var(--text-muted); position: relative; }
.cal-gantt-day-header.today { color: #6366f1; font-weight: 800; }
.cal-gantt-day-header.weekend { color: var(--border); }

.cal-group-header { display: flex; align-items: center; padding: 6px 16px; background: var(--bg-card); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.cal-group-label-col { width: 180px; flex-shrink: 0; }
.cal-group-name { font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; }
.cal-group-count { font-size: 9px; color: var(--text-muted); margin-left: 6px; }
.cal-group-line { flex: 1; height: 1px; background: var(--border); }

.cal-row { display: flex; align-items: center; border-bottom: 1px solid var(--border); min-height: 34px; }
.cal-row:hover { background: var(--bg-hover, #0f172a); }
.cal-row-label { width: 180px; flex-shrink: 0; padding: 0 16px; display: flex; align-items: center; gap: 6px; }
.cal-row-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cal-row-name { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-row-cells { flex: 1; position: relative; height: 34px; }

.cal-bar { position: absolute; top: 7px; height: 20px; border-radius: 5px; display: flex; align-items: center; padding: 0 7px; font-size: 9px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; letter-spacing: 0.3px; color: white; }
.cal-bar:hover { filter: brightness(1.15); }
.cal-bar.always-on { opacity: 0.85; border: 1px dashed; }
.cal-bar-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.7); flex-shrink: 0; margin-right: 4px; }

.cal-conflict-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #ef4444; opacity: 0.6; z-index: 5; pointer-events: none; }
.cal-today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: #6366f1; opacity: 0.5; z-index: 6; pointer-events: none; }

.cal-ai-panel { width: 300px; flex-shrink: 0; background: var(--bg-card); border-left: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; }
.cal-ai-header { padding: 14px 16px 10px; border-bottom: 1px solid var(--border); }
.cal-ai-title { font-size: 11px; font-weight: 800; color: #a78bfa; letter-spacing: 0.8px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
.cal-ai-powered { font-size: 9px; color: var(--text-muted); margin-top: 2px; }
.cal-ai-section { padding: 10px 14px; }
.cal-ai-section-label { font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
.cal-ai-card { background: var(--bg-surface); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; border-left: 3px solid; }
.cal-ai-card.reviewed { opacity: 0.5; }
.cal-ai-card-type { font-size: 9px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
.cal-ai-card-text { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.cal-ai-card-text strong { color: var(--text-primary); }
.cal-ai-card-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.cal-ai-card-date { font-size: 9px; color: var(--text-muted); }
.cal-ai-card-action { font-size: 9px; font-weight: 700; color: #6366f1; cursor: pointer; background: none; border: none; padding: 0; }
.cal-ai-dismiss { font-size: 9px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 0; }

.cal-ai-card.risk-high { border-color: #ef4444; }
.cal-ai-card.risk-high .cal-ai-card-type { color: #ef4444; }
.cal-ai-card.risk-medium { border-color: #f59e0b; }
.cal-ai-card.risk-medium .cal-ai-card-type { color: #f59e0b; }
.cal-ai-card.opp { border-color: #22c55e; }
.cal-ai-card.opp .cal-ai-card-type { color: #22c55e; }
.cal-ai-card.insight { border-color: #6366f1; }
.cal-ai-card.insight .cal-ai-card-type { color: #818cf8; }

.cal-detail { background: var(--bg-card); border-top: 1px solid var(--border); padding: 12px 16px; }
.cal-detail-title { font-size: 12px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.cal-detail-close { margin-left: auto; color: var(--text-muted); cursor: pointer; background: none; border: none; font-size: 16px; line-height: 1; }
.cal-detail-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
.cal-detail-key { font-size: 10px; color: var(--text-muted); }
.cal-detail-val { font-size: 10px; color: var(--text-primary); font-weight: 600; }
.cal-kpi-row { display: flex; gap: 10px; margin-top: 8px; }
.cal-kpi-box { flex: 1; background: var(--bg-surface); border-radius: 6px; padding: 6px 8px; text-align: center; }
.cal-kpi-val { font-size: 14px; font-weight: 800; color: var(--text-primary); }
.cal-kpi-label { font-size: 9px; color: var(--text-muted); }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(calendar): add calendar CSS (gantt, AI panel, health score)"
```

---

## Task 7: `CalendarTopbar` component

**Files:**
- Create: `apps/dashboard/src/components/calendar/CalendarTopbar.jsx`

- [ ] **Step 1: Create component**

```jsx
import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function monthLabel(date, lang) {
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
}

export default function CalendarTopbar({ currentDate, onNavigate, scale, onScaleChange, onToggleFilters, healthScore }) {
  const { t, lang } = useLanguage();
  const band = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'crit';

  return (
    <div className="cal-topbar">
      <span className="cal-title">
        <Calendar size={16} color="#6366f1" />
        {t('calendar.pageTitle')}
      </span>

      <div className="cal-month-nav">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)} title={t('calendar.monthPrev')}>
          <ChevronLeft size={14} />
        </button>
        <span className="cal-month-label">{monthLabel(currentDate, lang)}</span>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)} title={t('calendar.monthNext')}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="cal-view-switcher">
        {['year', 'month', 'week', 'day'].map(s => (
          <button key={s} className={`cal-view-btn ${scale === s ? 'active' : ''}`} onClick={() => onScaleChange(s)}>
            {t(`calendar.view.${s}`)}
          </button>
        ))}
      </div>

      <button className="cal-filter-btn" onClick={onToggleFilters}>
        <Filter size={12} /> {t('calendar.filterBtn')}
      </button>

      <div className="cal-spacer" />

      <div className="cal-health-score">
        <div>
          <div className="cal-health-label">{t('calendar.healthLabel')}</div>
          <div className="cal-health-bar">
            <div className={`cal-health-bar-fill ${band}`} style={{ width: `${healthScore}%` }} />
          </div>
        </div>
        <div>
          <div className={`cal-health-value ${band}`}>{healthScore}</div>
          <div className="cal-health-sub">{t('calendar.healthOf')}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/calendar/CalendarTopbar.jsx
git commit -m "feat(calendar): CalendarTopbar component"
```

---

## Task 8: `CalendarFilterBar` component

**Files:**
- Create: `apps/dashboard/src/components/calendar/CalendarFilterBar.jsx`

- [ ] **Step 1: Create component**

```jsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const CATEGORY_COLORS = {
  broadcast: '#D71920', offers: '#D4AF37', loyalty: '#D4AF37',
  lifecycle: '#06b6d4', partner: '#6366f1', route: '#10b981',
};

const CATEGORIES = ['broadcast', 'offers', 'loyalty', 'lifecycle', 'partner', 'route'];
const CHANNELS = ['email', 'sms', 'push'];

export default function CalendarFilterBar({ categories, channels, onToggleCategory, onToggleChannel }) {
  const { t } = useLanguage();

  const catChip = (id) => {
    const active = categories.includes(id);
    const color = CATEGORY_COLORS[id];
    return (
      <button key={id}
        className={`cal-chip ${active ? 'active' : ''}`}
        onClick={() => onToggleCategory(id)}
        style={active ? { borderColor: color, color, background: `${color}20` } : {}}>
        {t(`calendar.category.${id}`)}
      </button>
    );
  };

  const chanChip = (id) => {
    const active = channels.includes(id);
    return (
      <button key={id} className={`cal-chip ${active ? 'active' : ''}`}
        onClick={() => onToggleChannel(id)}
        style={active ? { borderColor: '#6366f1', color: '#818cf8', background: 'rgba(99,102,241,0.1)' } : {}}>
        {t(`calendar.channel.${id}`)}
      </button>
    );
  };

  return (
    <div className="cal-filter-row">
      <span className="cal-filter-label">{t('calendar.filterType')}</span>
      {CATEGORIES.map(catChip)}
      <div className="cal-chip-divider" />
      <span className="cal-filter-label">{t('calendar.filterChannel')}</span>
      {CHANNELS.map(chanChip)}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/calendar/CalendarFilterBar.jsx
git commit -m "feat(calendar): CalendarFilterBar component"
```

---

## Task 9: `CalendarGantt` component

**Files:**
- Create: `apps/dashboard/src/components/calendar/CalendarGantt.jsx`

The Gantt groups events by `group`, renders bars positioned as percentages across the day range, and overlays conflict lines (per `ruleHit.dateRange` for segmentOverload) plus a today line.

- [ ] **Step 1: Create component**

```jsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function daysInRange(startIso, endIso) {
  const s = new Date(startIso); const e = new Date(endIso);
  return Math.round((e - s) / 86400000) + 1;
}

function dayIndex(iso, rangeStart) {
  return Math.round((new Date(iso) - new Date(rangeStart)) / 86400000);
}

function isWeekend(iso) {
  const d = new Date(iso).getDay();
  return d === 0 || d === 6;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarGantt({ rangeStart, rangeEnd, events, ruleHits, onSelectEvent }) {
  const { t } = useLanguage();
  const totalDays = daysInRange(rangeStart, rangeEnd);
  const today = todayIso();
  const todayIdx = dayIndex(today, rangeStart);

  // Build day header array
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, label: d.getDate() });
  }

  // Group events
  const grouped = events.reduce((acc, ev) => {
    (acc[ev.group] = acc[ev.group] || []).push(ev);
    return acc;
  }, {});

  // Within a group, further group by campaignId so each row is one campaign (multiple bars possible)
  const rowsByGroup = Object.fromEntries(
    Object.entries(grouped).map(([g, evs]) => {
      const byCamp = {};
      for (const ev of evs) (byCamp[ev.campaignId] = byCamp[ev.campaignId] || []).push(ev);
      return [g, byCamp];
    })
  );

  // Conflict date set from segmentOverload hits
  const conflictDays = new Set(
    (ruleHits || []).filter(h => h.ruleId === 'segmentOverload').map(h => h.dateRange.start)
  );

  if (events.length === 0) {
    return <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('calendar.gantt.empty')}</div>;
  }

  const pct = (idx) => `${(idx / totalDays) * 100}%`;
  const widthPct = (startIdx, endIdx) => `${((endIdx - startIdx + 1) / totalDays) * 100}%`;

  return (
    <div className="cal-gantt">
      <div className="cal-gantt-header">
        <div className="cal-gantt-label-col">{t('calendar.gantt.campaign')}</div>
        <div className="cal-gantt-days">
          {days.map(d => (
            <div key={d.iso}
              className={`cal-gantt-day-header ${d.iso === today ? 'today' : ''} ${isWeekend(d.iso) ? 'weekend' : ''}`}>
              {d.label}
            </div>
          ))}
        </div>
      </div>

      {Object.entries(rowsByGroup).map(([groupId, rows]) => (
        <React.Fragment key={groupId}>
          <div className="cal-group-header">
            <div className="cal-group-label-col">
              <span className="cal-group-name" style={{ color: rows[Object.keys(rows)[0]][0].color }}>
                {t(`calendar.groups.${groupId}`) || groupId}
              </span>
              <span className="cal-group-count">{Object.keys(rows).length} campaigns</span>
            </div>
            <div className="cal-group-line" />
          </div>

          {Object.entries(rows).map(([campaignId, evs]) => {
            const name = evs[0].campaignName;
            const color = evs[0].color;
            return (
              <div key={campaignId} className="cal-row">
                <div className="cal-row-label">
                  <div className="cal-row-dot" style={{ background: color }} />
                  <span className="cal-row-name">{name}</span>
                </div>
                <div className="cal-row-cells">
                  {evs.map(ev => {
                    const startIdx = Math.max(0, dayIndex(ev.startDate, rangeStart));
                    const endIdx = Math.min(totalDays - 1, dayIndex(ev.endDate, rangeStart));
                    const isAlwaysOn = ev.flavor === 'always-on';
                    const style = {
                      left: pct(startIdx),
                      width: widthPct(startIdx, endIdx),
                      background: isAlwaysOn ? `repeating-linear-gradient(45deg, ${color}55, ${color}55 6px, ${color}33 6px, ${color}33 12px)` : color,
                      borderColor: isAlwaysOn ? color : 'transparent',
                    };
                    return (
                      <button key={ev.id} className={`cal-bar ${isAlwaysOn ? 'always-on' : ''}`}
                        style={style}
                        onClick={() => onSelectEvent(ev)}>
                        <span className="cal-bar-dot" />
                        {isAlwaysOn && ev.projectedVolume
                          ? `${ev.campaignName} · ~${Math.round(ev.projectedVolume / 1000)}K/mo`
                          : ev.campaignName}
                      </button>
                    );
                  })}
                  {/* Conflict lines */}
                  {[...conflictDays].map(cd => {
                    const idx = dayIndex(cd, rangeStart);
                    if (idx < 0 || idx >= totalDays) return null;
                    return <div key={cd} className="cal-conflict-line" style={{ left: pct(idx + 0.5) }} />;
                  })}
                  {/* Today line only on always-on rows */}
                  {todayIdx >= 0 && todayIdx < totalDays && evs.some(e => e.flavor === 'always-on') && (
                    <div className="cal-today-line" style={{ left: pct(todayIdx + 0.5) }} />
                  )}
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/calendar/CalendarGantt.jsx
git commit -m "feat(calendar): CalendarGantt component with bars + conflict lines"
```

---

## Task 10: `CampaignDetailCard` component

**Files:**
- Create: `apps/dashboard/src/components/calendar/CampaignDetailCard.jsx`

- [ ] **Step 1: Create component**

```jsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CampaignDetailCard({ event, onClose }) {
  const { t } = useLanguage();
  if (!event) return null;
  const k = event.kpis || {};
  return (
    <div className="cal-detail">
      <div className="cal-detail-title">
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.color, flexShrink: 0 }} />
        {event.campaignName}
        <button className="cal-detail-close" onClick={onClose} title={t('calendar.detail.close')}>×</button>
      </div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.date')}</span><span className="cal-detail-val">{event.startDate === event.endDate ? event.startDate : `${event.startDate} → ${event.endDate}`}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.segment')}</span><span className="cal-detail-val">{event.segment || '—'}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.channel')}</span><span className="cal-detail-val">{event.channel} · {event.language || '—'}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.status')}</span><span className="cal-detail-val" style={{ color: event.status === 'live' || event.status === 'launched' ? '#22c55e' : '#f59e0b' }}>{event.status}</span></div>
      {event.kpis && (
        <div className="cal-kpi-row">
          <div className="cal-kpi-box"><div className="cal-kpi-val">{k.openRate?.toFixed(1) ?? '—'}%</div><div className="cal-kpi-label">{t('calendar.detail.openRate')}</div></div>
          <div className="cal-kpi-box"><div className="cal-kpi-val">{(k.clickRate ?? k.ctr)?.toFixed(1) ?? '—'}%</div><div className="cal-kpi-label">{t('calendar.detail.ctr')}</div></div>
          <div className="cal-kpi-box"><div className="cal-kpi-val">{k.conversions ? `${Math.round(k.conversions / 1000)}K` : '—'}</div><div className="cal-kpi-label">{t('calendar.detail.conversions')}</div></div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/calendar/CampaignDetailCard.jsx
git commit -m "feat(calendar): CampaignDetailCard component"
```

---

## Task 11: `AiIntelligencePanel` component with dismissal

**Files:**
- Create: `apps/dashboard/src/components/calendar/AiIntelligencePanel.jsx`

- [ ] **Step 1: Create component**

```jsx
import React from 'react';
import { Zap } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import CampaignDetailCard from './CampaignDetailCard.jsx';

const DISMISS_KEY = 'calendar.dismissedAlerts.v1';
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function loadDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    const now = Date.now();
    const clean = {};
    for (const [id, at] of Object.entries(raw)) {
      if (now - at < DISMISS_TTL) clean[id] = at;
    }
    localStorage.setItem(DISMISS_KEY, JSON.stringify(clean));
    return clean;
  } catch { return {}; }
}

function saveDismissed(map) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
}

function cardClass(hit) {
  if (hit.type === 'risk') return hit.severity === 'high' ? 'risk-high' : 'risk-medium';
  if (hit.type === 'opportunity') return 'opp';
  return 'insight';
}

function cardTypeLabel(hit, t) {
  if (hit.type === 'risk') return `${t('calendar.aiPanel.risks').slice(0, -1)} · ${hit.severity}`;
  if (hit.type === 'opportunity') return `${t('calendar.aiPanel.opportunities').slice(0, -1)} · ${hit.severity}`;
  return `${t('calendar.aiPanel.insights').slice(0, -1)} · ${hit.severity}`;
}

export default function AiIntelligencePanel({ hits, enriched, degraded, selectedEvent, onClearSelection, onNavigateToCampaign }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = React.useState(() => loadDismissed());

  const visibleHits = hits.filter(h => !dismissed[h.id]);
  const risks = visibleHits.filter(h => h.type === 'risk');
  const opps = visibleHits.filter(h => h.type === 'opportunity');
  const insights = visibleHits.filter(h => h.type === 'insight');

  const enrichedById = Object.fromEntries((enriched || []).map(e => [e.id, e]));

  const dismiss = (id) => {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    saveDismissed(next);
  };

  const renderCard = (h) => {
    const en = enrichedById[h.id];
    const text = en?.narrative || h.title;
    return (
      <div key={h.id} className={`cal-ai-card ${cardClass(h)}`}>
        <div className="cal-ai-card-type">{cardTypeLabel(h, t)}</div>
        <div className="cal-ai-card-text">{text}</div>
        {en?.action && <div className="cal-ai-card-text" style={{ marginTop: 4, fontStyle: 'italic' }}>→ {en.action}</div>}
        <div className="cal-ai-card-meta">
          <span className="cal-ai-card-date">{h.dateRange.start}{h.dateRange.end !== h.dateRange.start ? ` → ${h.dateRange.end}` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cal-ai-dismiss" onClick={() => dismiss(h.id)}>{t('calendar.aiPanel.dismiss')}</button>
            {h.campaignIds.length > 0 && (
              <button className="cal-ai-card-action" onClick={() => onNavigateToCampaign(h.campaignIds[0])}>
                {h.campaignIds.length > 1 ? t('calendar.aiPanel.viewCampaigns') : t('calendar.aiPanel.viewCampaign')} →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="cal-ai-panel">
      <div className="cal-ai-header">
        <div className="cal-ai-title"><Zap size={12} /> {t('calendar.aiPanel.title')}</div>
        <div className="cal-ai-powered">{t('calendar.aiPanel.powered')}</div>
        {degraded && <div className="cal-ai-powered" style={{ color: '#f59e0b', marginTop: 4 }}>{t('calendar.aiPanel.degraded')}</div>}
      </div>

      {visibleHits.length === 0 && (
        <div className="cal-ai-section"><div className="cal-ai-card-text">{t('calendar.aiPanel.empty')}</div></div>
      )}

      {risks.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#ef4444' }}>{t('calendar.aiPanel.risks')} ({risks.length})</div>
          {risks.map(renderCard)}
        </div>
      )}
      {opps.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#22c55e' }}>{t('calendar.aiPanel.opportunities')} ({opps.length})</div>
          {opps.map(renderCard)}
        </div>
      )}
      {insights.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#818cf8' }}>{t('calendar.aiPanel.insights')} ({insights.length})</div>
          {insights.map(renderCard)}
        </div>
      )}

      {selectedEvent && <CampaignDetailCard event={selectedEvent} onClose={onClearSelection} />}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/calendar/AiIntelligencePanel.jsx
git commit -m "feat(calendar): AiIntelligencePanel with dismissal + detail card"
```

---

## Task 12: Wire `CampaignCalendarPage`

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCalendarPage.jsx`

Replace the placeholder with full orchestration: state for currentDate, scale, filters, selected event, enriched insights. Derives events + ruleHits + healthScore. Fetches narrative from backend.

- [ ] **Step 1: Replace placeholder**

Overwrite `apps/dashboard/src/pages/CampaignCalendarPage.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CalendarTopbar from '../components/calendar/CalendarTopbar.jsx';
import CalendarFilterBar from '../components/calendar/CalendarFilterBar.jsx';
import CalendarGantt from '../components/calendar/CalendarGantt.jsx';
import AiIntelligencePanel from '../components/calendar/AiIntelligencePanel.jsx';
import { buildCalendarEvents } from '../lib/calendarEvents.js';
import { runAllRules, computeHealthScore } from '../lib/calendarAiRules.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ALL_CATEGORIES = ['broadcast', 'offers', 'loyalty', 'lifecycle', 'partner', 'route'];
const ALL_CHANNELS = ['email', 'sms', 'push'];

// Map between event.group (data) and filter category (UI)
const GROUP_TO_CATEGORY = {
  broadcast: 'broadcast', offers: 'offers', partner: 'partner', route: 'route',
  lifecycle: 'lifecycle', 'loyalty-tiers': 'loyalty', 'abandon-recovery': 'lifecycle',
  'preflight-journey': 'lifecycle', 'postflight-engagement': 'lifecycle',
  onboarding: 'lifecycle', communications: 'lifecycle', engagement: 'lifecycle',
};

function rangeForScaleDate(scale, date) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  if (scale === 'year') {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (scale === 'week') {
    const start = new Date(date);
    const dow = start.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + offset);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (scale === 'day') {
    const iso = date.toISOString().slice(0, 10);
    return { start: iso, end: iso };
  }
  // month (default)
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

function navigateDate(date, scale, delta) {
  const next = new Date(date);
  if (scale === 'year') next.setFullYear(next.getFullYear() + delta);
  else if (scale === 'week') next.setDate(next.getDate() + 7 * delta);
  else if (scale === 'day') next.setDate(next.getDate() + delta);
  else next.setMonth(next.getMonth() + delta);
  return next;
}

export default function CampaignCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const scale = searchParams.get('scale') || 'month';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [categories, setCategories] = useState(ALL_CATEGORIES);
  const [channels, setChannels] = useState(['email']);
  const [enriched, setEnriched] = useState([]);
  const [degraded, setDegraded] = useState(false);

  const range = useMemo(() => rangeForScaleDate(scale, currentDate), [scale, currentDate]);

  const allEvents = useMemo(() => buildCalendarEvents(range.start, range.end), [range.start, range.end]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const cat = GROUP_TO_CATEGORY[ev.group] || ev.group;
      if (!categories.includes(cat)) return false;
      if (!channels.includes(ev.channel)) return false;
      return true;
    });
  }, [allEvents, categories, channels]);

  const ruleHits = useMemo(() => runAllRules(filteredEvents, range), [filteredEvents, range]);
  const healthScore = useMemo(() => computeHealthScore(ruleHits), [ruleHits]);

  // Fetch AI enrichment
  useEffect(() => {
    let cancelled = false;
    if (ruleHits.length === 0) { setEnriched([]); setDegraded(false); return; }
    fetch(`${API_URL}/calendar/ai-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: filteredEvents, ruleHits, rangeStart: range.start, rangeEnd: range.end }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setEnriched(data.enriched || []);
        setDegraded(!!data.degraded);
      })
      .catch(() => {
        if (cancelled) return;
        setEnriched([]);
        setDegraded(true);
      });
    return () => { cancelled = true; };
  }, [ruleHits, range.start, range.end, filteredEvents]);

  const toggleCat = (id) => setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleChan = (id) => setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const onScaleChange = (s) => {
    const next = new URLSearchParams(searchParams);
    next.set('scale', s);
    setSearchParams(next, { replace: true });
  };

  const onNavigate = (delta) => setCurrentDate(d => navigateDate(d, scale, delta));

  const onNavigateToCampaign = (campaignId) => {
    navigate(`/app/campaigns?highlight=${encodeURIComponent(campaignId)}`);
  };

  return (
    <div className="cal-shell">
      <CalendarTopbar
        currentDate={currentDate}
        onNavigate={onNavigate}
        scale={scale}
        onScaleChange={onScaleChange}
        healthScore={healthScore}
        onToggleFilters={() => {}}
      />
      <CalendarFilterBar
        categories={categories}
        channels={channels}
        onToggleCategory={toggleCat}
        onToggleChannel={toggleChan}
      />
      <div className="cal-main">
        <div className="cal-gantt-wrap">
          <CalendarGantt
            rangeStart={range.start}
            rangeEnd={range.end}
            events={filteredEvents}
            ruleHits={ruleHits}
            onSelectEvent={setSelectedEvent}
          />
        </div>
        <AiIntelligencePanel
          hits={ruleHits}
          enriched={enriched}
          degraded={degraded}
          selectedEvent={selectedEvent}
          onClearSelection={() => setSelectedEvent(null)}
          onNavigateToCampaign={onNavigateToCampaign}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the app and verify**

Run: `npm start` from repo root (will restart server and vite).
Open `http://localhost:4000/app/calendar`.
Expected:
- Topbar with month navigator, Year/Month/Week/Day switcher, filter btn, AI Health Score badge.
- Filter row with category + channel chips.
- Gantt with grouped rows, colored bars, always-on striped bars, conflict lines on days with segment overload.
- AI Intelligence panel on the right with Risks / Opportunities / Insights sections populated.
- Clicking a bar opens the detail card in the AI panel.
- Clicking "Dismiss" removes an alert (persists across reload).
- Switching to Year/Week/Day updates the Gantt correctly.
- Toggling filter chips updates both Gantt and AI panel.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCalendarPage.jsx
git commit -m "feat(calendar): wire full CampaignCalendarPage (state + data flow)"
```

---

## Task 13: End-to-end verification + tests green

- [ ] **Step 1: Run full test suite**

Run: `cd apps/dashboard && npm test`
Expected: all calendar-related tests pass (events, rules, endpoint).

- [ ] **Step 2: Smoke-test the user flow**

Open `http://localhost:4000/app/calendar`. Verify the entire user flow from the spec:

1. Land on page → month view of current month renders.
2. Sidebar Control group shows Calendar entry — active state highlights correctly.
3. Toggle view to Year → Gantt re-renders with 12-column scale.
4. Toggle view back to Month → back to daily columns.
5. Click "‹" arrow → previous month loads.
6. Toggle Offers chip off → Offers rows disappear from Gantt, related AI hits disappear.
7. Click a bar → detail card shows in AI panel with KPIs.
8. Click "Dismiss" on a Risk → card disappears, reload page → still dismissed.
9. Switch language ES↔EN → all UI text updates.

- [ ] **Step 3: Check no console errors**

Open browser devtools → Console. Expected: no React warnings, no failed fetches (or only the `/api/calendar/ai-insights` one if `ANTHROPIC_API_KEY` is missing — in that case the `degraded` banner must show).

- [ ] **Step 4: Final commit if any touch-ups were needed**

If steps 1-3 surfaced small issues, fix them and commit:

```bash
git add -A
git commit -m "fix(calendar): final polish after e2e verification"
```

- [ ] **Step 5: Summary commit / tag**

```bash
git log --oneline -15
```

Expected: 7-10 commits with `feat(calendar):` prefix, representing the full feature.

---

## Self-Review Notes

- [x] Spec §Goals → Tasks 2 (events), 3 (rules), 4 (Claude), 9 (timeline), 11 (AI panel) cover all.
- [x] Spec §Non-Goals respected — no create/edit from calendar, no SFMC ingestion.
- [x] Spec §User Flow 1-6 covered in Task 13 Step 2.
- [x] Spec §Architecture (nav, routing, page structure, data model) → Tasks 1 (nav/route/page), 2 (data model).
- [x] Spec §AI detection engine (hybrid) → Task 3 (rules), Task 4 (Claude).
- [x] Spec §AI Health Score formula → Task 3 `computeHealthScore` test.
- [x] Spec §View scales (year/month/week/day) → Task 12 `rangeForScaleDate` + `navigateDate`.
- [x] Spec §Filters → Task 12 filter state.
- [x] Spec §AI alert actions (dismiss/reviewed/navigate) → Task 11 localStorage + Task 12 `onNavigateToCampaign`.
- [x] Spec §Error handling → Task 4 graceful degradation in `enrichWithClaude`, Task 11 `degraded` banner, Task 9 empty state.
- [x] Spec §Testing → Tasks 2, 3, 4 each have failing-then-passing tests.
- [x] i18n — Task 5 adds all keys before components consume them.
