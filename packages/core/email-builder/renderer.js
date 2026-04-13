/**
 * packages/core/email-builder/renderer.js
 *
 * Phase 3: Render static HTML email variants from real MC blocks + content data.
 *
 * Takes block HTML (with AMPscript), a variable map, and block order,
 * then outputs complete, renderable HTML per variant.
 *
 * Extracted from tmp-mc-preview/generate-from-real-blocks.js — the working
 * prototype that generates all churn email variants.
 */

import { stripAmpscriptBlocks, replaceAmpscriptVars, splitBodyCopy } from './ampscript.js';

// ─── URL helper ──────────────────────────────────────────────────────
function fixUrl(url, market = 'uk/english') {
  if (!url) return '';
  return url.replace(/xx\/xx/g, market);
}

// ─── Image resolution helper ─────────────────────────────────────────
function resolveImg(imageMap, id) {
  if (!id) return '';
  const strId = String(id);
  return imageMap[strId] || `https://image.e.emiratesmail.com/lib/fe3b15707564047a7c1270/m/1/placeholder-${strId}.png`;
}

/**
 * Build a flat variable map from all content sources.
 * This maps AMPscript @variable names (without @) to their resolved values.
 *
 * Generalizes the buildVarContext() function from the churn prototype.
 *
 * @param {object} params
 * @param {object} params.subscriber - Subscriber data (first_name, TierName, etc.)
 * @param {object} params.headerContent - Header DE row
 * @param {object} params.footerContent - Footer DE row
 * @param {object} params.segmentContent - Dynamic content row for this segment
 * @param {Array} params.stories - Stories array from DE
 * @param {object} [params.caveat] - Caveat DE row
 * @param {object} [params.salutation] - Salutation DE row
 * @param {Record<string, string>} params.imageMap - Image ID → CDN URL map
 * @param {string} [params.market='uk/english'] - Market for URL replacement
 * @returns {object} Flat key-value map for replaceAmpscriptVars
 */
