import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { crmAgentData } from '../../data/agentViewMocks.js';
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

export default function CrmAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('segments');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const data = crmAgentData;

  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  const tabs = [
    { id: 'segments', label: 'Customer Segments', icon: AgentTabIcons.segments },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'cohorts', label: 'Retention Cohorts', icon: AgentTabIcons.cohorts },
    { id: 'alerts', label: 'Alerts', icon: AgentTabIcons.alerts, count: data.alerts.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const segmentColumns = [
    { key: 'name', label: t('crmAgent.segmentName') || 'Nombre', sortable: true },
    { key: 'size', label: t('crmAgent.size') || 'Tamaño', sortable: true, align: 'right', render: (val) => val.toLocaleString() },
    {
      key: 'criteria', label: t('crmAgent.criteria') || 'Criterios', sortable: false, render: (val) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {val.map((c, i) => (
            <span key={i} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{c}</span>
          ))}
        </div>
      )
    },
    { key: 'lastUpdated', label: t('crmAgent.lastUpdated') || 'Última actualización', sortable: true },
    {
      key: 'overlapPercent', label: 'Overlap %', sortable: true, align: 'right', render: (val) => (
        <span style={{ color: val > 20 ? '#f59e0b' : '#94a3b8' }}>{val}%</span>
      )
    },
  ];

  const cohortMonths = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'];

  function getCohortColor(value) {
    if (value == null) return 'transparent';
    if (value >= 80) return 'rgba(16,185,129,0.35)';
    if (value >= 70) return 'rgba(16,185,129,0.22)';
    if (value >= 60) return 'rgba(212,175,55,0.22)';
    return 'rgba(239,68,68,0.18)';
  }

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard label={t('crmAgent.retentionRate') || 'Retention Rate'} value={`${data.kpis.retentionRate}%`} trend={data.kpis.retentionTrend} color="#10b981" />
        <KpiCard label={t('crmAgent.churnRisk') || 'Churn Risk'} value={data.kpis.churnRiskCount} trendLabel="accounts" color="#ef4444" />
        <KpiCard label={t('crmAgent.activeSegments') || 'Active Segments'} value={data.kpis.activeSegments} color="#6366f1" />
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
        {activeTab === 'segments' && (
          <DataTable columns={segmentColumns} data={data.segments} />
        )}

        {activeTab === 'cohorts' && (
          <div className="card" style={{ padding: '20px', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{t('crmAgent.retentionCohorts') || 'Retención por cohorte mensual'}</h3>
            <table className="agent-data-table" style={{ minWidth: '500px' }}>
              <thead>
                <tr>
                  <th>{t('crmAgent.cohortMonth') || 'Cohorte'}</th>
                  {cohortMonths.map((m) => (
                    <th key={m} style={{ textAlign: 'center' }}>{m.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((cohort) => (
                  <tr key={cohort.month}>
                    <td style={{ fontWeight: 600 }}>{cohort.month}</td>
                    {cohortMonths.map((m) => (
                      <td key={m} style={{ textAlign: 'center', background: getCohortColor(cohort[m]), fontWeight: 600, borderRadius: '4px' }}>
                        {cohort[m] != null ? `${cohort[m]}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.alerts.map((alert) => (
              <div key={alert.id} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <StatusBadge status={alert.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{alert.segment}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{alert.message}</div>
                </div>
                <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{alert.type}</span>
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
