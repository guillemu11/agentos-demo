import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function JourneysListPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    fetch(`${API}/journeys`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    const name = window.prompt(t('journeys.namePrompt'));
    if (!name) return;
    const r = await fetch(`${API}/journeys`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) return;
    const j = await r.json();
    nav(`/app/journeys/${j.id}`);
  };

  return (
    <div className="journeys-list">
      <header className="journeys-list__header">
        <h1>{t('journeys.title')}</h1>
        <button className="btn btn--primary" onClick={create}>
          <Plus size={16} /> {t('journeys.newJourney')}
        </button>
      </header>
      {loading ? (
        <div className="muted">…</div>
      ) : items.length === 0 ? (
        <div className="empty">{t('journeys.emptyList')}</div>
      ) : (
        <table className="journeys-list__table">
          <thead>
            <tr>
              <th>{t('journeys.name')}</th>
              <th>{t('journeys.status')}</th>
              <th>{t('journeys.updated')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr key={j.id} onClick={() => nav(`/app/journeys/${j.id}`)} style={{ cursor: 'pointer' }}>
                <td>{j.name}</td>
                <td>{t(`journeys.status${pascal(j.status)}`)}</td>
                <td>{new Date(j.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function pascal(s) {
  return s.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
