import React from 'react';
import { Copy, Trash2, Link2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function VariantCard({ variant, active, onSelect, onDuplicate, onRemove }) {
    const { t } = useLanguage();
    const marketLabel = t(`unifiedStudio.markets.${variant.market}`) || variant.market;
    const tierLabel = t(`unifiedStudio.tiers.${variant.tier}`) || variant.tier;
    const dirty = variant.dirty?.copy || variant.dirty?.html || variant.dirty?.assets;

    return (
        <div
            className={`us-variant-card ${active ? 'active' : ''}`}
            onClick={() => onSelect(variant.id)}
            role="button"
            tabIndex={0}
        >
            <div className="us-variant-card-header">
                <span className="us-variant-card-label">{variant.label || t('unifiedStudio.untitledVariant')}</span>
                <div className="us-variant-card-status">
                    {variant.mcLink?.emailId && <span className="us-chip us-chip-mc" title="MC"><Link2 size={10} /> {t('unifiedStudio.mcLinked')}</span>}
                    <span className={`us-dot ${dirty ? 'us-dot-dirty' : 'us-dot-clean'}`} title={dirty ? t('unifiedStudio.dirty') : t('unifiedStudio.saved')} />
                </div>
            </div>
            <div className="us-variant-card-body">
                <div className="us-variant-card-subject">{variant.copy?.subject || '—'}</div>
                <div className="us-variant-card-meta">
                    <span className="us-chip">{marketLabel}</span>
                    <span className="us-chip">{tierLabel}</span>
                </div>
            </div>
            <div className="us-variant-card-actions" onClick={(e) => e.stopPropagation()}>
                <button className="us-icon-btn" onClick={() => onDuplicate(variant.id)} title={t('unifiedStudio.duplicate')}>
                    <Copy size={14} />
                </button>
                <button className="us-icon-btn" onClick={() => onRemove(variant.id)} title={t('unifiedStudio.remove')}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}
