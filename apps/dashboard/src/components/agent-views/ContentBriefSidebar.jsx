import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪' };
const MARKET_LABELS = { en: 'EN', es: 'ES', ar: 'AR' };
const BLOCK_KEYS = ['subject', 'heroImage', 'bodyCopy', 'cta'];

export default function ContentBriefSidebar({ brief, markets, onBriefUpdate, onHandoff }) {
  const { t } = useLanguage();
  const [activeMarket, setActiveMarket] = useState(markets[0] || 'en');

  const blockLabel = (key) => {
    if (key === 'subject') return t('contentAgent.blockSubject') || 'Subject Line';
    if (key === 'heroImage') return t('contentAgent.blockHeroImage') || 'Hero Image';
    if (key === 'bodyCopy') return t('contentAgent.blockBodyCopy') || 'Body Copy';
    if (key === 'cta') return t('contentAgent.blockCta') || 'CTA Button';
    return key;
  };

  // Count total approved blocks across all markets
  const totalBlocks = markets.length * BLOCK_KEYS.length;
  const approvedBlocks = markets.reduce((sum, m) => {
    return sum + BLOCK_KEYS.filter(k => brief[m]?.[k]?.status === 'approved').length;
  }, 0);
  const isComplete = approvedBlocks === totalBlocks;

  // Progress label: "EN 2/4 · ES 1/4 · AR 0/4"
  const progressDetail = markets.map(m => {
    const done = BLOCK_KEYS.filter(k => brief[m]?.[k]?.status === 'approved').length;
    return `${MARKET_LABELS[m] || m.toUpperCase()} ${done}/${BLOCK_KEYS.length}`;
  }).join(' · ');

  const activeBlocks = brief[activeMarket] || {};

  return (
    <aside className="brief-sidebar">
      {/* Header */}
      <div className="brief-sidebar-header">
        <div className="brief-sidebar-title">
          {t('contentAgent.briefSidebar') || 'Brief en construcción'}
        </div>
        <div className="brief-sidebar-subtitle">
          {(t('contentAgent.blocksProgress') || '{completed}/{total} bloques')
            .replace('{completed}', approvedBlocks)
            .replace('{total}', totalBlocks)}
        </div>
      </div>

      {/* Market tabs */}
      <div className="brief-market-tabs">
        {markets.map(m => (
          <button
            key={m}
            className={`brief-market-tab${activeMarket === m ? ' active' : ''}`}
            onClick={() => setActiveMarket(m)}
          >
            {MARKET_FLAGS[m] || '🌐'} {MARKET_LABELS[m] || m.toUpperCase()}
          </button>
        ))}
        <button className="brief-market-tab-add" title={t('contentAgent.addMarket') || '+ Mercado'}>+</button>
      </div>

      {/* Blocks */}
      <div className="brief-blocks">
        {BLOCK_KEYS.map(key => {
          const block = activeBlocks[key] || { status: 'pending', value: null };
          return (
            <div key={key} className={`brief-block ${block.status}`}>
              <div className="brief-block-header">
                <span className={`brief-block-label ${block.status}`}>{blockLabel(key)}</span>
                <span className={`brief-block-status ${block.status}`}>
                  {block.status === 'approved' && `✓ ${t('contentAgent.statusApproved') || 'aprobado'}`}
                  {block.status === 'generating' && `⏳ ${t('contentAgent.statusGenerating') || 'generando'}`}
                  {block.status === 'pending' && `— ${t('contentAgent.statusPending') || 'pendiente'}`}
                </span>
              </div>

              {block.status === 'approved' && block.value && (
                <>
                  {key === 'heroImage'
                    ? <img src={block.value} alt="Hero" className="brief-block-image-thumb" />
                    : <div className="brief-block-value">{block.value}</div>
                  }
                  <button
                    className="brief-block-edit-btn"
                    onClick={() => onBriefUpdate(activeMarket, key, { status: 'pending', value: null })}
                  >
                    {t('contentAgent.editBlock') || 'Editar'} ✏️
                  </button>
                </>
              )}

              {block.status === 'generating' && key === 'heroImage' && (
                <div style={{ height: 40, background: 'rgba(245,158,11,0.08)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: '#f59e0b', marginTop: 4 }}>
                  1200 × 628 px
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: progress + handoff */}
      <div className="brief-sidebar-footer">
        <div className="brief-progress-bar-wrap">
          <div className="brief-progress-label">
            <span>{t('contentAgent.globalProgress') || 'Progreso global'}</span>
            <span>{progressDetail}</span>
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
            {t('contentAgent.handoffIncomplete') || 'Completa todos los bloques primero'}
          </div>
        )}
      </div>
    </aside>
  );
}
