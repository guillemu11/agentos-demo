// packages/core/gif-pipeline/transitions.test.js
// Run with: node packages/core/gif-pipeline/transitions.test.js
//
// Pure unit tests for the transition functions. No canvas, no network.

import assert from 'node:assert/strict';
import { cut, fade, kenburns, applyTransition } from './transitions.js';

function makeSolidFrame(width, height, r, g, b) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i]     = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
  }
  return buf;
}

function pixelAt(frame, width, x, y) {
  const idx = (y * width + x) * 4;
  return [frame[idx], frame[idx + 1], frame[idx + 2]];
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

console.log('transitions.test.js');

test('cut: holds each frame for holdFrames', () => {
  const W = 4, H = 4;
  const red   = makeSolidFrame(W, H, 255, 0, 0);
  const green = makeSolidFrame(W, H, 0, 255, 0);
  const out = cut([red, green], { holdFrames: 3 });
  assert.equal(out.length, 6, 'expected 2 × 3 = 6 frames');
  // First 3 should be red, last 3 should be green
  assert.deepEqual(pixelAt(out[0], W, 0, 0), [255, 0, 0]);
  assert.deepEqual(pixelAt(out[2], W, 0, 0), [255, 0, 0]);
  assert.deepEqual(pixelAt(out[3], W, 0, 0), [0, 255, 0]);
  assert.deepEqual(pixelAt(out[5], W, 0, 0), [0, 255, 0]);
});

test('fade: single frame falls back to cut', () => {
  const W = 4, H = 4;
  const red = makeSolidFrame(W, H, 255, 0, 0);
  const out = fade([red], { holdFrames: 5, transitionFrames: 3 });
  assert.equal(out.length, 5);
  assert.deepEqual(pixelAt(out[0], W, 0, 0), [255, 0, 0]);
  assert.deepEqual(pixelAt(out[4], W, 0, 0), [255, 0, 0]);
});

test('fade: produces blended intermediate frames', () => {
  const W = 4, H = 4;
  const red   = makeSolidFrame(W, H, 255, 0, 0);
  const green = makeSolidFrame(W, H, 0, 255, 0);
  const out = fade([red, green], { holdFrames: 2, transitionFrames: 3 });
  // Expected layout: [red, red, blend1, blend2, blend3, green, green] = 7 frames
  assert.equal(out.length, 7);
  // Holds
  assert.deepEqual(pixelAt(out[0], W, 0, 0), [255, 0, 0]);
  assert.deepEqual(pixelAt(out[1], W, 0, 0), [255, 0, 0]);
  assert.deepEqual(pixelAt(out[5], W, 0, 0), [0, 255, 0]);
  // Middle blend should have both R and G channels non-zero
  const mid = pixelAt(out[3], W, 0, 0);
  assert.ok(mid[0] > 0 && mid[0] < 255, `red channel should be partial, got ${mid[0]}`);
  assert.ok(mid[1] > 0 && mid[1] < 255, `green channel should be partial, got ${mid[1]}`);
  // Blend progresses monotonically: frame 2 is more red than frame 4
  const early = pixelAt(out[2], W, 0, 0);
  const late  = pixelAt(out[4], W, 0, 0);
  assert.ok(early[0] > late[0], 'earlier blend should be more red');
  assert.ok(early[1] < late[1], 'later blend should be more green');
});

test('fade: empty keyFrames returns empty', () => {
  assert.deepEqual(fade([], { holdFrames: 3, transitionFrames: 2 }), []);
});

test('kenburns: produces holdFrames + transitionFrames per key, minus final transition', () => {
  const W = 8, H = 8;
  const a = makeSolidFrame(W, H, 255, 0, 0);
  const b = makeSolidFrame(W, H, 0, 0, 255);
  const out = kenburns([a, b], { width: W, height: H, holdFrames: 3, transitionFrames: 2 });
  // Key 1: 3 hold + 2 transition = 5 frames
  // Key 2: 3 hold + 0 (no next) = 3 frames
  // Total: 8
  assert.equal(out.length, 8);
  // Every frame should be a fresh buffer (not shared references to the key frames)
  assert.notEqual(out[0], a, 'ken burns should not reuse input buffers');
  // First hold frame should be mostly red (tiny crop, still all red)
  assert.deepEqual(pixelAt(out[0], W, W / 2, H / 2), [255, 0, 0]);
  // Last frame should be mostly blue
  assert.deepEqual(pixelAt(out[7], W, W / 2, H / 2), [0, 0, 255]);
});

test('applyTransition dispatches by name', () => {
  const W = 4, H = 4;
  const f = makeSolidFrame(W, H, 10, 10, 10);
  assert.equal(applyTransition('cut', [f, f], { holdFrames: 2 }).length, 4);
  assert.equal(
    applyTransition('fade', [f, f], { holdFrames: 2, transitionFrames: 2 }).length,
    2 + 2 + 2
  );
  assert.throws(() => applyTransition('warp', [f], { holdFrames: 1 }), /Unknown transition/);
});

test('cut: does not allocate new buffers (memory-friendly)', () => {
  const W = 4, H = 4;
  const red = makeSolidFrame(W, H, 255, 0, 0);
  const out = cut([red], { holdFrames: 10 });
  // All hold frames should be the SAME reference (cut reuses inputs)
  for (const f of out) assert.equal(f, red);
});
