import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const sqlPath = new URL('../.worktrees/journey-builder-mvp/apps/dashboard/migrations/202604150001_journeys.sql', import.meta.url);
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

try {
  console.log('[migration] connecting to', process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://<REDACTED>@'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[migration] ✅ applied');

    const journeys = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journeys' ORDER BY ordinal_position`);
    const msgs = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journey_chat_messages' ORDER BY ordinal_position`);
    console.log('[journeys]', journeys.rows.map(r => `${r.column_name}:${r.data_type}`).join(', '));
    console.log('[journey_chat_messages]', msgs.rows.map(r => `${r.column_name}:${r.data_type}`).join(', '));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
} catch (err) {
  console.error('[migration] ❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
