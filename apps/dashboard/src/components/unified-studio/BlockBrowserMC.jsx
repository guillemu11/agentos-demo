import React, { useState, useEffect, useRef } from 'react';
import { Search, Download, Layers, FileText, Mail as MailIcon, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

const TABS = [
    { key: 'blocks', endpoint: '/api/mc/content-blocks', icon: Layers, labelKey: 'unifiedStudio.browser.blocks' },
    { key: 'templates', endpoint: '/api/mc/templates', icon: FileText, labelKey: 'unifiedStudio.browser.templates' },
    { key: 'emails', endpoint: '/api/mc/emails', icon: MailIcon, labelKey: 'unifiedStudio.browser.emails' },
];

export default function BlockBrowserMC({ onImport }) {
    const { t } = useLanguage();
    const [tab, setTab] = useState('blocks');
    const [q, setQ] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);

    const fetchList = async (tabKey, search) => {
        const def = TABS.find(x => x.key === tabKey);
        setLoading(true);
        setError(null);
        try {
            const url = `${API_URL}${def.endpoint}?pageSize=50${search ? `&q=${encodeURIComponent(search)}` : ''}`;
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${r.status}`);
            }
            const data = await r.json();
            setItems(data.items || []);
        } catch (e) {
            setError(e.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchList(tab, q), 250);
        return () => clearTimeout(debounceRef.current);
    }, [tab, q]);

    const handleImport = async (assetId) => {
        try {
            const r = await fetch(`${API_URL}/api/mc/assets/${assetId}`, { credentials: 'include' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const asset = await r.json();
            onImport?.(asset);
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <aside className="us-browser">
            <div className="us-browser-tabs">
                {TABS.map(T => {
                    const Icon = T.icon;
                    return (
                        <button
                            key={T.key}
                            className={`us-browser-tab ${tab === T.key ? 'active' : ''}`}
                            onClick={() => setTab(T.key)}
                            title={t(T.labelKey)}
                        >
                            <Icon size={14} /> <span>{t(T.labelKey)}</span>
                        </button>
                    );
                })}
            </div>
            <div className="us-browser-search">
                <Search size={14} />
                <input
                    type="text"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder={t('unifiedStudio.browser.searchPlaceholder')}
                />
            </div>
            <div className="us-browser-list">
                {loading && <div className="us-browser-state"><Loader2 size={14} className="us-spin" /> {t('unifiedStudio.browser.loading')}</div>}
                {error && <div className="us-browser-state us-browser-error">{error}</div>}
                {!loading && !error && items.length === 0 && (
                    <div className="us-browser-state">{t('unifiedStudio.browser.empty')}</div>
                )}
                {!loading && !error && items.map(item => (
                    <div key={item.id} className="us-browser-item">
                        <div className="us-browser-item-info">
                            <div className="us-browser-item-name" title={item.name}>{item.name}</div>
                            <div className="us-browser-item-meta">{item.assetType} · {item.modifiedDate?.split('T')[0] || ''}</div>
                        </div>
                        <button
                            className="us-icon-btn"
                            onClick={() => handleImport(item.id)}
                            title={t('unifiedStudio.browser.import')}
                        >
                            <Download size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </aside>
    );
}
