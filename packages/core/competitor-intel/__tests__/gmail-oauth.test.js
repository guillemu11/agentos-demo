import { describe, it, expect } from 'vitest';
import { buildAuthUrl, parseCallback } from '../gmail-oauth.js';

describe('gmail-oauth helpers', () => {
  it('builds auth URL with readonly scope and state', () => {
    const url = buildAuthUrl({ clientId: 'cid', redirectUri: 'http://x', state: 'p=1' });
    expect(url).toContain('scope=');
    expect(url).toContain('gmail.readonly');
    expect(url).toContain('state=p%3D1');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('parses callback params', () => {
    const parsed = parseCallback('code=abc&state=persona_id%3D7');
    expect(parsed.code).toBe('abc');
    expect(parsed.state).toBe('persona_id=7');
  });
});
