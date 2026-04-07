import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import ContentChatPanel from '../components/agent-views/ContentChatPanel.jsx';
import ContentBriefSidebar from '../components/agent-views/ContentBriefSidebar.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';
import { substituteForPreview } from '../utils/emailMockSubstitute.js';
import AmpscriptSidebar from '../components/agent-views/AmpscriptSidebar.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'lucia';
const ALL_MARKETS = ['en', 'es', 'ar', 'ru'];
const AVAILABLE_TIERS = ['economy', 'economy_premium', 'business', 'first_class'];

const emptyVariant = () => ({
  subject:      { status: 'pending', value: null },
  preheader:    { status: 'pending', value: null },
  heroHeadline: { status: 'pending', value: null },
  bodyCopy:     { status: 'pending', value: null },
  cta:          { status: 'pending', value: null },
});

export default function ContentStudioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const ticketId = searchParams.get('ticketId');

  const [agent, setAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');

  // Email template state (from HTML Developer)
  const [projectEmails, setProjectEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  // Variants state (same logic as ContentAgentView)
  const [variants, setVariants] = useState({});
  const [activeVariant, setActiveVariant] = useState(null);
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);
  const [chatImages, setChatImages] = useState([]);
  const [ampVarValues, setAmpVarValues] = useState({});
  const [blockVarMap, setBlockVarMap] = useState({});
  const [chatPreload, setChatPreload] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(null);

  const pipeline = useAgentPipelineSession(AGENT_ID);

  // Load agent data on mount
  useEffect(() => {
    fetch(`${API_URL}/agents/${AGENT_ID}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgent(data); })
      .catch(() => {});
  }, []);

  // Pre-select ticket from URL param once tickets are loaded
  useEffect(() => {
    if (!ticketId || !pipeline.tickets.length || pipeline.selectedTicket) return;
    const ticket = pipeline.tickets.find(t => String(t.id) === ticketId);
    if (ticket) pipeline.selectTicket(ticket);
  }, [ticketId, pipeline.tickets, pipeline.selectedTicket]);

  // Load project emails + saved variables when ticket is selected
  useEffect(() => {
    const projectId = pipeline.selectedTicket?.project_id;
    if (!projectId) { setProjectEmails([]); setBlockVarMap({}); setAmpVarValues({}); return; }
    setEmailsLoading(true);

    Promise.all([
      fetch(`${API_URL}/projects/${projectId}/emails`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/projects/${projectId}/email-variables`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { variables: {} }),
    ]).then(([emailsData, varsData]) => {
      const emails = Array.isArray(emailsData) ? emailsData : [];
      setProjectEmails(emails);

      // Parse block→var map from HTML
      const html = (emails.find(e => e.status === 'approved') || emails[0])?.html_content || '';
      if (html) {
        const map = {};
        const parts = html.split(/(?=data-block-name=")/);
        parts.slice(1).forEach(part => {
          const nameMatch = part.match(/data-block-name="([^"]+)"/);
          if (!nameMatch) return;
          const blockName = nameMatch[1];
          const chunk = part.substring(0, 3000);
          const vars = [...chunk.matchAll(/%%=v\(@(\w+)\)=%%/g)].map(m => m[1]);
          if (vars.length) map[blockName] = [...new Set(vars)];
        });
        setBlockVarMap(map);
      }

      setAmpVarValues(varsData.variables || {});
      if (emails.length > 0) setActiveTab('template');
    }).catch(() => {}).finally(() => setEmailsLoading(false));
  }, [pipeline.selectedTicket?.project_id]);

  // Parse block names from HTML (data-block-name attributes)
  const emailBlocks = useMemo(() => {
    const email = projectEmails.find(e => e.status === 'approved') || projectEmails[0];
    if (!email?.html_content) return [];
    const matches = [...email.html_content.matchAll(/data-block-name="([^"]+)"/g)];
    return [...new Set(matches.map(m => m[1]))];
  }, [projectEmails]);

  const liveHtml = useMemo(() => {
    const base = (projectEmails.find(e => e.status === 'approved') || projectEmails[0])?.html_content || '';
    if (!base || Object.keys(ampVarValues).length === 0) return base;
    let result = base;
    for (const [key, value] of Object.entries(ampVarValues)) {
      const varName = key.startsWith('@') ? key.slice(1) : key;
      result = result.replace(new RegExp(`%%=v\\(@${varName}\\)=%%`, 'g'), value);
    }
    return result;
  }, [projectEmails, ampVarValues]);

  // Reset variants when ticket changes
  useEffect(() => {
    const raw = pipeline.selectedTicket?.project_markets
      || pipeline.selectedTicket?.metadata?.markets
      || ALL_MARKETS;
    const arr = Array.isArray(raw) ? raw : ALL_MARKETS;
    const validCodes = new Set(ALL_MARKETS);
    const resolved = arr.every(m => validCodes.has(m)) ? arr : ALL_MARKETS;
    setAvailableMarkets(resolved);
    setVariants({});
    setActiveVariant(null);
  }, [pipeline.selectedTicket?.id]);

  const handleBriefUpdate = useCallback(({ variant, block, status, value }) => {
    setVariants(prev => ({
      ...prev,
      [variant]: {
        ...(prev[variant] || emptyVariant()),
        [block]: { status, value },
      },
    }));
  }, []);

  const addVariant = useCallback((market, tier) => {
    const key = `${market}:${tier}`;
    setVariants(prev => prev[key] ? prev : { ...prev, [key]: emptyVariant() });
    setActiveVariant(key);
  }, []);

  const handleContentHandoff = useCallback(() => {
    pipeline.setHandoffSession({
      id: pipeline.selectedTicket?.id || 'content-brief',
      stage_order: pipeline.currentSession?.stage_order,
      variants,
      activeVariant,
    });
  }, [pipeline, variants, activeVariant]);

  const handleVarUpdate = useCallback((varName, varValue) => {
    setAmpVarValues(prev => ({ ...prev, [varName]: varValue }));
  }, []);

  const handleBlockClick = useCallback((blockName, vars) => {
    if (blockName === '__fill_all__') {
      const marketLabel = { en: 'English', es: 'Spanish', ar: 'Arabic', ru: 'Russian' }[vars.market] || vars.market;
      const tierLabel = { economy: 'Economy', economy_premium: 'Premium Economy', business: 'Business', first_class: 'First Class' }[vars.tier] || vars.tier;
      setChatPreload(`Fill all email variables for the ${tierLabel} ${marketLabel} variant. Use the campaign context from previous agents and the "welcome back" reactivation tone.`);
      setSelectedVariant(`${vars.market}:${vars.tier}`);
    } else {
      const varList = Array.isArray(vars) ? vars : [];
      const SKIP = ['hero_image_link_alias','body_link_alias','story1_alias','story2_alias','story3_alias','article_link_alias','unsub_link_alias','contactus_link_alias','privacy_link_alias','logo_link_alias','header_logo_alias','join_skw_alias'];
      const fillable = varList.filter(v => !SKIP.includes(v));
      if (!fillable.length) return;
      setChatPreload(`Generate content for ${blockName}: ${fillable.map(v => '@' + v).join(', ')}`);
    }
    setActiveTab('chat');
  }, []);

  const handleChatImage = useCallback(({ url, prompt }) => {
    const newImage = {
      id: `chat-img-${Date.now()}`,
      url, prompt,
      size: '1200x628',
      status: 'review',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      campaign: pipeline.selectedTicket?.project_name || 'Chat Generation',
      source: 'chat',
    };
    setChatImages(prev => [...prev, newImage]);
  }, [pipeline.selectedTicket?.project_name]);

  const emailForPreview = projectEmails.find(e => e.status === 'approved') || projectEmails[0];

  const tabs = [
    { id: 'chat',     label: t('studio.chat') },
    { id: 'template', label: t('studio.emailTemplate') || 'Email Template', count: projectEmails.length || null, highlight: projectEmails.length > 0 },
    { id: 'tickets',  label: t('tickets.tab'), count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
  ];

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/lucia')}>
          {t('studio.backToAgent')}
        </button>
        {pipeline.selectedTicket && (
          <span className="studio-campaign-badge">{pipeline.selectedTicket.project_name}</span>
        )}
        <span className="studio-status-chip studio-status-working">● {t('studio.working')}</span>
        <div className="studio-topbar-actions">
          <button className="studio-action-primary" onClick={handleContentHandoff}>
            {t('studio.sendToHtmlDev')}
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="studio-tabs-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`studio-tab ${activeTab === tab.id ? 'active' : ''}${tab.highlight ? ' studio-tab--highlight' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`studio-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
            )}
            {tab.highlight && activeTab !== tab.id && (
              <span className="studio-tab-ready-dot" title={t('studio.templateReady') || 'Template listo'} />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="studio-body">
        {activeTab === 'chat' && (
          <div className="content-studio-split">
            <ContentChatPanel
              agent={agent}
              ticket={pipeline.selectedTicket}
              completedSessions={pipeline.completedSessions}
              activeVariant={activeVariant}
              onBriefUpdate={handleBriefUpdate}
              onImageGenerated={handleChatImage}
              onVarUpdate={handleVarUpdate}
              externalInput={chatPreload}
              onExternalInputConsumed={() => setChatPreload('')}
            />
            {Object.keys(blockVarMap).length > 0 ? (
              <AmpscriptSidebar
                blockVarMap={blockVarMap}
                varValues={ampVarValues}
                onBlockClick={handleBlockClick}
                onHandoff={handleContentHandoff}
                canHandoff={Object.keys(ampVarValues).length > 0}
                selectedVariant={selectedVariant}
                onVariantChange={(m, tier) => setSelectedVariant(`${m}:${tier}`)}
                availableMarkets={availableMarkets}
                availableTiers={AVAILABLE_TIERS}
              />
            ) : (
              <ContentBriefSidebar
                variants={variants}
                activeVariant={activeVariant}
                availableMarkets={availableMarkets}
                availableTiers={AVAILABLE_TIERS}
                onAddVariant={addVariant}
                onSelectVariant={setActiveVariant}
                onBriefUpdate={handleBriefUpdate}
                onHandoff={handleContentHandoff}
                chatImages={chatImages}
              />
            )}
          </div>
        )}
        {activeTab === 'template' && (
          <div className="studio-full-panel content-template-panel">
            {emailsLoading && (
              <div className="empty-state">{t('emailBuilder.loading')}</div>
            )}
            {!emailsLoading && projectEmails.length === 0 && (
              <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('studio.noTemplateYet') || 'No hay template todavía'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 320 }}>
                  {t('studio.noTemplateHint') || 'El HTML Developer no ha guardado ningún template para este proyecto aún.'}
                </div>
              </div>
            )}
            {!emailsLoading && emailForPreview && (
              <div className="content-template-split">
                {/* Left: iframe preview */}
                <div className="content-template-preview">
                  <div className="content-template-preview-header">
                    <span className="content-template-label">
                      {t('studio.templatePreview') || 'Template listo para rellenar'}
                    </span>
                    <span className={`email-status-badge ${emailForPreview.status}`}>
                      ● {emailForPreview.status}
                    </span>
                  </div>
                  <div className="content-template-iframe-wrap">
                    <iframe
                      sandbox="allow-same-origin"
                      srcDoc={liveHtml || substituteForPreview(emailForPreview.html_content || '')}
                      title="Email template"
                      className="content-template-iframe"
                    />
                  </div>
                </div>

                {/* Right: blocks checklist */}
                <div className="content-template-checklist">
                  <div className="content-template-checklist-header">
                    <div className="content-template-checklist-title">
                      {t('studio.blocksToFill') || 'Bloques a rellenar'}
                    </div>
                    <div className="content-template-checklist-subtitle">
                      {emailBlocks.length > 0
                        ? (t('studio.blocksCount') || '{n} bloques identificados').replace('{n}', emailBlocks.length)
                        : (t('studio.noBlocksFound') || 'No se detectaron bloques con nombre')}
                    </div>
                  </div>

                  {emailBlocks.length > 0 ? (
                    <div className="content-template-block-list">
                      {emailBlocks.map((blockName, i) => {
                        // Detect if block likely needs an image or text
                        const needsImage = /hero|banner|image|img|foto|photo/i.test(blockName);
                        const needsText = !needsImage || /copy|text|body|headline|subject|cta|title/i.test(blockName);
                        return (
                          <div
                            key={i}
                            className="content-template-block-item"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleBlockClick(blockName, blockVarMap[blockName] || [])}
                          >
                            <div className="content-template-block-name">
                              <span className="content-template-block-index">{i + 1}</span>
                              {blockName}
                            </div>
                            <div className="content-template-block-needs">
                              {needsImage && (
                                <span className="content-template-need-badge image">🖼️ {t('studio.needsImage') || 'Imagen'}</span>
                              )}
                              {needsText && (
                                <span className="content-template-need-badge text">✍️ {t('studio.needsText') || 'Texto'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="content-template-block-list">
                      {/* Fallback: show generic content requirements */}
                      {['Subject Line', 'Preheader', 'Hero Headline', 'Body Copy', 'CTA Text'].map((name, i) => (
                        <div key={i} className="content-template-block-item">
                          <div className="content-template-block-name">
                            <span className="content-template-block-index">{i + 1}</span>
                            {name}
                          </div>
                          <div className="content-template-block-needs">
                            <span className="content-template-need-badge text">✍️ {t('studio.needsText') || 'Texto'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="content-template-checklist-footer">
                    <button
                      className="studio-action-primary"
                      style={{ width: '100%' }}
                      onClick={() => setActiveTab('chat')}
                    >
                      {t('studio.goToChat') || 'Empezar a rellenar →'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="studio-full-panel">
            <AgentTicketsPanel
              tickets={pipeline.tickets}
              selectedTicket={pipeline.selectedTicket}
              onSelectTicket={pipeline.selectTicket}
              onClearTicket={pipeline.clearTicket}
              agentId={AGENT_ID}
            />
          </div>
        )}
      </div>

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
    </div>
  );
}
