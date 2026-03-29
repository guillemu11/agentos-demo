# PDR: Knowledge Base, Email Proposals, AutoResearch, Gemini Voice, Experimentos

## Context

AgentOS tiene 34 campanas lifecycle + 26 BAU types, 13+ agentes especializados, y chats con Claude via SSE streaming. Actualmente NO hay RAG, embeddings, vector DB, ni voz avanzada (solo Web Speech API nativa). El objetivo es transformar AgentOS en una plataforma inteligente con:

1. **Base de conocimiento** (Pinecone + Gemini embeddings) que alimenta todos los chats
2. **Generacion de emails** reales desde el chat, con diff visual y copy/paste
3. **AutoResearch** web + interno con experimentos y auto-mejora de campanas
4. **Voz bidireccional real-time** con Gemini Multimodal Live API
5. **Arquitectura hibrida**: generica + seed data Emirates como demo

### Decisiones del usuario
- **AutoResearch:** Web + interno (internet + KB propia) + experimentos/auto-mejora
- **Emails:** Demo-first con screenshots reales. Futuro: API Marketing Cloud
- **Voz:** Conversacion real-time bidireccional (Gemini Multimodal Live)
- **Scope:** Hibrido (generico + Emirates seed)

---

## Arquitectura General

```
                    +------------------+
                    |   Frontend React |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
         SSE Chat      WebSocket       REST API
         (Claude)      (Gemini Voice)   (CRUD)
              |              |              |
              +--------------+--------------+
                             |
                    +--------+---------+
                    |   Express server |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
   Claude (Anthropic)   Gemini (Google)      Pinecone
   - Razonamiento       - Embeddings         - Vector Store
   - Generacion         - Voz multimodal     - Busqueda semantica
   - Email copy/HTML    - Search grounding   - Por namespace
         |                   |                   |
         +-------------------+-------------------+
                             |
                    +--------+---------+
                    |   PostgreSQL     |
                    +------------------+
```

**Claude** = razonamiento, generacion de copy/HTML, sintesis de research
**Gemini** = embeddings (text-embedding-004), voz real-time, web search grounding
**Pinecone** = vector store con namespaces por area

---

# FASE 1: INFRAESTRUCTURA MULTI-PROVIDER

**Objetivo:** Establecer la base para Gemini + Pinecone junto a Claude existente.
**Agentes requeridos:** Cloud Architect (Guillermo), PM Agent

## Task 1.1: Instalar dependencias
- Agregar a `package.json` (raiz): `@google/generative-ai`, `@pinecone-database/pinecone`, `ws`
- `npm install`

## Task 1.2: Crear modulo Gemini
- **Crear** `packages/core/ai-providers/gemini.js`
  - `initGemini(apiKey)` -> instancia GoogleGenerativeAI
  - `embedText(text)` -> vector float[] usando modelo `text-embedding-004`
  - `embedBatch(texts)` -> array de vectores (batch de hasta 100)
  - `createVoiceSession(config)` -> sesion Multimodal Live API
  - Manejo de errores + rate limiting basico

## Task 1.3: Crear modulo Pinecone
- **Crear** `packages/core/ai-providers/pinecone.js`
  - `initPinecone(apiKey, environment)` -> instancia Pinecone
  - `getIndex(indexName)` -> referencia al indice
  - `upsertVectors(namespace, vectors[])` -> upsert batch
  - `queryVectors(namespace, embedding, { topK, filter })` -> resultados
  - `deleteVectors(namespace, ids[])` -> eliminar
  - `listNamespaces()` -> namespaces activos

## Task 1.4: Agregar API keys al backend
- **Modificar** `apps/dashboard/server.js` linea 2596:
  - Agregar a `allowedKeys`: `'gemini'`, `'pinecone_api_key'`, `'pinecone_environment'`, `'pinecone_index'`
- Agregar inicializacion condicional de clientes Gemini y Pinecone al arranque del server (junto al Anthropic client existente en linea ~51)
- Los clientes solo se inicializan si las API keys estan configuradas

## Task 1.5: Agregar campos API keys en Settings UI
- **Modificar** `apps/dashboard/src/pages/SettingsPage.jsx` - ApiKeysTab (linea 256):
  - Agregar al array `services`:
    - `{ key: 'gemini', label: 'Google Gemini API Key', placeholder: 'AIza...', type: 'password' }`
    - `{ key: 'pinecone_api_key', label: 'Pinecone API Key', placeholder: 'pc-...', type: 'password' }`
    - `{ key: 'pinecone_environment', label: 'Pinecone Environment', placeholder: 'us-east-1', type: 'text' }`
    - `{ key: 'pinecone_index', label: 'Pinecone Index Name', placeholder: 'agentos-kb', type: 'text' }`

## Task 1.6: Crear tablas en PostgreSQL
- **Modificar** `packages/core/db/schema.sql` - Agregar 5 tablas nuevas:

