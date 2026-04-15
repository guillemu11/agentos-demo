# Campaign Calendar with AI Intelligence — Design Spec

**Date:** 2026-04-16
**Owner:** Guillermo Muñoz
**Status:** Design approved — ready for implementation plan

## Summary

A new standalone page at `/app/calendar` that shows all Emirates campaigns (BAU + lifecycle) on a Gantt/timeline view, with an AI-powered intelligence panel that surfaces risks, opportunities and historical insights. Added to the `Control` section of the sidebar nav.

Addresses Emirates' recurring complaint that they lack a unified calendar view across campaigns, and leapfrogs standard ESP tools by layering Claude-generated insights on top.

## Goals

- Give Emirates a single-pane view of every campaign (BAU + lifecycle) on a monthly/weekly/daily/yearly timeline.
- Detect scheduling risks (segment overload, BAU-lifecycle collisions, EN/AR imbalance) deterministically.
- Generate narrative AI insights (opportunities, historical patterns) using Claude with the full campaign dataset as context.
- Provide a "wow" moment: AI Health Score, visual conflict detection, concrete historical-data-backed recommendations.

## Non-Goals

- No campaign creation/editing from the calendar (view-only for MVP).
- No real data pipeline to SFMC. Data comes from existing mock files (`emiratesCampaigns.js`, `emiratesBauTypes.js`). Real data is a future phase.
- No drag-and-drop rescheduling.
- No multi-user collaboration (comments, mentions, etc.).

## User Flow

1. User clicks **Calendar** in the sidebar (Control group).
2. Lands on `/app/calendar`, monthly view of current month by default.
3. Sees Gantt timeline with campaigns grouped by category + AI panel on the right.
4. Can filter by type/category/channel, navigate months, switch to Year/Week/Day views.
5. Clicks a campaign bar → detail panel shows historical KPIs, segment, channel, status.
6. Clicks an AI alert → can dismiss it, mark as reviewed, or navigate to the affected campaign.

## Architecture

### Nav integration

Added to `Layout.jsx` under the `control` group:

```
- Inbox
- Knowledge Base
- Journeys
- Calendar  ← NEW
```

Icon: `Calendar` from `lucide-react`. Translations in `translations.js` under `layout.calendar`.

### Routing

New route in `apps/dashboard/src/main.jsx`:

```
<Route path="/calendar" element={<CampaignCalendarPage />} />
```

### Page structure

`apps/dashboard/src/pages/CampaignCalendarPage.jsx` owns the view. Composed of:

- `CalendarTopbar` — title, month navigator, view switcher, filter button, AI Health Score.
- `CalendarFilterBar` — category + channel chips.
- `CalendarGantt` — the timeline. Receives resolved campaign events + scale (year/month/week/day).
- `AiIntelligencePanel` — right sidebar with risks/opportunities/insights.
- `CampaignDetailCard` — shown inside AI panel when a bar is selected.

All components live in `apps/dashboard/src/components/calendar/`.

### Data model

A **campaign event** (what ends up on the Gantt) has three flavors based on predictability:

| Flavor | Source | Behavior |
|--------|--------|----------|
| `fixed` | Hardcoded schedule (e.g. Statement on the 14th of each month) | Point or single-day bar |
| `scheduled` | `BAU_CAMPAIGN_TYPES[].recentCampaigns[].date` | Single bar on a specific date |
| `always-on` | `CAMPAIGNS[]` lifecycle entries (Cart Abandon, Churn, Pre-Flight, Post-Flight NPS) | Continuous bar across the full visible range, with volume-projected label |

A dedicated builder `buildCalendarEvents(rangeStart, rangeEnd)` in `apps/dashboard/src/lib/calendarEvents.js` consumes the two mock files and returns a unified `CalendarEvent[]`:

```js
{
  id: 'broadcast-emirates-apr-2026',
  campaignId: 'broadcast-emirates',
  campaignName: 'BroadCast Emirates',
  group: 'broadcast',          // category id (from BAU_CATEGORIES)
  flavor: 'scheduled',
  startDate: '2026-04-03',
  endDate: '2026-04-03',
  channel: 'email',
  segment: 'All Active Skywards',
  language: 'EN+AR',
  color: '#D71920',
  kpis: { openRate: 29.1, ctr: 3.4, conversions: 4100 },
  status: 'scheduled',
}
```

### AI detection engine (hybrid)

**Rules layer** — pure JS in `apps/dashboard/src/lib/calendarAiRules.js`. Given `CalendarEvent[]`, detects:

