# AgentOS — Roadmap de Producto

**The operating system for teams running AI agents.**

---

## Fase 0: Extraccion Quirurgica — COMPLETADA

Separar el dashboard de Emiralia en un repo standalone sin ninguna dependencia del monorepo original.

### Completado

- [x] Crear repo `agentOS/` con estructura `apps/dashboard/` + `packages/core/`
- [x] Copiar dashboard (React 19 + Express + Vite) al nuevo repo
- [x] Extraer dependencias compartidas a `packages/core/` (pm-agent, db, workspace-skills)
- [x] Generalizar `server.js`: imports, DEPT_META dinamico desde DB, quitar query a `properties`, quitar `scrape-propertyfinder`
- [x] Parametrizar PM Agent: `buildPMSystemPrompt(workspaceName)` con `WORKSPACE_NAME` env var
- [x] Generalizar context-builder: `WORKSPACE_ROOT` env var, lee `workspace.md` en vez de `CLAUDE.md`
- [x] 17 archivos frontend con `VITE_API_URL` dinamico (antes hardcoded `localhost:3001`)
- [x] Rebranding completo: "Emiralia OS" → "AgentOS" en UI, HTML, traducciones, localStorage
- [x] Schema workspace-only: 14 tablas + nueva `workspace_config` (sin tabla `properties`)
- [x] `docker-compose.yml` (PostgreSQL + Adminer), `.env.example`, `package.json` raiz
- [x] Verificacion: 0 matches de "Emiralia", "PropertyFinder" o "propiedades" en todo el repo
- [x] Git repo inicializado

### Estructura resultante

```
agentOS/
  apps/dashboard/
    src/                    11 pages, 9 components, i18n (ES/EN), 8 CSS themes
    server.js               API backend generalizado (~1600 lineas)
    package.json
  packages/core/
    pm-agent/core.js        System prompt parametrizado
    pm-agent/context-builder.js   Lee workspace.md + WORKSPACE_ROOT
    db/schema.sql           14 tablas workspace (sin properties)
    db/pool.js
    db/save_project.js
    workspace-skills/eod-generator.js
  docker-compose.yml        PostgreSQL 16 + Adminer
  .env.example
  workspace.md              Template para describir tu equipo
  package.json              Scripts: dev, server, db:up, setup
  ROADMAP.md                Este archivo
```

---

## Fase 1: Autenticacion Single-Tenant — COMPLETADA

Auth minimo para proteger el dashboard con password. Esto convierte AgentOS en un MVP vendible.

### Completado

- [x] Instalar `express-session`, `bcrypt`, `connect-pg-simple`
- [x] Crear tabla `workspace_users` (email, password_hash, role: owner/admin/member)
- [x] Crear tabla `sessions` (connect-pg-simple)
- [x] Endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- [x] Setup wizard: `GET /auth/setup-status` + `POST /auth/setup` (crear owner si no hay usuarios)
- [x] Middleware `requireAuth` en todas las rutas `/api/*`
- [x] `LoginPage.jsx` — form email/password con branding AgentOS + setup wizard integrado
- [x] `<AuthGate>` wrapper en `main.jsx` (verifica sesion, muestra login o app)
- [x] Indicador de usuario en `Layout.jsx` (email + role + boton logout con icono SVG)
- [x] Vite proxy configurado (`/api` + `/auth` → backend)
- [x] Default language cambiado a English (internacionalizacion)
- [x] CSS completo para login page y sidebar user indicator
- [ ] Probar: login, logout, sesion persistente, redirect a login si no autenticado

---

## Fase 2: Settings UI + Docker Production — COMPLETADA

UI para configurar el workspace sin tocar codigo + deployment one-command.

### Completado — Settings

