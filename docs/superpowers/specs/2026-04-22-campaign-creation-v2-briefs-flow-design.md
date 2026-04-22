# Campaign Creation V2 · Briefs-first Flow · Design

**Date:** 2026-04-22
**Status:** Draft — pending user review
**Scope:** `/app/campaign-creation-v2` — rediseño end-to-end

---

## 1 · Problema y objetivo

Hoy `CampaignCreationV2Page.jsx` es un wizard lineal de 3 steps (Setup → Content Studio → Review). El usuario llega "en frío" y tiene que rellenar todo manualmente cada vez.

Queremos convertirlo en un **OS de campañas** donde:

1. Los **briefs** son el artefacto central (humanos + IA proactiva).
2. El **chat conversacional** reemplaza el Step 1 "Create Brief" rígido.
3. La IA propone **oportunidades** basadas en señales de datos (mockeadas ahora).
4. El **wizard actual** se mantiene, pero llega pre-rellenado desde el brief.

## 2 · Arquitectura del flujo

```
┌─────────────────────────────────────────────────┐
│  BRIEFS BOARD  (hub · tab por defecto)          │
│                                                 │
│  ┌──────────────┐    ┌──────────────┐          │
│  │ 👤 HUMAN · 3 │    │ 🤖 AI · 4    │          │
│  │   [+ New]    │    │   [🔄 Regen] │          │
│  │              │    │              │          │
│  │   card ...   │    │   card ...   │          │
│  └──────────────┘    └──────────────┘          │
└────────────┬────────────────────┬───────────────┘
             │                    │
    [+ New] click           [Activate] click on AI card
             │                    │
             ▼                    ▼
┌─────────────────────────────────────────────────┐
│  CHAT CONVERSACIONAL (setup)                    │
│                                                 │
│  Chat (voz+texto) │ Side-panel: brief en vivo   │
│  La IA extrae:     │  ✓ name                    │
│    nombre, fecha,  │  ✓ send_date               │
│    template, etc.  │  … progress bar            │
└────────────────────┬────────────────────────────┘
                     │ brief completo
                     ▼
┌─────────────────────────────────────────────────┐
│  CHAT — 3 OPCIONES DE LAYOUT+CONTENT            │
│                                                 │
│  [A Editorial]  [B Data-grid]  [C Emocional]    │
│          click → modal preview full             │
│                  [ ✓ Accept ]                   │
└────────────────────┬────────────────────────────┘
                     │ accepted_option
                     ▼
┌─────────────────────────────────────────────────┐
│  WIZARD (el actual)                             │
│  Step 1 Setup  → autorellenado (editable)      │
│  Step 2 Studio → autorellenado (editable)      │
│  Step 3 Review → sin cambios                   │
└─────────────────────────────────────────────────┘
```

**Vistas paralelas en la misma página (tabs):**
- 📋 Briefs (default)
- 📊 Overview (dashboard de estados)
- 📅 Calendar (calendario BAU)

## 3 · Data model

### Tabla `campaign_briefs` (nueva, en Railway)

```sql
CREATE TABLE campaign_briefs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id),
  created_by       UUID REFERENCES users(id),         -- null si IA

  source           TEXT NOT NULL CHECK (source IN ('human','ai')),
  status           TEXT NOT NULL CHECK (status IN ('draft','active','in_wizard','sent','dismissed')),

  -- Contenido del brief
  name             TEXT,
  objective        TEXT,
  send_date        TIMESTAMPTZ,
  template_id      TEXT,                               -- referencia a BAU_CAMPAIGN_TYPES (data/emiratesBauTypes.js)
  markets          JSONB,                              -- ['FR','DE']
  languages        JSONB,                              -- ['en','fr']
  variants_plan    JSONB,                              -- [{tier, behaviors, size}]
  audience_summary TEXT,

  -- Solo briefs IA
  opportunity_reason   TEXT,
  opportunity_signals  JSONB,
  preview_image_url    TEXT,

  -- Estado del flujo
  chat_transcript   JSONB,                             -- solo human
  accepted_option   JSONB,                             -- la opción 1/2/3 aceptada
  campaign_id       UUID REFERENCES campaigns(id),     -- null hasta in_wizard

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_briefs_org_status ON campaign_briefs(org_id, status);
CREATE INDEX idx_briefs_source     ON campaign_briefs(source);
```

