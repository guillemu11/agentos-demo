import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SubNav from './components/SubNav.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

export default function EmiratesGap() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState('');

    async function load() {
        const r = await fetch(`${API}/competitor-intel/investigations/${id}/gap`);
        setData(await r.json());
    }
    useEffect(() => { load(); }, [id]);

    async function ingest() {
        setBusy(true);
        try {
            const r = await fetch(`${API}/competitor-intel/investigations/${id}/ingest-analysis4`, { method: 'POST' });
            const j = await r.json();
            setFlash(`Ingested ${j.ingested?.length ?? 0} reference scores`);
            await load();
        } catch (e) {
            setFlash(`Error: ${e.message}`);
        } finally {
            setBusy(false);
            setTimeout(() => setFlash(''), 3000);
        }
    }

    if (!data) return <div className="ci-loading">Loading…</div>;

    const eh = data.emirates_holidays?.overall ?? null;

    return (
        <div className="ci-page ci-fade-in">
            <SubNav />
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">
                        <Link to={`/app/competitor-intel/${id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            ← Overview
                        </Link>
                        &nbsp;·&nbsp; Emirates Holidays gap
                    </p>
                    <h1>Portfolio vs. Emirates Holidays</h1>
                </div>
                <div className="ci-header-meta">
                    <button className="ci-btn ci-btn-outline" onClick={ingest} disabled={busy}>
                        {busy ? 'Ingesting…' : 'Re-ingest Analysis 4'}
                    </button>
                    {flash && <div style={{ marginTop: 6, color: 'var(--accent-green)', fontSize: '0.78rem' }}>{flash}</div>}
                </div>
            </header>

            <section className="ci-gap-hero">
                <div>
                    <span className="ci-eyebrow">Emirates Holidays — Analysis 4 reference</span>
                    <div className="ci-gap-hero-score">
                        {eh != null ? eh.toFixed(1) : '—'}
                        {eh != null && <span className="ci-score-out-of">/10</span>}
                    </div>
                </div>
                {eh == null && (
                    <p className="ci-muted">
                        Reference score not yet ingested. Click "Re-ingest Analysis 4" to parse the .docx.
                    </p>
                )}
            </section>

            <section className="ci-compare-section">
                <h2 className="ci-compare-title">Lived portfolio vs. Emirates Holidays</h2>
                <p className="ci-compare-lead">
                    Per DERTOUR brand: the lived overall from this week's investigation against the Emirates Holidays reference from Analysis 4.
                </p>
                <div className="ci-gap-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th>Lived overall</th>
                                <th>Emirates Holidays</th>
                                <th>Delta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lived.map(r => {
                                const lived = r.overall;
                                const delta = (lived != null && eh != null) ? (lived - eh) : null;
                                const sign = delta == null ? '' : (delta >= 0 ? 'pos' : 'neg');
                                return (
                                    <tr key={r.brand_id}>
                                        <th scope="row">{r.brand_name}</th>
                                        <td className="num">{lived != null ? lived.toFixed(1) : '—'}</td>
                                        <td className="num">{eh != null ? eh.toFixed(1) : '—'}</td>
                                        <td className="num" data-sign={sign}>
                                            {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
