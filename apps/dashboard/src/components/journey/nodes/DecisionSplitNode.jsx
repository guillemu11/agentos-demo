import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function DecisionSplitNode({ data }) {
  const { t } = useLanguage();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--split ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><GitBranch size={16} /> {t('journeys.nodeTypes.decision_split')}</div>
      <div className="journey-node__body">
        {(a.branches || []).map((b, i) => (
          <span key={i} className="journey-node__chip">{b.label}: {b.condition}</span>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
