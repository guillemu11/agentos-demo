import { describe, it, expect } from 'vitest';
import { matchBrandByDomain, classifyType } from '../classifier.js';

const BRANDS = [
  { id: 10, name: 'Kuoni',     website: 'kuoni.co.uk' },
  { id: 11, name: 'Carrier',   website: 'carrier.co.uk' },
  { id: 12, name: 'CV Villas', website: 'cvvillas.com' }
];

describe('phase-1 classifier', () => {
  it('matches root domain', () => {
    expect(matchBrandByDomain('newsletter@kuoni.co.uk', BRANDS)).toBe(10);
  });
  it('matches subdomain', () => {
    expect(matchBrandByDomain('hello@email.carrier.co.uk', BRANDS)).toBe(11);
  });
  it('returns null for unknown', () => {
    expect(matchBrandByDomain('noreply@mailgun.org', BRANDS)).toBeNull();
  });
  it('classifies subject patterns', () => {
    expect(classifyType({ subject: 'Welcome to Kuoni', body: '' })).toBe('welcome');
    expect(classifyType({ subject: 'Please confirm your subscription', body: '' })).toBe('double_opt_in');
    expect(classifyType({ subject: 'You left something in your basket', body: '' })).toBe('abandonment');
    expect(classifyType({ subject: 'Your booking confirmation #1234', body: '' })).toBe('transactional');
    expect(classifyType({ subject: 'We miss you — come back', body: '' })).toBe('re_engagement');
    expect(classifyType({ subject: 'Flash sale — 30% off', body: '' })).toBe('promo');
    expect(classifyType({ subject: 'Spring inspiration', body: '' })).toBe('nurture');
  });
});
