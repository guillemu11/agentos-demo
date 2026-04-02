# Pipeline Visibility & Dashboard Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing pipeline system visible across the entire dashboard — project cards, kanban, agent views, and command center.

**Architecture:** The pipeline backend is 100% implemented (project_pipeline, pipeline_stages, project_agent_sessions tables + endpoints for CRUD, handoff, pause/resume, skip). Frontend components exist (ProjectPipelineView, ProjectPipeline, ProjectAgentChat, HandoffModal). The problem is **integration** — the main dashboard surfaces don't query or display pipeline data. This plan wires pipeline data into 4 surfaces: project detail, project cards/kanban, agent views, and command center.

**Tech Stack:** React 19 (no Tailwind — CSS custom properties), Express 5 (single server.js), PostgreSQL 16, i18n via translations.js (ES + EN).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/dashboard/server.js` | Modify | Add `has_active_pipeline` flag to GET /api/projects, add pipeline progress to GET /api/pipeline, add GET /api/pipeline/stages/active endpoint, enhance GET /api/agents/:agentId/active-sessions, fix department assignment in to-proyecto |
| `apps/dashboard/src/App.jsx` | Modify | Auto-detect pipeline tab, show pipeline badge on project cards, add Active Pipelines widget |
| `apps/dashboard/src/components/PipelineBoard.jsx` | Modify | Show pipeline progress bar on project cards instead of task progress |
| `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` | Modify | Enrich AgentPipelineTickets with stage description, message count, navigation |
| `apps/dashboard/src/pages/WorkflowsHub.jsx` | Modify | Export ActivePipelinesList for reuse |
| `apps/dashboard/src/i18n/translations.js` | Modify | Add new i18n keys for pipeline visibility |
| `apps/dashboard/src/index.css` | Modify | Add CSS for pipeline badge, active pipelines widget, enriched agent tickets |

---

## Task 1: Add i18n keys for pipeline visibility

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js:1192-1245` (ES pipeline section)
- Modify: `apps/dashboard/src/i18n/translations.js:2414-2467` (EN pipeline section)

- [ ] **Step 1: Add new keys to ES pipeline section**

In `translations.js`, inside the `es > pipeline` object (after line 1244, before closing `}`), add:

```javascript
      activePipelineBadge: 'Pipeline activo',
      pipelineProgress: '{completed}/{total} stages',
      viewPipeline: 'Ver pipeline',
      stageDescription: 'Descripcion del stage',
      messagesCount: '{count} mensajes',
      activeStages: 'Stages Activos',
      noPipelineStages: 'Sin stages activos en este departamento',
```

- [ ] **Step 2: Add matching keys to EN pipeline section**

In `translations.js`, inside the `en > pipeline` object (after line 2466, before closing `}`), add:

```javascript
      activePipelineBadge: 'Active pipeline',
      pipelineProgress: '{completed}/{total} stages',
      viewPipeline: 'View pipeline',
      stageDescription: 'Stage description',
      messagesCount: '{count} messages',
      activeStages: 'Active Stages',
      noPipelineStages: 'No active stages in this department',
```

- [ ] **Step 3: Verify no syntax errors**

Run: `cd /c/Users/gmunoz02/Desktop/agentOS && node -e "require('./apps/dashboard/src/i18n/translations.js')" 2>&1 || echo "Checking with vite..."`

Since this is ESM/JSX, just verify the file parses by checking the dev server still loads (will be verified in later tasks).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add pipeline visibility translation keys (ES + EN)"
```

---

## Task 2: Backend — Add pipeline flag to GET /api/projects

**Files:**
- Modify: `apps/dashboard/server.js:358-365`

The current query is `SELECT * FROM projects ORDER BY created_at DESC`. We need to add a subquery to detect active pipelines.

- [ ] **Step 1: Modify the GET /api/projects query**

Replace the query at line 360:

```javascript
// OLD:
const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');

// NEW:
const result = await pool.query(
    `SELECT p.*,
        EXISTS(SELECT 1 FROM project_pipeline pp WHERE pp.project_id = p.id AND pp.status IN ('active', 'paused')) as has_active_pipeline,
        (SELECT json_build_object(
            'completed', (SELECT count(*) FROM project_agent_sessions pas2 WHERE pas2.pipeline_id = pp2.id AND pas2.status = 'completed'),
            'total', (SELECT count(*) FROM pipeline_stages ps2 WHERE ps2.pipeline_id = pp2.id)
        ) FROM project_pipeline pp2 WHERE pp2.project_id = p.id AND pp2.status IN ('active', 'paused') LIMIT 1) as pipeline_progress
     FROM projects p
     ORDER BY p.created_at DESC`
);
```

- [ ] **Step 2: Verify endpoint works**

Run: `curl -s http://localhost:3001/api/projects | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log(j[0]?.has_active_pipeline, j[0]?.pipeline_progress)"`

