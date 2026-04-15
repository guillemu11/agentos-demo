import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);
const NAME_LIKE = process.argv[2] || 'Dubai_Reactivation_GCC_Entry%';
const MODE = process.argv[3] || 'find';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

try {
  const xml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtension</ObjectType>
      <Properties>Name</Properties><Properties>CustomerKey</Properties><Properties>CreatedDate</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>Name</Property><SimpleOperator>like</SimpleOperator><Value>${esc(NAME_LIKE)}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;
  const resp = await mc.soap('Retrieve', xml);
  const raw = typeof resp === 'string' ? resp : JSON.stringify(resp);
  const blocks = raw.split(/<Results[^>]*>/).slice(1).map((b) => b.split('</Results>')[0]);
  const matches = blocks.map((b) => ({
    name: b.match(/<Name>([^<]+)<\/Name>/)?.[1],
    key: b.match(/<CustomerKey>([^<]+)<\/CustomerKey>/)?.[1],
    created: b.match(/<CreatedDate>([^<]+)<\/CreatedDate>/)?.[1],
  })).filter((m) => m.name);

  console.log(`[find] ${matches.length} match(es) for name LIKE "${NAME_LIKE}":`);
  for (const m of matches) console.log(`  - ${m.name} (key=${m.key}, created=${m.created})`);

  if (MODE !== 'delete' || matches.length === 0) process.exit(0);

  for (const m of matches) {
    const delXml = `<DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">
      <Objects xsi:type="DataExtension" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <CustomerKey>${esc(m.key)}</CustomerKey>
      </Objects>
    </DeleteRequest>`;
    const d = await mc.soap('Delete', delXml);
    const dr = typeof d === 'string' ? d : JSON.stringify(d);
    const s = dr.match(/<StatusCode>([^<]+)/)?.[1];
    console.log(`[delete] ${m.name}: ${s || '?'}`);
  }
} finally { await pool.end(); }
