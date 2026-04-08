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
