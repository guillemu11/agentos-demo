import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import pg from 'pg';
import { createMCClient } from '../packages/core/mc-api/client.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const mc = createMCClient(pool, (v) => v);
const DE_KEY = '9E15FDCB-B36B-46C3-B147-75FE93E44567';

try {
  const xml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtensionField</ObjectType>
      <Properties>Name</Properties>
      <Properties>FieldType</Properties>
      <Properties>MaxLength</Properties>
      <Properties>IsPrimaryKey</Properties>
      <Properties>IsRequired</Properties>
      <Properties>DefaultValue</Properties>
      <Properties>Ordinal</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>DataExtension.CustomerKey</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>${DE_KEY}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;
  const resp = await mc.soap('Retrieve', xml);
  const raw = typeof resp === 'string' ? resp : JSON.stringify(resp);

  const blocks = raw.split(/<Results[^>]*>/).slice(1).map((b) => b.split('</Results>')[0]);
  const fields = blocks.map((b) => ({
    ord: parseInt(b.match(/<Ordinal>([^<]+)<\/Ordinal>/)?.[1] || '999', 10),
    name: b.match(/<Name>([^<]+)<\/Name>/)?.[1],
    type: b.match(/<FieldType>([^<]+)<\/FieldType>/)?.[1],
    max: b.match(/<MaxLength>([^<]+)<\/MaxLength>/)?.[1],
    pk: b.match(/<IsPrimaryKey>([^<]+)<\/IsPrimaryKey>/)?.[1] === 'true',
    req: b.match(/<IsRequired>([^<]+)<\/IsRequired>/)?.[1] === 'true',
    dflt: b.match(/<DefaultValue>([^<]+)<\/DefaultValue>/)?.[1],
  })).filter((f) => f.name).sort((a, b) => a.ord - b.ord);

  console.log(`BAU CS Master dataset — ${fields.length} columns`);
  console.log('Col'.padEnd(5), 'Name'.padEnd(34), 'Type'.padEnd(14), 'Len'.padEnd(6), 'PK', 'Req');
  console.log('─'.repeat(75));
  for (const f of fields) {
    console.log(
      String(f.ord).padEnd(5),
      (f.name || '').padEnd(34),
      (f.type || '').padEnd(14),
      (f.max || '').padEnd(6),
      f.pk ? '●' : ' ', '',
      f.req ? '●' : ' '
    );
  }
  console.log(`\nPrimary key(s): ${fields.filter((f) => f.pk).map((f) => f.name).join(', ') || '(none)'}`);

  // Also pull a sample row
  try {
    const sample = await mc.rest('GET', `/data/v1/customobjectdata/key/${encodeURIComponent(DE_KEY)}/rowset?%24top=1`);
    const first = sample.items?.[0]?.values;
    if (first) {
      console.log('\nSample row (1st record):');
      for (const [k, v] of Object.entries(first)) {
        const vStr = v == null ? 'NULL' : String(v).slice(0, 40);
        console.log(`  ${k.padEnd(34)} = ${vStr}`);
      }
    }
  } catch (e) {
    console.log('\n(sample fetch failed:', e.message, ')');
  }
} finally { await pool.end(); }
