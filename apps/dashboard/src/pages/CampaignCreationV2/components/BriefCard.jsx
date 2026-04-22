import React from 'react';
import { Sparkles, User, Clock, Globe } from 'lucide-react';

const STATUS_LABELS = {
  draft:     'Draft',
  active:    'Active',
  in_wizard: 'In wizard',
  sent:      'Sent',
  dismissed: 'Dismissed',
};

export default function BriefCard({ brief, onClick }) {
  const isAi   = brief.source === 'ai';
  const markets = Array.isArray(brief.markets) ? brief.markets : [];
  return (
    <button
      className={`cc2-brief-card ${isAi ? 'is-ai' : 'is-human'}`}
      onClick={onClick}
      type="button"
    >
      <div className="cc2-brief-card__header">
        {isAi ? (
          <span className="cc2-brief-card__badge ai">
            <Sparkles size={12} /> AI OPPORTUNITY
          </span>
        ) : (
          <span className="cc2-brief-card__badge human">
            <User size={12} /> HUMAN
          </span>
        )}
        <span className="cc2-brief-card__status">
          {STATUS_LABELS[brief.status] || brief.status}
        </span>
      </div>

      <h3 className="cc2-brief-card__title">{brief.name || '(untitled)'}</h3>

      {isAi && brief.opportunity_reason && (
        <p className="cc2-brief-card__reason">{brief.opportunity_reason}</p>
      )}

      <div className="cc2-brief-card__meta">
        {brief.send_date && (
          <span>
            <Clock size={12} /> {new Date(brief.send_date).toLocaleDateString()}
          </span>
        )}
        {markets.length > 0 && (
          <span>
            <Globe size={12} /> {markets.join(', ')}
          </span>
        )}
      </div>
    </button>
  );
}
