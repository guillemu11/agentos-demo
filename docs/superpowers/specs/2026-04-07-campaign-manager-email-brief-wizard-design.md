# Campaign Manager Email Brief Wizard — Design Spec

**Date:** 2026-04-07  
**Status:** Draft  
**Author:** Brainstorming session with Guillermo

---

## Context & Problem

Currently, the campaign creation flow has a clarity gap at handoff time:

- **PM Agent** defines the project at a strategic level (phases, pipeline, pain points, deliverables)
- **Content Agent (Lucía)** and **HTML Developer** execute in parallel or sequence
- But neither agent receives a structured email brief — they work from loose context and have to infer the email structure themselves

The `email_spec` field already exists on the `projects` table (JSONB), and is already injected into the system prompts of both Content Agent and HTML Developer. The missing piece is **who fills it** and **when**.

**Solution:** Make the Campaign Manager agent (Raul, `id: raul`) responsible for running a guided briefing flow in chat that produces a structured `email_spec` — the contract that Content Agent and HTML Developer execute against. Execution agents can extend the spec (add blocks, extract new variables), but the foundation is defined by Raul before execution begins.

---

## Goals

1. Raul guides the user through a 3–4 turn briefing flow in chat whenever a project has an email component and `email_spec` is empty or missing key fields
2. At the end of the flow, Raul emits a `[EMAIL_SPEC_UPDATE:{...}]` tag that the server intercepts and persists to `projects.email_spec`
3. A visual email brief card appears inside the Campaign Manager agent view (Active Campaigns tab), attached to the relevant campaign
4. A worklog event is recorded in the Activity tab when the brief is created or updated
5. Content Agent and HTML Developer receive the spec via their existing system prompt injection (already implemented in `packages/core/pm-agent/core.js`)
6. Execution agents can extend the spec non-destructively (add blocks, extract variables) — it is a living contract, not a lock

---

## Architecture

```
User ←→ Raul (chat, /api/chat/agent/raul)
              ↓ [EMAIL_SPEC_UPDATE:{...}] tag in response
         server.js handler intercepts tag
              ↓ jsonb_merge into projects.email_spec
              ↓ insert into pipeline_events (type: 'brief_created')
              ↓ SSE event: [BRIEF_ARTIFACT:{...}] to frontend
         CampaignManagerView
              ↓ renders EmailBriefCard in Active Campaigns tab
              ↓ renders activity event in Activity tab
```

Content Agent and HTML Developer already receive `email_spec` via `buildPipelineSystemPrompt()` — no changes needed there.

---

## Component 1: Raul's System Prompt — Email Brief Protocol

**File:** `packages/core/agents/profiles.js` → `raul.personality`  
**Also:** `agents` table row for `raul` → `personality` field (takes precedence over profiles.js)

Add an `## EMAIL BRIEF PROTOCOL` section to Raul's personality:

```
## EMAIL BRIEF PROTOCOL

Whenever you are working on a project that involves email (campaign, newsletter, reactivation, promotional, transactional) and the email_spec has no blocks defined yet, you MUST run the email brief flow BEFORE discussing execution or assigning agents.

The brief flow has a maximum of 4 turns:

Turn 1 — Email type & objective:
  Ask: What type of email is this and what is the primary goal?
  (e.g., promotional, reactivation, transactional, nurture — and the specific outcome: bookings, opens, revenue)

Turn 2 — Structure & sections:
  Ask: What are the main sections this email needs?
  (e.g., hero banner, flight offer, price table, CTA, footer — can be approximate, HTML Developer will refine)

Turn 3 — Tone & restrictions:
  Ask: What tone should this email have, and are there any restrictions?
  (e.g., reassuring not pushy, no discounts mentioned, legal disclaimer required)

Turn 4 — Key variables:
  Ask: What personalizable variables will this email need?
  (e.g., passenger name, destination, fare price, departure date — approximate is fine)

After Turn 4, synthesize the answers into a structured email spec and emit:

[EMAIL_SPEC_UPDATE:{
  "design_notes": "<tone + objective summary>",
  "blocks": [
    { "name": "<block_name>", "guidance": "<what this block should achieve>", "variables": ["@var1", "@var2"] }
  ],
  "variable_list": ["@var1", "@var2", "..."],
  "variable_context": {
    "@var1": "<description of what this variable holds>",
    ...
  }
}]

After emitting the tag, present a brief summary in markdown (not the raw JSON) showing the blocks and key variables so the user can read it naturally in chat.

If email_spec already has blocks defined, do NOT run the flow. Instead, acknowledge the existing spec and ask if the user wants to revise it.

The spec is a starting point. Content Agent and HTML Developer can extend it with new blocks or variables during execution — this is expected and encouraged.
```

