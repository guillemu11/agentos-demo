import React, { useState, useEffect } from 'react';
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

export default function HtmlDeveloperView({ agent }) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSource, setShowSource] = useState(false);
  const [blockFilter, setBlockFilter] = useState('All');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [ragBlocks, setRagBlocks] = useState(null); // null = loading
  const [builderHtml, setBuilderHtml] = useState('');
  const [patchedBlock, setPatchedBlock] = useState(null);
  const [builderStatus, setBuilderStatus] = useState('');
  const [chatInput, setChatInput] = useState('');
  const data = htmlDeveloperData;
  const pipeline = useAgentPipelineSession(agent.id);

  useEffect(() => {
    fetch(`${API_URL}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'emirates email block', namespace: 'email-blocks', topK: 20 }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.results && result.results.length > 0) {
          setRagBlocks(result.results.map((r) => ({
            id: r.metadata?.block_id || r.id,
            name: r.title || r.metadata?.block_id,
            category: TYPE_TO_CATEGORY[r.metadata?.type] || 'Content',
            type: r.metadata?.type,
            brand: r.metadata?.brand,
            description: r.metadata?.description || r.content_preview,
            html: r.htmlSource || '',
            score: r.score,
          })));
        } else {
          setRagBlocks([]);
        }
      })
      .catch(() => setRagBlocks([]));
  }, []);

  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  const blocks = ragBlocks !== null ? ragBlocks : data.blocks;
  const blocksLoading = ragBlocks === null;

  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: AgentTabIcons.templates },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'blocks', label: 'Block Library', icon: AgentTabIcons.blocks, count: blocksLoading ? null : blocks.length },
    { id: 'builder', label: t('emailBuilder.tabBuilder') || 'Email Builder', icon: '✉️' },
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

      <ActiveTicketIndicator selectedTicket={pipeline.selectedTicket} onClear={pipeline.clearTicket} />

      {/* Tabs */}
      <div className="agent-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
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
            <div className="email-builder-chat-panel">
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
                  setBuilderHtml(html);
                  setPatchedBlock(null);
                  setBuilderStatus('Email generado');
                  setTimeout(() => setBuilderStatus(''), 3000);
                }}
                onHtmlPatched={(blockName, html) => {
                  setBuilderHtml(html);
                  setPatchedBlock(blockName);
                  setBuilderStatus(`${blockName} actualizado`);
                  setTimeout(() => { setPatchedBlock(null); setBuilderStatus(''); }, 2000);
                }}
              />
            </div>
            <EmailBuilderPreview
              html={builderHtml}
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
