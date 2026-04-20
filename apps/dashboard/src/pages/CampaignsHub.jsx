import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Send,
    Layers,
    Activity,
    Flame,
    Inbox,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { CAMPAIGN_GROUPS, CAMPAIGNS } from '../data/emiratesCampaigns.js';
import { BAU_CAMPAIGN_TYPES, BAU_CATEGORIES, getAllBauCategories } from '../data/emiratesBauTypes.js';
import { BauCategoryIcons } from '../components/icons.jsx';
import WaTab from '../components/WaTab.jsx';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import HubSearch from '../components/ui/HubSearch.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const complexityColors = {
    low: 'var(--success)',
    medium: 'var(--warning)',
    high: 'var(--primary)',
    'very-high': '#7c3aed',
};

// Turn a hex like "#D71920" into an rgba with given alpha.
function hexAlpha(hex, a) {
    const h = (hex || '#000000').replace('#', '');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function CampaignsHub() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [tab, setTab] = useState('bau');
    const [expandedGroups, setExpandedGroups] = useState(
        Object.fromEntries(CAMPAIGN_GROUPS.map(g => [g.id, true]))
    );
    const [bauCategory, setBauCategory] = useState('all');
    const [query, setQuery] = useState('');

    const liveCount = CAMPAIGNS.filter(c => c.status === 'live').length;

    function toggleGroup(groupId) {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    }

    function formatSends(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return n.toString();
    }

    // ── BAU data ────────────────────────────────────────────────
    const bauCategories = getAllBauCategories();
    const bauByCategory = bauCategory === 'all'
        ? BAU_CAMPAIGN_TYPES
        : BAU_CAMPAIGN_TYPES.filter(c => c.category === bauCategory);

    const qLower = query.trim().toLowerCase();
    const filteredBau = useMemo(() => (
        qLower
            ? bauByCategory.filter(c => c.name.toLowerCase().includes(qLower))
            : bauByCategory
    ), [bauByCategory, qLower]);

    const bauGrouped = {};
    filteredBau.forEach(type => {
        if (!bauGrouped[type.category]) bauGrouped[type.category] = [];
        bauGrouped[type.category].push(type);
    });

    // ── Lifecycle data ──────────────────────────────────────────
    const filteredLifecycle = useMemo(() => (
        qLower
            ? CAMPAIGNS.filter(c => c.name.toLowerCase().includes(qLower))
            : CAMPAIGNS
    ), [qLower]);

    // ── Stats (shared hero) ─────────────────────────────────────
    const totalEntities = BAU_CAMPAIGN_TYPES.length + CAMPAIGNS.length;
    const activeCount = liveCount + BAU_CAMPAIGN_TYPES.reduce(
        (acc, ty) => acc + ty.recentCampaigns.filter(c => c.status !== 'launched').length,
        0,
    );
    const highComplexity = BAU_CAMPAIGN_TYPES.filter(
        c => c.complexity === 'high' || c.complexity === 'very-high',
    ).length;

    const isBau = tab === 'bau';
    const isLifecycle = tab === 'lifecycle';
    const isWhatsapp = tab === 'whatsapp';

    // Subtitle still reflects tab context
    const tabSubtitle = isLifecycle
        ? t('campaigns.subtitle')
        : isBau
            ? t('campaigns.bauSubtitle')
            : t('campaigns.hero.subtitle');

    return (
        <div className="dashboard-container animate-fade-in">
            <HubHero
                eyebrow={<>
                    <Send size={14} strokeWidth={2.5} />
                    <span>{t('campaigns.hero.eyebrow')}</span>
                </>}
                title={t('campaigns.title')}
                subtitle={tabSubtitle}
                actions={null}
            />

            <HubStats>
                <HubStatCard
                    icon={<Layers size={16} strokeWidth={2} />}
                    label={t('campaigns.stats.total')}
                    value={totalEntities}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<Activity size={16} strokeWidth={2} />}
                    label={t('campaigns.stats.active')}
                    value={activeCount}
                    tone="emerald"
                />
                <HubStatCard
                    icon={<Flame size={16} strokeWidth={2} />}
                    label={t('campaigns.stats.complexity')}
                    value={highComplexity}
                    tone="amber"
                />
            </HubStats>

            {/* Tab toggle */}
            <div className="weekly-view-toggle" style={{ marginBottom: 24 }}>
                <button
                    type="button"
                    className={`weekly-toggle-btn ${isBau ? 'active' : ''}`}
                    onClick={() => setTab('bau')}
                >
                    {t('campaigns.bauTab')} ({BAU_CAMPAIGN_TYPES.length})
                </button>
                <button
                    type="button"
                    className={`weekly-toggle-btn ${isLifecycle ? 'active' : ''}`}
                    onClick={() => setTab('lifecycle')}
                >
                    {t('campaigns.lifecycleTab')} ({CAMPAIGNS.length})
                </button>
                <button
                    type="button"
                    className={`weekly-toggle-btn ${isWhatsapp ? 'active' : ''}`}
                    onClick={() => setTab('whatsapp')}
                    style={isWhatsapp ? { borderColor: 'var(--wa-green)', color: 'var(--wa-green)' } : undefined}
                >
                    {t('whatsapp.tabLabel')}
                    <span className="campaigns-hub__wa-badge">{t('whatsapp.newBadge')}</span>
                </button>
            </div>

            {/* Search (hidden on WhatsApp tab) */}
            {!isWhatsapp && (
                <HubSearch
                    value={query}
                    onChange={setQuery}
                    placeholder={t('campaigns.searchPlaceholder')}
                    ariaLabel={t('campaigns.searchPlaceholder')}
                    count={isBau ? filteredBau.length : filteredLifecycle.length}
                    total={isBau ? bauByCategory.length : CAMPAIGNS.length}
                />
            )}

            {/* ─── BAU TAB ─── */}
            {isBau && (
                <>
                    {/* Category filters — demoted, quieter treatment */}
                    <div className="campaigns-hub__cat-chips">
                        <button
                            type="button"
                            className={`campaigns-hub__cat-chip ${bauCategory === 'all' ? 'is-active' : ''}`}
                            onClick={() => setBauCategory('all')}
                        >
                            {t('campaigns.bauAll')} ({BAU_CAMPAIGN_TYPES.length})
                        </button>
                        {bauCategories.map(cat => {
                            const count = BAU_CAMPAIGN_TYPES.filter(b => b.category === cat.id).length;
                            const active = bauCategory === cat.id;
                            const CatIcon = BauCategoryIcons[cat.id];
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    className={`campaigns-hub__cat-chip ${active ? 'is-active' : ''}`}
                                    onClick={() => setBauCategory(cat.id)}
                                    style={active ? { borderColor: cat.color, color: cat.color } : undefined}
                                >
                                    {CatIcon || null} {cat.name} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {filteredBau.length === 0 ? (
                        <EmptyState
                            icon={<Inbox size={28} />}
                            title={t('campaigns.empty.title')}
                            description={
                                query
                                    ? t('campaigns.noResults').replace('{query}', query)
                                    : t('campaigns.empty.description')
                            }
                        />
                    ) : (
                        Object.entries(bauGrouped).map(([catId, types]) => {
                            const cat = BAU_CATEGORIES[catId];
                            const CatIcon = BauCategoryIcons[catId];
                            return (
                                <section key={catId} style={{ marginBottom: 32 }}>
                                    <h2
                                        className="campaigns-hub__category-title"
                                        style={{ color: cat.color }}
                                    >
                                        {CatIcon || null}
                                        <span>{cat.name}</span>
                                        <span className="campaigns-hub__category-title-count">
                                            ({types.length})
                                        </span>
                                    </h2>

                                    <div className="campaigns-grid">
                                        {types.map(type => {
                                            const activeCampaigns = type.recentCampaigns.filter(c => c.status !== 'launched').length;
                                            return (
                                                <button
                                                    key={type.id}
                                                    type="button"
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

                                                    <p className="campaign-card-description">
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

                                                    <div className="campaign-card-segments">
                                                        {type.defaultSegments.slice(0, 3).map((seg, i) => (
                                                            <span
                                                                key={i}
                                                                className="campaigns-hub__segment-chip"
                                                                style={{
                                                                    background: hexAlpha(cat.color, 0.08),
                                                                    color: cat.color,
                                                                }}
                                                            >
                                                                {seg}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })
                    )}
                </>
            )}

            {/* ─── LIFECYCLE TAB ─── */}
            {isLifecycle && (
                <>
                    {filteredLifecycle.length === 0 ? (
                        <EmptyState
                            icon={<Inbox size={28} />}
                            title={t('campaigns.empty.title')}
                            description={
                                query
                                    ? t('campaigns.noResults').replace('{query}', query)
                                    : t('campaigns.empty.description')
                            }
                        />
                    ) : (
                        CAMPAIGN_GROUPS.map(group => {
                            const groupCampaigns = filteredLifecycle.filter(c => c.group === group.id);
                            if (groupCampaigns.length === 0) return null;
                            const groupLive = groupCampaigns.filter(c => c.status === 'live').length;
                            const expanded = expandedGroups[group.id];

                            return (
                                <section key={group.id}>
                                    <div
                                        className="campaigns-group-header"
                                        onClick={() => toggleGroup(group.id)}
                                    >
                                        {/* TODO: group.icon is still an emoji string in emiratesCampaigns.js — add a CampaignGroupIcons map to icons.jsx */}
                                        <span style={{ fontSize: '1.2rem' }}>{group.icon}</span>
                                        <h2 style={{ color: group.color }}>{group.name}</h2>
                                        <span className="campaign-group-count">
                                            {groupLive}/{groupCampaigns.length}
                                        </span>
                                        <span className="campaigns-hub__group-toggle">
                                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </span>
                                    </div>

                                    {expanded && (
                                        <div className="campaigns-grid">
                                            {groupCampaigns.map(campaign => (
                                                <button
                                                    key={campaign.id}
                                                    type="button"
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
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            );
                        })
                    )}
                </>
            )}

            {/* ─── WHATSAPP TAB ─── */}
            {isWhatsapp && <WaTab />}
        </div>
    );
}
