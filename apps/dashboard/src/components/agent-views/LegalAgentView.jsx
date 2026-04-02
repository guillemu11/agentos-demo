import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { legalAgentData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, StatusIcons, LegalIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';

const statusIconMap = { pass: StatusIcons.pass, warning: StatusIcons.warning, fail: StatusIcons.fail };
const severityColor = { critical: '#ef4444', warning: '#f59e0b', info: '#6366f1' };

export default function LegalAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('compliance');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
  const data = legalAgentData;

  const regulations = ['GDPR', 'CAN-SPAM', 'UAE Local', 'Consent'];

  const failCount = data.risks.filter((r) => r.severity === 'critical').length;
  const warnCount = data.risks.filter((r) => r.severity === 'warning').length;

  const tabs = [
    { id: 'compliance', label: 'Compliance', icon: AgentTabIcons.compliance },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'risks', label: 'Risk Assessment', icon: AgentTabIcons.risks, count: failCount + warnCount },
    { id: 'audit', label: 'Audit Trail', icon: AgentTabIcons.audit },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero — Compliance semaphore */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.campaignCompliance.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 700, minWidth: '160px' }}>{c.campaign}:</span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {regulations.map((reg) => (
                  <span key={reg} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                    {statusIcon[c.checks[reg]]} {reg}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
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
        {/* Compliance Tab — Grid */}
        {activeTab === 'compliance' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('legalAgent.campaign') || 'Campaign'}
                  </th>
                  {regulations.map((reg) => (
                    <th key={reg} style={{ textAlign: 'center', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {reg}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.campaignCompliance.map((c, i) => (
                  <tr key={i} className="animate-fade-in" style={{ background: 'var(--bg-card, rgba(30,41,59,0.5))', borderRadius: '8px' }}>
                    <td style={{ padding: '12px', fontWeight: 600, borderRadius: '8px 0 0 8px' }}>{c.campaign}</td>
                    {regulations.map((reg) => (
                      <td key={reg} style={{ textAlign: 'center', padding: '12px', fontSize: '1.1rem' }}>
                        {statusIcon[c.checks[reg]]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Risks Tab */}
        {activeTab === 'risks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.risks.map((risk) => (
              <div key={risk.id} className="card animate-fade-in" style={{
                padding: '16px',
                borderLeft: `3px solid ${severityColor[risk.severity] || '#94a3b8'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>{risk.campaign}</div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                      background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                    }}>
                      {risk.regulation}
                    </span>
                  </div>
                  <StatusBadge status={risk.severity} />
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '10px' }}>
                  {risk.description}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{LegalIcons.pin} {t('legalAgent.action') || 'Action'}: <strong style={{ color: 'var(--text-primary, #e2e8f0)' }}>{risk.action}</strong></span>
                  <span>{LegalIcons.calendar} {t('legalAgent.deadline') || 'Deadline'}: <strong>{risk.deadline}</strong></span>
                  <span>{LegalIcons.user} {risk.responsible}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(148,163,184,0.15)' }} />
            {data.auditLog.map((entry, i) => {
              const dotColor = entry.result === 'pass' ? 'var(--accent-green)' : entry.result === 'fail' ? '#ef4444' : '#f59e0b';
              return (
                <div key={i} className="animate-fade-in" style={{ display: 'flex', gap: '12px', marginBottom: '12px', position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute', left: '-20px', top: '10px',
                    width: '10px', height: '10px', borderRadius: '50%', background: dotColor,
                    border: '2px solid var(--bg-card, #1e293b)',
                  }} />
                  <div className="card" style={{ flex: 1, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{entry.check}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusBadge status={entry.result} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.timestamp}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{entry.campaign}</span>
                      <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontStyle: 'italic' }}>{entry.notes}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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
