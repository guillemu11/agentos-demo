import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildPayload(investigationId) {
  const inv = (await pool.query('SELECT * FROM competitor_investigations WHERE id = $1', [investigationId])).rows[0];
  if (!inv) throw new Error('investigation not found');

  const brandsQ = await pool.query(`
    SELECT b.id, b.name, b.positioning, b.category,
           s.lifecycle_maturity, s.email_sophistication, s.journey_depth, s.personalisation, s.overall, s.manual_notes
    FROM competitor_brands b
    LEFT JOIN competitor_brand_scores s ON s.brand_id = b.id
    WHERE b.investigation_id = $1 ORDER BY b.name
  `, [investigationId]);

  const brands = [];
  for (const b of brandsQ.rows) {
    const insights = (await pool.query(
      'SELECT title, body FROM competitor_insights WHERE brand_id = $1 ORDER BY created_at',
      [b.id]
    )).rows;
    brands.push({
      id: b.id,
      name: b.name,
      positioning: b.positioning,
      category: b.category,
      scores: {
        lifecycle_maturity: b.lifecycle_maturity != null ? Number(b.lifecycle_maturity) : null,
        email_sophistication: b.email_sophistication != null ? Number(b.email_sophistication) : null,
        journey_depth: b.journey_depth != null ? Number(b.journey_depth) : null,
        personalisation: b.personalisation != null ? Number(b.personalisation) : null,
        overall: b.overall != null ? Number(b.overall) : null,
        manual_notes: b.manual_notes,
      },
      insights,
    });
  }

  const crossBrand = (await pool.query(`
    SELECT title, body
    FROM competitor_insights
    WHERE brand_id IS NULL
      AND EXISTS (SELECT 1 FROM competitor_investigations ci WHERE ci.id = $1)
    ORDER BY created_at
  `, [investigationId])).rows;

  const ttft = (await pool.query(`
    WITH sub_times AS (
      SELECT ps.brand_id, ps.persona_id, ps.executed_at
      FROM competitor_playbook_steps ps
      WHERE ps.step_order = 2 AND ps.status = 'done'
    ),
    first_useful AS (
      SELECT e.brand_id, e.persona_id, MIN(e.received_at) AS first_at
      FROM competitor_emails e
      WHERE e.classification->>'type' NOT IN ('double_opt_in','transactional')
        AND e.brand_id IS NOT NULL
      GROUP BY e.brand_id, e.persona_id
    )
    SELECT b.name AS brand_name,
           MIN(EXTRACT(EPOCH FROM (fu.first_at - st.executed_at))) AS seconds_to_first
    FROM competitor_brands b
    LEFT JOIN sub_times st ON st.brand_id = b.id
    LEFT JOIN first_useful fu ON fu.brand_id = b.id AND fu.persona_id = st.persona_id
    WHERE b.investigation_id = $1
    GROUP BY b.id, b.name
    ORDER BY b.name
  `, [investigationId])).rows.map(r => ({
    brand_name: r.brand_name,
    seconds_to_first: r.seconds_to_first != null ? Number(r.seconds_to_first) : null,
  }));

  return {
    investigation: { name: inv.name, description: inv.description },
    brands,
    cross_brand_insights: crossBrand,
    comparative: { ttft },
    quick_wins: [],
  };
}

export async function exportDocx(investigationId) {
  const payload = await buildPayload(investigationId);
  const scriptPath = path.join(__dirname, 'docx-exporter.py');

  return new Promise((resolve, reject) => {
    const py = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    py.stdout.on('data', (c) => chunks.push(c));
    py.stderr.on('data', (c) => { err += c.toString(); });
    py.on('error', reject);
    py.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `python exited ${code}`));
      resolve(Buffer.concat(chunks));
    });
    py.stdin.end(JSON.stringify(payload));
  });
}

export { buildPayload };
