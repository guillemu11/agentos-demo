import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SubNav from './components/SubNav.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Insights() {
    const { id } = useParams();
    const [insights, setInsights] = useState([]);
    const [brands, setBrands] = useState([]);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ brand_id: '', title: '', body: '', category: 'lifecycle', severity: 'medium' });

    async function load() {
        const [a, b] = await Promise.all([
            fetch(`${API}/competitor-intel/investigations/${id}/insights`).then((r) => r.json()),
            fetch(`${API}/competitor-intel/investigations/${id}`).then((r) => r.json()),
        ]);
        setInsights(a.insights || []);
        setBrands(b.brands || []);
    }
    useEffect(() => { load(); }, [id]);

    async function save() {
        if (!form.title.trim()) return;
        setBusy(true);
        try {
            await fetch(`${API}/competitor-intel/insights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    brand_id: form.brand_id ? parseInt(form.brand_id, 10) : null,
                }),
            });
            setForm({ brand_id: '', title: '', body: '', category: 'lifecycle', severity: 'medium' });
            await load();
        } finally { setBusy(false); }
    }

    async function remove(insightId) {
        if (!window.confirm('Delete this insight?')) return;
        await fetch(`${API}/competitor-intel/insights/${insightId}`, { method: 'DELETE' });
        await load();
    }

    return (
        <div className="ci-page ci-fade-in">
            <SubNav />
            <header className="ci-page-header">
                <div>
                    <p className="ci-eyebrow">
                        <Link to={`/app/competitor-intel/${id}`} style={{ color: 'inherit', textDecoration: 'none' }}>← Overview</Link>
                        &nbsp;·&nbsp; Insights
                    </p>
                    <h1>Strategic findings</h1>
                </div>
                <div className="ci-header-meta">
                    {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
                    <br />
                    <a className="ci-btn ci-btn-primary" style={{ marginTop: 8 }}
                       href={`${API}/competitor-intel/investigations/${id}/export.docx`}>
                        Export Analysis 5 (.docx)
                    </a>
                </div>
            </header>

            <section className="ci-insights-form">
                <h3 className="ci-compare-title" style={{ fontSize: '1.05rem' }}>Capture a new insight</h3>
                <div className="ci-form-row">
                    <label>
                        <span className="ci-eyebrow">Brand</span>
                        <select value={form.brand_id} onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}>
                            <option value="">— Cross-brand —</option>
                            {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="ci-eyebrow">Category</span>
                        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                            <option value="lifecycle">Lifecycle</option>
                            <option value="email">Email</option>
                            <option value="journey">Journey</option>
                            <option value="personalisation">Personalisation</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                    <label>
                        <span className="ci-eyebrow">Severity</span>
                        <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </label>
                </div>
                <label style={{ display: 'block' }}>
                    <span className="ci-eyebrow">Title</span>
                    <input
                        type="text"
                        placeholder="Short, declarative finding (e.g. 'Carrier sends personalised welcome in 4 min')"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                </label>
                <label style={{ display: 'block' }}>
                    <span className="ci-eyebrow">Body</span>
                    <textarea
                        rows={4}
                        placeholder="Evidence and implication…"
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    />
                </label>
                <div>
                    <button className="ci-btn ci-btn-primary" onClick={save} disabled={busy || !form.title.trim()}>
                        Save insight
                    </button>
                </div>
            </section>

            {insights.length === 0 ? (
                <p className="ci-muted">No insights captured yet.</p>
            ) : (
                <ul className="ci-insights-list">
                    {insights.map((i) => (
                        <li key={i.id}>
                            <div className="ci-insight-head">
                                <div>
                                    <span className="ci-eyebrow">{i.brand_name || 'Cross-brand'} · {i.category || 'insight'} · {i.severity || 'medium'}</span>
                                    <strong>{i.title}</strong>
                                </div>
                                <div className="ci-insight-meta">
                                    <time>{fmtDateTime(i.created_at)}</time>
                                    <button className="ci-btn ci-btn-outline ci-btn-sm" onClick={() => remove(i.id)}>Delete</button>
                                </div>
                            </div>
                            {i.body && <p className="ci-insight-body">{i.body}</p>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
