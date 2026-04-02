# Pipeline Work Visibility — Design Spec

## Context

Proyecto 006 (pipeline visibility) implementó badges, kanban progress, y agent tickets. Al verificar, se encontraron 4 bugs y el usuario pidió que los **deliverables y trabajo de cada agente sean visibles** en la vista del proyecto y en la vista del agente.

La data ya existe en DB: `project_agent_sessions.deliverables` almacena `{summary, decisions_made[], deliverables[], open_questions[], context_for_next}` como JSONB al hacer handoff. `pipeline_session_messages` almacena la conversación completa. Solo falta mostrarla.

## Scope

1. **4 bug fixes** — markdown en pipeline chat, department "General", workflow count hardcoded, pipeline en dailies/weeklies
2. **Work Log tab** — nueva 3ra tab en project detail con sidebar de agentes + acordeones de trabajo
3. **Workflows tab enriquecida** — agent view muestra tickets activos + historial de trabajo completado

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Donde mostrar trabajo | Ambos: proyecto + agent view | Misma data, dos perspectivas |
| Layout Work Log | Sidebar agentes + acordeones | Colapsable, no overwhelm, click para drill-down |
| Layout Agent History | Dentro de tab Workflows existente | Tab no tenía función clara, ahora sí |
| Iconos | Lucide icons | Consistente con el rest del dashboard |
| Markdown rendering | renderMarkdown() existente | Ya lo usan AgentChat, PMAgentChat, KBChat |

---

## Part A: Bug Fixes

### Fix 1: Markdown en ProjectAgentChat

**Problema:** `ProjectAgentChat.jsx:80` renderiza `{msg.content}` como texto plano. Todos los demás chats usan `renderMarkdown()`.

**Archivos:**
- `apps/dashboard/src/components/ProjectAgentChat.jsx`

**Cambios:**
- Import `renderMarkdown` de `../utils/renderMarkdown.js`
- Línea 79-81: assistant messages usan `<div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }} />`, user messages mantienen texto plano

### Fix 2: Department "General" → inferir de pipeline stages

**Problema:** Proyecto "Reactivate Preflight Experience Campaign" (ID 15) tiene `department: 'General'` porque se creó antes del fix preventivo (server.js:2187-2190). No aparece en kanban de ningún departamento específico.

**Archivos:**
- `packages/core/db/schema.sql`

**Cambios:**
- SQL migration idempotente al final de schema.sql:
  - UPDATE projects con `department='General'` que tengan pipeline stages con department real
  - Inferir department del primer stage (`ORDER BY stage_order ASC LIMIT 1`)

### Fix 3: Workflows tab count dinámico

**Problema:** `GenericAgentView.jsx:108` tiene `count: 0` hardcoded. El usuario no sabe que hay tickets.

**Archivos:**
- `apps/dashboard/src/components/agent-views/GenericAgentView.jsx`

**Cambios:**
- Agregar `useState(0)` para `ticketCount`
- Agregar `useEffect` que fetch `GET /api/agents/${agent.id}/active-sessions` y seta el count
- Cambiar `count: 0` → `count: ticketCount` en definición de tab

### Fix 4: Pipeline data en dailies/weeklies

**4a — EOD reports incluyen pipeline work:**
- Archivo: `packages/core/workspace-skills/eod-generator.js`
- Query pipeline sessions activas del agente
- Agregar como `[Pipeline] ProjectName — StageName` en array `inProgress`

**4b — Daily standup AI summary incluye pipeline:**
- Archivo: `apps/dashboard/server.js` — endpoint `/api/eod-reports/summarize`
- Query pipeline activity por departamento
- Inyectar sección `## Pipeline Activity` en context del LLM

**4c — Weekly report incluye pipeline summary:**
- Archivo: `apps/dashboard/server.js` — endpoint `/api/weekly-sessions/:id/report`
- Query pipelines activos del departamento con progreso
- Agregar `pipeline_summary` al report JSON

---

## Part B: Work Log Tab (Project Detail)

### Overview

Nueva tercera tab en project detail: **Details | Pipeline | Work Log**

Muestra el trabajo completado por cada agente en el pipeline del proyecto, organizado con sidebar de agentes a la izquierda y acordeones de contenido a la derecha.

### Componente: WorkLogTab.jsx

**Archivo nuevo:** `apps/dashboard/src/components/WorkLogTab.jsx`

**Props:** `{ projectId, pipeline, sessions, stages, agents }`

Recibe los mismos datos que ya tiene `ProjectPipelineView` (pipeline, sessions, stages, agents). No necesita fetch adicional — la data de deliverables ya viene en `sessions[].deliverables` y `sessions[].summary` del endpoint `GET /api/projects/:id/pipeline`.