---

## Component 2: Server — Tag Parsing & Persistence

**File:** `apps/dashboard/server.js`  
**Location:** Inside the `/api/chat/agent/:agentId` SSE stream handler, after assembling the full response

**Logic:**

```javascript
// After full response is assembled from stream:
const emailSpecMatch = fullResponse.match(/\[EMAIL_SPEC_UPDATE:([\s\S]*?)\]/);
if (emailSpecMatch) {
  try {
    const specUpdate = JSON.parse(emailSpecMatch[1]);
    // Merge into existing email_spec (non-destructive)
    await pool.query(`
      UPDATE projects 
      SET email_spec = email_spec || $1::jsonb
      WHERE id = $2
    `, [JSON.stringify(specUpdate), projectId]);

    // Record pipeline event
    await pool.query(`
      INSERT INTO pipeline_events (project_id, event_type, content, created_by)
      VALUES ($1, 'brief_created', $2, $3)
    `, [projectId, JSON.stringify({ spec: specUpdate, agent: 'raul' }), agentId]);

    // Emit SSE artifact event to frontend
    res.write(`data: [BRIEF_ARTIFACT:${JSON.stringify({ spec: specUpdate, timestamp: new Date().toISOString() })}]\n\n`);
  } catch (e) {
    console.error('Failed to parse EMAIL_SPEC_UPDATE', e);
  }
  // Strip the tag from the displayed response
  fullResponse = fullResponse.replace(/\[EMAIL_SPEC_UPDATE:[\s\S]*?\]/, '').trim();
}
```

**Note:** `projectId` must be passed in the request body from the frontend (already done in other agent endpoints — verify for `/api/chat/agent/:agentId`).

---

## Component 3: Email Brief Card in Campaign Manager View

**File:** `apps/dashboard/src/components/agent-views/CampaignManagerView.jsx`  
**New file:** `apps/dashboard/src/components/EmailBriefCard.jsx`

### EmailBriefCard component

Displayed below the phase indicators of each campaign card in the Active Campaigns tab, when `campaign.email_spec` has blocks.

**Visual structure:**
```
┌─────────────────────────────────────────────────────┐
│ 📋 Email Brief  ·  Defined by Raul · 7 Apr    [↓]  │
├─────────────────────────────────────────────────────┤
│ Objetivo: Reactivación post-disruption, tono        │
│ de bienvenida y reassurance                         │
│                                                     │
│ Bloques:  [hero] [offer_details] [cta] [footer]     │
│                                                     │
│ Variables: [@headline] [@fare_from] [@dest]         │
└─────────────────────────────────────────────────────┘
```

- Collapsible (default: collapsed if campaign is in early phase, expanded if in content/qa phase)
- If `email_spec` is empty: show a muted badge "Brief pendiente" with a button "→ Definir con Raul" that switches to the Chat tab
- Uses existing CSS classes: `.brief-block`, `.brief-variant-tag`, `.card`, CSS variables only

### CampaignManagerView changes

- Load `email_spec` from project data alongside campaign data
- Pass `email_spec` to each campaign card render
- Listen for `[BRIEF_ARTIFACT:{...}]` SSE events in the chat and update local state to re-render the card

---

## Component 4: Activity Feed Event

