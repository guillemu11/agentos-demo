import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const CATEGORY_COLORS = {
  broadcast: '#D71920', offers: '#D4AF37', loyalty: '#D4AF37',
  lifecycle: '#06b6d4', partner: '#6366f1', route: '#10b981',
};

const CATEGORIES = ['broadcast', 'offers', 'loyalty', 'lifecycle', 'partner', 'route'];
const CHANNELS = ['email', 'sms', 'push'];

export default function CalendarFilterBar({ categories, channels, onToggleCategory, onToggleChannel }) {
  const { t } = useLanguage();

  const catChip = (id) => {
    const active = categories.includes(id);
    const color = CATEGORY_COLORS[id];
    return (
      <button key={id}
        className={`cal-chip ${active ? 'active' : ''}`}
        onClick={() => onToggleCategory(id)}
        style={active ? { borderColor: color, color, background: `${color}20` } : {}}>
        {t(`calendar.category.${id}`)}
      </button>
    );
  };

  const chanChip = (id) => {
    const active = channels.includes(id);
    return (
      <button key={id} className={`cal-chip ${active ? 'active' : ''}`}
        onClick={() => onToggleChannel(id)}
        style={active ? { borderColor: '#6366f1', color: '#818cf8', background: 'rgba(99,102,241,0.1)' } : {}}>
        {t(`calendar.channel.${id}`)}
      </button>
    );
  };

  return (
    <div className="cal-filter-row">
      <span className="cal-filter-label">{t('calendar.filterType')}</span>
      {CATEGORIES.map(catChip)}
      <div className="cal-chip-divider" />
      <span className="cal-filter-label">{t('calendar.filterChannel')}</span>
      {CHANNELS.map(chanChip)}
    </div>
  );
}
