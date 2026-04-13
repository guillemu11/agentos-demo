/**
 * packages/core/email-builder/image-resolver.js
 *
 * Batch resolve Content Builder image asset IDs → CDN URLs.
 * Uses MC REST API: GET /asset/v1/content/assets/{id} → fileProperties.publishedURL
 */

/**
 * Resolve a single image asset ID to its CDN URL.
 * @param {object} mcClient - MC client with .rest() method (from mc-api/client.js)
 * @param {string|number} assetId
 * @returns {Promise<string|null>} CDN URL or null
 */
export async function resolveImageUrl(mcClient, assetId) {
  try {
    const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${assetId}`);
    return asset.fileProperties?.publishedURL || null;
  } catch {
    return null;
  }
}

/**
 * Batch-resolve image IDs with concurrency control.
 * @param {object} mcClient
 * @param {string[]} imageIds - Array of asset ID strings
 * @param {Record<string, string>} [existingMap={}] - Pre-resolved IDs to skip
 * @param {number} [concurrency=5]
 * @returns {Promise<Record<string, string>>} Map of id → CDN URL
 */
export async function resolveImageBatch(mcClient, imageIds, existingMap = {}, concurrency = 5) {
  const map = { ...existingMap };
  const toResolve = imageIds.filter(id => id && !map[String(id)]);

  for (let i = 0; i < toResolve.length; i += concurrency) {
    const batch = toResolve.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async id => ({ id, url: await resolveImageUrl(mcClient, id) }))
    );
    for (const { id, url } of results) {
      if (url) map[String(id)] = url;
    }
  }

  return map;
}

/**
 * Collect all image asset IDs referenced in content data.
 * Scans header, footer, stories for known image fields.
 *
 * @param {object} content - Content data bundle with headerContent, footerContent, stories etc.
 * @returns {string[]} Unique image IDs
 */
export function collectImageIds(content) {
  const ids = new Set();
  const add = (v) => { if (v && v !== '' && /^\d+$/.test(String(v))) ids.add(String(v)); };

  // Header image fields
  (content.headerContent || []).forEach(h => {
    add(h.header_logo);
    add(h.header_login_logo);
  });

  // Footer image fields
  (content.footerContent || []).forEach(f => {
    add(f.logo_image);
    add(f.co_logo);
  });

  // Story image fields (multiple possible image columns)
  (content.stories || []).forEach(s => {
    add(s.story_image);
    add(s.story_image_circle);
    add(s.story_image_single);
    add(s.story_image_icon);
  });

  return [...ids];
}
