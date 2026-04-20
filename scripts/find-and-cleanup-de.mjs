import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);

const TARGET_NAME = process.argv[2] || 'Dubai_Reactivation_GCC_Entry';
const MODE = process.argv[3] || 'find'; // 'find' | 'delete'

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractField(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return m ? m[1] : null;
}

try {
  console.log(`[find] searching DE by name="${TARGET_NAME}"...`);
  const retrieveXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtension</ObjectType>
      <Properties>Name</Properties>
      <Properties>CustomerKey</Properties>
      <Properties>ObjectID</Properties>
      <Properties>CategoryID</Properties>
      <Properties>CreatedDate</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>Name</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>${esc(TARGET_NAME)}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;
  const resp = await mc.soap('Retrieve', retrieveXml);
  const raw = typeof resp === 'string' ? resp : JSON.stringify(resp);
  // Find each Results block (there may be more than one if names collide across folders)
  const blocks = raw.split(/<Results[^>]*>/).slice(1).map((b) => b.split('</Results>')[0]);
  if (blocks.length === 0) {
    console.log('[find] no match. Nothing to clean up.');
    process.exit(0);
  }
  const matches = blocks.map((b) => ({
    ObjectID: extractField(b, 'ObjectID'),
    CustomerKey: extractField(b, 'CustomerKey'),
    Name: extractField(b, 'Name'),
    CategoryID: extractField(b, 'CategoryID'),
    CreatedDate: extractField(b, 'CreatedDate'),
  })).filter((m) => m.ObjectID);

  console.log(`[find] found ${matches.length} match(es):`);
  for (const m of matches) {
    console.log(`  - Name: ${m.Name}`);
    console.log(`    CustomerKey: ${m.CustomerKey}`);
    console.log(`    ObjectID: ${m.ObjectID}`);
    console.log(`    CategoryID (folder): ${m.CategoryID}`);
    console.log(`    Created: ${m.CreatedDate}`);
  }

  if (MODE !== 'delete') {
    console.log('\nPass "delete" as 2nd arg to delete:');
    console.log(`  node scripts/find-and-cleanup-de.mjs "${TARGET_NAME}" delete`);
    process.exit(0);
  }

  for (const m of matches) {
    console.log(`\n[delete] removing DE CustomerKey=${m.CustomerKey}...`);
    const deleteXml = `<DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <Objects xsi:type="DataExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <CustomerKey>${esc(m.CustomerKey)}</CustomerKey>
      </Objects>
    </DeleteRequest>`;
    const dresp = await mc.soap('Delete', deleteXml);
    const draw = typeof dresp === 'string' ? dresp : JSON.stringify(dresp);
    const status = draw.match(/<StatusCode>([^<]+)/)?.[1];
    const msg = draw.match(/<StatusMessage>([^<]+)/)?.[1] || '';
    if (status === 'OK') {
      console.log(`[delete] ✅ removed ${m.Name}`);
    } else {
      console.log(`[delete] ❌ status=${status} msg="${msg}"`);
    }
  }
} finally { await pool.end(); }
