# WhatsApp Campaigns + AutoResearch Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WhatsApp channel tab to the Campaigns Hub and fill the existing AutoResearch page with an autonomous-optimization Lab (Karpathy-style baseline→challenger→learn loop), all with mock data for demo purposes.

**Architecture:** Pure front-end — new mock data files feed new React components. `CampaignsHub.jsx` gets a third tab. `AutoResearch.jsx` gets a new "Lab" tab with experiments, chart, and knowledge base. `CampaignDetail.jsx` gets a WhatsApp-aware branch that renders a `WaMessagesTab`. No changes to `server.js`.

**Tech Stack:** React 19, React Router 7, Recharts 3, lucide-react, CSS custom properties, i18n via `useLanguage()`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/data/emiratesWhatsAppCampaigns.js` | Mock WA campaign data + conversation flows |
| Create | `src/data/autoResearchData.js` | Experiments, knowledge base, log, chart data |
| Create | `src/components/WaTab.jsx` | Summary bar + 2×2 campaign cards grid |
| Create | `src/components/WaCampaignCard.jsx` | Single WA campaign card with phone preview |
| Create | `src/components/WaMessagesTab.jsx` | Conversation flow stepper + message cards |
| Create | `src/components/WaMessageCard.jsx` | Mini phone mockup + config panel |
| Create | `src/components/ResearchLabTab.jsx` | Full AutoResearch Lab UI |
| Create | `src/components/ExperimentCard.jsx` | Baseline vs challenger card |
| Create | `src/components/ResearchChart.jsx` | Recharts line chart for metric improvement |
| Create | `src/components/KnowledgeBasePanel.jsx` | Accumulated learnings table |
| Modify | `src/pages/CampaignsHub.jsx` | Add WhatsApp tab |
| Modify | `src/pages/CampaignDetail.jsx` | Detect `wa-` campaigns, render WA tabs |
| Modify | `src/pages/AutoResearch.jsx` | Add "Lab" tab that renders `ResearchLabTab` |
| Modify | `src/i18n/translations.js` | Add `whatsapp.*` and `researchLab.*` keys (ES + EN) |
| Modify | `src/index.css` | Add `--wa-*` and `--research-*` CSS variables + new classes |

All files are under `apps/dashboard/src/` — prefix omitted in task steps for brevity.

---

## Task 1: Mock data — WA campaigns

**Files:**
- Create: `apps/dashboard/src/data/emiratesWhatsAppCampaigns.js`

- [ ] **Create the file with all 4 campaigns and their conversation flows**

```js
// apps/dashboard/src/data/emiratesWhatsAppCampaigns.js

export const WA_CAMPAIGNS = [
  {
    id: 'wa-miles-expiry',
    name: 'Miles Expiry',
    group: 'Loyalty & Tiers',
    groupColor: '#D4AF37',
    icon: '⚠️',
    status: 'live',
    trigger: 'miles_expiry_days == 7 || 30 || 90',
    audience: 'All Skywards members with expiring miles',
    kpis: { responseRate: 18.7, ctaClickRate: 41.2, conversionRate: 6.1 },
    trends: { responseRate: '+52%', ctaClickRate: '+8%', conversionRate: '+1.4%' },
    autoResearch: { active: true, runNumber: 14, status: 'challenger_winning', lift: 52 },
    preview: {
      message: '⚠️ {{first_name}} — {{miles_balance}} miles vanish in 7 days. That\'s a free LHR flight.',
      quickReplies: ['✈️ Redeem a flight', '🛍️ Browse store', '📅 Extend miles'],
    },
    conversationFlow: ['90d warning', '30d warning', '7d urgent', 'Redemption flow', 'Confirmation'],
    activeFlowStep: 2,
    touches: [
      {
        id: 'touch-7d',
        label: 'Touch 3 — 7 Days Before Expiry',
        trigger: 'miles_expiry_days == 7',
        vars: ['{{first_name}}', '{{miles_balance}}', '{{home_hub}}', '{{top_route}}'],
        quickReplies: ['✈️ Redeem a flight', '🛍️ Browse store', '📅 Extend miles'],
        message: '⚠️ {{first_name}} — {{miles_balance}} miles vanish in 7 days. That\'s a free {{top_route}} flight.',
        kpis: { responseRate: 18.7, ctaClickRate: 41.2, conversionRate: 6.1 },
        autoResearch: { active: true, runNumber: 14, status: 'challenger_winning', lift: 52 },
      },
      {
        id: 'touch-30d',
        label: 'Touch 2 — 30 Days Before Expiry',
        trigger: 'miles_expiry_days == 30',
        vars: ['{{first_name}}', '{{miles_balance}}'],
        quickReplies: ['✈️ Browse flights', '🎁 Gift miles'],
        message: 'Hi {{first_name}}, your {{miles_balance}} miles expire in 30 days. Start planning your next trip.',
        kpis: { responseRate: 9.4, ctaClickRate: 22.1, conversionRate: 2.8 },
        autoResearch: { active: false },
      },
    ],
  },
  {
    id: 'wa-preflight-ancillary',
    name: 'Preflight Ancillary',
    group: 'Pre-Flight Journey',
    groupColor: '#3b82f6',
    icon: '✈️',
    status: 'live',
    trigger: 'hours_before_departure == 72 || 24',
    audience: 'Economy passengers on long-haul routes',
    kpis: { responseRate: 22.4, ctaClickRate: 38.7, conversionRate: 9.2 },
    trends: { responseRate: '+3%', ctaClickRate: '+5%', conversionRate: '+2.1%' },
    autoResearch: { active: true, runNumber: 3, status: 'collecting', lift: null },
    preview: {
      message: '🌟 {{first_name}}, EK {{flight_number}} · {{origin}}→{{destination}} departs in 22 hours. Upgrade?',
      quickReplies: ['🥂 Business — from €450', '💺 Extra legroom', '🧳 Add baggage'],
    },
    conversationFlow: ['72h awareness', '24h close', 'Upgrade flow', 'Confirmation'],
    activeFlowStep: 1,
    touches: [
      {
        id: 'touch-24h',
        label: 'Touch 2 — 24h Before Departure',
        trigger: 'hours_before_departure == 24',
        vars: ['{{first_name}}', '{{flight_number}}', '{{origin}}', '{{destination}}'],
        quickReplies: ['🥂 Business — from €450', '💺 Extra legroom', '🧳 Add baggage', '🍽️ Special meal'],
        message: '🌟 {{first_name}}, EK {{flight_number}} · {{origin}}→{{destination}} departs in 22 hours. Upgrade before it sells out?',
        kpis: { responseRate: 22.4, ctaClickRate: 38.7, conversionRate: 9.2 },
        autoResearch: { active: true, runNumber: 3, status: 'collecting', lift: null },
      },
    ],
  },
  {
    id: 'wa-postflight-nps',
    name: 'Postflight NPS Survey',
    group: 'Post-Flight Engagement',
    groupColor: '#8b5cf6',
    icon: '🛬',
    status: 'live',
    trigger: 'hours_after_landing == 3',
    audience: 'All passengers post-flight',
    kpis: { responseRate: 41.3, ctaClickRate: null, conversionRate: null },
    trends: { responseRate: '3× vs email', completionRate: '+12%' },
    autoResearch: { active: true, runNumber: 5, status: 'challenger_winning', lift: 8.4 },
    preview: {
      message: '🛬 Welcome to {{destination}}, {{first_name}}! How would you rate today\'s flight?',
      quickReplies: ['⭐⭐⭐⭐⭐ Excellent', '⭐⭐⭐⭐ Very good', '⭐⭐⭐ Average', '⭐⭐ Poor'],
    },
    conversationFlow: ['NPS question', 'Follow-up', 'Miles summary'],
    activeFlowStep: 0,
    touches: [
      {
        id: 'touch-nps',
        label: 'Touch 1 — 3h After Landing',
        trigger: 'hours_after_landing == 3',
        vars: ['{{first_name}}', '{{destination}}', '{{flight_number}}'],
        quickReplies: ['⭐⭐⭐⭐⭐ Excellent', '⭐⭐⭐⭐ Very good', '⭐⭐⭐ Average', '⭐⭐ Poor'],
        message: '🛬 Welcome to {{destination}}, {{first_name}}! How would you rate today\'s flight?',
        kpis: { responseRate: 41.3, ctaClickRate: null, conversionRate: null },
        autoResearch: { active: true, runNumber: 5, status: 'challenger_winning', lift: 8.4 },
      },
    ],
  },
  {
    id: 'wa-cart-abandon',
    name: 'Cart / Search Abandon',
    group: 'Abandon & Recovery',
    groupColor: '#ef4444',
    icon: '🛒',
    status: 'testing',
    trigger: 'minutes_since_abandonment == 60',
    audience: 'Users who searched or started booking without completing',
    kpis: { responseRate: 11.2, ctaClickRate: 28.4, conversionRate: null },
    trends: { responseRate: 'Early data', ctaClickRate: 'vs 9.1% base' },
    autoResearch: { active: false, runNumber: 7, status: 'collecting', lift: null },
    preview: {
      message: '✈️ {{first_name}} — only {{seats_remaining}} seats left at {{price}} on your {{origin}}→{{destination}} search.',
      quickReplies: ['💳 Book now', '📅 Other dates', '🏆 Use miles'],
    },
    conversationFlow: ['Abandon alert', 'Alternatives', 'Booking flow'],
    activeFlowStep: 0,
    touches: [
      {
        id: 'touch-abandon',
        label: 'Touch 1 — 60min After Abandonment',
        trigger: 'minutes_since_abandonment == 60',
        vars: ['{{first_name}}', '{{seats_remaining}}', '{{price}}', '{{origin}}', '{{destination}}'],
        quickReplies: ['💳 Book now', '📅 Other dates', '🏆 Use miles'],
        message: '✈️ {{first_name}} — only {{seats_remaining}} seats left at {{price}} on your {{origin}}→{{destination}} search.',
        kpis: { responseRate: 11.2, ctaClickRate: 28.4, conversionRate: null },
        autoResearch: { active: false },
      },
    ],
  },
];
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/data/emiratesWhatsAppCampaigns.js
git commit -m "feat(data): add WA campaigns mock data"
```

---

## Task 2: Mock data — AutoResearch Lab

**Files:**
- Create: `apps/dashboard/src/data/autoResearchData.js`

- [ ] **Create the file**

```js
// apps/dashboard/src/data/autoResearchData.js

