# Agent Teams — Flat Layout Redesign

## Context

The current Agent Teams page (`WorkspaceOverview`) shows 3 operational layer cards that require an extra click to see agents inside (`DepartmentDetail`). This adds unnecessary friction — users must click through layers just to find or interact with an agent. The redesign flattens the hierarchy so all agents are visible immediately, grouped under layer section headers.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Flat — layer titles as section dividers, agents in 2-col grid below | Eliminates extra click step |
| Status controls | Hover to reveal A/I/O buttons | Clean by default, functional on demand |
| Skills tags | Always visible on cards | Helps differentiate agents at a glance |
| Weekly/Standup | Global dropdown buttons in page header with layer selector | Less visual repetition than per-layer buttons |
| Activity Feed + Active Items | Kept global at top of page | Provides context about what's happening |
| Navigation | Click agent card → AgentDetail directly | Skips DepartmentDetail entirely |

## Page Structure

```
┌─────────────────────────────────────────────────┐
│  Agent Teams                    [Weekly ▼] [Standup ▼] │
│  12 specialized AI agents across 3 layers              │
├─────────────────────────────────────────────────┤
│  [12 Agents] [8 Active] [34 Skills] [18 Tools]        │
├─────────────────────────────────────────────────┤
│  🔬 2 Active Research    │  📧 3 Emails In Progress   │
├─────────────────────────────────────────────────┤
│  Recent Activity (compact feed, 3-5 items)             │
├─────────────────────────────────────────────────┤
│  ─── 🎯 Strategic Layer (4 agents · 3 active) ────── │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 👨‍💼 PM Agent  │  │ 📊 CRM       │                    │
│  │ role · •green │  │ role · •green │                    │
│  │ [skills tags] │  │ [skills tags] │                    │
│  └──────────────┘  └──────────────┘                    │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 🧠 Research  │  │ 🎯 Campaign  │                    │
│  │ role · •amber │  │ role · •green │                    │
│  │ [skills tags] │  │ [skills tags] │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
│  ─── 🚀 Execution Layer (5 agents · 4 active) ────── │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ ...          │  │ ...          │                    │
│  └──────────────┘  └──────────────┘                    │
│  ...                                                    │
│                                                         │
│  ─── 🛡️ Control & Validation (3 agents · 2 active) ─ │
│  ...                                                    │
└─────────────────────────────────────────────────┘
```

## Agent Card Anatomy

```
┌─────────────────────────────────┐
│ 👨‍💼  PM Agent              •green │  ← avatar, name, status dot
│     Project Manager              │  ← role subtitle
│                                  │
│ [on hover: A  I  O buttons]     │  ← status change controls
│                                  │
│ planning  strategy  orchestration│  ← skill tags (always visible)
└─────────────────────────────────┘
```

- Card border highlights on hover with layer color (gold/red/gray)
- Click card → navigate to `/app/workspace/agent/:agentId`
- Hover reveals A/I/O status toggle buttons
- Status dot: green (active), amber (idle), gray (offline), red (error)

## Weekly/Standup Global Dropdown

Two buttons in the page header: "Weekly Brainstorm" and "Daily Standup". Each opens a dropdown listing the 3 layers. Clicking a layer navigates to the existing routes:
- Weekly → `/app/workspace/:deptId/weekly`
- Standup → `/app/workspace/:deptId/daily`

## Files to Modify

| File | Change |
|------|--------|
| `apps/dashboard/src/pages/WorkspaceOverview.jsx` | Replace department card grid with flat agent layout grouped by layer. Add global Weekly/Standup dropdowns. Fetch agents grouped by department. |
| `apps/dashboard/src/index.css` | Add CSS for layer section headers, hover status buttons, dropdown menus. Reuse existing `.agent-card`, `.skill-tag` classes. |
| `apps/dashboard/src/i18n/translations.js` | Add/update keys for layer headers, dropdown labels, new subtitle text |
| `apps/dashboard/src/main.jsx` | Keep `/app/workspace/:deptId` route (DepartmentDetail still works as deep-link) |

## What NOT to Change

- **DepartmentDetail.jsx** — keep as-is for deep-link support (`/app/workspace/:deptId`)
- **AgentDetail.jsx** — untouched, still receives navigation from agent cards
- **server.js API** — existing `GET /api/agents` and `GET /api/departments` already return all needed data
- **Routes** — no route changes needed

## API Data Flow

1. Fetch `GET /api/agents` → all agents with department field
2. Fetch `GET /api/departments` → department metadata (name, emoji, color, description)
3. Group agents by `agent.department` on frontend
4. Render each department as a section header + agent grid
5. Fetch `GET /api/activity/recent?limit=5` → activity feed
6. Fetch `GET /api/pipeline/counts` → active items data

No new API endpoints needed — all data is already available.

## Verification

1. Start AgentOS (`npm start`)
2. Navigate to `/app/workspace` — should see all 12 agents grouped by layer, no extra click needed
3. Hover an agent card — status A/I/O buttons appear
4. Click A/I/O — agent status updates via PATCH
5. Click agent card → navigates to AgentDetail
6. Click Weekly dropdown → select a layer → navigates to weekly board
7. Click Standup dropdown → select a layer → navigates to standup
8. Deep-link `/app/workspace/strategic` still works (DepartmentDetail)
9. Check i18n: switch language ES ↔ EN, all new text translates
10. Check responsive: 2-col grid collapses to 1-col on narrow viewport
