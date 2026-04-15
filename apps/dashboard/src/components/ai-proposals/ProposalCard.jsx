import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function ProposalCard({ proposal, onDismiss }) {
  const { t } = useLanguage();

  const priorityLabel = {
    urgent: t('aiProposals.urgent'),
    high: t('aiProposals.high'),
    medium: t('aiProposals.medium'),
    low: t('aiProposals.low'),
  }[proposal.priority] || proposal.priority;

  const handleAction = (action) => {
    if (action === 'dismiss') onDismiss(proposal.id);
  };

  return (
    <div className={`proposal-card proposal-card--${proposal.priority}`}>
      <div className="proposal-card__top">
        <div className="proposal-card__title">{proposal.title}</div>
        <span className={`proposal-card__priority proposal-card__priority--${proposal.priority}`}>
          {priorityLabel}
        </span>
      </div>

      <div className="proposal-card__reasoning">{proposal.reasoning}</div>

      {proposal.kpiContext && proposal.kpiContext.length > 0 && (
        <div className="proposal-card__kpi-row">
          {proposal.kpiContext.map((kpi, i) => (
            <span key={i} className="proposal-card__kpi-pill">
              {kpi.label}: <strong>{kpi.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="proposal-card__actions">
        <button
          className="proposal-card__btn proposal-card__btn--primary"
          onClick={() => handleAction(proposal.primaryCta.action)}
        >
          {proposal.primaryCta.label}
        </button>
        <button
          className="proposal-card__btn"
          onClick={() => handleAction(proposal.secondaryCta.action)}
        >
          {proposal.secondaryCta.label}
        </button>
      </div>
    </div>
  );
}
