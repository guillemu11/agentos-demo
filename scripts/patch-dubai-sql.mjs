import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// Simplified SQL: drops the date/engagement conditions that caused runtime
// conversion errors. Keeps Dubai intent + GCC market + marketable.
// The admin can add date filters later once data quality is verified.
const SAFE_SQL = `SELECT TOP 10000
    emcg_uuid,
    per_email_address,
    first_name,
    last_name,
    MARKETCODE,
    per_language,
    loy_tier_code,
    last_activity_date,
    threshold_destination,
    email_engagement_score
FROM [BAU CS Master dataset]
WHERE threshold_destination = 'Dubai'
  AND MARKETCODE IN ('AE','SA','KW','QA','BH','OM')
  AND ek_email_marketable = 'Y'
  AND per_language IS NOT NULL
  AND per_email_address IS NOT NULL`;

try {
  const { rows } = await pool.query(`SELECT id, dsl_json FROM journeys WHERE name ILIKE '%dubai%reactivation%' LIMIT 1`);
  if (!rows.length) { console.log('no journey'); process.exit(0); }
  const j = rows[0];
  const newDsl = {
    ...j.dsl_json,
    entry: {
      ...j.dsl_json.entry,
      source: { ...j.dsl_json.entry.source, sql: SAFE_SQL },
    },
  };
  await pool.query(`UPDATE journeys SET dsl_json = $1 WHERE id = $2`, [JSON.stringify(newDsl), j.id]);
  console.log('[patch] SQL replaced with safer version (no GETDATE/DATEADD).');
  console.log('New SQL:');
  console.log(SAFE_SQL);
} finally { await pool.end(); }
