# KB Multimodal Ingestion Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the KB ingestion pipeline to extract real text from PDFs (native + scanned), generate image descriptions, parse HTML emails, and support Word docs — so the KB Chat can answer with actual content instead of metadata stubs.

**Architecture:** Gemini Vision (`generateContent` with `gemini-2.0-flash`) extracts text during ingestion. Extracted text is stored in `knowledge_chunks.content` and embedded for semantic search. HTML email source code is stored in `metadata.html_source`. No new dependencies — uses existing `@google/genai`.

**Tech Stack:** Gemini 2.0 Flash (text extraction), pdf-lib (existing, page splitting), @google/genai (existing), Express/multer (existing upload endpoint)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/ai-providers/gemini.js` | Modify | Add 3 new functions: `extractTextFromImage`, `extractTextFromPdfPage`, `extractTextFromDocument` |
| `packages/core/knowledge/ingestion.js` | Modify | Update `ingestPdfFile`, `ingestImageFile`, add `ingestHtmlFile`, `ingestWordFile`. Use Gemini extraction instead of storing metadata stubs |
| `apps/dashboard/server.js` | Modify | Update multer fileFilter to allow .html/.doc/.docx. Update upload routing in ingestFile. Update buildRAGContext to include html_source in results |
| `packages/core/knowledge/retrieval.js` | Modify | Include `metadata.html_source` in search results when present |
| `apps/dashboard/src/components/KBChat.jsx` | Modify | Add HTML email preview rendering (iframe + code toggle) |
| `apps/dashboard/src/i18n/translations.js` | Modify | Add keys for email preview UI |
| `apps/dashboard/src/index.css` | Modify | Add styles for email preview card |

---

### Task 1: Gemini Vision extraction functions

**Files:**
- Modify: `packages/core/ai-providers/gemini.js`

- [ ] **Step 1: Add `extractTextFromImage` function**

After the existing `embedPdf` function (line 105), add:

```javascript
/**
 * Extract text/description from an image using Gemini Vision.
 * @param {string} base64Data - Base64-encoded image
 * @param {string} mimeType - e.g. 'image/png'
 * @returns {Promise<string>} - Extracted text or description
 */
export async function extractTextFromImage(base64Data, mimeType) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: 'Describe this image in detail. If it contains text, extract ALL text exactly as shown. If it is an email screenshot or design, describe the layout and extract all visible copy. Respond in the same language as any text found. If no text, provide a detailed visual description.' },
            ],
        }],
    });
    return result.text || '';
}
```

- [ ] **Step 2: Add `extractTextFromPdfPage` function**

```javascript
/**
 * Extract text from a single PDF page using Gemini Vision (works for native + scanned).
 * @param {string} base64Data - Base64-encoded single-page PDF
 * @returns {Promise<string>} - Extracted text
 */
export async function extractTextFromPdfPage(base64Data) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
            parts: [
                { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                { text: 'Extract ALL text from this document page. Preserve the original structure including headings, lists, tables, and paragraphs. Return only the extracted text, no commentary.' },
            ],
        }],
    });
    return result.text || '';
}
```

- [ ] **Step 3: Add `extractTextFromDocument` function**

```javascript
/**
 * Extract text from a Word document using Gemini Vision.
 * @param {string} base64Data - Base64-encoded document
 * @param {string} mimeType - e.g. 'application/msword'
 * @returns {Promise<string>} - Extracted text
 */
export async function extractTextFromDocument(base64Data, mimeType) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: 'Extract ALL text from this document. Preserve headings, lists, tables, and paragraph structure. Return only the extracted text, no commentary.' },
            ],
        }],
    });
    return result.text || '';
}
```

- [ ] **Step 4: Update exports**

Ensure all 3 new functions are exported. The file uses named exports already so they are auto-exported.

- [ ] **Step 5: Verify no syntax errors**

Run: `node -e "import('./packages/core/ai-providers/gemini.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK` (no import errors)

