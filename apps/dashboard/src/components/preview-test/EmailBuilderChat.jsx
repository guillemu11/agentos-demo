import React, { useEffect, useRef, useState } from 'react';
import { Send, Square, Mail, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import PhaseCard from './PhaseCard.jsx';
import AssetConfirmCards from './AssetConfirmCards.jsx';

const PHASE_KEYS = ['resolve', 'analyze', 'fetch', 'render'];

export default function EmailBuilderChat({
    status,
    messages,
    phases,
    confirmOptions,
    error,
    onSubmit,
    onSelectOption,
    onStop,
}) {
    const { t, lang } = useLanguage();
    const [input, setInput] = useState('');
    const listRef = useRef(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, phases, confirmOptions]);

    const busy = status === 'streaming';

    const handleSubmit = (e) => {
        e?.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || busy) return;
        setInput('');
        onSubmit(trimmed, lang);
    };

    const showPhases = Object.values(phases).some(p => p.status !== 'idle');

    return (
        <div className="eb-chat">
            <div className="eb-chat__messages" ref={listRef}>
                {messages.length === 0 && !busy && (
                    <div className="eb-chat__intro">
                        <div className="eb-chat__intro-icon"><Mail size={22} strokeWidth={1.4} /></div>
                        <div className="eb-chat__intro-title">{t('previewTest.chat.introTitle')}</div>
                        <div className="eb-chat__intro-help">{t('previewTest.chat.introHelp')}</div>
                    </div>
                )}

                {messages.map((m, i) => {
                    if (m.role === 'user') {
                        return (
                            <div key={i} className="eb-chat__bubble eb-chat__bubble--user">
                                {m._confirm ? <code>{m.content}</code> : m.content}
                            </div>
                        );
                    }
                    if (m.role === 'assistant') {
                        return (
                            <div key={i} className="eb-chat__bubble eb-chat__bubble--assistant">
                                {m.content}
                                {m._streaming && <span className="eb-chat__cursor">▋</span>}
                            </div>
                        );
                    }
                    if (m.role === 'tool') {
                        // Inline tool chip (kept minimal — phase cards carry the bigger signal)
                        return (
                            <div key={i} className={`eb-chat__tool ${m.kind === 'result' ? (m.ok ? 'is-ok' : 'is-err') : ''}`}>
                                <span className="eb-chat__tool-name">{m.name}</span>
                                {m.kind === 'use' && <span className="eb-chat__tool-dots">···</span>}
                                {m.kind === 'result' && <span className="eb-chat__tool-status">{m.ok ? '✓' : '✕'}</span>}
                            </div>
                        );
                    }
                    return null;
                })}

                {showPhases && (
                    <div className="eb-chat__phases">
                        {PHASE_KEYS.map(k => (
                            <PhaseCard
                                key={k}
                                phaseKey={k}
                                status={phases[k].status}
                                detail={phases[k].detail}
                                durationMs={phases[k].durationMs}
                            />
                        ))}
                    </div>
                )}

                {confirmOptions && confirmOptions.length > 0 && (
                    <AssetConfirmCards options={confirmOptions} onSelect={onSelectOption} />
                )}

                {error && (
                    <div className="eb-chat__error">
                        <AlertCircle size={14} />
                        <span>{error.message}</span>
                    </div>
                )}
            </div>

            <form className="eb-chat__composer" onSubmit={handleSubmit}>
                <input
                    className="eb-chat__input"
                    placeholder={t('previewTest.chat.placeholder')}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={busy}
                />
                {busy ? (
                    <button type="button" className="eb-chat__btn eb-chat__btn--stop" onClick={onStop} title={t('previewTest.chat.stop')}>
                        <Square size={14} />
                    </button>
                ) : (
                    <button type="submit" className="eb-chat__btn" disabled={!input.trim()} title={t('previewTest.chat.send')}>
                        <Send size={14} />
                    </button>
                )}
            </form>
        </div>
    );
}
