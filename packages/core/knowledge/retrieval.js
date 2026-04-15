/**
 * Knowledge Base — Retrieval & RAG Context Builder
 *
 * Embeds queries via Gemini, searches Pinecone, builds context for Claude.
 */

import { embedText, isGeminiReady } from '../ai-providers/gemini.js';
import { queryVectors, isPineconeReady, rerankResults } from '../ai-providers/pinecone.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_BLOCKS_DIR = path.resolve(__dirname, '../../../email_blocks');

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.45;
const DEFAULT_MAX_TOKENS = 3000;

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Semantic search across the knowledge base.
 *
 * @param {import('pg').Pool} pool
 * @param {string} query - Natural language query
 * @param {{ namespace?: string, topK?: number, filter?: object, minScore?: number }} options
 * @returns {Promise<{ content: string, score: number, metadata: object, documentTitle: string }[]>}
 */
export async function searchKnowledge(pool, query, options = {}) {
    if (!isGeminiReady() || !isPineconeReady()) return [];

    const { namespace, topK = DEFAULT_TOP_K, filter, minScore = DEFAULT_MIN_SCORE } = options;

    // 1. Embed the query
    const embedding = await embedText(query);

    // 2. Search Pinecone
    const searchNamespace = namespace || '';
    const matches = await queryVectors(searchNamespace, embedding, { topK, filter });

    // 3. Filter by minimum score
    let filtered = matches.filter(m => m.score >= minScore);

    // 3.5 Rerank with cross-encoder for better precision
    if (filtered.length > 1) {
        try {
            const docs = filtered.map(m => ({ text: m.metadata?.content_preview || m.id, _match: m }));
            const reranked = await rerankResults(query, docs.map(d => ({ text: d.text })), { topN: topK });
            if (reranked?.data?.length) {
                filtered = reranked.data.map(r => docs[r.index]._match);
            }
        } catch (err) {
            console.warn('[KB] Reranking failed, using cosine order:', err.message);
        }
    }

    // 4. Enrich with chunk content from DB
    const results = [];
    for (const match of filtered) {
        let content = match.metadata?.content_preview || '';
        let documentTitle = match.metadata?.title || 'Unknown';

        // Try to get full chunk content from DB (including multimodal fields)
        let mediaType = match.metadata?.media_type || 'text';
        let filePath = match.metadata?.file_path || null;
        let chunkMetadata = null;

        let htmlSource = null;
        if (match.id) {
            const chunkRow = await pool.query(
                `SELECT kc.content, kc.document_id, kc.chunk_index, kd.title, kc.media_type, kc.file_path, kc.metadata as chunk_metadata
                 FROM knowledge_chunks kc
                 JOIN knowledge_documents kd ON kd.id = kc.document_id
                 WHERE kc.pinecone_id = $1`,
                [match.id]
            );
            if (chunkRow.rows.length > 0) {
                const row = chunkRow.rows[0];
                content = row.content;
                documentTitle = row.title;
                mediaType = row.media_type || mediaType;
                filePath = row.file_path || filePath;
                chunkMetadata = row.chunk_metadata || null;

                // Check for stored html_source in metadata
                htmlSource = chunkMetadata?.html_source || null;

                // If not in metadata, try reading the original file from disk (email-blocks)
                if (!htmlSource && match.metadata?.file) {
                    const diskPath = path.join(EMAIL_BLOCKS_DIR, match.metadata.file);
                    if (fs.existsSync(diskPath)) {
                        htmlSource = fs.readFileSync(diskPath, 'utf-8');
                    }
                }

                // For html_email docs: if this is not chunk 0, fetch chunk 0 which holds html_source
                if (!htmlSource && mediaType === 'html_email' && row.chunk_index > 0) {
                    const chunk0 = await pool.query(
                        `SELECT metadata FROM knowledge_chunks WHERE document_id = $1 AND chunk_index = 0`,
                        [row.document_id]
                    );
                    if (chunk0.rows.length > 0) {
                        htmlSource = chunk0.rows[0].metadata?.html_source || null;
                    }
                }

                // Fallback: reconstruct from chunked content (may have overlap artifacts)
                if (!htmlSource) {
                    const HTML_MARKER = '\n\n--- HTML SOURCE ---\n';
                    const allChunks = await pool.query(
                        `SELECT chunk_index, content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index`,
                        [row.document_id]
                    );
                    const markerChunk = allChunks.rows.find(c => c.content.includes(HTML_MARKER));
                    if (markerChunk) {
                        const markerIdx = markerChunk.content.indexOf(HTML_MARKER);
                        if (markerChunk.chunk_index === 0) {
                            content = markerChunk.content.slice(0, markerIdx).trim();
                        }
                        const CHUNK_OVERLAP = 200;
                        const parts = [markerChunk.content.slice(markerIdx + HTML_MARKER.length)];
                        for (const c of allChunks.rows) {
                            if (c.chunk_index > markerChunk.chunk_index) parts.push(c.content.slice(CHUNK_OVERLAP));
                        }
                        htmlSource = parts.join('').trim();
                    }
                }
            }
        }

        results.push({
            content,
            score: Math.round(match.score * 1000) / 1000,
            metadata: match.metadata,
            documentTitle,
            mediaType,
            filePath,
            htmlSource,
        });
    }

    return results;
}