Expected: `true { completed: 0, total: 10 }` (or `false null` if no pipeline exists)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): add pipeline flag and progress to GET /api/projects"
```

---

## Task 3: Backend — Fix department assignment in to-proyecto

**Files:**
- Modify: `apps/dashboard/server.js:2174-2175`

When a project is created from inbox via `to-proyecto`, the department defaults to "General" because `saveProject` doesn't receive the pipeline's department info. We need to extract the department from the first stage.

- [ ] **Step 1: Add department extraction before saveProject call**

At line 2174 (just before `const projectId = await saveProject(projectData, client);`), add:

```javascript
// Set department from first pipeline stage if available
if (draft?.stages?.[0]?.department && !projectData.department) {
    projectData.department = draft.stages[0].department;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "fix(api): set project department from pipeline draft stage"
```

---

## Task 4: Backend — Add pipeline progress to GET /api/pipeline (kanban)

**Files:**
- Modify: `apps/dashboard/server.js:461-464`

The kanban endpoint `/api/pipeline` returns projects with `total_tasks` and `done_tasks` from the legacy phases/tasks model. Projects with pipelines show 0/0 tasks. We need to add pipeline stage counts.

- [ ] **Step 1: Modify the project subquery in GET /api/pipeline**

Replace the project query at lines 461-464:

```javascript
// OLD:
let q = `SELECT p.*, 'project' as _type,
    (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id) as total_tasks,
    (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id AND t.status = 'Done') as done_tasks
    FROM projects p`;

// NEW:
let q = `SELECT p.*, 'project' as _type,
    (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id) as total_tasks,
    (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id AND t.status = 'Done') as done_tasks,
    EXISTS(SELECT 1 FROM project_pipeline pp WHERE pp.project_id = p.id AND pp.status IN ('active', 'paused')) as has_active_pipeline,
    (SELECT count(*) FROM pipeline_stages ps JOIN project_pipeline pp ON ps.pipeline_id = pp.id WHERE pp.project_id = p.id) as pipeline_total,
    (SELECT count(*) FROM project_agent_sessions pas JOIN project_pipeline pp ON pas.pipeline_id = pp.id WHERE pp.project_id = p.id AND pas.status = 'completed') as pipeline_completed
    FROM projects p`;
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): add pipeline stage counts to kanban endpoint"
```

---

## Task 5: Backend — Enhance GET /api/agents/:agentId/active-sessions

**Files:**
- Modify: `apps/dashboard/server.js:5529-5543`

The existing endpoint returns basic session data but lacks stage description, gate_type, and message count — info needed for a useful agent view.

- [ ] **Step 1: Enhance the query**

Replace the query at lines 5532-5538:

```javascript
// OLD:
const result = await pool.query(
    `SELECT pas.*, p.name as project_name, pp.status as pipeline_status
     FROM project_agent_sessions pas
     JOIN projects p ON p.id = pas.project_id
     JOIN project_pipeline pp ON pp.id = pas.pipeline_id
     WHERE pas.agent_id = $1 AND pas.status IN ('pending', 'active', 'awaiting_handoff')
     ORDER BY pas.started_at DESC NULLS LAST`,
    [req.params.agentId]
);

