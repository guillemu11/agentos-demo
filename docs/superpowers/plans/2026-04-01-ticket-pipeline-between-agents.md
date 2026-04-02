# Ticket Pipeline Between Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DAG-based pipeline system that routes projects through agent stages with AI-powered handoff summaries, contextual chat per stage, and parallel stage execution.

**Architecture:** 4 new DB tables model the pipeline (project_pipeline, pipeline_stages, project_agent_sessions, pipeline_session_messages) + 1 ALTER. Backend adds ~300 lines to server.js for pipeline CRUD, handoff (2-phase: AI summary + atomic DB transaction), and session chat with SSE streaming. Frontend adds 7 new files (templates data, streaming hook, 5 components) and modifies 5 existing files for integration. Pipeline uses DAG with `depends_on` arrays for parallel stage execution.

**Tech Stack:** PostgreSQL 16, Express 5, Anthropic SDK (claude-sonnet-4-6 with tool_use), React 19, SSE streaming, CSS custom properties.

**Spec:** `projects/004-ticket-pipeline-between-agents.md`

---

## File Structure

### New Files (7)

| File | Responsibility |
|------|---------------|
| `apps/dashboard/src/data/pipelineTemplates.js` | Static pipeline template definitions derived from workflows.js |
| `apps/dashboard/src/hooks/useStreamingChat.js` | Extracted SSE streaming hook (replaces duplicated pattern in AgentChat/PMAgentChat) |
| `apps/dashboard/src/components/PipelineSelector.jsx` | Template picker + stage editor for creating pipelines |
| `apps/dashboard/src/components/ProjectPipeline.jsx` | Vertical timeline visualization of stages |
| `apps/dashboard/src/components/ProjectAgentChat.jsx` | Chat interface within pipeline context |
| `apps/dashboard/src/components/HandoffModal.jsx` | Handoff confirmation modal (summary edit + next agent) |
| `apps/dashboard/src/components/ProjectPipelineView.jsx` | Container/state owner for pipeline tab |

### Modified Files (8)

| File | Change |
|------|--------|
| `packages/core/db/schema.sql` | +4 tables, +1 ALTER, +indexes (~60 lines) |
| `apps/dashboard/server.js` | +pipeline endpoints, +handoff logic, +session chat (~350 lines) |
| `packages/core/pm-agent/core.js` | +`generateHandoffSummary()`, +`buildPipelineSystemPrompt()`, +`buildAccumulatedContext()` (~120 lines) |
| `apps/dashboard/src/App.jsx` | Tab toggle "Details" / "Pipeline" in project detail view |
| `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` | Populate empty "workflows" tab with pipeline tickets |
| `apps/dashboard/src/pages/WorkflowsHub.jsx` | Add "Active Pipelines" third toggle |
| `apps/dashboard/src/i18n/translations.js` | +`pipeline.*` namespace (~60 keys, ES + EN) |
| `apps/dashboard/src/index.css` | +pipeline CSS section (~250 lines) |

---

## Task 1: Database Schema — 4 New Tables + ALTER

**Files:**
- Modify: `packages/core/db/schema.sql` (append after line ~280, after `workspace_config`)

- [ ] **Step 1: Add the 4 new tables and ALTER to schema.sql**

Append at the end of `schema.sql`, before any seed references:

```sql
-- ═══════════ PIPELINE SYSTEM ═══════════════════════════════════════════════

-- project_pipeline — Estado del flujo de un proyecto
CREATE TABLE IF NOT EXISTS project_pipeline (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    template_id TEXT,
    current_stage_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_pipeline_status ON project_pipeline(status);

-- pipeline_stages — Stages normalizados (DAG con depends_on)
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id SERIAL PRIMARY KEY,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    stage_order INT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    department TEXT,
    description TEXT,
    depends_on INT[] DEFAULT '{}',
    gate_type TEXT DEFAULT 'none'
        CHECK (gate_type IN ('none', 'human_approval')),
    namespaces TEXT[] DEFAULT '{}',
    UNIQUE(pipeline_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_agent ON pipeline_stages(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

-- project_agent_sessions — Chat + trabajo de cada agente en un proyecto
CREATE TABLE IF NOT EXISTS project_agent_sessions (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_order INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'awaiting_handoff', 'completed', 'skipped')),
    summary TEXT,
    summary_edited TEXT,
    deliverables JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, agent_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pas_project ON project_agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_pas_agent ON project_agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_pas_status ON project_agent_sessions(status);

-- pipeline_session_messages — Mensajes normalizados (no JSONB array)
CREATE TABLE IF NOT EXISTS pipeline_session_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES project_agent_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psm_session ON pipeline_session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_psm_session_created ON pipeline_session_messages(session_id, created_at);

-- ALTER: Link collaboration_raises to pipeline sessions
ALTER TABLE collaboration_raises ADD COLUMN IF NOT EXISTS pipeline_session_id INT
    REFERENCES project_agent_sessions(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Run the migration**

```bash
cd c:\Users\gmunoz02\Desktop\agentOS
npm run db:up
# Wait for DB to be ready, then:
docker exec -i agentos-db psql -U agentos -d agentos < packages/core/db/schema.sql
```

- [ ] **Step 3: Verify tables exist**

Open Adminer at `http://localhost:8080` (server: `db`, user: `agentos`, password: `changeme`, database: `agentos`).
Verify: `project_pipeline`, `pipeline_stages`, `project_agent_sessions`, `pipeline_session_messages` all exist with correct columns.
Verify: `collaboration_raises` has new `pipeline_session_id` column.

- [ ] **Step 4: Commit**

```bash
git add packages/core/db/schema.sql
git commit -m "feat(pipeline): add 4 pipeline tables + ALTER collaboration_raises"
```

---

## Task 2: Pipeline Templates Data

**Files:**
- Create: `apps/dashboard/src/data/pipelineTemplates.js`
- Reference: `apps/dashboard/src/data/workflows.js` (read-only, for consistency)

- [ ] **Step 1: Create pipelineTemplates.js**

```javascript
// Pipeline templates derived from workflows.js for consistency
// Each template defines a DAG of stages with agent assignments

const PIPELINE_TEMPLATES = {
  campaign: {
    name: 'Campaign Creation',
    source_workflow: 'campaign-creation',
    stages: [
      { name: 'Strategy & Brief', agent_id: 'campaign-manager', department: 'strategic',
        depends_on: [], gate_type: 'human_approval',
        namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Campaign brief, objectives, KPIs, markets, BAU type classification' },
      { name: 'Technical Feasibility', agent_id: 'cloud-architect', department: 'strategic',
        depends_on: [0],
        namespaces: ['campaigns', 'emails'],
        description: 'Data model validation, DE design, API requirements, capacity check' },
      { name: 'Calendar & Timing', agent_id: 'calendar-agent', department: 'execution',
        depends_on: [0],
        namespaces: ['campaigns', 'kpis'],
        description: 'Send date, conflict detection, cadence validation, blackout check' },
      { name: 'Segmentation & Audience', agent_id: 'segmentation-agent', department: 'execution',
        depends_on: [1, 2],
        namespaces: ['campaigns', 'kpis', 'emails'],
        description: 'Audience definition, suppression logic, SQL, estimated volumes per market' },
      { name: 'Content & Creative', agent_id: 'content-agent', department: 'execution',
        depends_on: [1, 2],
        namespaces: ['campaigns', 'emails', 'images', 'brand'],
        description: 'Copy per market/language/tier variant, subject lines, preview text' },
      { name: 'Brand Review', agent_id: 'brand-guardian', department: 'control',
        depends_on: [3, 4],
        namespaces: ['brand', 'campaigns', 'images', 'emails'],
        description: 'Emirates premium tone, visual compliance, terminology check' },
      { name: 'Legal Review', agent_id: 'legal-agent', department: 'control',
        depends_on: [3, 4], gate_type: 'human_approval',
        namespaces: ['campaigns', 'brand', 'kpis'],
        description: 'GDPR, UAE regulations, disclaimers, consent validation, market-specific' },
      { name: 'Automation & Build', agent_id: 'automation-architect', department: 'execution',
        depends_on: [5, 6],
        namespaces: ['campaigns', 'emails'],
        description: 'Journey Builder config, triggers, send classification, deployment runbook' },
      { name: 'QA & Testing', agent_id: 'qa-agent', department: 'control',
        depends_on: [7],
        namespaces: ['campaigns', 'emails', 'brand', 'images'],
        description: 'Link validation, rendering, spam score, deliverability, seed list test' },
      { name: 'Analytics Setup', agent_id: 'analytics-agent', department: 'control',
        depends_on: [7],
        namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Tracking config, attribution model, KPI baseline, dashboard prep' },
    ]
  },

  flash_sale: {
    name: 'Flash Sale Rapid Deploy',
    source_workflow: 'flash-sale-rapid-deploy',
    stages: [
      { name: 'Urgent Brief', agent_id: 'campaign-manager', department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis'],
        description: 'Urgent brief with product, discount & markets' },
      { name: 'Fast Content', agent_id: 'content-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Generate multilingual copy — fast track' },
      { name: 'Fast Brand', agent_id: 'brand-guardian', department: 'control',
        depends_on: [1], namespaces: ['brand', 'campaigns'],
        description: 'Fast-track brand review' },
      { name: 'Expedited Legal', agent_id: 'legal-agent', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'brand'],
        description: 'Expedited compliance check' },
      { name: 'Rapid QA', agent_id: 'qa-agent', department: 'control',
        depends_on: [2, 3], gate_type: 'human_approval',
        namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Rapid QA: links, renders & spam score' },
    ]
  },

  seasonal: {
    name: 'Seasonal Campaign Planning',
    source_workflow: 'seasonal-campaign-planning',
    stages: [
      { name: 'Strategy', agent_id: 'campaign-manager', department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Seasonal strategy and planning' },
      { name: 'Calendar Planning', agent_id: 'calendar-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'],
        description: 'Full calendar plan for the season' },
      { name: 'Pre-build Audiences', agent_id: 'segmentation-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'],
        description: 'Pre-build audience segments for planned campaigns' },
      { name: 'Brief Preparation', agent_id: 'content-agent', department: 'execution',
        depends_on: [1, 2], namespaces: ['campaigns', 'emails', 'brand'],
        description: 'Prepare creative briefs for each campaign' },
      { name: 'Capacity Reservation', agent_id: 'cloud-architect', department: 'strategic',
        depends_on: [1], namespaces: ['campaigns'],
        description: 'Reserve infrastructure capacity for peak periods' },
    ]
  },

  general: {
    name: 'General Project',
    stages: [
      { name: 'Planning', agent_id: null, department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'],
        description: 'Project planning and scoping' },
      { name: 'Execution', agent_id: null, department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails'],
        description: 'Execute planned work' },
      { name: 'Review', agent_id: 'qa-agent', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'kpis', 'brand'],
        description: 'Quality review and validation' },
    ]
  }
};

export default PIPELINE_TEMPLATES;
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/data/pipelineTemplates.js
git commit -m "feat(pipeline): add pipeline template definitions"
```

