import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const MARKETS = ['en', 'es', 'ar', 'ru'];
const TIERS = ['economy', 'economy_premium', 'business', 'first_class'];

export default function ActiveVariantEditor({ variant, onChange }) {
    const { t } = useLanguage();
    const [tab, setTab] = useState('copy');

    if (!variant) {
        return (
            <div className="us-editor us-editor-empty">
                <div className="us-editor-empty-inner">
                    <h3>{t('unifiedStudio.empty.title')}</h3>
                    <p>{t('unifiedStudio.empty.body')}</p>
                </div>
            </div>
        );
    }

    const updateCopy = (patch) => onChange({ copy: { ...variant.copy, ...patch } });
    const updateHtml = (fullHtml) => onChange({ html: { ...variant.html, fullHtml } });
    const updateRoot = (patch) => onChange(patch);

    return (
        <div className="us-editor">
            <div className="us-editor-tabs">
                {['copy', 'html', 'preview'].map(k => (
                    <button
                        key={k}
                        className={`us-tab ${tab === k ? 'active' : ''}`}
                        onClick={() => setTab(k)}
                    >
                        {t(`unifiedStudio.tabs.${k}`)}
                    </button>
                ))}
            </div>

            <div className="us-editor-body">
                {tab === 'copy' && (
                    <div className="us-form">
                        <div className="us-form-row">
                            <label className="us-label">{t('unifiedStudio.fields.label')}</label>
                            <input
                                className="us-input"
                                value={variant.label || ''}
                                onChange={e => updateRoot({ label: e.target.value })}
                            />
                        </div>
                        <div className="us-form-grid">
                            <div className="us-form-row">
                                <label className="us-label">{t('unifiedStudio.fields.market')}</label>
                                <select
                                    className="us-input"
                                    value={variant.market}
                                    onChange={e => updateRoot({ market: e.target.value })}
                                >
                                    {MARKETS.map(m => <option key={m} value={m}>{t(`unifiedStudio.markets.${m}`)}</option>)}
                                </select>
                            </div>
                            <div className="us-form-row">
                                <label className="us-label">{t('unifiedStudio.fields.tier')}</label>
                                <select
                                    className="us-input"
                                    value={variant.tier}
                                    onChange={e => updateRoot({ tier: e.target.value })}
                                >
                                    {TIERS.map(tierKey => <option key={tierKey} value={tierKey}>{t(`unifiedStudio.tiers.${tierKey}`)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="us-form-row">
                            <label className="us-label">{t('unifiedStudio.fields.subject')}</label>
                            <input
                                className="us-input"
                                value={variant.copy?.subject || ''}
                                onChange={e => updateCopy({ subject: e.target.value })}
                            />
                        </div>
                        <div className="us-form-row">
                            <label className="us-label">{t('unifiedStudio.fields.preheader')}</label>
                            <input
                                className="us-input"
                                value={variant.copy?.preheader || ''}
                                onChange={e => updateCopy({ preheader: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {tab === 'html' && (
                    <div className="us-form us-form-full">
                        <label className="us-label">{t('unifiedStudio.fields.html')}</label>
                        <textarea
                            className="us-textarea"
                            value={variant.html?.fullHtml || ''}
                            onChange={e => updateHtml(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                )}

                {tab === 'preview' && (
                    <div className="us-preview">
                        <iframe
                            title="preview"
                            className="us-preview-frame"
                            srcDoc={variant.html?.fullHtml || `<div style="padding:24px;font-family:sans-serif;color:#64748b">${t('unifiedStudio.previewHint')}</div>`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
