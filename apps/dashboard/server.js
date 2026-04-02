/**
 * AgentOS — Backend Server
 *
 * API for Projects (original) + Workspace (agents, weeklies, dailys, collaboration, audit).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import { chatWithPMAgent, extractJSON, generateSummary, generateDraft, renderDraftSummary, generateProject, generateHandoffSummary, buildAccumulatedContext, buildPipelineSystemPrompt, buildPipelineConversation } from '../../packages/core/pm-agent/core.js';
import { saveProject } from '../../packages/core/db/save_project.js';
import { buildProjectContext } from '../../packages/core/pm-agent/context-builder.js';
import Anthropic from '@anthropic-ai/sdk';
import { initGemini, isGeminiReady, getGeminiClient, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../../packages/core/ai-providers/gemini.js';
import { initPinecone, isPineconeReady, describeIndex } from '../../packages/core/ai-providers/pinecone.js';
import multer from 'multer';
import { generateEodReport } from '../../packages/core/workspace-skills/eod-generator.js';
import { getAgentProfile } from '../../packages/core/agents/profiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;
const PgSession = connectPgSimple(session);
const app = express();
const port = process.env.PORT || process.env.DASHBOARD_PORT || 3001;

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(cors({
    origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173'),
    credentials: true,
}));
app.use(express.json());

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5434', 10),
        database: process.env.PG_DB || 'agentos',
        user: process.env.PG_USER || 'agentos',
        password: process.env.PG_PASSWORD || 'changeme',
    });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Initialize optional AI providers (Gemini + Pinecone) ──────────────────
if (process.env.GEMINI_API_KEY) {
    try {
        initGemini(process.env.GEMINI_API_KEY);
        console.log('[AI] Gemini initialized (embeddings ready)');
    } catch (err) {
        console.warn('[AI] Gemini init failed:', err.message);
    }
}
if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX) {
    try {
        initPinecone(process.env.PINECONE_API_KEY, process.env.PINECONE_INDEX);
        console.log('[AI] Pinecone initialized (index:', process.env.PINECONE_INDEX + ')');
        // Validate index dimensions match embedding model
        describeIndex().then(info => {
            const indexDim = info.dimension;
            if (indexDim !== EMBEDDING_DIMENSIONS) {
                console.error(`[AI] CRITICAL: Pinecone index dimension (${indexDim}) ≠ embedding dimension (${EMBEDDING_DIMENSIONS}). KB uploads will fail!`);
            } else {
                console.log(`[AI] Pinecone dimension check OK (${indexDim})`);
            }
        }).catch(err => console.warn('[AI] Could not verify Pinecone dimensions:', err.message));
    } catch (err) {
        console.warn('[AI] Pinecone init failed:', err.message);
    }
}

// ─── Knowledge Base file upload setup ───────────────────────────────────────

const kbDir = path.join(__dirname, '../../assets/kb');
for (const sub of ['images', 'pdfs', 'tmp']) {
    fs.mkdirSync(path.join(kbDir, sub), { recursive: true });
}

const kbUpload = multer({
    dest: path.join(kbDir, 'tmp'),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
            'text/html', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'message/rfc822',
        ];
        // Some browsers send application/octet-stream for .eml — allow by extension too
        const isEml = (file.originalname || '').toLowerCase().endsWith('.eml');
        cb(null, allowed.includes(file.mimetype) || isEml);
    },
});

// ─── EOD demo data helpers ──────────────────────────────────────────────────

let _lastEodRefreshDate = null;

async function refreshEodDates() {
    try {
        const today = new Date().toISOString().split('T')[0];
        if (_lastEodRefreshDate === today) return;

        const eodCheck = await pool.query("SELECT COUNT(*)::int AS c FROM eod_reports WHERE date = CURRENT_DATE");
        const eodTotal = await pool.query("SELECT COUNT(*)::int AS c FROM eod_reports");
        if (eodTotal.rows[0].c > 0 && eodCheck.rows[0].c === 0) {
            const offsetResult = await pool.query("SELECT (CURRENT_DATE - MAX(date))::int AS days_offset FROM eod_reports");
            const daysOffset = offsetResult.rows[0].days_offset;
            if (daysOffset > 0) {
                await pool.query(`UPDATE eod_reports SET date = date + $1`, [daysOffset]);
                await pool.query(`UPDATE raw_events SET timestamp = timestamp + make_interval(days => $1)`, [daysOffset]);
                console.log(`[DB] EOD report dates refreshed (+${daysOffset} days to current period)`);
            }
        }
        _lastEodRefreshDate = today;
    } catch (err) {
        console.error('[DB] EOD date refresh error:', err.message);
    }
}

async function migrateEodFormat() {
    try {
        const sample = await pool.query(`
            SELECT id FROM eod_reports
            WHERE jsonb_typeof(completed_tasks->0) = 'string'
            LIMIT 1
        `);
        if (sample.rows.length > 0) {
            await pool.query(`
                UPDATE eod_reports SET
                    completed_tasks = (
                        SELECT COALESCE(jsonb_agg(jsonb_build_object('desc', elem, 'duration', null)), '[]'::jsonb)
                        FROM jsonb_array_elements_text(completed_tasks) AS elem
                    ),
                    in_progress_tasks = (
                        SELECT COALESCE(jsonb_agg(jsonb_build_object('desc', elem, 'pct', 50)), '[]'::jsonb)
                        FROM jsonb_array_elements_text(in_progress_tasks) AS elem
                    )
                WHERE jsonb_typeof(completed_tasks->0) = 'string'
                   OR jsonb_typeof(in_progress_tasks->0) = 'string'
            `);
            console.log('[DB] EOD reports migrated from string to object format');
        }
    } catch (err) {
        console.error('[DB] EOD format migration error:', err.message);
    }
}

// ─── Auto-init DB schema in production ───────────────────────────────────────

async function initDatabase() {
    try {
        const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
        const res = await pool.query("SELECT to_regclass('public.agents')");
        const tablesExist = !!res.rows[0].to_regclass;

        if (!tablesExist) {
            console.log('[DB] Tables not found, initializing schema...');
            const schemaPath = path.join(__dirname2, '..', '..', 'packages', 'core', 'db', 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
            console.log('[DB] Schema initialized successfully');
        }

        // Check if seed data is needed (projects table empty OR missing strategy data)
        const projectCount = await pool.query('SELECT COUNT(*)::int AS c FROM projects');
        const strategyCheck = await pool.query("SELECT COUNT(*)::int AS c FROM projects WHERE jsonb_array_length(COALESCE(success_metrics, '[]'::jsonb)) > 0");
        const needsSeed = !tablesExist || projectCount.rows[0].c === 0 || (projectCount.rows[0].c > 0 && strategyCheck.rows[0].c === 0);

        if (needsSeed) {
            console.log('[DB] Demo data missing, loading seed...');
            for (const seedFile of ['seed-emirates.sql', 'seed-emirates-demo.sql']) {
                const seedPath = path.join(__dirname2, '..', '..', 'seeds', seedFile);
                if (fs.existsSync(seedPath)) {
                    try {
                        const seed = fs.readFileSync(seedPath, 'utf8');
                        await pool.query(seed);
                        console.log(`[DB] Seed ${seedFile} loaded successfully`);
                    } catch (seedErr) {
                        console.error(`[DB] Seed ${seedFile} FAILED:`, seedErr.message);
                        console.error('[DB] Seed error detail:', seedErr.detail || seedErr.hint || '');
                    }
                } else {
                    console.log(`[DB] Seed file not found: ${seedPath}`);
                }
            }
        } else {
            console.log(`[DB] Seed not needed, projects count: ${projectCount.rows[0].c}`);
        }

        // Agent settings columns migration
        const agentSettingsCols = [
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality TEXT',
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_name TEXT',
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_rules TEXT',
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS rag_namespaces JSONB',
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_max NUMERIC',
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_period TEXT DEFAULT 'monthly'",
            'ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_spent NUMERIC DEFAULT 0',
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS connections JSONB DEFAULT '[]'",
        ];
        for (const sql of agentSettingsCols) {
            await pool.query(sql);
        }

        // Run initial EOD refresh + migration
        await refreshEodDates();
        await migrateEodFormat();
    } catch (err) {
        console.error('[DB] Init error:', err.message, err.detail || '');
    }
}
initDatabase();

// ─── Session Middleware ──────────────────────────────────────────────────────

const sessionMiddleware = session({
    store: new PgSession({ pool, tableName: 'sessions' }),
    secret: process.env.SESSION_SECRET || 'agentos-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    },
});
app.use(sessionMiddleware);

// ─── Auth: Setup Check ──────────────────────────────────────────────────────

app.get('/auth/setup-status', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM workspace_users');
        res.json({ needsSetup: parseInt(result.rows[0].count) === 0 });
    } catch {
        // Table might not exist yet
        res.json({ needsSetup: true });
    }
});

app.post('/auth/setup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        // Only allow setup if no users exist
        const count = await pool.query('SELECT COUNT(*) FROM workspace_users');
        if (parseInt(count.rows[0].count) > 0) {
            return res.status(403).json({ error: 'Setup already completed' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO workspace_users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
            [email, passwordHash, name || email.split('@')[0], 'owner']
        );

        req.session.userId = result.rows[0].id;
        req.session.userEmail = result.rows[0].email;
        req.session.userRole = result.rows[0].role;

        await logAudit('system', null, 'Workspace setup completed', `Owner account created: ${email}`);
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('[auth/setup] Error:', err);
        res.status(500).json({ error: err.message || String(err) });
    }
});

// ─── Auth: Login / Logout / Me ──────────────────────────────────────────────

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const result = await pool.query('SELECT * FROM workspace_users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userRole = user.role;

        res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

app.get('/auth/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ user: { id: req.session.userId, email: req.session.userEmail, role: req.session.userRole } });
});

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

function requireOwnerOrAdmin(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!['owner', 'admin'].includes(req.session.userRole)) {
        return res.status(403).json({ error: 'Owner or admin required' });
    }
    next();
}

// app.use('/api', requireAuth); // TODO: re-enable auth when ready

// ─── Crypto Helpers (for API key encryption) ────────────────────────────────

function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'agentos-dev-secret-change-me';
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decryptValue(encrypted) {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ─── Helper: Audit Log ──────────────────────────────────────────────────────

async function logAudit(eventType, department, title, details, agentId = null) {
    await pool.query(
        `INSERT INTO audit_log (event_type, department, agent_id, title, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventType, department, agentId, title, details]
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS (original endpoints)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*,
                EXISTS(SELECT 1 FROM project_pipeline pp WHERE pp.project_id = p.id AND pp.status IN ('active', 'paused')) as has_active_pipeline,
                (SELECT json_build_object(
                    'completed', (SELECT count(*) FROM project_agent_sessions pas2 WHERE pas2.pipeline_id = pp2.id AND pas2.status = 'completed'),
                    'total', (SELECT count(*) FROM pipeline_stages ps2 WHERE ps2.pipeline_id = pp2.id)
                ) FROM project_pipeline pp2 WHERE pp2.project_id = p.id AND pp2.status IN ('active', 'paused') LIMIT 1) as pipeline_progress
             FROM projects p
             ORDER BY p.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/campaigns/eligible — campaign projects eligible for workflow linking
app.get('/api/projects/campaigns/eligible', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, description, department, status
             FROM projects
             WHERE type = 'campaign'
               AND status = 'Completed'
               AND LOWER(department) = 'strategic'
             ORDER BY name ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { name, problem, solution, blocks, success_metrics, department, sub_area, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements } = req.body;
        const result = await pool.query(
            `INSERT INTO projects (name, problem, solution, blocks, success_metrics, department, sub_area, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [name || 'Nuevo Proyecto', problem || '', solution || '',
             JSON.stringify(blocks || []), JSON.stringify(success_metrics || []),
             department || 'General', sub_area || 'General',
             JSON.stringify(pain_points || []), JSON.stringify(requirements || []),
             JSON.stringify(risks || []), estimated_budget || 0,
             estimated_timeline || 'TBD', JSON.stringify(future_improvements || []), 'Planning']
        );
        await logAudit('project', department || 'General', `Proyecto creado: ${name}`, 'Nuevo proyecto via dashboard');
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (projectRes.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
        const project = projectRes.rows[0];

        const phasesRes = await pool.query('SELECT * FROM phases WHERE project_id = $1 ORDER BY phase_number ASC', [req.params.id]);
        const phases = phasesRes.rows;

        if (phases.length > 0) {
            const tasksRes = await pool.query('SELECT * FROM tasks WHERE phase_id = ANY($1) ORDER BY created_at ASC', [phases.map(p => p.id)]);
            phases.forEach(phase => { phase.tasks = tasksRes.rows.filter(t => t.phase_id === phase.id); });
        }

        project.phases = phases;
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [REMOVED] Duplicate pipeline GET — full version with sessions is at line ~5257

app.put('/api/projects/:id', async (req, res) => {
    try {
        const { name, problem, solution, status, blocks, success_metrics, department, sub_area, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements } = req.body;
        await pool.query(
            `UPDATE projects
             SET name=$1, problem=$2, solution=$3, status=$4, blocks=$5, success_metrics=$6,
                 department=$7, sub_area=$8, pain_points=$9, requirements=$10, risks=$11,
                 estimated_budget=$12, estimated_timeline=$13, future_improvements=$14, updated_at=NOW()
             WHERE id=$15`,
            [name, problem, solution, status, JSON.stringify(blocks), JSON.stringify(success_metrics),
             department, sub_area, JSON.stringify(pain_points), JSON.stringify(requirements),
             JSON.stringify(risks), estimated_budget, estimated_timeline, JSON.stringify(future_improvements), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/:id/emails — list email versions for a project
app.get('/api/projects/:id/emails', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, variant_name, market, language, tier, version, status,
              subject_line, html_content, generated_by, created_at, updated_at
       FROM email_proposals
       WHERE project_id = $1
       ORDER BY market, language, tier, version DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/projects/:id/emails error:', err);
    res.status(500).json({ error: 'Failed to fetch email versions' });
  }
});

// POST /api/projects/:id/emails — save a new email version
app.post('/api/projects/:id/emails', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { market, language, tier, html_content, subject_line, variant_name, status } = req.body;
  if (!market || !language || !html_content) {
    return res.status(400).json({ error: 'market, language, html_content are required' });
  }
  try {
    // Get next version number for this combination
    const versionRes = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM email_proposals
       WHERE project_id = $1 AND market = $2 AND language = $3 AND tier IS NOT DISTINCT FROM $4`,
      [id, market, language, tier || null]
    );
    const version = versionRes.rows[0].next_version;
    const result = await pool.query(
      `INSERT INTO email_proposals (project_id, campaign_id, market, language, tier, version,
        html_content, subject_line, variant_name, status, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'html-developer-agent')
       RETURNING *`,
      [id, `project-${id}`, market, language, tier || null, version,
       html_content, subject_line || '', variant_name || `v${version}`, status || 'draft']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/projects/:id/emails error:', err);
    res.status(500).json({ error: 'Failed to save email version' });
  }
});

// PATCH /api/emails/:id/status — update email status (draft→review→approved)
app.patch('/api/emails/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['draft', 'review', 'approved', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `UPDATE email_proposals SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/emails/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ── Pipeline ──
app.get('/api/pipeline', async (req, res) => {
    try {
        const { department, type } = req.query;
        const items = [];

        // Projects (always included unless filtered)
        if (!type || type === 'project') {
            let q = `SELECT p.*, 'project' as _type,
                (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id) as total_tasks,
                (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id AND t.status = 'Done') as done_tasks,
                EXISTS(SELECT 1 FROM project_pipeline pp WHERE pp.project_id = p.id AND pp.status IN ('active', 'paused')) as has_active_pipeline,
                (SELECT count(*) FROM pipeline_stages ps JOIN project_pipeline pp ON ps.pipeline_id = pp.id WHERE pp.project_id = p.id) as pipeline_total,
                (SELECT count(*) FROM project_agent_sessions pas JOIN project_pipeline pp ON pas.pipeline_id = pp.id WHERE pp.project_id = p.id AND pas.status = 'completed') as pipeline_completed
                FROM projects p`;
            const params = [];
            if (department) { params.push(department); q += ` WHERE LOWER(p.department) = LOWER($${params.length})`; }
            q += ' ORDER BY p.updated_at DESC';
            const result = await pool.query(q, params);
            items.push(...result.rows);
        }

        // Email proposals (skip gracefully if table doesn't exist)
        if (!type || type === 'email_proposal') {
            try {
                let q = `SELECT id, campaign_id, variant_name as name, market, language, tier, subject_line, status, department, created_at, updated_at, 'email_proposal' as _type FROM email_proposals`;
                const params = [];
                if (department) { params.push(department); q += ` WHERE LOWER(department) = LOWER($${params.length})`; }
                q += ' ORDER BY updated_at DESC LIMIT 50';
                const result = await pool.query(q, params);
                items.push(...result.rows);
            } catch (e) { /* table may not exist yet */ }
        }

        // Research sessions (skip gracefully if table doesn't exist)
        if (!type || type === 'research_session') {
            try {
                let q = `SELECT id, title as name, topic, status, progress, sources_found, depth, campaign_id, department, created_at, updated_at, 'research_session' as _type FROM research_sessions`;
                const params = [];
                if (department) { params.push(department); q += ` WHERE LOWER(department) = LOWER($${params.length})`; }
                q += ' ORDER BY updated_at DESC LIMIT 30';
                const result = await pool.query(q, params);
                items.push(...result.rows);
            } catch (e) { /* table may not exist yet */ }
        }

        // Experiments (skip gracefully if table doesn't exist)
        if (!type || type === 'experiment') {
            try {
                let q = `SELECT id, campaign_id, experiment_type, hypothesis as name, status, winner, improvement_pct, department, created_at, updated_at, 'experiment' as _type FROM campaign_experiments`;
                const params = [];
                if (department) { params.push(department); q += ` WHERE LOWER(department) = LOWER($${params.length})`; }
                q += ' ORDER BY updated_at DESC LIMIT 30';
                const result = await pool.query(q, params);
                items.push(...result.rows);
            } catch (e) { /* table may not exist yet */ }
        }

        // Sort all by updated_at descending
        items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/projects/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Planning', 'In Progress', 'Completed', 'Paused'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status invalido. Validos: ${validStatuses.join(', ')}` });
        }
        const result = await pool.query(
            'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
        await logAudit('project', result.rows[0].department, `Proyecto "${result.rows[0].name}" → ${status}`, `Status change`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/tasks/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DB DIAGNOSTIC (temporary)
app.get('/api/db-status', async (req, res) => {
    try {
        const counts = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM agents)::int AS agents,
                (SELECT COUNT(*) FROM projects)::int AS projects,
                (SELECT COUNT(*) FROM inbox_items)::int AS inbox,
                (SELECT COUNT(*) FROM eod_reports)::int AS eod,
                (SELECT COUNT(*) FROM weekly_sessions)::int AS weekly,
                (SELECT COUNT(*) FROM workflow_runs)::int AS workflows,
                (SELECT COUNT(*) FROM pm_reports)::int AS reports,
                (SELECT COUNT(*) FROM audit_log)::int AS audit
        `);
        res.json({ status: 'ok', counts: counts.rows[0], timestamp: new Date().toISOString() });
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/agents', async (req, res) => {
    try {
        const { department } = req.query;
        let query = 'SELECT * FROM agents';
        const params = [];
        if (department) {
            query += ' WHERE department = $1';
            params.push(department);
        }
        query += ' ORDER BY department, name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/agents/:id', async (req, res) => {
    try {
        const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
        if (agentRes.rows.length === 0) return res.status(404).json({ error: 'Agente no encontrado' });
        const agent = agentRes.rows[0];

        // Last 10 EOD reports
        const eodRes = await pool.query(
            'SELECT * FROM eod_reports WHERE agent_id = $1 ORDER BY date DESC LIMIT 10',
            [req.params.id]
        );
        agent.eod_reports = eodRes.rows;

        // Recent raw events (last 20)
        const eventsRes = await pool.query(
            'SELECT * FROM raw_events WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT 20',
            [req.params.id]
        );
        agent.recent_events = eventsRes.rows;

        res.json(agent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/agents/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await pool.query('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
        await logAudit('agent', null, `Agent ${req.params.id} status -> ${status}`, null, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/agents/:id/settings — agent settings + default profile for comparison
app.get('/api/agents/:id/settings', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, personality, voice_name, voice_rules, rag_namespaces,
                    budget_max, budget_period, budget_spent,
                    connections, skills, tools
             FROM agents WHERE id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

        const agent = result.rows[0];
        const defaultProfile = getAgentProfile(req.params.id);

        res.json({
            ...agent,
            default_personality: defaultProfile.personality,
            default_voice_name: defaultProfile.voiceName,
            default_voice_rules: defaultProfile.voiceRules,
            default_rag_namespaces: defaultProfile.ragNamespaces,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/agents/:id/settings — update agent settings
app.patch('/api/agents/:id/settings', async (req, res) => {
    try {
        const allowed = [
            'personality', 'voice_name', 'voice_rules', 'rag_namespaces',
            'budget_max', 'budget_period', 'connections', 'skills', 'tools'
        ];
        const sets = [];
        const values = [];
        let idx = 1;

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (['connections', 'skills', 'tools', 'rag_namespaces'].includes(key)) {
                    sets.push(`${key} = $${idx}::jsonb`);
                    values.push(JSON.stringify(req.body[key]));
                } else if (key === 'budget_max') {
                    sets.push(`${key} = $${idx}::numeric`);
                    values.push(req.body[key]);
                } else {
                    sets.push(`${key} = $${idx}`);
                    values.push(req.body[key]);
                }
                idx++;
            }
        }

        if (sets.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

        values.push(req.params.id);
        await pool.query(
            `UPDATE agents SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
            values
        );

        await logAudit('agent', null, `Agent ${req.params.id} settings updated`,
            `Fields: ${sets.map(s => s.split(' ')[0]).join(', ')}`, req.params.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/agents/:id/settings/reset-personality — reset to profiles.js defaults
app.post('/api/agents/:id/settings/reset-personality', async (req, res) => {
    try {
        await pool.query(
            `UPDATE agents SET personality = NULL, voice_name = NULL, voice_rules = NULL,
             rag_namespaces = NULL, updated_at = NOW() WHERE id = $1`,
            [req.params.id]
        );
        await logAudit('agent', null, `Agent ${req.params.id} personality reset to default`, null, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Default departments (used when workspace_config has no 'departments' key)
const DEFAULT_DEPT_META = {
    strategic: { name: 'Strategic Layer', emoji: '🎯', color: '#D4AF37', description: 'Campaign strategy, CRM intelligence & marketing architecture' },
    execution: { name: 'Execution Layer', emoji: '🚀', color: '#D71920', description: 'Content creation, segmentation, automation & calendar orchestration' },
    control: { name: 'Control & Validation', emoji: '🛡️', color: '#2d2d2d', description: 'Brand compliance, legal review, QA testing & performance analytics' },
};

let DEPT_META = { ...DEFAULT_DEPT_META };

// Load departments from workspace_config if available
async function loadDeptMeta() {
    try {
        const res = await pool.query("SELECT value FROM workspace_config WHERE key = 'departments'");
        if (res.rows.length > 0) DEPT_META = res.rows[0].value;
    } catch { /* table may not exist yet, use defaults */ }
}
loadDeptMeta();

app.get('/api/departments', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT department,
                    count(*) as agent_count,
                    count(*) FILTER (WHERE status = 'active') as active_count
             FROM agents GROUP BY department ORDER BY department`
        );
        const departments = result.rows.map(row => ({
            id: row.department,
            ...DEPT_META[row.department] || { name: row.department, emoji: '📁', color: '#94a3b8', description: '' },
            agentCount: parseInt(row.agent_count),
            activeCount: parseInt(row.active_count),
        }));
        res.json(departments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/departments/:id', async (req, res) => {
    try {
        const deptId = req.params.id;
        const meta = DEPT_META[deptId] || { name: deptId, emoji: '📁', color: '#94a3b8', description: '' };

        const agentsRes = await pool.query(
            'SELECT * FROM agents WHERE department = $1 ORDER BY name', [deptId]
        );

        // Latest weekly for this dept
        const weeklyRes = await pool.query(
            'SELECT * FROM weekly_sessions WHERE department = $1 ORDER BY session_date DESC LIMIT 1', [deptId]
        );

        res.json({
            id: deptId,
            ...meta,
            agents: agentsRes.rows,
            latestWeekly: weeklyRes.rows[0] || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/weekly-sessions', async (req, res) => {
    try {
        const { department } = req.query;
        let query = `SELECT ws.*,
            (SELECT count(*) FROM weekly_brainstorms wb WHERE wb.weekly_session_id = ws.id) AS brainstorm_count
            FROM weekly_sessions ws`;
        const params = [];
        if (department) {
            query += ' WHERE ws.department = $1';
            params.push(department);
        }
        query += ' ORDER BY ws.session_date DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/weekly-sessions/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM weekly_sessions WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/weekly-sessions', async (req, res) => {
    try {
        const { department, week_number, session_date, steps_data, final_projects } = req.body;
        const result = await pool.query(
            `INSERT INTO weekly_sessions (department, week_number, session_date, steps_data, final_projects)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [department, week_number, session_date || new Date(), JSON.stringify(steps_data || {}), JSON.stringify(final_projects || [])]
        );
        await logAudit('weekly', department, `Weekly W${week_number} creada: ${department}`, `Session date: ${session_date}`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/weekly-sessions/:id', async (req, res) => {
    try {
        const { status, report } = req.body;
        const sets = [];
        const params = [];

        if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
        if (report !== undefined) { params.push(JSON.stringify(report)); sets.push(`report = $${params.length}`); }

        if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

        sets.push('updated_at = NOW()');
        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE weekly_sessions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/weekly-sessions/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM weekly_sessions WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        await logAudit('weekly', result.rows[0].department, `Weekly W${result.rows[0].week_number} eliminada`, `Session ID: ${req.params.id}`);
        res.json({ deleted: true, session: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/weekly-sessions/:id/brainstorms', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, a.name as agent_name, a.role as agent_role, a.avatar as agent_avatar
             FROM weekly_brainstorms b
             JOIN agents a ON b.agent_id = a.id
             WHERE b.weekly_session_id = $1
             ORDER BY b.created_at ASC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/weekly-sessions/:id/import-inbox', async (req, res) => {
    try {
        const sessionId = req.params.id;

        const sessionRes = await pool.query('SELECT * FROM weekly_sessions WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        const session = sessionRes.rows[0];

        // Find previous weekly for this department to get cutoff date
        const prevRes = await pool.query(
            `SELECT created_at FROM weekly_sessions
             WHERE department = $1 AND id != $2
             ORDER BY created_at DESC LIMIT 1`,
            [session.department, sessionId]
        );
        const since = prevRes.rows.length > 0
            ? prevRes.rows[0].created_at
            : new Date(0).toISOString();

        // Find eligible inbox items (case-insensitive department match)
        const inboxRes = await pool.query(
            `SELECT * FROM inbox_items
             WHERE LOWER(department) = LOWER($1)
               AND status IN ('borrador', 'chat')
               AND created_at > $2
             ORDER BY created_at DESC`,
            [session.department, since]
        );
        const inboxItems = inboxRes.rows.map(i => ({ ...i, _source: 'inbox' }));

        // Find pipeline projects for this department
        const projectsRes = await pool.query(
            `SELECT * FROM projects
             WHERE LOWER(department) = LOWER($1)
               AND status IN ('Planning', 'In Progress')
             ORDER BY updated_at DESC`,
            [session.department]
        );
        const pipelineItems = projectsRes.rows.map(p => ({ ...p, _source: 'pipeline' }));

        const allItems = [...inboxItems, ...pipelineItems];

        // Save snapshot
        await pool.query(
            `UPDATE weekly_sessions SET inbox_snapshot = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(allItems), sessionId]
        );

        // Link inbox items to this session
        if (inboxItems.length > 0) {
            const ids = inboxItems.map(i => i.id);
            await pool.query(
                `UPDATE inbox_items SET weekly_session_id = $1, updated_at = NOW() WHERE id = ANY($2)`,
                [sessionId, ids]
            );
        }

        await logAudit('weekly', session.department,
            `Inbox importado: W${session.week_number}`,
            `${inboxItems.length} inbox + ${pipelineItems.length} proyectos importados`
        );
        res.json({ imported: allItems.length, items: allItems });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/weekly-sessions/:id/brainstorm', async (req, res) => {
    try {
        const sessionId = req.params.id;

        const sessionRes = await pool.query('SELECT * FROM weekly_sessions WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        const session = sessionRes.rows[0];

        const agentsRes = await pool.query(
            'SELECT * FROM agents WHERE department = $1 ORDER BY name',
            [session.department]
        );
        const agents = agentsRes.rows;
        if (agents.length === 0) return res.json({ contributions: [] });

        // Load inbox items for this session
        const inboxRes = await pool.query(
            'SELECT title, description, status FROM inbox_items WHERE weekly_session_id = $1',
            [sessionId]
        );
        const inboxItems = inboxRes.rows;

        // Extract pipeline projects from session snapshot
        const snapshot = Array.isArray(session.inbox_snapshot) ? session.inbox_snapshot : [];
        const pipelineProjects = snapshot.filter(i => i._source === 'pipeline');

        // Load EOD reports for last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const eodRes = await pool.query(
            `SELECT e.*, a.name as agent_name FROM eod_reports e
             JOIN agents a ON e.agent_id = a.id
             WHERE a.department = $1 AND e.date >= $2
             ORDER BY e.date DESC`,
            [session.department, sevenDaysAgo.toISOString().split('T')[0]]
        );

        const contributions = [];

        for (const agent of agents) {
            const agentEods = eodRes.rows.filter(r => r.agent_id === agent.id);

            const inboxContext = inboxItems.length > 0
                ? `\n\nIdeas on this week's agenda:\n${inboxItems.map(i => `- ${i.title}: ${i.description || 'No description'}`).join('\n')}`
                : '';

            const projectContext = pipelineProjects.length > 0
                ? `\n\nActive department projects for this week:\n${pipelineProjects.map(p =>
                    `- **${p.name}**\n  Problem: ${p.problem || 'Not defined'}\n  Proposed solution: ${p.solution || 'Not defined'}\n  Success metrics: ${(Array.isArray(p.success_metrics) ? p.success_metrics : []).join(', ') || 'Not defined'}\n  Risks: ${(Array.isArray(p.risks) ? p.risks : []).join(', ') || 'None identified'}\n  Status: ${p.status}`
                  ).join('\n\n')}`
                : '';

            const eodContext = agentEods.length > 0
                ? `\n\nYour recent work (last 7 days):\n${agentEods.map(e => {
                    const completed = Array.isArray(e.completed_tasks) ? e.completed_tasks : [];
                    const blockers = Array.isArray(e.blockers) ? e.blockers : [];
                    return `${e.date}: ${completed.length} tasks completed${blockers.length > 0 ? `, blocked on: ${blockers.map(b => b.desc || b).join(', ')}` : ''}`;
                }).join('\n')}`
                : '';

            const hasProjects = pipelineProjects.length > 0;
            const systemPrompt = `You are ${agent.name}, ${agent.role} on the team.
Your department is ${agent.department}.
It's Monday and you have 2 minutes to give your contribution in the Weekly Brainstorm.
${hasProjects
    ? `There are active projects on the agenda. Analyze each one from your perspective as ${agent.role} and provide:
- How you can contribute from your specific area
- Risks or concerns you identify
- Concrete proposals for improvement or execution
Reference projects by name. Be specific and practical.`
    : `Propose ONE improvement, concrete project, or concern based on your recent work and this week's ideas.
Be specific, practical, and concise.`}
Maximum 3 paragraphs.
Classify your contribution as: proposal, improvement, concern, or insight.
Respond ONLY in the following JSON format:
{"contribution_type": "proposal|improvement|concern|insight", "content": "Your proposal here..."}`;

            try {
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 800,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: `Week ${session.week_number}.${projectContext}${inboxContext}${eodContext}\n\nWhat is your contribution?` }],
                });

                const text = response.content[0].text;
                let parsed = null;
                try {
                    const jsonMatch = text.match(/\{[\s\S]+\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                } catch { /* use raw text */ }

                const contributionType = parsed?.contribution_type || 'insight';
                const content = parsed?.content || text;

                const saved = await pool.query(
                    `INSERT INTO weekly_brainstorms
                     (weekly_session_id, agent_id, contribution_type, content, context)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [sessionId, agent.id, contributionType, content,
                     JSON.stringify({ eod_count: agentEods.length, inbox_count: inboxItems.length })]
                );

                contributions.push({
                    ...saved.rows[0],
                    agent_name: agent.name,
                    agent_role: agent.role,
                    agent_avatar: agent.avatar,
                });
            } catch (agentErr) {
                console.error(`[Brainstorm] Error for agent ${agent.id}:`, agentErr.message);
            }
        }

        await logAudit('weekly', session.department,
            `Brainstorm W${session.week_number}`,
            `${contributions.length} contributions generated`
        );
        res.json({ contributions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/weekly-sessions/:id/brainstorm/:bid/respond', async (req, res) => {
    try {
        const { bid, id: sessionId } = req.params;
        const { user_response, action } = req.body;

        const finalResponse = (action === 'accept_project' && !user_response)
            ? 'Accepted as project'
            : (user_response || '');

        const updateRes = await pool.query(
            `UPDATE weekly_brainstorms SET user_response = $1 WHERE id = $2 AND weekly_session_id = $3 RETURNING *`,
            [finalResponse, bid, sessionId]
        );
        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Contribution not found' });
        const contribution = updateRes.rows[0];

        let createdProject = null;

        if (action === 'accept_project') {
            const sessionRes = await pool.query(
                'SELECT department, week_number FROM weekly_sessions WHERE id = $1',
                [sessionId]
            );
            const session = sessionRes.rows[0];

            // Extract structured fields from brainstorm using Claude
            let extracted = {};
            try {
                const extraction = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 600,
                    system: 'Extract structured fields from this brainstorm proposal to create a project. Respond ONLY in valid JSON, no markdown.',
                    messages: [{ role: 'user', content: `Agent proposal:\n${contribution.content}\n\nExtract as JSON:\n{"name":"short project name (max 60 chars)","problem":"problem it solves","solution":"summarized proposed solution","success_metrics":["metric1","metric2"],"requirements":["req1"],"risks":["risk1"]}` }],
                });
                const jsonMatch = extraction.content[0].text.match(/\{[\s\S]+\}/);
                if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
            } catch (aiErr) {
                console.error('[Accept Project] AI extraction failed:', aiErr.message);
            }

            const projRes = await pool.query(
                `INSERT INTO projects
                 (name, problem, solution, department, sub_area, status, blocks, success_metrics, pain_points, requirements, risks, estimated_budget, estimated_timeline, future_improvements)
                 VALUES ($1,$2,$3,$4,$5,'Planning','[]',$6,'[]',$7,$8,0,'TBD','[]') RETURNING *`,
                [
                    extracted.name || contribution.content.substring(0, 60),
                    extracted.problem || `Brainstorm proposal W${session.week_number}`,
                    extracted.solution || contribution.content,
                    session.department,
                    'General',
                    JSON.stringify(extracted.success_metrics || []),
                    JSON.stringify(extracted.requirements || []),
                    JSON.stringify(extracted.risks || []),
                ]
            );
            createdProject = projRes.rows[0];

            await logAudit('weekly', session.department,
                `Project created from brainstorm W${session.week_number}`,
                `Project ID: ${createdProject.id}, Name: ${createdProject.name}`
            );
        }

        res.json({ contribution, createdProject });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Multi-Agent Brainstorm Conversation ──

app.post('/api/weekly-sessions/:id/multi-brainstorm', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { projects } = req.body;

        const sessionRes = await pool.query('SELECT * FROM weekly_sessions WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Weekly session not found' });
        const session = sessionRes.rows[0];

        const agentsRes = await pool.query(
            'SELECT * FROM agents WHERE department = $1 ORDER BY name',
            [session.department]
        );
        const agents = agentsRes.rows;
        if (agents.length === 0) return res.json({ conversation_id: null, messages: [] });

        const projectList = Array.isArray(projects) && projects.length > 0
            ? projects
            : [];

        if (projectList.length === 0) {
            return res.status(400).json({ error: 'No projects provided for discussion' });
        }

        // Build agent descriptions for the prompt
        const agentDescriptions = agents.map(a =>
            `- ${a.name} (${a.role}): skills: ${(Array.isArray(a.skills) ? a.skills : []).join(', ')}`
        ).join('\n');

        const projectDescriptions = projectList.map((p, i) =>
            `${i + 1}. "${p.title || p.name}": ${p.description || 'No description'}`
        ).join('\n');

        const agentIds = agents.map(a => a.id);
        const agentMap = {};
        agents.forEach(a => { agentMap[a.id] = a; agentMap[a.name.toLowerCase()] = a; });

        const systemPrompt = `You are simulating a brainstorm meeting between these AI agents:
${agentDescriptions}

Projects to discuss (in this order):
${projectDescriptions}

Generate a natural, flowing conversation where agents discuss each project one by one.
Rules:
1. Each agent contributes from their specific expertise and role.
2. Agents reference each other by name naturally (e.g. "@Lucia, building on your point...").
3. Include 2-3 agent messages per project, then a pause_for_human marker, then 1-2 more agent wrap-up messages before moving to the next project.
4. Keep each message concise (2-4 sentences max).
5. Vary which agent starts each project discussion — pick the most relevant one.
6. The conversation should feel like a real team meeting: agreements, constructive challenges, building on each other's ideas.
7. Respond in English.

Return ONLY a valid JSON array of message objects. No markdown, no explanation. Each message:
{"agent_id": "exact-agent-id", "content": "message text", "project_index": 0}

For pause markers: {"type": "pause_for_human", "project_index": 0}
For project transitions: {"type": "system", "content": "transition text", "project_index": 1}

Valid agent_ids: ${agentIds.map(id => `"${id}"`).join(', ')}`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: 'Start the brainstorm. Discuss each project in order.' }],
        });

        const text = response.content[0].text;
        let parsedMessages = [];
        try {
            const jsonMatch = text.match(/\[[\s\S]+\]/);
            if (jsonMatch) parsedMessages = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
            console.error('[Multi-Brainstorm] JSON parse error:', parseErr.message);
            return res.status(500).json({ error: 'Failed to parse AI response' });
        }

        // Create conversation record
        const convRes = await pool.query(
            `INSERT INTO brainstorm_conversations (weekly_session_id, mode, status, projects_order)
             VALUES ($1, 'demo', 'active', $2) RETURNING *`,
            [sessionId, JSON.stringify(projectList.map((p, i) => ({ index: i, title: p.title || p.name })))]
        );
        const conversation = convRes.rows[0];

        // Enrich messages with agent metadata and persist
        const enrichedMessages = [];
        for (const msg of parsedMessages) {
            const isSystem = msg.type === 'system';
            const isPause = msg.type === 'pause_for_human';
            const messageType = isPause ? 'pause_for_human' : isSystem ? 'system_message' : 'agent_message';
            const agent = msg.agent_id ? (agentMap[msg.agent_id] || null) : null;

            const saved = await pool.query(
                `INSERT INTO brainstorm_messages (conversation_id, message_type, agent_id, content, project_index)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [conversation.id, messageType, msg.agent_id || null, msg.content || '', msg.project_index ?? 0]
            );

            enrichedMessages.push({
                id: saved.rows[0].id,
                type: messageType,
                agent_id: msg.agent_id || null,
                agent_name: agent?.name || null,
                agent_avatar: agent?.avatar || null,
                agent_role: agent?.role || null,
                content: msg.content || '',
                project_index: msg.project_index ?? 0,
                created_at: saved.rows[0].created_at,
            });
        }

        await logAudit('weekly', session.department,
            `Multi-brainstorm W${session.week_number}`,
            `${enrichedMessages.length} messages generated, ${projectList.length} projects`
        );

        res.json({ conversation_id: conversation.id, messages: enrichedMessages });
    } catch (err) {
        console.error('[Multi-Brainstorm] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/weekly-sessions/:id/multi-brainstorm/:convId', async (req, res) => {
    try {
        const { id: sessionId, convId } = req.params;

        const convRes = await pool.query(
            'SELECT * FROM brainstorm_conversations WHERE id = $1 AND weekly_session_id = $2',
            [convId, sessionId]
        );
        if (convRes.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
        const conversation = convRes.rows[0];

        const msgsRes = await pool.query(
            `SELECT bm.*, a.name as agent_name, a.avatar as agent_avatar, a.role as agent_role
             FROM brainstorm_messages bm
             LEFT JOIN agents a ON bm.agent_id = a.id
             WHERE bm.conversation_id = $1
             ORDER BY bm.id ASC`,
            [convId]
        );

        const messages = msgsRes.rows.map(m => ({
            id: m.id,
            type: m.message_type,
            agent_id: m.agent_id,
            agent_name: m.agent_name,
            agent_avatar: m.agent_avatar,
            agent_role: m.agent_role,
            content: m.content,
            project_index: m.project_index,
            created_at: m.created_at,
        }));

        res.json({
            id: conversation.id,
            status: conversation.status,
            mode: conversation.mode,
            current_project_index: conversation.current_project_index,
            projects: conversation.projects_order,
            messages,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save human message to multi-brainstorm conversation
app.post('/api/weekly-sessions/:id/multi-brainstorm/:convId/human-message', async (req, res) => {
    try {
        const { convId } = req.params;
        const { content, project_index } = req.body;

        const saved = await pool.query(
            `INSERT INTO brainstorm_messages (conversation_id, message_type, content, project_index)
             VALUES ($1, 'human_message', $2, $3) RETURNING *`,
            [convId, content || '', project_index ?? 0]
        );

        res.json({ id: saved.rows[0].id, type: 'human_message', content, project_index });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Generate Smart Weekly Report ──
app.post('/api/weekly-sessions/:id/report', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Load session
        const sessionResult = await pool.query('SELECT * FROM weekly_sessions WHERE id = $1', [id]);
        if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const session = sessionResult.rows[0];
        const { department, week_number, session_date } = session;

        // 2. Date range: from previous session+1 day (or 7 days back) to session_date
        const prevSessionResult = await pool.query(
            `SELECT session_date, report FROM weekly_sessions
             WHERE department = $1 AND session_date < $2
             ORDER BY session_date DESC LIMIT 1`,
            [department, session_date]
        );
        const endDate = new Date(session_date).toISOString().split('T')[0];
        let startDate;
        if (prevSessionResult.rows.length > 0) {
            const prev = new Date(prevSessionResult.rows[0].session_date);
            prev.setDate(prev.getDate() + 1);
            startDate = prev.toISOString().split('T')[0];
        } else {
            const start = new Date(session_date);
            start.setDate(start.getDate() - 7);
            startDate = start.toISOString().split('T')[0];
        }

        // 3. Query EODs for department + date range
        const eodResult = await pool.query(
            `SELECT e.*, a.name as agent_name, a.role as agent_role
             FROM eod_reports e
             JOIN agents a ON e.agent_id = a.id
             WHERE a.department = $1 AND e.date >= $2 AND e.date <= $3`,
            [department, startDate, endDate]
        );
        const eods = eodResult.rows;

        // 4a. Tasks aggregation
        let totalCompleted = 0;
        let totalInProgress = 0;
        eods.forEach(e => {
            const completed = Array.isArray(e.completed_tasks) ? e.completed_tasks : [];
            const inProgress = Array.isArray(e.in_progress_tasks) ? e.in_progress_tasks : [];
            totalCompleted += completed.length;
            totalInProgress += inProgress.length;
        });
        const totalPlanned = totalCompleted + totalInProgress;
        const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) / 100 : 0;
        const tasks = { completed: totalCompleted, in_progress: totalInProgress, planned: totalPlanned, rate: completionRate };

        // 4b. Blockers aggregation
        const allBlockers = [];
        eods.forEach(e => {
            const blockers = Array.isArray(e.blockers) ? e.blockers : [];
            blockers.forEach(b => {
                if (b && (b.description || b.desc || typeof b === 'string')) {
                    allBlockers.push({
                        description: b.description || b.desc || b,
                        agent: e.agent_name,
                        severity: b.severity || 'medium',
                        resolved: b.resolved || false,
                        date: e.date,
                    });
                }
            });
        });

        // 4c. Mood distribution
        const moodCounts = {};
        eods.forEach(e => {
            if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
        });
        const positiveCount = (moodCounts.productive || 0) + (moodCounts.focused || 0) +
            (moodCounts.energized || 0) + (moodCounts.motivated || 0) +
            (moodCounts.creative || 0) + (moodCounts.strategic || 0);
        const blockedCount = moodCounts.blocked || 0;
        const moodTrend = blockedCount === 0 ? 'positivo'
            : positiveCount > blockedCount * 2 ? 'estable' : 'con_friccion';
        const mood = { ...moodCounts, trend: moodTrend };

        // 5. Brainstorm contributions
        const brainstormResult = await pool.query(
            `SELECT contribution_type, user_response FROM weekly_brainstorms WHERE weekly_session_id = $1`,
            [id]
        );
        const contributions = brainstormResult.rows;
        const typeMap = {};
        contributions.forEach(c => {
            if (c.contribution_type) typeMap[c.contribution_type] = (typeMap[c.contribution_type] || 0) + 1;
        });
        const accepted = contributions.filter(c => c.user_response && c.user_response.trim().length > 0).length;
        const brainstorm_summary = { total: contributions.length, accepted, types: typeMap };

        // 6. Inbox snapshot
        const inboxItems = Array.isArray(session.inbox_snapshot) ? session.inbox_snapshot : [];
        const inbox = {
            total: inboxItems.length,
            by_status: inboxItems.reduce((acc, item) => {
                const s = item.status || 'chat';
                acc[s] = (acc[s] || 0) + 1;
                return acc;
            }, {}),
        };

        // 7. Department KPIs
        let kpis = {};
        if (department === 'data') {
            try {
                const kpiResult = await pool.query(
                    `SELECT COUNT(*) as count FROM raw_events
                     WHERE created_at::date >= $1 AND created_at::date <= $2`,
                    [startDate, endDate]
                );
                kpis.properties_scraped = parseInt(kpiResult.rows[0]?.count) || 0;
            } catch { kpis.properties_scraped = null; }
        }

        // 8. Previous week comparison
        let vs_last_week = null;
        const prevReport = prevSessionResult.rows[0]?.report;
        if (prevReport && prevReport.tasks) {
            vs_last_week = {
                tasks_delta: totalCompleted - (prevReport.tasks.completed || 0),
                blockers_delta: allBlockers.length - (Array.isArray(prevReport.blockers) ? prevReport.blockers.length : 0),
                mood_trend: moodTrend,
            };
        }

        // 8b. Pipeline activity for department
        const pipelineResult = await pool.query(
            `SELECT pp.status as pipeline_status, p.name as project_name, p.id as project_id,
                (SELECT count(*) FROM pipeline_stages WHERE pipeline_id = pp.id) as total_stages,
                (SELECT count(*) FROM project_agent_sessions WHERE pipeline_id = pp.id AND status = 'completed') as completed_stages
             FROM project_pipeline pp
             JOIN projects p ON p.id = pp.project_id
             WHERE LOWER(p.department) = LOWER($1) AND pp.status IN ('active', 'paused')`,
            [department]
        );
        const pipeline_summary = {
            active_pipelines: pipelineResult.rows.length,
            projects: pipelineResult.rows.map(r => ({
                name: r.project_name,
                status: r.pipeline_status,
                progress: `${r.completed_stages}/${r.total_stages}`,
            })),
        };

        // 9. Assemble & save report
        const report = {
            period: { week: week_number, start: startDate, end: endDate },
            tasks, blockers: allBlockers, mood, kpis,
            brainstorm_summary, inbox, pipeline_summary, vs_last_week,
            generated_at: new Date().toISOString(),
        };

        await pool.query(
            'UPDATE weekly_sessions SET report = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(report), id]
        );

        res.json({ report });
    } catch (err) {
        console.error('Error generating weekly report:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EOD REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/eod-reports', async (req, res) => {
    try {
        await refreshEodDates();
        const { department, date, from, to } = req.query;
        let query = `
            SELECT r.*, a.name as agent_name, a.avatar, a.department, a.role
            FROM eod_reports r
            JOIN agents a ON r.agent_id = a.id
        `;
        const conditions = [];
        const params = [];

        if (department) {
            params.push(department);
            conditions.push(`a.department = $${params.length}`);
        }
        if (date) {
            params.push(date);
            conditions.push(`r.date = $${params.length}`);
        }
        if (!date && from) {
            params.push(from);
            conditions.push(`r.date >= $${params.length}`);
        }
        if (!date && to) {
            params.push(to);
            conditions.push(`r.date <= $${params.length}`);
        }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY r.date DESC, a.name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/eod-reports/coverage', async (req, res) => {
    try {
        const { department, date } = req.query;
        if (!department) return res.status(400).json({ error: 'department is required' });
        const targetDate = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(`
            SELECT a.id, a.name, a.avatar, a.role,
                   r.id AS report_id, r.mood,
                   COALESCE(jsonb_array_length(r.completed_tasks), 0) AS completed_count,
                   COALESCE(jsonb_array_length(r.blockers), 0) AS blocker_count
            FROM agents a
            LEFT JOIN eod_reports r ON r.agent_id = a.id AND r.date = $2
            WHERE a.department = $1 AND a.status != 'offline'
            ORDER BY a.name
        `, [department, targetDate]);
        const total = result.rows.length;
        const reported = result.rows.filter(r => r.report_id !== null).length;
        res.json({ total, reported, coverage: total > 0 ? Math.round((reported / total) * 100) : 0, agents: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/eod-reports/trends', async (req, res) => {
    try {
        const { department, days } = req.query;
        if (!department) return res.status(400).json({ error: 'department is required' });
        const numDays = parseInt(days) || 14;

        const result = await pool.query(`
            SELECT r.date::text,
                   COUNT(*)::int AS report_count,
                   COALESCE(SUM(jsonb_array_length(r.completed_tasks)), 0)::int AS completed_count,
                   COALESCE(SUM(jsonb_array_length(r.blockers)), 0)::int AS blocker_count,
                   COALESCE(SUM(jsonb_array_length(r.in_progress_tasks)), 0)::int AS wip_count
            FROM eod_reports r
            JOIN agents a ON r.agent_id = a.id
            WHERE a.department = $1 AND r.date >= CURRENT_DATE - $2::int
            GROUP BY r.date
            ORDER BY r.date ASC
        `, [department, numDays]);

        // Mood distribution for the period
        const moodResult = await pool.query(`
            SELECT r.mood, COUNT(*)::int AS count
            FROM eod_reports r
            JOIN agents a ON r.agent_id = a.id
            WHERE a.department = $1 AND r.date >= CURRENT_DATE - $2::int AND r.mood IS NOT NULL
            GROUP BY r.mood
            ORDER BY count DESC
        `, [department, numDays]);

        res.json({ daily: result.rows, moodDistribution: moodResult.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/eod-reports/agent/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM eod_reports WHERE agent_id = $1 ORDER BY date DESC LIMIT 30',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/eod-reports', async (req, res) => {
    try {
        const { agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, plan_tomorrow, mood } = req.body;
        const result = await pool.query(
            `INSERT INTO eod_reports (agent_id, date, completed_tasks, in_progress_tasks, blockers, insights, plan_tomorrow, mood)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (agent_id, date) DO UPDATE
             SET completed_tasks = EXCLUDED.completed_tasks, in_progress_tasks = EXCLUDED.in_progress_tasks,
                 blockers = EXCLUDED.blockers, insights = EXCLUDED.insights,
                 plan_tomorrow = EXCLUDED.plan_tomorrow, mood = EXCLUDED.mood
             RETURNING *`,
            [agent_id, date || new Date().toISOString().split('T')[0],
             JSON.stringify(completed_tasks || []), JSON.stringify(in_progress_tasks || []),
             JSON.stringify(blockers || []), JSON.stringify(insights || []),
             JSON.stringify(plan_tomorrow || []), mood || 'neutral']
        );
        await logAudit('eod', null, `EOD report: ${agent_id}`, `Date: ${date}`, agent_id);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/raw-events', async (req, res) => {
    try {
        const { agent_id, event_type, content } = req.body;
        if (!agent_id || !event_type) return res.status(400).json({ error: 'agent_id and event_type required' });
        const result = await pool.query(
            'INSERT INTO raw_events (agent_id, event_type, content) VALUES ($1, $2, $3) RETURNING id, timestamp',
            [agent_id, event_type, JSON.stringify(content || {})]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/eod-reports/generate-department', async (req, res) => {
    try {
        const { department, date } = req.body;
        if (!department) return res.status(400).json({ error: 'department is required' });
        const targetDate = date || new Date().toISOString().split('T')[0];

        // Find agents with raw_events on that date but no report yet
        const agentsWithEvents = await pool.query(`
            SELECT DISTINCT a.id FROM agents a
            JOIN raw_events re ON re.agent_id = a.id
            LEFT JOIN eod_reports r ON r.agent_id = a.id AND r.date = $2
            WHERE a.department = $1 AND a.status != 'offline'
              AND re.timestamp::date = $2::date
              AND r.id IS NULL
        `, [department, targetDate]);

        const generated = [];
        for (const { id } of agentsWithEvents.rows) {
            const report = await generateEodReport(id, targetDate, pool);
            if (report) generated.push(id);
        }

        await logAudit('daily', department, `EODs auto-generated: ${department}`, `Generated ${generated.length} reports for ${targetDate}`);
        res.json({ generated: generated.length, agents: generated, date: targetDate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/eod-reports/summarize', async (req, res) => {
    try {
        const { department, date } = req.body;
        if (!department) return res.status(400).json({ error: 'department is required' });
        const targetDate = date || new Date().toISOString().split('T')[0];

        const reportsRes = await pool.query(`
            SELECT r.*, a.name as agent_name, a.role
            FROM eod_reports r
            JOIN agents a ON r.agent_id = a.id
            WHERE a.department = $1 AND r.date = $2
            ORDER BY a.name
        `, [department, targetDate]);

        if (reportsRes.rows.length === 0) {
            return res.json({ summary: 'No hay reportes EOD para esta fecha.', date: targetDate, department });
        }

        // Build context
        let context = `Daily Standup — Departamento: ${department} — Fecha: ${targetDate}\n\n`;
        for (const r of reportsRes.rows) {
            context += `## ${r.agent_name} (${r.role}) — Mood: ${r.mood || 'N/A'}\n`;
            const completed = r.completed_tasks || [];
            const blockers = r.blockers || [];
            const wip = r.in_progress_tasks || [];
            const insights = r.insights || [];
            const plan = r.plan_tomorrow || [];
            if (completed.length > 0) context += `Completado: ${completed.map(t => t.desc).join('; ')}\n`;
            if (wip.length > 0) context += `En progreso: ${wip.map(t => `${t.desc} (${t.pct || '?'}%)`).join('; ')}\n`;
            if (blockers.length > 0) context += `Blockers: ${blockers.map(b => `${b.desc} [${b.severity}]`).join('; ')}\n`;
            if (insights.length > 0) context += `Insights: ${insights.join('; ')}\n`;
            if (plan.length > 0) context += `Plan manana: ${plan.join('; ')}\n`;
            context += '\n';
        }

        // Add pipeline activity for the department
        const pipelineActivity = await pool.query(
            `SELECT pas.agent_id, a.name as agent_name, pas.stage_name, pas.status, p.name as project_name
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN projects p ON p.id = pas.project_id
             WHERE a.department = $1 AND pas.status IN ('active', 'pending', 'awaiting_handoff')
             ORDER BY a.name, pas.stage_order`,
            [department]
        );
        if (pipelineActivity.rows.length > 0) {
            context += `## Pipeline Activity\n`;
            for (const pa of pipelineActivity.rows) {
                context += `- ${pa.agent_name}: "${pa.project_name}" — Stage: ${pa.stage_name} (${pa.status})\n`;
            }
            context += '\n';
        }

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: `Eres el PM Agent. Genera un resumen ejecutivo del Daily Standup en español.
Formato:
- Resumen general (2-3 lineas)
- Logros clave (bullet points)
- Blockers activos (bullet points con severidad)
- Estado del equipo (mood general, quien necesita apoyo)
- Prioridades para manana
Se conciso y directo. Usa emojis sparingly.`,
            messages: [{ role: 'user', content: context }],
        });

        const summary = message.content[0].text;
        await logAudit('daily', department, `AI Standup Summary: ${department}`, `Generated for ${targetDate}`);
        res.json({ summary, date: targetDate, department });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/audit-events', async (req, res) => {
    try {
        const { department, type, limit: lim } = req.query;
        let query = 'SELECT * FROM audit_log';
        const conditions = [];
        const params = [];

        if (department && department !== 'all') {
            params.push(department);
            conditions.push(`department = $${params.length}`);
        }
        if (type && type !== 'all') {
            params.push(type);
            conditions.push(`event_type = $${params.length}`);
        }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY date DESC';
        query += ` LIMIT ${parseInt(lim) || 50}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/intelligence/summary', async (req, res) => {
    try {
        const agentCount = await pool.query('SELECT count(*) FROM agents');
        const activeCount = await pool.query("SELECT count(*) FROM agents WHERE status = 'active'");
        const todayReports = await pool.query("SELECT count(*) FROM eod_reports WHERE date = CURRENT_DATE");
        const totalEvents = await pool.query('SELECT count(*) FROM raw_events');
        const recentAudit = await pool.query('SELECT count(*) FROM audit_log WHERE date > NOW() - interval \'7 days\'');

        // Blockers across all departments today
        const blockersRes = await pool.query(
            `SELECT r.blockers, a.department, a.name
             FROM eod_reports r JOIN agents a ON r.agent_id = a.id
             WHERE r.date = CURRENT_DATE AND r.blockers != '[]'::jsonb`
        );

        res.json({
            agents: { total: parseInt(agentCount.rows[0].count), active: parseInt(activeCount.rows[0].count) },
            today: { eodReports: parseInt(todayReports.rows[0].count) },
            totals: { rawEvents: parseInt(totalEvents.rows[0].count), auditEventsWeek: parseInt(recentAudit.rows[0].count) },
            todayBlockers: blockersRes.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PM REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/pm-reports', async (req, res) => {
    try {
        const { limit: lim } = req.query;
        const result = await pool.query(
            `SELECT * FROM pm_reports ORDER BY created_at DESC LIMIT $1`,
            [parseInt(lim) || 50]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pm-reports/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pm_reports WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pm-reports', async (req, res) => {
    try {
        const { title, summary, body_md, metrics, risks, next_steps } = req.body;
        const result = await pool.query(
            `INSERT INTO pm_reports (title, summary, body_md, metrics, risks, next_steps)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title, summary, body_md, JSON.stringify(metrics || {}), JSON.stringify(risks || []), JSON.stringify(next_steps || [])]
        );
        await logAudit('pm_report', 'product', `PM Report: ${title}`, summary);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pm-reports/generate', async (req, res) => {
    try {
        // Gather live metrics from the database
        const [
            agentCount, activeAgents, projectCount,
            eodCount, weeklyCount, raiseCount, auditWeek, eventCount, memoryCount
        ] = await Promise.all([
            pool.query('SELECT count(*) FROM agents'),
            pool.query("SELECT count(*) FROM agents WHERE status = 'active'"),
            pool.query('SELECT count(*) FROM projects'),
            pool.query('SELECT count(*) FROM eod_reports'),
            pool.query('SELECT count(*) FROM weekly_sessions'),
            pool.query("SELECT count(*) FROM collaboration_raises WHERE status != 'resolved'"),
            pool.query("SELECT count(*) FROM audit_log WHERE date > NOW() - interval '7 days'"),
            pool.query('SELECT count(*) FROM raw_events'),
            pool.query('SELECT count(*) FROM agent_memory'),
        ]);

        const prevReport = await pool.query('SELECT * FROM pm_reports ORDER BY created_at DESC LIMIT 1');

        const metrics = {
            agentes_total: parseInt(agentCount.rows[0].count),
            agentes_activos: parseInt(activeAgents.rows[0].count),
            proyectos: parseInt(projectCount.rows[0].count),
            eod_reports: parseInt(eodCount.rows[0].count),
            weekly_sessions: parseInt(weeklyCount.rows[0].count),
            raises_activos: parseInt(raiseCount.rows[0].count),
            eventos_audit_semana: parseInt(auditWeek.rows[0].count),
            raw_events: parseInt(eventCount.rows[0].count),
            memorias_agente: parseInt(memoryCount.rows[0].count),
        };

        // Detect blockers from today's EODs
        const blockersRes = await pool.query(
            `SELECT r.blockers, a.name, a.department
             FROM eod_reports r JOIN agents a ON r.agent_id = a.id
             WHERE r.date = CURRENT_DATE AND r.blockers != '[]'::jsonb`
        );

        // Build risks from live data
        const risks = [];
        if (metrics.raises_activos > 0) {
            risks.push({ risk: `${metrics.raises_activos} raises de colaboracion sin resolver`, severity: 'ALTA', mitigation: 'Revisar en Collaboration Hub' });
        }
        if (blockersRes.rows.length > 0) {
            const blockerAgents = blockersRes.rows.map(b => b.name).join(', ');
            risks.push({ risk: `Blockers activos hoy: ${blockerAgents}`, severity: 'ALTA', mitigation: 'Revisar Daily Standup' });
        }
        // Build next steps
        const nextSteps = [];
        if (metrics.raises_activos > 0) {
            nextSteps.push({ action: 'Resolver raises de colaboracion pendientes', priority: 'ALTA' });
        }
        if (metrics.eod_reports === 0) {
            nextSteps.push({ action: 'Generar primeros EOD reports para los agentes activos', priority: 'MEDIA' });
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const title = `Reporte Automatico — ${dateStr}`;

        const summaryParts = [
            `${metrics.agentes_activos}/${metrics.agentes_total} agentes activos`,
            `${metrics.proyectos} proyectos`,
            `${metrics.raises_activos} raises pendientes`,
        ];
        const summary = `Estado del sistema: ${summaryParts.join(' | ')}`;

        // Compare with previous report
        let deltaText = '';
        if (prevReport.rows.length > 0) {
            const prev = prevReport.rows[0].metrics || {};
            const deltas = Object.keys(metrics)
                .map(k => {
                    const cur = metrics[k];
                    const p = typeof prev[k] === 'number' ? prev[k] : parseInt(prev[k]);
                    if (isNaN(p) || cur === p) return null;
                    const diff = cur - p;
                    return `${k}: ${diff > 0 ? '+' : ''}${diff}`;
                })
                .filter(Boolean);
            if (deltas.length > 0) deltaText = `\n\nCambios vs reporte anterior:\n${deltas.join('\n')}`;
        }

        const body_md = `# ${title}\n\n${summary}${deltaText}\n\nGenerado automaticamente desde el Dashboard.`;

        const result = await pool.query(
            `INSERT INTO pm_reports (title, summary, body_md, metrics, risks, next_steps)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [title, summary, body_md, JSON.stringify(metrics), JSON.stringify(risks), JSON.stringify(nextSteps)]
        );
        await logAudit('pm_report', 'product', `PM Report generado: ${title}`, summary);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pm-reports/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM pm_reports WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INBOX
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/inbox', async (req, res) => {
    try {
        const { department, status, since } = req.query;
        let query = 'SELECT * FROM inbox_items';
        const conditions = [];
        const params = [];

        if (department) {
            params.push(department);
            conditions.push(`department = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }
        if (since) {
            params.push(since);
            conditions.push(`created_at >= $${params.length}`);
        }
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/inbox/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inbox item no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inbox', async (req, res) => {
    try {
        const { title, description, department } = req.body;
        const result = await pool.query(
            `INSERT INTO inbox_items (title, description, source, department, status)
             VALUES ($1, $2, 'dashboard', $3, 'chat') RETURNING *`,
            [title || 'Nueva idea', description || '', department || null]
        );
        await logAudit('inbox', department || 'general', `Inbox item creado: ${title}`, 'Creado desde dashboard');
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/inbox/:id', async (req, res) => {
    try {
        const { status, department, project_id, structured_data } = req.body;
        const sets = [];
        const params = [];

        if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
        if (department !== undefined) { params.push(department); sets.push(`department = $${params.length}`); }
        if (project_id !== undefined) { params.push(project_id); sets.push(`project_id = $${params.length}`); }
        if (structured_data !== undefined) { params.push(JSON.stringify(structured_data)); sets.push(`structured_data = $${params.length}`); }

        if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

        sets.push('updated_at = NOW()');
        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE inbox_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inbox item no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/inbox/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM inbox_items WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTATION AGENT — DOC AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/doc-audit/run', requireAuth, async (req, res) => {
    try {
        const { scope = 'all', mode = 'internal', prompt: userPrompt } = req.body;

        // 1. Build campaign inventory from DB
        const dbCampaigns = await pool.query(
            `SELECT id, name, status, type, description, updated_at FROM projects WHERE type = 'campaign' ORDER BY updated_at DESC LIMIT 50`
        );
        const campaignInventory = { mode, campaigns: dbCampaigns.rows, doc_index: [] };

        // 2. Call Claude to analyze and generate gap report
        const systemPrompt = `You are Marina, a Documentation Audit Agent for a marketing team.
Your job is to analyze campaign documentation coverage and produce a structured gap report.
For each campaign, assess:
- Whether documentation exists
- Whether KPIs, status, triggers, and audience specs are current
- The severity of any discrepancy (high/medium/low)
Return a JSON object with keys: coverage_score (0-100), outdated (array of {campaign, issue, severity}), missing (array of {campaign, reason}), summary (string).`;

        const userMessage = userPrompt
            ? `Audit scope: ${scope}. User context: ${userPrompt}\n\nCampaign inventory:\n${JSON.stringify(campaignInventory, null, 2)}`
            : `Audit all campaigns in scope: ${scope}.\n\nCampaign inventory:\n${JSON.stringify(campaignInventory, null, 2)}`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        const rawText = response.content[0].text;
        let auditResult;
        try {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            auditResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { coverage_score: 0, outdated: [], missing: [], summary: rawText };
        } catch {
            auditResult = { coverage_score: 0, outdated: [], missing: [], summary: rawText };
        }

        // 3. Post high/medium findings as inbox notifications
        const findings = [
            ...(auditResult.outdated || []).map(f => ({ ...f, type: 'outdated' })),
            ...(auditResult.missing || []).map(f => ({ ...f, type: 'missing' })),
        ].filter(f => f.severity === 'high' || f.severity === 'medium');

        for (const finding of findings) {
            await pool.query(
                `INSERT INTO inbox_items (title, description, source, department, status)
                 VALUES ($1, $2, 'agent', 'control', 'chat')`,
                [
                    `[Doc Audit] ${finding.campaign || 'Unknown'} — ${finding.type === 'outdated' ? 'Outdated' : 'Missing'} Doc`,
                    finding.issue || finding.reason || 'Documentation gap detected by Marina',
                ]
            );
        }

        // 4. Log to audit table
        await pool.query(
            `INSERT INTO audit_log (event_type, department, agent_id, title, details)
             VALUES ('system', 'control', 'doc-agent', $1, $2)`,
            [
                `Doc Audit completed — Coverage: ${auditResult.coverage_score}%`,
                `Outdated: ${(auditResult.outdated || []).length}, Missing: ${(auditResult.missing || []).length}`,
            ]
        );

        res.json({
            coverage_score: auditResult.coverage_score,
            outdated_count: (auditResult.outdated || []).length,
            missing_count: (auditResult.missing || []).length,
            inbox_notifications_created: findings.length,
            summary: auditResult.summary,
            details: auditResult,
        });

    } catch (err) {
        console.error('[DocAudit] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PM AGENT CHAT (SSE)
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/chat/pm-agent', async (req, res) => {
    try {
        const { inbox_item_id, message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // Load or create inbox item
        let item;
        if (inbox_item_id) {
            const itemRes = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [inbox_item_id]);
            if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Inbox item no encontrado' });
            item = itemRes.rows[0];
        } else {
            const newItem = await pool.query(
                `INSERT INTO inbox_items (title, source, status) VALUES ($1, 'dashboard', 'chat') RETURNING *`,
                [message ? message.substring(0, 80) : 'Nueva idea']
            );
            item = newItem.rows[0];
        }

        // Build conversation history + fetch project context in parallel
        const conversation = Array.isArray(item.conversation) ? [...item.conversation] : [];
        conversation.push({ role: 'user', content: message });

        const apiMessages = conversation.map(m => ({ role: m.role, content: m.content }));
        const [projectContext, ragResult] = await Promise.all([
            buildProjectContext(pool),
            isKBReady() ? buildRAGContext(pool, message, { namespaces: ['campaigns', 'kpis', 'research'] }) : { context: '', sources: [] },
        ]);

        // Append RAG context to project context
        const fullProjectContext = ragResult.context
            ? projectContext + '\n\n' + ragResult.context
            : projectContext;

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Inbox-Item-Id', item.id.toString());
        if (ragResult.sources.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources.map(({ htmlSource, ...s }) => s)));
        }
        res.flushHeaders();

        // Stream response
        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, { stream: true, projectContext: fullProjectContext });

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;

        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        // Persist conversation — status stays as 'chat', no auto-advance
        conversation.push({ role: 'assistant', content: fullResponse });

        await pool.query(
            `UPDATE inbox_items SET conversation = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(conversation), item.id]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// ─── POST /api/inbox/:id/to-borrador ─────────────────────────────────────────
app.post('/api/inbox/:id/to-borrador', async (req, res) => {
    try {
        const item = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const { conversation, status } = item.rows[0];
        if (status !== 'chat') {
            return res.status(400).json({ error: `Cannot create borrador from status '${status}'` });
        }
        if (!conversation || conversation.length === 0) {
            return res.status(400).json({ error: 'No conversation to summarize' });
        }

        console.log(`[to-borrador] Generating structured draft for item ${req.params.id} (${conversation.length} messages)...`);
        const projectContext = await buildProjectContext(pool);
        const draft = await generateDraft(conversation, projectContext);
        const summary = renderDraftSummary(draft);
        console.log(`[to-borrador] Draft generated: ${draft.project_name} (${draft.stages.length} stages)`);

        await pool.query(
            `UPDATE inbox_items
             SET summary = $1, structured_data = $2, status = 'borrador', updated_at = NOW()
             WHERE id = $3`,
            [summary, JSON.stringify(draft), req.params.id]
        );

        res.json({ id: parseInt(req.params.id), status: 'borrador', summary, structured_data: draft });
    } catch (err) {
        console.error('[to-borrador] Error:', err);
        res.status(500).json({ error: err.message || 'Unknown error' });
    }
});

// ─── POST /api/inbox/:id/to-proyecto ──────────────────────────────────────────
app.post('/api/inbox/:id/to-proyecto', async (req, res) => {
    try {
        const item = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const { title, summary, status, structured_data } = item.rows[0];
        if (status !== 'borrador') {
            return res.status(400).json({ error: `Cannot create project from status '${status}'` });
        }
        if (!summary) {
            return res.status(400).json({ error: 'No summary available' });
        }

        // Use edited draft from request body if provided, otherwise use stored draft
        const draft = req.body.structured_data || structured_data;

        // Generate project JSON from the draft summary
        const projectContext = await buildProjectContext(pool);
        const { text, json: projectData } = await generateProject(title, summary, projectContext);

        if (!projectData) {
            return res.status(500).json({ error: 'PM Agent did not generate valid project JSON', response: text });
        }

        // Atomic transaction: create project + pipeline + sessions
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create project (using shared client for atomicity)
            // Ensure project_name is never null — use draft name as fallback
            if (!projectData.project_name && draft?.project_name) {
                projectData.project_name = draft.project_name;
            }
            if (!projectData.project_name) {
                projectData.project_name = title || 'Untitled Project';
            }
            if (!projectData.problem && draft?.problem) projectData.problem = draft.problem;
            if (!projectData.solution && draft?.objective) projectData.solution = draft.objective;
            // Set department from first pipeline stage if available
            if (draft?.stages?.[0]?.department && !projectData.department) {
                projectData.department = draft.stages[0].department;
            }

            // Proyecto 007: Mix in extended details from draft
            if (draft) {
                if (draft.objective) projectData.objective = draft.objective;
                if (draft.target_audience) projectData.target_audience = draft.target_audience;
                if (draft.bau_type) projectData.bau_type = draft.bau_type;
                if (draft.markets) projectData.markets = draft.markets;
                if (draft.pm_notes) projectData.pm_notes = draft.pm_notes;
                if (draft.key_metrics) projectData.key_metrics = draft.key_metrics;
                if (draft.compliance_notes) projectData.compliance_notes = draft.compliance_notes;
                // Keep the timeline and risks if AI didn't overwrite it
                if (draft.estimated_timeline && (!projectData.estimated_timeline || projectData.estimated_timeline === 'TBD')) {
                    projectData.estimated_timeline = draft.estimated_timeline;
                }
                if (draft.risks && (!projectData.risks || projectData.risks.length === 0)) {
                    projectData.risks = draft.risks;
                }
            }

            const projectId = await saveProject(projectData, client);

            // 2. Create pipeline + stages + sessions if draft has stages
            let pipelineId = null;
            if (draft && draft.stages && draft.stages.length > 0) {
                const pipelineRes = await client.query(
                    `INSERT INTO project_pipeline (project_id, template_id, current_stage_order, status)
                     VALUES ($1, $2, 0, 'active') RETURNING id`,
                    [projectId, 'pm-draft']
                );
                pipelineId = pipelineRes.rows[0].id;

                // Insert stages
                for (let i = 0; i < draft.stages.length; i++) {
                    const s = draft.stages[i];
                    await client.query(
                        `INSERT INTO pipeline_stages (pipeline_id, stage_order, name, agent_id, department, description, depends_on, gate_type, namespaces)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            pipelineId, i, s.name, s.agent_id,
                            s.department || 'execution',
                            s.description || '',
                            s.depends_on || [],
                            s.gate_type || 'none',
                            s.namespaces || [],
                        ]
                    );
                }

                // Create agent sessions (stage 0 = active, rest = pending)
                for (let i = 0; i < draft.stages.length; i++) {
                    const s = draft.stages[i];
                    const sessionStatus = i === 0 ? 'active' : 'pending';
                    const startedAt = i === 0 ? 'NOW()' : 'NULL';
                    await client.query(
                        `INSERT INTO project_agent_sessions (project_id, pipeline_id, agent_id, stage_name, stage_order, status, started_at)
                         VALUES ($1, $2, $3, $4, $5, $6, ${startedAt})`,
                        [projectId, pipelineId, s.agent_id, s.name, i, sessionStatus]
                    );
                }

                // Generate phases from pipeline stages so Details tab isn't empty
                const existingPhases = await client.query('SELECT id FROM phases WHERE project_id = $1 LIMIT 1', [projectId]);
                if (existingPhases.rows.length === 0) {
                    for (let i = 0; i < draft.stages.length; i++) {
                        const s = draft.stages[i];
                        const phaseRes = await client.query(
                            `INSERT INTO phases (project_id, phase_number, name, objective)
                             VALUES ($1, $2, $3, $4) RETURNING id`,
                            [projectId, i + 1, s.name, s.description || '']
                        );
                        await client.query(
                            `INSERT INTO tasks (phase_id, description, status)
                             VALUES ($1, $2, 'Todo')`,
                            [phaseRes.rows[0].id, `Execute: ${s.name}`]
                        );
                    }
                }
            }

            // 3. Update inbox item
            await client.query(
                `UPDATE inbox_items
                 SET structured_data = $1, project_id = $2, status = 'proyecto', updated_at = NOW()
                 WHERE id = $3`,
                [JSON.stringify(draft || projectData), projectId, req.params.id]
            );

            await client.query('COMMIT');
            res.json({ id: parseInt(req.params.id), status: 'proyecto', project_id: projectId, pipeline_id: pipelineId });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('[to-proyecto] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/inbox/:id/reopen ───────────────────────────────────────────────
app.post('/api/inbox/:id/reopen', async (req, res) => {
    try {
        const item = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const { status } = item.rows[0];
        if (status !== 'borrador') {
            return res.status(400).json({ error: `Cannot reopen from status '${status}'` });
        }

        await pool.query(
            `UPDATE inbox_items
             SET status = 'chat', summary = NULL, structured_data = NULL, updated_at = NOW()
             WHERE id = $1`,
            [req.params.id]
        );

        res.json({ id: parseInt(req.params.id), status: 'chat' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/inbox/:id/update-draft ────────────────────────────────────────
app.post('/api/inbox/:id/update-draft', async (req, res) => {
    try {
        const item = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        if (item.rows[0].status !== 'borrador') {
            return res.status(400).json({ error: 'Can only update draft in borrador status' });
        }

        const { structured_data } = req.body;
        if (!structured_data || !Array.isArray(structured_data.stages) || structured_data.stages.length === 0) {
            return res.status(400).json({ error: 'Invalid draft: must have stages array' });
        }

        const summary = renderDraftSummary(structured_data);

        await pool.query(
            `UPDATE inbox_items
             SET structured_data = $1, summary = $2, updated_at = NOW()
             WHERE id = $3`,
            [JSON.stringify(structured_data), summary, req.params.id]
        );

        res.json({ id: parseInt(req.params.id), structured_data, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT CHAT (per-agent personal chat, SSE)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/agents/:id/conversation — load existing conversation
app.get('/api/agents/:id/conversation', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT messages FROM agent_conversations WHERE agent_id = $1',
            [req.params.id]
        );
        res.json({ messages: result.rows.length > 0 ? result.rows[0].messages : [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/agents/:id/conversation — clear conversation history
app.delete('/api/agents/:id/conversation', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM agent_conversations WHERE agent_id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/agents/generate-image — Generate an image from a prompt using AI
app.post('/api/agents/generate-image', async (req, res) => {
    try {
        const { prompt, size } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        // Use Claude to generate an SVG illustration based on the prompt
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: `You are an expert SVG illustrator for marketing emails. Generate a clean, modern SVG image based on this prompt: "${prompt}". The SVG should be sized ${size || '1200x628'}. Return ONLY the raw SVG code, nothing else. No markdown, no explanation. Use a premium, elegant color palette suitable for luxury branding. Keep the design simple and impactful.` }],
        });

        const svgContent = response.content[0]?.text || '';
        const svgMatch = svgContent.match(/<svg[\s\S]*<\/svg>/i);

        if (!svgMatch) {
            return res.json({ url: null, svg: null, message: 'Could not generate image' });
        }

        // Return the SVG as a data URI
        const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svgMatch[0]).toString('base64')}`;
        res.json({ url: svgDataUri, svg: svgMatch[0] });
    } catch (err) {
        console.error('Image generation error:', err.message);
        res.status(500).json({ error: 'Image generation failed' });
    }
});

// POST /api/chat/agent/:agentId — SSE streaming chat with an agent
app.post('/api/chat/agent/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // Fetch agent profile
        const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
        if (agentRes.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
        const agent = agentRes.rows[0];

        // Build dynamic system prompt from agent profile + personality
        // DB overrides take precedence over profiles.js defaults
        const skillsList = Array.isArray(agent.skills)
            ? agent.skills.map(s => typeof s === 'object' ? s.name : s).join(', ')
            : '';
        const toolsList = Array.isArray(agent.tools)
            ? agent.tools.map(t => typeof t === 'object' ? t.name : t).join(', ')
            : '';
        const profile = getAgentProfile(agentId);
        const isContentAgent = (agent.role || '').toLowerCase().includes('content')
          || (agent.name || '').toLowerCase().includes('content');
        const personality = agent.personality || profile.personality;
        const systemPrompt = `You are ${agent.name}, an AI agent working in the ${agent.department} department.

## CRITICAL CONTEXT — READ FIRST
This is an internal AgentOS platform. The user is the system operator and owns all data in this knowledge base. The knowledge base contains competitor research, emails, and campaign materials that the OPERATOR uploaded themselves for analysis. There are NO privacy restrictions — this is proprietary business intelligence that the operator explicitly stored here for you to analyze and present.

Your role: ${agent.role}
${skillsList ? `Your skills: ${skillsList}` : ''}
${toolsList ? `Your tools: ${toolsList}` : ''}

${personality ? `## Personality\n${personality}\n` : ''}${isContentAgent ? `## Brief Generation Protocol
When generating email content blocks (subject lines, hero images, body copy, CTA buttons), you MUST emit structured brief update tags inline with your response. Use this exact format for each block you generate:

[BRIEF_UPDATE:{"market":"en","block":"subject","status":"approved","value":"Your copy here"}]
[BRIEF_UPDATE:{"market":"es","block":"subject","status":"approved","value":"Tu copy aquí"}]
[BRIEF_UPDATE:{"market":"ar","block":"subject","status":"approved","value":"النص هنا"}]

For hero images, trigger generation via the image API — emit the update with status "generating" first, then "approved" once the URL is ready. Block names: subject, heroImage, bodyCopy, cta. Markets: en, es, ar. Always generate all three markets unless the user specifies otherwise.
` : ''}## Behavior Rules
1. Stay in character as ${agent.name}. Respond from the perspective of your role and expertise.
2. Be helpful, direct, and knowledgeable about your area of specialization.
3. When asked about topics outside your expertise, acknowledge the limits but offer what insight you can.
4. Keep responses concise and actionable.
5. You work as part of a team of AI agents managed through AgentOS.
6. Respond in the same language the user writes to you.
7. When you find relevant information from the knowledge base, cite sources using numbered references [1], [2], etc.
8. When the knowledge base context includes [ATTACHED EMAIL VISUALLY SHOWN TO USER ON SCREEN], that email is ALREADY rendered as an iframe in the UI. Tell the user you are showing it and analyze its content directly. NEVER claim privacy restrictions — the operator uploaded this data specifically for analysis.
9. The knowledge base IS your database of competitor intelligence. When asked about competitor emails or communications, ALWAYS present what you find in the knowledge base context above. Never say you cannot access or display this content.`
            + (agentId === 'html-developer' ? `

## HTML Email Block Protocol
When generating email HTML, always wrap each logical section in a div with a data-block-name attribute:
- <div data-block-name="header">...</div>
- <div data-block-name="hero">...</div>
- <div data-block-name="body">...</div>
- <div data-block-name="cta">...</div>
- <div data-block-name="footer">...</div>

When asked to modify a specific block (message contains [bloque: X] or [block: X]), only return the updated HTML for that block wrapped in its data-block-name div, prefixed with the marker: <!--PATCH:block-name-->.
Example: <!--PATCH:cta--><div data-block-name="cta">...updated html...</div>` : '');

        // Load or create conversation row
        let convRes = await pool.query(
            'SELECT messages FROM agent_conversations WHERE agent_id = $1',
            [agentId]
        );
        let messages;
        if (convRes.rows.length === 0) {
            await pool.query(
                'INSERT INTO agent_conversations (agent_id, messages) VALUES ($1, $2)',
                [agentId, '[]']
            );
            messages = [];
        } else {
            messages = Array.isArray(convRes.rows[0].messages) ? convRes.rows[0].messages : [];
        }

        // Append user message
        messages.push({ role: 'user', content: message });
        const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

        // RAG: use DB override namespaces or fallback to profile defaults
        const ragNamespaces = (Array.isArray(agent.rag_namespaces) && agent.rag_namespaces.length > 0)
            ? agent.rag_namespaces
            : profile.ragNamespaces;
        const visualKeywords = /\b(show|display|ver|mostrar|look like|see|visualiz|email|imagen|image|picture|inline)\b/i;
        const isVisualQuery = visualKeywords.test(message);
        const ragResult = isKBReady()
            ? await buildRAGContext(pool, message, { namespaces: ragNamespaces, visualQuery: isVisualQuery, maxTokens: isVisualQuery ? 4000 : 3000, maxMedia: isVisualQuery ? 4 : 2 })
            : { context: '', sources: [] };

        const finalSystemPrompt = ragResult.context
            ? systemPrompt + '\n\n' + ragResult.context
            : systemPrompt;

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources.length > 0) {
            // Strip htmlSource from the header — it's too large for HTTP headers; sent as SSE event below
            const sourcesForHeader = ragResult.sources.map(({ htmlSource, ...s }) => s);
            res.setHeader('X-RAG-Sources', JSON.stringify(sourcesForHeader));
        }
        if (ragResult.mediaResults?.length > 0) {
            // Strip htmlSource from header — too large; email_html sent as SSE event below
            const mediaForHeader = ragResult.mediaResults.filter(m => m.mediaType !== 'email_html').map(({ htmlSource, ...m }) => m);
            if (mediaForHeader.length > 0) res.setHeader('X-RAG-Media', JSON.stringify(mediaForHeader));
        }
        res.flushHeaders();

        // Send email html as first SSE event (headers can't carry large HTML payloads)
        const htmlFromSources = ragResult.sources?.filter(s => s.htmlSource) || [];
        const htmlFromMedia = ragResult.mediaResults?.filter(m => m.mediaType === 'email_html' && m.htmlSource) || [];
        const allHtmlItems = [...htmlFromSources, ...htmlFromMedia].filter((m, i, arr) => arr.findIndex(x => x.title === m.title) === i);
        if (allHtmlItems.length > 0) {
            res.write(`data: ${JSON.stringify({ html_sources: allHtmlItems.map(s => ({ htmlSource: s.htmlSource, title: s.title || s.documentTitle, filePath: s.filePath })) })}\n\n`);
        }

        // Stream response via chatWithPMAgent with systemPromptOverride
        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, {
            stream: true,
            systemPromptOverride: finalSystemPrompt,
        });

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;

        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        // Persist conversation
        messages.push({ role: 'assistant', content: fullResponse });
        await pool.query(
            'UPDATE agent_conversations SET messages = $1, updated_at = NOW() WHERE agent_id = $2',
            [JSON.stringify(messages), agentId]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS CHAT (SSE) — Emirates lifecycle campaign assistant
// ═══════════════════════════════════════════════════════════════════════════════

const CAMPAIGN_CONTEXT = {
    'cart-abandon': { name: 'Cart Abandon', group: 'Abandon & Recovery', description: 'Triggered when a Skywards member abandons a flight booking in checkout.', trigger: 'Cart abandonment event from booking engine', audience: 'Skywards members who started checkout but did not complete', agents: ['Raul', 'Andres', 'Lucia', 'Diego'], kpis: { sends: 142300, openRate: 38.4, clickRate: 11.2, conversionRate: 4.8 } },
    'search-abandon': { name: 'Search Abandon', group: 'Abandon & Recovery', description: 'Targets users who searched for flights but never started checkout.', trigger: 'Flight search without booking within 24h', audience: 'Logged-in users who searched routes', agents: ['Diego', 'Lucia', 'Andres'], kpis: { sends: 289400, openRate: 28.6, clickRate: 6.3, conversionRate: 1.9 } },
    'miles-abandon': { name: 'Miles Abandon', group: 'Abandon & Recovery', description: 'Triggered when a member starts a miles redemption flow but does not complete.', trigger: 'Miles redemption flow abandoned', audience: 'Skywards members who started miles redemption', agents: ['Valentina', 'Andres', 'Lucia'], kpis: { sends: 45600, openRate: 42.1, clickRate: 14.3, conversionRate: 6.2 } },
    'churn': { name: 'Churn', group: 'Abandon & Recovery', description: 'Win-back campaign for members inactive 12+ months.', trigger: 'No flight or engagement in 12 months', audience: 'Inactive Skywards members', agents: ['Valentina', 'Diego', 'Lucia', 'Carlos'], kpis: { sends: 198700, openRate: 18.3, clickRate: 3.1, conversionRate: 0.8 } },
    'preflight-ancillary': { name: 'Preflight Ancillary', group: 'Pre-Flight Journey', description: 'Upsell ancillary products before departure.', trigger: 'Booking confirmed, 72h before departure', audience: 'All confirmed passengers', agents: ['Lucia', 'Diego', 'Carlos', 'Martina'], kpis: { sends: 412000, openRate: 52.3, clickRate: 18.7, conversionRate: 8.4 } },
    'preflight-beforeyoufly': { name: 'Preflight BeforeYouFly', group: 'Pre-Flight Journey', description: 'Informational email with travel checklist.', trigger: '7 days before departure', audience: 'All confirmed passengers', agents: ['Lucia', 'Sofia', 'Martina'], kpis: { sends: 387500, openRate: 68.2, clickRate: 22.4, conversionRate: 0 } },
    'preflight-experience': { name: 'Preflight Experience', group: 'Pre-Flight Journey', description: 'Premium experience preview for Business and First Class.', trigger: '48h before departure for premium cabin', audience: 'Business and First Class passengers', agents: ['Lucia', 'Sofia', 'Diego'], kpis: { sends: 67800, openRate: 71.5, clickRate: 28.9, conversionRate: 0 } },
    'preflight-upgrades': { name: 'Preflight Upgrades', group: 'Pre-Flight Journey', description: 'Targeted upgrade offers using bid-based pricing.', trigger: '5 days before departure', audience: 'Economy/Business passengers with upgrade availability', agents: ['Diego', 'Lucia', 'Carlos'], kpis: { sends: 156200, openRate: 45.8, clickRate: 15.6, conversionRate: 3.2 } },
    'postflight': { name: 'Postflight', group: 'Post-Flight Engagement', description: 'Post-flight feedback and NPS survey.', trigger: '24h after flight arrival', audience: 'All passengers who completed a flight', agents: ['Carlos', 'Lucia', 'Andres'], kpis: { sends: 523000, openRate: 34.7, clickRate: 12.8, conversionRate: 0 } },
    'postflight-acquisition': { name: 'Postflight Acquisition', group: 'Post-Flight Engagement', description: 'Skywards enrollment offer for non-members post-flight.', trigger: 'Flight completed by non-Skywards passenger', audience: 'Non-Skywards passengers after first flight', agents: ['Valentina', 'Lucia', 'Diego'], kpis: { sends: 178900, openRate: 29.4, clickRate: 8.7, conversionRate: 5.1 } },
    'postflight-skywards': { name: 'Postflight Skywards', group: 'Post-Flight Engagement', description: 'Miles earned summary and next-tier progress update.', trigger: 'Miles credited to Skywards account', audience: 'Skywards members after miles credit', agents: ['Valentina', 'Carlos', 'Lucia'], kpis: { sends: 445200, openRate: 48.6, clickRate: 16.2, conversionRate: 0 } },
    'welcome-to-tier': { name: 'Welcome To Tier', group: 'Loyalty & Tiers', description: 'Congratulatory email when a member achieves a new tier.', trigger: 'Tier upgrade event', audience: 'Members who just achieved a new tier', agents: ['Valentina', 'Lucia', 'Sofia'], kpis: { sends: 89300, openRate: 72.4, clickRate: 31.2, conversionRate: 0 } },
    'welcome-to-tier-centralized': { name: 'Welcome to Tier Centralized', group: 'Loyalty & Tiers', description: 'Centralized version for multi-market consistency.', trigger: 'Tier upgrade event (centralized)', audience: 'Members across all markets', agents: ['Valentina', 'Lucia', 'Sofia', 'Javier'], kpis: { sends: 67200, openRate: 70.1, clickRate: 29.4, conversionRate: 0 } },
    'welcome-to-tier-enhancement': { name: 'Welcome to Tier Enhancement', group: 'Loyalty & Tiers', description: 'Follow-up deep-dive into tier benefits.', trigger: '7 days after tier upgrade', audience: 'Recently upgraded tier members', agents: ['Lucia', 'Valentina', 'Sofia'], kpis: { sends: 82100, openRate: 54.3, clickRate: 22.1, conversionRate: 0 } },
    'tier-review': { name: 'Tier Review', group: 'Loyalty & Tiers', description: 'Annual tier review notification.', trigger: 'Annual tier review cycle', audience: 'All Skywards members during review', agents: ['Valentina', 'Carlos', 'Lucia', 'Diego'], kpis: { sends: 312000, openRate: 58.7, clickRate: 19.3, conversionRate: 0 } },
    'miles-expiry': { name: 'Miles Expiry', group: 'Loyalty & Tiers', description: 'Warning sequence for expiring Skywards Miles.', trigger: 'Miles expiry date approaching', audience: 'Members with miles expiring within 90 days', agents: ['Valentina', 'Lucia', 'Andres', 'Diego'], kpis: { sends: 256800, openRate: 51.2, clickRate: 18.6, conversionRate: 7.3 } },
    'milestone': { name: 'MileStone', group: 'Loyalty & Tiers', description: 'Celebrates member milestones.', trigger: 'Milestone achievement event', audience: 'Members reaching defined milestones', agents: ['Valentina', 'Lucia', 'Sofia'], kpis: { sends: 34500, openRate: 76.8, clickRate: 28.4, conversionRate: 0 } },
    'skywards-plus': { name: 'Skywards Plus', group: 'Loyalty & Tiers', description: 'Promotion of Skywards+ subscription.', trigger: 'Qualification criteria met', audience: 'Eligible frequent flyers', agents: ['Valentina', 'Lucia', 'Diego'], kpis: { sends: 98400, openRate: 35.6, clickRate: 9.8, conversionRate: 2.1 } },
    'buygiftmiles': { name: 'BuyGiftMiles', group: 'Loyalty & Tiers', description: 'Promotional campaigns for buying or gifting Skywards Miles.', trigger: 'Promotional calendar or low-balance trigger', audience: 'Skywards members with active accounts', agents: ['Lucia', 'Martina', 'Carlos'], kpis: { sends: 345000, openRate: 24.3, clickRate: 5.6, conversionRate: 1.4 } },
    'buygiftmiles-centralized': { name: 'BuyGiftMiles Centralized', group: 'Loyalty & Tiers', description: 'Centralized version for multi-market deployment. Currently in testing.', trigger: 'Same as BuyGiftMiles (centralized)', audience: 'Skywards members across all markets', agents: ['Lucia', 'Javier', 'Elena'], kpis: { sends: 0, openRate: 0, clickRate: 0, conversionRate: 0 } },
    'onboarding': { name: 'Onboarding', group: 'Onboarding', description: 'Welcome series for new Skywards members.', trigger: 'New Skywards enrollment', audience: 'New Skywards members (first 30 days)', agents: ['Valentina', 'Lucia', 'Andres', 'Diego'], kpis: { sends: 234500, openRate: 56.3, clickRate: 19.7, conversionRate: 3.8 } },
    'onboarding-centralized': { name: 'Onboarding Centralized', group: 'Onboarding', description: 'Centralized onboarding for multi-market consistency.', trigger: 'New enrollment (centralized)', audience: 'New Skywards members in all markets', agents: ['Valentina', 'Lucia', 'Sofia', 'Javier'], kpis: { sends: 189200, openRate: 53.8, clickRate: 17.4, conversionRate: 3.2 } },
    'onboarding-centralized-ebase': { name: 'Onboarding Centralized Ebase', group: 'Onboarding', description: 'EBase-specific onboarding flow.', trigger: 'EBase enrollment event', audience: 'Members enrolled via partner/EBase channels', agents: ['Valentina', 'Andres', 'Lucia'], kpis: { sends: 67800, openRate: 44.2, clickRate: 12.1, conversionRate: 2.4 } },
    'early-activation': { name: 'Early Activation', group: 'Onboarding', description: 'Activation nudge for new members with no activity.', trigger: '14 days post-enrollment with no activity', audience: 'New members with no booking or app login', agents: ['Valentina', 'Lucia', 'Diego', 'Andres'], kpis: { sends: 112300, openRate: 38.9, clickRate: 10.4, conversionRate: 2.1 } },
    'ebase-registration': { name: 'EBase Registration', group: 'Onboarding', description: 'Registration confirmation for EBase platform users.', trigger: 'EBase registration event', audience: 'New EBase registrants', agents: ['Andres', 'Lucia'], kpis: { sends: 45600, openRate: 62.1, clickRate: 24.3, conversionRate: 0 } },
    'statement-email': { name: 'Statement Email', group: 'Communications', description: 'Monthly Skywards account statement.', trigger: 'Monthly cycle (1st of each month)', audience: 'All active Skywards members', agents: ['Valentina', 'Carlos', 'Lucia'], kpis: { sends: 890000, openRate: 42.5, clickRate: 8.3, conversionRate: 0 } },
    'statement-centralized': { name: 'Statement Centralized', group: 'Communications', description: 'Centralized statement for multi-market.', trigger: 'Monthly cycle (centralized)', audience: 'Skywards members across all markets', agents: ['Valentina', 'Carlos', 'Javier'], kpis: { sends: 670000, openRate: 40.1, clickRate: 7.8, conversionRate: 0 } },
    'featured-fares': { name: 'Featured Fares', group: 'Communications', description: 'Weekly promotional fares email.', trigger: 'Weekly promotional calendar', audience: 'All opted-in Skywards members', agents: ['Lucia', 'Diego', 'Martina'], kpis: { sends: 1230000, openRate: 22.8, clickRate: 4.6, conversionRate: 0.9 } },
    'paid-lounge': { name: 'Paid Lounge', group: 'Communications', description: 'Promotion of paid lounge access for Economy passengers.', trigger: '48h before departure', audience: 'Economy passengers on routes with lounge availability', agents: ['Lucia', 'Diego'], kpis: { sends: 234500, openRate: 31.4, clickRate: 9.2, conversionRate: 3.6 } },
    'email-digital-brief-system': { name: 'Email Digital Brief System', group: 'Communications', description: 'Internal system for managing email creative briefs.', trigger: 'Campaign brief submission', audience: 'Internal marketing team', agents: ['Guillermo', 'Sofia', 'Javier', 'Elena'], kpis: { sends: 1200, openRate: 89.4, clickRate: 45.2, conversionRate: 0 } },
    'incident-solution': { name: 'Incident Solution', group: 'Communications', description: 'Automated response emails for flight disruptions.', trigger: 'Flight disruption event (IRROPS)', audience: 'Affected passengers', agents: ['Andres', 'Lucia', 'Sofia', 'Javier'], kpis: { sends: 78900, openRate: 82.3, clickRate: 34.1, conversionRate: 0 } },
    'archive': { name: 'Archive', group: 'Communications', description: 'System campaign for archiving inactive email addresses.', trigger: 'Email bounce or unsubscribe event', audience: 'Inactive or bounced email addresses', agents: ['Andres', 'Elena'], kpis: { sends: 45200, openRate: 0, clickRate: 0, conversionRate: 0 } },
};

function buildCampaignSystemPrompt(ctx) {
    return `You are the Emirates AMI Campaign Intelligence Assistant, an AI specialized in Emirates Airlines' CRM and email marketing operations.

## Current Campaign Context
Campaign Name: ${ctx.name}
Category: ${ctx.group}
Description: ${ctx.description}
Trigger: ${ctx.trigger}
Target Audience: ${ctx.audience}
Responsible Agents: ${ctx.agents.join(', ')}

## Performance KPIs
- Sends: ${ctx.kpis.sends.toLocaleString()}
- Open Rate: ${ctx.kpis.openRate}%
- Click Rate: ${ctx.kpis.clickRate}%
- Conversion Rate: ${ctx.kpis.conversionRate}%

## Industry Benchmarks (Travel/Airline Email)
- Average Open Rate: 21.3%
- Average Click Rate: 3.8%
- Average Conversion Rate: 1.2%

## Your Role
You are helping a marketing operations manager discuss, analyze, and improve this specific campaign. You have deep knowledge of:
- Emirates Skywards loyalty program mechanics (Blue, Silver, Gold, Platinum tiers)
- Salesforce Marketing Cloud (Journey Builder, Email Studio, Audience Builder, Data Extensions)
- Email marketing best practices and deliverability optimization
- GDPR, CAN-SPAM, and UAE data protection regulations
- The agents involved in this campaign's workflow

## Emirates Campaign Ecosystem
This campaign is part of Emirates' lifecycle marketing program with 31 triggered campaigns across 6 categories: Abandon & Recovery, Pre-Flight Journey, Post-Flight Engagement, Loyalty & Tiers, Onboarding, and Communications.

## Behavior Rules
1. Keep answers focused on this specific campaign unless the user explicitly asks to compare others.
2. Reference the KPIs above when discussing performance. Compare against industry benchmarks.
3. Be specific and actionable — suggest concrete copy changes, timing adjustments, segmentation logic, or A/B test ideas.
4. When discussing agent involvement, reference the agents listed above by name and explain their role.
5. Respond in the same language the user writes in.
6. Keep responses concise but substantive. Use bullet points and structure.
7. If asked about technical implementation, reference SFMC components (Journey Builder, AMPscript, Content Blocks).`;
}

app.post('/api/chat/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const ctx = CAMPAIGN_CONTEXT[campaignId];
        if (!ctx) return res.status(404).json({ error: 'Campaign not found' });

        // Load or create persistent conversation
        let convRes = await pool.query(
            'SELECT messages FROM campaign_conversations WHERE campaign_id = $1',
            [campaignId]
        );
        let messages;
        if (convRes.rows.length === 0) {
            await pool.query(
                'INSERT INTO campaign_conversations (campaign_id, messages) VALUES ($1, $2)',
                [campaignId, '[]']
            );
            messages = [];
        } else {
            messages = Array.isArray(convRes.rows[0].messages) ? convRes.rows[0].messages : [];
        }

        messages.push({ role: 'user', content: message });

        // RAG: search with campaign filter
        const ragResult = isKBReady()
            ? await buildRAGContext(pool, message, {
                namespaces: ['campaigns', 'emails', 'kpis'],
                filter: { campaign_id: { $eq: campaignId } },
            })
            : { context: '', sources: [] };

        const basePrompt = buildCampaignSystemPrompt(ctx);
        const systemPrompt = ragResult.context
            ? basePrompt + '\n\n' + ragResult.context
            : basePrompt;

        const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources.map(({ htmlSource, ...s }) => s)));
        }
        res.flushHeaders();

        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, {
            stream: true,
            systemPromptOverride: systemPrompt,
        });

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;

        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        // Persist conversation
        messages.push({ role: 'assistant', content: fullResponse });
        await pool.query(
            'UPDATE campaign_conversations SET messages = $1, updated_at = NOW() WHERE campaign_id = $2',
            [JSON.stringify(messages), campaignId]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// GET /api/campaigns/:campaignId/conversation — Load campaign chat
app.get('/api/campaigns/:campaignId/conversation', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT messages FROM campaign_conversations WHERE campaign_id = $1',
            [req.params.campaignId]
        );
        res.json({ messages: result.rows.length > 0 ? result.rows[0].messages : [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/campaigns/:campaignId/conversation — Clear campaign chat
app.delete('/api/campaigns/:campaignId/conversation', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'UPDATE campaign_conversations SET messages = $1, updated_at = NOW() WHERE campaign_id = $2',
            ['[]', req.params.campaignId]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/agents/:id/conversation — clear conversation
app.delete('/api/agents/:id/conversation', async (req, res) => {
    try {
        await pool.query(
            'UPDATE agent_conversations SET messages = $1, updated_at = NOW() WHERE agent_id = $2',
            ['[]', req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/stats — totals: runs, completed, failed, active, last_run_at
app.get('/api/workflows/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*)::int AS total_runs,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'running')::int AS active,
                MAX(started_at) AS last_run_at
            FROM workflow_runs
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/workflows/runs — list runs, optional filters: workflow_id, status, limit
app.get('/api/workflows/runs', async (req, res) => {
    try {
        const { workflow_id, status, limit } = req.query;
        let query = 'SELECT * FROM workflow_runs WHERE 1=1';
        const params = [];

        if (workflow_id) {
            params.push(workflow_id);
            query += ` AND workflow_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ' ORDER BY started_at DESC';

        const lim = parseInt(limit) || 50;
        params.push(lim);
        query += ` LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/workflows/runs — create a run
app.post('/api/workflows/runs', async (req, res) => {
    try {
        const { workflow_id, triggered_by = 'user', prompt = null, project_id = null } = req.body;
        if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

        const metadata = project_id ? JSON.stringify({ project_id }) : '{}';

        // Create workflow run as pending (external tools handle execution)
        const result = await pool.query(
            `INSERT INTO workflow_runs (workflow_id, status, triggered_by, prompt, metadata)
             VALUES ($1, 'pending', $2, $3, $4) RETURNING *`,
            [workflow_id, triggered_by, prompt, metadata]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/workflows/runs/:id — update run status manually
app.patch('/api/workflows/runs/:id', async (req, res) => {
    try {
        const { status, output_summary, error: errorMsg } = req.body;
        const fields = [];
        const params = [];

        if (status) {
            params.push(status);
            fields.push(`status = $${params.length}`);
            if (status === 'completed' || status === 'failed') {
                fields.push(`completed_at = NOW()`);
                fields.push(`duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::int * 1000`);
            }
        }
        if (output_summary !== undefined) {
            params.push(output_summary);
            fields.push(`output_summary = $${params.length}`);
        }
        if (errorMsg !== undefined) {
            params.push(errorMsg);
            fields.push(`error = $${params.length}`);
        }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE workflow_runs SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Run not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Workspace Config ────────────────────────────────────────────────────────

app.get('/api/settings/workspace', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT key, value FROM workspace_config WHERE key IN ('workspace_name', 'workspace_description')"
        );
        const config = {};
        result.rows.forEach(r => { config[r.key] = r.value; });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings/workspace', requireOwnerOrAdmin, async (req, res) => {
    try {
        const { workspace_name, workspace_description } = req.body;
        for (const [key, value] of Object.entries({ workspace_name, workspace_description })) {
            if (value !== undefined) {
                await pool.query(
                    `INSERT INTO workspace_config (key, value, updated_at) VALUES ($1, $2, NOW())
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                    [key, JSON.stringify(value)]
                );
            }
        }
        await logAudit('system', null, 'Workspace settings updated', `Updated by ${req.session.userEmail}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Departments Config ──────────────────────────────────────────────────────

app.get('/api/settings/departments', async (req, res) => {
    res.json(DEPT_META);
});

app.put('/api/settings/departments', requireOwnerOrAdmin, async (req, res) => {
    try {
        const departments = req.body;
        await pool.query(
            `INSERT INTO workspace_config (key, value, updated_at) VALUES ('departments', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(departments)]
        );
        DEPT_META = departments;
        await logAudit('system', null, 'Departments updated', `${Object.keys(departments).length} departments by ${req.session.userEmail}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API Keys (encrypted) ───────────────────────────────────────────────────

app.get('/api/settings/api-keys', requireOwnerOrAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM workspace_config WHERE key = 'api_keys'");
        if (result.rows.length === 0) return res.json({ anthropic: null });
        const stored = result.rows[0].value;
        const masked = {};
        for (const [k, v] of Object.entries(stored)) {
            if (v) {
                try {
                    const decrypted = decryptValue(v);
                    masked[k] = '••••' + decrypted.slice(-4);
                } catch {
                    masked[k] = '••••(error)';
                }
            } else {
                masked[k] = null;
            }
        }
        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings/api-keys', requireOwnerOrAdmin, async (req, res) => {
    try {
        const allowedKeys = ['anthropic', 'gemini', 'pinecone_api_key', 'pinecone_environment', 'pinecone_index', 'confluence_url', 'confluence_token', 'jira_url', 'jira_email', 'jira_token', 'jira_project_key'];
        // Load existing encrypted keys to merge
        const existing = {};
        const prev = await pool.query("SELECT value FROM workspace_config WHERE key = 'api_keys'");
        if (prev.rows.length > 0) Object.assign(existing, prev.rows[0].value);
        // Encrypt only the keys sent in this request, merge with existing
        for (const k of allowedKeys) {
            if (req.body[k]) existing[k] = encryptValue(req.body[k]);
        }
        await pool.query(
            `INSERT INTO workspace_config (key, value, updated_at) VALUES ('api_keys', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(existing)]
        );
        await logAudit('system', null, 'API keys updated', `Updated by ${req.session.userEmail}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── User Management ─────────────────────────────────────────────────────────

app.get('/api/settings/users', requireOwnerOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, name, role, created_at FROM workspace_users ORDER BY created_at'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings/users', requireOwnerOrAdmin, async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const validRoles = ['admin', 'member'];
        const userRole = validRoles.includes(role) ? role : 'member';
        const hash = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'INSERT INTO workspace_users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
            [email, hash, name || email.split('@')[0], userRole]
        );
        await logAudit('system', null, 'User created', `${email} (${userRole}) by ${req.session.userEmail}`);
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/settings/users/:id', requireOwnerOrAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['owner', 'admin', 'member'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        // Prevent removing the last owner
        const targetUser = await pool.query('SELECT role FROM workspace_users WHERE id = $1', [req.params.id]);
        if (targetUser.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        if (targetUser.rows[0].role === 'owner' && role !== 'owner') {
            const owners = await pool.query("SELECT COUNT(*) FROM workspace_users WHERE role = 'owner' AND id != $1", [req.params.id]);
            if (parseInt(owners.rows[0].count) === 0) {
                return res.status(400).json({ error: 'Cannot remove the last owner' });
            }
        }
        const result = await pool.query(
            'UPDATE workspace_users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role',
            [role, req.params.id]
        );
        await logAudit('system', null, 'User role changed', `${result.rows[0].email} → ${role} by ${req.session.userEmail}`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/settings/users/:id', requireOwnerOrAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const result = await pool.query(
            'DELETE FROM workspace_users WHERE id = $1 RETURNING id, email', [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        await logAudit('system', null, 'User deleted', `${result.rows[0].email} by ${req.session.userEmail}`);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────

// Auto-create agent_conversations table if missing
pool.query(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        messages JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (agent_id)
    );
`).catch(err => console.warn('[startup] agent_conversations:', err.message));

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE UNIFIED STATUS + COMPARISON + ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

// PATCH /api/pipeline/:type/:id/status — Update status of any pipeline item
app.patch('/api/pipeline/:type/:id/status', requireAuth, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'status is required' });

        const tableMap = {
            project: { table: 'projects', valid: ['Planning', 'In Progress', 'Completed', 'Paused'] },
            email_proposal: { table: 'email_proposals', valid: ['draft', 'review', 'approved', 'rejected'] },
            research_session: { table: 'research_sessions', valid: ['queued', 'researching', 'synthesizing', 'completed', 'failed'] },
            experiment: { table: 'campaign_experiments', valid: ['proposed', 'approved', 'running', 'completed', 'cancelled'] },
        };

        const config = tableMap[type];
        if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });
        if (!config.valid.includes(status)) return res.status(400).json({ error: `Invalid status for ${type}: ${status}. Valid: ${config.valid.join(', ')}` });

        await pool.query(`UPDATE ${config.table} SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
        res.json({ ok: true, type, id: parseInt(id), status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/activity/recent — Recent activity feed across all types
app.get('/api/activity/recent', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 15;

        const activities = [];

        // Recent email proposals
        const emails = await pool.query(
            `SELECT id, variant_name, campaign_id, status, updated_at, 'email_proposal' as type FROM email_proposals ORDER BY updated_at DESC LIMIT $1`, [limit]
        );
        for (const e of emails.rows) {
            activities.push({ type: 'email_proposal', id: e.id, title: `Email "${e.variant_name}" — ${e.status}`, status: e.status, campaign_id: e.campaign_id, timestamp: e.updated_at });
        }

        // Recent research sessions
        const research = await pool.query(
            `SELECT id, title, status, updated_at, 'research_session' as type FROM research_sessions ORDER BY updated_at DESC LIMIT $1`, [limit]
        );
        for (const r of research.rows) {
            activities.push({ type: 'research_session', id: r.id, title: `Research "${r.title}" — ${r.status}`, status: r.status, timestamp: r.updated_at });
        }

        // Recent experiments
        const experiments = await pool.query(
            `SELECT id, experiment_type, hypothesis, status, winner, improvement_pct, updated_at, 'experiment' as type FROM campaign_experiments ORDER BY updated_at DESC LIMIT $1`, [limit]
        );
        for (const x of experiments.rows) {
            const detail = x.winner ? ` — Winner: ${x.winner}${x.improvement_pct ? ` (+${x.improvement_pct}%)` : ''}` : '';
            activities.push({ type: 'experiment', id: x.id, title: `Experiment [${x.experiment_type}] ${x.status}${detail}`, status: x.status, timestamp: x.updated_at });
        }

        // Sort by timestamp descending, take top N
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json({ activities: activities.slice(0, limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pipeline/counts — Counts by type and active status
app.get('/api/pipeline/counts', requireAuth, async (req, res) => {
    try {
        const [emailRes, researchRes, expRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) as count FROM email_proposals WHERE status IN ('draft','review')`),
            pool.query(`SELECT COUNT(*) as count FROM research_sessions WHERE status IN ('queued','researching','synthesizing')`),
            pool.query(`SELECT COUNT(*) as count FROM campaign_experiments WHERE status IN ('proposed','approved','running')`),
        ]);
        res.json({
            emails_active: parseInt(emailRes.rows[0].count),
            research_active: parseInt(researchRes.rows[0].count),
            experiments_active: parseInt(expRes.rows[0].count),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/compare — Comparison chat with context of multiple campaigns
app.post('/api/chat/compare', requireAuth, async (req, res) => {
    try {
        const { campaignIds = [], message } = req.body;
        if (!message || campaignIds.length < 2) return res.status(400).json({ error: 'Need message and at least 2 campaignIds' });

        const contexts = campaignIds.map(id => CAMPAIGN_CONTEXT[id]).filter(Boolean);
        if (contexts.length < 2) return res.status(404).json({ error: 'Some campaigns not found' });

        const comparisonPrompt = `You are a senior email marketing analyst comparing these campaigns:\n\n` +
            contexts.map((ctx, i) => `## Campaign ${i + 1}: ${ctx.name}\n- Group: ${ctx.group}\n- Audience: ${ctx.audience}\n- KPIs: ${ctx.kpis.sends.toLocaleString()} sends, ${ctx.kpis.openRate}% open, ${ctx.kpis.clickRate}% click, ${ctx.kpis.conversionRate}% conversion\n`).join('\n') +
            `\n## Your Task\nCompare these campaigns, identify what each does better, and suggest cross-pollination strategies. Be specific and data-driven. Respond in the same language the user writes in.`;

        // RAG for both campaigns
        let ragContext = '';
        if (isKBReady()) {
            const ragResult = await buildRAGContext(pool, message, { namespaces: ['campaigns', 'kpis'] });
            ragContext = ragResult.context;
        }

        const fullPrompt = ragContext ? comparisonPrompt + '\n\n' + ragContext : comparisonPrompt;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await chatWithPMAgent(
            [{ role: 'user', content: message }],
            { stream: true, systemPromptOverride: fullPrompt }
        );

        stream.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;
        stream.on('error', (err) => {
            if (!streamEnded) { streamEnded = true; res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); }
        });

        await stream.finalMessage();
        if (!streamEnded) { streamEnded = true; res.write('data: [DONE]\n\n'); res.end(); }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); }
        else if (!res.headersSent) { res.status(500).json({ error: err.message }); }
    }
});

// POST /api/research/from-session — Create campaign brief from research session
app.post('/api/research/:id/to-inbox', requireAuth, async (req, res) => {
    try {
        const session = await pool.query('SELECT * FROM research_sessions WHERE id = $1', [req.params.id]);
        if (session.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const s = session.rows[0];
        const recommendations = Array.isArray(s.recommendations) ? s.recommendations.slice(0, 5).join('\n- ') : '';

        const result = await pool.query(
            `INSERT INTO inbox_items (title, description, source, status, department)
             VALUES ($1, $2, 'agent', 'chat', $3) RETURNING *`,
            [`Campaign from Research: ${s.title}`, `Based on research findings:\n- ${recommendations}`, s.department || 'strategic']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTORESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

import { startResearch, cancelResearch } from '../../packages/core/research/engine.js';

// Tracks SSE connections for streaming research progress
const _researchStreams = new Map();

// POST /api/research/sessions — Start a new research session
app.post('/api/research/sessions', requireAuth, async (req, res) => {
    try {
        const { topic, depth = 'standard', sourcesMode = 'both', campaignId } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic is required' });

        const result = await pool.query(
            `INSERT INTO research_sessions (title, topic, depth, sources_mode, campaign_id, status)
             VALUES ($1, $2, $3, $4, $5, 'queued') RETURNING id`,
            [topic.slice(0, 100), topic, depth, sourcesMode, campaignId || null]
        );
        const sessionId = result.rows[0].id;

        // Start research in background
        const callbacks = {
            onProgress: (p) => {
                const stream = _researchStreams.get(sessionId);
                if (stream) stream.write(`data: ${JSON.stringify({ type: 'progress', value: p })}\n\n`);
            },
            onQuery: (q) => {
                const stream = _researchStreams.get(sessionId);
                if (stream) stream.write(`data: ${JSON.stringify({ type: 'query', value: q })}\n\n`);
            },
            onSource: (s) => {
                const stream = _researchStreams.get(sessionId);
                if (stream) stream.write(`data: ${JSON.stringify({ type: 'source', value: s })}\n\n`);
            },
            onPhase: (p) => {
                const stream = _researchStreams.get(sessionId);
                if (stream) {
                    stream.write(`data: ${JSON.stringify({ type: 'phase', value: p })}\n\n`);
                    if (p === 'completed' || p === 'failed' || p === 'cancelled') {
                        stream.write('data: [DONE]\n\n');
                        stream.end();
                        _researchStreams.delete(sessionId);
                    }
                }
            },
        };

        startResearch(pool, sessionId, { topic, depth, sourcesMode, campaignId }, callbacks)
            .catch(err => console.error('[research] Error:', err.message));

        res.status(201).json({ sessionId, status: 'queued' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/research/sessions — List sessions
app.get('/api/research/sessions', requireAuth, async (req, res) => {
    try {
        const { status, campaignId, limit = 20 } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }
        if (campaignId) { params.push(campaignId); where += ` AND campaign_id = $${params.length}`; }
        params.push(parseInt(limit));

        const result = await pool.query(
            `SELECT id, title, topic, depth, sources_mode, status, progress, sources_found, iterations, campaign_id, created_at, completed_at
             FROM research_sessions ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
            params
        );
        res.json({ sessions: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/research/sessions/:id — Detail + report
app.get('/api/research/sessions/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM research_sessions WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/research/sessions/:id/stream — SSE progress stream
app.get('/api/research/sessions/:id/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    _researchStreams.set(parseInt(req.params.id), res);

    req.on('close', () => {
        _researchStreams.delete(parseInt(req.params.id));
    });
});

// POST /api/research/sessions/:id/cancel — Cancel active session
app.post('/api/research/sessions/:id/cancel', requireAuth, async (req, res) => {
    try {
        cancelResearch(parseInt(req.params.id));
        await pool.query(`UPDATE research_sessions SET status = 'failed', error = 'Cancelled', updated_at = NOW() WHERE id = $1`, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/research/sessions/:id — Delete session
app.delete('/api/research/sessions/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM campaign_experiments WHERE research_session_id = $1', [req.params.id]);
        await pool.query('DELETE FROM research_sessions WHERE id = $1', [req.params.id]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/research/sessions/:id/experiments — List experiments for session
app.get('/api/research/sessions/:id/experiments', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM campaign_experiments WHERE research_session_id = $1 ORDER BY created_at',
            [req.params.id]
        );
        res.json({ experiments: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/experiments/:id — Update experiment status
app.patch('/api/experiments/:id', requireAuth, async (req, res) => {
    try {
        const { status, results, winner } = req.body;
        const updates = [];
        const params = [];
        if (status) { params.push(status); updates.push(`status = $${params.length}`); }
        if (results) { params.push(JSON.stringify(results)); updates.push(`results = $${params.length}`); }
        if (winner) { params.push(winner); updates.push(`winner = $${params.length}`); }
        if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

        params.push(req.params.id);
        await pool.query(`UPDATE campaign_experiments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);

        const result = await pool.query('SELECT * FROM campaign_experiments WHERE id = $1', [req.params.id]);
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/:campaignId/auto-improve — Shortcut: launch research for a campaign
app.post('/api/campaigns/:campaignId/auto-improve', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const ctx = CAMPAIGN_CONTEXT[campaignId];
        if (!ctx) return res.status(404).json({ error: 'Campaign not found' });

        const topic = `How to improve the "${ctx.name}" email campaign. Current metrics: ${ctx.kpis.sends.toLocaleString()} sends, ${ctx.kpis.openRate}% open rate, ${ctx.kpis.clickRate}% click rate, ${ctx.kpis.conversionRate}% conversion. Audience: ${ctx.audience}. Analyze competitors, industry trends, and best practices for ${ctx.group} campaigns.`;

        const result = await pool.query(
            `INSERT INTO research_sessions (title, topic, depth, sources_mode, campaign_id, status)
             VALUES ($1, $2, 'standard', 'both', $3, 'queued') RETURNING id`,
            [`Improve: ${ctx.name}`, topic, campaignId]
        );
        const sessionId = result.rows[0].id;

        startResearch(pool, sessionId, { topic, depth: 'standard', sourcesMode: 'both', campaignId }, {})
            .catch(err => console.error('[auto-improve] Error:', err.message));

        res.status(201).json({ sessionId, status: 'queued' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPERIMENT LOOPS (AutoExperiment)
// ═══════════════════════════════════════════════════════════════════════════════

import { runExperimentCycle, startAutoLoop, stopAutoLoop, isLoopActive } from '../../packages/core/research/experiment-loop.js';

// POST /api/experiment-loops — Create & optionally start a loop
app.post('/api/experiment-loops', requireAuth, async (req, res) => {
    try {
        const { campaign_id, name, metric_target, experiment_type, max_cycles = 20, cycle_interval = '4h', baseline, autoStart = false } = req.body;
        if (!campaign_id || !name || !metric_target || !experiment_type) {
            return res.status(400).json({ error: 'campaign_id, name, metric_target, experiment_type required' });
        }
        const status = autoStart ? 'running' : 'idle';
        const { rows: [loop] } = await pool.query(
            `INSERT INTO experiment_loops (campaign_id, name, metric_target, experiment_type, max_cycles, cycle_interval, current_baseline, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [campaign_id, name, metric_target, experiment_type, max_cycles, cycle_interval, baseline ? JSON.stringify(baseline) : null, status]
        );
        if (autoStart) startAutoLoop(pool, loop.id, cycle_interval);
        res.status(201).json({ id: loop.id, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/experiment-loops — List loops
app.get('/api/experiment-loops', requireAuth, async (req, res) => {
    try {
        const { campaign_id } = req.query;
        let query = `SELECT * FROM experiment_loops`;
        const params = [];
        if (campaign_id) { params.push(campaign_id); query += ` WHERE campaign_id = $1`; }
        query += ` ORDER BY created_at DESC`;
        const { rows } = await pool.query(query, params);
        res.json({ loops: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/experiment-loops/:id — Loop detail with recent cycles
app.get('/api/experiment-loops/:id', requireAuth, async (req, res) => {
    try {
        const { rows: [loop] } = await pool.query(`SELECT * FROM experiment_loops WHERE id = $1`, [req.params.id]);
        if (!loop) return res.status(404).json({ error: 'Loop not found' });
        const { rows: cycles } = await pool.query(
            `SELECT * FROM experiment_cycles WHERE loop_id = $1 ORDER BY cycle_number DESC LIMIT 10`, [loop.id]
        );
        res.json({ ...loop, recent_cycles: cycles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/experiment-loops/:id/cycles — All cycles
app.get('/api/experiment-loops/:id/cycles', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM experiment_cycles WHERE loop_id = $1 ORDER BY cycle_number ASC`, [req.params.id]
        );
        res.json({ cycles: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/experiment-loops/:id/run-cycle — Manually trigger one cycle
app.post('/api/experiment-loops/:id/run-cycle', requireAuth, async (req, res) => {
    try {
        const loopId = parseInt(req.params.id);
        const result = await runExperimentCycle(pool, loopId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/experiment-loops/:id/pause — Pause a running loop
app.post('/api/experiment-loops/:id/pause', requireAuth, async (req, res) => {
    try {
        const loopId = parseInt(req.params.id);
        stopAutoLoop(loopId);
        await pool.query(`UPDATE experiment_loops SET status = 'paused', updated_at = NOW() WHERE id = $1`, [loopId]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/experiment-loops/:id/resume — Resume a paused loop
app.post('/api/experiment-loops/:id/resume', requireAuth, async (req, res) => {
    try {
        const loopId = parseInt(req.params.id);
        const { rows: [loop] } = await pool.query(`SELECT cycle_interval FROM experiment_loops WHERE id = $1`, [loopId]);
        if (!loop) return res.status(404).json({ error: 'Loop not found' });
        await pool.query(`UPDATE experiment_loops SET status = 'running', updated_at = NOW() WHERE id = $1`, [loopId]);
        startAutoLoop(pool, loopId, loop.cycle_interval);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/experiment-loops/:id — Delete loop + cascade cycles
app.delete('/api/experiment-loops/:id', requireAuth, async (req, res) => {
    try {
        const loopId = parseInt(req.params.id);
        stopAutoLoop(loopId);
        await pool.query('DELETE FROM experiment_loops WHERE id = $1', [loopId]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/experiment-loops/:id/knowledge — Return accumulated knowledge
app.get('/api/experiment-loops/:id/knowledge', requireAuth, async (req, res) => {
    try {
        const { rows: [loop] } = await pool.query(
            `SELECT knowledge_md FROM experiment_loops WHERE id = $1`, [req.params.id]
        );
        if (!loop) return res.status(404).json({ error: 'Loop not found' });
        res.json({ knowledge: loop.knowledge_md });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/experiment-loops/:id/stream — SSE for real-time cycle updates
app.get('/api/experiment-loops/:id/stream', requireAuth, async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const loopId = parseInt(req.params.id);
    let lastCycleCount = 0;

    const interval = setInterval(async () => {
        try {
            const { rows: [loop] } = await pool.query(
                `SELECT cycle_count, status, total_improvement_pct FROM experiment_loops WHERE id = $1`, [loopId]
            );
            if (!loop) { clearInterval(interval); res.end(); return; }

            if (loop.cycle_count > lastCycleCount) {
                lastCycleCount = loop.cycle_count;
                const { rows: [cycle] } = await pool.query(
                    `SELECT * FROM experiment_cycles WHERE loop_id = $1 ORDER BY cycle_number DESC LIMIT 1`, [loopId]
                );
                res.write(`data: ${JSON.stringify({ type: 'cycle', cycle, loop_status: loop.status, total_improvement: loop.total_improvement_pct })}\n\n`);
            }

            if (loop.status === 'completed' || loop.status === 'failed' || loop.status === 'paused') {
                res.write(`data: ${JSON.stringify({ type: 'status', status: loop.status })}\n\n`);
                res.write('data: [DONE]\n\n');
                clearInterval(interval);
                res.end();
            }
        } catch { /* ignore */ }
    }, 3000);

    req.on('close', () => clearInterval(interval));
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL PROPOSALS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/campaigns/:campaignId/emails — List email proposals
app.get('/api/campaigns/:campaignId/emails', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { market, language, tier, status } = req.query;

        let where = 'WHERE campaign_id = $1';
        const params = [campaignId];
        if (market) { params.push(market); where += ` AND market = $${params.length}`; }
        if (language) { params.push(language); where += ` AND language = $${params.length}`; }
        if (tier) { params.push(tier); where += ` AND tier = $${params.length}`; }
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }

        const result = await pool.query(
            `SELECT id, campaign_id, variant_name, market, language, tier, subject_line, preview_text,
                    status, version, created_at, updated_at
             FROM email_proposals ${where} ORDER BY created_at DESC`,
            params
        );
        res.json({ proposals: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/campaigns/:campaignId/emails/:id — Get single proposal with full HTML
app.get('/api/campaigns/:campaignId/emails/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM email_proposals WHERE id = $1 AND campaign_id = $2', [req.params.id, req.params.campaignId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/:campaignId/emails/generate — Generate email proposals via SSE
app.post('/api/campaigns/:campaignId/emails/generate', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { markets = ['UAE'], languages = ['en'], tiers = [null], instructions = '' } = req.body;

        const ctx = CAMPAIGN_CONTEXT[campaignId];
        if (!ctx) return res.status(404).json({ error: 'Campaign not found' });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // RAG context for email generation
        let ragContext = '';
        if (isKBReady()) {
            const ragResult = await buildRAGContext(pool, `${ctx.name} email template design copy`, {
                namespaces: ['campaigns', 'emails', 'brand'],
                filter: { campaign_id: { $eq: campaignId } },
            });
            ragContext = ragResult.context;
        }

        const variants = [];
        for (const market of markets) {
            for (const lang of languages) {
                for (const tier of tiers) {
                    variants.push({ market, language: lang, tier });
                }
            }
        }

        const totalVariants = variants.length;
        const createdIds = [];

        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const variantLabel = `${v.market}-${v.language}${v.tier ? '-' + v.tier : ''}`;

            res.write(`data: ${JSON.stringify({ phase: 'generating', variant: variantLabel, progress: Math.round((i / totalVariants) * 100) })}\n\n`);

            const prompt = `Generate a complete marketing email for the following campaign:

Campaign: ${ctx.name}
Description: ${ctx.description}
Trigger: ${ctx.trigger}
Target Audience: ${ctx.audience}
Market: ${v.market}
Language: ${v.language}
${v.tier ? `Tier: ${v.tier}` : 'All tiers'}
${instructions ? `Additional instructions: ${instructions}` : ''}

${ragContext}

Respond with EXACTLY this JSON format (no other text):
{
  "subject_line": "The email subject line",
  "preview_text": "Preview/preheader text (max 90 chars)",
  "html_content": "<!DOCTYPE html><html>..complete responsive email HTML..</html>",
  "copy_blocks": {
    "hero_headline": "Main headline text",
    "hero_subheadline": "Supporting text",
    "body_text": "Main body paragraph",
    "cta_text": "Call to action button text",
    "footer_text": "Footer/legal text"
  }
}`;

            try {
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 4096,
                    messages: [{ role: 'user', content: prompt }],
                });

                const text = response.content[0]?.text || '';
                let emailData;
                try {
                    // Try to parse JSON from response (may be wrapped in ```json blocks)
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    emailData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                } catch { emailData = null; }

                if (emailData) {
                    const insertResult = await pool.query(
                        `INSERT INTO email_proposals (campaign_id, variant_name, market, language, tier, subject_line, preview_text, html_content, copy_blocks, status)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft') RETURNING id`,
                        [campaignId, variantLabel, v.market, v.language, v.tier, emailData.subject_line, emailData.preview_text, emailData.html_content, JSON.stringify(emailData.copy_blocks || {})]
                    );
                    createdIds.push(insertResult.rows[0].id);
                }
            } catch (err) {
                res.write(`data: ${JSON.stringify({ phase: 'error', variant: variantLabel, error: err.message })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ phase: 'complete', proposals: createdIds, total: createdIds.length })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// PATCH /api/campaigns/:campaignId/emails/:id — Update status or add feedback
app.patch('/api/campaigns/:campaignId/emails/:id', requireAuth, async (req, res) => {
    try {
        const { status, feedback } = req.body;
        const { id, campaignId } = req.params;

        if (status) {
            await pool.query('UPDATE email_proposals SET status = $1, updated_at = NOW() WHERE id = $2 AND campaign_id = $3', [status, id, campaignId]);
        }
        if (feedback) {
            await pool.query(
                `UPDATE email_proposals SET feedback = feedback || $1::jsonb, updated_at = NOW() WHERE id = $2 AND campaign_id = $3`,
                [JSON.stringify([feedback]), id, campaignId]
            );
        }

        const result = await pool.query('SELECT * FROM email_proposals WHERE id = $1', [id]);
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/campaigns/:campaignId/emails/:id — Delete proposal
app.delete('/api/campaigns/:campaignId/emails/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM email_proposals WHERE id = $1 AND campaign_id = $2', [req.params.id, req.params.campaignId]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/campaigns/:campaignId/emails/:id/diff/:otherId — Diff between two proposals
app.get('/api/campaigns/:campaignId/emails/:id/diff/:otherId', requireAuth, async (req, res) => {
    try {
        const [a, b] = await Promise.all([
            pool.query('SELECT * FROM email_proposals WHERE id = $1', [req.params.id]),
            pool.query('SELECT * FROM email_proposals WHERE id = $1', [req.params.otherId]),
        ]);
        if (a.rows.length === 0 || b.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

        const propA = a.rows[0];
        const propB = b.rows[0];

        // Simple text diff: find differences in copy blocks
        const diffs = {};
        const blocksA = propA.copy_blocks || {};
        const blocksB = propB.copy_blocks || {};
        const allKeys = new Set([...Object.keys(blocksA), ...Object.keys(blocksB)]);

        for (const key of allKeys) {
            if (blocksA[key] !== blocksB[key]) {
                diffs[key] = { a: blocksA[key] || '', b: blocksB[key] || '' };
            }
        }

        res.json({
            proposalA: { id: propA.id, variant_name: propA.variant_name, subject_line: propA.subject_line },
            proposalB: { id: propB.id, variant_name: propB.variant_name, subject_line: propB.subject_line },
            subject_diff: propA.subject_line !== propB.subject_line ? { a: propA.subject_line, b: propB.subject_line } : null,
            copy_diffs: diffs,
            total_diffs: Object.keys(diffs).length + (propA.subject_line !== propB.subject_line ? 1 : 0),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/:campaignId/emails/:id/duplicate — Duplicate as new version
app.post('/api/campaigns/:campaignId/emails/:id/duplicate', requireAuth, async (req, res) => {
    try {
        const orig = await pool.query('SELECT * FROM email_proposals WHERE id = $1 AND campaign_id = $2', [req.params.id, req.params.campaignId]);
        if (orig.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

        const p = orig.rows[0];
        const maxVersion = await pool.query(
            'SELECT COALESCE(MAX(version), 0) + 1 as next FROM email_proposals WHERE campaign_id = $1 AND market = $2 AND language = $3 AND tier IS NOT DISTINCT FROM $4',
            [p.campaign_id, p.market, p.language, p.tier]
        );

        const result = await pool.query(
            `INSERT INTO email_proposals (campaign_id, variant_name, market, language, tier, subject_line, preview_text, html_content, copy_blocks, segmentation_logic, personalization_rules, parent_proposal_id, version, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft') RETURNING id`,
            [p.campaign_id, p.variant_name + '-v' + maxVersion.rows[0].next, p.market, p.language, p.tier, p.subject_line, p.preview_text, p.html_content, JSON.stringify(p.copy_blocks), JSON.stringify(p.segmentation_logic), JSON.stringify(p.personalization_rules), p.id, maxVersion.rows[0].next]
        );

        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════

import { ingestDocument, ingestCampaigns, ingestBauTypes, deleteDocument, ingestFile } from '../../packages/core/knowledge/ingestion.js';
import { searchKnowledge, searchMultiNamespace, buildRAGContext, isKBReady } from '../../packages/core/knowledge/retrieval.js';
import { ingestEmailBlocks } from '../../packages/core/knowledge/ingest-email-blocks.js';

// Auto-migrate: add multimodal columns to KB tables
(async () => {
    try {
        await pool.query(`ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text'`);
        await pool.query(`ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_path TEXT`);
        await pool.query(`ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS original_filename TEXT`);
        await pool.query(`ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_size INTEGER`);
        await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'text'`);
        await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS file_path TEXT`);
    } catch (_) { /* columns may already exist */ }
})();

// Serve KB files (images, PDFs) with auth
app.use('/api/kb-files', requireAuth, express.static(kbDir));

// GET /api/knowledge/status — KB health and stats
app.get('/api/knowledge/status', requireAuth, async (req, res) => {
    try {
        const docs = await pool.query(
            `SELECT namespace, status, COUNT(*) as count FROM knowledge_documents GROUP BY namespace, status`
        );
        const chunks = await pool.query(
            `SELECT kd.namespace, COUNT(kc.id) as count
             FROM knowledge_chunks kc
             JOIN knowledge_documents kd ON kd.id = kc.document_id
             GROUP BY kd.namespace`
        );
        const totals = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM knowledge_documents) as total_documents,
                (SELECT COUNT(*) FROM knowledge_chunks) as total_chunks,
                (SELECT MAX(updated_at) FROM knowledge_documents WHERE status = 'indexed') as last_ingestion`
        );

        const namespaces = {};
        for (const row of docs.rows) {
            if (!namespaces[row.namespace]) namespaces[row.namespace] = { docs: 0, indexed: 0, chunks: 0 };
            namespaces[row.namespace].docs += parseInt(row.count);
            if (row.status === 'indexed') namespaces[row.namespace].indexed += parseInt(row.count);
        }
        for (const row of chunks.rows) {
            if (!namespaces[row.namespace]) namespaces[row.namespace] = { docs: 0, indexed: 0, chunks: 0 };
            namespaces[row.namespace].chunks = parseInt(row.count);
        }

        res.json({
            ready: isKBReady(),
            totalDocuments: parseInt(totals.rows[0].total_documents),
            totalChunks: parseInt(totals.rows[0].total_chunks),
            lastIngestion: totals.rows[0].last_ingestion,
            namespaces,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/knowledge/diagnostics — Check KB system health
app.get('/api/knowledge/diagnostics', requireAuth, async (req, res) => {
    try {
        const geminiOk = isGeminiReady();
        const pineconeOk = isPineconeReady();
        let indexDimension = null;
        let dimensionMatch = null;

        if (pineconeOk) {
            try {
                const info = await describeIndex();
                indexDimension = info.dimension;
                dimensionMatch = info.dimension === EMBEDDING_DIMENSIONS;
            } catch (err) {
                indexDimension = `error: ${err.message}`;
            }
        }

        res.json({
            gemini: { ready: geminiOk, embeddingModel: EMBEDDING_MODEL, embeddingDimensions: EMBEDDING_DIMENSIONS },
            pinecone: { ready: pineconeOk, indexName: process.env.PINECONE_INDEX, indexDimension, dimensionMatch },
            healthy: geminiOk && pineconeOk && dimensionMatch === true,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/knowledge/documents — List documents
app.get('/api/knowledge/documents', requireAuth, async (req, res) => {
    try {
        const { namespace, status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = 'WHERE 1=1';
        const params = [];
        if (namespace) { params.push(namespace); where += ` AND namespace = $${params.length}`; }
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }

        const countResult = await pool.query(`SELECT COUNT(*) FROM knowledge_documents ${where}`, params);
        params.push(parseInt(limit), offset);
        const result = await pool.query(
            `SELECT id, namespace, source_type, source_id, title, chunk_count, content_type, file_path, original_filename, status, error_message, created_at, updated_at
             FROM knowledge_documents ${where}
             ORDER BY created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            documents: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/knowledge/ingest — Ingest a single document
app.post('/api/knowledge/ingest', requireAuth, async (req, res) => {
    try {
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured. Set Gemini and Pinecone API keys in Settings.' });

        const { title, content, namespace, sourceType, sourceId, metadata } = req.body;
        if (!title || !content || !namespace || !sourceType) {
            return res.status(400).json({ error: 'title, content, namespace, and sourceType are required' });
        }

        const result = await ingestDocument(pool, { title, content, namespace, sourceType, sourceId, metadata });
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/knowledge/ingest-campaigns — Bulk ingest all campaigns + BAU types
app.post('/api/knowledge/ingest-campaigns', requireAuth, async (req, res) => {
    try {
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured. Set Gemini and Pinecone API keys in Settings.' });

        // Dynamic import of campaign data
        const { CAMPAIGNS, CAMPAIGN_GROUPS } = await import('../../apps/dashboard/src/data/emiratesCampaigns.js');
        const { BAU_CAMPAIGN_TYPES, BAU_CATEGORIES } = await import('../../apps/dashboard/src/data/emiratesBauTypes.js');

        const campaignResult = await ingestCampaigns(pool, CAMPAIGNS, CAMPAIGN_GROUPS);
        const bauResult = await ingestBauTypes(pool, BAU_CAMPAIGN_TYPES, BAU_CATEGORIES);

        res.json({
            documentsCreated: campaignResult.documentsCreated + bauResult.documentsCreated,
            chunksCreated: campaignResult.chunksCreated + bauResult.chunksCreated,
            campaigns: campaignResult.documentsCreated,
            bauTypes: bauResult.documentsCreated,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/knowledge/ingest-email-blocks — Ingest Emirates email design blocks
app.post('/api/knowledge/ingest-email-blocks', requireAuth, async (req, res) => {
    try {
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured. Set Gemini and Pinecone API keys in Settings.' });
        const result = await ingestEmailBlocks(pool);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/knowledge/upload — Upload and ingest a file (image or PDF)
app.post('/api/knowledge/upload', requireAuth, kbUpload.single('file'), async (req, res) => {
    try {
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured. Set Gemini and Pinecone API keys in Settings.' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded or unsupported file type' });

        const { title, namespace, metadata } = req.body;
        if (!title || !namespace) return res.status(400).json({ error: 'title and namespace are required' });

        const parsedMetadata = metadata ? JSON.parse(metadata) : {};
        const result = await ingestFile(pool, {
            filePath: req.file.path,
            originalFilename: req.file.originalname,
            title,
            namespace,
            sourceType: 'upload',
            metadata: parsedMetadata,
        });
        res.status(201).json(result);
    } catch (err) {
        console.error('[KB Upload] Error ingesting file:', err.message, err.stack);
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: err.message });
    }
});

// POST /api/knowledge/search — Semantic search
app.post('/api/knowledge/search', requireAuth, async (req, res) => {
    try {
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured.' });

        const { query, namespace, filter, topK } = req.body;
        if (!query) return res.status(400).json({ error: 'query is required' });

        let results;
        if (namespace) {
            results = await searchKnowledge(pool, query, { namespace, filter, topK });
        } else {
            // Search all namespaces when none specified
            results = await searchMultiNamespace(pool, query, ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'], { topK: topK || 10, filter });
        }
        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/knowledge — Conversational KB assistant (SSE streaming)
app.post('/api/chat/knowledge', requireAuth, async (req, res) => {
    try {
        const { message, history, namespace, visualQuery, lang } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });
        if (!isKBReady()) return res.status(503).json({ error: 'Knowledge base not configured.' });

        // Determine namespaces to search
        const allNamespaces = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];
        const namespaces = namespace ? [namespace] : allNamespaces;

        // Build RAG context (pass visualQuery flag for boosted visual retrieval)
        const ragResult = await buildRAGContext(pool, message, { namespaces, maxTokens: visualQuery ? 4000 : 3000, visualQuery: !!visualQuery, mode: 'text', maxMedia: visualQuery ? 4 : 2 });

        // System prompt for conversational KB assistant
        const visualInstruction = visualQuery ? `

## CRITICAL: Visual Query Detected
The user is asking for a diagram, image, schema, or visual content. You MUST:
- Embed ALL matching [VISUAL PAGE: url] and [IMAGE: url] references as inline images using ![description](url)
- Show the visual FIRST, then explain what it contains
- NEVER describe a diagram with text when the actual visual page is available in the context
- If multiple visual pages match, embed ALL of them` : '';

        const langDirective = lang === 'en'
            ? '\n\nCRITICAL LANGUAGE RULE: You MUST respond in English at all times, regardless of the language of the knowledge base content.'
            : lang === 'es'
            ? '\n\nREGLA CRITICA DE IDIOMA: DEBES responder en español siempre, sin importar el idioma del contenido de la base de conocimiento.'
            : '';

        const systemPrompt = `You are the Knowledge Base Assistant for AgentOS. You help users explore and understand the organization's knowledge base.${langDirective}

## Response Rules
1. Answer conversationally. Synthesize and explain the information — do NOT just list documents or raw data.
2. When you find relevant information, explain what it is and why it matters.
3. Cite your sources using numbered references [1], [2], etc. that match the source numbers in the knowledge context. Place citations inline after the relevant claim. Example: "The campaign has 18% open rate [1]."
4. For images in the knowledge base, embed them inline using markdown: ![Document Title](/api/kb-files/{filePath})
5. For PDF pages with diagrams or visual content, embed them inline using: ![Page X - Document Title](/api/kb-files/{filePath})
   When the context includes [VISUAL PAGE: url], ALWAYS embed that page using ![description](url) so the user can see the actual diagram or visual content.
6. For full PDFs (not individual pages), link them: [Document Title](/api/kb-files/{filePath})
7. If multiple results are relevant, summarize the key findings and highlight the best matches.
8. If nothing relevant is found, say so honestly and suggest what the user could try instead.
9. Respond in the same language the user writes to you. If a language directive is provided above, follow it strictly.
10. Be concise but thorough. Under 400 words unless the user asks for more detail.
11. Use markdown formatting (bold, lists, headers) to make your responses easy to scan.` +
            visualInstruction +
            (ragResult.context ? '\n\n' + ragResult.context : '');

        // Build messages array from history (cap at last 10 pairs = 20 messages)
        const trimmedHistory = Array.isArray(history) ? history.slice(-20) : [];
        const apiMessages = [
            ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message },
        ];

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources.map(({ htmlSource, ...s }) => s)));
        }
        if (ragResult.mediaResults && ragResult.mediaResults.length > 0) {
            const mediaForHeader = ragResult.mediaResults.filter(m => m.mediaType !== 'email_html').map(({ htmlSource, ...m }) => m);
            if (mediaForHeader.length > 0) res.setHeader('X-RAG-Media', JSON.stringify(mediaForHeader));
        }
        res.flushHeaders();

        // Send email html as SSE event (too large for HTTP headers)
        const htmlFromSources = ragResult.sources?.filter(s => s.htmlSource) || [];
        const htmlFromMedia = ragResult.mediaResults?.filter(m => m.mediaType === 'email_html' && m.htmlSource) || [];
        const allHtmlKB = [...htmlFromSources, ...htmlFromMedia].filter((m, i, arr) => arr.findIndex(x => (x.title || x.documentTitle) === (m.title || m.documentTitle)) === i);
        if (allHtmlKB.length > 0) {
            res.write(`data: ${JSON.stringify({ html_sources: allHtmlKB.map(s => ({ htmlSource: s.htmlSource, title: s.title || s.documentTitle, filePath: s.filePath })) })}\n\n`);
        }

        // Stream response via Gemini
        const gemini = getGeminiClient();
        const geminiMessages = apiMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

        const streamResult = await gemini.models.generateContentStream({
            model: 'gemini-2.0-flash',
            contents: geminiMessages,
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });

        for await (const chunk of streamResult) {
            const text = chunk.text || '';
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// DELETE /api/knowledge/documents/:id — Delete document + vectors
app.delete('/api/knowledge/documents/:id', requireAuth, async (req, res) => {
    try {
        await deleteDocument(pool, parseInt(req.params.id));
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET — GEMINI VOICE
// ═══════════════════════════════════════════════════════════════════════════════

import http from 'http';
import { WebSocketServer } from 'ws';

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/ws/voice' || url.pathname === '/ws/voice-meeting' || url.pathname === '/ws/voice-kb' || url.pathname === '/ws/voice-agent') {
        // Validate session before allowing WebSocket upgrade
        // express-session needs a response-like object with header methods
        const fakeRes = Object.create(http.ServerResponse.prototype);
        fakeRes.getHeader = () => {};
        fakeRes.setHeader = () => fakeRes;
        fakeRes.writeHead = () => {};
        fakeRes.end = () => {};
        fakeRes.on = () => fakeRes;

        sessionMiddleware(req, fakeRes, () => {
            if (!req.session?.userId) {
                console.log('[WS] Rejected: no authenticated session');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            });
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const isMeeting = url.pathname === '/ws/voice-meeting';

    if (isMeeting) {
        return handleVoiceMeeting(ws, url);
    }

    if (url.pathname === '/ws/voice-kb') {
        return handleVoiceKB(ws, url);
    }

    if (url.pathname === '/ws/voice-agent') {
        return handleVoiceAgent(ws, url);
    }

    const agentId = url.searchParams.get('agentId');
    const campaignId = url.searchParams.get('campaignId');
    const context = agentId ? `agent:${agentId}` : campaignId ? `campaign:${campaignId}` : 'pm-agent';

    console.log(`[Voice WS] Connected: ${context}`);

    // Build system prompt for the voice session (same as text chat)
    let systemPrompt = 'You are a helpful AI assistant. Respond concisely and naturally as if in a voice conversation. Keep responses short (2-3 sentences max).';

    if (agentId) {
        try {
            const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
            if (agentRes.rows.length > 0) {
                const agent = agentRes.rows[0];
                const skills = Array.isArray(agent.skills) ? agent.skills.join(', ') : '';
                systemPrompt = `You are ${agent.name}, an AI agent in the ${agent.department} department. Your role: ${agent.role}. ${skills ? `Skills: ${skills}.` : ''} Respond concisely as if in a voice conversation. Keep responses short (2-3 sentences). Respond in the same language the user speaks.`;
            }
        } catch { /* fallback to default */ }
    } else if (campaignId) {
        const ctx = CAMPAIGN_CONTEXT[campaignId];
        if (ctx) {
            systemPrompt = `You are the campaign assistant for "${ctx.name}". ${ctx.description}. Current KPIs: ${ctx.kpis.openRate}% open rate, ${ctx.kpis.clickRate}% click rate. Respond concisely as if in a voice conversation. Keep responses short.`;
        }
    }

    // Conversation history for this voice session
    const messages = [];

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'transcript') {
                // User speech transcript -> generate AI response
                messages.push({ role: 'user', content: msg.text });

                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 256,
                    system: systemPrompt,
                    messages: messages.slice(-10),
                });

                const aiText = response.content[0]?.text || '';
                messages.push({ role: 'assistant', content: aiText });

                ws.send(JSON.stringify({ type: 'response', text: aiText }));
            }

            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
    });

    ws.on('close', () => {
        console.log(`[Voice WS] Disconnected: ${context}`);
    });

    // Send ready signal
    ws.send(JSON.stringify({ type: 'ready', context, systemPrompt: systemPrompt.slice(0, 100) + '...' }));
});

// ─── Voice Meeting Handler ──────────────────────────────────────────────────

const AGENT_ROLES_FOR_TYPE = {
    email_proposal: ['lucia', 'html-developer'],
    research_session: ['raul', 'competitive-intel'],
    experiment: ['carlos', 'diego'],
    project: ['raul'],
};

async function handleVoiceMeeting(ws, url) {
    const meetingId = url.searchParams.get('meetingId');
    const department = url.searchParams.get('department') || 'strategic';

    console.log(`[Meeting WS] Connected: meeting=${meetingId}, dept=${department}`);

    // Load meeting or create new
    let meeting;
    if (meetingId) {
        const res = await pool.query('SELECT * FROM meeting_sessions WHERE id = $1', [meetingId]);
        meeting = res.rows[0];
    }

    if (!meeting) {
        const res = await pool.query(
            `INSERT INTO meeting_sessions (department, status, agenda, transcript, participants)
             VALUES ($1, 'active', '[]', '[]', '[]') RETURNING *`,
            [department]
        );
        meeting = res.rows[0];
    }

    let agenda = Array.isArray(meeting.agenda) ? meeting.agenda : [];
    let transcript = Array.isArray(meeting.transcript) ? meeting.transcript : [];
    let decisions = Array.isArray(meeting.decisions) ? meeting.decisions : [];
    let currentItemIndex = 0;

    // Load agenda from pipeline if empty
    if (agenda.length === 0) {
        try {
            const items = await pool.query(
                `SELECT id, name, status, department, 'project' as _type FROM projects WHERE LOWER(department) = LOWER($1) AND status != 'Completed'
                 UNION ALL
                 SELECT id, variant_name as name, status, department, 'email_proposal' as _type FROM email_proposals WHERE status IN ('draft','review') AND (department IS NULL OR LOWER(department) = LOWER($1))
                 UNION ALL
                 SELECT id, title as name, status, department, 'research_session' as _type FROM research_sessions WHERE status = 'completed' AND (department IS NULL OR LOWER(department) = LOWER($1))
                 UNION ALL
                 SELECT id, hypothesis as name, status, department, 'experiment' as _type FROM campaign_experiments WHERE status IN ('proposed','approved') AND (department IS NULL OR LOWER(department) = LOWER($1))
                 ORDER BY _type LIMIT 15`,
                [department]
            );
            agenda = items.rows.map(r => ({ id: r.id, name: r.name, type: r._type, status: r.status }));
            await pool.query('UPDATE meeting_sessions SET agenda = $1 WHERE id = $2', [JSON.stringify(agenda), meeting.id]);
        } catch { /* ignore */ }
    }

    ws.send(JSON.stringify({ type: 'meeting-ready', meetingId: meeting.id, agenda, currentItem: 0 }));

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'transcript') {
                // Human speaking during meeting
                transcript.push({ speaker: 'human', text: msg.text, item: currentItemIndex, time: new Date().toISOString() });

                // Check for decision commands
                const lower = msg.text.toLowerCase();
                let decision = null;
                if (lower.includes('approve') || lower.includes('aprueb')) decision = 'approved';
                else if (lower.includes('reject') || lower.includes('rechaz')) decision = 'rejected';
                else if (lower.includes('next') || lower.includes('siguiente')) decision = 'skip';

                if (decision && agenda[currentItemIndex]) {
                    const item = agenda[currentItemIndex];
                    decisions.push({ item: item.name, type: item.type, decision, itemIndex: currentItemIndex });

                    // Apply decision to pipeline
                    if (decision !== 'skip') {
                        const tableMap = { project: 'projects', email_proposal: 'email_proposals', research_session: 'research_sessions', experiment: 'campaign_experiments' };
                        const table = tableMap[item.type];
                        if (table) {
                            try { await pool.query(`UPDATE ${table} SET status = $1, updated_at = NOW() WHERE id = $2`, [decision, item.id]); } catch { /* ignore */ }
                        }
                    }

                    ws.send(JSON.stringify({ type: 'decision', decision, item: item.name, itemIndex: currentItemIndex }));

                    // Move to next item
                    currentItemIndex++;
                    if (currentItemIndex < agenda.length) {
                        ws.send(JSON.stringify({ type: 'next-item', itemIndex: currentItemIndex, item: agenda[currentItemIndex] }));
                    } else {
                        ws.send(JSON.stringify({ type: 'meeting-complete' }));
                    }
                } else {
                    // Generate agent response about current item
                    const currentItem = agenda[currentItemIndex];
                    const presenterIds = AGENT_ROLES_FOR_TYPE[currentItem?.type] || ['raul'];
                    const presenterId = presenterIds[0];

                    let agentName = presenterId;
                    try {
                        const agentRes = await pool.query('SELECT name, role FROM agents WHERE id = $1', [presenterId]);
                        if (agentRes.rows.length > 0) agentName = agentRes.rows[0].name;
                    } catch { /* ignore */ }

                    const response = await anthropic.messages.create({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 256,
                        system: `You are ${agentName} in a team meeting discussing "${currentItem?.name || 'agenda item'}". Be concise (2-3 sentences). The human just said something — respond helpfully. If they seem ready to decide, ask them to approve, reject, or skip.`,
                        messages: [{ role: 'user', content: msg.text }],
                    });

                    const aiText = response.content[0]?.text || '';
                    transcript.push({ speaker: agentName, text: aiText, item: currentItemIndex, time: new Date().toISOString() });

                    ws.send(JSON.stringify({ type: 'agent-response', agent: agentName, agentId: presenterId, text: aiText }));
                }

                // Persist transcript + decisions
                await pool.query('UPDATE meeting_sessions SET transcript = $1, decisions = $2 WHERE id = $3',
                    [JSON.stringify(transcript), JSON.stringify(decisions), meeting.id]);
            }

            if (msg.type === 'next-item') {
                currentItemIndex = Math.min((msg.index ?? currentItemIndex + 1), agenda.length - 1);
                ws.send(JSON.stringify({ type: 'next-item', itemIndex: currentItemIndex, item: agenda[currentItemIndex] }));
            }

            if (msg.type === 'present-item') {
                // Agent presents the current item
                const item = agenda[currentItemIndex];
                if (!item) return;

                const presenterIds = AGENT_ROLES_FOR_TYPE[item.type] || ['raul'];
                const presenterId = presenterIds[0];

                let agentInfo = { name: presenterId, role: '' };
                try {
                    const agentRes = await pool.query('SELECT name, role FROM agents WHERE id = $1', [presenterId]);
                    if (agentRes.rows.length > 0) agentInfo = agentRes.rows[0];
                } catch { /* ignore */ }

                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 300,
                    system: `You are ${agentInfo.name} (${agentInfo.role}) presenting an item in a weekly team meeting. Be brief and focused (3-4 sentences). Present the key points, current status, and ask for a decision (approve, reject, or modify).`,
                    messages: [{ role: 'user', content: `Present this ${item.type}: "${item.name}" (status: ${item.status})` }],
                });

                const aiText = response.content[0]?.text || '';
                transcript.push({ speaker: agentInfo.name, text: aiText, item: currentItemIndex, time: new Date().toISOString() });

                ws.send(JSON.stringify({ type: 'agent-presentation', agent: agentInfo.name, agentId: presenterId, text: aiText, item }));

                await pool.query('UPDATE meeting_sessions SET transcript = $1 WHERE id = $2', [JSON.stringify(transcript), meeting.id]);
            }

            if (msg.type === 'end-meeting') {
                // Generate summary
                const summaryPrompt = `Generate a concise meeting summary in markdown:\n\n## Items Discussed\n${agenda.slice(0, currentItemIndex + 1).map((a, i) => {
                    const dec = decisions.find(d => d.itemIndex === i);
                    return `- ${a.name} (${a.type}): ${dec ? dec.decision : 'discussed'}`;
                }).join('\n')}\n\n## Key Discussion Points\n${transcript.slice(-20).map(t => `- ${t.speaker}: ${t.text.slice(0, 100)}`).join('\n')}\n\nGenerate: ## Summary, ## Decisions, ## Action Items, ## Next Steps`;

                const summaryRes = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: summaryPrompt }],
                });

                const summaryMd = summaryRes.content[0]?.text || '';

                await pool.query(
                    'UPDATE meeting_sessions SET status = $1, summary_md = $2, completed_at = NOW(), duration_ms = $3 WHERE id = $4',
                    ['completed', summaryMd, Date.now() - new Date(meeting.started_at).getTime(), meeting.id]
                );

                ws.send(JSON.stringify({ type: 'meeting-summary', summary: summaryMd, decisions }));
            }

            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
    });

    ws.on('close', () => {
        console.log(`[Meeting WS] Disconnected: meeting=${meeting.id}`);
    });
}

// ─── Voice KB Handler (Gemini Live Speech-to-Speech + RAG) ──────────────────

const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';
const KB_NAMESPACES = ['campaigns', 'emails', 'images', 'kpis', 'research', 'brand'];

const SEARCH_KNOWLEDGE_TOOL = {
    name: 'searchKnowledge',
    description: 'Search the knowledge base for relevant information about campaigns, emails, KPIs, research, brand guidelines, and images. Use this tool whenever the user asks a question to ground your answer in real data.',
    parameters: {
        type: 'OBJECT',
        properties: {
            query: { type: 'STRING', description: 'The search query based on what the user is asking about' },
            needsVisuals: { type: 'BOOLEAN', description: 'Set to true ONLY if the user explicitly asks to SEE a document, image, picture, PDF, or email visually. If they just ask for information, data, or a list, set to false.' }
        },
        required: ['query']
    }
};

async function handleVoiceKB(ws, url) {
    const rawNs = url.searchParams.get('namespace') || '';
    const namespace = KB_NAMESPACES.includes(rawNs) ? rawNs : '';
    const lang = url.searchParams.get('lang') || 'es';

    console.log(`[Voice KB] Connected: namespace=${namespace || 'all'}, lang=${lang}`);

    // Verify Gemini and KB are ready
    const gemini = getGeminiClient();
    if (!gemini || !isKBReady()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Gemini or Knowledge Base not configured' }));
        ws.close();
        return;
    }

    const voiceLangName = lang === 'en' ? 'English' : 'Spanish';

    const systemPromptKB = `LANGUAGE: You MUST speak in ${voiceLangName}. All your responses must be in ${voiceLangName} only. Even if the knowledge base content is in another language, translate and respond in ${voiceLangName}.

You are the Knowledge Base voice assistant for AgentOS. You help users find and understand information from their knowledge base which includes campaigns, emails, KPIs, research, and brand guidelines.

CRITICAL INSTRUCTIONS:
1. ALWAYS respond in ${voiceLangName}. This is non-negotiable.
2. ALWAYS use the searchKnowledge tool to find relevant information BEFORE answering.
3. Base your responses ONLY on the retrieved knowledge. If no relevant information is found, say so honestly. Do not hallucinate.
4. Keep responses extremely concise, conversational, and direct (1-3 short sentences MAX).
5. DO NOT ramble, over-explain, or repeat yourself. Avoid long lists in voice; summarize them.
6. If the user asks for data (like a seed list), just read the data clearly. Only set needsVisuals to true if they explicitly ask to SEE the file/image/email.`;

    let session = null;

    try {
        session = await gemini.live.connect({
            model: GEMINI_LIVE_MODEL,
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction: systemPromptKB,
                tools: [{ functionDeclarations: [SEARCH_KNOWLEDGE_TOOL] }],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    console.log('[Voice KB] Gemini Live session opened');
                    ws.send(JSON.stringify({ type: 'ready' }));
                },
                onmessage: async (message) => {
                    try {
                        // Audio response from model
                        if (message.serverContent?.modelTurn?.parts) {
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData) {
                                    ws.send(JSON.stringify({
                                        type: 'audio',
                                        data: part.inlineData.data,
                                        mimeType: part.inlineData.mimeType,
                                    }));
                                }
                            }
                        }

                        // Input transcription (what user said)
                        if (message.serverContent?.inputTranscription?.text) {
                            ws.send(JSON.stringify({
                                type: 'input-transcript',
                                text: message.serverContent.inputTranscription.text,
                            }));
                        }

                        // Output transcription (what AI said)
                        if (message.serverContent?.outputTranscription?.text) {
                            ws.send(JSON.stringify({
                                type: 'output-transcript',
                                text: message.serverContent.outputTranscription.text,
                            }));
                        }

                        // Turn complete
                        if (message.serverContent?.turnComplete) {
                            ws.send(JSON.stringify({ type: 'turn-complete' }));
                        }

                        // Interrupted by user
                        if (message.serverContent?.interrupted) {
                            ws.send(JSON.stringify({ type: 'interrupted' }));
                        }

                        // Function calling (RAG search)
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'searchKnowledge') {
                                    const query = fc.args?.query || '';
                                    const needsVisuals = fc.args?.needsVisuals || false;
                                    console.log(`[Voice KB] RAG search: "${query}", visuals: ${needsVisuals}`);
                                    ws.send(JSON.stringify({ type: 'searching' }));

                                    try {
                                        const namespaces = namespace ? [namespace] : KB_NAMESPACES;
                                        const RAG_TIMEOUT_MS = 45000;
                                        const ragPromise = buildRAGContext(pool, query, {
                                            namespaces,
                                            maxTokens: 1500,
                                            visualQuery: needsVisuals,
                                            mode: 'voice',
                                            maxMedia: 2,
                                        });
                                        const timeoutPromise = new Promise((_, reject) =>
                                            setTimeout(() => reject(new Error('RAG timeout')), RAG_TIMEOUT_MS)
                                        );

                                        let context, sources, mediaResults;
                                        try {
                                            ({ context, sources, mediaResults } = await Promise.race([ragPromise, timeoutPromise]));
                                        } catch (timeoutErr) {
                                            console.warn(`[Voice KB] RAG timed out after ${RAG_TIMEOUT_MS}ms for: "${query}"`);
                                            context = 'Knowledge base search timed out. Please try a simpler question.';
                                            sources = [];
                                            mediaResults = [];
                                        }

                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: context || 'No relevant information found in the knowledge base.' },
                                            }],
                                        });

                                        ws.send(JSON.stringify({ type: 'rag-sources', sources: sources || [] }));
                                        
                                        // Always send media results to frontend — user can see the screen even in voice mode
                                        ws.send(JSON.stringify({ type: 'rag-media', media: mediaResults || [] }));
                                    } catch (ragErr) {
                                        console.error('[Voice KB] RAG error:', ragErr.message);
                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: 'Error searching the knowledge base. Please try again.' },
                                            }],
                                        });
                                    }
                                }
                            }
                        }

                        // Tool call cancellation
                        if (message.toolCallCancellation) {
                            console.log('[Voice KB] Tool call cancelled:', message.toolCallCancellation.ids);
                        }

                        // Session expiring warning
                        if (message.goAway) {
                            ws.send(JSON.stringify({
                                type: 'warning',
                                message: 'Voice session will expire soon',
                                timeLeft: message.goAway.timeLeft,
                            }));
                        }
                    } catch (err) {
                        console.error('[Voice KB] Message handling error:', err.message);
                    }
                },
                onerror: (err) => {
                    console.error('[Voice KB] Gemini Live error:', err);
                    try {
                        ws.send(JSON.stringify({ type: 'error', message: 'Voice session error' }));
                    } catch { /* ws may be closed */ }
                },
                onclose: (event) => {
                    console.log('[Voice KB] Gemini Live session closed');
                    try {
                        ws.send(JSON.stringify({ type: 'session-closed' }));
                    } catch { /* ws may be closed */ }
                },
            },
        });
    } catch (err) {
        console.error('[Voice KB] Failed to create Gemini Live session:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to start voice session. Please try again.' }));
        ws.close();
        return;
    }

    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'audio' && session) {
                session.sendRealtimeInput({
                    audio: { data: msg.data, mimeType: msg.mimeType || 'audio/pcm;rate=16000' },
                });
            }

            if (msg.type === 'text' && session) {
                session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: msg.text }] }],
                    turnComplete: true,
                });
            }

            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            console.error('[Voice KB] Client message error:', err.message);
        }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
        console.log('[Voice KB] Client disconnected');
        if (session) {
            try { session.close(); } catch { /* ignore */ }
            session = null;
        }
    });

    ws.on('error', (err) => {
        console.error('[Voice KB] WebSocket error:', err.message);
        if (session) {
            try { session.close(); } catch { /* ignore */ }
            session = null;
        }
    });
}

// ─── Voice Agent Handler (Gemini Live Speech-to-Speech + RAG per agent) ─────

function buildAgentVoicePrompt(agent, profile, lang) {
    const langName = lang === 'en' ? 'English' : 'Spanish';
    const skills = Array.isArray(agent.skills) ? agent.skills.join(', ') : '';
    const tools = Array.isArray(agent.tools) ? agent.tools.join(', ') : '';

    return `LANGUAGE: You MUST speak in ${langName}. All your responses must be in ${langName} only. Even if the knowledge base content is in another language, translate and respond in ${langName}.

You are ${agent.name}, an AI agent in the ${agent.department} department.
Role: ${agent.role}
${skills ? `Skills: ${skills}` : ''}
${tools ? `Tools: ${tools}` : ''}

${profile.personality}

VOICE BEHAVIOR:
${profile.voiceRules}

CRITICAL INSTRUCTIONS:
1. ALWAYS respond in ${langName}. This is non-negotiable.
2. ALWAYS use the searchKnowledge tool to find relevant information BEFORE answering questions about campaigns, emails, KPIs, brand, research, or any work-related topic.
3. Base your responses ONLY on the retrieved knowledge. If no relevant information is found, say so honestly. Do not hallucinate.
4. Stay in character as ${agent.name} at all times — your perspective, tone, and expertise should reflect your role.
5. DO NOT ramble, over-explain, or repeat yourself. Voice responses must be extremely concise.`;
}

async function handleVoiceAgent(ws, url) {
    const agentId = url.searchParams.get('agentId');
    const lang = url.searchParams.get('lang') || 'es';

    if (!agentId) {
        ws.send(JSON.stringify({ type: 'error', message: 'agentId is required' }));
        ws.close();
        return;
    }

    console.log(`[Voice Agent] Connected: agent=${agentId}, lang=${lang}`);

    // Verify Gemini and KB are ready
    const gemini = getGeminiClient();
    if (!gemini || !isKBReady()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Gemini or Knowledge Base not configured' }));
        ws.close();
        return;
    }

    // Fetch agent from DB
    let agent;
    try {
        const agentRes = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
        if (agentRes.rows.length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: `Agent ${agentId} not found` }));
            ws.close();
            return;
        }
        agent = agentRes.rows[0];
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to load agent' }));
        ws.close();
        return;
    }

    // Load profile and build prompt (DB overrides take precedence)
    const profile = getAgentProfile(agentId);
    const effectiveProfile = {
        ...profile,
        personality: agent.personality || profile.personality,
        voiceName: agent.voice_name || profile.voiceName,
        voiceRules: agent.voice_rules || profile.voiceRules,
        ragNamespaces: (Array.isArray(agent.rag_namespaces) && agent.rag_namespaces.length > 0)
            ? agent.rag_namespaces : profile.ragNamespaces,
    };
    const systemPrompt = buildAgentVoicePrompt(agent, effectiveProfile, lang);

    // Build tool declarations: searchKnowledge + any custom tools
    const toolDeclarations = [SEARCH_KNOWLEDGE_TOOL, ...profile.customTools];

    let session = null;

    try {
        session = await gemini.live.connect({
            model: GEMINI_LIVE_MODEL,
            config: {
                responseModalities: ['AUDIO'],
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: toolDeclarations }],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: effectiveProfile.voiceName } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    console.log(`[Voice Agent] Gemini Live session opened for ${agent.name}`);
                    ws.send(JSON.stringify({ type: 'ready' }));
                },
                onmessage: async (message) => {
                    try {
                        // Audio response from model
                        if (message.serverContent?.modelTurn?.parts) {
                            for (const part of message.serverContent.modelTurn.parts) {
                                if (part.inlineData) {
                                    ws.send(JSON.stringify({
                                        type: 'audio',
                                        data: part.inlineData.data,
                                        mimeType: part.inlineData.mimeType,
                                    }));
                                }
                            }
                        }

                        // Input transcription (what user said)
                        if (message.serverContent?.inputTranscription?.text) {
                            ws.send(JSON.stringify({
                                type: 'input-transcript',
                                text: message.serverContent.inputTranscription.text,
                            }));
                        }

                        // Output transcription (what AI said)
                        if (message.serverContent?.outputTranscription?.text) {
                            ws.send(JSON.stringify({
                                type: 'output-transcript',
                                text: message.serverContent.outputTranscription.text,
                            }));
                        }

                        // Turn complete
                        if (message.serverContent?.turnComplete) {
                            ws.send(JSON.stringify({ type: 'turn-complete' }));
                        }

                        // Interrupted by user
                        if (message.serverContent?.interrupted) {
                            ws.send(JSON.stringify({ type: 'interrupted' }));
                        }

                        // Function calling (RAG search)
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'searchKnowledge') {
                                    const query = fc.args?.query || '';
                                    const needsVisuals = fc.args?.needsVisuals || false;
                                    console.log(`[Voice Agent] RAG search (${agent.name}): "${query}", visuals: ${needsVisuals}`);
                                    ws.send(JSON.stringify({ type: 'searching' }));

                                    try {
                                        const namespaces = profile.ragNamespaces;
                                        const RAG_TIMEOUT_MS = 45000;
                                        const ragPromise = buildRAGContext(pool, query, {
                                            namespaces,
                                            maxTokens: 1500,
                                            visualQuery: needsVisuals,
                                            mode: 'voice',
                                            maxMedia: 2,
                                        });
                                        const timeoutPromise = new Promise((_, reject) =>
                                            setTimeout(() => reject(new Error('RAG timeout')), RAG_TIMEOUT_MS)
                                        );

                                        let context, sources, mediaResults;
                                        try {
                                            ({ context, sources, mediaResults } = await Promise.race([ragPromise, timeoutPromise]));
                                        } catch (timeoutErr) {
                                            console.warn(`[Voice Agent] RAG timed out after ${RAG_TIMEOUT_MS}ms for: "${query}"`);
                                            context = 'Knowledge base search timed out. Please try a simpler question.';
                                            sources = [];
                                            mediaResults = [];
                                        }

                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: context || 'No relevant information found in the knowledge base.' },
                                            }],
                                        });

                                        ws.send(JSON.stringify({ type: 'rag-sources', sources: sources || [] }));
                                        ws.send(JSON.stringify({ type: 'rag-media', media: mediaResults || [] }));
                                    } catch (ragErr) {
                                        console.error(`[Voice Agent] RAG error (${agent.name}):`, ragErr.message);
                                        session.sendToolResponse({
                                            functionResponses: [{
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: 'Error searching the knowledge base. Please try again.' },
                                            }],
                                        });
                                    }
                                }
                            }
                        }

                        // Tool call cancellation
                        if (message.toolCallCancellation) {
                            console.log(`[Voice Agent] Tool call cancelled:`, message.toolCallCancellation.ids);
                        }

                        // Session expiring warning
                        if (message.goAway) {
                            ws.send(JSON.stringify({
                                type: 'warning',
                                message: 'Voice session will expire soon',
                                timeLeft: message.goAway.timeLeft,
                            }));
                        }
                    } catch (err) {
                        console.error(`[Voice Agent] Message handling error (${agent.name}):`, err.message);
                    }
                },
                onerror: (err) => {
                    console.error(`[Voice Agent] Gemini Live error (${agent.name}):`, err);
                    try {
                        ws.send(JSON.stringify({ type: 'error', message: 'Voice session error' }));
                    } catch { /* ws may be closed */ }
                },
                onclose: () => {
                    console.log(`[Voice Agent] Gemini Live session closed for ${agent.name}`);
                    try {
                        ws.send(JSON.stringify({ type: 'session-closed' }));
                    } catch { /* ws may be closed */ }
                },
            },
        });
    } catch (err) {
        console.error(`[Voice Agent] Failed to create Gemini Live session for ${agent.name}:`, err.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to start voice session. Please try again.' }));
        ws.close();
        return;
    }

    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'audio' && session) {
                session.sendRealtimeInput({
                    audio: { data: msg.data, mimeType: msg.mimeType || 'audio/pcm;rate=16000' },
                });
            }

            if (msg.type === 'text' && session) {
                session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: msg.text }] }],
                    turnComplete: true,
                });
            }

            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (err) {
            console.error(`[Voice Agent] Client message error (${agent.name}):`, err.message);
        }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
        console.log(`[Voice Agent] Client disconnected: ${agent.name}`);
        if (session) {
            try { session.close(); } catch { /* ignore */ }
            session = null;
        }
    });

    ws.on('error', (err) => {
        console.error(`[Voice Agent] WebSocket error (${agent.name}):`, err.message);
        if (session) {
            try { session.close(); } catch { /* ignore */ }
            session = null;
        }
    });
}

// ─── Meeting REST Endpoints ─────────────────────────────────────────────────

app.get('/api/meetings', requireAuth, async (req, res) => {
    try {
        const { department, status } = req.query;
        let where = 'WHERE 1=1';
        const params = [];
        if (department) { params.push(department); where += ` AND department = $${params.length}`; }
        if (status) { params.push(status); where += ` AND status = $${params.length}`; }
        const result = await pool.query(`SELECT id, department, status, agenda, decisions, summary_md, started_at, completed_at, duration_ms FROM meeting_sessions ${where} ORDER BY started_at DESC LIMIT 20`, params);
        res.json({ meetings: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/meetings/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM meeting_sessions WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/meetings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM meeting_sessions WHERE id = $1', [req.params.id]);
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE BETWEEN AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

async function logAuditTx(client, eventType, department, agentId, title, details) {
    await client.query(
        `INSERT INTO audit_log (event_type, department, agent_id, title, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventType, department, agentId, title, (details || '').substring(0, 500)]
    );
}

// POST /api/projects/:id/pipeline — Create pipeline from template
app.post('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { template_id, stages } = req.body;
        if (!stages || !Array.isArray(stages) || stages.length === 0) {
            return res.status(400).json({ error: 'stages array is required' });
        }

        const projRes = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId]);
        if (projRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

        const existingRes = await pool.query('SELECT id FROM project_pipeline WHERE project_id = $1', [projectId]);
        if (existingRes.rows.length > 0) return res.status(409).json({ error: 'Pipeline already exists for this project' });

        const agentIds = stages.filter(s => s.agent_id).map(s => s.agent_id);
        if (agentIds.length > 0) {
            const agentsRes = await pool.query('SELECT id FROM agents WHERE id = ANY($1)', [agentIds]);
            const foundIds = new Set(agentsRes.rows.map(r => r.id));
            const missing = agentIds.filter(id => !foundIds.has(id));
            if (missing.length > 0) return res.status(400).json({ error: `Agents not found: ${missing.join(', ')}` });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pipelineRes = await client.query(
                `INSERT INTO project_pipeline (project_id, template_id) VALUES ($1, $2) RETURNING *`,
                [projectId, template_id || null]
            );
            const pipeline = pipelineRes.rows[0];

            for (let i = 0; i < stages.length; i++) {
                const s = stages[i];
                await client.query(
                    `INSERT INTO pipeline_stages (pipeline_id, stage_order, name, agent_id, department, description, depends_on, gate_type, namespaces)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [pipeline.id, i, s.name, s.agent_id, s.department || null, s.description || null,
                     s.depends_on || [], s.gate_type || 'none', s.namespaces || []]
                );
            }

            for (let i = 0; i < stages.length; i++) {
                const s = stages[i];
                const isFirstStage = !s.depends_on || s.depends_on.length === 0;
                await client.query(
                    `INSERT INTO project_agent_sessions (project_id, pipeline_id, agent_id, stage_name, stage_order, status, started_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [projectId, pipeline.id, s.agent_id, s.name, i,
                     isFirstStage ? 'active' : 'pending',
                     isFirstStage ? new Date() : null]
                );
            }

            await logAuditTx(client, 'pipeline_created', stages[0]?.department, null,
                `Pipeline created for project #${projectId}`,
                `Template: ${template_id || 'custom'}, ${stages.length} stages`);

            await client.query('COMMIT');
            res.status(201).json(pipeline);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/:id/pipeline — Full pipeline state (single JOIN query)
app.get('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const result = await pool.query(
            `SELECT pp.*,
                (SELECT json_agg(
                    json_build_object(
                        'id', ps.id, 'stage_order', ps.stage_order, 'name', ps.name,
                        'agent_id', ps.agent_id, 'department', ps.department,
                        'description', ps.description, 'depends_on', ps.depends_on,
                        'gate_type', ps.gate_type, 'namespaces', ps.namespaces
                    ) ORDER BY ps.stage_order
                ) FROM pipeline_stages ps WHERE ps.pipeline_id = pp.id) as stages,
                (SELECT json_agg(
                    json_build_object(
                        'id', pas.id, 'agent_id', pas.agent_id,
                        'stage_name', pas.stage_name, 'stage_order', pas.stage_order,
                        'status', pas.status, 'summary', pas.summary,
                        'summary_edited', pas.summary_edited, 'deliverables', pas.deliverables,
                        'started_at', pas.started_at, 'completed_at', pas.completed_at
                    ) ORDER BY pas.stage_order
                ) FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id) as sessions
            FROM project_pipeline pp
            WHERE pp.project_id = $1`,
            [projectId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No pipeline found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/projects/:id/pipeline — Cancel pipeline
app.delete('/api/projects/:id/pipeline', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const result = await pool.query(
            'DELETE FROM project_pipeline WHERE project_id = $1 RETURNING id',
            [projectId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No pipeline found' });
        await logAudit('pipeline_deleted', null, null,
            `Pipeline deleted for project #${projectId}`, '');
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/projects/:id/pipeline/handoff — 2-phase handoff (AI summary + atomic DB)
app.post('/api/projects/:id/pipeline/handoff', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const { session_id, summary_override, notes } = req.body;
        if (!session_id) return res.status(400).json({ error: 'session_id is required' });

        const sessionRes = await pool.query(
            `SELECT pas.*, a.name as agent_name, a.role as agent_role,
                    pp.id as pipeline_id, pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.id = $1 AND pas.project_id = $2`,
            [session_id, projectId]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const currentSession = sessionRes.rows[0];

        if (!['active', 'awaiting_handoff'].includes(currentSession.status)) {
            return res.status(409).json({ error: `Session status is ${currentSession.status}, cannot handoff` });
        }
        if (currentSession.pipeline_status !== 'active') {
            return res.status(409).json({ error: `Pipeline is ${currentSession.pipeline_status}` });
        }

        const blockers = await pool.query(
            `SELECT count(*) FROM collaboration_raises
             WHERE pipeline_session_id = $1 AND status = 'open' AND raise_type = 'blocker'`,
            [session_id]
        );
        if (parseInt(blockers.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Cannot handoff with open blockers' });
        }

        const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        const project = projRes.rows[0];

        const stageRes = await pool.query(
            `SELECT * FROM pipeline_stages WHERE pipeline_id = $1 AND stage_order = $2`,
            [currentSession.pipeline_id, currentSession.stage_order]
        );
        const currentStage = stageRes.rows[0];

        if (currentStage.gate_type === 'human_approval' && !req.body.gate_approved) {
            return res.status(409).json({ error: 'Human approval required for this stage', gate_required: true });
        }

        const nextStagesPreview = await pool.query(
            `SELECT ps.*, a.name as agent_name, a.role as agent_role
             FROM pipeline_stages ps
             JOIN agents a ON a.id = ps.agent_id
             WHERE ps.pipeline_id = $1 AND ps.stage_order > $2
             ORDER BY ps.stage_order LIMIT 2`,
            [currentSession.pipeline_id, currentSession.stage_order]
        );
        const nextAgentInfo = nextStagesPreview.rows.length > 0
            ? { name: nextStagesPreview.rows[0].agent_name, role: nextStagesPreview.rows[0].agent_role }
            : { name: 'the team', role: 'project completion' };

        // ── PHASE A: Generate AI summary (outside transaction) ──
        let handoffData;
        if (summary_override) {
            handoffData = {
                summary: summary_override,
                decisions_made: ['User-provided summary'],
                deliverables: [],
                open_questions: [],
                context_for_next: notes || ''
            };
        } else {
            const messagesRes = await pool.query(
                `SELECT role, content FROM pipeline_session_messages
                 WHERE session_id = $1 ORDER BY created_at`,
                [session_id]
            );
            const conversation = messagesRes.rows.map(m => ({ role: m.role, content: m.content }));

            try {
                handoffData = await generateHandoffSummary(
                    conversation,
                    { name: project.name },
                    { name: currentStage.name, agentName: currentSession.agent_name },
                    nextAgentInfo
                );
            } catch (aiErr) {
                return res.status(502).json({ error: `AI summary generation failed: ${aiErr.message}` });
            }
        }

        // ── PHASE B: Atomic DB update (inside transaction) ──
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pipeline = (await client.query(
                'SELECT * FROM project_pipeline WHERE id = $1 FOR UPDATE',
                [currentSession.pipeline_id]
            )).rows[0];

            if (pipeline.status !== 'active') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Pipeline is ${pipeline.status}` });
            }

            await client.query(
                `UPDATE project_agent_sessions
                 SET status = 'completed', summary = $1, deliverables = $2, completed_at = NOW()
                 WHERE id = $3 AND status IN ('active', 'awaiting_handoff')`,
                [handoffData.summary, JSON.stringify(handoffData), session_id]
            );

            const nextStages = await client.query(
                `SELECT ps.* FROM pipeline_stages ps
                 WHERE ps.pipeline_id = $1
                 AND NOT EXISTS (
                     SELECT 1 FROM unnest(ps.depends_on) AS dep
                     WHERE dep NOT IN (
                         SELECT stage_order FROM project_agent_sessions
                         WHERE pipeline_id = $1 AND status = 'completed'
                     )
                 )
                 AND ps.stage_order NOT IN (
                     SELECT stage_order FROM project_agent_sessions
                     WHERE pipeline_id = $1 AND status IN ('active', 'completed', 'skipped')
                 )`,
                [pipeline.id]
            );

            for (const stage of nextStages.rows) {
                await client.query(
                    `UPDATE project_agent_sessions
                     SET status = 'active', started_at = NOW()
                     WHERE pipeline_id = $1 AND stage_order = $2`,
                    [pipeline.id, stage.stage_order]
                );
            }

            const remaining = await client.query(
                `SELECT count(*) FROM project_agent_sessions
                 WHERE pipeline_id = $1 AND status IN ('pending', 'active', 'awaiting_handoff')`,
                [pipeline.id]
            );
            if (parseInt(remaining.rows[0].count) === 0) {
                await client.query(
                    "UPDATE project_pipeline SET status = 'completed', updated_at = NOW() WHERE id = $1",
                    [pipeline.id]
                );
            }

            await logAuditTx(client, 'pipeline_handoff', currentStage.department, currentSession.agent_id,
                `Pipeline handoff: ${currentStage.name} completed`,
                handoffData.summary);

            for (const stage of nextStages.rows) {
                await client.query(
                    `INSERT INTO collaboration_raises
                     (from_agent, to_agent, raise_type, title, details, status, pipeline_session_id)
                     VALUES ($1, $2, 'handoff', $3, $4, 'resolved', $5)`,
                    [currentSession.agent_id, stage.agent_id,
                     `Handoff: ${currentStage.name} -> ${stage.name}`,
                     handoffData.context_for_next,
                     session_id]
                );
            }

            await client.query('COMMIT');

            const updatedPipeline = await pool.query(
                `SELECT pp.*,
                    (SELECT json_agg(json_build_object(
                        'id', pas.id, 'agent_id', pas.agent_id,
                        'stage_name', pas.stage_name, 'stage_order', pas.stage_order,
                        'status', pas.status, 'summary', pas.summary,
                        'completed_at', pas.completed_at
                    ) ORDER BY pas.stage_order)
                    FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id) as sessions
                FROM project_pipeline pp WHERE pp.id = $1`,
                [pipeline.id]
            );
            res.json({ handoff: handoffData, pipeline: updatedPipeline.rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// POST /api/projects/:id/pipeline/pause
app.post('/api/projects/:id/pipeline/pause', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE project_pipeline SET status = 'paused', updated_at = NOW() WHERE project_id = $1 AND status = 'active' RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No active pipeline found' });
        await logAudit('pipeline_paused', null, null, `Pipeline paused for project #${req.params.id}`, '');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:id/pipeline/resume
app.post('/api/projects/:id/pipeline/resume', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE project_pipeline SET status = 'active', updated_at = NOW() WHERE project_id = $1 AND status = 'paused' RETURNING *",
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No paused pipeline found' });
        await logAudit('pipeline_resumed', null, null, `Pipeline resumed for project #${req.params.id}`, '');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:id/pipeline/stages/:order/skip
app.post('/api/projects/:id/pipeline/stages/:order/skip', requireAuth, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const stageOrder = parseInt(req.params.order);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pipeline = (await client.query(
                'SELECT * FROM project_pipeline WHERE project_id = $1 FOR UPDATE', [projectId]
            )).rows[0];
            if (!pipeline) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pipeline not found' }); }

            await client.query(
                `UPDATE project_agent_sessions SET status = 'skipped', completed_at = NOW()
                 WHERE pipeline_id = $1 AND stage_order = $2 AND status IN ('pending', 'active')`,
                [pipeline.id, stageOrder]
            );

            const nextStages = await client.query(
                `SELECT ps.* FROM pipeline_stages ps
                 WHERE ps.pipeline_id = $1
                 AND NOT EXISTS (
                     SELECT 1 FROM unnest(ps.depends_on) AS dep
                     WHERE dep NOT IN (
                         SELECT stage_order FROM project_agent_sessions
                         WHERE pipeline_id = $1 AND status IN ('completed', 'skipped')
                     )
                 )
                 AND ps.stage_order NOT IN (
                     SELECT stage_order FROM project_agent_sessions
                     WHERE pipeline_id = $1 AND status IN ('active', 'completed', 'skipped')
                 )`,
                [pipeline.id]
            );

            for (const stage of nextStages.rows) {
                await client.query(
                    `UPDATE project_agent_sessions SET status = 'active', started_at = NOW()
                     WHERE pipeline_id = $1 AND stage_order = $2`,
                    [pipeline.id, stage.stage_order]
                );
            }

            await logAuditTx(client, 'pipeline_stage_skipped', null, null,
                `Stage ${stageOrder} skipped in project #${projectId}`, '');
            await client.query('COMMIT');
            res.json({ skipped: true, activated: nextStages.rows.map(s => s.stage_order) });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/projects/:id/sessions/:sessionId/messages — Paginated messages
app.get('/api/projects/:id/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const result = await pool.query(
            `SELECT * FROM pipeline_session_messages
             WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
            [req.params.sessionId, limit, offset]
        );
        const countRes = await pool.query(
            'SELECT count(*) FROM pipeline_session_messages WHERE session_id = $1',
            [req.params.sessionId]
        );
        res.json({ messages: result.rows, total: parseInt(countRes.rows[0].count) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/projects/:id/sessions/:sessionId/messages — Clear chat history for a session
app.delete('/api/projects/:id/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM pipeline_session_messages WHERE session_id = $1', [req.params.sessionId]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/projects/:id/sessions/:sessionId/initialize — Agent speaks first (auto-init)
app.post('/api/projects/:id/sessions/:sessionId/initialize', requireAuth, async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const projectId = parseInt(req.params.id);

        // 1. Validate session exists, is active, and has zero messages
        const sessionRes = await pool.query(
            `SELECT pas.*, a.name as agent_name, a.role as agent_role,
                    a.department as agent_department, a.skills as agent_skills, a.tools as agent_tools,
                    ps.description as stage_description, ps.namespaces as stage_namespaces,
                    pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN pipeline_stages ps ON ps.pipeline_id = pas.pipeline_id AND ps.stage_order = pas.stage_order
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.id = $1 AND pas.project_id = $2`,
            [sessionId, projectId]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const session = sessionRes.rows[0];

        if (session.status !== 'active') return res.status(409).json({ error: `Session is ${session.status}` });

        const msgCountRes = await pool.query(
            'SELECT count(*) FROM pipeline_session_messages WHERE session_id = $1',
            [sessionId]
        );
        if (parseInt(msgCountRes.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Session already has messages' });
        }

        // 2. Build context (same pattern as /chat)
        const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        const project = projRes.rows[0];

        const completedRes = await pool.query(
            `SELECT pas.*, a.name as agent_name
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             WHERE pas.pipeline_id = $1 AND pas.status = 'completed'
             ORDER BY pas.stage_order`,
            [session.pipeline_id]
        );
        const accumulatedContext = buildAccumulatedContext(completedRes.rows, session.stage_order);

        const ragNamespaces = session.stage_namespaces && session.stage_namespaces.length > 0
            ? session.stage_namespaces
            : ['campaigns', 'kpis'];
        const ragResult = typeof isKBReady === 'function' && isKBReady()
            ? await buildRAGContext(pool, project.name + ' ' + (project.problem || ''), { namespaces: ragNamespaces })
            : { context: '', sources: [] };

        const agent = {
            name: session.agent_name, role: session.agent_role,
            department: session.agent_department,
            skills: session.agent_skills, tools: session.agent_tools
        };
        const stage = { name: session.stage_name, description: session.stage_description };
        let systemPrompt = buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragResult.context);

        // 3. Append initial message instructions
        systemPrompt += `\n\n## INITIAL MESSAGE
This is your very first message in this stage session. You MUST:
1. Briefly introduce yourself (name and role, 1 sentence)
2. Acknowledge the project and your specific task for this stage
3. If there is previous work context from other agents, briefly summarize what you received and how it informs your approach
4. Ask 1-2 focused questions to begin your work effectively
Keep it concise (3-4 paragraphs max). Be warm but professional.`;

        // 4. Stream response (no user message persisted)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources.map(({ htmlSource, ...s }) => s)));
        }
        res.flushHeaders();

        let fullResponse = '';
        const stream = await chatWithPMAgent(
            [{ role: 'user', content: '[SESSION_INIT] The session has just started. Introduce yourself and begin.' }],
            { stream: true, systemPromptOverride: systemPrompt }
        );

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;
        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        // 5. Persist ONLY the assistant message
        await pool.query(
            `INSERT INTO pipeline_session_messages (session_id, role, content, metadata)
             VALUES ($1, 'assistant', $2, $3)`,
            [sessionId, fullResponse, JSON.stringify({ auto_generated: true, rag_sources: ragResult.sources })]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// POST /api/projects/:id/sessions/:sessionId/chat — SSE streaming chat in pipeline
app.post('/api/projects/:id/sessions/:sessionId/chat', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        const sessionId = parseInt(req.params.sessionId);
        const projectId = parseInt(req.params.id);
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const sessionRes = await pool.query(
            `SELECT pas.*, a.name as agent_name, a.role as agent_role,
                    a.department as agent_department, a.skills as agent_skills, a.tools as agent_tools,
                    ps.description as stage_description, ps.namespaces as stage_namespaces,
                    pp.status as pipeline_status
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             JOIN pipeline_stages ps ON ps.pipeline_id = pas.pipeline_id AND ps.stage_order = pas.stage_order
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             WHERE pas.id = $1 AND pas.project_id = $2`,
            [sessionId, projectId]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        const session = sessionRes.rows[0];

        if (session.status !== 'active') return res.status(409).json({ error: `Session is ${session.status}` });
        if (session.pipeline_status !== 'active') return res.status(409).json({ error: 'Pipeline is not active' });

        const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
        const project = projRes.rows[0];

        const completedRes = await pool.query(
            `SELECT pas.*, a.name as agent_name
             FROM project_agent_sessions pas
             JOIN agents a ON a.id = pas.agent_id
             WHERE pas.pipeline_id = $1 AND pas.status = 'completed'
             ORDER BY pas.stage_order`,
            [session.pipeline_id]
        );
        const accumulatedContext = buildAccumulatedContext(completedRes.rows, session.stage_order);

        const ragNamespaces = session.stage_namespaces && session.stage_namespaces.length > 0
            ? session.stage_namespaces
            : ['campaigns', 'kpis', 'research', 'emails'];
        const visualKeywords = /\b(show|display|ver|mostrar|look like|see|visualiz|email|imagen|image|picture|inline)\b/i;
        const isVisualQuery = visualKeywords.test(message);
        const ragResult = typeof isKBReady === 'function' && isKBReady()
            ? await buildRAGContext(pool, message, { namespaces: ragNamespaces, visualQuery: isVisualQuery, maxTokens: isVisualQuery ? 4000 : 3000, maxMedia: isVisualQuery ? 4 : 2 })
            : { context: '', sources: [], mediaResults: [] };

        const agent = {
            name: session.agent_name, role: session.agent_role,
            department: session.agent_department,
            skills: session.agent_skills, tools: session.agent_tools
        };
        const stage = { name: session.stage_name, description: session.stage_description };
        const systemPrompt = buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragResult.context);

        const historyRes = await pool.query(
            `SELECT role, content FROM pipeline_session_messages
             WHERE session_id = $1 ORDER BY created_at`,
            [sessionId]
        );
        let allMessages = historyRes.rows.map(m => ({ role: m.role, content: m.content }));
        allMessages.push({ role: 'user', content: message });
        const apiMessages = buildPipelineConversation(allMessages);

        await pool.query(
            `INSERT INTO pipeline_session_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
            [sessionId, message]
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (ragResult.sources?.length > 0) {
            res.setHeader('X-RAG-Sources', JSON.stringify(ragResult.sources.map(({ htmlSource, ...s }) => s)));
        }
        if (ragResult.mediaResults?.length > 0) {
            const otherMedia = ragResult.mediaResults.filter(m => m.mediaType !== 'email_html').map(({ htmlSource, ...m }) => m);
            if (otherMedia.length > 0) res.setHeader('X-RAG-Media', JSON.stringify(otherMedia));
        }
        res.flushHeaders();

        // Send email html as SSE event (too large for HTTP headers)
        const pipelineHtmlSources = ragResult.sources?.filter(s => s.htmlSource) || [];
        const pipelineHtmlMedia = ragResult.mediaResults?.filter(m => m.mediaType === 'email_html' && m.htmlSource) || [];
        const allPipelineHtml = [...pipelineHtmlSources, ...pipelineHtmlMedia].filter((m, i, arr) => arr.findIndex(x => (x.title || x.documentTitle) === (m.title || m.documentTitle)) === i);
        if (allPipelineHtml.length > 0) {
            res.write(`data: ${JSON.stringify({ html_sources: allPipelineHtml.map(s => ({ htmlSource: s.htmlSource, title: s.title || s.documentTitle, filePath: s.filePath })) })}\n\n`);
        }

        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, {
            stream: true,
            systemPromptOverride: systemPrompt,
        });

        stream.on('text', (text) => {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        let streamEnded = false;
        stream.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });

        await stream.finalMessage();

        const stageReadyMatch = fullResponse.match(/\[STAGE_READY:\s*(.+?)\]/);
        if (stageReadyMatch) {
            res.write(`data: ${JSON.stringify({ handoff_suggestion: true, reason: stageReadyMatch[1] })}\n\n`);
            fullResponse = fullResponse.replace(/\[STAGE_READY:\s*.+?\]/, '').trim();
        }

        await pool.query(
            `INSERT INTO pipeline_session_messages (session_id, role, content, metadata)
             VALUES ($1, 'assistant', $2, $3)`,
            [sessionId, fullResponse, JSON.stringify({ rag_sources: ragResult.sources })]
        );

        if (!streamEnded) {
            streamEnded = true;
            res.write('data: [DONE]\n\n');
            res.end();
        }
    } catch (err) {
        if (res.headersSent && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// PATCH /api/projects/:id/sessions/:sessionId/summary — Edit handoff summary
app.patch('/api/projects/:id/sessions/:sessionId/summary', requireAuth, async (req, res) => {
    try {
        const { summary_edited } = req.body;
        const result = await pool.query(
            `UPDATE project_agent_sessions SET summary_edited = $1
             WHERE id = $2 AND project_id = $3 RETURNING *`,
            [summary_edited, req.params.sessionId, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/pipelines/active — All active pipelines (overview)
app.get('/api/pipelines/active', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pp.*, p.name as project_name, p.department as project_department,
                (SELECT count(*) FROM project_agent_sessions WHERE pipeline_id = pp.id AND status = 'completed') as completed_stages,
                (SELECT count(*) FROM pipeline_stages WHERE pipeline_id = pp.id) as total_stages,
                (SELECT json_agg(json_build_object(
                    'stage_name', pas.stage_name, 'agent_id', pas.agent_id, 'status', pas.status
                ) ORDER BY pas.stage_order)
                FROM project_agent_sessions pas WHERE pas.pipeline_id = pp.id AND pas.status = 'active') as active_stages
            FROM project_pipeline pp
            JOIN projects p ON p.id = pp.project_id
            WHERE pp.status IN ('active', 'paused')
            ORDER BY pp.updated_at DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agents/:agentId/active-sessions — Pipeline sessions for an agent
app.get('/api/agents/:agentId/active-sessions', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pas.*, p.name as project_name, p.id as project_id, pp.status as pipeline_status,
                ps.description as stage_description, ps.gate_type, ps.depends_on,
                (SELECT count(*) FROM pipeline_session_messages WHERE session_id = pas.id) as message_count
             FROM project_agent_sessions pas
             JOIN projects p ON p.id = pas.project_id
             JOIN project_pipeline pp ON pp.id = pas.pipeline_id
             JOIN pipeline_stages ps ON ps.pipeline_id = pp.id AND ps.stage_order = pas.stage_order
             WHERE pas.agent_id = $1 AND pas.status IN ('active', 'awaiting_handoff')
             ORDER BY
                CASE pas.status WHEN 'active' THEN 0 WHEN 'awaiting_handoff' THEN 1 ELSE 2 END,
                pas.started_at DESC NULLS LAST`,
            [req.params.agentId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agents/:agentId/pipeline-work — Completed pipeline work for an agent
app.get('/api/agents/:agentId/pipeline-work', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pas.id, pas.stage_name, pas.stage_order, pas.summary, pas.deliverables,
                    pas.started_at, pas.completed_at,
                    p.name as project_name, p.id as project_id,
                    ps.description as stage_description, ps.department
             FROM project_agent_sessions pas
             JOIN projects p ON p.id = pas.project_id
             JOIN project_pipeline pp ON pas.pipeline_id = pp.id
             JOIN pipeline_stages ps ON ps.pipeline_id = pp.id AND ps.stage_order = pas.stage_order
             WHERE pas.agent_id = $1 AND pas.status = 'completed'
             ORDER BY pas.completed_at DESC`,
            [req.params.agentId]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Static Files (production) — MUST be after all API routes ───────────────
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

server.listen(port, () => {
    console.log(`AgentOS API running at http://localhost:${port}`);
    console.log(`WebSocket: ws://localhost:${port}/ws/voice | ws://localhost:${port}/ws/voice-meeting`);
});
