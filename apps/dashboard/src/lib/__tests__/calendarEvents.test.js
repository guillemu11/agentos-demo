import { describe, it, expect } from 'vitest';
import { buildCalendarEvents } from '../calendarEvents.js';

const RANGE = { start: '2026-04-01', end: '2026-04-30' };

describe('buildCalendarEvents', () => {
  it('returns an array', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    expect(Array.isArray(events)).toBe(true);
  });

  it('includes scheduled BAU campaigns within range', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const newA350 = events.find(e => e.campaignId === 'special-announcement' && e.startDate === '2026-04-15');
    expect(newA350).toBeDefined();
    expect(newA350.flavor).toBe('scheduled');
    expect(newA350.group).toBe('broadcast');
  });

  it('excludes BAU campaigns outside range', () => {
    const events = buildCalendarEvents('2026-04-01', '2026-04-10');
    expect(events.find(e => e.startDate === '2026-04-15')).toBeUndefined();
  });

  it('emits a fixed Statement Email on the 14th', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const statement = events.find(e => e.campaignId === 'statement-email');
    expect(statement).toBeDefined();
    expect(statement.flavor).toBe('fixed');
    expect(statement.startDate).toBe('2026-04-14');
    expect(statement.endDate).toBe('2026-04-14');
  });

  it('emits always-on lifecycle programs spanning the full range', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const cart = events.find(e => e.campaignId === 'cart-abandon');
    expect(cart).toBeDefined();
    expect(cart.flavor).toBe('always-on');
    expect(cart.startDate).toBe('2026-04-01');
    expect(cart.endDate).toBe('2026-04-30');
  });

  it('every event has required shape across all flavors', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const scheduled = events.find(e => e.flavor === 'scheduled');
    const fixed = events.find(e => e.flavor === 'fixed');
    const alwaysOn = events.find(e => e.flavor === 'always-on');
    expect(scheduled).toBeDefined();
    expect(fixed).toBeDefined();
    expect(alwaysOn).toBeDefined();
    for (const ev of [scheduled, fixed, alwaysOn]) {
      expect(ev).toMatchObject({
        id: expect.any(String),
        campaignId: expect.any(String),
        campaignName: expect.any(String),
        group: expect.any(String),
        flavor: expect.stringMatching(/^(fixed|scheduled|always-on)$/),
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        channel: expect.any(String),
        color: expect.stringMatching(/^#/),
      });
    }
  });

  it('always-on events include projected monthly volume', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const cart = events.find(e => e.campaignId === 'cart-abandon');
    expect(cart.projectedVolume).toBeGreaterThan(0);
  });

  it('emits one fixed event per month across a multi-month range', () => {
    const events = buildCalendarEvents('2026-04-01', '2026-05-31');
    const statements = events.filter(e => e.campaignId === 'statement-email');
    expect(statements).toHaveLength(2);
    expect(statements.map(e => e.startDate).sort()).toEqual(['2026-04-14', '2026-05-14']);
  });

  it('returns empty array for inverted range (start > end)', () => {
    expect(buildCalendarEvents('2026-04-30', '2026-04-01')).toEqual([]);
  });
});
