BEGIN;
CREATE TABLE IF NOT EXISTS competitor_reference_scores (
  id SERIAL PRIMARY KEY,
  investigation_id INT NOT NULL REFERENCES competitor_investigations(id) ON DELETE CASCADE,
  source_label TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  lifecycle_maturity NUMERIC(3,1),
  email_sophistication NUMERIC(3,1),
  journey_depth NUMERIC(3,1),
  personalisation NUMERIC(3,1),
  overall NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(investigation_id, source_label, brand_name)
);
COMMIT;
