-- Creates journeys + journey_chat_messages tables for the Journey Builder MVP.
-- Single-workspace schema: users live in workspace_users; no separate workspaces table.

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES workspace_users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) > 0),
  dsl_json JSONB NOT NULL DEFAULT '{"version":1,"name":"","entry":null,"activities":[]}',
  status TEXT NOT NULL DEFAULT 'drafting'
    CHECK (status IN ('drafting','deployed_draft','archived')),
  mc_interaction_id TEXT,
  mc_target_de_key TEXT,
  mc_query_activity_id TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status) WHERE status != 'archived';
CREATE INDEX IF NOT EXISTS idx_journey_chat_journey ON journey_chat_messages(journey_id, created_at);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journeys_set_updated_at ON journeys;
CREATE TRIGGER journeys_set_updated_at
BEFORE UPDATE ON journeys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rollback:
-- DROP TRIGGER IF EXISTS journeys_set_updated_at ON journeys;
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP INDEX IF EXISTS idx_journey_chat_journey;
-- DROP INDEX IF EXISTS idx_journeys_status;
-- DROP INDEX IF EXISTS idx_journeys_user;
-- DROP TABLE IF EXISTS journey_chat_messages;
-- DROP TABLE IF EXISTS journeys;
