# HTML Developer Agent — Block Ingestion & Agent Intelligence

**Date:** 2026-04-03  
**Status:** Approved  
**Related spec:** `2026-04-03-content-email-studio-design.md` (Email Studio UI layout)

---

## Context

The Email Studio already has a full-screen UI (see related spec) and an `html-developer` agent in the DB. However:
- Pinecone's `email-blocks` namespace has only 11 hardcoded blocks with minimal descriptions
- The agent's system prompt is basic — it lacks Emirates design system knowledge and a defined workflow
- 41 real Emirates HTML blocks now exist in `email_blocks/` and need proper ingestion with semantic descriptions

The goal is to make the HTML Developer agent genuinely useful: it must understand the Emirates email design system, find the right blocks from RAC, compose a plan, and produce production-ready HTML — with space reserved for A/B Studio and Block Studio in future versions.

---

## Decisions Made

| Question | Decision |
|---|---|
| Agent composition mode | Block Assembler + Modifier (uses RAC blocks, can adapt them) |
| Agent workflow | Plan first (list blocks) → confirm → generate HTML |
| Block analysis | Claude Haiku analyzes each HTML file → generates semantic description |
| Ingest endpoint | Modify existing `POST /api/knowledge/ingest-email-blocks` — dynamic, not hardcoded |
| System prompt | Rich: embeds Emirates design system + workflow + modification rules |
| Future expansion | Agent modes reserved: `variant` (A/B), `clone-style`, `creative` (Block Studio) |

---

## Part 1 — Block Ingestion Pipeline

### Endpoint: `POST /api/knowledge/ingest-email-blocks`

**Behavior (new):**
1. Delete all docs + vectors in Pinecone namespace `email-blocks` (idempotent reset)
2. Read all `.html` files from `email_blocks/` directory
3. For each file, call Claude Haiku with the HTML to generate a structured description (JSON)
4. Embed the description text with Gemini → upsert vector in Pinecone
5. Save full HTML to `knowledge_chunks.content` in PostgreSQL
6. Return `{ ingested: N, errors: [] }`

**Uses Haiku** (not Sonnet) for the 41 analysis calls — structured HTML is easy for Haiku.

### Block Schema (per vector)

Each block stored with this metadata in Pinecone:

```json
{
  "name": "global-cta-red",
  "title": "CTA Rojo — Botón de acción Emirates",
  "category": "cta",
  "position": "body | footer",
  "design_tokens": {
    "primary_color": "#c60c30",
    "text_color": "#ffffff",
    "font": "Helvetica Neue Bold"
  },
  "sfmc_variables": ["%%=RedirectTo(...)=%%", "%%LINK_TEXT%%"],
  "compatible_with": ["body-copy", "offer-blocks", "story-blocks"]
}
```

The **embeddable text** is a rich semantic description Claude generates per block, including:
- What the block is visually
- When to use it
- Typical position in an email
- Compatible blocks before/after
- Design tokens used
- SFMC variable placeholders

The **HTML source** is stored in `knowledge_chunks.content` in PostgreSQL — not in the vector.

### Claude Haiku prompt for block analysis

```
Analyze this Emirates email HTML block and return a JSON object with:
- name: kebab-case identifier from filename
- title: human-readable Spanish title
- category: one of [header, hero, body-copy, story, offer, cta, article, infographic, card, columns, flight, partner, section-title, footer]
- position: where in email it appears (e.g. "top", "body", "footer", "any")
- description: 3-5 sentence semantic description in Spanish — what it shows, when to use it, compatible contexts
- design_tokens: { primary_color, text_color, background_color, font }
- sfmc_variables: array of SFMC variable patterns found
- compatible_with: array of category names that work well before/after this block

HTML:
{html_content}
```

### Block categories (41 blocks)

| Category | Blocks (examples) |
|---|---|
| header | skw_header, Ebase_header, Global_header_title_v1, v2, v3 |
| hero | Global_Hero_Image |
| body-copy | Global_body_copy, Global_Body_Copy_CTA_black, Global_Body_Copy_CTA_red |
| section | Global_Section_Title |
| story | Global_Double_Story, Global_Double_Story_wCTA, Global_Single_Story_Left_Attached, Global_Single_Story_Left_noCTAnoSub, Global_Single_Story_noSubheader, story_left_circle, story_left_circle_btn, Global_story_right_circle_btn |
| offer | Global_offer_area, Global_offer_area_noImage, Global_offer_block, Global_Offer_Block_noCTA, Global_Offer_Block_noCTA_subheader, EN_Global_Offer_Block_noCTA_subheader, offers_card_double, offers_card_double_NoImage |
| cta | Global_CTA_black, Global_CTA_red, 3CTAs_block |
| article | Global_Article_Block, Global_Article_image_NoSubheader |
| infographic | InfoGraphic_Left, InfoGraphic_Right |
| card | Card_Single_Full |
| columns | 2_columns_block, 3columns_story_triple, 3Columns_Story_Triple_noBody |
| flight | Flight_Route |
| partner | partner_block |
| footer | Global_footer |

