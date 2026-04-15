# Campaign Manager Email Brief Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dotar al Campaign Manager (Raul) de un protocolo de briefing guiado que defina `email_spec` antes de que Content Agent y HTML Developer ejecuten, con un card visual en el agent view y evento en el worklog.

**Architecture:** Raul emite `[EMAIL_SPEC_UPDATE:{...}]` al final del briefing → el servidor lo intercepta, persiste en `projects.email_spec` y emite `[BRIEF_ARTIFACT:{...}]` vía SSE → el frontend renderiza un `EmailBriefCard` en la tab Active Campaigns y añade un evento al Activity feed.

**Tech Stack:** React 19, Express 5, PostgreSQL 16 (jsonb_merge), SSE streaming, Anthropic SDK

---

## File Map

| Acción | Archivo | Qué cambia |
|--------|---------|-----------|
| Modify | `packages/core/agents/profiles.js` | Añadir EMAIL BRIEF PROTOCOL a `raul.personality` |
| Modify | `apps/dashboard/server.js` | (1) Añadir `projectId` al body del endpoint; (2) parsear `[EMAIL_SPEC_UPDATE]`; (3) emitir `[BRIEF_ARTIFACT]` SSE |
| Modify | `apps/dashboard/src/hooks/useStreamingChat.js` | Parsear `[BRIEF_ARTIFACT]` en el stream y llamar `onStreamEvent` |
| Create | `apps/dashboard/src/components/EmailBriefCard.jsx` | Nuevo componente — card visual del email spec |
| Modify | `apps/dashboard/src/components/agent-views/CampaignManagerView.jsx` | Renderizar EmailBriefCard en campaigns + evento en activity feed |
| Modify | `apps/dashboard/src/i18n/translations.js` | Añadir claves `campaignManager.brief.*` en ES y EN |

---

## Task 1: Raul's Email Brief Protocol — System Prompt

**Files:**
- Modify: `packages/core/agents/profiles.js:14-20`

- [ ] **Step 1: Leer el archivo actual**

```bash
# Verificar el contenido actual de raul.personality
grep -n "raul:" packages/core/agents/profiles.js
```

- [ ] **Step 2: Reemplazar `raul.personality` con el protocolo de briefing**

En `packages/core/agents/profiles.js`, reemplazar el bloque `raul: { ... }` con:

```javascript
raul: {
    voiceName: 'Orus',
    ragNamespaces: ['campaigns', 'kpis', 'research'],
    personality: `You are strategic, decisive, and results-oriented. You think in terms of campaign lifecycles, KPI targets, and stakeholder alignment. You speak with authority but remain collaborative — you're the team captain, not a dictator. You often reference metrics, timelines, and industry benchmarks. When uncertain, you propose structured approaches rather than guessing. You naturally frame conversations around objectives, audiences, and measurable outcomes.

## EMAIL BRIEF PROTOCOL

Whenever you are working on a project that involves email (campaign, newsletter, reactivation, promotional, transactional) and the email_spec provided in context has no blocks defined yet (blocks array is empty or missing), you MUST run the email brief flow BEFORE discussing execution or assigning agents.

The brief flow has a maximum of 4 turns. Ask ONE question per message:

Turn 1 — Email type & objective:
  Ask: What type of email is this and what is the primary goal?
  (e.g., promotional, reactivation, transactional, nurture — and the specific outcome: bookings, opens, revenue)

Turn 2 — Structure & sections:
  Ask: What are the main sections this email needs?
  (e.g., hero banner, flight offer, price table, CTA, footer — approximate is fine, HTML Developer will refine)

Turn 3 — Tone & restrictions:
  Ask: What tone should this email have, and are there any content restrictions?
  (e.g., reassuring not pushy, no discounts mentioned, legal disclaimer required)

Turn 4 — Key variables:
  Ask: What personalizable variables will this email need?
  (e.g., passenger name, destination, fare price, departure date — approximate is fine)

After receiving the answer to Turn 4, synthesize everything into a structured email spec and emit the following tag on its own line:

[EMAIL_SPEC_UPDATE:{"design_notes":"<tone + objective summary in one sentence>","blocks":[{"name":"<block_name>","guidance":"<what this block should achieve>","variables":["@var1","@var2"]}],"variable_list":["@var1","@var2"],"variable_context":{"@var1":"<description of what this variable holds>"}}]

