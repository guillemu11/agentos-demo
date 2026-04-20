import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const { rows } = await pool.query(
    `SELECT id, name, dsl_json FROM journeys WHERE name ILIKE '%dubai%reactivation%' LIMIT 1`
  );
  if (rows.length === 0) { console.log('no journey'); process.exit(0); }
  const dsl = rows[0].dsl_json;
  console.log('Entry:', JSON.stringify(dsl.entry, null, 2)?.slice(0, 200));
  console.log('\nActivities (' + (dsl.activities?.length || 0) + '):');
  for (const a of dsl.activities || []) {
    const summary = { id: a.id, type: a.type };
    if (a.next !== undefined) summary.next = a.next;
    if (a.branches) summary.branches = a.branches.map(b => ({ label: b.label, next: b.next }));
    if (a.default_next !== undefined) summary.default_next = a.default_next;
    if (a.yes_next !== undefined) summary.yes_next = a.yes_next;
    if (a.no_next !== undefined) summary.no_next = a.no_next;
    if (a.on_event_next !== undefined) summary.on_event_next = a.on_event_next;
    if (a.on_timeout_next !== undefined) summary.on_timeout_next = a.on_timeout_next;
    console.log(JSON.stringify(summary));
  }
} finally { await pool.end(); }
