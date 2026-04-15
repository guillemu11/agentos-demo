import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { HomeIcons } from '../components/icons.jsx';

const PROBLEMS = [
  { key: 1, icon: HomeIcons.speed },
  { key: 2, icon: HomeIcons.visibility },
  { key: 3, icon: HomeIcons.dependency },
  { key: 4, icon: HomeIcons.blindDecisions },
  { key: 5, icon: HomeIcons.coordination },
];

const STRATEGY_AGENTS = ['orgAgentCampaign', 'orgAgentCrm', 'orgAgentAnalytics', 'orgAgentCompetitive'];
const EXECUTION_AGENTS = ['orgAgentContent', 'orgAgentHtml', 'orgAgentSegmentation', 'orgAgentAutomation'];
const CONTROL_AGENTS = ['orgAgentQa', 'orgAgentBrand', 'orgAgentLegal', 'orgAgentDoc'];

const STAGES = [
  { key: 1, icon: HomeIcons.copilot, color: 'var(--info, #74b9ff)' },
  { key: 2, icon: HomeIcons.automation, color: 'var(--primary)' },
  { key: 3, icon: HomeIcons.agentic, color: 'var(--success, #00b894)' },
];

const WORKFLOWS = [
  { key: 1, icon: HomeIcons.campaignCreation },
  { key: 2, icon: HomeIcons.abTesting },
  { key: 3, icon: HomeIcons.autoResearch },
  { key: 4, icon: HomeIcons.qaPrograms },
  { key: 5, icon: HomeIcons.documentation },
  { key: 6, icon: HomeIcons.technicalAnalysis },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="dashboard-container animate-fade-in">
      {/* ─── Hero ─── */}
      <header className="home-hero">
        <h1 className="home-hero-title">{t('home.heroTitle')}</h1>
        <p className="home-hero-subtitle">{t('home.heroSubtitle')}</p>
        <div className="home-hero-actions">
          <Link to="/app/projects" className="home-btn home-btn-primary">{t('home.ctaDemo')}</Link>
          <Link to="/app/inbox" className="home-btn home-btn-outline">{t('home.ctaPmAgent')}</Link>
        </div>
      </header>

      {/* ─── Problems ─── */}
      <section className="home-section">
        <h2 className="home-section-title">{t('home.problemsTitle')}</h2>
        <div className="home-problems-grid">
          {PROBLEMS.map((p) => (
            <div key={p.key} className={`home-problem-card${p.key === 5 ? ' home-problem-centered' : ''}`}>
              <span className="home-problem-icon">{p.icon}</span>
              <div>
                <h3>{t(`home.problem${p.key}Title`)}</h3>
                <p>{t(`home.problem${p.key}Desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Solution + Org Chart ─── */}
      <section className="home-section">
        <h2 className="home-section-title">{t('home.solutionTitle')}</h2>
        <p className="home-section-subtitle">{t('home.solutionSubtitle')}</p>

        <div className="home-org-chart">
          {/* Top row: PM Agent ━━ Knowledge Base */}
          <div className="home-org-top">
            <div className="home-org-node home-org-node-pm">
              <span className="home-org-node-icon">{HomeIcons.pmAgent}</span>
              <div>
                <strong>{t('home.orgPmAgent')}</strong>
                <span className="home-org-node-role">{t('home.orgPmRole')}</span>
              </div>
            </div>
            <div className="home-org-line" />
            <div className="home-org-node home-org-node-kb">
              <span className="home-org-node-icon">{HomeIcons.knowledgeBase}</span>
              <div>
                <strong>{t('home.orgKb')}</strong>
                <span className="home-org-node-role">{t('home.orgKbRole')}</span>
              </div>
            </div>
          </div>

          {/* Connector */}
          <div className="home-org-connector">
            <div className="home-org-vline" />
            <div className="home-org-hline" />
          </div>

          {/* Agent layers */}
          <div className="home-org-layers">
            <div className="home-org-layer">
              <span className="home-org-layer-label home-org-label-strategy">{t('home.orgStrategy')}</span>
              {STRATEGY_AGENTS.map((a) => (
                <div key={a} className="home-org-agent">{t(`home.${a}`)}</div>
              ))}
            </div>
            <div className="home-org-layer">
              <span className="home-org-layer-label home-org-label-execution">{t('home.orgExecution')}</span>
              {EXECUTION_AGENTS.map((a) => (
                <div key={a} className="home-org-agent">{t(`home.${a}`)}</div>
              ))}
            </div>
            <div className="home-org-layer">
              <span className="home-org-layer-label home-org-label-control">{t('home.orgControl')}</span>
              {CONTROL_AGENTS.map((a) => (
                <div key={a} className="home-org-agent">{t(`home.${a}`)}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Evolution Timeline ─── */}
      <section className="home-section">
        <h2 className="home-section-title">{t('home.evolutionTitle')}</h2>
        <p className="home-section-subtitle">{t('home.evolutionSubtitle')}</p>

        <div className="home-evolution-timeline">
          {STAGES.map((s, i) => (
            <div key={s.key} className="home-evolution-stage-wrapper">
              <div className={`home-evolution-stage home-stage-${s.key}`}>
                <span className="home-evolution-label" style={{ color: s.color }}>
                  {t(`home.stage${s.key}Label`)}
                </span>
                <div className="home-evolution-title-row">
                  <span className="home-evolution-icon" style={{ color: s.color }}>{s.icon}</span>
                  <h3>{t(`home.stage${s.key}Title`)}</h3>
                </div>
                <p>{t(`home.stage${s.key}Desc`)}</p>
              </div>
              {i < STAGES.length - 1 && (
                <div className="home-evolution-arrow">→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Workflows ─── */}
      <section className="home-section">
        <h2 className="home-section-title">{t('home.workflowsTitle')}</h2>
        <p className="home-section-subtitle">{t('home.workflowsSubtitle')}</p>

        <div className="home-workflows-grid">
          {WORKFLOWS.map((wf) => (
            <div key={wf.key} className="home-workflow-card">
              <div className="home-wf-header">
                <span className="home-wf-icon">{wf.icon}</span>
                <h3>{t(`home.wf${wf.key}Title`)}</h3>
              </div>
              <div className="home-wf-before">
                {HomeIcons.before}
                <span>{t(`home.wf${wf.key}Before`)}</span>
              </div>
              <div className="home-wf-after">
                {HomeIcons.after}
                <span>{t(`home.wf${wf.key}After`)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="home-cta-final">
        <h2>{t('home.ctaFinalTitle')}</h2>
        <p>{t('home.ctaFinalSubtitle')}</p>
        <div className="home-hero-actions">
          <Link to="/app/inbox" className="home-btn home-btn-primary">{t('home.ctaStart')}</Link>
          <Link to="/app/workflows" className="home-btn home-btn-outline">{t('home.ctaViewWorkflows')}</Link>
        </div>
      </section>
    </div>
  );
}
