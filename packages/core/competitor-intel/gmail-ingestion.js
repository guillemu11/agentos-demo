import { google } from 'googleapis';
import pool from '../db/pool.js';
import { getAuthorizedClient } from './gmail-oauth.js';
import { classifyEmailPhase1 } from './classifier.js';

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function pickHeader(headers, name) {
  const h = headers.find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

function parseBodies(payload) {
  let text = null, html = null;
  function walk(p) {
    if (!p) return;
    const mime = p.mimeType || '';
    if (mime === 'text/plain' && p.body?.data && !text) text = b64urlDecode(p.body.data);
    if (mime === 'text/html'  && p.body?.data && !html) html = b64urlDecode(p.body.data);
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  return { text, html };
}

export function parseGmailMessage(msg) {
  const h = msg.payload?.headers || [];
  const fromRaw = pickHeader(h, 'From') || '';
  const m = fromRaw.match(/<([^>]+)>/);
  const sender_email = (m ? m[1] : fromRaw).trim().toLowerCase();
  const sender_domain = sender_email.includes('@') ? sender_email.split('@')[1] : null;
  const bodies = parseBodies(msg.payload);
  return {
    gmail_message_id: msg.id,
    sender_email,
    sender_domain,
    subject: pickHeader(h, 'Subject'),
    received_at: new Date(parseInt(msg.internalDate, 10)),
    body_text: bodies.text,
    body_html: bodies.html,
    raw_headers: h
  };
}

export async function ingestPersona(personaId) {
  const oauth = await getAuthorizedClient(personaId);
  const gmail = google.gmail({ version: 'v1', auth: oauth });

  const rowLast = await pool.query('SELECT last_sync_at FROM competitor_persona_gmail WHERE persona_id = $1', [personaId]);
  const lastSync = rowLast.rows[0]?.last_sync_at;
  const afterEpoch = lastSync ? Math.floor(new Date(lastSync).getTime() / 1000) : 0;
  const q = `${afterEpoch ? `after:${afterEpoch} ` : ''}-from:me -category:social`;

  const list = await gmail.users.messages.list({
    userId: 'me', q, includeSpamTrash: true, maxResults: 100
  });
  const ids = (list.data.messages || []).map(m => m.id);

  let inserted = 0;
  for (const id of ids) {
    const exists = await pool.query('SELECT 1 FROM competitor_emails WHERE gmail_message_id = $1', [id]);
    if (exists.rowCount > 0) continue;
    const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const p = parseGmailMessage(data);
    const ins = await pool.query(`
      INSERT INTO competitor_emails
        (persona_id, gmail_message_id, sender_email, sender_domain, subject, received_at, body_text, body_html, raw_headers)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (gmail_message_id) DO NOTHING
      RETURNING id
    `, [personaId, p.gmail_message_id, p.sender_email, p.sender_domain, p.subject, p.received_at, p.body_text, p.body_html, JSON.stringify(p.raw_headers)]);
    if (ins.rows[0]) {
      try { await classifyEmailPhase1(ins.rows[0].id); } catch (e) { console.warn('[ci classify]', e.message); }
      inserted++;
    }
  }
  await pool.query('UPDATE competitor_persona_gmail SET last_sync_at = NOW() WHERE persona_id = $1', [personaId]);
  return { inserted, scanned: ids.length };
}

export async function ingestAll() {
  const personas = (await pool.query('SELECT persona_id FROM competitor_persona_gmail')).rows;
  const out = [];
  for (const p of personas) {
    try { out.push({ personaId: p.persona_id, ...(await ingestPersona(p.persona_id)) }); }
    catch (e) { out.push({ personaId: p.persona_id, error: e.message }); }
  }
  return out;
}

export function startWorker({ intervalMs = 5 * 60 * 1000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await ingestAll(); } catch (e) { console.error('[competitor-intel ingest]', e.message); }
    finally { running = false; }
  };
  const handle = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(handle);
}
