// packages/core/gif-pipeline/slideshow.js
// Mode A — Slideshow pipeline.
//
// Steps:
//   planning       → Claude decomposes the prompt into N frame-prompts with
//                    shared style/seed and picks a transition.
//   plan_ready     → emit the structured plan.
//   frame_generating (×N) → call Gemini Imagen once per frame. Emits progress
//                    per frame so the UI can render a thumbnail strip as
//                    frames arrive. SERIAL (not parallel) for three reasons:
//                      1. Imagen rate limits are easy to trip in parallel.
//                      2. The user sees real incremental progress on the UI.
//                      3. If one frame fails, we retry only that one.
//   composing      → sharp resizes each PNG to width×height, decodes to raw
//                    RGBA, then transitions.js expands to full GIF frame list.
//   encoding       → gifenc with per-frame palette (better for varied scenes).
//   persisting     → write .gif + thumbnail, insert generated_gifs row.
//   done
//
// Fallback behavior (mirrors typographic.js):
// - No ANTHROPIC_API_KEY or API failure → rule-based plan: split the prompt
//   into N variants with "— angle/view/mood {i}" suffixes.
// - Claude returns invalid JSON → same rule-based fallback.
// - Individual frame failure → retry once, then abort with clear error.

import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { generateImage, isGeminiReady } from '../ai-providers/gemini.js';
import { encodeFrames } from './encoder.js';
import { applyTransition } from './transitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'apps', 'dashboard', 'public', 'generated-gifs');

// Defaults for MVP. Spec: 4 frames × 700ms hold, 600×315, fade transition.
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 315;
const DEFAULT_FRAME_COUNT = 4;
const DEFAULT_HOLD_MS = 700;
const DEFAULT_TRANSITION = 'fade';
const DEFAULT_FPS = 15;

// Fraction of the per-key-frame time spent transitioning (rest = hold).
// 0.35 means: given 700ms total per key → ~245ms of transition, ~455ms hold.
const TRANSITION_RATIO = 0.35;

const ALLOWED_TRANSITIONS = new Set(['cut', 'fade', 'kenburns']);

/**
 * Run the slideshow pipeline.
 *
 * @param {string} prompt
 * @param {object} options
 *   - width, height, frame_count, hold_ms, fps, transition ('cut'|'fade'|'kenburns')
 *   - plan_override: { frames: [{prompt}], transition, style_seed }
 * @param {(event: object) => void} emit
 * @param {{ userId: number|null, pool: import('pg').Pool }} ctx
 */
