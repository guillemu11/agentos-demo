import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function EntryNode({ data }) {
  const { t } = useLanguage();
  return (
    <div className={`journey-node journey-node--entry journey-node--clickable${data.isNewlyAdded ? ' journey-node--newly-added' : ''}`}>
      <div className="journey-node__header"><Database size={16} /> {t('journeys.nodeTypes.entry')}</div>
      <div className="journey-node__type">Master DE → Target DE</div>
      <div className="journey-node__body">
        <div>{data.source?.master_de_key}</div>
        <div className="journey-node__chip">→ {data.source?.target_de_name}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