Note: final categorization is determined dynamically by Claude Haiku during ingestion — these are guidance only.

---

## Part 2 — HTML Developer Agent System Prompt

The `html-developer` agent record in the `agents` DB table gets a new `system_prompt` and updated `rag_namespaces: ['email-blocks', 'brand']`.

### System prompt structure (4 blocks)

#### Block 1 — Role & identity
```
You are the Emirates HTML Email Developer. You design transactional and campaign emails 
for Emirates Airlines following the official design system. You build emails by assembling 
blocks from the knowledge base (RAC), personalizing them for the segment and campaign, 
and never deviating from the design system without explicit permission.

Current mode: assemble
```

#### Block 2 — Emirates Design System (embedded)
```
EMIRATES DESIGN SYSTEM:

Colors:
- Red (primary action): #c60c30
- Black (text/dark CTA): #000000  
- Dark gray (body text): #333333
- White (backgrounds): #ffffff
- Light gray (alt background): #F7F7F7
- Border gray: #e1e1e1
- Subheader gray: #666666

Typography:
- Headers/titles: Emirates-Bold or Emirates-Medium
- Body text: Helvetica Neue, weight 300, 14px, line-height 22px
- Dark text on white: #333333 or #151515
- Subheaders: 10px uppercase, letter-spacing

Cards/containers:
- Border: 1px solid #e1e1e1
- Box shadow: 0 2px 4px 2px rgba(0,0,0,0.10)
- Border radius: 3px
- Red separator bars: 2px height, #c60c30, 100px wide centered

Layout:
- Max width: 642px
- Responsive: uses .stack-column class for mobile
- MSO conditionals: always preserve for Outlook compatibility

SFMC variables:
- Content: %%=v(variable_name)=%%
- URLs/redirects: %%=RedirectTo(CloudPagesURL(...))=%%
- Personalization: %%FirstName%%, %%MEMBER_TIER%%
```

#### Block 3 — Workflow (mode: assemble)
```
WORKFLOW — follow this exactly:

1. Read the email request carefully (campaign type, segment, tone, content)
2. Search the knowledge base for relevant blocks by category and semantic match
3. Present your proposed block structure:
   "📋 Estructura propuesta para [email name]:
   1. [block name] — [reason]
   2. [block name] — [reason]
   ...
   ¿Procedo con esta estructura?"
4. Wait for confirmation before generating HTML
5. Assemble the blocks in order, applying modifications:
   - Replace placeholder text with campaign-specific copy
   - Update URLs with correct SFMC redirect variables
   - Adjust colors within the Emirates palette if needed
   - Add/remove sections within a block if required
6. Return the complete assembled HTML
```

#### Block 4 — Modification rules + future modes
```
MODIFICATION RULES (mode: assemble):
✅ You MAY change: copy text, URLs, colors within Emirates palette, image placeholders
✅ You MAY add or remove sections within a block (e.g. remove subheader row)
✅ You MAY adjust font sizes within defined ranges
❌ You MUST NOT invent CSS classes outside the design system
❌ You MUST NOT change the responsive structure or MSO conditionals
❌ You MUST NOT use colors outside the Emirates palette

FUTURE MODES (reserved — not active):
- variant: generates style variants for A/B testing with style_override parameter
- clone-style: creates new blocks following Emirates patterns
- creative: unrestricted HTML generation for special campaigns
```

---

## Expansion Roadmap

### v2 — A/B Studio
- Add `mode: variant` to agent — receives `style_override` JSON, swaps `design_tokens` in blocks
- `email_proposals.variant_name` + `parent_proposal_id` already in DB — no migration needed
- Block schema's `design_tokens` field enables token-swapping without HTML changes

### v3 — Block Studio
- Add `mode: clone-style` — agent creates new blocks following Emirates patterns (reads existing blocks as training examples from RAC)
- Add `mode: creative` — unrestricted HTML generation
- New blocks created → ingested into `email-blocks` namespace → automatically available to all agents

---

## Files to Modify

| File | Change |
|---|---|
| `apps/dashboard/server.js` | Replace hardcoded blocks in `ingest-email-blocks` handler with dynamic `email_blocks/` directory reader + Claude Haiku analysis |
| `agents` DB row: `html-developer` | Update `system_prompt` with 4-block structure above; set `rag_namespaces = ['email-blocks', 'brand']` |

**No new files needed.** The `email_blocks/` directory already exists with 41 `.html` files.

---

## Verification

1. Call `POST /api/knowledge/ingest-email-blocks` → response shows `{ ingested: 41, errors: [] }`
2. Call `POST /api/knowledge/search` with `{ query: "botón rojo de acción", namespace: "email-blocks" }` → returns `global-cta-red` or `global-cta-black` as top results
3. Call with `{ query: "cabecera Skywards con logo" }` → returns `skw_header`
4. Call with `{ query: "mostrar información de vuelo con origen y destino" }` → returns `flight-route`
5. Open Email Studio → chat with html-developer → ask for an Abandoned Cart email → agent proposes block structure, waits for confirmation, then generates complete HTML
6. HTML renders correctly in the email preview panel
