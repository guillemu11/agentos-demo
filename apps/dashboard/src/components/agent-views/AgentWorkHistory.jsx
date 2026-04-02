import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function AgentWorkHistory({ agentId, onCountChange }) {
    const { t, lang } = useLanguage();
    const [work, setWork] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        if (!agentId) return;
        fetch(`${API_URL}/agents/${agentId}/pipeline-work`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                const items = Array.isArray(data) ? data : [];
                setWork(items);
                if (onCountChange) onCountChange(items.length);
            })
            .catch(() => {});
    }, [agentId, onCountChange]);

    if (work.length === 0) {
        return <div className="empty-state">{t('pipeline.noCompletedWork')}</div>;
    }

    return (
        <div className="agent-work-history">
            {work.map(item => {
                let deliverables = {};
                try {
                    deliverables = typeof item.deliverables === 'string'
                        ? JSON.parse(item.deliverables)
                        : (item.deliverables || {});
                } catch (_) {
                    deliverables = {};
                }

                const outputs = deliverables.deliverables || [];
                const decisions = deliverables.decisions_made || [];
                const pending = deliverables.open_questions || [];
                const contextForNext = deliverables.context_for_next || '';

                const durationMs = item.completed_at && item.started_at
                    ? new Date(item.completed_at) - new Date(item.started_at)
                    : null;
                const durationStr = durationMs != null
                    ? (durationMs < 3600000
                        ? `${Math.round(durationMs / 60000)}m`
                        : `${Math.round(durationMs / 3600000 * 10) / 10}h`)
                    : null;

                const timeAgo = item.completed_at ? formatTimeAgo(item.completed_at) : '';
                const completedDate = item.completed_at
                    ? new Date(item.completed_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    })
                    : '';

                const summary = item.summary || '';
                const isExpanded = expandedId === item.id;

                return (
                    <div
                        key={item.id}
                        className={`agent-work-card${isExpanded ? ' expanded' : ''}`}
                    >
                        <div
                            className="work-card-main"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('navigate-to-pipeline', {
                                    detail: { projectId: item.project_id }
                                }));
                            }}
                        >
                            <div className="work-card-header">
                                <span className="work-card-project">{item.project_name}</span>
                                <span className="work-card-time">{timeAgo}</span>
                            </div>
                            <div className="work-card-stage">
                                [{item.stage_order}] {item.stage_name}
                                {durationStr && <span> — {durationStr}</span>}
                            </div>
                            {completedDate && (
                                <div className="work-card-completed-date">
                                    {t('pipeline.completedOn').replace('{date}', completedDate)}
                                </div>
                            )}
                            {summary && (
                                <p className="work-card-summary">
                                    {isExpanded ? summary : (summary.length > 150 ? summary.substring(0, 150) + '...' : summary)}
                                </p>
                            )}
                            <div className="work-card-badges">
                                {outputs.length > 0 && (
                                    <span className="work-badge outputs">
                                        {t('pipeline.outputsCount').replace('{count}', outputs.length)}
                                    </span>
                                )}
                                {decisions.length > 0 && (
                                    <span className="work-badge decisions">
                                        {t('pipeline.decisionsCount').replace('{count}', decisions.length)}
                                    </span>
                                )}
                                {pending.length > 0 && (
                                    <span className="work-badge pending">
                                        {t('pipeline.pendingCount').replace('{count}', pending.length)}
                                    </span>
                                )}
                            </div>
                        </div>

                        <button
                            className="work-card-expand-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpandedId(isExpanded ? null : item.id);
                            }}
                        >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? t('pipeline.collapseDetails') : t('pipeline.expandDetails')}
                        </button>

                        {isExpanded && (
                            <div className="work-card-details">
                                {decisions.length > 0 && (
                                    <div className="work-detail-section">
                                        <h5>{t('pipeline.decisionsLabel')}</h5>
                                        <ul>
                                            {decisions.map((d, i) => (
                                                <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {outputs.length > 0 && (
                                    <div className="work-detail-section">
                                        <h5>{t('pipeline.outputs')}</h5>
                                        <ul>
                                            {outputs.map((o, i) => (
                                                <li key={i}>{typeof o === 'string' ? o : JSON.stringify(o)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {pending.length > 0 && (
                                    <div className="work-detail-section">
                                        <h5>{t('pipeline.pendingQuestions')}</h5>
                                        <ul>
                                            {pending.map((q, i) => (
                                                <li key={i}>{typeof q === 'string' ? q : JSON.stringify(q)}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {contextForNext && (
                                    <div className="work-detail-section">
                                        <h5>{t('pipeline.contextHandedOff')}</h5>
                                        <p>{contextForNext}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
}
