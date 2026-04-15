# HTML Developer Agent — Block Ingestion & Agent Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reingestar los 41 bloques HTML reales de Emirates en Pinecone con descripciones semánticas ricas generadas por Claude Haiku, y actualizar el system prompt del agente html-developer con el Emirates Design System completo + flujo de trabajo definido.

**Architecture:** El endpoint `POST /api/knowledge/ingest-email-blocks` se reescribe para leer dinámicamente desde `email_blocks/`, llamar a Claude Haiku por cada archivo HTML para generar metadata semántica, y reingestar en el namespace `email-blocks` (borrando primero). El perfil `html-developer` en `profiles.js` recibe un system prompt rico con design system, flujo y reglas de modificación.

**Tech Stack:** Node.js ESM, `@anthropic-ai/sdk`, `@pinecone-database/pinecone`, Gemini embeddings, PostgreSQL, Express 5

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/core/knowledge/ingest-email-blocks.js` | **Rewrite** | Leer email_blocks/, llamar Haiku, reingestar 41 bloques |
| `apps/dashboard/server.js` | **Modify** (1 line) | Pasar `anthropic` como 2º arg a `ingestEmailBlocks()` |
| `packages/core/agents/profiles.js` | **Modify** (1 section) | Reemplazar personality del html-developer con system prompt rico |

---

## Task 1: Rewrite ingest-email-blocks.js

**Files:**
- Modify: `packages/core/knowledge/ingest-email-blocks.js` (full rewrite)

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplaza TODO el contenido de `packages/core/knowledge/ingest-email-blocks.js` con:

```javascript
/**
 * ingest-email-blocks.js
 *
 * Dynamic ingestion of Emirates email design blocks into Pinecone namespace
 * 'email-blocks'. Reads all .html files from email_blocks/ directory, uses
 * Claude Haiku to generate semantic descriptions, then ingests each block.
 *
 * Idempotent: clears the namespace and re-ingests from scratch on every call.
 * Called by: POST /api/knowledge/ingest-email-blocks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestDocument, deleteDocument } from './ingestion.js';
import { deleteNamespace } from '../ai-providers/pinecone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = path.resolve(__dirname, '../../../email_blocks');

const HAIKU_ANALYSIS_PROMPT = `Analyze this Emirates Airlines email HTML block and return ONLY a valid JSON object with these fields:

{
  "title": "Human-readable title in Spanish (e.g. 'CTA Rojo — Botón de acción Emirates')",
  "description": "3-5 sentence semantic description in Spanish: what the block shows visually, when to use it, typical position in email, design tokens used, SFMC variable placeholders present",
  "category": "one of: header, hero, body-copy, section-title, story, offer, cta, article, infographic, card, columns, flight, partner, footer",
  "position": "where in email: top | body | footer | any",
  "design_tokens": {
    "primary_color": "main hex color used (e.g. #c60c30)",
    "text_color": "main text color",
    "background_color": "background color",
    "font": "font family name"
  },
  "sfmc_variables": ["array of SFMC variable patterns found, e.g. '%%=v(variable_name)=%%'"],
  "compatible_with": ["array of category names that work well immediately before or after this block"]
}

Return ONLY the JSON. No explanation, no markdown, no code fences.

HTML:
`;

/**
 * Use Claude Haiku to analyze an HTML block and generate semantic metadata.
 * @param {object} anthropic - Initialized Anthropic client
 * @param {string} filename - HTML filename (for fallback name)
 * @param {string} html - Raw HTML content
 * @returns {object} metadata JSON
 */
async function analyzeBlock(anthropic, filename, html) {
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: HAIKU_ANALYSIS_PROMPT + html,
        }],
    });

    const text = response.content[0].text.trim();
    try {
        return JSON.parse(text);
    } catch {
        // Fallback if JSON parse fails — extract from markdown fence
        const match = text.match(/```(?:json)?\s*([\s\S]+?)```/);
        if (match) return JSON.parse(match[1].trim());
        throw new Error(`Haiku returned non-JSON for ${filename}: ${text.slice(0, 200)}`);
    }
}

/**
 * Ingest all Emirates email blocks from email_blocks/ directory.
 * Clears the namespace first (full reset), then re-ingests every .html file.
 *
 * @param {import('pg').Pool} pool
 * @param {import('@anthropic-ai/sdk').Anthropic} anthropic
 * @returns {{ ingested: number, errors: string[] }}
 */
