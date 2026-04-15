// Phase A (preview-only): block-level rendering.
// Fetch the template's AMPscript + every ContentBlockbyID, hand them to Claude,
// ask Claude to pick relevant blocks for the brief and emit filled HTML with
// [[IMG: description]] placeholders for any image. Replace placeholders with
// Imagen-generated data URIs, concatenate in template order, wrap with shell.
// NO DE rows. NO MC writes. Just a visual preview for the human-in-the-loop gate.

import Anthropic from '@anthropic-ai/sdk';
import { analyzeBAUTemplate } from '../email-builder/analyzer.js';
import { resolveEmailTemplate } from '../email-builder/fetcher.js';
import { CAMPAIGN_TYPES, getDEFields } from './index.js';
import { generateImage, initGemini, isGeminiReady } from '../ai-providers/gemini.js';

const IMG_TOKEN_RE = /\[\[IMG:\s*([^\]]+?)\s*\]\]/g;

// Map short lang codes to the full AMPscript names Emirates blocks use.
const LANG_FULL = {
  en: 'ENGLISH', ar: 'ARABIC', fr: 'FRENCH', de: 'GERMAN', es: 'SPANISH',
  it: 'ITALIAN', pt: 'PORTUGUESE', ru: 'RUSSIAN', pl: 'POLISH', tr: 'TURKISH',
  nl: 'DUTCH', gr: 'GREEK', cz: 'CZECH', dk: 'DANISH', th: 'THAI',
  jp: 'JAPANESE', kr: 'KOREAN', id: 'BAHASA', he: 'HEBREW',
  ch_scn: 'SIMPLIFIED CHINESE', ch_tcn: 'TRADITIONAL CHINESE',
  pt_br: 'PORTUGUESE BR', pt_eu: 'PORTUGUESE EU',
  se: 'SWEDISH', hu: 'HUNGARIAN', vn: 'VIETNAMESE', nn: 'NORWEGIAN',
};

