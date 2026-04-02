import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Monitor, Smartphone, Download, Mail, Maximize2 } from 'lucide-react';

export default function EmailBuilderPreview({ html, patchedBlock, statusMessage, onBlockClick }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('preview');
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef(null);

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

  function handleSendTest() {
    const email = window.prompt(t('emailBuilder.sendTest') + ':');
    if (!email || !html) return;
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/emails/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, html }),
    }).catch(() => {});
  }

  const tabs = [
    { id: 'preview', label: t('emailBuilder.tabPreview') },
    { id: 'html',    label: t('emailBuilder.tabHtml') },
  ];

  const PreviewContent = (
    <div className="email-preview-body">
      <div className={`email-preview-iframe-wrapper ${viewMode}`}>
        {html ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            srcDoc={html}
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
        <button
          className={`email-preview-toolbar-btn ${viewMode === 'mobile' ? 'active' : ''}`}
          onClick={() => setViewMode(v => v === 'desktop' ? 'mobile' : 'desktop')}
          title={viewMode === 'desktop' ? t('emailBuilder.toggleMobile') : t('emailBuilder.toggleDesktop')}
        >
          {viewMode === 'desktop' ? <Smartphone size={13} /> : <Monitor size={13} />}
        </button>
        <button className="email-preview-toolbar-btn" onClick={handleExport} title={t('emailBuilder.exportHtml')}>
          <Download size={13} />
        </button>
        <button className="email-preview-toolbar-btn" onClick={handleSendTest} title={t('emailBuilder.sendTest')}>
          <Mail size={13} />
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
    </div>
  );
}
