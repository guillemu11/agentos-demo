import { useLanguage } from '../i18n/LanguageContext.jsx';
import { KNOWLEDGE_BASE } from '../data/autoResearchData.js';

const TAG_CLASSES = {
  copy: 'kb-tag-copy',
  timing: 'kb-tag-timing',
  format: 'kb-tag-format',
  cta: 'kb-tag-cta',
};

export default function KnowledgeBasePanel() {
  const { t } = useLanguage();

  function getTagLabel(tag) {
    const key = `researchLab.tag${tag.charAt(0).toUpperCase() + tag.slice(1)}`;
    return t(key);
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('researchLab.knowledgeBase')}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {KNOWLEDGE_BASE.length} {t('researchLab.kbCount')}
        </div>
      </div>
      {KNOWLEDGE_BASE.map(item => (
        <div key={item.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            className={`campaign-kpi-chip ${TAG_CLASSES[item.tag] || ''}`}
            style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, marginTop: 1 }}
          >
            {getTagLabel(item.tag)}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
            {item.text}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--wa-green)', flexShrink: 0 }}>
            {item.lift}
          </span>
        </div>
      ))}
    </div>
  );
}
