import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import InboxTable from './components/InboxTable.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

function fmtAgo(iso) {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    const min = Math.floor(diff / 60_000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
}

function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function Persona() {
    const { id: investigationId, personaId } = useParams();
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

    const segment = data.persona.profile?.segment?.replace(/_/g, ' ');

    return (
        <div className="ci-persona ci-fade-in">
            <header className="ci-persona-head">
                <div>
                    <p className="ci-eyebrow">
                        <Link
                            to={`/app/competitor-intel/${investigationId}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                        >
                            ← Overview
                        </Link>
                        &nbsp;·&nbsp; Persona
                    </p>
                    <h2>{data.persona.name}</h2>
                    <p className="ci-persona-sub">
                        {segment && (
                            <>
                                <strong>{segment}</strong> &nbsp;·&nbsp;{' '}
                            </>
                        )}
                        {data.persona.location}
                    </p>
                </div>

                {data.gmail ? (
                    <div className="ci-persona-gmail">
                        <span className="ci-persona-chip-dot is-connected" />
                        <span>
                            Gmail: <strong>{data.gmail.email}</strong>
                            <br />
                            Last sync {fmtAgo(data.gmail.last_sync_at)}
                        </span>
                    </div>
                ) : (
                    <button className="ci-btn ci-btn-primary" onClick={connect}>
                        Connect Gmail
                    </button>
                )}
            </header>

            <InboxTable emails={data.emails} onSelect={setSel} />

            {sel && (
                <div className="ci-email-modal" onClick={() => setSel(null)}>
                    <div className="ci-email-modal-inner" onClick={(e) => e.stopPropagation()}>
                        <div className="ci-email-modal-head">
                            <h3>{sel.subject || '(no subject)'}</h3>
                            <div className="ci-email-modal-meta">
                                <span>{sel.sender_email}</span>
                                <span>·</span>
                                <span>{fmtDateTime(sel.received_at)}</span>
                                {sel.brand_name && (
                                    <>
                                        <span>·</span>
                                        <span>
                                            <strong style={{ color: 'var(--text-main)' }}>
                                                {sel.brand_name}
                                            </strong>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <iframe
                            title="email"
                            srcDoc={
                                sel.body_html ||
                                `<pre style="font-family:ui-monospace,monospace;padding:24px;white-space:pre-wrap;">${(sel.body_text || '').replace(/</g, '&lt;')}</pre>`
                            }
                            sandbox=""
                        />
                        {sel.classification && Object.keys(sel.classification).length > 0 && (
                            <pre className="ci-classification">
                                {JSON.stringify(sel.classification, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
