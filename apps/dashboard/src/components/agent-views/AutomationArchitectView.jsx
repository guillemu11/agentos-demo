import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { automationArchitectData } from '../../data/agentViewMocks.js';
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

export default function AutomationArchitectView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('automations');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  useEffect(() => {
    if (onTabChange) onTabChange(localTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const data = automationArchitectData;

  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  const tabs = [
    { id: 'automations', label: 'Automations', icon: AgentTabIcons.automations },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'executions', label: 'Execution Log', icon: AgentTabIcons.executions },
    { id: 'errors', label: 'Error Log', icon: AgentTabIcons.errors, count: data.errors.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const executionColumns = [
    { key: 'journey', label: 'Journey', sortable: true },
    { key: 'timestamp', label: t('automationArchitect.timestamp') || 'Timestamp', sortable: true },
    {
      key: 'result', label: t('automationArchitect.result') || 'Result', sortable: true,
      render: (val) => <StatusBadge status={val === 'success' ? 'success' : val === 'fail' ? 'error' : 'warning'} label={val.charAt(0).toUpperCase() + val.slice(1)} />,
    },
    { key: 'duration', label: t('automationArchitect.duration') || 'Duration', sortable: true, align: 'right' },
  ];

  function getStatusStyle(status) {
    const map = {
      active: { bg: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' },
      draft: { bg: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' },
      paused: { bg: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' },
      error: { bg: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' },
    };
    return map[status] || map.draft;
  }

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard label={t('automationArchitect.activeJourneys') || 'Active Journeys'} value={data.kpis.activeJourneys} color="#10b981" />
        <KpiCard label={t('automationArchitect.draftJourneys') || 'Draft Journeys'} value={data.kpis.draftJourneys} color="#94a3b8" />
        <KpiCard label={t('automationArchitect.errorRate') || 'Error Rate'} value={`${data.kpis.errorRate}%`} color="#ef4444" />
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
        {/* Automations Tab — Cards */}
        {activeTab === 'automations' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {data.automations.map((auto) => {
              const style = getStatusStyle(auto.status);
              return (
                <div key={auto.id} className="card animate-fade-in" style={{ padding: '16px', background: style.bg, border: style.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{auto.name}</div>
                    <StatusBadge status={auto.status} />
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary, #cbd5e1)' }}>Trigger:</span> {auto.trigger}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{auto.steps} steps</span>
                      <span style={{ color: 'rgba(148,163,184,0.4)' }}>|</span>
                      <span>{auto.entryCount.toLocaleString()} entries</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Executions Tab — Table */}
        {activeTab === 'executions' && (
          <DataTable columns={executionColumns} data={data.executions} />
        )}

        {/* Errors Tab — Grouped cards */}
        {activeTab === 'errors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.errors.map((err, i) => (
              <div key={i} className="card animate-fade-in" style={{ padding: '16px', borderLeft: '3px solid #ef4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{err.type}</div>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                    background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                  }}>
                    {err.count}x
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '8px', fontFamily: 'monospace', lineHeight: '1.4' }}>
                  {err.message}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Last seen: {err.lastSeen}
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
