import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ShieldCheck, Upload, FileText, Zap, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, RotateCcw, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const API = import.meta.env.VITE_API_URL || '/api';

// ─── Issue & Fix card helpers ─────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const { t } = useLanguage();
  const map = { critical: 'bgp__badge--critical', warning: 'bgp__badge--warning', info: 'bgp__badge--info' };
  const labelKey = { critical: 'brandGuardian.severity.critical', warning: 'brandGuardian.severity.warning', info: 'brandGuardian.severity.info' };
  return <span className={`bgp__badge ${map[severity] || 'bgp__badge--info'}`}>{labelKey[severity] ? t(labelKey[severity]) : severity}</span>;
}

function TypeBadge({ type }) {
  const { t } = useLanguage();
  const map = { html: 'bgp__badge--html', content: 'bgp__badge--content' };
  const labelKey = { html: 'brandGuardian.type.html', content: 'brandGuardian.type.content' };
  return <span className={`bgp__badge ${map[type] || 'bgp__badge--html'}`}>{labelKey[type] ? t(labelKey[type]) : type}</span>;
}

// ─── Pipeline Node ───────────────────────────────────────────────────────────

function PipelineNode({ icon: Icon, label, sublabel, state, issueCount, fixCount }) {
  const { t } = useLanguage();
  // state: 'idle' | 'active' | 'done' | 'error'
  return (
    <div className={`bgp__node bgp__node--${state}`}>
      <div className="bgp__node-ring">
        <div className="bgp__node-icon">
          {state === 'done'
            ? <CheckCircle2 size={28} />
            : state === 'active'
            ? <Icon size={28} className="bgp__spin" />
            : <Icon size={28} />}
        </div>
      </div>
      <div className="bgp__node-label">{label}</div>
      {sublabel && <div className="bgp__node-sublabel">{sublabel}</div>}
      {issueCount !== undefined && issueCount > 0 && (
        <span className="bgp__node-badge bgp__node-badge--issues">{t('brandGuardian.pipeline.issuesCount').replace('{n}', issueCount)}</span>
      )}
      {fixCount !== undefined && fixCount > 0 && (
        <span className="bgp__node-badge bgp__node-badge--fixes">{t('brandGuardian.pipeline.fixesCount').replace('{n}', fixCount)}</span>
      )}
    </div>
  );
}

// ─── Animated Arrow ───────────────────────────────────────────────────────────

