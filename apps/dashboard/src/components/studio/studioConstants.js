// apps/dashboard/src/components/studio/studioConstants.js

export const IMAGE_SLOT_NAMES = [
  'hero_image', 'story1_image', 'story2_image', 'story3_image',
  'article_image', 'destination_image', 'banner_image',
];

export const MIN_APPROVED_FOR_HANDOFF = 5;

// ── Variable categorization ──────────────────────────────────────────────────

const IMAGE_VAR_PATTERN = /image|img|logo|banner|photo|pic/i;

export const PERSONALIZATION_VARS = [
  'firstname', 'lastname', 'loyalty_tier', 'miles_balance',
  'booking_ref', 'departure', 'arrival', 'travel_date',
  'tier_name', 'account_number', 'expiry_date',
];

const LINK_VAR_PATTERN = /(_alias|_link|_url)$/i;
// Only hide the link aliases for footer — the text vars are editable content
const FOOTER_VAR_PATTERN = /^(unsub_link|contactus_link|privacy_link|vawp|join_skw)/i;

/**
 * Categorize an AMPscript variable name (without @) into:
 * 'image' | 'personalization' | 'link' | 'footer' | 'content'
 */
export function categorizeVar(varName) {
  if (IMAGE_VAR_PATTERN.test(varName)) return 'image';
  if (PERSONALIZATION_VARS.includes(varName)) return 'personalization';
  if (LINK_VAR_PATTERN.test(varName)) return 'link';
  if (FOOTER_VAR_PATTERN.test(varName)) return 'footer';
  return 'content';
}

/**
 * Convert a snake_case variable name to a readable label.
 * e.g. "story1_header" → "Story 1 Header"
 */
export function varLabel(varName) {
  return varName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
