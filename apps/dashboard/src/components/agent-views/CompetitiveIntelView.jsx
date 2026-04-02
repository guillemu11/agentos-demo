import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { competitiveIntelData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import DataTable from './shared/DataTable.jsx';
import { AgentTabIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import { Eye, Mail, Globe, MessageSquare as SocialIcon, FileText, ArrowUpRight, Shield, AlertTriangle, Lightbulb, Target } from 'lucide-react';

const S = 14;

const sourceIcons = {
  email: <Mail size={S} />,
  social: <SocialIcon size={S} />,
  blog: <FileText size={S} />,
  press: <Globe size={S} />,
};

const sentimentColors = {
  negative: '#ef4444',
  neutral: '#f59e0b',
  positive: '#22c55e',
};

const impactColors = {
  high: 'critical',
  medium: 'warning',
  low: 'info',
};

const swotConfig = {
  strengths: { label: 'Strengths', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', icon: <Shield size={18} /> },
  weaknesses: { label: 'Weaknesses', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: <AlertTriangle size={18} /> },
  opportunities: { label: 'Opportunities', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: <Lightbulb size={18} /> },
  threats: { label: 'Threats', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: <Target size={18} /> },
};

const areaColors = {
  digital: '#6366f1',
  loyalty: '#D4AF37',
  experience: '#22c55e',
  routes: '#3b82f6',
};

export default function CompetitiveIntelView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('dashboard');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [feedFilter, setFeedFilter] = useState('all');
  const [feedSourceFilter, setFeedSourceFilter] = useState('all');
  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
  const data = competitiveIntelData;

  const tabs = [
    { id: 'dashboard', label: t('competitiveIntel.competitors') || 'Competitors', icon: <Eye size={16} /> },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'feed', label: t('competitiveIntel.feed') || 'Intelligence Feed', icon: AgentTabIcons.alerts, count: data.intelligenceFeed.length },
    { id: 'swot', label: 'SWOT', icon: <Target size={16} /> },
    { id: 'opportunities', label: t('competitiveIntel.opportunities') || 'Opportunities', icon: <Lightbulb size={16} />, count: data.actionableOpportunities.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  const filteredFeed = data.intelligenceFeed.filter((item) => {
    if (feedFilter !== 'all' && item.competitor !== feedFilter) return false;
    if (feedSourceFilter !== 'all' && item.source !== feedSourceFilter) return false;
    return true;
  });

  const competitorColumns = [
    { key: 'name', label: t('competitiveIntel.name') || 'Competitor', render: (val) => (
      <span style={{ fontWeight: 700 }}>{val}</span>
    )},
    { key: 'region', label: t('competitiveIntel.region') || 'Region' },
    { key: 'strength', label: t('competitiveIntel.strength') || 'Key Strength', render: (val) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{val}</span>
    )},
    { key: 'threatLevel', label: t('competitiveIntel.threat') || 'Threat', render: (val) => (
      <StatusBadge status={impactColors[val]} label={val} />
    )},
    { key: 'recentMove', label: t('competitiveIntel.recentMove') || 'Recent Move', render: (val) => (
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', display: 'inline-block' }}>{val}</span>
    )},
  ];

  return (
    <>
      {/* Hero — KPI Cards */}
      <div className="agent-kpi-grid">
        <KpiCard
          label={t('competitiveIntel.competitorsTracked') || 'Competitors Tracked'}
          value={data.kpis.competitorsTracked}
          color="var(--primary)"
        />
        <KpiCard
          label={t('competitiveIntel.insightsThisWeek') || 'Insights This Week'}
          value={data.kpis.insightsThisWeek}
          trend={3}
          trendLabel="↑ 3 vs last week"
          color="#6366f1"
        />
        <KpiCard
          label={t('competitiveIntel.opportunitiesFound') || 'Opportunities Found'}
          value={data.kpis.opportunitiesFound}
          color="var(--accent-green)"
        />
        <KpiCard
          label={t('competitiveIntel.activeThreats') || 'Active Threats'}
          value={data.kpis.activeThreats}
          color="#ef4444"
        />
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
        {/* Competitors Tab */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <DataTable columns={competitorColumns} data={data.competitors} />
          </div>
        )}

        {/* Intelligence Feed Tab */}
        {activeTab === 'feed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={feedFilter}
                onChange={(e) => setFeedFilter(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem',
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  color: 'var(--text-primary, #e2e8f0)', cursor: 'pointer',
                }}
              >
                <option value="all">{t('competitiveIntel.allCompetitors') || 'All Competitors'}</option>
                {data.competitors.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <select
                value={feedSourceFilter}
                onChange={(e) => setFeedSourceFilter(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem',
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  color: 'var(--text-primary, #e2e8f0)', cursor: 'pointer',
                }}
              >
                <option value="all">{t('competitiveIntel.allChannels') || 'All Channels'}</option>
                <option value="email">Email</option>
                <option value="social">Social Media</option>
                <option value="blog">Blog</option>
                <option value="press">Press</option>
              </select>
            </div>

            {/* Feed Items */}
            {filteredFeed.map((item) => (
              <div key={item.id} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.1)',
                      color: '#6366f1',
                    }}>
                      {sourceIcons[item.source]}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {item.source}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.competitor}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <StatusBadge status={impactColors[item.impact]} label={item.impact} />
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                      background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)',
                    }}>
                      {item.category}
                    </span>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.aiSummary}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sentiment:</span>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: sentimentColors[item.sentiment],
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: sentimentColors[item.sentiment] }}>
                    {item.sentiment}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SWOT Tab */}
        {activeTab === 'swot' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {Object.entries(swotConfig).map(([key, config]) => (
              <div key={key} className="card animate-fade-in" style={{ padding: '16px', background: config.bg, border: `1px solid ${config.color}22` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: config.color }}>
                    {t(`competitiveIntel.${key}`) || config.label}
                  </h3>
                  <span style={{
                    marginLeft: 'auto', padding: '2px 8px', borderRadius: '10px',
                    fontSize: '0.7rem', fontWeight: 700, background: `${config.color}22`, color: config.color,
                  }}>
                    {data.swot[key].length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.swot[key].map((item) => (
                    <div key={item.id} style={{
                      padding: '10px 12px', borderRadius: '8px',
                      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                        {item.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {item.evidence}
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <StatusBadge status={impactColors[item.priority]} label={item.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.actionableOpportunities.map((opp) => (
              <div key={opp.id} className="card animate-fade-in" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowUpRight size={16} style={{ color: areaColors[opp.area] || '#6366f1' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{opp.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                      background: `${areaColors[opp.area] || '#6366f1'}18`,
                      color: areaColors[opp.area] || '#6366f1',
                    }}>
                      {opp.area}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {opp.description}
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('competitiveIntel.impact') || 'Impact'}:</span>
                    <StatusBadge status={impactColors[opp.impact]} label={opp.impact} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('competitiveIntel.effort') || 'Effort'}:</span>
                    <StatusBadge status={opp.effort === 'low' ? 'success' : opp.effort === 'medium' ? 'warning' : 'critical'} label={opp.effort} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('competitiveIntel.inspiredBy') || 'Inspired by'}:</span>
                    <span style={{ fontWeight: 600 }}>{opp.inspiredBy}</span>
                  </div>
                </div>
              </div>
            ))}
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
