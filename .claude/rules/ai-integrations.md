---
paths:
  - "packages/core/ai-providers/**"
  - "packages/core/pm-agent/**"
  - "packages/core/knowledge/**"
  - "packages/core/research/**"
  - "apps/dashboard/server.js"
---

# AI Integrations

## Multi-Provider Strategy

- **Claude (Anthropic)**: razonamiento, generacion de texto/HTML, sintesis de research
- **Gemini (Google)**: embeddings (`gemini-embedding-001`), voz real-time (Multimodal Live API), web search grounding
- **Pinecone**: vector store con namespaces por area

## Anthropic SDK

- Modelo por defecto: `claude-sonnet-4-6`
- Siempre wrap en try-catch con manejo de rate limits (429)
- SSE streaming para chat: `stream.on('text', callback)` + `data: {"text":"chunk"}\n\n`
- Max tokens: 4096 default, 8192 para project generation
- API key desde `process.env.ANTHROPIC_API_KEY` o DB cifrada (`workspace_config.api_keys`)
- Nunca loggear API keys

## Gemini SDK

- Usar `@google/genai` package (reemplaza `@google/generative-ai` deprecated)
- Embeddings: `ai.models.embedContent()` con modelo `gemini-embedding-2-preview` (multimodal)
- Soporta embeder texto, imagenes (PNG/JPEG), PDFs (max 6 pags), video, audio
- Dimensiones: 3072 (configurado via `outputDimensionality`)
- Batch embeddings: concurrencia controlada (~10 en paralelo)
- Voice: Multimodal Live API via WebSocket (server actua como proxy)
- Search grounding: habilitado para AutoResearch
- API key separada: `GEMINI_API_KEY`

## Pinecone

- Usar `@pinecone-database/pinecone` package
- Namespaces: `campaigns`, `emails`, `images`, `kpis`, `research`, `brand`
- Eventual consistency: esperar 1-2s despues de upsert antes de query en tests
- Batch upserts para performance (no uno por uno)
- Metadata en cada vector: `campaign_id`, `market`, `language`, `tier`, `content_type`
- Filter syntax: `{ campaign_id: { $eq: "cart-abandon" } }`

## RAG Pipeline

- Chunking: 500 tokens por chunk, 50 tokens de overlap
- Retrieval: top-5 resultados, score minimo 0.7
- Contexto RAG se inyecta en system prompt como `[CONOCIMIENTO RELEVANTE]`
- Maximo 2000 tokens de contexto RAG para no saturar el prompt
- Los 3 chat endpoints deben incluir RAG: pm-agent, agent/:agentId, campaign/:campaignId

## Patron SSE (Server-Sent Events)

```javascript
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
});
// Enviar chunks: `data: {"text":"chunk"}\n\n`
// Finalizar: `data: [DONE]\n\n`
```