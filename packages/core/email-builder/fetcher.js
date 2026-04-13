/**
 * packages/core/email-builder/fetcher.js
 *
 * Phase 2: Fetch all data from Marketing Cloud based on the campaign manifest.
 *
 * Uses mc-api client for:
 * - Content Builder blocks (HTML assets)
 * - Data Extension rows (content per language/segment)
 * - Image CDN URLs (via image-resolver)
 *
 * Returns a self-contained data bundle for the renderer.
 */

import { collectImageIds, resolveImageBatch } from './image-resolver.js';
import { parseContentBlockRefs } from './ampscript.js';

/**
 * Resolve a templatebasedemail asset into its composed AMPscript template.
 *
 * Emirates emails are templatebasedemail assets where the actual content lives
 * inside the slot: views.html.slots.{slotKey}.blocks.{blockKey}.content
 *
 * Each slot block can be:
 *   - A ContentBlockbyID reference → fetch the referenced asset
 *   - Inline AMPscript/HTML content → use directly
 *
 * @param {object} mcClient - MC client with .rest()
 * @param {number|string} assetId - Content Builder asset ID
 * @param {object} [options]
 * @param {Function} [options.onProgress] - (step, detail) => void
 * @returns {Promise<{templateHtml: string, emailName: string, assetType: string}>}
 */
