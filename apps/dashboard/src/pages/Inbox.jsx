import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import InboxPanel from '../components/InboxPanel.jsx';
import PMAgentChat from '../components/PMAgentChat.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { InboxIcons } from '../components/icons.jsx';
import { PanelLeft } from 'lucide-react';

export default function Inbox() {
    const { t } = useLanguage();
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Close drawer on Escape key
    useEffect(() => {
        if (!drawerOpen) return;
        function onKey(e) {
            if (e.key === 'Escape') setDrawerOpen(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

    // Sync sidebar-collapsed class to body for portal-rendered drawer
    useEffect(() => {
        const shell = document.querySelector('.app-shell');
        if (!shell) return;
        const sync = () => {
            document.body.classList.toggle('sidebar-collapsed', shell.classList.contains('sidebar-collapsed'));
        };
        sync();
        const obs = new MutationObserver(sync);
        obs.observe(shell, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);

    function handleSelectItem(id) {
        setSelectedItemId(id);
        setDrawerOpen(false);
    }

    function handleCloseChat() {
        setSelectedItemId(null);
        setRefreshKey(k => k + 1);
        setDrawerOpen(true);
    }

    function handleItemCreated(newId) {
        setSelectedItemId(newId);
        setRefreshKey(k => k + 1);
    }

    function handleStatusChange() {
        setRefreshKey(k => k + 1);
    }

    return (
        <div className="dashboard-container animate-fade-in">
            <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {InboxIcons.bot} {t('inboxPage.title')}
                    </h1>
                    <p className="subtitle" style={{ marginTop: 4 }}>
                        {t('inboxPage.subtitle')}
                    </p>
                </div>
                <button
                    className="inbox-drawer-toggle"
                    onClick={() => setDrawerOpen(true)}
                >
                    <PanelLeft size={16} />
                    {t('inboxPage.showItems')}
                </button>
            </header>

            {/* Chat: always visible, full-width */}
            <div className="inbox-chat-main">
                <PMAgentChat
                    key={selectedItemId ?? 'new'}
                    inboxItemId={selectedItemId}
                    onItemCreated={handleItemCreated}
                    onStatusChange={handleStatusChange}
                    onClose={selectedItemId ? handleCloseChat : undefined}
                />
            </div>

            {/* Portal: render drawer outside transform context so position:fixed works */}
            {createPortal(
                <>
                    <div
                        className={`inbox-drawer-overlay ${drawerOpen ? 'open' : ''}`}
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div className={`inbox-drawer ${drawerOpen ? 'open' : ''}`}>
                        <InboxPanel
                            key={refreshKey}
                            selectedId={selectedItemId}
                            onSelectItem={handleSelectItem}
                            onDeleted={() => {
                                setSelectedItemId(null);
                                setRefreshKey(k => k + 1);
                            }}
                            onClose={() => setDrawerOpen(false)}
                        />
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
