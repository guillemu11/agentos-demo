// apps/dashboard/src/components/studio/StudioVariantsPanel.jsx
import React, { useState, useMemo } from 'react';
import MarketSelector from './MarketSelector.jsx';
import VariantFieldsGrid from './VariantFieldsGrid.jsx';
import ImageSlotsManager from './ImageSlotsManager.jsx';
import { categorizeVar, varLabel, PERSONALIZATION_VARS } from './studioConstants.js';

const AVAILABLE_TIERS = ['economy', 'economy_premium', 'business', 'first_class'];
const TIER_LABELS = { economy: 'Economy', economy_premium: 'Eco Premium', business: 'Business', first_class: 'First Class' };

export default function StudioVariantsPanel({
  markets,
  variants,
  activeMarket,
  activeTier,
  onMarketSelect,
  onTierSelect,
  imageSlots,
  onSlotsChange,
  blockVarMap,
  onApprove,
  onRegenerate,
}) {
  const [activeTab, setActiveTab] = useState('content');

  const variantKey = `${activeMarket}:${activeTier}`;
  const variantData = variants[variantKey] || null;

  // Derive all unique var names from blockVarMap, categorized
  const allVarsByCategory = useMemo(() => {
    const all = Object.values(blockVarMap || {}).flat();
    const unique = [...new Set(all)];
    return {
      content: unique.filter(v => categorizeVar(v) === 'content'),
      image: unique.filter(v => categorizeVar(v) === 'image'),
      personalization: unique.filter(v => categorizeVar(v) === 'personalization'),
    };
  }, [blockVarMap]);

  const hasAmpscript = allVarsByCategory.personalization.length > 0 || PERSONALIZATION_VARS.length > 0;
  const marketSlots = imageSlots?.[activeMarket] || {};

  // Shared market + tier selector rendered in all tabs
  const MarketTierSelector = (
    <>
      <MarketSelector
        markets={markets}
        activeMarket={activeMarket}
        variants={variants}
        onSelect={onMarketSelect}
      />
      {markets.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {AVAILABLE_TIERS.map(tier => (
            <button
              key={tier}
              className={`studio-market-tab ${activeTier === tier ? 'active' : ''}`}
              onClick={() => onTierSelect(tier)}
              style={{ fontSize: 9 }}
            >
              {TIER_LABELS[tier]}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="studio-panel" style={{ borderRight: 'none', borderBottom: '1px solid var(--studio-border)' }}>
      {/* Tabs */}
      <div className="studio-tabs">
        <button className={`studio-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>Content</button>
        <button className={`studio-tab ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>Images</button>
        {hasAmpscript && (
          <button className={`studio-tab ${activeTab === 'ampscript' ? 'active' : ''}`} onClick={() => setActiveTab('ampscript')}>AMPscript</button>
        )}
      </div>

      {/* Body */}
      <div className="studio-variants-body">
        {activeTab === 'content' && (
          <>
            {MarketTierSelector}
            <VariantFieldsGrid
              variantData={variantData}
              allVarNames={allVarsByCategory.content}
              onApprove={onApprove}
              onRegenerate={onRegenerate}
            />
          </>
        )}

        {activeTab === 'images' && (
          <>
            {MarketTierSelector}
            <ImageSlotsManager
              slots={marketSlots}
              marketKey={activeMarket}
              onSlotsChange={onSlotsChange}
            />
          </>
        )}

        {activeTab === 'ampscript' && hasAmpscript && (
          <>
            {MarketTierSelector}
            <div className="studio-ampscript-wrap">
              <div style={{ fontSize: 10, color: 'var(--studio-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                Personalization tokens — set by Marketing Cloud at send time. Copy into your AMPscript template.
              </div>
              {PERSONALIZATION_VARS.map(varName => {
                const token = `%%=v(@${varName})=%%`;
                return (
                  <div key={varName} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--studio-text-muted)', minWidth: 100, flexShrink: 0 }}>
                      {varLabel(varName)}
                    </div>
                    <div style={{ flex: 1, fontSize: 11, color: 'var(--studio-indigo)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--studio-border)', borderRadius: 6, padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {token}
                    </div>
                    <button
                      style={{ fontSize: 10, padding: '3px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--studio-border)', color: 'var(--studio-text)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => navigator.clipboard.writeText(token)}
                    >
                      Copy
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
