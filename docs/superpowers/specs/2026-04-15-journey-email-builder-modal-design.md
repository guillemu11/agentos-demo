# Journey Email Builder Modal — Design Spec
**Date:** 2026-04-15  
**Status:** Approved  

---

## Context

The Journey Builder canvas has `EmailSendNode` nodes that currently display email metadata read-only. To deploy a journey, each `email_send` activity requires a valid `mc_email_id` (a Salesforce Marketing Cloud email ID). Today, users must build that email separately in the BAU campaign builder, then manually wire the ID into the journey — a fragmented workflow.

This spec adds a **click-to-build** experience: clicking an `EmailSendNode` opens a modal where users can create the email inline via a brief form + iterative chat, with the resulting `mc_email_id` automatically written back to the journey node.

---

## Architecture

```
JourneyBuilderPage
├── JourneyCanvas (ReactFlow)
│   └── EmailSendNode ──onNodeClick──► abre EmailBuilderModal
├── JourneyBuilderChat (sin cambios)
└── EmailBuilderModal (NUEVO)
    ├── Phase 1: EmailBriefForm
    └── Phase 2: EmailPreviewChat
        ├── Preview (iframe sandboxed)
        └── Chat iterativo (SSE)
```

**State flow:**
1. `onNodeClick(node)` en `JourneyBuilderPage` → si `node.data.type === 'email_send'` → `setEmailBuilderNode(node)`
2. `EmailBuilderModal` monta con `{ journeyId, activityId, currentData }`
3. Brief form → `POST /api/journeys/:id/activities/:actId/email/build` → SSE
4. Preview + refinements via `POST .../email/refine`
5. "Use this email" → llama `update_activity` tool del agente Journey existente con `{ mc_email_id, email_shell_name }` → cierra modal → nodo se actualiza con highlight animado

Modal state es local a `JourneyBuilderPage` — mismo patrón que `CreateJourneyModal`.

---

## UI/UX

**Modal sizing:** ~80vw × 85vh, mismo overlay/scrim que `CreateJourneyModal`.

### Phase 1 — Brief Form
```
┌─────────────────────────────────────────────────────┐
│  ✉ Build Email — [email_shell_name]          [✕]    │
├─────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Campaign Type │  │  Market    │  │  Language  │  │
│  └───────────────┘  └────────────┘  └────────────┘  │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Brief (textarea)                               │ │
│  └─────────────────────────────────────────────────┘ │
│  [Generate Email ▶]                                  │
└─────────────────────────────────────────────────────┘
```

### Phase 2 — Preview + Chat
```
┌─────────────────────────────────────────────────────┐
│  ✉ Build Email — [email_shell_name]                 │
├────────────────────┬────────────────────────────────┤
│  Preview (iframe)  │  Chat de ajustes               │
│                    │  > "el header muy largo"       │
│  [HTML renderizado]│  > regenerando...              │
│                    │  ─────────────────────────     │
│                    │  [input mensaje]  [→]          │
└────────────────────┴────────────────────────────────┘
│                    [✓ Use this email]                │
└─────────────────────────────────────────────────────┘
```

**Behaviour details:**
- Phase 1 colapsa cuando empieza la generación — modal "avanza" a Phase 2
- `<iframe sandbox="allow-same-origin">` para aislar HTML del email
- Chat iterativo envía solo el mensaje + HTML actual — no regenera todo el email
- Escape / `[✕]` disponibles en Phase 1; en Phase 2 requieren confirmación "¿cancelar sin guardar?"
- "Use this email" cierra modal y aplica highlight `journey-node--newly-added` en el nodo actualizado

---

## Backend

### Nuevo endpoint: Generate
```
POST /api/journeys/:journeyId/activities/:actId/email/build
Body: { campaign_type, market, language, brief }

SSE stream:
  { type: "status",  message: "Fetching template..." }
  { type: "status",  message: "Filling content blocks..." }
  { type: "status",  message: "Generating images..." }
  { type: "result",  html: "...", mc_email_id: 123, email_shell_name: "..." }
  { type: "error",   message: "..." }
```

### Nuevo endpoint: Refine
```
POST /api/journeys/:journeyId/activities/:actId/email/refine
Body: { message, currentHtml }

SSE stream:
  { type: "status",  message: "Refining..." }
  { type: "result",  html: "..." }  // solo actualiza HTML, mc_email_id sin cambio
```

### Reutilización del pipeline BAU
- `phase-a-prepare.js` → extraer lógica core a función pura `generateEmailFromBrief({ templateAssetId, market, language, brief })` desacoplada de `buildId`
- `shells.js → createEmailShells()` sin cambios — recibe `campaign_type` para resolver `templateAssetId`
- `mc-api/client.js` sin cambios
- Mutación del DSL vía `update_activity` tool del agente Journey existente — sin endpoint nuevo para esta parte

---

## Critical Files

| File | Change |
|------|--------|
| `apps/dashboard/src/pages/JourneyBuilderPage.jsx` | Add `onNodeClick`, `emailBuilderNode` state, render `EmailBuilderModal` |
| `apps/dashboard/src/components/journey/EmailSendNode.jsx` (o inline) | Add click cursor style |
| `apps/dashboard/src/components/journey/EmailBuilderModal.jsx` | **NEW** — full modal component |
| `apps/dashboard/server.js` | Add `/email/build` and `/email/refine` endpoints |
| `packages/core/journey-builder/email-generator.js` | **NEW** — `generateEmailFromBrief()` extraída de BAU pipeline |
| `apps/dashboard/src/i18n/translations.js` | Add modal strings ES + EN |

---

## Verification

1. **Unit** — `generateEmailFromBrief()`: parámetros correctos → HTML + `mc_email_id`
2. **Integration** — `POST .../email/build`: mock MC client, verificar SSE stream completo
3. **E2E manual:**
   - Click nodo email → modal abre con datos pre-cargados
   - Brief → "Generate" → SSE streameando visible
   - Preview en iframe
   - Mensaje de refinamiento → preview se actualiza
   - "Use this email" → modal cierra, nodo muestra `mc_email_id` + highlight
   - Validar journey → sin errores `mc_email_id: null`
4. **Regresión:** journey chat, `CreateJourneyModal`, y deploy a SFMC sin cambios de comportamiento
