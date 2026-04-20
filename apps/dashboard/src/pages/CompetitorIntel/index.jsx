import { Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Overview from './Overview.jsx';
import Persona from './Persona.jsx';
import Brand from './Brand.jsx';
import Comparative from './Comparative.jsx';
import Insights from './Insights.jsx';
import './competitor-intel.css';

const API = import.meta.env.VITE_API_URL || '/api';

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function InvestigationList() {
    const { t } = useLanguage();
    const [investigations, setInvestigations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/competitor-intel/investigations`)
            .then((r) => r.json())
            .then((d) => {
                setInvestigations(d.investigations || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="ci-loading">{t('competitorIntel.loading')}</div>;

    return (
        <div className="ci-page ci-fade-in">
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">AgentOS · Competitive Intelligence</p>
                    <h1>{t('competitorIntel.title')}</h1>
                </div>
                <div className="ci-header-meta">
                    {investigations.length} {investigations.length === 1 ? 'investigation' : 'investigations'}
                </div>
            </header>

            {investigations.length === 0 ? (
                <p className="ci-muted">No investigations yet.</p>
            ) : (
                <ul className="ci-investigation-list">
                    {investigations.map((inv) => (
                        <li key={inv.id}>
                            <Link to={`/app/competitor-intel/${inv.id}`}>
                                <div>
                                    <strong>{inv.name}</strong>
                                    {inv.description && (
                                        <div
                                            style={{
                                                color: 'var(--text-muted)',
                                                fontSize: '0.82rem',
                                                marginTop: 2,
                                            }}
                                        >
                                            {inv.description}
                                        </div>
                                    )}
                                </div>
                                <small>{fmtDate(inv.created_at)}</small>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function CompetitorIntelRouter() {
    return (
        <Routes>
            <Route index element={<InvestigationList />} />
            <Route path=":id" element={<Overview />} />
            <Route path=":id/persona/:personaId" element={<Persona />} />
            <Route path=":id/brand/:brandId" element={<Brand />} />
            <Route path=":id/comparative" element={<Comparative />} />
            <Route path=":id/insights" element={<Insights />} />
        </Routes>
    );
}
