// packages/core/gif-pipeline/slideshow.test.js
// Integration test for the slideshow pipeline that bypasses the Imagen call.
// Strategy: we exercise everything from composing onward (transitions → encode
// → persist) using fabricated raw RGBA frame buffers. This validates the parts
// of the pipeline that live in *this* repo — the Imagen integration is tested
// elsewhere and would be flakey/expensive to hit here.
//
// Run with: node packages/core/gif-pipeline/slideshow.test.js

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { encodeFrames } from './encoder.js';
import { applyTransition } from './transitions.js';

function makeSolidFrame(W, H, r, g, b) {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
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
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    process.exitCode = 1;
  }
}

console.log('slideshow.test.js');

const W = 200;
const H = 100;
const FPS = 15;
const frameDelayMs = Math.round(1000 / FPS);

// Four "key frames" simulating the output of Imagen + sharp resize.
const keyFrames = [
  makeSolidFrame(W, H, 220,  40,  40),  // red
  makeSolidFrame(W, H,  40, 180,  40),  // green
  makeSolidFrame(W, H,  40,  40, 200),  // blue
  makeSolidFrame(W, H, 230, 200,  50),  // yellow
];

await test('fade transition + per-frame palette encode produces a valid GIF', () => {
  const gifFrames = applyTransition('fade', keyFrames, {
    width: W,
    height: H,
    holdFrames: 6,
    transitionFrames: 3,
  });
  // 4 keys × 6 hold + 3 transitions × 3 frames = 24 + 9 = 33
  assert.equal(gifFrames.length, 33);

  const bytes = encodeFrames(gifFrames, W, H, {
    frameDelay: frameDelayMs,
    paletteMode: 'per-frame',
    maxColors: 256,
  });
  assert.ok(bytes.length > 100, 'gif should have nonzero size');
  const header = String.fromCharCode(...bytes.slice(0, 6));
  assert.ok(header === 'GIF89a' || header === 'GIF87a', `bad header: ${header}`);
});

await test('kenburns transition + encode produces a valid GIF', () => {
  const gifFrames = applyTransition('kenburns', keyFrames, {
    width: W,
    height: H,
    holdFrames: 5,
    transitionFrames: 3,
  });
  // 4 × 5 + 3 × 3 = 29
  assert.equal(gifFrames.length, 29);
  const bytes = encodeFrames(gifFrames, W, H, {
    frameDelay: frameDelayMs,
    paletteMode: 'per-frame',
    maxColors: 256,
  });
  assert.ok(bytes.length > 100);
});

await test('cut transition writes a real file to disk that starts with GIF89a', () => {
  const gifFrames = applyTransition('cut', keyFrames, { holdFrames: 4 });
  assert.equal(gifFrames.length, 16);

  const bytes = encodeFrames(gifFrames, W, H, {
    frameDelay: frameDelayMs,
    paletteMode: 'per-frame',
    maxColors: 256,
  });

  const tmpFile = path.join(os.tmpdir(), `slideshow-smoke-${Date.now()}.gif`);
  fs.writeFileSync(tmpFile, Buffer.from(bytes));
  try {
    const onDisk = fs.readFileSync(tmpFile);
    assert.equal(onDisk.length, bytes.length);
    const header = onDisk.slice(0, 6).toString('ascii');
    assert.ok(header === 'GIF89a' || header === 'GIF87a');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

await test('slideshow module exports runSlideshowPipeline', async () => {
  const mod = await import('./slideshow.js');
  assert.equal(typeof mod.runSlideshowPipeline, 'function');
});
