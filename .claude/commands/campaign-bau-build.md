# BAU Campaign Builder — Emirates Campaign Creation

Build a complete BAU campaign in Marketing Cloud from a brief.
Given a campaign type and content, automatically creates folder hierarchy,
duplicates the email template, duplicates placeholder DEs, generates images,
fills content, and produces a preview.

## How to use

The user provides a **campaign type** and a **brief** (market, content, languages).

### Step 0: Determine campaign parameters

From the user's request, resolve:
- **Campaign type** — one of the keys in `CAMPAIGN_TYPES` (see registry below)
- **Campaign name** — lowercase identifier, e.g. `gcceksummerdubai2026`
- **Date** — DDMMYY format for DE names, YYYYMMDD for folder names
- **Market** — market code (e.g. `GCC`, `UK`, `IN`, `GL` for global)
- **Variant** — `Ecommerce` (default) or `Skywards`
- **Direction** — `in` (default) or `ou` for outbound
- **Languages** — which languages to fill (default: ENGLISH)
- **CugoCode** — `false` by default unless specified

### Step 1: Create the campaign

```javascript
import {
  ensureFolderHierarchy,
  duplicateEmail,
  duplicateAllDEs,
  uploadImage,
  fillDERows,
  CAMPAIGN_TYPES,
} from '../packages/core/campaign-builder/index.js';
```

**Pipeline:**

1. `ensureFolderHierarchy(mc, config)` — creates CB folders via REST, finds DE folders via SOAP
2. `duplicateEmail(mc, config)` — copies template with new name and __AdditionalEmailAttribute values
3. `duplicateAllDEs(mc, type, name, date, folderId)` — creates new DEs with same schema as placeholders
4. Generate images with Gemini Imagen (nano-banana) → `uploadImage(mc, config)` to MC
5. `fillDERows(mc, deKey, rows)` — upserts content rows (auto-discovers PKs)

### Step 2: Email attributes format

```
Attribute1: "pr"                              (fixed - tracking)
Attribute2: "ek" or "sk"                      (Ecommerce vs Skywards)
Attribute3: "{campaignName}_deploydate_{dir}"  (name + padding + direction)
Attribute4: "xx"                              (fixed - unused)
Attribute5: "CC{TYPECODE}_{DDMMYY}"           (campaign code + date)
```

### Step 3: Content DE row structure

Each row needs primary keys: `campaign_id`, `language`, `tier`, `global` (+ `market_code` for some).

**campaign_id format:** `{campaignName}_{attr5Code}_{DDMMYY}_{direction}`

**Common content fields** (fill all that are available in the DE schema):

| Block | Fields |
|-------|--------|
| Hero | `subject_line`, `preheader`, `main_header`, `main_subheader`, `body_copy`, `main_cta_text`, `main_cta_url`, `main_cta_alias`, `masthead_image` |
| Story Circle | `story_left_circle_image`, `_header`, `_body`, `_cta`, `_url`, `_alias`, `_link` |
| Story Double | `story_double_image1/2`, `_header1/2`, `_subheader1/2`, `_body1/2`, `_url1/2`, `_alias1/2` |
| Story Single | `story_single_left/right_image`, `_header`, `_body`, `_cta`, `_url`, `_alias` |
| Partner | `partner_block_image`, `_image_title`, `_body`, `_url` |
| Offer | `offer_block_header`, `_body`, `_cta_text`, `_cta_link`, `_link_alias` |
| Fares | `fare_header`, `_subheader`, `_bookby`, `_image`, `_economy`, `_business`, `_first` + urls + aliases |
| Terms | `terms_content1`, `terms_content2` |

**Important:** Empty fields = block not rendered. Fill ALL fields for blocks you want shown.

### Step 4: Image generation

Use Gemini Imagen to generate campaign-appropriate images:

```javascript
import { initGemini, generateImage } from '../packages/core/ai-providers/gemini.js';
initGemini(process.env.GEMINI_API_KEY);

const urls = await generateImage(prompt, { aspectRatio: '16:9' });
// urls[0] is "data:image/png;base64,..."
const base64 = urls[0].match(/base64,(.+)$/)[1];

const { assetId, publishedURL } = await uploadImage(mc, {
  name: `${campaignName}_masthead_hero`,
  base64,
  fileType: 'png',
});
// Use assetId (number) in DE image fields
```

### Step 5: Verify with preview

After filling DEs, use the email builder to generate preview variants:

```javascript
import { buildCampaignEmails } from '../packages/core/email-builder/index.js';
const result = await buildCampaignEmails({
  assetId: newEmailId,
  mcClient: mc,
  campaignHint: campaignName,
});
// result.variants = { 'en_skw.html': '...', 'en_ebase.html': '...', ... }
```

## Campaign Type Registry

| Type | Code | Attr5 Code | Template (noCugo) | DEs |
|------|------|-----------|-------------------|-----|
| holiday-offer | HO | CCHOLIOFFR | 44791 | DynamicContent + Stories |
| product-offer-ecommerce | PO | CCPRODOFFR | 44793 | DynamicContent + Products + CashMiles |
| product-offer-skywards | PO | CCPRODOFFR | 44803 | DynamicContent + Products + CashMiles |
| partner-offer | PR | CCPARTOFFR | 23867 | DynamicContent + Products |
| partner-launch | PL | CCPARTLAUN | 23876 | DynamicContent |
| route-launch | RL | CCROUTELCH | 44801 | DynamicContent |
| route-launch-inbound | RLIB | CCROUTELCH | 23858 | DynamicContent |
| route-launch-outbound | RLOB | CCROUTELCH | 23855 | DynamicContent |
| broadcast-emirates | BCE | CCBRDCASTE | 27111 | DynamicContent + Products |
| event-offer | EO | CCEVENTOFF | 23863 | DynamicContent |
| product-update | PU | CCPRODUPDT | 44798 | DynamicContent |
| single-region | SR | CCSINGREGI | 29043 | DynamicContent + Products |
| newsletter | NL | CCNEWSLETR | 23860 | DynamicContent + Stories |
| occasional-announcement | OA | CCOCCANNCE | 28826 | DynamicContent + Products |
| partner-acquisition | PA | CCPARTACQS | 44818 | DynamicContent + Products |
| partner-offer-promotion | PRP | CCPARTPRMO | 26816 | DynamicContent + Products |
| special-announcement | SA | CCSPECANNO | 26498 | DynamicContent |
| survey | SS | CCSURVEYSS | 37124 | DynamicContent |
| new-language-pref | NLP | CCNEWLANGP | 23861 | DynamicContent |

## Folder paths

**Content Builder (emails):**
```
Content Builder > 1. Tier 4 Campaign setups > {Ecommerce|Skywards} > {YYYY} > {YYYY-MM} > {YYYYMMDD_Market_Desc_Code_dir}
```

**Data Extensions:**
```
Shared Data Extensions > 1. BAU Tier 4 > {year hierarchy} > {YYYYMMDD_Market_Desc_Code_dir}
```

**Placeholder DEs (source schemas):**
```
Shared Data Extensions > BAU Data Library > {Campaign Type} > CampaignName_Date_{CODE}_DynamicContent
```

## Known limitations

- The `_deploydate_` in Attribute3 is literal padding (14 chars), not a real date
- Image fields in DEs are asset IDs (numbers), resolved by AMPscript via `ContentImagebyID()`
- VAWP DE is shared across all BAU campaigns: `BAU CS Master dataset`

## Key files

- `packages/core/campaign-builder/index.js` — Campaign creation engine
- `packages/core/email-builder/index.js` — Email preview engine (buildCampaignEmails)
- `packages/core/ai-providers/gemini.js` — Image generation (generateImage)
- `packages/core/mc-api/client.js` — MC REST + SOAP client
- `apps/dashboard/src/data/emiratesBauTypes.js` — Campaign type metadata

## Arguments

$ARGUMENTS