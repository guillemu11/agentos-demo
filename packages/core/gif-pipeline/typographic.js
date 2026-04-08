// packages/core/gif-pipeline/typographic.js
// Mode C — Typographic pipeline.
// Steps: planning (Claude picks a preset + fills params) → rendering (canvas
// draws each frame) → encoding (gifenc) → persisting (disk + DB row) → done.
//
// Notes:
// - This module imports '@napi-rs/canvas' and '@anthropic-ai/sdk'. Both must
//   be installed at the repo root (not just apps/dashboard) because Node ESM
//   resolves node_modules from the importing file's location upward, and this
//   file lives in packages/core/gif-pipeline/, which has no local node_modules.
// - The thumbnail is rendered from a frame at ~70% of the timeline (not frame 0)
//   because preset animations like bounce_headline start with the text offscreen,
//   and a blank first-frame thumbnail is useless for the gallery grid.

import { createCanvas } from '@napi-rs/canvas';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ensureFontsRegistered } from './fonts.js';
import { getPreset, getPresetCatalog, listPresets } from './presets/index.js';
import { encodeFrames } from './encoder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Directory where finished GIFs live. Must match the static-serve path in server.js.
// Since this module lives in packages/core/gif-pipeline, we compute the absolute disk
// path relative to the repo root → apps/dashboard/public/generated-gifs.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'apps', 'dashboard', 'public', 'generated-gifs');

const DEFAULT_FPS = 24;
const DEFAULT_DURATION_MS = 2500;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 315;

/**
 * Run the typographic pipeline.
 *
 * @param {string} prompt
 * @param {object} options - { width, height, duration_ms, fps, preset_override }
 * @param {(event: object) => void} emit
 * @param {{ userId: number|null, pool: import('pg').Pool }} ctx
 * @returns {Promise<{ gifId: number, filePath: string }>}
 */
