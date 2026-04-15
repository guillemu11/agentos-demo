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

The user provides an **asset ID**, **email name**, or **campaign name**,
optionally specifying languages (e.g. "en inglés y árabe", "all languages").

### Invocation flow (IMPORTANT — follow before running the pipeline)

**Step A — Resolve the target asset**

1. If the argument is a **numeric asset ID** → use it directly, skip to Step B.
2. If the argument is a **name / substring / campaign name** → call
   `searchEmailAssets(mcClient, query, { limit: 8 })`. This returns the
   top-N `templatebasedemail`/`htmlemail` assets matching the name,
   ordered by `modifiedDate` DESC (most recently edited first).
3. **Pause and ask the user which one.** Format:

   ```
   Encontré N candidatos para "<query>" (más recientes primero):
     1. #<id>  <YYYY-MM-DD>  <name>
     2. #<id>  <YYYY-MM-DD>  <name>
     ...
   ¿Cuál quieres? (número, ID, o "cancelar")
   ```

   Do NOT proceed to Step B without explicit confirmation — even if there's
   only one hit. Always confirm the exact email name before spending MC
   API quota on the full render.

**Step B — Resolve languages**

Parse the language request from the user's message:

| User says | `languages` option |
|-----------|-------------------|
| (nothing) | `['ENGLISH']` (default — EN only) |
| "en inglés" / "english" / "en" | `['ENGLISH']` |
| "inglés y árabe" / "en ar" | `['ENGLISH', 'ARABIC']` |
| "todos los idiomas" / "all" | leave unset → pipeline generates all langs in the Content DE |

Use the LANG_MAP in `packages/core/email-builder/index.js` for the short→full name mapping.

**Step C — Run the pipeline**

Once asset ID + languages are confirmed, proceed with `buildCampaignEmails()`
as documented below. Pass the requested languages into options so irrelevant
variants aren't generated.

**ALWAYS wrap with the Emirates shell** — load `email_blocks/template_style.html`
and pass it as `templateShell`. Without the shell the output is an unwrapped
block fragment (no `<!DOCTYPE>`, no responsive CSS, no RTL/LTR resolution).

```javascript
import { readFileSync } from 'fs';
const templateShell = readFileSync('email_blocks/template_style.html', 'utf8');
await buildCampaignEmails({ assetId, mcClient, templateShell, options: { language: 'en' } });
```

## Non-BAU templates (Lounge / Churn / Shortlink DEs)

Not every Emirates email follows the BAU pattern. Detection via
`isBAUTemplate()` may return **false** — then the pipeline runs the "standard"
path (`analyzeTemplate` + `fetchCampaignData` + `renderAllVariants`). The
renderer already handles the non-BAU quirks learned from PaidLounge v17
(asset 45919). Don't re-implement them — rely on them and verify they fire:

### 1. Short language codes (`en`, `ar`, `ch_scn`) vs full (`ENGLISH`)

Shortlink DEs (`PaidLounge_DynamicContent_shortlink`, `FeaturedItems_Ref_Table_shortlink`,
`Emirates_Exp_Lounge_shortlink`) use short codes. Legacy DEs (`Header_CentralizedContent`,
`Footer_CentralizedContent`, `REF_Salutation_Language`) use UPPERCASE full names.
`pickRow()` in renderer.js handles the mapping via `shortMap` — all new language
lookups must go through `pickRow()`, not `rows[0]`.

**Do not** `dcRows[0]` as default — row 0 is often Arabic. Always
`pickRow(dcRows, options.language) || dcRows[0]`.

### 2. VAWP auto-population

If the template has an init block like:

```ampscript
SET @FlightNo   = Trim( Field(@VAWP_Row, 'FlightNo') )
SET @DeptAirport = Trim( Field(@VAWP_Row, 'DeptAirport') )
SET @first_name  = Trim( ProperCase( Field(@VAWP_Row, 'FName') ) )
```

