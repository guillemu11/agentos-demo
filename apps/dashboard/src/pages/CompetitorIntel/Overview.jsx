import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BrandCard from './components/BrandCard.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Overview() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    const r = await fetch(`${API}/competitor-intel/investigations/${id}/overview`);
    setData(await r.json());
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [id]);

  if (!data) return <div className="ci-loading">Loading…</div>;

  return (
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
  );
}
