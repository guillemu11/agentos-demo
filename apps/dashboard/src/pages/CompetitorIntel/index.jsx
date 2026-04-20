import { Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Overview from './Overview.jsx';
import Persona from './Persona.jsx';
import './competitor-intel.css';

const API = import.meta.env.VITE_API_URL || '/api';

function InvestigationList() {
  const { t } = useLanguage();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/competitor-intel/investigations`)
      .then(r => r.json())
      .then(d => { setInvestigations(d.investigations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  if (loading) return <div className="ci-loading">{t('competitorIntel.loading')}</div>;
  return (
    <div className="ci-page">
      <h1>{t('competitorIntel.title')}</h1>
      <ul className="ci-investigation-list">
        {investigations.map(inv => (
          <li key={inv.id}>
            <Link to={`/app/competitor-intel/${inv.id}`}>{inv.name}</Link>
            <small>{new Date(inv.created_at).toLocaleDateString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CompetitorIntelRouter() {
  return (
    <Routes>
      <Route index element={<InvestigationList />} />
      <Route path=":id" element={<Overview />} />
      <Route path=":id/persona/:personaId" element={<Persona />} />
    </Routes>
  );
}
