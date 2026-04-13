/**
 * packages/core/email-builder/index.js
 *
 * Email Builder Engine — Public API
 *
 * Pipeline:
 *   0. resolveEmailTemplate(mcClient, assetId) → templateHtml (auto-extracts from slots)
 *   1. analyzeTemplate(ampscriptHtml) → manifest
 *   2. fetchCampaignData(manifest, mcClient, options) → data bundle
 *   3. renderAllVariants({ manifest, data, subscriber, templateShell }) → { filename: html }
 *
 * Also exports buildCampaignEmails() — one-shot orchestrator that accepts
 * either a templateHtml string or an assetId to resolve automatically.
 */

export { analyzeTemplate } from './analyzer.js';
export { fetchCampaignData, resolveEmailTemplate } from './fetcher.js';
export { renderAllVariants, renderVariant, buildVariableMap } from './renderer.js';
export { resolveImageBatch, collectImageIds } from './image-resolver.js';
export {
  stripAmpscriptBlocks,
  replaceAmpscriptVars,
  cleanTemplateShell,
  splitBodyCopy,
  parseContentBlockRefs,
  parseDELookups,
  parseVariableDeclarations,
} from './ampscript.js';

import { analyzeTemplate } from './analyzer.js';
import { fetchCampaignData, resolveEmailTemplate } from './fetcher.js';
import { renderAllVariants } from './renderer.js';

/**
 * Build all email variants for a campaign — runs the full pipeline.
 *
 * Accepts either:
 *   - templateHtml: pre-composed AMPscript HTML
 *   - assetId: MC Content Builder asset ID (auto-resolves slot blocks)
 *
 * @param {object} params
 * @param {string} [params.templateHtml] - Full AMPscript HTML template (if known)
 * @param {number|string} [params.assetId] - MC asset ID to resolve (alternative to templateHtml)
 * @param {object} params.mcClient - MC client from createMCClient()
 * @param {string} params.templateShell - Template wrapper HTML with {{CONTENT}} placeholder
 * @param {object} [params.subscriber] - Preview subscriber data
 * @param {object} [params.options]
 * @param {string} [params.options.language='en']
 * @param {string} [params.options.market='uk/english']
 * @param {Function} [params.options.onProgress] - (phase, detail) => void
 * @returns {Promise<{manifest: object, data: object, variants: Record<string, string>, emailName?: string}>}
 */
export async function buildCampaignEmails({
  templateHtml,
  assetId,
  mcClient,
  templateShell,
  subscriber = { first_name: 'Valued Member', TierName: 'Blue', miles_balance: '0' },
  options = {},
}) {
  const onProgress = options.onProgress || (() => {});
  let emailName;

  // Phase 0: Resolve template if assetId provided
  if (!templateHtml && assetId) {
    onProgress('resolve', `Resolving email template from asset ${assetId}...`);
    const resolved = await resolveEmailTemplate(mcClient, assetId, {
      onProgress: (step, detail) => onProgress('resolve', detail),
    });
    templateHtml = resolved.templateHtml;
    emailName = resolved.emailName;
    onProgress('resolve', `Resolved: ${emailName} (${(templateHtml.length / 1024).toFixed(1)}KB)`);
  }

  if (!templateHtml) {
    throw new Error('Either templateHtml or assetId must be provided');
  }

  // Phase 1: Analyze
  onProgress('analyze', 'Analyzing AMPscript template...');
  const manifest = analyzeTemplate(templateHtml);
  onProgress('analyze', `Found ${manifest.contentBlockIds.length} blocks, ${manifest.dataExtensions.length} DEs, ${manifest.variants.segments.length} segments`);

  // Phase 2: Fetch
  onProgress('fetch', 'Fetching data from Marketing Cloud...');
  const data = await fetchCampaignData(manifest, mcClient, {
    language: options.language,
    onProgress: (step, detail) => onProgress('fetch', detail),
  });
  onProgress('fetch', 'All MC data fetched');

  // Phase 3: Render
  onProgress('render', 'Rendering email variants...');
  const variants = renderAllVariants({
    manifest,
    data,
    subscriber,
    templateShell,
    options: { market: options.market },
  });
  onProgress('render', `Generated ${Object.keys(variants).length} email variants`);

  return { manifest, data, variants, emailName };
}