export async function resolveEmailTemplate(mcClient, assetId, options = {}) {
  const onProgress = options.onProgress || (() => {});

  onProgress('resolve', `Fetching email asset ${assetId}...`);
  const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${assetId}`);
  const emailName = asset.name || `email_${assetId}`;
  const assetType = asset.assetType?.name || 'unknown';

  onProgress('resolve', `  ${emailName} (${assetType})`);

  // Extract slot blocks from views.html.slots
  const slots = asset.views?.html?.slots || {};
  const slotKeys = Object.keys(slots);

  if (slotKeys.length === 0) {
    // No slots — might be an htmlemail with inline content, or the content is in views.html.content
    const html = asset.views?.html?.content || asset.content || '';
    if (html.includes('ContentBlockbyID') || html.includes('LookupRows')) {
      onProgress('resolve', '  Direct AMPscript template (no slots)');
      return { templateHtml: html, emailName, assetType };
    }
    throw new Error(`Email ${assetId} has no slot content and no AMPscript in views.html`);
  }

  // Process each slot
  const templateParts = [];

  for (const slotKey of slotKeys) {
    const slot = slots[slotKey];
    const slotBlocks = slot.blocks || {};
    const blockKeys = Object.keys(slotBlocks);

    onProgress('resolve', `  Slot "${slotKey}": ${blockKeys.length} block(s)`);

    for (const blockKey of blockKeys) {
      const block = slotBlocks[blockKey];
      const content = block.content || '';
      const blockType = block.assetType?.name || 'unknown';

      // Check if this is a ContentBlockbyID reference or inline content
      const refMatch = content.match(/^%%=ContentBlockbyID\(["'](\d+)["']\)=%%$/);

      if (refMatch) {
        // Reference to another asset — fetch it
        const refId = refMatch[1];
        onProgress('resolve', `    → Reference block ${refId} (${blockType})`);

        try {
          const refAsset = await mcClient.rest('GET', `/asset/v1/content/assets/${refId}`);
          const refHtml = refAsset.views?.html?.content || refAsset.content || '';
          onProgress('resolve', `    → ${refAsset.name} (${(refHtml.length / 1024).toFixed(1)}KB)`);
          templateParts.push(refHtml);
        } catch (err) {
          onProgress('resolve-error', `    → Block ${refId}: FAILED (${err.message})`);
        }
      } else if (content.length > 0) {
        // Inline content — use directly
        onProgress('resolve', `    → Inline ${blockType} (${(content.length / 1024).toFixed(1)}KB)`);
        templateParts.push(content);
      }
    }
  }

  if (templateParts.length === 0) {
    throw new Error(`Email ${assetId}: slot blocks found but no content could be extracted`);
  }

  const templateHtml = templateParts.join('\n');
  onProgress('resolve', `  Composed template: ${(templateHtml.length / 1024).toFixed(1)}KB from ${templateParts.length} block(s)`);

  return { templateHtml, emailName, assetType };
}

/**
 * Fetch all campaign data from Marketing Cloud.
 *
 * @param {object} manifest - From analyzeTemplate()
 * @param {object} mcClient - MC client from createMCClient() with .rest() and .soap()
 * @param {object} [options]
 * @param {string} [options.language='en'] - Language code for content filtering
 * @param {string} [options.market='uk/english'] - Market code for URL replacement
 * @param {Function} [options.onProgress] - Progress callback: (step, detail) => void
 * @returns {Promise<object>} Campaign data bundle { blocks, deData, imageMap }
 */
export async function fetchCampaignData(manifest, mcClient, options = {}) {
  const lang = options.language || 'en';
  const onProgress = options.onProgress || (() => {});

  // 1. Fetch content block HTML from Content Builder
  //    Emirates uses a 2-level nesting pattern:
  //      Level 1 "logic" block: IF @language == "ENGLISH" THEN ContentBlockbyID("XXXXX")
  //      Level 2 "real" block: actual HTML with %%=v(@variable)=%% placeholders
  //    We resolve recursively until we reach blocks with real HTML (no more ContentBlockbyID).
  onProgress('blocks', `Fetching ${manifest.contentBlockIds.length} content blocks...`);
  const blocks = {};
  for (const id of manifest.contentBlockIds) {
    try {
      const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${id}`);
      let html = asset.views?.html?.content || asset.content || '';
      const name = asset.name || `block_${id}`;
      onProgress('block', `  Block ${id}: ${name}`);

      // Check if this is a language-routing "logic" block
      // Some blocks (like header) have dual branching: language + headerType
      const dualResolved = await resolveDualBranch(mcClient, html, lang, onProgress);
      if (dualResolved) {
        // Store each header variant as a separate block entry
        for (const [variantKey, variantHtml] of Object.entries(dualResolved)) {
          blocks[`${id}_${variantKey}`] = { name: `${name} (${variantKey})`, html: variantHtml };
          onProgress('block', `    → Variant ${variantKey}: ${(variantHtml.length / 1024).toFixed(1)}KB`);
        }
        // Keep the original ID pointing to the default (skw) variant
        html = dualResolved.skw || dualResolved[Object.keys(dualResolved)[0]] || html;
      } else {
        const resolvedHtml = await resolveLanguageBranch(mcClient, html, lang, onProgress);
        if (resolvedHtml !== null) {
          html = resolvedHtml;
        }
      }

      blocks[id] = { name, html };
    } catch (err) {
      onProgress('block-error', `  Block ${id}: FAILED (${err.message})`);
      blocks[id] = { name: `block_${id}`, html: '' };
    }
  }

  // 2. Discover DE external keys via SOAP, then query content via REST
  onProgress('des', `Resolving ${manifest.dataExtensions.length} data extensions...`);
  const deData = {};
  for (const de of manifest.dataExtensions) {
    const externalKey = await discoverDEKey(mcClient, de.name);
    if (!externalKey) {
      onProgress('de-error', `  DE "${de.name}": key not found`);
      deData[de.name] = [];
      continue;
    }
    onProgress('de', `  DE "${de.name}" → key: ${externalKey}`);

    // Fetch all rows. Stories DEs can be very large (2000+ rows), so
    // increase limit for DEs with 'stories' or 'story' in the name.
    const isLargeDE = de.name.toLowerCase().includes('stories') || de.name.toLowerCase().includes('story');
    const rows = await queryDE(mcClient, externalKey, null, isLargeDE ? 2500 : 500);

    deData[de.name] = rows;
    onProgress('de', `  DE "${de.name}": ${rows.length} rows`);
  }

  // 2b. If manifest has a VAWP DE, fetch sample subscriber data
  if (manifest.vawp?.deName) {
    onProgress('vawp', `Fetching VAWP DE: ${manifest.vawp.deName}...`);
    const vawpKey = await discoverDEKey(mcClient, manifest.vawp.deName);
    if (vawpKey) {
      // Get a sample of subscribers to understand available variants
      const vawpRows = await queryDE(mcClient, vawpKey, null, 50);
      deData[manifest.vawp.deName] = vawpRows;
      onProgress('vawp', `  VAWP "${manifest.vawp.deName}": ${vawpRows.length} sample rows`);

      if (vawpRows.length > 0) {
        const fields = Object.keys(vawpRows[0]);
        onProgress('vawp', `  Fields: ${fields.join(', ')}`);

        // Show unique Culture_codes and Country_codes for variant discovery
        const cultures = [...new Set(vawpRows.map(r => r.Culture_code || r.culture_code).filter(Boolean))];
        const countries = [...new Set(vawpRows.map(r => r.Country_code || r.country_code).filter(Boolean))];
        if (cultures.length > 0) onProgress('vawp', `  Culture codes: ${cultures.join(', ')}`);
        if (countries.length > 0) onProgress('vawp', `  Country codes: ${countries.join(', ')}`);
      }
    } else {
      onProgress('vawp-error', `  VAWP DE "${manifest.vawp.deName}": key not found`);
    }

    // Also fetch the language reference DE if detected
    if (manifest.vawp.languageRefDE) {
      const langRefKey = await discoverDEKey(mcClient, manifest.vawp.languageRefDE);
      if (langRefKey) {
        const langRefRows = await queryDE(mcClient, langRefKey, null, 100);
        deData[manifest.vawp.languageRefDE] = langRefRows;
        onProgress('vawp', `  Language ref DE: ${langRefRows.length} rows`);
      }
    }
  }

  // 3. Resolve image asset IDs → CDN URLs
  const contentForImages = buildImageContent(deData);
  const imageIds = collectImageIds(contentForImages);
  onProgress('images', `Resolving ${imageIds.length} image assets...`);
  const imageMap = await resolveImageBatch(mcClient, imageIds);
  onProgress('images', `  Resolved ${Object.keys(imageMap).length}/${imageIds.length} images`);

  return { blocks, deData, imageMap };
}

