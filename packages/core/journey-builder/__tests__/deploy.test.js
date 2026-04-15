import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deployJourney } from '../deploy.js';

const FIX = join(import.meta.dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('deployJourney', () => {
  it('runs the full sequence and returns mc ids', async () => {
    const dsl = load('dsl-full.json');

    const stubs = {
      ensureFolderHierarchy: vi.fn().mockResolvedValue({ emailFolderId: 500, deFolderId: 600 }),
      createDataExtension: vi.fn().mockResolvedValue({ customerKey: 'TGT-KEY' }),
      createQueryActivity: vi.fn().mockResolvedValue({ queryDefinitionId: 'Q-1' }),
      createEmailShells: vi.fn().mockImplementation(async ({ dsl }) => ({
        ...dsl,
        activities: dsl.activities.map((a) => (a.type === 'email_send' ? { ...a, mc_email_id: 11000 } : a)),
      })),
      createInteractionDraft: vi.fn().mockResolvedValue({ id: 'INT-999' }),
      ensureQueryFolder: vi.fn().mockResolvedValue(999),
    };

    const mc = {};
    const result = await deployJourney({ mc, dsl, config: { market: 'UAE' } }, stubs);

    expect(stubs.ensureFolderHierarchy).toHaveBeenCalled();
    expect(stubs.createDataExtension).toHaveBeenCalled();
    expect(stubs.createQueryActivity).toHaveBeenCalledWith(
      mc,
      expect.objectContaining({ sql: dsl.entry.source.sql, target_de_key: 'TGT-KEY' })
    );
    expect(stubs.createEmailShells).toHaveBeenCalled();
    expect(stubs.createInteractionDraft).toHaveBeenCalled();

    expect(result.mc_interaction_id).toBe('INT-999');
    expect(result.mc_target_de_key).toBe('TGT-KEY');
    expect(result.mc_query_activity_id).toBe('Q-1');
    expect(result.dsl.activities.filter((a) => a.type === 'email_send').every((a) => a.mc_email_id === 11000)).toBe(true);
  });

  it('hard-fails on invalid DSL without calling MC', async () => {
    const bad = load('dsl-invalid-cycle.json');
    const stubs = {
      ensureFolderHierarchy: vi.fn(),
      createDataExtension: vi.fn(),
      createQueryActivity: vi.fn(),
      createEmailShells: vi.fn(),
      createInteractionDraft: vi.fn(),
    };
    await expect(deployJourney({ mc: {}, dsl: bad, config: {} }, stubs)).rejects.toThrow(/cycle|Invalid DSL/i);
    expect(stubs.ensureFolderHierarchy).not.toHaveBeenCalled();
  });
});
