# Proyecto 004: Pipeline de Tickets entre Agentes

**Status:** Pendiente
**Fecha:** 2026-04-01
**Prioridad:** Core feature — flujo central de AgentOS
**Revision:** v2 — Workshop con 5 especialistas (PM/SFMC, UX/UI, Backend, Frontend, AI)

---

## Problema

El PM Agent crea proyectos desde el inbox, pero no hay mecanismo para que el trabajo fluya entre agentes con contexto acumulado. Los agentes trabajan aislados sin visibilidad de lo que otros hicieron. No existe orquestacion de tickets a traves del pipeline de departamentos.

## Solucion

Sistema de pipeline sobre la jerarquia existente de proyectos. 4 tablas nuevas que permiten asignar un flujo de stages (agentes) a cada proyecto, con chat contextualizado, handoff con resumen AI estructurado entre stages, stages paralelos (DAG), y gates de aprobacion humana.

## Decisiones de diseno

| Decision | Eleccion | Alternativas descartadas | Razon |
|----------|----------|-------------------------|-------|
| Entidad base | Proyecto existente (projects -> phases -> tasks) | Nueva entidad 'work ticket' | Reutiliza modelo existente |
| Stages storage | Tabla normalizada `pipeline_stages` | JSONB array | FK integrity, queries directas, no race conditions |
| Conversation storage | Tabla `pipeline_session_messages` | JSONB array en session | Paginacion, O(1) writes, patron `brainstorm_messages` |
| Pipeline model | DAG con `depends_on` | Lineal con `current_stage` | Soporta stages paralelos (Content+Segmentation simultaneos) |
| Handoff summary | Claude `tool_use` con schema forzado | `extractJSON()` regex | Output JSON garantizado, elimina fallos de parsing |
| Handoff atomicity | 2 fases (AI fuera TX, DB dentro con FOR UPDATE) | Todo en 1 transaccion | Claude puede fallar sin corromper estado DB |
| Pipeline visualizacion | Timeline vertical | Stepper horizontal | Escala a 10+ stages, funciona en movil, reusa `.workflow-steps` |
| Pipeline creation | Templates-first + reassign dropdown | Drag-and-drop | Simpler v1, DnD innecesario |
| Chat reuse | Hook `useStreamingChat` | Copy-paste de AgentChat | Evita tercera copia del patron SSE |
| Context management | Personality sandwich + tiered summaries + 24-msg window | Contexto sin limites | Previene degradacion en stages avanzados |
| Templates source | Derivar de `workflows.js` existente | Templates nuevos independientes | Consistencia con workflows ya definidos |
| Routing | Pipeline sugerido con override manual | Predefinido sin flexibilidad | Equilibrio entre AI y control humano |
| Workspace del agente | Dual: desde proyecto Y desde agente | Solo proyecto | Tab "workflows" vacia en GenericAgentView lista para llenar |

---

## Arquitectura

### Tablas nuevas (4 + 1 ALTER)

**`project_pipeline`** — Estado del flujo de un proyecto
```sql
CREATE TABLE IF NOT EXISTS project_pipeline (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    template_id TEXT,                    -- ref a PIPELINE_TEMPLATES key
    current_stage_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_pipeline_status ON project_pipeline(status);
```

**`pipeline_stages`** — Stages normalizados (NO JSONB)
```sql
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id SERIAL PRIMARY KEY,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    stage_order INT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    department TEXT,
    description TEXT,
    depends_on INT[] DEFAULT '{}',       -- stage_orders que deben completar antes
    gate_type TEXT DEFAULT 'none' 
        CHECK (gate_type IN ('none', 'human_approval')),
    namespaces TEXT[] DEFAULT '{}',      -- RAG namespaces para este stage
    UNIQUE(pipeline_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_agent ON pipeline_stages(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
```

**`project_agent_sessions`** — Chat + trabajo de cada agente en un proyecto
```sql
CREATE TABLE IF NOT EXISTS project_agent_sessions (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_order INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'awaiting_handoff', 'completed', 'skipped')),
    summary TEXT,                        -- AI-generated handoff summary
    summary_edited TEXT,                 -- user-edited version (if modified)
    deliverables JSONB DEFAULT '{}',     -- structured output from handoff
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, agent_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pas_project ON project_agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_pas_agent ON project_agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_pas_status ON project_agent_sessions(status);
```

**`pipeline_session_messages`** — Mensajes normalizados (NO JSONB array)
```sql
CREATE TABLE IF NOT EXISTS pipeline_session_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES project_agent_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',         -- RAG sources, handoff markers, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psm_session ON pipeline_session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_psm_session_created ON pipeline_session_messages(session_id, created_at);
```

**ALTER para collaboration_raises:**
```sql
ALTER TABLE collaboration_raises ADD COLUMN IF NOT EXISTS pipeline_session_id INT 
    REFERENCES project_agent_sessions(id) ON DELETE SET NULL;
```

### Decisiones de schema clave

**Por que `pipeline_stages` normalizada (no JSONB):**
- FK a `agents(id)` con `ON DELETE RESTRICT` — no puedes borrar un agente en pipeline activo
- `SELECT * FROM pipeline_stages WHERE agent_id = $1` — find all stages for an agent sin JSONB operators
- Update un stage individual sin read-modify-write race condition
- `depends_on INT[]` para DAG — no se puede expresar limpiamente en JSONB nested

**Por que `pipeline_session_messages` normalizada:**
- La app ya tiene 4 formas de guardar conversaciones (agent_conversations, inbox_items, campaign_conversations como JSONB arrays, y brainstorm_messages como tabla normalizada). `brainstorm_messages` es el patron mas nuevo y correcto
- JSONB arrays crecen sin limite, requieren O(n) read-modify-write en cada mensaje
- Tabla normalizada: INSERT O(1), paginacion con LIMIT/OFFSET, sin race conditions

**Por que `depends_on INT[]` para stages paralelos:**
- Realidad SFMC: Content + Segmentation pueden correr en paralelo (ambos dependen de Strategy+Technical)
- Brand Review + Legal Review son independientes (ambas dependen de Content+Segmentation)
- `current_stage_order` en `project_pipeline` se convierte en referencia informativa, el verdadero estado es por-session

**Por que `awaiting_handoff` status:**
- Despues de que el usuario pide handoff pero antes de completar: Claude genera summary (puede fallar), DB se actualiza (atomico). Sin este estado intermedio, un fallo en Claude deja la session en estado ambiguo

---

### Pipeline Templates (datos estaticos en codigo)

```javascript
// apps/dashboard/src/data/pipelineTemplates.js
// DERIVADOS de workflows.js para consistencia con workflow definitions existentes

const PIPELINE_TEMPLATES = {
  campaign: {
    name: 'Campaign Creation',
    source_workflow: 'campaign-creation', // ref a workflows.js
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
        depends_on: [], namespaces: ['campaigns', 'kpis'] },
      { name: 'Fast Content', agent_id: 'content-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails', 'brand'] },
      { name: 'Fast Brand', agent_id: 'brand-guardian', department: 'control',
        depends_on: [1], namespaces: ['brand', 'campaigns'] },
      { name: 'Expedited Legal', agent_id: 'legal-agent', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'brand'] },
      { name: 'Rapid QA', agent_id: 'qa-agent', department: 'control',
        depends_on: [2, 3], gate_type: 'human_approval',
        namespaces: ['campaigns', 'emails', 'brand'] },
    ]
  },

  seasonal: {
    name: 'Seasonal Campaign Planning',
    source_workflow: 'seasonal-campaign-planning',
    stages: [
      { name: 'Strategy', agent_id: 'campaign-manager', department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'] },
      { name: 'Calendar Planning', agent_id: 'calendar-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'] },
      { name: 'Pre-build Audiences', agent_id: 'segmentation-agent', department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'kpis'] },
      { name: 'Brief Preparation', agent_id: 'content-agent', department: 'execution',
        depends_on: [1, 2], namespaces: ['campaigns', 'emails', 'brand'] },
      { name: 'Capacity Reservation', agent_id: 'cloud-architect', department: 'strategic',
        depends_on: [1], namespaces: ['campaigns'] },
    ]
  },

  general: {
    name: 'General Project',
    stages: [
      { name: 'Planning', agent_id: null, department: 'strategic',
        depends_on: [], namespaces: ['campaigns', 'kpis', 'research'] },
      { name: 'Execution', agent_id: null, department: 'execution',
        depends_on: [0], namespaces: ['campaigns', 'emails'] },
      { name: 'Review', agent_id: 'qa-agent', department: 'control',
        depends_on: [1], namespaces: ['campaigns', 'kpis', 'brand'] },
    ]
  }
};
```

**Relacion con workflows.js:** Los templates derivan de los workflows existentes (`campaign-creation`, `flash-sale-rapid-deploy`, `seasonal-campaign-planning`). El campo `source_workflow` vincula cada template a su workflow. Esto evita tener dos fuentes de verdad contradictorias.