`renderAllVariants` picks a VAWP sample row filtered by `language × headerType`
(tier = skw vs ebase) and spreads its fields into `vars` automatically. MC REST
returns DE field names in **lowercase** (`fname`, `flightno`), so:
- Direct `%%=v(@flightno)=%%` resolves via lowercased key.
- Mixed-case vars (`@first_name`, `@last_name`) are aliased in `buildVariableMap`:
  `vars.first_name = ProperCase(vars.fname)`.

### 3. `{Token}` runtime interpolation — **generic, template-driven**

DE body copy routinely contains runtime tokens like `{FlightNo}`, `{PNR}`,
`{abmiles}`, `{first_name}` — literal curly braces, NOT AMPscript `%%…%%`.
`renderAllVariants` builds a `tokenAliases` map **per template** by scanning
the AMPscript for three patterns (in priority order):

1. `SET @target = [Trim/ProperCase/…] Field(@VAWP_Row, 'col')` → `target → col`
2. `Replace(@X, '{token}', @source)` → `token → source`
3. `SET @target = bareIdent` → `target → ident` (ELSE branch when _messagecontext != 'VAWP')

Then chains are resolved one hop (`abmiles → miles_abandoned`). Post-render,
every `{XXX}` is looked up case-insensitively in vars, falling back through
the alias map. **Do NOT add new hardcoded aliases to renderer.js for each
new email** — if a template defines the alias via AMPscript, the parser
already catches it. Only extend the parser if a NEW AMPscript pattern shows up.

### 4. Salutation concat (send-time AMPscript pattern)

```ampscript
SET @body_copy = concat(@body_copy_salutation, @body_copy)
```

Detected via regex on `manifest._templateHtml`. When present, the renderer
prepends `body_copy_salutation + ' '` to `body_copy`. Templates that render
salutation and body separately (CHURN) do NOT trigger this, so they're not
broken.

### 5. Row-based stories DE (`Emirates_Exp_Lounge_shortlink` layout)

Standard Emirates stories DEs (`Stories_Ref_Table`) are **name-based**: one
row per story, look up by `story_name`. Lounge / shortlink DEs use a
**row-based layout**: one row per language, with columns `story1_image`,
`story1_header`, `story2_image`, …

Detection: `rows[0]` contains both `story1_image` and `story1_header`. Renderer
spreads those fields into `vars` as a fallback when `buildVariableMap` didn't
populate `story1_image` via name-based lookup.

### 6. Skw_Plus / Info block pattern

Block 35052 (`EN_Global_info_block`) uses `%%=v(@image)=%%` and
`%%=v(@link_alias)=%%`. The template's init block does:

```ampscript
SET @Skw_Plus_Content = LookupRows('FeaturedItems_Ref_Table_shortlink',
    'language', Lowercase(@lm_code), 'FItem_name', @FSItem1)
SET @Skw_Plus_image = RegExMatch(ContentImagebyID(@Skw_Plus_image_id,…),…)
SET @image = @Skw_Plus_image               ← positional rebind
%%=ContentBlockbyID("35052")=%%
```

Renderer populates `vars.Skw_Plus_image`, `vars.Skw_Plus_body_link_alias`,
`vars.Skw_Plus_body_link` from the matching FeaturedItems row. It does **NOT**
set `vars.image` directly — the positional walker (`applyLocalBindings` +
`resolveSetRhs`) handles the `SET @image = @Skw_Plus_image` rebind per block
instruction. Setting `vars.image` globally breaks the offer block's airplane
icon, which rebinds `@image` earlier in the template.

### 7. 20k row cap for large DEs

`FeaturedItems_Ref_Table_shortlink` has ~6.2k rows across 27 languages. The
old 500-row limit dropped most languages' items. `fetchCampaignData` now uses
20k cap for DEs matching: `stories|story|featureditems|featured_items|centralized_products|centralized_blocks|impression`.

## Tests for "is this skill still working"

Run against asset **45919** (`PaidLounge_DynamicEmail_v17`) and verify:

- `skw.html` / `ebase.html` both generated
- 0 AMPscript leaks (`%%...%%`)
- 0 unresolved `{FlightNo}` / `{PNR}` / `{DeptAirport}` tokens
- "Hello Brent," prefix on body copy
- 4 story images in `/m/11/` path resolved to CDN URLs
- Info block icon rendered (9 unique `src=` URLs total)
- No Arabic text in EN variant

### Step 0: Resolve the email template

```javascript
import { resolveEmailTemplate } from '../packages/core/email-builder/index.js';
const { templateHtml, emailName, attrInfo, derivedCampaignHint } = await resolveEmailTemplate(mcClient, assetId);
```

`resolveEmailTemplate` now also returns:
- `attrInfo` — parsed from `asset.data.email.attributes` (Attr1-5). Authoritative source for the BAU campaign hint, date and type code. See "Authoritative campaign hint" below.
- `derivedCampaignHint` — fallback heuristic from the asset name when Attr3/5 are empty.

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

## Authoritative campaign hint (read from the asset, don't guess)

Every BAU asset stores its campaign identity directly in
`asset.data.email.attributes` (set by the campaign-builder at duplication
time). Reading these is the **only reliable way** to find the right content
DE — heuristics on the asset name break for Partner Update, Holiday Offer,
Newsletter, etc., where the descriptive name in the file doesn't match the
encoded `campaign_name`.

```javascript
import { parseAssetAttributes } from '../packages/core/email-builder/fetcher.js';
const info = parseAssetAttributes(asset);
// → { campaignHint: 'jpawr2ndnrtecofeb26', campaignDate: '270226',
//     typeCode: 'CCPRODUPDT', direction: 'in',
//     attr3: 'jpawr2ndnrtecofeb26_deploydate_in',
//     attr5: 'CCPRODUPDT_270226' }
```

Parsing rules (mirrors send-time AMPscript):

```
Attr3: "{campaignName}_deploydate_{dir}"   → strip last 14 chars → campaign_name; last 2 → direction
Attr5: "CC{TYPECODE}_{DDMMYY}"              → strip last 7 chars  → typeCode;     last 6 → campaign_date
DE name = "{campaign_name}_{campaign_date}_{TYPE}_DynamicContent"
campaign_id = "{campaign_name}_{typeCode}_{campaign_date}_{direction}"
```

`buildCampaignEmails({ assetId, mcClient })` already prefers `attrInfo.campaignHint`
over the asset-name heuristic — pass nothing and it does the right thing.

## All BAU campaign types

`isBAUTemplate()` recognises any template that contains
`__AdditionalEmailAttribute` AND a `Concat(... '_(RL|PO|PU|CC)_<suffix>')`.
The 19 supported types are:

| Code | Type | Attr5 prefix | Notes |
|------|------|--------------|-------|
| HO | holiday-offer | CCHOLIOFFR | DC + Stories |
| PO | product-offer-ecommerce/skywards | CCPRODOFFR | DC + Products + CashMiles |
| PR | partner-offer | CCPARTOFFR | DC + Products |
| PL | partner-launch | CCPARTLAUN | DC |
| RL / RLIB / RLOB | route-launch (+inbound/outbound) | CCROUTELCH | DC, header v2/v3 |
| BCE | broadcast-emirates | CCBRDCASTE | DC + Products |
| EO | event-offer | CCEVENTOFF | DC |
| **PU** | **product-update** | **CCPRODUPDT** | **DC** |
| SR | single-region | CCSINGREGI | DC + Products |
| NL | newsletter | CCNEWSLETR | DC + Stories |
| OA | occasional-announcement | CCOCCANNCE | DC + Products |
| PA | partner-acquisition | CCPARTACQS | DC + Products |
| PRP | partner-offer-promotion | CCPARTPRMO | DC + Products |
| SA | special-announcement | CCSPECANNO | DC |
| SS | survey | CCSURVEYSS | DC |
| NLP | new-language-pref | CCNEWLANGP | DC |

