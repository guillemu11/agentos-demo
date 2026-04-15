import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const { rows } = await pool.query(`
    SELECT id, name, status, mc_interaction_id, mc_target_de_key, mc_query_activity_id, dsl_json, updated_at
    FROM journeys WHERE name ILIKE '%dubai%reactivation%' LIMIT 1
  `);
  if (!rows.length) { console.log('no journey'); process.exit(0); }
  const j = rows[0];
  console.log('Journey:', j.name);
  console.log('Status in AgentOS:', j.status);
  console.log('Deployed at:', j.updated_at);
  console.log('MC Interaction ID:', j.mc_interaction_id);
  console.log('MC Target DE Key:', j.mc_target_de_key);
  console.log('MC Query Activity ID:', j.mc_query_activity_id);
  console.log('\nDeployed activities with mc_email_id:');
  const emails = (j.dsl_json.activities || []).filter(a => a.type === 'email_send');
  for (const e of emails) {
    console.log(`  - ${e.email_shell_name}: mc_email_id=${e.mc_email_id ?? '(missing!)'} campaign_type=${e.campaign_type}`);
  }
} finally { await pool.end(); }
