import React, { useState, useEffect } from 'react';
import DepartmentKanban from './components/DepartmentKanban';
import ProjectPipelineView from './components/ProjectPipelineView.jsx';
import WorkLogTab from './components/WorkLogTab.jsx';
import ProjectEmailsTab from './components/ProjectEmailsTab.jsx';
import { ActivePipelinesList } from './pages/WorkflowsHub.jsx';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { ActionIcons, SectionIcons, TaskIcons } from './components/icons.jsx';
import renderMarkdown from './utils/renderMarkdown.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Componentes de Bloque ───────────────────────────────────────────────────

const TextBlock = ({ content }) => (
  <div className="block-text card-sub">
    <p>{content}</p>
  </div>
);

const CalloutBlock = ({ title, content }) => (
  <div className="block-callout animate-fade-in">
    <div className="callout-title">{title}</div>
    <div className="callout-body">{content}</div>
  </div>
);

const MetricBlock = ({ items }) => (
  <div className="metric-grid">
    {items.map((m, i) => (
      <div key={i} className="metric-item">
        <span className="metric-label">{m.label}</span>
        <span className="metric-value">{m.value}</span>
      </div>
    ))}
  </div>
);

const LinkListBlock = ({ title, links }) => (
  <div className="link-list-block card-sub">
    <h3>{title}</h3>
    <div className="links-container">
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="link-item">
          {l.label} ↗
        </a>
      ))}
    </div>
  </div>
);

const BlockRenderer = ({ blocks, editMode, onMove, onDelete, onChange }) => {
  if (!blocks || !Array.isArray(blocks)) return null;
  return blocks.map((block, i) => {
    const Component = (() => {
      switch (block.type) {
        case 'text': return <TextBlock {...block} />;
        case 'callout': return <CalloutBlock {...block} />;
        case 'metric_grid': return <MetricBlock {...block} />;
        case 'link_list': return <LinkListBlock {...block} />;
        default: return null;
      }
    })();

    if (!Component) return null;

    return (
      <div key={i} className={`block-wrapper ${editMode ? 'edit-active' : ''}`}>
        {editMode && (
          <div className="block-controls">
            <button onClick={() => onMove(i, -1)} disabled={i === 0}>↑</button>
            <button onClick={() => onMove(i, 1)} disabled={i === blocks.length - 1}>↓</button>
            <button onClick={() => onDelete(i)} className="btn-danger">×</button>
          </div>
        )}
        {editMode && block.type === 'text' ? (
          <textarea
            className="edit-input-inline"
            value={block.content}
            onChange={(e) => onChange(i, { ...block, content: e.target.value })}
          />
        ) : Component}
      </div>
    );
  });
};