---

## Task 3: AI Functions — Handoff Summary + Pipeline System Prompt

**Files:**
- Modify: `packages/core/pm-agent/core.js` (add 3 new exported functions after existing exports)

- [ ] **Step 1: Add `generateHandoffSummary` function**

Add at the end of `core.js`, before the final export (or alongside existing exports). This function uses Claude `tool_use` with forced tool choice to produce structured JSON:

```javascript
/**
 * Generate a structured handoff summary using Claude tool_use.
 * Called OUTSIDE of DB transaction — if this fails, pipeline state is unchanged.
 */
async function generateHandoffSummary(conversation, projectContext, stageInfo, nextAgentInfo) {
    const systemPrompt = `You are a project handoff specialist. Extract a precise, complete summary of the work done in this stage.
Any information lost here cannot be recovered by the next agent.

Project: ${projectContext.name}
Current Stage: ${stageInfo.name} (by ${stageInfo.agentName})

CRITICAL RULES:
- ONLY list as "deliverables" items explicitly created/finalized in the conversation
- If something was discussed but not concluded, it goes in "open_questions"
- Do not infer decisions not explicitly agreed upon by the user
- context_for_next must be specifically addressed to ${nextAgentInfo.name} and their role as ${nextAgentInfo.role}
- Write in the same language used in the conversation`;

    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: conversation,
        tools: [{
            name: 'submit_handoff_summary',
            description: 'Submit the structured handoff summary for stage completion',
            input_schema: {
                type: 'object',
                properties: {
                    summary: { type: 'string', description: '2-3 sentence paragraph of what was accomplished' },
                    decisions_made: { type: 'array', items: { type: 'string' }, description: 'Specific decisions with rationale' },
                    deliverables: { type: 'array', items: { type: 'string' }, description: 'Concrete deliverables produced' },
                    open_questions: { type: 'array', items: { type: 'string' }, description: 'Unresolved issues for next stage' },
                    context_for_next: { type: 'string', description: 'Specific guidance for the next agent' }
                },
                required: ['summary', 'decisions_made', 'deliverables', 'open_questions', 'context_for_next']
            }
        }],
        tool_choice: { type: 'tool', name: 'submit_handoff_summary' }
    });

    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock) throw new Error('Claude did not produce handoff summary');
    const handoffData = toolBlock.input;

    if (!handoffData.summary || handoffData.summary.length < 20) throw new Error('Summary too short');
    if (!handoffData.decisions_made?.length) throw new Error('No decisions captured');

    return handoffData;
}
```

- [ ] **Step 2: Add `buildAccumulatedContext` function**

Tiered summary injection — full for distance=1, compressed for distance>1:

```javascript
/**
 * Build accumulated context from completed pipeline sessions.
 * Full summary for immediate predecessor, compressed for earlier stages.
 */
function buildAccumulatedContext(completedSessions, currentStageOrder) {
    if (!completedSessions || completedSessions.length === 0) return '';
    let context = '## Previous Work\n\n';
    for (const session of completedSessions) {
        const distance = currentStageOrder - session.stage_order;
        const deliverables = typeof session.deliverables === 'string'
            ? JSON.parse(session.deliverables) : (session.deliverables || {});
        if (distance <= 1) {
            context += `### Stage: ${session.stage_name} — by ${session.agent_name}\n`;
            context += `${session.summary || 'No summary available.'}\n`;
            context += `Key decisions: ${deliverables.decisions_made?.join('; ') || 'None recorded'}\n`;
            context += `Deliverables: ${deliverables.deliverables?.join('; ') || 'None recorded'}\n`;
            context += `Open questions: ${deliverables.open_questions?.join('; ') || 'None'}\n\n`;
        } else {
            context += `### Stage: ${session.stage_name} — by ${session.agent_name} (summary)\n`;
            context += `Decisions: ${deliverables.decisions_made?.join('; ') || 'None'}\n`;
            context += `For downstream: ${deliverables.context_for_next || 'No specific guidance'}\n\n`;
        }
    }
    return context;
}
```

- [ ] **Step 3: Add `buildPipelineSystemPrompt` function**

Personality sandwich structure: identity → pipeline context → project details → RAG → identity reminder:

```javascript
/**
 * Build system prompt for an agent working within a pipeline stage.
 * "Personality sandwich": identity, pipeline context, project, RAG, identity reminder.
 */
function buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragContext) {
    const skills = Array.isArray(agent.skills) ? agent.skills.join(', ') : '';
    const tools = Array.isArray(agent.tools) ? agent.tools.join(', ') : '';

    let prompt = `You are ${agent.name}, an AI agent working in the ${agent.department} department.
Your role: ${agent.role}
${skills ? `Your skills: ${skills}` : ''}
${tools ? `Your tools: ${tools}` : ''}

## Behavior Rules
1. Stay in character as ${agent.name}
2. Be helpful, direct, knowledgeable about your domain
3. Every message must add value
4. Max 1-2 questions per message
5. Respond in the same language the user writes to you`;

    if (accumulatedContext) {
        prompt += `\n\n${accumulatedContext}`;
    }

    prompt += `\n\n## Your Task
You are responsible for the "${stage.name}" stage.
${stage.description || ''}

## Project Details
Name: ${project.name}
${project.problem ? `Problem: ${project.problem}` : ''}
${project.solution ? `Solution: ${project.solution}` : ''}`;

    if (ragContext) {
        prompt += `\n\n${ragContext}`;
    }

    prompt += `\n\n## REMEMBER
You are ${agent.name}. Stay in character. Respond from YOUR expertise.
Do not repeat previous agents' work. Focus on YOUR stage: ${stage.name}.

## Stage Completion
When your stage work is substantially complete, end your message with:
[STAGE_READY: brief reason why this stage appears complete]
Only include this when genuinely done. Never in your first 3 messages.`;

    return prompt;
}
```

- [ ] **Step 4: Add `buildPipelineConversation` — sliding window**

```javascript
/**
 * Sliding window for pipeline conversations — keeps first 2 + last 24 messages.
 */
function buildPipelineConversation(allMessages) {
    if (allMessages.length <= 26) return allMessages;
    const first = allMessages.slice(0, 2);
    const recent = allMessages.slice(-24);
    const bridge = {
        role: 'user',
        content: `[${allMessages.length - 26} earlier messages omitted. Key context is in the stage summary above.]`
    };
    return [...first, bridge, ...recent];
}
```

Note: The bridge message uses role `'user'` (not `'system'`) because the Anthropic API only accepts `user`/`assistant` roles in the messages array. System-level context goes in the `system` parameter.

- [ ] **Step 5: Export the new functions**

Add to the existing export statement at the bottom of `core.js`:

```javascript
export { chatWithPMAgent, extractJSON, generateSummary, generateProject, generateHandoffSummary, buildAccumulatedContext, buildPipelineSystemPrompt, buildPipelineConversation };
```

- [ ] **Step 6: Verify import works**

```bash
cd c:\Users\gmunoz02\Desktop\agentOS
node -e "import('./packages/core/pm-agent/core.js').then(m => console.log(Object.keys(m))).catch(e => console.error(e))"
```

Expected: array includes `generateHandoffSummary`, `buildAccumulatedContext`, `buildPipelineSystemPrompt`, `buildPipelineConversation`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/pm-agent/core.js
git commit -m "feat(pipeline): add handoff summary generation and pipeline prompt building"
```

---

## Task 4: Backend Endpoints — Pipeline CRUD + Handoff + Session Chat

**Files:**
- Modify: `apps/dashboard/server.js` (add new section after existing workflow endpoints, around line ~2685)

This is the largest task. All endpoints go inside server.js per project convention ("un solo server.js").

- [ ] **Step 1: Add import for new functions at top of server.js**

Update the import from `core.js` (line 18) to include the new functions:

```javascript
import { chatWithPMAgent, extractJSON, generateSummary, generateProject, generateHandoffSummary, buildAccumulatedContext, buildPipelineSystemPrompt, buildPipelineConversation } from '../../packages/core/pm-agent/core.js';
```

- [ ] **Step 2: Add the pipeline section header and helper**

After the last workflow endpoint (around line ~2685), add:

