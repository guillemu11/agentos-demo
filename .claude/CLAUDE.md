# AgentOS

OS para equipos que trabajan con agentes IA. Dashboard centralizado: proyectos, agentes, standups, weeklies, campanas, workflows.

## Stack

| Capa | Tech |
|------|------|
| Frontend | React 19, React Router 7, Recharts 3, Vite 7, lucide-react |
| Styling | CSS custom properties (NO Tailwind) |
| Backend | Express 5, un solo `server.js` |
| Auth | bcrypt, express-session, connect-pg-simple |
| DB | PostgreSQL 16 (Docker, puerto 5434) |
| AI | Anthropic SDK (`claude-sonnet-4-6`), Google Gemini (embeddings + voz), Pinecone (vectores) |
| i18n | Custom context + `translations.js` (ES + EN) |

## Comandos

```bash
npm run setup          # DB + deps + migrations
npm run db:up          # Docker PostgreSQL + Adminer
npm start              # Vite (4000) + Express (3001) concurrente
npm run db:down        # Parar DB
```

## Reglas criticas

1. **100% standalone** — cero imports externos
2. **CSS custom properties** — variables en `index.css :root`, nunca Tailwind
3. **i18n obligatorio** — todo texto en `translations.js` (ES + EN)
4. **API_URL dinamico** — `import.meta.env.VITE_API_URL || '/api'`
5. **Un solo server.js** — no fragmentar en routers
6. **Queries parametrizadas** — siempre `$1, $2`, nunca string concatenation
7. **ROADMAP.md es el norte** — verificar alineacion antes de proponer features

## Reglas por area

Reglas detalladas por dominio en `.claude/rules/`:
- `ai-integrations.md` — Claude, Gemini, Pinecone, RAG pipeline
- `database.md` — PostgreSQL, schema, migrations, transactions
- `api-design.md` — Express endpoints, SSE streaming, WebSocket
- `frontend.md` — React, CSS, i18n, componentes
- `security.md` — auth, encryption, input validation

## Workflow Orchestration

### 1. Plan Mode Default
- Entrar en plan mode para cualquier task no-trivial (3+ pasos o decisiones arquitecturales)
- Si algo sale mal, STOP y re-planificar — no seguir empujando
- Escribir specs detalladas upfront para reducir ambiguedad

### 2. Subagent Strategy
- Usar subagentes para mantener el contexto principal limpio
- Offload research, exploracion y analisis en paralelo
- Un task por subagente para ejecucion enfocada

### 3. Self-Improvement Loop
- Despues de CUALQUIER correccion: actualizar `.claude/tasks/lessons.md` con el patron
- Escribir reglas que prevengan repetir el mismo error
- Revisar lessons al inicio de cada sesion relevante

### 4. Verification Before Done
- Nunca marcar una task como completada sin probar que funciona
- Diff entre main y tus cambios cuando sea relevante
- Preguntarse: "Aprobaria esto un staff engineer?"
- Correr tests, verificar logs, demostrar correctness

### 5. Demand Elegance (Balanced)
- Para cambios no-triviales: pausar y preguntar "hay una forma mas elegante?"
- Si un fix se siente hacky: implementar la solucion elegante
- Skip para fixes simples y obvios — no sobre-ingeniar

### 6. Autonomous Bug Fixing
- Ante un bug report: arreglarlo directamente, no pedir hand-holding
- Apuntar a logs, errores, tests fallidos — y resolverlos
- Zero context switching para el usuario

## Task Management

1. **Plan First**: escribir plan en `.claude/tasks/todo.md` con items checkeables
2. **Verify Plan**: check-in antes de empezar implementacion
3. **Track Progress**: marcar items completados conforme avanzas
4. **Explain Changes**: resumen high-level en cada paso
5. **Document Results**: agregar seccion de review a `todo.md`
6. **Capture Lessons**: actualizar `.claude/tasks/lessons.md` despues de correcciones

## Core Principles

- **Simplicity First** — hacer cada cambio lo mas simple posible. Minimo codigo
- **No Laziness** — encontrar root causes. Cero fixes temporales. Estandares de senior dev
- **Minimal Impact** — solo tocar lo necesario. Evitar introducir bugs

## Proyecto activo

PDR detallado en `projects/001-knowledge-base-rag-voice-autoresearch.md`
Roadmap del producto en `ROADMAP.md`

## Contexto de producto

Target: founders y equipos pequenos usando Claude/LLMs como agentes autonomos.
Diferenciador: no es Jira/Notion para humanos — es un OS para el workflow real con agentes IA.