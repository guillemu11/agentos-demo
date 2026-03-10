import React, { useState } from 'react';
import InboxPanel from '../components/InboxPanel.jsx';
import PMAgentChat from '../components/PMAgentChat.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { InboxIcons } from '../components/icons.jsx';

export default function Inbox() {
    const { t } = useLanguage();
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [mobileView, setMobileView] = useState('list');

    function handleSelectItem(id) {
        setSelectedItemId(id);
        setChatOpen(true);
        setMobileView('chat');
    }

    function handleCloseChat() {
        setChatOpen(false);
        setSelectedItemId(null);
        setRefreshKey(k => k + 1);
        setMobileView('list');
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
            <header style={{ marginBottom: 24 }}>
                <h1 style={{ fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    {InboxIcons.bot} {t('inboxPage.title')}
                </h1>
                <p className="subtitle" style={{ marginTop: 4 }}>
                    {t('inboxPage.subtitle')}
                </p>
            </header>

            <div className={`inbox-layout ${chatOpen ? 'chat-open' : ''}`}>
                <div className={mobileView === 'chat' ? 'inbox-panel-hidden' : ''}>
                    <InboxPanel
                        key={refreshKey}
                        selectedId={selectedItemId}
                        onSelectItem={handleSelectItem}
                        onDeleted={handleCloseChat}
                    />
                </div>

                {chatOpen && (
                    <div className={`inbox-chat-panel ${mobileView === 'list' ? 'inbox-panel-hidden' : ''}`}>
                        <PMAgentChat
                            key={selectedItemId ?? 'new'}
                            inboxItemId={selectedItemId}
                            onItemCreated={handleItemCreated}
                            onStatusChange={handleStatusChange}
                            onClose={handleCloseChat}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
