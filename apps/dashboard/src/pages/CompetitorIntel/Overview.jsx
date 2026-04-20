import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import BrandCard from './components/BrandCard.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Overview() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    const [a, b] = await Promise.all([
      fetch(`${API}/competitor-intel/investigations/${id}/overview`).then(r => r.json()),
      fetch(`${API}/competitor-intel/investigations/${id}`).then(r => r.json())
    ]);
    setData({ ...a, personas: b.personas || [] });
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [id]);

  if (!data) return <div className="ci-loading">Loading…</div>;

  return (
    <>
      <div className="ci-personas-bar">
        <span className="ci-muted">Personas:</span>
        {data.personas.map(p => (
          <Link key={p.id} to={`/app/competitor-intel/${id}/persona/${p.id}`} className="ci-persona-chip">
            {p.name}
          </Link>
        ))}
      </div>
      <div className="ci-overview">
        <div className="ci-brand-grid">
          {data.brands.map(b => <BrandCard key={b.id} brand={b} investigationId={id} />)}
        </div>
        <aside className="ci-activity">
          <h4>Activity</h4>
          {data.activity.length === 0
            ? <p className="ci-muted">No activity yet. Connect a Gmail persona to start.</p>
            : (
              <ul>
                {data.activity.map(a => (
                  <li key={a.kind + a.id}>
                    <time>{new Date(a.at).toLocaleTimeString()}</time>
                    <strong>{a.brand_name || 'Unclassified'}</strong>
                    <span>→ {a.persona_name}</span>
                    <p>{a.title}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </aside>
      </div>
    </>
  );
}