// Walk a block's AMPscript and collapse IF @language==X / ELSEIF / ELSE / ENDIF
// chains down to the branch matching the target language. Emirates blocks have
// ~25-language chains; keeping only the active one cuts 90%+ of tokens.
function selectLanguageBranch(html, lang) {
  if (!html) return html;
  const full = (LANG_FULL[String(lang).toLowerCase()] || '').toUpperCase();
  const short = String(lang).toLowerCase();
  const matchesTarget = (cond) => {
    const v = cond.match(/['"]([^'"]+)['"]/);
    if (!v) return false;
    const val = v[1].trim();
    return val.toUpperCase() === full || val.toLowerCase() === short;
  };

  // Iteratively process innermost IF blocks until no more changes.
  // Pattern matches %%[IF @<var> == '...' THEN]%% ... %%[ENDIF]%% without nested IFs inside.
  const IF_RE = /%%\[\s*IF\s+@\w+\s*==\s*['"][^'"]+['"]\s+THEN\s*\]%%([\s\S]*?)%%\[\s*ENDIF\s*\]%%/gi;
  let prev = null;
  let cur = html;
  let safety = 10;
  while (cur !== prev && safety-- > 0) {
    prev = cur;
    cur = cur.replace(IF_RE, (whole, inner) => {
      // Skip if the inner body itself still contains an IF (wait for inner pass).
      if (/%%\[\s*IF\s+/i.test(inner)) return whole;
      // Split inner into branches by ELSEIF/ELSE while preserving the first IF condition.
      // We need the outer IF's condition to evaluate; regrab from `whole`.
      const firstCond = whole.match(/%%\[\s*IF\s+@\w+\s*==\s*(['"][^'"]+['"])\s+THEN\s*\]%%/i)?.[1] || '';
      const branches = [];
      branches.push({ cond: firstCond, body: '' });
      // Split `inner` on ELSEIF / ELSE markers
      const parts = inner.split(/%%\[\s*(ELSEIF\s+@\w+\s*==\s*['"][^'"]+['"]\s+THEN|ELSE)\s*\]%%/i);
      // parts is interleaved: [body0, marker1, body1, marker2, body2, ...]
      branches[0].body = parts[0];
      for (let i = 1; i < parts.length; i += 2) {
        const marker = parts[i];
        const body = parts[i + 1] || '';
        if (/^ELSE$/i.test(marker.trim())) {
          branches.push({ cond: null, body }); // ELSE branch
        } else {
          const c = marker.match(/(['"][^'"]+['"])/)?.[1] || '';
          branches.push({ cond: c, body });
        }
      }
      const chosen = branches.find(b => b.cond !== null && matchesTarget(b.cond))
                   || branches.find(b => b.cond === null) // ELSE fallback
                   || branches[0];
      return chosen?.body || '';
    });
  }
  return cur;
}

function ensureGemini() {
  if (isGeminiReady()) return;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  initGemini(key);
}

export async function prepareCampaign({
  mc,
  campaignType,
  campaignName,
  brief,
  languages,
  market,
  variant,
  cugoCode = false,
  dateDDMMYY,
  templateShell,
  onProgress = () => {},
}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  ensureGemini();

  const typeDef = CAMPAIGN_TYPES[campaignType];
  if (!typeDef) throw new Error(`Unknown campaign type: ${campaignType}`);

  const templateKey = cugoCode ? 'withCugoCode' : 'noCugoCode';
  const sourceAssetId = typeDef.templates[templateKey] || typeDef.templates.default;
  if (!sourceAssetId) throw new Error(`No template asset for ${campaignType} (${templateKey})`);

  onProgress('resolve-template', { sourceAssetId, type: typeDef.name });
  const { templateHtml, emailName } = await resolveEmailTemplate(mc, sourceAssetId, {
    onProgress: (_s, msg) => onProgress('resolve', { message: msg }),
  });
  const manifest = analyzeBAUTemplate(templateHtml);
  const blockIds = manifest.blockOrder?.allBlocks?.length
    ? manifest.blockOrder.allBlocks
    : (manifest.contentBlockIds || []);

  onProgress('fetch-blocks', { count: blockIds.length });
  // Recursive fetch: Emirates blocks often reference sub-blocks via
  // %%=ContentBlockbyID("X")=%%. We flatten by fetching every referenced
  // block so Claude sees real content instead of placeholder refs.
  const blockMap = new Map(); // id -> { id, name, html }
  const refRe = /%%=ContentBlockbyID\(["'](\d+)["']\)=%%/g;
  const queue = [...blockIds];
  const visited = new Set();

  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    try {
      const asset = await mc.rest('GET', `/asset/v1/content/assets/${id}`);
      const html = asset.views?.html?.content || asset.content || '';
      blockMap.set(id, { id, name: asset.name || `block_${id}`, html });
      onProgress('block', { id, name: asset.name, sizeKb: +(html.length / 1024).toFixed(1) });
      // Enqueue nested refs
      for (const m of html.matchAll(refRe)) {
        if (!visited.has(m[1])) queue.push(m[1]);
      }
    } catch (err) {
      onProgress('block-error', { id, message: err.message });
    }
  }
  onProgress('blocks-fetched', { top: blockIds.length, total: blockMap.size });

  // Pre-inline nested refs inside each top-level block so Claude sees real HTML,
  // not ContentBlockbyID placeholders. Cycle/overflow guarded by depth.
  function inlineRefs(html, depth = 0) {
    if (depth > 6) return html;
    return html.replace(refRe, (_, refId) => {
      const ref = blockMap.get(refId);
      if (!ref) return `<!-- missing ref ${refId} -->`;
      return inlineRefs(ref.html, depth + 1);
    });
  }
  const blocks = blockIds
    .filter(id => blockMap.has(id))
    .map(id => {
      const b = blockMap.get(id);
      return { id: b.id, name: b.name, html: inlineRefs(b.html) };
    });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const wrapped = {};
  const imagesBase64 = {}; // fakeId -> data URI, collected across all variants for push phase later
  const promptToId = {};   // prompt text -> fake asset ID, shared across langs

  for (const lang of languages) {
    onProgress('generate', { language: lang });
    // Pre-resolve language IF/ELSEIF chains so Claude only sees content for
    // the active language. Emirates blocks otherwise include all 25 languages.
    const langBlocks = blocks.map(b => ({
      id: b.id,
      name: b.name,
      html: selectLanguageBranch(b.html, lang),
    }));
    const totalBefore = blocks.reduce((a, b) => a + b.html.length, 0);
    const totalAfter = langBlocks.reduce((a, b) => a + b.html.length, 0);
    onProgress('lang-filter', {
      language: lang, beforeKb: +(totalBefore / 1024).toFixed(1),
      afterKb: +(totalAfter / 1024).toFixed(1),
    });
    console.log(`[phase-a] lang=${lang} blocks: ${(totalBefore/1024).toFixed(0)}KB → ${(totalAfter/1024).toFixed(0)}KB`);

    const filledBlocks = await askClaudeToFillBlocks({
      anthropic, brief, language: lang, market, variant,
      typeDefName: typeDef.name, blocks: langBlocks, onProgress,
    });

    onProgress('resolve-images', { language: lang });
    const rendered = await resolveImageTokens(filledBlocks, imagesBase64, onProgress, promptToId);

    // Concatenate in template order, then wrap in the shell.
    const body = blockIds.map(id => rendered[id] || '').filter(Boolean).join('\n');
    const html = (templateShell || '{{CONTENT}}').replace('{{CONTENT}}', body);

    const wantedSegToken = variant === 'Skywards'
      ? /skw|skywards/i : /ebase|ecommerce/i;
    // One preview per language for now. Segment headers are not differentiated
    // in this preview — the visual content is driven by the brief, not tier.
    wrapped[`${lang}.html`] = { html, approved: false, approved_at: null };
    void wantedSegToken; // reserved for later: per-segment variants if needed
  }

  // Generate DE rows (one per language) from brief + DE schema + image map.
  // These get persisted and fed to fillDERows in phase B. The push phase
  // swaps fakeIds -> real MC asset IDs after uploadImage.
  onProgress('generate-rows', {});
  const placeholderKey = typeDef.placeholderDEs[0].key;
  const schema = await getDEFields(mc, placeholderKey);
  const rows = await generateDERowsFromContext({
    anthropic, typeDef, campaignName, dateDDMMYY, brief,
    languages, market, variant, schema, promptToId, onProgress,
  });

  const slotMap = Object.fromEntries(blockIds.map(id => [id, { type: 'block', filled: true }]));
  onProgress('complete', {
    variantCount: Object.keys(wrapped).length,
    blockCount: blocks.length,
    imageCount: Object.keys(imagesBase64).length,
    rowCount: rows.length,
  });

  return {
    variants: wrapped,
    slotMap,
    sourceAssetId,
    emailName,
    rows,                // DE rows ready for phase B (with fake image IDs)
    imagesBase64,        // persisted so push phase can upload real assets
  };
}

async function generateDERowsFromContext({
  anthropic, typeDef, campaignName, dateDDMMYY, brief,
  languages, market, variant, schema, promptToId, onProgress,
}) {
  const today = () => {
    const d = new Date();
    return `${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCFullYear()).slice(-2)}`;
  };
  const effectiveDate = dateDDMMYY || today();
  const campaignId = `${campaignName}_${typeDef.attr5Code}_${effectiveDate}_in`;

  const imageCatalog = Object.entries(promptToId)
    .map(([prompt, id]) => `  - ${id}: ${prompt}`)
    .join('\n') || '(no images generated)';

  const schemaDigest = schema.map(f => ({
    name: f.name,
    type: f.fieldType,
    pk: f.isPrimaryKey,
    maxLength: f.maxLength,
  }));

  const prompt = `You are producing Marketing Cloud Data Extension rows for an Emirates "${typeDef.name}" campaign.

Brief from user:
${brief?.trim() || '(no brief — use sensible defaults)'}

Targeting:
- languages: ${JSON.stringify(languages)}
- market: ${market}
- variant: ${variant}

DE schema (use these exact field names):
${JSON.stringify(schemaDigest, null, 2)}

Available image assets (already generated — use the numeric ID for any image field):
${imageCatalog}

Output rules:
1. Emit ONE row per language in ${JSON.stringify(languages)}.
2. Primary keys on every row:
     campaign_id = "${campaignId}"
     language    = "<lang code: en|ar|...>"
     tier        = "all"
     global      = "true"
     market_code = "${String(market || '').toLowerCase()}"
3. Populate every field you can fill from the brief — AMPscript guards hide blocks where driver fields are empty, so fill completely for the blocks you want rendered.
4. For image fields (names matching image|logo|hero|masthead|banner), use one of the numeric IDs from the catalog above that best fits. Never invent IDs.
5. For TEXT fields: punchy marketing copy faithful to the brief, within maxLength.
6. For RTL languages (ar, he): translate the text; image IDs stay numeric.
7. For fields you have no content for, OMIT them entirely — do not emit null or empty string.

Respond with EXACTLY this JSON and nothing else (no markdown fences):
{ "rows": [ { row for language 1 }, ... ] }`;

  let text = '';
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });
  stream.on('text', chunk => { text += chunk; });
  await stream.finalMessage();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Row generation: Claude did not return JSON. Got: ${text.slice(0, 400)}`);
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Row generation: malformed JSON — ${err.message}. Head: ${match[0].slice(0, 400)}`);
  }
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === '') delete r[k];
    }
  }
  onProgress('generate-rows:done', {
    count: rows.length,
    sampleFields: rows[0] ? Object.keys(rows[0]).length : 0,
  });
  console.log(`[phase-a] generated ${rows.length} DE rows (${rows[0] ? Object.keys(rows[0]).length : 0} fields each)`);
  return rows;
}

