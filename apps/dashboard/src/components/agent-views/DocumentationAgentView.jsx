import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { marinaData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import ProgressBar from './shared/ProgressBar.jsx';
import { AgentTabIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DocumentationAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('coverage');
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
  const data = marinaData;

  const tabs = [
    { id: 'coverage', label: t('marina.tabCoverage') || 'Coverage', icon: AgentTabIcons.audit },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'outdated', label: t('marina.tabOutdated') || 'Outdated', icon: AgentTabIcons.alerts, count: data.kpis.outdatedDocs },
    { id: 'gaps', label: t('marina.tabGaps') || 'Gaps', icon: AgentTabIcons.validation, count: data.kpis.missingDocs },
    { id: 'history', label: t('marina.tabAuditHistory') || 'History', icon: AgentTabIcons.history },
    { id: 'chat', label: t('marina.tabChat') || 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: t('marina.tabActivity') || 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  const severityColor = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#94a3b8',
  };

  const scoreColor = (score) =>
    score >= 80 ? 'var(--accent-green)' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <>
      {/* Hero KPI Cards */}
      <div className="agent-kpi-grid">
        <KpiCard
          label={t('marina.auditedCampaigns') || 'Audited Campaigns'}
          value={data.kpis.auditedCampaigns}
          color="var(--primary)"
        />
        <KpiCard
          label={t('marina.outdatedDocs') || 'Outdated Docs'}
          value={data.kpis.outdatedDocs}
          color="#f59e0b"
        />
        <KpiCard
          label={t('marina.missingDocs') || 'Missing Docs'}
          value={data.kpis.missingDocs}
          color="#ef4444"
        />
        <KpiCard
          label={t('marina.coverageScore') || 'Coverage Score'}
          value={`${data.kpis.coverageScore}%`}
          color={scoreColor(data.kpis.coverageScore)}
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

        {/* Coverage Tab */}
        {activeTab === 'coverage' && (
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                {t('marina.coverageScore') || 'Coverage Score'} — {t('marina.byGroup') || 'by Campaign Group'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.coverageByGroup} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="group" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip formatter={(val) => `${val}%`} />
                  <Bar dataKey="score" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.coverageByGroup.map((g, i) => (
                <div key={i} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{g.group}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: scoreColor(g.score) }}>
                      {g.score}% ({g.documented}/{g.total})
                    </span>
                  </div>
                  <ProgressBar value={g.score} max={100} color={scoreColor(g.score)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outdated Tab */}
        {activeTab === 'outdated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.outdatedFindings.length === 0 ? (
              <div className="empty-state">{t('marina.noFindings') || 'No findings.'}</div>
            ) : (
              data.outdatedFindings.map((f) => (
                <div key={f.id} className="card animate-fade-in" style={{ padding: '16px', borderLeft: `3px solid ${severityColor[f.severity]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>{f.campaign}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.group}</div>
                    </div>
                    <StatusBadge status={f.severity} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '8px' }}>{f.issue}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>{t('marina.lastAudit') || 'Last updated'}: {f.lastUpdated}</span>
                    <a href={f.docPage} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                      {t('marina.docPage') || 'Doc Page'} →
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Gaps Tab */}
        {activeTab === 'gaps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.gapFindings.length === 0 ? (
              <div className="empty-state">{t('marina.noFindings') || 'No gaps found.'}</div>
            ) : (
              data.gapFindings.map((g) => (
                <div key={g.id} className="card animate-fade-in" style={{ padding: '16px', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{g.campaign}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{g.group}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)' }}>{g.reason}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Audit History Tab */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.auditHistory.length === 0 ? (
              <div className="empty-state">{t('marina.noHistory') || 'No audit history yet.'}</div>
            ) : (
              data.auditHistory.map((run) => (
                <div key={run.id} className="card animate-fade-in" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{run.runDate}</span>
                    <span style={{ fontWeight: 800, color: scoreColor(run.score) }}>
                      {run.score}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{run.scope}</div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem' }}>
                    <span>Total: <strong>{run.total}</strong></span>
                    <span style={{ color: '#f59e0b' }}>{t('marina.outdatedDocs') || 'Outdated'}: <strong>{run.outdated}</strong></span>
                    <span style={{ color: '#ef4444' }}>{t('marina.missingDocs') || 'Missing'}: <strong>{run.missing}</strong></span>
                  </div>
                </div>
              ))
            )}
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