DE name pattern is universal: `{campaign_name}_{DDMMYY}_{CODE}_DynamicContent`.

## DE-first fetch order (saves >5x time)

`fetchBAUCampaignData` queries the content DE **first**, then derives active
languages from the rows, and only follows nested `ContentBlockbyID` refs
inside `IF @language == "X" THEN` branches whose X is active.

For a single-language campaign this drops the block fetch from ~335 to ~50.

It also filters top-level blocks by name prefix via `isBlockForInactiveLanguage`
— `AR_ODR`, `KR_terms`, `SCN_*` etc. are skipped when their `EN/AR/...` prefix
doesn't match the active language code.

## Positional renderer — `buildRenderInstructions` (preferred path)

`packages/core/email-builder/ampscript.js` exposes a walker that converts an
AMPscript template into an **ordered list of render instructions**, one per
`ContentBlockbyID` occurrence — not deduplicated. Each instruction carries:

```js
{
  blockId: '18256',
  guards: ['NOT EMPTY(@offer_block_body)', '@language == "ENGLISH"'],
  localBindings: [{ var: 'story1_image', rhs: '@story11_image' }, ...],
}
```

Why it exists: Emirates templates reference the same block at multiple
positions and rebind vars between occurrences. Example from CHURN:

```ampscript
%%=ContentBlockbyID("34287")=%%          ← stories 1-3 here
SET @story1_image = @story11_image
SET @story1_header = @story11_header
...
%%=ContentBlockbyID("34287")=%%          ← stories 4-6 (same block, rebound)
```

A deduplicating renderer (my earlier `manifest.blockOrder.allBlocks` approach)
collapses both occurrences into one and loses the set2 rendering. The
positional walker emits two instructions, each with its own `localBindings`.
Same mechanism supersedes the manual `reorderForRollingStatic` hack: when
block 18256 appears both as standalone offer block and inside Rolling Static
Content, the walker emits both positions correctly.

**Algorithm summary:**

1. Tokenise into ordered `%%[...]%%` control blocks + `%%=ContentBlockbyID=%%` render tokens.
2. Keep a `guardStack` of open IFs; ELSE branches negate the top entry as `!(prev)`.
3. Accumulate `SET @var = rhs` into `localBindings` since the last render.
4. At each `ContentBlockbyID`, emit one instruction and reset `localBindings`.

**Scope:** handles the patterns actually used by Emirates (CHURN + BAU). Not
a full AMPscript interpreter — unrecognised statements are ignored.

`evaluateGuard(condition, vars)` is also now exported from `ampscript.js`
(moved out of `index.js`). In addition to the guard-extractor rules it
supports `@x == 'literal'`, `@x != 'literal'`, `RowCount(@x) > 0`, and the
`!(inner)` negation emitted by ELSE normalisation.

## Block content guards (skip blocks whose driver vars are empty)

`extractBlockGuards(templateHtml)` walks the composed template for
`IF <cond> THEN ... ContentBlockbyID(X) ENDIF` patterns and maps blockId → raw
condition string. `evaluateGuard(condition, vars)` then short-circuits:

- supports `NOT EMPTY(@var)`, `EMPTY(@var)`, `Length(@var) > 0`
- supports AND/OR with mixed polarity (e.g., `NOT EMPTY(@v1) AND EMPTY(@v2)`)
- skips `@language ==` and subscriber-attribute conditions (those are gate by
  the language filter / persona, not by content presence)
- evaluates against the **merged vars** (contentRow + Rolling Static + maps),
  not just contentRow — required for blocks driven by post-processed vars
  like `@offer_block_body` from `REF_Worry_Free_Travel`

Combined with `isRenderedBlockEmpty(html)` (drops blocks with no visible text
**unless** they contain an `<img src="…">` — the masthead is image-only).

## Content row + REF DE language picker

`pickRowByLanguage(rows, langCode)` replaces the old `rows[0]` default for
`REF_Caveat_Disclaimer`, `Footer_CentralizedContent`, `REF_Worry_Free_Travel`
etc. The first row in those DEs is often Arabic — without this, English
variants leak Arabic legal copy into the post-footer area.

