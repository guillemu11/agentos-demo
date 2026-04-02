# Proyecto 006: Pipeline Visibility & Dashboard Integration

**Status:** Pendiente
**Fecha:** 2026-04-01
**Prioridad:** Alta — el pipeline (004) esta implementado pero invisible en el dashboard
**Prerequisito:** Proyecto 004 (pipeline backend + frontend components implementados)

---

## Problema

El ticket pipeline (proyecto 004) esta ~70% implementado: el backend crea pipelines, stages, sessions y tiene endpoints de handoff, chat, pause/resume, skip. Los componentes frontend (ProjectPipeline, ProjectAgentChat, HandoffModal, PipelineSelector) existen y funcionan. Sin embargo, **todo es invisible desde la experiencia principal del dashboard**:

1. El proyecto aparece en Command Center pero al entrar muestra fases/tasks vacias (tab "Details" por defecto)
2. El kanban muestra el proyecto como card pero sin tareas ni progreso de pipeline
3. No hay forma de ver stages asignados desde la vista de cada agente
4. No hay widget de pipelines activos en el Command Center
5. El chat por stage solo es accesible via Project Detail → Pipeline tab → Click stage (3 clicks)

**El usuario crea un proyecto con 10 stages de pipeline perfectamente definidos, pero el dashboard le muestra una pagina vacia.**

## Diagnostico: 6 Causas Raiz

### 1. Dos modelos de datos paralelos sin conexion

El endpoint `POST /api/inbox/:id/to-proyecto` (server.js:2136) crea **dos estructuras separadas** en una transaccion:

| Estructura | Fuente | Tablas | Donde se muestra |
|---|---|---|---|
| **Proyecto clasico** | `generateProject()` AI genera JSON | `projects → phases → tasks` | Tab "Details" |
| **Pipeline de agentes** | `draft.stages` del borrador | `project_pipeline → pipeline_stages → project_agent_sessions` | Tab "Pipeline" |

`generateProject()` (core.js:590) pide al LLM que genere un JSON con `phases[].functionalities[].tasks[]`, pero no hay schema enforcement (ni tool_use ni JSON schema). El LLM puede no producir `phases` en absoluto. `saveProject()` (save_project.js:56) solo crea phases/tasks si `data.phases` es array valido.

**Resultado**: proyecto se crea con 0 fases y 0 tareas. Tab "Details" vacio.

### 2. El tab por defecto es "Details", no "Pipeline"

App.jsx:282-291 muestra toggle "Details | Pipeline". El default es siempre `'details'`, que muestra las fases/tasks vacias. El pipeline (stages + sessions) SI se creo correctamente pero requiere click explicito en "Pipeline" tab. No hay indicacion visual de que el pipeline existe y esta activo.

### 3. El kanban NO integra pipeline stages

El kanban (PipelineBoard.jsx) llama a `GET /api/pipeline?department=X` (server.js:454). Este endpoint devuelve **proyectos por departamento** con conteo de tasks, NO pipeline stages. El proyecto aparece como card con `total_tasks: 0, done_tasks: 0`. No existe vista kanban de stages por departamento.

Ademas, el departamento del proyecto se guarda como "General" (default de saveProject), asi que al filtrar por departamento especifico no aparece.

### 4. No hay "mis tareas de pipeline" en agent views

GenericAgentView.jsx muestra la vista de cada agente. No existe seccion "Pipeline Tickets Asignados". Los `project_agent_sessions` se crean en DB con `agent_id`, pero ningun componente los consulta desde la perspectiva del agente. El endpoint `GET /api/agents/:agentId/active-sessions` esta especificado en 004 pero NO implementado.

### 5. Active Pipelines esta en Workflows, no en Command Center

WorkflowsHub.jsx:26-66 tiene `ActivePipelinesList` que llama a `/api/pipelines/active`. Este endpoint SI existe (server.js:5509) y devuelve pipelines activos con progreso. PERO esta en la pagina de Workflows, no en el Command Center ni en la home.

### 6. Pipeline chat funciona pero no es discoverable

- ProjectAgentChat.jsx — chat SSE con agente dentro de stage ✓
- HandoffModal.jsx — handoff con resumen AI ✓
- ProjectPipeline.jsx — timeline con stages ✓
- Endpoint `POST /api/projects/:id/sessions/:sessionId/chat` ✓

**Solo accesible via**: Project Detail → Pipeline tab → Click stage activo → Chat aparece. No hay forma de llegar desde kanban, vista de agente, o Command Center.

---

## Estado Actual del Pipeline (lo que SI funciona)

