// Generate BAU campaign content rows from a user brief.
// Uses the placeholder DE schema as a contract + a per-campaign-type block contract
// (mirrors campaign-bau-build skill step 3) so Claude fills EVERY field of the blocks
// it chooses to render. Empty fields hide blocks via AMPscript guards — do NOT emit null.

import Anthropic from '@anthropic-ai/sdk';
import { getDEFields } from './index.js';

const IMAGE_FIELD_REGEX = /image|logo|hero|masthead|banner/i;

// Which blocks each campaign type is expected to use.
// Derived from campaign-bau-build.md step 3 + email-build.md block-layout patterns.
const BLOCK_CONTRACTS = {
  'route-launch':          ['hero', 'masthead_body', 'fares', 'offer', 'story_circle', 'terms', 'caveat'],
  'route-launch-inbound':  ['hero', 'masthead_body', 'fares', 'offer', 'story_circle', 'terms', 'caveat'],
  'route-launch-outbound': ['hero', 'masthead_body', 'fares', 'offer', 'story_circle', 'terms', 'caveat'],
  'holiday-offer':         ['hero', 'masthead_body', 'story_circle', 'story_double', 'terms', 'caveat'],
  'product-offer-ecommerce': ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'product-offer-skywards':  ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'partner-offer':   ['hero', 'masthead_body', 'partner', 'offer', 'terms', 'caveat'],
  'partner-launch':  ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'broadcast-emirates': ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'event-offer':     ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'product-update':  ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'single-region':   ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'newsletter':      ['hero', 'masthead_body', 'story_circle', 'story_double', 'terms', 'caveat'],
  'occasional-announcement': ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'partner-acquisition':     ['hero', 'masthead_body', 'partner', 'offer', 'terms', 'caveat'],
  'partner-offer-promotion': ['hero', 'masthead_body', 'partner', 'offer', 'terms', 'caveat'],
  'special-announcement':    ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
  'survey':              ['hero', 'masthead_body', 'terms', 'caveat'],
  'new-language-pref':   ['hero', 'masthead_body', 'terms', 'caveat'],
  _default:              ['hero', 'masthead_body', 'offer', 'terms', 'caveat'],
};

// Canonical field list per block (from campaign-bau-build.md:63-72).
const BLOCK_FIELDS = {
  hero: [
    'subject_line', 'preheader', 'main_header', 'main_subheader', 'body_copy',
    'main_cta_text', 'main_cta_url', 'main_cta_alias',
    'masthead_image', 'fare_image', 'main_link', 'main_alias',
  ],
  masthead_body: ['body_copy', 'body_copy_salutation'],
  fares: [
    'fare_header', 'fare_subheader', 'fare_bookby', 'fare_image',
    'fare_economy', 'fare_business', 'fare_first',
    'fare_economy_url', 'fare_business_url', 'fare_first_url',
    'fare_economy_alias', 'fare_business_alias', 'fare_first_alias',
  ],
  offer: [
    'offer_block_header', 'offer_block_body', 'offer_block_cta_text',
    'offer_block_cta_link', 'offer_block_link_alias',
  ],
  story_circle: [
    'story_left_circle_image', 'story_left_circle_header',
    'story_left_circle_body', 'story_left_circle_cta',
    'story_left_circle_url', 'story_left_circle_alias',
    'story_right_circle_image', 'story_right_circle_header',
    'story_right_circle_cta',
  ],
  story_double: [
    'story_double_image1', 'story_double_header1', 'story_double_subheader1',
    'story_double_body1', 'story_double_url1', 'story_double_alias1',
    'story_double_image2', 'story_double_header2', 'story_double_subheader2',
    'story_double_body2', 'story_double_url2', 'story_double_alias2',
  ],
  story_single: [
    'story_single_left_image', 'story_single_header', 'story_single_body',
    'story_single_cta', 'story_single_url', 'story_single_alias',
  ],
  partner: [
    'partner_block_image', 'partner_block_image_title',
    'partner_block_body', 'partner_block_url',
  ],
  terms: ['terms_content1', 'terms_content2'],
  caveat: ['caveat_terms1'],
};

// Primary-key fields we always set ourselves.
const PK_FIELDS = new Set(['campaign_id', 'language', 'tier', 'global', 'market_code']);

