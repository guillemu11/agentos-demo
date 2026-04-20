import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import InboxTable from './components/InboxTable.jsx';
import PlaybookTab from './components/PlaybookTab.jsx';
import ScoringTab from './components/ScoringTab.jsx';
import Timeline from './components/Timeline.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

export default function Brand() {
    const { id: investigationId, brandId } = useParams();
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('timeline');
    const [sel, setSel] = useState(null);
    const [timelineEvents, setTimelineEvents] = useState(null);

    async function loadTimeline() {
        const r = await fetch(`${API}/competitor-intel/brands/${brandId}/timeline`);
        const j = await r.json();
        setTimelineEvents(j.events || []);
    }

    async function load() {
        const r = await fetch(`${API}/competitor-intel/brands/${brandId}`);
        setData(await r.json());
        await loadTimeline();
    }
    useEffect(() => { load(); }, [brandId]);

    if (!data?.brand) return <div className="ci-loading">Loading…</div>;

    const { brand, scores, steps, emails } = data;
    const doneCount = steps.filter(s => s.status === 'done').length;
    const totalSteps = steps.length;
    const overall = scores?.overall != null ? Number(scores.overall).toFixed(1) : '—';

    return (
        <div className="ci-page ci-fade-in">
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">
                        <Link to={`/app/competitor-intel/${investigationId}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}>
                            ← Overview
                        </Link>
                        &nbsp;·&nbsp; Brand
                        {brand.category && <> &nbsp;·&nbsp; {brand.category}</>}
                    </p>
                    <h1>{brand.name}</h1>
                    {brand.positioning && (
                        <p className="ci-muted" style={{ maxWidth: 640, marginTop: 4 }}>
                            {brand.positioning}
                        </p>
                    )}
                </div>
                <div className="ci-header-meta">
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                        {overall}
                        {scores?.overall != null && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>/10</span>}
                    </div>
                    <div style={{ marginTop: 4 }}>
                        {doneCount}/{totalSteps} steps &nbsp;·&nbsp; {emails.length} emails
                    </div>
                </div>
            </header>

            <nav className="ci-tabs">
                {[
                    { k: 'timeline', label: 'Timeline', count: timelineEvents?.length ?? null },
                    { k: 'playbook', label: 'Playbook', count: `${doneCount}/${totalSteps}` },
                    { k: 'inbox',    label: 'Inbox',    count: emails.length },
                    { k: 'scoring',  label: 'Scoring',  count: overall !== '—' ? overall : null },
                ].map(t => (
                    <button key={t.k} aria-pressed={tab === t.k} onClick={() => setTab(t.k)}>
                        {t.label}
                        {t.count != null && <span className="ci-tab-count">{t.count}</span>}
                    </button>
                ))}
            </nav>

            {tab === 'timeline' && (
                timelineEvents === null
                    ? <div className="ci-loading">Loading timeline…</div>
                    : <Timeline events={timelineEvents} />
            )}
            {tab === 'playbook' && <PlaybookTab steps={steps} onChange={load} />}
            {tab === 'inbox'    && <InboxTable emails={emails} onSelect={setSel} />}
            {tab === 'scoring'  && <ScoringTab brand={brand} scores={scores} onChange={load} />}

            {sel && (
                <div className="ci-email-modal" onClick={() => setSel(null)}>
                    <div className="ci-email-modal-inner" onClick={e => e.stopPropagation()}>
                        <div className="ci-email-modal-head">
                            <h3>{sel.subject || '(no subject)'}</h3>
                            <div className="ci-email-modal-meta">
                                <span>{sel.sender_email}</span>
                                <span>·</span>
                                <span>{fmtDateTime(sel.received_at)}</span>
                                {sel.persona_name && <><span>·</span><span><strong style={{ color: 'var(--text-main)' }}>{sel.persona_name}</strong></span></>}
                            </div>
                        </div>
                        <iframe
                            title="email"
                            srcDoc={sel.body_html || `<pre style="font-family:ui-monospace,monospace;padding:24px;white-space:pre-wrap;">${(sel.body_text || '').replace(/</g,'&lt;')}</pre>`}
                            sandbox=""
                        />
                        {sel.classification && Object.keys(sel.classification).length > 0 && (
                            <pre className="ci-classification">{JSON.stringify(sel.classification, null, 2)}</pre>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