async function askClaudeToFillBlocks({
  anthropic, brief, language, market, variant, typeDefName, blocks, onProgress,
}) {
  const LANG_NAMES = {
    en: 'English', ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish',
    it: 'Italian', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', nl: 'Dutch',
  };
  const langName = LANG_NAMES[language.toLowerCase()] || language;

  const blocksPayload = blocks
    .map(b => `--- BLOCK ${b.id} (${b.name}) ---\n${b.html}`)
    .join('\n\n');

  const prompt = `You are filling content for an Emirates "${typeDefName}" email based on a brief.

Brief from user:
${brief?.trim() || '(no brief — use sensible defaults for this campaign type)'}

Output language: ${langName} (${language}).
Market: ${market}. Variant: ${variant}.

Below is the HTML of every content block from the template, in order. Each block is Emirates HTML with AMPscript tokens like %%=v(@main_header)=%%, %%[IF ...]%%, ContentBlockbyID(...), etc.

YOUR JOB for each block:
1. Decide if the block is relevant to the brief. If NOT, omit it from output.
2. If relevant, emit the block's HTML with:
   - AMPscript variable tokens (%%=v(@foo)=%%, %%=TreatAsContent(@foo)=%%, %%foo%%, {FlightNo}-style runtime tokens) REPLACED with concrete CONTENT in ${langName} faithful to the brief. Headlines, body copy, CTA text, URLs — all must be real.
   - AMPscript control flow (%%[IF ...]%%...%%[ELSE]%%...%%[ENDIF]%%) RESOLVED: pick the branch appropriate for language=${langName}, variant=${variant}, and inline only THAT branch's content (drop the others entirely).
   - Any <img src="..."> whose src points at an AMPscript token or asset placeholder REPLACED with src="[[IMG: detailed English one-sentence description of the image that fits the brief]]".
   - Any unresolvable AMPscript, Lookup(), LookupRows(), Field() calls stripped cleanly — leave the surrounding HTML intact.
3. Preserve HTML layout, tables, inline styles, classes. Do NOT add or remove structural tags.
4. For RTL languages (Arabic, Hebrew): translate all text; keep image prompts in English.
5. Content MUST be specific to the brief — no generic filler, no placeholder copy, no lorem ipsum.
6. Every block you include should contain visible content after substitution. If a block would come out empty or only whitespace, OMIT it.

Blocks (${blocks.length} total, in render order):

${blocksPayload}

Output format — CRITICAL: do NOT use JSON. Use the following delimited plain-text format so large HTML values don't need escaping:

<<<BLOCK:BLOCK_ID>>>
<filled HTML here, raw — no escaping, no fences>
<<<BLOCK:NEXT_ID>>>
<filled HTML>
<<<END>>>

Rules:
- One "<<<BLOCK:ID>>>" line per included block, followed by the raw filled HTML on subsequent lines.
- Close the response with a single "<<<END>>>" line.
- Include ONLY the blocks you chose to render. Omit irrelevant ones entirely.
- Do NOT output JSON, markdown fences, commentary, or any prose outside the block delimiters.`;

  // Streaming is required by the SDK for long-running generations (>10min risk).
  let text = '';
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [{ role: 'user', content: prompt }],
  });
  let lastReport = Date.now();
  stream.on('text', chunk => {
    text += chunk;
    if (Date.now() - lastReport > 2000) {
      onProgress('generate:progress', { language, chars: text.length });
      lastReport = Date.now();
    }
  });
  await stream.finalMessage();

  // Parse delimited text: <<<BLOCK:id>>>\n<html>\n<<<BLOCK:next>>>...<<<END>>>
  // Much safer than JSON for large unescaped HTML values (JSON.parse breaks at
  // ~47KB when Claude fails to escape one of thousands of inline double-quotes).
  const out = {};
  const delimRe = /<<<BLOCK:(\d+)>>>\s*\n([\s\S]*?)(?=\n<<<(?:BLOCK:\d+|END)>>>)/g;
  let pm;
  while ((pm = delimRe.exec(text)) !== null) {
    out[pm[1]] = pm[2];
  }
  if (Object.keys(out).length === 0) {
    throw new Error(
      `Claude response did not match delimited block format. ` +
      `First 400 chars: ${text.slice(0, 400)}`
    );
  }
  const included = Object.keys(out);
  const imageCount = included.reduce((acc, id) => acc + (out[id].match(IMG_TOKEN_RE)?.length || 0), 0);
  onProgress('generate:done', {
    language, includedBlocks: included.length, totalBlocks: blocks.length, imageTokens: imageCount,
  });
  console.log(`[phase-a] Claude filled ${included.length}/${blocks.length} blocks for ${language}, ${imageCount} image tokens`);
  return out;
}

