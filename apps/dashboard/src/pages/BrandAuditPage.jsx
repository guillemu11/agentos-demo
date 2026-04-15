import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function BrandAuditPage() {
  const { t } = useLanguage();
  return (
    <div className="coming-soon-page">
      <h1>{t('layout.brandAudit')}</h1>
      <p>{t('comingSoon.message')}</p>
    </div>
  );
}
