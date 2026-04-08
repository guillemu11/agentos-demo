// packages/core/gif-pipeline/presets/bounce_headline.js
// Headline with elastic bounce entrance, hold, then slight settle.
//
// Timeline (normalized 0..1):
//   0.00 - 0.40  →  entrance (bounce from above)
//   0.40 - 0.85  →  hold (fully visible)
//   0.85 - 1.00  →  optional fade of subtitle (if present)

import { easeOutBounce, fillBackground, clamp } from './_shared.js';

export const metadata = {
  name: 'bounce_headline',
  description: 'Large headline text with elastic bounce entrance — ideal for sales, discounts, announcements',
  required_params: ['text'],
  optional_params: ['subtitle', 'bg_color', 'text_color', 'subtitle_color'],
  default_params: {
    bg_color: '#0A0A0A',
    text_color: '#FFD700',
    subtitle_color: '#FFFFFF',
    duration_ms: 2500,
  },
  default_size: { width: 600, height: 315 },
};

/**
 * Render a single frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} frameIndex - 0-based current frame
 * @param {number} totalFrames - Total frames in the animation
 * @param {object} params - Merged params (user + defaults)
 * @param {object} size - { width, height }
 */
export function render(ctx, frameIndex, totalFrames, params, size) {
  const { width, height } = size;
  const t = frameIndex / Math.max(1, totalFrames - 1); // 0..1

  fillBackground(ctx, params.bg_color, width, height);

  // Headline position: bounces in from y = -headline height to y = center.
  const headlineFontSize = Math.round(height * 0.28);
  ctx.font = `bold ${headlineFontSize}px Inter`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = params.text_color;

  const entranceEnd = 0.4;
  let headlineY;
  if (t < entranceEnd) {
    const progress = t / entranceEnd; // 0..1
    const eased = easeOutBounce(progress);
    const startY = -headlineFontSize;
    const endY = height / 2 - (params.subtitle ? headlineFontSize * 0.25 : 0);
    headlineY = startY + (endY - startY) * eased;
  } else {
    headlineY = height / 2 - (params.subtitle ? headlineFontSize * 0.25 : 0);
  }

  ctx.fillText(params.text, width / 2, headlineY);

  // Subtitle fades in during hold phase
  if (params.subtitle) {
    const subtitleFontSize = Math.round(height * 0.1);
    ctx.font = `bold ${subtitleFontSize}px Inter`;
    ctx.fillStyle = params.subtitle_color;

    const fadeStart = 0.45;
    const fadeEnd = 0.65;
    let alpha = 0;
    if (t >= fadeStart) {
      alpha = clamp((t - fadeStart) / (fadeEnd - fadeStart), 0, 1);
    }
    ctx.globalAlpha = alpha;
    ctx.fillText(params.subtitle, width / 2, height / 2 + headlineFontSize * 0.6);
    ctx.globalAlpha = 1;
  }
}