**Stages paralelos visualizados:**
```
Campaign Creation Pipeline (DAG):

[0] Strategy & Brief (Raul)          GATE: human_approval
     |
     +--------+--------+
     |                  |
[1] Technical      [2] Calendar
    (Guillermo)        (Martina)
     |                  |
     +--------+--------+
     |                  |
[3] Segmentation   [4] Content        <- PARALELOS (dependen de 1+2)
    (Diego)            (Lucia)
     |                  |
     +--------+--------+
     |                  |
[5] Brand Review   [6] Legal Review   <- PARALELOS (dependen de 3+4)
    (Sofia)            (Javier)        GATE: human_approval
     |                  |
     +--------+--------+
              |
[7] Automation & Build (Andres)
     |
     +--------+--------+
     |                  |
[8] QA & Testing   [9] Analytics      <- PARALELOS (dependen de 7)
    (Elena)            (Carlos)
```

El usuario puede modificar stages (reordenar, anadir, quitar, cambiar agente) antes de confirmar.

---

## Flujo End-to-End

```
1. INBOX: Usuario crea idea "Black Friday campaign"
       |
2. PM AGENT CHAT: Refina concepto, goals, audience, timing, BAU type
       |
3. TO PROYECTO: PM genera proyecto con detalles completos
       |
4. PIPELINE ASSIGNMENT: Sistema sugiere template basado en BAU type
   -> Template cards: Campaign Creation, Flash Sale, Seasonal, Custom
   -> Usuario selecciona template
   -> Review: stages pre-asignados, dropdown para cambiar agente
   -> Confirmar -> Se crean project_pipeline + pipeline_stages + project_agent_sessions
   -> Stages sin dependencias se activan (stage 0 siempre)
       |
5. STAGE 0 - Strategy (Raul):
   - Usuario abre proyecto -> tab Pipeline -> timeline vertical
   - O abre chat de Raul -> ve pipeline ticket asignado en tab "workflows"
   - Chat con contexto de proyecto + RAG (namespaces: campaigns, kpis, research)
   - System prompt: identity + project details + RAG + identity reminder
   - Raul sugiere: "[STAGE_READY: Brief complete with KPIs and market matrix]"
   - Frontend detecta marker -> muestra sugerencia de handoff inline
   - GATE: human_approval -> usuario debe confirmar explicitamente
   - Click "Handoff" -> Fase A: Claude genera summary (tool_use)
   - HandoffModal: summary editable + next agent dropdown + notas
   - Confirmar -> Fase B: transaction DB (session completed, stages 1+2 activados)
       |
6. STAGES 1+2 - Technical (Guillermo) + Calendar (Martina) — PARALELOS:
   - Ambos se activan porque depends_on: [0] esta completed
   - Cada uno tiene su session, su chat, su RAG con namespaces distintos
   - System prompt incluye: full summary de Raul (distance=1)
   - Handoff independiente: cada uno completa cuando listo
   - Stages 3+4 se activan cuando AMBOS 1 Y 2 estan completed
       |
7. STAGES 3+4 - Segmentation (Diego) + Content (Lucia) — PARALELOS:
   - System prompt incluye: full summary de stage inmediato anterior + compressed de Raul
   - Cada uno recibe RAG con sus namespaces de stage
   - Handoff independiente
       |
8. STAGES 5+6 - Brand (Sofia) + Legal (Javier) — PARALELOS:
   - GATE en Legal: human_approval requerido
   - Si Legal rechaza: puede "reopen" stage -> vuelve a Content para fix
   - Si Brand rechaza: igual
       |
9. STAGE 7 - Automation (Andres):
   - Recibe contexto acumulado: compressed summaries de 0-4, full de 5+6
   - Produce: Journey Builder config, triggers, deployment runbook
       |
10. STAGES 8+9 - QA (Elena) + Analytics (Carlos) — PARALELOS:
    - Elena: si encuentra issues -> raise tipo 'blocker' -> pipeline pausa
    - Carlos: tracking setup, KPI baseline
    - Ultimo stage completa -> pipeline status = 'completed'
```

---

## API Endpoints

```
# Pipeline CRUD
POST   /api/projects/:id/pipeline              -- Crear pipeline (body: { template_id, stages? })
GET    /api/projects/:id/pipeline              -- Pipeline + stages + sessions (JOIN query)
DELETE /api/projects/:id/pipeline              -- Cancelar pipeline

# Pipeline actions
POST   /api/projects/:id/pipeline/handoff      -- Ejecutar handoff (2 fases: AI + DB transaction)
POST   /api/projects/:id/pipeline/pause        -- Pausar pipeline
POST   /api/projects/:id/pipeline/resume       -- Reanudar pipeline
POST   /api/projects/:id/pipeline/stages/:order/skip  -- Saltar stage

# Sessions
GET    /api/projects/:id/sessions/:sessionId/messages  -- Mensajes paginados (?limit=50&offset=0)
POST   /api/projects/:id/sessions/:sessionId/chat      -- Chat SSE (por sessionId, no agentId)
PATCH  /api/projects/:id/sessions/:sessionId/summary   -- Editar resumen AI

# Cross-project
GET    /api/pipelines/active                   -- Todos los pipelines activos (overview)
GET    /api/agents/:agentId/active-sessions    -- Sessions activas de un agente
```

**Notas de API:**
- Chat por `sessionId` (no `agentId`) para evitar ambiguedad si un agente esta en multiples stages
- `requireAuth` middleware en todos los endpoints pipeline
- Handoff retorna pipeline state actualizado en response body (optimistic update en frontend)
- GET pipeline usa un solo JOIN query (no N+1):
```sql
SELECT pp.*, 
    json_agg(DISTINCT jsonb_build_object(
        'stage_order', ps.stage_order, 'name', ps.name,
        'agent_id', ps.agent_id, 'department', ps.department,
        'depends_on', ps.depends_on, 'gate_type', ps.gate_type
    ) ORDER BY ps.stage_order) as stages,
    json_agg(DISTINCT jsonb_build_object(
        'id', pas.id, 'agent_id', pas.agent_id,
        'stage_order', pas.stage_order, 'status', pas.status,
        'summary', pas.summary, 'started_at', pas.started_at,
        'completed_at', pas.completed_at
    )) as sessions
FROM project_pipeline pp
LEFT JOIN pipeline_stages ps ON ps.pipeline_id = pp.id
LEFT JOIN project_agent_sessions pas ON pas.pipeline_id = pp.id
WHERE pp.project_id = $1
GROUP BY pp.id;
```

---

## Handoff: Arquitectura de 2 Fases

### Fase A — Generacion de summary (FUERA de transaccion)

Usa Claude `tool_use` con `tool_choice` forzado para output JSON garantizado:

```javascript
// packages/core/pm-agent/core.js — nueva funcion
async function generateHandoffSummary(conversation, projectContext, stageInfo, nextAgentInfo) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: buildHandoffPrompt(projectContext, stageInfo, nextAgentInfo),
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
    const handoffData = response.content.find(b => b.type === 'tool_use').input;
    
    // Validar calidad minima
    if (!handoffData.summary || handoffData.summary.length < 20) throw new Error('Summary too short');
    if (!handoffData.decisions_made?.length) throw new Error('No decisions captured');
    
    return handoffData;
}
```

**Handoff prompt clave:**
```
You are a project handoff specialist. Extract a precise, complete summary.
Any information lost here cannot be recovered by the next agent.

CRITICAL RULES:
- ONLY list as "deliverables" items explicitly created/finalized in the conversation
- If something was discussed but not concluded, it goes in "open_questions"
- Do not infer decisions not explicitly agreed upon by the user
- context_for_next must be specifically addressed to {next_agent.name} and their role as {next_agent.role}
```

Si Claude falla → retornar error 502 al frontend. Pipeline NO avanza. Usuario puede reintentar.

### Fase B — Actualizacion atomica DB (DENTRO de transaccion)

```javascript
const client = await pool.connect();
try {
    await client.query('BEGIN');
    
    // Lock pipeline row — serializa handoffs concurrentes
    const pipeline = (await client.query(
        'SELECT * FROM project_pipeline WHERE project_id = $1 FOR UPDATE', [projectId]
    )).rows[0];
    
    if (pipeline.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Pipeline is ${pipeline.status}` });
    }
    
    // Check for open blockers
    const blockers = await client.query(
        `SELECT count(*) FROM collaboration_raises 
         WHERE pipeline_session_id = $1 AND status = 'open' AND raise_type = 'blocker'`,
        [currentSessionId]
    );
    if (parseInt(blockers.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Cannot handoff with open blockers' });
    }
    
    // 1. Complete current session
    await client.query(
        `UPDATE project_agent_sessions 
         SET status = 'completed', summary = $1, deliverables = $2, completed_at = NOW()
         WHERE id = $3 AND status IN ('active', 'awaiting_handoff')`,
        [handoffData.summary, JSON.stringify(handoffData), currentSessionId]
    );
    
    // 2. Find and activate next stages (all whose depends_on are now complete)
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
    
    // 3. Check if pipeline is complete (no pending/active sessions remain)
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
    
    // 4. Audit log (dentro de transaccion, usando client)
    await client.query(
        `INSERT INTO audit_log (event_type, department, agent_id, title, details)
         VALUES ('pipeline_handoff', $1, $2, $3, $4)`,
        [currentStage.department, currentSession.agent_id,
         `Pipeline handoff: ${currentStage.name} completed`,
         handoffData.summary.substring(0, 500)]
    );
    
    // 5. Create collaboration raise for handoff trail
    for (const stage of nextStages.rows) {
        await client.query(
            `INSERT INTO collaboration_raises 
             (from_agent, to_agent, raise_type, title, details, status, pipeline_session_id)
             VALUES ($1, $2, 'handoff', $3, $4, 'resolved', $5)`,
            [currentSession.agent_id, stage.agent_id,
             `Handoff: ${currentStage.name} -> ${stage.name}`,
             handoffData.context_for_next,
             currentSessionId]
        );
    }
    
    await client.query('COMMIT');
} catch (err) {
    await client.query('ROLLBACK');
    throw err;
} finally {
    client.release();
}
```

---

## AI: System Prompt del Agente en Pipeline

### Estructura "Personality Sandwich"

```
[BLOQUE 1 — Agent Identity, ~200 tokens]
You are {agent.name}, an AI agent working in the {agent.department} department.
Your role: {agent.role}
Your skills: {agent.skills.join(', ')}
Your tools: {agent.tools.join(', ')}

