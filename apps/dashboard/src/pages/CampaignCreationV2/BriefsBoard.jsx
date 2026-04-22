import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles, User } from 'lucide-react';
import BriefCard from './components/BriefCard.jsx';
import { briefsApi } from './lib/briefsApi.js';

export default function BriefsBoard() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [openBriefId, setOpenBriefId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { briefs } = await briefsApi.list();
      setBriefs(briefs);
    } catch (err) {
      console.error('[briefs board] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const human = briefs.filter(b => b.source === 'human' && b.status !== 'sent');
  const ai    = briefs.filter(b => b.source === 'ai'    && b.status !== 'dismissed');

  async function onNew() {
    try {
      const { brief } = await briefsApi.create();
      navigate(`/app/campaign-creation-v2?briefId=${brief.id}&mode=setup`);
    } catch (err) {
      alert(`Could not create brief: ${err.message}`);
    }
  }

  async function onRegenerate() {
    setRegenerating(true);
    try {
      await briefsApi.regenerateOpportunities();
      await load();
    } catch (err) {
      alert(`Could not regenerate opportunities: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <div className="cc2-empty">Loading briefs…</div>;

  return (
    <div className="cc2-board">
      <section className="cc2-column">
        <header className="cc2-column-header">
          <span className="cc2-column-title human">
            <User size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            HUMAN · {human.length}
          </span>
          <button className="cc2-btn primary" onClick={onNew} type="button">
            <Plus size={14} /> New
          </button>
        </header>
        {human.length === 0 ? (
          <div className="cc2-empty">
            No human briefs yet.<br />
            Click <strong>+ New</strong> to start a conversation.
          </div>
        ) : (
          human.map(b => (
            <BriefCard key={b.id} brief={b} onClick={() => setOpenBriefId(b.id)} />
          ))
        )}
      </section>

      <section className="cc2-column">
        <header className="cc2-column-header">
          <span className="cc2-column-title ai">
            <Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            AI · {ai.length}
          </span>
          <button
            className="cc2-btn ghost-ai"
            onClick={onRegenerate}
            disabled={regenerating}
            type="button"
          >
            <RefreshCw size={14} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </header>
        {ai.length === 0 ? (
          <div className="cc2-empty">
            No AI opportunities yet.<br />
            Click <strong>Regenerate</strong> to discover campaigns.
          </div>
        ) : (
          ai.map(b => (
            <BriefCard key={b.id} brief={b} onClick={() => setOpenBriefId(b.id)} />
          ))
        )}
      </section>

      {openBriefId && (
        /* BriefDetailModal lands in Task 2.5. Leaving the slot wired. */
        <div
          className="cc2-modal-backdrop"
          onClick={() => { setOpenBriefId(null); load(); }}
          style={{ cursor: 'pointer' }}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              padding: 24,
              borderRadius: 12,
              maxWidth: 480,
              color: 'var(--text-main)',
              fontSize: 13,
            }}
            onClick={e => e.stopPropagation()}
          >
            Brief detail modal coming in Task 2.5. Click the backdrop to close.
            <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
              id: {openBriefId}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