/**
 * Resolve blocks that branch on BOTH language AND header type (skw/ebase).
 * Emirates header blocks use: IF (@language == "ENGLISH" AND @headerver == "ebase") THEN ContentBlockbyID(...)
 *
 * Returns an object with { skw: html, ebase: html } or null if not a dual-branch block.
 */
async function resolveDualBranch(mcClient, html, lang, onProgress) {
  // Detect dual branching: @language ... AND @headerver
  if (!/@language\s*==\s*["'][^"']+["']\s*\)\s*AND\s*@headerver/i.test(html) &&
      !/@language\s*==\s*["'][^"']+["']\s*AND\s*@headerver/i.test(html)) {
    return null;
  }

  const langMap = {
    en: 'ENGLISH', english: 'ENGLISH', ar: 'ARABIC', fr: 'FRENCH',
    de: 'GERMAN', es: 'SPANISH', pt: 'PORTUGUESE', it: 'ITALIAN',
  };
  const targetLang = langMap[lang.toLowerCase()] || lang.toUpperCase();

  const variants = {};
  for (const headerType of ['ebase', 'skw']) {
    // Pattern: @language == "ENGLISH" ... AND @headerver == "ebase" ... ContentBlockbyID("XXXXX")
    const regex = new RegExp(
      `@language\\s*==\\s*["']${targetLang}["'][^\\]]*AND\\s*@headerver\\s*==\\s*["']${headerType}["']\\s*\\)\\s*THEN\\s*\\]%%[\\s\\S]*?ContentBlockbyID\\(["'](\\d+)["']\\)`,
      'i'
    );
    // Also try: EMPTY(@language) OR @language == "ENGLISH" pattern
    const regexAlt = new RegExp(
      `(?:EMPTY\\(@language\\)\\s*OR\\s*)?@language\\s*==\\s*["']${targetLang}(?:\\s*US)?["'][^\\]]*AND\\s*@headerver\\s*==\\s*["']${headerType}["']\\s*\\)\\s*THEN\\s*\\]%%[\\s\\S]*?ContentBlockbyID\\(["'](\\d+)["']\\)`,
      'i'
    );

    const match = html.match(regex) || html.match(regexAlt);
    if (match) {
      const subBlockId = match[1];
      onProgress('block', `    → Header ${headerType} (${targetLang}): sub-block ${subBlockId}`);
      try {
        const subAsset = await mcClient.rest('GET', `/asset/v1/content/assets/${subBlockId}`);
        variants[headerType] = subAsset.views?.html?.content || subAsset.content || '';
        onProgress('block', `    → ${subBlockId}: ${subAsset.name} (${(variants[headerType].length / 1024).toFixed(1)}KB)`);
      } catch (err) {
        onProgress('block-error', `    → Sub-block ${subBlockId}: FAILED (${err.message})`);
      }
    }
  }

  return Object.keys(variants).length > 0 ? variants : null;
}

