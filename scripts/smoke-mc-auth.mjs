import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const noopDecrypt = (v) => v;

try {
  const mc = createMCClient(pool, noopDecrypt);
  console.log('[mc-auth] requesting token...');
  const token = await mc.getToken();
  console.log('[mc-auth] ✅ got token, expires in', Math.round((token.expiresAt - Date.now()) / 1000), 's');
  console.log('[mc-auth] restUrl:', token.restUrl);
  console.log('[mc-auth] soapUrl:', token.soapUrl);
} catch (e) {
  console.error('[mc-auth] ❌', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
