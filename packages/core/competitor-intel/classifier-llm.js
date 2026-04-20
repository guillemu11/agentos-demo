import pool from '../db/pool.js';

const VALID_TYPES = [
  'welcome', 'double_opt_in', 'nurture', 'promo', 'abandonment',
  'transactional', 'preference_update', 're_engagement', 'triggered_click_followup', 'other'
];

export function buildPrompt({ email, brands }) {
  const brandLines = brands.map(b => `- id=${b.id} name="${b.name}"`).join('\n');
  const snippet = (email.body_text || '').slice(0, 500).replace(/\s+/g, ' ').trim();
  return `You classify a marketing email into a lifecycle type and optionally assign it to one of the tracked brands.

BRANDS under investigation:
${brandLines}

EMAIL:
From: ${email.sender_email}
Subject: ${email.subject || '(no subject)'}
Body snippet: ${snippet}

Return STRICT JSON only (no prose before or after) with this shape:
{
  "brand_id": <int id from BRANDS list, or null if no match>,
  "type": <one of: ${VALID_TYPES.join(', ')}>,
  "confidence": <float 0..1>,
  "reasoning": <short string, 1 sentence>
}`;
}

export function parseResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const j = JSON.parse(match[0]);
    if (!VALID_TYPES.includes(j.type)) return null;
    return j;
  } catch {
    return null;
  }
}

async function callClaude(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
}

export async function classifyEmailPhase2(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query('SELECT investigation_id FROM competitor_personas WHERE id = $1', [e.persona_id])).rows[0];
  const brands = (await pool.query('SELECT id, name FROM competitor_brands WHERE investigation_id = $1', [persona.investigation_id])).rows;

  const prompt = buildPrompt({ email: e, brands });
  const raw = await callClaude(prompt);
  const parsed = parseResponse(raw);
  if (!parsed) return { skipped: true, reason: 'unparseable response' };

  const classification = { ...e.classification, ...parsed, phase: 2 };
  await pool.query(
    'UPDATE competitor_emails SET brand_id = COALESCE($1, brand_id), classification = $2 WHERE id = $3',
    [parsed.brand_id, classification, emailId]
  );
  return { classification };
}

export async function runPhase2Batch({ limit = 25 } = {}) {
  const candidates = (await pool.query(`
    SELECT id FROM competitor_emails
    WHERE brand_id IS NULL OR (classification->>'phase') IS DISTINCT FROM '2'
    ORDER BY received_at DESC NULLS LAST
    LIMIT $1
  `, [limit])).rows;
  const out = [];
  for (const c of candidates) {
    try { out.push({ emailId: c.id, ...(await classifyEmailPhase2(c.id)) }); }
    catch (e) { out.push({ emailId: c.id, error: e.message }); }
  }
  return out;
}
