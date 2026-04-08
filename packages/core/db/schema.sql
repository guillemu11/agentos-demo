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
    objective TEXT,
    target_audience TEXT,
    bau_type TEXT,
    markets JSONB DEFAULT '[]',
    pm_notes TEXT,
    key_metrics JSONB DEFAULT '[]',
    compliance_notes JSONB DEFAULT '[]',
    email_spec JSONB DEFAULT '{}',
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

-- ─── KNOWLEDGE BASE ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id              SERIAL PRIMARY KEY,
    namespace       TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    chunk_count     INTEGER DEFAULT 0,
    embedding_model TEXT DEFAULT 'gemini-embedding-001',
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kd_namespace ON knowledge_documents(namespace);
CREATE INDEX IF NOT EXISTS idx_kd_source ON knowledge_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_kd_status ON knowledge_documents(status);

CREATE OR REPLACE TRIGGER trg_knowledge_documents_updated_at
BEFORE UPDATE ON knowledge_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id            SERIAL PRIMARY KEY,
    document_id   INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index   INTEGER NOT NULL,
    content       TEXT NOT NULL,
    pinecone_id   TEXT UNIQUE,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kc_document ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kc_pinecone ON knowledge_chunks(pinecone_id);

-- ─── RESEARCH & EXPERIMENTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_sessions (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    topic           TEXT NOT NULL,
    depth           TEXT DEFAULT 'standard' CHECK (depth IN ('quick', 'standard', 'deep')),
    sources_mode    TEXT DEFAULT 'both' CHECK (sources_mode IN ('web', 'internal', 'both')),
    status          TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'researching', 'synthesizing', 'completed', 'failed')),
    progress        INTEGER DEFAULT 0,
    sources_found   INTEGER DEFAULT 0,
    iterations      INTEGER DEFAULT 0,
    max_iterations  INTEGER DEFAULT 5,
    report_md       TEXT,
    report_sections JSONB DEFAULT '[]',
    search_queries  JSONB DEFAULT '[]',
    sources         JSONB DEFAULT '[]',
    experiments     JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    error           TEXT,
    campaign_id     TEXT,
    department      TEXT,
    triggered_by    TEXT DEFAULT 'user',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rs_status ON research_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rs_created ON research_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_campaign ON research_sessions(campaign_id);

CREATE OR REPLACE TRIGGER trg_research_sessions_updated_at
BEFORE UPDATE ON research_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS campaign_experiments (
    id                  SERIAL PRIMARY KEY,
    campaign_id         TEXT NOT NULL,
    research_session_id INTEGER REFERENCES research_sessions(id),
    experiment_type     TEXT NOT NULL CHECK (experiment_type IN ('subject_line', 'copy', 'design', 'segmentation', 'send_time', 'cta')),
    hypothesis          TEXT NOT NULL,
    variant_a           JSONB NOT NULL,
    variant_b           JSONB NOT NULL,
    status              TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'running', 'completed', 'cancelled')),
    results             JSONB,
    winner              TEXT,
    confidence_level    NUMERIC,
    improvement_pct     NUMERIC,
    department          TEXT,
    applied_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_campaign ON campaign_experiments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ce_status ON campaign_experiments(status);

CREATE OR REPLACE TRIGGER trg_campaign_experiments_updated_at
BEFORE UPDATE ON campaign_experiments
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── EXPERIMENT LOOPS (AutoExperiment) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_loops (
    id                  SERIAL PRIMARY KEY,
    campaign_id         TEXT NOT NULL,
    name                TEXT NOT NULL,
    metric_target       TEXT NOT NULL CHECK (metric_target IN ('openRate', 'clickRate', 'conversionRate')),
    experiment_type     TEXT NOT NULL CHECK (experiment_type IN ('subject_line', 'copy', 'design', 'segmentation', 'send_time', 'cta')),
    status              TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'completed', 'failed')),
    cycle_count         INTEGER DEFAULT 0,
    max_cycles          INTEGER DEFAULT 20,
    cycle_interval      TEXT DEFAULT '4h',
    current_baseline    JSONB,
    best_result         JSONB,
    knowledge_md        TEXT DEFAULT '',
    total_improvement_pct NUMERIC DEFAULT 0,
    config              JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_el_campaign ON experiment_loops(campaign_id);
CREATE INDEX IF NOT EXISTS idx_el_status ON experiment_loops(status);

CREATE OR REPLACE TRIGGER trg_experiment_loops_updated_at
BEFORE UPDATE ON experiment_loops
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS experiment_cycles (
    id                  SERIAL PRIMARY KEY,
    loop_id             INTEGER NOT NULL REFERENCES experiment_loops(id) ON DELETE CASCADE,
    cycle_number        INTEGER NOT NULL,
    status              TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'deployed', 'measuring', 'evaluated', 'failed')),
    hypothesis          TEXT,
    baseline            JSONB,
    challenger          JSONB,
    baseline_metrics    JSONB,
    challenger_metrics  JSONB,
    winner              TEXT,
    improvement_pct     NUMERIC,
    learnings           TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_loop ON experiment_cycles(loop_id);

