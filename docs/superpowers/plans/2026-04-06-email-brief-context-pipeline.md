# Email Brief Context Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `email_spec` to Campaign Brief so HTML Developer and Content Agent Lucía share a design+content contract, with automatic AMPscript variable extraction, cross-agent context injection, and a Content Preview mode in Email Studio.

**Architecture:** `email_spec` JSONB column is added to `projects` table as the single source of truth. Both pipeline agents receive it via `buildPipelineSystemPrompt()`. When the Developer saves an email, server extracts `%%=v(@var)=%%` variables. When Lucía runs, she receives the HTML + variable list and outputs `[EMAIL_VARIABLES]` tags that the server parses to build a filled preview. Email Studio gains a Content Preview toggle.

**Tech Stack:** PostgreSQL 16 (JSONB), Express 5, React 19, Anthropic SSE streaming, `packages/core/pm-agent/core.js`

**Spec:** `docs/superpowers/specs/2026-04-06-email-brief-context-pipeline-design.md`

---

## File Map

| File | Change |
|------|--------|
| `packages/core/db/schema.sql` | Add `email_spec JSONB DEFAULT '{}'` to projects |
| `apps/dashboard/server.js` | 5 changes: initDatabase migration, PUT /api/projects/:id, POST /api/projects/:id/emails (variable extraction), pipeline chat [EMAIL_VARIABLES] parser, GET /api/projects/:id/content-preview-html, Lucía init context injection |
| `packages/core/pm-agent/core.js` | Inject email_spec into html-developer and lucia system prompts |
| `apps/dashboard/src/App.jsx` | Add Email Spec section (warning badge + edit form) in project details tab |
| `apps/dashboard/src/components/EmailBuilderPreview.jsx` | Add Content Preview toggle + stale badge |
| `apps/dashboard/src/i18n/translations.js` | Add emailSpec.* translation keys |

---

## Task 1: DB Migration — Add email_spec column

**Files:**
- Modify: `packages/core/db/schema.sql` (line ~43, after `compliance_notes`)
- Modify: `apps/dashboard/server.js` (line ~204, inside `initDatabase()`)

- [ ] **Step 1: Add column to schema.sql**

In `packages/core/db/schema.sql`, after the line `compliance_notes JSONB DEFAULT '[]',` and before `created_at`, add:

```sql
    email_spec JSONB DEFAULT '{}',
```

- [ ] **Step 2: Add idempotent migration to initDatabase()**

In `apps/dashboard/server.js`, in the `initDatabase()` function after the `agentSettingsCols` migration block (around line 217), add:

```javascript
        // email_spec column migration
        await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS email_spec JSONB DEFAULT '{}'`);