export function buildVariableMap({
  subscriber = {},
  headerContent,
  footerContent,
  segmentContent,
  stories = [],
  caveat,
  salutation,
  imageMap = {},
  market = 'uk/english',
}) {
  const vars = {};
  const img = (id) => resolveImg(imageMap, id);
  const url = (u) => fixUrl(u, market);

  // ── Subscriber data ──
  Object.assign(vars, subscriber);

  // ── Header ──
  if (headerContent) {
    Object.entries(headerContent).forEach(([k, v]) => { vars[k] = v; });
    if (headerContent.header_logo) vars.header_logo = img(headerContent.header_logo);
    if (headerContent.header_login_logo) vars.header_login_logo = img(headerContent.header_login_logo);
    for (const k of ['header_logo_link', 'header_login_link', 'join_skw_link']) {
      if (vars[k]) vars[k] = url(vars[k]);
    }
  }

  // ── Segment dynamic content ──
  if (segmentContent) {
    const dc = segmentContent;
    Object.entries(dc).forEach(([k, v]) => { vars[k] = v; });

    // Preheader
    vars.Preheader = dc.preheader || '';

    // Body link
    if (dc.body_link) vars.body_link = url(dc.body_link);
    vars.link = url(dc.body_link || '');
    vars.cta = dc.body_cta || '';
    vars.link_alias = dc.body_link_alias || '';

    // Section titles
    vars.section_title1 = dc.section_title1 || '';
    vars.section_title2 = dc.section_title2 || '';
    vars.section_title = dc.section_title1 || '';

    // Body copy with link splitting
    const salText = salutation?.salutation
      ? salutation.salutation.replace('{first_name}', subscriber.first_name || '')
      : '';
    const fullBody = salText + (dc.body_copy || '');
    vars.body_copy = fullBody;
    vars.body_copy_salutation = salText;

    const split = splitBodyCopy(fullBody, {
      ...dc,
      link1: url(dc.link1 || ''), link2: url(dc.link2 || ''),
      link3: url(dc.link3 || ''), link4: url(dc.link4 || ''),
    });
    Object.assign(vars, split);

    // Link variables for the body_copy block template
    vars.Link1 = url(dc.link1 || '');
    vars.Link2 = url(dc.link2 || '');
    vars.Link3 = url(dc.link3 || '');
    vars.Link4 = url(dc.link4 || '');
    vars.link1_text = dc.link1_text || '';
    vars.link2_text = dc.link2_text || '';
    vars.link3_text = dc.link3_text || '';
    vars.link4_text = dc.link4_text || '';
    vars.AliasLink1 = dc.aliaslink1 || '';
    vars.AliasLink2 = dc.aliaslink2 || '';
    vars.AliasLink3 = dc.aliaslink3 || '';
    vars.AliasLink4 = dc.aliaslink4 || '';

    // ── Stories 1-3 (3-column circle images) ──
    for (let i = 1; i <= 3; i++) {
      const storyName = dc[`story${i}`];
      const story = findStory(stories, storyName);
      if (story) {
        vars[`story${i}_image`] = img(story.story_image_circle || story.story_image);
        vars[`story${i}_header`] = story.story_header || '';
        vars[`story${i}_body`] = url(story.story_body || '');
        vars[`story${i}_link`] = url(story.story_url || '');
        vars[`story${i}_alias`] = story.story_alias || '';
      }
    }

    // ── Stories 4-6 (second 3-column block, mapped to set2 vars) ──
    if (dc.story4 && dc.story5 && dc.story6) {
      for (let i = 4; i <= 6; i++) {
        const storyName = dc[`story${i}`];
        const story = findStory(stories, storyName);
        if (story) {
          const idx = i - 3;
          vars[`story${idx}_set2_image`] = img(story.story_image_circle || story.story_image);
          vars[`story${idx}_set2_header`] = story.story_header || '';
          vars[`story${idx}_set2_body`] = url(story.story_body || '');
          vars[`story${idx}_set2_link`] = url(story.story_url || '');
          vars[`story${idx}_set2_alias`] = story.story_alias || '';
        }
      }
    }

    // ── Cash+Miles story (story_left_circle block) ──
    const cashStory = findStory(stories, dc.cash_miles);
    if (cashStory) {
      vars.story_left_circle_image = img(cashStory.story_image_circle || cashStory.story_image);
      vars.story_left_circle_header = cashStory.story_header || '';
      vars.story_left_circle_body = url(cashStory.story_body || '');
      vars.story_left_circle_cta = cashStory.story_cta || '';
      vars.story_left_circle_link = url(cashStory.story_url || '');
      vars.story_left_circle_alias = cashStory.story_alias || '';
    }

    // ── Destination/inspiration story (single_story_left block) ──
    const destStory = findStory(stories, dc.destination_generic);
    if (destStory) {
      vars.story_single_image = img(destStory.story_image_single || destStory.story_image);
      vars.story_single_header = destStory.story_header || '';
      vars.story_single_subheader = destStory.story_subheader || '';
      vars.story_single_body = url(destStory.story_body || '');
      vars.story_single_cta = destStory.story_cta || '';
      vars.story_single_link = url(destStory.story_url || '');
      vars.story_single_link_alias = destStory.story_alias || '';
    }
  }

  // ── Footer ──
  if (footerContent) {
    Object.entries(footerContent).forEach(([k, v]) => { vars[k] = v; });
    if (footerContent.logo_image) vars.logo_image = img(footerContent.logo_image);
    for (const k of ['logo_link', 'unsub_link', 'contactus_link', 'privacy_link']) {
      if (vars[k]) vars[k] = url(vars[k]);
    }
    if (vars.copywrite) {
      vars.copywrite = vars.copywrite.replace('{current_year}', String(new Date().getFullYear()));
    }
  }

  // ── Caveat ──
  if (caveat) {
    vars.caveat_terms = url(caveat.caveat_terms6 || caveat.caveat_terms1 || '');
  }

  return vars;
}

/**
 * Find a story by name in the stories array.
 */
function findStory(stories, storyName) {
  if (!storyName || !stories) return null;
  return stories.find(s => s.story_name === storyName) || null;
}

/**
 * Render a single block: strip AMPscript, replace variables.
 *
 * @param {string} blockHtml - Raw block HTML from Content Builder
 * @param {object} vars - Flat variable map
 * @returns {string} Clean HTML
 */
export function renderBlock(blockHtml, vars) {
  if (!blockHtml) return '';
  let html = stripAmpscriptBlocks(blockHtml);
  html = replaceAmpscriptVars(html, vars);
  return html;
}

/**
 * Render the body copy block with pre-rendered inline links.
 * The body_copy block uses complex AMPscript link splitting that
 * can't be resolved by simple variable replacement.
 *
 * @param {object} vars - Variable map with Link1-4, link1_text-4, before_link1, etc.
 * @returns {string} Rendered body copy HTML
 */
