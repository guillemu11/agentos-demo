// apps/dashboard/src/components/studio/StudioVariantsPanel.jsx
import React, { useState } from 'react';
import MarketSelector from './MarketSelector.jsx';
import VariantFieldsGrid from './VariantFieldsGrid.jsx';
import ImageSlotsManager from './ImageSlotsManager.jsx';

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
  ampVarValues,
  onVarChange,
}) {
  const [activeTab, setActiveTab] = useState('content');

  const variantKey = `${activeMarket}:${activeTier}`;
  const variantData = variants[variantKey] || null;

  const hasAmpscript = Object.keys(blockVarMap || {}).length > 0;
  const marketSlots = imageSlots?.[activeMarket] || {};

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
            <VariantFieldsGrid variantData={variantData} />
          </>
        )}

        {activeTab === 'images' && (
          <>
            <MarketSelector
              markets={markets}
              activeMarket={activeMarket}
              variants={variants}
              onSelect={onMarketSelect}
            />
            <ImageSlotsManager
              slots={marketSlots}
              marketKey={activeMarket}
              onSlotsChange={onSlotsChange}
            />
          </>
        )}

        {activeTab === 'ampscript' && hasAmpscript && (
          <div className="studio-ampscript-wrap">
            {Object.entries(blockVarMap).map(([blockName, vars]) => (
              <div key={blockName} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--studio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {blockName}
                </div>
                {vars.map(varName => (
                  <div key={varName} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--studio-indigo)', fontFamily: 'monospace', minWidth: 120, flexShrink: 0 }}>@{varName}</div>
                    <input
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--studio-border)', color: 'var(--studio-text)', borderRadius: 6, padding: '4px 8px', fontSize: 11, outline: 'none' }}
                      value={ampVarValues?.[`@${varName}`] || ''}
                      onChange={e => onVarChange(`@${varName}`, e.target.value)}
                      placeholder={`@${varName}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
