// packages/core/gif-pipeline/encoder.js
// Thin wrapper around gifenc. Takes an array of RGBA Uint8ClampedArray frames
// (one per animation frame) and returns a GIF buffer.

// gifenc is a CJS package — use default import + destructure to get its
// exports in a Node ESM environment.
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Encode an array of RGBA frames to a GIF buffer.
 *
 * @param {Uint8ClampedArray[]} frames - RGBA pixel data, one entry per frame
 * @param {number} width
 * @param {number} height
 * @param {object} options
 * @param {number} options.frameDelay - Delay between frames in ms
 * @param {('global'|'per-frame')} [options.paletteMode='global']
 * @param {number} [options.maxColors=256]
 * @returns {Uint8Array} The encoded GIF bytes
 */
export function encodeFrames(frames, width, height, options) {
  const { frameDelay, paletteMode = 'global', maxColors = 256 } = options;
  if (!frames || frames.length === 0) {
    throw new Error('encodeFrames: frames array is empty');
  }

  const gif = GIFEncoder();

  if (paletteMode === 'global') {
    // Build a global palette from a buffer that samples ALL frames, not just
    // frame 0. Rationale: animations with entrance phases (bounce, slide-in,
    // fade-in) often have frame 0 as pure background — quantizing only that
    // frame produces a palette with none of the foreground colors, and every
    // subsequent frame collapses to the background color (black GIF bug).
    //
    // We concatenate every frame's RGBA bytes into one big buffer so quantize()
    // sees the full color distribution of the animation. Memory cost is modest
    // for typographic GIFs (600x315x4 ≈ 756KB per frame, ~45MB for 60 frames).
    const frameBytes = frames[0].length;
    const combined = new Uint8ClampedArray(frameBytes * frames.length);
    for (let i = 0; i < frames.length; i++) {
      combined.set(frames[i], i * frameBytes);
    }
    const palette = quantize(combined, maxColors);
    for (const frame of frames) {
      const indexed = applyPalette(frame, palette);
      gif.writeFrame(indexed, width, height, { palette, delay: frameDelay });
    }
  } else {
    // Per-frame palette — better quality for varied scenes, larger files.
    for (const frame of frames) {
      const palette = quantize(frame, maxColors);
      const indexed = applyPalette(frame, palette);
      gif.writeFrame(indexed, width, height, { palette, delay: frameDelay });
    }
  }

  gif.finish();
  return gif.bytes();
}
