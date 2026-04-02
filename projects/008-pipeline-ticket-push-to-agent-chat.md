# Proyecto 008: Pipeline Ticket Push-to-Chat en Agent Views

**Status:** En progreso
**Fecha:** 2026-04-01
**Prioridad:** Alta — conecta el pipeline con la experiencia de trabajo de cada agente
**Prerequisito:** Proyecto 004 (pipeline backend), Proyecto 006 (pipeline visibility)

---

## Problema

Los agentes tienen tickets asignados en el pipeline pero no hay forma de trabajarlos desde su propia vista. El flujo actual requiere navegar al proyecto > pipeline > stage > chat (4 clicks). Ademas, el chat generico del agente no tiene contexto del proyecto.

**El usuario quiere**: ver el ticket asignado prominentemente en el agent view, hacer "push to chat" con todo el contexto heredado (trabajo previo de otros agentes, objetivo del proyecto, RAG), trabajar en el chat, y hacer handoff al siguiente agente — todo sin salir del agent view.

## Solucion

### Arquitectura: 3 componentes + 1 hook compartidos

1. **`useAgentPipelineSession`** — Hook que centraliza fetching de tickets activos, pipeline data, y estado de handoff
2. **`ActiveTicketBanner`** — Banner prominente arriba de los tabs del agent view cuando hay tickets activos
3. **`AgentChatSwitcher`** — Wrapper que alterna entre `AgentChat` (normal) y `ProjectAgentChat` (pipeline con contexto)
4. Integracion de `HandoffModal` existente en cada agent view

### Flujo

```
Agent View → Ver banner de ticket → Click "Trabajar en esto" → 
  Chat cambia a modo pipeline (ProjectAgentChat con contexto completo) →
  Trabajar con el agente → Handoff (3 modos: agente propone / humano decide / colaborativo) →
  Ticket pasa al siguiente agente
```

### Modos de handoff

1. **Agente propone**: AI responde con `[STAGE_READY: reason]` → barra verde de sugerencia
2. **Humano decide**: Boton "Handoff" siempre disponible en el input area
3. **Colaborativo**: Agente propone, humano confirma en modal con opcion de editar summary

### Archivos nuevos

- `apps/dashboard/src/hooks/useAgentPipelineSession.js`
- `apps/dashboard/src/components/agent-views/shared/ActiveTicketBanner.jsx`
- `apps/dashboard/src/components/agent-views/shared/AgentChatSwitcher.jsx`

### Archivos modificados

- `apps/dashboard/src/i18n/translations.js` — 5 keys nuevas
- `apps/dashboard/src/index.css` — ~60 lineas CSS
- `apps/dashboard/src/components/agent-views/GenericAgentView.jsx` — integracion completa
- 14 agent views especializados — patron identico ~10 lineas cada uno

### Sin cambios backend

Todos los endpoints necesarios ya existen:
- `GET /api/agents/:id/active-sessions`
- `GET /api/projects/:id/pipeline`
- `POST /api/projects/:id/sessions/:sessionId/chat`
- `POST /api/projects/:id/pipeline/handoff`
