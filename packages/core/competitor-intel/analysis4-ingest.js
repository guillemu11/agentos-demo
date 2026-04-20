import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseDocx(docxPath) {
  const script = path.join(__dirname, 'analysis4-ingest.py');
  const r = spawnSync('python', [script, docxPath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || `python exited ${r.status}`);
  return JSON.parse(r.stdout || '[]');
}

export async function ingestAnalysis4({ investigationId, docxPath }) {
  const rows = parseDocx(docxPath);
  for (const r of rows) {
    await pool.query(`
      INSERT INTO competitor_reference_scores(investigation_id, source_label, brand_name, overall)
      VALUES ($1, 'Analysis 4', $2, $3)
      ON CONFLICT (investigation_id, source_label, brand_name)
      DO UPDATE SET overall = EXCLUDED.overall
    `, [investigationId, r.brand_name, r.overall]);
  }
  return rows;
}
