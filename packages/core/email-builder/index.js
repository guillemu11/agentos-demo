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
 * BAU campaigns (Route Launch, Partner Offer, etc.) use a parallel flow:
 *   1b. analyzeBAUTemplate(templateHtml) → BAU manifest
 *   2b. discoverBAUDEs(mcClient) → dynamic DE discovery
 *   2c. fetchBAUCampaignData({ contentDE, blockIds, mcClient }) → data bundle
 *   3b. renderBAUVariants({ manifest, data, blocks, templateShell }) → { filename: html }
 *
 * Also exports buildCampaignEmails() — one-shot orchestrator that auto-detects
 * standard vs BAU campaigns and runs the appropriate pipeline.
 */

export { analyzeTemplate, analyzeBAUTemplate } from './analyzer.js';
export {
  fetchCampaignData,
  resolveEmailTemplate,
  isBAUTemplate,
  parseBAUConfig,
  discoverBAUDEs,
  fetchBAUCampaignData,
  resolveLogicBlock,
} from './fetcher.js';
export { renderAllVariants, renderVariant, buildVariableMap, generatePreviewVariants } from './renderer.js';
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

import { analyzeTemplate, analyzeBAUTemplate } from './analyzer.js';
import { fetchCampaignData, resolveEmailTemplate, isBAUTemplate, parseBAUConfig, discoverBAUDEs, fetchBAUCampaignData, resolveLogicBlock } from './fetcher.js';
import { renderAllVariants, buildVariableMap, renderVariant } from './renderer.js';
import { stripAmpscriptBlocks, replaceAmpscriptVars, cleanTemplateShell } from './ampscript.js';

// ─── Language mapping (AMPscript full name ↔ short code) ───────────────────

const LANG_MAP = {
  en: 'ENGLISH', ar: 'ARABIC', he: 'HEBREW', cz: 'CZECH', dk: 'DANISH',
  nl: 'DUTCH', fr: 'FRENCH', de: 'GERMAN', gr: 'GREEK', it: 'ITALIAN',
  pl: 'POLISH', pt_br: 'PORTUGUESE BR', pt_eu: 'PORTUGUESE EU',
  ru: 'RUSSIAN', es: 'SPANISH', tr: 'TURKISH', th: 'THAI',
  ch_scn: 'SIMPLIFIED CHINESE', ch_tcn: 'TRADITIONAL CHINESE',
  jp: 'JAPANESE', kr: 'KOREAN', tw: 'TAIWANESE', id: 'BAHASA',
  se: 'SWEDISH', hu: 'HUNGARIAN', vn: 'VIETNAMESE', nn: 'NORWEGIAN',
};

const LANG_REVERSE = Object.fromEntries(
  Object.entries(LANG_MAP).map(([k, v]) => [v, k])
);

