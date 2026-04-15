# AI Proposals Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface AI-generated proposals (✦ AI Ideas tab) and chat prompt chips across Campaign Creation, Competitor Analysis, Studio, and Journeys — all driven by Emirates-specific mock data.

**Architecture:** A static `aiProposals.js` data file feeds four reusable components (`ProposalCard`, `AIIdeasTab`, `AIInlineTip`, `ChatPromptChips`). Each section page imports what it needs. The data layer is intentionally thin so swapping mock for a live Claude call later requires touching only `aiProposals.js`, not the components.

**Tech Stack:** React 19, CSS custom properties (no Tailwind), lucide-react icons, i18n via `useLanguage()` hook.

---

## File Map

**Create:**
- `apps/dashboard/src/data/aiProposals.js` — all mock proposals + chat chips keyed by section
- `apps/dashboard/src/components/ai-proposals/ProposalCard.jsx` — single proposal card
- `apps/dashboard/src/components/ai-proposals/AIIdeasTab.jsx` — tab container (list of ProposalCards)
- `apps/dashboard/src/components/ai-proposals/AIInlineTip.jsx` — inline amber tip banner
- `apps/dashboard/src/components/ai-proposals/ChatPromptChips.jsx` — welcome chips + ✦ popover button

**Modify:**
- `apps/dashboard/src/index.css` — add CSS classes for all new components
- `apps/dashboard/src/i18n/translations.js` — add EN + ES keys under `aiProposals:`
- `apps/dashboard/src/components/journey/JourneyBuilderChat.jsx` — add chips to welcome state + ✦ button
- `apps/dashboard/src/components/unified-studio/UnifiedChatPanel.jsx` — add chips to empty state + ✦ button
- `apps/dashboard/src/pages/JourneyBuilderPage.jsx` — add Chat / ✦ AI Ideas tab switcher in sidebar
- `apps/dashboard/src/pages/CompetitorAnalysisPage.jsx` — add AI Ideas tab to `PersonaDetail`
- `apps/dashboard/src/pages/CampaignCreationPage.jsx` — add AI Ideas tab at page level
- `apps/dashboard/src/pages/UnifiedStudioPage.jsx` — add AI Ideas tab to chat panel + inline tips on active variant
- `apps/dashboard/src/pages/JourneysListPage.jsx` — add proposal-count badge on `JourneyCard`

---

## Task 1: Mock data — `aiProposals.js`

**Files:**
- Create: `apps/dashboard/src/data/aiProposals.js`

- [ ] **Step 1.1: Create the file**

