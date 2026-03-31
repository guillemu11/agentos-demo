import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getBauTypeById, getBauCategoryById } from '../data/emiratesBauTypes.js';
import { InboxIcons } from './icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEPARTMENTS = ['data', 'seo', 'dev', 'content', 'sales', 'marketing', 'design', 'product'];

export default function InboxPanel({ department, selectedId, onSelectItem, onDeleted, onClose, readOnly = false }) {
    const { t, lang } = useLanguage();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [quickTitle, setQuickTitle] = useState('');
    const [quickDept, setQuickDept] = useState(department || '');

    const STATUS_OPTIONS = [
        { value: 'all', label: t('inboxPanel.all') },
        { value: 'chat', label: t('inboxPanel.chat') },
        { value: 'borrador', label: t('inboxPanel.draft') },
        { value: 'proyecto', label: t('inboxPanel.project') },
        { value: 'discarded', label: t('inboxPanel.discarded') },
    ];

    const STATUS_LABELS = {
        chat: <>{InboxIcons.chat} {t('inboxPanel.statusChat')}</>,
        borrador: <>{InboxIcons.draft} {t('inboxPanel.statusDraft')}</>,
        proyecto: <>{InboxIcons.project} {t('inboxPanel.statusProject')}</>,
        discarded: <>{InboxIcons.discarded} {t('inboxPanel.statusDiscarded')}</>,
    };

    useEffect(() => {
        loadItems();
    }, [department, statusFilter]);

    async function loadItems() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (department) params.set('department', department);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`${API_URL}/inbox?${params}`);
            const data = await res.json();
            setItems(data);
        } catch { /* ignore */ }
        setLoading(false);
    }

    async function handleQuickAdd(e) {
        e.preventDefault();
        if (!quickTitle.trim()) return;
        try {
            await fetch(`${API_URL}/inbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: quickTitle.trim(), department: quickDept || null }),
            });
            setQuickTitle('');
            loadItems();
        } catch { /* ignore */ }
    }

    async function handleDelete(e, id) {
        e.stopPropagation();
        try {
            await fetch(`${API_URL}/inbox/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(item => item.id !== id));
            if (selectedId === id) onDeleted?.();
        } catch { /* ignore */ }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' });
    }

    return (
        <div>
            {/* Drawer header */}
            <div className="inbox-drawer-header">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    {t('inboxPanel.inbox')}
                </h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!readOnly && (
                        <button
                            className="inbox-new-idea-btn"
                            onClick={() => onSelectItem(null)}
                        >
                            + {t('inboxPanel.newIdea')}
                        </button>
                    )}
                    {onClose && (
                        <button className="inbox-drawer-close" onClick={onClose} aria-label="Close">&times;</button>
                    )}
                </div>
            </div>

            {/* Status filter dropdown */}
            <select
                className="inbox-drawer-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
            >
                {STATUS_OPTIONS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                ))}
            </select>
            {/* Quick add */}
            {!readOnly && (
                <form className="inbox-quick-add" onSubmit={handleQuickAdd}>
                    <input
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder={t('inboxPanel.quickAddPlaceholder')}
                    />
                    <select value={quickDept} onChange={(e) => setQuickDept(e.target.value)}>
                        <option value="">{t('inboxPanel.dept')}</option>
                        {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                    </select>
                    <button type="submit">{t('inboxPanel.add')}</button>
                </form>
            )}

            {/* Items list */}
            {loading ? (
                <p className="subtitle">{t('inboxPanel.loading')}</p>
            ) : items.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                    <p style={{ color: 'var(--text-muted)' }}>{t('inboxPanel.noIdeas')}</p>
                </div>
            ) : (
                <div className="inbox-items-list">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`inbox-item-card ${selectedId === item.id ? 'selected' : ''}`}
                            onClick={() => onSelectItem(item.id)}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div className="inbox-item-title">{item.title}</div>
                                <button
                                    onClick={(e) => handleDelete(e, item.id)}
                                    title={t('inboxPanel.delete')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '2px 6px',
                                        borderRadius: 6,
                                        fontSize: '0.85rem',
                                        lineHeight: 1,
                                        flexShrink: 0,
                                        opacity: 0.4,
                                        transition: 'opacity 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0.4}
                                >
                                    &times;
                                </button>
                            </div>
                            <div className="inbox-item-meta">
                                <span className={`source-badge ${item.source}`}>
                                    {item.source === 'telegram' ? <>{InboxIcons.telegram} {t('inboxPanel.telegram')}</> : item.source === 'agent' ? <>{InboxIcons.agent} {t('inboxPanel.agent')}</> : <>{InboxIcons.dashboardSource} {t('inboxPanel.dashboardSource')}</>}
                                </span>
                                <span className={`inbox-status-dot ${item.status}`}></span>
                                <span>{STATUS_LABELS[item.status] || item.status}</span>
                                {item.department && <span style={{ textTransform: 'capitalize' }}>{item.department}</span>}
                                {(() => {
                                    const bauTypeId = item.structured_data?.bau_type;
                                    if (!bauTypeId) return null;
                                    const bt = getBauTypeById(bauTypeId);
                                    const cat = bt ? getBauCategoryById(bt.category) : null;
                                    if (!bt) return null;
                                    return (
                                        <span style={{
                                            fontSize: '0.7rem', padding: '1px 8px', borderRadius: '10px',
                                            background: cat ? `${cat.color}15` : 'rgba(148,163,184,0.1)',
                                            color: cat?.color || 'var(--text-muted)',
                                            fontWeight: 600, whiteSpace: 'nowrap',
                                        }}>
                                            {cat?.icon} {bt.name}
                                        </span>
                                    );
                                })()}
                                <span>{formatDate(item.created_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
