import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { segmentationAgentData } from '../../data/agentViewMocks.js';
import { getBauTypeById, getBauCategoryById } from '../../data/emiratesBauTypes.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#6366f1', '#f59e0b'];

export default function SegmentationAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('segments');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  const data = segmentationAgentData;

  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };

  const totalAudience = data.distribution.reduce((sum, d) => sum + d.count, 0);

  const tabs = [
    { id: 'segments', label: 'Audience Segments', icon: AgentTabIcons.segments },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'distribution', label: 'Distribution Charts', icon: AgentTabIcons.distribution },
    { id: 'validation', label: 'Validation', icon: AgentTabIcons.validation, count: data.validation.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero — Audience distribution bar + created this week */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('segmentationAgent.audienceDistribution') || 'Audience Distribution'}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('segmentationAgent.createdThisWeek') || 'Created this week'}: <strong>{data.createdThisWeek}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.distribution.map((d, i) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '90px', fontSize: '0.85rem', fontWeight: 600 }}>{d.name}</span>
              <div style={{ flex: 1, height: '20px', borderRadius: '4px', background: 'rgba(148,163,184,0.1)', overflow: 'hidden' }}>
                <div style={{ width: `${d.percent}%`, height: '100%', borderRadius: '4px', background: COLORS[i], transition: 'width 0.5s' }} />
              </div>
              <span style={{ width: '40px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700 }}>{d.percent}%</span>
              <span style={{ width: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.count.toLocaleString()}</span>
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
        {/* Segments Tab — Cards */}
        {activeTab === 'segments' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {data.segments.map((seg) => (
              <div key={seg.id} className="card animate-fade-in" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{seg.name}</div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#6366f1' }}>{seg.size.toLocaleString()}</span>
                </div>

                {/* Criteria tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {seg.criteria.map((c, i) => (
                    <span key={i} style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600,
                      background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                    }}>{c}</span>
                  ))}
                </div>

                {/* BAU types used in */}
                {seg.bauTypes && seg.bauTypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '2px' }}>Used in:</span>
                    {seg.bauTypes.map((btId) => {
                      const bt = getBauTypeById(btId);
                      const cat = bt ? getBauCategoryById(bt.category) : null;
                      return bt && cat ? (
                        <span key={btId} style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600,
                          background: `${cat.color}12`, color: cat.color,
                        }}>
                          {bt.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>{new Date(seg.created).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' })}</span>
                  <span style={{ color: seg.overlap > 25 ? '#f59e0b' : seg.overlap > 15 ? '#94a3b8' : '#10b981' }}>
                    Overlap: <strong>{seg.overlap}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Distribution Tab — Pie + Bar charts */}
        {activeTab === 'distribution' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>
                {t('segmentationAgent.audienceBreakdown') || 'Audience Breakdown'}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.distribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.distribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => val.toLocaleString()} contentStyle={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', fontSize: '0.85rem' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                {t('segmentationAgent.totalAudience') || 'Total Audience'}: <strong>{totalAudience.toLocaleString()}</strong>
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>
                {t('segmentationAgent.segmentSizes') || 'Segment Sizes'}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.segments} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={120} />
                  <Tooltip formatter={(val) => val.toLocaleString()} contentStyle={{ background: 'var(--bg-card, #1e293b)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', fontSize: '0.85rem' }} />
                  <Bar dataKey="size" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === 'validation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.validation.map((v, i) => (
              <div key={i} className="card animate-fade-in" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <StatusBadge status={v.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{v.segment}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{v.issue}</div>
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
