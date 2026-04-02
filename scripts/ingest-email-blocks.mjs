/**
 * Standalone script to ingest Emirates email blocks into Pinecone.
 * Run: node scripts/ingest-email-blocks.mjs
 */
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import { initGemini } from '../packages/core/ai-providers/gemini.js';
import { initPinecone } from '../packages/core/ai-providers/pinecone.js';
import { ingestEmailBlocks } from '../packages/core/knowledge/ingest-email-blocks.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PINECONE_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'agentos-kb';
const DB_URL = process.env.DATABASE_URL;

if (!GEMINI_KEY || !PINECONE_KEY || !DB_URL) {
  console.error('Missing required env vars: GEMINI_API_KEY, PINECONE_API_KEY, DATABASE_URL');
  process.exit(1);
}

initGemini(GEMINI_KEY);
initPinecone(PINECONE_KEY, PINECONE_INDEX);
console.log('✓ Gemini and Pinecone initialized');

const pool = new pg.Pool({ connectionString: DB_URL });

console.log('Starting email blocks ingestion...');
const result = await ingestEmailBlocks(pool);
console.log('\n✓ Done:', JSON.stringify(result, null, 2));

await pool.end();
