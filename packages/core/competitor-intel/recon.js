import pool from '../db/pool.js';

const ESP_SIGNATURES = [
  { name: 'Salesforce Marketing Cloud', patterns: [/exacttarget\.com/i, /cloud\.em\./i, /s7\.exacttarget/i] },
  { name: 'Braze',                      patterns: [/braze\.com/i, /appboy\.com/i] },
  { name: 'Klaviyo',                    patterns: [/klaviyo\.com/i] },
  { name: 'Mailchimp',                  patterns: [/list-manage\.com/i, /mailchimp\.com/i] },
  { name: 'Adestra',                    patterns: [/adestra\.com/i, /tripolis\.com/i] },
  { name: 'Bloomreach',                 patterns: [/bloomreach\.com/i, /exponea\.com/i] },
  { name: 'HubSpot',                    patterns: [/hubspot\.com/i, /hs-scripts\.com/i] },
  { name: 'Emarsys',                    patterns: [/emarsys\.com/i, /scarabresearch\.com/i] },
  { name: 'Dotdigital',                 patterns: [/dotdigital\.com/i, /dotmailer\.com/i] },
  { name: 'Pure360',                    patterns: [/pure360\.com/i] }
];

const CDP_SIGNATURES = [
  { name: 'OneTrust',  patterns: [/onetrust/i, /cookielaw\.org/i] },
  { name: 'Cookiebot', patterns: [/cookiebot/i] },
  { name: 'Segment',   patterns: [/segment\.com\/analytics\.js/i, /cdn\.segment\.com/i] },
  { name: 'Tealium',   patterns: [/tealium/i] },
  { name: 'Google Tag Manager', patterns: [/googletagmanager\.com\/gtm/i] }
];

export function detectTechFromHtml(html) {
  const esps = [];
  const cdps = [];
  for (const esp of ESP_SIGNATURES) {
    if (esp.patterns.some(p => p.test(html))) esps.push(esp.name);
  }
  for (const cdp of CDP_SIGNATURES) {
    if (cdp.patterns.some(p => p.test(html))) cdps.push(cdp.name);
  }
  return { esps, cdps };
}

export function extractNewsletterForm(html) {
  const formRe = /<form[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRe.exec(html)) !== null) {
    const inner = match[2];
    if (!/type=["']email["']/i.test(inner)) continue;
    const action = match[1];
    const fields = [];
    const inputRe = /<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = inputRe.exec(inner)) !== null) fields.push(m[1]);
    return { action, fields };
  }
  return { action: null, fields: [] };
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9'
      },
      redirect: 'follow'
    });
    const html = await res.text();
    return { status: res.status, html, headers: Object.fromEntries(res.headers) };
  } catch (e) {
    return { status: 0, html: '', headers: {}, error: e.message };
  }
}

export async function reconBrand(brandId) {
  const brand = (await pool.query('SELECT * FROM competitor_brands WHERE id = $1', [brandId])).rows[0];
  if (!brand) throw new Error('brand not found');
  const url = brand.website.startsWith('http') ? brand.website : `https://${brand.website}`;
  const { status, html, headers, error } = await fetchHtml(url);
  const tech = detectTechFromHtml(html || '');
  const form = extractNewsletterForm(html || '');
  const notes = {
    fetched_at: new Date().toISOString(),
    http_status: status,
    fetch_error: error || null,
    server_header: headers.server || null,
    content_length: (html || '').length,
    esps_detected: tech.esps,
    cdps_detected: tech.cdps,
    newsletter_form: form,
    account_creation_hint: /\/register|\/sign[-]?up|\/account\/create|\/my[-_ ]?account/i.test(html),
    cart_hint:             /\/cart|\/basket|add[-_ ]to[-_ ]cart/i.test(html),
    quote_hint:            /request[-_ ]a[-_ ]quote|enquire|call[-_ ]an?[-_ ](expert|specialist)/i.test(html),
    popup_newsletter_hint: /newsletter|subscribe|sign[-_ ]up/i.test((html || '').slice(0, 50000))
  };
  await pool.query('UPDATE competitor_brands SET recon_notes = $1 WHERE id = $2', [notes, brandId]);
  return notes;
}

export async function reconInvestigation(investigationId) {
  const brands = (await pool.query('SELECT id, name FROM competitor_brands WHERE investigation_id = $1 ORDER BY name', [investigationId])).rows;
  const out = [];
  for (const b of brands) {
    try {
      const notes = await reconBrand(b.id);
      out.push({ brandId: b.id, brandName: b.name, http_status: notes.http_status, esps: notes.esps_detected, cdps: notes.cdps_detected });
    } catch (e) {
      out.push({ brandId: b.id, brandName: b.name, error: e.message });
    }
  }
  return out;
}
