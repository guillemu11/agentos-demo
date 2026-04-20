import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);

try {
  // Retrieve Category (folders) with ContentType='queryactivity'
  const xml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataFolder</ObjectType>
      <Properties>ID</Properties>
      <Properties>Name</Properties>
      <Properties>ParentFolder.ID</Properties>
      <Properties>ContentType</Properties>
      <Properties>IsActive</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>ContentType</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>queryactivity</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;
  const resp = await mc.soap('Retrieve', xml);
  const raw = typeof resp === 'string' ? resp : JSON.stringify(resp);

  // Parse folders
  const blocks = raw.split(/<Results[^>]*>/).slice(1).map((b) => b.split('</Results>')[0]);
  const folders = blocks.map((b) => ({
    ID: b.match(/<ID>([^<]+)<\/ID>/)?.[1],
    Name: b.match(/<Name>([^<]+)<\/Name>/)?.[1],
    ParentID: b.match(/<ParentFolder>[\s\S]*?<ID>([^<]+)<\/ID>/)?.[1],
  })).filter((f) => f.ID);

  console.log(`[find] ${folders.length} queryactivity folders`);
  // Root folders are those with ParentID = 0 or missing
  const roots = folders.filter((f) => !f.ParentID || f.ParentID === '0');
  console.log(`\nRoot queryactivity folder(s):`);
  for (const r of roots) console.log(`  ID=${r.ID} Name="${r.Name}"`);
  console.log(`\nTop 10 by ID:`);
  for (const f of folders.slice(0, 10)) console.log(`  ID=${f.ID} Parent=${f.ParentID || '0'} Name="${f.Name}"`);
} finally { await pool.end(); }
