import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { NavIcons, LangIcon } from './icons.jsx';
import { LogOut, Menu, X, Settings as SettingsIcon } from 'lucide-react';

const icons = NavIcons;

const gearRoutes = ['/app/settings', '/app/workspace/audit', '/app/workspace/intelligence', '/app/pm-reports', '/app/workflows'];

export default function Layout({ user, onLogout }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [gearOpen, setGearOpen] = useState(false);
    const location = useLocation();
    const { lang, setLang, t } = useLanguage();

    const isGearRouteActive = gearRoutes.some(r => location.pathname.startsWith(r));

    useEffect(() => {
        if (!gearOpen) return;
        const handler = (e) => {
            if (!e.target.closest('.settings-gear-wrapper')) setGearOpen(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [gearOpen]);

    const navGroups = [
        {
            label: null,
            items: [
                { to: '/app', icon: icons.home, label: t('layout.home') },
                { to: '/app/projects', icon: icons.dashboard, label: t('layout.commandCenter') },
                { to: '/app/workspace', icon: icons.workspace, label: t('layout.agentTeams') },
                { to: '/app/campaigns', icon: icons.campaigns, label: t('layout.campaigns') },
            ],
        },
        {
            label: t('layout.actions'),
            items: [
                { to: '/app/journeys', icon: icons.workflows, label: t('layout.createJourney') },
                { to: '/app/campaign-creation', icon: icons.campaignCreation, label: t('layout.campaignCreation') },
                { to: '/app/campaign-creation-v2', icon: icons.campaignCreation, label: 'Create Campaign ✨' },
                { to: '/app/preview-test', icon: icons.previewTest, label: t('layout.previewTest') },
                { to: '/app/competitor-analysis', icon: icons.competitorAnalysis, label: t('layout.competitorAnalysis') },
                { to: '/app/competitor-intel', icon: icons.competitorIntel, label: t('layout.competitorIntel') },
                { to: '/app/brand-guardian', icon: icons.brandGuardian, label: t('layout.brandGuardian') },
                { to: '/app/research', icon: icons.intelligence, label: t('layout.autoResearch') },
            ],
        },
        {
            label: t('layout.studios'),
            items: [
                { to: '/app/studio', icon: icons.studio, label: t('layout.studio') },
                { to: '/app/image-studio', icon: icons.imageStudio, label: t('layout.imageStudio') },
            ],
        },
        {
            label: t('layout.control'),
            items: [
                { to: '/app/inbox', icon: icons.projectManager, label: t('layout.projectManager') },
                { to: '/app/knowledge', icon: icons.knowledgeBase, label: t('layout.knowledgeBase') },
                { to: '/app/calendar', icon: icons.calendar, label: t('layout.calendar') },
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
                    {navGroups.map((group, gi) => (
                        <div key={group.label || gi} className="sidebar-group">
                            {group.label && !collapsed && <div className="sidebar-group-label">{group.label}</div>}
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/app' || item.to === '/app/workspace'}
                                    className={({ isActive }) => {
                                        const isWorkspaceBase = item.to === '/app/workspace' && location.pathname.startsWith('/app/workspace') && !location.pathname.includes('/audit') && !location.pathname.includes('/intelligence') && !location.pathname.includes('/agent/') && !location.pathname.includes('/tool/');
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
                    {/* User indicator + gear */}
                    {user && (
                        <div className="sidebar-user">
                            {!collapsed ? (
                                <>
                                    <div className="sidebar-user-info">
                                        <span className="sidebar-user-name">{user.name || 'Guillermo Muñoz'}</span>
                                        <span className="sidebar-user-role">{user.role || 'owner'}</span>
                                    </div>
                                    <div className="settings-gear-wrapper">
                                        <button
                                            className={`settings-gear-btn ${gearOpen || isGearRouteActive ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setGearOpen(!gearOpen); }}
                                        >
                                            <SettingsIcon size={18} />
                                        </button>
                                        {gearOpen && (
                                            <div className="settings-gear-popover">
                                                <NavLink to="/app/settings" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.settings}</span>
                                                    <span className="sidebar-label">{t('layout.settings')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workspace/audit" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.audit}</span>
                                                    <span className="sidebar-label">{t('layout.auditLog')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workspace/intelligence" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.intelligence}</span>
                                                    <span className="sidebar-label">{t('layout.intelligence')}</span>
                                                </NavLink>
                                                <NavLink to="/app/pm-reports" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.reports}</span>
                                                    <span className="sidebar-label">{t('layout.pmReports')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workflows" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.workflows}</span>
                                                    <span className="sidebar-label">{t('layout.workflows')}</span>
                                                </NavLink>
                                            </div>
                                        )}
                                    </div>
                                    <button className="sidebar-logout-btn" onClick={onLogout} title={t('auth.logout')}>
                                        <LogOut size={16} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="settings-gear-wrapper">
                                        <button
                                            className={`settings-gear-btn ${gearOpen || isGearRouteActive ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setGearOpen(!gearOpen); }}
                                        >
                                            <SettingsIcon size={18} />
                                        </button>
                                        {gearOpen && (
                                            <div className="settings-gear-popover">
                                                <NavLink to="/app/settings" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.settings}</span>
                                                    <span className="sidebar-label">{t('layout.settings')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workspace/audit" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.audit}</span>
                                                    <span className="sidebar-label">{t('layout.auditLog')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workspace/intelligence" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.intelligence}</span>
                                                    <span className="sidebar-label">{t('layout.intelligence')}</span>
                                                </NavLink>
                                                <NavLink to="/app/pm-reports" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.reports}</span>
                                                    <span className="sidebar-label">{t('layout.pmReports')}</span>
                                                </NavLink>
                                                <NavLink to="/app/workflows" className="sidebar-link" onClick={() => { setGearOpen(false); setMobileOpen(false); }}>
                                                    <span className="sidebar-icon">{icons.workflows}</span>
                                                    <span className="sidebar-label">{t('layout.workflows')}</span>
                                                </NavLink>
                                            </div>
                                        )}
                                    </div>
                                    <button className="sidebar-logout-btn" onClick={onLogout} title={t('auth.logout')}>
                                        <LogOut size={16} />
                                    </button>
                                </>
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