1. **Segment overload** — ≥2 scheduled events hitting the same segment within 24h.
2. **BAU-lifecycle collision** — scheduled BAU on same day an always-on program has elevated projected volume, on same segment.
3. **EN/AR imbalance** — campaign with one language missing when the segment expects both (Dubai/UAE + Arabic-speaking regions).
4. **Coverage gap** — tier segment (Silver/Gold/Platinum) with no touchpoint for >10 days.
5. **Holiday window gaps** — known holiday (Eid, Ramadan end, Christmas) within range with no Holiday/Event Offer scheduled.
6. **Frequency anomaly** — week with send count >2× historical median for that campaign type.
7. **Performance-based opportunity** — historical campaign (same `bau_type` + same holiday window) had top-quartile performance; no counterpart planned.

Each rule returns `RuleHit` objects: `{ type, severity, dateRange, campaignsAffected, rawEvidence }`.

**Narrative layer** — backend endpoint `POST /api/calendar/ai-insights` (added to `server.js`):

- Input: `{ events: CalendarEvent[], ruleHits: RuleHit[], rangeStart, rangeEnd }`.
- Backend calls Claude (`claude-sonnet-4-6`) with a system prompt telling it it's an email marketing intelligence layer for Emirates, plus the full dataset as context.
- For each `RuleHit`, Claude returns: narrative title, 1-2 sentence explanation grounded in historical KPIs, suggested action, estimated impact (if inferable).
- Claude also appends "freeform" insights (pattern recognition not caught by rules) up to 3.
- Response cached for the same `(rangeStart, rangeEnd, eventsHash)` for 5 minutes to avoid re-cost.

**Why backend and not frontend:** API key security per project rule, plus caching opportunity.

### AI Health Score

Simple deterministic formula in `calendarAiRules.js`:

```
100 – (5 × highRisks) – (2 × mediumRisks) – (1 × lowRisks) + (1 × actedOnOpportunities)
```

Clamped to [0, 100]. Color band: 80+ green, 60-79 amber, <60 red.

### View scales

All four views render the same `CalendarGantt` component with a `scale` prop:

- `year` — 12 columns (months), bars span day-level but compressed; hover reveals detail.
- `month` — 28-31 columns (default).
- `week` — 7 columns with hourly bands optional.
- `day` — 24 hourly bands.

Scale switcher stored in URL query param so it survives refresh/sharing.

### Filters

State lives in the page component. Filter by:
- Category (multi-select): Broadcast, Offers, Loyalty, Lifecycle, Partner, Route.
- Channel (multi-select): Email, SMS, Push.

Applied by filtering `CalendarEvent[]` before passing to Gantt and AI engine.

### AI alert actions

- **Dismiss** — stored in `localStorage` keyed by `aiAlert.id + userId`. Dismissed alerts don't re-appear for 30 days.
- **Mark as reviewed** — same storage, flagged separately so it shows with a muted style.
- **Ver campaña** / **Ir a campaña** — navigates to campaign detail in the campaigns hub when the alert is tied to a single campaign.

## Visual design

Follows existing AgentOS dark theme (`:root` CSS vars in `index.css`). New rules added:

- `.calendar-gantt`, `.calendar-gantt-bar`, `.calendar-gantt-bar.always-on` (dashed/striped).
- `.ai-intelligence-card` with severity borders (`.risk-high`, `.risk-medium`, `.opp`, `.insight`).
- `.ai-health-score` badge with gradient fill.

Category colors use existing values from `BAU_CATEGORIES` and `CAMPAIGN_GROUPS`. Conflict indicators are thin vertical red lines with a `⚠` marker at the top, rendered as absolute-positioned elements inside the row.

## i18n

All strings in `translations.js` under `calendar.*` keys. Nav label `layout.calendar`. Both ES and EN required per project rule.

## Error handling

- If `/api/calendar/ai-insights` fails, panel shows ruleHits without narrative enrichment (graceful degradation). A small banner: "AI narrative unavailable, showing raw detections."
- If no events in range, Gantt shows an empty state with CTA "Plan a campaign" linking to the campaigns hub.

## Testing

- Unit tests for `buildCalendarEvents` — correct flavor classification, date expansion, volume projection.
- Unit tests for each rule in `calendarAiRules.js` — one table-driven test per rule covering positive and negative cases.
- Component test for `CalendarGantt` — rendering bars at correct positions for a known events fixture.
- Integration test for `POST /api/calendar/ai-insights` — mocks Claude SDK, asserts prompt includes full event list and ruleHits.

## Out of scope (future phases)

- Real SFMC data ingestion (`campaigns_calendar` table in Railway).
- Create/edit campaigns inline from the calendar.
- Multi-user comments/tagging on alerts.
- Forecast simulation ("what if I move this campaign to Apr 22?").
- Email delivery of daily AI digest.

## Open questions

None at time of writing. All approach decisions captured.
