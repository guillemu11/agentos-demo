import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function daysInRange(startIso, endIso) {
  const s = new Date(startIso); const e = new Date(endIso);
  return Math.round((e - s) / 86400000) + 1;
}

function dayIndex(iso, rangeStart) {
  return Math.round((new Date(iso) - new Date(rangeStart)) / 86400000);
}

function isWeekend(iso) {
  const d = new Date(iso).getDay();
  return d === 0 || d === 6;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarGantt({ rangeStart, rangeEnd, events, ruleHits, onSelectEvent }) {
  const { t } = useLanguage();
  const totalDays = daysInRange(rangeStart, rangeEnd);
  const today = todayIso();
  const todayIdx = dayIndex(today, rangeStart);

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, label: d.getDate() });
  }

  const grouped = events.reduce((acc, ev) => {
    (acc[ev.group] = acc[ev.group] || []).push(ev);
    return acc;
  }, {});

  const rowsByGroup = Object.fromEntries(
    Object.entries(grouped).map(([g, evs]) => {
      const byCamp = {};
      for (const ev of evs) (byCamp[ev.campaignId] = byCamp[ev.campaignId] || []).push(ev);
      return [g, byCamp];
    })
  );

  const conflictDays = new Set(
    (ruleHits || []).filter(h => h.ruleId === 'segmentOverload').map(h => h.dateRange.start)
  );

  if (events.length === 0) {
    return <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('calendar.gantt.empty')}</div>;
  }

  const pct = (idx) => `${(idx / totalDays) * 100}%`;
  const widthPct = (startIdx, endIdx) => `${((endIdx - startIdx + 1) / totalDays) * 100}%`;

  return (
    <div className="cal-gantt">
      <div className="cal-gantt-header">
        <div className="cal-gantt-label-col">{t('calendar.gantt.campaign')}</div>
        <div className="cal-gantt-days">
          {days.map(d => (
            <div key={d.iso}
              className={`cal-gantt-day-header ${d.iso === today ? 'today' : ''} ${isWeekend(d.iso) ? 'weekend' : ''}`}>
              {d.label}
            </div>
          ))}
        </div>
      </div>

      {Object.entries(rowsByGroup).map(([groupId, rows]) => {
        const firstRowKey = Object.keys(rows)[0];
        const firstColor = rows[firstRowKey][0].color;
        return (
          <React.Fragment key={groupId}>
            <div className="cal-group-header">
              <div className="cal-group-label-col">
                <span className="cal-group-name" style={{ color: firstColor }}>
                  {t(`calendar.groups.${groupId}`) || groupId}
                </span>
                <span className="cal-group-count">{Object.keys(rows).length} campaigns</span>
              </div>
              <div className="cal-group-line" />
            </div>

            {Object.entries(rows).map(([campaignId, evs]) => {
              const name = evs[0].campaignName;
              const color = evs[0].color;
              return (
                <div key={campaignId} className="cal-row">
                  <div className="cal-row-label">
                    <div className="cal-row-dot" style={{ background: color }} />
                    <span className="cal-row-name">{name}</span>
                  </div>
                  <div className="cal-row-cells">
                    {evs.map(ev => {
                      const startIdx = Math.max(0, dayIndex(ev.startDate, rangeStart));
                      const endIdx = Math.min(totalDays - 1, dayIndex(ev.endDate, rangeStart));
                      const isAlwaysOn = ev.flavor === 'always-on';
                      const style = {
                        left: pct(startIdx),
                        width: widthPct(startIdx, endIdx),
                        background: isAlwaysOn ? `repeating-linear-gradient(45deg, ${color}55, ${color}55 6px, ${color}33 6px, ${color}33 12px)` : color,
                        borderColor: isAlwaysOn ? color : 'transparent',
                      };
                      return (
                        <button key={ev.id} className={`cal-bar ${isAlwaysOn ? 'always-on' : ''}`}
                          style={style}
                          onClick={() => onSelectEvent(ev)}>
                          <span className="cal-bar-dot" />
                          {isAlwaysOn && ev.projectedVolume
                            ? `${ev.campaignName} · ~${Math.round(ev.projectedVolume / 1000)}K/mo`
                            : ev.campaignName}
                        </button>
                      );
                    })}
                    {[...conflictDays].map(cd => {
                      const idx = dayIndex(cd, rangeStart);
                      if (idx < 0 || idx >= totalDays) return null;
                      return <div key={cd} className="cal-conflict-line" style={{ left: pct(idx + 0.5) }} />;
                    })}
                    {todayIdx >= 0 && todayIdx < totalDays && (
                      <div className="cal-today-line" style={{ left: pct(todayIdx + 0.5) }} />
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