```sql
-- 1. Knowledge Documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    namespace TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    chunk_count INTEGER DEFAULT 0,
    embedding_model TEXT DEFAULT 'text-embedding-004',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','indexed','error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Knowledge Chunks
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    pinecone_id TEXT UNIQUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Research Sessions
CREATE TABLE IF NOT EXISTS research_sessions (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    depth TEXT DEFAULT 'standard' CHECK (depth IN ('quick','standard','deep')),
    sources_mode TEXT DEFAULT 'both' CHECK (sources_mode IN ('web','internal','both')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','researching','synthesizing','completed','failed')),
    progress INTEGER DEFAULT 0,
    sources_found INTEGER DEFAULT 0,
    iterations INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 5,
    report_md TEXT,
    report_sections JSONB DEFAULT '[]',
    search_queries JSONB DEFAULT '[]',
    sources JSONB DEFAULT '[]',
    experiments JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    error TEXT,
    campaign_id TEXT,
    triggered_by TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Email Proposals
CREATE TABLE IF NOT EXISTS email_proposals (
    id SERIAL PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    market TEXT NOT NULL,
    language TEXT NOT NULL,
    tier TEXT,
    subject_line TEXT,
    preview_text TEXT,
    html_content TEXT,
    copy_blocks JSONB DEFAULT '{}',
    segmentation_logic JSONB DEFAULT '{}',
    personalization_rules JSONB DEFAULT '[]',
    diff_from_base JSONB,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','review','approved','rejected')),
    feedback JSONB DEFAULT '[]',
    generated_by TEXT DEFAULT 'ai',
    parent_proposal_id INTEGER REFERENCES email_proposals(id),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Campaign Conversations (persistir chats stateless)
CREATE TABLE IF NOT EXISTS campaign_conversations (
    id SERIAL PRIMARY KEY,
    campaign_id TEXT NOT NULL UNIQUE,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Campaign Experiments (auto-mejora)
CREATE TABLE IF NOT EXISTS campaign_experiments (
    id SERIAL PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    research_session_id INTEGER REFERENCES research_sessions(id),
    experiment_type TEXT NOT NULL CHECK (experiment_type IN ('subject_line','copy','design','segmentation','send_time','cta')),
    hypothesis TEXT NOT NULL,
    variant_a JSONB NOT NULL,
    variant_b JSONB NOT NULL,
    status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed','approved','running','completed','cancelled')),
    results JSONB,
    winner TEXT,
    confidence_level NUMERIC,
    improvement_pct NUMERIC,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Task 1.7: Traducciones i18n
- **Modificar** `apps/dashboard/src/i18n/translations.js`:
  - Agregar keys bajo `settings`: `geminiKey`, `pineconeKey`, `pineconeEnv`, `pineconeIndex` + hints (ES+EN)

## Task 1.8: Agregar .env variables
- **Modificar** `.env.example`:
  - `GEMINI_API_KEY=` (opcional, se puede configurar desde UI)
  - `PINECONE_API_KEY=`
  - `PINECONE_ENVIRONMENT=`
  - `PINECONE_INDEX=agentos-kb`

---

# FASE 2: KNOWLEDGE BASE + RAG PIPELINE

**Objetivo:** Sistema de ingestion, embedding y busqueda semantica.
**Agentes requeridos:** Cloud Architect (Guillermo), Content Agent (Lucia), Analytics Agent (Carlos)

## Task 2.1: Crear modulo de ingestion
- **Crear** `packages/core/knowledge/ingestion.js`
  - `chunkText(text, { chunkSize: 500, overlap: 50 })` -> array de chunks con offsets
  - `extractMetadata(source)` -> metadata object (campaign_id, market, language, tier, content_type)
  - `ingestDocument({ title, content, namespace, sourceType, sourceId, metadata })`:
    1. Guardar en `knowledge_documents` con status `processing`
    2. Chunking del content
    3. Batch embed con Gemini `embedBatch()`
    4. Upsert a Pinecone con metadata en cada vector
    5. Guardar chunks en `knowledge_chunks`
    6. Actualizar document status a `indexed`
  - `ingestCampaigns()` -> ingesta las 34 campanas de `emiratesCampaigns.js` (namespace: `campaigns`)
  - `ingestBauTypes()` -> ingesta los 26 BAU types de `emiratesBauTypes.js` (namespace: `campaigns`)
  - `ingestImage({ url, description, metadata })` -> ingesta descripcion de imagen (namespace: `images`)
  - `ingestEmailScreenshot({ campaignId, imageBuffer, description })` -> procesa screenshot con Claude Vision, extrae copy/structure, ingesta en namespace `emails`
  - `reindexAll()` -> reindexa todo (borra y re-ingesta)

## Task 2.2: Crear modulo de retrieval
- **Crear** `packages/core/knowledge/retrieval.js`
  - `searchKnowledge(query, { namespace, topK: 5, filter, minScore: 0.7 })`:
    1. Embed query con Gemini
    2. Query Pinecone con filtros de metadata
    3. Enriquecer resultados con data de `knowledge_chunks` + `knowledge_documents`
    4. Retornar array de `{ content, score, metadata, documentTitle }`
  - `buildRAGContext(query, { namespaces: ['campaigns', 'emails', 'kpis'], maxTokens: 2000 })`:
    1. Buscar en multiples namespaces
    2. Rankear y deduplicate
    3. Formatear como bloque de texto para system prompt:
       ```
       [CONOCIMIENTO RELEVANTE - Base de Datos Interna]
       ---
       Fuente: {title} (score: {score})
       {content}
       ---
       ```
    4. Truncar a maxTokens
  - `searchImages(description, { topK: 5 })` -> busqueda en namespace `images`, retorna URLs + descriptions
  - `searchEmails(query, { campaignId, market, language, tier })` -> busqueda filtrada en namespace `emails`

## Task 2.3: Endpoints Knowledge Base en server.js
- **Modificar** `apps/dashboard/server.js` - agregar seccion `// ═══════════ KNOWLEDGE BASE ═══════════`:
  - `POST /api/knowledge/ingest` - Ingestar un documento manual
    - Body: `{ title, content, namespace, sourceType, metadata }`
    - Respuesta: `{ documentId, status }`
  - `POST /api/knowledge/ingest-campaigns` - Trigger ingestion de todas las campanas + BAU types
    - No body, procesa `emiratesCampaigns.js` + `emiratesBauTypes.js`
    - Respuesta: `{ documentsCreated, chunksCreated }`
  - `POST /api/knowledge/ingest-screenshot` - Upload screenshot de email para ingestar
    - Body: multipart/form-data con `image` + `campaignId` + `market` + `language` + `tier`
    - Usa Claude Vision para extraer copy/estructura del screenshot
    - Ingesta en namespace `emails`
  - `POST /api/knowledge/search` - Busqueda semantica
    - Body: `{ query, namespace?, filter?, topK? }`
    - Respuesta: `{ results: [{ content, score, metadata, documentTitle }] }`
  - `GET /api/knowledge/status` - Status de la KB
    - Respuesta: `{ totalDocuments, totalChunks, namespaces: { name: { docs, chunks } }, lastIngestion }`
  - `GET /api/knowledge/documents` - Listar documentos
    - Query: `?namespace=&status=&page=&limit=`
  - `DELETE /api/knowledge/documents/:id` - Eliminar documento + sus vectores de Pinecone

## Task 2.4: Pagina Knowledge Base (frontend)
- **Crear** `apps/dashboard/src/pages/KnowledgeBase.jsx`:
  - **Tab "Overview":**
    - Cards con metricas: total docs, total chunks, namespaces activos
    - Chart de distribucion por namespace (BarChart)
    - Ultimo ingestion timestamp
    - Botones: "Ingest All Campaigns", "Reindex All"
  - **Tab "Documents":**
    - Tabla con: title, namespace, source_type, chunk_count, status, created_at
    - Filtros por namespace y status
    - Acciones: ver detalle, eliminar
  - **Tab "Search":**
    - Input de busqueda semantica
    - Selector de namespace (all, campaigns, emails, images, kpis, research)
    - Resultados como cards con score, metadata, contenido truncado
    - Boton "Copy to clipboard" en cada resultado
  - **Tab "Upload":**
    - Drag & drop zone para screenshots de emails
    - Formulario: campaign, market, language, tier
    - Preview de la imagen subida
    - Boton "Ingest" que sube y procesa

## Task 2.5: Componente KnowledgeSearch reutilizable
- **Crear** `apps/dashboard/src/components/KnowledgeSearch.jsx`:
  - Input con icono de busqueda
  - Props: `namespace`, `onSelect(result)`, `placeholder`
  - Dropdown con resultados al escribir (debounce 300ms)
  - Score badge + namespace tag en cada resultado
  - Embeddable en cualquier pagina/chat

## Task 2.6: Routing y navegacion
- **Modificar** `apps/dashboard/src/main.jsx`:
  - Import `KnowledgeBase` page
  - Agregar ruta: `<Route path="/knowledge" element={<KnowledgeBase />} />`
- **Modificar** `apps/dashboard/src/components/Layout.jsx`:
  - Agregar al grupo "Control": `{ to: '/app/knowledge', icon: icons.intelligence, label: t('layout.knowledgeBase') }`
  - Nota: reutilizar icono existente o agregar uno nuevo en `icons.jsx`

## Task 2.7: Traducciones KB
- **Modificar** `apps/dashboard/src/i18n/translations.js`:
  - ~40 keys: `knowledge.title`, `knowledge.overview`, `knowledge.documents`, `knowledge.search`, `knowledge.upload`, `knowledge.ingestAll`, `knowledge.reindex`, `knowledge.namespace`, `knowledge.score`, `knowledge.noResults`, `knowledge.uploading`, `knowledge.processing`, etc.

