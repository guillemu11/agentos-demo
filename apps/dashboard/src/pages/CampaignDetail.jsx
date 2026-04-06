import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CAMPAIGNS, CAMPAIGN_GROUPS, INDUSTRY_BENCHMARKS } from '../data/emiratesCampaigns.js';
import { WA_CAMPAIGNS } from '../data/emiratesWhatsAppCampaigns.js';
import WaMessagesTab from '../components/WaMessagesTab.jsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Mail, Bot, BarChart3, MessageSquare, Trash2, Zap, Loader } from 'lucide-react';
import EmailProposalGenerator from '../components/EmailProposalGenerator.jsx';
import EmailProposalViewer from '../components/EmailProposalViewer.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function CampaignDetail() {
    const { campaignId } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const campaign = CAMPAIGNS.find(c => c.id === campaignId);
    const waCampaign = WA_CAMPAIGNS.find(c => c.id === campaignId);
    const isWa = Boolean(waCampaign);
    const group = campaign ? CAMPAIGN_GROUPS.find(g => g.id === campaign.group) : null;

    // Tab state
    const [activeTab, setActiveTab] = useState('overview');

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const messagesEndRef = useRef(null);

    // Email proposals state
    const [emailProposals, setEmailProposals] = useState([]);
    const [viewingProposal, setViewingProposal] = useState(null);

    // Load persistent conversation
    useEffect(() => {
        if (!campaign) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/campaigns/${campaign.id}/conversation`, { credentials: 'include' });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setMessages(Array.isArray(data.messages) ? data.messages : []);
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [campaign?.id]);

    // Load email proposals
    useEffect(() => {
        if (!campaign) return;
        loadEmailProposals();
    }, [campaign?.id]);

    async function loadEmailProposals() {
        try {
            const res = await fetch(`${API_URL}/campaigns/${campaign.id}/emails`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setEmailProposals(data.proposals || []);
            }
        } catch { /* ignore */ }
    }

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streaming]);

    if (!campaign && !waCampaign) {
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

    if (isWa) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/campaigns')}>
                    ← {t('campaigns.backToCampaigns')}
                </button>

                {/* WA Campaign header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${waCampaign.groupColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                        {waCampaign.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{waCampaign.name}</h1>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'var(--wa-green-dim)', color: 'var(--wa-green)', border: '1px solid var(--wa-green-border)' }}>
                                💬 WhatsApp
                            </span>
                            <span className="campaign-status-badge live">● {waCampaign.status}</span>
                            {waCampaign.autoResearch.active && (
                                <span className="wa-badge-research"><span className="wa-research-dot" /> AutoResearch</span>
                            )}
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {waCampaign.group} · {waCampaign.trigger}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="kb-tabs" style={{ marginTop: 16, marginBottom: 20 }}>
                    {['overview', 'messages', 'autoresearch'].map(tab => (
                        <button
                            key={tab}
                            className={`kb-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                            style={{ textTransform: 'capitalize' }}
                        >
                            {tab === 'messages' ? 'Messages' : tab === 'autoresearch' ? 'AutoResearch' : 'Overview'}
                        </button>
                    ))}
                </div>

                {/* Overview tab */}
                {activeTab === 'overview' && (
                    <div className="workspace-stats-bar" style={{ flexWrap: 'wrap' }}>
                        <div className="stat-chip stat-chip-active">
                            <strong style={{ color: 'var(--wa-green)' }}>{waCampaign.kpis.responseRate}%</strong>&nbsp;{t('whatsapp.responseRate')}
                        </div>
                        {waCampaign.kpis.ctaClickRate && (
                            <div className="stat-chip"><strong>{waCampaign.kpis.ctaClickRate}%</strong>&nbsp;{t('whatsapp.ctaClickRate')}</div>
                        )}
                        {waCampaign.kpis.conversionRate && (
                            <div className="stat-chip"><strong>{waCampaign.kpis.conversionRate}%</strong>&nbsp;{t('whatsapp.conversionRate')}</div>
                        )}
                    </div>
                )}

                {/* Messages tab */}
                {activeTab === 'messages' && <WaMessagesTab campaign={waCampaign} />}

                {/* AutoResearch tab */}
                {activeTab === 'autoresearch' && (
                    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>🔬</div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                            {waCampaign.autoResearch.active
                                ? `Run #${waCampaign.autoResearch.runNumber} active — challenger up +${waCampaign.autoResearch.lift}%`
                                : 'Not yet enrolled in AutoResearch.'}
                        </p>
                        <button className="kb-action-btn" onClick={() => navigate('/app/research')}>
                            Open Research Lab →
                        </button>
                    </div>
                )}
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
                credentials: 'include',
                body: JSON.stringify({ message: msg }),
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

            {/* Tabs */}
            <div className="kb-tabs" style={{ marginBottom: 20 }}>
                <button className={`kb-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    <BarChart3 size={14} /> {t('campaigns.overview') || 'Overview'}
                </button>
                <button className={`kb-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                    <MessageSquare size={14} /> Chat
                </button>
                <button className={`kb-tab ${activeTab === 'emails' ? 'active' : ''}`} onClick={() => setActiveTab('emails')}>
                    <Mail size={14} /> Emails {emailProposals.length > 0 && <span className="kb-namespace-tag" style={{ marginLeft: 4 }}>{emailProposals.length}</span>}
                </button>
                <button className={`kb-tab ${activeTab === 'optimize' ? 'active' : ''}`} onClick={() => setActiveTab('optimize')}>
                    <Zap size={14} /> Optimize
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && campaign.kpis.sends > 0 && (
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

            {/* Chat Tab */}
            {activeTab === 'chat' && (
                <div className="campaign-detail-layout">
                    <div className="chat-container">
                        <div className="chat-header">
                            <span className="chat-header-title">
                                {t('campaigns.campaignChat')}
                            </span>
                            {messages.length > 0 && !streaming && (
                                <button
                                    onClick={async () => {
                                        try {
                                            await fetch(`${API_URL}/campaigns/${campaign.id}/conversation`, { method: 'DELETE', credentials: 'include' });
                                            setMessages([]);
                                        } catch { /* ignore */ }
                                    }}
                                    style={{
                                        background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-light)',
                                        borderRadius: 9999, padding: '6px 16px', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer',
                                    }}
                                >
                                    {t('agentChat.clearChat')}
                                </button>
                            )}
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
            )}

            {/* Emails Tab */}
            {activeTab === 'emails' && (
                <div>
                    {/* Generator */}
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 className="kb-section-title">{t('emails.generateNew')}</h3>
                        <EmailProposalGenerator
                            campaignId={campaign.id}
                            onGenerated={() => loadEmailProposals()}
                        />
                    </div>

                    {/* Proposals grid */}
                    {emailProposals.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 className="kb-section-title">{t('emails.proposals')} ({emailProposals.length})</h3>
                            <div className="email-proposals-grid">
                                {emailProposals.map(p => (
                                    <div
                                        key={p.id}
                                        className="email-proposal-card"
                                        onClick={() => setViewingProposal(p.id)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.variant_name}</span>
                                            <span className={`kb-status-badge ${p.status}`}>{p.status}</span>
                                        </div>
                                        <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                            {p.subject_line || t('emails.noSubject')}
                                        </p>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <span className="kb-namespace-tag">{p.market}</span>
                                            <span className="kb-namespace-tag">{p.language?.toUpperCase()}</span>
                                            {p.tier && <span className="kb-namespace-tag">{p.tier}</span>}
                                        </div>
                                        <button
                                            className="kb-icon-btn"
                                            style={{ marginTop: 8 }}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await fetch(`${API_URL}/campaigns/${campaign.id}/emails/${p.id}`, { method: 'DELETE', credentials: 'include' });
                                                loadEmailProposals();
                                            }}
                                        >
                                            <Trash2 size={12} /> {t('emails.delete')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {emailProposals.length === 0 && (
                        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                            {t('emails.noProposals')}
                        </div>
                    )}

                    {/* Viewer overlay */}
                    {viewingProposal && (
                        <EmailProposalViewer
                            campaignId={campaign.id}
                            proposalId={viewingProposal}
                            proposals={emailProposals}
                            onClose={() => { setViewingProposal(null); loadEmailProposals(); }}
                        />
                    )}
                </div>
            )}

            {/* Optimize Tab */}
            {activeTab === 'optimize' && (
                <div>
                    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                        <h3 className="kb-section-title">{t('research.title')}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 16px' }}>
                            {t('research.subtitle')}
                        </p>
                        <button
                            className="kb-action-btn"
                            onClick={async () => {
                                try {
                                    const res = await fetch(`${API_URL}/campaigns/${campaign.id}/auto-improve`, {
                                        method: 'POST', credentials: 'include',
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        navigate(`/app/research/${data.sessionId}`);
                                    }
                                } catch { /* ignore */ }
                            }}
                        >
                            <Zap size={14} /> Auto-Improve This Campaign
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
