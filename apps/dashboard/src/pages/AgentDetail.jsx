import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getViewForAgent } from '../components/agent-views/index.js';

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

export default function AgentDetail() {
    const { agentId } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();

    const statusConfig = {
        active: { color: '#10b981', label: t('status.active'), bg: '#ecfdf5' },
        idle: { color: '#f59e0b', label: t('status.idle'), bg: '#fffbeb' },
        offline: { color: '#94a3b8', label: t('status.offline'), bg: '#f1f5f9' },
        error: { color: '#ef4444', label: t('status.error'), bg: '#fef2f2' },
    };

    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        avatar: '',
        skills: '',
        tools: ''
    });

    const fetchAgent = () => {
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/agents/${agentId}`)
            .then((res) => {
                if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
                return res.json();
            })
            .then((data) => {
                setAgent(data);
                setFormData({
                    name: data.name,
                    role: data.role,
                    avatar: data.avatar,
                    skills: (data.skills || []).join(', '),
                    tools: (data.tools || []).join(', ')
                });
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchAgent();
    }, [agentId]);

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const body = {
                ...formData,
                skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
                tools: formData.tools.split(',').map(t => t.trim()).filter(t => t)
            };

            const res = await fetch(`${API_URL}/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error(t('agentDetail.errorUpdating'));

            setShowModal(false);
            fetchAgent();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('agentDetail.back')}</button>
                <div className="empty-state">{t('agentDetail.loadingAgent')}</div>
            </div>
        );
    }

    if (error || !agent) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('agentDetail.back')}</button>
                <p>{error || t('agentDetail.agentNotFound')}</p>
            </div>
        );
    }

    const st = statusConfig[agent.status] || statusConfig.offline;
    const theme = themeMap[agent.department] || '';

    const ViewComponent = getViewForAgent(agent.id);

    return (
        <div className={`dashboard-container animate-fade-in ${theme}`}>
            <button className="back-button" onClick={() => navigate(`/app/workspace/${agent.department}`)}>
                ← {t('agentDetail.backTo')} {agent.department}
            </button>

            {/* Agent Profile Header */}
            <section className="agent-profile-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="agent-profile-left">
                    <div className="agent-profile-avatar-wrapper">
                        <span className="agent-profile-avatar">{agent.avatar}</span>
                        <span className="agent-profile-status-dot" style={{ background: st.color }}></span>
                    </div>
                    <div className="agent-profile-info">
                        <h1 style={{ marginBottom: '4px' }}>{agent.name}</h1>
                        <p className="agent-profile-role">{agent.role}</p>
                        <div className="agent-profile-badges">
                            <span className="dept-badge">
                                {agent.department}
                            </span>
                            <span className="agent-status-badge" style={{ background: st.bg, color: st.color }}>
                                {st.label}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    className="back-button"
                    style={{ margin: 0, background: 'var(--primary)', color: 'white' }}
                    onClick={() => setShowModal(true)}
                >
                    {t('agentDetail.editProfile')}
                </button>
            </section>

            {/* Agent-specific view (tabs + content) */}
            <ViewComponent agent={agent} />

            {/* ════════ EDIT AGENT MODAL ════════ */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)', padding: '20px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h2 style={{ marginBottom: '20px' }}>{t('agentDetail.editAgentProfile')}</h2>
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label className="edit-label">{t('agentDetail.avatar')}</label>
                                    <input
                                        className="edit-input-inline"
                                        value={formData.avatar}
                                        onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                                        placeholder="Avatar"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="edit-label">{t('agentDetail.name')}</label>
                                    <input
                                        className="edit-input-inline"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label className="edit-label">{t('agentDetail.role')}</label>
                                <input
                                    className="edit-input-inline"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label className="edit-label">{t('agentDetail.skillsComma')}</label>
                                <input
                                    className="edit-input-inline"
                                    value={formData.skills}
                                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                                    placeholder="Python, Scrapy, Selenium..."
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label className="edit-label">{t('agentDetail.toolsComma')}</label>
                                <input
                                    className="edit-input-inline"
                                    value={formData.tools}
                                    onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                                    placeholder="Browser, FileSystem, MCP:GoogleMaps..."
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="back-button" style={{ flex: 1, margin: 0 }} onClick={() => setShowModal(false)}>
                                    {t('agentDetail.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="back-button"
                                    style={{ flex: 1, margin: 0, background: 'var(--primary)', color: 'white' }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? t('agentDetail.saving') : t('agentDetail.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
