import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CAMPAIGNS, CAMPAIGN_GROUPS, INDUSTRY_BENCHMARKS } from '../data/emiratesCampaigns.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Mail, Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function CampaignDetail() {
    const { campaignId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const campaign = CAMPAIGNS.find(c => c.id === campaignId);
    const group = campaign ? CAMPAIGN_GROUPS.find(g => g.id === campaign.group) : null;

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming]);

    if (!campaign) {
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

    // Compute group average for benchmarks
    const groupCampaigns = CAMPAIGNS.filter(c => c.group === campaign.group && c.kpis.sends > 0);
    const groupAvg = {
        openRate: +(groupCampaigns.reduce((s, c) => s + c.kpis.openRate, 0) / groupCampaigns.length).toFixed(1),
        clickRate: +(groupCampaigns.reduce((s, c) => s + c.kpis.clickRate, 0) / groupCampaigns.length).toFixed(1),
        conversionRate: +(groupCampaigns.reduce((s, c) => s + c.kpis.conversionRate, 0) / groupCampaigns.length).toFixed(1),
    };

    function formatSends(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n.toString();
    }

    function benchmarkLabel(value, benchmark, key) {
        if (!value || !benchmark) return null;
        const diff = value - benchmark;
        const isAbove = diff >= 0;
        return (
            <span className={`metric-benchmark ${isAbove ? 'above' : 'below'}`}>
                {isAbove ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}% {isAbove ? t('campaigns.aboveBenchmark') : t('campaigns.belowBenchmark')}
                <br />{t('campaigns.benchmark')}: {benchmark}%
            </span>
        );
    }

    async function sendMessage() {
        const msg = input.trim();
        if (!msg) return;

        const userMsg = { role: 'user', content: msg };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);

        try {
            const res = await fetch(`${API_URL}/chat/campaign/${campaign.id}`, {
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

    const metrics = [
        { key: 'sends', value: formatSends(campaign.kpis.sends), label: t('campaigns.sends'), benchmark: null },
        { key: 'openRate', value: campaign.kpis.openRate + '%', label: t('campaigns.openRate'), benchmark: INDUSTRY_BENCHMARKS.openRate },
        { key: 'clickRate', value: campaign.kpis.clickRate + '%', label: t('campaigns.clickRate'), benchmark: INDUSTRY_BENCHMARKS.clickRate },
        { key: 'conversionRate', value: campaign.kpis.conversionRate + '%', label: t('campaigns.conversion'), benchmark: INDUSTRY_BENCHMARKS.conversionRate },
        ...(campaign.cost ? [{ key: 'aiCost', value: campaign.cost.toFixed(2) + '€', label: t('campaigns.aiCost'), benchmark: null }] : []),
    ];

    return (
        <div className="dashboard-container animate-fade-in">
            <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                ← {t('campaigns.backToCampaigns')}
            </button>

            {/* Header card */}
            <div className="card" style={{ marginTop: 16, marginBottom: 24, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{campaign.name}</h1>
                            <span className={`campaign-status-badge ${campaign.status === 'live' ? 'live' : 'not-live'}`}>
                                {campaign.status === 'live' ? t('campaigns.live') : t('campaigns.notLive')}
                            </span>
                            <span className="workflow-category-tag" style={{ background: group?.colorSoft, color: group?.color }}>
                                {group?.icon} {group?.name}
                            </span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {campaign.description}
                        </p>
                    </div>
                </div>

                <div className="campaign-info-grid">
                    <div>
                        <span className="campaign-info-label">{t('campaigns.trigger')}</span>
                        <p className="campaign-info-value">{campaign.trigger}</p>
                    </div>
                    <div>
                        <span className="campaign-info-label">{t('campaigns.audience')}</span>
                        <p className="campaign-info-value">{campaign.audience}</p>
                    </div>
                    {campaign.cost && (
                        <div>
                            <span className="campaign-info-label">{t('campaigns.aiCost')}</span>
                            <p className="campaign-info-value" style={{ color: 'var(--primary)', fontWeight: 700 }} title={t('campaigns.aiCostTooltip')}>
                                {campaign.cost.toFixed(2)}€
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics panel */}
            {campaign.kpis.sends > 0 && (
                <>
                    {/* KPI cards with benchmarks */}
                    <div className="campaign-metrics-grid">
                        {metrics.map(m => (
                            <div key={m.key} className="campaign-metric-card">
                                <span className="metric-value">{m.value}</span>
                                <span className="metric-label">{m.label}</span>
                                {m.benchmark && benchmarkLabel(campaign.kpis[m.key], m.benchmark, m.key)}
                            </div>
                        ))}
                    </div>

                    {/* Trend chart + Variants table side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: campaign.variants.length > 0 ? '1fr 1fr' : '1fr', gap: 24, marginBottom: 24 }}>
                        {/* Trend chart */}
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                {t('campaigns.trend')}
                            </h3>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={campaign.trend}>
                                    <defs>
                                        <linearGradient id={`gradient-${campaign.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={group?.color || 'var(--primary)'} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={group?.color || 'var(--primary)'} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: '0.8rem' }}
                                        labelStyle={{ color: 'var(--text-muted)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={group?.color || 'var(--primary)'}
                                        strokeWidth={2}
                                        fill={`url(#gradient-${campaign.id})`}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                            {/* Group average line */}
                            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>{t('campaigns.groupAvg')}: {groupAvg.openRate}% {t('campaigns.openRate').toLowerCase()}</span>
                            </div>
                        </div>

                        {/* Variants table */}
                        {campaign.variants.length > 0 && (
                            <div className="card" style={{ padding: 20 }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                                    {t('campaigns.variants')}
                                </h3>
                                <table className="campaign-variants-table">
                                    <thead>
                                        <tr>
                                            <th>{t('campaigns.variantName')}</th>
                                            <th>{t('campaigns.sends')}</th>
                                            <th>{t('campaigns.openRate')}</th>
                                            <th>{t('campaigns.clickRate')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaign.variants.map((v, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600 }}>{v.name}</td>
                                                <td>{formatSends(v.sends)}</td>
                                                <td>{v.openRate}%</td>
                                                <td>{v.clickRate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Chat + Agents sidebar */}
            <div className="campaign-detail-layout">
                {/* Chat panel */}
                <div className="chat-container">
                    <div className="chat-header">
                        <span className="chat-header-title">
                            {t('campaigns.campaignChat')}
                        </span>
                    </div>

                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div className="chat-empty">
                                <div className="chat-empty-icon">{group?.icon || <Mail size={20} />}</div>
                                <div className="chat-empty-text">
                                    <strong>{t('campaigns.chatEmptyTitle')}</strong><br />
                                    {t('campaigns.chatEmptyText')}
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
                            placeholder={t('campaigns.chatPlaceholder')}
                            disabled={streaming}
                        />
                        <button onClick={() => sendMessage()} disabled={streaming || !input.trim()}>
                            {t('campaigns.send')}
                        </button>
                    </div>
                </div>

                {/* Agents sidebar */}
                <div className="card campaign-agents-sidebar" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        {t('campaigns.relevantAgents')}
                    </h3>
                    {campaign.agents.map(name => (
                        <div key={name} className="agent-item">
                            <span style={{ fontSize: '1rem' }}><Bot size={16} /></span>
                            <span>{name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