**File:** `apps/dashboard/src/components/agent-views/CampaignManagerView.jsx`  
**Activity tab** already renders `agent.recent_events` array.

When `[BRIEF_ARTIFACT:{...}]` SSE event is received:
- Add an entry to the local `recentEvents` state:
  ```javascript
  {
    timestamp: new Date().toISOString(),
    event_type: 'brief_created',
    content: 'Raul ha definido el email brief — 4 bloques, 6 variables'
  }
  ```
- `event_type: 'brief_created'` → renders with `activity-dot` color: `var(--accent-blue)`

---

## Data Flow Summary

| Step | Who | What |
|------|-----|-------|
| 1 | User | Opens Campaign Manager, chats with Raul about a new email campaign |
| 2 | Raul | Detects `email_spec` empty → runs 4-turn briefing flow |
| 3 | Raul | Emits `[EMAIL_SPEC_UPDATE:{...}]` tag in response |
| 4 | server.js | Intercepts tag → merges into `projects.email_spec` → inserts pipeline_event → emits `[BRIEF_ARTIFACT]` SSE |
| 5 | Frontend | Renders EmailBriefCard in campaign card + activity event |
| 6 | Content Agent | Receives `email_spec` via system prompt → generates copy per block |
| 7 | HTML Developer | Receives `email_spec` via system prompt → builds HTML structure |
| 8 | HTML Developer | Extracts new variables → auto-merges into `email_spec.variable_list` (existing logic) |

---

## Flexibility Rules

The `email_spec` is a **living contract**:

- Raul's brief is the foundation, not the ceiling
- HTML Developer can add blocks not in the original spec → `jsonb_merge` adds them without removing Raul's
- HTML Developer automatically extracts and adds variables (existing `variable_list` extraction logic)
- Content Agent can propose new copy blocks → system prompt already handles `[BRIEF_UPDATE]` for any block name
- If Raul updates the brief mid-campaign, it's an update event (`brief_updated`), not a replacement

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/core/agents/profiles.js` | Add EMAIL BRIEF PROTOCOL to `raul.personality` |
| `apps/dashboard/server.js` | Parse `[EMAIL_SPEC_UPDATE]` tag in `/api/chat/agent/:agentId` handler; emit `[BRIEF_ARTIFACT]` SSE event; insert pipeline_event |
| `apps/dashboard/src/components/agent-views/CampaignManagerView.jsx` | Listen for `[BRIEF_ARTIFACT]` SSE; pass `email_spec` to campaign cards; render EmailBriefCard; add activity event |
| `apps/dashboard/src/components/EmailBriefCard.jsx` | New component — brief card with blocks + variables display |
| `apps/dashboard/src/i18n/translations.js` | Add keys: `campaignManager.brief.pending`, `campaignManager.brief.definedBy`, `campaignManager.brief.defineWithRaul` |

---

## Files to Verify (existing logic, no changes expected)

| File | Why |
|------|-----|
| `packages/core/pm-agent/core.js` | `buildPipelineSystemPrompt()` already injects `email_spec` for Content Agent and HTML Developer — verify it covers all cases |
| `apps/dashboard/server.js` (variable extraction) | Already merges `variable_list` from HTML Developer output — confirm `jsonb_merge` is non-destructive |

---

## Verification

1. Start a new campaign project with email component
2. Open Campaign Manager → Chat tab → send a message to Raul
3. Raul should detect empty `email_spec` and start the briefing flow (4 turns)
4. After Turn 4, response should contain `[EMAIL_SPEC_UPDATE:{...}]` tag
5. Server logs should show: DB update + pipeline_event insert
6. `SELECT email_spec FROM projects WHERE id = <id>` → should show populated spec
7. Campaign Manager → Active Campaigns tab → campaign card should show EmailBriefCard with blocks and variables
8. Campaign Manager → Activity tab → should show "Raul ha definido el email brief" event
9. Open Email Studio for the same project → HTML Developer system prompt should include the blocks from the spec
10. Open Content Studio → Lucía's system prompt should include block guidance and variable context
