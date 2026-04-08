// packages/core/gif-pipeline/typographic.test.js
// Run with: node packages/core/gif-pipeline/typographic.test.js
//
// Requires a running DB (npm run db:up) because the pipeline persists to
// generated_gifs. Uses preset_override so it does NOT require ANTHROPIC_API_KEY.
//
// Connection defaults are the AgentOS docker-compose values:
//   host=localhost port=5434 user=agentos password=changeme db=agentos

import { runTypographicPipeline } from './typographic.js';
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5434),
  user: process.env.PG_USER || 'agentos',
  password: process.env.PG_PASSWORD || 'changeme',
  database: process.env.PG_DB || 'agentos',
});

async function main() {
  console.log('typographic.test.js');
  const events = [];
  const emit = (e) => events.push(e);

  let result;
  try {
    result = await runTypographicPipeline(
      'Test: 30% OFF ends tonight',
      { preset_override: 'bounce_headline' },
      emit,
      { userId: null, pool }
    );
  } catch (err) {
    console.error('  ✗ pipeline threw:', err.stack || err.message);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  // Verify event sequence
  const stepOrder = events.map((e) => e.step);
  console.log('  events:', stepOrder.join(' → '));
  assert.ok(stepOrder[0] === 'planning', `first event should be planning, got ${stepOrder[0]}`);
  assert.ok(stepOrder.includes('plan_ready'), 'missing plan_ready event');
  assert.ok(stepOrder.includes('rendering'), 'missing rendering event');
  assert.ok(stepOrder.includes('encoding'), 'missing encoding event');
  assert.ok(stepOrder.includes('persisting'), 'missing persisting event');
  assert.ok(stepOrder[stepOrder.length - 1] === 'done', `last event should be done, got ${stepOrder[stepOrder.length - 1]}`);
  console.log('  ✓ event sequence correct');

  // Verify file exists
  const filePath = path.resolve(__dirname, '..', '..', '..', 'apps', 'dashboard', 'public', result.filePath.replace(/^\//, ''));
  assert.ok(fs.existsSync(filePath), `gif file not found at ${filePath}`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1000, `gif too small: ${stat.size} bytes`);
  console.log(`  ✓ gif file written (${stat.size} bytes)`);

  // Verify DB row
  const { rows } = await pool.query(
    `SELECT id, mode, width, height, frame_count FROM generated_gifs WHERE id = $1`,
    [result.gifId]
  );
  assert.equal(rows.length, 1, 'DB row not found');
  assert.equal(rows[0].mode, 'typographic');
  assert.equal(rows[0].width, 600);
  assert.equal(rows[0].height, 315);
  assert.ok(rows[0].frame_count > 30, `expected >30 frames, got ${rows[0].frame_count}`);
  console.log(`  ✓ DB row created (id=${result.gifId}, frames=${rows[0].frame_count})`);

  // Cleanup: delete the test row and file
  await pool.query(`DELETE FROM generated_gifs WHERE id = $1`, [result.gifId]);
  try { fs.unlinkSync(filePath); } catch (_) {}
  const thumbPath = filePath.replace('.gif', '-thumb.png');
  try { fs.unlinkSync(thumbPath); } catch (_) {}

  await pool.end();
  console.log('  ✓ cleanup complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
