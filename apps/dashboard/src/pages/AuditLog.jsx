import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { AuditTypeIcons, PageHeaderIcons } from '../components/icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const eventTypeIcons = AuditTypeIcons;

const themeMap = {
    data: 'theme-green',
    seo: 'theme-amber',
    dev: 'theme-cyan',
    content: 'theme-amber',
    sales: 'theme-rose',
    marketing: 'theme-rose',
    design: 'theme-indigo',
    product: 'theme-purple',
};

export default function AuditLog() {
    const { t } = useLanguage();

    const eventTypeLabels = {
        weekly: t('audit.eventTypeWeekly'),
        project: t('audit.eventTypeProject'),
        task: t('audit.eventTypeTask'),
        raise: t('audit.eventTypeRaise'),
        daily: t('audit.eventTypeDaily'),
        system: t('audit.eventTypeSystem'),
    };

    const [filters, setFilters] = useState({ dept: 'all', type: 'all' });
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filters.dept !== 'all') params.set('department', filters.dept);
        if (filters.type !== 'all') params.set('type', filters.type);
        const qs = params.toString() ? `?${params.toString()}` : '';

        fetch(`${API_URL}/audit-events${qs}`)
            .then((r) => {
                if (!r.ok) throw new Error(`Error cargando eventos (${r.status})`);
                return r.json();
            })
            .then((data) => {
                if (cancelled) return;
                setEvents(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [filters]);

    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '2rem' }}>{PageHeaderIcons.audit}</span>
                    <div>
                        <h1 style={{ fontSize: '1.8rem' }}>{t('audit.title')}</h1>
                        <p className="subtitle">{t('audit.subtitle')}</p>
                    </div>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="audit-filters">
                <div className="audit-filter-group">
                    <label>{t('audit.department')}</label>
                    <select
                        value={filters.dept}
                        onChange={(e) => setFilters({ ...filters, dept: e.target.value })}
                        className="audit-select"
                    >
                        <option value="all">{t('audit.allDepts')}</option>
                        <option value="data">Data</option>
                        <option value="seo">SEO</option>
                        <option value="dev">Dev</option>
                        <option value="content">Content</option>
                        <option value="sales">Sales</option>
                        <option value="marketing">Marketing</option>
                        <option value="design">Design</option>
                        <option value="product">Product</option>
                    </select>
                </div>

                <div className="audit-filter-group">
                    <label>{t('audit.eventType')}</label>
                    <select
                        value={filters.type}
                        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                        className="audit-select"
                    >
                        <option value="all">{t('audit.allTypes')}</option>
                        {Object.keys(eventTypeLabels).map((k) => (
                            <option key={k} value={k}>{eventTypeLabels[k]}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <p className="subtitle">{t('audit.loading')}</p>}

            {error && <p style={{ color: '#ef4444' }}>Error: {error}</p>}

            {/* Timeline */}
            {!loading && !error && (
                <div className="audit-timeline">
                    {events.map((event, i) => {
                        const deptKey = event.department || event.dept;
                        const deptTheme = themeMap[deptKey] || '';
                        const deptName = deptKey ? deptKey.charAt(0).toUpperCase() + deptKey.slice(1) : '';
                        const icon = eventTypeIcons[event.event_type] || eventTypeIcons[event.type] || AuditTypeIcons.default;
                        const eventType = event.event_type || event.type || 'system';
                        const date = new Date(event.date);

                        return (
                            <div key={event.id} className="audit-event animate-fade-in">
                                <div className="audit-event-time">
                                    <span className="audit-time">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="audit-date">{date.toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                                </div>

                                <div className="audit-event-icon-wrapper">
                                    <div className="audit-event-icon">{icon}</div>
                                    {i < events.length - 1 && <div className="audit-timeline-line"></div>}
                                </div>

                                <div className="card audit-event-card">
                                    <div className="audit-event-header">
                                        <div className="audit-event-info">
                                            <h3 className="audit-event-title">{event.title}</h3>
                                            <p className="audit-event-details">{event.details}</p>
                                        </div>
                                        {deptKey && (
                                            <span className={`dept-badge ${deptTheme}`} style={{ alignSelf: 'flex-start' }}>
                                                {deptName}
                                            </span>
                                        )}
                                    </div>
                                    <div className="audit-event-footer">
                                        <div className="audit-event-agent">
                                            <span>{event.agent_id || t('audit.system')}</span>
                                        </div>
                                        <span className="audit-event-type-tag">{eventTypeLabels[eventType] || eventType}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {events.length === 0 && <p className="standup-empty">{t('audit.noEvents')}</p>}
                </div>
            )}
        </div>
    );
}