async function resolveImageTokens(filledBlocks, imagesBase64, onProgress, promptToId = {}) {
  const out = {};
  // `promptToId` is shared across calls so the same prompt gets the same fake ID
  // across languages and rounds. Callers can inspect it afterwards to know which
  // fake ID corresponds to which prompt text (needed to wire DE row generation).
  let counter = 900_000_000 + Object.keys(imagesBase64).length;

  for (const [blockId, html] of Object.entries(filledBlocks)) {
    let current = html;
    const tokens = [...html.matchAll(IMG_TOKEN_RE)];
    for (const m of tokens) {
      const promptText = m[1].trim();
      let fakeId = promptToId[promptText];
      if (!fakeId) {
        counter += 1;
        fakeId = String(counter);
        onProgress('image', { blockId, prompt: promptText.slice(0, 80) });
        try {
          const urls = await generateImage(promptText, { aspectRatio: '16:9' });
          if (!urls[0]) throw new Error('Imagen returned no image');
          imagesBase64[fakeId] = urls[0];
          promptToId[promptText] = fakeId;
        } catch (err) {
          onProgress('image-error', { blockId, message: err.message });
          // Leave a visible broken-img marker instead of tanking the whole render
          fakeId = null;
        }
      }
      if (fakeId) {
        current = current.replace(m[0], imagesBase64[fakeId]);
      } else {
        current = current.replace(m[0], '');
      }
    }
    out[blockId] = current;
  }
  return out;
}
