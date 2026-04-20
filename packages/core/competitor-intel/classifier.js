import pool from '../db/pool.js';

export function extractRootDomain(host) {
  if (!host) return null;
  const parts = host.toLowerCase().split('.');
  if (parts.length >= 3 && ['co','com','org','net','gov'].includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function domainFromEmail(email) {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

export function matchBrandByDomain(sender, brands) {
  const domain = domainFromEmail(sender);
  if (!domain) return null;
  const root = extractRootDomain(domain);
  for (const b of brands) {
    const bRoot = extractRootDomain(b.website.replace(/^https?:\/\//, '').split('/')[0]);
    if (root === bRoot || domain.endsWith('.' + bRoot) || domain === bRoot) return b.id;
  }
  return null;
}

const TYPE_PATTERNS = [
  { type: 'double_opt_in',     re: /confirm (your )?(subscription|email|sign[-_ ]?up)|please confirm/i },
  { type: 'welcome',           re: /welcome( to|,)|thanks for (joining|signing up|subscribing)/i },
  { type: 'abandonment',       re: /left (something )?in your (cart|basket)|still thinking|forgot something|come back to your/i },
  { type: 'transactional',     re: /booking confirmation|order (confirmed|#\d+)|your (itinerary|receipt|invoice)/i },
  { type: 're_engagement',     re: /we miss you|come back|been a while|haven.?t seen you/i },
  { type: 'preference_update', re: /preferences (updated|saved)|manage your preferences/i },
  { type: 'promo',             re: /sale|% off|discount|limited[-_ ]?time|deal|offer/i }
];

export function classifyType({ subject = '', body = '' }) {
  const txt = `${subject}\n${body.slice(0, 500)}`;
  for (const p of TYPE_PATTERNS) if (p.re.test(txt)) return p.type;
  return 'nurture';
}

export async function classifyEmailPhase1(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query(`
    SELECT p.*, p.investigation_id FROM competitor_personas p WHERE p.id = $1
  `, [e.persona_id])).rows[0];
  const brands = (await pool.query('SELECT id, name, website FROM competitor_brands WHERE investigation_id = $1', [persona.investigation_id])).rows;

  const brandId = matchBrandByDomain(e.sender_email, brands);
  const type = classifyType({ subject: e.subject, body: e.body_text || '' });
  const classification = { type, phase: 1, confidence: brandId ? 0.9 : 0.4, reasoning: brandId ? 'domain match' : 'no domain match, type only' };

  await pool.query('UPDATE competitor_emails SET brand_id = COALESCE($1, brand_id), classification = $2 WHERE id = $3',
    [brandId, classification, emailId]);
  return { brandId, classification };
}