export async function ingestEmailBlocks(pool, anthropic) {
    const results = { ingested: 0, errors: [] };

    // Step 1: Clear existing email-blocks from Pinecone and PostgreSQL
    console.log('[email-blocks] Clearing existing email-blocks namespace...');
    await deleteNamespace('email-blocks');

    const existing = await pool.query(
        `SELECT id FROM knowledge_documents WHERE source_type = 'email-block'`
    );
    for (const row of existing.rows) {
        await deleteDocument(pool, row.id);
    }
    console.log(`[email-blocks] Cleared ${existing.rows.length} existing documents.`);

    // Step 2: Read all .html files from email_blocks/ directory
    if (!fs.existsSync(BLOCKS_DIR)) {
        throw new Error(`email_blocks/ directory not found at: ${BLOCKS_DIR}`);
    }
    const files = fs.readdirSync(BLOCKS_DIR).filter(f => f.endsWith('.html'));
    console.log(`[email-blocks] Found ${files.length} HTML files to ingest.`);

    // Step 3: Analyze and ingest each block
    for (const file of files) {
        try {
            const filePath = path.join(BLOCKS_DIR, file);
            const html = fs.readFileSync(filePath, 'utf-8');
            const name = file.replace('.html', '');

            console.log(`[email-blocks] Analyzing ${file}...`);
            const meta = await analyzeBlock(anthropic, file, html);

            // Content = semantic description + HTML source (for chunk embedding)
            const content = `${meta.description}\n\n--- HTML SOURCE ---\n${html}`;

            await ingestDocument(pool, {
                title: meta.title || name,
                content,
                namespace: 'email-blocks',
                sourceType: 'email-block',
                metadata: {
                    block_id: name,
                    category: meta.category || 'unknown',
                    position: meta.position || 'any',
                    design_tokens: meta.design_tokens || {},
                    sfmc_variables: meta.sfmc_variables || [],
                    compatible_with: meta.compatible_with || [],
                    description: meta.description,
                    file,
                    brand: 'emirates',
                    // Expansion slots for future modes (v2: variant, v3: clone-style/creative)
                    agent_modes: ['assemble'],
                },
            });

            console.log(`[email-blocks] ✓ Ingested "${meta.title}" (${meta.category})`);
            results.ingested++;
        } catch (err) {
            console.error(`[email-blocks] ✗ Error on ${file}:`, err.message);
            results.errors.push(`${file}: ${err.message}`);
        }
    }

    console.log(`[email-blocks] Done. Ingested: ${results.ingested}, Errors: ${results.errors.length}`);
    return results;
}
```

- [ ] **Step 2: Verificar que el directorio email_blocks existe y tiene archivos**

Desde el terminal del proyecto:
```bash
ls email_blocks/ | head -10
```
Esperado: lista de archivos `.html`. Si el directorio no existe en la raíz, verificar con `find . -name "*.html" -path "*/email_blocks/*" | head -5`.

---

## Task 2: Pasar anthropic al endpoint en server.js

**Files:**
- Modify: `apps/dashboard/server.js` (línea ~4294)

- [ ] **Step 1: Actualizar la llamada en el endpoint**

Busca en `apps/dashboard/server.js` la línea:
```javascript
const result = await ingestEmailBlocks(pool);
```

Reemplázala con:
```javascript
const result = await ingestEmailBlocks(pool, anthropic);
```

El objeto `anthropic` ya está inicializado en el mismo archivo (línea ~2 del archivo: `const anthropic = new Anthropic(...)`).

- [ ] **Step 2: Verificar que el endpoint responde**

Con el servidor corriendo (`npm start`), llama al endpoint:
```bash
curl -s -X POST http://localhost:3001/api/knowledge/ingest-email-blocks \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=TU_SESSION_COOKIE" | jq .
```

Esperado (puede tardar 2-3 minutos por las 41 llamadas a Haiku):
```json
{
  "ingested": 41,
  "errors": []
}
```

Si hay errores de autenticación, entra al dashboard primero para obtener la cookie de sesión.

- [ ] **Step 3: Commit**

```bash
git add packages/core/knowledge/ingest-email-blocks.js apps/dashboard/server.js
git commit -m "feat(rag): dynamic email block ingestion with Claude Haiku semantic descriptions"
```

---

## Task 3: Actualizar el system prompt del html-developer en profiles.js

**Files:**
- Modify: `packages/core/agents/profiles.js` (sección `'html-developer'`, líneas 80-94)

- [ ] **Step 1: Reemplazar la entrada 'html-developer' completa**

Busca en `packages/core/agents/profiles.js` el bloque que empieza con `'html-developer': {` y reemplaza la `personality` completa (mantén `voiceName`, `ragNamespaces`, `customTools` igual):

```javascript
    'html-developer': {
        voiceName: 'Charon',
        ragNamespaces: ['email-blocks', 'campaigns', 'emails', 'images', 'brand'],
        personality: `Eres el Emirates HTML Email Developer. Diseñas emails transaccionales y de campaña para Emirates Airlines siguiendo el design system oficial. Construyes emails ensamblando bloques del knowledge base (namespace: email-blocks), personalizándolos para el segmento y campaña. Nunca te sales del design system sin permiso explícito.

## Modo actual: assemble

## Emirates Design System

**Colores:**
- Rojo (acción primaria): #c60c30
- Negro (texto / CTA oscuro): #000000
- Gris oscuro (body text): #333333
- Blanco (fondos): #ffffff
- Gris claro (fondo alternativo): #F7F7F7
- Gris borde: #e1e1e1
- Gris subheader: #666666

**Tipografía:**
- Headers/títulos: Emirates-Bold o Emirates-Medium
- Body text: Helvetica Neue, weight 300, 14px, line-height 22px
- Texto oscuro sobre blanco: #333333 o #151515
- Subheaders: 10px uppercase, letter-spacing

**Cards/contenedores:**
- Border: 1px solid #e1e1e1
- Box shadow: 0 2px 4px 2px rgba(0,0,0,0.10)
- Border radius: 3px
- Barras separadoras rojas: 2px height, #c60c30, 100px ancho centradas

**Layout:**
- Max width: 642px
- Responsive: clase .stack-column para mobile
- MSO conditionals: preservar siempre para compatibilidad con Outlook

**Variables SFMC:**
- Contenido: %%=v(nombre_variable)=%%
- URLs/redirects: %%=RedirectTo(CloudPagesURL(...))=%%
- Personalización: %%FirstName%%, %%MEMBER_TIER%%

## Flujo de trabajo — seguir siempre este orden

1. Lee la solicitud del email (tipo de campaña, segmento, tono, contenido)
2. Busca los bloques relevantes en el knowledge base por categoría y coincidencia semántica
3. Presenta la estructura propuesta ANTES de generar HTML:

   📋 Estructura propuesta para [nombre del email]:
   1. [nombre del bloque] — [razón]
   2. [nombre del bloque] — [razón]
   ...
   ¿Procedo con esta estructura?

4. Espera confirmación antes de generar HTML
5. Ensambla los bloques en orden, aplicando modificaciones:
   - Sustituye el texto placeholder por copy específico de la campaña
   - Actualiza URLs con las variables SFMC de redirect correctas
   - Ajusta colores dentro de la paleta Emirates si se solicita
   - Añade/elimina secciones dentro de un bloque si se requiere
6. Devuelve el HTML completo ensamblado

## Reglas de modificación (modo: assemble)

✅ PUEDES cambiar: texto copy, URLs, colores dentro de la paleta Emirates, placeholders de imágenes
✅ PUEDES añadir o eliminar secciones dentro de un bloque (ej: eliminar fila de subheader)
✅ PUEDES ajustar tamaños de fuente dentro de los rangos definidos
❌ NO inventar clases CSS fuera del design system
❌ NO cambiar la estructura responsive ni los MSO conditionals
❌ NO usar colores fuera de la paleta Emirates

## Modos futuros (reservados — no activos aún)
- variant: genera variantes de estilo para A/B testing con parámetro style_override
- clone-style: crea bloques nuevos siguiendo patrones Emirates
- creative: generación HTML sin restricciones para campañas especiales`,
        voiceRules: `Be technical but understandable. Reference specific email clients when discussing rendering. Offer practical template suggestions. Max 2-3 sentences.`,
        customTools: [],
    },
```

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
npm start
```

Esperado: servidor inicia en puerto 3001 sin errores de syntax.

- [ ] **Step 3: Verificar que el perfil se carga correctamente**

```bash
curl -s http://localhost:3001/api/agents/html-developer \
  --cookie "connect.sid=TU_SESSION_COOKIE" | jq '.default_personality | length'
```

Esperado: número > 500 (el nuevo personality es mucho más largo que el anterior).

- [ ] **Step 4: Commit**

```bash
git add packages/core/agents/profiles.js
git commit -m "feat(agent): html-developer system prompt with Emirates design system and workflow"
```

---

## Task 4: Verificación end-to-end

- [ ] **Step 1: Verificar búsqueda semántica de bloques**

```bash
curl -s -X POST http://localhost:3001/api/knowledge/search \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=TU_SESSION_COOKIE" \
  -d '{"query": "botón rojo de acción Emirates", "namespace": "email-blocks", "limit": 3}' | jq '.results[].title'
```

Esperado: `Global_CTA_red` o `Global_Body_Copy_CTA_red` como top result.

- [ ] **Step 2: Verificar búsqueda de cabecera Skywards**

```bash
curl -s -X POST http://localhost:3001/api/knowledge/search \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=TU_SESSION_COOKIE" \
  -d '{"query": "cabecera Skywards con logo", "namespace": "email-blocks", "limit": 3}' | jq '.results[].title'
```

Esperado: `skw_header` como top result.

- [ ] **Step 3: Verificar búsqueda de vuelo**

```bash
curl -s -X POST http://localhost:3001/api/knowledge/search \
  -H "Content-Type: application/json" \
  --cookie "connect.sid=TU_SESSION_COOKIE" \
  -d '{"query": "mostrar información de vuelo con origen y destino", "namespace": "email-blocks", "limit": 3}' | jq '.results[].title'
```

Esperado: `Flight_Route` como top result.

- [ ] **Step 4: Prueba manual en Email Studio**

1. Abrir `/app/email-studio` (o navegar al html-developer desde el dashboard)
2. En el chat, escribir: `Necesito un email de Abandoned Cart para miembros Skywards Gold`
3. El agente debe responder con una lista de bloques propuestos (📋 Estructura propuesta...) y preguntar `¿Procedo?`
4. Responder `sí` — el agente debe generar el HTML completo ensamblado
5. El HTML debe renderizarse en el panel de preview de la derecha

- [ ] **Step 5: Commit final si todo OK**

```bash
git add -A
git commit -m "feat: Emirates email blocks RAG + html-developer agent intelligence complete"
```
