import React from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Monitor } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function parseVariantKey(key) {
    const clean = key.replace(/\.html$/i, '');
    const parts = clean.split('_');
    const last = parts[parts.length - 1];
    const isTier = ['skw', 'ebase', 'both', 'default'].includes(last);
    const tier = isTier ? last : null;
    const lang = isTier ? parts.slice(0, -1).join('_') : clean;
    return { lang, tier };
}

export default function VariantTabs({ variantOrder, currentKey, onSelect, gridMode, onToggleGrid }) {
    const { t } = useLanguage();
    const idx = variantOrder.indexOf(currentKey);
    const prev = idx > 0 ? variantOrder[idx - 1] : null;
    const next = idx >= 0 && idx < variantOrder.length - 1 ? variantOrder[idx + 1] : null;

    return (
        <div className="variant-tabs">
            <div className="variant-tabs__nav">
                <button
                    className="variant-tabs__arrow"
                    onClick={() => prev && onSelect(prev)}
                    disabled={!prev}
                    aria-label={t('previewTest.variantNav.prev')}
                >
                    <ChevronLeft size={14} />
                </button>
                <div className="variant-tabs__list">
                    {variantOrder.map(key => {
                        const { lang, tier } = parseVariantKey(key);
                        return (
                            <button
                                key={key}
                                className={`variant-tabs__tab ${key === currentKey ? 'is-active' : ''}`}
                                onClick={() => onSelect(key)}
                            >
                                <span className="variant-tabs__lang">{lang}</span>
                                {tier && <span className="variant-tabs__tier">{tier}</span>}
                            </button>
                        );
                    })}
                </div>
                <button
                    className="variant-tabs__arrow"
                    onClick={() => next && onSelect(next)}
                    disabled={!next}
                    aria-label={t('previewTest.variantNav.next')}
                >
                    <ChevronRight size={14} />
                </button>
            </div>
            <button
                className="variant-tabs__grid-toggle"
                onClick={onToggleGrid}
                title={t('previewTest.variantNav.gridToggle')}
            >
                {gridMode ? <Monitor size={14} /> : <LayoutGrid size={14} />}
            </button>
        </div>
    );
}