export const EXPERIMENTS = [
  {
    id: 'exp-miles-expiry-14',
    campaignId: 'wa-miles-expiry',
    campaignName: 'Miles Expiry',
    channel: 'whatsapp',
    runNumber: 14,
    status: 'running',
    metric: 'responseRate',
    metricLabel: 'Response Rate',
    windowHours: 24,
    hoursRemaining: 2.25,
    hypothesis: 'Leading with name + exact destination increases urgency perception',
    baseline: { text: 'Your 87,500 miles expire in 7 days. Don\'t let them go to waste...', value: 12.3 },
    challenger: { text: '⚠️ Ahmed — 87,500 miles vanish in 7 days. That\'s a free LHR flight...', value: 18.7 },
  },
  {
    id: 'exp-cart-abandon-7',
    campaignId: 'wa-cart-abandon',
    campaignName: 'Cart Abandon',
    channel: 'whatsapp',
    runNumber: 7,
    status: 'collecting',
    metric: 'ctaClickRate',
    metricLabel: 'CTA Click Rate',
    windowHours: 24,
    hoursRemaining: 5.67,
    hypothesis: 'Scarcity signal ("4 seats left") outperforms generic price warning',
    baseline: { text: 'You left a flight to London in your cart. Prices may change...', value: 9.1 },
    challenger: { text: '✈️ James — only 4 seats left at £892 on your DXB→LHR search.', value: 11.2 },
  },
];

export const KNOWLEDGE_BASE = [
  { id: 'kb-1', tag: 'copy', text: "Opening with member's name + exact miles balance outperforms generic openers", lift: '+28%', runCount: 8 },
  { id: 'kb-2', tag: 'timing', text: 'Thursday sends 09:00–11:00 GST get 2× the response rate of Monday sends', lift: '2×', runCount: 5 },
  { id: 'kb-3', tag: 'format', text: '3 quick-reply buttons outperform 4+ options — too many choices reduce response rate', lift: '+17%', runCount: 6 },
  { id: 'kb-4', tag: 'cta', text: 'Destination-specific CTA ("Redeem DXB→LHR") converts better than generic ("View options")', lift: '+34%', runCount: 4 },
  { id: 'kb-5', tag: 'copy', text: 'Messages under 60 words get higher response — longer copy drops after line 2', lift: '+12%', runCount: 7 },
];

