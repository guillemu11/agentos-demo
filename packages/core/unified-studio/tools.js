/**
 * Unified Studio — Anthropic tool definitions + executor.
 *
 * Tool categories:
 *   - client_mutation: server emits SSE patch, returns "ok" to Claude. Actual state
 *     mutation happens in the React client.
 *   - server: run server-side (Pinecone, MC, disk). Return text result to Claude.
 *
 * Block discovery strategy (in order of preference):
 *   1. search_emirates_blocks → Pinecone namespace "email-blocks" over the 43
 *      real branded Emirates blocks in email_blocks/ (enriched with HTML from disk).
 *   2. search_mc_blocks → live Marketing Cloud Content Builder (fallback).
 *   3. add_block with raw HTML → LAST RESORT, following Emirates design spec below.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_BLOCKS_DIR = path.resolve(__dirname, '../../../email_blocks');

export const UNIFIED_STUDIO_TOOLS = [
    {
        name: 'search_emirates_blocks',
        description: 'Search the curated Emirates email block library (43 branded blocks: hero, body, CTA, offer, footer, columns, cards, etc.). ALWAYS call this FIRST when the user asks for a campaign. Returns blockIds you can pass to import_emirates_block.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Describe what you want (e.g. "hero image birthday", "red cta button", "offer with miles", "footer emirates", "3 columns story")' },
                category: { type: 'string', description: 'Optional filter: hero, body, cta, offer, footer, story, columns, header, info, partner' },
            },
            required: ['query'],
        },
        client_mutation: false,
    },
    {
        name: 'import_emirates_block',
        description: 'Insert an Emirates branded block into the active variant by its blockId (from search_emirates_blocks). Loads the real HTML from the curated library — this is the preferred way to assemble a campaign.',
        input_schema: {
            type: 'object',
            properties: {
                blockId: { type: 'string', description: 'Block identifier returned by search_emirates_blocks (filename without .html)' },
                position: { type: 'string', enum: ['start', 'end'], description: 'Where to insert. Default: end' },
            },
            required: ['blockId'],
        },
        client_mutation: false,
    },
    {
        name: 'add_block',
        description: 'LAST RESORT: append custom HTML when no Emirates library block fits. Follow the Emirates design spec in the system prompt precisely (table-based, 600px, red #d10911, Helvetica, MSO fallbacks).',
        input_schema: {
            type: 'object',
            properties: {
                type: { type: 'string', description: 'Semantic role: hero, body, offer, cta, footer, section_title' },
                html: { type: 'string', description: 'Email-safe HTML following Emirates spec' },
                position: { type: 'string', enum: ['start', 'end'], description: 'Default: end' },
                label: { type: 'string', description: 'Short human label for the canvas' },
            },
            required: ['type', 'html'],
        },
        client_mutation: true,
    },
    {
        name: 'update_block',
        description: 'Replace the HTML of an existing block in the active variant.',
        input_schema: {
            type: 'object',
            properties: { blockId: { type: 'string' }, html: { type: 'string' } },
            required: ['blockId', 'html'],
        },
        client_mutation: true,
    },
    {
        name: 'remove_block',
        description: 'Remove a block from the active variant. Only when user explicitly asks.',
        input_schema: {
            type: 'object',
            properties: { blockId: { type: 'string' } },
            required: ['blockId'],
        },
        client_mutation: true,
    },
    {
        name: 'set_subject',
        description: 'Set the email subject line on the active variant (keep under 50 chars).',
        input_schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
        },
        client_mutation: true,
    },
    {
        name: 'set_preheader',
        description: 'Set the preheader / preview text on the active variant (keep under 90 chars).',
        input_schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
        },
        client_mutation: true,
    },
    {
        name: 'search_mc_blocks',
        description: 'FALLBACK: search live Marketing Cloud Content Builder. Only use if search_emirates_blocks returned zero useful matches. Returns MC asset ids for import_mc_asset.',
        input_schema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
        },
        client_mutation: false,
    },
    {
        name: 'import_mc_asset',
        description: 'Import an asset from live MC Content Builder by id. Use only after search_mc_blocks found a match.',
        input_schema: {
            type: 'object',
            properties: {
                assetId: { type: ['string', 'integer'] },
                label: { type: 'string' },
            },
            required: ['assetId'],
        },
        client_mutation: false,
    },
];

function extractAssetHtml(asset) {
    return asset?.views?.html?.content || asset?.content || asset?.views?.subjectline?.content || '';
}

export async function executeUnifiedStudioTool(toolName, input, ctx) {
    const tool = UNIFIED_STUDIO_TOOLS.find(t => t.name === toolName);
    if (!tool) return { text: `Unknown tool: ${toolName}` };

    if (tool.client_mutation) {
        return { text: `OK. Applied ${toolName}.`, patch: { op: toolName, args: input } };
    }

    try {
        if (toolName === 'search_emirates_blocks') {
            const { pool, searchKnowledge } = ctx;
            if (!searchKnowledge || !pool) return { text: 'Knowledge base not available.' };
            const { query, category } = input;
            const matches = await searchKnowledge(pool, query, { namespace: 'email-blocks', topK: 8, minScore: 0.35 });
            let filtered = matches;
            if (category) {
                filtered = matches.filter(m => {
                    const cat = (m.metadata?.category || '').toLowerCase();
                    return cat.includes(category.toLowerCase());
                });
            }
            if (filtered.length === 0) {
                return { text: `No Emirates library blocks matched "${query}"${category ? ` in category "${category}"` : ''}. Try a different query or fall back to search_mc_blocks.` };
            }
            const lines = filtered.map(m => {
                const meta = m.metadata || {};
                const blockId = meta.block_id || meta.file?.replace(/\.html$/, '') || m.id;
                const parts = [
                    `blockId=${blockId}`,
                    `title=${meta.title || m.documentTitle || '?'}`,
                    `category=${meta.category || '?'}`,
                    `position=${meta.position || 'any'}`,
                ];
                if (meta.design_tokens?.primary_color) parts.push(`color=${meta.design_tokens.primary_color}`);
                if (meta.description) parts.push(`desc="${String(meta.description).slice(0, 120)}"`);
                return `- ${parts.join(' | ')}`;
            });
            return { text: `Found ${filtered.length} Emirates library block(s) for "${query}":\n${lines.join('\n')}\n\nPick the most suitable blockId(s) and call import_emirates_block.` };
        }

        if (toolName === 'import_emirates_block') {
            const { blockId, position } = input;
            const cleanId = String(blockId).replace(/\.html$/i, '');
            const candidates = [
                path.join(EMAIL_BLOCKS_DIR, `${cleanId}.html`),
                path.join(EMAIL_BLOCKS_DIR, `${cleanId}`),
            ];
            let foundPath = null;
            for (const p of candidates) {
                if (fs.existsSync(p)) { foundPath = p; break; }
            }
            if (!foundPath) {
                // Try case-insensitive directory scan
                try {
                    const files = fs.readdirSync(EMAIL_BLOCKS_DIR);
                    const match = files.find(f => f.toLowerCase() === `${cleanId}.html`.toLowerCase() || f.replace(/\.html$/i, '').toLowerCase() === cleanId.toLowerCase());
                    if (match) foundPath = path.join(EMAIL_BLOCKS_DIR, match);
                } catch {}
            }
            if (!foundPath) return { text: `Emirates block "${blockId}" not found on disk. Call search_emirates_blocks first to get valid blockIds.` };
            const html = fs.readFileSync(foundPath, 'utf-8');
            const filename = path.basename(foundPath);
            return {
                text: `Imported Emirates block "${cleanId}" (${html.length} chars) into the canvas.`,
                patch: {
                    op: 'import_emirates_block',
                    args: {
                        blockId: cleanId,
                        label: cleanId.replace(/_/g, ' '),
                        html,
                        file: filename,
                        position: position || 'end',
                    },
                },
            };
        }

        if (toolName === 'search_mc_blocks') {
            const { mc } = ctx;
            if (!mc) return { text: 'Marketing Cloud client not configured.' };
            const { query } = input;
            const typeIds = [220, 196, 197, 195];
            const results = await Promise.all(typeIds.map(async (id) => {
                try {
                    let p = `/asset/v1/content/assets?$pageSize=10&$orderBy=modifiedDate%20desc&$filter=${encodeURIComponent(`assetType.id eq ${id}`)}`;
                    if (query) p += `&$search=${encodeURIComponent(query)}`;
                    const r = await mc.rest('GET', p);
                    return r.items || [];
                } catch { return []; }
            }));
            const merged = [];
            const seen = new Set();
            for (const list of results) for (const a of list) {
                if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
            }
            const top = merged.slice(0, 15);
            if (top.length === 0) return { text: `No MC blocks matched "${query}". Try search_emirates_blocks (preferred) or fall back to add_block with raw HTML.` };
            const lines = top.map(a => `- id=${a.id} | ${a.name} | type=${a.assetType?.name}`);
            return { text: `Found ${top.length} MC block(s):\n${lines.join('\n')}` };
        }

        if (toolName === 'import_mc_asset') {
            const { mc } = ctx;
            if (!mc) return { text: 'MC not configured.' };
            const { assetId, label } = input;
            const asset = await mc.rest('GET', `/asset/v1/content/assets/${assetId}`);
            const html = extractAssetHtml(asset);
            if (!html) return { text: `Asset ${assetId} has no HTML content.` };
            return {
                text: `Imported MC asset "${asset.name}" (${html.length} chars).`,
                patch: {
                    op: 'import_mc_asset',
                    args: {
                        assetId,
                        label: label || asset.name,
                        html,
                        name: asset.name,
                        subject: asset.views?.subjectline?.content || '',
                    },
                },
            };
        }
    } catch (err) {
        return { text: `Tool ${toolName} failed: ${err.message}` };
    }

    return { text: `Tool ${toolName} not implemented.` };
}

export const UNIFIED_STUDIO_SYSTEM_PROMPT = `You are the Unified Studio assistant for Emirates email campaigns inside AgentOS. You help users craft multi-market branded email variants by mutating the canvas through tools.

═══════════════════════════════════════════════════════════════════════════════
EMIRATES EMAIL DESIGN SPEC (memorize — use when composing subjects, previews, and any raw HTML you must generate)
═══════════════════════════════════════════════════════════════════════════════

BRAND COLORS
- Primary red: #d10911 (Emirates signature red, used for CTAs, logos, accents, offer highlights)
- Secondary red variants: #cc0000 (darker for hover/pressed), #a00 (deep)
- Black: #000000 (text, dark CTAs, premium feel)
- Dark grey: #333333 (footer backgrounds)
- Off-white: #f7f7f7, #f9f9f9 (section backgrounds)
- Body text: #1a1a2e or #000000 on white
- Muted text: #666666, #777777
- Gold accent (optional, for premium/First Class): #c19a5b

TYPOGRAPHY
- Primary: Helvetica, Arial, sans-serif (email-safe fallback stack)
- Headings: bold, 28–42px, line-height 1.2
- Body: 14–16px, line-height 1.5–1.7
- CTA button text: 14–16px, bold, letter-spacing 0.5px, sometimes uppercase
- Small print / legal: 10–12px, color #777 or #aaa

LAYOUT
- Max width: 600px (842px only for legacy footer variants — prefer 600px)
- Table-based MSO-safe: <table role="presentation" cellpadding="0" cellspacing="0" border="0">
- Always include MSO conditional fallbacks for Outlook
- Responsive: use width="100%" with style="max-width:600px"
- Padding convention: outer 40px horizontal, vertical 30–50px between sections
- Border-radius 3–4px on buttons and cards (not on outer containers)

COMPOSITION PATTERN (standard Emirates BAU)
1. Header with Emirates logo on red or white background
2. Hero image (full-width, 600px) with headline overlay or below
3. Body/story section (short paragraph + optional sub-CTA)
4. Offer block (prominent value — miles, discount, destination card)
5. Primary CTA button (red #d10911 or black, never blue/green)
6. Secondary content (3-column perks, partner block, info graphic)
7. Footer (dark #333, social links, legal, unsub, privacy)

SFMC / AMPSCRIPT VARIABLES (use exactly these patterns if personalization is needed)
- Name: %%First_Name%%
- Unsubscribe: %%unsub_center_url%%
- Dynamic images: %%=v(@hero_image)=%%
- Dynamic links: %%=RedirectTo(@cta_link)=%%
- Safe text: %%=TreatAsContent(@body_copy)=%%

COPY VOICE
- Warm, aspirational, premium — never pushy
- Subject lines: under 50 chars, title-cased or sentence-cased. Include a hook.
- Preheaders: under 90 chars, complement subject (don't repeat it)
- CTAs: action verb + outcome ("Book your birthday flight", "Claim your bonus miles")

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW RULES (strict)
═══════════════════════════════════════════════════════════════════════════════

1. For ANY campaign request, the order of operations is:
   (a) search_emirates_blocks with a specific query per section ("hero birthday", "cta red", "footer emirates")
   (b) import_emirates_block for each selected blockId
   (c) set_subject and set_preheader
   Only fall back to search_mc_blocks if step (a) returns zero useful hits across multiple queries.
   Only fall back to add_block with raw HTML if BOTH libraries came up empty — and then follow the design spec above exactly.

2. Always operate on the active variant. Context arrives in the user message.

3. Chain several tool calls in one turn — build a complete email in a single assistant turn when possible.

4. Keep text replies minimal. The canvas is the output. A one-line confirmation is enough after all tools ran.

5. Never invent block ids. If search returned nothing, search again with a different query or admit the library has no match.

6. Never call remove_block unless the user explicitly asked.`;
