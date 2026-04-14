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

  // %%=ProperCase(varname)=%% / %%=Lowercase(varname)=%% / %%=Uppercase(varname)=%%
  // / %%=Trim(varname)=%% — AMPscript string transforms over a single var.
  // Also handles bare attribute names without the @ prefix (subscriber attrs).
  result = result.replace(
    /%%=\s*(ProperCase|Lowercase|Uppercase|Trim)\s*\(\s*@?([a-zA-Z0-9_]+)\s*\)\s*=%%/gi,
    (_, fn, name) => {
      const raw = vars[name];
      if (raw == null || raw === '') return '';
      const s = String(raw);
      switch (fn.toLowerCase()) {
        case 'lowercase': return s.toLowerCase();
        case 'uppercase': return s.toUpperCase();
        case 'trim': return s.trim();
        case 'propercase':
        default:
          return s.toLowerCase().replace(/(^|[\s\-'])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
      }
    }
  );

  // %%=Substring(varname, start, length)=%% — AMPscript string extraction.
  // Emirates uses this to pull tier name out of "2: Platinum" → "Platinum".
  result = result.replace(
    /%%=\s*Substring\s*\(\s*@?([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*=%%/gi,
    (_, name, start, length) => {
      const val = vars[name];
      if (val === undefined || val === null) return '';
      // AMPscript Substring is 1-indexed
      return String(val).substring(parseInt(start, 10) - 1, parseInt(start, 10) - 1 + parseInt(length, 10));
    }
  );

  // %%varname%% — subscriber personalization syntax (no = wrapping, no v()).
  // e.g., %%loy_skywards_mile_balance%%, %%first_name%%, %%MARKETCODE%%.
  result = result.replace(/%%([a-zA-Z_][a-zA-Z0-9_]*)%%/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      const val = vars[name];
      return val == null ? '' : String(val);
    }
    return match; // leave unknown tokens alone; final pass will strip
  });

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
  // Match Lookup('Name', ...), LookupRows('Name', ...) or LookupOrderedRows('Name', ...)
  // First argument may use single or double quotes
  const re = /Lookup(?:Ordered)?(?:Rows)?\s*\(\s*['"]([^'"]+)['"]/gi;
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

// ─── Positional renderer primitives ──────────────────────────────────
//
// Emirates templates frequently reference the same ContentBlockbyID at
// multiple positions, rebinding variables between occurrences — e.g.
// block 34287 (3-column stories) appears first bound to @story1_*,
// @story2_*, @story3_*, then again after SET @story1_image = @story11_image
// etc. to reuse the same HTML for stories 4-6. A deduplicating renderer
// cannot express this. The helpers below extract each block occurrence
// with the `IF` guards that enclose it and the `SET` rebindings that
// precede it since the last block position.
//
// Scope: handles the patterns actually used by Emirates (CHURN + BAU).
// Does NOT attempt to be a full AMPscript interpreter.

/**
 * Extract every ContentBlockbyID occurrence with its guard chain and
 * local SET rebindings.
 *
 * Algorithm:
 *   1. Walk the AMPscript `%%[...]%%` blocks + `%%=ContentBlockbyID=%%` tokens.
 *   2. Maintain a stack of open `IF`/`ELSE` conditions.
 *   3. Accumulate `SET` statements since the last ContentBlockbyID into
 *      localBindings.
 *   4. At each ContentBlockbyID, emit one instruction:
 *        { blockId, guards: [conditionStr...], localBindings: [{var, rhs}] }
 *      and reset the localBindings accumulator.
 *
 * @param {string} templateHtml
 * @returns {Array<{ blockId: string, guards: string[], localBindings: Array<{var: string, rhs: string}> }>}
 */
export function buildRenderInstructions(templateHtml) {
  if (!templateHtml) return [];

  const instructions = [];
  const guardStack = []; // strings; ELSE branch pushes a negated "!(..)" marker
  let localBindings = [];

  // Tokenize into ordered chunks:
  //   - `%%[ ... ]%%` control blocks (SET/IF/ELSE/ENDIF)
  //   - `%%=ContentBlockbyID("X")=%%` render tokens
  //   - everything else is ignored for walking purposes
  const tokenRe = /%%\[([\s\S]*?)\]%%|%%=ContentBlock(?:by|By)ID\(["'](\d+)["']\)=%%/gi;
  let m;
  while ((m = tokenRe.exec(templateHtml)) !== null) {
    if (m[2]) {
      // ContentBlockbyID token — emit an instruction
      instructions.push({
        blockId: m[2],
        guards: [...guardStack],
        localBindings,
      });
      localBindings = [];
      continue;
    }

    const body = m[1];
    // A single control block may contain multiple statements separated
    // by newlines or whitespace. Split into statement-level chunks.
    const statements = splitControlBlock(body);
    for (const stmt of statements) {
      processStatement(stmt, guardStack, localBindings);
    }
  }

  return instructions;
}

function splitControlBlock(body) {
  // Statements are usually on their own lines, but may share a line like
  //   "IF @x THEN SET @y = @z". We split on newlines first, then on the
  // obvious keyword boundaries.
  const out = [];
  const lines = body.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Preserve composite lines like "IF ... THEN SET @y = @z" — processor
    // extracts the IF head and the trailing SET.
    out.push(line);
  }
  return out;
}

function processStatement(stmt, guardStack, localBindings) {
  const s = stmt.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!s) return;

  // IF <cond> THEN [<trailing-stmt>?]
  const ifMatch = s.match(/^IF\s+([\s\S]+?)\s+THEN\b(.*)$/i);
  if (ifMatch) {
    guardStack.push(ifMatch[1].trim());
    const trailing = ifMatch[2].trim();
    if (trailing) processStatement(trailing, guardStack, localBindings);
    return;
  }

  // ELSEIF <cond> THEN
  const elseIfMatch = s.match(/^ELSEIF\s+([\s\S]+?)\s+THEN\b/i);
  if (elseIfMatch) {
    // Pop previous IF/ELSEIF branch condition, push negated-prev AND new
    if (guardStack.length > 0) guardStack.pop();
    guardStack.push(elseIfMatch[1].trim());
    return;
  }

  if (/^ELSE\b/i.test(s)) {
    // Replace top-of-stack with its negation so subsequent blocks evaluate
    // under the "else" branch. We don't attempt boolean algebra; we just
    // prefix with `!(..)` and the evaluator treats that as negation.
    if (guardStack.length > 0) {
      const prev = guardStack[guardStack.length - 1];
      guardStack[guardStack.length - 1] = `!(${prev})`;
    }
    return;
  }

  if (/^ENDIF\b/i.test(s)) {
    if (guardStack.length > 0) guardStack.pop();
    return;
  }

  // SET @var = <rhs>
  const setMatch = s.match(/^SET\s+@([a-zA-Z0-9_]+)\s*=\s*([\s\S]+)$/i);
  if (setMatch) {
    localBindings.push({ var: setMatch[1], rhs: setMatch[2].trim() });
    return;
  }
  // Ignore everything else (RowCount, Row, comments, expressions we don't track)
}

/**
 * Evaluate an AMPscript condition string against a variables map.
 *
 * Supports:
 *   - NOT EMPTY(@v) / EMPTY(@v)
 *   - Length(@v) > 0
 *   - @v == 'literal' / @v == "literal"
 *   - @v != 'literal'
 *   - AND / OR joins (flat, not boolean-algebra)
 *   - `!(inner)` prefix (from ELSE normalization in buildRenderInstructions)
 *   - RowCount(@v) > 0   → treats @v as non-empty value
 *
 * Unknown constructs return `null` → neutral (treated as TRUE to avoid
 * silently dropping blocks we don't yet understand).
 *
 * @param {string} condition
 * @param {Object} vars
 * @returns {boolean}
 */
export function evaluateGuard(condition, vars = {}) {
  if (!condition || typeof condition !== 'string') return true;

  // Negation wrapper from ELSE branch.
  const negMatch = condition.match(/^\s*!\(\s*([\s\S]+)\s*\)\s*$/);
  if (negMatch) return !evaluateGuard(negMatch[1], vars);

  const isFilled = (name) => {
    const v = vars[name];
    return v != null && String(v).trim().length > 0;
  };
  const getStr = (name) => {
    const v = vars[name];
    return v == null ? '' : String(v);
  };

  // Flat split on AND / OR (whitespace-bounded, case-insensitive)
  const tokens = condition.split(/\s+(AND|OR|and|or)\s+/);
  const evalClause = (rawClause) => {
    const c = rawClause.replace(/^\(+|\)+$/g, '').trim();
    if (!c) return null;
    let m;
    // NOT EMPTY(@x) / NOT EMPTY @x
    m = c.match(/^NOT\s+EMPTY\s*\(\s*@?([a-zA-Z0-9_]+)\s*\)\s*$/i) ||
        c.match(/^NOT\s+EMPTY\s+@?([a-zA-Z0-9_]+)\s*$/i);
    if (m) return isFilled(m[1]);
    // EMPTY(@x)
    m = c.match(/^EMPTY\s*\(\s*@?([a-zA-Z0-9_]+)\s*\)\s*$/i) ||
        c.match(/^EMPTY\s+@?([a-zA-Z0-9_]+)\s*$/i);
    if (m) return !isFilled(m[1]);
    // Length(@x) > 0
    m = c.match(/^Length\s*\(\s*@?([a-zA-Z0-9_]+)\s*\)\s*>\s*0\s*$/i);
    if (m) return isFilled(m[1]);
    // RowCount(@x) > 0  (treat any truthy value as "has rows")
    m = c.match(/^RowCount\s*\(\s*@?([a-zA-Z0-9_]+)\s*\)\s*>\s*0\s*$/i);
    if (m) return isFilled(m[1]);
    // @x == 'literal' or "literal"
    m = c.match(/^@?([a-zA-Z0-9_]+)\s*==\s*['"]([^'"]*)['"]\s*$/);
    if (m) return getStr(m[1]).toLowerCase() === m[2].toLowerCase();
    // @x != 'literal'
    m = c.match(/^@?([a-zA-Z0-9_]+)\s*(?:!=|<>)\s*['"]([^'"]*)['"]\s*$/);
    if (m) return getStr(m[1]).toLowerCase() !== m[2].toLowerCase();
    return null;
  };

  let result = null;
  let nextOp = null;
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 1) {
      nextOp = tokens[i].toUpperCase();
      continue;
    }
    const val = evalClause(tokens[i]);
    if (val === null) continue;
    if (result === null) result = val;
    else if (nextOp === 'AND') result = result && val;
    else if (nextOp === 'OR') result = result || val;
    else result = val;
  }
  return result === null ? true : result;
}

/**
 * Resolve a single SET RHS expression against a variables map.
 *
 * Handled patterns (everything else → empty string):
 *   @var               → vars[var]
 *   'literal' / "lit"  → literal
 *   @x                 (wrapped in parens / mixed whitespace)
 *
 * Complex expressions (Concat, IIF, Substring, nested Lookup, etc.) are
 * intentionally NOT evaluated here — the global `buildVariableMap` has
 * already produced concrete values for those; local bindings in Emirates
 * templates are almost always simple "SET @a = @b" rebindings.
 *
 * @param {string} rhs
 * @param {Object} vars
 * @returns {string}
 */
export function resolveSetRhs(rhs, vars = {}) {
  if (rhs == null) return undefined;
  const s = String(rhs).trim();
  // String literal
  const litMatch = s.match(/^['"]([\s\S]*)['"]\s*$/);
  if (litMatch) return litMatch[1];
  // Single variable reference (optionally with surrounding whitespace)
  const varMatch = s.match(/^@([a-zA-Z0-9_]+)\s*$/);
  if (varMatch) return vars[varMatch[1]]; // undefined if not present
  // Anything else (Lookup/LookupRows/IIF/Concat/Substring/IndexOf etc.)
  // is beyond the scope of the positional mini-resolver — signal
  // "unresolvable" so the caller preserves the existing binding.
  return undefined;
}

/**
 * Apply a list of local bindings (from buildRenderInstructions) onto a
 * base variables map and return a new map. Does not mutate the input.
 *
 * Unresolvable RHS (LookupRows, IIF, Concat, …) does NOT overwrite the
 * current binding — that lets the caller pre-populate vars like
 * `Email_Content = '1'` from a real DE fetch without the positional
 * walker zapping it via an `SET @Email_Content = LookupRows(…)` it can't
 * evaluate.
 *
 * @param {Object} baseVars
 * @param {Array<{var: string, rhs: string}>} bindings
 * @returns {Object}
 */
export function applyLocalBindings(baseVars, bindings) {
  if (!bindings || bindings.length === 0) return baseVars;
  const out = { ...baseVars };
  for (const b of bindings) {
    const resolved = resolveSetRhs(b.rhs, out);
    if (resolved !== undefined) out[b.var] = resolved;
  }
  return out;
}