// NEW:
const result = await pool.query(
    `SELECT pas.*, p.name as project_name, p.id as project_id, pp.status as pipeline_status,
        ps.description as stage_description, ps.gate_type, ps.depends_on,
        (SELECT count(*) FROM pipeline_session_messages WHERE session_id = pas.id) as message_count
     FROM project_agent_sessions pas
     JOIN projects p ON p.id = pas.project_id
     JOIN project_pipeline pp ON pp.id = pas.pipeline_id
     JOIN pipeline_stages ps ON ps.pipeline_id = pp.id AND ps.stage_order = pas.stage_order
     WHERE pas.agent_id = $1 AND pas.status IN ('pending', 'active', 'awaiting_handoff')
     ORDER BY
        CASE pas.status WHEN 'active' THEN 0 WHEN 'awaiting_handoff' THEN 1 ELSE 2 END,
        pas.started_at DESC NULLS LAST`,
    [req.params.agentId]
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): enrich agent pipeline sessions with stage details and message count"
```

---

## Task 6: Frontend — Auto-detect pipeline tab + pipeline badge on cards

**Files:**
- Modify: `apps/dashboard/src/App.jsx:91` (state init)
- Modify: `apps/dashboard/src/App.jsx:117-130` (fetchProjectDetail)
- Modify: `apps/dashboard/src/App.jsx:527-544` (project card rendering)

### 6A: Auto-switch to pipeline tab

- [ ] **Step 1: Modify fetchProjectDetail to check for pipeline**

Replace the `fetchProjectDetail` function at lines 117-130:

```javascript
const fetchProjectDetail = async (id) => {
    setLoading(true);
    try {
        const res = await fetch(`${API_URL}/projects/${id}`);
        const data = await res.json();
        setSelectedProject(data);
        setEditMode(false);
        // Auto-switch to pipeline tab if project has active pipeline
        if (data.has_active_pipeline) {
            setProjectTab('pipeline');
        } else {
            setProjectTab('details');
        }
    } catch (err) {
        console.error('Error fetching project detail:', err);
    } finally {
        setLoading(false);
    }
};
```

Note: This relies on `has_active_pipeline` from the enhanced GET /api/projects/:id endpoint. Since GET /api/projects/:id (single project) is a separate endpoint from GET /api/projects (list), we need to check if it also returns this flag. If it uses a simple `SELECT * FROM projects WHERE id = $1`, we need to either:
- A) Use the list data we already have (from `projects` state), OR
- B) Make a quick check to `/api/projects/${id}/pipeline`

Safest approach — use the projects list data which already has the flag from Task 2:

```javascript
const fetchProjectDetail = async (id) => {
    setLoading(true);
    try {
        const res = await fetch(`${API_URL}/projects/${id}`);
        const data = await res.json();
        setSelectedProject(data);
        setEditMode(false);
        // Check if this project has active pipeline (from projects list data)
        const projectListData = projects.find(p => p.id === id);
        if (projectListData?.has_active_pipeline) {
            setProjectTab('pipeline');
        } else {
            // Quick-check pipeline endpoint as fallback
            try {
                const pRes = await fetch(`${API_URL}/projects/${id}/pipeline`, { credentials: 'include' });
                setProjectTab(pRes.ok ? 'pipeline' : 'details');
            } catch { setProjectTab('details'); }
        }
    } catch (err) {
        console.error('Error fetching project detail:', err);
    } finally {
        setLoading(false);
    }
};
```

### 6B: Pipeline badge on project cards

- [ ] **Step 2: Add pipeline badge to project cards**

In the project card JSX at line 533-537 (the badges div), add a pipeline badge:

```jsx
{/* Inside the div at line 533, after the sub_area badge */}
{project.has_active_pipeline && (
    <span className="pipeline-active-badge" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
        {t('pipeline.activePipelineBadge')}
        {project.pipeline_progress && (
            <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                {project.pipeline_progress.completed}/{project.pipeline_progress.total}
            </span>
        )}
    </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/App.jsx
git commit -m "feat(ui): auto-detect pipeline tab and show pipeline badge on project cards"
```

---

## Task 7: CSS — Pipeline badge and active pipelines widget styles

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Add pipeline visibility CSS**

Add at the end of index.css (before any media queries):

```css
/* ── Pipeline Visibility ── */
.pipeline-active-badge {
    background: var(--success-soft, #ecfdf5);
    color: var(--success, #10b981);
    border-radius: 999px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    animation: pipelinePulse 2s ease-in-out infinite;
}

@keyframes pipelinePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

.active-pipelines-widget {
    margin-bottom: 24px;
}

.active-pipelines-widget h3 {
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 12px;
    color: var(--text-primary);
}

.active-pipeline-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
}

.active-pipeline-card:hover {
    border-color: var(--primary-trans);
    background: var(--primary-soft);
}

.agent-pipeline-ticket {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
}

.agent-pipeline-ticket:hover {
    border-color: var(--primary-trans);
    background: var(--primary-soft);
}

.agent-pipeline-ticket .ticket-info h4 {
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0 0 2px 0;
}

.agent-pipeline-ticket .ticket-info span {
    font-size: 0.78rem;
    color: var(--text-secondary);
}

.agent-pipeline-ticket .ticket-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-secondary);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(css): add pipeline visibility styles"
```

---

## Task 8: Frontend — Pipeline progress in kanban cards

**Files:**
- Modify: `apps/dashboard/src/components/PipelineBoard.jsx:245-331`

The kanban already shows a task progress bar for projects. We need to show pipeline progress instead when a project has an active pipeline.

- [ ] **Step 1: Add pipeline progress logic to card rendering**

In PipelineBoard.jsx, inside the card render at ~line 245, after the existing `taskPct` calculation (line 247), add:

```javascript
const hasPipeline = !!proj.has_active_pipeline;
const pipelineTotal = parseInt(proj.pipeline_total) || 0;
const pipelineCompleted = parseInt(proj.pipeline_completed) || 0;
const pipelinePct = pipelineTotal > 0 ? Math.round((pipelineCompleted / pipelineTotal) * 100) : 0;
```

Then replace the task progress bar section (lines 315-331) with a conditional:

```jsx
{/* Progress bar — pipeline stages or legacy tasks */}
{hasPipeline && pipelineTotal > 0 ? (
    <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{t('pipeline.stages')}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                {pipelineCompleted}/{pipelineTotal}
            </span>
        </div>
        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
                width: `${pipelinePct}%`, height: '100%', borderRadius: '9999px',
                background: pipelinePct === 100 ? '#10b981' : '#a855f7',
                transition: 'width 0.3s ease',
            }} />
        </div>
    </div>
) : totalTasks > 0 ? (
    <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{t('pipeline.tasks')}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                {doneTasks}/{totalTasks}
            </span>
        </div>
        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
                width: `${taskPct}%`, height: '100%', borderRadius: '9999px',
                background: taskPct === 100 ? '#10b981' : '#3b82f6',
                transition: 'width 0.3s ease',
            }} />
        </div>
    </div>
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/PipelineBoard.jsx
git commit -m "feat(kanban): show pipeline stage progress on project cards"
```

---

## Task 9: Frontend — Enrich AgentPipelineTickets in GenericAgentView

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/GenericAgentView.jsx:8-42`

