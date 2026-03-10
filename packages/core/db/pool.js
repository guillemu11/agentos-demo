/**
 * AgentOS — Shared PostgreSQL Pool
 *
 * Single connection pool used across all tools and workspace-skills.
 * Import this instead of creating your own pg.Pool().
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
    : new pg.Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5433', 10),
        database: process.env.PG_DB || 'agentos',
        user: process.env.PG_USER || 'agentos',
        password: process.env.PG_PASSWORD || 'changeme',
    });

export default pool;