## Behavior Rules
1. Stay in character as {agent.name}
2. Be helpful, direct, knowledgeable about your domain
3. Every message must add value
4. Max 1-2 questions per message

[BLOQUE 2 — Pipeline Context, ~700-1500 tokens variable]
## Pipeline Context — Project "{project.name}"

### Previous Work
#### Stage: Strategy — by Raul [FULL if distance=1]
{summary completo}
Key decisions: {decisions_made.join('; ')}
Deliverables: {deliverables.join('; ')}
Open questions: {open_questions.join('; ')}

#### Stage: Technical — by Guillermo [COMPRESSED if distance>1]
Decisions: {decisions_made.join('; ')}
For downstream: {context_for_next}

[BLOQUE 3 — Project Details, ~500 tokens]
## Your Task
You are responsible for the "{stage.name}" stage.
{stage.description}

## Project Details
Name: {project.name}
Problem: {project.problem}
Solution: {project.solution}
Requirements: {project.requirements}

[BLOQUE 4 — RAG Context, ~3000 tokens]
## Relevant Knowledge
{buildRAGContext() con namespaces del stage: stage.namespaces}

[BLOQUE 5 — Identity Reminder + Completion Detection, ~100 tokens]
## REMEMBER
You are {agent.name}. Stay in character. Respond from YOUR expertise.
Do not repeat previous agents' work. Focus on YOUR stage: {stage.name}.

## Stage Completion
When your stage work is substantially complete, end your message with:
[STAGE_READY: brief reason why this stage appears complete]
Only include this when genuinely done. Never in your first 3 messages.
```

### Tiered Summary Injection

```javascript
function buildAccumulatedContext(completedSessions, currentStageOrder) {
    let context = '## Previous Work\n\n';
    for (const session of completedSessions) {
        const distance = currentStageOrder - session.stage_order;
        if (distance <= 1) {
            // Full summary (~400 tokens)
            context += `### Stage: ${session.stage_name} — by ${session.agent_name}\n`;
            context += `${session.summary}\n`;
            context += `Key decisions: ${JSON.parse(session.deliverables).decisions_made?.join('; ')}\n`;
            context += `Deliverables: ${JSON.parse(session.deliverables).deliverables?.join('; ')}\n`;
            context += `Open questions: ${JSON.parse(session.deliverables).open_questions?.join('; ')}\n\n`;
        } else {
            // Compressed (~100 tokens)
            context += `### Stage: ${session.stage_name} — by ${session.agent_name} (summary)\n`;
            context += `Decisions: ${JSON.parse(session.deliverables).decisions_made?.join('; ')}\n`;
            context += `For downstream: ${JSON.parse(session.deliverables).context_for_next}\n\n`;
        }
    }
    return context;
}
```

### Conversation Sliding Window

```javascript
function buildPipelineConversation(allMessages) {
    if (allMessages.length <= 26) return allMessages;
    const first = allMessages.slice(0, 2);   // Opening context
    const recent = allMessages.slice(-24);    // Last 12 pairs
    const bridge = {
        role: 'system',
        content: `[${allMessages.length - 26} earlier messages omitted. Key context in stage summary above.]`
    };
    return [...first, bridge, ...recent];
}
```

### RAG por Stage

```javascript
// Namespaces definidos en el stage del template, no hardcodeados por departamento
const namespaces = currentStage.namespaces.length > 0 
    ? currentStage.namespaces 
    : deptNamespaces[agent.department] || ['campaigns', 'kpis'];

const ragResult = await buildRAGContext(pool, message, { namespaces, maxTokens: 3000 });
```

### Completion Detection (Backend)

```javascript
// Despues de stream completo, detectar marker
const stageReadyMatch = fullResponse.match(/\[STAGE_READY:\s*(.+?)\]/);
if (stageReadyMatch) {
    // Enviar evento especial al frontend via SSE
    res.write(`data: ${JSON.stringify({ 
        handoff_suggestion: true, 
        reason: stageReadyMatch[1] 
    })}\n\n`);
    // Strip marker del mensaje guardado
    fullResponse = fullResponse.replace(/\[STAGE_READY:\s*.+?\]/, '').trim();
}
```

### Estimacion de costos

| Pipeline Stage | System+Context | Conversation | Output | Cost/msg |
|---------------|---------------|-------------|--------|----------|
| Stage 1 | ~4,500 tokens | ~2,000 | ~800 | ~$0.03 |
| Stage 5 | ~6,500 tokens | ~4,000 | ~800 | ~$0.04 |
| Stage 10 | ~8,000 tokens | ~6,000 | ~800 | ~$0.05 |

**Total por pipeline completo (10 stages, ~10 msgs/stage): ~$3-4**
**Handoff summaries (9 calls): ~$0.45**

---

## Frontend: Componentes

### 1. `useStreamingChat.js` — Hook compartido (extraido de AgentChat)

```javascript
// apps/dashboard/src/hooks/useStreamingChat.js
// Extraer SSE streaming pattern duplicado entre AgentChat (82-113) y PMAgentChat (104-135)

useStreamingChat({ endpoint, buildBody, onResponseHeaders, loadConversation })
  -> { messages, setMessages, streaming, sendMessage, clearConversation, ragSources }
```

- `endpoint`: string o fn → URL del fetch
- `buildBody(message)`: personaliza POST body
- `onResponseHeaders(headers)`: extrae X-RAG-Sources, etc.
- `loadConversation`: async fn para cargar mensajes al montar

**Migracion:** crear hook → refactorizar AgentChat para validar API → construir ProjectAgentChat

### 2. `ProjectPipelineView.jsx` — Container (state owner)

- Fetch y posee: pipeline state, stages, sessions
- Prop-drills: `refreshPipeline()`, `selectedStageIndex`, `setSelectedStageIndex`
- `useSearchParams` para `?stage=2` (deep-linkeable, dual-access)
- Renderiza: ProjectPipeline + ProjectAgentChat + HandoffModal

### 3. `ProjectPipeline.jsx` — Timeline VERTICAL de stages

```
PROJECT: Q2 Dubai Campaign
===========================

[0] Strategy & Brief          * Raul        [completed] [GATE]
    |  Summary: "Defined target audience..."
    |  Completed Apr 1 - 45 min
    |
    +--------+--------+
    |                  |
[1] Technical      [2] Calendar              [completed]
    Guillermo          Martina
    |                  |
    +--------+--------+
    |                  |
[3] Segmentation   [4] Content               [active]
    Diego              >> Lucia
    |  +-----------------------------------+
    |  | [Chat interface inline]           |
    |  | Messages...                       |
    |  | [Input]     [Handoff ->]          |
    |  +-----------------------------------+
    |                  |
    +--------+--------+
    |                  |
[5] Brand Review   [6] Legal Review          [pending]
    Sofia              Javier   [GATE]
    |                  |
    +--------+--------+
              |
[7] Automation                               [pending]
    Andres
    |
    +--------+--------+
    |                  |
[8] QA Testing     [9] Analytics             [pending]
    Elena              Carlos
