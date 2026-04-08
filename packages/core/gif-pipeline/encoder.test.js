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

function test(name, fn) {
  try {
    fn();
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

test('per-frame palette mode works', () => {
  const frames = [
    makeSolidFrame(10, 10, 255, 0, 0),
    makeSolidFrame(10, 10, 0, 255, 0),
  ];
  const gif = encodeFrames(frames, 10, 10, { frameDelay: 100, paletteMode: 'per-frame' });
  assert.ok(gif.length > 50);
});
