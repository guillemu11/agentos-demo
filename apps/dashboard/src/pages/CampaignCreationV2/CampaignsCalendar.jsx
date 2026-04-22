import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { briefsApi } from './lib/briefsApi.js';
import { BAU_CATEGORIES, getBauTypeById } from '../../data/emiratesBauTypes.js';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function firstOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

export default function CampaignsCalendar() {
  const [briefs, setBriefs] = useState([]);
  const [cursor, setCursor] = useState(() => firstOfMonth(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    briefsApi.list()
      .then(({ briefs }) => setBriefs(briefs))
      .catch(err => console.error('[calendar] load failed', err))
      .finally(() => setLoading(false));
  }, []);

  const { year, month, days, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    return {
      year, month, days: cells,
      monthLabel: cursor.toLocaleString('default', { month: 'long', year: 'numeric' }),
    };
  }, [cursor]);

  const byDay = (date) => briefs.filter(b => {
    if (!b.send_date) return false;
    if (b.status === 'dismissed') return false;
    return sameDay(new Date(b.send_date), date);
  });

  const colorForBrief = (b) => {
    const t = getBauTypeById(b.template_id);
    return (t && BAU_CATEGORIES[t.category]?.color) || 'var(--text-muted)';
  };

  const shift = (delta) => setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  const goToday = () => setCursor(firstOfMonth(new Date()));

  return (
    <div className="cc2-calendar">
      <header className="cc2-cal-header">
        <div className="cc2-cal-title">{monthLabel}</div>
        <div className="cc2-cal-nav">
          <button className="cc2-btn" onClick={() => shift(-1)} type="button" aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button className="cc2-btn" onClick={goToday} type="button">Today</button>
          <button className="cc2-btn" onClick={() => shift(1)} type="button" aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {loading && <div className="cc2-empty">Loading…</div>}

      {!loading && (
        <>
          <div className="cc2-cal-grid">
            {DOW.map((d, i) => <div key={`dow-${i}`} className="cc2-cal-dow">{d}</div>)}
            {days.map((date, i) => date ? (
              <div key={i} className="cc2-cal-cell">
                <div className="cc2-cal-cell__num">{date.getDate()}</div>
                {byDay(date).map(b => (
                  <div
                    key={b.id}
                    className="cc2-cal-event"
                    style={{ borderLeftColor: colorForBrief(b) }}
                    title={b.name || '(untitled)'}
                  >
                    {b.name || '(untitled)'}
                  </div>
                ))}
              </div>
            ) : <div key={`e-${i}`} className="cc2-cal-cell empty" />)}
          </div>

          <div className="cc2-cal-legend">
            {Object.values(BAU_CATEGORIES).map(c => (
              <span key={c.id} className="cc2-cal-legend-item">
                <span className="cc2-cal-swatch" style={{ background: c.color }} />
                {c.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
