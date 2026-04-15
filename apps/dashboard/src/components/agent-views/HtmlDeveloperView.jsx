import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { htmlDeveloperData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import { AgentTabIcons, HtmlDevIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import EmailBuilderPreview from '../EmailBuilderPreview.jsx';
import EmailBlocksPanel from '../EmailBlocksPanel.jsx';
import { injectIntoSlot, mergeAiHtmlIntoTemplate, fetchEmailTemplate } from '../../utils/emailTemplate.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Map RAG block type to display category
const TYPE_TO_CATEGORY = {
  header: 'Header',
  preheader: 'Header',
  'section-heading': 'Header',
  hero: 'Hero',
  'body-copy': 'Content',
  'product-cards': 'Content',
  'partner-module': 'Content',
  'info-card': 'Content',
  cta: 'CTA',
  footer: 'Footer',
  terms: 'Footer',
};

const BLOCK_CATEGORIES = ['All', 'Header', 'Hero', 'Content', 'CTA', 'Footer'];

export default function HtmlDeveloperView({ agent, activeTab: activeTabProp, onTabChange }) {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('templates');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSource, setShowSource] = useState(false);
  const [blockFilter, setBlockFilter] = useState('All');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [ragBlocks, setRagBlocks] = useState(null); // null = loading
  const [builderBlocks, setBuilderBlocks] = useState([]); // [{id, name, html}]
  const [aiHtml, setAiHtml] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [leftTab, setLeftTab] = useState('chat'); // 'chat' | 'blocks'
  const data = htmlDeveloperData;
  const pipeline = useAgentPipelineSession(agent.id);

  useEffect(() => {
    fetchEmailTemplate().then(html => { if (html) setTemplateHtml(html); });
  }, []);

  const builderHtml = useMemo(() => {
    if (aiHtml) return aiHtml;
    const blocksHtml = builderBlocks.map(b => b.html).join('');
    if (!builderBlocks.length) return templateHtml || '';
    if (!templateHtml) return blocksHtml;
    return injectIntoSlot(templateHtml, blocksHtml);
  }, [builderBlocks, templateHtml, aiHtml]);

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const addBlock = (name, html, insertAfterName) => {
    setBuilderBlocks(prev => {
      const newBlock = { id: Date.now() + Math.random(), name, html };
      if (insertAfterName) {
        const idx = prev.findIndex(b => b.name.toLowerCase() === insertAfterName.toLowerCase());
        if (idx >= 0) {
          const arr = [...prev];
          arr.splice(idx + 1, 0, newBlock);
          return arr;
        }
      }
      return [...prev, newBlock];
    });
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

  useEffect(() => {
    fetch(`${API_URL}/knowledge/email-blocks`, { credentials: 'include' })
      .then((r) => r.json())
      .then((result) => {
        if (result.blocks && result.blocks.length > 0) {
          setRagBlocks(result.blocks.map((b) => ({
            id: b.id,
            name: b.title,
            category: TYPE_TO_CATEGORY[b.category] || 'Content',
            type: b.category,
            brand: 'emirates',
            description: b.description,
            html: b.html,
          })));
        } else {
          setRagBlocks([]);
        }
      })
      .catch(() => setRagBlocks([]));
  }, []);

  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    navigate(`/app/workspace/agent/html-developer/studio?ticketId=${ticket.id}`);
  };

  const blocks = ragBlocks !== null ? ragBlocks : data.blocks;
  const blocksLoading = ragBlocks === null;

  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: AgentTabIcons.templates },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'blocks', label: 'Block Library', icon: AgentTabIcons.blocks, count: blocksLoading ? null : blocks.length },
    { id: 'builder', label: t('studio.emailStudio'), icon: HtmlDevIcons.email, isStudio: true },
    { id: 'block-studio', label: t('blockStudio.title'), icon: HtmlDevIcons.block, isStudio: true, studioPath: 'block-studio' },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const filteredBlocks = blockFilter === 'All'
    ? blocks
    : blocks.filter((b) => b.category === blockFilter);

  const recentEvents = agent.recent_events || [];

  // ── Block Detail View ──
  if (selectedBlock) {
    return (
      <>
        <button className="html-dev-back-btn" onClick={() => { setSelectedBlock(null); setShowSource(false); }}>
          ← {t('htmlDev.backToBlocks') || 'Back to Blocks'}
        </button>
        <div className="html-dev-detail">
          <div className="html-dev-detail-preview">
            {selectedBlock.html ? (
              <iframe sandbox="allow-same-origin" srcDoc={selectedBlock.html} title={selectedBlock.name} className="html-dev-iframe-full" />
            ) : (
              <div className="empty-state" style={{ padding: '40px' }}>{t('htmlDev.noPreview') || 'No preview available'}</div>
            )}
          </div>
          <div className="html-dev-detail-sidebar card">
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{selectedBlock.name}</h3>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">{t('htmlDev.type') || 'Type'}</span>
              <span>{selectedBlock.type}</span>
            </div>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">Brand</span>
              <span>{selectedBlock.brand}</span>
            </div>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">Category</span>
              <span>{selectedBlock.category}</span>
            </div>
            {selectedBlock.description && (
              <div className="html-dev-meta" style={{ flexDirection: 'column', gap: '4px' }}>
                <span className="html-dev-meta-label">Description</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{selectedBlock.description}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className={`html-dev-action-btn ${showSource ? 'active' : ''}`} onClick={() => setShowSource(!showSource)}>
                {showSource ? (t('htmlDev.hideSource') || 'Hide Source') : (t('htmlDev.viewSource') || 'View Source')}
              </button>
              <button className="html-dev-action-btn" onClick={() => navigator.clipboard.writeText(selectedBlock.html)}>
                {t('htmlDev.copy') || 'Copy'}
              </button>
            </div>
          </div>
        </div>
        {showSource && (
          <div className="card html-dev-source-viewer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem' }}>HTML Source</h4>
              <button className="html-dev-action-btn" onClick={() => navigator.clipboard.writeText(selectedBlock.html)}>
                {t('htmlDev.copy') || 'Copy'}
              </button>
            </div>
            <pre className="html-dev-code">{selectedBlock.html}</pre>
          </div>
        )}
      </>
    );
  }

  // ── Template Detail View ──
  if (selectedTemplate) {
    return (
      <>
        <button
          className="html-dev-back-btn"
          onClick={() => { setSelectedTemplate(null); setShowSource(false); }}
        >
          ← {t('htmlDev.backToTemplates') || 'Back to Templates'}
        </button>

        <div className="html-dev-detail">
          <div className="html-dev-detail-preview">
            <iframe
              sandbox="allow-same-origin"
              srcDoc={selectedTemplate.html}
              title={selectedTemplate.name}
              className="html-dev-iframe-full"
            />
          </div>
          <div className="html-dev-detail-sidebar card">
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>{selectedTemplate.name}</h3>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">{t('htmlDev.type') || 'Type'}</span>
              <span>{selectedTemplate.type}</span>
            </div>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">{t('htmlDev.lastEdited') || 'Last edited'}</span>
              <span>{selectedTemplate.lastEdited}</span>
            </div>
            <div className="html-dev-meta">
              <span className="html-dev-meta-label">{t('htmlDev.usedIn') || 'Used in'}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {selectedTemplate.usedIn.map((c, i) => (
                  <span key={i} className="html-dev-campaign-tag">{c}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                className={`html-dev-action-btn ${showSource ? 'active' : ''}`}
                onClick={() => setShowSource(!showSource)}
              >
                {showSource ? (t('htmlDev.hideSource') || 'Hide Source') : (t('htmlDev.viewSource') || 'View Source')}
              </button>
              <button className="html-dev-action-btn primary">
                {t('htmlDev.edit') || 'Edit'}
              </button>
            </div>
          </div>
        </div>

        {showSource && (
          <div className="card html-dev-source-viewer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem' }}>HTML Source</h4>
              <button
                className="html-dev-action-btn"
                onClick={() => { navigator.clipboard.writeText(selectedTemplate.html); }}
              >
                {t('htmlDev.copy') || 'Copy'}
              </button>
            </div>
            <pre className="html-dev-code">{selectedTemplate.html}</pre>
          </div>
        )}
      </>
    );
  }

  // ── Main View ──
  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard label={t('htmlDev.templatesCreated') || 'Templates Created'} value={data.kpis.templatesCreated} color="#D71920" />
        <KpiCard label={t('htmlDev.blocksLibrary') || 'Blocks Library'} value={blocksLoading ? '...' : blocks.length} color="#6366f1" />
        <KpiCard label={t('htmlDev.lastDeployed') || 'Last Deployed'} value={data.kpis.lastDeployed} color="#10b981" />
      </div>

      <ActiveTicketIndicator
        selectedTicket={pipeline.selectedTicket}
        onClear={pipeline.clearTicket}
        studioLabel={t('studio.openEmailStudio')}
        onOpenStudio={() => navigate(`/app/workspace/agent/html-developer/studio${pipeline.selectedTicket ? `?ticketId=${pipeline.selectedTicket.id}` : ''}`)}
      />

      {/* Tabs */}
      <div className="agent-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => {
              if (tab.isStudio) {
                const ticketId = pipeline.selectedTicket?.id;
                const path = tab.studioPath || 'studio';
                const query = ticketId && path === 'studio' ? `?ticketId=${ticketId}` : '';
                navigate(`/app/workspace/agent/html-developer/${path}${query}`);
              } else {
                setActiveTab(tab.id);
              }
            }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count != null && <span className={`agent-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <section className="agent-tab-content">
        {activeTab === 'templates' && (
          <div className="html-dev-grid">
            {data.templates.map((tpl) => (
              <div
                key={tpl.id}
                className="card html-dev-card animate-fade-in"
                onClick={() => setSelectedTemplate(tpl)}
              >
                <div className="html-dev-thumb-wrapper">
                  <iframe
                    sandbox="allow-same-origin"
                    srcDoc={tpl.html}
                    title={tpl.name}
                    className="html-dev-iframe-thumb"
                    tabIndex={-1}
                  />
                </div>
                <div className="html-dev-card-body">
                  <h4 className="html-dev-card-title">{tpl.name}</h4>
                  <div className="html-dev-card-meta">
                    <span>{HtmlDevIcons.email} {tpl.type}</span>
                    <span>{t('htmlDev.lastEdited') || 'Last edited'}: {tpl.lastEdited}</span>
                    <span>{t('htmlDev.usedIn') || 'Used in'}: {tpl.usedIn.length} {t('htmlDev.campaigns') || 'campaigns'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="html-dev-action-btn primary" onClick={(e) => { e.stopPropagation(); setSelectedTemplate(tpl); }}>
                      {t('htmlDev.edit') || 'Edit'}
                    </button>
                    <button className="html-dev-action-btn" onClick={(e) => e.stopPropagation()}>
                      {t('htmlDev.deploy') || 'Deploy'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'blocks' && (
          <>
            <div className="html-dev-filter-bar">
              {BLOCK_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`html-dev-filter-chip ${blockFilter === cat ? 'active' : ''}`}
                  onClick={() => setBlockFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {blocksLoading && (
              <div className="empty-state" style={{ padding: '40px' }}>Loading blocks from knowledge base...</div>
            )}

            {!blocksLoading && filteredBlocks.length === 0 && (
              <div className="empty-state" style={{ padding: '40px' }}>
                {ragBlocks !== null && ragBlocks.length === 0
                  ? 'No email blocks indexed yet. Run POST /api/knowledge/ingest-email-blocks to index them.'
                  : `No blocks in category "${blockFilter}"`}
              </div>
            )}

            {!blocksLoading && filteredBlocks.length > 0 && (
              <div className="html-dev-grid">
                {filteredBlocks.map((block) => (
                  <div key={block.id} className="card html-dev-card animate-fade-in" onClick={() => setSelectedBlock(block)} style={{ cursor: 'pointer' }}>
                    <div className="html-dev-thumb-wrapper">
                      {block.html ? (
                        <iframe
                          sandbox="allow-same-origin"
                          srcDoc={block.html}
                          title={block.name}
                          className="html-dev-iframe-thumb"
                          tabIndex={-1}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {block.type}
                        </div>
                      )}
                    </div>
                    <div className="html-dev-card-body">
                      <h4 className="html-dev-card-title">{block.name}</h4>
                      <div className="html-dev-card-meta">
                        <span>{HtmlDevIcons.block} {block.category}</span>
                        {block.brand && <span>{block.brand}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="html-dev-action-btn" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(block.html); }}>
                          {t('htmlDev.copy') || 'Copy'}
                        </button>
                        <button className="html-dev-action-btn primary" onClick={(e) => { e.stopPropagation(); setSelectedBlock(block); }}>
                          {t('htmlDev.view') || 'View'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'builder' && (
          <div className="email-builder-split">
            <div className="email-builder-chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="email-left-panel-tabs">
                <button
                  className={`email-left-tab ${leftTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setLeftTab('chat')}
                >{t('emailBlocks.tabChat')}</button>
                <button
                  className={`email-left-tab ${leftTab === 'blocks' ? 'active' : ''}`}
                  onClick={() => setLeftTab('blocks')}
                >{t('emailBlocks.tabBlocks')}</button>
              </div>
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
                    addBlock(block.title, block.htmlSource, block.insertAfter);
                    setBuilderStatus(`${block.title} añadido`);
                    setTimeout(() => setBuilderStatus(''), 3000);
                  }}
                />
                {builderBlocks.length > 0 && (
                  <div className="email-block-order-panel">
                    <div className="email-block-order-header">
                      <span className="email-block-order-title">Estructura ({builderBlocks.length})</span>
                    </div>
                    {builderBlocks.map((block, i) => (
                      <div
                        key={block.id}
                        className={`email-block-order-item${dragOverIndex === i ? ' drag-over' : ''}`}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={() => { reorderBlock(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                      >
                        <span className="email-block-order-drag">⠿</span>
                        <span className="email-block-order-name" title={block.name}>{block.name}</span>
                        <button className="email-block-order-remove" onClick={() => removeBlock(i)} title="Eliminar">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {leftTab === 'blocks' && <EmailBlocksPanel />}
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
              onBlockClick={(blockName) => setChatInput(`[bloque: ${blockName}] `)}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <AgentChatSwitcher
            agent={agent}
            selectedTicket={pipeline.selectedTicket}
            pipelineData={pipeline.pipelineData}
            currentSession={pipeline.currentSession}
            completedSessions={pipeline.completedSessions}
            agents={pipeline.agents}
            onClearTicket={pipeline.clearTicket}
            onHandoffRequest={pipeline.setHandoffSession}
          />
        )}

        {activeTab === 'tickets' && (
          <AgentTicketsPanel
            tickets={pipeline.tickets}
            selectedTicket={pipeline.selectedTicket}
            onSelectTicket={handleWorkOnTicket}
            completedTickets={pipeline.completedTickets}
            onReopenComplete={pipeline.onReopenComplete}
          />
        )}

        {activeTab === 'activity' && (
          <div className="agent-activity-feed">
            {recentEvents.length > 0 ? (
              recentEvents.map((event, i) => (
                <div key={event.id || i} className="activity-item animate-fade-in">
                  <div className="activity-time">
                    {event.timestamp ? new Date(event.timestamp).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </div>
                  <div className={`activity-dot ${event.event_type === 'task_complete' ? 'success' : event.event_type === 'error' ? 'warning' : 'info'}`}></div>
                  <div className="activity-message">
                    {typeof event.content === 'string' ? event.content : event.content?.message || event.content?.summary || event.event_type}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">{t('agentDetail.noActivity')}</div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <AgentSettingsPanel agentId={agent.id} />
        )}
      </section>

      {pipeline.handoffSession && (
        <HandoffModal
          projectId={pipeline.selectedTicket?.project_id}
          session={pipeline.handoffSession}
          stages={pipeline.stages}
          agents={pipeline.agents}
          onClose={() => pipeline.setHandoffSession(null)}
          onComplete={pipeline.onHandoffComplete}
        />
      )}
    </>
  );
}
