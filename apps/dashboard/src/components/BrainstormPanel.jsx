import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useVoice } from '../hooks/useVoice.js';
import { MicButton } from './VoiceControls.jsx';
import { Bot } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function BrainstormPanel({ sessionId, department }) {
    const { t, lang } = useLanguage();
    const [contributions, setContributions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [brainstorming, setBrainstorming] = useState(false);
    const [responses, setResponses] = useState({});
    const [acceptedProjects, setAcceptedProjects] = useState({});
    const activeBrainstormIdRef = useRef(null);

    const handleTranscript = useCallback((transcript) => {
        const bid = activeBrainstormIdRef.current;
        if (bid != null) {
            setResponses(r => ({ ...r, [bid]: (r[bid] || '') + (r[bid] ? ' ' : '') + transcript }));
        }
    }, []);

    const {
        sttSupported, isListening, toggleListening,
    } = useVoice({ lang, onTranscript: handleTranscript });

    useEffect(() => {
        loadBrainstorms();
    }, [sessionId]);

    async function loadBrainstorms() {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/brainstorms`);
            const data = await res.json();
            setContributions(Array.isArray(data) ? data : []);
        } catch { /* ignore */ }
        setLoading(false);
    }

    async function handleBrainstorm() {
        setBrainstorming(true);
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/brainstorm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.contributions) {
                setContributions(data.contributions);
            }
        } catch (err) {
            alert(t('brainstorm.errorGenerating') + err.message);
        }
        setBrainstorming(false);
    }

    async function handleRespond(bid, action = null) {
        try {
            const res = await fetch(`${API_URL}/weekly-sessions/${sessionId}/brainstorm/${bid}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_response: responses[bid] || '',
                    action,
                }),
            });
            const data = await res.json();

            // Update contribution in local state
            setContributions(prev => prev.map(c =>
                c.id === parseInt(bid) ? { ...c, user_response: data.contribution.user_response } : c
            ));

            if (data.createdProject) {
                setAcceptedProjects(prev => ({ ...prev, [bid]: data.createdProject }));
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    if (loading) {
        return <p className="subtitle">{t('brainstorm.loading')}</p>;
    }

    return (
        <div>
            <div className="brainstorm-header">
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                    {t('brainstorm.title')}
                </h3>
                <button
                    className="brainstorm-trigger-btn"
                    onClick={handleBrainstorm}
                    disabled={brainstorming}
                >
                    {brainstorming ? t('brainstorm.agentsThinking') : contributions.length > 0 ? t('brainstorm.regenerate') : t('brainstorm.start')}
                </button>
            </div>

            {contributions.length === 0 && !brainstorming ? (
                <div className="brainstorm-empty">
                    <p>{t('brainstorm.noContributions')}</p>
                    <p style={{ fontSize: '0.82rem' }}>
                        {t('brainstorm.instructions')}
                    </p>
                </div>
            ) : (
                <div>
                    {contributions.map(c => (
                        <div key={c.id} className="brainstorm-card">
                            {/* Agent header */}
                            <div className="brainstorm-card-agent">
                                <span className="brainstorm-agent-avatar">{c.agent_avatar || <Bot size={18} />}</span>
                                <div>
                                    <div className="brainstorm-agent-name">{c.agent_name}</div>
                                    <div className="brainstorm-agent-role">{c.agent_role}</div>
                                </div>
                                <span className="contribution-type-badge" data-type={c.contribution_type}>
                                    {c.contribution_type}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="brainstorm-content">{c.content}</div>

                            {/* Response area */}
                            <div className="brainstorm-response-area">
                                {(c.user_response || acceptedProjects[c.id]) ? (
                                    <>
                                        <div className="brainstorm-user-response">
                                            <strong>{t('brainstorm.yourResponse')}</strong> {c.user_response}
                                        </div>
                                        {acceptedProjects[c.id] && (
                                            <div className="brainstorm-success-banner" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                <span>{t('brainstorm.projectCreatedLabel')} <strong>{acceptedProjects[c.id].name}</strong></span>
                                                <a
                                                    href={`/weekly/${department}?tab=pipeline`}
                                                    style={{ color: '#2563EB', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}
                                                >
                                                    {`${t('brainstorm.viewInPipeline')} →`}
                                                </a>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="brainstorm-response-input-row">
                                            <textarea
                                                className="brainstorm-response-input"
                                                value={responses[c.id] || ''}
                                                onChange={e => setResponses(r => ({ ...r, [c.id]: e.target.value }))}
                                                placeholder={t('brainstorm.responsePlaceholder')}
                                            />
                                            <MicButton
                                                isListening={isListening && activeBrainstormIdRef.current === c.id}
                                                onClick={() => {
                                                    activeBrainstormIdRef.current = c.id;
                                                    toggleListening();
                                                }}
                                                disabled={brainstorming}
                                                sttSupported={sttSupported}
                                            />
                                        </div>
                                        <div className="brainstorm-response-actions">
                                            <button
                                                className="brainstorm-respond-btn"
                                                onClick={() => handleRespond(c.id)}
                                            >
                                                {t('brainstorm.respond')}
                                            </button>
                                            <button
                                                className="brainstorm-accept-btn"
                                                onClick={() => handleRespond(c.id, 'accept_project')}
                                            >
                                                {t('brainstorm.acceptAsProject')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
