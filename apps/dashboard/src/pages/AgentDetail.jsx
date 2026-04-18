import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getViewForAgent } from '../components/agent-views/index.js';
import { AgentAvatar } from '../components/icons.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import FormField from '../components/ui/FormField.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';

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
    const toast = useToast();

    const statusConfig = {
        active: { color: 'var(--success)', label: t('status.active'), bg: 'var(--success-soft)' },
        idle: { color: 'var(--warning)', label: t('status.idle'), bg: 'var(--warning-soft)' },
        offline: { color: 'var(--text-muted)', label: t('status.offline'), bg: 'var(--theme-graphite-soft)' },
        error: { color: 'var(--danger)', label: t('status.error'), bg: 'var(--danger-soft)' },
    };

    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState(null);
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
            toast.error(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <Button variant="ghost" onClick={() => navigate('/app/workspace')}>
                    <ArrowLeft size={16} /> {t('agentDetail.back')}
                </Button>
                <div className="empty-state">{t('agentDetail.loadingAgent')}</div>
            </div>
        );
    }

    if (error || !agent) {
        return (
            <div className="dashboard-container animate-fade-in">
                <Button variant="ghost" onClick={() => navigate('/app/workspace')}>
                    <ArrowLeft size={16} /> {t('agentDetail.back')}
                </Button>
                <p>{error || t('agentDetail.agentNotFound')}</p>
            </div>
        );
    }

    const st = statusConfig[agent.status] || statusConfig.offline;
    const theme = themeMap[agent.department] || '';

    const ViewComponent = getViewForAgent(agent.id);

    return (
        <div className={`dashboard-container animate-fade-in ${theme}${activeTab === 'chat' ? ' dashboard-container--chat-mode' : ''}`}>
            <Button variant="ghost" onClick={() => navigate(`/app/workspace/${agent.department}`)}>
                <ArrowLeft size={16} /> {t('agentDetail.backTo')} {agent.department}
            </Button>

            {/* Agent Profile Header */}
            <section
                className={`agent-profile-header${activeTab === 'chat' ? ' agent-profile-header--compact' : ''}`}
            >
                <div className="agent-profile-left">
                    <div className="agent-profile-avatar-wrapper">
                        {/* TODO: AgentAvatar uses agentId map; agent.avatar is an emoji string. Falls back to <Bot> if id not in map. */}
                        <span className="agent-profile-avatar"><AgentAvatar agentId={agent.id} size={32} /></span>
                        <span className="agent-profile-status-dot" style={{ background: st.color }}></span>
                    </div>
                    <div className="agent-profile-info">
                        <h1 style={{ marginBottom: 'var(--space-1)' }}>{agent.name}</h1>
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
                {activeTab !== 'chat' && (
                    <Button variant="primary" onClick={() => setShowModal(true)}>
                        {t('agentDetail.editProfile')}
                    </Button>
                )}
            </section>

            {/* Agent-specific view (tabs + content) */}
            <ViewComponent agent={agent} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ════════ EDIT AGENT MODAL ════════ */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={t('agentDetail.editAgentProfile')}
                size="md"
            >
                <form onSubmit={handleEditSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <FormField label={t('agentDetail.avatar')} required>
                            <input
                                value={formData.avatar}
                                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                                placeholder="Avatar"
                            />
                        </FormField>
                        <FormField label={t('agentDetail.name')} required>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </FormField>
                    </div>

                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <FormField label={t('agentDetail.role')} required>
                            <input
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            />
                        </FormField>
                    </div>

                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <FormField label={t('agentDetail.skillsComma')}>
                            <input
                                value={formData.skills}
                                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                                placeholder="Python, Scrapy, Selenium..."
                            />
                        </FormField>
                    </div>

                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <FormField label={t('agentDetail.toolsComma')}>
                            <input
                                value={formData.tools}
                                onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                                placeholder="Browser, FileSystem, MCP:GoogleMaps..."
                            />
                        </FormField>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                            {t('agentDetail.cancel')}
                        </Button>
                        <Button type="submit" variant="primary" disabled={isSubmitting} style={{ flex: 1 }}>
                            {isSubmitting ? t('agentDetail.saving') : t('agentDetail.saveChanges')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
