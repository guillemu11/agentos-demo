import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Lock, Check, Rocket } from 'lucide-react';
import { briefsApi } from './lib/briefsApi.js';
import { briefToWizardState } from './lib/briefAutofill.js';

const STEPS = [
  { id: 1, label: 'Campaign setup' },
  { id: 2, label: 'Content studio' },
  { id: 3, label: 'Review & deploy' },
];

export default function CampaignWizard({ briefId }) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [edited, setEdited] = useState(() => new Set());

  const seed = useMemo(() => (brief ? briefToWizardState(brief) : null), [brief]);
  const [step1, setStep1] = useState(null);
  const [step2, setStep2] = useState(null);

  useEffect(() => {
    if (!seed) return;
    setStep1(seed.step1);
    setStep2(seed.step2);
  }, [seed]);

  useEffect(() => {
    let cancelled = false;
    briefsApi.list()
      .then(({ briefs }) => {
        if (cancelled) return;
        const b = briefs.find(x => x.id === briefId);
        if (!b) setLoadError('Brief not found');
        else setBrief(b);
      })
      .catch(err => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [briefId]);

  function isPrefilled(key) {
    return seed?.prefilledFields.has(key) && !edited.has(key);
  }
  function isLocked(key) {
    return seed?.lockedFields.includes(key);
  }
  function markEdited(key) {
    setEdited(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function setStep1Field(key, value) {
    markEdited(key);
    setStep1(prev => ({ ...prev, [key]: value }));
  }
  function setStep2Field(key, value) {
    markEdited(key);
    setStep2(prev => ({ ...prev, [key]: value }));
  }

  if (loadError) {
    return (
      <div className="cc2-chat-view">
        <header className="cc2-chat-view__header">
          <button className="cc2-btn" onClick={() => navigate('/app/campaign-creation-v2')} type="button">
            <ArrowLeft size={14} /> Back to briefs
          </button>
        </header>
        <div className="cc2-empty">Error: {loadError}</div>
      </div>
    );
  }

  if (!brief || !step1 || !step2) {
    return <div className="cc2-empty">Loading…</div>;
  }

  return (
    <div className="cc2-wizard">
      <header className="cc2-chat-view__header">
        <button className="cc2-btn" onClick={() => navigate('/app/campaign-creation-v2')} type="button">
          <ArrowLeft size={14} /> Back to briefs
        </button>
        <h2>{brief.name || 'Campaign'}</h2>
      </header>

      <div className="cc2-wizard-banner">
        <Sparkles size={16} />
        <span>
          Pre-filled from brief <strong>&ldquo;{brief.name || '(unnamed)'}&rdquo;</strong>.
          All fields are editable — template is locked to preserve content coherence.
        </span>
      </div>

      <nav className="cc2-wizard-steps" role="tablist" aria-label="Wizard steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            className={`cc2-wizard-step ${i === stepIdx ? 'is-active' : ''} ${i < stepIdx ? 'is-done' : ''}`}
            onClick={() => setStepIdx(i)}
            type="button"
            role="tab"
            aria-selected={i === stepIdx}
          >
            <span className="cc2-wizard-step__num">{i < stepIdx ? <Check size={12} /> : s.id}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      <main className="cc2-wizard-body">
        {stepIdx === 0 && (
          <Step1
            state={step1}
            onChange={setStep1Field}
            isPrefilled={isPrefilled}
            isLocked={isLocked}
          />
        )}
        {stepIdx === 1 && (
          <Step2
            state={step2}
            onChange={setStep2Field}
            isPrefilled={isPrefilled}
          />
        )}
        {stepIdx === 2 && <Step3 brief={brief} step1={step1} step2={step2} />}
      </main>

      <footer className="cc2-wizard-footer">
        <button
          className="cc2-btn"
          onClick={() => setStepIdx(i => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          type="button"
        >Back</button>
        <div style={{ flex: 1 }} />
        {stepIdx < STEPS.length - 1 ? (
          <button
            className="cc2-btn primary"
            onClick={() => setStepIdx(i => Math.min(STEPS.length - 1, i + 1))}
            type="button"
          >Next</button>
        ) : (
          <button className="cc2-btn primary" type="button" disabled>
            <Rocket size={14} /> Deploy (coming soon)
          </button>
        )}
      </footer>
    </div>
  );
}

/* ───────── Steps ───────── */

function Field({ label, children }) {
  return (
    <div className="cc2-wiz-field">
      <div className="cc2-wiz-field__label">{label}</div>
      {children}
    </div>
  );
}

function Step1({ state, onChange, isPrefilled, isLocked }) {
  const prefilledCls = (key) => isPrefilled(key) ? 'cc2-prefilled' : '';
  const sendDateLocal = state.sendDate ? new Date(state.sendDate).toISOString().slice(0, 16) : '';
  return (
    <div className="cc2-wiz-grid">
      <Field label="Campaign name">
        <input
          className={`cc2-wiz-input ${prefilledCls('name')}`}
          value={state.name}
          onChange={e => onChange('name', e.target.value)}
        />
      </Field>
      <Field label="Send date">
        <input
          type="datetime-local"
          className={`cc2-wiz-input ${prefilledCls('sendDate')}`}
          value={sendDateLocal}
          onChange={e => onChange('sendDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      </Field>
      <Field label="Template">
        {isLocked('templateId') ? (
          <div className="cc2-wiz-locked">
            <span>{state.templateId || '—'}</span>
            <Lock size={12} />
          </div>
        ) : (
          <input
            className={`cc2-wiz-input ${prefilledCls('templateId')}`}
            value={state.templateId || ''}
            onChange={e => onChange('templateId', e.target.value)}
          />
        )}
      </Field>
      <Field label="Markets">
        <input
          className={`cc2-wiz-input ${prefilledCls('markets')}`}
          value={state.markets.join(', ')}
          onChange={e => onChange('markets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="FR, DE, UK"
        />
      </Field>
      <Field label="Languages">
        <input
          className={`cc2-wiz-input ${prefilledCls('languages')}`}
          value={state.languages.join(', ')}
          onChange={e => onChange('languages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="en, fr"
        />
      </Field>
      <Field label="Objective">
        <input
          className={`cc2-wiz-input ${prefilledCls('objective')}`}
          value={state.objective}
          onChange={e => onChange('objective', e.target.value)}
        />
      </Field>
      <Field label="Audience">
        <textarea
          className={`cc2-wiz-input cc2-wiz-textarea ${prefilledCls('audience')}`}
          value={state.audience}
          onChange={e => onChange('audience', e.target.value)}
          rows={2}
        />
      </Field>
    </div>
  );
}

function Step2({ state, onChange, isPrefilled }) {
  const prefilledCls = (key) => isPrefilled(key) ? 'cc2-prefilled' : '';
  return (
    <div>
      <div className="cc2-wiz-grid">
        <Field label="Subject">
          <input className={`cc2-wiz-input ${prefilledCls('subject')}`} value={state.subject}
            onChange={e => onChange('subject', e.target.value)} />
        </Field>
        <Field label="Preheader">
          <input className={`cc2-wiz-input ${prefilledCls('preheader')}`} value={state.preheader}
            onChange={e => onChange('preheader', e.target.value)} />
        </Field>
        <Field label="Headline">
          <input className={`cc2-wiz-input ${prefilledCls('headline')}`} value={state.headline}
            onChange={e => onChange('headline', e.target.value)} />
        </Field>
        <Field label="Layout direction">
          <input className="cc2-wiz-input" value={state.layoutDirection || ''} disabled />
        </Field>
        <Field label="CTA label">
          <input className={`cc2-wiz-input ${prefilledCls('ctaLabel')}`} value={state.ctaLabel}
            onChange={e => onChange('ctaLabel', e.target.value)} />
        </Field>
        <Field label="CTA URL">
          <input className={`cc2-wiz-input ${prefilledCls('ctaUrl')}`} value={state.ctaUrl}
            onChange={e => onChange('ctaUrl', e.target.value)} />
        </Field>
      </div>
      <Field label="Body copy">
        <textarea
          className={`cc2-wiz-input cc2-wiz-textarea ${prefilledCls('body')}`}
          value={state.body}
          onChange={e => onChange('body', e.target.value)}
          rows={6}
        />
      </Field>
      {state.variants.length > 0 && (
        <div className="cc2-wiz-variants">
          <div className="cc2-wiz-field__label" style={{ marginBottom: 8 }}>Variants ({state.variants.length})</div>
          {state.variants.map(v => (
            <div key={v.id} className="cc2-wiz-variant">
              <strong>{v.tier || '(no tier)'}</strong>
              <span>{v.behaviors.join(', ') || '—'}</span>
              <span>{v.size.toLocaleString()} recipients</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step3({ brief, step1, step2 }) {
  return (
    <div className="cc2-wiz-review">
      <h3>Review</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Final review of the campaign before deploy. Deploy is not yet wired up — shipping placeholder.
      </p>
      <dl className="cc2-fields">
        <div className="cc2-field"><dt>Name</dt><dd>{step1.name}</dd></div>
        <div className="cc2-field"><dt>Send date</dt><dd>{step1.sendDate ? new Date(step1.sendDate).toLocaleString() : '—'}</dd></div>
        <div className="cc2-field"><dt>Template</dt><dd>{step1.templateId}</dd></div>
        <div className="cc2-field"><dt>Markets</dt><dd>{step1.markets.join(', ')}</dd></div>
        <div className="cc2-field"><dt>Variants</dt><dd>{step2.variants.length}</dd></div>
        <div className="cc2-field"><dt>Direction</dt><dd>{step2.layoutDirection}</dd></div>
        <div className="cc2-field"><dt>Subject</dt><dd>{step2.subject}</dd></div>
        <div className="cc2-field"><dt>CTA</dt><dd>{step2.ctaLabel} → {step2.ctaUrl}</dd></div>
      </dl>
    </div>
  );
}
