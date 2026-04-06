// apps/dashboard/src/components/WaMessagesTab.jsx
import { useLanguage } from '../i18n/LanguageContext.jsx';
import WaMessageCard from './WaMessageCard.jsx';

export default function WaMessagesTab({ campaign }) {
  const { t } = useLanguage();

  return (
    <div>
      {/* Conversation flow stepper */}
      <div style={{ marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {t('whatsapp.conversationFlow')}
      </div>
      <div className="wa-flow-stepper">
        {campaign.conversationFlow.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`wa-flow-step ${i === campaign.activeFlowStep ? 'active' : i < campaign.activeFlowStep ? 'done' : ''}`}>
              {i === campaign.activeFlowStep && <span className="wa-flow-dot" />}
              {step}
            </div>
            {i < campaign.conversationFlow.length - 1 && (
              <span className="wa-flow-arrow">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Touch cards */}
      {campaign.touches.map(touch => (
        <div key={touch.id}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            {touch.label}
            {touch.autoResearch?.active && (
              <span style={{ fontSize: '0.7rem', color: 'var(--wa-green)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                (currently running in AutoResearch)
              </span>
            )}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <WaMessageCard touch={touch} />
        </div>
      ))}
    </div>
  );
}
