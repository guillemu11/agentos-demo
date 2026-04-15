import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);
try {
  // Grab any recently active journey with waits + splits + emails
  const list = await mc.rest('GET', '/interaction/v1/interactions?%24pageSize=20&%24orderBy=modifiedDate%20DESC');
  // Skip our own deployed journey — we want a UI-built one for comparison
  const interaction = list.items?.find(i =>
    (i.status === 'Active' || i.status === 'Published' || i.status === 'Stopped' || i.status === 'Draft') &&
    !i.name.toLowerCase().includes('dubai') &&
    !i.name.toLowerCase().includes('reactivation'));
  if (!interaction) { console.log('no interaction'); process.exit(0); }
  console.log('Using interaction:', interaction.name, interaction.id);
  // Fetch full detail
  const full = await mc.rest('GET', `/interaction/v1/interactions/${interaction.id}`);
  console.log('\n=== ROOT-LEVEL fields (sorted) ===');
  for (const k of Object.keys(full).sort()) {
    const v = full[k];
    const preview = Array.isArray(v) ? `[${v.length} items]` : (typeof v === 'object' ? '{...}' : String(v).slice(0, 60));
    console.log(`  ${k.padEnd(30)}: ${preview}`);
  }
  console.log('\n=== Sample activity shapes ===');
  for (const a of (full.activities || []).slice(0, 4)) {
    console.log('\n--- type:', a.type, '---');
    // Show structure only, not user data
    console.log(JSON.stringify({
      key: a.key?.slice(0, 40),
      type: a.type,
      outcomes: a.outcomes?.slice(0, 2),
      configurationArguments: pruneValues(a.configurationArguments),
      arguments: a.arguments ? Object.keys(a.arguments) : undefined,
      metaData: a.metaData,
      schema: a.schema ? '...present' : undefined,
    }, null, 2));
  }
  console.log('\n=== Triggers ===');
  for (const t of (full.triggers || [])) {
    console.log(JSON.stringify({ type: t.type, eventDefinitionKey: t.eventDefinitionKey, metaData: t.metaData }, null, 2));
  }
} finally { await pool.end(); }

function pruneValues(obj, depth = 0) {
  if (depth > 3 || !obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 2).map(v => pruneValues(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > 60) out[k] = v.slice(0, 40) + '…';
    else out[k] = pruneValues(v, depth + 1);
  }
  return out;
}