export async function runSlideshowPipeline(prompt, options, emit, ctx) {
  if (!isGeminiReady()) {
    throw new Error('Gemini is not initialized — set GEMINI_API_KEY in workspace settings');
  }

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const frameCount = clampInt(options.frame_count || DEFAULT_FRAME_COUNT, 2, 8);
  const holdMs = options.hold_ms || DEFAULT_HOLD_MS;
  const fps = options.fps || DEFAULT_FPS;
  const frameDelayMs = Math.round(1000 / fps);
  const aspectRatio = aspectRatioFor(width, height);

  // ─── 1. Planning ───────────────────────────────────────────────────────
  emit({ step: 'planning', text: 'Decomposing prompt into frames...' });

  let plan;
  if (options.plan_override) {
    plan = options.plan_override;
  } else {
    plan = await planWithClaude(prompt, frameCount);
  }

  // Normalize transition name (Claude may suggest something we don't support)
  if (!ALLOWED_TRANSITIONS.has(plan.transition)) {
    plan.transition = DEFAULT_TRANSITION;
  }

  emit({
    step: 'plan_ready',
    frames: plan.frames,
    transition: plan.transition,
    style_seed: plan.style_seed,
    rationale: plan.rationale,
  });

  // ─── 2. Frame generation (serial) ──────────────────────────────────────
  const keyFrameBuffers = [];
  for (let i = 0; i < plan.frames.length; i++) {
    const frameSpec = plan.frames[i];
    emit({
      step: 'frame_generating',
      index: i + 1,
      total: plan.frames.length,
      prompt: frameSpec.prompt,
    });

    const rgba = await generateFrameWithRetry(frameSpec.prompt, aspectRatio, width, height);
    keyFrameBuffers.push(rgba);

    emit({
      step: 'frame_generated',
      index: i + 1,
      total: plan.frames.length,
    });
  }

  // ─── 3. Composing (transitions) ────────────────────────────────────────
  emit({ step: 'composing', transition: plan.transition });

  // Split hold budget into hold frames + transition frames based on fps.
  // E.g. fps=15, holdMs=700 → 10 frames total per key; 0.35 × 10 ≈ 3 transition
  // frames, 7 hold frames. Minimum 1 hold, minimum 2 transition frames for fade/kb.
  const framesPerKey = Math.max(2, Math.round((holdMs / 1000) * fps));
  const transitionFrames =
    plan.transition === 'cut' ? 0 : Math.max(2, Math.round(framesPerKey * TRANSITION_RATIO));
  const holdFrames = Math.max(1, framesPerKey - transitionFrames);

  const gifFrames = applyTransition(plan.transition, keyFrameBuffers, {
    width,
    height,
    holdFrames,
    transitionFrames,
  });

  // ─── 4. Encoding ───────────────────────────────────────────────────────
  emit({ step: 'encoding', frame_count: gifFrames.length });

  // Per-frame palette: slideshow scenes have high color variance, so a global
  // palette would lose fidelity. ~20% larger files but acceptable for MVP.
  const gifBytes = encodeFrames(gifFrames, width, height, {
    frameDelay: frameDelayMs,
    paletteMode: 'per-frame',
    maxColors: 256,
  });

  // ─── 5. Persisting ─────────────────────────────────────────────────────
  emit({ step: 'persisting' });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const uuid = crypto.randomUUID();
  const fileName = `gif-${uuid}.gif`;
  const thumbName = `gif-${uuid}-thumb.png`;
  const diskPath = path.join(OUTPUT_DIR, fileName);
  const thumbDiskPath = path.join(OUTPUT_DIR, thumbName);

  fs.writeFileSync(diskPath, Buffer.from(gifBytes));

  // Thumbnail = the middle key frame (most likely to be visually meaningful).
  const thumbKeyIdx = Math.floor(keyFrameBuffers.length / 2);
  const thumbPng = await sharp(Buffer.from(keyFrameBuffers[thumbKeyIdx]), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(thumbDiskPath, thumbPng);

  const publicPath = `/generated-gifs/${fileName}`;
  const publicThumbPath = `/generated-gifs/${thumbName}`;

  const durationMs = Math.round((gifFrames.length / fps) * 1000);

  const { rows } = await ctx.pool.query(
    `INSERT INTO generated_gifs
       (mode, prompt, plan, file_path, thumbnail_path, width, height,
        duration_ms, frame_count, file_size_bytes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      'slideshow',
      prompt,
      JSON.stringify(plan),
      publicPath,
      publicThumbPath,
      width,
      height,
      durationMs,
      gifFrames.length,
      gifBytes.length,
      ctx.userId || null,
    ]
  );
  const gifId = rows[0].id;

  // ─── 6. Done ───────────────────────────────────────────────────────────
  emit({
    step: 'done',
    gif_url: publicPath,
    thumbnail_url: publicThumbPath,
    meta: {
      gif_id: gifId,
      mode: 'slideshow',
      width,
      height,
      duration_ms: durationMs,
      frame_count: gifFrames.length,
      file_size_bytes: gifBytes.length,
      transition: plan.transition,
    },
  });

  return { gifId, filePath: publicPath };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Pick the closest Imagen-supported aspect ratio for the target canvas size.
 * Imagen supports: 1:1, 3:4, 4:3, 9:16, 16:9. We never pass the raw WxH — the
 * returned aspect lets Imagen generate a proportional image that we then crop
 * to the exact canvas dimensions with sharp.
 */
function aspectRatioFor(width, height) {
  const ratio = width / height;
  const options = [
    { ar: '1:1',  r: 1.0  },
    { ar: '4:3',  r: 4/3  },
    { ar: '3:4',  r: 3/4  },
    { ar: '16:9', r: 16/9 },
    { ar: '9:16', r: 9/16 },
  ];
  let best = options[0];
  let bestDiff = Math.abs(ratio - best.r);
  for (const opt of options) {
    const diff = Math.abs(ratio - opt.r);
    if (diff < bestDiff) { best = opt; bestDiff = diff; }
  }
  return best.ar;
}

/**
 * Generate one frame with Imagen and return a raw RGBA Uint8ClampedArray
 * resized to (width × height) via sharp. Retries once on failure.
 */
async function generateFrameWithRetry(framePrompt, aspectRatio, width, height) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const urls = await generateImage(framePrompt, { aspectRatio, numberOfImages: 1 });
      if (!urls || urls.length === 0) throw new Error('Imagen returned no images');
      const dataUri = urls[0];
      const match = dataUri.match(/^data:image\/\w+;base64,(.+)$/);
      if (!match) throw new Error('Unexpected Imagen response (not a base64 data URI)');
      const pngBuffer = Buffer.from(match[1], 'base64');

      // Resize + crop to exact canvas size, then extract raw RGBA pixels.
      // `fit: 'cover'` crops edges rather than letterboxing — slideshow wants
      // edge-to-edge frames, no black bars.
      const { data, info } = await sharp(pngBuffer)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (info.width !== width || info.height !== height) {
        throw new Error(`sharp resize returned unexpected dims: ${info.width}x${info.height}`);
      }
      return new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
    } catch (err) {
      lastErr = err;
      console.warn(`[slideshow] frame generation attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw new Error(`Failed to generate slideshow frame after 2 attempts: ${lastErr.message}`);
}

/**
 * Ask Claude to break the prompt into N coherent frame prompts with shared
 * style. Falls back to a deterministic rule-based plan on any failure.
 */
async function planWithClaude(prompt, frameCount) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackPlan(prompt, frameCount, 'no ANTHROPIC_API_KEY');

  const systemPrompt =
    `You are an art director planning a ${frameCount}-frame slideshow GIF for an email banner.\n\n` +
    `Given the user's prompt, produce ${frameCount} frame prompts that:\n` +
    `- Share the same visual style, lighting, palette, and composition.\n` +
    `- Vary only the narrative element implied by the prompt (angle, moment, detail, state).\n` +
    `- Each prompt is standalone and detailed enough for Imagen to render without the others.\n\n` +
    `Return STRICT JSON only — no markdown, no prose. Shape:\n` +
    `{\n` +
    `  "frames": [\n` +
    `    { "index": 1, "prompt": "...", "focal_point": "..." },\n` +
    `    ... (${frameCount} total)\n` +
    `  ],\n` +
    `  "style_seed": "shared style description — lighting, palette, lens",\n` +
    `  "transition": "cut" | "fade" | "kenburns",\n` +
    `  "rationale": "one sentence explaining the sequence"\n` +
    `}\n\n` +
    `Transition guidance:\n` +
    `- cut: abrupt comparisons (before/after, versus).\n` +
    `- fade: narrative/mood sequences (morning → evening, steps of a recipe).\n` +
    `- kenburns: single-scene exploration from multiple angles.\n` +
    `JSON ONLY. No code fences.`;

  let text;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    text = response.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  } catch (apiErr) {
    const reason = apiErr?.status
      ? `Anthropic ${apiErr.status} ${apiErr.error?.error?.message || apiErr.message}`
      : apiErr.message;
    console.warn('[slideshow] Anthropic API call failed, using fallback:', reason);
    return fallbackPlan(prompt, frameCount, reason);
  }

  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) {
      throw new Error('frames array missing or empty');
    }
    // Clamp/normalize
    const frames = parsed.frames.slice(0, frameCount).map((f, i) => ({
      index: i + 1,
      prompt: String(f.prompt || '').trim(),
      focal_point: f.focal_point || '',
    }));
    // If Claude gave us fewer frames than requested, pad by repeating the last one
    while (frames.length < frameCount) {
      frames.push({ ...frames[frames.length - 1], index: frames.length + 1 });
    }
    return {
      frames,
      style_seed: parsed.style_seed || '',
      transition: parsed.transition || DEFAULT_TRANSITION,
      rationale: parsed.rationale || '',
    };
  } catch (err) {
    console.warn('[slideshow] Failed to parse Claude JSON, using fallback:', err.message);
    console.warn('[slideshow] Raw response:', text);
    return fallbackPlan(prompt, frameCount, `Claude JSON parse failed: ${err.message}`);
  }
}

/**
 * Rule-based plan for when Claude is unavailable or fails. Produces N
 * variations of the same prompt with different angle/mood suffixes so Imagen
 * still returns a coherent-ish sequence.
 */
function fallbackPlan(prompt, frameCount, reason) {
  const suffixes = [
    'wide establishing shot, cinematic',
    'medium close-up, shallow depth of field',
    'detail shot, macro composition',
    'alternate angle, dramatic lighting',
    'pulled-back view, environmental context',
    'top-down overhead view',
    'low angle hero shot',
    'side profile, rim lighting',
  ];
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      index: i + 1,
      prompt: `${prompt} — ${suffixes[i % suffixes.length]}`,
      focal_point: suffixes[i % suffixes.length],
    });
  }
  return {
    frames,
    style_seed: 'consistent style across frames',
    transition: DEFAULT_TRANSITION,
    rationale: `Fallback plan: ${reason}`,
  };
}
