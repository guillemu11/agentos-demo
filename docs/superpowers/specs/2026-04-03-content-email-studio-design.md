# Content Studio & Email Studio — Full-Screen Redesign

**Date:** 2026-04-03  
**Status:** Approved

---

## Context

The two core execution views — the Content Agent chat (Lucia) and the HTML Developer chat (Create Email) — are currently rendered inside the `AgentDetail` page as tabbed panels within a max-width 1200px container. The sidebar navigation is always visible and the chat areas feel cramped.

These two views are the primary work surfaces of the product. They need to feel like dedicated workspaces, not tabs inside a dashboard. The goal is to give each studio a full-screen route with no distractions, while keeping access to supporting tools (Block Library, Templates, Tickets) available from within.

---

## Decisions Made

| Question | Decision |
|---|---|
| Layout approach | Full-screen dedicated route (new URL, no sidebar nav) |
| Tabs inside studio | Yes — Chat (default) + tool tabs (Block Library, Templates, Tickets) |
| Entry points | 2 per studio: "Working On" banner + renamed tab in agent view |
| Back navigation | "← Back to agent" in top bar returns to full agent view |
| Content Studio chat split | Chat (2fr) · Brief sidebar (1fr) |
| Email Studio chat split | Chat (1fr) · Email Preview (1fr) — 50/50 |
| Rename | "Chat" tab → "Content Studio ↗" / "Email Studio ↗" |

---

## Routes

```
/app/workspace/agent/content-agent/studio   → Content Studio
/app/workspace/agent/html-developer/studio  → Email Studio
```

Both routes receive the active ticket context via URL search param (`?ticketId=...`) passed when navigating from the agent view. The studio page reads this param on mount to initialize the chat session.

---

## Content Studio

### Entry points
1. **Working On banner** (in agent view) — green banner with "Open Content Studio ↗" button
2. **Tab in agent view** — "Content Studio ↗" tab (replaces "Chat" tab), clicking navigates to the studio route

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ ← Back to agent │ Campaign name │ ● Working │  Actions   │  ← Top bar (no sidebar)
├──────────────────────────────────────────────────────────┤
│ 💬 Chat │ 🎫 Tickets │ 🖼 Images │ 📊 A/B │ ⭐ Quality  │  ← Studio tabs
├───────────────────────────────────────┬──────────────────┤
│                                       │  Brief sidebar   │
│           Lucia chat                  │  Progress bar    │
│           (2fr)                       │  Variant chips   │
│                                       │  Block statuses  │
│                                       │  (1fr)           │
├───────────────────────────────────────┴──────────────────┤
│ [input]                                          [Send ↑] │
└──────────────────────────────────────────────────────────┘
```

### Top bar actions
- `← Back to agent` — returns to `/app/workspace/agent/content-agent`
- Campaign badge (ticket name)
- Status chip (Working / Done)
- `Send to HTML Developer →` button (primary)

### Studio tabs
- **💬 Chat** (default) — full chat + brief sidebar layout
- **🎫 Tickets** — AgentTicketsPanel
- **🖼 Images** — image generation studio
- **📊 A/B Testing** — variant comparison
- **⭐ Quality** — quality scores

---

## Email Studio

### Entry points
1. **Working On banner** (in agent view) — red banner with "Open Email Studio ↗" button
2. **Tab in agent view** — "Email Studio ↗" tab (replaces "Chat" / "Builder" tab), clicking navigates to the studio route

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ ← Back to agent │ Campaign name │ ● Building │  Actions  │  ← Top bar
├──────────────────────────────────────────────────────────┤
│ 💬 Chat │ 📦 Block Library (20) │ 📋 Templates │ 🎫 Tickets│  ← Studio tabs
├─────────────────────────────────┬────────────────────────┤
│                                 │  Preview toolbar       │
│      HTML Developer chat        │  ─────────────────     │
│           (1fr)                 │  Email preview         │
│                                 │  (1fr)                 │
│                                 │                        │
├─────────────────────────────────┴────────────────────────┤
│ [input]                                          [Send ↑] │
└──────────────────────────────────────────────────────────┘
```

### Top bar actions
- `← Back to agent` — returns to `/app/workspace/agent/html-developer`
- Campaign badge (ticket name)
- Status chip (Building / Done)
- `↓ Export HTML` button (primary)

### Studio tabs
- **💬 Chat** (default) — 50/50 chat + email preview
- **📦 Block Library** — existing block library with filter
- **📋 Templates** — existing templates grid
- **🎫 Tickets** — AgentTicketsPanel

---

## Implementation Scope

### Files to modify
- `apps/dashboard/src/components/agent-views/ContentAgentView.jsx` — remove Chat tab content (moves to new route), add "Content Studio ↗" tab that navigates
- `apps/dashboard/src/components/agent-views/HtmlDeveloperView.jsx` — remove "Builder" tab content (the chat+preview split, which moves to new route), rename tab to "Email Studio ↗" that navigates
- `apps/dashboard/src/pages/AgentDetail.jsx` — update Working On banner to include "Open Studio ↗" action button
- Router config (React Router) — add two new routes for the studio pages
- `apps/dashboard/src/components/agent-views/index.js` — no change needed

### New files to create
- `apps/dashboard/src/pages/ContentStudioPage.jsx` — full-screen Content Studio page
- `apps/dashboard/src/pages/EmailStudioPage.jsx` — full-screen Email Studio page

### CSS approach
- Studio routes are placed **outside** the `Layout.jsx` wrapper in the React Router config — they get their own minimal layout with no sidebar, similar to how a login page works
- Studio pages use 100vw / 100vh with their own CSS classes
- No Tailwind — CSS custom properties from `index.css`
- Height: `calc(100vh - topbar - tabs)` for the chat split

### Reuse existing components
- `ContentChatPanel.jsx` — reused as-is inside ContentStudioPage
- `ContentBriefSidebar.jsx` — reused as-is
- `EmailBuilderPreview.jsx` — reused as-is inside EmailStudioPage
- `AgentTicketsPanel.jsx` — reused in Tickets tab of both studios

---

## Verification

1. Navigate to Content Agent → "Working On" banner shows "Open Content Studio ↗"
2. Click banner → navigates to `/app/workspace/agent/content-agent/studio`, sidebar hidden, full-screen
3. "Content Studio ↗" tab in agent view also navigates to same route
4. Inside Content Studio: Chat tab shows chat (2fr) + brief sidebar (1fr), other tabs work
5. "← Back to agent" returns to agent view with all tabs
6. Same flow for Email Studio with 50/50 split
7. Both studios work with active ticket context (messages load, brief state preserved)