// ─── Multi-Namespace Search ─────────────────────────────────────────────────

/**
 * Search across multiple namespaces and merge results.
 */
export async function searchMultiNamespace(pool, query, namespaces, { topK = DEFAULT_TOP_K, filter, minScore = DEFAULT_MIN_SCORE } = {}) {
    if (!isGeminiReady() || !isPineconeReady()) return [];

    const embedding = await embedText(query);
    const allMatches = [];

    for (const ns of namespaces) {
        const matches = await queryVectors(ns, embedding, { topK, filter });
        for (const m of matches) {
            if (m.score >= minScore) {
                allMatches.push({ ...m, _namespace: ns });
            }
        }
    }

    // Sort by score descending
    allMatches.sort((a, b) => b.score - a.score);

    // Rerank with cross-encoder for better precision
    // Save best match per namespace before reranking so diversity is preserved afterward
    const bestPerNs = {};
    for (const m of allMatches) {
        const ns = m._namespace;
        if (!bestPerNs[ns]) bestPerNs[ns] = m;
    }
    if (allMatches.length > 1) {
        try {
            const docs = allMatches.map(m => ({ text: m.metadata?.content_preview || m.id, _match: m }));
            const reranked = await rerankResults(query, docs.map(d => ({ text: d.text })), { topN: Math.min(allMatches.length, topK * 2) });
            if (reranked?.data?.length) {
                const rerankedMatches = reranked.data.map(r => docs[r.index]._match);
                // Ensure every namespace that had results keeps at least its best match
                for (const [ns, best] of Object.entries(bestPerNs)) {
                    if (!rerankedMatches.some(m => m._namespace === ns)) {
                        rerankedMatches.push(best);
                    }
                }
                allMatches.length = 0;
                allMatches.push(...rerankedMatches);
            }
        } catch (err) {
            console.warn('[KB] Multi-namespace reranking failed, using cosine order:', err.message);
        }
    }

    // Deduplicate by document_id
    const seen = new Set();
    const deduped = [];
    for (const match of allMatches) {
        const docId = match.metadata?.document_id;
        const key = docId ? `doc-${docId}-${match.metadata?.chunk_index}` : match.id;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(match);
        }
    }

    // Ensure namespace diversity: dynamic cap per namespace based on search breadth
    const maxPerNamespace = Math.max(2, Math.ceil(topK / namespaces.length));
    const nsCounts = {};
    const diverseResults = [];
    const overflow = [];
    for (const match of deduped) {
        const ns = match._namespace || 'unknown';
        nsCounts[ns] = (nsCounts[ns] || 0) + 1;
        if (nsCounts[ns] <= maxPerNamespace) {
            diverseResults.push(match);
        } else {
            overflow.push(match);
        }
    }
    // Fill remaining slots from overflow (highest score first)
    const finalResults = [...diverseResults, ...overflow].slice(0, topK);
    // Enrich top results
    const results = [];
    for (const match of finalResults) {
        let content = match.metadata?.content_preview || '';
        let documentTitle = match.metadata?.title || 'Unknown';
        let mediaType = match.metadata?.media_type || 'text';
        let filePath = match.metadata?.file_path || null;

        let htmlSource = null;
        if (match.id) {
            const chunkRow = await pool.query(
                `SELECT kc.content, kc.document_id, kc.chunk_index, kd.title, kc.media_type, kc.file_path, kc.metadata as chunk_metadata FROM knowledge_chunks kc
                 JOIN knowledge_documents kd ON kd.id = kc.document_id
                 WHERE kc.pinecone_id = $1`,
                [match.id]
            );
            if (chunkRow.rows.length > 0) {
                const row = chunkRow.rows[0];
                content = row.content;
                documentTitle = row.title;
                mediaType = row.media_type || mediaType;
                filePath = row.file_path || filePath;
                const chunkMeta = row.chunk_metadata || null;

                htmlSource = chunkMeta?.html_source || null;

                // Try reading from disk first (email-blocks have file metadata)
                if (!htmlSource && match.metadata?.file) {
                    const diskPath = path.join(EMAIL_BLOCKS_DIR, match.metadata.file);
                    if (fs.existsSync(diskPath)) {
                        htmlSource = fs.readFileSync(diskPath, 'utf-8');
                    }
                }

                // For html_email docs: if this is not chunk 0, fetch chunk 0 which holds html_source
                if (!htmlSource && mediaType === 'html_email' && row.chunk_index > 0) {
                    const chunk0 = await pool.query(
                        `SELECT metadata FROM knowledge_chunks WHERE document_id = $1 AND chunk_index = 0`,
                        [row.document_id]
                    );
                    if (chunk0.rows.length > 0) {
                        htmlSource = chunk0.rows[0].metadata?.html_source || null;
                    }
                }

                // Reconstruct full HTML from all chunks when stored in content
                if (!htmlSource) {
                    const HTML_MARKER = '\n\n--- HTML SOURCE ---\n';
                    const allChunks = await pool.query(
                        `SELECT chunk_index, content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index`,
                        [row.document_id]
                    );
                    const markerChunk = allChunks.rows.find(c => c.content.includes(HTML_MARKER));
                    if (markerChunk) {
                        const markerIdx = markerChunk.content.indexOf(HTML_MARKER);
                        if (markerChunk.chunk_index === 0) {
                            content = markerChunk.content.slice(0, markerIdx).trim();
                        }
                        // Collect HTML: from marker in marker-chunk, then subsequent chunks
                        // Skip 200-char overlap at start of each subsequent chunk (DEFAULT_OVERLAP * 4)
                        const CHUNK_OVERLAP = 200;
                        const parts = [markerChunk.content.slice(markerIdx + HTML_MARKER.length)];
                        for (const c of allChunks.rows) {
                            if (c.chunk_index > markerChunk.chunk_index) {
                                parts.push(c.content.slice(CHUNK_OVERLAP));
                            }
                        }
                        htmlSource = parts.join('').trim();
                    }
                }
            }
        }

        results.push({
            content,
            score: Math.round(match.score * 1000) / 1000,
            metadata: { ...match.metadata, namespace: match._namespace },
            documentTitle,
            mediaType,
            filePath,
            htmlSource,
        });
    }

    return results;
}

