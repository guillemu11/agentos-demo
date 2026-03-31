/**
 * Knowledge Base — Ingestion Pipeline
 *
 * Chunks text, embeds via Gemini, upserts to Pinecone, tracks in PostgreSQL.
 */

import { embedText, embedBatch, embedImage, embedPdf, isGeminiReady, extractTextFromPdfPage, extractTextFromImage, extractTextFromDocument } from '../ai-providers/gemini.js';
import { upsertVectors, isPineconeReady, deleteVectors } from '../ai-providers/pinecone.js';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_CHUNK_SIZE = 500;   // ~500 tokens (approximated as chars / 4)
const DEFAULT_OVERLAP = 50;

// ─── Text Chunking ──────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks of roughly `chunkSize` tokens.
 * Uses character-based approximation (1 token ≈ 4 chars).
 */
export function chunkText(text, { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
    const charSize = chunkSize * 4;
    const charOverlap = overlap * 4;

    if (text.length <= charSize) {
        return [{ content: text, index: 0, offset: 0 }];
    }

    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = start + charSize;

        // Try to break at a sentence or paragraph boundary
        if (end < text.length) {
            const slice = text.slice(end - 200, end + 200);
            const breakPoints = ['\n\n', '.\n', '. ', '\n'];
            for (const bp of breakPoints) {
                const bpIdx = slice.indexOf(bp);
                if (bpIdx !== -1) {
                    end = end - 200 + bpIdx + bp.length;
                    break;
                }
            }
        }

        end = Math.min(end, text.length);
        chunks.push({ content: text.slice(start, end).trim(), index, offset: start });
        index++;
        start = end - charOverlap;
        if (start >= text.length) break;
    }

    return chunks.filter(c => c.content.length > 0);
}

// ─── Document Ingestion ─────────────────────────────────────────────────────

/**
 * Ingest a single document into the knowledge base.
 *
 * @param {import('pg').Pool} pool
 * @param {{ title: string, content: string, namespace: string, sourceType: string, sourceId?: string, metadata?: object }} doc
 * @returns {{ documentId: number, chunksCreated: number }}
 */
export async function ingestDocument(pool, doc) {
    if (!isGeminiReady()) throw new Error('Gemini not initialized — cannot embed');
    if (!isPineconeReady()) throw new Error('Pinecone not initialized — cannot store vectors');

    const { title, content, namespace, sourceType, sourceId = null, metadata = {} } = doc;

    // 1. Insert document with status 'processing'
    const docResult = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, source_id, title, content, metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'processing')
         RETURNING id`,
        [namespace, sourceType, sourceId, title, content, JSON.stringify(metadata)]
    );
    const documentId = docResult.rows[0].id;

    try {
        // 2. Chunk the content
        const chunks = chunkText(content);

        // 3. Embed all chunks
        const texts = chunks.map(c => c.content);
        const embeddings = await embedBatch(texts);

        // 4. Prepare vectors for Pinecone
        const vectors = [];
        const chunkRows = [];

        for (let i = 0; i < chunks.length; i++) {
            const pineconeId = `doc-${documentId}-chunk-${i}`;
            vectors.push({
                id: pineconeId,
                values: embeddings[i],
                metadata: {
                    ...metadata,
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    content_preview: chunks[i].content.slice(0, 200),
                },
            });
            chunkRows.push({
                documentId,
                chunkIndex: i,
                content: chunks[i].content,
                pineconeId,
                metadata: { offset: chunks[i].offset },
            });
        }

        // 5. Upsert to Pinecone
        await upsertVectors(namespace, vectors);

        // 6. Save chunks to PostgreSQL
        for (const row of chunkRows) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [row.documentId, row.chunkIndex, row.content, row.pineconeId, JSON.stringify(row.metadata)]
            );
        }

        // 7. Update document status
        await pool.query(
            `UPDATE knowledge_documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
            [chunks.length, documentId]
        );

        return { documentId, chunksCreated: chunks.length };

    } catch (err) {
        await pool.query(
            `UPDATE knowledge_documents SET status = 'error', error_message = $1 WHERE id = $2`,
            [err.message, documentId]
        );
        throw err;
    }
}

