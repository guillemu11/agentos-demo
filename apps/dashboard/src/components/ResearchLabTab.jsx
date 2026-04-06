// apps/dashboard/src/components/ResearchLabTab.jsx
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { EXPERIMENTS, EXPERIMENT_LOG, CAMPAIGN_QUEUE } from '../data/autoResearchData.js';
import ExperimentCard from './ExperimentCard.jsx';
import ResearchChart from './ResearchChart.jsx';
import KnowledgeBasePanel from './KnowledgeBasePanel.jsx';

const OUTCOME_CONFIG = {
  challenger_promoted: { cls: 'promoted', label: 'C' },
  baseline_kept: { cls: 'kept', label: 'B' },
  inconclusive: { cls: 'inconclusive', label: '~' },
};

const QUEUE_STATUS_CONFIG = {
  running: { color: 'var(--wa-green)', label: '● Running' },
  collecting: { color: '#f59e0b', label: '⏳ Collecting' },
  queued: { color: 'var(--text-muted)', label: '– Queued' },
};

export default function ResearchLabTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      {/* Header stats */}
      <section className="workspace-stats-bar" style={{ marginBottom: 20 }}>
        <div className="stat-chip stat-chip-active">
          <strong style={{ color: 'var(--wa-green)' }}>{EXPERIMENTS.length}</strong>&nbsp;{t('researchLab.statRunning')}
        </div>
        <div className="stat-chip">
          <strong>127</strong>&nbsp;{t('researchLab.statIterations')}
        </div>
        <div className="stat-chip">
          <strong style={{ color: 'var(--wa-green)' }}>+34%</strong>&nbsp;{t('researchLab.statAvgLift')}
        </div>
      </section>

      <div className="research-lab-grid">

        {/* Left column */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('researchLab.activeExperiments')}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {EXPERIMENTS.map(exp => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}

          <ResearchChart />

          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('researchLab.knowledgeBase')}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <KnowledgeBasePanel />
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Experiment log */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem' }}>
              {t('researchLab.recentLog')}
            </div>
            {EXPERIMENT_LOG.map(log => {
              const cfg = OUTCOME_CONFIG[log.outcome] || OUTCOME_CONFIG.inconclusive;
              const isPos = log.delta.startsWith('+');
              return (
                <div key={log.id} style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem' }}>
                  <div className={`log-outcome-dot ${cfg.cls}`}>{cfg.label}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{log.campaignName} — Run {log.runNumber}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                      {log.outcome === 'challenger_promoted' ? 'Challenger promoted' : log.outcome === 'baseline_kept' ? 'Baseline kept' : 'Inconclusive'} · 💬 WA
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: isPos ? 'var(--wa-green)' : '#f87171' }}>{log.delta}</span>
                </div>
              );
            })}
          </div>

          {/* Campaign queue */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {t('researchLab.campaignQueue')}
              <span style={{ fontSize: '0.72rem', color: 'var(--research-purple)', cursor: 'pointer' }}>{t('researchLab.addCampaign')}</span>
            </div>
            {CAMPAIGN_QUEUE.map(item => {
              const cfg = QUEUE_STATUS_CONFIG[item.status] || QUEUE_STATUS_CONFIG.queued;
              return (
                <div
                  key={item.campaignId}
                  style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => navigate(`/app/campaigns/${item.campaignId}`)}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>💬 WhatsApp · Run #{item.runNumber}</div>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Agent insight */}
          <div className="research-insight-box">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--wa-green)', marginBottom: 8 }}>
              🧠 {t('researchLab.agentInsight')} — just now
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Run #14 challenger is trending <strong style={{ color: 'var(--text-primary)' }}>+52% above baseline</strong>. If it holds, <strong style={{ color: 'var(--text-primary)' }}>Thursday 09:30 GST + name-first copy</strong> becomes the new default for all WhatsApp expiry campaigns.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
