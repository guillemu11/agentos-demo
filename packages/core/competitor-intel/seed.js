import pool from '../db/pool.js';

const BRANDS = [
  { name: 'Kuoni',             website: 'kuoni.co.uk',    category: 'luxury',       positioning: 'Traditional luxury travel; quote-based model.' },
  { name: 'Carrier',           website: 'carrier.co.uk',  category: 'ultra-luxury', positioning: 'Consultant-led ultra-luxury; 1-to-1 journeys.' },
  { name: 'Inntravel',         website: 'inntravel.co.uk',category: 'slow-travel',  positioning: 'Slow, self-guided walking/cycling holidays.' },
  { name: 'Explore Worldwide', website: 'explore.co.uk',  category: 'adventure',    positioning: 'Small-group adventure holidays.' },
  { name: 'CV Villas',         website: 'cvvillas.com',   category: 'villa-rental', positioning: 'Transactional villa booking, Mediterranean focus.' }
];

const PERSONAS = [
  {
    name: 'Sarah Whitfield',
    age: 34,
    location: 'London SW1A 1AA, UK',
    profile: {
      segment: 'luxury_honeymooner',
      travel_interests: ['maldives','seychelles','mauritius','honeymoon','overwater','private villa','fine dining'],
      budget_band: 'high',
      engagement_pattern: { base_open_rate: 0.8, click_keywords: ['maldives','seychelles','mauritius','honeymoon','overwater','private villa'] }
    }
  },
  {
    name: 'Tom Haskins',
    age: 29,
    location: 'Manchester M1 1AA, UK',
    profile: {
      segment: 'adventure_solo',
      travel_interests: ['trek','hike','adventure','small group','patagonia','himalaya','kilimanjaro'],
      budget_band: 'mid',
      engagement_pattern: { base_open_rate: 0.6, click_keywords: ['trek','hike','adventure','small group','patagonia','himalaya','kilimanjaro'] }
    }
  }
];

const ASSIGNMENTS = {
  luxury_honeymooner: ['Kuoni','Carrier','Inntravel'],
  adventure_solo:     ['Explore Worldwide','CV Villas','Inntravel']
};

const BASE_STEPS = [
  { step_order: 1, action: 'Passive recon — visit homepage, accept essential cookies only. Capture cookie wall, tracking pixels, CDP.', channel: 'web',   expected_signal: 'No email expected',              wait_after_minutes: 0    },
  { step_order: 2, action: 'Newsletter sign-up from footer or popup with persona data.',                                                channel: 'web',   expected_signal: 'Welcome email within 24h',        wait_after_minutes: 5    },
  { step_order: 3, action: 'Confirm double opt-in by clicking confirmation link if sent.',                                              channel: 'email', expected_signal: 'Post-confirmation welcome or nurture', wait_after_minutes: 60  },
  { step_order: 4, action: 'Wait 24h observing emails with zero further interaction.',                                                  channel: 'none',  expected_signal: 'Baseline nurture cadence',        wait_after_minutes: 1440 },
  { step_order: 5, action: 'Create account if brand supports it, with persona data.',                                                   channel: 'web',   expected_signal: 'Account-creation email',          wait_after_minutes: 30   },
  { step_order: 6, action: 'Discover preference center, document granularity.',                                                         channel: 'web',   expected_signal: 'Preference-update confirmation',  wait_after_minutes: 15   },
  { step_order: 7, action: 'High-intent action: quote request or cart to checkout, brand-specific.',                                    channel: 'web',   expected_signal: 'Sales follow-up within 48h',      wait_after_minutes: 60   },
  { step_order: 8, action: 'Cart/form abandonment test: fill ~90% then exit.',                                                          channel: 'web',   expected_signal: 'Abandonment email within 24–72h', wait_after_minutes: 1440 }
];

export async function seedDertourInvestigation({ ownerUserId = null } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inv = await client.query(
      'INSERT INTO competitor_investigations(name, description, owner_user_id) VALUES ($1,$2,$3) RETURNING id',
      ['DERTOUR UK Lifecycle Audit — April 2026', 'Lifecycle/email/journey audit of 5 DERTOUR UK brands for Emirates SVP presentation.', ownerUserId]
    );
    const investigationId = inv.rows[0].id;

    const brandIds = {};
    for (const b of BRANDS) {
      const r = await client.query(
        'INSERT INTO competitor_brands(investigation_id, name, website, category, positioning) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [investigationId, b.name, b.website, b.category, b.positioning]
      );
      brandIds[b.name] = r.rows[0].id;
    }

    const personaIds = {};
    for (const p of PERSONAS) {
      const r = await client.query(
        'INSERT INTO competitor_personas(investigation_id, name, age, location, profile) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [investigationId, p.name, p.age, p.location, p.profile]
      );
      personaIds[p.profile.segment] = r.rows[0].id;
    }

    for (const [segment, brandNames] of Object.entries(ASSIGNMENTS)) {
      const personaId = personaIds[segment];
      for (const brandName of brandNames) {
        const brandId = brandIds[brandName];
        for (const step of BASE_STEPS) {
          await client.query(
            `INSERT INTO competitor_playbook_steps
             (brand_id, persona_id, step_order, action, channel, expected_signal, wait_after_minutes)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [brandId, personaId, step.step_order, step.action, step.channel, step.expected_signal, step.wait_after_minutes]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { investigationId, brandIds, personaIds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