## Task 2.8: CSS para KB
- **Modificar** `apps/dashboard/src/index.css`:
  - Estilos para: knowledge cards, search results, upload dropzone, namespace tags, score badges
  - Seguir patron existente de CSS custom properties

---

# FASE 3: RAG EN TODOS LOS CHATS

**Objetivo:** Todos los chats (PM Agent, agentes, campanas) enriquecidos con contexto RAG.
**Agentes requeridos:** Todos los agentes (beneficiarios del RAG)

## Task 3.1: Modificar endpoint chat PM Agent
- **Modificar** `apps/dashboard/server.js` endpoint `POST /api/chat/pm-agent` (~linea 1924):
  - Antes de llamar a `chatWithPMAgent()`:
    1. Llamar `buildRAGContext(message, { namespaces: ['campaigns', 'kpis', 'research'] })`
    2. Agregar RAG context al `projectContext` existente
  - Enviar RAG results como header `X-RAG-Sources` (JSON stringified) para que el frontend los muestre

## Task 3.2: Modificar endpoint chat Agent
- **Modificar** `apps/dashboard/server.js` endpoint `POST /api/chat/agent/:agentId` (~linea 2142):
  - Determinar namespaces segun departamento del agente:
    - Strategic (raul, valentina, guillermo): `['campaigns', 'kpis', 'research']`
    - Execution (lucia, diego, andres, martina, html-developer): `['campaigns', 'emails', 'images', 'brand']`
    - Control (sofia, javier, elena, carlos, doc-agent): `['campaigns', 'kpis', 'brand']`
  - Llamar `buildRAGContext(message, { namespaces })` antes de Claude
  - Inyectar en system prompt override

## Task 3.3: Modificar endpoint chat Campaign + persistencia
- **Modificar** `apps/dashboard/server.js` endpoint `POST /api/chat/campaign/:campaignId` (~linea 2326):
  - **Persistencia:** Cambiar de stateless a persistente:
    1. Cargar mensajes de `campaign_conversations` (crear si no existe)
    2. Agregar mensaje del usuario
    3. Guardar despues de respuesta completa
  - **RAG:** Llamar `buildRAGContext(message, { namespaces: ['campaigns', 'emails', 'kpis'], filter: { campaign_id: campaignId } })` con filtro por campana
  - Nuevo endpoint `GET /api/campaigns/:campaignId/conversation` - Cargar chat
  - Nuevo endpoint `DELETE /api/campaigns/:campaignId/conversation` - Limpiar chat

## Task 3.4: Chat Asset Panel (frontend)
- **Crear** `apps/dashboard/src/components/ChatAssetPanel.jsx`:
  - Panel lateral que aparece cuando hay resultados RAG
  - Sections por tipo: "Emails", "Images", "KPIs", "Research"
  - Cada item clickable: preview expandible
  - Boton "Copy" para copiar contenido al clipboard
  - Boton "Use in chat" para insertar referencia en el input
  - Para emails: preview de HTML en mini-iframe
  - Para imagenes: thumbnail + descripcion
  - Para KPIs: mini chart o tabla

## Task 3.5: Inline RAG Results en chat
- **Crear** `apps/dashboard/src/components/ChatSearchResults.jsx`:
  - Cuando el asistente cita datos de la KB, mostrar inline como cards expandibles
  - Detectar patron `[KB:docId]` en respuesta de Claude -> renderizar como card
  - Card muestra: fuente, score, contenido completo al expandir

## Task 3.6: Actualizar CampaignDetail con chat persistente + RAG
- **Modificar** `apps/dashboard/src/pages/CampaignDetail.jsx`:
  - Agregar `useEffect` para cargar conversacion existente al montar
  - Agregar boton "Clear chat" (DELETE endpoint)
  - Agregar `ChatAssetPanel` al lado del chat
  - Agregar voice controls (preparar para Fase 6)
  - Layout: chat panel + asset panel side by side

## Task 3.7: Actualizar AgentChat con RAG
- **Modificar** `apps/dashboard/src/components/AgentChat.jsx`:
  - Agregar state para RAG sources recibidas via header `X-RAG-Sources`
  - Renderizar `ChatAssetPanel` cuando hay sources
  - El panel se colapsa/expande con toggle

## Task 3.8: Actualizar PMAgentChat con RAG
- **Modificar** `apps/dashboard/src/components/PMAgentChat.jsx`:
  - Misma logica que AgentChat: extraer RAG sources del header, mostrar asset panel

## Task 3.9: Traducciones + CSS
- **Modificar** `translations.js`: ~20 keys para asset panel, search results, KB references
- **Modificar** `index.css`: estilos para asset panel, inline search cards, expandible cards

---

# FASE 4: GENERACION DE EMAILS DESDE CHAT

**Objetivo:** Generar emails reales con HTML desde cualquier chat, con diff visual y copy/paste.
**Agentes requeridos:** Content Agent (Lucia), HTML Developer, Brand Guardian (Sofia), Segmentation Agent (Diego)

## Task 4.1: Configurar mercados/idiomas/tiers en Settings
- **Modificar** `apps/dashboard/src/pages/SettingsPage.jsx`:
  - Nueva tab "Markets" (o seccion dentro de Workspace):
    - CRUD de mercados: `{ id, name, code, languages: [] }`
    - CRUD de tiers: `{ id, name, level }`
    - Seed con Emirates: UAE (EN,AR), UK (EN), DE (DE,EN), FR (FR,EN), KSA (AR,EN) + tiers Blue/Silver/Gold/Platinum
- **Modificar** `apps/dashboard/server.js`:
  - `GET/PUT /api/settings/markets` -> workspace_config key `markets`
  - `GET/PUT /api/settings/tiers` -> workspace_config key `tiers`

## Task 4.2: Endpoint generacion de email
- **Modificar** `apps/dashboard/server.js` - agregar seccion `// ═══════════ EMAIL PROPOSALS ═══════════`:
  - `POST /api/campaigns/:campaignId/emails/generate` (SSE stream):
    - Body: `{ markets: ['UAE','UK'], languages: ['en','ar'], tiers: ['Gold','Platinum'], referenceProposalId?, instructions? }`
    - Flujo:
      1. RAG busca: screenshots/templates ingestados de esa campana, brand guidelines, copies similares
      2. Genera email master (EN) con Claude: subject, preview, HTML completo, copy blocks
      3. Para cada combinacion market/language/tier: genera variante localizada
      4. Cada variante se guarda en `email_proposals`
      5. Stream progreso via SSE: `data: {"phase":"generating","variant":"UAE-AR-Gold","progress":45}`
      6. Al final: `data: {"phase":"complete","proposals":[id1,id2,...]}`
  - `GET /api/campaigns/:campaignId/emails` - Listar propuestas
    - Query: `?market=&language=&tier=&status=`
  - `GET /api/campaigns/:campaignId/emails/:id` - Detalle con HTML completo
  - `PATCH /api/campaigns/:campaignId/emails/:id` - Actualizar status, agregar feedback
  - `DELETE /api/campaigns/:campaignId/emails/:id` - Eliminar
  - `POST /api/campaigns/:campaignId/emails/:id/duplicate` - Duplicar como nueva version
  - `GET /api/campaigns/:campaignId/emails/:id/diff/:otherId` - Diff entre dos propuestas

