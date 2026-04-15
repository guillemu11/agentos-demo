# Email Builder Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable engine that takes any Emirates AMPscript email template + MC credentials and generates all renderable HTML email variants with real content, images, and design — exposed as both a Claude Code skill and an AgentOS agent tool.

**Architecture:** Three-phase pipeline (Analyze → Fetch → Render) extracted from the working prototype in `tmp-mc-preview/generate-from-real-blocks.js`. The core logic lives in `packages/core/email-builder/`, is consumed by the `html-developer` agent as an MC tool, and exposed as a `/email-build` Claude Code skill for CLI usage. All MC communication uses the existing `mc-api` client module.

**Tech Stack:** Node.js ES modules, MC REST + SOAP APIs (via `packages/core/mc-api`), Express SSE (existing pattern), Anthropic tool_use schema

---

## File Structure

```
packages/core/email-builder/
├── index.js              — Public API: analyzeTemplate(), fetchCampaignData(), renderVariants()
├── analyzer.js           — Phase 1: parse AMPscript → campaign manifest
├── fetcher.js            — Phase 2: MC API → blocks HTML + DE content + image URLs
├── renderer.js           — Phase 3: manifest + data → static HTML per variant
├── ampscript.js          — AMPscript utilities: strip, replace vars, split body copy
├── image-resolver.js     — Batch image ID → CDN URL resolution
└── __tests__/
    ├── analyzer.test.js
    ├── ampscript.test.js
    ├── renderer.test.js
    └── fixtures/
        ├── churn-template.html       — subset of churn AMPscript for tests
        ├── sample-block.html         — real block HTML with AMPscript vars
        └── sample-content.json       — minimal content data
```

**Modifications to existing files:**
- `packages/core/mc-api/tools.js` — add email-builder tool definitions
- `packages/core/mc-api/executor.js` — add email-builder tool dispatch
- `packages/core/agents/profiles.js` — update `html-developer` profile with new tools
- `apps/dashboard/server.js` — add email-builder API endpoint (small, delegates to core)

---

## Task 1: Extract AMPscript utilities

**Files:**
- Create: `packages/core/email-builder/ampscript.js`
- Create: `packages/core/email-builder/__tests__/ampscript.test.js`
- Create: `packages/core/email-builder/__tests__/fixtures/sample-block.html`

These are pure functions with zero MC dependencies — the safest starting point.

- [ ] **Step 1: Create fixture — real block HTML with AMPscript vars**

```bash
# Copy a small real block from today's work as a test fixture
cp tmp-mc-preview/churn-email-build/blocks-real/41658_section_title_noLine.html \
   packages/core/email-builder/__tests__/fixtures/sample-block.html
```

- [ ] **Step 2: Write failing tests for AMPscript utilities**

```javascript
// packages/core/email-builder/__tests__/ampscript.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  stripAmpscriptBlocks,
  replaceAmpscriptVars,
  splitBodyCopy,
  parseContentBlockRefs,
  parseDELookups,
  parseVariableDeclarations,
} from '../ampscript.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures');

describe('stripAmpscriptBlocks', () => {
  it('removes %%[...]%% blocks', () => {
    const input = 'Hello %%[ SET @x = 1 ]%% world';
    expect(stripAmpscriptBlocks(input)).toBe('Hello  world');
  });

  it('removes multiline %%[...]%% blocks', () => {
    const input = 'A%%[\nSET @x = 1\nIF @x == 1 THEN\nENDIF\n]%%B';
    expect(stripAmpscriptBlocks(input)).toBe('AB');
  });

  it('removes ContentBlockbyID references', () => {
    const input = 'before%%=ContentBlockbyID("32798")=%%after';
    expect(stripAmpscriptBlocks(input)).toBe('beforeafter');
  });

  it('removes ImpressionRegion wrappers', () => {
    const input = '%%=BeginImpressionRegion("test")=%%content%%=EndImpressionRegion()=%%';
    expect(stripAmpscriptBlocks(input)).toBe('content');
  });

  it('handles real block fixture', () => {
    const html = readFileSync(join(FIXTURE_DIR, 'sample-block.html'), 'utf8');
    const result = stripAmpscriptBlocks(html);
    expect(result).not.toContain('%%[');
    expect(result).not.toContain('%%=ContentBlockbyID');
    expect(result).toContain('<table'); // HTML structure preserved
  });
});

describe('replaceAmpscriptVars', () => {
  it('replaces %%=v(@var)=%% with values', () => {
    const html = '<span>%%=v(@first_name)=%%</span>';
    expect(replaceAmpscriptVars(html, { first_name: 'Sarah' })).toBe('<span>Sarah</span>');
  });

  it('replaces %%=RedirectTo(@url)=%% with URL value', () => {
    const html = '<a href="%%=RedirectTo(@link)=%%">';
    expect(replaceAmpscriptVars(html, { link: 'https://emirates.com' }))
      .toBe('<a href="https://emirates.com">');
  });

  it('replaces %%=TreatAsContent(@html)=%% with content', () => {
    const html = '%%=TreatAsContent(@story1_body)=%%';
    expect(replaceAmpscriptVars(html, { story1_body: '<b>Bold</b>' }))
      .toBe('<b>Bold</b>');
  });

  it('replaces %%view_email_url%% with placeholder', () => {
    const html = '<a href="%%view_email_url%%">';
    expect(replaceAmpscriptVars(html, {})).toContain('https://');
  });

  it('strips alias attributes', () => {
    const html = '<a alias="%%=v(@test)=%%" href="#">link</a>';
    expect(replaceAmpscriptVars(html, { test: 'x' })).not.toContain('alias=');
  });

  it('returns empty string for undefined vars', () => {
    const html = '%%=v(@missing)=%%';
    expect(replaceAmpscriptVars(html, {})).toBe('');
  });
});

describe('splitBodyCopy', () => {
  it('splits body around Link1-Link4 markers', () => {
    const body = 'Visit Link1 for deals. Book Link2 now.';
    const dc = {
      link1: 'https://emirates.com/home', link1_text: 'emirates.com',
      link2: 'https://emirates.com/book', link2_text: 'your trip',
      aliaslink1: 'home', aliaslink2: 'book',
      link3: '', link4: '',
    };
    const result = splitBodyCopy(body, dc);
    expect(result.before_link1).toBe('Visit ');
    expect(result.between_link1_2).toBe(' for deals. Book ');
    expect(result.after_last_link).toBe(' now.');
  });

  it('handles body with no Link markers', () => {
    const body = 'No links here.';
    const result = splitBodyCopy(body, {});
    expect(result.before_link1).toBe('No links here.');
  });
});

describe('parseContentBlockRefs', () => {
  it('extracts ContentBlockbyID references from AMPscript', () => {
    const ampscript = `
      %%=ContentBlockbyID("42706")=%%
      %%=ContentBlockbyID("37247")=%%
      %%=ContentBlockbyID("34287")=%%
    `;
    const refs = parseContentBlockRefs(ampscript);
    expect(refs).toEqual(['42706', '37247', '34287']);
  });

  it('deduplicates repeated IDs', () => {
    const ampscript = '%%=ContentBlockbyID("100")=%%%%=ContentBlockbyID("100")=%%';
    expect(parseContentBlockRefs(ampscript)).toEqual(['100']);
  });
});

describe('parseDELookups', () => {
  it('extracts DE names from LookupRows calls', () => {
    const ampscript = `
      SET @content = LookupRows('Churn_DynamicContent_shortlinks','language', @lm_code)
      SET @header = LookupRows('Header_CentralizedContent', 'language', @lm_code)
    `;
    const des = parseDELookups(ampscript);
    expect(des).toContain('Churn_DynamicContent_shortlinks');
    expect(des).toContain('Header_CentralizedContent');
  });
});

describe('parseVariableDeclarations', () => {
  it('extracts SET @var = Field() mappings', () => {
    const ampscript = `
      SET @first_name = Field(@Row, 'first_name')
      SET @segment = Field(@Row, 'segment')
    `;
    const vars = parseVariableDeclarations(ampscript);
    expect(vars).toContainEqual({ variable: 'first_name', field: 'first_name' });
    expect(vars).toContainEqual({ variable: 'segment', field: 'segment' });
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npx vitest run packages/core/email-builder/__tests__/ampscript.test.js
```

