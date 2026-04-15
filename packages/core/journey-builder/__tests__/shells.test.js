import { describe, it, expect, vi } from 'vitest';
import { createEmailShells } from '../shells.js';

describe('createEmailShells', () => {
  it('duplicates one email per email_send activity and fills mc_email_id', async () => {
    const dsl = {
      name: 'TestJourney',
      activities: [
        { id: 's1', type: 'email_send', campaign_type: 'product-offer-ecommerce', email_shell_name: 'Shell_A', mc_email_id: null, next: null },
        { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null },
        { id: 's2', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'Shell_B', mc_email_id: null, next: null },
      ],
    };
    const duplicateEmail = vi.fn()
      .mockResolvedValueOnce({ assetId: 11 })
      .mockResolvedValueOnce({ assetId: 22 });
    const out = await createEmailShells({ mc: {}, dsl, folderId: 99, duplicateEmail });
    expect(duplicateEmail).toHaveBeenCalledTimes(2);
    expect(out.activities.find((a) => a.id === 's1').mc_email_id).toBe(11);
    expect(out.activities.find((a) => a.id === 's2').mc_email_id).toBe(22);
    const firstCall = duplicateEmail.mock.calls[0][1];
    expect(firstCall.newName).toBe('Shell_A');
    expect(firstCall.categoryId).toBe(99);
    expect(firstCall.sourceAssetId).toBe(44793); // product-offer-ecommerce.templates.noCugoCode
    expect(firstCall.attributes.attr5).toMatch(/^CCPRODOFFR_/);
  });

  it('skips email_send activities that already have mc_email_id (idempotent retry)', async () => {
    const dsl = {
      name: 'T',
      activities: [
        { id: 's1', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'A', mc_email_id: 777, next: null },
        { id: 's2', type: 'email_send', campaign_type: 'newsletter', email_shell_name: 'B', mc_email_id: null, next: null },
      ],
    };
    const duplicateEmail = vi.fn().mockResolvedValueOnce({ assetId: 888 });
    const out = await createEmailShells({ mc: {}, dsl, folderId: 1, duplicateEmail });
    expect(duplicateEmail).toHaveBeenCalledTimes(1);
    expect(out.activities.find((a) => a.id === 's1').mc_email_id).toBe(777);
    expect(out.activities.find((a) => a.id === 's2').mc_email_id).toBe(888);
  });

  it('throws for unknown campaign_type', async () => {
    const dsl = {
      name: 'T',
      activities: [{ id: 's1', type: 'email_send', campaign_type: 'nope', email_shell_name: 'X', mc_email_id: null, next: null }],
    };
    const duplicateEmail = vi.fn();
    await expect(createEmailShells({ mc: {}, dsl, folderId: 1, duplicateEmail }))
      .rejects.toThrow(/campaign_type/);
    expect(duplicateEmail).not.toHaveBeenCalled();
  });
});