- [ ] **Step 6: Commit**

```bash
git add packages/core/ai-providers/gemini.js
git commit -m "feat(kb): add Gemini Vision text extraction functions for images, PDFs, and documents"
```

---

### Task 2: Update PDF ingestion to extract real text

**Files:**
- Modify: `packages/core/knowledge/ingestion.js`

- [ ] **Step 1: Add import for new Gemini functions**

At the top of `ingestion.js`, update the import from gemini.js. Find the existing import line:

```javascript
import { embedText, embedBatch, embedImage, embedPdf } from '../ai-providers/gemini.js';
```

Replace with:

```javascript
import { embedText, embedBatch, embedImage, embedPdf, extractTextFromPdfPage, extractTextFromImage, extractTextFromDocument } from '../ai-providers/gemini.js';
```

- [ ] **Step 2: Rewrite `ingestPdfFile` to extract text per page**

The current `ingestPdfFile` function (starts around line 375) embeds each page as an image but stores `[PDF: title — page N/M]` as content. Replace the page processing loop.

Find the section inside `ingestPdfFile` where pages are processed (the for loop that iterates over `pages`). Replace the loop body so that for each page:

1. Call `extractTextFromPdfPage(pageBase64)` to get the text
2. Use the extracted text as `content` (instead of the metadata stub)
3. Embed the **extracted text** via `embedText()` (instead of embedding the PDF image via `embedPdf()`)
4. Store the extracted text in the chunk

The new loop body should be:

```javascript
        const vectors = [];
        const chunks = [];

        for (let i = 0; i < pages.length; i++) {
            // Extract text from page via Gemini Vision
            const pageText = await extractTextFromPdfPage(pages[i]);
            const content = pageText.trim() || `[PDF: ${title} — page ${i + 1}/${pages.length}]`;

            // Embed the extracted text (not the PDF image)
            const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT');

            const pineconeId = `doc-${documentId}-chunk-${i}`;
            vectors.push({
                id: pineconeId,
                values: embedding,
                metadata: {
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    content_preview: content.slice(0, 200),
                    media_type: 'pdf_page',
                    file_path: relativePath,
                    page_number: i + 1,
                },
            });
            chunks.push({
                document_id: documentId,
                chunk_index: i,
                content,
                pinecone_id: pineconeId,
                metadata: { page_number: i + 1, extraction_method: 'gemini-vision' },
                media_type: 'pdf_page',
                file_path: relativePath,
            });
        }
```

Keep the rest of the function the same (upsertVectors, INSERT chunks into PG, update document status).

- [ ] **Step 3: Verify the function compiles**

Run: `node -e "import('./packages/core/knowledge/ingestion.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

- [ ] **Step 4: Commit**

```bash
git add packages/core/knowledge/ingestion.js
git commit -m "feat(kb): extract real text from PDF pages using Gemini Vision"
```

---

### Task 3: Update image ingestion to generate descriptions

**Files:**
- Modify: `packages/core/knowledge/ingestion.js`

- [ ] **Step 1: Update `ingestImageFile` to generate description**

In the `ingestImageFile` function, after reading the file and converting to base64, add a call to `extractTextFromImage` to generate a description. Then use that description as the chunk content and embed the description text instead of the raw image.

Find the section where `embedImage(base64, mimeType)` is called. Before that call, add:

```javascript
        // Generate description via Gemini Vision
        const description = await extractTextFromImage(base64, mimeType);
        const content = description.trim() || `[Image: ${title}]`;
```

Then change the embedding from `embedImage(base64, mimeType)` to:

```javascript
        const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT');
