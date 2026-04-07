import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function EmailBriefCard({ emailSpec, onDefineClick, briefDate }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const hasBlocks = emailSpec?.blocks?.length > 0;

  if (!hasBlocks) {
    return (
      <div className="email-brief-card email-brief-card--pending">
        <span className="email-brief-pending-label">
          <FileText size={13} />
          {t('campaignManager.brief.pending')}
        </span>
        <button
          className="email-brief-define-btn"
          onClick={onDefineClick}
        >
          {t('campaignManager.brief.defineWithRaul')} →
        </button>
      </div>
    );
  }

  const blocks = emailSpec.blocks || [];
  const variables = emailSpec.variable_list || [];
  const designNotes = emailSpec.design_notes || '';

  return (
    <div className="email-brief-card">
      <button
        className="email-brief-card__header"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="email-brief-card__title">
          <FileText size={14} />
          {t('campaignManager.brief.title')}
        </span>
        <span className="email-brief-card__meta">
          {t('campaignManager.brief.definedBy')}
          {briefDate ? ` · ${new Date(briefDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="email-brief-card__body">
          {designNotes && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.objective')}</span>
              <span className="email-brief-card__value">{designNotes}</span>
            </div>
          )}

          {blocks.length > 0 && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.blocks')}</span>
              <div className="email-brief-card__tags">
                {blocks.map(b => (
                  <span key={b.name} className="brief-variant-tag">{b.name}</span>
                ))}
            </div>
            </div>
          )}

          {variables.length > 0 && (
            <div className="email-brief-card__row">
              <span className="email-brief-card__label">{t('campaignManager.brief.variables')}</span>
              <div className="email-brief-card__tags">
                {variables.map(v => (
                  <span key={v} className="brief-variant-tag brief-variant-tag--var">{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
