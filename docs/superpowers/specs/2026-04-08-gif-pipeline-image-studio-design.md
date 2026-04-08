# GIF Pipeline & Image Studio — Design Spec

**Date:** 2026-04-08
**Author:** Brainstorming session (Claude + Guillermo)
**Status:** Design approved, pending spec review

---

## Purpose

Build a multi-mode GIF generation pipeline as a **technical showcase of agent workflows** inside AgentOS, with real, usable output that integrates with Content Studio and Email Studio. Users see the agent plan, execute step-by-step via SSE progress events, and obtain a real GIF asset they can drop into their emails.

Three generation modes, one unified endpoint, one new page (**Image Studio**), shared encoder and UI.

---

## Goals

1. **Showcase agent orchestration** — the user must visually experience the agent planning, executing, and assembling. This is the primary demo value.
2. **Produce usable assets** — output GIFs must be droppable into real email flows (Content Studio / Email Studio image slots).
3. **Three modes, one architecture** — slideshow (Imagen + composition), typographic (canvas presets), video (Veo + ffmpeg-wasm transcoding). Swappable via a single `mode` parameter.
4. **No runtime regressions** — respect the "100% standalone" project rule: no native binaries, no ffmpeg system install, all pure JS / WASM dependencies.
5. **Phased delivery** — each mode ships as an independent PR. Image Studio works end-to-end after phase 1 with a single mode, and grows incrementally.

## Non-goals

- Video editing, trimming, or multi-clip sequencing.
- Generating MP4/WebM output (GIF only for MVP).
- Dynamic variables in typographic presets (`{{first_name}}` placeholders) — deferred to phase 2.
- Recovery of timed-out Veo operations — deferred to phase 2.
- Preserving the intermediate MP4 from Veo — deleted after transcoding.
- Paid-tier cost gating / quota enforcement.

---

## Architecture Overview

### Single endpoint, three strategies

```
POST /api/gif-pipeline/generate   (Server-Sent Events)
  body: { mode: 'slideshow' | 'typographic' | 'veo', prompt, options? }

  stream emits:
    data: { step: 'planning', text: 'Analyzing prompt...' }\n\n
    data: { step: 'plan_ready', ...mode-specific fields }\n\n
    data: { step: <mode-specific progress events> }\n\n
    data: { step: 'done', gif_url, thumbnail_url, meta: {...} }\n\n
    data: [DONE]\n\n
```

A single endpoint keeps the frontend identical across modes: same preview component, same chat stream renderer, same translation keys. Differentiation lives in three pure backend functions:

```
packages/core/gif-pipeline/
  index.js               # runPipeline(mode, prompt, options, emit)
  slideshow.js           # Mode A
  typographic.js         # Mode C
  veo.js                 # Mode B
  video-provider.js      # Abstraction: Veo / Runway / Pika
  transitions.js         # cut, fade, kenburns (Mode A)
  encoder.js             # gifenc wrapper
  presets/
    index.js
    bounce_headline.js
    countdown_flip.js
    typewriter_reveal.js
    slide_stack.js
    glow_badge.js
    ticker_scroll.js
  fonts/
    Inter.ttf
    PlayfairDisplay.ttf
    JetBrainsMono.ttf
```

### Data flow

```
User prompt
    ↓
[Image Studio UI] ──SSE──▶ POST /api/gif-pipeline/generate
                                    ↓
                          router(mode) → pipeline.run()
                                    ↓
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      slideshow.js           typographic.js           veo.js
      (Imagen × N)           (canvas + presets)       (Veo API async)
              ↓                     ↓                     ▼
              └──── gifenc encode ──┘           ffmpeg-wasm mp4→gif
                                    ↓                     │
                            generated-gifs/*.gif ◀────────┘
                                    ↓
                          INSERT generated_gifs
                                    ↓
                       SSE emit { step: 'done', url }
```

### Dependencies

| Package | Size | When loaded | Used by |
|---|---|---|---|
| `gifenc` | ~8KB | Always | Modes A + C (encoding) |
| `@napi-rs/canvas` | ~5MB | Always | Mode C (rendering) |
| `sharp` | ~10MB | Always (new dependency, verified not installed as of 2026-04-08) | Mode A (resize, composite) |
| `@ffmpeg/ffmpeg` + `@ffmpeg/util` | ~25MB | **Dynamic import, Mode B only** | Mode B (mp4→gif transcoding) |