### Backend implementado:
- `POST /api/inbox/:id/to-proyecto` — creacion atomica de project + pipeline + stages + sessions
- `GET /api/projects/:id/pipeline` — pipeline completo con stages + sessions (single JOIN)
- `POST /api/projects/:id/pipeline/handoff` — handoff 2-fase (AI summary + atomic DB TX)
- `POST /api/projects/:id/pipeline/pause|resume` — control de pipeline
- `POST /api/projects/:id/pipeline/stages/:order/skip` — saltar stage
- `GET /api/projects/:id/sessions/:sessionId/messages` — mensajes paginados
- `POST /api/projects/:id/sessions/:sessionId/chat` — chat SSE por session
- `GET /api/pipelines/active` — overview de pipelines activos

### Frontend implementado:
- `ProjectPipelineView.jsx` — container con fetch + state + pause/resume
- `ProjectPipeline.jsx` — timeline vertical con stages, status, gates, handoff buttons
- `ProjectAgentChat.jsx` — chat streaming con contexto de stages previos
- `HandoffModal.jsx` — handoff con summary AI editable + confirmacion
- `PipelineSelector.jsx` — seleccion de template + editor de stages
- `pipelineTemplates.js` — 4 templates (campaign 10-stage, flash sale 5, seasonal 5, general 3)
- `ActivePipelinesList` en WorkflowsHub — lista de pipelines activos con progress bar

---

## Solucion: 5 Fases

### Fase 1: Fixes Inmediatos — Hacer visible lo que ya funciona

**Impacto: Alto | Esfuerzo: Bajo**

#### 1.1 Default a Pipeline tab cuando existe pipeline activo

**Archivo:** `apps/dashboard/src/App.jsx` ~linea 282

Logica: al seleccionar proyecto, hacer quick-check si tiene pipeline. Si si, `projectTab = 'pipeline'`.

```javascript
// En el useEffect o handler de seleccion de proyecto:
const checkPipeline = async (projectId) => {
    const res = await fetch(`${API_URL}/projects/${projectId}/pipeline`, { credentials: 'include' });
    if (res.ok) setProjectTab('pipeline');
    else setProjectTab('details');
};
```

#### 1.2 Asignar departamento correcto al proyecto desde draft

**Archivo:** `apps/dashboard/server.js` ~linea 2175

Extraer departamento del stage 0 del draft (el agente lider) y asignarlo al proyecto:

```javascript
// Antes de saveProject():
if (draft?.stages?.[0]?.department) {
    projectData.department = draft.stages[0].department;
}
```

#### 1.3 Badge "Pipeline activo" en project cards

**Archivo:** `apps/dashboard/src/App.jsx` ~linea 518 (grid de proyectos)
**Archivo:** `apps/dashboard/server.js` linea 360 (GET /api/projects)

Modificar query de projects para incluir flag:

```sql
SELECT p.*, 
    EXISTS(SELECT 1 FROM project_pipeline pp WHERE pp.project_id = p.id AND pp.status = 'active') as has_active_pipeline
FROM projects p ORDER BY created_at DESC
```

Mostrar badge en la card del proyecto.

#### 1.4 i18n para nuevas keys

**Archivo:** `apps/dashboard/src/i18n/translations.js`

Agregar keys: `pipeline.activeBadge`, `pipeline.assignedTickets`, `pipeline.noAssignedTickets`, etc.

---

### Fase 2: Integracion Kanban ↔ Pipeline

**Impacto: Alto | Esfuerzo: Medio**

#### 2.1 Nuevo endpoint: stages activos por departamento

**Archivo:** `apps/dashboard/server.js`

```
GET /api/pipeline/stages/active?department=X
```

```sql
SELECT ps.*, pas.status as session_status, pas.id as session_id,
       p.name as project_name, p.id as project_id,
       a.name as agent_name, a.emoji as agent_emoji
FROM pipeline_stages ps
JOIN project_pipeline pp ON ps.pipeline_id = pp.id
JOIN project_agent_sessions pas ON pas.pipeline_id = pp.id AND pas.stage_order = ps.stage_order
JOIN projects p ON pp.project_id = p.id
LEFT JOIN agents a ON ps.agent_id = a.id
WHERE pp.status = 'active'
  AND ps.department = $1
  AND pas.status IN ('active', 'pending')
ORDER BY pas.status DESC, ps.stage_order ASC
```

#### 2.2 Seccion "Pipeline Stages" en kanban

**Archivo:** `apps/dashboard/src/components/PipelineBoard.jsx`

Agregar seccion above o alongside el kanban de proyectos. Cards muestran:
- Nombre del proyecto + nombre del stage
- Agente asignado (emoji + nombre)
- Status (active con pulse, pending gris)
- Click → navega a Project Detail → Pipeline tab → stage seleccionado

#### 2.3 Progreso de pipeline en project cards del kanban

Modificar `GET /api/pipeline` para incluir conteo de pipeline stages:

```sql
-- Agregar al SELECT de projects en /api/pipeline:
(SELECT COUNT(*) FROM pipeline_stages ps JOIN project_pipeline pp ON ps.pipeline_id = pp.id WHERE pp.project_id = p.id) as pipeline_total,
(SELECT COUNT(*) FROM project_agent_sessions pas JOIN project_pipeline pp ON pas.pipeline_id = pp.id WHERE pp.project_id = p.id AND pas.status = 'completed') as pipeline_completed
```