/**
 * Resolve a language-routing logic block to the real HTML block for the target language.
 *
 * Emirates "logic" blocks follow this pattern:
 *   IF @language == "ARABIC" THEN ContentBlockbyID("39827")
 *   ELSEIF @language == "ENGLISH" THEN ContentBlockbyID("34298")
 *   ELSE ContentBlockbyID("34298")
 *   ENDIF
 *
 * This function detects the pattern, extracts the block ID for the target language,
 * fetches that sub-block, and recurses if needed (some blocks have 3 levels).
 *
 * @param {object} mcClient
 * @param {string} html - Block HTML that may contain language routing
 * @param {string} lang - Target language ('en' maps to 'ENGLISH')
 * @param {Function} onProgress
 * @param {number} [depth=0] - Recursion guard
 * @returns {Promise<string|null>} Resolved HTML, or null if not a logic block
 */
async function resolveLanguageBranch(mcClient, html, lang, onProgress, depth = 0) {
  if (depth > 3) return null; // safety limit

  // Check if this block contains language-based IF/THEN branching
  const hasLanguageBranching = /IF\s+@language\s*==\s*["']/i.test(html);
  if (!hasLanguageBranching) return null;

  // Map short lang codes to the full names used in Emirates AMPscript
  const langMap = {
    en: 'ENGLISH', english: 'ENGLISH',
    ar: 'ARABIC', arabic: 'ARABIC',
    fr: 'FRENCH', french: 'FRENCH',
    de: 'GERMAN', german: 'GERMAN',
    es: 'SPANISH', spanish: 'SPANISH',
    pt: 'PORTUGUESE', portuguese: 'PORTUGUESE',
    it: 'ITALIAN', italian: 'ITALIAN',
    ru: 'RUSSIAN', russian: 'RUSSIAN',
    zh: 'CHINESE', chinese: 'CHINESE',
    ja: 'JAPANESE', japanese: 'JAPANESE',
    ko: 'KOREAN', korean: 'KOREAN',
  };
  const targetLang = langMap[lang.toLowerCase()] || lang.toUpperCase();

  // Try to find the block ID for the target language
  // Pattern: @language == "ENGLISH" THEN ]%% ... ContentBlockbyID("XXXXX")
  const langRegex = new RegExp(
    `@language\\s*==\\s*["']${targetLang}["']\\s*THEN\\s*\\]%%[\\s\\S]*?ContentBlockbyID\\(["'](\\d+)["']\\)`,
    'i'
  );
  let match = html.match(langRegex);

  // If not found, try LATIN (some Emirates blocks use LATIN instead of ENGLISH)
  if (!match && targetLang === 'ENGLISH') {
    const latinRegex = /LATIN["']\s*THEN\s*\]%%[\s\S]*?ContentBlockbyID\(["'](\d+)["']\)/i;
    match = html.match(latinRegex);
  }

  // If still not found, try the ELSE branch (default = English in most Emirates blocks)
  if (!match) {
    const elseRegex = /ELSE\s*\]%%[\s\S]*?ContentBlockbyID\(["'](\d+)["']\)/i;
    match = html.match(elseRegex);
  }

  if (!match) return null;

  const subBlockId = match[1];
  onProgress('block', `    → Language branch (${targetLang}): sub-block ${subBlockId}`);

  // Fetch the sub-block
  try {
    const subAsset = await mcClient.rest('GET', `/asset/v1/content/assets/${subBlockId}`);
    let subHtml = subAsset.views?.html?.content || subAsset.content || '';
    onProgress('block', `    → ${subBlockId}: ${subAsset.name} (${(subHtml.length / 1024).toFixed(1)}KB)`);

    // Recurse — the sub-block might also be a logic block (e.g., header has 3 levels)
    const deeper = await resolveLanguageBranch(mcClient, subHtml, lang, onProgress, depth + 1);
    return deeper !== null ? deeper : subHtml;
  } catch (err) {
    onProgress('block-error', `    → Sub-block ${subBlockId}: FAILED (${err.message})`);
    return null;
  }
}

/**
 * Discover a Data Extension's external key via SOAP.
 * MC REST API doesn't support DE lookup by name — only SOAP can do this.
 *
 * @param {object} mcClient
 * @param {string} deName - Human-readable DE name from AMPscript
 * @returns {Promise<string|null>} External key (CustomerKey) or null
 */
async function discoverDEKey(mcClient, deName) {
  const escapedName = deName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const soapXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtension</ObjectType>
      <Properties>Name</Properties>
      <Properties>CustomerKey</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>Name</Property>
        <SimpleOperator>equals</SimpleOperator>
        <Value>${escapedName}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;

  try {
    const result = await mcClient.soap('Retrieve', soapXml);
    const key = result.match(/<CustomerKey>([^<]+)/)?.[1];
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Query DE rows via REST using external key.
 * Automatically paginates to fetch all rows (up to maxRows).
 *
 * @param {object} mcClient
 * @param {string} externalKey
 * @param {string|null} [filter=null] - OData filter expression
 * @param {number} [maxRows=500] - Maximum total rows to fetch across all pages
 * @returns {Promise<Array<object>>} Rows with keys+values merged
 */
async function queryDE(mcClient, externalKey, filter = null, maxRows = 500) {
  const pageSize = 100;
  let allRows = [];
  let page = 1;

  while (allRows.length < maxRows) {
    let path = `/data/v1/customobjectdata/key/${encodeURIComponent(externalKey)}/rowset?$pageSize=${pageSize}&$page=${page}`;
    if (filter) path += `&$filter=${encodeURIComponent(filter)}`;

    try {
      const data = await mcClient.rest('GET', path);
      const items = data.items || [];
      const rows = items.map(r => ({ ...(r.keys || {}), ...(r.values || {}) }));
      allRows = allRows.concat(rows);

      // Stop if we got fewer rows than pageSize (last page)
      if (rows.length < pageSize) break;
      page++;
    } catch {
      break;
    }
  }

  return allRows;
}

/**
 * Query DE with language fallback: try 'en', then 'english', then unfiltered.
 * Emirates DEs use inconsistent language codes across different DEs.
 */
async function queryDEWithLangFallback(mcClient, externalKey, lang) {
  // Emirates DEs use various language formats: 'en', 'english', 'ENGLISH', 'ARABIC', etc.
  // Try multiple variants in order of specificity.
  const langVariants = new Set();

  // Map short codes to full names (Emirates convention is UPPERCASE full names)
  const langMap = {
    en: ['en', 'english', 'ENGLISH', 'ENGLISH US'],
    ar: ['ar', 'arabic', 'ARABIC'],
    fr: ['fr', 'french', 'FRENCH'],
    de: ['de', 'german', 'GERMAN'],
    es: ['es', 'spanish', 'SPANISH'],
    pt: ['pt', 'portuguese', 'PORTUGUESE', 'PORTUGUESE BR'],
    it: ['it', 'italian', 'ITALIAN'],
    ru: ['ru', 'russian', 'RUSSIAN'],
    zh: ['zh', 'chinese', 'SIMPLIFIED CHINESE', 'TRADITIONAL CHINESE'],
    ja: ['ja', 'japanese', 'JAPANESE'],
    ko: ['ko', 'korean', 'KOREAN'],
  };

  const key = lang.toLowerCase().split('-')[0]; // 'en-GB' → 'en'
  const variants = langMap[key] || [lang, lang.toLowerCase(), lang.toUpperCase()];
  for (const v of variants) langVariants.add(v);

  for (const variant of langVariants) {
    const rows = await queryDE(mcClient, externalKey, `language eq '${variant}'`);
    if (rows.length > 0) return rows;
  }

  // Fallback: get all rows
  return queryDE(mcClient, externalKey);
}

/**
 * Structure DE data for image ID collection.
 * Maps DE names to the content shape expected by collectImageIds.
 */
function buildImageContent(deData) {
  // Pass ALL DE rows to collectImageIds — it scans every field
  // whose name contains 'image', 'logo', 'hero', 'icon' for numeric IDs.
  const allRows = [];
  for (const [, rows] of Object.entries(deData)) {
    if (Array.isArray(rows)) allRows.push(...rows);
  }
  return { dynamicContent: allRows };
}
