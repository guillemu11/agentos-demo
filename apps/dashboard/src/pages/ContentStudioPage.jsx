import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAgentPipelineSession } from '../hooks/useAgentPipelineSession.js';
import ContentChatPanel from '../components/agent-views/ContentChatPanel.jsx';
import ContentBriefSidebar from '../components/agent-views/ContentBriefSidebar.jsx';
import AgentTicketsPanel from '../components/agent-views/shared/AgentTicketsPanel.jsx';
import HandoffModal from '../components/HandoffModal.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AGENT_ID = 'content-agent';
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

  // Variants state (same logic as ContentAgentView)
  const [variants, setVariants] = useState({});
  const [activeVariant, setActiveVariant] = useState(null);
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);
  const [chatImages, setChatImages] = useState([]);

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

  const tabs = [
    { id: 'chat',    label: t('studio.chat') },
    { id: 'tickets', label: t('tickets.tab'), count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'images',  label: 'Image Studio' },
    { id: 'ab',      label: 'A/B Testing' },
    { id: 'quality', label: 'Quality Score' },
  ];

  if (!agent) return <div className="studio-page studio-loading">Loading...</div>;

  return (
    <div className="studio-page">
      {/* Top bar */}
      <div className="studio-topbar">
        <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/content-agent')}>
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
            className={`studio-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`studio-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
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
            />
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
        {(activeTab === 'images' || activeTab === 'ab' || activeTab === 'quality') && (
          <div className="studio-full-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 12 }}>Vuelve al agente para acceder a este panel.</p>
            <button className="studio-back-btn" onClick={() => navigate('/app/workspace/agent/content-agent')}>
              {t('studio.backToAgent')}
            </button>
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
