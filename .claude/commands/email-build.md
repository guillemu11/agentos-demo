# Email Builder — Emirates Campaign Generator

Build renderable HTML email variants from any Emirates Marketing Cloud email.
Given an asset ID, automatically extracts the AMPscript from the email's slot,
resolves all blocks, fetches content from DEs, and generates preview-ready HTML.

## Pipeline

```
Phase 0: Resolve → extract AMPscript from templatebasedemail slots
Phase 1: Analyze → parse AMPscript → campaign manifest (blocks, DEs, variants, VAWP)
Phase 2: Fetch   → MC API → real block HTML + DE content + image CDN URLs
Phase 3: Render  → manifest + data → static HTML per variant
```

## How to use

The user provides an **asset ID**, **email name**, or **campaign name**.

### Step 0: Resolve the email template

```javascript
import { resolveEmailTemplate } from '../packages/core/email-builder/index.js';
const { templateHtml, emailName } = await resolveEmailTemplate(mcClient, assetId);
```

**Critical: Emirates emails are `templatebasedemail` assets.** The actual AMPscript
is NOT in `views.html.content` (that's the template shell). It's in:
`views.html.slots.{slotKey}.blocks.{blockKey}.content`

Each slot block can be:
- A `ContentBlockbyID("XXXXX")` reference → fetch the referenced asset
- Inline AMPscript/HTML content → use directly
- Mix of both (e.g., inline logic + GA tracking reference)

### Step 1: Analyze

```javascript
import { analyzeTemplate } from '../packages/core/email-builder/index.js';
const manifest = analyzeTemplate(templateHtml);
```

The manifest contains: contentBlockIds, dataExtensions, variables, variants (segments + headerTypes), VAWP DE config, blockOrder.

### Step 2: Fetch MC data

```javascript
import { fetchCampaignData } from '../packages/core/email-builder/index.js';
const data = await fetchCampaignData(manifest, mcClient, { language: 'en' });
```

This fetches:
- **Content blocks**: resolved recursively through language branches (logic block → EN sub-block → real HTML)
- **Header variants**: dual branch resolution for skw/ebase header types
- **Data Extensions**: all rows (no language filter — renderer filters per variant)
- **VAWP DE**: subscriber sample data for personalization
- **Language ref DE**: Culture_code → language name mapping
- **Image CDN URLs**: batch resolution of all numeric image IDs found in any DE field

### Step 3: Render variants

```javascript
import { generatePreviewVariants } from '../packages/core/email-builder/index.js';
const previews = generatePreviewVariants({ manifest, data, templateShell, options });
```

Or use the one-shot orchestrator:

```javascript
import { buildCampaignEmails } from '../packages/core/email-builder/index.js';
const result = await buildCampaignEmails({ assetId: 45696, mcClient, templateShell });
```

### Step 4: Preview server (optional)

```bash
node tmp-mc-preview/preview-server.js <assetId> [--lang=en] [--port=3333]
```

Opens a localhost preview with arrow navigation between variants, subscriber info sidebar, and live email rendering in an iframe.

## Critical learnings from Emirates patterns

### Block resolution (2-3 levels of nesting)
Emirates uses nested logic blocks:
1. **Level 1**: Template references `ContentBlockbyID("42706")` → "Dynamic Centralized Header Logic"
2. **Level 2**: Logic block has `IF @language == "ENGLISH" THEN ContentBlockbyID("42705")`
3. **Level 3** (header only): Header logic has `IF @headerver == "skw" THEN ContentBlockbyID("42703")`

The fetcher resolves all levels recursively via `resolveLanguageBranch()` and `resolveDualBranch()`.

### Block content location varies by asset type
- `htmlblock` (197): content in `views.html.content`
- `freeformblock` (195): content in `asset.content` (NOT views.html)
- `codesnippetblock` (220): content in `views.html.content`
- `templatebasedemail` (207): AMPscript in `views.html.slots.*.blocks.*.content`

The fetcher uses `asset.views?.html?.content || asset.content || ''` to handle all types.

### Language codes are inconsistent across DEs
| DE | Language format | Example |
|----|----------------|---------|
| DynamicContent | UPPERCASE full name | `ENGLISH`, `ARABIC` |
| Stories_Ref_Table | lowercase short code | `en`, `ar` |
| REF_Salutation | lowercase short code | `en`, `ar` |
| Header/Footer | UPPERCASE full name | `ENGLISH` |

The renderer uses `findByLang()` with a mapping table to try all variants.

### Image resolution
Emirates uses `ContentImagebyID(@asset_id)` in AMPscript to render images.
Our pipeline resolves these via REST: `GET /asset/v1/content/assets/{id}` → `fileProperties.publishedURL`.

Image IDs appear in:
- Content DEs: `main_hero_image`, `story_image_circle`, `story_image`, `story_image_single`
- Header DE: `header_logo`, `header_login_logo`
- Footer DE: `logo_image`

The `collectImageIds()` scans ALL DE rows for any field whose name matches `image|logo|hero|icon` and whose value is a numeric ID.

### VAWP (subscriber data)
Each email references a VAWP DE: `SET @VAWP_person_DE = 'Ebase_Email_Ask_VAWP'`
This DE has subscriber data (first_name, Culture_code, Country_code) that drives personalization.
The pipeline queries it to get sample subscribers for generating preview variants.

### Body copy personalization
- Subject line: `[#]` → replaced with first_name
- Body copy: `{FirstName}` → replaced with first_name
- Salutation: `REF_Salutation_Language` DE → "Hello {first_name}," prepended to body

### Template shell RTL/LTR
`template_style.html` has inline conditionals like:
```
%%[IF @language == 'ARABIC' THEN]%%right%%[ELSE]%%left%%[ENDIF]%%
```
Use `cleanTemplateShell()` to resolve these BEFORE stripping — otherwise you get `rightleft`.

### Story variable mapping
| DC field | Block variable | Block type |
|----------|---------------|------------|
| story1-3 | story{N}_image, story{N}_header, etc. | 3-column circle |
| story4-6 (set2) | story{N}_set2_image → remapped to story{N} | 3-column circle (2nd) |
| story4 | story_right_circle_image, _header, _cta | story_right_circle_btn |
| cash_miles | story_left_circle_image, _header, _cta | story_left_circle_btn |
| destination_generic | story_single_image, _header, _cta | single_story_left |

### Body copy block (special rendering)
The body_copy block uses `IF Length(@before_link1) > 0 THEN TreatAsContent(@before_link1)` —
complex AMPscript that can't be resolved by simple strip+replace.
Auto-detected by checking if block HTML contains `@before_link1`, then rendered via `renderBodyCopyBlock()`.

## Key files

- `packages/core/email-builder/index.js` — Public API
- `packages/core/email-builder/analyzer.js` — Phase 1: template → manifest
- `packages/core/email-builder/fetcher.js` — Phase 2: MC API data + slot resolution
- `packages/core/email-builder/renderer.js` — Phase 3: blocks + data → HTML variants
- `packages/core/email-builder/ampscript.js` — AMPscript parsing utilities
- `packages/core/email-builder/image-resolver.js` — Image ID → CDN URL batch resolution
- `packages/core/mc-api/client.js` — MC REST + SOAP client
- `tmp-mc-preview/preview-server.js` — Localhost preview server with navigation

## Arguments

$ARGUMENTS