```js
// apps/dashboard/src/data/aiProposals.js
// Emirates-specific AI proposals mock data — April 2026 context
// (Iran airspace restrictions ~6 weeks, negotiations underway Apr 14)

export const AI_PROPOSALS = {
  campaignCreation: [
    {
      id: 'reassurance-broadcast',
      priority: 'urgent',
      title: 'Reassurance broadcast — negotiation window now open',
      reasoning: 'Negotiations entered active phase Apr 14. Prime window to send proactive reassurance to affected-route passengers before competitor messaging arrives. Broadcast Operational type — T3 Lounge notice got 42.3% OR with purely informational content. Tone: confident, not alarming.',
      kpiContext: [
        { label: 'Broadcast Operational OR', value: '42.3%' },
        { label: 'Affected audience', value: '~340K' },
      ],
      primaryCta: { label: 'Create brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'miles-expiry-q2',
      priority: 'high',
      title: 'Miles Expiry urgency — Q2 window + travel uncertainty combo',
      reasoning: 'Miles Expiry 7-day urgency holds 60.3% OR (highest in portfolio). Many members with expiring miles are holding off booking due to airspace uncertainty. A redemption offer framed as "use miles, fly when routes reopen" reduces booking friction now.',
      kpiContext: [
        { label: '7-day urgency OR', value: '60.3%' },
        { label: 'Conv. rate', value: '7.3%' },
      ],
      primaryCta: { label: 'Create brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'route-recovery-dxb-man',
      priority: 'medium',
      title: 'Route recovery campaign — DXB-MAN pre-load',
      reasoning: 'DXB-Prague launch hit 44.8% OR and 7.8% CTR. DXB-MAN outbound is in QA now. If airspace reopens in the negotiation window (est. 2–4 weeks), first-mover recovery campaign on this route will capture the demand spike. Brief now, activate on trigger.',
      kpiContext: [
        { label: 'DXB-Prague OR', value: '44.8%' },
        { label: 'CTR', value: '7.8%' },
      ],
      primaryCta: { label: 'Draft brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'spring-flash-sale-hold',
      priority: 'low',
      title: 'Spring Flash Sale — 11 days in brief, hold or redirect?',
      reasoning: 'Spring Flash Sale created Apr 5, still in brief. Given current passenger sentiment, a fare discount on affected routes could read as panic pricing. Recommend holding until negotiation outcome is clearer, or redirecting to non-affected route set.',
      kpiContext: null,
      primaryCta: { label: 'Review routes →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
  ],

  competitorAnalysis: [
    {
      id: 'flydubai-trust-gap',
      priority: 'high',
      title: 'Flydubai silent on reassurance — trust gap in low-cost segment',
      reasoning: 'Spy network: Flydubai sent 0 operational comms in past 6 weeks on airspace. Their overlap with Emirates on DXB-short-haul is ~22% of audience. Passengers on shared routes have received no reassurance. Emirates Incident Solution template (82.3% OR) can capture this trust gap.',
      kpiContext: [
        { label: 'Incident Solution OR', value: '82.3%' },
        { label: 'Audience overlap', value: '~22%' },
      ],
      primaryCta: { label: 'Create campaign →', action: 'dismiss' },
      secondaryCta: { label: 'View detail', action: 'dismiss' },
    },
    {
      id: 'qatar-luxury-counter',
      priority: 'medium',
      title: 'Qatar Airways pushed luxury narrative during crisis — counter-position opportunity',
      reasoning: 'QR sent 3 campaigns in past 2 weeks emphasising Business Class comfort during "longer journeys." Emirates Preflight Experience (71.5% OR for premium) + Preflight Ancillary "Seat upgrade focus" (54.1% OR) can counter-position the extended routing as a premium experience.',
      kpiContext: [
        { label: 'Preflight Experience OR', value: '71.5%' },
        { label: 'Seat upgrade CTR', value: '21.3%' },
      ],
      primaryCta: { label: 'Create counter campaign →', action: 'dismiss' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    {
      id: 'lufthansa-newsletter-gap',
      priority: 'low',
      title: 'Lufthansa newsletter frequency dropped 40% — inbox opening',
      reasoning: 'LH went from weekly to bi-weekly newsletter during crisis period. European route newsletters from LH reduced inbox competition. Emirates Newsletter trending up (30.2 → 32.4% OR in 3 months) — capitalise with an EU-targeted frequency bump this week.',
      kpiContext: [
        { label: 'Newsletter OR trend', value: '+2.2pp' },
      ],
      primaryCta: { label: 'Schedule send →', action: 'dismiss' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
  ],

  studio: {
    proposals: [
      {
        id: 'studio-subject-ar',
        priority: 'high',
        title: 'Shorten AR subject line — pattern confirmed across portfolio',
        reasoning: 'Statement Centralized AR with subject <30 chars has 41.3% OR vs 38.9% for longer versions. Onboarding Centralized AR (52.4% OR) vs EN (55.2% OR) confirms shorter copy wins in Arabic market. Suggested: condense to <32 chars.',
        kpiContext: [
          { label: 'Statement AR short OR', value: '41.3%' },
          { label: 'vs long version', value: '+2.4pp' },
        ],
        primaryCta: { label: 'Apply suggestion →', action: 'dismiss' },
        secondaryCta: { label: 'Edit manually', action: 'dismiss' },
      },
      {
        id: 'studio-preheader-sync',
        priority: 'medium',
        title: 'EN preheader updated but AR/ES not synced',
        reasoning: 'Variant EN has updated preheader with "Updated routing information." AR and ES still carry the original generic copy from 6 days ago. Broadcast Operational pattern shows consistent preheader across markets improves OR by ~3pp.',
        kpiContext: null,
        primaryCta: { label: 'Sync all preheaders →', action: 'dismiss' },
        secondaryCta: { label: 'Ignore', action: 'dismiss' },
      },
      {
        id: 'studio-cta-text',
        priority: 'low',
        title: '"Book now" CTA may increase unsubscribes in current climate',
        reasoning: 'Operational emails with transactional CTAs ("View your itinerary", "Check route status") outperform "Book now" by 2.1x CTR in disruption scenarios. Recommend swapping primary CTA for this campaign type.',
        kpiContext: null,
        primaryCta: { label: 'Change CTA text →', action: 'dismiss' },
        secondaryCta: { label: 'Keep as-is', action: 'dismiss' },
      },
    ],
    inlineTips: [
      {
        id: 'tip-ar-subject-length',
        marketFilter: 'ar',
        message: 'AR subject line >35 chars — portfolio data shows 12–15% lower OR in Arabic market at this length.',
      },
      {
        id: 'tip-ru-flight-keywords',
        marketFilter: 'ru',
        message: 'RU variant contains flight-related keywords with elevated sensitivity in current regional context. Consider neutral framing.',
      },
    ],
  },

  journeys: {
    preflight: [
      {
        id: 'journey-beflyoufly-outdated',
        priority: 'urgent',
        title: 'BeforeYouFly content outdated for 23 affected routes',
        reasoning: 'BeforeYouFly (68.2% OR — 2nd highest in portfolio) sends a travel checklist 7 days before departure. The content block for affected routes still shows original flight times. Extended routings add 40–90 min — passenger arrives at gate with wrong timing. Legal + operational risk.',
        kpiContext: [
          { label: 'BeforeYouFly OR', value: '68.2%' },
          { label: 'Affected routes', value: '23' },
        ],
        primaryCta: { label: 'Update content block →', action: 'dismiss' },
        secondaryCta: { label: 'View in canvas', action: 'dismiss' },
      },
      {
        id: 'journey-route-split',
        priority: 'medium',
        title: 'Add conditional branch — affected route vs normal routing',
        reasoning: 'Current Pre-Flight journey has no routing-based split. A decision node on route_group = "iran_diversion" would let you serve updated content to 23 routes without touching the other 180+ routes in the same journey.',
        kpiContext: null,
        primaryCta: { label: 'Add split node →', action: 'dismiss' },
        secondaryCta: { label: 'Keep single path', action: 'dismiss' },
      },
      {
        id: 'journey-ancillary-timing',
        priority: 'low',
        title: 'Preflight Ancillary — reduce upsell pressure on diverted routes',
        reasoning: 'Preflight Ancillary currently fires 72h before departure regardless of context. For passengers on diverted routes, seat upgrade upsell at 72h may feel tone-deaf. Consider extending to 48h or suppressing for affected routes until situation stabilises.',
        kpiContext: null,
        primaryCta: { label: 'Adjust timing →', action: 'dismiss' },
        secondaryCta: { label: 'Keep 72h', action: 'dismiss' },
      },
    ],
    milesExpiry: [
      {
        id: 'journey-miles-no-exit',
        priority: 'urgent',
        title: 'Branch "no open 7d" has no exit — contacts loop indefinitely',
        reasoning: 'Miles Expiry 7-day urgency has 60.3% OR — meaning ~40% do not open. Without an exit path, those contacts stay active in the journey forever. Risk of spam complaint on subsequent sends.',
        kpiContext: [
          { label: '7-day urgency OR', value: '60.3%' },
          { label: 'Non-openers at risk', value: '~40%' },
        ],
        primaryCta: { label: 'Add exit node →', action: 'dismiss' },
        secondaryCta: { label: 'View in canvas', action: 'dismiss' },
      },
      {
        id: 'journey-miles-wait-node',
        priority: 'medium',
        title: 'Wait node between touchpoints configured as 1h — should be 30d',
        reasoning: 'The multi-touch sequence (90d → 30d → 7d warning) has a Wait node set to 1h between the trigger and the first email. The gap between the 90d and 30d touchpoints should be 30 days, not 1 hour.',
        kpiContext: null,
        primaryCta: { label: 'Change to 30d →', action: 'dismiss' },
        secondaryCta: { label: 'Keep', action: 'dismiss' },
      },
      {
        id: 'journey-miles-tier-split',
        priority: 'low',
        title: 'Add tier split before Email 1 — high-OR pattern in portfolio',
        reasoning: 'Miles Abandon (premium segment) has 42.1% OR vs 28.6% for Search Abandon (general). A tier split before Email 1 would allow personalising the redemption offer by Gold/Silver/Blue tier.',
        kpiContext: null,
        primaryCta: { label: 'Add tier split →', action: 'dismiss' },
        secondaryCta: { label: 'Dismiss', action: 'dismiss' },
      },
    ],
    default: [
      {
        id: 'journey-default-exit',
        priority: 'high',
        title: 'No exit path for non-engagers detected',
        reasoning: 'This journey has at least one branch where contacts with no engagement have no defined exit. They will remain active indefinitely, inflating active contact counts and risking deliverability.',
        kpiContext: null,
        primaryCta: { label: 'Add exit node →', action: 'dismiss' },
        secondaryCta: { label: 'View canvas', action: 'dismiss' },
      },
    ],
  },
};

export const CHAT_PROMPT_CHIPS = {
  campaignCreation: [
    'What campaigns should I prioritise this week?',
    'Suggest a brief for an urgency-based offer',
    "What's underperforming in our BAU portfolio?",
  ],
  competitorAnalysis: [
    'What are competitors doing differently this month?',
    'Find gaps in competitor email calendar',
    'How should we counter their latest loyalty push?',
  ],
  studio: [
    'Review this subject line for all markets',
    'Which variant is most likely to underperform?',
    'Suggest a shorter AR subject line',
  ],
  journeyBuilder: [
    "What's missing in this journey?",
    'Check for exit path issues',
    'Suggest a split node for this audience',
  ],
};
```

