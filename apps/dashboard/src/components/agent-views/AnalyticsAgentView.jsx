import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { analyticsAgentData } from '../../data/agentViewMocks.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, ReportTypeIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const trendArrow = { up: '↑', down: '↓', stable: '→' };
const trendColor = { up: 'var(--accent-green)', down: '#ef4444', stable: '#f59e0b' };

export default function AnalyticsAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('dashboard');
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
  const data = analyticsAgentData;

  const tabs = [
    { id: 'dashboard', label: 'Performance Dashboard', icon: AgentTabIcons.dashboard },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'bau', label: 'BAU Metrics', icon: AgentTabIcons.bau },
    { id: 'attribution', label: 'Channel Attribution', icon: AgentTabIcons.attribution },
    { id: 'reports', label: 'Reports', icon: AgentTabIcons.reports, count: data.reports.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  const formatRevenue = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  return (
    <>
      {/* Hero — KPI Cards */}
      <div className="agent-kpi-grid">
        <KpiCard
          label={t('analyticsAgent.totalRevenue') || 'Total Revenue'}
          value={formatRevenue(data.kpis.totalRevenue)}
          trend={8.3}
          trendLabel="↑ 8.3% vs Q4"
          color="var(--accent-green)"
        />
        <KpiCard
          label={t('analyticsAgent.avgRoi') || 'Avg ROI per Campaign'}
          value={`${data.kpis.avgRoi}x`}
        />
        <KpiCard
          label={t('analyticsAgent.reportsGenerated') || 'Reports This Week'}
          value={data.kpis.reportsGenerated}
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
        {/* Dashboard Tab — Charts */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Line Chart — Opens/Clicks/Conversions */}
            <div className="card animate-fade-in" style={{ padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>
                {t('analyticsAgent.performanceTrend') || 'Performance Trend (12 Weeks)'}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', fontSize: '0.8rem' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Line type="monotone" dataKey="opens" stroke="#6366f1" strokeWidth={2} dot={false} name="Opens" />
                  <Line type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} dot={false} name="Clicks" />
                  <Line type="monotone" dataKey="conversions" stroke="#22c55e" strokeWidth={2} dot={false} name="Conversions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart — ROI by Campaign */}
            <div className="card animate-fade-in" style={{ padding: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>
                {t('analyticsAgent.roiByCampaign') || 'ROI by Campaign'}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.roiByCampaign} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis dataKey="campaign" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={160} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', fontSize: '0.8rem' }}
                    formatter={(val) => [`${val}x`, 'ROI']}
                  />
                  <Bar dataKey="roi" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* BAU Performance Tab */}
        {activeTab === 'bau' && data.bauTypePerformance && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* BAU bar chart */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '16px' }}>Open Rate by BAU Type</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.bauTypePerformance} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={120} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '0.8rem' }}
                    formatter={(val) => `${val}%`}
                  />
                  <Bar dataKey="openRate" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* BAU performance table */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '16px' }}>Performance by BAU Type</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Sends</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Open Rate</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>CTR</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Conversions</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bauTypePerformance.map((row) => (
                      <tr key={row.bauType} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.name}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{(row.sends / 1000).toFixed(0)}K</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: row.openRate > 35 ? 'var(--accent-green)' : 'var(--text-main)' }}>{row.openRate}%</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.ctr}%</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.conversions > 0 ? row.conversions.toLocaleString() : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{row.revenue > 0 ? formatRevenue(row.revenue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Attribution Tab */}
        {activeTab === 'attribution' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 0.6fr',
              padding: '10px 16px', fontSize: '0.75rem', fontWeight: 700,
              color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <span>{t('analyticsAgent.channel') || 'Channel'}</span>
              <span style={{ textAlign: 'center' }}>%</span>
              <span style={{ textAlign: 'right' }}>{t('analyticsAgent.revenue') || 'Revenue'}</span>
              <span style={{ textAlign: 'center' }}>Trend</span>
            </div>
            {data.attribution.map((attr, i) => (
              <div key={i} className="card animate-fade-in" style={{
                display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 0.6fr',
                padding: '14px 16px', alignItems: 'center', fontSize: '0.85rem',
              }}>
                <span style={{ fontWeight: 600 }}>{attr.channel}</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <div style={{ flex: 1, maxWidth: '80px', height: '6px', borderRadius: '3px', background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${attr.percent}%`, background: '#6366f1', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontWeight: 600, minWidth: '32px' }}>{attr.percent}%</span>
                  </div>
                </div>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatRevenue(attr.revenue)}</span>
                <span style={{ textAlign: 'center', fontWeight: 700, color: trendColor[attr.trend] }}>
                  {trendArrow[attr.trend]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.reports.map((report) => (
              <div key={report.id} className="card animate-fade-in" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', background: 'rgba(99,102,241,0.1)',
                }}>
                  {ReportTypeIcons[report.type]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{report.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{report.date}</div>
                </div>
                <StatusBadge status={report.type === 'weekly' ? 'info' : report.type === 'campaign' ? 'success' : 'warning'} label={report.type} />
                <button style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.2)',
                  background: 'transparent', color: 'var(--text-primary, #e2e8f0)', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600,
                }}>
                  {t('analyticsAgent.view') || 'View'}
                </button>
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