// ─── Bulk Ingestion Helpers ─────────────────────────────────────────────────

/**
 * Ingest all campaigns from emiratesCampaigns.js data.
 * @param {import('pg').Pool} pool
 * @param {object[]} campaigns - Array of campaign objects from emiratesCampaigns.js
 * @param {object[]} groups - Array of CAMPAIGN_GROUPS
 * @returns {{ documentsCreated: number, chunksCreated: number }}
 */
export async function ingestCampaigns(pool, campaigns, groups) {
    let documentsCreated = 0;
    let chunksCreated = 0;

    for (const campaign of campaigns) {
        const group = groups.find(g => g.id === campaign.group);
        const content = [
            `Campaign: ${campaign.name}`,
            `Group: ${group?.name || campaign.group}`,
            `Status: ${campaign.status}`,
            `Channel: ${campaign.channel || 'email'}`,
            `Description: ${campaign.description}`,
            `Trigger: ${campaign.trigger}`,
            `Audience: ${campaign.audience}`,
            `KPIs: ${campaign.kpis.sends} sends, ${campaign.kpis.openRate}% open rate, ${campaign.kpis.clickRate}% click rate, ${campaign.kpis.conversionRate}% conversion`,
            campaign.cost ? `AI Cost: ${campaign.cost}€` : '',
            campaign.variants?.length ? `Variants: ${campaign.variants.map(v => `${v.name} (${v.openRate}% open, ${v.clickRate}% click)`).join('; ')}` : '',
        ].filter(Boolean).join('\n');

        const result = await ingestDocument(pool, {
            title: campaign.name,
            content,
            namespace: 'campaigns',
            sourceType: 'campaign',
            sourceId: campaign.id,
            metadata: {
                campaign_id: campaign.id,
                group: campaign.group,
                status: campaign.status,
                content_type: 'campaign_overview',
            },
        });
        documentsCreated++;
        chunksCreated += result.chunksCreated;
    }

    return { documentsCreated, chunksCreated };
}

/**
 * Ingest all BAU types from emiratesBauTypes.js data.
 * @param {import('pg').Pool} pool
 * @param {object[]} bauTypes
 * @param {object} categories - BAU_CATEGORIES map
 */
export async function ingestBauTypes(pool, bauTypes, categories) {
    let documentsCreated = 0;
    let chunksCreated = 0;

    for (const bau of bauTypes) {
        const cat = categories[bau.category];
        const content = [
            `BAU Type: ${bau.name}`,
            `Category: ${cat?.name || bau.category}`,
            `Frequency: ${bau.frequency}`,
            `Complexity: ${bau.complexity}`,
            `Description: ${bau.description}`,
            bau.defaultSegments?.length ? `Default Segments: ${bau.defaultSegments.join(', ')}` : '',
            bau.performanceHistory?.length ? `Recent Performance: ${bau.performanceHistory.map(p => `${p.month}: ${p.openRate}% open, ${p.ctr}% CTR`).join('; ')}` : '',
        ].filter(Boolean).join('\n');

        const result = await ingestDocument(pool, {
            title: bau.name,
            content,
            namespace: 'campaigns',
            sourceType: 'bau_type',
            sourceId: bau.id,
            metadata: {
                bau_type_id: bau.id,
                category: bau.category,
                frequency: bau.frequency,
                content_type: 'bau_overview',
            },
        });
        documentsCreated++;
        chunksCreated += result.chunksCreated;
    }

    return { documentsCreated, chunksCreated };
}

/**
 * Delete a document and its vectors from both PostgreSQL and Pinecone.
 * @param {import('pg').Pool} pool
 * @param {number} documentId
 */
