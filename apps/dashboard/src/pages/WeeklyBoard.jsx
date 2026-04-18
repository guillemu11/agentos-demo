import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import InboxPanel from '../components/InboxPanel';
import MultiAgentBrainstorm from '../components/MultiAgentBrainstorm';
import WeeklyReport from '../components/WeeklyReport';
import PipelineBoard from '../components/PipelineBoard';
import VoiceMeeting from '../components/VoiceMeeting';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
    Inbox,
    CalendarCheck,
    ClipboardList,
    Brain,
    BarChart3,
    Trash2,
    Mic,
    Layers,
    Activity,
    CheckCircle2,
    ArrowLeft,
} from 'lucide-react';
import HubHero from '../components/ui/HubHero.jsx';
import { HubStats, HubStatCard } from '../components/ui/HubStats.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import FormField from '../components/ui/FormField.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { useToast } from '../components/ui/ToastProvider.jsx';

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

// ISO week number (1-53) using Thursday-of-same-week trick.
function isoWeek(date) {
    const t = new Date(date);
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const y = new Date(t.getFullYear(), 0, 4);
    return Math.ceil(((t - y) / 86400000 + 1) / 7);
}

export default function WeeklyBoard() {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const { t, lang } = useLanguage();
    const toast = useToast();

    const statusConfig = {
        done: { tone: 'success', label: 'Done' },
        completed: { tone: 'success', label: t('pipeline.completed') },
        'in-progress': { tone: 'info', label: t('pipeline.inProgress') },
        active: { tone: 'info', label: t('pipeline.inProgress') },
        todo: { tone: 'neutral', label: 'To Do' },
        planning: { tone: 'violet', label: 'Planning' },
        Planning: { tone: 'violet', label: 'Planning' },
        'In Progress': { tone: 'info', label: t('pipeline.inProgress') },
        Completed: { tone: 'success', label: t('pipeline.completed') },
        Paused: { tone: 'warning', label: t('pipeline.paused') },
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
        week_number: isoWeek(new Date()),
        session_date: new Date().toISOString().split('T')[0],
    });

    // Delete confirmation state
    const [deleteTargetId, setDeleteTargetId] = useState(null);

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
            toast.error(err.message);
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
            toast.error(t('weeklyBoard.errorImporting') + err.message);
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
            toast.error(t('weeklyBoard.errorUpdating') + err.message);
        }
        setUpdatingStatus(false);
    };

    const requestDeleteWeekly = (e, sessionId) => {
        e.stopPropagation();
        setDeleteTargetId(sessionId);
    };

    const confirmDeleteWeekly = async () => {
        const sessionId = deleteTargetId;
        if (!sessionId) return;
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(t('weeklyBoard.errorDeleting'));
            if (selectedWeekly === sessionId) setSelectedWeekly(null);
            fetchData();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setDeleteTargetId(null);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-container animate-fade-in">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Skeleton height={32} width="40%" />
                    <Skeleton height={18} width="60%" />
                    <Skeleton height={120} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                        <Skeleton height={88} />
                        <Skeleton height={88} />
                        <Skeleton height={88} />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container animate-fade-in">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/app/workspace')}
                    style={{ marginBottom: 'var(--space-4)' }}
                >
                    <ArrowLeft size={14} /> {t('agentDetail.back')}
                </Button>
                <EmptyState
                    title={t('weeklyBoard.error')}
                    description={error}
                />
            </div>
        );
    }

    if (!dept) {
        return (
            <div className="dashboard-container animate-fade-in">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/app/workspace')}
                    style={{ marginBottom: 'var(--space-4)' }}
                >
                    <ArrowLeft size={14} /> {t('agentDetail.back')}
                </Button>
                <EmptyState
                    title={t('weeklyBoard.deptNotFound')}
                />
            </div>
        );
    }

    const theme = themeMap[deptId] || 'theme-green';
    const deptName = dept.name || deptId;
    const currentWeek = isoWeek(new Date());

    const selectedSession = selectedWeekly
        ? weeklies.find((w) => w.id === selectedWeekly)
        : null;

    // Top-level stats (list view)
    const totalWeeklies = weeklies.length;
    const activeWeeklies = weeklies.filter(w => (w.status || 'active') !== 'completed').length;
    const completedWeeklies = weeklies.filter(w => w.status === 'completed').length;

    const heroEyebrowText = t('weeklyBoard.hero.eyebrow')
        .replace('{week}', currentWeek)
        .replace('{dept}', deptName);

    return (
        <div className={`dashboard-container animate-fade-in ${theme}`}>
            <Button
                variant="ghost"
                onClick={() => navigate(`/app/workspace/${deptId}`)}
                style={{ marginBottom: 'var(--space-4)' }}
            >
                <ArrowLeft size={14} /> {t('weeklyBoard.backTo')} {deptName}
            </Button>

            <HubHero
                eyebrow={<>
                    <CalendarCheck size={14} strokeWidth={2.5} />
                    <span>{heroEyebrowText}</span>
                </>}
                title={t('weeklyBoard.hero.title')}
                subtitle={t('weeklyBoard.hero.subtitle')}
                actions={activeView === 'weeklies' && !selectedWeekly ? (
                    <Button variant="primary" onClick={() => setShowForm(true)}>
                        <ClipboardList size={14} strokeWidth={2.5} />
                        {t('weeklyBoard.newWeekly')}
                    </Button>
                ) : null}
            />

            {activeView === 'weeklies' && !selectedWeekly && (
                <HubStats>
                    <HubStatCard
                        icon={<Layers size={16} strokeWidth={2} />}
                        label={t('weeklyBoard.stats.sessions')}
                        value={totalWeeklies}
                        tone="neutral"
                    />
                    <HubStatCard
                        icon={<Activity size={16} strokeWidth={2} />}
                        label={t('weeklyBoard.stats.active')}
                        value={activeWeeklies}
                        tone="emerald"
                    />
                    <HubStatCard
                        icon={<CheckCircle2 size={16} strokeWidth={2} />}
                        label={t('weeklyBoard.stats.completed')}
                        value={completedWeeklies}
                        tone="amber"
                    />
                </HubStats>
            )}

            {/* Top-level Tabs */}
            <div className="weekly-view-toggle">
                {[
                    { key: 'inbox', label: t('weeklyBoard.inboxTab') },
                    { key: 'weeklies', label: t('weeklyBoard.weekliesTab') },
                    { key: 'pipeline', label: t('weeklyBoard.pipelineTab') },
                ].map(tab => (
                    <button
                        key={tab.key}
                        type="button"
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
                    {weeklies.length === 0 ? (
                        <EmptyState
                            icon={<ClipboardList size={28} />}
                            title={t('weeklyBoard.emptyTitle').replace('{dept}', deptName)}
                            description={t('weeklyBoard.emptyDesc')}
                            action={
                                <Button variant="primary" onClick={() => setShowForm(true)}>
                                    {t('weeklyBoard.openFirstWeekly')}
                                </Button>
                            }
                        />
                    ) : (
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span className={`ui-badge ui-badge--${st.tone}`}>
                                                    {st.label}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn-icon-danger"
                                                    onClick={(e) => requestDeleteWeekly(e, w.id)}
                                                    title={t('weeklyBoard.deleteWeekly')}
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
                        </div>
                    )}
                </section>
            )}

            {/* ════════ ADD WEEKLY MODAL ════════ */}
            <Modal
                open={showForm}
                onClose={() => !isSubmitting && setShowForm(false)}
                title={t('weeklyBoard.newWeeklySession')}
                size="sm"
            >
                <form onSubmit={handleCreateWeekly}>
                    <FormField label={t('weeklyBoard.weekNumber')} required>
                        <input
                            type="number"
                            value={formData.week_number}
                            onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                        />
                    </FormField>
                    <FormField label={t('weeklyBoard.sessionDate')} required>
                        <input
                            type="date"
                            value={formData.session_date}
                            onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                        />
                    </FormField>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowForm(false)}
                            disabled={isSubmitting}
                        >
                            {t('weeklyBoard.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('weeklyBoard.creating') : t('weeklyBoard.createSession')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ════════ DELETE CONFIRM DIALOG ════════ */}
            <ConfirmDialog
                open={deleteTargetId !== null}
                title={t('weeklyBoard.confirmDeleteTitle')}
                message={t('weeklyBoard.confirmDelete')}
                confirmLabel={t('weeklyBoard.confirmDeleteAction')}
                cancelLabel={t('weeklyBoard.cancel')}
                variant="danger"
                onConfirm={confirmDeleteWeekly}
                onCancel={() => setDeleteTargetId(null)}
            />

            {/* ════════ WEEKLY DETAIL ════════ */}
            {activeView === 'weeklies' && selectedWeekly && selectedSession && (
                <section className="animate-fade-in">
                    <Button
                        variant="ghost"
                        onClick={() => setSelectedWeekly(null)}
                        style={{ marginBottom: 'var(--space-4)' }}
                    >
                        <ArrowLeft size={14} /> {t('weeklyBoard.backToWeeklies')}
                    </Button>

                    {/* Session header */}
                    <div className="weekly-detail-header card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-1)' }}>
                                    {t('weeklyBoard.week')} {selectedSession.week_number} — {deptName}
                                </h2>
                                <p className="subtitle">
                                    {new Date(selectedSession.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                                    })}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                {(() => {
                                    const st = statusConfig[selectedSession.status] || statusConfig.active;
                                    return (
                                        <span className={`ui-badge ui-badge--${st.tone}`}>
                                            {st.label}
                                        </span>
                                    );
                                })()}
                                {selectedSession.status !== 'completed' && (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleUpdateStatus(selectedSession.id, 'completed')}
                                        disabled={updatingStatus}
                                    >
                                        <CheckCircle2 size={14} />
                                        {t('weeklyBoard.markCompleted')}
                                    </Button>
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
                                type="button"
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
                            <HubStats>
                                <HubStatCard
                                    icon={<Inbox size={16} strokeWidth={2} />}
                                    label={t('weeklyBoard.stats.imported')}
                                    value={sessionInbox.length}
                                    tone="neutral"
                                />
                                <HubStatCard
                                    icon={<Brain size={16} strokeWidth={2} />}
                                    label={t('weeklyBoard.stats.contributions')}
                                    value={parseInt(selectedSession.brainstorm_count) || 0}
                                    tone="emerald"
                                />
                                <HubStatCard
                                    icon={<BarChart3 size={16} strokeWidth={2} />}
                                    label={t('weeklyBoard.stats.state')}
                                    value={(statusConfig[selectedSession.status] || statusConfig.active).label}
                                    tone="amber"
                                />
                            </HubStats>

                            <div className="card" style={{ padding: 'var(--space-5)' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                                    {t('weeklyBoard.quickActions')}
                                </h3>
                                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleImportInbox(selectedSession.id)}
                                        disabled={importing}
                                    >
                                        <Inbox size={14} />
                                        {importing ? t('weeklyBoard.importing') : t('weeklyBoard.importProjects')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => setSessionSubTab('brainstorm')}
                                    >
                                        <Brain size={14} />
                                        {t('weeklyBoard.goToBrainstorm')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Proyectos del departamento ── */}
                    {sessionSubTab === 'inbox' && (
                        <div className="animate-fade-in">
                            {sessionInbox.length === 0 ? (
                                <EmptyState
                                    icon={<Inbox size={28} />}
                                    title={t('weeklyBoard.noImportedProjects')}
                                    action={
                                        <Button
                                            variant="primary"
                                            onClick={() => handleImportInbox(selectedSession.id)}
                                            disabled={importing}
                                        >
                                            {importing ? t('weeklyBoard.importing') : t('weeklyBoard.importDashboardProjects')}
                                        </Button>
                                    }
                                />
                            ) : (
                                <div className="inbox-items-list">
                                    {sessionInbox.map((item) => {
                                        const isPipeline = item._source === 'pipeline';
                                        const st = statusConfig[item.status] || statusConfig.Planning || statusConfig.todo;
                                        return (
                                            <div key={isPipeline ? `p-${item.id}` : `i-${item.id}`} className="inbox-item-card">
                                                <div className="inbox-item-title">{item.title || item.name}</div>
                                                <div className="inbox-item-meta">
                                                    <span className={`ui-badge ui-badge--${isPipeline ? 'info' : st.tone}`}>
                                                        {isPipeline ? 'Pipeline' : (st.label || item.status)}
                                                    </span>
                                                    {item.sub_area && (
                                                        <span className="weekly-sub-area">
                                                            {item.sub_area}
                                                        </span>
                                                    )}
                                                    {item.description && (
                                                        <span className="weekly-item-desc">
                                                            {item.description.substring(0, 80)}{item.description.length > 80 ? '...' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Brainstorm ── */}
                    {sessionSubTab === 'brainstorm' && (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
                                <span className="weekly-voice-eyebrow">{t('weeklyBoard.voiceEyebrow')}</span>
                                <Button variant="primary" onClick={() => setShowMeeting(true)}>
                                    <Mic size={14} />
                                    {t('weeklyBoard.voiceCta')}
                                </Button>
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
                                    onSummary={() => {
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