The existing `AgentPipelineTickets` component (lines 8-42) is basic — just project name + stage name + status badge. We enhance it with stage description, message count, and clickable navigation.

- [ ] **Step 1: Replace the AgentPipelineTickets component**

Replace lines 8-42:

```javascript
function AgentPipelineTickets({ agentId, onNavigateToProject }) {
    const { t } = useLanguage();
    const [tickets, setTickets] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/agents/${agentId}/active-sessions`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setTickets(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [agentId]);

    if (tickets.length === 0) {
        return (
            <div className="agent-workflows-list">
                <div className="empty-state">{t('pipeline.noTickets')}</div>
            </div>
        );
    }

    return (
        <div className="agent-pipeline-tickets">
            {tickets.map(ticket => (
                <div
                    key={ticket.id}
                    className="agent-pipeline-ticket"
                    onClick={() => onNavigateToProject?.(ticket.project_id, ticket.stage_order)}
                >
                    <div className="ticket-info">
                        <h4>{ticket.project_name}</h4>
                        <span>[{ticket.stage_order}] {ticket.stage_name}</span>
                        {ticket.stage_description && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
                                {ticket.stage_description.length > 100
                                    ? ticket.stage_description.substring(0, 100) + '...'
                                    : ticket.stage_description}
                            </p>
                        )}
                    </div>
                    <div className="ticket-meta">
                        {ticket.gate_type === 'human_approval' && (
                            <span title={t('pipeline.gateApproval')}>🔒</span>
                        )}
                        {ticket.message_count > 0 && (
                            <span>{t('pipeline.messagesCount').replace('{count}', ticket.message_count)}</span>
                        )}
                        <span className={`pipeline-status-badge ${ticket.status}`}>
                            {t(`pipeline.${ticket.status}`) || ticket.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Update the usage at line 146 to pass onNavigateToProject**

The `onNavigateToProject` prop needs to come from the parent. In GenericAgentView, add:

```jsx
{activeTab === 'workflows' && (
    <AgentPipelineTickets agentId={agent.id} onNavigateToProject={(projectId, stageOrder) => {
        // Navigation will be handled by parent — emit event or use window.location
        window.dispatchEvent(new CustomEvent('navigate-to-pipeline', { detail: { projectId, stageOrder } }));
    }} />
)}
```

Note: The actual navigation from agent view → project detail → pipeline tab depends on how App.jsx handles routing. A CustomEvent is the simplest approach without prop drilling. App.jsx will need a listener (added in Task 10).

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/agent-views/GenericAgentView.jsx
git commit -m "feat(agent-view): enrich pipeline tickets with description, messages, and navigation"
```

---

## Task 10: Frontend — Active Pipelines widget in Command Center + navigation listener

**Files:**
- Modify: `apps/dashboard/src/App.jsx` (add widget + event listener)
- Modify: `apps/dashboard/src/pages/WorkflowsHub.jsx` (export ActivePipelinesList)

### 10A: Export ActivePipelinesList

- [ ] **Step 1: Export ActivePipelinesList from WorkflowsHub**

At line 26 in WorkflowsHub.jsx, change from local function to named export:

```javascript
// OLD:
function ActivePipelinesList() {

// NEW:
export function ActivePipelinesList() {
```

### 10B: Add widget to App.jsx project grid + navigation listener

- [ ] **Step 2: Import ActivePipelinesList in App.jsx**

Add to App.jsx imports:

```javascript
import { ActivePipelinesList } from './pages/WorkflowsHub.jsx';
```

- [ ] **Step 3: Add ActivePipelinesList widget above project grid**

In App.jsx, just before the `departments-container` div (~line 518), add:

```jsx
{/* Active Pipelines widget */}
<div className="active-pipelines-widget">
    <h3>{t('pipeline.activePipelines')}</h3>
    <ActivePipelinesList onSelectPipeline={(projectId) => fetchProjectDetail(projectId)} />
</div>
```

Note: This requires `ActivePipelinesList` to accept an `onSelectPipeline` prop. Update the component accordingly — add an onClick to each card that calls `onSelectPipeline(p.project_id)`.

- [ ] **Step 4: Update ActivePipelinesList to accept onSelectPipeline prop**

In WorkflowsHub.jsx, modify `ActivePipelinesList` to accept and use the prop:

```javascript
export function ActivePipelinesList({ onSelectPipeline }) {
    // ... existing code ...
    // Add onClick to each pipeline card:
    <div key={p.id} className="active-pipeline-card" onClick={() => onSelectPipeline?.(p.project_id)}>
```

- [ ] **Step 5: Add navigation listener for agent view → pipeline**

In App.jsx, add a useEffect for the custom event (near other useEffect hooks):

```javascript
useEffect(() => {
    const handler = (e) => {
        const { projectId } = e.detail;
        if (projectId) fetchProjectDetail(projectId);
    };
    window.addEventListener('navigate-to-pipeline', handler);
    return () => window.removeEventListener('navigate-to-pipeline', handler);
}, []);
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/App.jsx apps/dashboard/src/pages/WorkflowsHub.jsx
git commit -m "feat(dashboard): add Active Pipelines widget and cross-view navigation"
```

---

## Task 11: Restart server + manual verification

- [ ] **Step 1: Restart the dev server**

```bash
cd /c/Users/gmunoz02/Desktop/agentOS && npm start
```

- [ ] **Step 2: Verify all 8 acceptance criteria from spec**

1. Create project via PM Agent → confirm pipeline badge on grid
2. Open project → Pipeline tab auto-selected
3. Kanban → project shows pipeline stage progress
4. Agent view → Workflows tab shows enriched tickets
5. Click ticket in agent view → navigates to project pipeline
6. Active Pipelines widget visible on projects page
7. Click pipeline in widget → opens project pipeline view
8. All text in both ES and EN

- [ ] **Step 3: Commit any fixes needed**

---

## Verification Checklist (from spec)

1. [ ] Project with pipeline shows "Pipeline activo" badge in grid
2. [ ] Opening project auto-selects Pipeline tab (not Details)
3. [ ] Kanban cards show pipeline stage progress (N/M stages) instead of 0/0 tasks
4. [ ] Agent view Workflows tab shows assigned pipeline tickets with description + message count
5. [ ] Clicking ticket in agent view navigates to project → pipeline tab
6. [ ] Active Pipelines widget appears on projects page
7. [ ] Clicking pipeline in widget navigates to project → pipeline tab
8. [ ] Department correctly assigned from draft stage (not "General")
9. [ ] All new text has i18n in both ES and EN
