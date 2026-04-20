import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

const TEMPLATES = [
  {
    id: 'cart_abandon',
    icon: '◈',
    titleKey: 'journeys.tpl.cartAbandon.title',
    descKey: 'journeys.tpl.cartAbandon.desc',
    seed: "Recover abandoned Emirates.com shoppers. Send a reminder 2 hours after they leave the cart. Wait a day and split on who opened — if they did, send a partner upsell with hotel bundles; if they didn't, one last 10%-off nudge and exit. Validate at the end so I can review before deploying.",
  },
  {
    id: 'welcome_series',
    icon: '◉',
    titleKey: 'journeys.tpl.welcome.title',
    descKey: 'journeys.tpl.welcome.desc',
    seed: "Welcome new subscribers with a 3-email drip over 10 days. Start with a brand intro newsletter on day zero, a destination hero on day 3, and a Skywards miles promo on day 10. Validate at the end so I can review before deploying.",
  },
  {
    id: 'tier_upgrade',
    icon: '◆',
    titleKey: 'journeys.tpl.tierUpgrade.title',
    descKey: 'journeys.tpl.tierUpgrade.desc',
    seed: "Push near-upgrade Silver members to Gold. Target Skywards Silver members with high recent spend, send a bonus-miles offer, and split on engagement — openers get a premium experience push, non-openers get a last-call miles deadline reminder. Validate at the end so I can review before deploying.",
  },
  {
    id: 'scratch',
    icon: '+',
    titleKey: 'journeys.tpl.scratch.title',
    descKey: 'journeys.tpl.scratch.desc',
    seed: null,
  },
];

export default function CreateJourneyModal({ open, onClose, onCreated }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('scratch');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSelected('scratch');
      setError(null);
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const tpl = TEMPLATES.find((x) => x.id === selected);
      const r = await fetch(`${API}/journeys`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const journey = await r.json();
      onCreated(journey, tpl?.seed || null);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="jm" role="dialog" aria-modal="true" aria-labelledby="jm-title">
      <button className="jm__scrim" onClick={onClose} aria-label={t('journeys.modal.close')} />
      <form className="jm__panel" onSubmit={submit}>
        <div className="jm__header">
          <div className="jm__header-text">
            <div className="jm__eyebrow">
              <Sparkles size={12} strokeWidth={2.5} />
              <span>{t('journeys.modal.eyebrow')}</span>
            </div>
            <h2 id="jm-title" className="jm__title">{t('journeys.modal.title')}</h2>
            <p className="jm__subtitle">{t('journeys.modal.subtitle')}</p>
          </div>
          <button type="button" className="jm__close" onClick={onClose} aria-label={t('journeys.modal.close')}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="jm__body">
          <label className="jm__field">
            <span className="jm__label">{t('journeys.modal.nameLabel')}</span>
            <input
              ref={nameRef}
              className="jm__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('journeys.modal.namePlaceholder')}
              maxLength={120}
              required
            />
            <span className="jm__hint">{t('journeys.modal.nameHint')}</span>
          </label>

          <div className="jm__field">
            <span className="jm__label">{t('journeys.modal.templateLabel')}</span>
            <div className="jm__tpls">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={`jm__tpl ${selected === tpl.id ? 'jm__tpl--active' : ''}`}
                  onClick={() => setSelected(tpl.id)}
                >
                  <div className="jm__tpl-icon">{tpl.icon}</div>
                  <div className="jm__tpl-text">
                    <div className="jm__tpl-title">{t(tpl.titleKey)}</div>
                    <div className="jm__tpl-desc">{t(tpl.descKey)}</div>
                  </div>
                  <div className="jm__tpl-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="jm__error">{error}</div>}
        </div>

        <div className="jm__footer">
          <button type="button" className="jm__btn jm__btn--ghost" onClick={onClose} disabled={busy}>
            {t('journeys.modal.cancel')}
          </button>
          <button type="submit" className="jm__btn jm__btn--primary" disabled={busy || !name.trim()}>
            {busy ? t('journeys.modal.creating') : t('journeys.modal.create')}
            {!busy && <ArrowRight size={14} strokeWidth={2.5} />}
          </button>
        </div>
      </form>
    </div>
  );
}
