# Plan de Implementacion: Vistas Unicas por Agente

## Contexto

Actualmente los 13 agentes comparten la misma vista generica en `AgentDetail.jsx` (tabs: Chat, Skills, Tools, Workflows, Activity, EOD). Cada agente hace trabajo muy distinto y su vista interna deberia reflejarlo.

**Cambios clave:**
- Eliminar nombres personales (Raul, Lucia, etc.) → identificar agentes solo por rol (Campaign Manager Agent, Content Agent, etc.)
- Cada agente tiene una vista unica con hero section + tabs contextuales segun su trabajo
- Nuevo agente: **HTML Developer Agent** (agente #13) para disenar emails y bloques HTML
- Datos mock en frontend inicialmente, sin cambios en DB por ahora

---

## IMPORTANTE: IDs Legacy en la DB

La DB (`seed-emirates.sql`) todavia usa los IDs originales (nombres personales: `raul`, `valentina`, `guillermo`, etc.). Los nuevos IDs (`campaign-manager`, `crm-agent`, etc.) aun NO se han migrado en la DB.

**Al registrar cada vista en `index.js`, se DEBEN mapear AMBOS IDs** — el legacy (actual en DB) y el nuevo (futuro):

```js
export const viewMap = {
  'crm-agent': CrmAgentView,
  'valentina': CrmAgentView,  // Legacy DB id
};
```

Esto asegura que la vista funcione con el seed actual y tambien cuando se migren los IDs.

**Tabla de referencia rapida para el viewMap:**

| Legacy ID (DB actual) | Nuevo ID (viewMap) | Vista |
|----------------------|-------------------|-------|
| raul | campaign-manager | CampaignManagerView |
| valentina | crm-agent | CrmAgentView |
| guillermo | cloud-architect | CloudArchitectView |
| lucia | content-agent | ContentAgentView |
| diego | segmentation-agent | SegmentationAgentView |
| andres | automation-architect | AutomationArchitectView |
| martina | calendar-agent | CalendarAgentView |
| sofia | brand-guardian | BrandGuardianView |
| javier | legal-agent | LegalAgentView |
| elena | qa-agent | QaAgentView |
| carlos | analytics-agent | AnalyticsAgentView |
| (nuevo) | html-developer | HtmlDeveloperView |

---

## Los 12 Agentes (nombres nuevos)

| # | ID actual | Nuevo ID | Nuevo nombre (= rol) | Departamento |
|---|-----------|----------|----------------------|-------------|
| 1 | raul | campaign-manager | Campaign Manager Agent | Strategic |
| 2 | valentina | crm-agent | CRM Agent | Strategic |
| 3 | guillermo | cloud-architect | Cloud Architect Agent | Strategic |
| 5 | lucia | content-agent | Content Agent | Execution |
| 6 | diego | segmentation-agent | Segmentation Agent | Execution |
| 7 | andres | automation-architect | Automation Architect Agent | Execution |
| 8 | martina | calendar-agent | Calendar Agent | Execution |
| 9 | sofia | brand-guardian | Brand Guardian Agent | Control |
| 10 | javier | legal-agent | Legal Agent | Control |
| 11 | elena | qa-agent | QA Agent | Control |
| 12 | carlos | analytics-agent | Analytics Agent | Control |
| 13 | NUEVO | html-developer | HTML Developer Agent | Execution |

---

## Arquitectura de Componentes

```
src/pages/AgentDetail.jsx          ← Router principal, carga datos, detecta tipo de agente
src/components/agent-views/        ← NUEVA carpeta
  CampaignManagerView.jsx
  CrmAgentView.jsx
  CloudArchitectView.jsx
  ContentAgentView.jsx
  SegmentationAgentView.jsx
  AutomationArchitectView.jsx
  CalendarAgentView.jsx
  BrandGuardianView.jsx
  LegalAgentView.jsx
  QaAgentView.jsx
  AnalyticsAgentView.jsx
  HtmlDeveloperView.jsx
  GenericAgentView.jsx             ← Fallback para agentes sin vista custom
```

**Patron:** `AgentDetail.jsx` mantiene la logica de fetch, header y edit modal. El contenido del tab area se delega al componente de vista especifico segun `agent.id` o un nuevo campo `agent.view_type`.

```jsx
// AgentDetail.jsx
const viewMap = {
  'campaign-manager': CampaignManagerView,
  'crm-agent': CrmAgentView,
  'cloud-architect': CloudArchitectView,
  'content-agent': ContentAgentView,
  'segmentation-agent': SegmentationAgentView,
  'automation-architect': AutomationArchitectView,
  'calendar-agent': CalendarAgentView,
  'brand-guardian': BrandGuardianView,
  'legal-agent': LegalAgentView,
  'qa-agent': QaAgentView,
  'analytics-agent': AnalyticsAgentView,
  'html-developer': HtmlDeveloperView,
};

const ViewComponent = viewMap[agent.id] || GenericAgentView;
return <ViewComponent agent={agent} />;
```

---

## Vista Detallada por Agente

### 1. Campaign Manager Agent (Strategic)

**Hero:** Campanas activas con progress bars por fase

```
┌─────────────────────────────────────────────────┐
│  Summer Sale 2026         60%  ████████░░░░  QA │
│  Brief ✓ → Segment ✓ → Content ✓ → QA ● → Launch ○  │
│                                                  │
│  Ramadan Campaign         20%  ████░░░░░░░░  Content │
│  Brief ✓ → Segment ● → Content ○ → QA ○ → Launch ○  │
└─────────────────────────────────────────────────┘
```

**Tabs:**
- **Campanas** — Lista con estado, fecha target, agentes asignados, progress bar
- **Dependencias** — Tabla: que agente espera por cual, status del bloqueo
- **Metricas** — KPIs de campanas completadas (open rate, CTR, conversions) con Recharts line/bar
- **Chat** — Chat con el agente
- **Actividad** — Log de decisiones y eventos

**Mock data:** Array de 3-4 campanas con fases, fechas, metricas

---

### 2. CRM Agent (Strategic)

**Hero:** 3 KPI cards — Retention Rate, Churn Risk Count, Active Segments

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Retention │  │  Churn   │  │ Segments │
│   87.3%   │  │ Risk: 4  │  │    23    │
│   ▲ 2.1%  │  │ accounts │  │  active  │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Segmentos** — Tabla: nombre, tamano, criteria, ultima actualizacion, overlap %
- **Cohortes** — Heatmap/grid de retencion por cohorte mensual (Recharts)
- **Alertas** — Segmentos que necesitan refresh, anomalias
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 5-6 segmentos con metricas, 6 meses de cohortes

---

### 3. Cloud Architect Agent (Strategic)

**Hero:** Health dashboard — Journeys running/paused/error, throughput, error rate

```
┌─────────────────────────────────────────┐
│  Journeys: 8 running │ 2 paused │ 1 err│
│  Throughput: 12,340 emails/hr           │
│  Error rate: 0.3%                       │
└─────────────────────────────────────────┘
```

**Tabs:**
- **Journeys** — Cards con nombre, estado (badge color), entry count, mini description
- **Infraestructura** — Status de conexiones, API limits, data extensions
- **Changelog** — Log de cambios de configuracion con timestamp + diff resumido
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 5-6 journeys con estados variados, health metrics

---

### 4. Content Agent (Execution)

**Hero:** 3 KPIs — Pending Review, Created Today, Approval Rate

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Pending  │  │ Created  │  │ Approved │
│  Review  │  │  Today   │  │   Rate   │
│    5     │  │    12    │  │  94.2%   │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Portfolio** — Feed visual tipo galeria: cards con preview del copy, idioma flag (🇪🇸/🇬🇧/🇦🇪), tipo (email subject/body/push/SMS), status badge (draft/review/approved/rejected)
- **Versiones A/B** — Side by side de variants con metricas
- **Quality** — Score por pieza, feedback recibido del Brand Guardian
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 8-10 piezas de contenido con variantes, scores, feedback

---

### 6. Segmentation Agent (Execution)

**Hero:** Distribucion de audiencia (mini bar chart horizontal) + segments created this week

```
┌─────────────────────────────────────┐
│  High Value 15%  ████                │
│  Mid Value  45%  ████████████        │
│  Low Value  40%  ███████████         │
│  Created this week: 4               │
└─────────────────────────────────────┘
```

**Tabs:**
- **Segmentos** — Cards: nombre, tamano numerico, criteria como tags, fecha creacion, overlap % con otros segmentos
- **Distribucion** — Pie chart + bar chart de audiencia total (Recharts)
- **Validacion** — Segmentos pendientes de review, warnings de overlap excesivo (>30%)
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 6-8 segmentos con criterias, overlaps, distribucion

---

### 7. Automation Architect Agent (Execution)

**Hero:** 3 KPIs — Active Journeys, Draft Journeys, Error Rate

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Active   │  │  Draft   │  │  Error   │
│ Journeys │  │ Journeys │  │   Rate   │
│    6     │  │    3     │  │  0.8%    │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Automaciones** — Cards con: nombre del journey, status badge (active/draft/paused/error), descripcion del trigger, steps count, entry count
- **Ejecuciones** — Tabla: journey name, trigger timestamp, result (success/fail/timeout), duracion
- **Errores** — Lista agrupada por tipo con count, ultimo timestamp, message
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 5 automaciones, 15 ejecuciones recientes, 3 tipos de error

---

### 8. Calendar Agent (Execution)

**Hero:** Vista mini-calendario del mes actual con dots de color en dias con campanas

```
┌──────────────────────────────────────┐
│       MARCH 2026                     │
│ Mo Tu We Th Fr Sa Su                 │
│  2  3  4  5  6  7  8                │
│  9 [10] 11 12 13 14 15              │
│     🔴  ⚠️                            │
│ 16 17 18 19 20 21 22                │
│ 23 24 25 26 27 28 29                │
│ 30 31                               │
└──────────────────────────────────────┘
```

**Tabs:**
- **Calendario** — Vista mensual completa con campanas como bloques coloreados, click en dia para ver detalle
- **Conflictos** — Alertas: 2+ campanas al mismo segmento en ventana de 48h, con severity badge
- **Proximos** — Timeline vertical de proximos 7 dias con campanas programadas
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 8-10 eventos de calendario en el mes actual, 2 conflictos

---

### 9. Brand Guardian Agent (Control)

**Hero:** Cola de revisiones — Pending / Approved Today / Rejected Today

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Pending  │  │ Approved │  │ Rejected │
│ Reviews  │  │  Today   │  │  Today   │
│   3 🟡    │  │    8     │  │    2     │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Review Queue** — Cards con: preview del copy/diseno, campaign name, submitted by, botones Approve/Reject (mock), campo de feedback
- **Historial** — Tabla: pieza, campaign, decision (approved/rejected), motivo, timestamp
- **Guidelines** — Checklist visual de brand rules (tone, colors, fonts, imagery) con compliance % por campana
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 3 pendientes, 10 en historial, 8 brand rules

---

### 10. Legal Agent (Control)

**Hero:** Semaforo de compliance por campana activa

```
┌────────────────────────────────────────┐
│  Summer Sale:     ✅ GDPR  ✅ CAN-SPAM  │
│  Ramadan Camp:    ✅ GDPR  ⚠️ Consent   │
│  Flash Promo:     🔴 GDPR  ⚠️ Terms     │
└────────────────────────────────────────┘
```

**Tabs:**
- **Compliance** — Grid por campana: columnas por regulacion (GDPR, CAN-SPAM, UAE Local, Consent), celdas con icono ✅/⚠️/🔴
- **Riesgos** — Cards de items rojo/amarillo con: descripcion del riesgo, accion requerida, deadline, responsible agent
- **Auditoria** — Log inmutable: timestamp, campana, check realizado, resultado, notas
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 4 campanas con checks variados, 5 riesgos, 15 entries de auditoria

---

### 11. QA Agent (Control)

**Hero:** Test summary — Passed / Failed / Pending QA

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Passed  │  │  Failed  │  │ Pending  │
│  Tests   │  │  Tests   │  │   QA     │
│  145 ✅   │  │   3 🔴    │  │    7     │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Test Results** — Tabla expandible: pieza, link check (✓/✗ count), render score por device (desktop/mobile/tablet), spam score (0-10), load time (ms)
- **Queue** — Lista de items pendientes de QA con: nombre, tipo, prioridad badge, fecha submitted
- **Bugs** — Cards: titulo del bug, severidad (critical/major/minor) con color, status (open/in-progress/fixed), screenshot placeholder
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 10 test results, 4 en queue, 6 bugs

---

### 12. Analytics Agent (Control)

**Hero:** 3 KPIs con sparklines — Total Revenue, Avg ROI per Campaign, Reports Generated

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Total   │  │ Avg ROI  │  │ Reports  │
│ Revenue  │  │ per Camp │  │ Gen. wk  │
│ $1.2M 📈 │  │   3.2x   │  │    8     │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**
- **Dashboard** — 2 charts (Recharts): line chart de opens/clicks/conversions over 12 weeks, bar chart de ROI por campana
- **Attribution** — Tabla: canal/touchpoint, % de atribucion, revenue atribuido, trend arrow
- **Reportes** — Lista de reportes generados: titulo, fecha, tipo (weekly/campaign/adhoc), boton para ver
- **Chat** — Chat con el agente
- **Actividad**

**Mock data:** 12 semanas de time series, 5 canales, 6 reportes

---

### 13. HTML Developer Agent (Execution) — NUEVO

**Hero:** Stats — Templates Created, Blocks Library Size, Last Deployed

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Templates│  │  Blocks  │  │   Last   │
│ Created  │  │ Library  │  │ Deployed │
│    18    │  │    45    │  │  2h ago  │
└──────────┘  └──────────┘  └──────────┘
```

**Tabs:**

#### Tab "Templates" (vista principal)
Grid de cards (3 columnas en desktop, 2 tablet, 1 mobile) donde cada card muestra:

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   PREVIEW THUMBNAIL   │  │
│  │   (HTML renderizado   │  │
│  │    en miniatura via    │  │
│  │    iframe sandbox o    │  │
│  │    screenshot)         │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  Welcome Email Template     │
│  📧 Full Template           │
│  Last edited: 2h ago       │
│  Used in: 3 campaigns      │
│  ┌─────┐ ┌──────┐          │
│  │ Edit│ │Deploy│          │
│  └─────┘ └──────┘          │
└─────────────────────────────┘
```

**Al hacer click en una card** → vista de detalle del template:
- Preview full-width del HTML renderizado (iframe sandbox con srcdoc)
- Sidebar con: nombre, descripcion, campanas que lo usan, fecha creacion/edicion
- Boton "View Source" que muestra el HTML raw en un code viewer
- Boton "Edit" (futuro: editor inline)

#### Tab "Blocks" (ContentBlockByName library)
Misma grid de cards pero para bloques reutilizables:

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │  BLOCK PREVIEW        │  │
│  │  (mini render)        │  │
│  └───────────────────────┘  │
│                             │
│  Hero Banner Block          │
│  🧩 Content Block           │
│  Used in: 7 templates      │
│  ┌──────┐ ┌──────┐         │
│  │ Copy │ │ Edit │         │
│  └──────┘ └──────┘         │
└─────────────────────────────┘
```

Categorias de bloques:
- **Header** — Logos, navigation bars, preheaders
- **Hero** — Hero banners con imagen + CTA
- **Content** — Text blocks, 2-col layouts, feature grids
- **CTA** — Buttons, offer cards, countdown timers
- **Footer** — Social links, legal text, unsubscribe

Filtro por categoria en la parte superior del tab.

#### Tab "Chat" — Chat con el agente
#### Tab "Actividad" — Log de eventos

**Mock data:**
- 4-5 templates completos con HTML basico (header + hero + content + footer)
- 8-10 bloques categorizados con HTML snippets
- Cada uno con metadata: nombre, tipo, categoria, campanas usadas, fecha

**Render de previews:**
- Usar `<iframe sandbox="allow-same-origin" srcdoc={htmlContent} />` con height fijo
- Escala reducida via `transform: scale(0.3)` en el iframe para thumbnails
- Sin scripts, sin links externos (sandbox de seguridad)

---

## Archivos a Crear/Modificar

### Nuevos archivos (crear)
| Archivo | Descripcion |
|---------|-------------|
| `src/components/agent-views/CampaignManagerView.jsx` | Vista del Campaign Manager |
| `src/components/agent-views/CrmAgentView.jsx` | Vista del CRM Agent |
| `src/components/agent-views/CloudArchitectView.jsx` | Vista del Cloud Architect |
| `src/components/agent-views/ContentAgentView.jsx` | Vista del Content Agent |
| `src/components/agent-views/SegmentationAgentView.jsx` | Vista del Segmentation Agent |
| `src/components/agent-views/AutomationArchitectView.jsx` | Vista del Automation Architect |
| `src/components/agent-views/CalendarAgentView.jsx` | Vista del Calendar Agent |
| `src/components/agent-views/BrandGuardianView.jsx` | Vista del Brand Guardian |
| `src/components/agent-views/LegalAgentView.jsx` | Vista del Legal Agent |
| `src/components/agent-views/QaAgentView.jsx` | Vista del QA Agent |
| `src/components/agent-views/AnalyticsAgentView.jsx` | Vista del Analytics Agent |
| `src/components/agent-views/HtmlDeveloperView.jsx` | Vista del HTML Developer |
| `src/components/agent-views/GenericAgentView.jsx` | Fallback generico (tabs actuales) |
| `src/components/agent-views/index.js` | Export barrel + viewMap |
| `src/data/agentViewMocks.js` | Mock data para todas las vistas |

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `src/pages/AgentDetail.jsx` | Reemplazar tab content por viewMap dispatch |
| `src/data/mockData.js` | Renombrar agentes (quitar nombres, usar roles), agregar HTML Developer |
| `src/i18n/translations.js` | Agregar traducciones para nuevos tabs y labels |
| `src/index.css` | Agregar estilos para agent views (cards, grids, calendarios, etc.) |

---

## Componentes Reutilizables Compartidos

Estos mini-componentes se repiten en multiples vistas:

| Componente | Descripcion | Usado en |
|-----------|-------------|----------|
| `KpiCard` | Card con numero grande + label + trend arrow | 10 de 13 vistas |
| `StatusBadge` | Pill con color segun estado | Todas |
| `DataTable` | Tabla responsive con sorting | 8 vistas |
| `ProgressBar` | Barra de progreso con % | Campaign Manager, QA |
| `TimelineItem` | Item vertical con dot + timestamp | Calendar, Activity |
| `PreviewCard` | Card con thumbnail iframe | HTML Developer |

Estos se crean en `src/components/agent-views/shared/` para evitar duplicacion.

---

## Orden de Implementacion

### Batch 1 — Infraestructura + HTML Developer (prioridad)
1. Crear `agentViewMocks.js` con mock data para todas las vistas
2. Crear componentes shared (`KpiCard`, `StatusBadge`, `DataTable`)
3. Crear `GenericAgentView.jsx` (mover tabs actuales aqui)
4. Modificar `AgentDetail.jsx` para usar viewMap dispatch
5. **Implementar `HtmlDeveloperView.jsx`** con grid de cards + preview iframe + vista detalle
6. Actualizar `mockData.js` — renombrar agentes, agregar HTML Developer

### Batch 2 — Vistas de Control (simples, basadas en tablas/listas)
7. `QaAgentView.jsx` — Test results table + bug cards
8. `LegalAgentView.jsx` — Compliance grid + risk cards
9. `BrandGuardianView.jsx` — Review queue + historial
10. `AnalyticsAgentView.jsx` — Recharts dashboard + attribution table

### Batch 3 — Vistas de Ejecucion
11. `ContentAgentView.jsx` — Portfolio gallery + A/B versions
12. `SegmentationAgentView.jsx` — Segment cards + distribution charts
13. `AutomationArchitectView.jsx` — Journey cards + execution log
14. `CalendarAgentView.jsx` — Calendario mensual + conflictos

### Batch 4 — Vistas Estrategicas
15. `CampaignManagerView.jsx` — Campaign timeline + dependencies
16. `CrmAgentView.jsx` — Retention KPIs + cohort heatmap
17. `CloudArchitectView.jsx` — Journey health + infra status

### Batch 5 — Polish
19. Actualizar traducciones i18n
20. Responsive design para todas las vistas
21. Transiciones y animaciones (fade-in existente)

---

## Verificacion

- [ ] Navegar a cada uno de los 13 agentes y verificar que carga su vista unica
- [ ] Verificar que el tab "Chat" funciona en todas las vistas
- [ ] Verificar que el "Edit Profile" modal sigue funcionando
- [ ] Verificar responsive en mobile (375px) y tablet (768px)
- [ ] Verificar que agentes sin vista custom caen al GenericAgentView
- [ ] Verificar que el HTML Developer muestra previews de templates en iframes
- [ ] Verificar que click en card de template abre la vista de detalle con preview full-width
- [ ] Verificar que los filtros por categoria funcionan en el tab Blocks
- [ ] Run `npm run dev` y navegar toda la app sin errores de consola
