import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getBauTypeById, getBauCategoryById } from '../data/emiratesBauTypes.js';
import { agents as AGENTS } from '../data/mockData.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, Zap, Calendar, BarChart3 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const statusColors = {
    brief: '#6b7280',
    content: '#f59e0b',
    qa: '#6366f1',
    launched: '#10b981',
};

export default function BauTypeDetail() {
    const { bauTypeId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const bauType = getBauTypeById(bauTypeId);
    const category = bauType ? getBauCategoryById(bauType.category) : null;

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming]);

    if (!bauType) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                    ← {t('campaigns.backToCampaigns')}
                </button>
                <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 24 }}>
                    <p style={{ color: 'var(--text-muted)' }}>{t('campaigns.notFound')}</p>
                </div>
            </div>
        );
    }

    const assignedAgents = bauType.typicalAgents
        .map(id => AGENTS.find(a => a.id === id))
        .filter(Boolean);

    const activeCampaigns = bauType.recentCampaigns.filter(c => c.status !== 'launched');
    const completedCampaigns = bauType.recentCampaigns.filter(c => c.status === 'launched');

    // Compute avg performance from completed campaigns
    const avgOpenRate = completedCampaigns.length > 0
        ? (completedCampaigns.reduce((s, c) => s + c.openRate, 0) / completedCampaigns.length).toFixed(1)
        : '—';
    const avgCtr = completedCampaigns.length > 0
        ? (completedCampaigns.reduce((s, c) => s + c.ctr, 0) / completedCampaigns.length).toFixed(1)
        : '—';

    async function sendMessage() {
        const msg = input.trim();
        if (!msg) return;

        const userMsg = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);

        try {
            const res = await fetch(`${API_URL}/chat/campaign/bau-${bauType.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    history: messages.slice(-20),
                }),
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            fullResponse += parsed.text;
                            const captured = fullResponse;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = { role: 'assistant', content: captured };
                                return updated;
                            });
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setStreaming(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey && !streaming) {
            e.preventDefault();
            sendMessage();
        }
    }

    const tabs = [
        { id: 'overview', label: t('campaigns.bauOverview') },
        { id: 'history', label: t('campaigns.bauHistory') },
        { id: 'chat', label: t('campaigns.bauChat') },
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                ← {t('campaigns.backToCampaigns')}
            </button>

            {/* Header */}
            <div className="card" style={{ marginTop: 16, marginBottom: 24, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{bauType.name}</h1>
                            <span className="workflow-category-tag" style={{ background: `${category.color}15`, color: category.color }}>
                                {category.icon} {category.name}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {bauType.description}
                        </p>
                    </div>
                </div>

                <div className="campaign-info-grid">
                    <div>
                        <span className="campaign-info-label">{t('campaigns.bauFrequency')}</span>
                        <p className="campaign-info-value">{bauType.frequency}</p>
                    </div>
                    <div>
                        <span className="campaign-info-label">{t('campaigns.bauComplexity')}</span>
                        <p className="campaign-info-value">{bauType.complexity}</p>
                    </div>
                    <div>
                        <span className="campaign-info-label">{t('campaigns.bauAvgOpen')}</span>
                        <p className="campaign-info-value">{avgOpenRate}%</p>
                    </div>
                    <div>
                        <span className="campaign-info-label">{t('campaigns.bauAvgCtr')}</span>
                        <p className="campaign-info-value">{avgCtr}%</p>
                    </div>
                </div>
            </div>

            {/* KPI cards */}
            <div className="campaign-metrics-grid">
                <div className="campaign-metric-card">
                    <span className="metric-value">{bauType.recentCampaigns.length}</span>
                    <span className="metric-label">{t('campaigns.bauRecentCampaigns')}</span>
                </div>
                <div className="campaign-metric-card">
                    <span className="metric-value" style={{ color: '#10b981' }}>{completedCampaigns.length}</span>
                    <span className="metric-label">{t('campaigns.bauCompleted')}</span>
                </div>
                <div className="campaign-metric-card">
                    <span className="metric-value" style={{ color: '#f59e0b' }}>{activeCampaigns.length}</span>
                    <span className="metric-label">{t('campaigns.bauInProgress')}</span>
                </div>
                <div className="campaign-metric-card">
                    <span className="metric-value">{bauType.typicalAgents.length}</span>
                    <span className="metric-label">{t('campaigns.bauAgents')}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="weekly-view-toggle" style={{ marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`weekly-toggle-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── OVERVIEW TAB ─── */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Assigned Agents */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                            {t('campaigns.bauAssignedAgents')}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {assignedAgents.map(agent => (
                                <div
                                    key={agent.id}
                                    className="agent-item"
                                    onClick={() => navigate(`/app/workspace/agent/${agent.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{agent.avatar}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{agent.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{agent.role}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Segments + Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Recommended Segments */}
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                {t('campaigns.bauSegments')}
                            </h3>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {bauType.defaultSegments.map((seg, i) => (
                                    <span key={i} style={{
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        background: `${category.color}10`,
                                        color: category.color,
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        border: `1px solid ${category.color}25`,
                                    }}>
                                        {seg}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                {t('campaigns.bauActions')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button
                                    className="back-button"
                                    onClick={() => setActiveTab('chat')}
                                    style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                                >
                                    <Sparkles size={14} /> {t('campaigns.bauActionCreate')}
                                </button>
                                <button
                                    className="back-button"
                                    onClick={() => navigate('/app/workflows')}
                                    style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                                >
                                    <Zap size={14} /> {t('campaigns.bauActionWorkflow')}
                                </button>
                                <button
                                    className="back-button"
                                    onClick={() => navigate('/app/workspace/agent/calendar-agent')}
                                    style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                                >
                                    <Calendar size={14} /> {t('campaigns.bauActionCalendar')}
                                </button>
                                <button
                                    className="back-button"
                                    onClick={() => navigate('/app/workspace/agent/analytics-agent')}
                                    style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                                >
                                    <BarChart3 size={14} /> {t('campaigns.bauActionAnalytics')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Performance Trend */}
                    {bauType.performanceHistory.length > 0 && (
                        <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                {t('campaigns.bauTrend')}
                            </h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={bauType.performanceHistory}>
                                    <defs>
                                        <linearGradient id={`bau-gradient-${bauType.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={category.color} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={category.color} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: '0.8rem' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="openRate"
                                        stroke={category.color}
                                        strokeWidth={2}
                                        fill={`url(#bau-gradient-${bauType.id})`}
                                        name="Open Rate %"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* ─── HISTORY TAB ─── */}
            {activeTab === 'history' && (
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                        {t('campaigns.bauRecentCampaigns')}
                    </h3>
                    <table className="campaign-variants-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>{t('campaigns.bauCampaignName')}</th>
                                <th>{t('campaigns.bauStatus')}</th>
                                <th>{t('campaigns.bauDate')}</th>
                                <th>{t('campaigns.openRate')}</th>
                                <th>{t('campaigns.clickRate')}</th>
                                <th>{t('campaigns.bauConversions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bauType.recentCampaigns.map((c, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: `${statusColors[c.status]}15`,
                                            color: statusColors[c.status],
                                        }}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.date}</td>
                                    <td>{c.openRate > 0 ? `${c.openRate}%` : '—'}</td>
                                    <td>{c.ctr > 0 ? `${c.ctr}%` : '—'}</td>
                                    <td>{c.conversions > 0 ? c.conversions.toLocaleString() : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ─── CHAT TAB ─── */}
            {activeTab === 'chat' && (
                <div className="campaign-detail-layout" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="chat-container">
                        <div className="chat-header">
                            <span className="chat-header-title">
                                {t('campaigns.bauChatTitle')} — {bauType.name}
                            </span>
                        </div>

                        <div className="chat-messages">
                            {messages.length === 0 && (
                                <div className="chat-empty">
                                    <div className="chat-empty-icon">{category.icon}</div>
                                    <div className="chat-empty-text">
                                        <strong>{t('campaigns.bauChatEmptyTitle')}</strong><br />
                                        {t('campaigns.bauChatEmptyText')}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <div key={i} className={`chat-bubble ${msg.role}`}>
                                    {msg.content || (streaming && i === messages.length - 1 ? '' : '...')}
                                </div>
                            ))}

                            {streaming && messages[messages.length - 1]?.content === '' && (
                                <div className="chat-typing">
                                    <span className="chat-typing-dot"></span>
                                    <span className="chat-typing-dot"></span>
                                    <span className="chat-typing-dot"></span>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-row">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('campaigns.bauChatPlaceholder')}
                                disabled={streaming}
                            />
                            <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}>
                                {t('campaigns.send')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
