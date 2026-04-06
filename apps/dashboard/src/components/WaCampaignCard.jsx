import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WaCampaignCard({ campaign }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const statusColors = { live: '#25d366', testing: '#f59e0b', draft: '#666' };
  const statusColor = statusColors[campaign.status] || '#666';

  function formatMetric(value) {
    if (value === null || value === undefined) return '—';
    return `${value}%`;
  }

  return (
    <div
      className={`card wa-campaign-card animate-fade-in ${campaign.autoResearch.active ? 'has-research' : ''}`}
      onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
    >
      {/* Header */}
      <div className="campaign-card-header" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${campaign.groupColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
          }}>
            {campaign.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{campaign.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{campaign.group}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span className="campaign-status-badge" style={{
            background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40`,
          }}>
            ● {campaign.status}
          </span>
          {campaign.autoResearch.active && (
            <span className="wa-badge-research">
              <span className="wa-research-dot" />
              AutoResearch
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="campaign-kpi-row" style={{ marginBottom: 12 }}>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value" style={{ color: 'var(--wa-green)' }}>
            {formatMetric(campaign.kpis.responseRate)}
          </span>
          <span className="campaign-kpi-label">{t('whatsapp.responseRate')}</span>
        </span>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value">{formatMetric(campaign.kpis.ctaClickRate)}</span>
          <span className="campaign-kpi-label">{t('whatsapp.ctaClickRate')}</span>
        </span>
        <span className="campaign-kpi-chip">
          <span className="campaign-kpi-value">{formatMetric(campaign.kpis.conversionRate)}</span>
          <span className="campaign-kpi-label">{t('whatsapp.conversionRate')}</span>
        </span>
      </div>

      {/* Phone preview */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          background: 'var(--wa-green-dim)',
          border: '1px solid var(--wa-green-border)',
          borderRadius: 8,
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', flexShrink: 0, marginTop: 2,
        }}>
          💬
        </div>
        <div style={{
          background: 'var(--wa-bubble-in)',
          borderRadius: '0 8px 8px 8px',
          padding: '7px 10px',
          fontSize: '0.72rem', color: 'var(--text-secondary)',
          lineHeight: 1.4, flex: 1,
        }}>
          {campaign.preview.message}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
            {campaign.preview.quickReplies.slice(0, 3).map((qr, i) => (
              <span key={i} style={{
                background: '#2a3942', border: '1px solid #3a4952',
                borderRadius: 4, padding: '2px 6px',
                fontSize: '0.6rem', color: '#53bdeb',
              }}>
                {qr}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 10, borderTop: '1px solid var(--border)',
        fontSize: '0.72rem',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {campaign.autoResearch.active
            ? `Run #${campaign.autoResearch.runNumber} · ${campaign.autoResearch.status === 'challenger_winning' ? `Challenger +${campaign.autoResearch.lift}%` : 'Collecting data'}`
            : `Run #${campaign.autoResearch.runNumber} · Collecting data`
          }
        </span>
        <span style={{ color: 'var(--research-purple)', fontWeight: 600, cursor: 'pointer' }}>
          {campaign.autoResearch.active ? t('whatsapp.viewInLab') : t('whatsapp.addToLab')}
        </span>
      </div>
    </div>
  );
}
