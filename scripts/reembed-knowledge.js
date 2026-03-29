/**
 * Re-embed all existing text knowledge chunks with the new Gemini Embedding 2 model.
 *
 * Required because gemini-embedding-001 and gemini-embedding-2-preview produce
 * incompatible embedding spaces — vectors from different models cannot coexist.
 *
 * Usage:
 *   node scripts/reembed-knowledge.js            # run for real
 *   node scripts/reembed-knowledge.js --dry-run   # preview without changes
 */

import 'dotenv/config';
import pg from 'pg';
import { initGemini, embedText, isGeminiReady } from '../packages/core/ai-providers/gemini.js';
import { initPinecone, upsertVectors, isPineconeReady } from '../packages/core/ai-providers/pinecone.js';

const { Pool } = pg;
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const DELAY_MS = 500;

async function main() {
    console.log(`\n=== Knowledge Base Re-Embedding Script ===`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

    // Initialize providers
    if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) { console.error('PINECONE_API_KEY / PINECONE_INDEX not set'); process.exit(1); }

    initGemini(process.env.GEMINI_API_KEY);
    initPinecone(process.env.PINECONE_API_KEY, process.env.PINECONE_INDEX);

    if (!isGeminiReady() || !isPineconeReady()) {
        console.error('Failed to initialize providers');
        process.exit(1);
    }

    const pool = process.env.DATABASE_URL
        ? new Pool({ connectionString: process.env.DATABASE_URL })
        : new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5434', 10),
            database: process.env.PG_DB || 'agentos',
            user: process.env.PG_USER || 'agentos',
            password: process.env.PG_PASSWORD || 'changeme',
        });

    try {
        // Get all text chunks that need re-embedding
        const result = await pool.query(
            `SELECT kc.id, kc.content, kc.pinecone_id, kc.document_id, kc.chunk_index,
                    kd.namespace, kd.source_type, kd.title, kd.metadata
             FROM knowledge_chunks kc
             JOIN knowledge_documents kd ON kd.id = kc.document_id
             WHERE (kc.media_type IS NULL OR kc.media_type = 'text')
             AND kc.pinecone_id IS NOT NULL
             ORDER BY kc.id`
        );

        const chunks = result.rows;
        console.log(`Found ${chunks.length} text chunks to re-embed\n`);

        if (DRY_RUN) {
            console.log('Dry run complete. No changes made.');
            await pool.end();
            return;
        }

        if (chunks.length === 0) {
            console.log('Nothing to re-embed.');
            await pool.end();
            return;
        }

        let processed = 0;
        let errors = 0;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);

            const promises = batch.map(async (chunk) => {
                try {
                    const embedding = await embedText(chunk.content, 'RETRIEVAL_DOCUMENT');
                    const meta = typeof chunk.metadata === 'string' ? JSON.parse(chunk.metadata) : (chunk.metadata || {});

                    await upsertVectors(chunk.namespace, [{
                        id: chunk.pinecone_id,
                        values: embedding,
                        metadata: {
                            ...meta,
                            document_id: chunk.document_id,
                            chunk_index: chunk.chunk_index,
                            namespace: chunk.namespace,
                            source_type: chunk.source_type,
                            title: chunk.title,
                            media_type: 'text',
                            content_preview: chunk.content.slice(0, 200),
                        },
                    }]);
                    processed++;
                } catch (err) {
                    errors++;
                    console.error(`  Error chunk ${chunk.id} (${chunk.pinecone_id}): ${err.message}`);
                }
            });

            await Promise.all(promises);
            console.log(`  Re-embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks (${errors} errors)`);

            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(r => setTimeout(r, DELAY_MS));
            }
        }

        // Update embedding_model on all re-embedded documents
        const docIds = [...new Set(chunks.map(c => c.document_id))];
        for (const docId of docIds) {
            await pool.query(
                `UPDATE knowledge_documents SET embedding_model = 'gemini-embedding-2-preview' WHERE id = $1`,
                [docId]
            );
        }

        console.log(`\n=== Done ===`);
        console.log(`Processed: ${processed}/${chunks.length}`);
        console.log(`Errors: ${errors}`);
        console.log(`Documents updated: ${docIds.length}`);

        await pool.end();
    } catch (err) {
        console.error('Fatal error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

main();