## Task 4.3: Generacion de emails inline desde chat
- **Modificar** `apps/dashboard/server.js` endpoint campaign chat:
  - Detectar intent de generacion de email en el mensaje (ej: "genera un email para UAE en arabe", "crea una version gold")
  - Cuando Claude detecta intent, usar tool_use pattern:
    1. Claude responde con texto explicativo + bloque HTML del email
    2. Server parsea el HTML del response
    3. Auto-guarda como `email_proposal` con status `draft`
    4. Retorna respuesta con metadata del proposal creado
  - El frontend renderiza el email inline con preview + acciones

## Task 4.4: Email Proposal Generator (frontend)
- **Crear** `apps/dashboard/src/components/EmailProposalGenerator.jsx`:
  - **Selector de variantes:**
    - Grid checkboxes: Markets (filas) x Languages (columnas)
    - Tier selector: multi-select chips
    - Instrucciones adicionales: textarea
    - Boton "Generate" con estimacion de cuantas variantes se crearan
  - **Progress view:**
    - Mientras genera: barra de progreso + nombre de variante actual
    - SSE stream actualiza progreso en real-time
  - **Upload references:**
    - Dropzone para screenshots de emails actuales
    - Preview de imagenes subidas
    - Se ingesan en KB automaticamente antes de generar

## Task 4.5: Email Proposal Viewer con diff
- **Crear** `apps/dashboard/src/components/EmailProposalViewer.jsx`:
  - **Preview panel:**
    - iframe con HTML renderizado del email
    - Toggle mobile/desktop viewport
    - Zoom controls
  - **Copy blocks sidebar:**
    - Subject line con boton "Copy"
    - Preview text con boton "Copy"
    - Body paragraphs con boton "Copy" individual
    - CTA text con boton "Copy"
    - Boton "Copy All HTML" para copiar el HTML completo
  - **Diff view:**
    - Side-by-side comparison entre 2 propuestas
    - Highlighting de diferencias: texto cambiado (amarillo), texto nuevo (verde), texto eliminado (rojo)
    - Toggle: "Show all" / "Show changes only"
    - Dropdown para seleccionar contra que propuesta comparar (base, otra variante)
  - **Actions:**
    - Approve / Reject con feedback textarea
    - "Edit in Chat" -> abre el chat con la propuesta como contexto
    - "Duplicate & Modify" -> crea nueva version
    - "Export HTML" -> descarga archivo .html

## Task 4.6: Email Proposal Matrix
- **Crear** `apps/dashboard/src/components/EmailProposalMatrix.jsx`:
  - Grid visual: Markets (filas) x Languages (columnas) x Tiers (pestanas)
  - Cada celda muestra: thumbnail del email, subject line, status badge
  - Celda vacia = no generado (boton "Generate")
  - Click en celda -> abre EmailProposalViewer
  - Color coding por status: draft (gris), review (amarillo), approved (verde), rejected (rojo)

## Task 4.7: Integrar en CampaignDetail
- **Modificar** `apps/dashboard/src/pages/CampaignDetail.jsx`:
  - Agregar tab system al layout:
    - Tab "Overview" (contenido actual: KPIs, trend, variants)
    - Tab "Chat" (chat actual + RAG)
    - Tab "Emails" (EmailProposalMatrix + EmailProposalGenerator)
  - En el chat: cuando Claude genera un email inline, renderizar `EmailProposalViewer` mini dentro del chat bubble
  - Boton en cada email inline: "Open full viewer", "Copy HTML", "View diff"

## Task 4.8: Emails inline en chat con copy/paste
- **Crear** `apps/dashboard/src/components/ChatEmailPreview.jsx`:
  - Componente que se renderiza dentro de un chat bubble cuando contiene HTML de email
  - Mini preview del email (max 300px height, scrollable)
  - Barra de acciones: "Copy HTML", "Copy Subject", "Open Full", "Compare"
  - Syntax highlighting para el HTML si el usuario quiere ver el codigo
  - Boton "Copy to clipboard" que copia el HTML limpio

## Task 4.9: Traducciones + CSS
- **Modificar** `translations.js`: ~50 keys para email proposals, generator, viewer, diff, matrix
- **Modificar** `index.css`: estilos para email preview iframe, diff highlighting, matrix grid, copy buttons, tab system

---

# FASE 5: AUTORESEARCH + EXPERIMENTOS + AUTO-MEJORA

**Objetivo:** Investigacion autonoma web+interna, con propuesta de experimentos para mejorar campanas.
**Agentes requeridos:** Campaign Manager (Raul), Analytics Agent (Carlos), Content Agent (Lucia), Competitive Intel, Segmentation Agent (Diego)

## Task 5.1: Motor de investigacion
- **Crear** `packages/core/research/engine.js`:
  - `class ResearchEngine`:
    - `constructor(pool, geminiClient, claudeClient, pineconeClient)`
    - `async startResearch(sessionId, { topic, depth, sourcesMode, campaignId, callbacks })`:
      - **Loop de investigacion:**
        1. Claude genera 3-5 search queries del tema
        2. **Web search:** Gemini con Google Search grounding ejecuta queries
        3. **Internal search:** Pinecone busca en KB (campanas, KPIs, emails, research previo)
        4. Claude analiza resultados combinados, identifica gaps
        5. Genera follow-up queries (max iterations segun depth: quick=2, standard=5, deep=10)
        6. Repite desde paso 2
      - **Sintesis:**
        7. Claude sintetiza reporte final con secciones:
           - Executive Summary
           - Key Findings (web)
           - Internal Insights (KB)
           - Competitive Analysis (si aplica)
           - Recommendations
           - Proposed Experiments (auto-mejora)
        8. Genera `experiments[]` y `recommendations[]`
      - **Auto-ingest:** Reporte se ingesta en KB namespace `research`
      - **Callbacks:** `onProgress(%)`, `onQuery(query)`, `onSource(source)`, `onPhase(phase)`
    - `async cancelResearch(sessionId)` -> detener loop
  - Persiste todo en `research_sessions` en cada paso

## Task 5.2: Motor de experimentos
- **Crear** `packages/core/research/experiments.js`:
  - `generateExperiments(researchFindings, campaignData)`:
    - Claude analiza los hallazgos del research + datos actuales de la campana
    - Genera propuestas de experimentos A/B:
      - **Subject line tests:** 2-3 variantes basadas en insights
      - **Copy experiments:** Diferentes tonos/CTAs basados en competitor analysis
      - **Segmentation tests:** Nuevos segmentos identificados por el research
      - **Send time optimization:** Basado en datos de engagement
      - **Design experiments:** Layouts alternativos inspirados en competitors
    - Cada experimento tiene: hypothesis, variant_a, variant_b, expected_improvement, confidence
    - Se guardan en `campaign_experiments`
  - `applyExperiment(experimentId)`:
    - Genera las variantes de email reales (llama a generacion de email de Fase 4)
    - Actualiza status a `running`
  - `evaluateExperiment(experimentId, results)`:
    - Recibe KPIs de ambas variantes
    - Calcula statistical significance
    - Declara ganador
    - Genera recomendacion de si aplicar permanentemente

