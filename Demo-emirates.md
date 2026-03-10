# Plan: Adaptar agentOS como "Emirates Agentic Marketing Intelligence" para demo

## Context

Guillermo tiene una presentacion web ([emirates-agentic-ai.vercel.app](https://emirates-agentic-ai.vercel.app)) que propone un sistema de 12 agentes IA especializados para el departamento de marketing de Emirates. Necesita que agentOS funcione como la plataforma operativa detras de esa vision para una demo manana. El objetivo es que agentOS se vea y sienta como un producto dedicado para Emirates: tema oscuro premium, 12 agentes de marketing, 3 capas organizacionales, y 4 workflows pre-configurados.

---

## Cambios por orden de prioridad

### 1. Theme CSS - Emirates Premium Dark
**Archivo:** [index.css](apps/dashboard/src/index.css)

Reemplazar las variables `:root` (lineas 3-38) con tema oscuro Emirates usando los colores corporativos oficiales (mismos que la presentacion web):

**Colores corporativos Emirates:**
- Emirates Red: `#D71920`
- Emirates Gold: `#D4AF37`
- Graphite 950: `#0a0a0a` (fondo principal)
- Graphite 900: `#121212` (fondo secundario/cards)
- Graphite 800: `#1e1e1e` (sidebar, elevaciones)
- Graphite 700: `#2d2d2d` (bordes, hover states)

**Mapping a CSS variables:**
- `--bg-main: #0a0a0a` (graphite-950)
- `--bg-card: #121212` (graphite-900)
- `--primary: #D71920` (rojo Emirates como primario)
- `--primary-soft: rgba(215, 25, 32, 0.1)`
- `--text-main: #f0f0f5` (blanco suave)
- `--text-muted: #888888`
- `--accent-green: #10b981` (mantener para success)
- `--accent-yellow: #D4AF37` (dorado Emirates)
- `--accent-red: #D71920` (rojo Emirates)
- `--border-light: rgba(212, 175, 55, 0.12)` (borde dorado sutil)
- Sombras mas profundas para dark mode

**Temas por capa organizacional:**
- `.theme-gold` → `--primary: #D4AF37` (Strategic Layer)
- `.theme-red` → `--primary: #D71920` (Execution Layer)
- `.theme-navy` → `--primary: #2d2d2d` (Control & Validation)

- Adaptar sidebar background a `#1e1e1e` (graphite-800)
- Inputs, modals, dropdowns: fondos graphite-900/800
- Buscar y corregir colores hardcodeados en inline styles de JSX (AgentDetail, DepartmentDetail, etc.)

### 2. Seed de Base de Datos - 12 Agentes + 3 Departamentos
**Archivo:** [schema.sql](packages/core/db/schema.sql) (referencia de schema)
**Ejecutar:** Script SQL contra PostgreSQL

Insertar en tabla `agents` los 11 agentes:
- **Strategic Layer** (`strategic`): Raul (Campaign Manager), Valentina (CRM), Guillermo (MarTech Architect)
- **Execution Layer** (`execution`): Lucia (Content), Diego (Segmentation), Andres (Automation), Martina (Calendar)
- **Control & Validation** (`control`): Sofia (Brand Guardian), Javier (Legal), Elena (QA), Carlos (Analytics)

Cada uno con skills y tools especificos de marketing (Salesforce MC, Looker Studio, etc.)

Insertar en `workspace_config` los 3 departamentos con colores Emirates (gold, red, navy).

### 3. Server - Department Metadata
**Archivo:** [server.js](apps/dashboard/server.js)

Cambiar `DEFAULT_DEPT_META` (~linea 387) de los 5 departamentos genericos a las 3 capas Emirates:
- `strategic`: emoji 🎯, color #D4AF37 (Emirates Gold), "Campaign strategy, CRM & architecture"
- `execution`: emoji 🚀, color #D71920 (Emirates Red), "Content, segmentation, automation & scheduling"
- `control`: emoji 🛡️, color #2d2d2d (Graphite 700), "Brand, legal, QA & analytics"

### 4. Branding - Layout y Logo
**Archivo:** [Layout.jsx](apps/dashboard/src/components/Layout.jsx)

- Linea 45: Cambiar `Agent<span>OS</span>` → `Emirates <span>AMI</span>`
- Linea 46: Collapsed logo `A` → `E`
- Actualizar icono de nav de inbox: `📥` → `📬` (Campaign Inbox)
- Version text: actualizar a `v1.0 — Enterprise`

### 5. Workflows Emirates
**Archivo:** [WorkflowsHub.jsx](apps/dashboard/src/pages/WorkflowsHub.jsx)

Reemplazar array `WORKFLOWS` (~linea 6-111) con 4 workflows Emirates:
1. **Campaign Creation Engine** (Lucia→Diego→Sofia→Javier→Andres→Elena) — 60% mas rapido
2. **Post-Campaign Intelligence Loop** (Carlos→Valentina→Raul) — 3x insights
3. **Loyalty Upsell Engine** (Diego→Lucia→Carlos→Martina) — 25% conversion lift
4. **NPS Recovery Automation** (Carlos→Lucia→Andres) — 40% recovery rate

### 6. Tools del Workspace
**Archivo:** [WorkspaceOverview.jsx](apps/dashboard/src/pages/WorkspaceOverview.jsx)

Reemplazar array `TOOLS` (~linea 8) con stack de marketing:
- Salesforce Marketing Cloud, Looker Studio, Claude AI, Skywards API

### 7. Theme Maps en paginas de detalle
**Archivos:** [AgentDetail.jsx](apps/dashboard/src/pages/AgentDetail.jsx), [DepartmentDetail.jsx](apps/dashboard/src/pages/DepartmentDetail.jsx)

Agregar las 3 nuevas claves al `themeMap`: `strategic → theme-gold`, `execution → theme-red`, `control → theme-navy`

Buscar y reemplazar colores hardcodeados en inline styles (ej: `background: '#ecfdf5'`) con variables CSS que funcionen en dark mode.

### 8. Traducciones EN para Emirates
**Archivo:** [translations.js](apps/dashboard/src/i18n/translations.js)

Actualizar seccion `en` (desde ~linea 608):
- `layout.dashboard` → `Command Center`
- `layout.workspace` → `Agent Teams`
- `layout.inbox` → `Campaign Inbox`
- `dashboard.title` → `Emirates Marketing Intelligence`
- `dashboard.subtitle` → `Agentic operations for Emirates marketing`
- `workspace.departments` → `Operational Layers`
- Otros labels relevantes

### 9. Mock Data de respaldo
**Archivo:** [mockData.js](apps/dashboard/src/data/mockData.js)

Actualizar arrays de fallback: `departments` (3 capas), `agents` (12 agentes), `skills` (marketing), `tools` (MarTech), `workflows` (4 Emirates).

### 10. PM Agent - Prompt de marketing
**Archivo:** [core.js](packages/core/pm-agent/core.js)

Adaptar `buildPMSystemPrompt` (~linea 22) para contexto Emirates:
- Idioma ingles
- Conocimiento de Skywards, SFMC, campanas de aerolinea premium
- Vocabulario de marketing automation

### 11. Workspace y Environment
**Archivos:** [workspace.md](workspace.md), `.env`

- Reescribir `workspace.md` para Emirates marketing team (12 agentes, goals, rules)
- `WORKSPACE_NAME=Emirates Marketing Intelligence` en `.env`

---

## Paginas que NO necesitan cambios

Estas paginas son data-driven y funcionaran automaticamente con los nuevos datos:
- DailyStandup, WeeklyBoard, AuditLog, IntelligenceHub, PmReports, Inbox, SettingsPage

La autenticacion ya esta en guest mode (main.jsx linea 72-74), asi que no se necesita login para la demo.

---

## Flujo de demo sugerido

1. **`/app/workspace`** — Mostrar las 3 capas con 11 agentes activos
2. **Click en "Strategic Layer"** — Ver Raul, Valentina, Guillermo con skills
3. **Click en agente "Diego"** — Ver perfil de segmentacion
4. **`/app/workflows`** — 4 workflows con pipelines de agentes
5. **`/app/inbox`** — Crear idea: "Skywards upgrade campaign for Silver members in Germany"
6. **PM Agent Chat** — Claude responde con estrategia de campana Emirates
7. **`/app/workspace/intelligence`** — Metricas y analytics

---

## Verificacion

1. `docker-compose up -d` para levantar PostgreSQL
2. Ejecutar script SQL de seed para insertar agentes y departamentos
3. `cd apps/dashboard && npm run dev` + `node apps/dashboard/server.js`
4. Navegar a `http://localhost:5173/app/workspace` — deben verse 3 capas con 12 agentes
5. Verificar tema oscuro en todas las paginas principales
6. Probar PM Agent chat con prompt de campana Emirates
7. Verificar workflows con los 4 pipelines correctos
