import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { tools as TOOLS } from '../data/mockData.js';
import { Mail, Search, FlaskConical, ChevronDown } from 'lucide-react';
import { DeptIcons, AgentAvatarIcons } from '../components/icons.jsx';
import { Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function WorkspaceOverview() {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const statusConfig = {
        active: { color: 'var(--success)', label: t('status.active'), bg: 'var(--success-soft)' },
        idle: { color: 'var(--warning)', label: t('status.idle'), bg: 'var(--warning-soft)' },
        offline: { color: 'var(--text-muted)', label: t('status.offline'), bg: 'var(--theme-graphite-soft)' },
        error: { color: 'var(--danger)', label: t('status.error'), bg: 'var(--danger-soft)' },
    };

    const [agents, setAgents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pipelineCounts, setPipelineCounts] = useState({});
    const [activities, setActivities] = useState([]);
    const [weeklyDropdownOpen, setWeeklyDropdownOpen] = useState(false);
    const [standupDropdownOpen, setStandupDropdownOpen] = useState(false);

    const weeklyRef = useRef(null);
    const standupRef = useRef(null);

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

        fetch(`${API_URL}/pipeline/counts`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : {}).then(d => { if (!cancelled) setPipelineCounts(d); }).catch(() => {});
        fetch(`${API_URL}/activity/recent?limit=8`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { activities: [] }).then(d => { if (!cancelled) setActivities(d.activities || []); }).catch(() => {});

        return () => { cancelled = true; };
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (weeklyRef.current && !weeklyRef.current.contains(e.target)) setWeeklyDropdownOpen(false);
            if (standupRef.current && !standupRef.current.contains(e.target)) setStandupDropdownOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStatusUpdate = async (e, agentId, newStatus) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${API_URL}/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error(t('deptDetail.errorUpdating'));
            setAgents(agents.map(a => a.id === agentId ? { ...a, status: newStatus } : a));
        } catch (err) {
            alert(err.message);
        }
    };

    // Derived stats
    const globalStats = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        totalSkills: new Set(agents.flatMap(a => a.skills || [])).size,
        totalTools: TOOLS.filter(t => t.status === 'connected').length,
    };

    // Group agents by department
    const agentsByDept = {};
    for (const agent of agents) {
        if (!agentsByDept[agent.department]) agentsByDept[agent.department] = [];
        agentsByDept[agent.department].push(agent);
    }

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
                    <div style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--danger)' }}>{t('workspace.errorLabel')}</div>
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
            {/* Header with global dropdown buttons */}
            <header className="workspace-header-row">
                <div>
                    <h1>{t('workspace.title')}</h1>
                    <p className="subtitle">{t('workspace.subtitle')}</p>
                </div>
                <div className="workspace-header-actions">
                    {/* Weekly Brainstorm dropdown */}
                    <div className="workspace-dropdown-wrapper" ref={weeklyRef}>
                        <button
                            className="workspace-dropdown-btn"
                            onClick={() => { setWeeklyDropdownOpen(!weeklyDropdownOpen); setStandupDropdownOpen(false); }}
                        >
                            {t('workspace.weeklyBrainstorm')}
                            <ChevronDown size={14} />
                        </button>
                        {weeklyDropdownOpen && (
                            <div className="workspace-dropdown">
                                {departments.map(dept => (
                                    <button
                                        key={dept.id}
                                        className="workspace-dropdown-item"
                                        onClick={() => { navigate(`/app/workspace/${dept.id}/weekly`); setWeeklyDropdownOpen(false); }}
                                    >
                                        <span className="workspace-dropdown-item-icon">{DeptIcons[dept.id] || dept.emoji}</span>
                                        <span>{dept.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Daily Standup dropdown */}
                    <div className="workspace-dropdown-wrapper" ref={standupRef}>
                        <button
                            className="workspace-dropdown-btn"
                            onClick={() => { setStandupDropdownOpen(!standupDropdownOpen); setWeeklyDropdownOpen(false); }}
                        >
                            {t('workspace.dailyStandup')}
                            <ChevronDown size={14} />
                        </button>
                        {standupDropdownOpen && (
                            <div className="workspace-dropdown">
                                {departments.map(dept => (
                                    <button
                                        key={dept.id}
                                        className="workspace-dropdown-item"
                                        onClick={() => { navigate(`/app/workspace/${dept.id}/daily`); setStandupDropdownOpen(false); }}
                                    >
                                        <span className="workspace-dropdown-item-icon">{DeptIcons[dept.id] || dept.emoji}</span>
                                        <span>{dept.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
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

            {/* Active Items */}
            {(pipelineCounts.research_active > 0 || pipelineCounts.emails_active > 0 || pipelineCounts.experiments_active > 0) && (
                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', color: 'var(--text-muted)' }}>
                        {t('workspace.activeItems')}
                    </h2>
                    <div className="kb-stats-grid">
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--info)' }} onClick={() => navigate('/app/research')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Search size={18} style={{ color: 'var(--info)' }} /> {pipelineCounts.research_active || 0}
                            </span>
                            <span className="kb-stat-label">{t('workspace.activeResearch')}</span>
                        </div>
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--success)' }} onClick={() => navigate('/app/campaigns')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Mail size={18} style={{ color: 'var(--success)' }} /> {pipelineCounts.emails_active || 0}
                            </span>
                            <span className="kb-stat-label">{t('workspace.emailsInReview')}</span>
                        </div>
                        <div className="kb-stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--warning)' }} onClick={() => navigate('/app/research')}>
                            <span className="kb-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FlaskConical size={18} style={{ color: 'var(--warning)' }} /> {pipelineCounts.experiments_active || 0}
                            </span>
                            <span className="kb-stat-label">{t('workspace.runningExperiments')}</span>
                        </div>
                    </div>
                </section>
            )}

            {/* Activity Feed */}
            {activities.length > 0 && (
                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', color: 'var(--text-muted)' }}>
                        {t('workspace.recentActivity')}
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

            {/* Layer Sections with Agent Cards */}
            {departments.map(dept => {
                const deptAgents = agentsByDept[dept.id] || [];
                const activeCount = deptAgents.filter(a => a.status === 'active').length;

                return (
                    <section key={dept.id} className="layer-section">
                        <div className="layer-header" style={{ '--layer-color': dept.color }}>
                            <div className="layer-header-info">
                                <span className="layer-header-icon">{DeptIcons[dept.id] || dept.emoji}</span>
                                <span className="layer-header-name">{dept.name}</span>
                                <span className="layer-header-count">{deptAgents.length} {t('workspace.agents').toLowerCase()} · {activeCount} {t('workspace.active').toLowerCase()}</span>
                            </div>
                        </div>

                        <div className="agent-cards-grid">
                            {deptAgents.map(agent => {
                                const st = statusConfig[agent.status] || statusConfig.offline;

                                return (
                                    <div
                                        key={agent.id}
                                        className="card agent-card animate-fade-in"
                                        style={{ '--layer-color': dept.color }}
                                        onClick={() => navigate(`/app/workspace/agent/${agent.id}`)}
                                    >
                                        <div className="agent-card-header">
                                            <div className="agent-avatar-wrapper">
                                                <span className="agent-avatar">{AgentAvatarIcons[agent.id] || <Bot size={18} />}</span>
                                                <span className="agent-status-dot" style={{ background: st.color }}></span>
                                            </div>
                                            <div>
                                                <h3 className="agent-name">{agent.name}</h3>
                                                <p className="agent-role">{agent.role}</p>
                                            </div>
                                        </div>

                                        {/* Hover-only status controls */}
                                        <div className="agent-card-hover-controls">
                                            {['active', 'idle', 'offline'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={(e) => handleStatusUpdate(e, agent.id, s)}
                                                    className={`agent-status-btn ${agent.status === s ? 'agent-status-btn-active' : ''}`}
                                                    style={agent.status === s ? { background: statusConfig[s].color } : {}}
                                                    title={t('workspace.setStatus').replace('{status}', s)}
                                                >
                                                    {s[0].toUpperCase()}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Skills */}
                                        <div className="agent-card-skills">
                                            {(agent.skills || []).map(skillName => (
                                                <span key={skillName} className="skill-tag">{skillName}</span>
                                            ))}
                                        </div>

                                        {/* Tools */}
                                        {agent.tools && agent.tools.length > 0 && (
                                            <div className="agent-card-skills" style={{ marginTop: '4px' }}>
                                                {agent.tools.map(tool => (
                                                    <span key={tool} className="skill-tag" style={{ opacity: 0.7 }}>{tool}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            {/* Tools Overview */}
            <section style={{ marginTop: '16px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                    {t('workspace.connectedTools')}
                </h2>
                <div className="tools-grid">
                    {TOOLS.map(tool => (
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