```

- [ ] **Step 3: Restart server and verify**

```bash
npm start
```

In Adminer (localhost:8080), run:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'email_spec';
```
Expected: one row returned with `email_spec`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/db/schema.sql apps/dashboard/server.js
git commit -m "feat(db): add email_spec JSONB column to projects table"
```

---

## Task 2: Backend — Extend PUT /api/projects/:id to save email_spec

**Files:**
- Modify: `apps/dashboard/server.js` (line ~455, the PUT /api/projects/:id handler)

- [ ] **Step 1: Update the PUT handler to include email_spec**

Replace the existing `app.put('/api/projects/:id', ...)` handler (lines ~455-472) with:

```javascript
app.put('/api/projects/:id', async (req, res) => {
    try {
        const { name, problem, solution, status, blocks, success_metrics, department, sub_area,
                pain_points, requirements, risks, estimated_budget, estimated_timeline,
                future_improvements, email_spec } = req.body;
        await pool.query(
            `UPDATE projects
             SET name=$1, problem=$2, solution=$3, status=$4, blocks=$5, success_metrics=$6,
                 department=$7, sub_area=$8, pain_points=$9, requirements=$10, risks=$11,
                 estimated_budget=$12, estimated_timeline=$13, future_improvements=$14,
                 email_spec=$15, updated_at=NOW()
             WHERE id=$16`,
            [name, problem, solution, status, JSON.stringify(blocks), JSON.stringify(success_metrics),
             department, sub_area, JSON.stringify(pain_points), JSON.stringify(requirements),
             JSON.stringify(risks), estimated_budget, estimated_timeline, JSON.stringify(future_improvements),
             JSON.stringify(email_spec || {}), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Verify with curl**

```bash
curl -s -X PUT http://localhost:3001/api/projects/1 \
  -H "Content-Type: application/json" \
  -b "connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"name":"Test","problem":"p","solution":"s","status":"Planning","blocks":[],"success_metrics":[],"department":"General","sub_area":"General","pain_points":[],"requirements":[],"risks":[],"estimated_budget":0,"estimated_timeline":"TBD","future_improvements":[],"email_spec":{"design_notes":"Test spec","blocks":[],"variable_list":[]}}' 
```

Expected: `{"success":true}`

Verify in DB: `SELECT email_spec FROM projects WHERE id = 1;`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): extend PUT /api/projects/:id to persist email_spec"
```

---

## Task 3: Core — Inject email_spec into agent system prompts

**Files:**
- Modify: `packages/core/pm-agent/core.js` (inside `buildPipelineSystemPrompt()`, around line 798)

- [ ] **Step 1: Add email_spec injection for both agents**

In `packages/core/pm-agent/core.js`, in `buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragContext)`, add the email_spec injection block BEFORE the `isHtmlDeveloper` check (around line 799):

```javascript
    // Email spec injection — shared contract for both email agents
    const emailSpec = project.email_spec;
    const hasEmailSpec = emailSpec && (emailSpec.design_notes || (emailSpec.blocks && emailSpec.blocks.length > 0));
    if (hasEmailSpec) {
        const isHtmlDev = agent.id === 'html-developer'
            || (agent.name || '').toLowerCase().includes('html')
            || (agent.role || '').toLowerCase().includes('html developer');
        const isContentAg = !isHtmlDev && (
            (agent.name || '').toLowerCase().includes('lucia')
            || (agent.role || '').toLowerCase().includes('content agent')
            || (agent.role || '').toLowerCase().includes('content strategist')
            || (agent.role || '').toLowerCase().includes('content creator')
        );

        if (isHtmlDev) {
            const blockLines = (emailSpec.blocks || [])
                .map(b => `  - ${b.name}: ${b.guidance}${b.variables?.length ? ` → Variables: ${b.variables.join(', ')}` : ''}`)
                .join('\n');
            const varList = (emailSpec.variable_list || []).join(', ');
            prompt += `\n\n## Email Specification (Campaign Brief)
${emailSpec.design_notes ? `Design Notes: ${emailSpec.design_notes}\n` : ''}${blockLines ? `Required Blocks:\n${blockLines}\n` : ''}${varList ? `Expected AMPscript Variables: ${varList}\n` : ''}Use %%=v(@variable_name)=%% syntax for all personalizable content (e.g. %%=v(@headline)=%%). Every text element that varies per send should use a variable.`;
        }

        if (isContentAg) {
            const blockLines = (emailSpec.blocks || [])
                .map(b => `  - ${b.name}: ${b.guidance}`)
                .join('\n');
            const varGuidance = (emailSpec.variable_list || [])
                .map(v => `  - ${v}: ${emailSpec.variable_context?.[v] || 'No guidance defined'}`)
                .join('\n');
            prompt += `\n\n## Email Specification (Campaign Brief)
${blockLines ? `Content Requirements by Block:\n${blockLines}\n` : ''}${varGuidance ? `Variable Guidance:\n${varGuidance}` : ''}`;
        }
    }
```

- [ ] **Step 2: Verify by checking the system prompt log**

Temporarily add a console.log at the end of `buildPipelineSystemPrompt` before `return prompt`:
```javascript
    console.log('[PipelinePrompt]', agent.id, '— email_spec injected:', hasEmailSpec);
```

Start a pipeline session with html-developer or lucia. Check server logs for `[PipelinePrompt]`.

Remove the console.log after verification.

- [ ] **Step 3: Commit**

```bash
git add packages/core/pm-agent/core.js
git commit -m "feat(core): inject email_spec into html-developer and lucia system prompts"
```

---

## Task 4: Backend — Variable extraction when email is saved

**Files:**
- Modify: `apps/dashboard/server.js` (line ~541, inside `POST /api/projects/:id/emails`)

- [ ] **Step 1: Add variable extraction helper function**

Near the top of the helpers section in `server.js` (after the imports, before the first route), add:

```javascript
// Extract AMPscript %%=v(@varName)=%% variables from HTML
function extractAmpscriptVars(html) {
    const pattern = /%%=v\(@(\w+)\)=%%/g;
    const vars = new Set();
    let match;
    while ((match = pattern.exec(html)) !== null) {
        vars.add(`@${match[1]}`);
    }
    return [...vars];
}
```

- [ ] **Step 2: Call extraction after INSERT in POST /api/projects/:id/emails**

In the `POST /api/projects/:id/emails` handler, after `res.status(201).json(result.rows[0])`, add the variable extraction and email_spec update (before the catch):

```javascript
    // Extract AMPscript variables and update email_spec.variable_list + html_version
    try {
        const extracted = extractAmpscriptVars(html_content);
        if (extracted.length > 0) {
            const projRes = await pool.query('SELECT email_spec FROM projects WHERE id = $1', [id]);
            const spec = projRes.rows[0]?.email_spec || {};
            const existing = spec.variable_list || [];
            const merged = [...new Set([...existing, ...extracted])];
            const newHtmlVersion = (spec.html_version || 0) + 1;
            await pool.query(
                `UPDATE projects
                 SET email_spec = email_spec
                   || jsonb_build_object('variable_list', $1::jsonb)
                   || jsonb_build_object('html_version', $2::int)
                 WHERE id = $3`,
                [JSON.stringify(merged), newHtmlVersion, id]
            );
        }
    } catch (varErr) {
        console.warn('[email-save] Variable extraction error (non-fatal):', varErr.message);
    }
```

**Important:** The `res.status(201).json(...)` must come BEFORE this block. Move the variable extraction to after the response is sent, or restructure so we don't try to write after `res.json()`. The fix is to save the email first, send the response, then do the async update:

The corrected handler:

```javascript
app.post('/api/projects/:id/emails', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { market, language, tier, html_content, subject_line, variant_name, status } = req.body;
  if (!market || !language || !html_content) {
    return res.status(400).json({ error: 'market, language, html_content are required' });
  }
  try {
    const versionRes = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM email_proposals
       WHERE project_id = $1 AND market = $2 AND language = $3 AND tier IS NOT DISTINCT FROM $4`,
      [id, market, language, tier || null]
    );
    const version = versionRes.rows[0].next_version;
    const result = await pool.query(
      `INSERT INTO email_proposals (project_id, campaign_id, market, language, tier, version,
        html_content, subject_line, variant_name, status, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'html-developer-agent')
       RETURNING *`,
      [id, `project-${id}`, market, language, tier || null, version,
       html_content, subject_line || '', variant_name || `v${version}`, status || 'draft']
    );
    res.status(201).json(result.rows[0]);

    // Fire-and-forget: extract AMPscript variables and update email_spec
    const extracted = extractAmpscriptVars(html_content);
    if (extracted.length > 0) {
        pool.query('SELECT email_spec FROM projects WHERE id = $1', [id])
            .then(projRes => {
                const spec = projRes.rows[0]?.email_spec || {};
                const existing = spec.variable_list || [];
                const merged = [...new Set([...existing, ...extracted])];
                const newHtmlVersion = (spec.html_version || 0) + 1;
                return pool.query(
                    `UPDATE projects
                     SET email_spec = email_spec
                       || jsonb_build_object('variable_list', $1::jsonb)
                       || jsonb_build_object('html_version', $2::int)
                     WHERE id = $3`,
                    [JSON.stringify(merged), newHtmlVersion, id]
                );
            })
            .catch(e => console.warn('[email-save] Variable extraction error:', e.message));
    }
  } catch (err) {
    console.error('POST /api/projects/:id/emails error:', err);
    res.status(500).json({ error: 'Failed to save email version' });
  }
});
```

- [ ] **Step 3: Verify**

Save an email template in Email Studio that contains `%%=v(@headline)=%%` and `%%=v(@main_cta)=%%`. Then check:

```sql
SELECT email_spec->'variable_list', email_spec->'html_version' 
FROM projects WHERE id = YOUR_PROJECT_ID;
```

Expected: `["@headline", "@main_cta"]` and version `1`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): extract AMPscript variables on email save, auto-update email_spec"
```

---

## Task 5: Backend — Inject Developer's HTML for Lucía on session initialize

**Files:**
- Modify: `apps/dashboard/server.js` (line ~6101, in the `/initialize` endpoint after `let systemPrompt = buildPipelineSystemPrompt(...)`)

- [ ] **Step 1: Add HTML context injection after system prompt build in initialize endpoint**

In `POST /api/projects/:id/sessions/:sessionId/initialize`, after line `let systemPrompt = buildPipelineSystemPrompt(agent, stage, project, accumulatedContext, ragResult.context);` (around line 6101), add:

```javascript
        // If this is Lucía, inject the latest email template HTML so she can fill variables
        const isLuciaAgent = session.agent_id === 'lucia'
            || (session.agent_role || '').toLowerCase().includes('content agent')
            || (session.agent_role || '').toLowerCase().includes('content strategist')
            || (session.agent_role || '').toLowerCase().includes('content creator');
        if (isLuciaAgent) {
            const emailRes = await pool.query(
                `SELECT html_content FROM email_proposals
                 WHERE project_id = $1
                 ORDER BY created_at DESC LIMIT 1`,
                [projectId]
            );
            const latestHtml = emailRes.rows[0]?.html_content;
            if (latestHtml) {
                const extractedVars = extractAmpscriptVars(latestHtml);
                const spec = project.email_spec || {};
                const varGuidance = (extractedVars).map(v =>
                    `  - ${v}: ${spec.variable_context?.[v] || 'Generate campaign-appropriate content'}`
                ).join('\n');
                systemPrompt += `\n\n## Email Template (from HTML Developer)
The following HTML template has been created. It uses AMPscript variables that you must fill with campaign-appropriate content.
Extracted variables: ${extractedVars.join(', ')}
${varGuidance ? `\nVariable guidance:\n${varGuidance}` : ''}

When you are ready to provide content for these variables, output them in this exact format:
[EMAIL_VARIABLES]
@variableName: value here
@otherVariable: value here
[/EMAIL_VARIABLES]

If you find variables in the template that aren't listed above, fill them automatically based on the campaign brief.
If no HTML template exists yet, generate [CONTENT_BY_BLOCK] using the email_spec blocks.

HTML Template (truncated for context):
${latestHtml.substring(0, 6000)}${latestHtml.length > 6000 ? '\n...(truncated)' : ''}`;
            } else {
                // No HTML yet — instruct Lucía to output CONTENT_BY_BLOCK
                systemPrompt += `\n\n## Email Content Mode
No HTML template exists yet. Generate content per block from the Email Specification above.
Output format:
[CONTENT_BY_BLOCK]
block: hero
@headline: value here
@preheader: value here

block: cta
@main_cta: value here
@cta_url: https://placeholder.com
[/CONTENT_BY_BLOCK]`;
            }
        }
```

Do the same injection in `POST /api/projects/:id/sessions/:sessionId/chat` (line ~6255), after `let systemPrompt = buildPipelineSystemPrompt(...)`:

```javascript
        // Inject email template context for Lucía in every chat turn (not just init)
        const isLuciaChat = session.agent_id === 'lucia'
            || (session.agent_role || '').toLowerCase().includes('content agent')
            || (session.agent_role || '').toLowerCase().includes('content strategist')
            || (session.agent_role || '').toLowerCase().includes('content creator');
        if (isLuciaChat) {
            const emailChatRes = await pool.query(
                `SELECT html_content FROM email_proposals
                 WHERE project_id = $1
                 ORDER BY created_at DESC LIMIT 1`,
                [projectId]
            );
            const chatHtml = emailChatRes.rows[0]?.html_content;
            if (chatHtml) {
                const chatVars = extractAmpscriptVars(chatHtml);
                if (chatVars.length > 0) {
                    systemPrompt += `\n\n## Email Template Variables Available
Variables to fill: ${chatVars.join(', ')}
When providing variable content, use [EMAIL_VARIABLES]...[/EMAIL_VARIABLES] format.`;
                }
            }
        }
```

- [ ] **Step 2: Verify**

Initialize a Lucía session for a project that has a saved email. Check server logs — the system prompt should include "Email Template (from HTML Developer)".

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): inject email template context into Lucia session init and chat"
```

---

## Task 6: Backend — Parse [EMAIL_VARIABLES] and save to session deliverables

**Files:**
- Modify: `apps/dashboard/server.js` (line ~6420, after `await stream.finalMessage()` in pipeline chat handler)

- [ ] **Step 1: Add [EMAIL_VARIABLES] parser helper**

Near the `extractAmpscriptVars` helper function added in Task 4, add:

```javascript
// Parse [EMAIL_VARIABLES]...[/EMAIL_VARIABLES] block from Lucía's response
function parseEmailVariables(text) {
    const match = text.match(/\[EMAIL_VARIABLES\]([\s\S]*?)\[\/EMAIL_VARIABLES\]/);
    if (!match) return null;
    const variables = {};
    const lines = match[1].trim().split('\n');
    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key.startsWith('@') && value) {
            variables[key] = value;
        }
    }
    return Object.keys(variables).length > 0 ? variables : null;
}

// Parse [CONTENT_BY_BLOCK]...[/CONTENT_BY_BLOCK] block
function parseContentByBlock(text) {
    const match = text.match(/\[CONTENT_BY_BLOCK\]([\s\S]*?)\[\/CONTENT_BY_BLOCK\]/);
    if (!match) return null;
    const result = {};
    const lines = match[1].trim().split('\n');
    let currentBlock = null;
    for (const line of lines) {
        const blockMatch = line.match(/^block:\s*(\w+)/);
        if (blockMatch) { currentBlock = blockMatch[1]; result[currentBlock] = {}; continue; }
        if (!currentBlock) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key.startsWith('@') && value) result[currentBlock][key] = value;
    }
    return Object.keys(result).length > 0 ? result : null;
}
```

- [ ] **Step 2: Parse tags after stream.finalMessage() in the pipeline chat endpoint**

In the pipeline chat handler, after `await stream.finalMessage();` and the `stageReadyMatch` block (around line 6422), add:

```javascript
        // Parse Lucía's [EMAIL_VARIABLES] or [CONTENT_BY_BLOCK] output
        const isLuciaResponse = session.agent_id === 'lucia'
            || (session.agent_role || '').toLowerCase().includes('content agent')
            || (session.agent_role || '').toLowerCase().includes('content strategist');
        if (isLuciaResponse) {
            const emailVars = parseEmailVariables(fullResponse);
            const contentByBlock = !emailVars ? parseContentByBlock(fullResponse) : null;

            if (emailVars || contentByBlock) {
                const currentSpec = (await pool.query('SELECT email_spec FROM projects WHERE id = $1', [projectId])).rows[0]?.email_spec || {};
                const deliverableUpdate = {};

                if (emailVars) {
                    deliverableUpdate.variable_values = emailVars;
                    deliverableUpdate.preview_version = currentSpec.html_version || 0;
                }
                if (contentByBlock) {
                    deliverableUpdate.content_by_block = contentByBlock;
                    // Flatten to variable_values for future auto-merge
                    const flatVars = {};
                    for (const blockVars of Object.values(contentByBlock)) {
                        Object.assign(flatVars, blockVars);
                    }
                    deliverableUpdate.variable_values = flatVars;
                }

                await pool.query(
                    `UPDATE project_agent_sessions
                     SET deliverables = COALESCE(deliverables, '{}'::jsonb) || $1::jsonb
                     WHERE id = $2`,
                    [JSON.stringify(deliverableUpdate), sessionId]
                );
                res.write(`data: ${JSON.stringify({ email_variables_saved: true })}\n\n`);
            }
        }
```

- [ ] **Step 3: Verify**

Ask Lucía in a pipeline session to fill the email variables. Check that her session deliverables in the DB contain `variable_values`:

```sql
SELECT deliverables->'variable_values' FROM project_agent_sessions 
WHERE agent_id = 'lucia' AND project_id = YOUR_PROJECT_ID;
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): parse [EMAIL_VARIABLES] from Lucia response, save to session deliverables"
```

---

## Task 7: Backend — GET /api/projects/:id/content-preview-html

**Files:**
- Modify: `apps/dashboard/server.js` (add after the `GET /api/projects/:id/content-variants` endpoint, around line 540)

- [ ] **Step 1: Add the endpoint**

After the `GET /api/projects/:id/content-variants` endpoint, add:

```javascript
// GET /api/projects/:id/content-preview-html — HTML with Lucía's variables filled inline
app.get('/api/projects/:id/content-preview-html', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Get latest email HTML
        const emailRes = await pool.query(
            `SELECT html_content FROM email_proposals
             WHERE project_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [id]
        );
        if (!emailRes.rows[0]?.html_content) {
            return res.json({ html: null, is_stale: false, html_version: 0, preview_version: 0 });
        }
        const templateHtml = emailRes.rows[0].html_content;

        // Get Lucía's variable_values from her latest session
        const luciaRes = await pool.query(
            `SELECT deliverables FROM project_agent_sessions
             WHERE project_id = $1 AND (agent_id = 'lucia'
                OR agent_role ILIKE '%content agent%'
                OR agent_role ILIKE '%content strategist%')
             ORDER BY created_at DESC LIMIT 1`,
            [id]
        );
        const deliverables = luciaRes.rows[0]?.deliverables || {};
        const variables = deliverables.variable_values || {};

        // Build preview by replacing %%=v(@var)=%% with actual values
        let previewHtml = templateHtml;
        for (const [varName, value] of Object.entries(variables)) {
            const key = varName.replace(/^@/, '');
            previewHtml = previewHtml.split(`%%=v(@${key})=%%`).join(value);
        }

        // Stale detection
        const projRes = await pool.query('SELECT email_spec FROM projects WHERE id = $1', [id]);
        const spec = projRes.rows[0]?.email_spec || {};
        const htmlVersion = spec.html_version || 0;
        const previewVersion = deliverables.preview_version || 0;

        res.json({
            html: previewHtml,
            is_stale: htmlVersion > previewVersion,
            html_version: htmlVersion,
            preview_version: previewVersion,
            variable_count: Object.keys(variables).length
        });
    } catch (err) {
        console.error('GET /api/projects/:id/content-preview-html error:', err);
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Verify**

After having an email saved and Lucía's session with `variable_values` in deliverables:

```bash
curl -s http://localhost:3001/api/projects/YOUR_ID/content-preview-html \
  -b "connect.sid=YOUR_SESSION_COOKIE"
```

Expected: `{"html":"<!DOCTYPE html>...with filled values...","is_stale":false,"html_version":1,"preview_version":1,"variable_count":5}`

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(api): add GET /api/projects/:id/content-preview-html endpoint"
```

---

## Task 8: Frontend — i18n translation keys

**Files:**
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add emailSpec keys to both es and en sections**

Find the `es:` object in translations.js and add inside it (find a logical place near `emailBuilder` keys):

```javascript
        emailSpec: {
            title: 'Email Spec',
            warningBadge: '⚠ Email Spec no definido — los agentes trabajarán sin contrato compartido',
            designNotes: 'Notas de diseño',
            designNotesPlaceholder: 'Layout, colores, estilo... Describe cómo debe verse el email',
            blocks: 'Bloques',
            addBlock: '+ Añadir bloque',
            blockName: 'Nombre del bloque',
            blockGuidance: 'Guía de contenido',
            blockVariables: 'Variables',
            blockVariablesPlaceholder: '@headline, @cta_text',
            removeBlock: 'Eliminar bloque',
            variableList: 'Variables AMPscript',
            variableListNote: 'Se actualiza automáticamente al guardar un email',
            variableContext: 'Guía por variable',
            variableContextPlaceholder: 'Descripción de lo que debe contener esta variable',
            contentPreview: 'Preview con contenido',
            templateView: 'Template',
            staleWarning: '⚠ Preview desactualizado — el Developer añadió nuevos bloques',
            noPreview: 'Lucía no ha generado contenido aún',
        },
```

Find the `en:` object and add:

```javascript
        emailSpec: {
            title: 'Email Spec',
            warningBadge: '⚠ Email Spec not defined — agents will work without shared contract',
            designNotes: 'Design notes',
            designNotesPlaceholder: 'Layout, colors, style... Describe how the email should look',
            blocks: 'Blocks',
            addBlock: '+ Add block',
            blockName: 'Block name',
            blockGuidance: 'Content guidance',
            blockVariables: 'Variables',
            blockVariablesPlaceholder: '@headline, @cta_text',
            removeBlock: 'Remove block',
            variableList: 'AMPscript variables',
            variableListNote: 'Auto-updated when you save an email',
            variableContext: 'Variable guidance',
            variableContextPlaceholder: 'Description of what this variable should contain',
            contentPreview: 'Content preview',
            templateView: 'Template',
            staleWarning: '⚠ Preview outdated — Developer added new blocks',
            noPreview: 'Lucía has not generated content yet',
        },
```

- [ ] **Step 2: Verify**

Start the frontend (`npm start`). Check browser console — no missing translation key errors.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/i18n/translations.js
git commit -m "feat(i18n): add emailSpec translation keys (es + en)"
```

---

## Task 9: Frontend — Email Spec section in App.jsx project detail view

**Files:**
- Modify: `apps/dashboard/src/App.jsx`

- [ ] **Step 1: Add Email Spec warning badge**

In `App.jsx`, inside the `{projectTab === 'details' && <>` block, after the Overview `<section>` card (around line 387, after the `</section>` that closes the overview card), add:

```jsx
          {/* Email Spec warning badge */}
          {(!selectedProject.email_spec?.design_notes && !(selectedProject.email_spec?.blocks?.length > 0)) && (
            <div style={{
              background: 'var(--accent-yellow-bg, #fef9c3)',
              border: '1px solid var(--accent-yellow, #eab308)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              {t('emailSpec.warningBadge')}
            </div>
          )}
```

- [ ] **Step 2: Add Email Spec edit+view section**

After the PM Notes section (around line 399), add:

```jsx
          {/* Email Spec */}
          <section className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-blue)' }}>
              ✉ {t('emailSpec.title')}
            </h3>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Design notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('emailSpec.designNotes')}
                  </label>
                  <textarea
                    className="edit-subtitle-full"
                    rows={3}
                    placeholder={t('emailSpec.designNotesPlaceholder')}
                    value={selectedProject.email_spec?.design_notes || ''}
                    onChange={e => setSelectedProject({
                      ...selectedProject,
                      email_spec: { ...(selectedProject.email_spec || {}), design_notes: e.target.value }
                    })}
                  />
                </div>

                {/* Blocks */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {t('emailSpec.blocks')}
                  </label>
                  {(selectedProject.email_spec?.blocks || []).map((block, i) => (
                    <div key={i} style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          className="edit-select"
                          style={{ flex: '0 0 140px' }}
                          placeholder={t('emailSpec.blockName')}
                          value={block.name || ''}
                          onChange={e => {
                            const blocks = [...(selectedProject.email_spec?.blocks || [])];
                            blocks[i] = { ...blocks[i], name: e.target.value };
                            setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                          }}
                        />
                        <input
                          className="edit-select"
                          style={{ flex: 1 }}
                          placeholder={t('emailSpec.blockGuidance')}
                          value={block.guidance || ''}
                          onChange={e => {
                            const blocks = [...(selectedProject.email_spec?.blocks || [])];
                            blocks[i] = { ...blocks[i], guidance: e.target.value };
                            setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                          }}
                        />
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: '1rem' }}
                          onClick={() => {
                            const blocks = (selectedProject.email_spec?.blocks || []).filter((_, j) => j !== i);
                            setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                          }}
                          title={t('emailSpec.removeBlock')}
                        >×</button>
                      </div>
                      <input
                        className="edit-select"
                        style={{ width: '100%', fontSize: '0.8rem' }}
                        placeholder={t('emailSpec.blockVariablesPlaceholder')}
                        value={(block.variables || []).join(', ')}
                        onChange={e => {
                          const vars = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
                          const blocks = [...(selectedProject.email_spec?.blocks || [])];
                          blocks[i] = { ...blocks[i], variables: vars };
                          setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    className="back-button"
                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                    onClick={() => {
                      const blocks = [...(selectedProject.email_spec?.blocks || []), { name: '', guidance: '', variables: [] }];
                      setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                    }}
                  >{t('emailSpec.addBlock')}</button>
                </div>

                {/* Variable list (read-only, auto-populated) */}
                {(selectedProject.email_spec?.variable_list?.length > 0) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {t('emailSpec.variableList')} <span style={{ opacity: 0.6 }}>({t('emailSpec.variableListNote')})</span>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(selectedProject.email_spec.variable_list).map(v => (
                        <span key={v} style={{
                          background: 'var(--bg-section)', border: '1px solid var(--border-default)',
                          borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace'
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {selectedProject.email_spec?.design_notes && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {selectedProject.email_spec.design_notes}
                  </p>
                )}
                {(selectedProject.email_spec?.blocks?.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {selectedProject.email_spec.blocks.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', background: 'var(--bg-section)', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ fontWeight: 600, minWidth: '100px' }}>{b.name}</span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{b.guidance}</span>
                        {b.variables?.length > 0 && (
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-blue)' }}>{b.variables.join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(selectedProject.email_spec?.variable_list?.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedProject.email_spec.variable_list.map(v => (
                      <span key={v} style={{
                        background: 'var(--bg-section)', border: '1px solid var(--border-default)',
                        borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace'
                      }}>{v}</span>
                    ))}
                  </div>
                )}
                {!selectedProject.email_spec?.design_notes && !(selectedProject.email_spec?.blocks?.length > 0) && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    {t('emailSpec.warningBadge')}
                  </p>
                )}
              </div>
            )}
          </section>
```

- [ ] **Step 3: Verify**

Open a project in the dashboard. The Email Spec section should appear in the Details tab. In edit mode, you can add blocks and design notes. Save — check the DB that `email_spec` is updated.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/App.jsx
git commit -m "feat(ui): add Email Spec section to project detail view with warning badge"
```

---

## Task 10: Frontend — Content Preview toggle in EmailBuilderPreview

**Files:**
- Modify: `apps/dashboard/src/components/EmailBuilderPreview.jsx`

- [ ] **Step 1: Add state and fetch logic**

In `EmailBuilderPreview`, after the existing state declarations (around line 48), add:

```javascript
  const [previewMode, setPreviewMode] = useState('template'); // 'template' | 'content'
  const [contentPreviewHtml, setContentPreviewHtml] = useState(null);
  const [contentPreviewStale, setContentPreviewStale] = useState(false);
  const [contentPreviewLoading, setContentPreviewLoading] = useState(false);
```

Add a fetch effect after the `showSavePopover` click-outside effect:

```javascript
  // Fetch content preview from Lucía's session deliverables
  useEffect(() => {
    if (!projectId || previewMode !== 'content') return;
    let cancelled = false;
    setContentPreviewLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/content-preview-html`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setContentPreviewHtml(data.html);
        setContentPreviewStale(data.is_stale);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setContentPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, previewMode]);
```

- [ ] **Step 2: Update tabs array and add toggle button**

Change the `tabs` array (around line 137) to add a third option that only shows when `projectId` exists:

```javascript
  const tabs = [
    { id: 'preview', label: t('emailBuilder.tabPreview') },
    { id: 'html',    label: t('emailBuilder.tabHtml') },
  ];
```

Add the Content Preview toggle in the preview header toolbar. Find where the tab buttons are rendered (search for `tabs.map` in the file), and after the existing tabs render, add:

```jsx
          {projectId && (
            <button
              className={`email-tab-btn${previewMode === 'content' ? ' active' : ''}`}
              style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
              onClick={() => setPreviewMode(previewMode === 'content' ? 'template' : 'content')}
            >
              {previewMode === 'content' ? t('emailSpec.templateView') : t('emailSpec.contentPreview')}
            </button>
          )}
```

- [ ] **Step 3: Render content preview HTML when mode is active**

Find the `PreviewContent` variable (around line 205) which contains the main iframe. Replace the `html ? <iframe .../>` part with:

```jsx
        {previewMode === 'content' ? (
          contentPreviewLoading ? (
            <div className="email-preview-empty"><span>{t('common.loading') || 'Loading...'}</span></div>
          ) : contentPreviewHtml ? (
            <>
              {contentPreviewStale && (
                <div style={{ background: '#fef9c3', border: '1px solid #eab308', borderRadius: '4px', padding: '8px 12px', margin: '8px', fontSize: '0.8rem' }}>
                  {t('emailSpec.staleWarning')}
                </div>
              )}
              <iframe
                sandbox="allow-same-origin"
                srcDoc={contentPreviewHtml}
                title="Content Preview"
                className="email-preview-iframe"
              />
            </>
          ) : (
            <div className="email-preview-empty">
              <span style={{ fontSize: '2rem' }}>🤖</span>
              <span>{t('emailSpec.noPreview')}</span>
            </div>
          )
        ) : html ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            srcDoc={previewHtml}
            title="Email Preview"
            className="email-preview-iframe"
          />
        ) : (
          <div className="email-preview-empty">
            <span style={{ fontSize: '2rem' }}>✉️</span>
            <span>{t('emailBuilder.noEmailYet')}</span>
          </div>
        )}
```

- [ ] **Step 4: Verify**

In Email Studio with a project that has both a saved email AND Lucía's session with variable_values:
1. Click "Content Preview" — iframe shows the email with filled variables
2. If stale: yellow warning banner appears
3. Click "Template" — returns to AMPscript view

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/EmailBuilderPreview.jsx
git commit -m "feat(ui): add Content Preview toggle to EmailBuilderPreview"
```

---

## End-to-End Verification

After all tasks are complete:

1. **Create a new project** → check Email Spec section visible with warning badge
2. **Fill Email Spec** in the Brief: add design notes + 2 blocks (hero, cta) + block variables
3. **Go to Email Studio** → start HTML Developer session → verify email_spec injected in prompt (check server log `[PipelinePrompt]`)
4. **Developer generates email** with `%%=v(@headline)=%%` and `%%=v(@main_cta)=%%`
5. **Save the email** via Save Template → check DB: `email_spec.variable_list` updated, `html_version = 1`
6. **Go to Content Studio** → initialize Lucía session → verify HTML template injected in first message
7. **Ask Lucía to fill variables** → verify she outputs `[EMAIL_VARIABLES]` block → check DB: `variable_values` in session deliverables
8. **Back in Email Studio** → click "Content Preview" → verify filled HTML renders without `%%=v(...)=%%` placeholders
9. **Developer adds new block** with `%%=v(@new_var)=%%` → save email again → check stale badge appears in Content Preview
10. **Ask Lucía again** → she auto-fills `@new_var` → stale badge disappears