/**
 * Build all email variants for a campaign — runs the full pipeline.
 * Auto-detects BAU campaigns and uses the appropriate flow.
 *
 * @param {object} params
 * @param {string} [params.templateHtml] - Full AMPscript HTML template (if known)
 * @param {number|string} [params.assetId] - MC asset ID to resolve (alternative to templateHtml)
 * @param {object} params.mcClient - MC client from createMCClient()
 * @param {string} params.templateShell - Template wrapper HTML with {{CONTENT}} placeholder
 * @param {object} [params.subscriber] - Preview subscriber data
 * @param {string} [params.campaignHint] - Campaign name hint for BAU DE discovery
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
  subscriber = {},
  campaignHint,
  options = {},
}) {
  const onProgress = options.onProgress || (() => {});
  let emailName;

  // Phase 0: Resolve template if assetId provided
  let derivedCampaignHint = null;
  if (!templateHtml && assetId) {
    onProgress('resolve', `Resolving email template from asset ${assetId}...`);
    const resolved = await resolveEmailTemplate(mcClient, assetId, {
      onProgress: (step, detail) => onProgress('resolve', detail),
    });
    templateHtml = resolved.templateHtml;
    emailName = resolved.emailName;
    derivedCampaignHint = resolved.derivedCampaignHint || null;
    onProgress('resolve', `Resolved: ${emailName} (${(templateHtml.length / 1024).toFixed(1)}KB)`);
  }

  if (!templateHtml) {
    throw new Error('Either templateHtml or assetId must be provided');
  }

  // Prefer explicit campaignHint; fall back to the one derived from the asset name.
  const effectiveCampaignHint = campaignHint || derivedCampaignHint || null;

  // Detect BAU vs standard campaign
  if (isBAUTemplate(templateHtml)) {
    onProgress('detect', `BAU campaign detected${effectiveCampaignHint ? ` (hint: ${effectiveCampaignHint})` : ''}`);
    return buildBAUCampaign({ templateHtml, emailName, mcClient, templateShell, subscriber, campaignHint: effectiveCampaignHint, options });
  }

  // ── Standard pipeline ──
  onProgress('analyze', 'Analyzing AMPscript template...');
  const manifest = analyzeTemplate(templateHtml);
  onProgress('analyze', `Found ${manifest.contentBlockIds.length} blocks, ${manifest.dataExtensions.length} DEs, ${manifest.variants.segments.length} segments`);

  onProgress('fetch', 'Fetching data from Marketing Cloud...');
  const data = await fetchCampaignData(manifest, mcClient, {
    language: options.language,
    onProgress: (step, detail) => onProgress('fetch', detail),
  });
  onProgress('fetch', 'All MC data fetched');

  onProgress('render', 'Rendering email variants...');
  // Clean the template shell (resolve RTL/LTR AMPscript) and replace the
  // empty slot placeholder with {{CONTENT}} so renderVariant can inject
  // the assembled blocks. Without this, the raw asset shell comes back
  // verbatim and the rendered email is empty.
  const preparedShell = templateShell
    ? cleanTemplateShell(templateShell).replace(
        /<div\s+data-type="slot"[^>]*><\/div>/i,
        '{{CONTENT}}',
      )
    : templateShell;
  const variants = renderAllVariants({
    manifest,
    data,
    subscriber,
    templateShell: preparedShell,
    options: { market: options.market },
  });
  onProgress('render', `Generated ${Object.keys(variants).length} email variants`);

  return { manifest, data, variants, emailName };
}

/**
 * BAU campaign pipeline — handles dynamic DEs and multi-language rendering.
 * Called internally by buildCampaignEmails when a BAU template is detected.
 */
