import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { WA_CAMPAIGNS } from '../data/emiratesWhatsAppCampaigns.js';
import WaCampaignCard from './WaCampaignCard.jsx';

export default function WaTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const liveCount = WA_CAMPAIGNS.filter(c => c.status === 'live').length;
  const testingCount = WA_CAMPAIGNS.filter(c => c.status === 'testing').length;
  const avgResponse = (
    WA_CAMPAIGNS.filter(c => c.kpis.responseRate).reduce((s, c) => s + c.kpis.responseRate, 0) /
    WA_CAMPAIGNS.filter(c => c.kpis.responseRate).length
  ).toFixed(1);
  const researchCount = WA_CAMPAIGNS.filter(c => c.autoResearch.active).length;

  return (
    <>
      {/* Summary bar */}
      <section className="wa-summary-bar">
        <div className="stat-chip">
          <strong>{liveCount}</strong>&nbsp;{t('whatsapp.summaryLive')}
        </div>
        <div className="stat-chip">
          <strong>{testingCount}</strong>&nbsp;{t('whatsapp.summaryTesting')}
        </div>
        <div className="stat-chip stat-chip-active">
          <strong>{avgResponse}%</strong>&nbsp;{t('whatsapp.summaryAvgResponse')}
        </div>
        <div className="wa-research-banner">
          <span style={{ fontSize: '1.2rem' }}>🔬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--wa-green)', marginBottom: 2 }}>
              {t('whatsapp.researchBannerTitle').replace('{n}', researchCount)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t('whatsapp.researchBannerSub')}
            </div>
          </div>
          <button
            className="wa-research-banner-btn"
            onClick={e => { e.stopPropagation(); navigate('/app/research'); }}
          >
            {t('whatsapp.researchBannerBtn')}
          </button>
        </div>
      </section>

      {/* Cards grid */}
      <div className="wa-campaigns-grid">
        {WA_CAMPAIGNS.map(campaign => (
          <WaCampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </>
  );
}
