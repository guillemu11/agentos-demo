---
paths:
  - "packages/core/db/**"
  - "seeds/**"
  - "apps/dashboard/server.js"
---

# Database Standards

## PostgreSQL 16

- Docker: `docker-compose.yml`, puerto 5434 (no 5432 default)
- Pool: singleton en `packages/core/db/pool.js` (pg.Pool)
- Credenciales: `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASSWORD`
- Alternativa: `DATABASE_URL` connection string

## Schema

- Archivo maestro: `packages/core/db/schema.sql` (todas las tablas)
- Tablas actuales: 18 principales + 2 auth
- Nuevas tablas para proyecto 001: `knowledge_documents`, `knowledge_chunks`, `research_sessions`, `email_proposals`, `campaign_conversations`, `campaign_experiments`, `meeting_sessions`

## Queries

- SIEMPRE queries parametrizadas: `$1, $2, $3` — nunca concatenar strings
- Transacciones para operaciones multi-tabla: `BEGIN` / `COMMIT` / `ROLLBACK`
- JSONB para datos flexibles: `skills`, `tools`, `metadata`, `messages`, `blocks`
- Indices en columnas de filtro frecuente: `status`, `department`, `agent_id`, `created_at`

## Patrones existentes

- Auto-update `updated_at` via trigger `update_updated_at()`
- CASCADE DELETE en relaciones padre-hijo (phases->tasks, documents->chunks)
- UNIQUE constraints para evitar duplicados (agent_conversations.agent_id, campaign_conversations.campaign_id)
- ON CONFLICT DO UPDATE para upserts (workspace_config)

## Migraciones

- No hay sistema de migraciones formal — cambios van directamente en `schema.sql`
- Para tablas nuevas: agregar `CREATE TABLE IF NOT EXISTS` al final de schema.sql
- Para seed data: archivos en `seeds/` (seed-emirates.sql, seed-emirates-demo.sql)