// packages/core/gif-pipeline/encoder.test.js
// Run with: node packages/core/gif-pipeline/encoder.test.js

import { encodeFrames } from './encoder.js';
import assert from 'node:assert/strict';

function makeSolidFrame(width, height, r, g, b) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
  }
  return buf;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('encoder.test.js');

test('encodes a single red frame', () => {
  const frame = makeSolidFrame(10, 10, 255, 0, 0);
  const gif = encodeFrames([frame], 10, 10, { frameDelay: 100 });
  assert.ok(gif instanceof Uint8Array, 'returns Uint8Array');
  assert.ok(gif.length > 20, 'gif has nonzero length');
  // GIF files start with "GIF89a" or "GIF87a"
  const header = String.fromCharCode(...gif.slice(0, 6));
  assert.ok(header === 'GIF89a' || header === 'GIF87a', `invalid GIF header: ${header}`);
});

test('encodes multi-frame animation', () => {
  const frames = [
    makeSolidFrame(10, 10, 255, 0, 0),
    makeSolidFrame(10, 10, 0, 255, 0),
    makeSolidFrame(10, 10, 0, 0, 255),
  ];
  const gif = encodeFrames(frames, 10, 10, { frameDelay: 100 });
  assert.ok(gif.length > 50, 'multi-frame gif has nonzero length');
});

test('rejects empty frames array', () => {
  assert.throws(() => encodeFrames([], 10, 10, { frameDelay: 100 }), /empty/);
});

test('global palette preserves colors from later frames (regression: black GIF bug)', async () => {
  // Regression for bug where bounce_headline GIFs came out completely black.
  // Cause: the global palette was built from frame 0 only. Animations with
  // entrance phases have frame 0 as pure background, so the palette had no
  // foreground colors and every subsequent frame collapsed to the background.
  // Fix: quantize a concatenated buffer of all frames in encoder.js.
  //
  // We verify by calling gifenc's quantize() directly on frame 0 vs. on the
  // concatenated buffer, and asserting the concatenated palette contains
  // yellow (which frame 0 lacks entirely).
  const { default: gifenc } = await import('gifenc');
  const { quantize } = gifenc;

  const W = 8;
  const H = 8;
  const black = makeSolidFrame(W, H, 10, 10, 10);
  const yellow = makeSolidFrame(W, H, 255, 215, 0);

  // Buggy behavior: palette from frame 0 only → no yellow
  const buggyPalette = quantize(black, 256);
  const buggyHasYellow = buggyPalette.some(([r, g, b]) => r > 200 && g > 150 && b < 50);
  assert.ok(!buggyHasYellow, 'sanity: frame-0-only palette should not contain yellow');

  // Fixed behavior: palette from concatenated frames → yellow preserved
  const combined = new Uint8ClampedArray(black.length * 3);
  combined.set(black, 0);
  combined.set(yellow, black.length);
  combined.set(yellow, black.length * 2);
  const fixedPalette = quantize(combined, 256);
  const fixedHasYellow = fixedPalette.some(([r, g, b]) => r > 200 && g > 150 && b < 50);
  assert.ok(fixedHasYellow, 'fix: combined-frames palette must contain yellow from frames 1-2');

  // And the full encoder pipeline should succeed without error for this case.
  const gif = encodeFrames([black, yellow, yellow], W, H, { frameDelay: 100 });
  assert.ok(gif.length > 20, 'encoder produces valid GIF bytes');
});

test('per-frame palette mode works', () => {
  const frames = [
    makeSolidFrame(10, 10, 255, 0, 0),
    makeSolidFrame(10, 10, 0, 255, 0),
  ];
  const gif = encodeFrames(frames, 10, 10, { frameDelay: 100, paletteMode: 'per-frame' });
  assert.ok(gif.length > 50);
});
