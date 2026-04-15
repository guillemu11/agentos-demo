/**
 * One-off file ingestion into the Knowledge Base (PDF, PNG/JPG, HTML, DOC, EML).
 *
 * Usage:
 *   node scripts/ingest-file.js <path> --title "..." --namespace images \
 *     [--brand emirates] [--campaign miles-expiry] [--channel email] \
 *     [--segment segment1] [--language en] [--meta key=value ...]
 *
 * Brand/campaign/channel/segment/language are first-class because they are
 * the fields most worth filtering on in Pinecone (avoid cross-brand bleed).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { initGemini } from '../packages/core/ai-providers/gemini.js';
import { initPinecone } from '../packages/core/ai-providers/pinecone.js';
import { ingestFile } from '../packages/core/knowledge/ingestion.js';

// ─── Arg parsing ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
        const key = a.slice(2);
        const val = argv[i + 1];
        if (val === undefined || val.startsWith('--')) {
            flags[key] = true;
        } else {
            // --meta accepts repeated key=value pairs
            if (key === 'meta') {
                flags.meta = flags.meta || [];
                flags.meta.push(val);
            } else {
                flags[key] = val;
            }
            i++;
        }
    } else {
        positional.push(a);
    }
}

const srcPath = positional[0];
const title = flags.title;
const namespace = flags.namespace;

if (!srcPath || !title || !namespace) {
    console.error('Usage: node scripts/ingest-file.js <path> --title "..." --namespace <ns>');
    console.error('  [--brand <name>] [--campaign <slug>] [--channel <email|whatsapp|sms|brief>]');
    console.error('  [--segment <slug>] [--language <iso>] [--meta key=value ...]');
    process.exit(1);
}
if (!fs.existsSync(srcPath)) {
    console.error('File not found:', srcPath);
    process.exit(1);
}

// ─── Build metadata ─────────────────────────────────────────────────────────
const metadata = { ingested_via: 'scripts/ingest-file.js' };
for (const k of ['brand', 'campaign', 'channel', 'segment', 'language']) {
    if (flags[k]) metadata[k] = flags[k];
}
for (const pair of (flags.meta || [])) {
    const [k, ...rest] = pair.split('=');
    metadata[k] = rest.join('=');
}

// Warn loudly if no brand was supplied — that's the #1 footgun
if (!metadata.brand) {
    console.warn('⚠️  No --brand supplied. Future queries may bleed across brands. Continuing in 2s...');
    await new Promise(r => setTimeout(r, 2000));
}

// ─── Init providers ─────────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) throw new Error('PINECONE_API_KEY / PINECONE_INDEX missing');
initGemini(process.env.GEMINI_API_KEY);
initPinecone(process.env.PINECONE_API_KEY, process.env.PINECONE_INDEX);

const pool = process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
    : new pg.Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5434', 10),
        database: process.env.PG_DB || 'agentos',
        user: process.env.PG_USER || 'agentos',
        password: process.env.PG_PASSWORD || 'changeme',
    });

// ingestFile UNLINKS the source file after copying — copy to a throwaway tmp first.
const tmpDir = path.join(process.cwd(), 'assets/kb/tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const tmpPath = path.join(tmpDir, `ingest-${Date.now()}-${path.basename(srcPath)}`);
fs.copyFileSync(srcPath, tmpPath);

try {
    const result = await ingestFile(pool, {
        filePath: tmpPath,
        originalFilename: path.basename(srcPath),
        title,
        namespace,
        sourceType: 'upload',
        metadata,
    });
    console.log('OK', JSON.stringify({ ...result, title, namespace, metadata }, null, 2));
} catch (err) {
    console.error('FAIL', err.message);
    console.error(err.stack);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    process.exit(1);
} finally {
    await pool.end();
}
