import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { PageHeaderIcons } from '../components/icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function IntelligenceHub() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('overview');

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <p className="subtitle">{t('intel.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container animate-fade-in">
                <p style={{ color: '#ef4444' }}>Error: {error}</p>
            </div>
        );
    }

    const agents = summary?.agents || { total: 0, active: 0 };
    const today = summary?.today || { eodReports: 0 };
    const totals = summary?.totals || { rawEvents: 0, auditEventsWeek: 0 };
    const todayBlockers = summary?.todayBlockers || [];

    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>{PageHeaderIcons.intelligence}</span>
                    <div>
                        <h1 style={{ fontSize: '1.8rem' }}>{t('intel.title')}</h1>
                        <p className="subtitle">{t('intel.subtitle')}</p>
                    </div>
                </div>
            </header>

            {/* Main Stats Summary */}
            <div className="intelligence-summary-grid">
                <div className="card intel-stat-card">
                    <span className="intel-stat-lbl">{t('intel.agents')}</span>
                    <div className="intel-stat-main">
                        <span className="intel-stat-val">{agents.active}/{agents.total}</span>
                        <span className="intel-stat-change pos">{t('intel.activeLabel')}</span>
                    </div>
                </div>
                <div className="card intel-stat-card">
                    <span className="intel-stat-lbl">{t('intel.eodToday')}</span>
                    <div className="intel-stat-main">
                        <span className="intel-stat-val">{today.eodReports}</span>
                    </div>
                </div>
                <div className="card intel-stat-card">
                    <span className="intel-stat-lbl">{t('intel.auditWeek')}</span>
                    <div className="intel-stat-main">
                        <span className="intel-stat-val">{totals.auditEventsWeek}</span>
                    </div>
                </div>

            </div>

            {/* Blockers */}
            {todayBlockers.length > 0 && (
                <div className="card" style={{ marginBottom: '24px', padding: '16px', borderLeft: '4px solid #ef4444' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '8px', color: '#ef4444' }}>{t('intel.todayBlockers')}</h3>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {todayBlockers.map((b, i) => (
                            <li key={i} style={{ marginBottom: '4px', fontSize: '0.9rem' }}>
                                {typeof b === 'string' ? b : JSON.stringify(b)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* View Toggle */}
            <div className="weekly-view-toggle" style={{ marginBottom: '28px' }}>
                <button className={`weekly-toggle-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>{t('intel.general')}</button>
                <button className={`weekly-toggle-btn ${activeTab === 'costs' ? 'active' : ''}`} onClick={() => setActiveTab('costs')}>{t('intel.costs')}</button>
                <button className={`weekly-toggle-btn ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>{t('intel.alerts')}</button>
            </div>

            {activeTab === 'overview' && (
                <div className="intel-overview-layout animate-fade-in">
                    <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                        <p className="subtitle" style={{ fontSize: '1rem' }}>
                            {t('intel.metricsAvailable')}
                        </p>
                        <p className="subtitle" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                            {t('intel.chartsDescription')}
                        </p>
                    </div>
                </div>
            )}

            {activeTab === 'costs' && (
                <div className="intel-costs-layout animate-fade-in">
                    <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                        <p className="subtitle" style={{ fontSize: '1rem' }}>
                            {t('intel.metricsAvailable')}
                        </p>
                        <p className="subtitle" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                            {t('intel.costsDescription')}
                        </p>
                    </div>
                </div>
            )}

            {activeTab === 'alerts' && (
                <div className="intel-alerts-layout animate-fade-in">
                    <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
                        <p className="subtitle" style={{ fontSize: '1rem' }}>
                            {t('intel.noAlerts')}
                        </p>
                        <p className="subtitle" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                            {t('intel.alertsDescription')}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
