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
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import { chatWithPMAgent, extractJSON, generateSummary, generateProject } from '../../packages/core/pm-agent/core.js';
import { saveProject } from '../../packages/core/db/save_project.js';
import { buildProjectContext } from '../../packages/core/pm-agent/context-builder.js';
import Anthropic from '@anthropic-ai/sdk';
import { generateEodReport } from '../../packages/core/workspace-skills/eod-generator.js';

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
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5434', 10),
        database: process.env.PG_DB || 'agentos',
        user: process.env.PG_USER || 'agentos',
        password: process.env.PG_PASSWORD || 'changeme',
    });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Session Middleware ──────────────────────────────────────────────────────

app.use(session({
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
}));

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
        const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
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

// ── Pipeline ──
app.get('/api/pipeline', async (req, res) => {
    try {
        const { department } = req.query;
        let query = `
            SELECT p.*,
                (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id) as total_tasks,
                (SELECT COUNT(*) FROM tasks t JOIN phases ph ON t.phase_id = ph.id WHERE ph.project_id = p.id AND t.status = 'Done') as done_tasks
            FROM projects p
        `;
        const params = [];
        if (department) {
            params.push(department);
            query += ` WHERE LOWER(p.department) = LOWER($${params.length})`;
        }
        query += ' ORDER BY p.updated_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
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

        // 9. Assemble & save report
        const report = {
            period: { week: week_number, start: startDate, end: endDate },
            tasks, blockers: allBlockers, mood, kpis,
            brainstorm_summary, inbox, vs_last_week,
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
        const projectContext = await buildProjectContext(pool);

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Inbox-Item-Id', item.id.toString());
        res.flushHeaders();

        // Stream response
        let fullResponse = '';
        const stream = await chatWithPMAgent(apiMessages, { stream: true, projectContext });

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

        console.log(`[to-borrador] Generating summary for item ${req.params.id} (${conversation.length} messages)...`);
        const summary = await generateSummary(conversation);
        console.log(`[to-borrador] Summary generated: ${summary.substring(0, 100)}...`);

        await pool.query(
            `UPDATE inbox_items
             SET summary = $1, conversation = '[]'::jsonb, status = 'borrador', updated_at = NOW()
             WHERE id = $2`,
            [summary, req.params.id]
        );

        res.json({ id: parseInt(req.params.id), status: 'borrador', summary });
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

        const { title, summary, status } = item.rows[0];
        if (status !== 'borrador') {
            return res.status(400).json({ error: `Cannot create project from status '${status}'` });
        }
        if (!summary) {
            return res.status(400).json({ error: 'No summary available' });
        }

        const projectContext = await buildProjectContext(pool);
        const { text, json: projectData } = await generateProject(title, summary, projectContext);

        if (!projectData) {
            return res.status(500).json({ error: 'PM Agent did not generate valid project JSON', response: text });
        }

        const projectId = await saveProject(projectData);

        await pool.query(
            `UPDATE inbox_items
             SET structured_data = $1, project_id = $2, status = 'proyecto', updated_at = NOW()
             WHERE id = $3`,
            [JSON.stringify(projectData), projectId, req.params.id]
        );

        res.json({ id: parseInt(req.params.id), status: 'proyecto', project_id: projectId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/inbox/:id/reopen ───────────────────────────────────────────────
app.post('/api/inbox/:id/reopen', async (req, res) => {
    try {
        const item = await pool.query('SELECT * FROM inbox_items WHERE id = $1', [req.params.id]);
        if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const { status, summary } = item.rows[0];
        if (status !== 'borrador') {
            return res.status(400).json({ error: `Cannot reopen from status '${status}'` });
        }

        const seedConversation = [
            { role: 'user', content: `Contexto previo (borrador anterior):\n${summary}\n\nQuiero seguir refinando esta idea.` }
        ];

        await pool.query(
            `UPDATE inbox_items
             SET status = 'chat', conversation = $1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(seedConversation), req.params.id]
        );

        res.json({ id: parseInt(req.params.id), status: 'chat' });
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

        // Build dynamic system prompt from agent profile
        const skills = Array.isArray(agent.skills) ? agent.skills.join(', ') : '';
        const tools = Array.isArray(agent.tools) ? agent.tools.join(', ') : '';
        const systemPrompt = `You are ${agent.name}, an AI agent working in the ${agent.department} department.

Your role: ${agent.role}
${skills ? `Your skills: ${skills}` : ''}
${tools ? `Your tools: ${tools}` : ''}

## Behavior Rules
1. Stay in character as ${agent.name}. Respond from the perspective of your role and expertise.
2. Be helpful, direct, and knowledgeable about your area of specialization.
3. When asked about topics outside your expertise, acknowledge the limits but offer what insight you can.
4. Keep responses concise and actionable.
5. You work as part of a team of AI agents managed through AgentOS.
6. Respond in the same language the user writes to you.`;

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

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Stream response via chatWithPMAgent with systemPromptOverride
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
        const { message, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const ctx = CAMPAIGN_CONTEXT[campaignId];
        if (!ctx) return res.status(404).json({ error: 'Campaign not found' });

        const systemPrompt = buildCampaignSystemPrompt(ctx);

        const apiMessages = [
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message },
        ];

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await chatWithPMAgent(apiMessages, {
            stream: true,
            systemPromptOverride: systemPrompt,
        });

        stream.on('text', (text) => {
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
        const allowedKeys = ['anthropic', 'confluence_url', 'confluence_token', 'jira_url', 'jira_email', 'jira_token', 'jira_project_key'];
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

// ─── Static Files (production) ───────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

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

app.listen(port, () => {
    console.log(`AgentOS API running at http://localhost:${port}`);
});
