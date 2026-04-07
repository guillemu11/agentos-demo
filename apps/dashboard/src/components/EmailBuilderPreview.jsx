import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Monitor, Smartphone, Mail, Maximize2, Save, ChevronDown, FlaskConical, X } from 'lucide-react';
import { substituteVariants, countApproved, FIELDS_PER_VARIANT } from '../utils/emailVariants.js';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';
import VariantPreviewModal from './VariantPreviewModal.jsx';

// Auto-sizing iframe for a single block
function BlockIframe({ html, blockName, templateHead }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(120);
  useEffect(() => {
    if (!ref.current) return;
    const onLoad = () => {
      try {
        const h = ref.current.contentDocument?.body?.scrollHeight;
        if (h) setHeight(h + 4);
      } catch {}
    };
    ref.current.addEventListener('load', onLoad);
    return () => ref.current?.removeEventListener('load', onLoad);
  }, [html]);
  const head = templateHead || '<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:0;}</style>';
  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin"
      srcDoc={`<!DOCTYPE html><html><head>${head}</head><body style="margin:0;padding:0;">${substituteForPreview(html, blockName)}</body></html>`}
      style={{ width: '100%', height, border: 'none', display: 'block', pointerEvents: 'none' }}
      scrolling="no"
    />
  );
}