CREATE OR REPLACE TRIGGER trg_experiment_cycles_updated_at
BEFORE UPDATE ON experiment_cycles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── EMAIL PROPOSALS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_proposals (
    id                    SERIAL PRIMARY KEY,
    campaign_id           TEXT NOT NULL,
    variant_name          TEXT NOT NULL,
    market                TEXT NOT NULL,
    language              TEXT NOT NULL,
    tier                  TEXT,
    subject_line          TEXT,
    preview_text          TEXT,
    html_content          TEXT,
    copy_blocks           JSONB DEFAULT '{}',
    segmentation_logic    JSONB DEFAULT '{}',
    personalization_rules JSONB DEFAULT '[]',
    diff_from_base        JSONB,
    status                TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
    feedback              JSONB DEFAULT '[]',
    generated_by          TEXT DEFAULT 'ai',
    parent_proposal_id    INTEGER REFERENCES email_proposals(id),
    version               INTEGER DEFAULT 1,
    department            TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ep_campaign ON email_proposals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ep_market ON email_proposals(market, language);
CREATE INDEX IF NOT EXISTS idx_ep_status ON email_proposals(status);

CREATE OR REPLACE TRIGGER trg_email_proposals_updated_at
BEFORE UPDATE ON email_proposals
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── CAMPAIGN CONVERSATIONS (persistent chat) ──────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_conversations (
    id          SERIAL PRIMARY KEY,
    campaign_id TEXT NOT NULL UNIQUE,
    messages    JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_campaign ON campaign_conversations(campaign_id);

CREATE OR REPLACE TRIGGER trg_campaign_conversations_updated_at
BEFORE UPDATE ON campaign_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── MEETING SESSIONS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meeting_sessions (
    id                 SERIAL PRIMARY KEY,
    weekly_session_id  INTEGER REFERENCES weekly_sessions(id),
    department         TEXT NOT NULL,
    status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    agenda             JSONB DEFAULT '[]',
    transcript         JSONB DEFAULT '[]',
    decisions          JSONB DEFAULT '[]',
    participants       JSONB DEFAULT '[]',
    summary_md         TEXT,
    started_at         TIMESTAMPTZ DEFAULT NOW(),
    completed_at       TIMESTAMPTZ,
    duration_ms        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ms_weekly ON meeting_sessions(weekly_session_id);
CREATE INDEX IF NOT EXISTS idx_ms_status ON meeting_sessions(status);

-- ─── KNOWLEDGE BASE MULTIMODAL MIGRATIONS ──────────────────────────────────

-- Support for multimodal content (images, PDFs)
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file_size INTEGER;

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'text';
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS file_path TEXT;

CREATE INDEX IF NOT EXISTS idx_kd_content_type ON knowledge_documents(content_type);

-- ═══════════ PIPELINE SYSTEM ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_pipeline (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    template_id TEXT,
    current_stage_order INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_pipeline_status ON project_pipeline(status);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id SERIAL PRIMARY KEY,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    stage_order INT NOT NULL,
    name TEXT NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    department TEXT,
    description TEXT,
    depends_on INT[] DEFAULT '{}',
    gate_type TEXT DEFAULT 'none'
        CHECK (gate_type IN ('none', 'human_approval')),
    namespaces TEXT[] DEFAULT '{}',
    UNIQUE(pipeline_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_agent ON pipeline_stages(agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

CREATE TABLE IF NOT EXISTS project_agent_sessions (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    pipeline_id INT NOT NULL REFERENCES project_pipeline(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_order INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'awaiting_handoff', 'completed', 'skipped')),
    summary TEXT,
    summary_edited TEXT,
    deliverables JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, agent_id, stage_order)
);
CREATE INDEX IF NOT EXISTS idx_pas_project ON project_agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_pas_agent ON project_agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_pas_status ON project_agent_sessions(status);

CREATE TABLE IF NOT EXISTS pipeline_session_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES project_agent_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psm_session ON pipeline_session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_psm_session_created ON pipeline_session_messages(session_id, created_at);

ALTER TABLE collaboration_raises ADD COLUMN IF NOT EXISTS pipeline_session_id INT
    REFERENCES project_agent_sessions(id) ON DELETE SET NULL;

-- ═══════════ AGENT SETTINGS ═══════════════════════════════════════════════

ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_rules TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rag_namespaces JSONB;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_max NUMERIC;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_period TEXT DEFAULT 'monthly';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS budget_spent NUMERIC DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connections JSONB DEFAULT '[]';

-- Proyecto 007: Extended project details
ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bau_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS markets JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_notes TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS key_metrics JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS compliance_notes JSONB DEFAULT '[]';

-- Seed data is now in seed-emirates.sql

-- Fix projects with department='General' that have pipeline stages with a real department
UPDATE projects p
SET department = (
    SELECT ps.department
    FROM project_pipeline pp
    JOIN pipeline_stages ps ON ps.pipeline_id = pp.id
    WHERE pp.project_id = p.id AND ps.department IS NOT NULL AND ps.department != ''
    ORDER BY ps.stage_order ASC
    LIMIT 1
)
WHERE p.department = 'General'
  AND EXISTS (
    SELECT 1 FROM project_pipeline pp
    JOIN pipeline_stages ps ON ps.pipeline_id = pp.id
    WHERE pp.project_id = p.id AND ps.department IS NOT NULL AND ps.department != ''
  );

-- Email Builder: link email_proposals to projects
ALTER TABLE email_proposals ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ep_project ON email_proposals(project_id);

-- ─── GIF Pipeline: generated GIFs catalog ─────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_gifs (
  id              SERIAL PRIMARY KEY,
  mode            TEXT NOT NULL CHECK (mode IN ('slideshow', 'typographic', 'veo')),
  prompt          TEXT NOT NULL,
  plan            JSONB,
  file_path       TEXT NOT NULL,
  thumbnail_path  TEXT,
  width           INT,
  height          INT,
  duration_ms     INT,
  frame_count     INT,
  file_size_bytes INT,
  user_id         INT REFERENCES workspace_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_gifs_user_created
  ON generated_gifs(user_id, created_at DESC);
