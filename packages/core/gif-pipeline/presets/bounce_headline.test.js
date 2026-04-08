// packages/core/gif-pipeline/presets/bounce_headline.test.js
// Run with: node packages/core/gif-pipeline/presets/bounce_headline.test.js

import { createCanvas } from '@napi-rs/canvas';
import { ensureFontsRegistered } from '../fonts.js';
import * as preset from './bounce_headline.js';
import { encodeFrames } from '../encoder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureFontsRegistered();

console.log('bounce_headline.test.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

test('metadata is well-formed', () => {
  assert.equal(preset.metadata.name, 'bounce_headline');
  assert.ok(preset.metadata.required_params.includes('text'));
  assert.ok(preset.metadata.default_params.bg_color);
});

test('render produces a non-blank frame at middle of animation', () => {
  const size = preset.metadata.default_size;
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  const params = {
    ...preset.metadata.default_params,
    text: '50% OFF',
    subtitle: 'TEST',
  };
  preset.render(ctx, 30, 60, params, size);
  const imageData = ctx.getImageData(0, 0, size.width, size.height);
  // Check that at least some pixels are the text color (not all background)
  let textPixels = 0;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Text color is #FFD700 → R=255, G=215, B=0
    if (data[i] > 200 && data[i + 1] > 180 && data[i + 2] < 50) {
      textPixels++;
    }
  }
  assert.ok(textPixels > 100, `expected text pixels, got ${textPixels}`);
});

test('end-to-end: render all frames + encode to GIF file', () => {
  const size = preset.metadata.default_size;
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  const params = {
    ...preset.metadata.default_params,
    text: '50% OFF',
    subtitle: 'ENDS TONIGHT',
  };
  const fps = 24;
  const durationMs = 2500;
  const totalFrames = Math.round((durationMs / 1000) * fps);
  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    preset.render(ctx, i, totalFrames, params, size);
    const rgba = new Uint8ClampedArray(
      ctx.getImageData(0, 0, size.width, size.height).data
    );
    frames.push(rgba);
  }
  const gif = encodeFrames(frames, size.width, size.height, {
    frameDelay: Math.round(1000 / fps),
    paletteMode: 'global',
  });
  assert.ok(gif.length > 1000, `gif too small: ${gif.length} bytes`);

  // Write to disk for manual inspection
  const outPath = path.join(__dirname, '_smoke_output.gif');
  fs.writeFileSync(outPath, Buffer.from(gif));
  console.log(`    wrote ${outPath} (${gif.length} bytes)`);
});