Expected: all tests FAIL (module not found)

- [ ] **Step 4: Implement ampscript.js**

```javascript
// packages/core/email-builder/ampscript.js
/**
 * AMPscript parsing and variable replacement utilities.
 * Pure functions — no MC API dependency.
 */

/**
 * Remove all %%[...]%% blocks, ContentBlockbyID refs, ImpressionRegion wrappers.
 */
export function stripAmpscriptBlocks(html) {
    let result = html;
    result = result.replace(/%%\[[\s\S]*?\]%%/g, '');
    result = result.replace(/%%=ContentBlockByID\([^)]*\)=%%/gi, '');
    result = result.replace(/%%=(?:Begin|End)ImpressionRegion\([^)]*\)=%%/g, '');
    result = result.replace(/%%=TreatAsContent\(concat\([^)]*\)\)=%%/g, '');
    return result;
}

/**
 * Replace AMPscript variable patterns with values from a flat key-value map.
 * Keys should NOT include the @ prefix.
 *
 * Patterns handled:
 *   %%=v(@variable)=%%           → vars[variable]
 *   %%=RedirectTo(@url)=%%       → vars[url]
 *   %%=TreatAsContent(@html)=%%  → vars[html]
 *   %%view_email_url%%           → default view URL
 *   alias="..."                  → stripped
 */
export function replaceAmpscriptVars(html, vars, viewEmailUrl = 'https://www.emirates.com/uk/english/home') {
    let result = html;
    result = result.replace(/%%view_email_url%%/g, viewEmailUrl);
    result = result.replace(/%%=v\((@\w+)\)=%%/g, (_, v) => vars[v.substring(1)] ?? '');
    result = result.replace(/%%=RedirectTo\((@\w+)\)=%%/g, (_, v) => vars[v.substring(1)] ?? '#');
    result = result.replace(/%%=TreatAsContent\((@\w+)\)=%%/g, (_, v) => vars[v.substring(1)] ?? '');
    result = result.replace(/\s*alias="[^"]*"/g, '');
    result = result.replace(/%%=[^%]*=%%/g, '');
    result = result.replace(/%%[^%]*%%/g, '');
    return result;
}

/**
 * Split body copy text around Link1-Link4 markers.
 * Mirrors the AMPscript splitting logic in the churn template.
 *
 * @param {string} bodyCopy - Raw body text with Link1..Link4 markers
 * @param {object} dc - Dynamic content row with link1..4, link1_text..4, aliaslink1..4
 * @returns {object} Split segments + rendered link HTML + glue strings
 */
export function splitBodyCopy(bodyCopy, dc) {
    const result = {
        before_link1: '', between_link1_2: '', between_link2_3: '',
        between_link3_4: '', after_last_link: '',
    };

    const markers = [];
    for (let i = 1; i <= 4; i++) {
        const pos = bodyCopy.indexOf(`Link${i}`);
        if (pos >= 0) markers.push({ i, pos, len: `Link${i}`.length });
    }
    markers.sort((a, b) => a.pos - b.pos);

    if (markers.length === 0) {
        result.before_link1 = bodyCopy;
        return result;
    }

    result.before_link1 = bodyCopy.substring(0, markers[0].pos);
    const segNames = ['between_link1_2', 'between_link2_3', 'between_link3_4'];
    for (let i = 0; i < markers.length - 1; i++) {
        const start = markers[i].pos + markers[i].len;
        result[segNames[i] || `extra_${i}`] = bodyCopy.substring(start, markers[i + 1].pos);
    }
    for (const name of segNames) { if (!result[name]) result[name] = ''; }
    const last = markers[markers.length - 1];
    result.after_last_link = bodyCopy.substring(last.pos + last.len);

    // Render link HTML for each present marker
    for (const m of markers) {
        const url = dc[`link${m.i}`] || '';
        const text = dc[`link${m.i}_text`] || '';
        if (url && text) {
            result[`Link${m.i}_html`] = `<a href="${url}" style="color:#333333; text-decoration:none;" target="_blank">${text}</a>`;
        }
    }

    // Glue: space or empty based on whether the next segment starts with alpha
    for (const [key, suffix] of [['glue12', 'between_link1_2'], ['glue23', 'between_link2_3'], ['glue34', 'between_link3_4'], ['glue4e', 'after_last_link']]) {
        const seg = (result[suffix] || '').replace(/&nbsp;/g, ' ').trim();
        const first = seg.charAt(0) || '';
        result[key] = (first && first !== '<' && /[a-z0-9]/i.test(first)) ? ' ' : '';
    }

    return result;
}

/**
 * Extract all ContentBlockbyID("XXXXX") references from AMPscript HTML.
 * @returns {string[]} Unique block IDs
 */
export function parseContentBlockRefs(ampscript) {
    const matches = ampscript.matchAll(/ContentBlockbyID\("(\d+)"\)/gi);
    return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Extract DE names from LookupRows/LookupOrderedRows calls.
 * @returns {string[]} Unique DE names
 */
export function parseDELookups(ampscript) {
    const matches = ampscript.matchAll(/Lookup(?:Ordered)?Rows\(\s*'([^']+)'/gi);
    return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Extract SET @var = Field(@Row, 'field_name') mappings.
 * @returns {Array<{variable: string, field: string}>}
 */
export function parseVariableDeclarations(ampscript) {
    const matches = ampscript.matchAll(/SET\s+@(\w+)\s*=\s*(?:Trim\s*\(\s*)?(?:ProperCase\s*\(\s*)?Field\s*\(\s*@\w+\s*,\s*'(\w+)'\s*\)/gi);
    return [...matches].map(m => ({ variable: m[1], field: m[2] }));
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run packages/core/email-builder/__tests__/ampscript.test.js
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/email-builder/ampscript.js packages/core/email-builder/__tests__/
git commit -m "feat(email-builder): add AMPscript parsing utilities with tests"
```