export async function deleteDocument(pool, documentId) {
    // Get chunk pinecone_ids and namespace
    const docRow = await pool.query('SELECT namespace FROM knowledge_documents WHERE id = $1', [documentId]);
    if (docRow.rows.length === 0) return;

    const chunkRows = await pool.query('SELECT pinecone_id FROM knowledge_chunks WHERE document_id = $1', [documentId]);
    const pineconeIds = chunkRows.rows.map(r => r.pinecone_id).filter(Boolean);
    const namespace = docRow.rows[0].namespace;

    // Delete from Pinecone
    if (pineconeIds.length > 0 && isPineconeReady()) {
        await deleteVectors(namespace, pineconeIds);
    }

    // Cascade delete handles chunks
    await pool.query('DELETE FROM knowledge_documents WHERE id = $1', [documentId]);

    // Also delete the file from disk if it exists
    const filePath = docRow.rows[0].file_path;
    if (filePath) {
        const fullPath = path.join(PROJECT_ROOT, 'assets/kb', filePath);
        fs.unlink(fullPath, () => {});
    }
}

// ─── Multimodal Ingestion ──────────────────────────────────────────────────

const MIME_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_PDF_SIZE = 3 * 1024 * 1024; // ~3MB proxy for 6-page limit

/**
 * Ingest a single image into the knowledge base.
 */
