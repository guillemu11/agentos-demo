import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const { rows } = await pool.query("SELECT value FROM workspace_config WHERE key = 'api_keys'");
  if (rows.length === 0) {
    console.log('[api_keys] no row — empty');
  } else {
    const keys = rows[0].value;
    console.log('[api_keys] stored keys:', Object.keys(keys));
    console.log('[api_keys] has mc_client_id:', !!keys.mc_client_id);
    console.log('[api_keys] has mc_client_secret:', !!keys.mc_client_secret);
    console.log('[api_keys] has mc_auth_url:', !!keys.mc_auth_url);
    console.log('[api_keys] has mc_account_id:', !!keys.mc_account_id);
  }
  console.log('[env] MC_CLIENT_ID:', process.env.MC_CLIENT_ID ? `${process.env.MC_CLIENT_ID.slice(0,6)}...` : '(missing)');
  console.log('[env] MC_CLIENT_SECRET:', process.env.MC_CLIENT_SECRET ? '(set)' : '(missing)');
  console.log('[env] MC_AUTH_URL:', process.env.MC_AUTH_URL || '(missing)');
  console.log('[env] MC_ACCOUNT_ID:', process.env.MC_ACCOUNT_ID || '(missing)');
} finally {
  await pool.end();
}
