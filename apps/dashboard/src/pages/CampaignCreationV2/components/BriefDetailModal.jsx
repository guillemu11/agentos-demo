import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, Sparkles, User, Pencil } from 'lucide-react';
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

function AcceptedOptionPreview({ option }) {
  return (
    <div className="cc2-preview-mock">
      <div className="cc2-preview-mock__label">
        📧 PREVIEW · {(option.direction || 'content').toUpperCase()}
      </div>
      <div className="cc2-preview-mock__body">
        <div className="cc2-preview-mock__subject">{option.subject || '(no subject)'}</div>
        {option.preheader && <div className="cc2-preview-mock__preheader">{option.preheader}</div>}
        {option.headline && <h4 className="cc2-preview-mock__headline">{option.headline}</h4>}
        {option.body && <p className="cc2-preview-mock__copy">{option.body}</p>}
        {option.cta_label && (
          <button type="button" className="cc2-btn primary" disabled>
            {option.cta_label}
          </button>
        )}
      </div>
    </div>
  );
}

export default function BriefDetailModal({ briefId, onClose }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const isInWizard = brief.status === 'in_wizard';
  const isDeployed = brief.status === 'sent' || (isInWizard && brief.campaign_id);
  const markets = Array.isArray(brief.markets)   ? brief.markets   : [];
  const langs   = Array.isArray(brief.languages) ? brief.languages : [];

  async function activate() {
    const needsSetup = !brief.name || !brief.send_date || !brief.template_id;
    const mode = needsSetup ? 'setup' : 'options';
    navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=${mode}`);
    onClose();
  }

  function openInWizard() {
    navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=wizard`);
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

  async function deleteBrief() {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    setDeleting(true);
    try {
      await briefsApi.remove(brief.id);
      onClose();
    } catch (err) {
      alert(`Could not delete: ${err.message}`);
      setDeleteArmed(false);
    } finally {
      setDeleting(false);
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

          {brief.accepted_option && <AcceptedOptionPreview option={brief.accepted_option} />}

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
          <button
            className={`cc2-btn cc2-btn--danger ${deleteArmed ? 'is-armed' : ''}`}
            onClick={deleteBrief}
            type="button"
            disabled={deleting || isDeployed}
            title={
              isDeployed
                ? 'Cannot delete a brief tied to an active or deployed campaign'
                : (deleteArmed ? 'Click again to confirm' : 'Delete this brief permanently')
            }
          >
            <Trash2 size={14} /> {deleteArmed ? 'Click again to confirm' : 'Delete'}
          </button>

          {isAi && brief.status !== 'dismissed' && (
            <button className="cc2-btn" onClick={dismiss} type="button">
              Dismiss
            </button>
          )}

          <div style={{ flex: 1 }} />

          {isInWizard ? (
            <button className="cc2-btn primary" onClick={openInWizard} type="button">
              <Pencil size={14} /> Resume editing
            </button>
          ) : canActivate ? (
            <>
              <button className="cc2-btn" onClick={openInWizard} type="button">
                <Pencil size={14} /> Edit in wizard
              </button>
              <button className="cc2-btn primary" onClick={activate} type="button">
                <Play size={14} /> Activate
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
