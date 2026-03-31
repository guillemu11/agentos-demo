/**
 * Gemini AI Provider — Embeddings (Multimodal) + Voice
 *
 * Uses @google/genai for multimodal embeddings (text, images, PDFs)
 * via gemini-embedding-2-preview and Multimodal Live API for real-time voice.
 */

import { GoogleGenAI } from '@google/genai';

let _client = null;

const EMBEDDING_MODEL = 'gemini-embedding-2-preview';
const EMBEDDING_DIMENSIONS = 3072;
const MAX_CONCURRENT = 10;

/**
 * Initialize the Gemini client.
 * @param {string} apiKey - Google AI API key
 * @returns {GoogleGenAI}
 */
export function initGemini(apiKey) {
    if (!apiKey) throw new Error('Gemini API key is required');
    _client = new GoogleGenAI({ apiKey });
    return _client;
}

/**
 * Get the initialized client (or null).
 */
export function getGeminiClient() {
    return _client;
}

/**
 * Embed a single text string.
 * @param {string} text
 * @param {string} [taskType='RETRIEVAL_QUERY']
 * @returns {Promise<number[]>} - Embedding vector (768-dim)
 */
export async function embedText(text, taskType = 'RETRIEVAL_QUERY') {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    });
    return result.embeddings[0].values;
}

/**
 * Embed a batch of texts with controlled concurrency.
 * @param {string[]} texts
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function embedBatch(texts) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    if (texts.length === 0) return [];

    const results = new Array(texts.length);

    for (let i = 0; i < texts.length; i += MAX_CONCURRENT) {
        const batch = texts.slice(i, i + MAX_CONCURRENT);
        const promises = batch.map((text, j) =>
            _client.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: text,
                config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
            }).then(r => { results[i + j] = r.embeddings[0].values; })
        );
        await Promise.all(promises);
    }

    return results;
}

/**
 * Embed a single image natively.
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType - e.g. 'image/png', 'image/jpeg'
 * @returns {Promise<number[]>} - Embedding vector (768-dim)
 */
export async function embedImage(base64Data, mimeType) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ inlineData: { mimeType, data: base64Data } }],
        config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
    });
    return result.embeddings[0].values;
}

/**
 * Embed a PDF natively (max 6 pages).
 * @param {string} base64Data - Base64-encoded PDF data
 * @returns {Promise<number[]>} - Embedding vector (768-dim)
 */
export async function embedPdf(base64Data) {
    if (!_client) throw new Error('Gemini not initialized. Call initGemini() first.');
    const result = await _client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: [{ inlineData: { mimeType: 'application/pdf', data: base64Data } }],
        config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
    });
    return result.embeddings[0].values;
}

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
                { text: 'Extract ALL text from this document page. Preserve the original structure including headings, lists, tables, and paragraphs. If the page contains diagrams, flowcharts, screenshots, or other visual elements, describe them in detail (what they show, the flow, connections, labels). Return the extracted text and visual descriptions together.' },
            ],
        }],
    });
    return result.text || '';
}

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

/**
 * Check if Gemini is initialized and ready.
 */
export function isGeminiReady() {
    return _client !== null;
}
