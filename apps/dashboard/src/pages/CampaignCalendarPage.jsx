import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CalendarTopbar from '../components/calendar/CalendarTopbar.jsx';
import CalendarFilterBar from '../components/calendar/CalendarFilterBar.jsx';
import CalendarGantt from '../components/calendar/CalendarGantt.jsx';
import AiIntelligencePanel from '../components/calendar/AiIntelligencePanel.jsx';
import { buildCalendarEvents } from '../lib/calendarEvents.js';
import { runAllRules, computeHealthScore } from '../lib/calendarAiRules.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ALL_CATEGORIES = ['broadcast', 'offers', 'loyalty', 'lifecycle', 'partner', 'route'];

const GROUP_TO_CATEGORY = {
  broadcast: 'broadcast', offers: 'offers', partner: 'partner', route: 'route',
  lifecycle: 'lifecycle', 'loyalty-tiers': 'loyalty', 'abandon-recovery': 'lifecycle',
  'preflight-journey': 'lifecycle', 'postflight-engagement': 'lifecycle',
  onboarding: 'lifecycle', communications: 'lifecycle', engagement: 'lifecycle',
};

function rangeForScaleDate(scale, date) {
  const y = date.getFullYear(), m = date.getMonth();
  if (scale === 'year') {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  if (scale === 'week') {
    const start = new Date(date);
    const dow = start.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + offset);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { start: toIso(start), end: toIso(end) };
  }
  if (scale === 'day') {
    return { start: toIso(date), end: toIso(date) };
  }
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return { start: toIso(first), end: toIso(last) };
}

function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function navigateDate(date, scale, delta) {
  const next = new Date(date);
  if (scale === 'year') next.setFullYear(next.getFullYear() + delta);
  else if (scale === 'week') next.setDate(next.getDate() + 7 * delta);
  else if (scale === 'day') next.setDate(next.getDate() + delta);
  else next.setMonth(next.getMonth() + delta);
  return next;
}

export default function CampaignCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const scale = searchParams.get('scale') || 'month';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [categories, setCategories] = useState(ALL_CATEGORIES);
  const [channels, setChannels] = useState(['email']);
  const [enriched, setEnriched] = useState([]);
  const [degraded, setDegraded] = useState(false);

  const range = useMemo(() => rangeForScaleDate(scale, currentDate), [scale, currentDate]);

  const allEvents = useMemo(() => buildCalendarEvents(range.start, range.end), [range.start, range.end]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const cat = GROUP_TO_CATEGORY[ev.group] || ev.group;
      if (!categories.includes(cat)) return false;
      if (!channels.includes(ev.channel)) return false;
      return true;
    });
  }, [allEvents, categories, channels]);

  const ruleHits = useMemo(() => runAllRules(filteredEvents, range), [filteredEvents, range]);
  const healthScore = useMemo(() => computeHealthScore(ruleHits), [ruleHits]);

  useEffect(() => {
    let cancelled = false;
    if (ruleHits.length === 0) { setEnriched([]); setDegraded(false); return; }
    fetch(`${API_URL}/calendar/ai-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ events: filteredEvents, ruleHits, rangeStart: range.start, rangeEnd: range.end }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setEnriched(data.enriched || []);
        setDegraded(!!data.degraded);
      })
      .catch(() => {
        if (cancelled) return;
        setEnriched([]);
        setDegraded(true);
      });
    return () => { cancelled = true; };
  }, [ruleHits, range.start, range.end, filteredEvents]);

  const toggleCat = (id) => setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleChan = (id) => setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const onScaleChange = (s) => {
    const next = new URLSearchParams(searchParams);
    next.set('scale', s);
    setSearchParams(next, { replace: true });
  };

  const onNavigate = (delta) => setCurrentDate(d => navigateDate(d, scale, delta));

  const onNavigateToCampaign = (campaignId) => {
    navigate(`/app/campaigns?highlight=${encodeURIComponent(campaignId)}`);
  };

  return (
    <div className="cal-shell">
      <CalendarTopbar
        currentDate={currentDate}
        onNavigate={onNavigate}
        scale={scale}
        onScaleChange={onScaleChange}
        healthScore={healthScore}
        onToggleFilters={() => {}}
      />
      <CalendarFilterBar
        categories={categories}
        channels={channels}
        onToggleCategory={toggleCat}
        onToggleChannel={toggleChan}
      />
      <div className="cal-main">
        <div className="cal-gantt-wrap">
          <CalendarGantt
            rangeStart={range.start}
            rangeEnd={range.end}
            events={filteredEvents}
            ruleHits={ruleHits}
            onSelectEvent={setSelectedEvent}
          />
        </div>
        <AiIntelligencePanel
          hits={ruleHits}
          enriched={enriched}
          degraded={degraded}
          selectedEvent={selectedEvent}
          onClearSelection={() => setSelectedEvent(null)}
          onNavigateToCampaign={onNavigateToCampaign}
        />
      </div>
    </div>
  );
}
