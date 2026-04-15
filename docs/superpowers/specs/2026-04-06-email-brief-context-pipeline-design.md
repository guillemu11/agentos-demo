# Email Brief Context Pipeline — Design Spec

**Date:** 2026-04-06  
**Branch:** feat/whatsapp-autoresearch-lab  
**Status:** Approved

---

## Problem

The Email Studio (HTML Developer Agent) and Content Studio (Content Agent Lucía) have disconnected contexts. Each agent improvises independently because the Campaign Brief contains no email-specific specification — no design structure, no content requirements, no variable definitions. This causes:

- Developer creates HTML with AMPscript variables that Lucía doesn't know about
- Lucía generates copy that the Developer hasn't structured for
- No shared contract forces both agents to work from the same intent
- Order of execution matters (shouldn't)

---

## Solution: Hybrid Brief-Driven Pipeline

The Campaign Brief becomes the **shared contract** for both execution agents. The `email_spec` field defines design structure + content requirements + variable mapping upfront. Both agents reference it independently. The system reconciles their outputs automatically.

---

## Architecture

### 1. Data Model — `email_spec` on `projects` table

**Migration:**
```sql
ALTER TABLE projects ADD COLUMN email_spec JSONB DEFAULT '{}';
```

**Shape:**
```json
{
  "design_notes": "Clean layout, white background, primary blue CTA button",
  "blocks": [
    {
      "name": "hero",
      "guidance": "Strong headline with destination + emotional benefit",
      "variables": ["@headline", "@preheader"]
    },
    {
      "name": "offer_details",
      "guidance": "Clear pricing, departure/arrival, benefit summary",
      "variables": ["@offer_body", "@fare_from"]
    },
    {
      "name": "cta",
      "guidance": "Urgent, action-oriented. 'Book Now' style.",
      "variables": ["@main_cta", "@cta_url"]
    }
  ],
  "variable_list": ["@headline", "@preheader", "@offer_body", "@fare_from", "@main_cta", "@cta_url"],
  "variable_context": {
    "@headline": "Main hero headline — destination + benefit",
    "@preheader": "Email preheader text",
    "@offer_body": "Offer details with pricing",
    "@fare_from": "Starting fare amount with currency",
    "@main_cta": "CTA button text",
    "@cta_url": "Landing page URL (use placeholder if unknown)"
  },
  "preview_version": 0,
  "html_version": 0
}
```

**`preview_version` / `html_version`:** Integer counters used for stale detection. When Developer saves new HTML, `html_version++`. When Lucía builds a preview, she saves her `preview_version = current html_version`. If they diverge → preview is stale.

---

### 2. Campaign Manager — Email Spec Section

**Location:** `CampaignDetail.jsx` (project brief detail view)  
**Trigger:** Always visible for projects — no hard gate, but shows a **warning badge** if `email_spec` is empty or has no blocks defined.

**Fields:**
- `design_notes` — Textarea: general design guidance for both agents
- `blocks[]` — Dynamic list: each block has `name` + `guidance` + `variables[]` (auto-populated from HTML, also manually editable)
- `variable_list` — Tag input: auto-synced from Developer's HTML; manually editable
- `variable_context` — Key-value editor: per-variable guidance for Lucía

**Warning badge logic:**
```
if email_spec is empty or email_spec.blocks.length === 0
  → show "⚠ Email Spec not defined — agents will work without shared contract"
```

**Save:** Extend `PUT /api/projects/:id` in `server.js` to include `email_spec` in the UPDATE query.

---

### 3. PM Agent Core — email_spec Injection

**File:** `packages/core/pm-agent/core.js` → `buildPipelineSystemPrompt()`

When `project.email_spec` is non-empty, inject into system prompt for both email-related agents:

**For HTML Developer (`html-developer` role):**
```
## Email Specification (Campaign Brief)
Design Notes: {email_spec.design_notes}

Required Blocks:
{blocks.map(b => `- ${b.name}: ${b.guidance} → Variables: ${b.variables.join(', ')}`)}

Use %%=v(@variable_name)=%% AMPscript syntax for all personalizable content.
Expected variables: {variable_list.join(', ')}
```

**For Lucía (`lucia` role / content agent):**
```
## Email Specification (Campaign Brief)
Content Requirements by Block:
{blocks.map(b => `- ${b.name}: ${b.guidance}`)}

Variable Guidance:
{variable_list.map(v => `- ${v}: ${variable_context[v] || 'No guidance defined'}`)}
```

If `email_spec` is empty, skip injection entirely (no change to existing behavior).

---

### 4. HTML Developer — Variable Extraction & Sync

**Trigger:** Every time the HTML Developer saves HTML (via `html_sources` event or PATCH command handled in `server.js`).

**Server-side logic (in the SSE handler / session update endpoint):**

```javascript
// Extract AMPscript variables from HTML
const variablePattern = /%%=v\(@(\w+)\)=%%/g;
const extracted = [...html.matchAll(variablePattern)].map(m => `@${m[1]}`);

// Merge into email_spec.variable_list (union, no duplicates, no removals)
const existing = project.email_spec?.variable_list || [];
const merged = [...new Set([...existing, ...extracted])];

// Auto-update blocks: for each extracted var, check if it's already in a block's variables[]
// If not found in any block, it goes into variable_list as unassigned (PM can assign in Campaign Manager)

// Increment html_version for stale detection
await pool.query(`
  UPDATE projects 
  SET email_spec = email_spec 
    || jsonb_build_object('variable_list', $1::jsonb)
    || jsonb_build_object('html_version', COALESCE((email_spec->>'html_version')::int, 0) + 1)
  WHERE id = $2
`, [JSON.stringify(merged), projectId]);

// Save extracted_variables in session deliverables
await updateSessionDeliverables(sessionId, { extracted_variables: extracted });
```

---

### 5. Content Studio — Variable Fill Mode

#### 5a. Context injection on session init

When initializing Lucía's session (`/api/projects/:id/sessions` → `initialize`), server checks if HTML Developer has completed deliverables:

```javascript
const developerSession = completedSessions.find(s => s.agent_id === 'html-developer');
if (developerSession?.deliverables?.html) {
  // Inject into system prompt:
  systemPrompt += `\n\n## Email Template (from HTML Developer)\n`;
  systemPrompt += `The following HTML template was created. It uses AMPscript variables %%=v(@var)=%% `;
  systemPrompt += `that you must fill with campaign-appropriate content.\n\n`;
  systemPrompt += `Extracted variables: ${developerSession.deliverables.extracted_variables?.join(', ')}\n`;
  systemPrompt += `HTML: (see context below)\n${developerSession.deliverables.html.substring(0, 8000)}`;
}
```

If no HTML exists yet, Lucía still gets `email_spec` blocks + guidance — she works from the spec, generating `content_by_block` deliverables.

#### 5b. Output format — Lucía fills variables

Lucía outputs a special tagged block when filling variables:

```
[EMAIL_VARIABLES]
@headline: Fly Business Class to Dubai from AED 2,499
@preheader: Limited time offer — award-winning comfort awaits
@offer_body: Experience flatbed seats, gourmet dining, and complimentary chauffeur
@fare_from: AED 2,499
@main_cta: Book Now
@cta_url: https://www.emirates.com/business-class
[/EMAIL_VARIABLES]
```

**Server parsing** (in `server.js` SSE handler, similar to `[BRIEF_UPDATE]` pattern):

```javascript
const EMAIL_VARS_PATTERN = /\[EMAIL_VARIABLES\]([\s\S]*?)\[\/EMAIL_VARIABLES\]/;
const match = content.match(EMAIL_VARS_PATTERN);
if (match) {
  const variables = {};
  match[1].trim().split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key.trim().startsWith('@')) {
      variables[key.trim()] = valueParts.join(':').trim();
    }
  });
  
  // Build preview HTML: replace %%=v(@var)=%% with actual values
  let previewHtml = developerSession.deliverables.html;
  for (const [varName, value] of Object.entries(variables)) {
    const varKey = varName.replace('@', '');
    previewHtml = previewHtml.replaceAll(`%%=v(@${varKey})=%%`, value);
  }
  
  // Save to Lucía's deliverables
  const currentHtmlVersion = project.email_spec?.html_version || 0;
  await updateSessionDeliverables(luciaSessionId, {
    variable_values: variables,
    content_preview_html: previewHtml,
    preview_version: currentHtmlVersion
  });
}
```

#### 5c. Lucía-first flow (no HTML yet)

When Lucía runs before the Developer:

```
[CONTENT_BY_BLOCK]
block: hero
@headline: Fly Business Class to Dubai from AED 2,499
@preheader: Limited time offer — award-winning comfort awaits