```javascript
// ═══════════ PIPELINE SYSTEM ═══════════════════════════════════════════════

async function logAuditTx(client, eventType, department, agentId, title, details) {
    await client.query(
        `INSERT INTO audit_log (event_type, department, agent_id, title, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventType, department, agentId, title, (details || '').substring(0, 500)]
    );
}
```

- [ ] **Step 3: POST /api/projects/:id/pipeline — Create pipeline**

```javascript
app.post('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { template_id, stages } = req.body;
        if (!stages || !Array.isArray(stages) || stages.length === 0) {
            return res.status(400).json({ error: 'stages array is required' });
        }

        // Verify project exists
        const projRes = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

        // Check no existing pipeline
        const existingRes = await pool.query('SELECT id FROM project_pipeline WHERE project_id = $1', [projectId]);
        if (existingRes.rows.length > 0) return res.status(409).json({ error: 'Pipeline already exists for this project' });

        // Validate all agent_ids exist
        const agentIds = stages.filter(s => s.agent_id).map(s => s.agent_id);
        if (agentIds.length > 0) {
            const agentsRes = await pool.query('SELECT id FROM agents WHERE id = ANY($1)', [agentIds]);
            const foundIds = new Set(agentsRes.rows.map(r => r.id));
            const missing = agentIds.filter(id => !foundIds.has(id));
            if (missing.length > 0) return res.status(400).json({ error: `Agents not found: ${missing.join(', ')}` });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create pipeline
            const pipelineRes = await client.query(
                `INSERT INTO project_pipeline (project_id, template_id) VALUES ($1, $2) RETURNING *`,
                [projectId, template_id || null]
            );
            const pipeline = pipelineRes.rows[0];

            // 2. Create stages
            for (let i = 0; i < stages.length; i++) {
                const s = stages[i];
                await client.query(
                    `INSERT INTO pipeline_stages (pipeline_id, stage_order, name, agent_id, department, description, depends_on, gate_type, namespaces)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [pipeline.id, i, s.name, s.agent_id, s.department || null, s.description || null,
                     s.depends_on || [], s.gate_type || 'none', s.namespaces || []]
                );
            }

            // 3. Create sessions for all stages
            for (let i = 0; i < stages.length; i++) {
                const s = stages[i];
                const isFirstStage = !s.depends_on || s.depends_on.length === 0;
                await client.query(
                    `INSERT INTO project_agent_sessions (project_id, pipeline_id, agent_id, stage_name, stage_order, status, started_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [projectId, pipeline.id, s.agent_id, s.name, i,
                     isFirstStage ? 'active' : 'pending',
                     isFirstStage ? new Date() : null]
                );
            }

            // 4. Audit log
            await logAuditTx(client, 'pipeline_created', stages[0]?.department, null,
                `Pipeline created for project #${projectId}`,
                `Template: ${template_id || 'custom'}, ${stages.length} stages`);

            await client.query('COMMIT');
            res.status(201).json(pipeline);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 4: GET /api/projects/:id/pipeline — Full pipeline state**

```javascript
app.get('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const result = await pool.query(
            `SELECT pp.*,
                (SELECT json_agg(
                    json_build_object(
                        'id', ps.id, 'stage_order', ps.stage_order, 'name', ps.name,
                        'agent_id', ps.agent_id, 'department', ps.department,
                        'description', ps.description, 'depends_on', ps.depends_on,
                        'gate_type', ps.gate_type, 'namespaces', ps.namespaces
                    ) ORDER BY ps.stage_order
                ) FROM pipeline_stages ps WHERE ps.pipeline_id = pp.id) as stages,
                (SELECT json_agg(
                    json_build_object(
                        'id', pas.id, 'agent_id', pas.agent_id,
                        'stage_name', pas.stage_name, 'stage_order', pas.stage_order,
                        'status', pas.status, 'summary', pas.summary,
                        'summary_edited', pas.summary_edited, 'deliverables', pas.deliverables,
                        'started_at', pas.started_at, 'completed_at', pas.completed_at
                    ) ORDER BY pas.stage_order
                ) FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id) as sessions
            FROM project_pipeline pp
            WHERE pp.project_id = $1`,
            [projectId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No pipeline found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 5: DELETE /api/projects/:id/pipeline — Cancel pipeline**

```javascript
app.delete('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const result = await pool.query(
            'DELETE FROM project_pipeline WHERE project_id = $1 RETURNING id',
            [projectId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No pipeline found' });
        await logAudit('pipeline_deleted', null, null,
            `Pipeline deleted for project #${projectId}`, '');
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 6: POST /api/projects/:id/pipeline/handoff — 2-phase handoff**

This is the core endpoint. Phase A: AI generates summary (outside transaction). Phase B: Atomic DB update (inside transaction).

```javascript
app.post('/api/projects/:id/pipeline/handoff', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { session_id, summary_override, notes } = req.body;
        if (!session_id) return res.status(400).json({ error: 'session_id is required' });

        // Load current session + pipeline
        const sessionRes = await pool.query(
            `SELECT pas.*, a.name as agent_name, a.role as agent_role,
                    pp.id as pipeline_id, pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.id = $1 AND pas.project_id = $2`,
            [session_id, projectId]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const currentSession = sessionRes.rows[0];

        if (!['active', 'awaiting_handoff'].includes(currentSession.status)) {
            return res.status(409).json({ error: `Session status is ${currentSession.status}, cannot handoff` });
        }
        if (currentSession.pipeline_status !== 'active') {
            return res.status(409).json({ error: `Pipeline is ${currentSession.pipeline_status}` });
        }

        // Check for open blockers
        const blockers = await pool.query(
            `SELECT count(*) FROM collaboration_raises
             WHERE pipeline_session_id = $1 AND status = 'open' AND raise_type = 'blocker'`,
            [session_id]
        );
        if (parseInt(blockers.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Cannot handoff with open blockers' });
        }

        // Load project for context
        const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        const project = projRes.rows[0];

        // Load current stage info
        const stageRes = await pool.query(
            `SELECT * FROM pipeline_stages WHERE pipeline_id = $1 AND stage_order = $2`,
            [currentSession.pipeline_id, currentSession.stage_order]
        );
        const currentStage = stageRes.rows[0];

        // Check gate_type
        if (currentStage.gate_type === 'human_approval' && !req.body.gate_approved) {
            return res.status(409).json({ error: 'Human approval required for this stage', gate_required: true });
        }

        // Find next stages to determine next agent for context_for_next
        const nextStagesPreview = await pool.query(
            `SELECT ps.*, a.name as agent_name, a.role as agent_role
             FROM pipeline_stages ps
             JOIN agents a ON a.id = ps.agent_id
             WHERE ps.pipeline_id = $1 AND ps.stage_order > $2
             ORDER BY ps.stage_order LIMIT 2`,
            [currentSession.pipeline_id, currentSession.stage_order]
        );
        const nextAgentInfo = nextStagesPreview.rows.length > 0
            ? { name: nextStagesPreview.rows[0].agent_name, role: nextStagesPreview.rows[0].agent_role }
            : { name: 'the team', role: 'project completion' };

        // ── PHASE A: Generate AI summary (outside transaction) ──
        let handoffData;
        if (summary_override) {
            handoffData = {
                summary: summary_override,
                decisions_made: ['User-provided summary'],
                deliverables: [],
                open_questions: [],
                context_for_next: notes || ''
            };
        } else {
            const messagesRes = await pool.query(
                `SELECT role, content FROM pipeline_session_messages
                 WHERE session_id = $1 ORDER BY created_at`,
                [session_id]
            );
            const conversation = messagesRes.rows.map(m => ({ role: m.role, content: m.content }));

            try {
                handoffData = await generateHandoffSummary(
                    conversation,
                    { name: project.name },
                    { name: currentStage.name, agentName: currentSession.agent_name },
                    nextAgentInfo
                );
            } catch (aiErr) {
                return res.status(502).json({ error: `AI summary generation failed: ${aiErr.message}` });
            }
        }

        // ── PHASE B: Atomic DB update (inside transaction) ──
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Lock pipeline row
            const pipeline = (await client.query(
                'SELECT * FROM project_pipeline WHERE id = $1 FOR UPDATE',
                [currentSession.pipeline_id]
            )).rows[0];

            if (pipeline.status !== 'active') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Pipeline is ${pipeline.status}` });
            }

            // 1. Complete current session
            await client.query(
                `UPDATE project_agent_sessions
                 SET status = 'completed', summary = $1, deliverables = $2, completed_at = NOW()
                 WHERE id = $3 AND status IN ('active', 'awaiting_handoff')`,
                [handoffData.summary, JSON.stringify(handoffData), session_id]
            );

            // 2. Find and activate next stages (DAG: all whose depends_on are complete)
            const nextStages = await client.query(
                `SELECT ps.* FROM pipeline_stages ps
                 WHERE ps.pipeline_id = $1
                 AND NOT EXISTS (
                     SELECT 1 FROM unnest(ps.depends_on) AS dep
                     WHERE dep NOT IN (
                         SELECT stage_order FROM project_agent_sessions
                         WHERE pipeline_id = $1 AND status = 'completed'
                     )
                 )
                 AND ps.stage_order NOT IN (
                     SELECT stage_order FROM project_agent_sessions
                     WHERE pipeline_id = $1 AND status IN ('active', 'completed', 'skipped')
                 )`,
                [pipeline.id]
            );

            for (const stage of nextStages.rows) {
                await client.query(
                    `UPDATE project_agent_sessions
                     SET status = 'active', started_at = NOW()
                     WHERE pipeline_id = $1 AND stage_order = $2`,
                    [pipeline.id, stage.stage_order]
                );
            }

            // 3. Check if pipeline is complete
            const remaining = await client.query(
                `SELECT count(*) FROM project_agent_sessions
                 WHERE pipeline_id = $1 AND status IN ('pending', 'active', 'awaiting_handoff')`,
                [pipeline.id]
            );
            if (parseInt(remaining.rows[0].count) === 0) {
                await client.query(
                    "UPDATE project_pipeline SET status = 'completed', updated_at = NOW() WHERE id = $1",
                    [pipeline.id]
                );
            }

            // 4. Audit log
            await logAuditTx(client, 'pipeline_handoff', currentStage.department, currentSession.agent_id,
                `Pipeline handoff: ${currentStage.name} completed`,
                handoffData.summary);

            // 5. Create collaboration raises for handoff trail
            for (const stage of nextStages.rows) {
                await client.query(
                    `INSERT INTO collaboration_raises
                     (from_agent, to_agent, raise_type, title, details, status, pipeline_session_id)
                     VALUES ($1, $2, 'handoff', $3, $4, 'resolved', $5)`,
                    [currentSession.agent_id, stage.agent_id,
                     `Handoff: ${currentStage.name} → ${stage.name}`,
                     handoffData.context_for_next,
                     session_id]
                );
            }

            await client.query('COMMIT');

            // Return updated pipeline state
            const updatedPipeline = await pool.query(
                `SELECT pp.*,
                    (SELECT json_agg(json_build_object(
                        'id', pas.id, 'agent_id', pas.agent_id,
                        'stage_name', pas.stage_name, 'stage_order', pas.stage_order,
                        'status', pas.status, 'summary', pas.summary,
                        'completed_at', pas.completed_at
                    ) ORDER BY pas.stage_order)
                    FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id) as sessions
                FROM project_pipeline pp WHERE pp.id = $1`,
                [pipeline.id]
            );
            res.json({ handoff: handoffData, pipeline: updatedPipeline.rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 7: Pipeline action endpoints (pause, resume, skip)**

```javascript
app.post('/api/projects/:id/pipeline/pause', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE project_pipeline SET status = 'paused', updated_at = NOW() WHERE project_id = $1 AND status = 'active' RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No active pipeline found' });
        await logAudit('pipeline_paused', null, null, `Pipeline paused for project #${req.params.id}`, '');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects/:id/pipeline/resume', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE project_pipeline SET status = 'active', updated_at = NOW() WHERE project_id = $1 AND status = 'paused' RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No paused pipeline found' });
        await logAudit('pipeline_resumed', null, null, `Pipeline resumed for project #${req.params.id}`, '');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects/:id/pipeline/stages/:order/skip', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const stageOrder = parseInt(req.params.order);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pipeline = (await client.query(
                'SELECT * FROM project_pipeline WHERE project_id = $1 FOR UPDATE', [projectId]
            )).rows[0];
            if (!pipeline) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pipeline not found' }); }

            // Skip the session
            await client.query(
                `UPDATE project_agent_sessions SET status = 'skipped', completed_at = NOW()
                 WHERE pipeline_id = $1 AND stage_order = $2 AND status IN ('pending', 'active')`,
                [pipeline.id, stageOrder]
            );

            // Activate next stages whose deps are all completed or skipped
            const nextStages = await client.query(
                `SELECT ps.* FROM pipeline_stages ps
                 WHERE ps.pipeline_id = $1
                 AND NOT EXISTS (
                     SELECT 1 FROM unnest(ps.depends_on) AS dep
                     WHERE dep NOT IN (
                         SELECT stage_order FROM project_agent_sessions
                         WHERE pipeline_id = $1 AND status IN ('completed', 'skipped')
                     )
                 )
                 AND ps.stage_order NOT IN (
                     SELECT stage_order FROM project_agent_sessions
                     WHERE pipeline_id = $1 AND status IN ('active', 'completed', 'skipped')
                 )`,
                [pipeline.id]
            );

            for (const stage of nextStages.rows) {
                await client.query(
                    `UPDATE project_agent_sessions SET status = 'active', started_at = NOW()
                     WHERE pipeline_id = $1 AND stage_order = $2`,
                    [pipeline.id, stage.stage_order]
                );
            }

            await logAuditTx(client, 'pipeline_stage_skipped', null, null,
                `Stage ${stageOrder} skipped in project #${projectId}`, '');
            await client.query('COMMIT');
            res.json({ skipped: true, activated: nextStages.rows.map(s => s.stage_order) });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 8: Session messages + chat endpoints**

```javascript
// GET /api/projects/:id/sessions/:sessionId/messages — Paginated messages
app.get('/api/projects/:id/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const result = await pool.query(
            `SELECT * FROM pipeline_session_messages
             WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
            [req.params.sessionId, limit, offset]
        );
        const countRes = await pool.query(
            'SELECT count(*) FROM pipeline_session_messages WHERE session_id = $1',
            [req.params.sessionId]
        );
        res.json({ messages: result.rows, total: parseInt(countRes.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:id/sessions/:sessionId/chat — SSE streaming chat
app.post('/api/projects/:id/sessions/:sessionId/chat', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        const sessionId = parseInt(req.params.sessionId);
        const projectId = parseInt(req.params.id);
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // Load session + agent + stage
        const sessionRes = await pool.query(
            `SELECT pas.*, a.name as agent_name, a.role as agent_role,
                    a.department as agent_department, a.skills as agent_skills, a.tools as agent_tools,
                    ps.description as stage_description, ps.namespaces as stage_namespaces,
                    pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN pipeline_stages ps ON ps.pipeline_id = pas.pipeline_id AND ps.stage_order = pas.stage_order
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.id = $1 AND pas.project_id = $2`,
            [sessionId, projectId]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const session = sessionRes.rows[0];

        if (session.status !== 'active') return res.status(409).json({ error: `Session is ${session.status}` });
        if (session.pipeline_status !== 'active') return res.status(409).json({ error: 'Pipeline is not active' });

        // Load project
        const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        const project = projRes.rows[0];

        // Load completed sessions for accumulated context
        const completedRes = await pool.query(
            `SELECT pas.*, a.name as agent_name
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             WHERE pas.pipeline_id = $1 AND pas.status = 'completed'
             ORDER BY pas.stage_order`,
            [session.pipeline_id]
        );
        const accumulatedContext = buildAccumulatedContext(completedRes.rows, session.stage_order);

        // RAG context
        const ragNamespaces = session.stage_namespaces && session.stage_namespaces.length > 0
            ? session.stage_namespaces
            : ['campaigns', 'kpis'];
        const ragResult = typeof isKBReady === 'function' && isKBReady()
            ? await buildRAGContext(pool, message, { namespaces: ragNamespaces })
            : { context: '', sources: [] };

        // Build system prompt
        const agent = {
            name: session.agent_name, role: session.agent_role,
            department: session.agent_department,
            skills: session.agent_skills, tools: session.agent_tools
        };
        const stage = { name: session.stage_name, description: session.stage_description };
        const systemPrompt = buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragResult.context);

        // Load conversation history and apply sliding window
        const historyRes = await pool.query(
            `SELECT role, content FROM pipeline_session_messages
             WHERE session_id = $1 ORDER BY created_at`,
            [sessionId]
        );
        let allMessages = historyRes.rows.map(m => ({ role: m.role, content: m.content }));
        allMessages.push({ role: 'user', content: message });
        const apiMessages = buildPipelineConversation(allMessages);

        // Save user message
        await pool.query(
            `INSERT INTO pipeline_session_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
            [sessionId, message]
        );

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources));
        }
        res.flushHeaders();

        // Stream via chatWithPMAgent with system prompt override
        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, {
            stream: true,
            systemPromptOverride: systemPrompt,
        });

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;
        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        // Detect [STAGE_READY:] marker
        const stageReadyMatch = fullResponse.match(/\[STAGE_READY:\s*(.+?)\]/);
        if (stageReadyMatch) {
            res.write(`data: ${JSON.stringify({ handoff_suggestion: true, reason: stageReadyMatch[1] })}\n\n`);
            fullResponse = fullResponse.replace(/\[STAGE_READY:\s*.+?\]/, '').trim();
        }

        // Save assistant message
        await pool.query(
            `INSERT INTO pipeline_session_messages (session_id, role, content, metadata)
             VALUES ($1, 'assistant', $2, $3)`,
            [sessionId, fullResponse, JSON.stringify({ rag_sources: ragResult.sources })]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// PATCH /api/projects/:id/sessions/:sessionId/summary — Edit handoff summary
app.patch('/api/projects/:id/sessions/:sessionId/summary', requireAuth, async (req, res) => {
    try {
        const { summary_edited } = req.body;
        const result = await pool.query(
            `UPDATE project_agent_sessions SET summary_edited = $1
             WHERE id = $2 AND project_id = $3 RETURNING *`,
            [summary_edited, req.params.sessionId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 9: Cross-project endpoints**

```javascript
// GET /api/pipelines/active — All active pipelines
app.get('/api/pipelines/active', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pp.*, p.name as project_name, p.department as project_department,
                (SELECT count(*) FROM project_agent_sessions WHERE pipeline_id = pp.id AND status = 'completed') as completed_stages,
                (SELECT count(*) FROM pipeline_stages WHERE pipeline_id = pp.id) as total_stages,
                (SELECT json_agg(json_build_object(
                    'stage_name', pas.stage_name, 'agent_id', pas.agent_id, 'status', pas.status
                ) ORDER BY pas.stage_order)
                FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id AND pas.status = 'active') as active_stages
            FROM project_pipeline pp
            JOIN projects p ON p.id = pp.project_id
            WHERE pp.status IN ('active', 'paused')
            ORDER BY pp.updated_at DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agents/:agentId/active-sessions — Sessions for an agent
app.get('/api/agents/:agentId/active-sessions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pas.*, p.name as project_name, pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN projects p ON p.id = pas.project_id
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.agent_id = $1 AND pas.status IN ('pending', 'active', 'awaiting_handoff')
             ORDER BY pas.started_at DESC NULLS LAST`,
            [req.params.agentId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 10: Restart server and test basic CRUD**

```bash
# Server should auto-restart. Test with curl:
curl -s -b cookies.txt http://localhost:3001/api/pipelines/active | head -c 200
```

Expected: `[]` (empty array, no active pipelines yet).

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(pipeline): add all pipeline API endpoints (CRUD, handoff, chat, sessions)"
```

---

## Task 5: i18n — Pipeline Translation Keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add `pipeline` namespace to both ES and EN**

Add inside the `es` object and `en` object, alongside existing namespaces like `workflows`:

**Spanish (es):**
```javascript
pipeline: {
    title: 'Pipeline',
    createPipeline: 'Crear Pipeline',
    selectTemplate: 'Seleccionar Template',
    reviewStages: 'Revisar Stages',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    active: 'Activo',
    paused: 'Pausado',
    completed: 'Completado',
    failed: 'Fallido',
    pending: 'Pendiente',
    skipped: 'Omitido',
    awaitingHandoff: 'Esperando handoff',
    handoff: 'Handoff',
    handoffTo: 'Pasar a',
    handoffSummary: 'Resumen del handoff',
    handoffNotes: 'Notas para el siguiente agente',
    editSummary: 'Editar resumen',
    confirmHandoff: 'Confirmar Handoff',
    generatingSummary: 'Generando resumen...',
    summaryGenerated: 'Resumen generado por AI',
    stageReady: 'Stage listo para handoff',
    gateApproval: 'Aprobación requerida',
    approveGate: 'Aprobar',
    pause: 'Pausar',
    resume: 'Reanudar',
    skip: 'Omitir stage',
    skipConfirm: '¿Seguro que quieres omitir este stage?',
    noPipeline: 'Sin pipeline asignado',
    createFirst: 'Asigna un pipeline para empezar',
    templateCampaign: 'Campaign Creation',
    templateFlashSale: 'Flash Sale Rapid Deploy',
    templateSeasonal: 'Seasonal Campaign Planning',
    templateGeneral: 'Proyecto General',
    stages: 'stages',
    stage: 'Stage',
    assignAgent: 'Asignar agente',
    changeAgent: 'Cambiar agente',
    noAgent: 'Sin agente',
    activePipelines: 'Pipelines Activos',
    progress: 'Progreso',
    lastActivity: 'Última actividad',
    openPipeline: 'Abrir Pipeline',
    details: 'Detalles',
    previousWork: 'Trabajo previo',
    chatWithAgent: 'Chat con {name}',
    pipelinePaused: 'Pipeline pausado — chat deshabilitado',
    handoffSuccess: 'Handoff completado',
    handoffError: 'Error en handoff',
    blockerWarning: 'Hay blockers abiertos — resuelve antes de hacer handoff',
    assignedTickets: 'Tickets asignados',
    noTickets: 'Sin tickets de pipeline asignados',
},
```

**English (en):**
```javascript
pipeline: {
    title: 'Pipeline',
    createPipeline: 'Create Pipeline',
    selectTemplate: 'Select Template',
    reviewStages: 'Review Stages',
    confirm: 'Confirm',
    cancel: 'Cancel',
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    failed: 'Failed',
    pending: 'Pending',
    skipped: 'Skipped',
    awaitingHandoff: 'Awaiting handoff',
    handoff: 'Handoff',
    handoffTo: 'Hand off to',
    handoffSummary: 'Handoff Summary',
    handoffNotes: 'Notes for next agent',
    editSummary: 'Edit summary',
    confirmHandoff: 'Confirm Handoff',
    generatingSummary: 'Generating summary...',
    summaryGenerated: 'AI-generated summary',
    stageReady: 'Stage ready for handoff',
    gateApproval: 'Approval required',
    approveGate: 'Approve',
    pause: 'Pause',
    resume: 'Resume',
    skip: 'Skip stage',
    skipConfirm: 'Are you sure you want to skip this stage?',
    noPipeline: 'No pipeline assigned',
    createFirst: 'Assign a pipeline to get started',
    templateCampaign: 'Campaign Creation',
    templateFlashSale: 'Flash Sale Rapid Deploy',
    templateSeasonal: 'Seasonal Campaign Planning',
    templateGeneral: 'General Project',
    stages: 'stages',
    stage: 'Stage',
    assignAgent: 'Assign agent',
    changeAgent: 'Change agent',
    noAgent: 'No agent',
    activePipelines: 'Active Pipelines',
    progress: 'Progress',
    lastActivity: 'Last activity',
    openPipeline: 'Open Pipeline',
    details: 'Details',
    previousWork: 'Previous work',
    chatWithAgent: 'Chat with {name}',
    pipelinePaused: 'Pipeline paused — chat disabled',
    handoffSuccess: 'Handoff completed',
    handoffError: 'Handoff error',
    blockerWarning: 'Open blockers — resolve before handoff',
    assignedTickets: 'Assigned tickets',
    noTickets: 'No pipeline tickets assigned',
},
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(pipeline): add i18n translations (ES + EN) for pipeline UI"
```

---

## Task 6: useStreamingChat Hook — Extract SSE Pattern

**Files:**
- Create: `apps/dashboard/src/hooks/useStreamingChat.js`
- Reference: `apps/dashboard/src/components/AgentChat.jsx` lines 82-113 (read-only pattern source)

- [ ] **Step 1: Create the hook**

```javascript
import { useState, useRef, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Shared SSE streaming chat hook.
 * Extracted from AgentChat (lines 82-113) to avoid pattern duplication.
 *
 * @param {Object} options
 * @param {string|Function} options.endpoint - URL path (relative to API_URL) or function returning URL
 * @param {Function} [options.buildBody] - (message) => POST body object. Default: { message }
 * @param {Function} [options.onResponseHeaders] - (headers) => void. Extract custom headers.
 * @param {Function} [options.loadConversation] - async () => messages[]. Load initial messages on mount.
 * @param {Function} [options.onStreamEvent] - (event) => void. Handle custom SSE events (e.g. handoff_suggestion).
 */
export function useStreamingChat({ endpoint, buildBody, onResponseHeaders, loadConversation, onStreamEvent }) {
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [ragSources, setRagSources] = useState([]);
    const abortRef = useRef(null);

    // Load conversation on mount
    useEffect(() => {
        if (loadConversation) {
            loadConversation().then(msgs => {
                if (msgs && Array.isArray(msgs)) setMessages(msgs);
            }).catch(() => {});
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const sendMessage = useCallback(async (msg) => {
        if (!msg.trim() || streaming) return;

        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setStreaming(true);

        const url = typeof endpoint === 'function' ? endpoint() : `${API_URL}${endpoint}`;
        const body = buildBody ? buildBody(msg) : { message: msg };

        try {
            abortRef.current = new AbortController();
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Request failed' }));
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error}` }]);
                setStreaming(false);
                return;
            }

            // Extract custom headers
            const ragHeader = res.headers.get('X-RAG-Sources');
            if (ragHeader) {
                try { setRagSources(JSON.parse(ragHeader)); } catch {}
            }
            if (onResponseHeaders) onResponseHeaders(res.headers);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            fullResponse += parsed.text;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
                                return updated;
                            });
                        }
                        // Forward custom events (handoff_suggestion, etc.)
                        if (parsed.handoff_suggestion && onStreamEvent) {
                            onStreamEvent(parsed);
                        }
                    } catch {}
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
            }
        } finally {
            setStreaming(false);
        }
    }, [endpoint, buildBody, onResponseHeaders, onStreamEvent, streaming]);

    const clearConversation = useCallback(() => {
        setMessages([]);
        setRagSources([]);
    }, []);

    return { messages, setMessages, streaming, sendMessage, clearConversation, ragSources };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useStreamingChat.js
