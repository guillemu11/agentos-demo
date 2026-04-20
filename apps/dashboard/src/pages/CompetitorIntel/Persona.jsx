import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import InboxTable from './components/InboxTable.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Persona() {
  const { personaId } = useParams();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);

  async function load() {
    const r = await fetch(`${API}/competitor-intel/personas/${personaId}`);
    setData(await r.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [personaId]);

  if (!data) return <div className="ci-loading">Loading…</div>;

  const connect = () => {
    window.location.href = `${API}/oauth/google/authorize?persona_id=${personaId}`;
  };

  return (
    <div className="ci-persona">
      <header>
        <h2>{data.persona.name}</h2>
        <p className="ci-muted">{data.persona.profile?.segment} · {data.persona.location}</p>
        {data.gmail
          ? <small className="ci-muted">Gmail: <strong>{data.gmail.email}</strong> · last sync {data.gmail.last_sync_at ? new Date(data.gmail.last_sync_at).toLocaleTimeString() : 'never'}</small>
          : <button className="ci-btn-primary" onClick={connect}>Connect Gmail</button>
        }
      </header>
      <InboxTable emails={data.emails} onSelect={setSel} />
      {sel && (
        <div className="ci-email-modal" onClick={() => setSel(null)}>
          <div onClick={e => e.stopPropagation()}>
            <h3>{sel.subject}</h3>
            <small className="ci-muted">{sel.sender_email} · {sel.received_at ? new Date(sel.received_at).toLocaleString() : ''}</small>
            <pre className="ci-classification">{JSON.stringify(sel.classification, null, 2)}</pre>
            <iframe
              title="email"
              srcDoc={sel.body_html || `<pre>${(sel.body_text || '').replace(/</g, '&lt;')}</pre>`}
              sandbox=""
            />
          </div>
        </div>
      )}
    </div>
  );
}