Reflejar también en `packages/core/db/schema.sql` (regla 7 de CLAUDE.md).

### Señales mock (signals catalog)

Archivo nuevo: `apps/dashboard/src/data/mockSignals.js`. Cinco tipos de señal, cada una dispara un tipo de brief distinto:

| Signal              | Brief type       | Mock payload                               |
|---------------------|------------------|--------------------------------------------|
| `dormant_segment`   | Win-back         | `{segment, size, days_since_last_open}`    |
| `cart_abandon_spike`| Recovery offer   | `{route, users, dropoff_step}`             |
| `new_route_window`  | Route launch     | `{route, launch_date, addressable_audience}`|
| `ctr_decline`       | Re-engage        | `{market, delta_pct, window_days}`         |
| `seasonal_window`   | Offer/Promotion  | `{occasion, markets, days_until}`          |

Catálogo inicial: 8–12 señales variadas para que la regeneración tenga material.

## 4 · Componentes

### 4.1 Página contenedora
`CampaignCreationV2Page.jsx` refactor a shell con tabs. El wizard actual se extrae a `components/CampaignWizard.jsx` (sin cambiar lógica interna).

Tabs:
- `BriefsBoard.jsx`
- `OverviewDashboard.jsx`
- `CampaignsCalendar.jsx`

### 4.2 BriefsBoard
Layout dos columnas fijas (opción A):
- **Izquierda · 👤 Human:** header con contador + botón `+ New` → navega a `SetupChatView`.
- **Derecha · 🤖 AI:** header con contador + botón `🔄 Regenerate`.

`BriefCard.jsx` — variantes `human | ai`. Click → `BriefDetailModal.jsx` (read-only si `sent`, editable si `draft`/`active`, CTA "Activate" si aplica).

`BriefCard` para IA incluye: preview visual determinista, bloque `💡 ¿Por qué es oportunidad?`, métricas (audience / fecha / template / est. uplift), acciones `Activate / Refine / Dismiss`.

### 4.3 SetupChatView (fase 2)
Vista full-screen (no modal) dentro de la misma página, accesible vía query param `?briefId=<id>&mode=setup`. Layout split: chat a la izquierda, `BriefLivePanel` a la derecha. Volver al board = limpia query params.

**Chat:**
- Reusa `useVoice.js` (micro + texto).
- Backend `POST /api/campaign-briefs/chat/turn` — Claude con tool-use, cada turno devuelve `{extracted_fields, next_question, is_complete, rationale}`.
- Historial guardado en `chat_transcript`.

**BriefLivePanel:**
- Lista campos mínimos (name, send_date, template_id, markets, languages, variants_plan, objective).
- ✓ verde = extraído · ⏳ amarillo = preguntando · — = pendiente.
- Click en campo = edición inline sin interrumpir el chat.
- Barra de progreso `completedFields / totalFields`.
- Botón "Crear brief" se habilita cuando `is_complete=true`.

Defaults inteligentes que propone la IA:
- Fecha óptima por mercado (hardcoded lookup inicialmente).
- Idiomas por defecto según `markets`.
- Variants_plan sugerido según objetivo + audiencia.

### 4.4 ContentOptionsChat (fase 3)
Tras crear el brief, el mismo chat cambia de "momento" y muestra 3 direcciones:
- **A · Editorial** (aspiracional · hero · CTA único)
- **B · Data-grid** (comparativo · 4 beneficios · CTA doble)
- **C · Emocional** (narrativa · oferta · CTA suave)

Backend `POST /api/campaign-briefs/:id/options/generate` → Claude genera 3 opciones completas (layout + copy + CTA), persistidas temporalmente en el servidor hasta aceptar.

`OptionCard.jsx` — miniatura + label direction + hook copy.
`OptionPreviewModal.jsx` — preview full mobile+desktop, botón verde "✓ Aceptar".

Acciones laterales:
- `🔄 Regenerar las 3` → nueva tirada completa.
- `💬 Ajustar con chat` → vuelve al chat y regenera con ajustes.

Al aceptar: se persiste `accepted_option`, `status='in_wizard'`, se crea fila en `campaigns` y se navega al wizard con `?briefId=...`.

