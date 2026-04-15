import { useState } from 'react';
import { CheckCircle, Rocket, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneyToolbar({ journey, dsl, onRename }) {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [name, setName] = useState(journey.name);
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(null);

  const rename = async () => {
    if (name === journey.name || !name.trim()) return;
    await fetch(`${API}/journeys/${journey.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    onRename(name);
  };

  const runCommand = async (message, successText, busyKey) => {
    setBusy(busyKey);
    setBanner(null);
    try {
      const res = await fetch(`${API}/chat/journey-builder/${journey.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      await res.text();
      setBanner({ type: 'success', text: successText });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const validate = () => runCommand('Run validate_journey and report the result concisely.', t('journeys.validationOk'), 'validate');

  const deploy = async () => {
    if (!window.confirm(t('journeys.deployConfirm').replace('{name}', journey.name))) return;
    setBusy('deploy');
    setBanner(null);
    try {
      const res = await fetch(`${API}/journeys/${journey.id}/deploy`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const failedStep = data.steps?.find((s) => s.status === 'error');
        const detail = failedStep ? ` — failed at: ${failedStep.name} (${failedStep.error})` : '';
        throw new Error(`${data.error || `HTTP ${res.status}`}${detail}`);
      }
      setBanner({ type: 'success', text: `${t('journeys.deploySuccess')} · ID ${(data.mc_interaction_id || '').slice(0, 12)}` });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <header className="journey-toolbar">
      <button className="btn btn--ghost" onClick={() => nav('/app/journeys')} aria-label="back">
        <ArrowLeft size={16} />
      </button>
      <input
        className="journey-toolbar__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
      />
      <span className={`journey-toolbar__status journey-toolbar__status--${journey.status}`}>
        {t(`journeys.status${pascal(journey.status)}`)}
      </span>
      <div className="journey-toolbar__spacer" />
      {banner && <div className={`journey-toolbar__banner journey-toolbar__banner--${banner.type}`}>{banner.text}</div>}
      <button className="btn btn--ghost" onClick={validate} disabled={!!busy}>
        {busy === 'validate' ? <Loader2 size={14} className="journey-spin-slow" /> : <CheckCircle size={14} />}
        {' '}{t('journeys.validate')}
      </button>
      <button className="btn btn--primary" onClick={deploy} disabled={!!busy}>
        {busy === 'deploy' ? <Loader2 size={14} className="journey-spin-slow" /> : <Rocket size={14} />}
        {' '}{t('journeys.deploy')}
      </button>
    </header>
  );
}

function pascal(s) {
  return s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
