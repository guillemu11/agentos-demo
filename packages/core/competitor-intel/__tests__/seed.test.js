import { describe, it, expect, afterAll } from 'vitest';
import pool from '../../db/pool.js';
import { seedDertourInvestigation } from '../seed.js';

describe('seed', () => {
  let investigationId;

  afterAll(async () => {
    if (investigationId) {
      await pool.query('DELETE FROM competitor_investigations WHERE id = $1', [investigationId]);
    }
    // don't end the pool — other tests may share it
  });

  it('creates 1 investigation, 5 brands, 2 personas, 48 playbook steps', async () => {
    const result = await seedDertourInvestigation({ ownerUserId: null });
    investigationId = result.investigationId;

    const brands = await pool.query('SELECT * FROM competitor_brands WHERE investigation_id = $1', [investigationId]);
    expect(brands.rows.length).toBe(5);
    expect(brands.rows.map(b => b.name).sort()).toEqual(['CV Villas','Carrier','Explore Worldwide','Inntravel','Kuoni']);

    const personas = await pool.query('SELECT * FROM competitor_personas WHERE investigation_id = $1', [investigationId]);
    expect(personas.rows.length).toBe(2);

    const steps = await pool.query(`
      SELECT COUNT(*)::int AS c FROM competitor_playbook_steps
      WHERE brand_id IN (SELECT id FROM competitor_brands WHERE investigation_id = $1)
    `, [investigationId]);
    expect(steps.rows[0].c).toBe(48);
  });
});