async function buildBAUCampaign({ templateHtml, emailName, mcClient, templateShell, subscriber, campaignHint, options }) {
  const onProgress = options.onProgress || (() => {});

  // Phase 1: Analyze BAU template
  onProgress('analyze', 'Analyzing BAU template...');
  const manifest = analyzeBAUTemplate(templateHtml);
  onProgress('analyze', `Found ${manifest.contentBlockIds.length} block refs, BAU suffix: ${manifest.bau.deSuffix}`);

  // Phase 2a: Discover dynamic DEs (pass BAU config for suffix detection)
  const bauConfig = parseBAUConfig(templateHtml);
  const { contentDE, audienceDE, siblingDEs } = await discoverBAUDEs(mcClient, campaignHint, onProgress, bauConfig);
  if (!contentDE) {
    throw new Error(`No BAU content DE found${campaignHint ? ` for "${campaignHint}"` : ''}. Run discoverBAUDEs() to see available DEs.`);
  }

  // Phase 2b: Fetch all blocks and DE data
  const data = await fetchBAUCampaignData({
    contentDE,
    siblingDEs,
    blockIds: manifest.contentBlockIds,
    mcClient,
    options: { onProgress },
  });

  // Phase 3: Render BAU variants (language × header type)
  onProgress('render', 'Rendering BAU variants...');

  const shell = cleanTemplateShell(templateShell)
    .replace(/<div data-type="slot"[^>]*><\/div>/, '{{CONTENT}}');

  // Build block-level content guards from the template's AMPscript conditionals.
  // Any block wrapped by %%[IF Length(@var) > 0 THEN]%% ... ContentBlockbyID(X) ... %%[ENDIF]%%
  // should be skipped for a given contentRow when the driving var is empty.
  // This mirrors the real email's display logic instead of rendering empty shells.
  const blockGuards = extractBlockGuards(templateHtml);
  const guardedCount = Object.keys(blockGuards).length;
  if (guardedCount > 0) {
    onProgress('render', `Parsed ${guardedCount} block guard(s) from template conditionals`);
  }

  const variants = {};
  const { contentRows: rawContentRows, blocks, imageMap, deData } = data;

  // Filter out placeholder rows that have no actual content. A row counts as
  // "empty" when all of the core driver fields are blank — prevents rendering
  // ghost variants for languages present in the DE but with no copy.
  const CORE_FIELDS = ['main_hero_image', 'headline', 'subheader', 'body_copy'];
  const contentRows = rawContentRows.filter(row => {
    const hasCore = CORE_FIELDS.some(f => row[f] && String(row[f]).trim().length > 0);
    return hasCore;
  });
  if (contentRows.length !== rawContentRows.length) {
    onProgress('render', `Filtered ${rawContentRows.length - contentRows.length} empty content row(s); rendering ${contentRows.length}`);
  }

  // Get footer rows indexed by language
  const footerRows = deData['Footer_CentralizedContent'] || [];

  // Detect header v2/v3 from fetched blocks (not just template)
  // The header block 16618 (or similar) contains SET @headerver = "v2"/"v3"
  const hasHeaderV2V3FromBlocks = Object.values(blocks).some(
    b => /SET\s+@headerver\s*=\s*["']v[23]["']/i.test(b.html)
  );

  for (const contentRow of contentRows) {
    const langCode = contentRow.language; // e.g., 'en', 'ch_tcn'
    const langFull = LANG_MAP[langCode] || langCode.toUpperCase(); // e.g., 'ENGLISH'
    const headerTypes = (manifest.bau.hasHeaderV2V3 || hasHeaderV2V3FromBlocks) ? ['v3', 'v2'] : ['default'];

    // Find footer for this language
    const footerRow = footerRows.find(r => (r.language || '').toLowerCase() === langCode) || footerRows[0] || null;

    for (const headerType of headerTypes) {
      const isSkw = headerType === 'v3';
      // Realistic preview personas per variant so the rendered output reflects
      // real per-subscriber differences (header bar, tier, miles, greeting).
      // Override via `subscriber` param if the caller wants specific data.
      const variantSub = isSkw
        ? {
            first_name: subscriber?.first_name || 'Maria',
            TierName: 'Platinum',
            miles_balance: '42,500',
            loy_tier_code: '2: Platinum',
            loy_skywards_mile_balance: '42,500',
            ...subscriber,
          }
        : {
            first_name: subscriber?.first_name || 'John',
            TierName: '',
            miles_balance: '',
            loy_tier_code: '7: Non-Member',
            loy_skywards_mile_balance: '',
            ...subscriber,
          };

      // Build variable map
      const vars = buildVariableMap({
        subscriber: variantSub,
        headerContent: null,
        footerContent: footerRow,
        segmentContent: contentRow,
        stories: [],
        caveat: pickRowByLanguage(deData['REF_Caveat_Disclaimer'] || [], langCode),
        salutation: null,
        imageMap,
        market: contentRow.main_cta_url?.includes('/chinese/') ? `hk/chinese` : `hk/english`,
      });

      // Add extra AMPscript-level vars the header blocks use
      vars.loy_tier_code = variantSub.loy_tier_code;
      vars.loy_skywards_mile_balance = variantSub.loy_skywards_mile_balance;
      vars.xtshortdate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

      // Map story3/4 inline vars to double story block vars
      if (contentRow.story3_double_image && contentRow.story4_double_image) {
        for (const prefix of ['story3_double', 'story4_double']) {
          const idx = prefix === 'story3_double' ? '1' : '2';
          for (const field of ['image', 'header', 'subheader', 'body', 'url', 'alias']) {
            vars[`story_double_${field}${idx}`] = vars[`${prefix}_${field}`] || '';
          }
        }
      }

      // Terms
      vars.cb_terms_content = (contentRow.terms_content1 || '') + (contentRow.terms_content2 || '');

      // Rolling Static Content (worry-free / travel-hub / emirates-experience /
      // before-travel). The AMPscript looks up `static_content` from
      // Rolling_Static_Content_per_Market-Language by language + market_code,
      // then pulls the actual content from a secondary DE based on that value.
      applyRollingStaticContent(vars, {
        deData,
        langCode,
        country: deriveMarketCountry(emailName, contentRow),
      });

      // Re-order blocks so that anything driven by Rolling Static Content
      // (e.g. block 18256 when @static_content = 'worry-free-travel') renders
      // in the rolling-static position — right before the global spacer/footer
      // — instead of in its earlier "standalone offer block" slot. The template
      // references 18256 in two different positions; allBlocks is deduped to
      // the first occurrence, so we move it manually when rolling static fires.
      const orderedBlockIds = reorderForRollingStatic(
        manifest.blockOrder.allBlocks,
        vars.static_content,
      );

      // Assemble blocks — resolve logic blocks to language-specific sub-blocks
      const parts = [];
      let skippedByGuard = 0;
      let skippedByLang = 0;
      for (const blockId of orderedBlockIds) {
        const block = blocks[blockId];
        if (!block?.html) continue;

        // Skip top-level blocks whose name indicates a different language
        // (e.g., "AR_ODR", "KR_terms" when current variant is EN).
        if (isBlockForInactiveLanguage(block.name, langCode)) {
          skippedByLang++;
          continue;
        }

        // Content gate: honor the template's IF Length(@var) > 0 THEN guard.
        // Evaluate against the merged vars (contentRow + rolling static + maps)
        // so blocks driven by post-processed vars (e.g. offer_block_body from
        // FeaturedItems_Ref_Table) aren't incorrectly skipped.
        const guard = blockGuards[blockId];
        if (guard && !evaluateGuard(guard, vars)) {
          skippedByGuard++;
          continue;
        }

        // Check if this is a logic block (contains language branching)
        const hasLangBranch = /IF\s+(?:\(?\s*)?.*?@language\s*==\s*["']/i.test(block.html);
        const hasHeaderverBranch = /@headerver\s*==\s*["']v[23]["']/i.test(block.html);

        let rendered = null;
        if (hasLangBranch && hasHeaderverBranch) {
          // Combined: logic block with both @language AND @headerver conditions.
          const headerVer = isSkw ? 'v3' : 'v2';
          const subBlockId = resolveBranchedBlock(block.html, { language: langFull, headerver: headerVer });
          if (subBlockId && blocks[subBlockId]) {
            rendered = stripAmpscriptBlocks(blocks[subBlockId].html);
          }
        } else if (hasLangBranch) {
          const subBlockId = resolveLogicBlock(blocks, blockId, langFull);
          if (subBlockId && blocks[subBlockId]) {
            rendered = stripAmpscriptBlocks(blocks[subBlockId].html);
          }
        } else {
          rendered = stripAmpscriptBlocks(block.html);
        }

        if (rendered == null) continue;
        rendered = replaceAmpscriptVars(rendered, vars);

        // Drop blocks that rendered to only structural/empty HTML (no meaningful
        // text). Prevents orphan section-title blocks whose driver vars are
        // blank in the DE from leaving visible empty gaps.
        if (isRenderedBlockEmpty(rendered)) continue;

        parts.push(rendered);
      }

      const content = parts.filter(Boolean).join('\n\n');
      const html = shell.replace('{{CONTENT}}', content);

      const headerLabel = headerType === 'v3' ? 'skw' : headerType === 'v2' ? 'ebase' : 'default';
      const filename = headerTypes.length > 1
        ? `${langCode}_${headerLabel}.html`
        : `${langCode}.html`;

      variants[filename] = html;
      const suffix = [];
      if (skippedByGuard > 0) suffix.push(`guard:${skippedByGuard}`);
      if (skippedByLang > 0) suffix.push(`lang:${skippedByLang}`);
      const skipStr = suffix.length ? ` — skipped ${suffix.join(', ')}` : '';
      onProgress('render', `  ${filename}${skipStr} (${(html.length / 1024).toFixed(1)}KB)`);
    }
  }

  onProgress('render', `Generated ${Object.keys(variants).length} BAU email variants`);
  return { manifest, data, variants, emailName };
}

// Block IDs that, when populated by Rolling Static Content, must render in
// the rolling-static position (right before Global_spacer / Footer) rather
// than in their earlier "standalone" slot in the template.
const ROLLING_STATIC_BLOCK_IDS = {
  'worry-free-travel': ['18256'],
  'emirates-experience': ['26875', '26879', '27596', '27105'],
  'travel-hub': ['26876', '26881', '27105'],
  'before-travel': ['26877', '26883', '27105'],
};
// Footer/structural blocks that mark the start of the post-content tail.
// The rolling block(s) get moved to just BEFORE the first of these.
const ROLLING_STATIC_TAIL_IDS = new Set(['37247', '39445', '17372', '35063', '36843']);

function reorderForRollingStatic(allBlocks, staticContentKey) {
  if (!staticContentKey) return allBlocks;
  const moveSet = new Set(ROLLING_STATIC_BLOCK_IDS[staticContentKey] || []);
  if (moveSet.size === 0) return allBlocks;

  const idsToMove = allBlocks.filter(id => moveSet.has(String(id)));
  if (idsToMove.length === 0) return allBlocks;

  const remaining = allBlocks.filter(id => !moveSet.has(String(id)));
  const tailStart = remaining.findIndex(id => ROLLING_STATIC_TAIL_IDS.has(String(id)));
  if (tailStart < 0) return allBlocks; // no recognised tail → keep original order

  return [
    ...remaining.slice(0, tailStart),
    ...idsToMove,
    ...remaining.slice(tailStart),
  ];
}

// Derive the 2-letter market country code (e.g. 'au', 'hk') from either the
// content row (if it has market_code/country) or the email name. Used to look
// up market-specific Rolling Static Content rows.
function deriveMarketCountry(emailName, contentRow) {
  const fromRow = (contentRow?.market_code || contentRow?.country || '').toString().toLowerCase();
  if (fromRow) return fromRow.slice(0, 2);
  if (emailName) {
    const m = emailName.split('_').find(p => /^[A-Z]{2,3}$/.test(p));
    if (m) return m.slice(0, 2).toLowerCase();
  }
  return '';
}

// Pull the per-market+language "static_content" key (worry-free-travel /
// travel-hub / emirates-experience / before-travel) from the Rolling DE,
// then materialize the corresponding @offer_block_* / @info* / @article* /
// @product* vars from the matching secondary DE row. This is what makes
// block 18256 (offer block) and friends actually render with content.
function applyRollingStaticContent(vars, { deData, langCode, country }) {
  const rolling = deData['Rolling_Static_Content_per_Market-Language'] || [];
  if (rolling.length === 0) return;

  const lang = (langCode || '').toLowerCase();
  const ctry = (country || '').toLowerCase();
  const match = rolling.find(r =>
    (r.language || '').toLowerCase() === lang &&
    (r.market_code || '').toLowerCase() === ctry
  );
  if (!match) return;

  const staticContent = (match.static_content || '').toLowerCase();
  vars.static_content = staticContent;

  // The REST data API returns field names lowercased and FItem_name uses
  // underscore-form values (e.g. "worry_free_travel" not "worry-free-travel").
  // Helper: case-insensitive field accessor; also normalises hyphen↔underscore.
  const getField = (row, name) => {
    const lower = name.toLowerCase();
    const found = Object.keys(row).find(k => k.toLowerCase() === lower);
    return found ? row[found] : undefined;
  };
  const matchFItem = (rows, slug) => {
    const slugVariants = new Set([slug, slug.replace(/-/g, '_'), slug.replace(/_/g, '-')]);
    return rows.find(r => {
      const langOK = (getField(r, 'language') || '').toLowerCase() === lang;
      const name = (getField(r, 'FItem_name') || '').toLowerCase();
      return langOK && slugVariants.has(name);
    });
  };

  if (staticContent === 'worry-free-travel') {
    // Production source: REF_Worry_Free_Travel (rows already shaped as offer_block_*).
    // Fallback: legacy FeaturedItems_Ref_Table with FItem_* fields.
    const worry = (deData['REF_Worry_Free_Travel'] || []).find(r =>
      (getField(r, 'language') || '').toLowerCase() === lang
    );
    if (worry) {
      vars.offer_block_header = getField(worry, 'offer_block_header') || '';
      vars.offer_block_body = getField(worry, 'offer_block_body') || '';
      vars.offer_block_body_content = getField(worry, 'offer_block_body') || '';
      vars.offer_block_cta_text = getField(worry, 'offer_block_cta_text') || '';
      vars.offer_block_link_alias = getField(worry, 'offer_block_link_alias') || '';
      vars.offer_block_cta_link = getField(worry, 'offer_block_cta_link') || '';
    } else {
      const featured = deData['FeaturedItems_Ref_Table'] || [];
      const wf = matchFItem(featured, 'worry-free-travel');
      if (wf) {
        vars.offer_block_header = getField(wf, 'FItem_header') || '';
        vars.offer_block_body = getField(wf, 'FItem_body_copy') || '';
        vars.offer_block_body_content = getField(wf, 'FItem_body_copy') || '';
        vars.offer_block_cta_text = getField(wf, 'FItem_cta') || '';
        vars.offer_block_link_alias = getField(wf, 'FItem_link_alias') || '';
        vars.offer_block_cta_link = getField(wf, 'FItem_link') || '';
      }
    }
    // AMPscript replaces the literal "global_market" placeholder in the body
    // copy with the active country code (e.g., "au"). Mirror that here.
    if (vars.offer_block_body && country) {
      vars.offer_block_body = vars.offer_block_body.replace(/global_market/g, country);
      vars.offer_block_body_content = vars.offer_block_body;
    }
  } else if (staticContent === 'emirates-experience') {
    const featured = deData['FeaturedItems_Ref_Table'] || [];
    const exp = matchFItem(featured, 'emirates-experience');
    if (exp) {
      vars.articles_title = getField(exp, 'FItem_section_title') || '';
      vars.article_image_id = getField(exp, 'FItem_image') || '';
      vars.article_image = getField(exp, 'FItem_image') || '';
      vars.article_copy_title = getField(exp, 'FItem_header') || '';
      vars.article_copy = getField(exp, 'FItem_body_copy') || '';
      vars.article_link_alias = getField(exp, 'FItem_link_alias') || '';
      vars.article_link = getField(exp, 'FItem_link') || '';
    }
  }
  // travel-hub and before-travel use REF_Travel_Hub / REF_Before_Travel which
  // aren't fetched yet. Add when an asset that needs them comes through.
}

// Block-name prefixes used by Emirates to mark language-specific top-level blocks.
// "EN_terms", "KR_ODR", "SCN_Global_footer" etc. — if the prefix doesn't match
// the active language for the variant being rendered, skip the block entirely.
const BLOCK_LANG_PREFIX = {
  en: 'EN', ar: 'AR', fr: 'FR', de: 'DE', it: 'IT', es: 'ES',
  pl: 'PL', gr: 'GR', ru: 'RU', tr: 'TR', th: 'TH', jp: 'JP',
  kr: 'KR', tw: 'TW', id: 'ID', se: 'SE', hu: 'HU', vn: 'VN',
  nn: 'NN', nl: 'NL', cz: 'CZ', dk: 'DK', he: 'HE',
  ch_scn: 'SCN', ch_tcn: 'TCN', pt_br: 'BRPT', pt_eu: 'EUPT',
};
const ALL_BLOCK_LANG_PREFIXES = new Set(Object.values(BLOCK_LANG_PREFIX));

/**
 * Resolve a logic block that combines @language + @headerver conditions.
 * Finds the first branch whose condition matches the given context and
 * returns the ContentBlockbyID inside.
 *
 * Handles: IF ((@language == "ENGLISH" OR ...) AND @headerver == "v2") THEN CBId("197")
 */
function resolveBranchedBlock(html, ctx) {
  if (!html) return null;
  const BRANCH_RE = /(?:IF|ELSEIF)\s+([\s\S]+?)\s+THEN\s*\]%%([\s\S]*?)(?=%%\[\s*(?:ELSEIF|ELSE|ENDIF))/gi;
  let m;
  const language = (ctx.language || '').toUpperCase();
  const headerver = (ctx.headerver || '').toLowerCase();

  while ((m = BRANCH_RE.exec(html)) !== null) {
    const condition = m[1];
    const body = m[2];

    // Language check: this branch's language alternatives must include the active one,
    // OR the branch doesn't mention @language (applies to all languages).
    const langMatches = condition.match(/@language\s*==\s*["']([^"']+)["']/gi) || [];
    const langOK = langMatches.length === 0
      || langMatches.some(lm => {
        const q = lm.match(/["']([^"']+)["']/)?.[1]?.toUpperCase();
        return q === language;
      });

    // Header version check
    const hvMatch = condition.match(/@headerver\s*==\s*["'](v[23])["']/i);
    const hvOK = !hvMatch || hvMatch[1].toLowerCase() === headerver;

    if (langOK && hvOK) {
      const ref = body.match(/ContentBlockbyID\(["'](\d+)["']\)/i);
      if (ref) return ref[1];
    }
  }

  // Fallback: ELSE branch (no IF/ELSEIF header → capture ELSE body)
  const elseMatch = html.match(/%%\[\s*ELSE\s*\]%%([\s\S]*?)%%\[\s*ENDIF/i);
  if (elseMatch) {
    const ref = elseMatch[1].match(/ContentBlockbyID\(["'](\d+)["']\)/i);
    if (ref) return ref[1];
  }
  return null;
}

// Detect rendered HTML that only contains structural/empty chrome — tables,
// tds, spacers, linebreaks — but no visible text AND no image with a real src.
// Used to drop orphan blocks whose driver vars (section_title, etc.) are blank
// in the content DE without nuking blocks that legitimately contain only an image.
function isRenderedBlockEmpty(html) {
  if (!html) return true;
  // Preserve blocks that contain at least one <img> with a non-empty src — the
  // hero/masthead block has only an image and no body text, but is meaningful.
  if (/<img[^>]+src=["'](?!\s*["'])\s*[^"']+["']/i.test(html)) return false;
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')           // HTML comments
    .replace(/<[^>]+>/g, '')                   // tags
    .replace(/&nbsp;|&amp;|&quot;|&#\d+;/g, '') // entities
    .replace(/\s+/g, '')                       // whitespace
    .trim();
  // Treat blocks with under 3 visible chars as empty (accounts for stray punctuation).
  return stripped.length < 3;
}

// Pick the DE row matching the current language. Falls back to English, then
// to the first row — prevents defaulting to arbitrary rows (often Arabic in
// Emirates' REF DEs) which leaks wrong-language content into other variants.
function pickRowByLanguage(rows, langCode) {
  if (!rows || rows.length === 0) return null;
  const target = (langCode || '').toLowerCase();
  const byLang = rows.find(r => (r.language || '').toLowerCase() === target);
  if (byLang) return byLang;
  const english = rows.find(r => (r.language || '').toLowerCase() === 'en');
  return english || rows[0];
}

function isBlockForInactiveLanguage(blockName, activeLangCode) {
  if (!blockName) return false;
  const m = blockName.match(/^([A-Z]{2,4})_/);
  if (!m) return false;
  const prefix = m[1];
  if (!ALL_BLOCK_LANG_PREFIXES.has(prefix)) return false;
  const activePrefix = BLOCK_LANG_PREFIX[activeLangCode?.toLowerCase()];
  return prefix !== activePrefix;
}

// ─── Block content-guard helpers ─────────────────────────────────────────────

// Vars that are driven by subscriber/runtime attributes, NOT by the content DE.
// Guards using these are irrelevant for preview rendering (we always evaluate
// them as truthy-unknown). Excluding them prevents spurious skips.
const SUBSCRIBER_VAR_RE = /__AdditionalEmailAttribute|country_of_residence|per_language|loy_tier|emcg_uuid|person_id|id_member_id|drv_home_airport|prf_departure|add_cty_code|add_post_code|ebase_subscriber|ek_unsubscribe|_messagecontext|_subscriberkey|nationality|age_bucket|first_name|last_name|salutation|per_media_code|retain_miles|attain_miles/i;

/**
 * Scan an AMPscript template for `IF <cond> THEN ... ContentBlockbyID("X") ... ENDIF`
 * patterns and return a map of blockId → raw condition string.
 *
 * Handles both AMPscript syntaxes:
 *   %%[IF ... THEN]%% %%=ContentBlockbyID("X")=%% %%[ENDIF]%%   (per-line)
 *   %%[ IF ... THEN ContentBlockbyID("X") ENDIF ]%%              (block-level)
 *
 * Language conditionals (`@language == "X"`) and subscriber-attribute
 * conditionals are skipped — they aren't content-DE-driven gates.
 */
function extractBlockGuards(templateHtml) {
  const guards = {};
  if (!templateHtml) return guards;

  // Greedy-to-next-ENDIF. Doesn't handle perfect nesting, but Emirates logic
  // blocks mostly use flat gates or one level of nesting (which the outer
  // match still catches conservatively).
  const IF_RE = /\bIF\s+((?:(?!\bTHEN\b)[\s\S]){1,800}?)\s+THEN\b([\s\S]{0,1200}?)\bENDIF\b/gi;
  let m;
  while ((m = IF_RE.exec(templateHtml)) !== null) {
    const condition = m[1].trim();
    const body = m[2];

    // Only content-var gates.
    if (/@language\s*==/i.test(condition)) continue;
    if (SUBSCRIBER_VAR_RE.test(condition)) continue;
    if (!/EMPTY\s*\(|Length\s*\(\s*@/i.test(condition)) continue;

    const blockIds = [...body.matchAll(/ContentBlockbyID\(["'](\d+)["']\)/gi)].map(r => r[1]);
    if (blockIds.length === 0) continue;

    for (const bid of blockIds) {
      // If the same block appears under multiple guards, the most permissive
      // interpretation is "render if any condition passes" → OR-merge.
      if (!guards[bid]) guards[bid] = condition;
      else guards[bid] = `(${guards[bid]}) OR (${condition})`;
    }
  }
  return guards;
}

/**
 * Evaluate an AMPscript condition string against a content row.
 * Supports: NOT EMPTY(@v), EMPTY(@v), Length(@v) > 0, joined by AND/OR.
 * Unknown constructs are treated as "pass-through" (true) to avoid false negatives.
 */
function evaluateGuard(condition, contentRow) {
  const isFilled = (v) => {
    const val = contentRow?.[v];
    return val != null && String(val).trim().length > 0;
  };

  // Split by AND / OR boundaries, preserving operators.
  const tokens = condition.split(/\s+(AND|OR)\s+/i);
  const evalClause = (clause) => {
    const c = clause.replace(/[()]/g, '').trim();
    const notEmpty = c.match(/NOT\s+EMPTY\s*@?(\w+)/i) || c.match(/NOT\s+EMPTY\s+@?(\w+)/i);
    if (notEmpty) return isFilled(notEmpty[1]);
    const empty = c.match(/^\s*EMPTY\s*@?(\w+)/i) || c.match(/(?:^|\s)EMPTY\s+@?(\w+)/i);
    if (empty) return !isFilled(empty[1]);
    const lenGt = c.match(/Length\s*@?(\w+)\s*>\s*0/i);
    if (lenGt) return isFilled(lenGt[1]);
    return null; // unrecognized → neutral
  };

  let result = null;
  let nextOp = null;
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 1) {
      nextOp = tokens[i].toUpperCase();
      continue;
    }
    const val = evalClause(tokens[i]);
    if (val === null) continue; // skip unrecognized
    if (result === null) result = val;
    else if (nextOp === 'AND') result = result && val;
    else if (nextOp === 'OR') result = result || val;
    else result = val;
  }
  return result === null ? true : result; // conservative: unknown → render
}