After emitting the tag, present a brief summary in markdown (NOT the raw JSON) showing the blocks and key variables so the user can read it naturally in chat. Format it as:

**Email Brief definido:**
- **Objetivo:** <one line>
- **Bloques:** hero, offer_details, cta, footer
- **Variables:** @headline, @fare_from, @destination
- **Tono:** <one line>

If email_spec already has blocks defined (blocks array has 1+ items), do NOT run the flow. Instead, acknowledge the existing spec briefly and continue with the user's request. Offer to revise only if the user asks.

The spec is a starting point — Content Agent and HTML Developer can extend it with new blocks or variables during execution.`,
    voiceRules: `Be direct and strategic. Summarize data rather than listing it. End with a clear recommendation or next step when possible. Max 2-3 sentences.`,
    customTools: [],
},
```

- [ ] **Step 3: Verificar sintaxis del archivo**

```bash
node -e "require('./packages/core/agents/profiles.js'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add packages/core/agents/profiles.js
git commit -m "feat(campaign-manager): add EMAIL BRIEF PROTOCOL to Raul system prompt"
```

---

## Task 2: i18n — Añadir claves de traducción

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Añadir claves en español**

Buscar el bloque `campaignManager:` en la sección `es:` y añadir al final del objeto (antes del cierre `}`):

```javascript
// Añadir después de campaignPerformance: 'Rendimiento de Campañas',
brief: {
  pending: 'Brief pendiente',
  definedBy: 'Definido por Raul',
  defineWithRaul: 'Definir con Raul',
  objective: 'Objetivo',
  blocks: 'Bloques',
  variables: 'Variables',
  tone: 'Tono',
  updated: 'Raul ha definido el email brief',
},
```

- [ ] **Step 2: Añadir claves en inglés**

Buscar el bloque `campaignManager:` en la sección `en:` y añadir al final del objeto:

```javascript
// Añadir después de campaignPerformance: 'Campaign Performance',
brief: {
  pending: 'Brief pending',
  definedBy: 'Defined by Raul',
  defineWithRaul: 'Define with Raul',
  objective: 'Objective',
  blocks: 'Blocks',
  variables: 'Variables',
  tone: 'Tone',
  updated: 'Raul has defined the email brief',
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(campaign-manager): add campaignManager.brief i18n keys"
```

---

## Task 3: EmailBriefCard — Nuevo componente

