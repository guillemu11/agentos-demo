// apps/dashboard/src/components/studio/StudioLivePreview.jsx
import React, { useState, useMemo } from 'react';
import { substituteForPreview } from '../../utils/emailMockSubstitute.js';

const MARKET_FLAGS = { en: '🇬🇧', es: '🇪🇸', ar: '🇦🇪', ru: '🇷🇺' };
const TIER_SHORT = { economy: 'Eco', economy_premium: 'Eco+', business: 'Biz', first_class: '1st' };

function variantLabel(key) {
  const [market, ...tierParts] = key.split(':');
  const tier = tierParts.join(':');
  return `${MARKET_FLAGS[market] || market.toUpperCase()} ${TIER_SHORT[tier] || tier}`;
}

export default function StudioLivePreview({ liveHtml, baseHtml, variants, previewVariant, onVariantSelect, onShowModal }) {
  const [isMobile, setIsMobile] = useState(false);

  const srcDoc = liveHtml || (baseHtml ? substituteForPreview(baseHtml) : '');

  // Only show variants that have at least one field with a value
  const populatedVariants = useMemo(() => {
    return Object.entries(variants || {}).filter(([, vd]) =>
      Object.values(vd).some(f => f?.value)
    ).map(([key]) => key);
  }, [variants]);

  return (
    <div className="studio-live-preview">
      <div className="studio-preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="studio-panel-title">Preview</div>
          <div className="studio-preview-market-tabs">
            {populatedVariants.length === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--studio-text-muted)' }}>No variants yet</span>
            ) : populatedVariants.map(key => (
              <button
                key={key}
                className={`studio-preview-market-tab ${previewVariant === key ? 'active' : ''}`}
                onClick={() => onVariantSelect(key)}
              >
                {variantLabel(key)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="studio-live-badge">
            <div className="studio-live-dot" />
            live
          </div>
          <button
            className="studio-btn studio-btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10 }}
            onClick={() => setIsMobile(m => !m)}
          >
            {isMobile ? '🖥 Desktop' : '📱 Mobile'}
          </button>
        </div>
      </div>

      <div className="studio-preview-body">
        <div className="studio-email-frame">
          <div className="studio-email-chrome">
            <div className="studio-chrome-dot" style={{ background: '#ef4444' }} />
            <div className="studio-chrome-dot" style={{ background: '#f59e0b' }} />
            <div className="studio-chrome-dot" style={{ background: '#10b981' }} />
          </div>
          {srcDoc ? (
            <iframe
              className="studio-email-iframe"
              srcDoc={srcDoc}
              sandbox="allow-same-origin"
              title="Email preview"
              style={{ width: isMobile ? 375 : '100%', maxWidth: '100%', margin: '0 auto', display: 'block' }}
            />
          ) : (
            <div className="studio-empty-state" style={{ background: 'white', color: '#64748b' }}>
              <div className="icon">📧</div>
              <div>No template available</div>
              <div style={{ fontSize: 11 }}>The HTML Developer needs to save a template first</div>
            </div>
          )}
        </div>

        <div className="studio-preview-actions">
          <button className="studio-preview-action pri" onClick={onShowModal}>
            ⊞ All variants
          </button>
        </div>
      </div>
    </div>
  );
}
