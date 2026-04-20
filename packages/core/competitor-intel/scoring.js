import pool from '../db/pool.js';

export function overallFromAxes(a) {
  const vals = [a.lifecycle_maturity, a.email_sophistication, a.journey_depth, a.personalisation]
    .filter(v => v != null)
    .map(Number);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function autoAxisFromEmails(axis, emails) {
  const types = new Set(emails.map(e => e.classification?.type).filter(Boolean));
  switch (axis) {
    case 'lifecycle_maturity': {
      // Each mature lifecycle stage present adds weight.
      const weights = {
        welcome: 2,
        double_opt_in: 1,
        nurture: 2,
        abandonment: 2,
        re_engagement: 2,
        triggered_click_followup: 1,
        preference_update: 1
      };
      let score = 0;
      for (const t of types) score += weights[t] || 0;
      return Math.min(10, score);
    }
    case 'email_sophistication': {
      // Heuristic: count emails that look personalised in copy.
      const personalised = emails.filter(e =>
        /\{\{.*\}\}/.test(e.subject || '') ||
        /hi [A-Z][a-z]+,/.test(e.body_text || '')
      ).length;
      return Math.min(10, 2 + Math.log2(1 + personalised) * 3);
    }
    case 'journey_depth': {
      // Raw number of distinct lifecycle types.
      const typeCount = types.size;
      return Math.min(10, typeCount * 1.5);
    }
    case 'personalisation': {
      const hasSegmentCues = emails.some(e =>
        /\bfor you\b|\bbased on\b|\bmatched to\b/i.test(e.subject || '') ||
        /\byour (interests|preferences)\b/i.test(e.body_text || '')
      );
      return hasSegmentCues ? 6 : 3;
    }
    default:
      return null;
  }
}

export async function computeBrandScores(brandId) {
  const emails = (await pool.query(
    'SELECT subject, body_text, classification FROM competitor_emails WHERE brand_id = $1',
    [brandId]
  )).rows;
  const axes = {
    lifecycle_maturity:   autoAxisFromEmails('lifecycle_maturity',   emails),
    email_sophistication: autoAxisFromEmails('email_sophistication', emails),
    journey_depth:        autoAxisFromEmails('journey_depth',        emails),
    personalisation:      autoAxisFromEmails('personalisation',      emails)
  };
  const overall = overallFromAxes(axes);
  await pool.query(`
    INSERT INTO competitor_brand_scores(brand_id, lifecycle_maturity, email_sophistication, journey_depth, personalisation, overall, last_calculated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT (brand_id) DO UPDATE SET
      lifecycle_maturity   = EXCLUDED.lifecycle_maturity,
      email_sophistication = EXCLUDED.email_sophistication,
      journey_depth        = EXCLUDED.journey_depth,
      personalisation      = EXCLUDED.personalisation,
      overall              = EXCLUDED.overall,
      last_calculated_at   = NOW()
  `, [brandId, axes.lifecycle_maturity, axes.email_sophistication, axes.journey_depth, axes.personalisation, overall]);
  return { axes, overall };
}

export async function setBrandScoreManual(brandId, payload) {
  const axes = {
    lifecycle_maturity:   payload.lifecycle_maturity,
    email_sophistication: payload.email_sophistication,
    journey_depth:        payload.journey_depth,
    personalisation:      payload.personalisation
  };
  const overall = overallFromAxes(axes);
  await pool.query(`
    INSERT INTO competitor_brand_scores(brand_id, lifecycle_maturity, email_sophistication, journey_depth, personalisation, overall, manual_notes, last_calculated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    ON CONFLICT (brand_id) DO UPDATE SET
      lifecycle_maturity   = EXCLUDED.lifecycle_maturity,
      email_sophistication = EXCLUDED.email_sophistication,
      journey_depth        = EXCLUDED.journey_depth,
      personalisation      = EXCLUDED.personalisation,
      overall              = EXCLUDED.overall,
      manual_notes         = EXCLUDED.manual_notes,
      last_calculated_at   = NOW()
  `, [brandId, axes.lifecycle_maturity, axes.email_sophistication, axes.journey_depth, axes.personalisation, overall, payload.manual_notes || null]);
  return { axes, overall };
}