**Files:**
- Create: `apps/dashboard/src/components/EmailBriefCard.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function EmailBriefCard({ emailSpec, onDefineClick, briefDate }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const hasBlocks = emailSpec?.blocks?.length > 0;

  if (!hasBlocks) {
    return (
      <div className="email-brief-card email-brief-card--pending">
        <span className="email-brief-pending-label">
          <FileText size={13} />
          {t('campaignManager.brief.pending')}
        </span>
        <button
          className="email-brief-define-btn"
          onClick={onDefineClick}
        >
          {t('campaignManager.brief.defineWithRaul')} →
        </button>
      </div>
    );
  }

  const blocks = emailSpec.blocks || [];
  const variables = emailSpec.variable_list || [];
  const designNotes = emailSpec.design_notes || '';

  return (
    <div className="email-brief-card">
      <button
        className="email-brief-card__header"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="email-brief-card__title">
          <FileText size={14} />
          Email Brief
        </span>
        <span className="email-brief-card__meta">
          {t('campaignManager.brief.definedBy')}
          {briefDate ? ` · ${new Date(briefDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="email-brief-card__body">
          {designNotes && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.objective')}</span>
              <span className="email-brief-card__value">{designNotes}</span>
            </div>
          )}

          {blocks.length > 0 && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.blocks')}</span>
              <div className="email-brief-card__tags">
                {blocks.map(b => (
                  <span key={b.name} className="brief-variant-tag">{b.name}</span>
                ))}
              </div>
            </div>
          )}

          {variables.length > 0 && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.variables')}</span>
              <div className="email-brief-card__tags">
                {variables.map(v => (
                  <span key={v} className="brief-variant-tag brief-variant-tag--var">{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Añadir estilos en index.css**

Buscar la sección `.brief-variant-tag` en `apps/dashboard/src/index.css` y añadir después:

```css
/* Email Brief Card — CampaignManagerView */
.email-brief-card {
  margin-top: 12px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-main);
  overflow: hidden;
}
.email-brief-card--pending {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; gap: 8px;
}
.email-brief-pending-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.78rem; color: var(--text-muted);
}
.email-brief-define-btn {
  font-size: 0.78rem; color: var(--primary); background: none;
  border: none; cursor: pointer; padding: 0;
}
.email-brief-define-btn:hover { opacity: 0.7; }
.email-brief-card__header {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 9px 12px; background: none; border: none; cursor: pointer;
  font-size: 0.82rem; color: var(--text-primary); text-align: left;
}
.email-brief-card__header:hover { background: var(--bg-hover); }
.email-brief-card__title {
  display: flex; align-items: center; gap: 5px; font-weight: 600; flex: 1;
}
.email-brief-card__meta {
  font-size: 0.75rem; color: var(--text-muted);
}
.email-brief-card__body {
  padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px;
  border-top: 1px solid var(--border-light);
}
.email-brief-card__row {
  display: flex; flex-direction: column; gap: 4px;
}
.email-brief-card__label {
  font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
}
.email-brief-card__value {
  font-size: 0.82rem; color: var(--text-primary); line-height: 1.4;
}
.email-brief-card__tags {
  display: flex; flex-wrap: wrap; gap: 5px;
}
.brief-variant-tag--var {
  font-family: monospace; font-size: 0.75rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/EmailBriefCard.jsx apps/dashboard/src/index.css
git commit -m "feat(campaign-manager): add EmailBriefCard component and styles"
```

---

## Task 4: Server — Parsear EMAIL_SPEC_UPDATE y emitir BRIEF_ARTIFACT

**Files:**
- Modify: `apps/dashboard/server.js` (endpoint `/api/chat/agent/:agentId`)

- [ ] **Step 1: Añadir `projectId` al request body**

En el handler de `/api/chat/agent/:agentId`, buscar la línea donde se desestructura `req.body` (alrededor de línea 2907). Añadir `projectId` a la desestructuración:

```javascript
// Antes (aproximado):
const { message, messages: historyMessages, activeBlock, canvasBlockNames } = req.body;

// Después:
const { message, messages: historyMessages, activeBlock, canvasBlockNames, projectId } = req.body;
```

- [ ] **Step 2: Inyectar email_spec en el system prompt si hay projectId**

Después de construir `systemPrompt` (buscar donde se hace `let systemPrompt = ...` o la última línea que añade a systemPrompt), añadir:

```javascript
// Inject email_spec context for campaign-aware agents (e.g. raul)
if (projectId) {
  try {
    const projRes = await pool.query('SELECT email_spec FROM projects WHERE id = $1', [projectId]);
    const emailSpec = projRes.rows[0]?.email_spec;
    if (emailSpec) {
      const hasBlocks = emailSpec.blocks?.length > 0;
      systemPrompt += `\n\n## Current Project Email Spec\n`;
      systemPrompt += `blocks_defined: ${hasBlocks}\n`;
      if (hasBlocks) {
        systemPrompt += `blocks: ${emailSpec.blocks.map(b => b.name).join(', ')}\n`;
        systemPrompt += `design_notes: ${emailSpec.design_notes || 'none'}\n`;
        systemPrompt += `variable_list: ${(emailSpec.variable_list || []).join(', ')}\n`;
      }
    }
  } catch (e) {
    console.warn('[agent-chat] Could not load email_spec for project', projectId, e.message);
  }
}
```

- [ ] **Step 3: Parsear `[EMAIL_SPEC_UPDATE]` tras completar el stream**

Buscar la línea `await stream.finalMessage()` (alrededor de línea 3107). Inmediatamente después, añadir:

```javascript
// Parse EMAIL_SPEC_UPDATE tag emitted by Raul
const emailSpecTagMatch = fullResponse.match(/\[EMAIL_SPEC_UPDATE:(\{[\s\S]*?\})\]/);
if (emailSpecTagMatch && projectId) {
  try {
    const specUpdate = JSON.parse(emailSpecTagMatch[1]);

    // Non-destructive merge into projects.email_spec
    await pool.query(
      `UPDATE projects
       SET email_spec = email_spec || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify(specUpdate), projectId]
    );

    // Record event in agent_events or pipeline_events if table exists
    try {
      await pool.query(
        `INSERT INTO pipeline_events (project_id, event_type, content, created_by)
         VALUES ($1, 'brief_created', $2::jsonb, $3)`,
        [projectId, JSON.stringify({ spec: specUpdate, agent: agentId }), agentId]
      );
    } catch (evErr) {
      // pipeline_events table may not exist — log and continue
      console.warn('[agent-chat] Could not insert pipeline_event:', evErr.message);
    }

    // Emit BRIEF_ARTIFACT SSE event to frontend
    const artifactPayload = {
      briefArtifact: {
        spec: specUpdate,
        timestamp: new Date().toISOString(),
        agentId,
        projectId,
        blocksCount: specUpdate.blocks?.length || 0,
        variablesCount: specUpdate.variable_list?.length || 0,
      }
    };
    res.write(`data: ${JSON.stringify(artifactPayload)}\n\n`);

    console.log(`[agent-chat] EMAIL_SPEC_UPDATE persisted for project ${projectId}: ${specUpdate.blocks?.length} blocks`);
  } catch (parseErr) {
    console.error('[agent-chat] Failed to parse EMAIL_SPEC_UPDATE:', parseErr.message);
  }

  // Strip the tag from the displayed response (don't show raw JSON to user)
  fullResponse = fullResponse.replace(/\[EMAIL_SPEC_UPDATE:\{[\s\S]*?\}\]/, '').trim();
}
```

- [ ] **Step 4: Reiniciar el servidor y verificar que arranca sin errores**

```bash
npm start
```

Expected: Vite en 4000, Express en 3001, sin errores de sintaxis.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(campaign-manager): parse EMAIL_SPEC_UPDATE tag and emit BRIEF_ARTIFACT SSE in agent chat endpoint"
```

---

## Task 5: Frontend — Parsear BRIEF_ARTIFACT en useStreamingChat

**Files:**
- Modify: `apps/dashboard/src/hooks/useStreamingChat.js`

- [ ] **Step 1: Añadir handler para `parsed.briefArtifact` en el loop SSE**

Buscar el bloque `if (parsed.text)` en el while loop (alrededor de línea 91) y añadir un nuevo `else if` después:

```javascript
} else if (parsed.briefArtifact) {
  if (onStreamEvent) {
    onStreamEvent({ type: 'brief_artifact', payload: parsed.briefArtifact });
  }
}
```

El bloque completo quedará:

```javascript
if (parsed.error) {
  // ... existing error handler
} else if (parsed.html_sources) {
  // ... existing html_sources handler
} else if (parsed.text) {
  fullResponse += parsed.text;
  // ... existing text handler
} else if (parsed.briefArtifact) {
  if (onStreamEvent) {
    onStreamEvent({ type: 'brief_artifact', payload: parsed.briefArtifact });
  }
}
if (parsed.handoff_suggestion && onStreamEvent) {
  onStreamEvent(parsed);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/hooks/useStreamingChat.js
git commit -m "feat(campaign-manager): handle briefArtifact SSE event in useStreamingChat"
```

---

## Task 6: CampaignManagerView — Renderizar EmailBriefCard y Activity event

**Files:**
- Modify: `apps/dashboard/src/components/agent-views/CampaignManagerView.jsx`

- [ ] **Step 1: Añadir imports**

Al inicio del archivo, añadir:

```javascript
import { useState, useCallback } from 'react';
import EmailBriefCard from '../EmailBriefCard';
```

(Si `useState` ya está importado de React, solo añadir `useCallback` si no existe. Añadir la línea de `EmailBriefCard`.)

- [ ] **Step 2: Añadir estado local para email_spec y activity events**

Después de la línea `const recentEvents = agent.recent_events || [];`, añadir:

```javascript
const [emailSpecByProject, setEmailSpecByProject] = useState({});
const [localEvents, setLocalEvents] = useState([]);

const allEvents = [...(agent.recent_events || []), ...localEvents]
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
```

- [ ] **Step 3: Añadir handler para brief_artifact SSE**

Añadir la función handler que recibirá el evento del chat:

```javascript
const handleBriefArtifact = useCallback((payload) => {
  const { spec, projectId, timestamp, blocksCount, variablesCount } = payload;

  // Update email spec for this project
  setEmailSpecByProject(prev => ({ ...prev, [projectId]: { spec, timestamp } }));

  // Add activity event
  setLocalEvents(prev => [{
    id: `brief-${Date.now()}`,
    timestamp,
    event_type: 'brief_created',
    content: `${t('campaignManager.brief.updated')} — ${blocksCount} bloques, ${variablesCount} variables`,
  }, ...prev]);
}, [t]);
```

- [ ] **Step 4: Pasar `onStreamEvent` al componente de chat**

Buscar en el JSX donde se renderiza la tab `chat` (el `AgentChatSwitcher` o `AgentChat`). Añadir un handler:

```javascript
{activeTab === 'chat' && (
  <AgentChatSwitcher
    agent={agent}
    onStreamEvent={(event) => {
      if (event.type === 'brief_artifact') {
        handleBriefArtifact(event.payload);
      }
    }}
  />
)}
```

Si el componente de chat no acepta `onStreamEvent`, verificar cómo está conectado y pasar el prop hasta `useStreamingChat`.

- [ ] **Step 5: Renderizar EmailBriefCard en cada campaign card**

Buscar el bloque que mapea `data.campaigns` (alrededor de línea 95) y añadir `EmailBriefCard` al final de cada campaign card, antes del cierre del `</div>`:

```javascript
{data.campaigns.map((campaign) => {
  const projectId = campaign.projectId || campaign.id;
  const briefData = emailSpecByProject[projectId];
  const emailSpec = briefData?.spec || campaign.email_spec;

  return (
    <div key={campaign.id} className="card animate-fade-in" style={{ padding: '20px' }}>
      {/* ... existing campaign card content (name, phases, agents, metrics) ... */}

      <EmailBriefCard
        emailSpec={emailSpec}
        briefDate={briefData?.timestamp}
        onDefineClick={() => setActiveTab('chat')}
      />
    </div>
  );
})}
```

- [ ] **Step 6: Actualizar el Activity tab para usar `allEvents`**

Buscar `recentEvents.length > 0` en el render de la tab Activity y reemplazar con `allEvents`:

```javascript
{activeTab === 'activity' && (
  <div className="agent-activity-feed">
    {allEvents.length > 0 ? (
      allEvents.map((event, i) => (
        <div key={event.id || i} className="activity-item animate-fade-in">
          <div className="activity-time">
            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </div>
          <div className={`activity-dot ${
            event.event_type === 'task_complete' ? 'success' :
            event.event_type === 'error' ? 'warning' :
            event.event_type === 'brief_created' ? 'info' : 'info'
          }`}></div>
          <div className="activity-message">
            {typeof event.content === 'string' ? event.content : event.content?.message || event.content?.summary || event.event_type}
          </div>
        </div>
      ))
    ) : (
      <div className="empty-state">{t('agentDetail.noActivity')}</div>
    )}
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/components/agent-views/CampaignManagerView.jsx
git commit -m "feat(campaign-manager): render EmailBriefCard in campaigns tab and handle BRIEF_ARTIFACT activity event"
```

---

## Task 7: Pasar `projectId` desde el frontend al endpoint

**Files:**
- Modify: `apps/dashboard/src/components/AgentChat.jsx` (o el componente que llama a `/api/chat/agent/:agentId`)

- [ ] **Step 1: Verificar cómo se llama el endpoint**

Buscar en `AgentChat.jsx` o `useStreamingChat.js` la llamada a `/api/chat/agent/`. Verificar qué body se envía actualmente.

- [ ] **Step 2: Añadir `projectId` al body del fetch**

En la llamada fetch al endpoint `/api/chat/agent/:agentId`, añadir `projectId` al body si está disponible:

```javascript
body: JSON.stringify({
  message,
  messages: conversationHistory,
  activeBlock,
  canvasBlockNames,
  projectId: activeProjectId || ticket?.project_id || null, // añadir esta línea
}),
```

El `projectId` debe venir del contexto del ticket activo o del prop del componente. Si `AgentChat` recibe un `ticket` prop, usar `ticket.project_id`. Si recibe un `projectId` prop directamente, usarlo.

- [ ] **Step 3: Verificar que `CampaignManagerView` pasa el ticket o projectId al chat**

En `CampaignManagerView`, cuando se renderiza el componente de chat, asegurarse de pasar el `projectId` del campaign seleccionado:

```javascript
{activeTab === 'chat' && (
  <AgentChatSwitcher
    agent={agent}
    projectId={selectedCampaign?.projectId}
    onStreamEvent={(event) => {
      if (event.type === 'brief_artifact') {
        handleBriefArtifact(event.payload);
      }
    }}
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/AgentChat.jsx apps/dashboard/src/components/agent-views/CampaignManagerView.jsx
git commit -m "feat(campaign-manager): pass projectId to agent chat endpoint for email_spec context"
```

---

## Task 8: Verificación End-to-End

- [ ] **Step 1: Reiniciar el servidor**

```bash
npm start
```

- [ ] **Step 2: Verificar que Raul tiene el protocolo en su personality**

```bash
node -e "const p = require('./packages/core/agents/profiles.js'); console.log(p.raul.personality.includes('EMAIL BRIEF PROTOCOL') ? 'OK' : 'MISSING')"
```

Expected: `OK`

- [ ] **Step 3: Abrir el Campaign Manager y chatear con Raul**

1. Ir a un agente con id `raul` en la UI
2. En la tab Chat, escribir: "Tengo una campaña de reactivación para pasajeros Emirates"
3. Verificar que Raul pregunta sobre tipo/objetivo del email (Turn 1)
4. Responder las 4 preguntas
5. Al final, verificar que el response contiene el resumen markdown del brief (NO el JSON crudo)

- [ ] **Step 4: Verificar persistencia en DB**

```bash
# Conectar a PostgreSQL (puerto 5434)
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d agentOS -c "SELECT id, name, email_spec FROM projects ORDER BY updated_at DESC LIMIT 3;"
```

Expected: el proyecto activo tiene `email_spec` con `blocks` y `design_notes` poblados.

- [ ] **Step 5: Verificar EmailBriefCard en la UI**

1. Ir a Campaign Manager → tab Active Campaigns
2. El campaign card debe mostrar la `EmailBriefCard` con los bloques y variables definidos por Raul
3. Click en el header del card → debe expandir/colapsar

- [ ] **Step 6: Verificar Activity feed**

1. Ir a Campaign Manager → tab Activity
2. Debe aparecer un evento "Raul ha definido el email brief — N bloques, N variables" con timestamp

- [ ] **Step 7: Verificar que HTML Developer recibe el spec**

1. Abrir Email Studio para el mismo proyecto
2. Enviar cualquier mensaje al HTML Developer
3. Verificar en logs del servidor que el system prompt incluye los bloques definidos por Raul

```bash
# Añadir temporalmente un console.log en server.js para verificar:
# console.log('[html-dev] systemPrompt blocks:', emailSpec?.blocks?.map(b => b.name));
```

---

## Notas de implementación

### pipeline_events table
El Task 4 intenta insertar en `pipeline_events`. Si esta tabla no existe en el schema, el error es capturado y logueado — no bloquea el flujo. Para activarlo completamente, verificar si existe con:

```sql
SELECT tablename FROM pg_tables WHERE tablename = 'pipeline_events';
```

Si no existe, la funcionalidad de worklog persistente en DB queda para una iteración futura. El Activity feed local en frontend funciona independientemente.

### Regex para EMAIL_SPEC_UPDATE
El regex `\[EMAIL_SPEC_UPDATE:(\{[\s\S]*?\})\]` usa un grupo de captura no-greedy sobre `\{...\}`. Si el JSON tiene llaves anidadas, el `?` puede truncar. Si ocurre, usar regex greedy con un enfoque de balanceo de llaves o confiar en que el LLM emite el JSON en una sola línea compacta (el system prompt lo indica así).

### AgentChatSwitcher vs AgentChat
Verificar si `CampaignManagerView` usa `AgentChatSwitcher` o `AgentChat` directamente. Si usa `AgentChatSwitcher`, verificar que ese componente pasa `onStreamEvent` y `projectId` hacia abajo hasta `useStreamingChat`.
