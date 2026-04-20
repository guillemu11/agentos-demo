import { describe, it, expect } from 'vitest';
import { parseGmailMessage } from '../gmail-ingestion.js';

const FIXTURE = {
  id: 'abc123',
  internalDate: '1713609600000',
  payload: {
    headers: [
      { name: 'From', value: 'Kuoni <hello@kuoni.co.uk>' },
      { name: 'Subject', value: 'Welcome to Kuoni' },
      { name: 'Date', value: 'Mon, 20 Apr 2026 12:00:00 +0000' }
    ],
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/plain', body: { data: Buffer.from('hello plain').toString('base64url') } },
      { mimeType: 'text/html',  body: { data: Buffer.from('<p>hello html</p>').toString('base64url') } }
    ]
  }
};

describe('parseGmailMessage', () => {
  it('extracts subject, sender, date, bodies', () => {
    const p = parseGmailMessage(FIXTURE);
    expect(p.gmail_message_id).toBe('abc123');
    expect(p.sender_email).toBe('hello@kuoni.co.uk');
    expect(p.sender_domain).toBe('kuoni.co.uk');
    expect(p.subject).toBe('Welcome to Kuoni');
    expect(p.body_text).toContain('hello plain');
    expect(p.body_html).toContain('hello html');
    expect(p.received_at).toBeInstanceOf(Date);
  });
});