export default function EmailBuilderPreview({ html, saveHtml, blocks, templateHtml, onReorderBlocks, onRemoveBlock, patchedBlock, statusMessage, onBlockClick, onBlockDrop, projectId, contentVariants, contentReady, onTemplateSaved, editingTemplate, onBlockSelect, onBlockDeselect, selectedCanvasBlock }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('preview');
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [fullscreen, setFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const iframeRef = useRef(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [variantDropdownOpen, setVariantDropdownOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [canvasDragIndex, setCanvasDragIndex] = useState(null);
  const [canvasDragOver, setCanvasDragOver] = useState(null);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveToast, setSaveToast] = useState(false);
  const savePopoverRef = useRef(null);
  const [previewMode, setPreviewMode] = useState('template'); // 'template' | 'content'
  const [contentPreviewHtml, setContentPreviewHtml] = useState(null);
  const [contentPreviewStale, setContentPreviewStale] = useState(false);
  const [contentPreviewLoading, setContentPreviewLoading] = useState(false);

  useEffect(() => {
    if (!showSavePopover) return;
    function handleClickOutside(e) {
      if (savePopoverRef.current && !savePopoverRef.current.contains(e.target)) {
        setShowSavePopover(false);
        setSaveTemplateName('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSavePopover]);

  // Fetch content preview from Lucía's session
  useEffect(() => {
    if (!projectId || previewMode !== 'content') return;
    let cancelled = false;
    setContentPreviewLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/content-preview-html`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setContentPreviewHtml(data.html);
        setContentPreviewStale(data.is_stale);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setContentPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, previewMode]);

  // Extract <head> content from template once for block iframes
  const templateHead = templateHtml
    ? (templateHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '')
    : '';

  const variantKeys = Object.keys(contentVariants || {});
  const previewHtml = substituteForPreview(
    (activeVariant && contentVariants?.[activeVariant])
      ? substituteVariants(html, contentVariants[activeVariant])
      : html
  );
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

  async function handleUpdateTemplate() {
    const htmlToSave = saveHtml || html;
    if (!htmlToSave || !editingTemplate?.id) return;
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    try {
      const res = await fetch(`${API_URL}/emails/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html_content: htmlToSave }),
      });
      if (!res.ok) return;
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
      if (onTemplateSaved) onTemplateSaved();
    } catch {}
  }

  async function handleSaveTemplate() {
    const htmlToSave = saveHtml || html;
    if (!htmlToSave || !projectId || !saveTemplateName.trim()) return;
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          market: 'all',
          language: 'all',
          tier: null,
          html_content: htmlToSave,
          subject_line: saveTemplateName.trim(),
          variant_name: saveTemplateName.trim(),
        }),
      });
      if (!res.ok) return;
      setShowSavePopover(false);
      setSaveTemplateName('');
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
      if (onTemplateSaved) onTemplateSaved();
    } catch (err) {
      console.error('[SaveTemplate] fetch failed:', err);
    }
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

  // Blocks canvas — each block is its own iframe with drag+remove overlay
  const BlocksCanvas = blocks && blocks.length > 0 ? (
    <div className="email-preview-body email-blocks-canvas-body"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={e => {
        // Allow dropping new blocks from panel onto the canvas
        const blockHtml = e.dataTransfer.getData('text/html');
        const blockName = e.dataTransfer.getData('text/plain');
        if (blockHtml && onBlockDrop && !canvasDragIndex) onBlockDrop({ name: blockName, html: blockHtml });
        setIsDragOver(false);
      }}
    >
      {isDragOver && canvasDragIndex === null && (
        <div className="email-preview-drop-overlay">{t('emailBlocks.dropHere')}</div>
      )}
      <div className={`email-preview-iframe-wrapper ${viewMode}`}>
      <div
        className="email-blocks-canvas"
        onClick={(e) => {
          if (e.target === e.currentTarget && onBlockDeselect) onBlockDeselect();
        }}
      >
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className={`email-block-canvas-row${canvasDragOver === i ? ' canvas-drag-over' : ''}${canvasDragIndex === i ? ' canvas-dragging' : ''}${selectedCanvasBlock?.id === block.id ? ' selected' : ''}`}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setCanvasDragIndex(i); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setCanvasDragOver(i); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setCanvasDragOver(null); }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              if (canvasDragIndex !== null && onReorderBlocks) onReorderBlocks(canvasDragIndex, i);
              setCanvasDragIndex(null); setCanvasDragOver(null);
            }}
            onDragEnd={() => { setCanvasDragIndex(null); setCanvasDragOver(null); }}
            onClick={(e) => {
              e.stopPropagation();
              if (onBlockSelect) onBlockSelect(block);
              if (onBlockClick) onBlockClick(block.name);
            }}
          >
            <BlockIframe html={block.html} blockName={block.name || ''} templateHead={templateHead} />
            <div
              className="email-block-canvas-overlay"
              onClick={(e) => {
                e.stopPropagation();
                if (onBlockSelect) onBlockSelect(block);
                if (onBlockClick) onBlockClick(block.name);
              }}
            >
              <span className="email-block-canvas-drag-hint">⠿ {block.name}</span>
              {onRemoveBlock && (
                <button className="email-block-canvas-remove" onClick={(e) => { e.stopPropagation(); onRemoveBlock(i); }} title="Eliminar bloque">×</button>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  ) : null;

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
        {previewMode === 'content' ? (
          contentPreviewLoading ? (
            <div className="email-preview-empty"><span>{t('common.loading') || 'Cargando...'}</span></div>
          ) : contentPreviewHtml ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {contentPreviewStale && (
                <div style={{
                  background: 'color-mix(in srgb, var(--accent-yellow) 15%, transparent)',
                  border: '1px solid var(--accent-yellow)',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  margin: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)'
                }}>
                  {t('emailSpec.staleWarning')}
                </div>
              )}
              <iframe
                sandbox="allow-same-origin"
                srcDoc={contentPreviewHtml}
                title="Content Preview"
                className="email-preview-iframe"
                style={{ flex: 1 }}
              />
            </div>
          ) : (
            <div className="email-preview-empty">
              <span style={{ fontSize: '2rem' }}>🤖</span>
              <span>{t('emailSpec.noPreview')}</span>
            </div>
          )
        ) : html ? (
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
        {projectId && (
          <button
            className={`email-preview-tab${previewMode === 'content' ? ' active' : ''}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => setPreviewMode(prev => prev === 'content' ? 'template' : 'content')}
          >
            {previewMode === 'content' ? t('emailSpec.templateView') : t('emailSpec.contentPreview')}
          </button>
        )}
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

        {/* Save — update mode if editingTemplate, else new with popover */}
        {editingTemplate ? (
          <button
            className="email-preview-toolbar-btn email-preview-toolbar-btn--text"
            onClick={handleUpdateTemplate}
            disabled={!(saveHtml || html)}
            title={editingTemplate.name}
          >
            <Save size={13} />
            <span>Actualizar</span>
          </button>
        ) : (
        <div style={{ position: 'relative' }} ref={savePopoverRef}>
          <button
            className="email-preview-toolbar-btn email-preview-toolbar-btn--text"
            onClick={() => { if ((saveHtml || html) && projectId) setShowSavePopover(o => !o); }}
            disabled={!(saveHtml || html) || !projectId}
          >
            <Save size={13} />
            <span>{t('emailBuilder.saveTemplate')}</span>
          </button>
          {showSavePopover && (
            <div className="email-save-popover">
              <input
                className="email-save-popover-input"
                placeholder={t('emailBuilder.savePopoverPlaceholder')}
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && saveTemplateName.trim()) handleSaveTemplate(); if (e.key === 'Escape') { setShowSavePopover(false); setSaveTemplateName(''); } }}
                autoFocus
              />
              <div className="email-save-popover-actions">
                <button
                  className="email-save-popover-confirm"
                  onClick={handleSaveTemplate}
                  disabled={!saveTemplateName.trim()}
                >
                  {t('emailBuilder.saveConfirm')}
                </button>
                <button className="email-save-popover-cancel" onClick={() => { setShowSavePopover(false); setSaveTemplateName(''); }}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Preview & Test */}
        <button
          className="email-preview-toolbar-btn email-preview-toolbar-btn--text email-preview-toolbar-btn--purple"
          onClick={() => setShowPreviewModal(true)}
          disabled={!html || !contentReady}
          title={!contentReady ? t('emailBuilder.waitingVariants') : t('emailBuilder.previewTest')}
        >
          <FlaskConical size={13} />
          <span>{t('emailBuilder.previewTest')}</span>
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
      {activeTab === 'preview' && (BlocksCanvas || PreviewContent)}
      {activeTab === 'html' && (
        <pre className="email-preview-html-source">{html || '<!-- no email yet -->'}</pre>
      )}

      {/* Status bar */}
      <div className="email-preview-statusbar">
        <span className={`status-dot ${html ? (patchedBlock ? 'updating' : 'stable') : 'idle'}`} />
        <span>{statusMessage || (html ? '✓ Email listo' : t('emailBuilder.noEmailYet'))}</span>
      </div>

      {saveToast && (
        <div className="email-save-toast">{t('emailBuilder.savedToast')}</div>
      )}

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
