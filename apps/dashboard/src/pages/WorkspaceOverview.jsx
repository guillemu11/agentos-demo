import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { tools as TOOLS } from '../data/mockData.js';
import { Mail, Search, FlaskConical, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const healthColors = {
    good: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
};

export default function WorkspaceOverview() {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const healthLabels = {
        good: t('health.good'),
        warning: t('health.warning'),
        critical: t('health.critical'),
    };

    const [agents, setAgents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pipelineCounts, setPipelineCounts] = useState({});
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                const [agentsRes, deptsRes] = await Promise.all([
                    fetch(`${API_URL}/agents`),
                    fetch(`${API_URL}/departments`),
                ]);

                if (!agentsRes.ok) throw new Error(`${t('deptDetail.errorLoadingAgents')} ${agentsRes.status}`);
                if (!deptsRes.ok) throw new Error(`${t('deptDetail.errorLoadingDepts')} ${deptsRes.status}`);

                const agentsData = await agentsRes.json();
                const deptsData = await deptsRes.json();

                if (!cancelled) {
                    setAgents(agentsData);
                    setDepartments(deptsData);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        // Load pipeline counts + activity feed
        fetch(`${API_URL}/pipeline/counts`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : {}).then(d => { if (!cancelled) setPipelineCounts(d); }).catch(() => {});
        fetch(`${API_URL}/activity/recent?limit=8`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { activities: [] }).then(d => { if (!cancelled) setActivities(d.activities || []); }).catch(() => {});

        return () => {
            cancelled = true;
        };
    }, []);

    // Estadisticas globales derivadas de los datos de la API
    const globalStats = {
        totalAgents: agents.length,
        activeAgents: agents.filter((a) => a.status === 'active').length,
        totalSkills: new Set(agents.flatMap((a) => a.skills || [])).size,
        totalTools: TOOLS.filter((t) => t.status === 'connected').length,
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px' }}>{t('workspace.loading')}</div>
                    <p className="subtitle">{t('workspace.connecting')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px', color: '#ef4444' }}>{t('workspace.errorLabel')}</div>
                    <p className="subtitle" style={{ marginBottom: '16px' }}>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                        }}
                    >
                        {t('workspace.retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container animate-fade-in">
            {/* Header */}
            <header>
                <div>
                    <h1>{t('workspace.title')}</h1>
                    <p className="subtitle">{t('workspace.subtitle')}</p>
                </div>
            </header>

            {/* Global Stats */}
            <section className="workspace-stats-bar">
                <div className="stat-chip">
                    <span className="stat-chip-value">{globalStats.totalAgents}</span>
                    <span className="stat-chip-label">{t('workspace.agents')}</span>
                </div>
                <div className="stat-chip stat-chip-active">
                    <span className="stat-chip-value">{globalStats.activeAgents}</span>
                    <span className="stat-chip-label">{t('workspace.active')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{globalStats.totalSkills}</span>
                    <span className="stat-chip-label">{t('workspace.skills')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{globalStats.totalTools}</span>
                    <span className="stat-chip-label">{t('workspace.tools')}</span>
                </div>
            </section>

            {/* Active Items — Command Center */}
            {(pipelineCounts.research_active > 0 || pipelineCounts.emails_active > 0 || pipelineCounts.experiments_active > 0) && (
                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', color: 'var(--text-muted)' }}>
                        Active Items
                    </h2>
                    <div className="kb-stats-grid">
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #3b82f6' }} onClick={() => navigate('/app/research')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Search size={18} style={{ color: '#3b82f6' }} /> {pipelineCounts.research_active || 0}
                            </span>
                            <span className="kb-stat-label">Active Research</span>
                        </div>
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #10b981' }} onClick={() => navigate('/app/campaigns')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Mail size={18} style={{ color: '#10b981' }} /> {pipelineCounts.emails_active || 0}
                            </span>
                            <span className="kb-stat-label">Emails in Review</span>
                        </div>
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid #f59e0b' }} onClick={() => navigate('/app/research')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FlaskConical size={18} style={{ color: '#f59e0b' }} /> {pipelineCounts.experiments_active || 0}
                            </span>
                            <span className="kb-stat-label">Running Experiments</span>
                        </div>
                    </div>
                </section>
            )}

            {/* Activity Feed */}
            {activities.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', color: 'var(--text-muted)' }}>
                        Recent Activity
                    </h2>
                    <div className="card" style={{ padding: 16 }}>
                        {activities.map((a, i) => (
                            <div key={i} className="activity-feed-item">
                                <span className={`activity-dot ${a.type}`} />
                                <span className="activity-title">{a.title}</span>
                                <span className="activity-time">{new Date(a.timestamp).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Department Grid */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                    {t('workspace.departments')}
                </h2>
                <div className="workspace-dept-grid">
                    {departments.map((dept) => (
                        <div
                            key={dept.id}
                            className="workspace-dept-card card animate-fade-in"
                            onClick={() => navigate(`/app/workspace/${dept.id}`)}
                            style={{ '--dept-color': dept.color }}
                        >
                            <div className="dept-card-header">
                                <div className="dept-card-emoji">{dept.emoji}</div>
                                <div
                                    className="dept-health-dot"
                                    style={{ background: healthColors[dept.health] || healthColors.good }}
                                    title={healthLabels[dept.health] || t('health.unknown')}
                                ></div>
                            </div>

                            <h3 className="dept-card-name">{dept.name}</h3>
                            <p className="dept-card-desc">{dept.description}</p>

                            <div className="dept-card-stats">
                                <div className="dept-stat">
                                    <span className="dept-stat-value">{dept.agentCount ?? 0}</span>
                                    <span className="dept-stat-label">{t('workspace.agents')}</span>
                                </div>
                                <div className="dept-stat">
                                    <span className="dept-stat-value">{dept.activeCount ?? 0}</span>
                                    <span className="dept-stat-label">{t('workspace.active')}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tools Overview */}
            <section>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                    {t('workspace.connectedTools')}
                </h2>
                <div className="tools-grid">
                    {TOOLS.map((tool) => (
                        <div key={tool.id} className="card tool-card animate-fade-in" onClick={() => navigate(`/app/workspace/tool/${tool.id}`)} style={{ cursor: 'pointer' }}>
                            <div className="tool-card-header">
                                <span className="tool-icon">{tool.icon}</span>
                                <span className={`tool-status ${tool.status}`}>
                                    {tool.status === 'connected' ? '' : ''}
                                </span>
                            </div>
                            <h4 className="tool-name">{tool.name}</h4>
                            <p className="tool-desc">{tool.description}</p>
                            {tool.credits && (
                                <div className="tool-credits">
                                    <span className="tool-credits-label">{t('workspace.usage')}</span>
                                    <span className="tool-credits-value">{tool.credits}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
