// apps/dashboard/src/components/studio/studioConstants.js
export const FIELD_TO_VAR = {
  subject:      '@subject',
  preheader:    '@preheader',
  heroHeadline: '@hero_title',
  bodyCopy:     '@body_copy',
  cta:          '@cta_text',
};

export const IMAGE_SLOT_NAMES = [
  'hero_image', 'story1_image', 'story2_image', 'story3_image',
  'article_image', 'destination_image', 'banner_image',
];

export const ALL_VARIANT_FIELDS = Object.keys(FIELD_TO_VAR);

export const MIN_APPROVED_FOR_HANDOFF = 5;
