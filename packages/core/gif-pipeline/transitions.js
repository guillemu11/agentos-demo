// packages/core/gif-pipeline/transitions.js
// Pure functions that expand a list of "key" RGBA frames into a longer list
// of GIF frames with inter-frame transitions. Each transition is a function:
//
//   (keyFrames: Uint8ClampedArray[], opts: { width, height, holdFrames, transitionFrames })
//     → Uint8ClampedArray[]
//
// Key frames are assumed to be already resized to `width`×`height`. Each output
// frame is a fresh Uint8ClampedArray of length width*height*4 (RGBA).
//
// Design notes:
// - We work on raw RGBA buffers, not on `sharp` objects, because the encoder
//   (gifenc) expects RGBA buffers and the slideshow pipeline keeps everything
//   in that format end-to-end. sharp is only used upstream to resize and
//   decode the Imagen PNGs into raw pixels.
// - `hold` frames are shared references to the same buffer (safe: gifenc does
//   not mutate frames it receives).
// - Intermediate transition frames are always fresh allocations.
// - `cut` has 0 transition frames by definition.

/**
 * Linearly interpolate two RGBA frames. alpha ∈ [0,1]: 0 = full a, 1 = full b.
 * Produces a fresh Uint8ClampedArray. Alpha channel is forced to 255.
 */
function blendFrames(a, b, alpha) {
  const len = a.length;
  const out = new Uint8ClampedArray(len);
  const inv = 1 - alpha;
  for (let i = 0; i < len; i += 4) {
    out[i]     = a[i]     * inv + b[i]     * alpha;
    out[i + 1] = a[i + 1] * inv + b[i + 1] * alpha;
    out[i + 2] = a[i + 2] * inv + b[i + 2] * alpha;
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Extract a rectangular crop from a source RGBA buffer and resize it by
 * nearest-neighbor sampling into a destination buffer of size (dstW × dstH).
 * Used by the ken-burns transition to "zoom into" a region of a frame.
 *
 * Nearest-neighbor (not bilinear) is a deliberate tradeoff: it's ~5× faster
 * and the output is downscaled by gifenc's 256-color quantizer anyway, so
 * bilinear smoothing would be eaten by the palette step. If aliasing becomes
 * visible on slow pans in the future, swap this for a bilinear sampler.
 */
function cropAndResize(src, srcW, srcH, cropX, cropY, cropW, cropH, dstW, dstH) {
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = cropW / dstW;
  const yRatio = cropH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.max(0, Math.floor(cropY + y * yRatio)));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.max(0, Math.floor(cropX + x * xRatio)));
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (y * dstW + x) * 4;
      out[dstIdx]     = src[srcIdx];
      out[dstIdx + 1] = src[srcIdx + 1];
      out[dstIdx + 2] = src[srcIdx + 2];
      out[dstIdx + 3] = 255;
    }
  }
  return out;
}

/**
 * CUT — frames appear one after another with no blending.
 * Each key frame is held for `holdFrames` GIF frames. Total output = N × hold.
 */
export function cut(keyFrames, { holdFrames }) {
  const out = [];
  for (const kf of keyFrames) {
    for (let i = 0; i < holdFrames; i++) out.push(kf);
  }
  return out;
}

/**
 * FADE — crossfade between consecutive key frames.
 * Sequence per key frame pair (A → B):
 *   [A × holdFrames] [blend(A,B,0.1..0.9) × transitionFrames] [B × holdFrames]
 * The last hold is only emitted once at the very end (not duplicated per pair).
 */
export function fade(keyFrames, { holdFrames, transitionFrames }) {
  if (keyFrames.length === 0) return [];
  if (keyFrames.length === 1) return cut(keyFrames, { holdFrames });

  const out = [];
  for (let k = 0; k < keyFrames.length; k++) {
    // Hold current
    for (let i = 0; i < holdFrames; i++) out.push(keyFrames[k]);
    // Transition to next (skip on last)
    if (k < keyFrames.length - 1 && transitionFrames > 0) {
      const a = keyFrames[k];
      const b = keyFrames[k + 1];
      for (let t = 1; t <= transitionFrames; t++) {
        const alpha = t / (transitionFrames + 1);
        out.push(blendFrames(a, b, alpha));
      }
    }
  }
  return out;
}

/**
 * KEN BURNS — each key frame slowly zooms in while the next one zooms out,
 * with a crossfade between them. Gives cinematic motion to still images.
 *
 * For each key frame we produce (holdFrames + transitionFrames) animated frames:
 *   - During hold: progressive zoom from 100% → 90% crop (subtle push-in).
 *   - During transition to next: crossfade the current (still zooming) with
 *     the next key frame (starting at 90% crop and zooming out to 100%).
 */
export function kenburns(keyFrames, { width, height, holdFrames, transitionFrames }) {
  if (keyFrames.length === 0) return [];
  const out = [];

  // Precompute zoomed-in variants for every key frame: we sample holdFrames + transitionFrames
  // steps between zoom=1.0 (full frame) and zoom=0.9 (10% crop in).
  const totalStepsPerKey = holdFrames + transitionFrames;

  function frameAtZoom(kf, zoom) {
    const cropW = Math.round(width * zoom);
    const cropH = Math.round(height * zoom);
    const cropX = Math.round((width - cropW) / 2);
    const cropY = Math.round((height - cropH) / 2);
    return cropAndResize(kf, width, height, cropX, cropY, cropW, cropH, width, height);
  }

  for (let k = 0; k < keyFrames.length; k++) {
    const kf = keyFrames[k];
    const isLast = k === keyFrames.length - 1;

    // Hold + push-in phase: zoom 1.0 → 0.95 across holdFrames frames.
    for (let i = 0; i < holdFrames; i++) {
      const progress = holdFrames === 1 ? 0 : i / (holdFrames - 1);
      const zoom = 1.0 - 0.05 * progress;
      out.push(frameAtZoom(kf, zoom));
    }

    // Transition to next key frame: current continues zooming (0.95 → 0.9),
    // next starts at 0.9 and zooms out toward 0.95, blended linearly.
    if (!isLast && transitionFrames > 0) {
      const next = keyFrames[k + 1];
      for (let t = 1; t <= transitionFrames; t++) {
        const alpha = t / (transitionFrames + 1);
        const progressT = t / transitionFrames;
        const zoomA = 0.95 - 0.05 * progressT;
        const zoomB = 0.9 + 0.05 * progressT;
        const fa = frameAtZoom(kf, zoomA);
        const fb = frameAtZoom(next, zoomB);
        out.push(blendFrames(fa, fb, alpha));
      }
    }
  }
  return out;
}

/**
 * Dispatch a transition by name.
 * @param {'cut'|'fade'|'kenburns'} name
 * @param {Uint8ClampedArray[]} keyFrames
 * @param {{ width, height, holdFrames, transitionFrames }} opts
 */
export function applyTransition(name, keyFrames, opts) {
  switch (name) {
    case 'cut':      return cut(keyFrames, opts);
    case 'fade':     return fade(keyFrames, opts);
    case 'kenburns': return kenburns(keyFrames, opts);
    default:
      throw new Error(`Unknown transition: ${name}`);
  }
}