```

- Reutiliza `.workflow-steps` CSS (index.css:1536)
- Completed: verde (checkmark), Active: primary (pulse), Pending: gris, Skipped: strikethrough
- Gate stages: icono de candado junto al badge
- Click en stage → `setSelectedStageIndex(i)` → chat se expande inline
- Stages paralelos: renderizar con connector lines bifurcando

### 4. `ProjectAgentChat.jsx` — Chat en contexto pipeline

- Usa `useStreamingChat` con endpoint `/projects/:id/sessions/:sessionId/chat`
- Header: nombre proyecto + stage + toggle sidebar context
- Context pills horizontales (stages completados clickeables) sobre el chat
- Previous stage summary pinned como card al top
- Boton "Handoff" en input row cuando session activa
- Deteccion de `handoff_suggestion` SSE event → prompt inline
- Right-side drawer para summaries completos (patron `inbox-drawer` de Inbox.jsx)

### 5. `HandoffModal.jsx` — Confirmacion de handoff (3 fases)

**Fase 1 — In-chat:** AI genera summary → aparece como mensaje especial con boton "Proceed to Handoff"
**Fase 2 — Modal:** Summary editable (textarea) + next agent (auto-selected, dropdown override) + notas opcionales
**Fase 3 — Post-confirm:** Checkmark animation en stage actual, pulse en siguiente, toast notification

Usa patron `.workflow-confirm-overlay` / `.workflow-confirm-card` existente.

### 6. `PipelineSelector.jsx` — Creacion de pipeline

- Step 1: Template cards (Campaign Creation, Flash Sale, Seasonal, Custom)
- Step 2: Review pipeline con agentes pre-asignados
- Cada agente: dropdown para reasignar (filtrado por departamento del stage)
- Arrow buttons (arriba/abajo) para reordenar (patron `BlockRenderer` en App.jsx)
- Boton + para anadir stage, X para quitar
- Confirmar → POST /api/projects/:id/pipeline

### 7. Integraciones en componentes existentes

**App.jsx** — Project detail:
- Tab toggle (`.weekly-view-toggle`): "Details" | "Pipeline"
- Pipeline tab: `ProjectPipelineView` si existe pipeline, `PipelineSelector` si no

**GenericAgentView.jsx** — Tab "Workflows" (linea 107-111, actualmente vacia):
- Reemplazar empty state con lista "Assigned Pipeline Tickets"
- Fetch `GET /api/agents/${agentId}/active-sessions`
- Cards con: project name, stage badge, "Open Pipeline →"

**WorkflowsHub.jsx** — Tercer toggle:
- "Catalog" | "History" | "Active Pipelines"
- Lista filtrable: project name, stage actual, agente, last activity

**Inbox.jsx / PMAgentChat.jsx** — Post-proyecto:
- Despues de crear proyecto, sugerir pipeline con template pre-seleccionado
- `PipelineSelector` inline en vista "proyecto" del PMAgentChat

---

## Integracion con sistema existente

### Collaboration Raises (tabla existente, sin endpoints)
- Auto-crear raise tipo `'handoff'` con `pipeline_session_id` al ejecutar handoff
- Handoff bloqueado si hay raises abiertos tipo `'blocker'`
- Activar CRUD endpoints de `collaboration_raises` (tabla existe desde schema.sql:266)

### Agent Memory (tabla existente)
- Al completar pipeline: escribir learnings a `agent_memory` scope `'shared'`
- Key: `pipeline_learning:${project.type}:${projectId}`
- Al construir system prompt: consultar ultimos 3 learnings del mismo project type

### Audit Log
- Eventos dentro de transaccion (usando `client.query`, no `logAudit()`):
  - `pipeline_created`, `pipeline_handoff`, `pipeline_completed`
  - `pipeline_paused`, `pipeline_resumed`, `pipeline_stage_skipped`

### PM Agent (post-proyecto)
- Despues de crear proyecto, endpoint sugiere template basado en `project.type`
- PM Agent puede decir: "He creado el proyecto. Para una campana recomiendo el pipeline Campaign Creation con 10 stages. Lo confirmas?"
- Response incluye `PipelineSelector` inline

---

## Archivos a modificar/crear

### Nuevos (7)
| Archivo | Proposito |
|---------|-----------|
| `apps/dashboard/src/data/pipelineTemplates.js` | Templates derivados de workflows.js |
| `apps/dashboard/src/hooks/useStreamingChat.js` | Hook compartido SSE |
| `apps/dashboard/src/components/ProjectPipelineView.jsx` | Container con state |
| `apps/dashboard/src/components/ProjectPipeline.jsx` | Timeline vertical |
| `apps/dashboard/src/components/ProjectAgentChat.jsx` | Chat en contexto pipeline |
| `apps/dashboard/src/components/HandoffModal.jsx` | Modal de handoff |
| `apps/dashboard/src/components/PipelineSelector.jsx` | Selector de template |

### Modificar (8)
| Archivo | Cambio |
|---------|--------|
| `packages/core/db/schema.sql` | +4 tablas, +1 ALTER, +indices |
| `apps/dashboard/server.js` | ~300 lineas: endpoints pipeline/handoff/chat/sessions |
| `packages/core/pm-agent/core.js` | +`generateHandoffSummary()`, +`buildPipelineSystemPrompt()` |
| `apps/dashboard/src/App.jsx` | Tab toggle en project detail |
| `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` | Tab "workflows" → pipeline tickets |
| `apps/dashboard/src/pages/WorkflowsHub.jsx` | Toggle "Active Pipelines" |
| `apps/dashboard/src/i18n/translations.js` | Namespace `pipeline.*` ES + EN |
| `apps/dashboard/src/index.css` | Seccion PIPELINE (~250 lineas) |

### Reutilizar
| Patron | Fuente | Uso |
|--------|--------|-----|
| SSE streaming | `AgentChat.jsx:82-113` | `useStreamingChat` hook |
| Transacciones | `save_project.js:26-104` | Handoff atomico |
| `buildRAGContext()` | `retrieval.js:207-306` | Contexto por stage |
| `chatWithPMAgent()` stream pattern | `core.js:173-202` | Pipeline chat streaming |
| `.workflow-steps` CSS | `index.css:1536` | Timeline vertical |
| `.workflow-confirm-overlay` | `index.css:4940` | HandoffModal |
| `inbox-drawer` pattern | `Inbox.jsx:90-109` | Context sidebar |
| Tab toggle | `.weekly-view-toggle` | Pipeline tab |
| `BlockRenderer` arrows | `App.jsx:62-69` | Stage reorder |
| Empty "workflows" tab | `GenericAgentView.jsx:107-111` | Pipeline tickets |
| `collaboration_raises` table | `schema.sql:266-280` | Handoff trail + blockers |
| `agent_memory` shared scope | `schema.sql:104-120` | Cross-pipeline learnings |
| Workflow definitions | `workflows.js:3-25` | Template source of truth |

---

## Verificacion

1. **Migration:** Correr schema, verificar 4 tablas nuevas + ALTER en Adminer (localhost:8080)
2. **Pipeline CRUD:** Crear proyecto → asignar pipeline desde template → verificar en DB
3. **Stages paralelos:** Crear pipeline campaign → completar stage 0 → verificar stages 1+2 se activan simultaneamente
4. **Chat en pipeline:** Abrir chat en stage → verificar system prompt: identity + accumulated summaries + project + RAG (namespaces del stage) + identity reminder
5. **Sliding window:** Enviar 30+ mensajes → verificar solo ultimos 24 en contexto Claude
6. **Completion detection:** Agente incluye `[STAGE_READY:]` → frontend muestra handoff suggestion
7. **Handoff flow:** Click handoff → AI genera summary (tool_use) → modal con summary editable → confirmar → session completed, next stages activated, audit log, collaboration raise
8. **Context chain:** Stage 5 agent → recibe: full summary de stage 4 + compressed de 0-3
9. **Human gate:** Stage con `gate_type: 'human_approval'` → handoff requiere confirmacion explicita
10. **Blocker check:** Crear raise tipo 'blocker' → handoff rechazado con 409
11. **Dual access:** Pipeline accesible desde project detail tab Y agent detail "workflows" tab
12. **Reopen stage:** Reabrir stage completado → downstream stages reset a pending
13. **Skip stage:** Saltar stage → status 'skipped', dependientes se activan si todas deps met
14. **Pause/resume:** Pausar pipeline → todos los chats read-only, reanudar → restaura estado
15. **Edge cases:** Claude falla en handoff (502, retry), concurrent handoff (FOR UPDATE serializa)
16. **i18n:** Todas las cadenas en ES + EN
17. **Responsive:** Timeline vertical en 375px, chat full-width, modal bottom-sheet

---

## Fases de implementacion

### Fase 1: Backend (DB + API)
- Schema: 4 tablas + ALTER + indices
- Seed data: pipeline demo para proyecto existente
- `generateHandoffSummary()` con tool_use en core.js
- `buildPipelineSystemPrompt()` con personality sandwich
- Endpoints CRUD pipeline
- Endpoint chat SSE con sliding window + RAG por stage
- Endpoint handoff con 2 fases + DAG activation
- Endpoint active-sessions por agente
- Endpoints pause/resume/skip

### Fase 2: Frontend Core
- `useStreamingChat` hook (extraer de AgentChat, refactorizar AgentChat)
- `pipelineTemplates.js`
- `PipelineSelector` (templates-first)
- `ProjectPipeline` (timeline vertical)
- `ProjectAgentChat` (chat con context pills + drawer)
- `HandoffModal` (3 fases)
- `ProjectPipelineView` (container)
- CSS seccion PIPELINE en index.css

### Fase 3: Integraciones
- App.jsx: tab toggle en project detail
- GenericAgentView: tab "workflows" → pipeline tickets
- WorkflowsHub: toggle "Active Pipelines"
- PMAgentChat: pipeline suggestion post-proyecto
- collaboration_raises: CRUD endpoints + handoff integration
- agent_memory: cross-pipeline learnings
- Audit log events

### Fase 4: Polish
- i18n completo (pipeline.* namespace)
- Edge cases (skip, reopen, pause/resume, concurrent handoff)
- Responsive (mobile timeline, bottom-sheet modal)
- DAG visualization (connector lines para stages paralelos)
- Empty states y onboarding

---

## Anexo: Flujo Visual End-to-End

Ejemplo completo con campana **"Eid Al Fitr 2026 — Special Fares to Dubai"**.
Mercados: UAE, UK, DACH. Audiencia: Skywards Gold + Platinum. Oferta: $399 vuelos a Dubai.

### PASO 1: INBOX — La idea entra

```
+--[SIDEBAR]--+  +--[PM AGENT CHAT]---------------------------------------+
|             |  |                                                          |
| INBOX       |  |  PM Agent                                    [ES] [EN]  |
| ----------- |  |                                                          |
| > Eid Fares |  |  +--------------------------------------------------+  |
|   Apr 1     |  |  | User: Quiero lanzar una campana de tarifas        |  |
|             |  |  | especiales para Eid Al Fitr. Mercados: UAE, UK,   |  |
|   Campaign  |  |  | DACH. Skywards Gold y Platinum. Vuelos a Dubai    |  |
|   idea #12  |  |  | desde $399. Dates: Apr 15 - May 5.               |  |
|             |  |  +--------------------------------------------------+  |
|   Feature   |  |                                                          |
|   request   |  |  +--------------------------------------------------+  |
|             |  |  | PM: Excelente campana. La clasifico como           |  |
|             |  |  | "Broadcast Promotional" (BAU type). Observaciones: |  |
|             |  |  |                                                    |  |
|             |  |  | - 3 mercados x 2 tiers x 3 idiomas = 18 variantes |  |
|             |  |  | - Timing: Ramadan termina ~Mar 30, Eid comienza   |  |
|             |  |  |   Apr 1. Send window optimo: Apr 5-8 (pre-booking)|  |
|             |  |  | - KPIs sugeridos: Open Rate >25%, CTR >4%,        |  |
|             |  |  |   Revenue target $500K                             |  |
|             |  |  |                                                    |  |
|             |  |  | Quieres que cree el proyecto con estos detalles?   |  |
|             |  |  +--------------------------------------------------+  |
|             |  |                                                          |
|             |  |  [________________] [Send] [Mic]                         |
|             |  |                                                          |
|             |  |  [       Crear Borrador       ]                          |
+-------------+  +----------------------------------------------------------+
```

### PASO 2: BORRADOR — Resumen para validar

```
+--[PM AGENT CHAT]-------------------------------------------------------+
|                                                                          |
|  +--[BORRADOR]-------------------------------------------------------+  |
|  |                                                                    |  |
|  |  RESUMEN: Eid Al Fitr 2026 — Special Fares                        |  |
|  |  ─────────────────────────────────────────                         |  |
|  |  Idea: Campana de tarifas promocionales para Eid Al Fitr           |  |
|  |  Mercados: UAE, UK, DACH                                           |  |
|  |  Audiencia: Skywards Gold + Platinum                               |  |
|  |  Oferta: Vuelos a Dubai desde $399                                 |  |
|  |  Periodo: Apr 15 - May 5                                          |  |
|  |  BAU Type: Broadcast Promotional                                   |  |
|  |  KPIs: OR >25%, CTR >4%, Revenue $500K                            |  |
|  |                                                                    |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  v Conversacion (6 mensajes)                                             |
|    User: Quiero lanzar una campana...                                    |
|    PM: Excelente campana. La clasifico como...                           |
|                                                                          |
|  [  Seguir Refinando  ]    [  Confirmar y Crear Proyecto  ]              |
|                                                                          |
+--------------------------------------------------------------------------+
```

### PASO 3: PROYECTO CREADO + PIPELINE SUGGESTION

```
+--[PM AGENT CHAT]-------------------------------------------------------+
|                                                                          |
|  +--[PROYECTO CREADO]-------+                                            |
|  | Proyecto creado y        |                                            |
|  | anadido al workspace     |                                            |
|  | ID: #47                  |                                            |
|  +--[Ver Proyecto ->]-------+                                            |
|                                                                          |
|  +--[ASIGNAR PIPELINE]--------------------------------------------------+
|  |                                                                       |
|  |  Selecciona un pipeline para este proyecto:                           |
|  |                                                                       |
|  |  +------------------+  +------------------+  +------------------+     |
|  |  | Campaign         |  | Flash Sale       |  | Seasonal         |     |
|  |  | Creation         |  | Rapid Deploy     |  | Planning         |     |
|  |  | ──────────────── |  | ──────────────── |  | ──────────────── |     |
|  |  | 10 stages        |  | 5 stages         |  | 5 stages         |     |
|  |  | 10 agentes       |  | 5 agentes        |  | 5 agentes        |     |
|  |  | ~2-3 semanas     |  | <4 horas         |  | ~1 semana        |     |
|  |  |                  |  |                  |  |                  |     |
|  |  | [Seleccionar]    |  | [Seleccionar]    |  | [Seleccionar]    |     |
|  |  +------------------+  +------------------+  +------------------+     |
|  |                                                                       |
|  +-----------------------------------------------------------------------+
|                                                                          |
+--------------------------------------------------------------------------+
```

### PASO 4: REVIEW DEL PIPELINE — Antes de confirmar

```
+--[PIPELINE REVIEW]------------------------------------------------------+
|                                                                          |
|  Pipeline: Campaign Creation                                             |
|  Proyecto: Eid Al Fitr 2026 — Special Fares                             |
|                                                                          |
|  STAGES                          AGENTE               DEPT              |
|  ─────────────────────────────────────────────────────────────           |
|                                                                          |
|  [0] Strategy & Brief            Raul        [v]      strategic   GATE  |
|       |                                                                  |
|       +----------+-----------+                                           |
|       |                      |                                           |
|  [1] Technical Feasibility   [2] Calendar & Timing                       |
|       Guillermo     [v]          Martina       [v]                       |
|       |                      |                                           |
|       +----------+-----------+                                           |
|       |                      |                                           |
|  [3] Segmentation            [4] Content & Creative                      |
|       Diego         [v]          Lucia          [v]                      |
|       |                      |                                           |
|       +----------+-----------+                                           |
|       |                      |                                           |
|  [5] Brand Review            [6] Legal Review                            |
|       Sofia         [v]          Javier         [v]           GATE      |
|       |                      |                                           |
|       +----------+-----------+                                           |
|              |                                                           |
|  [7] Automation & Build      Andres        [v]                           |
|       |                                                                  |
|       +----------+-----------+                                           |
|       |                      |                                           |
|  [8] QA & Testing            [9] Analytics Setup                         |
|       Elena         [v]          Carlos         [v]                      |
|                                                                          |
|  [v] = dropdown para cambiar agente                                      |
|  GATE = requiere aprobacion humana                                       |
|                                                                          |
|  [  Cancelar  ]              [  Confirmar Pipeline  ]                    |
|                                                                          |
+--------------------------------------------------------------------------+
```

### PASO 5: PIPELINE ACTIVO — Vista principal (Content stage)

Stages [3] Segmentation y [4] Content estan ambos `active` (paralelos).
El usuario clickea en Lucia (Content) en la timeline:

```
+--[PROJECT: Eid Al Fitr 2026]--------------------------------------------+
|                                                                          |
|  [Details]  [Pipeline]                                                   |
|  ──────────────────────                                                  |
|                                                                          |
|  +--[TIMELINE]---+  +--[CHAT AREA]-----------------------------------+  |
|  |               |  |                                                 |  |
|  | [0] Strategy  |  |  Lucia — Content & Creative                    |  |
|  |  * Raul       |  |  Project: Eid Al Fitr 2026                     |  |
|  |  completed    |  |                                                 |  |
|  |  Apr 1, 45m   |  |  [Strategy] [Technical] [Calendar] [Segment.]  |  |
|  |  |            |  |                ^ context pills                  |  |
|  |  +-----+----+ |  |                                                 |  |
|  |  |          | |  |  +----------------------------------------------+|  |
|  | [1] Tech   | |  |  | Previous: Segmentation (Diego)               ||  |
|  |  Guillermo | |  |  | "Defined 18 audience segments across         ||  |
|  |  completed | |  |  |  3 markets, 2 tiers. Total reach: 2.1M"      ||  |
|  |  |         | |  |  | [Show full summary]                          ||  |
|  | [2] Cal.   | |  |  +----------------------------------------------+|  |
|  |  Martina   | |  |                                                 |  |
|  |  completed | |  |  Lucia: Hola! Estoy revisando el brief de       |  |
|  |  |         | |  |  Raul. Veo que necesitamos 18 variantes          |  |
|  |  +----+----+ |  |  (3 mercados x 2 tiers x 3 idiomas). Voy a     |  |
|  |       |      |  |  empezar con los subject lines.                 |  |
|  |  +----+----+ |  |                                                 |  |
|  |  |         | |  |  Propongo 3 enfoques por mercado:               |  |
|  | [3] Seg.  | |  |                                                 |  |
|  |  Diego    | |  |  UAE: "Celebrate Eid with Emirates —             |  |
|  |  active   | |  |       Fly to Dubai from $399"                    |  |
|  |  |        | |  |  UK:  "Eid Special: London to Dubai              |  |
|  | [4] Content| |  |       from GBP329. Book now."                   |  |
|  | >> Lucia  | |  |  DACH: "Eid Spezial: Fluge nach Dubai            |  |
|  |  active   | |  |        ab EUR349. Jetzt buchen."                 |  |
|  |  |        | |  |                                                 |  |
|  |  +----+---+ |  |  Para Platinum, anadimos exclusividad:           |  |
|  |       |     |  |  "As a valued Platinum member, enjoy             |  |
|  | [5] Brand  | |  |   complimentary lounge access..."               |  |
|  |  Sofia     | |  |                                                 |  |
|  |  pending   | |  |  Que te parece? Ajusto algo?                    |  |
|  |  |         | |  |                                                 |  |
|  | [6] Legal  | |  |  +----------------------------------------------+|  |
|  |  Javier    | |  |  | User: Me encanta. Para DACH cambia            ||  |
|  |  pending   | |  |  | "Spezial" por "Sonderangebot", mas premium.  ||  |
|  |  |         | |  |  | El resto perfecto.                           ||  |
|  |  +----+----+ |  |  +----------------------------------------------+|  |
|  |       |      |  |                                                 |  |
|  | [7] Autom. | |  |  Lucia: Perfecto, cambio hecho.                 |  |
|  |  Andres    | |  |  Creo que el contenido esta listo.              |  |
|  |  pending   | |  |  [STAGE_READY: All 18 variants complete]        |  |
|  |  |         | |  |                                                 |  |
|  |  +----+---+ |  |  +----------------------------------------------+|  |
|  |  |        | |  |  | Ready to hand off to Brand Review?           ||  |
|  | [8] QA   | |  |  | Lucia believes the stage is complete.        ||  |
|  |  Elena   | |  |  | [  Proceed to Handoff ->  ]                  ||  |
|  |  pending | |  |  +----------------------------------------------+|  |
|  | [9] Anal.| |  |                                                 |  |
|  |  Carlos  | |  |  [________________] [Send] [Mic]  [Handoff ->]  |  |
|  +----------+ |  +---------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### PASO 6: HANDOFF MODAL

