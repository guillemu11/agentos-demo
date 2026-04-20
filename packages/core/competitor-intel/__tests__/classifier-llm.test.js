import { describe, it, expect } from 'vitest';
import { buildPrompt, parseResponse } from '../classifier-llm.js';

describe('classifier-llm', () => {
  it('prompt includes subject, snippet, brand list', () => {
    const prompt = buildPrompt({
      email: { subject: 'Hello', body_text: 'Body text here.', sender_email: 'x@y.com' },
      brands: [{ id: 1, name: 'Kuoni' }, { id: 2, name: 'Carrier' }]
    });
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('Body text here.');
    expect(prompt).toContain('Kuoni');
    expect(prompt).toContain('Carrier');
  });

  it('parses JSON response', () => {
    const r = parseResponse('{"brand_id":1,"type":"promo","confidence":0.82,"reasoning":"promo copy"}');
    expect(r.brand_id).toBe(1);
    expect(r.type).toBe('promo');
  });

  it('parses JSON embedded in prose', () => {
    const r = parseResponse('Here is the classification: {"brand_id":null,"type":"other","confidence":0.3,"reasoning":"unclear"}');
    expect(r.type).toBe('other');
  });

  it('returns null on unparseable', () => {
    expect(parseResponse('garbage')).toBeNull();
  });

  it('returns null on invalid type', () => {
    expect(parseResponse('{"brand_id":1,"type":"made_up_type","confidence":0.5,"reasoning":""}')).toBeNull();
  });
});
