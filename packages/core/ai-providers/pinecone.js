/**
 * Pinecone Vector Store Provider
 *
 * Manages vector operations: upsert, query, delete across namespaces.
 */

import { Pinecone } from '@pinecone-database/pinecone';

let _client = null;
let _index = null;

/**
 * Initialize the Pinecone client and connect to an index.
 * @param {string} apiKey
 * @param {string} indexName
 * @returns {Pinecone}
 */
export function initPinecone(apiKey, indexName) {
    if (!apiKey) throw new Error('Pinecone API key is required');
    if (!indexName) throw new Error('Pinecone index name is required');
    _client = new Pinecone({ apiKey });
    _index = _client.index(indexName);
    return _client;
}

/**
 * Get the initialized client (or null).
 */
export function getPineconeClient() {
    return _client;
}

/**
 * Get a namespaced reference to the index.
 * @param {string} namespace
 */
function ns(namespace) {
    if (!_index) throw new Error('Pinecone not initialized. Call initPinecone() first.');
    return _index.namespace(namespace);
}

/**
 * Upsert vectors into a namespace.
 * @param {string} namespace
 * @param {{ id: string, values: number[], metadata?: object }[]} vectors
 */
export async function upsertVectors(namespace, vectors) {
    if (vectors.length === 0) return;
    const nsIndex = ns(namespace);
    // Pinecone recommends batches of 100
    const BATCH = 100;
    for (let i = 0; i < vectors.length; i += BATCH) {
        await nsIndex.upsert(vectors.slice(i, i + BATCH));
    }
}

/**
 * Query vectors by similarity.
 * @param {string} namespace
 * @param {number[]} embedding - Query vector
 * @param {{ topK?: number, filter?: object, includeMetadata?: boolean }} options
 * @returns {Promise<{ id: string, score: number, metadata: object }[]>}
 */
export async function queryVectors(namespace, embedding, options = {}) {
    const { topK = 5, filter, includeMetadata = true } = options;
    const nsIndex = ns(namespace);
    const result = await nsIndex.query({
        vector: embedding,
        topK,
        filter,
        includeMetadata,
    });
    return (result.matches || []).map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata || {},
    }));
}

/**
 * Delete vectors by IDs from a namespace.
 * @param {string} namespace
 * @param {string[]} ids
 */
export async function deleteVectors(namespace, ids) {
    if (ids.length === 0) return;
    const nsIndex = ns(namespace);
    await nsIndex.deleteMany(ids);
}

/**
 * Delete all vectors in a namespace.
 * @param {string} namespace
 */
export async function deleteNamespace(namespace) {
    const nsIndex = ns(namespace);
    await nsIndex.deleteAll();
}

/**
 * Get index stats (includes namespace list with vector counts).
 * @returns {Promise<object>}
 */
export async function getIndexStats() {
    if (!_index) throw new Error('Pinecone not initialized.');
    return await _index.describeIndexStats();
}

/**
 * Check if Pinecone is initialized and ready.
 */
export function isPineconeReady() {
    return _client !== null && _index !== null;
}
