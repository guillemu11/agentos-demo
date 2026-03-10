import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { Bot, User } from 'lucide-react';

export default function ConversationThread({ messages, typingAgent, streamingText }) {
    const { t } = useLanguage();
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingAgent, streamingText]);

    if (messages.length === 0 && !typingAgent) {
        return (
            <div className="mab-thread mab-thread-empty">
                <div className="mab-empty-state">
                    <Bot size={40} strokeWidth={1.5} />
                    <p>{t('multiBrainstorm.emptyState')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mab-thread">
            {messages.map((msg, idx) => {
                if (msg.type === 'pause_for_human') {
                    return (
                        <div key={msg.id || `pause-${idx}`} className="mab-pause-marker">
                            <span>{t('multiBrainstorm.yourTurn')}</span>
                        </div>
                    );
                }

                if (msg.type === 'system_message') {
                    return (
                        <div key={msg.id || `sys-${idx}`} className="mab-system-msg">
                            <span>{msg.content}</span>
                        </div>
                    );
                }

                if (msg.type === 'human_message') {
                    return (
                        <div key={msg.id || `human-${idx}`} className="mab-bubble mab-bubble-human">
                            <div className="mab-bubble-header">
                                <span className="mab-avatar-human"><User size={16} /></span>
                                <span className="mab-agent-name">{t('multiBrainstorm.you')}</span>
                            </div>
                            <div className="mab-bubble-content">{msg.content}</div>
                        </div>
                    );
                }

                // agent_message
                return (
                    <div key={msg.id || `agent-${idx}`} className="mab-bubble mab-bubble-agent">
                        <div className="mab-bubble-header">
                            <span className="mab-avatar-agent">
                                {msg.agent_avatar || <Bot size={16} />}
                            </span>
                            <span className="mab-agent-name">{msg.agent_name}</span>
                            {msg.agent_role && (
                                <span className="mab-agent-role">{msg.agent_role}</span>
                            )}
                        </div>
                        <div className="mab-bubble-content">{msg.content}</div>
                    </div>
                );
            })}

            {/* Typing indicator */}
            {typingAgent && (
                <div className="mab-bubble mab-bubble-agent mab-bubble-typing">
                    <div className="mab-bubble-header">
                        <span className="mab-avatar-agent">
                            {typingAgent.avatar || <Bot size={16} />}
                        </span>
                        <span className="mab-agent-name">{typingAgent.name}</span>
                        {typingAgent.role && (
                            <span className="mab-agent-role">{typingAgent.role}</span>
                        )}
                    </div>
                    <div className="mab-bubble-content mab-typing-dots">
                        {streamingText || (
                            <span className="mab-dots">
                                <span>.</span><span>.</span><span>.</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
