import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichWithClaude } from '../server-calendar-ai.js';

describe('enrichWithClaude', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls Claude with events + ruleHits and returns enriched insights', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              enriched: [
                { id: 'seg-overload-2026-04-13-Premium', narrative: 'Premium overload detail', action: 'Reschedule', estimatedImpact: '-18% OR' },
              ],
              freeformInsights: [],
            }),
          }],
        }),
      },
    };
    const events = [{ id: 'a', campaignId: 'c', campaignName: 'C', startDate: '2026-04-13' }];
    const ruleHits = [{ id: 'seg-overload-2026-04-13-Premium', type: 'risk', severity: 'high', ruleId: 'segmentOverload', title: 'X', rawEvidence: {} }];
    const out = await enrichWithClaude({ client: fakeClient, events, ruleHits, rangeStart: '2026-04-01', rangeEnd: '2026-04-30' });
    expect(fakeClient.messages.create).toHaveBeenCalledOnce();
    expect(out.enriched).toHaveLength(1);
    expect(out.enriched[0].narrative).toBe('Premium overload detail');
  });

  it('returns raw ruleHits on Claude error (graceful degradation)', async () => {
    const fakeClient = { messages: { create: vi.fn().mockRejectedValue(new Error('api down')) } };
    const ruleHits = [{ id: 'x', type: 'risk', severity: 'low', ruleId: 'r', title: 'T', rawEvidence: {} }];
    const out = await enrichWithClaude({ client: fakeClient, events: [], ruleHits, rangeStart: '2026-04-01', rangeEnd: '2026-04-30' });
    expect(out.enriched).toHaveLength(1);
    expect(out.enriched[0].narrative).toBe('T');
    expect(out.degraded).toBe(true);
  });
});
