import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const { rows } = await pool.query(`SELECT dsl_json FROM journeys WHERE name ILIKE '%dubai%reactivation%' LIMIT 1`);
  if (!rows.length) process.exit(0);
  const src = rows[0].dsl_json.entry?.source;
  console.log('master_de_key:', src?.master_de_key);
  console.log('target_de_name:', src?.target_de_name);
  console.log('SQL (full):');
  console.log(src?.sql);
} finally { await pool.end(); }
