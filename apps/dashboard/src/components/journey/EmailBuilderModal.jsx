import { useEffect, useRef, useState } from 'react';
import { X, Mail, Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

const MARKETS = ['UAE', 'UK', 'KSA', 'India', 'Australia', 'Germany', 'France', 'USA'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

// Parse SSE lines from a ReadableStream
async function* readSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { yield JSON.parse(line.slice(6)); } catch {}
      }
    }
  }
}

export default function EmailBuilderModal({ open, journeyId, activity, onClose, onConfirmed }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState(1);
  const [market, setMarket] = useState('UAE');
  const [language, setLanguage] = useState('en');
  const [brief, setBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [html, setHtml] = useState('');
  const [emailName, setEmailName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [refining, setRefining] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPhase(1);
      setBrief('');
      setHtml('');
      setEmailName('');
      setChatMessages([]);
      setError(null);
      setStatusMsg('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (phase === 2 && html) {
        if (window.confirm(t('journeys.emailBuilder.cancelConfirm'))) onClose();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, html, onClose, t]);

  useEffect(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) { doc.open(); doc.write(html); doc.close(); }
    }
  }, [html]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    setGenerating(true);
    setError(null);
    setStatusMsg(t('journeys.emailBuilder.generating'));
    setPhase(2);

    try {
      const resp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/build`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, market, brief }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      for await (const event of readSSE(resp.body)) {
        if (event.type === 'status') setStatusMsg(event.message || event.phase);
        if (event.type === 'result') {
          setHtml(event.html);
          setEmailName(event.emailName || activity.email_shell_name);
          setStatusMsg('');
        }
        if (event.type === 'error') throw new Error(event.message);
      }
    } catch (err) {
      setError(t('journeys.emailBuilder.errorBuild') + ': ' + err.message);
      setPhase(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async () => {
    const msg = chatInput.trim();
    if (!msg || refining) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: msg }]);
    setRefining(true);

    try {
      const resp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, currentHtml: html }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      for await (const event of readSSE(resp.body)) {
        if (event.type === 'result') {
          setHtml(event.html);
          setChatMessages((prev) => [...prev, { role: 'agent', text: 'Done — preview updated.' }]);
        }
        if (event.type === 'error') throw new Error(event.message);
      }
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'agent', text: `Error: ${err.message}` }]);
    } finally {
      setRefining(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      // Step 1: create MC shell
      const confirmResp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}/email/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_type: activity.campaign_type, emailName }),
      });
      if (!confirmResp.ok) throw new Error(`HTTP ${confirmResp.status}`);
      const { mc_email_id, email_shell_name } = await confirmResp.json();

      // Step 2: patch activity in DSL
      const patchResp = await fetch(`${API}/journeys/${journeyId}/activities/${activity.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mc_email_id, email_shell_name }),
      });
      if (!patchResp.ok) throw new Error(`HTTP ${patchResp.status}`);
      const { dsl } = await patchResp.json();

      onConfirmed(dsl);
    } catch (err) {
      setError(t('journeys.emailBuilder.errorConfirm') + ': ' + err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    if (phase === 2 && html) {
      if (window.confirm(t('journeys.emailBuilder.cancelConfirm'))) onClose();
    } else {
      onClose();
    }
  };

  if (!open || !activity) return null;

  return (
    <div className="ebm" role="dialog" aria-modal="true" aria-labelledby="ebm-title">
      <button className="ebm__scrim" onClick={handleClose} aria-label={t('journeys.emailBuilder.close')} />

      <div className="ebm__panel">
        <div className="ebm__header">
          <h2 id="ebm-title" className="ebm__title">
            <Mail size={15} strokeWidth={2} />
            {t('journeys.emailBuilder.title')} — {activity.email_shell_name}
          </h2>
          <button className="ebm__close" onClick={handleClose} aria-label={t('journeys.emailBuilder.close')}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {phase === 1 && (
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div className="ebm__phase1">
              <div className="ebm__row">
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.marketLabel')}</span>
                  <select className="ebm__select" value={market} onChange={(e) => setMarket(e.target.value)}>
                    {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.languageLabel')}</span>
                  <select className="ebm__select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </label>
                <label className="ebm__field">
                  <span className="ebm__label">{t('journeys.emailBuilder.campaignTypeLabel')}</span>
                  <select className="ebm__select" disabled value={activity.campaign_type}>
                    <option value={activity.campaign_type}>{activity.campaign_type}</option>
                  </select>
                </label>
              </div>
              <label className="ebm__field">
                <span className="ebm__label">{t('journeys.emailBuilder.briefLabel')}</span>
                <textarea
                  className="ebm__textarea"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={t('journeys.emailBuilder.briefPlaceholder')}
                  required
                />
              </label>
              {error && <div className="ebm__error">{error}</div>}
            </div>
            <div className="ebm__footer-phase1">
              <button type="button" className="ebm__btn ebm__btn--ghost" onClick={onClose}>
                {t('journeys.emailBuilder.close')}
              </button>
              <button type="submit" className="ebm__btn ebm__btn--primary" disabled={!brief.trim()}>
                {t('journeys.emailBuilder.generateBtn')}
              </button>
            </div>
          </form>
        )}

        {phase === 2 && (
          <>
            <div className="ebm__phase2">
              <div className="ebm__preview-pane">
                {(generating || !html) ? (
                  <div className="ebm__preview-loading">
                    <span>{statusMsg || t('journeys.emailBuilder.generating')}</span>
                  </div>
                ) : (
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                )}
              </div>
              <div className="ebm__chat-pane">
                <div className="ebm__chat-messages">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`ebm__chat-bubble ebm__chat-bubble--${m.role}`}>
                      {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="ebm__chat-input-row">
                  <input
                    className="ebm__chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t('journeys.emailBuilder.chatPlaceholder')}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                    disabled={refining || !html}
                  />
                  <button
                    className="ebm__btn ebm__btn--send"
                    onClick={handleRefine}
                    disabled={refining || !chatInput.trim() || !html}
                    aria-label="Send"
                  >
                    <Send size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
            <div className="ebm__footer-phase2">
              {error && <div className="ebm__error" style={{ flex: 1 }}>{error}</div>}
              <button className="ebm__btn ebm__btn--ghost" onClick={onClose} disabled={confirming}>
                {t('journeys.emailBuilder.close')}
              </button>
              <button
                className="ebm__btn ebm__btn--primary"
                onClick={handleConfirm}
                disabled={confirming || !html || generating}
              >
                {confirming ? t('journeys.emailBuilder.confirming') : t('journeys.emailBuilder.confirmBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