## Task 5.3: Endpoints AutoResearch en server.js
- **Modificar** `apps/dashboard/server.js` - seccion `// ═══════════ AUTORESEARCH ═══════════`:
  - `POST /api/research/sessions` - Crear y lanzar sesion
    - Body: `{ topic, depth, sourcesMode, campaignId? }`
    - Inicia research en background (no bloquea response)
    - Respuesta: `{ sessionId, status: 'queued' }`
  - `GET /api/research/sessions` - Listar sesiones
    - Query: `?status=&campaignId=&limit=`
  - `GET /api/research/sessions/:id` - Detalle completo + reporte
  - `GET /api/research/sessions/:id/stream` - SSE stream de progreso
    - Events: `progress`, `query`, `source`, `phase`, `experiment`, `complete`
  - `POST /api/research/sessions/:id/cancel` - Cancelar
  - `DELETE /api/research/sessions/:id` - Eliminar
  - `GET /api/research/sessions/:id/experiments` - Experimentos propuestos
  - `POST /api/research/sessions/:id/experiments/:expId/approve` - Aprobar experimento
  - `POST /api/research/sessions/:id/experiments/:expId/apply` - Aplicar (genera variantes)
  - `POST /api/campaigns/:campaignId/auto-improve` - Shortcut: lanza research + experiments para una campana
    - Auto-genera topic: "How to improve {campaign.name} - current open rate {campaign.kpis.openRate}%"

## Task 5.4: Pagina AutoResearch (frontend)
- **Crear** `apps/dashboard/src/pages/AutoResearch.jsx`:
  - **Header:**
    - Titulo "AutoResearch"
    - Boton "New Research" -> abre modal
  - **New Research Modal:**
    - Topic input (textarea)
    - Depth selector: Quick (2 iterations), Standard (5), Deep (10)
    - Sources toggle: Web only, Internal only, Both (default)
    - Campaign selector (opcional): vincular research a una campana especifica
    - Boton "Start Research"
  - **Sessions List:**
    - Cards por sesion: titulo, topic truncado, status badge, progress bar, fecha
    - Filtros: All, Active, Completed, Failed
    - Click -> detalle
  - **Quick Actions:**
    - "Improve Campaign" dropdown -> seleccionar campana -> auto-lanza research
    - "Competitor Analysis" -> prefill topic con template
    - "Industry Trends" -> prefill topic

## Task 5.5: Research Session Detail + Stream
- **Crear** `apps/dashboard/src/components/ResearchStream.jsx`:
  - Panel de progreso en real-time (SSE):
    - Progress bar con porcentaje
    - Timeline de pasos: cada query ejecutado, cada fuente encontrada
    - Web sources vs Internal sources diferenciados con iconos
    - "Currently analyzing..." label
    - Boton "Cancel" durante ejecucion

- **Crear** `apps/dashboard/src/components/ResearchReport.jsx`:
  - Renderizado markdown del reporte completo
  - Secciones colapsables
  - Fuentes citadas como links (web) o KB references (interno)
  - Sidebar con:
    - Sources list (web URLs + KB documents)
    - Search queries ejecutados
    - Stats: iterations, sources found, time elapsed

## Task 5.6: Experiments Panel
- **Crear** `apps/dashboard/src/components/ExperimentsPanel.jsx`:
  - Tab "Experiments" dentro del Research Session Detail:
    - Lista de experimentos propuestos por el AI
    - Cada experimento card:
      - Type badge (subject_line, copy, design, segmentation, etc.)
      - Hypothesis text
      - Variant A vs Variant B comparison
      - Expected improvement %
      - Status: proposed / approved / running / completed
      - Actions: Approve, Apply (genera emails), Reject
  - Tab "Results" (cuando hay experimentos completados):
    - Winner highlighted
    - Confidence level
    - Improvement % real vs esperado
    - Boton "Apply Winner Permanently"

## Task 5.7: Auto-mejora integrada en CampaignDetail
- **Modificar** `apps/dashboard/src/pages/CampaignDetail.jsx`:
  - Agregar tab "Optimize" (entre Chat y Emails):
    - Boton "Auto-Improve This Campaign" -> lanza research session vinculada
    - Lista de research sessions vinculadas a esta campana
    - Experiments activos de esta campana
    - Historial de mejoras aplicadas
  - En la sidebar de agentes, agregar indicador si hay experiments activos

## Task 5.8: Routing y navegacion
- **Modificar** `apps/dashboard/src/main.jsx`:
  - Import `AutoResearch` page
  - Agregar ruta: `<Route path="/research" element={<AutoResearch />} />`
  - Agregar ruta: `<Route path="/research/:sessionId" element={<AutoResearch />} />`
- **Modificar** `apps/dashboard/src/components/Layout.jsx`:
  - Agregar al grupo "Operations": `{ to: '/app/research', icon: '🔬', label: t('layout.autoResearch') }`

## Task 5.9: Traducciones + CSS
- **Modificar** `translations.js`: ~60 keys para research, experiments, auto-improve, report sections
- **Modificar** `index.css`: estilos para research cards, stream timeline, experiment cards, report rendering, comparison views

---

# FASE 6: GEMINI VOICE REAL-TIME EN TODOS LOS CHATS

**Objetivo:** Conversacion bidireccional con voz natural en todos los chats.
**Agentes requeridos:** Cloud Architect (Guillermo), todos los agentes (beneficiarios)

## Task 6.1: WebSocket server setup
- **Modificar** `apps/dashboard/server.js`:
  - Importar `ws` (WebSocket library)
  - Despues de `server.listen()` (~linea 2700+), agregar upgrade handler:
    ```js
    const wss = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      // Validar session cookie
      // Parsear path: /ws/voice?agentId=X o ?campaignId=Y
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });
    ```
  - Handler de conexion WebSocket:
    1. Determinar contexto (agentId o campaignId)
    2. Construir system prompt igual al del chat text (mismo agente, mismo contexto RAG)
    3. Abrir sesion con Gemini Multimodal Live API
    4. Configurar proxy bidireccional:
       - Client audio -> Gemini
       - Gemini audio response -> Client
       - Gemini transcript -> Client (para mostrar texto)
    5. Manejar desconexion limpia

## Task 6.2: Hook useGeminiVoice
- **Crear** `apps/dashboard/src/hooks/useGeminiVoice.js`:
  - `useGeminiVoice({ agentId, campaignId, lang, onTranscript, onResponse })`
  - **State:**
    - `connected`: boolean (WebSocket conectado)
    - `listening`: boolean (mic abierto)
    - `speaking`: boolean (Gemini esta hablando)
    - `transcript`: string (texto reconocido en tiempo real)
    - `aiResponse`: string (texto de respuesta del AI)
  - **Audio capture:**
    - `navigator.mediaDevices.getUserMedia({ audio: true })`
    - `MediaRecorder` o `AudioWorklet` para capturar chunks
    - Enviar chunks via WebSocket en formato PCM/opus
  - **Audio playback:**
    - `AudioContext` + `AudioBufferSourceNode`
    - Queue de audio chunks para playback sin gaps
    - Manejo de interrupciones (usuario habla mientras AI responde)
  - **Fallback:** Si no hay Gemini key configurada, delegar a `useVoice.js` nativo
  - Return: `{ connected, listening, speaking, transcript, aiResponse, startListening, stopListening, disconnect }`