```

Update the chunk INSERT and vector metadata to use `content` instead of `[Image: ${title}]`.

Also add `image_description` and `extraction_method` to the chunk metadata:

```javascript
        metadata: { image_description: content, extraction_method: 'gemini-vision' },
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/knowledge/ingestion.js
git commit -m "feat(kb): generate image descriptions via Gemini Vision during ingestion"
```

---

### Task 4: Add HTML email ingestion

**Files:**
- Modify: `packages/core/knowledge/ingestion.js`

- [ ] **Step 1: Add `ingestHtmlFile` function**

After the `ingestPdfFile` function, add a new function:

```javascript
/**
 * Ingest an HTML email file — extract plain text, store HTML source in metadata.
 */
export async function ingestHtmlFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    const htmlContent = fs.readFileSync(filePath, 'utf-8');

    // Strip HTML tags to get plain text
    const plainText = htmlContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

    // Insert document record
    const docRes = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'html', $6, $7, $8) RETURNING id`,
        [namespace, sourceType, title, plainText.slice(0, 5000), { ...metadata, has_html_source: true }, relativePath, path.basename(filePath), Buffer.byteLength(htmlContent)]
    );
    const documentId = docRes.rows[0].id;

    try {
        // Chunk the plain text
        const textChunks = chunkText(plainText);
        if (textChunks.length === 0) textChunks.push({ content: plainText || title, index: 0 });

        // Embed chunks
        const embeddings = await embedBatch(textChunks.map(c => c.content));

        const vectors = [];
        const chunks = [];

        for (let i = 0; i < textChunks.length; i++) {
            const pineconeId = `doc-${documentId}-chunk-${i}`;
            vectors.push({
                id: pineconeId,
                values: embeddings[i],
                metadata: {
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    content_preview: textChunks[i].content.slice(0, 200),
                    media_type: 'html_email',
                },
            });
            chunks.push({
                document_id: documentId,
                chunk_index: i,
                content: textChunks[i].content,
                pinecone_id: pineconeId,
                metadata: {
                    html_source: i === 0 ? htmlContent : undefined,
                    extraction_method: 'html-parse',
                    offset: textChunks[i].offset,
                },
                media_type: 'html_email',
                file_path: relativePath,
            });
        }

        await upsertVectors(namespace, vectors);

        for (const chunk of chunks) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [chunk.document_id, chunk.chunk_index, chunk.content, chunk.pinecone_id, JSON.stringify(chunk.metadata), chunk.media_type, chunk.file_path]
            );
        }

        await pool.query('UPDATE knowledge_documents SET status = $1, chunk_count = $2 WHERE id = $3', ['indexed', chunks.length, documentId]);
        return { documentId, chunksCreated: chunks.length, contentType: 'html' };
    } catch (err) {
        await pool.query('UPDATE knowledge_documents SET status = $1, error_message = $2 WHERE id = $3', ['error', err.message, documentId]);
        throw err;
    }
}
```

- [ ] **Step 2: Add `fs` import if not present**

Check top of ingestion.js — it likely already imports `fs` and `path`. If not, add:

```javascript
import fs from 'fs';
import path from 'path';
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/knowledge/ingestion.js
git commit -m "feat(kb): add HTML email ingestion with text extraction and HTML source storage"
```

---

### Task 5: Add Word document ingestion

**Files:**
- Modify: `packages/core/knowledge/ingestion.js`

- [ ] **Step 1: Add `ingestWordFile` function**

After `ingestHtmlFile`, add:

