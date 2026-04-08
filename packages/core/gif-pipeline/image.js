// packages/core/gif-pipeline/image.js
// Mode "image" — static image generation via Gemini Imagen (Nano Banana).
//
// Unlike the typographic pipeline, this mode does not use canvas, does not
// plan with Claude, and does not encode any frames. It takes a prompt, calls
// `generateImage()` from the Gemini provider, writes the PNG to disk, inserts
// a row in generated_gifs (mode='image'), and emits SSE events so the UI can
// show progress.
//
// Steps emitted:
//   planning → generating → persisting → done
//
// The plan.json column stores { aspectRatio, size } for future re-runs.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { generateImage, isGeminiReady } from '../ai-providers/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'apps', 'dashboard', 'public', 'generated-gifs');

// Size string → Imagen aspect ratio (same mapping used by /api/agents/generate-image)
const ASPECT_RATIO_MAP = {
  '1200x628': '16:9',
  '1080x1080': '1:1',
  '600x600': '1:1',
  '600x200': '3:1',
  '600x315': '16:9',
  '1024x1024': '1:1',
  '1920x1080': '16:9',
};

/**
 * Parse "WIDTHxHEIGHT" → { width, height }. Returns defaults on failure.
 */
function parseSize(sizeStr) {
  if (typeof sizeStr !== 'string') return { width: 1200, height: 628 };
  const match = sizeStr.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) return { width: 1200, height: 628 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Run the static-image pipeline.
 *
 * @param {string} prompt
 * @param {object} options - { size?: string, aspect_ratio?: string }
 * @param {(event: object) => void} emit
 * @param {{ userId: number|null, pool: import('pg').Pool }} ctx
 * @returns {Promise<{ gifId: number, filePath: string }>}
 */
export async function runImagePipeline(prompt, options, emit, ctx) {
  if (!isGeminiReady()) {
    throw new Error('Gemini is not initialized — set GEMINI_API_KEY in workspace settings');
  }

  // ─── 1. Planning (no Claude for now — just echo the prompt + sizing) ───
  emit({ step: 'planning', text: 'Preparing image request...' });

  const sizeStr = options.size || '1200x628';
  const { width, height } = parseSize(sizeStr);
  const aspectRatio = options.aspect_ratio || ASPECT_RATIO_MAP[sizeStr] || '16:9';

  const plan = {
    prompt,
    size: sizeStr,
    width,
    height,
    aspect_ratio: aspectRatio,
    model: 'imagen-4.0-generate-001',
  };

  emit({ step: 'plan_ready', plan });

  // ─── 2. Generating ─────────────────────────────────────────────────────
  emit({ step: 'generating', text: `Calling Imagen (${aspectRatio})...` });

  const urls = await generateImage(prompt, { aspectRatio, numberOfImages: 1 });
  if (!urls || urls.length === 0) {
    throw new Error('Imagen returned no images');
  }

  // generateImage returns data URIs like "data:image/png;base64,...."
  const dataUri = urls[0];
  const b64Match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!b64Match) {
    throw new Error('Unexpected image format from Imagen (not a base64 data URI)');
  }
  const imgExt = b64Match[1] === 'jpeg' ? 'jpg' : b64Match[1]; // png | jpg | webp
  const imgBuffer = Buffer.from(b64Match[2], 'base64');

  // ─── 3. Persisting ─────────────────────────────────────────────────────
  emit({ step: 'persisting' });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const uuid = crypto.randomUUID();
  const fileName = `img-${uuid}.${imgExt}`;
  // Thumbnail = same image. Static images do not need a separate thumbnail.
  const thumbName = fileName;
  const diskPath = path.join(OUTPUT_DIR, fileName);

  fs.writeFileSync(diskPath, imgBuffer);

  const publicPath = `/generated-gifs/${fileName}`;
  const publicThumbPath = `/generated-gifs/${thumbName}`;

  const { rows } = await ctx.pool.query(
    `INSERT INTO generated_gifs
       (mode, prompt, plan, file_path, thumbnail_path, width, height,
        duration_ms, frame_count, file_size_bytes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      'image',
      prompt,
      JSON.stringify(plan),
      publicPath,
      publicThumbPath,
      width,
      height,
      null,              // duration_ms — not applicable to static images
      1,                 // frame_count — a single still
      imgBuffer.length,
      ctx.userId || null,
    ]
  );
  const gifId = rows[0].id;

  // ─── 4. Done ──────────────────────────────────────────────────────────
  emit({
    step: 'done',
    gif_url: publicPath,
    thumbnail_url: publicThumbPath,
    meta: {
      gif_id: gifId,
      mode: 'image',
      width,
      height,
      duration_ms: null,
      frame_count: 1,
      file_size_bytes: imgBuffer.length,
    },
  });

  return { gifId, filePath: publicPath };
}
