# AI Proposals Surface — Design Spec
**Date:** 2026-04-16  
**Branch:** feat/ai-proposals-surface  
**Status:** Approved for implementation

---

## Problem

Users across Campaign Creation, Competitor Analysis, Studio, and Journeys have no proactive guidance from the AI. They either know what to ask (experienced users) or stare at a blank chat box (everyone else). The AI has access to all the data — campaign performance, competitor signals, journey canvas structure, variant content — but never surfaces actionable proposals unprompted.

---

## What We're Building

Two complementary surfaces, applied across four sections:

1. **`✦ AI Ideas` tab** — structured proposals with reasoning, priority, and direct-action CTAs
2. **Chat prompt chips** — contextual prompt suggestions in every agent chat, so users always have a starting point

---

## Design Decisions

### 1. Placement Pattern: Hybrid Tab + Inline

Each section gets a `✦ AI Ideas` tab added to its existing tab row. The tab shows a numeric badge (count of active proposals). Inside the tab: proposal cards with a left-border color indicating priority (red = urgent, amber = medium, indigo = low/suggestion).

Additionally, **inline tips** appear directly on the relevant item (a variant card in Studio, a node in Journeys) as a small amber banner — for things that are too contextual to go in a tab.

### 2. Triggering: Mixed Strategy

| Section | Trigger | Why |
|---|---|---|
| Campaign Creation | On-demand ("Get ideas" button) | Context depends on current brief/type selected |
| Competitor Analysis | Background cached, shown on tab open | Spy network data is static; no need to re-run per session |
| Studio | On-demand when active variant changes | Proposals are per-variant; stale proposals would be confusing |
| Journeys | Auto-analysis on canvas open + "Refresh" button | Canvas structure changes infrequently; auto-run makes sense |

### 3. Chat Prompt Chips: Hybrid Welcome + Mid-chat Button

- **On chat open**: the agent's first message includes 2–3 contextual prompt chips rendered inline (styled differently from regular bubbles). Clicking a chip inserts the text into the input and auto-sends.
- **In the input row**: a small `✦` icon button at the left of every chat input. Clicking it shows a popover with 3–4 fresh suggestions relevant to the current conversation context.
- Chips are section-aware: Journey Builder chat chips reference the canvas state, Studio chat chips reference the active variant, Campaign chat chips reference the selected campaign type.

### 4. Mock Data Strategy

All proposals are driven by a static `aiProposals.js` data file. The data is **Emirates-specific and contextually accurate** — it references real campaign names, actual KPI numbers from the portfolio, and current real-world context (Iran airspace situation, ~6 weeks active as of Apr 2026, negotiations underway).

This is intentional: mock data that looks generic undermines trust in the feature. Mock data that says "Miles Expiry 7-day urgency holds 60.3% OR — highest in portfolio" immediately reads as real intelligence.

The architecture uses a thin data layer so swapping mock for a real Claude API call in the future is a `src/data/aiProposals.js` → `src/hooks/useAIProposals.js` refactor, not a component rewrite.

---

## Component Architecture

### New files

```
apps/dashboard/src/
  components/
    ai-proposals/
      AIIdeasTab.jsx        # Reusable tab content: list of ProposalCard
      ProposalCard.jsx      # Single proposal: title, reasoning, kpiContext, CTAs
      AIInlineTip.jsx       # Small amber banner for contextual inline tips
      ChatPromptChips.jsx   # Chip row for chat welcome message + ✦ popover
  data/
    aiProposals.js          # All mock proposals, keyed by section
```

### Modified files

| File | Change |
|---|---|
| `CampaignCreationPage.jsx` | Add `✦ AI Ideas` tab + `ChatPromptChips` to existing chat |
| `CompetitorAnalysisPage.jsx` | Add `✦ AI Ideas` tab only (no chat panel in this section) |
| `UnifiedStudioPage.jsx` | Add `✦ AI Ideas` tab + inline tips on `ActiveVariantEditor` + chips in `UnifiedChatPanel` |
| `JourneysListPage.jsx` | Add proposal-count badge on each journey card (clicking navigates to builder with AI Ideas tab pre-selected) |
| `JourneyBuilderPage.jsx` | Add `✦ AI Ideas` tab in the builder side panel + inline tips on affected nodes |
| `JourneyBuilderChat.jsx` | Add `ChatPromptChips` welcome message + `✦` button in input |
| `UnifiedChatPanel.jsx` | Add `ChatPromptChips` |
| `index.css` | Add CSS variables + classes for proposal cards, chip row, inline tip |
| `translations.js` | Add EN/ES keys for all new UI text |

---

## Data Model

