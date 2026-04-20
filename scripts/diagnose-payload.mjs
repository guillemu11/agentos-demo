import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { compileDslToInteraction } from '../packages/core/journey-builder/compiler.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const { rows } = await pool.query(`SELECT dsl_json FROM journeys WHERE name ILIKE '%dubai%' LIMIT 1`);
  const dsl = rows[0].dsl_json;
  // Stub mc_email_ids so compile doesn't throw
  for (const a of dsl.activities) if (a.type === 'email_send') a.mc_email_id = 99999;
  const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-FAKE' });
  console.log(JSON.stringify(out, null, 2));
} finally { await pool.end(); }