function App() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [projectTab, setProjectTab] = useState('details');
  const [pipelineData, setPipelineData] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { projectId } = e.detail;
      if (projectId) fetchProjectDetail(projectId);
    };
    window.addEventListener('navigate-to-pipeline', handler);
    return () => window.removeEventListener('navigate-to-pipeline', handler);
  }, []);

  // Re-sync projects when switching back to grid (kanban may have changed statuses)
  useEffect(() => {
    if (viewMode === 'grid') {
      fetchProjects();
    }
  }, [viewMode]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetail = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${id}`);
      const data = await res.json();
      setSelectedProject(data);
      setEditMode(false);
      // Fetch pipeline for read-only view in Details tab
      try {
        const pRes = await fetch(`${API_URL}/projects/${id}/pipeline`, { credentials: 'include' });
        setPipelineData(pRes.ok ? await pRes.json() : null);
      } catch { setPipelineData(null); }

      // Auto-switch to pipeline tab if project has active pipeline
      const projectListData = projects.find(p => p.id === id);
      if (projectListData?.has_active_pipeline) {
        setProjectTab('pipeline');
      } else {
        setProjectTab('details');
      }
    } catch (err) {
      console.error('Error fetching project detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${t('dashboard.newProjectName')}`, problem: t('dashboard.describeProblem'), solution: t('dashboard.describeSolution') })
      });
      const newProj = await res.json();
      setProjects([newProj, ...projects]);
      fetchProjectDetail(newProj.id);
    } catch (err) {
      alert(t('dashboard.errorCreating'));
    }
  };

  const saveProject = async () => {
    try {
      await fetch(`${API_URL}/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedProject)
      });
      setEditMode(false);
      fetchProjects();
    } catch (err) {
      alert(t('dashboard.errorSaving'));
    }
  };

  const deleteProject = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm(t('dashboard.confirmDelete'))) return;
    try {
      await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
      if (selectedProject?.id === id) setSelectedProject(null);
      fetchProjects();
    } catch (err) {
      alert(t('dashboard.errorDeleting'));
    }
  };

  const handleBlockMove = (index, direction) => {
    const newBlocks = [...selectedProject.blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(index + direction, 0, moved);
    setSelectedProject({ ...selectedProject, blocks: newBlocks });
  };

  const handleBlockDelete = (index) => {
    const newBlocks = selectedProject.blocks.filter((_, i) => i !== index);
    setSelectedProject({ ...selectedProject, blocks: newBlocks });
  };

  const handleBlockChange = (index, newData) => {
    const newBlocks = [...selectedProject.blocks];
    newBlocks[index] = newData;
    setSelectedProject({ ...selectedProject, blocks: newBlocks });
  };

  const addBlock = (type) => {
    const newBlock = { type, content: t('dashboard.newBlock'), title: t('dashboard.blockTitle'), items: [], links: [] };
    setSelectedProject({ ...selectedProject, blocks: [...(selectedProject.blocks || []), newBlock] });
  };

  const getDeptTheme = (dept) => {
    const themes = {
      'Data': 'theme-green',
      'Dev': 'theme-cyan',
      'SEO': 'theme-amber',
      'Content': 'theme-amber',
      'Marketing': 'theme-rose',
      'Sales': 'theme-rose',
      'Product': 'theme-purple',
      'Design': 'theme-indigo',
      'Wellness': 'theme-emerald',
      'Real Estate': 'theme-emerald'
    };
    return themes[dept] || 'theme-blue';
  };

  const departments = ['General', 'Data', 'SEO', 'Dev', 'Content', 'Sales', 'Marketing', 'Design', 'Product'];

  if (selectedProject) {
    const themeClass = getDeptTheme(selectedProject.department);
    return (
      <div className={`dashboard-container animate-fade-in ${themeClass}`}>
        <button className="back-button" onClick={() => setSelectedProject(null)}>
          {ActionIcons.back} {t('dashboard.backToProjects')}
        </button>

        <header>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span className="status-badge">{selectedProject.status}</span>
              {editMode ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="edit-select"
                    placeholder={t('dashboard.department')}
                    value={selectedProject.department}
                    onChange={e => setSelectedProject({ ...selectedProject, department: e.target.value })}
                    style={{ borderRadius: '8px' }}
                  />
                  <input
                    className="edit-select"
                    placeholder={t('dashboard.subArea')}
                    value={selectedProject.sub_area}
                    onChange={e => setSelectedProject({ ...selectedProject, sub_area: e.target.value })}
                    style={{ borderRadius: '8px' }}
                  />
                </div>
              ) : (
                <>
                  <span className="dept-badge">{selectedProject.department}</span>
                  <span className="dept-badge" style={{ opacity: 0.7, background: '#f1f5f9', color: '#64748b' }}>
                    {selectedProject.sub_area}
                  </span>
                </>
              )}
            </div>
            {editMode ? (
              <input
                className="edit-title"
                value={selectedProject.name}
                onChange={e => setSelectedProject({ ...selectedProject, name: e.target.value })}
              />
            ) : (
              <h1>{selectedProject.name}</h1>
            )}
            {editMode ? (
              <textarea
                className="edit-subtitle-full"
                value={selectedProject.problem}
                onChange={e => setSelectedProject({ ...selectedProject, problem: e.target.value })}
              />
            ) : (
              <p className="subtitle" style={{ marginTop: '20px' }}>{selectedProject.problem}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {editMode ? (
              <button className="back-button save-btn" onClick={saveProject}><span>{ActionIcons.save}</span> {t('dashboard.save')}</button>
            ) : (
              <button className="back-button" onClick={() => setEditMode(true)}>{ActionIcons.edit} {t('dashboard.edit')}</button>
            )}
            <button className="back-button delete-btn" onClick={() => deleteProject(selectedProject.id)}>{ActionIcons.delete} {t('dashboard.delete')}</button>
          </div>
        </header>

        {/* Pipeline tab toggle */}
        <div className="weekly-view-toggle" style={{ marginBottom: '20px' }}>
          <button className={`weekly-toggle-btn ${projectTab === 'details' ? 'active' : ''}`}
            onClick={() => setProjectTab('details')}>{t('pipeline.details')}</button>
          <button className={`weekly-toggle-btn ${projectTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setProjectTab('pipeline')}>{t('pipeline.title')}</button>
          <button className={`weekly-toggle-btn ${projectTab === 'worklog' ? 'active' : ''}`}
            onClick={() => setProjectTab('worklog')}>{t('pipeline.workLog')}</button>
          <button className={`weekly-toggle-btn ${projectTab === 'emails' ? 'active' : ''}`}
            onClick={() => setProjectTab('emails')}>{t('emailBuilder.emailsTab') || 'Emails'}</button>
        </div>

        {projectTab === 'pipeline' && (
          <ProjectPipelineView projectId={selectedProject.id} />
        )}

        {projectTab === 'worklog' && (
          <WorkLogTab projectId={selectedProject.id} />
        )}

        {projectTab === 'emails' && (
          <ProjectEmailsTab projectId={selectedProject.id} />
        )}

        {projectTab === 'details' && <>
          {/* Overview */}
          <section className="card" style={{ marginBottom: '24px', background: 'var(--bg-section)', border: '1px solid var(--border-default)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', color: 'var(--text-main)' }}>{selectedProject.name}</h3>
            
            <div className="draft-overview-grid">
              {selectedProject.objective && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('pmChat.objective')}</span>
                  <span className="draft-overview-value">{selectedProject.objective}</span>
                </div>
              )}
              {selectedProject.target_audience && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('pmChat.audience')}</span>
                  <span className="draft-overview-value">{selectedProject.target_audience}</span>
                </div>
              )}
              {selectedProject.bau_type && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('pmChat.bauType')}</span>
                  <span className="draft-overview-value">{selectedProject.bau_type}</span>
                </div>
              )}
              {selectedProject.estimated_timeline && selectedProject.estimated_timeline !== 'TBD' && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('dashboard.estimatedTimeline')}</span>
                  <span className="draft-overview-value">{selectedProject.estimated_timeline}</span>
                </div>
              )}
              {selectedProject.estimated_budget > 0 && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('dashboard.estimatedBudget')}</span>
                  <span className="draft-overview-value">{selectedProject.estimated_budget}€</span>
                </div>
              )}
              {selectedProject.markets?.length > 0 && (
                <div className="draft-overview-item">
                  <span className="draft-overview-label">{t('pmChat.markets')}</span>
                  <span className="draft-overview-value">{selectedProject.markets.join(', ')}</span>
                </div>
              )}
            </div>

            {selectedProject.problem && (
              <div style={{ marginTop: '16px' }}>
                <span className="draft-overview-label">{t('pmChat.problem')}</span>
                <p className="draft-overview-value" style={{ margin: '4px 0 0' }}>{selectedProject.problem}</p>
              </div>
            )}
            {selectedProject.solution && (
              <div style={{ marginTop: '16px' }}>
                <span className="draft-overview-label">{t('dashboard.proposedSolution')}</span>
                <p className="draft-overview-value" style={{ margin: '4px 0 0' }}>{selectedProject.solution}</p>
              </div>
            )}
          </section>

          {/* Email Spec warning badge */}
          {!editMode && (!selectedProject.email_spec?.design_notes && !(selectedProject.email_spec?.blocks?.length > 0)) && (
            <div style={{
              background: 'color-mix(in srgb, var(--accent-yellow) 15%, transparent)',
              border: '1px solid var(--accent-yellow)',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-main)'
            }}>
              {t('emailSpec.warningBadge')}
            </div>
          )}

          {/* PM Notes */}
          {selectedProject.pm_notes && (
            <section className="card" style={{ marginBottom: '24px' }}>
              <div className="draft-section-title" style={{ marginBottom: '12px' }}>
                {t('pmChat.pmNotes')}
              </div>
              <div className="draft-pm-notes">
                 <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedProject.pm_notes) }} />
              </div>
            </section>
          )}

          {/* Email Spec */}
          <section className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-blue)' }}>
              ✉ {t('emailSpec.title')}
            </h3>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('emailSpec.designNotes')}
                  </label>
                  <textarea
                    className="edit-subtitle-full"
                    rows={3}
                    placeholder={t('emailSpec.designNotesPlaceholder')}
                    value={selectedProject.email_spec?.design_notes || ''}
                    onChange={e => setSelectedProject({
                      ...selectedProject,
                      email_spec: { ...(selectedProject.email_spec || {}), design_notes: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {t('emailSpec.blocks')}
                  </label>
                  {(selectedProject.email_spec?.blocks || []).map((block, i) => (
                    <div key={i} style={{ background: 'var(--bg-section)', borderRadius: '8px', padding: '10px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <input
                        className="edit-select"
                        style={{ flex: '0 0 120px', fontSize: '0.8rem' }}
                        placeholder={t('emailSpec.blockName')}
                        value={block.name || ''}
                        onChange={e => {
                          const blocks = [...(selectedProject.email_spec?.blocks || [])];
                          blocks[i] = { ...blocks[i], name: e.target.value };
                          setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                        }}
                      />
                      <input
                        className="edit-select"
                        style={{ flex: 1, fontSize: '0.8rem' }}
                        placeholder={t('emailSpec.blockGuidance')}
                        value={block.guidance || ''}
                        onChange={e => {
                          const blocks = [...(selectedProject.email_spec?.blocks || [])];
                          blocks[i] = { ...blocks[i], guidance: e.target.value };
                          setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                        }}
                      />
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: '1.1rem', lineHeight: 1, padding: '4px' }}
                        onClick={() => {
                          const blocks = (selectedProject.email_spec?.blocks || []).filter((_, j) => j !== i);
                          setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                        }}
                        title={t('emailSpec.removeBlock')}
                      >×</button>
                    </div>
                  ))}
                  <button
                    className="back-button"
                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                    onClick={() => {
                      const blocks = [...(selectedProject.email_spec?.blocks || []), { name: '', guidance: '', variables: [] }];
                      setSelectedProject({ ...selectedProject, email_spec: { ...(selectedProject.email_spec || {}), blocks } });
                    }}
                  >{t('emailSpec.addBlock')}</button>
                </div>

                {(selectedProject.email_spec?.variable_list?.length > 0) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {t('emailSpec.variableList')} <span style={{ opacity: 0.6 }}>({t('emailSpec.variableListNote')})</span>
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedProject.email_spec.variable_list.map(v => (
                        <span key={v} style={{ background: 'var(--bg-section)', border: '1px solid var(--border-default)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {selectedProject.email_spec?.design_notes && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {selectedProject.email_spec.design_notes}
                  </p>
                )}
                {(selectedProject.email_spec?.blocks?.length > 0) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {selectedProject.email_spec.blocks.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', background: 'var(--bg-section)', padding: '8px 12px', borderRadius: '6px', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, minWidth: '90px', color: 'var(--text-main)' }}>{b.name}</span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{b.guidance}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px' }}>
                    {t('emailSpec.warningBadge')}
                  </p>
                )}
                {(selectedProject.email_spec?.variable_list?.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedProject.email_spec.variable_list.map(v => (
                      <span key={v} style={{ background: 'var(--bg-section)', border: '1px solid var(--border-default)', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>{v}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Pipeline stages from endpoint */}
          {pipelineData && pipelineData.stages && pipelineData.stages.length > 0 && (
            <section className="card" style={{ marginBottom: '24px' }}>
                <div className="draft-section-title" style={{ marginBottom: '12px' }}>
                    {t('pmChat.pipelineProposal')} ({pipelineData.stages.length} {t('pmChat.stages')})
                </div>
                <div className="draft-stages">
                    {pipelineData.stages.map((stage, idx) => (
                        <div key={idx} className="draft-stage-row">
                            <div className="draft-stage-order">{idx}</div>
                            <div className="draft-stage-body">
                                <div className="draft-stage-header">
                                    <span className="draft-stage-name">{stage.name}</span>
                                    {stage.agent_id && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-section)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            {stage.agent_avatar} {stage.agent_name || stage.agent_id}
                                        </div>
                                    )}
                                    <span className="draft-stage-dept">{stage.department}</span>
                                    {stage.gate_type === 'human_approval' && (
                                        <span className="draft-gate-tag" title={t('pmChat.gate')}>
                                            🔒 {t('pmChat.gate')}
                                        </span>
                                    )}
                                </div>
                                <div className="draft-stage-description">
                                    {stage.description}
                                </div>
                                <div className="draft-stage-meta">
                                    {stage.depends_on?.length > 0 && stage.depends_on.map(dep => (
                                        <span key={dep} className="draft-dep-tag">
                                            {t('pmChat.dependsOn')}: {pipelineData.stages[dep]?.name || dep}
                                        </span>
                                    ))}
                                    {stage.namespaces?.map(ns => (
                                        <span key={ns} className="draft-namespace-tag">{ns}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {selectedProject.risks?.length > 0 && (
            <section className="card">
              <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-yellow)' }}>{SectionIcons.risks} {t('dashboard.risks')}</h3>
              <div className="draft-risks-list">
                 {selectedProject.risks.map((r, i) => (
                    typeof r === 'object' && r !== null ? (
                        <div key={i} className="draft-risk-item">
                            <span className="draft-risk-label">{r.risk}</span>
                            <span className="draft-risk-mitigation">{r.mitigation}</span>
                        </div>
                    ) : (
                        <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-section)', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                           {r}
                        </div>
                    )
                 ))}
              </div>
            </section>
            )}

            {selectedProject.compliance_notes?.length > 0 && (
            <section className="card">
              <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-red)' }}>{t('pmChat.compliance')}</h3>
              <div className="draft-risks-list">
                  {selectedProject.compliance_notes.map((c, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-section)', borderRadius: 8 }}>
                          {c}
                      </div>
                  ))}
              </div>
            </section>
            )}

            {/* Key Metrics */}
            {selectedProject.key_metrics?.length > 0 && (
                <section className="card">
                    <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-green)' }}>{t('pmChat.metrics')}</h3>
                    <div className="draft-metrics-list">
                        {selectedProject.key_metrics.map((m, i) => (
                            <span key={i} className="draft-metric-tag">{m}</span>
                        ))}
                    </div>
                </section>
            )}

            {/* Legacy Success Metrics */}
            {selectedProject.success_metrics?.length > 0 && !selectedProject.key_metrics?.length && (
            <section className="card">
              <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-green)' }}>{SectionIcons.successMetrics} {t('dashboard.successMetrics')}</h3>
              <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                {selectedProject.success_metrics?.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </section>
            )}
          </div>

          {(selectedProject.pain_points?.length > 0 || selectedProject.requirements?.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {selectedProject.pain_points?.length > 0 && (
                <section className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-red)' }}>{SectionIcons.painPoints} {t('dashboard.painPoints')}</h3>
                <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                    {selectedProject.pain_points?.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
                </section>
            )}

            {selectedProject.requirements?.length > 0 && (
                <section className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>{SectionIcons.requirements} {t('dashboard.requirements')}</h3>
                <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                    {selectedProject.requirements?.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                </section>
            )}
            </div>
          )}

          {selectedProject.future_improvements?.length > 0 && (
          <section className="card" style={{ marginBottom: '40px', borderLeft: '4px solid var(--accent-green)' }}>
            <h2 style={{ marginBottom: '16px' }}>{SectionIcons.roadmap} {t('dashboard.roadmap')}</h2>
            <p className="subtitle" style={{ marginBottom: '20px' }}>{t('dashboard.roadmapSubtitle')}</p>
            <div className="roadmap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {selectedProject.future_improvements?.map((imp, i) => (
                <div key={i} className="card" style={{ background: 'var(--primary-trans)', border: 'none', padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>{t('dashboard.postMvpPhase')} {i + 1}</div>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>{imp}</p>
                </div>
                ))}
            </div>
          </section>
          )}

          {/* Legacy Phases Fallback (si existe pero no tenemos pipeline) */}
          {!pipelineData && selectedProject.phases?.length > 0 && (
              <div style={{ marginTop: '24px' }}>
              {selectedProject.phases.map((phase) => (
                  <div key={phase.id} className="phase-section" style={{ marginBottom: '16px' }}>
                    <div className="phase-header">
                        <div className="phase-number">{phase.phase_number}</div>
                        <h2>{phase.name}</h2>
                    </div>
                    {phase.objective && <p className="subtitle" style={{ marginBottom: '20px' }}>{phase.objective}</p>}
                  </div>
              ))}
              </div>
          )}

          {/* Contenido dinámico (Notion-style Blocks) */}
          <div className="dynamic-blocks" style={{ marginBottom: '40px' }}>
            <BlockRenderer
              blocks={selectedProject.blocks}
              editMode={editMode}
              onMove={handleBlockMove}
              onDelete={handleBlockDelete}
              onChange={handleBlockChange}
            />
            {editMode && (
              <div className="add-block-controls">
                <button onClick={() => addBlock('text')}>{t('dashboard.addText')}</button>
                <button onClick={() => addBlock('callout')}>{t('dashboard.addCallout')}</button>
                <button onClick={() => addBlock('metric_grid')}>{t('dashboard.addMetrics')}</button>
                <button onClick={() => addBlock('link_list')}>{t('dashboard.addLinks')}</button>
              </div>
            )}
          </div>
          </>}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p className="subtitle">{t('dashboard.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="weekly-view-toggle">
            <button
              className={`weekly-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              {t('dashboard.cards')}
            </button>
            <button
              className={`weekly-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              {t('dashboard.kanban')}
            </button>
          </div>
          <button className="back-button" onClick={createProject}>{ActionIcons.add} {t('dashboard.newProject')}</button>
          {!loading && <button className="back-button" onClick={fetchProjects}>{ActionIcons.refresh} {t('dashboard.refresh')}</button>}
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>{t('dashboard.loading')}</div>
      ) : viewMode === 'kanban' ? (
        <DepartmentKanban
          departments={[...new Set(projects.map(p => p.department))].sort()}
          getDeptTheme={getDeptTheme}
        />
      ) : (
        <>
        <div className="active-pipelines-widget">
            <h3>{t('pipeline.activePipelines')}</h3>
            <ActivePipelinesList onSelectPipeline={(projectId) => fetchProjectDetail(projectId)} />
        </div>
        <div className="departments-container">
          {[...new Set(projects.map(p => p.department))].sort().map(dept => {
            const deptProjects = projects.filter(p => p.department === dept);
            const themeClass = getDeptTheme(dept);

            return (
              <section key={dept} className={`dept-section ${themeClass}`}>
                <h2 className="dept-title">{dept} <span>({deptProjects.length})</span></h2>
                <div className="projects-grid">
                  {deptProjects.map(project => (
                    <div
                      key={project.id}
                      className="card project-card animate-fade-in"
                      onClick={() => fetchProjectDetail(project.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span className="status-badge" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>{project.status}</span>
                          <span className="dept-badge" style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'var(--primary-trans)', color: 'var(--primary)' }}>{project.sub_area}</span>
                          {project.has_active_pipeline && (
                            <span className="pipeline-active-badge" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                              {t('pipeline.activePipelineBadge')}
                              {project.pipeline_progress && (
                                <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                                  {project.pipeline_progress.completed}/{project.pipeline_progress.total}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <button className="btn-icon-danger" onClick={(e) => deleteProject(project.id, e)} title={t('dashboard.delete')}>{ActionIcons.delete}</button>
                      </div>
                      <h2 className="project-title" style={{ fontSize: '1.1rem' }}>{project.name}</h2>
                      <p className="subtitle" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {project.problem}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {projects.length === 0 && (
            <div className="card" style={{ textAlign: 'center', opacity: 0.5 }}>
              <p>{t('dashboard.noProjects')}</p>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

export default App;
