// apps/dashboard/src/components/studio/MarketSelector.jsx
import React from 'react';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };

function marketStatus(marketKey, variants) {
  const FIELDS = ['subject', 'preheader', 'heroHeadline', 'bodyCopy', 'cta'];
  // Check all tiers for this market — if any tier is complete, mark done
  const keys = Object.keys(variants).filter(k => k.startsWith(marketKey + ':'));
  if (keys.length === 0) return 'pending';
  const anyDone = keys.some(k =>
    FIELDS.every(f => variants[k]?.[f]?.status === 'approved')
  );
  if (anyDone) return 'done';
  const anyProgress = keys.some(k =>
    FIELDS.some(f => variants[k]?.[f]?.status === 'generating' || variants[k]?.[f]?.value != null)
  );
  return anyProgress ? 'in-progress' : 'pending';
}

export default function MarketSelector({ markets, activeMarket, variants, onSelect }) {
  return (
    <div className="studio-market-tabs">
      {markets.map(market => {
        const status = marketStatus(market, variants);
        const isActive = activeMarket === market;
        return (
          <button
            key={market}
            className={`studio-market-tab ${isActive ? 'active' : ''} ${status === 'done' ? 'done' : ''}`}
            onClick={() => onSelect(market)}
          >
            <div
              className="dot"
              style={{
                background: status === 'done' ? 'var(--studio-green)'
                  : status === 'in-progress' ? 'var(--studio-indigo)'
                  : 'var(--studio-text-subtle)',
              }}
            />
            {MARKET_FLAGS[market] || '🌐'} {market.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
