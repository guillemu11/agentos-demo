---
paths:
  - "apps/dashboard/server.js"
---

# API Design Standards

## Server Architecture

- Un solo archivo: `apps/dashboard/server.js` (~2700+ lineas)
- Express 5 con async handlers
- Secciones separadas por comentarios `// ═══════════ SECCION ═══════════`
- Puerto: `DASHBOARD_PORT` o 3001
- CORS habilitado para desarrollo

## Patrones de endpoints

- Auth middleware: `requireAuth` en todas las rutas `/api/*`
- Admin middleware: `requireOwnerOrAdmin` para endpoints sensibles (settings, users)
- Body parsing: `express.json()` con limite por defecto
- Respuestas: JSON con status codes apropiados (200, 201, 400, 401, 403, 404, 500)

## Chat endpoints (SSE)

- Patron: `POST /api/chat/{context}` con body `{ message, history? }`
- Response: `text/event-stream`
- Formato: `data: {"text":"chunk"}\n\n` y `data: [DONE]\n\n`
- Verificar `res.headersSent` antes de escribir errores
- Cleanup: `await stream.finalMessage()` + `res.end()`
- Headers custom: `X-Inbox-Item-Id`, `X-RAG-Sources`

## Endpoints existentes clave

- `/api/chat/pm-agent` — PM Agent con project context
- `/api/chat/agent/:agentId` — Agent-specific con system prompt dinamico
- `/api/chat/campaign/:campaignId` — Campaign context (actualmente stateless, migrar a persistente)
- `/api/inbox/*` — CRUD + state machine (chat -> borrador -> proyecto)
- `/api/settings/*` — Workspace config, departments, API keys (cifradas AES-256-CBC)
- `/api/pipeline` — Proyectos por departamento para kanban

## WebSocket

- Usar `ws` library, NO socket.io
- Setup via `server.on('upgrade', ...)` con `noServer: true`
- Paths: `/ws/voice` (single agent), `/ws/voice-meeting` (multi-agent)
- Validar session cookie en upgrade
- Proxy bidireccional: client <-> server <-> Gemini

## API Keys cifradas

- Storage: `workspace_config` tabla, key `api_keys`, value JSONB cifrado
- Cifrado: AES-256-CBC con `ENCRYPTION_KEY` o `SESSION_SECRET`
- `allowedKeys` array en PUT `/api/settings/api-keys` — agregar nuevas keys aqui
- GET devuelve keys masked (solo ultimos 4 chars)