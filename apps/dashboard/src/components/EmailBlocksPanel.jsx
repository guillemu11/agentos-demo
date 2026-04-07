import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CATEGORY_GROUP = {
  header: 'header',
  hero: 'hero',
  story: 'story',
  offer: 'offer',
  cta: 'cta',
  'body-copy': 'content',
  'section-title': 'content',
  article: 'content',
  infographic: 'content',
  card: 'content',
  columns: 'content',
  partner: 'content',
  flight: 'content',
  footer: 'footer',
};

const FILTERS = ['all', 'header', 'hero', 'story', 'offer', 'cta', 'content', 'footer'];

const BADGE_COLORS = {
  header:  { bg: '#fef3c7', color: '#92400e' },
  hero:    { bg: '#ede9fe', color: '#5b21b6' },
  story:   { bg: '#e0f2fe', color: '#075985' },
  offer:   { bg: '#fee2e2', color: '#991b1b' },
  cta:     { bg: '#d1fae5', color: '#065f46' },
  content: { bg: '#f3f4f6', color: '#374151' },
  footer:  { bg: '#f3f4f6', color: '#374151' },
};


export default function EmailBlocksPanel() {
  const { t } = useLanguage();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setBlocks(
        (data.blocks || []).map(b => ({
          ...b,
          group: CATEGORY_GROUP[b.category] || 'content',
        }))
      ))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase();
  const filtered = blocks.filter(b => {
    const matchesFilter = filter === 'all' || b.group === filter;
    const matchesSearch = !q
      || b.title.toLowerCase().includes(q)
      || (b.description || '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="email-blocks-panel">
      <div className="email-blocks-search">
        <input
          className="email-blocks-search-input"
          type="text"
          placeholder={t('emailBlocks.search') || 'Search blocks...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="email-blocks-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`email-blocks-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(`emailBlocks.cat_${f}`) || f}
          </button>
        ))}
      </div>

      <div className="email-blocks-list">
        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.loading')}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.empty')}
          </div>
        )}

        {!loading && filtered.map(block => {
          const badge = BADGE_COLORS[block.group] || BADGE_COLORS.content;
          return (
            <div
              key={block.id}
              className={`email-block-row animate-fade-in${draggingId === block.id ? ' dragging' : ''}`}
              draggable
              onDragStart={e => {
                setDraggingId(block.id);
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/html', block.html);
                e.dataTransfer.setData('text/plain', block.filename || block.title);
              }}
              onDragEnd={() => setDraggingId(null)}
              title={block.description || block.title}
            >
              <div className="email-block-row-thumb">
                {block.html
                  ? <iframe
                      sandbox="allow-same-origin"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:0;overflow:hidden;}</style></head><body>${substituteForPreview(block.html, block.filename || block.title)}</body></html>`}
                      className="email-block-row-thumb-iframe"
                      tabIndex={-1}
                      scrolling="no"
                    />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--bg-secondary)' }} />
                }
              </div>
              <div className="email-block-row-info">
                <div className="email-block-row-name">{block.title}</div>
                {block.description && (
                  <div className="email-block-row-desc">{block.description}</div>
                )}
              </div>
              <span
                className="email-block-badge"
                style={{ background: badge.bg, color: badge.color }}
              >
                {block.group}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
