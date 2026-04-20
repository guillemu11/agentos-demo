BEGIN;

CREATE TABLE IF NOT EXISTS competitor_investigations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id INT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_brands (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  category TEXT,
  positioning TEXT,
  recon_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_personas (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT,
  location TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_persona_gmail (
  persona_id INT PRIMARY KEY REFERENCES competitor_personas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS competitor_playbook_steps (
  id SERIAL PRIMARY KEY,
  brand_id INT NOT NULL REFERENCES competitor_brands(id) ON DELETE CASCADE,
  persona_id INT NOT NULL REFERENCES competitor_personas(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  action TEXT NOT NULL,
  channel TEXT,
  data_to_provide JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_signal TEXT,
  wait_after_minutes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','done','skipped')),
  executed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_playbook_brand_persona ON competitor_playbook_steps(brand_id, persona_id);

CREATE TABLE IF NOT EXISTS competitor_emails (
  id SERIAL PRIMARY KEY,
  persona_id INT NOT NULL REFERENCES competitor_personas(id) ON DELETE CASCADE,
  brand_id INT REFERENCES competitor_brands(id) ON DELETE SET NULL,
  gmail_message_id TEXT NOT NULL UNIQUE,
  sender_email TEXT,
  sender_domain TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_headers JSONB
);

CREATE INDEX IF NOT EXISTS idx_emails_persona_received ON competitor_emails(persona_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_brand_received  ON competitor_emails(brand_id, received_at DESC);

CREATE TABLE IF NOT EXISTS competitor_email_engagement (
  id SERIAL PRIMARY KEY,
  email_id INT NOT NULL REFERENCES competitor_emails(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open','click')),
  link_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  simulated BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS competitor_brand_scores (
  brand_id INT PRIMARY KEY REFERENCES competitor_brands(id) ON DELETE CASCADE,
  lifecycle_maturity NUMERIC(3,1),
  email_sophistication NUMERIC(3,1),
  journey_depth NUMERIC(3,1),
  personalisation NUMERIC(3,1),
  overall NUMERIC(3,1),
  last_calculated_at TIMESTAMPTZ,
  manual_notes TEXT
);

CREATE TABLE IF NOT EXISTS competitor_insights (
  id SERIAL PRIMARY KEY,
  brand_id INT REFERENCES competitor_brands(id) ON DELETE CASCADE,
  category TEXT,
  severity TEXT,
  title TEXT NOT NULL,
  body TEXT,
  evidence_email_ids INT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
