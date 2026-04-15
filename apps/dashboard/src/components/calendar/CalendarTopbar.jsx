import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

function monthLabel(date, lang) {
  return date.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
}

export default function CalendarTopbar({ currentDate, onNavigate, scale, onScaleChange, onToggleFilters, healthScore }) {
  const { t, lang } = useLanguage();
  const band = healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'crit';

  return (
    <div className="cal-topbar">
      <span className="cal-title">
        <Calendar size={16} color="#6366f1" />
        {t('calendar.pageTitle')}
      </span>

      <div className="cal-month-nav">
        <button className="cal-nav-btn" onClick={() => onNavigate(-1)} title={t('calendar.monthPrev')}>
          <ChevronLeft size={14} />
        </button>
        <span className="cal-month-label">{monthLabel(currentDate, lang)}</span>
        <button className="cal-nav-btn" onClick={() => onNavigate(1)} title={t('calendar.monthNext')}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="cal-view-switcher">
        {['year', 'month', 'week', 'day'].map(s => (
          <button key={s} className={`cal-view-btn ${scale === s ? 'active' : ''}`} onClick={() => onScaleChange(s)}>
            {t(`calendar.view.${s}`)}
          </button>
        ))}
      </div>

      <button className="cal-filter-btn" onClick={onToggleFilters}>
        <Filter size={12} /> {t('calendar.filterBtn')}
      </button>

      <div className="cal-spacer" />

      <div className="cal-health-score">
        <div>
          <div className="cal-health-label">{t('calendar.healthLabel')}</div>
          <div className="cal-health-bar">
            <div className={`cal-health-bar-fill ${band}`} style={{ width: `${healthScore}%` }} />
          </div>
        </div>
        <div>
          <div className={`cal-health-value ${band}`}>{healthScore}</div>
          <div className="cal-health-sub">{t('calendar.healthOf')}</div>
        </div>
      </div>
    </div>
  );
}