El usuario clickea "Proceed to Handoff". Loading 2-3s, luego el modal:

```
+--[HANDOFF MODAL]--------------------------------------------------------+
|                                                                          |
|  +-[overlay blur]------------------------------------------------------+ |
|  |                                                                      | |
|  |  +--[HANDOFF CONFIRMATION]---------------------------------------+  | |
|  |  |                                                                |  | |
|  |  |  Completar stage: Content & Creative (Lucia)                   |  | |
|  |  |  Proyecto: Eid Al Fitr 2026                                    |  | |
|  |  |                                                                |  | |
|  |  |  RESUMEN (editable):                                           |  | |
|  |  |  +----------------------------------------------------------+  |  | |
|  |  |  | Generados 18 variantes de contenido para campana Eid:    |  |  | |
|  |  |  | 3 mercados (UAE, UK, DACH) x 2 tiers (Gold, Platinum)    |  |  | |
|  |  |  | x 3 idiomas (EN, ES, DE). Subject lines optimizados     |  |  | |
|  |  |  | por mercado con tono premium para Platinum. Copy blocks   |  |  | |
|  |  |  | completos con hero, body y CTA. Reglas AMPscript para    |  |  | |
|  |  |  | personalizacion de nombre y tier benefits.               |  |  | |
|  |  |  +----------------------------------------------------------+  |  | |
|  |  |                                                                |  | |
|  |  |  Decisiones:                                                   |  | |
|  |  |  - "Sonderangebot" para DACH en vez de "Spezial"              |  | |
|  |  |  - Lounge access messaging solo para Platinum                  |  | |
|  |  |  - CTA "Book Now" unificado en todos los mercados             |  | |
|  |  |                                                                |  | |
|  |  |  Entregables:                                                  |  | |
|  |  |  - 6 subject lines, 6 preview texts                           |  | |
|  |  |  - Copy blocks (hero/body/CTA) por mercado                    |  | |
|  |  |  - Reglas de personalizacion AMPscript                         |  | |
|  |  |                                                                |  | |
|  |  |  Preguntas abiertas:                                           |  | |
|  |  |  - Confirmar con Brand si "complimentary lounge" es            |  | |
|  |  |    apropiado para Gold (normalmente solo Platinum)             |  | |
|  |  |                                                                |  | |
|  |  |  ──────────────────────────────────────────────                |  | |
|  |  |                                                                |  | |
|  |  |  Siguiente stage:  [Brand Review — Sofia     v]               |  | |
|  |  |                     (tambien se activa: Legal — Javier)        |  | |
|  |  |                                                                |  | |
|  |  |  Notas para Sofia (opcional):                                  |  | |
|  |  |  +----------------------------------------------------------+  |  | |
|  |  |  | Prestar atencion especial a las variantes DACH — el       |  |  | |
|  |  |  | tono debe ser premium pero no rigido.                     |  |  | |
|  |  |  +----------------------------------------------------------+  |  | |
|  |  |                                                                |  | |
|  |  |  [  Cancelar  ]                   [  Confirmar Handoff  ]      |  | |
|  |  +----------------------------------------------------------------+  | |
|  +----------------------------------------------------------------------+ |
+--------------------------------------------------------------------------+
```

