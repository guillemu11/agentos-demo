import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Users, FileText, ShieldAlert, BarChart3, Settings } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function IntelligenceHub() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const toast = useToast();

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(`${API_URL}/intelligence/summary`)
            .then((r) => {
                if (!r.ok) throw new Error(`Error cargando resumen (${r.status})`);
                return r.json();
            })
            .then((data) => {
                if (cancelled) return;
                setSummary(data);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message);
                toast.error(t('intel.loadError'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
        // toast/t are stable from context; reloadKey drives manual refetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]);

    const hero = (
        <HubHero
            eyebrow={<>
                <Activity size={14} strokeWidth={2.5} />
                <span>{t('intel.hero.eyebrow')}</span>
            </>}
            title={t('intel.title')}
            subtitle={t('intel.hero.subtitle')}
            actions={null}
        />
    );

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                {hero}
                <HubStats>
                    <HubStatCard
                        icon={<Skeleton width={16} height={16} radius="var(--radius-sm)" />}
                        label={<Skeleton width={110} height={12} />}
                        value={<Skeleton width={60} height={22} />}
                        tone="neutral"
                    />
                    <HubStatCard
                        icon={<Skeleton width={16} height={16} radius="var(--radius-sm)" />}
                        label={<Skeleton width={90} height={12} />}
                        value={<Skeleton width={60} height={22} />}
                        tone="neutral"
                    />
                    <HubStatCard
                        icon={<Skeleton width={16} height={16} radius="var(--radius-sm)" />}
                        label={<Skeleton width={120} height={12} />}
                        value={<Skeleton width={60} height={22} />}
                        tone="neutral"
                    />
                </HubStats>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container animate-fade-in">
                {hero}
                <EmptyState
                    icon={<ShieldAlert size={28} color="var(--danger)" />}
                    title={t('intel.loadError')}
                    description={error}
                    action={
                        <Button variant="primary" size="md" onClick={() => setReloadKey((k) => k + 1)}>
                            {t('intel.retry')}
                        </Button>
                    }
                />
            </div>
        );
    }

    const agents = summary?.agents || { total: 0, active: 0 };
    const today = summary?.today || { eodReports: 0 };
    const totals = summary?.totals || { rawEvents: 0, auditEventsWeek: 0 };
    const todayBlockers = summary?.todayBlockers || [];

    return (
        <div className="dashboard-container animate-fade-in">
            {hero}

            <HubStats>
                <HubStatCard
                    icon={<Users size={16} strokeWidth={2} />}
                    label={t('intel.stats.agentsActive')}
                    value={`${agents.active}/${agents.total}`}
                    tone="emerald"
                />
                <HubStatCard
                    icon={<FileText size={16} strokeWidth={2} />}
                    label={t('intel.stats.eodsToday')}
                    value={today.eodReports}
                    tone="neutral"
                />
                <HubStatCard
                    icon={<BarChart3 size={16} strokeWidth={2} />}
                    label={t('intel.stats.auditEventsWeek')}
                    value={totals.auditEventsWeek}
                    tone={totals.auditEventsWeek > 0 ? 'amber' : 'neutral'}
                />
            </HubStats>

            {todayBlockers.length > 0 && (
                <div
                    className="card"
                    style={{
                        marginBottom: 'var(--space-6)',
                        padding: 'var(--space-4)',
                        borderLeft: '4px solid var(--danger)',
                        background: 'var(--danger-soft)',
                    }}
                >
                    <h3
                        style={{
                            fontWeight: 700,
                            marginBottom: 'var(--space-2)',
                            color: 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                        }}
                    >
                        <ShieldAlert size={16} strokeWidth={2.5} />
                        {t('intel.todayBlockers')}
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                        {todayBlockers.map((b, i) => (
                            <li key={i} style={{ marginBottom: 'var(--space-1)', fontSize: '0.9rem' }}>
                                {typeof b === 'string' ? b : JSON.stringify(b)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <EmptyState
                icon={<BarChart3 size={32} />}
                title={t('intel.comingSoon.title')}
                description={t('intel.comingSoon.description')}
                action={
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => navigate('/app/settings')}
                    >
                        <Settings size={14} strokeWidth={2.5} style={{ marginRight: 'var(--space-1)' }} />
                        {t('intel.comingSoon.action')}
                    </Button>
                }
            />
        </div>
    );
}