block: cta
@main_cta: Book Now
@cta_url: https://www.emirates.com/business-class
[/CONTENT_BY_BLOCK]
```

Server saves `content_by_block` in Lucía's deliverables. When the Developer later finishes his HTML, the server auto-matches variables to Lucía's block content and builds the preview without requiring Lucía to re-run.

#### 5d. New variable auto-fill (when Developer adds a block mid-process)

When `html_version > preview_version` (stale detection):

- Server builds a delta: new variables in HTML not present in `variable_values`
- Lucía's next response is primed with: "New variables detected: `@newVar`. Fill them based on the campaign brief."
- Lucía auto-fills without asking for confirmation
- Preview is rebuilt and `preview_version` is updated

#### 5e. Block suggestions from Lucía

If Lucía identifies content that doesn't have a matching variable, she can suggest:

```
[SUGGEST_BLOCK]
name: social_proof
content: Over 2M customers choose Emirates Business Class every year
reason: Social proof near the CTA increases conversion
[/SUGGEST_BLOCK]
```

Email Studio shows a notification badge. Developer can accept → creates the HTML block → Lucía auto-fills the variable.

---

### 6. Email Studio Preview — Content Preview Mode

**File:** `EmailBuilderPreview.jsx`

Add toggle in the preview panel header:
- **"Template"** (default) — renders current HTML as-is (AMPscript vars visible as placeholders)
- **"Content Preview"** — renders Lucía's filled HTML preview

```jsx
// New endpoint
GET /api/projects/:id/content-preview-html
// Returns: { html: string, preview_version: number, html_version: number, is_stale: boolean }
```

When `is_stale === true`: show a banner "⚠ Content preview is outdated — Developer added new blocks. Ask Lucía to refresh."

---

## Data Flow Summary

```
Campaign Manager
  └─ PM fills email_spec: design_notes + blocks + variable guidance
       └─ Warning badge if empty (not a blocker)

