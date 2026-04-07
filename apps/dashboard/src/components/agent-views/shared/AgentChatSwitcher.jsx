import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import AgentChat from '../../AgentChat.jsx';
import ProjectAgentChat from '../../ProjectAgentChat.jsx';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function AgentChatSwitcher({ agent, selectedTicket, pipelineData, currentSession, completedSessions, agents, onClearTicket, onHandoffRequest, externalInput, onExternalInputConsumed, onHtmlGenerated, onHtmlPatched, onHtmlBlock, currentHtml, canvasBlocks, activeBlock, onActiveBlockClear, onStreamEvent, projectId }) {
    const { t } = useLanguage();

    // Pipeline chat mode — show when ticket selected and we have pipeline data
    if (selectedTicket && pipelineData) {
        // Find session: prefer currentSession, fall back to match by session ID
        const session = currentSession
            || (pipelineData.sessions || []).find(s => s.id === selectedTicket.id);

        if (session) {
            return (
                <div className="agent-chat-switcher-pipeline">
                    <div className="pipeline-chat-mode-bar">
                        <div className="pipeline-chat-mode-info">
                            <GitBranch size={14} />
                            <span>
                                <strong>{t('pipeline.workingOn')}:</strong> {selectedTicket.project_name} — {selectedTicket.stage_name}
                            </span>
                        </div>
                        <button className="back-link" onClick={onClearTicket}>
                            <ArrowLeft size={14} />
                            {t('pipeline.backToNormalChat')}
                        </button>
                    </div>
                    <ProjectAgentChat
                        projectId={selectedTicket.project_id}
                        session={session}
                        completedSessions={completedSessions}
                        stages={pipelineData.stages}
                        agents={agents}
                        pipelineStatus={pipelineData.status}
                        onHandoffRequest={onHandoffRequest}
                        onHtmlBlock={onHtmlBlock}
                        onHtmlGenerated={onHtmlGenerated}
                        onHtmlPatched={onHtmlPatched}
                        currentHtml={currentHtml}
                        canvasBlocks={canvasBlocks}
                    />
                </div>
            );
        }
    }

    // Loading state — ticket selected but pipeline data not ready
    if (selectedTicket && !pipelineData) {
        return (
            <div className="agent-chat-switcher-loading">
                <div className="pipeline-chat-mode-bar">
                    <div className="pipeline-chat-mode-info">
                        <GitBranch size={14} />
                        <span>{t('pipeline.loadingContext')}...</span>
                    </div>
                    <button className="back-link" onClick={onClearTicket}>
                        <ArrowLeft size={14} />
                        {t('pipeline.backToNormalChat')}
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                    <div className="loading-pulse" />
                </div>
            </div>
        );
    }

    // Normal chat mode
    return (
        <AgentChat
            agentId={agent.id}
            agentName={agent.name}
            agentAvatar={agent.avatar}
            externalInput={externalInput}
            onExternalInputConsumed={onExternalInputConsumed}
            onHtmlGenerated={onHtmlGenerated}
            onHtmlPatched={onHtmlPatched}
            onHtmlBlock={onHtmlBlock}
            currentHtml={currentHtml}
            canvasBlocks={canvasBlocks}
            activeBlock={activeBlock}
            onActiveBlockClear={onActiveBlockClear}
            onStreamEvent={onStreamEvent}
            projectId={projectId}
        />
    );
}