export async function ingestImageFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    if (!isGeminiReady()) throw new Error('Gemini not initialized — cannot embed');
    if (!isPineconeReady()) throw new Error('Pinecone not initialized — cannot store vectors');

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/png';
    const fileSize = fileBuffer.length;

    // 1. Insert document
    const docResult = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'image', $6, $7, $8)
         RETURNING id`,
        [namespace, sourceType, title, `[Image: ${title}]`, JSON.stringify(metadata), relativePath, path.basename(filePath), fileSize]
    );
    const documentId = docResult.rows[0].id;

    try {
        // 2. Extract description from image via Gemini Vision
        const description = await extractTextFromImage(base64, mimeType);
        const content = description.trim() || `[Image: ${title}]`;

        // 3. Embed description text
        const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT');
        const pineconeId = `doc-${documentId}-chunk-0`;

        // 4. Upsert to Pinecone
        await upsertVectors(namespace, [{
            id: pineconeId,
            values: embedding,
            metadata: {
                ...metadata,
                document_id: documentId,
                chunk_index: 0,
                namespace,
                source_type: sourceType,
                title,
                media_type: 'image',
                file_path: relativePath,
                image_description: content.slice(0, 200),
                extraction_method: 'gemini-vision',
                content_preview: content.slice(0, 200),
            },
        }]);

        // 5. Save chunk to PostgreSQL
        await pool.query(
            `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
             VALUES ($1, 0, $2, $3, $4, 'image', $5)`,
            [documentId, content, pineconeId, JSON.stringify({ mimeType, image_description: content, extraction_method: 'gemini-vision' }), relativePath]
        );

        // 6. Update status
        await pool.query(
            `UPDATE knowledge_documents SET status = 'indexed', chunk_count = 1 WHERE id = $1`,
            [documentId]
        );

        return { documentId, chunksCreated: 1, contentType: 'image' };
    } catch (err) {
        await pool.query(`UPDATE knowledge_documents SET status = 'error', error_message = $1 WHERE id = $2`, [err.message, documentId]);
        throw err;
    }
}

/**
 * Split a PDF into individual single-page PDFs using pdf-lib.
 * Returns array of base64-encoded single-page PDFs.
 */
async function splitPdfPages(fileBuffer) {
    const srcDoc = await PDFDocument.load(fileBuffer);
    const pageCount = srcDoc.getPageCount();
    const pages = [];

    for (let i = 0; i < pageCount; i++) {
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        const pdfBytes = await singlePageDoc.save();
        pages.push(Buffer.from(pdfBytes).toString('base64'));
    }

    return pages;
}

/**
 * Ingest a PDF by splitting into pages and embedding each page natively.
 * No page limit — each page is embedded as a separate chunk.
 */
export async function ingestPdfFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    if (!isGeminiReady()) throw new Error('Gemini not initialized — cannot embed');
    if (!isPineconeReady()) throw new Error('Pinecone not initialized — cannot store vectors');

    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // 1. Insert document
    const docResult = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'pdf', $6, $7, $8)
         RETURNING id`,
        [namespace, sourceType, title, `[PDF: ${title}]`, JSON.stringify(metadata), relativePath, path.basename(filePath), fileSize]
    );
    const documentId = docResult.rows[0].id;

    try {
        // 2. Split PDF into individual pages
        console.log(`[KB] Splitting PDF "${title}" into pages...`);
        const pageBase64s = await splitPdfPages(fileBuffer);
        console.log(`[KB] PDF has ${pageBase64s.length} pages — embedding each one`);

        // Save each page as a separate PDF file for inline display
        const pagesDir = path.join(PROJECT_ROOT, 'assets/kb/pdfs/pages');
        fs.mkdirSync(pagesDir, { recursive: true });

        const vectors = [];
        const chunkRows = [];

        // 3. Extract text and embed each page (sequentially to respect rate limits)
        for (let i = 0; i < pageBase64s.length; i++) {
            // Save individual page PDF to disk
            const pageFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-page-${i + 1}.pdf`;
            const pageFilePath = path.join(pagesDir, pageFilename);
            fs.writeFileSync(pageFilePath, Buffer.from(pageBase64s[i], 'base64'));
            const pageRelativePath = `pdfs/pages/${pageFilename}`;

            console.log(`[KB]   Extracting text from page ${i + 1}/${pageBase64s.length}...`);
            const pageText = await extractTextFromPdfPage(pageBase64s[i]);
            const content = pageText.trim() || `[PDF: ${title} — page ${i + 1}/${pageBase64s.length}]`;

            console.log(`[KB]   Embedding page ${i + 1}/${pageBase64s.length}...`);
            const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT');
            const pineconeId = `doc-${documentId}-chunk-${i}`;

            vectors.push({
                id: pineconeId,
                values: embedding,
                metadata: {
                    ...metadata,
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    media_type: 'pdf_page',
                    file_path: pageRelativePath,
                    page_number: i + 1,
                    extraction_method: 'gemini-vision',
                    content_preview: content.slice(0, 200),
                },
            });

            chunkRows.push({
                documentId,
                chunkIndex: i,
                content,
                pineconeId,
                pageNumber: i + 1,
                pageRelativePath,
            });
        }

        // 4. Upsert all page vectors to Pinecone
        await upsertVectors(namespace, vectors);

        // 5. Save chunks to PostgreSQL (each chunk points to its individual page file)
        for (const row of chunkRows) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
                 VALUES ($1, $2, $3, $4, $5, 'pdf_page', $6)`,
                [row.documentId, row.chunkIndex, row.content, row.pineconeId, JSON.stringify({ page_number: row.pageNumber, extraction_method: 'gemini-vision' }), row.pageRelativePath]
            );
        }

        // 6. Update status
        await pool.query(
            `UPDATE knowledge_documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
            [pageBase64s.length, documentId]
        );

        console.log(`[KB] PDF "${title}" ingested: ${pageBase64s.length} pages`);
        return { documentId, chunksCreated: pageBase64s.length, contentType: 'pdf' };
    } catch (err) {
        await pool.query(`UPDATE knowledge_documents SET status = 'error', error_message = $1 WHERE id = $2`, [err.message, documentId]);
        throw err;
    }
}

/**
 * Ingest an HTML file (e.g. an email) by stripping tags to plain text, chunking,
 * embedding, and storing in Pinecone + PostgreSQL.
 * Raw HTML is preserved in the first chunk's metadata as `html_source`.
 */
export async function ingestHtmlFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    if (!isGeminiReady()) throw new Error('Gemini not initialized — cannot embed');
    if (!isPineconeReady()) throw new Error('Pinecone not initialized — cannot store vectors');

    const rawHtml = fs.readFileSync(filePath, 'utf-8');
    const fileSize = Buffer.byteLength(rawHtml, 'utf-8');

    // Strip HTML to plain text (no external deps)
    let plainText = rawHtml
        // Remove <style> and <script> blocks entirely
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        // Strip all remaining HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Insert document
    const docResult = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'html', $6, $7, $8)
         RETURNING id`,
        [namespace, sourceType, title, plainText.slice(0, 2000), JSON.stringify(metadata), relativePath, path.basename(filePath), fileSize]
    );
    const documentId = docResult.rows[0].id;

    try {
        // 2. Chunk the plain text
        let chunks = chunkText(plainText);
        if (chunks.length === 0) {
            chunks = [{ content: plainText, index: 0, offset: 0 }];
        }

        // 3. Embed all chunks
        const texts = chunks.map(c => c.content);
        const embeddings = await embedBatch(texts);

        // 4. Prepare vectors and chunk rows
        const vectors = [];
        const chunkRows = [];

        for (let i = 0; i < chunks.length; i++) {
            const pineconeId = `doc-${documentId}-chunk-${i}`;
            const chunkMeta = {
                ...metadata,
                document_id: documentId,
                chunk_index: i,
                namespace,
                source_type: sourceType,
                title,
                media_type: 'html_email',
                file_path: relativePath,
                content_preview: chunks[i].content.slice(0, 200),
            };

            vectors.push({
                id: pineconeId,
                values: embeddings[i],
                metadata: chunkMeta,
            });

            const pgMeta = { offset: chunks[i].offset };
            // Store full raw HTML only in first chunk to avoid bloating every chunk
            if (i === 0) {
                pgMeta.html_source = rawHtml;
            }

            chunkRows.push({
                documentId,
                chunkIndex: i,
                content: chunks[i].content,
                pineconeId,
                metadata: pgMeta,
            });
        }

        // 5. Upsert to Pinecone
        await upsertVectors(namespace, vectors);

        // 6. Save chunks to PostgreSQL
        for (const row of chunkRows) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
                 VALUES ($1, $2, $3, $4, $5, 'html_email', $6)`,
                [row.documentId, row.chunkIndex, row.content, row.pineconeId, JSON.stringify(row.metadata), relativePath]
            );
        }

        // 7. Update status
        await pool.query(
            `UPDATE knowledge_documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
            [chunks.length, documentId]
        );

        return { documentId, chunksCreated: chunks.length, contentType: 'html' };
    } catch (err) {
        await pool.query(`UPDATE knowledge_documents SET status = 'error', error_message = $1 WHERE id = $2`, [err.message, documentId]);
        throw err;
    }
}