Dynamic import of ffmpeg-wasm means the server does not pay the 25MB cost at startup unless Mode B actually runs. Respects "100% standalone" rule — no native ffmpeg binary required.

### Persistence

- **Files:** `apps/dashboard/public/generated-gifs/gif-{uuid}.gif` and `gif-{uuid}-thumb.png`
- **DB:** single new table `generated_gifs`

```sql
CREATE TABLE IF NOT EXISTS generated_gifs (
  id              SERIAL PRIMARY KEY,
  mode            TEXT NOT NULL CHECK (mode IN ('slideshow', 'typographic', 'veo')),
  prompt          TEXT NOT NULL,
  plan            JSONB,                              -- agent-generated plan (for debug/re-run)
  file_path       TEXT NOT NULL,                      -- /generated-gifs/gif-xxx.gif
  thumbnail_path  TEXT,                               -- /generated-gifs/gif-xxx-thumb.png
  width           INT,
  height          INT,
  duration_ms     INT,
  frame_count     INT,
  file_size_bytes INT,
  user_id         INT REFERENCES workspace_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_gifs_user_created
  ON generated_gifs(user_id, created_at DESC);
```

---

## Mode A — Slideshow Pipeline

**Use case:** multi-angle product, before/after, day/night, narrative sequence. Generates N coherent static frames via Imagen, composes transitions, encodes.

### Pipeline steps

1. **`planning`** — Claude (`claude-sonnet-4-6`) decomposes the user prompt into N frame prompts with shared style/seed. Returns strict JSON:
   ```json
   {
     "frames": [{ "index": 1, "prompt": "...", "focal_point": "..." }],
     "style_seed": "cinematic morning light, marble table...",
     "transition_hint": "fade"
   }
   ```
   System prompt: *"You are an art director. Given the user prompt, produce a sequence of N frame prompts for Imagen that maintain consistent style, lighting, and composition, varying only the narrative element indicated."*
   Emits `{ step: 'plan_ready', frames, transition }`.

2. **`frame_generating` (×N, serial)** — loops over frames calling `generateImage(framePrompt, { aspectRatio: '16:9' })` from [`packages/core/ai-providers/gemini.js:216`](../../packages/core/ai-providers/gemini.js). Serial, not parallel, for three reasons: incremental progress UX, Imagen rate limits, per-frame retry on failure. Each frame emits `{ step: 'frame_generated', index, total, preview_url }`.

3. **`composing`** — `sharp` redimensiona a 600×315, aplica la transición elegida. Three transitions in `transitions.js` as pure functions `(frameBuffers, config) → frameBuffers[]`:
   - **`cut`** — frames as-is, 1s hold each (comparisons, before/after).
   - **`fade`** — generates K intermediate frames with opacity blending between each pair.
   - **`kenburns`** — generates K intermediate frames with progressive zoom/pan via `sharp.extract()` viewports.

4. **`encoding`** — `gifenc` with **per-frame palette** (256 colors) for best quality with varied scenes. Trade-off: ~20% larger files, acceptable for hero emails (target <1MB).

5. **`persisting`** — write file, insert DB row, generate thumbnail (first frame as PNG).

6. **`done`** — emit `{ step: 'done', gif_url, thumbnail_url, meta }`.

### Defaults (MVP)

- `frame_count`: 4
- `frame_delay_ms`: 700
- `transition`: auto (Claude decides in plan)
- `size`: 600×315
- `fps`: ~15 (derived from frame_delay)

### Error handling

- **Frame failure** → retry once with same prompt; if retry fails, emit `{ step: 'frame_failed', index, error }`; frontend offers retry-single or skip.
- **Planning returns invalid JSON** → fallback to rule-based decomposition (split prompt into N variants with "from angle 1/2/3/4" suffix).
- **Encoding failure** → emit `{ step: 'error', stage: 'encoding' }`, leave frames accessible as a consolation output.

---

## Mode C — Typographic / Motion Graphics Pipeline

**Use case:** sale banners, countdowns, headline reveals, value-prop stacks, loading badges, marquees. Zero image-generation IA. Agent chooses a preset and fills parameters; canvas renders frame-by-frame programmatically.

### Pipeline steps

