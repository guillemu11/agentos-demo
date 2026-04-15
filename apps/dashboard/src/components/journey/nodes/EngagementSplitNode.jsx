import { Handle, Position } from '@xyflow/react';
import { Activity } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function EngagementSplitNode({ data }) {
  const { t } = useLanguage();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--engage ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Activity size={16} /> {t('journeys.nodeTypes.engagement_split')}</div>
      <div className="journey-node__body">
        <span className="journey-node__chip">{a.metric}?</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
