import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

try {
  const { rows } = await pool.query(`SELECT id, name FROM journeys WHERE name ILIKE '%dubai%holiday%reactivation%'`);
  if (rows.length === 0) {
    console.log('[reset] no Dubai journey found');
  } else {
    for (const j of rows) {
      const del = await pool.query(`DELETE FROM journey_chat_messages WHERE journey_id = $1`, [j.id]);
      // Also reset the DSL to empty so the canvas starts fresh
      await pool.query(
        `UPDATE journeys SET dsl_json = $1 WHERE id = $2`,
        [JSON.stringify({ version: 1, name: j.name, entry: null, activities: [] }), j.id]
      );
      console.log(`[reset] ${j.name}: wiped ${del.rowCount} messages + reset DSL`);
    }
  }
} finally {
  await pool.end();
}