export async function runTypographicPipeline(prompt, options, emit, ctx) {
  ensureFontsRegistered();

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const fps = options.fps || DEFAULT_FPS;

  // ─── 1. Planning ───────────────────────────────────────────────────────
  emit({ step: 'planning', text: 'Choosing preset and filling params...' });

  let plan;
  if (options.preset_override) {
    // Skip Claude if caller pre-specified a preset (used by tests and direct
    // invocation from Content Studio in later phases).
    const presetMod = getPreset(options.preset_override);
    if (!presetMod) throw new Error(`Unknown preset override: ${options.preset_override}`);
    plan = {
      preset: options.preset_override,
      params: { ...presetMod.metadata.default_params, text: prompt },
      rationale: 'preset_override supplied',
    };
  } else {
    plan = await planWithClaude(prompt);
  }

  emit({ step: 'plan_ready', preset: plan.preset, params: plan.params, rationale: plan.rationale });

  const presetMod = getPreset(plan.preset);
  if (!presetMod) {
    throw new Error(`Claude chose unknown preset: ${plan.preset}. Available: ${listPresets().join(', ')}`);
  }

  // Merge defaults with the plan's params
  const mergedParams = { ...presetMod.metadata.default_params, ...plan.params };
  const durationMs = mergedParams.duration_ms || DEFAULT_DURATION_MS;
  const totalFrames = Math.max(2, Math.round((durationMs / 1000) * fps));
  const frameDelay = Math.round(1000 / fps);

  // ─── 2. Rendering ──────────────────────────────────────────────────────
  emit({ step: 'rendering', progress: 0 });

  const canvas = createCanvas(width, height);
  const ctx2d = canvas.getContext('2d');
  const size = { width, height };
  const frames = [];
  const progressTick = Math.max(1, Math.floor(totalFrames / 4));

  for (let i = 0; i < totalFrames; i++) {
    presetMod.render(ctx2d, i, totalFrames, mergedParams, size);
    const imageData = ctx2d.getImageData(0, 0, width, height);
    // Copy the pixel buffer because getImageData returns a view that gets
    // overwritten on the next render call.
    frames.push(new Uint8ClampedArray(imageData.data));

    if (i > 0 && i % progressTick === 0) {
      emit({ step: 'rendering', progress: i / totalFrames });
    }
  }

  // ─── 3. Encoding ───────────────────────────────────────────────────────
  emit({ step: 'encoding' });
  const gifBytes = encodeFrames(frames, width, height, {
    frameDelay,
    paletteMode: 'global',
    maxColors: 256,
  });

  // ─── 4. Persisting ─────────────────────────────────────────────────────
  emit({ step: 'persisting' });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const uuid = crypto.randomUUID();
  const fileName = `gif-${uuid}.gif`;
  const thumbName = `gif-${uuid}-thumb.png`;
  const diskPath = path.join(OUTPUT_DIR, fileName);
  const thumbDiskPath = path.join(OUTPUT_DIR, thumbName);

  fs.writeFileSync(diskPath, Buffer.from(gifBytes));

  // Thumbnail: render a frame at 70% of the timeline (not frame 0).
  // Rationale: animations like bounce_headline have the subject offscreen at
  // frame 0 → blank thumbnail. Frame at 0.7 progress gives a representative image.
  const thumbCanvas = createCanvas(width, height);
  const thumbCtx = thumbCanvas.getContext('2d');
  const thumbFrameIndex = Math.floor(totalFrames * 0.7);
  presetMod.render(thumbCtx, thumbFrameIndex, totalFrames, mergedParams, size);
  const pngBuffer = thumbCanvas.toBuffer('image/png');
  fs.writeFileSync(thumbDiskPath, pngBuffer);

  const publicPath = `/generated-gifs/${fileName}`;
  const publicThumbPath = `/generated-gifs/${thumbName}`;

  const { rows } = await ctx.pool.query(
    `INSERT INTO generated_gifs
       (mode, prompt, plan, file_path, thumbnail_path, width, height,
        duration_ms, frame_count, file_size_bytes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      'typographic',
      prompt,
      JSON.stringify(plan),
      publicPath,
      publicThumbPath,
      width,
      height,
      durationMs,
      totalFrames,
      gifBytes.length,
      ctx.userId || null,
    ]
  );
  const gifId = rows[0].id;

  // ─── 5. Done ───────────────────────────────────────────────────────────
  emit({
    step: 'done',
    gif_url: publicPath,
    thumbnail_url: publicThumbPath,
    meta: {
      gif_id: gifId,
      mode: 'typographic',
      width,
      height,
      duration_ms: durationMs,
      frame_count: totalFrames,
      file_size_bytes: gifBytes.length,
    },
  });

  return { gifId, filePath: publicPath };
}

// ─── Claude planning ──────────────────────────────────────────────────────

async function planWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No Claude available — fall back to bounce_headline with the user prompt as text
    return {
      preset: 'bounce_headline',
      params: { text: prompt.slice(0, 40) },
      rationale: 'Fallback: no ANTHROPIC_API_KEY set, using bounce_headline',
    };
  }

  const catalog = getPresetCatalog();

  const systemPrompt =
    `You are a motion-graphics director picking a typographic animation preset for an email banner GIF.\n\n` +
    `Available presets:\n\n${catalog}\n\n` +
    `Given the user's prompt, choose ONE preset and fill its params. ` +
    `Return STRICT JSON only — no markdown, no prose. Shape:\n` +
    `{\n  "preset": "preset_name",\n  "params": { "text": "...", ... },\n  "rationale": "one sentence why"\n}\n\n` +
    `Rules:\n` +
    `- preset MUST be one of: ${listPresets().join(', ')}\n` +
    `- text should be short and punchy (max ~20 chars for headline, max ~15 for subtitle)\n` +
    `- omit optional params if defaults are fine\n` +
    `- JSON ONLY. No code fences.`;

  // Wrap the entire Anthropic call in try/catch so any API failure
  // (auth, rate limit, network, 5xx) falls back to bounce_headline
  // instead of bubbling up and killing the pipeline.
  let text;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
  } catch (apiErr) {
    const reason = apiErr?.status
      ? `Anthropic ${apiErr.status} ${apiErr.error?.error?.message || apiErr.message}`
      : apiErr.message;
    console.warn('[typographic] Anthropic API call failed, using fallback:', reason);
    return {
      preset: 'bounce_headline',
      params: { text: prompt.slice(0, 40) },
      rationale: `Fallback: ${reason}`,
    };
  }

  // Strip possible code fences just in case
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.preset || !parsed.params) {
      throw new Error('missing required fields');
    }
    if (!listPresets().includes(parsed.preset)) {
      console.warn(`[typographic] Claude chose unknown preset "${parsed.preset}", falling back`);
      return {
        preset: 'bounce_headline',
        params: { text: prompt.slice(0, 40) },
        rationale: `Claude chose unknown preset ${parsed.preset}, using fallback`,
      };
    }
    return parsed;
  } catch (err) {
    console.warn('[typographic] Failed to parse Claude JSON, using fallback:', err.message);
    console.warn('[typographic] Raw Claude response:', text);
    return {
      preset: 'bounce_headline',
      params: { text: prompt.slice(0, 40) },
      rationale: `Fallback: Claude JSON parse failed (${err.message})`,
    };
  }
}