## Task 6.3: Voice Overlay (full-screen mode)
- **Crear** `apps/dashboard/src/components/VoiceOverlay.jsx`:
  - Overlay semi-transparente sobre toda la pantalla
  - Centro: avatar del agente (grande) con animacion de onda cuando habla
  - Abajo: waveform visualization del audio del usuario
  - Transcript en tiempo real (texto del usuario)
  - Respuesta del AI apareciendo palabra por palabra
  - Botones: Mute, End Call, Text Mode (volver al chat)
  - Visual feedback de estado: "Listening...", "Thinking...", "Speaking..."
  - Indicador de conexion WebSocket

## Task 6.4: Actualizar VoiceControls
- **Modificar** `apps/dashboard/src/components/VoiceControls.jsx`:
  - Nuevo boton `VoiceModeButton`: abre VoiceOverlay
  - Mantener `MicButton` para STT quick-input (funcionalidad existente)
  - Mantener `SpeakerButton` para TTS individual
  - Nuevo: indicador visual de que Gemini voice esta disponible (iconito verde)

## Task 6.5: Integrar en AgentChat
- **Modificar** `apps/dashboard/src/components/AgentChat.jsx`:
  - Importar `useGeminiVoice` y `VoiceOverlay`
  - Agregar boton "Voice Mode" en chat header (junto a TTS toggle existente)
  - Cuando voice mode activo, mostrar VoiceOverlay
  - Los mensajes de voz se guardan en el historial de chat como texto (transcript)
  - Auto-detect: si Gemini key no configurada, boton deshabilitado con tooltip

## Task 6.6: Integrar en PMAgentChat
- **Modificar** `apps/dashboard/src/components/PMAgentChat.jsx`:
  - Misma integracion que AgentChat
  - El PM Agent en voice mode tiene el mismo system prompt y contexto

## Task 6.7: Integrar en CampaignDetail chat
- **Modificar** `apps/dashboard/src/pages/CampaignDetail.jsx`:
  - Agregar voice mode al chat de campana
  - Misma logica: boton en header, overlay, transcript -> chat history

## Task 6.8: Traducciones + CSS
- **Modificar** `translations.js`: ~20 keys para voice overlay, connection states, controls
- **Modificar** `index.css`: estilos para overlay, waveform, connection indicator, voice mode button, avatar animation

---

# FASE 7: MEJORAS ADICIONALES

**Objetivo:** Features complementarios que potencian las fases anteriores.

## Task 7.1: Campaign Comparison Chat
- **Crear** `apps/dashboard/src/components/CampaignComparison.jsx`:
  - Seleccionar 2-3 campanas para comparar
  - Split view: KPIs side by side
  - Chat que tiene contexto de ambas campanas (RAG de ambas)
  - AI sugiere cross-pollination de estrategias
- Endpoint: `POST /api/chat/compare` con `campaignIds[]`

## Task 7.2: Knowledge Refresh Programado
- Agregar a `server.js`: scheduled job (usando `setInterval` o `node-cron`) que re-ingesta campanas cada 24h
- Usar tabla `workflow_runs` existente para trackear ejecuciones
- Config en Settings: enable/disable, frecuencia

## Task 7.3: Agent Memory + RAG
- Cuando RAG devuelve resultados relevantes, auto-guardar resumen en `agent_memory` con scope `shared`
- Los demas agentes pueden acceder a insights descubiertos por otros
- Endpoint: `POST /api/agents/:id/memory/from-rag`

## Task 7.4: Research-to-Campaign Pipeline
- Boton en ResearchReport: "Create Campaign Brief"
- Pre-llena inbox item con datos del research
- Redirige a PM Agent chat con contexto del research

## Task 7.5: KB Analytics Dashboard
- Seccion en KnowledgeBase page:
  - Queries mas frecuentes (log de searches)
  - Knowledge gaps (queries con score < 0.5)
  - Documentos mas citados
  - Grafico de uso por namespace en el tiempo

---

# FASE 8: COMMAND CENTER CARDS + KANBAN INTEGRATION

**Objetivo:** Emails, research sessions y experiments aparecen como cards en el pipeline kanban por departamento, fluyendo por el mismo sistema de estados que los proyectos.
**Agentes requeridos:** Campaign Manager (Raul), todos los agentes de departamento

## Task 8.1: Extender PipelineBoard para card types multiples
- **Modificar** `apps/dashboard/src/components/PipelineBoard.jsx`:
  - Actualmente solo muestra `projects`. Extender para soportar card types:
    - `project` (existente): Planning -> In Progress -> Completed -> Paused
    - `email_proposal`: Draft -> Review -> Approved -> Rejected
    - `research_session`: Queued -> Researching -> Completed -> Failed
    - `experiment`: Proposed -> Approved -> Running -> Completed
  - Cada card type tiene su propio color, icono, y transiciones de estado
  - **Card rendering por tipo:**
    - Project card: nombre, problema, timeline, tasks progress (existente)
    - Email card: campaign name, market/language/tier badges, subject line preview, mini-thumbnail
    - Research card: topic truncado, progress bar, sources count, depth badge
    - Experiment card: hypothesis truncada, type badge, variant A vs B mini-preview, confidence %
  - **Filtros en header del board:**
    - Toggle chips: "All", "Projects", "Emails", "Research", "Experiments"
    - Mostrar contadores por tipo
  - Mantener status transitions via botones (no drag-drop, consistente con diseno actual)

## Task 8.2: API para pipeline unificado
- **Modificar** `apps/dashboard/server.js`:
  - `GET /api/pipeline?department={dept}` -> Extender para retornar items de multiples tipos:
    ```json
    {
      "items": [
        { "type": "project", "id": 1, "name": "...", "status": "Planning", ... },
        { "type": "email_proposal", "id": 5, "campaign_id": "cart-abandon", "status": "draft", ... },
        { "type": "research_session", "id": 3, "topic": "...", "status": "researching", ... },
        { "type": "experiment", "id": 2, "hypothesis": "...", "status": "proposed", ... }
      ]
    }
    ```
  - El endpoint hace UNION de queries a `projects`, `email_proposals`, `research_sessions`, `campaign_experiments`
  - Cada item incluye un `department` field para filtrar por departamento
  - `PATCH /api/pipeline/:type/:id/status` -> Actualizar status de cualquier tipo de card
    - Valida transiciones permitidas por tipo

## Task 8.3: Agregar department a tablas nuevas
- **Modificar** schema (ya definido en Fase 1) para agregar `department TEXT` a:
  - `email_proposals` -> departamento del agente que genero (execution por defecto)
  - `research_sessions` -> departamento que lo solicito
  - `campaign_experiments` -> departamento relevante
- Agregar indices por department en cada tabla

## Task 8.4: Cards en WorkspaceOverview (Command Center)
- **Modificar** `apps/dashboard/src/pages/WorkspaceOverview.jsx`:
  - Agregar seccion "Active Items" debajo de los department cards:
    - 4 mini-cards con contadores:
      - Active Research (icono lupa, color azul)
      - Email Proposals in Review (icono mail, color verde)
      - Running Experiments (icono tubo, color naranja)
      - Pending Approvals (icono check, color rojo)
    - Click en cada mini-card -> navega al filtro correspondiente
  - Agregar seccion "Recent Activity Feed":
    - Timeline de las ultimas 10 acciones: "Research 'X' completed", "Email for Cart Abandon approved", "Experiment won: +12% open rate"
    - Endpoint: `GET /api/activity/recent?limit=10`

