import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, MessageCircle } from 'lucide-react';
import OptionCard from './components/OptionCard.jsx';
import OptionPreviewModal from './components/OptionPreviewModal.jsx';
import { briefsApi } from './lib/briefsApi.js';

export default function ContentOptionsChat({ briefId }) {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { options } = await briefsApi.genOptions(briefId);
      setOptions(options);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [briefId]);

  useEffect(() => { generate(); }, [generate]);

  async function accept(idx) {
    setAccepting(true);
    try {
      await briefsApi.accept(briefId, idx);
      navigate(`/app/campaign-creation-v2?briefId=${briefId}&mode=wizard`);
    } catch (err) {
      alert(`Could not accept option: ${err.message}`);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="cc2-chat-view">
      <header className="cc2-chat-view__header">
        <button
          className="cc2-btn"
          onClick={() => navigate('/app/campaign-creation-v2')}
          type="button"
        >
          <ArrowLeft size={14} /> Back to briefs
        </button>
        <h2>Pick a content direction</h2>
      </header>

      <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
        {loading && <div className="cc2-empty">Generating 3 options…</div>}
        {error && (
          <div className="cc2-empty">
            <p>Error: {error}</p>
            <button className="cc2-btn" onClick={generate} type="button">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        )}
        {!loading && !error && options && (
          <>
            <div className="cc2-options-grid">
              {options.map((o, i) => (
                <OptionCard
                  key={i}
                  option={o}
                  letter={String.fromCharCode(65 + i)}
                  onClick={() => setPreviewIdx(i)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="cc2-btn" onClick={generate} type="button" disabled={loading}>
                <RefreshCw size={14} /> Regenerate all 3
              </button>
              <button
                className="cc2-btn ghost-ai"
                onClick={() => navigate(`/app/campaign-creation-v2?briefId=${briefId}&mode=setup`)}
                type="button"
              >
                <MessageCircle size={14} /> Adjust with chat
              </button>
            </div>
          </>
        )}
      </div>

      {previewIdx != null && options && (
        <OptionPreviewModal
          option={options[previewIdx]}
          onAccept={() => accept(previewIdx)}
          onClose={() => setPreviewIdx(null)}
          accepting={accepting}
        />
      )}
    </div>
  );
}
