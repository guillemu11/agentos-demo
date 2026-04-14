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
// Parse the BAU campaign hint directly from an email asset's
// __AdditionalEmailAttribute3/5 values. This is the authoritative source —
// Emirates' campaign-builder writes these at asset duplication time and the
// send-time AMPscript reads them verbatim. Format:
//   Attr3: "{campaignName}_deploydate_{dir}"        (last 14 chars are "_deploydate_xx")
//   Attr5: "CC{TYPECODE}_{DDMMYY}"                  (last 6 chars are DDMMYY)
// Returns { campaignHint, campaignDate, typeCode, direction } when all parts
// are recognizable, null otherwise.
export function parseAssetAttributes(asset) {
  const attrs = asset?.data?.email?.attributes || [];
  const byName = {};
  for (const a of attrs) byName[a.name] = (a.value || '').toString();

  const attr3 = byName.__AdditionalEmailAttribute3 || '';
  const attr5 = byName.__AdditionalEmailAttribute5 || '';
  if (!attr3 && !attr5) return null;

  let campaignHint = null;
  let direction = null;
  if (attr3.length > 14) {
    campaignHint = attr3.slice(0, attr3.length - 14);
    direction = attr3.slice(-2);
  }
  let typeCode = null;
  let campaignDate = null;
  if (attr5.length >= 7) {
    typeCode = attr5.slice(0, attr5.length - 7);   // "CCPRODUPDT"
    campaignDate = attr5.slice(-6);                 // "270226"
  }
  return { campaignHint, campaignDate, typeCode, direction, attr3, attr5 };
}

// Derive a BAU campaign hint from an asset name (fallback when Attr3/5 are empty).
// Emirates conventions:
//   RouteLaunch: "20260302_AU_HelsinkiRouteLaunch" → "auawrhellaunchmar26"
//   Partner Update / Partner Offer: "20260227_Japan_PU_in" → "japan" (loose hint)
// Returns the most distinctive prefix the SOAP search can use.
export function deriveCampaignHint(emailName) {
  if (!emailName) return null;
  const parts = String(emailName).split('_');
  const datePart = parts.find(p => /^\d{8}$/.test(p));
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // RouteLaunch: needs a 2-letter country + "RouteLaunch|RL" in the name
  if (/routelaunch|rl/i.test(emailName)) {
    const countryPart = parts.find(p => /^[A-Z]{2,3}$/.test(p) && p !== datePart);
    if (countryPart) {
      const c2 = countryPart.slice(0, 2).toLowerCase();
      if (datePart) {
        const monthIdx = parseInt(datePart.slice(4, 6), 10) - 1;
        const month = MONTHS[monthIdx];
        const yearShort = datePart.slice(2, 4);
        if (month) return `${c2}awrhellaunch${month}${yearShort}`;
      }
      return `${c2}awrhel`;
    }
  }

  // Partner Update / Partner Offer / Cabin Class etc. — use the descriptive
  // word(s) between the date and the type code as the hint.
  // "20260227_Japan_PU_in" → "japan", "20260301_GL_PartnerOffer" → "gl"
  const typeIdx = parts.findIndex(p => /^(PU|PO|RL|CC)$/i.test(p));
  if (typeIdx > 0) {
    const beforeType = parts.slice(0, typeIdx).filter(p => p !== datePart);
    const descriptor = beforeType[beforeType.length - 1];
    if (descriptor) return descriptor.toLowerCase();
  }

  return null;
}