export function renderBodyCopyBlock(vars) {
  let bodyHtml = vars.before_link1 || '';

  const links = [
    { url: vars.Link1, text: vars.link1_text, glue: vars.glue12, between: vars.between_link1_2 },
    { url: vars.Link2, text: vars.link2_text, glue: vars.glue23, between: vars.between_link2_3 },
    { url: vars.Link3, text: vars.link3_text, glue: vars.glue34, between: vars.between_link3_4 },
    { url: vars.Link4, text: vars.link4_text, glue: vars.glue4e, between: '' },
  ];

  for (const link of links) {
    if (link.url && link.text) {
      bodyHtml += `<a href="${link.url}" style="text-decoration:none;" target="_blank"><span style="color:#000000; font-weight:600;">${link.text}</span></a>${link.glue || ''}`;
    }
    if (link.between) bodyHtml += link.between;
  }

  bodyHtml += vars.after_last_link || '';

  // Wrap in the standard body copy table structure
  return `<table cellpadding="0" cellspacing="0" width="100%" role="presentation" style="min-width: 100%; " class="stylingblock-content-wrapper"><tr><td class="stylingblock-content-wrapper camarker-inner"><!-- START BODY COPY --><table align="center" aria-hidden="true" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 842px;" width="100%">
  <tr>
   <td align="center" style="text-align: center;" valign="top">
    <table align="center" aria-hidden="true" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 842px;" width="100%">
      <tr>
       <td align="center" style="padding-left: 10px; padding-right: 10px;" valign="top">
        <!--[if mso]>
<table role="presentation" aria-hidden="true" cellspacing="0" cellpadding="0" border="0" width="622" align="center"><tr><td>
<![endif]--><table align="center" aria-hidden="true" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 642px; margin: 0 auto;" width="100%">
          <tr>
           <td align="center" style="font-family: HelveticaNeue-Light, Helvetica Neue Light, Helvetica, Arial, sans-serif; font-weight: 300; font-size: 14px; color: #151515; line-height: 22px; text-align: center;" valign="top">
            ${bodyHtml}</td></tr><tr>
           <td align="left" height="25" style="font-size:0%; line-height:100%;" valign="top">
           </td></tr></table><!--[if mso]>
</td></tr></table>
<![endif]--></td></tr></table></td></tr></table><!-- END BODY COPY --></td></tr></table>`;
}

/**
 * Render the 3-column story block, optionally remapping set2 vars.
 *
 * @param {string} blockHtml - The 3-column block template HTML
 * @param {object} vars - Variable map
 * @param {number} [storySet=1] - 1 for stories 1-3, 2 for stories 4-6
 * @returns {string} Rendered HTML
 */
export function renderThreeColumnBlock(blockHtml, vars, storySet = 1) {
  const localVars = { ...vars };

  if (storySet === 2) {
    for (let i = 1; i <= 3; i++) {
      localVars[`story${i}_image`] = vars[`story${i}_set2_image`] || '';
      localVars[`story${i}_header`] = vars[`story${i}_set2_header`] || '';
      localVars[`story${i}_body`] = vars[`story${i}_set2_body`] || '';
      localVars[`story${i}_link`] = vars[`story${i}_set2_link`] || '';
      localVars[`story${i}_alias`] = vars[`story${i}_set2_alias`] || '';
    }
  }

  return renderBlock(blockHtml, localVars);
}

/**
 * Render a single email variant — the full assembly pipeline.
 *
 * @param {object} params
 * @param {Record<string, {html: string, name?: string}>} params.blocks - Block ID → {html}
 * @param {object} params.vars - Flat variable map (from buildVariableMap)
 * @param {string[]} params.blockOrder - Ordered block IDs for this variant
 * @param {string} params.templateShell - Outer HTML wrapper with {{CONTENT}} placeholder
 * @param {string} [params.preheader] - Preheader text
 * @param {object} [params.bodyBlockId] - Block ID for the body copy (uses custom renderer)
 * @param {object} [params.threeColBlockId] - Block ID for 3-column stories
 * @returns {string} Complete, renderable HTML
 */
export function renderVariant({
  blocks,
  vars,
  blockOrder,
  templateShell,
  preheader,
  bodyBlockId,
  threeColBlockId,
}) {
  const parts = [];

  // Preheader (hidden div)
  if (preheader) {
    parts.push(`<div style="font-size:0px;line-height:1px;mso-line-height-rule:exactly;display:none;max-width:0px;max-height:0px;opacity:0;overflow:hidden;mso-hide:all;">\n${preheader}\n</div>`);
  }

  // Assemble blocks in order
  for (const blockId of blockOrder) {
    const block = blocks[blockId];
    if (!block?.html) continue;

    // Body copy block needs special rendering (link splitting)
    // Auto-detect: the body copy block contains @before_link1 / TreatAsContent(@before_link1)
    const isBodyCopyBlock = bodyBlockId
      ? blockId === bodyBlockId
      : block.html.includes('@before_link1') || block.html.includes('before_link1');
    if (isBodyCopyBlock) {
      parts.push(renderBodyCopyBlock(vars));
      continue;
    }

    // 3-column block might need story set remapping
    // (handled externally via renderThreeColumnBlock when needed)

    parts.push(renderBlock(block.html, vars));
  }

  const content = parts.filter(Boolean).join('\n\n');

  // Insert into template shell
  if (templateShell) {
    return templateShell.replace('{{CONTENT}}', content);
  }
  return content;
}

