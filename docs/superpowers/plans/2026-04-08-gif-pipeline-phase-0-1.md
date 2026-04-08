# GIF Pipeline — Phase 0 + Phase 1 (Mode C Typographic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the GIF pipeline foundation (DB table, SSE endpoint skeleton, Image Studio page scaffold) plus a fully working **Mode C — Typographic** pipeline that renders animated GIFs from text prompts using canvas presets, encoded with gifenc, persisted to disk + DB, and previewed in a new Image Studio page.

**Architecture:** One SSE endpoint (`POST /api/gif-pipeline/generate`) dispatches on `mode` to a pipeline module. Mode C uses Claude to pick a preset + fill params, `@napi-rs/canvas` renders frames, `gifenc` encodes with global palette. A new `/image-studio` React page (3-column layout) drives it. GIFs stored in `apps/dashboard/public/generated-gifs/` with a row in new `generated_gifs` table.

**Tech Stack:** Express 5 SSE, PostgreSQL 16, React 19 + React Router 7, `@napi-rs/canvas`, `gifenc`, `@anthropic-ai/sdk` (already installed), CSS custom properties.

**Spec reference:** [`docs/superpowers/specs/2026-04-08-gif-pipeline-image-studio-design.md`](../specs/2026-04-08-gif-pipeline-image-studio-design.md)

**Scope:** Phases 0 + 1 only. Modes A (Slideshow) and B (Veo), plus Content Studio integration, are **out of scope** for this plan — they get their own plans after Phase 1 is validated end-to-end.

---

## File Structure

### New files

**Backend — Pipeline module (`packages/core/gif-pipeline/`):**
- `index.js` — Router: `runPipeline(mode, prompt, options, emit)` dispatches to mode handlers
- `typographic.js` — Mode C pipeline orchestrator
- `encoder.js` — gifenc wrapper with `encodeFrames(frames, width, height, opts)` API
- `fonts.js` — Font registration helper (called once on import)
- `presets/index.js` — Exports all presets as a map + `getPresetCatalog()` for Claude system prompt
- `presets/bounce_headline.js` — First preset (only one for this plan; other 5 are stubs)
- `presets/_shared.js` — Shared easing functions + color parsing
- `fonts/Inter-Bold.ttf` — Bundled font file (download during implementation)

**Backend — Server integration:**
- Section added to `apps/dashboard/server.js` (not a new file)

**Backend — Database:**
- Migration appended to `packages/core/db/schema.sql`

**Frontend — Image Studio page:**
- `apps/dashboard/src/pages/ImageStudioPage.jsx` — Top-level page, 3-column layout, tab state
- `apps/dashboard/src/components/studio/GifPipelinePreview.jsx` — Center column preview
- `apps/dashboard/src/components/studio/PipelineStepsTimeline.jsx` — Right column timeline

### Modified files
- `apps/dashboard/package.json` — Add `gifenc`, `@napi-rs/canvas` dependencies
- `apps/dashboard/server.js` — Add GIF pipeline endpoint section + static serve
- `apps/dashboard/src/main.jsx` — Register `/app/image-studio` route
- `apps/dashboard/src/components/Layout.jsx` — Add sidebar entry for Image Studio
- `apps/dashboard/src/components/icons.jsx` — Add `imageStudio` icon to `NavIcons`
- `apps/dashboard/src/i18n/translations.js` — Add ~25 keys ES/EN for Image Studio
- `apps/dashboard/src/index.css` — Add styles for Image Studio layout
- `packages/core/db/schema.sql` — Append `generated_gifs` CREATE TABLE
- `.gitignore` — Ignore `apps/dashboard/public/generated-gifs/*.gif` and `*.png` (generated content)

### Files responsible for one thing each
- **`encoder.js`** — Only knows about gifenc. Takes RGBA buffers, returns a `.gif` Buffer.
- **`typographic.js`** — Only orchestrates the Mode C sequence (plan → render → encode → persist). Does not know how Imagen works.
- **`presets/*.js`** — Each preset is a pure rendering function. Does not know about encoding or persistence.
- **`GifPipelinePreview.jsx`** — Only displays preview state. Does not own SSE logic.
- **`ImageStudioPage.jsx`** — Owns SSE connection, tab state, and wires the three columns.

---

# Phase 0 — Foundation

Lays the scaffolding so that Phase 1 can plug in cleanly. At the end of Phase 0 the page loads and the endpoint exists but returns a stub event. Nothing renders a real GIF yet.

---

### Task 0.1: Install new backend dependencies

**Files:**
- Modify: `apps/dashboard/package.json`

- [ ] **Step 1: Install gifenc and @napi-rs/canvas**

Run from the project root:

```bash
cd apps/dashboard && npm install gifenc @napi-rs/canvas
```

- [ ] **Step 2: Verify both are listed in dependencies**

Run:
```bash
grep -E '"gifenc"|"@napi-rs/canvas"' apps/dashboard/package.json
```

Expected output (versions will vary):
```
    "@napi-rs/canvas": "^0.1.x",
    "gifenc": "^1.0.x",
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json
git commit -m "chore(gif-pipeline): add gifenc and @napi-rs/canvas dependencies"
```

---

### Task 0.2: Create `generated_gifs` table

**Files:**
- Modify: `packages/core/db/schema.sql` (append at end of file)

- [ ] **Step 1: Append the CREATE TABLE statement**

Add to the very end of `packages/core/db/schema.sql`:

```sql

-- ─── GIF Pipeline: generated GIFs catalog ─────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_gifs (
  id              SERIAL PRIMARY KEY,
  mode            TEXT NOT NULL CHECK (mode IN ('slideshow', 'typographic', 'veo')),
  prompt          TEXT NOT NULL,
  plan            JSONB,
  file_path       TEXT NOT NULL,
  thumbnail_path  TEXT,
  width           INT,
  height          INT,
  duration_ms     INT,
  frame_count     INT,
  file_size_bytes INT,
  user_id         INT REFERENCES workspace_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_gifs_user_created
  ON generated_gifs(user_id, created_at DESC);
```

- [ ] **Step 2: Apply migration to running DB**

Run:
```bash
docker exec -i agentos-postgres-1 psql -U postgres -d agentos < packages/core/db/schema.sql
```

Expected output: a series of `CREATE TABLE` / `NOTICE` lines with no errors. Look specifically for a line referencing `generated_gifs` (or `already exists` on re-runs — that is also OK).

Note: if your container name is different, run `docker ps` first to find it. Substitute the actual container name.

- [ ] **Step 3: Verify the table exists**

Run:
```bash
docker exec -i agentos-postgres-1 psql -U postgres -d agentos -c "\d generated_gifs"
```

Expected: a table description showing all columns defined in step 1.

- [ ] **Step 4: Commit**

```bash
git add packages/core/db/schema.sql
git commit -m "feat(db): add generated_gifs table for GIF pipeline"
```

---

### Task 0.3: Create `generated-gifs` static directory and gitignore

**Files:**
- Create: `apps/dashboard/public/generated-gifs/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create directory with a .gitkeep placeholder**

```bash
mkdir -p apps/dashboard/public/generated-gifs
touch apps/dashboard/public/generated-gifs/.gitkeep
```

- [ ] **Step 2: Add ignore rule for generated content**

Append to `.gitignore`:
```
# GIF pipeline generated output (keep the directory via .gitkeep, ignore files)
apps/dashboard/public/generated-gifs/*.gif
apps/dashboard/public/generated-gifs/*.png
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/public/generated-gifs/.gitkeep .gitignore
git commit -m "chore(gif-pipeline): add generated-gifs output directory"
```

---

### Task 0.4: Create pipeline module skeleton (index.js, encoder.js)

**Files:**
- Create: `packages/core/gif-pipeline/index.js`
- Create: `packages/core/gif-pipeline/encoder.js`

- [ ] **Step 1: Create `packages/core/gif-pipeline/index.js`**

```js
// packages/core/gif-pipeline/index.js
// Router: dispatches pipeline execution to the appropriate mode handler.
// Each mode handler receives (prompt, options, emit) where emit(event) sends
// an SSE event to the client.

/**
 * @typedef {Object} PipelineEvent
 * @property {string} step - Event type (planning, plan_ready, rendering, done, error, etc.)
 * @property {*} [key: string] - Additional fields per step
 */

/**
 * @typedef {('slideshow'|'typographic'|'veo')} PipelineMode
 */

