// Migration: add `rows` + `images_base64` JSONB columns to bau_builds on Railway.
// Run with: node --env-file=.env scripts/run-bau-builds-prepare-migration.mjs

import pg from 'pg';
const { Pool } = pg;

const url = process.env.DATABASE_URL || '';
if (!url) {
  console.error('ERR: DATABASE_URL not set');
  process.exit(1);
}
const useSSL = /sslmode=require|amazonaws|railway|neon|supabase|render/i.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

const sql = `
ALTER TABLE bau_builds
  ADD COLUMN IF NOT EXISTS rows JSONB,
  ADD COLUMN IF NOT EXISTS images_base64 JSONB;
`;

try {
  await pool.query(sql);
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='bau_builds' AND column_name IN ('rows','images_base64')
      ORDER BY column_name`
  );
  console.log('OK — columns present:', r.rows.map(x => x.column_name).join(', '));
} catch (e) {
  console.error('ERR:', e.message);
  process.exit(1);
}
await pool.end();
