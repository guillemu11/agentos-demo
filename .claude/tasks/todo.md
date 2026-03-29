# AgentOS — Active Tasks

## Current: Project 001 - Knowledge Base, RAG, Voice, AutoResearch

PDR completo en `projects/001-knowledge-base-rag-voice-autoresearch.md`

### Fase 1: Infraestructura Multi-Provider

- [x] Task 1.1: Instalar deps (`@google/generative-ai`, `@pinecone-database/pinecone`, `ws`) — 2026-03-28
- [x] Task 1.2: Crear `packages/core/ai-providers/gemini.js` — 2026-03-28
- [x] Task 1.3: Crear `packages/core/ai-providers/pinecone.js` — 2026-03-28
- [x] Task 1.4: Agregar API keys al backend (allowedKeys + init condicional en server.js) — 2026-03-28
- [x] Task 1.5: Agregar campos API keys en SettingsPage.jsx (Gemini + Pinecone) — 2026-03-28
- [x] Task 1.6: Crear 7 tablas nuevas en schema.sql — 2026-03-28
- [x] Task 1.7: Traducciones i18n para settings (ES + EN) — 2026-03-28
- [x] Task 1.8: Actualizar .env.example — 2026-03-28

### Fase 2: Knowledge Base + RAG Pipeline

- [x] Task 2.1: Crear modulo de ingestion (`packages/core/knowledge/ingestion.js`) — 2026-03-28
- [x] Task 2.2: Crear modulo de retrieval (`packages/core/knowledge/retrieval.js`) — 2026-03-28
- [x] Task 2.3: Endpoints KB en server.js (status, documents, ingest, search, delete) — 2026-03-28
- [x] Task 2.4: Pagina KnowledgeBase.jsx (Overview + Documents + Search tabs) — 2026-03-28
- [x] Task 2.5: Componente KnowledgeSearch.jsx (reutilizable, debounce, dropdown) — 2026-03-28
- [x] Task 2.6: Routing (`/app/knowledge`) + sidebar en Layout.jsx — 2026-03-28
- [x] Task 2.7: Traducciones KB (ES + EN, ~30 keys) — 2026-03-28
- [x] Task 2.8: CSS para KB (~200 lineas, tabs, stats, table, search, badges) — 2026-03-28

### Fase 3: RAG en Todos los Chats

- [x] Task 3.1: RAG en PM Agent chat (buildRAGContext + merge con projectContext) — 2026-03-28
- [x] Task 3.2: RAG en Agent chat (namespaces por departamento: strategic/execution/control) — 2026-03-28
- [x] Task 3.3: Campaign chat persistente + RAG (campaign_conversations table + filtered RAG) — 2026-03-28
- [x] Task 3.4: Endpoints GET/DELETE /api/campaigns/:id/conversation — 2026-03-28
- [x] Task 3.5: CampaignDetail.jsx: cargar conversacion al montar + boton "Clear chat" — 2026-03-28
- [x] Task 3.6: AgentChat.jsx: extraer X-RAG-Sources header + mostrar KB Sources indicator — 2026-03-28
- [x] Task 3.7: PMAgentChat.jsx: extraer X-RAG-Sources header — 2026-03-28
- [x] Task 3.8: CSS para RAG sources indicator — 2026-03-28

### Fase 4: Generacion de Emails desde Chat

- [x] Task 4.2: Endpoints email proposals en server.js (generate SSE, list, get, patch, delete, diff, duplicate) — 2026-03-28
- [x] Task 4.4: EmailProposalGenerator.jsx (markets/languages/tiers chips, SSE progress, instructions) — 2026-03-28
- [x] Task 4.5: EmailProposalViewer.jsx (iframe preview, copy blocks, diff, approve/reject, mobile/desktop toggle) — 2026-03-28
- [x] Task 4.7: CampaignDetail.jsx con tabs (Overview, Chat, Emails) + proposals grid — 2026-03-28
- [x] Task 4.9: Traducciones emails (ES + EN, ~30 keys) + CSS (~200 lineas) — 2026-03-28

