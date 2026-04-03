import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Monitor, Smartphone, Download, Mail, Maximize2, Save, ChevronDown, FlaskConical } from 'lucide-react';
import { substituteVariants, countApproved, FIELDS_PER_VARIANT } from '../utils/emailVariants.js';
import VariantPreviewModal from './VariantPreviewModal.jsx';

export default function EmailBuilderPreview({ html, patchedBlock, statusMessage, onBlockClick, onBlockDrop, projectId, contentVariants, contentReady }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('preview');
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [fullscreen, setFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const iframeRef = useRef(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [variantDropdownOpen, setVariantDropdownOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const variantKeys = Object.keys(contentVariants || {});
  const previewHtml = (activeVariant && contentVariants?.[activeVariant])
    ? substituteVariants(html, contentVariants[activeVariant])
    : html;
  const totalApproved = variantKeys.reduce((sum, k) =>
    sum + countApproved(contentVariants[k]), 0);
  const totalFields = variantKeys.length * FIELDS_PER_VARIANT;

  // Auto-adjust iframe height to content
  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const iframe = iframeRef.current;
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight;
        if (h) iframe.style.height = `${h + 20}px`;
      } catch {}
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [html]);

  function handleExport() {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveTemplate() {
    if (!html || !projectId) return;
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        market: 'all',
        language: 'all',
        tier: null,
        html_content: html,
        subject_line: 'Template Draft',
        variant_name: `Template Draft ${new Date().toLocaleDateString()}`,
      }),
    }).catch(() => {});
  }

  const tabs = [
    { id: 'preview', label: t('emailBuilder.tabPreview') },
    { id: 'html',    label: t('emailBuilder.tabHtml') },
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const blockHtml = e.dataTransfer.getData('text/html');
    const blockName = e.dataTransfer.getData('text/plain');
    if (blockHtml && onBlockDrop) onBlockDrop({ name: blockName, html: blockHtml });
  };

  const PreviewContent = (
    <div
      className="email-preview-body"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="email-preview-drop-overlay">
          {t('emailBlocks.dropHere')}
        </div>
      )}
      <div className={`email-preview-iframe-wrapper ${viewMode}`}>
        {html ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            srcDoc={previewHtml}
            title="Email Preview"
            className="email-preview-iframe"
          />
        ) : (
          <div className="email-preview-empty">
            <span style={{ fontSize: '2rem' }}>✉️</span>
            <span>{t('emailBuilder.noEmailYet')}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="email-builder-preview-panel" style={fullscreen ? {
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column'
    } : {}}>
      {/* Toolbar */}
      <div className="email-preview-toolbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`email-preview-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className="email-preview-toolbar-spacer" />

        {/* Variant selector */}
        <div className="email-preview-variant-selector">
          <span className="email-preview-variant-label">{t('emailBuilder.variantSelector')}</span>
          {contentReady && variantKeys.length > 0 ? (
            <div style={{ position: 'relative' }}>
              <button
                className="email-preview-variant-btn active"
                onClick={() => setVariantDropdownOpen(o => !o)}
              >
                <span className="variant-status-dot ready" />
                {activeVariant
                  ? activeVariant.replace(':', ' · ').toUpperCase()
                  : t('emailBuilder.allVariants')}
                <ChevronDown size={11} />
              </button>
              {variantDropdownOpen && (
                <div className="email-preview-variant-dropdown">
                  <div
                    className={`email-preview-variant-option ${!activeVariant ? 'active' : ''}`}
                    onClick={() => { setActiveVariant(null); setVariantDropdownOpen(false); }}
                  >
                    {t('emailBuilder.allVariants')}
                  </div>
                  {variantKeys.map(k => (
                    <div
                      key={k}
                      className={`email-preview-variant-option ${activeVariant === k ? 'active' : ''}`}
                      onClick={() => { setActiveVariant(k); setVariantDropdownOpen(false); }}
                    >
                      {k.replace(':', ' · ').toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="email-preview-variant-badge waiting">
              <span className="variant-status-dot waiting" />
              {t('emailBuilder.variantWaiting')}
            </span>
          )}
          {contentReady && (
            <span className="email-preview-variant-badge ready">
              {totalApproved}/{totalFields} {t('emailBuilder.variantReady')}
            </span>
          )}
        </div>

        <div className="email-preview-toolbar-spacer" />

        <button
          className={`email-preview-toolbar-btn ${viewMode === 'mobile' ? 'active' : ''}`}
          onClick={() => setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop')}
          title={viewMode === 'desktop' ? t('emailBuilder.toggleMobile') : t('emailBuilder.toggleDesktop')}
        >
          {viewMode === 'desktop' ? <Smartphone size={13} /> : <Monitor size={13} />}
        </button>
        <button
          className="email-preview-toolbar-btn"
          onClick={handleSaveTemplate}
          disabled={!html || !projectId}
          title={t('emailBuilder.saveTemplate')}
        >
          <Save size={13} />
        </button>
        <button className="email-preview-toolbar-btn" onClick={handleExport} title={t('emailBuilder.exportHtml')}>
          <Download size={13} />
        </button>
        <button
          className="email-preview-toolbar-btn"
          onClick={() => setShowPreviewModal(true)}
          disabled={!html || !contentReady}
          title={t('emailBuilder.previewTest')}
        >
          <FlaskConical size={13} />
        </button>
        <button
          className="email-preview-toolbar-btn"
          onClick={() => setFullscreen(f => !f)}
          title={t('emailBuilder.fullscreen')}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Body */}
      {activeTab === 'preview' && PreviewContent}
      {activeTab === 'html' && (
        <pre className="email-preview-html-source">{html || '<!-- no email yet -->'}</pre>
      )}

      {/* Status bar */}
      <div className="email-preview-statusbar">
        <span className={`status-dot ${html ? (patchedBlock ? 'updating' : 'stable') : 'idle'}`} />
        <span>{statusMessage || (html ? '✓ Email listo' : t('emailBuilder.noEmailYet'))}</span>
      </div>

      {showPreviewModal && (
        <VariantPreviewModal
          html={html}
          contentVariants={contentVariants}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