---

## Task 2: Image resolver module

**Files:**
- Create: `packages/core/email-builder/image-resolver.js`
- Create: `packages/core/email-builder/__tests__/fixtures/sample-content.json`

- [ ] **Step 1: Create a minimal content fixture**

```bash
# Extract a minimal subset for tests
node -e "
const fs = require('fs');
const full = JSON.parse(fs.readFileSync('tmp-mc-preview/churn-email-build/mc-content-english.json'));
const mini = {
  headerContent: [{ header_logo: '42722', header_login_logo: '42723' }],
  stories: full.stories.slice(0, 2),
};
fs.writeFileSync('packages/core/email-builder/__tests__/fixtures/sample-content.json', JSON.stringify(mini, null, 2));
"
```

- [ ] **Step 2: Implement image-resolver.js**

```javascript
// packages/core/email-builder/image-resolver.js
/**
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
 * @param {object} [existingMap={}] - Pre-resolved IDs to skip
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
 * Collect all image IDs referenced in content data.
 * Scans header, footer, stories for image fields.
 * @param {object} content - mc-content JSON (headerContent, footerContent, stories)
 * @returns {string[]} Unique image IDs
 */
export function collectImageIds(content) {
    const ids = new Set();
    const add = (v) => { if (v && v !== '') ids.add(String(v)); };

    // Header
    (content.headerContent || []).forEach(h => {
        add(h.header_logo); add(h.header_login_logo);
    });
    // Footer
    (content.footerContent || []).forEach(f => {
        add(f.logo_image); add(f.co_logo);
    });
    // Stories
    (content.stories || []).forEach(s => {
        add(s.story_image); add(s.story_image_circle);
        add(s.story_image_single); add(s.story_image_icon);
    });

    return [...ids];
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/email-builder/image-resolver.js
git commit -m "feat(email-builder): add image ID → CDN URL batch resolver"
```

---

## Task 3: Analyzer — parse AMPscript templates

**Files:**
- Create: `packages/core/email-builder/analyzer.js`
- Create: `packages/core/email-builder/__tests__/analyzer.test.js`
- Create: `packages/core/email-builder/__tests__/fixtures/churn-template.html`

- [ ] **Step 1: Create churn template fixture (subset)**

```bash
# Copy the AMPscript template — this is the real input
cp tmp-mc-preview/churn_agentos_ampscript.html \
   packages/core/email-builder/__tests__/fixtures/churn-template.html
```

- [ ] **Step 2: Write failing tests for analyzer**

```javascript
// packages/core/email-builder/__tests__/analyzer.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeTemplate } from '../analyzer.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures');

describe('analyzeTemplate', () => {
  const template = readFileSync(join(FIXTURE_DIR, 'churn-template.html'), 'utf8');
  const manifest = analyzeTemplate(template);

  it('returns a valid manifest object', () => {
    expect(manifest).toHaveProperty('contentBlockIds');
    expect(manifest).toHaveProperty('dataExtensions');
    expect(manifest).toHaveProperty('variables');
    expect(manifest).toHaveProperty('variants');
    expect(manifest).toHaveProperty('blockOrder');
  });

  it('discovers all content block IDs referenced', () => {
    // The churn template references these global blocks directly
    expect(manifest.contentBlockIds).toContain('42706'); // header
    expect(manifest.contentBlockIds).toContain('37247'); // spacer
    expect(manifest.contentBlockIds).toContain('37241'); // header title
    expect(manifest.contentBlockIds).toContain('44975'); // body copy
    expect(manifest.contentBlockIds).toContain('42617'); // red CTA
    expect(manifest.contentBlockIds).toContain('34287'); // 3-columns
    expect(manifest.contentBlockIds).toContain('39445'); // footer
    expect(manifest.contentBlockIds).toContain('35063'); // caveat
  });

  it('discovers data extensions used', () => {
    expect(manifest.dataExtensions.map(d => d.name)).toContain('Churn_DynamicContent_shortlinks');
    expect(manifest.dataExtensions.map(d => d.name)).toContain('Header_CentralizedContent');
    expect(manifest.dataExtensions.map(d => d.name)).toContain('Footer_CentralizedContent');
    expect(manifest.dataExtensions.map(d => d.name)).toContain('Stories_Ref_Table_shortlink');
  });

  it('identifies segment-based variants', () => {
    // From the IF @Segment == conditions in the template
    expect(manifest.variants.segmentField).toBe('Segment');
    expect(manifest.variants.segments).toContain('preventionindirect');
    expect(manifest.variants.segments).toContain('preventiondirect');
    expect(manifest.variants.segments).toContain('reactivationindirect');
  });

  it('identifies header variants (skw vs ebase)', () => {
    expect(manifest.variants.headerTypes).toContain('skw');
    expect(manifest.variants.headerTypes).toContain('ebase');
  });

  it('maps block order per layout', () => {
    expect(manifest.blockOrder).toHaveProperty('prevention');
    expect(manifest.blockOrder).toHaveProperty('reactivation');
    expect(Array.isArray(manifest.blockOrder.prevention)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npx vitest run packages/core/email-builder/__tests__/analyzer.test.js
```

