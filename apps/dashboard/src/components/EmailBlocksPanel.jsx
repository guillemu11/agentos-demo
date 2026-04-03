import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Maps Haiku-generated categories to UI filter groups
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

export default function EmailBlocksPanel() {
  const { t } = useLanguage();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
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

  const filtered = filter === 'all' ? blocks : blocks.filter(b => b.group === filter);

  return (
    <div className="email-blocks-panel">
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

      <div className="email-blocks-grid">
        {loading && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.loading')}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
            {t('emailBlocks.empty')}
          </div>
        )}

        {!loading && filtered.map(block => (
          <div
            key={block.id}
            className={`email-block-card animate-fade-in${draggingId === block.id ? ' dragging' : ''}`}
            draggable
            onDragStart={e => {
              setDraggingId(block.id);
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/html', block.html);
              e.dataTransfer.setData('text/plain', block.title);
            }}
            onDragEnd={() => setDraggingId(null)}
            title={block.description || block.title}
          >
            {block.html ? (
              <iframe
                sandbox="allow-same-origin"
                srcDoc={block.html}
                className="email-block-thumb"
                tabIndex={-1}
              />
            ) : (
              <div
                className="email-block-thumb"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}
              >
                {block.category}
              </div>
            )}
            <div className="email-block-label">{block.title}</div>
            <div className="email-block-type">{block.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
