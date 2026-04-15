import React, { useState } from 'react';
import { Image, Pencil } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

// Variables que son imágenes (no texto)
const IMAGE_VARS = new Set(['hero_image', 'story1_image', 'story2_image', 'story3_image', 'article_image', 'logo_image', 'header_logo']);
// Variables que son links (ignorar en la UI principal)
const LINK_VARS = new Set(['hero_image_link_alias', 'body_link_alias', 'story1_alias', 'story2_alias', 'story3_alias', 'article_link_alias', 'unsub_link_alias', 'contactus_link_alias', 'privacy_link_alias', 'logo_link_alias', 'header_logo_alias', 'join_skw_alias']);
// Footer/legal vars (siempre auto-rellenados)
const FOOTER_VARS = new Set(['unsub_text', 'contactus_text', 'privacy_text']);

function varType(varName) {
    if (IMAGE_VARS.has(varName)) return 'image';
    if (LINK_VARS.has(varName)) return 'link';
    if (FOOTER_VARS.has(varName)) return 'footer';
    return 'text';
}

const MARKET_LABELS = { en: 'EN', es: 'ES', ar: 'AR', ru: 'RU' };
const TIER_LABELS = { economy: 'Economy', economy_premium: 'Eco Premium', business: 'Business', first_class: 'First' };

export default function AmpscriptSidebar({
    blockVarMap,      // { "Block 2": ["header_logo", ...], "Block 3": [...], ... }
    varValues,        // { "@main_header": "Welcome back...", ... }
    onBlockClick,     // (blockName, vars) => void — pre-loads chat
    onHandoff,        // () => void
    canHandoff,       // boolean
    selectedVariant,  // "en:economy" | null
    onVariantChange,  // (market, tier) => void
    availableMarkets,
    availableTiers,
}) {
    const { t } = useLanguage();
    const [newMarket, setNewMarket] = useState('');
    const [newTier, setNewTier] = useState('');

    const allBlocks = Object.entries(blockVarMap || {});
    // Count filled vars (ignore link and footer vars)
    const fillableVars = allBlocks.flatMap(([, vars]) => vars.filter(v => varType(v) !== 'link' && varType(v) !== 'footer'));
    const filledVars = fillableVars.filter(v => varValues?.[`@${v}`]);
    const progress = fillableVars.length > 0 ? Math.round((filledVars.length / fillableVars.length) * 100) : 0;

    return (
        <aside className="ampscript-sidebar">
            {/* Header */}
            <div className="ampscript-sidebar-header">
                <div className="ampscript-sidebar-title">
                    {t('ampscript.sidebarTitle') || 'Variables del Email'}
                </div>
                <div className="ampscript-sidebar-progress-row">
                    <div className="ampscript-sidebar-progress-track">
                        <div className="ampscript-sidebar-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="ampscript-sidebar-progress-pct">{progress}%</span>
                </div>
            </div>

            {/* Variant selector */}
            <div className="ampscript-variant-selector">
                <select
                    className="ampscript-variant-select"
                    value={newMarket}
                    onChange={e => setNewMarket(e.target.value)}
                >
                    <option value="">{t('contentAgent.selectMarket') || 'Market'}</option>
                    {(availableMarkets || []).map(m => (
                        <option key={m} value={m}>{MARKET_LABELS[m] || m.toUpperCase()}</option>
                    ))}
                </select>
                <select
                    className="ampscript-variant-select"
                    value={newTier}
                    onChange={e => setNewTier(e.target.value)}
                >
                    <option value="">{t('contentAgent.selectTier') || 'Tier'}</option>
                    {(availableTiers || []).map(tier => (
                        <option key={tier} value={tier}>{TIER_LABELS[tier] || tier}</option>
                    ))}
                </select>
                <button
                    className="ampscript-fill-btn"
                    disabled={!newMarket || !newTier}
                    onClick={() => {
                        if (!newMarket || !newTier) return;
                        onVariantChange?.(newMarket, newTier);
                        onBlockClick?.('__fill_all__', { market: newMarket, tier: newTier });
                        setNewMarket(''); setNewTier('');
                    }}
                >
                    {t('ampscript.fillBtn') || 'Rellenar →'}
                </button>
            </div>

            {/* Block list */}
            <div className="ampscript-block-list">
                {allBlocks.map(([blockName, vars]) => {
                    const fillable = vars.filter(v => varType(v) !== 'link' && varType(v) !== 'footer');
                    const filled = fillable.filter(v => varValues?.[`@${v}`]);
                    const done = fillable.length > 0 && filled.length === fillable.length;
                    if (fillable.length === 0) return null;
                    return (
                        <div
                            key={blockName}
                            className={`ampscript-block-item${done ? ' done' : ''}`}
                            onClick={() => onBlockClick?.(blockName, vars)}
                        >
                            <div className="ampscript-block-item-header">
                                <span className="ampscript-block-item-name">{blockName}</span>
                                <span className={`ampscript-block-item-status ${done ? 'done' : 'pending'}`}>
                                    {done ? '✓' : `${filled.length}/${fillable.length}`}
                                </span>
                            </div>
                            <div className="ampscript-var-list">
                                {fillable.map(varName => {
                                    const value = varValues?.[`@${varName}`];
                                    const type = varType(varName);
                                    return (
                                        <div key={varName} className={`ampscript-var-row ${value ? 'filled' : 'empty'}`}>
                                            <span className="ampscript-var-type-icon">
                                                {type === 'image' ? <Image size={13} /> : <Pencil size={13} />}
                                            </span>
                                            <span className="ampscript-var-name">@{varName}</span>
                                            {value && (
                                                <span className="ampscript-var-value" title={value}>
                                                    {type === 'image'
                                                        ? '(imagen guardada)'
                                                        : value.length > 40 ? value.substring(0, 40) + '…' : value}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="ampscript-sidebar-footer">
                <button
                    className="brief-handoff-btn"
                    disabled={!canHandoff}
                    onClick={canHandoff ? onHandoff : undefined}
                >
                    {t('contentAgent.handoffButton') || 'Pasar a HTML Developer'} →
                </button>
                {!canHandoff && (
                    <div className="brief-handoff-hint">
                        {fillableVars.length === 0
                            ? (t('ampscript.noVarsYet') || 'Carga el template primero')
                            : (t('ampscript.incompleteVars') || `Faltan ${fillableVars.length - filledVars.length} variables`)}
                    </div>
                )}
            </div>
        </aside>
    );
}
