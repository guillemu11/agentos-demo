import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import AgentChatSwitcher from '../components/agent-views/shared/AgentChatSwitcher.jsx';
import EmailBuilderPreview from '../components/EmailBuilderPreview.jsx';
import EmailBlocksPanel from '../components/EmailBlocksPanel.jsx';
import { fetchEmailTemplate, injectIntoSlot, mergeAiHtmlIntoTemplate } from '../utils/emailTemplate.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'html-developer';

const BLOCK_CATEGORIES = ['All', 'Header', 'Hero', 'Content', 'CTA', 'Footer'];

const TYPE_TO_CATEGORY = {
  header: 'Header', preheader: 'Header', 'section-heading': 'Header',
  hero: 'Hero',
  'body-copy': 'Content', 'product-cards': 'Content', 'partner-module': 'Content', 'info-card': 'Content',
  cta: 'CTA',
  footer: 'Footer', terms: 'Footer',
};

export default function BlockStudioPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Page state
  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'blocks'

  // Blocks data (for Block Manager tab)
  const [ragBlocks, setRagBlocks] = useState(null); // null = loading

  // Builder state
  const [builderBlocks, setBuilderBlocks] = useState([]); // [{id, name, html}]
  const [aiHtml, setAiHtml] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [leftTab, setLeftTab] = useState('blocks'); // 'blocks' | 'chat' — blocks by default
  const [chatInput, setChatInput] = useState('');

  // Block Manager state
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockFilter, setBlockFilter] = useState('All');
  const [blockSearch, setBlockSearch] = useState('');
  const [reingesting, setReingesting] = useState(false);
  const [reingestMsg, setReingestMsg] = useState('');

  // Load agent
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Load template
  useEffect(() => {
    fetchEmailTemplate().then(html => { if (html) setTemplateHtml(html); });
  }, []);

  // Load blocks for Block Manager tab
  useEffect(() => {
    fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
      .then(r => r.json())
      .then(result => {
        setRagBlocks((result.blocks || []).map(b => ({
          id: b.id,
          name: b.title,
          category: TYPE_TO_CATEGORY[b.category] || 'Content',
          type: b.category,
          description: b.description || '',
          html: b.html,
        })));
      })
      .catch(() => setRagBlocks([]));
  }, []);

  // Computed builder HTML
  const builderHtml = useMemo(() => {
    if (aiHtml) return aiHtml;
    const blocksHtml = builderBlocks.map(b => b.html).join('');
    if (!builderBlocks.length) return templateHtml || '';
    if (!templateHtml) return blocksHtml;
    return injectIntoSlot(templateHtml, blocksHtml);
  }, [builderBlocks, templateHtml, aiHtml]);

  // Block management
  const addBlock = (name, html) => {
    setBuilderBlocks(prev => [...prev, { id: Date.now() + Math.random(), name, html }]);
    setAiHtml('');
  };
  const reorderBlock = (from, to) => {
    if (from === null || from === to) return;
    setBuilderBlocks(prev => {
      const a = [...prev];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
  };
  const removeBlock = (i) => setBuilderBlocks(prev => prev.filter((_, idx) => idx !== i));

  // Block Manager: "Añadir al canvas"
  const handleAddToCanvas = (block) => {
    addBlock(block.name, block.html);
    setBuilderStatus(`${block.name} añadido`);
    setTimeout(() => setBuilderStatus(''), 3000);
    setActiveTab('builder');
    setLeftTab('blocks');
  };

  // Block Manager: "Usar como base"
  const handleUseAsBase = (block) => {
    addBlock(block.name, block.html);
    setChatInput(`[base: ${block.name}] `);
    setBuilderStatus(`${block.name} como base`);
    setTimeout(() => setBuilderStatus(''), 3000);
    setActiveTab('builder');
    setLeftTab('chat');
  };

  // Re-ingest blocks
  const handleReingest = async () => {
    if (!window.confirm(t('blockStudio.reingestConfirm'))) return;
    setReingesting(true);
    setReingestMsg('');
    try {
      const res = await fetch(`${API_URL}/knowledge/ingest-email-blocks`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setReingestMsg(t('blockStudio.reingestDone'));
        const r = await fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' });
        const result = await r.json();
        setRagBlocks((result.blocks || []).map(b => ({
          id: b.id,
          name: b.title,
          category: TYPE_TO_CATEGORY[b.category] || 'Content',
          type: b.category,
          description: b.description || '',
          html: b.html,
        })));
      } else {
        setReingestMsg(t('blockStudio.reingestError'));
      }
    } catch {
      setReingestMsg(t('blockStudio.reingestError'));
    }
    setReingesting(false);
    setTimeout(() => setReingestMsg(''), 4000);
  };

  // Filtered blocks for Block Manager
  const filteredBlocks = useMemo(() => {
    const blocks = ragBlocks || [];
    return blocks.filter(b => {
      const matchCat = blockFilter === 'All' || b.category === blockFilter;
      const matchSearch = !blockSearch || b.name.toLowerCase().includes(blockSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [ragBlocks, blockFilter, blockSearch]);

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="block-studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/html-developer')}>
          {t('studio.backToAgent')}
        </button>
        <span className="studio-campaign-badge">{t('blockStudio.title')}</span>
        <div style={{ flex: 1 }} />
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        <button
          className={`studio-tab ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >{t('blockStudio.tabBuilder')}</button>
        <button
          className={`studio-tab ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
        >
          {t('blockStudio.tabBlocks')}
          {ragBlocks !== null && <span className="studio-tab-count">{ragBlocks.length}</span>}
        </button>
      </div>

      {/* Body */}
      <div className="studio-body">

        {/* ── BUILDER TAB ── */}
        {activeTab === 'builder' && (
          <div className="email-studio-split">
            <div className="email-builder-chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="email-left-panel-tabs">
                <button
                  className={`email-left-tab ${leftTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setLeftTab('blocks')}
                >{t('emailBlocks.tabBlocks')}</button>
                <button
                  className={`email-left-tab ${leftTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setLeftTab('chat')}
                >{t('emailBlocks.tabChat')}</button>
              </div>
              {leftTab === 'blocks' && <EmailBlocksPanel />}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: leftTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
                <AgentChatSwitcher
                  agent={agent}
                  selectedTicket={pipeline.selectedTicket}
                  pipelineData={pipeline.pipelineData}
                  currentSession={pipeline.currentSession}
                  completedSessions={pipeline.completedSessions}
                  agents={pipeline.agents}
                  onClearTicket={pipeline.clearTicket}
                  onHandoffRequest={pipeline.setHandoffSession}
                  externalInput={chatInput}
                  onExternalInputConsumed={() => setChatInput('')}
                  onHtmlGenerated={(html) => {
                    setAiHtml(mergeAiHtmlIntoTemplate(templateHtml, html));
                    setBuilderBlocks([]);
                    setPatchedBlock(null);
                    setBuilderStatus('Email generado');
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                  onHtmlPatched={(blockName, html) => {
                    setAiHtml(html);
                    setPatchedBlock(blockName);
                    setBuilderStatus(`${blockName} actualizado`);
                    setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                  }}
                  canvasBlocks={builderBlocks}
                  onHtmlBlock={(block) => {
                    addBlock(block.title, block.htmlSource);
                    setBuilderStatus(`${block.title} añadido`);
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                />
              </div>
            </div>
            <EmailBuilderPreview
              html={builderBlocks.length ? null : builderHtml}
              blocks={builderBlocks.length ? builderBlocks : null}
              templateHtml={templateHtml}
              onReorderBlocks={reorderBlock}
              onRemoveBlock={removeBlock}
              onBlockDrop={(block) => {
                addBlock(block.name, block.html);
                setBuilderStatus(`${block.name} añadido`);
                setTimeout(() => setBuilderStatus(''), 3000);
              }}
              patchedBlock={patchedBlock}
              statusMessage={builderStatus}
              onBlockClick={(blockName) => { setChatInput(`[bloque: ${blockName}] `); setLeftTab('chat'); }}
            />
          </div>
        )}

        {/* ── BLOCKS TAB ── */}
        {activeTab === 'blocks' && (
          <div className="block-manager-layout">
            {/* Left: grid */}
            <div className="block-manager-grid-panel">
              <div className="block-manager-toolbar">
                <input
                  className="block-manager-search"
                  type="text"
                  placeholder={`🔍 ${t('blockStudio.search')}`}
                  value={blockSearch}
                  onChange={e => setBlockSearch(e.target.value)}
                />
                <button
                  className="block-studio-reingest-btn"
                  onClick={handleReingest}
                  disabled={reingesting}
                >
                  {reingesting ? t('blockStudio.reingesting') : t('blockStudio.reingest')}
                </button>
                {reingestMsg && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{reingestMsg}</span>}
              </div>
              <div className="block-manager-filters">
                {BLOCK_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`block-manager-filter-chip ${blockFilter === cat ? 'active' : ''}`}
                    onClick={() => setBlockFilter(cat)}
                  >{cat}</button>
                ))}
              </div>
              <div className="block-manager-grid">
                {ragBlocks === null && <div className="block-manager-empty">{t('blockStudio.loading')}</div>}
                {ragBlocks !== null && filteredBlocks.length === 0 && (
                  <div className="block-manager-empty">{t('blockStudio.noResults')}</div>
                )}
                {filteredBlocks.map(block => (
                  <div
                    key={block.id}
                    className={`block-manager-card ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBlock(block)}
                  >
                    {block.html ? (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={block.html}
                        title={block.name}
                        className="block-manager-thumb"
                        tabIndex={-1}
                      />
                    ) : (
                      <div className="block-manager-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {block.type}
                      </div>
                    )}
                    <div className="block-manager-card-name" title={block.name}>{block.name}</div>
                    <div className="block-manager-card-cat">{block.category}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: action panel */}
            <div className="block-manager-action-panel">
              {!selectedBlock ? (
                <div className="block-manager-empty">{t('blockStudio.noBlockSelected')}</div>
              ) : (
                <>
                  <div className="block-manager-preview">
                    {selectedBlock.html ? (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={selectedBlock.html}
                        title={selectedBlock.name}
                        className="block-manager-preview-iframe"
                      />
                    ) : (
                      <div className="block-manager-empty">{selectedBlock.type}</div>
                    )}
                  </div>
                  <div className="block-manager-meta">
                    <div className="block-manager-meta-name">{selectedBlock.name}</div>
                    <div className="block-manager-meta-cat">{selectedBlock.category} · {selectedBlock.type}</div>
                    {selectedBlock.description && (
                      <div className="block-manager-meta-desc">{selectedBlock.description}</div>
                    )}
                  </div>
                  <div className="block-manager-actions">
                    <button
                      className="block-manager-action-btn"
                      onClick={() => handleAddToCanvas(selectedBlock)}
                    >
                      ➕ {t('blockStudio.addToCanvas')}
                      <div className="block-manager-action-hint">{t('blockStudio.addToCanvasHint')}</div>
                    </button>
                    <button
                      className="block-manager-action-btn secondary"
                      onClick={() => handleUseAsBase(selectedBlock)}
                    >
                      ✏️ {t('blockStudio.useAsBase')}
                      <div className="block-manager-action-hint">{t('blockStudio.useAsBaseHint')}</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
