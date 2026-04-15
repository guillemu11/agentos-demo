import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateDsl } from '../dsl-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIX = join(__dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('validateDsl', () => {
  it('accepts minimal valid DSL', () => {
    const { valid, errors } = validateDsl(load('dsl-minimal.json'));
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts DSL with all 5 activity types', () => {
    const { valid, errors } = validateDsl(load('dsl-full.json'));
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects cycles', () => {
    const { valid, errors } = validateDsl(load('dsl-invalid-cycle.json'));
    expect(valid).toBe(false);
    expect(errors.some(e => /cycle/i.test(e))).toBe(true);
  });

  it('rejects dangling next', () => {
    const { valid, errors } = validateDsl(load('dsl-invalid-dangling-next.json'));
    expect(valid).toBe(false);
    expect(errors.some(e => /next.+does not reference/i.test(e))).toBe(true);
  });

  it('rejects SQL with DROP', () => {
    const bad = load('dsl-minimal.json');
    bad.entry.source.sql = 'DROP TABLE BAU_Master_Dataset';
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /dangerous sql/i.test(e))).toBe(true);
  });

  it('rejects email_send with unknown campaign_type', () => {
    const bad = load('dsl-minimal.json');
    bad.activities[0].campaign_type = 'not-a-real-type';
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /campaign_type/i.test(e))).toBe(true);
  });

  it('rejects wait_until_event pointing to a non-preceding send', () => {
    const bad = {
      version: 1, name: 'x',
      entry: { source: { type: 'master_de_query', master_de_key: 'M', sql: 'SELECT 1 FROM M', target_de_name: 'T' } },
      activities: [
        { id: 'wait', type: 'wait_until_event', event: 'email_opened', target_activity: 'send_later', timeout_hours: 24, on_event_next: null, on_timeout_next: null },
        { id: 'send_later', type: 'email_send', campaign_type: 'product-offer-ecommerce', email_shell_name: 's', mc_email_id: null, next: null }
      ]
    };
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /preceding|before|earlier/i.test(e))).toBe(true);
  });

  it('rejects duplicate activity ids', () => {
    const bad = load('dsl-minimal.json');
    bad.activities.push({ ...bad.activities[0] });
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /duplicate/i.test(e))).toBe(true);
  });

  it('rejects self-loop (a.next = a.id)', () => {
    const bad = {
      version: 1, name: 'SelfLoop',
      entry: { source: { type: 'master_de_query', master_de_key: 'M', sql: 'SELECT 1 FROM M', target_de_name: 'T' } },
      activities: [
        { id: 'loop', type: 'wait_duration', amount: 1, unit: 'days', next: 'loop' }
      ]
    };
    const { valid, errors } = validateDsl(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => /cycle/i.test(e))).toBe(true);
  });
});
