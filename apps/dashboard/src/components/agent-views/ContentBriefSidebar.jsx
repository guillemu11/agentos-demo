import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { LangIcon } from '../icons.jsx';

const MARKET_LABELS = { en: 'EN', es: 'ES', ar: 'AR', ru: 'RU', de: 'DE', fr: 'FR', it: 'IT', zh: 'ZH', ja: 'JA', pt: 'PT' };
const TIER_LABELS   = { economy: 'Economy', economy_premium: 'Eco Premium', business: 'Business', first_class: 'First Class' };
const BLOCK_KEYS    = ['subject', 'preheader', 'heroHeadline', 'bodyCopy', 'cta'];

const parseVariantKey = (key) => {
  const [market, ...tierParts] = (key || '').split(':');
  return { market, tier: tierParts.join(':') };
};

const variantTagLabel = (key) => {
  const { market, tier } = parseVariantKey(key);
  const mLabel = MARKET_LABELS[market] || (market || '').toUpperCase();
  const tLabel = TIER_LABELS[tier] || (tier || '').replace(/_/g, ' ');
  return `${mLabel} / ${tLabel}`;
};

export default function ContentBriefSidebar({
  variants,
  activeVariant,
  availableMarkets,
  availableTiers,
  onAddVariant,
  onSelectVariant,
  onBriefUpdate,
  onHandoff,
  chatImages = [],
}) {
  const { t } = useLanguage();
  const [newMarket, setNewMarket] = useState('');
  const [newTier, setNewTier]     = useState('');

  const variantKeys   = Object.keys(variants || {});
  const totalBlocks   = variantKeys.length * BLOCK_KEYS.length;
  const approvedBlocks = variantKeys.reduce((sum, vk) =>
    sum + BLOCK_KEYS.filter(k => variants[vk]?.[k]?.status === 'approved').length, 0);
  const isComplete = variantKeys.length > 0 && approvedBlocks === totalBlocks;

  const handleAddVariant = () => {
    if (!newMarket || !newTier) return;
    onAddVariant(newMarket, newTier);
    setNewMarket('');
    setNewTier('');
  };

  const blockLabel = (key) => {
    const labels = {
      subject:      t('contentAgent.blockSubject')      || 'Subject Line',
      preheader:    t('contentAgent.blockPreheader')    || 'Preheader',
      heroHeadline: t('contentAgent.blockHeroHeadline') || 'Hero Headline',
      bodyCopy:     t('contentAgent.blockBodyCopy')     || 'Body Copy',
      cta:          t('contentAgent.blockCta')          || 'CTA Button',
    };
    return labels[key] || key;
  };

  const activeBlocks = activeVariant ? (variants[activeVariant] || {}) : null;

  return (
    <aside className="brief-sidebar">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="brief-sidebar-header">
        <div className="brief-sidebar-title">
          {t('contentAgent.briefSidebar') || 'Brief en construcción'}
        </div>
        <div className="brief-sidebar-subtitle">
          {(t('contentAgent.blocksProgress') || '{completed}/{total} bloques')
            .replace('{completed}', approvedBlocks)
            .replace('{total}', totalBlocks || 0)}
        </div>
      </div>

      {/* ─── Variants (tags) ────────────────────────────── */}
      <div className="brief-variants-section">
        <div className="brief-variants-label">
          {t('contentAgent.variantsLabel') || 'Variants'}
        </div>
        <div className="brief-variant-tags">
          {variantKeys.length === 0 ? (
            <span className="brief-variants-empty">
              {t('contentAgent.noVariantsYet') || 'No variants yet'}
            </span>
          ) : (
            variantKeys.map(vk => {
              const done = BLOCK_KEYS.filter(k => variants[vk]?.[k]?.status === 'approved').length;
              const { market } = parseVariantKey(vk);
              return (
                <button
                  key={vk}
                  className={`brief-variant-tag${activeVariant === vk ? ' active' : ''}`}
                  onClick={() => onSelectVariant(vk)}
                >
                  <LangIcon lang={market} /> {variantTagLabel(vk)}
                  <span className="brief-variant-tag-progress">{done}/{BLOCK_KEYS.length}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── New Variant form ───────────────────────────── */}
      <div className="brief-new-variant-form">
        <div className="brief-new-variant-title">
          {t('contentAgent.newVariant') || 'New Variant'}
        </div>
        <div className="brief-new-variant-fields">
          <select
            className="brief-new-variant-select"
            value={newMarket}
            onChange={e => setNewMarket(e.target.value)}
          >
            <option value="">{t('contentAgent.selectMarket') || 'Market'}</option>
            {(availableMarkets || []).map(m => (
              <option key={m} value={m}>
                {MARKET_LABELS[m] || m.toUpperCase()} {MARKET_LABELS[m] || m.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className="brief-new-variant-select"
            value={newTier}
            onChange={e => setNewTier(e.target.value)}
          >
            <option value="">{t('contentAgent.selectTier') || 'Tier'}</option>
            {(availableTiers || []).map(tier => (
              <option key={tier} value={tier}>
                {TIER_LABELS[tier] || tier}
              </option>
            ))}
          </select>
          <button
            className="brief-new-variant-add-btn"
            onClick={handleAddVariant}
            disabled={!newMarket || !newTier}
            title="Add variant"
          >
            +
          </button>
        </div>
      </div>

      {/* ─── Content Fields (variante activa) ───────────── */}
      <div className="brief-blocks">
        {activeBlocks ? (
          <>
            <div className="brief-active-variant-label">
              <LangIcon lang={parseVariantKey(activeVariant).market || 'en'} /> {variantTagLabel(activeVariant)}
            </div>
            {BLOCK_KEYS.map(key => {
              const block = activeBlocks[key] || { status: 'pending', value: null };
              return (
                <div key={key} className={`brief-block ${block.status}`}>
                  <div className="brief-block-header">
                    <span className={`brief-block-label ${block.status}`}>{blockLabel(key)}</span>
                    <span className={`brief-block-status ${block.status}`}>
                      {block.status === 'approved'  && `✓ ${t('contentAgent.statusApproved')  || 'aprobado'}`}
                      {block.status === 'generating' && `⏳ ${t('contentAgent.statusGenerating') || 'generando'}`}
                      {block.status === 'pending'    && `— ${t('contentAgent.statusPending')   || 'pendiente'}`}
                    </span>
                  </div>
                  {block.status === 'approved' && block.value && (
                    <>
                      <div className="brief-block-value">{block.value}</div>
                      <button
                        className="brief-block-edit-btn"
                        onClick={() => onBriefUpdate({ variant: activeVariant, block: key, status: 'pending', value: null })}
                      >
                        {t('contentAgent.editBlock') || 'Editar'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="brief-no-variant-selected">
            {t('contentAgent.selectVariantHint') || 'Select a variant above to see its content fields'}
          </div>
        )}
      </div>

      {/* ─── Chat Images ────────────────────────────────── */}
      {chatImages.length > 0 && (
        <div className="brief-images-section">
          <div className="brief-images-header">
            <span>{t('contentAgent.imagesGenerated') || 'Imágenes generadas'}</span>
            <span className="brief-images-count">{chatImages.length}</span>
          </div>
          <div className="brief-images-list">
            {chatImages.map(img => (
              <div key={img.id} className="brief-image-thumb" onClick={() => window.open(img.url, '_blank')}>
                <img src={img.url} alt={img.prompt} />
                {img.prompt && <div className="brief-image-prompt">{img.prompt}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Footer: progress + handoff ─────────────────── */}
      <div className="brief-sidebar-footer">
        <div className="brief-progress-bar-wrap">
          <div className="brief-progress-label">
            <span>{t('contentAgent.globalProgress') || 'Progreso global'}</span>
            <span>{approvedBlocks}/{totalBlocks || 0}</span>
          </div>
          <div className="brief-progress-track">
            <div
              className="brief-progress-fill"
              style={{ width: `${totalBlocks > 0 ? (approvedBlocks / totalBlocks) * 100 : 0}%` }}
            />
          </div>
        </div>

        <button
          className="brief-handoff-btn"
          disabled={!isComplete}
          onClick={isComplete ? onHandoff : undefined}
        >
          {t('contentAgent.handoffButton') || 'Pasar a HTML Developer'} →
        </button>

        {!isComplete && (
          <div className="brief-handoff-hint">
            {variantKeys.length === 0
              ? (t('contentAgent.handoffNoVariants') || 'Crea al menos una variante primero')
              : (t('contentAgent.handoffIncomplete') || 'Completa todos los bloques primero')}
          </div>
        )}
      </div>
    </aside>
  );
}
