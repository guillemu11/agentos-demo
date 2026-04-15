import React from 'react';
import { Mail, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function AssetConfirmCards({ options, onSelect }) {
    const { t } = useLanguage();
    if (!options || options.length === 0) return null;

    return (
        <div className="asset-confirm">
            <div className="asset-confirm__title">{t('previewTest.confirm.title')}</div>
            <div className="asset-confirm__help">{t('previewTest.confirm.help')}</div>
            <div className="asset-confirm__grid">
                {options.map(opt => (
                    <button
                        key={opt.assetId}
                        className="asset-confirm-card"
                        onClick={() => onSelect(opt.assetId)}
                    >
                        <div className="asset-confirm-card__icon"><Mail size={16} /></div>
                        <div className="asset-confirm-card__body">
                            <div className="asset-confirm-card__name">{opt.name}</div>
                            <div className="asset-confirm-card__meta">
                                <span>#{opt.assetId}</span>
                                {opt.assetType && <span>· {opt.assetType}</span>}
                                {opt.modified && <span>· {opt.modified}</span>}
                            </div>
                        </div>
                        <ChevronRight size={14} className="asset-confirm-card__arrow" />
                    </button>
                ))}
            </div>
        </div>
    );
}
