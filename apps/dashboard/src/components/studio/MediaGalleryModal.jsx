import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Trash2, Copy, Image as ImageIcon, Film, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * MediaGalleryModal — fullscreen gallery of all generated media (GIFs + images).
 *
 * Fetches `GET /api/gif-pipeline/gallery` on open.
 * Supports filter chips (All / GIFs / Images) and per-card actions
 * (download, copy URL, delete).
 *
 * Props:
 *   open       — whether the modal is visible
 *   onClose    — callback when user closes the modal
 *   refreshKey — when this changes (e.g. after a new generation),
 *                the modal refetches if it's open
 */
export default function MediaGalleryModal({ open, onClose, refreshKey }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'gif' | 'image'

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/gif-pipeline/gallery`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.gifs || []);
    } catch (err) {
      console.error('[MediaGallery] fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchGallery();
  }, [open, refreshKey, fetchGallery]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = items.filter((it) => {
    if (filter === 'all') return true;
    if (filter === 'gif') return it.mode === 'typographic' || it.mode === 'slideshow' || it.mode === 'veo';
    if (filter === 'image') return it.mode === 'image';
    return true;
  });

  const handleDelete = async (id) => {
    if (!confirm(t('imageStudio.gallery.confirmDelete') || 'Delete this item?')) return;
    try {
      const res = await fetch(`${API_URL}/gif-pipeline/gif/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      console.error('[MediaGallery] delete error:', err);
      alert('Delete failed: ' + err.message);
    }
  };

  const handleCopyUrl = async (item) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + item.file_path);
    } catch (err) {
      console.error('[MediaGallery] copy error:', err);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="media-gallery-modal-overlay" onClick={onClose}>
      <div className="media-gallery-modal" onClick={(e) => e.stopPropagation()}>
        <header className="media-gallery-modal-header">
          <div className="media-gallery-modal-title">
            <h2>{t('imageStudio.gallery.title')}</h2>
            <p>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</p>
          </div>
          <div className="media-gallery-filters">
            <button
              className={`media-gallery-filter ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`media-gallery-filter ${filter === 'gif' ? 'active' : ''}`}
              onClick={() => setFilter('gif')}
            >
              GIFs
            </button>
            <button
              className={`media-gallery-filter ${filter === 'image' ? 'active' : ''}`}
              onClick={() => setFilter('image')}
            >
              Images
            </button>
          </div>
          <button className="media-gallery-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="media-gallery-modal-body">
          {loading && (
            <div className="media-gallery-empty">
              <div className="gif-preview-spinner" />
              <div className="media-gallery-empty-text">Loading...</div>
            </div>
          )}

          {!loading && error && (
            <div className="media-gallery-empty">
              <div className="media-gallery-empty-icon">⚠</div>
              <div className="media-gallery-empty-text">Failed to load gallery</div>
              <div className="media-gallery-empty-hint">{error}</div>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="media-gallery-empty">
              <div className="media-gallery-empty-icon">
                <Sparkles size={48} />
              </div>
              <div className="media-gallery-empty-text">
                {items.length === 0
                  ? t('imageStudio.gallery.empty')
                  : 'No items match this filter'}
              </div>
              {items.length === 0 && (
                <div className="media-gallery-empty-hint">Generate your first asset to see it here</div>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="media-gallery-grid">
              {filtered.map((item) => {
                const isImage = item.mode === 'image';
                const thumb = item.thumbnail_path || item.file_path;
                return (
                  <div key={item.id} className="media-gallery-card">
                    <div className="media-gallery-card-thumb">
                      <img src={thumb} alt={item.prompt} loading="lazy" />
                      <span className={`media-gallery-card-badge media-gallery-card-badge-${item.mode}`}>
                        {isImage ? 'IMG' : item.mode.toUpperCase()}
                      </span>
                      <div className="media-gallery-card-actions">
                        <a
                          href={item.file_path}
                          download
                          className="media-gallery-card-action"
                          title="Download"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={16} />
                        </a>
                        <button
                          className="media-gallery-card-action"
                          title="Copy URL"
                          onClick={(e) => { e.stopPropagation(); handleCopyUrl(item); }}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          className="media-gallery-card-action media-gallery-card-action-danger"
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="media-gallery-card-body">
                      <div className="media-gallery-card-prompt">{item.prompt}</div>
                      <div className="media-gallery-card-meta">
                        <span className="media-gallery-card-dim">{item.width}×{item.height}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
