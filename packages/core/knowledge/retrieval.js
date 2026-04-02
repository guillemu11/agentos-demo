/**
 * Knowledge Base — Retrieval & RAG Context Builder
 *
 * Embeds queries via Gemini, searches Pinecone, builds context for Claude.
 */

import { embedText, isGeminiReady } from '../ai-providers/gemini.js';
import { queryVectors, isPineconeReady, rerankResults } from '../ai-providers/pinecone.js';

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

                // If not in metadata, try to reconstruct from content across all chunks
                if (!htmlSource) {
                    const HTML_MARKER = '\n\n--- HTML SOURCE ---\n';
                    // Find which chunk has the marker (chunk 0 for email-blocks)
                    let chunk0Content = row.chunk_index === 0 ? row.content : null;
                    if (!chunk0Content) {
                        const c0 = await pool.query(
                            `SELECT content FROM knowledge_chunks WHERE document_id = $1 AND chunk_index = 0`,
                            [row.document_id]
                        );
                        if (c0.rows.length > 0) chunk0Content = c0.rows[0].content;
                    }
                    if (chunk0Content && chunk0Content.includes(HTML_MARKER)) {
                        // Fetch all chunks to reconstruct full HTML
                        const allChunks = await pool.query(
                            `SELECT chunk_index, content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index`,
                            [row.document_id]
                        );
                        const markerIdx = chunk0Content.indexOf(HTML_MARKER);
                        // Description is everything before the marker in chunk 0
                        content = chunk0Content.slice(0, markerIdx).trim();
                        // HTML starts after the marker in chunk 0, continues in subsequent chunks
                        const parts = [chunk0Content.slice(markerIdx + HTML_MARKER.length)];
                        for (const c of allChunks.rows) {
                            if (c.chunk_index > 0) parts.push(c.content);
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

                // Reconstruct full HTML from all chunks when stored in content
                if (!htmlSource) {
                    const HTML_MARKER = '\n\n--- HTML SOURCE ---\n';
                    let chunk0Content = row.chunk_index === 0 ? row.content : null;
                    if (!chunk0Content) {
                        const c0 = await pool.query(
                            `SELECT content FROM knowledge_chunks WHERE document_id = $1 AND chunk_index = 0`,
                            [row.document_id]
                        );
                        if (c0.rows.length > 0) chunk0Content = c0.rows[0].content;
                    }
                    if (chunk0Content && chunk0Content.includes(HTML_MARKER)) {
                        const allChunks = await pool.query(
                            `SELECT chunk_index, content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index`,
                            [row.document_id]
                        );
                        const markerIdx = chunk0Content.indexOf(HTML_MARKER);
                        content = chunk0Content.slice(0, markerIdx).trim();
                        const parts = [chunk0Content.slice(markerIdx + HTML_MARKER.length)];
                        for (const c of allChunks.rows) {
                            if (c.chunk_index > 0) parts.push(c.content);
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
    } = options;

    // When user asks for visual content, cast a wider net and lower threshold
    const topK = visualQuery ? 20 : 12;
    const minScore = minScoreOverride !== undefined ? minScoreOverride : (visualQuery ? 0.3 : 0.45);

    let results = await searchMultiNamespace(pool, query, namespaces, { topK, filter, minScore });

    // Adaptive threshold: if top result is very strong, filter out comparatively weak results
    if (results.length > 1 && results[0].score > 0.8) {
        const adaptiveMin = results[0].score * 0.5;
        results = results.filter(r => r.score >= adaptiveMin);
    }

    // Boost visual results to top when user asks for visuals (images > pdf_page > text)
    if (visualQuery && results.length > 0) {
        results.sort((a, b) => {
            const aVisual = a.mediaType === 'image' ? 2 : (a.mediaType === 'pdf_page' || a.mediaType === 'html_email' ? 1 : 0);
            const bVisual = b.mediaType === 'image' ? 2 : (b.mediaType === 'pdf_page' || b.mediaType === 'html_email' ? 1 : 0);
            if (bVisual !== aVisual) return bVisual - aVisual;
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
                const shouldAttachMedia = mediaResults.length < maxMedia && (
                    visualQuery || (mode !== 'voice' && result.score >= MEDIA_SCORE_THRESHOLD)
                );
                if (shouldAttachMedia) {
                    block += `[SYSTEM INSTRUCTION: The full HTML of this email/block is being rendered as an iframe directly in the user's chat UI. Respond with ONLY a short acknowledgment like "Here is [title]:" — do NOT describe, analyze, or list the content. The user can already see it.]\n`;
                    mediaResults.push({ mediaType: 'email_html', htmlSource: result.htmlSource, title: result.documentTitle, score: result.score });
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
