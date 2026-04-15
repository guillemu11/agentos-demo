import React from 'react';
import { Lock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

export default function ProjectPipeline({ pipeline, sessions, stages, agents, selectedStage, onSelectStage, onHandoff, onSkip }) {
    const { t } = useLanguage();

    if (!pipeline || !stages) return null;

    const sessionByOrder = {};
    (sessions || []).forEach(s => { sessionByOrder[s.stage_order] = s; });

    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });

    return (
        <div className="pipeline-timeline">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`pipeline-status-badge ${pipeline.status}`}>
                        {t(`pipeline.${pipeline.status}`) || pipeline.status}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {sessions?.filter(s => s.status === 'completed').length || 0}/{stages.length} {t('pipeline.stages')}
                    </span>
                </div>
            </div>
            {stages.map(stage => {
                const session = sessionByOrder[stage.stage_order];
                const status = session?.status || 'pending';
                const agent = agentMap[stage.agent_id];
                const isSelected = selectedStage === stage.stage_order;

                return (
                    <div key={stage.stage_order} className="pipeline-stage" onClick={() => onSelectStage(stage.stage_order)}>
                        <div className={`pipeline-stage-dot ${status}`} />
                        <div className="pipeline-stage-line" />
                        <div className={`pipeline-stage-content ${status} ${isSelected ? 'selected' : ''}`}>
                            <div className="pipeline-stage-header">
                                <div>
                                    <span className="pipeline-stage-title">[{stage.stage_order}] {stage.name}</span>
                                    <span className="pipeline-stage-agent"> — {agent?.name || stage.agent_id}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {stage.gate_type === 'human_approval' && <span className="gate-badge"><Lock size={12} /></span>}
                                    <span className={`pipeline-status-badge ${status}`}>
                                        {t(`pipeline.${status}`) || status}
                                    </span>
                                </div>
                            </div>
                            {session?.summary && status === 'completed' && (
                                <div className="pipeline-stage-summary">
                                    {(session.summary_edited || session.summary).substring(0, 150)}
                                    {(session.summary_edited || session.summary).length > 150 ? '...' : ''}
                                </div>
                            )}
                            {status === 'completed' && isSelected && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '4px' }}>
                                    ▼ {t('pipeline.viewDetails')}
                                </div>
                            )}
                            <div className="pipeline-stage-meta">
                                {session?.started_at && <span>Started {timeAgo(session.started_at)}</span>}
                                {session?.completed_at && <span>• Done {timeAgo(session.completed_at)}</span>}
                                {stage.department && <span>• {stage.department}</span>}
                            </div>
                            {status === 'active' && isSelected && (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                        style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); onHandoff(session); }}>
                                        {t('pipeline.handoff')} →
                                    </button>
                                    <button
                                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); onSkip(stage.stage_order); }}>
                                        {t('pipeline.skip')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
