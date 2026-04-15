import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { DeptIcons, AgentAvatarIcons } from '../components/icons.jsx';
import { Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const themeMap = {
    strategic: 'theme-gold',
    execution: 'theme-red',
    control: 'theme-navy',
    data: 'theme-green',
    seo: 'theme-amber',
    dev: 'theme-cyan',
    content: 'theme-amber',
    sales: 'theme-rose',
    marketing: 'theme-rose',
    design: 'theme-indigo',
    product: 'theme-purple',
};

export default function DepartmentDetail() {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();

    const statusConfig = {
        active: { color: '#10b981', label: t('status.active'), bg: '#ecfdf5' },
        idle: { color: '#f59e0b', label: t('status.idle'), bg: '#fffbeb' },
        offline: { color: '#94a3b8', label: t('status.offline'), bg: '#f1f5f9' },
        error: { color: '#ef4444', label: t('status.error'), bg: '#fef2f2' },
    };

    const [dept, setDept] = useState(null);
    const [agents, setAgents] = useState([]);
    const [latestWeekly, setLatestWeekly] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDepartment = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/departments/${deptId}`);
            if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
            const data = await res.json();

            setDept({ id: data.id, name: data.name, emoji: data.emoji, color: data.color, description: data.description });
            setAgents(data.agents || []);
            setLatestWeekly(data.latestWeekly || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartment();
    }, [deptId]);

    const handleStatusUpdate = async (e, agentId, newStatus) => {
        e.stopPropagation(); // Evitar navegar al detalle del agente
        try {
            const res = await fetch(`${API_URL}/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) throw new Error(t('deptDetail.errorUpdating'));

            // Actualización optimista local
            setAgents(agents.map(a => a.id === agentId ? { ...a, status: newStatus } : a));
        } catch (err) {
            alert(err.message);
        }
    };

    // Estadisticas computadas desde el array de agentes
    const agentCount = agents.length;
    const activeCount = agents.filter(a => a.status === 'active').length;
    const skillsCount = new Set(agents.flatMap(a => a.skills || [])).size;

    const theme = themeMap[deptId] || '';

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('deptDetail.backToWorkspace')}</button>
                <p>{t('deptDetail.loading')}</p>
            </div>
        );
    }

    if (error || !dept) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('deptDetail.backToWorkspace')}</button>
                <p>{error || t('deptDetail.notFound')}</p>
            </div>
        );
    }

    return (
        <div className={`dashboard-container animate-fade-in ${theme}`}>
            <button className="back-button" onClick={() => navigate('/app/workspace')}>
                ← {t('deptDetail.backToWorkspace')}
            </button>

            {/* Header */}
            <header style={{ marginBottom: '32px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '2.5rem', display: 'inline-flex' }}>{DeptIcons[dept.id] || dept.emoji}</span>
                        <div>
                            <h1 style={{ marginBottom: '4px' }}>{dept.name}</h1>
                            <p className="subtitle">{dept.description}</p>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                        className="weekly-btn"
                        onClick={() => navigate(`/app/workspace/${deptId}/weekly`)}
                    >
                        {t('deptDetail.weeklyBrainstorm')}
                        {latestWeekly && <span className="weekly-btn-badge">W{latestWeekly.week_number}</span>}
                    </button>
                    <button
                        className="daily-btn"
                        onClick={() => navigate(`/app/workspace/${deptId}/daily`)}
                    >
                        {t('deptDetail.dailyStandup')}
                    </button>
                </div>
            </header>

            {/* Latest Weekly Summary */}
            {latestWeekly && (
                <section
                    className="card weekly-mini-card"
                    onClick={() => navigate(`/app/workspace/${deptId}/weekly`)}
                    style={{ marginBottom: '32px', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{t('deptDetail.lastWeekly')} {latestWeekly.week_number}</h3>
                        <span className="subtitle" style={{ fontSize: '0.75rem' }}>
                            {new Date(latestWeekly.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                    </div>
                    {latestWeekly.steps_data && Object.keys(latestWeekly.steps_data).length > 0 && (
                        <p className="subtitle" style={{ fontSize: '0.8rem' }}>
                            {t('deptDetail.sessionDataAvailable')}
                        </p>
                    )}
                </section>
            )}

            {/* Department Stats */}
            <section className="workspace-stats-bar" style={{ marginBottom: '40px' }}>
                <div className="stat-chip stat-chip-active">
                    <span className="stat-chip-value">{agentCount}</span>
                    <span className="stat-chip-label">{t('workspace.agents')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{activeCount}</span>
                    <span className="stat-chip-label">{t('workspace.active')}</span>
                </div>
                <div className="stat-chip">
                    <span className="stat-chip-value">{skillsCount}</span>
                    <span className="stat-chip-label">{t('workspace.skills')}</span>
                </div>
            </section>

            {/* Agent Cards */}
            <section>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                    {t('deptDetail.departmentAgents')}
                </h2>
                <div className="agent-cards-grid">
                    {agents.map((agent) => {
                        const st = statusConfig[agent.status] || statusConfig.offline;

                        return (
                            <div
                                key={agent.id}
                                className="card agent-card animate-fade-in"
                                onClick={() => navigate(`/app/workspace/agent/${agent.id}`)}
                            >
                                {/* Agent Header */}
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

                                {/* Status Badge & Actions */}
                                <div className="agent-card-status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span
                                        className="agent-status-badge"
                                        style={{ background: st.bg, color: st.color }}
                                    >
                                        {st.label}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {['active', 'idle', 'offline'].map(s => (
                                            <button
                                                key={s}
                                                onClick={(e) => handleStatusUpdate(e, agent.id, s)}
                                                style={{
                                                    width: '24px', height: '24px', borderRadius: '4px',
                                                    border: '1px solid rgba(255,255,255,0.1)', background: agent.status === s ? statusConfig[s].color : 'transparent',
                                                    cursor: 'pointer', padding: 0, fontSize: '10px'
                                                }}
                                                title={`Set ${s}`}
                                            >
                                                {s[0].toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Skills */}
                                <div className="agent-card-skills">
                                    {(agent.skills || []).map((skillName) => (
                                        <span key={skillName} className="skill-tag">
                                            {skillName}
                                        </span>
                                    ))}
                                </div>

                                {/* Tools */}
                                {agent.tools && agent.tools.length > 0 && (
                                    <div className="agent-card-skills" style={{ marginTop: '4px' }}>
                                        {agent.tools.map((tool) => (
                                            <span key={tool} className="skill-tag" style={{ opacity: 0.7 }}>
                                                {tool}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
