-- apps/dashboard/migrations/202604150001_journeys.sql
CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_journeys_workspace ON journeys(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_chat_journey ON journey_chat_messages(journey_id, created_at);

CREATE OR REPLACE FUNCTION journey_updated_at_trigger() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journeys_updated_at ON journeys;
CREATE TRIGGER journeys_updated_at
BEFORE UPDATE ON journeys
FOR EACH ROW EXECUTE FUNCTION journey_updated_at_trigger();