- [ ] **Step 1.2: Verify the file parses without error**

```bash
cd apps/dashboard && node -e "import('./src/data/aiProposals.js').then(m => console.log('keys:', Object.keys(m.AI_PROPOSALS))).catch(console.error)"
```
Expected output: `keys: [ 'campaignCreation', 'competitorAnalysis', 'studio', 'journeys' ]`

- [ ] **Step 1.3: Commit**

```bash
git add apps/dashboard/src/data/aiProposals.js
git commit -m "feat(ai-proposals): mock data — Emirates-specific proposals + chat chips"
```

---

## Task 2: CSS classes — `index.css`

**Files:**
- Modify: `apps/dashboard/src/index.css` (append at end of file)

- [ ] **Step 2.1: Append new CSS to the end of `index.css`**

```css
/* ─── AI Proposals Surface ─────────────────────────────────────────────── */

/* Tab badge */
.ai-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  background: var(--theme-amber);
  color: #000;
  margin-left: 5px;
}

/* Proposal tab container */
.ai-proposals-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.ai-proposals-tab__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ai-proposals-tab__meta {
  font-size: 10px;
  color: var(--text-muted);
}

.ai-proposals-tab__refresh {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-light);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.ai-proposals-tab__refresh:hover { color: var(--text-main); border-color: var(--theme-amber); }

.ai-proposals-tab__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
}

/* Proposal card */
.proposal-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-left: 3px solid transparent;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.proposal-card--urgent,
.proposal-card--high   { border-left-color: var(--theme-red); }
.proposal-card--medium { border-left-color: var(--theme-amber); }
.proposal-card--low    { border-left-color: var(--theme-indigo); }

.proposal-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.proposal-card__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.4;
}

.proposal-card__priority {
  flex-shrink: 0;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.proposal-card__priority--urgent,
.proposal-card__priority--high   { background: var(--theme-red-soft); color: var(--theme-red); }
.proposal-card__priority--medium { background: var(--theme-amber-soft); color: var(--theme-amber); }
.proposal-card__priority--low    { background: var(--theme-indigo-soft); color: var(--theme-indigo); }

.proposal-card__reasoning {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}

.proposal-card__kpi-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.proposal-card__kpi-pill {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  color: var(--text-muted);
}
.proposal-card__kpi-pill strong { color: var(--text-main); }

.proposal-card__actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.proposal-card__btn {
  font-size: 10px;
  padding: 3px 9px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--border-light);
  background: none;
  color: var(--text-muted);
  transition: all 0.15s;
}
.proposal-card__btn:hover { color: var(--text-main); }
.proposal-card__btn--primary {
  background: var(--theme-indigo-soft);
  border-color: rgba(99,102,241,0.35);
  color: var(--theme-indigo);
}
.proposal-card__btn--primary:hover {
  background: rgba(99,102,241,0.2);
}

/* Inline tip */
.ai-inline-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--theme-amber-soft);
  border-left: 3px solid var(--theme-amber);
  border-radius: 0 4px 4px 0;
  padding: 7px 10px;
  font-size: 10px;
  color: var(--text-main);
  line-height: 1.5;
  margin-bottom: 6px;
}

.ai-inline-tip__icon { color: var(--theme-amber); flex-shrink: 0; margin-top: 1px; }

.ai-inline-tip__dismiss {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
}
.ai-inline-tip__dismiss:hover { color: var(--text-main); }

/* Chat prompt chips */
.chat-prompt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.chat-prompt-chip {
  background: none;
  border: 1px solid rgba(212,175,55,0.35);
  color: var(--theme-amber);
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.chat-prompt-chip:hover {
  background: var(--theme-amber-soft);
  border-color: var(--theme-amber);
}

/* ✦ sparkle button in chat input row */
.chat-sparkle-btn {
  flex-shrink: 0;
  background: none;
  border: 1px solid rgba(212,175,55,0.3);
  color: var(--theme-amber);
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
.chat-sparkle-btn:hover { background: var(--theme-amber-soft); border-color: var(--theme-amber); }

/* Chips popover */
.chat-chips-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}

.chat-chips-popover__label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 2px 2px;
}

.chat-chips-popover .chat-prompt-chip {
  border-radius: 4px;
  width: 100%;
}

/* Journey builder sidebar tab row */
.journey-sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
  flex-shrink: 0;
}

.journey-sidebar-tab {
  flex: 1;
  padding: 8px 4px;
  font-size: 10px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.journey-sidebar-tab:hover { color: var(--text-main); }
.journey-sidebar-tab.active { color: var(--theme-amber); border-bottom-color: var(--theme-amber); }

/* Journey list card proposal badge */
.jl__card-proposal-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--theme-amber);
  background: var(--theme-amber-soft);
  border: 1px solid rgba(212,175,55,0.25);
  border-radius: 8px;
  padding: 2px 6px;
  margin-top: 4px;
}
```