### Fase 5: AutoResearch + Experimentos + Auto-mejora

- [x] Task 5.1: Research engine (`packages/core/research/engine.js`) — loop, web+KB search, synthesis, experiments — 2026-03-28
- [x] Task 5.3: Endpoints en server.js (create, list, detail, stream SSE, cancel, delete, experiments, auto-improve) — 2026-03-28
- [x] Task 5.4: AutoResearch.jsx page (new modal, sessions list, detail view, stream, report, experiments) — 2026-03-28
- [x] Task 5.7: CampaignDetail tab "Optimize" con auto-improve button — 2026-03-28
- [x] Task 5.8: Routing `/app/research` + sidebar "AutoResearch" — 2026-03-28
- [x] Task 5.9: Traducciones (ES+EN ~30 keys) + CSS (~80 lineas) — 2026-03-28

### Fase 6: Gemini Voice Real-Time

- [x] Task 6.1: WebSocket server (http.createServer + ws upgrade handler + voice proxy) — 2026-03-28
- [x] Task 6.2: useGeminiVoice.js hook (WebSocket + SpeechRecognition + TTS, auto-reconnect) — 2026-03-28
- [x] Task 6.3: VoiceOverlay.jsx (full-screen, avatar pulse, transcript, controls) — 2026-03-28
- [x] Task 6.4: VoiceModeButton en VoiceControls.jsx — 2026-03-28
- [x] Task 6.5: Integrar en AgentChat.jsx (voice mode button + overlay + message persistence) — 2026-03-28
- [x] Task 6.8: Traducciones (ES+EN ~7 keys) + CSS (~150 lineas overlay, rings, controls) — 2026-03-28

### Fase 7+8: Mejoras + Command Center + Kanban Multi-Type

- [x] Task 7.1: Campaign Comparison Chat endpoint (`POST /api/chat/compare`) — 2026-03-29
- [x] Task 7.4: Research-to-Campaign Pipeline (`POST /api/research/:id/to-inbox`) — 2026-03-29
- [x] Task 8.1: PipelineBoard multi-type (project, email, research, experiment) con type filters — 2026-03-29
- [x] Task 8.2: Pipeline unificado endpoint (UNION de 4 tablas, filtro por department/type) — 2026-03-29
- [x] Task 8.2b: PATCH `/api/pipeline/:type/:id/status` unificado — 2026-03-29
- [x] Task 8.4: WorkspaceOverview command center (active items cards + activity feed) — 2026-03-29
- [x] Task 8.4b: Endpoints `GET /api/pipeline/counts` + `GET /api/activity/recent` — 2026-03-29
- [x] Task 8.7: CSS activity feed + pipeline type colors — 2026-03-29

### Fase 9: Weekly Voice Meetings Hibridas

- [x] Task 9.2: VoiceMeeting.jsx (agenda sidebar, transcript, decision handling, TTS, summary) — 2026-03-29
- [x] Task 9.3: WebSocket `/ws/voice-meeting` (meeting orchestrator, agent roles, decision commands, auto-summary) — 2026-03-29
- [x] Task 9.3b: Meeting REST endpoints (GET list, GET detail, DELETE) — 2026-03-29
- [x] Task 9.1: "Start Hybrid Meeting" button in WeeklyBoard brainstorm tab — 2026-03-29
- [x] Task 9.5: meeting_sessions table (ya creada en Fase 1) — 2026-03-28
- [x] Task 9.8: Traducciones meeting (ES+EN ~11 keys) + CSS (~130 lineas) — 2026-03-29

---

## Backlog

- [ ] Fase 3: Soft launch (ROADMAP.md)
- [ ] Fase 4: Multi-tenancy (ROADMAP.md)

---

## Completed

(Se registran aqui las tasks completadas con fecha)