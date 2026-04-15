import { Handle, Position } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function WaitUntilEventNode({ data }) {
  const { t } = useLanguage();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--wait-event ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Eye size={16} className="journey-pulse" /> {t('journeys.nodeTypes.wait_until_event')}</div>
      <div className="journey-node__body">{a.event} ≤ {a.timeout_hours}h</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
