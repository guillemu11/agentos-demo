import { useEffect, useRef, useState } from 'react';
import { X, Mail, Send, Sparkles, MessageSquare, Info } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

const MARKETS = ['UAE', 'UK', 'KSA', 'India', 'Australia', 'Germany', 'France', 'USA'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

/** Infer market from email_shell_name or entry SQL */
function inferMarket(dsl, activity) {
  const name = (activity?.email_shell_name || '').toUpperCase();
  for (const m of MARKETS) {
    if (name.includes(m.toUpperCase())) return m;
  }
  const sql = dsl?.entry?.source?.sql || '';
  const m = sql.match(/market\s*=\s*'([^']+)'/i);
  return m ? m[1] : 'UAE';
}

/** Infer language from email_shell_name */
function inferLanguage(activity) {
  const name = (activity?.email_shell_name || '').toLowerCase();
  if (name.includes('_ar') || name.includes('arabic')) return 'ar';
  if (name.includes('_de') || name.includes('german'))  return 'de';
  if (name.includes('_fr') || name.includes('french'))  return 'fr';
  return 'en';
}

/** Build a contextual pre-filled brief from the journey DSL + activity */
function buildAutoBrief(dsl, activity) {
  if (!dsl || !activity) return '';
  const lines = [];

  // Journey name
  const journeyName = dsl.name || 'this journey';
  lines.push(`Email for the "${journeyName}" journey.`);

  // Audience from SQL
  const sql = dsl.entry?.source?.sql || '';
  const audienceParts = [];
  const mktMatch = sql.match(/market\s*=\s*'([^']+)'/i);
  const tierMatch = sql.match(/tier\s+IN\s*\(([^)]+)\)/i);
  const segMatch  = sql.match(/segment\s*=\s*'([^']+)'/i);
  if (mktMatch)  audienceParts.push(mktMatch[1] + ' market');
  if (tierMatch) audienceParts.push('tiers: ' + tierMatch[1].replace(/'/g, '').replace(/\s+/g, ''));
  if (segMatch)  audienceParts.push(segMatch[1] + ' segment');
  if (audienceParts.length) lines.push(`Audience: ${audienceParts.join(', ')}.`);

  // Journey position & preceding context
  const acts = dsl.activities || [];
  const idx = acts.findIndex((a) => a.id === activity.id);
  const contextHints = [];
  if (idx > 0) {
    for (let i = idx - 1; i >= 0 && i >= idx - 3; i--) {
      const prev = acts[i];
      if (prev.type === 'wait_duration') {
        contextHints.push(`${prev.amount} ${prev.unit} after entry`);
      } else if (prev.type === 'decision_split') {
        const branch = prev.branches?.find((b) => {
          // walk the chain to see if it reaches our activity
          let cur = b.next;
          for (let k = 0; k < 5 && cur; k++) {
            if (cur === activity.id) return true;
            const next = acts.find((a) => a.id === cur);
            cur = next?.next || null;
          }
          return false;
        });
        if (branch) contextHints.push(`"${branch.label}" segment (${branch.condition})`);
      } else if (prev.type === 'engagement_split') {
        const outcome = prev.yes_next === activity.id ? 'engaged (opened/clicked)' : 'non-engaged';
        contextHints.push(`${outcome} cohort`);
      }
    }
  }
  if (contextHints.length) lines.push(`Context: ${contextHints.join(', ')}.`);

  // Campaign type tone guidance
  const ct = activity.campaign_type || '';
  const toneMap = {
    'promotional':            'Promotional — highlight the offer, create urgency.',
    'product-offer-ecommerce':'Ecommerce offer — lead with product, clear CTA, price emphasis.',
    'transactional':          'Transactional — clear, concise, action-focused. No hard sell.',
    'retention':              'Retention — warm, value-reminder, reduce churn framing.',
    'reactivation':           'Reactivation — win-back tone, acknowledge absence, compelling incentive.',
  };
  const toneHint = toneMap[ct] || `Campaign type: ${ct}.`;
  lines.push(toneHint);

  lines.push('Emirates brand voice: professional, aspirational, premium.\nInclude: subject line, preview text, hero headline, body copy, CTA.');

  return lines.join('\n');
}

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

export default function EmailBuilderModal({ open, journeyId, activity, dsl, onClose, onConfirmed }) {
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
    if (open && activity) {
      setPhase(1);
      setBrief(buildAutoBrief(dsl, activity));
      setMarket(inferMarket(dsl, activity));
      setLanguage(inferLanguage(activity));
      setHtml('');
      setEmailName('');
      setChatMessages([]);
      setError(null);
      setStatusMsg('');
    }
  }, [open, activity]);

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
            {t('journeys.emailBuilder.title')}
            <span className="ebm__title-sub">— {activity.email_shell_name}</span>
          </h2>
          <button className="ebm__close" onClick={handleClose} aria-label={t('journeys.emailBuilder.close')}>
            <X size={16} strokeWidth={2} />
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
              {brief && (
                <div className="ebm__brief-hint">
                  <Info size={13} strokeWidth={2} />
                  Pre-filled from journey context — edit freely before generating.
                </div>
              )}
              {error && <div className="ebm__error">{error}</div>}
            </div>
            <div className="ebm__footer-phase1">
              <button type="button" className="ebm__btn ebm__btn--ghost" onClick={onClose}>
                {t('journeys.emailBuilder.close')}
              </button>
              <button type="submit" className="ebm__btn ebm__btn--primary" disabled={!brief.trim()}>
                <Sparkles size={13} strokeWidth={2} />
                {t('journeys.emailBuilder.generateBtn')}
              </button>
            </div>
          </form>
        )}

        {phase === 2 && (
          <>
            <div className="ebm__phase2">
              <div className="ebm__preview-pane">
                {(generating || !html) && (
                  <div className="ebm__preview-loading">
                    <div className="ebm__preview-loading__spinner" />
                    <div className="ebm__preview-loading__text">
                      {statusMsg || t('journeys.emailBuilder.generating')}
                      <div className="ebm__preview-loading__dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  sandbox="allow-same-origin"
                  title="Email preview"
                  style={{ display: html && !generating ? 'block' : 'none', width: '100%', height: '100%', border: 'none' }}
                />
              </div>
              <div className="ebm__chat-pane">
                <div className="ebm__chat-pane-header">
                  <MessageSquare size={11} strokeWidth={2} />
                  Refine
                </div>
                <div className="ebm__chat-messages">
                  {chatMessages.length === 0 && html && (
                    <div className="ebm__chat-empty">
                      <Sparkles size={28} strokeWidth={1.5} />
                      <p>Ask me to adjust copy, colors, layout, or tone</p>
                    </div>
                  )}
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
