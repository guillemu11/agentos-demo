import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getToolById, getAgentsForTool } from '../data/mockData.js';
import { ToolIcons, AgentAvatarIcons, CapabilityIcons } from '../components/icons.jsx';
import { Bot } from 'lucide-react';

export default function ToolDetail() {
    const { toolId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const tool = getToolById(toolId);
    const agentsUsingTool = getAgentsForTool(toolId);

    if (!tool) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>
                    ← {t('toolDetail.back')}
                </button>
                <div className="empty-state">{t('toolDetail.notFound')}</div>
            </div>
        );
    }

    const statusConfig = {
        connected: { color: '#10b981', label: t('toolDetail.statusConnected'), bg: '#ecfdf5' },
        disconnected: { color: '#94a3b8', label: t('toolDetail.statusDisconnected'), bg: '#f1f5f9' },
        error: { color: '#ef4444', label: t('toolDetail.statusError'), bg: '#fef2f2' },
    };
    const st = statusConfig[tool.status] || statusConfig.disconnected;

    return (
        <div className="dashboard-container animate-fade-in">
            <button className="back-button" onClick={() => navigate('/app/workspace')}>
                ← {t('toolDetail.back')}
            </button>

            {/* Tool Profile Header */}
            <section className="tool-detail-header">
                <div className="tool-detail-left">
                    <span className="tool-detail-icon">{ToolIcons[tool.id] || tool.icon}</span>
                    <div className="tool-detail-info">
                        <h1>{tool.name}</h1>
                        <p className="tool-detail-description">{tool.description}</p>
                        <div className="tool-detail-badges">
                            {tool.version && (
                                <span className="tool-detail-version">{tool.version}</span>
                            )}
                            <span className="tool-detail-status" style={{ background: st.bg, color: st.color }}>
                                {st.label}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Capabilities Grid */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                    {t('toolDetail.capabilities')} ({(tool.capabilities || []).length})
                </h2>
                <div className="tool-capabilities-grid">
                    {(tool.capabilities || []).map((cap) => (
                        <div key={cap.id} className="card tool-capability-card animate-fade-in">
                            <span className="tool-capability-icon">{CapabilityIcons[cap.id] || cap.icon}</span>
                            <h4 className="tool-capability-name">{cap.name}</h4>
                            <p className="tool-capability-desc">{cap.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Agents Using This Tool */}
            {agentsUsingTool.length > 0 && (
                <section>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px', color: 'var(--text-muted)' }}>
                        {t('toolDetail.agentsUsing')} ({agentsUsingTool.length})
                    </h2>
                    <div className="tool-agents-grid">
                        {agentsUsingTool.map((agent) => (
                            <div
                                key={agent.id}
                                className="card tool-agent-card animate-fade-in"
                                onClick={() => navigate(`/app/workspace/agent/${agent.id}`)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="tool-agent-avatar">{AgentAvatarIcons[agent.id] || <Bot size={18} />}</span>
                                <div>
                                    <h4 className="tool-agent-name">{agent.name}</h4>
                                    <p className="tool-agent-role">{agent.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
