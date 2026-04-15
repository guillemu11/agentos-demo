import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import VariantTabs from './VariantTabs.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function variantUrl(url) {
    if (!url) return null;
    // If VITE_API_URL is set, url already starts with /api/... — prepend origin
    // In dev with vite proxy, relative path works.
    return url;
}

export default function PreviewCanvas({ variants, variantOrder, currentKey, onSelectVariant, emailName, status, phases }) {
    const { t } = useLanguage();
    const [gridMode, setGridMode] = useState(false);

    const hasVariants = variantOrder.length > 0;
    const current = currentKey ? variants[currentKey] : null;
    const isBuilding = status === 'streaming';

    // Expected variant slots (rough skeleton count based on phase state)
    const skeletonCount = phases?.render?.status === 'active' ? 4 : 2;

    return (
        <div className="preview-canvas">
            <div className="preview-canvas__header">
                <div className="preview-canvas__title">
                    {emailName || (hasVariants ? t('previewTest.preview.ready') : t('previewTest.preview.waiting'))}
                </div>
                {hasVariants && (
                    <VariantTabs
                        variantOrder={variantOrder}
                        currentKey={currentKey}
                        onSelect={onSelectVariant}
                        gridMode={gridMode}
                        onToggleGrid={() => setGridMode(g => !g)}
                    />
                )}
            </div>

            <div className="preview-canvas__body">
                {!hasVariants && !isBuilding && (
                    <div className="preview-canvas__empty">
                        <Mail size={36} strokeWidth={1.2} />
                        <div className="preview-canvas__empty-title">{t('previewTest.preview.emptyTitle')}</div>
                        <div className="preview-canvas__empty-help">{t('previewTest.preview.emptyHelp')}</div>
                    </div>
                )}

                {!hasVariants && isBuilding && (
                    <div className="preview-canvas__skeleton-list">
                        {Array.from({ length: skeletonCount }).map((_, i) => (
                            <div key={i} className="preview-canvas__skeleton" style={{ animationDelay: `${i * 0.15}s` }}>
                                <Loader2 size={16} className="preview-canvas__skeleton-spinner" />
                                <div className="preview-canvas__skeleton-bar" />
                            </div>
                        ))}
                    </div>
                )}

                {hasVariants && !gridMode && current && (
                    <div className="preview-canvas__frame-wrap">
                        <iframe
                            key={currentKey}
                            className="preview-canvas__iframe"
                            src={variantUrl(current.url)}
                            title={current.filename}
                            sandbox="allow-same-origin"
                        />
                    </div>
                )}

                {hasVariants && gridMode && (
                    <div className="preview-canvas__grid">
                        {variantOrder.map(key => (
                            <button
                                key={key}
                                className={`preview-canvas__grid-item ${key === currentKey ? 'is-active' : ''}`}
                                onClick={() => { onSelectVariant(key); setGridMode(false); }}
                            >
                                <iframe
                                    className="preview-canvas__grid-iframe"
                                    src={variantUrl(variants[key].url)}
                                    title={variants[key].filename}
                                    sandbox="allow-same-origin"
                                    scrolling="no"
                                />
                                <div className="preview-canvas__grid-label">{key}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
