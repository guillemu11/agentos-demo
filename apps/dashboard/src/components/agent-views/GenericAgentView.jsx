import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import AgentWorkHistory from './AgentWorkHistory.jsx';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import { AgentTabIcons, StatusDots, MoodIcons } from '../icons.jsx';
import { Wrench } from 'lucide-react';

function eventTypeToVisual(eventType) {
  switch (eventType) {
    case 'tool_call': return 'info';
    case 'task_complete': return 'success';
    case 'error': return 'warning';
    default: return 'info';
  }
}

function formatEventContent(event) {
  if (!event.content) return event.event_type;
  if (typeof event.content === 'string') return event.content;
  return event.content.message || event.content.summary || JSON.stringify(event.content);
}

function formatEventTime(timestamp, lang) {
  if (!timestamp) return '--:--';
  const d = new Date(timestamp);
  return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function GenericAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('chat');
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

  const skills = agent.skills || [];
  const tools = agent.tools || [];
  const eodReports = agent.eod_reports || [];
  const recentEvents = agent.recent_events || [];

  const moodLabels = {
    productive: { emoji: StatusDots.green, label: t('mood.productive') },
    neutral: { emoji: StatusDots.yellow, label: t('mood.neutral') },
    blocked: { emoji: StatusDots.red, label: t('mood.blocked') },
    frustrated: { emoji: MoodIcons.frustrated, label: t('mood.frustrated') || 'Frustrado' },
    focused: { emoji: MoodIcons.focused, label: t('mood.focused') },
  };

  const tabs = [
    { id: 'chat', label: t('agentChat.tab'), icon: AgentTabIcons.chat },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'skills', label: 'Skills', icon: AgentTabIcons.skills, count: skills.length },
    { id: 'tools', label: 'Tools', icon: AgentTabIcons.tools, count: tools.length },
    { id: 'history', label: t('pipeline.completedWork'), icon: AgentTabIcons.history, count: pipeline.completedWorkCount },
    { id: 'activity', label: t('agentDetail.activity'), icon: AgentTabIcons.activity, count: recentEvents.length },
    { id: 'eod', label: 'EOD Reports', icon: AgentTabIcons.eod, count: eodReports.length },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  return (
    <>
      <ActiveTicketIndicator selectedTicket={pipeline.selectedTicket} onClear={pipeline.clearTicket} />

      <div className="agent-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count != null && (
              <span className={`agent-tab-count${tab.urgent ? ' urgent' : ''}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <section className="agent-tab-content">
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

        {activeTab === 'skills' && (
          <div className="agent-skills-list">
            {skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {skills.map((skillId) => (
                  <span key={skillId} className="card skill-card animate-fade-in" style={{
                    display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600,
                  }}>{skillId}</span>
                ))}
              </div>
            ) : (
              <div className="empty-state">{t('agentDetail.noSkills')}</div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="agent-tools-list">
            {tools.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tools.map((toolId) => (
                  <span key={toolId} className="card tool-detail-card animate-fade-in" style={{
                    display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600,
                  }}>{AgentTabIcons.tools} {toolId}</span>
                ))}
              </div>
            ) : (
              <div className="empty-state">{t('agentDetail.noTools')}</div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <AgentWorkHistory agentId={agent.id} />
        )}

        {activeTab === 'activity' && (
          <div className="agent-activity-feed">
            {recentEvents.length > 0 ? (
              recentEvents.map((event, i) => (
                <div key={event.id || i} className="activity-item animate-fade-in">
                  <div className="activity-time">{formatEventTime(event.timestamp, lang)}</div>
                  <div className={`activity-dot ${eventTypeToVisual(event.event_type)}`}></div>
                  <div className="activity-message">{formatEventContent(event)}</div>
                </div>
              ))
            ) : (
              <div className="empty-state">{t('agentDetail.noActivity')}</div>
            )}
          </div>
        )}

        {activeTab === 'eod' && (
          <div className="agent-eod-reports">
            {eodReports.length > 0 ? (
              eodReports.map((report) => {
                const m = moodLabels[report.mood] || { emoji: StatusDots.gray, label: report.mood };
                const completedCount = Array.isArray(report.completed_tasks) ? report.completed_tasks.length : 0;
                const blockersCount = Array.isArray(report.blockers) ? report.blockers.length : 0;
                const inProgressCount = Array.isArray(report.in_progress_tasks) ? report.in_progress_tasks.length : 0;
                const insightsCount = Array.isArray(report.insights) ? report.insights.length : 0;

                return (
                  <div key={report.id} className="card animate-fade-in" style={{ marginBottom: '16px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                        {new Date(report.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </h3>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(255,255,255,0.06)' }}>
                        {m.emoji} {m.label}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                      <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.12)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{completedCount}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{t('agentDetail.completed')}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(212,175,55,0.12)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D4AF37' }}>{inProgressCount}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{t('agentDetail.inProgress')}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', background: blockersCount > 0 ? 'rgba(215,25,32,0.12)' : 'rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: blockersCount > 0 ? '#D71920' : '#888' }}>{blockersCount}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Blockers</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(99,102,241,0.12)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8' }}>{insightsCount}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>Insights</div>
                      </div>
                    </div>
                    {completedCount > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{t('agentDetail.completed')}:</strong>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85rem', color: '#475569' }}>
                          {report.completed_tasks.map((task, i) => (
                            <li key={i}>{typeof task === 'string' ? task : JSON.stringify(task)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {blockersCount > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#ef4444' }}>Blockers:</strong>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85rem', color: '#475569' }}>
                          {report.blockers.map((b, i) => (
                            <li key={i}>{typeof b === 'string' ? b : JSON.stringify(b)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {insightsCount > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#6366f1' }}>Insights:</strong>
                        <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85rem', color: '#475569' }}>
                          {report.insights.map((insight, i) => (
                            <li key={i}>{typeof insight === 'string' ? insight : JSON.stringify(insight)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-state">{t('agentDetail.noEod')}</div>
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
