# Email Builder — Emirates Campaign Generator

Build renderable HTML email variants from an Emirates AMPscript template.

## What this does

Takes an AMPscript email template (from Marketing Cloud or a local file) and runs a 3-phase pipeline:

1. **Analyze** — Parse the AMPscript to discover content blocks, data extensions, variables, segments, and layout order
2. **Fetch** — Connect to Marketing Cloud and retrieve all block HTML, DE content, and image CDN URLs
3. **Render** — Assemble static HTML per variant (segment × header type), replacing all AMPscript with real values

## How to use

The user will provide either:
- A **MC asset ID** (e.g., "build email from asset 12345")
- A **local file path** to an AMPscript HTML template
- A **campaign name** to search for in MC

### Steps to follow:

1. **Get the template:**
   - If asset ID: use `mc_get_email_html` tool to fetch the AMPscript template from MC
   - If file path: read the file directly
   - If campaign name: use `mc_list_emails` to find it, then fetch by ID

2. **Analyze the template:**
   ```javascript
   import { analyzeTemplate } from '../packages/core/email-builder/index.js';
   const manifest = analyzeTemplate(templateHtml);
   ```
   Show the user a summary: how many blocks, DEs, segments, and variants were detected.

3. **Fetch MC data:**
   ```javascript
   import { fetchCampaignData } from '../packages/core/email-builder/index.js';
   const data = await fetchCampaignData(manifest, mcClient, { language: 'en' });
   ```
   This requires MC credentials configured in the workspace.

4. **Render variants:**
   ```javascript
   import { renderAllVariants } from '../packages/core/email-builder/index.js';
   const variants = renderAllVariants({ manifest, data, subscriber, templateShell });
   ```

5. **Save output:**
   - Write each variant to `campaings/{campaign-name}/versions/{variant}.html`
   - Create a manifest.json with metadata about what was generated

6. **Report results:**
   - List all generated files with sizes
   - Note any blocks that failed to fetch or images that couldn't be resolved

## Alternative: CLI-only mode (no MC)

If MC credentials aren't available, the user can provide:
- Pre-fetched block HTML files (from a previous run)
- Content JSON files (from `query-mc-content.js`)
- An image map JSON

In this mode, skip Phase 2 (fetch) and go directly to Phase 3 (render) using the local data.

## Key files

- `packages/core/email-builder/index.js` — Public API (buildCampaignEmails)
- `packages/core/email-builder/analyzer.js` — Phase 1
- `packages/core/email-builder/fetcher.js` — Phase 2
- `packages/core/email-builder/renderer.js` — Phase 3
- `packages/core/email-builder/ampscript.js` — AMPscript parsing utilities
- `packages/core/mc-api/client.js` — MC API client

## Arguments

$ARGUMENTS
