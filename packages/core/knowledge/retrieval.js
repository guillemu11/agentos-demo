/**
 * Knowledge Base — Retrieval & RAG Context Builder
 *
 * Embeds queries via Gemini, searches Pinecone, builds context for Claude.
 */

import { embedText, isGeminiReady } from '../ai-providers/gemini.js';
import { queryVectors, isPineconeReady } from '../ai-providers/pinecone.js';

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_MAX_TOKENS = 2000;

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
    const filtered = matches.filter(m => m.score >= minScore);

    // 4. Enrich with chunk content from DB
    const results = [];
    for (const match of filtered) {
        let content = match.metadata?.content_preview || '';
        let documentTitle = match.metadata?.title || 'Unknown';

        // Try to get full chunk content from DB (including multimodal fields)
        let mediaType = match.metadata?.media_type || 'text';
        let filePath = match.metadata?.file_path || null;
        let chunkMetadata = null;

        if (match.id) {
            const chunkRow = await pool.query(
                `SELECT kc.content, kd.title, kc.media_type, kc.file_path, kc.metadata as chunk_metadata
                 FROM knowledge_chunks kc
                 JOIN knowledge_documents kd ON kd.id = kc.document_id
                 WHERE kc.pinecone_id = $1`,
                [match.id]
            );
            if (chunkRow.rows.length > 0) {
                content = chunkRow.rows[0].content;
                documentTitle = chunkRow.rows[0].title;
                mediaType = chunkRow.rows[0].media_type || mediaType;
                filePath = chunkRow.rows[0].file_path || filePath;
                chunkMetadata = chunkRow.rows[0].chunk_metadata || null;
            }
        }

        results.push({
            content,
            score: Math.round(match.score * 1000) / 1000,
            metadata: match.metadata,
            documentTitle,
            mediaType,
            filePath,
            htmlSource: chunkMetadata?.html_source || null,
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

    // Sort by score descending, deduplicate by document_id
    allMatches.sort((a, b) => b.score - a.score);

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

    // Ensure namespace diversity: take top-2 per namespace, then fill remaining slots by score
    const maxPerNamespace = 2;
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

        if (match.id) {
            const chunkRow = await pool.query(
                `SELECT kc.content, kd.title, kc.media_type, kc.file_path FROM knowledge_chunks kc
                 JOIN knowledge_documents kd ON kd.id = kc.document_id
                 WHERE kc.pinecone_id = $1`,
                [match.id]
            );
            if (chunkRow.rows.length > 0) {
                content = chunkRow.rows[0].content;
                documentTitle = chunkRow.rows[0].title;
                mediaType = chunkRow.rows[0].media_type || mediaType;
                filePath = chunkRow.rows[0].file_path || filePath;
            }
        }

        results.push({
            content,
            score: Math.round(match.score * 1000) / 1000,
            metadata: { ...match.metadata, namespace: match._namespace },
            documentTitle,
            mediaType,
            filePath,
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
    } = options;

    // When user asks for visual content, cast a wider net and lower threshold
    const topK = visualQuery ? 20 : 12;
    const minScore = visualQuery ? 0.2 : 0.3;

    let results = await searchMultiNamespace(pool, query, namespaces, { topK, filter, minScore });

    // Boost visual results (pdf_page, image) to top when user asks for diagrams/visuals
    if (visualQuery && results.length > 0) {
        results.sort((a, b) => {
            const aVisual = (a.mediaType === 'pdf_page' || a.mediaType === 'image') ? 1 : 0;
            const bVisual = (b.mediaType === 'pdf_page' || b.mediaType === 'image') ? 1 : 0;
            if (bVisual !== aVisual) return bVisual - aVisual;
            return b.score - a.score;
        });
    }

    if (results.length === 0) {
        return { context: '', sources: [], mediaResults: [] };
    }

    // Build context block with token budget
    const maxChars = maxTokens * 4;
    let context = '[RELEVANT KNOWLEDGE - Internal Database]\n';
    let currentChars = context.length;
    const usedSources = [];
    const mediaResults = [];

    const MEDIA_SCORE_THRESHOLD = 0.7;

    for (const result of results) {
        let block;
        if (result.mediaType === 'image') {
            const hasDesc = result.content && !result.content.startsWith('[Image:');
            block = `---\nSource: ${result.documentTitle} (score: ${result.score})\n${hasDesc ? result.content + '\n' : ''}${result.filePath ? `[IMAGE: /api/kb-files/${result.filePath}]` : ''}\n`;
            // Only attach image if: visualQuery OR (text mode + high score)
            const shouldAttach = result.filePath && mediaResults.length < maxMedia && (
                visualQuery || (mode !== 'voice' && result.score >= MEDIA_SCORE_THRESHOLD)
            );
            if (shouldAttach) mediaResults.push({ filePath: result.filePath, mediaType: 'image', score: result.score, title: result.documentTitle });
        } else if (result.mediaType === 'pdf_page') {
            const hasText = result.content && !result.content.startsWith('[PDF:');
            const pageNum = result.metadata?.page_number || '?';
            block = `---\nSource: ${result.documentTitle} - Page ${pageNum} (score: ${result.score})\n`;
            if (hasText) block += result.content + '\n';
            // Voice mode: NEVER attach PDF pages. Text mode: only if visualQuery or very high score
            const shouldAttach = result.filePath && mode !== 'voice' && mediaResults.length < maxMedia && (
                visualQuery || result.score >= MEDIA_SCORE_THRESHOLD
            );
            if (shouldAttach) {
                block += `[VISUAL PAGE: /api/kb-files/${result.filePath}]\n`;
                mediaResults.push({ filePath: result.filePath, mediaType: 'pdf_page', score: result.score, title: result.documentTitle, pageNumber: pageNum });
            }
        } else {
            block = `---\nSource: ${result.documentTitle} (score: ${result.score})\n${result.content}\n`;
        }
        if (currentChars + block.length > maxChars) break;
        context += block;
        currentChars += block.length;
        usedSources.push({
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