git commit -m "feat(pipeline): extract useStreamingChat hook from SSE pattern"
```

---

## Task 7: CSS — Pipeline Styles

**Files:**
- Modify: `apps/dashboard/src/index.css` (append new section at end)

- [ ] **Step 1: Add pipeline CSS section**

Append at the end of `index.css`:

```css
/* ═══════════ PIPELINE ═══════════════════════════════════════════════════════ */

.pipeline-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

/* Template selector */
.pipeline-templates {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
}

.pipeline-template-card {
    background: var(--bg-card);
    border: 2px solid var(--border-light);
    border-radius: 16px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
}

.pipeline-template-card:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 12px var(--primary-trans);
}

.pipeline-template-card.selected {
    border-color: var(--primary);
    background: var(--primary-soft);
}

.pipeline-template-card h3 {
    margin: 0 0 8px;
    font-size: 1.05rem;
}

.pipeline-template-card .stage-count {
    color: var(--text-secondary);
    font-size: 0.85rem;
}

/* Stage editor */
.pipeline-stage-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pipeline-stage-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 12px;
}

.pipeline-stage-row .stage-order {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    flex-shrink: 0;
}

.pipeline-stage-row .stage-info {
    flex: 1;
    min-width: 0;
}

.pipeline-stage-row .stage-name {
    font-weight: 600;
    font-size: 0.95rem;
}