### PASO 7: POST-HANDOFF — Timeline actualizada

Content pasa a completed, Brand + Legal se activan (paralelos):

```
+--[TIMELINE actualizada]-------------------------------------------------+
|                                                                          |
|  [0] Strategy & Brief         * Raul          completed   GATE          |
|       |                                                                  |
|       +----------+-----------+                                           |
|  [1] Technical               [2] Calendar                                |
|       * Guillermo               * Martina                                |
|       completed                  completed                               |
|       |                      |                                           |
|       +----------+-----------+                                           |
|  [3] Segmentation            [4] Content & Creative                      |
|       * Diego                    * Lucia                                 |
|       completed                  completed  <-- acaba de completar       |
|       |                      |                                           |
|       +----------+-----------+                                           |
|  [5] Brand Review            [6] Legal Review                            |
|       >> Sofia                   >> Javier    <-- AMBOS activos          |
|       active                     active                     GATE        |
|       |                      |                                           |
|       +----------+-----------+                                           |
|  [7] Automation              Andres           pending                    |
|       |                                                                  |
|       +----------+-----------+                                           |
|  [8] QA & Testing            [9] Analytics Setup                         |
|       Elena                      Carlos       pending                    |
|                                                                          |
|  Toast: "Handoff completado. Brand Review (Sofia) y Legal Review         |
|          (Javier) activados."                                            |
+--------------------------------------------------------------------------+
```

### PASO 8: BRAND REVIEW — Sofia recibe contexto acumulado

```
+--[CHAT: Sofia — Brand Review]-------------------------------------------+
|                                                                          |
|  Sofia — Brand Review          Eid Al Fitr 2026             [Context]   |
|                                                                          |
|  [Strategy] [Technical] [Calendar] [Segmentation] [Content]             |
|                      ^ context pills (clickeables)                       |
|                                                                          |
|  +--[Previous: Content & Creative (Lucia)]---------------------------+  |
|  | "Generados 18 variantes de contenido... 3 mercados x 2 tiers..."  |  |
|  | Note from Lucia: Prestar atencion especial a variantes DACH       |  |
|  | [Show full summary]                                                |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Sofia: He revisado las 18 variantes de Lucia. Mis observaciones:        |
|                                                                          |
|  APROBADO:                                                               |
|  - UAE y UK subject lines: tono premium correcto                         |
|  - CTA "Book Now" consistente con guidelines Emirates                    |
|  - Personalizacion Platinum: "valued member" alineado con Skywards       |
|                                                                          |
|  REQUIERE CAMBIOS:                                                       |
|  - DACH copy: "Sonderangebot" suena demasiado retail. Sugiero            |
|    "Exklusives Eid-Angebot" que mantiene exclusividad                    |
|  - Hero image: necesita mostrar avion A380, no generico                  |
|  - Footer: falta el tagline "Fly Emirates. Fly Better." en DE           |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | User: Corrigelos aqui directamente.                                |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Sofia: Perfecto. Cambios aplicados:                                     |
|  1. "Exklusives Eid-Angebot" en lugar de "Sonderangebot"               |
|  2. Nota para HTML: hero image must be A380-specific                     |
|  3. Tagline "Fly Emirates. Fly Better." anadido al footer DE            |
|                                                                          |
|  Brand review aprobada con estos ajustes.                                |
|  [STAGE_READY: Brand compliance approved with 3 corrections]             |
|                                                                          |
|  +--[Handoff suggestion]---------------------------------------------+  |
|  | Sofia believes the stage is complete.                              |  |
|  | [  Proceed to Handoff ->  ]                                        |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  [________________] [Send] [Mic]                     [Handoff ->]       |
+--------------------------------------------------------------------------+
```

### PASO 9: CONTEXT DRAWER — Summaries anteriores

Click en [Context] abre drawer lateral derecho:

```
+--[CHAT: Sofia]--+--[CONTEXT DRAWER]-------------------------------------+
|                  |                                                        |
| Sofia — Brand    |  Pipeline Context                            [Close]  |
|                  |                                                        |
| ...mensajes...   |  v [0] Strategy & Brief — Raul              completed |
|                  |    Defined Eid campaign targeting Gold/Platinum         |
|                  |    in UAE/UK/DACH. $399 fares to Dubai.                |
|                  |    KPIs: OR>25%, CTR>4%, Revenue $500K.                |
|                  |    Decisions:                                          |
|                  |    - BAU type: Broadcast Promotional                   |
|                  |    - 18 variants (3x2x3 matrix)                       |
|                  |    - Send window: Apr 5-8                              |
|                  |                                                        |
|                  |  > [1] Technical — Guillermo              completed   |
|                  |  > [2] Calendar — Martina                 completed   |
|                  |  > [3] Segmentation — Diego               completed   |
|                  |                                                        |
|                  |  v [4] Content — Lucia                    completed   |
|                  |    18 content variants generated. Subject lines        |
|                  |    optimized per market. AMPscript personalization.    |
|                  |    Decisions:                                          |
|                  |    - "Sonderangebot" for DACH                          |
|                  |    - Lounge access only for Platinum                   |
|                  |    Open questions:                                     |
|                  |    - Confirm lounge access for Gold tier               |
|                  |                                                        |
|                  |  [5] Brand Review — Sofia                 active       |
|                  |  [6] Legal Review — Javier                active       |
+------------------+--------------------------------------------------------+
```