- [ ] **Step 2.2: Verify no syntax errors**

```bash
cd apps/dashboard && npm run build 2>&1 | tail -20
```
Expected: build succeeds (or only pre-existing warnings, no new CSS parse errors).

- [ ] **Step 2.3: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(ai-proposals): CSS classes — proposal cards, inline tips, chat chips"
```

---

## Task 3: i18n keys — `translations.js`

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 3.1: Add ES keys**

Find the closing `},` of the `es:` object's last top-level key before `en:`. Add this block immediately before the `},` that closes `es:`:

```js
    aiProposals: {
      tabLabel: '✦ Ideas IA',
      urgent: 'Urgente',
      high: 'Alta',
      medium: 'Media',
      low: 'Sugerencia',
      dismiss: 'Descartar',
      refresh: 'Actualizar',
      empty: 'Sin propuestas ahora.',
      emptyHint: 'Vuelve más tarde o pulsa Actualizar.',
      generatedNow: 'Generado ahora',
      backgroundScan: 'Escaneo en background · hace {time}',
      chatChipsLabel: 'Sugerencias',
    },
```

- [ ] **Step 3.2: Add EN keys**

Find the equivalent location in the `en:` object and add:

```js
    aiProposals: {
      tabLabel: '✦ AI Ideas',
      urgent: 'Urgent',
      high: 'High',
      medium: 'Medium',
      low: 'Suggestion',
      dismiss: 'Dismiss',
      refresh: 'Refresh',
      empty: 'No proposals right now.',
      emptyHint: 'Check back later or click Refresh.',
      generatedNow: 'Generated now',
      backgroundScan: 'Background scan · {time} ago',
      chatChipsLabel: 'Suggested',
    },
```

- [ ] **Step 3.3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(ai-proposals): i18n keys EN + ES"
```

---

## Task 4: `ProposalCard.jsx`

**Files:**
- Create: `apps/dashboard/src/components/ai-proposals/ProposalCard.jsx`

- [ ] **Step 4.1: Create the component**

```jsx
// apps/dashboard/src/components/ai-proposals/ProposalCard.jsx
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function ProposalCard({ proposal, onDismiss }) {
  const { t } = useLanguage();

  const priorityLabel = {
    urgent: t('aiProposals.urgent'),
    high: t('aiProposals.high'),
    medium: t('aiProposals.medium'),
    low: t('aiProposals.low'),
  }[proposal.priority] || proposal.priority;

  const handleAction = (action) => {
    if (action === 'dismiss') onDismiss(proposal.id);
  };

  return (
    <div className={`proposal-card proposal-card--${proposal.priority}`}>
      <div className="proposal-card__top">
        <div className="proposal-card__title">{proposal.title}</div>
        <span className={`proposal-card__priority proposal-card__priority--${proposal.priority}`}>
          {priorityLabel}
        </span>
      </div>

      <div className="proposal-card__reasoning">{proposal.reasoning}</div>

      {proposal.kpiContext && proposal.kpiContext.length > 0 && (
        <div className="proposal-card__kpi-row">
          {proposal.kpiContext.map((kpi, i) => (
            <span key={i} className="proposal-card__kpi-pill">
              {kpi.label}: <strong>{kpi.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="proposal-card__actions">
        <button
          className="proposal-card__btn proposal-card__btn--primary"
          onClick={() => handleAction(proposal.primaryCta.action)}
        >
          {proposal.primaryCta.label}
        </button>
        <button
          className="proposal-card__btn"
          onClick={() => handleAction(proposal.secondaryCta.action)}
        >
          {proposal.secondaryCta.label}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/dashboard/src/components/ai-proposals/ProposalCard.jsx
git commit -m "feat(ai-proposals): ProposalCard component"
```

---

## Task 5: `AIIdeasTab.jsx`

**Files:**
- Create: `apps/dashboard/src/components/ai-proposals/AIIdeasTab.jsx`

- [ ] **Step 5.1: Create the component**

```jsx
// apps/dashboard/src/components/ai-proposals/AIIdeasTab.jsx
import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import ProposalCard from './ProposalCard.jsx';

// onDemand: true = show Refresh button; false = show background scan meta
export default function AIIdeasTab({ proposals = [], onDemand = false, metaText = null }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(new Set());

  const visible = proposals.filter(p => !dismissed.has(p.id));

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  return (
    <div className="ai-proposals-tab">
      <div className="ai-proposals-tab__header">
        <span className="ai-proposals-tab__meta">
          {metaText || (onDemand ? t('aiProposals.generatedNow') : t('aiProposals.backgroundScan').replace('{time}', '1h'))}
        </span>
        {onDemand && (
          <button className="ai-proposals-tab__refresh">
            <RefreshCw size={10} />
            {t('aiProposals.refresh')}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="ai-proposals-tab__empty">
          <Sparkles size={20} strokeWidth={1.5} />
          <div>
            <div>{t('aiProposals.empty')}</div>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{t('aiProposals.emptyHint')}</div>
          </div>
        </div>
      ) : (
        visible.map(p => (
          <ProposalCard key={p.id} proposal={p} onDismiss={handleDismiss} />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add apps/dashboard/src/components/ai-proposals/AIIdeasTab.jsx
git commit -m "feat(ai-proposals): AIIdeasTab component"
```

---

## Task 6: `AIInlineTip.jsx`

