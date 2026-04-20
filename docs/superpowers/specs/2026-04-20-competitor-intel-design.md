# Competitor Intel — DERTOUR Lifecycle Audit

**Status:** Design approved 2026-04-20
**Author:** Guillermo
**Target demo:** Friday 2026-04-24 — Sarah Shaughnessy (SVP Online Marketing, Emirates)
**Follow-up deliverable:** Analysis 5 .docx, post-demo

## Purpose

Deliver a defensible lifecycle / email / customer journey audit of 5 DERTOUR UK brands (Kuoni, Carrier, Inntravel, Explore Worldwide, CV Villas) that complements the 4 existing web-audit analyses in `DERTOUR/`. The existing analyses are 100% public web audits; this spec covers the gap — real subscriptions, real inboxes, real engagement, real triggered journeys.

The work produces two artifacts:

1. **Live dashboard in AgentOS** (`/competitor-intel`) — the primary demo surface on Friday.
2. **Analysis 5 .docx** — exported from the dashboard post-demo, consistent with the existing 4 docs in tone, scoring structure, and format.

The module is designed to be **reusable**: next investigation ("Etihad audit", "Virgin Atlantic audit") is a new row in `competitor_investigations`, not a code change.

## Scope

### In scope (this week)

- 2 synthetic personas backed by real Gmail accounts:
  - **Sarah** — luxury honeymooner, 34, UK (SW1A postcode), high budget
  - **Tom** — adventure solo traveler, 29, UK, mid budget
- 6 playbook runs across 5 brands (Inntravel gets both personas for segmentation comparison)
- 8-step base playbook per run (recon → subscribe → double opt-in → wait → account → preference center → quote/high-intent → cart abandonment)
- Gmail API ingestion (read-only scope) polling every 5 min
- Two-phase email classification: domain match (phase 1) + Claude Sonnet LLM (phase 2)
- Hybrid engagement simulator (welcomes + transactional always opened; rest follows persona pattern)
- 6 dashboard screens (Overview, Brand detail, Persona detail, Comparative, Insights/Export, Emirates Holidays gap)
- .docx exporter using `python-docx` matching the structure of the existing 4 analyses
- Investigation seed: "DERTOUR UK Lifecycle Audit – April 2026"

### Out of scope (this week, roadmap visible in UI)

- Playwright-automated signup (kept in roadmap, not executed)
- Fully simulated browsing behavior (cart abandonment done manually by user)
- 6th brand as a separate demo — replaced by the live dashboard on real data
- Auto-unsubscribe
- Reply/engagement simulation beyond opens + clicks
- UK-residential proxy for IP geolocation (roadmap, not Friday-critical)

## Architecture

### High-level shape

```
Investigation (root)
 ├── Brands (5)                                 — recon notes, scoring
 ├── Personas (2) + Gmail OAuth credentials     — encrypted tokens
 ├── Playbook runs (6) × 8 steps each           — ordered actions, timestamps
 ├── Emails (ingested from Gmail API)           — classified, HTML preserved
 ├── Engagement events (opens, clicks)          — simulated hybrid pattern
 ├── Brand scores (4 axes + overall)            — manual with evidence
 └── Insights                                   — written by user, evidence-linked
```

### Key modules

- **`packages/core/competitor-intel/`** — domain logic, shared by backend
  - `gmail-ingestion.js` — polling worker, token refresh, idempotent insert
  - `email-classifier.js` — phase 1 (domain) + phase 2 (LLM batch)
  - `engagement-simulator.js` — opens/clicks per persona pattern
  - `scoring.js` — 4-axis calculator + overall weighting
  - `docx-exporter.js` — Analysis 5 generation matching existing tone
  - `recon.js` — firecrawl-based web recon (ESP/CDP/form detection)

- **`apps/dashboard/src/pages/CompetitorIntel/`** — 6 React screens
- **`server.js`** — new endpoints under `/api/competitor-intel/*` and `/api/oauth/google/*`

### Data flow

1. User subscribes to a brand on the real web → marks step done in dashboard with timestamp.
2. Gmail ingestion worker polls every 5 min, inserts new emails (idempotent by `gmail_message_id`).
3. Phase 1 classifier assigns `brand_id` by sender domain; unresolved emails queued for phase 2.
4. Phase 2 LLM batch (every 15 min) resolves ambiguous emails with `{ brand_id, type, confidence, reasoning }`.
5. Engagement simulator fires opens/clicks per persona pattern (hybrid C): welcomes + transactional always opened; other types per persona probability and interest keywords.
6. Dashboard recomputes scoring and refreshes Overview/Comparative views.

