import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'workspace_users' ORDER BY ordinal_position`);
console.log('workspace_users:', r.rows);
const r2 = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%user%'`);
console.log('user-like tables:', r2.rows);
await pool.end();
