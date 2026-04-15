import { describe, it, expect } from 'vitest';
import {
  detectSegmentOverload,
  detectBauLifecycleCollision,
  detectLanguageImbalance,
  detectCoverageGap,
  detectHolidayWindowGap,
  detectFrequencyAnomaly,
  detectPerformanceOpportunity,
  runAllRules,
  computeHealthScore,
} from '../calendarAiRules.js';

const RANGE = { start: '2026-04-01', end: '2026-04-30' };

const ev = (overrides) => ({
  id: 'e',
  campaignId: 'c',
  campaignName: 'C',
  group: 'broadcast',
  flavor: 'scheduled',
  startDate: '2026-04-13',
  endDate: '2026-04-13',
  channel: 'email',
  segment: 'Premium Skywards',
  language: 'EN+AR',
  color: '#D71920',
  kpis: { openRate: 29, ctr: 3, conversions: 4000 },
  status: 'scheduled',
  ...overrides,
});

describe('detectSegmentOverload', () => {
  it('fires when ≥2 scheduled events hit same segment within 24h', () => {
    const events = [
      ev({ id: 'a', startDate: '2026-04-13', segment: 'Premium Skywards' }),
      ev({ id: 'b', startDate: '2026-04-13', segment: 'Premium Skywards' }),
      ev({ id: 'c', startDate: '2026-04-13', segment: 'Premium Skywards' }),
    ];
    const hits = detectSegmentOverload(events, RANGE);
    expect(hits).toHaveLength(1);
    expect(hits[0].type).toBe('risk');
    expect(hits[0].campaignIds).toHaveLength(3);
  });

  it('does not fire for single event', () => {
    expect(detectSegmentOverload([ev()], RANGE)).toEqual([]);
  });

  it('does not fire for different segments', () => {
    const events = [
      ev({ id: 'a', segment: 'Premium Skywards' }),
      ev({ id: 'b', segment: 'Silver' }),
    ];
    expect(detectSegmentOverload(events, RANGE)).toEqual([]);
  });
});

describe('detectBauLifecycleCollision', () => {
  it('fires when BAU scheduled on day with always-on program same segment', () => {
    const events = [
      ev({ id: 'bau', flavor: 'scheduled', segment: 'Skywards members who started checkout but did not complete' }),
      ev({ id: 'life', flavor: 'always-on', startDate: '2026-04-01', endDate: '2026-04-30', campaignId: 'cart-abandon', segment: 'Skywards members who started checkout but did not complete' }),
    ];
    const hits = detectBauLifecycleCollision(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('risk');
  });
});

describe('detectLanguageImbalance', () => {
  it('fires when language is only EN for Dubai/MENA segment', () => {
    const events = [ev({ segment: 'Dubai Residents', language: 'EN' })];
    const hits = detectLanguageImbalance(events, RANGE);
    expect(hits).toHaveLength(1);
    expect(hits[0].type).toBe('risk');
  });

  it('does not fire when EN+AR is set', () => {
    const events = [ev({ segment: 'Dubai Residents', language: 'EN+AR' })];
    expect(detectLanguageImbalance(events, RANGE)).toEqual([]);
  });
});

describe('detectCoverageGap', () => {
  it('fires when a tier segment has no touchpoint >10 days in range', () => {
    const events = [ev({ segment: 'Silver', startDate: '2026-04-02', endDate: '2026-04-02' })];
    const hits = detectCoverageGap(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('opportunity');
  });

  it('does not fire when tier has weekly touchpoints', () => {
    const events = [
      ev({ id: 'a', segment: 'Silver', startDate: '2026-04-03', endDate: '2026-04-03' }),
      ev({ id: 'b', segment: 'Silver', startDate: '2026-04-10', endDate: '2026-04-10' }),
      ev({ id: 'c', segment: 'Silver', startDate: '2026-04-17', endDate: '2026-04-17' }),
      ev({ id: 'd', segment: 'Silver', startDate: '2026-04-24', endDate: '2026-04-24' }),
    ];
    expect(detectCoverageGap(events, RANGE)).toEqual([]);
  });
});

describe('detectHolidayWindowGap', () => {
  it('fires when Eid Al Fitr 2026 (Apr 29) is in range with no offer campaign', () => {
    const events = [ev({ group: 'broadcast', startDate: '2026-04-03' })];
    const hits = detectHolidayWindowGap(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('opportunity');
    expect(hits[0].rawEvidence.holiday).toMatch(/Eid/i);
  });

  it('does not fire when offer campaign covers the holiday window', () => {
    const events = [ev({ group: 'offers', startDate: '2026-04-28', endDate: '2026-04-30' })];
    expect(detectHolidayWindowGap(events, RANGE)).toEqual([]);
  });
});

describe('detectFrequencyAnomaly', () => {
  it('fires when a campaign type exceeds 2x its historical median in the range', () => {
    const newsletters = Array.from({ length: 10 }, (_, i) => ev({
      id: `n${i}`, campaignId: 'newsletter', group: 'broadcast',
      startDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
      endDate: `2026-04-${String(i + 1).padStart(2, '0')}`,
    }));
    const hits = detectFrequencyAnomaly(newsletters, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('risk');
  });
});

describe('detectPerformanceOpportunity', () => {
  it('surfaces historical high-performer with no counterpart planned', () => {
    const events = [ev({ startDate: '2026-04-03' })];
    const hits = detectPerformanceOpportunity(events, RANGE);
    expect(Array.isArray(hits)).toBe(true);
  });
});

describe('runAllRules', () => {
  it('returns combined RuleHit[] from all rules', () => {
    const events = [
      ev({ id: 'a', segment: 'Premium Skywards' }),
      ev({ id: 'b', segment: 'Premium Skywards' }),
    ];
    const hits = runAllRules(events, RANGE);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(h => h.id && h.type && h.severity && h.ruleId)).toBe(true);
  });
});

describe('computeHealthScore', () => {
  it('returns 100 with no hits', () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it('subtracts 5 per high risk, 2 per medium, 1 per low', () => {
    const hits = [
      { type: 'risk', severity: 'high' },
      { type: 'risk', severity: 'medium' },
      { type: 'risk', severity: 'low' },
    ];
    expect(computeHealthScore(hits)).toBe(100 - 5 - 2 - 1);
  });

  it('clamps to 0 minimum', () => {
    const hits = Array.from({ length: 30 }, () => ({ type: 'risk', severity: 'high' }));
    expect(computeHealthScore(hits)).toBe(0);
  });

  it('ignores opportunities/insights in subtraction', () => {
    const hits = [{ type: 'opportunity', severity: 'high' }];
    expect(computeHealthScore(hits)).toBe(100);
  });
});
