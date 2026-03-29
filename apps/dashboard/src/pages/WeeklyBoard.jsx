import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InboxPanel from '../components/InboxPanel';
import MultiAgentBrainstorm from '../components/MultiAgentBrainstorm';
import WeeklyReport from '../components/WeeklyReport';
import PipelineBoard from '../components/PipelineBoard';
import VoiceMeeting from '../components/VoiceMeeting';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { PageHeaderIcons, ActionIcons } from '../components/icons.jsx';
import { Inbox, Calendar, ClipboardList, Brain, BarChart3, Trash2, Phone } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default function WeeklyBoard() {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();

    const statusConfig = {
        done: { color: '#10b981', bg: '#ecfdf5', label: 'Done' },
        completed: { color: '#10b981', bg: '#ecfdf5', label: t('pipeline.completed') },
        'in-progress': { color: '#3b82f6', bg: '#eff6ff', label: t('pipeline.inProgress') },
        active: { color: '#3b82f6', bg: '#eff6ff', label: t('pipeline.inProgress') },
        todo: { color: '#94a3b8', bg: '#f1f5f9', label: 'To Do' },
        planning: { color: '#a855f7', bg: '#faf5ff', label: 'Planning' },
        Planning: { color: '#a855f7', bg: '#faf5ff', label: 'Planning' },
        'In Progress': { color: '#3b82f6', bg: '#eff6ff', label: t('pipeline.inProgress') },
        Completed: { color: '#10b981', bg: '#ecfdf5', label: t('pipeline.completed') },
        Paused: { color: '#f59e0b', bg: '#fffbeb', label: t('pipeline.paused') },
    };

    const [activeView, setActiveView] = useState('weeklies');
    const [showMeeting, setShowMeeting] = useState(false);
    const [selectedWeekly, setSelectedWeekly] = useState(null);
    const [sessionSubTab, setSessionSubTab] = useState('resumen');

    const [dept, setDept] = useState(null);
    const [weeklies, setWeeklies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        week_number: getISOWeek(new Date()),
        session_date: new Date().toISOString().split('T')[0],
    });

    // Session detail state
    const [importing, setImporting] = useState(false);
    const [sessionInbox, setSessionInbox] = useState([]);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [deptData, weekliesData] = await Promise.all([
                fetch(`${API_URL}/departments/${deptId}`).then((r) => {
                    if (!r.ok) throw new Error(`Departamento no encontrado (${r.status})`);
                    return r.json();
                }),
                fetch(`${API_URL}/weekly-sessions?department=${deptId}`).then((r) => {
                    if (!r.ok) throw new Error(`Error cargando weeklies (${r.status})`);
                    return r.json();
                }),
            ]);
            setDept(deptData);
            setWeeklies(Array.isArray(weekliesData) ? weekliesData : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [deptId]);

    // Load session inbox when entering session detail
    useEffect(() => {
        if (selectedWeekly) {
            const session = weeklies.find(w => w.id === selectedWeekly);
            if (session?.inbox_snapshot) {
                setSessionInbox(Array.isArray(session.inbox_snapshot) ? session.inbox_snapshot : []);
            } else {
                setSessionInbox([]);
            }
        }
    }, [selectedWeekly, weeklies]);

    const handleCreateWeekly = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const body = {
                department: deptId,
                week_number: parseInt(formData.week_number),
                session_date: formData.session_date,
                steps_data: {},
                final_projects: []
            };
            const res = await fetch(`${API_URL}/weekly-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(t('weeklyBoard.errorCreating'));
            setShowForm(false);
            fetchData();
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImportInbox = async (sessionId) => {
        setImporting(true);
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/import-inbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.items) {
                setSessionInbox(data.items);
            }
            fetchData(); // Refresh to get updated inbox_snapshot
        } catch (err) {
            alert(t('weeklyBoard.errorImporting') + err.message);
        }
        setImporting(false);
    };

    const handleUpdateStatus = async (sessionId, newStatus) => {
        setUpdatingStatus(true);
        try {
            await fetch(`${API_URL}/weekly-sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            fetchData();
        } catch (err) {
            alert(t('weeklyBoard.errorUpdating') + err.message);
        }
        setUpdatingStatus(false);
    };

    const handleDeleteWeekly = async (e, sessionId) => {
        e.stopPropagation();
        if (!confirm(t('weeklyBoard.confirmDelete'))) return;
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(t('weeklyBoard.errorDeleting'));
            if (selectedWeekly === sessionId) setSelectedWeekly(null);
            fetchData();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <p className="subtitle">{t('weeklyBoard.loadingDept')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('agentDetail.back')}</button>
                <p style={{ color: '#ef4444' }}>Error: {error}</p>
            </div>
        );
    }

    if (!dept) {
        return (
            <div className="dashboard-container animate-fade-in">
                <button className="back-button" onClick={() => navigate('/app/workspace')}>← {t('agentDetail.back')}</button>
                <p>{t('weeklyBoard.deptNotFound')}</p>
            </div>
        );
    }

    const theme = themeMap[deptId] || 'theme-green';
    const deptName = dept.name || deptId;

    const selectedSession = selectedWeekly
        ? weeklies.find((w) => w.id === selectedWeekly)
        : null;

    return (
        <div className={`dashboard-container animate-fade-in ${theme}`}>
            <button className="back-button" onClick={() => navigate(`/app/workspace/${deptId}`)}>
                ← {t('weeklyBoard.backTo')} {deptName}
            </button>

            {/* Header */}
            <header style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '2rem' }}>{PageHeaderIcons.weekly}</span>
                    <div>
                        <h1 style={{ fontSize: '1.8rem' }}>{t('weeklyBoard.weeklyPlanning')} — {deptName}</h1>
                        <p className="subtitle">{t('weeklyBoard.planningCenter')}</p>
                    </div>
                </div>
                {activeView === 'weeklies' && !selectedWeekly && (
                    <button
                        className="back-button"
                        style={{ margin: 0, background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }}
                        onClick={() => setShowForm(true)}
                    >
                        {t('weeklyBoard.newWeekly')}
                    </button>
                )}
            </header>

            {/* Top-level Tabs */}
            <div className="weekly-view-toggle">
                {[
                    { key: 'inbox', label: t('weeklyBoard.inboxTab'), },
                    { key: 'weeklies', label: t('weeklyBoard.weekliesTab') },
                    { key: 'pipeline', label: t('weeklyBoard.pipelineTab') },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`weekly-toggle-btn ${activeView === tab.key ? 'active' : ''}`}
                        onClick={() => { setActiveView(tab.key); setSelectedWeekly(null); setSessionSubTab('resumen'); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ════════ INBOX TAB ════════ */}
            {activeView === 'inbox' && (
                <section className="animate-fade-in">
                    <InboxPanel
                        department={deptId}
                        readOnly
                        selectedId={null}
                        onSelectItem={(id) => { if (id !== null) navigate(`/app/inbox`); }}
                    />
                </section>
            )}

            {/* ════════ WEEKLIES LIST ════════ */}
            {activeView === 'weeklies' && !selectedWeekly && (
                <section className="animate-fade-in">
                    <div className="weekly-sessions-list">
                        {weeklies.map((w) => {
                            const sessionStatus = w.status || 'active';
                            const st = statusConfig[sessionStatus] || statusConfig.active;
                            const inboxCount = Array.isArray(w.inbox_snapshot) ? w.inbox_snapshot.length : 0;
                            const brainstormCount = parseInt(w.brainstorm_count) || 0;
                            return (
                                <div
                                    key={w.id}
                                    className="card weekly-session-card"
                                    onClick={() => { setSelectedWeekly(w.id); setSessionSubTab('resumen'); }}
                                >
                                    <div className="weekly-card-header">
                                        <div>
                                            <h3 className="weekly-card-title">{t('weeklyBoard.week')} {w.week_number}</h3>
                                            <p className="weekly-card-date">
                                                {new Date(w.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span
                                                className={`workflow-status-badge ${sessionStatus === 'completed' ? 'active' : ''}`}
                                                style={{ background: st.bg, color: st.color }}
                                            >
                                                {st.label}
                                            </span>
                                            <button
                                                className="btn-icon-danger"
                                                onClick={(e) => handleDeleteWeekly(e, w.id)}
                                                title={t('weeklyBoard.deleteWeekly')}
                                                style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="weekly-card-stats">
                                        <div className="weekly-stat">
                                            <span className="weekly-stat-val">{inboxCount}</span>
                                            <span className="weekly-stat-lbl">Inbox</span>
                                        </div>
                                        <div className="weekly-stat">
                                            <span className="weekly-stat-val">{brainstormCount}</span>
                                            <span className="weekly-stat-lbl">Brainstorm</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {weeklies.length === 0 && (
                            <div className="empty-state">
                                <div>{t('weeklyBoard.noWeeklies')} {deptName}.</div>
                                <button
                                    className="back-button"
                                    style={{ marginTop: '16px', background: 'var(--primary)', color: 'white' }}
                                    onClick={() => setShowForm(true)}
                                >
                                    {t('weeklyBoard.openFirstWeekly')}
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ════════ ADD WEEKLY MODAL ════════ */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="card modal-card--sm">
                        <h2 style={{ marginBottom: '20px' }}>{t('weeklyBoard.newWeeklySession')}</h2>
                        <form onSubmit={handleCreateWeekly}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    {t('weeklyBoard.weekNumber')}
                                </label>
                                <input
                                    type="number"
                                    className="edit-input-inline"
                                    value={formData.week_number}
                                    onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    {t('weeklyBoard.sessionDate')}
                                </label>
                                <input
                                    type="date"
                                    className="edit-input-inline"
                                    value={formData.session_date}
                                    onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    type="button"
                                    className="back-button"
                                    style={{ flex: 1, margin: 0 }}
                                    onClick={() => setShowForm(false)}
                                    disabled={isSubmitting}
                                >
                                    {t('weeklyBoard.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="back-button"
                                    style={{ flex: 1, margin: 0, background: 'var(--primary)', color: 'white' }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? t('weeklyBoard.creating') : t('weeklyBoard.createSession')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ════════ WEEKLY DETAIL ════════ */}
            {activeView === 'weeklies' && selectedWeekly && selectedSession && (
                <section className="animate-fade-in">
                    <button className="back-button" onClick={() => setSelectedWeekly(null)} style={{ marginBottom: '16px' }}>
                        ← {t('weeklyBoard.backToWeeklies')}
                    </button>

                    {/* Session header */}
                    <div className="weekly-detail-header card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                                    {t('weeklyBoard.week')} {selectedSession.week_number} — {deptName}
                                </h2>
                                <p className="subtitle">
                                    {new Date(selectedSession.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span
                                    className="workflow-status-badge"
                                    style={{
                                        background: (statusConfig[selectedSession.status] || statusConfig.active).bg,
                                        color: (statusConfig[selectedSession.status] || statusConfig.active).color,
                                    }}
                                >
                                    {(statusConfig[selectedSession.status] || statusConfig.active).label}
                                </span>
                                {selectedSession.status !== 'completed' && (
                                    <button
                                        className="brainstorm-respond-btn"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => handleUpdateStatus(selectedSession.id, 'completed')}
                                        disabled={updatingStatus}
                                    >
                                        {t('weeklyBoard.markCompleted')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className="session-subtabs">
                        {[
                            { key: 'resumen', label: t('weeklyBoard.summary') },
                            { key: 'inbox', label: t('weeklyBoard.weekInbox') },
                            { key: 'brainstorm', label: t('weeklyBoard.brainstormTab') },
                            { key: 'reporte', label: t('weeklyBoard.report') },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                className={`session-subtab-btn ${sessionSubTab === tab.key ? 'active' : ''}`}
                                onClick={() => setSessionSubTab(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Resumen ── */}
                    {sessionSubTab === 'resumen' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}><Inbox size={28} /></div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>
                                        {sessionInbox.length}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{t('weeklyBoard.importedProjects')}</div>
                                </div>
                                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}><Brain size={28} /></div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>
                                        {parseInt(selectedSession.brainstorm_count) || 0}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{t('weeklyBoard.contributionsLabel')}</div>
                                </div>
                                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}><BarChart3 size={28} /></div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A' }}>
                                        {(statusConfig[selectedSession.status] || statusConfig.active).label}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{t('weeklyBoard.stateLabel')}</div>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '20px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>{t('weeklyBoard.quickActions')}</h3>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <button
                                        className="brainstorm-trigger-btn"
                                        style={{ fontSize: '0.82rem', padding: '10px 20px' }}
                                        onClick={() => handleImportInbox(selectedSession.id)}
                                        disabled={importing}
                                    >
                                        {importing ? t('weeklyBoard.importing') : t('weeklyBoard.importProjects')}
                                    </button>
                                    <button
                                        className="brainstorm-respond-btn"
                                        onClick={() => setSessionSubTab('brainstorm')}
                                    >
                                        {t('weeklyBoard.goToBrainstorm')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Proyectos del departamento ── */}
                    {sessionSubTab === 'inbox' && (
                        <div className="animate-fade-in">
                            {sessionInbox.length === 0 ? (
                                <div className="empty-state" style={{ padding: '48px 24px' }}>
                                    <p style={{ marginBottom: '12px' }}>{t('weeklyBoard.noImportedProjects')}</p>
                                    <button
                                        className="brainstorm-trigger-btn"
                                        style={{ fontSize: '0.82rem', padding: '10px 20px' }}
                                        onClick={() => handleImportInbox(selectedSession.id)}
                                        disabled={importing}
                                    >
                                        {importing ? t('weeklyBoard.importing') : t('weeklyBoard.importDashboardProjects')}
                                    </button>
                                </div>
                            ) : (
                                <div className="inbox-items-list">
                                    {sessionInbox.map((item, idx) => (
                                        <div key={item._source === 'pipeline' ? `p-${item.id}` : `i-${item.id}`} className="inbox-item-card">
                                            <div className="inbox-item-title">{item.title || item.name}</div>
                                            <div className="inbox-item-meta">
                                                <span className="status-badge" style={{
                                                    fontSize: '0.7rem',
                                                    padding: '2px 8px',
                                                    background: item._source === 'pipeline' ? '#EFF6FF' : (statusConfig[item.status] || statusConfig.Planning || {}).bg || '#f1f5f9',
                                                    color: item._source === 'pipeline' ? '#2563EB' : (statusConfig[item.status] || statusConfig.Planning || {}).color || '#94a3b8',
                                                    borderRadius: '9999px',
                                                    fontWeight: 600,
                                                }}>
                                                    {item._source === 'pipeline' ? 'Pipeline' : ((statusConfig[item.status] || {}).label || item.status)}
                                                </span>
                                                {item.sub_area && (
                                                    <span style={{ color: '#3B82F6', fontSize: '0.78rem', fontWeight: 500 }}>
                                                        {item.sub_area}
                                                    </span>
                                                )}
                                                {item.description && (
                                                    <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                                                        {item.description.substring(0, 80)}{item.description.length > 80 ? '...' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Brainstorm ── */}
                    {sessionSubTab === 'brainstorm' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                <button
                                    className="voice-mode-btn"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 600, width: 'auto' }}
                                    onClick={() => setShowMeeting(true)}
                                >
                                    <Phone size={14} /> {t('meeting.startHybrid')}
                                </button>
                            </div>
                            <MultiAgentBrainstorm
                                sessionId={selectedSession.id}
                                department={deptId}
                                sessionInbox={sessionInbox}
                            />
                            {showMeeting && (
                                <VoiceMeeting
                                    department={deptId}
                                    onClose={() => setShowMeeting(false)}
                                    onSummary={(summary) => {
                                        // Could save to weekly session report
                                        setShowMeeting(false);
                                    }}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Reporte ── */}
                    {sessionSubTab === 'reporte' && (
                        <div className="animate-fade-in">
                            <WeeklyReport
                                session={selectedSession}
                                onReportGenerated={(newReport) => {
                                    setWeeklies(prev =>
                                        prev.map(w =>
                                            w.id === selectedSession.id
                                                ? { ...w, report: newReport }
                                                : w
                                        )
                                    );
                                }}
                            />
                        </div>
                    )}
                </section>
            )}

            {/* ════════ PIPELINE TAB ════════ */}
            {activeView === 'pipeline' && (
                <section className="animate-fade-in">
                    <PipelineBoard department={deptId} />
                </section>
            )}
        </div>
    );
}