export const EXPERIMENT_LOG = [
  { id: 'log-1', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 13, outcome: 'challenger_promoted', delta: '+5.1%' },
  { id: 'log-2', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 12, outcome: 'baseline_kept', delta: '-1.2%' },
  { id: 'log-3', campaignName: 'Cart Abandon', channel: 'whatsapp', runNumber: 6, outcome: 'challenger_promoted', delta: '+3.8%' },
  { id: 'log-4', campaignName: 'Postflight NPS', channel: 'whatsapp', runNumber: 5, outcome: 'challenger_promoted', delta: '+8.4%' },
  { id: 'log-5', campaignName: 'Miles Expiry', channel: 'whatsapp', runNumber: 11, outcome: 'baseline_kept', delta: '-0.7%' },
  { id: 'log-6', campaignName: 'Preflight Ancillary', channel: 'whatsapp', runNumber: 2, outcome: 'inconclusive', delta: '+0.3%' },
];

// Miles Expiry response rate over 14 iterations
export const CHART_DATA = [
  { run: 1, value: 8.1, promoted: false },
  { run: 2, value: 8.9, promoted: false },
  { run: 3, value: 9.8, promoted: true },
  { run: 4, value: 11.2, promoted: true },
  { run: 5, value: 10.7, promoted: false },
  { run: 6, value: 12.1, promoted: true },
  { run: 7, value: 13.4, promoted: true },
  { run: 8, value: 13.1, promoted: false },
  { run: 9, value: 14.6, promoted: true },
  { run: 10, value: 15.8, promoted: true },
  { run: 11, value: 15.2, promoted: false },
  { run: 12, value: 16.9, promoted: true },
  { run: 13, value: 17.8, promoted: true },
  { run: 14, value: 18.7, promoted: true },
];

export const CAMPAIGN_QUEUE = [
  { campaignId: 'wa-miles-expiry', name: 'Miles Expiry', channel: 'whatsapp', runNumber: 14, status: 'running' },
  { campaignId: 'wa-cart-abandon', name: 'Cart Abandon', channel: 'whatsapp', runNumber: 7, status: 'collecting' },
  { campaignId: 'wa-postflight-nps', name: 'Postflight NPS', channel: 'whatsapp', runNumber: 5, status: 'collecting' },
  { campaignId: 'wa-preflight-ancillary', name: 'Preflight Ancillary', channel: 'whatsapp', runNumber: 3, status: 'queued' },
];
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/data/autoResearchData.js
git commit -m "feat(data): add AutoResearch Lab mock data"
```

---

## Task 3: CSS variables and base classes

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Add new CSS variables to the `:root` block** — find the existing `:root {` line and append before the closing `}`:

```css
  /* WhatsApp channel */
  --wa-green: #25d366;
  --wa-green-dim: rgba(37, 211, 102, 0.08);
  --wa-green-border: rgba(37, 211, 102, 0.3);
  --wa-chat-bg: #0b141a;
  --wa-bubble-in: #202c33;
  --wa-header-bg: #1f2c34;

  /* AutoResearch Lab */
  --research-purple: #a78bfa;
  --research-purple-dim: rgba(167, 139, 250, 0.08);
```

- [ ] **Append new utility classes at the end of `index.css`**

```css
/* ── WhatsApp tab ── */
.wa-summary-bar {
  display: flex;
  gap: 14px;
  margin-bottom: 24px;
  align-items: center;
  flex-wrap: wrap;
}
.wa-research-banner {
  flex: 1;
  background: var(--wa-green-dim);
  border: 1px solid var(--wa-green-border);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.wa-research-banner-btn {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--wa-green);
  background: var(--wa-green-dim);
  border: 1px solid var(--wa-green-border);
  border-radius: 8px;
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
}
.wa-research-banner-btn:hover { opacity: 0.8; }

.wa-campaigns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}
.wa-campaign-card {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.2s;
}
.wa-campaign-card:hover { transform: translateY(-1px); }
.wa-campaign-card.has-research { border-color: var(--wa-green-border); }

