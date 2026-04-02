# Content Agent — Chat + Brief Sidebar Design

**Date:** 2026-04-02  
**Status:** Approved  
**Scope:** ContentAgentView chat tab + brief sidebar + handoff to HTML Developer

---

## Problem

The Content Agent's current chat tab is a generic `AgentChatSwitcher`. It has no way to track what pieces have been generated, no visibility across market variants (EN/ES/AR), and no structured path to pass the finished brief to the HTML Developer agent.

---

## Solution Overview

Replace the generic chat in the `ContentAgentView` with a **split layout**: a 2/3-width chat panel on the left and a 1/3-width **Brief Sidebar** on the right. The sidebar tracks the state of each email block (Subject, Hero Image, Body Copy, CTA) across multiple market variants. When all blocks are complete, a handoff button passes the full multi-market brief to the HTML Developer via the existing `HandoffModal`.

---

## Layout

```
┌─────────────────────────────┬──────────────────┐
│  Chat Panel (2/3)           │  Brief Sidebar    │
│                             │  (1/3)            │
│  [agent header]             │  [tabs EN/ES/AR+] │
│                             │                   │
│  messages...                │  SUBJECT LINE ✓   │
│  ┌─────────────────────┐    │  HERO IMAGE   ⏳  │
│  │ subject cards inline│    │  BODY COPY    —   │
│  │ EN ✓ ES ✓ AR ⏳     │    │  CTA BUTTON   —   │
│  └─────────────────────┘    │                   │
│                             │  [progress bar]   │
│  [text input]               │  [handoff btn]    │
└─────────────────────────────┴──────────────────┘
```

---

## Components

### `ContentChatPanel.jsx`
New component replacing `AgentChatSwitcher` inside `ContentAgentView` (chat tab only).

**Props:**
- `agent` — agent object
- `ticket` — active ticket (provides campaign context)
- `brief` — brief state object (lifted up)
- `onBriefUpdate(market, block, value)` — callback to update brief state
- `onHandoff()` — callback to trigger handoff modal

**Responsibilities:**
- Text input (prompts only — no file upload)
- SSE streaming to `/api/agents/:id/chat`
- Renders agent messages normally
- When agent response includes a `brief_update` payload, renders inline block cards (e.g. 3 subject lines with ✓/↻ per market)
- Approve (✓) calls `onBriefUpdate`, regenerate (↻) sends a new prompt automatically

### `ContentBriefSidebar.jsx`
New component always visible in the chat tab split layout.

**Props:**
- `brief` — brief state object
- `onBriefUpdate(market, block, value)` — edit a block manually
- `onHandoff()` — trigger handoff when brief is complete
- `markets` — array of active markets (default: `['en','es','ar']`)

**Responsibilities:**
- Market tabs (EN / ES / AR / +)
- 4 blocks per tab: Subject Line, Hero Image, Body Copy, CTA Button
- Block states: `pending` (—) / `generating` (⏳) / `approved` (✓ green)
- Inline edit (pencil icon) for any approved block
- Global progress bar: shows `EN 2/4 · ES 1/4 · AR 0/4`
- Handoff button: disabled + tooltip when any block is pending; enabled when all markets × all blocks are complete

### Brief State Shape

```js
// lifted to ContentAgentView state
const brief = {
  en: {
    subject:  { status: 'approved', value: 'Your next adventure awaits ✈️' },
    heroImage:{ status: 'generating', value: null },
    bodyCopy: { status: 'pending', value: null },
    cta:      { status: 'pending', value: null },
  },
  es: { subject: {...}, heroImage: {...}, bodyCopy: {...}, cta: {...} },
  ar: { subject: {...}, heroImage: {...}, bodyCopy: {...}, cta: {...} },
}
```

---

## AI Generation Flow

1. User types prompt in chat
2. Chat sends to `/api/agents/:id/chat` with ticket context
3. Agent backend:
   - Queries Pinecone for relevant brand assets/guidelines
   - Generates copies via Gemini
   - Generates images via image model (existing `/api/agents/generate-image`)
   - Returns SSE stream; structured blocks are tagged with `[BRIEF_UPDATE]` JSON payload
4. Frontend parses `[BRIEF_UPDATE]` payloads and calls `onBriefUpdate`
5. Inline cards appear in the chat bubble showing the generated values per market
6. User approves (✓) or requests regeneration (↻) per market

---

## Handoff Behavior

**Trigger:** User clicks "→ Pasar a HTML Developer"

**Conditions:**
- Enabled: all blocks for all active markets are `approved`
- Disabled: any block is `pending` or `generating` — shows tooltip "Completa todos los bloques primero"
- Force handoff: secondary action (right-click / small link below button) allows partial handoff if user explicitly wants it

**Payload passed to HandoffModal:**
```js
{
  fromAgent: 'content-agent',
  toAgent:   'html-developer',
  ticket:    ticket,
  brief:     brief,  // full multi-market object
  summary:   'Email campaign brief — EN/ES/AR — Qatar Airways Reactivación Q2'
}
```

Uses existing `HandoffModal.jsx` — no changes to that component.

---

## Integration Points

- `ContentAgentView.jsx` — lifts `brief` state, replaces `AgentChatSwitcher` in chat tab with new split layout
- `HandoffModal.jsx` — no changes, receives brief as context payload
- `/api/agents/:id/chat` — backend needs to emit `[BRIEF_UPDATE]` SSE events when generating structured content (new backend behavior)
- `/api/agents/generate-image` — already exists, reused for hero images
- Pinecone — already integrated in KB pipeline; agent backend queries it for brand assets during content generation

---

## Out of Scope

- Pipeline board chat — separate design, not covered here
- GenericAgentView chat — not affected
- HTML Developer view — not modified, only receives handoff payload
- File upload in chat — not needed (assets come from Pinecone)

---

## i18n Keys Needed

```
contentAgent.briefSidebar        — "Brief en construcción"
contentAgent.blocksProgress      — "{done}/{total} bloques"
contentAgent.handoffButton       — "Pasar a HTML Developer"
contentAgent.handoffIncomplete   — "Completa todos los bloques primero"
contentAgent.blockSubject        — "Subject Line"
contentAgent.blockHeroImage      — "Hero Image"
contentAgent.blockBodyCopy       — "Body Copy"
contentAgent.blockCta            — "CTA Button"
contentAgent.statusApproved      — "aprobado"
contentAgent.statusGenerating    — "generando"
contentAgent.statusPending       — "pendiente"
contentAgent.addMarket           — "+ Mercado"
```