.pipeline-stage-row .stage-dept {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

.pipeline-stage-row select {
    padding: 6px 10px;
    border: 1px solid var(--border-light);
    border-radius: 8px;
    background: var(--bg-main);
    color: var(--text-main);
    font-size: 0.85rem;
}

.pipeline-stage-row .stage-actions {
    display: flex;
    gap: 4px;
}

.pipeline-stage-row .stage-actions button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-secondary);
    border-radius: 6px;
}

.pipeline-stage-row .stage-actions button:hover {
    background: var(--bg-main);
    color: var(--text-main);
}

.pipeline-stage-row .gate-badge {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 99px;
    background: #F59E0B20;
    color: #D97706;
    font-weight: 600;
}

/* Timeline vertical */
.pipeline-timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 8px 0;
}

.pipeline-stage {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    position: relative;
    padding: 0 0 0 4px;
    cursor: pointer;
}

.pipeline-stage-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 16px;
    flex-shrink: 0;
    z-index: 1;
    border: 2px solid transparent;
}

.pipeline-stage-dot.completed {
    background: var(--success, #22c55e);
    border-color: var(--success, #22c55e);
}

.pipeline-stage-dot.active {
    background: var(--primary);
    border-color: var(--primary);
    animation: pulse 2s infinite;
}

.pipeline-stage-dot.pending {
    background: var(--bg-main);
    border-color: var(--border-light);
}

.pipeline-stage-dot.skipped {
    background: var(--bg-main);
    border-color: var(--text-secondary);
}

.pipeline-stage-line {
    position: absolute;
    left: 9px;
    top: 30px;
    width: 2px;
    height: calc(100%);
    background: var(--border-light);
}

.pipeline-stage:last-child .pipeline-stage-line {
    display: none;
}

.pipeline-stage-content {
    flex: 1;
    padding: 8px 16px;
    border-radius: 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    margin-bottom: 8px;
    transition: all 0.2s;
}

.pipeline-stage-content:hover {
    border-color: var(--primary-trans);
}

.pipeline-stage-content.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary-trans);
}

.pipeline-stage-content.selected {
    border-color: var(--primary);
    background: var(--primary-soft);
}

.pipeline-stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.pipeline-stage-title {
    font-weight: 600;
    font-size: 0.95rem;
}

.pipeline-stage-agent {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

.pipeline-stage-summary {
    margin-top: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
}

.pipeline-stage-meta {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.pipeline-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 600;
}

.pipeline-status-badge.completed { background: #22c55e20; color: #16a34a; }
.pipeline-status-badge.active { background: var(--primary-soft); color: var(--primary); }
.pipeline-status-badge.pending { background: var(--bg-main); color: var(--text-secondary); }
.pipeline-status-badge.skipped { background: #f1f5f9; color: #94a3b8; text-decoration: line-through; }
.pipeline-status-badge.paused { background: #F59E0B20; color: #D97706; }

/* Parallel stages connector */
.pipeline-parallel-group {
    display: flex;
    gap: 12px;
    padding-left: 20px;
    margin-bottom: 8px;
}

.pipeline-parallel-group .pipeline-stage-content {
    flex: 1;
}

/* Chat in pipeline context */
.pipeline-chat-container {
    border: 1px solid var(--border-light);
    border-radius: 16px;
    overflow: hidden;
    margin-top: 12px;
}

.pipeline-chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-light);
}

.pipeline-chat-header h3 {
    margin: 0;
    font-size: 0.95rem;
}

.pipeline-context-pills {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    overflow-x: auto;
    background: var(--bg-main);
    border-bottom: 1px solid var(--border-light);
}

.pipeline-context-pill {
    padding: 4px 12px;
    border-radius: 99px;
    font-size: 0.75rem;
    white-space: nowrap;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    cursor: pointer;
}

.pipeline-context-pill.completed {
    background: #22c55e10;
    border-color: #22c55e40;
    color: #16a34a;
}

.pipeline-chat-messages {
    height: 400px;
    overflow-y: auto;
    padding: 16px;
}

.pipeline-chat-input {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-light);
    background: var(--bg-card);
}

.pipeline-chat-input input {
    flex: 1;
    padding: 10px 16px;
    border: 1px solid var(--border-light);
    border-radius: 12px;
    background: var(--bg-main);
    color: var(--text-main);
    font-size: 0.9rem;
}

.pipeline-chat-input button {
    padding: 10px 20px;
    border-radius: 12px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;
}

.pipeline-chat-input .send-btn {
    background: var(--primary);
    color: white;
}

.pipeline-chat-input .handoff-btn {
    background: #22c55e;
    color: white;
}

.pipeline-chat-input .handoff-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
}