.wa-badge-research {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--research-purple-dim);
  color: var(--research-purple);
}
.wa-research-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--research-purple);
  animation: wa-pulse 2s infinite;
}
@keyframes wa-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Mini phone mockup */
.wa-mini-phone {
  width: 200px;
  background: #1b1b1e;
  border-radius: 28px;
  border: 2px solid #333;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  overflow: hidden;
  flex-shrink: 0;
}
.wa-phone-header {
  background: var(--wa-header-bg);
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wa-phone-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9972c, #8b6914);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: white; flex-shrink: 0;
}
.wa-phone-body {
  background: var(--wa-chat-bg);
  padding: 8px;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wa-bubble {
  max-width: 90%;
  padding: 6px 8px 14px;
  border-radius: 6px;
  font-size: 0.7rem;
  line-height: 1.4;
  position: relative;
  word-break: break-word;
  align-self: flex-start;
  background: var(--wa-bubble-in);
  color: #e9edef;
  border-top-left-radius: 1px;
}
.wa-bubble-time {
  position: absolute;
  bottom: 2px; right: 6px;
  font-size: 0.55rem;
  color: #8696a0;
}
.wa-qr-list { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.wa-qr-btn {
  background: var(--wa-bubble-in);
  border: 1px solid #2a3942;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 0.65rem;
  color: #53bdeb;
  text-align: center;
}
.wa-phone-input {
  background: var(--wa-header-bg);
  padding: 6px 8px;
  display: flex; align-items: center; gap: 6px;
}
.wa-phone-input-field {
  flex: 1;
  background: #2a3942;
  border-radius: 14px;
  padding: 4px 8px;
  font-size: 0.65rem;
  color: #8696a0;
}

/* Conversation flow stepper */
.wa-flow-stepper {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.wa-flow-step {
  display: flex; align-items: center; gap: 5px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.wa-flow-step.active {
  background: var(--wa-green-dim);
  border-color: var(--wa-green-border);
  color: var(--wa-green);
  font-weight: 600;
}
.wa-flow-step.done { opacity: 0.5; }
.wa-flow-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--wa-green);
}
.wa-flow-arrow { color: var(--border); font-size: 0.8rem; }

/* Message designer card */
.wa-message-designer {
  display: grid;
  grid-template-columns: 210px 1fr;
  gap: 20px;
  align-items: start;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 14px;
}

/* ── AutoResearch Lab ── */
.research-lab-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}
.experiment-card { margin-bottom: 14px; }
.experiment-card.running { border-color: var(--wa-green) !important; box-shadow: 0 0 0 1px var(--wa-green-dim); }
.experiment-variants {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px 16px;
}
.variant-box { border-radius: 8px; padding: 12px; }
.variant-box.baseline { background: var(--surface-hover); border: 1px solid var(--border); }
.variant-box.challenger { background: #0d1f14; border: 1px solid var(--wa-green-border); }
.variant-label {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.variant-box.baseline .variant-label { color: var(--text-muted); }
.variant-box.challenger .variant-label { color: var(--wa-green); }
.variant-text { font-size: 0.75rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; font-style: italic; }
.variant-metric-val { font-size: 1.1rem; font-weight: 800; }
.variant-box.baseline .variant-metric-val { color: var(--text-muted); }
.variant-box.challenger .variant-metric-val { color: var(--wa-green); }
.winning-badge {
  display: inline-block;
  background: var(--wa-green);
  color: #0b1a11;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 6px;
  vertical-align: middle;
}

.kb-tag-copy { background: var(--research-purple-dim); color: var(--research-purple); }
.kb-tag-timing { background: rgba(245,158,11,0.08); color: #f59e0b; }
.kb-tag-format { background: rgba(96,165,250,0.08); color: #60a5fa; }
.kb-tag-cta { background: var(--wa-green-dim); color: var(--wa-green); }

.log-outcome-dot {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 800; flex-shrink: 0;
}
.log-outcome-dot.promoted { background: var(--wa-green-dim); color: var(--wa-green); }
.log-outcome-dot.kept { background: rgba(248,113,113,0.08); color: #f87171; }
.log-outcome-dot.inconclusive { background: rgba(245,158,11,0.08); color: #f59e0b; }

.research-insight-box {
  background: #0d1f14;
  border: 1px solid var(--wa-green-border);
  border-radius: 12px;
  padding: 14px;
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(css): add WA and AutoResearch Lab styles"
```

---

## Task 4: i18n keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Add Spanish keys** — find the `es` object's last section (before the closing `}`) and append:

```js
    whatsapp: {
      tabLabel: '💬 WhatsApp',
      newBadge: 'NUEVO',
      summaryLive: 'campañas en vivo',
      summaryTesting: 'en pruebas',
      summaryAvgResponse: 'respuesta media',
      researchBannerTitle: 'AutoResearch activo en {n} campañas',
      researchBannerSub: 'Challenger de Miles Expiry +52% — promocionando a baseline en 2h',
      researchBannerBtn: 'Abrir Lab →',
      responseRate: 'Tasa respuesta',
      ctaClickRate: 'Clicks CTA',
      conversionRate: 'Conversión',
      viewInLab: 'Ver en Research Lab →',
      addToLab: 'Añadir a Research Lab →',
      conversationFlow: 'Flujo de conversación',
      trigger: 'Trigger',
      personalisationVars: 'Variables personalizacion',
      quickReplies: 'Quick replies',
      performance: 'Rendimiento',
      addToResearch: 'Añadir a AutoResearch para optimizar este touch',
    },
    researchLab: {
      tabLabel: 'Lab de Optimización',
      title: '🔬 AutoResearch Lab',
      subtitle: 'Optimización autónoma al estilo Karpathy — baseline → challenger → aprender → repetir',
      statRunning: 'En ejecución',
      statIterations: 'Iteraciones',
      statAvgLift: 'Mejora media',
      activeExperiments: 'Experimentos activos',
      baseline: 'Baseline',
      challenger: 'Challenger',
      winning: 'GANANDO',
      hypothesis: 'Hipótesis',
      hoursRemaining: 'h restantes',
      metricImprovement: 'Mejora de métrica',
      chartSub: 'Cada punto = un experimento. Verde = challenger promovido.',
      knowledgeBase: 'Base de conocimiento acumulado',
      kbSubtitle: 'Lo que el agente ha aprendido sobre copy de WhatsApp',
      kbCount: 'aprendizajes',
      recentLog: 'Log de experimentos recientes',
      campaignQueue: 'Cola de campañas',
      addCampaign: '+ Añadir campaña',
      agentInsight: 'Observación del agente',
      tagCopy: 'Copy',
      tagTiming: 'Timing',
      tagFormat: 'Formato',
      tagCta: 'CTA',
      outcomePromoted: 'C',
      outcomeKept: 'B',
      outcomeInconclusive: '~',
      statusRunning: '● Ejecutando',
      statusCollecting: '⏳ Recogiendo datos',
      statusQueued: '– En cola',
    },
```

- [ ] **Add English keys** — find the `en` object's last section and append:

```js
    whatsapp: {
      tabLabel: '💬 WhatsApp',
      newBadge: 'NEW',
      summaryLive: 'live campaigns',
      summaryTesting: 'in testing',
      summaryAvgResponse: 'avg response rate',
      researchBannerTitle: 'AutoResearch running on {n} campaigns',
      researchBannerSub: 'Miles Expiry challenger up +52% — promoting to baseline in 2h',
      researchBannerBtn: 'Open Lab →',
      responseRate: 'Response rate',
      ctaClickRate: 'CTA click rate',
      conversionRate: 'Conversion',
      viewInLab: 'View in Research Lab →',
      addToLab: 'Add to Research Lab →',
      conversationFlow: 'Conversation Flow',
      trigger: 'Trigger',
      personalisationVars: 'Personalisation vars',
      quickReplies: 'Quick replies',
      performance: 'Performance',
      addToResearch: 'Add to AutoResearch to start optimising this touch',
    },
    researchLab: {
      tabLabel: 'Optimization Lab',
      title: '🔬 AutoResearch Lab',
      subtitle: 'Karpathy-style autonomous campaign optimisation — baseline → challenger → learn → repeat',
      statRunning: 'Running',
      statIterations: 'Iterations',
      statAvgLift: 'Avg lift',
      activeExperiments: 'Active Experiments',
      baseline: 'Baseline',
      challenger: 'Challenger',
      winning: 'WINNING',
      hypothesis: 'Hypothesis',
      hoursRemaining: 'h remaining',
      metricImprovement: 'Metric Improvement',
      chartSub: 'Each dot = one experiment run. Green = challenger promoted.',
      knowledgeBase: 'Knowledge Base — Accumulated Learnings',
      kbSubtitle: 'What the agent has learned about WhatsApp copy',
      kbCount: 'learnings',
      recentLog: 'Recent Experiment Log',
      campaignQueue: 'Campaign Queue',
      addCampaign: '+ Add campaign',
      agentInsight: 'Agent insight',
      tagCopy: 'Copy',
      tagTiming: 'Timing',
      tagFormat: 'Format',
      tagCta: 'CTA',
      outcomePromoted: 'C',
      outcomeKept: 'B',
      outcomeInconclusive: '~',
      statusRunning: '● Running',
      statusCollecting: '⏳ Collecting',
      statusQueued: '– Queued',
    },
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add whatsapp and researchLab translation keys"
```

---

## Task 5: WaCampaignCard component

**Files:**
- Create: `apps/dashboard/src/components/WaCampaignCard.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/WaCampaignCard.jsx
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WaCampaignCard({ campaign }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const statusColors = { live: '#25d366', testing: '#f59e0b', draft: '#666' };
  const statusColor = statusColors[campaign.status] || '#666';

  function formatMetric(value) {
    if (value === null || value === undefined) return '—';
    return `${value}%`;
  }

  return (
    <div
      className={`card wa-campaign-card animate-fade-in ${campaign.autoResearch.active ? 'has-research' : ''}`}
      onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
    >
      {/* Header */}
      <div className="campaign-card-header" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${campaign.groupColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
          }}>
            {campaign.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{campaign.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{campaign.group}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span className="campaign-status-badge" style={{
            background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40`,
          }}>
            ● {campaign.status}
          </span>
          {campaign.autoResearch.active && (
            <span className="wa-badge-research">
              <span className="wa-research-dot" />
              AutoResearch
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="campaign-kpi-row" style={{ marginBottom: 12 }}>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value" style={{ color: 'var(--wa-green)' }}>
            {formatMetric(campaign.kpis.responseRate)}
          </span>
          <span className="campaign-kpi-label">{t('whatsapp.responseRate')}</span>
        </span>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value">{formatMetric(campaign.kpis.ctaClickRate)}</span>
          <span className="campaign-kpi-label">{t('whatsapp.ctaClickRate')}</span>
        </span>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value">{formatMetric(campaign.kpis.conversionRate)}</span>
          <span className="campaign-kpi-label">{t('whatsapp.conversionRate')}</span>
        </span>
      </div>

      {/* Phone preview */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          background: 'var(--wa-green-dim)',
          border: '1px solid var(--wa-green-border)',
          borderRadius: 8,
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', flexShrink: 0, marginTop: 2,
        }}>
          💬
        </div>
        <div style={{
          background: 'var(--wa-bubble-in)',
          borderRadius: '0 8px 8px 8px',
          padding: '7px 10px',
          fontSize: '0.72rem', color: 'var(--text-secondary)',
          lineHeight: 1.4, flex: 1,
        }}>
          {campaign.preview.message}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
            {campaign.preview.quickReplies.slice(0, 3).map((qr, i) => (
              <span key={i} style={{
                background: '#2a3942', border: '1px solid #3a4952',
                borderRadius: 4, padding: '2px 6px',
                fontSize: '0.6rem', color: '#53bdeb',
              }}>
                {qr}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 10, borderTop: '1px solid var(--border)',
        fontSize: '0.72rem',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {campaign.autoResearch.active
            ? `Run #${campaign.autoResearch.runNumber} · ${campaign.autoResearch.status === 'challenger_winning' ? `Challenger +${campaign.autoResearch.lift}%` : 'Collecting data'}`
            : `Run #${campaign.autoResearch.runNumber} · Collecting data`
          }
        </span>
        <span style={{ color: 'var(--research-purple)', fontWeight: 600, cursor: 'pointer' }}>
          {campaign.autoResearch.active ? t('whatsapp.viewInLab') : t('whatsapp.addToLab')}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/WaCampaignCard.jsx
git commit -m "feat(component): add WaCampaignCard"
```

---

## Task 6: WaTab component

**Files:**
- Create: `apps/dashboard/src/components/WaTab.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/WaTab.jsx
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { WA_CAMPAIGNS } from '../data/emiratesWhatsAppCampaigns.js';
import WaCampaignCard from './WaCampaignCard.jsx';

export default function WaTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const liveCount = WA_CAMPAIGNS.filter(c => c.status === 'live').length;
  const testingCount = WA_CAMPAIGNS.filter(c => c.status === 'testing').length;
  const avgResponse = (
    WA_CAMPAIGNS.filter(c => c.kpis.responseRate).reduce((s, c) => s + c.kpis.responseRate, 0) /
    WA_CAMPAIGNS.filter(c => c.kpis.responseRate).length
  ).toFixed(1);
  const researchCount = WA_CAMPAIGNS.filter(c => c.autoResearch.active).length;

  return (
    <>
      {/* Summary bar */}
      <section className="wa-summary-bar">
        <div className="stat-chip">
          <strong>{liveCount}</strong>&nbsp;{t('whatsapp.summaryLive')}
        </div>
        <div className="stat-chip">
          <strong>{testingCount}</strong>&nbsp;{t('whatsapp.summaryTesting')}
        </div>
        <div className="stat-chip stat-chip-active">
          <strong>{avgResponse}%</strong>&nbsp;{t('whatsapp.summaryAvgResponse')}
        </div>
        <div className="wa-research-banner">
          <span style={{ fontSize: '1.2rem' }}>🔬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--wa-green)', marginBottom: 2 }}>
              {t('whatsapp.researchBannerTitle').replace('{n}', researchCount)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('whatsapp.researchBannerSub')}
            </div>
          </div>
          <button
            className="wa-research-banner-btn"
            onClick={e => { e.stopPropagation(); navigate('/app/research'); }}
          >
            {t('whatsapp.researchBannerBtn')}
          </button>
        </div>
      </section>

      {/* Cards grid */}
      <div className="wa-campaigns-grid">
        {WA_CAMPAIGNS.map(campaign => (
          <WaCampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/WaTab.jsx
git commit -m "feat(component): add WaTab"
```

---

## Task 7: Add WhatsApp tab to CampaignsHub

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignsHub.jsx`

- [ ] **Add import at the top** — after the existing imports:

```jsx
import WaTab from '../components/WaTab.jsx';
```

- [ ] **Replace the tab state initializer** (line 17) — change `'bau'` to stay `'bau'` (no change needed). Just add `'whatsapp'` as a valid state value in the toggle.

- [ ] **Replace the tab toggle block** — find the `<div className="weekly-view-toggle"` block and replace it with:

```jsx
{/* Tab toggle */}
<div className="weekly-view-toggle" style={{ marginBottom: 24 }}>
    <button
        className={`weekly-toggle-btn ${tab === 'bau' ? 'active' : ''}`}
        onClick={() => setTab('bau')}
    >
        {t('campaigns.bauTab')} ({BAU_CAMPAIGN_TYPES.length})
    </button>
    <button
        className={`weekly-toggle-btn ${tab === 'lifecycle' ? 'active' : ''}`}
        onClick={() => setTab('lifecycle')}
    >
        {t('campaigns.lifecycleTab')} ({CAMPAIGNS.length})
    </button>
    <button
        className={`weekly-toggle-btn ${tab === 'whatsapp' ? 'active' : ''}`}
        onClick={() => setTab('whatsapp')}
        style={tab === 'whatsapp' ? { borderColor: 'var(--wa-green)', color: 'var(--wa-green)' } : {}}
    >
        {t('whatsapp.tabLabel')}&nbsp;
        <span style={{
            fontSize: '0.6rem', fontWeight: 800, background: 'var(--wa-green)',
            color: '#0b1a11', padding: '1px 5px', borderRadius: 6, verticalAlign: 'middle',
        }}>
            {t('whatsapp.newBadge')}
        </span>
    </button>
</div>
```

- [ ] **Add WhatsApp tab content** — after the closing `)}` of the Lifecycle tab block, before the outer `</div>`:

```jsx
{/* ─── WHATSAPP TAB ─── */}
{tab === 'whatsapp' && <WaTab />}
```

- [ ] **Verify in browser** — navigate to `/app/campaigns`. You should see three tabs. Clicking WhatsApp shows 4 campaign cards with green accents.

- [ ] **Commit**

```bash
git add apps/dashboard/src/pages/CampaignsHub.jsx
git commit -m "feat(campaigns): add WhatsApp tab to CampaignsHub"
```

---

## Task 8: WaMessageCard component

**Files:**
- Create: `apps/dashboard/src/components/WaMessageCard.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/WaMessageCard.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WaMessageCard({ touch }) {
  const { t } = useLanguage();

  function formatMetric(value) {
    return value !== null && value !== undefined ? `${value}%` : '—';
  }

  return (
    <div className="wa-message-designer">
      {/* Mini phone */}
      <div>
        {touch.autoResearch?.active && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--research-purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Challenger
            </span>
            {touch.autoResearch.lift && (
              <span style={{ background: 'var(--wa-green)', color: '#0b1a11', fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>
                WINNING +{touch.autoResearch.lift}%
              </span>
            )}
          </div>
        )}
        {!touch.autoResearch?.active && (
          <div style={{ marginBottom: 8, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('researchLab.baseline')}
            {touch.autoResearch?.runNumber && (
              <span style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', fontSize: '0.6rem', padding: '1px 6px', borderRadius: 8, marginLeft: 6, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                {touch.autoResearch?.status ?? 'baseline'}
              </span>
            )}
          </div>
        )}
        <div className="wa-mini-phone">
          <div className="wa-phone-header">
            <div className="wa-phone-avatar">E</div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e9edef' }}>Emirates Skywards ✓</div>
              <div style={{ fontSize: '0.6rem', color: '#8696a0' }}>Business Account</div>
            </div>
          </div>
          <div className="wa-phone-body">
            <div className="wa-bubble">
              {touch.message}
              <div className="wa-bubble-time">now ✓✓</div>
            </div>
            <div className="wa-qr-list">
              {touch.quickReplies.map((qr, i) => (
                <div key={i} className="wa-qr-btn">{qr}</div>
              ))}
            </div>
          </div>
          <div className="wa-phone-input">
            <div className="wa-phone-input-field">Type a message...</div>
            <div style={{ width: 22, height: 22, background: 'var(--wa-green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🎤</div>
          </div>
        </div>
      </div>

      {/* Config panel */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.trigger')}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--research-purple)', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
            {touch.trigger}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.personalisationVars')}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {touch.vars.map((v, i) => (
              <span key={i} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 8, background: 'var(--research-purple-dim)', color: 'var(--research-purple)' }}>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.performance')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: formatMetric(touch.kpis.responseRate), lbl: t('whatsapp.responseRate') },
              { val: formatMetric(touch.kpis.ctaClickRate), lbl: t('whatsapp.ctaClickRate') },
              { val: formatMetric(touch.kpis.conversionRate), lbl: t('whatsapp.conversionRate') },
            ].map(({ val, lbl }) => (
              <div key={lbl} style={{ flex: 1, background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{val}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {!touch.autoResearch?.active && (
          <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-hover)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            🔬 {t('whatsapp.addToResearch')}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/WaMessageCard.jsx
git commit -m "feat(component): add WaMessageCard"
```

---

## Task 9: WaMessagesTab component

**Files:**
- Create: `apps/dashboard/src/components/WaMessagesTab.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/WaMessagesTab.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';
import WaMessageCard from './WaMessageCard.jsx';

export default function WaMessagesTab({ campaign }) {
  const { t } = useLanguage();

  return (
    <div>
      {/* Conversation flow stepper */}
      <div style={{ marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {t('whatsapp.conversationFlow')}
      </div>
      <div className="wa-flow-stepper">
        {campaign.conversationFlow.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`wa-flow-step ${i === campaign.activeFlowStep ? 'active' : i < campaign.activeFlowStep ? 'done' : ''}`}>
              {i === campaign.activeFlowStep && <span className="wa-flow-dot" />}
              {step}
            </div>
            {i < campaign.conversationFlow.length - 1 && (
              <span className="wa-flow-arrow">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Touch cards */}
      {campaign.touches.map(touch => (
        <div key={touch.id}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            {touch.label}
            {touch.autoResearch?.active && (
              <span style={{ fontSize: '0.7rem', color: 'var(--wa-green)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                (currently running in AutoResearch)
              </span>
            )}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <WaMessageCard touch={touch} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/WaMessagesTab.jsx
git commit -m "feat(component): add WaMessagesTab"
```

---

## Task 10: Extend CampaignDetail for WhatsApp campaigns

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignDetail.jsx`

- [ ] **Add imports** after the existing import block:

```jsx
import { WA_CAMPAIGNS } from '../data/emiratesWhatsAppCampaigns.js';
import WaMessagesTab from '../components/WaMessagesTab.jsx';
```

- [ ] **Add WA campaign lookup** — after line 17 (`const campaign = CAMPAIGNS.find(...)`):

```jsx
const waCampaign = WA_CAMPAIGNS.find(c => c.id === campaignId);
const isWa = Boolean(waCampaign);
```

- [ ] **Replace the `if (!campaign)` guard** to also handle WA campaigns:

```jsx
if (!campaign && !waCampaign) {
    return (
        <div className="dashboard-container animate-fade-in">
            <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                ← {t('campaigns.backToCampaigns')}
            </button>
            <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 24 }}>
                <p style={{ color: 'var(--text-muted)' }}>{t('campaigns.notFound')}</p>
            </div>
        </div>
    );
}
```

- [ ] **Add WA early return** — directly after the guard above, add a WA-specific render:

```jsx
if (isWa) {
    return (
        <div className="dashboard-container animate-fade-in">
            <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                ← {t('campaigns.backToCampaigns')}
            </button>

            {/* WA Campaign header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 0 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${waCampaign.groupColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                    {waCampaign.icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{waCampaign.name}</h1>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--wa-green-dim)', color: 'var(--wa-green)', border: '1px solid var(--wa-green-border)' }}>
                            💬 WhatsApp
                        </span>
                        <span className="campaign-status-badge live">● {waCampaign.status}</span>
                        {waCampaign.autoResearch.active && (
                            <span className="wa-badge-research"><span className="wa-research-dot" /> AutoResearch</span>
                        )}
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {waCampaign.group} · {waCampaign.trigger}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="kb-tabs" style={{ marginTop: 16, marginBottom: 20 }}>
                {['overview', 'messages', 'autoresearch'].map(tab => (
                    <button
                        key={tab}
                        className={`kb-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {tab === 'messages' ? 'Messages' : tab === 'autoresearch' ? 'AutoResearch' : 'Overview'}
                    </button>
                ))}
            </div>

            {/* Overview tab */}
            {activeTab === 'overview' && (
                <div className="workspace-stats-bar" style={{ flexWrap: 'wrap' }}>
                    <div className="stat-chip stat-chip-active">
                        <strong style={{ color: 'var(--wa-green)' }}>{waCampaign.kpis.responseRate}%</strong>&nbsp;{t('whatsapp.responseRate')}
                    </div>
                    {waCampaign.kpis.ctaClickRate && (
                        <div className="stat-chip"><strong>{waCampaign.kpis.ctaClickRate}%</strong>&nbsp;{t('whatsapp.ctaClickRate')}</div>
                    )}
                    {waCampaign.kpis.conversionRate && (
                        <div className="stat-chip"><strong>{waCampaign.kpis.conversionRate}%</strong>&nbsp;{t('whatsapp.conversionRate')}</div>
                    )}
                </div>
            )}

            {/* Messages tab */}
            {activeTab === 'messages' && <WaMessagesTab campaign={waCampaign} />}

            {/* AutoResearch tab */}
            {activeTab === 'autoresearch' && (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>🔬</div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                        {waCampaign.autoResearch.active
                            ? `Run #${waCampaign.autoResearch.runNumber} active — challenger up +${waCampaign.autoResearch.lift}%`
                            : 'Not yet enrolled in AutoResearch.'}
                    </p>
                    <button className="kb-action-btn" onClick={() => navigate('/app/research')}>
                        Open Research Lab →
                    </button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Verify** — click a WA campaign card from the WhatsApp tab. Should show the WA detail page with Messages tab and phone mockups.

- [ ] **Commit**

```bash
git add apps/dashboard/src/pages/CampaignDetail.jsx
git commit -m "feat(campaigns): WhatsApp campaign detail page with Messages tab"
```

---

## Task 11: ResearchChart component

**Files:**
- Create: `apps/dashboard/src/components/ResearchChart.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/ResearchChart.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, Area, AreaChart } from 'recharts';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CHART_DATA } from '../data/autoResearchData.js';

export default function ResearchChart() {
  const { t } = useLanguage();

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const color = payload.promoted ? '#25d366' : '#f87171';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="none" />;
  };

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
        {t('researchLab.metricImprovement')} — Miles Expiry
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('researchLab.chartSub')}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={CHART_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="researchGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#25d366" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="run" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} label={{ value: 'Run', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}
            formatter={(v) => [`${v}%`, 'Response Rate']}
            labelFormatter={(l) => `Run ${l}`}
          />
          <Area type="monotone" dataKey="value" stroke="#25d366" strokeWidth={2} fill="url(#researchGradient)" dot={<CustomDot />} />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
        {[
          { color: '#25d366', label: 'Challenger promoted' },
          { color: '#f87171', label: 'Baseline kept' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/ResearchChart.jsx
git commit -m "feat(component): add ResearchChart"
```

---

## Task 12: ExperimentCard component

**Files:**
- Create: `apps/dashboard/src/components/ExperimentCard.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/ExperimentCard.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ExperimentCard({ experiment }) {
  const { t } = useLanguage();
  const isRunning = experiment.status === 'running';
  const challengerWinning = experiment.challenger.value > experiment.baseline.value;

  return (
    <div className={`card experiment-card ${isRunning ? 'running' : ''}`} style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--wa-green-dim)', color: 'var(--wa-green)' }}>
          💬 WhatsApp
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{experiment.campaignName}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Run #{experiment.runNumber}</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: isRunning ? 'var(--wa-green-dim)' : 'rgba(245,158,11,0.08)', color: isRunning ? 'var(--wa-green)' : '#f59e0b' }}>
          {isRunning ? '● Running' : '⏳ Collecting'}
        </span>
      </div>

      {/* Variants */}
      <div className="experiment-variants">
        <div className="variant-box baseline">
          <div className="variant-label">{t('researchLab.baseline')}</div>
          <div className="variant-text">"{experiment.baseline.text}"</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="variant-metric-val">{experiment.baseline.value}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{experiment.metricLabel}</span>
          </div>
        </div>
        <div className="variant-box challenger">
          <div className="variant-label">
            {t('researchLab.challenger')}
            {challengerWinning && <span className="winning-badge">{t('researchLab.winning')}</span>}
          </div>
          <div className="variant-text">"{experiment.challenger.text}"</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="variant-metric-val">{experiment.challenger.value}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{experiment.metricLabel}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', background: 'var(--surface-hover)', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{t('researchLab.hypothesis')}: <strong style={{ color: 'var(--research-purple)' }}>{experiment.hypothesis}</strong></span>
        <span>{experiment.hoursRemaining.toFixed(1)}{t('researchLab.hoursRemaining')}</span>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/ExperimentCard.jsx
git commit -m "feat(component): add ExperimentCard"
```

---

## Task 13: KnowledgeBasePanel component

**Files:**
- Create: `apps/dashboard/src/components/KnowledgeBasePanel.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/KnowledgeBasePanel.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { KNOWLEDGE_BASE } from '../data/autoResearchData.js';

const TAG_CLASSES = { copy: 'kb-tag-copy', timing: 'kb-tag-timing', format: 'kb-tag-format', cta: 'kb-tag-cta' };

export default function KnowledgeBasePanel() {
  const { t } = useLanguage();

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('researchLab.knowledgeBase')}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {KNOWLEDGE_BASE.length} {t('researchLab.kbCount')}
        </div>
      </div>
      {KNOWLEDGE_BASE.map(item => (
        <div key={item.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span className={`campaign-kpi-chip ${TAG_CLASSES[item.tag] || ''}`} style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
            {t(`researchLab.tag${item.tag.charAt(0).toUpperCase() + item.tag.slice(1)}`)}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
            {item.text}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--wa-green)', flexShrink: 0 }}>
            {item.lift}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/KnowledgeBasePanel.jsx
git commit -m "feat(component): add KnowledgeBasePanel"
```

---

## Task 14: ResearchLabTab component

**Files:**
- Create: `apps/dashboard/src/components/ResearchLabTab.jsx`

- [ ] **Create the component**

```jsx
// apps/dashboard/src/components/ResearchLabTab.jsx
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { EXPERIMENTS, EXPERIMENT_LOG, CAMPAIGN_QUEUE } from '../data/autoResearchData.js';
import ExperimentCard from './ExperimentCard.jsx';
import ResearchChart from './ResearchChart.jsx';
import KnowledgeBasePanel from './KnowledgeBasePanel.jsx';

const OUTCOME_CONFIG = {
  challenger_promoted: { cls: 'promoted', label: 'C' },
  baseline_kept: { cls: 'kept', label: 'B' },
  inconclusive: { cls: 'inconclusive', label: '~' },
};

const QUEUE_STATUS_CONFIG = {
  running: { color: 'var(--wa-green)', label: '● Running' },
  collecting: { color: '#f59e0b', label: '⏳ Collecting' },
  queued: { color: 'var(--text-muted)', label: '– Queued' },
};

export default function ResearchLabTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const runningCount = EXPERIMENTS.filter(e => e.status === 'running').length + EXPERIMENTS.filter(e => e.status === 'collecting').length;

  return (
    <div>
      {/* Header stats */}
      <section className="workspace-stats-bar" style={{ marginBottom: 20 }}>
        <div className="stat-chip stat-chip-active">
          <strong style={{ color: 'var(--wa-green)' }}>{EXPERIMENTS.length}</strong>&nbsp;{t('researchLab.statRunning')}
        </div>
        <div className="stat-chip">
          <strong>127</strong>&nbsp;{t('researchLab.statIterations')}
        </div>
        <div className="stat-chip">
          <strong style={{ color: 'var(--wa-green)' }}>+34%</strong>&nbsp;{t('researchLab.statAvgLift')}
        </div>
      </section>

      <div className="research-lab-grid">

        {/* Left column */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('researchLab.activeExperiments')}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {EXPERIMENTS.map(exp => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}

          <ResearchChart />

          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('researchLab.knowledgeBase')}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <KnowledgeBasePanel />
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Experiment log */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem' }}>
              {t('researchLab.recentLog')}
            </div>
            {EXPERIMENT_LOG.map(log => {
              const cfg = OUTCOME_CONFIG[log.outcome] || OUTCOME_CONFIG.inconclusive;
              const isPos = log.delta.startsWith('+');
              return (
                <div key={log.id} style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem' }}>
                  <div className={`log-outcome-dot ${cfg.cls}`}>{cfg.label}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.campaignName} — Run {log.runNumber}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                      {log.outcome === 'challenger_promoted' ? 'Challenger promoted' : log.outcome === 'baseline_kept' ? 'Baseline kept' : 'Inconclusive'} · 💬 WA
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: isPos ? 'var(--wa-green)' : '#f87171' }}>{log.delta}</span>
                </div>
              );
            })}
          </div>

          {/* Campaign queue */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('researchLab.campaignQueue')}
              <span style={{ fontSize: '0.72rem', color: 'var(--research-purple)', cursor: 'pointer' }}>{t('researchLab.addCampaign')}</span>
            </div>
            {CAMPAIGN_QUEUE.map(item => {
              const cfg = QUEUE_STATUS_CONFIG[item.status] || QUEUE_STATUS_CONFIG.queued;
              return (
                <div
                  key={item.campaignId}
                  style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => navigate(`/app/campaigns/${item.campaignId}`)}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>💬 WhatsApp · Run #{item.runNumber}</div>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Agent insight */}
          <div className="research-insight-box">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--wa-green)', marginBottom: 8 }}>
              🧠 {t('researchLab.agentInsight')} — just now
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Run #14 challenger is trending <strong style={{ color: 'var(--text-primary)' }}>+52% above baseline</strong>. If it holds, <strong style={{ color: 'var(--text-primary)' }}>Thursday 09:30 GST + name-first copy</strong> becomes the new default for all WhatsApp expiry campaigns.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/dashboard/src/components/ResearchLabTab.jsx
git commit -m "feat(component): add ResearchLabTab"
```

---

## Task 15: Wire ResearchLabTab into AutoResearch page

**Files:**
- Modify: `apps/dashboard/src/pages/AutoResearch.jsx`

- [ ] **Add import** after the existing imports:

```jsx
import ResearchLabTab from '../components/ResearchLabTab.jsx';
```

- [ ] **Add 'lab' to the TABS array** — replace the existing `TABS` constant:

```jsx
const TABS = [
    { id: 'concept', label: t('autoExperiment.tabConcept') },
    { id: 'research', label: t('autoExperiment.tabResearch') },
    { id: 'experiments', label: t('autoExperiment.tabExperiments') },
    { id: 'lab', label: t('researchLab.tabLabel') },
];
```

- [ ] **Add the Lab tab render** — after the `{activeTab === 'experiments' && <AutoExperimentDashboard />}` block:

```jsx
{/* Tab: Lab */}
{activeTab === 'lab' && <ResearchLabTab />}
```

- [ ] **Verify in browser** — navigate to `/app/research`. You should see a new "Optimization Lab" tab. Clicking it shows the full lab with experiments, chart, knowledge base, log, and queue.

- [ ] **Commit**

```bash
git add apps/dashboard/src/pages/AutoResearch.jsx
git commit -m "feat(research): add Optimization Lab tab to AutoResearch page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| WhatsApp tab in CampaignsHub | Tasks 6, 7 |
| 4 WA campaign cards with metrics + preview | Tasks 1, 5, 6 |
| Summary bar + AutoResearch banner | Task 6 |
| WA campaign detail — Messages tab | Tasks 8, 9, 10 |
| Conversation flow stepper | Task 9 |
| Mini phone mockup per touch | Task 8 |
| Campaign config panel (trigger, vars, quick replies) | Task 8 |
| AutoResearch tab in WA campaign detail | Task 10 |
| ResearchLab page — header stats | Task 14 |
| Active experiment cards (baseline vs challenger) | Tasks 12, 14 |
| Metrics improvement chart (Recharts) | Task 11 |
| Knowledge base panel | Tasks 13, 14 |
| Experiment log | Task 14 |
| Campaign queue | Task 14 |
| Agent insight callout | Task 14 |
| i18n ES + EN | Task 4 |
| CSS variables + classes | Task 3 |
| Mock data files | Tasks 1, 2 |
| AutoResearch page "Lab" tab | Task 15 |

All spec requirements covered. No placeholders. Type/prop names are consistent across all tasks.