## Task 8.5: Cards en InboxPanel
- **Modificar** `apps/dashboard/src/components/InboxPanel.jsx`:
  - Agregar filtros nuevos al status filter: "research", "email", "experiment"
  - Cuando un research genera experiments o email proposals, estos aparecen como items en inbox
  - Accion "Send to Pipeline" para mover un item del inbox al kanban
  - Endpoint: `POST /api/inbox/:id/to-pipeline` -> crea card en pipeline con el tipo correspondiente

## Task 8.6: Crear CardBadge y CardMiniPreview reutilizables
- **Crear** `apps/dashboard/src/components/shared/CardTypeBadge.jsx`:
  - Badge visual por tipo: Project (morado), Email (verde), Research (azul), Experiment (naranja)
  - Reutilizable en Pipeline, Inbox, Weekly Board
- **Crear** `apps/dashboard/src/components/shared/CardMiniPreview.jsx`:
  - Preview compacto de cualquier tipo de card
  - Props: `type`, `data`
  - Renderiza version mini segun tipo (email thumbnail, research summary, experiment comparison)

## Task 8.7: Traducciones + CSS
- **Modificar** `translations.js`: ~30 keys para pipeline types, card actions, activity feed
- **Modificar** `index.css`: estilos para card types (colores, badges), activity feed timeline, filter chips

---

# FASE 9: WEEKLY VOICE MEETINGS HIBRIDAS

**Objetivo:** En las weeklies, humanos y agentes discuten las tarjetas creadas en reuniones hibridas usando el sistema de voz de Gemini.
**Agentes requeridos:** Todos (participan en las reuniones semanales)

## Task 9.1: Modo "Hybrid Meeting" en WeeklyBoard
- **Modificar** `apps/dashboard/src/pages/WeeklyBoard.jsx`:
  - Agregar boton "Start Hybrid Meeting" en la tab Brainstorm
  - Cuando se activa:
    1. Abre VoiceOverlay en modo "meeting" (no single-agent, sino multi-agent)
    2. Carga las cards del pipeline de esa semana como agenda de la reunion
    3. Los agentes y el humano discuten cada card por turno

## Task 9.2: Multi-Agent Voice Meeting Engine
- **Crear** `apps/dashboard/src/components/VoiceMeeting.jsx`:
  - **Agenda sidebar:**
    - Lista de cards a discutir (email proposals, experiments, research, projects)
    - Card actual highlighted
    - Skip / Next buttons
    - Progress: "Discussing 3 of 8 items"
  - **Meeting view (centro):**
    - Avatar del agente que esta hablando (con animacion)
    - Transcript en tiempo real
    - Cuando el humano habla, su avatar/nombre aparece
    - Historial scrollable de la conversacion
  - **Controls (abajo):**
    - Mute/Unmute mic
    - "Next Item" -> avanzar a siguiente card
    - "End Meeting" -> generar resumen
    - "Raise Hand" -> indicar que el humano quiere intervenir
  - **Flujo de discusion por card:**
    1. System anuncia la card: "Now discussing: Cart Abandon Email Proposal for UAE market"
    2. Agente relevante presenta (Lucia para emails, Carlos para experiments)
    3. Otros agentes pueden comentar
    4. Humano interviene por voz en cualquier momento
    5. Al terminar discusion, se pide decision: Approve / Reject / Modify / Skip
    6. Decision se aplica a la card (actualiza status en pipeline)

## Task 9.3: WebSocket multi-agent voice session
- **Modificar** `apps/dashboard/server.js`:
  - Nuevo tipo de sesion WS: `/ws/voice-meeting`
  - Query params: `sessionId` (weekly session), `department`
  - **Server-side meeting orchestrator:**
    1. Carga agenda (cards del pipeline de esa semana)
    2. Para cada card, determina agente presentador segun tipo:
       - Email proposals -> Content Agent (Lucia) + HTML Developer
       - Research sessions -> Campaign Manager (Raul) + Competitive Intel
       - Experiments -> Analytics Agent (Carlos) + Segmentation (Diego)
       - Projects -> Campaign Manager (Raul)
    3. Genera prompt contextual para Gemini voice con: card data, agent personality, meeting context
    4. Orquesta turnos: agent speaks -> pause -> human can speak -> next agent -> etc.
    5. Mantiene transcript completo
  - **Decision handling:**
    - Cuando humano dice "approve", "reject", "next", "modify" -> servidor detecta y aplica accion
    - Update status de la card via `PATCH /api/pipeline/:type/:id/status`

## Task 9.4: Meeting Summary y Report
- **Crear** `apps/dashboard/src/components/MeetingSummary.jsx`:
  - Al finalizar la meeting, Claude genera un resumen:
    - Cards discutidas con decisiones tomadas
    - Action items identificados
    - Pendientes para proxima semana
    - Participantes (agentes + humano)
  - Se guarda como parte del `weekly_sessions.report`
  - **Exportable:** Boton "Export Meeting Notes" (markdown o PDF)

## Task 9.5: Tabla meetings en DB
- **Modificar** `packages/core/db/schema.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS meeting_sessions (
      id SERIAL PRIMARY KEY,
      weekly_session_id INTEGER REFERENCES weekly_sessions(id),
      department TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
      agenda JSONB DEFAULT '[]',
      transcript JSONB DEFAULT '[]',
      decisions JSONB DEFAULT '[]',
      participants JSONB DEFAULT '[]',
      summary_md TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER
  );
  ```

## Task 9.6: Integrar cards de meeting en MultiAgentBrainstorm existente
- **Modificar** `apps/dashboard/src/components/MultiAgentBrainstorm.jsx`:
  - Agregar modo "voice" al brainstorm existente (actualmente es solo texto con TTS)
  - Cuando voice mode activo:
    - En lugar de replay con delays, los agentes hablan via Gemini
    - Las pause_for_human se convierten en "mic open" para el humano
    - El humano responde por voz en vez de texto
  - Mantener modo texto como fallback
  - Toggle: "Text Mode" / "Voice Mode" en header del brainstorm

## Task 9.7: Integrar tarjetas nuevas en la agenda de Weekly Sessions
- **Modificar** `apps/dashboard/server.js` endpoint `POST /api/weekly-sessions/:id/import-inbox`:
  - Extender para importar no solo proyectos, sino tambien:
    - Email proposals pendientes de review
    - Research sessions completadas con experiments
    - Experiments propuestos sin aprobar
  - Estas se agregan al `inbox_snapshot` de la weekly session
  - En el brainstorm, los agentes discuten estos items tambien

## Task 9.8: Traducciones + CSS
- **Modificar** `translations.js`: ~40 keys para meeting UI, agenda, decisions, summary, voice meeting controls
- **Modificar** `index.css`: estilos para meeting view, agenda sidebar, decision badges, participant avatars, transcript view

---

# RESUMEN DE ARCHIVOS

## Archivos a CREAR (26 archivos)

### Core modules (6)
1. `packages/core/ai-providers/gemini.js`
2. `packages/core/ai-providers/pinecone.js`
3. `packages/core/knowledge/ingestion.js`
4. `packages/core/knowledge/retrieval.js`
5. `packages/core/research/engine.js`
6. `packages/core/research/experiments.js`

