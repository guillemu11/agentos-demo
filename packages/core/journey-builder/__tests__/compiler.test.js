import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { compileDslToInteraction } from '../compiler.js';

const FIX = join(import.meta.dirname, 'fixtures');
const load = (f) => JSON.parse(readFileSync(join(FIX, f), 'utf8'));

describe('compileDslToInteraction', () => {
  it('minimal: single email_send', () => {
    const dsl = load('dsl-minimal.json');
    dsl.activities[0].mc_email_id = 99999;
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    expect(out.key).toMatch(/^journey-/);
    expect(out.name).toBe('Minimal');
    expect(out.workflowApiVersion).toBe(1.0);
    expect(out.triggers).toHaveLength(1);
    expect(out.triggers[0].type).toBe('AutomationAudience');
    expect(out.activities).toHaveLength(1);
    expect(out.activities[0].type).toBe('EMAILV2');
    expect(out.activities[0].configurationArguments.triggeredSend.emailId).toBe(99999);
  });

  it('full: all 5 activity types compile to correct SFMC types', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const typeMap = Object.fromEntries(out.activities.map(a => [a.key, a.type]));
    expect(typeMap['wait_1']).toBe('WAITBYDURATION');
    expect(typeMap['split_1']).toBe('MULTICRITERIADECISION');
    expect(typeMap['send_gold']).toBe('EMAILV2');
    expect(typeMap['wait_engage']).toBe('WAITBYEVENT');
    expect(typeMap['engage_split']).toBe('ENGAGEMENTSPLIT');
  });

  it('decision_split branches become outcomes with keys matching next ids', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const split = out.activities.find(a => a.key === 'split_1');
    expect(split.outcomes).toHaveLength(2);
    expect(split.outcomes.map(o => o.next)).toContain('send_gold');
    expect(split.outcomes.map(o => o.next)).toContain('send_silver');
  });

  it('email_send without mc_email_id throws', () => {
    const dsl = load('dsl-minimal.json');
    expect(() => compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' }))
      .toThrow(/mc_email_id/);
  });

  it('snapshots the full compiled output', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    // deterministic: strip timestamp from key for snapshot stability
    out.key = out.key.replace(/-\d+$/, '-TIMESTAMP');
    expect(out).toMatchSnapshot();
  });
});
