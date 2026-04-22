import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, Sparkles, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { briefsApi } from '../lib/briefsApi.js';

function Field({ label, value }) {
  return (
    <div className="cc2-field">
      <dt>{label}</dt>
      <dd>{value || <em>—</em>}</dd>
    </div>
  );
}

export default function BriefDetailModal({ briefId, onClose }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    briefsApi.list()
      .then(({ briefs }) => {
        if (cancelled) return;
        const b = briefs.find(x => x.id === briefId);
        if (!b) setError('Brief not found');
        else setBrief(b);
      })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [briefId]);

  if (error) {
    return (
      <div className="cc2-modal-backdrop" onClick={onClose}>
        <div className="cc2-modal" onClick={e => e.stopPropagation()}>
          <header className="cc2-modal__header">
            <div className="cc2-modal__title">Error</div>
            <button className="cc2-modal__close" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </header>
          <div className="cc2-modal__body"><p>{error}</p></div>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  const isAi = brief.source === 'ai';
  const canActivate = brief.status === 'draft' || brief.status === 'active';
  const markets = Array.isArray(brief.markets)   ? brief.markets   : [];
  const langs   = Array.isArray(brief.languages) ? brief.languages : [];

  async function activate() {
    // If brief still missing required setup fields, send to chat. Otherwise to content options.
    const needsSetup = !brief.name || !brief.send_date || !brief.template_id;
    const mode = needsSetup ? 'setup' : 'options';
    navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=${mode}`);
    onClose();
  }

  async function dismiss() {
    try {
      await briefsApi.dismiss(brief.id);
      onClose();
    } catch (err) {
      alert(`Could not dismiss: ${err.message}`);
    }
  }

  return (
    <div className="cc2-modal-backdrop" onClick={onClose}>
      <div className="cc2-modal" onClick={e => e.stopPropagation()}>
        <header className="cc2-modal__header">
          <div>
            <div className={`cc2-modal__badge ${isAi ? 'ai' : 'human'}`}>
              {isAi
                ? <><Sparkles size={12} /> AI OPPORTUNITY</>
                : <><User size={12} /> HUMAN BRIEF</>}
            </div>
            <h2 className="cc2-modal__title">{brief.name || '(untitled)'}</h2>
          </div>
          <button className="cc2-modal__close" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="cc2-modal__body">
          {isAi && brief.opportunity_reason && (
            <div className="cc2-reason">
              <div className="cc2-reason__label">💡 WHY IS THIS AN OPPORTUNITY?</div>
              <div className="cc2-reason__text">{brief.opportunity_reason}</div>
            </div>
          )}

          <dl className="cc2-fields">
            <Field label="Objective" value={brief.objective} />
            <Field label="Send date" value={brief.send_date && new Date(brief.send_date).toLocaleString()} />
            <Field label="Template"  value={brief.template_id} />
            <Field label="Markets"   value={markets.join(', ')} />
            <Field label="Languages" value={langs.join(', ')} />
            <Field label="Audience"  value={brief.audience_summary} />
            <Field label="Status"    value={brief.status} />
          </dl>
        </div>

        <footer className="cc2-modal__footer">
          {isAi && (
            <button className="cc2-btn" onClick={dismiss} type="button">
              <Trash2 size={14} /> Dismiss
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canActivate && (
            <button className="cc2-btn primary" onClick={activate} type="button">
              <Play size={14} /> Activate
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
