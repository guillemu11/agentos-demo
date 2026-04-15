import React from 'react';
import { Zap } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import CampaignDetailCard from './CampaignDetailCard.jsx';

const DISMISS_KEY = 'calendar.dismissedAlerts.v1';
const REVIEWED_KEY = 'calendar.reviewedAlerts.v1';
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function loadDismissed() {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    const now = Date.now();
    const clean = {};
    for (const [id, at] of Object.entries(raw)) {
      if (now - at < DISMISS_TTL) clean[id] = at;
    }
    localStorage.setItem(DISMISS_KEY, JSON.stringify(clean));
    return clean;
  } catch { return {}; }
}

function saveDismissed(map) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch { /* quota / private mode */ }
}

function loadReviewed() {
  try {
    const raw = JSON.parse(localStorage.getItem(REVIEWED_KEY) || '{}');
    const now = Date.now();
    const clean = {};
    for (const [id, at] of Object.entries(raw)) {
      if (now - at < DISMISS_TTL) clean[id] = at;
    }
    localStorage.setItem(REVIEWED_KEY, JSON.stringify(clean));
    return clean;
  } catch { return {}; }
}

function saveReviewed(map) {
  try { localStorage.setItem(REVIEWED_KEY, JSON.stringify(map)); } catch { /* quota / private mode */ }
}

function cardClass(hit) {
  if (hit.type === 'risk') return hit.severity === 'high' ? 'risk-high' : 'risk-medium';
  if (hit.type === 'opportunity') return 'opp';
  return 'insight';
}

function cardTypeLabel(hit, t) {
  if (hit.type === 'risk') return `${t('calendar.aiPanel.risks').slice(0, -1)} · ${hit.severity}`;
  if (hit.type === 'opportunity') return `${t('calendar.aiPanel.opportunities').slice(0, -1)} · ${hit.severity}`;
  return `${t('calendar.aiPanel.insights').slice(0, -1)} · ${hit.severity}`;
}

export default function AiIntelligencePanel({ hits, enriched, freeformInsights, degraded, selectedEvent, onClearSelection, onNavigateToCampaign }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = React.useState(() => loadDismissed());
  const [reviewed, setReviewed] = React.useState(() => loadReviewed());

  const visibleHits = hits.filter(h => !dismissed[h.id]);
  const risks = visibleHits.filter(h => h.type === 'risk');
  const opps = visibleHits.filter(h => h.type === 'opportunity');
  const insights = visibleHits.filter(h => h.type === 'insight');

  const enrichedById = Object.fromEntries((enriched || []).map(e => [e.id, e]));

  const dismiss = (id) => {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    saveDismissed(next);
  };

  const toggleReviewed = (id) => {
    const next = { ...reviewed };
    if (next[id]) delete next[id];
    else next[id] = Date.now();
    setReviewed(next);
    saveReviewed(next);
  };

  const renderCard = (h) => {
    const en = enrichedById[h.id];
    const text = en?.narrative || h.title;
    return (
      <div key={h.id} className={`cal-ai-card ${cardClass(h)} ${reviewed[h.id] ? 'reviewed' : ''}`}>
        <div className="cal-ai-card-type">{cardTypeLabel(h, t)}</div>
        <div className="cal-ai-card-text">{text}</div>
        {en?.action && <div className="cal-ai-card-text" style={{ marginTop: 4, fontStyle: 'italic' }}>→ {en.action}</div>}
        <div className="cal-ai-card-meta">
          <span className="cal-ai-card-date">{h.dateRange.start}{h.dateRange.end !== h.dateRange.start ? ` → ${h.dateRange.end}` : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cal-ai-dismiss" onClick={() => toggleReviewed(h.id)}>
              {reviewed[h.id] ? '✓' : ''} {t('calendar.aiPanel.markReviewed')}
            </button>
            <button className="cal-ai-dismiss" onClick={() => dismiss(h.id)}>{t('calendar.aiPanel.dismiss')}</button>
            {h.campaignIds.length > 0 && (
              <button className="cal-ai-card-action" onClick={() => onNavigateToCampaign(h.campaignIds[0])}>
                {h.campaignIds.length > 1 ? t('calendar.aiPanel.viewCampaigns') : t('calendar.aiPanel.viewCampaign')} →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="cal-ai-panel">
      <div className="cal-ai-header">
        <div className="cal-ai-title"><Zap size={12} /> {t('calendar.aiPanel.title')}</div>
        <div className="cal-ai-powered">{t('calendar.aiPanel.powered')}</div>
        {degraded && <div className="cal-ai-powered" style={{ color: '#f59e0b', marginTop: 4 }}>{t('calendar.aiPanel.degraded')}</div>}
      </div>

      {visibleHits.length === 0 && (!Array.isArray(freeformInsights) || freeformInsights.length === 0) && (
        <div className="cal-ai-section"><div className="cal-ai-card-text">{t('calendar.aiPanel.empty')}</div></div>
      )}

      {risks.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#ef4444' }}>{t('calendar.aiPanel.risks')} ({risks.length})</div>
          {risks.map(renderCard)}
        </div>
      )}
      {opps.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#22c55e' }}>{t('calendar.aiPanel.opportunities')} ({opps.length})</div>
          {opps.map(renderCard)}
        </div>
      )}
      {insights.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#818cf8' }}>{t('calendar.aiPanel.insights')} ({insights.length})</div>
          {insights.map(renderCard)}
        </div>
      )}

      {Array.isArray(freeformInsights) && freeformInsights.length > 0 && (
        <div className="cal-ai-section">
          <div className="cal-ai-section-label" style={{ color: '#a78bfa' }}>{t('calendar.aiPanel.insights')} ({freeformInsights.length})</div>
          {freeformInsights.map((fi, i) => (
            <div key={fi.id || `free-${i}`} className="cal-ai-card insight">
              <div className="cal-ai-card-type">{t('calendar.aiPanel.insights').slice(0, -1)} · AI</div>
              <div className="cal-ai-card-text">
                {fi.title && <strong>{fi.title}. </strong>}
                {fi.narrative}
              </div>
              {fi.action && <div className="cal-ai-card-text" style={{ marginTop: 4, fontStyle: 'italic' }}>→ {fi.action}</div>}
            </div>
          ))}
        </div>
      )}

      {selectedEvent && <CampaignDetailCard event={selectedEvent} onClose={onClearSelection} />}
    </aside>
  );
}
