import { Handle, Position } from '@xyflow/react';
import { Mail, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function EmailSendNode({ data }) {
  const { t } = useLanguage();
  const a = data.activity;
  return (
    <div className={`journey-node journey-node--send ${data.isNewlyAdded ? 'journey-node--newly-added' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="journey-node__header"><Mail size={16} /> {t('journeys.nodeTypes.email_send')}</div>
      <div className="journey-node__body">
        <div>{a.email_shell_name}</div>
        <div className="journey-node__chip">{a.campaign_type}</div>
        {a.mc_email_id && (
          <a
            href={`/app/campaigns/create?emailId=${a.mc_email_id}`}
            target="_blank"
            rel="noreferrer"
            className="journey-node__chip"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={11} /> BAU builder
          </a>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