**Verificación:** El endpoint `GET /api/projects/:id/pipeline` (server.js:5022-5054) ya devuelve sessions con `summary`, `summary_edited`, `deliverables` via `json_agg`. Confirmar que `deliverables` se incluye en el json_build_object del query.

### Layout

```
┌──────────────────────────────────────────────────┐
│  Details  │  Pipeline  │  Work Log               │
├──────────────────────────────────────────────────┤
│           │                                       │
│  🧠 Raul  │  Raul — Strategy & Brief              │
│  ✓ Done   │  Stage 0 · 2h 15m · 8 msgs           │
│           │                                       │
│  👨‍💻 Guille│  ┌─ 📋 Resumen ──────────── ▾ ──┐    │
│  ✓ Done   │  │ AI-generated summary text...  │    │
│           │  └───────────────────────────────┘    │
│  📅 Marti │  ┌─ 📦 Outputs & Assets (3) ─ ▾ ─┐   │
│  ✓ Done   │  │ • Strategy Brief              │   │
│           │  │ • KPI Targets                  │   │
│  🎯 Diego │  │ • Risk Assessment              │   │
│  ● Active │  └───────────────────────────────┘    │
│           │  ┌─ ⚡ Decisiones (4) ──── ▸ ──┐      │
│  ✍️ Lucia  │  └───────────────────────────────┘    │
│  ○ Pending│  ┌─ ❓ Pendientes (2) ──── ▸ ──┐      │
│           │  └───────────────────────────────┘    │
│  🎨 Sofia │  ┌─ 🔗 Handoff → Guillermo  ▸ ──┐    │
│  ○ Pending│  └───────────────────────────────┘    │
│           │  ┌─ 💬 Conversación (8) ── ▸ ──┐      │
│  +4 more  │  └───────────────────────────────┘    │
│           │                                       │
└──────────────────────────────────────────────────┘
```

### Sidebar de agentes

- Lista de agentes ordenados por `stage_order`
- Cada entry muestra: emoji del agente (de `agents` data) + nombre + stage name
- Status visual: Done = verde, Active = azul (puede tener pulse), Pending = gris/disabled
- Click en agente con status `completed` o `active` → carga su panel derecho
- Click en agente `pending` → no action (sin data)
- Default selection: primer agente con status `completed`, o el `active` si no hay completados

### Acordeones (panel derecho)

Cada sección es un acordeón colapsable. Iconos Lucide:

| Sección | Icono Lucide | Data source | Default |
|---------|-------------|-------------|---------|
| Resumen | `FileText` | `session.summary` o `session.summary_edited` | Abierto |
| Outputs & Assets | `Package` | `session.deliverables.deliverables[]` | Abierto |
| Decisiones | `Zap` | `session.deliverables.decisions_made[]` | Colapsado |
| Pendientes | `HelpCircle` | `session.deliverables.open_questions[]` | Colapsado |
| Handoff | `ArrowRight` | `session.deliverables.context_for_next` | Colapsado |
| Conversación | `MessageSquare` | Fetch `GET /api/projects/:id/sessions/:sessionId/messages` | Colapsado |

**Para agente activo (status === 'active'):**
- Mostrar chat en vivo (como `ProjectAgentChat` actual) como sección principal
- Debajo, acordeones parciales (solo lo que ya se ha generado, probablemente vacíos hasta handoff)

**Renderizado de contenido:**
- Todos los textos de summary y context_for_next → `renderMarkdown()`
- deliverables[] y decisions_made[] → lista con items
- open_questions[] → lista con items, color amber
- Conversación → mensajes con `renderMarkdown()` para assistant, texto plano para user

### Conversación lazy-load

El acordeón "Conversación" NO carga mensajes hasta que el usuario lo abre. Al expandir:
- Fetch `GET /api/projects/:projectId/sessions/:sessionId/messages`
- Renderizar como mini-chat (bubbles con role-based styling)
- Mostrar indicador de loading mientras carga

### Integración en App.jsx

- Agregar tercer tab "Work Log" al toggle (línea ~282)
- Renderizar `<WorkLogTab>` cuando `projectTab === 'worklog'`
- Solo visible si el proyecto tiene pipeline (`has_active_pipeline` o pipeline fetch)

---

## Part C: Agent View — Workflows Tab Enriquecida

### Overview

La tab Workflows en `GenericAgentView` se divide en 2 secciones:
1. **Tickets Activos** — lo que ya existe (`AgentPipelineTickets`)
2. **Trabajo Completado** — nuevo componente con historial

### Componente: AgentWorkHistory.jsx

**Archivo nuevo:** `apps/dashboard/src/components/agent-views/AgentWorkHistory.jsx`

**Props:** `{ agentId }`

