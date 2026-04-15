# WhatsApp Channel + AutoResearch Lab — Design Spec

**Date:** 2026-04-04
**Status:** Approved for implementation
**Scope:** Dashboard demo feature — mock data only, no real WhatsApp API integration

---

## 1. Overview

Emirates currently runs zero WhatsApp campaigns despite it being the highest open-rate channel (~98% vs 18% email). This feature adds two connected capabilities to the AgentOS dashboard:

1. **WhatsApp tab in Campaigns Hub** — a new channel tab alongside BAU and Lifecycle, showing 4 WhatsApp campaign concepts with phone mockup previews and metrics.
2. **AutoResearch Lab** — a standalone page at `/app/research` implementing the Karpathy AutoResearch concept (autonomous baseline → challenger → harvest → repeat loop) applied to WhatsApp copy optimisation.

Both features use **mock data only** — no real WhatsApp Business API or experiment runner. The goal is to demonstrate the concept convincingly in a demo context.

---

## 2. Feature 1 — WhatsApp Tab in Campaigns Hub

### 2.1 Location & Navigation

- **Route:** `/app/campaigns` (existing) — add third tab "WhatsApp"
- **Tab order:** BAU | Lifecycle | 💬 WhatsApp `NEW`
- **Sidebar:** no new entry needed — lives under existing Campaigns nav item

### 2.2 WhatsApp Tab Content

**Summary bar** (top of tab):
- Stat chip: "3 Live campaigns"
- Stat chip: "1 In testing"
- Stat chip: "34.2% Avg response rate"
- AutoResearch banner: "AutoResearch running on 3 campaigns · [Open Lab →]" — links to `/app/research`

**Campaign cards grid** (2×2):

