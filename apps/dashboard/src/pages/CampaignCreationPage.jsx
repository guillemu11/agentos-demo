import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  Loader2, Rocket, ArrowLeft, CheckCircle2, Circle,
  MonitorSmartphone, Smartphone, AlertTriangle, Sparkles,
} from 'lucide-react';
import AIIdeasTab from '../components/ai-proposals/AIIdeasTab.jsx';
import { AI_PROPOSALS } from '../data/aiProposals.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── SSE helper ────────────────────────────────────────────────────────────
async function consumeSSE(url, body, onEvent) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const block of lines) {
      const line = block.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      let parsed;
      try { parsed = JSON.parse(payload); } catch { continue; }
      // onEvent is allowed to throw (caller signals error). We don't swallow it.
      onEvent(parsed);
    }
  }
}

// ─── Section header (anti-card overuse: grouping via border-top + label) ───
function SectionHead({ index, label }) {
  return (
    <div className="bau-section-head">
      <span className="bau-section-idx">{String(index).padStart(2, '0')}</span>
      <span className="bau-section-label">{label}</span>
    </div>
  );
}

// ─── Brief panel (Phase A entry) ───────────────────────────────────────────
function BriefPanel({ t, types, onBuild, busy }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    campaignType: types[0]?.key || '',
    campaignName: '',
    campaignDate: today,
    market: 'UAE',
    variantStrategy: 'ecommerce',
    direction: 'in',
    languages: ['en'],
    cugoCode: false,
    brief: '',
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleLang = (lang) => {
    setForm(f => {
      const has = f.languages.includes(lang);
      const next = has ? f.languages.filter(l => l !== lang) : [...f.languages, lang];
      return { ...f, languages: next.length ? next : ['en'] };
    });
  };

  const valid = form.campaignType && form.campaignName.trim() && form.campaignDate && form.market;

  return (
    <form
      className="bau-brief-panel"
      onSubmit={(e) => { e.preventDefault(); if (valid && !busy) onBuild(form); }}
    >
      <section className="bau-section">
        <SectionHead index={1} label={t('bauBuilder.sections.campaign')} />
        <div className="bau-form-grid">
          <label className="bau-field">
            <span>{t('bauBuilder.form.type')}</span>
            <select value={form.campaignType} onChange={(e) => update('campaignType', e.target.value)} required>
              <option value="">{t('bauBuilder.form.typePlaceholder')}</option>
              {types.map(tp => <option key={tp.key} value={tp.key}>{tp.name}</option>)}
            </select>
          </label>

          <label className="bau-field">
            <span>{t('bauBuilder.form.name')}</span>
            <input
              type="text" value={form.campaignName}
              placeholder={t('bauBuilder.form.namePlaceholder')}
              onChange={(e) => update('campaignName', e.target.value)} required
            />
          </label>

          <label className="bau-field">
            <span>{t('bauBuilder.form.date')}</span>
            <input type="date" value={form.campaignDate} onChange={(e) => update('campaignDate', e.target.value)} required />
          </label>
        </div>
      </section>

      <section className="bau-section">
        <SectionHead index={2} label={t('bauBuilder.sections.audience')} />
        <div className="bau-form-grid">
          <label className="bau-field">
            <span>{t('bauBuilder.form.market')}</span>
            <input
              type="text" value={form.market}
              placeholder={t('bauBuilder.form.marketPlaceholder')}
              onChange={(e) => update('market', e.target.value.toUpperCase())} required
            />
          </label>

          <div className="bau-field">
            <span>{t('bauBuilder.form.variant')}</span>
            <div className="bau-radio-row">
              {['ecommerce', 'skywards'].map(v => (
                <label key={v} className={`bau-radio ${form.variantStrategy === v ? 'active' : ''}`}>
                  <input
                    type="radio" name="variant" value={v}
                    checked={form.variantStrategy === v}
                    onChange={() => update('variantStrategy', v)}
                  />
                  {t(`bauBuilder.form.${v}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="bau-field">
            <span>{t('bauBuilder.form.direction')}</span>
            <div className="bau-radio-row">
              {['in', 'ou'].map(d => (
                <label key={d} className={`bau-radio ${form.direction === d ? 'active' : ''}`}>
                  <input
                    type="radio" name="direction" value={d}
                    checked={form.direction === d}
                    onChange={() => update('direction', d)}
                  />
                  {t(`bauBuilder.form.direction${d === 'in' ? 'In' : 'Ou'}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="bau-field">
            <span>{t('bauBuilder.form.languages')}</span>
            <div className="bau-radio-row">
              {['en', 'ar'].map(lang => (
                <label key={lang} className={`bau-radio ${form.languages.includes(lang) ? 'active' : ''}`}>
                  <input
                    type="checkbox" checked={form.languages.includes(lang)}
                    onChange={() => toggleLang(lang)}
                  />
                  {lang.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <label className="bau-field bau-checkbox">
            <input type="checkbox" checked={form.cugoCode} onChange={(e) => update('cugoCode', e.target.checked)} />
            <span>{t('bauBuilder.form.cugoCode')}</span>
          </label>
        </div>
      </section>

      <section className="bau-section">
        <SectionHead index={3} label={t('bauBuilder.sections.creative')} />
        <label className="bau-field bau-brief">
          <textarea
            rows={4}
            value={form.brief}
            placeholder={t('bauBuilder.form.briefPlaceholder')}
            onChange={(e) => update('brief', e.target.value)}
          />
        </label>
      </section>

      <div className="bau-actions">
        <button type="submit" className="btn-primary bau-build-btn" disabled={!valid || busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {busy ? t('bauBuilder.form.building') : t('bauBuilder.form.build')}
        </button>
      </div>
    </form>
  );
}

// ─── Preview gate ──────────────────────────────────────────────────────────
function PreviewGate({ t, build, onApproveToggle, onPush, onBack, pushing, pushProgress, pushError }) {
  const variantKeys = useMemo(() => Object.keys(build.variants || {}), [build]);
  const [activeKey, setActiveKey] = useState(variantKeys[0]);
  const [device, setDevice] = useState('desktop');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!variantKeys.includes(activeKey)) setActiveKey(variantKeys[0]);
  }, [variantKeys, activeKey]);

  useEffect(() => {
    if (!iframeRef.current) return;
    const html = build.variants?.[activeKey]?.html || '';
    iframeRef.current.srcdoc = html;
  }, [activeKey, build]);

  const approvedCount = variantKeys.filter(k => build.variants[k]?.approved).length;
  const canPush = approvedCount > 0 && !pushing;
  const activeVariant = build.variants?.[activeKey];

  return (
    <div className="bau-gate">
      <aside className="bau-gate-sidebar">
        <h3>{t('bauBuilder.preview.variants')}</h3>
        <ul className="bau-variant-list">
          {variantKeys.map(key => {
            const v = build.variants[key];
            const isActive = key === activeKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`bau-variant-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  {v?.approved ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  <span>{key}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {Object.keys(build.slot_map || {}).length > 0 && (
          <div className="bau-slot-map">
            <h4>Slots</h4>
            <ul>
              {Object.entries(build.slot_map).slice(0, 12).map(([slot, info]) => (
                <li key={slot}>
                  <span className={`bau-slot-dot ${info.filled ? 'filled' : ''}`} />
                  {slot}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="bau-gate-main">
        <header className="bau-gate-header">
          <div className="bau-gate-title">
            <span className="bau-variant-tag">{activeKey}</span>
            <span className="bau-approved-count">
              {approvedCount} / {variantKeys.length} {t('bauBuilder.preview.approved').toLowerCase()}
            </span>
          </div>
          <div className="bau-gate-controls">
            <button
              type="button"
              className={`bau-device-btn ${device === 'desktop' ? 'active' : ''}`}
              onClick={() => setDevice('desktop')}
            >
              <MonitorSmartphone size={14} /> {t('bauBuilder.preview.desktop')}
            </button>
            <button
              type="button"
              className={`bau-device-btn ${device === 'mobile' ? 'active' : ''}`}
              onClick={() => setDevice('mobile')}
            >
              <Smartphone size={14} /> {t('bauBuilder.preview.mobile')}
            </button>
          </div>
        </header>

        <div className={`bau-iframe-wrap ${device}`}>
          <iframe
            ref={iframeRef}
            title={`preview-${activeKey}`}
            className="bau-iframe"
            sandbox="allow-same-origin"
          />
        </div>

        <footer className="bau-gate-footer">
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={14} /> {t('bauBuilder.preview.backToBrief')}
          </button>
          <button
            type="button"
            className={`btn-secondary ${activeVariant?.approved ? 'approved' : ''}`}
            onClick={() => onApproveToggle(activeKey, !activeVariant?.approved)}
          >
            {activeVariant?.approved
              ? <>{t('bauBuilder.preview.unapprove')}</>
              : <><CheckCircle2 size={14} /> {t('bauBuilder.preview.approve')}</>}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canPush}
            onClick={onPush}
            title={canPush ? '' : t('bauBuilder.preview.readyToPush')}
          >
            {pushing ? <Loader2 size={14} className="spin" /> : <Rocket size={14} />}
            {pushing ? t('bauBuilder.preview.pushing') : t('bauBuilder.preview.push')}
          </button>
        </footer>

        {(pushProgress || pushError) && (
          <div className={`bau-push-log ${pushError ? 'error' : ''}`}>
            {pushError
              ? <><AlertTriangle size={14} /> {pushError}</>
              : pushProgress}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CampaignCreationPage() {
  const { t } = useLanguage();
  const [types, setTypes] = useState([]);
  const [view, setView] = useState('brief');           // 'brief' | 'preview'
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState('');
  const [buildError, setBuildError] = useState('');
  const [build, setBuild] = useState(null);            // { id, variants, slot_map, ... }

  const [pushing, setPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState('');
  const [pushError, setPushError] = useState('');
  const [pageTab, setPageTab] = useState('build');

  const campaignHighPriorityCount = AI_PROPOSALS.campaignCreation.filter(p => p.priority === 'urgent' || p.priority === 'high').length;

  useEffect(() => {
    fetch(`${API_URL}/campaigns/bau/types`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { types: [] })
      .then(d => setTypes(d.types || []))
      .catch(() => setTypes([]));
  }, []);

  async function handleBuild(form) {
    setBuilding(true);
    setBuildError('');
    setBuildProgress(t('bauBuilder.progress.building') + '...');
    try {
      let nextBuild = null;
      await consumeSSE(`${API_URL}/campaigns/bau/build`, form, (evt) => {
        if (evt.phase === 'init') {
          nextBuild = { id: evt.buildId, variants: {}, slot_map: {} };
        } else if (evt.phase === 'complete') {
          nextBuild = {
            id: evt.buildId,
            variants: evt.variants || {},
            slot_map: evt.slotMap || {},
            sourceAssetId: evt.sourceAssetId,
            emailName: evt.emailName,
          };
        } else if (evt.phase === 'error') {
          throw new Error(evt.message || 'Build failed');
        } else {
          setBuildProgress(`${evt.phase}${evt.detail ? ': ' + evt.detail : ''}`);
        }
      });
      if (!nextBuild || !Object.keys(nextBuild.variants).length) {
        throw new Error('No variants returned');
      }
      setBuild(nextBuild);
      setView('preview');
    } catch (err) {
      setBuildError(err.message);
    } finally {
      setBuilding(false);
      setBuildProgress('');
    }
  }

  async function handleApproveToggle(variantKey, approved) {
    if (!build) return;
    const optimistic = {
      ...build,
      variants: {
        ...build.variants,
        [variantKey]: { ...build.variants[variantKey], approved },
      },
    };
    setBuild(optimistic);
    try {
      await fetch(`${API_URL}/campaigns/bau/${build.id}/variant/${encodeURIComponent(variantKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });
    } catch {
      // rollback on failure
      setBuild(build);
    }
  }

  async function handlePush() {
    if (!build) return;
    setPushing(true);
    setPushError('');
    setPushProgress(t('bauBuilder.progress.pushing') + '...');
    try {
      await consumeSSE(`${API_URL}/campaigns/bau/${build.id}/push`, {}, (evt) => {
        if (evt.phase === 'error') throw new Error(evt.message || 'Push failed');
        if (evt.phase === 'complete') {
          setPushProgress(`${t('bauBuilder.progress.complete')} — asset ${evt.emailAssetId || ''}`);
        } else {
          setPushProgress(evt.message || evt.phase);
        }
      });
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushing(false);
    }
  }

  const phase = pushing ? 'publish' : (view === 'preview' ? 'preview' : 'brief');
  const steps = [
    { key: 'brief',   label: t('bauBuilder.steps.brief') },
    { key: 'preview', label: t('bauBuilder.steps.preview') },
    { key: 'publish', label: t('bauBuilder.steps.publish') },
  ];
  const phaseIndex = steps.findIndex(s => s.key === phase);

  return (
    <div className="bau-page">
      <header className="bau-page-header">
        <div className="bau-page-title">
          <h1>{t('bauBuilder.title')}</h1>
          <p>{t('bauBuilder.subtitle')}</p>
        </div>
        <ol className="bau-stepper" aria-label="progress">
          {steps.map((s, i) => {
            const state = i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'idle';
            return (
              <li key={s.key} className={`bau-step is-${state}`}>
                <span className="bau-step-dot" aria-hidden="true" />
                <span className="bau-step-label">{s.label}</span>
                {i < steps.length - 1 && <span className="bau-step-bar" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </header>

      <div className="bau-page-tabs">
        <button
          className={`bau-page-tab${pageTab === 'build' ? ' active' : ''}`}
          onClick={() => setPageTab('build')}
          type="button"
        >
          Build
        </button>
        <button
          className={`bau-page-tab${pageTab === 'ai-ideas' ? ' active' : ''}`}
          onClick={() => setPageTab('ai-ideas')}
          type="button"
        >
          ✦ AI Ideas
          {campaignHighPriorityCount > 0 && (
            <span className="ai-tab-badge">{campaignHighPriorityCount}</span>
          )}
        </button>
      </div>

      {pageTab === 'build' && view === 'brief' && (
        <>
          <BriefPanel t={t} types={types} onBuild={handleBuild} busy={building} />
          {(buildProgress || buildError) && (
            <div className={`bau-push-log ${buildError ? 'error' : ''}`}>
              {buildError ? <><AlertTriangle size={14} /> {buildError}</> : buildProgress}
            </div>
          )}
        </>
      )}

      {pageTab === 'build' && view === 'preview' && build && (
        <PreviewGate
          t={t}
          build={build}
          onApproveToggle={handleApproveToggle}
          onPush={handlePush}
          onBack={() => { setView('brief'); setPushProgress(''); setPushError(''); }}
          pushing={pushing}
          pushProgress={pushProgress}
          pushError={pushError}
        />
      )}

      {pageTab === 'ai-ideas' && (
        <AIIdeasTab
          proposals={AI_PROPOSALS.campaignCreation}
          onDemand
          metaText="Generated on demand"
        />
      )}
    </div>
  );
}
