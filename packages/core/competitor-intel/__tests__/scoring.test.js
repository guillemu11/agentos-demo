import { describe, it, expect } from 'vitest';
import { autoAxisFromEmails, overallFromAxes } from '../scoring.js';

describe('scoring', () => {
  it('computes overall as mean of 4 axes', () => {
    expect(overallFromAxes({ lifecycle_maturity: 5, email_sophistication: 7, journey_depth: 6, personalisation: 8 })).toBeCloseTo(6.5, 1);
  });

  it('returns null overall if all axes null', () => {
    expect(overallFromAxes({ lifecycle_maturity: null, email_sophistication: null, journey_depth: null, personalisation: null })).toBeNull();
  });

  it('auto lifecycle_maturity rewards diversity of lifecycle types', () => {
    const low  = [{ classification: { type: 'promo' } }, { classification: { type: 'promo' } }];
    const high = [
      { classification: { type: 'welcome' } },
      { classification: { type: 'nurture' } },
      { classification: { type: 'abandonment' } },
      { classification: { type: 're_engagement' } }
    ];
    expect(autoAxisFromEmails('lifecycle_maturity', low))
      .toBeLessThan(autoAxisFromEmails('lifecycle_maturity', high));
  });

  it('journey_depth scales with number of distinct lifecycle types', () => {
    const one  = [{ classification: { type: 'welcome' } }];
    const many = [
      { classification: { type: 'welcome' } },
      { classification: { type: 'nurture' } },
      { classification: { type: 'promo' } },
      { classification: { type: 'abandonment' } }
    ];
    expect(autoAxisFromEmails('journey_depth', many))
      .toBeGreaterThan(autoAxisFromEmails('journey_depth', one));
  });

  it('personalisation reads segment cues from subject/body', () => {
    const generic = [{ subject: 'Spring deals', body_text: '', classification: { type: 'promo' } }];
    const personal = [{ subject: 'For you, based on your interests', body_text: 'your preferences', classification: { type: 'nurture' } }];
    expect(autoAxisFromEmails('personalisation', personal))
      .toBeGreaterThan(autoAxisFromEmails('personalisation', generic));
  });
});
