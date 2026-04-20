import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import BrandCard from './components/BrandCard.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const same = d.toDateString() === today.toDateString();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return same ? `${hh}:${mm}` : `${d.getDate()}/${d.getMonth() + 1} · ${hh}:${mm}`;
}

export default function Overview() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    async function load() {
        const [a, b] = await Promise.all([
            fetch(`${API}/competitor-intel/investigations/${id}/overview`).then((r) => r.json()),
            fetch(`${API}/competitor-intel/investigations/${id}`).then((r) => r.json()),
        ]);
        setData({ ...a, investigation: b.investigation, personas: b.personas || [] });
    }
    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [id]);

    if (!data) return <div className="ci-loading">Loading…</div>;

    const totalEmails = data.brands.reduce((sum, b) => sum + (b.emails_count || 0), 0);
    const connectedPersonas = data.personas.filter((p) => p.gmail_connected).length;

    return (
        <div className="ci-page ci-fade-in">
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">Competitor Intel · Investigation</p>
                    <h1>{data.investigation?.name || 'Investigation'}</h1>
                </div>
                <div className="ci-header-meta">
                    {data.brands.length} brands &nbsp;·&nbsp; {totalEmails} emails ingested
                    <br />
                    {data.personas.length} personas &nbsp;·&nbsp; {connectedPersonas} connected
                </div>
            </header>

            <div className="ci-personas-bar">
                <span className="ci-eyebrow">Personas</span>
                {data.personas.map((p) => (
                    <Link
                        key={p.id}
                        to={`/app/competitor-intel/${id}/persona/${p.id}`}
                        className="ci-persona-chip"
                    >
                        <span
                            className={`ci-persona-chip-dot${p.gmail_connected ? ' is-connected' : ''}`}
                        />
                        {p.name}
                    </Link>
                ))}
            </div>

            <div className="ci-overview">
                <div className="ci-brand-grid">
                    {data.brands.map((b) => (
                        <BrandCard key={b.id} brand={b} investigationId={id} />
                    ))}
                </div>

                <aside className="ci-activity">
                    <h4>Activity</h4>
                    {data.activity.length === 0 ? (
                        <p className="ci-activity-empty">
                            No activity yet. Connect a Gmail persona to start ingesting emails.
                        </p>
                    ) : (
                        <ul>
                            {data.activity.map((a) => (
                                <li key={a.kind + a.id}>
                                    <div className="ci-activity-meta">
                                        <time>{fmtTime(a.at)}</time>
                                        <strong>{a.brand_name || 'Unclassified'}</strong>
                                        <span>→ {a.persona_name}</span>
                                    </div>
                                    <div className="ci-activity-title">{a.title}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>
        </div>
    );
}