```javascript
/**
 * Ingest a Word document (.doc/.docx) — extract text via Gemini Vision.
 */
export async function ingestWordFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/msword';

    // Extract text via Gemini
    const extractedText = await extractTextFromDocument(base64, mimeType);
    const content = extractedText.trim() || `[Document: ${title}]`;

    // Insert document record
    const docRes = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'document', $6, $7, $8) RETURNING id`,
        [namespace, sourceType, title, content.slice(0, 5000), { ...metadata, extraction_method: 'gemini-vision' }, relativePath, path.basename(filePath), fileBuffer.length]
    );
    const documentId = docRes.rows[0].id;

    try {
        // Chunk the extracted text
        const textChunks = chunkText(content);
        if (textChunks.length === 0) textChunks.push({ content, index: 0 });

        const embeddings = await embedBatch(textChunks.map(c => c.content));

        const vectors = [];
        const chunks = [];

        for (let i = 0; i < textChunks.length; i++) {
            const pineconeId = `doc-${documentId}-chunk-${i}`;
            vectors.push({
                id: pineconeId,
                values: embeddings[i],
                metadata: {
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    content_preview: textChunks[i].content.slice(0, 200),
                    media_type: 'text',
                },
            });
            chunks.push({
                document_id: documentId,
                chunk_index: i,
                content: textChunks[i].content,
                pinecone_id: pineconeId,
                metadata: { extraction_method: 'gemini-vision', offset: textChunks[i].offset },
                media_type: 'text',
                file_path: relativePath,
            });
        }

        await upsertVectors(namespace, vectors);

        for (const chunk of chunks) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [chunk.document_id, chunk.chunk_index, chunk.content, chunk.pinecone_id, JSON.stringify(chunk.metadata), chunk.media_type, chunk.file_path]
            );
        }

        await pool.query('UPDATE knowledge_documents SET status = $1, chunk_count = $2 WHERE id = $3', ['indexed', chunks.length, documentId]);
        return { documentId, chunksCreated: chunks.length, contentType: 'document' };
    } catch (err) {
        await pool.query('UPDATE knowledge_documents SET status = $1, error_message = $2 WHERE id = $3', ['error', err.message, documentId]);
        throw err;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/knowledge/ingestion.js
git commit -m "feat(kb): add Word document ingestion via Gemini Vision text extraction"
```

---

### Task 6: Update upload endpoint and file routing

**Files:**
- Modify: `apps/dashboard/server.js`

- [ ] **Step 1: Update multer fileFilter to accept new types**

Find the multer config (around line 81-88). The current `allowed` array:

```javascript
const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
```

Replace with:

```javascript
const allowed = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'text/html', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
```

- [ ] **Step 2: Update imports from ingestion.js**

Find the import line for ingestion functions (around line 14-16). Add the new functions:

```javascript
import { ingestDocument, ingestFile, ingestCampaigns, ingestBauTypes, deleteDocument, ingestHtmlFile, ingestWordFile } from '../../packages/core/knowledge/ingestion.js';
```

- [ ] **Step 3: Update `ingestFile` in ingestion.js to route new file types**

In `packages/core/knowledge/ingestion.js`, find the `ingestFile` function (around line 462). Update the MIME_MAP and routing logic:

Add to `MIME_MAP` (around line 275):

```javascript
    '.html': 'text/html',
    '.htm': 'text/html',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
```

In the routing section of `ingestFile` (around line 481), add new file type routes. The current code routes images and PDFs. Add HTML and Word:

```javascript
        const ext = path.extname(uniqueName).toLowerCase();
        if (ext === '.html' || ext === '.htm') {
            return await ingestHtmlFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
        }
        if (ext === '.doc' || ext === '.docx') {
            return await ingestWordFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
        }
```

The destination directory for HTML and Word files should be `assets/kb/docs/`:

```javascript
        const destDir = IMAGE_MIMES.has(mime) ? path.join(kbDir, 'images')
            : mime === 'application/pdf' ? path.join(kbDir, 'pdfs')
            : path.join(kbDir, 'docs');
```

Ensure the `docs` subdirectory is created if it doesn't exist (add `fs.mkdirSync` guard).

- [ ] **Step 4: Update the upload drag-drop text in KnowledgeBase.jsx**

Find the upload label text (around line with `t('knowledge.dragDrop')`) and update the i18n key:

In `translations.js`, update the `dragDrop` key:
- ES: `'Haz clic para seleccionar un archivo (PDF, imagen, HTML, Word)'`
- EN: `'Click to select a file (PDF, image, HTML, Word)'`

- [ ] **Step 5: Commit**

```bash
git add packages/core/knowledge/ingestion.js apps/dashboard/server.js apps/dashboard/src/i18n/translations.js
git commit -m "feat(kb): support HTML and Word uploads, route to new ingestion functions"
```

---

### Task 7: Update retrieval to include html_source

**Files:**
- Modify: `packages/core/knowledge/retrieval.js`

- [ ] **Step 1: Include chunk metadata in search results**

In the `searchKnowledge` function, the PostgreSQL enrichment query (around line 45-55) fetches chunk content. Update it to also return the chunk's `metadata` column so that `html_source` is available.

Find the SELECT query that joins `knowledge_chunks` and `knowledge_documents`. Add `kc.metadata as chunk_metadata` to the SELECT list.

Then in the result mapping, add:

```javascript
            htmlSource: row.chunk_metadata?.html_source || null,
```

- [ ] **Step 2: Pass htmlSource through buildRAGContext**

In `buildRAGContext`, when building the `sources` array, include `htmlSource` if present:

```javascript
            sources.push({
                title: r.documentTitle,
                score: r.score,
                namespace: r.metadata?.namespace,
                content_type: r.mediaType,
                mediaType: r.mediaType,
                filePath: r.filePath,
                htmlSource: r.htmlSource || null,
            });
```

- [ ] **Step 3: Include htmlSource in X-RAG-Sources header**

In `apps/dashboard/server.js`, the KB chat endpoint already sends `X-RAG-Sources`. Since we added `htmlSource` to the sources object, it will be included automatically via `JSON.stringify`. However, HTML content can be large — only include a flag, not the full source:

In the RAG sources header, map sources to exclude large htmlSource but indicate its presence:

```javascript
        const headerSources = ragResult.sources.map(s => ({
            ...s,
            htmlSource: s.htmlSource ? true : undefined,
        }));
        res.setHeader('X-RAG-Sources', JSON.stringify(headerSources));
```

To pass the actual htmlSource to the frontend, add a new header:

```javascript
        const htmlSources = ragResult.sources.filter(s => s.htmlSource);
        if (htmlSources.length > 0) {
            res.setHeader('X-HTML-Sources', JSON.stringify(htmlSources.map(s => ({
                title: s.title,
                htmlSource: s.htmlSource,
            }))));
        }
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/knowledge/retrieval.js apps/dashboard/server.js
git commit -m "feat(kb): pass html_source through RAG pipeline to chat frontend"
```

---

### Task 8: KB Chat email preview rendering

**Files:**
- Modify: `apps/dashboard/src/components/KBChat.jsx`
- Modify: `apps/dashboard/src/i18n/translations.js`
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Add i18n keys for email preview**

In `translations.js`, add to `knowledge.chat`:

ES:
```javascript
emailPreview: 'Preview del email',
viewCode: 'Ver codigo',
hideCode: 'Ocultar codigo',
copyHtml: 'Copiar HTML',
copiedHtml: 'HTML copiado',
```

EN:
```javascript
emailPreview: 'Email preview',
viewCode: 'View code',
hideCode: 'Hide code',
copyHtml: 'Copy HTML',
copiedHtml: 'HTML copied',
```

- [ ] **Step 2: Add CSS for email preview card**

In `index.css`, after the `.md-content` styles, add:

```css
/* KB Chat Email Preview */
.kb-email-preview { margin: 12px 0; border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.kb-email-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: var(--bg-hover); border-bottom: 1px solid var(--border-light);
  font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
}
.kb-email-preview-header button {
  padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border-light);
  background: var(--bg-card); font-size: 0.72rem; cursor: pointer; color: var(--text-secondary);
}
.kb-email-preview-header button:hover { background: var(--primary-muted, #6366f115); color: var(--primary); }
.kb-email-preview iframe {
  width: 100%; height: 400px; border: none; background: #fff;
}
.kb-email-code {
  max-height: 200px; overflow: auto; padding: 10px 12px;
  background: #1e1e2e; color: #cdd6f4; font-size: 0.75rem;
  font-family: monospace; white-space: pre-wrap; word-break: break-all;
}
```

- [ ] **Step 3: Update KBChat to parse X-HTML-Sources and render preview**

In `KBChat.jsx`, add state for HTML sources:

```javascript
const [htmlSources, setHtmlSources] = useState([]);
```

In the `sendMessage` function, after parsing `X-RAG-Sources`, also parse `X-HTML-Sources`:

```javascript
            const htmlHeader = res.headers.get('X-HTML-Sources');
            if (htmlHeader) {
                try { setHtmlSources(JSON.parse(htmlHeader)); } catch { /* ignore */ }
            } else {
                setHtmlSources([]);
            }
```

Add a helper component inside KBChat (before the return statement):

```javascript
    function EmailPreview({ html, title }) {
        const [showCode, setShowCode] = useState(false);
        const iframeRef = useRef(null);

        useEffect(() => {
            if (iframeRef.current) {
                const doc = iframeRef.current.contentDocument;
                doc.open();
                doc.write(html);
                doc.close();
            }
        }, [html]);

        return (
            <div className="kb-email-preview">
                <div className="kb-email-preview-header">
                    <span>{t('knowledge.chat.emailPreview')}: {title}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowCode(!showCode)}>
                            {showCode ? t('knowledge.chat.hideCode') : t('knowledge.chat.viewCode')}
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(html); }}>
                            {t('knowledge.chat.copyHtml')}
                        </button>
                    </div>
                </div>
                <iframe ref={iframeRef} sandbox="allow-same-origin" title={title} />
                {showCode && <div className="kb-email-code">{html}</div>}
            </div>
        );
    }
