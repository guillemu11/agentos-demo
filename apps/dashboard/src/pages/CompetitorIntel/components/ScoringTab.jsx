import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '/api';

const AXES = [
    { key: 'lifecycle_maturity',   label: 'Lifecycle maturity',   hint: 'Breadth of lifecycle stages covered (welcome, nurture, abandonment, re-engagement, etc.)' },
    { key: 'email_sophistication', label: 'Email sophistication', hint: 'Content quality, personalisation in copy, design polish' },
    { key: 'journey_depth',        label: 'Journey depth',        hint: 'How deep the triggered journeys go (single welcome vs. multi-step series)' },
    { key: 'personalisation',      label: 'Personalisation',      hint: 'Segment cues, preference respect, interest-based content' },
];

export default function ScoringTab({ brand, scores, onChange }) {
    const [form, setForm] = useState({
        lifecycle_maturity:   scores?.lifecycle_maturity   ?? 5,
        email_sophistication: scores?.email_sophistication ?? 5,
        journey_depth:        scores?.journey_depth        ?? 5,
        personalisation:      scores?.personalisation      ?? 5,
        manual_notes:         scores?.manual_notes         ?? '',
    });
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState('');

    useEffect(() => {
        setForm({
            lifecycle_maturity:   scores?.lifecycle_maturity   ?? 5,
            email_sophistication: scores?.email_sophistication ?? 5,
            journey_depth:        scores?.journey_depth        ?? 5,
            personalisation:      scores?.personalisation      ?? 5,
            manual_notes:         scores?.manual_notes         ?? '',
        });
    }, [scores?.brand_id, scores?.last_calculated_at]);

    async function autoRun() {
        setBusy(true);
        try {
            await fetch(`${API}/competitor-intel/brands/${brand.id}/score/auto`, { method: 'POST' });
            setFlash('Auto-scored from emails');
            await onChange?.();
        } finally { setBusy(false); setTimeout(() => setFlash(''), 2500); }
    }
    async function save() {
        setBusy(true);
        try {
            await fetch(`${API}/competitor-intel/brands/${brand.id}/score`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            setFlash('Scoring saved');
            await onChange?.();
        } finally { setBusy(false); setTimeout(() => setFlash(''), 2500); }
    }

    const overall = (form.lifecycle_maturity + form.email_sophistication + form.journey_depth + form.personalisation) / 4;

    return (
        <div className="ci-scoring">
            <div className="ci-scoring-head">
                <div>
                    <span className="ci-eyebrow">Overall</span>
                    <div className="ci-scoring-overall">
                        {overall.toFixed(1)}<span className="ci-score-out-of">/10</span>
                    </div>
                    {scores?.last_calculated_at && (
                        <small className="ci-muted">
                            Updated {new Date(scores.last_calculated_at).toLocaleString()}
                        </small>
                    )}
                </div>
                <div className="ci-scoring-actions">
                    <button className="ci-btn ci-btn-outline" onClick={autoRun} disabled={busy}>
                        Auto-score from emails
                    </button>
                    <button className="ci-btn ci-btn-primary" onClick={save} disabled={busy}>
                        Save scoring
                    </button>
                    {flash && <span className="ci-flash">{flash}</span>}
                </div>
            </div>

            <div className="ci-scoring-axes">
                {AXES.map(a => (
                    <div key={a.key} className="ci-scoring-axis">
                        <div className="ci-scoring-axis-head">
                            <label htmlFor={`axis-${a.key}`}>{a.label}</label>
                            <strong>{Number(form[a.key]).toFixed(1)}</strong>
                        </div>
                        <input
                            id={`axis-${a.key}`}
                            type="range" min="0" max="10" step="0.5"
                            value={form[a.key]}
                            onChange={e => setForm(f => ({ ...f, [a.key]: parseFloat(e.target.value) }))}
                        />
                        <p className="ci-scoring-hint">{a.hint}</p>
                    </div>
                ))}
            </div>

            <div className="ci-scoring-notes">
                <label htmlFor="manual_notes" className="ci-eyebrow" style={{ marginBottom: 8, display: 'block' }}>Notes & justification</label>
                <textarea
                    id="manual_notes"
                    rows={5}
                    placeholder="What evidence drove these scores? Which emails stand out?"
                    value={form.manual_notes}
                    onChange={e => setForm(f => ({ ...f, manual_notes: e.target.value }))}
                />
            </div>
        </div>
    );
}
