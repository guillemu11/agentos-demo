---
paths:
  - "apps/dashboard/server.js"
  - "apps/dashboard/src/**"
  - "packages/core/**"
---

# Security Standards

## Authentication

- express-session + connect-pg-simple (sessions en PostgreSQL)
- Passwords: bcrypt con salt rounds por defecto
- Session cookie: httpOnly (configurado por connect-pg-simple)
- Roles: owner, admin, member — RBAC via middleware

## API Keys

- Cifradas con AES-256-CBC antes de guardar en DB
- `ENCRYPTION_KEY` env var (fallback: `SESSION_SECRET`)
- Nunca loggear API keys en consola o responses
- GET endpoint devuelve solo ultimos 4 caracteres (masked)
- Nunca exponer keys al frontend — solo el backend las usa

## Input Validation

- Queries parametrizadas: `$1, $2` — NUNCA concatenar input del usuario en SQL
- Validar tipos y rangos en endpoints antes de queries
- Sanitizar input para prevenir XSS (React lo hace por defecto con JSX)
- Escapar contenido markdown si se renderiza como HTML

## CORS

- Habilitado para desarrollo (permite localhost)
- En produccion: restringir a dominios especificos

## Secrets en codigo

- Nunca commitear `.env` (esta en `.gitignore`)
- `.env.example` con placeholders, sin valores reales
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PINECONE_API_KEY` — solo via env vars o DB cifrada