```

Render HTML previews after the sources panel and before the input row:

```javascript
            {htmlSources.length > 0 && htmlSources.map((hs, i) => (
                <EmailPreview key={i} html={hs.htmlSource} title={hs.title} />
            ))}
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/KBChat.jsx apps/dashboard/src/i18n/translations.js apps/dashboard/src/index.css
git commit -m "feat(kb): render email HTML preview with code toggle in KB Chat"
```

---

### Task 9: Delete old document and test with Preflight .doc

**Files:**
- No code changes — manual testing via the UI and curl

- [ ] **Step 1: Delete the existing Preflight Document**

Via curl (or via the Documents tab Delete button):

```bash
curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d '{"email":"test@agentos.dev","password":"test1234"}' -c /tmp/ck.txt
curl -s -X DELETE http://localhost:3001/api/knowledge/documents/3 -b /tmp/ck.txt
```

(Document ID 3 is the Preflight Document based on earlier investigation.)

- [ ] **Step 2: Upload the Word document**

```bash
curl -s -X POST http://localhost:3001/api/knowledge/upload \
  -b /tmp/ck.txt \
  -F "file=@docs/Preflight+_+Experience.doc" \
  -F "title=Preflight Experience Document" \
  -F "namespace=research"
```

Expected: `{ documentId: N, chunksCreated: M, contentType: 'document' }` where M > 1 (multiple text chunks).

- [ ] **Step 3: Test the KB Chat**

Ask in the KB Chat: "seedlist de preflight"

Expected: The assistant should respond with **actual text content** from the document, not just a link.

- [ ] **Step 4: Verify in Documents tab**

Check that the new document shows as "indexed" with a chunk count > 1 and content_type "document".

---

## Verification Checklist

- [ ] PDF upload → extracts real text per page → KB Chat shows content
- [ ] Image upload → generates description → searchable by description
- [ ] HTML email upload → text extracted + HTML source stored → preview renders in chat
- [ ] Word doc upload → text extracted → searchable and displayed in chat
- [ ] Existing text ingestion still works (ingestCampaigns, manual text docs)
- [ ] KB Chat responds conversationally with actual document content
- [ ] Overview tab stats update correctly
- [ ] Documents tab shows correct content_type for each document