// ─── RAG Context Builder ────────────────────────────────────────────────────

/**
 * Build a RAG context block to inject into Claude's system prompt.
 *
 * @param {import('pg').Pool} pool
 * @param {string} query - The user's message
 * @param {{ namespaces?: string[], maxTokens?: number, filter?: object, visualQuery?: boolean }} options
 * @returns {Promise<{ context: string, sources: object[] }>}
 */
export async function buildRAGContext(pool, query, options = {}) {
    const {
        namespaces = ['campaigns', 'emails', 'kpis', 'research'],
        maxTokens = DEFAULT_MAX_TOKENS,
        filter,
        visualQuery = false,
        mode = 'text',     // 'text' | 'voice'
        maxMedia = 4,
        maxResults,        // hard cap on number of results included in context
        minScore: minScoreOverride,
        topKOverride,      // explicit topK override (e.g. for block queries needing wide coverage)
    } = options;

    // When user asks for visual content, cast a wider net and lower threshold
    const topK = topKOverride || (visualQuery ? 20 : 12);
    const minScore = minScoreOverride !== undefined ? minScoreOverride : (visualQuery ? 0.3 : 0.45);

    let results = await searchMultiNamespace(pool, query, namespaces, { topK, filter, minScore });

    // Demo-critical: when user asks for a non-email visual (whatsapp, screenshot, foto),
    // ensure the top image-namespace match is always included, even if cosine score is lower
    // than email results that ranked higher.
    const nonEmailVisualMention = /\b(whatsapp|wa|sms|screenshot|captura|foto|photo|banner|picture)\b/i.test(query);
    if (nonEmailVisualMention && namespaces.includes('images')) {
        const hasImageResult = results.some(r => r._namespace === 'images' && r.mediaType === 'image');
        if (!hasImageResult) {
            // Force-fetch the top image-namespace match
            const imageOnly = await searchMultiNamespace(pool, query, ['images'], { topK: 3, filter, minScore: 0.3 });
            const topImage = imageOnly.find(r => r.mediaType === 'image');
            if (topImage) {
                results = [topImage, ...results];
                console.log(`[RAG] Force-included image result: ${topImage.documentTitle} (score: ${topImage.score})`);
            }
        }
    }

    // Adaptive threshold: if top result is very strong, filter out comparatively weak results
    if (results.length > 1 && results[0].score > 0.8) {
        const adaptiveMin = results[0].score * 0.5;
        results = results.filter(r => r.score >= adaptiveMin);
    }

    // Boost visual results to top when user asks for visuals (images > pdf_page > text)
    // When query explicitly mentions a non-email visual channel (whatsapp, screenshot, etc.),
    // push html_email DOWN so uploaded screenshots win over email templates.
    const nonEmailVisualQuery = /\b(whatsapp|wa|sms|screenshot|captura|foto|photo|banner|picture)\b/i.test(query);
    if (visualQuery && results.length > 0) {
        results.sort((a, b) => {
            const rank = (r) => {
                if (r.mediaType === 'image') return 3;
                if (nonEmailVisualQuery && r.mediaType === 'html_email') return 0; // demote emails
                if (r.mediaType === 'pdf_page' || r.mediaType === 'html_email') return 1;
                return 0;
            };
            const ra = rank(a);
            const rb = rank(b);
            if (rb !== ra) return rb - ra;
            return b.score - a.score;
        });
    }

    if (results.length === 0) {
        return { context: '', sources: [], mediaResults: [] };
    }

    // Hard cap on results when caller wants a single item (e.g. block queries)
    if (maxResults && results.length > maxResults) {
        results = results.slice(0, maxResults);
    }

    // Build context block with token budget
    const maxChars = maxTokens * 4;
    let context = '[RELEVANT KNOWLEDGE - Internal Database]\n';
    let currentChars = context.length;
    const usedSources = [];
    const mediaResults = [];

    const MEDIA_SCORE_THRESHOLD = 0.5;

    for (const result of results) {
        const sourceNum = usedSources.length + 1;
        let block;
        if (result.mediaType === 'image') {
            const hasDesc = result.content && !result.content.startsWith('[Image:');
            block = `---\n[${sourceNum}] Source: ${result.documentTitle} (score: ${result.score})\n${hasDesc ? result.content + '\n' : ''}${result.filePath ? `[IMAGE: /api/kb-files/${result.filePath}]` : ''}\n`;
            // Attach image if: visualQuery OR high score (images show on screen even in voice mode)
            const shouldAttach = result.filePath && mediaResults.length < maxMedia && (
                visualQuery || result.score >= MEDIA_SCORE_THRESHOLD
            );
            if (shouldAttach) mediaResults.push({ filePath: result.filePath, mediaType: 'image', score: result.score, title: result.documentTitle });
        } else if (result.mediaType === 'pdf_page') {
            const hasText = result.content && !result.content.startsWith('[PDF:');
            const pageNum = result.metadata?.page_number || '?';
            block = `---\n[${sourceNum}] Source: ${result.documentTitle} - Page ${pageNum} (score: ${result.score})\n`;
            if (hasText) block += result.content + '\n';
            // Voice mode: NEVER attach PDF pages. Text mode: only if visualQuery or very high score
            // Reserve 1 slot for images — PDFs can only fill up to (maxMedia - 1) unless no images exist
            const pdfCount = mediaResults.filter(m => m.mediaType === 'pdf_page').length;
            const hasImageInResults = results.some(r => r.mediaType === 'image' && r.filePath);
            const pdfLimit = hasImageInResults ? maxMedia - 1 : maxMedia;
            const shouldAttach = result.filePath && mode !== 'voice' && pdfCount < pdfLimit && mediaResults.length < maxMedia && (
                visualQuery || result.score >= MEDIA_SCORE_THRESHOLD
            );
            if (shouldAttach) {
                block += `[VISUAL PAGE: /api/kb-files/${result.filePath}]\n`;
                mediaResults.push({ filePath: result.filePath, mediaType: 'pdf_page', score: result.score, title: result.documentTitle, pageNumber: pageNum });
            }
        } else {
            block = `---\n[${sourceNum}] Source: ${result.documentTitle} (score: ${result.score})\n${result.content}\n`;
            if (result.htmlSource) {
                // html_email: allow up to maxMedia+2 slots so emails aren't crowded out by other media types
                const htmlEmailCount = mediaResults.filter(m => m.mediaType === 'email_html').length;
                const shouldAttachMedia = mode !== 'voice' && htmlEmailCount < Math.min(2, maxMedia + 2);
                if (shouldAttachMedia) {
                    block += `[ATTACHED EMAIL VISUALLY SHOWN TO USER ON SCREEN: "${result.documentTitle}" — The full HTML is rendered as an iframe in the chat UI. Analyze and discuss this email content directly. Do NOT say it was "added to canvas" or describe a canvas — this is the competitive intelligence chat, not the email builder.]\n`;
                    mediaResults.push({ mediaType: 'email_html', htmlSource: result.htmlSource, title: result.documentTitle, score: result.score, category: result.metadata?.category || '', position: result.metadata?.position || '' });
                }
            }
        }
        if (currentChars + block.length > maxChars) break;
        context += block;
        currentChars += block.length;
        usedSources.push({
            sourceIndex: sourceNum,
            title: result.documentTitle,
            score: result.score,
            namespace: result.metadata?.namespace || '',
            content_type: result.metadata?.content_type || '',
            category: result.metadata?.category || '',
            position: result.metadata?.position || '',
            mediaType: result.mediaType,
            filePath: result.filePath,
            htmlSource: result.htmlSource || null,
        });
    }

    context += '---\n[END RELEVANT KNOWLEDGE]\n';

    return { context, sources: usedSources, mediaResults };
}

// ─── Specialized Search Functions ───────────────────────────────────────────

/**
 * Search images by description.
 */
export async function searchImages(pool, description, { topK = 5 } = {}) {
    return searchKnowledge(pool, description, { namespace: 'images', topK, minScore: 0.6 });
}

/**
 * Search emails with optional campaign/market/language/tier filters.
 */
export async function searchEmails(pool, query, { campaignId, market, language, tier, topK = 5 } = {}) {
    const filter = {};
    if (campaignId) filter.campaign_id = { $eq: campaignId };
    if (market) filter.market = { $eq: market };
    if (language) filter.language = { $eq: language };
    if (tier) filter.tier = { $eq: tier };

    return searchKnowledge(pool, query, {
        namespace: 'emails',
        topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        minScore: 0.6,
    });
}

/**
 * Check if the knowledge base is ready (both providers initialized).
 */
export function isKBReady() {
    return isGeminiReady() && isPineconeReady();
}
