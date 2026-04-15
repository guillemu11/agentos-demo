import { describe, it, expect, vi } from 'vitest';
import { createQueryActivity, startQueryActivity, pollQueryActivity } from '../query-activity.js';

function mkMockMc(responses) {
  const calls = [];
  const mc = {
    rest: vi.fn(async (method, path, body) => {
      calls.push({ method, path, body });
      const r = responses[`${method} ${path}`];
      if (!r) throw new Error(`no mock for ${method} ${path}`);
      return typeof r === 'function' ? r(calls.length) : r;
    }),
  };
  return { mc, calls };
}

describe('createQueryActivity', () => {
  it('POSTs to /automation/v1/queries/ with sql + target DE', async () => {
    const { mc, calls } = mkMockMc({
      'POST /automation/v1/queries/': { queryDefinitionId: 'Q-123', key: 'q-key' },
    });
    const res = await createQueryActivity(mc, {
      name: 'TestQuery',
      sql: 'SELECT * FROM BAU_Master_Dataset',
      target_de_key: 'TGT-KEY',
      target_update_type: 'Overwrite',
    });
    expect(res.queryDefinitionId).toBe('Q-123');
    expect(calls[0].body.queryText).toBe('SELECT * FROM BAU_Master_Dataset');
    expect(calls[0].body.targetKey).toBe('TGT-KEY');
    expect(calls[0].body.targetUpdateTypeId).toBe(1); // Overwrite = 1
  });
});

describe('startQueryActivity', () => {
  it('POSTs to /actions/start/', async () => {
    const { mc, calls } = mkMockMc({
      'POST /automation/v1/queries/Q-123/actions/start/': {},
    });
    await startQueryActivity(mc, 'Q-123');
    expect(calls[0].path).toBe('/automation/v1/queries/Q-123/actions/start/');
  });
});

describe('pollQueryActivity', () => {
  it('resolves when status becomes Complete', async () => {
    let i = 0;
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': () => {
        i++;
        return { queryDefinitionId: 'Q-123', status: i < 2 ? 'Running' : 'Complete' };
      },
    });
    const res = await pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 2000 });
    expect(res.status).toBe('Complete');
  });

  it('throws on Error status', async () => {
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': { status: 'Error', statusMessage: 'SQL syntax error near FROMM' },
    });
    await expect(pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 1000 }))
      .rejects.toThrow(/SQL syntax error/);
  });

  it('throws on timeout', async () => {
    const { mc } = mkMockMc({
      'GET /automation/v1/queries/Q-123': { status: 'Running' },
    });
    await expect(pollQueryActivity(mc, 'Q-123', { intervalMs: 10, timeoutMs: 50 }))
      .rejects.toThrow(/timeout/i);
  });
});
