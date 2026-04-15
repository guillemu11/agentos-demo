import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

try {
  const users = await pool.query(`SELECT id, email FROM workspace_users LIMIT 1`);
  if (users.rows.length === 0) throw new Error('no workspace_users present');
  const userId = users.rows[0].id;
  console.log('[smoke] using user_id=', userId, 'email=', users.rows[0].email);

  const dsl = { version: 1, name: 'Smoke_Test', entry: null, activities: [] };
  const insert = await pool.query(
    `INSERT INTO journeys (user_id, name, dsl_json) VALUES ($1, $2, $3) RETURNING id, status, created_at`,
    [userId, 'Smoke_Test', JSON.stringify(dsl)]
  );
  const journeyId = insert.rows[0].id;
  console.log('[smoke] inserted journey id=', journeyId, 'status=', insert.rows[0].status);

  await pool.query(
    `INSERT INTO journey_chat_messages (journey_id, role, content) VALUES ($1, 'user', $2)`,
    [journeyId, JSON.stringify('Hola')]
  );
  const msgs = await pool.query(`SELECT COUNT(*)::int FROM journey_chat_messages WHERE journey_id = $1`, [journeyId]);
  console.log('[smoke] chat msgs inserted=', msgs.rows[0].count);

  // test updated_at trigger
  const before = await pool.query(`SELECT updated_at FROM journeys WHERE id = $1`, [journeyId]);
  await new Promise(r => setTimeout(r, 50));
  await pool.query(`UPDATE journeys SET name = 'Smoke_Test_Renamed' WHERE id = $1`, [journeyId]);
  const after = await pool.query(`SELECT updated_at, name FROM journeys WHERE id = $1`, [journeyId]);
  const triggered = new Date(after.rows[0].updated_at) > new Date(before.rows[0].updated_at);
  console.log('[smoke] trigger set_updated_at fired=', triggered, 'name=', after.rows[0].name);

  // status CHECK constraint
  try {
    await pool.query(`UPDATE journeys SET status = 'bogus' WHERE id = $1`, [journeyId]);
    console.log('[smoke] ❌ invalid status accepted — CHECK broken');
  } catch (e) {
    console.log('[smoke] CHECK status rejects invalid values ✅');
  }

  // cleanup
  await pool.query(`DELETE FROM journeys WHERE id = $1`, [journeyId]);
  const remaining = await pool.query(`SELECT COUNT(*)::int FROM journey_chat_messages WHERE journey_id = $1`, [journeyId]);
  console.log('[smoke] after DELETE journeys, cascaded messages remaining=', remaining.rows[0].count, '(expect 0)');

  console.log('\n[smoke] ✅ all checks passed');
} catch (err) {
  console.error('[smoke] ❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