| Campaign | Group | Status | AutoResearch |
|---|---|---|---|
| Miles Expiry | Loyalty & Tiers | Live | Active (Run #14) |
| Preflight Ancillary | Pre-Flight Journey | Live | Active (Run #3) |
| Postflight NPS Survey | Post-Flight | Live | Active (Run #5) |
| Cart / Search Abandon | Abandon & Recovery | Testing | Not yet enrolled |

Each card shows:
- Campaign icon, name, group, status badge, AutoResearch badge (pulsing dot)
- Three metrics: Response Rate, CTA Click Rate, Conversion Rate
- Mini WhatsApp message preview with quick-reply buttons
- Footer: "View in Research Lab →" or "Add to Research Lab →"

### 2.3 Mock Data File

New file: `apps/dashboard/src/data/emiratesWhatsAppCampaigns.js`

```js
export const WA_CAMPAIGNS = [
  {
    id: 'wa-miles-expiry',
    name: 'Miles Expiry',
    group: 'Loyalty & Tiers',
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
  },
  {
    id: 'wa-preflight-ancillary',
    name: 'Preflight Ancillary',
    group: 'Pre-Flight Journey',
    status: 'live',
    trigger: 'hours_before_departure == 72 || 24',
    audience: 'Economy passengers on long-haul routes',
    kpis: { responseRate: 22.4, ctaClickRate: 38.7, conversionRate: 9.2 },
    trends: { responseRate: '+3%', ctaClickRate: '+5%', conversionRate: '+2.1%' },
    autoResearch: { active: true, runNumber: 3, status: 'collecting', lift: null },
    preview: {
      message: '🌟 {{first_name}}, EK {{flight_number}} · {{origin}}→{{destination}} departs in 22 hours. Upgrade before it sells out?',
      quickReplies: ['🥂 Business — from €450', '💺 Extra legroom', '🧳 Add baggage'],
    },
  },
  {
    id: 'wa-postflight-nps',
    name: 'Postflight NPS Survey',
    group: 'Post-Flight Engagement',
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
  },
  {
    id: 'wa-cart-abandon',
    name: 'Cart / Search Abandon',
    group: 'Abandon & Recovery',
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
  },
]
```

### 2.4 Campaign Detail — WhatsApp variant

When navigating to `/app/campaigns/:campaignId` for a WhatsApp campaign (id starts with `wa-`), the Campaign Detail page renders different tabs:

**Tabs:** Overview | **Messages** | Chat | AutoResearch

The **Messages tab** shows:
- Conversation Flow stepper (90d → 30d → 7d → Redemption → Confirmation for Miles Expiry; adjusted per campaign)
- For each touch: mini phone mockup + config panel (trigger, personalisation vars, quick replies, performance metrics)
- Touches enrolled in AutoResearch show the current challenger badge
- Touches not enrolled show "Add to AutoResearch" CTA

New component: `apps/dashboard/src/components/WaMessagesTab.jsx`
- Receives `campaign` prop
- Renders conversation flow + message cards
- Each message card: `WaMessageCard.jsx` — mini phone + config

---

## 3. Feature 2 — AutoResearch Lab

### 3.1 Route & Navigation

- **Route:** `/app/research` (already referenced in codebase, currently empty)
- **Sidebar:** add "🔬 Research Lab" nav item under Marketing section
- **Link from:** WhatsApp campaign cards ("View in Research Lab →") and summary banner

### 3.2 Page Layout

**Header:**
- Title: "🔬 AutoResearch Lab"
- Subtitle: "Karpathy-style autonomous campaign optimisation"
- Stat chips: Active experiments (4) | Total iterations (127) | Avg lift (+34%)

**Body (two-column: main + right sidebar):**

**Left/Main column:**
1. Active Experiments section — cards for each running experiment
2. Metrics chart — line chart showing response rate improvement over iterations for selected campaign
3. Knowledge Base section — accumulated learnings table

**Right sidebar:**
1. Experiment log — recent runs with win/loss outcome
2. Campaign queue — all campaigns with their status
3. Agent insight callout — latest finding from the research agent

### 3.3 Experiment Card

Each experiment card shows:
- Channel badge (💬 WhatsApp / 📧 Email), campaign name, run number, status
- Side-by-side Baseline vs Challenger:
  - Copy preview (truncated message text)
  - Metric value (response rate or CTA click rate)
  - "WINNING" badge on challenger if ahead
- Footer: hypothesis text + time remaining in window

### 3.4 Knowledge Base

Table of accumulated learnings, each entry has:
- Category tag: Copy / Timing / Format / CTA
- Learning text
- Lift delta (e.g. "+28%")

### 3.5 Mock Data File

New file: `apps/dashboard/src/data/autoResearchData.js`

```js
export const EXPERIMENTS = [
  {
    id: 'exp-miles-expiry-14',
    campaignId: 'wa-miles-expiry',
    channel: 'whatsapp',
    runNumber: 14,
    status: 'running', // running | collecting | complete
    metric: 'responseRate',
    windowHours: 24,
    hoursRemaining: 2.25,
    hypothesis: 'Leading with name + exact destination increases urgency perception',
    baseline: { text: 'Your 87,500 miles expire in 7 days. Don\'t let them go to waste...', value: 12.3 },
    challenger: { text: '⚠️ Ahmed — 87,500 miles vanish in 7 days. That\'s a free LHR flight...', value: 18.7 },
  },
  {
    id: 'exp-cart-abandon-7',
    campaignId: 'wa-cart-abandon',
    channel: 'whatsapp',
    runNumber: 7,
    status: 'collecting',
    metric: 'ctaClickRate',
    windowHours: 24,
    hoursRemaining: 5.67,
    hypothesis: 'Scarcity signal ("4 seats left") outperforms generic price warning',
    baseline: { text: 'You left a flight to London in your cart. Prices may change...', value: 9.1 },
    challenger: { text: '✈️ James — only 4 seats left at £892 on your DXB→LHR search.', value: 11.2 },
  },
]

export const KNOWLEDGE_BASE = [
  { id: 'kb-1', tag: 'copy', text: "Opening with member's name + exact miles balance outperforms generic openers", lift: '+28%', runCount: 8 },
  { id: 'kb-2', tag: 'timing', text: 'Thursday sends between 09:00–11:00 GST get 2× the response rate of Monday sends', lift: '2×', runCount: 5 },
  { id: 'kb-3', tag: 'format', text: '3 quick-reply buttons outperform 4+ options — too many choices reduce response rate', lift: '+17%', runCount: 6 },
  { id: 'kb-4', tag: 'cta', text: 'Destination-specific CTA ("Redeem DXB→LHR") converts better than generic ("View options")', lift: '+34%', runCount: 4 },
  { id: 'kb-5', tag: 'copy', text: 'Messages under 60 words get higher response rates — longer copy drops engagement', lift: '+12%', runCount: 7 },
]

export const EXPERIMENT_LOG = [
  { runId: 'exp-miles-expiry-13', campaignName: 'Miles Expiry', channel: 'whatsapp', outcome: 'challenger_promoted', delta: '+5.1%' },
  { runId: 'exp-miles-expiry-12', campaignName: 'Miles Expiry', channel: 'whatsapp', outcome: 'baseline_kept', delta: '-1.2%' },
  { runId: 'exp-cart-abandon-6', campaignName: 'Cart Abandon', channel: 'whatsapp', outcome: 'challenger_promoted', delta: '+3.8%' },
  { runId: 'exp-nps-5', campaignName: 'Postflight NPS', channel: 'whatsapp', outcome: 'challenger_promoted', delta: '+8.4%' },
  { runId: 'exp-miles-expiry-11', campaignName: 'Miles Expiry', channel: 'whatsapp', outcome: 'baseline_kept', delta: '-0.7%' },
  { runId: 'exp-preflight-2', campaignName: 'Preflight Ancillary', channel: 'whatsapp', outcome: 'inconclusive', delta: '+0.3%' },
]

// Chart data — response rate per iteration for Miles Expiry
export const CHART_DATA = [
  { run: 1, value: 8.1 }, { run: 2, value: 8.9 }, { run: 3, value: 9.8 },
  { run: 4, value: 11.2 }, { run: 5, value: 10.7 }, { run: 6, value: 12.1 },
  { run: 7, value: 13.4 }, { run: 8, value: 13.1 }, { run: 9, value: 14.6 },
  { run: 10, value: 15.8 }, { run: 11, value: 15.2 }, { run: 12, value: 16.9 },
  { run: 13, value: 17.8 }, { run: 14, value: 18.7 },
]
```

### 3.6 Chart

Uses existing Recharts library (already in the project). `LineChart` with:
- X axis: run number
- Y axis: metric value (%)
- Dots colored green (challenger promoted) or red (baseline kept)
- Gradient area fill below the line

New component: `apps/dashboard/src/components/ResearchChart.jsx`

---

## 4. Components Summary

| Component | File | Description |
|---|---|---|
| WhatsApp tab content | `CampaignsHub.jsx` (extend) | New tab rendering `WaTab` |
| WaTab | `src/components/WaTab.jsx` | Summary bar + campaign cards grid |
| WaCampaignCard | `src/components/WaCampaignCard.jsx` | Individual WA campaign card |
| WaMessagesTab | `src/components/WaMessagesTab.jsx` | Conversation flow + message cards |
| WaMessageCard | `src/components/WaMessageCard.jsx` | Mini phone + config panel |
| ResearchLab | `src/pages/ResearchLab.jsx` | Full AutoResearch Lab page |
| ExperimentCard | `src/components/ExperimentCard.jsx` | Baseline vs challenger card |
| ResearchChart | `src/components/ResearchChart.jsx` | Recharts line chart |
| KnowledgeBase | `src/components/KnowledgeBase.jsx` | Learnings table |

---

## 5. Routing

Add to the router:
```jsx
<Route path="/app/research" element={<ResearchLab />} />
```

The `/app/campaigns/:campaignId` route already exists — extend `CampaignDetail.jsx` to detect WhatsApp campaigns and render WA-specific tabs.

---

## 6. i18n

All user-facing text added to `translations.js` under `whatsapp` and `research` namespaces. Both ES and EN required.

Key strings:
- `whatsapp.tab_label`, `whatsapp.new_badge`
- `whatsapp.summary.*` (live_campaigns, in_testing, avg_response_rate, research_banner_*)
- `whatsapp.card.*` (response_rate, cta_click, conversion, view_in_lab, add_to_lab)
- `whatsapp.messages.*` (conversation_flow, touch_*, trigger, personalisation_vars, quick_replies)
- `research.title`, `research.subtitle`
- `research.stats.*` (running, iterations, avg_lift)
- `research.experiment.*` (baseline, challenger, winning, hypothesis, remaining)
- `research.kb.*` (title, tags)
- `research.log.*` (title, outcomes)

---

## 7. Styling

Follow existing CSS custom properties pattern in `index.css`. No Tailwind. New CSS variables needed:

```css
--wa-green: #25d366;
--wa-green-dim: rgba(37, 211, 102, 0.1);
--wa-green-border: rgba(37, 211, 102, 0.3);
--wa-chat-bg: #0b141a;
--wa-bubble-in: #202c33;
--wa-bubble-out: #005c4b;
--wa-header: #1f2c34;
--research-purple: #a78bfa;
--research-purple-dim: rgba(167, 139, 250, 0.1);
```

---

## 8. Out of Scope

- Real WhatsApp Business API integration
- Actual experiment runner / cron job
- Real metrics from a WA platform
- Sending actual WhatsApp messages
- Backend changes to `server.js`

Everything is front-end mock data for demo purposes.

---

## 9. Success Criteria

The demo is successful if a stakeholder watching the dashboard can:
1. Navigate to Campaigns → WhatsApp and see 4 live campaigns with metrics
2. Click into a campaign and see the actual WhatsApp message designs (phone mockups)
3. Navigate to Research Lab and understand the AutoResearch concept (experiments improving over time)
4. Follow the connection: campaign card → "View in Research Lab" → experiment detail