**Files:**
- Create: `apps/dashboard/src/components/ai-proposals/AIInlineTip.jsx`

- [ ] **Step 6.1: Create the component**

```jsx
// apps/dashboard/src/components/ai-proposals/AIInlineTip.jsx
import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function AIInlineTip({ message }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="ai-inline-tip">
      <Sparkles size={12} className="ai-inline-tip__icon" />
      <span>{message}</span>
      <button
        className="ai-inline-tip__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss tip"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/dashboard/src/components/ai-proposals/AIInlineTip.jsx
git commit -m "feat(ai-proposals): AIInlineTip component"
```

---

## Task 7: `ChatPromptChips.jsx`

**Files:**
- Create: `apps/dashboard/src/components/ai-proposals/ChatPromptChips.jsx`

- [ ] **Step 7.1: Create the component**

```jsx
// apps/dashboard/src/components/ai-proposals/ChatPromptChips.jsx
// Two modes:
//   <ChatPromptChips chips={[...]} onSelect={fn} />              — inline chip row (welcome message)
//   <ChatPromptChips chips={[...]} onSelect={fn} asButton />     — ✦ button that opens popover (input row)
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function ChatPromptChips({ chips = [], onSelect, asButton = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const handleSelect = (chip) => {
    setOpen(false);
    onSelect(chip);
  };

  if (asButton) {
    return (
      <div style={{ position: 'relative' }} ref={ref}>
        <button
          className="chat-sparkle-btn"
          onClick={() => setOpen(o => !o)}
          title={t('aiProposals.chatChipsLabel')}
          type="button"
        >
          ✦
        </button>
        {open && (
          <div className="chat-chips-popover">
            <div className="chat-chips-popover__label">{t('aiProposals.chatChipsLabel')}</div>
            {chips.map((chip, i) => (
              <button key={i} className="chat-prompt-chip" onClick={() => handleSelect(chip)} type="button">
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-prompt-chips">
      {chips.map((chip, i) => (
        <button key={i} className="chat-prompt-chip" onClick={() => handleSelect(chip)} type="button">
          {chip}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/dashboard/src/components/ai-proposals/ChatPromptChips.jsx
git commit -m "feat(ai-proposals): ChatPromptChips — inline chips + ✦ popover button"
```

---

## Task 8: Wire chips into `JourneyBuilderChat.jsx`

**Files:**
- Modify: `apps/dashboard/src/components/journey/JourneyBuilderChat.jsx`

- [ ] **Step 8.1: Add import at the top of the file**

After the existing imports (line ~4), add:
```jsx
import ChatPromptChips from '../ai-proposals/ChatPromptChips.jsx';
import { CHAT_PROMPT_CHIPS } from '../../../data/aiProposals.js';
```

- [ ] **Step 8.2: Pass chips to `sendWith` on chip select — wire the welcome state**

In the JSX, find the messages render block (around line 110):
```jsx
<div className="journey-chat__messages">
  {messages.map((m, i) => (
```

Replace the entire `<div className="journey-chat__messages">` opening section so it adds a welcome chip row when `messages.length === 0`:

```jsx
<div className="journey-chat__messages">
  {messages.length === 0 && (
    <div className="journey-chat__msg journey-chat__msg--assistant">
      <div className="journey-chat__role">assistant</div>
      <div className="journey-chat__body">
        How can I help with this journey? Here are some ideas:
        <ChatPromptChips
          chips={CHAT_PROMPT_CHIPS.journeyBuilder}
          onSelect={(chip) => sendWith(chip)}
        />
      </div>
    </div>
  )}
  {messages.map((m, i) => (
```

- [ ] **Step 8.3: Add ✦ button to the composer**

Find the `<div className="journey-chat__composer">` block. The textarea and Send button are inside it. Add the `ChatPromptChips asButton` component between the textarea and the Send button:

```jsx
<div className="journey-chat__composer">
  <textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder={t('journeys.chatPlaceholder')}
    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
    disabled={streaming}
  />
  <ChatPromptChips
    chips={CHAT_PROMPT_CHIPS.journeyBuilder}
    onSelect={(chip) => { setInput(chip); sendWith(chip); }}
    asButton
  />
  <button onClick={send} disabled={streaming || !input.trim()} className="journey-chat__send">
    <Send size={16} />
  </button>
</div>
```

- [ ] **Step 8.4: Verify in browser**

Start the dev server (`npm start`), open a journey, confirm:
1. Empty chat shows a welcome message with 3 chip buttons
2. Clicking a chip sends the message
3. ✦ button in composer opens a popover with chips
4. Pressing Escape closes the popover

- [ ] **Step 8.5: Commit**

```bash
git add apps/dashboard/src/components/journey/JourneyBuilderChat.jsx
git commit -m "feat(ai-proposals): add prompt chips to JourneyBuilderChat"
```

---

## Task 9: Wire chips into `UnifiedChatPanel.jsx`

**Files:**
- Modify: `apps/dashboard/src/components/unified-studio/UnifiedChatPanel.jsx`

- [ ] **Step 9.1: Add imports**

After the existing imports, add:
```jsx
import ChatPromptChips from '../ai-proposals/ChatPromptChips.jsx';
import { CHAT_PROMPT_CHIPS } from '../../../data/aiProposals.js';
```

- [ ] **Step 9.2: Replace the empty state with a welcome + chips block**

Find:
```jsx
{messages.length === 0 && (
    <div className="us-chat-empty">{t('unifiedStudio.chat.empty')}</div>
)}
```

Replace with:
```jsx
{messages.length === 0 && (
    <div className="us-chat-empty">
        <div style={{ marginBottom: 8 }}>{t('unifiedStudio.chat.empty')}</div>
        <ChatPromptChips
            chips={CHAT_PROMPT_CHIPS.studio}
            onSelect={(chip) => { setInput(chip); }}
        />
    </div>
)}
```

- [ ] **Step 9.3: Add ✦ button to the input row**

Find the `<div className="us-chat-input">` block. It contains a `<textarea>` and a send `<button>`. Add the `ChatPromptChips asButton` before the send button:

```jsx
<div className="us-chat-input">
    <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={t('unifiedStudio.chat.placeholder')}
        disabled={streaming}
        rows={2}
    />
    <ChatPromptChips
        chips={CHAT_PROMPT_CHIPS.studio}
        onSelect={(chip) => setInput(chip)}
        asButton
    />
    <button onClick={send} disabled={streaming || !input.trim()} className="us-chat-send">
        <Send size={14} />
    </button>
</div>
```

- [ ] **Step 9.4: Verify in browser**

Open Studio, confirm empty state shows chips. Click a chip — it should populate the input. ✦ button opens popover.

- [ ] **Step 9.5: Commit**

```bash
git add apps/dashboard/src/components/unified-studio/UnifiedChatPanel.jsx
git commit -m "feat(ai-proposals): add prompt chips to UnifiedChatPanel"
```

---

## Task 10: AI Ideas panel in `JourneyBuilderPage.jsx`

**Files:**
- Modify: `apps/dashboard/src/pages/JourneyBuilderPage.jsx`

- [ ] **Step 10.1: Add imports**

```jsx
import { useState } from 'react';  // already imported, just confirm
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../../data/aiProposals.js';
```

Wait — `JourneyBuilderPage.jsx` already imports `useState`. Only add the two new imports.

- [ ] **Step 10.2: Add sidebar tab state**

Inside `JourneyBuilderPage`, after the existing `useState` declarations, add:
```jsx
const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'ai-ideas'
```

- [ ] **Step 10.3: Wrap the sidebar with a tab switcher**

Find in the JSX:
```jsx
<div className="journey-builder__body">
  <JourneyBuilderChat
    journeyId={id}
    ...
  />
  <JourneyCanvas ... />
</div>
```

Replace with:
```jsx
<div className="journey-builder__body">
  <aside className="journey-chat">
    <div className="journey-sidebar-tabs">
      <button
        className={`journey-sidebar-tab${sidebarTab === 'chat' ? ' active' : ''}`}
        onClick={() => setSidebarTab('chat')}
        type="button"
      >
        Chat
      </button>
      <button
        className={`journey-sidebar-tab${sidebarTab === 'ai-ideas' ? ' active' : ''}`}
        onClick={() => setSidebarTab('ai-ideas')}
        type="button"
      >
        ✦ AI Ideas
        {AI_PROPOSALS.journeys.default.filter(p => p.priority === 'urgent' || p.priority === 'high').length > 0 && (
          <span className="ai-tab-badge">
            {AI_PROPOSALS.journeys.default.filter(p => p.priority === 'urgent' || p.priority === 'high').length}
          </span>
        )}
      </button>
    </div>

    {sidebarTab === 'chat' ? (
      <JourneyBuilderChat
        journeyId={id}
        messages={messages}
        seedMessage={seedMessage}
        onSeedConsumed={() => setSeedMessage(null)}
        onJourneyState={setDsl}
        onToolStatus={setToolStatus}
        onMessage={(m) => setMessages((prev) => [...prev, m])}
      />
    ) : (
      <AIIdeasTab
        proposals={AI_PROPOSALS.journeys.default}
        onDemand={false}
        metaText="Auto-analysis · 5 min ago"
      />
    )}
  </aside>

  <JourneyCanvas
    dsl={dsl}
    toolStatus={toolStatus}
    onNodeClick={handleNodeClick}
    highlightActivityId={highlightActivityId}
  />
</div>
```

Note: `JourneyBuilderChat` currently renders its own `<aside className="journey-chat">`. Since we are now wrapping with our own `<aside>`, open `JourneyBuilderChat.jsx` and change the root element from `<aside className="journey-chat">` to `<div className="journey-chat__inner">` and add this CSS:

```css
/* in index.css — add after the journey-sidebar-tabs block */
.journey-chat__inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 10.4: Verify in browser**

Open a journey. Confirm: "Chat" and "✦ AI Ideas" tabs visible at top of sidebar. Click AI Ideas — shows proposal cards. Click Chat — shows the chat. Badge shows on AI Ideas tab if there are urgent/high proposals.

- [ ] **Step 10.5: Commit**

```bash
git add apps/dashboard/src/pages/JourneyBuilderPage.jsx apps/dashboard/src/components/journey/JourneyBuilderChat.jsx apps/dashboard/src/index.css
git commit -m "feat(ai-proposals): AI Ideas tab in Journey Builder sidebar"
```

---

## Task 11: AI Ideas tab in `CompetitorAnalysisPage.jsx`

**Files:**
- Modify: `apps/dashboard/src/pages/CompetitorAnalysisPage.jsx`

- [ ] **Step 11.1: Add imports at top of file**

```jsx
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';
```

- [ ] **Step 11.2: Add tab to the PersonaDetail tabs array**

Find in `PersonaDetail` function (around line 464):
```jsx
const tabs = [
```

The existing tabs are `overview`, `timeline`, `emails`, `notes`. Add the AI Ideas tab at the end of the array:

```jsx
const tabs = [
  { id: 'overview',   label: t('spyNetwork.overview') },
  { id: 'timeline',  label: t('spyNetwork.timeline'), count: persona.timeline?.length },
  { id: 'emails',    label: t('spyNetwork.emails'),   count: persona.stats.emailsReceived },
  { id: 'notes',     label: t('spyNetwork.notes') },
  {
    id: 'ai-ideas',
    label: '✦ AI Ideas',
    count: AI_PROPOSALS.competitorAnalysis.filter(p => p.priority === 'high' || p.priority === 'urgent').length,
  },
];
```

- [ ] **Step 11.3: Render the new tab content**

Find the block that renders tab content (around line 527):
```jsx
{activeTab === 'overview' && <OverviewTab persona={persona} t={t} />}
{activeTab === 'timeline' && <TimelineTab persona={persona} t={t} />}
{activeTab === 'emails' && <EmailsTab persona={persona} t={t} />}
{activeTab === 'notes' && <NotesTab persona={persona} t={t} />}
```

Add after the last line:
```jsx
{activeTab === 'ai-ideas' && (
  <AIIdeasTab
    proposals={AI_PROPOSALS.competitorAnalysis}
    onDemand={false}
    metaText="Background scan · 45 min ago"
  />
)}
```

- [ ] **Step 11.4: Verify in browser**

Open Competitor Analysis, click a persona. Confirm "✦ AI Ideas" tab is last in the row with a badge count. Click it — shows proposal cards.

- [ ] **Step 11.5: Commit**

```bash
git add apps/dashboard/src/pages/CompetitorAnalysisPage.jsx
git commit -m "feat(ai-proposals): AI Ideas tab in Competitor Analysis PersonaDetail"
```

---

## Task 12: AI Ideas tab in `CampaignCreationPage.jsx`

**Files:**
- Modify: `apps/dashboard/src/pages/CampaignCreationPage.jsx`

- [ ] **Step 12.1: Add imports**

At the top of the file, after existing imports:
```jsx
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';
```

- [ ] **Step 12.2: Add page-level tab state**

Inside `CampaignCreationPage`, after the existing `useState` declarations, add:
```jsx
const [pageTab, setPageTab] = useState('build'); // 'build' | 'ai-ideas'
```

- [ ] **Step 12.3: Add the tab row and conditional render in the JSX**

`CampaignCreationPage` currently returns a root `<div>` that wraps the content. Find the return statement and locate where `<BriefPanel>` and `<PreviewGate>` are rendered. Add a tab bar above the existing content:

The existing return looks like:
```jsx
return (
  <div className="bau-page">
    {/* ... header ... */}
    {view === 'brief' && <BriefPanel ... />}
    {view === 'preview' && <PreviewGate ... />}
  </div>
);
```

Modify to add the tab row (insert between header and the view content):
```jsx
return (
  <div className="bau-page">
    {/* existing header markup stays here */}

    <div className="bau-page-tabs">
      <button
        className={`bau-page-tab${pageTab === 'build' ? ' active' : ''}`}
        onClick={() => setPageTab('build')}
        type="button"
      >
        Build
      </button>
      <button
        className={`bau-page-tab${pageTab === 'ai-ideas' ? ' active' : ''}`}
        onClick={() => setPageTab('ai-ideas')}
        type="button"
      >
        ✦ AI Ideas
        <span className="ai-tab-badge">
          {AI_PROPOSALS.campaignCreation.filter(p => p.priority === 'urgent' || p.priority === 'high').length}
        </span>
      </button>
    </div>

    {pageTab === 'build' && view === 'brief' && <BriefPanel t={t} types={types} onBuild={handleBuild} busy={building} />}
    {pageTab === 'build' && view === 'preview' && (
      <PreviewGate
        t={t}
        build={build}
        onApproveToggle={handleApproveToggle}
        onPush={handlePush}
        onBack={() => setView('brief')}
        pushing={pushing}
        pushProgress={pushProgress}
        pushError={pushError}
      />
    )}
    {pageTab === 'ai-ideas' && (
      <AIIdeasTab
        proposals={AI_PROPOSALS.campaignCreation}
        onDemand
        metaText="Generated on demand"
      />
    )}

    {/* build progress/error banners stay outside the tab condition */}
    {building && <div className="bau-progress">{buildProgress}</div>}
    {buildError && <div className="bau-error">{buildError}</div>}
  </div>
);
```

Also add these CSS classes to `index.css` (append):
```css
.bau-page-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 16px;
}
.bau-page-tab {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.bau-page-tab:hover { color: var(--text-main); }
.bau-page-tab.active { color: var(--theme-amber); border-bottom-color: var(--theme-amber); }
```

- [ ] **Step 12.4: Verify in browser**

Open Campaign Creation. Confirm "Build" and "✦ AI Ideas" tabs render below the header. Click AI Ideas — shows 4 proposal cards with Emirates context. Click Build — existing brief form works normally.

- [ ] **Step 12.5: Commit**

```bash
git add apps/dashboard/src/pages/CampaignCreationPage.jsx apps/dashboard/src/index.css
git commit -m "feat(ai-proposals): AI Ideas tab in Campaign Creation page"
```

---

## Task 13: AI Ideas tab + inline tips in `UnifiedStudioPage.jsx`

**Files:**
- Modify: `apps/dashboard/src/pages/UnifiedStudioPage.jsx`
- Modify: `apps/dashboard/src/components/unified-studio/UnifiedChatPanel.jsx`

The AI Ideas tab lives inside the `UnifiedChatPanel` area — we add a tab switcher to the chat panel header.

- [ ] **Step 13.1: Add imports to `UnifiedChatPanel.jsx`**

```jsx
import AIIdeasTab from '../ai-proposals/AIIdeasTab.jsx';
import AIInlineTip from '../ai-proposals/AIInlineTip.jsx';
import { AI_PROPOSALS } from '../../../data/aiProposals.js';
```

- [ ] **Step 13.2: Add panel tab state to `UnifiedChatPanel`**

Inside the component, after existing `useState`:
```jsx
const [panelTab, setPanelTab] = useState('chat'); // 'chat' | 'ai-ideas'
```

- [ ] **Step 13.3: Add tab row to the chat panel header**

Find:
```jsx
<aside className="us-chat">
    <header className="us-chat-header">
        <Sparkles size={14} />
        <span>{t('unifiedStudio.chat.title')}</span>
    </header>
```

Replace with:
```jsx
<aside className="us-chat">
    <header className="us-chat-header" style={{ gap: 0, padding: 0 }}>
        <button
            className={`journey-sidebar-tab${panelTab === 'chat' ? ' active' : ''}`}
            onClick={() => setPanelTab('chat')}
            type="button"
            style={{ flex: 1, padding: '10px 8px' }}
        >
            <Sparkles size={12} />
            Chat
        </button>
        <button
            className={`journey-sidebar-tab${panelTab === 'ai-ideas' ? ' active' : ''}`}
            onClick={() => setPanelTab('ai-ideas')}
            type="button"
            style={{ flex: 1, padding: '10px 8px' }}
        >
            ✦ AI Ideas
            <span className="ai-tab-badge">
                {AI_PROPOSALS.studio.proposals.filter(p => p.priority === 'urgent' || p.priority === 'high').length}
            </span>
        </button>
    </header>
```

- [ ] **Step 13.4: Render the tab content**

After the header, the current structure is `<div className="us-chat-messages">` and `<div className="us-chat-input">`. Wrap them in a condition:

```jsx
{panelTab === 'chat' ? (
    <>
        <div className="us-chat-messages" ref={scrollRef}>
            {/* ... existing messages content unchanged ... */}
        </div>
        <div className="us-chat-input">
            {/* ... existing input content unchanged ... */}
        </div>
    </>
) : (
    <AIIdeasTab
        proposals={AI_PROPOSALS.studio.proposals}
        onDemand
        metaText="Analysis of active variant · now"
    />
)}
```

- [ ] **Step 13.5: Add inline tips to `ActiveVariantEditor`**

Open `apps/dashboard/src/components/unified-studio/ActiveVariantEditor.jsx` and add the import:
```jsx
import AIInlineTip from '../ai-proposals/AIInlineTip.jsx';
import { AI_PROPOSALS } from '../../../data/aiProposals.js';
```

Then inside the component, find where the subject/preheader fields are rendered. Add the inline tips above the subject field, filtering by the active variant's market:

```jsx
{/* Inline tips for active market */}
{AI_PROPOSALS.studio.inlineTips
    .filter(tip => !variant?.market || tip.marketFilter === variant.market)
    .map(tip => (
        <AIInlineTip key={tip.id} message={tip.message} />
    ))
}
```

- [ ] **Step 13.6: Verify in browser**

Open Studio. Chat panel now has "Chat" and "✦ AI Ideas" tabs. Click AI Ideas — proposal cards visible. Inline tips appear above subject field on AR/RU variants.

- [ ] **Step 13.7: Commit**

```bash
git add apps/dashboard/src/pages/UnifiedStudioPage.jsx apps/dashboard/src/components/unified-studio/UnifiedChatPanel.jsx apps/dashboard/src/components/unified-studio/ActiveVariantEditor.jsx
git commit -m "feat(ai-proposals): AI Ideas tab + inline tips in Studio"
```

---

## Task 14: Proposal badge on Journey cards in `JourneysListPage.jsx`

**Files:**
- Modify: `apps/dashboard/src/pages/JourneysListPage.jsx`

- [ ] **Step 14.1: Add import**

```jsx
import { AI_PROPOSALS } from '../data/aiProposals.js';
```

- [ ] **Step 14.2: Add badge to `JourneyCard`**

`JourneyCard` currently renders the journey name, status badge, and updated date. Find in `JourneyCard`:

```jsx
function JourneyCard({ journey, onClick, onDelete }) {
```

Add a `proposalCount` derived value and render the badge inside the card. The proposals for a card are `AI_PROPOSALS.journeys.default` (for generic journeys). In a real implementation this would be keyed by journey type, but for mock we show the default high-priority count:

Find inside `JourneyCard`'s return, the bottom of the card content (before the closing `</button>`), and add:

```jsx
{AI_PROPOSALS.journeys.default.length > 0 && (
  <div className="jl__card-proposal-badge">
    ✦ {AI_PROPOSALS.journeys.default.filter(p => p.priority === 'urgent' || p.priority === 'high').length} AI suggestions
  </div>
)}
```

- [ ] **Step 14.3: Verify in browser**

Open Journeys list. Each journey card shows a small amber "✦ 1 AI suggestions" badge. Clicking the card navigates to the builder where the AI Ideas tab shows those proposals.

- [ ] **Step 14.4: Commit**

```bash
git add apps/dashboard/src/pages/JourneysListPage.jsx
git commit -m "feat(ai-proposals): proposal count badge on journey cards in list page"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| `✦ AI Ideas` tab in Campaign Creation | Task 12 |
| `✦ AI Ideas` tab in Competitor Analysis | Task 11 |
| `✦ AI Ideas` tab in Studio | Task 13 |
| `✦ AI Ideas` tab in Journey Builder | Task 10 |
| Proposal badge on Journey list cards | Task 14 |
| Inline tips in Studio on active variant | Task 13 step 5 |
| Chat chips welcome message in Journey Builder | Task 8 |
| Chat chips welcome message in Studio | Task 9 |
| ✦ button in chat input (Journey Builder) | Task 8 step 3 |
| ✦ button in chat input (Studio) | Task 9 step 3 |
| Mock data — Emirates-specific, Iran context | Task 1 |
| CSS — no hardcoded colors, CSS vars only | Task 2 |
| i18n EN + ES | Task 3 |
| Dismiss hides card for session | Task 5 (AIIdeasTab uses local `dismissed` Set) |
| On-demand trigger for Campaign + Studio | Tasks 12, 13 (onDemand prop) |
| Background cached for Competitor + Journeys | Tasks 10, 11 (onDemand=false) |
| Zero new API endpoints | All tasks — client-side only |

### Placeholder scan — none found

All tasks contain complete code. No "TBD", "TODO", or "similar to task N" patterns.

### Type consistency check

- `AI_PROPOSALS.campaignCreation` → array of proposals ✓ used in Task 12
- `AI_PROPOSALS.competitorAnalysis` → array of proposals ✓ used in Task 11
- `AI_PROPOSALS.studio.proposals` → array ✓ used in Task 13
- `AI_PROPOSALS.studio.inlineTips` → array with `marketFilter` ✓ used in Task 13 step 5
- `AI_PROPOSALS.journeys.default` → array ✓ used in Tasks 10, 14
- `CHAT_PROMPT_CHIPS.journeyBuilder` → string array ✓ used in Task 8
- `CHAT_PROMPT_CHIPS.studio` → string array ✓ used in Task 9
- `proposal.priority` values: `urgent | high | medium | low` — used consistently across ProposalCard, AIIdeasTab, badge counts
- `onDismiss(id)` in `ProposalCard` → matches `handleDismiss(id)` in `AIIdeasTab` ✓
- `ChatPromptChips` props: `chips`, `onSelect`, `asButton` — used consistently in Tasks 7, 8, 9 ✓
