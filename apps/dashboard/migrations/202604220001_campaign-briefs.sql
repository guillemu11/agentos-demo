-- Campaign briefs — central artifact for the conversational campaign creation flow.
-- A brief is either human-created (via chat) or AI-suggested (from mock signals).

CREATE TABLE IF NOT EXISTS campaign_briefs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       INTEGER REFERENCES workspace_users(id) ON DELETE SET NULL,

  source           TEXT NOT NULL CHECK (source IN ('human','ai')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','in_wizard','sent','dismissed')),

  name             TEXT,
  objective        TEXT,
  send_date        TIMESTAMPTZ,
  template_id      TEXT,
  markets          JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants_plan    JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_summary TEXT,

  opportunity_reason   TEXT,
  opportunity_signals  JSONB,
  preview_image_url    TEXT,

  chat_transcript  JSONB NOT NULL DEFAULT '[]'::jsonb,
  accepted_option  JSONB,
  campaign_id      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefs_status     ON campaign_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_source     ON campaign_briefs(source);
CREATE INDEX IF NOT EXISTS idx_briefs_created_by ON campaign_briefs(created_by);

DROP TRIGGER IF EXISTS campaign_briefs_touch ON campaign_briefs;
CREATE TRIGGER campaign_briefs_touch
  BEFORE UPDATE ON campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
