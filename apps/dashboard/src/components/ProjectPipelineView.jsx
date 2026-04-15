import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ProjectPipeline from './ProjectPipeline.jsx';
import ProjectAgentChat from './ProjectAgentChat.jsx';
import WorkLogTab from './WorkLogTab.jsx';
import HandoffModal from './HandoffModal.jsx';
import PipelineSelector from './PipelineSelector.jsx';
import { X, MessageSquare } from 'lucide-react';
import { AgentAvatar } from './icons.jsx';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ProjectPipelineView({ projectId }) {
    const { t } = useLanguage();
    const [pipeline, setPipeline] = useState(null);
    const [stages, setStages] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [agents, setAgents] = useState([]);
    const [selectedStage, setSelectedStage] = useState(null);
    const [handoffSession, setHandoffSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const fetchPipeline = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/pipeline`, { credentials: 'include' });
            if (res.status === 404) { setPipeline(null); setLoading(false); return; }
            if (!res.ok) throw new Error('Failed to load pipeline');
            const data = await res.json();
            setPipeline(data);
            setStages(data.stages || []);
            setSessions(data.sessions || []);

            const activeSession = (data.sessions || []).find(s => s.status === 'active');
            if (activeSession && selectedStage === null) setSelectedStage(activeSession.stage_order);
        } catch (err) {
            console.error('Pipeline fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/agents`, { credentials: 'include' });
            if (res.ok) setAgents(await res.json());
        } catch {}
    }, []);

    useEffect(() => { fetchPipeline(); fetchAgents(); }, [fetchPipeline, fetchAgents]);

    useEffect(() => {
        if (!isChatOpen) return;
        const onKeyDown = (e) => { if (e.key === 'Escape') setIsChatOpen(false); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isChatOpen]);

    const handlePause = async () => {
        await fetch(`${API_URL}/projects/${projectId}/pipeline/pause`, { method: 'POST', credentials: 'include' });
        fetchPipeline();
    };

    const handleResume = async () => {
        await fetch(`${API_URL}/projects/${projectId}/pipeline/resume`, { method: 'POST', credentials: 'include' });
        fetchPipeline();
    };

    const handleSkip = async (stageOrder) => {
        if (!confirm(t('pipeline.skipConfirm'))) return;
        await fetch(`${API_URL}/projects/${projectId}/pipeline/stages/${stageOrder}/skip`, {
            method: 'POST', credentials: 'include'
        });
        fetchPipeline();
    };

    const handleHandoffComplete = () => {
        setHandoffSession(null);
        fetchPipeline();
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>{t('pipeline.title')}...</div>;

    if (!pipeline) return <PipelineSelector projectId={projectId} onCreated={() => fetchPipeline()} />;

    const selectedSession = sessions.find(s => s.stage_order === selectedStage);
    const completedSessions = sessions.filter(s => s.status === 'completed').sort((a, b) => a.stage_order - b.stage_order);

    return (
        <div className="pipeline-container">
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {pipeline.status === 'active' && (
                    <button className="back-button" onClick={handlePause}>⏸ {t('pipeline.pause')}</button>
                )}
                {pipeline.status === 'paused' && (
                    <button className="back-button save-btn" onClick={handleResume}>▶ {t('pipeline.resume')}</button>
                )}
            </div>

            <ProjectPipeline pipeline={pipeline} sessions={sessions} stages={stages} agents={agents}
                selectedStage={selectedStage} onSelectStage={setSelectedStage}
                onHandoff={(session) => setHandoffSession(session)} onSkip={handleSkip} />

            {selectedSession && selectedSession.status === 'active' && !isChatOpen && (
                <button
                    className="pipeline-open-chat-btn"
                    onClick={() => setIsChatOpen(true)}
                >
                    <MessageSquare size={14} /> {t('agentChat.tab')}
                </button>
            )}

            {isChatOpen && selectedSession && selectedSession.status === 'active' && (() => {
                const activeStage = stages.find(s => s.stage_order === selectedStage);
                const activeAgent = agents.find(a => a.id === activeStage?.agent_id);
                return createPortal(
                    <div className="chat-fullscreen-overlay" role="dialog" aria-modal="true">
                        <div className="chat-fullscreen-header">
                            <div className="chat-fullscreen-agent-info">
                                <span className="chat-fullscreen-avatar"><AgentAvatar agentId={activeAgent?.id} size={20} /></span>
                                <div>
                                    <div className="chat-fullscreen-agent-name">{activeAgent?.name || activeStage?.name}</div>
                                    <div className="chat-fullscreen-context">{activeStage?.name}</div>
                                </div>
                            </div>
                            <button
                                className="chat-fullscreen-close"
                                onClick={() => setIsChatOpen(false)}
                                aria-label={t('agentChat.closeOverlay')}
                            >
                                <X size={14} />
                                {t('agentChat.closeOverlay')}
                            </button>
                        </div>
                        <div className="chat-fullscreen-body">
                            <ProjectAgentChat projectId={projectId} session={selectedSession}
                                completedSessions={completedSessions} agents={agents}
                                pipelineStatus={pipeline.status}
                                onHandoffRequest={(session) => setHandoffSession(session)}
                                onViewCompletedStage={(order) => setSelectedStage(order)} />
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {selectedSession && selectedSession.status === 'completed' && (
                <WorkLogTab projectId={projectId} pipeline={pipeline}
                    sessions={sessions} stages={stages} agents={agents}
                    initialStage={selectedStage} />
            )}

            {handoffSession && (
                <HandoffModal projectId={projectId} session={handoffSession}
                    stages={stages} agents={agents}
                    onClose={() => setHandoffSession(null)} onComplete={handleHandoffComplete} />
            )}
        </div>
    );
}