1. **`planning`** — Claude receives the user prompt plus a catalog of available presets (each preset's `metadata.description`) in the system prompt. Returns:
   ```json
   {
     "preset": "bounce_headline",
     "params": {
       "text": "50% OFF",
       "subtitle": "ENDS TONIGHT",
       "bg_color": "#0A0A0A",
       "text_color": "#FFD700",
       "font_family": "Inter",
       "duration_ms": 2500,
       "loop": true
     },
     "rationale": "Urgency + discount → bounce_headline maximizes attention"
   }
   ```
   Emits `{ step: 'plan_ready', preset, params }`.

2. **`rendering`** — `@napi-rs/canvas` creates a canvas, loops totalFrames = `Math.round(duration_ms / 1000 * 24)`, calls `preset.render(ctx, i, totalFrames, params)` per frame, captures `getImageData` RGBA buffer. Emits `{ step: 'rendering', progress }` every 25%.

3. **`encoding`** — `gifenc` with **global palette** (not per-frame) because typographic frames have low color variance → 50-150KB files vs 400KB+.

4. **`persisting`** — identical to Mode A.

5. **`done`**.

### Preset catalog (MVP — 6 presets)

Each preset is a pure function `(ctx, frameIndex, totalFrames, params) → void` plus metadata:

| Preset | Effect | Required params | Use case |
|---|---|---|---|
| `bounce_headline` | Text enters with ease-out bounce, holds, exits | text | Sales, discounts |
| `countdown_flip` | DD:HH:MM:SS counter with flip animation | target_date | Urgency, deadlines |
| `typewriter_reveal` | Letter-by-letter reveal + cursor blink | text | Storytelling, CTAs |
| `slide_stack` | 3 lines cascade in from bottom | lines[] | Value props, features |
| `glow_badge` | Circular badge with pulsing glow | text | Notifications, alerts |
| `ticker_scroll` | Horizontal marquee scroll | text | News, announcements |

Preset file shape:
```js
// presets/bounce_headline.js
export function render(ctx, frameIndex, totalFrames, params) { /* ... */ }
export const metadata = {
  name: 'bounce_headline',
  description: 'Headline with elastic bounce',
  required_params: ['text'],
  optional_params: ['subtitle', 'bg_color', 'text_color'],
  default_duration_ms: 2000,
  default_size: { width: 600, height: 315 }
};
```

### Fonts

Bundled in `packages/core/gif-pipeline/fonts/` and registered once at startup via `GlobalFonts.registerFromPath()`:
- **Inter** (sans, default)
- **Playfair Display** (serif, editorial)
- **JetBrains Mono** (mono, countdowns)

~800KB total on disk.

### Defaults (MVP)

- `fps`: 24
- `duration_ms`: 2500 (60 frames)
- `size`: 600×315
- `preset`: chosen by Claude (fallback: `bounce_headline`)
- `palette`: global

### Variables deferred

MVP renders literal text. Users who want "Hola Juan" write "Hola Juan". The `plan.params` is persisted so phase 2 re-rendering per segment is trivial (reuse plan, change `text`, re-render, ~500ms).

### Error handling

- **Invalid preset** (Claude hallucinates) → retry with explicit list of valid presets in message.
- **Missing required param** → fall back to preset default.
- **Canvas render throws** → emit error with preset name for debug.

---

## Mode B — Veo Video-to-GIF Pipeline

**Use case:** real frame-coherent motion (steaming coffee, breaking waves, fabric waving, 360° product rotation). Google Veo generates MP4 async, pipeline polls for completion, transcodes to GIF with ffmpeg-wasm.

### Pipeline steps

1. **`planning`** — Claude acts as Veo prompt engineer. Rewrites the user prompt with Veo best practices (subject + action + camera + lighting + style):
   ```json
   {
     "veo_prompt": "A steaming hot latte in a white ceramic cup on a marble table, soft morning light from the left, steam rising slowly, shallow depth of field, cinematic 4K",
     "duration_seconds": 4,
     "aspect_ratio": "16:9",
     "estimated_cost_usd": 0.48,
     "rationale": "Added camera/light/lens for cinematic feel"
   }
   ```
   Emits `{ step: 'plan_ready', veo_prompt, duration_seconds, estimated_cost_usd }`. **Informative only — `autoConfirm: true` default, pipeline does NOT pause for confirmation.**

2. **`veo_submit`** — POST to Veo API via `video-provider.js` abstraction, obtains `operation.name`. Emits `{ step: 'veo_submitted', operation_name }`.

3. **`veo_polling`** — loop every 5s, calls `operations.get`, emits `{ step: 'veo_polling', elapsed_ms }` every tick (doubles as SSE heartbeat to keep connection alive). Hard timeout: 5 minutes. Break when `status.done === true`.

4. **`downloading`** — fetch the MP4 from the returned URI to `/tmp/veo-{uuid}.mp4`. Emits `{ step: 'downloaded', bytes }`.

5. **`transcoding`** — **dynamic import** `@ffmpeg/ffmpeg`. Two-pass palette pipeline:
   ```
   ffmpeg -i input.mp4 -vf "fps=15,scale=600:-1:flags=lanczos,palettegen=max_colors=128" palette.png
   ffmpeg -i input.mp4 -i palette.png -filter_complex "fps=15,scale=600:-1:flags=lanczos[x];[x][1:v]paletteuse" output.gif
   ```
   ~40% smaller files than single-pass with identical visual quality.

6. **`persisting`** — write final GIF, cleanup MP4 and ffmpeg temp files, `INSERT generated_gifs` with `mode = 'veo'`.

7. **`done`**.

### `video-provider.js` abstraction

Veo availability is limited (may require waitlist or Vertex AI at implementation time). The abstraction exposes:

```js
export interface VideoProvider {
  submit({ prompt, duration_seconds, aspect_ratio }) → Promise<{ operation_name }>;
  pollStatus(operation_name) → Promise<{ done, video_uri?, error? }>;
}
```

Two implementations from day one: `veo.js` (primary) and `runway.js` (fallback). Swap via env var `VIDEO_PROVIDER=veo|runway|pika`. Pipeline code is 95% identical across providers.

### Defaults (MVP)

- `duration_seconds`: 4
- `aspect_ratio`: '16:9'
- `autoConfirm`: true (direct execution, no pause)
- Output GIF: 600px wide, 15 FPS, 128-color palette
- Polling interval: 5s
- Hard timeout: 5 min
- Model: `veo-2.0-generate-001` (update at implementation time to current)

### API key storage

New allowed key in [`workspace_config.api_keys`](../../.claude/rules/security.md): `GOOGLE_VEO_API_KEY` (or reuse `GEMINI_API_KEY` if shared — verify at implementation). AES-256-CBC encrypted, same pattern as other keys.

### Error handling

| Failure | Recovery |
|---|---|
| Veo API key missing | Emit clear error in `planning`, no calls made |
| Veo submit 4xx | Emit error with status, close SSE |
| Veo timeout (>5 min) | Emit `{ step: 'timeout', operation_name }` — operation continues in Google; phase-2 recovery endpoint `POST /api/gif-pipeline/recover/:operation_name` is out of scope for MVP |
| Veo fails mid-polling | Emit error with detail; Google only charges on `done: true`, so user pays nothing |
| MP4 download fails | Retry 2× before error |
| ffmpeg-wasm load fails | Fallback: emit the MP4 URL directly; frontend offers download so user gets something usable |

---

## Image Studio — Page & UI

### Route & navigation

- Route: `/image-studio`
- Sidebar entry in `Layout.jsx` alongside Content Studio / Email Studio / Block Studio
- i18n: ~30 new ES/EN keys in `translations.js`

### Layout — three columns

Same pattern as other studios (reuses [`StudioTopBar`](../../apps/dashboard/src/components/studio/StudioTopBar.jsx), [`StudioChatPanel`](../../apps/dashboard/src/components/studio/StudioChatPanel.jsx)).

```
┌─────────────────────────────────────────────────────────────────┐
│  StudioTopBar: "Image Studio" + mode tabs                       │
│  [ Slideshow ] [ Typographic ] [ Video (Veo) ]     [Gallery]    │
├─────────────────┬──────────────────────────┬────────────────────┤
│  Chat Panel     │   Live Preview           │   Pipeline Steps   │
│  (SSE progress) │   (GIF + frames)         │   (timeline)       │
│                 │                          │                    │
│  User prompt    │   ┌──────────────────┐   │   ● planning       │
│  Agent thinks   │   │    [GIF here]    │   │   ● frame 1/4      │
│  Frame events   │   └──────────────────┘   │   ● frame 2/4      │
│  Done + save    │   Frame thumbs: □ □ □ □  │   ○ frame 3/4      │
│                 │   [Save] [Send→Email]    │   ○ encoding       │
│                 │   [Download]             │   ○ done           │
└─────────────────┴──────────────────────────┴────────────────────┘
```

### New components

| Component | Purpose |
|---|---|
| `ImageStudioPage.jsx` | Top-level page, 3-column layout, tab state |
| `GifPipelinePreview.jsx` | Center column: shows frames arriving during pipeline, GIF final at end, metadata (dimensions, file size, frames, duration), actions (Save, Send to Email Studio, Download) |
| `PipelineStepsTimeline.jsx` | Right column: vertical list of pipeline steps per active mode, states (`pending` ○ / `active` pulsing ● / `done` ✓ / `failed` ✗), timestamps per transition, accumulated cost for Veo |
| `GifGalleryModal.jsx` | Modal opened via Gallery button: grid of thumbnails from `generated_gifs` (ordered DESC by created_at), click shows detail with reuse/delete/send actions |
| `GifIntentSuggestion.jsx` | Mini inline panel shown in Content Studio chat when GIF intent detected: 3 mode buttons + "Open in Image Studio" button |

### Extended components

| Component | Change |
|---|---|
| `StudioChatPanel.jsx` | Render new SSE event types (`frame_generated`, `veo_polling`, `plan_ready`) as visual chat messages with embedded thumbnails and progress bars |
| `ImageSlotsManager.jsx` | Detect URLs ending in `.gif`, render via `<img>` (browsers animate natively), treat identically to PNG slots downstream |
| `Layout.jsx` | New sidebar entry for Image Studio |
| `translations.js` | ~30 new keys ES/EN |
| App router | New route `/image-studio` |

### Tab behavior

Three mode tabs (Slideshow / Typographic / Veo). Switching tabs **preserves each tab's chat history in component memory** so the user can compare the same prompt across modes without losing context. This is explicitly how the user evaluates which mode to keep.

---

## Content Studio Integration

### Intent detection

Extend the existing detector in [`server.js:6895`](../../apps/dashboard/server.js) (currently handles `isImageRequest`) with a new `isGifRequest` flag:

```js
const GIF_TRIGGERS = [
  /\bgif\b/i,
  /anim(ated?|ación)/i,
  /hero animado/i,
  /countdown/i,
  /slideshow/i,
  /banner animado/i,
  // additional patterns at implementation
];
const isGifRequest = GIF_TRIGGERS.some(re => re.test(message));
```

### Suggest-don't-execute pattern

When `isGifRequest === true`, Content Studio **does not auto-run the pipeline**. Instead:

1. Server emits SSE event `{ gif_intent_detected: true, suggested_mode: 'slideshow'|'typographic'|'veo', prompt: '...' }`.
2. Frontend Content Studio renders a `GifIntentSuggestion` mini-panel inline in the chat with 3 mode buttons + "Open in Image Studio".
3. If user clicks a mode inline → Content Studio calls `POST /api/gif-pipeline/generate` directly; the result appears as a standard image slot (reuses [`ImageSlotsManager`](../../apps/dashboard/src/components/studio/ImageSlotsManager.jsx) logic).
4. If user clicks "Open in Image Studio" → navigation with query params: `/image-studio?prompt=...&mode=slideshow`, pre-loading the prompt in the target tab.

Rationale: the three modes have very different cost, latency, and style trade-offs. The agent should not decide unilaterally — especially for Mode B where an accidental click costs real money. The agent **suggests** a default based on the detected intent; the user **chooses**.

### GIF as image slot

GIF slot support is a minimal change to `ImageSlotsManager`:
- Detect `.gif` extension on the URL
- Render via standard `<img src={url} />` (HTML animates natively)
- Modern email clients (Gmail, Apple Mail, Outlook 365) support animated GIFs in `<img>` without polyfills

The `generated_gifs.file_path` value is already an Express-servable URL (`/generated-gifs/gif-xxx.gif`), so Email Studio references it directly in generated HTML with zero additional plumbing.

---

## Backend Endpoints

New section in `server.js`: `═══════════ GIF PIPELINE ═══════════`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/gif-pipeline/generate` | SSE stream, body `{ mode, prompt, options }`, emits pipeline events |
| GET  | `/api/gif-pipeline/gallery` | List user's generated GIFs (paginated) |
| DELETE | `/api/gif-pipeline/gif/:id` | Delete a GIF (file + DB row) |

All endpoints protected by existing `requireAuth` middleware. No admin-only endpoints.

### SSE event vocabulary

**Shared:**
- `{ step: 'planning', text }`
- `{ step: 'plan_ready', ...mode-specific fields }`
- `{ step: 'done', gif_url, thumbnail_url, meta: { width, height, duration_ms, frame_count, file_size_bytes, mode, gif_id } }`
- `{ step: 'error', stage, error }`

**Mode A specific:**
- `{ step: 'frame_generating', index, total }`
- `{ step: 'frame_generated', index, total, preview_url }`
- `{ step: 'frame_failed', index, error }`
- `{ step: 'composing' }`
- `{ step: 'encoding' }`

**Mode C specific:**
- `{ step: 'rendering', progress }`
- `{ step: 'encoding' }`

**Mode B specific:**
- `{ step: 'veo_submitted', operation_name }`
- `{ step: 'veo_polling', elapsed_ms }`
- `{ step: 'downloaded', bytes }`
- `{ step: 'transcoding' }`
- `{ step: 'timeout', operation_name }`

---

## Implementation Phases

Each phase is an independent PR that leaves the system in a working state end-to-end.

### Phase 0 — Foundation

- Migration: new `generated_gifs` table in `schema.sql`
- New dependency: `gifenc`, `@napi-rs/canvas`
- Skeleton `POST /api/gif-pipeline/generate` (SSE stub, returns `{ step: 'not_implemented' }`)
- `ImageStudioPage.jsx` with 3-column scaffold but no functional mode
- Sidebar entry, route, i18n base keys
- `packages/core/gif-pipeline/` directory structure (empty files)

**Deliverable:** page loads, chat accepts input, pipeline structure exists, nothing functional yet.

### Phase 1 — Mode C (Typographic)

**Order change from original plan:** C first, then A, then B. Rationale in the "Order Rationale" section below.

- Bundle fonts (Inter, Playfair Display, JetBrains Mono)
- Implement `typographic.js` pipeline
- Implement 6 presets in `presets/`
- Implement `encoder.js` with gifenc (global palette path)
- Wire up full SSE flow: planning → rendering → encoding → persisting → done
- `GifPipelinePreview.jsx` renders final GIF
- `PipelineStepsTimeline.jsx` renders step states
- `StudioChatPanel` renders new SSE events

**Deliverable:** user goes to Image Studio, Typographic tab, writes "50% OFF countdown", gets a real animated GIF in the gallery.

### Phase 2 — Mode A (Slideshow)

- Implement `slideshow.js` pipeline (Claude planning + Imagen frame generation)
- Implement `transitions.js` (cut, fade, kenburns) with `sharp`
- Extend `encoder.js` with per-frame palette path
- Reuse all the UI proven in Phase 1 — only adds frame grid rendering during generation

**Deliverable:** Slideshow tab functional end-to-end with real Imagen frames and transitions.

### Phase 3 — Content Studio Integration

- Extend server-side intent detector with `isGifRequest`
- Emit `gif_intent_detected` SSE event from Content Studio chat endpoint
- Create `GifIntentSuggestion.jsx` component, render inline in Content Studio chat
- Wire up direct pipeline call from Content Studio (mode button click)
- Extend `ImageSlotsManager.jsx` to render `.gif` URLs natively
- Wire "Open in Image Studio" navigation with query params

**Deliverable:** user in Content Studio writes "quiero un hero animado", sees 3-mode suggestion, clicks Typographic, gets a GIF in an image slot. Works end-to-end with both modes shipped.

### Phase 4 — Mode B (Veo)

- Implement `video-provider.js` abstraction
- Implement Veo provider with async submit + polling
- Implement Runway provider (fallback, verified at implementation)
- Dynamic import of `@ffmpeg/ffmpeg` + `@ffmpeg/util`
- Implement two-pass palette transcoding pipeline
- Add `GOOGLE_VEO_API_KEY` to `workspace_config.api_keys` allowed keys
- Settings UI: new input field for Veo API key (reuses existing masked-key pattern)

**Deliverable:** Veo tab functional. User gets cinematic-quality GIFs from video generation. All three modes live.

### Order Rationale

**Why C before A even though the user originally asked for A first:**

1. Typographic is the simplest mode technically — zero external IA dependencies for image generation. It validates the complete pipeline (SSE, preview, gallery, encoder) with zero API cost and zero rate-limit risk.
2. If a bug exists in the shared pipeline base (SSE handling, encoder, persistence, UI events), finding it while burning $0 in API calls is a huge win.
3. Once a typographic GIF renders and appears in the gallery, ~80% of the system is proven. Mode A becomes "swap frame source from canvas to Imagen" — a focused delta rather than a parallel build.
4. Principle: **technical risk at the end, user value early**. Phase 1 delivers real usable GIFs in the fastest possible time.

---

## Defaults Matrix

| Setting | Mode A | Mode C | Mode B |
|---|---|---|---|
| Size | 600×315 | 600×315 | 600px wide, auto height |
| Frames | 4 | ~60 (24fps × 2.5s) | 15 fps × 4s = 60 |
| Duration | ~2.8s (4 × 700ms) | 2500ms | 4000ms |
| Palette | per-frame (256) | global (256) | 128 (ffmpeg palette) |
| Auto-confirm | N/A | N/A | **true** |
| Typical cost | ~$0.04 (4 × Imagen) | $0 | ~$0.48 |
| Typical latency | 15-30s | <2s | 45-90s |
| Typical file size | 400-800KB | 50-150KB | 300-700KB |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Veo not accessible via Gemini API at implementation time | `video-provider.js` abstraction from day one, Runway/Pika as fallbacks with identical pipeline shape |
| Imagen rate limiting on serial 4-frame generation | Serial instead of parallel; retry once per frame; frame_failed event allows partial recovery |
| ffmpeg-wasm load failure (25MB WASM) | Dynamic import so startup unaffected; graceful fallback emits raw MP4 URL |
| GIF file sizes too large for email | 128-color palette in Mode B, per-frame palette ceiling in Mode A, target <1MB documented in defaults |
| SSE connection dropped during long Veo wait | 5-second polling tick doubles as heartbeat event |
| Canvas fonts missing at runtime | Bundle 3 fonts in repo, register at startup, fail fast if missing |
| GIF files accumulate on disk indefinitely | Out of scope for MVP; document as operational concern; phase 2 adds retention policy |
| `/tmp` not writable in Docker production | Use `apps/dashboard/public/temp-gifs/` instead of `/tmp`, matches existing `temp-images/` pattern |

---

## Testing Strategy

- **Per-mode snapshot tests** — generate a known-good GIF, compare file hash (with tolerance for encoder nondeterminism).
- **Preset visual tests (Mode C)** — render each preset with fixed params, save first/middle/last frame as PNGs, compare via image diff.
- **SSE event sequence tests** — mock Imagen/Veo, verify the endpoint emits the expected event order per mode.
- **Error path tests** — inject failures at each pipeline stage, verify correct error event and recovery behavior.
- **E2E smoke test** — start server, POST to endpoint with Mode C + fixed prompt, verify file exists and DB row created.

---

## Out of Scope (Phase 2+)

- Dynamic variables in Mode C presets (`{{first_name}}`, `{{discount}}` placeholders)
- Re-render from saved plan (reuse `plan` JSONB, change params, re-run)
- MP4/WebM output format
- Veo operation recovery endpoint for timed-out operations
- GIF file retention / cleanup policy
- Preserving intermediate Veo MP4 alongside GIF
- Cost quota enforcement per user/workspace
- Per-user gallery analytics (views, reuses, export counts)
- Multi-user collaborative GIF editing
- Video editing / trimming / multi-clip sequencing

---

## Approval

Design approved by user (Guillermo) in brainstorming session 2026-04-08.

Confirmed decisions:
- New page Image Studio (not embedded in Content Studio)
- One endpoint with `mode` parameter
- `gifenc` + `@napi-rs/canvas` always, `@ffmpeg/ffmpeg` dynamic import for Mode B only
- 4 frames default for Mode A, per-frame palette
- 600×315 default size
- 6 presets for Mode C, variables literal (phase 2 for dynamic)
- Fonts: Inter + Playfair Display + JetBrains Mono
- Mode B: `autoConfirm: true` (direct execution), cost shown informationally
- `video-provider` abstraction from day one
- Phase order: C → A → Content Studio integration → B
- Content Studio: suggest-don't-execute pattern with `GifIntentSuggestion` inline panel
- Single route with internal tabs, chat history preserved per tab
