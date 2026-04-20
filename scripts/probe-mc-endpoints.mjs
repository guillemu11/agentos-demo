import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const noopDecrypt = (v) => v;
const mc = createMCClient(pool, noopDecrypt);

const probes = [
  { name: 'GET  /platform/v1/endpoints', fn: () => mc.rest('GET', '/platform/v1/endpoints') },
  { name: 'GET  /data/v1/async/dataextensions (list)', fn: () => mc.rest('GET', '/data/v1/async/dataextensions?%24top=1') },
  { name: 'GET  /automation/v1/queries (list)', fn: () => mc.rest('GET', '/automation/v1/queries?%24top=1') },
  { name: 'GET  /interaction/v1/interactions (list)', fn: () => mc.rest('GET', '/interaction/v1/interactions?%24pageSize=1') },
  { name: 'GET  /asset/v1/content/assets (list)', fn: () => mc.rest('GET', '/asset/v1/content/assets?%24pageSize=1') },
  { name: 'POST /hub/v1/dataevents (DE create endpoint?)', fn: () => mc.rest('GET', '/hub/v1/dataevents') },
];

try {
  for (const p of probes) {
    try {
      const r = await p.fn();
      const preview = JSON.stringify(r).slice(0, 120);
      console.log(`✅ ${p.name} → ${preview}${preview.length >= 120 ? '…' : ''}`);
    } catch (e) {
      console.log(`❌ ${p.name} → ${e.message.slice(0, 150)}`);
    }
  }
} finally { await pool.end(); }
