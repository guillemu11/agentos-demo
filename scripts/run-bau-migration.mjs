import pg from 'pg';
const { Pool } = pg;
const url = process.env.DATABASE_URL || '';
const useSSL = /sslmode=require|amazonaws|railway|neon|supabase|render/i.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});
const sql = `
CREATE TABLE IF NOT EXISTS bau_builds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             INT REFERENCES workspace_users(id) ON DELETE SET NULL,
  campaign_type       TEXT NOT NULL,
  campaign_name       TEXT NOT NULL,
  campaign_date       DATE NOT NULL,
  market              TEXT NOT NULL,
  variant_strategy    TEXT NOT NULL,
  direction           TEXT NOT NULL,
  languages           TEXT[] NOT NULL,
  cugo_code           BOOLEAN DEFAULT false,
  brief               TEXT,
  slot_map            JSONB,
  variants            JSONB,
  mc_email_asset_id   BIGINT,
  mc_de_keys          TEXT[],
  mc_folder_path      TEXT,
  status              TEXT NOT NULL DEFAULT 'building',
  error_log           JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  pushed_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bau_builds_user_status ON bau_builds(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bau_builds_created ON bau_builds(created_at DESC);
`;
try {
  await pool.query(sql);
  const r = await pool.query("SELECT to_regclass('public.bau_builds') AS t");
  console.log('OK — bau_builds table:', r.rows[0].t);
} catch (e) {
  console.error('ERR:', e.message);
  process.exit(1);
}
await pool.end();
