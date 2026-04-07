// apps/dashboard/src/components/studio/StudioLivePreview.jsx
import React, { useState } from 'react';
import { substituteForPreview } from '../../utils/emailMockSubstitute.js';

export default function StudioLivePreview({ liveHtml, baseHtml, markets, previewMarket, onMarketSelect, onShowModal }) {
  const [isMobile, setIsMobile] = useState(false);

  const srcDoc = liveHtml || (baseHtml ? substituteForPreview(baseHtml) : '');

  return (
    <div className="studio-live-preview">
      <div className="studio-preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="studio-panel-title">Preview</div>
          <div className="studio-preview-market-tabs">
            {markets.map(m => (
              <button
                key={m}
                className={`studio-preview-market-tab ${previewMarket === m ? 'active' : ''}`}
                onClick={() => onMarketSelect(m)}
              >
                {m.toUpperCase()}
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
              <div>Sin template disponible</div>
              <div style={{ fontSize: 11 }}>El HTML Developer debe guardar un template primero</div>
            </div>
          )}
        </div>

        <div className="studio-preview-actions">
          <button className="studio-preview-action pri" onClick={onShowModal}>
            ⊞ Todas las variantes
          </button>
        </div>
      </div>
    </div>
  );
}
