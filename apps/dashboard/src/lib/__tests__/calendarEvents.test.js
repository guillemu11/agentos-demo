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

  it('each event has required shape', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const ev = events[0];
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
  });

  it('always-on events include projected monthly volume', () => {
    const events = buildCalendarEvents(RANGE.start, RANGE.end);
    const cart = events.find(e => e.campaignId === 'cart-abandon');
    expect(cart.projectedVolume).toBeGreaterThan(0);
  });
});
