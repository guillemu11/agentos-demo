import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefToWizardState } from '../src/pages/CampaignCreationV2/lib/briefAutofill.js';

test('copies step1 fields from brief', () => {
  const s = briefToWizardState({
    name: 'Launch X',
    objective: 'Drive upgrades',
    send_date: '2026-04-14T10:00:00Z',
    template_id: 'a350-premium-launch',
    markets: ['FR'],
    languages: ['en', 'fr'],
  });
  assert.equal(s.step1.name, 'Launch X');
  assert.equal(s.step1.templateId, 'a350-premium-launch');
  assert.deepEqual(s.step1.markets, ['FR']);
  assert.deepEqual(s.step1.languages, ['en', 'fr']);
});

test('expands variants from plan with accepted copy', () => {
  const s = briefToWizardState({
    variants_plan: [{ tier: 'Gold', behaviors: ['engaged'], size: 120 }],
    accepted_option: {
      direction: 'editorial', subject: 'Hello', body: 'Hi there',
      headline: 'Your next', preheader: 'Peek', cta_label: 'Go', cta_url: 'https://x',
    },
  });
  assert.equal(s.step2.variants.length, 1);
  assert.equal(s.step2.variants[0].tier, 'Gold');
  assert.equal(s.step2.variants[0].subject, 'Hello');
  assert.equal(s.step2.layoutDirection, 'editorial');
});

test('templateId is locked', () => {
  const s = briefToWizardState({});
  assert.ok(s.lockedFields.includes('templateId'));
});

test('handles null brief gracefully', () => {
  const s = briefToWizardState(null);
  assert.equal(s.step1.name, '');
  assert.deepEqual(s.step1.markets, []);
  assert.equal(s.step2.variants.length, 0);
});

test('prefilledFields is a Set and includes all step1 + step2 copy keys', () => {
  const s = briefToWizardState({});
  assert.ok(s.prefilledFields instanceof Set);
  for (const key of ['name', 'sendDate', 'markets', 'subject', 'headline', 'ctaUrl']) {
    assert.ok(s.prefilledFields.has(key), `missing ${key}`);
  }
});
