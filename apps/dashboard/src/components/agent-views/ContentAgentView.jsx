import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { contentAgentData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, LangIcon, ContentTypeIcons, ContentIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import ContentChatPanel from './ContentChatPanel.jsx';
import ContentBriefSidebar from './ContentBriefSidebar.jsx';
import { Palette, Sparkles, Hourglass, ImageIcon, Ruler, Target, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const typeLabels = {
  'email-subject': 'Email Subject',
  'email-body': 'Email Body',
  'push': 'Push',
  'sms': 'SMS',
};

const langFlags = {
  en: '🇬🇧',
  es: '🇪🇸',
  ar: '🇦🇪',
};

export default function ContentAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('portfolio');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [typeFilter, setTypeFilter] = useState('all');
  const data = contentAgentData;

  const pipeline = useAgentPipelineSession(agent.id);

  const ALL_MARKETS = ['en', 'es', 'ar', 'ru'];
  const AVAILABLE_TIERS = ['economy', 'economy_premium', 'business', 'first_class'];

  const emptyVariant = () => ({
    subject:      { status: 'pending', value: null },
    preheader:    { status: 'pending', value: null },
    heroHeadline: { status: 'pending', value: null },
    bodyCopy:     { status: 'pending', value: null },
    cta:          { status: 'pending', value: null },
  });

  const buildVariantKey = (market, tier) => `${market}:${tier}`;

  const [variants, setVariants] = useState({});
  const [activeVariant, setActiveVariant] = useState(null);
  const [availableMarkets, setAvailableMarkets] = useState(ALL_MARKETS);

  // Reset variants when active ticket changes
  useEffect(() => {
    const raw = pipeline.selectedTicket?.project_markets
      || pipeline.selectedTicket?.metadata?.markets
      || ALL_MARKETS;
    const arr = Array.isArray(raw) ? raw : ALL_MARKETS;
    // If markets are generic strings like ["Global"] rather than lang codes, fall back to ALL_MARKETS
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
    const key = buildVariantKey(market, tier);
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

  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1200x628');
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState(data.generatedImages || []);
  const [genError, setGenError] = useState(null);
  const promptRef = useRef(null);

  // Images generated inline from chat (also pushed to Image Studio)
  const [chatImages, setChatImages] = useState([]);
  const handleChatImage = useCallback(({ url, prompt }) => {
    const newImage = {
      id: `chat-img-${Date.now()}`,
      url,
      prompt,
      size: '1200x628',
      status: 'review',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      campaign: pipeline.selectedTicket?.project_name || 'Chat Generation',
      source: 'chat',
    };
    setChatImages(prev => [...prev, newImage]);
    setGeneratedImages(prev => [newImage, ...prev]);
  }, [pipeline.selectedTicket?.project_name]);

  const tabs = [
    { id: 'portfolio', label: 'Content Library', icon: AgentTabIcons.portfolio },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'images', label: 'Image Studio', icon: AgentTabIcons.images, count: generatedImages.length },
    { id: 'ab', label: 'A/B Testing', icon: AgentTabIcons.ab },
    { id: 'quality', label: 'Quality Score', icon: AgentTabIcons.quality, count: data.quality.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  async function handleGenerateImage() {
    if (!imagePrompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`${API_URL}/agents/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt.trim(), size: imageSize }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      const newImage = {
        id: `img-${Date.now()}`,
        prompt: imagePrompt.trim(),
        size: imageSize,
        status: 'review',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        url: result.url || null,
        campaign: 'Manual Generation',
      };
      setGeneratedImages((prev) => [newImage, ...prev]);
      setImagePrompt('');
      promptRef.current?.focus();
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const types = ['all', 'email-subject', 'email-body', 'push', 'sms'];
  const filteredPortfolio = typeFilter === 'all' ? data.portfolio : data.portfolio.filter(p => p.type === typeFilter);

  function getScoreColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#6366f1';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard label={t('contentAgent.pendingReview') || 'Pending Review'} value={data.kpis.pendingReview} color="#f59e0b" />
        <KpiCard label={t('contentAgent.createdToday') || 'Created Today'} value={data.kpis.createdToday} color="#6366f1" />
        <KpiCard label={t('contentAgent.approvalRate') || 'Approval Rate'} value={`${data.kpis.approvalRate}%`} color="#10b981" />
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
        {/* Portfolio Tab — Gallery feed */}
        {activeTab === 'portfolio' && (
          <div>
            {/* Type filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {types.map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTypeFilter(tp)}
                  style={{
                    padding: '4px 14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    border: 'none',
                    background: typeFilter === tp ? 'rgba(99,102,241,0.2)' : 'rgba(148,163,184,0.1)',
                    color: typeFilter === tp ? '#818cf8' : '#94a3b8',
                  }}
                >
                  {tp === 'all' ? (t('contentAgent.allTypes') || 'All') : (typeLabels[tp] || tp)}
                </button>
              ))}
            </div>

            {/* Cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {filteredPortfolio.map((piece) => (
                <div key={piece.id} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{piece.title}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem' }}>{langFlags[piece.language] || piece.language}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                          background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                        }}>
                          {typeLabels[piece.type] || piece.type}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={piece.status === 'approved' ? 'approved' : piece.status === 'rejected' ? 'rejected' : piece.status === 'review' ? 'warning' : 'draft'} label={piece.status.charAt(0).toUpperCase() + piece.status.slice(1)} />
                  </div>

                  {/* Preview */}
                  <div style={{
                    padding: '12px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: '1.5',
                    background: 'rgba(148,163,184,0.06)', color: 'var(--text-secondary, #cbd5e1)',
                    fontStyle: 'italic', minHeight: '48px',
                  }}>
                    "{piece.preview}"
                  </div>

                  {/* Score */}
                  {piece.score != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score:</span>
                      <span style={{
                        fontWeight: 700, fontSize: '0.9rem', color: getScoreColor(piece.score),
                      }}>
                        {piece.score}/100
                      </span>
                      <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(148,163,184,0.1)' }}>
                        <div style={{ width: `${piece.score}%`, height: '100%', borderRadius: '2px', background: getScoreColor(piece.score), transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Image Generation Tab */}
        {activeTab === 'images' && (
          <div>
            {/* Prompt input area */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '12px' }}>
                <Palette size={14} /> {t('contentAgent.generateImage') || 'Generate Image'}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <textarea
                  ref={promptRef}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateImage(); } }}
                  placeholder={'Describe the image you want to generate. All images will be created following Emirates brand guidelines (colors, tone, imagery standards)...'}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', resize: 'vertical', minHeight: '60px',
                    background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)',
                    color: 'var(--text-primary, #e2e8f0)', fontSize: '0.85rem', fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Size:</label>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem',
                      background: '#1e293b', border: '1px solid rgba(148,163,184,0.25)',
                      color: '#e2e8f0', cursor: 'pointer',
                    }}
                  >
                    <option value="1200x628">1200×628 (Email Hero)</option>
                    <option value="600x600">600×600 (Square)</option>
                    <option value="600x200">600×200 (Header)</option>
                    <option value="1080x1080">1080×1080 (Social)</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerateImage}
                  disabled={!imagePrompt.trim() || generating}
                  style={{
                    padding: '8px 24px', borderRadius: '8px', border: 'none', cursor: generating ? 'wait' : 'pointer',
                    fontWeight: 700, fontSize: '0.85rem',
                    background: imagePrompt.trim() && !generating ? '#6366f1' : 'rgba(148,163,184,0.15)',
                    color: imagePrompt.trim() && !generating ? '#fff' : '#94a3b8',
                    transition: 'all 0.2s',
                  }}
                >
                  {generating ? <><Hourglass size={14} /> Generating...</> : <><Sparkles size={14} /> Generate</>}
                </button>
              </div>
              {genError && (
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  {genError}
                </div>
              )}
            </div>

            {/* Generated images history */}
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-muted)' }}>
              {t('contentAgent.generationHistory') || 'Generation History'} ({generatedImages.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {generatedImages.map((img) => (
                <div key={img.id} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {/* Image thumbnail */}
                  <div style={{
                    width: '120px', height: '80px', borderRadius: '8px', flexShrink: 0,
                    background: img.url
                      ? `url(${img.url}) center/cover no-repeat`
                      : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(245,158,11,0.2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', color: '#94a3b8',
                    boxShadow: img.url ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                    border: img.url ? '1px solid rgba(148,163,184,0.15)' : 'none',
                  }}>
                    {!img.url && <ImageIcon size={24} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: '1.4' }}>{img.prompt}</div>
                      <StatusBadge status={img.status === 'approved' ? 'approved' : img.status === 'rejected' ? 'rejected' : 'review'} label={img.status} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>{ContentIcons.ruler} {img.size}</span>
                      <span>{ContentIcons.target} {img.campaign}</span>
                      <span>{ContentIcons.clock} {img.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
              {generatedImages.length === 0 && (
                <div className="empty-state">{t('contentAgent.noImages') || 'No images generated yet'}</div>
              )}
            </div>
          </div>
        )}

        {/* A/B Tests Tab */}
        {activeTab === 'ab' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.abTests.map((test) => (
              <div key={test.id} className="card animate-fade-in" style={{ padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>{test.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Variant A */}
                  <div style={{
                    padding: '14px', borderRadius: '8px',
                    border: test.winner === 'A' ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.15)',
                    background: test.winner === 'A' ? 'rgba(16,185,129,0.06)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Variant A</span>
                      {test.winner === 'A' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Winner</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontStyle: 'italic' }}>"{test.variantA.text}"</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: test.winner === 'A' ? '#10b981' : '#94a3b8' }}>
                      {test.variantA.openRate ? `${test.variantA.openRate}% open` : `${test.variantA.ctr}% CTR`}
                    </div>
                  </div>
                  {/* Variant B */}
                  <div style={{
                    padding: '14px', borderRadius: '8px',
                    border: test.winner === 'B' ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.15)',
                    background: test.winner === 'B' ? 'rgba(16,185,129,0.06)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Variant B</span>
                      {test.winner === 'B' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Winner</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontStyle: 'italic' }}>"{test.variantB.text}"</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: test.winner === 'B' ? '#10b981' : '#94a3b8' }}>
                      {test.variantB.openRate ? `${test.variantB.openRate}% open` : `${test.variantB.ctr}% CTR`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quality Tab */}
        {activeTab === 'quality' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.quality.map((item, i) => (
              <div key={i} className="card animate-fade-in" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.piece}</div>
                  <span style={{
                    fontWeight: 700, fontSize: '0.95rem', padding: '2px 12px', borderRadius: '12px',
                    background: `${getScoreColor(item.score)}18`, color: getScoreColor(item.score),
                  }}>
                    {item.score}/100
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '8px' }}>
                  {item.feedback}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Feedback from: <span style={{ fontWeight: 600 }}>{item.from}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="content-chat-split">
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
      </section >

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
