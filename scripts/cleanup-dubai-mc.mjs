import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);

async function deleteInteraction(id) {
  try {
    await mc.rest('DELETE', `/interaction/v1/interactions/${id}`);
    return 'deleted';
  } catch (e) { return `error: ${e.message.slice(0, 80)}`; }
}

async function deleteAsset(id) {
  try {
    await mc.rest('DELETE', `/asset/v1/content/assets/${id}`);
    return 'deleted';
  } catch (e) { return `error: ${e.message.slice(0, 80)}`; }
}

async function deleteQueryActivity(id) {
  try {
    await mc.rest('DELETE', `/automation/v1/queries/${id}`);
    return 'deleted';
  } catch (e) { return `error: ${e.message.slice(0, 80)}`; }
}

async function deleteDEByKey(key) {
  const xml = `<DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <Objects xsi:type="DataExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <CustomerKey>${key}</CustomerKey>
    </Objects>
  </DeleteRequest>`;
  try {
    const resp = await mc.soap('Delete', xml);
    const raw = typeof resp === 'string' ? resp : JSON.stringify(resp);
    const status = raw.match(/<StatusCode>([^<]+)/)?.[1];
    return status === 'OK' ? 'deleted' : `status=${status}`;
  } catch (e) { return `error: ${e.message.slice(0, 80)}`; }
}

try {
  const { rows } = await pool.query(`
    SELECT id, mc_interaction_id, mc_target_de_key, mc_query_activity_id, dsl_json
    FROM journeys WHERE name ILIKE '%dubai%reactivation%' LIMIT 1
  `);
  if (!rows.length) { console.log('no journey'); process.exit(0); }
  const j = rows[0];

  if (j.mc_interaction_id) {
    console.log(`[interaction] ${j.mc_interaction_id}: ${await deleteInteraction(j.mc_interaction_id)}`);
  }
  if (j.mc_query_activity_id) {
    console.log(`[query]       ${j.mc_query_activity_id}: ${await deleteQueryActivity(j.mc_query_activity_id)}`);
  }
  for (const a of (j.dsl_json.activities || [])) {
    if (a.type === 'email_send' && a.mc_email_id) {
      console.log(`[email asset] ${a.mc_email_id} (${a.email_shell_name}): ${await deleteAsset(a.mc_email_id)}`);
    }
  }
  if (j.mc_target_de_key) {
    console.log(`[DE]          ${j.mc_target_de_key}: ${await deleteDEByKey(j.mc_target_de_key)}`);
  }

  // Reset DSL to forget mc_email_ids so next deploy re-creates shells
  const cleanDsl = {
    ...j.dsl_json,
    activities: (j.dsl_json.activities || []).map(a =>
      a.type === 'email_send' ? { ...a, mc_email_id: null } : a
    ),
  };
  await pool.query(
    `UPDATE journeys SET status='drafting', mc_interaction_id=NULL, mc_target_de_key=NULL, mc_query_activity_id=NULL, dsl_json=$1 WHERE id=$2`,
    [JSON.stringify(cleanDsl), j.id]
  );
  console.log('\n[AgentOS] journey status reset to drafting, mc_* IDs cleared, email_id refs wiped');
} finally { await pool.end(); }
