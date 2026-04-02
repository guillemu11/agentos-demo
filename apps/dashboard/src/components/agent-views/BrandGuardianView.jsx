import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { brandGuardianData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, StatusDots } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';

export default function BrandGuardianView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('queue');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  useEffect(() => {
    if (onTabChange) onTabChange(localTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
  const data = brandGuardianData;

  const tabs = [
    { id: 'queue', label: 'Review Queue', icon: AgentTabIcons.queue, count: data.kpis.pendingReviews },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'history', label: 'Review History', icon: AgentTabIcons.history },
    { id: 'guidelines', label: 'Brand Guidelines', icon: AgentTabIcons.guidelines },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  // Compute overall compliance
  const avgCompliance = Math.round(data.guidelines.reduce((sum, g) => sum + g.compliance, 0) / data.guidelines.length);

  return (
    <>
      {/* Hero — KPI Cards */}
      <div className="agent-kpi-grid">
        <KpiCard
          label={t('brandGuardian.pendingReviews') || 'Pending Reviews'}
          value={data.kpis.pendingReviews}
          color="#f59e0b"
        />
        <KpiCard
          label={t('brandGuardian.approvedToday') || 'Approved Today'}
          value={data.kpis.approvedToday}
          color="var(--accent-green)"
        />
        <KpiCard
          label={t('brandGuardian.rejectedToday') || 'Rejected Today'}
          value={data.kpis.rejectedToday}
          color="var(--accent-red)"
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
        {/* Review Queue Tab */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.reviewQueue.map((item) => (
              <div key={item.id} className="card animate-fade-in" style={{ padding: '16px', borderLeft: '3px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{item.piece}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t('brandGuardian.campaign') || 'Campaign'}: {item.campaign}
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Preview */}
                <div style={{
                  padding: '12px', borderRadius: '8px', marginBottom: '12px',
                  background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.1)',
                  fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', fontStyle: 'italic',
                }}>
                  "{item.preview}"
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('brandGuardian.submittedBy') || 'Submitted by'}: <strong>{item.submittedBy}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.8rem',
                      background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                    }}>
                      ✓ {t('brandGuardian.approve') || 'Approve'}
                    </button>
                    <button style={{
                      padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.8rem',
                      background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    }}>
                      ✗ {t('brandGuardian.reject') || 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 2fr 1fr',
              padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>{t('brandGuardian.piece') || 'Piece'}</span>
              <span>{t('brandGuardian.campaign') || 'Campaign'}</span>
              <span>{t('brandGuardian.decision') || 'Decision'}</span>
              <span>{t('brandGuardian.reason') || 'Reason'}</span>
              <span>{t('brandGuardian.time') || 'Time'}</span>
            </div>
            {data.history.map((item, i) => (
              <div key={i} className="card animate-fade-in" style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 2fr 1fr',
                padding: '12px 16px', alignItems: 'center', fontSize: '0.85rem',
              }}>
                <span style={{ fontWeight: 600 }}>{item.piece}</span>
                <span style={{ color: 'var(--text-muted)' }}>{item.campaign}</span>
                <StatusBadge status={item.decision} />
                <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.8rem' }}>{item.reason}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.timestamp.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Guidelines Tab */}
        {activeTab === 'guidelines' && (
          <div>
            {/* Overall compliance */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {t('brandGuardian.overallCompliance') || 'Overall Compliance'}
              </div>
              <div style={{
                fontSize: '2rem', fontWeight: 800,
                color: avgCompliance >= 90 ? 'var(--accent-green)' : avgCompliance >= 80 ? '#f59e0b' : 'var(--accent-red)',
              }}>
                {avgCompliance}%
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.guidelines.map((g, i) => (
                <div key={i} className="card animate-fade-in" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{g.rule}</span>
                    <span style={{
                      fontWeight: 700, fontSize: '0.9rem',
                      color: g.compliance >= 95 ? 'var(--accent-green)' : g.compliance >= 85 ? '#f59e0b' : 'var(--accent-red)',
                    }}>
                      {g.compliance}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>{g.description}</div>
                  {/* Progress bar */}
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px', transition: 'width 0.6s ease',
                      width: `${g.compliance}%`,
                      background: g.compliance >= 95 ? 'var(--accent-green)' : g.compliance >= 85 ? '#f59e0b' : 'var(--accent-red)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
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
