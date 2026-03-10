# AgentOS — CLAUDE.md

**AgentOS** es un sistema operativo para equipos que trabajan con agentes de IA. Permite gestionar proyectos, agentes, standups diarios, planificacion semanal, campanas, y workflows desde un dashboard centralizado.

---

## Stack Tecnico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19, React Router 7, Recharts 3, Vite 7, lucide-react |
| Styling | CSS puro con custom properties (sin Tailwind) |
| Backend | Express 5, single `server.js` |
| Auth | bcrypt, express-session, connect-pg-simple |
| Database | PostgreSQL 16 (Docker, puerto 5434) |
| AI/LLM | Anthropic SDK (Claude Sonnet 4.6), SSE streaming |
| i18n | Custom context + translations (ES/EN) |
| Font | Inter (Google Fonts) |

---

## Estructura del proyecto

```
agentOS/
  apps/dashboard/
    src/
      components/
        Layout.jsx            Sidebar + navigation shell
        PMAgentChat.jsx       Chat con PM Agent (SSE streaming + voz)
        AgentChat.jsx         Chat generico con agentes
        InboxPanel.jsx        Panel de inbox con filtros
        BrainstormPanel.jsx   Panel de brainstorm semanal
        WeeklyReport.jsx      Reporte semanal con KPIs
        DailyAiSummary.jsx    Resumen IA diario
        DailyEodModal.jsx     Modal end-of-day
        DailyTrends.jsx       Visualizacion de tendencias
        DailyCoverageAlert.jsx  Alertas de cobertura
        PipelineBoard.jsx     Pipeline de proyectos
        DepartmentKanban.jsx  Kanban por departamento
        VoiceControls.jsx     Controles STT/TTS
        icons.jsx             Iconos centralizados
        agent-views/          13 vistas especializadas por tipo de agente
          shared/             DataTable, KpiCard, ProgressBar, StatusBadge
      pages/                  17 paginas
        HomePage.jsx          Landing con feature cards
        LoginPage.jsx         Login + setup wizard
        WorkspaceOverview.jsx Vista general del workspace
        DailyStandup.jsx      Standup diario por departamento
        WeeklyBoard.jsx       Planificacion semanal (5 tabs)
        AgentDetail.jsx       Detalle de agente (usa agent-views)
        DepartmentDetail.jsx  Detalle de departamento
        ToolDetail.jsx        Detalle de herramienta
        WorkflowsHub.jsx      Gestion de workflows
        IntelligenceHub.jsx   Insights IA
        PmReports.jsx         Reportes PM con severidad
        Inbox.jsx             Bandeja de entrada
        AuditLog.jsx          Log de auditoria
        SettingsPage.jsx      Configuracion (workspace, depts, API keys, users)
        CampaignsHub.jsx      Hub de campanas y BAU types
        CampaignDetail.jsx    Detalle de campana
        BauTypeDetail.jsx     Detalle de BAU type
      hooks/
        useVoice.js           Hook de speech-to-text y text-to-speech
      i18n/                   Traducciones ES/EN + LanguageContext
      data/
        mockData.js           Departments, agents, skills, tools
        agentViewMocks.js     Mock data para agent-views
        emiratesCampaigns.js  Campanas por lifecycle
        emiratesBauTypes.js   BAU campaign types
    server.js                 API backend Express (~2300 lineas)
    package.json
  packages/core/
    pm-agent/
      core.js                 PM Agent: system prompt, chat, summary, project generation
      context-builder.js      Construye contexto desde workspace.md + DB
    db/
      pool.js                 Pool de PostgreSQL compartido
      save_project.js         Helper para guardar proyectos
      schema.sql              Schema completo (18 tablas)
    workspace-skills/
      eod-generator.js        Genera EOD reports desde raw_events
  docker-compose.yml          PostgreSQL + Adminer (dev)
  docker-compose.production.yml  API + PostgreSQL (prod)
  Dockerfile                  Imagen Docker de produccion
  setup.sh                    Script de setup inicial
  seed-emirates.sql           Seed data de demo
  .env.example                Variables de entorno documentadas
  workspace.md                Descripcion del workspace (leido por PM Agent)
  ROADMAP.md                  Estado del producto y fases pendientes
```

---

## Variables de entorno

```
WORKSPACE_NAME=My Team          # Nombre del workspace (usado en prompts IA)
WORKSPACE_ROOT=.                # Raiz del workspace (para context-builder)
ANTHROPIC_API_KEY=sk-ant-...    # API key de Anthropic
PG_HOST=localhost
PG_PORT=5434
PG_DB=agentos
PG_USER=agentos
PG_PASSWORD=changeme
DASHBOARD_PORT=3001
VITE_API_URL=http://localhost:3001
SESSION_SECRET=change-this...   # Secret para express-session
ENCRYPTION_KEY=                 # Opcional, default = SESSION_SECRET
```

---

## Comandos

```bash
# Setup completo (DB + dependencias)
npm run setup

# Levantar base de datos
npm run db:up          # o: docker-compose up -d

# Desarrollo (frontend + backend concurrente)
npm start              # Vite (puerto 4000) + Express (puerto 3001)

# O por separado:
cd apps/dashboard && npm run dev    # Vite dev server (puerto 4000, proxy a 3001)
node apps/dashboard/server.js       # API backend (puerto 3001)

# Parar base de datos
npm run db:down
```

---

## Reglas de desarrollo

1. **Sin dependencias de Emiralia.** Este repo es 100% standalone. Nunca importar desde paths externos.
2. **ROADMAP.md es el norte.** Antes de proponer features, verificar que alinean con la fase actual.
3. **CSS custom properties.** Toda estilizacion usa variables CSS definidas en `index.css :root`. No usar Tailwind.
4. **i18n obligatorio.** Todo texto visible al usuario debe estar en `translations.js` (ES + EN).
5. **API_URL dinamico.** Siempre usar `import.meta.env.VITE_API_URL || '/api'`, nunca hardcodear localhost.
6. **Un solo server.js.** El backend es un archivo unico. No fragmentar en routers separados salvo que sea estrictamente necesario.
7. **Anthropic SDK.** Todo LLM usa Claude via `@anthropic-ai/sdk`. El modelo por defecto es `claude-sonnet-4-6`.

---

## Fase actual

Consultar `ROADMAP.md` para ver el estado detallado. Resumen rapido:

- **Fase 0** — Extraccion quirurgica: COMPLETADA
- **Fase 1** — Autenticacion single-tenant: COMPLETADA
- **Fase 2** — Settings UI + Docker production: COMPLETADA
- **Fase 3** — Soft launch: PENDIENTE (siguiente)
- **Fase 4** — Multi-tenancy: PENDIENTE

---

## Contexto de producto

AgentOS nacio como el dashboard interno de Emiralia (plataforma PropTech para hispanohablantes en EAU). Se extrajo como producto standalone porque sus features son domain-agnostic y aplican a cualquier equipo que opere con agentes IA.

**Target:** Solo founders y equipos pequenos que usan Claude/LLMs como agentes autonomos.
**Diferenciador:** No es Jira/Notion para humanos — es un OS para el workflow real de trabajar con agentes IA.
