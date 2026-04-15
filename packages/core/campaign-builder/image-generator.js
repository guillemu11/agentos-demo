// Generate images for every {prompt} in the content rows.
// Mutates rows in place: replaces each {prompt} with a stable fake ID
// (TEMP_<field>_<n>) and returns a map fakeId → data:image/png;base64,...

import { generateImage, isGeminiReady, initGemini } from '../ai-providers/gemini.js';

const IMAGE_FIELD_REGEX = /image|logo|hero|masthead|banner/i;

function ensureGemini() {
  if (isGeminiReady()) return;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  initGemini(key);
}

function pickAspectRatio(fieldName) {
  const n = fieldName.toLowerCase();
  if (n.includes('hero') || n.includes('masthead') || n.includes('banner')) return '16:9';
  if (n.includes('logo')) return '1:1';
  if (n.includes('story')) return '4:3';
  return '16:9';
}

export async function generateCampaignImages(rows, _brief, onProgress = () => {}) {
  ensureGemini();
  const imagesBase64 = {};
  // Numeric fake IDs so the renderer's `/^\d+$/` image-resolution gate passes.
  // Start at 900_000_001 to stay well clear of real MC asset IDs.
  let counter = 900_000_000;

  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (!IMAGE_FIELD_REGEX.test(field)) continue;
      if (!value || typeof value !== 'object' || typeof value.prompt !== 'string') continue;

      counter += 1;
      const fakeId = String(counter);
      const aspectRatio = pickAspectRatio(field);
      onProgress('image', { fakeId, field, prompt: value.prompt.slice(0, 80), aspectRatio });
      try {
        const urls = await generateImage(value.prompt, { aspectRatio });
        if (!urls[0]) throw new Error('Imagen returned no image');
        imagesBase64[fakeId] = urls[0];
        row[field] = fakeId;
      } catch (err) {
        onProgress('image-error', { fakeId, field, message: err.message });
        throw new Error(`Image generation failed for "${field}": ${err.message}`);
      }
    }
  }
  return imagesBase64;
}
