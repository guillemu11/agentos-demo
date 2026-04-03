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
import { ingestDocument } from './ingestion.js';
import { deleteNamespace } from '../ai-providers/pinecone.js';
import { getGeminiClient } from '../ai-providers/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = path.resolve(__dirname, '../../../email_blocks');

const HAIKU_ANALYSIS_PROMPT = `Analyze this Emirates Airlines email HTML block and return ONLY a valid JSON object with these fields:

{
  "title": "Human-readable title in English (e.g. 'Red CTA — Emirates Action Button')",
  "description": "3-5 sentence semantic description in English: what the block shows visually, when to use it, typical position in email, design tokens used, SFMC variable placeholders present",
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
 * Analyze an HTML block using Anthropic (Haiku) if available, else Gemini.
 * @param {object|null} anthropic - Initialized Anthropic client (optional)
 * @param {string} filename
 * @param {string} htmlContent
 * @returns {object} metadata JSON
 */
async function analyzeBlock(anthropic, filename, htmlContent) {
    const MAX_HTML_CHARS = 80000;
    const html = htmlContent.length > MAX_HTML_CHARS
        ? htmlContent.slice(0, MAX_HTML_CHARS)
        : htmlContent;

    let text;

    if (anthropic) {
        // Use Claude Haiku
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [{ role: 'user', content: HAIKU_ANALYSIS_PROMPT + html }],
        });
        text = response.content[0].text.trim();
    } else {
        // Fallback: use Gemini
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: HAIKU_ANALYSIS_PROMPT + html }] }],
        });
        text = response.candidates[0].content.parts[0].text.trim();
    }

    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/```(?:json)?\s*([\s\S]+?)```/);
        if (match) return JSON.parse(match[1].trim());
        throw new Error(`LLM returned non-JSON for ${filename}: ${text.slice(0, 200)}`);
    }
}

/**
 * Ingest all Emirates email blocks from email_blocks/ directory.
 * Clears the namespace first (full reset), then re-ingests every .html file.
 *
 * @param {import('pg').Pool} pool
 * @param {import('@anthropic-ai/sdk').Anthropic} anthropic
 * @returns {{ ingested: number, skipped: number, errors: string[] }}
 * @note `skipped` is always 0 in this implementation — the endpoint performs a full
 *   clear-and-reingest on every call, so there is no idempotency skip logic.
 */
export async function ingestEmailBlocks(pool, anthropic) {
    if (!anthropic) console.log('[email-blocks] No Anthropic client — using Gemini for block analysis.');

    const results = { ingested: 0, skipped: 0, errors: [] };

    // Step 1: Clear existing email-blocks from Pinecone and PostgreSQL
    console.log('[email-blocks] Clearing existing email-blocks namespace...');
    try {
        await deleteNamespace('email-blocks');
    } catch (err) {
        // 404 means namespace doesn't exist yet — safe to continue
        if (!err.message?.includes('404')) throw err;
        console.log('[email-blocks] Namespace did not exist, skipping Pinecone clear.');
    }

    const deleted = await pool.query(
        `DELETE FROM knowledge_documents WHERE source_type = 'email-block' RETURNING id`
    );
    console.log(`[email-blocks] Cleared ${deleted.rows.length} existing documents from PostgreSQL.`);

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
                    // Pinecone requires flat values — serialize objects to JSON strings
                    design_tokens: JSON.stringify(meta.design_tokens || {}),
                    sfmc_variables: meta.sfmc_variables || [],
                    compatible_with: meta.compatible_with || [],
                    description: meta.description,
                    file,
                    brand: 'emirates',
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
