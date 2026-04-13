/**
 * packages/core/email-builder/ampscript.js
 * Pure functions for AMPscript parsing and variable replacement.
 * Zero external dependencies, ES modules.
 */

/**
 * Clean a template shell by resolving language conditionals to English/LTR
 * and stripping remaining AMPscript. Use this for the outer email wrapper.
 *
 * Handles patterns like:
 *   %%[IF @template_language == 'ARABIC' THEN]%%dir="rtl"%%[ELSE]%%dir="ltr"%%[ENDIF]%%
 *   %%[IF @language == 'ARABIC' THEN]%%right%%[ELSE]%%left%%[ENDIF]%%
 *
 * @param {string} html - Template shell HTML with AMPscript conditionals
 * @returns {string} Clean HTML (English/LTR defaults)
 */
export function cleanTemplateShell(html) {
  if (!html) return '';

  let result = html;

  // Resolve inline IF/ELSE conditionals — keep the ELSE branch (non-Arabic = English/LTR)
  result = result.replace(
    /%%\[IF\s+@\w+\s*==\s*['"]ARABIC['"]\s*THEN\]%%([^%]*)%%\[ELSE\]%%([^%]*)%%\[ENDIF\]%%/gi,
    '$2'
  );

  // Generic single-line IF/THEN/ELSE: keep the ELSE value
  result = result.replace(
    /%%\[IF\s+[^\]]*THEN\]%%([^%]*)%%\[ELSE\]%%([^%]*)%%\[ENDIF\]%%/gi,
    '$2'
  );

  // Strip remaining %%[...]%% blocks
  result = result.replace(/%%\[[\s\S]*?\]%%/g, '');
  // Strip %%=...=%% inline expressions
  result = result.replace(/%%=[^%]*=%%/g, '');
  // Strip any remaining %% markers
  result = result.replace(/%%[^%]*%%/g, '');

  return result;
}

/**
 * Remove all AMPscript executable blocks and inline references from HTML.
 * Strips:
 *   - %%[...]%% blocks (multiline, including SET / IF / ELSE / ENDIF)
 *   - %%=ContentBlockbyID(...)=%% (case-insensitive)
 *   - %%=BeginImpressionRegion(...)=%%
 *   - %%=EndImpressionRegion()=%%
 *   - %%=TreatAsContent(concat(...))=%%
 *
 * @param {string} html
 * @returns {string}
 */
export function stripAmpscriptBlocks(html) {
  if (!html) return '';

  let result = html;

  // %%[ ... ]%% blocks — multiline
  result = result.replace(/%%\[[\s\S]*?\]%%/g, '');

  // %%=ContentBlockbyID("...")=%% — case-insensitive
  result = result.replace(/%%=ContentBlock(?:by|By)ID\([^)]*\)=%%/gi, '');

  // %%=BeginImpressionRegion(...)=%%
  result = result.replace(/%%=BeginImpressionRegion\([^)]*\)=%%/gi, '');

  // %%=EndImpressionRegion()=%%
  result = result.replace(/%%=EndImpressionRegion\(\)=%%/gi, '');

  // %%=TreatAsContent(concat(...))=%% — may span nested parens
  result = result.replace(/%%=TreatAsContent\(concat\([\s\S]*?\)\)=%%/gi, '');

  return result;
}

/**
 * Replace AMPscript variable references and clean remaining markers.
 *
 * Replacements:
 *   - %%=v(@variable)=%%      → vars[variable] (strip the @)
 *   - %%=RedirectTo(@url)=%%  → vars[url]
 *   - %%=TreatAsContent(@html)=%% → vars[html]
 *   - %%view_email_url%%      → viewEmailUrl
 *   - alias="..." attributes  → removed
 *   - remaining %%...%%       → empty string
 *
 * @param {string} html
 * @param {Object} vars  — key→value map (keys without @)
 * @param {string} [viewEmailUrl]
 * @returns {string}
 */
