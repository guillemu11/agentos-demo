import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { htmlDeveloperData } from '../../data/agentViewMocks.js';
import AgentChat from '../AgentChat.jsx';
import KpiCard from './shared/KpiCard.jsx';
import { AgentTabIcons, HtmlDevIcons } from '../icons.jsx';

const BLOCK_CATEGORIES = ['All', 'Header', 'Hero', 'Content', 'CTA', 'Footer'];

export default function HtmlDeveloperView({ agent }) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSource, setShowSource] = useState(false);
  const [blockFilter, setBlockFilter] = useState('All');
  const data = htmlDeveloperData;

  const tabs = [
    { id: 'templates', label: 'Email Templates', icon: AgentTabIcons.templates },
    { id: 'blocks', label: 'Block Library', icon: AgentTabIcons.blocks, count: data.blocks.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
  ];

  const filteredBlocks = blockFilter === 'All'
    ? data.blocks
    : data.blocks.filter((b) => b.category === blockFilter);

  const recentEvents = agent.recent_events || [];

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
        <KpiCard label={t('htmlDev.blocksLibrary') || 'Blocks Library'} value={data.kpis.blocksLibrary} color="#6366f1" />
        <KpiCard label={t('htmlDev.lastDeployed') || 'Last Deployed'} value={data.kpis.lastDeployed} color="#10b981" />
      </div>

      {/* Tabs */}
      <div className="agent-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count != null && <span className="agent-tab-count">{tab.count}</span>}
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
            <div className="html-dev-grid">
              {filteredBlocks.map((block) => (
                <div key={block.id} className="card html-dev-card animate-fade-in">
                  <div className="html-dev-thumb-wrapper">
                    <iframe
                      sandbox="allow-same-origin"
                      srcDoc={block.html}
                      title={block.name}
                      className="html-dev-iframe-thumb"
                      tabIndex={-1}
                    />
                  </div>
                  <div className="html-dev-card-body">
                    <h4 className="html-dev-card-title">{block.name}</h4>
                    <div className="html-dev-card-meta">
                      <span>{HtmlDevIcons.block} {block.category}</span>
                      <span>{t('htmlDev.usedIn') || 'Used in'}: {block.usedInCount} templates</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button className="html-dev-action-btn" onClick={() => navigator.clipboard.writeText(block.html)}>
                        {t('htmlDev.copy') || 'Copy'}
                      </button>
                      <button className="html-dev-action-btn primary">
                        {t('htmlDev.edit') || 'Edit'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'chat' && (
          <AgentChat agentId={agent.id} agentName={agent.name} agentAvatar={agent.avatar} />
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
      </section>
    </>
  );
}