### Pages (2)
7. `apps/dashboard/src/pages/KnowledgeBase.jsx`
8. `apps/dashboard/src/pages/AutoResearch.jsx`

### Components (16)
9. `apps/dashboard/src/components/KnowledgeSearch.jsx`
10. `apps/dashboard/src/components/ChatAssetPanel.jsx`
11. `apps/dashboard/src/components/ChatSearchResults.jsx`
12. `apps/dashboard/src/components/ChatEmailPreview.jsx`
13. `apps/dashboard/src/components/EmailProposalGenerator.jsx`
14. `apps/dashboard/src/components/EmailProposalViewer.jsx`
15. `apps/dashboard/src/components/EmailProposalMatrix.jsx`
16. `apps/dashboard/src/components/ResearchStream.jsx`
17. `apps/dashboard/src/components/ResearchReport.jsx`
18. `apps/dashboard/src/components/ExperimentsPanel.jsx`
19. `apps/dashboard/src/components/VoiceOverlay.jsx`
20. `apps/dashboard/src/components/CampaignComparison.jsx`
21. `apps/dashboard/src/components/shared/CardTypeBadge.jsx`
22. `apps/dashboard/src/components/shared/CardMiniPreview.jsx`
23. `apps/dashboard/src/components/VoiceMeeting.jsx`
24. `apps/dashboard/src/components/MeetingSummary.jsx`

### Hooks (1)
25. `apps/dashboard/src/hooks/useGeminiVoice.js`

## Archivos a MODIFICAR (17 archivos)

1. `package.json` - Deps: `@google/generative-ai`, `@pinecone-database/pinecone`, `ws`
2. `.env.example` - Variables: GEMINI_API_KEY, PINECONE_*
3. `packages/core/db/schema.sql` - 7 tablas nuevas (knowledge_documents, knowledge_chunks, research_sessions, email_proposals, campaign_conversations, campaign_experiments, meeting_sessions)
4. `apps/dashboard/server.js` - ~30 endpoints nuevos + RAG en 3 endpoints existentes + 2 WebSocket handlers (voice + meeting)
5. `apps/dashboard/src/main.jsx` - 2 rutas nuevas (knowledge, research)
6. `apps/dashboard/src/components/Layout.jsx` - 2 entradas sidebar nuevas
7. `apps/dashboard/src/pages/SettingsPage.jsx` - API keys Gemini/Pinecone + Markets/Tiers config
8. `apps/dashboard/src/pages/CampaignDetail.jsx` - Tabs (Overview, Chat, Emails, Optimize), voice, RAG
9. `apps/dashboard/src/pages/WorkspaceOverview.jsx` - Command center cards, activity feed
10. `apps/dashboard/src/pages/WeeklyBoard.jsx` - Hybrid meeting button, import multi-type cards
11. `apps/dashboard/src/components/AgentChat.jsx` - RAG panel + voice mode
12. `apps/dashboard/src/components/PMAgentChat.jsx` - RAG panel + voice mode
13. `apps/dashboard/src/components/VoiceControls.jsx` - Gemini voice mode button
14. `apps/dashboard/src/components/PipelineBoard.jsx` - Multi-type cards (email, research, experiment)
15. `apps/dashboard/src/components/InboxPanel.jsx` - Filtros multi-type, send to pipeline
16. `apps/dashboard/src/components/MultiAgentBrainstorm.jsx` - Voice mode toggle, multi-type cards
17. `apps/dashboard/src/i18n/translations.js` - ~310 keys nuevas (ES+EN)
18. `apps/dashboard/src/index.css` - ~700 lineas CSS nuevas

---

# ORDEN DE EJECUCION

```
Fase 1 (Infraestructura) ──→ Fase 2 (KB + RAG) ──→ Fase 3 (RAG en chats)
                                                          │
                                          ┌───────────────┼───────────────┐
                                          ▼               ▼               ▼
                                     Fase 4          Fase 5          Fase 6
                                   (Emails)      (Research +       (Voice)
                                                 Experiments)
                                          │               │               │
                                          └───────────────┼───────────────┘
                                                          ▼
                                                     Fase 7 (Mejoras)
                                                          │
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                         Fase 8                  Fase 9
                                     (Command Center        (Weekly Voice
                                      + Kanban)              Meetings)
```

- Fases 4, 5 y 6 son paralelas entre si (tras Fase 3)
- Fase 8 depende de Fases 4+5 (necesita email proposals y experiments como card types)
- Fase 9 depende de Fases 6+8 (necesita voice engine + cards en pipeline)

---

# VERIFICACION END-TO-END

1. **Fase 1:** Settings -> guardar Gemini + Pinecone keys -> no errores al arrancar server
2. **Fase 2:** Knowledge Base page -> "Ingest All Campaigns" -> ver 34+26 documentos indexados -> buscar "cart abandonment" -> resultados relevantes con score
3. **Fase 3:** Chat de cualquier agente -> preguntar "what campaigns have the best open rate?" -> respuesta con datos reales de KB + asset panel mostrando campanas
4. **Fase 4:** CampaignDetail -> tab Emails -> seleccionar UAE+UK, EN+AR, Gold -> generar -> ver matrix con variantes -> abrir viewer -> ver diff entre EN y AR -> copy HTML -> pegar en editor externo
5. **Fase 4b:** Chat de campana -> "genera un email para esta campana en arabe para tier platinum" -> email renderizado inline en el chat -> boton copy HTML funciona
6. **Fase 5:** AutoResearch -> "competitor analysis: Emirates vs Qatar Airways email marketing" -> ver progreso real-time -> reporte con fuentes web + datos internos -> tab Experiments -> aprobar subject line test -> aplicar -> genera 2 variantes de email
7. **Fase 5b:** CampaignDetail -> tab Optimize -> "Auto-Improve" -> lanza research vinculado -> propone 3 experiments -> aprobar -> genera variantes automaticamente
8. **Fase 6:** Abrir chat de agente -> click "Voice Mode" -> hablar "what's the status of the cart abandonment campaign?" -> respuesta en voz natural de Gemini -> transcript visible -> cerrar overlay -> mensaje guardado en historial
9. **Fase 7:** Campaign Comparison -> seleccionar 2 campanas -> chat comparativo con insights de ambas
10. **Fase 8:** Pipeline board -> ver cards mixtas: proyectos + email proposals + research + experiments -> filtrar por tipo -> mover email proposal de "Draft" a "Review" -> WorkspaceOverview muestra contadores de items activos + activity feed
11. **Fase 8b:** InboxPanel -> filtrar por "research" -> ver research completado -> "Send to Pipeline" -> aparece en kanban
12. **Fase 9:** WeeklyBoard -> Brainstorm tab -> "Start Hybrid Meeting" -> Gemini voice se activa -> agenda muestra 5 cards a discutir -> Lucia presenta email proposal por voz -> humano aprueba por voz -> Carlos presenta experiment -> humano pide modificacion -> "End Meeting" -> resumen generado con decisiones y action items
13. **Fase 9b:** MultiAgentBrainstorm -> toggle "Voice Mode" -> agentes hablan via Gemini en vez de texto replay -> humano interviene por voz en pausas
