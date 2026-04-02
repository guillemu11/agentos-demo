# Proyecto 007: Project Details Tab — Match Draft Quality

**Status:** Pendiente
**Fecha:** 2026-04-01
**Prioridad:** Alta — el tab Details del proyecto creado muestra datos incompletos vs el draft
**Prerequisito:** Proyecto 006 (pipeline visibility implementado)

---

## Problema

El usuario prefiere la vista del draft (en PMAgentChat) sobre el tab Details del proyecto creado. El draft muestra datos ricos: objective, pm_notes, risks con mitigaciones, key_metrics, compliance_notes, target_audience, markets, bau_type, pipeline stages con reasoning y dependencias. Cuando `saveProject()` corre, la mayoría de esta data se **pierde** — solo 12 campos básicos se guardan en la tabla `projects`.

El tab Details del proyecto creado muestra:
- Budget y timeline (OK)
- Pain points, requirements, risks como strings planos (sin mitigaciones)
- Roadmap, success metrics, solution
- Phases/tasks (vacíos o generados genéricamente)

**Lo que falta vs el draft:**
- ❌ Objective (la visión estratégica del proyecto)
- ❌ PM Notes (comentario estratégico del PM Agent, markdown)
- ❌ Key Metrics (KPIs como tags)
- ❌ Compliance Notes (GDPR, brand, legal)
- ❌ Target Audience
- ❌ Markets (array de mercados)
- ❌ BAU Type
- ❌ Risks con mitigaciones (draft tiene `{risk, mitigation}`, Details solo strings)
- ❌ Pipeline Overview en estilo draft (con stage order, agent, department, description, reasoning, dependencies, namespaces, gates)

## Solución

### 1. Agregar columnas a la tabla projects

**Archivo:** `packages/core/db/schema.sql`

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bau_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS markets JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_notes TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS key_metrics JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS compliance_notes JSONB DEFAULT '[]';
```

### 2. Guardar nuevos campos en saveProject()

**Archivo:** `packages/core/db/save_project.js`

Modificar INSERT (línea 33) y UPDATE (línea 117) para incluir los 7 nuevos campos.

### 3. Pasar datos del draft a saveProject en to-proyecto

**Archivo:** `apps/dashboard/server.js` — POST `/api/inbox/:id/to-proyecto` (~línea 2310)

Antes de `saveProject()`, mergear campos del draft a projectData:
```javascript
if (draft) {
    if (draft.objective && !projectData.objective) projectData.objective = draft.objective;
    if (draft.target_audience) projectData.target_audience = draft.target_audience;
    if (draft.bau_type) projectData.bau_type = draft.bau_type;
    if (draft.markets) projectData.markets = draft.markets;
    if (draft.pm_notes) projectData.pm_notes = draft.pm_notes;
    if (draft.key_metrics) projectData.key_metrics = draft.key_metrics;
    if (draft.compliance_notes) projectData.compliance_notes = draft.compliance_notes;
    if (draft.risks) projectData.risks = draft.risks;
}
```

### 4. Rediseñar Details tab para igualar calidad del draft

**Archivo:** `apps/dashboard/src/App.jsx` — líneas 320-505

Reemplazar el tab Details actual con un layout que refleja el estilo visual del draft de PMAgentChat.jsx (líneas 352-620):

1. **Overview card**: objective, target_audience, bau_type, markets, estimated_timeline, estimated_budget
2. **PM Notes**: renderizado con renderMarkdown() — igual que draft líneas 442-449
3. **Pipeline Overview (read-only)**: Mismo estilo visual que el "Proposed Pipeline" del draft (PMAgentChat.jsx líneas 452-535). Mismas clases CSS (`draft-stage-row`, `draft-stage-order`, `draft-stage-body`, etc.) pero **read-only** (sin botones de edición). Muestra:
   - Stage order badge + stage name + agent name (con avatar emoji) + department badge
   - Description
   - Reasoning (italic, texto secundario)
   - Dependency tags + namespace tags
   - Gate lock icon si human_approval
   - Datos de: `GET /api/projects/:id/pipeline` (stages + agents)
4. **3-column grid**: pain_points, requirements, risks (con mitigaciones como pares {risk, mitigation})
5. **Key Metrics**: tag chips
6. **Compliance Notes**: cards estilo amber
7. **Roadmap**: future_improvements grid
8. **Success Metrics**: lista
9. **Proposed Solution**: bloque markdown
10. **Dynamic Blocks**: BlockRenderer existente
11. **Phases & Tasks**: rendering existente de fases/tareas

**Mejora clave para risks:** El draft tiene `[{risk, mitigation}]`. El Details tab debe renderizar ambos formatos:
- Si `risk` es string → mostrar como antes
- Si `risk` es objeto `{risk, mitigation}` → mostrar par risk + mitigación

**Fetch de pipeline:** El Details tab necesita datos de pipeline stages + agents. Agregar useEffect que fetch `GET /api/projects/:id/pipeline` cuando se carga el tab. Reusar las clases CSS de PMAgentChat para consistencia visual.

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `packages/core/db/schema.sql` | 7 ALTER TABLE para nuevas columnas |
| `packages/core/db/save_project.js` | Guardar 7 campos nuevos en INSERT + UPDATE |
| `apps/dashboard/server.js` | Mergear campos del draft antes de saveProject |
| `apps/dashboard/src/App.jsx` | Rediseñar Details tab con overview, pm_notes, pipeline read-only, key_metrics, compliance, risks ricos |

## Verificación

1. Crear proyecto desde draft del PM Agent → Details tab muestra objective, pm_notes, key_metrics, compliance
2. Pipeline Overview muestra stages con agentes, departamentos, reasoning, dependencias (estilo draft)
3. Risks muestran risk + mitigación (no solo string)
4. Proyectos existentes siguen renderizando correctamente (nuevas columnas default null/vacío)
5. Edit mode sigue funcionando para campos editables
