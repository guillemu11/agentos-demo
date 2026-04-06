// apps/dashboard/src/components/WaMessageCard.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function WaMessageCard({ touch }) {
  const { t } = useLanguage();

  function formatMetric(value) {
    return value !== null && value !== undefined ? `${value}%` : '—';
  }

  return (
    <div className="wa-message-designer">
      {/* Mini phone */}
      <div>
        {touch.autoResearch?.active && (
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--research-purple)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Challenger
            </span>
            {touch.autoResearch.lift && (
              <span style={{ background: 'var(--wa-green)', color: '#0b1a11', fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>
                WINNING +{touch.autoResearch.lift}%
              </span>
            )}
          </div>
        )}
        {!touch.autoResearch?.active && (
          <div style={{ marginBottom: 8, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('researchLab.baseline')}
          </div>
        )}
        <div className="wa-mini-phone">
          <div className="wa-phone-header">
            <div className="wa-phone-avatar">E</div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#e9edef' }}>Emirates Skywards ✓</div>
              <div style={{ fontSize: '0.6rem', color: '#8696a0' }}>Business Account</div>
            </div>
          </div>
          <div className="wa-phone-body">
            <div className="wa-bubble">
              {touch.message}
              <div className="wa-bubble-time">now ✓✓</div>
            </div>
            <div className="wa-qr-list">
              {touch.quickReplies.map((qr, i) => (
                <div key={i} className="wa-qr-btn">{qr}</div>
              ))}
            </div>
          </div>
          <div className="wa-phone-input">
            <div className="wa-phone-input-field">Type a message...</div>
            <div style={{ width: 22, height: 22, background: 'var(--wa-green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🎤</div>
          </div>
        </div>
      </div>

      {/* Config panel */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.trigger')}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--research-purple)', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
            {touch.trigger}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.personalisationVars')}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {touch.vars.map((v, i) => (
              <span key={i} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 8, background: 'var(--research-purple-dim)', color: 'var(--research-purple)' }}>
                {v}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {t('whatsapp.performance')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: formatMetric(touch.kpis.responseRate), lbl: t('whatsapp.responseRate') },
              { val: formatMetric(touch.kpis.ctaClickRate), lbl: t('whatsapp.ctaClickRate') },
              { val: formatMetric(touch.kpis.conversionRate), lbl: t('whatsapp.conversionRate') },
            ].map(({ val, lbl }) => (
              <div key={lbl} style={{ flex: 1, background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{val}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {!touch.autoResearch?.active && (
          <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-hover)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            🔬 {t('whatsapp.addToResearch')}
          </div>
        )}
      </div>
    </div>
  );
}