/**
 * Run a GIF pipeline.
 * @param {PipelineMode} mode
 * @param {string} prompt
 * @param {object} options
 * @param {(event: PipelineEvent) => void} emit
 * @param {object} ctx - { userId, pool }
 * @returns {Promise<{ gifId: number, filePath: string }>}
 */
export async function runPipeline(mode, prompt, options, emit, ctx) {
  if (mode === 'typographic') {
    const { runTypographicPipeline } = await import('./typographic.js');
    return runTypographicPipeline(prompt, options, emit, ctx);
  }
  if (mode === 'slideshow') {
    throw new Error('Mode "slideshow" not implemented yet (see Phase 2)');
  }
  if (mode === 'veo') {
    throw new Error('Mode "veo" not implemented yet (see Phase 4)');
  }
  throw new Error(`Unknown pipeline mode: ${mode}`);
}
```

- [ ] **Step 2: Create `packages/core/gif-pipeline/encoder.js`**

```js
// packages/core/gif-pipeline/encoder.js
// Thin wrapper around gifenc. Takes an array of RGBA Uint8ClampedArray frames
// (one per animation frame) and returns a GIF buffer.

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/**
 * Encode an array of RGBA frames to a GIF buffer.
 *
 * @param {Uint8ClampedArray[]} frames - RGBA pixel data, one entry per frame
 * @param {number} width
 * @param {number} height
 * @param {object} options
 * @param {number} options.frameDelay - Delay between frames in ms
 * @param {('global'|'per-frame')} [options.paletteMode='global']
 * @param {number} [options.maxColors=256]
 * @returns {Uint8Array} The encoded GIF bytes
 */
