// apps/dashboard/src/components/studio/VariantPreviewModal.jsx
import React, { useState } from 'react';
import { LangIcon } from '../icons.jsx';
import { substituteForPreview } from '../../utils/emailMockSubstitute.js';

function buildPreviewHtml(baseHtml, market, tier, variants, imageSlots, ampVarValues) {
  if (!baseHtml) return '';
  const variantKey = `${market}:${tier}`;
  const variantData = variants[variantKey];
  const slots = imageSlots?.[market] || {};

  // Start with amp var substitution
  let html = baseHtml;
  const merged = { ...(ampVarValues || {}) };

  // Override with variant field values
  if (variantData) {
    Object.entries(variantData || {}).forEach(([field, fieldData]) => {
      if (fieldData?.value) merged[`@${field}`] = fieldData.value;
    });
  }

  // Apply image slots
  Object.entries(slots).forEach(([slotName, slot]) => {
    if (slot?.url) merged[`@${slotName}`] = slot.url;
  });

  // Substitute
  for (const [key, value] of Object.entries(merged)) {
    const varName = key.startsWith('@') ? key.slice(1) : key;
    const safe = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`%%=v\\(@${safe}\\)=%%`, 'g'), value);
  }

  // Fallback: mock-substitute any remaining vars
  return substituteForPreview(html);
}

export default function VariantPreviewModal({ ticket, markets, activeTier, variants, imageSlots, ampVarValues, baseHtml, progressStats, canHandoff, onHandoff, onClose }) {
  const [activeMarket, setActiveMarket] = useState(markets[0] || 'en');
  const { approved = 0, total = 0 } = progressStats || {};

  const previewHtml = buildPreviewHtml(baseHtml, activeMarket, activeTier, variants, imageSlots, ampVarValues);

  return (
    <div className="studio-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="studio-modal">
        <div className="studio-modal-header">
          <div className="studio-modal-title">
            Preview — {ticket?.project_name || 'Campaña'}
          </div>
          <button className="studio-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="studio-modal-tabs">
          {markets.map(market => (
            <button
              key={market}
              className={`studio-modal-tab ${activeMarket === market ? 'active' : ''}`}
              onClick={() => setActiveMarket(market)}
            >
              <LangIcon lang={market} /> {market.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="studio-modal-body">
          {previewHtml ? (
            <iframe
              className="studio-modal-iframe"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              title={`Preview ${activeMarket}`}
            />
          ) : (
            <div className="studio-empty-state" style={{ background: 'white', color: '#64748b', borderRadius: 8 }}>
              <div className="icon">📧</div>
              <div>No template available</div>
            </div>
          )}
        </div>

        <div className="studio-modal-footer">
          <div className="studio-modal-footer-info">
            {approved} / {total} fields approved · {markets.length} markets
          </div>
          <button
            className="studio-btn studio-btn-primary"
            onClick={onHandoff}
            disabled={!canHandoff}
            title={!canHandoff ? 'Approve at least one complete variant before handoff' : ''}
          >
            → Handoff to HTML Dev
          </button>
        </div>
      </div>
    </div>
  );
}
