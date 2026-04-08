// packages/core/gif-pipeline/presets/index.js
// Central registry of all typographic presets.

import * as bounceHeadline from './bounce_headline.js';

const PRESETS = {
  bounce_headline: bounceHeadline,
  // Additional presets (countdown_flip, typewriter_reveal, slide_stack,
  // glow_badge, ticker_scroll) will be added in later tasks/plans.
};

export function getPreset(name) {
  return PRESETS[name] || null;
}

export function listPresets() {
  return Object.keys(PRESETS);
}

/**
 * Returns a text catalog suitable for inclusion in a Claude system prompt.
 * Each preset is described with its name, description, and params.
 */
export function getPresetCatalog() {
  return Object.entries(PRESETS)
    .map(([name, mod]) => {
      const meta = mod.metadata;
      return [
        `### ${name}`,
        meta.description,
        `Required params: ${meta.required_params.join(', ') || '(none)'}`,
        `Optional params: ${meta.optional_params.join(', ') || '(none)'}`,
      ].join('\n');
    })
    .join('\n\n');
}
