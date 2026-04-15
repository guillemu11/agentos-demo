import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { FileText, Package, Zap, HelpCircle, ArrowRight, MessageSquare, ChevronDown, ChevronRight, User, Bot } from 'lucide-react';
import { AgentAvatar } from './icons.jsx';
import renderMarkdown from '../utils/renderMarkdown.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function WorkLogTab({ projectId, pipeline: pipelineProp, sessions: sessionsProp, stages: stagesProp, agents: agentsProp, initialStage }) {
    const { t } = useLanguage();
    const [pipeline, setPipeline] = useState(pipelineProp || null);
    const [sessions, setSessions] = useState(sessionsProp || []);
    const [stages, setStages] = useState(stagesProp || []);
    const [agents, setAgents] = useState(agentsProp || []);
    const [loadingData, setLoadingData] = useState(!sessionsProp);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [expandedSections, setExpandedSections] = useState({ summary: true, outputs: true });
    const [conversationMessages, setConversationMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [conversationFetched, setConversationFetched] = useState(false);

    // Self-fetch pipeline data when not provided via props
    useEffect(() => {
        if (sessionsProp) return; // props provided, no need to fetch
        let cancelled = false;
        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [pipelineRes, agentsRes] = await Promise.all([
                    fetch(`${API_URL}/projects/${projectId}/pipeline`, { credentials: 'include' }),
                    fetch(`${API_URL}/agents`, { credentials: 'include' }),
                ]);
                if (!cancelled && pipelineRes.ok) {
                    const data = await pipelineRes.json();
                    setPipeline(data);
                    setStages(data.stages || []);
                    setSessions(data.sessions || []);
                }
                if (!cancelled && agentsRes.ok) {
                    setAgents(await agentsRes.json());
                }
            } catch (err) {
                console.error('WorkLogTab fetch error:', err);
            } finally {
                if (!cancelled) setLoadingData(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [projectId, sessionsProp]);

    // Build agent map
    const agentMap = {};
    (agents || []).forEach(a => { agentMap[a.id] = a; });

    // Build session map by stage_order
    const sessionByOrder = {};
    (sessions || []).forEach(s => { sessionByOrder[s.stage_order] = s; });

    // Default selection: first completed, or first active
    useEffect(() => {
        if (selectedAgent === null && sessions?.length > 0) {
            if (initialStage !== undefined) {
                setSelectedAgent(initialStage);
            } else {
                const completed = sessions.find(s => s.status === 'completed');
                const active = sessions.find(s => s.status === 'active');
                setSelectedAgent(completed?.stage_order ?? active?.stage_order ?? 0);
            }
        }
    }, [sessions, selectedAgent, initialStage]);

    // Reset conversation state when switching agents
    const handleSelectAgent = useCallback((stageOrder) => {
        setSelectedAgent(stageOrder);
        setConversationMessages([]);
        setLoadingMessages(false);
        setConversationFetched(false);
        setExpandedSections({ summary: true, outputs: true });
    }, []);

    const toggleSection = useCallback((key) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // Lazy load conversation messages
    const fetchConversation = useCallback(async (sessionId) => {
        if (!sessionId || loadingMessages || conversationFetched) return;
        setLoadingMessages(true);
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/sessions/${sessionId}/messages`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setConversationMessages(Array.isArray(data) ? data : (data.messages || []));
            }
        } catch (err) {
            console.error('Failed to fetch conversation:', err);
        } finally {
            setLoadingMessages(false);
            setConversationFetched(true);
        }
    }, [projectId, loadingMessages, conversationFetched]);

    // When conversation accordion is expanded, fetch messages
    const handleToggleConversation = useCallback((session) => {
        const wasExpanded = expandedSections.conversation;
        toggleSection('conversation');
        if (!wasExpanded && session?.id && !conversationFetched) {
            fetchConversation(session.id);
        }
    }, [expandedSections.conversation, toggleSection, conversationFetched, fetchConversation]);

    if (loadingData) {
        return <div style={{ textAlign: 'center', padding: '40px' }}>{t('common.loading')}</div>;
    }

    // Check if there are any completed or active sessions
    const hasWork = (sessions || []).some(s => s.status === 'completed' || s.status === 'active');

    if (!hasWork) {
        return (
            <div className="worklog-empty-state">
                <MessageSquare size={40} strokeWidth={1.5} />
                <p>{t('pipeline.workLogEmpty')}</p>
            </div>
        );
    }

    const session = selectedAgent !== null ? sessionByOrder[selectedAgent] : null;
    const selectedStage = (stages || []).find(s => s.stage_order === selectedAgent);
    const selectedAgentData = selectedStage ? agentMap[selectedStage.agent_id] : null;

    // Count completed sessions
    const completedCount = (sessions || []).filter(s => s.status === 'completed').length;
    const totalCount = (stages || []).length;

    // Parse deliverables safely
    let deliverables = {};
    if (session?.deliverables) {
        try {
            deliverables = typeof session.deliverables === 'string'
                ? JSON.parse(session.deliverables) : (session.deliverables || {});
        } catch {
            deliverables = {};
        }
    }
    const outputsList = deliverables.deliverables || [];
    const decisionsList = deliverables.decisions_made || [];
    const questionsList = deliverables.open_questions || [];
    const contextForNext = deliverables.context_for_next || '';

    // Duration calculation
    const durationMs = session?.completed_at && session?.started_at
        ? new Date(session.completed_at) - new Date(session.started_at) : null;
    const durationStr = durationMs
        ? (durationMs < 3600000
            ? `${Math.round(durationMs / 60000)}m`
            : `${Math.round(durationMs / 3600000 * 10) / 10}h`)
        : null;

    // Find next agent for handoff section
    const nextStage = (stages || []).find(s => s.stage_order === (selectedAgent ?? -1) + 1);
    const nextAgentName = nextStage ? (agentMap[nextStage.agent_id]?.name || nextStage.name) : null;

    // Summary text
    const summaryText = session?.summary_edited || session?.summary || '';

    return (
        <div className="worklog-container">
            {/* Left sidebar — agent list */}
            <div className="worklog-sidebar">
                <div className="worklog-sidebar-header">
                    <span className="worklog-sidebar-label">
                        {t('workspace.agents')} ({completedCount} {t('pipeline.completed').toLowerCase()} / {totalCount})
                    </span>
                </div>
                <div className="worklog-agent-list">
                    {(stages || [])
                        .sort((a, b) => a.stage_order - b.stage_order)
                        .map(stage => {
                            const stageSession = sessionByOrder[stage.stage_order];
                            const status = stageSession?.status || 'pending';
                            const agent = agentMap[stage.agent_id];
                            const isSelected = selectedAgent === stage.stage_order;
                            const isClickable = status === 'completed' || status === 'active';

                            return (
                                <div
                                    key={stage.stage_order}
                                    className={`worklog-agent-item ${isSelected ? 'selected' : ''}`}
                                    style={!isClickable ? { opacity: 0.35, cursor: 'default' } : undefined}
                                    onClick={() => isClickable && handleSelectAgent(stage.stage_order)}
                                >
                                    <span className="worklog-agent-avatar">
                                        <AgentAvatar agentId={agent?.id} size={18} />
                                    </span>
                                    <div className="worklog-agent-info">
                                        <span className="worklog-agent-name">
                                            {agent?.name || stage.agent_id || t('pipeline.noAgent')}
                                        </span>
                                        <div className="worklog-agent-meta">
                                            <span className="worklog-agent-stage">{stage.name}</span>
                                            <span className={`worklog-status-badge ${status}`}>
                                                {status === 'completed' && t('pipeline.completed')}
                                                {status === 'active' && t('pipeline.active')}
                                                {status === 'pending' && t('pipeline.pending')}
                                                {status === 'skipped' && t('pipeline.skipped')}
                                                {status === 'awaiting_handoff' && t('pipeline.awaiting_handoff')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Right panel — selected agent work */}
            <div className="worklog-panel">
                {session ? (
                    <>
                        {/* Panel header */}
                        <div className="worklog-panel-header">
                            <div className="worklog-panel-title">
                                <span className="worklog-panel-avatar">
                                    <AgentAvatar agentId={selectedAgentData?.id} size={20} />
                                </span>
                                <div>
                                    <h3>{selectedAgentData?.name || selectedStage?.agent_id}</h3>
                                    <span className="worklog-panel-stage">{selectedStage?.name}</span>
                                </div>
                            </div>
                            <div className="worklog-panel-meta">
                                <span>{t('pipeline.stage')} {selectedAgent + 1}</span>
                                {durationStr && <span>• {durationStr}</span>}
                                {conversationMessages.length > 0 && (
                                    <span>• {t('pipeline.messagesCount').replace('{count}', conversationMessages.length)}</span>
                                )}
                            </div>
                        </div>

                        {/* Active agent notice */}
                        {session.status === 'active' ? (
                            <div className="worklog-active-notice">
                                <Zap size={16} />
                                <span>{t('pipeline.active')} — {t('pipeline.generatingSummary')}</span>
                            </div>
                        ) : (
                            /* Accordion sections for completed sessions */
                            <div className="worklog-accordions">
                                {/* 1. Summary */}
                                <AccordionSection
                                    sectionKey="summary"
                                    title={t('weeklyBoard.summary')}
                                    icon={FileText}
                                    colorClass="accent-purple"
                                    expanded={expandedSections.summary}
                                    onToggle={() => toggleSection('summary')}
                                >
                                    {summaryText ? (
                                        <div
                                            className="md-content"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(summaryText) }}
                                        />
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>

                                {/* 2. Outputs & Assets */}
                                <AccordionSection
                                    sectionKey="outputs"
                                    title={t('pipeline.outputs')}
                                    icon={Package}
                                    colorClass="accent-green"
                                    count={outputsList.length}
                                    expanded={expandedSections.outputs}
                                    onToggle={() => toggleSection('outputs')}
                                >
                                    {outputsList.length > 0 ? (
                                        <div className="worklog-outputs-list">
                                            {outputsList.map((item, i) => (
                                                <div key={i} className="worklog-output-card">
                                                    <div
                                                        className="md-content"
                                                        dangerouslySetInnerHTML={{
                                                            __html: renderMarkdown(
                                                                typeof item === 'string' ? item : (item.title || item.name || JSON.stringify(item))
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>

                                {/* 3. Decisions */}
                                <AccordionSection
                                    sectionKey="decisions"
                                    title={t('pipeline.decisionsLabel')}
                                    icon={Zap}
                                    colorClass="accent-blue"
                                    count={decisionsList.length}
                                    expanded={expandedSections.decisions}
                                    onToggle={() => toggleSection('decisions')}
                                >
                                    {decisionsList.length > 0 ? (
                                        <ul className="worklog-decisions-list">
                                            {decisionsList.map((item, i) => (
                                                <li key={i}>
                                                    {typeof item === 'string' ? item : (item.decision || item.text || JSON.stringify(item))}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>

                                {/* 4. Pending Questions */}
                                <AccordionSection
                                    sectionKey="pending"
                                    title={t('pipeline.pendingQuestions')}
                                    icon={HelpCircle}
                                    colorClass="accent-amber"
                                    count={questionsList.length}
                                    expanded={expandedSections.pending}
                                    onToggle={() => toggleSection('pending')}
                                >
                                    {questionsList.length > 0 ? (
                                        <ul className="worklog-questions-list">
                                            {questionsList.map((item, i) => (
                                                <li key={i}>
                                                    {typeof item === 'string' ? item : (item.question || item.text || JSON.stringify(item))}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>

                                {/* 5. Handoff to next agent */}
                                <AccordionSection
                                    sectionKey="handoff"
                                    title={nextAgentName
                                        ? t('pipeline.handoffToAgent').replace('{name}', nextAgentName)
                                        : t('pipeline.handoff')}
                                    icon={ArrowRight}
                                    colorClass="accent-violet"
                                    expanded={expandedSections.handoff}
                                    onToggle={() => toggleSection('handoff')}
                                >
                                    {contextForNext ? (
                                        <div
                                            className="md-content"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(contextForNext) }}
                                        />
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>

                                {/* 6. Full Conversation (lazy loaded) */}
                                <AccordionSection
                                    sectionKey="conversation"
                                    title={t('pipeline.fullConversation')}
                                    icon={MessageSquare}
                                    colorClass="accent-gray"
                                    count={conversationMessages.length || undefined}
                                    expanded={expandedSections.conversation}
                                    onToggle={() => handleToggleConversation(session)}
                                >
                                    {loadingMessages ? (
                                        <div className="worklog-loading">
                                            <span>{t('common.loading')}</span>
                                        </div>
                                    ) : conversationMessages.length > 0 ? (
                                        <div className="worklog-conversation">
                                            {conversationMessages.map((msg, i) => (
                                                <div
                                                    key={msg.id || i}
                                                    className={`worklog-message ${msg.role || 'user'}`}
                                                >
                                                    <span className="worklog-message-role">
                                                        {msg.role === 'assistant' ? <AgentAvatar agentId={selectedAgentData?.id} size={16} /> : <User size={16} />}
                                                    </span>
                                                    <div className="worklog-message-content">
                                                        {msg.role === 'assistant' ? (
                                                            <div
                                                                className="md-content"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: renderMarkdown(msg.content || ''),
                                                                }}
                                                            />
                                                        ) : (
                                                            <p>{msg.content || ''}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="worklog-empty-text">{t('pipeline.workLogEmpty')}</p>
                                    )}
                                </AccordionSection>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="worklog-empty-state">
                        <FileText size={32} strokeWidth={1.5} />
                        <p>{t('pipeline.workLogEmpty')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Reusable accordion section component
 */
function AccordionSection({ sectionKey, title, icon: Icon, colorClass, count, expanded, onToggle, children }) {
    return (
        <div className="worklog-accordion">
            <div
                className={`worklog-accordion-header ${colorClass}`}
                onClick={onToggle}
            >
                <div className="worklog-accordion-title">
                    <Icon size={16} />
                    <span>{title}</span>
                    {count > 0 && (
                        <span className="worklog-accordion-count">{count}</span>
                    )}
                </div>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {expanded && (
                <div className="worklog-accordion-body">
                    {children}
                </div>
            )}
        </div>
    );
}
