import React, { useState, useEffect } from 'react';
import DepartmentKanban from './components/DepartmentKanban';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { ActionIcons, SectionIcons, TaskIcons } from './components/icons.jsx';

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

  useEffect(() => {
    fetchProjects();
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

        <section className="card" style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: 'var(--primary-soft)', border: '1px solid var(--primary-trans)' }}>
          <div className="metric-item" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
            <span className="metric-label">{t('dashboard.estimatedBudget')}</span>
            {editMode ? (
              <input
                type="number"
                className="edit-input-inline"
                value={selectedProject.estimated_budget}
                onChange={e => setSelectedProject({ ...selectedProject, estimated_budget: parseFloat(e.target.value) })}
              />
            ) : (
              <span className="metric-value">{selectedProject.estimated_budget}€</span>
            )}
          </div>
          <div className="metric-item" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
            <span className="metric-label">{t('dashboard.estimatedTimeline')}</span>
            {editMode ? (
              <input
                className="edit-input-inline"
                value={selectedProject.estimated_timeline}
                onChange={e => setSelectedProject({ ...selectedProject, estimated_timeline: e.target.value })}
              />
            ) : (
              <span className="metric-value">{selectedProject.estimated_timeline}</span>
            )}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          <section className="card">
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-red)' }}>{SectionIcons.painPoints} {t('dashboard.painPoints')}</h3>
            {editMode ? (
              <textarea
                className="edit-textarea"
                placeholder={t('dashboard.painPointsPlaceholder')}
                value={Array.isArray(selectedProject.pain_points) ? selectedProject.pain_points.join('\n') : ''}
                onChange={e => setSelectedProject({ ...selectedProject, pain_points: e.target.value.split('\n') })}
              />
            ) : (
              <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                {selectedProject.pain_points?.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
          </section>

          <section className="card">
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>{SectionIcons.requirements} {t('dashboard.requirements')}</h3>
            {editMode ? (
              <textarea
                className="edit-textarea"
                placeholder={t('dashboard.requirementsPlaceholder')}
                value={Array.isArray(selectedProject.requirements) ? selectedProject.requirements.join('\n') : ''}
                onChange={e => setSelectedProject({ ...selectedProject, requirements: e.target.value.split('\n') })}
              />
            ) : (
              <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                {selectedProject.requirements?.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </section>

          <section className="card">
            <h3 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-yellow)' }}>{SectionIcons.risks} {t('dashboard.risks')}</h3>
            {editMode ? (
              <textarea
                className="edit-textarea"
                placeholder={t('dashboard.risksPlaceholder')}
                value={Array.isArray(selectedProject.risks) ? selectedProject.risks.join('\n') : ''}
                onChange={e => setSelectedProject({ ...selectedProject, risks: e.target.value.split('\n') })}
              />
            ) : (
              <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
                {selectedProject.risks?.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </section>
        </div>

        <section className="card" style={{ marginBottom: '40px', borderLeft: '4px solid var(--accent-green)' }}>
          <h2 style={{ marginBottom: '16px' }}>{SectionIcons.roadmap} {t('dashboard.roadmap')}</h2>
          <p className="subtitle" style={{ marginBottom: '20px' }}>{t('dashboard.roadmapSubtitle')}</p>
          {editMode ? (
            <textarea
              className="edit-textarea"
              placeholder={t('dashboard.roadmapPlaceholder')}
              value={Array.isArray(selectedProject.future_improvements) ? selectedProject.future_improvements.join('\n') : ''}
              onChange={e => setSelectedProject({ ...selectedProject, future_improvements: e.target.value.split('\n') })}
            />
          ) : (
            <div className="roadmap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {selectedProject.future_improvements?.map((imp, i) => (
                <div key={i} className="card" style={{ background: 'var(--primary-trans)', border: 'none', padding: '16px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>{t('dashboard.postMvpPhase')} {i + 1}</div>
                  <p style={{ fontSize: '0.9rem', margin: 0 }}>{imp}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ marginBottom: '40px', borderLeft: '4px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '16px' }}>{SectionIcons.successMetrics} {t('dashboard.successMetrics')}</h2>
          <p className="subtitle" style={{ marginBottom: '20px' }}>{t('dashboard.successMetricsSubtitle')}</p>
          {editMode ? (
            <textarea
              className="edit-textarea"
              placeholder={t('dashboard.successMetricsPlaceholder')}
              value={Array.isArray(selectedProject.success_metrics) ? selectedProject.success_metrics.join('\n') : ''}
              onChange={e => setSelectedProject({ ...selectedProject, success_metrics: e.target.value.split('\n') })}
            />
          ) : (
            <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)' }}>
              {selectedProject.success_metrics?.map((m, i) => <li key={i} style={{ marginBottom: '8px' }}>{m}</li>)}
            </ul>
          )}
        </section>

        <section className="card" style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>{t('dashboard.proposedSolution')}</h2>
          {editMode ? (
            <textarea
              className="edit-textarea"
              value={selectedProject.solution}
              onChange={e => setSelectedProject({ ...selectedProject, solution: e.target.value })}
            />
          ) : (
            <p>{selectedProject.solution}</p>
          )}
        </section>

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

        {selectedProject.phases?.map(phase => (
          <div key={phase.id} className="phase-section">
            <div className="phase-header">
              <div className="phase-number">{phase.phase_number}</div>
              <h2>{phase.name}</h2>
            </div>
            <p className="subtitle" style={{ marginBottom: '20px' }}>{phase.objective}</p>

            <div className="tasks-list">
              {phase.tasks?.map(task => (
                <div key={task.id} className="task-item" style={{ borderLeft: `4px solid ${task.type === 'Bug' ? 'var(--accent-red)' : task.type === 'Enhancement' ? 'var(--accent-green)' : 'var(--border-light)'}` }}>
                  <div className="task-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span title={task.type} style={{ fontSize: '1.1rem' }}>{task.type === 'Bug' ? TaskIcons.bug : task.type === 'Enhancement' ? TaskIcons.enhancement : TaskIcons.task}</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{task.description}</strong>
                      <span className="dept-badge" style={{
                        fontSize: '0.6rem',
                        padding: '2px 8px',
                        background: task.priority === 'Critical' ? 'var(--accent-red)' : task.priority === 'High' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-main)',
                        color: task.priority === 'Critical' ? 'white' : 'var(--text-main)',
                        fontWeight: '700'
                      }}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="task-meta">
                      <span className="task-agent">{task.agent}</span>
                      <span className="effort-pill" title={t('dashboard.effort')}>{task.effort}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
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
      )}
    </div>
  );
}

export default App;
