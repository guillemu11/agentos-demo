import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);
try {
  // Try a few pages to find a journey with engagement split
  for (let page = 1; page <= 5; page++) {
    const list = await mc.rest('GET', `/interaction/v1/interactions?$pageSize=50&$page=${page}&$orderBy=modifiedDate%20DESC`);
    if (!list.items?.length) { console.log('no more items at page', page); break; }
    for (const item of list.items) {
      if (item.name.toLowerCase().includes('dubai') || item.name.toLowerCase().includes('reactivation')) continue;
      const full = await mc.rest('GET', `/interaction/v1/interactions/${item.id}`);
      const eng = full.activities?.find(a =>
        a.type && (a.type.toLowerCase().includes('engagement') || a.type.toLowerCase().includes('engagem'))
      );
      if (eng) {
        console.log('=== FOUND in:', item.name, '===');
        console.log(JSON.stringify({ type: eng.type, configurationArguments: eng.configurationArguments, metaData: eng.metaData }, null, 2));
        // Also get trigger
        const t = full.triggers?.[0];
        console.log('\nTrigger type:', t?.type);
        console.log('Trigger configArgs:', JSON.stringify(t?.configurationArguments, null, 2));
        console.log('Trigger metaData:', JSON.stringify(t?.metaData, null, 2));
        process.exit(0);
      }
    }
    console.log(`page ${page}: checked ${list.items.length} journeys, none with engagement split`);
  }
  console.log('No engagement split found in any journey');
} finally { await pool.end(); }
