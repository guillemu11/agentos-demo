import React from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import VariantCard from './VariantCard.jsx';

export default function VariantTimeline({ variants, activeId, onSelect, onDuplicate, onRemove, onCreate }) {
    const { t } = useLanguage();
    return (
        <div className="us-timeline">
            <div className="us-timeline-scroll">
                {variants.map(v => (
                    <VariantCard
                        key={v.id}
                        variant={v}
                        active={v.id === activeId}
                        onSelect={onSelect}
                        onDuplicate={onDuplicate}
                        onRemove={onRemove}
                    />
                ))}
                <button className="us-variant-card us-variant-card-add" onClick={onCreate}>
                    <Plus size={20} />
                    <span>{t('unifiedStudio.newVariant')}</span>
                </button>
            </div>
        </div>
    );
}
