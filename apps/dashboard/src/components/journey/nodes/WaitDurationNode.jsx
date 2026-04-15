import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function WaitDurationNode({ data }) {
  const { t } = useLanguage();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--wait ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Clock size={16} className="journey-spin-slow" /> {t('journeys.nodeTypes.wait_duration')}</div>
      <div className="journey-node__body">{a.amount} {a.unit}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
