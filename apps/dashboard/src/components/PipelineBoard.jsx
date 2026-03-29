import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { Mail, Search, FlaskConical, FolderKanban } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const statusTransitions = {
    'Planning':     ['In Progress', 'Paused'],
    'In Progress':  ['Completed', 'Paused'],
    'Completed':    ['In Progress'],
    'Paused':       ['Planning', 'In Progress'],
    // Email proposal
    'draft':        ['review'],
    'review':       ['approved', 'rejected'],
    'approved':     [],
    'rejected':     ['draft'],
    // Research
    'queued':       [],
    'researching':  [],
    'completed':    [],
    'failed':       [],
    // Experiment
    'proposed':     ['approved', 'cancelled'],
    'running':      ['completed'],
    'cancelled':    [],
};

const TYPE_CONFIG = {
    project:          { icon: FolderKanban, color: '#a855f7', label: 'Projects' },
    email_proposal:   { icon: Mail,         color: '#10b981', label: 'Emails' },
    research_session: { icon: Search,       color: '#3b82f6', label: 'Research' },
    experiment:       { icon: FlaskConical,  color: '#f59e0b', label: 'Experiments' },
};

export default function PipelineBoard({ department }) {
    const { t } = useLanguage();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [jiraKeys, setJiraKeys] = useState({});
    const [creatingJira, setCreatingJira] = useState(null);
    const [importingJira, setImportingJira] = useState(false);
    const [jiraImportCounter, setJiraImportCounter] = useState(1);
    const [typeFilter, setTypeFilter] = useState('');

    const columns = [
        { key: 'Planning',     label: t('pipeline.planning'),    color: '#a855f7', bg: '#faf5ff' },
        { key: 'In Progress',  label: t('pipeline.inProgress'),  color: '#3b82f6', bg: '#eff6ff' },
        { key: 'Completed',    label: t('pipeline.completed'),   color: '#10b981', bg: '#ecfdf5' },
        { key: 'Paused',       label: t('pipeline.paused'),      color: '#f59e0b', bg: '#fffbeb' },
    ];

    // Map non-project statuses to columns
    const statusColumnMap = {
        'draft': 'Planning', 'queued': 'Planning', 'proposed': 'Planning',
        'review': 'In Progress', 'researching': 'In Progress', 'synthesizing': 'In Progress', 'approved': 'In Progress', 'running': 'In Progress',
        'completed': 'Completed', 'indexed': 'Completed',
        'paused': 'Paused', 'rejected': 'Paused', 'failed': 'Paused', 'cancelled': 'Paused',
    };

    const transitionLabels = {
        'Planning':     t('pipeline.planning'),
        'In Progress':  t('pipeline.inProgress'),
        'Completed':    t('pipeline.completed'),
        'Paused':       t('pipeline.paused'),
    };

    useEffect(() => {
        fetchProjects();
    }, [department, typeFilter]);

    async function fetchProjects() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ department });
            if (typeFilter) params.set('type', typeFilter);
            const res = await fetch(`${API_URL}/pipeline?${params}`);
            const data = await res.json();
            setProjects(Array.isArray(data) ? data : []);
        } catch {
            setProjects([]);
        }
        setLoading(false);
    }

    const mockJiraTickets = [
        { name: 'Migrate email templates to new design system', problem: 'Current templates are outdated and not mobile-responsive', key: 'EK-401' },
        { name: 'Implement A/B testing for landing pages', problem: 'No data-driven way to optimize conversion rates', key: 'EK-402' },
        { name: 'Automate weekly KPI report generation', problem: 'Manual reporting takes 4+ hours every Monday', key: 'EK-403' },
        { name: 'Set up customer feedback pipeline', problem: 'Feedback is scattered across email, Slack and support tickets', key: 'EK-404' },
        { name: 'Integrate CRM with loyalty program API', problem: 'Customer data is siloed between systems', key: 'EK-405' },
    ];

    async function handleImportFromJira() {
        setImportingJira(true);
        await new Promise(r => setTimeout(r, 800));
        const ticket = mockJiraTickets[(jiraImportCounter - 1) % mockJiraTickets.length];
        const mockId = `jira-${Date.now()}`;
        const imported = {
            id: mockId,
            name: ticket.name,
            problem: ticket.problem,
            status: 'Planning',
            estimated_timeline: null,
            estimated_budget: 0,
            total_tasks: 0,
            done_tasks: 0,
        };
        setProjects(prev => [imported, ...prev]);
        setJiraKeys(prev => ({ ...prev, [mockId]: ticket.key }));
        setJiraImportCounter(prev => prev + 1);
        setImportingJira(false);
    }

    async function handleStatusChange(item, newStatus) {
        const itemType = item._type || 'project';
        const itemId = item.id;
        setUpdating(`${itemType}-${itemId}`);
        try {
            const url = itemType === 'project'
                ? `${API_URL}/projects/${itemId}/status`
                : `${API_URL}/pipeline/${itemType}/${itemId}/status`;
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setProjects(prev => prev.map(p =>
                    (p.id === itemId && (p._type || 'project') === itemType) ? { ...p, status: newStatus } : p
                ));
            }
        } catch { /* ignore */ }
        setUpdating(null);
    }

    if (loading) {
        return <p style={{ color: '#64748B', fontSize: '0.88rem' }}>{t('pipeline.loadingPipeline')}</p>;
    }

    if (projects.length === 0) {
        return (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\u{1F4CB}'}</div>
                <p style={{ color: '#0F172A', fontWeight: 600 }}>{t('pipeline.noProjects')}</p>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '8px' }}>
                    {t('pipeline.noProjectsHint')}
                </p>
            </div>
        );
    }

    const grouped = columns.map(col => ({
        ...col,
        items: projects.filter(p => {
            const itemType = p._type || 'project';
            if (itemType === 'project') return p.status === col.key;
            return (statusColumnMap[p.status] || 'Planning') === col.key;
        }),
    }));

    // Count by type
    const typeCounts = {};
    for (const p of projects) {
        const t = p._type || 'project';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    return (
        <div>
            {/* Type filter chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className={`email-gen-chip ${typeFilter === '' ? 'active' : ''}`} onClick={() => setTypeFilter('')} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                    All ({projects.length})
                </button>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                        <button key={key} className={`email-gen-chip ${typeFilter === key ? 'active' : ''}`} onClick={() => setTypeFilter(typeFilter === key ? '' : key)} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>
                            <Icon size={10} /> {cfg.label} {typeCounts[key] ? `(${typeCounts[key]})` : ''}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button
                    onClick={handleImportFromJira}
                    disabled={importingJira}
                    style={{
                        fontSize: '0.78rem', fontWeight: 600,
                        padding: '6px 16px', borderRadius: '9999px',
                        border: '1px solid #0052CC', background: '#0052CC',
                        color: '#fff', cursor: importingJira ? 'not-allowed' : 'pointer',
                        opacity: importingJira ? 0.6 : 1,
                        transition: 'all 0.15s',
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    {'\u{1F4CB}'} {importingJira ? t('pipeline.importingJira') : t('pipeline.importFromJira')}
                </button>
            </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {grouped.map(col => (
                <div key={col.key}>
                    {/* Column header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '14px', paddingBottom: '8px',
                        borderBottom: `2px solid ${col.color}20`,
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: col.color, display: 'inline-block',
                        }} />
                        <span style={{
                            fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: '#64748B',
                        }}>
                            {col.label}
                        </span>
                        <span style={{
                            fontSize: '0.72rem', background: col.bg, color: col.color,
                            borderRadius: '9999px', padding: '1px 8px', fontWeight: 600,
                        }}>
                            {col.items.length}
                        </span>
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '60px' }}>
                        {col.items.length === 0 ? (
                            <div style={{
                                padding: '20px 16px', color: '#CBD5E1', fontSize: '0.8rem',
                                textAlign: 'center', border: '1px dashed #E5E7EB', borderRadius: '16px',
                            }}>
                                {t('pipeline.noProjectsInColumn')}
                            </div>
                        ) : (
                            col.items.map(proj => {
                                const itemType = proj._type || 'project';
                                const typeConfig = TYPE_CONFIG[itemType];
                                const TypeIcon = typeConfig?.icon || FolderKanban;
                                const totalTasks = parseInt(proj.total_tasks) || 0;
                                const doneTasks = parseInt(proj.done_tasks) || 0;
                                const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                                const transitions = statusTransitions[proj.status] || [];
                                const isUpdating = updating === `${itemType}-${proj.id}`;

                                return (
                                    <div key={`${itemType}-${proj.id}`} className="card" style={{ padding: '16px', borderLeft: `3px solid ${typeConfig?.color || '#a855f7'}` }}>
                                        {/* Type badge */}
                                        {itemType !== 'project' && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                                <TypeIcon size={10} style={{ color: typeConfig?.color }} />
                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: typeConfig?.color }}>
                                                    {typeConfig?.label}
                                                </span>
                                                {itemType === 'email_proposal' && proj.market && (
                                                    <span className="kb-namespace-tag" style={{ marginLeft: 4 }}>{proj.market}/{proj.language}</span>
                                                )}
                                                {itemType === 'experiment' && proj.experiment_type && (
                                                    <span className="kb-namespace-tag" style={{ marginLeft: 4 }}>{proj.experiment_type}</span>
                                                )}
                                                {itemType === 'research_session' && proj.depth && (
                                                    <span className="kb-namespace-tag" style={{ marginLeft: 4 }}>{proj.depth}</span>
                                                )}
                                            </div>
                                        )}

                                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                                            {proj.name || proj.variant_name || proj.title || proj.hypothesis?.slice(0, 60)}
                                        </h4>

                                        {/* Type-specific content */}
                                        {itemType === 'project' && proj.problem && (
                                            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                                                {proj.problem.length > 120 ? proj.problem.substring(0, 120) + '...' : proj.problem}
                                            </p>
                                        )}
                                        {itemType === 'email_proposal' && proj.subject_line && (
                                            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 10px 0', lineHeight: 1.5, fontStyle: 'italic' }}>
                                                "{proj.subject_line.length > 80 ? proj.subject_line.substring(0, 80) + '...' : proj.subject_line}"
                                            </p>
                                        )}
                                        {itemType === 'research_session' && (
                                            <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem', color: '#64748B', margin: '0 0 10px 0' }}>
                                                <span>{proj.sources_found || 0} sources</span>
                                                {proj.progress > 0 && proj.progress < 100 && <span>{proj.progress}%</span>}
                                            </div>
                                        )}

                                        {/* Badges: timeline + budget */}
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: totalTasks > 0 ? '10px' : '0' }}>
                                            {proj.estimated_timeline && proj.estimated_timeline !== 'TBD' && (
                                                <span style={{
                                                    fontSize: '0.7rem', background: '#F1F5F9', borderRadius: 999,
                                                    padding: '2px 10px', color: '#475569',
                                                }}>
                                                    {proj.estimated_timeline}
                                                </span>
                                            )}
                                            {proj.estimated_budget > 0 && (
                                                <span style={{
                                                    fontSize: '0.7rem', background: '#F1F5F9', borderRadius: 999,
                                                    padding: '2px 10px', color: '#475569',
                                                }}>
                                                    ${Number(proj.estimated_budget).toLocaleString()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Task progress bar */}
                                        {totalTasks > 0 && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{t('pipeline.tasks')}</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                                                        {doneTasks}/{totalTasks}
                                                    </span>
                                                </div>
                                                <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${taskPct}%`, height: '100%', borderRadius: '9999px',
                                                        background: taskPct === 100 ? '#10b981' : '#3b82f6',
                                                        transition: 'width 0.3s ease',
                                                    }} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Status change buttons */}
                                        {transitions.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {transitions.map(target => {
                                                    const targetCol = columns.find(c => c.key === target);
                                                    return (
                                                        <button
                                                            key={target}
                                                            onClick={() => handleStatusChange(proj, target)}
                                                            disabled={isUpdating}
                                                            style={{
                                                                fontSize: '0.7rem', fontWeight: 600,
                                                                padding: '3px 12px', borderRadius: '9999px',
                                                                border: `1px solid ${targetCol?.color || '#94a3b8'}`,
                                                                background: 'transparent',
                                                                color: targetCol?.color || '#64748B',
                                                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                                                opacity: isUpdating ? 0.5 : 1,
                                                                transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            {'\u2192'} {transitionLabels[target] || target}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Jira integration */}
                                        {jiraKeys[proj.id] ? (
                                            <span
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '0.7rem', color: '#0052CC', fontWeight: 600,
                                                    marginTop: '8px', cursor: 'default',
                                                }}
                                                title={t('pipeline.viewInJira')}
                                            >
                                                {'\u{1F4CB}'} {jiraKeys[proj.id]}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    setCreatingJira(proj.id);
                                                    await new Promise(r => setTimeout(r, 500));
                                                    setJiraKeys(prev => ({ ...prev, [proj.id]: `EK-${proj.id}` }));
                                                    setCreatingJira(null);
                                                }}
                                                disabled={creatingJira === proj.id}
                                                style={{
                                                    fontSize: '0.7rem', fontWeight: 600, marginTop: '8px',
                                                    padding: '3px 12px', borderRadius: '9999px',
                                                    border: '1px solid #0052CC', background: 'transparent',
                                                    color: '#0052CC', cursor: creatingJira === proj.id ? 'not-allowed' : 'pointer',
                                                    opacity: creatingJira === proj.id ? 0.5 : 1,
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {creatingJira === proj.id ? t('pipeline.creatingJira') : t('pipeline.createJiraTicket')}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ))}
        </div>
        </div>
    );
}
