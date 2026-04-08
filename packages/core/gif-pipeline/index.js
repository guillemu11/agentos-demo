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
 * @typedef {('slideshow'|'typographic'|'veo'|'image')} PipelineMode
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
  if (mode === 'image') {
    const { runImagePipeline } = await import('./image.js');
    return runImagePipeline(prompt, options, emit, ctx);
  }
  if (mode === 'slideshow') {
    throw new Error('Mode "slideshow" not implemented yet (see Phase 2)');
  }
  if (mode === 'veo') {
    throw new Error('Mode "veo" not implemented yet (see Phase 4)');
  }
  throw new Error(`Unknown pipeline mode: ${mode}`);
}
