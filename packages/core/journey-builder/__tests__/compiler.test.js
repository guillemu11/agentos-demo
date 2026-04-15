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
    expect(out.workflowApiVersion).toBe(1); // integer, not float — MC deserializer is picky
    expect(out.triggers).toHaveLength(1);
    expect(out.triggers[0].type).toBe('AutomationAudience');
    expect(out.activities).toHaveLength(1);
    expect(out.activities[0].type).toBe('EMAILV2');
    expect(out.activities[0].configurationArguments.triggeredSend.emailId).toBe(99999);
  });

  it('full: all 5 activity types compile with typed keys {TYPE}-{N}', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const types = out.activities.map(a => a.type).sort();
    expect(types).toContain('WAITBYDURATION');
    expect(types).toContain('MULTICRITERIADECISION');
    expect(types).toContain('EMAILV2');
    expect(types).toContain('WAITBYEVENT');
    expect(types).toContain('ENGAGEMENTSPLIT');
    for (const a of out.activities) {
      expect(a.key).toMatch(new RegExp(`^${a.type}-\\d+$`));
    }
  });

  it('decision_split outcomes translate DSL ids to typed keys', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    const split = out.activities.find(a => a.type === 'MULTICRITERIADECISION');
    expect(split.outcomes).toHaveLength(2);
    for (const o of split.outcomes) {
      expect(o.next).toMatch(/^(EMAILV2|WAITBYDURATION|MULTICRITERIADECISION|ENGAGEMENTSPLIT|WAITBYEVENT)-\d+$/);
    }
  });

  it('every activity has metaData.isConfigured:true for MC UI', () => {
    const dsl = load('dsl-full.json');
    dsl.activities.filter(a => a.type === 'email_send').forEach((a, i) => a.mc_email_id = 10000 + i);
    const out = compileDslToInteraction(dsl, { target_de_key: 'TGT-KEY' });
    for (const a of out.activities) expect(a.metaData?.isConfigured).toBe(true);
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
