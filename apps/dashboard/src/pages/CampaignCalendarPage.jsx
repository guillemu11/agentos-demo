import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function CampaignCalendarPage() {
  const { t } = useLanguage();
  return (
    <div className="dashboard-container">
      <h1>{t('calendar.pageTitle')}</h1>
      <p>{t('calendar.placeholder')}</p>
    </div>
  );
}
