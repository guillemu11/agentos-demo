import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

try {
  // Delete tool rows whose content is an object (legacy shape) rather than an array.
  // jsonb_typeof returns 'object' vs 'array' vs 'string'.
  const { rowCount } = await pool.query(
    `DELETE FROM journey_chat_messages
     WHERE role = 'tool' AND jsonb_typeof(content) = 'object'`
  );
  console.log('[purge] removed legacy tool rows:', rowCount);

  // Also prune orphan assistant rows that reference tool_use ids with no matching tool_result —
  // those would also confuse Claude on replay. Keep only user + assistant that precede the first deletion point.
  const orphans = await pool.query(
    `SELECT j.id, j.name, COUNT(m.id) AS msg_count
     FROM journeys j LEFT JOIN journey_chat_messages m ON m.journey_id = j.id
     GROUP BY j.id, j.name ORDER BY j.updated_at DESC LIMIT 10`
  );
  console.log('[journeys] message counts after purge:');
  for (const r of orphans.rows) console.log(` - ${r.name}: ${r.msg_count} msgs`);
} finally {
  await pool.end();
}