ANY ORDER:

Email Studio (HTML Developer)
  └─ System prompt includes: email_spec design_notes + variable list
  └─ Developer generates HTML with %%=v(@var)=%%
  └─ Server extracts variables → auto-updates email_spec.variable_list
  └─ html_version++

Content Studio (Lucía)
  └─ System prompt includes: email_spec content requirements + variable guidance
  └─ If HTML exists: inject template + variable list
  └─ Lucía outputs [EMAIL_VARIABLES] or [CONTENT_BY_BLOCK]
  └─ Server builds content_preview_html
  └─ preview_version = html_version (in sync)

Email Studio Preview
  └─ Toggle: Template | Content Preview
  └─ Stale badge if html_version > preview_version

Incremental updates:
  └─ Developer adds block → html_version++ → preview marked stale → Lucía auto-fills new vars
  └─ Lucía suggests block → Developer adds → variable auto-filled
```

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/core/db/schema.sql` | Add `email_spec JSONB DEFAULT '{}'` to projects |
| `apps/dashboard/server.js` | Extend PUT /api/projects/:id; add variable extraction logic; add GET /api/projects/:id/content-preview-html; parse [EMAIL_VARIABLES] and [CONTENT_BY_BLOCK] tags |
| `packages/core/pm-agent/core.js` | Inject email_spec into system prompts for html-developer and lucia roles |
| `apps/dashboard/src/pages/CampaignDetail.jsx` | Add Email Spec section with warning badge |
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Add Template / Content Preview toggle |
| `apps/dashboard/src/i18n/translations.js` | Add new translation keys |

---

## Verification

1. Create/update a Campaign Brief → fill Email Spec section → verify warning disappears
2. Go to Email Studio → start HTML Developer session → verify email_spec is in system prompt → generate HTML with `%%=v(@headline)=%%` → verify variable_list auto-updates in Brief
3. Go to Content Studio → verify Lucía's system prompt includes the HTML template and variable guidance → ask Lucía to fill variables → verify `[EMAIL_VARIABLES]` block is parsed → verify Content Preview appears in Email Studio
4. Go to Email Studio → Developer adds a new block with new variable → verify preview badge shows "stale" → verify Lucía auto-fills on next interaction
5. Test Lucía-first: go to Content Studio before Developer has run → verify `[CONTENT_BY_BLOCK]` flow → then run Developer → verify auto-merge builds the preview