### 4.5 OverviewDashboard (tab)
- 4 KPI cards: Draft / In Wizard / Scheduled / Sent-7d.
- Tabla pipeline (nombre, estado, fecha, mercado, variantes, →).
- Click en fila → `BriefDetailModal`.

### 4.6 CampaignsCalendar (tab)
- Grid mensual estándar.
- Eventos coloreados por categoría BAU (broadcast/offers/partner/route/lifecycle/engagement) usando colores de `BAU_CATEGORIES`.
- Click en evento → `BriefDetailModal`.
- Navegación prev/next/hoy.

### 4.7 CampaignWizard (actual, refactor ligero)
- Acepta prop `initialBrief` (objeto completo).
- Banner superior `✨ Pre-rellenado desde brief "X"` con link "Ver brief →".
- Campos autorellenados con borde morado `--color-ai, #a78bfa55`. El borde desaparece al primer edit del usuario.
- `template_id` bloqueado con 🔒 (cambiarlo rompe el contenido ya generado).
- Step 3 (Review) sin cambios.

## 5 · API

Endpoints nuevos en `apps/dashboard/server.js`:

| Método | Ruta                                                | Propósito                                       |
|--------|-----------------------------------------------------|-------------------------------------------------|
| GET    | `/api/campaign-briefs`                              | Lista briefs del org (filtros `source`, `status`)|
| POST   | `/api/campaign-briefs`                              | Crea brief vacío (draft) al abrir chat         |
| PATCH  | `/api/campaign-briefs/:id`                          | Actualiza campos (edición inline o chat turn)   |
| POST   | `/api/campaign-briefs/:id/chat/turn`                | Un turno del chat setup (Claude tool-use)       |
| POST   | `/api/campaign-briefs/:id/options/generate`         | Genera las 3 opciones de content                |
| POST   | `/api/campaign-briefs/:id/options/accept`           | Acepta una opción, crea campaign, marca in_wizard|
| POST   | `/api/campaign-briefs/:id/dismiss`                  | Descarta (solo AI)                              |
| POST   | `/api/campaign-briefs/ai-opportunities/regenerate`  | Borra drafts IA y genera 4 nuevas               |

Todos usan queries parametrizadas, auth vía session middleware existente.

## 6 · Estados del brief

```
draft    → creado, chat en curso o brief IA sin activar
active   → brief completo, esperando aceptar content option
in_wizard→ opción aceptada, campaign_id creado, wizard abierto
sent     → campaña deployada (sync con campaigns.status)
dismissed→ brief IA descartado (no reaparece en regeneraciones)
```

## 7 · i18n

Todas las strings nuevas en `apps/dashboard/src/i18n/translations.js` bajo namespace `briefs.*` y `briefsBoard.*`, `setupChat.*`, `contentOptions.*`, `opportunitiesPanel.*`. ES + EN obligatorio.

## 8 · Routing

Se mantiene la ruta `/app/campaign-creation-v2`. Internamente añadimos query params:
- `?tab=briefs|overview|calendar` (default `briefs`)
- `?briefId=<uuid>` (abre modal de brief o wizard según estado)

## 9 · Fuera de scope en esta iteración

- Conexión real con datos de señales (MC, Analytics, etc.) — mock data.
- Multi-campaign por brief (brief = 1 campaña).
- Colaboración multi-usuario en tiempo real sobre el mismo brief.
- Versionado de briefs aceptados.

## 10 · Plan de implementación (resumen)

El plan detallado lo escribirá `writing-plans`. Fases tentativas:

1. DB migration + schema.sql + mock signals + API endpoints skeleton.
2. BriefsBoard + BriefCard + BriefDetailModal (sin chat, con briefs creados vía API directa).
3. SetupChatModal + BriefLivePanel + backend Claude tool-use.
4. ContentOptionsChat + modal preview + accept flow.
5. AI opportunities endpoint (regenerate + mock signals → Claude para reason/name).
6. OverviewDashboard + CampaignsCalendar tabs.
7. CampaignWizard refactor para aceptar `initialBrief`.
8. i18n, polish, edge cases.

Cada fase es un PR aislado y testeable por separado.