### PASO 10: DUAL ACCESS — Desde pagina del agente

El usuario navega a Javier (Legal Agent). Tab "Workflows" muestra sus tickets:

```
+--[AGENT: Javier — Legal Agent]------------------------------------------+
|                                                                          |
|  Javier                                                                  |
|  Legal & Regulatory Compliance Agent                                     |
|  Department: Control                Status: active                       |
|                                                                          |
|  [Chat] [Skills] [Tools] [Workflows] [Activity] [EOD]                   |
|                            ^^^^^^^^                                      |
|                                                                          |
|  +--[ASSIGNED PIPELINE TICKETS]--------------------------------------+  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+  |  |
|  |  | Eid Al Fitr 2026 — Special Fares                             |  |  |
|  |  | Stage: Legal Review (6 of 10)              GATE              |  |  |
|  |  | Status: active                                               |  |  |
|  |  | Assigned: 2 hours ago                                        |  |  |
|  |  | Depends on: Segmentation (done), Content (done)              |  |  |
|  |  |                                                              |  |  |
|  |  | [  Open Pipeline ->  ]                                       |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  |  +--------------------------------------------------------------+  |  |
|  |  | Q1 Newsletter Refresh                                        |  |  |
|  |  | Stage: Legal Review (4 of 6)                                 |  |  |
|  |  | Status: pending — waiting for Content                        |  |  |
|  |  |                                                              |  |  |
|  |  | [  Open Pipeline ->  ]                                       |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### PASO 11: HUMAN GATE — Aprobacion obligatoria (Legal)

```
+--[HANDOFF MODAL — GATE]-------------------------------------------------+
|                                                                          |
|  +--[APPROVAL REQUIRED]----------------------------------------------+  |
|  |                                                                    |  |
|  |  GATE: Aprobacion humana requerida                                |  |
|  |                                                                    |  |
|  |  Stage: Legal Review (Javier)                                      |  |
|  |  Proyecto: Eid Al Fitr 2026                                        |  |
|  |                                                                    |  |
|  |  RESUMEN LEGAL:                                                    |  |
|  |  +--------------------------------------------------------------+  |  |
|  |  | Compliance review completado para 3 jurisdicciones:          |  |  |
|  |  | - UAE: PDPL compliant. Disclaimers anadidos en AR.           |  |  |
|  |  | - UK: GDPR compliant. Opt-out link verificado.               |  |  |
|  |  | - DACH: GDPR + Bundesdatenschutzgesetz. T&C actualizados.    |  |  |
|  |  | Todas las variantes aprobadas para envio.                    |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  |  Este stage requiere tu aprobacion explicita antes de              |  |
|  |  continuar a Automation & Build (Andres).                          |  |
|  |                                                                    |  |
|  |  Al aprobar, confirmas que el contenido cumple con todas           |  |
|  |  las regulaciones aplicables para los mercados seleccionados.      |  |
|  |                                                                    |  |
|  |  [  Rechazar y Reabrir  ]         [  Aprobar y Continuar  ]       |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### PASO 12: WORKFLOWS HUB — Vista cross-project

```
+--[COMMAND CENTER]--------------------------------------------------------+
|                                                                          |
|  [Catalog]  [History]  [Active Pipelines]                                |
|                         ^^^^^^^^^^^^^^^^^                                |
|                                                                          |
|  Active Pipelines (3)                              [Filter by dept v]   |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Eid Al Fitr 2026                                                   |  |
|  | Campaign Creation  |  10 stages                                    |  |
|  |                                                                    |  |
|  | [*]--[*]--[*]--[*]--[*]--[o]--[o]--[ ]--[ ]--[ ]                 |  |
|  |  0    1    2    3    4    5    6    7    8    9                     |  |
|  |                          Brand  Legal                              |  |
|  |                                                                    |  |
|  | Current: Brand Review (Sofia) + Legal Review (Javier)              |  |
|  | Last activity: 30 min ago                      [Open Pipeline ->]  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Q1 Newsletter Refresh                                              |  |
|  | Flash Sale Rapid Deploy  |  5 stages                              |  |
|  |                                                                    |  |
|  | [*]--[*]--[o]--[ ]--[ ]                                           |  |
|  |  0    1    2    3    4                                             |  |
|  |                                                                    |  |
|  | Current: Fast Content (Lucia)                                      |  |
|  | Last activity: 2 hours ago                     [Open Pipeline ->]  |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | Summer Routes 2026                                                 |  |
|  | Seasonal Planning  |  5 stages                                    |  |
|  |                                                                    |  |
|  | [*]--[o]--[o]--[ ]--[ ]                                           |  |
|  |  0    1    2    3    4                                             |  |
|  |                                                                    |  |
|  | Current: Calendar (Martina) + Pre-build (Diego)                    |  |
|  | Last activity: yesterday                       [Open Pipeline ->]  |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### PASO 13: PIPELINE COMPLETADO

```
+--[PIPELINE COMPLETED]---------------------------------------------------+
|                                                                          |
|  Eid Al Fitr 2026 — Special Fares                     COMPLETED         |
|                                                                          |
|  [*] Strategy          Raul         Apr 1    45 min                      |
|   |                                                                      |
|   +------+------+                                                        |
|  [*] Technical  [*] Calendar       Apr 2    30 min / 20 min             |
|   |             |                                                        |
|   +------+------+                                                        |
|  [*] Segment.  [*] Content        Apr 3-5   2h / 3h                     |
|   |             |                                                        |
|   +------+------+                                                        |
|  [*] Brand     [*] Legal   GATE   Apr 6    45 min / 1h                  |
|   |             |                                                        |
|   +------+------+                                                        |
|  [*] Automation               Apr 7    1.5h                              |
|   |                                                                      |
|   +------+------+                                                        |
|  [*] QA        [*] Analytics      Apr 8    1h / 30 min                  |
|                                                                          |
|  Total: 10 stages | 8 days | 12 hours active work                       |
|  All handoff summaries preserved in project history                      |
|                                                                          |
|  +--[KEY LEARNINGS]--------------------------------------------------+  |
|  | - DACH market requires extra brand review time                     |  |
|  | - Parallel Brand+Legal saved 1 day vs sequential                   |  |
|  | - AMPscript personalization rules should be in Technical stage     |  |
|  | Saved to shared agent memory for future campaigns                  |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### MOBILE (375px)

```
+--[MOBILE 375px]------+       +--[MOBILE BOTTOM SHEET]--+
|                       |       |                          |
| Eid Al Fitr 2026      |       |  ─── (drag handle) ───  |
| [Details] [Pipeline]  |       |                          |
|                       |       |  Handoff: Content        |
| [*]-[*]-[*]-[*]-[o]  |       |  -> Brand Review (Sofia) |
|  0   1   2   3   4   |       |                          |
|          Content ^    |       |  Summary:                |
|                       |       |  +--------------------+  |
| +-------------------+ |       |  | 18 content variants|  |
| | Lucia — Content   | |       |  | generated...       |  |
| | Stage 4 of 10     | |       |  +--------------------+  |
| +-------------------+ |       |                          |
|                       |       |  [Cancel] [Confirm ->]   |
| [Prev: Segmentation] |       |                          |
| "Defined 18 audience |       +--------------------------+
|  segments..."        |
|                       |
| Lucia: He preparado  |
| los subject lines    |
| para los 3 mercados. |
|                       |
| UAE: "Celebrate Eid  |
| with Emirates..."    |
|                       |
| +-------------------+ |
| | Ready to handoff? | |
| | [Proceed ->]      | |
| +-------------------+ |
|                       |
| [________] [>] [HO]  |
+-----------------------+
```

---

## Anexo: Rollback, Reopen y Pipeline Customization

### Escenario: QA devuelve tarea hacia atras

Cuando Elena (QA) encuentra issues, hay dos mecanismos:

#### Opcion A: Blocker (sin reabrir stage)

Elena crea un `collaboration_raise` tipo `blocker` dirigido a Lucia. Mientras el blocker este abierto, el handoff de QA esta BLOQUEADO (el endpoint retorna 409).

```
+--[CHAT: Elena — QA & Testing]-------------------------------------------+
|                                                                          |
|  Elena: He encontrado 2 issues criticos:                                 |
|                                                                          |
|  BLOCKER:                                                                |
|  1. Las variantes DACH no tienen el tagline "Fly Emirates.               |
|     Fly Better." que Brand aprobo. Esto fue una correccion               |
|     de Sofia pero no se aplico al contenido final.                       |
|  2. El link de opt-out en la version AR apunta a una URL                 |
|     expirada. Legal (Javier) aprobo asumiendo URL correcta.             |
|                                                                          |
|  No puedo aprobar QA hasta que se resuelvan estos issues.                |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | User: Tienes razon. Hay que devolver a Lucia para que corrija      |  |
|  | el tagline, y a Javier para que revise la URL.                     |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  [  Crear Blocker para Content  ]  [  Crear Blocker para Legal  ]       |
|                                                                          |
+--------------------------------------------------------------------------+
```

Se crea el raise:

```
+--[BLOCKER CREATED]------------------------------------------------------+
|                                                                          |
|  Raise #34: BLOCKER                                                      |
|  From: Elena (QA) → To: Lucia (Content)                                 |
|  Pipeline: Eid Al Fitr 2026, Stage: QA & Testing                        |
|                                                                          |
|  "Variantes DACH no tienen tagline 'Fly Emirates. Fly Better.'          |
|   que Brand aprobo. Corregir y confirmar."                               |
|                                                                          |
|  Status: OPEN                                                            |
|  ─────────────────────────────                                           |
|  Mientras haya blockers abiertos, el handoff de QA esta BLOQUEADO.       |
|  Lucia puede resolver desde su chat individual o desde el pipeline.      |
|                                                                          |
+--------------------------------------------------------------------------+
```

Cuando Lucia resuelve (actualiza el contenido y marca el raise como `resolved`), Elena puede continuar QA y hacer handoff. Esto es para fixes menores que no requieren re-ejecutar stages completos.

#### Opcion B: Reopen Stage (reabrir stage anterior)

Si el problema es grave y requiere re-trabajo completo de un stage anterior:

```
+--[REOPEN STAGE MODAL]---------------------------------------------------+
|                                                                          |
|  Reabrir stage anterior                                                  |
|                                                                          |
|  Stage a reabrir: [Content & Creative — Lucia  v]                        |
|                                                                          |
|  ADVERTENCIA:                                                            |
|  Reabrir Content & Creative reiniciara los siguientes stages:            |
|                                                                          |
|  [!] Brand Review (Sofia)     completed → pending                        |
|  [!] Legal Review (Javier)    completed → pending                        |
|  [!] Automation (Andres)      completed → pending                        |
|  [!] QA & Testing (Elena)     active    → pending                        |
|                                                                          |
|  Los summaries anteriores se preservan como "Ronda anterior".            |
|  El contenido previo NO se pierde, pero los stages downstream            |
|  deben re-ejecutarse despues de la correccion.                           |
|                                                                          |
|  Motivo de reapertura:                                                   |
|  +----------------------------------------------------------+           |
|  | QA encontro que las correcciones de Brand no se           |           |
|  | aplicaron al contenido final. Requiere re-trabajo.        |           |
|  +----------------------------------------------------------+           |
|                                                                          |
|  [  Cancelar  ]              [  Confirmar Reopen  ]                      |
|                                                                          |
+--------------------------------------------------------------------------+
```

La timeline despues del Reopen:

```
+--[TIMELINE — After Reopen]----------------------------------------------+
|                                                                          |
|  [*] Strategy          Raul           completed                          |
|   |                                                                      |
|   +------+------+                                                        |
|  [*] Technical  [*] Calendar         completed                           |
|   |             |                                                        |
|   +------+------+                                                        |
|  [*] Segment.  [4] Content          REOPENED  <-- Lucia trabaja aqui     |
|   completed     >> Lucia                                                 |
|                  active (round 2)                                        |
|   |             |                                                        |
|   +------+------+                                                        |
|  [ ] Brand     [ ] Legal             reset to pending                    |
|   Sofia         Javier                                                   |
|   |             |                                                        |
|   +------+------+                                                        |
|  [ ] Automation                      reset to pending                    |
|   |                                                                      |
|   +------+------+                                                        |
|  [ ] QA        [ ] Analytics         reset to pending                    |
|                                                                          |
|  Banner: "Pipeline parcialmente reiniciado. Stages 4-9 requieren        |
|           re-ejecucion despues de correccion en Content."                |
+--------------------------------------------------------------------------+
```

Dentro del chat de Lucia (round 2), ve el contexto de la ronda anterior:

```
+--[CHAT: Lucia — Content (Round 2)]--------------------------------------+
|                                                                          |
|  +--[RONDA ANTERIOR]--------------------------------------------------+  |
|  | Round 1 completado Apr 5. Summary preservado.                      |  |
|  | Motivo de reapertura: "QA encontro que correcciones de Brand       |  |
|  | no se aplicaron al contenido final"                                |  |
|  | [Ver summary ronda anterior]                                       |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Lucia: Entendido. Veo que el issue es el tagline en DACH.               |
|  Voy a aplicar las 3 correcciones que Sofia indico:                      |
|  1. "Exklusives Eid-Angebot" (ya estaba)                                |
|  2. A380 hero image note (ya estaba)                                     |
|  3. "Fly Emirates. Fly Better." en footer DE — ESTO FALTABA             |
|                                                                          |
|  Corregido. Las 18 variantes ahora incluyen el tagline.                  |
|  [STAGE_READY: Applied missing Brand corrections to DACH variants]       |
|                                                                          |
+--------------------------------------------------------------------------+
```

#### Cuando usar cada opcion

| Situacion | Mecanismo | Ejemplo |
|-----------|-----------|---------|
| Fix menor, un agente puede resolver | Blocker raise | "Falta tagline en footer DACH" |
| Re-trabajo completo de un stage | Reopen stage | "Toda la estrategia de contenido DACH necesita rehacerse" |
| Issue que afecta multiples stages | Reopen stage mas antiguo | Reopen Strategy si los KPIs eran incorrectos |
| Pregunta, no bloqueante | Raise tipo `question` | "Es correcto 'complimentary lounge' para Gold?" |
| Info general | Raise tipo `fyi` | "Nuevo disclaimer requerido por regulacion UAE" |

#### Backend del Reopen

```javascript
// POST /api/projects/:id/pipeline/reopen
// body: { target_stage_order, reason }

// 1. Validar que el stage target esta 'completed'
// 2. Reset ALL downstream stages to 'pending' (stages with stage_order > target)
// 3. Set target stage to 'active' (round 2)
// 4. Preserve previous summary as 'summary_round_1' in metadata
// 5. Audit log: pipeline_stage_reopened
// 6. Update pipeline current_stage_order to target
```

---

### Pipeline Suggestion: Totalmente modificable

Cuando el PM Agent sugiere un pipeline despues de crear el proyecto, el `PipelineSelector` da control total antes de confirmar:

```
+--[PIPELINE SELECTOR — Customizable]-------------------------------------+
|                                                                          |
|  Template sugerido: Campaign Creation (10 stages)                        |
|  Basado en: BAU type "Broadcast Promotional"                             |
|                                                                          |
|  Puedes modificar antes de confirmar:                                    |
|                                                                          |
|  STAGE                    AGENTE                 ACCIONES               |
|  ────────────────────────────────────────────────────────                |
|                                                                          |
|  [0] Strategy & Brief     [Raul            v]    [^] [v] [X]           |
|  [1] Technical Feasib.    [Guillermo       v]    [^] [v] [X]           |
|  [2] Calendar & Timing    [Martina         v]    [^] [v] [X]           |
|  [3] Segmentation         [Diego           v]    [^] [v] [X]           |
|  [4] Content & Creative   [Lucia           v]    [^] [v] [X]           |
|  [5] Brand Review         [Sofia           v]    [^] [v] [X]           |
|  [6] Legal Review         [Javier          v]    [^] [v] [X]           |
|  [7] Automation & Build   [Andres          v]    [^] [v] [X]           |
|  [8] QA & Testing         [Elena           v]    [^] [v] [X]           |
|  [9] Analytics Setup      [Carlos          v]    [^] [v] [X]           |
|                                                                          |
|  [^] = mover arriba  [v] = mover abajo  [X] = quitar stage             |
|                                                                          |
|  [+ Anadir Stage]                                                        |
|                                                                          |
|  Dropdown agente filtra por departamento del stage.                      |
|  Ej: stage "Content" muestra agentes de Execution:                       |
|  [Lucia v] → Lucia, Diego, Andres, Martina                              |
|                                                                          |
|  [  Cambiar Template  ]             [  Confirmar Pipeline  ]             |
|                                                                          |
+--------------------------------------------------------------------------+
```

#### Acciones disponibles antes de confirmar

| Accion | Como | Ejemplo |
|--------|------|---------|
| Cambiar agente | Dropdown [v] por stage | Poner Valentina en Strategy en vez de Raul |
| Quitar stage | Boton [X] | No necesito Analytics para esta campana |
| Anadir stage | [+ Anadir Stage] | Anadir Documentation (Marina) al final |
| Reordenar | Flechas [^] [v] | Mover Calendar antes de Technical |
| Cambiar template | [Cambiar Template] | Empezar de cero con Flash Sale |

#### Modificacion durante ejecucion

Una vez confirmado y en ejecucion, SOLO se pueden modificar stages `pending`:

```
+--[MODIFICAR PIPELINE EN EJECUCION]--------------------------------------+
|                                                                          |
|  [*] Strategy      completed  — INMUTABLE (no se puede cambiar)         |
|  [*] Technical     completed  — INMUTABLE                                |
|  >> Content        active     — INMUTABLE (en progreso)                  |
|  [ ] Brand Review  pending    — MODIFICABLE (cambiar agente, quitar)    |
|  [ ] Legal Review  pending    — MODIFICABLE                              |
|  [ ] Automation    pending    — MODIFICABLE                              |
|  [ ] QA            pending    — MODIFICABLE                              |
|  [ ] Analytics     pending    — MODIFICABLE                              |
|                                                                          |
|  [+ Anadir Stage al final]                                               |
|                                                                          |
|  Ejemplo: "Ya no necesitamos Legal Review para esta campana interna"     |
|  → Click [X] en Legal → stage eliminado del pipeline                    |
|                                                                          |
|  Ejemplo: "Quiero que Valentina revise en vez de Sofia"                  |
|  → Dropdown Brand Review → seleccionar Valentina                         |
|                                                                          |
+--------------------------------------------------------------------------+
```
