import { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { PROPOSED_JOURNEYS } from '../../data/aiProposals.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function SuggestedJourneys({ onCreated }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const build = async (proposal) => {
    setBusyId(proposal.id);
    setError(null);
    try {
      const r = await fetch(`${API}/journeys`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: proposal.suggestedName }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const journey = await r.json();
      onCreated(journey, proposal.seed);
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  return (
    <section className="sj">
      <header className="sj__header">
        <div className="sj__eyebrow">
          <Sparkles size={12} strokeWidth={2.5} />
          <span>Suggested by AI</span>
        </div>
        <h2 className="sj__title">Journeys Emirates could ship this week</h2>
        <p className="sj__subtitle">Proven airline patterns tuned to your portfolio. Click to launch the canvas — the agent builds it with you.</p>
      </header>

      <div className="sj__grid">
        {PROPOSED_JOURNEYS.map((p) => (
          <button
            key={p.id}
            className={`sj__card sj__card--${p.priority}`}
            onClick={() => build(p)}
            disabled={busyId !== null}
            type="button"
          >
            <div className="sj__card-top">
              <div className={`sj__card-icon sj__card-icon--${p.priority}`}>{p.icon}</div>
              <span className={`sj__card-priority sj__card-priority--${p.priority}`}>
                {p.priority}
              </span>
            </div>
            <h3 className="sj__card-title">{p.title}</h3>
            <p className="sj__card-desc">{p.description}</p>
            <div className="sj__card-context">{p.context}</div>
            <div className="sj__card-cta">
              {busyId === p.id ? (
                <>
                  <Loader2 size={12} className="spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <span>Build this journey</span>
                  <ArrowRight size={12} strokeWidth={2.5} />
                </>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && <div className="sj__error">{error}</div>}
    </section>
  );
}
