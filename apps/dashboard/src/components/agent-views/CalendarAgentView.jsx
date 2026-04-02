import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { calendarAgentData } from '../../data/agentViewMocks.js';
import { getBauTypeById, getBauCategoryById } from '../../data/emiratesBauTypes.js';
import { useAgentPipelineSession } from '../../hooks/useAgentPipelineSession.js';
import ActiveTicketIndicator from './shared/ActiveTicketIndicator.jsx';
import AgentTicketsPanel from './shared/AgentTicketsPanel.jsx';
import AgentChatSwitcher from './shared/AgentChatSwitcher.jsx';
import HandoffModal from '../HandoffModal.jsx';
import StatusBadge from './shared/StatusBadge.jsx';
import { AgentTabIcons, CalendarIcons, StatusIcons } from '../icons.jsx';
import AgentSettingsPanel from './AgentSettingsPanel.jsx';
import { AlertTriangle } from 'lucide-react';

const typeIcons = {
  email: '✉️',
  push: '📱',
  sms: '💬',
  journey: '🔄',
};

export default function CalendarAgentView({ agent, activeTab: activeTabProp, onTabChange }) {
  const { t, lang } = useLanguage();
  const [localTab, setLocalTab] = useState('calendar');
  const activeTab = activeTabProp !== undefined ? activeTabProp : localTab;
  const setActiveTab = (tab) => {
    setLocalTab(tab);
    if (onTabChange) onTabChange(tab);
  };
  useEffect(() => {
    if (onTabChange) onTabChange(localTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedDay, setSelectedDay] = useState(null);
  const pipeline = useAgentPipelineSession(agent.id);
  const handleWorkOnTicket = (ticket) => {
    pipeline.selectTicket(ticket);
    setActiveTab('chat');
  };
  const data = calendarAgentData;

  // Build calendar for March 2026
  const year = 2026;
  const month = 2; // 0-indexed, March
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon-start

  const dayNames = lang === 'en'
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  // Group events by day
  const eventsByDay = {};
  data.events.forEach((ev) => {
    const day = parseInt(ev.date.split('-')[2], 10);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  });

  // Conflict days
  const conflictDays = new Set(data.conflicts.map((c) => parseInt(c.date.split('-')[2], 10)));

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : null;

  // Next 7 days events
  const now = new Date(2026, 2, 9); // mock "today"
  const next7 = data.events
    .filter((ev) => {
      const d = new Date(ev.date);
      return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const tabs = [
    { id: 'calendar', label: 'Monthly Calendar', icon: AgentTabIcons.calendar },
    { id: 'tickets', label: t('tickets.tab'), icon: AgentTabIcons.tickets, count: pipeline.tickets.length, urgent: pipeline.hasUrgentTickets },
    { id: 'conflicts', label: 'Scheduling Conflicts', icon: AgentTabIcons.conflicts, count: data.conflicts.length },
    { id: 'upcoming', label: 'Upcoming 7 Days', icon: AgentTabIcons.upcoming },
    { id: 'chat', label: 'Chat', icon: AgentTabIcons.chat },
    { id: 'activity', label: 'Activity', icon: AgentTabIcons.activity },
    { id: 'settings', label: t('agentSettings.tab'), icon: AgentTabIcons.settings },
  ];

  const recentEvents = agent.recent_events || [];

  return (
    <>
      {/* Hero — Mini calendar */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px', textAlign: 'center' }}>
          {lang === 'en' ? 'MARCH' : 'MARZO'} 2026
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
          {/* Day headers */}
          {dayNames.map((d) => (
            <div key={d} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
          ))}
          {/* Empty offset cells */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const hasEvents = !!eventsByDay[day];
            const hasConflict = conflictDays.has(day);
            const isToday = day === todayDay;
            return (
              <div
                key={day}
                onClick={() => hasEvents && setSelectedDay(selectedDay === day ? null : day)}
                style={{
                  padding: '4px 2px', borderRadius: '6px', fontSize: '0.8rem', cursor: hasEvents ? 'pointer' : 'default',
                  fontWeight: hasEvents ? 700 : 400,
                  background: isToday ? 'rgba(99,102,241,0.2)' : hasEvents ? 'rgba(148,163,184,0.06)' : 'transparent',
                  border: isToday ? '1px solid #6366f1' : 'none',
                  position: 'relative',
                }}
              >
                {day}
                {hasEvents && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
                    {eventsByDay[day].slice(0, 3).map((ev) => (
                      <div key={ev.id} style={{ width: '5px', height: '5px', borderRadius: '50%', background: ev.color }} />
                    ))}
                  </div>
                )}
                {hasConflict && (
                  <span style={{ position: 'absolute', top: '-2px', right: '2px', fontSize: '0.6rem' }}><AlertTriangle size={10} style={{ color: '#f59e0b' }} /></span>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && eventsByDay[selectedDay] && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
              {lang === 'en' ? 'March' : 'Marzo'} {selectedDay}
            </div>
            {eventsByDay[selectedDay].map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '0.85rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{ev.campaign}</span>
                <span style={{ color: 'var(--text-muted)' }}>{typeIcons[ev.type]} {ev.type}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.8rem' }}>{ev.segment}</span>
              </div>
            ))}
          </div>
        )}
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
        {/* Calendar Tab — Full monthly view */}
        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              if (!eventsByDay[day]) return null;
              return (
                <div key={day} className="card animate-fade-in" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1.1rem',
                      background: conflictDays.has(day) ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)',
                      color: conflictDays.has(day) ? '#ef4444' : '#6366f1',
                    }}>
                      {day}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {eventsByDay[day].map((ev) => {
                        const bt = ev.bauType ? getBauTypeById(ev.bauType) : null;
                        const cat = bt ? getBauCategoryById(bt.category) : null;
                        return (
                          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{ev.campaign}</span>
                            {bt && cat && <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600, background: `${cat.color}15`, color: cat.color }}>{cat.icon} {bt.name}</span>}
                            <span style={{ color: 'var(--text-muted)' }}>{typeIcons[ev.type]} {ev.segment}</span>
                          </div>
                        );
                      })}
                    </div>
                    {conflictDays.has(day) && <span style={{ fontSize: '0.85rem' }}><AlertTriangle size={12} style={{ color: '#f59e0b' }} /></span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.conflicts.map((conf) => (
              <div key={conf.id} className="card animate-fade-in" style={{ padding: '16px', borderLeft: `3px solid ${conf.severity === 'high' ? '#ef4444' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                      {lang === 'en' ? 'March' : 'Marzo'} {parseInt(conf.date.split('-')[2], 10)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {conf.campaigns.map((c, i) => (
                        <span key={i} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <StatusBadge status={conf.severity} />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                  {conf.description}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('calendarAgent.affectedSegment') || 'Affected segment'}: <strong>{conf.segment}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Tab — Timeline */}
        {activeTab === 'upcoming' && (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(148,163,184,0.15)' }} />
            {next7.map((ev) => {
              const day = parseInt(ev.date.split('-')[2], 10);
              return (
                <div key={ev.id} className="animate-fade-in" style={{ display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute', left: '-20px', top: '6px',
                    width: '10px', height: '10px', borderRadius: '50%', background: ev.color,
                    border: '2px solid var(--bg-card, #1e293b)',
                  }} />
                  <div className="card" style={{ flex: 1, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ev.campaign}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {lang === 'en' ? 'Mar' : 'Mar'} {day}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>{typeIcons[ev.type]} {ev.type}</span>
                      <span style={{ color: 'rgba(148,163,184,0.4)' }}>|</span>
                      <span>{ev.segment}</span>
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