```js
// aiProposals.js — structure per section

export const AI_PROPOSALS = {
  campaignCreation: [
    {
      id: 'reassurance-broadcast',
      priority: 'urgent',          // urgent | high | medium | low
      title: 'Reassurance broadcast — negotiation window now open',
      reasoning: 'Negotiations entered active phase Apr 14. Prime window to send...',
      kpiContext: [                 // optional, 1–2 items
        { label: 'Broadcast Operational OR', value: '42.3%' },
        { label: 'Affected audience', value: '~340K' },
      ],
      primaryCta: { label: 'Create brief →', action: 'createBrief' },
      secondaryCta: { label: 'Dismiss', action: 'dismiss' },
    },
    // ...
  ],
  competitorAnalysis: [ /* ... */ ],
  studio: {
    inlineTips: [ /* per variant/market */ ],
    proposals: [ /* ... */ ],
  },
  journeys: {
    // keyed by journey type for contextual proposals
    preflight: [ /* ... */ ],
    milesExpiry: [ /* ... */ ],
    default: [ /* ... */ ],
  },
};

export const CHAT_PROMPT_CHIPS = {
  campaignCreation: ['What campaigns should I prioritise this week?', 'Suggest a brief for an urgency-based offer', 'What\'s underperforming in our BAU portfolio?'],
  competitorAnalysis: ['What are competitors doing differently this month?', 'Find gaps in competitor email calendar', 'How should we counter their latest loyalty push?'],
  studio: ['Review this subject line for all markets', 'Which variant is most likely to underperform?', 'Suggest a shorter AR subject line'],
  journeyBuilder: ['What\'s missing in this journey?', 'Check for exit path issues', 'Suggest a split node for this audience'],
};
```

---

## UI Behaviour

### `AIIdeasTab`

- Renders a list of `ProposalCard` components from the relevant section's proposals array
- Proposals dismissed by the user are hidden (local state, not persisted — resets on next open)
- "Refresh" button visible for on-demand sections (Campaign, Studio); absent for background sections
- Empty state: "No proposals right now. Check back later or click Refresh." with `✦` icon

### `ProposalCard`

- Left border color: red (`--color-error`) for urgent/high, amber (`--color-warning`) for medium, indigo (`--color-accent`) for low
- Collapsible reasoning section (default expanded)
- KPI context pills rendered if `kpiContext` array is provided
- Primary CTA button (filled, accent color) + secondary (ghost/dismiss)
- `action: 'createBrief'` calls the existing brief creation flow; `action: 'dismiss'` hides the card

### `AIInlineTip`

- Amber left-border banner, small text, dismissible `×`
- Appears above or below the relevant item (variant card in Studio, node detail in Journeys)
- Not a modal — zero interaction cost to ignore

### `ChatPromptChips`

- In welcome message: chips rendered as `<button>` elements with amber outline style, inside the agent message bubble
- In input row: small `✦` button (16px, left of input field). On click: shows a `<div>` popover with 3–4 chip buttons. Clicking a chip inserts text into input + auto-focuses. Pressing Escape closes the popover.
- Chips update based on conversation history (for now, static per section; dynamic in v2 with Claude API)

---

## CSS Classes (to add to `index.css`)

```css
/* Proposal cards */
.ai-proposals-tab { ... }
.proposal-card { ... }
.proposal-card--urgent  { border-left: 3px solid var(--color-error); }
.proposal-card--high    { border-left: 3px solid var(--color-error); }
.proposal-card--medium  { border-left: 3px solid var(--color-warning); }
.proposal-card--low     { border-left: 3px solid var(--color-accent); }
.proposal-kpi-row { ... }
.proposal-kpi-pill { ... }

/* Inline tip */
.ai-inline-tip { ... }

/* Chat chips */
.chat-prompt-chips { ... }
.chat-prompt-chip  { ... }
.chat-prompt-chip:hover { ... }
.chat-sparkle-btn  { ... }   /* ✦ button in input row */
.chat-chips-popover { ... }
```

---

## i18n Keys (translations.js)

```js
// EN
aiProposals: {
  tabLabel: '✦ AI Ideas',
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Suggestion',
  dismiss: 'Dismiss',
  refresh: 'Refresh',
  empty: 'No proposals right now.',
  generatedNow: 'Generated on demand · now',
  backgroundScan: 'Background scan · {time} ago',
  chatChipsLabel: 'Suggested',
},
// ES equivalents required
```

---

## Out of Scope (v1)

- Persisting dismissed proposals to DB
- Generating proposals dynamically via Claude API (mock data only)
- Per-user proposal preferences
- Proposal analytics (which CTAs get clicked)
- Dynamic chat chips based on conversation history

---

## Acceptance Criteria

1. `✦ AI Ideas` tab visible with badge in Campaign Creation, Competitor Analysis, Studio, and Journey Builder
2. Proposals match Emirates context — real campaign names, real KPI numbers, Iran situation
3. Dismiss hides the card for the session (no persistence required)
4. Chat opens with prompt chips in the agent welcome message across all 4 sections
5. `✦` button in chat input opens popover with chips; clicking a chip auto-sends
6. All UI text in English (translations.js EN + ES)
7. No Tailwind, no hardcoded colors — CSS custom properties only
8. Zero new API endpoints required