/**
 * Generate all email variants for a campaign.
 *
 * @param {object} params
 * @param {object} params.manifest - From analyzeTemplate()
 * @param {object} params.data - From fetchCampaignData() { blocks, deData, imageMap }
 * @param {object} params.subscriber - Preview subscriber data
 * @param {string} params.templateShell - Template wrapper HTML with {{CONTENT}}
 * @param {object} [params.options]
 * @param {string} [params.options.market='uk/english']
 * @returns {Record<string, string>} Map of filename → rendered HTML
 */
export function renderAllVariants({ manifest, data, subscriber, templateShell, options = {} }) {
  const { blocks, deData, imageMap } = data;
  const market = options.market || 'uk/english';
  const results = {};

  // Find the main dynamic content DE
  const dynamicContentDE = Object.entries(deData).find(
    ([name]) => !name.toLowerCase().includes('header')
      && !name.toLowerCase().includes('footer')
      && !name.toLowerCase().includes('stories')
      && !name.toLowerCase().includes('caveat')
      && !name.toLowerCase().includes('salutation')
      && !name.toLowerCase().includes('ref_')
  );

  if (!dynamicContentDE) {
    throw new Error('No dynamic content DE found in fetched data');
  }

  const [dcName, dcRows] = dynamicContentDE;
  const headerRows = Object.entries(deData).find(([n]) => n.toLowerCase().includes('header'))?.[1] || [];
  const footerRows = Object.entries(deData).find(([n]) => n.toLowerCase().includes('footer'))?.[1] || [];
  const storiesRows = Object.entries(deData).find(([n]) => n.toLowerCase().includes('stories') || n.toLowerCase().includes('story'))?.[1] || [];
  const caveatRows = Object.entries(deData).find(([n]) => n.toLowerCase().includes('caveat'))?.[1] || [];
  const salutationRows = Object.entries(deData).find(([n]) => n.toLowerCase().includes('salutation'))?.[1] || [];

  const headerContent = headerRows[0] || null;
  const footerContent = footerRows[0] || null;
  const caveat = caveatRows[0] || null;
  const salutation = salutationRows[0] || null;

  // Get segments from manifest or from data
  let segments = manifest.variants.segments.length > 0
    ? manifest.variants.segments
    : [...new Set(dcRows.map(r => (r.segment || r.Segment || '').toLowerCase()).filter(Boolean))];

  // If no segments found, treat each DC row as a variant (or single if only 1 row)
  if (segments.length === 0) {
    segments = ['default'];
  }

  // Detect header types: from manifest, or by checking if fetcher created {id}_skw/{id}_ebase variants
  let headerTypes = manifest.variants.headerTypes.length > 0
    ? manifest.variants.headerTypes
    : ['default'];

  if (headerTypes.length <= 1) {
    const blockKeys = Object.keys(blocks);
    const hasSkw = blockKeys.some(k => k.endsWith('_skw'));
    const hasEbase = blockKeys.some(k => k.endsWith('_ebase'));
    if (hasSkw && hasEbase) {
      headerTypes = ['skw', 'ebase'];
    }
  }

  // Generate each variant
  for (const segment of segments) {
    const segmentContent = segment === 'default'
      ? dcRows[0] || {}
      : dcRows.find(r => (r.segment || r.Segment || '').toLowerCase() === segment);
    if (!segmentContent) continue;

    for (const headerType of headerTypes) {
      const vars = buildVariableMap({
        subscriber,
        headerContent,
        footerContent,
        segmentContent,
        stories: storiesRows,
        caveat,
        salutation,
        imageMap,
        market,
      });

      // Determine block order for this variant
      const blockOrder = manifest.blockOrder.allBlocks || manifest.blockOrder.default || [];

      // Build variant-specific blocks map — swap header blocks by headerType
      // The fetcher stores header variants as {id}_skw and {id}_ebase
      const variantBlocks = { ...blocks };
      for (const blockId of blockOrder) {
        const variantKey = `${blockId}_${headerType}`;
        if (variantKey in blocks) {
          variantBlocks[blockId] = blocks[variantKey];
        }
      }

      let filename;
      if (segments.length === 1 && headerTypes.length === 1) {
        filename = 'email.html';
      } else if (headerTypes.length > 1 && segments.length > 1) {
        filename = `${segment}_${headerType}.html`;
      } else if (headerTypes.length > 1) {
        filename = `${headerType}.html`;
      } else {
        filename = `${segment}.html`;
      }

      results[filename] = renderVariant({
        blocks: variantBlocks,
        vars,
        blockOrder,
        templateShell,
        preheader: vars.Preheader,
      });
    }
  }

  return results;
}
