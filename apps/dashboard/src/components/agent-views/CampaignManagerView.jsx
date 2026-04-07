import React, { useState, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import EmailBriefCard from '../EmailBriefCard';
import { campaignManagerData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import DataTable from './shared/DataTable.jsx';
import ProgressBar from './shared/ProgressBar.jsx';
import { AgentTabIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function CampaignManagerView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('campaigns');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const [metricsChart, setMetricsChart] = useState('line');
  const data = campaignManagerData;

  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  const tabs = [
    { id: 'campaigns', label: 'Active Campaigns', icon: AgentTabIcons.campaigns },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'dependencies', label: 'Dependencies', icon: AgentTabIcons.dependencies, count: data.dependencies.filter(d => d.status !== 'resolved').length },
    { id: 'metrics', label: 'Campaign Metrics', icon: AgentTabIcons.metrics },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const depColumns = [
    { key: 'campaign', label: t('campaignManager.campaign') || 'Campaña', sortable: true },
    {
      key: 'from', label: t('campaignManager.from') || 'De', sortable: true, render: (val) => (
        <span style={{ fontWeight: 600 }}>{val}</span>
      )
    },
    {
      key: 'to', label: t('campaignManager.to') || 'Para', sortable: true, render: (val) => (
        <span style={{ fontWeight: 600 }}>{val}</span>
      )
    },
    { key: 'description', label: t('campaignManager.description') || 'Descripción', sortable: false },
    {
      key: 'status', label: t('campaignManager.status') || 'Estado', sortable: true, render: (val) => (
        <StatusBadge status={val} />
      )
    },
  ];

  function getPhaseColor(phase) {
    if (phase.done) return '#10b981';
    if (phase.current) return '#6366f1';
    return '#d1d5db';
  }

  function getStatusColor(status) {
    const map = { launched: '#10b981', qa: '#f59e0b', content: '#6366f1', brief: '#94a3b8' };
    return map[status] || '#94a3b8';
  }

  const [emailSpecByProject, setEmailSpecByProject] = useState({});
  const [localEvents, setLocalEvents] = useState([]);

  const allEventsRaw = [...(agent.recent_events || []), ...localEvents];
  const allEvents = allEventsRaw
    .sort((a, b) => {
      const diff = new Date(b.timestamp) - new Date(a.timestamp);
      if (diff !== 0) return diff;
      return allEventsRaw.indexOf(b) - allEventsRaw.indexOf(a);
    });

  const handleBriefArtifact = useCallback((payload) => {
    const { spec, projectId, timestamp, blocksCount, variablesCount } = payload;
    setEmailSpecByProject(prev => ({ ...prev, [projectId]: { spec, timestamp } }));
    setLocalEvents(prev => [{
      id: `brief-${Date.now()}`,
      timestamp,
      event_type: 'brief_created',
      content: `${t('campaignManager.brief.updated')} — ${blocksCount} bloques, ${variablesCount} variables`,
    }, ...prev]);
  }, [t]);

  const handleStreamEvent = useCallback((event) => {
    if (event.type === 'brief_artifact') {
      handleBriefArtifact(event.payload);
    }
  }, [handleBriefArtifact]);

  return (
    <>
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
        {activeTab === 'campaigns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.campaigns.map((campaign) => {
              const projectId = campaign.projectId || campaign.id;
              const briefData = emailSpecByProject[projectId];
              const emailSpec = briefData?.spec || campaign.email_spec;

              return (
              <div key={campaign.id} className="card animate-fade-in" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{campaign.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {t('campaignManager.target') || 'Target'}: {new Date(campaign.targetDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <StatusBadge status={campaign.status === 'launched' ? 'success' : campaign.status === 'qa' ? 'warning' : campaign.status === 'content' ? 'in-progress' : 'draft'} label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)} />
                </div>

                <ProgressBar percent={campaign.progress} color={getStatusColor(campaign.status)} />

                <div style={{ display: 'flex', gap: '4px', margin: '12px 0', flexWrap: 'wrap' }}>
                  {campaign.phases.map((phase, i) => (
                    <React.Fragment key={phase.name}>
                      <span style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                        background: phase.done ? 'rgba(16,185,129,0.15)' : phase.current ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.05)',
                        color: getPhaseColor(phase),
                      }}>
                        {phase.done ? '✓' : phase.current ? '●' : '○'} {phase.name}
                      </span>
                      {i < campaign.phases.length - 1 && (
                        <span style={{ color: '#d1d5db', fontSize: '0.7rem', alignSelf: 'center' }}>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Assigned agents */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '4px' }}>{t('campaignManager.agents') || 'Agents'}:</span>
                  {campaign.assignedAgents.map((a) => (
                    <span key={a} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{a}</span>
                  ))}
                </div>

                {/* Metrics if launched */}
                {campaign.metrics && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open Rate</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{campaign.metrics.openRate}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CTR</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{campaign.metrics.ctr}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conversions</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{campaign.metrics.conversions.toLocaleString()}</div>
                    </div>
                  </div>
                )}

                <EmailBriefCard
                  emailSpec={emailSpec}
                  briefDate={briefData?.timestamp}
                  onDefineClick={() => setActiveTab('chat')}
                />
              </div>
              );
            })}
          </div>
        )}

        {activeTab === 'dependencies' && (
          <DataTable columns={depColumns} data={data.dependencies} />
        )}

        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Chart toggle */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`agent-tab ${metricsChart === 'line' ? 'active' : ''}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setMetricsChart('line')}
              >
                {t('campaignManager.lineChart') || 'Line Chart'}
              </button>
              <button
                className={`agent-tab ${metricsChart === 'bar' ? 'active' : ''}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setMetricsChart('bar')}
              >
                {t('campaignManager.barChart') || 'Bar Chart'}
              </button>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{t('campaignManager.weeklyMetrics') || 'Weekly Campaign Metrics'}</h3>
              <ResponsiveContainer width="100%" height={300}>
                {metricsChart === 'line' ? (
                  <LineChart data={data.metricsHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="openRate" name="Open Rate %" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ctr" name="CTR %" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <BarChart data={data.metricsHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="conversions" name="Conversions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Campaign ROI summary */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{t('campaignManager.campaignPerformance') || 'Campaign Performance'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.campaigns.filter(c => c.metrics).map((campaign) => (
                  <div key={campaign.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>{campaign.name}</span>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Open Rate</div>
                        <div style={{ fontWeight: 700 }}>{campaign.metrics.openRate}%</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CTR</div>
                        <div style={{ fontWeight: 700 }}>{campaign.metrics.ctr}%</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Conv.</div>
                        <div style={{ fontWeight: 700 }}>{campaign.metrics.conversions.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
            onStreamEvent={handleStreamEvent}
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
            {allEvents.length > 0 ? (
              allEvents.map((event, i) => (
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
