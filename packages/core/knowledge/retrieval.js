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
 * @param {{ namespaces?: string[], maxTokens?: number, filter?: object }} options
 * @returns {Promise<{ context: string, sources: object[] }>}
 */
export async function buildRAGContext(pool, query, options = {}) {
    const {
        namespaces = ['campaigns', 'emails', 'kpis', 'research'],
        maxTokens = DEFAULT_MAX_TOKENS,
        filter,
    } = options;

    const results = await searchMultiNamespace(pool, query, namespaces, { topK: 12, filter, minScore: 0.3 });

    if (results.length === 0) {
        return { context: '', sources: [], mediaResults: [] };
    }

    // Build context block with token budget
    const maxChars = maxTokens * 4;
    let context = '[CONOCIMIENTO RELEVANTE - Base de Datos Interna]\n';
    let currentChars = context.length;
    const usedSources = [];
    const mediaResults = [];

    for (const result of results) {
        let block;
        if (result.mediaType === 'image') {
            // Use description if available, include image link for display
            const hasDesc = result.content && !result.content.startsWith('[Image:');
            block = `---\nFuente: ${result.documentTitle} (score: ${result.score})\n${hasDesc ? result.content + '\n' : ''}${result.filePath ? `[IMAGEN: /api/kb-files/${result.filePath}]` : ''}\n`;
            if (result.filePath) mediaResults.push({ filePath: result.filePath, mediaType: 'image', score: result.score, title: result.documentTitle });
        } else if (result.mediaType === 'pdf_page') {
            // Use extracted text if available, fall back to PDF link
            const hasText = result.content && !result.content.startsWith('[PDF:');
            block = `---\nFuente: ${result.documentTitle} (score: ${result.score})\n${hasText ? result.content : `[PDF: /api/kb-files/${result.filePath}]`}\n`;
            if (result.filePath) mediaResults.push({ filePath: result.filePath, mediaType: 'pdf_page', score: result.score, title: result.documentTitle });
        } else {
            block = `---\nFuente: ${result.documentTitle} (score: ${result.score})\n${result.content}\n`;
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

    context += '---\n[FIN CONOCIMIENTO RELEVANTE]\n';

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