function todayDDMMYY() {
  const d = new Date();
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

// Build an "available fields per block" view: intersection of BLOCK_FIELDS and the
// actual DE schema, so we only ask Claude to fill fields that really exist.
function groupSchemaByBlock(schema, expectedBlocks) {
  const schemaNames = new Set(schema.map(f => f.name));
  const grouped = {};
  const used = new Set();
  for (const block of expectedBlocks) {
    const candidates = BLOCK_FIELDS[block] || [];
    const present = candidates.filter(f => schemaNames.has(f));
    if (present.length) {
      grouped[block] = present;
      for (const f of present) used.add(f);
    }
  }
  // Any remaining schema fields that aren't PKs and didn't match a known block —
  // surface them as "other" so Claude can still populate them if relevant.
  const other = schema
    .filter(f => !PK_FIELDS.has(f.name) && !used.has(f.name))
    .map(f => f.name);
  if (other.length) grouped._other = other;
  return grouped;
}

export async function generateCampaignContent({
  mc, typeDef, campaignName, brief, languages, market, variant, dateDDMMYY,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  const placeholderKey = typeDef.placeholderDEs[0].key;
  const schema = await getDEFields(mc, placeholderKey);
  if (!schema.length) {
    throw new Error(`Placeholder DE ${placeholderKey} returned no schema fields`);
  }

  const campaignTypeKey = Object.keys(BLOCK_CONTRACTS).find(
    k => k !== '_default' && typeDef.name && (k === typeDef.name.toLowerCase().replace(/[^a-z]+/g, '-'))
  );
  // Map CAMPAIGN_TYPES key back. Since this module doesn't receive the key directly,
  // derive from typeDef.code.
  const codeToKey = {
    RL: 'route-launch', RLIB: 'route-launch-inbound', RLOB: 'route-launch-outbound',
    HO: 'holiday-offer',
    PO: variant === 'Skywards' ? 'product-offer-skywards' : 'product-offer-ecommerce',
    PR: 'partner-offer', PL: 'partner-launch',
    BCE: 'broadcast-emirates', EO: 'event-offer', PU: 'product-update',
    SR: 'single-region', NL: 'newsletter', OA: 'occasional-announcement',
    PA: 'partner-acquisition', PRP: 'partner-offer-promotion',
    SA: 'special-announcement', SS: 'survey', NLP: 'new-language-pref',
  };
  const effectiveKey = codeToKey[typeDef.code] || campaignTypeKey || '_default';
  const expectedBlocks = BLOCK_CONTRACTS[effectiveKey] || BLOCK_CONTRACTS._default;

  const grouped = groupSchemaByBlock(schema, expectedBlocks);
  const campaignId = `${campaignName}_${typeDef.attr5Code}_${dateDDMMYY || todayDDMMYY()}_in`;

  // Describe each field with type/maxLength so Claude respects limits.
  const fieldMeta = {};
  for (const f of schema) {
    fieldMeta[f.name] = {
      type: f.fieldType,
      maxLength: f.maxLength,
      isImage: IMAGE_FIELD_REGEX.test(f.name),
    };
  }

  const blocksSection = Object.entries(grouped)
    .map(([block, fields]) => {
      const label = block === '_other' ? 'Other available fields (use if relevant)' : `Block: ${block}`;
      const lines = fields.map(name => {
        const m = fieldMeta[name] || {};
        const bits = [name, m.type || '?'];
        if (m.maxLength) bits.push(`max ${m.maxLength}`);
        if (m.isImage) bits.push('IMAGE — emit {prompt: "..."}');
        return `  - ${bits.join(' | ')}`;
      }).join('\n');
      return `${label}\n${lines}`;
    })
    .join('\n\n');

  const prompt = `You are generating email content for an Emirates "${typeDef.name}" campaign.

Targeting:
- market: ${market}
- variant: ${variant}
- languages: ${JSON.stringify(languages)}

User brief:
${brief?.trim() || '(no brief — use sensible defaults consistent with this campaign type)'}

Expected blocks for this campaign type (decide which to include based on the brief):
${expectedBlocks.join(', ')}

Available DE fields grouped by block (use these EXACT names — no invented fields):
${blocksSection}

Output rules:
1. Emit ONE row per language in ${JSON.stringify(languages)}.
2. Primary keys on every row:
     campaign_id = "${campaignId}"
     language    = "<en|ar|de|...>"
     tier        = "all"
     global      = "true"
     market_code = "${String(market || '').toLowerCase()}"
3. **Pick the blocks you want to render** from the Expected list. For each chosen block, fill EVERY field in that block — do not leave any as null. AMPscript guards hide any block with an empty field, so partial fills destroy the layout.
4. For blocks you do NOT want to render, OMIT their fields entirely from the row (do not output null — just skip the keys).
5. IMAGE fields must be objects: { "prompt": "<detailed English visual description, one sentence, specific enough for Imagen>" }. Never a URL, number, or null.
6. TEXT fields: punchy marketing copy faithful to the brief. Respect maxLength.
7. RTL languages (ar, he): translate all text; keep image prompts in English.
8. Make content specific to the brief (no placeholder "Lorem ipsum" or generic "Book now").
9. Keep main_cta_url / *_url fields as plausible emirates.com paths ("https://www.emirates.com/uk/english/...") if a specific URL isn't provided.

Respond with EXACTLY this JSON and nothing else (no markdown fences):
{ "rows": [ { row for language 1 }, { row for language 2 }, ... ] }`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = resp.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Claude did not return JSON. Got: ${text.slice(0, 400)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Claude returned malformed JSON: ${err.message}. Raw: ${match[0].slice(0, 400)}`);
  }
  if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) {
    throw new Error(`Claude response missing .rows array. Got: ${JSON.stringify(parsed).slice(0, 400)}`);
  }

  // Strip any nulls Claude emitted anyway — let AMPscript guards work cleanly.
  for (const row of parsed.rows) {
    for (const k of Object.keys(row)) {
      if (row[k] === null || row[k] === '') delete row[k];
    }
  }

  for (const r of parsed.rows) {
    const keys = Object.keys(r);
    const imageFields = keys.filter(k => IMAGE_FIELD_REGEX.test(k));
    const textPreview = {};
    for (const k of keys) {
      if (imageFields.includes(k)) continue;
      const v = r[k];
      textPreview[k] = typeof v === 'string' ? v.slice(0, 60) : v;
    }
    console.log(`[content-gen] row language=${r.language} fields=${keys.length}`);
    console.log('[content-gen]   image fields:', imageFields);
    console.log('[content-gen]   text fields:', JSON.stringify(textPreview, null, 2));
  }

  return { rows: parsed.rows, schema };
}