- [x] Pagina `/settings` accesible desde sidebar
- [x] Tab "Workspace": nombre, descripcion (escribe a `workspace_config`)
- [x] Tab "Departments": CRUD de departamentos (nombre, emoji, color, descripcion)
- [x] Tab "API Keys": form para `ANTHROPIC_API_KEY` (guardado seguro con AES-256-CBC)
- [x] Tab "Users": gestionar usuarios del workspace (solo owner/admin)
- [x] Middleware `requireOwnerOrAdmin` para RBAC en endpoints sensibles
- [x] 10 endpoints API bajo `/api/settings/*`
- [x] Traducciones completas ES/EN (~40 keys)

### Completado — Docker

- [x] `Dockerfile` multi-stage: build frontend + serve con Express
- [x] `docker-compose.production.yml`: api + postgres (sin Adminer)
- [x] `setup.sh`: docker-compose up + migraciones + prompt para workspace name/email/password
- [ ] Documentar en README.md: requisitos, instalacion, configuracion

---

## Fase 3: Soft Launch — PENDIENTE

Lanzamiento inicial para validar demanda.

### Tareas

- [ ] Landing page simple (puede ser una pagina en el propio AgentOS o externa)
- [ ] Post en X/Twitter: "Construi un OS para mi equipo de agentes IA"
- [ ] Publicar en comunidades: Indie Hackers, HN Show HN, r/SideProject
- [ ] Lifetime deal $297-$497 en Gumroad o Lemon Squeezy
- [ ] Recoger feedback de primeros 3-5 compradores
- [ ] Iterar basado en feedback

---

## Fase 4: Multi-Tenancy — PENDIENTE (solo cuando haya 5+ clientes pidiendo cloud)

Convertir AgentOS de single-tenant a multi-tenant. Cada equipo obtiene su propio workspace aislado con datos completamente separados. Enfoque: **soft multi-tenancy** (misma DB, columna `tenant_id` en cada tabla).

### 4A — Schema y Base de Datos

**Estado actual:** 14+ tablas sin `tenant_id`, namespace plano sin aislamiento.

- [ ] Tabla `tenants` (id UUID PK, slug UNIQUE, name, plan CHECK free/starter/pro, max_agents DEFAULT 10, created_at)
- [ ] Tabla `tenant_users` (tenant_id FK, user_id FK, role CHECK owner/admin/member, PRIMARY KEY tenant_id+user_id) — un usuario puede pertenecer a multiples tenants
- [ ] Agregar columna `tenant_id UUID REFERENCES tenants(id)` a las 14 tablas existentes: `projects`, `phases`, `tasks`, `agents`, `agent_memory`, `eod_reports`, `raw_events`, `weekly_sessions`, `weekly_brainstorms`, `inbox_items`, `audit_log`, `pm_reports`, `workflow_runs`, `collaboration_raises`, `workspace_config`, `workspace_users`
- [ ] Crear indices en `tenant_id` para cada tabla
- [ ] Migracion para instancias existentes: crear tenant default + asignar tenant_id a datos existentes

### 4B — Middleware y Backend

**Estado actual:** `server.js` tiene ~50 endpoints, ~111 `pool.query()` calls, sesion almacena solo `userId/userEmail/userRole`.

- [ ] Middleware `tenantFromSession`: extrae `req.tenantId` desde `req.session.tenantId`, retorna 400 si no hay tenant
- [ ] Middleware `tenantFromSubdomain`: parsea hostname (ej. `myteam.agentos.io` → slug `myteam`), resuelve tenant_id desde DB
- [ ] Aplicar cadena: `app.use('/api', requireAuth, tenantFromSession)`
- [ ] Actualizar sesion para almacenar `tenantId` y `tenantSlug` al login/setup
- [ ] Actualizar **todas** las queries (~111 calls) para filtrar por `tenant_id`:
  - SELECT: agregar `WHERE tenant_id = $N`
  - INSERT: agregar `tenant_id` como columna
  - UPDATE/DELETE: agregar `AND tenant_id = $N` al WHERE
- [ ] Helper `tenantQuery(sql, params, tenantId)` para evitar olvidar el filtro
- [ ] Actualizar `GET /auth/me` → devolver `{ user, tenant: { id, name, slug } }`

### 4C — Signup Flow (Crear tenant + owner en un solo paso)