export async function resolveEmailTemplate(mcClient, assetId, options = {}) {
  const onProgress = options.onProgress || (() => {});

  onProgress('resolve', `Fetching email asset ${assetId}...`);
  const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${assetId}`);
  const emailName = asset.name || `email_${assetId}`;
  const assetType = asset.assetType?.name || 'unknown';

  // Prefer the authoritative campaign hint parsed from the asset's
  // __AdditionalEmailAttribute values (set by the campaign-builder); fall back
  // to a heuristic derived from the asset name.
  const attrInfo = parseAssetAttributes(asset);
  const derivedCampaignHint = attrInfo?.campaignHint || deriveCampaignHint(emailName);

  onProgress('resolve', `  ${emailName} (${assetType})`);
  if (attrInfo?.campaignHint) {
    onProgress('resolve', `  BAU attributes: hint=${attrInfo.campaignHint}, date=${attrInfo.campaignDate}, type=${attrInfo.typeCode}, dir=${attrInfo.direction}`);
  } else if (derivedCampaignHint) {
    onProgress('resolve', `  Derived BAU hint (heuristic): ${derivedCampaignHint}`);
  }

  // Extract slot blocks from views.html.slots
  const slots = asset.views?.html?.slots || {};
  const slotKeys = Object.keys(slots);

  if (slotKeys.length === 0) {
    // No slots — might be an htmlemail with inline content, or the content is in views.html.content
    const html = asset.views?.html?.content || asset.content || '';
    if (html.includes('ContentBlockbyID') || html.includes('LookupRows')) {
      onProgress('resolve', '  Direct AMPscript template (no slots)');
      return { templateHtml: html, emailName, assetType, derivedCampaignHint, attrInfo };
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

  return { templateHtml, emailName, assetType, derivedCampaignHint, attrInfo };
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
    // Stories_Ref_Table_shortlink has ~5-6k rows (28 languages × ~200 stories).
    // 2500 dropped whole language slices → story name lookups returned empty.
    const rows = await queryDE(mcClient, externalKey, null, isLargeDE ? 20000 : 500);

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

// ─── BAU Campaign Support ──────────────────────────────────────────────────────
// BAU campaigns (Route Launch, Partner Offer, Product Offer) use dynamic DE names
// constructed from __AdditionalEmailAttribute parameters. The standard analyzer
// can't discover these — we use SOAP search + AMPscript parsing to find them.

/**
 * Detect if a template is a BAU campaign by checking for the attribute parameter pattern.
 * BAU templates use __AdditionalEmailAttribute3/5 to construct dynamic DE names.
 *
 * @param {string} templateHtml - Full AMPscript HTML
 * @returns {boolean}
 */
export function isBAUTemplate(templateHtml) {
  return /__AdditionalEmailAttribute/i.test(templateHtml) &&
    /Concat\s*\([^)]*(?:RL_DynamicContent|PO_DynamicContent|PO_Products|PU_DynamicContent|CC_DynamicContent)/i.test(templateHtml);
}

/**
 * Parse BAU attribute parameters from the AMPscript template.
 * Extracts campaign_name, campaign_date, campaign_code, campaign_type from
 * the __AdditionalEmailAttribute3/5 parsing logic.
 *
 * @param {string} templateHtml
 * @returns {{ deSuffix: string, vawpDE: string|null }}
 */
export function parseBAUConfig(templateHtml) {
  // Find ALL dynamic DE suffix patterns built via Concat
  // RL: SET @RL_DynamicContent = Concat(@campaign_name, '_', @campaign_date, '_RL_DynamicContent')
  // PO: SET @ProductOffer_DynamicContent = Concat(..., '_PO_DynamicContent')
  //     SET @ProductOffer_Products = Concat(..., '_PO_Products')
  //     SET @ProductOffer_CashMiles = Concat(..., '_PO_CashMiles')
  const suffixes = [];
  const concatPattern = /SET\s+@\w+\s*=\s*Concat\s*\([^)]*['"](_(?:RL|PO|PU|CC)_[^'"]+)['"]\s*\)/gi;
  let match;
  while ((match = concatPattern.exec(templateHtml)) !== null) {
    if (!suffixes.includes(match[1])) suffixes.push(match[1]);
  }

  // Primary suffix is the DynamicContent one (for variant discovery)
  const primarySuffix = suffixes.find(s => s.includes('DynamicContent')) || suffixes[0] || '_RL_DynamicContent';

  // Find VAWP DE
  const vawpMatch = templateHtml.match(/SET\s+@VAWP_person_DE\s*=\s*['"]([^'"]+)['"]/i);

  return {
    deSuffix: primarySuffix,
    allSuffixes: suffixes,
    vawpDE: vawpMatch?.[1] || null,
  };
}

/**
 * Discover BAU dynamic DEs from Marketing Cloud via SOAP search.
 * Searches for DEs matching the *_RL_DynamicContent pattern.
 *
 * @param {object} mcClient
 * @param {string} [campaignHint] - Optional campaign name hint to narrow search
 * @param {Function} [onProgress]
 * @returns {Promise<{contentDE: {name,key}, audienceDE: {name,key}|null, allDEs: Array}>}
 */
export async function discoverBAUDEs(mcClient, campaignHint, onProgress = () => {}, bauConfig = {}) {
  onProgress('bau', 'Discovering BAU dynamic DEs...');

  // Determine which suffixes to search for
  const suffixes = bauConfig.allSuffixes || ['_RL_DynamicContent'];
  const primarySuffix = bauConfig.deSuffix || suffixes[0];

  // Search for the primary content DE
  const searchValue = campaignHint
    ? `${campaignHint}%${primarySuffix.replace(/^_/, '')}`
    : primarySuffix.replace(/^_/, '');

  const soapXml = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
    <RetrieveRequest>
      <ObjectType>DataExtension</ObjectType>
      <Properties>Name</Properties>
      <Properties>CustomerKey</Properties>
      <Properties>CreatedDate</Properties>
      <Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Property>Name</Property>
        <SimpleOperator>like</SimpleOperator>
        <Value>${searchValue}</Value>
      </Filter>
    </RetrieveRequest>
  </RetrieveRequestMsg>`;

  try {
    const result = await mcClient.soap('Retrieve', soapXml);
    const names = [...result.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m => m[1]);
    const keys = [...result.matchAll(/<CustomerKey>([^<]+)<\/CustomerKey>/g)].map(m => m[1]);

    const des = names.map((name, i) => ({ name, key: keys[i] || null }));
    onProgress('bau', `  Found ${des.length} ${primarySuffix} DEs`);

    // Find the most specific match
    let contentDE = des[0] || null;
    if (campaignHint && des.length > 1) {
      const hint = campaignHint.toLowerCase();
      contentDE = des.find(d => d.name.toLowerCase().includes(hint)) || des[0];
    }
    if (des.length > 1 && !campaignHint) {
      contentDE = des[des.length - 1]; // SOAP returns oldest first
    }

    if (contentDE) {
      onProgress('bau', `  Content DE: ${contentDE.name} (key: ${contentDE.key})`);
    }

    // Discover sibling DEs (same campaign prefix, different suffixes)
    // e.g., from PO_DynamicContent → PO_Products, PO_CashMiles
    const siblingDEs = {};
    if (contentDE && suffixes.length > 1) {
      const prefix = contentDE.name.replace(primarySuffix, '');
      for (const suffix of suffixes) {
        if (suffix === primarySuffix) continue;
        const siblingName = prefix + suffix;
        const sibKey = await discoverDEKey(mcClient, siblingName);
        if (sibKey) {
          siblingDEs[suffix] = { name: siblingName, key: sibKey };
          onProgress('bau', `  Sibling DE: ${siblingName}`);
        }
      }
    }

    // Try to find the matching TargetAudience DE
    let audienceDE = null;
    if (contentDE) {
      const prefix = contentDE.name.replace(primarySuffix, '');
      const audienceName = prefix + '_TargetAudience_DE';
      const audKey = await discoverDEKey(mcClient, audienceName);
      if (audKey) {
        audienceDE = { name: audienceName, key: audKey };
        onProgress('bau', `  Audience DE: ${audienceName}`);
      }
    }

    return { contentDE, audienceDE, siblingDEs, allDEs: des };
  } catch (err) {
    onProgress('bau-error', `  SOAP search failed: ${err.message}`);
    return { contentDE: null, audienceDE: null, siblingDEs: {}, allDEs: [] };
  }
}

