import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { cloudArchitectData } from '../../data/agentViewMocks.js';
import AgentChat from '../AgentChat.jsx';
import KpiCard from './shared/KpiCard.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import DataTable from './shared/DataTable.jsx';
import { AgentTabIcons, CloudIcons } from '../icons.jsx';

export default function CloudArchitectView({ agent }) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('journeys');
  const data = cloudArchitectData;

  const tabs = [
    { id: 'journeys', label: 'Active Journeys', icon: AgentTabIcons.journeys },
    { id: 'infrastructure', label: 'Infrastructure', icon: AgentTabIcons.infrastructure },
    { id: 'changelog', label: 'Changelog', icon: AgentTabIcons.changelog, count: data.changelog.length },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
  ];

  const statusIcon = (status) => {
    return CloudIcons[status] || CloudIcons.unknown;
  };

  const infraColumns = [
    { key: 'name', label: t('cloudArchitect.serviceName') || 'Service', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (val) => <StatusBadge status={val} /> },
    { key: 'latency', label: 'Latency', sortable: true, align: 'right' },
    { key: 'limit', label: 'Limit', sortable: false },
    {
      key: 'usage', label: 'Usage', sortable: true, align: 'right', render: (val) => {
        const num = parseInt(val);
        const color = num >= 90 ? '#ef4444' : num >= 70 ? '#f59e0b' : '#10b981';
        return <span style={{ fontWeight: 600, color }}>{val}</span>;
      }
    },
  ];

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero — Health Dashboard */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Journeys:</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{data.health.running} running</span>
            <span style={{ color: 'var(--text-muted)' }}>│</span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{data.health.paused} paused</span>
            <span style={{ color: 'var(--text-muted)' }}>│</span>
            <span style={{ fontWeight: 700, color: '#ef4444' }}>{data.health.error} error</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Throughput</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{data.health.throughput.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>emails/hr</span></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error Rate</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: data.health.errorRate > 1 ? '#ef4444' : '#10b981' }}>{data.health.errorRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="agent-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count != null && <span className="agent-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      <section className="agent-tab-content">
        {activeTab === 'journeys' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {data.journeys.map((journey) => (
              <div key={journey.id} className="card animate-fade-in" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{journey.name}</h4>
                  <StatusBadge status={journey.status} />
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: 1.4 }}>{journey.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Entry count:</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{journey.entryCount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'infrastructure' && (
          <DataTable columns={infraColumns} data={data.infrastructure} />
        )}

        {activeTab === 'changelog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.changelog.map((entry) => (
              <div key={entry.id} className="card animate-fade-in" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{entry.action}</span>
                    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{entry.target}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{entry.timestamp}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', borderLeft: '3px solid rgba(99,102,241,0.3)' }}>
                  {entry.diff}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <AgentChat agentId={agent.id} agentName={agent.name} agentAvatar={agent.avatar} />
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
      </section>
    </>
  );
}