- [ ] Modificar `POST /auth/setup` → `POST /auth/signup`: recibe `{ email, password, name, tenantName, tenantSlug }`, crea tenant + usuario + relacion tenant_users con role owner
- [ ] Nuevo endpoint `GET /auth/check-slug/:slug` — valida disponibilidad
- [ ] Modificar `POST /auth/login`: buscar tenants del usuario en `tenant_users`, auto-seleccionar si tiene 1, devolver lista si tiene multiples
- [ ] Nuevo endpoint `POST /auth/select-tenant` — para usuarios multi-tenant
- [ ] Frontend `LoginPage.jsx`: agregar campos "Workspace Name" + "Workspace Slug" con preview del subdominio en modo setup

### 4D — Frontend Multi-Tenant

- [ ] Crear `TenantContext.jsx` (similar a LanguageContext): almacena tenant actual (id, slug, name), Provider wraps la app
- [ ] Actualizar `main.jsx` AuthGate: detectar subdominio, pasar tenant al TenantProvider
- [ ] Actualizar `Layout.jsx`: mostrar nombre del tenant en sidebar + tenant switcher dropdown si usuario tiene multiples tenants
- [ ] Todas las pages ya usan `API_URL = import.meta.env.VITE_API_URL || '/api'` — el tenant se resuelve via sesion/middleware, no via URL path (las URLs no cambian)
- [ ] Actualizar `SettingsPage.jsx`: settings se vuelven tenant-specific
- [ ] Agregar traducciones i18n (~20 keys: signup, tenant switcher, errores de tenant)

### 4E — Subdominios (`yourteam.agentos.io`)

- [ ] Backend: middleware `tenantFromSubdomain` antes de auth — parsea hostname, resuelve tenant
- [ ] Frontend: detectar subdominio en `main.jsx`, pasar slug al AuthGate para auto-resolver tenant
- [ ] Vite config: `server.host` para aceptar cualquier hostname en dev
- [ ] Produccion: Nginx/Caddy wildcard config `*.agentos.io` → backend
- [ ] DNS: wildcard A record `*.agentos.io`

### 4F — Billing (Stripe) — Separado

- [ ] Stripe integration (checkout, webhooks, portal)
- [ ] Pricing: $29/mes starter (10 agentes), $79/mes pro (ilimitado)
- [ ] Enforcement: validar `max_agents` del tenant al crear agentes
- [ ] Tabla `subscriptions` (tenant_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)

### Notas tecnicas

- **Pool.js vs server.js:** server.js crea su propio pool (port 5434), pool.js usa port 5433. Solo server.js se usa activamente.
- **Aislamiento critico:** Cada query DEBE filtrar por tenant_id. Un query sin filtro = data leak entre tenants.
- **PM Agent:** `packages/core/pm-agent/core.js` y `context-builder.js` necesitan recibir tenantId para construir contexto del tenant correcto.
- **Verificacion:** Crear 2 tenants y verificar que datos son 100% aislados en todas las pages.

---

## Modelo de Negocio

| Etapa | Modelo | Precio | Cuando |
|-------|--------|--------|--------|
| 1 | Lifetime deal (self-hosted) | $297-$497 | Primeros 10 clientes |
| 2 | SaaS cloud-hosted | $29-$79/mes | Cuando haya multi-tenancy |
| 3 | Enterprise | Custom | Cuando haya traccion significativa |

---

## Relacion con Emiralia

Emiralia se convierte en un **cliente/instancia de AgentOS**. El repo de Emiralia mantiene:
- `apps/website/` — portal publico de propiedades
- `tools/` — scripts especificos (scrapers, telegram, etc.)
- `.claude/` — WAT framework (agents, skills, workflows)

Y apunta a una instancia de AgentOS para la gestion interna del equipo de agentes.

---

## Como usar este documento

Al iniciar una nueva conversacion con Claude, referencia este archivo:

> "Estamos trabajando en AgentOS. Lee `ROADMAP.md` para ver el estado actual. Vamos por la Fase X."

Esto da contexto completo sin necesidad de repetir el historial.