`buildBAUCampaign` also drops content rows whose `CORE_FIELDS`
(`main_hero_image`, `headline`, `subheader`, `body_copy`) are all blank, so
ghost variants for placeholder languages aren't emitted.

## Header v2 vs v3 (skw vs ebase)

Header logic block 16618 has **combined** conditions
`((@language == "ENGLISH") AND (@headerver == "v3"))` → 198, vs
`(...) AND (@headerver == "v2")` → 197. `resolveLogicBlock` only branches on
language and would always pick the first match (v2). For these blocks the
renderer detects `@headerver == "v[23]"` and uses
`resolveBranchedBlock(html, { language, headerver })` instead.

`isSkw` is derived from the variant header type (`v3 ⇒ skw`, `v2 ⇒ ebase`)
and drives both the header sub-block AND the persona / tier vars below.

## Per-variant preview personas

When the caller doesn't pass `subscriber`, `buildBAUCampaign` injects
realistic preview personas so the rendered output reflects per-tier
differences (Skywards bar, tier badge, miles balance):

```javascript
// skw variant
{ first_name: 'Maria', TierName: 'Platinum', miles_balance: '42,500',
  loy_tier_code: '2: Platinum', loy_skywards_mile_balance: '42,500' }
// ebase variant
{ first_name: 'John', TierName: '', miles_balance: '',
  loy_tier_code: '7: Non-Member', loy_skywards_mile_balance: '' }
```

Caller-supplied `subscriber` properties override these, but **don't** pass
default placeholder objects like `{ first_name: 'Valued Member' }` — that
overrides the persona via the spread. Pass `{}` (or omit) to use personas.

## AMPscript handlers in `replaceAmpscriptVars`

The replacer now recognises the patterns Emirates templates actually use:

| Pattern | Handling |
|---------|----------|
| `%%=v(@var)=%%` | direct substitution |
| `%%=RedirectTo(@var)=%%` | substitution |
| `%%=TreatAsContent(@var)=%%` | substitution |
| `%%=ProperCase(var)=%% / Lowercase / Uppercase / Trim(var)` | string transform |
| `%%=Substring(var, start, length)=%%` | 1-indexed substring (used to extract "Platinum" from "2: Platinum") |
| `%%varname%%` | bare subscriber-attribute syntax (`%%loy_skywards_mile_balance%%`, `%%first_name%%`, `%%MARKETCODE%%`) |
| `%%[IF @x == 'ARABIC' THEN]%%right%%[ELSE]%%left%%[ENDIF]%%` | resolves to ELSE branch |
| any remaining `%%...%%` | stripped |

`@body_copy_salutation` is set as a separate variable; **do not** prepend it
to `@body_copy`. The block template renders both as separate elements
(`<strong>Hello {first_name}</strong>, {body_copy}`); concatenating produces
"Hello , Hello firstname, body…" duplicates.

## Hero image / masthead resolution

Route Launch and similar templates use the no-fares masthead block 28835
(`EN_masthead_short_White`) with `src="%%=v(@masthead_image)=%%"`, but the
content DE only carries `fare_image` (asset ID). The renderer:

1. Resolves `vars.fare_image` (numeric ID) → CDN URL via `imageMap`.
2. Mirrors AMPscript: `vars.masthead_image = vars.fare_image` (URL),
   `vars.masthead_image_link = vars.fare_image_url`,
   `vars.main_cta_text = vars.main_cta_alias || vars.fare_image_alias`.
3. Falls back `vars.subject_line = main_header` when DE doesn't carry it.

## Rolling Static Content (worry-free / travel-hub / emirates-experience / before-travel)

The "section before the footer" is driven by:

```ampscript
SET @static_content = Lookup('Rolling_Static_Content_per_Market-Language',
  'static_content', 'language', @lm_code, 'market_code', @country)

IF @static_content == 'worry-free-travel' THEN ...
ELSEIF @static_content == 'travel-hub' THEN ...
ELSEIF @static_content == 'emirates-experience' THEN ...
ELSEIF @static_content == 'before-travel' THEN ...
ENDIF
```

`fetchBAUCampaignData` now also fetches `Rolling_Static_Content_per_Market-Language`,
`FeaturedItems_Ref_Table` and `REF_Worry_Free_Travel`.
`applyRollingStaticContent(vars, { deData, langCode, country })` resolves the
key and populates `@offer_block_*` / `@info*` / `@article*` / `@product*` vars.

**Production source per key:**

- `worry-free-travel` → `REF_Worry_Free_Travel` (rows already shaped as
  `offer_block_*`). Falls back to `FeaturedItems_Ref_Table` with
  `FItem_name='worry-free-travel'` if the dedicated DE is empty.
- `emirates-experience` → `FeaturedItems_Ref_Table` with
  `FItem_name='emirates-experience'`.
- `travel-hub` / `before-travel` → use `REF_Travel_Hub` /
  `REF_Before_Travel` (not yet wired; add when needed).

**Field name gotcha:** the REST data API returns DE field names lowercased
(e.g., `fitem_name` not `FItem_name`). Use a case-insensitive accessor.
Slug values can be hyphenated **or** underscored — the matcher tries both.
The `global_market` placeholder in body copy is replaced with the active
country code at render time.

**Block reordering for rolling static:**

Block 18256 (offer block) is referenced **twice** in the template — once in
its standalone position and once in the rolling-static section. The analyzer
deduplicates `manifest.blockOrder.allBlocks` and keeps only the first
occurrence. When `applyRollingStaticContent` populates the offer vars, the
renderer calls `reorderForRollingStatic(allBlocks, staticContentKey)` which
moves the relevant block IDs (`ROLLING_STATIC_BLOCK_IDS`) to right before
the first footer/structural block (Global_spacer 37247, Footer 39445, Terms
17372, Caveat 35063, ODR 36843).

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
The standard `parseDELookups()` can't catch these — but `buildCampaignEmails()` auto-detects
the BAU pattern via `isBAUTemplate()` and uses the BAU pipeline automatically.

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

### Using the engine for BAU campaigns

The engine auto-detects BAU campaigns and uses the parallel pipeline. Just use
`buildCampaignEmails()` with a `campaignHint` to help narrow the SOAP search:

```javascript
import { buildCampaignEmails } from '../packages/core/email-builder/index.js';

const result = await buildCampaignEmails({
  assetId: 46750,
  mcClient,
  templateShell,
  campaignHint: 'hkawrhellaunchmar26',  // narrows SOAP DE search
  options: { onProgress: (step, detail) => console.log(`[${step}] ${detail}`) },
});

// result.variants = { 'en_skw.html': '...', 'en_ebase.html': '...', 'ch_tcn_skw.html': '...', ... }
```

**Under the hood**, the BAU pipeline:
1. `isBAUTemplate()` detects `__AdditionalEmailAttribute` + `RL_DynamicContent` pattern
2. `analyzeBAUTemplate()` parses the AMPscript for block refs and DE suffix
3. `discoverBAUDEs()` uses SOAP search to find the actual content DE name
4. `fetchBAUCampaignData()` recursively fetches all blocks + content DE + footer + images
5. `resolveLogicBlock()` resolves each language-branching logic block to its sub-block
6. Renders all `language × header_type` variant combinations

**Manual control** is also available if you need to customize the flow:

```javascript
import { discoverBAUDEs, fetchBAUCampaignData, resolveLogicBlock } from '../packages/core/email-builder/index.js';

// Step by step
const { contentDE } = await discoverBAUDEs(mcClient, 'hkawrhellaunchmar26');
const data = await fetchBAUCampaignData({ contentDE, blockIds, mcClient });
const subBlockId = resolveLogicBlock(data.blocks, '16618', 'ENGLISH'); // header for English
```

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