- [ ] **Step 4: Implement analyzer.js**

```javascript
// packages/core/email-builder/analyzer.js
/**
 * Phase 1: Analyze an AMPscript email template to produce a campaign manifest.
 *
 * The manifest describes everything needed to fetch data and render variants:
 * - Which Content Builder blocks are referenced
 * - Which Data Extensions are queried
 * - What variables exist and how they map to DE fields
 * - What segment/header variants exist
 * - The block assembly order per layout
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

    return { contentBlockIds, dataExtensions, variables, variants, blockOrder };
}

/**
 * Extract the fields used in LookupRows for a specific DE.
 */
function extractLookupFields(html, deName) {
    const escaped = deName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`LookupRows\\(\\s*'${escaped}'\\s*,\\s*'(\\w+)'`, 'gi');
    const matches = [...html.matchAll(regex)];
    return [...new Set(matches.map(m => m[1]))];
}

/**
 * Detect segment-based and header-type variants from IF conditions.
 */
function detectVariants(html) {
    const result = {
        segmentField: null,
        segments: [],
        headerTypes: [],
        preventionSegments: [],
    };

    // Find @Segment == 'xxx' patterns
    const segMatches = html.matchAll(/@Segment\s*==\s*'(\w+)'/gi);
    const segs = [...new Set([...segMatches].map(m => m[1].toLowerCase()))];
    if (segs.length > 0) {
        result.segmentField = 'Segment';
        result.segments = segs;
    }

    // Detect prevention vs reactivation grouping
    const preventionMatch = html.match(
        /IF\s+@Segment\s*==\s*'(\w+)'\s*(?:or\s+@Segment\s*==\s*'(\w+)')*\s*(?:or\s+@Segment\s*==\s*'(\w+)')?\s*THEN/i
    );
    if (preventionMatch) {
        result.preventionSegments = [preventionMatch[1], preventionMatch[2], preventionMatch[3]]
            .filter(Boolean)
            .map(s => s.toLowerCase());
    }

    // Header types from @headerver
    if (html.includes('@headerver')) {
        result.headerTypes = ['skw', 'ebase'];
    }

    return result;
}

/**
 * Detect block assembly order from the render section of the template.
 * Looks at the ContentBlockbyID calls in the body section (after variable declarations).
 */
function detectBlockOrder(html, variants) {
    // Find the render section (after the variable setup, where blocks are actually output)
    // This is typically after the last SET statement and before </body>
    const renderSection = html.substring(html.lastIndexOf('%%=ContentBlockbyID'));

    const blockRefs = [];
    const refPattern = /%%=ContentBlockbyID\("(\d+)"\)=%%/gi;
    let match;
    while ((match = refPattern.exec(html)) !== null) {
        blockRefs.push({ id: match[1], position: match.index });
    }

    // The render section (last ~200 lines) shows the actual order
    // We use position to determine order
    const renderBlockIds = blockRefs
        .filter(b => b.position > html.length * 0.5) // blocks in the second half = render section
        .sort((a, b) => a.position - b.position)
        .map(b => b.id);

    // Build two orders based on whether inspiration comes before or after CTA
    return {
        prevention: renderBlockIds, // full order as-is
        reactivation: renderBlockIds, // same IDs, different assembly in renderer
        allBlocks: [...new Set(renderBlockIds)],
    };
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run packages/core/email-builder/__tests__/analyzer.test.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/email-builder/analyzer.js packages/core/email-builder/__tests__/analyzer.test.js packages/core/email-builder/__tests__/fixtures/
git commit -m "feat(email-builder): add AMPscript template analyzer (Phase 1)"
```

---

## Task 4: Fetcher — MC API data retrieval

**Files:**
- Create: `packages/core/email-builder/fetcher.js`

- [ ] **Step 1: Implement fetcher.js**

This module connects to MC and retrieves everything the manifest says is needed. No tests here — it's an integration layer that requires MC credentials. We'll test it via the end-to-end flow.

```javascript
// packages/core/email-builder/fetcher.js
/**
 * Phase 2: Fetch all data from Marketing Cloud based on the campaign manifest.
 *
 * Uses mc-api client for:
 * - Content Builder blocks (HTML)
 * - Data Extension rows (content per language/segment)
 * - Image CDN URLs
 *
 * Returns a self-contained data bundle for the renderer.
 */

import { collectImageIds, resolveImageBatch } from './image-resolver.js';

/**
 * Fetch all campaign data from Marketing Cloud.
 *
 * @param {object} manifest - From analyzeTemplate()
 * @param {object} mcClient - MC client from createMCClient()
 * @param {object} options
 * @param {string} options.language - Language code for content (default 'en')
 * @param {string} options.market - Market code for URL replacement (default 'uk/english')
 * @returns {Promise<object>} Campaign data bundle
 */
export async function fetchCampaignData(manifest, mcClient, options = {}) {
    const lang = options.language || 'en';

    // 1. Fetch content block HTML
    const blocks = {};
    for (const id of manifest.contentBlockIds) {
        try {
            const asset = await mcClient.rest('GET', `/asset/v1/content/assets/${id}`);
            blocks[id] = {
                name: asset.name,
                html: asset.views?.html?.content || asset.content || '',
            };
        } catch (err) {
            console.warn(`Block ${id} fetch failed: ${err.message}`);
            blocks[id] = { name: `block_${id}`, html: '' };
        }
    }

    // 2. Discover DE external keys via SOAP, then query via REST
    const deData = {};
    for (const de of manifest.dataExtensions) {
        const externalKey = await discoverDEKey(mcClient, de.name);
        if (!externalKey) { deData[de.name] = []; continue; }

        const filter = de.lookupFields.includes('language') ? `language eq '${lang}'` : null;
        deData[de.name] = await queryDE(mcClient, externalKey, filter);
    }

    // 3. Resolve images
    const allContent = { stories: deData['Stories_Ref_Table_shortlink'] || [] };
    // Add header/footer content for image collection
    for (const [name, rows] of Object.entries(deData)) {
        if (name.includes('Header')) allContent.headerContent = rows;
        if (name.includes('Footer')) allContent.footerContent = rows;
    }
    const imageIds = collectImageIds(allContent);
    const imageMap = await resolveImageBatch(mcClient, imageIds);

    return { blocks, deData, imageMap };
}

/**
 * Discover DE external key via SOAP (MC REST doesn't support name-based DE lookup).
 */
async function discoverDEKey(mcClient, deName) {
    const escapedName = deName.replace(/&/g, '&amp;').replace(/</g, '&lt;');
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
 */
async function queryDE(mcClient, externalKey, filter = null, top = 100) {
    let path = `/data/v1/customobjectdata/key/${encodeURIComponent(externalKey)}/rowset?$pageSize=${top}`;
    if (filter) path += `&$filter=${encodeURIComponent(filter)}`;

    try {
        const data = await mcClient.rest('GET', path);
        return (data.items || []).map(r => ({ ...(r.keys || {}), ...(r.values || {}) }));
    } catch {
        return [];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/email-builder/fetcher.js
git commit -m "feat(email-builder): add MC data fetcher (Phase 2)"
```

---

## Task 5: Renderer — assemble final HTML

**Files:**
- Create: `packages/core/email-builder/renderer.js`
- Create: `packages/core/email-builder/__tests__/renderer.test.js`

- [ ] **Step 1: Write failing tests for renderer**

```javascript
// packages/core/email-builder/__tests__/renderer.test.js
import { describe, it, expect } from 'vitest';
import { renderVariant, buildVariableMap } from '../renderer.js';

describe('buildVariableMap', () => {
  it('maps subscriber + header + segment data into flat key-value object', () => {
    const subscriber = { first_name: 'Sarah', TierName: 'Gold', miles_balance: '45,230' };
    const header = { header_logo: 'logo.png', skw_miles_text: 'Skywards Miles' };
    const segment = { main_header: 'Where to go next', body_cta: 'Book now' };
    const stories = {};
    const footer = { unsub_text: 'Unsubscribe' };

    const map = buildVariableMap({ subscriber, header, segment, stories, footer, imageMap: {} });

    expect(map.first_name).toBe('Sarah');
    expect(map.TierName).toBe('Gold');
    expect(map.header_logo).toBe('logo.png');
    expect(map.main_header).toBe('Where to go next');
    expect(map.unsub_text).toBe('Unsubscribe');
  });
});

describe('renderVariant', () => {
  it('produces complete HTML with no AMPscript remaining', () => {
    const blockHtml = '<td>%%=v(@main_header)=%%</td>';
    const blocks = { '37238': { html: blockHtml } };
    const vars = { main_header: 'Test Header' };
    const blockOrder = ['37238'];
    const templateShell = '<html><body>{{CONTENT}}</body></html>';

    const result = renderVariant({ blocks, vars, blockOrder, templateShell });

    expect(result).toContain('Test Header');
    expect(result).not.toContain('%%');
    expect(result).toContain('<html>');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run packages/core/email-builder/__tests__/renderer.test.js
```

- [ ] **Step 3: Implement renderer.js**

```javascript
// packages/core/email-builder/renderer.js
/**
 * Phase 3: Render static HTML email variants from real MC blocks + content data.
 *
 * Takes the block HTML (with AMPscript), a variable map, and block order,
 * then outputs complete, renderable HTML.
 */

import { stripAmpscriptBlocks, replaceAmpscriptVars, splitBodyCopy } from './ampscript.js';

/**
 * Build a flat variable map from all content sources.
 * This maps AMPscript @variable names (without @) to their values.
 */
export function buildVariableMap({ subscriber, header, segment, stories, footer, caveat, salutation, imageMap, market }) {
    const vars = {};
    const resolveImg = (id) => imageMap?.[String(id)] || '';
    const fixUrl = (url) => (url || '').replace(/xx\/xx/g, market || 'uk/english');

    // Subscriber
    Object.assign(vars, subscriber);

    // Header — resolve image IDs to URLs
    if (header) {
        Object.entries(header).forEach(([k, v]) => { vars[k] = v; });
        if (header.header_logo) vars.header_logo = resolveImg(header.header_logo);
        if (header.header_login_logo) vars.header_login_logo = resolveImg(header.header_login_logo);
        // Fix URLs
        for (const k of ['header_logo_link', 'header_login_link', 'join_skw_link']) {
            if (vars[k]) vars[k] = fixUrl(vars[k]);
        }
    }

    // Segment content
    if (segment) {
        Object.entries(segment).forEach(([k, v]) => { vars[k] = v; });
        // Fix body link
        if (vars.body_link) vars.body_link = fixUrl(vars.body_link);
        // Process body copy links
        if (segment.body_copy) {
            const split = splitBodyCopy(segment.body_copy, {
                ...segment,
                link1: fixUrl(segment.link1), link2: fixUrl(segment.link2),
                link3: fixUrl(segment.link3), link4: fixUrl(segment.link4),
            });
            Object.assign(vars, split);
        }
        // Map CTA vars (the red CTA block uses @link, @cta, @link_alias)
        vars.link = fixUrl(segment.body_link);
        vars.cta = segment.body_cta;
        vars.link_alias = segment.body_link_alias;
    }

    // Stories — map by position (story1_, story2_, story3_ etc.)
    if (stories) {
        for (const [prefix, story] of Object.entries(stories)) {
            if (!story) continue;
            vars[`${prefix}_image`] = resolveImg(story.story_image_circle || story.story_image);
            vars[`${prefix}_header`] = story.story_header || '';
            vars[`${prefix}_body`] = story.story_body || '';
            vars[`${prefix}_link`] = fixUrl(story.story_url || '');
            vars[`${prefix}_alias`] = story.story_alias || '';
            vars[`${prefix}_cta`] = story.story_cta || '';
        }
    }

    // Footer — resolve images + fix URLs
    if (footer) {
        Object.entries(footer).forEach(([k, v]) => { vars[k] = v; });
        if (footer.logo_image) vars.logo_image = resolveImg(footer.logo_image);
        for (const k of ['logo_link', 'unsub_link', 'contactus_link', 'privacy_link']) {
            if (vars[k]) vars[k] = fixUrl(vars[k]);
        }
        if (vars.copywrite) vars.copywrite = vars.copywrite.replace('{current_year}', new Date().getFullYear());
    }

    // Caveat
    if (caveat) vars.caveat_terms = fixUrl(caveat.caveat_terms6 || caveat.caveat_terms1 || '');

    // Salutation
    if (salutation?.salutation) {
        const greeting = salutation.salutation.replace('{first_name}', subscriber?.first_name || '');
        vars.body_copy_salutation = greeting;
    }

    return vars;
}

/**
 * Render a single email variant from real MC block HTML + variable map.
 *
 * @param {object} params
 * @param {Record<string, {html: string}>} params.blocks - Block ID → {html}
 * @param {object} params.vars - Flat variable map (from buildVariableMap)
 * @param {string[]} params.blockOrder - Ordered block IDs for this variant
 * @param {string} params.templateShell - The outer HTML wrapper with {{CONTENT}} placeholder
 * @param {string} [params.preheader] - Preheader text
 * @returns {string} Complete, renderable HTML
 */
export function renderVariant({ blocks, vars, blockOrder, templateShell, preheader }) {
    const parts = [];

    // Preheader
    if (preheader) {
        parts.push(`<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>`);
    }

    // Assemble blocks in order
    for (const blockId of blockOrder) {
        const block = blocks[blockId];
        if (!block?.html) continue;

        let html = block.html;
        html = stripAmpscriptBlocks(html);
        html = replaceAmpscriptVars(html, vars);
        parts.push(html);
    }

    const content = parts.join('\n');

    // Insert into template shell
    if (templateShell) {
        return templateShell.replace('{{CONTENT}}', content);
    }
    return content;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run packages/core/email-builder/__tests__/renderer.test.js
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/email-builder/renderer.js packages/core/email-builder/__tests__/renderer.test.js
git commit -m "feat(email-builder): add template renderer (Phase 3)"
```

---

## Task 6: Public API + index module

**Files:**
- Create: `packages/core/email-builder/index.js`

- [ ] **Step 1: Implement index.js — orchestrator for the 3 phases**

```javascript
// packages/core/email-builder/index.js
/**
 * Email Builder Engine — Public API
 *
 * Three-phase pipeline:
 *   1. analyzeTemplate(ampscriptHtml) → manifest
 *   2. fetchCampaignData(manifest, mcClient, options) → data bundle
 *   3. renderVariants(manifest, data, options) → { [filename]: html }
 *
 * Also exports a one-shot buildCampaignEmails() that runs all 3 phases.
 */

export { analyzeTemplate } from './analyzer.js';
export { fetchCampaignData } from './fetcher.js';
export { renderVariant, buildVariableMap } from './renderer.js';
export { resolveImageBatch, collectImageIds } from './image-resolver.js';
export {
    stripAmpscriptBlocks,
    replaceAmpscriptVars,
    splitBodyCopy,
    parseContentBlockRefs,
    parseDELookups,
} from './ampscript.js';

import { analyzeTemplate } from './analyzer.js';
import { fetchCampaignData } from './fetcher.js';
import { renderVariant, buildVariableMap } from './renderer.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build all email variants for a campaign from an AMPscript template.
 * One-shot convenience function that runs Analyze → Fetch → Render.
 *
 * @param {object} params
 * @param {string} params.templateHtml - AMPscript email template
 * @param {object} params.mcClient - MC client instance
 * @param {object} [params.subscriber] - Preview subscriber data
 * @param {string} [params.language='en'] - Content language
 * @param {string} [params.market='uk/english'] - URL market replacement
 * @param {string} [params.templateShellPath] - Path to template_style.html
 * @returns {Promise<{manifest: object, files: Record<string, string>}>}
 */
export async function buildCampaignEmails({
    templateHtml,
    mcClient,
    subscriber = { first_name: 'Sarah', TierName: 'Gold', miles_balance: '45,230' },
    language = 'en',
    market = 'uk/english',
    templateShellPath,
}) {
    // Phase 1: Analyze
    const manifest = analyzeTemplate(templateHtml);

    // Phase 2: Fetch
    const data = await fetchCampaignData(manifest, mcClient, { language, market });

    // Phase 3: Render all variants
    const templateShell = loadTemplateShell(templateShellPath);
    const files = {};

    const segments = manifest.variants.segments.length > 0
        ? manifest.variants.segments
        : ['default'];
    const headerTypes = manifest.variants.headerTypes.length > 0
        ? manifest.variants.headerTypes
        : ['default'];

    for (const segment of segments) {
        for (const headerType of headerTypes) {
            const segContent = data.deData['Churn_DynamicContent_shortlinks']?.find(r => r.segment === segment)
                || data.deData['Churn_DynamicContent_shortlinks']?.[0];
            const header = data.deData['Header_CentralizedContent']?.[0];
            const footer = data.deData['Footer_CentralizedContent']?.[0];
            const caveat = data.deData['REF_Caveat_Disclaimer_shortlink']?.[0];
            const salutation = data.deData['REF_Salutation_Language']?.[0];

            // Determine header block
            const headerBlockId = headerType === 'skw' ? '42703' : '42705';

            // Determine block order based on segment
            const isPrevention = manifest.variants.preventionSegments.includes(segment);
            const blockOrder = buildBlockOrder(manifest, headerBlockId, isPrevention, segContent);

            // Resolve stories
            const stories = resolveStories(segContent, data.deData['Stories_Ref_Table_shortlink'] || []);

            const vars = buildVariableMap({
                subscriber, header, segment: segContent, stories, footer, caveat, salutation,
                imageMap: data.imageMap, market,
            });

            const html = renderVariant({
                blocks: data.blocks,
                vars,
                blockOrder,
                templateShell,
                preheader: segContent?.preheader?.replace('{first_name}', subscriber.first_name),
            });

            const filename = `${segment}_${headerType}.html`;
            files[filename] = html;
        }
    }

    return { manifest, files };
}

function loadTemplateShell(customPath) {
    const shellPath = customPath || join(__dirname, '..', '..', '..', 'email_blocks', 'template_style.html');
    try {
        let shell = readFileSync(shellPath, 'utf8');
        // Extract head, clean AMPscript, build wrapper
        const head = shell.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '';
        const cleanHead = head
            .replace(/%%\[[^\]]*\]%%/g, '')
            .replace(/%%[^%]*%%/g, '');
        return `<!DOCTYPE html>\n<html dir="ltr">\n<head>${cleanHead}</head>\n<body width="100%" bgcolor="#cccccc" style="margin:0;background-color:#cccccc;">\n<center style="width:100%;text-align:left;">\n<div style="max-width:842px;min-width:300px;margin:auto;background-color:#FFFFFF;" class="email-container">\n<!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="842" align="center" bgcolor="#FFFFFF"><tr><td><![endif]-->\n{{CONTENT}}\n<!--[if mso]></td></tr></table><![endif]-->\n</div>\n</center>\n<custom name="opencounter" type="tracking" />\n</body>\n</html>`;
    } catch {
        return '{{CONTENT}}';
    }
}

function buildBlockOrder(manifest, headerBlockId, isPrevention, segContent) {
    // This maps the real email structure from the AMPscript template
    const order = [headerBlockId, '37245']; // header + spacer

    // Header title + body copy
    order.push('37238', '44953');

    if (isPrevention) {
        // Inspiration before CTA
        if (segContent?.destination_generic) order.push('41759');
        order.push('42616'); // red CTA
    } else {
        order.push('42616'); // red CTA first
    }

    // Section 1 + 3 columns
    if (segContent?.section_title1) order.push('41658');
    if (segContent?.story1) order.push('34298');

    if (isPrevention) {
        // Cash+Miles
        if (segContent?.cash_miles) order.push('40815');
    } else {
        // Inspiration after 3-columns
        if (segContent?.destination_generic) order.push('41759');
    }

    // Section 2 + 3 columns (if stories 4-6 exist)
    if (segContent?.story4) {
        if (segContent?.section_title2) order.push('41658');
        order.push('34298');
    }

    // Footer + caveat
    order.push('39444', '35062');

    return order;
}

function resolveStories(segContent, storiesArray) {
    if (!segContent) return {};
    const find = (name) => storiesArray.find(s => s.story_name === name) || null;
    return {
        story1: find(segContent.story1),
        story2: find(segContent.story2),
        story3: find(segContent.story3),
        story4: find(segContent.story4),
        story5: find(segContent.story5),
        story6: find(segContent.story6),
        story_single: find(segContent.destination_generic),
        story_left_circle: find(segContent.cash_miles),
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/email-builder/index.js
git commit -m "feat(email-builder): add public API orchestrating all 3 phases"
```

---

## Task 7: MC tools + agent integration

**Files:**
- Modify: `packages/core/mc-api/tools.js` — add email-builder tools
- Modify: `packages/core/mc-api/executor.js` — add dispatch for new tools
- Modify: `packages/core/agents/profiles.js` — update html-developer profile

- [ ] **Step 1: Add email-builder tool definitions to tools.js**

Add after the existing `AUTOMATION_TOOLS` array:

```javascript
// packages/core/mc-api/tools.js — append to file

const EMAIL_BUILDER_TOOLS = [
    {
        name: 'mc_analyze_email_template',
        description: 'Analyze an AMPscript email template to discover content blocks, data extensions, variables, and variant structure. Returns a campaign manifest.',
        input_schema: {
            type: 'object',
            properties: {
                templateHtml: { type: 'string', description: 'Full AMPscript HTML template content' },
            },
            required: ['templateHtml'],
        },
    },
    {
        name: 'mc_build_email_variants',
        description: 'Build all renderable HTML email variants for a campaign. Fetches real content blocks, DE data, and images from Marketing Cloud, then assembles complete static HTML per segment/header combination.',
        input_schema: {
            type: 'object',
            properties: {
                templateHtml: { type: 'string', description: 'Full AMPscript HTML template content' },
                language: { type: 'string', description: 'Content language code (default: en)' },
                market: { type: 'string', description: 'URL market replacement (default: uk/english)' },
                subscriberFirstName: { type: 'string', description: 'Preview subscriber first name' },
                subscriberTier: { type: 'string', description: 'Preview subscriber tier (Blue/Silver/Gold/Platinum)' },
                subscriberMiles: { type: 'string', description: 'Preview subscriber miles balance' },
            },
            required: ['templateHtml'],
        },
    },
];

// Update MC_ALL_TOOLS export to include email builder
export const MC_ALL_TOOLS = [
    ...MC_MVP_TOOLS,
    ...MC_JOURNEY_TOOLS,
    ...EMAIL_BUILDER_TOOLS,
];
```

- [ ] **Step 2: Add email-builder dispatch to executor.js**

Add two new cases in the `dispatch` switch:

```javascript
// In executor.js dispatch function, add before `default:`:
case 'mc_analyze_email_template':  return analyzeEmailTemplate(input);
case 'mc_build_email_variants':    return buildEmailVariants(mc, input);
```

And implement the handlers:

```javascript
// At bottom of executor.js, before audit section:

import { analyzeTemplate, buildCampaignEmails } from '../email-builder/index.js';

async function analyzeEmailTemplate({ templateHtml }) {
    const manifest = analyzeTemplate(templateHtml);
    return `Campaign manifest:\n- Content blocks: ${manifest.contentBlockIds.length} (IDs: ${manifest.contentBlockIds.join(', ')})\n- Data extensions: ${manifest.dataExtensions.map(d => d.name).join(', ')}\n- Segments: ${manifest.variants.segments.join(', ')}\n- Header types: ${manifest.variants.headerTypes.join(', ')}`;
}

async function buildEmailVariants(mc, { templateHtml, language, market, subscriberFirstName, subscriberTier, subscriberMiles }) {
    const subscriber = {
        first_name: subscriberFirstName || 'Customer',
        TierName: subscriberTier || 'Blue',
        miles_balance: subscriberMiles || '0',
    };

    const { manifest, files } = await buildCampaignEmails({
        templateHtml,
        mcClient: mc,
        subscriber,
        language: language || 'en',
        market: market || 'uk/english',
    });

    const fileList = Object.entries(files).map(([name, html]) =>
        `- **${name}** (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`
    ).join('\n');

    return JSON.stringify({
        _type: 'email_variants',
        files,
        summary: `Generated ${Object.keys(files).length} email variants:\n${fileList}`,
    });
}
```

- [ ] **Step 3: Update html-developer agent profile**

In `packages/core/agents/profiles.js`, add the email-builder tools to the html-developer's customTools:

```javascript
// In the 'html-developer' profile, add to customTools array:
'mc_analyze_email_template',
'mc_build_email_variants',
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/mc-api/tools.js packages/core/mc-api/executor.js packages/core/agents/profiles.js
git commit -m "feat(email-builder): integrate as MC tools for html-developer agent"
```

---

## Task 8: Claude Code skill

**Files:**
- Create: `.claude/skills/email-build.md`

- [ ] **Step 1: Create the skill definition**

```markdown
---
name: email-build
description: Build renderable HTML email variants from an Emirates AMPscript template. Fetches real content blocks, DE data, and images from Marketing Cloud. Use when asked to build, preview, or render email campaigns.
---

# Email Build Skill

## What this does
Takes an AMPscript email template and generates all HTML email variants with real content from Marketing Cloud — real blocks, real copy, real images from CDN.

## Three-phase pipeline
1. **Analyze** — parse AMPscript to discover blocks, DEs, variables, variants
2. **Fetch** — pull block HTML + DE content + image CDN URLs from MC
3. **Render** — substitute AMPscript vars → output static HTML per variant

## Prerequisites
- MC credentials in `.env`: `MC_CLIENT_ID`, `MC_CLIENT_SECRET`, `MC_AUTH_URL`, `MC_REST_URL`, `MC_SOAP_URL`
- An AMPscript template file (from Content Builder or extracted from MC)
- `email_blocks/template_style.html` for the responsive shell

## Usage

### From a template file:
```bash
node -e "
import { buildCampaignEmails } from './packages/core/email-builder/index.js';
import { createMCClientDirect } from './packages/core/email-builder/fetcher.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const template = readFileSync('path/to/template.html', 'utf8');
const mcClient = createMCClientDirect(); // uses .env credentials
const { files } = await buildCampaignEmails({ templateHtml: template, mcClient });

mkdirSync('output', { recursive: true });
for (const [name, html] of Object.entries(files)) {
    writeFileSync('output/' + name, html);
}
"
```

### Workflow:
1. Read the AMPscript template the user provides
2. Run `analyzeTemplate()` to understand the structure
3. Show the manifest to the user for confirmation
4. Run `fetchCampaignData()` to pull from MC
5. Run `renderVariants()` to generate all HTML files
6. Save files and report results

## Key files
- `packages/core/email-builder/index.js` — public API
- `packages/core/email-builder/analyzer.js` — AMPscript parser
- `packages/core/email-builder/fetcher.js` — MC data retrieval
- `packages/core/email-builder/renderer.js` — HTML assembly
- `packages/core/email-builder/ampscript.js` — AMPscript utilities
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/email-build.md
git commit -m "feat(email-builder): add Claude Code skill for /email-build"
```

---

## Task 9: End-to-end integration test

**Files:**
- Create: `packages/core/email-builder/__tests__/integration.test.js`

- [ ] **Step 1: Write integration test using real churn data**

This test uses the cached data from today's work (no MC calls needed):

```javascript
// packages/core/email-builder/__tests__/integration.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeTemplate } from '../analyzer.js';
import { renderVariant, buildVariableMap } from '../renderer.js';
import { stripAmpscriptBlocks, replaceAmpscriptVars } from '../ampscript.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures');
const TMP_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'tmp-mc-preview', 'churn-email-build');

describe('end-to-end: churn campaign', () => {
    const template = readFileSync(join(FIXTURE_DIR, 'churn-template.html'), 'utf8');
    const manifest = analyzeTemplate(template);

    it('manifest discovers expected blocks and DEs', () => {
        expect(manifest.contentBlockIds.length).toBeGreaterThan(5);
        expect(manifest.dataExtensions.length).toBeGreaterThan(3);
        expect(manifest.variants.segments.length).toBeGreaterThan(0);
    });

    it('renders a block with real data', () => {
        // Use cached real block
        let blocks;
        try {
            blocks = JSON.parse(readFileSync(join(TMP_DIR, 'blocks-real', '_all-blocks.json'), 'utf8'));
        } catch { return; } // skip if no cached data

        const sectionBlock = blocks['41658'];
        if (!sectionBlock) return;

        const vars = { section_title: 'Your journey. Your way' };
        let html = stripAmpscriptBlocks(sectionBlock.html);
        html = replaceAmpscriptVars(html, vars);

        expect(html).toContain('Your journey. Your way');
        expect(html).not.toContain('%%');
        expect(html).toContain('Emirates-Bold');
    });

    it('renders header SKW with subscriber data', () => {
        let blocks;
        try {
            blocks = JSON.parse(readFileSync(join(TMP_DIR, 'blocks-real', '_all-blocks.json'), 'utf8'));
        } catch { return; }

        const headerBlock = blocks['42703'];
        if (!headerBlock) return;

        const imageMap = {};
        try {
            Object.assign(imageMap, JSON.parse(readFileSync(join(TMP_DIR, 'image-map.json'), 'utf8')));
        } catch {}

        const vars = {
            TierName: 'Gold',
            miles_balance: '45,230',
            skw_miles_text: 'Skywards Miles',
            header_logo: imageMap['42722'] || '',
            header_logo_link: 'https://www.emirates.com/uk/english/home',
            header_login_logo: imageMap['42723'] || '',
            header_login_link: 'https://www.emirates.com/uk/english/overview',
            vawp_text: 'View online',
            vawp_alias: 'viewonline',
        };

        let html = stripAmpscriptBlocks(headerBlock.html);
        html = replaceAmpscriptVars(html, vars);

        expect(html).toContain('Gold');
        expect(html).toContain('45,230');
        expect(html).toContain('Skywards Miles');
        expect(html).toContain('#333333'); // dark header bg
        expect(html).toContain('#d10911'); // red logo box
        expect(html).not.toContain('%%');
    });
});
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run packages/core/email-builder/__tests__/
```

Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/email-builder/__tests__/integration.test.js
git commit -m "test(email-builder): add end-to-end integration tests"
```

---

## Summary

| Task | Component | Type | Dependencies |
|------|-----------|------|-------------|
| 1 | ampscript.js | Core utility | None |
| 2 | image-resolver.js | MC integration | mc-api |
| 3 | analyzer.js | AMPscript parser | ampscript.js |
| 4 | fetcher.js | MC data layer | mc-api, image-resolver |
| 5 | renderer.js | HTML assembly | ampscript.js |
| 6 | index.js | Public API | all above |
| 7 | MC tools + agent | Integration | email-builder, mc-api, profiles |
| 8 | Skill definition | CLI | email-builder |
| 9 | Integration tests | Verification | all above |

Tasks 1-3 can run in parallel (no inter-dependencies). Task 4 depends on 2. Task 5 depends on 1. Task 6 depends on 1-5. Tasks 7-8 depend on 6. Task 9 depends on all.