function PipelineArrow({ active, reverse }) {
  return (
    <div className={`bgp__arrow ${active ? 'bgp__arrow--active' : ''} ${reverse ? 'bgp__arrow--reverse' : ''}`}>
      <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
        <path
          d="M4 12 H72"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="8 4"
          className="bgp__arrow-dash"
        />
        {!reverse && <path d="M66 6 L76 12 L66 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />}
        {reverse && <path d="M14 6 L4 12 L14 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({ issue, fix }) {
  return (
    <div className={`bgp__issue-card bgp__issue-card--${issue.severity}`}>
      <div className="bgp__issue-header">
        <div className="bgp__issue-badges">
          <SeverityBadge severity={issue.severity} />
          <TypeBadge type={issue.type} />
        </div>
        {issue.location && <span className="bgp__issue-location">{issue.location}</span>}
      </div>
      <p className="bgp__issue-desc">{issue.description}</p>
      {fix && (
        <div className="bgp__issue-fix">
          <CheckCircle2 size={13} />
          <span>{fix.description}</span>
        </div>
      )}
    </div>
  );
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ onFile }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);

  const readFile = (file) => {
    if (!file || !file.name.endsWith('.html')) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setHtmlContent(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    readFile(file);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  return (
    <div className="bgp__upload-section">
      <div
        className={`bgp__dropzone ${dragging ? 'bgp__dropzone--dragging' : ''} ${fileName ? 'bgp__dropzone--loaded' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !fileName && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".html"
          style={{ display: 'none' }}
          onChange={(e) => readFile(e.target.files[0])}
        />
        {fileName ? (
          <div className="bgp__dropzone-loaded">
            <FileText size={32} className="bgp__dropzone-icon--loaded" />
            <div className="bgp__dropzone-filename">{fileName}</div>
            <div className="bgp__dropzone-hint">{t('brandGuardian.upload.ready')}</div>
          </div>
        ) : (
          <div className="bgp__dropzone-empty">
            <Upload size={36} className="bgp__dropzone-icon" />
            <div className="bgp__dropzone-title">{dragging ? t('brandGuardian.upload.dropHere') : t('brandGuardian.upload.dropTitle')}</div>
            <div className="bgp__dropzone-hint">{t('brandGuardian.upload.browseHint')}</div>
          </div>
        )}
      </div>

      {fileName && (
        <div className="bgp__upload-actions">
          <button
            className="bgp__btn-ghost"
            onClick={() => { setFileName(null); setHtmlContent(null); }}
          >
            <RotateCcw size={14} /> {t('brandGuardian.upload.changeFile')}
          </button>
          <button
            className="bgp__btn-primary"
            onClick={() => htmlContent && onFile(htmlContent, fileName)}
          >
            <ShieldCheck size={16} /> {t('brandGuardian.upload.runQa')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Iteration Timeline Entry ────────────────────────────────────────────────

function IterationEntry({ event, allFixes }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  if (event.type !== 'issues' && event.type !== 'fix_done') return null;

  if (event.type === 'issues') {
    const issueCountLabel = event.issues.length === 1
      ? t('brandGuardian.timeline.issuesSingular').replace('{n}', event.issues.length)
      : t('brandGuardian.timeline.issuesPlural').replace('{n}', event.issues.length);
    return (
      <div className="bgp__iter-entry">
        <div className="bgp__iter-header" onClick={() => setOpen(o => !o)}>
          <ShieldCheck size={15} />
          <span>{t('brandGuardian.timeline.qaPass').replace('{n}', event.iteration)}</span>
          <span className="bgp__iter-count">{issueCountLabel}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {open && (
          <div className="bgp__iter-body">
            {event.approved && <p className="bgp__approved-msg"><CheckCircle2 size={14} /> {t('brandGuardian.timeline.approved')}</p>}
            {event.issues.map((iss) => {
              const fix = allFixes.find(f => f.issue_id === iss.id);
              return <IssueCard key={iss.id} issue={iss} fix={fix} />;
            })}
          </div>
        )}
      </div>
    );
  }

  if (event.type === 'fix_done') {
    const label = event.fixer === 'both'
      ? t('brandGuardian.pipeline.htmlContentFixer')
      : event.fixer === 'html'
      ? t('brandGuardian.pipeline.htmlFixer')
      : t('brandGuardian.pipeline.contentFixer');
    const fixCountLabel = event.fixes.length === 1
      ? t('brandGuardian.timeline.fixesSingular').replace('{n}', event.fixes.length)
      : t('brandGuardian.timeline.fixesPlural').replace('{n}', event.fixes.length);
    return (
      <div className="bgp__iter-entry bgp__iter-entry--fix">
        <div className="bgp__iter-header" onClick={() => setOpen(o => !o)}>
          <Zap size={15} />
          <span>{t('brandGuardian.timeline.fixerIteration').replace('{label}', label).replace('{n}', event.iteration)}</span>
          <span className="bgp__iter-count bgp__iter-count--fix">{fixCountLabel}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {open && (
          <div className="bgp__iter-body">
            {event.fixes.map((fix, i) => (
              <div key={i} className="bgp__fix-row">
                <CheckCircle2 size={13} className="bgp__fix-icon" />
                <span>{fix.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Results section ─────────────────────────────────────────────────────────

function Results({ originalHtml, finalHtml, allIssues, allFixes }) {
  const { t } = useLanguage();
  const totalFixed = allFixes.length;
  const critical = allIssues.filter(i => i.severity === 'critical').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className="bgp__results animate-fade-in">
      <div className="bgp__results-header">
        <div className="bgp__results-badge">
          <CheckCircle2 size={18} />
          <span>{t('brandGuardian.results.complete')}</span>
        </div>
        <div className="bgp__results-stats">
          <span className="bgp__stat bgp__stat--critical">{t('brandGuardian.results.statCritical').replace('{n}', critical)}</span>
          <span className="bgp__stat bgp__stat--warning">{t('brandGuardian.results.statWarning').replace('{n}', warnings)}</span>
          <span className="bgp__stat bgp__stat--fix">{t('brandGuardian.results.statFixes').replace('{n}', totalFixed)}</span>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="bgp__comparison">
        <div className="bgp__comparison-col">
          <div className="bgp__comparison-label bgp__comparison-label--before">
            <AlertTriangle size={14} /> {t('brandGuardian.results.labelOriginal')}
          </div>
          <div className="bgp__iframe-wrap">
            <iframe
              srcDoc={originalHtml}
              title={t('brandGuardian.results.iframeOriginal')}
              sandbox="allow-same-origin"
              className="bgp__iframe"
            />
          </div>
        </div>
        <div className="bgp__comparison-divider">
          <div className="bgp__comparison-divider-line" />
          <div className="bgp__comparison-divider-badge"><ArrowRight size={16} /></div>
          <div className="bgp__comparison-divider-line" />
        </div>
        <div className="bgp__comparison-col">
          <div className="bgp__comparison-label bgp__comparison-label--after">
            <CheckCircle2 size={14} /> {t('brandGuardian.results.labelAfter')}
          </div>
          <div className="bgp__iframe-wrap">
            <iframe
              srcDoc={finalHtml}
              title={t('brandGuardian.results.iframeFixed')}
              sandbox="allow-same-origin"
              className="bgp__iframe"
            />
          </div>
        </div>
      </div>

      {/* Issues table */}
      <div className="bgp__table-section">
        <h3 className="bgp__table-title">{t('brandGuardian.results.tableTitle')}</h3>
        <div className="bgp__table-wrap">
          <table className="bgp__table">
            <thead>
              <tr>
                <th>{t('brandGuardian.results.tableNum')}</th>
                <th>{t('brandGuardian.results.tableType')}</th>
                <th>{t('brandGuardian.results.tableSeverity')}</th>
                <th>{t('brandGuardian.results.tableDescription')}</th>
                <th>{t('brandGuardian.results.tableLocation')}</th>
                <th>{t('brandGuardian.results.tableFix')}</th>
              </tr>
            </thead>
            <tbody>
              {allIssues.map((issue, i) => {
                const fix = allFixes.find(f => f.issue_id === issue.id);
                return (
                  <tr key={issue.id} className={`bgp__table-row bgp__table-row--${issue.severity}`}>
                    <td className="bgp__table-num">{i + 1}</td>
                    <td><TypeBadge type={issue.type} /></td>
                    <td><SeverityBadge severity={issue.severity} /></td>
                    <td className="bgp__table-desc">{issue.description}</td>
                    <td className="bgp__table-loc">{issue.location || '—'}</td>
                    <td className="bgp__table-fix">
                      {fix
                        ? <span className="bgp__fix-applied"><CheckCircle2 size={12} /> {fix.description}</span>
                        : <span className="bgp__fix-pending">{t('brandGuardian.results.tablePending')}</span>}
                    </td>
                  </tr>
                );
              })}
              {allIssues.length === 0 && (
                <tr><td colSpan="6" className="bgp__table-empty">{t('brandGuardian.results.tableEmpty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrandGuardianPage() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState('upload'); // upload | analyzing | results
  const [originalHtml, setOriginalHtml] = useState('');
  const [currentHtml, setCurrentHtml] = useState('');
  const [finalHtml, setFinalHtml] = useState('');
  const [events, setEvents] = useState([]);
  const [allIssues, setAllIssues] = useState([]);
  const [allFixes, setAllFixes] = useState([]);
  const [iteration, setIteration] = useState(0);
  const [activeAgent, setActiveAgent] = useState(null); // 'qa' | 'html' | 'content' | null
  const [lastIssueCount, setLastIssueCount] = useState(0);
  const [lastFixCount, setLastFixCount] = useState(0);
  const eventsEndRef = useRef(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const startAnalysis = useCallback(async (html, filename) => {
    setOriginalHtml(html);
    setCurrentHtml(html);
    setPhase('analyzing');
    setEvents([]);
    setAllIssues([]);
    setAllFixes([]);
    setIteration(1);
    setActiveAgent('qa');
    setLastIssueCount(0);
    setLastFixCount(0);

    try {
      const response = await fetch(`${API}/brand-guardian/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html, filename }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            setPhase('results');
            setActiveAgent(null);
            return;
          }
          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'qa_start') {
              setIteration(parsed.iteration);
              setActiveAgent('qa');
              setLastIssueCount(0);
            } else if (parsed.type === 'issues') {
              setAllIssues(prev => {
                const merged = [...prev, ...parsed.issues.filter(ni => !prev.find(pi => pi.id === ni.id))];
                return merged;
              });
              setLastIssueCount(parsed.issues.length);
              if (parsed.approved) {
                setActiveAgent(null);
              }
            } else if (parsed.type === 'fix_start') {
              const f = parsed.fixer;
              setActiveAgent(f === 'both' ? 'html' : f === 'html' ? 'html' : 'content');
              setLastFixCount(0);
            } else if (parsed.type === 'fix_done') {
              // HTML is updated server-side; final version comes with 'approved'
              setAllFixes(prev => [...prev, ...parsed.fixes]);
              setLastFixCount(parsed.fixes.length);
              setActiveAgent('qa');
            } else if (parsed.type === 'approved') {
              setFinalHtml(parsed.final_html || currentHtml);
              setAllIssues(parsed.all_issues || []);
              setAllFixes(parsed.all_fixes || []);
            }

            if (['issues', 'fix_done'].includes(parsed.type)) {
              setEvents(prev => [...prev, parsed]);
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      console.error('[brand-guardian]', err);
      setPhase('upload');
    }
  }, []);

  const reset = () => {
    setPhase('upload');
    setOriginalHtml('');
    setCurrentHtml('');
    setFinalHtml('');
    setEvents([]);
    setAllIssues([]);
    setAllFixes([]);
    setIteration(0);
    setActiveAgent(null);
  };

  const qaState = activeAgent === 'qa' ? 'active' : allIssues.length > 0 || phase === 'results' ? 'done' : 'idle';
  const fixerLabel = activeAgent === 'content'
    ? t('brandGuardian.pipeline.contentFixer')
    : activeAgent === 'html'
    ? t('brandGuardian.pipeline.htmlContentFixer')
    : t('brandGuardian.pipeline.fixerLabel');
  const fixerState = activeAgent === 'html' || activeAgent === 'content'
    ? 'active'
    : allFixes.length > 0 || phase === 'results'
    ? 'done'
    : 'idle';

  return (
    <div className="bgp">
      {/* ── Hero ────────────────────────────────────────────── */}
      <header className="bgp__hero">
        <div className="bgp__hero-grid" />
        <div className="bgp__hero-content">
          <div className="bgp__hero-eyebrow">
            <ShieldCheck size={14} />
            <span>{t('brandGuardian.hero.eyebrow')}</span>
          </div>
          <h1 className="bgp__hero-title">
            {t('brandGuardian.hero.titleLine1')}<br />
            <span className="bgp__hero-accent">{t('brandGuardian.hero.titleAccent')}</span>
          </h1>
          <p className="bgp__hero-subtitle">
            {t('brandGuardian.hero.subtitle')}
          </p>
          <div className="bgp__hero-pills">
            <span className="bgp__pill"><CheckCircle2 size={12} /> {t('brandGuardian.hero.pillGuidelines')}</span>
            <span className="bgp__pill"><Zap size={12} /> {t('brandGuardian.hero.pillAutoFix')}</span>
            <span className="bgp__pill"><Info size={12} /> {t('brandGuardian.hero.pillCompare')}</span>
          </div>
        </div>
      </header>

      <div className="bgp__body">
        {/* ── Upload ────────────────────────────────────────── */}
        {phase === 'upload' && (
          <UploadZone onFile={startAnalysis} />
        )}

        {/* ── Analyzing: pipeline + timeline ─────────────── */}
        {(phase === 'analyzing' || phase === 'results') && (
          <>
            {/* Pipeline visualizer */}
            <div className="bgp__pipeline-wrap">
              <div className="bgp__pipeline">
                <PipelineNode
                  icon={ShieldCheck}
                  label={t('brandGuardian.pipeline.qaLabel')}
                  sublabel={t('brandGuardian.pipeline.iteration').replace('{n}', iteration)}
                  state={qaState}
                  issueCount={phase === 'analyzing' && activeAgent === 'qa' ? lastIssueCount : undefined}
                />
                <PipelineArrow active={activeAgent !== null} />
                <PipelineNode
                  icon={Zap}
                  label={fixerLabel}
                  sublabel={activeAgent === 'html' || activeAgent === 'content' ? t('brandGuardian.pipeline.applyingFixes') : undefined}
                  state={fixerState}
                  fixCount={phase === 'analyzing' && (activeAgent === 'html' || activeAgent === 'content') ? lastFixCount : undefined}
                />
                <PipelineArrow active={activeAgent !== null} reverse />
                <PipelineNode
                  icon={ShieldCheck}
                  label={t('brandGuardian.pipeline.qaLabel')}
                  sublabel={t('brandGuardian.pipeline.revalidation')}
                  state={
                    phase === 'results'
                      ? 'done'
                      : iteration > 1 && activeAgent === 'qa'
                      ? 'active'
                      : 'idle'
                  }
                />
              </div>
              {phase === 'analyzing' && (
                <div className="bgp__pipeline-status">
                  <span className="bgp__status-dot" />
                  {activeAgent === 'qa' && t('brandGuardian.pipeline.statusQa').replace('{n}', iteration)}
                  {activeAgent === 'html' && t('brandGuardian.pipeline.statusHtml')}
                  {activeAgent === 'content' && t('brandGuardian.pipeline.statusContent')}
                  {!activeAgent && t('brandGuardian.pipeline.statusFinalizing')}
                </div>
              )}
              {phase === 'results' && (
                <div className="bgp__pipeline-approved">
                  <CheckCircle2 size={16} />
                  {t('brandGuardian.pipeline.approved')}
                </div>
              )}
            </div>

            {/* Iteration timeline */}
            {events.length > 0 && (
              <div className="bgp__timeline">
                <h3 className="bgp__timeline-title">{t('brandGuardian.timeline.title')}</h3>
                {events.map((ev, i) => (
                  <IterationEntry key={i} event={ev} allFixes={allFixes} />
                ))}
                <div ref={eventsEndRef} />
              </div>
            )}

            {/* Results */}
            {phase === 'results' && (
              <>
                <Results
                  originalHtml={originalHtml}
                  finalHtml={finalHtml || currentHtml}
                  allIssues={allIssues}
                  allFixes={allFixes}
                />
                <div className="bgp__reset-row">
                  <button className="bgp__btn-ghost" onClick={reset}>
                    <RotateCcw size={14} /> {t('brandGuardian.results.analyzeAnother')}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
