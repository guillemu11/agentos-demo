import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { qaAgentData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, QaIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import { CheckCircle2, XCircle } from 'lucide-react';

const severityColor = { critical: '#ef4444', major: '#f59e0b', minor: '#94a3b8' };

function RenderScore({ score }) {
  const color = score >= 95 ? 'var(--accent-green)' : score >= 85 ? '#f59e0b' : '#ef4444';
  return <span style={{ fontWeight: 600, color }}>{score}</span>;
}

export default function QaAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('results');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [expandedRow, setExpandedRow] = useState(null);
  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
  const data = qaAgentData;

  const tabs = [
    { id: 'results', label: 'Test Results', icon: AgentTabIcons.results },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'queue', label: 'QA Queue', icon: AgentTabIcons.queue, count: data.queue.length },
    { id: 'bugs', label: 'Bug Tracker', icon: AgentTabIcons.bugs, count: data.bugs.filter((b) => b.status !== 'fixed').length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero — KPI Cards */}
      <div className="agent-kpi-grid">
        <KpiCard
          label={t('qaAgent.passed') || 'Passed Tests'}
          value={`${data.kpis.passed}`}
          icon={<CheckCircle2 size={16} />}
          color="var(--accent-green)"
        />
        <KpiCard
          label={t('qaAgent.failed') || 'Failed Tests'}
          value={`${data.kpis.failed}`}
          icon={<XCircle size={16} style={{ color: '#ef4444' }} />}
          color="#ef4444"
        />
        <KpiCard
          label={t('qaAgent.pending') || 'Pending QA'}
          value={data.kpis.pending}
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
        {/* Test Results Tab */}
        {activeTab === 'results' && (
          <div style={{ overflowX: 'auto' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr',
              padding: '10px 16px', fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>{t('qaAgent.piece') || 'Piece'}</span>
              <span style={{ textAlign: 'center' }}>{t('qaAgent.links') || 'Links'}</span>
              <span style={{ textAlign: 'center' }}>{QaIcons.desktop} Desktop</span>
              <span style={{ textAlign: 'center' }}>{QaIcons.mobile} Mobile</span>
              <span style={{ textAlign: 'center' }}>{QaIcons.tablet} Tablet</span>
              <span style={{ textAlign: 'center' }}>Spam</span>
              <span style={{ textAlign: 'center' }}>Load</span>
            </div>
            {data.testResults.map((tr) => {
              const hasIssue = tr.links.broken > 0 || tr.spamScore > 3 || tr.render.mobile < 85;
              return (
                <div
                  key={tr.id}
                  className="card animate-fade-in"
                  onClick={() => setExpandedRow(expandedRow === tr.id ? null : tr.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr',
                    padding: '12px 16px', marginBottom: '4px', alignItems: 'center', fontSize: '0.85rem',
                    cursor: 'pointer', borderLeft: hasIssue ? '3px solid #f59e0b' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{tr.piece}</span>
                  <span style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--accent-green)' }}>✓{tr.links.ok}</span>
                    {tr.links.broken > 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>✗{tr.links.broken}</span>}
                  </span>
                  <span style={{ textAlign: 'center' }}><RenderScore score={tr.render.desktop} /></span>
                  <span style={{ textAlign: 'center' }}><RenderScore score={tr.render.mobile} /></span>
                  <span style={{ textAlign: 'center' }}><RenderScore score={tr.render.tablet} /></span>
                  <span style={{
                    textAlign: 'center', fontWeight: 600,
                    color: tr.spamScore > 3 ? '#ef4444' : tr.spamScore > 2 ? '#f59e0b' : 'var(--accent-green)',
                  }}>
                    {tr.spamScore}
                  </span>
                  <span style={{
                    textAlign: 'center', fontWeight: 600,
                    color: tr.loadTime > 600 ? '#ef4444' : tr.loadTime > 400 ? '#f59e0b' : 'var(--accent-green)',
                  }}>
                    {tr.loadTime}ms
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.queue.map((item) => (
              <div key={item.id} className="card animate-fade-in" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem',
                  background: item.type === 'email' ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
                }}>
                  {item.type === 'email' ? QaIcons.email : QaIcons.web}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('qaAgent.submitted') || 'Submitted'}: {item.submitted}
                  </div>
                </div>
                <StatusBadge status={item.priority} />
              </div>
            ))}
          </div>
        )}

        {/* Bugs Tab */}
        {activeTab === 'bugs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.bugs.map((bug) => (
              <div key={bug.id} className="card animate-fade-in" style={{
                padding: '16px',
                borderLeft: `3px solid ${severityColor[bug.severity] || '#94a3b8'}`,
                opacity: bug.status === 'fixed' ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{bug.title}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <StatusBadge status={bug.severity} />
                    <StatusBadge status={bug.status} />
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                  {bug.description}
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
