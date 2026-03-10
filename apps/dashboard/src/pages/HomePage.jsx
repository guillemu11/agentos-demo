import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { FeatureIcons, StepIcons } from '../components/icons.jsx';
import WORKFLOWS from '../data/workflows.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const features = [
  { key: 'Projects', icon: FeatureIcons.projects, to: '/app/projects', tTitle: 'featureProjectsTitle', tDesc: 'featureProjectsDesc' },
  { key: 'Workspace', icon: FeatureIcons.workspace, to: '/app/workspace', tTitle: 'featureWorkspaceTitle', tDesc: 'featureWorkspaceDesc' },
  { key: 'Standup', icon: FeatureIcons.standup, to: '/app/workspace', tTitle: 'featureStandupTitle', tDesc: 'featureStandupDesc' },
  { key: 'Weekly', icon: FeatureIcons.weekly, to: '/app/workspace', tTitle: 'featureWeeklyTitle', tDesc: 'featureWeeklyDesc' },
  { key: 'PmAgent', icon: FeatureIcons.pmAgent, to: '/app/inbox', tTitle: 'featurePmAgentTitle', tDesc: 'featurePmAgentDesc' },
  { key: 'Workflows', icon: FeatureIcons.workflows, to: '/app/workflows', tTitle: 'featureWorkflowsTitle', tDesc: 'featureWorkflowsDesc' },
  { key: 'Intelligence', icon: FeatureIcons.intelligence, to: '/app/workspace/intelligence', tTitle: 'featureIntelligenceTitle', tDesc: 'featureIntelligenceDesc' },
  { key: 'Inbox', icon: FeatureIcons.inbox, to: '/app/campaigns', tTitle: 'featureInboxTitle', tDesc: 'featureInboxDesc' },
  { key: 'Audit', icon: FeatureIcons.audit, to: '/app/workspace/audit', tTitle: 'featureAuditTitle', tDesc: 'featureAuditDesc' },
];

export default function HomePage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({ agents: 0, projects: 0, workflows: WORKFLOWS.length, departments: 0 });

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/agents`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/projects`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/departments`).then(r => r.ok ? r.json() : []),
    ]).then(([agents, projects, departments]) => {
      setStats({
        agents: agents.length,
        projects: projects.length,
        workflows: WORKFLOWS.length,
        departments: departments.length,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="dashboard-container animate-fade-in">
      {/* ─── Hero ─── */}
      <header className="home-hero">
        <h1 className="home-hero-title">{t('home.heroTitle')}</h1>
        <p className="home-hero-subtitle">{t('home.heroSubtitle')}</p>
        <div className="home-hero-actions">
          <Link to="/app/projects" className="back-button save-btn">{t('home.ctaProjects')}</Link>
          <Link to="/app/workspace" className="back-button">{t('home.ctaWorkspace')}</Link>
        </div>
      </header>

      {/* ─── Stats ─── */}
      <section className="workspace-stats-bar" style={{ marginBottom: 40 }}>
        {[
          { key: 'statsAgents', value: stats.agents },
          { key: 'statsProjects', value: stats.projects },
          { key: 'statsWorkflows', value: stats.workflows },
          { key: 'statsDepartments', value: stats.departments },
        ].map((s, i) => (
          <div key={s.key} className={`stat-chip ${i === 0 ? 'stat-highlight' : ''}`}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{t(`home.${s.key}`)}</span>
          </div>
        ))}
      </section>

      {/* ─── Features ─── */}
      <section style={{ marginBottom: 48 }}>
        <h2 className="home-section-title">{t('home.featuresTitle')}</h2>
        <div className="home-features-grid">
          {features.map((f) => (
            <Link key={f.key} to={f.to} className="card home-feature-card">
              <span className="home-feature-icon">{f.icon}</span>
              <h3>{t(`home.${f.tTitle}`)}</h3>
              <p>{t(`home.${f.tDesc}`)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section style={{ marginBottom: 48 }}>
        <h2 className="home-section-title">{t('home.howItWorksTitle')}</h2>
        <div className="home-steps-grid">
          {[
            { icon: StepIcons.setup, num: 1, tTitle: 'step1Title', tDesc: 'step1Desc' },
            { icon: StepIcons.agents, num: 2, tTitle: 'step2Title', tDesc: 'step2Desc' },
            { icon: StepIcons.dashboard, num: 3, tTitle: 'step3Title', tDesc: 'step3Desc' },
          ].map((step) => (
            <div key={step.num} className="card home-step-card">
              <div className="home-step-num">{step.num}</div>
              <span className="home-step-icon">{step.icon}</span>
              <h3>{t(`home.${step.tTitle}`)}</h3>
              <p>{t(`home.${step.tDesc}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PM Agent Callout ─── */}
      <section className="card home-pm-callout">
        <div className="home-pm-callout-content">
          <span className="home-pm-callout-icon">{FeatureIcons.pmAgent}</span>
          <div>
            <h3>{t('home.pmCalloutTitle')}</h3>
            <p>{t('home.pmCalloutDesc')}</p>
          </div>
        </div>
        <Link to="/app/inbox" className="back-button save-btn">{t('home.pmCalloutCta')}</Link>
      </section>
    </div>
  );
}