/* Handoff suggestion inline */
.handoff-suggestion {
    margin: 12px 16px;
    padding: 12px 16px;
    background: #22c55e10;
    border: 1px solid #22c55e40;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.handoff-suggestion p {
    margin: 0;
    font-size: 0.85rem;
    color: #16a34a;
}

.handoff-suggestion button {
    padding: 8px 16px;
    border-radius: 99px;
    border: none;
    background: #22c55e;
    color: white;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
}

/* Handoff modal */
.handoff-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.handoff-modal {
    background: var(--bg-card);
    border-radius: 20px;
    padding: 32px;
    max-width: 600px;
    width: 90%;
    box-shadow: var(--shadow-lg, 0 25px 50px -12px rgba(0,0,0,.25));
}

.handoff-modal h2 {
    margin: 0 0 20px;
    font-size: 1.2rem;
}

.handoff-modal textarea {
    width: 100%;
    min-height: 120px;
    padding: 14px 16px;
    border: 1px solid var(--border-light);
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--bg-main);
    color: var(--text-main);
    box-sizing: border-box;
    resize: vertical;
}

.handoff-modal .next-agent-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 16px 0;
    padding: 12px;
    background: var(--bg-main);
    border-radius: 12px;
}

.handoff-modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
}

.handoff-modal-actions button {
    padding: 10px 24px;
    border-radius: 12px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
}

.handoff-modal-actions .cancel-btn {
    background: var(--bg-main);
    color: var(--text-main);
}

.handoff-modal-actions .confirm-btn {
    background: #22c55e;
    color: white;
}

.handoff-modal-actions .confirm-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
}

/* Pipeline in agent view */
.agent-pipeline-tickets {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.agent-pipeline-ticket {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.agent-pipeline-ticket:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px var(--primary-trans);
}

.agent-pipeline-ticket .ticket-info h4 {
    margin: 0 0 4px;
    font-size: 0.95rem;
}

.agent-pipeline-ticket .ticket-info span {
    font-size: 0.8rem;
    color: var(--text-secondary);
}

/* Active pipelines overview */
.active-pipelines-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.active-pipeline-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.active-pipeline-card:hover {
    border-color: var(--primary);
}

.active-pipeline-card .pipeline-info h4 {
    margin: 0 0 4px;
}

.active-pipeline-card .pipeline-progress {
    display: flex;
    align-items: center;
    gap: 8px;
}

.active-pipeline-card .progress-bar {
    width: 80px;
    height: 6px;
    background: var(--bg-main);
    border-radius: 3px;
    overflow: hidden;
}

.active-pipeline-card .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 3px;
    transition: width 0.3s;
}