### Nuevo endpoint

```
GET /api/agents/:agentId/pipeline-work
```

Query: sessions completadas del agente con deliverables, summary, project info:

```sql
SELECT pas.id, pas.stage_name, pas.stage_order, pas.summary, pas.deliverables,
       pas.started_at, pas.completed_at,
       p.name as project_name, p.id as project_id,
       ps.description as stage_description, ps.department
FROM project_agent_sessions pas
JOIN projects p ON p.id = pas.project_id
JOIN project_pipeline pp ON pas.pipeline_id = pp.id
JOIN pipeline_stages ps ON ps.pipeline_id = pp.id AND ps.stage_order = pas.stage_order
WHERE pas.agent_id = $1 AND pas.status = 'completed'
ORDER BY pas.completed_at DESC
```

### Card de trabajo completado

Cada card compacta muestra:
- **Project name** + stage name + duración (calculated from started_at → completed_at)
- **Summary** truncado a ~150 chars
- **Badges** con counts: `N outputs` (verde), `N decisions` (azul), `N pending` (amber)
- **Timestamp** relativo (hace 3d, hace 1w)
- **Click** → `window.dispatchEvent(new CustomEvent('navigate-to-pipeline', { detail: { projectId } }))` — navega al proyecto, que auto-seleccionará Work Log tab si tiene pipeline

### Integración en GenericAgentView

- Dentro de `activeTab === 'workflows'`:
  - Primero: `<AgentPipelineTickets>` (tickets activos, ya existe)
  - Label separator: "Trabajo Completado"
  - Segundo: `<AgentWorkHistory agentId={agent.id} />`

---

## i18n Keys

### ES (dentro de pipeline section)
```
workLog: 'Work Log',
workLogEmpty: 'Sin trabajo registrado en el pipeline',
outputs: 'Outputs & Assets',
decisions: 'Decisiones',
pendingQuestions: 'Pendientes',
handoffTo: 'Handoff a {name}',
fullConversation: 'Conversación completa',
messagesLabel: '{count} mensajes',
completedWork: 'Trabajo completado',
noCompletedWork: 'Sin trabajo completado en pipelines',
duration: '{time}',
outputsCount: '{count} outputs',
decisionsCount: '{count} decisiones',
pendingCount: '{count} pendientes',
```

### EN (matching)
```
workLog: 'Work Log',
workLogEmpty: 'No work logged in the pipeline',
outputs: 'Outputs & Assets',
decisions: 'Decisions',
pendingQuestions: 'Pending',
handoffTo: 'Handoff to {name}',
fullConversation: 'Full conversation',
messagesLabel: '{count} messages',
completedWork: 'Completed work',
noCompletedWork: 'No completed work in pipelines',
duration: '{time}',
outputsCount: '{count} outputs',
decisionsCount: '{count} decisions',
pendingCount: '{count} pending',
```

---

## Files Summary

### New files
| File | Purpose |
|------|---------|
| `apps/dashboard/src/components/WorkLogTab.jsx` | Work Log tab: sidebar + acordeones |
| `apps/dashboard/src/components/agent-views/AgentWorkHistory.jsx` | Agent completed work cards |

### Modified files
| File | Changes |
|------|---------|
| `apps/dashboard/src/components/ProjectAgentChat.jsx` | Fix 1: import + use renderMarkdown |
| `packages/core/db/schema.sql` | Fix 2: SQL migration department |
| `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` | Fix 3: dynamic count + integrate AgentWorkHistory |
| `packages/core/workspace-skills/eod-generator.js` | Fix 4a: pipeline in EOD |
| `apps/dashboard/server.js` | Fix 4b/4c: pipeline in standup/weekly + new endpoint GET /api/agents/:id/pipeline-work |
| `apps/dashboard/src/App.jsx` | Add Work Log tab toggle + render WorkLogTab |
| `apps/dashboard/src/i18n/translations.js` | New keys |
| `apps/dashboard/src/index.css` | CSS for WorkLogTab, acordeones, agent sidebar |

---

## Verification

1. Abrir pipeline chat → confirmar markdown renderizado (bold, listas, headers)
2. "Reactivate Preflight" aparece en kanban del departamento correcto (no "General")
3. Vista de Raul → tab Workflows muestra count > 0
4. Project detail → Work Log tab visible, sidebar muestra agentes con status correcto
5. Click en agente completado → acordeones muestran summary, outputs, decisiones
6. Acordeón "Conversación" → lazy-load mensajes al expandir
7. Agent view → Workflows → "Trabajo Completado" muestra cards con badges
8. Click en card completada → navega al proyecto
9. EOD report incluye `[Pipeline]` entries
10. Daily standup summary menciona pipeline activity
