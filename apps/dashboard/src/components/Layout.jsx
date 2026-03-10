import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { NavIcons, LangIcon } from './icons.jsx';
import { LogOut, Menu, X } from 'lucide-react';

const icons = NavIcons;

export default function Layout({ user, onLogout }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const { lang, setLang, t } = useLanguage();

    const navGroups = [
        {
            label: 'Main',
            items: [
                { to: '/app', icon: icons.home, label: t('layout.home') },
                { to: '/app/projects', icon: icons.dashboard, label: t('layout.dashboard') },
                { to: '/app/workspace', icon: icons.workspace, label: t('layout.workspace') },
                { to: '/app/campaigns', icon: icons.campaigns, label: t('layout.campaigns') },
            ],
        },
        {
            label: 'Operations',
            items: [
                { to: '/app/workflows', icon: icons.workflows, label: t('layout.workflows') },
                { to: '/app/inbox', icon: icons.agent, label: t('layout.projectManager') },
                { to: '/app/pm-reports', icon: icons.reports, label: t('layout.pmReports') },
            ],
        },
        {
            label: 'Control',
            items: [
                { to: '/app/workspace/intelligence', icon: icons.intelligence, label: t('layout.intelligence') },
                { to: '/app/workspace/audit', icon: icons.audit, label: t('layout.auditLog') },
                { to: '/app/settings', icon: icons.settings, label: t('layout.settings') },
            ],
        },
    ];

    const toggleLang = () => setLang(lang === 'es' ? 'en' : 'es');

    return (
        <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-nav-open' : ''}`}>
            {/* Mobile hamburger */}
            <button
                className="mobile-nav-toggle"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? t('layout.closeNav') : t('layout.openNav')}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {mobileOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        {!collapsed ? (
                            <img src="/emirates-logo.png" alt="Emirates" className="sidebar-logo-img" />
                        ) : (
                            <img src="/emirates-logo.png" alt="Emirates" className="sidebar-logo-img-collapsed" />
                        )}
                    </div>
                    <button
                        className="sidebar-toggle"
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? t('layout.expand') : t('layout.collapse')}
                    >
                        {icons.panelLeft}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navGroups.map((group) => (
                        <div key={group.label} className="sidebar-group">
                            {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/app' || item.to === '/app/workspace'}
                                    className={({ isActive }) => {
                                        const isWorkspaceBase = item.to === '/app/workspace' && location.pathname.startsWith('/app/workspace') && !location.pathname.includes('/audit') && !location.pathname.includes('/intelligence');
                                        const isCampaignsBase = item.to === '/app/campaigns' && location.pathname.startsWith('/app/campaigns');
                                        return `sidebar-link ${isActive || isWorkspaceBase || isCampaignsBase ? 'active' : ''}`;
                                    }}
                                    onClick={() => setMobileOpen(false)}
                                >
                                    <span className="sidebar-icon">{item.icon}</span>
                                    {!collapsed && <span className="sidebar-label">{item.label}</span>}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {/* User indicator */}
                    {user && (
                        <div className="sidebar-user">
                            {!collapsed ? (
                                <>
                                    <div className="sidebar-user-info">
                                        <span className="sidebar-user-name">{user.name || 'Guillermo Muñoz'}</span>
                                        <span className="sidebar-user-role">{user.role || 'owner'}</span>
                                    </div>
                                    <button className="sidebar-logout-btn" onClick={onLogout} title={t('auth.logout')}>
                                        <LogOut size={16} />
                                    </button>
                                </>
                            ) : (
                                <button className="sidebar-logout-btn" onClick={onLogout} title={t('auth.logout')}>
                                    <LogOut size={16} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Language toggle */}
                    <button
                        className="lang-toggle-btn"
                        onClick={toggleLang}
                        title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                    >
                        {collapsed ? (
                            <span className="lang-flag"><LangIcon lang={lang} /></span>
                        ) : (
                            <div className="lang-toggle-inner">
                                <span className={`lang-option ${lang === 'es' ? 'lang-active' : ''}`}><LangIcon lang="es" /> ES</span>
                                <span className="lang-divider">|</span>
                                <span className={`lang-option ${lang === 'en' ? 'lang-active' : ''}`}>EN <LangIcon lang="en" /></span>
                            </div>
                        )}
                    </button>

                    {!collapsed && (
                        <div className="sidebar-version">
                            <span className="version-dot"></span>
                            v1.0 — Enterprise
                        </div>
                    )}
                </div>
            </aside>

            <main className="main-content">
                <Outlet context={{ user, onLogout }} />
            </main>
        </div>
    );
}