/**
 * Ingest a Word document (.docx / .doc) by extracting text via Gemini Vision,
 * chunking, embedding, and storing in Pinecone + PostgreSQL.
 */
export async function ingestWordFile(pool, { filePath, relativePath, title, namespace, sourceType = 'upload', metadata = {} }) {
    if (!isGeminiReady()) throw new Error('Gemini not initialized — cannot embed');
    if (!isPineconeReady()) throw new Error('Pinecone not initialized — cannot store vectors');

    const ext = path.extname(filePath).toLowerCase();
    const fileSize = fs.statSync(filePath).size;

    // 1. Insert document
    const docResult = await pool.query(
        `INSERT INTO knowledge_documents (namespace, source_type, title, content, metadata, status, content_type, file_path, original_filename, file_size)
         VALUES ($1, $2, $3, $4, $5, 'processing', 'document', $6, $7, $8)
         RETURNING id`,
        [namespace, sourceType, title, `[Document: ${title}]`, JSON.stringify(metadata), relativePath, path.basename(filePath), fileSize]
    );
    const documentId = docResult.rows[0].id;

    try {
        // 2. Extract text — .docx is a ZIP with XML, extract text directly
        let extracted = '';
        if (ext === '.doc') {
            throw new Error('Legacy .doc format is not supported. Please save as PDF and re-upload.');
        }
        // .docx: read ZIP, find word/document.xml, strip XML tags
        const { execSync } = await import('child_process');
        try {
            // Use PowerShell to extract document.xml from the docx ZIP
            const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath.replace(/'/g, "''")}'); $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }; $reader = New-Object System.IO.StreamReader($entry.Open()); $reader.ReadToEnd(); $reader.Close(); $zip.Dispose()`;
            const xml = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8' });
            extracted = xml
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        } catch (zipErr) {
            throw new Error(`Failed to extract text from .docx: ${zipErr.message}. Try saving as PDF instead.`);
        }
        const content = (extracted || '').trim() || `[Document: ${title}]`;

        // 3. Chunk the extracted text
        let chunks = chunkText(content);
        if (chunks.length === 0) {
            chunks = [{ content, index: 0, offset: 0 }];
        }

        // 4. Embed all chunks
        const texts = chunks.map(c => c.content);
        const embeddings = await embedBatch(texts);

        // 5. Prepare vectors and chunk rows
        const vectors = [];
        const chunkRows = [];

        for (let i = 0; i < chunks.length; i++) {
            const pineconeId = `doc-${documentId}-chunk-${i}`;
            vectors.push({
                id: pineconeId,
                values: embeddings[i],
                metadata: {
                    ...metadata,
                    document_id: documentId,
                    chunk_index: i,
                    namespace,
                    source_type: sourceType,
                    title,
                    media_type: 'text',
                    file_path: relativePath,
                    extraction_method: 'gemini-vision',
                    content_preview: chunks[i].content.slice(0, 200),
                },
            });

            chunkRows.push({
                documentId,
                chunkIndex: i,
                content: chunks[i].content,
                pineconeId,
                metadata: { offset: chunks[i].offset, extraction_method: 'gemini-vision' },
            });
        }

        // 6. Upsert to Pinecone
        await upsertVectors(namespace, vectors);

        // 7. Save chunks to PostgreSQL
        for (const row of chunkRows) {
            await pool.query(
                `INSERT INTO knowledge_chunks (document_id, chunk_index, content, pinecone_id, metadata, media_type, file_path)
                 VALUES ($1, $2, $3, $4, $5, 'text', $6)`,
                [row.documentId, row.chunkIndex, row.content, row.pineconeId, JSON.stringify(row.metadata), relativePath]
            );
        }

        // 8. Update status
        await pool.query(
            `UPDATE knowledge_documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
            [chunks.length, documentId]
        );

        return { documentId, chunksCreated: chunks.length, contentType: 'document' };
    } catch (err) {
        await pool.query(`UPDATE knowledge_documents SET status = 'error', error_message = $1 WHERE id = $2`, [err.message, documentId]);
        throw err;
    }
}

