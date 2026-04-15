import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';
import { spyNetworkData } from '../data/agentViewMocks.js';
import { ArrowLeft, Mail, ShoppingCart, Clock, Search, Download, Code, Pin, Tag, Users, Eye, Zap } from 'lucide-react';

const engagementTypes = {
  'cart-abandon': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  'newsletter':  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  'loyalty':     { color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.3)' },
  'multi-market':{ color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)' },
  'new-signup':  { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)' },
  'active-buyer':{ color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
};

const emailCategoryColors = {
  promo: '#6366f1',
  loyalty: '#22c55e',
  transactional: '#f59e0b',
  newsletter: '#3b82f6',
  retargeting: '#ec4899',
  other: '#94a3b8',
};

const timelineTypeConfig = {
  'tier-change':   { color: '#818cf8', icon: '★' },
  'purchase':      { color: '#22c55e', icon: '✈' },
  'email-cluster': { color: '#f59e0b', icon: '✉' },
  'cart-abandon':  { color: '#ef4444', icon: '🛒' },
  'signup':        { color: '#a855f7', icon: '●' },
  'email':         { color: '#3b82f6', icon: '✉' },
  'newsletter':    { color: '#22c55e', icon: '📰' },
};

const timelineFilterTypes = ['all', 'email-cluster', 'purchase', 'tier-change', 'cart-abandon'];

function engagementLabel(type, t) {
  const map = {
    'cart-abandon': t('spyNetwork.cartAbandon'),
    'newsletter': t('spyNetwork.newsletter'),
    'loyalty': t('spyNetwork.loyaltyTier'),
    'multi-market': t('spyNetwork.multiMarket'),
    'new-signup': t('spyNetwork.newSignup'),
    'active-buyer': t('spyNetwork.activeBuyer'),
  };
  return map[type] || type;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return dateStr;
}

// ─── PersonaCard ─────────────────────────────────────────────────────────────
function PersonaCard({ persona, onClick, t }) {
  const et = engagementTypes[persona.engagementType] || engagementTypes['active-buyer'];
  return (
    <div className="spy-persona-card" onClick={onClick}>
      <div className="spy-card-header">
        <div
          className="spy-avatar"
          style={{ background: `linear-gradient(135deg, ${persona.avatarGradient[0]}, ${persona.avatarGradient[1]})` }}
        >
          {persona.initials}
        </div>
        <div className="spy-card-info">
          <div className="spy-card-name">{persona.name}</div>
          <div className="spy-card-sub">{persona.competitorName} · {persona.market}</div>
        </div>
        <span
          className="spy-badge"
          style={{ background: et.bg, color: et.color, border: `1px solid ${et.border}` }}
        >
          {persona.tier || engagementLabel(persona.engagementType, t)}
        </span>
      </div>
      <div className="spy-card-tags">
        {persona.tags.map((tag, i) => (
          <span key={i} className="spy-tag" style={{ background: 'var(--theme-indigo-soft)', color: 'var(--theme-indigo)' }}>
            {tag}
          </span>
        ))}
      </div>
      <div className="spy-card-footer">
        <span><Mail size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{persona.stats.emailsReceived} emails</span>
        <span><ShoppingCart size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{persona.stats.purchases} {t('spyNetwork.purchases').toLowerCase()}</span>
        <span><Clock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />{formatDate(persona.stats.lastActivity)}</span>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab({ persona, t }) {
  const bd = persona.emailBreakdown;
  const total = Object.values(bd).reduce((a, b) => a + b, 0);
  return (
    <div className="spy-tab-content">
      <div className="spy-kpi-row">
        <div className="spy-kpi">
          <div className="spy-kpi-label">{t('spyNetwork.emailsReceived')}</div>
          <div className="spy-kpi-value">{persona.stats.emailsReceived}</div>
        </div>
        <div className="spy-kpi">
          <div className="spy-kpi-label">{t('spyNetwork.purchases')}</div>
          <div className="spy-kpi-value">{persona.stats.purchases}</div>
        </div>
        <div className="spy-kpi">
          <div className="spy-kpi-label">{t('spyNetwork.loyaltyTier')}</div>
          <div className="spy-kpi-value" style={{ color: persona.tierColor || 'var(--text-main)' }}>
            {persona.tier || '—'}
          </div>
          {persona.stats.loyaltyPoints > 0 && (
            <div className="spy-kpi-sub">{persona.stats.loyaltyPoints.toLocaleString()} pts</div>
          )}
        </div>
        <div className="spy-kpi">
          <div className="spy-kpi-label">{t('spyNetwork.avgEmailWeek')}</div>
          <div className="spy-kpi-value">{persona.stats.avgEmailsPerWeek}</div>
        </div>
        <div className="spy-kpi">
          <div className="spy-kpi-label">{t('spyNetwork.daysActive')}</div>
          <div className="spy-kpi-value">{persona.stats.daysActive}</div>
        </div>
      </div>

      <div className="spy-two-col">
        <div className="spy-panel">
          <div className="spy-panel-title">{t('spyNetwork.profileDetails')}</div>
          {[
            [t('spyNetwork.email'), persona.email],
            [t('spyNetwork.competitor'), persona.competitorName],
            [t('spyNetwork.market'), persona.market],
            [t('spyNetwork.language'), persona.language],
            [t('spyNetwork.program'), persona.program],
            [t('spyNetwork.engagementType'), engagementLabel(persona.engagementType, t)],
            [t('spyNetwork.created'), persona.createdAt],
          ].map(([label, value], i) => (
            <div key={i} className="spy-detail-row">
              <span className="spy-detail-row-label">{label}</span>
              <span className="spy-detail-row-value">{value}</span>
            </div>
          ))}
        </div>
        <div className="spy-panel">
          <div className="spy-panel-title">{t('spyNetwork.recentActivity')}</div>
          <div className="spy-activity-item">
            <div className="spy-activity-dot" style={{ background: 'var(--theme-indigo)' }} />
            <div>
              <div className="spy-activity-text">
                {typeof persona.recentActivity === 'string'
                  ? persona.recentActivity
                  : persona.recentActivity?.map(a => a.description).join(', ')}
              </div>
              <div className="spy-activity-date">{formatDate(persona.stats.lastActivity)}</div>
            </div>
          </div>
          {persona.timeline.slice(0, 3).map(evt => {
            const cfg = timelineTypeConfig[evt.type] || { color: '#666', icon: '●' };
            return (
              <div key={evt.id} className="spy-activity-item">
                <div className="spy-activity-dot" style={{ background: cfg.color }} />
                <div>
                  <div className="spy-activity-text">{evt.title}</div>
                  <div className="spy-activity-date">{evt.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="spy-breakdown">
        <div className="spy-panel-title">{t('spyNetwork.emailBreakdown')}</div>
        <div className="spy-breakdown-bar">
          {Object.entries(bd).map(([cat, count]) => (
            <div
              key={cat}
              style={{
                width: `${(count / total) * 100}%`,
                background: emailCategoryColors[cat] || '#94a3b8',
              }}
              title={`${cat}: ${count}`}
            />
          ))}
        </div>
        <div className="spy-breakdown-legend">
          {Object.entries(bd).map(([cat, count]) => (
            <span key={cat}>
              <span className="spy-breakdown-dot" style={{ background: emailCategoryColors[cat] || '#94a3b8' }} />
              {t(`spyNetwork.${cat}`) || cat} {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Tab ────────────────────────────────────────────────────────────
function TimelineTab({ persona, t }) {
  const [filter, setFilter] = useState('all');
  const events = filter === 'all'
    ? persona.timeline
    : persona.timeline.filter(e => e.type === filter);

  const filterLabels = {
    all: t('spyNetwork.allEvents'),
    'email-cluster': t('spyNetwork.emailsOnly'),
    purchase: t('spyNetwork.purchases'),
    'tier-change': t('spyNetwork.tierChanges'),
    'cart-abandon': t('spyNetwork.cartAbandon'),
  };

  return (
    <div className="spy-tab-content">
      <div className="spy-filter-group" style={{ marginBottom: 16 }}>
        {timelineFilterTypes.map(f => (
          <button
            key={f}
            className={`spy-filter-pill${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {filterLabels[f] || f}
          </button>
        ))}
      </div>
      <div className="spy-timeline">
        {events.map(evt => {
          const cfg = timelineTypeConfig[evt.type] || { color: '#666', icon: '●' };
          return (
            <div key={evt.id} className="spy-timeline-event">
              <div className="spy-timeline-dot" style={{ background: cfg.color, color: '#fff' }}>
                {cfg.icon}
              </div>
              <div
                className="spy-timeline-card"
                style={{ background: `${cfg.color}08`, borderColor: `${cfg.color}22` }}
              >
                <div className="spy-timeline-card-header">
                  <span className="spy-timeline-title" style={{ color: cfg.color }}>{evt.title}</span>
                  <span className="spy-timeline-date">{evt.date}</span>
                </div>
                <div className="spy-timeline-desc">{evt.description}</div>
                {evt.tags && (
                  <div className="spy-timeline-tags">
                    {evt.tags.map((tag, i) => (
                      <span key={i} className="spy-tag" style={{ background: `${cfg.color}15`, color: cfg.color }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="spy-empty">
            <div className="spy-empty-icon"><Clock size={48} /></div>
            <p>No events match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Emails Tab ──────────────────────────────────────────────────────────────
function EmailsTab({ persona, t }) {
  const [selectedId, setSelectedId] = useState(persona.emails[0]?.id || null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const categories = ['all', 'promo', 'loyalty', 'transactional', 'retargeting', 'newsletter'];
  const catLabels = {
    all: t('spyNetwork.filterAll'),
    promo: t('spyNetwork.promo'),
    loyalty: t('spyNetwork.loyalty'),
    transactional: t('spyNetwork.transactional'),
    retargeting: t('spyNetwork.retargeting'),
    newsletter: t('spyNetwork.newsletter'),
  };

  const filtered = persona.emails.filter(e => {
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    if (search && !e.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = persona.emails.find(e => e.id === selectedId) || filtered[0];

  return (
    <div className="spy-tab-content">
      <div className="spy-search">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t('spyNetwork.searchEmails')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        {categories.map(cat => (
          <button
            key={cat}
            className={`spy-filter-pill${catFilter === cat ? ' active' : ''}`}
            onClick={() => setCatFilter(cat)}
          >
            {catLabels[cat] || cat}
          </button>
        ))}
      </div>
      <div className="spy-email-split">
        <div className="spy-email-list">
          {filtered.map(email => (
            <div
              key={email.id}
              className={`spy-email-item${email.id === (selected?.id) ? ' selected' : ''}`}
              onClick={() => setSelectedId(email.id)}
            >
              <div className="spy-email-subject">
                <span className="spy-email-subject-text">{email.subject}</span>
                <span className="spy-email-date">{email.date}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <span className="spy-tag" style={{
                  background: `${emailCategoryColors[email.category]}15`,
                  color: emailCategoryColors[email.category],
                }}>
                  {catLabels[email.category] || email.category}
                </span>
                {email.opened && (
                  <span className="spy-tag" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Opened
                  </span>
                )}
                {email.clicked && (
                  <span className="spy-tag" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    Clicked
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="spy-empty" style={{ padding: 40 }}>
              <Mail size={32} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 8, fontSize: 12 }}>No emails match</p>
            </div>
          )}
        </div>
        <div className="spy-email-preview">
          {selected ? (
            <>
              <div className="spy-email-preview-header">
                <div>
                  <div className="spy-email-preview-subject">{selected.subject}</div>
                  <div className="spy-email-preview-from">{persona.competitorName} · {selected.date}</div>
                </div>
                <div className="spy-email-preview-actions">
                  <button className="spy-btn"><Code size={12} style={{ marginRight: 4 }} />{t('spyNetwork.viewHtml')}</button>
                  <button className="spy-btn"><Download size={12} style={{ marginRight: 4 }} />{t('spyNetwork.download')}</button>
                </div>
              </div>
              <div className="spy-email-mock">
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, color: persona.avatarGradient[0] }}>
                    {persona.competitorName.toUpperCase()}
                  </div>
                </div>
                <div style={{
                  background: `linear-gradient(135deg, ${persona.avatarGradient[0]}, ${persona.avatarGradient[1]})`,
                  color: '#fff', padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, opacity: 0.8, marginBottom: 8 }}>
                    {persona.tier ? `EXCLUSIVE FOR ${persona.tier.toUpperCase()} MEMBERS` : persona.competitorName.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.subject}</div>
                </div>
                <div style={{ fontSize: 11, color: '#666', textAlign: 'center' }}>
                  Mock preview · {t('spyNetwork.viewHtml')} for actual email source
                </div>
              </div>
            </>
          ) : (
            <div className="spy-empty">
              <Mail size={32} style={{ opacity: 0.3 }} />
              <p>Select an email to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notes Tab ───────────────────────────────────────────────────────────────
function NotesTab({ persona, t }) {
  const sorted = [...persona.notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  return (
    <div className="spy-tab-content">
      <div className="spy-note-input">
        <textarea placeholder={t('spyNetwork.addNote')} />
        <div className="spy-note-input-actions">
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="spy-btn"><Pin size={12} style={{ marginRight: 4 }} />{t('spyNetwork.pin')}</button>
            <button className="spy-btn"><Tag size={12} style={{ marginRight: 4 }} />{t('spyNetwork.tag')}</button>
          </div>
          <button className="spy-btn spy-btn-primary">{t('spyNetwork.saveNote')}</button>
        </div>
      </div>
      {sorted.map(note => (
        <div key={note.id} className={`spy-note${note.pinned ? ' pinned' : ''}`}>
          <div className="spy-note-header">
            <div className="spy-note-title">
              {note.pinned && <Pin size={12} style={{ color: 'var(--theme-amber)' }} />}
              {note.tags?.[0] || 'Note'}
              {note.pinned && (
                <span className="spy-badge" style={{
                  background: 'var(--theme-amber-soft)',
                  color: 'var(--theme-amber)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  fontSize: 9,
                }}>
                  {t('spyNetwork.pinned')}
                </span>
              )}
            </div>
            <span className="spy-note-author">{note.date}</span>
          </div>
          <div className="spy-note-content">{note.text || note.content}</div>
          {note.tags && note.tags.length > 0 && (
            <div className="spy-note-tags">
              {note.tags.map((tag, i) => (
                <span key={i} className="spy-tag" style={{ background: 'var(--theme-indigo-soft)', color: 'var(--theme-indigo)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Detail View ─────────────────────────────────────────────────────────────
function PersonaDetail({ persona, onBack, t }) {
  const [activeTab, setActiveTab] = useState('overview');
  const et = engagementTypes[persona.engagementType] || engagementTypes['active-buyer'];

  const tabs = [
    { id: 'overview', label: t('spyNetwork.overview') },
    { id: 'timeline', label: t('spyNetwork.timeline') },
    { id: 'emails', label: t('spyNetwork.emails'), count: persona.emails.length },
    { id: 'notes', label: t('spyNetwork.notes'), count: persona.notes.length },
    {
      id: 'ai-ideas',
      label: '✦ AI Ideas',
      count: AI_PROPOSALS.competitorAnalysis.filter(p => p.priority === 'high' || p.priority === 'urgent').length,
    },
  ];

  return (
    <div className="spy-detail">
      <div className="spy-detail-back" onClick={onBack}>
        <ArrowLeft size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
        {t('spyNetwork.backToNetwork')}
      </div>
      <div className="spy-detail-header">
        <div
          className="spy-avatar large"
          style={{ background: `linear-gradient(135deg, ${persona.avatarGradient[0]}, ${persona.avatarGradient[1]})` }}
        >
          {persona.initials}
        </div>
        <div className="spy-detail-header-info">
          <div className="spy-detail-name">
            <h2>{persona.name}</h2>
            {persona.tier && (
              <span className="spy-badge" style={{
                background: `${persona.tierColor}22`,
                color: persona.tierColor,
                border: `1px solid ${persona.tierColor}44`,
              }}>
                {persona.tier}
              </span>
            )}
            <span className="spy-badge" style={{
              background: et.bg, color: et.color, border: `1px solid ${et.border}`,
            }}>
              {engagementLabel(persona.engagementType, t)}
            </span>
          </div>
          <div className="spy-detail-meta">
            {persona.competitorName} · {persona.market} · {persona.program} · {t('spyNetwork.created')}: {persona.createdAt}
          </div>
        </div>
        <div className="spy-detail-actions">
          <button className="spy-btn spy-btn-primary">{t('spyNetwork.editProfile')}</button>
        </div>
      </div>

      <div className="spy-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`spy-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count != null && <span className="spy-tab-count">{tab.count}</span>}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab persona={persona} t={t} />}
      {activeTab === 'timeline' && <TimelineTab persona={persona} t={t} />}
      {activeTab === 'emails' && <EmailsTab persona={persona} t={t} />}
      {activeTab === 'notes' && <NotesTab persona={persona} t={t} />}
      {activeTab === 'ai-ideas' && (
        <AIIdeasTab
          proposals={AI_PROPOSALS.competitorAnalysis}
          onDemand={false}
          metaText="Background scan · 45 min ago"
        />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CompetitorAnalysisPage() {
  const { t } = useLanguage();
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [competitorFilter, setCompetitorFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState('all');

  const personas = Array.isArray(spyNetworkData) ? spyNetworkData : spyNetworkData.personas;

  const competitors = useMemo(() => {
    const counts = {};
    personas.forEach(p => {
      counts[p.competitor] = (counts[p.competitor] || 0) + 1;
    });
    return Object.entries(counts).map(([id, count]) => {
      const persona = personas.find(p => p.competitor === id);
      return { id, name: persona?.competitorName || id, count };
    });
  }, [personas]);

  const engagementCounts = useMemo(() => {
    const counts = {};
    personas.forEach(p => {
      counts[p.engagementType] = (counts[p.engagementType] || 0) + 1;
    });
    return counts;
  }, [personas]);

  const filtered = useMemo(() => {
    return personas.filter(p => {
      if (competitorFilter !== 'all' && p.competitor !== competitorFilter) return false;
      if (engagementFilter !== 'all' && p.engagementType !== engagementFilter) return false;
      return true;
    });
  }, [personas, competitorFilter, engagementFilter]);

  if (selectedPersona) {
    return (
      <div className="spy-network">
        <PersonaDetail
          persona={selectedPersona}
          onBack={() => setSelectedPersona(null)}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className="spy-network">
      <div className="spy-network-header">
        <h1>{t('spyNetwork.title')}</h1>
      </div>

      <div className="spy-intro">
        <p className="spy-intro-description">{t('spyNetwork.introDescription')}</p>
        <div className="spy-intro-benefits">
          <div className="spy-intro-benefit">
            <div className="spy-intro-benefit-icon" style={{ background: 'var(--theme-indigo-soft)', color: 'var(--theme-indigo)' }}>
              <Users size={18} />
            </div>
            <div>
              <div className="spy-intro-benefit-title">{t('spyNetwork.introBenefit1Title')}</div>
              <div className="spy-intro-benefit-text">{t('spyNetwork.introBenefit1Text')}</div>
            </div>
          </div>
          <div className="spy-intro-benefit">
            <div className="spy-intro-benefit-icon" style={{ background: 'var(--theme-green-soft)', color: 'var(--theme-green)' }}>
              <Eye size={18} />
            </div>
            <div>
              <div className="spy-intro-benefit-title">{t('spyNetwork.introBenefit2Title')}</div>
              <div className="spy-intro-benefit-text">{t('spyNetwork.introBenefit2Text')}</div>
            </div>
          </div>
          <div className="spy-intro-benefit">
            <div className="spy-intro-benefit-icon" style={{ background: 'var(--theme-amber-soft)', color: 'var(--theme-amber)' }}>
              <Zap size={18} />
            </div>
            <div>
              <div className="spy-intro-benefit-title">{t('spyNetwork.introBenefit3Title')}</div>
              <div className="spy-intro-benefit-text">{t('spyNetwork.introBenefit3Text')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="spy-network-filters">
        <div className="spy-filter-group">
          <button
            className={`spy-filter-pill${competitorFilter === 'all' ? ' active' : ''}`}
            onClick={() => setCompetitorFilter('all')}
          >
            {t('spyNetwork.filterAll')} ({personas.length})
          </button>
          {competitors.map(c => (
            <button
              key={c.id}
              className={`spy-filter-pill${competitorFilter === c.id ? ' active' : ''}`}
              onClick={() => setCompetitorFilter(c.id)}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        <div className="spy-filter-group">
          {Object.keys(engagementTypes).map(type => (
            <button
              key={type}
              className={`spy-filter-pill${engagementFilter === type ? ' active' : ''}`}
              onClick={() => setEngagementFilter(engagementFilter === type ? 'all' : type)}
              style={engagementFilter === type ? {
                background: engagementTypes[type].bg,
                color: engagementTypes[type].color,
                borderColor: engagementTypes[type].border,
              } : {}}
            >
              {engagementLabel(type, t)} {engagementCounts[type] ? `(${engagementCounts[type]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="spy-persona-grid">
        {filtered.map(persona => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            onClick={() => setSelectedPersona(persona)}
            t={t}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="spy-empty">
          <div className="spy-empty-icon"><Search size={48} /></div>
          <p>No personas match the selected filters</p>
        </div>
      )}
    </div>
  );
}