export function replaceAmpscriptVars(
  html,
  vars = {},
  viewEmailUrl = 'https://www.emirates.com/uk/english/home'
) {
  if (!html) return '';

  let result = html;

  // %%=v(@varName)=%%
  result = result.replace(/%%=v\(@([a-zA-Z0-9_]+)\)=%%/g, (_, name) => {
    const val = vars[name];
    return val !== undefined ? val : '';
  });

  // %%=RedirectTo(@varName)=%%
  result = result.replace(/%%=RedirectTo\(@([a-zA-Z0-9_]+)\)=%%/gi, (_, name) => {
    const val = vars[name];
    return val !== undefined ? val : '';
  });

  // %%=TreatAsContent(@varName)=%% — single variable (not concat)
  result = result.replace(/%%=TreatAsContent\(@([a-zA-Z0-9_]+)\)=%%/gi, (_, name) => {
    const val = vars[name];
    return val !== undefined ? val : '';
  });

  // %%view_email_url%%
  result = result.replace(/%%view_email_url%%/gi, viewEmailUrl);

  // alias="..." attributes (with single or double quotes)
  result = result.replace(/\s*alias=["'][^"']*["']/gi, '');

  // Resolve inline IF/ELSE conditionals (e.g., %%[IF @x == 'ARABIC' THEN]%%right%%[ELSE]%%left%%[ENDIF]%%)
  // These appear in template shells for RTL/LTR. We keep the ELSE branch (non-Arabic = LTR).
  result = result.replace(
    /%%\[IF\s+@\w+\s*==\s*['"]ARABIC['"]\s*THEN\]%%([^%]*)%%\[ELSE\]%%([^%]*)%%\[ENDIF\]%%/gi,
    '$2'
  );
  // Generic IF/THEN/ELSE: keep the ELSE value (safer default)
  result = result.replace(
    /%%\[IF\s+[^\]]*THEN\]%%([^%]*)%%\[ELSE\]%%([^%]*)%%\[ENDIF\]%%/gi,
    '$2'
  );

  // any remaining %% markers
  result = result.replace(/%%[^%]*%%/g, '');

  return result;
}

/**
 * Split a body-copy string around up to four link markers.
 *
 * The dc object may carry: link1..link4, link1_text..link4_text, aliaslink1..aliaslink4.
 * Markers in bodyCopy are expected as plain strings like "{link1}", "{link2}", etc.
 * If no markers are present the whole body is returned in before_link1.
 *
 * Returned shape:
 *   before_link1, between_link1_2, between_link2_3, between_link3_4, after_last_link
 *   Link1_html .. Link4_html
 *   glue12, glue23, glue34, glue4e   (space if following segment starts with alphanum)
 *
 * @param {string} bodyCopy
 * @param {Object} dc
 * @returns {Object}
 */
export function splitBodyCopy(bodyCopy, dc = {}) {
  const LINK_STYLE = 'color:#333333; text-decoration:none;';

  /** Build an <a> tag for link index 1-4 */
  function buildLinkHtml(i) {
    const url = dc[`link${i}`] || '';
    const text = dc[`link${i}_text`] || '';
    if (!url && !text) return '';
    return `<a href="${url}" style="${LINK_STYLE}" target="_blank">${text}</a>`;
  }

  /** Return a space if the string starts with a word character, else '' */
  function glue(str) {
    if (!str) return '';
    return /^\w/.test(str.trimStart()) ? ' ' : '';
  }

  const markers = ['{link1}', '{link2}', '{link3}', '{link4}'];
  const segments = [];
  let remaining = bodyCopy || '';

  for (let i = 0; i < 4; i++) {
    const idx = remaining.indexOf(markers[i]);
    if (idx === -1) {
      segments.push(remaining);
      for (let j = i + 1; j <= 4; j++) segments.push('');
      remaining = null;
      break;
    }
    segments.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx + markers[i].length);
  }
  if (remaining !== null) segments.push(remaining);

  // Ensure we always have 5 segments (before + 4 gaps)
  while (segments.length < 5) segments.push('');

  const [before_link1, between_link1_2, between_link2_3, between_link3_4, after_last_link] =
    segments;

  const Link1_html = buildLinkHtml(1);
  const Link2_html = buildLinkHtml(2);
  const Link3_html = buildLinkHtml(3);
  const Link4_html = buildLinkHtml(4);

  return {
    before_link1,
    between_link1_2,
    between_link2_3,
    between_link3_4,
    after_last_link,
    Link1_html,
    Link2_html,
    Link3_html,
    Link4_html,
    glue12: glue(between_link1_2),
    glue23: glue(between_link2_3),
    glue34: glue(between_link3_4),
    glue4e: glue(after_last_link),
  };
}

/**
 * Extract all unique ContentBlockbyID IDs from an AMPscript string.
 *
 * @param {string} ampscript
 * @returns {string[]}  unique IDs
 */
export function parseContentBlockRefs(ampscript) {
  if (!ampscript) return [];
  const re = /%%=ContentBlock(?:by|By)ID\(["'](\d+)["']\)=%%/gi;
  const ids = new Set();
  let m;
  while ((m = re.exec(ampscript)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * Extract unique DE (Data Extension) names from LookupRows / LookupOrderedRows calls.
 *
 * Handles both string literals ('DE_NAME') and variable references (@var) — only
 * string-literal names are returned (variable references are skipped).
 *
 * @param {string} ampscript
 * @returns {string[]}
 */
export function parseDELookups(ampscript) {
  if (!ampscript) return [];
  // Match LookupRows('Name', ...) or LookupOrderedRows('Name', ...)
  // First argument may use single or double quotes
  const re = /Lookup(?:Ordered)?Rows\s*\(\s*['"]([^'"]+)['"]/gi;
  const names = new Set();
  let m;
  while ((m = re.exec(ampscript)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * Extract variable-to-field mappings from `SET @var = Field(@Row, 'field_name')` patterns.
 *
 * @param {string} ampscript
 * @returns {Array<{variable: string, field: string}>}
 */
export function parseVariableDeclarations(ampscript) {
  if (!ampscript) return [];
  // SET @varName = Field(@anyRow, 'fieldName')
  const re = /SET\s+@([a-zA-Z0-9_]+)\s*=\s*Field\s*\(@[a-zA-Z0-9_]+\s*,\s*['"]([^'"]+)['"]\)/gi;
  const results = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(ampscript)) !== null) {
    const key = `${m[1]}:${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ variable: m[1], field: m[2] });
    }
  }
  return results;
}
