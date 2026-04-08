import React from 'react';
import { Download, Copy, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * GifPipelinePreview — center column of Image Studio.
 * Shows the current pipeline state: empty, in-progress, or done.
 *
 * The preview renders differently for static images vs GIFs: static images
 * hide frame/duration meta fields (they are undefined or 1 / null).
 */
export default function GifPipelinePreview({ state }) {
  const { t } = useLanguage();

  // ─── Empty state ────────────────────────────────────────────────────────
  if (!state || state.status === 'idle') {
    return (
      <div className="gif-preview">
        <div className="gif-preview-empty">
          <div className="gif-preview-empty-icon">
            <ImageIcon size={56} />
          </div>
          <div className="gif-preview-empty-text">{t('imageStudio.preview.empty')}</div>
          <div className="gif-preview-empty-hint">{t('imageStudio.preview.emptyHint')}</div>
        </div>
      </div>
    );
  }

  // ─── Done state ─────────────────────────────────────────────────────────
  if (state.status === 'done' && state.gifUrl) {
    const meta = state.meta || {};
    const isImage = meta.mode === 'image';
    const sizeKb = meta.file_size_bytes != null
      ? `${Math.round(meta.file_size_bytes / 1024)} KB`
      : null;

    const copyUrl = async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin + state.gifUrl);
      } catch (err) {
        console.error('[Preview] copy error:', err);
      }
    };

    return (
      <div className="gif-preview">
        <div className="gif-preview-image-wrap">
          <img src={state.gifUrl} alt="Generated media" className="gif-preview-image" />
        </div>

        <div className="gif-preview-meta">
          <div className="gif-preview-meta-item">
            <span className="gif-preview-meta-label">{t('imageStudio.preview.metaDimensions')}</span>
            <span className="gif-preview-meta-value">{meta.width}×{meta.height}</span>
          </div>
          {!isImage && meta.frame_count != null && (
            <div className="gif-preview-meta-item">
              <span className="gif-preview-meta-label">{t('imageStudio.preview.metaFrames')}</span>
              <span className="gif-preview-meta-value">{meta.frame_count}</span>
            </div>
          )}
          {!isImage && meta.duration_ms != null && (
            <div className="gif-preview-meta-item">
              <span className="gif-preview-meta-label">{t('imageStudio.preview.metaDuration')}</span>
              <span className="gif-preview-meta-value">{meta.duration_ms}ms</span>
            </div>
          )}
          {sizeKb && (
            <div className="gif-preview-meta-item">
              <span className="gif-preview-meta-label">{t('imageStudio.preview.metaSize')}</span>
              <span className="gif-preview-meta-value">{sizeKb}</span>
            </div>
          )}
        </div>

        <div className="gif-preview-actions">
          <a
            href={state.gifUrl}
            download
            className="gif-preview-action gif-preview-action-primary"
          >
            <Download size={14} />
            {t('imageStudio.preview.download')}
          </a>
          <button className="gif-preview-action" onClick={copyUrl}>
            <Copy size={14} />
            {t('imageStudio.preview.copyUrl')}
          </button>
        </div>
      </div>
    );
  }

  // ─── In-progress ────────────────────────────────────────────────────────
  return (
    <div className="gif-preview">
      <div className="gif-preview-progress">
        <div className="gif-preview-spinner" />
        <div className="gif-preview-progress-text">{state.statusText || '...'}</div>
      </div>
    </div>
  );
}
