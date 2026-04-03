/**
 * scripts/ingest-blocks.mjs
 * One-time script to ingest all Emirates email blocks into Pinecone.
 * Loads API keys from DB (same as server.js) with .env fallback.
 * Run from project root: node scripts/ingest-blocks.mjs
 */

import 'dotenv/config';
import crypto from 'crypto';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { initGemini } from '../packages/core/ai-providers/gemini.js';
import { initPinecone } from '../packages/core/ai-providers/pinecone.js';
import { ingestEmailBlocks } from '../packages/core/knowledge/ingest-email-blocks.js';

const { Pool } = pg;

// Init DB
const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5434'),
        database: process.env.PG_DB || 'agentos',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
    });

// Load API keys from DB (same encryption logic as server.js)
function decryptValue(encrypted) {
    const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'agentos-dev-secret-change-me';
    const key = crypto.createHash('sha256').update(secret).digest();
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}

async function loadApiKeysFromDb() {
    try {
        const res = await pool.query("SELECT value FROM workspace_config WHERE key = 'api_keys'");
        if (!res.rows.length) return {};
        const raw = res.rows[0].value;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const keys = {};
        for (const [k, v] of Object.entries(parsed)) {
            try { keys[k] = decryptValue(v); } catch { keys[k] = v; }
        }
        return keys;
    } catch { return {}; }
}

const dbKeys = await loadApiKeysFromDb();

const anthropicKey = dbKeys.anthropic    || process.env.ANTHROPIC_API_KEY;
const geminiKey    = dbKeys.gemini       || process.env.GEMINI_API_KEY;
const pineconeKey  = dbKeys.pinecone_api_key || process.env.PINECONE_API_KEY;
const pineconeIdx  = dbKeys.pinecone_index   || process.env.PINECONE_INDEX;

// Init Gemini
initGemini(geminiKey);
console.log('[init] Gemini ready');

// Init Pinecone
initPinecone(pineconeKey, pineconeIdx);
console.log('[init] Pinecone ready (index:', pineconeIdx + ')');

// Init Anthropic (optional — falls back to Gemini if key missing/invalid)
let anthropic = null;
if (anthropicKey) {
    try {
        const client = new Anthropic({ apiKey: anthropicKey });
        // Quick validation: try a tiny request
        await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] });
        anthropic = client;
        console.log('[init] Anthropic ready');
    } catch {
        console.log('[init] Anthropic key invalid — using Gemini for block analysis');
    }
} else {
    console.log('[init] No Anthropic key — using Gemini for block analysis');
}
console.log();

// Run ingestion
console.log('Starting ingestion of Emirates email blocks...\n');
try {
    const result = await ingestEmailBlocks(pool, anthropic);
    console.log('\n✓ Ingestion complete:', JSON.stringify({ ingested: result.ingested, skipped: result.skipped, errors: result.errors.length }));
    if (result.errors.length) {
        console.error('Errors:', result.errors.slice(0, 3));
    }
} catch (err) {
    console.error('\n✗ Ingestion failed:', err.message);
    process.exit(1);
} finally {
    await pool.end();
}
