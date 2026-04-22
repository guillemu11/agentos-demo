// Pure mapping function: brief row (+ accepted_option) -> initial wizard state.
// Kept pure so it can be unit-tested under node --test without jsdom.

export function briefToWizardState(brief) {
  const opt = brief?.accepted_option || {};
  const variantsPlan = Array.isArray(brief?.variants_plan) ? brief.variants_plan : [];

  return {
    step1: {
      name:        brief?.name        || '',
      sendDate:    brief?.send_date   || null,
      templateId:  brief?.template_id || null,
      markets:     Array.isArray(brief?.markets)   ? brief.markets   : [],
      languages:   Array.isArray(brief?.languages) ? brief.languages : [],
      objective:   brief?.objective   || '',
      audience:    brief?.audience_summary || '',
    },
    step2: {
      layoutDirection: opt.direction  || null,
      subject:         opt.subject    || '',
      preheader:       opt.preheader  || '',
      headline:        opt.headline   || '',
      body:            opt.body       || '',
      ctaLabel:        opt.cta_label  || '',
      ctaUrl:          opt.cta_url    || '',
      mood:            opt.mood       || '',
      variants: variantsPlan.map((v, i) => ({
        id:        `v${i + 1}`,
        tier:      v?.tier || '',
        behaviors: Array.isArray(v?.behaviors) ? v.behaviors : [],
        size:      typeof v?.size === 'number' ? v.size : 0,
        subject:   opt.subject   || '',
        preheader: opt.preheader || '',
        headline:  opt.headline  || '',
        body:      opt.body      || '',
        ctaLabel:  opt.cta_label || '',
        ctaUrl:    opt.cta_url   || '',
      })),
    },
    lockedFields: ['templateId'],
    prefilledFields: new Set([
      'name', 'sendDate', 'templateId', 'markets', 'languages', 'objective', 'audience',
      'layoutDirection', 'subject', 'preheader', 'headline', 'body', 'ctaLabel', 'ctaUrl',
    ]),
  };
}
