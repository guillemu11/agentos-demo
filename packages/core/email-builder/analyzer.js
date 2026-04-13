/**
 * packages/core/email-builder/analyzer.js
 *
 * Phase 1: Analyze an AMPscript email template to produce a campaign manifest.
 *
 * The manifest describes everything needed to fetch data and render variants:
 * - Which Content Builder blocks are referenced (by ID)
 * - Which Data Extensions are queried (by name)
 * - What variables exist and how they map to DE fields
 * - What segment/header variants exist
 * - The block assembly order per layout type
 */

import {
  parseContentBlockRefs,
  parseDELookups,
  parseVariableDeclarations,
} from './ampscript.js';

/**
 * Analyze an AMPscript template and return a structured campaign manifest.
 * @param {string} templateHtml - Full AMPscript HTML template
 * @returns {object} Campaign manifest
 */
export function analyzeTemplate(templateHtml) {
  const contentBlockIds = parseContentBlockRefs(templateHtml);

  const dataExtensions = parseDELookups(templateHtml).map(name => ({
    name,
    lookupFields: extractLookupFields(templateHtml, name),
  }));

  const variables = parseVariableDeclarations(templateHtml);
  const variants = detectVariants(templateHtml);
  const blockOrder = detectBlockOrder(templateHtml, variants);

  const vawp = detectVAWP(templateHtml);

  return { contentBlockIds, dataExtensions, variables, variants, blockOrder, vawp };
}

/**
 * Detect the VAWP (View As Web Page) Data Extension configuration.
 * The VAWP DE contains subscriber/audience data that drives personalization.
 *
 * Parses patterns like:
 *   SET @VAWP_person_DE = 'Ebase_Email_Ask_VAWP'
 *   SET @country = Field(@VAWP_Row, 'Country_code')
 *   SET @first_name = Field(@VAWP_Row, 'first_name')
 */
function detectVAWP(html) {
  // Find the VAWP DE name
  const deMatch = html.match(/SET\s+@VAWP_person_DE\s*=\s*['"]([^'"]+)['"]/i);
  if (!deMatch) return null;

  // Find fields read from VAWP
  const vawpFields = [...html.matchAll(/Field\(\s*@VAWP_Row\s*,\s*['"](\w+)['"]\)/gi)];
  // Also find direct attribute reads (ELSE branch)
  const directFields = [...html.matchAll(/SET\s+@(\w+)\s*=\s*(?:Trim\s*\(\s*)?(?:Propercase\s*\(\s*)?(\w+)\s*\)/gi)]
    .filter(m => !m[2].startsWith('@') && !['Trim', 'Propercase', 'Uppercase', 'Lowercase', 'Field', 'Lookup', 'Row'].includes(m[2]));

  // Find Culture_code → language mapping DE
  const langRefMatch = html.match(/Lookup\(\s*['"](?:ENT\.)?([^'"]+)['"]\s*,\s*['"](?:per_language|Content_code)['"]\s*,\s*['"]Lang_ID_code['"]/i);

  return {
    deName: deMatch[1],
    fields: [...new Set([
      ...vawpFields.map(m => m[1]),
      ...directFields.map(m => m[2]),
    ])],
    languageRefDE: langRefMatch?.[1] || null,
  };
}

/**
 * Extract the lookup key fields used in LookupRows for a specific DE.
 * e.g. LookupRows('DE_Name', 'language', @lm_code) → ['language']
 */
function extractLookupFields(html, deName) {
  const escaped = deName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `Lookup(?:Ordered)?Rows\\s*\\(\\s*'${escaped}'\\s*,\\s*'(\\w+)'`,
    'gi'
  );
  const fields = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) {
    fields.add(m[1]);
  }
  return [...fields];
}

/**
 * Detect segment-based and header-type variants from IF conditions.
 *
 * Looks for patterns like:
 *   IF @Segment == 'preventionindirect'
 *   IF @headerver == 'skw'
 */
function detectVariants(html) {
  const result = {
    segmentField: null,
    segments: [],
    headerTypes: [],
  };

  // Find @Segment == 'xxx' patterns (case-insensitive values)
  const segRegex = /@Segment\s*==\s*'([^']+)'/gi;
  const segs = new Set();
  let m;
  while ((m = segRegex.exec(html)) !== null) {
    segs.add(m[1].toLowerCase());
  }
  if (segs.size > 0) {
    result.segmentField = 'Segment';
    result.segments = [...segs];
  }

  // Header types: detect from @headerver variable or ebase_subscriber_flag pattern
  if (html.includes('@headerver')) {
    const headerRegex = /@headerver\s*==\s*'([^']+)'/gi;
    const types = new Set();
    while ((m = headerRegex.exec(html)) !== null) {
      types.add(m[1].toLowerCase());
    }
    result.headerTypes = types.size > 0 ? [...types] : ['skw', 'ebase'];
  } else if (html.includes('ebase_subscriber_flag')) {
    // Emirates pattern: ebase_subscriber_flag determines header type
    result.headerTypes = ['skw', 'ebase'];
  }

  return result;
}

/**
 * Detect block assembly order from the render section of the template.
 *
 * The template typically has two sections:
 * 1. Variable declarations (SET @var = ...) — first half
 * 2. Render section (ContentBlockbyID calls) — second half
 *
 * We extract the render section's block order.
 */
function detectBlockOrder(html, variants) {
  // Find all ContentBlockbyID references with their positions
  const blockRefs = [];
  const refPattern = /%%=ContentBlockbyID\(["'](\d+)["']\)=%%/gi;
  let m;
  while ((m = refPattern.exec(html)) !== null) {
    blockRefs.push({ id: m[1], position: m.index });
  }

  // The render section is in the second half of the template (after SET declarations)
  const midpoint = html.length * 0.4;
  const renderBlocks = blockRefs
    .filter(b => b.position > midpoint)
    .sort((a, b) => a.position - b.position)
    .map(b => b.id);

  // Deduplicate while preserving order
  const seen = new Set();
  const uniqueRenderBlocks = renderBlocks.filter(id => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Detect layout groups based on conditional blocks
  // Look for IF blocks that contain ContentBlockbyID to determine layout branching
  const layoutGroups = detectLayoutGroups(html);

  return {
    allBlocks: uniqueRenderBlocks,
    layoutGroups,
    // For campaigns without detected groups, use flat order
    default: uniqueRenderBlocks,
  };
}

/**
 * Detect layout groups — blocks that appear inside IF/ELSE conditions.
 * This captures patterns like:
 *   IF @Segment == 'prevention...' THEN → show inspiration before CTA
 *   ELSE → show CTA before inspiration
 */
function detectLayoutGroups(html) {
  const groups = [];

  // Find IF blocks with their contained ContentBlockbyID calls
  // Pattern: IF @Segment == '...' ... THEN ... ContentBlockbyID ... ELSE ... ContentBlockbyID ... ENDIF
  const ifPattern = /IF\s+@(\w+)\s*==\s*'([^']+)'[\s\S]*?ENDIF/gi;
  let m;
  while ((m = ifPattern.exec(html)) !== null) {
    const ifBlock = m[0];
    const field = m[1];
    const value = m[2];

    // Check if this IF block contains ContentBlockbyID calls
    const blockRefs = [];
    const refPattern = /ContentBlockbyID\(["'](\d+)["']\)/gi;
    let bm;
    while ((bm = refPattern.exec(ifBlock)) !== null) {
      blockRefs.push(bm[1]);
    }

    if (blockRefs.length > 0) {
      groups.push({
        condition: { field, value: value.toLowerCase() },
        blocks: [...new Set(blockRefs)],
      });
    }
  }

  return groups;
}