export function encodeFrames(frames, width, height, options) {
  const { frameDelay, paletteMode = 'global', maxColors = 256 } = options;
  if (!frames || frames.length === 0) {
    throw new Error('encodeFrames: frames array is empty');
  }

  const gif = GIFEncoder();

  if (paletteMode === 'global') {
    // Build a global palette from the first frame and reuse it.
    // Works well for typographic content with low color variance.
    const palette = quantize(frames[0], maxColors);
    for (const frame of frames) {
      const indexed = applyPalette(frame, palette);
      gif.writeFrame(indexed, width, height, { palette, delay: frameDelay });
    }
  } else {
    // Per-frame palette — better quality for varied scenes, larger files.
    for (const frame of frames) {
      const palette = quantize(frame, maxColors);
      const indexed = applyPalette(frame, palette);
      gif.writeFrame(indexed, width, height, { palette, delay: frameDelay });
    }
  }

  gif.finish();
  return gif.bytes();
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/gif-pipeline/index.js packages/core/gif-pipeline/encoder.js
git commit -m "feat(gif-pipeline): add pipeline router and gifenc encoder wrapper"
```

---

### Task 0.5: Add SSE endpoint skeleton to server.js

**Files:**
- Modify: `apps/dashboard/server.js` (add new section before the `server.listen(...)` call at the end, around line 7179)

- [ ] **Step 1: Add the import at the top of server.js**

Find the imports section near the top of `apps/dashboard/server.js`. Add near the other `packages/core` imports:

```js
import { runPipeline as runGifPipeline } from '../../packages/core/gif-pipeline/index.js';
```

- [ ] **Step 2: Add the GIF pipeline section**

Find the line `app.use('/temp-images', express.static(tempImagesDir));` (around line 7163) and add AFTER it:

```js
// ═══════════════════════════════════════════════════════════════════════════════
// GIF PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

const generatedGifsDir = path.join(__dirname, 'public', 'generated-gifs');
if (!fs.existsSync(generatedGifsDir)) fs.mkdirSync(generatedGifsDir, { recursive: true });
app.use('/generated-gifs', express.static(generatedGifsDir));

// POST /api/gif-pipeline/generate — SSE stream that drives a GIF pipeline.
// Body: { mode: 'slideshow'|'typographic'|'veo', prompt: string, options?: object }
app.post('/api/gif-pipeline/generate', requireAuth, async (req, res) => {
  const { mode, prompt, options = {} } = req.body || {};

  if (!mode || !prompt) {
    return res.status(400).json({ error: 'mode and prompt are required' });
  }
  if (!['slideshow', 'typographic', 'veo'].includes(mode)) {
    return res.status(400).json({ error: `Invalid mode: ${mode}` });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const emit = (event) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    emit({ step: 'planning', text: 'Analyzing prompt...' });
    await runGifPipeline(mode, prompt, options, emit, {
      userId: req.session.userId,
      pool,
    });
    res.write('data: [DONE]\n\n');
  } catch (err) {
    console.error('[gif-pipeline] Error:', err);
    emit({ step: 'error', stage: 'pipeline', error: err.message });
    res.write('data: [DONE]\n\n');
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// GET /api/gif-pipeline/gallery — list the current user's generated GIFs
app.get('/api/gif-pipeline/gallery', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, mode, prompt, file_path, thumbnail_path, width, height,
              duration_ms, frame_count, file_size_bytes, created_at
         FROM generated_gifs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.session.userId]
    );
    res.json({ gifs: rows });
  } catch (err) {
    console.error('[gif-pipeline:gallery] Error:', err);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

// DELETE /api/gif-pipeline/gif/:id — delete a GIF (file + DB row)
app.delete('/api/gif-pipeline/gif/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT file_path, thumbnail_path FROM generated_gifs
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const { file_path, thumbnail_path } = rows[0];
    const gifFsPath = path.join(__dirname, 'public', file_path.replace(/^\//, ''));
    const thumbFsPath = thumbnail_path
      ? path.join(__dirname, 'public', thumbnail_path.replace(/^\//, ''))
      : null;

    try { if (fs.existsSync(gifFsPath)) fs.unlinkSync(gifFsPath); } catch (_) {}
    try { if (thumbFsPath && fs.existsSync(thumbFsPath)) fs.unlinkSync(thumbFsPath); } catch (_) {}

    await pool.query(`DELETE FROM generated_gifs WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[gif-pipeline:delete] Error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});
```

- [ ] **Step 3: Restart the server and verify it starts cleanly**

```bash
npm run kill-ports
npm run server &
```

Wait 3 seconds, then:
```bash
curl -s http://localhost:3001/api/gif-pipeline/gallery -o /dev/null -w "%{http_code}\n"
```

Expected: `401` (unauthenticated request rejected by `requireAuth`). This proves the route is wired.

If you see `Cannot find module` or any import error, fix it before continuing.

- [ ] **Step 4: Stop the background server**

```bash
npm run kill-ports
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/server.js
git commit -m "feat(gif-pipeline): add SSE endpoint skeleton and static serve"
```

---

### Task 0.6: Add sidebar icon and i18n base keys

**Files:**
- Modify: `apps/dashboard/src/components/icons.jsx`
- Modify: `apps/dashboard/src/i18n/translations.js`

- [ ] **Step 1: Add icon import and NavIcons entry**

In `apps/dashboard/src/components/icons.jsx`, find the import list near the top. Find `lucide-react` import. Add `Film` to the imports (it exists in lucide-react).

Then in the `NavIcons` export (around line 28), add this line inside the object:

```jsx
  imageStudio: <Film size={20} />,
```

- [ ] **Step 2: Add i18n keys for Image Studio**

In `apps/dashboard/src/i18n/translations.js`, find the top-level `es` object. Inside it find the `layout` sub-object (it contains `home`, `dashboard`, etc.) and add:

```js
      imageStudio: 'Image Studio',
```

Then find `imageStudio` is NOT present yet (search for it — it should not exist). Add a new top-level key `imageStudio` inside the `es` object (at the same level as `layout`, `campaigns`, etc.):

```js
    imageStudio: {
      title: 'Image Studio',
      subtitle: 'Generate animated GIFs powered by agent workflows',
      tabs: {
        slideshow: 'Slideshow',
        typographic: 'Typographic',
        veo: 'Video (Veo)',
      },
      chat: {
        placeholder: 'Describe the GIF you want...',
        send: 'Generate',
      },
      steps: {
        planning: 'Planning',
        planReady: 'Plan ready',
        rendering: 'Rendering',
        encoding: 'Encoding',
        persisting: 'Saving',
        done: 'Done',
        error: 'Error',
      },
      preview: {
        empty: 'Your GIF will appear here',
        metaFrames: 'Frames',
        metaDuration: 'Duration',
        metaSize: 'Size',
        metaDimensions: 'Dimensions',
        save: 'Save to gallery',
        sendToEmail: 'Send to Email Studio',
        download: 'Download',
      },
      gallery: {
        title: 'Gallery',
        empty: 'No GIFs generated yet',
      },
      modeComingSoon: 'This mode is coming soon — try Typographic while we ship the others.',
    },
```

- [ ] **Step 3: Mirror the same structure in the `en` object**

Find the `en` object (same file, below the `es` object) and add `imageStudio: 'Image Studio'` inside `layout`, plus the same top-level `imageStudio` block with English text (same keys, translated values):

```js
    imageStudio: {
      title: 'Image Studio',
      subtitle: 'Generate animated GIFs powered by agent workflows',
      tabs: {
        slideshow: 'Slideshow',
        typographic: 'Typographic',
        veo: 'Video (Veo)',
      },
      chat: {
        placeholder: 'Describe the GIF you want...',
        send: 'Generate',
      },
      steps: {
        planning: 'Planning',
        planReady: 'Plan ready',
        rendering: 'Rendering',
        encoding: 'Encoding',
        persisting: 'Saving',
        done: 'Done',
        error: 'Error',
      },
      preview: {
        empty: 'Your GIF will appear here',
        metaFrames: 'Frames',
        metaDuration: 'Duration',
        metaSize: 'Size',
        metaDimensions: 'Dimensions',
        save: 'Save to gallery',
        sendToEmail: 'Send to Email Studio',
        download: 'Download',
      },
      gallery: {
        title: 'Gallery',
        empty: 'No GIFs generated yet',
      },
      modeComingSoon: 'This mode is coming soon — try Typographic while we ship the others.',
    },
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/icons.jsx apps/dashboard/src/i18n/translations.js
git commit -m "feat(image-studio): add sidebar icon and i18n base keys"
```

---

### Task 0.7: Create ImageStudioPage scaffold

**Files:**
- Create: `apps/dashboard/src/pages/ImageStudioPage.jsx`
- Create: `apps/dashboard/src/components/studio/GifPipelinePreview.jsx`
- Create: `apps/dashboard/src/components/studio/PipelineStepsTimeline.jsx`
- Modify: `apps/dashboard/src/index.css` (append new styles)

- [ ] **Step 1: Create `GifPipelinePreview.jsx` (empty-state only for now)**

Create `apps/dashboard/src/components/studio/GifPipelinePreview.jsx`:

```jsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * GifPipelinePreview — center column of Image Studio.
 * Shows the current pipeline state: empty, in-progress (frame thumbnails),
 * or done (final GIF + metadata + actions).
 */
export default function GifPipelinePreview({ state }) {
  const { t } = useLanguage();

  if (!state || state.status === 'idle') {
    return (
      <div className="gif-preview gif-preview-empty">
        <div className="gif-preview-empty-text">{t('imageStudio.preview.empty')}</div>
      </div>
    );
  }

  if (state.status === 'done' && state.gifUrl) {
    return (
      <div className="gif-preview gif-preview-done">
        <img src={state.gifUrl} alt="Generated GIF" className="gif-preview-image" />
        {state.meta && (
          <div className="gif-preview-meta">
            <span>{t('imageStudio.preview.metaFrames')}: {state.meta.frame_count}</span>
            <span>{t('imageStudio.preview.metaDuration')}: {state.meta.duration_ms}ms</span>
            <span>{t('imageStudio.preview.metaDimensions')}: {state.meta.width}×{state.meta.height}</span>
            {state.meta.file_size_bytes != null && (
              <span>{t('imageStudio.preview.metaSize')}: {Math.round(state.meta.file_size_bytes / 1024)}KB</span>
            )}
          </div>
        )}
        <div className="gif-preview-actions">
          <a href={state.gifUrl} download className="btn">{t('imageStudio.preview.download')}</a>
        </div>
      </div>
    );
  }

  // In progress — show a placeholder. Phase 2 will render frame thumbnails here.
  return (
    <div className="gif-preview gif-preview-progress">
      <div className="gif-preview-spinner" />
      <div className="gif-preview-progress-text">{state.statusText || '...'}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `PipelineStepsTimeline.jsx`**

Create `apps/dashboard/src/components/studio/PipelineStepsTimeline.jsx`:

```jsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * PipelineStepsTimeline — right column of Image Studio.
 * Vertical list of pipeline steps with pending/active/done/failed states.
 */
const STEP_KEYS_BY_MODE = {
  typographic: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
  slideshow: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
  veo: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
};

export default function PipelineStepsTimeline({ mode, completedSteps, activeStep, failedStep }) {
  const { t } = useLanguage();
  const steps = STEP_KEYS_BY_MODE[mode] || STEP_KEYS_BY_MODE.typographic;

  return (
    <div className="pipeline-timeline">
      {steps.map((stepKey) => {
        let status = 'pending';
        if (failedStep === stepKey) status = 'failed';
        else if (completedSteps.includes(stepKey)) status = 'done';
        else if (activeStep === stepKey) status = 'active';

        const marker =
          status === 'done' ? '✓' :
          status === 'failed' ? '✗' :
          status === 'active' ? '●' : '○';

        return (
          <div key={stepKey} className={`pipeline-step pipeline-step-${status}`}>
            <span className="pipeline-step-marker">{marker}</span>
            <span className="pipeline-step-label">{t(`imageStudio.steps.${stepKey}`)}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `ImageStudioPage.jsx`**

Create `apps/dashboard/src/pages/ImageStudioPage.jsx`:

```jsx
import React, { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import GifPipelinePreview from '../components/studio/GifPipelinePreview.jsx';
import PipelineStepsTimeline from '../components/studio/PipelineStepsTimeline.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MODES = ['typographic', 'slideshow', 'veo'];
const IMPLEMENTED_MODES = ['typographic'];

/**
 * ImageStudioPage — /app/image-studio
 *
 * Three-column layout:
 *   - Left: chat panel (prompt input + SSE event log)
 *   - Center: GifPipelinePreview
 *   - Right: PipelineStepsTimeline
 *
 * Tab state is per-mode: each mode keeps its own chat history and preview state
 * so the user can compare modes without losing context.
 */
export default function ImageStudioPage() {
  const { t } = useLanguage();
  const [activeMode, setActiveMode] = useState('typographic');
  // Per-mode state: { chatLog, previewState, timeline }
  const [modeStates, setModeStates] = useState(() =>
    MODES.reduce((acc, m) => {
      acc[m] = {
        chatLog: [],
        previewState: { status: 'idle' },
        timeline: { completedSteps: [], activeStep: null, failedStep: null },
      };
      return acc;
    }, {})
  );
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(null);

  const currentState = modeStates[activeMode];

  const updateMode = (mode, patch) => {
    setModeStates((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;

    if (!IMPLEMENTED_MODES.includes(activeMode)) {
      alert(t('imageStudio.modeComingSoon'));
      return;
    }

    const prompt = input.trim();
    setInput('');
    setIsRunning(true);

    // Reset state for this mode and add user message
    updateMode(activeMode, {
      chatLog: [...currentState.chatLog, { role: 'user', text: prompt }],
      previewState: { status: 'running', statusText: t('imageStudio.steps.planning') },
      timeline: { completedSteps: [], activeStep: 'planning', failedStep: null },
    });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_URL}/gif-pipeline/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: activeMode, prompt, options: {} }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || 'Request failed');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const event = JSON.parse(payload);
            handleSseEvent(activeMode, event);
          } catch (parseErr) {
            console.warn('[ImageStudio] Failed to parse SSE line:', payload);
          }
        }
      }
    } catch (err) {
      console.error('[ImageStudio] Pipeline error:', err);
      setModeStates((prev) => ({
        ...prev,
        [activeMode]: {
          ...prev[activeMode],
          chatLog: [...prev[activeMode].chatLog, { role: 'error', text: err.message }],
          previewState: { status: 'error' },
          timeline: { ...prev[activeMode].timeline, failedStep: prev[activeMode].timeline.activeStep },
        },
      }));
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  // Map SSE event to state updates for a given mode
  const handleSseEvent = (mode, event) => {
    setModeStates((prev) => {
      const state = prev[mode];
      const newChatLog = [...state.chatLog, { role: 'event', event }];
      let newTimeline = state.timeline;
      let newPreview = state.previewState;

      if (event.step === 'planning') {
        newTimeline = { ...newTimeline, activeStep: 'planning' };
      } else if (event.step === 'plan_ready') {
        newTimeline = {
          completedSteps: [...newTimeline.completedSteps, 'planning'],
          activeStep: 'planReady',
          failedStep: null,
        };
      } else if (event.step === 'rendering') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady'])),
          activeStep: 'rendering',
          failedStep: null,
        };
      } else if (event.step === 'encoding') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady', 'rendering'])),
          activeStep: 'encoding',
          failedStep: null,
        };
      } else if (event.step === 'persisting') {
        newTimeline = {
          completedSteps: Array.from(new Set([...newTimeline.completedSteps, 'planning', 'planReady', 'rendering', 'encoding'])),
          activeStep: 'persisting',
          failedStep: null,
        };
      } else if (event.step === 'done') {
        newTimeline = {
          completedSteps: ['planning', 'planReady', 'rendering', 'encoding', 'persisting', 'done'],
          activeStep: null,
          failedStep: null,
        };
        newPreview = {
          status: 'done',
          gifUrl: event.gif_url,
          thumbnailUrl: event.thumbnail_url,
          meta: event.meta,
        };
      } else if (event.step === 'error') {
        newTimeline = { ...newTimeline, failedStep: newTimeline.activeStep };
        newPreview = { status: 'error' };
      }

      return {
        ...prev,
        [mode]: {
          chatLog: newChatLog,
          timeline: newTimeline,
          previewState: newPreview,
        },
      };
    });
  };

  return (
    <div className="image-studio-page">
      <header className="image-studio-header">
        <div>
          <h1>{t('imageStudio.title')}</h1>
          <p className="image-studio-subtitle">{t('imageStudio.subtitle')}</p>
        </div>
        <div className="image-studio-tabs">
          {MODES.map((mode) => (
            <button
              key={mode}
              className={`image-studio-tab ${activeMode === mode ? 'active' : ''}`}
              onClick={() => setActiveMode(mode)}
            >
              {t(`imageStudio.tabs.${mode}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="image-studio-grid">
        <section className="image-studio-chat">
          <div className="image-studio-chat-log">
            {currentState.chatLog.length === 0 && (
              <div className="image-studio-chat-empty">
                {!IMPLEMENTED_MODES.includes(activeMode) && t('imageStudio.modeComingSoon')}
              </div>
            )}
            {currentState.chatLog.map((msg, i) => {
              if (msg.role === 'user') {
                return <div key={i} className="chat-msg chat-msg-user">{msg.text}</div>;
              }
              if (msg.role === 'error') {
                return <div key={i} className="chat-msg chat-msg-error">{msg.text}</div>;
              }
              // SSE event
              const step = msg.event?.step;
              return (
                <div key={i} className="chat-msg chat-msg-event">
                  <code>{step}</code>
                  {msg.event.text && <span> — {msg.event.text}</span>}
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSubmit} className="image-studio-chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('imageStudio.chat.placeholder')}
              disabled={isRunning}
            />
            <button type="submit" disabled={isRunning || !input.trim()}>
              {t('imageStudio.chat.send')}
            </button>
          </form>
        </section>

        <section className="image-studio-preview">
          <GifPipelinePreview state={currentState.previewState} />
        </section>

        <section className="image-studio-timeline">
          <PipelineStepsTimeline
            mode={activeMode}
            completedSteps={currentState.timeline.completedSteps}
            activeStep={currentState.timeline.activeStep}
            failedStep={currentState.timeline.failedStep}
          />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS styles for Image Studio**

Append to `apps/dashboard/src/index.css`:

```css
/* ─── Image Studio ──────────────────────────────────────────────────────── */
.image-studio-page {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
  overflow: hidden;
}

.image-studio-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
}

.image-studio-header h1 {
  margin: 0 0 0.25rem 0;
}

.image-studio-subtitle {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.image-studio-tabs {
  display: flex;
  gap: 0.5rem;
}

.image-studio-tab {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.875rem;
}

.image-studio-tab.active {
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border-color: var(--accent);
}

.image-studio-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr 0.8fr;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.image-studio-chat,
.image-studio-preview,
.image-studio-timeline {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.image-studio-chat-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.image-studio-chat-empty {
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: 2rem 1rem;
}

.chat-msg {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.875rem;
  line-height: 1.4;
}

.chat-msg-user {
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  align-self: flex-end;
  max-width: 85%;
}

.chat-msg-event {
  background: var(--bg);
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
}

.chat-msg-error {
  background: #fee;
  color: #c00;
  border: 1px solid #fcc;
}

.image-studio-chat-form {
  display: flex;
  gap: 0.5rem;
}

.image-studio-chat-form input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
}

.image-studio-chat-form button {
  padding: 0.5rem 1rem;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border-radius: var(--radius);
  cursor: pointer;
}

.image-studio-chat-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gif-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.gif-preview-empty-text {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.gif-preview-image {
  max-width: 100%;
  max-height: 60%;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.gif-preview-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  flex-wrap: wrap;
  justify-content: center;
}

.gif-preview-actions {
  display: flex;
  gap: 0.5rem;
}

.gif-preview-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pipeline-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pipeline-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.pipeline-step-marker {
  font-weight: bold;
  width: 1.25rem;
  text-align: center;
}

.pipeline-step-pending { color: var(--text-muted); }
.pipeline-step-active  { color: var(--accent); animation: pulse 1.5s ease-in-out infinite; }
.pipeline-step-done    { color: var(--success, #0a0); }
.pipeline-step-failed  { color: var(--danger, #c00); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/ImageStudioPage.jsx \
        apps/dashboard/src/components/studio/GifPipelinePreview.jsx \
        apps/dashboard/src/components/studio/PipelineStepsTimeline.jsx \
        apps/dashboard/src/index.css
git commit -m "feat(image-studio): scaffold page with three-column layout and SSE client"
```

---

### Task 0.8: Wire the route and sidebar entry

**Files:**
- Modify: `apps/dashboard/src/main.jsx`
- Modify: `apps/dashboard/src/components/Layout.jsx`

- [ ] **Step 1: Import and register the route**

In `apps/dashboard/src/main.jsx`, find the `import ContentStudioPage from './pages/ContentStudioPage.jsx';` line (around line 28) and add right after it:

```js
import ImageStudioPage from './pages/ImageStudioPage.jsx';
```

Then find the Route for ContentStudio (around line 125: `<Route path="/workspace/agent/content-agent/studio" element={<ContentStudioPage />} />`) and add this route in the same `/app/*` routes block (ideally near the other studios):

```jsx
<Route path="/image-studio" element={<ImageStudioPage />} />
```

Place it alongside the other regular `/app/*` routes (so the full path becomes `/app/image-studio`).

- [ ] **Step 2: Add sidebar entry**

In `apps/dashboard/src/components/Layout.jsx`, find the `navGroups` array (around line 15). In the `Main` group (the first one), add a new entry after `campaigns`:

```js
{ to: '/app/image-studio', icon: icons.imageStudio, label: t('layout.imageStudio') },
```

Your Main group should now look like:

```js
{
    label: 'Main',
    items: [
        { to: '/app', icon: icons.home, label: t('layout.home') },
        { to: '/app/projects', icon: icons.dashboard, label: t('layout.dashboard') },
        { to: '/app/workspace', icon: icons.workspace, label: t('layout.workspace') },
        { to: '/app/campaigns', icon: icons.campaigns, label: t('layout.campaigns') },
        { to: '/app/image-studio', icon: icons.imageStudio, label: t('layout.imageStudio') },
    ],
},
```

- [ ] **Step 3: Restart dev server and verify in browser**

```bash
npm run kill-ports
npm start &
```

Wait for Vite to start (~5 seconds). Open `http://localhost:4000/app/image-studio` in a browser.

Expected:
- Page loads with "Image Studio" header
- Three tabs visible: Slideshow / Typographic / Typographic active by default
- Three columns visible: chat (left), preview empty state (center), timeline steps pending (right)
- Sidebar shows "Image Studio" entry that navigates here
- No console errors

If anything doesn't render, fix it before continuing.

- [ ] **Step 4: Stop the dev server**

```bash
npm run kill-ports
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/main.jsx apps/dashboard/src/components/Layout.jsx
git commit -m "feat(image-studio): wire /app/image-studio route and sidebar entry"
```

---

**Phase 0 checkpoint:** The page loads, the endpoint exists and responds with 401 unauthenticated / empty `[DONE]` stream authenticated. No real GIF generation yet. Next phase wires Mode C end-to-end.

---

# Phase 1 — Mode C (Typographic) pipeline

Implements the full Typographic pipeline: Claude picks a preset + params, canvas renders frames, gifenc encodes, file is written, DB row created, SSE emits `done` with the URL, and the Image Studio page shows the GIF.

---

### Task 1.1: Download Inter Bold font

**Files:**
- Create: `packages/core/gif-pipeline/fonts/Inter-Bold.ttf`

- [ ] **Step 1: Download the font**

Inter is SIL OFL licensed — free for bundling. Download Inter Bold from the GitHub releases:

```bash
mkdir -p packages/core/gif-pipeline/fonts
curl -L -o packages/core/gif-pipeline/fonts/Inter-Bold.ttf \
  https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf
```

- [ ] **Step 2: Verify the file exists and has a reasonable size**

```bash
ls -la packages/core/gif-pipeline/fonts/Inter-Bold.ttf
```

Expected: file exists, size > 100KB (fonts are typically 200-400KB).

If the download failed, use an alternative source — any Inter Bold TTF will work. Do not proceed with a 0-byte or HTML file (you can check with `file packages/core/gif-pipeline/fonts/Inter-Bold.ttf` which should report "TrueType Font data").

- [ ] **Step 3: Create a README noting the license**

Create `packages/core/gif-pipeline/fonts/README.md`:

```markdown
# Bundled Fonts

These fonts are bundled for use by the GIF pipeline Mode C (Typographic).

## Inter
- File: `Inter-Bold.ttf`
- License: SIL Open Font License 1.1
- Source: https://github.com/rsms/inter
- Copyright: The Inter Project Authors

Additional weights/families will be added here as presets require them.
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/gif-pipeline/fonts/Inter-Bold.ttf packages/core/gif-pipeline/fonts/README.md
git commit -m "chore(gif-pipeline): bundle Inter Bold font for typographic presets"
```

---

### Task 1.2: Create font registration helper

**Files:**
- Create: `packages/core/gif-pipeline/fonts.js`

- [ ] **Step 1: Create the font registration module**

Create `packages/core/gif-pipeline/fonts.js`:

```js
// packages/core/gif-pipeline/fonts.js
// Registers bundled fonts with @napi-rs/canvas at import time.
// Importing this module has the side effect of making 'Inter' available
// as a canvas font family.

import { GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let registered = false;

export function ensureFontsRegistered() {
  if (registered) return;
  const interBoldPath = path.join(__dirname, 'fonts', 'Inter-Bold.ttf');
  GlobalFonts.registerFromPath(interBoldPath, 'Inter');
  registered = true;
  console.log('[gif-pipeline:fonts] Registered Inter Bold from', interBoldPath);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/gif-pipeline/fonts.js
git commit -m "feat(gif-pipeline): add font registration helper"
```

---

### Task 1.3: Create shared preset utilities

**Files:**
- Create: `packages/core/gif-pipeline/presets/_shared.js`

- [ ] **Step 1: Create the shared module**

Create `packages/core/gif-pipeline/presets/_shared.js`:

```js
// packages/core/gif-pipeline/presets/_shared.js
// Shared helpers used by multiple typographic presets.

/**
 * Ease-out cubic — fast start, gentle finish. Good for entrances.
 * @param {number} t - Progress 0..1
 * @returns {number} Eased 0..1
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-out bounce — elastic bounce at the end. Good for headlines.
 * @param {number} t - Progress 0..1
 * @returns {number} Eased 0..1
 */
export function easeOutBounce(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Clamp a number into [min, max].
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Fill the entire canvas with a solid color.
 */
export function fillBackground(ctx, color, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/gif-pipeline/presets/_shared.js
git commit -m "feat(gif-pipeline): add shared preset utilities (easing, helpers)"
```

---

### Task 1.4: Implement the `bounce_headline` preset

**Files:**
- Create: `packages/core/gif-pipeline/presets/bounce_headline.js`

- [ ] **Step 1: Create the preset file**

Create `packages/core/gif-pipeline/presets/bounce_headline.js`:

```js
// packages/core/gif-pipeline/presets/bounce_headline.js
// Headline with elastic bounce entrance, hold, then slight settle.
//
// Timeline (normalized 0..1):
//   0.00 - 0.40  →  entrance (bounce from above)
//   0.40 - 0.85  →  hold (fully visible)
//   0.85 - 1.00  →  optional fade of subtitle (if present)

import { easeOutBounce, fillBackground, clamp } from './_shared.js';

export const metadata = {
  name: 'bounce_headline',
  description: 'Large headline text with elastic bounce entrance — ideal for sales, discounts, announcements',
  required_params: ['text'],
  optional_params: ['subtitle', 'bg_color', 'text_color', 'subtitle_color'],
  default_params: {
    bg_color: '#0A0A0A',
    text_color: '#FFD700',
    subtitle_color: '#FFFFFF',
    duration_ms: 2500,
  },
  default_size: { width: 600, height: 315 },
};

/**
 * Render a single frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} frameIndex - 0-based current frame
 * @param {number} totalFrames - Total frames in the animation
 * @param {object} params - Merged params (user + defaults)
 * @param {object} size - { width, height }
 */
export function render(ctx, frameIndex, totalFrames, params, size) {
  const { width, height } = size;
  const t = frameIndex / Math.max(1, totalFrames - 1); // 0..1

  fillBackground(ctx, params.bg_color, width, height);

  // Headline position: bounces in from y = -headline height to y = center.
  const headlineFontSize = Math.round(height * 0.28);
  ctx.font = `bold ${headlineFontSize}px Inter`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = params.text_color;

  const entranceEnd = 0.4;
  let headlineY;
  if (t < entranceEnd) {
    const progress = t / entranceEnd; // 0..1
    const eased = easeOutBounce(progress);
    const startY = -headlineFontSize;
    const endY = height / 2 - (params.subtitle ? headlineFontSize * 0.25 : 0);
    headlineY = startY + (endY - startY) * eased;
  } else {
    headlineY = height / 2 - (params.subtitle ? headlineFontSize * 0.25 : 0);
  }

  ctx.fillText(params.text, width / 2, headlineY);

  // Subtitle fades in during hold phase
  if (params.subtitle) {
    const subtitleFontSize = Math.round(height * 0.1);
    ctx.font = `bold ${subtitleFontSize}px Inter`;
    ctx.fillStyle = params.subtitle_color;

    const fadeStart = 0.45;
    const fadeEnd = 0.65;
    let alpha = 0;
    if (t >= fadeStart) {
      alpha = clamp((t - fadeStart) / (fadeEnd - fadeStart), 0, 1);
    }
    ctx.globalAlpha = alpha;
    ctx.fillText(params.subtitle, width / 2, height / 2 + headlineFontSize * 0.6);
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/gif-pipeline/presets/bounce_headline.js
git commit -m "feat(gif-pipeline): implement bounce_headline typographic preset"
```

---

### Task 1.5: Create presets index with catalog

**Files:**
- Create: `packages/core/gif-pipeline/presets/index.js`

- [ ] **Step 1: Create the index**

Create `packages/core/gif-pipeline/presets/index.js`:

```js
// packages/core/gif-pipeline/presets/index.js
// Central registry of all typographic presets.

import * as bounceHeadline from './bounce_headline.js';

const PRESETS = {
  bounce_headline: bounceHeadline,
  // Additional presets (countdown_flip, typewriter_reveal, slide_stack,
  // glow_badge, ticker_scroll) will be added in later tasks/plans.
};

export function getPreset(name) {
  return PRESETS[name] || null;
}

export function listPresets() {
  return Object.keys(PRESETS);
}

/**
 * Returns a text catalog suitable for inclusion in a Claude system prompt.
 * Each preset is described with its name, description, and params.
 */
export function getPresetCatalog() {
  return Object.entries(PRESETS)
    .map(([name, mod]) => {
      const meta = mod.metadata;
      return [
        `### ${name}`,
        meta.description,
        `Required params: ${meta.required_params.join(', ') || '(none)'}`,
        `Optional params: ${meta.optional_params.join(', ') || '(none)'}`,
      ].join('\n');
    })
    .join('\n\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/gif-pipeline/presets/index.js
git commit -m "feat(gif-pipeline): add presets registry and catalog helper"
```

---

### Task 1.6: Write unit tests for the encoder

**Files:**
- Create: `packages/core/gif-pipeline/encoder.test.js`

There is no existing test framework in the project. We use a minimal inline test harness that can be run directly with `node`. This matches the "no unnecessary dependencies" project rule.

- [ ] **Step 1: Write the encoder test**

Create `packages/core/gif-pipeline/encoder.test.js`:

```js
// packages/core/gif-pipeline/encoder.test.js
// Run with: node packages/core/gif-pipeline/encoder.test.js

import { encodeFrames } from './encoder.js';
import assert from 'node:assert/strict';

function makeSolidFrame(width, height, r, g, b) {
  const buf = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
  }
  return buf;
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('encoder.test.js');

test('encodes a single red frame', () => {
  const frame = makeSolidFrame(10, 10, 255, 0, 0);
  const gif = encodeFrames([frame], 10, 10, { frameDelay: 100 });
  assert.ok(gif instanceof Uint8Array, 'returns Uint8Array');
  assert.ok(gif.length > 20, 'gif has nonzero length');
  // GIF files start with "GIF89a" or "GIF87a"
  const header = String.fromCharCode(...gif.slice(0, 6));
  assert.ok(header === 'GIF89a' || header === 'GIF87a', `invalid GIF header: ${header}`);
});

test('encodes multi-frame animation', () => {
  const frames = [
    makeSolidFrame(10, 10, 255, 0, 0),
    makeSolidFrame(10, 10, 0, 255, 0),
    makeSolidFrame(10, 10, 0, 0, 255),
  ];
  const gif = encodeFrames(frames, 10, 10, { frameDelay: 100 });
  assert.ok(gif.length > 50, 'multi-frame gif has nonzero length');
});

test('rejects empty frames array', () => {
  assert.throws(() => encodeFrames([], 10, 10, { frameDelay: 100 }), /empty/);
});

test('per-frame palette mode works', () => {
  const frames = [
    makeSolidFrame(10, 10, 255, 0, 0),
    makeSolidFrame(10, 10, 0, 255, 0),
  ];
  const gif = encodeFrames(frames, 10, 10, { frameDelay: 100, paletteMode: 'per-frame' });
  assert.ok(gif.length > 50);
});
```

- [ ] **Step 2: Run the test**

```bash
node packages/core/gif-pipeline/encoder.test.js
```

Expected output:
```
encoder.test.js
  ✓ encodes a single red frame
  ✓ encodes multi-frame animation
  ✓ rejects empty frames array
  ✓ per-frame palette mode works
```

All four must pass. If any fail, fix the encoder before proceeding.

- [ ] **Step 3: Commit**

```bash
git add packages/core/gif-pipeline/encoder.test.js
git commit -m "test(gif-pipeline): add encoder unit tests"
```

---

### Task 1.7: Write a smoke test for the bounce_headline preset

**Files:**
- Create: `packages/core/gif-pipeline/presets/bounce_headline.test.js`

- [ ] **Step 1: Write the test**

Create `packages/core/gif-pipeline/presets/bounce_headline.test.js`:

```js
// packages/core/gif-pipeline/presets/bounce_headline.test.js
// Run with: node packages/core/gif-pipeline/presets/bounce_headline.test.js

import { createCanvas } from '@napi-rs/canvas';
import { ensureFontsRegistered } from '../fonts.js';
import * as preset from './bounce_headline.js';
import { encodeFrames } from '../encoder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureFontsRegistered();

console.log('bounce_headline.test.js');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

test('metadata is well-formed', () => {
  assert.equal(preset.metadata.name, 'bounce_headline');
  assert.ok(preset.metadata.required_params.includes('text'));
  assert.ok(preset.metadata.default_params.bg_color);
});

test('render produces a non-blank frame at middle of animation', () => {
  const size = preset.metadata.default_size;
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  const params = {
    ...preset.metadata.default_params,
    text: '50% OFF',
    subtitle: 'TEST',
  };
  preset.render(ctx, 30, 60, params, size);
  const imageData = ctx.getImageData(0, 0, size.width, size.height);
  // Check that at least some pixels are the text color (not all background)
  let textPixels = 0;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Text color is #FFD700 → R=255, G=215, B=0
    if (data[i] > 200 && data[i + 1] > 180 && data[i + 2] < 50) {
      textPixels++;
    }
  }
  assert.ok(textPixels > 100, `expected text pixels, got ${textPixels}`);
});

test('end-to-end: render all frames + encode to GIF file', () => {
  const size = preset.metadata.default_size;
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  const params = {
    ...preset.metadata.default_params,
    text: '50% OFF',
    subtitle: 'ENDS TONIGHT',
  };
  const fps = 24;
  const durationMs = 2500;
  const totalFrames = Math.round((durationMs / 1000) * fps);
  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    preset.render(ctx, i, totalFrames, params, size);
    const rgba = new Uint8ClampedArray(
      ctx.getImageData(0, 0, size.width, size.height).data
    );
    frames.push(rgba);
  }
  const gif = encodeFrames(frames, size.width, size.height, {
    frameDelay: Math.round(1000 / fps),
    paletteMode: 'global',
  });
  assert.ok(gif.length > 1000, `gif too small: ${gif.length} bytes`);

  // Write to disk for manual inspection
  const outPath = path.join(__dirname, '_smoke_output.gif');
  fs.writeFileSync(outPath, Buffer.from(gif));
  console.log(`    wrote ${outPath} (${gif.length} bytes)`);
});
```

- [ ] **Step 2: Run the test**

```bash
node packages/core/gif-pipeline/presets/bounce_headline.test.js
```

Expected output:
```
bounce_headline.test.js
  ✓ metadata is well-formed
  ✓ render produces a non-blank frame at middle of animation
  ✓ end-to-end: render all frames + encode to GIF file
    wrote .../packages/core/gif-pipeline/presets/_smoke_output.gif (NNNN bytes)
```

The file size should be 10KB-200KB range.

- [ ] **Step 3: Manually inspect the generated GIF**

Open `packages/core/gif-pipeline/presets/_smoke_output.gif` in any image viewer or browser. You should see "50% OFF" bouncing in from the top of a dark background, with "ENDS TONIGHT" fading in below.

If the animation looks wrong (text not visible, never bounces, never stops), debug the preset render function before proceeding.

- [ ] **Step 4: Clean up the smoke output and add to gitignore**

```bash
rm packages/core/gif-pipeline/presets/_smoke_output.gif
```

Append to `.gitignore`:
```
packages/core/gif-pipeline/**/_smoke_output.gif
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/gif-pipeline/presets/bounce_headline.test.js .gitignore
git commit -m "test(gif-pipeline): add bounce_headline preset smoke test"
```

---

### Task 1.8: Implement the typographic pipeline (Claude planning + render + encode + persist)

**Files:**
- Create: `packages/core/gif-pipeline/typographic.js`

- [ ] **Step 1: Create the pipeline module**

Create `packages/core/gif-pipeline/typographic.js`:

```js
// packages/core/gif-pipeline/typographic.js
// Mode C — Typographic pipeline.
// Steps: planning (Claude picks a preset + fills params) → rendering (canvas
// draws each frame) → encoding (gifenc) → persisting (disk + DB row) → done.

import { createCanvas } from '@napi-rs/canvas';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { ensureFontsRegistered } from './fonts.js';
import { getPreset, getPresetCatalog, listPresets } from './presets/index.js';
import { encodeFrames } from './encoder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Directory where finished GIFs live. Must match the static-serve path in server.js.
// Since this module lives in packages/core, we compute the absolute disk path
// relative to the repo root → apps/dashboard/public/generated-gifs.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'apps', 'dashboard', 'public', 'generated-gifs');

const DEFAULT_FPS = 24;
const DEFAULT_DURATION_MS = 2500;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 315;

/**
 * Run the typographic pipeline.
 *
 * @param {string} prompt
 * @param {object} options - { width, height, duration_ms, fps, preset_override }
 * @param {(event: object) => void} emit
 * @param {{ userId: number, pool: import('pg').Pool }} ctx
 * @returns {Promise<{ gifId: number, filePath: string }>}
 */
export async function runTypographicPipeline(prompt, options, emit, ctx) {
  ensureFontsRegistered();

  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const fps = options.fps || DEFAULT_FPS;

  // ─── 1. Planning ───────────────────────────────────────────────────────
  emit({ step: 'planning', text: 'Choosing preset and filling params...' });

  let plan;
  if (options.preset_override) {
    // Skip Claude if caller pre-specified a preset (useful for tests and
    // direct invocation from Content Studio in later phases).
    const presetMod = getPreset(options.preset_override);
    if (!presetMod) throw new Error(`Unknown preset override: ${options.preset_override}`);
    plan = {
      preset: options.preset_override,
      params: { ...presetMod.metadata.default_params, text: prompt },
      rationale: 'preset_override supplied',
    };
  } else {
    plan = await planWithClaude(prompt);
  }

  emit({ step: 'plan_ready', preset: plan.preset, params: plan.params, rationale: plan.rationale });

  const presetMod = getPreset(plan.preset);
  if (!presetMod) {
    throw new Error(`Claude chose unknown preset: ${plan.preset}. Available: ${listPresets().join(', ')}`);
  }

  // Merge defaults with Claude's params
  const mergedParams = { ...presetMod.metadata.default_params, ...plan.params };
  const durationMs = mergedParams.duration_ms || DEFAULT_DURATION_MS;
  const totalFrames = Math.max(2, Math.round((durationMs / 1000) * fps));
  const frameDelay = Math.round(1000 / fps);

  // ─── 2. Rendering ──────────────────────────────────────────────────────
  emit({ step: 'rendering', progress: 0 });

  const canvas = createCanvas(width, height);
  const ctx2d = canvas.getContext('2d');
  const size = { width, height };
  const frames = [];
  const progressTick = Math.max(1, Math.floor(totalFrames / 4));

  for (let i = 0; i < totalFrames; i++) {
    presetMod.render(ctx2d, i, totalFrames, mergedParams, size);
    const imageData = ctx2d.getImageData(0, 0, width, height);
    // Copy the pixel buffer because getImageData returns a view that gets
    // overwritten on the next render call.
    frames.push(new Uint8ClampedArray(imageData.data));

    if (i > 0 && i % progressTick === 0) {
      emit({ step: 'rendering', progress: i / totalFrames });
    }
  }

  // ─── 3. Encoding ───────────────────────────────────────────────────────
  emit({ step: 'encoding' });
  const gifBytes = encodeFrames(frames, width, height, {
    frameDelay,
    paletteMode: 'global',
    maxColors: 256,
  });

  // ─── 4. Persisting ─────────────────────────────────────────────────────
  emit({ step: 'persisting' });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const uuid = crypto.randomUUID();
  const fileName = `gif-${uuid}.gif`;
  const thumbName = `gif-${uuid}-thumb.png`;
  const diskPath = path.join(OUTPUT_DIR, fileName);
  const thumbDiskPath = path.join(OUTPUT_DIR, thumbName);

  fs.writeFileSync(diskPath, Buffer.from(gifBytes));

  // Thumbnail = the first rendered frame as a PNG, for the gallery view
  const thumbCanvas = createCanvas(width, height);
  const thumbCtx = thumbCanvas.getContext('2d');
  presetMod.render(thumbCtx, 0, totalFrames, mergedParams, size);
  const pngBuffer = thumbCanvas.toBuffer('image/png');
  fs.writeFileSync(thumbDiskPath, pngBuffer);

  const publicPath = `/generated-gifs/${fileName}`;
  const publicThumbPath = `/generated-gifs/${thumbName}`;

  const { rows } = await ctx.pool.query(
    `INSERT INTO generated_gifs
       (mode, prompt, plan, file_path, thumbnail_path, width, height,
        duration_ms, frame_count, file_size_bytes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      'typographic',
      prompt,
      JSON.stringify(plan),
      publicPath,
      publicThumbPath,
      width,
      height,
      durationMs,
      totalFrames,
      gifBytes.length,
      ctx.userId || null,
    ]
  );
  const gifId = rows[0].id;

  // ─── 5. Done ───────────────────────────────────────────────────────────
  emit({
    step: 'done',
    gif_url: publicPath,
    thumbnail_url: publicThumbPath,
    meta: {
      gif_id: gifId,
      mode: 'typographic',
      width,
      height,
      duration_ms: durationMs,
      frame_count: totalFrames,
      file_size_bytes: gifBytes.length,
    },
  });

  return { gifId, filePath: publicPath };
}

// ─── Claude planning ──────────────────────────────────────────────────────

async function planWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No Claude available — fall back to bounce_headline with prompt as text
    return {
      preset: 'bounce_headline',
      params: { text: prompt.slice(0, 40) },
      rationale: 'Fallback: no ANTHROPIC_API_KEY set, using bounce_headline',
    };
  }

  const client = new Anthropic({ apiKey });
  const catalog = getPresetCatalog();

  const systemPrompt =
    `You are a motion-graphics director picking a typographic animation preset for an email banner GIF.\n\n` +
    `Available presets:\n\n${catalog}\n\n` +
    `Given the user's prompt, choose ONE preset and fill its params. ` +
    `Return STRICT JSON only — no markdown, no prose. Shape:\n` +
    `{\n  "preset": "preset_name",\n  "params": { "text": "...", ... },\n  "rationale": "one sentence why"\n}\n\n` +
    `Rules:\n` +
    `- preset MUST be one of: ${listPresets().join(', ')}\n` +
    `- text should be short and punchy (max ~20 chars for headline, max ~15 for subtitle)\n` +
    `- omit optional params if defaults are fine\n` +
    `- JSON ONLY. No code fences.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  // Strip possible code fences just in case
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.preset || !parsed.params) {
      throw new Error('missing required fields');
    }
    if (!listPresets().includes(parsed.preset)) {
      console.warn(`[typographic] Claude chose unknown preset "${parsed.preset}", falling back`);
      return {
        preset: 'bounce_headline',
        params: { text: prompt.slice(0, 40) },
        rationale: `Claude chose unknown preset ${parsed.preset}, using fallback`,
      };
    }
    return parsed;
  } catch (err) {
    console.warn('[typographic] Failed to parse Claude JSON, using fallback:', err.message);
    console.warn('[typographic] Raw Claude response:', text);
    return {
      preset: 'bounce_headline',
      params: { text: prompt.slice(0, 40) },
      rationale: `Fallback: Claude JSON parse failed (${err.message})`,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/gif-pipeline/typographic.js
git commit -m "feat(gif-pipeline): implement typographic pipeline with Claude planning"
```

---

### Task 1.9: Write an end-to-end smoke test for the typographic pipeline

**Files:**
- Create: `packages/core/gif-pipeline/typographic.test.js`

- [ ] **Step 1: Write the test**

Create `packages/core/gif-pipeline/typographic.test.js`:

```js
// packages/core/gif-pipeline/typographic.test.js
// Run with: node packages/core/gif-pipeline/typographic.test.js
//
// Requires a running DB (npm run db:up) because the pipeline persists to
// generated_gifs. Uses preset_override so it does NOT require ANTHROPIC_API_KEY.

import { runTypographicPipeline } from './typographic.js';
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5434),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB || 'agentos',
});

async function main() {
  console.log('typographic.test.js');
  const events = [];
  const emit = (e) => events.push(e);

  let result;
  try {
    result = await runTypographicPipeline(
      'Test: 30% OFF ends tonight',
      { preset_override: 'bounce_headline' },
      emit,
      { userId: null, pool }
    );
  } catch (err) {
    console.error('  ✗ pipeline threw:', err.stack || err.message);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  // Verify event sequence
  const stepOrder = events.map((e) => e.step);
  console.log('  events:', stepOrder.join(' → '));
  assert.ok(stepOrder[0] === 'planning', `first event should be planning, got ${stepOrder[0]}`);
  assert.ok(stepOrder.includes('plan_ready'), 'missing plan_ready event');
  assert.ok(stepOrder.includes('rendering'), 'missing rendering event');
  assert.ok(stepOrder.includes('encoding'), 'missing encoding event');
  assert.ok(stepOrder.includes('persisting'), 'missing persisting event');
  assert.ok(stepOrder[stepOrder.length - 1] === 'done', `last event should be done, got ${stepOrder[stepOrder.length - 1]}`);
  console.log('  ✓ event sequence correct');

  // Verify file exists
  const filePath = path.resolve(__dirname, '..', '..', '..', 'apps', 'dashboard', 'public', result.filePath.replace(/^\//, ''));
  assert.ok(fs.existsSync(filePath), `gif file not found at ${filePath}`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1000, `gif too small: ${stat.size} bytes`);
  console.log(`  ✓ gif file written (${stat.size} bytes)`);

  // Verify DB row
  const { rows } = await pool.query(
    `SELECT id, mode, width, height, frame_count FROM generated_gifs WHERE id = $1`,
    [result.gifId]
  );
  assert.equal(rows.length, 1, 'DB row not found');
  assert.equal(rows[0].mode, 'typographic');
  assert.equal(rows[0].width, 600);
  assert.equal(rows[0].height, 315);
  assert.ok(rows[0].frame_count > 30, `expected >30 frames, got ${rows[0].frame_count}`);
  console.log(`  ✓ DB row created (id=${result.gifId}, frames=${rows[0].frame_count})`);

  // Cleanup: delete the test row and file
  await pool.query(`DELETE FROM generated_gifs WHERE id = $1`, [result.gifId]);
  try { fs.unlinkSync(filePath); } catch (_) {}
  const thumbPath = filePath.replace('.gif', '-thumb.png');
  try { fs.unlinkSync(thumbPath); } catch (_) {}

  await pool.end();
  console.log('  ✓ cleanup complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Make sure the DB is running**

```bash
npm run db:up
```

Wait 3 seconds for postgres to be ready.

- [ ] **Step 3: Run the test**

```bash
node packages/core/gif-pipeline/typographic.test.js
```

Expected output:
```
typographic.test.js
  events: planning → plan_ready → rendering → rendering → ... → encoding → persisting → done
  ✓ event sequence correct
  ✓ gif file written (NNNN bytes)
  ✓ DB row created (id=N, frames=60)
  ✓ cleanup complete
```

If any assertion fails, fix the pipeline before proceeding.

- [ ] **Step 4: Commit**

```bash
git add packages/core/gif-pipeline/typographic.test.js
git commit -m "test(gif-pipeline): add end-to-end typographic pipeline test"
```

---

### Task 1.10: Manual end-to-end test through the UI

This is the integration checkpoint. The frontend, the server, the pipeline, and the DB all talk to each other.

**Files:** none — manual verification

- [ ] **Step 1: Start the full stack**

```bash
npm run kill-ports
npm start &
```

Wait ~5 seconds for Vite + Express to be ready.

- [ ] **Step 2: Login and navigate to Image Studio**

Open `http://localhost:4000` in a browser. Login if needed. Click the new **Image Studio** entry in the sidebar, or navigate to `http://localhost:4000/app/image-studio`.

Verify:
- Page header says "Image Studio"
- Three tabs visible: Typographic (active), Slideshow, Video (Veo)
- Center preview shows empty state
- Right timeline shows all steps as pending (○)

- [ ] **Step 3: Submit a prompt**

Make sure the **Typographic** tab is active. Type in the chat input:

```
50% off summer sale, ends tonight
```

Click **Generate** (or press Enter).

Expected observations:
- Chat shows your prompt as a user message
- Chat then shows event messages: `planning`, `plan_ready`, `rendering` (possibly multiple progress ticks), `encoding`, `persisting`, `done`
- Right timeline marks each step as active (pulsing) then done (✓) as they complete
- Center preview changes from empty state to spinner during progress
- Final preview shows the rendered GIF animating "50% OFF" with bouncing entrance
- Metadata under the GIF shows frames, duration, dimensions, size

- [ ] **Step 4: Verify the GIF was written to disk**

```bash
ls -la apps/dashboard/public/generated-gifs/
```

Expected: at least one `gif-<uuid>.gif` and matching `gif-<uuid>-thumb.png`.

- [ ] **Step 5: Verify the DB row**

```bash
docker exec -i agentos-postgres-1 psql -U postgres -d agentos -c "SELECT id, mode, prompt, width, height, frame_count FROM generated_gifs ORDER BY id DESC LIMIT 3;"
```

Expected: at least one row with `mode = typographic`, your prompt, 600×315, ~60 frames.

- [ ] **Step 6: Test the download button**

Click **Download** under the preview. A `.gif` file should download. Open it in an image viewer — it should animate.

- [ ] **Step 7: Test the gallery endpoint**

In the browser devtools console or via curl (needs session cookie):

```bash
curl -s http://localhost:3001/api/gif-pipeline/gallery --cookie "connect.sid=YOUR_COOKIE" | head -c 500
```

Or simply verify in the browser devtools Network tab that if you reload the page and call the gallery endpoint manually, it returns JSON with your GIFs.

- [ ] **Step 8: Stop the stack**

```bash
npm run kill-ports
```

- [ ] **Step 9: Commit a placeholder note if anything needed fixing during manual testing**

If everything worked, no commit is needed — you validated existing committed code. If you had to tweak something to make it work, commit the fix:

```bash
git add <files>
git commit -m "fix(gif-pipeline): <what was wrong>"
```

---

### Task 1.11: Guard against static-serve path confusion and document operational notes

**Files:**
- Modify: `docs/superpowers/specs/2026-04-08-gif-pipeline-image-studio-design.md` (append operational note)

This is a small safety net. The pipeline writes to `apps/dashboard/public/generated-gifs/` (disk path computed via `path.resolve(__dirname, ...)`) and serves them from `/generated-gifs/` (Express static). If someone moves `packages/core/` relative to `apps/dashboard/`, the disk path computation breaks.

- [ ] **Step 1: Add an operational note at the end of the spec**

Append to `docs/superpowers/specs/2026-04-08-gif-pipeline-image-studio-design.md`:

```markdown

---

## Operational Notes (added during Phase 1 implementation)

### Disk path coupling between packages/core and apps/dashboard

`packages/core/gif-pipeline/typographic.js` writes GIF files to
`apps/dashboard/public/generated-gifs/` via a relative path computed from
`__dirname`. If the repo layout changes (e.g. packages/core moved, apps/dashboard
renamed), update the `REPO_ROOT` / `OUTPUT_DIR` constants in typographic.js.

The public URL path `/generated-gifs/` is served by Express from
`apps/dashboard/public/generated-gifs/` — these must match.

### Test runner

Tests in `packages/core/gif-pipeline/*.test.js` are plain Node scripts (no test
framework) and are run directly with `node path/to/test.js`. The `typographic.test.js`
end-to-end test requires `npm run db:up` first.

### Phase 0 + 1 delivered

- `generated_gifs` table
- `POST /api/gif-pipeline/generate` SSE endpoint
- `GET /api/gif-pipeline/gallery`
- `DELETE /api/gif-pipeline/gif/:id`
- `/app/image-studio` React page with three-column layout
- Mode C (Typographic) with `bounce_headline` preset + Claude planning + fallback
- gifenc encoder + `@napi-rs/canvas` rendering + Inter Bold bundled font
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-08-gif-pipeline-image-studio-design.md
git commit -m "docs(gif-pipeline): add phase 0+1 operational notes to spec"
```

---

## Done Criteria

Phase 0 + Phase 1 is considered complete when ALL of the following are true:

1. `node packages/core/gif-pipeline/encoder.test.js` passes (4 tests).
2. `node packages/core/gif-pipeline/presets/bounce_headline.test.js` passes (3 tests).
3. `node packages/core/gif-pipeline/typographic.test.js` passes (pipeline + DB integration).
4. `npm start` brings the full stack up without errors.
5. Navigating to `/app/image-studio` loads the page and renders the three columns.
6. Submitting a prompt in the Typographic tab:
   - Streams SSE events visible in the chat
   - Timeline progresses through planning → plan_ready → rendering → encoding → persisting → done
   - Final GIF is displayed and animates correctly
   - Metadata shows correct frame count, dimensions, size
7. A row exists in `generated_gifs` with the correct mode, dimensions, and frame count.
8. The GIF file exists on disk at `apps/dashboard/public/generated-gifs/gif-<uuid>.gif`.
9. All commits are pushed-ready (not on a worktree branch that hasn't been merged).

---

## Explicitly Out of Scope (for this plan)

These are covered in the parent spec but deferred to later plans:

- Mode A (Slideshow) with Imagen + transitions
- Mode B (Veo) with video-to-GIF transcoding
- Additional presets beyond `bounce_headline` (countdown_flip, typewriter_reveal, slide_stack, glow_badge, ticker_scroll)
- `GifGalleryModal` component (gallery endpoint exists, modal UI not yet)
- "Send to Email Studio" action (placeholder button in preview, no wiring yet)
- Content Studio intent detection + `GifIntentSuggestion` mini-panel
- Additional fonts (Playfair Display, JetBrains Mono)
- `video-provider.js` abstraction (Mode B only)
- SSE rendering of frame thumbnails as they arrive (Mode A only)
- User-facing error recovery UI (retry individual failed steps)
