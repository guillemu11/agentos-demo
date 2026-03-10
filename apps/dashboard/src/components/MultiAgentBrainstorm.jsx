import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useVoice } from '../hooks/useVoice.js';
import ProjectQueue from './brainstorm/ProjectQueue.jsx';
import ConversationThread from './brainstorm/ConversationThread.jsx';
import HumanInputBar from './brainstorm/HumanInputBar.jsx';
import { MessageSquare, Loader, Volume2, VolumeX } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Delay between messages during replay (ms)
const MSG_DELAY_MIN = 1200;
const MSG_DELAY_MAX = 2500;
const TYPING_DELAY = 800;

function randomDelay() {
    return MSG_DELAY_MIN + Math.random() * (MSG_DELAY_MAX - MSG_DELAY_MIN);
}

export default function MultiAgentBrainstorm({ sessionId, department, sessionInbox }) {
    const { t, lang } = useLanguage();
    const { ttsSupported, ttsEnabled, setTtsEnabled, speakAsync, stopSpeaking } = useVoice({ lang });

    // Conversation state
    const [status, setStatus] = useState('idle'); // idle | generating | playing | paused_for_human | completed
    const [conversationId, setConversationId] = useState(null);
    const [allMessages, setAllMessages] = useState([]); // full pre-generated messages
    const [displayedMessages, setDisplayedMessages] = useState([]); // messages shown so far
    const [currentProjectIndex, setCurrentProjectIndex] = useState(0);
    const [discussedProjects, setDiscussedProjects] = useState([]);
    const [typingAgent, setTypingAgent] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Refs for replay control
    const playbackRef = useRef(null);
    const playQueueRef = useRef([]);
    const abortRef = useRef(false);
    const displayedCountRef = useRef(0);

    const projects = Array.isArray(sessionInbox) ? sessionInbox : [];

    // Check for existing conversation on mount
    useEffect(() => {
        checkExistingConversation();
    }, [sessionId]);

    async function checkExistingConversation() {
        setLoading(true);
        try {
            // Try to find an existing conversation for this session
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/brainstorms`);
            // We check via the brainstorm_conversations endpoint — but we need to try the multi-brainstorm listing
            // For now, just set idle state
        } catch { /* ignore */ }
        setLoading(false);
    }

    // Start a new conversation
    async function handleStart() {
        if (projects.length === 0) return;

        setStatus('generating');
        setError(null);
        setDisplayedMessages([]);
        setAllMessages([]);
        setDiscussedProjects([]);
        setCurrentProjectIndex(0);
        displayedCountRef.current = 0;
        abortRef.current = false;

        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/multi-brainstorm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projects }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate conversation');
            }

            const data = await res.json();
            setConversationId(data.conversation_id);
            setAllMessages(data.messages);

            // Start replay
            startReplay(data.messages);
        } catch (err) {
            setError(err.message);
            setStatus('idle');
        }
    }

    // Replay messages one by one with delays
    function startReplay(messages) {
        setStatus('playing');
        playQueueRef.current = [...messages];
        displayedCountRef.current = 0;
        playNextMessage();
    }

    function playNextMessage() {
        if (abortRef.current) return;

        const queue = playQueueRef.current;
        const nextIdx = displayedCountRef.current;

        if (nextIdx >= queue.length) {
            setStatus('completed');
            setTypingAgent(null);
            return;
        }

        const msg = queue[nextIdx];

        // If it's a pause_for_human, show it and pause
        if (msg.type === 'pause_for_human') {
            setTypingAgent(null);
            setDisplayedMessages(prev => [...prev, msg]);
            displayedCountRef.current = nextIdx + 1;
            setStatus('paused_for_human');
            return;
        }

        // For agent messages, show typing indicator first
        if (msg.type === 'agent_message') {
            setTypingAgent({
                name: msg.agent_name,
                avatar: msg.agent_avatar,
                role: msg.agent_role,
            });

            // Track project transitions
            if (msg.project_index !== undefined && msg.project_index !== currentProjectIndex) {
                setDiscussedProjects(prev => {
                    const updated = [...prev];
                    if (!updated.includes(currentProjectIndex)) updated.push(currentProjectIndex);
                    return updated;
                });
                setCurrentProjectIndex(msg.project_index);
            }

            // After typing delay, show the message
            playbackRef.current = setTimeout(async () => {
                if (abortRef.current) return;
                setTypingAgent(null);
                setDisplayedMessages(prev => [...prev, msg]);
                displayedCountRef.current = nextIdx + 1;

                if (ttsEnabled && msg.content) {
                    await speakAsync(msg.content);
                    if (!abortRef.current) playNextMessage();
                } else {
                    playbackRef.current = setTimeout(() => playNextMessage(), randomDelay());
                }
            }, TYPING_DELAY);
        } else {
            // system_message — show immediately
            setTypingAgent(null);

            if (msg.type === 'system_message' && msg.project_index !== undefined) {
                setDiscussedProjects(prev => {
                    const updated = [...prev];
                    if (!updated.includes(currentProjectIndex)) updated.push(currentProjectIndex);
                    return updated;
                });
                setCurrentProjectIndex(msg.project_index);
            }

            setDisplayedMessages(prev => [...prev, msg]);
            displayedCountRef.current = nextIdx + 1;
            playbackRef.current = setTimeout(() => playNextMessage(), 600);
        }
    }

    // Human sends a message during pause
    async function handleHumanMessage(content) {
        if (!conversationId) return;

        const humanMsg = {
            id: `human-${Date.now()}`,
            type: 'human_message',
            content,
            project_index: currentProjectIndex,
        };

        setDisplayedMessages(prev => [...prev, humanMsg]);

        // Persist to backend
        try {
            await fetch(`${API_URL}/weekly-sessions/${sessionId}/multi-brainstorm/${conversationId}/human-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, project_index: currentProjectIndex }),
            });
        } catch { /* non-critical */ }

        // Resume replay after a brief pause
        setTimeout(() => {
            setStatus('playing');
            playNextMessage();
        }, 1000);
    }

    // Skip to next project
    function handleSkipProject() {
        if (abortRef.current) return;
        clearTimeout(playbackRef.current);
        setTypingAgent(null);

        const queue = playQueueRef.current;
        let nextIdx = displayedCountRef.current;

        // Find next message from a different project
        while (nextIdx < queue.length) {
            const msg = queue[nextIdx];
            if (msg.project_index !== undefined && msg.project_index > currentProjectIndex) break;
            nextIdx++;
        }

        if (nextIdx >= queue.length) {
            // No more projects
            setDiscussedProjects(prev => [...prev, currentProjectIndex]);
            setStatus('completed');
            return;
        }

        setDiscussedProjects(prev => {
            const updated = [...prev];
            if (!updated.includes(currentProjectIndex)) updated.push(currentProjectIndex);
            return updated;
        });

        displayedCountRef.current = nextIdx;
        playNextMessage();
    }

    // End session
    function handleEnd() {
        abortRef.current = true;
        clearTimeout(playbackRef.current);
        setTypingAgent(null);
        stopSpeaking();
        setStatus('completed');
        setDiscussedProjects(prev => {
            const updated = [...prev];
            if (!updated.includes(currentProjectIndex)) updated.push(currentProjectIndex);
            return updated;
        });
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortRef.current = true;
            clearTimeout(playbackRef.current);
        };
    }, []);

    if (loading) {
        return <p className="subtitle">{t('multiBrainstorm.loading')}</p>;
    }

    return (
        <div className="mab-container">
            {/* Header */}
            <div className="mab-header">
                <div className="mab-header-left">
                    <MessageSquare size={20} />
                    <h3>{t('multiBrainstorm.title')}</h3>
                    {ttsSupported && (
                        <button
                            className={`mab-tts-toggle ${ttsEnabled ? 'mab-tts-active' : ''}`}
                            onClick={() => setTtsEnabled(!ttsEnabled)}
                            title={ttsEnabled ? 'Disable audio' : 'Enable audio playback'}
                        >
                            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                    )}
                </div>
                {status === 'idle' && (
                    <button
                        className="mab-start-btn"
                        onClick={handleStart}
                        disabled={projects.length === 0}
                    >
                        {t('multiBrainstorm.startConversation')}
                    </button>
                )}
                {status === 'generating' && (
                    <span className="mab-generating">
                        <Loader size={16} className="mab-spin" />
                        {t('multiBrainstorm.generating')}
                    </span>
                )}
                {status === 'completed' && (
                    <button
                        className="mab-start-btn"
                        onClick={handleStart}
                    >
                        {t('multiBrainstorm.restart')}
                    </button>
                )}
            </div>

            {/* Project Queue */}
            {projects.length > 0 && (status !== 'idle' || displayedMessages.length > 0) && (
                <ProjectQueue
                    projects={projects}
                    currentIndex={currentProjectIndex}
                    discussedIndices={discussedProjects}
                />
            )}

            {/* Empty state */}
            {status === 'idle' && displayedMessages.length === 0 && (
                <div className="mab-empty">
                    {projects.length === 0 ? (
                        <p>{t('multiBrainstorm.noProjects')}</p>
                    ) : (
                        <p>{t('multiBrainstorm.instructions')}</p>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mab-error">
                    <p>{t('multiBrainstorm.error')}: {error}</p>
                </div>
            )}

            {/* Conversation Thread */}
            {(displayedMessages.length > 0 || typingAgent) && (
                <ConversationThread
                    messages={displayedMessages}
                    typingAgent={typingAgent}
                />
            )}

            {/* Input Bar */}
            {status !== 'idle' && (
                <HumanInputBar
                    onSend={handleHumanMessage}
                    onSkipProject={handleSkipProject}
                    onEnd={handleEnd}
                    disabled={status !== 'paused_for_human'}
                    waitingForHuman={status === 'paused_for_human'}
                    isRunning={status === 'playing' || status === 'paused_for_human'}
                    ttsEnabled={ttsEnabled}
                    setTtsEnabled={setTtsEnabled}
                    ttsSupported={ttsSupported}
                />
            )}
        </div>
    );
}