Si `pipeline_total > 0`, mostrar barra de progreso de pipeline en vez de tasks.

---

### Fase 3: Agent View → Pipeline Tickets

**Impacto: Alto | Esfuerzo: Medio**

#### 3.1 Endpoint: sessions activas por agente

**Archivo:** `apps/dashboard/server.js`

```
GET /api/agents/:agentId/pipeline-sessions
```

```sql
SELECT pas.*, p.name as project_name, ps.description as stage_description,
       ps.gate_type, ps.depends_on,
       (SELECT COUNT(*) FROM pipeline_session_messages WHERE session_id = pas.id) as message_count
FROM project_agent_sessions pas
JOIN projects p ON pas.project_id = p.id
JOIN project_pipeline pp ON pas.pipeline_id = pp.id
JOIN pipeline_stages ps ON ps.pipeline_id = pp.id AND ps.stage_order = pas.stage_order
WHERE pas.agent_id = $1
  AND pp.status = 'active'
ORDER BY 
    CASE pas.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    pas.started_at DESC
```

#### 3.2 Seccion "Pipeline Tickets" en GenericAgentView

**Archivo:** `apps/dashboard/src/components/agent-views/GenericAgentView.jsx`

Nueva seccion despues de "Conversations" o en tab "Workflows" (que ya existe vacia):

```jsx
{pipelineSessions.map(session => (
    <div className="pipeline-ticket-card" onClick={() => navigateToStage(session)}>
        <span className="project-name">{session.project_name}</span>
        <span className="stage-name">[{session.stage_order}] {session.stage_name}</span>
        <span className={`pipeline-status-badge ${session.status}`}>{session.status}</span>
        {session.message_count > 0 && <span>{session.message_count} msgs</span>}
    </div>
))}
```

---

### Fase 4: Command Center Integration

**Impacto: Medio | Esfuerzo: Bajo**

#### 4.1 Widget Active Pipelines en Command Center

Extraer `ActivePipelinesList` de WorkflowsHub como componente independiente.
Agregar al layout principal del dashboard (homepage o projects page).
Click en pipeline → navega a proyecto → pipeline tab.

---

### Fase 5: Fix generateProject Output (Opcional)

**Impacto: Bajo | Esfuerzo: Medio**

El tab "Details" con phases/tasks es secondary cuando el pipeline existe. Dos opciones:

**Opcion A:** Generar phases/tasks desde draft.stages (sin LLM call extra)
- Cada stage se convierte en phase con una task "Execute stage: {description}"
- Elimina la necesidad de `generateProject()` que es unreliable

**Opcion B:** Usar tool_use con schema forzado en generateProject
- Define DRAFT_TOOL_SCHEMA para el output
- Garantiza JSON valido siempre

Recomendacion: **Opcion A** — mas simple, determinista, elimina LLM call extra.

---

## Verificacion

1. Crear proyecto via PM Agent → confirmar que aparece con badge "Pipeline activo" en grid
2. Abrir proyecto → verificar que Pipeline tab esta seleccionado por defecto y muestra stages + chat
3. Ir al kanban de departamento "strategic" → verificar que el proyecto aparece con progreso de pipeline
4. Ver stages activos del departamento en el kanban
5. Ir a vista de agente (e.g. Raul) → verificar que aparece "Stage 0: Strategy Brief" como tarea asignada
6. Click en tarea del agente → verificar que navega al proyecto → pipeline tab → stage correcto
7. Hacer handoff desde Stage 0 → verificar que stages paralelos se activan
8. Verificar en kanban y agent views que los nuevos stages activos aparecen

---

## Archivos Criticos

| Archivo | Cambios | Fase |
|---|---|---|
| `apps/dashboard/src/App.jsx` | Default pipeline tab, badge en card, navegacion | 1 |
| `apps/dashboard/server.js` | Dept fix, new endpoints, pipeline flag en queries | 1,2,3 |
| `apps/dashboard/src/components/PipelineBoard.jsx` | Pipeline stages section, progreso | 2 |
| `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` | Pipeline tickets section | 3 |
| `apps/dashboard/src/pages/WorkflowsHub.jsx` | Extraer ActivePipelinesList | 4 |
| `apps/dashboard/src/i18n/translations.js` | Nuevas keys i18n | 1-4 |
| `packages/core/pm-agent/core.js` | (Fase 5) generateProject fix | 5 |

## Estimacion de Codigo

| Fase | LOC aprox | Archivos |
|---|---|---|
| Fase 1 | ~80 | 3 |
| Fase 2 | ~150 | 2 |
| Fase 3 | ~120 | 2 |
| Fase 4 | ~40 | 2 |
| Fase 5 | ~60 | 1-2 |
| **Total** | **~450** | **6-7** |
