import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CAMPAIGN_GROUPS, CAMPAIGNS } from '../data/emiratesCampaigns.js';
import { BAU_CAMPAIGN_TYPES, BAU_CATEGORIES, getAllBauCategories } from '../data/emiratesBauTypes.js';
import WaTab from '../components/WaTab.jsx';

const complexityColors = {
    low: 'var(--success)',
    medium: 'var(--warning)',
    high: 'var(--primary)',
    'very-high': '#7c3aed',
};

export default function CampaignsHub() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [tab, setTab] = useState('bau');
    const [expandedGroups, setExpandedGroups] = useState(
        Object.fromEntries(CAMPAIGN_GROUPS.map(g => [g.id, true]))
    );
    const [bauCategory, setBauCategory] = useState('all');

    const liveCount = CAMPAIGNS.filter(c => c.status === 'live').length;
    const notLiveCount = CAMPAIGNS.length - liveCount;
    const totalAiCost = CAMPAIGNS.reduce((sum, c) => sum + (c.cost || 0), 0);

    function toggleGroup(groupId) {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    }

    function formatSends(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n.toString();
    }

    // BAU data
    const bauCategories = getAllBauCategories();
    const filteredBau = bauCategory === 'all'
        ? BAU_CAMPAIGN_TYPES
        : BAU_CAMPAIGN_TYPES.filter(c => c.category === bauCategory);
    const bauGrouped = {};
    filteredBau.forEach(type => {
        if (!bauGrouped[type.category]) bauGrouped[type.category] = [];
        bauGrouped[type.category].push(type);
    });
    const bauActiveCount = BAU_CAMPAIGN_TYPES.reduce((acc, t) =>
        acc + t.recentCampaigns.filter(c => c.status !== 'launched').length, 0);

    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
                    {t('campaigns.title')}
                </h1>
                <p className="subtitle" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                    {tab === 'lifecycle' ? t('campaigns.subtitle') : t('campaigns.bauSubtitle')}
                </p>
            </header>

            {/* Tab toggle */}
            <div className="weekly-view-toggle" style={{ marginBottom: 24 }}>
                <button
                    className={`weekly-toggle-btn ${tab === 'bau' ? 'active' : ''}`}
                    onClick={() => setTab('bau')}
                >
                    {t('campaigns.bauTab')} ({BAU_CAMPAIGN_TYPES.length})
                </button>
                <button
                    className={`weekly-toggle-btn ${tab === 'lifecycle' ? 'active' : ''}`}
                    onClick={() => setTab('lifecycle')}
                >
                    {t('campaigns.lifecycleTab')} ({CAMPAIGNS.length})
                </button>
                <button
                    className={`weekly-toggle-btn ${tab === 'whatsapp' ? 'active' : ''}`}
                    onClick={() => setTab('whatsapp')}
                    style={tab === 'whatsapp' ? { borderColor: 'var(--wa-green)', color: 'var(--wa-green)' } : {}}
                >
                    {t('whatsapp.tabLabel')}&nbsp;
                    <span style={{
                        fontSize: '0.6rem', fontWeight: 800, background: 'var(--wa-green)',
                        color: '#0b1a11', padding: '1px 5px', borderRadius: 6, verticalAlign: 'middle',
                    }}>
                        {t('whatsapp.newBadge')}
                    </span>
                </button>
            </div>

            {/* ─── BAU TAB ─── */}
            {tab === 'bau' && (
                <>
                    <section className="workspace-stats-bar" style={{ marginBottom: 20 }}>
                        <div className="stat-chip">
                            <strong>{BAU_CAMPAIGN_TYPES.length}</strong>&nbsp;{t('campaigns.bauTypes')}
                        </div>
                        <div className="stat-chip stat-chip-active">
                            <strong>{bauActiveCount}</strong>&nbsp;{t('campaigns.bauInProgress')}
                        </div>
                        <div className="stat-chip">
                            <strong>{bauCategories.length}</strong>&nbsp;{t('campaigns.bauCategories')}
                        </div>
                    </section>

                    {/* Category filters */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                        <button
                            className={`weekly-toggle-btn ${bauCategory === 'all' ? 'active' : ''}`}
                            onClick={() => setBauCategory('all')}
                            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8rem' }}
                        >
                            {t('campaigns.bauAll')} ({BAU_CAMPAIGN_TYPES.length})
                        </button>
                        {bauCategories.map(cat => {
                            const count = BAU_CAMPAIGN_TYPES.filter(b => b.category === cat.id).length;
                            return (
                                <button
                                    key={cat.id}
                                    className={`weekly-toggle-btn ${bauCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setBauCategory(cat.id)}
                                    style={{
                                        borderRadius: 20,
                                        padding: '6px 16px',
                                        fontSize: '0.8rem',
                                        borderColor: bauCategory === cat.id ? cat.color : undefined,
                                        color: bauCategory === cat.id ? cat.color : undefined,
                                    }}
                                >
                                    {cat.icon} {cat.name} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* BAU cards grouped by category */}
                    {Object.entries(bauGrouped).map(([catId, types]) => {
                        const cat = BAU_CATEGORIES[catId];
                        return (
                            <section key={catId} style={{ marginBottom: 32 }}>
                                <h2 style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: cat.color,
                                    marginBottom: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}>
                                    <span>{cat.icon}</span> {cat.name}
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                        ({types.length})
                                    </span>
                                </h2>

                                <div className="campaigns-grid">
                                    {types.map(type => {
                                        const activeCampaigns = type.recentCampaigns.filter(c => c.status !== 'launched').length;
                                        return (
                                            <div
                                                key={type.id}
                                                className="card campaign-card animate-fade-in"
                                                onClick={() => navigate(`/app/campaigns/bau/${type.id}`)}
                                                style={{ borderLeft: `4px solid ${cat.color}` }}
                                            >
                                                <div className="campaign-card-header">
                                                    <h3>{type.name}</h3>
                                                    {activeCampaigns > 0 && (
                                                        <span className="campaign-status-badge live">
                                                            {activeCampaigns} {t('campaigns.bauActiveLabel')}
                                                        </span>
                                                    )}
                                                </div>

                                                <p style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-muted)',
                                                    margin: '0 0 12px 0',
                                                    lineHeight: 1.4,
                                                }}>
                                                    {type.description}
                                                </p>

                                                <div className="campaign-kpi-row">
                                                    <span className="campaign-kpi-chip">
                                                        <span className="campaign-kpi-value">{type.frequency}</span>
                                                        <span className="campaign-kpi-label">{t('campaigns.bauFrequency')}</span>
                                                    </span>
                                                    <span className="campaign-kpi-chip">
                                                        <span className="campaign-kpi-value" style={{ color: complexityColors[type.complexity] }}>{type.complexity}</span>
                                                        <span className="campaign-kpi-label">{t('campaigns.bauComplexity')}</span>
                                                    </span>
                                                    <span className="campaign-kpi-chip">
                                                        <span className="campaign-kpi-value">{type.typicalAgents.length}</span>
                                                        <span className="campaign-kpi-label">{t('campaigns.bauAgents')}</span>
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                                                    {type.defaultSegments.slice(0, 3).map((seg, i) => (
                                                        <span key={i} style={{
                                                            fontSize: '0.6rem',
                                                            padding: '1px 6px',
                                                            borderRadius: 4,
                                                            background: `${cat.color}15`,
                                                            color: cat.color,
                                                        }}>
                                                            {seg}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </>
            )}

            {/* ─── LIFECYCLE TAB ─── */}
            {tab === 'lifecycle' && (
                <>
                    <section className="workspace-stats-bar" style={{ marginBottom: 28 }}>
                        <div className="stat-chip">
                            <strong>{CAMPAIGNS.length}</strong>&nbsp;{t('campaigns.totalCampaigns')}
                        </div>
                        <div className="stat-chip stat-chip-active">
                            <strong>{liveCount}</strong>&nbsp;{t('campaigns.activeLive')}
                        </div>
                        <div className="stat-chip">
                            <strong>{notLiveCount}</strong>&nbsp;{t('campaigns.notLiveCount')}
                        </div>
                        <div className="stat-chip">
                            <strong>{CAMPAIGN_GROUPS.length}</strong>&nbsp;{t('campaigns.groups')}
                        </div>
                        <div className="stat-chip" title={t('campaigns.aiCostTooltip')}>
                            <strong>{totalAiCost.toFixed(0)}€</strong>&nbsp;{t('campaigns.totalAiCost')}
                        </div>
                    </section>

                    {CAMPAIGN_GROUPS.map(group => {
                        const groupCampaigns = CAMPAIGNS.filter(c => c.group === group.id);
                        const groupLive = groupCampaigns.filter(c => c.status === 'live').length;

                        return (
                            <section key={group.id}>
                                <div className="campaigns-group-header" onClick={() => toggleGroup(group.id)}>
                                    <span style={{ fontSize: '1.2rem' }}>{group.icon}</span>
                                    <h2 style={{ color: group.color }}>{group.name}</h2>
                                    <span className="campaign-group-count">
                                        {groupLive}/{groupCampaigns.length}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        {expandedGroups[group.id] ? '▾' : '▸'}
                                    </span>
                                </div>

                                {expandedGroups[group.id] && (
                                    <div className="campaigns-grid">
                                        {groupCampaigns.map(campaign => (
                                            <div
                                                key={campaign.id}
                                                className="card campaign-card animate-fade-in"
                                                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
                                            >
                                                <div className="campaign-card-header">
                                                    <h3>{campaign.name}</h3>
                                                    <span className={`campaign-status-badge ${campaign.status === 'live' ? 'live' : 'not-live'}`}>
                                                        {campaign.status === 'live' ? t('campaigns.live') : t('campaigns.notLive')}
                                                    </span>
                                                </div>

                                                <div className="campaign-kpi-row">
                                                    {campaign.kpis.sends > 0 && (
                                                        <>
                                                            <span className="campaign-kpi-chip">
                                                                <span className="campaign-kpi-value">{formatSends(campaign.kpis.sends)}</span>
                                                                <span className="campaign-kpi-label">{t('campaigns.sends')}</span>
                                                            </span>
                                                            <span className="campaign-kpi-chip">
                                                                <span className="campaign-kpi-value">{campaign.kpis.openRate}%</span>
                                                                <span className="campaign-kpi-label">{t('campaigns.openRate')}</span>
                                                            </span>
                                                            <span className="campaign-kpi-chip">
                                                                <span className="campaign-kpi-value">{campaign.kpis.clickRate}%</span>
                                                                <span className="campaign-kpi-label">{t('campaigns.clickRate')}</span>
                                                            </span>
                                                        </>
                                                    )}
                                                    {campaign.cost && (
                                                        <span className="campaign-kpi-chip" title={t('campaigns.aiCostTooltip')}>
                                                            <span className="campaign-kpi-value" style={{ color: 'var(--primary)' }}>{campaign.cost.toFixed(2)}€</span>
                                                            <span className="campaign-kpi-label">{t('campaigns.aiCost')}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="workflow-agents">
                                                    {campaign.agents.slice(0, 3).map(a => (
                                                        <span key={a} className="workflow-agent-badge">{a}</span>
                                                    ))}
                                                    {campaign.agents.length > 3 && (
                                                        <span className="workflow-agent-badge">+{campaign.agents.length - 3}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </>
            )}

            {/* ─── WHATSAPP TAB ─── */}
            {tab === 'whatsapp' && <WaTab />}
        </div>
    );
}
