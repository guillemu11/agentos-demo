-- ============================================================
-- AgentOS — Database Schema
-- ============================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── GESTIÓN DE PROYECTOS Y TAREAS ─────────────────────────────────────────

-- Tabla de Proyectos
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    problem TEXT,
    solution TEXT,
    success_metrics JSONB DEFAULT '[]',
    blocks JSONB DEFAULT '[]',
    department TEXT DEFAULT 'General',
    sub_area TEXT DEFAULT 'General',
    pain_points JSONB DEFAULT '[]',
    requirements JSONB DEFAULT '[]',
    risks JSONB DEFAULT '[]',
    estimated_budget DECIMAL DEFAULT 0,
    estimated_timeline TEXT DEFAULT 'TBD',
    future_improvements JSONB DEFAULT '[]',
    status TEXT DEFAULT 'Planning', -- Planning, In Progress, Completed, Paused
    type TEXT DEFAULT 'general', -- general, campaign, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Fases
CREATE TABLE IF NOT EXISTS phases (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    objective TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Tareas
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    phase_id INTEGER REFERENCES phases(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    agent TEXT, -- Data Agent, Dev Agent, etc.
    effort TEXT, -- S, M, L
    status TEXT DEFAULT 'Todo', -- Todo, In Progress, Done
    dependencies JSONB DEFAULT '[]',
    type TEXT DEFAULT 'Task', -- Task, Bug, Enhancement
    priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Critical
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- Triggers para updated_at en projects y tasks
CREATE OR REPLACE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AGENTES Y WORKSPACE ───────────────────────────────────────────────────

-- Tabla de Agentes
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY, -- ex: 'data-agent'
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL, -- data, dev, seo, etc.
    status TEXT DEFAULT 'idle', -- active, idle, offline
    avatar TEXT, -- emoji o URL
    skills JSONB DEFAULT '[]',
    tools JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE TRIGGER trg_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── MEMORIA DE AGENTES ────────────────────────────────────────────────────────

-- Tabla de estado persistente por agente (key-value store)
-- scope = 'private' → solo el agente propietario puede escribirla
-- scope = 'shared'  → cualquier agente puede leerla (cross-agent memory)
CREATE TABLE IF NOT EXISTS agent_memory (
    id          SERIAL PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'private' CHECK (scope IN ('private', 'shared')),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (agent_id, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent  ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_shared ON agent_memory(key) WHERE scope = 'shared';

CREATE OR REPLACE TRIGGER trg_agent_memory_updated_at
BEFORE UPDATE ON agent_memory
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── EOD REPORTS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eod_reports (
    id SERIAL PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_tasks JSONB DEFAULT '[]',
    in_progress_tasks JSONB DEFAULT '[]',
    blockers JSONB DEFAULT '[]',
    insights JSONB DEFAULT '[]',
    plan_tomorrow JSONB DEFAULT '[]',
    mood TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_eod_date ON eod_reports(date);

-- ─── RAW EVENTS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw_events (
    id SERIAL PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- tool_call, message, error, commit
    content JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_events_agent_date ON raw_events(agent_id, timestamp);

-- ─── WEEKLY SESSIONS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_sessions (
    id SERIAL PRIMARY KEY,
    department TEXT NOT NULL,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    week_number INTEGER NOT NULL,
    steps_data JSONB DEFAULT '{}',
    final_projects JSONB DEFAULT '[]',
    status TEXT DEFAULT 'active',
    report JSONB,
    inbox_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── WEEKLY BRAINSTORMS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_brainstorms (
    id SERIAL PRIMARY KEY,
    weekly_session_id INTEGER NOT NULL REFERENCES weekly_sessions(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    contribution_type TEXT CHECK (contribution_type IN ('proposal', 'improvement', 'concern', 'insight')),
    content TEXT NOT NULL,
    context JSONB,
    user_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_session ON weekly_brainstorms(weekly_session_id);

-- ─── INBOX ITEMS (Weekly Planning Hub) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_items (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT NOT NULL CHECK (source IN ('telegram', 'dashboard', 'agent')),
    source_user TEXT,
    department TEXT,
    status TEXT DEFAULT 'chat' CHECK (status IN ('chat', 'borrador', 'proyecto', 'discarded')),
    conversation JSONB DEFAULT '[]',
    summary TEXT,
    structured_data JSONB,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    weekly_session_id INTEGER REFERENCES weekly_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_department ON inbox_items(department);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_items(created_at DESC);

CREATE OR REPLACE TRIGGER trg_inbox_items_updated_at
BEFORE UPDATE ON inbox_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AUDIT LOG ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    department TEXT,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    details TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(date DESC);

-- ─── PM REPORTS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_reports (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    summary     TEXT,
    body_md     TEXT,
    metrics     JSONB DEFAULT '{}',
    risks       JSONB DEFAULT '[]',
    next_steps  JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_reports_created ON pm_reports(created_at DESC);

-- ─── WORKFLOW RUNS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_runs (
    id            SERIAL PRIMARY KEY,
    workflow_id   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed')),
    triggered_by  TEXT NOT NULL DEFAULT 'user'
                  CHECK (triggered_by IN ('user','schedule','agent')),
    started_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    duration_ms   INTEGER,
    prompt        TEXT,
    output_summary TEXT,
    error         TEXT,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS prompt TEXT;

CREATE INDEX IF NOT EXISTS idx_wf_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_wf_runs_started ON workflow_runs(started_at DESC);

-- ─── COLLABORATION RAISES ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collaboration_raises (
    id            SERIAL PRIMARY KEY,
    from_agent    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    to_agent      TEXT REFERENCES agents(id) ON DELETE SET NULL,
    raise_type    TEXT NOT NULL CHECK (raise_type IN ('question', 'blocker', 'handoff', 'fyi')),
    title         TEXT NOT NULL,
    details       TEXT,
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    resolution    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collab_raises_status ON collaboration_raises(status);
CREATE INDEX IF NOT EXISTS idx_collab_raises_from ON collaboration_raises(from_agent);

-- ─── WORKSPACE CONFIG ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTHENTICATION ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_workspace_users_updated_at
BEFORE UPDATE ON workspace_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (sid)
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- ─── AGENT CONVERSATIONS (per-agent chat) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_conversations (
    id         SERIAL PRIMARY KEY,
    agent_id   TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    messages   JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_conv_agent ON agent_conversations(agent_id);

CREATE OR REPLACE TRIGGER trg_agent_conversations_updated_at
BEFORE UPDATE ON agent_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── MIGRATIONS ───────────────────────────────────────────────────────────────

-- Add type column to projects (idempotent)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- ─── BRAINSTORM CONVERSATIONS (Multi-Agent) ────────────────────────────────

CREATE TABLE IF NOT EXISTS brainstorm_conversations (
    id                  SERIAL PRIMARY KEY,
    weekly_session_id   INTEGER NOT NULL REFERENCES weekly_sessions(id) ON DELETE CASCADE,
    mode                TEXT NOT NULL DEFAULT 'demo' CHECK (mode IN ('demo', 'live')),
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    current_project_index INTEGER DEFAULT 0,
    projects_order      JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_conv_session ON brainstorm_conversations(weekly_session_id);

CREATE OR REPLACE TRIGGER trg_brainstorm_conv_updated_at
BEFORE UPDATE ON brainstorm_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS brainstorm_messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES brainstorm_conversations(id) ON DELETE CASCADE,
    message_type    TEXT NOT NULL CHECK (message_type IN ('agent_message', 'human_message', 'system_message', 'pause_for_human')),
    agent_id        TEXT,
    content         TEXT NOT NULL,
    project_index   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_msg_conv ON brainstorm_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_brainstorm_msg_project ON brainstorm_messages(conversation_id, project_index);

-- Seed data is now in seed-emirates.sql
