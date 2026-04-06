import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ExperimentCard({ experiment }) {
  const { t } = useLanguage();
  const isRunning = experiment.status === 'running';
  const challengerWinning = experiment.challenger.value > experiment.baseline.value;

  return (
    <div className={`card experiment-card ${isRunning ? 'running' : ''}`}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--wa-green-dim)', color: 'var(--wa-green)' }}>
          💬 WhatsApp
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{experiment.campaignName}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Run #{experiment.runNumber}</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, padding: '2px 9px', borderRadius: 10,
          background: isRunning ? 'var(--wa-green-dim)' : 'rgba(245,158,11,0.08)',
          color: isRunning ? 'var(--wa-green)' : '#f59e0b',
        }}>
          {isRunning ? '● Running' : '⏳ Collecting'}
        </span>
      </div>

      {/* Variants */}
      <div className="experiment-variants">
        <div className="variant-box baseline">
          <div className="variant-label">{t('researchLab.baseline')}</div>
          <div className="variant-text">"{experiment.baseline.text}"</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="variant-metric-val">{experiment.baseline.value}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{experiment.metricLabel}</span>
          </div>
        </div>
        <div className="variant-box challenger">
          <div className="variant-label">
            {t('researchLab.challenger')}
            {challengerWinning && <span className="winning-badge">{t('researchLab.winning')}</span>}
          </div>
          <div className="variant-text">"{experiment.challenger.text}"</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="variant-metric-val">{experiment.challenger.value}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{experiment.metricLabel}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', background: 'var(--surface-hover)', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{t('researchLab.hypothesis')}: <strong style={{ color: 'var(--research-purple)' }}>{experiment.hypothesis}</strong></span>
        <span>{experiment.hoursRemaining.toFixed(1)}{t('researchLab.hoursRemaining')}</span>
      </div>
    </div>
  );
}
