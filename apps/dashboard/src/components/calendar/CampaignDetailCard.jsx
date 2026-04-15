import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function CampaignDetailCard({ event, onClose }) {
  const { t } = useLanguage();
  if (!event) return null;
  const k = event.kpis || {};
  return (
    <div className="cal-detail">
      <div className="cal-detail-title">
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.color, flexShrink: 0 }} />
        {event.campaignName}
        <button className="cal-detail-close" onClick={onClose} title={t('calendar.detail.close')}>×</button>
      </div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.date')}</span><span className="cal-detail-val">{event.startDate === event.endDate ? event.startDate : `${event.startDate} → ${event.endDate}`}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.segment')}</span><span className="cal-detail-val">{event.segment || '—'}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.channel')}</span><span className="cal-detail-val">{event.channel} · {event.language || '—'}</span></div>
      <div className="cal-detail-row"><span className="cal-detail-key">{t('calendar.detail.status')}</span><span className="cal-detail-val" style={{ color: event.status === 'live' || event.status === 'launched' ? '#22c55e' : '#f59e0b' }}>{event.status}</span></div>
      {event.kpis && (
        <div className="cal-kpi-row">
          <div className="cal-kpi-box"><div className="cal-kpi-val">{k.openRate?.toFixed(1) ?? '—'}%</div><div className="cal-kpi-label">{t('calendar.detail.openRate')}</div></div>
          <div className="cal-kpi-box"><div className="cal-kpi-val">{(k.clickRate ?? k.ctr)?.toFixed(1) ?? '—'}%</div><div className="cal-kpi-label">{t('calendar.detail.ctr')}</div></div>
          <div className="cal-kpi-box"><div className="cal-kpi-val">{k.conversions ? `${Math.round(k.conversions / 1000)}K` : '—'}</div><div className="cal-kpi-label">{t('calendar.detail.conversions')}</div></div>
        </div>
      )}
    </div>
  );
}
