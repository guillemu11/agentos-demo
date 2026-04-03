import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { substituteVariants } from '../utils/emailVariants.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function VariantPreviewModal({ html, contentVariants, onClose }) {
  const { t } = useLanguage();
  const variantKeys = Object.keys(contentVariants || {});

  const [previewKey, setPreviewKey] = useState(variantKeys[0] || null);
  const [sendQueue, setSendQueue] = useState(new Set());
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const previewHtml = previewKey && contentVariants[previewKey]
    ? substituteVariants(html, contentVariants[previewKey])
    : html;

  function toggleSendQueue(key) {
    setSendQueue(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSendTests() {
    if (!testEmail || sendQueue.size === 0) return;
    setSending(true);
    let count = 0;
    for (const key of sendQueue) {
      const populated = substituteVariants(html, contentVariants[key]);
      try {
        const res = await fetch(`${API_URL}/emails/send-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            to: testEmail,
            html: populated,
            variantLabel: key.replace(':', ' · ').toUpperCase(),
          }),
        });
        if (res.ok) count++;
      } catch { /* silent */ }
    }
    setSentCount(count);
    setSending(false);
  }

  return (
    <div className="variant-modal-overlay" onClick={onClose}>
      <div className="variant-modal" onClick={e => e.stopPropagation()}>
        <div className="variant-modal-header">
          <h3>{t('emailBuilder.previewTest')}</h3>
          <button className="variant-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="variant-modal-body">
          <div className="variant-modal-list">
            <div className="variant-modal-list-label">{t('emailBuilder.variantSelector')}</div>
            {variantKeys.length === 0 && (
              <div className="variant-modal-empty">{t('emailBuilder.noVariantsReady')}</div>
            )}
            {variantKeys.map(key => {
              const isPreviewing = previewKey === key;
              const isQueued = sendQueue.has(key);
              return (
                <div
                  key={key}
                  className={`variant-card ${isPreviewing ? 'previewing' : ''} ${isQueued ? 'queued' : ''}`}
                  onClick={() => setPreviewKey(key)}
                >
                  <div className="variant-card-name">
                    {key.replace(':', ' · ').toUpperCase()}
                  </div>
                  <div className="variant-card-meta">
                    {isPreviewing && (
                      <span className="variant-badge previewing">{t('emailBuilder.variantPreviewing')}</span>
                    )}
                    {isQueued && (
                      <span className="variant-badge queued">{t('emailBuilder.variantInQueue')}</span>
                    )}
                  </div>
                  <div
                    className={`variant-card-checkbox ${isQueued ? 'checked' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleSendQueue(key); }}
                  >
                    {isQueued ? '✓' : ''}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="variant-modal-preview">
            {previewHtml ? (
              <iframe
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                title="Variant Preview"
                className="variant-modal-iframe"
              />
            ) : (
              <div className="variant-modal-no-preview">{t('emailBuilder.noEmailYet')}</div>
            )}
          </div>
        </div>

        <div className="variant-modal-footer">
          {sentCount > 0 && (
            <span className="variant-modal-sent">✓ {t('emailBuilder.sentCount').replace('{n}', sentCount)}</span>
          )}
          <input
            className="variant-modal-email-input"
            type="email"
            placeholder={t('emailBuilder.testEmailPlaceholder')}
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
          />
          <button
            className="variant-modal-send-btn"
            onClick={handleSendTests}
            disabled={!testEmail || sendQueue.size === 0 || sending}
          >
            {sending
              ? '...'
              : t('emailBuilder.sendTestVariants').replace('{n}', sendQueue.size)}
          </button>
        </div>
      </div>
    </div>
  );
}
