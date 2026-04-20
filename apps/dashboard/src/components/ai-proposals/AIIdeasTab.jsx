import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import ProposalCard from './ProposalCard.jsx';

export default function AIIdeasTab({ proposals = [], onDemand = false, metaText = null }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(new Set());

  const visible = proposals.filter(p => !dismissed.has(p.id));

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  return (
    <div className="ai-proposals-tab">
      <div className="ai-proposals-tab__header">
        <span className="ai-proposals-tab__meta">
          {metaText || (onDemand ? t('aiProposals.generatedNow') : t('aiProposals.backgroundScan').replace('{time}', '1h'))}
        </span>
        {onDemand && (
          <button className="ai-proposals-tab__refresh">
            <RefreshCw size={10} />
            {t('aiProposals.refresh')}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="ai-proposals-tab__empty">
          <Sparkles size={20} strokeWidth={1.5} />
          <div>
            <div>{t('aiProposals.empty')}</div>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{t('aiProposals.emptyHint')}</div>
          </div>
        </div>
      ) : (
        visible.map(p => (
          <ProposalCard key={p.id} proposal={p} onDismiss={handleDismiss} />
        ))
      )}
    </div>
  );
}
