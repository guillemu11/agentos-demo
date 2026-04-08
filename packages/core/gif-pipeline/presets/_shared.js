// packages/core/gif-pipeline/presets/_shared.js
// Shared helpers used by multiple typographic presets.

/**
 * Ease-out cubic — fast start, gentle finish. Good for entrances.
 * @param {number} t - Progress 0..1
 * @returns {number} Eased 0..1
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-out bounce — elastic bounce at the end. Good for headlines.
 * @param {number} t - Progress 0..1
 * @returns {number} Eased 0..1
 */
export function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Clamp a number into [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Fill the entire canvas with a solid color.
 */
export function fillBackground(ctx, color, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}
