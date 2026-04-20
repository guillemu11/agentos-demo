import pool from '../db/pool.js';

const ALWAYS_OPEN = new Set(['welcome', 'double_opt_in', 'transactional', 'preference_update']);

export function shouldOpen(classification, persona, rng = Math.random) {
  const type = classification?.type;
  if (ALWAYS_OPEN.has(type)) return true;
  const rate = persona?.profile?.engagement_pattern?.base_open_rate ?? 0.5;
  return rng() < rate;
}

export function extractTrackingPixels(html = '') {
  const out = [];
  const re = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1];
    const isTiny = /width=["']?1["']?/i.test(m[0]) || /height=["']?1["']?/i.test(m[0]);
    const looksTracking = /track|pixel|beacon|open\.aspx|\/o\//i.test(src);
    if (isTiny || looksTracking) out.push(src);
  }
  return out;
}

export function extractClickableLinks(html = '') {
  const out = [];
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!/^https?:\/\//i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    out.push({ href, text });
  }
  return out;
}

export function pickClickableLinks(links, persona, max = 2) {
  const kws = persona?.profile?.engagement_pattern?.click_keywords || [];
  if (!kws.length) return [];
  const matched = links.filter(l => {
    const hay = `${l.href} ${l.text}`.toLowerCase();
    return kws.some(k => hay.includes(k.toLowerCase()));
  });
  return matched.slice(0, max);
}

async function fetchPixel(url) {
  try {
    await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Gmail-web)',
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8'
      }
    });
  } catch { /* ignore — still counts as open attempt */ }
}

async function fetchClick(url) {
  try {
    await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Gmail-web)' }
    });
  } catch { /* ignore */ }
}

export async function simulateEngagementForEmail(emailId) {
  const e = (await pool.query('SELECT * FROM competitor_emails WHERE id = $1', [emailId])).rows[0];
  if (!e) throw new Error('email not found');
  const persona = (await pool.query('SELECT * FROM competitor_personas WHERE id = $1', [e.persona_id])).rows[0];

  const events = [];
  if (!shouldOpen(e.classification, persona)) return { events, opened: false };

  const pixels = extractTrackingPixels(e.body_html || '');
  await Promise.all(pixels.map(fetchPixel));

  const openIns = await pool.query(
    `INSERT INTO competitor_email_engagement(email_id, event_type, simulated) VALUES ($1,'open',true)
     RETURNING id, occurred_at`,
    [emailId]
  );
  events.push({ type: 'open', ...openIns.rows[0] });

  const links = extractClickableLinks(e.body_html || '');
  const chosen = pickClickableLinks(links, persona);
  for (const l of chosen) {
    await fetchClick(l.href);
    const clickIns = await pool.query(
      `INSERT INTO competitor_email_engagement(email_id, event_type, link_url, simulated) VALUES ($1,'click',$2,true)
       RETURNING id, occurred_at`,
      [emailId, l.href]
    );
    events.push({ type: 'click', href: l.href, ...clickIns.rows[0] });
  }
  return { events, opened: true };
}

export async function autoEngageRecent({ sinceMinutes = 30 } = {}) {
  const candidates = (await pool.query(`
    SELECT e.id FROM competitor_emails e
    LEFT JOIN competitor_email_engagement g ON g.email_id = e.id
    WHERE e.received_at > NOW() - ($1 || ' minutes')::interval
      AND g.id IS NULL
  `, [String(sinceMinutes)])).rows;
  const out = [];
  for (const c of candidates) {
    try { out.push({ emailId: c.id, ...(await simulateEngagementForEmail(c.id)) }); }
    catch (e) { out.push({ emailId: c.id, error: e.message }); }
  }
  return out;
}