## Database schema (Railway Postgres)

All DDL applied against Railway directly + reflected in `packages/core/db/schema.sql` (rule #7).

```sql
competitor_investigations
  id serial pk, name text, description text,
  owner_user_id int fk, status text, created_at timestamptz

competitor_brands
  id serial pk, investigation_id int fk, name text, website text,
  category text, positioning text, recon_notes jsonb

competitor_personas
  id serial pk, investigation_id int fk, name text, age int,
  location text, profile jsonb
  -- profile: travel_interests[], budget_band, demographics, engagement_pattern

competitor_persona_gmail
  persona_id int pk fk, email text, access_token_encrypted text,
  refresh_token_encrypted text, token_expiry timestamptz, last_sync_at timestamptz

competitor_playbook_steps
  id serial pk, brand_id int fk, persona_id int fk, step_order int,
  action text, channel text, data_to_provide jsonb,
  expected_signal text, wait_after_minutes int,
  status text check (status in ('pending','ready','done','skipped')),
  executed_at timestamptz, notes text

competitor_emails
  id serial pk, persona_id int fk, brand_id int fk null,
  gmail_message_id text unique, sender_email text, sender_domain text,
  subject text, received_at timestamptz,
  body_text text, body_html text, classification jsonb, raw_headers jsonb
  -- classification.type: welcome|double_opt_in|nurture|promo|abandonment
  --                    |transactional|preference_update|re_engagement
  --                    |triggered_click_followup|other

competitor_email_engagement
  id serial pk, email_id int fk, event_type text, link_url text null,
  occurred_at timestamptz, simulated boolean default true

competitor_brand_scores
  brand_id int pk fk, lifecycle_maturity numeric, email_sophistication numeric,
  journey_depth numeric, personalisation numeric, overall numeric,
  last_calculated_at timestamptz, manual_notes text

competitor_insights
  id serial pk, brand_id int fk null, category text, severity text,
  title text, body text, evidence_email_ids int[], created_at timestamptz
```

Token encryption: AES-256-GCM, key in `.env` as `COMPETITOR_INTEL_KEY`, same pattern as MC API creds.

## Gmail ingestion & classification

### OAuth

- Google Cloud project "AgentOS Competitor Intel" in Testing mode (up to 100 users, no verification needed)
- Scope: `https://www.googleapis.com/auth/gmail.readonly`
- Flow: button "Connect Gmail" on persona detail page → standard OAuth2 → callback stores encrypted tokens
- User creates both Gmails manually (phone verification is unavoidable) and authorizes once. ~15 min total.

### Ingestion worker

- `setInterval` 5 min in `server.js`
- Per persona: `users.messages.list` with `after:<last_sync_at>` and `includeSpamTrash: true`, `q: -from:me -category:social`
- Per message: `users.messages.get` format=full → parse headers, bodies, attachment metadata
- Insert into `competitor_emails`, idempotent by `gmail_message_id`
- Token refresh automatic via `refresh_token`, one retry on 401

### Classification

**Phase 1 (sync, on insert):** `sender_domain` matched against `competitor_brands.website` and known ESP subdomains per brand. Resolves ~90% of emails at zero cost.

**Phase 2 (async, batch every 15 min):** Claude Sonnet call for unresolved or low-confidence emails. Prompt: subject + first 500 chars of body + brand list. Returns `{ brand_id, type, confidence, reasoning }` into `classification` jsonb.

### Engagement simulator (hybrid pattern C)

- **Always opened, zero delay:** `welcome`, `double_opt_in`, `transactional`, `preference_update`
- **Per persona probability + keyword interest:** `nurture`, `promo`, `triggered_click_followup`, `re_engagement`
  - Sarah (luxury): opens 80%, clicks if subject/preheader contains `{maldives, seychelles, mauritius, honeymoon, overwater, private villa}`
  - Tom (adventure): opens 60%, clicks if subject/preheader contains `{trek, hike, adventure, small group, patagonia, himalaya, kilimanjaro}`
- Opens = GET every tracking pixel in HTML with realistic User-Agent ("Mozilla/5.0 ... Gmail web")
- Clicks = GET target URL with `redirect: manual`, recording the 302 Location header only (no landing fetch)
- Server IP is Railway default (not UK). Acceptable risk; UK proxy in roadmap.
- All events logged in `competitor_email_engagement` with `simulated=true`

## Playbook (8-step base)

Applied identically to each of the 6 runs. Divergence per brand happens at step 7 based on recon findings.

1. **Passive recon** — visit homepage, accept essential cookies only. Detect cookie wall, tracking, CDP.
2. **Newsletter sign-up** — minimal data from persona profile, via footer or popup.
3. **Double opt-in** — click confirmation link if present.
4. **Wait 24h** — observe emails with zero further action.
5. **Account creation** — create account if available, same persona data.
6. **Preference center discovery** — find preferences UI, document granularity.
7. **Quote request / high-intent action** — brand-specific (see divergence table).
8. **Cart abandonment test** — fill form/cart to ~90%, abandon. Observe 24/48/72h.

### Step 7 divergence (hypothesis; refined Monday after recon)

| Brand | Step 7 |
|---|---|
| Kuoni | Phone/long-form quote request (luxury, likely no online cart) |
| Carrier | Consultant-assigned quote (ultra-luxury, 1-to-1) |
| Inntravel | Real cart to checkout, abandon |
| Explore | Real cart with deposit booking, abandon at deposit |
| CV Villas | Villa booking flow, abandon at payment |

### Persona × brand assignment

- **Sarah (luxury):** Kuoni, Carrier, Inntravel
- **Tom (adventure):** Explore, CV Villas, Inntravel
- Inntravel receives both → segmentation comparison insight

## Dashboard UI (6 screens)

Route `/competitor-intel` inside existing Layout. All screens use existing CSS custom properties (rule #2), i18n ES+EN (rule #3), reuse existing cards/tables/modals, Recharts for heatmap/timeline.

### 1. Overview

Header with investigation title + last activity timestamp. Grid of 5 brand cards: overall score, 4 sub-scores as bars, stats (`12 emails · 4/8 steps done · last email 2h ago`), color-coding by maturity (red/amber/green). Live activity feed on side.

### 2. Brand detail (5 pages)

Three tabs:
- **Playbook** — 8 steps list with status, current step prominent with action/data/Mark done, future steps greyed with countdown.
- **Inbox** — table of brand emails, modal on click with HTML render + classification reasoning + playbook trigger. Engagement controls per email.
- **Scoring** — 4 axes with sliders 0–10 + justification textareas, auto-generated evidence list per axis, editable overall weighting.

### 3. Persona detail (2 pages)

Unified inbox across brands with filters. Horizontal timeline with one lane per brand. "Data capture view" — what each brand knows about the persona, deduced from submitted forms.

### 4. Comparative view ⭐ (the demo screen)

**Top — "Time to first touch":** grid 5×1, each brand showing minutes/hours from signup to first useful email (excluding confirmations), plus qualitative chip (personalised/segmented/generic/none).

**Bottom — "Lifecycle depth heatmap":** matrix brands × lifecycle stages (Welcome, Nurture, Triggered, Re-engagement, Abandonment, Post-purchase). Cells green/amber/red/black per evidence. Click = emails list.

**Stretch goal:** "Play the week in 30 seconds" — accelerated timeline animation. Only if Thursday evening has margin.

### 5. Insights & Export

User-written insights list, each linked to emails as evidence. "Export to .docx" button runs `docx-exporter.js` → downloads Analysis 5 matching existing tone/structure. Inline preview before download.

### 6. Emirates Holidays gap view

Ingests Analysis 4's scoring (Emirates Holidays 7.2) via `python-docx` parsing → stored as reference in DB. Side-by-side with lived DERTOUR scores. Two panels: "Where DERTOUR brands beat Emirates Holidays" and "Where Emirates Holidays could learn from DERTOUR".

## Weekly execution plan

Two parallel tracks, no cross-dependencies.

### Monday

- **AM — Track B (me):** worktree `feat/competitor-intel`. Migration (all tables) + schema.sql. Google Cloud OAuth project + callback endpoint. Seed (investigation, 5 brands, 2 personas, 6 playbook runs). Layout + route. **Automated recon of 5 sites** via firecrawl + tech stack detection (ESP, CDP, form fields, cookie wall, account creation availability, cart type). Test-run with mail.tm where accepted, capturing welcome structure. Deliverable to user: per-brand recon notes in dashboard with risks flagged; playbooks refined with real data.
- **AM — Track A (user):** **only** create 2 new Gmails with phone verification (~10 min) and authorize OAuth in dashboard (~5 min). Nothing else.
- **PM — Track A (user):** execute steps 1+2 (recon + signup) on all 5 brands with refined playbooks.

### Tuesday

- **Track B:** Gmail ingestion worker (5-min polling). Phase 1 classifier. Screens 1 + 3 functional with real emails flowing.
- **Track A:** step 3 (double opt-in when arrives), step 5 (account creation where available). ~30 min morning, 30 min afternoon.

### Wednesday

- **Track B:** Screen 2 (brand detail, 3 tabs). Phase 2 LLM classifier. Engagement simulator hybrid C. Manual scoring + auto overall.
- **Track A:** steps 6 + 7 (preference center + quote/high-intent). ~1h.
- **Checkpoint:** internal dashboard demo midday, decide if any screen gets cut.

### Thursday

- **Track B AM:** Screen 4 (Comparative) — the demo screen. Screen 6 (Emirates gap) with Analysis 4 .docx ingestion. Export .docx.
- **Track A AM:** step 8 (cart abandonment) — highest-signal step. ~1h.
- **Track A PM:** write insights directly in dashboard (2–3 per brand, evidence-linked). Manual scoring adjustments. ~2–3h.
- **Track B PM:** polish + rehearsal fixes.
- **Checkpoint:** full demo rehearsal Thursday evening.

### Friday

- **AM:** 20-min rehearsal. Demo with Sarah.
- **Stretch only:** "Play the week in 30 seconds" if margin exists.

### Post-demo (weekend or Monday)

- Export → .docx → user review → send to Ian/Sarah.

## Risks & mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Aggressive captcha on brand signup | Medium | User subscribes manually; system only ingests emails |
| Double opt-in >24h | Low | Nil impact — the delay is itself data |
| Gmail OAuth verification friction | Very low | Testing mode supports up to 100 users |
| ESP sends from unknown domain | Medium | Phase 2 LLM classifier resolves |
| Thursday dashboard at 80% not 100% | Medium | Priority: Screen 4 + Export. Screen 6 sacrificable, then Screen 3, then "Play the week" |
| Sarah cancels Friday | Low-medium | Dashboard intact, replan |
| Firecrawl UA blocked | Medium | Fallback to native WebFetch |
| Inconclusive ESP detection | Medium | Infer from email headers post-first-welcome |
| mail.tm rejected by Kuoni/Carrier | High | Skip; passive recon only for those |

## Constraints & project rules honored

- Rule #1 — 100% standalone module, no external imports
- Rule #2 — CSS custom properties only, no Tailwind
- Rule #3 — all UI text in `translations.js` (ES + EN)
- Rule #4 — dynamic `API_URL`
- Rule #5 — single `server.js`, new endpoints added there
- Rule #6 — parametrized queries everywhere
- Rule #7 — Railway as single source of truth, DDL direct + reflected in schema.sql
- Rule #8 — aligned with ROADMAP.md (competitive intelligence fits AgentOS "OS for teams working with AI agents")

## Ethics & compliance

- Subscriptions made with genuine consent from user-owned Gmails — no impersonation of third parties.
- Gmail read-only scope; no sending, no modification.
- Engagement simulation within each persona's consistent pattern; no bot-like flooding.
- No scraping of brand backends; only ingestion of emails voluntarily received.
- `includeSpamTrash` enabled to capture full delivery reality; does not alter brand-side metrics.
- No unsubscribe automation — user can unsubscribe manually post-investigation.

## Success criteria

1. Friday demo: Screens 1, 2, 4, 5 fully functional with real data from all 5 brands.
2. At least 10 classified emails across the investigation, with evidence-linked insights.
3. "Time to first touch" comparison screen populated and defensible.
4. Export button produces a .docx consistent in structure and tone with Analyses 1–4.
5. Module reusable: creating a second investigation is purely data, no code change.