/**
 * Fetch all data for a BAU campaign.
 * Like fetchCampaignData but handles dynamic DEs and multi-language content.
 *
 * @param {object} params
 * @param {object} params.contentDE - { name, key } from discoverBAUDEs
 * @param {string[]} params.blockIds - Content block IDs from the template
 * @param {object} params.mcClient
 * @param {object} [params.options]
 * @param {Function} [params.options.onProgress]
 * @returns {Promise<{blocks, deData, imageMap, contentRows, languages}>}
 */
// Short language code (as used in content DEs) → full AMPscript name (as used in IF @language).
const BAU_LANG_SHORT_TO_FULL = {
  en: 'ENGLISH', ar: 'ARABIC', he: 'HEBREW', cz: 'CZECH', dk: 'DANISH',
  nl: 'DUTCH', fr: 'FRENCH', de: 'GERMAN', gr: 'GREEK', it: 'ITALIAN',
  pl: 'POLISH', pt_br: 'PORTUGUESE BR', pt_eu: 'PORTUGUESE EU',
  ru: 'RUSSIAN', es: 'SPANISH', tr: 'TURKISH', th: 'THAI',
  ch_scn: 'SIMPLIFIED CHINESE', ch_tcn: 'TRADITIONAL CHINESE',
  jp: 'JAPANESE', kr: 'KOREAN', tw: 'TAIWANESE', id: 'BAHASA',
  se: 'SWEDISH', hu: 'HUNGARIAN', vn: 'VIETNAMESE', nn: 'NORWEGIAN',
};