/**
 * Dispatcher: detect file type and route to the appropriate ingestion function.
 * Moves file from tmp/ to permanent location.
 */
export async function ingestFile(pool, { filePath, originalFilename, title, namespace, sourceType = 'upload', metadata = {} }) {
    const ext = path.extname(originalFilename || filePath).toLowerCase();
    const mimeType = MIME_MAP[ext];

    if (!mimeType) {
        throw new Error(`Unsupported file type: ${ext}. Supported: ${Object.keys(MIME_MAP).join(', ')}`);
    }

    const kbDir = path.join(PROJECT_ROOT, 'assets/kb');
    const destDir = IMAGE_MIMES.has(mimeType) ? path.join(kbDir, 'images')
        : mimeType === 'application/pdf' ? path.join(kbDir, 'pdfs')
        : path.join(kbDir, 'docs');
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const destPath = path.join(destDir, uniqueName);
    const subDir = IMAGE_MIMES.has(mimeType) ? 'images' : mimeType === 'application/pdf' ? 'pdfs' : 'docs';
    const relativePath = `${subDir}/${uniqueName}`;

    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });

    // Move from tmp to permanent location
    fs.copyFileSync(filePath, destPath);
    fs.unlinkSync(filePath);

    if (IMAGE_MIMES.has(mimeType)) {
        return ingestImageFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
    }
    if (mimeType === 'application/pdf') {
        return ingestPdfFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
    }
    if (ext === '.html' || ext === '.htm') {
        return await ingestHtmlFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
    }
    if (ext === '.doc' || ext === '.docx') {
        return await ingestWordFile(pool, { filePath: destPath, relativePath, title, namespace, sourceType, metadata });
    }
    throw new Error(`Unhandled file type: ${ext}`);
}