/* Responsive */
@media (max-width: 768px) {
    .pipeline-templates {
        grid-template-columns: 1fr;
    }
    .pipeline-parallel-group {
        flex-direction: column;
        padding-left: 0;
    }
    .pipeline-chat-messages {
        height: 300px;
    }
    .handoff-modal {
        padding: 20px;
        margin: 16px;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(pipeline): add pipeline CSS styles (~250 lines)"
```

---

## Task 8: PipelineSelector Component

**Files:**
- Create: `apps/dashboard/src/components/PipelineSelector.jsx`

- [ ] **Step 1: Create PipelineSelector.jsx**

Template picker (step 1) → stage editor with agent dropdowns (step 2) → confirm.

```javascript
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import PIPELINE_TEMPLATES from '../data/pipelineTemplates.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function PipelineSelector({ projectId, onCreated }) {
    const { t } = useLanguage();
    const [step, setStep] = useState(1); // 1=select template, 2=review stages
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [stages, setStages] = useState([]);
    const [agents, setAgents] = useState([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/agents`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setAgents(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const selectTemplate = (key) => {
        const template = PIPELINE_TEMPLATES[key];
        setSelectedTemplate(key);
        setStages(template.stages.map((s, i) => ({ ...s, _order: i })));
        setStep(2);
    };

    const updateStageAgent = (index, agentId) => {
        setStages(prev => prev.map((s, i) => i === index ? { ...s, agent_id: agentId } : s));
    };

    const removeStage = (index) => {
        setStages(prev => {
            const updated = prev.filter((_, i) => i !== index);
            // Recalculate depends_on after removal
            return updated.map((s, i) => ({
                ...s,
                depends_on: (s.depends_on || [])
                    .filter(d => d !== index)
                    .map(d => d > index ? d - 1 : d)
            }));
        });
    };

    const moveStage = (index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === stages.length - 1)) return;
        setStages(prev => {
            const updated = [...prev];
            const swap = index + direction;
            [updated[index], updated[swap]] = [updated[swap], updated[index]];
            return updated;
        });
    };

    const createPipeline = async () => {
        const invalidStages = stages.filter(s => !s.agent_id);
        if (invalidStages.length > 0) return;

        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    template_id: selectedTemplate,
                    stages: stages.map((s, i) => ({
                        name: s.name,
                        agent_id: s.agent_id,
                        department: s.department,
                        description: s.description,
                        depends_on: s.depends_on || [],
                        gate_type: s.gate_type || 'none',
                        namespaces: s.namespaces || [],
                    }))
                })
            });
            if (res.ok) {
                const pipeline = await res.json();
                if (onCreated) onCreated(pipeline);
            }
        } catch (err) {
            console.error('Failed to create pipeline:', err);
        } finally {
            setCreating(false);
        }
    };

    if (step === 1) {
        return (
            <div className="pipeline-container">
                <h3>{t('pipeline.selectTemplate')}</h3>
                <div className="pipeline-templates">
                    {Object.entries(PIPELINE_TEMPLATES).map(([key, tmpl]) => (
                        <div
                            key={key}
                            className={`pipeline-template-card ${selectedTemplate === key ? 'selected' : ''}`}
                            onClick={() => selectTemplate(key)}
                        >
                            <h3>{t(`pipeline.template${key.charAt(0).toUpperCase() + key.slice(1).replace(/_(\w)/g, (_, c) => c.toUpperCase())}`) || tmpl.name}</h3>
                            <span className="stage-count">{tmpl.stages.length} {t('pipeline.stages')}</span>
                            {tmpl.source_workflow && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {tmpl.source_workflow}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="pipeline-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>{t('pipeline.reviewStages')}</h3>
                <button className="back-button" onClick={() => setStep(1)}>← {t('pipeline.selectTemplate')}</button>
            </div>
            <div className="pipeline-stage-editor">
                {stages.map((stage, i) => (
                    <div key={i} className="pipeline-stage-row">
                        <span className="stage-order">{i}</span>
                        <div className="stage-info">
                            <div className="stage-name">{stage.name}</div>
                            <div className="stage-dept">{stage.department}</div>
                        </div>
                        <select
                            value={stage.agent_id || ''}
                            onChange={e => updateStageAgent(i, e.target.value)}
                        >
                            <option value="">{t('pipeline.assignAgent')}</option>
                            {agents
                                .filter(a => !stage.department || a.department === stage.department)
                                .map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            {/* Show all agents if none match department */}
                            {agents.filter(a => a.department === stage.department).length === 0 &&
                                agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.department})</option>
                                ))
                            }
                        </select>
                        {stage.gate_type === 'human_approval' && (
                            <span className="gate-badge">🔒 Gate</span>
                        )}
                        <div className="stage-actions">
                            <button onClick={() => moveStage(i, -1)} disabled={i === 0}>↑</button>
                            <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1}>↓</button>
                            <button onClick={() => removeStage(i)}>×</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="back-button" onClick={() => { setSelectedTemplate(null); setStep(1); }}>
                    {t('pipeline.cancel')}
                </button>
                <button
                    className="back-button save-btn"
                    onClick={createPipeline}
                    disabled={creating || stages.some(s => !s.agent_id)}
                >
                    {creating ? '...' : t('pipeline.confirm')}
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/PipelineSelector.jsx
git commit -m "feat(pipeline): add PipelineSelector component (template picker + stage editor)"
```

---

## Task 9: ProjectPipeline Component — Timeline Visualization

**Files:**
- Create: `apps/dashboard/src/components/ProjectPipeline.jsx`

- [ ] **Step 1: Create ProjectPipeline.jsx**

Vertical timeline showing all stages with status indicators:

```javascript
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

export default function ProjectPipeline({ pipeline, sessions, stages, agents, selectedStage, onSelectStage, onHandoff, onSkip }) {
    const { t } = useLanguage();

    if (!pipeline || !stages) return null;

    const sessionByOrder = {};
    (sessions || []).forEach(s => { sessionByOrder[s.stage_order] = s; });

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });

    // Group parallel stages (same depends_on set)
    const renderStage = (stage, i) => {
        const session = sessionByOrder[stage.stage_order];
        const status = session?.status || 'pending';
        const agent = agentMap[stage.agent_id];
        const isSelected = selectedStage === stage.stage_order;

        return (
            <div
                key={stage.stage_order}
                className="pipeline-stage"
                onClick={() => onSelectStage(stage.stage_order)}
            >
                <div className={`pipeline-stage-dot ${status}`} />
                <div className="pipeline-stage-line" />
                <div className={`pipeline-stage-content ${status} ${isSelected ? 'selected' : ''}`}>
                    <div className="pipeline-stage-header">
                        <div>
                            <span className="pipeline-stage-title">[{stage.stage_order}] {stage.name}</span>
                            <span className="pipeline-stage-agent"> — {agent?.name || stage.agent_id}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {stage.gate_type === 'human_approval' && (
                                <span className="gate-badge">🔒</span>
                            )}
                            <span className={`pipeline-status-badge ${status}`}>
                                {t(`pipeline.${status}`) || status}
                            </span>
                        </div>
                    </div>
                    {session?.summary && status === 'completed' && (
                        <div className="pipeline-stage-summary">
                            {(session.summary_edited || session.summary).substring(0, 150)}
                            {(session.summary_edited || session.summary).length > 150 ? '...' : ''}
                        </div>
                    )}
                    <div className="pipeline-stage-meta">
                        {session?.started_at && <span>Started {timeAgo(session.started_at)}</span>}
                        {session?.completed_at && <span>• Done {timeAgo(session.completed_at)}</span>}
                        {stage.department && <span>• {stage.department}</span>}
                    </div>
                    {status === 'active' && isSelected && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                                className="pipeline-chat-input handoff-btn"
                                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); onHandoff(session); }}
                            >
                                {t('pipeline.handoff')} →
                            </button>
                            <button
                                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); onSkip(stage.stage_order); }}
                            >
                                {t('pipeline.skip')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="pipeline-timeline">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`pipeline-status-badge ${pipeline.status}`}>
                        {t(`pipeline.${pipeline.status}`) || pipeline.status}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {sessions?.filter(s => s.status === 'completed').length || 0}/{stages.length} {t('pipeline.stages')}
                    </span>
                </div>
            </div>
            {stages.map((stage, i) => renderStage(stage, i))}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/ProjectPipeline.jsx
git commit -m "feat(pipeline): add ProjectPipeline vertical timeline component"
```

---

## Task 10: ProjectAgentChat Component

**Files:**
- Create: `apps/dashboard/src/components/ProjectAgentChat.jsx`

- [ ] **Step 1: Create ProjectAgentChat.jsx**

Chat interface using `useStreamingChat` hook, with context pills and handoff detection:

```javascript
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useStreamingChat } from '../hooks/useStreamingChat.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ProjectAgentChat({ projectId, session, completedSessions, agents, pipelineStatus, onHandoffRequest }) {
    const { t } = useLanguage();
    const [input, setInput] = useState('');
    const [handoffSuggestion, setHandoffSuggestion] = useState(null);
    const messagesEndRef = useRef(null);

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });
    const agent = agentMap[session?.agent_id];

    const { messages, streaming, sendMessage, ragSources } = useStreamingChat({
        endpoint: `/projects/${projectId}/sessions/${session?.id}/chat`,
        loadConversation: async () => {
            if (!session?.id) return [];
            const res = await fetch(`${API_URL}/projects/${projectId}/sessions/${session.id}/messages`, { credentials: 'include' });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.messages || []).map(m => ({ role: m.role, content: m.content }));
        },
        onStreamEvent: (event) => {
            if (event.handoff_suggestion) {
                setHandoffSuggestion(event.reason);
            }
        }
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || streaming) return;
        sendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isPaused = pipelineStatus === 'paused';
    const isActive = session?.status === 'active';

    if (!session) return null;

    return (
        <div className="pipeline-chat-container">
            <div className="pipeline-chat-header">
                <h3>{t('pipeline.chatWithAgent').replace('{name}', agent?.name || session.agent_id)}</h3>
                <span className={`pipeline-status-badge ${session.status}`}>
                    {session.stage_name}
                </span>
            </div>

            {/* Context pills — completed stages */}
            {completedSessions && completedSessions.length > 0 && (
                <div className="pipeline-context-pills">
                    {completedSessions.map(s => (
                        <span key={s.id} className="pipeline-context-pill completed" title={s.summary || ''}>
                            ✓ {s.stage_name}
                        </span>
                    ))}
                </div>
            )}

            {/* Previous stage summary pinned */}
            {completedSessions && completedSessions.length > 0 && (
                <div style={{ padding: '8px 16px', background: 'var(--bg-main)', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                    <strong>{t('pipeline.previousWork')}:</strong>{' '}
                    {completedSessions[completedSessions.length - 1].summary?.substring(0, 200) || '—'}
                </div>
            )}

            {/* Messages */}
            <div className="pipeline-chat-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-bubble-content">{msg.content}</div>
                    </div>
                ))}
                {ragSources.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '8px 0' }}>
                        {ragSources.map((src, i) => (
                            <span key={i} className="pipeline-context-pill" style={{ fontSize: '0.7rem' }}>
                                📚 {src.namespace || src.title || `Source ${i + 1}`}
                            </span>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Handoff suggestion */}
            {handoffSuggestion && isActive && (
                <div className="handoff-suggestion">
                    <p>✓ {t('pipeline.stageReady')}: {handoffSuggestion}</p>
                    <button onClick={() => onHandoffRequest(session)}>
                        {t('pipeline.handoff')} →
                    </button>
                </div>
            )}

            {/* Input */}
            {isPaused ? (
                <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {t('pipeline.pipelinePaused')}
                </div>
            ) : isActive ? (
                <div className="pipeline-chat-input">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${agent?.name || ''}...`}
                        disabled={streaming}
                    />
                    <button className="send-btn" onClick={handleSend} disabled={streaming || !input.trim()}>
                        {streaming ? '...' : 'Send'}
                    </button>
                    <button
                        className="handoff-btn"
                        onClick={() => onHandoffRequest(session)}
                        disabled={streaming}
                    >
                        {t('pipeline.handoff')} →
                    </button>
                </div>
            ) : (
                <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {t(`pipeline.${session.status}`)}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/ProjectAgentChat.jsx
git commit -m "feat(pipeline): add ProjectAgentChat with SSE streaming and handoff detection"
```

---

## Task 11: HandoffModal Component

**Files:**
- Create: `apps/dashboard/src/components/HandoffModal.jsx`

- [ ] **Step 1: Create HandoffModal.jsx**

```javascript
import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function HandoffModal({ projectId, session, stages, agents, onClose, onComplete }) {
    const { t } = useLanguage();
    const [summary, setSummary] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState('confirm'); // confirm | generating | review | done
    const [error, setError] = useState(null);

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });

    const currentStage = stages?.find(s => s.stage_order === session?.stage_order);
    const nextStages = stages?.filter(s =>
        (s.depends_on || []).includes(session?.stage_order) &&
        !stages.some(other =>
            (s.depends_on || []).includes(other.stage_order) &&
            other.stage_order !== session?.stage_order &&
            !(agents || []).find(a => a.id === other.agent_id)
        )
    ) || [];

    const requiresGateApproval = currentStage?.gate_type === 'human_approval';

    const executeHandoff = async () => {
        setLoading(true);
        setError(null);
        setPhase('generating');

        try {
            const body = { session_id: session.id };
            if (summary) body.summary_override = summary;
            if (notes) body.notes = notes;
            if (requiresGateApproval) body.gate_approved = true;

            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline/handoff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Handoff failed');
            }

            const result = await res.json();

            if (!summary && result.handoff?.summary) {
                setSummary(result.handoff.summary);
            }

            setPhase('done');
            setTimeout(() => {
                if (onComplete) onComplete(result);
            }, 1500);
        } catch (err) {
            setError(err.message);
            setPhase('confirm');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="handoff-modal-overlay" onClick={onClose}>
            <div className="handoff-modal" onClick={e => e.stopPropagation()}>
                {phase === 'done' ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                        <h2>{t('pipeline.handoffSuccess')}</h2>
                    </div>
                ) : (
                    <>
                        <h2>{t('pipeline.confirmHandoff')}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px' }}>
                            {currentStage?.name} → {nextStages.map(s => s.name).join(', ') || 'Pipeline completion'}
                        </p>

                        {requiresGateApproval && (
                            <div style={{ padding: '10px 14px', background: '#F59E0B15', border: '1px solid #F59E0B40', borderRadius: '10px', marginBottom: '12px', fontSize: '0.85rem' }}>
                                🔒 {t('pipeline.gateApproval')}
                            </div>
                        )}

                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                            {t('pipeline.handoffSummary')}
                        </label>
                        <textarea
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            placeholder={t('pipeline.generatingSummary')}
                        />

                        <label style={{ display: 'block', margin: '12px 0 6px', fontWeight: 600, fontSize: '0.85rem' }}>
                            {t('pipeline.handoffNotes')}
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            style={{ minHeight: '60px' }}
                        />

                        {nextStages.length > 0 && (
                            <div className="next-agent-info">
                                <span>{t('pipeline.handoffTo')}:</span>
                                {nextStages.map(s => (
                                    <span key={s.stage_order} className={`pipeline-status-badge pending`}>
                                        {agentMap[s.agent_id]?.name || s.agent_id} — {s.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div style={{ color: '#ef4444', fontSize: '0.85rem', margin: '8px 0' }}>
                                {error}
                            </div>
                        )}

                        <div className="handoff-modal-actions">
                            <button className="cancel-btn" onClick={onClose} disabled={loading}>
                                {t('pipeline.cancel')}
                            </button>
                            <button className="confirm-btn" onClick={executeHandoff} disabled={loading}>
                                {loading ? t('pipeline.generatingSummary') : t('pipeline.confirmHandoff')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/HandoffModal.jsx
git commit -m "feat(pipeline): add HandoffModal component (summary edit + gate approval)"
```

---

## Task 12: ProjectPipelineView — Container Component

**Files:**
- Create: `apps/dashboard/src/components/ProjectPipelineView.jsx`

- [ ] **Step 1: Create ProjectPipelineView.jsx**

State owner that orchestrates pipeline view, timeline, chat, and handoff modal:

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ProjectPipeline from './ProjectPipeline.jsx';
import ProjectAgentChat from './ProjectAgentChat.jsx';
import HandoffModal from './HandoffModal.jsx';
import PipelineSelector from './PipelineSelector.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ProjectPipelineView({ projectId }) {
    const { t } = useLanguage();
    const [pipeline, setPipeline] = useState(null);
    const [stages, setStages] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [agents, setAgents] = useState([]);
    const [selectedStage, setSelectedStage] = useState(null);
    const [handoffSession, setHandoffSession] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchPipeline = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline`, { credentials: 'include' });
            if (res.status === 404) {
                setPipeline(null);
                setLoading(false);
                return;
            }
            if (!res.ok) throw new Error('Failed to load pipeline');
            const data = await res.json();
            setPipeline(data);
            setStages(data.stages || []);
            setSessions(data.sessions || []);

            // Auto-select first active stage
            const activeSession = (data.sessions || []).find(s => s.status === 'active');
            if (activeSession && selectedStage === null) {
                setSelectedStage(activeSession.stage_order);
            }
        } catch (err) {
            console.error('Pipeline fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [projectId, selectedStage]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/agents`, { credentials: 'include' });
            if (res.ok) setAgents(await res.json());
        } catch {}
    }, []);

    useEffect(() => { fetchPipeline(); fetchAgents(); }, [fetchPipeline, fetchAgents]);

    const handlePause = async () => {
        await fetch(`${API_URL}/projects/${projectId}/pipeline/pause`, {
            method: 'POST', credentials: 'include'
        });
        fetchPipeline();
    };

    const handleResume = async () => {
        await fetch(`${API_URL}/projects/${projectId}/pipeline/resume`, {
            method: 'POST', credentials: 'include'
        });
        fetchPipeline();
    };

    const handleSkip = async (stageOrder) => {
        if (!confirm(t('pipeline.skipConfirm'))) return;
        await fetch(`${API_URL}/projects/${projectId}/pipeline/stages/${stageOrder}/skip`, {
            method: 'POST', credentials: 'include'
        });
        fetchPipeline();
    };

    const handleHandoffComplete = (result) => {
        setHandoffSession(null);
        fetchPipeline();
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>{t('pipeline.title')}...</div>;

    // No pipeline → show selector
    if (!pipeline) {
        return <PipelineSelector projectId={projectId} onCreated={() => fetchPipeline()} />;
    }

    const selectedSession = sessions.find(s => s.stage_order === selectedStage);
    const completedSessions = sessions.filter(s => s.status === 'completed').sort((a, b) => a.stage_order - b.stage_order);

    return (
        <div className="pipeline-container">
            {/* Controls */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {pipeline.status === 'active' && (
                    <button className="back-button" onClick={handlePause}>⏸ {t('pipeline.pause')}</button>
                )}
                {pipeline.status === 'paused' && (
                    <button className="back-button save-btn" onClick={handleResume}>▶ {t('pipeline.resume')}</button>
                )}
            </div>

            {/* Timeline */}
            <ProjectPipeline
                pipeline={pipeline}
                sessions={sessions}
                stages={stages}
                agents={agents}
                selectedStage={selectedStage}
                onSelectStage={setSelectedStage}
                onHandoff={(session) => setHandoffSession(session)}
                onSkip={handleSkip}
            />

            {/* Chat for selected active stage */}
            {selectedSession && selectedSession.status === 'active' && (
                <ProjectAgentChat
                    projectId={projectId}
                    session={selectedSession}
                    completedSessions={completedSessions}
                    agents={agents}
                    pipelineStatus={pipeline.status}
                    onHandoffRequest={(session) => setHandoffSession(session)}
                />
            )}

            {/* Handoff modal */}
            {handoffSession && (
                <HandoffModal
                    projectId={projectId}
                    session={handoffSession}
                    stages={stages}
                    agents={agents}
                    onClose={() => setHandoffSession(null)}
                    onComplete={handleHandoffComplete}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/ProjectPipelineView.jsx
git commit -m "feat(pipeline): add ProjectPipelineView container component"
```

---

## Task 13: Integration — App.jsx Tab Toggle

**Files:**
- Modify: `apps/dashboard/src/App.jsx`

- [ ] **Step 1: Add import for ProjectPipelineView**

At the top of `App.jsx`, after existing imports:

```javascript
import ProjectPipelineView from './components/ProjectPipelineView.jsx';
```

- [ ] **Step 2: Add tab state for project detail**

Inside the `App` component, near the existing state declarations (around line 86), add:

```javascript
const [projectTab, setProjectTab] = useState('details'); // 'details' | 'pipeline'
```

Reset it when project changes — in the `setSelectedProject` calls or add:

```javascript
// Reset tab when selecting a different project
useEffect(() => { setProjectTab('details'); }, [selectedProject?.id]);
```

- [ ] **Step 3: Add tab toggle in project detail view**

In the project detail view (around line 211, after the `<header>` section, before the first `<section>`), add a tab toggle. Find the closing `</header>` tag (around line 276) and add right after it:

```javascript
{/* Pipeline tab toggle */}
<div className="weekly-view-toggle" style={{ marginBottom: '20px' }}>
    <button
        className={`weekly-toggle-btn ${projectTab === 'details' ? 'active' : ''}`}
        onClick={() => setProjectTab('details')}
    >
        {t('pipeline.details')}
    </button>
    <button
        className={`weekly-toggle-btn ${projectTab === 'pipeline' ? 'active' : ''}`}
        onClick={() => setProjectTab('pipeline')}
    >
        {t('pipeline.title')}
    </button>
</div>
```

- [ ] **Step 4: Wrap existing detail content in tab condition**

Wrap all the existing project detail sections (everything after the tab toggle, the `<section>` cards, phases, blocks, etc.) inside:

```javascript
{projectTab === 'details' && (
    <>
        {/* ... existing project detail content ... */}
    </>
)}

{projectTab === 'pipeline' && (
    <ProjectPipelineView projectId={selectedProject.id} />
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.jsx
git commit -m "feat(pipeline): add Details/Pipeline tab toggle in project detail view"
```

---

## Task 14: Integration — GenericAgentView Workflows Tab

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` (around lines 107-111)

- [ ] **Step 1: Replace empty workflows tab**

Find the empty state block (lines 107-111):
```javascript
{activeTab === 'workflows' && (
    <div className="agent-workflows-list">
        <div className="empty-state">{t('agentDetail.noWorkflows')}</div>
    </div>
)}
```

Replace with:

```javascript
{activeTab === 'workflows' && (
    <AgentPipelineTickets agentId={agent.id} />
)}
```

- [ ] **Step 2: Add AgentPipelineTickets as a sub-component**

Add this component inside `GenericAgentView.jsx` (or at the top of the file, before the main component):

```javascript
function AgentPipelineTickets({ agentId }) {
    const { t } = useLanguage();
    const [tickets, setTickets] = useState([]);
    const API_URL = import.meta.env.VITE_API_URL || '/api';

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
                <div key={ticket.id} className="agent-pipeline-ticket">
                    <div className="ticket-info">
                        <h4>{ticket.project_name}</h4>
                        <span>{ticket.stage_name}</span>
                    </div>
                    <span className={`pipeline-status-badge ${ticket.status}`}>
                        {t(`pipeline.${ticket.status}`) || ticket.status}
                    </span>
                </div>
            ))}
        </div>
    );
}
```

Add necessary imports at the top if not already present (`useState`, `useEffect`).

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/agent-views/GenericAgentView.jsx
git commit -m "feat(pipeline): populate agent workflows tab with pipeline tickets"
```

---

## Task 15: Integration — WorkflowsHub Active Pipelines Toggle

**Files:**
- Modify: `apps/dashboard/src/pages/WorkflowsHub.jsx`

- [ ] **Step 1: Add 'pipelines' to view toggle**

Find the existing view toggle (line ~474 with `weekly-view-toggle`). The current toggle has "Catalog" and "History". Add a third button:

```javascript
<button
    className={`weekly-toggle-btn ${view === 'pipelines' ? 'active' : ''}`}
    onClick={() => setView('pipelines')}
>
    {t('pipeline.activePipelines')}
</button>
```

Make sure the `view` state (or whatever the current view variable is) accepts `'pipelines'` as a value.

- [ ] **Step 2: Add pipelines view**

After the existing catalog and history views, add:

```javascript
{view === 'pipelines' && <ActivePipelinesList />}
```

Add the `ActivePipelinesList` sub-component in the same file:

```javascript
function ActivePipelinesList() {
    const { t } = useLanguage();
    const [pipelines, setPipelines] = useState([]);
    const API_URL = import.meta.env.VITE_API_URL || '/api';

    useEffect(() => {
        fetch(`${API_URL}/pipelines/active`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setPipelines(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    if (pipelines.length === 0) {
        return <div className="empty-state">{t('pipeline.noPipeline')}</div>;
    }

    return (
        <div className="active-pipelines-list">
            {pipelines.map(p => (
                <div key={p.id} className="active-pipeline-card">
                    <div className="pipeline-info">
                        <h4>{p.project_name}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {p.project_department} • {p.active_stages?.map(s => s.stage_name).join(', ') || 'No active stages'}
                        </span>
                    </div>
                    <div className="pipeline-progress">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(p.completed_stages / p.total_stages) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {p.completed_stages}/{p.total_stages}
                        </span>
                        <span className={`pipeline-status-badge ${p.status}`}>
                            {t(`pipeline.${p.status}`) || p.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/WorkflowsHub.jsx
git commit -m "feat(pipeline): add Active Pipelines view to WorkflowsHub"
```

---

## Task 16: Full Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
cd c:\Users\gmunoz02\Desktop\agentOS
npm run db:up
npm start
```

- [ ] **Step 2: Verify DB tables**

Open Adminer at `http://localhost:8080`. Confirm all 4 tables + ALTER exist.

- [ ] **Step 3: Verify pipeline CRUD**

Open the app at `http://localhost:4000`. Navigate to a project → click "Pipeline" tab → select a template → assign agents → confirm. Check DB: `project_pipeline`, `pipeline_stages`, `project_agent_sessions` should have rows.

- [ ] **Step 4: Verify chat in pipeline**

Click on an active stage → chat should load. Send a message → SSE streaming should work, assistant responds. Check `pipeline_session_messages` in DB.

- [ ] **Step 5: Verify handoff flow**

After several messages, click "Handoff" → modal opens → confirm → AI generates summary → session completes, next stages activate. Check in DB that session status changed to `completed` and next sessions changed to `active`.

- [ ] **Step 6: Verify parallel stages**

Create a campaign pipeline → complete stage 0 → stages 1 and 2 should both become `active`.

- [ ] **Step 7: Verify agent workflows tab**

Navigate to any agent detail → "workflows" tab → should show pipeline tickets if assigned.

- [ ] **Step 8: Verify WorkflowsHub pipelines toggle**

Navigate to Workflows page → click "Active Pipelines" → should show all active pipelines with progress bars.

- [ ] **Step 9: Verify i18n**

Switch language to Spanish → all pipeline UI text should be in Spanish. Switch to English → all English.

- [ ] **Step 10: Final commit**

```bash
git add -A
git status
# Review changes, then commit any remaining files
git commit -m "feat(pipeline): complete ticket pipeline between agents — v1"
```

---

## Execution Notes

- **server.js line numbers will shift** as you add code — always search for section markers to find the right insertion point.
- **`isKBReady` and `buildRAGContext`** must be available in server.js scope. They already are (used in existing agent chat). If not, check the existing import/function definition.
- **`logAudit`** is an existing helper in server.js. `logAuditTx` is the new transactional version (uses `client.query` instead of `pool.query`).
- **The `anthropic` instance** is already initialized at line 54 of server.js and used in core.js via the Anthropic SDK import there.
- **CSS variables** used (`--primary`, `--bg-card`, `--border-light`, `--text-secondary`, `--primary-soft`, `--primary-trans`, etc.) already exist in `:root` in index.css.
