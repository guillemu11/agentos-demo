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

## BAU Campaign Pattern (Route Launch, Partner Offer, Product Offer, etc.)

BAU (Business As Usual) campaigns reuse a shared template with dynamic DE names
constructed at send-time from the email's `__AdditionalEmailAttribute` parameters.

### How attribute parameters build DE names

```ampscript
SET @attribute3 = __AdditionalEmailAttribute3
SET @attribute5 = __AdditionalEmailAttribute5
SET @campaign_name = Substring(@attribute3, 1, Length(@attribute3) - 14)
SET @campaign_type = Substring(@attribute3, Length(@attribute3) - 1, Length(@attribute3))
SET @campaign_code = Substring(@attribute5, 1, Length(@attribute5) - 7)
SET @campaign_date = Substring(@attribute5, Length(@attribute5) - 5, Length(@attribute5))
SET @campaign_id = Concat(@campaign_name, '_', @campaign_code, '_', @campaign_date, '_', @campaign_type)
```

The Content DE name is: `{campaign_name}_{campaign_date}_RL_DynamicContent`
The Audience DE name is: `{campaign_name}_{campaign_date}_TargetAudience_DE`

**Example (HKG RouteLaunch):**
- campaign_name = `hkawrhellaunchmar26`
- campaign_date = `230326`
- Content DE = `hkawrhellaunchmar26_230326_RL_DynamicContent`
- Campaign ID = `hkawrhellaunchmar26_CCROUTELCH_230326_in`

### Content DE primary keys

The Content DE uses a composite PK: `campaign_id × language × market_code × tier`

Tier values:
- `skw` — Skywards members only
- `ebase` — Non-members only
- `both` — Same content for all tiers (common in Route Launch)

When tier="both" exists, AMPscript overrides `@tier_key` to "both" for ALL subscribers.

### Content DE lookup in AMPscript

```ampscript
SET @Email_DynamicContent = LookupRows(@RL_DynamicContent,
    'language', Lowercase(@lm_code),
    'market_code', Lowercase(@country),
    'campaign_id', Lowercase(@campaign_id),
    'tier', @tier_key)
```

**Important:** The DE name is a *variable* (`@RL_DynamicContent`), not a string literal.
Our `parseDELookups()` regex only catches string literals, so the analyzer returns
an empty manifest for BAU campaigns. You must discover the DE names manually via SOAP
search (`Name like 'RL_DynamicContent'`) or construct them from the attribute parameters.

### Header logic (v2 vs v3, independent of tier)

The header block uses `@headerver`, NOT `@tier_key`:
- `v3` = Skywards members (IO, Platinum, Gold, Silver, Blue) — shows Skywards bar with tier name + miles
- `v2` = Non-members — no Skywards bar

Within v3, the tier name and miles balance are subscriber-specific (personalized at render).

### Variant matrix for BAU campaigns

```
Variants = languages × header_types × (optional: tier-specific content)
```

Typical Route Launch: 2 languages × 2 headers = 4 variants (content is tier="both")
Typical Partner Offer: 3 languages × 2 headers × 2 tiers = 12 variants

### VAWP DE for BAU

BAU campaigns use a shared VAWP: `'BAU CS Master dataset'` (not campaign-specific).
This DE has subscriber data including `country_of_residence`, `per_language`, `loy_tier_code`.

### Block layout pattern (Route Launch)

```
1.  GA Tracking (block 20603)
2.  Header v2/v3 by language (block 16618 → language-specific sub-blocks)
3.  Spacer + Masthead (when no fares)
4.  Masthead body copy by language (block 18129)
5.  Fare blocks (conditional: 2-class YJ / 2-class JF / 3-class)
6.  Offer block (conditional)
7.  Story left circle (conditional)
8.  Double story 1+2 from Stories_Ref_Table (conditional)
9.  Double story 3+4 inline from content DE (conditional)
10. Rolling Static Content (market-dependent: worry-free / travel-hub / emirates-exp / before-travel)
11. Global spacer
12. Footer by language (block 39445)
13. Terms by language (block 17372)
14. Caveat (block 35063)
15. ODR (block 36843)
```

### Working with BAU campaigns in the pipeline

Since the analyzer can't discover dynamic DEs, use this workflow:

1. **Resolve template** normally: `resolveEmailTemplate(mc, assetId)` → gets the codesnippet block
2. **Search for DEs** via SOAP: filter `Name like 'RL_DynamicContent'` to find all BAU DEs
3. **Query the content DE** via REST: merge `keys + values` (PKs are in `item.keys`, not `item.values`)
4. **Manually construct the manifest** with the discovered DE names and block IDs
5. **Fetch blocks recursively** — BAU template (e.g., block 43026) references 25+ logic blocks
6. **Render** using the standard renderer with the manual manifest

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