// Extract ContentBlockbyID refs from a block HTML, but only follow language branches
// that match an active language set. Unconditional refs (outside any IF @language gate)
// are always included.
function collectActiveRefs(html, activeLangsFullUpper) {
  const refs = new Set();
  if (!html) return refs;

  // Find every IF/ELSEIF @language == "X" THEN ... branch and its nested refs.
  // A "branch" ends at the next ELSEIF / ELSE / ENDIF keyword.
  const BRANCH_RE = /(?:IF|ELSEIF)\s+(?:\()?\s*@language\s*==\s*["']([^"']+)["'][\s\S]*?(?:THEN\s*\])([\s\S]*?)(?=%%\[\s*(?:ELSEIF|ELSE|ENDIF))/gi;
  const gatedRanges = [];
  let m;
  while ((m = BRANCH_RE.exec(html)) !== null) {
    const branchLang = m[1].toUpperCase();
    const branchContent = m[2];
    const start = m.index;
    const end = m.index + m[0].length;
    gatedRanges.push({ start, end });
    if (activeLangsFullUpper.has(branchLang)) {
      for (const r of branchContent.matchAll(/ContentBlockbyID\(["'](\d+)["']\)/gi)) {
        refs.add(r[1]);
      }
    }
  }

  // Also include refs outside any gated range (unconditional / fallback content).
  for (const r of html.matchAll(/ContentBlockbyID\(["'](\d+)["']\)/gi)) {
    const pos = r.index;
    const inside = gatedRanges.some(g => pos >= g.start && pos <= g.end);
    if (!inside) refs.add(r[1]);
  }

  return refs;
}

export async function fetchBAUCampaignData({ contentDE, siblingDEs = {}, blockIds, mcClient, options = {} }) {
  const onProgress = options.onProgress || (() => {});

  // 1. Fetch content DE rows FIRST — so we know which languages are actually needed.
  //    Skipping inactive-language sub-blocks avoids hundreds of wasted asset fetches.
  const deData = {};
  if (contentDE?.key) {
    onProgress('des', `Fetching content DE: ${contentDE.name}...`);
    const rows = await queryDE(mcClient, contentDE.key);
    deData[contentDE.name] = rows;
    onProgress('des', `  ${contentDE.name}: ${rows.length} rows`);
  }

  const contentRowsAll = deData[contentDE?.name] || [];
  const activeLangsShort = [...new Set(contentRowsAll.map(r => (r.language || '').toLowerCase()).filter(Boolean))];
  const activeLangsFullUpper = new Set(
    activeLangsShort.map(code => (BAU_LANG_SHORT_TO_FULL[code] || code).toUpperCase())
  );
  onProgress('bau', `  Active languages: ${activeLangsShort.join(', ') || '(none — fetching all)'}`);

  // 2. Fetch content blocks — only follow language branches for active languages.
  onProgress('blocks', `Fetching ${blockIds.length} content blocks (filtered by active languages)...`);
  const blocks = {};
  const toFetch = [...blockIds];
  const fetched = new Set();

  while (toFetch.length > 0) {
    const id = toFetch.shift();
    if (fetched.has(id)) continue;
    fetched.add(id);

    try {
      const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${id}`);
      const html = asset.views?.html?.content || asset.content || '';
      blocks[id] = { name: asset.name || `block_${id}`, html };
      onProgress('block', `  Block ${id}: ${asset.name} (${(html.length / 1024).toFixed(1)}KB)`);

      // Walk nested refs, but only those that survive the language filter.
      // If activeLangsFullUpper is empty (shouldn't happen post-DE-fetch), fall back to all refs.
      const activeRefs = activeLangsFullUpper.size > 0
        ? collectActiveRefs(html, activeLangsFullUpper)
        : new Set([...html.matchAll(/ContentBlockbyID\(["'](\d+)["']\)/gi)].map(r => r[1]));
      for (const refId of activeRefs) {
        if (!fetched.has(refId)) toFetch.push(refId);
      }
    } catch (err) {
      onProgress('block-error', `  Block ${id}: FAILED (${err.message})`);
      blocks[id] = { name: `block_${id}`, html: '' };
    }
  }
  onProgress('blocks', `  Fetched ${Object.keys(blocks).length} blocks (${blockIds.length} top-level, ${Object.keys(blocks).length - blockIds.length} nested)`);

  // 2b. Fetch sibling DEs (PO_Products, PO_CashMiles, etc.)
  for (const [suffix, de] of Object.entries(siblingDEs)) {
    if (de?.key) {
      onProgress('des', `Fetching sibling DE: ${de.name}...`);
      const rows = await queryDE(mcClient, de.key);
      deData[de.name] = rows;
      onProgress('des', `  ${de.name}: ${rows.length} rows`);
    }
  }

  // 3. Fetch Footer_CentralizedContent
  const footerKey = await discoverDEKey(mcClient, 'Footer_CentralizedContent');
  if (footerKey) {
    const footerRows = await queryDE(mcClient, footerKey, null, 50);
    deData['Footer_CentralizedContent'] = footerRows;
    onProgress('des', `  Footer_CentralizedContent: ${footerRows.length} rows`);
  }

  // 4. Fetch REF_Caveat_Disclaimer
  const caveatKey = await discoverDEKey(mcClient, 'REF_Caveat_Disclaimer');
  if (caveatKey) {
    const caveatRows = await queryDE(mcClient, caveatKey, null, 50);
    deData['REF_Caveat_Disclaimer'] = caveatRows;
    onProgress('des', `  REF_Caveat_Disclaimer: ${caveatRows.length} rows`);
  }

  // 4b. Fetch Rolling Static Content DEs (drives the worry-free / travel-hub /
  //     emirates-experience / before-travel section per market+language).
  const rollingKey = await discoverDEKey(mcClient, 'Rolling_Static_Content_per_Market-Language');
  if (rollingKey) {
    const rows = await queryDE(mcClient, rollingKey, null, 500);
    deData['Rolling_Static_Content_per_Market-Language'] = rows;
    onProgress('des', `  Rolling_Static_Content_per_Market-Language: ${rows.length} rows`);
  }
  const featuredKey = await discoverDEKey(mcClient, 'FeaturedItems_Ref_Table');
  if (featuredKey) {
    const rows = await queryDE(mcClient, featuredKey, null, 200);
    deData['FeaturedItems_Ref_Table'] = rows;
    onProgress('des', `  FeaturedItems_Ref_Table: ${rows.length} rows`);
  }
  // Production uses dedicated REF DEs for the static rolling sections instead
  // of FeaturedItems_Ref_Table — the rows already carry offer_block_* fields
  // shaped for the offer block template.
  const worryKey = await discoverDEKey(mcClient, 'REF_Worry_Free_Travel');
  if (worryKey) {
    const rows = await queryDE(mcClient, worryKey, null, 50);
    deData['REF_Worry_Free_Travel'] = rows;
    onProgress('des', `  REF_Worry_Free_Travel: ${rows.length} rows`);
  }

  // 5. Resolve images
  const contentForImages = buildImageContent(deData);
  const imageIds = collectImageIds(contentForImages);
  onProgress('images', `Resolving ${imageIds.length} image assets...`);
  const imageMap = await resolveImageBatch(mcClient, imageIds);
  onProgress('images', `  Resolved ${Object.keys(imageMap).length}/${imageIds.length} images`);

  // 6. Derive languages and variant info from content rows
  const contentRows = deData[contentDE?.name] || [];
  const languages = [...new Set(contentRows.map(r => r.language).filter(Boolean))];
  const tiers = [...new Set(contentRows.map(r => r.tier).filter(Boolean))];

  onProgress('bau', `  Languages: ${languages.join(', ')}`);
  onProgress('bau', `  Tiers: ${tiers.join(', ')}`);

  return { blocks, deData, imageMap, contentRows, languages, tiers };
}

/**
 * Resolve a logic block to a language-specific sub-block using pre-fetched blocks.
 * Unlike resolveLanguageBranch (which fetches from MC), this uses the blocks map.
 *
 * @param {Record<string,{html:string}>} blocks - All fetched blocks
 * @param {string} logicBlockId - The logic block ID to resolve
 * @param {string} language - Target language in AMPscript format (e.g., 'ENGLISH', 'TRADITIONAL CHINESE')
 * @returns {string|null} Resolved block ID, or null
 */
export function resolveLogicBlock(blocks, logicBlockId, language) {
  const block = blocks[logicBlockId];
  if (!block?.html) return null;

  const html = block.html;

  // Try exact language match
  const langRegex = new RegExp(
    `@language\\s*==\\s*["']${language}["']\\s*(?:\\)|THEN)\\s*\\]%%[\\s\\S]*?ContentBlockbyID\\(["'](\\d+)["']\\)`,
    'i'
  );
  let match = html.match(langRegex);

  // Try with OR variants (e.g., DUTCH OR BELGIUM DUTCH)
  if (!match) {
    const langRegex2 = new RegExp(
      `["']${language}["'][^\\]]*THEN\\s*\\]%%[\\s\\S]*?ContentBlockbyID\\(["'](\\d+)["']\\)`,
      'i'
    );
    match = html.match(langRegex2);
  }

  // Fallback to ELSE branch
  if (!match) {
    const elseRegex = /ELSE\s*\]%%[\s\S]*?ContentBlockbyID\(["'](\d+)["']\)/i;
    match = html.match(elseRegex);
  }

  return match?.[1] || null;
}
